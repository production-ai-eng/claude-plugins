# The verification design

The rebuild rests on one rule: **a builder's report proves nothing; only a test that fails when the code is wrong counts.** Everything here exists to make that rule something a machine checks.

The plan's `verification.md` adapts this standard to the project's language and tools. The names below are roles, not file names.

## One command per session: the phase command

One command decides a session. It takes the session id, runs everything that must hold at that point, exits 0 or not, and writes a summary file. The builder reports no result from any other command, and the reviewer runs the same one.

It is cumulative: session N's run includes every earlier session's tests. It fails for more reasons than a failing test:

| Check | Fails when |
|---|---|
| Expected tests | An acceptance test the plan assigns to this session or an earlier one is missing. The expected list is read from the plan's data files, not typed into the tool. |
| No hollow tests | A test is skipped, filtered, marked todo or only, or makes no assertion. |
| Fixture integrity | A plan-owned fixture differs from the manifest by one byte, or a file is missing from the manifest. |
| Static layer | The source contains a pattern the plan bans, or a file exists outside what the plan allows. |
| Clean tree | There are uncommitted changes (with an explicit switch to allow it for the reviewer's own mutations). |
| Opt-outs | A test used an escape hatch of the harness that the plan does not allow that test. |

The summary file records: the session, the commit, each test id with its result and assertion count, the fixture hashes, the static results, the opt-outs, the tool versions, and the time each layer took. Two runs at the same commit produce the same summary apart from times.

**No test nests the whole phase command.** A test that checks the tool by running the full phase command inside itself makes every run pay for two: in a large rebuild one such test was most of the run's time. Test the tool on a small fixture world instead. Before blaming a layer for being slow, read the layer timings in the summary.

**Expensive worlds are built once.** A test world that takes real requests to build (thousands of rows, say) is built once per run and shared by the tests that only read it.

The phase command also has a mode that writes the generated parts of the handback from the same run (`handback-generated.md` beside the handback; a project set up before plugin 0.3.0 may print them instead), and a mode that compares its summary with another one.

## The static layer

Rules checked by reading the source, for things a test cannot see: a banned call, an import across a boundary, a machine path, a secret-shaped string, a document that claims something that does not exist. Each rule has an id, a pattern, the paths it covers and the paths it exempts.

Exemptions are where a static layer rots. Every exemption is listed in one place with its reason, and the reviewer reads the list at each review.

## Mutation checks

A mutation is a small patch that puts a defect back into the product. The mutation run applies each patch in a scratch copy, runs the named test, and expects it to fail. A mutation whose test still passes is a survivor, and a survivor fails the session.

The plan lists the mutations per session, each chosen for a defect that matters: remove an authorisation check, drop a state transition's guard, return success without writing. The builder writes the patch files; the reviewer checks that each patch does what its header says and nothing else.

- **A patch runs the one test file that must catch it**, not the whole layer, and the tool checks that this file passes before the patch is applied. The tool honours that line as written; replacing it by the phase command made each mutation cost two full runs.
- **Every session runs every earlier mutation too** (the full run), because a later change can revive an old defect. That list only grows, so the full run is the conductor's, at the tip under review; the builder runs only the patches whose lines it moved or changed (a single-patch mode).
- **Each change prints a line as it finishes** (its result, flushed at once, not held in a buffer), so that a stall check on the output can tell a slow run from a hung one.
- **Each change has a time limit.** The tool stops a change's test run after a set limit (minutes, well above the slowest normal run) and counts the change as killed, with the reason `timed out` recorded beside it. A defect that makes a test hang is caught: a hang is a failing test. Without the limit, one such change stops the whole run, and every session waits on it.
- **The tool clears its own scratch state at start**: leftover processes and scratch copies of an interrupted run make every mutation report "baseline did not pass" within seconds. That message, that fast, means leftovers, not a failing test.

## The line sweep

The mutation list is what the plan's authors thought of. The line sweep is what they did not: a tool that removes each line of product code that makes a decision (a refusal, a guard, a write, a state change, a cleanup), one at a time, runs the tests, and reports each change as killed, survived or skipped. A survivor is a behaviour no test holds.

- **Build it in the first build session**, with its own self-test, so that every later session is swept from the start. Added after several sessions, it meets all of their survivors at once.
- It takes a commit to sweep from (only lines changed since then), so that a re-review sweeps only the new lines.
- It gives each change a time limit, as the mutation tool does: a removed or flipped condition can make a loop run forever, and a timed-out change counts as killed, with `timed out` recorded as its reason.
- It sweeps numeric literals too, including those written with digit separators (`86_400`): a sweep that only knows plain digits never touches a limit written that way.
- It is long (hours on a large session), so it is the conductor's to run, at the tip under review, never the builder's. The builder receives the survivors and, for each, kills it with a test or explains it with the smallest setup it tried. An explanation is a claim the reviewer tries to disprove.

## Tests before code

For each acceptance test: write it from the plan, run it, see it fail, commit it, then write the code. The order is visible in the branch history. A file that holds assertions (a self-test of a harness module, for example) is committed before the module it tests, for the same reason.

The reviewer checks the order from the history and checks out the commit that added the tests to confirm they fail there. A test that passes at its own commit either tests nothing or was written after the code.

## Test layers

Name the layers and say what each may touch, cheapest first. A usual set:

- **static**: reads source and documents; runs nothing.
- **core**: the product's logic in one process, against stand-ins for the platform (storage, clock, timers, randomness, network) that refuse everything the real platform refuses.
- **integration**: real processes and real tools on this machine.
- **live**: the deployed system or a paid service. Never in the phase command; started by hand with the owner present.

Stand-ins are checked against the real platform's recorded answers from a spike, so a stand-in that is more permissive than the platform is caught.

## Rules for the builder

1. Test first.
2. Fixtures are the plan. Do not edit one. If the code and a fixture disagree, stop and report.
3. Never weaken a test: no changed expected value, no skip, no edit of an earlier session's test without a ruling.
4. One command. Report nothing from any other.
5. Say what was not done. An unfinished item listed as not done is a normal outcome. An unfinished item reported as done fails the session.
6. When the plan looks wrong, stop. Write what each place says and ask.
7. Short commands only. Single test files while working; the phase command once, in the foreground, at the end. Never a background command polled with `sleep`: the turn ends while it waits. The full mutation run and the line sweep are the conductor's.
8. A test fails at its own commit on its own assertion, not on a missing module, a missing checker or a syntax error. A self-test of a harness module or a tool is committed alone, before the change it tests.

## What the builder hands back

`handback/<session>/handback.md`: one page (the template is `templates/handback.md`). The parts a tool can produce are not typed: the phase command's handback mode writes them into `handback-generated.md` beside it (acceptance tests, requirement to tests, mutations killed and by which test, opt-outs), and the summary files sit beside both. Test output is not pasted in: the reviewer runs the command and compares the files.

| Heading | Content |
|---|---|
| Tip | The full commit id. |
| Results | The phase command's result line, copied from the tool. The `--patch` result of each patch changed or moved. |
| What was built | Five lines at most, in terms of behaviour. For a spike, each note and its answer word. |
| Deviations and rulings used | Each ruling relied on, by label; anything done differently, and why; changes to earlier tests, fixtures or harness, with reasons; anything not done; anything only the owner can do, with exact commands; for a findings round, each finding and its commits. |
| Questions | `None.`, or `blocked` on the first line and each question with its two readings. |
| Least sure of | What a reviewer should try first, and for each line called untestable, the smallest setup tried. |

The builder writes the file first, with a line `UNFINISHED` at the top and its task list, updates it at each commit, and removes the line at the end. A turn that ends with the line still there is an unfinished turn, and the next turn starts from the list. A builder that is blocked writes `blocked` under Questions and ends its turn: that is how a builder that cannot ask mid-run asks. `factory.mjs check-handback` reads all three states, and still reads the fourteen-heading handback of earlier plugin versions.
