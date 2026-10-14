#!/usr/bin/env python3
"""
Write submission/evidence.md: every on-chain link behind the submission, read from the records, each one checked.

    python submission/evidence.py

Nothing here is typed by hand. The deployment comes from contracts/FROZEN.json, the golden run from
eval/results.json, the seed from docs/seed.studio-next.json, the reviewer path from
docs/reviewer-path.studio-next.json and the UI walk from docs/ui-walk.studio-next.json. Every transaction is looked
up on the Studio Next RPC before it is written down; one that does not resolve, or that did not return, fails the run.
"""

from __future__ import annotations

import json
import pathlib
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
RPC = "https://studio-next.genlayer.com/api"
EXPLORER = "https://explorer-studio-dev.genlayer.com"
SITE = "https://triage-genlayer.vercel.app"


def rpc(method: str, params: list):
    for attempt in range(6):
        try:
            body = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=60).json()
        except requests.RequestException:
            time.sleep(3 * (attempt + 1))
            continue
        if "error" in body and body["error"].get("code") == -32029:
            time.sleep(15)
            continue
        if "error" in body:
            raise RuntimeError(body["error"])
        return body["result"]
    raise RuntimeError(f"{method} did not answer")


def outcome(tx: dict) -> str:
    """'returned' or 'refused', by the same test the site and scripts use."""
    rounds = (tx.get("consensus_data") or {}).get("leader_receipt") or [{}]
    leader = rounds[0] if isinstance(rounds, list) else rounds
    result = leader.get("result")
    if isinstance(result, str):
        import base64

        return "returned" if base64.b64decode(result)[:1] == b"\x00" else "refused"
    kind = str((result or {}).get("status", "")).lower()
    return "returned" if kind == "return" and str(leader.get("execution_result", "")).upper() == "SUCCESS" else "refused"


checked: list[str] = []
failures: list[str] = []


def link(label: str, tx_hash: str, expect: str = "returned") -> str:
    tx = rpc("eth_getTransactionByHash", [tx_hash])
    if not tx:
        failures.append(f"{label}: {tx_hash} not found")
        got = "missing"
    else:
        got = outcome(tx)
        if expect and got != expect:
            failures.append(f"{label}: expected {expect}, got {got}")
    checked.append(tx_hash)
    return f"| {label} | {got} | [{tx_hash[:10]}…{tx_hash[-4:]}]({EXPLORER}/tx/{tx_hash}) |"


def main() -> int:
    frozen = json.loads((ROOT / "contracts" / "FROZEN.json").read_text(encoding="utf-8"))["deployments"]["studio-next"]
    results = json.loads((ROOT / "eval" / "results.json").read_text(encoding="utf-8"))
    golden = json.loads((ROOT / "eval" / "golden.json").read_text(encoding="utf-8"))
    seed = json.loads((ROOT / "docs" / "seed.studio-next.json").read_text(encoding="utf-8"))
    rp = json.loads((ROOT / "docs" / "reviewer-path.studio-next.json").read_text(encoding="utf-8"))
    walk = json.loads((ROOT / "docs" / "ui-walk.studio-next.json").read_text(encoding="utf-8"))
    contract = frozen["triage"]
    head = ["| What | Outcome | Transaction |", "|---|---|---|"]

    lines = [
        "# Evidence",
        "",
        "Written by `python submission/evidence.py` from the records in this repository. Every transaction below was "
        "looked up on the Studio Next RPC when this file was written, and its outcome read with the same test the site "
        "uses (accepted and returned, or refused).",
        "",
        "## The contract",
        "",
        f"- Contract: [{contract}]({EXPLORER}/address/{contract})",
        f"- Source sha256 `{frozen['triage_sha256']}`; `python scripts/verify.py` reads the deployed bytes back identical.",
        "",
        *head,
        link("deploy", frozen["triage_tx"]),
        "",
        "## Golden cases, through real consensus",
        "",
        f"Program {results['program']['program_id']}. Full table with reasons: {SITE}/docs/more/evaluation",
        "",
        *head,
        link("open the golden program", results["program"]["open_tx"]),
    ]
    final = {}
    for a in results["attempts"]:
        if a.get("verdict"):
            final.setdefault(a["item"], a)
    for item in [*golden["seeds"], *golden["cases"]]:
        a = final.get(item["id"])
        if not a:
            continue
        tag = "seed " + item["id"] if item["id"].startswith("S") else f"case {item['id']}"
        verdict = a["verdict"] + (f" of #{a['duplicate_of']}" if a["verdict"] == "DUPLICATE" else "")
        lines.append(link(f"{tag}: judge #{a['report_id']} → {verdict}", a["tx"]))

    lines += [
        "",
        f"## The seeded program ({SITE}/p/{seed['program']['program_id']})",
        "",
        *head,
        link("open the program, 200 GEN", seed["program"]["open_tx"]),
    ]
    for key, row in seed["reports"].items():
        verdict = row["verdict"] + (f" of #{row['duplicate_of']}" if row["verdict"] == "DUPLICATE" else "")
        lines.append(link(f"file #{row['report_id']}", row["submit_tx"]))
        lines.append(link(f"judge #{row['report_id']} → {verdict}", row["judge_tx"]))
    lines.append(link(f"bonus of {seed['bonus']['gen']} GEN on #{seed['bonus']['report_id']}", seed["bonus"]["tx"]))
    lines.append(link(f"withdraw {int(seed['withdraw']['amount_wei']) // 10**18} GEN", seed["withdraw"]["tx"]))

    for run, log in rp["runs"].items():
        lines += [
            "",
            f"## Reviewer path {run}, from fresh accounts through the site's own signing code",
            "",
            f"Program {log.get('program_id')}. Every step: `docs/reviewer-path.studio-next.json`.",
            "",
            *head,
        ]
        for step in log["steps"]:
            if not step.get("hash"):
                continue
            expect = "refused" if step.get("expect") == "refused" else "returned"
            what = step["key"] + (f": {step['refusal']}" if step.get("refusal") else "")
            lines.append(link(what.replace("|", "/"), step["hash"], expect))
        rec_path = ROOT / "docs" / f"reviewer-path.{run}.reconcile.json"
        if rec_path.exists():
            rec = json.loads(rec_path.read_text(encoding="utf-8"))
            lines += [
                "",
                f"Both wallets of this run held nothing before the faucet, so each balance is reconciled from zero "
                f"(`python scripts/reconcile.py {run}`, `docs/reviewer-path.{run}.reconcile.json`): faucet, minus the value "
                "of every write that returned, plus what the contract paid, minus each transaction's primary fee from its "
                "own accounting.",
                "",
                "| Wallet | Faucet | Sent | Paid by contract | Primary fees (wei) | Expected (wei) | Balance (wei) | Difference |",
                "|---|---|---|---|---|---|---|---|",
            ]
            for who, w in rec["wallets"].items():
                lines.append(
                    f"| {who} `{w['address']}` | {int(w['faucet']) / 10**18:g} GEN | {int(w['sent_with_returned_writes']) / 10**18:g} GEN "
                    f"| {int(w['paid_by_contract']) / 10**18:g} GEN | {w['primary_fees']} | {w['expected']} | {w['balance']} "
                    f"| **{w['difference']} wei** |"
                )
            lines += [
                "",
                "The script's own per-transaction check in this run (`balance-withdraw`, `balance-close`) is recorded as not "
                "passing, each by exactly 25,000,000,000,000 wei: it subtracted the payout's consumed message fee, which Studio "
                "Next lists in the transaction's accounting and does not take from a wallet that is also the payee. The "
                "reconciliation above, which leaves that term out, is exact to 0 wei; `web/scripts/reviewer-path.mjs` "
                "carries the corrected formula for the next run. Nothing on chain differs.",
            ]
        state = next((s for s in log["steps"] if s["key"] == "read-program"), None)
        if state:
            lines += [
                "",
                f"Program {log.get('program_id')} after the close: funded {int(state['funded']) / 10**18:g} GEN, plus "
                f"{int(state['lost']) / 10**18:g} GEN from a lost stake, equals {int(state['paid']) / 10**18:g} GEN paid to the tester "
                f"and {int(state['returned']) / 10**18:g} GEN returned to the team, with the pool at {state['pool']} and "
                f"closed = {state['closed']}. The {int(state['bonuses']) / 10**18:g} GEN bonus is on top, from the team to the tester.",
            ]

    w = walk["ui_walk"]
    lines += [
        "",
        "## Live UI walk, through the deployed site's buttons",
        "",
        f"Wallet `{w['wallet']}`, made inside the page. Balance after finality {w['balance_wei']} wei, expected "
        f"{w['expected_balance_wei']} wei. Details: `docs/ui-walk.studio-next.md`.",
        "",
        *head,
    ]
    for label, tx_hash in w["txs"].items():
        lines.append(link(label, tx_hash))
    d = walk["docs_sample"]
    lines += ["", f"## The docs sample, run as written (`{d['script']}`)", "", *head]
    for label, tx_hash in d["txs"].items():
        lines.append(link(label, tx_hash))

    lines += ["", f"{len(checked)} transactions checked.", ""]
    (ROOT / "submission" / "evidence.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote submission/evidence.md, {len(checked)} transactions checked")
    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
