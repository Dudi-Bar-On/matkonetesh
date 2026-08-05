-- 0001 — documents and their revisions.
--
-- PostgreSQL is the SOURCE OF TRUTH (owner prompt, 2026-08-05). Neo4j is a projection of what
-- these tables already hold, and is never authoritative for anything.
--
-- THE LOAD-BEARING CONSTRAINT IS `current_requires_both_sides`.
--
-- The prompt says: "Do not mark a document revision current until both PostgreSQL indexing and
-- Neo4j graph projection succeed." That could have been a rule in the worker. It is a CHECK
-- constraint instead, because a rule in the worker is obeyed by the code paths that remember it,
-- and this project's whole gap register is a record of code paths that did not. A revision cannot
-- be marked current here — by the worker, by a migration, by a person with psql at 2am — unless
-- both timestamps are set. The database refuses.

CREATE TABLE documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path  text        NOT NULL UNIQUE,
  doc_kind     text        NOT NULL CHECK (doc_kind IN ('markdown', 'code', 'tool_spec')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  documents IS 'One row per ingested source file. source_path is repo-relative and unique.';
COMMENT ON COLUMN documents.doc_kind IS 'Which parser produced the chunks: MarkdownNodeParser, CodeSplitter, or a vendor tool_spec.';

CREATE TABLE document_revisions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid        NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  revision_number    integer     NOT NULL CHECK (revision_number > 0),
  content_hash       text        NOT NULL,
  byte_size          integer     NOT NULL CHECK (byte_size >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- The two sides that must BOTH succeed. Null means "not done", never "assumed fine".
  indexed_at         timestamptz,
  graph_projected_at timestamptz,

  is_current         boolean     NOT NULL DEFAULT false,

  UNIQUE (document_id, revision_number),
  UNIQUE (document_id, content_hash),

  CONSTRAINT current_requires_both_sides CHECK (
    NOT is_current OR (indexed_at IS NOT NULL AND graph_projected_at IS NOT NULL)
  )
);

-- At most one current revision per document. A partial unique index rather than a trigger: it is
-- declarative, it cannot be bypassed by a direct UPDATE, and it costs nothing to maintain.
CREATE UNIQUE INDEX one_current_revision_per_document
  ON document_revisions (document_id)
  WHERE is_current;

CREATE INDEX document_revisions_document_idx ON document_revisions (document_id);

COMMENT ON CONSTRAINT current_requires_both_sides ON document_revisions IS
  'Owner prompt 2026-08-05: a revision is not current until BOTH PostgreSQL indexing and Neo4j projection have succeeded. Enforced here rather than in the worker so no code path can skip it.';

-- updated_at maintained by the database, so a writer that forgets it cannot make the column lie.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
