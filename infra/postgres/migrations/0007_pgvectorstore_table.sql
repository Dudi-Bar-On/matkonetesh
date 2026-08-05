-- 0007 — the table LlamaIndex's PGVectorStore expects, created by migration.
--
-- OWNER DECISION, 2026-08-05. Phase 5 installed and import-tested the pgvector integration and
-- then did not use it, because PGVectorStore keeps its own table and a second copy of every
-- embedding can drift from the authoritative one. The owner has directed that it be wired up.
--
-- The objection was about DIVERGENCE, not about the table existing — so this is built such that
-- divergence is impossible rather than unlikely:
--
--   * document_chunks stays AUTHORITATIVE. It has the FK to a revision, is_current,
--     graph_projected_at and source_authority. Nothing here changes that.
--   * data_chunk_vectors is a PROJECTION of it, written by the worker in the SAME TRANSACTION as
--     the chunk row. There is no window in which one exists without the other.
--   * `revision_id` is carried in metadata_ so a vector hit can be resolved back to the
--     authoritative row, and so a retrieval path can still exclude superseded revisions.
--   * An acceptance test asserts the two agree — count and node_id set — so a future change that
--     lets them drift fails a test instead of quietly serving stale text.
--
-- The DDL below was read from the library (sqlalchemy CreateTable on PGVectorStore's own table
-- class), not transcribed from an error message. `id` is BIGSERIAL rather than the library's
-- BIGINT because the library relies on SQLAlchemy's autoincrement, which only materialises when
-- IT creates the table; we insert directly, so the sequence has to be real.
--
-- Created HERE and not by the library because mk_app has no CREATE on schema public (0005), and
-- that is deliberate: the schema is owned by migrations.

CREATE TABLE data_chunk_vectors (
  id              BIGSERIAL   NOT NULL,
  text            VARCHAR     NOT NULL,
  metadata_       JSON,
  node_id         VARCHAR,
  embedding       VECTOR(1024),
  text_search_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,

  -- NOT part of PGVectorStore's own schema, and load-bearing anyway. Without it, deleting a
  -- document leaves orphan vectors behind: document_chunks cascades from document_revisions, this
  -- table would not, and the projection would slowly fill with rows whose source is gone —
  -- searchable text from documents that no longer exist. An extra column is invisible to
  -- PGVectorStore, which selects the columns it knows about.
  revision_id     UUID        REFERENCES document_revisions (id) ON DELETE CASCADE,

  PRIMARY KEY (id)
);

-- Both indexes are the library's own, by name, so its queries plan the way it expects.
CREATE INDEX chunk_vectors_idx_1 ON data_chunk_vectors ((metadata_ ->> 'ref_doc_id'));
CREATE INDEX chunk_vectors_idx   ON data_chunk_vectors USING gin (text_search_tsv);

-- Ours: node_id is how a projection row is matched to its authoritative chunk, and the vector
-- index is what makes it a vector store rather than a list.
CREATE UNIQUE INDEX data_chunk_vectors_node_id_key ON data_chunk_vectors (node_id);
CREATE INDEX data_chunk_vectors_embedding_idx
  ON data_chunk_vectors USING hnsw (embedding vector_cosine_ops);
CREATE INDEX data_chunk_vectors_revision_idx ON data_chunk_vectors (revision_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON data_chunk_vectors TO mk_app;
GRANT USAGE, SELECT ON SEQUENCE data_chunk_vectors_id_seq TO mk_app;
GRANT SELECT ON data_chunk_vectors TO mk_reader;

COMMENT ON TABLE data_chunk_vectors IS
  'LlamaIndex PGVectorStore projection of document_chunks. NOT authoritative — document_chunks is. Written in the same transaction as the chunk it mirrors; tests/test_acceptance.py asserts the two agree.';
