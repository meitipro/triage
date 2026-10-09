#!/usr/bin/env python3
"""
Reconcile every wallet of a reviewer-path run from zero, to the wei.

    python scripts/reconcile.py rp1

The run's two accounts were made for it and held nothing before. So each wallet's balance now must be exactly:

    what the faucet paid
  - the value sent with every write that returned   (a refused write keeps its value with the sender)
  + what the contract paid it (withdraw, close)
  - the primary fee of every transaction it sent   (paid minus refunded, from the transaction's own accounting)

A payout's fee accounting also lists a consumed message fee, which Studio Next does not take from a wallet that is
also the payee (measured on Clearance, Redline and here); it is reported beside the result and not subtracted.
Per-transaction before/after reads are not used, because refunds settle late.
"""

from __future__ import annotations

import json
import pathlib
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
RECORD = ROOT / "docs" / "reviewer-path.studio-next.json"
RPC = "https://studio-next.genlayer.com/api"


def rpc(method: str, params: list):
    for attempt in range(6):
        body = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=60).json()
        if body.get("error", {}).get("code") == -32029:
            time.sleep(15)
            continue
        if "error" in body:
            raise RuntimeError(body["error"])
        return body["result"]
    raise RuntimeError(method)


def main() -> int:
    run = sys.argv[1] if len(sys.argv) > 1 else "rp1"
    log = json.loads(RECORD.read_text(encoding="utf-8"))["runs"][run]
    out = {"run": run, "wallets": {}}
    ok = True
    for who, address in log["accounts"].items():
        if who == "nonces_at_start":
            continue
        faucet = sum(int(s["after"]) - int(s["before"] or 0) for s in log["steps"] if s["key"] == f"faucet-{who}")
        sent = fees = listed = paid = 0
        rows = []
        for s in log["steps"]:
            if not s.get("hash") or str(s.get("from", "")).lower() != address.lower():
                continue
            tx = rpc("eth_getTransactionByHash", [s["hash"]])
            acct = tx["data"]["fee_accounting"]
            if acct.get("status") != "settled":
                print(f"{s['key']}: fee accounting {acct.get('status')}, not settled yet")
                return 2
            primary = sum(int(t.get("primaryAmount", 0)) for t in acct.get("top_ups", [])) - sum(int(r.get("primary", 0)) for r in acct.get("refunds", []))
            message = sum(int(t.get("messageFees", 0)) for t in acct.get("top_ups", [])) - sum(int(r.get("message", 0)) for r in acct.get("refunds", []))
            value = int(s.get("value") or 0) if s.get("ok") else 0
            fees += primary
            listed += message
            sent += value
            rows.append({"key": s["key"], "ok": s.get("ok"), "value": str(value), "primary_fee": str(primary), "message_listed": str(message)})
        for s in log["steps"]:
            if s["key"].startswith("balance-") and any(r["key"] == s["key"][8:] for r in rows):
                paid += int(s["paid_by_contract"])
        expected = faucet - sent + paid - fees
        balance = int(rpc("eth_getBalance", [address, "latest"]), 16)
        out["wallets"][who] = {
            "address": address,
            "faucet": str(faucet),
            "sent_with_returned_writes": str(sent),
            "paid_by_contract": str(paid),
            "primary_fees": str(fees),
            "message_fee_listed_not_charged": str(listed),
            "expected": str(expected),
            "balance": str(balance),
            "difference": str(balance - expected),
            "transactions": rows,
        }
        ok &= balance == expected
        print(f"{who} {address}: faucet {faucet / 1e18} − sent {sent / 1e18} + paid {paid / 1e18} − fees {fees} wei = {expected} wei; balance {balance} wei; difference {balance - expected} wei")
    target = ROOT / "docs" / f"reviewer-path.{run}.reconcile.json"
    target.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {target.relative_to(ROOT).as_posix()}; {'every wallet exact' if ok else 'NOT exact'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
