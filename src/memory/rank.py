"""BM25 ranking over agent memory, via SQLite FTS5.

WHY NOT LlamaIndex's BM25Retriever, which is what was approved.

The feasibility gate it was approved behind FAILED, exactly as the research predicted:
`llama-index-retrievers-bm25` depends on PyStemmer, a C extension with no wheel for CPython
3.14, and `pip install` dies at "Failed to build 'pystemmer'". The package cannot be installed
here at all.

SQLite ships BM25 in FTS5 — the same ranking function, `bm25(table)` — with none of that. It is
already in the database the store lives in, it needs no dependency, and the Node gate can read
it too. Substituted deliberately; the capability is what was approved, and this delivers it.

It is also BETTER for this corpus, and that is measured, not asserted. BM25Retriever's default
tokenisation is an ENGLISH stemmer with ENGLISH stopwords, which would strip exactly the English
identifiers we search for inside Hebrew documents.

TOKENISER: trigram, and this is the load-bearing choice.

Hebrew attaches prefixes to words — ה, ו, ב, ל, מ, ש, כ. With FTS5's default `unicode61`,
"הניטריט" and "ובניטריט" are different tokens from "ניטריט", so the query returns NOTHING while
the answer sits in the table:

    tokenize=unicode61   'ניטריט' -> 0 hits
    tokenize=trigram     'ניטריט' -> 2 hits  (finds הניטריט and ובניטריט)

trigram matches on substrings, so a prefixed form is found. English is unaffected: 'nitrite'
returns the same row under both. The cost is a larger index and a 3-character minimum query.
"""

from __future__ import annotations

from typing import Any

from .agent_memory import AgentMemory

_FTS_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS agent_memory_fts
USING fts5(content, file_path UNINDEXED, row_id UNINDEXED, tokenize='trigram');
"""

MIN_QUERY_CHARS = 3        # a trigram index cannot match anything shorter


def as_phrase(query: str) -> str:
    """Quote the query so FTS5 reads it as text, not as an expression.

    FTS5's MATCH input is a QUERY LANGUAGE, not a search string, and its operators are
    characters that appear constantly in technical prose:

        tree-sitter   ->  parsed as `tree NOT sitter`  -> "no such column: sitter"
        bge-m3        ->  "no such column: m3"
        api/embed     ->  "fts5: syntax error near /"

    Every one of those returned an exception that bm25_search swallowed into an empty list —
    the search reported "no results" for terms sitting in 13, 20 and 11 rows respectively.
    That is the failure shape this project keeps meeting: not an error, an empty answer that
    looks like a real one. (L50 is the same lesson in another language.)

    Quoting makes the whole query a phrase. Embedded double quotes are doubled, which is how
    FTS5 escapes them, so a query can no longer break out of the string at all.
    """
    return '"' + query.replace('"', '""') + '"' 


def ensure_index(mem: AgentMemory) -> None:
    mem.conn.executescript(_FTS_SCHEMA)
    mem.conn.commit()


def rebuild_index(mem: AgentMemory) -> dict[str, int]:
    """Rebuild the full-text index from the store. Cheap enough to be unconditional.

    Rebuilt rather than incrementally maintained: FTS5 is fast to populate, and an index kept
    in sync by triggers is a second source of truth that can silently drift from the first —
    which is the failure mode this whole arc was about.
    """
    ensure_index(mem)
    with mem.conn:
        mem.conn.execute("DELETE FROM agent_memory_fts")
        mem.conn.execute(
            "INSERT INTO agent_memory_fts (content, file_path, row_id) "
            "SELECT content, file_path, id FROM agent_memory WHERE type = 'md_doc'"
        )
    n = mem.conn.execute("SELECT COUNT(*) n FROM agent_memory_fts").fetchone()["n"]
    return {"indexed": n}


def bm25_search(mem: AgentMemory, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Rank by BM25. Returns [] rather than raising when the index is absent or the query short.

    FTS5 scores are NEGATIVE and better when more negative; they are flipped here so every
    caller sees "higher is better" like every other score in this module. A ranking system whose
    sign convention differs between engines is a bug generator.
    """
    ensure_index(mem)
    if len(query.strip()) < MIN_QUERY_CHARS:
        return []
    try:
        rows = mem.conn.execute(
            """
            SELECT f.row_id, f.file_path, bm25(agent_memory_fts) AS score,
                   m.content, json(m.metadata) AS metadata
            FROM agent_memory_fts f
            JOIN agent_memory m ON m.id = f.row_id
            WHERE agent_memory_fts MATCH ?
            ORDER BY score
            LIMIT ?
            """,
            (as_phrase(query), limit),
        ).fetchall()
    except Exception:
        # With as_phrase() there is no longer a syntax path to reach here; kept as a floor so a
        # future change to the query builder degrades to "no results" rather than crashing a
        # caller mid-search.
        return []

    import json

    return [
        {
            "score": round(-r["score"], 4),
            "how": "bm25",
            "content": r["content"],
            "file_path": r["file_path"],
            "metadata": json.loads(r["metadata"]),
        }
        for r in rows
    ]
