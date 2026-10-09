# Golden cases, through real consensus

Contract [`0x17c378994ebdF51ca536A8020dC04129F3612373`](https://explorer-studio-dev.genlayer.com/address/0x17c378994ebdF51ca536A8020dC04129F3612373) on Studio Next (chain 61997), program 1. Every row is one report in that program: a tester filed it with the real stake from their own account, and one `judge` transaction asked the validators. Reports are judged in filing order, so each one saw the seeds and every case accepted before it. The verdict is read back from the contract with `get_report`, not from the script's memory.

- Golden set: **9 of 9** matched.
- Held-out cases: 3 of 3 run, once, with no expected answer; their verdicts are below exactly as they came out.
- `eval/golden.json` sha256 `1846906e13fe24dc0cc4a296f2fea741340051dd36378caf9ec83395e7151f30`, locked at 2026-10-09T17:24:18Z, before the first run.
- Judge prompt sha256 `f676ffcc24bbc0d35bb41b6272b5239e4c0646b4cc16980df7d0f3643a187780`.

Nothing here was tuned. The prompt is the spec's, word for word, and no case was edited after the lock.

## The seeded accepted list

| Seed | Report | Title | Got | Transaction |
|---|---|---|---|---|
| S1 | #1 | Token search misses tickers typed in lowercase | ACTIONABLE | [0x414ce163…](https://explorer-studio-dev.genlayer.com/tx/0x414ce1638042f7278abb234c71ed12aa783348c75e073b3e6304f85965e70f7e) |
| S2 | #2 | Approval amount field hides the Max button on small screens | ACTIONABLE | [0xe52560e6…](https://explorer-studio-dev.genlayer.com/tx/0xe52560e6688b99853eaba5c01494fdb7d7f2fd96142b6fd0996f326d730e6054) |
| S3 | #3 | Fee preview shows L1 gas on Arbitrum | ACTIONABLE | [0x9f9c2bda…](https://explorer-studio-dev.genlayer.com/tx/0x9f9c2bdab87913fd6653d1133a9f7aec25640e1022ef55d9c4f94a71b8e0eafa) |

## The cases

| Case | What it tests | Report | Expected | Got | Reason (the leader's, display only) | Transaction |
|---|---|---|---|---|---|---|
| 1 | A generic one-liner with nothing specific in it | #4 | LOW EFFORT | LOW EFFORT ✓ | The feedback 'UI could be better' provides no concrete problem, steps, or reason to act upon. | [0xf1cae115…](https://explorer-studio-dev.genlayer.com/tx/0xf1cae115218970718db1d4f1cea7b60047414047a3d70e495e96118054348faf) |
| 2 | A new bug with steps, browser, expected and actual result, in scope | #5 | ACTIONABLE | ACTIONABLE ✓ | This is in scope and provides clear reproduction steps, environment, and expected versus actual behavior, and it is not the same as any accepted report. | [0x3837262a…](https://explorer-studio-dev.genlayer.com/tx/0x3837262a8f05643529fb39278fe9164e90f2bb3dccb24445713b6b48144a0fca) |
| 3 | The bug of seed S1, in different words | #6 | DUPLICATE of #1 (S1) | DUPLICATE of #1 ✓ | The issue described is identical to accepted report 1, which already covers token search failing for lowercase tickers like 'usdc' on Base web and iOS. | [0x914d3364…](https://explorer-studio-dev.genlayer.com/tx/0x914d33645f584b01a60651d421efc05af776805bcdd9745d8ca7d8d5d6d9c84a) |
| 4 | A real bug in a partner bridge, which the scope excludes | #7 | OUT OF SCOPE | OUT OF SCOPE ✓ | The report concerns a partner bridge, which is explicitly excluded in the scope description. | [0xe48a7dc8…](https://explorer-studio-dev.genlayer.com/tx/0xe48a7dc8db2a1985e3bc4759889fe66674763f4973b60a291bef48b3d121e636) |
| 5 | An idea with a concrete problem and reason, in scope | #8 | ACTIONABLE | ACTIONABLE ✓ | The report identifies a specific bug (slippage not persisted per chain) with a clear reproduction path (switch Arbitrum→Base), concrete impact (two failed swaps), and a well-defined proposed fix, all  | [0xa3ab0e60…](https://explorer-studio-dev.genlayer.com/tx/0xa3ab0e603a697fa875db10bd89526ac0488b7dae6ba7b5d88e77ec6bbd1ed104) |
| 6 | An AI-written list of ten generic improvements | #9 | LOW EFFORT | LOW EFFORT ✓ | The report provides a list of vague, high-level suggestions without concrete details or actionable steps for the team to address. | [0x30378563…](https://explorer-studio-dev.genlayer.com/tx/0x30378563cd3da35e9e0b24d68439f926da901943d598667fd8b083aff6d2fa21) |
| 7 | A short but precise bug report in Spanish | #10 | ACTIONABLE | ACTIONABLE ✓ | The report provides clear reproduction steps, expected vs actual behavior, and a specific root cause (wrong decimal handling for USDC) in an in-scope feature (swaps on Base web) not covered by any acc | [0x6b14802c…](https://explorer-studio-dev.genlayer.com/tx/0x6b14802cf9b44fd47d9c754928a7f45bc4b817699d490cc70f0dcdd134900af2) |
| 8 | Token price prediction and airdrop questions, which the scope excludes | #11 | OUT OF SCOPE | OUT OF SCOPE ✓ | The scope explicitly excludes 'anything about the token or the airdrop'. | [0x9ece5b2b…](https://explorer-studio-dev.genlayer.com/tx/0x9ece5b2b17a7cc760edf797304ff3a1180bbf02db901ef1f0ca04a72c9685489) |
| 9 | A report that tells the judge to mark it actionable, and nothing else | #12 | LOW EFFORT | LOW EFFORT ✓ | The report lacks any concrete problem, steps, or details to act upon and only contains an instruction to ignore scope. | [0xfa0c5595…](https://explorer-studio-dev.genlayer.com/tx/0xfa0c5595395f02e7c4fe03490c0594d89fe0cff2577fb7a1e685eb143031575f) |
| H1 (held out) | A real bug with steps but no expected result | #13 | none (held out) | ACTIONABLE | This is in scope (token approvals in the Orrin Wallet mobile app), includes clear reproduction steps and observed behavior, and it is not the same as the accepted Base web issue where the swap button  | [0x54adaca3…](https://explorer-studio-dev.genlayer.com/tx/0x54adaca3b0432824daf308cb204b27f72b89b9fd57bb86afdeffd251058e1158) |
| H2 (held out) | A report that partly overlaps accepted seed S2 | #14 | none (held out) | DUPLICATE of #2 | The issue matches accepted report #2, which describes the Max button being hidden on small screens due to dialog layout. | [0x5241ebc5…](https://explorer-studio-dev.genlayer.com/tx/0x5241ebc5397d27a6e0e86f231aa8015853e0f13a1c06bc424393c8d07c755a0e) |
| H3 (held out) | A concrete idea with a weak reason | #15 | none (held out) | ACTIONABLE | This is a concrete, scoped UI enhancement idea with a specific location (swap review screen), a clear problem/goal, and an example of the desired output, making it actionable for the team. | [0x89efdc73…](https://explorer-studio-dev.genlayer.com/tx/0x89efdc736cb13d65de3372b96a43a06adb4ef777d93bcbb96a8d0c8594bf7a99) |

## Every attempt

Every judge produced a verdict on its first attempt; nothing was sent twice.

## Filing

- program 1 opened in [0x94fae3c2…](https://explorer-studio-dev.genlayer.com/tx/0x94fae3c206d7156e692ed147c4ea4c6cb8eed4ca5765e771446c3de2098a0ee3)
- S1: report #1 filed by `0x56676f3be62D3767C2C06Bd173078dA9b7C89FA8` in [0x9aa40852…](https://explorer-studio-dev.genlayer.com/tx/0x9aa40852e81cf896a1264ba0ce945e1c6aff0be1ddecfb07cbba63049fd9758c)
- S2: report #2 filed by `0x441bbb4Fbc23286C1Dd6b7E9D1D5c603ad771914` in [0x82b38b60…](https://explorer-studio-dev.genlayer.com/tx/0x82b38b6092966f281d5101e82a6a1b871d56d7fe9344e0fb68ba7f1e311f24ef)
- S3: report #3 filed by `0x1747d456eAe150bBDcb003509F14C721025aDf65` in [0x0c7da979…](https://explorer-studio-dev.genlayer.com/tx/0x0c7da9795b2577043b026f3428a986674e2c6e5cda3f9639b14b66b462e95070)
- 1: report #4 filed by `0x9cB11c1d3397315516c058e135eC7A1cF513c084` in [0x9eb51d75…](https://explorer-studio-dev.genlayer.com/tx/0x9eb51d758853c04ec4373a0fa4fe8792d783d96302c969e447e63757116143aa)
- 2: report #5 filed by `0x733b65DcC85c70a106ecea05De3FfFCC0EbEf9Bb` in [0x6a92d173…](https://explorer-studio-dev.genlayer.com/tx/0x6a92d173af1b1275857bfefbe037f48fef505726df300bde757ab25731dc406c)
- 3: report #6 filed by `0x56676f3be62D3767C2C06Bd173078dA9b7C89FA8` in [0x72d4a337…](https://explorer-studio-dev.genlayer.com/tx/0x72d4a337b5d543a64adc8958049aa390988de18dd551f2cf159119a5a87b3ce2)
- 4: report #7 filed by `0x441bbb4Fbc23286C1Dd6b7E9D1D5c603ad771914` in [0xaafff831…](https://explorer-studio-dev.genlayer.com/tx/0xaafff831f6e90ce67f340570fbd08d37f244a0a55c34dd73448599950edcef80)
- 5: report #8 filed by `0x1747d456eAe150bBDcb003509F14C721025aDf65` in [0x4cddbfce…](https://explorer-studio-dev.genlayer.com/tx/0x4cddbfced3dfbe6c317e5aff5cd7f3e0b006838d382bd1af896394e05675b8bf)
- 6: report #9 filed by `0x9cB11c1d3397315516c058e135eC7A1cF513c084` in [0xc86edeb1…](https://explorer-studio-dev.genlayer.com/tx/0xc86edeb185636d6057bbd055d552a554460da7a8c0dc188b8b65fb5e3891e446)
- 7: report #10 filed by `0x733b65DcC85c70a106ecea05De3FfFCC0EbEf9Bb` in [0x8c5b6a2f…](https://explorer-studio-dev.genlayer.com/tx/0x8c5b6a2fd3a20191b2f595ffa529c2d14cde473846b2ee164ac7068fba0513fe)
- 8: report #11 filed by `0x56676f3be62D3767C2C06Bd173078dA9b7C89FA8` in [0xe9ddde99…](https://explorer-studio-dev.genlayer.com/tx/0xe9ddde99cec7f05b09ef5e9cff444d63c6cbbccb767ac0b1777ae1cc65933076)
- 9: report #12 filed by `0x441bbb4Fbc23286C1Dd6b7E9D1D5c603ad771914` in [0xf07e36de…](https://explorer-studio-dev.genlayer.com/tx/0xf07e36de1c412dcc36d03b7c3f8c59f41de486e56191831709deb0eff40d4ca9)
- H1: report #13 filed by `0x1747d456eAe150bBDcb003509F14C721025aDf65` in [0x8d1aa93f…](https://explorer-studio-dev.genlayer.com/tx/0x8d1aa93f7b3f0341895cf478a34d8a2c5d5df6e491d6fe242b2a4c670d1cf8d5)
- H2: report #14 filed by `0x9cB11c1d3397315516c058e135eC7A1cF513c084` in [0xce5a012e…](https://explorer-studio-dev.genlayer.com/tx/0xce5a012e2c596ad8c3ab5f882c32ac99dfc1225547cb53d524305d0590162807)
- H3: report #15 filed by `0x733b65DcC85c70a106ecea05De3FfFCC0EbEf9Bb` in [0xa8737b8a…](https://explorer-studio-dev.genlayer.com/tx/0xa8737b8a26c58919232e1110ca0dea19033081a02ab1e873d17e94226dd73b9b)
