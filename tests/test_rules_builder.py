"""Proves builder.sync_rule's four-step write order (spec §4.5): a rule is never half-active.

This lives in tests/ (not scripts/tests/) SPECIFICALLY so check-pytest.mjs collects it — see
tests/test_current_requires_mirror.py for the precedent this follows. Until Task 8 lands
src/rules_store/builder.py, this SKIPS with a stated reason via pytest.importorskip; once that
module exists, it runs for real.

The core assertion simulates a crash BETWEEN the mirror write and the flip-to-current (steps 2 and
3/4) via an injected fault (builder.sync_rule(..., _fail_after_mirror_write=True)) — not a clean
run reopened, which Task 4 already proved is a void test for this class of guarantee. GREEN here
means: the pre-mirror INSERT (is_current=false) is the only thing that ever committed, and the row
stays is_current=false — inactive, never half-active — even though the mirror write itself
succeeded before the fault fired.
"""
from __future__ import annotations

from pathlib import Path

import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")
config = pytest.importorskip(
    "src.rules_store.config",
    reason="src/rules_store/config.py does not exist yet — lands in Task 3; this test is dormant, not broken",
)
mirror = pytest.importorskip(
    "src.rules_store.mirror",
    reason="src/rules_store/mirror.py does not exist yet — lands in Task 4; this test is dormant, not broken",
)
extractor = pytest.importorskip(
    "src.rules_store.extractor",
    reason="src/rules_store/extractor.py does not exist yet — lands in Task 5-7; this test is dormant, not broken",
)
builder = pytest.importorskip(
    "src.rules_store.builder",
    reason="src/rules_store/builder.py does not exist yet — lands in Task 8; this test is dormant, not broken",
)

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"


def _writer_conn():
    try:
        return config.connect_writer()
    except psycopg2.OperationalError as exc:
        pytest.skip(f"mk_rules is not reachable ({str(exc).strip()[:80]})")


def _clean(pg_conn, rule_id: str) -> None:
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg_conn.commit()


def test_crash_between_mirror_write_and_flip_leaves_rule_inactive(tmp_path):
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "TEST-CRASH")

    tmp = tmp_path / "_tmp_crash_mirror.sqlite"
    m = mirror.open_mirror(tmp)

    rec = extractor.RuleRecord(
        rule_id="TEST-CRASH", section="TEST", title_he="crash test", statement="crash test rule",
        source_heading="test", content_hash="crashhash",
    )
    try:
        builder.sync_rule(pg, m, rec, _fail_after_mirror_write=True)
        assert False, "expected the injected fault to raise"
    except builder.SimulatedCrash:
        pass

    with pg.cursor() as cur:
        cur.execute(
            "SELECT is_current, mirrored_at FROM rule_revisions WHERE rule_id = %s "
            "ORDER BY created_at DESC LIMIT 1",
            ("TEST-CRASH",),
        )
        row = cur.fetchone()
    assert row is not None, "the pre-mirror insert (is_current=false) must have committed"
    is_current, mirrored_at = row
    assert is_current is False, f"row must stay INACTIVE after a simulated crash, got is_current={is_current}"

    # The mirror write itself DID succeed before the fault fired — proving the row is inactive
    # despite the mirror already having the data is the whole point of injecting the fault AFTER
    # step 2 rather than before it.
    mirror_rows = mirror.read_current(m)
    assert any(r["rule_id"] == "TEST-CRASH" for r in mirror_rows), (
        "the mirror write (step 2) should have succeeded before the injected fault"
    )

    _clean(pg, "TEST-CRASH")
    pg.close()


def test_sync_rule_happy_path_activates_the_rule(tmp_path):
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "TEST-HAPPY")

    tmp = tmp_path / "_tmp_happy_mirror.sqlite"
    m = mirror.open_mirror(tmp)

    rec = extractor.RuleRecord(
        rule_id="TEST-HAPPY", section="TEST", title_he="happy path", statement="happy path rule",
        source_heading="test", content_hash="happyhash",
    )
    revision_id = builder.sync_rule(pg, m, rec)
    assert isinstance(revision_id, str) and revision_id

    with pg.cursor() as cur:
        cur.execute(
            "SELECT is_current, mirrored_at FROM rule_revisions WHERE revision_id = %s",
            (revision_id,),
        )
        is_current, mirrored_at = cur.fetchone()
    assert is_current is True, "a clean sync must flip is_current true"
    assert mirrored_at is not None, "a clean sync must set mirrored_at"

    mirror_rows = mirror.read_current(m)
    assert any(r["rule_id"] == "TEST-HAPPY" for r in mirror_rows), "the mirror must hold the new rule"

    _clean(pg, "TEST-HAPPY")
    pg.close()
