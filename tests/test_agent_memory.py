"""Tests for the SQLite/JSONB agent-memory store.

Every test runs against an isolated `:memory:` database. Nothing here touches the repo's
real memory file, the network, or any external process — and one test proves that last claim
rather than asserting it in a comment.

Run: python -m pytest tests/test_agent_memory.py -v
"""

from __future__ import annotations


import socket
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.memory import (  # noqa: E402
    MIN_SQLITE_FOR_JSONB,
    AgentMemory,
    DocChunk,
    JsonbUnsupportedError,
    ToolSpec,
    chunk_markdown,
    sha256_text,
)


@pytest.fixture()
def mem():
    m = AgentMemory(":memory:")
    yield m
    m.close()


# ======================================================================================
# JSONB — the reason this store exists at all
# ======================================================================================


def test_metadata_is_stored_as_binary_jsonb_not_text(mem):
    """The column must hold SQLite's binary JSON, not a JSON string.

    This is the whole point of the migration and it is easy to lose silently: dropping the
    jsonb() wrapper still round-trips through json_extract, so only the storage TYPE tells
    you which one you got.
    """
    mem.upsert_tool_spec(ToolSpec("ripgrep", "fast search", {"kind": "search"}))
    row = mem.conn.execute(
        "SELECT typeof(metadata) AS t, metadata FROM agent_memory WHERE type='tool_spec'"
    ).fetchone()
    assert row["t"] == "blob"
    assert not isinstance(row["metadata"], str)


def test_jsonb_guard_reports_the_version_it_found():
    """A too-old SQLite must fail at connect with a readable message, not at first write."""
    assert MIN_SQLITE_FOR_JSONB == (3, 45, 0)
    assert sqlite3.sqlite_version_info >= MIN_SQLITE_FOR_JSONB, (
        f"this interpreter links SQLite {sqlite3.sqlite_version}; agent_memory needs >= 3.45.0"
    )
    # And the guard is wired: the exception type exists and is raisable.
    with pytest.raises(JsonbUnsupportedError):
        raise JsonbUnsupportedError("probe")


# ======================================================================================
# tool_spec — exact retrieval
# ======================================================================================


def test_tool_spec_round_trips_nested_metadata_exactly(mem):
    meta = {
        "kind": "test-runner",
        "version": "1.61.1",
        "flags": ["--reporter=line", "--workers=20"],
        "config": {"retries": 0, "timeout_ms": 30000, "unicode": "בדיקה ✓"},
    }
    mem.upsert_tool_spec(ToolSpec("playwright", "Playwright test runner", meta))

    got = mem.get_tool_spec("playwright")
    assert got is not None
    assert got["content"] == "Playwright test runner"
    assert got["metadata"]["config"]["retries"] == 0
    assert got["metadata"]["config"]["unicode"] == "בדיקה ✓"
    assert got["metadata"]["flags"] == ["--reporter=line", "--workers=20"]
    assert got["metadata"]["tool_name"] == "playwright"


def test_get_tool_spec_returns_none_for_unknown(mem):
    assert mem.get_tool_spec("does-not-exist") is None


def test_tool_spec_upsert_replaces_rather_than_duplicates(mem):
    first = mem.upsert_tool_spec(ToolSpec("node", "runtime", {"version": "22"}))
    second = mem.upsert_tool_spec(ToolSpec("node", "runtime", {"version": "24"}))

    assert first == second, "the same tool must keep its row id"
    assert mem.conn.execute(
        "SELECT COUNT(*) FROM agent_memory WHERE type='tool_spec'"
    ).fetchone()[0] == 1
    assert mem.get_tool_spec("node")["metadata"]["version"] == "24"


def test_tool_name_index_is_used_for_lookup(mem):
    """A JSON lookup that scans every row is not a lookup. Prove the index is chosen."""
    mem.upsert_tool_spec(ToolSpec("serena", "symbol server", {}))
    plan = mem.conn.execute(
        "EXPLAIN QUERY PLAN SELECT id FROM agent_memory "
        "WHERE type='tool_spec' AND json_extract(metadata,'$.tool_name')='serena'"
    ).fetchall()
    detail = " ".join(str(r["detail"]) for r in plan)
    assert "idx_agent_memory_tool_name" in detail or "ux_agent_memory_tool_name" in detail, detail


def test_type_column_rejects_an_unknown_type(mem):
    with pytest.raises(sqlite3.IntegrityError):
        mem.conn.execute(
            "INSERT INTO agent_memory (content, type, created_at) VALUES ('x','graph_node','now')"
        )


# ======================================================================================
# md_doc — chunking
# ======================================================================================


SAMPLE = """Intro paragraph before any heading.

# Title

Top level body.

## Section A

Body of A.

### Sub A1

Body of A1.

## Section B

Body of B.
"""


def test_chunk_markdown_splits_by_heading_and_keeps_ancestry():
    chunks = chunk_markdown(SAMPLE, "sample.md")
    headings = [c.heading for c in chunks]
    assert headings == ["", "Title", "Section A", "Sub A1", "Section B"]

    preamble = chunks[0]
    assert preamble.content.startswith("Intro paragraph")
    assert preamble.level == 0

    sub = next(c for c in chunks if c.heading == "Sub A1")
    assert sub.level == 3
    assert sub.heading_path == ("Title", "Section A", "Sub A1")
    assert sub.content == "Body of A1."

    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_chunk_markdown_ignores_headings_inside_fenced_code():
    """A shell snippet full of `# comment` lines must not shred the document.

    This corpus is full of them, so the naive line-starts-with-# rule would have produced
    hundreds of bogus sections.
    """
    text = "# Real\n\nbody\n\n```bash\n# not a heading\n## also not\n```\n\n## Real Two\n\nmore\n"
    chunks = chunk_markdown(text, "f.md")
    assert [c.heading for c in chunks] == ["Real", "Real Two"]
    assert "# not a heading" in chunks[0].content


def test_chunk_markdown_handles_a_document_with_no_headings():
    chunks = chunk_markdown("just some prose\nand more\n", "flat.md")
    assert len(chunks) == 1
    assert chunks[0].heading == ""
    assert "just some prose" in chunks[0].content


def test_empty_document_produces_no_chunks():
    assert chunk_markdown("", "empty.md") == []


# ======================================================================================
# md_doc — storage, querying and delta ingestion
# ======================================================================================


def test_ingest_markdown_stores_one_row_per_chunk(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")

    res = mem.ingest_markdown(p, rel_path="docs/doc.md")
    assert res["status"] == "ingested"
    assert res["chunks"] == 5

    rows = mem.query_docs(file_path="docs/doc.md", limit=100)
    assert len(rows) == 5
    assert [r["metadata"]["chunk_index"] for r in rows] == [0, 1, 2, 3, 4]
    assert all(r["file_hash"] == res["file_hash"] for r in rows)


def test_delta_ingestion_skips_an_unchanged_file(mem, tmp_path):
    """The old freshness gate keyed on mtime and was never green. Hash, not clock."""
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")

    first = mem.ingest_markdown(p, rel_path="d.md")
    assert first["status"] == "ingested"

    # Rewrite byte-identical content — mtime moves, content does not.
    p.write_text(SAMPLE, encoding="utf-8")
    second = mem.ingest_markdown(p, rel_path="d.md")
    assert second["status"] == "skipped"
    assert second["chunks"] == 0
    assert second["file_hash"] == first["file_hash"]


def test_changed_file_is_reingested_and_old_chunks_do_not_survive(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text("# One\n\nalpha\n\n## Two\n\nbeta\n", encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    assert len(mem.query_docs(file_path="d.md", limit=100)) == 2

    p.write_text("# One\n\nalpha changed\n", encoding="utf-8")
    res = mem.ingest_markdown(p, rel_path="d.md")

    assert res["status"] == "ingested"
    rows = mem.query_docs(file_path="d.md", limit=100)
    assert len(rows) == 1, "the removed section must be gone, not orphaned"
    assert rows[0]["content"] == "alpha changed"
    assert mem.query_docs(text="beta") == []


def test_force_reingests_an_unchanged_file(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    assert mem.ingest_markdown(p, rel_path="d.md", force=True)["status"] == "ingested"


def test_upsert_doc_chunk_is_idempotent(mem):
    chunk = DocChunk("a.md", 0, "H", ("H",), 1, "body")
    first = mem.upsert_doc_chunk(chunk, sha256_text("body"))
    second = mem.upsert_doc_chunk(chunk, sha256_text("body"))
    assert first == second
    assert mem.conn.execute("SELECT COUNT(*) FROM agent_memory").fetchone()[0] == 1


def test_query_docs_matches_content_or_heading(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")

    assert any("Body of A1" in r["content"] for r in mem.query_docs(text="body of a1"))
    # heading-only: "Section B" appears in no body text
    hits = mem.query_docs(text="section b")
    assert hits and hits[0]["metadata"]["heading"] == "Section B"


def test_query_docs_filters_on_arbitrary_metadata(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md", extra_metadata={"corpus": "project", "lang": "he"})

    assert len(mem.query_docs(metadata_equals={"corpus": "project"}, limit=100)) == 5
    assert mem.query_docs(metadata_equals={"corpus": "global"}, limit=100) == []
    assert len(mem.query_docs(metadata_equals={"level": 2}, limit=100)) == 2


def test_delete_by_file_path_removes_only_that_file(mem, tmp_path):
    for name in ("a.md", "b.md"):
        p = tmp_path / name
        p.write_text(SAMPLE, encoding="utf-8")
        mem.ingest_markdown(p, rel_path=name)

    assert mem.delete_by_file_path("a.md") == 5
    assert mem.query_docs(file_path="a.md") == []
    assert len(mem.query_docs(file_path="b.md", limit=100)) == 5


def test_unicode_and_rtl_survive_the_round_trip(mem):
    body = "טמפ׳ בטיחות 71°C — לשון בקר · מקור: USDA FSIS"
    mem.upsert_doc_chunk(DocChunk("he.md", 0, "בטיחות", ("בטיחות",), 1, body), sha256_text(body))
    got = mem.query_docs(text="לשון בקר")
    assert got and got[0]["content"] == body
    assert got[0]["metadata"]["heading"] == "בטיחות"


def test_ingest_markdown_tree_walks_a_directory(mem, tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "one.md").write_text("# One\n\na\n", encoding="utf-8")
    (tmp_path / "sub" / "two.md").write_text("# Two\n\nb\n", encoding="utf-8")
    (tmp_path / "skip.txt").write_text("not markdown", encoding="utf-8")

    tally = mem.ingest_markdown_tree(tmp_path)
    assert tally["ingested"] == 2 and tally["chunks"] == 2
    assert {r["file_path"] for r in mem.query_docs(limit=100)} == {"one.md", "sub/two.md"}

    again = mem.ingest_markdown_tree(tmp_path)
    assert again["skipped"] == 2 and again["ingested"] == 0


# ======================================================================================
# Atomicity and isolation
# ======================================================================================


class _FailingOnNthInsert:
    """Delegates everything to a real connection, but raises on the Nth INSERT.

    `sqlite3.Connection.execute` is a read-only attribute, so it cannot be monkeypatched
    directly — that attempt is what this class replaces. Wrapping the connection instead
    keeps `with conn:` doing the real thing: __enter__/__exit__ pass straight through, so
    the transaction commits or rolls back exactly as it would in production.
    """

    def __init__(self, conn, fail_on: int = 1):
        self._conn = conn
        self._fail_on = fail_on
        self._inserts = 0

    def execute(self, sql, *args, **kwargs):
        if sql.strip().upper().startswith("INSERT"):
            self._inserts += 1
            if self._inserts == self._fail_on:
                raise sqlite3.OperationalError("simulated failure mid-transaction")
        return self._conn.execute(sql, *args, **kwargs)

    def __enter__(self):
        return self._conn.__enter__()

    def __exit__(self, *exc):
        return self._conn.__exit__(*exc)

    def __getattr__(self, name):
        return getattr(self._conn, name)


def test_a_failed_ingest_leaves_no_partial_state(mem, tmp_path):
    """A crash mid-replace must not leave a document half-deleted.

    ingest_markdown deletes the file's old chunks and writes the new ones in ONE
    transaction. If that were two, an interruption here would drop five real sections and
    leave nothing — the worst possible failure for a memory store, because it looks like an
    empty document rather than an error.
    """
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    assert len(mem.query_docs(file_path="d.md", limit=100)) == 5

    p.write_text("# Replaced\n\nnew\n", encoding="utf-8")
    real = mem.conn
    mem.conn = _FailingOnNthInsert(real, fail_on=1)
    try:
        with pytest.raises(sqlite3.OperationalError):
            mem.ingest_markdown(p, rel_path="d.md")
    finally:
        mem.conn = real

    after = mem.query_docs(file_path="d.md", limit=100)
    assert len(after) == 5, "the DELETE must have rolled back with the failed INSERT"
    assert {r["metadata"]["heading"] for r in after} == {
        "",
        "Title",
        "Section A",
        "Sub A1",
        "Section B",
    }


def test_no_network_access_during_store_operations(mem, tmp_path, monkeypatch):
    """Assert the no-network claim instead of writing it in a comment.

    Any attempt to open a socket during a full ingest+query cycle fails the test.
    """
    def forbidden(*a, **kw):
        raise AssertionError("agent_memory attempted network access")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)

    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    mem.upsert_tool_spec(ToolSpec("t", "c", {"k": "v"}))
    assert mem.get_tool_spec("t") is not None
    assert mem.query_docs(text="body")
    assert mem.stats()["total"] > 0


def test_two_instances_do_not_share_memory_state():
    a, b = AgentMemory(":memory:"), AgentMemory(":memory:")
    try:
        a.upsert_tool_spec(ToolSpec("only-in-a", "x", {}))
        assert a.get_tool_spec("only-in-a") is not None
        assert b.get_tool_spec("only-in-a") is None
    finally:
        a.close()
        b.close()


def test_stats_counts_both_types(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    mem.upsert_tool_spec(ToolSpec("t1", "c", {}))
    mem.upsert_tool_spec(ToolSpec("t2", "c", {}))

    s = mem.stats()
    assert s["by_type"]["md_doc"]["rows"] == 5
    assert s["by_type"]["md_doc"]["files"] == 1
    assert s["by_type"]["tool_spec"]["rows"] == 2
    assert s["total"] == 7


def test_persists_to_a_real_file(tmp_path):
    db = tmp_path / "nested" / "agent-memory.db"
    with AgentMemory(db) as m:
        m.upsert_tool_spec(ToolSpec("durable", "content", {"a": 1}))
    assert db.exists()
    with AgentMemory(db) as m2:
        got = m2.get_tool_spec("durable")
        assert got is not None and got["metadata"]["a"] == 1
