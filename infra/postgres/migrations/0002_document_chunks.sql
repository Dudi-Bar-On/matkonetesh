-- 0002 — the chunks, and their embeddings.
--
-- One row per LlamaIndex TextNode. The node_id is kept so a chunk can be matched back to what the
-- parser produced, rather than re-derived from position — which is what makes a re-parse
-- comparable to the previous one instead of merely equal in count.
--
-- DIMENSION 1024, and it was MEASURED, not read off a model card: an embed call to the local
-- bge-m3 returned a 1024-element vector (2026-08-05). A wrong dimension here does not fail at
-- write time in an obvious way; it fails when a query returns nothing and everyone blames the
-- query.

CREATE TABLE document_chunks (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id   uuid    NOT NULL REFERENCES document_revisions (id) ON DELETE CASCADE,
  chunk_index   integer NOT NULL CHECK (chunk_index >= 0),
  node_id       text    NOT NULL,
  content       text    NOT NULL,
  heading_path  text,
  metadata      jsonb   NOT NULL DEFAULT '{}'::jsonb,
  embedding     vector(1024),
  embedded_at   timestamptz,

  UNIQUE (revision_id, chunk_index),
  UNIQUE (revision_id, node_id),

  -- An embedding and the time it was produced travel together or not at all. Half of the pair is
  -- how you get a vector nobody can date, which is unusable for deciding what needs re-embedding.
  CONSTRAINT embedding_and_timestamp_together CHECK (
    (embedding IS NULL) = (embedded_at IS NULL)
  )
);

CREATE INDEX document_chunks_revision_idx ON document_chunks (revision_id);

-- HNSW with cosine distance: bge-m3's vectors are normalised, and cosine is what the SQLite side
-- already ranks by, so the two stores agree on what "closest" means during the migration.
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- jsonb_path_ops rather than the default: smaller, and faster for the containment queries
-- (`metadata @> '{...}'`) that MetadataFilters compiles to. It cannot serve key-existence
-- queries (`?`), which we do not issue.
CREATE INDEX document_chunks_metadata_idx
  ON document_chunks USING gin (metadata jsonb_path_ops);

-- Full-text over the chunk body. `simple` rather than `english`: the corpus is Hebrew-first, and
-- an English stemmer would mangle exactly the English identifiers we search for inside Hebrew
-- documents — the same reasoning that chose FTS5's trigram tokeniser on the SQLite side.
CREATE INDEX document_chunks_content_fts_idx
  ON document_chunks USING gin (to_tsvector('simple', content));

COMMENT ON COLUMN document_chunks.node_id IS 'LlamaIndex TextNode.id_ — lets a re-parse be compared to the previous one rather than merely counted against it.';
COMMENT ON COLUMN document_chunks.embedding IS 'bge-m3, 1024 dimensions, measured 2026-08-05. Produced locally on the RTX 3090 — no document text leaves this machine.';
