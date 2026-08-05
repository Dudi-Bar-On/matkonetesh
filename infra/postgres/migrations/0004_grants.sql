-- 0004 — least privilege, applied to the tables that now exist.
--
-- The roles were created in 01-extensions-and-role.sql with default privileges, which cover
-- objects created LATER BY THE SAME ROLE. These grants are explicit anyway, for one reason: a
-- default privilege that silently fails to apply looks exactly like one that applied. The
-- acceptance test reads the privileges back rather than trusting either.
--
-- mk_app    — the ingestion worker. Reads and writes data. Cannot change the schema.
-- mk_reader — retrieval for agents. Reads. Nothing else.
--
-- Neither may CREATE. The schema is owned by the superuser and changed only by a migration, which
-- is what makes "the schema is what the migrations say" a fact rather than a hope.

GRANT USAGE ON SCHEMA public TO mk_app, mk_reader;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  documents, document_revisions, document_chunks, ingestion_jobs, graph_projection_state
TO mk_app;

GRANT USAGE, SELECT ON SEQUENCE ingestion_jobs_id_seq TO mk_app;

GRANT SELECT ON
  documents, document_revisions, document_chunks, ingestion_jobs, graph_projection_state
TO mk_reader;

-- Explicitly NOT granted, and named so the omission reads as a decision rather than an oversight:
--   * no CREATE on schema public for either role
--   * no INSERT/UPDATE/DELETE for mk_reader on anything
--   * no access to schema_migrations for either role — migration history is the superuser's
REVOKE ALL ON schema_migrations FROM mk_app, mk_reader;
