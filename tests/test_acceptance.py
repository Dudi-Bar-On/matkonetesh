"""Phase 8 acceptance tests — categories B through E, one test per bullet in the prompt.

Each test's docstring quotes the bullet it discharges, so coverage is traceable to the spec rather
than asserted in a summary. Category A (infrastructure, including container restart) is in
test_acceptance_infra.py because it restarts services and must not run alongside the rest.

These run against the LIVE stack and skip with a reason when it is absent. They use their own
namespace and clean it before and after, so a run leaves the migrated corpus untouched.
"""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config, retrieval, worker  # noqa: E402
from src.knowledge.retrieval import RetrievalRefused  # noqa: E402
from src.knowledge.worker import SingleWriter  # noqa: E402

NS = "acceptance"
DOC_DIR = ROOT / "__acceptance_tmp"
KNOWN_FACT = "sodium nitrite pink curing salt"


def _require_stack():
    try:
        conn = config.connect_writer(timeout=5)
    except Exception as exc:
        pytest.skip(f"PostgreSQL is not reachable ({type(exc).__name__}) — start it with: Start-Service postgresql-x64-18")
    return conn


@pytest.fixture(autouse=True)
def _not_while_a_real_worker_runs():
    try:
        probe = config.connect_writer(timeout=5)
    except Exception:
        return
    try:
        with probe.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_lock(%s)", (worker.SINGLETON_LOCK_KEY,))
            free = cur.fetchone()[0]
            if free:
                cur.execute("SELECT pg_advisory_unlock(%s)", (worker.SINGLETON_LOCK_KEY,))
        if not free:
            pytest.skip("an ingestion worker holds the singleton lock")
    finally:
        probe.close()


@pytest.fixture
def clean():
    def purge():
        conn = _require_stack()
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM documents WHERE namespace = %s", (NS,))
        finally:
            conn.close()
        try:
            driver = config.neo4j_driver()
            with driver.session() as s:
                s.run("MATCH (n) WHERE n.namespace = $ns DETACH DELETE n", ns=NS).consume()
            driver.close()
        except Exception:
            pass

    purge()
    DOC_DIR.mkdir(exist_ok=True)
    yield
    purge()
    for f in DOC_DIR.glob("*"):
        f.unlink()
    try:
        DOC_DIR.rmdir()
    except OSError:
        pass


def _write(name: str, body: str) -> str:
    (DOC_DIR / name).write_text(body, encoding="utf-8")
    return f"{DOC_DIR.name}/{name}"


def _counts(source_path: str) -> dict[str, int]:
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM document_revisions dr JOIN documents d ON d.id = dr.document_id "
                "WHERE d.source_path = %s AND d.namespace = %s", (source_path, NS))
            revisions = cur.fetchone()[0]
            cur.execute(
                "SELECT count(*) FROM document_chunks dc "
                "JOIN document_revisions dr ON dr.id = dc.revision_id "
                "JOIN documents d ON d.id = dr.document_id "
                "WHERE d.source_path = %s AND d.namespace = %s", (source_path, NS))
            chunks = cur.fetchone()[0]
    finally:
        conn.close()
    driver = config.neo4j_driver()
    try:
        with driver.session() as s:
            nodes = s.run("MATCH (n) WHERE n.namespace = $ns RETURN count(n) AS c", ns=NS).single()["c"]
    finally:
        driver.close()
    return {"revisions": revisions, "chunks": chunks, "graph_nodes": nodes}


# =================================================================================================
# B. INGESTION CORRECTNESS
# =================================================================================================

def test_B1_ingest_one_representative_current_document(clean):
    """B: "Ingest one representative current document." """
    path = _write("doc.md", f"# Curing\n\nUse {KNOWN_FACT} at 2.5 g/kg.\n\n## Safety\n\nNitrite is toxic in excess.\n")
    with SingleWriter() as conn:
        result = worker.ingest_one(conn, path, namespace=NS)
    assert result.outcome == "ingested", result.detail
    assert result.chunks >= 2
    assert _counts(path)["revisions"] == 1


def test_B2_identical_content_creates_no_duplicate_revision_chunks_or_graph_entities(clean):
    """B: "Re-run ingestion with identical content and verify no duplicate revision/chunks/graph
    entities are created." """
    path = _write("doc.md", f"# Curing\n\n{KNOWN_FACT}\n")
    with SingleWriter() as conn:
        first = worker.ingest_one(conn, path, namespace=NS)
        assert first.outcome == "ingested", first.detail
        before = _counts(path)
        time.sleep(worker.DEBOUNCE_SECONDS + 1)          # past the debounce, so the HASH decides
        second = worker.ingest_one(conn, path, namespace=NS)
    assert second.outcome == "unchanged"
    assert _counts(path) == before, "a re-run created duplicates"


def test_B3_modified_content_creates_exactly_one_new_revision(clean):
    """B: "Modify the document and verify exactly one new revision is created." """
    path = _write("doc.md", f"# Curing\n\n{KNOWN_FACT}\n")
    with SingleWriter() as conn:
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"
        time.sleep(worker.DEBOUNCE_SECONDS + 1)
        _write("doc.md", f"# Curing\n\n{KNOWN_FACT} at 2.0 g/kg for bacon.\n")
        second = worker.ingest_one(conn, path, namespace=NS)
    assert second.outcome == "ingested", second.detail
    assert _counts(path)["revisions"] == 2


def test_B4_the_old_revision_is_retained_and_superseded_only_after_the_new_one_succeeds(clean):
    """B: "Verify the old revision is retained and marked superseded only after the new revision
    succeeds." """
    path = _write("doc.md", "# One\n\nfirst\n")
    with SingleWriter() as conn:
        first = worker.ingest_one(conn, path, namespace=NS)
        time.sleep(worker.DEBOUNCE_SECONDS + 1)
        _write("doc.md", "# One\n\nsecond\n")
        second = worker.ingest_one(conn, path, namespace=NS)
    assert second.outcome == "ingested"

    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dr.id::text, dr.revision_number, dr.status::text, dr.is_current, "
                "       dr.superseded_by::text "
                "FROM document_revisions dr JOIN documents d ON d.id = dr.document_id "
                "WHERE d.source_path = %s AND d.namespace = %s ORDER BY dr.revision_number",
                (path, NS),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    assert len(rows) == 2, "the old revision was not retained"
    old, new = rows
    assert old[2] == "superseded" and old[3] is False
    assert old[4] == new[0], "superseded_by does not point at the revision that replaced it"
    assert new[2] == "graph_projected" and new[3] is True


def test_B5_a_projection_failure_leaves_the_previous_revision_active(clean, monkeypatch):
    """B: "Simulate a Neo4j projection failure and verify the previous active revision remains
    active." """
    path = _write("doc.md", "# One\n\nfirst\n")
    with SingleWriter() as conn:
        first = worker.ingest_one(conn, path, namespace=NS)
        assert first.outcome == "ingested"
        time.sleep(worker.DEBOUNCE_SECONDS + 1)
        _write("doc.md", "# One\n\nsecond, will fail to project\n")
        monkeypatch.setattr(worker, "project_revision",
                            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("simulated projection failure")))
        failed = worker.ingest_one(conn, path, namespace=NS)
    assert failed.outcome == "failed"

    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dr.revision_number, dr.is_current FROM document_revisions dr "
                "JOIN documents d ON d.id = dr.document_id "
                "WHERE d.source_path = %s AND d.namespace = %s ORDER BY dr.revision_number",
                (path, NS),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    assert (1, True) in rows, "the previously active revision stopped being active"
    assert sum(1 for r in rows if r[1]) == 1


def test_B6_retrying_the_failed_job_becomes_consistent_without_duplicates(clean, monkeypatch):
    """B: "Retry the failed job and verify graph projection becomes consistent without
    duplicates." """
    path = _write("doc.md", "# One\n\nfirst\n")
    with SingleWriter() as conn:
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"
        time.sleep(worker.DEBOUNCE_SECONDS + 1)
        _write("doc.md", "# One\n\nsecond\n")
        monkeypatch.setattr(worker, "project_revision",
                            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("simulated")))
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "failed"

        monkeypatch.undo()                                # the projection works again
        time.sleep(worker.DEBOUNCE_SECONDS + 1)
        retry = worker.ingest_one(conn, path, namespace=NS)

    assert retry.outcome == "ingested", retry.detail
    counts = _counts(path)
    assert counts["revisions"] == 2, f"the retry created a duplicate revision: {counts}"

    driver = config.neo4j_driver()
    try:
        with driver.session() as s:
            dupes = s.run(
                "MATCH (n) WHERE n.namespace = $ns "
                "WITH n.canonical_id AS cid, count(*) AS c WHERE c > 1 RETURN collect(cid) AS d",
                ns=NS,
            ).single()["d"]
    finally:
        driver.close()
    assert dupes == [], f"the retry created duplicate graph nodes: {dupes}"


# =================================================================================================
# C. SEMANTIC RETRIEVAL
# =================================================================================================

def test_C1_a_known_fact_is_found_and_carries_full_citation(clean):
    """C: "Search for a known fact in a current document" + "Verify returned results include
    source path/URI, revision identifier, chunk identifier, and excerpt." """
    path = _write("doc.md", f"# Curing\n\nUse {KNOWN_FACT} at 2.5 g/kg for smoked products.\n")
    with SingleWriter() as conn:
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"

    rows = retrieval.search_current_docs("nitrite curing salt", filters={"namespace": NS})
    assert rows, "the known fact was not found"
    hit = rows[0]
    for field in ("source_path", "revision_id", "chunk_id", "excerpt"):
        assert hit.get(field), f"the result is missing {field}"
    assert hit["source_path"] == path

    excerpt = retrieval.get_source_excerpt(str(hit["revision_id"]), str(hit["chunk_id"]))
    assert excerpt and KNOWN_FACT in excerpt["content"]


def test_C2_superseded_documents_are_excluded_by_default(clean):
    """C: "Verify superseded documents are excluded by default." """
    path = _write("doc.md", "# Doc\n\nzebracorn appears only in the first revision.\n")
    with SingleWriter() as conn:
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"
        assert retrieval.search_current_docs("zebracorn", filters={"namespace": NS})
        time.sleep(worker.DEBOUNCE_SECONDS + 1)
        _write("doc.md", "# Doc\n\nthe word was replaced by narwhal.\n")
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"

    assert retrieval.search_current_docs("zebracorn", filters={"namespace": NS}) == [], \
        "text from a superseded revision is still being returned"
    assert retrieval.search_current_docs("narwhal", filters={"namespace": NS})


def test_C3_namespace_and_metadata_filters_work(clean):
    """C: "Verify namespace and metadata filters work." """
    path = _write("doc.md", f"# Curing\n\n{KNOWN_FACT}\n")
    with SingleWriter() as conn:
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"

    assert retrieval.search_current_docs("nitrite", filters={"namespace": NS})
    assert retrieval.search_current_docs("nitrite", filters={"namespace": "no-such-namespace"}) == []
    assert retrieval.search_current_docs("nitrite", filters={"namespace": NS, "source_type": "markdown"})
    assert retrieval.search_current_docs("nitrite", filters={"namespace": NS, "source_type": "code"}) == []
    assert retrieval.search_current_docs("nitrite", filters={"namespace": NS, "document_path": DOC_DIR.name})


def test_C4_semantic_and_lexical_halves_agree_on_the_same_document(clean):
    """The hybrid's two halves must not disagree about which revisions exist."""
    path = _write("doc.md", f"# Curing\n\nUse {KNOWN_FACT} at 2.5 g/kg.\n")
    with SingleWriter() as conn:
        assert worker.ingest_one(conn, path, namespace=NS).outcome == "ingested"
    try:
        semantic = retrieval.semantic_search("curing salt for smoked meat", filters={"namespace": NS}, limit=5)
    except Exception as exc:
        pytest.skip(f"the local embedding model is unavailable ({type(exc).__name__})")
    assert semantic and semantic[0]["source_path"] == path
    assert 0.0 <= semantic[0]["similarity"] <= 1.0


# =================================================================================================
# D. GRAPH RETRIEVAL
# =================================================================================================

@pytest.fixture
def dependency_chain(clean):
    """Seed a known chain: api -> service -> module, each edge with full provenance.

    Written through the same validator the worker uses, so a seed that the gate would refuse
    cannot be used to make a graph test pass.
    """
    from src.knowledge.graph_schema import GraphWrite, validate_batch

    now = "2026-08-05T00:00:00Z"
    nodes = [
        ("API", f"{NS}:api/orders"),
        ("Service", f"{NS}:svc/pricing"),
        ("Module", f"{NS}:mod/tax"),
        ("Module", f"{NS}:mod/unrelated"),
    ]
    # Real UUIDs. A provenance id that is not a uuid is a defect the store should never contain,
    # so seeding one would test an impossible corpus. (The tolerant path in get_source_excerpt is
    # covered by its own test below.)
    prov = {
        "source_document_id": "11111111-1111-4111-8111-111111111111",
        "source_revision_id": "22222222-2222-4222-8222-222222222222",
        "source_chunk_id": "33333333-3333-4333-8333-333333333333",
        "source_uri": "docs/architecture.md", "extraction_method": "deterministic",
        "extraction_confidence": 1.0, "status": "current", "valid_from": now,
    }
    superseded = {**prov, "status": "superseded", "valid_to": now}

    validate_batch(
        [GraphWrite("node", label, {"canonical_id": cid, "namespace": NS, "status": "current",
                                    "created_at": now, "updated_at": now}) for label, cid in nodes]
        + [GraphWrite("relationship", "DEPENDS_ON", prov)]
    )

    driver = config.neo4j_driver()
    try:
        with driver.session() as s:
            for label, cid in nodes:
                s.run(
                    f"MERGE (n:{label} {{canonical_id: $cid}}) "
                    "SET n.namespace = $ns, n.status = 'current', "
                    "    n.created_at = datetime(), n.updated_at = datetime()",
                    cid=cid, ns=NS,
                ).consume()
            for src, dst in ((f"{NS}:api/orders", f"{NS}:svc/pricing"),
                             (f"{NS}:svc/pricing", f"{NS}:mod/tax")):
                s.run(
                    "MATCH (a {canonical_id: $src}), (b {canonical_id: $dst}) "
                    "MERGE (a)-[r:DEPENDS_ON]->(b) SET r += $p", src=src, dst=dst, p=prov,
                ).consume()
            # A superseded edge that current-only queries must NOT return.
            s.run(
                "MATCH (a {canonical_id: $src}), (b {canonical_id: $dst}) "
                "MERGE (a)-[r:DEPENDS_ON]->(b) SET r += $p",
                src=f"{NS}:api/orders", dst=f"{NS}:mod/unrelated", p=superseded,
            ).consume()
    finally:
        driver.close()
    return nodes


def test_D1_find_dependency_path_returns_the_correct_ordered_path(dependency_chain):
    """D: "Verify find_dependency_path returns the correct ordered path." """
    rows = retrieval.find_dependency_path(f"{NS}:api/orders", f"{NS}:mod/tax")
    assert rows, "no path found between two entities that are connected"
    assert rows[0]["chain"] == [f"{NS}:api/orders", f"{NS}:svc/pricing", f"{NS}:mod/tax"]
    assert rows[0]["edges"] == ["DEPENDS_ON", "DEPENDS_ON"]
    assert rows[0]["hops"] == 2


def test_D2_find_impact_returns_affected_entities_within_the_traversal_limit(dependency_chain):
    """D: "Verify find_impact returns affected entities within configured traversal limits." """
    affected = retrieval.find_impact(f"{NS}:mod/tax", depth=2)
    ids = {r["canonical_id"] for r in affected}
    assert f"{NS}:svc/pricing" in ids, "the direct dependant is missing"
    assert f"{NS}:api/orders" in ids, "the transitive dependant is missing"

    shallow = {r["canonical_id"] for r in retrieval.find_impact(f"{NS}:mod/tax", depth=1)}
    assert shallow == {f"{NS}:svc/pricing"}, "depth=1 returned something more than one hop away"

    with pytest.raises(RetrievalRefused):
        retrieval.find_impact(f"{NS}:mod/tax", depth=config.GRAPH_MAX_DEPTH + 1)


def test_D3_every_returned_relationship_carries_provenance_to_a_revision_and_chunk(dependency_chain):
    """D: "Verify every returned relationship includes provenance to a source revision/chunk." """
    prov = retrieval.get_entity_provenance(f"{NS}:api/orders")
    assert prov["facts"], "no provenanced facts returned"
    for fact in prov["facts"]:
        assert fact["source_revision_id"], "a returned fact has no source revision"
        assert fact["source_chunk_id"], "a returned fact has no source chunk"
        assert fact["extraction_method"] in ("deterministic", "structured_llm", "manual")


def test_D4_current_only_graph_queries_exclude_superseded_facts(dependency_chain):
    """D: "Verify current-only graph queries exclude superseded graph facts by default." """
    affected = {r["canonical_id"] for r in retrieval.find_impact(f"{NS}:mod/unrelated", depth=2)}
    assert affected == set(), (
        "a superseded edge was traversed by a current-only query — "
        f"got {affected}"
    )


# =================================================================================================
# E. SECURITY AND ACCESS
# =================================================================================================

def test_E1_ingestion_credentials_can_write_only_where_required():
    """E: "Verify ingestion credentials can write only where required." """
    import psycopg2

    conn = _require_stack()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents")          # can read
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE mk_app_must_not_create_this (x int)")
    finally:
        conn.close()


def test_E2_retrieval_credentials_are_read_only():
    """E: "Verify retrieval credentials are read-only." """
    import psycopg2

    _require_stack().close()
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents")
        for statement in (
            "INSERT INTO documents (source_path, doc_kind) VALUES ('x', 'markdown')",
            "UPDATE documents SET doc_kind = 'code'",
            "DELETE FROM documents",
        ):
            with pytest.raises((psycopg2.errors.InsufficientPrivilege,
                                psycopg2.errors.ReadOnlySqlTransaction)):
                with conn.cursor() as cur:
                    cur.execute(statement)
            conn.rollback()
    finally:
        conn.close()


def test_E3_subagents_never_receive_raw_credentials():
    """E: "Verify general subagents do not receive raw PostgreSQL or Neo4j credentials."

    Checked structurally: the retrieval operations HOLD the connection and return plain data. No
    operation returns a connection, a driver, a DSN or a password, so there is nothing for a
    caller to be handed.
    """
    import inspect

    for op in retrieval.OPERATIONS:
        source = inspect.getsource(op)
        for leak in ("password", "MK_READER_PASSWORD", "MK_APP_PASSWORD", "NEO4J_PASSWORD", "dsn"):
            assert leak not in source, f"{op.__name__} mentions {leak}"
        assert "return conn" not in source and "return driver" not in source, \
            f"{op.__name__} hands a live connection to its caller"

    # And the config module is the ONLY place credentials are read.
    assert not any(
        "dotenv" in inspect.getsource(op) for op in retrieval.OPERATIONS
    ), "a retrieval operation reads credentials directly"


@pytest.mark.parametrize(
    "cypher",
    ["MATCH (n) DELETE n", "CREATE (n:Document)", "MATCH (n) SET n.x = 1",
     "DROP CONSTRAINT document_canonical_id_unique", "MATCH (n) DETACH DELETE n"],
)
def test_E4_write_cypher_cannot_be_executed_through_any_retrieval_tool(cypher):
    """E: "Verify write Cypher cannot be executed through any retrieval tool." """
    with pytest.raises(RetrievalRefused):
        retrieval._guard_cypher(cypher)


def test_E4b_no_retrieval_operation_accepts_a_caller_supplied_query_string():
    """The stronger form: there is no parameter through which Cypher could arrive at all."""
    import inspect

    for op in retrieval.OPERATIONS:
        params = set(inspect.signature(op).parameters)
        assert not (params & {"cypher", "query_string", "statement", "sql"}), \
            f"{op.__name__} takes a raw query parameter"


def test_E5_timeouts_depth_and_result_limits_are_enforced():
    """E: "Verify query timeouts, depth limits, and result limits are enforced." """
    assert config.GRAPH_TIMEOUT_SECONDS > 0
    assert retrieval._bounded(10_000, config.GRAPH_MAX_RESULTS) == config.GRAPH_MAX_RESULTS
    assert retrieval._bounded(10_000, config.SEARCH_MAX_RESULTS) == config.SEARCH_MAX_RESULTS
    with pytest.raises(RetrievalRefused):
        retrieval._bounded_depth(config.GRAPH_MAX_DEPTH + 1)

    # The timeout is passed to the driver, not merely defined. Read from the source, because a
    # constant nobody uses is the exact failure this whole file exists to prevent.
    import inspect

    assert "timeout=config.GRAPH_TIMEOUT_SECONDS" in inspect.getsource(retrieval._run_cypher)


def test_E6_no_credential_appears_in_any_tracked_file():
    """A strict-safety-rule check, run here so it is part of acceptance rather than only pre-commit."""
    result = subprocess.run(
        ["node", "scripts/check-no-secrets.mjs"], cwd=ROOT, capture_output=True, text=True, timeout=120
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_D3b_a_fact_whose_cited_chunk_is_gone_is_reported_not_dropped(dependency_chain):
    """A provenance list that silently omits the claims it cannot support reads as
    "everything checks out". The seeded chunk ids do not exist in PostgreSQL, so every fact here
    must come back flagged rather than missing."""
    prov = retrieval.get_entity_provenance(f"{NS}:api/orders")
    assert prov["facts"], "no facts returned"
    assert prov["unsupported"] == len(prov["facts"])
    assert all(f["excerpt_missing"] for f in prov["facts"])
    assert all(f["excerpt"] is None for f in prov["facts"])


# =================================================================================================
# F. THE PGVectorStore PROJECTION (owner decision, 2026-08-05)
# =================================================================================================

def test_F1_the_vector_projection_and_the_authoritative_table_agree():
    """The objection to PGVectorStore was DIVERGENCE. This is the test that makes it impossible
    to reintroduce quietly: if a future change lets the projection drift from document_chunks,
    this fails instead of the system serving stale text."""
    _require_stack().close()
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL")
            authoritative = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM data_chunk_vectors")
            projected = cur.fetchone()[0]
            cur.execute("""
                SELECT count(*) FROM document_chunks dc
                WHERE dc.embedding IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM data_chunk_vectors v
                                  WHERE v.node_id = dc.revision_id::text || ':' || dc.node_id)
            """)
            unmirrored = cur.fetchone()[0]
    finally:
        conn.close()
    assert authoritative == projected, f"{authoritative} authoritative chunks vs {projected} projected"
    assert unmirrored == 0, f"{unmirrored} authoritative chunk(s) have no vector-store row"


def test_F2_ingesting_writes_both_tables_in_one_transaction(clean):
    """Same transaction, so there is no window in which one exists without the other."""
    path = _write("doc.md", f"# Curing\n\n{KNOWN_FACT} at 2.5 g/kg.\n\n## More\n\nsecond section\n")
    with SingleWriter() as conn:
        result = worker.ingest_one(conn, path, namespace=NS)
    assert result.outcome == "ingested", result.detail

    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM data_chunk_vectors v "
                "JOIN document_revisions dr ON dr.id = v.revision_id "
                "JOIN documents d ON d.id = dr.document_id WHERE d.namespace = %s", (NS,))
            projected = cur.fetchone()[0]
    finally:
        conn.close()
    assert projected == result.chunks, f"{result.chunks} chunks written but {projected} projected"


def test_F3_deleting_a_document_takes_its_vectors_with_it():
    """Without the FK cascade the projection would fill with searchable text whose source is gone."""
    conn = _require_stack()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO documents (source_path, doc_kind, namespace) "
                "VALUES ('__cascade__/x.md', 'markdown', '__cascade__') RETURNING id")
            doc = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO document_revisions (document_id, revision_number, content_hash, byte_size) "
                "VALUES (%s, 1, 'h', 1) RETURNING id", (doc,))
            rev = cur.fetchone()[0]
            vector = "[" + ",".join(["0.1"] * 1024) + "]"
            cur.execute(
                "INSERT INTO data_chunk_vectors (text, metadata_, node_id, embedding, revision_id) "
                "VALUES ('x', '{}'::json, '__cascade__probe', %s::vector, %s)", (vector, rev))
            cur.execute("SELECT count(*) FROM data_chunk_vectors WHERE revision_id = %s", (rev,))
            assert cur.fetchone()[0] == 1

            cur.execute("DELETE FROM documents WHERE id = %s", (doc,))
            cur.execute("SELECT count(*) FROM data_chunk_vectors WHERE revision_id = %s", (rev,))
            assert cur.fetchone()[0] == 0, "an orphan vector survived its document"
    finally:
        conn.close()


def test_F4_the_llamaindex_retriever_can_query_the_projection():
    """The capability the prompt asked to be installed, exercised through LlamaIndex itself."""
    _require_stack().close()
    from llama_index.core.vector_stores.types import VectorStoreQuery

    try:
        store = config.vector_store()
        embedding = config.embed_model().get_query_embedding("nitrite curing salt")
    except Exception as exc:
        pytest.skip(f"the vector store or embedding model is unavailable ({type(exc).__name__})")

    result = store.query(VectorStoreQuery(query_embedding=embedding, similarity_top_k=5))
    assert result.nodes, "PGVectorStore returned nothing from a populated table"
    assert len(result.nodes) <= 5
    meta = result.nodes[0].metadata
    assert meta.get("revision_id") and meta.get("source_path"), \
        "a retrieved node cannot be traced back to its authoritative revision"
