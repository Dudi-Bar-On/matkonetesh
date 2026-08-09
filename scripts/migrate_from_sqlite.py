"""Migrate the documentation corpus from SQLite agent-memory into the shared knowledge stack.

The prompt, Phase 7: back up first, inspect the real schema before writing code, invent nothing,
REBUILD embeddings rather than copying them, backfill Neo4j from PostgreSQL-backed revisions,
validate counts and representative citations, and leave the SQLite database available and
unchanged.

WHAT IS MIGRATED, AND WHAT IS NOT.

SQLite holds CHUNKS, not documents: `agent_memory` has one row per parsed node, with `file_path`,
`file_hash`, `content` and JSONB `metadata`. The new schema is document-and-revision shaped. So the
migration does not copy rows across — it takes from SQLite the LIST of documents that were in
scope and their recorded provenance (path, content hash, first-seen timestamp, type), and re-reads
each document from disk through the Phase 6 worker.

That is deliberate and it is also what requirement 7 demands. Copying the old vectors would carry
forward whatever model and settings produced them; re-ingesting rebuilds embeddings with the model
this stack actually uses, and gets chunk provenance, spans and graph projection as a side effect —
through the ONE code path that has tests, rather than a second one written for the migration.

A document present in SQLite but no longer on disk is SKIPPED and counted, with the reason. Not
dropped quietly: a corpus that shrinks without saying so is the failure this repo keeps meeting.

SQLITE IS NOT TOUCHED. It is opened read-only (file:...?mode=ro), its SHA-256 is recorded before
and after, and the report states whether they match. `agent-memory.db` remains what the embedded
tooling uses; nothing here writes to it, renames it, or makes it optional.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")  # L74: prints carry "—"; Windows pipes stdout as cp1252

import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config, worker  # noqa: E402
from src.knowledge.worker import SingleWriter, WorkerBusy  # noqa: E402

SQLITE_DB = ROOT / "agent-memory.db"
BACKUP_DIR = ROOT / "backups"

# The schema this migration was written against, verified by reading it (2026-08-05). If the real
# database does not match, the migration REFUSES rather than guessing which column means what.
EXPECTED_COLUMNS = {
    "agent_memory": {"id", "node_id", "content", "type", "file_path", "file_hash", "metadata", "created_at"},
}


@dataclass
class Report:
    discovered: int = 0
    migrated: int = 0
    skipped: int = 0
    skip_reasons: dict[str, int] = field(default_factory=dict)
    revisions: int = 0
    chunks: int = 0
    graph_nodes: int = 0
    graph_relationships: int = 0
    errors: list[str] = field(default_factory=list)
    sqlite_sha_before: str = ""
    sqlite_sha_after: str = ""
    backup_path: str = ""
    elapsed_seconds: float = 0.0
    validation: dict[str, object] = field(default_factory=dict)

    def skip(self, reason: str) -> None:
        self.skipped += 1
        self.skip_reasons[reason] = self.skip_reasons.get(reason, 0) + 1


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def backup(report: Report) -> Path:
    """Step 1. Copy, then VERIFY the copy — an unverified backup is a hope."""
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    target = BACKUP_DIR / f"agent-memory-{stamp}.db"
    shutil.copy2(SQLITE_DB, target)
    source_sha = sha256_of(SQLITE_DB)
    if sha256_of(target) != source_sha:
        raise SystemExit(f"the backup at {target} does not match the source — refusing to continue")
    report.sqlite_sha_before = source_sha
    report.backup_path = str(target.relative_to(ROOT))
    print(f"  backup: {target.relative_to(ROOT)} (sha256 {source_sha[:16]}..., verified)")
    return target


def open_readonly() -> sqlite3.Connection:
    """Read-only by URI, so the migration cannot modify the source even by accident."""
    conn = sqlite3.connect(f"file:{SQLITE_DB.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def inspect(conn: sqlite3.Connection) -> None:
    """Step 2-3. Verify the schema is what this code was written for. Refuse otherwise."""
    for table, expected in EXPECTED_COLUMNS.items():
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        if not rows:
            raise SystemExit(f"table {table!r} does not exist in {SQLITE_DB.name}")
        actual = {r["name"] for r in rows}
        missing = expected - actual
        if missing:
            raise SystemExit(
                f"{table} is missing column(s) this migration relies on: {', '.join(sorted(missing))}. "
                f"Present: {', '.join(sorted(actual))}. Refusing to guess."
            )
    print(f"  schema: verified against the shape this migration was written for")


@dataclass
class SourceDoc:
    file_path: str
    file_hash: str
    doc_type: str
    first_seen: str
    node_count: int


def discover(conn: sqlite3.Connection) -> list[SourceDoc]:
    """Step 4. One record per distinct document, with the provenance SQLite actually recorded."""
    rows = conn.execute(
        """
        SELECT file_path,
               MIN(file_hash)  AS file_hash,
               MIN(type)       AS doc_type,
               MIN(created_at) AS first_seen,
               COUNT(*)        AS node_count
        FROM agent_memory
        WHERE file_path IS NOT NULL AND file_path <> ''
        GROUP BY file_path
        ORDER BY file_path
        """
    ).fetchall()
    return [
        SourceDoc(r["file_path"], r["file_hash"] or "", r["doc_type"] or "", r["first_seen"] or "", r["node_count"])
        for r in rows
    ]


def migrate(docs: list[SourceDoc], report: Report, namespace: str, limit: int | None) -> None:
    """Steps 5-8, per document, through the tested worker path."""
    selected = docs[:limit] if limit else docs
    with SingleWriter() as conn:
        for i, doc in enumerate(selected, 1):
            path = ROOT / doc.file_path
            if not path.is_file():
                report.skip("no longer present on disk")
                continue

            result = worker.ingest_one(conn, doc.file_path, namespace=namespace)

            if result.outcome == "ingested":
                report.migrated += 1
                report.revisions += 1
                report.chunks += result.chunks
                report.graph_nodes += result.graph_nodes
            elif result.outcome == "unchanged":
                report.migrated += 1          # already correct in the target; still migrated
            elif result.outcome == "debounced":
                report.skip("debounced — a job for it ran moments ago")
            else:
                report.skip("ingestion failed")
                report.errors.append(f"{doc.file_path}: {result.detail[:300]}")

            # Step 5: preserve the provenance SQLite recorded. The worker writes today's
            # timestamps because it is ingesting today; the corpus's own first-seen date is older
            # and is information the new store would otherwise lose forever.
            if doc.first_seen:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE documents SET created_at = LEAST(created_at, %s::timestamptz) "
                        "WHERE source_path = %s AND namespace = %s",
                        (doc.first_seen, doc.file_path, namespace),
                    )
                conn.commit()

            if i % 25 == 0 or i == len(selected):
                print(f"  {i}/{len(selected)} · migrated {report.migrated} · skipped {report.skipped}"
                      f" · chunks {report.chunks}", flush=True)


def count_graph(namespace: str) -> tuple[int, int]:
    driver = config.neo4j_driver()
    try:
        with driver.session() as s:
            nodes = s.run("MATCH (n) WHERE n.namespace = $ns RETURN count(n) AS c", ns=namespace).single()["c"]
            rels = s.run(
                "MATCH (a)-[r]->(b) WHERE a.namespace = $ns RETURN count(r) AS c", ns=namespace
            ).single()["c"]
        return nodes, rels
    finally:
        driver.close()


def validate(report: Report, docs: list[SourceDoc], namespace: str, samples: int = 5) -> None:
    """Step 9. Counts, and representative citations read back and compared to the file on disk.

    Comparing to DISK rather than to SQLite is the point: the question is whether the new store
    can answer with the real text, not whether it agrees with the store it replaced.
    """
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents WHERE namespace = %s", (namespace,))
            doc_rows = cur.fetchone()[0]
            cur.execute(
                "SELECT count(*) FROM document_revisions dr JOIN documents d ON d.id = dr.document_id "
                "WHERE d.namespace = %s AND dr.is_current", (namespace,)
            )
            current_revs = cur.fetchone()[0]
            cur.execute(
                "SELECT count(*) FROM document_chunks dc JOIN document_revisions dr ON dr.id = dc.revision_id "
                "JOIN documents d ON d.id = dr.document_id WHERE d.namespace = %s", (namespace,)
            )
            chunk_rows = cur.fetchone()[0]
            cur.execute(
                "SELECT count(*) FROM document_chunks dc JOIN document_revisions dr ON dr.id = dc.revision_id "
                "JOIN documents d ON d.id = dr.document_id "
                "WHERE d.namespace = %s AND dc.embedding IS NULL", (namespace,)
            )
            unembedded = cur.fetchone()[0]

            # Representative citations: every fifth document across the range, so the sample is
            # spread rather than clustered at the start where everything tends to work.
            checked, matched, mismatched = 0, 0, []
            step = max(1, len(docs) // samples)
            for doc in docs[::step][:samples]:
                cur.execute(
                    """
                    SELECT dc.content FROM document_chunks dc
                    JOIN document_revisions dr ON dr.id = dc.revision_id
                    JOIN documents d ON d.id = dr.document_id
                    WHERE d.source_path = %s AND d.namespace = %s AND dr.is_current
                    ORDER BY dc.chunk_index LIMIT 1
                    """,
                    (doc.file_path, namespace),
                )
                row = cur.fetchone()
                disk = ROOT / doc.file_path
                if not row or not disk.is_file():
                    continue
                checked += 1
                if row[0].strip()[:200] in disk.read_text(encoding="utf-8", errors="replace"):
                    matched += 1
                else:
                    mismatched.append(doc.file_path)
    finally:
        conn.close()

    nodes, rels = count_graph(namespace)
    report.graph_nodes = nodes
    report.graph_relationships = rels
    report.validation = {
        "documents_in_postgres": doc_rows,
        "current_revisions": current_revs,
        "chunks_in_postgres": chunk_rows,
        "chunks_without_an_embedding": unembedded,
        "citations_checked_against_disk": checked,
        "citations_matching": matched,
        "citations_mismatched": mismatched,
    }


def print_report(report: Report) -> None:
    v = report.validation
    print("\n" + "=" * 78)
    print("MIGRATION REPORT — SQLite agent-memory -> PostgreSQL + Neo4j")
    print("=" * 78)
    print(f"  documents discovered in SQLite ...... {report.discovered}")
    print(f"  successfully migrated ............... {report.migrated}")
    print(f"  skipped ............................. {report.skipped}")
    for reason, n in sorted(report.skip_reasons.items(), key=lambda kv: -kv[1]):
        print(f"      {reason}: {n}")
    print(f"  revisions created ................... {report.revisions}")
    print(f"  chunks indexed ...................... {report.chunks}")
    print(f"  graph nodes created ................. {report.graph_nodes}")
    print(f"  graph relationships created ......... {report.graph_relationships}")
    print(f"  errors requiring manual review ...... {len(report.errors)}")
    for e in report.errors[:10]:
        print(f"      {e}")
    if len(report.errors) > 10:
        print(f"      ... and {len(report.errors) - 10} more")
    print("\n  VALIDATION")
    for k, val in v.items():
        print(f"    {k}: {val}")
    print("\n  SQLITE RETAINED UNCHANGED")
    same = report.sqlite_sha_before == report.sqlite_sha_after
    print(f"    sha256 before: {report.sqlite_sha_before[:32]}...")
    print(f"    sha256 after:  {report.sqlite_sha_after[:32]}...")
    print(f"    unchanged: {'YES' if same else 'NO — INVESTIGATE'}")
    print(f"    backup: {report.backup_path}")
    print(f"\n  elapsed: {report.elapsed_seconds:.1f}s")
    print("=" * 78)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--namespace", default="repo")
    ap.add_argument("--limit", type=int, help="migrate only the first N documents (smoke test)")
    ap.add_argument("--dry-run", action="store_true", help="discover and report; write nothing")
    ap.add_argument("--report-file", help="also write the report as JSON to this path")
    args = ap.parse_args()

    if not SQLITE_DB.exists():
        raise SystemExit(f"{SQLITE_DB} not found")

    report = Report()
    started = time.time()

    conn = open_readonly()
    try:
        inspect(conn)
        docs = discover(conn)
    finally:
        conn.close()
    report.discovered = len(docs)
    print(f"  discovered: {len(docs)} distinct document(s) in SQLite")

    if args.dry_run:
        missing = [d.file_path for d in docs if not (ROOT / d.file_path).is_file()]
        print(f"  would migrate {len(docs) - len(missing)}; {len(missing)} are no longer on disk")
        for p in missing[:10]:
            print(f"      missing: {p}")
        return 0

    backup(report)
    try:
        migrate(docs, report, args.namespace, args.limit)
    except WorkerBusy as exc:
        print(f"BUSY: {exc}")
        return 2

    validate(report, docs[: args.limit] if args.limit else docs, args.namespace)
    report.sqlite_sha_after = sha256_of(SQLITE_DB)
    report.elapsed_seconds = time.time() - started
    print_report(report)

    if args.report_file:
        Path(args.report_file).write_text(
            json.dumps(report.__dict__, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
        )
        print(f"  report written to {args.report_file}")

    if report.sqlite_sha_before != report.sqlite_sha_after:
        print("FAIL: the SQLite database changed during migration. It must not.")
        return 1
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
