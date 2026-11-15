# Handback: session <id>

<!--
One page. Write this file first, with a line UNFINISHED above the Tip heading and your task list marked
not done; update it at every commit; remove the UNFINISHED line only at the end. A turn that ends while it
is there is read as unfinished, and the next one starts from this list; unless Questions starts with
`blocked`, which is a question for the conductor and is read as one.

The generated parts (acceptance tests, requirement to tests, mutations, opt-outs) are not typed here: the
phase command's handback mode writes them into handback-generated.md beside this file.
-->

## Tip

The full commit id the reviewer checks out.

## Results

The phase command's result line, copied from the tool's output, never typed. The `--patch` result of every mutation patch you changed or moved.

## What was built

Five lines at most, in terms of behaviour. For a spike: each note's path and each question's answer word.

## Deviations and rulings used

Each ruling of your block you relied on, by its label. Anything you did differently from the block, and why. Any change to an earlier test, a fixture, the harness or a tool, with its reason. Anything left not done. Anything only the owner can do, with the exact command. For a findings round: a "Review N" entry with each finding and its commits.

## Questions

`None.` if none. Otherwise write `blocked` on the first line, then each question with the two readings and what each would change, and end your turn. A question is not a failure.

## Least sure of

What a reviewer should try first: the tests or behaviours you trust least, and for each line you say cannot be tested, the smallest setup you tried.
