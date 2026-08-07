-- infra/rules-db/migrations/0005_rule_group.sql
--
-- Adds `rule_group` — the enforcement-MECHANISM axis the spec defines in §5-§7
-- (docs/superpowers/specs/2026-08-06-process-enforcement-design.md) and that 0004's own comment
-- explicitly deferred: "If the enforcement-mechanism axis (A/B/C) is needed later, it gets its OWN
-- column — reusing `bucket` for it was the original mistake this migration undoes."
--
-- This is that column. It is a DIFFERENT axis from `bucket` (process/content, spec §1) — 0004
-- fixed `bucket`'s CHECK back to ('process','content') precisely so it would stop colliding with
-- these letters. `bucket` is UNCHANGED by this migration.
--
-- R-103 (docs/ROADMAP-2026-07-30.md) is the reason this migration does not stop at DDL:
-- `bucket` sat in the schema for TEN TASKS with sync_rule's INSERT silently omitting it from the
-- column list — 132 of 132 rows NULL in mk_rules (the source of truth) while the mirror held the
-- real value, and the mirror-checksum gate could not see the drift because its digest did not
-- cover `bucket` either. "A column nobody writes to is the disease R-103 documents." So the same
-- commit that adds this column also (a) writes it in sync_rule's INSERT
-- (src/rules_store/builder.py), (b) carries it into the mirror (src/rules_store/mirror.py's
-- _COLUMNS / write_revision / rebuild_mirror_from_postgres), and (c) folds it into
-- mirror.checksum_of_rows() / checksum() so check-rules-mirror.mjs's digest — which
-- check-rules-mirror.mjs's own Postgres-side query and mirror.py's SQLite-side query both call
-- through the SAME function — would catch a drift in it exactly as it now catches one in `bucket`.
--
-- Allows NULL deliberately: a rule nobody has classified yet must be visibly unclassified (NULL),
-- never silently defaulted into a group by the column's own DDL. This migration classifies all
-- 134 currently-current rules in the same commit (a data UPDATE, run by the same task, not by this
-- file — DDL and a one-time backfill are different failure modes and are kept in different
-- statements so a future migration replay of this file alone is idempotent DDL only).

ALTER TABLE rule_revisions ADD COLUMN rule_group text;

ALTER TABLE rule_revisions ADD CONSTRAINT rule_revisions_rule_group_check
  CHECK (rule_group IN ('A', 'B', 'C', 'none'));

COMMENT ON COLUMN rule_revisions.rule_group IS
  'The enforcement-mechanism axis (spec §5-§7, opened early 2026-08-07 per owner approval, '
  'R-103): ''A'' = decidable from a single tool call alone, deterministic hook, no model. '
  '''B'' = needs state or a counter carried across actions/time. ''C'' = needs judgement over '
  'produced content (an LLM judge). ''none'' = not mechanizable at all — informs, cannot be '
  'checked. NULL = not yet classified. Not the same axis as `bucket` (process/content, spec §1, '
  '0004) — do not conflate them again; that conflation is exactly what 0004 undid.';
