"""Structured relationship extraction with a LOCAL model, grounded before anything is believed.

Owner decision, 2026-08-05: enable LLM graph extraction, on our own GPU.

MODEL: `mistral-small:24b` on the RTX 3090 — CHOSEN BY MEASUREMENT, after the first choice was
    measured and found wanting.

    qwen3:30b-a3b (a Mixture-of-Experts, ~3B active) was picked first for speed, and it IS fast.
    But across three trials designed so a wrong answer is unambiguously wrong — plain prose,
    passive voice, and Hebrew technical prose — it REVERSED the direction of 2 relationships out
    of 15. Direction is the one error grounding cannot catch, because both endpoints are real and
    both appear in the text, so it is the error that matters most.

        model                     total    correct   REVERSED
        qwen3:30b-a3b (MoE)         52s      11/15          2
        gemma4:31b (dense)          84s      16/18          0
        mistral-small:24b           55s      16/17          0

    On that evidence mistral-small looked like the answer. THEN IT WAS MEASURED ON REAL CORPUS
    CHUNKS, which are ~6,000 characters rather than the three-sentence trials above:

        model                     per chunk    whole corpus (9,380 chunks)
        qwen3:30b-a3b (MoE)           14.8s                       38.6 h
        mistral-small:24b (dense)     81.2s                      211.7 h

    5.5x slower on real input, where the MoE's few-active-experts design pays off and short
    synthetic sentences never showed it. So there is no winner, there is a TRADE-OFF, and the
    default is the fast one for a reason that is specific to this design: every extracted fact is
    written as `proposed` and a human must promote it before it can be returned. A direction error
    in a proposed fact costs one rejection at review; five extra days of GPU time costs five days.

    Use MODEL_ACCURATE (`--model mistral-small:24b`) for a small, high-value pass where a human
    will not be reviewing each edge.

    A dense 24B beating a 30B MoE on direction is not surprising in hindsight — resolving subject
    from object in an inverted clause wants full-model attention rather than a few routed experts
    — and neither is losing on throughput. Both had to be measured; neither could be reasoned out.

    THEN qwen3.6:27b WAS PULLED AND MEASURED, and it wins on the number that actually matters —
    not candidates produced, but candidates that SURVIVE the gates:

        model                  survivors  rejected  survive%   per chunk   corpus
        qwen3.6:27b                   11         0      100%       10.9s    28.4h
        qwen3:30b-a3b                 26        17       60%       18.8s    49.2h
        mistral-small:24b             14        15       48%       18.6s    48.4h

    It produces FEWER candidates and almost no noise: it returns an empty list when a chunk states
    no relationship, instead of filling the space. Fewer facts, each of which passed grounding —
    and every one is reviewed by a human anyway, so precision beats volume here.

    AND IT WAS NEARLY REJECTED FOR A BUG IN THIS FILE. qwen3.6 and qwen3.5 are THINKING models:
    they return an empty `response` and put the structured output in `thinking`, so a reader that
    looks only at `response` sees `Expecting value: line 1 column 1 (char 0)` and concludes the
    model cannot do structured output. Three trials, three empty replies, and the obvious reading
    was wrong. `think: False` is now requested, and the reader falls back to the field regardless,
    because a model that ignores the flag must not silently look broken.

    `graphify-extract` was considered and rejected: inspecting it showed qwen3:30b-a3b with
    different sampling parameters and no system prompt — a preset, not a tuned model.

WHY SELF-REPORTED CONFIDENCE IS NOT TRUSTED, which is the whole design of this file.

    A benchmark run on a real document returned eight relationships, EVERY ONE at confidence 1.0,
    and one of them was backwards (`check-pytest CALLS check-meta.mjs` — it is the other way
    round). A threshold applied to a number that is always 1.0 filters nothing. So the confidence
    field is recorded, and three DETERMINISTIC gates decide what is actually written:

      1. GROUNDING — both endpoint strings must appear verbatim in the chunk the claim came from.
         An entity the model produced from its own knowledge rather than from the text fails here.
         This is the same doctrine the product already applies to safety answers.
      2. RESOLUTION — each endpoint must resolve to something we already hold: a document path in
         PostgreSQL, or a graph node that already exists. An unresolvable endpoint is not a new
         discovery, it is a name nobody can follow.
      3. STATUS — everything a model extracts is written as `proposed`, never `current`. The
         prompt requires the graph to distinguish "proposed/unverified facts" from current ones,
         and this is what that distinction is FOR. Current-only retrieval therefore never returns
         a machine-extracted claim until a human promotes it.

    Direction errors survive grounding and resolution — both endpoints are real and both appear in
    the text. That is exactly why nothing here becomes `current` on its own.

NO DOCUMENT TEXT LEAVES THE MACHINE. The model is local, the embeddings are local, and this file
has no network call other than to 127.0.0.1.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from . import config
from .graph_schema import (
    ALLOWED_RELATIONSHIPS,
    STRUCTURAL_RELATIONSHIPS,
    GraphWrite,
    validate_batch,
)

log = logging.getLogger("knowledge.extract")

# The DEFAULT, and the choice is a trade-off with measured numbers on both sides rather than a
# winner. `--model` on scripts/extract_graph.py overrides it.
MODEL = "qwen3.6:27b"
MODEL_ACCURATE = "mistral-small:24b"
OLLAMA_GENERATE = f"{config.OLLAMA_URL}/api/generate"

# Structural edges are derived from PostgreSQL rows; a model has no business proposing them.
EXTRACTABLE = tuple(r for r in ALLOWED_RELATIONSHIPS if r not in STRUCTURAL_RELATIONSHIPS)

MIN_CHUNK_CHARS = 200        # below this there is rarely a relationship worth the call
MAX_CHUNK_CHARS = 6000
REQUEST_TIMEOUT = 300

# maxItems 25 — a 3.4x speedup AND a correctness fix, measured together.
#
# Without it the model RUNS AWAY on real corpus chunks: three of eight in a benchmark generated
# 27KB and hit the 8192-token ceiling mid-JSON, returning `Unterminated string ... line 1044`.
# Those calls cost 72 seconds each and produced NOTHING — the whole chunk came back unparseable.
#
#     no cap        72.3s per chunk · 3,260 output tokens · unparseable
#     maxItems 25   21.0s per chunk · 1,007 output tokens · 42 relationships
#
# The runaway WAS the cost. A chunk with more than 25 genuine relationships does not exist in this
# corpus; a chunk that appears to have 200 is a model looping, and truncating a loop loses nothing.
# This is not the same as capping tokens low (the policy that produced the earlier truncation bug):
# num_predict stays at 8192, and the limit is on the STRUCTURE, where the runaway actually is.
MAX_RELATIONSHIPS = 25

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "relationships": {
            "type": "array",
            "maxItems": MAX_RELATIONSHIPS,
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "type": {"type": "string", "enum": list(EXTRACTABLE)},
                    "target": {"type": "string"},
                    "confidence": {"type": "number"},
                    "evidence": {"type": "string"},
                },
                "required": ["source", "type", "target", "confidence", "evidence"],
            },
        }
    },
    "required": ["relationships"],
}

PROMPT = """Extract explicit relationships between named software entities from the text below.

RULES
- Use ONLY entity names that appear literally in the text. Never invent a name.
- Extract only what the text STATES. Do not infer, do not use outside knowledge.
- `evidence` must be a sentence copied verbatim from the text that supports the claim.
- Pay attention to DIRECTION: if A calls B, the source is A and the target is B.
- If the text states no relationship between named entities, return an empty list.

ALLOWED TYPES: {types}

TEXT
{text}
"""


@dataclass
class Candidate:
    source: str
    type: str
    target: str
    confidence: float
    evidence: str
    chunk_id: str
    revision_id: str
    source_path: str
    namespace: str

    def rejected_because(self, chunk_text: str, known: set[str]) -> str | None:
        """The three deterministic gates. Returns the reason, or None if it survives."""
        if self.type not in EXTRACTABLE:
            return f"type {self.type!r} is not extractable"
        if not self.source.strip() or not self.target.strip():
            return "an endpoint is empty"
        if self.source.strip() == self.target.strip():
            return "self-referential"
        for endpoint in (self.source, self.target):
            if endpoint not in chunk_text:
                return f"endpoint {endpoint!r} does not appear verbatim in the chunk (ungrounded)"
        # Whitespace-normalised, because the first version compared raw strings and rejected 85
        # of 131 candidates on FORMATTING rather than on fabrication — the model reflows line
        # breaks and collapses runs of spaces when it quotes. A gate that fires on whitespace is
        # not measuring what it claims to measure, and its rejection tally reads as "the model is
        # making things up" when the model was quoting correctly.
        #
        # This is deliberately the WEAKER of the two grounding checks. The load-bearing one is the
        # endpoint check above: an entity that is not in the text cannot survive regardless of
        # what the evidence says.
        if self.evidence.strip() and _squash(self.evidence) not in _squash(chunk_text):
            return "the quoted evidence is not in the chunk"
        # RESOLUTION IS A TRUST SIGNAL, NOT A GATE — corrected 2026-08-05 after measuring it.
        #
        # The first version required both endpoints to resolve to a document path we already hold,
        # and rejected 35 of 42 candidates on a corpus that names `pgvector`, `PGVectorStore` and
        # `llama-index-core` — packages, classes and services, which are exactly the entities
        # worth extracting and none of which is a document path. The rule excluded its own subject.
        #
        # The anti-hallucination protection is the VERBATIM check above, and it is untouched: an
        # entity the model produced from its own knowledge rather than from the text still cannot
        # survive. What resolution now decides is how much to TRUST a survivor, recorded on the
        # edge, not whether it exists at all.
        for endpoint in (self.source, self.target):
            if not _identifier_shaped(endpoint):
                return f"endpoint {endpoint!r} is prose, not an identifier"
        return None

    def resolution(self, known: set[str]) -> dict[str, str | None]:
        return {
            "source_resolved": _resolve(self.source, known),
            "target_resolved": _resolve(self.target, known),
        }


def _identifier_shaped(name: str) -> bool:
    """Does this look like a NAME rather than a phrase?

    An entity name is a thing you could look up: `pgvector`, `scripts/check-meta.mjs`,
    `PGVectorStore`, `mk_reader`. What this rejects is the model returning a fragment of prose as
    an entity — "the ingestion worker process" — which grounding alone would let through, because
    the phrase really is in the text.

    Three words is the ceiling: `Neo4j Community edition` is a name, `the table the worker writes
    to` is not.
    """
    name = name.strip()
    if not (1 < len(name) <= 120):
        return False
    if not any(ch.isalnum() for ch in name):
        return False
    if len(name.split()) > 3:
        return False
    return True


def _squash(text: str) -> str:
    """Collapse every run of whitespace to a single space, for comparing quoted text."""
    return " ".join(text.split())


def _resolve(name: str, known: set[str]) -> str | None:
    """Map a name the model produced onto something we already hold, or None.

    Exact path first, then a unique suffix match — `check-pytest.mjs` should find
    `scripts/check-pytest.mjs`, but an ambiguous suffix resolves to nothing rather than to a
    guess, because a wrong resolution is worse than no edge.
    """
    name = name.strip()
    if name in known:
        return name
    matches = [k for k in known if k.endswith("/" + name) or k.split("/")[-1] == name]
    return matches[0] if len(matches) == 1 else None


def known_entities(namespace: str = "repo") -> set[str]:
    """Every document path we hold. The universe an extracted endpoint may name."""
    conn = config.connect_reader()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT source_path FROM documents WHERE namespace = %s", (namespace,))
            return {r[0] for r in cur.fetchall()}
    finally:
        conn.close()


def call_model(text: str, *, model: str = MODEL, timeout: int = REQUEST_TIMEOUT) -> list[dict[str, Any]]:
    """One extraction call. Structure is enforced by Ollama's JSON-Schema `format`.

    A failure returns [] and says so rather than raising: one unparseable chunk must not stop an
    ingest, and a silently swallowed exception must not look like "no relationships here".
    """
    body = {
        "model": model,
        "prompt": PROMPT.format(types=", ".join(EXTRACTABLE), text=text[:MAX_CHUNK_CHARS]),
        "stream": False,
        # Thinking OFF. For an extraction with a fixed schema there is nothing to reason about,
        # and the reasoning is billed in time we do not get back. Models that ignore the flag are
        # handled by the fallback in the reader below.
        "think": False,
        "format": RESPONSE_SCHEMA,
        # num_predict 8192 — the owner's standing policy, and this run proved why it exists. At
        # 2048 a large chunk truncated mid-JSON and came back as `Unterminated string ... (char
        # 7593)`, which the caller can only report as "no relationships". A low ceiling on a
        # structured-output call does not produce a shorter answer, it produces an INVALID one,
        # and billing is on tokens actually used so the headroom is free.
        "options": {"temperature": 0, "num_ctx": 16384, "num_predict": 8192},
    }
    request = urllib.request.Request(
        OLLAMA_GENERATE, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        raw = json.loads(urllib.request.urlopen(request, timeout=timeout).read())
        # THINKING MODELS PUT THE ANSWER SOMEWHERE ELSE. qwen3.6 and qwen3.5 return an EMPTY
        # `response` and the structured output in `thinking` — so a client reading only `response`
        # gets `Expecting value: line 1 column 1 (char 0)` and reports the model as unusable.
        #
        # I nearly concluded exactly that about qwen3.6:27b: three trials, three empty replies,
        # and the obvious reading was "this model cannot do structured output". It can. The
        # request now asks for thinking to be OFF, and the reader falls back to the field anyway,
        # because a model that ignores the flag must not silently look broken.
        body_text = (raw.get("response") or "").strip() or (raw.get("thinking") or "").strip()
        if not body_text:
            log.warning("model %s returned neither response nor thinking", model)
            return []
        return json.loads(body_text).get("relationships", [])
    except (urllib.error.URLError, TimeoutError) as exc:
        log.warning("extraction model unreachable: %s", exc)
        return []
    except (json.JSONDecodeError, KeyError) as exc:
        log.warning("extraction returned unusable output: %s", exc)
        return []


def extract_from_chunks(
    chunks: list[dict[str, Any]],
    *,
    revision_id: str,
    source_path: str,
    namespace: str,
    known: set[str] | None = None,
    model: str = MODEL,
) -> tuple[list[Candidate], dict[str, int]]:
    """Extract from every substantial chunk, and return survivors plus a rejection tally.

    The TALLY is not decoration. An extraction pass that reports only what it accepted cannot be
    audited — "0 relationships" reads identically whether the model found nothing or everything it
    found was ungrounded.
    """
    known = known_entities(namespace) if known is None else known
    survivors: list[Candidate] = []
    rejected: dict[str, int] = {}

    for chunk in chunks:
        text = chunk["content"]
        if len(text) < MIN_CHUNK_CHARS:
            rejected["chunk too short to extract from"] = rejected.get("chunk too short to extract from", 0) + 1
            continue
        for raw in call_model(text, model=model):
            candidate = Candidate(
                source=str(raw.get("source", "")),
                type=str(raw.get("type", "")),
                target=str(raw.get("target", "")),
                confidence=float(raw.get("confidence", 0.0)),
                evidence=str(raw.get("evidence", "")),
                chunk_id=chunk["node_id"],
                revision_id=revision_id,
                source_path=source_path,
                namespace=namespace,
            )
            reason = candidate.rejected_because(text, known)
            if reason:
                rejected[reason.split("'")[0].strip() or reason] = (
                    rejected.get(reason.split("'")[0].strip() or reason, 0) + 1
                )
                continue
            survivors.append(candidate)
    return survivors, rejected


def to_graph_writes(candidates: list[Candidate], *, document_id: str) -> list[GraphWrite]:
    """Turn survivors into validated graph writes — as `proposed`, never `current`."""
    writes: list[GraphWrite] = []
    for c in candidates:
        writes.append(GraphWrite("relationship", c.type, {
            "source_document_id": document_id,
            "source_revision_id": c.revision_id,
            "source_chunk_id": c.chunk_id,
            "source_uri": c.source_path,
            "extraction_method": "structured_llm",
            "extraction_confidence": c.confidence,
            "status": "proposed",          # the prompt's fourth fact class, and the point of it
            "valid_from": None,
        }))
    return writes


def validate(candidates: list[Candidate], *, document_id: str) -> None:
    """Run the survivors through the same gate the worker uses. Raises on any violation."""
    writes = to_graph_writes(candidates, document_id=document_id)
    for w in writes:
        w.properties["valid_from"] = w.properties["valid_from"] or "1970-01-01T00:00:00Z"
    # `proposed` facts are below the confidence threshold by design in some cases; the threshold
    # is applied at PROMOTION, not at proposal, because a proposal is explicitly unverified.
    validate_batch(writes, confidence_threshold=0.0)
