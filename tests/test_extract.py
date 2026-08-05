"""The extraction gates reject what they must — tested WITHOUT the model, where it matters most.

The model is slow and non-deterministic; the gates are neither. So the gates are tested against
hand-built candidates, including the exact failure the benchmark exhibited (a confident, plausible,
BACKWARDS relationship), and only two tests actually call the model.

The point of this file: what protects the graph is not the model's confidence — the benchmark
returned 1.0 on all eight claims including a reversed one — but grounding, resolution, and the fact
that nothing a model produces is ever written as `current`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import extract  # noqa: E402
from src.knowledge.extract import Candidate  # noqa: E402
from src.knowledge.graph_schema import STRUCTURAL_RELATIONSHIPS  # noqa: E402

# Longer than MIN_CHUNK_CHARS on purpose. The first version was 155 characters and every
# candidate was rejected as "chunk too short" — the test measured the length filter rather than
# the gates it was written for, and reported it as zero survivors.
CHUNK = (
    "scripts/check-meta.mjs calls scripts/check-pytest.mjs before the commit is allowed. "
    "The gate depends on app.js being present, and reads it directly from the working tree. "
    "It does not touch data.py at any point during the run, and never writes to it. "
    "When the suite is red the hook blocks, and the commit does not proceed."
)
KNOWN = {"scripts/check-meta.mjs", "scripts/check-pytest.mjs", "app.js", "data.py"}


def _c(source, type_, target, *, confidence=1.0, evidence="") -> Candidate:
    return Candidate(source=source, type=type_, target=target, confidence=confidence,
                     evidence=evidence, chunk_id="c1", revision_id="r1",
                     source_path="docs/x.md", namespace="repo")


# --- the gates -------------------------------------------------------------------------------

def test_a_well_grounded_relationship_survives():
    c = _c("scripts/check-meta.mjs", "CALLS", "scripts/check-pytest.mjs")
    assert c.rejected_because(CHUNK, KNOWN) is None


def test_an_entity_the_model_invented_is_rejected_however_confident():
    """The failure mode that matters: a plausible name that is not in the text.

    Confidence 1.0 does not save it, and that is the design — the benchmark returned 1.0 on
    everything, including a claim that was backwards.
    """
    c = _c("scripts/check-meta.mjs", "CALLS", "scripts/check-lint.mjs", confidence=1.0)
    reason = c.rejected_because(CHUNK, KNOWN)
    assert reason and "ungrounded" in reason


def test_an_entity_we_do_not_already_hold_is_ALLOWED_when_it_is_grounded():
    """Corrected 2026-08-05. Requiring an endpoint to pre-exist as a document path rejected 35 of
    42 candidates on a corpus naming `pgvector`, `PGVectorStore` and `llama-index-core` — packages
    and classes, which are exactly the entities worth extracting. The rule excluded its own
    subject. Grounding still protects against invention; resolution is now a trust signal."""
    chunk = CHUNK + " It also reads webpack.config.js during the build."
    c = _c("scripts/check-meta.mjs", "DEPENDS_ON", "webpack.config.js")
    assert c.rejected_because(chunk, KNOWN) is None
    assert c.resolution(KNOWN)["target_resolved"] is None, "it resolved to something it should not"
    assert c.resolution(KNOWN)["source_resolved"] == "scripts/check-meta.mjs"


def test_a_phrase_of_prose_is_rejected_even_though_it_is_grounded():
    """Grounding alone would let this through — the phrase really is in the text."""
    chunk = CHUNK + " The gate blocks the commit when the suite is red."
    c = _c("scripts/check-meta.mjs", "AFFECTS", "the commit when the suite is red")
    reason = c.rejected_because(chunk, KNOWN)
    assert reason and "prose, not an identifier" in reason


def test_whitespace_differences_in_quoted_evidence_do_not_reject_a_real_quote():
    """85 of 131 candidates were rejected on FORMATTING — the model reflows line breaks when it
    quotes. A gate that fires on whitespace is not measuring what it claims to."""
    c = _c("scripts/check-meta.mjs", "CALLS", "scripts/check-pytest.mjs",
           evidence="scripts/check-meta.mjs   calls\n  scripts/check-pytest.mjs before the commit is allowed.")
    assert c.rejected_because(CHUNK, KNOWN) is None


def test_fabricated_evidence_is_rejected():
    c = _c("scripts/check-meta.mjs", "CALLS", "scripts/check-pytest.mjs",
           evidence="check-meta.mjs is documented to call every gate in parallel.")
    reason = c.rejected_because(CHUNK, KNOWN)
    assert reason and "evidence" in reason


def test_a_self_referential_edge_is_rejected():
    c = _c("app.js", "DEPENDS_ON", "app.js")
    assert c.rejected_because(CHUNK, KNOWN) == "self-referential"


def test_a_structural_relationship_cannot_be_extracted_by_a_model():
    """HAS_REVISION and friends come from PostgreSQL rows. A model has no business proposing one."""
    for rel in STRUCTURAL_RELATIONSHIPS:
        assert rel not in extract.EXTRACTABLE
        c = _c("app.js", rel, "data.py")
        reason = c.rejected_because(CHUNK, KNOWN)
        assert reason and "not extractable" in reason


def test_a_bare_filename_resolves_to_its_unique_path():
    chunk = "check-pytest.mjs is invoked by check-meta.mjs."
    known = {"scripts/check-pytest.mjs", "scripts/check-meta.mjs"}
    assert extract._resolve("check-pytest.mjs", known) == "scripts/check-pytest.mjs"


def test_an_ambiguous_name_resolves_to_nothing_rather_than_to_a_guess():
    """A wrong resolution is worse than no edge: it produces a confident, traceable, false link."""
    known = {"a/config.py", "b/config.py"}
    assert extract._resolve("config.py", known) is None


# --- what is written -------------------------------------------------------------------------

def test_everything_a_model_extracts_is_written_as_proposed_never_current():
    """The prompt's fourth fact class exists for exactly this, and current-only retrieval
    therefore never returns a machine-extracted claim until a human promotes it."""
    writes = extract.to_graph_writes(
        [_c("scripts/check-meta.mjs", "CALLS", "scripts/check-pytest.mjs")], document_id="d1"
    )
    assert writes
    for w in writes:
        assert w.properties["status"] == "proposed"
        assert w.properties["extraction_method"] == "structured_llm"
        assert w.properties["source_revision_id"] and w.properties["source_chunk_id"]


def test_the_writes_pass_the_same_gate_the_worker_uses():
    extract.validate([_c("scripts/check-meta.mjs", "CALLS", "scripts/check-pytest.mjs")], document_id="d1")


def test_a_model_failure_returns_nothing_rather_than_raising(monkeypatch):
    """One unparseable chunk must not stop an ingest — and must not look like "nothing here"."""
    monkeypatch.setattr(extract, "OLLAMA_GENERATE", "http://127.0.0.1:1/api/generate")
    assert extract.call_model("some text") == []


def test_the_rejection_tally_is_reported_not_only_the_survivors(monkeypatch):
    """An extraction pass that reports only what it accepted cannot be audited: "0 relationships"
    reads identically whether the model found nothing or everything it found was ungrounded."""
    monkeypatch.setattr(extract, "call_model", lambda text, **kw: [
        {"source": "scripts/check-meta.mjs", "type": "CALLS",
         "target": "scripts/check-pytest.mjs", "confidence": 1.0, "evidence": ""},
        {"source": "scripts/check-meta.mjs", "type": "CALLS",
         "target": "totally-invented.mjs", "confidence": 1.0, "evidence": ""},
    ])
    survivors, rejected = extract_with(monkeypatch)
    assert len(survivors) == 1
    assert sum(rejected.values()) >= 1, "a rejected candidate was not counted"


def extract_with(monkeypatch):
    chunks = [{"content": CHUNK, "node_id": "c1"}]
    return extract.extract_from_chunks(
        chunks, revision_id="r1", source_path="docs/x.md", namespace="repo", known=KNOWN
    )


# --- the model itself --------------------------------------------------------------------------

def _require_model():
    import json
    import urllib.request

    try:
        tags = json.loads(urllib.request.urlopen(f"{extract.config.OLLAMA_URL}/api/tags", timeout=10).read())
    except Exception as exc:
        pytest.skip(f"ollama is not reachable ({type(exc).__name__})")
    names = {m["name"] for m in tags.get("models", [])}
    if extract.MODEL not in names:
        pytest.skip(f"{extract.MODEL} is not installed locally")


def test_the_model_returns_the_declared_schema():
    """Structure is ENFORCED by Ollama's JSON-Schema `format`, not requested and hoped for."""
    _require_model()
    out = extract.call_model(CHUNK)
    assert isinstance(out, list)
    for rel in out:
        assert set(rel) >= {"source", "type", "target", "confidence", "evidence"}
        assert rel["type"] in extract.EXTRACTABLE


def test_the_model_output_survives_the_gates_on_a_real_chunk():
    """End to end on text whose entities we actually hold."""
    _require_model()
    survivors, rejected = extract.extract_from_chunks(
        [{"content": CHUNK, "node_id": "c1"}],
        revision_id="r1", source_path="docs/x.md", namespace="repo", known=KNOWN,
    )
    print(f"\n  survivors: {len(survivors)} · rejected: {rejected}")
    for s in survivors:
        print(f"    {s.source} -[{s.type}]-> {s.target} (model confidence {s.confidence})")
    extract.validate(survivors, document_id="d1")
