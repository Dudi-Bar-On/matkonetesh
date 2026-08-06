"""Proves `current_requires_mirror` on the mk_rules `rule_revisions` table — a rule revision
cannot be marked current until it has reached the SQLite mirror (spec §4.3; the exact analogue of
the geniza's own `current_requires_both_sides`, tested in test_pg_schema.py).

This lives in tests/ (not scripts/tests/) SPECIFICALLY so check-pytest.mjs collects it — a Python
test nothing collects is invisible until the day it matters (the shape L18/L54 already name for
this project). Until Task 3 lands `src/rules_store/config.py`, this SKIPS with a stated reason
via `pytest.importorskip`; once that module exists, it runs for real and turns GREEN on its own —
no human needs to remember to run it by hand.
"""

from __future__ import annotations

from pathlib import Path

import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")
config = pytest.importorskip(
    "src.rules_store.config",
    reason="src/rules_store/config.py does not exist yet — lands in Task 3; this test is dormant, not broken",
)

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"


def _writer_conn():
    try:
        return config.connect_writer()
    except psycopg2.OperationalError as exc:
        pytest.skip(f"mk_rules is not reachable ({str(exc).strip()[:80]})")


def test_current_true_without_mirrored_at_is_rejected():
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    conn = _writer_conn()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rule_revisions
                    (rule_id, statement, source_path, source_hash, revision_status, is_current, mirrored_at)
                VALUES
                    ('TEST-ILLEGAL', 'illegal row', 'test.md', 'deadbeef', 'current', true, NULL)
                """
            )
        conn.commit()
        assert False, "expected IntegrityError: current_requires_mirror, insert succeeded instead"
    except psycopg2.errors.CheckViolation as exc:
        assert "current_requires_mirror" in str(exc), f"wrong constraint fired: {exc}"
        conn.rollback()
    finally:
        conn.close()
