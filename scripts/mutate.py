#!/usr/bin/env python3
"""
Break every defence in the contract, one at a time, and name the test that notices.

    python scripts/mutate.py                          # run, print the table
    python scripts/mutate.py --table docs/MUTATIONS.md

A passing count is a claim; a table of mutations, each named with the test that
killed it, is evidence. Each mutant is a copy of contracts/triage.py with one
defence removed or weakened. The direct and static tests run against
it through TRIAGE_CONTRACT, and the first failing test is recorded as the kill.

A kill is read from pytest's own report of which test failed, never from an
exit code alone: a runner that scores exit codes reports a perfect run while
testing nothing. The tests that compare the file with a generated copy or with
the deployed record are left out, because they fail for ANY edit and would kill
every mutant without testing its defence.

If anything escapes, the table is not written and the escapes are printed. An
escape means a missing test, or a defence strict enough elsewhere that this one
can no longer fail, and either is a finding.
"""

from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "triage.py"

#: (what the mutant does, text in the contract, what replaces it). Each text
#: must occur exactly once, so a mutant always changes exactly one place.
MUTANTS = [
    # who may write
    ("team check: anyone passes", "        if p.team != gl.message.sender_address:", "        if False:"),
    ("bonus: no team check", '        self._team(p, "tip a bonus")\n', ""),
    ("close: no team check", '        self._team(p, "close it")\n', ""),
    ("open: the program is recorded as nobody's", "team=gl.message.sender_address,", "team=ZERO,"),
    ("fund: the funder is not recorded", "funder=gl.message.sender_address, amount=u256(value)", "funder=ZERO, amount=u256(value)"),
    ("judge: the caller is not recorded", "        r.judged_by = gl.message.sender_address\n", ""),
    ("submit: the team files in its own program", "        if p.team == me:\n            raise", "        if False:\n            raise"),
    ("submit: the team compared as case-sensitive text", "        if p.team == me:\n            raise", "        if p.team.as_hex == me.as_hex.upper():\n            raise"),
    ("submit: the report is recorded as nobody's", "            tester=me,\n            kind=clean_kind,", "            tester=ZERO,\n            kind=clean_kind,"),
    ("withdraw: pays a fixed address", "        _Payee(me).emit_transfer(value=u256(amount))\n        return amount\n\n    @gl.public.write\n    def close", "        _Payee(ZERO).emit_transfer(value=u256(amount))\n        return amount\n\n    @gl.public.write\n    def close"),
    ("close: pays a fixed address", "        if amount > 0:\n            _Payee(me).emit_transfer(value=u256(amount))", "        if amount > 0:\n            _Payee(ZERO).emit_transfer(value=u256(amount))"),
    # opening
    ("open: no funding needed", "        if value < reward:", "        if value < 0:"),
    ("open: a reward of zero", "or reward <= 0:", "or reward < 0:"),
    ("open: a stake of zero", "or stake <= 0:", "or stake < 0:"),
    ("open: a weekly cap of 21", "MAX_CAP = 20", "MAX_CAP = 21"),
    ("open: a scope of 1201 characters", "MAX_SCOPE = 1200", "MAX_SCOPE = 1201"),
    ("open: 121 days", "MAX_DAYS = 120", "MAX_DAYS = 121"),
    ("open: the trial lasts two hours", "TRIAL_SECONDS = 3600", "TRIAL_SECONDS = 7200"),
    ("open: days measured in hours", "ends_at=u64(now + (length * DAY if length > 0 else TRIAL_SECONDS)),", "ends_at=u64(now + (length * 3600 if length > 0 else TRIAL_SECONDS)),"),
    ("whole numbers: a bool passes", "    if isinstance(raw, bool) or not isinstance(raw, int):\n        raise gl.vm.UserError(E + what + \" is a whole number\")", "    if not isinstance(raw, int):\n        raise gl.vm.UserError(E + what + \" is a whole number\")"),
    # fund
    ("fund: zero value accepted", '        if value <= 0:\n            raise gl.vm.UserError(E + "send some GEN to fund the program")', '        if value < 0:\n            raise gl.vm.UserError(E + "send some GEN to fund the program")'),
    ("fund: open on a closed program", '        p = self._program(program_id)\n        if p.closed:\n            raise gl.vm.UserError(E + "this program is closed")\n        now = self._now()\n        if now >= int(p.ends_at):\n            raise gl.vm.UserError(E + "this program has ended")\n        value', '        p = self._program(program_id)\n        now = self._now()\n        if now >= int(p.ends_at):\n            raise gl.vm.UserError(E + "this program has ended")\n        value'),
    ("fund: open after the end", '        now = self._now()\n        if now >= int(p.ends_at):\n            raise gl.vm.UserError(E + "this program has ended")\n        value = int(gl.message.value)\n        if value <= 0:', '        now = self._now()\n        value = int(gl.message.value)\n        if value <= 0:'),
    # submit
    ("submit: any value is a stake", "        if value != int(p.stake):", "        if value < int(p.stake):"),
    ("submit: no stake needed", "        if value != int(p.stake):", "        if False:"),
    ("submit: no weekly cap", "        if used >= int(p.weekly_cap):", "        if False:"),
    ("submit: the cap allows one more", "        if used >= int(p.weekly_cap):", "        if used > int(p.weekly_cap):"),
    ("submit: the cap is per tester across programs", 'wkey = str(int(program_id)) + ":" + str(week) + ":" + me.as_hex.lower()', 'wkey = str(week) + ":" + me.as_hex.lower()'),
    ("submit: the cap never resets", "        week = now // WEEK\n", "        week = 0\n"),
    ("submit: the count is not kept", "        self.weekly[wkey] = u32(used + 1)\n", ""),
    ("submit: no pool check", "        if int(p.pool) < int(p.reward):", "        if False:"),
    ("submit: nothing is reserved", "        p.reserved = u256(int(p.reserved) + int(p.reward))\n", ""),
    ("submit: the pool is not drawn down", "        p.pool = u256(int(p.pool) - int(p.reward))\n", ""),
    ("submit: open after the end", '        if now >= int(p.ends_at):\n            raise gl.vm.UserError(E + "this program has ended")\n        if p.team == me:', "        if p.team == me:"),
    ("submit: open on a closed program", '        if p.closed:\n            raise gl.vm.UserError(E + "this program is closed")\n        now = self._now()\n        if now >= int(p.ends_at):\n            raise gl.vm.UserError(E + "this program has ended")\n        if p.team', '        now = self._now()\n        if now >= int(p.ends_at):\n            raise gl.vm.UserError(E + "this program has ended")\n        if p.team'),
    ("submit: any kind", "    if kind not in KINDS:", "    if False:"),
    ("submit: a 101-character title", "MAX_TITLE = 100", "MAX_TITLE = 101"),
    ("submit: a 1501-character report", "MAX_BODY = 1500", "MAX_BODY = 1501"),
    ("submit: testers counted on every report", "        if skey not in self.seen:\n            self.seen[skey] = True\n", "        if True:\n"),
    ("submit: the tester's list is not kept", '        self.tester_reports[tkey + "#" + str(int(t.filed))] = u64(rid)\n', ""),
    # judge
    ("judge: a report is judged twice", "        if r.status != FILED:\n            raise", "        if False:\n            raise"),
    ("judge: out of filing order", "        if int(r.index) != int(p.judged) + 1:", "        if False:"),
    ("judge: the judged count is not kept", "        p.judged = u32(int(p.judged) + 1)\n", ""),
    ("judge: the reserve is kept", "        p.reserved = u256(int(p.reserved) - reward)\n", ""),
    ("judge: ACTIONABLE credits only the stake", "            self._credit(r.tester, stake + reward)\n            r.credited = u256(stake + reward)", "            self._credit(r.tester, stake)\n            r.credited = u256(stake + reward)"),
    ("judge: ACTIONABLE keeps the stake", "            self._credit(r.tester, stake + reward)\n            r.credited = u256(stake + reward)", "            self._credit(r.tester, reward)\n            r.credited = u256(stake + reward)"),
    ("judge: ACTIONABLE does not join the queue", '            self.accepted[str(pid) + "#" + str(n)] = u64(int(report_id))\n', ""),
    ("judge: ACTIONABLE is not counted as paid", "            p.paid = u256(int(p.paid) + reward)\n", ""),
    ("judge: LOW_EFFORT returns the stake", "            p.pool = u256(int(p.pool) + stake + reward)\n            p.lost", "            self._credit(r.tester, stake)\n            p.pool = u256(int(p.pool) + reward)\n            p.lost"),
    ("judge: LOW_EFFORT does not unreserve the reward", "            p.pool = u256(int(p.pool) + stake + reward)\n            p.lost", "            p.pool = u256(int(p.pool) + stake)\n            p.lost"),
    ("judge: LOW_EFFORT loses nothing on the record", "            p.lost = u256(int(p.lost) + stake)\n", ""),
    ("judge: DUPLICATE and OUT_OF_SCOPE keep the stake", "        else:\n            self._credit(r.tester, stake)\n", "        else:\n"),
    ("judge: DUPLICATE and OUT_OF_SCOPE do not unreserve the reward", "            r.credited = u256(stake)\n            p.pool = u256(int(p.pool) + reward)\n", "            r.credited = u256(stake)\n"),
    ("judge: DUPLICATE pays the reward", "        if verdict == ACTIONABLE:\n            self._credit", "        if verdict in (ACTIONABLE, DUPLICATE):\n            self._credit"),
    ("judge: the duplicate link is dropped", 'r.dup = u64(int(out["duplicate_of"])) if verdict == DUPLICATE else u64(0)', "r.dup = u64(0)"),
    ("judge: validators agree with any answer", 'return (mine["verdict"], mine["duplicate_of"]) == (theirs.get("verdict"), theirs.get("duplicate_of"))', "return True"),
    ("judge: validators ignore the duplicate id", 'return (mine["verdict"], mine["duplicate_of"]) == (theirs.get("verdict"), theirs.get("duplicate_of"))', 'return mine["verdict"] == theirs.get("verdict")'),
    ("judge: validators compare the summary too", 'return (mine["verdict"], mine["duplicate_of"]) == (theirs.get("verdict"), theirs.get("duplicate_of"))', "return mine == theirs"),
    ("judge: a duplicate may name any id", "    if rid not in valid:\n        raise", "    if False:\n        raise"),
    ("judge: a duplicate id may be empty", '    if text == "" or not text.isdigit() or len(text) > 12:', '    if text != "" and not text.isdigit():'),
    ("judge: an id on another label is kept", '    if verdict != DUPLICATE:\n        return ""', "    if False:\n        return \"\""),
    ("judge: an unreadable verdict defaults to LOW_EFFORT", '    if text not in VERDICTS:\n        raise gl.vm.UserError(L + "bad verdict")', "    if text not in VERDICTS:\n        return LOW_EFFORT"),
    ("judge: the summary is not capped", 'summary = " ".join(str(parsed.get("summary") or "").split())[:MAX_SUMMARY]', 'summary = str(parsed.get("summary") or "")'),
    ("judge: the reason is not capped", 'reason = " ".join(str(parsed.get("reason") or "").split())[:MAX_REASON]', 'reason = " ".join(str(parsed.get("reason") or "").split())'),
    ("judge: no retry on a formatting slip", "        if not error_text(first).startswith(L):\n            raise", "        raise"),
    ("judge: 26 accepted reports shown", "SHOWN_ACCEPTED = 25", "SHOWN_ACCEPTED = 26"),
    ("judge: the oldest accepted reports shown", "        n = int(p.actionable)\n        while n >= 1 and len(out) < SHOWN_ACCEPTED:", "        n = min(int(p.actionable), SHOWN_ACCEPTED)\n        while n >= 1 and len(out) < SHOWN_ACCEPTED:"),
    # the prompt
    ("prompt: the fence lets delimiters through", 'return str(raw).replace("<", "(").replace(">", ")")', "return str(raw)"),
    ("prompt: the scope reaches the prompt unfenced", "        scope=fence(scope),", "        scope=scope,"),
    ("prompt: the title reaches the prompt unfenced", "        title=fence(title),", "        title=title,"),
    ("prompt: the body reaches the prompt unfenced", "        body=fence(body),", "        body=body,"),
    ("prompt: accepted titles reach the prompt unfenced", 'out.append(str(int(rid)) + ": " + fence(title) + ", " + fence(summary))', 'out.append(str(int(rid)) + ": " + title + ", " + fence(summary))'),
    ("prompt: accepted summaries reach the prompt unfenced", 'out.append(str(int(rid)) + ": " + fence(title) + ", " + fence(summary))', 'out.append(str(int(rid)) + ": " + fence(title) + ", " + summary)'),
    # bonus
    ("bonus: any report can be tipped", "        if r.status != ACTIONABLE:\n            raise", "        if False:\n            raise"),
    ("bonus: zero accepted", '        if value <= 0:\n            raise gl.vm.UserError(E + "send some GEN as the bonus")', '        if value < 0:\n            raise gl.vm.UserError(E + "send some GEN as the bonus")'),
    ("bonus: not credited", "        self._credit(r.tester, value)\n        r.bonus", "        r.bonus"),
    # money out
    ("withdraw: the balance is not cleared", "        self.balances[me] = u256(0)\n", ""),
    ("withdraw: a zero balance still sends", '        if amount <= 0:\n            raise gl.vm.UserError(E + "nothing to withdraw")', '        if amount < 0:\n            raise gl.vm.UserError(E + "nothing to withdraw")'),
    ("close: before the end", "        if now < int(p.ends_at):", "        if False:"),
    ("close: with reports waiting", "        if waiting > 0:", "        if False:"),
    ("close: closes twice", '        if p.closed:\n            raise gl.vm.UserError(E + "this program is already closed")', '        if False:\n            raise gl.vm.UserError(E + "this program is already closed")'),
    ("close: the pool is not emptied", "        p.pool = u256(0)\n", ""),
    ("close: the program stays open", "        p.closed = True\n", ""),
    # views
    ("views: the queue pages from the wrong end", "            n -= start\n", ""),
    ("views: program 0 shows nothing", "        if int(program_id) == 0:", "        if False:"),
]

EXCLUDED = [
    "tests/test_static.py::test_generated_files_are_what_the_generator_writes",
    "tests/test_static.py::test_the_site_reads_the_frozen_deployment",
    "tests/test_static.py::test_no_private_key_in_the_repository",
]


def first_failure(output: str) -> str | None:
    for line in output.splitlines():
        match = re.match(r"FAILED (\S+)", line.strip())
        if match:
            return match.group(1).split(" - ")[0]
    return None


def main() -> int:
    source = CONTRACT.read_text(encoding="utf-8")
    rows: list[tuple[int, str, str]] = []
    escapes: list[str] = []
    with tempfile.TemporaryDirectory() as folder:
        mutant = pathlib.Path(folder) / "triage.py"
        for index, (what, old, new) in enumerate(MUTANTS, 1):
            count = source.count(old)
            if count != 1:
                raise SystemExit(f"mutant {index} ({what}) matches {count} places; it must match exactly one")
            mutant.write_text(source.replace(old, new), encoding="utf-8")
            env = dict(os.environ, TRIAGE_CONTRACT=str(mutant))
            command = [
                sys.executable, "-m", "pytest", "tests/test_direct.py", "tests/test_static.py",
                "-x", "-q", "--tb=no", "-rf", "-p", "no:cacheprovider",
            ] + [arg for test in EXCLUDED for arg in ("--deselect", test)]
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
            killer = first_failure(result.stdout)
            if result.returncode == 0 or killer is None:
                escapes.append(what)
                print(f"  {index:2} ESCAPED  {what}")
            else:
                rows.append((index, what, killer))
                print(f"  {index:2} killed   {what}  <- {killer}")
    if escapes:
        print(f"\n{len(escapes)} mutant(s) escaped; no table written:")
        for what in escapes:
            print(f"  - {what}")
        return 1
    if "--table" in sys.argv:
        target = ROOT / sys.argv[sys.argv.index("--table") + 1]
        lines = [
            "# Mutations",
            "",
            f"Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. {len(rows)} defences in",
            "`contracts/triage.py` were each broken on their own, and every mutant was caught. Each row",
            "names the first test that failed against it, read from pytest's report rather than an exit code.",
            "The generated-copy and deployed-record tests are excluded, because they fail for any edit at all.",
            "",
            "| # | defence broken | caught by |",
            "|---|---|---|",
        ] + [f"| {i} | {what} | `{killer}` |" for i, what, killer in rows]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        print(f"\nwrote {target.relative_to(ROOT).as_posix()}")
    print(f"\n{len(rows)} of {len(MUTANTS)} killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
