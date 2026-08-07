"""The PostgreSQL schema does what the owner's prompt says it must — asserted against a live DB.

These tests need the stack running (the native Windows services `postgresql-x64-18` and `neo4j`).
Where it is absent — CI,
a fresh checkout — they SKIP and say so. An absent database is an absence, not a failure; that
distinction is L54 and this project has now paid for it three times in one day.

What is tested here is NOT "the tables exist". It is the handful of constraints that carry the
prompt's rules, each verified by trying to break it and being refused:

  * a revision cannot be current until BOTH sides succeeded
  * a document cannot have two current revisions
  * mk_reader cannot write; mk_app cannot change the schema
  * a failed job must say why

A constraint that is never attacked is a comment with a syntax error waiting to happen.
"""

from __future__ import annotations

from pathlib import Path

import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / ".env"


def _params(role: str = "superuser") -> dict[str, str]:
    from dotenv import dotenv_values

    if not ENV_FILE.exists():
        pytest.skip("infra/.env not present — the stack has not been configured here")
    env = dotenv_values(ENV_FILE)
    users = {
        "superuser": (env.get("POSTGRES_SUPERUSER"), env.get("POSTGRES_SUPERUSER_PASSWORD")),
        "app": ("mk_app", env.get("MK_APP_PASSWORD")),
        "reader": ("mk_reader", env.get("MK_READER_PASSWORD")),
    }
    user, password = users[role]
    if not (user and password and env.get("POSTGRES_PORT") and env.get("POSTGRES_DB")):
        pytest.skip(f"infra/.env does not define credentials for {role}")
    return {
        "host": "127.0.0.1",
        "port": str(env["POSTGRES_PORT"]),
        "dbname": str(env["POSTGRES_DB"]),
        "user": str(user),
        "password": str(password),
        "connect_timeout": "5",
    }


def connect(role: str = "superuser"):
    try:
        return psycopg2.connect(**_params(role))
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable ({str(exc).strip()[:80]}) — start it with: Start-Service postgresql-x64-18")


@pytest.fixture
def db():
    conn = connect("superuser")
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture
def doc(db):
    """A throwaway document, removed afterwards. Cascades take its revisions and chunks with it."""
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (source_path, doc_kind) VALUES (%s, 'markdown') RETURNING id",
            (f"__test__/{id(db)}.md",),
        )
        doc_id = cur.fetchone()[0]
    yield doc_id
    with db.cursor() as cur:
        cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))


def _new_revision(db, doc_id, number, *, indexed=False, projected=False, status="graph_projected"):
    """A revision in a chosen state.

    `status` defaults to graph_projected so each test below isolates ONE constraint. Migration 0006
    added current_only_when_graph_projected, and without this default every test that makes a
    revision current would trip that constraint first and pass for the wrong reason — green while
    asserting nothing about the rule it names.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO document_revisions
              (document_id, revision_number, content_hash, byte_size, indexed_at,
               graph_projected_at, status)
            VALUES (%s, %s, %s, 10,
                    CASE WHEN %s THEN now() END,
                    CASE WHEN %s THEN now() END,
                    %s)
            RETURNING id
            """,
            (doc_id, number, f"hash-{number}-{doc_id}", indexed, projected, status),
        )
        return cur.fetchone()[0]


# --- the prompt's central rule -------------------------------------------------------------

@pytest.mark.parametrize(
    "indexed,projected",
    [(False, False), (True, False), (False, True)],
    ids=["neither side", "postgres only", "neo4j only"],
)
def test_a_revision_cannot_be_current_until_both_sides_succeeded(db, doc, indexed, projected):
    """Owner prompt: "Do not mark a document revision current until both ... succeed."

    Attempted three ways, because "one side done" is the case a worker actually reaches — the
    both-null case would be caught by almost any implementation, and proves the least.
    """
    rev = _new_revision(db, doc, 1, indexed=indexed, projected=projected)
    with pytest.raises(psycopg2.errors.CheckViolation) as exc:
        with db.cursor() as cur:
            cur.execute("UPDATE document_revisions SET is_current = true WHERE id = %s", (rev,))
    assert "current_requires_both_sides" in str(exc.value)


def test_a_revision_with_both_sides_done_can_be_current(db, doc):
    """The constraint permits the legitimate case — otherwise it is not a constraint, it is a wall."""
    rev = _new_revision(db, doc, 1, indexed=True, projected=True)
    with db.cursor() as cur:
        cur.execute("UPDATE document_revisions SET is_current = true WHERE id = %s", (rev,))
        cur.execute("SELECT is_current FROM document_revisions WHERE id = %s", (rev,))
        assert cur.fetchone()[0] is True


def test_a_document_cannot_have_two_current_revisions(db, doc):
    first = _new_revision(db, doc, 1, indexed=True, projected=True)
    second = _new_revision(db, doc, 2, indexed=True, projected=True)
    with db.cursor() as cur:
        cur.execute("UPDATE document_revisions SET is_current = true WHERE id = %s", (first,))
    with pytest.raises(psycopg2.errors.UniqueViolation):
        with db.cursor() as cur:
            cur.execute("UPDATE document_revisions SET is_current = true WHERE id = %s", (second,))


# --- the states that must not be able to lie ------------------------------------------------

def test_a_failed_job_must_say_why(db, doc):
    with pytest.raises(psycopg2.errors.CheckViolation) as exc:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO ingestion_jobs (document_id, state, finished_at) VALUES (%s, 'failed', now())",
                (doc,),
            )
    assert "failed_jobs_say_why" in str(exc.value)


def test_a_chunk_cannot_carry_an_undated_embedding(db, doc):
    rev = _new_revision(db, doc, 1)
    with pytest.raises(psycopg2.errors.CheckViolation) as exc:
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO document_chunks (revision_id, chunk_index, node_id, content, embedding) "
                "VALUES (%s, 0, 'n1', 'x', %s)",
                (rev, "[" + ",".join(["0.1"] * 1024) + "]"),
            )
    assert "embedding_and_timestamp_together" in str(exc.value)


def test_the_embedding_column_is_the_dimension_the_local_model_produces(db):
    """1024 — measured from bge-m3, not read off a model card.

    A wrong dimension does not fail loudly at write time; it fails when a query returns nothing.
    """
    with db.cursor() as cur:
        cur.execute(
            "SELECT atttypmod FROM pg_attribute "
            "WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding'"
        )
        assert cur.fetchone()[0] == 1024


# --- least privilege, read back rather than assumed ------------------------------------------

def test_mk_reader_can_read_and_cannot_write(db, doc):
    conn = connect("reader")
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents")
            assert cur.fetchone()[0] >= 1
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            with conn.cursor() as cur:
                cur.execute("INSERT INTO documents (source_path, doc_kind) VALUES ('x', 'markdown')")
    finally:
        conn.close()


def test_mk_app_can_write_data_and_cannot_change_the_schema(db, doc):
    conn = connect("app")
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO document_revisions (document_id, revision_number, content_hash, byte_size) "
                "VALUES (%s, 9, 'written-by-mk-app', 1) RETURNING id",
                (doc,),
            )
            assert cur.fetchone()[0]
        with pytest.raises((psycopg2.errors.InsufficientPrivilege, psycopg2.errors.SyntaxError)):
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE mk_app_should_not_be_able_to_do_this (x int)")
    finally:
        conn.close()


def test_every_migration_on_disk_has_been_applied(db):
    """The database and the migration directory agree — the point of having migrations at all."""
    on_disk = sorted(p.stem for p in (ROOT / "infra" / "postgres" / "migrations").glob("*.sql"))
    with db.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        applied = [r[0] for r in cur.fetchall()]
    assert applied == on_disk, f"pending: {sorted(set(on_disk) - set(applied))}"
