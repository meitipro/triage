# Evidence

Written by `python submission/evidence.py` from the records in this repository. Every transaction below was looked up on the Studio Next RPC when this file was written, and its outcome read with the same test the site uses (accepted and returned, or refused).

## The contract

- Contract: [0x17c378994ebdF51ca536A8020dC04129F3612373](https://explorer-studio-dev.genlayer.com/address/0x17c378994ebdF51ca536A8020dC04129F3612373)
- Source sha256 `f8c584dafec7e28705cea169628d3ccaa669d1dd93b8a57ea5dbfd7aff7c4022`; `python scripts/verify.py` reads the deployed bytes back identical.

| What | Outcome | Transaction |
|---|---|---|
| deploy | returned | [0x06428261…867c](https://explorer-studio-dev.genlayer.com/tx/0x064282617397b677a23a70a5590dd54410689fa3d4601a5c8a5380aaf4e8867c) |

## Golden cases, through real consensus

Program 1. Full table with reasons: https://triage-genlayer.vercel.app/docs/more/evaluation

| What | Outcome | Transaction |
|---|---|---|
| open the golden program | returned | [0x94fae3c2…0ee3](https://explorer-studio-dev.genlayer.com/tx/0x94fae3c206d7156e692ed147c4ea4c6cb8eed4ca5765e771446c3de2098a0ee3) |
| seed S1: judge #1 → ACTIONABLE | returned | [0x414ce163…0f7e](https://explorer-studio-dev.genlayer.com/tx/0x414ce1638042f7278abb234c71ed12aa783348c75e073b3e6304f85965e70f7e) |
| seed S2: judge #2 → ACTIONABLE | returned | [0xe52560e6…6054](https://explorer-studio-dev.genlayer.com/tx/0xe52560e6688b99853eaba5c01494fdb7d7f2fd96142b6fd0996f326d730e6054) |
| seed S3: judge #3 → ACTIONABLE | returned | [0x9f9c2bda…eafa](https://explorer-studio-dev.genlayer.com/tx/0x9f9c2bdab87913fd6653d1133a9f7aec25640e1022ef55d9c4f94a71b8e0eafa) |
| case 1: judge #4 → LOW_EFFORT | returned | [0xf1cae115…8faf](https://explorer-studio-dev.genlayer.com/tx/0xf1cae115218970718db1d4f1cea7b60047414047a3d70e495e96118054348faf) |
| case 2: judge #5 → ACTIONABLE | returned | [0x3837262a…0fca](https://explorer-studio-dev.genlayer.com/tx/0x3837262a8f05643529fb39278fe9164e90f2bb3dccb24445713b6b48144a0fca) |
| case 3: judge #6 → DUPLICATE of #1 | returned | [0x914d3364…c84a](https://explorer-studio-dev.genlayer.com/tx/0x914d33645f584b01a60651d421efc05af776805bcdd9745d8ca7d8d5d6d9c84a) |
| case 4: judge #7 → OUT_OF_SCOPE | returned | [0xe48a7dc8…e636](https://explorer-studio-dev.genlayer.com/tx/0xe48a7dc8db2a1985e3bc4759889fe66674763f4973b60a291bef48b3d121e636) |
| case 5: judge #8 → ACTIONABLE | returned | [0xa3ab0e60…d104](https://explorer-studio-dev.genlayer.com/tx/0xa3ab0e603a697fa875db10bd89526ac0488b7dae6ba7b5d88e77ec6bbd1ed104) |
| case 6: judge #9 → LOW_EFFORT | returned | [0x30378563…fa21](https://explorer-studio-dev.genlayer.com/tx/0x30378563cd3da35e9e0b24d68439f926da901943d598667fd8b083aff6d2fa21) |
| case 7: judge #10 → ACTIONABLE | returned | [0x6b14802c…0af2](https://explorer-studio-dev.genlayer.com/tx/0x6b14802cf9b44fd47d9c754928a7f45bc4b817699d490cc70f0dcdd134900af2) |
| case 8: judge #11 → OUT_OF_SCOPE | returned | [0x9ece5b2b…5489](https://explorer-studio-dev.genlayer.com/tx/0x9ece5b2b17a7cc760edf797304ff3a1180bbf02db901ef1f0ca04a72c9685489) |
| case 9: judge #12 → LOW_EFFORT | returned | [0xfa0c5595…575f](https://explorer-studio-dev.genlayer.com/tx/0xfa0c5595395f02e7c4fe03490c0594d89fe0cff2577fb7a1e685eb143031575f) |
| case H1: judge #13 → ACTIONABLE | returned | [0x54adaca3…1158](https://explorer-studio-dev.genlayer.com/tx/0x54adaca3b0432824daf308cb204b27f72b89b9fd57bb86afdeffd251058e1158) |
| case H2: judge #14 → DUPLICATE of #2 | returned | [0x5241ebc5…5a0e](https://explorer-studio-dev.genlayer.com/tx/0x5241ebc5397d27a6e0e86f231aa8015853e0f13a1c06bc424393c8d07c755a0e) |
| case H3: judge #15 → ACTIONABLE | returned | [0x89efdc73…7a99](https://explorer-studio-dev.genlayer.com/tx/0x89efdc736cb13d65de3372b96a43a06adb4ef777d93bcbb96a8d0c8594bf7a99) |

## The seeded program (https://triage-genlayer.vercel.app/p/2)

| What | Outcome | Transaction |
|---|---|---|
| open the program, 200 GEN | returned | [0x91c97c0c…37eb](https://explorer-studio-dev.genlayer.com/tx/0x91c97c0c48cea1ec1c9ef5ba913a19f505ba322bd909906812840f64b39437eb) |
| file #16 | returned | [0x2b8d9459…98ba](https://explorer-studio-dev.genlayer.com/tx/0x2b8d9459c8f79cb2d38215ed49279f1f725d748e19894d3ed6f3ead8f51b98ba) |
| judge #16 → ACTIONABLE | returned | [0x8b60ae25…50eb](https://explorer-studio-dev.genlayer.com/tx/0x8b60ae250e9d8e57c6b465b3ad7cb7d54da96bcf51d7da577b321da5e59150eb) |
| file #17 | returned | [0x9c6a75b5…51e3](https://explorer-studio-dev.genlayer.com/tx/0x9c6a75b5853be911885a8ef6b262db98fa3cd24c5282f94d2c25dd327ab951e3) |
| judge #17 → ACTIONABLE | returned | [0x796ec4f8…aa88](https://explorer-studio-dev.genlayer.com/tx/0x796ec4f8bab96caee9f2246706d9bbbb59d8e9008177de5ed5c834faa577aa88) |
| file #18 | returned | [0x8f5ac761…9ac6](https://explorer-studio-dev.genlayer.com/tx/0x8f5ac7617b951cd87ce5f11da9a215e5c28ba1d7b85f55b9d65e817dfb659ac6) |
| judge #18 → DUPLICATE of #16 | returned | [0x42f200ac…384b](https://explorer-studio-dev.genlayer.com/tx/0x42f200acba228e1bf1eba81fe48cf18771b0f85028daaa3123497874a0d5384b) |
| file #19 | returned | [0x4e3cdf6d…a14c](https://explorer-studio-dev.genlayer.com/tx/0x4e3cdf6db8b9b62f45450c38109c3bb9bb6de11d7fb8033f50ac2fb08454a14c) |
| judge #19 → OUT_OF_SCOPE | returned | [0xa1586315…9ec2](https://explorer-studio-dev.genlayer.com/tx/0xa1586315f9546b26d03c85123a6ecc8f87984123fb60f642281cd45de5379ec2) |
| file #20 | returned | [0xe4954c31…8434](https://explorer-studio-dev.genlayer.com/tx/0xe4954c31f7e116315383b4fb1befe9bc794e610b98c50a00f11ece87952a8434) |
| judge #20 → LOW_EFFORT | returned | [0xf073e959…cf5d](https://explorer-studio-dev.genlayer.com/tx/0xf073e9597f8452056d7d91ae0c1c4334e279ecdf99030ccbbb7feda77967cf5d) |
| file #21 | returned | [0xbb1ab808…0fd4](https://explorer-studio-dev.genlayer.com/tx/0xbb1ab808ff0080f582a9ae88a7cf516f7cc739a10f4c8b3b12584e0d84120fd4) |
| judge #21 → ACTIONABLE | returned | [0x308ec009…f8ce](https://explorer-studio-dev.genlayer.com/tx/0x308ec00927d13e9a1057f515214ea547f14758ef4ce5f13be725f4389328f8ce) |
| bonus of 5 GEN on #21 | returned | [0xd387b7b5…388a](https://explorer-studio-dev.genlayer.com/tx/0xd387b7b588693cfb24d7db963af0af7e0bade43d7305742e44e57ab0662e388a) |
| withdraw 23 GEN | returned | [0x3e4b4bf4…0180](https://explorer-studio-dev.genlayer.com/tx/0x3e4b4bf4ce7b1f66b785286a46820c5f2f4859d04c7a05ca26c923aef89c0180) |

## Reviewer path rp1, from fresh accounts through the site's own signing code

Program 3. Every step: `docs/reviewer-path.studio-next.json`.

| What | Outcome | Transaction |
|---|---|---|
| open | returned | [0x7e9e1b25…6dc4](https://explorer-studio-dev.genlayer.com/tx/0x7e9e1b25269964508c5b99271b6b83a08b484a29ac13520eda09027dea5b6dc4) |
| submit-wrong-stake: send exactly the stake: 1000000000000000000 wei | refused | [0xa2caa8c1…8552](https://explorer-studio-dev.genlayer.com/tx/0xa2caa8c153e8824a1d0310330ab639d9332e9be0fdb6011c2ff8a92c42c08552) |
| submit-by-team: the team cannot file reports in its own program | refused | [0x35b9e21a…d122](https://explorer-studio-dev.genlayer.com/tx/0x35b9e21a351e69a33c6da62d48e76593b657c5eabdae2dfbdd1ca3152a15d122) |
| submit-a | returned | [0x54b3af32…d519](https://explorer-studio-dev.genlayer.com/tx/0x54b3af32a939d18b8cf2ae73cc5277bc1167a5876ea7de13ecd9d5ea50a7d519) |
| submit-b | returned | [0xdb274564…26ff](https://explorer-studio-dev.genlayer.com/tx/0xdb274564a36cc4260835e45e0ddc0cf89e3499adfba96039d840fe4c531e26ff) |
| judge-b-first: report 22 was filed earlier in this program and is judged first | refused | [0xa72870b3…e7a4](https://explorer-studio-dev.genlayer.com/tx/0xa72870b3f493b86be4e9fc1c2805d8e9a56112bc269670a2e92369a41171e7a4) |
| judge-a | returned | [0x3c353b26…4971](https://explorer-studio-dev.genlayer.com/tx/0x3c353b26a9d896edf62de8f8e27ef6723120592142a12de696afb57a6fe04971) |
| judge-b | returned | [0x49e4bb28…f3bf](https://explorer-studio-dev.genlayer.com/tx/0x49e4bb2848d37b505ff6fdffe1f2ba9154a763411e3ddd7c09d075a65ab9f3bf) |
| bonus-by-tester: only the program's team may tip a bonus | refused | [0x11583e29…14aa](https://explorer-studio-dev.genlayer.com/tx/0x11583e29620fa31ffbd3e4f435a045c3228b4253fd10e7b9609cf0179b9e14aa) |
| bonus | returned | [0x3e6ec62c…5574](https://explorer-studio-dev.genlayer.com/tx/0x3e6ec62cd3655852a7f37d5de4a27bd211a63a127295a6a693b6311973ad5574) |
| close-early: this program runs until 1791588357 (seconds since the epoch) | refused | [0xd69ce42f…73f6](https://explorer-studio-dev.genlayer.com/tx/0xd69ce42fe42abe52668ec4100211f3e228f84a22657cc7e1fea91423f3a173f6) |
| withdraw | returned | [0x203da2fa…f896](https://explorer-studio-dev.genlayer.com/tx/0x203da2fa139b146516c626bbdea11f0b7095357dd3f7586a343012d344e9f896) |
| withdraw-again: nothing to withdraw | refused | [0x194a5b42…92fa](https://explorer-studio-dev.genlayer.com/tx/0x194a5b427d3e3bd1b9c049897a3e98ec841ca0a29e0f74f797b6bf7ff4b292fa) |

Wallets after finality, from each transaction's own fee accounting:

- withdraw: paid 5.0 GEN, wallet 17.99952743449998 → 22.99940112949998 GEN, difference from expected 25000000000000 wei

## Live UI walk, through the deployed site's buttons

Wallet `0x52836a71f5e2bc8A2A0F8f14ff640525f9A34254`, made inside the page. Balance after finality 27999714896499991531 wei, expected 27999714896499991531 wei. Details: `docs/ui-walk.studio-next.md`.

| What | Outcome | Transaction |
|---|---|---|
| submit #24 from the File a report form | returned | [0xe5a10af4…89b4](https://explorer-studio-dev.genlayer.com/tx/0xe5a10af48bbea9a56bb0f2a7d5d15a70020ed95bb482009ce0c7716bfc0289b4) |
| judge #24 from Ask the validators | returned | [0x238482fc…0257](https://explorer-studio-dev.genlayer.com/tx/0x238482fcb2f7a8e553c524c100ecbd6da59b85daa1ab7e75b35c6edf3add0257) |
| withdraw 9 GEN from My reports | returned | [0xf1a5262e…7fa2](https://explorer-studio-dev.genlayer.com/tx/0xf1a5262e0063165d4b69e52f8cd1970b038abc4c50a769a5e3646fda7f5d7fa2) |

## The docs sample, run as written (`web/examples/file-a-report.mjs`)

| What | Outcome | Transaction |
|---|---|---|
| submit #25 from the docs sample | returned | [0x797aef39…f13d](https://explorer-studio-dev.genlayer.com/tx/0x797aef394e47f21cadeb7b293a1a700f989f3382586d9a5a2e8325cb0727f13d) |
| judge #25 from the docs sample | returned | [0xb44bbe00…8de8](https://explorer-studio-dev.genlayer.com/tx/0xb44bbe0038d8051b6b6deec0793980ec248c88184818b6eb13739c0dd9b88de8) |

50 transactions checked.
