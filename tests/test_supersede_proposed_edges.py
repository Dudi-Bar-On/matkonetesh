"""R-136 Half 1: scripts/supersede-proposed-edges.py must never write outside a transaction it can
roll back, must refuse --apply on a count mismatch, and must never issue anything but a status flip.

Neo4j is NOT available in this test (no live driver, no credentials) — a fake driver/session/
transaction stands in, modeling exactly the two things the real Cypher does: read a count by
`status`, and move `proposed` -> `superseded` only when a transaction commits. This proves the
SCRIPT'S OWN control flow (dry-run rolls back / apply commits / mismatch stops before any write is
attempted) independently of whether Neo4j itself is reachable in a given environment.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts import supersede_proposed_edges as sp  # noqa: E402


class _Result:
    def __init__(self, n):
        self._n = n

    def single(self):
        return {"n": self._n}


class FakeTx:
    """Models one Neo4j transaction. `run()` STAGES the flip; nothing is visible to the
    session's live counts until `commit()`. `rollback()` discards the stage — this is the exact
    property the script's dry-run mode depends on."""

    def __init__(self, session):
        self.session = session
        self.staged = None  # None = not run yet; else the count that would flip
        self.committed = False
        self.rolled_back = False

    def run(self, cypher, **params):
        assert "reason" in params, "the write must carry a superseded_reason, not a bare status flip"
        assert "MATCH ()-[r]->()" in cypher and "SET r.status = 'superseded'" in cypher
        assert "DELETE" not in cypher.upper(), "the irreversible thing: this must never contain DELETE"
        self.staged = self.session.state["proposed"]
        return _Result(self.staged)

    def commit(self):
        assert self.staged is not None, "commit() called before run()"
        n = self.staged
        self.session.state["proposed"] -= n
        self.session.state["superseded"] += n
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class FakeSession:
    def __init__(self, proposed: int, superseded: int):
        self.state = {"proposed": proposed, "superseded": superseded}
        self.transactions: list[FakeTx] = []

    def run(self, cypher, **params):
        assert cypher.strip().startswith("MATCH ()-[r]->() WHERE r.status")
        return _Result(self.state[params["status"]])

    def begin_transaction(self):
        tx = FakeTx(self)
        self.transactions.append(tx)
        return tx

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeDriver:
    def __init__(self, session: FakeSession):
        self._session = session
        self.closed = False

    def session(self):
        return self._session

    def close(self):
        self.closed = True


def _wire(monkeypatch, proposed=16456, superseded=9078):
    session = FakeSession(proposed, superseded)
    driver = FakeDriver(session)
    monkeypatch.setattr(sp.config, "neo4j_driver", lambda: driver)
    return session, driver


def test_dry_run_rolls_back_and_leaves_live_counts_untouched(monkeypatch):
    session, driver = _wire(monkeypatch, proposed=16456, superseded=9078)

    rc = sp.run(apply=False, expect=16456, force=False)

    assert rc == 0
    assert session.state == {"proposed": 16456, "superseded": 9078}, (
        "a dry run must not change the live counts"
    )
    assert session.transactions[-1].rolled_back is True
    assert session.transactions[-1].committed is False
    assert driver.closed is True, "the driver connection must be closed even on a dry run"


def test_apply_commits_and_flips_every_proposed_edge_to_superseded(monkeypatch):
    session, _ = _wire(monkeypatch, proposed=16456, superseded=9078)

    rc = sp.run(apply=True, expect=16456, force=False)

    assert rc == 0
    assert session.state == {"proposed": 0, "superseded": 9078 + 16456}, (
        "every proposed edge must become superseded, and only that — no edge is lost, "
        f"got {session.state}"
    )
    assert session.transactions[-1].committed is True
    assert session.transactions[-1].rolled_back is False


def test_a_count_mismatch_refuses_to_apply_and_makes_no_write_attempt(monkeypatch):
    """The measured number is 16,456. If the live count has drifted (the corpus was described as
    'still growing' at measurement time), --apply must STOP rather than run against a different
    set than the one that was measured and approved."""
    session, _ = _wire(monkeypatch, proposed=20000, superseded=9078)

    rc = sp.run(apply=True, expect=16456, force=False)

    assert rc == 1
    assert session.transactions == [], "no transaction may even be opened on a mismatch"
    assert session.state == {"proposed": 20000, "superseded": 9078}, "state must be completely untouched"


def test_force_skips_only_the_count_check_never_the_apply_flag(monkeypatch):
    """--force overrides the --expect comparison, but --apply is still what decides commit vs
    rollback — force must not silently upgrade a dry run into a write."""
    session, _ = _wire(monkeypatch, proposed=20000, superseded=9078)

    rc = sp.run(apply=False, expect=16456, force=True)

    assert rc == 0
    assert session.transactions[-1].rolled_back is True
    assert session.state == {"proposed": 20000, "superseded": 9078}, (
        "force + no --apply must still be a no-op on live state"
    )


def test_the_cypher_never_touches_a_node_or_the_schema(monkeypatch):
    """Static assertion on the query text itself — the one place a future edit could silently
    reintroduce a DETACH DELETE or a node mutation."""
    assert "DELETE" not in sp.CYPHER.upper()
    assert "DROP" not in sp.CYPHER.upper()
    assert "REMOVE" not in sp.CYPHER.upper()
    assert "CREATE CONSTRAINT" not in sp.CYPHER.upper()
    assert "MERGE (a" not in sp.CYPHER and "MERGE (b" not in sp.CYPHER, (
        "this script updates existing relationships only; it must never create nodes"
    )
