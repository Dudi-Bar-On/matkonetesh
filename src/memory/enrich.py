"""Tier 2 — local-model enrichment of agent memory. Never blocks a commit.

    python scripts/memenrich.py                 # embed what is missing
    python scripts/memenrich.py --search "..."  # hybrid search: exact + semantic

WHY THIS IS A SEPARATE TIER, and it is the whole design.

graphify died of exactly one cause: keeping it current required an out-of-process LLM pass, so
it was never run, so its freshness gate was permanently red and got marked advisory and
ignored. Putting an embedding call inside `memsync` would recreate that failure precisely —
measured here at 146 ms/node, a full store is ~12 minutes. A commit gate cannot cost twelve
minutes and survive.

So:

    tier 1  memsync.py    MarkdownNodeParser + SHA-256 delta   ~0.3 s   BLOCKS a commit
    tier 2  memenrich.py  bge-m3 embeddings on the local GPU   ~12 min  NEVER blocks

Tier 2 is allowed to be absent, stale or half-finished. Search degrades to exact matching and
says so, rather than failing. That property is what lets it use a heavy model safely.

WHY HYBRID, measured rather than assumed (2026-08-04, against this repo's real content):

    query                              semantic          LIKE
    "מה קורה כשבדיקה נכשלת"            0.616, correct    0 hits
    "מתי מותר לוותר על דרישת מפרט"      0.545, correct    0 hits
    "how do I keep the memory current"  0.553, correct    0 hits
    "פסטור"                            0.377, WRONG      35 hits, correct

A single technical term is exactly where exact matching wins and embeddings drift; a
natural-language question is exactly where exact matching returns nothing. Neither is
sufficient, which is why search fuses both instead of picking a side.

MODEL CHOICE. bge-m3, because it is genuinely multilingual — this corpus is Hebrew documents
citing English regulations, and the common default `nomic-embed-text` is English-biased, which
would have failed silently on precisely the mixed content that matters here. 1024 dimensions.
"""

from __future__ import annotations

import json
import math
import struct
from typing import Any

from .agent_memory import AgentMemory

OLLAMA_URL = "http://127.0.0.1:11434"
EMBED_MODEL = "bge-m3"
EMBED_DIM = 1024

_EMBED_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_memory_vec (
    row_id      INTEGER PRIMARY KEY REFERENCES agent_memory(id) ON DELETE CASCADE,
    model       TEXT NOT NULL,
    dim         INTEGER NOT NULL,
    vec         BLOB NOT NULL,          -- float32, little-endian, `dim` values
    content_sha TEXT NOT NULL,          -- what was embedded; a changed node re-embeds
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vec_model ON agent_memory_vec (model);
"""


def pack(vec: list[float]) -> bytes:
    return struct.pack(f"<{len(vec)}f", *vec)


def unpack(blob: bytes) -> list[float]:
    return list(struct.unpack(f"<{len(blob) // 4}f", blob))


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def _embedder():
    """Imported lazily so tier 1 never pays for — or depends on — the model bridge."""
    from llama_index.embeddings.ollama import OllamaEmbedding

    return OllamaEmbedding(model_name=EMBED_MODEL, base_url=OLLAMA_URL)


def ensure_schema(mem: AgentMemory) -> None:
    mem.conn.executescript(_EMBED_SCHEMA)
    mem.conn.commit()


def ollama_available() -> bool:
    """A local model is infrastructure, not a guarantee. Ask before assuming."""
    import urllib.error
    import urllib.request

    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=2) as r:
            names = {m["name"].split(":")[0] for m in json.loads(r.read()).get("models", [])}
        return EMBED_MODEL.split(":")[0] in names
    except (urllib.error.URLError, OSError, ValueError, KeyError):
        return False


def pending(mem: AgentMemory, limit: int | None = None) -> list[dict[str, Any]]:
    """Nodes with no current embedding — never embedded, or embedded before their text changed."""
    sql = """
        SELECT m.id, m.content
        FROM agent_memory m
        LEFT JOIN agent_memory_vec v ON v.row_id = m.id AND v.model = ?
        WHERE m.type = 'md_doc'
          AND m.file_path NOT LIKE 'graph://%'
          AND (v.row_id IS NULL OR v.content_sha != substr(hex(sha3(m.content)), 1, 32))
        ORDER BY m.id
    """
    try:
        rows = mem.conn.execute(sql, (EMBED_MODEL,)).fetchall()
    except Exception:
        # sha3() is not present on every SQLite build; fall back to a plain missing-row check.
        rows = mem.conn.execute(
            "SELECT m.id, m.content FROM agent_memory m "
            "LEFT JOIN agent_memory_vec v ON v.row_id = m.id AND v.model = ? "
            "WHERE m.type='md_doc' AND m.file_path NOT LIKE 'graph://%' "
            "AND v.row_id IS NULL ORDER BY m.id",
            (EMBED_MODEL,),
        ).fetchall()
    out = [{"id": r["id"], "content": r["content"]} for r in rows]
    return out[:limit] if limit else out


def embed_pending(mem: AgentMemory, batch: int = 32, limit: int | None = None, progress=None) -> dict:
    """Embed everything that needs it. Safe to interrupt — each batch commits on its own."""
    from .agent_memory import sha256_text

    ensure_schema(mem)
    if not ollama_available():
        return {"status": "unavailable", "embedded": 0,
                "reason": f"ollama at {OLLAMA_URL} has no {EMBED_MODEL}"}

    todo = pending(mem, limit)
    if not todo:
        return {"status": "current", "embedded": 0}

    emb = _embedder()
    done = 0
    for i in range(0, len(todo), batch):
        chunk = todo[i : i + batch]
        vecs = emb.get_text_embedding_batch([c["content"][:2000] for c in chunk], show_progress=False)
        with mem.conn:
            for c, v in zip(chunk, vecs):
                mem.conn.execute(
                    "INSERT INTO agent_memory_vec (row_id, model, dim, vec, content_sha, created_at) "
                    "VALUES (?,?,?,?,?,datetime('now')) "
                    "ON CONFLICT(row_id) DO UPDATE SET model=excluded.model, dim=excluded.dim, "
                    "vec=excluded.vec, content_sha=excluded.content_sha, created_at=excluded.created_at",
                    (c["id"], EMBED_MODEL, len(v), pack(v), sha256_text(c["content"])[:32]),
                )
        done += len(chunk)
        if progress:
            progress(done, len(todo))
    return {"status": "embedded", "embedded": done, "total": len(todo)}


def coverage(mem: AgentMemory) -> dict:
    ensure_schema(mem)
    tot = mem.conn.execute(
        "SELECT COUNT(*) n FROM agent_memory WHERE type='md_doc' AND file_path NOT LIKE 'graph://%'"
    ).fetchone()["n"]
    # Count only vectors for nodes that are IN SCOPE. Counting every vector reported 104.1%
    # coverage — a percentage above 100 is not a rounding artefact, it is a metric measuring a
    # different population than the one it names, which is the defect class this project spent
    # a whole review week on. `out_of_scope` is surfaced rather than quietly subtracted.
    emb = mem.conn.execute(
        "SELECT COUNT(*) n FROM agent_memory_vec v JOIN agent_memory m ON m.id = v.row_id "
        "WHERE v.model = ? AND m.type = 'md_doc' AND m.file_path NOT LIKE 'graph://%'",
        (EMBED_MODEL,),
    ).fetchone()["n"]
    stale = mem.conn.execute(
        "SELECT COUNT(*) n FROM agent_memory_vec v LEFT JOIN agent_memory m ON m.id = v.row_id "
        "WHERE v.model = ? AND (m.id IS NULL OR m.file_path LIKE 'graph://%')",
        (EMBED_MODEL,),
    ).fetchone()["n"]
    return {"nodes": tot, "embedded": emb, "out_of_scope": stale,
            "pct": round(100 * emb / tot, 1) if tot else 0.0}


def semantic_search(mem: AgentMemory, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Rank stored nodes by cosine similarity. Returns [] when tier 2 is absent — never raises."""
    ensure_schema(mem)
    if not ollama_available():
        return []
    rows = mem.conn.execute(
        "SELECT v.row_id, v.vec, m.content, m.file_path, json(m.metadata) AS metadata "
        "FROM agent_memory_vec v JOIN agent_memory m ON m.id = v.row_id WHERE v.model = ?",
        (EMBED_MODEL,),
    ).fetchall()
    if not rows:
        return []
    qv = _embedder().get_text_embedding(query)
    scored = [
        (cosine(qv, unpack(r["vec"])), r)
        for r in rows
    ]
    scored.sort(key=lambda x: -x[0])
    return [
        {
            "score": round(s, 4),
            "how": "semantic",
            "content": r["content"],
            "file_path": r["file_path"],
            "metadata": json.loads(r["metadata"]),
        }
        for s, r in scored[:limit]
    ]


def hybrid_search(mem: AgentMemory, query: str, limit: int = 10) -> dict[str, Any]:
    """Exact and semantic, fused — because the measurement says neither alone is enough.

    Exact hits are ranked first: when a query IS a term that appears verbatim, that is the
    right answer and the embedding drifts (measured: 'פסטור' scored 0.377 on wrong content
    while LIKE returned 35 correct hits). Semantic fills in every question that contains no
    literal term, where exact matching returns nothing at all.

    `degraded` is reported, never hidden. A search that silently answers from half the system
    is the same defect class this whole arc was about.
    """
    exact = mem.query_docs(text=query, limit=limit)
    sem = semantic_search(mem, query, limit=limit)

    seen = {(r["file_path"], r["metadata"].get("chunk_index")) for r in exact}
    fused: list[dict[str, Any]] = [
        {"score": 1.0, "how": "exact", "content": r["content"],
         "file_path": r["file_path"], "metadata": r["metadata"]}
        for r in exact
    ]
    for r in sem:
        key = (r["file_path"], r["metadata"].get("chunk_index"))
        if key not in seen:
            fused.append(r)
            seen.add(key)

    return {
        "query": query,
        "results": fused[:limit],
        "exact_hits": len(exact),
        "semantic_hits": len(sem),
        "degraded": not sem,
        "note": None if sem else "semantic tier unavailable or not yet built — exact matches only",
    }
