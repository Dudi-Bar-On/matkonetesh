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
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config, extract  # noqa: E402

log = logging.getLogger("extract_graph")


def fetch_chunks(paths: list[str] | None, limit: int | None, namespace: str, min_chars: int):
    """Chunks of CURRENT revisions only — extracting from superseded text would propose facts
    about content the corpus no longer contains."""
    where = ["dr.is_current", "d.namespace = %s", "length(dc.content) >= %s"]
    params: list[object] = [namespace, min_chars]
    if paths:
        where.append("(" + " OR ".join(["d.source_path LIKE %s"] * len(paths)) + ")")
        params.extend(p.rstrip("/") + "%" for p in paths)

    sql = f"""
        SELECT dc.node_id, dc.content, dr.id::text AS revision_id, d.id::text AS document_id,
               d.source_path, length(dc.content) AS n
        FROM document_chunks dc
        JOIN document_revisions dr ON dr.id = dc.revision_id
        JOIN documents d          ON d.id  = dr.document_id
        WHERE {' AND '.join(where)}
        ORDER BY length(dc.content) DESC
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--paths", nargs="*", help="restrict to chunks whose source path starts with these")
    ap.add_argument("--limit", type=int, help="take only the N largest chunks")
    ap.add_argument("--namespace", default="repo")
    ap.add_argument("--min-chars", type=int, default=extract.MIN_CHUNK_CHARS)
    ap.add_argument("--estimate", action="store_true", help="measure the cost on 3 chunks; write nothing")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING,
                        format="%(levelname)s %(name)s: %(message)s")

    chunks = fetch_chunks(args.paths, args.limit, args.namespace, args.min_chars)
    if not chunks:
        print("  no chunks matched — nothing to extract from")
        return 0
    print(f"  model: {extract.MODEL}")
    print(f"  in scope: {len(chunks)} chunk(s) from {len({c['source_path'] for c in chunks})} document(s)")

    if args.estimate:
        sample = chunks[: min(3, len(chunks))]
        t0 = time.time()
        for c in sample:
            extract.call_model(c["content"])
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
    by_doc: dict[str, list] = {}
    for c in chunks:
        by_doc.setdefault(c["document_id"], []).append(c)

    started = time.time()
    survivors_total = written_total = 0
    rejected_total: dict[str, int] = {}

    for i, (document_id, doc_chunks) in enumerate(by_doc.items(), 1):
        survivors, rejected = extract.extract_from_chunks(
            [{"content": c["content"], "node_id": c["node_id"]} for c in doc_chunks],
            revision_id=doc_chunks[0]["revision_id"],
            source_path=doc_chunks[0]["source_path"],
            namespace=args.namespace,
            known=known,
        )
        written_total += write_proposed(survivors, document_id)
        survivors_total += len(survivors)
        for reason, n in rejected.items():
            rejected_total[reason] = rejected_total.get(reason, 0) + n

        elapsed = time.time() - started
        rate = i / max(elapsed / 60, 0.01)
        print(f"  [{i}/{len(by_doc)}] {doc_chunks[0]['source_path'][:58]:58} "
              f"survivors {survivors_total:4} · rejected {sum(rejected_total.values()):4} · "
              f"{rate:.1f} doc/min · eta {max(len(by_doc)-i,0)/max(rate,0.01):.0f} min", flush=True)

    print("\n" + "=" * 74)
    print("EXTRACTION SUMMARY")
    print("=" * 74)
    print(f"  documents processed ....... {len(by_doc)}")
    print(f"  chunks processed .......... {len(chunks)}")
    print(f"  proposed facts written .... {written_total}")
    print(f"  candidates rejected ....... {sum(rejected_total.values())}")
    for reason, n in sorted(rejected_total.items(), key=lambda kv: -kv[1]):
        print(f"      {reason}: {n}")
    print(f"  elapsed ................... {(time.time()-started)/60:.1f} min")
    print("  Every fact written is `proposed`, never `current` — current-only retrieval")
    print("  does not return any of it until a human promotes it.")
    print("=" * 74)
    return 0


if __name__ == "__main__":
    sys.exit(main())
