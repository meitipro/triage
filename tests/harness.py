"""
Loads the REAL contract file against the doubles in genvm_double.py.

Nothing is copied or re-implemented here, so a change to contracts/triage.py
is a change to what these tests exercise. The runner comment on the first lines
of the contract is ignored by CPython, so the file imports as ordinary Python.
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import os
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
#: TRIAGE_CONTRACT points the suite at a mutant; scripts/mutate.py sets it.
CONTRACT = pathlib.Path(os.environ.get("TRIAGE_CONTRACT") or ROOT / "contracts" / "triage.py")

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
HOUR = 3600
DAY = 86400
WEEK = 7 * DAY
REWARD = 8 * GEN
STAKE = 1 * GEN

#: 2026-10-01T00:00:00Z, a Thursday, so a week (seconds // WEEK) starts here. Every world starts here.
T0 = 1790812800

SCOPE = (
    "Swaps, token approvals and the fee preview on Base and Arbitrum, in the web and mobile apps. "
    "Not in scope: partner bridges, price feeds, and anything about the token or airdrop. "
    "Security issues go to security@orrin.example, never here."
)
SWAP_TITLE = "Swap button stays disabled after approving USDC"
SWAP_BODY = (
    "Steps: 1. Open swap on Base, USDC to ETH, 25 USDC. 2. Approve USDC and wait for the confirmation. "
    "3. The swap button stays grey.\nExpected: the button enables after the approval confirms.\n"
    "Actual: it stays disabled until the page is reloaded.\nEnvironment: Chrome 128, macOS 15, web app, reproduced twice."
)


def _install(gl: D.GL) -> None:
    """
    Publish a `genlayer` package shaped like py-genlayer:5jycge4q (Studio Next):
    the star import brings Address and the integer types, `import genlayer as gl`
    is the package itself, and the storage names live in genlayer.storage. An
    import the contract left out fails here rather than on chain.
    """
    storage = types.ModuleType("genlayer.storage")
    storage.TreeMap = D.TreeMap
    storage.DynArray = D.DynArray
    storage.allow = D.allow_storage
    module = types.ModuleType("genlayer")
    module.Address = D.Address
    for name in ("u8", "u16", "u32", "u64", "u256"):
        setattr(module, name, getattr(D, name))
    for name in ("contract", "vm", "message", "public", "nondet", "evm"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.__all__ = ["Address", "u8", "u16", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage


def load(gl: D.GL, path: pathlib.Path | None = None, name: str = "triage_contract") -> types.ModuleType:
    """Import the contract fresh against this gl."""
    _install(gl)
    spec = importlib.util.spec_from_file_location(name, path or CONTRACT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def answer(verdict: str, duplicate_of="", summary: str = "", reason: str = "") -> str:
    """A model answer, as the model would type it."""
    return json.dumps(
        {
            "verdict": verdict,
            "duplicate_of": duplicate_of,
            "summary": summary or f"A report judged {verdict.lower()}",
            "reason": reason or f"The report is {verdict.lower()}.",
        }
    )


class World:
    """
    One Triage contract and the accounts around it.

    Time is explicit: `at(seconds)` sets the transaction datetime the contract
    reads, because nothing on chain moves the clock on its own, and weekly caps
    and program ends are among the things these tests most need to control.
    """

    TEAM = "0x" + "0e" * 20
    MIRA = "0x" + "a1" * 20
    DIEGO = "0x" + "a2" * 20
    LENA = "0x" + "a3" * 20
    OMID = "0x" + "a4" * 20
    SPONSOR = "0x" + "5b" * 20
    STRANGER = "0x" + "d4" * 20

    def __init__(self) -> None:
        self.gl = D.GL()
        self.mod = load(self.gl)
        self.at(T0)
        self.sender(self.TEAM)
        self.c = self.mod.Triage()

    # -- controls ----------------------------------------------------------

    def at(self, seconds: int) -> "World":
        self.t = int(seconds)
        stamp = datetime.datetime.fromtimestamp(self.t, datetime.timezone.utc)
        self.gl.message.raw["datetime"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self

    def advance(self, seconds: int) -> "World":
        return self.at(self.t + seconds)

    def sender(self, address: str, value: int = 0) -> "World":
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.value = int(value)
        return self

    @property
    def leader(self) -> D.NodeWorld:
        return self.gl.nondet.leader

    @property
    def validators(self) -> list[D.NodeWorld]:
        return self.gl.nondet.validators

    # -- shorthands --------------------------------------------------------

    def open(self, name="Orrin Wallet beta", scope=SCOPE, reward: int = REWARD, stake: int = STAKE,
             cap: int = 5, days: int = 14, value: int = 100 * GEN, who=None) -> int:
        self.sender(who or self.TEAM, value)
        try:
            return int(self.c.open_program(name, scope, reward, stake, cap, days))
        finally:
            self.sender(who or self.TEAM)

    def fund(self, value: int, pid: int = 1, who=None) -> int:
        self.sender(who or self.SPONSOR, value)
        try:
            return int(self.c.fund(pid))
        finally:
            self.sender(who or self.SPONSOR)

    def file(self, who: str, title: str = SWAP_TITLE, body: str = SWAP_BODY, kind: str = "bug",
             pid: int = 1, value: int | None = None) -> int:
        self.sender(who, STAKE if value is None else value)
        try:
            return int(self.c.submit(pid, kind, title, body))
        finally:
            self.sender(who)

    def queue(self, verdict: str, duplicate_of="", validator_verdict=None, validator_dup=None, summary: str = "") -> None:
        """One model answer for the leader and one for each validator."""
        self.leader.answers.append(answer(verdict, duplicate_of, summary))
        for world in self.validators:
            world.answers.append(
                answer(validator_verdict or verdict, duplicate_of if validator_dup is None else validator_dup, summary)
            )

    def judge(self, rid: int, verdict: str | None = "ACTIONABLE", duplicate_of="", who=None,
              validator_verdict=None, validator_dup=None, summary: str = "") -> str:
        if verdict is not None:
            self.queue(verdict, duplicate_of, validator_verdict, validator_dup, summary)
        self.sender(who or self.STRANGER)
        try:
            return str(self.c.judge(rid))
        except Exception:
            # A judge that failed leaves no answers queued for the next one.
            for world in [self.leader, *self.validators]:
                world.answers.clear()
            raise

    def report(self, who: str, verdict: str = "ACTIONABLE", duplicate_of="", title: str = SWAP_TITLE,
               body: str = SWAP_BODY, kind: str = "bug", pid: int = 1, summary: str = "") -> int:
        """File and judge in one go. Returns the report id."""
        rid = self.file(who, title, body, kind, pid)
        self.judge(rid, verdict, duplicate_of, summary=summary)
        return rid

    def bonus(self, rid: int, value: int, who=None) -> int:
        self.sender(who or self.TEAM, value)
        try:
            return int(self.c.bonus(rid))
        finally:
            self.sender(who or self.TEAM)

    def withdraw(self, who: str) -> int:
        self.sender(who)
        return int(self.c.withdraw())

    def close(self, pid: int = 1, who=None) -> int:
        self.sender(who or self.TEAM)
        return int(self.c.close(pid))

    # -- reads -------------------------------------------------------------

    def program(self, pid: int = 1) -> dict:
        return json.loads(self.c.get_program(pid))

    def get(self, rid: int) -> dict:
        return json.loads(self.c.get_report(rid))

    def reports(self, pid: int = 1, status: str = "", offset: int = 0, limit: int = 50) -> dict:
        return json.loads(self.c.list_reports(pid, status, offset, limit))

    def stats(self, who: str) -> dict:
        return json.loads(self.c.tester_stats(who))

    def balance(self, who: str) -> int:
        return int(self.stats(who)["balance"])

    def paid_to(self, address: str) -> int:
        return sum(t.value for t in self.gl.bus.transfers if t.to.lower() == address.lower())

    def paid_out(self) -> int:
        return sum(t.value for t in self.gl.bus.transfers)

    def held(self) -> int:
        """What the contract should hold: every program's pool and reserve, every filed stake, every balance."""
        total = 0
        for pid in range(1, int(self.program(0)["programs"]) + 1):
            p = self.program(pid)
            total += int(p["pool"]) + int(p["reserved"])
        for rid in range(1, int(self.program(0)["reports_total"]) + 1):
            r = self.get(rid)
            if r["status"] == "FILED":
                total += int(r["stake"])
        for who in (self.MIRA, self.DIEGO, self.LENA, self.OMID, self.SPONSOR, self.STRANGER, self.TEAM):
            total += self.balance(who)
        return total


def refused(prefix: str, fn, *args, **kwargs) -> str:
    """Assert the call is refused, and that the refusal is the sentence it should be."""
    try:
        fn(*args, **kwargs)
    except D.UserError as error:
        message = str(error)
        assert message.startswith("[EXPECTED] "), f"unprefixed refusal: {message}"
        assert prefix in message, f"expected {prefix!r}, got {message!r}"
        return message
    raise AssertionError(f"expected a refusal containing {prefix!r}, nothing was raised")
