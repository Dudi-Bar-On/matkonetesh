-- infra/rules-db/migrations/0001_rule_revisions.sql
-- The mk_rules knowledge layer — spec §4.3 (docs/superpowers/specs/2026-08-06-process-enforcement-design.md).
--
-- THE LOAD-BEARING CONSTRAINT IS `current_requires_mirror`, the exact analogue of the geniza's
-- `current_requires_both_sides` (infra/postgres/migrations/0001_documents_and_revisions.sql): a rule
-- revision cannot be marked current here — not by the builder, not by a migration, not by a person
-- with psql at 2am — unless it has already reached rules.sqlite. The database refuses the illegal
-- state rather than trusting a caller to remember the rule.

CREATE EXTENSION IF NOT EXISTS vector;
-- Provisioned per the plan's Global Constraints (pgvector 0.8.6) for future semantic rule search.
-- No table below uses it yet — Phase 1 is lexical (rule_id, content_hash), not embedded.

CREATE TABLE rule_revisions (
  revision_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          text        NOT NULL,          -- '10.17' · 'DoD-11' · 'H8' · 'L61' — stable, human, already in the doc
  section          text,
  title_he         text,
  statement        text        NOT NULL,          -- the quote from the document, never a paraphrase
  bucket           text        CHECK (bucket IN ('A', 'B', 'C')),
  severity         text        CHECK (severity IN ('warn', 'block')),
  mechanism        text,
  source_path      text        NOT NULL,
  source_heading   text,
  source_hash      text        NOT NULL,
  revision_status  text        NOT NULL CHECK (revision_status IN ('current', 'superseded', 'retired')),
  is_current       boolean     NOT NULL DEFAULT false,
  mirrored_at      timestamptz,
  retired_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT current_requires_mirror CHECK (
    NOT is_current OR mirrored_at IS NOT NULL
  ),
  -- A retired revision is never current, and a current revision is never retired — the two states
  -- are mutually exclusive by definition, not just by convention.
  CONSTRAINT retired_is_never_current CHECK (
    revision_status != 'retired' OR NOT is_current
  )
);

COMMENT ON CONSTRAINT current_requires_mirror ON rule_revisions IS
  'A rule is not "in force" until it has reached rules.sqlite. Enforced here so no code path can skip it — spec §4.3.';

-- At most one current revision per rule_id — the same pattern as the geniza's
-- one_current_revision_per_document, and for the same reason: declarative, cannot be bypassed by a
-- direct UPDATE, costs nothing to maintain.
CREATE UNIQUE INDEX one_current_revision_per_rule
  ON rule_revisions (rule_id)
  WHERE is_current;

CREATE INDEX rule_revisions_rule_id_idx ON rule_revisions (rule_id);
CREATE INDEX rule_revisions_status_idx ON rule_revisions (revision_status);

CREATE TABLE rule_probes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     text NOT NULL,
  probe_kind  text NOT NULL,
  pattern     text NOT NULL,
  applies_to  text
);

CREATE INDEX rule_probes_rule_id_idx ON rule_probes (rule_id);

-- Least privilege, applied to the tables just created — the same division as the geniza's
-- infra/postgres/migrations/0004_grants.sql: rules_app (the future builder, Task 3+) reads and
-- writes; rules_reader (the three enforcement gates and any deep-audit agent) reads only. Neither
-- role may CREATE — the schema is owned by the superuser and changed only by a migration.

GRANT USAGE ON SCHEMA public TO rules_app, rules_reader;

GRANT SELECT, INSERT, UPDATE, DELETE ON rule_revisions, rule_probes TO rules_app;

GRANT SELECT ON rule_revisions, rule_probes TO rules_reader;

-- Explicitly NOT granted, named so the omission reads as a decision rather than an oversight:
--   * no CREATE on schema public for either role
--   * no INSERT/UPDATE/DELETE for rules_reader on anything
--   * no access to schema_migrations for either role — migration history is the superuser's
REVOKE ALL ON schema_migrations FROM rules_app, rules_reader;
