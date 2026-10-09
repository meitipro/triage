# Live UI walk, through the deployed site's own buttons

2026-10-09, on https://triage-genlayer.vercel.app, from a wallet made for this walk inside the page (a stand-in
EIP-1193 wallet that answers like a fresh MetaMask: no account until asked, chain 0x1 until Studio Next is added). The
key was generated in the page and never left it; only the address is recorded.

Wallet `0x52836a71f5e2bc8A2A0F8f14ff640525f9A34254`.

| Step | What the site showed | Transaction |
|---|---|---|
| Open /programs → program 2 → File a report | The wallet gate: "Step 1 of 3. Connect a wallet to file a report." | |
| Connect wallet | "Step 2 of 3. Triage runs on GenLayer Studio Next, chain 61997." | |
| Switch network | The wallet was asked to switch, answered 4902, the site added chain 61997 and switched: "Step 3 of 3. This account holds 0 GEN." | |
| Get test GEN | The site's faucet paid 20 GEN; the header read the wallet and 20 GEN; the form read "5 of 5 reports left this week" | |
| Usability, title and three guided fields, File with 1 GEN stake | "Done in 33 s.", then the report page of #24, Filed, "Your report is filed and its reward is reserved." | [0xe5a10af4…](https://explorer-studio-dev.genlayer.com/tx/0xe5a10af48bbea9a56bb0f2a7d5d15a70020ed95bb482009ce0c7716bfc0289b4) |
| Ask the validators | "Done in 16 s.", then ACTIONABLE, the leader's summary and reason, "1 GEN stake back plus the 8 GEN reward, 9 GEN into the tester's balance." | [0x238482fc…](https://explorer-studio-dev.genlayer.com/tx/0x238482fcb2f7a8e553c524c100ecbd6da59b85daa1ab7e75b35c6edf3add0257) |
| Withdraw from My reports → Withdraw 9 GEN | /me showed 1 filed, 1 actionable, 100% acceptance, balance 9 GEN; "Done in 7 s." | [0xf1a5262e…](https://explorer-studio-dev.genlayer.com/tx/0xf1a5262e0063165d4b69e52f8cd1970b038abc4c50a769a5e3646fda7f5d7fa2) |

## The wallet, to the wei

After every transaction settled, read from the chain and from each transaction's own fee accounting
(`eth_getTransactionByHash` → `data.fee_accounting`, primary fee paid minus refunded):

| | wei |
|---|---|
| From the faucet | 20,000,000,000,000,000,000 |
| Stake sent with `submit` | −1,000,000,000,000,000,000 |
| Paid by `withdraw` | +9,000,000,000,000,000,000 |
| Fees: submit 78,646,250,002,823 + judge 80,152,250,002,823 + withdraw 126,305,000,002,823 | −285,103,500,008,469 |
| **Expected** | **27,999,714,896,499,991,531** |
| **Balance on chain** | **27,999,714,896,499,991,531** |

Difference: 0 wei. The withdraw's fee accounting also lists a consumed message fee of 25,000,000,000,000 wei, which
was not taken from the wallet, as on every earlier Studio Next build.

## What the walk found

The report filed here, #24 ("My reports page names programs by number, not by name"), was judged actionable and was
fixed in the next deploy, with the other actionable reports of program 2; see the commit "Act on the queue".
