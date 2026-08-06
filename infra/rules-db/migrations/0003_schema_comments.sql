-- infra/rules-db/migrations/0003_schema_comments.sql
--
-- CORRECTING THE RECORD, IN A NEW FILE, NOT IN 0002.
--
-- 0002_roles_and_grants.sql's header comment cites the geniza's own
-- 0005_revoke_create_from_mk_app.sql as precedent for restating GRANT statements in that file.
-- Measured: 0005 contains zero GRANT lines and two REVOKE lines. It is lean on purpose — REVOKE
-- and its verifying block only — and its own design note explains why the earlier grants
-- migration is left alone rather than edited. That is a precedent for putting NEW content in a
-- separate file. It is not a precedent for repeating grants that already applied, which is what
-- 0002's comment claimed it was.
--
-- 0002 is left EXACTLY as applied, unedited, because it is history: the project's own doctrine
-- (the geniza's 0005) says history is corrected by a later entry, not by rewriting the earlier
-- one, and pgmigrate.py enforces the same rule mechanically — it refuses to run with an applied
-- migration whose on-disk content has changed, comment-only or not (proven in fix round 1: even a
-- comment-only edit to 0002 was reported as drift and reverted rather than forced).
--
-- The restated GRANT lines in 0002 are harmless and can be read past without concern: PostgreSQL's
-- GRANT is idempotent (granting a privilege a role already holds is a no-op, not an error), and
-- 0001_rule_revisions.sql remains the source of truth for what rules_app/rules_reader may do —
-- 0002 does not re-decide those grants, it repeats them. 0002's own load-bearing, genuinely new
-- content is its REVOKE CREATE statements and the DO $$ block that verifies they held.
--
-- THIS FILE'S OWN CONTENT is real DDL, not prose masquerading as one: COMMENT ON statements that
-- land inside the database itself, where `\d+ rule_revisions` (or any tool that reads
-- pg_description) shows them to a reader who never opened this repository.

COMMENT ON TABLE rule_revisions IS
  'One row per revision of one process-discipline rule (spec §4.3). The AUTHORITY for what a rule '
  'says is the discipline document it was extracted from (docs/process/development-discipline.md '
  'and the other governing docs) — this table is a queryable mirror of that text, not a second '
  'source of truth. A rule that exists here and not in the document is a bug, not a rule.';

COMMENT ON CONSTRAINT current_requires_mirror ON rule_revisions IS
  'A rule revision may not be marked is_current until it has reached rules.sqlite (mirrored_at is '
  'set). Enforced here so it is impossible for PostgreSQL to know a rule the enforcement hooks '
  '(which read the SQLite mirror, not this table) do not yet know about.';

COMMENT ON COLUMN rule_revisions.revision_status IS
  '''current'' is the one revision per rule_id presently in force (see '
  'one_current_revision_per_rule). ''superseded'' is a prior revision replaced by a newer one — '
  'still readable, no longer authoritative. ''retired'' is a rule removed from the governing '
  'document: retired rather than deleted, so it stays citable for history even though it no '
  'longer applies (see retired_is_never_current).';

COMMENT ON TABLE rule_probes IS
  'Machine-checkable probes for rules in rule_revisions — pattern + probe_kind + applies_to. '
  'Created empty on purpose: this table is populated in a later phase of the plan '
  '(2026-08-06-rules-store-and-watchman), not by this migration.';
