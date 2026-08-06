"""rules.sqlite — the mirror hooks will eventually read (Phase 3, out of scope here). Holds only
CURRENT rows: one per rule_id. History and lifecycle live in mk_rules (Postgres); the mirror is a
projection built for microsecond, zero-daemon lookups, not an archive.

One-way sync: Postgres -> SQLite, never the other direction. SQLite is never written back from —
there is no merge and no conflict resolution here, only the builder writing what Postgres says is
current. `rule_id` is the same stable human key in both stores (e.g. '10.17', 'DoD-11'), so sync is
a (rule_id, source_hash) comparison, not an id-mapping exercise — see checksum() below, which is
exactly what Task 12's check-rules-mirror.mjs compares against Postgres.

Partial-write safety: every mutating call (schema creation in open_mirror, each write_revision,
each delete_revision) commits its own transaction before returning. sqlite3's default isolation
means a write is inside an implicit transaction until COMMIT; if the process dies mid-write the
transaction is simply never committed and SQLite's rollback journal/WAL discards it on next open —
the file never lands in a half-written state, and a table that exists always has its CHECK/NOT NULL
constraints intact because the whole CREATE TABLE is one statement. There is no window where the
file exists but the schema is a "schema-less shell": the file is created by sqlite3.connect (empty,
zero tables) and the very next statement, still before the caller gets the connection back, creates
and commits the schema.
"""
from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS rule_revisions (
  rule_id          TEXT PRIMARY KEY,
  section          TEXT,
  title_he         TEXT,
  statement        TEXT NOT NULL,
  bucket           TEXT,
  severity         TEXT,
  mechanism        TEXT,
  source_path      TEXT NOT NULL,
  source_heading   TEXT,
  source_hash      TEXT NOT NULL,
  revision_status  TEXT NOT NULL,
  mirrored_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_COLUMNS = ("rule_id", "section", "title_he", "statement", "bucket", "severity", "mechanism",
            "source_path", "source_heading", "source_hash", "revision_status")


def open_mirror(path: Path) -> sqlite3.Connection:
    """Open (creating if absent) the SQLite mirror at `path`, ensuring the schema exists.

    Schema creation is committed immediately so a connection is never handed back over a file
    whose table doesn't exist yet.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    conn.commit()
    return conn


def write_revision(conn: sqlite3.Connection, record: dict) -> None:
    """Upsert by rule_id — the mirror holds only the current row per rule; history lives in
    Postgres. Commits before returning, so a crash right after this call leaves either the old
    committed row or the new one, never a half-applied write."""
    placeholders = ", ".join("?" for _ in _COLUMNS)
    columns = ", ".join(_COLUMNS)
    updates = ", ".join(f"{c}=excluded.{c}" for c in _COLUMNS if c != "rule_id")
    conn.execute(
        f"INSERT INTO rule_revisions ({columns}) VALUES ({placeholders}) "
        f"ON CONFLICT(rule_id) DO UPDATE SET {updates}, mirrored_at=datetime('now')",
        [record.get(c) for c in _COLUMNS],
    )
    conn.commit()


def delete_revision(conn: sqlite3.Connection, rule_id: str) -> None:
    """Used when a rule retires: the mirror holds CURRENT rules only, so a retired rule_id is
    removed from here even though its history is kept ('retired', never deleted) in Postgres."""
    conn.execute("DELETE FROM rule_revisions WHERE rule_id = ?", (rule_id,))
    conn.commit()


def read_current(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM rule_revisions ORDER BY rule_id").fetchall()
    return [dict(r) for r in rows]


def checksum(conn: sqlite3.Connection) -> str:
    """sha256 over the sorted, concatenated (rule_id, source_hash) pairs — this is what
    check-rules-mirror.mjs (Task 12) compares against the equivalent computation over Postgres, to
    catch silent divergence between the two stores."""
    rows = conn.execute("SELECT rule_id, source_hash FROM rule_revisions ORDER BY rule_id").fetchall()
    body = "\n".join(f"{r['rule_id']}:{r['source_hash']}" for r in rows)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()
