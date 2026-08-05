-- Runs ONCE, by the postgres image's entrypoint, only against an EMPTY data directory.
-- It never executes again on a volume that already holds data, so it cannot damage anything
-- on restart.

-- pgvector. This is the whole reason for the pgvector/pgvector image rather than stock postgres.
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto: gen_random_uuid() for stable identifiers. Available in core since PG13 but the
-- extension is what exposes the rest of the family, and we want it present before migrations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- The application role. The ingestion worker and the retrieval layer connect as this, NEVER as
-- the superuser — a compromised retrieval tool must not be able to DROP anything.
-- The password arrives from the environment via 02-*.sh; this file only shapes privileges.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mk_app') THEN
        CREATE ROLE mk_app LOGIN;
    END IF;
END
$$;

-- Own the schema so migrations can create tables, but nothing above it.
GRANT CONNECT ON DATABASE mk_knowledge TO mk_app;
GRANT USAGE, CREATE ON SCHEMA public TO mk_app;

-- A separate READ-ONLY role. Retrieval tools used by subagents connect as this one, so a bug or
-- a prompt injection in a retrieval path has no write verb available to it at all.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mk_reader') THEN
        CREATE ROLE mk_reader LOGIN;
    END IF;
END
$$;

GRANT CONNECT ON DATABASE mk_knowledge TO mk_reader;
GRANT USAGE ON SCHEMA public TO mk_reader;
-- Applies to tables that do not exist yet — the migrations create them later.
ALTER DEFAULT PRIVILEGES FOR ROLE mk_app IN SCHEMA public
    GRANT SELECT ON TABLES TO mk_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE mk_app IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO mk_reader;
