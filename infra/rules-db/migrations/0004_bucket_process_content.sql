-- infra/rules-db/migrations/0004_bucket_process_content.sql
--
-- Fix round 2, 2026-08-06 — Task 13 review. `bucket` was never written by sync_rule's Postgres
-- INSERT at all (the column was simply absent from the column list), so every current row's
-- `bucket` was NULL in mk_rules regardless of what the mirror held. That defect is fixed in
-- src/rules_store/builder.py, in the same commit as this migration. Tracing WHY it was never
-- caught surfaced a second, deeper problem this migration exists to fix:
--
-- The CHECK this migration replaces — `bucket IN ('A', 'B', 'C')` — was carried verbatim from
-- the spec's §4.3 schema block (docs/superpowers/specs/2026-08-06-process-enforcement-design.md).
-- But that same spec's §1, in prose, states the OWNER'S OWN REQUIREMENT for this column:
-- "DoD-10 נשמר עם bucket = 'content'" — and src/rules_store/extractor.py's `_classify_bucket`
-- (built to satisfy exactly that requirement) has only ever returned the strings 'process' or
-- 'content', never a letter. No current row could ever have satisfied the OLD check with a real
-- value from this extractor; the column could only ever be NULL or reject the insert outright.
--
-- The letters 'A'/'B'/'C' are not nonsense — they name a DIFFERENT axis the same spec defines in
-- §5–7: the enforcement-MECHANISM group (deterministic hook / state+counter / LLM judge). That
-- axis has no writer anywhere in this codebase yet (Phase 1 is process-vs-content extraction
-- only) and was never meant to share a column with the process/content boundary — the spec
-- conflated two classification axes under one column name, and the migration inherited the wrong
-- half of that conflation. §1's prose is the one the owner called "the central design ruling this
-- whole system is built around" (fix round 2 review); the schema fragment is corrected to match
-- it, not the other way around.
--
-- If the enforcement-mechanism axis (A/B/C) is needed later, it gets its OWN column — reusing
-- `bucket` for it was the original mistake this migration undoes.

ALTER TABLE rule_revisions DROP CONSTRAINT rule_revisions_bucket_check;

ALTER TABLE rule_revisions ADD CONSTRAINT rule_revisions_bucket_check
  CHECK (bucket IN ('process', 'content'));

COMMENT ON COLUMN rule_revisions.bucket IS
  'The process/content boundary (spec §1, owner ruling 2026-08-06): ''process'' rules are '
  'enforced by this store; ''content'' rules (e.g. DoD-10) belong to a separate, not-yet-built '
  'content-rules mechanism and are out of this store''s enforcement scope even though they stay '
  'queryable here. Not the same axis as the spec §5-7 enforcement-mechanism group (A/B/C) — no '
  'column carries that yet.';
