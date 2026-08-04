"""Agent memory — a SQLite/JSONB store for project documentation and tool specifications.

This replaces `graphify` as this project's agent-memory layer (owner decision, 2026-08-04).

WHY THIS EXISTS, and it is not a preference. The graph it replaces was a 22 MB JSON file
rebuilt out of process by an external CLI. Its freshness gate never once went green — 115
documents newer than the graph at the time of writing, and `graph-freshness.yml` failed 8 of
its 8 runs. A store that is never current is not a memory; it is an artifact. This one is a
single file read in-process, updated by content hash, and queried with SQL.

DESIGN NOTES

- **JSONB, not TEXT.** `metadata` holds SQLite's binary JSON representation, written through
  `jsonb(?)`. That is a hard floor of SQLite 3.45.0 (Jan 2024) and the reason this project
  moved to Python 3.14 / SQLite 3.50.4 — 3.10 shipped 3.37.2, where `jsonb()` does not exist.
  `assert_jsonb_support()` fails loudly at connect time rather than at first write.

- **Delta by hash, not by mtime.** mtime was precisely the weak link in the old freshness
  gate: it flips on checkout, on format-on-save, on anything that rewrites bytes identically.
  A SHA-256 of file content does not.

- **Atomic.** Every mutating method runs inside one transaction and either commits whole or
  rolls back whole. `delete_by_file_path` + re-insert on a changed file is a single unit, so a
  crash mid-ingest can never leave a document half-replaced.

- **No network, ever.** Nothing here opens a socket. The test suite asserts that.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

__all__ = [
    "AgentMemory",
    "DocChunk",
    "ToolSpec",
    "JsonbUnsupportedError",
    "MIN_SQLITE_FOR_JSONB",
]

# jsonb() / json_extract-over-jsonb landed here. Below it, every write in this module fails.
MIN_SQLITE_FOR_JSONB = (3, 45, 0)

MEMORY_TYPES = ("md_doc", "tool_spec")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_memory (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
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

-- Identity of a document chunk: which file, and which chunk within it. This is what makes
-- upsert_doc_chunk idempotent instead of appending a duplicate on every ingest.
CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_memory_doc_chunk
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
class DocChunk:
    """One section of a markdown document."""

    file_path: str
    chunk_index: int
    heading: str
    heading_path: tuple[str, ...]
    level: int
    content: str


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

    The failure this guards against is not hypothetical: this project ran on SQLite 3.37.2
    until 2026-08-04, where `jsonb()` raises `no such function`.
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
    # Belt and braces: the version string can lie about a custom build.
    try:
        conn.execute("select json_extract(jsonb('{\"a\":1}'), '$.a')").fetchone()
    except sqlite3.OperationalError as exc:  # pragma: no cover - only on a broken build
        raise JsonbUnsupportedError(f"SQLite reports {raw} but jsonb() is unavailable: {exc}") from exc


# --------------------------------------------------------------------------------------
# Markdown chunking
# --------------------------------------------------------------------------------------

_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_FENCE = re.compile(r"^\s*(```|~~~)")


def chunk_markdown(text: str, file_path: str) -> list[DocChunk]:
    """Split a markdown document into hierarchical chunks, one per heading.

    Content before the first heading becomes chunk 0 with an empty heading, so a document
    with no headings at all still round-trips instead of vanishing.

    Headings inside fenced code blocks are NOT treated as headings. A shell snippet
    containing `# comment` would otherwise shred a document into noise — and this corpus is
    full of shell snippets.
    """
    lines = text.splitlines()
    chunks: list[DocChunk] = []
    stack: list[tuple[int, str]] = []          # (level, heading) ancestry
    cur_heading, cur_level, cur_lines = "", 0, []
    cur_path: tuple[str, ...] = ()
    in_fence = False
    fence_marker = ""

    def flush() -> None:
        body = "\n".join(cur_lines).strip()
        if not body and not cur_heading:
            return
        chunks.append(
            DocChunk(
                file_path=file_path,
                chunk_index=len(chunks),
                heading=cur_heading,
                heading_path=cur_path,
                level=cur_level,
                content=body,
            )
        )

    for line in lines:
        fence = _FENCE.match(line)
        if fence:
            marker = fence.group(1)
            if not in_fence:
                in_fence, fence_marker = True, marker
            elif marker == fence_marker:
                in_fence = False
            cur_lines.append(line)
            continue

        m = None if in_fence else _HEADING.match(line)
        if m:
            flush()
            level = len(m.group(1))
            heading = m.group(2).strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            cur_path = tuple(h for _, h in stack) + (heading,)
            stack.append((level, heading))
            cur_heading, cur_level, cur_lines = heading, level, []
        else:
            cur_lines.append(line)

    flush()
    return chunks


# --------------------------------------------------------------------------------------
# The store
# --------------------------------------------------------------------------------------


class AgentMemory:
    """SQLite-backed agent memory.

    Use as a context manager, or call close() yourself:

        with AgentMemory("agent-memory.db") as mem:
            mem.upsert_tool_spec(ToolSpec("playwright", "...", {"tool_name": "playwright"}))
    """

    def __init__(self, db_path: str | Path = ":memory:") -> None:
        self.db_path = str(db_path)
        if self.db_path != ":memory:":
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        assert_jsonb_support(self.conn)
        self.conn.execute("PRAGMA foreign_keys = ON")
        # WAL is meaningless for :memory: and SQLite ignores it there; harmless to attempt.
        if self.db_path != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    # -- lifecycle ---------------------------------------------------------------------

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

    def upsert_doc_chunk(
        self,
        chunk: DocChunk,
        file_hash: str,
        extra_metadata: dict[str, Any] | None = None,
    ) -> int:
        """Insert or replace one document chunk. Returns its row id.

        Identity is (file_path, chunk_index) — re-ingesting the same file updates in place
        rather than accumulating copies.
        """
        meta: dict[str, Any] = {
            "chunk_index": chunk.chunk_index,
            "heading": chunk.heading,
            "heading_path": list(chunk.heading_path),
            "level": chunk.level,
        }
        if extra_metadata:
            meta.update(extra_metadata)

        with self.conn:
            self.conn.execute(
                """
                INSERT INTO agent_memory (content, type, file_path, file_hash, metadata, created_at)
                VALUES (?, 'md_doc', ?, ?, jsonb(?), ?)
                ON CONFLICT (file_path, json_extract(metadata, '$.chunk_index'))
                  WHERE type = 'md_doc'
                DO UPDATE SET content    = excluded.content,
                              file_hash  = excluded.file_hash,
                              metadata   = excluded.metadata,
                              created_at = excluded.created_at
                """,
                (chunk.content, chunk.file_path, file_hash, json.dumps(meta, ensure_ascii=False), self._now()),
            )
            row = self.conn.execute(
                "SELECT id FROM agent_memory WHERE type='md_doc' AND file_path=? "
                "AND json_extract(metadata,'$.chunk_index')=?",
                (chunk.file_path, chunk.chunk_index),
            ).fetchone()
        return int(row["id"])

    def upsert_tool_spec(self, spec: ToolSpec, file_path: str | None = None) -> int:
        """Insert or replace a tool specification. Returns its row id.

        `tool_name` is forced into the metadata so the unique index and the lookup index
        can never disagree with the dataclass field.
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

    # -- ingestion ---------------------------------------------------------------------

    def stored_file_hash(self, file_path: str) -> str | None:
        row = self.conn.execute(
            "SELECT file_hash FROM agent_memory WHERE file_path = ? LIMIT 1", (file_path,)
        ).fetchone()
        return row["file_hash"] if row else None

    def ingest_markdown(
        self,
        path: str | Path,
        rel_path: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        """Chunk and store a markdown file, skipping it when the content has not changed.

        Returns {'status': 'skipped'|'ingested', 'chunks': int, 'file_hash': str}.

        The whole replace runs in ONE transaction: the old chunks are deleted and the new
        ones written together, so an interrupted ingest cannot leave a file half-present.
        """
        p = Path(path)
        key = rel_path if rel_path is not None else str(p)
        digest = sha256_file(p)

        if not force and self.stored_file_hash(key) == digest:
            return {"status": "skipped", "chunks": 0, "file_hash": digest}

        text = p.read_text(encoding="utf-8", errors="replace")
        chunks = chunk_markdown(text, key)

        with self.conn:
            self.conn.execute(
                "DELETE FROM agent_memory WHERE file_path = ? AND type = 'md_doc'", (key,)
            )
            for chunk in chunks:
                meta: dict[str, Any] = {
                    "chunk_index": chunk.chunk_index,
                    "heading": chunk.heading,
                    "heading_path": list(chunk.heading_path),
                    "level": chunk.level,
                }
                if extra_metadata:
                    meta.update(extra_metadata)
                self.conn.execute(
                    """
                    INSERT INTO agent_memory (content, type, file_path, file_hash, metadata, created_at)
                    VALUES (?, 'md_doc', ?, ?, jsonb(?), ?)
                    """,
                    (chunk.content, key, digest, json.dumps(meta, ensure_ascii=False), self._now()),
                )
        return {"status": "ingested", "chunks": len(chunks), "file_hash": digest}

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
        tally = {"ingested": 0, "skipped": 0, "chunks": 0}
        for p in sorted(root.glob(pattern)):
            if not p.is_file():
                continue
            rel = p.relative_to(base).as_posix()
            res = self.ingest_markdown(p, rel_path=rel, force=force)
            tally[res["status"]] += 1
            tally["chunks"] += res["chunks"]
        return tally

    # -- reads -------------------------------------------------------------------------

    def get_tool_spec(self, tool_name: str) -> dict[str, Any] | None:
        """Exact lookup of a tool specification by name, or None."""
        row = self.conn.execute(
            """
            SELECT id, content, file_path, file_hash, json(metadata) AS metadata, created_at
            FROM agent_memory
            WHERE type = 'tool_spec' AND json_extract(metadata, '$.tool_name') = ?
            """,
            (tool_name,),
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def list_tool_specs(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, content, file_path, file_hash, json(metadata) AS metadata, created_at
            FROM agent_memory WHERE type = 'tool_spec'
            ORDER BY json_extract(metadata, '$.tool_name')
            """
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
        """Search document chunks. All supplied filters are ANDed.

        `text` matches content OR heading, case-insensitively — a heading-only match matters
        because a section's title is often the only place its subject is named.
        """
        sql = [
            "SELECT id, content, file_path, file_hash, json(metadata) AS metadata, created_at",
            "FROM agent_memory WHERE type = 'md_doc'",
        ]
        args: list[Any] = []
        if text:
            sql.append("AND (lower(content) LIKE ? OR lower(json_extract(metadata,'$.heading')) LIKE ?)")
            like = f"%{text.lower()}%"
            args += [like, like]
        if file_path:
            sql.append("AND file_path LIKE ?")
            args.append(f"%{file_path}%")
        if heading:
            sql.append("AND lower(json_extract(metadata,'$.heading')) LIKE ?")
            args.append(f"%{heading.lower()}%")
        for key, value in (metadata_equals or {}).items():
            sql.append(f"AND json_extract(metadata, '$.{key}') = ?")
            args.append(value)
        sql.append("ORDER BY file_path, json_extract(metadata,'$.chunk_index') LIMIT ?")
        args.append(limit)

        rows = self.conn.execute(" ".join(sql), args).fetchall()
        return [self._row_to_dict(r) for r in rows]

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
