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
  rule_group       TEXT,
  severity         TEXT,
  mechanism        TEXT,
  mechanism_target TEXT,
  source_path      TEXT NOT NULL,
  source_heading   TEXT,
  source_hash      TEXT NOT NULL,
  revision_status  TEXT NOT NULL,
  mirrored_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_COLUMNS = ("rule_id", "section", "title_he", "statement", "bucket", "rule_group", "severity",
            "mechanism", "mechanism_target", "source_path", "source_heading", "source_hash",
            "revision_status")


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


def checksum_of_rows(rows) -> str:
    """The ONE digest formula — sha256 over rows already ordered by the caller (both call sites
    `ORDER BY rule_id` in SQL; this function does not re-sort, so it never masks an ordering bug in
    either caller).

    Fix round 1, 2026-08-06 — review finding, Critical: the original digest covered only
    (rule_id, source_hash). `source_hash` traces the ON-DISK DOCUMENT's content hash; it does NOT
    change when a write to the mirror or to Postgres corrupts/loses the row's own body — a bad
    `write_revision`, a partial rebuild, a hand-edit of `statement`/`severity`/`bucket` all left
    `source_hash` untouched and the checksum reported healthy. This is the field the enforcement
    hooks actually read (`rules.sqlite` is what they consult, never Postgres), so the digest now
    covers `statement`, `severity`, and `bucket` alongside `rule_id`/`source_hash`.

    `rule_group` (0005 migration, R-103-driven) is folded in here for the exact reason R-103 names:
    `bucket` sat in this table for ten tasks with a real value on one side and NULL on the other,
    invisible because the digest of the day didn't cover it. Adding a column and not adding it to
    THIS function reproduces that failure on day one — this function is the single place both
    sides' checksums are computed, so a `rule_group` drift is now structurally as visible as a
    `bucket` drift.

    `mechanism`/`mechanism_target` (0006 migration, Task 2 of the 2026-08-08 rule-coverage arc) are
    folded in here for the exact reason R-103 names, a third time: a column added and not added to
    THIS function reproduces the invisible-drift failure on day one. After the classification
    batches, `mechanism` becomes exactly what the coverage gate and arc-2 hooks read — leaving it
    out of the digest would recreate R-103 on day one (0005's own comment warns of precisely this).

    Takes `(rule_id, source_hash, statement, severity, bucket, rule_group, mechanism,
    mechanism_target)` tuples so both the SQLite side (`checksum()` below) and
    check-rules-mirror.mjs's inline Postgres query go through this exact same code — a future
    change to the format string can no longer desync the two computations, because there is only
    one format string.
    """
    body = "\n".join(
        f"{rule_id}:{source_hash}:{statement}:{severity or ''}:{bucket or ''}:{rule_group or ''}:"
        f"{mechanism or ''}:{mechanism_target or ''}"
        for rule_id, source_hash, statement, severity, bucket, rule_group, mechanism, mechanism_target
        in rows
    )
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def checksum(conn: sqlite3.Connection) -> str:
    """sha256 over the sorted, concatenated (rule_id, source_hash, statement, severity, bucket,
    rule_group, mechanism, mechanism_target) tuples — this is what check-rules-mirror.mjs (Task
    12/13, extended 2026-08-07 for rule_group and 2026-08-08 for mechanism/mechanism_target)
    compares against the equivalent computation over Postgres, to catch silent divergence between
    the two stores. See checksum_of_rows() for why these eight columns and not just the first two."""
    rows = conn.execute(
        "SELECT rule_id, source_hash, statement, severity, bucket, rule_group, mechanism, "
        "mechanism_target FROM rule_revisions ORDER BY rule_id"
    ).fetchall()
    return checksum_of_rows(
        (r["rule_id"], r["source_hash"], r["statement"], r["severity"], r["bucket"],
         r["rule_group"], r["mechanism"], r["mechanism_target"])
        for r in rows
    )
