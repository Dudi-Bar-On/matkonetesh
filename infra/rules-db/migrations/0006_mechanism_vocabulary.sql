-- infra/rules-db/migrations/0006_mechanism_vocabulary.sql
-- Spec: docs/superpowers/specs/2026-08-08-rule-coverage-design.md §1 (owner decision 8.8.26:
-- closed vocabulary, not free text — "ערך שאינו מהרשימה נדחה, לא מושמט").
-- Same shape as 0005 (rule_group): CHECK in DDL, NULL = visibly unclassified, backfill is DATA
-- and lives in the classification batches (docs/process/rule-coverage/batch-*.md), never here.
-- The CHECK lives in the AUTHORITATIVE store because it is the one layer no writer can bypass;
-- rules.sqlite stays permissive — its guard is mirror.checksum_of_rows(), extended in the same
-- arc to cover both columns (the R-103 lesson 0005's own comment spells out).

ALTER TABLE rule_revisions ADD COLUMN mechanism_target text;

ALTER TABLE rule_revisions ADD CONSTRAINT rule_revisions_mechanism_check
  CHECK (mechanism IS NULL OR mechanism IN (
    'pretooluse:Bash', 'pretooluse:Edit|Write', 'pretooluse:Agent', 'pretooluse:Grep|WebSearch',
    'posttooluse', 'stop', 'subagentstop', 'sessionstart', 'commit-gate', 'ci-gate',
    'judge', 'none'));

-- "המנגנון אומר מתי נבדק; היעד אומר על מה. שניהם נדרשים" (spec §1). `none` = not mechanically
-- enforceable, so a target is meaningless there and must be absent, not stale.
ALTER TABLE rule_revisions ADD CONSTRAINT mechanism_requires_target
  CHECK (mechanism IS NULL
         OR (mechanism = 'none' AND mechanism_target IS NULL)
         OR (mechanism <> 'none' AND mechanism_target IS NOT NULL
             AND length(trim(mechanism_target)) > 0));

COMMENT ON COLUMN rule_revisions.mechanism_target IS
  'The concrete scope the mechanism checks (e.g. ''git commit'', ''app.js|app.css'', '
  '''tests/**''). Required for every mechanism except ''none''; NULL while unclassified. '
  'Spec 2026-08-08-rule-coverage-design.md §1.';
