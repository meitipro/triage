# Milestone 1, portal entry

## Title

<!-- title -->
Queue to GitHub Issues sync and tester leaderboard
<!-- end -->

## Changes & Improvements

<!-- changes -->
Two additions, contract unchanged and frozen.

1. GitHub Issues sync: a reusable GitHub Action (.github/actions/triage-sync) any team adds with one workflow file. It reads a program's queue straight from the contract and opens one issue per ACTIONABLE report, with the tester's text, the validators' summary, what was paid and links to the report, filing and judging txs. Idempotent via a hidden marker; updates on a bonus; never reopens an issue the team closed; tester text cannot ping people or forge another report. Runs on Triage's own repo: 5 issues opened, closed with the fix commit, a rerun changed nothing, and new report #26 became issue #6.

2. Tester leaderboard (spec stretch goal): /testers ranks testers by accepted reports and acceptance rate, with a CSV for campaign rewards.

Plus docs pages and 19 new node:test cases, run in the workflow.
<!-- end -->

## Evidence

- https://github.com/meitipro/triage/issues?q=label%3Atriage
- https://github.com/meitipro/triage/actions/runs/39218560055
- https://triage-genlayer.vercel.app/testers
- https://github.com/meitipro/triage/blob/main/docs/milestone-1.md
