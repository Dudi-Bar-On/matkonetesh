-- infra/rules-db/migrations/0002_roles_and_grants.sql
-- rules_app    — the builder. Reads and writes rule_revisions/rule_probes. Cannot change the schema.
-- rules_reader — the three gates and any deep-audit agent. Reads. Nothing else.
--
-- 0001 already GRANTed SELECT/INSERT/UPDATE/DELETE to these roles on these tables; the GRANTs here
-- are idempotent restatements (PostgreSQL GRANT is safe to repeat) kept for the same reason the
-- geniza keeps 0005_revoke_create_from_mk_app.sql separate from its original grants migration: the
-- REVOKE below is the new, load-bearing content of this file, and it is verified rather than
-- assumed — a DEFAULT for a non-owner role happens to already exclude CREATE, but "happens to"
-- is not the same guarantee as an explicit REVOKE plus an assertion that it held.
GRANT USAGE ON SCHEMA public TO rules_app, rules_reader;

GRANT SELECT, INSERT, UPDATE, DELETE ON rule_revisions, rule_probes TO rules_app;
GRANT SELECT ON rule_revisions, rule_probes TO rules_reader;

REVOKE CREATE ON SCHEMA public FROM rules_app;
REVOKE CREATE ON SCHEMA public FROM rules_reader;

DO $$
BEGIN
  IF has_schema_privilege('rules_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'rules_app still holds CREATE on schema public after the revoke';
  END IF;
  IF NOT has_schema_privilege('rules_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'the revoke removed USAGE from rules_app — it needs USAGE to read the tables it writes';
  END IF;
END $$;
