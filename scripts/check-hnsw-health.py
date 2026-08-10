"""Detect a SILENTLY corrupt HNSW index on the geniza's vector projection.

WHY THIS EXISTS (2026-08-07). `data_chunk_vectors_embedding_idx` was found returning ZERO rows for a
query with no WHERE clause at all, on a table holding 17,126 rows. Every ordinary health signal said
the index was fine:

    pg_index.indisvalid = true, indisready = true
    SELECT count(*)                -> 17126
    SELECT count(embedding)        -> 17126, all 1024 dims
    the planner happily chose it   -> "Index Scan using data_chunk_vectors_embedding_idx"

Only a query that actually ORDERED BY the vector distance came back empty, and only because a test
happened to travel the dense path. Lexical search kept working, hybrid search kept returning rows
through its text half, and count(*) is answered by a different index entirely -- so the corruption was
invisible to every check this repository had. This is the fourth recorded occurrence (register R-102).

WHAT IT CHECKS, and why it is shaped this way:

    Take a row that already exists, use ITS OWN embedding as the query vector, and demand the index
    return that row at distance ~0.

That makes the probe deterministic and self-contained. It needs no embedding model, so it cannot fail
because Ollama is down -- a probe that reports "corrupt index" when the real problem is a stopped model
server is worse than no probe. And the expected answer is not a judgement call: a vector's nearest
neighbour is itself, at distance zero, or the index is not answering.

The comparison is index-path versus sequential-path on the same query. A healthy HNSW is APPROXIMATE
and will legitimately disagree with exact search on the tail of a result list -- measured here at 94%
distance-recall@10 right after a clean rebuild. It must never disagree about a vector's own identity.

BOTH VECTOR INDEXES ARE CHECKED, and the second one is the one that matters more. The first version of
this probe covered only data_chunk_vectors -- the LlamaIndex projection, where the corruption was
found. Then `retrieval.semantic_search` turned out to read `document_chunks` instead, with its own
`document_chunks_embedding_idx`: the path every agent-facing semantic query actually travels, and an
index the register records as having been corrupted in an earlier occurrence too. A monitor aimed at
the projection alone would have watched the quieter half of the problem.

RESULT=ok | RESULT=fail | RESULT=skip  is printed as the last line, for scripts/watchman.ps1.
`skip` means the store could not be reached at all -- absence, not corruption, and the geniza-postgres
component is what speaks to that.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _capture_forensics(failures: list[str]) -> None:
    """Record WHAT ELSE WAS HAPPENING the moment corruption was found. Never raises.

    R-102 is now at five occurrences and the standing hypothesis — heavy concurrent writes — has never
    been MEASURED. Choosing a replacement index type on an unmeasured hypothesis would swap one
    component for another for the same reason that picked the first one, so this collects the evidence
    a decision needs instead: how many Postgres backends were active, whether an extraction or a test
    suite was running, and how long since the last REINDEX. Five more data points settle it; guessing
    never will.

    Appended to a git-ignored JSONL, so the record survives the session that found it.
    """
    try:
        import json
        import subprocess
        from datetime import datetime, timezone

        snapshot: dict[str, object] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "failures": failures,
        }
        try:
            from src.knowledge import config

            conn = config.connect_reader()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT count(*) FILTER (WHERE state='active'), count(*), "
                    "coalesce(max(extract(epoch from (now()-query_start))), 0) "
                    "FROM pg_stat_activity WHERE datname = current_database()"
                )
                row = cur.fetchone() or (0, 0, 0)
                active, total, oldest = row
                snapshot["pg_active_backends"] = active
                snapshot["pg_total_backends"] = total
                snapshot["pg_oldest_query_seconds"] = round(float(oldest), 1)
                cur.execute("SELECT count(*) FROM data_chunk_vectors")
                vrow = cur.fetchone()
                snapshot["vector_rows"] = vrow[0] if vrow else None
            conn.close()
        except Exception as exc:
            snapshot["pg_snapshot_error"] = f"{type(exc).__name__}: {exc}"

        try:
            out = subprocess.run(
                ["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15
            ).stdout
            names = [ln.split('","')[0].strip('"').lower() for ln in out.splitlines() if ln.startswith('"')]
            snapshot["node_processes"] = sum(1 for n in names if n.startswith("node"))
            snapshot["python_processes"] = sum(1 for n in names if n.startswith(("python", "py")))
            snapshot["postgres_processes"] = sum(1 for n in names if n.startswith("postgres"))
        except Exception as exc:
            snapshot["process_snapshot_error"] = f"{type(exc).__name__}: {exc}"

        log = ROOT / ".superpowers" / "hnsw-corruption-log.jsonl"
        log.parent.mkdir(parents=True, exist_ok=True)
        with open(log, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(snapshot, ensure_ascii=False) + "\n")
    except Exception:
        # Forensics must never turn a detection into a crash. A missing record costs one data point;
        # a raised exception here would cost the detection itself.
        pass


def _emit(result: str, detail: str) -> int:
    print(detail)
    print(f"RESULT={result}")
    return 0 if result == "ok" else 1


# (table, identity column, index name). document_chunks comes first deliberately: it is what
# retrieval.semantic_search reads, so a failure there is the one that costs agents their evidence tool.
TARGETS = [
    ("public.document_chunks", "id", "public.document_chunks_embedding_idx"),
    ("public.data_chunk_vectors", "node_id", "public.data_chunk_vectors_embedding_idx"),
]


def _probe(cur, table: str, id_column: str, index_name: str, forced_missing: bool) -> tuple[str, str]:
    """Return (result, detail) for one table. Never raises for a data condition."""
    cur.execute(
        f"SELECT {id_column}, embedding FROM {table} WHERE embedding IS NOT NULL LIMIT 1"
    )
    row = cur.fetchone()
    if row is None:
        return "skip", f"{table} holds no embedded rows yet - nothing to probe"
    identity, vector = row
    if forced_missing:
        identity = "00000000-0000-0000-0000-000000000000" if id_column == "id" else "__no_such_node_id__"

    query = (
        f"SELECT {id_column}, embedding <=> %s::vector AS d FROM {table} ORDER BY d ASC LIMIT 5"
    )
    cur.execute(query, (vector,))
    via_index = cur.fetchall()

    cur.execute("SET enable_indexscan = off")
    cur.execute("SET enable_indexonlyscan = off")
    cur.execute(query, (vector,))
    via_seqscan = cur.fetchall()
    cur.execute("RESET enable_indexscan")
    cur.execute("RESET enable_indexonlyscan")

    repair = f"REINDEX INDEX CONCURRENTLY {index_name} (as its owner role)."

    if not via_seqscan:
        return "skip", f"{table}: even a sequential scan returned nothing - not an index problem"
    if not via_index:
        return "fail", (
            f"{index_name} returned NO rows for a query with no WHERE clause, while a sequential scan "
            f"returned {len(via_seqscan)}. The index is corrupt. Repair: {repair}"
        )
    found = [r for r in via_index if str(r[0]) == str(identity)]
    if not found:
        return "fail", (
            f"{index_name} did not return {identity} when queried with that row's OWN embedding (it "
            f"returned {len(via_index)} other row(s)). A vector's nearest neighbour is itself. "
            f"Repair: {repair}"
        )
    distance = float(found[0][1])
    if distance > 1e-6:
        return "fail", (
            f"{index_name} returned {identity} at distance {distance:.6g} when queried with that row's "
            f"own embedding - it should be 0. The index is answering with stale vectors. Repair: {repair}"
        )
    # SECOND PROBE, added 2026-08-08 after this detector reported OK on a genuinely corrupt index.
    # The identity probe above asks "can you find this exact stored vector", and a damaged HNSW graph
    # can still answer that while returning NOTHING for an ordinary query — which is what happened:
    # `RESULT=ok` from this script, and zero rows from a real search, on the same index, minutes apart.
    # That is the fifth occurrence of R-102 and the first one this detector missed.
    #
    # So: query with a vector that is NOT any stored row — an existing embedding perturbed on one
    # component — and require the index path to return as many rows as a sequential scan. Still no
    # embedding model involved, still deterministic, and it exercises graph traversal rather than a
    # lookup that may be answered from a leaf the corruption did not touch.
    cur.execute(f"SELECT embedding::text FROM {table} WHERE embedding IS NOT NULL LIMIT 1")
    raw = cur.fetchone()[0]
    values = [float(x) for x in raw.strip("[]").split(",")]
    values[0] = values[0] + 0.37 if abs(values[0]) < 0.5 else values[0] - 0.37
    probe = "[" + ",".join(repr(v) for v in values) + "]"

    arbitrary = f"SELECT {id_column} FROM {table} ORDER BY embedding <=> %s::vector ASC LIMIT 5"
    cur.execute(arbitrary, (probe,))
    arb_index = cur.fetchall()
    cur.execute("SET enable_indexscan = off")
    cur.execute("SET enable_indexonlyscan = off")
    cur.execute(arbitrary, (probe,))
    arb_seq = cur.fetchall()
    cur.execute("RESET enable_indexscan")
    cur.execute("RESET enable_indexonlyscan")

    if len(arb_index) < len(arb_seq):
        return "fail", (
            f"{index_name} answers an identity lookup but returns only {len(arb_index)} row(s) for an "
            f"ordinary query, where a sequential scan returns {len(arb_seq)}. The graph is damaged even "
            f"though the vector it was built from is still findable — this is the shape that passed an "
            f"earlier version of this check while real searches came back empty. Repair: {repair}"
        )

    # WHAT THIS "ok" MEANS, AND WHAT IT DOES NOT (measured 2026-08-09, R-102 occurrence six).
    # This detector said RESULT=ok while `nitrite curing salt` returned 0 rows through the index and 5
    # through a sequential scan, on that same index, minutes apart. The damage was a LOCAL pocket in the
    # graph, and the measurement of what it takes to find one is blunt:
    #     200 identity probes spread across the id range .... 0 caught it
    #     200 midpoint probes between distant stored rows ... 0 caught it
    #     antipode / synthetic / heavily perturbed vectors .. 0 caught it
    #     five real embeddings from the model .............. 1 caught it
    # A sampling probe cannot promise a pocket does not exist, so this message no longer says the index
    # is healthy — only what was actually asked and answered. The gate that DOES catch this is the
    # acceptance test that queries with a real embedding, because only a real query goes where a real
    # query goes. Widening this probe would buy confidence the evidence does not support (L77).
    return "ok", (
        f"{index_name}: the probes asked returned correctly — identity at distance {distance:.6g}, and "
        f"an arbitrary (non-stored) query returning {len(arb_index)} row(s) against the sequential "
        f"scan's {len(arb_seq)}. This is NOT a statement that the index is whole: a local pocket of "
        f"damage survives every probe of this shape, and only a query from the real embedding model "
        f"has ever found one."
    )


def main(argv: list[str]) -> int:
    # A deliberate escape hatch for proving the FAIL branch reachable: it asks the same question about
    # a row that does not exist, so the identical comparison must report failure. Nothing in the
    # production path passes it.
    forced_missing = "--probe-missing-node" in argv

    try:
        from src.knowledge import config
    except Exception as exc:  # import-time failure is absence, not corruption
        return _emit("skip", f"cannot import the geniza config ({type(exc).__name__}: {exc})")

    try:
        conn = config.connect_reader()
    except Exception as exc:
        return _emit("skip", f"cannot reach the geniza store ({type(exc).__name__}: {exc})")

    results = []
    try:
        cur = conn.cursor()
        for table, id_column, index_name in TARGETS:
            results.append((table, *_probe(cur, table, id_column, index_name, forced_missing)))
    except Exception as exc:
        return _emit("skip", f"the probe query could not run ({type(exc).__name__}: {exc})")
    finally:
        try:
            conn.close()
        except Exception:
            pass

    failures = [d for _, r, d in results if r == "fail"]
    if failures:
        # Never record a forensic entry for the synthetic RED branch: the whole value of this log is
        # that every line in it is a REAL corruption with real concurrent activity beside it. One
        # fabricated row makes the other five untrustworthy.
        if not forced_missing:
            _capture_forensics(failures)
        return _emit("fail", " | ".join(failures))
    if all(r == "skip" for _, r, _ in results):
        return _emit("skip", " | ".join(d for _, _, d in results))
    return _emit("ok", " | ".join(d for _, _, d in results))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
