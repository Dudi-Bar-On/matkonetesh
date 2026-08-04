"""Agent memory — LlamaIndex ingestion over an in-process SQLite/JSONB store.

Replaces `graphify` as this project's agent-memory layer (owner decision, 2026-08-04).

WHY THIS EXISTS, and it is not a preference. The graph it replaces was a 22 MB JSON file
rebuilt out of process by an external CLI. Its freshness gate never once went green — 115
documents newer than the graph, and `graph-freshness.yml` failed 8 of its 8 runs. A store that
is never current is not a memory; it is an artifact. This one is a single file, read in
process, updated by content hash, and queried with SQL.

ARCHITECTURE

- **Chunking is LlamaIndex's**, not ours. `MarkdownNodeParser` inside an `IngestionPipeline`
  splits `.md` into `TextNode`s along headings. Both run with **no LLM and no embedding model
  configured** — verified, not assumed — so ingestion is deterministic, offline and instant.
- **Storage is SQLite with JSONB.** `metadata` is written through `jsonb(?)`, so it is stored
  as SQLite's binary JSON rather than a JSON string. That is a hard floor of SQLite 3.45.0
  (Jan 2024) and the reason this project moved to Python 3.14 / SQLite 3.50.4 — 3.10 shipped
  3.37.2, where `jsonb()` does not exist. `assert_jsonb_support()` fails at connect time.
- **Retrieval is exact, never generative.** `json_extract` over an indexed expression. Nothing
  in this module can hallucinate a tool spec; it either returns the stored row or None.

HEADER METADATA — a deliberate, owner-approved choice, stated because it is not obvious.
llama-index-core 0.14.23's `MarkdownNodeParser` emits a single `header_path` key
('/Project Requirements/Database Setup/'). It does NOT emit `Header_1`/`Header_2`, which older
versions did and which exact-match querying wants. We store the library's `header_path`
verbatim — the current API is the source of truth — and additionally derive `Header_1..N` from
it, so `json_extract(metadata,'$.Header_2') = 'Database Setup'` is an indexed exact hit.
Derived, never invented: every Header_N comes from splitting the parser's own header_path.

- **Delta by content hash, not mtime.** mtime was the weak link in the old freshness gate: it
  flips on checkout and on any byte-identical rewrite. SHA-256 of file content does not.
- **Atomic.** Every mutating method runs in one transaction and commits or rolls back whole.
- **No network, ever.** Nothing here opens a socket. The test suite asserts that.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import CodeSplitter, MarkdownNodeParser, SentenceSplitter
from llama_index.core.schema import BaseNode, Document, TextNode

__all__ = [
    "AgentMemory",
    "ToolSpec",
    "JsonbUnsupportedError",
    "MIN_SQLITE_FOR_JSONB",
    "build_nodes",
    "build_text_nodes",
    "build_code_nodes",
    "CODE_LANGUAGES",
    "MIN_CODE_NODE_CHARS",
    "headers_from_path",
    "sha256_text",
    "sha256_file",
]

# jsonb() / json_extract over jsonb landed here. Below it, every write in this module fails.
MIN_SQLITE_FOR_JSONB = (3, 45, 0)

MEMORY_TYPES = ("md_doc", "tool_spec")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_memory (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT,                      -- LlamaIndex TextNode.id_ (NULL for tool_spec)
    content     TEXT    NOT NULL,
    type        TEXT    NOT NULL CHECK (type IN ('md_doc', 'tool_spec')),
    file_path   TEXT,
    file_hash   TEXT,
    metadata    BLOB,                      -- JSONB (binary), written via jsonb(?)
    created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_type       ON agent_memory (type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_file_path  ON agent_memory (file_path);

-- Exact-match lookup of a tool by name without scanning every row's JSON.
CREATE INDEX IF NOT EXISTS idx_agent_memory_tool_name
    ON agent_memory (json_extract(metadata, '$.tool_name'));

-- Header querying, the shape the owner's example uses.
CREATE INDEX IF NOT EXISTS idx_agent_memory_header2
    ON agent_memory (json_extract(metadata, '$.Header_2'));
CREATE INDEX IF NOT EXISTS idx_agent_memory_header_path
    ON agent_memory (json_extract(metadata, '$.header_path'));

-- Identity of a document chunk: which file, and which node within it. This is what makes
-- ingestion idempotent instead of appending duplicates on every run.
CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_memory_doc_node
    ON agent_memory (file_path, json_extract(metadata, '$.chunk_index'))
    WHERE type = 'md_doc';

-- A tool name is unique across the store; re-ingesting a spec replaces it.
CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_memory_tool_name
    ON agent_memory (json_extract(metadata, '$.tool_name'))
    WHERE type = 'tool_spec';
"""


class JsonbUnsupportedError(RuntimeError):
    """Raised when the linked SQLite is too old for JSONB."""


@dataclass(frozen=True)
class ToolSpec:
    """A CLI tool or technology specification, stored as queryable JSONB."""

    tool_name: str
    content: str
    metadata: dict[str, Any]


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def assert_jsonb_support(conn: sqlite3.Connection) -> None:
    """Fail at connect time, with the actual version, rather than at first write.

    Not hypothetical: this project ran on SQLite 3.37.2 until 2026-08-04, where `jsonb()`
    raises `no such function`.
    """
    raw = conn.execute("select sqlite_version()").fetchone()[0]
    parts = tuple(int(p) for p in raw.split(".")[:3])
    if parts < MIN_SQLITE_FOR_JSONB:
        need = ".".join(str(p) for p in MIN_SQLITE_FOR_JSONB)
        raise JsonbUnsupportedError(
            f"agent_memory requires SQLite >= {need} for JSONB; this interpreter links {raw}. "
            "On CPython the bundled version is pinned per branch in PCbuild/get_externals.bat "
            "(3.10 -> 3.37.2, 3.14 -> 3.50.4)."
        )
    try:
        conn.execute("select json_extract(jsonb('{\"a\":1}'), '$.a')").fetchone()
    except sqlite3.OperationalError as exc:  # pragma: no cover - only on a broken build
        raise JsonbUnsupportedError(f"SQLite reports {raw} but jsonb() is unavailable: {exc}") from exc


# --------------------------------------------------------------------------------------
# LlamaIndex ingestion
# --------------------------------------------------------------------------------------


def headers_from_path(header_path: str) -> dict[str, str]:
    """Derive Header_1..N from MarkdownNodeParser's header_path.

    '/Project Requirements/Database Setup/' -> {'Header_1': 'Project Requirements',
                                                'Header_2': 'Database Setup'}

    Purely derived from what the parser produced — nothing is inferred or invented. This
    exists because 0.14.x dropped the Header_N keys that exact-match querying wants, while
    keeping the same information in a single joined string.
    """
    parts = [p for p in (header_path or "").split("/") if p]
    return {f"Header_{i}": p for i, p in enumerate(parts, start=1)}


def build_nodes(text: str, file_path: str, file_hash: str) -> list[BaseNode]:
    """Run LlamaIndex's markdown pipeline over one document.

    The pipeline is constructed per call and holds no LLM, no embedding model and no vector
    store — `MarkdownNodeParser` is a pure text transformation. That is what lets ingestion be
    deterministic and offline; it is verified by the no-network test rather than assumed.
    """
    pipeline = IngestionPipeline(transformations=[MarkdownNodeParser()])
    doc = Document(text=text, metadata={"file_path": file_path, "file_hash": file_hash})
    return pipeline.run(documents=[doc])


def build_text_nodes(text: str, file_path: str, file_hash: str) -> list[BaseNode]:
    """Parse NON-markdown text — raw extracted PDF text, CSV tables, regulatory XML.

    MarkdownNodeParser is the wrong tool here: these files have no headings, so it returns one
    node per file. The FDA fish guidance alone is 1.2 MB of extracted prose, and a single node
    that size is unsearchable and unembeddable — bge-m3 sees only its first 2,000 characters.

    A CSV is deliberately NOT split. These tables are small (most under 2 KB) and splitting one
    separates a row from its header, which for a pasteurisation table means separating a time
    from the temperature it belongs to. That is a safety-data integrity question, not a chunking
    preference.

    SentenceSplitter needs no LLM and no embedding model — verified before adoption.
    """
    if file_path.endswith(".csv"):
        return [TextNode(text=text, metadata={"file_path": file_path, "file_hash": file_hash,
                                              "header_path": "/", "format": "csv"})]
    splitter = SentenceSplitter(chunk_size=900, chunk_overlap=120)
    doc = Document(text=text, metadata={"file_path": file_path, "file_hash": file_hash})
    nodes = splitter.get_nodes_from_documents([doc])
    for n in nodes:
        n.metadata.setdefault("header_path", "/")
        n.metadata["format"] = file_path.rsplit(".", 1)[-1]
    return nodes


# Extension -> tree-sitter language. Only what a parser is actually installed for.
CODE_LANGUAGES = {".js": "javascript", ".mjs": "javascript", ".py": "python",
                  ".ts": "typescript", ".tsx": "typescript"}

# A code node shorter than this is a fragment — `host.innerHTML=` and the like. CodeSplitter
# cuts on AST boundaries, and some boundaries are one expression wide. Measured on app.js:
# 24% of nodes fall under this at the chosen settings. They are DROPPED, and the count is
# returned rather than swallowed, because a store full of 15-character fragments answers
# every query with noise.
MIN_CODE_NODE_CHARS = 120


def _code_parser(language: str):
    """Build the tree-sitter parser directly.

    `tree_sitter_language_pack`, which CodeSplitter reaches for by default, ships NO pre-built
    parsers for windows-x86_64 — it offers linux-x86_64, macos-arm64, linux-aarch64 and
    macos-x86_64, and raises DownloadError here. The per-language wheels do work, and
    CodeSplitter accepts a `parser` argument, so we build it ourselves and never touch the pack.
    """
    from tree_sitter import Language, Parser

    if language == "javascript":
        import tree_sitter_javascript as mod

        return Parser(Language(mod.language()))
    if language == "python":
        import tree_sitter_python as mod

        return Parser(Language(mod.language()))
    if language == "typescript":
        # A separate entry point, not .language() — the wheel exposes language_typescript()
        # and language_tsx() rather than one grammar.
        import tree_sitter_typescript as mod

        return Parser(Language(mod.language_typescript()))
    raise ValueError(f"no tree-sitter parser wired for {language!r}")


def build_code_nodes(
    text: str, file_path: str, file_hash: str, language: str
) -> tuple[list[BaseNode], int]:
    """Parse source code into AST-aligned nodes. Returns (nodes, fragments_dropped).

    Settings measured on app.js (14,718 lines), not guessed:
        chunk_lines=60,  max_chars=2000 -> 1257 nodes, median 1010 ch, 33% fragments
        chunk_lines=120, max_chars=4000 ->  520 nodes, median 2954 ch, 24% fragments  <- chosen
        chunk_lines=200, max_chars=6000 ->  310 nodes, median 5025 ch, 17% fragments
    The 200-line setting has the fewest fragments but the worst embeddings: bge-m3 sees only the
    first 2,000 characters of a node, so a 5 KB node loses most of itself to the vector.
    """
    splitter = CodeSplitter(
        language=language,
        chunk_lines=120,
        chunk_lines_overlap=10,
        max_chars=4000,
        parser=_code_parser(language),
    )
    doc = Document(text=text, metadata={"file_path": file_path, "file_hash": file_hash})
    raw = splitter.get_nodes_from_documents([doc])
    kept = [n for n in raw if len(n.get_content().strip()) >= MIN_CODE_NODE_CHARS]
    for n in kept:
        n.metadata.setdefault("header_path", "/")
        n.metadata["format"] = "code"
        n.metadata["language"] = language
    return kept, len(raw) - len(kept)


def node_metadata(node: BaseNode, index: int, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """The JSONB payload for one node: the parser's own metadata plus what we can query on."""
    meta: dict[str, Any] = dict(node.metadata)
    meta.update(headers_from_path(meta.get("header_path", "")))
    meta["chunk_index"] = index
    meta["node_id"] = node.id_
    # A `parent_node_id` field lived here until 2026-08-04 and was DEAD: MarkdownNodeParser sets
    # NEXT, PREVIOUS and SOURCE relationships but never PARENT, so node.parent_node is None on
    # every node — measured at 0 non-null across all 4,847 live nodes. A derived field nothing
    # can read is exactly what DoD §3.5 forbids, and writing it implied a hierarchy the parser
    # does not actually provide. Section ancestry comes from header_path / Header_N, which are
    # real. If sibling navigation is ever wanted, node.prev_node / node.next_node DO carry it.
    if extra:
        meta.update(extra)
    return meta


# --------------------------------------------------------------------------------------
# The store
# --------------------------------------------------------------------------------------


class AgentMemory:
    """SQLite-backed agent memory with LlamaIndex-parsed document nodes.

        with AgentMemory("agent-memory.db") as mem:
            mem.ingest_markdown("docs/x.md")
            mem.query_nodes_by_header("Header_2", "Database Setup")
    """

    def __init__(self, db_path: str | Path = ":memory:") -> None:
        self.db_path = str(db_path)
        if self.db_path != ":memory:":
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        assert_jsonb_support(self.conn)
        self.conn.execute("PRAGMA foreign_keys = ON")
        if self.db_path != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    def __enter__(self) -> "AgentMemory":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self.conn.close()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    # -- writes ------------------------------------------------------------------------

    def upsert_node(
        self,
        node: BaseNode,
        index: int,
        file_path: str,
        file_hash: str,
        extra_metadata: dict[str, Any] | None = None,
    ) -> int:
        """Insert or replace one LlamaIndex node. Returns its row id."""
        meta = node_metadata(node, index, extra_metadata)
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO agent_memory (node_id, content, type, file_path, file_hash, metadata, created_at)
                VALUES (?, ?, 'md_doc', ?, ?, jsonb(?), ?)
                ON CONFLICT (file_path, json_extract(metadata, '$.chunk_index'))
                  WHERE type = 'md_doc'
                DO UPDATE SET node_id    = excluded.node_id,
                              content    = excluded.content,
                              file_hash  = excluded.file_hash,
                              metadata   = excluded.metadata,
                              created_at = excluded.created_at
                """,
                (
                    node.id_,
                    node.get_content(),
                    file_path,
                    file_hash,
                    json.dumps(meta, ensure_ascii=False),
                    self._now(),
                ),
            )
            row = self.conn.execute(
                "SELECT id FROM agent_memory WHERE type='md_doc' AND file_path=? "
                "AND json_extract(metadata,'$.chunk_index')=?",
                (file_path, index),
            ).fetchone()
        return int(row["id"])

    def upsert_tool_spec(self, spec: ToolSpec, file_path: str | None = None) -> int:
        """Insert or replace a tool specification. Returns its row id.

        `tool_name` is forced into the metadata so the unique index and the lookup index can
        never disagree with the dataclass field.
        """
        meta = dict(spec.metadata)
        meta["tool_name"] = spec.tool_name
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO agent_memory (content, type, file_path, file_hash, metadata, created_at)
                VALUES (?, 'tool_spec', ?, ?, jsonb(?), ?)
                ON CONFLICT (json_extract(metadata, '$.tool_name'))
                  WHERE type = 'tool_spec'
                DO UPDATE SET content    = excluded.content,
                              file_path  = excluded.file_path,
                              file_hash  = excluded.file_hash,
                              metadata   = excluded.metadata,
                              created_at = excluded.created_at
                """,
                (
                    spec.content,
                    file_path,
                    sha256_text(spec.content),
                    json.dumps(meta, ensure_ascii=False),
                    self._now(),
                ),
            )
            row = self.conn.execute(
                "SELECT id FROM agent_memory WHERE type='tool_spec' "
                "AND json_extract(metadata,'$.tool_name')=?",
                (spec.tool_name,),
            ).fetchone()
        return int(row["id"])

    def delete_by_file_path(self, file_path: str) -> int:
        """Remove every row belonging to a file. Returns the number deleted."""
        with self.conn:
            cur = self.conn.execute("DELETE FROM agent_memory WHERE file_path = ?", (file_path,))
        return cur.rowcount

    def prune_missing(self, existing_paths: Iterable[str]) -> dict[str, Any]:
        """Delete stored documents whose file no longer exists.

        `graph://` records are migrated knowledge with no file behind them and are never
        pruned; `tool_spec` rows are likewise untouched.

        This exists because check-memory-fresh blocked a commit over exactly this gap: a
        deleted document's nodes stayed in the store as "orphaned" and no amount of syncing
        cleared them. A memory that silently keeps deleted documents is the same defect class
        as a stale one — it answers confidently from a source that is gone.
        """
        keep = set(existing_paths)
        rows = self.conn.execute(
            "SELECT DISTINCT file_path FROM agent_memory "
            "WHERE type='md_doc' AND file_path NOT LIKE 'graph://%'"
        ).fetchall()
        removed_files, removed_rows = [], 0
        for r in rows:
            fp = r["file_path"]
            if fp not in keep:
                removed_rows += self.delete_by_file_path(fp)
                removed_files.append(fp)
        return {"files": removed_files, "rows": removed_rows}

    # -- ingestion ---------------------------------------------------------------------

    def stored_file_hash(self, file_path: str) -> str | None:
        row = self.conn.execute(
            "SELECT file_hash FROM agent_memory WHERE file_path = ? LIMIT 1", (file_path,)
        ).fetchone()
        return row["file_hash"] if row else None

    def parse_and_store_markdown(
        self,
        md_content: str,
        file_path: str,
        file_hash: str,
        extra_metadata: dict[str, Any] | None = None,
    ) -> list[str]:
        """Parse markdown through LlamaIndex and store the nodes. Returns their node ids.

        The whole replace runs in ONE transaction: old nodes deleted and new ones written
        together, so an interrupted ingest cannot leave a file half-present.
        """
        ext = "." + file_path.rsplit(".", 1)[-1] if "." in file_path else ""
        self.last_fragments_dropped = 0
        if file_path.endswith(".md"):
            nodes = build_nodes(md_content, file_path, file_hash)
        elif ext in CODE_LANGUAGES:
            nodes, dropped = build_code_nodes(md_content, file_path, file_hash, CODE_LANGUAGES[ext])
            self.last_fragments_dropped = dropped
        else:
            nodes = build_text_nodes(md_content, file_path, file_hash)
        node_ids: list[str] = []
        with self.conn:
            self.conn.execute(
                "DELETE FROM agent_memory WHERE file_path = ? AND type = 'md_doc'", (file_path,)
            )
            for i, node in enumerate(nodes):
                meta = node_metadata(node, i, extra_metadata)
                self.conn.execute(
                    """
                    INSERT INTO agent_memory (node_id, content, type, file_path, file_hash, metadata, created_at)
                    VALUES (?, ?, 'md_doc', ?, ?, jsonb(?), ?)
                    """,
                    (
                        node.id_,
                        node.get_content(),
                        file_path,
                        file_hash,
                        json.dumps(meta, ensure_ascii=False),
                        self._now(),
                    ),
                )
                node_ids.append(node.id_)
        return node_ids

    def ingest_markdown(
        self,
        path: str | Path,
        rel_path: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        """Chunk and store a markdown file, skipping it when the content has not changed.

        Returns {'status': 'skipped'|'ingested', 'nodes': int, 'file_hash': str}.
        """
        p = Path(path)
        key = rel_path if rel_path is not None else str(p)
        digest = sha256_file(p)

        if not force and self.stored_file_hash(key) == digest:
            return {"status": "skipped", "nodes": 0, "file_hash": digest}

        text = p.read_text(encoding="utf-8", errors="replace")
        ids = self.parse_and_store_markdown(text, key, digest, extra_metadata)
        return {"status": "ingested", "nodes": len(ids), "file_hash": digest}

    def ingest_markdown_tree(
        self,
        root: str | Path,
        pattern: str = "**/*.md",
        rel_to: str | Path | None = None,
        force: bool = False,
    ) -> dict[str, int]:
        """Ingest every markdown file under `root`. Returns counts by status."""
        root = Path(root)
        base = Path(rel_to) if rel_to is not None else root
        tally = {"ingested": 0, "skipped": 0, "nodes": 0}
        for p in sorted(root.glob(pattern)):
            if not p.is_file():
                continue
            rel = p.relative_to(base).as_posix()
            res = self.ingest_markdown(p, rel_path=rel, force=force)
            tally[res["status"]] += 1
            tally["nodes"] += res["nodes"]
        return tally

    # -- reads -------------------------------------------------------------------------

    def get_tool_spec(self, tool_name: str) -> dict[str, Any] | None:
        """Exact, indexed lookup of a tool specification. Returns the stored row or None.

        Zero-hallucination by construction: this is a SQL equality test, not a retrieval
        model. An unknown name yields None rather than a nearest neighbour.
        """
        row = self.conn.execute(
            """
            SELECT id, node_id, content, file_path, file_hash, json(metadata) AS metadata, created_at
            FROM agent_memory
            WHERE type = 'tool_spec' AND json_extract(metadata, '$.tool_name') = ?
            """,
            (tool_name,),
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def list_tool_specs(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, node_id, content, file_path, file_hash, json(metadata) AS metadata, created_at
            FROM agent_memory WHERE type = 'tool_spec'
            ORDER BY json_extract(metadata, '$.tool_name')
            """
        ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def query_nodes_by_header(self, header_key: str, header_value: str) -> list[dict[str, Any]]:
        """Exact match on a header level — the shape the owner's example specifies.

        `header_key` is validated against the keys this store actually writes, because it is
        interpolated into a JSON path. An unchecked key here would be an injection point.
        """
        allowed = {"header_path"} | {f"Header_{i}" for i in range(1, 7)}
        if header_key not in allowed:
            raise ValueError(f"header_key must be one of {sorted(allowed)}, got {header_key!r}")
        rows = self.conn.execute(
            f"""
            SELECT id, node_id, content, file_path, file_hash, json(metadata) AS metadata, created_at
            FROM agent_memory
            WHERE type = 'md_doc' AND json_extract(metadata, '$.{header_key}') = ?
            ORDER BY file_path, json_extract(metadata, '$.chunk_index')
            """,
            (header_value,),
        ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def query_docs(
        self,
        text: str | None = None,
        file_path: str | None = None,
        heading: str | None = None,
        metadata_equals: dict[str, Any] | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Search document nodes. All supplied filters are ANDed.

        `text` matches content OR header_path, case-insensitively — a header-only match matters
        because a section's title is often the only place its subject is named.
        """
        sql = [
            "SELECT id, node_id, content, file_path, file_hash, json(metadata) AS metadata, created_at",
            "FROM agent_memory WHERE type = 'md_doc'",
        ]
        args: list[Any] = []
        if text:
            sql.append("AND (lower(content) LIKE ? OR lower(json_extract(metadata,'$.header_path')) LIKE ?)")
            like = f"%{text.lower()}%"
            args += [like, like]
        if file_path:
            sql.append("AND file_path LIKE ?")
            args.append(f"%{file_path}%")
        if heading:
            sql.append("AND lower(json_extract(metadata,'$.header_path')) LIKE ?")
            args.append(f"%{heading.lower()}%")
        for key, value in (metadata_equals or {}).items():
            sql.append(f"AND json_extract(metadata, '$.{key}') = ?")
            args.append(value)
        sql.append("ORDER BY file_path, json_extract(metadata,'$.chunk_index') LIMIT ?")
        args.append(limit)
        rows = self.conn.execute(" ".join(sql), args).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def get_nodes(self, file_path: str) -> list[TextNode]:
        """Rehydrate stored rows back into LlamaIndex TextNodes.

        The store keeps node_id and the parser's metadata, so a node that went in comes back
        out as the same object shape — which is what makes this a LlamaIndex store rather than
        a table that happens to hold text.
        """
        rows = self.conn.execute(
            "SELECT node_id, content, json(metadata) AS metadata FROM agent_memory "
            "WHERE type='md_doc' AND file_path=? "
            "ORDER BY json_extract(metadata,'$.chunk_index')",
            (file_path,),
        ).fetchall()
        return [
            TextNode(id_=r["node_id"], text=r["content"], metadata=json.loads(r["metadata"]))
            for r in rows
        ]

    def stats(self) -> dict[str, Any]:
        rows = self.conn.execute(
            "SELECT type, COUNT(*) AS n, COUNT(DISTINCT file_path) AS files "
            "FROM agent_memory GROUP BY type"
        ).fetchall()
        out: dict[str, Any] = {"total": 0, "by_type": {}}
        for r in rows:
            out["by_type"][r["type"]] = {"rows": r["n"], "files": r["files"]}
            out["total"] += r["n"]
        return out

    # -- helpers -----------------------------------------------------------------------

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
        d = dict(row)
        if d.get("metadata") is not None:
            d["metadata"] = json.loads(d["metadata"])
        return d
