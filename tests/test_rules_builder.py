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


def test_recovers_to_single_active_row_after_a_crash(tmp_path):
    """Fix round 1 (review, Important): the crash test above proves the row stays INACTIVE, but
    never proves the system can RECOVER from that crash — a claim this project treats as distinct
    (recoverable and leaves-no-garbage are different claims, and only one was tested). Crash once
    via the same fault injection, then call sync_rule again for the SAME rule_id and assert the
    rule ends up genuinely active: exactly one is_current=true row with mirrored_at set, the crashed
    orphan re-labelled 'superseded' (not left contradicting itself as revision_status='current'
    while is_current=false), and the mirror agreeing with Postgres."""
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "TEST-RECOVER")

    tmp = tmp_path / "_tmp_recover_mirror.sqlite"
    m = mirror.open_mirror(tmp)

    rec = extractor.RuleRecord(
        rule_id="TEST-RECOVER", section="TEST", title_he="recover test", statement="recover test rule",
        source_heading="test", content_hash="recoverhash",
    )

    # Crash once — leaves the orphan (is_current=false, revision_status='current').
    try:
        builder.sync_rule(pg, m, rec, _fail_after_mirror_write=True)
        assert False, "expected the injected fault to raise"
    except builder.SimulatedCrash:
        pass

    # Recover: a plain re-run for the same rule_id, no special recovery call.
    revision_id = builder.sync_rule(pg, m, rec)
    assert isinstance(revision_id, str) and revision_id

    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_id, revision_status, is_current, mirrored_at FROM rule_revisions "
            "WHERE rule_id = %s ORDER BY created_at",
            ("TEST-RECOVER",),
        )
        rows = cur.fetchall()
    assert len(rows) == 2, f"expected the crashed orphan plus the recovered row, got {rows}"

    orphan, recovered = rows
    assert orphan[1] == "superseded", (
        f"the crashed orphan must be relabelled 'superseded' so its status stops contradicting "
        f"is_current=false, got revision_status={orphan[1]!r}"
    )
    assert orphan[2] is False

    assert str(recovered[0]) == revision_id
    assert recovered[1] == "current"
    assert recovered[2] is True, "the recovered row must be genuinely active (is_current=true)"
    assert recovered[3] is not None, "the recovered row must have mirrored_at set"

    active_rows = [r for r in rows if r[2] is True]
    assert len(active_rows) == 1, f"exactly one active row must exist after recovery, got {active_rows}"

    mirror_rows = [r for r in mirror.read_current(m) if r["rule_id"] == "TEST-RECOVER"]
    assert len(mirror_rows) == 1, "the mirror must agree: exactly one current row for this rule_id"
    assert mirror_rows[0]["source_hash"] == "recoverhash"

    _clean(pg, "TEST-RECOVER")
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


# ---------------------------------------------------------------------------------------------
# Task 9: sync_document — the whole-document lifecycle (added / updated / unchanged / retired)
# built on top of Task 8's sync_rule. Each test drives sync_document through extract_rules() on a
# tiny synthetic document (never the real 14.6k-line discipline doc — fixture minimality, DoD-6),
# using rule_ids "10.99"/"10.98" (unused section numbers, matching the extractor's own heading
# grammar `\d+(?:\.\d+)*[a-z]?` — a "TEST-LC"-style id would never be recognised as a section
# heading at all) so they can never collide with a real document rule.
# ---------------------------------------------------------------------------------------------

SOURCE_PATH = "docs/process/development-discipline.md"


def _fresh_mirror(tmp_path, name: str):
    return mirror.open_mirror(tmp_path / name)


def test_sync_document_added_creates_revision_1_current(tmp_path):
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "10.99")
    m = _fresh_mirror(tmp_path, "_tmp_lc_added.sqlite")
    doc = "### 10.99 Added rule\n\nfirst statement.\n"
    result = builder.sync_document(pg, m, doc, SOURCE_PATH)
    assert result["added"] == ["10.99"], result
    assert result["updated"] == [] and result["unchanged"] == [] and result["retired"] == []
    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current FROM rule_revisions WHERE rule_id = %s", ("10.99",)
        )
        status, is_current = cur.fetchone()
    assert status == "current" and is_current is True
    m.close()
    _clean(pg, "10.99")
    pg.close()


def test_sync_document_updated_supersedes_old_revision(tmp_path):
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "10.99")
    m = _fresh_mirror(tmp_path, "_tmp_lc_updated.sqlite")
    builder.sync_document(pg, m, "### 10.99 Rule\n\nfirst statement.\n", SOURCE_PATH)
    result = builder.sync_document(
        pg, m, "### 10.99 Rule\n\nSECOND statement, changed.\n", SOURCE_PATH
    )
    assert result["updated"] == ["10.99"], result
    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, statement FROM rule_revisions "
            "WHERE rule_id = %s ORDER BY created_at",
            ("10.99",),
        )
        rows = cur.fetchall()
    assert len(rows) == 2, f"expected old + new revision, got {rows}"
    assert rows[0][0] == "superseded" and rows[0][1] is False
    assert rows[1][0] == "current" and rows[1][1] is True and "SECOND" in rows[1][2]

    # The superseded revision must never disagree with itself (Task 8's own paid-for lesson):
    # revision_status and is_current must always point the same way.
    for status, is_current, _stmt in rows:
        assert (status == "current") == bool(is_current), (
            f"a row's revision_status and is_current must agree, got {status!r}/{is_current!r}"
        )

    # The old, superseded revision is KEPT — still queryable directly by rule_id — not deleted.
    assert len(rows) == 2
    m.close()
    _clean(pg, "10.99")
    pg.close()


def test_sync_document_unchanged_is_a_noop(tmp_path):
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "10.99")
    m = _fresh_mirror(tmp_path, "_tmp_lc_unchanged.sqlite")
    doc = "### 10.99 Rule\n\nstable statement.\n"
    builder.sync_document(pg, m, doc, SOURCE_PATH)
    result = builder.sync_document(pg, m, doc, SOURCE_PATH)
    assert result["unchanged"] == ["10.99"], result
    assert result["added"] == [] and result["updated"] == [] and result["retired"] == []
    with pg.cursor() as cur:
        cur.execute("SELECT count(*) FROM rule_revisions WHERE rule_id = %s", ("10.99",))
        (n,) = cur.fetchone()
    assert n == 1, f"an unchanged sync must not create a second revision row, found {n}"
    m.close()
    _clean(pg, "10.99")
    pg.close()


def test_sync_document_removed_from_document_is_retired_not_deleted(tmp_path):
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "10.99")
    _clean(pg, "10.98")
    m = _fresh_mirror(tmp_path, "_tmp_lc_retired.sqlite")
    builder.sync_document(pg, m, "### 10.99 Rule\n\nwill be removed.\n", SOURCE_PATH)
    result = builder.sync_document(pg, m, "### 10.98 Unrelated\n\nsomething else.\n", SOURCE_PATH)
    assert result["retired"] == ["10.99"], result
    assert result["added"] == ["10.98"]

    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, retired_at FROM rule_revisions WHERE rule_id = %s",
            ("10.99",),
        )
        status, is_current, retired_at = cur.fetchone()
    assert status == "retired" and is_current is False and retired_at is not None

    # The retired rule is not deleted — it stays QUERYABLE directly by rule_id, with its
    # original statement intact, exactly the geniza guarantee this task exists to uphold: a
    # hook meeting a reference to a retired rule can say "retired on <date>", not fail silently.
    with pg.cursor() as cur:
        cur.execute(
            "SELECT statement FROM rule_revisions WHERE rule_id = %s AND revision_status = 'retired'",
            ("10.99",),
        )
        (statement,) = cur.fetchone()
    assert "will be removed" in statement

    # The mirror holds current rules only — a retired rule_id must be gone from it.
    assert not [r for r in mirror.read_current(m) if r["rule_id"] == "10.99"]

    m.close()
    _clean(pg, "10.99")
    _clean(pg, "10.98")
    pg.close()


# ---------------------------------------------------------------------------------------------
# Fix round 1 (2026-08-06 — Critical, found by the controller against the live database, from an
# empty rule_revisions table): sync_document's own classification (`WHERE source_path = %s`)
# never matched a rule sync_rule had actually written, because sync_rule hardcoded source_path to
# the discipline-doc literal regardless of what was passed in. A rule already current under ANY
# other source_path was misclassified as "added" on the next sync, and the second sync_rule call
# collided with the still-current first row on `one_current_revision_per_rule`
# (psycopg2.errors.UniqueViolation). This is the controller's exact reproduction, run against a
# source_path this file's OTHER tests never use (so it cannot be masked by them matching the old
# hardcoded literal by coincidence).
# ---------------------------------------------------------------------------------------------

PROBE_SOURCE_PATH = "probe90.md"


def _assert_rule_invariants(pg_conn, rule_id: str) -> None:
    """No row for `rule_id` may have revision_status='current' while is_current=false, and at
    most one row for `rule_id` may have is_current=true — asserted directly against Postgres,
    the same two facts the `current_requires_mirror`/`one_current_revision_per_rule` constraints
    are meant to make impossible to violate in a COMMITTED state."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current FROM rule_revisions WHERE rule_id = %s", (rule_id,)
        )
        rows = cur.fetchall()
    for status, is_current in rows:
        assert (status == "current") == bool(is_current), (
            f"{rule_id}: revision_status/is_current disagree — {status!r}/{is_current!r}"
        )
    current_rows = [r for r in rows if r[1]]
    assert len(current_rows) <= 1, f"{rule_id}: more than one current row — {rows}"


def test_sync_document_updates_a_rule_that_is_already_current(tmp_path):
    """The controller's exact reproduction: sync a two-rule document, then sync a second version
    where rule 90 changed and rule 91 was removed — against an EMPTY rule_revisions table, using a
    source_path ('probe90.md') distinct from every other test in this file."""
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "90")
    _clean(pg, "91")
    m = _fresh_mirror(tmp_path, "_tmp_probe90.sqlite")

    d1 = "## 90. Alpha\n\nFirst body.\n\n## 91. Beta\n\nSecond body.\n"
    d2 = "## 90. Alpha\n\nCHANGED body.\n"  # 90 updated, 91 removed

    r1 = builder.sync_document(pg, m, d1, PROBE_SOURCE_PATH)
    assert r1["added"] == ["90", "91"], r1
    _assert_rule_invariants(pg, "90")
    _assert_rule_invariants(pg, "91")

    r2 = builder.sync_document(pg, m, d2, PROBE_SOURCE_PATH)
    assert r2["updated"] == ["90"], r2
    assert r2["retired"] == ["91"], r2
    _assert_rule_invariants(pg, "90")
    _assert_rule_invariants(pg, "91")

    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, statement FROM rule_revisions "
            "WHERE rule_id = %s ORDER BY created_at",
            ("90",),
        )
        rows = cur.fetchall()
    assert len(rows) == 2, f"expected old + new revision for rule 90, got {rows}"
    assert rows[0][0] == "superseded" and rows[0][1] is False
    assert rows[1][0] == "current" and rows[1][1] is True and "CHANGED" in rows[1][2]

    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, retired_at FROM rule_revisions WHERE rule_id = %s",
            ("91",),
        )
        status, is_current, retired_at = cur.fetchone()
    assert status == "retired" and is_current is False and retired_at is not None

    m.close()
    _clean(pg, "90")
    _clean(pg, "91")
    pg.close()
