"""Run local-model relationship extraction over stored chunks, and write survivors as `proposed`.

    python scripts/extract_graph.py --estimate                 # cost, writing nothing
    python scripts/extract_graph.py --paths docs/process       # a bounded pass
    python scripts/extract_graph.py --limit 200                # the largest 200 chunks

Reads from PostgreSQL (the chunks are already there — no re-parsing, no re-embedding), calls the
local model, applies the three deterministic gates, and MERGEs the survivors into Neo4j as
`proposed` facts. Nothing it writes is ever `current`, so current-only retrieval does not return
any of it until a human promotes it.

SCOPE IS AN EXPLICIT ARGUMENT AND NEVER A SILENT DEFAULT. The corpus is 12,860 chunks and a call
takes seconds; the whole corpus is a run measured in tens of hours. `--estimate` prints that number
from a measured sample rather than an assumption, so choosing a subset is a decision made with the
figure in hand instead of a cap nobody mentioned.
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")  # L74: prints carry "—"; Windows pipes stdout as cp1252

import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config, extract  # noqa: E402

log = logging.getLogger("extract_graph")

# Task 7 (2026-08-08) / task-7-brief.md item 3. The owner's original idea was "let ingest trigger an
# incremental backup on every drive" — measured against 83 revisions/day and a ~190 MB geniza dump,
# that is 15 GB/day of Postgres dumps alone (see backup-stores.ps1's own header) and was refuted as a
# blanket policy. It is the RIGHT idea specifically for the graph: WAL archiving (scripts/enable-wal-
# archiving.ps1) already covers Postgres continuously, but Neo4j Community has no equivalent — R-110's
# 9,877 Module nodes exist ONLY there, and the only way to protect them is a dump, taken close to when
# they were written. This function is that trigger, scoped to -GraphOnly so it never re-dumps Postgres.
GRAPH_BACKUP_MIN_INTERVAL_SECONDS = 15 * 60  # debounce: do not bounce neo4j for back-to-back small runs


def _graph_backup_dest() -> Path:
    # Matches backup-stores.ps1's own default -PrimaryDest, single source of truth kept informal on
    # purpose: this is a best-effort trigger, not a second copy of that script's configuration surface.
    return Path("G:/matconetesh-backups")


def _trigger_graph_backup(written_total: int) -> None:
    """Best-effort. NEVER raises, and NEVER changes this script's own exit code — a backup hiccup is
    not an extraction failure, and treating it as one would make a maintenance script's transient
    problem (a busy G:, a momentary permission glitch) block the actual extraction work it is meant
    to protect. Debounced so a run of many small `--pending` batches in quick succession does not
    bounce the neo4j service repeatedly; Community's offline-only dump already returns in seconds on
    this graph's measured size (17,858 nodes / 25,359 edges, docs/infra/graph-baseline-2026-08-07.txt)
    so the debounce is about avoiding UNNECESSARY bounces, not about a dump being slow.
    """
    if written_total <= 0:
        log.info("graph backup trigger: no facts written this run — nothing changed, skipping.")
        return
    try:
        dest = _graph_backup_dest()
        if dest.exists():
            existing = sorted(dest.glob("neo4j-*.dump"), key=lambda p: p.stat().st_mtime, reverse=True)
            if existing and (time.time() - existing[0].stat().st_mtime) < GRAPH_BACKUP_MIN_INTERVAL_SECONDS:
                age_min = (time.time() - existing[0].stat().st_mtime) / 60
                log.info(f"graph backup trigger: last graph backup is {age_min:.1f} min old "
                          f"(< {GRAPH_BACKUP_MIN_INTERVAL_SECONDS // 60} min debounce) — skipping.")
                return
        script = ROOT / "scripts" / "backup-stores.ps1"
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-File", str(script), "-GraphOnly"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180,
        )
        tail = (result.stdout or result.stderr or "").strip().splitlines()[-1:] or ["(no output)"]
        if result.returncode == 0:
            log.info(f"graph backup trigger: OK — {tail[0]}")
        else:
            # Expected and non-fatal when not elevated (Community dumps offline only; stopping the
            # service needs admin) — the scheduled extraction task (register-extraction-task.ps1) runs
            # with -RunLevel Highest specifically so this succeeds unattended; a manual, unelevated run
            # of this script will log exactly this warning instead, and that is the correct behaviour.
            log.warning(f"graph backup trigger: backup-stores.ps1 -GraphOnly exited {result.returncode} — {tail[0]}")
    except Exception as exc:  # best-effort by design — see the docstring above
        log.warning(f"graph backup trigger: could not run ({type(exc).__name__}: {exc})")


def fetch_chunks(paths: list[str] | None, limit: int | None, namespace: str, min_chars: int,
                 pending_only: bool = False):
    """Chunks of CURRENT revisions only — extracting from superseded text would propose facts
    about content the corpus no longer contains.

    `pending_only` narrows to revisions the model has NEVER seen (the
    revisions_pending_extraction view). That is what makes a new or edited document get the same
    treatment as the rest of the corpus instead of a permanent hole in the graph.
    """
    where = ["dr.is_current", "d.namespace = %s", "length(dc.content) >= %s"]
    params: list[object] = [namespace, min_chars]
    if pending_only:
        where.append("dr.id IN (SELECT revision_id FROM revisions_pending_extraction)")
    if paths:
        where.append("(" + " OR ".join(["d.source_path LIKE %s"] * len(paths)) + ")")
        params.extend(p.rstrip("/") + "%" for p in paths)

    # PRIORITY ORDER (owner, 2026-08-05): the project's OWN documents before vendor documentation,
    # all in one run. A 28-hour pass that is interrupted at hour 6 should have covered what this
    # project decided and argued, not a third of somebody else's API reference — and the ordering
    # is the only thing that makes an interruption survivable.
    #
    # Within a tier, longest chunk first: the long ones carry the most relationships and are the
    # slowest, so front-loading them means the tail of the run gets cheaper rather than dearer.
    priority = """
        CASE
          WHEN d.source_path LIKE 'docs/vendor/%%'  THEN 4   -- other people's manuals
          WHEN d.source_path LIKE 'docs/sources/%%' THEN 3   -- primary sources: prose, few relations
          WHEN d.source_path LIKE 'tests/%%'        THEN 2   -- our code, but generated in bulk
          ELSE 1                                             -- our documents and our source
        END
    """
    sql = f"""
        SELECT dc.node_id, dc.content, dr.id::text AS revision_id, d.id::text AS document_id,
               d.source_path, length(dc.content) AS n, {priority} AS tier
        FROM document_chunks dc
        JOIN document_revisions dr ON dr.id = dc.revision_id
        JOIN documents d          ON d.id  = dr.document_id
        WHERE {' AND '.join(where)}
        ORDER BY {priority}, length(dc.content) DESC
    """
    if limit:
        sql += " LIMIT %s"
        params.append(limit)

    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def count_pending(namespace: str, paths: list[str] | None) -> int:
    """The cheap probe (R-101): `SELECT count(*)` on `revisions_pending_extraction`, scoped the
    same way `fetch_chunks` is. Measured 0.7ms warm / 3.5ms cold on a machine already loaded by a
    running extraction — against ~2.5 minutes per document that is 0.0005% overhead, which is why
    `drain()` below can afford to ask this after EVERY document rather than sampling in strides.
    """
    where = ["namespace = %s"]
    params: list[object] = [namespace]
    if paths:
        where.append("(" + " OR ".join(["source_path LIKE %s"] * len(paths)) + ")")
        params.extend(p.rstrip("/") + "%" for p in paths)
    sql = f"SELECT count(*) FROM revisions_pending_extraction WHERE {' AND '.join(where)}"

    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()[0]
    finally:
        conn.close()


def _group_by_document(chunks: list[dict]) -> list[tuple[str, list[dict]]]:
    """Groups a tier-ordered chunk list into (document_id, chunks) pairs, preserving the arrival
    order — `chunks` comes from `fetch_chunks`'s `ORDER BY tier, length DESC`, and dict preserves
    insertion order, so the documents come out highest-priority first."""
    by_doc: dict[str, list[dict]] = {}
    for c in chunks:
        by_doc.setdefault(c["document_id"], []).append(c)
    return list(by_doc.items())


def drain(fetch_fn, count_fn, process_one) -> int:
    """R-101: the consumer the extraction queue was missing.

    `fetch_chunks(...)` used to be called ONCE, and the loop iterated that snapshot to
    completion — a revision that became pending in `revisions_pending_extraction` WHILE the loop
    was running sat there until some future invocation happened to start. Priority ordering could
    not help either, because the tiering is an `ORDER BY` *inside* that one snapshot.

    This asks again after EVERY document (owner ruling, 2026-08-06), not at the end of a pass:
      1. `fetch_fn()` — a tier-ordered snapshot, exactly what `fetch_chunks` returns.
      2. Pop and process the FIRST document (highest priority first).
      3. `count_fn()` — the cheap probe. If the pending count now exceeds what is left in the
         local queue, something NEW appeared (an edit landed mid-run) — throw the queue away and
         re-fetch, which naturally re-sorts by tier so a freshly-edited project document lands
         ahead of vendor documents still waiting, not behind them. If the count matches what is
         left, nothing changed and the existing queue is used as-is — no wasted re-fetch.
    Repeats until a fetch returns nothing in scope.

    NOTE what this cannot do: a revision that becomes pending strictly AFTER the final empty
    `fetch_fn()` call (i.e., after this function has already decided the view holds nothing more
    in scope and returned) is not seen by this run — closing that gap needs a next invocation, or
    an asynchronous LISTEN/NOTIFY layered on top. A revision outside the run's scope (a
    `--paths`/`--namespace` filter that excludes it) is likewise never picked up, by design — the
    scope argument is deliberately explicit, never a silent default.

    NON-PROGRESS GUARD (fix round 1, review feedback): `fetch_fn` is a caller-supplied closure,
    and nothing in the type signature stops someone from wiring it to a query that is NOT
    pending-scoped — `main()`'s only call site passes `pending_only=True`, but that is a
    convention held in place by a comment, not by this function. A `fetch_fn` that never excludes
    completed work makes `count_fn() > len(queue)` true forever (every already-done document is
    still "pending" from that query's point of view), and this loops until the process is killed
    — silently, with nothing in the output naming the cause.
    So every revision_id this function hands to `process_one` is remembered for the life of this
    call. If a re-fetch ever returns a revision_id already processed IN THIS RUN, that is
    definitive proof `fetch_fn` is not shrinking — a genuinely new edit to the same document
    produces a NEW revision_id (that is what ingest.py's content-hash versioning is FOR), so this
    can only fire on a non-excluding fetch_fn, never on a legitimate re-edit. It raises rather
    than looping, naming the offending revision and the fix, on the SAME turn the mistake would
    otherwise start an infinite loop.

    A flag/marker argument was considered and rejected: it would just be a second convention next
    to the comment this guard replaces, and R-101 itself is the argument against trusting a
    second thing to stay in sync with the source of truth. Checking observed non-progress directly
    against what `process_one` actually did needs nothing to be declared correctly upstream.
    """
    queue = _group_by_document(fetch_fn())
    processed = 0
    seen_revisions: set[str] = set()
    while queue:
        document_id, doc_chunks = queue.pop(0)
        process_one(document_id, doc_chunks)
        processed += 1
        seen_revisions.add(doc_chunks[0]["revision_id"])
        if count_fn() > len(queue):
            queue = _group_by_document(fetch_fn())
            repeats = {c["revision_id"] for c in (row for pair in queue for row in pair[1])} & seen_revisions
            if repeats:
                raise RuntimeError(
                    f"drain(): fetch_fn returned already-processed revision(s) {sorted(repeats)} "
                    "after a re-fetch. fetch_fn must exclude completed work (e.g. "
                    "fetch_chunks(..., pending_only=True)) — a fetch_fn whose result never "
                    "shrinks as work completes makes this loop forever."
                )
    return processed


def write_proposed(candidates: list[extract.Candidate], document_id: str) -> int:
    """MERGE the survivors into Neo4j as proposed facts, with full provenance.

    Idempotent on (source, type, target, revision) so a re-run updates rather than duplicates.
    """
    if not candidates:
        return 0
    extract.validate(candidates, document_id=document_id)
    driver = config.neo4j_driver()
    written = 0
    try:
        with driver.session() as session:
            for c in candidates:
                # The REAL relationship type, with status='proposed'. The first version wrote a
                # wrapper type `PROPOSED_EDGE` to keep machine-extracted edges visually distinct —
                # and that type is NOT one of the thirteen. It was an invented label, which is the
                # exact thing the allowlist exists to forbid, written by the person who built the
                # allowlist. The `status` field is what distinguishes a proposed fact from a
                # current one; that is what the prompt's four fact statuses are FOR.
                #
                # apoc.merge.relationship because Cypher cannot parameterise a relationship type,
                # which is also why APOC was installed. The type has already passed
                # extract.validate(), so nothing unvalidated reaches this call.
                session.run(
                    """
                    MERGE (a:Module {canonical_id: $src})
                      ON CREATE SET a.created_at = datetime(), a.namespace = $ns, a.status = 'current'
                    SET a.updated_at = datetime()
                    MERGE (b:Module {canonical_id: $dst})
                      ON CREATE SET b.created_at = datetime(), b.namespace = $ns, b.status = 'current'
                    SET b.updated_at = datetime()
                    WITH a, b
                    CALL apoc.merge.relationship(
                      a, $type,
                      {source_revision_id: $rev, source_chunk_id: $chunk},
                      {status: 'proposed', source_document_id: $doc, source_uri: $uri,
                       extraction_method: 'structured_llm', extraction_confidence: $conf,
                       evidence: $ev, valid_from: datetime()},
                      b, {}
                    ) YIELD rel
                    RETURN rel
                    """,
                    src=f"{c.namespace}:{c.source}", dst=f"{c.namespace}:{c.target}",
                    ns=c.namespace, type=c.type, rev=c.revision_id, doc=document_id,
                    chunk=c.chunk_id, uri=c.source_path, conf=c.confidence, ev=c.evidence[:500],
                ).consume()
                written += 1
    finally:
        driver.close()
    return written


def _mark_extracted(revision_id: str, model: str, kept: int, dropped: int) -> None:
    """Record that this revision HAS been through the model, whatever it produced.

    Written even when the model found nothing — that is the case the column exists for. A
    revision whose text states no relationship would otherwise be re-extracted on every pass, at
    ~11s a chunk, forever.
    """
    conn = config.connect_writer()
    try:
        with conn.cursor() as cur:
            # `state` is DELIBERATELY untouched. It describes the deterministic PROJECTION, and
            # the constraint succeeded_projections_are_counted requires projected_at and
            # node_count alongside it — which extraction does not have and has no business
            # inventing. My first version wrote state='succeeded' here and the constraint refused
            # it, correctly: extraction and projection are two different facts about a revision,
            # and collapsing them would have made `succeeded` mean two things.
            cur.execute(
                "INSERT INTO graph_projection_state "
                "  (revision_id, extracted_at, extracted_model, extracted_count, extraction_rejected) "
                "VALUES (%s::uuid, now(), %s, %s, %s) "
                "ON CONFLICT (revision_id) DO UPDATE SET "
                "  extracted_at = now(), extracted_model = EXCLUDED.extracted_model, "
                "  extracted_count = EXCLUDED.extracted_count, "
                "  extraction_rejected = EXCLUDED.extraction_rejected",
                (revision_id, model, kept, dropped),
            )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--paths", nargs="*", help="restrict to chunks whose source path starts with these")
    ap.add_argument("--limit", type=int, help="take only the N largest chunks")
    ap.add_argument("--namespace", default="repo")
    ap.add_argument("--min-chars", type=int, default=extract.MIN_CHUNK_CHARS)
    ap.add_argument("--pending", action="store_true",
                    help="only revisions the model has never seen — new and edited documents")
    ap.add_argument("--estimate", action="store_true", help="measure the cost on 3 chunks; write nothing")
    ap.add_argument("--model", default=extract.MODEL,
                    help=f"default {extract.MODEL} (fast); {extract.MODEL_ACCURATE} is ~5.5x slower "
                         "with no direction errors in testing")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING,
                        format="%(levelname)s %(name)s: %(message)s")

    chunks = fetch_chunks(args.paths, args.limit, args.namespace, args.min_chars, args.pending)
    if not chunks:
        print("  no chunks matched — nothing to extract from")
        return 0
    print(f"  model: {args.model}")
    print(f"  in scope: {len(chunks)} chunk(s) from {len({c['source_path'] for c in chunks})} document(s)")

    if args.estimate:
        sample = chunks[: min(3, len(chunks))]
        t0 = time.time()
        for c in sample:
            extract.call_model(c["content"], model=args.model)
        per_call = (time.time() - t0) / len(sample)
        total = per_call * len(chunks)
        print(f"  measured: {per_call:.1f}s per chunk over {len(sample)} sample(s)")
        print(f"  projected for this scope: {total/60:.0f} min ({total/3600:.1f} h)")
        conn = config.connect_reader()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM document_chunks dc JOIN document_revisions dr "
                            "ON dr.id = dc.revision_id WHERE dr.is_current AND length(dc.content) >= %s",
                            (args.min_chars,))
                whole = cur.fetchone()[0]
        finally:
            conn.close()
        print(f"  projected for the WHOLE corpus ({whole} chunks): {per_call*whole/3600:.1f} h")
        return 0

    known = extract.known_entities(args.namespace)
    TIER = {1: "project", 2: "tests", 3: "sources", 4: "vendor"}
    order = {}
    for c in chunks:
        order.setdefault(c["document_id"], c["tier"])
    from collections import Counter
    spread = Counter(TIER.get(t, "?") for t in order.values())
    print("  priority order: " + " -> ".join(f"{k}({v})" for k, v in
          sorted(spread.items(), key=lambda kv: [t for t, n in TIER.items() if n == kv[0]][0])))

    started = time.time()
    survivors_total = written_total = 0
    rejected_total: dict[str, int] = {}
    chunks_processed = 0
    doc_i = 0

    def process_one(document_id: str, doc_chunks: list[dict]) -> None:
        nonlocal survivors_total, written_total, chunks_processed, doc_i
        doc_i += 1
        i = doc_i
        survivors, rejected = extract.extract_from_chunks(
            [{"content": c["content"], "node_id": c["node_id"]} for c in doc_chunks],
            revision_id=doc_chunks[0]["revision_id"],
            source_path=doc_chunks[0]["source_path"],
            namespace=args.namespace,
            known=known,
            model=args.model,
        )
        written_total += write_proposed(survivors, document_id)
        _mark_extracted(doc_chunks[0]["revision_id"], args.model, len(survivors), sum(rejected.values()))
        survivors_total += len(survivors)
        chunks_processed += len(doc_chunks)
        for reason, n in rejected.items():
            rejected_total[reason] = rejected_total.get(reason, 0) + n

        elapsed = time.time() - started
        rate = i / max(elapsed / 60, 0.01)
        print(f"  [{i}] {TIER.get(doc_chunks[0]['tier'],'?'):8} {doc_chunks[0]['source_path'][:48]:48} "
              f"survivors {survivors_total:4} · rejected {sum(rejected_total.values()):4} · "
              f"{rate:.1f} doc/min", flush=True)

    if args.pending:
        # R-101: the view IS the queue — re-checked after EVERY document (owner ruling,
        # 2026-08-06), not only at the end of a pass, so a document edited mid-run is picked up
        # in this same run instead of waiting for a future invocation. Scoped to --pending
        # deliberately: without it `fetch_chunks` returns every current revision regardless of
        # extraction state on every call (there is no "already done" to exclude), so re-querying
        # would just reprocess the same documents forever rather than draining a queue.
        def fetch_fn():
            return fetch_chunks(args.paths, args.limit, args.namespace, args.min_chars, True)

        def count_fn():
            return count_pending(args.namespace, args.paths)

        doc_count = drain(fetch_fn=fetch_fn, count_fn=count_fn, process_one=process_one)
    else:
        for document_id, doc_chunks in _group_by_document(chunks):
            process_one(document_id, doc_chunks)
        doc_count = doc_i

    print("\n" + "=" * 74)
    print("EXTRACTION SUMMARY")
    print("=" * 74)
    print(f"  documents processed ....... {doc_count}")
    print(f"  chunks processed .......... {chunks_processed}")
    print(f"  proposed facts written .... {written_total}")
    print(f"  candidates rejected ....... {sum(rejected_total.values())}")
    for reason, n in sorted(rejected_total.items(), key=lambda kv: -kv[1]):
        print(f"      {reason}: {n}")
    print(f"  elapsed ................... {(time.time()-started)/60:.1f} min")
    print("  Every fact written is `proposed`, never `current` — current-only retrieval")
    print("  does not return any of it until a human promotes it.")
    print("=" * 74)

    _trigger_graph_backup(written_total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
