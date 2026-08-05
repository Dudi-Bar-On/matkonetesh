-- 0003 — the ingestion queue, and the graph projection's state.
--
-- SINGLE WRITER (owner prompt). The worker takes a PostgreSQL advisory lock; these tables record
-- what it did. The partial unique index below is the belt to that braces: even if a second worker
-- somehow started, it could not create a second active job for the same document.
--
-- Enums rather than text-with-a-CHECK: a typo in a state name becomes an error at write time
-- instead of a row that silently matches no filter. `stuck in a state nobody queries` is a real
-- failure mode and it is invisible.

CREATE TYPE job_state AS ENUM ('pending', 'running', 'succeeded', 'failed');

CREATE TABLE ingestion_jobs (
  id           bigserial   PRIMARY KEY,
  document_id  uuid        NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  revision_id  uuid        REFERENCES document_revisions (id) ON DELETE CASCADE,
  state        job_state   NOT NULL DEFAULT 'pending',
  attempts     integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,

  -- A finished job has a finish time and vice versa. Without this, a crash mid-write leaves a row
  -- that reads as succeeded and as never-run at the same time.
  CONSTRAINT finished_jobs_have_a_finish_time CHECK (
    (state IN ('succeeded', 'failed')) = (finished_at IS NOT NULL)
  ),
  CONSTRAINT failed_jobs_say_why CHECK (
    state <> 'failed' OR last_error IS NOT NULL
  )
);

CREATE UNIQUE INDEX one_active_job_per_document
  ON ingestion_jobs (document_id)
  WHERE state IN ('pending', 'running');

CREATE INDEX ingestion_jobs_state_idx ON ingestion_jobs (state, created_at);

COMMENT ON CONSTRAINT failed_jobs_say_why ON ingestion_jobs IS
  'A failure with no reason is the shape this project keeps paying for: not an error, an empty answer that looks like a real one.';

CREATE TYPE projection_state AS ENUM ('pending', 'running', 'succeeded', 'failed');

CREATE TABLE graph_projection_state (
  revision_id        uuid             PRIMARY KEY REFERENCES document_revisions (id) ON DELETE CASCADE,
  state              projection_state NOT NULL DEFAULT 'pending',
  node_count         integer          CHECK (node_count IS NULL OR node_count >= 0),
  relationship_count integer          CHECK (relationship_count IS NULL OR relationship_count >= 0),
  projected_at       timestamptz,
  last_error         text,
  updated_at         timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT succeeded_projections_are_counted CHECK (
    state <> 'succeeded' OR (projected_at IS NOT NULL AND node_count IS NOT NULL)
  ),
  CONSTRAINT failed_projections_say_why CHECK (
    state <> 'failed' OR last_error IS NOT NULL
  )
);

CREATE TRIGGER graph_projection_state_set_updated_at
  BEFORE UPDATE ON graph_projection_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE graph_projection_state IS
  'Neo4j is a projection and never the source of truth. This table is where PostgreSQL records what it believes the graph currently reflects — so a graph that is behind, or wrong, is a visible state rather than a discovery.';
