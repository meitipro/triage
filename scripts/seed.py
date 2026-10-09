#!/usr/bin/env python3
"""
Seed one program with a realistic mix of reports, with real actions.

    python scripts/seed.py

The program asks for feedback on this very site and its docs, so every report
below is a true observation about the code in this repository, written for the
seed by the build agent the way a tester would write it. Every verdict is the
validators'.

The run walks the demo of section 9 of the build spec, on chain:
  - the team opens the program with its scope and funds the pool;
  - testers file a mix of reports from their own accounts, with the stake;
  - each one is judged, in filing order;
  - the team tips a bonus on one actionable report;
  - one tester withdraws their balance.
The program stays open for 30 days, so a reviewer can file a report in it.

Every step is written to docs/seed.studio-next.json before it is printed, and
a second run resumes without sending anything twice. A verdict is recorded as
it came out; nothing is retried except a round that produced no verdict.
"""

from __future__ import annotations

import json
import sys

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RECORD = C.ROOT / "docs" / "seed.studio-next.json"

NAME = "Triage site and docs, public beta"
SCOPE = (
    "The Triage website and its docs: the landing page, programs, a program's queue and record, filing a report, a "
    "report's page, opening a program, the tester page, the queue export and every page under /docs. Not in scope: the "
    "GenLayer network itself, the Studio Next RPC and explorer, wallets, and the contract's rules (stakes, labels, filing "
    "order), which are fixed for this deployment. Security issues go to a private security advisory on the GitHub "
    "repository, never here."
)
REWARD_GEN = 8
STAKE_GEN = 1
CAP = 5
DAYS = 30
FUNDING_GEN = 200
TEAM = "seed_team"
TESTERS = ["seed_tester_1", "seed_tester_2", "seed_tester_3", "seed_tester_4"]

#: (key, tester, kind, title, body)
REPORTS = [
    (
        "csv",
        "seed_tester_1",
        "usability",
        "Export button only offers JSON; CSV needs a hand-typed URL",
        "Problem: the Export button on a program page downloads JSON. The export route also serves CSV (?format=csv), "
        "which is what most trackers import, but nothing on the page links to it, so a team has to read the docs and "
        "type the URL by hand.\nWhere: program page, the Export button next to the Queue tabs, desktop and mobile.\n"
        "Why it matters: the queue is meant to feed a tracker; one more click to a CSV would save every team the detour.",
    ),
    (
        "cap",
        "seed_tester_2",
        "idea",
        "Show how many reports I have left this week on the program page",
        "Problem: the weekly cap per tester is only counted down on the file-a-report page (\"3 of 5 reports left this "
        "week\"). On the program page I see the cap but not how many I have used, so I open the form just to find out.\n"
        "Idea: when a wallet is connected, show \"n of 5 left this week\" beside the File a report button.\n"
        "Why: it saves a page load and stops a tester writing a long report the contract will refuse at the cap.",
    ),
    (
        "csv-again",
        "seed_tester_3",
        "usability",
        "No CSV download for the queue",
        "The program page's Export gives me a JSON file. Our tracker only imports CSV. I found in the docs that "
        "/api/export/<id>?format=csv works, but there is no button for it. Please add a CSV option next to Export.",
    ),
    (
        "explorer",
        "seed_tester_4",
        "bug",
        "Explorer transaction pages take long to load",
        "Steps: open any report, click the judge tx link.\nExpected: the explorer page loads in a second or two.\n"
        "Actual: the Studio Next explorer page spins for several seconds before the transaction appears.\n"
        "Environment: Chrome 129, Windows 11.",
    ),
    (
        "vague",
        "seed_tester_2",
        "usability",
        "Make the site better",
        "The site could be better. It should be easier and nicer to use.",
    ),
    (
        "sample",
        "seed_tester_1",
        "bug",
        "Quickstart script says <body file> without saying what goes in it",
        "Steps: open /docs/quickstart and read the genlayer-js sample's usage line, node examples/file-a-report.mjs "
        "<account name> <program id> <kind> <title> <body file>.\nExpected: the page says the body file is the report "
        "text in plain text, up to 1,500 characters, and how kind is spelled (bug, usability or idea).\nActual: neither "
        "is said on the page; I had to read the contract reference to learn both.\nEnvironment: Firefox 131, docs page.",
    ),
]
#: The report the team tips, and how much.
BONUS = ("sample", 5)
#: The tester who withdraws at the end.
WITHDRAWS = "seed_tester_1"


def load() -> dict:
    if RECORD.exists():
        return json.loads(RECORD.read_text(encoding="utf-8"))
    return {"program": {}, "reports": {}, "attempts": [], "bonus": {}, "withdraw": {}}


def save(record: dict) -> None:
    RECORD.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def must(outcome: dict, what: str) -> dict:
    if not outcome["ok"]:
        raise SystemExit(f"{what} failed: {outcome['detail']}  {C.EXPLORER}/tx/{outcome['hash']}")
    return outcome


def main() -> int:
    address = C.address()
    people = C.accounts(TEAM, *TESTERS)
    chains = {name: C.Chain(acct) for name, acct in people.items()}
    team = chains[TEAM]
    record = load()
    record.update({"contract": address, "network": C.NETWORK, "explorer": C.EXPLORER, "team": people[TEAM].address})
    record["testers"] = {name: people[name].address for name in TESTERS}
    save(record)
    team.ensure(people[TEAM].address, minimum_gen=FUNDING_GEN + 50)
    for name in TESTERS:
        chains[name].ensure(people[name].address, minimum_gen=20)

    program = record["program"]
    if "program_id" not in program:
        args = [NAME, SCOPE, REWARD_GEN * C.GEN, STAKE_GEN * C.GEN, CAP, DAYS]
        outcome = must(team.send(address, "open_program", args, value=FUNDING_GEN * C.GEN), "open_program")
        program.update({"program_id": int(outcome["result"]), "open_tx": outcome["hash"]})
        save(record)
        print(f"opened program {program['program_id']}  {C.EXPLORER}/tx/{outcome['hash']}")
    pid = program["program_id"]

    for key, tester, kind, title, body in REPORTS:
        row = record["reports"].setdefault(key, {"tester": people[tester].address, "title": title})
        if "report_id" not in row:
            outcome = must(chains[tester].send(address, "submit", [pid, kind, title, body], value=STAKE_GEN * C.GEN), f"submit {key}")
            row.update({"report_id": int(outcome["result"]), "submit_tx": outcome["hash"]})
            save(record)
            print(f"\n{key}: filed as #{row['report_id']}  {C.EXPLORER}/tx/{outcome['hash']}")
        while "verdict" not in row:
            tries = sum(1 for a in record["attempts"] if a["key"] == key)
            if tries >= 3:
                raise SystemExit(f"{key} has no verdict after 3 judges")
            outcome = team.send(address, "judge", [row["report_id"]])
            report = C.retry("get_report", team.read_json, address, "get_report", [row["report_id"]])
            attempt = {"key": key, "attempt": tries + 1, "tx": outcome["hash"], "consensus": "decided" if outcome["ok"] else outcome["detail"]}
            if report["status"] != "FILED":
                attempt["verdict"] = report["status"]
                row.update(
                    {
                        "verdict": report["status"],
                        "duplicate_of": report["duplicate_of"],
                        "summary": report["summary"],
                        "reason": report["reason"],
                        "judge_tx": outcome["hash"],
                    }
                )
            record["attempts"].append(attempt)
            save(record)
            print(f"  {attempt.get('verdict', 'no verdict: ' + attempt['consensus'])}  {report.get('reason', '')}")
            print(f"  {C.EXPLORER}/tx/{outcome['hash']}")

    bonus = record["bonus"]
    key, gen = BONUS
    if "tx" not in bonus and record["reports"][key].get("verdict") == "ACTIONABLE":
        outcome = must(team.send(address, "bonus", [record["reports"][key]["report_id"]], value=gen * C.GEN), "bonus")
        bonus.update({"report": key, "report_id": record["reports"][key]["report_id"], "gen": gen, "tx": outcome["hash"]})
        save(record)
        print(f"\nbonus of {gen} GEN on #{bonus['report_id']}  {C.EXPLORER}/tx/{outcome['hash']}")

    out = record["withdraw"]
    if "tx" not in out:
        who = chains[WITHDRAWS]
        before = who.balance(people[WITHDRAWS].address)
        owed = int(who.read_json(address, "tester_stats", [people[WITHDRAWS].address])["balance"])
        outcome = must(who.send(address, "withdraw", [], until="finalized"), "withdraw")
        after = who.balance(people[WITHDRAWS].address)
        out.update({"tester": people[WITHDRAWS].address, "amount_wei": str(owed), "tx": outcome["hash"], "balance_before_wei": str(before), "balance_after_wei": str(after)})
        save(record)
        print(f"\n{WITHDRAWS} withdrew {owed / C.GEN} GEN  {C.EXPLORER}/tx/{outcome['hash']}")

    final = team.read_json(address, "get_program", [pid])
    record["program_state"] = {k: final[k] for k in ("pool", "reserved", "funded", "lost", "paid", "bonuses", "reports", "actionable", "duplicate", "out_of_scope", "low_effort", "testers")}
    save(record)
    print("\nprogram", json.dumps(record["program_state"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
