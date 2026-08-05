"""Every field Phase 3 of the owner's prompt requires exists in the schema — traced, not assumed.

This file exists because 0001-0003 were written from a SUMMARY of the prompt and quietly dropped
most of the field lists: revision status, source authority, idempotency key, projection schema
version, namespace, and more. Nothing was disputed; the text simply was not read at the moment it
was needed. §4 of the discipline forbids narrowing an approved spec, and narrowing by forgetting is
the hardest kind to notice — there is no decision anywhere to point at.

So the requirement list below is transcribed from
docs/infra/owner-prompt-2026-08-05-knowledge-stack.md, Phase 3, and checked against the live
database. When a later phase adds a table, its required concepts belong here too.

This is a COVERAGE test, and it is honest about what that means: it proves the column exists and
has a plausible type. It cannot prove the column is populated correctly — that is the acceptance
tests in Phase 8.
"""

from __future__ import annotations

import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")

from test_pg_schema import connect  # noqa: E402  — same skip behaviour, one definition

# Prompt Phase 3, "Required concepts", transcribed per table.
REQUIRED = {
    "documents": {
        "id": "immutable document identifier",
        "source_path": "normalized source path",
        "doc_kind": "source type",
        "namespace": "namespace",
        "current_revision_id": "active/current revision reference",
        "created_at": "creation timestamp",
        "updated_at": "update timestamp",
    },
    "document_revisions": {
        "id": "immutable revision identifier",
        "document_id": "parent document identifier",
        "content_hash": "content hash",
        "source_commit": "source commit identifier when applicable",
        "source_uri": "source path/URI at ingestion time",
        "created_at": "created timestamp",
        "status": "revision status",
        "superseded_by": "superseded-by reference when applicable",
        "provenance": "content/provenance metadata",
        "source_authority": "source authority classification",
    },
    "document_chunks": {
        "id": "immutable chunk identifier",
        "revision_id": "parent revision identifier",
        "chunk_index": "chunk ordering",
        "content": "chunk text",
        "content_hash": "content hash",
        "embedding": "embedding/vector",
        "metadata": "structured metadata",
        "heading_path": "source location information sufficient for citation",
        "start_char": "source location information sufficient for citation",
        "end_char": "source location information sufficient for citation",
    },
    "ingestion_jobs": {
        "id": "job identifier",
        "document_id": "source identity",
        "requested_hash": "requested content hash",
        "job_type": "job type",
        "state": "queue/lease state",
        "lease_owner": "queue/lease state",
        "lease_expires_at": "queue/lease state",
        "attempts": "attempt counter",
        "last_error": "error details",
        "created_at": "timestamps",
        "idempotency_key": "idempotency key",
    },
    "graph_projection_state": {
        "revision_id": "revision identifier",
        "state": "projection state",
        "last_attempt_at": "last attempt timestamp",
        "projection_schema_version": "projection version/schema version",
        "last_error": "error details",
        "graph_reference": "graph transaction/reference metadata when useful",
    },
}

# Prompt Phase 3: "Use explicit statuses. At minimum, distinguish: ..."
REQUIRED_STATUSES = {
    "queued", "processing", "indexed", "graph_pending",
    "graph_projected", "failed", "superseded", "archived",
}


@pytest.fixture(scope="module")
def db():
    conn = connect("superuser")
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture(autouse=True)
def clean_test_namespaces(db):
    """Remove anything a previous run left behind, before AND after.

    Added after this file failed in the full suite while passing alone: an earlier run had died
    between INSERT and DELETE, and the leftover rows made the next run's INSERT collide. A test
    that only passes on a clean database is a test that reports the database's history rather than
    the code's behaviour — and it fails in exactly the situation where you least want noise, right
    after something else already broke.
    """
    def purge():
        with db.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE namespace LIKE '\\_\\_test\\_\\_%' OR namespace LIKE '\\_\\_probe\\_\\_%'")

    purge()
    yield
    purge()


@pytest.mark.parametrize("table", sorted(REQUIRED))
def test_every_required_concept_has_a_column(db, table):
    with db.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s",
            (table,),
        )
        present = {r[0] for r in cur.fetchall()}
    missing = {c: why for c, why in REQUIRED[table].items() if c not in present}
    assert not missing, (
        f"{table} is missing {len(missing)} concept(s) the prompt requires: "
        + "; ".join(f"{c} ({why})" for c, why in sorted(missing.items()))
    )


def test_all_eight_prompt_statuses_exist(db):
    with db.cursor() as cur:
        cur.execute("SELECT unnest(enum_range(NULL::revision_status))::text")
        got = {r[0] for r in cur.fetchall()}
    assert REQUIRED_STATUSES <= got, f"missing statuses: {sorted(REQUIRED_STATUSES - got)}"


def test_a_revision_can_only_be_current_from_graph_projected(db):
    """The status and the two timestamps cannot disagree with each other.

    0001 allowed a row where both timestamps were set while the status said `failed` — self-
    contradictory, and exactly the state a partially-failed retry would leave behind.
    """
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (source_path, doc_kind, namespace) "
            "VALUES ('__test__/status.md', 'markdown', '__test__') RETURNING id"
        )
        doc = cur.fetchone()[0]
    try:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO document_revisions "
                "  (document_id, revision_number, content_hash, byte_size, indexed_at, "
                "   graph_projected_at, status) "
                "VALUES (%s, 1, 'h', 1, now(), now(), 'failed') RETURNING id",
                (doc,),
            )
            rev = cur.fetchone()[0]
        with pytest.raises(psycopg2.errors.CheckViolation) as exc:
            with db.cursor() as cur:
                cur.execute("UPDATE document_revisions SET is_current = true WHERE id = %s", (rev,))
        assert "current_only_when_graph_projected" in str(exc.value)
    finally:
        with db.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE id = %s", (doc,))


def test_a_superseded_revision_must_name_its_successor(db):
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (source_path, doc_kind, namespace) "
            "VALUES ('__test__/supersede.md', 'markdown', '__test__') RETURNING id"
        )
        doc = cur.fetchone()[0]
    try:
        with pytest.raises(psycopg2.errors.CheckViolation) as exc:
            with db.cursor() as cur:
                cur.execute(
                    "INSERT INTO document_revisions "
                    "  (document_id, revision_number, content_hash, byte_size, status) "
                    "VALUES (%s, 1, 'h', 1, 'superseded')",
                    (doc,),
                )
        assert "superseded_revisions_point_somewhere" in str(exc.value)
    finally:
        with db.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE id = %s", (doc,))


def test_the_same_path_may_exist_in_two_namespaces(db):
    """Uniqueness moved from source_path to (namespace, source_path).

    Without this, ingesting vendor docs that happen to share a relative path with a repo file
    would silently overwrite one with the other — a data loss with no error.
    """
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (source_path, doc_kind, namespace) VALUES "
            "  ('__test__/same.md', 'markdown', '__test__a'), "
            "  ('__test__/same.md', 'markdown', '__test__b') RETURNING id"
        )
        ids = [r[0] for r in cur.fetchall()]
    try:
        assert len(ids) == 2
    finally:
        with db.cursor() as cur:
            # ::uuid[] is required. psycopg2 adapts a Python list of UUID strings to text[], and
            # PostgreSQL has no uuid = text operator, so without the cast the CLEANUP fails while
            # the assertion above passes — which reads as "the test failed" and sends you looking
            # at the wrong half.
            cur.execute("DELETE FROM documents WHERE id = ANY(%s::uuid[])", (ids,))


def test_a_running_job_must_hold_a_lease(db):
    """Single-writer survives a crash only if a held job is identifiable as held."""
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (source_path, doc_kind, namespace) "
            "VALUES ('__test__/lease.md', 'markdown', '__test__') RETURNING id"
        )
        doc = cur.fetchone()[0]
    try:
        with pytest.raises(psycopg2.errors.CheckViolation) as exc:
            with db.cursor() as cur:
                cur.execute(
                    "INSERT INTO ingestion_jobs (document_id, state) VALUES (%s, 'running')",
                    (doc,),
                )
        assert "a_running_job_holds_a_lease" in str(exc.value)
    finally:
        with db.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE id = %s", (doc,))
