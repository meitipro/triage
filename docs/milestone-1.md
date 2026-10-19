# Milestone 1: the queue reaches the tracker, the record reaches the campaign

Built on the accepted state of 2026-10-14 (commit `a64cbd8`). The contract is unchanged and still frozen at
`0x17c378994ebdF51ca536A8020dC04129F3612373`; everything below reads it.

## What changed

### 1. Queue → GitHub Issues sync (new integration)

A reusable GitHub Action, `.github/actions/triage-sync`, that any team adds with one workflow file:

```yaml
- uses: meitipro/triage/.github/actions/triage-sync@main
  with:
    program: "2"
```

- Reads the program's queue straight from the contract with genlayer-js (`list_reports(program, "ACTIONABLE", …)`),
  not from the site, so it keeps working when the site is down.
- One issue per actionable report: the tester's text quoted, the validators' summary, what the tester was paid, and
  links to the report page, the filing and judging transactions and the contract. Labels by kind.
- Idempotent: a hidden marker names the contract and the report, so a run never duplicates an issue, never touches an
  issue it did not open, updates the text when a bonus is tipped, and never reopens an issue the team closed.
- Tester text cannot ping people, close issues by keyword, forge another report's marker or leave its quote.
- Uses the workflow's own `GITHUB_TOKEN`; no key on any server.
- The rules are pure functions in `lib.mjs`, covered by 11 `node:test` cases in `lib.test.mjs`, run by the workflow.

### 2. Tester leaderboard for campaigns (spec stretch goal)

- `/testers`: every tester ranked by accepted reports, then acceptance rate, then fewer low-effort reports, then the
  earlier first acceptance; per program or across all (evaluation set aside).
- `/api/testers?program=<id>&format=csv`: the ranking as CSV for a campaign's reward or points sheet.
- Rates in integer basis points, amounts in wei; no floats. `web/lib/leaderboard.mjs`, 8 `node:test` cases.

### 3. Docs

Two new reference pages, [Sync the queue to GitHub Issues](https://triage-genlayer.vercel.app/docs/reference/github-issues-sync)
and [Tester leaderboard for campaigns](https://triage-genlayer.vercel.app/docs/reference/tester-leaderboard), and a
changelog entry.

## Proof, on live infrastructure

Triage runs the sync on its own repository for program 2 ("Triage site and docs, public beta").

| Run | What it did | Link |
|---|---|---|
| First run | Opened issues #1 to #5 for the 5 actionable reports on chain (#16, #17, #21, #24, #25) | https://github.com/meitipro/triage/actions/runs/39218285858 |
| Team closes them | Each closed as completed, naming the commit that fixed it, `abea78a8d8951d731d5d59c8715b08c6386e67b4` | https://github.com/meitipro/triage/issues?q=label%3Atriage |
| Second run | "Created 0, updated 0, unchanged 5"; the closed issues stayed closed | https://github.com/meitipro/triage/actions/runs/39218403830 |
| A new report on chain | Report #26 filed and judged ACTIONABLE through the docs sample: [submit](https://explorer-studio-dev.genlayer.com/tx/0xc69663d19216c212294ce6516988862f456763d926a6aff8ec03290bdfdd17cc), [judge](https://explorer-studio-dev.genlayer.com/tx/0x1223073b62f89bf7caf04cd5408abc76d4f6bd240b26d23cedd0cee23488ce7d) | https://triage-genlayer.vercel.app/r/26 |
| Third run | "Created 1, updated 0, unchanged 5": issue #6 for report #26 | https://github.com/meitipro/triage/actions/runs/39218560055 |

The leaderboard in production, read from the chain: https://triage-genlayer.vercel.app/testers and
https://triage-genlayer.vercel.app/api/testers?program=2&format=csv. Its first row matches the contract: tester
`0xdc1387d36C6a12309bc9B6150B007040130dbE38` has 2 actionable reports and earned 21 GEN (two 8 GEN rewards and the
5 GEN bonus on report #21).

## Tests

- `node --test .github/actions/triage-sync/lib.test.mjs web/lib/leaderboard.test.mjs`: 19 passing, also run by the
  workflow's `test` job on every sync.
- `pytest tests`: 134 passing (contract unchanged).

## Note on the build

Local `next build` on the build machine is blocked by a Windows Application Control policy on a native module of the
docs toolchain; the site was type-checked locally and built on Vercel (a preview from the `milestone-1` branch, checked,
then merged to `main`).
