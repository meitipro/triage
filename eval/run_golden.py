#!/usr/bin/env python3
"""
Run the golden cases through the deployed Triage contract on Studio Next,
through real consensus, and publish what came out.

    python eval/run_golden.py              # the seeds, then golden cases 1 to 9
    python eval/run_golden.py H1 H2 H3     # the held-out cases, once
    python eval/run_golden.py --report     # rewrite results.md from results.json

eval/golden.json was written, hashed and timestamped (eval/golden.lock.json)
before the first run, and this script refuses to run if it has changed since.
Everything lives in one program opened by the local "golden_team" account.
Each report is filed by one of golden_tester_1 to _5 from its own account, with
the real stake; the team then calls judge, so every verdict below is the real
judge on the real contract, read back with get_report, not from this script's
memory. Reports are judged in filing order, which the contract enforces, so
each item is filed and judged before the next one is filed.

Every step is saved before anything is printed, so a run can stop at any point
and resume without sending anything twice. H1 to H3 are held out: run once,
reported as they came out, never used to tune the prompt. A judge whose round
produced no verdict (the committee timed out or could not agree) may be sent
again, and every attempt stays in the record. An item that produced a verdict
is never sent again, whatever the verdict was.
"""

from __future__ import annotations

import ast
import datetime
import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))

import chain as C  # noqa: E402

# A model's reason can carry any character; the Windows console codepage cannot.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
GOLDEN = HERE / "golden.json"
LOCK = HERE / "golden.lock.json"
RESULTS = HERE / "results.json"
REPORT = HERE / "results.md"
TEAM = "golden_team"
TESTERS = [f"golden_tester_{i}" for i in range(1, 6)]
FINAL = ("ACTIONABLE", "DUPLICATE", "OUT_OF_SCOPE", "LOW_EFFORT")
MAX_ATTEMPTS = 3


def judge_sha() -> str:
    tree = ast.parse(C.CONTRACT_FILE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "JUDGE":
            return hashlib.sha256(ast.literal_eval(node.value).encode("utf-8")).hexdigest()
    raise SystemExit("no JUDGE constant")


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"program": {}, "items": {}, "attempts": []}


def save(results: dict) -> None:
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def must(outcome: dict, what: str) -> dict:
    if not outcome["ok"]:
        raise SystemExit(f"{what} failed: {outcome['detail']}  {C.EXPLORER}/tx/{outcome['hash']}")
    return outcome


def items_in_order(golden: dict) -> list[dict]:
    return [dict(s, seed=True) for s in golden["seeds"]] + [dict(c, seed=False) for c in golden["cases"]]


def verdict_of(results: dict, item_id: str) -> dict | None:
    for attempt in results["attempts"]:
        if attempt["item"] == item_id and attempt.get("verdict") in FINAL:
            return attempt
    return None


def matches(results: dict, attempt: dict, item: dict) -> bool | None:
    """True or False against the expected label; None for a held-out case, which has no expected answer."""
    want = item.get("expected")
    if item.get("seed") or want in (None, "NONE"):
        return None
    if attempt.get("verdict") != want:
        return False
    if want == "DUPLICATE":
        original = results["items"].get(item["duplicate_of"], {}).get("report_id")
        return original is not None and attempt.get("duplicate_of") == original
    return True


def open_program(golden: dict, results: dict, address: str, team: C.Chain) -> dict:
    row = results["program"]
    spec = golden["program"]
    if "program_id" not in row:
        before = team.read_json(address, "get_program", [0])["programs"]
        args = [spec["name"], spec["scope"], spec["reward_gen"] * C.GEN, spec["stake_gen"] * C.GEN, spec["weekly_cap"], spec["days"]]
        outcome = must(team.send(address, "open_program", args, value=spec["funding_gen"] * C.GEN), "open_program")
        pid = outcome["result"] if isinstance(outcome["result"], int) else None
        if not pid:
            after = team.read_json(address, "get_program", [0])["programs"]
            pid = after if after > before else None
        if not pid:
            raise SystemExit("open_program returned no program id")
        row.update({"program_id": int(pid), "open_tx": outcome["hash"]})
        save(results)
        print(f"opened program {pid}  {C.EXPLORER}/tx/{outcome['hash']}")
    return row


def run_item(item: dict, index: int, results: dict, address: str, program: dict, team: C.Chain, testers: dict, golden: dict) -> bool:
    """File (once) and judge one item. Returns True when it has a verdict."""
    iid = item["id"]
    name = TESTERS[index % len(TESTERS)]
    who = testers[name]
    row = results["items"].setdefault(iid, {"tester": who.account.address, "seed": item["seed"]})
    if "report_id" not in row:
        stake = golden["program"]["stake_gen"] * C.GEN
        outcome = must(
            who.send(address, "submit", [program["program_id"], item["kind"], item["title"], item["body"]], value=stake),
            f"submit for {iid}",
        )
        rid = outcome["result"] if isinstance(outcome["result"], int) else None
        if not rid:
            raise SystemExit(f"submit for {iid} returned no report id  {C.EXPLORER}/tx/{outcome['hash']}")
        row.update({"report_id": int(rid), "submit_tx": outcome["hash"]})
        save(results)
        print(f"  filed as report {rid}  {C.EXPLORER}/tx/{outcome['hash']}")
    tries = sum(1 for a in results["attempts"] if a["item"] == iid)
    attempt = {
        "item": iid,
        "attempt": tries + 1,
        "seed": item["seed"],
        "held_out": bool(item.get("held_out")),
        "expected": item.get("expected", "seed"),
        "report_id": row["report_id"],
    }
    outcome = team.send(address, "judge", [row["report_id"]])
    attempt.update({"tx": outcome["hash"], "sent_at": now_iso(), "consensus": "decided" if outcome["ok"] else outcome["detail"]})
    report = C.retry("get_report", team.read_json, address, "get_report", [row["report_id"]])
    if report.get("status") in FINAL:
        attempt.update(
            {
                "verdict": report["status"],
                "duplicate_of": report["duplicate_of"],
                "summary": report["summary"],
                "reason": report["reason"],
                "credited": report["credited"],
                "judged_at": report["judged_at"],
            }
        )
    # Saved before anything is printed: a result that exists on chain must
    # never be lost to a failure on this side of the wire.
    results["attempts"].append(attempt)
    save(results)
    if attempt.get("verdict"):
        hit = matches(results, attempt, item)
        mark = "seed " if item["seed"] else ("HELD " if hit is None else ("MATCH" if hit else "MISS "))
        dup = f" of {attempt['duplicate_of']}" if attempt["verdict"] == "DUPLICATE" else ""
        print(f"  {mark} {attempt['verdict']}{dup}  {attempt.get('reason', '')}")
    else:
        print(f"  no verdict: {attempt['consensus']}")
    print(f"  {C.EXPLORER}/tx/{attempt['tx']}")
    return bool(attempt.get("verdict"))


def run(ids: list[str]) -> None:
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    if C.sha256_file(GOLDEN) != lock["sha256"]:
        raise SystemExit("eval/golden.json changed after it was locked; the golden set is not edited after the first run")
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    address = C.address()
    people = C.accounts(TEAM, *TESTERS)
    team = C.Chain(people[TEAM])
    testers = {name: C.Chain(people[name]) for name in TESTERS}
    results = load_results()
    results.update(
        {
            "contract": address,
            "contract_sha256": C.deployment().get("triage_sha256"),
            "golden_sha256": lock["sha256"],
            "golden_locked_at": lock["locked_at"],
            "judge_sha256": judge_sha(),
            "network": C.NETWORK,
            "explorer": C.EXPLORER,
            "team": people[TEAM].address,
            "testers": [people[name].address for name in TESTERS],
        }
    )
    save(results)
    every = items_in_order(golden)
    wanted = ids or [i["id"] for i in every if not i.get("held_out")]
    todo = [(n, i) for n, i in enumerate(every) if i["id"] in wanted and not verdict_of(results, i["id"])]
    if todo:
        team.ensure(people[TEAM].address, minimum_gen=golden["program"]["funding_gen"] + 50, top_up_gen=1000)
        for name in TESTERS:
            testers[name].ensure(people[name].address, minimum_gen=20)
        program = open_program(golden, results, address, team)
    for n, item in todo:
        label = "seed" if item["seed"] else f"expected {item.get('expected')}"
        print(f"\n{item['id']} {item.get('what', item['title'])} ({label})")
        while not run_item(item, n, results, address, results["program"], team, testers, golden):
            if sum(1 for a in results["attempts"] if a["item"] == item["id"]) >= MAX_ATTEMPTS:
                raise SystemExit(f"{item['id']} has no verdict after {MAX_ATTEMPTS} judges; stopping, nothing later can be judged before it")
    report()


def report() -> None:
    results = load_results()
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    every = items_in_order(golden)
    final = {i["id"]: verdict_of(results, i["id"]) for i in every}
    ids = {iid: row.get("report_id") for iid, row in results.get("items", {}).items()}

    def score(held: bool) -> tuple[int, int]:
        rows = [(i, final[i["id"]]) for i in every if not i["seed"] and bool(i.get("held_out")) == held and final[i["id"]]]
        return sum(1 for i, a in rows if matches(results, a, i)), len(rows)

    g_hit, g_n = score(False)
    held = [i for i in every if i.get("held_out") and final[i["id"]]]
    explorer = results.get("explorer", C.EXPLORER)
    contract = results.get("contract", "")
    program = results.get("program", {})

    def got(i: dict) -> str:
        a = final[i["id"]]
        if not a:
            return "not run yet"
        text = a["verdict"].replace("_", " ")
        if a["verdict"] == "DUPLICATE":
            text += f" of #{a['duplicate_of']}"
        return text

    def tx(a: dict) -> str:
        return f"[{a['tx'][:10]}…]({explorer}/tx/{a['tx']})" if a else ""

    lines = [
        "# Golden cases, through real consensus",
        "",
        f"Contract [`{contract}`]({explorer}/address/{contract}) on Studio Next (chain 61997), program "
        f"{program.get('program_id', '?')}. Every row is one report in that program: a tester filed it with the real stake "
        "from their own account, and one `judge` transaction asked the validators. Reports are judged in filing order, so "
        "each one saw the seeds and every case accepted before it. The verdict is read back from the contract with "
        "`get_report`, not from the script's memory.",
        "",
        f"- Golden set: **{g_hit} of {g_n}** matched.",
        f"- Held-out cases: {len(held)} of 3 run, once, with no expected answer; their verdicts are below exactly as they came out.",
        f"- `eval/golden.json` sha256 `{results.get('golden_sha256', '')}`, locked at {results.get('golden_locked_at', '')}, before the first run.",
        f"- Judge prompt sha256 `{results.get('judge_sha256', '')}`.",
        "",
        "Nothing here was tuned. The prompt is the spec's, word for word, and no case was edited after the lock.",
        "",
        "## The seeded accepted list",
        "",
        "| Seed | Report | Title | Got | Transaction |",
        "|---|---|---|---|---|",
    ]
    for i in every:
        if not i["seed"]:
            continue
        a = final[i["id"]]
        lines.append(f"| {i['id']} | #{ids.get(i['id'], '?')} | {i['title']} | {got(i)} | {tx(a)} |")
    lines += [
        "",
        "## The cases",
        "",
        "| Case | What it tests | Report | Expected | Got | Reason (the leader's, display only) | Transaction |",
        "|---|---|---|---|---|---|---|",
    ]
    for i in every:
        if i["seed"]:
            continue
        a = final[i["id"]]
        want = i["expected"].replace("_", " ") if i["expected"] != "NONE" else "none (held out)"
        if i["expected"] == "DUPLICATE":
            want += f" of #{ids.get(i['duplicate_of'], i['duplicate_of'])} ({i['duplicate_of']})"
        if a:
            hit = matches(results, a, i)
            mark = "" if hit is None else (" ✓" if hit else " ✗ miss")
            reason = (a.get("reason") or "").replace("|", "/")
        else:
            mark, reason = "", ""
        tag = i["id"] + (" (held out)" if i.get("held_out") else "")
        lines.append(f"| {tag} | {i['what']} | #{ids.get(i['id'], '?')} | {want} | {got(i)}{mark} | {reason} | {tx(a)} |")
    others = [a for a in results["attempts"] if a.get("verdict") not in FINAL]
    lines += ["", "## Every attempt", ""]
    if others:
        lines.append("Judge transactions whose round produced no verdict, each sent again as the next attempt:")
        lines.append("")
        for a in others:
            lines.append(f"- {a['item']} attempt {a['attempt']}: {a['consensus'][:200]} ([tx]({explorer}/tx/{a['tx']}))")
    else:
        lines.append("Every judge produced a verdict on its first attempt; nothing was sent twice.")
    lines += ["", "## Filing", ""]
    if program.get("open_tx"):
        lines.append(f"- program {program['program_id']} opened in [{program['open_tx'][:10]}…]({explorer}/tx/{program['open_tx']})")
    for i in every:
        row = results.get("items", {}).get(i["id"])
        if row and "submit_tx" in row:
            lines.append(f"- {i['id']}: report #{row['report_id']} filed by `{row['tester']}` in [{row['submit_tx'][:10]}…]({explorer}/tx/{row['submit_tx']})")
    lines.append("")
    REPORT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"\nwrote {REPORT.relative_to(C.ROOT).as_posix()}: golden {g_hit}/{g_n}, held out run {len(held)}/3")


if __name__ == "__main__":
    if "--report" in sys.argv:
        report()
    else:
        run([a for a in sys.argv[1:] if not a.startswith("--")])
