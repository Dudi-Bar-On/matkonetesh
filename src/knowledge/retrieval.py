"""The six parameterised, read-only retrieval operations. The whole of the agent-facing surface.

The prompt, Phase 5: "Do not expose an unconstrained text-to-Cypher interface to ordinary agents.
Instead, implement parameterized read-only retrieval operations conceptually equivalent to:
search_current_docs, get_source_excerpt, find_impact, find_dependency_path, get_revision_history,
get_entity_provenance."

THERE IS NO text_to_cypher() IN THIS MODULE AND THERE IS NOT MEANT TO BE ONE. Every Cypher string
below is a literal in this file. Values arrive as bind parameters. Labels and relationship types
that appear in a pattern are checked against the Phase 4 allowlist before the query is built, so
even a caller that reaches the label argument cannot name something off-list.

THE GUARANTEES, AND HOW EACH IS ACTUALLY DELIVERED — because "read-only" is easy to say:

  PostgreSQL   mk_reader has no INSERT/UPDATE/DELETE verb, and the session is opened READ ONLY.
               A write is not blocked by this code; it is impossible for this connection.
  Neo4j        Community edition has ONE credential and it can write. So the guarantee here is
               weaker and is enforced in code: fixed templates, a write-clause guard applied to
               every string before it is sent, bounded variable-length patterns, a query timeout,
               and a result cap. Weaker than PostgreSQL's, and it should be read as one.
  Logging      Every graph query is logged with its parameters before it runs. The prompt requires
               it for expert access; it is done for all access, because a log that exists only on
               the path nobody uses is not a log.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from . import config
from .filters import compile_filters
from .graph_schema import ALLOWED_RELATIONSHIPS, SchemaViolation

log = logging.getLogger("knowledge.retrieval")

# Clauses that write or administer. Applied to OUR OWN literals as a floor, not because a caller
# can reach them today: the guard is what keeps that true after the next edit to this file.
FORBIDDEN_CLAUSES = re.compile(
    r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|LOAD\s+CSV|CALL\s*\{|"
    r"FOREACH|TERMINATE|GRANT|DENY|REVOKE|ALTER|START\s+DATABASE|STOP\s+DATABASE)\b",
    re.IGNORECASE,
)


class RetrievalRefused(SchemaViolation):
    """A retrieval that the guards refuse, with the rule that refused it."""


def _guard_cypher(cypher: str) -> None:
    found = sorted({m.group(0).upper() for m in FORBIDDEN_CLAUSES.finditer(cypher)})
    if found:
        raise RetrievalRefused(
            f"the query contains write or administrative clause(s): {', '.join(found)}. "
            "Retrieval is read-only; there is no path here that may write to the graph."
        )


def _check_relationships(types: list[str] | None) -> list[str]:
    if not types:
        return list(ALLOWED_RELATIONSHIPS)
    bad = [t for t in types if t not in ALLOWED_RELATIONSHIPS]
    if bad:
        raise RetrievalRefused(f"relationship type(s) not on the allowlist: {', '.join(bad)}")
    return types


def _bounded(limit: int | None, ceiling: int) -> int:
    """A caller may ask for fewer than the ceiling, never more."""
    if limit is None:
        return ceiling
    if limit < 1:
        raise RetrievalRefused(f"limit must be at least 1, got {limit}")
    return min(int(limit), ceiling)


def _bounded_depth(depth: int | None) -> int:
    if depth is None:
        return config.GRAPH_MAX_DEPTH
    if depth < 1:
        raise RetrievalRefused(f"depth must be at least 1, got {depth}")
    if depth > config.GRAPH_MAX_DEPTH:
        raise RetrievalRefused(
            f"depth {depth} exceeds the limit of {config.GRAPH_MAX_DEPTH}. "
            "An unbounded traversal on a connected graph returns most of it."
        )
    return depth


def _run_cypher(cypher: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    """Guard, log, run with a timeout. The only place this module talks to Neo4j."""
    _guard_cypher(cypher)
    log.info("graph query: %s | params=%s", " ".join(cypher.split()), params)
    driver = config.neo4j_driver()
    try:
        with driver.session() as session:
            result = session.run(cypher, params, timeout=config.GRAPH_TIMEOUT_SECONDS)
            return [dict(r) for r in result]
    finally:
        driver.close()


# --- 1. search_current_docs -------------------------------------------------------------------

def search_current_docs(
    query: str,
    filters: dict[str, Any] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Full-text search over CURRENT revisions only, with the eight metadata axes.

    "Current" is not a filter the caller may drop: a superseded revision's text is history, and
    answering from it is the failure this whole revision model exists to prevent. It is in the
    WHERE clause of the literal below, not in `filters`.

    This is the LEXICAL half of the hybrid the prompt asks for; semantic_search() below is the
    vector half. Both read document_chunks, so neither can disagree with the other about which
    revisions exist.
    """
    where, params = compile_filters(filters)
    n = _bounded(limit, config.SEARCH_MAX_RESULTS)
    sql = f"""
        SELECT dc.id AS chunk_id, dr.id AS revision_id, d.source_path, d.namespace,
               dr.source_authority::text, dc.heading_path,
               ts_headline('simple', dc.content, plainto_tsquery('simple', %s),
                           'MaxFragments=2, MinWords=8, MaxWords=30') AS excerpt,
               ts_rank(to_tsvector('simple', dc.content), plainto_tsquery('simple', %s)) AS rank
        FROM document_chunks dc
        JOIN document_revisions dr ON dr.id = dc.revision_id
        JOIN documents d          ON d.id  = dr.document_id
        WHERE dr.is_current
          AND to_tsvector('simple', dc.content) @@ plainto_tsquery('simple', %s)
          {where}
        ORDER BY rank DESC
        LIMIT %s
    """
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, [query, query, query, *params, n])
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def semantic_search(
    query: str,
    filters: dict[str, Any] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """The vector half of the hybrid: cosine nearest neighbours over document_chunks.embedding.

    Reads the SAME table as search_current_docs, which is the whole reason there is no separate
    vector store (see the note in config.py). Both halves therefore obey `dr.is_current` and the
    same eight filter axes — a hybrid whose two halves could disagree about which revisions exist
    would be worse than either half alone.

    The embedding is produced locally by bge-m3 and sent as a bind parameter like any other value.
    """
    where, params = compile_filters(filters)
    n = _bounded(limit, config.SEARCH_MAX_RESULTS)
    vector = config.embed_model().get_query_embedding(query)
    sql = f"""
        SELECT dc.id::text AS chunk_id, dr.id::text AS revision_id, d.source_path, d.namespace,
               dr.source_authority::text, dc.heading_path, dc.content,
               1 - (dc.embedding <=> %s::vector) AS similarity
        FROM document_chunks dc
        JOIN document_revisions dr ON dr.id = dc.revision_id
        JOIN documents d          ON d.id  = dr.document_id
        WHERE dr.is_current AND dc.embedding IS NOT NULL
          {where}
        ORDER BY dc.embedding <=> %s::vector
        LIMIT %s
    """
    literal = "[" + ",".join(repr(float(x)) for x in vector) + "]"
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, [literal, *params, literal, n])
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


# --- 2. get_source_excerpt --------------------------------------------------------------------

def get_source_excerpt(revision_id: str, chunk_id: str) -> dict[str, Any] | None:
    """The exact stored text behind a citation.

    The prompt requires "source excerpt retrieval from PostgreSQL for every material answer".
    PostgreSQL and not Neo4j, deliberately: the graph is a projection, and quoting from a
    projection is quoting from a copy whose freshness is a separate question.
    """
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT dc.id::text AS chunk_id, dr.id::text AS revision_id, d.source_path,
                       d.namespace, dr.source_authority::text, dr.status::text AS revision_status,
                       dr.source_commit, dr.source_uri, dc.heading_path, dc.content,
                       dc.start_char, dc.end_char
                FROM document_chunks dc
                JOIN document_revisions dr ON dr.id = dc.revision_id
                JOIN documents d          ON d.id  = dr.document_id
                WHERE dr.id = %s::uuid AND dc.id = %s::uuid
                """,
                (revision_id, chunk_id),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return dict(zip([c[0] for c in cur.description], row))
    finally:
        conn.close()


# --- 3. find_impact ---------------------------------------------------------------------------

def find_impact(
    canonical_id: str,
    depth: int | None = None,
    relationship_types: list[str] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """What is downstream of this entity — who would be affected if it changed.

    Direction matters and is fixed here: incoming edges. A thing that DEPENDS_ON / CALLS /
    CONSUMES the entity is affected by it; the entity's own dependencies are not. Getting this
    backwards produces a plausible answer that is exactly wrong, which is worse than an error.
    """
    d = _bounded_depth(depth)
    types = _check_relationships(relationship_types)
    n = _bounded(limit, config.GRAPH_MAX_RESULTS)
    # The depth is interpolated because Cypher cannot parameterise a path length. It is an int
    # already validated against GRAPH_MAX_DEPTH above, so nothing caller-supplied reaches the text.
    cypher = f"""
        MATCH path = (affected)-[rels*1..{d}]->(target {{canonical_id: $canonical_id}})
        WHERE ALL(r IN rels WHERE type(r) IN $types AND r.status IN ['current', 'manually_confirmed'])
        RETURN DISTINCT affected.canonical_id AS canonical_id,
               labels(affected) AS labels,
               affected.namespace AS namespace,
               length(path) AS distance
        ORDER BY distance, canonical_id
        LIMIT $limit
    """
    return _run_cypher(cypher, {"canonical_id": canonical_id, "types": types, "limit": n})


# --- 4. find_dependency_path ------------------------------------------------------------------

def find_dependency_path(
    from_canonical_id: str,
    to_canonical_id: str,
    depth: int | None = None,
) -> list[dict[str, Any]]:
    """The shortest dependency chain between two entities, if one exists."""
    d = _bounded_depth(depth)
    cypher = f"""
        MATCH (a {{canonical_id: $from_id}}), (b {{canonical_id: $to_id}})
        MATCH path = shortestPath((a)-[rels:DEPENDS_ON|CALLS|CONSUMES|IMPLEMENTS*1..{d}]->(b))
        WHERE ALL(r IN rels WHERE r.status IN ['current', 'manually_confirmed'])
        RETURN [n IN nodes(path) | n.canonical_id] AS chain,
               [r IN relationships(path) | type(r)] AS edges,
               length(path) AS hops
    """
    return _run_cypher(cypher, {"from_id": from_canonical_id, "to_id": to_canonical_id})


# --- 5. get_revision_history ------------------------------------------------------------------

def get_revision_history(source_path: str, namespace: str = "repo") -> list[dict[str, Any]]:
    """Every revision of a document, newest first, with which one is current and why.

    Read from PostgreSQL rather than from the graph's SUPERSEDES chain: PostgreSQL is the source
    of truth, and a history assembled from a projection would be reporting the projection's
    freshness rather than the document's history.
    """
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT dr.id::text AS revision_id, dr.revision_number, dr.content_hash,
                       dr.status::text, dr.source_commit, dr.created_at, dr.indexed_at,
                       dr.graph_projected_at, dr.is_current, dr.superseded_by::text,
                       dr.source_authority::text
                FROM document_revisions dr
                JOIN documents d ON d.id = dr.document_id
                WHERE d.source_path = %s AND d.namespace = %s
                ORDER BY dr.revision_number DESC
                """,
                (source_path, namespace),
            )
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


# --- 6. get_entity_provenance -----------------------------------------------------------------

def get_entity_provenance(canonical_id: str, limit: int | None = None) -> dict[str, Any]:
    """Where an entity's facts came from — and the excerpt behind each one.

    This is the operation that makes the graph answerable rather than merely queryable. Every
    fact-bearing edge carries source_revision_id and source_chunk_id (Phase 4 refuses one that
    does not), so each claim is resolved back to the stored text in PostgreSQL.
    """
    n = _bounded(limit, config.GRAPH_MAX_RESULTS)
    edges = _run_cypher(
        """
        MATCH (e {canonical_id: $canonical_id})-[r]->(other)
        WHERE r.source_revision_id IS NOT NULL
        RETURN type(r) AS relationship, other.canonical_id AS target, r.status AS status,
               r.extraction_method AS extraction_method,
               r.extraction_confidence AS extraction_confidence,
               r.source_revision_id AS source_revision_id,
               r.source_chunk_id AS source_chunk_id,
               r.source_uri AS source_uri, r.valid_from AS valid_from, r.valid_to AS valid_to
        ORDER BY relationship, target
        LIMIT $limit
        """,
        {"canonical_id": canonical_id, "limit": n},
    )

    for edge in edges:
        excerpt = get_source_excerpt(edge["source_revision_id"], edge["source_chunk_id"])
        # An edge whose cited chunk is gone is REPORTED, not dropped. A provenance list that
        # silently omits the claims it cannot support reads as "everything checks out".
        edge["excerpt"] = excerpt["content"] if excerpt else None
        edge["excerpt_missing"] = excerpt is None

    return {
        "canonical_id": canonical_id,
        "facts": edges,
        "unsupported": sum(1 for e in edges if e["excerpt_missing"]),
    }


OPERATIONS = (
    search_current_docs,
    get_source_excerpt,
    find_impact,
    find_dependency_path,
    get_revision_history,
    get_entity_provenance,
)
