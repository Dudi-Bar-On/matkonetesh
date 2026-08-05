"""The single-writer worker: one writer, and a failure that never takes the live revision down.

These need the stack; they skip with a reason when it is absent.

The two tests that matter most both ATTACK:

  * a second worker is started while the first holds the lock, and must be refused;
  * ingestion is made to fail at the graph step, and the previously-current revision must still be
    current afterwards — the prompt's "never leave the old active data incorrectly deactivated".

The second one is the reason the write order is what it is, so testing it by breaking the graph
step is testing the actual design rather than a happy path.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config, worker  # noqa: E402
from src.knowledge.worker import SingleWriter, WorkerBusy  # noqa: E402

# A LEGAL namespace. The first version used `__test__worker`, which the canonical_id validator
# correctly refuses (a namespace must start with a letter) — and the tests reported that genuine
# schema violation as "stack unavailable" and skipped. See _skip_only_if_unavailable below.
NS = "test-worker"


def _require_stack():
    try:
        conn = config.connect_writer(timeout=5)
    except Exception as exc:
        pytest.skip(f"PostgreSQL is not reachable ({type(exc).__name__}) — docker compose up -d")
    return conn


# Only these mean "the environment is missing". Anything else is a BUG and must fail.
#
# The first version of this helper skipped on ANY failed ingest, and duly reported a real
# SchemaViolation — a bug in the test's own namespace — as an absent stack. Four tests went green-
# ish while the thing they exist to check had never run. That is the shape this project keeps
# paying for: not an error, a pass that means nothing.
UNAVAILABLE_MARKERS = (
    "could not connect", "connection refused", "Connection refused",
    "ServiceUnavailable", "ConnectionError", "Max retries exceeded",
    "ReadTimeout", "ConnectTimeout", "11434",          # the local embedding endpoint
)


def _skip_only_if_unavailable(result):
    if result.outcome != "failed":
        return
    if any(marker in result.detail for marker in UNAVAILABLE_MARKERS):
        pytest.skip(f"a required service is unavailable: {result.detail[:140]}")
    pytest.fail(f"ingestion failed for a reason that is NOT an absent service: {result.detail[:400]}")


@pytest.fixture
def clean():
    """Remove this test's namespace from BOTH stores, before and after.

    Both, because a worker writes to both, and a test that cleans only PostgreSQL leaves graph
    nodes that the next run's MERGE would silently reuse — passing for the wrong reason.
    """
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
            pass   # the PostgreSQL half still ran; a missing graph is reported by the tests below

    purge()
    yield
    purge()


@pytest.fixture
def sample(tmp_path):
    """A real markdown file inside the repo, so the worker's ROOT-relative read finds it."""
    d = ROOT / "__test__worker_tmp"
    d.mkdir(exist_ok=True)
    f = d / "sample.md"
    f.write_text("# Title\n\nFirst section.\n\n## Second\n\nMore text about nitrite.\n", encoding="utf-8")
    yield "__test__worker_tmp/sample.md", f
    f.unlink(missing_ok=True)
    try:
        d.rmdir()
    except OSError:
        pass


# --- one writer -------------------------------------------------------------------------------

def test_a_second_worker_is_refused_while_the_first_holds_the_lock():
    _require_stack().close()
    with SingleWriter():
        with pytest.raises(WorkerBusy) as exc:
            with SingleWriter():
                pass
        assert "only one worker" in str(exc.value).lower()


def test_the_lock_is_released_when_the_worker_exits():
    """Otherwise the first crash would lock out every future run until someone restarted the DB."""
    _require_stack().close()
    with SingleWriter():
        pass
    with SingleWriter():
        pass   # would raise WorkerBusy if the first had not released


def test_the_lock_is_released_even_when_the_body_raises():
    _require_stack().close()
    with pytest.raises(ValueError):
        with SingleWriter():
            raise ValueError("boom")
    with SingleWriter():
        pass


# --- the sequence -----------------------------------------------------------------------------

def test_ingesting_a_new_document_activates_it_only_after_both_sides(clean, sample):
    source_path, _f = sample
    with SingleWriter() as conn:
        result = worker.ingest_one(conn, source_path, namespace=NS)
    _skip_only_if_unavailable(result)

    assert result.outcome == "ingested"
    assert result.chunks >= 2

    conn = _require_stack()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dr.status::text, dr.is_current, dr.indexed_at IS NOT NULL, "
                "       dr.graph_projected_at IS NOT NULL "
                "FROM document_revisions dr JOIN documents d ON d.id = dr.document_id "
                "WHERE d.namespace = %s", (NS,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    assert rows == [("graph_projected", True, True, True)]


def test_reingesting_unchanged_content_does_no_work(clean, sample):
    source_path, _f = sample
    with SingleWriter() as conn:
        first = worker.ingest_one(conn, source_path, namespace=NS)
        _skip_only_if_unavailable(first)
        import time as _t
        _t.sleep(worker.DEBOUNCE_SECONDS + 1)   # past the debounce, so this tests the HASH path
        second = worker.ingest_one(conn, source_path, namespace=NS)

    assert second.outcome == "unchanged"
    assert second.revision_id == first.revision_id


def test_a_repeat_event_within_the_debounce_window_is_skipped(clean, sample):
    source_path, _f = sample
    with SingleWriter() as conn:
        first = worker.ingest_one(conn, source_path, namespace=NS)
        _skip_only_if_unavailable(first)
        # Content CHANGED, so only the debounce can stop it.
        (ROOT / source_path).write_text("# Title\n\nchanged\n", encoding="utf-8")
        second = worker.ingest_one(conn, source_path, namespace=NS)
    assert second.outcome == "debounced"


# --- the guarantee the write order exists for --------------------------------------------------

def test_a_graph_failure_leaves_the_previous_revision_current(clean, sample, monkeypatch):
    """The prompt: "never leave the old active data incorrectly deactivated".

    Delivered by the ORDER of writes, not by an undo — deactivation is the last step, so a failure
    before it cannot have happened. Verified by making the graph step fail on the SECOND ingest.
    """
    source_path, f = sample
    with SingleWriter() as conn:
        first = worker.ingest_one(conn, source_path, namespace=NS)
        _skip_only_if_unavailable(first)

        import time as _t
        _t.sleep(worker.DEBOUNCE_SECONDS + 1)
        f.write_text("# Title\n\nNew content that will fail to project.\n", encoding="utf-8")

        def explode(*_a, **_k):
            raise RuntimeError("graph projection failed on purpose")

        monkeypatch.setattr(worker, "project_revision", explode)
        second = worker.ingest_one(conn, source_path, namespace=NS)

    assert second.outcome == "failed"
    assert "on purpose" in second.detail

    conn = _require_stack()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dr.revision_number, dr.status::text, dr.is_current "
                "FROM document_revisions dr JOIN documents d ON d.id = dr.document_id "
                "WHERE d.namespace = %s ORDER BY dr.revision_number", (NS,),
            )
            rows = cur.fetchall()
            cur.execute(
                "SELECT state::text, last_error IS NOT NULL FROM ingestion_jobs ij "
                "JOIN documents d ON d.id = ij.document_id WHERE d.namespace = %s "
                "ORDER BY ij.id DESC LIMIT 1", (NS,),
            )
            job = cur.fetchone()
    finally:
        conn.close()

    assert (1, "graph_projected", True) in rows, "the previously-current revision was disturbed"
    assert sum(1 for r in rows if r[2]) == 1, "more than one revision is current"
    assert any(r[0] == 2 and not r[2] for r in rows), "the failed revision must not be current"
    assert job == ("failed", True), "the failed job must be recorded WITH its diagnostics"


# --- chunking ---------------------------------------------------------------------------------

def test_chunk_identifiers_are_stable_across_an_unchanged_reparse(tmp_path):
    """An unchanged section keeps its id; a changed one does not.

    Deriving the id from LlamaIndex's random node id would make every re-parse look like a
    complete rewrite, and nothing downstream could tell a real edit from a re-run.
    """
    p = tmp_path / "doc.md"
    text = "# A\n\nalpha\n\n# B\n\nbeta\n"
    p.write_text(text, encoding="utf-8")

    first = worker.chunk_document(p, text)
    again = worker.chunk_document(p, text)
    assert [c["node_id"] for c in first] == [c["node_id"] for c in again]

    changed = text.replace("beta", "gamma")
    after = worker.chunk_document(p, changed)
    assert first[0]["node_id"] == after[0]["node_id"], "the untouched section changed identity"
    assert first[-1]["node_id"] != after[-1]["node_id"], "the edited section kept its identity"


def test_chunks_carry_their_heading_path_and_span():
    p = ROOT / "docs" / "infra" / "dependency-summary.md"
    if not p.is_file():
        pytest.skip("the sample document is not present")
    chunks = worker.chunk_document(p, p.read_text(encoding="utf-8"))
    assert chunks
    assert any(c["heading_path"] for c in chunks), "no chunk carried a heading path"
    assert all(c["content_hash"] for c in chunks)
    spans = [c for c in chunks if c["start_char"] is not None]
    assert spans, "no chunk could be located in the source text"
    assert all(c["end_char"] > c["start_char"] for c in spans)
