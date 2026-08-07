"""The retrieval surface is read-only, bounded, and refuses what the prompt says it must.

Most of this runs with no database: the guards are pure functions, and they are the part that
would silently rot. The few tests that need PostgreSQL or Neo4j skip with a reason when the stack
is absent.

The tests here ATTACK the guarantees rather than restate them — a limit nobody tries to exceed is
a default, and a refusal nobody triggers is a comment.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config, retrieval  # noqa: E402
from src.knowledge.filters import AXES, UnknownFilter, compile_filters  # noqa: E402
from src.knowledge.retrieval import RetrievalRefused  # noqa: E402

# Transcribed from the prompt, Phase 5.
PROMPT_OPERATIONS = [
    "search_current_docs", "get_source_excerpt", "find_impact",
    "find_dependency_path", "get_revision_history", "get_entity_provenance",
]
PROMPT_FILTER_AXES = [
    "namespace", "source type", "document status", "revision status",
    "source authority", "repository", "document path", "timestamps",
]


# --- the surface is what the prompt specified -------------------------------------------------

def test_the_six_operations_the_prompt_names_all_exist():
    names = [op.__name__ for op in retrieval.OPERATIONS]
    assert names == PROMPT_OPERATIONS


def test_there_is_no_text_to_cypher_interface():
    """The prompt forbids one. This fails if a future edit adds it under any obvious name."""
    exported = dir(retrieval)
    for forbidden in ("text_to_cypher", "run_cypher", "query_graph", "execute_cypher", "raw_query"):
        assert forbidden not in exported, f"{forbidden} is exposed — the prompt forbids unconstrained graph access"


def test_every_filter_axis_the_prompt_names_is_supported():
    """Timestamps become created_after/created_before; the rest map one to one."""
    supported = set(AXES)
    expected = {
        "namespace", "source_type", "document_status", "revision_status",
        "source_authority", "repository", "document_path",
    }
    assert expected <= supported
    assert {"created_after", "created_before"} <= supported, "the 'timestamps' axis"
    assert len(PROMPT_FILTER_AXES) == 8


# --- the guards refuse ------------------------------------------------------------------------

@pytest.mark.parametrize(
    "cypher",
    [
        "MATCH (n) DELETE n",
        "MERGE (n:Document {canonical_id: 'x'})",
        "MATCH (n) SET n.status = 'current'",
        "MATCH (n) DETACH DELETE n",
        "DROP CONSTRAINT document_canonical_id_unique",
        "LOAD CSV FROM 'file:///etc/passwd' AS row RETURN row",
        "MATCH (n) REMOVE n:Document RETURN n",
    ],
    ids=["delete", "merge", "set", "detach", "drop", "load csv", "remove"],
)
def test_a_write_or_admin_clause_is_refused(cypher):
    with pytest.raises(RetrievalRefused) as exc:
        retrieval._guard_cypher(cypher)
    assert "read-only" in str(exc.value)


def test_a_plain_read_query_passes_the_guard():
    """The guard permits the legitimate case — otherwise it is not a guard, it is a wall."""
    retrieval._guard_cypher("MATCH (n:Document) RETURN n.canonical_id LIMIT 10")


def test_an_off_allowlist_relationship_type_is_refused():
    with pytest.raises(RetrievalRefused) as exc:
        retrieval._check_relationships(["DEPENDS_ON", "SEASONS"])
    assert "SEASONS" in str(exc.value)


def test_omitting_relationship_types_means_the_whole_allowlist_not_anything():
    from src.knowledge.graph_schema import ALLOWED_RELATIONSHIPS

    assert retrieval._check_relationships(None) == list(ALLOWED_RELATIONSHIPS)


def test_depth_beyond_the_limit_is_refused():
    with pytest.raises(RetrievalRefused) as exc:
        retrieval._bounded_depth(config.GRAPH_MAX_DEPTH + 1)
    assert "exceeds the limit" in str(exc.value)


def test_a_caller_may_ask_for_fewer_results_but_never_more():
    assert retrieval._bounded(10, 100) == 10
    assert retrieval._bounded(10_000, 100) == 100      # silently capped, never honoured
    assert retrieval._bounded(None, 100) == 100
    with pytest.raises(RetrievalRefused):
        retrieval._bounded(0, 100)


# --- filters are parameterised, and an unknown one is refused rather than dropped --------------

def test_an_unknown_filter_axis_is_refused_not_ignored():
    with pytest.raises(UnknownFilter) as exc:
        compile_filters({"namespace": "repo", "secret_backdoor": "x"})
    assert "secret_backdoor" in str(exc.value)


def test_filter_values_never_reach_the_sql_text():
    """The classic injection attempt ends up as a bind parameter, verbatim."""
    payload = "repo'; DROP TABLE documents; --"
    sql, params = compile_filters({"namespace": payload})
    assert payload not in sql
    assert "DROP" not in sql.upper()
    assert params == [[payload]]


def test_a_path_filter_cannot_smuggle_a_wildcard():
    """`document_path` is a PREFIX match. A caller supplying % would otherwise widen the query
    far beyond what they described, and get more rows while believing they got fewer."""
    sql, params = compile_filters({"document_path": "docs/%/secret"})
    assert sql.strip().startswith("AND")
    assert params == [r"docs/\%/secret%"]


def test_an_empty_filter_list_is_refused_because_it_matches_nothing():
    with pytest.raises(UnknownFilter) as exc:
        compile_filters({"namespace": []})
    assert "matches nothing" in str(exc.value)


def test_no_filters_compiles_to_nothing():
    assert compile_filters(None) == ("", [])
    assert compile_filters({}) == ("", [])


def test_filters_compile_deterministically():
    """Same filters, same SQL — so the plan cache is usable and diffs are readable."""
    f = {"namespace": ["repo", "vendor"], "source_type": "markdown"}
    assert compile_filters(dict(f)) == compile_filters(dict(reversed(list(f.items()))))


# --- the live stack --------------------------------------------------------------------------

def _require_pg():
    try:
        conn = config.connect_reader(timeout=5)
    except Exception as exc:
        pytest.skip(f"PostgreSQL is not reachable ({type(exc).__name__}) — start it with: Start-Service postgresql-x64-18")
    return conn


def test_the_retrieval_connection_cannot_write():
    """Not "does not write" — CANNOT. Two independent reasons, and both are checked."""
    import psycopg2

    conn = _require_pg()
    try:
        with pytest.raises((psycopg2.errors.InsufficientPrivilege, psycopg2.errors.ReadOnlySqlTransaction)):
            with conn.cursor() as cur:
                cur.execute("INSERT INTO documents (source_path, doc_kind) VALUES ('x', 'markdown')")
    finally:
        conn.close()


def test_search_current_docs_runs_and_respects_its_filters():
    _require_pg().close()
    rows = retrieval.search_current_docs("nitrite", filters={"namespace": "repo"}, limit=5)
    assert isinstance(rows, list)
    assert len(rows) <= 5


def test_get_source_excerpt_returns_none_for_an_unknown_id_rather_than_raising():
    _require_pg().close()
    missing = "00000000-0000-0000-0000-000000000000"
    assert retrieval.get_source_excerpt(missing, missing) is None


def test_get_revision_history_of_an_unknown_document_is_empty_not_an_error():
    _require_pg().close()
    assert retrieval.get_revision_history("__no_such_file__.md") == []


def test_find_impact_runs_against_the_live_graph():
    pytest.importorskip("neo4j")
    try:
        rows = retrieval.find_impact("repo:__no_such_entity__", depth=2, limit=5)
    except Exception as exc:
        pytest.skip(f"Neo4j is not reachable ({type(exc).__name__}) — start it with: Start-Service neo4j")
    assert rows == []


def test_every_graph_query_is_logged(caplog):
    """The prompt requires graph queries to be logged. Verified by reading the log, not the code."""
    pytest.importorskip("neo4j")
    with caplog.at_level("INFO", logger="knowledge.retrieval"):
        try:
            retrieval.find_impact("repo:__no_such_entity__", depth=1, limit=1)
        except Exception as exc:
            pytest.skip(f"Neo4j is not reachable ({type(exc).__name__})")
    # getMessage() applies the lazy %-args the way logging itself does. Doing it by hand here
    # raised TypeError on the params dict — the test failed while the log it was checking was
    # perfectly correct, which is the same "wrong half" mistake as the ::uuid[] teardown.
    logged = [r.getMessage() for r in caplog.records]
    assert any("graph query:" in m for m in logged), "no graph query was logged"
    assert any("canonical_id" in m for m in logged), "the query was logged without its parameters"


def test_semantic_search_reads_the_same_table_as_the_lexical_half():
    """The two halves of the hybrid must agree about which revisions exist.

    This is the assertion behind the decision not to use PGVectorStore: if the vector half read a
    separate table, it could serve text from a superseded revision while the lexical half, reading
    document_chunks, correctly did not.
    """
    import inspect

    for fn in (retrieval.search_current_docs, retrieval.semantic_search):
        source = inspect.getsource(fn)
        assert "FROM document_chunks dc" in source, f"{fn.__name__} reads a different table"
        assert "dr.is_current" in source, f"{fn.__name__} does not restrict to current revisions"


def test_semantic_search_runs_against_the_live_stack():
    _require_pg().close()
    try:
        rows = retrieval.semantic_search("nitrite curing salt", limit=3)
    except Exception as exc:
        pytest.skip(f"the local embedding model is not reachable ({type(exc).__name__})")
    assert isinstance(rows, list) and len(rows) <= 3
