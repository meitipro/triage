# Progress

One line per step, in order.

- 2026-10-09 Read the spec and the rules artifact; Studio Next (chain 61997), as the spec names it.
- 2026-10-09 Contract `contracts/triage.py`, exactly the 11 methods of section 4; lint clean; the live runtime accepts it (`gen_getContractSchemaForCode`).
- 2026-10-09 Offline suite: 130 passing. Mutation testing found two missing tests (a bool as a whole number, an unknown label defaulting); both added, then 85 of 85 caught (`docs/MUTATIONS.md`).
- 2026-10-09 Deployed `0x17c378994ebdF51ca536A8020dC04129F3612373`; `scripts/verify.py` reads back identical bytes, deployed lint clean.
- 2026-10-09 Golden set locked (sha256 1846906e…), then run on chain: 9 of 9, each on its first judge. Held-out H1 to H3 once: ACTIONABLE, DUPLICATE of #2, ACTIONABLE (`eval/results.md`).
- 2026-10-09 Site and /docs (Fumadocs, 15 pages, contract reference, errors, prompt, evaluation and limits generated from the source); production build clean; every page fits 375 px.
