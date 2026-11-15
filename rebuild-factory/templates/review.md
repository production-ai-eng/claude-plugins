# Review of session <id> — <date>

<!--
Each look is written to handback/<session>/review-<n>.md by the reviewer (without the verdict and the
rulings, which are the conductor's). The final record, handback/<session>/REVIEW.md, adds the verdict,
the table of looks and the time.
-->

Verdict: <accepted | not accepted, findings sent back (failed review n of limit)>. <Merge commit and tag, or "not merged">.

## Conductor's checks at the tip

At `<commit>`, run by the conductor before the review: the phase command (exit code, tests passed), the full mutation run (killed of total), the line sweep (changes, killed, survived, skipped; since which commit).

## Reproduced

From a fresh clone of `<branch>` at `<commit>`, after the install command:

- The phase command: exit code, tests passed, and whether the summary equals the builder's (name any field that differs and why).
- The mutation command: exit code, each mutation and the test that killed it.
- Fixtures against the plan's copy.
- Scope: files added, changed, deleted; all inside what the block allows, or which are not.
- History: each test committed before its code, and failing at its own commit; or which are not.
- The other tool modes.

## Breakages

| Label | Exact change (file:line, before → after) | Derived from | Expected to fail | Result |
|---|---|---|---|---|
| P01 | | guard / guard's guard / line removal / carried finding / earlier plant P.. / challenged explanation | | killed / survived |

Labels are kept from look to look: a re-review re-applies every earlier plant by its label, and says which now fail.

For each survivor: which of the four judgements applies, and why.

## Explanations challenged

Each survivor the builder explained as "cannot be tested" or "no observable effect" that was tried: the setup tried, and whether the explanation was refuted.

## Not checked

What the review did not run or read. Be exact.

## Exemptions and opt-outs

Every exemption in the static checker and every opt-out in the summary, quoted, each with whether the plan allows it.

## Deviations, each judged

1. <the builder's deviation>: accepted, ruled, or sent back, with the reason.

## Rulings made

Each ruling, where it was written into the plan, and that the owner may overturn it.

## Findings

Labelled F1, F2, ... Each with the step that failed, the plants it covers, and the change that would close it. For an accepted session: findings carried forward, and to which session.

## Open

For the owner; for the plan.

## Looks and time (REVIEW.md only)

| Look | Tip | Who | Result |
|---|---|---|---|
| 1 | | reviewer, clean clone / conductor | |

The elapsed time from made-ready to accept, and where it went: building, the conductor's runs, reviews, idle.
