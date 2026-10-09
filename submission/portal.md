# Portal entry

Every field below, in the order the form asks. Counts are checked by `submission/count.py`.

## Make it recognizable

- **Logo:** `submission/triage-icon-512.png` (512 × 512, the site's own mark on a dark ground, safe for a circular crop)
- **Project name:** Triage - feedback programs that pay for signal, not noise
- **Primary tag:** Developer Tools
- **Tag 1:** Bug Bounties
- **Tag 2:** Quality Review

## One-liner

<!-- one-liner -->
Feedback programs that pay for signal: validators pay specific, new, in-scope reports, and farmed noise loses its stake.
<!-- end -->

## Description

<!-- description -->
Triage is a feedback and bug report program on GenLayer. A team funds a program and writes its scope; testers stake a little on each report. Validators read every report against the scope and the last 25 accepted reports and agree on one label: ACTIONABLE pays the stake back plus the reward, DUPLICATE (naming the report it repeats) and OUT OF SCOPE return the stake, and LOW EFFORT sends the stake to the pool that pays everyone else.

Validators compare only the label and, for a duplicate, its id. Filing reserves the reward, so a report is never judged against an empty pool. Reports are judged in filing order, so a copy is never judged before its original. Judging only moves balances; testers are paid by a separate withdraw, and the team closes to take back what is left.

Farming loses money on every report while honest mistakes cost nothing, and the team gets a clean queue it can export to its tracker.
<!-- end -->

## Show it in action

Optional video link: record `submission/demo-script.md` and paste the link here.

## Write the exact path

<!-- step 1 -->
**Fund a wallet** — Open triage-genlayer.vercel.app, select Programs in the header, open Triage site and docs, public beta, and select File a report. The box under the form walks you through Connect wallet, Switch network (adds GenLayer Studio Next, chain 61997) and Get test GEN, which funds the wallet from the site's faucet.
<!-- end -->

<!-- step 2 -->
**File a specific report** — Choose Usability. Title: My reports is not linked from the desktop header. What gets in the way: on a desktop browser the header shows Programs, Reports, For teams and Docs, but not My reports, so a tester finds their balance only through the footer. Where it happens: header, desktop width. Why it matters: withdrawing needs that page. Select File with 1 GEN stake and confirm.
<!-- end -->

<!-- step 3 -->
**Ask the validators** — The site opens your report's page, Filed, with its 8 GEN reward reserved. Select Ask the validators (it reads Judge #N first if an earlier report is waiting) and confirm. Validators are triaging shows with the transaction link; within a minute the label, summary and reason appear. If someone filed this report before you, it reads DUPLICATE with the link, and your stake comes back.
<!-- end -->

<!-- step 4 -->
**File noise and lose the stake** — Back on the program, select File a report again, choose Idea, title Make it better, and in each field write only: Improve the app. File with 1 GEN stake, then Ask the validators. It reads LOW EFFORT, struck through, and the program's Pool line counts your stake under lost stakes.
<!-- end -->

<!-- step 5 -->
**Withdraw** — On your actionable report select Withdraw from My reports (also in the footer). The page shows your verdicts, acceptance rate and balance; select Withdraw and confirm. The GEN reaches your wallet when the transaction is final.
<!-- end -->

<!-- step 6 -->
**Read the queue as a team** — Open the program's Queue tab: only actionable reports, newest first. Select Export CSV for a tracker file. To run a whole program yourself, select Open a program with Duration 0, a one-hour trial; after the hour, Close the program returns the unused pool.
<!-- end -->

## Prove the path works

<!-- proof -->
Fresh wallets on the live site via its own signing code (rp1): program 3 opened, 5 refusals shown as refusals (wrong stake, team filing, judging out of order, bonus by a tester, close before the end), #22 ACTIONABLE, #23 LOW EFFORT, bonus tipped, withdraw paid. A UI walk with an in-page wallet filed #24, judged ACTIONABLE, withdrew; the wallet reconciles to 0 wei. Golden 9/9: triage-genlayer.vercel.app/docs/more/evaluation. Every tx: github.com/meitipro/triage/blob/main/submission/evidence.md
<!-- end -->

- **Contract link:** https://explorer-studio-dev.genlayer.com/address/0x17c378994ebdF51ca536A8020dC04129F3612373

## Send people to it

- **Website:** https://triage-genlayer.vercel.app
- **GitHub:** https://github.com/meitipro/triage

## Note to stewards

<!-- steward -->
Studio Next, contract frozen; scripts/verify.py reads the deployed bytes back identical. Two choices beyond the spec: reports are judged in filing order, so a copy never beats its original, and days = 0 opens a one-hour trial so close can be walked. Step 2's report describes a real open item; a later filer gets DUPLICATE with the stake back. 134 tests, 85/85 mutants, nothing tuned. Records in docs/ and eval/.
<!-- end -->
