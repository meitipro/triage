# Progress

One line per step, in order.

- 2026-10-09 Read the spec and the rules artifact; Studio Next (chain 61997), as the spec names it.
- 2026-10-09 Contract `contracts/triage.py`, exactly the 11 methods of section 4; lint clean; the live runtime accepts it (`gen_getContractSchemaForCode`).
- 2026-10-09 Offline suite: 130 passing. Mutation testing found two missing tests (a bool as a whole number, an unknown label defaulting); both added, then 85 of 85 caught (`docs/MUTATIONS.md`).
- 2026-10-09 Deployed `0x17c378994ebdF51ca536A8020dC04129F3612373`; `scripts/verify.py` reads back identical bytes, deployed lint clean.
- 2026-10-09 Golden set locked (sha256 1846906e…), then run on chain: 9 of 9, each on its first judge. Held-out H1 to H3 once: ACTIONABLE, DUPLICATE of #2, ACTIONABLE (`eval/results.md`).
- 2026-10-09 Site and /docs (Fumadocs, 15 pages, contract reference, errors, prompt, evaluation and limits generated from the source); production build clean; every page fits 375 px.
- 2026-10-09 Seeded program 2 on chain (6 reports: 3 actionable, 1 duplicate, 1 out of scope, 1 low effort; a bonus; a withdraw). Repo meitipro/triage public; site on Vercel.
- 2026-10-09 Live UI walk with an in-page wallet filed #24 and withdrew; wallet exact to the wei (`docs/ui-walk.studio-next.md`). Its report and the others in the queue were fixed in the next deploy; the docs sample was run as written and filed #25.
- 2026-10-09 Reviewer path rp1 from fresh accounts to close; both wallets reconcile from zero to 0 wei (`docs/reviewer-path.rp1.reconcile.json`). The script's own two balance checks missed by the 25e12 message-fee term and are recorded as such.
- 2026-10-14 Vercel project root directory set to `web`, so pushes to main build. `submission/evidence.md` generated from the records, 52 transactions each looked up on the RPC.
