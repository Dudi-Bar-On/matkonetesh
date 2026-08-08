"""Proves mk_rules REJECTS an unknown mechanism value and a target-less mechanism (spec §1:
"ערך שאינו מהרשימה נדחה, לא מושמט") — and ACCEPTS the legal shapes. Live-store test, same
skip discipline as tests/test_rules_builder.py."""
from __future__ import annotations
from pathlib import Path
import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")
config = pytest.importorskip("src.rules_store.config")

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"

def _writer_conn():
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")
    try:
        return config.connect_writer()
    except psycopg2.OperationalError as exc:
        pytest.skip(f"mk_rules is not reachable ({str(exc).strip()[:80]})")

def _insert(cur, rule_id, mechanism, mechanism_target):
    cur.execute(
        "INSERT INTO rule_revisions (rule_id, statement, mechanism, mechanism_target, "
        "source_path, source_hash, revision_status, is_current) "
        "VALUES (%s, 'vocab test', %s, %s, 'test://vocab', 'h', 'current', false)",
        (rule_id, mechanism, mechanism_target))

def _clean(pg, rule_id):
    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg.commit()

def test_unknown_mechanism_is_rejected_not_ignored():
    pg = _writer_conn(); pg.autocommit = False
    _clean(pg, "TEST-VOCAB")
    with pytest.raises(psycopg2.errors.CheckViolation):
        with pg.cursor() as cur:
            _insert(cur, "TEST-VOCAB", "banana", "git commit")
        pg.commit()
    pg.rollback(); _clean(pg, "TEST-VOCAB"); pg.close()

def test_mechanism_without_target_is_rejected():
    pg = _writer_conn(); pg.autocommit = False
    _clean(pg, "TEST-VOCAB2")
    with pytest.raises(psycopg2.errors.CheckViolation):
        with pg.cursor() as cur:
            _insert(cur, "TEST-VOCAB2", "pretooluse:Bash", None)
        pg.commit()
    pg.rollback(); _clean(pg, "TEST-VOCAB2"); pg.close()

def test_legal_shapes_are_accepted():  # the counter-RED: the healthy cases must pass
    pg = _writer_conn(); pg.autocommit = False
    for rid, mech, tgt in [("TEST-VOCAB3", "pretooluse:Bash", "git commit"),
                           ("TEST-VOCAB4", "none", None),
                           ("TEST-VOCAB5", None, None)]:  # NULL = visibly unclassified, still legal
        _clean(pg, rid)
        with pg.cursor() as cur:
            _insert(cur, rid, mech, tgt)
        pg.commit(); _clean(pg, rid)
    pg.close()
