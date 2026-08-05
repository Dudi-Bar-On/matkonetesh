"""The Neo4j allowlist is exactly what the prompt says, and the gate actually refuses.

Two halves, and the split matters:

  * The allowlist and validator tests run ANYWHERE — they are pure Python, no database. They are
    the ones that would catch a label being added by a well-meaning edit.
  * The constraint tests need the live graph and skip with a reason when it is absent.

Neo4j is SCHEMALESS: `CREATE (n:WhateverYouLike)` succeeds, and no Community-edition feature can
stop it. The allowlist therefore has exactly one enforcement point — the gate in
src/knowledge/graph_schema.py — so these tests attack that gate rather than describe it.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge.graph_schema import (  # noqa: E402
    ALLOWED_LABELS,
    ALLOWED_RELATIONSHIPS,
    DEFAULT_CONFIDENCE_THRESHOLD,
    FACT_STATUSES,
    GraphWrite,
    REQUIRED_NODE_PROPERTIES,
    SchemaViolation,
    validate_batch,
    validate_node,
    validate_relationship,
)

# Transcribed from docs/infra/owner-prompt-2026-08-05-knowledge-stack.md, Phase 4. Deliberately
# duplicated here: if the source tuple is edited, this copy is what notices.
PROMPT_LABELS = [
    "Document", "DocumentRevision", "Section", "Repository", "System", "Service", "Module",
    "API", "Database", "Job", "Event", "Requirement", "Decision", "Owner", "Dependency",
    "ExternalTool",
]
PROMPT_RELATIONSHIPS = [
    "HAS_REVISION", "SUPERSEDES", "HAS_SECTION", "DESCRIBES", "DEPENDS_ON", "CALLS",
    "IMPLEMENTS", "AFFECTS", "OWNED_BY", "CITES", "CONTRADICTS", "PRODUCES", "CONSUMES",
]


def _node(**overrides):
    props = {
        "canonical_id": "repo:docs/process/development-discipline.md",
        "namespace": "repo",
        "status": "current",
        "created_at": "2026-08-05T00:00:00Z",
        "updated_at": "2026-08-05T00:00:00Z",
    }
    props.update(overrides)
    return props


def _fact(**overrides):
    props = {
        "source_document_id": "d1",
        "source_revision_id": "r1",
        "source_chunk_id": "c1",
        "source_uri": "docs/x.md",
        "extraction_method": "deterministic",
        "extraction_confidence": 1.0,
        "status": "current",
        "valid_from": "2026-08-05T00:00:00Z",
    }
    props.update(overrides)
    return props


# --- the allowlist is the prompt's, unchanged -------------------------------------------------

def test_the_allowlist_is_exactly_the_prompts_sixteen_labels():
    assert list(ALLOWED_LABELS) == PROMPT_LABELS
    assert len(ALLOWED_LABELS) == 16


def test_the_allowlist_is_exactly_the_prompts_thirteen_relationships():
    assert list(ALLOWED_RELATIONSHIPS) == PROMPT_RELATIONSHIPS
    assert len(ALLOWED_RELATIONSHIPS) == 13


def test_the_four_fact_statuses_the_prompt_requires_exist():
    assert set(FACT_STATUSES) == {"current", "superseded", "proposed", "manually_confirmed"}


# --- the gate refuses ------------------------------------------------------------------------

def test_an_unknown_label_is_refused():
    with pytest.raises(SchemaViolation) as exc:
        validate_node("Ingredient", _node())
    assert "not on the allowlist" in str(exc.value)


def test_an_unknown_relationship_type_is_refused():
    with pytest.raises(SchemaViolation) as exc:
        validate_relationship("SEASONS", _fact())
    assert "not on the allowlist" in str(exc.value)


@pytest.mark.parametrize("prop", REQUIRED_NODE_PROPERTIES)
def test_a_node_missing_any_required_property_is_refused(prop):
    with pytest.raises(SchemaViolation) as exc:
        validate_node("Document", _node(**{prop: None}))
    assert prop in str(exc.value)


@pytest.mark.parametrize(
    "bad_id",
    ["no-namespace", "UPPER:x", "repo:", ":x", "repo x:y", ""],
    ids=["no namespace", "uppercase namespace", "empty id", "empty namespace", "space", "blank"],
)
def test_a_malformed_canonical_id_is_refused(bad_id):
    with pytest.raises(SchemaViolation):
        validate_node("Document", _node(canonical_id=bad_id))


@pytest.mark.parametrize("prop", ["source_revision_id", "source_chunk_id", "extraction_method"])
def test_a_fact_bearing_relationship_without_provenance_is_refused(prop):
    """Prompt: never treat a generated edge as authoritative without a source revision and chunk."""
    with pytest.raises(SchemaViolation) as exc:
        validate_relationship("CITES", _fact(**{prop: None}))
    assert prop in str(exc.value)


def test_a_structural_relationship_does_not_need_chunk_provenance():
    """HAS_REVISION is derived from a PostgreSQL row; the row is its provenance.

    Without this exemption the projection could not write the document->revision spine at all,
    which would make the graph unbuildable — a rule that forbids the thing it exists to enable.
    """
    validate_relationship("HAS_REVISION", {"status": "current"})


def test_a_low_confidence_llm_extraction_is_refused():
    with pytest.raises(SchemaViolation) as exc:
        validate_relationship(
            "AFFECTS", _fact(extraction_method="structured_llm", extraction_confidence=0.4)
        )
    assert "below the threshold" in str(exc.value)


def test_the_confidence_threshold_is_configurable_as_the_prompt_requires():
    props = _fact(extraction_method="structured_llm", extraction_confidence=0.5)
    with pytest.raises(SchemaViolation):
        validate_relationship("AFFECTS", props, confidence_threshold=DEFAULT_CONFIDENCE_THRESHOLD)
    validate_relationship("AFFECTS", props, confidence_threshold=0.4)   # same fact, lower bar


def test_deterministic_extraction_is_not_subject_to_the_confidence_threshold():
    """It either matched the structure or it did not; a score would be theatre."""
    validate_relationship("DEPENDS_ON", _fact(extraction_method="deterministic", extraction_confidence=0.0))


def test_an_unknown_fact_status_is_refused():
    with pytest.raises(SchemaViolation) as exc:
        validate_relationship("CITES", _fact(status="probably"))
    assert "status" in str(exc.value)


def test_a_batch_reports_every_violation_not_just_the_first():
    writes = [
        GraphWrite("node", "Ingredient", _node()),
        GraphWrite("node", "Document", _node(namespace=None)),
        GraphWrite("relationship", "SEASONS", _fact()),
    ]
    with pytest.raises(SchemaViolation) as exc:
        validate_batch(writes)
    message = str(exc.value)
    assert "3 write(s) refused" in message
    for expected in ("Ingredient", "namespace", "SEASONS"):
        assert expected in message


def test_a_valid_write_passes():
    """The gate permits the legitimate case — otherwise it is not a gate, it is a wall."""
    validate_batch([
        GraphWrite("node", "Document", _node()),
        GraphWrite("node", "Requirement", _node(canonical_id="repo:R-93")),
        GraphWrite("relationship", "CITES", _fact()),
        GraphWrite("relationship", "HAS_REVISION", {"status": "current"}),
    ])


# --- the live graph --------------------------------------------------------------------------

def _session():
    neo4j = pytest.importorskip("neo4j", reason="the graph driver is not installed")
    from dotenv import dotenv_values

    env_file = ROOT / "infra" / ".env"
    if not env_file.exists():
        pytest.skip("infra/.env not present — the stack has not been configured here")
    env = dotenv_values(env_file)
    try:
        driver = neo4j.GraphDatabase.driver(
            f"bolt://127.0.0.1:{env['NEO4J_BOLT_PORT']}",
            auth=(str(env["NEO4J_USER"]), str(env["NEO4J_PASSWORD"])),
            connection_timeout=5,
        )
        driver.verify_connectivity()
    except Exception as exc:
        pytest.skip(f"Neo4j is not reachable ({type(exc).__name__}) — start it with: docker compose up -d")
    return driver


def test_every_allowed_label_has_a_unique_canonical_id_constraint():
    """Prompt: "Create constraints and indexes for stable identifiers before loading data."

    A MERGE on a non-unique key silently creates duplicates under concurrency, which is the exact
    failure the prompt's "do not create duplicate entity nodes on repeated ingestion" forbids.
    """
    driver = _session()
    try:
        with driver.session() as s:
            names = {r["name"] for r in s.run("SHOW CONSTRAINTS YIELD name RETURN name")}
    finally:
        driver.close()
    missing = [lab for lab in ALLOWED_LABELS if f"{lab.lower()}_canonical_id_unique" not in names]
    assert not missing, f"no uniqueness constraint for: {', '.join(missing)}"


def test_every_allowed_label_is_indexed_on_namespace_and_status():
    driver = _session()
    try:
        with driver.session() as s:
            names = {r["name"] for r in s.run("SHOW INDEXES YIELD name RETURN name")}
    finally:
        driver.close()
    missing = [
        f"{lab}.{prop}"
        for lab in ALLOWED_LABELS
        for prop in ("namespace", "status")
        if f"{lab.lower()}_{prop}_idx" not in names
    ]
    assert not missing, f"missing indexes: {', '.join(missing)}"


def test_the_uniqueness_constraint_actually_refuses_a_duplicate():
    """Asserted by attacking it. A constraint that is only listed is a name, not a guarantee."""
    driver = _session()
    cid = "__test__:duplicate-probe"
    create = (
        "CREATE (n:Document {canonical_id: $c, namespace: '__test__', status: 'current', "
        "created_at: datetime(), updated_at: datetime()})"
    )
    try:
        with driver.session() as s:
            # The cleanup is in a finally, and it has to be. The first version put it after the
            # assertion: when the constraint did not yet exist, the second CREATE succeeded, the
            # assertion failed, and the cleanup never ran — leaving two duplicate nodes that then
            # made it IMPOSSIBLE to create the constraint at all. A test that fails and leaves
            # behind the data preventing its own fix is worse than no test.
            try:
                s.run("MATCH (n:Document {canonical_id: $c}) DETACH DELETE n", c=cid).consume()
                s.run(create, c=cid).consume()
                with pytest.raises(Exception) as exc:
                    s.run(create, c=cid).consume()
                assert "already exists" in str(exc.value) or "ConstraintValidation" in str(exc.value)
            finally:
                s.run("MATCH (n:Document {canonical_id: $c}) DETACH DELETE n", c=cid).consume()
    finally:
        driver.close()
