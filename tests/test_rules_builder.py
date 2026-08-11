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

import tempfile
from pathlib import Path

import pytest

from conftest import requires_database

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
    # Task 11 (2026-08-11): the single ConfigError gap in this file — every other caller here
    # checked `ENV_FILE.exists()` before reaching this helper; test_resync_preserves_mechanism_
    # classification did not, so it crashed on ConfigError in CI instead of skipping. Probing
    # CONFIGURATION here, once, closes it for every caller rather than for that one sibling.
    requires_database("mk_rules")
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
        builder.sync_rule(pg, m, rec, source_path=builder.DEFAULT_SOURCE_PATH, _fail_after_mirror_write=True)
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
        builder.sync_rule(pg, m, rec, source_path=builder.DEFAULT_SOURCE_PATH, _fail_after_mirror_write=True)
        assert False, "expected the injected fault to raise"
    except builder.SimulatedCrash:
        pass

    # Recover: a plain re-run for the same rule_id, no special recovery call.
    revision_id = builder.sync_rule(pg, m, rec, source_path=builder.DEFAULT_SOURCE_PATH)
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
    revision_id = builder.sync_rule(pg, m, rec, source_path=builder.DEFAULT_SOURCE_PATH)
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


def test_sync_rule_writes_bucket_to_postgres_not_just_the_mirror(tmp_path):
    """Fix round 2, 2026-08-06 — review finding, Critical: sync_rule's Postgres INSERT column
    list never named `bucket` (nor `severity`/`mechanism`) at all, so every current row's
    `bucket` was NULL in mk_rules — the source of truth — even though the SAME record's `bucket`
    reached the mirror correctly (mirror_mod.write_revision already read `record.bucket`). This
    was invisible until check-rules-mirror's digest (Task 13, fix round 1) started covering the
    `bucket` column and a self-heal (`rebuild_mirror_from_postgres`) silently overwrote a mirror
    that legitimately held 'process' with NULL read back from Postgres — a self-heal that
    destroyed real data.

    The assertion is on what comes BACK OUT of Postgres via a fresh SELECT, not on what was
    passed into sync_rule — asserting the input would not have caught this: the record's `bucket`
    field was always correct in Python, the INSERT silently dropped it on the way into the
    database, and only a real round-trip through Postgres proves the column was actually written.
    """
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "TEST-BUCKET")

    tmp = tmp_path / "_tmp_bucket_mirror.sqlite"
    m = mirror.open_mirror(tmp)

    # bucket="content" (not the dataclass default "process") so a test that accidentally read a
    # default-initialized value instead of a real round-trip could not pass by coincidence.
    rec = extractor.RuleRecord(
        rule_id="TEST-BUCKET", section="TEST", title_he="bucket round-trip test",
        statement="bucket round-trip test rule", source_heading="test",
        content_hash="buckethash", bucket="content",
    )
    revision_id = builder.sync_rule(pg, m, rec, source_path=builder.DEFAULT_SOURCE_PATH)

    with pg.cursor() as cur:
        cur.execute("SELECT bucket FROM rule_revisions WHERE revision_id = %s", (revision_id,))
        (bucket,) = cur.fetchone()
    assert bucket == "content", (
        f"bucket must round-trip through Postgres, got {bucket!r} — "
        "the INSERT must actually write the bucket column, not silently drop it"
    )

    _clean(pg, "TEST-BUCKET")
    pg.close()


# ---------------------------------------------------------------------------------------------
# Task 9: sync_document — the whole-document lifecycle (added / updated / unchanged / retired)
# built on top of Task 8's sync_rule. Each test drives sync_document through extract_rules() on a
# tiny synthetic document (never the real 14.6k-line discipline doc — fixture minimality, DoD-6),
# using rule_ids "10.99"/"10.98" (unused section numbers, matching the extractor's own heading
# grammar `\d+(?:\.\d+)*[a-z]?` — a "TEST-LC"-style id would never be recognised as a section
# heading at all) so they can never collide with a real document rule.
# ---------------------------------------------------------------------------------------------

# Fix round 1 (2026-08-06, review Critical 2): this USED to be the real
# "docs/process/development-discipline.md" — but sync_document treats a call against a
# source_path as a FULL sync of everything currently stored under that path, so running these
# tests against the real document's own path would retire every real current rule not present in
# that test's tiny synthetic fixture the moment any real sync had already populated mk_rules (the
# gate's self-heal does exactly that). A fixture-only path — never written to disk, never synced
# by the real document, so it can never collide with production rows in either direction — closes
# that hole structurally rather than by convention. Same shape as PROBE_SOURCE_PATH below, which
# already established this precedent for exactly this reason.
SOURCE_PATH = "tests/fixtures/synthetic-rules-doc.md"


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


# ---------------------------------------------------------------------------------------------
# Fix round 2 (2026-08-06) — review findings against Fix round 1.
# ---------------------------------------------------------------------------------------------


def test_retire_crash_before_pg_commit_is_self_healing(tmp_path):
    """FINDING 1: the old order (Postgres commit THEN mirror delete) left a permanently stuck
    state if the mirror delete never ran — the row is_current=false forever, excluded from
    sync_document's own `WHERE is_current` lookup, so _retire is never re-invoked for it again.
    The fixed order (mirror delete THEN Postgres commit) must leave the Postgres row UNTOUCHED
    (still is_current=true, still 'current') after an injected crash between the two — proving the
    same rule_id will be picked up for retirement again on the very next sync_document call, which
    this test then performs for real."""
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "96")
    m = _fresh_mirror(tmp_path, "_tmp_retire_crash.sqlite")

    d1 = "## 96. Doomed\n\nwill be retired.\n"
    d2 = "## 97. Unrelated\n\nsomething else.\n"  # 96 absent from d2 -> up for retirement

    r1 = builder.sync_document(pg, m, d1, PROBE_SOURCE_PATH)
    assert r1["added"] == ["96"], r1
    assert any(r["rule_id"] == "96" for r in mirror.read_current(m)), "mirror must hold 96 before the crash"

    # Inject the fault directly on _retire — mirror delete succeeds, then the crash fires BEFORE
    # the Postgres commit.
    try:
        builder._retire(pg, m, "96", _fail_after_mirror_delete=True)
        assert False, "expected the injected fault to raise"
    except builder.SimulatedCrash:
        pass

    # Post-crash: mirror already lacks the rule (delete committed before the fault)...
    assert not [r for r in mirror.read_current(m) if r["rule_id"] == "96"], (
        "the mirror delete should have succeeded before the injected fault"
    )
    # ...but Postgres must be COMPLETELY UNTOUCHED — still current, not half-retired.
    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, retired_at FROM rule_revisions WHERE rule_id = %s",
            ("96",),
        )
        status, is_current, retired_at = cur.fetchone()
    assert status == "current" and is_current is True and retired_at is None, (
        f"a crash before the Postgres commit must leave the row exactly as it was — "
        f"got status={status!r} is_current={is_current!r} retired_at={retired_at!r}"
    )
    _assert_rule_invariants(pg, "96")

    # Self-healing: a plain sync_document call over the SAME document (96 still absent) must pick
    # 96 up for retirement again and complete it cleanly — no special recovery call, same as
    # sync_rule's own crash-recovery precedent (Task 8).
    r2 = builder.sync_document(pg, m, d2, PROBE_SOURCE_PATH)
    assert r2["retired"] == ["96"], r2

    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, retired_at, statement FROM rule_revisions WHERE rule_id = %s",
            ("96",),
        )
        status, is_current, retired_at, statement = cur.fetchone()
    assert status == "retired" and is_current is False and retired_at is not None
    assert "will be retired" in statement, "the retired row is kept, queryable, statement intact"
    assert not [r for r in mirror.read_current(m) if r["rule_id"] == "96"]
    _assert_rule_invariants(pg, "96")

    m.close()
    _clean(pg, "96")
    _clean(pg, "97")
    pg.close()


def test_sync_document_refuses_cross_document_rule_id_conflict(tmp_path):
    """FINDING 3: the unique index is scoped to rule_id alone, but sync_document's own lookup is
    scoped to (is_current, source_path) — so the same rule_id arriving from a SECOND document was
    classified 'added' and silently superseded the first document's current row. rule_id is a
    single global key (0001 migration), so this is now refused as a name collision, not performed
    quietly. Also proves no partial write happened: document A's row survives untouched."""
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "95")
    m = _fresh_mirror(tmp_path, "_tmp_crossdoc.sqlite")

    doc_a = "## 95. Shared\n\nFrom document A.\n"
    doc_b = "## 95. Shared\n\nFrom document B — a totally different claimant.\n"

    r1 = builder.sync_document(pg, m, doc_a, "docA.md")
    assert r1["added"] == ["95"], r1

    with pytest.raises(ValueError, match="currently current under"):
        builder.sync_document(pg, m, doc_b, "docB.md")

    # No partial write: document A's row is exactly as it was, and it is the ONLY row for 95.
    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, source_path FROM rule_revisions WHERE rule_id = %s",
            ("95",),
        )
        rows = cur.fetchall()
    assert rows == [("current", True, "docA.md")], rows
    _assert_rule_invariants(pg, "95")

    m.close()
    _clean(pg, "95")
    pg.close()


# ---------------------------------------------------------------------------------------------
# Task 10: proof — the builder derives from the working tree, never from `git HEAD`. This is a
# PROOF task: no new production code. sync_document takes `text: str` as a parameter and never
# shells out to git by construction (see src/rules_store/builder.py) — this test pins that
# property so a future change that reads `source_path` off git instead of the caller-supplied
# text would be caught red-handed.
# ---------------------------------------------------------------------------------------------


FIXTURE_DOC_RELPATH = "tests/fixtures/rules_builder_disk_vs_head.md"
FIXTURE_DOC_PATH = ROOT / "tests" / "fixtures" / "rules_builder_disk_vs_head.md"


def test_builder_reads_the_working_tree_not_head():
    """Proves the hard requirement: an UNCOMMITTED document change is detected, distinguished by
    STATEMENT TEXT, not by presence/absence of the record. A builder that shelled out to
    `git show HEAD:<path>` instead of reading the caller-supplied `text` would resolve the SAME
    real, git-tracked path used here (`tests/fixtures/rules_builder_disk_vs_head.md`, committed
    content: "committed statement.") and so would still extract a record for rule_id "10.96" — just
    with the WRONG (committed) statement, not "no record at all". Asserting on the statement text is
    what makes this test distinguish "reads disk" from "reads git HEAD"; asserting only on
    `result["added"]` (as an earlier version of this test did) cannot, because a git-reading
    implementation given a real, resolvable path still succeeds at extracting a record.

    Fix round 1 (2026-08-06, review Critical): the ORIGINAL version of this test built its own
    throwaway git repo in a `tempfile.TemporaryDirectory()` and `chdir`'d into it so
    `git show HEAD:<path>` would resolve there — but the code under regression-test (a
    hypothetically broken `sync_document`) never chdirs; it runs `subprocess.run([...])` from
    whatever cwd the CALLING PROCESS already has, which for `pytest tests/test_rules_builder.py`
    run the normal way (from the repo root, no chdir) is the repo root. The temp-repo version's
    `source_path` ("development-discipline.md", a bare filename with no `docs/process/` prefix)
    therefore resolved to NOTHING from the real repo root — `git show` returned empty,
    `extract_rules("", ...)` yielded zero records, and the test went red on `result["added"] == []`
    for the WRONG reason (nothing extracted) rather than the intended one (wrong statement
    extracted). The reported RED evidence came from a separate, uncommitted side script that DID
    chdir — an artifact that never runs in CI or for a developer invoking this test directly, so it
    proved nothing about the committed test. Fixed by using a REAL, git-tracked fixture file
    (`tests/fixtures/rules_builder_disk_vs_head.md`, committed in the same arc as this fix) at its
    real repo-relative path, so `git show HEAD:<path>` — run from the real repo root, exactly as
    pytest itself runs, no chdir anywhere in this test — resolves successfully to that fixture's
    actual committed content. The test mutates that file's bytes on disk WITHOUT committing or
    staging (plain `Path.write_text`, no `git add`), then restores the original bytes the same way
    in a `finally` block — never via a git command, so this test can never leave the fixture file
    non-idempotent for the next run or racing another process's index writes.
    """
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")

    committed_text = FIXTURE_DOC_PATH.read_text(encoding="utf-8")
    assert "committed statement." in committed_text, (
        f"fixture drift: {FIXTURE_DOC_RELPATH} no longer holds the expected committed baseline, "
        f"got: {committed_text!r}"
    )

    pg = _writer_conn()
    pg.autocommit = False
    _clean(pg, "10.96")
    tmp = Path(tempfile.mkdtemp()) / "_tmp_disk_not_git.sqlite"
    m = mirror.open_mirror(tmp)

    try:
        # Edit the real, git-tracked fixture ON DISK, WITHOUT committing or staging it — this is
        # the "uncommitted working-tree change" the test's whole point rests on.
        uncommitted_text = "### 10.96 Rule\n\nUNCOMMITTED statement, changed on disk only.\n"
        FIXTURE_DOC_PATH.write_text(uncommitted_text, encoding="utf-8")

        # Read it back the same way a real caller (a document watcher, a CLI) would: straight off
        # disk, never through git — proving the builder itself never consults git is the point of
        # this whole file, and `sync_document` takes `text` as a plain parameter by construction.
        text_from_disk = FIXTURE_DOC_PATH.read_text(encoding="utf-8")
        result = builder.sync_document(pg, m, text_from_disk, FIXTURE_DOC_RELPATH)
        assert result["added"] == ["10.96"], result
        with pg.cursor() as cur:
            cur.execute(
                "SELECT statement FROM rule_revisions WHERE rule_id = %s AND is_current",
                ("10.96",),
            )
            (statement,) = cur.fetchone()
        assert "UNCOMMITTED" in statement, (
            f"expected the uncommitted working-tree text, got: {statement!r} — "
            "the builder must read the file directly, never `git show HEAD:...`"
        )
    finally:
        # Restore the fixture's committed bytes via a plain file write — NEVER `git checkout` /
        # `git restore` / `git add`, which would write the shared index (forbidden during Fix
        # round 1: a concurrent index writer is exactly what corrupted two tree builds earlier).
        FIXTURE_DOC_PATH.write_text(committed_text, encoding="utf-8")
        m.close()
        _clean(pg, "10.96")
        pg.close()


def test_resync_preserves_mechanism_classification(tmp_path):
    """Classify TEST-KEEP (mechanism + target, the way scripts/classify_rules.py will), then
    re-sync the SAME rule_id with CHANGED text. The fresh revision must inherit the
    classification — in Postgres AND the mirror — exactly as rule_group already does."""
    pg = _writer_conn(); pg.autocommit = False
    _clean(pg, "TEST-KEEP")
    m = mirror.open_mirror(tmp_path / "keep.sqlite")
    rec1 = extractor.RuleRecord(rule_id="TEST-KEEP", section="TEST", title_he="t",
                                statement="old text", source_heading="h", content_hash="hash1")
    builder.sync_rule(pg, m, rec1, source_path="test://keep")
    with pg.cursor() as cur:  # the classification write, as classify.apply_batch will do it
        cur.execute("UPDATE rule_revisions SET rule_group='A', mechanism='pretooluse:Bash', "
                    "mechanism_target='git commit' WHERE rule_id='TEST-KEEP' AND is_current")
    pg.commit()
    rec2 = extractor.RuleRecord(rule_id="TEST-KEEP", section="TEST", title_he="t",
                                statement="new text", source_heading="h", content_hash="hash2")
    builder.sync_rule(pg, m, rec2, source_path="test://keep")
    with pg.cursor() as cur:
        cur.execute("SELECT mechanism, mechanism_target FROM rule_revisions "
                    "WHERE rule_id='TEST-KEEP' AND is_current")
        assert cur.fetchone() == ("pretooluse:Bash", "git commit"), "PG lost the classification"
    row = [r for r in mirror.read_current(m) if r["rule_id"] == "TEST-KEEP"][0]
    assert (row["mechanism"], row["mechanism_target"]) == ("pretooluse:Bash", "git commit"), \
        "the mirror lost the classification"
    _clean(pg, "TEST-KEEP"); pg.close()
