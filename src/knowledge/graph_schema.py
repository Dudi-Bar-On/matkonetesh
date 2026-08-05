"""The Neo4j allowlist, and the gate that enforces it.

The owner's prompt, Phase 4: "Neo4j is a graph projection with provenance, not an ungoverned graph
of arbitrary LLM-generated triples. Use a strict allowlist of node labels and relationship types.
... Do not add labels or relationship types merely because an LLM suggests them. Any schema
expansion requires an explicit reviewed migration."

The two tuples below are transcribed from that prompt. They are the SINGLE source of truth: the
Cypher constraints are generated from them, the write gate validates against them, and a test
asserts the counts and the exact names, so a label cannot be added by editing one place.

WHY A GATE AND NOT A CONVENTION. Neo4j is schemaless — `CREATE (n:WhateverYouLike)` succeeds. There
is no database-level equivalent of PostgreSQL's CHECK constraint for labels, so the allowlist can
only be enforced on the way in. That makes this module the whole of the enforcement, which is why
it validates rather than documents.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

# --- transcribed from the prompt, Phase 4 -----------------------------------------------------

ALLOWED_LABELS: tuple[str, ...] = (
    "Document",
    "DocumentRevision",
    "Section",
    "Repository",
    "System",
    "Service",
    "Module",
    "API",
    "Database",
    "Job",
    "Event",
    "Requirement",
    "Decision",
    "Owner",
    "Dependency",
    "ExternalTool",
)

ALLOWED_RELATIONSHIPS: tuple[str, ...] = (
    "HAS_REVISION",
    "SUPERSEDES",
    "HAS_SECTION",
    "DESCRIBES",
    "DEPENDS_ON",
    "CALLS",
    "IMPLEMENTS",
    "AFFECTS",
    "OWNED_BY",
    "CITES",
    "CONTRADICTS",
    "PRODUCES",
    "CONSUMES",
)

# Prompt: "Every graph node must have: stable canonical identifier; node type/label; namespace;
# status; created timestamp; updated timestamp."
REQUIRED_NODE_PROPERTIES: tuple[str, ...] = (
    "canonical_id",
    "namespace",
    "status",
    "created_at",
    "updated_at",
)

# Prompt: "Every fact-bearing relationship must include provenance where applicable."
#
# `where applicable` is the load-bearing phrase and it is resolved deliberately rather than left
# to a judgement call at each call site: the STRUCTURAL relationships below are derived from
# PostgreSQL rows we already hold, so their provenance IS the row. Everything else is a claim
# about the world, and a claim without a source is the thing this whole stack exists to prevent.
STRUCTURAL_RELATIONSHIPS: frozenset[str] = frozenset(
    {"HAS_REVISION", "SUPERSEDES", "HAS_SECTION"}
)

REQUIRED_PROVENANCE: tuple[str, ...] = (
    "source_document_id",
    "source_revision_id",
    "source_chunk_id",
    "source_uri",
    "extraction_method",
    "extraction_confidence",
    "status",
    "valid_from",
)

# Prompt: "The graph must support distinguishing: current facts; superseded facts;
# proposed/unverified facts; manually confirmed facts."
FACT_STATUSES: tuple[str, ...] = ("current", "superseded", "proposed", "manually_confirmed")

# Prompt: "Prefer deterministic extraction for known project structures. Use structured LLM
# extraction only for approved schema fields."
EXTRACTION_METHODS: tuple[str, ...] = ("deterministic", "structured_llm", "manual")

# Prompt: "Reject ... low-confidence output according to a configurable threshold."
DEFAULT_CONFIDENCE_THRESHOLD = 0.75

# A canonical identifier is namespaced and machine-comparable. Anything else is a name, and names
# collide — 47 id collisions between CUTS and SPECIALS is already a finding in this repo's register.
#
# The identifier half may begin with `.` or `_`, and that is not permissiveness for its own sake:
# the first version required an alphanumeric first character, and running it over `git ls-files`
# refused 32 REAL TRACKED FILES — every `.claude/agents/*.md`, `.github/workflows/*`,
# `.gitattributes`. A rule that forbids ingesting a repository's own dotfiles is not a strict rule,
# it is a wrong one. The namespace half stays strict (lowercase, letter-initial) because it is our
# vocabulary, not the filesystem's.
# The identifier half accepts any non-control text that neither starts nor ends with whitespace.
# That is deliberately permissive and it was narrowed to reality twice, both times by running it
# over the actual corpus rather than over examples:
#
#   round 1  an alphanumeric first character refused 32 tracked files (.claude/*, .github/*)
#   round 2  an ASCII-only class refused a real path containing `✕` (U+2715) during the migration
#
# The identifier is a filesystem path or a stable id WE generate — the filesystem's alphabet is
# not ours to legislate. The NAMESPACE half stays strict (lowercase ASCII, letter-initial) because
# that half IS our vocabulary, and it is the half that has to be typed, compared and filtered on.
CANONICAL_ID = re.compile(r"^[a-z][a-z0-9_-]*:\S(?:[^\x00-\x1f]{0,253}\S)?$")


class SchemaViolation(ValueError):
    """A write that the allowlist refuses. Carries WHICH rule, not just that one broke."""


@dataclass(frozen=True)
class GraphWrite:
    """One node or relationship, as it would be written."""

    kind: str            # 'node' | 'relationship'
    type_name: str       # the label, or the relationship type
    properties: dict[str, Any]


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SchemaViolation(message)


def validate_node(label: str, properties: dict[str, Any]) -> None:
    """Refuse a node that is not on the allowlist or is missing a required property."""
    _require(
        label in ALLOWED_LABELS,
        f"label {label!r} is not on the allowlist. Adding one requires a reviewed migration, "
        f"not a code change. Allowed: {', '.join(ALLOWED_LABELS)}",
    )
    missing = [p for p in REQUIRED_NODE_PROPERTIES if properties.get(p) in (None, "")]
    _require(not missing, f"{label} node is missing required propert(ies): {', '.join(missing)}")
    _require(
        isinstance(properties["canonical_id"], str)
        and bool(CANONICAL_ID.match(properties["canonical_id"])),
        f"canonical_id {properties.get('canonical_id')!r} is malformed — expected "
        f"`namespace:identifier` (lowercase namespace, then a stable identifier)",
    )


def validate_relationship(
    rel_type: str,
    properties: dict[str, Any],
    *,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> None:
    """Refuse a relationship that is off-allowlist, unprovenanced, or below the threshold."""
    _require(
        rel_type in ALLOWED_RELATIONSHIPS,
        f"relationship type {rel_type!r} is not on the allowlist. "
        f"Allowed: {', '.join(ALLOWED_RELATIONSHIPS)}",
    )

    status = properties.get("status")
    _require(
        status in FACT_STATUSES,
        f"{rel_type}.status {status!r} is not one of {', '.join(FACT_STATUSES)}",
    )

    if rel_type in STRUCTURAL_RELATIONSHIPS:
        # Derived from rows PostgreSQL already holds; the row is the provenance.
        return

    missing = [p for p in REQUIRED_PROVENANCE if properties.get(p) in (None, "")]
    _require(
        not missing,
        f"{rel_type} is fact-bearing and is missing provenance: {', '.join(missing)}. "
        f"Prompt: never treat a generated edge as authoritative without a source revision and "
        f"source chunk reference.",
    )

    method = properties.get("extraction_method")
    _require(
        method in EXTRACTION_METHODS,
        f"{rel_type}.extraction_method {method!r} is not one of {', '.join(EXTRACTION_METHODS)}",
    )

    raw_confidence = properties.get("extraction_confidence")
    _require(
        isinstance(raw_confidence, (int, float)) and not isinstance(raw_confidence, bool),
        f"{rel_type}.extraction_confidence {raw_confidence!r} is not a number",
    )
    confidence = float(raw_confidence)  # type: ignore[arg-type]  — guarded immediately above
    _require(
        0.0 <= confidence <= 1.0,
        f"{rel_type}.extraction_confidence {confidence} is outside [0, 1]",
    )
    # A manual confirmation is a human saying so, and outranks a model's own score. Deterministic
    # extraction is not scored either — it either matched the structure or it did not.
    if method == "structured_llm":
        _require(
            confidence >= confidence_threshold,
            f"{rel_type}.extraction_confidence {confidence} is below the threshold "
            f"{confidence_threshold}. Rejected rather than written as a low-confidence fact.",
        )


def validate_batch(writes: Iterable[GraphWrite], **kwargs: Any) -> None:
    """Validate a whole batch, reporting EVERY violation rather than only the first.

    One-at-a-time reporting turns a batch of ten problems into ten round trips, and this project
    has already learned what that costs.
    """
    problems: list[str] = []
    for w in writes:
        try:
            if w.kind == "node":
                validate_node(w.type_name, w.properties)
            elif w.kind == "relationship":
                validate_relationship(w.type_name, w.properties, **kwargs)
            else:
                problems.append(f"unknown write kind {w.kind!r}")
        except SchemaViolation as exc:
            problems.append(str(exc))
    if problems:
        raise SchemaViolation(
            f"{len(problems)} write(s) refused:\n  - " + "\n  - ".join(problems)
        )
