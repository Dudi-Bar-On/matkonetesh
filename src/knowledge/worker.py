"""The single-writer ingestion worker. The only process permitted to write.

The prompt, Phase 6: "Implement one ingestion worker process only. It must be the only process
permitted to write to shared PostgreSQL knowledge tables, pgvector embeddings, Neo4j graph
projection. Subagents and query services are read-only consumers."

HOW "ONLY ONE" IS ACTUALLY ENFORCED, in three independent layers, because a rule that depends on
everyone remembering it is not enforcement:

  1. A PostgreSQL ADVISORY LOCK held for the worker's lifetime. A second worker cannot take it and
     exits saying so. This is process-level and survives a crash — the lock dies with the session.
  2. A per-document LEASE in ingestion_jobs, with an expiry. The advisory lock stops two workers;
     the lease stops one worker from re-entering a job another instance abandoned mid-flight, and
     lets an abandoned job become claimable on its own rather than by a human decision.
  3. The partial unique index one_active_job_per_document, which makes a second pending/running
     job for the same document impossible even if both layers above were bypassed.

THE ORDER OF WRITES IS THE DESIGN, and it is the prompt's step 8 in order. PostgreSQL and Neo4j
cannot be one transaction. So the sequence is arranged such that every crash point leaves a state
that is recoverable and honest:

    new revision (status=processing)      <- old revision still current
    chunks + embeddings committed
    status=indexed, indexed_at set        <- old revision STILL current
    graph projection (idempotent upsert)
    status=graph_projected                <- old revision STILL current
    supersede old, activate new           <- the only step that changes what readers see

A crash anywhere before the last line leaves the previous revision serving traffic and the new one
visibly incomplete. There is no window in which readers see a half-projected revision, and that is
guaranteed by the schema (current_requires_both_sides), not by this file being careful.
"""

from __future__ import annotations

import hashlib
import logging
import socket
import time
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from . import config
from .graph_schema import GraphWrite, validate_batch

log = logging.getLogger("knowledge.worker")

ROOT = Path(__file__).resolve().parent.parent.parent

# One arbitrary but FIXED key. Every worker asks for the same one, which is what makes it a
# singleton lock rather than a per-worker formality.
SINGLETON_LOCK_KEY = 0x6D6B_6B6E   # 'mkkn'

LEASE_SECONDS = 600
DEBOUNCE_SECONDS = 5
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 2

CODE_SUFFIXES = {".js": "javascript", ".mjs": "javascript", ".py": "python", ".ts": "typescript"}


class WorkerBusy(RuntimeError):
    """Another worker holds the singleton lock. Not an error — the design working."""


@dataclass
class IngestResult:
    source_path: str
    outcome: str          # 'unchanged' | 'ingested' | 'failed' | 'debounced'
    revision_id: str | None = None
    chunks: int = 0
    graph_nodes: int = 0
    detail: str = ""


def _lease_owner() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


class SingleWriter:
    """Context manager holding the advisory lock for as long as the worker runs."""

    def __init__(self) -> None:
        self.conn = None

    def __enter__(self):
        self.conn = config.connect_writer()
        self.conn.autocommit = True
        with self.conn.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_lock(%s)", (SINGLETON_LOCK_KEY,))
            got = cur.fetchone()[0]
        if not got:
            self.conn.close()
            self.conn = None
            raise WorkerBusy(
                "another ingestion worker holds the singleton lock. Only one worker may write "
                "(prompt, Phase 6). This process is exiting without writing anything."
            )
        log.info("singleton lock acquired by %s", _lease_owner())
        return self.conn

    def __exit__(self, *exc: Any) -> None:
        if self.conn is not None:
            try:
                with self.conn.cursor() as cur:
                    cur.execute("SELECT pg_advisory_unlock(%s)", (SINGLETON_LOCK_KEY,))
            finally:
                self.conn.close()
                self.conn = None


# --- chunking --------------------------------------------------------------------------------

def chunk_document(path: Path, text: str) -> list[dict[str, Any]]:
    """Structural chunks via LlamaIndex — Markdown by heading, code by AST.

    Stable identifiers, as the prompt asks ("stable chunk identifiers derived from
    revision/content structure where practical"): the id is a hash of the chunk's own text plus
    its position, so an unchanged section keeps its identifier across revisions and a changed one
    does not. Deriving it from LlamaIndex's random node id would make every re-parse look like a
    complete rewrite.
    """
    from llama_index.core import Document
    from llama_index.core.node_parser import CodeSplitter, MarkdownNodeParser

    suffix = path.suffix.lower()
    doc = Document(text=text, metadata={"source_path": str(path)})

    if suffix in CODE_SUFFIXES:
        parser = CodeSplitter(language=CODE_SUFFIXES[suffix], parser=_code_parser(CODE_SUFFIXES[suffix]))
    else:
        parser = MarkdownNodeParser()

    nodes = parser.get_nodes_from_documents([doc])
    out: list[dict[str, Any]] = []
    cursor = 0
    for index, node in enumerate(nodes):
        content = node.get_content()
        start = text.find(content, cursor)
        if start >= 0:
            cursor = start + len(content)
        # `header_path`, not `Header_1..N`. Verified by printing the metadata of a real parse
        # rather than assumed from the other place in this repo that reads headings — the parser's
        # key changed between versions, and looking for the old one produced an empty heading on
        # EVERY chunk with no error anywhere.
        heading = (node.metadata.get("header_path") or "").strip("/") or None
        out.append({
            "chunk_index": index,
            "node_id": hashlib.sha256(f"{index}\x00{content}".encode("utf-8")).hexdigest()[:32],
            "content": content,
            "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            "heading_path": heading,
            "start_char": start if start >= 0 else None,
            "end_char": (start + len(content)) if start >= 0 else None,
            "metadata": {k: v for k, v in node.metadata.items() if k != "source_path"},
        })
    return out


def _code_parser(language: str):
    import importlib

    from tree_sitter import Language, Parser

    module = importlib.import_module(f"tree_sitter_{language}")
    if language == "typescript":
        return Parser(Language(module.language_typescript()))
    return Parser(Language(module.language()))


# --- the ingestion sequence --------------------------------------------------------------------

def ingest_one(conn, source_path: str, namespace: str = "repo", doc_kind: str | None = None) -> IngestResult:
    """Steps 1-9 of the prompt's sequence, for one document.

    `conn` is the writer connection held by SingleWriter — passed in rather than opened here so
    the caller cannot accidentally run this without holding the lock.
    """
    path = ROOT / source_path
    if not path.is_file():
        return IngestResult(source_path, "failed", detail="file does not exist")

    kind = doc_kind or ("code" if path.suffix.lower() in CODE_SUFFIXES else "markdown")
    text = path.read_text(encoding="utf-8", errors="replace")

    # NUL bytes are stripped, and this is not defensive tidying — PostgreSQL's `text` type CANNOT
    # hold 0x00 and raises `A string literal cannot contain NUL (0x00) characters`. Two real files
    # hit it during the migration, both PDF-extracted primary sources
    # (docs/sources/corpus/15-baldwin-sous-vide/extracted-text-2012-paper-PRIMARY.txt among them),
    # where the extractor left NULs in the output.
    #
    # Stripped BEFORE the hash, so the hash describes what was actually stored. Hashing the raw
    # text and storing the cleaned text would mean the stored content never matches its own
    # recorded hash, and every future run would see a change that is not there.
    if "\x00" in text:
        removed = text.count("\x00")
        text = text.replace("\x00", "")
        log.info("stripped %d NUL byte(s) from %s — PostgreSQL text cannot hold them", removed, source_path)

    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()   # step 5

    with conn.cursor() as cur:
        # step 1-2: the document row, and debounce
        cur.execute(
            """
            INSERT INTO documents (source_path, doc_kind, namespace) VALUES (%s, %s, %s)
            ON CONFLICT (namespace, source_path) DO UPDATE SET doc_kind = EXCLUDED.doc_kind
            RETURNING id
            """,
            (source_path, kind, namespace),
        )
        document_id = cur.fetchone()[0]

        # Debounce (step 2). The window covers pending, running AND succeeded jobs — the first
        # version looked only at in-flight ones, so a second event one second after a SUCCESSFUL
        # ingest sailed straight through and did the whole thing again. A debounce that only
        # suppresses events arriving during work is not a debounce; a file saved three times in a
        # row is exactly the case it exists for.
        #
        # `failed` is deliberately excluded: a failed job must be retryable immediately, and
        # run()'s backoff (2s, 4s) is shorter than this window. Including it would turn the retry
        # loop into a no-op loop that reports success without ever retrying.
        cur.execute(
            "SELECT state::text FROM ingestion_jobs "
            "WHERE document_id = %s AND created_at > now() - %s * interval '1 second' "
            "  AND state IN ('pending', 'running', 'succeeded') "
            "ORDER BY id DESC LIMIT 1",
            (document_id, DEBOUNCE_SECONDS),
        )
        recent = cur.fetchone()
        if recent:
            return IngestResult(
                source_path, "debounced",
                detail=f"a {recent[0]} job for this document is within the {DEBOUNCE_SECONDS}s debounce window",
            )

        # step 6-7: compare against the CURRENT revision
        cur.execute(
            "SELECT id::text, content_hash FROM document_revisions "
            "WHERE document_id = %s AND is_current",
            (document_id,),
        )
        current = cur.fetchone()
        if current and current[1] == content_hash:
            return IngestResult(source_path, "unchanged", revision_id=current[0],
                                detail="content hash matches the current revision")

        # step 3: the lease — but first, deal with any job already holding one.
        #
        # This was missing, and the gap showed up the moment it mattered: a migration run was
        # killed mid-flight, left a `running` job behind, and the next run CRASHED on
        # one_active_job_per_document. The index was right; the worker had no answer for it.
        #
        # An EXPIRED lease means the holder is gone — reclaim it, recording why, so the work is
        # not silently lost. A LIVE lease means someone is genuinely working; report that and
        # move on rather than fighting over it.
        cur.execute(
            "SELECT id, lease_owner, lease_expires_at < now() AS expired FROM ingestion_jobs "
            "WHERE document_id = %s AND state IN ('pending', 'running')",
            (document_id,),
        )
        held = cur.fetchone()
        if held:
            job_id_held, owner, expired = held
            if not expired:
                return IngestResult(
                    source_path, "debounced",
                    detail=f"job {job_id_held} is held by {owner} with a live lease",
                )
            cur.execute(
                "UPDATE ingestion_jobs SET state = 'failed', finished_at = now(), "
                "  last_error = %s, lease_owner = NULL, lease_expires_at = NULL WHERE id = %s",
                (f"lease expired; previous owner {owner} did not finish", job_id_held),
            )
            log.warning("reclaimed expired job %s for %s (was held by %s)", job_id_held, source_path, owner)

        cur.execute(
            """
            INSERT INTO ingestion_jobs
              (document_id, job_type, state, requested_hash, lease_owner, lease_expires_at,
               attempts, idempotency_key)
            VALUES (%s, 'ingest', 'running', %s, %s, now() + %s * interval '1 second', 1, %s)
            -- The idempotency key IS (document, content hash) — "this exact work". Submitting it
            -- again must REUSE the job, which is what idempotent means; the first version tried to
            -- insert a second row and hit the unique index, turning a retry of identical work into
            -- a crash. finished_at is cleared because a row moving back to `running` is no longer
            -- finished, and finished_jobs_have_a_finish_time would refuse the contradiction.
            ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE
              SET state = 'running',
                  attempts = ingestion_jobs.attempts + 1,
                  lease_owner = EXCLUDED.lease_owner,
                  lease_expires_at = EXCLUDED.lease_expires_at,
                  finished_at = NULL,
                  last_error = NULL
            RETURNING id
            """,
            (document_id, content_hash, _lease_owner(), LEASE_SECONDS, f"{document_id}:{content_hash}"),
        )
        job_id = cur.fetchone()[0]

        cur.execute("SELECT COALESCE(MAX(revision_number), 0) + 1 FROM document_revisions WHERE document_id = %s",
                    (document_id,))
        revision_number = cur.fetchone()[0]

    try:
        with conn.cursor() as cur:
            # An INCOMPLETE revision for this exact content may already exist — left by a worker
            # that died mid-flight. (document_id, content_hash) is unique, so inserting a second
            # one fails; the first version did exactly that and reported it as an error requiring
            # manual review, when the correct answer is to finish the work that was started.
            #
            # Safe to adopt precisely because it is NOT current: nothing reads it, and its chunks
            # may be a partial write, so they are discarded and rebuilt rather than trusted.
            cur.execute(
                "SELECT id::text FROM document_revisions "
                "WHERE document_id = %s AND content_hash = %s AND NOT is_current",
                (document_id, content_hash),
            )
            existing = cur.fetchone()
            if existing:
                revision_id = existing[0]
                cur.execute("DELETE FROM document_chunks WHERE revision_id = %s::uuid", (revision_id,))
                cur.execute(
                    "UPDATE document_revisions SET status = 'processing', indexed_at = NULL, "
                    "  graph_projected_at = NULL WHERE id = %s::uuid",
                    (revision_id,),
                )
                log.info("adopted incomplete revision %s for %s (%d partial chunks discarded)",
                         revision_id[:8], source_path, cur.rowcount)
            else:
                # step 8a: the new revision, immutable, marked processing. The old stays current.
                cur.execute(
                    """
                    INSERT INTO document_revisions
                      (document_id, revision_number, content_hash, byte_size, status, source_uri,
                       source_commit, source_authority)
                    VALUES (%s, %s, %s, %s, 'processing', %s, %s, %s)
                    RETURNING id::text
                    """,
                    (document_id, revision_number, content_hash, len(text.encode("utf-8")),
                     source_path, _git_commit(), "code" if kind == "code" else "project_doc"),
                )
                revision_id = cur.fetchone()[0]

        chunks = chunk_document(path, text)                      # step 8b
        vectors = _embed([c["content"] for c in chunks])         # step 8c

        with conn.cursor() as cur:                               # step 8d
            for chunk, vector in zip(chunks, vectors):
                cur.execute(
                    """
                    INSERT INTO document_chunks
                      (revision_id, chunk_index, node_id, content, content_hash, heading_path,
                       start_char, end_char, metadata, embedding, embedded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::vector, now())
                    """,
                    (revision_id, chunk["chunk_index"], chunk["node_id"], chunk["content"],
                     chunk["content_hash"], chunk["heading_path"], chunk["start_char"],
                     chunk["end_char"], _json(chunk["metadata"]), _vector_literal(vector)),
                )
            cur.execute(
                "UPDATE document_revisions SET status = 'indexed', indexed_at = now() WHERE id = %s::uuid",
                (revision_id,),
            )
            cur.execute(
                "INSERT INTO graph_projection_state (revision_id, state, attempts, last_attempt_at) "
                "VALUES (%s::uuid, 'running', 1, now()) "
                "ON CONFLICT (revision_id) DO UPDATE SET state = 'running', "
                "  attempts = graph_projection_state.attempts + 1, last_attempt_at = now()",
                (revision_id,),
            )
        conn.commit()

        # step 8e-8f: extract, VALIDATE, upsert. Nothing reaches Neo4j unvalidated.
        nodes, rels = project_revision(source_path, namespace, document_id, revision_id, chunks)

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE graph_projection_state SET state = 'succeeded', projected_at = now(), "
                "  node_count = %s, relationship_count = %s WHERE revision_id = %s::uuid",
                (nodes, rels, revision_id),
            )
            cur.execute(
                "UPDATE document_revisions SET status = 'graph_projected', graph_projected_at = now() "
                "WHERE id = %s::uuid",
                (revision_id,),
            )
            # step 8g-8h: supersede and activate — the ONLY step that changes what readers see,
            # and it happens last. Deactivate before activate: the partial unique index allows
            # exactly one current revision, so the order is forced, not stylistic.
            if current:
                cur.execute(
                    "UPDATE document_revisions SET is_current = false, status = 'superseded', "
                    "  superseded_by = %s::uuid WHERE id = %s::uuid",
                    (revision_id, current[0]),
                )
            cur.execute("UPDATE document_revisions SET is_current = true WHERE id = %s::uuid", (revision_id,))
            # Any OTHER revision of this document still sitting in a working state is stale the
            # moment a different one becomes current — it describes content that is no longer
            # what the file says, so it can never be resumed. Marked failed with the reason
            # rather than deleted: the prompt forbids silently discarding failed work, and
            # `graph_pending` on a dead revision would read as "retry me" forever.
            cur.execute(
                "UPDATE document_revisions SET status = 'failed' "
                "WHERE document_id = %s AND id <> %s::uuid "
                "  AND status IN ('processing', 'indexed', 'graph_pending')",
                (document_id, revision_id),
            )
            if cur.rowcount:
                log.info("marked %d stale in-flight revision(s) of %s as failed", cur.rowcount, source_path)
            cur.execute("UPDATE documents SET current_revision_id = %s::uuid WHERE id = %s", (revision_id, document_id))
            cur.execute(
                "UPDATE ingestion_jobs SET state = 'succeeded', finished_at = now(), "
                "  revision_id = %s::uuid, lease_owner = NULL, lease_expires_at = NULL WHERE id = %s",
                (revision_id, job_id),
            )
        conn.commit()
        return IngestResult(source_path, "ingested", revision_id, len(chunks), nodes)

    except Exception as exc:                                     # step 9
        conn.rollback()
        detail = f"{type(exc).__name__}: {exc}"
        log.exception("ingestion failed for %s", source_path)
        with conn.cursor() as cur:
            # The previous revision is NOT touched here. It is still current, still serving, and
            # nothing above deactivated it — because deactivation is the last step and we never
            # reached it. "Never leave the old active data incorrectly deactivated" is delivered
            # by the ORDER, not by an undo.
            cur.execute(
                "UPDATE document_revisions SET status = 'graph_pending' "
                "WHERE document_id = %s AND status IN ('processing', 'indexed')",
                (document_id,),
            )
            cur.execute(
                "UPDATE ingestion_jobs SET state = 'failed', finished_at = now(), last_error = %s, "
                "  lease_owner = NULL, lease_expires_at = NULL WHERE id = %s",
                (detail[:2000], job_id),
            )
        conn.commit()
        return IngestResult(source_path, "failed", detail=detail)


@lru_cache(maxsize=1)
def _git_commit() -> str | None:
    """Cached: HEAD does not move during a run, and the migration ingests 843 documents.

    Uncached this was 843 subprocess spawns for one unchanging answer — invisible on a single
    ingest and a measurable share of the migration.
    """
    import subprocess

    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=10
        ).stdout.strip() or None
    except Exception:
        return None


def _json(value: Any) -> str:
    import json

    return json.dumps(value, ensure_ascii=False, default=str)


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


# Batching, and the constants are INHERITED from src/memory/enrich.py rather than rediscovered.
#
# The first version embedded one chunk per HTTP call. app.js alone produces 1,750 code chunks, so
# a smoke test of ten documents ran past ten minutes without finishing — the migration would have
# taken hours for a reason that has nothing to do with the work.
#
# The batch SIZE is a count, not a character budget, and that is also inherited: enrich.py tried a
# character budget and it failed, because Ollama's limit is on TOKENS — 118,000 ASCII characters
# passed while 96,000 Hebrew characters did not. A count with split-on-failure needs no model of
# the tokeniser at all.
EMBED_MAX_CHARS = 5900
EMBED_BATCH_ITEMS = 16


def _embed(texts: list[str]) -> list[list[float]]:
    model = config.embed_model()
    out: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_ITEMS):
        batch = [t[:EMBED_MAX_CHARS] for t in texts[i : i + EMBED_BATCH_ITEMS]]
        out.extend(_embed_batch(model, batch))
    return out


def _embed_batch(model, batch: list[str]) -> list[list[float]]:
    """Embed a batch; on failure split it and retry, down to one item.

    A batch can exceed the server's context for reasons no caller can predict from the text, so
    the recovery is structural rather than predictive: halve and retry. A single item that still
    fails is truncated once and retried, and only then does the failure propagate.
    """
    if not batch:
        return []
    try:
        return model.get_text_embedding_batch(batch)
    except Exception:
        if len(batch) > 1:
            mid = len(batch) // 2
            return _embed_batch(model, batch[:mid]) + _embed_batch(model, batch[mid:])
        log.warning("a single chunk failed to embed at %d chars; retrying truncated", len(batch[0]))
        return [model.get_text_embedding(batch[0][: EMBED_MAX_CHARS // 2])]


# --- graph projection --------------------------------------------------------------------------

def project_revision(
    source_path: str,
    namespace: str,
    document_id: str,
    revision_id: str,
    chunks: list[dict[str, Any]],
) -> tuple[int, int]:
    """Project the document spine into Neo4j with idempotent upserts.

    DETERMINISTIC ONLY, and that is the prompt's own preference order: "Prefer deterministic
    extraction for known project structures." The document/revision/section spine is known
    structure — it is read off rows we already hold. No model is asked to invent an edge here, so
    there is nothing to hallucinate and nothing that needs a confidence score.

    Structured LLM extraction is where the richer relationships (DEPENDS_ON, CITES, CONTRADICTS)
    would come from. It is deliberately NOT implemented in this phase: the validator that would
    police it exists (graph_schema.validate_batch), the provenance fields it must fill exist, and
    turning it on is a separate decision with a privacy dimension the owner has not taken.
    """
    doc_cid = f"{namespace}:{source_path}"
    rev_cid = f"{namespace}:{source_path}#r{revision_id[:8]}"

    writes = [
        GraphWrite("node", "Document", _graph_node(doc_cid, namespace)),
        GraphWrite("node", "DocumentRevision", _graph_node(rev_cid, namespace)),
        GraphWrite("relationship", "HAS_REVISION", {"status": "current"}),
    ]
    section_cids = []
    for chunk in chunks:
        if not chunk["heading_path"]:
            continue
        cid = f"{namespace}:{source_path}#s{chunk['chunk_index']}"
        section_cids.append((cid, chunk))
        writes.append(GraphWrite("node", "Section", _graph_node(cid, namespace)))
        writes.append(GraphWrite("relationship", "HAS_SECTION", {"status": "current"}))

    validate_batch(writes)   # refuses before anything reaches the graph

    driver = config.neo4j_driver()
    try:
        with driver.session() as session:
            session.run(
                """
                MERGE (d:Document {canonical_id: $doc_cid})
                  ON CREATE SET d.created_at = datetime()
                SET d.namespace = $ns, d.status = 'current', d.updated_at = datetime(),
                    d.source_path = $path
                MERGE (r:DocumentRevision {canonical_id: $rev_cid})
                  ON CREATE SET r.created_at = datetime()
                SET r.namespace = $ns, r.status = 'current', r.updated_at = datetime(),
                    r.revision_id = $rev_id, r.document_id = $doc_id
                MERGE (d)-[h:HAS_REVISION]->(r)
                SET h.status = 'current'
                """,
                doc_cid=doc_cid, rev_cid=rev_cid, ns=namespace, path=source_path,
                rev_id=revision_id, doc_id=str(document_id),
            ).consume()

            for cid, chunk in section_cids:
                session.run(
                    """
                    MATCH (r:DocumentRevision {canonical_id: $rev_cid})
                    MERGE (s:Section {canonical_id: $cid})
                      ON CREATE SET s.created_at = datetime()
                    SET s.namespace = $ns, s.status = 'current', s.updated_at = datetime(),
                        s.heading_path = $heading, s.chunk_index = $idx
                    MERGE (r)-[hs:HAS_SECTION]->(s)
                    SET hs.status = 'current'
                    """,
                    rev_cid=rev_cid, cid=cid, ns=namespace,
                    heading=chunk["heading_path"], idx=chunk["chunk_index"],
                ).consume()
    finally:
        driver.close()

    return 2 + len(section_cids), 1 + len(section_cids)


def _graph_node(canonical_id: str, namespace: str) -> dict[str, Any]:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {
        "canonical_id": canonical_id,
        "namespace": namespace,
        "status": "current",
        "created_at": now,
        "updated_at": now,
    }


# --- the run loop -------------------------------------------------------------------------------

def run(paths: Iterable[str], namespace: str = "repo") -> list[IngestResult]:
    """Ingest a batch under the singleton lock, with bounded retries and backoff.

    Bounded, and the bound is checked rather than hoped for: MAX_ATTEMPTS attempts with an
    exponential wait, then the job is left FAILED with its diagnostics. The prompt's "avoid
    infinite loops" is not a style note — an ingestion loop that retries forever on a permanently
    malformed file is a machine that never idles and never says why.
    """
    results: list[IngestResult] = []
    with SingleWriter() as conn:
        for source_path in paths:
            for attempt in range(1, MAX_ATTEMPTS + 1):
                result = ingest_one(conn, source_path, namespace)
                if result.outcome != "failed" or attempt == MAX_ATTEMPTS:
                    if result.outcome == "failed":
                        result.detail += f" (gave up after {MAX_ATTEMPTS} attempts)"
                    results.append(result)
                    break
                wait = BACKOFF_BASE_SECONDS ** attempt
                log.warning("attempt %d/%d failed for %s, retrying in %ds: %s",
                            attempt, MAX_ATTEMPTS, source_path, wait, result.detail)
                time.sleep(wait)
    return results
