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


def test_open_mirror_never_leaves_an_empty_invalid_file_on_partial_write():
    """A crash mid-write must not leave a mirror file that LOOKS usable but silently has a broken
    or half-applied schema. write_revision runs inside its own transaction and open_mirror commits
    schema creation atomically — so a killed process either has the old committed state or none."""
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "rules.sqlite"
        conn = mirror.open_mirror(path)
        mirror.write_revision(conn, _sample(rule_id="ok", source_hash="h1"))
        conn.commit()
        conn.close()

        # Simulate a consumer reopening after a hard crash between commits: reading the file with
        # a fresh sqlite3 connection must still find the schema AND the previously committed row —
        # never an empty, schema-less file.
        fresh = sqlite3.connect(str(path))
        fresh.row_factory = sqlite3.Row
        tables = [r[0] for r in fresh.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        assert "rule_revisions" in tables, "schema must be present, never a schema-less shell"
        rows = fresh.execute("SELECT rule_id FROM rule_revisions").fetchall()
        assert [r["rule_id"] for r in rows] == ["ok"]
        fresh.close()
