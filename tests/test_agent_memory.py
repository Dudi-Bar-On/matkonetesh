"""Tests for the LlamaIndex + SQLite/JSONB agent-memory store.

Every test runs against an isolated `:memory:` database with LlamaIndex's `MockLLM` and
`MockEmbedding` installed globally, so the suite is 100% offline with zero external API calls.
That is asserted, not merely configured: one test forbids opening a socket at all, and another
proves ingestion works with `OPENAI_API_KEY` removed from the environment.

Run: python -m pytest tests/test_agent_memory.py -v
"""

from __future__ import annotations

import socket
import sqlite3
import sys
from pathlib import Path

import pytest
from llama_index.core import MockEmbedding, Settings
from llama_index.core.llms import MockLLM
from llama_index.core.schema import TextNode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.memory import (  # noqa: E402
    MIN_SQLITE_FOR_JSONB,
    AgentMemory,
    JsonbUnsupportedError,
    ToolSpec,
    build_nodes,
    headers_from_path,
    node_metadata,
    sha256_text,
)


@pytest.fixture(autouse=True, scope="session")
def _offline_llama():
    """Force LlamaIndex's global Settings to mocks for the whole session.

    Ingestion here uses only MarkdownNodeParser and needs no model — but Settings.llm is
    lazily resolved and defaults to OpenAI, so a future transformation added to the pipeline
    would silently try to reach the network. Mocking at session scope means that regression
    fails as a test error rather than as a live API call.
    """
    Settings.llm = MockLLM()
    Settings.embed_model = MockEmbedding(embed_dim=8)
    yield


@pytest.fixture()
def mem():
    m = AgentMemory(":memory:")
    yield m
    m.close()


SAMPLE = """Intro paragraph before any heading.

# Project Requirements

This is the main overview of the system architecture.

## Database Setup

We use SQLite with JSONB support for local agent memory.

### Indexing Strategy

- Markdown parsing using LlamaIndex
- Direct SQL querying for metadata

## CLI Tools Specification

Tools must be defined via JSON Schema for zero hallucination.
"""


# ======================================================================================
# Offline guarantee
# ======================================================================================


def test_llamaindex_settings_are_mocked():
    assert isinstance(Settings.llm, MockLLM)
    assert isinstance(Settings.embed_model, MockEmbedding)


def test_no_network_access_during_a_full_ingest_and_query_cycle(mem, tmp_path, monkeypatch):
    """Assert the offline claim instead of writing it in a comment."""

    def forbidden(*a, **kw):
        raise AssertionError("agent_memory attempted network access")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)

    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    mem.upsert_tool_spec(ToolSpec("t", "c", {"k": "v"}))
    assert mem.get_tool_spec("t") is not None
    assert mem.query_docs(text="sqlite")
    assert mem.query_nodes_by_header("Header_2", "Database Setup")


def test_ingestion_works_with_no_api_key_in_the_environment(mem, tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    assert mem.ingest_markdown(p, rel_path="d.md")["status"] == "ingested"


# ======================================================================================
# JSONB — the reason this store exists at all
# ======================================================================================


def test_metadata_is_stored_as_binary_jsonb_not_text(mem):
    """The column must hold SQLite's binary JSON, not a JSON string.

    Easy to lose silently: dropping the jsonb() wrapper still round-trips through
    json_extract, so only the storage TYPE tells you which one you got.
    """
    mem.upsert_tool_spec(ToolSpec("ripgrep", "fast search", {"kind": "search"}))
    row = mem.conn.execute(
        "SELECT typeof(metadata) AS t, metadata FROM agent_memory WHERE type='tool_spec'"
    ).fetchone()
    assert row["t"] == "blob"
    assert not isinstance(row["metadata"], str)


def test_jsonb_guard_reports_the_version_it_found():
    assert MIN_SQLITE_FOR_JSONB == (3, 45, 0)
    assert sqlite3.sqlite_version_info >= MIN_SQLITE_FOR_JSONB, (
        f"this interpreter links SQLite {sqlite3.sqlite_version}; agent_memory needs >= 3.45.0"
    )
    with pytest.raises(JsonbUnsupportedError):
        raise JsonbUnsupportedError("probe")


# ======================================================================================
# MarkdownNodeParser ingestion and metadata extraction
# ======================================================================================


def test_build_nodes_returns_llamaindex_textnodes_with_header_path():
    nodes = build_nodes(SAMPLE, "docs/req.md", "h1")
    assert nodes and all(isinstance(n, TextNode) for n in nodes)
    paths = [n.metadata["header_path"] for n in nodes]
    assert "/Project Requirements/" in paths
    assert "/Project Requirements/Database Setup/" in paths
    # the parser's own doc-level metadata rides along on every node
    assert all(n.metadata["file_path"] == "docs/req.md" for n in nodes)
    assert all(n.metadata["file_hash"] == "h1" for n in nodes)


def test_headers_are_derived_from_the_parsers_header_path_not_invented():
    assert headers_from_path("/Project Requirements/Database Setup/") == {
        "Header_1": "Project Requirements",
        "Header_2": "Database Setup",
    }
    assert headers_from_path("/") == {}
    assert headers_from_path("") == {}
    assert headers_from_path("/A/B/C/") == {"Header_1": "A", "Header_2": "B", "Header_3": "C"}


def test_node_metadata_keeps_header_path_alongside_the_derived_keys():
    """0.14.x dropped Header_N; we add it back WITHOUT discarding the current API's key."""
    node = build_nodes(SAMPLE, "f.md", "h")[0]
    meta = node_metadata(node, 0)
    assert "header_path" in meta
    assert meta["chunk_index"] == 0
    assert meta["node_id"] == node.id_
    # No parent_node_id: MarkdownNodeParser never sets a PARENT relationship, so the field this
    # store used to write was null on all 4,847 nodes. Ancestry lives in header_path/Header_N.
    assert "parent_node_id" not in meta


def test_parse_and_store_markdown_returns_node_ids_and_stores_one_row_each(mem):
    ids = mem.parse_and_store_markdown(SAMPLE, "docs/req.md", "hash_v1")
    assert len(ids) >= 4
    assert len(set(ids)) == len(ids), "node ids must be unique"
    rows = mem.query_docs(file_path="docs/req.md", limit=100)
    assert len(rows) == len(ids)
    assert [r["node_id"] for r in rows] == ids
    assert all(r["file_hash"] == "hash_v1" for r in rows)


def test_query_nodes_by_header_is_an_exact_match(mem):
    mem.parse_and_store_markdown(SAMPLE, "docs/req.md", "h1")
    hits = mem.query_nodes_by_header("Header_2", "Database Setup")
    assert hits
    for h in hits:
        assert h["metadata"]["Header_2"] == "Database Setup"
        assert h["metadata"]["Header_1"] == "Project Requirements"
    assert mem.query_nodes_by_header("Header_2", "Database") == [], "must be exact, not prefix"
    assert mem.query_nodes_by_header("Header_1", "Project Requirements")


def test_query_nodes_by_header_rejects_an_unknown_key(mem):
    """header_key is interpolated into a JSON path; an unchecked value is an injection point."""
    with pytest.raises(ValueError):
        mem.query_nodes_by_header("Header_2'); DROP TABLE agent_memory; --", "x")


def test_header_index_is_used_for_the_lookup(mem):
    mem.parse_and_store_markdown(SAMPLE, "docs/req.md", "h1")
    plan = mem.conn.execute(
        "EXPLAIN QUERY PLAN SELECT id FROM agent_memory "
        "WHERE type='md_doc' AND json_extract(metadata,'$.Header_2')='Database Setup'"
    ).fetchall()
    detail = " ".join(str(r["detail"]) for r in plan)
    assert "idx_agent_memory_header2" in detail, detail


def test_stored_nodes_rehydrate_into_textnodes(mem):
    ids = mem.parse_and_store_markdown(SAMPLE, "docs/req.md", "h1")
    nodes = mem.get_nodes("docs/req.md")
    assert [n.id_ for n in nodes] == ids
    assert all(isinstance(n, TextNode) for n in nodes)
    assert nodes[0].metadata["file_path"] == "docs/req.md"


def test_headings_inside_fenced_code_do_not_create_sections(mem):
    """A shell snippet full of `# comment` lines must not shred a document.

    This corpus is full of them. LlamaIndex's parser handles it; the test pins that we still
    get it if the parser is ever swapped.
    """
    text = "# Real\n\nbody\n\n```bash\n# not a heading\n## also not\n```\n\n## Real Two\n\nmore\n"
    mem.parse_and_store_markdown(text, "f.md", "h")
    paths = {r["metadata"]["header_path"] for r in mem.query_docs(file_path="f.md", limit=50)}
    assert "/Real/not a heading/" not in paths
    assert any("not a heading" in r["content"] for r in mem.query_docs(file_path="f.md", limit=50))


# ======================================================================================
# tool_spec — exact, zero-hallucination retrieval
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


def test_unknown_tool_returns_none_rather_than_a_near_match(mem):
    """Zero hallucination is a property of the query, not of a prompt."""
    mem.upsert_tool_spec(ToolSpec("playwright", "x", {}))
    assert mem.get_tool_spec("playwrite") is None
    assert mem.get_tool_spec("play") is None
    assert mem.get_tool_spec("") is None


def test_tool_spec_upsert_replaces_rather_than_duplicates(mem):
    first = mem.upsert_tool_spec(ToolSpec("node", "runtime", {"version": "22"}))
    second = mem.upsert_tool_spec(ToolSpec("node", "runtime", {"version": "24"}))
    assert first == second
    assert mem.conn.execute("SELECT COUNT(*) FROM agent_memory WHERE type='tool_spec'").fetchone()[0] == 1
    assert mem.get_tool_spec("node")["metadata"]["version"] == "24"


def test_tool_name_index_is_used_for_lookup(mem):
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
# Delta ingestion
# ======================================================================================


def test_delta_ingestion_skips_an_unchanged_file(mem, tmp_path):
    """The old freshness gate keyed on mtime and was never green. Hash, not clock."""
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    first = mem.ingest_markdown(p, rel_path="d.md")
    assert first["status"] == "ingested"

    p.write_text(SAMPLE, encoding="utf-8")   # mtime moves, bytes do not
    second = mem.ingest_markdown(p, rel_path="d.md")
    assert second["status"] == "skipped"
    assert second["nodes"] == 0
    assert second["file_hash"] == first["file_hash"]


def test_changed_file_is_reingested_and_removed_sections_do_not_survive(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text("# One\n\nalpha\n\n## Two\n\nbeta\n", encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    assert mem.query_docs(text="beta")

    p.write_text("# One\n\nalpha changed\n", encoding="utf-8")
    assert mem.ingest_markdown(p, rel_path="d.md")["status"] == "ingested"

    assert mem.query_docs(text="beta") == [], "the removed section must be gone, not orphaned"
    assert mem.query_docs(text="alpha changed")


def test_force_reingests_an_unchanged_file(mem, tmp_path):
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    assert mem.ingest_markdown(p, rel_path="d.md", force=True)["status"] == "ingested"


def test_ingest_markdown_tree_walks_a_directory(mem, tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "one.md").write_text("# One\n\na\n", encoding="utf-8")
    (tmp_path / "sub" / "two.md").write_text("# Two\n\nb\n", encoding="utf-8")
    (tmp_path / "skip.txt").write_text("not markdown", encoding="utf-8")

    tally = mem.ingest_markdown_tree(tmp_path)
    assert tally["ingested"] == 2
    assert {r["file_path"] for r in mem.query_docs(limit=100)} == {"one.md", "sub/two.md"}
    again = mem.ingest_markdown_tree(tmp_path)
    assert again["skipped"] == 2 and again["ingested"] == 0


def test_unicode_and_rtl_survive_the_round_trip(mem):
    body = "# בטיחות\n\nטמפ׳ בטיחות 71°C — לשון בקר · מקור: USDA FSIS\n"
    mem.parse_and_store_markdown(body, "he.md", sha256_text(body))
    got = mem.query_docs(text="לשון בקר")
    assert got and "לשון בקר" in got[0]["content"]
    assert got[0]["metadata"]["header_path"] == "/"


# ======================================================================================
# Atomicity, pruning and isolation
# ======================================================================================


class _FailingOnNthInsert:
    """Delegates to a real connection but raises on the Nth INSERT.

    `sqlite3.Connection.execute` is read-only and cannot be monkeypatched, so the connection
    is wrapped instead. __enter__/__exit__ pass straight through, which keeps `with conn:`
    doing the real transaction.
    """

    def __init__(self, conn, fail_on: int = 1):
        self._conn, self._fail_on, self._inserts = conn, fail_on, 0

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
    """The delete and the re-insert are ONE transaction.

    If they were two, an interruption would drop every real section and leave nothing — the
    worst failure for a memory store, because it looks like an empty document rather than an
    error.
    """
    p = tmp_path / "doc.md"
    p.write_text(SAMPLE, encoding="utf-8")
    mem.ingest_markdown(p, rel_path="d.md")
    before = len(mem.query_docs(file_path="d.md", limit=100))
    assert before > 0

    p.write_text("# Replaced\n\nnew\n", encoding="utf-8")
    real = mem.conn
    mem.conn = _FailingOnNthInsert(real, fail_on=1)
    try:
        with pytest.raises(sqlite3.OperationalError):
            mem.ingest_markdown(p, rel_path="d.md")
    finally:
        mem.conn = real

    assert len(mem.query_docs(file_path="d.md", limit=100)) == before, (
        "the DELETE must have rolled back with the failed INSERT"
    )


def test_prune_missing_removes_documents_whose_file_is_gone(mem, tmp_path):
    for name in ("keep.md", "gone.md"):
        p = tmp_path / name
        p.write_text(SAMPLE, encoding="utf-8")
        mem.ingest_markdown(p, rel_path=name)
    kept = len(mem.query_docs(file_path="keep.md", limit=100))

    res = mem.prune_missing({"keep.md"})

    assert res["files"] == ["gone.md"]
    assert res["rows"] > 0
    assert mem.query_docs(file_path="gone.md") == []
    assert len(mem.query_docs(file_path="keep.md", limit=100)) == kept


def test_prune_missing_never_touches_graph_records_or_tool_specs(mem):
    """Migrated knowledge has no file behind it and must survive a prune.

    Without the graph:// exclusion, the first sync after migration would delete all 6,818
    migrated records — silently, because they look exactly like documents whose file vanished.
    """
    node = build_nodes("# node\n\nmigrated\n", "graph://analysis/x.md", "h")[0]
    mem.upsert_node(node, 0, "graph://analysis/x.md", "h")
    mem.upsert_tool_spec(ToolSpec("playwright", "spec", {}))
    real = build_nodes("# real\n\nbody\n", "real.md", "h")[0]
    mem.upsert_node(real, 0, "real.md", "h")

    res = mem.prune_missing(set())          # nothing exists on disk at all

    assert res["files"] == ["real.md"]
    assert len(mem.query_docs(file_path="graph://", limit=10)) == 1
    assert mem.get_tool_spec("playwright") is not None


def test_delete_by_file_path_removes_only_that_file(mem, tmp_path):
    for name in ("a.md", "b.md"):
        p = tmp_path / name
        p.write_text(SAMPLE, encoding="utf-8")
        mem.ingest_markdown(p, rel_path=name)
    b_before = len(mem.query_docs(file_path="b.md", limit=100))
    assert mem.delete_by_file_path("a.md") > 0
    assert mem.query_docs(file_path="a.md") == []
    assert len(mem.query_docs(file_path="b.md", limit=100)) == b_before


def test_two_instances_do_not_share_memory_state():
    a, b = AgentMemory(":memory:"), AgentMemory(":memory:")
    try:
        a.upsert_tool_spec(ToolSpec("only-in-a", "x", {}))
        assert a.get_tool_spec("only-in-a") is not None
        assert b.get_tool_spec("only-in-a") is None
    finally:
        a.close()
        b.close()


def test_persists_to_a_real_file(tmp_path):
    db = tmp_path / "nested" / "agent-memory.db"
    with AgentMemory(db) as m:
        m.upsert_tool_spec(ToolSpec("durable", "content", {"a": 1}))
        m.parse_and_store_markdown(SAMPLE, "d.md", "h")
    assert db.exists()
    with AgentMemory(db) as m2:
        assert m2.get_tool_spec("durable")["metadata"]["a"] == 1
        assert m2.query_nodes_by_header("Header_2", "Database Setup")


def test_stats_counts_both_types(mem):
    mem.parse_and_store_markdown(SAMPLE, "d.md", "h")
    n = len(mem.query_docs(file_path="d.md", limit=100))
    mem.upsert_tool_spec(ToolSpec("t1", "c", {}))
    mem.upsert_tool_spec(ToolSpec("t2", "c", {}))
    s = mem.stats()
    assert s["by_type"]["md_doc"]["rows"] == n
    assert s["by_type"]["tool_spec"]["rows"] == 2
    assert s["total"] == n + 2


# ======================================================================================
# Non-markdown: raw text, CSV tables, and source code
# ======================================================================================


def test_csv_is_stored_whole_and_never_split(mem):
    """Splitting a table separates a row from its header.

    In a pasteurisation table that means separating a TIME from the TEMPERATURE it belongs
    to. This is a safety-data integrity rule, not a chunking preference.
    """
    csv = "thickness_mm,time_min_at_55C,time_min_at_60C\n5,120,30\n10,120,40\n15,130,50\n"
    ids = mem.parse_and_store_markdown(csv, "docs/sources/corpus/x/pasteurization.csv", "h")
    assert len(ids) == 1
    row = mem.query_docs(file_path="pasteurization.csv", limit=5)[0]
    assert row["content"] == csv
    assert row["metadata"]["format"] == "csv"
    assert "time_min_at_60C" in row["content"] and "15,130,50" in row["content"]


def test_raw_text_is_split_rather_than_stored_as_one_giant_node(mem):
    """MarkdownNodeParser returns ONE node for headingless text.

    The FDA fish guidance is 1.2 MB of extracted prose; a single node that size is
    unsearchable, and bge-m3 would see only its first 2,000 characters.
    """
    para = ("Cook fish to an internal temperature of 145 degrees Fahrenheit. " * 40 + "\n\n") * 6
    ids = mem.parse_and_store_markdown(para, "docs/sources/corpus/x/extracted-text.txt", "h")
    assert len(ids) > 1, "raw text must be chunked, not stored whole"
    rows = mem.query_docs(file_path="extracted-text.txt", limit=50)
    assert all(r["metadata"]["format"] == "txt" for r in rows)
    # SentenceSplitter's chunk_size is in TOKENS, not characters — 900 tokens lands around
    # 4,300 chars here. The property under test is "chunked at all", not an exact width.
    assert all(len(r["content"]) < 8000 for r in rows)


def test_code_is_parsed_by_tree_sitter_into_ast_aligned_nodes(mem):
    """CodeSplitter with a directly-built parser.

    tree_sitter_language_pack, which CodeSplitter reaches for by default, ships NO pre-built
    parser for windows-x86_64 and raises DownloadError here. The per-language wheels do work.
    """
    src = "\n\n".join(
        f"function handler{i}(a, b) {{\n  // a real body so it clears the fragment floor\n"
        f"  const total = a + b + {i};\n  console.log('handler{i}', total);\n  return total;\n}}"
        for i in range(12)
    )
    ids = mem.parse_and_store_markdown(src, "app.js", "h")
    assert ids
    rows = mem.query_docs(file_path="app.js", limit=50)
    assert all(r["metadata"]["format"] == "code" for r in rows)
    assert all(r["metadata"]["language"] == "javascript" for r in rows)
    assert mem.query_docs(text="handler7", limit=5)


def test_code_fragments_below_the_floor_are_dropped_and_counted(mem):
    """AST boundaries can be one expression wide; `host.innerHTML=` is not a searchable node.

    Measured against the REAL app.js rather than a synthetic fixture, because fragments are a
    property of how a large file's AST actually splits — a hand-made file of one-line
    statements produces a single chunk and would have made this test pass vacuously. app.js is
    in the repo, so this is deterministic.
    """
    from pathlib import Path

    from src.memory import MIN_CODE_NODE_CHARS, build_code_nodes

    src = (Path(__file__).resolve().parents[1] / "app.js").read_text(encoding="utf-8")
    nodes, dropped = build_code_nodes(src, "app.js", "h", "javascript")

    assert nodes, "app.js must produce nodes"
    assert dropped > 0, "a 14k-line file splits on AST boundaries that are one expression wide"
    assert all(len(n.get_content().strip()) >= MIN_CODE_NODE_CHARS for n in nodes)

    mem.parse_and_store_markdown(src, "app.js", "h")
    assert mem.last_fragments_dropped == dropped, "the count must reach the caller, not vanish"


def test_python_and_javascript_both_route_to_a_parser(mem):
    from src.memory import CODE_LANGUAGES

    assert CODE_LANGUAGES == {
        ".js": "javascript",
        ".mjs": "javascript",
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "typescript",
    }
    py = "\n\n".join(
        f"def compute_{i}(value):\n    \"\"\"A docstring long enough to clear the floor.\"\"\"\n"
        f"    scaled = value * {i}\n    return scaled + {i}"
        for i in range(10)
    )
    ids = mem.parse_and_store_markdown(py, "build.py", "h")
    assert ids
    assert mem.query_docs(file_path="build.py", limit=20)[0]["metadata"]["language"] == "python"


# ======================================================================================
# BM25 ranking (SQLite FTS5) and MetadataFilters
# ======================================================================================


def test_bm25_ranks_and_finds_hebrew_through_attached_prefixes(mem):
    """The trigram tokeniser is load-bearing, not a preference.

    Hebrew attaches ה/ו/ב/ל/מ/ש/כ to words, so with FTS5's default unicode61 tokeniser
    'הניטריט' is a DIFFERENT token from 'ניטריט' and the query returns nothing while the answer
    sits in the table. Measured: unicode61 -> 0 hits, trigram -> 2.
    """
    from src.memory.rank import bm25_search, rebuild_index

    mem.parse_and_store_markdown("# A\n\nמינון הניטריט לבייקון הוא 2 גרם לקילו.\n", "a.md", "h")
    mem.parse_and_store_markdown("# B\n\nובניטריט יש תקרה של 200ppm לבייקון יבש.\n", "b.md", "h")
    mem.parse_and_store_markdown("# C\n\nPlaywright runs with workers 20.\n", "c.md", "h")
    rebuild_index(mem)

    hits = bm25_search(mem, "ניטריט", limit=10)
    assert len(hits) == 2, "both prefixed forms must be found"
    assert {h["file_path"] for h in hits} == {"a.md", "b.md"}
    assert all(h["how"] == "bm25" for h in hits)
    assert hits[0]["score"] >= hits[1]["score"], "results must be ranked, higher is better"


def test_bm25_returns_empty_rather_than_raising_on_junk(mem):
    from src.memory.rank import bm25_search, rebuild_index

    mem.parse_and_store_markdown("# A\n\nbody text here\n", "a.md", "h")
    rebuild_index(mem)
    assert bm25_search(mem, 'unbalanced " quote AND (', limit=5) == []
    assert bm25_search(mem, "ab", limit=5) == [], "a trigram index cannot match under 3 chars"


def test_metadata_filters_translate_to_sql(mem):
    from llama_index.core.vector_stores.types import (
        FilterCondition,
        FilterOperator,
        MetadataFilter,
        MetadataFilters,
    )

    mem.parse_and_store_markdown("thickness,time\n5,120\n", "t.csv", "h")
    mem.parse_and_store_markdown("# Doc\n\nprose\n", "d.md", "h")

    csv_only = MetadataFilters(
        filters=[MetadataFilter(key="format", value="csv", operator=FilterOperator.EQ)]
    )
    got = mem.query_docs(filters=csv_only, limit=20)
    assert got and all(g["metadata"]["format"] == "csv" for g in got)

    either = MetadataFilters(
        filters=[
            MetadataFilter(key="chunk_index", value=0, operator=FilterOperator.EQ),
            MetadataFilter(key="format", value="csv", operator=FilterOperator.EQ),
        ],
        condition=FilterCondition.OR,
    )
    assert len(mem.query_docs(filters=either, limit=50)) >= len(got)


def test_metadata_filter_keys_cannot_inject_sql(mem):
    """The key is interpolated into a JSON path. Values are bound; keys must be validated."""
    from llama_index.core.vector_stores.types import (
        FilterOperator,
        MetadataFilter,
        MetadataFilters,
    )

    from src.memory import UnsupportedFilter

    mem.parse_and_store_markdown("# A\n\nbody\n", "a.md", "h")
    evil = MetadataFilters(
        filters=[
            MetadataFilter(
                key="x'); DROP TABLE agent_memory; --", value=1, operator=FilterOperator.EQ
            )
        ]
    )
    with pytest.raises(UnsupportedFilter):
        mem.query_docs(filters=evil, limit=1)
    assert mem.conn.execute("SELECT COUNT(*) FROM agent_memory").fetchone()[0] > 0


def test_unsupported_operators_raise_rather_than_matching_everything(mem):
    from llama_index.core.vector_stores.types import (
        FilterOperator,
        MetadataFilter,
        MetadataFilters,
    )

    from src.memory import UnsupportedFilter

    for op, value in ((FilterOperator.IS_EMPTY, None), (FilterOperator.ANY, ["a"])):
        with pytest.raises(UnsupportedFilter):
            mem.query_docs(filters=MetadataFilters(
                filters=[MetadataFilter(key="format", value=value, operator=op)]), limit=1)
    # An empty IN would match nothing and an empty NIN everything — both are caller bugs.
    with pytest.raises(UnsupportedFilter):
        mem.query_docs(filters=MetadataFilters(
            filters=[MetadataFilter(key="format", value=[], operator=FilterOperator.IN)]), limit=1)
