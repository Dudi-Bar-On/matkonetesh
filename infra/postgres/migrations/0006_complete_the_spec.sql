-- 0006 — the fields Phase 3 requires that migrations 0001-0003 did not have.
--
-- WHY THEY WERE MISSING, since that matters more than the columns.
--
-- 0001-0003 were written from a SUMMARY of the owner's prompt rather than from the prompt. The
-- summary carried the five table names and the both-sides-before-current rule, and dropped the
-- field lists under each one. Every gap below was written down in the prompt, in a numbered list,
-- and none of it was disputed or hard — it simply was not read at the moment it was needed.
--
-- §4 of the discipline calls this by its name: a plan may not narrow a requirement from an
-- approved spec. Narrowing by forgetting is still narrowing, and it is harder to notice than
-- narrowing on purpose, because there is no decision anywhere to point at.
--
-- The prompt is now saved at docs/infra/owner-prompt-2026-08-05-knowledge-stack.md so later
-- phases are checked against the text.

-- ---------------------------------------------------------------------------------------------
-- Explicit statuses. The prompt: "Use explicit statuses. At minimum, distinguish: queued,
-- processing, indexed, graph_pending, graph_projected, failed, superseded, archived."
--
-- All eight in one type, because they are one lifecycle: a revision moves along it, and splitting
-- them across two enums would let a revision hold a state its own vocabulary cannot express.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE revision_status AS ENUM (
  'queued',          -- accepted, not yet worked
  'processing',      -- a worker holds it
  'indexed',         -- chunks + embeddings committed to PostgreSQL
  'graph_pending',   -- indexed; graph projection not yet done or being retried
  'graph_projected', -- both sides done — the only status from which it may become current
  'failed',          -- gave up; last_error says why
  'superseded',      -- a newer revision took over; superseded_by points at it
  'archived'         -- deliberately retired, kept for history
);

-- ---------------------------------------------------------------------------------------------
-- documents — namespace, and a real pointer to the current revision.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN namespace text NOT NULL DEFAULT 'repo',
  ADD COLUMN current_revision_id uuid;   -- FK added after document_revisions is extended

COMMENT ON COLUMN documents.namespace IS
  'Which corpus this belongs to — repo, vendor-docs, primary-sources. The prompt requires it on every node and every document; it is the axis MetadataFilters filters on first.';

-- source_path is unique globally today. It becomes unique PER NAMESPACE, so the same relative
-- path can exist in two corpora without one silently overwriting the other.
ALTER TABLE documents DROP CONSTRAINT documents_source_path_key;
ALTER TABLE documents ADD CONSTRAINT documents_namespace_source_path_key UNIQUE (namespace, source_path);

-- ---------------------------------------------------------------------------------------------
-- document_revisions — status, provenance, supersession, source authority.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE source_authority AS ENUM (
  'primary_source',  -- USDA/FSIS, Baldwin, 9 CFR — a citable authority
  'vendor_doc',      -- a vendor's own documentation
  'project_doc',     -- something this project wrote about itself
  'code',            -- source code
  'generated'        -- produced by a model; never citable on its own
);

ALTER TABLE document_revisions
  ADD COLUMN status            revision_status  NOT NULL DEFAULT 'queued',
  ADD COLUMN source_commit     text,
  ADD COLUMN source_uri        text,
  ADD COLUMN superseded_by     uuid REFERENCES document_revisions (id) ON DELETE SET NULL,
  ADD COLUMN provenance        jsonb            NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN source_authority  source_authority NOT NULL DEFAULT 'project_doc';

COMMENT ON COLUMN document_revisions.source_uri IS
  'The path/URI AS IT WAS AT INGESTION. documents.source_path is the current name; a file that moved would otherwise rewrite the history of where its old revisions came from.';
COMMENT ON COLUMN document_revisions.source_authority IS
  'A generated revision must never be citable as a primary source. Kept as a column rather than inferred from a path, because paths get reorganised and citations must not change meaning when they do.';

-- A revision may only be current from the one status that means BOTH sides finished. This
-- STRENGTHENS 0001's constraint: previously the two timestamps could be set while the status said
-- something else, and the row would have disagreed with itself.
ALTER TABLE document_revisions
  ADD CONSTRAINT current_only_when_graph_projected CHECK (
    NOT is_current OR status = 'graph_projected'
  );

ALTER TABLE document_revisions
  ADD CONSTRAINT superseded_revisions_point_somewhere CHECK (
    status <> 'superseded' OR superseded_by IS NOT NULL
  );

ALTER TABLE document_revisions
  ADD CONSTRAINT a_revision_cannot_supersede_itself CHECK (superseded_by IS DISTINCT FROM id);

CREATE INDEX document_revisions_status_idx ON document_revisions (status);

ALTER TABLE documents
  ADD CONSTRAINT documents_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES document_revisions (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------------------------
-- document_chunks — content hash, and enough location to cite from.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE document_chunks
  ADD COLUMN content_hash text,
  ADD COLUMN start_char   integer CHECK (start_char IS NULL OR start_char >= 0),
  ADD COLUMN end_char     integer CHECK (end_char   IS NULL OR end_char   >= 0),
  ADD CONSTRAINT chunk_span_is_ordered CHECK (
    start_char IS NULL OR end_char IS NULL OR end_char >= start_char
  );

CREATE INDEX document_chunks_content_hash_idx ON document_chunks (content_hash);

COMMENT ON COLUMN document_chunks.content_hash IS
  'Lets a re-parse skip chunks whose text did not change, and lets an identical chunk be recognised across revisions. The prompt: "Use content hashes and unique constraints to make reprocessing idempotent."';

-- ---------------------------------------------------------------------------------------------
-- ingestion_jobs — job type, the hash requested, a lease, and an idempotency key.
--
-- The lease is what makes single-writer survive a crash. A worker that dies holding `running`
-- leaves a row nobody can claim; with lease_expires_at, the row becomes claimable again on its
-- own, without a human deciding whether the previous worker is really gone.
-- ---------------------------------------------------------------------------------------------
CREATE TYPE job_type AS ENUM ('ingest', 'reembed', 'reproject', 'delete');

ALTER TABLE ingestion_jobs
  ADD COLUMN job_type         job_type    NOT NULL DEFAULT 'ingest',
  ADD COLUMN requested_hash   text,
  ADD COLUMN idempotency_key  text,
  ADD COLUMN lease_owner      text,
  ADD COLUMN lease_expires_at timestamptz;

-- The idempotency key is what makes "submit the same work twice" a no-op rather than a duplicate.
CREATE UNIQUE INDEX ingestion_jobs_idempotency_key_idx
  ON ingestion_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE ingestion_jobs
  ADD CONSTRAINT a_running_job_holds_a_lease CHECK (
    state <> 'running' OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  );

-- ---------------------------------------------------------------------------------------------
-- graph_projection_state — when it was last attempted, and against which schema version.
--
-- projection_schema_version is the field that makes a future allowlist change tractable: when the
-- label set changes, every row projected under the old version is identifiable, and can be
-- re-projected without re-ingesting anything.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE graph_projection_state
  ADD COLUMN last_attempt_at           timestamptz,
  ADD COLUMN attempts                  integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN projection_schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN graph_reference           jsonb   NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX graph_projection_state_state_idx ON graph_projection_state (state);
