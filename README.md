# Triage

**Feedback programs that pay for signal, not noise.**

A feedback and bug report program on GenLayer. A team funds a program and writes its scope, testers stake a little on
each report, validators read every report against the scope and the reports already accepted, and only specific, new,
in-scope reports are paid, while low-effort farming loses its stake.

- **Site:** https://triage-genlayer.vercel.app (docs at [/docs](https://triage-genlayer.vercel.app/docs))
- **Contract:** [`0x17c378994ebdF51ca536A8020dC04129F3612373`](https://explorer-studio-dev.genlayer.com/address/0x17c378994ebdF51ca536A8020dC04129F3612373) on GenLayer Studio Next, chain 61997
- **Deploy transaction:** [`0x06428261…`](https://explorer-studio-dev.genlayer.com/tx/0x064282617397b677a23a70a5590dd54410689fa3d4601a5c8a5380aaf4e8867c), source sha256 `f8c584dafec7e28705cea169628d3ccaa669d1dd93b8a57ea5dbfd7aff7c4022` ([`contracts/FROZEN.json`](contracts/FROZEN.json))

## How it works

| Verdict | Meaning | The stake | The reward |
|---|---|---|---|
| ACTIONABLE | Specific, reproducible or clearly reasoned, in scope, and not already accepted | back to the tester | to the tester |
| DUPLICATE | The same issue as an accepted report, which it names by id | back to the tester | back to the pool |
| OUT OF SCOPE | About something the scope excludes or does not cover | back to the tester | back to the pool |
| LOW EFFORT | Vague, generic, no specifics, or a list of unconnected suggestions | to the pool | back to the pool |

1. **Program.** The team writes the scope (at most 1,200 characters, fixed for the life of the program), sets the
   reward, the stake, a weekly cap per tester and a duration, and funds the pool.
2. **Report.** A tester files a kind (bug, usability or idea), a title and the report, with exactly the stake. Filing
   reserves one reward from the pool, so a report is never judged actionable against an empty pool.
3. **Judge.** Validators read the report against the scope and the last 25 accepted reports, and must agree on the
   label and, for a duplicate, on the id it repeats. The one-line summary and the reason are stored from the leader.
4. **Settle.** `judge` only moves balances. Testers are paid by `withdraw()`, the team takes back what is left with
   `close()`, and the team can tip a bonus on any actionable report.
5. **Queue.** Actionable reports form the team's queue, exportable as JSON or CSV.

## Milestone 1: the queue reaches the tracker

- **GitHub Issues sync.** A reusable GitHub Action (`.github/actions/triage-sync`) opens one issue per actionable report,
  read straight from the contract; idempotent, never reopens an issue the team closed. Triage runs it on this repository
  for program 2: [issues](https://github.com/meitipro/triage/issues?q=label%3Atriage).
- **Tester leaderboard.** [/testers](https://triage-genlayer.vercel.app/testers) ranks testers by accepted reports and
  acceptance rate, with a CSV for campaign rewards.

Record and links: [`docs/milestone-1.md`](docs/milestone-1.md).

## Evaluation, through real consensus

The golden cases of section 9 of the spec were written and locked (sha256 `1846906e…`, 2026-10-09T17:24:18Z, before
the first run), then run on the deployed contract: three seed reports to build the accepted list, then each case filed
by a tester with the real stake and judged by one `judge` transaction.

- **Golden set: 9 of 9** matched, every one on its first judge. Low effort (a one-liner, ten generic suggestions, an
  instruction to the judge), actionable (a bug, an idea, a bug in Spanish), a reworded duplicate named by its id, and
  two out-of-scope reports.
- **Held-out cases, run once with no expected answer:** H1 (a bug with steps but no expected result) came back
  ACTIONABLE; H2 (partly overlapping accepted report #2) came back DUPLICATE of #2; H3 (a concrete idea with a weak
  reason) came back ACTIONABLE.

Every verdict, reason and transaction: [`eval/results.md`](eval/results.md), and on the site at
[/docs/more/evaluation](https://triage-genlayer.vercel.app/docs/more/evaluation). Nothing was tuned; the prompt is the
spec's, word for word.

## Two choices beyond the spec

- **Reports are judged in filing order.** Without it, a farmer could copy a report the moment it was filed, ask the
  validators to judge the copy first, and take the reward while the original came back DUPLICATE. `judge` refuses a
  report while an earlier one in the same program is still waiting, and anyone may judge the next one.
- **`days = 0` opens a one-hour trial program**, so the whole loop, close included, can be walked in one sitting.

Both are in the docs where they apply. The contract has exactly the eleven methods of section 4.

## The contract and its tests

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # genlayer-py 0.19.0rc2, genvm-linter 0.11.1rc2
.venv/Scripts/python -m pytest tests -q           # 134 tests, offline, in seconds
.venv/Scripts/python scripts/mutate.py            # break each defence, name the test that catches it
.venv/Scripts/python scripts/verify.py            # read the deployed source back, compare, lint the deployed bytes
```

- `tests/test_direct.py` runs the real contract file against a GenVM double in which the leader and each validator
  read their own model answers, addresses compare as bytes, storage copies on store and is unreachable from inside the
  consensus block. It covers every method and every rule of section 2, and a property test checks over random runs that
  the contract always holds exactly the pools, reserves, filed stakes and balances it owes, and pays out exactly what
  came in.
- `tests/test_static.py` checks the parsed source: exactly the eleven methods, every write classified by who may call
  it, every prompt value fenced or owned by the contract, the prompt word for word, money leaving only through
  `withdraw` and `close`, and the GenVM storage rules.
- **Mutation testing: 85 of 85 defences caught** ([`docs/MUTATIONS.md`](docs/MUTATIONS.md)). The first run found two
  escapes, a bool accepted as a whole number and an unknown label nobody had tested as a default; both tests were added
  before deploy.

## Layout

```
contracts/triage.py         one contract, the judge prompt pinned inside; FROZEN.json records the deployment
tests/                      direct tests against a per-node GenVM double, and static tests over the source
eval/                       golden.json (locked), run_golden.py, results.json and results.md
scripts/                    chain.py, deploy.py, verify.py, mutate.py, seed.py, gen_docs.py
web/                        Next.js site and Fumadocs docs; reads on the server, writes signed in the visitor's wallet
web/scripts/                send-as.mjs (the site's own signing code with a stand-in wallet) and the reviewer-path walk
docs/                       logs and records of every on-chain run
submission/                 portal text, X post, silent demo script, 512 px icon
```

## Honest limits

Triage decides whether a report is worth acting on, not how important it is; that stays with the team, through bonuses.
Its duplicate check covers the last 25 accepted reports, not the whole history, so an old duplicate can be paid. Reports
are public, so it is for product feedback, not for security vulnerabilities. There is no appeal on a verdict.

## Network

GenLayer Studio Next only: chain 61997, RPC `https://studio-next.genlayer.com/api`, explorer
`https://explorer-studio-dev.genlayer.com`, runtime `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.
No private key exists on any server or in this repository; test accounts live in `~/.triage/accounts.json` on the
machine that ran the scripts.
