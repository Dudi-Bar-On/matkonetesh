"""Proves `config.connect_reader()` in `src.rules_store` cannot write — task 3's hard constraint
("connect_reader() must connect as rules_reader and must NOT be able to write. Prove it.").

Two independent barriers are exercised together, on purpose: rules_reader has no INSERT grant on
rule_revisions (0001/0002), and connect_reader() additionally sets the session to
READ ONLY. Either one alone would block the write below; this test does not care which one fires,
only that the write is refused.
"""

from __future__ import annotations

from pathlib import Path

import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")
config = pytest.importorskip(
    "src.rules_store.config",
    reason="src/rules_store/config.py does not exist yet",
)

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"


def test_reader_connection_cannot_insert():
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    try:
        conn = config.connect_reader()
    except psycopg2.OperationalError as exc:
        pytest.skip(f"mk_rules is not reachable ({str(exc).strip()[:80]})")

    try:
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO rule_revisions
                        (rule_id, statement, source_path, source_hash, revision_status, is_current)
                    VALUES
                        ('TEST-READER-WRITE', 'should never insert', 'test.md', 'deadbeef', 'current', false)
                    """
                )
    finally:
        conn.rollback()
        conn.close()
