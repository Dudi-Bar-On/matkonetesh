"""Proves src/rules_store/mirror.py — the SQLite mirror (rules.sqlite) that enforcement hooks
read directly, never Postgres, so an unreachable mk_rules cannot disarm enforcement (spec: Task 4
of the 2026-08-06 rules-store-and-watchman arc). Pure sqlite3, no Postgres involved.

Lives in tests/ (not scripts/tests/) SPECIFICALLY so check-pytest.mjs collects it (tests/test_*.py,
underscore prefix, root tests/ dir) — a Python test nothing collects is invisible until the day it
matters.
"""
from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

from src.rules_store import mirror


def _sample(rule_id="10.17", source_hash="abc123", **overrides):
    record = {
        "rule_id": rule_id,
        "section": "10",
        "title_he": "Serena",
        "statement": "Maximize Serena.",
        "bucket": None,
        "severity": None,
        "mechanism": None,
        "source_path": "docs/process/development-discipline.md",
        "source_heading": "10.17",
        "source_hash": source_hash,
        "revision_status": "current",
    }
    record.update(overrides)
    return record


def test_write_then_read_current():
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        try:
            mirror.write_revision(conn, _sample())
            rows = mirror.read_current(conn)
            assert len(rows) == 1, f"expected 1 current row, got {len(rows)}"
            assert rows[0]["rule_id"] == "10.17"
            assert rows[0]["source_hash"] == "abc123"
        finally:
            conn.close()


def test_write_revision_upserts_by_rule_id_not_duplicates():
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        try:
            mirror.write_revision(conn, _sample(source_hash="abc123"))
            mirror.write_revision(conn, _sample(source_hash="def456"))
            rows = mirror.read_current(conn)
            assert len(rows) == 1, f"expected upsert to keep 1 row for rule_id, got {len(rows)}"
            assert rows[0]["source_hash"] == "def456"
        finally:
            conn.close()


def test_checksum_changes_when_a_row_changes():
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        try:
            mirror.write_revision(conn, _sample(source_hash="abc123"))
            c1 = mirror.checksum(conn)
            mirror.write_revision(conn, _sample(source_hash="def456"))
            c2 = mirror.checksum(conn)
            assert c1 != c2, "checksum must change when a row's source_hash changes"
        finally:
            conn.close()


def test_checksum_changes_when_statement_changes_but_source_hash_does_not():
    """Fix round 1, 2026-08-06 — review finding, Critical: the original digest covered only
    (rule_id, source_hash), so a row whose STATEMENT (the text the enforcement hooks actually
    read) was corrupted while source_hash stayed put reported as healthy. This is the regression
    test for that exact blind spot — same source_hash, different statement, must move the digest."""
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        try:
            mirror.write_revision(conn, _sample(source_hash="abc123", statement="Maximize Serena."))
            c1 = mirror.checksum(conn)
            mirror.write_revision(conn, _sample(source_hash="abc123", statement="Something else entirely."))
            c2 = mirror.checksum(conn)
            assert c1 != c2, (
                "checksum must change when statement changes even though source_hash is unchanged "
                "(the exact blind spot fix round 1 closed)"
            )
        finally:
            conn.close()


def test_checksum_changes_when_severity_or_bucket_changes_but_source_hash_does_not():
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        try:
            mirror.write_revision(conn, _sample(source_hash="abc123", severity="warn", bucket="A"))
            c1 = mirror.checksum(conn)
            mirror.write_revision(conn, _sample(source_hash="abc123", severity="block", bucket="A"))
            c2 = mirror.checksum(conn)
            assert c1 != c2, "checksum must change when severity changes even though source_hash is unchanged"

            mirror.write_revision(conn, _sample(source_hash="abc123", severity="block", bucket="C"))
            c3 = mirror.checksum(conn)
            assert c3 != c2, "checksum must change when bucket changes even though source_hash is unchanged"
        finally:
            conn.close()


def test_checksum_of_rows_is_the_single_shared_formula():
    """The digest formula lives in ONE function so the SQLite side (checksum(), via conn) and the
    Postgres side (check-rules-mirror.mjs's inline query, via a plain list of tuples) cannot desync
    from each other by a format-string edit landing on only one of them. This proves checksum()
    IS checksum_of_rows() under the hood, not a parallel re-implementation of it."""
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        try:
            mirror.write_revision(conn, _sample(rule_id="A", source_hash="h1", statement="s1", severity="warn", bucket="A"))
            mirror.write_revision(conn, _sample(rule_id="B", source_hash="h2", statement="s2", severity=None, bucket=None))
            from_conn = mirror.checksum(conn)
        finally:
            conn.close()

        # The exact same tuples, fed straight to the shared formula — as a Postgres cursor's
        # fetchall() would hand them, no sqlite3.Row involved.
        rows = [
            ("A", "h1", "s1", "warn", "A"),
            ("B", "h2", "s2", None, None),
        ]
        from_rows = mirror.checksum_of_rows(rows)
        assert from_conn == from_rows, "checksum() must delegate to checksum_of_rows(), not re-implement it"


def test_checksum_is_stable_for_identical_content():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "rules.sqlite"
        conn = mirror.open_mirror(path)
        mirror.write_revision(conn, _sample(rule_id="A", source_hash="h1"))
        mirror.write_revision(conn, _sample(rule_id="B", source_hash="h2"))
        c1 = mirror.checksum(conn)
        conn.close()

        conn2 = mirror.open_mirror(path)
        c2 = mirror.checksum(conn2)
        conn2.close()
        assert c1 == c2, "checksum must be deterministic across connections for the same content"


def test_an_abandoned_uncommitted_write_does_not_reach_the_mirror():
    """Simulates a process that crashes mid-write: a SECOND connection opens a transaction, writes
    a row, and is abandoned (closed) without ever calling commit(). The first connection's view —
    and a completely fresh connection's view — must show the abandoned row is simply absent, the
    schema and prior committed data are intact, and the mirror is still fully usable afterwards
    (both readable and writable), not merely "unchanged"."""
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "rules.sqlite"
        conn = mirror.open_mirror(path)
        mirror.write_revision(conn, _sample(rule_id="committed", source_hash="h0"))
        baseline_checksum = mirror.checksum(conn)

        # A second connection begins an implicit transaction on INSERT and is closed without
        # commit() — this is what a killed process leaves behind.
        second = sqlite3.connect(str(path))
        second.execute(
            "INSERT INTO rule_revisions (rule_id, statement, source_path, source_hash, revision_status) "
            "VALUES (?, ?, ?, ?, ?)",
            ("abandoned", "must never be visible", "x.md", "deadbeef", "current"),
        )
        second.close()  # no commit() — the write is abandoned, exactly like a killed process

        rows = mirror.read_current(conn)
        assert [r["rule_id"] for r in rows] == ["committed"], (
            f"an abandoned, uncommitted write leaked into the mirror: {[r['rule_id'] for r in rows]}"
        )
        assert mirror.checksum(conn) == baseline_checksum, "checksum moved from an uncommitted write"

        # Prove the mirror is still USABLE, not merely unchanged: write and read again.
        mirror.write_revision(conn, _sample(rule_id="after", source_hash="h1"))
        rows_after = mirror.read_current(conn)
        assert sorted(r["rule_id"] for r in rows_after) == ["after", "committed"]
        conn.close()

        # And a completely fresh connection (simulating the next process to open the file) sees
        # exactly the same thing — schema intact, abandoned row absent, later write present.
        fresh = sqlite3.connect(str(path))
        fresh.row_factory = sqlite3.Row
        tables = [r[0] for r in fresh.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        assert "rule_revisions" in tables, "schema must be present, never a schema-less shell"
        fresh_rows = fresh.execute("SELECT rule_id FROM rule_revisions ORDER BY rule_id").fetchall()
        assert [r["rule_id"] for r in fresh_rows] == ["after", "committed"]
        fresh.close()
