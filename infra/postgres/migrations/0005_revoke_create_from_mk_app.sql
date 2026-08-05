-- 0005 — take CREATE away from mk_app.
--
-- CORRECTS 0004, WHICH CLAIMED SOMETHING FALSE. Its comment says "Neither may CREATE. The schema
-- is owned by the superuser and changed only by a migration." That was the intent and it was not
-- the state: 01-extensions-and-role.sql line 25 had already granted
--
--     GRANT USAGE, CREATE ON SCHEMA public TO mk_app;
--
-- under the comment "Own the schema so migrations can create tables" — written before the
-- decision that migrations run as the SUPERUSER. Once pgmigrate.py connected as the superuser,
-- that grant stopped being needed and became purely a privilege nobody had a use for.
--
-- Found by a test that tried to break the rule rather than assert it: mk_app was asked to CREATE
-- TABLE and succeeded. A test that had merely queried the grants would have reported whatever was
-- there and called it correct.
--
-- 0004 IS DELIBERATELY NOT EDITED. It has been applied, and pgmigrate.py refuses an applied
-- migration whose content changed — that refusal is the whole point of the checksum. An applied
-- migration is history; history gets corrected by a later entry, not by rewriting the earlier one.
-- 0004's comment is therefore left standing as a record of an intention that this file delivers.

REVOKE CREATE ON SCHEMA public FROM mk_app;

-- mk_reader never had it. Stated rather than assumed, so a future reader does not have to check.
REVOKE CREATE ON SCHEMA public FROM mk_reader;

DO $$
BEGIN
  IF has_schema_privilege('mk_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'mk_app still holds CREATE on schema public after the revoke';
  END IF;
  IF NOT has_schema_privilege('mk_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'the revoke removed USAGE from mk_app — it needs USAGE to read the tables it writes';
  END IF;
END
$$;
