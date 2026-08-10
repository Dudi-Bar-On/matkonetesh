# Rule Coverage (Arc 1) Implementation Plan

> **‏✅ בוצעה — סומן 10.8.26.** ‏20 הפקדות המשך · שער הכיסוי חי ומונה 32/84
>
> **למה הסימון הזה קיים:** ‏`check-plan-complete` דיווח על 11 מ-34 התוכניות כפגומות. הבדיקה הראשונה
> אי-פעם של השער מול הקורפוס הקיים — הוא נבנה ב-L27 והורץ רק על מה שנכתב אחריו. **התוכניות אינן
> קטועות; הן היסטוריות, וכתובות בסגנון שקדם לדרישת בלוקי-הקוד.** רשום כ-R-119, הוכרע ע"י הבעלים
> ‏10.8.26: קו-בסיס מוצהר + סימון ביצוע, בלי שכתוב תיעוד של עבודה שכבר נחתה.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-08-08-rule-coverage-design.md` (approved & registered). §4 of CLAUDE.md applies: nothing below waives, defers, narrows or reinterprets it. Arcs 2–6 (implementing rules, the C judge, etc.) are OUT of this plan.

**Goal:** Every one of the 140 registered rules reaches a decided state — a final group, and for A/B rules a declared `mechanism` + `mechanism_target` from the closed vocabulary — and coverage becomes a number printed on every run, guarded against regression by a committed baseline.

**Architecture:** All classification writes go to the AUTHORITATIVE store (PostgreSQL `mk_rules`) via a batch-apply function modeled on the existing `scripts/backfill_rule_group.py` precedent (PG `UPDATE` of the current row, then `mirror.write_revision` of the same row — the R-103-safe order), and reach `rules.sqlite` only through that path or the existing rebuild (`builder.rebuild_mirror_from_postgres`). The mirror is NEVER the write target. A new gate `scripts/check-rule-coverage.mjs` cross-references `export const RULE_IDS` declarations in the hook files against the mirror, reports the coverage number always, and blocks only on (a) structural errors — unknown rule_id, missing declaration, unknown mechanism — and (b) regression against a git-committed baseline that only an explicit `--update-baseline` command may change.

**Tech Stack:** PostgreSQL 18 (mk_rules, migrations via `scripts/pgmigrate.py --migrations-dir infra/rules-db/migrations --env-file infra/rules-db/.env`), SQLite mirror (`src/rules_store/mirror.py`), Python (`src/rules_store/*`, pytest in `tests/`), Node ESM gates (`scripts/*.mjs`, self-tests in `scripts/tests/`, orchestrated by `scripts/check-meta.mjs`).

## Measured before planning (2026-08-08, this session — not taken from the spec's prose)

All spec numbers confirmed against the live mirror, with sharper detail:

- `rules.sqlite` / `rule_revisions`: exactly **140 rows**, columns exactly as the spec lists (no `mechanism_target`/target column exists anywhere — it must be ADDED). `mechanism` is NULL on **all 140**. `revision_status='current'` on all 140.
- `rule_group`: NULL=6 (**L68, L69, L70, L71, L72, L73**) · A=**39** · B=**19** · C=**54** · none=**22**. A+B = **58** mechanically-enforceable. Matches the spec exactly.
- Rule files: **10** in `scripts/hooks/rules/` + **3** in `scripts/hooks/stop-rules/` = the spec's "13 rule files"; **3** observers in `scripts/hooks/observers/`. **None exports `RULE_IDS` today** (grepped). Note: 13 *files* will not yield 13 *covered rules* — several files enforce the same rule (`no-concurrent-suite-run` and `stale-dev-server` are both §11a), so the spec's example line "13 of 58" is illustrative; the real first number will be measured by the gate (expected ≈10 distinct rules) and reported as measured, per the Reporting section of CLAUDE.md.
- **Defect found while measuring #1:** `builder.sync_rule` hardcodes `mechanism=None, severity=None` into both the PG INSERT (builder.py:199) and the mirror write (builder.py:210-211). Any text re-sync of a classified rule would silently WIPE its classification — the exact R-103 shape the `rule_group` inheritance (builder.py:168-174) was built to prevent. Task 3 fixes this before any classification is written.
- **Defect found while measuring #2:** the mirror checksum digest (`mirror.checksum_of_rows`, and `check-rules-mirror.mjs`'s PG-side query) covers `(rule_id, source_hash, statement, severity, bucket, rule_group)` and its header explicitly names `mechanism` as NOT covered. A mechanism drift between PG and the mirror would be invisible to all three existing gates. Task 2 folds `mechanism` + `mechanism_target` into the ONE shared digest function.
- Migrations for mk_rules live in `infra/rules-db/migrations/0001..0005`; `pgmigrate.py` accepts `--migrations-dir` + `--env-file` and reads the `RULES_*` key names (verified in `_connection_params`). Grants in 0002 are TABLE-level (`GRANT ... ON rule_revisions`), so a new column needs no new grant.
- 0005's precedent for a human-classification column: CHECK constraint in DDL, NULL = visibly-unclassified, data backfill kept OUT of the DDL file. Followed here.
- `check-meta.mjs` header (its GATE SCOPING section is the authority): a gate may BLOCK when its invariant "is always fixable by a single, cheap, immediate edit reachable from the very commit that trips them"; standing debt must not block. The coverage gate's design matches: a regression is introduced by the very commit that deletes a declaration (restore the line = cheap immediate fix); the standing 45-rule gap only reports. This argument goes in the new gate's own header (Task 12).
- Pytest pattern for store-touching tests: `tests/test_rules_builder.py` — live mk_rules via `config.connect_writer()`, `pytest.skip` when unreachable or `.env` absent, `TEST-`prefixed rule_ids cleaned up in teardown. Followed here.

## Global Constraints

- **Write path (spec §"one-way mirror"):** every classification write lands in PostgreSQL `mk_rules` first, then the mirror row via `mirror.write_revision` — the exact order `scripts/backfill_rule_group.py` established. **No task ever writes `rules.sqlite` without writing PG first.** The three existing gates (`check-rules-fresh`, `check-rules-complete`, `check-rules-mirror`) must be green after every task that touches either store.
- **Closed vocabulary (spec §1), 12 values, verbatim:** `pretooluse:Bash` · `pretooluse:Edit|Write` · `pretooluse:Agent` · `pretooluse:Grep|WebSearch` · `posttooluse` · `stop` · `subagentstop` · `sessionstart` · `commit-gate` · `ci-gate` · `judge` · `none`. An unrecognized value is a said error, never an ignored field — enforced at THREE layers (Task 1 CHECK constraint = the layer no writer can bypass; Task 4 CLI validation = the friendly error; Task 12 gate = defense against a stale/hand-edited mirror).
- **Every mechanism value carries a target** (spec §1: "המנגנון אומר מתי נבדק; היעד אומר על מה") — `mechanism_target`, free-text but concrete (e.g. `git commit`, `app.js|app.css`, `docs/superpowers/specs/**`, `tests/**`), NOT NULL whenever mechanism is set and ≠ `none`.
- **Small batches, owner approval each (spec §2):** structurally enforced — `apply_batch` refuses >10 entries and refuses `approved_by_owner: null`. No task classifies more than 10 rules.
- **No unilateral demotion (spec §2 + §4):** any entry proposing `none` must carry non-empty `cost` and `importance` fields or the CLI refuses; every batch file has a dedicated "הורדות מוצעות" section the owner sees.
- **Gate blocks only on regression vs a COMMITTED baseline** (spec §4, owner ruling 8.8.26); the number prints on every run; the baseline changes only via `--update-baseline`, never by the gate's normal run.
- **Counter-case first (spec §"הדרישות", item 3):** every task below states its RED *and* its counter-RED, and both are behavioural — a module-not-found crash is not a RED anywhere in this plan. (Spec items 1–2 of that section — live-fire proof and the zero false-positive budget — bind arc 2's rule *implementations*; arc 1 carries them forward by recording mechanism+target for every A/B rule so arc 2 can be held to them. Nothing here waives them.)
- Owner naming conventions: English IDs and full words in labels; Hebrew body text where user-facing. No emojis. No `--retries`/`--workers=1` on the Playwright suite. Do not run the suite while heavy subagents compete for CPU (§11a).
- Reclassification discovered during a batch (an "A" that is really B/C) is a valid outcome reported to the owner **in that batch's checkpoint**, not at the end (spec §2 "תוצאה אפשרית").

## File Structure

| File | Responsibility |
|---|---|
| `infra/rules-db/migrations/0006_mechanism_vocabulary.sql` | Create: closed-vocabulary CHECK on `mechanism`, new `mechanism_target` column, pairing CHECK |
| `src/rules_store/mirror.py` | Modify: SCHEMA + `_COLUMNS` + digest gain `mechanism_target`; digest gains `mechanism` |
| `scripts/check-rules-mirror.mjs` | Modify: PG-side digest query gains the two columns |
| `src/rules_store/builder.py` | Modify: `sync_rule` carries + inherits `mechanism`/`mechanism_target` |
| `src/rules_store/classify.py` | Create: `VOCAB`, `MAX_BATCH`, `validate_batch`, `apply_batch` |
| `scripts/classify_rules.py` | Create: thin CLI over `classify.apply_batch`, parses batch .md files |
| `docs/process/rule-coverage/batch-01.md` … `batch-07.md` | Create: one per classification batch (proposal + owner approval + record) |
| `scripts/hooks/rules/*.mjs` ×10, `scripts/hooks/stop-rules/*.mjs` ×3, `scripts/hooks/observers/*.mjs` ×3 | Modify: add `export const RULE_IDS = [...]` |
| `scripts/check-rule-coverage.mjs` | Create: the coverage gate |
| `docs/process/rule-coverage-baseline.json` | Create: the committed coverage baseline |
| `scripts/check-meta.mjs` | Modify: one `run(...)` line after check-rules-mirror |
| `tests/test_rules_classify.py`, `tests/test_rules_mechanism_columns.py` | Create: pytest coverage |
| `scripts/tests/test-check-rule-coverage.mjs` + `scripts/tests/run-all.mjs` | Create + register: gate self-test |

---

### Task 1: Migration 0006 — closed mechanism vocabulary + `mechanism_target` in mk_rules

**Files:**
- Create: `infra/rules-db/migrations/0006_mechanism_vocabulary.sql`
- Test: `tests/test_rules_mechanism_columns.py`

**Interfaces:**
- Produces: PG columns `mechanism` (now CHECK-constrained) and `mechanism_target text` on `rule_revisions`, consumed by Tasks 2–4. Constraint names: `rule_revisions_mechanism_check`, `mechanism_requires_target`.

Where the closed vocabulary is enforced — decided and justified: **the primary enforcement is a schema CHECK constraint in the authoritative store**, because it is the only layer that no writer — the classify CLI, a future arc-2 script, a psql session — can bypass; this is the same choice 0005 made for `rule_group` and the spec's own demand is "ערך שאינו מהרשימה נדחה, לא מושמט" at the store, not merely at one client. The CLI (Task 4) re-validates for a readable error; the gate (Task 12) re-validates the *mirror* copy because the mirror has no CHECK (a stale or hand-edited `rules.sqlite` must also be a said error). The mirror deliberately keeps a permissive schema — it is a projection; its truth-guard is the checksum digest (Task 2), not duplicate constraints.

Interpretation recorded (spec §1 "כל ערך נושא גם יעד"): `none` means "not mechanically enforceable", so a target is meaningless there; the pairing CHECK requires a target for every value EXCEPT `none`, and requires NULL for `none`. If the owner reads the spec as "target even for none", only this CHECK changes.

- [ ] **Step 1: Write the failing test** — `tests/test_rules_mechanism_columns.py`, following `tests/test_rules_builder.py`'s live-store pattern (importorskip, `_writer_conn` with skip-if-unreachable, `TEST-` rule_ids, cleanup):

```python
"""Proves mk_rules REJECTS an unknown mechanism value and a target-less mechanism (spec §1:
"ערך שאינו מהרשימה נדחה, לא מושמט") — and ACCEPTS the legal shapes. Live-store test, same
skip discipline as tests/test_rules_builder.py."""
from __future__ import annotations
from pathlib import Path
import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")
config = pytest.importorskip("src.rules_store.config")

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"

def _writer_conn():
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")
    try:
        return config.connect_writer()
    except psycopg2.OperationalError as exc:
        pytest.skip(f"mk_rules is not reachable ({str(exc).strip()[:80]})")

def _insert(cur, rule_id, mechanism, mechanism_target):
    cur.execute(
        "INSERT INTO rule_revisions (rule_id, statement, mechanism, mechanism_target, "
        "source_path, source_hash, revision_status, is_current) "
        "VALUES (%s, 'vocab test', %s, %s, 'test://vocab', 'h', 'current', false)",
        (rule_id, mechanism, mechanism_target))

def _clean(pg, rule_id):
    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg.commit()

def test_unknown_mechanism_is_rejected_not_ignored():
    pg = _writer_conn(); pg.autocommit = False
    _clean(pg, "TEST-VOCAB")
    with pytest.raises(psycopg2.errors.CheckViolation):
        with pg.cursor() as cur:
            _insert(cur, "TEST-VOCAB", "banana", "git commit")
        pg.commit()
    pg.rollback(); _clean(pg, "TEST-VOCAB"); pg.close()

def test_mechanism_without_target_is_rejected():
    pg = _writer_conn(); pg.autocommit = False
    _clean(pg, "TEST-VOCAB2")
    with pytest.raises(psycopg2.errors.CheckViolation):
        with pg.cursor() as cur:
            _insert(cur, "TEST-VOCAB2", "pretooluse:Bash", None)
        pg.commit()
    pg.rollback(); _clean(pg, "TEST-VOCAB2"); pg.close()

def test_legal_shapes_are_accepted():  # the counter-RED: the healthy cases must pass
    pg = _writer_conn(); pg.autocommit = False
    for rid, mech, tgt in [("TEST-VOCAB3", "pretooluse:Bash", "git commit"),
                           ("TEST-VOCAB4", "none", None),
                           ("TEST-VOCAB5", None, None)]:  # NULL = visibly unclassified, still legal
        _clean(pg, rid)
        with pg.cursor() as cur:
            _insert(cur, rid, mech, tgt)
        pg.commit(); _clean(pg, rid)
    pg.close()
```

- [ ] **Step 2: RED — run and observe the behavioural failure.** `py -3 -m pytest tests/test_rules_mechanism_columns.py -v`. Expected BEFORE the migration: `test_unknown_mechanism_is_rejected_not_ignored` FAILS with `DID NOT RAISE` after the INSERT **succeeds** (today `mechanism` has no CHECK — 0001 line 22 is bare `mechanism text` — so 'banana' is silently accepted: exactly the spec's "field silently ignored" disease, witnessed). `test_mechanism_without_target_is_rejected` fails with `UndefinedColumn` on `mechanism_target` — acceptable ONLY as the secondary test; the vocabulary test above is the load-bearing behavioural RED. Paste both outputs.

- [ ] **Step 3: Write the migration** — `infra/rules-db/migrations/0006_mechanism_vocabulary.sql`:

```sql
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
```

- [ ] **Step 4: Apply.** `py -3 scripts/pgmigrate.py --migrations-dir infra/rules-db/migrations --env-file infra/rules-db/.env --status` (confirm exactly one pending: 0006), then the same command without `--status`. Paste output.
- [ ] **Step 5: GREEN.** `py -3 -m pytest tests/test_rules_mechanism_columns.py -v` — all three tests pass. Paste output + exit code.
- [ ] **Step 6: Existing gates unharmed (counter-case at system level).** Run `node scripts/check-rules-fresh.mjs && node scripts/check-rules-complete.mjs && node scripts/check-rules-mirror.mjs` — all green (the new PG column is not yet in the digest, so nothing drifts). Paste.
- [ ] **Step 7: Commit** `infra/rules-db/migrations/0006_mechanism_vocabulary.sql` + `tests/test_rules_mechanism_columns.py`. Message: `feat(rule-coverage Task 1): mk_rules rejects unknown mechanism values — the closed vocabulary is a CHECK, not a convention`.

---

### Task 2: The mirror and the checksum digest carry `mechanism` + `mechanism_target`

**Files:**
- Modify: `src/rules_store/mirror.py` (SCHEMA at :27-43, `_COLUMNS` at :45-46, `checksum_of_rows` at :90-119, `checksum` at :122-135)
- Modify: `scripts/check-rules-mirror.mjs` (the PG-side SELECT at :59-60)
- Modify: `src/rules_store/builder.py` (`rebuild_mirror_from_postgres` SELECT at :356-358)
- Test: `tests/test_rules_mirror.py` (add one test), plus a scripted red-green against the live gate

**Interfaces:**
- Consumes: Task 1's `mechanism_target` column.
- Produces: digest tuple order `(rule_id, source_hash, statement, severity, bucket, rule_group, mechanism, mechanism_target)` — the shape Tasks 3–4 rely on for drift detection; mirror `_COLUMNS` now 13 entries ending `..., mechanism, mechanism_target, source_path, ...`.

This closes measured defect #2: today a mechanism drift between PG and the mirror is invisible ("does NOT detect: ... mechanism", check-rules-mirror.mjs:16-17). After the classification batches, `mechanism` becomes exactly what the coverage gate and arc-2 hooks read — leaving it out of the digest would recreate R-103 on day one (0005's own comment warns of precisely this).

- [ ] **Step 1: Behavioural RED against the LIVE gate, before any code change.** With all gates currently green, corrupt one mirror row's mechanism by hand and watch the gate stay green (this is the defect, witnessed):

```
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('rules.sqlite');db.prepare(\"UPDATE rule_revisions SET mechanism='none' WHERE rule_id='9'\").run();"
node scripts/check-rules-mirror.mjs
```

Expected TODAY: `OK - rules.sqlite matches mk_rules ... RESULT=already-ok` — a corrupt mechanism passes. Paste the output; this is the RED.
- [ ] **Step 2: Write the failing pytest** — append to `tests/test_rules_mirror.py`:

```python
def test_checksum_covers_mechanism_and_target(tmp_path):
    """A mechanism/mechanism_target edit MUST change the digest — otherwise a classified rule can
    silently lose its classification in the mirror (the R-103 shape, third occurrence)."""
    m = mirror.open_mirror(tmp_path / "m.sqlite")
    base = {"rule_id": "T1", "statement": "s", "source_path": "p", "source_hash": "h",
            "revision_status": "current", "mechanism": "pretooluse:Bash",
            "mechanism_target": "git commit"}
    mirror.write_revision(m, base)
    before = mirror.checksum(m)
    mirror.write_revision(m, {**base, "mechanism": "none", "mechanism_target": None})
    assert mirror.checksum(m) != before, "mechanism drift is invisible to the digest"
```

Run `py -3 -m pytest tests/test_rules_mirror.py -v` — the new test FAILS (`assert` holds equal digests; if `write_revision` errors on the unknown key instead, that error is itself the RED — paste whichever fires).
- [ ] **Step 3: Implement.** In `mirror.py`: add `mechanism_target   TEXT,` to SCHEMA after `mechanism`; add `"mechanism_target"` to `_COLUMNS` after `"mechanism"`; extend `checksum_of_rows` to 8-tuples with body line `f"{rule_id}:{source_hash}:{statement}:{severity or ''}:{bucket or ''}:{rule_group or ''}:{mechanism or ''}:{mechanism_target or ''}"` and update its docstring's column list; extend `checksum()`'s SELECT and tuple to match. In `check-rules-mirror.mjs`: PG-side SELECT becomes `"SELECT rule_id, source_hash, statement, severity, bucket, rule_group, mechanism, mechanism_target FROM rule_revisions WHERE is_current ORDER BY rule_id"`, and update the header's covered/not-covered lists (mechanism moves from "does NOT detect" to detected; `title_he`, `source_path`, `source_heading` remain the stated tradeoff). In `builder.py` `rebuild_mirror_from_postgres`: add `mechanism_target` to the SELECT column list.
- [ ] **Step 4: Rebuild the mirror onto the new schema.** The committed `rules.sqlite` table lacks the new column; `--rebuild-mirror-only` DELETEs rows but not the table, so: `node scripts/check-rules-mirror.mjs` — the SQLite-side `checksum()` now selects `mechanism_target`, hits `no such column`, the gate's own corrupt-mirror path (check-rules-mirror.mjs:38-50, 116-128) deletes the file and rebuilds it from PG. Expected: `RESULT=repaired`. This same self-heal is what migrates any other clone's stale mirror — no manual step to forget. Paste output.
- [ ] **Step 5: GREEN.** `py -3 -m pytest tests/test_rules_mirror.py tests/test_rules_builder.py tests/test_rules_mechanism_columns.py -v` — pass, paste. Re-run Step 1's corruption verbatim, then `node scripts/check-rules-mirror.mjs`: expected now `FAIL: rules.sqlite checksum ... repairing ... RESULT=repaired` — the drift is caught and healed from PG. Paste (this is the red turned green at the system level).
- [ ] **Step 6: Counter-RED.** Immediately run `node scripts/check-rules-mirror.mjs` again on the healthy mirror → `RESULT=already-ok` (the gate does not cry wolf on a clean state), and `node scripts/tests/test-rules-store-drift.mjs` + `node scripts/tests/test-session-rules-drift.mjs` still pass. Paste.
- [ ] **Step 7: Commit** the four modified files + rebuilt `rules.sqlite`. Message: `feat(rule-coverage Task 2): a mechanism drift in the mirror is now as loud as a statement drift`.

---

### Task 3: `sync_rule` preserves classification across document re-syncs

**Files:**
- Modify: `src/rules_store/builder.py` (`sync_rule` — the inheritance SELECT at :168-174, the INSERT at :190-201, the mirror write at :207-214)
- Test: `tests/test_rules_builder.py` (add one test)

**Interfaces:**
- Consumes: Tasks 1–2 columns/digest.
- Produces: the guarantee every classification batch (Tasks 5–11) depends on — a discipline-doc rewording can no longer erase a classification.

Closes measured defect #1. Without this task, the FIRST text edit to `docs/process/development-discipline.md` after the batches would wipe mechanisms from both stores in perfect sync — and the Task 2 digest, agreeing on both sides, would never notice. `severity` (also hardcoded None at builder.py:199/:210) stays untouched: it is NULL on all 140 rows in both stores today, so there is nothing to preserve and no behavioural test could witness a loss — noted here so the omission is a decision, not an oversight.

- [ ] **Step 1: Write the failing test** — append to `tests/test_rules_builder.py` (reuse its `_writer_conn`/`_clean` helpers and `extractor.RuleRecord` construction pattern):

```python
def test_resync_preserves_mechanism_classification(tmp_path):
    """Classify TEST-KEEP (mechanism + target, the way scripts/classify_rules.py will), then
    re-sync the SAME rule_id with CHANGED text. The fresh revision must inherit the
    classification — in Postgres AND the mirror — exactly as rule_group already does."""
    pg = _writer_conn(); pg.autocommit = False
    _clean(pg, "TEST-KEEP")
    m = mirror.open_mirror(tmp_path / "keep.sqlite")
    rec1 = extractor.RuleRecord(rule_id="TEST-KEEP", section="TEST", title_he="t",
                                statement="old text", source_heading="h", content_hash="hash1")
    builder.sync_rule(pg, m, rec1, source_path="test://keep")
    with pg.cursor() as cur:  # the classification write, as classify.apply_batch will do it
        cur.execute("UPDATE rule_revisions SET rule_group='A', mechanism='pretooluse:Bash', "
                    "mechanism_target='git commit' WHERE rule_id='TEST-KEEP' AND is_current")
    pg.commit()
    rec2 = extractor.RuleRecord(rule_id="TEST-KEEP", section="TEST", title_he="t",
                                statement="new text", source_heading="h", content_hash="hash2")
    builder.sync_rule(pg, m, rec2, source_path="test://keep")
    with pg.cursor() as cur:
        cur.execute("SELECT mechanism, mechanism_target FROM rule_revisions "
                    "WHERE rule_id='TEST-KEEP' AND is_current")
        assert cur.fetchone() == ("pretooluse:Bash", "git commit"), "PG lost the classification"
    row = [r for r in mirror.read_current(m) if r["rule_id"] == "TEST-KEEP"][0]
    assert (row["mechanism"], row["mechanism_target"]) == ("pretooluse:Bash", "git commit"), \
        "the mirror lost the classification"
    _clean(pg, "TEST-KEEP"); pg.close()
```

- [ ] **Step 2: RED.** `py -3 -m pytest tests/test_rules_builder.py::test_resync_preserves_mechanism_classification -v` — FAILS at the PG assertion with `(None, None)` (sync_rule hardcodes None). Paste.
- [ ] **Step 3: Implement** in `sync_rule`: extend the inheritance SELECT to `"SELECT rule_group, mechanism, mechanism_target FROM rule_revisions WHERE rule_id = %s AND is_current"`; derive `mechanism = getattr(record, "mechanism", None) or (prev_row[1] if prev_row else None)` and `mechanism_target = getattr(record, "mechanism_target", None) or (prev_row[2] if prev_row else None)`; in the INSERT replace the literal `None, None` (severity, mechanism) with `None, mechanism` and add `mechanism_target` to the column list + VALUES; in the mirror write dict replace `"mechanism": None` with `"mechanism": mechanism` and add `"mechanism_target": mechanism_target`. Extend the R-103 comment block (builder.py:158-167) to name the two new inherited columns.
- [ ] **Step 4: GREEN.** Same pytest command — PASS. Then the whole store suite: `py -3 -m pytest tests/test_rules_builder.py tests/test_rules_mirror.py tests/test_rules_extractor.py tests/test_build_rules_store_cli.py tests/test_rules_mechanism_columns.py -v`. Paste.
- [ ] **Step 5: Counter-RED.** A rule with NO prior classification must still sync with NULLs (no invented value): assert within a quick script or extend the test — sync a fresh `TEST-NOCLASS` record once, SELECT its `mechanism, mechanism_target` → `(None, None)`, and `mechanism_requires_target` did not fire. Also re-run `node scripts/check-rules-mirror.mjs` → `already-ok`. Paste both.
- [ ] **Step 6: Commit.** Message: `feat(rule-coverage Task 3): a discipline-doc rewording can no longer erase a rule's classification`.

---

### Task 4: The batch-apply machinery — `classify.py` + `classify_rules.py` CLI

**Files:**
- Create: `src/rules_store/classify.py`
- Create: `scripts/classify_rules.py`
- Create: `docs/process/rule-coverage/README.md` (the batch-file format, 20 lines, doubling as the template)
- Test: `tests/test_rules_classify.py`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `classify.VOCAB` (frozenset of the 12 values), `classify.MAX_BATCH = 10`, `classify.validate_batch(batch: dict, current: dict[str, str | None]) -> list[str]` (errors; `current` maps rule_id→rule_group), `classify.apply_batch(pg_conn, mirror_conn, batch: dict) -> dict` (returns `{"applied": [...], "regrouped": [...]}`). CLI: `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-NN.md [--dry-run]`.

This is where the spec's three governance rules become STRUCTURAL, not instructions:
1. **Small batches:** `validate_batch` returns an error when `len(entries) > MAX_BATCH` (10). A 39-rule file cannot be applied, however worded.
2. **Owner approval:** `validate_batch` returns an error when `batch["approved_by_owner"]` is not a `YYYY-MM-DD` string (regex `^\d{4}-\d{2}-\d{2}$`). Drafts carry `null`; only after the owner approves in conversation does the controller fill the date (quoting the owner's words in the .md body above the JSON).
3. **No unilateral demotion:** an entry with `rule_group == "none"` or `mechanism == "none"` must carry non-empty `cost` and `importance` strings (the argument the owner ruled must accompany every demotion: "אם הוא חשוב אז גם אכיפה יקרה יכולה להיות שווה") — otherwise a said error naming the rule_id.

Batch file format (documented in the README): a Markdown file, human-readable proposal table + rationale + a mandatory `## הורדות מוצעות` section (or the line `אין הורדות מוצעות במנה זו`), containing exactly ONE fenced ` ```json ` block:

```json
{"batch": 1, "approved_by_owner": null,
 "entries": [
   {"rule_id": "L68", "rule_group": "A", "mechanism": "pretooluse:Bash",
    "mechanism_target": "git commit", "reason": "…", "cost": null, "importance": null}
 ]}
```

`apply_batch` per entry, in the R-103-safe order `backfill_rule_group.py` established: (1) `UPDATE rule_revisions SET rule_group=%s, mechanism=%s, mechanism_target=%s WHERE rule_id=%s AND is_current` on PG, commit once for the whole batch; (2) for each touched rule_id, SELECT its full current PG row and `mirror.write_revision` it. Postgres first: a crash between (1) and (2) leaves a divergence the Task 2 digest now catches and `check-rules-mirror` repairs FROM PG — self-healing in the correct direction. Validation failures happen before ANY write (whole batch refused, no partial application — backfill's precedent). An entry naming a rule_id with no current row, a duplicate rule_id, a mechanism outside `VOCAB`, or a target/pairing violation are all validate-stage errors listing every offender.

`regrouped` in the return value: entries whose applied `rule_group` differs from the group already stored (the spec's "A שהם למעשה B או C" outcome) — the CLI prints them under `REGROUPED (owner was told in this batch's checkpoint):`.

- [ ] **Step 1: Write the failing tests** — `tests/test_rules_classify.py`. Validation tests are pure (no store needed); apply tests follow the live-store skip pattern:

```python
"""classify.apply_batch: the spec's governance rules as code, not prose. Validation tests are
pure-Python; apply tests hit live mk_rules with TEST- ids, same skip discipline as
tests/test_rules_builder.py."""
from __future__ import annotations
from pathlib import Path
import pytest

classify = pytest.importorskip("src.rules_store.classify")

def _batch(**over):
    base = {"batch": 99, "approved_by_owner": "2026-08-08",
            "entries": [{"rule_id": "TEST-C1", "rule_group": "A",
                         "mechanism": "pretooluse:Bash", "mechanism_target": "git commit",
                         "reason": "r", "cost": None, "importance": None}]}
    base.update(over); return base

CURRENT = {"TEST-C1": None}

def test_unapproved_batch_is_refused():
    errs = classify.validate_batch(_batch(approved_by_owner=None), CURRENT)
    assert any("approved_by_owner" in e for e in errs)

def test_oversized_batch_is_refused():
    e = _batch()["entries"][0]
    entries = [{**e, "rule_id": f"TEST-C{i}"} for i in range(11)]
    errs = classify.validate_batch(_batch(entries=entries),
                                   {f"TEST-C{i}": None for i in range(11)})
    assert any("10" in err for err in errs), "an 11-entry batch must be a said error"

def test_unknown_mechanism_is_a_said_error():
    b = _batch(); b["entries"][0]["mechanism"] = "banana"
    errs = classify.validate_batch(b, CURRENT)
    assert any("banana" in e and "TEST-C1" in e for e in errs)

def test_demotion_without_cost_and_importance_is_refused():
    b = _batch(); b["entries"][0].update(rule_group="none", mechanism="none",
                                         mechanism_target=None)
    errs = classify.validate_batch(b, CURRENT)
    assert any("cost" in e or "importance" in e for e in errs)

def test_demotion_with_cost_and_importance_passes_validation():  # counter-RED
    b = _batch(); b["entries"][0].update(rule_group="none", mechanism="none",
        mechanism_target=None, cost="hours of hook work", importance="low — advisory prose")
    assert classify.validate_batch(b, CURRENT) == []

def test_exactly_ten_entries_is_accepted():  # boundary counter-RED
    e = _batch()["entries"][0]
    entries = [{**e, "rule_id": f"TEST-C{i}"} for i in range(10)]
    assert classify.validate_batch(_batch(entries=entries),
                                   {f"TEST-C{i}": None for i in range(10)}) == []

def test_unknown_rule_id_is_refused():
    errs = classify.validate_batch(_batch(), {})  # store knows no TEST-C1
    assert any("TEST-C1" in e for e in errs)
```

Plus one live `apply_batch` test (same file): insert a `TEST-C1` current row via `builder.sync_rule`, apply an approved single-entry batch, assert PG row AND `mirror.read_current` both show `("A", "pretooluse:Bash", "git commit")`, cleanup.
- [ ] **Step 2: RED.** `py -3 -m pytest tests/test_rules_classify.py -v` — importorskip makes missing-module a SKIP, not a crash, so: create `src/rules_store/classify.py` containing only `VOCAB`, `MAX_BATCH = 10`, and a `validate_batch` that returns `[]` unconditionally plus an `apply_batch` that writes nothing and returns `{"applied": [], "regrouped": []}`. NOW run the tests: the refusal tests FAIL behaviourally (an unapproved/oversized/banana batch sails through — the disease itself, witnessed), while the two counter-RED tests pass vacuously. Paste the failing output.
- [ ] **Step 3: Implement** `validate_batch` (all rules above, errors as full sentences naming rule_ids and offending values) and `apply_batch` (refuse if `validate_batch` non-empty — defense in depth even though the CLI validates first; then the two-step write). Write the CLI `scripts/classify_rules.py`: parse the single ```json fence (error if zero or >1 fences), load current rows via `config.connect_writer()` (`SELECT rule_id, rule_group FROM rule_revisions WHERE is_current`), validate, `--dry-run` prints the would-be changes and exits 0 without connecting the mirror; otherwise apply to PG + `rules.sqlite` at repo root, print `applied N rule(s), regrouped: [...]`, exit 0; any validation error prints each and exits 1. Write `docs/process/rule-coverage/README.md` with the format above + the apply command + the rule "one batch file per owner approval; the JSON is the record, the prose is the argument".
- [ ] **Step 4: GREEN.** `py -3 -m pytest tests/test_rules_classify.py -v` — all pass. Paste.
- [ ] **Step 5: CLI counter-RED, end to end.** Create a throwaway draft `docs/process/rule-coverage/batch-00-smoke.md` with `approved_by_owner: null` and one real-looking entry for `TEST-C1`; run `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-00-smoke.md` → exits 1 naming `approved_by_owner`. Confirm zero writes: `node scripts/check-rules-mirror.mjs` → `already-ok`. Delete the smoke file. Paste.
- [ ] **Step 6: Commit.** Message: `feat(rule-coverage Task 4): batch classification with structural owner-approval — an unapproved or oversized batch cannot be applied`.

---

### Tasks 5–11: The classification pass — seven batches, one owner checkpoint each

The batch partition is FIXED here from the measured registry, so no task can absorb another's scope (spec §2: "במנות קטנות, לא ברשימה אחת" — a structural property; the CLI additionally refuses >10):

| Task | Batch file | Rule_ids (measured, alphabetical within group) | Count |
|---|---|---|---|
| 5 | `batch-01.md` | the 6 unclassified: **L68, L69, L70, L71, L72, L73** — each gets a final `rule_group`; any that lands A/B gets `mechanism`+`mechanism_target` in this same batch | 6 |
| 6 | `batch-02.md` | A: **9, 10.5a, 10.11, 10.12, 10.12a, 10.13, 10.17, 10.20, 10.23, 11a** | 10 |
| 7 | `batch-03.md` | A: **12.1, 12.5, DoD-2, DoD-3, DoD-8, DoD-10, DoD-11, H8, H15, L9** | 10 |
| 8 | `batch-04.md` | A: **L10, L15, L17, L18, L19, L24, L27, L32, L40, L48** | 10 |
| 9 | `batch-05.md` | A: **L51, L52, L53, L54, L55, L58, L59, L61, L66** | 9 |
| 10 | `batch-06.md` | B: **1, 2, 5, 10.2, 10.4, 10.7, 10.10, 10.16, 10.18, 11** | 10 |
| 11 | `batch-07.md` | B: **DoD-7, DoD-12, H9, H10, H11, H14, L12, L29, L30** | 9 |

Each of Tasks 5–11 follows the SAME steps (written once here in full; every step applies verbatim to each task with its own batch file and id list — the id lists above are the per-task content, and a reviewer can reject one batch while approving its neighbours because each is an independent owner decision + apply + verification):

- [ ] **Step 1: Draft the proposal.** For each rule_id in this batch, read the rule's full `statement` (and `title_he`, `section`) from the mirror:
  `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('rules.sqlite',{readOnly:true});for(const id of ['<ids…>']){const r=db.prepare('select rule_id,section,title_he,statement,rule_group from rule_revisions where rule_id=?').get(id);console.log(JSON.stringify(r,null,1));}"`
  Then, per rule, propose: the mechanism value (from the 12) answering "at what moment can a machine catch a violation of THIS sentence?", the concrete target ("on what?"), and a 1–3 sentence `reason` quoting the decisive phrase of the statement. If the statement turns out to need state → propose regroup to B; to need judgement → regroup to C, with the reason; the mechanism+target columns are then left NULL for that rule (C/none rules are out of this arc's mechanism scope — see the open question to the owner, logged below) and only `rule_group` changes. If enforcement looks disproportionately expensive relative to value → propose `none` WITH filled `cost` and `importance` fields, in the `## הורדות מוצעות` section. Write `docs/process/rule-coverage/batch-NN.md` per the Task 4 README format, `approved_by_owner: null`.
- [ ] **Step 2: RED (per-batch, behavioural).** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-NN.md` on the draft → exit 1, refused for `approved_by_owner: null`; and `node scripts/check-rules-mirror.mjs` → `already-ok` (nothing was written). Paste both — this witnesses, for every batch, that the structural gate actually stood between draft and store.
- [ ] **Step 3: OWNER CHECKPOINT.** Present the batch to the owner IN CONVERSATION (not "recorded in a document" — §4's own definition): the table, each reason, every proposed regroup (with the running effect on group sizes and arc-2/arc-3 scope), and every proposed demotion with its cost-vs-importance. The owner approves, amends, or rejects entries. Apply amendments to the file; set `approved_by_owner` to the date; quote the owner's approving words in the .md prose. **Do not proceed to Step 4 without this.** If the owner rejects the whole batch, the task ends here as "rejected, re-drafted as a new file" — a valid outcome.
- [ ] **Step 4: Apply.** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-NN.md --dry-run` (paste), then without `--dry-run`. Paste `applied N rule(s)` + any `REGROUPED` lines.
- [ ] **Step 5: Verify both stores, not the CLI's word.** For this batch's ids:
  `py -3 -c "from src.rules_store import config; pg=config.connect_reader(); cur=pg.cursor(); cur.execute(\"SELECT rule_id, rule_group, mechanism, mechanism_target FROM rule_revisions WHERE is_current AND rule_id = ANY(%s) ORDER BY rule_id\", ([<ids…>],)); [print(r) for r in cur.fetchall()]"`
  and the mirror equivalent via node:sqlite; the two listings must agree line for line. Then `node scripts/check-rules-mirror.mjs` → `already-ok` (the extended digest proves PG and mirror agree on the new columns too). Paste all three.
- [ ] **Step 6: Counter-RED (per-batch).** One rule_id OUTSIDE this batch, previously NULL, is still NULL — the batch touched exactly its own ids: `SELECT count(*) FROM rule_revisions WHERE is_current AND mechanism IS NOT NULL` equals the running total of applied A/B classifications so far (state the expected number in the task output). Paste.
- [ ] **Step 7: Commit** `docs/process/rule-coverage/batch-NN.md` + `rules.sqlite`. Message: `feat(rule-coverage Task <N>): batch NN classified — <k> rules decided, owner-approved <date>`. H9 table; if a regroup changed group sizes, update `docs/STATUS-BOARD.md`'s numbers in the same commit.

After Task 11, DoD 1–2 of the spec must hold: `SELECT count(*) FROM rule_revisions WHERE is_current AND rule_group IS NULL` → 0, and every A/B row has mechanism+target (`SELECT count(*) ... WHERE rule_group IN ('A','B') AND (mechanism IS NULL OR (mechanism <> 'none' AND mechanism_target IS NULL))` → 0). Task 15 re-verifies with pasted output. (If Batch 1 regroups any of L68–L73 into A/B, they are classified in that same batch, so the count law still closes.)

---

### Task 12: The coverage gate — `scripts/check-rule-coverage.mjs` + self-tests

**Files:**
- Create: `scripts/check-rule-coverage.mjs`
- Create: `scripts/tests/test-check-rule-coverage.mjs`
- Modify: `scripts/tests/run-all.mjs` (register the new test the same way its neighbours are)

**Interfaces:**
- Consumes: the mirror's `rule_group`/`mechanism` columns; `RULE_IDS` exports (Task 13 adds the real ones; this task tests against fixtures).
- Produces: exit-0/1 contract + output lines consumed by Task 14's check-meta wiring:
  `RULE COVERAGE: <n> of <d> mechanically-enforceable rules covered (<d-n> open)`
  `MECHANISM DECLARED: <m> of <d> A/B rules carry mechanism+target (<d-m> open)`
  and `--update-baseline` writing `docs/process/rule-coverage-baseline.json`.
- Env overrides for self-tests (ROADMAP-override precedent in check-meta.mjs): `RULE_COVERAGE_HOOKS_ROOT`, `RULE_COVERAGE_MIRROR`, `RULE_COVERAGE_BASELINE`.

Design, decided:
- **Declaration reading is a static parse, not an import:** regex `/export\s+const\s+RULE_IDS\s*=\s*\[([\s\S]*?)\]/` over each `.mjs` under `scripts/hooks/rules/`, `scripts/hooks/stop-rules/`, `scripts/hooks/observers/` (the runner files `pretooluse.mjs`/`stop.mjs`/`posttooluse.mjs` at `scripts/hooks/` top level are NOT scanned — only the three rule/observer dirs), then extract the quoted strings. Importing would execute hook module top-levels (state files, port probes) inside a gate that runs at every session start — the declaration is data that travels with the file (spec §3), and a parse reads it without running it.
- **Errors (exit 1, always, no baseline involved):** a scanned file with NO `RULE_IDS` export (an undeclared rule file is invisible coverage — the disease itself) · a declared id with no current row in the mirror (spec §3: "מזהה שאינו קיים במרשם הוא שגיאה" — the `§99` case) · a mirror `mechanism` value outside the 12-value vocabulary (defense against a hand-edited mirror; PG's CHECK cannot see the mirror) · baseline file missing or unparsable once Task 14 commits it (a deleted baseline would silently disable regression detection).
- **Regression (exit 1):** any rule_id present in the baseline's `covered` list that no scanned file declares any more. Message names each lost id and the file(s) that last carried it cannot be known — so it says: `REGRESSION: '<id>' was covered at the committed baseline and no rule file declares it now. If this loss is intended, the owner approves it and the baseline is updated explicitly: node scripts/check-rule-coverage.mjs --update-baseline`.
- **Never blocks on:** the standing gap (open > 0) · coverage AHEAD of baseline (prints `ahead of baseline by <k> — run --update-baseline to bank it`) · declared ids for C/none-group rules (they count as declarations, are validated against the registry, but don't enter the covered-of-58 numerator; printed as an info line).
- **The number prints on EVERY run** including failing ones (spec §4: "מדפיס בכל הרצה") — compute-and-print happens before verdicts. Denominator `<d>` computed live from the mirror (`rule_group IN ('A','B')`), never hardcoded 58.
- **`--update-baseline`:** refuses when any error above is present; otherwise writes `{"covered": [sorted ids], "updated": "YYYY-MM-DD"}` and prints what changed. The DEFAULT run never writes any file — verified by a self-test, because "the gate silently approving the regression it should catch" is the spec's own stated failure mode.
- Header of the gate file must carry the check-meta severity argument (measured above): blocks only on defects the tripping commit itself introduced (a deleted declaration, a bogus id) — each fixable by a single cheap edit reachable from that commit, per check-meta.mjs's GATE SCOPING ruling; the 45-rule standing gap is reported, never blocking, per L70 ("שער שנורה על המקרה הבריא נכבה תוך יום").

- [ ] **Step 1: Build the fixture set** under `scripts/tests/` tmp dir at runtime (the self-test creates them): a mini hooks tree with `rules/good.mjs` (`export const RULE_IDS = ['9'];` + a dummy handler), `rules/silent.mjs` (no export), `observers/obs.mjs` (`export const RULE_IDS = [];`); a mini mirror built with `node:sqlite` holding rows: `9`(A, mechanism `pretooluse:Bash`, target `git commit`), `10.2`(B, NULL mech), `L1`(none), one row with `mechanism='banana'` for the vocabulary case; baselines as JSON files per case.
- [ ] **Step 2: Write the failing self-test** — `scripts/tests/test-check-rule-coverage.mjs`, using the `check(label, cond, detail)` pattern of `test-rules-store-drift.mjs`, cases (each runs the gate via `spawnSync` with the three env overrides):
  1. happy path: exit 0, stdout matches `/RULE COVERAGE: 1 of 2 mechanically-enforceable rules covered \(1 open\)/` — **the standing gap does not block** (counter-RED, the L70 case, listed FIRST deliberately);
  2. `silent.mjs` present → exit 1, stderr/stdout names `silent.mjs`;
  3. declaration `['§99']` → exit 1, names `§99` (spec §3's own example);
  4. baseline contains `'10.2'`, no file declares it → exit 1, message contains `REGRESSION` and `10.2`;
  5. after case 4's failing run, the baseline file's bytes are UNCHANGED (read before/after and compare) — the gate never self-updates;
  6. `--update-baseline` on the healthy tree rewrites the baseline to `{"covered":["9"]}` and a subsequent normal run exits 0;
  7. mirror row with `mechanism='banana'` → exit 1 naming `banana`;
  8. coverage ahead of baseline (baseline `[]`, file declares `9`) → exit 0 with `ahead of baseline`.
- [ ] **Step 3: RED.** `node scripts/tests/test-check-rule-coverage.mjs` with `scripts/check-rule-coverage.mjs` created as a stub that scans nothing and prints `RULE COVERAGE: 0 of 0 mechanically-enforceable rules covered (0 open)` then exits 0. The refusal cases (2,3,4,7) FAIL behaviourally — the stub gate approves a silent file, a phantom id, a regression, and a corrupt mechanism. Paste the failing run. (A stub-first RED, not module-not-found: the gate exists and answers wrong.)
- [ ] **Step 4: Implement the gate** per the design block above. Node ≥ this repo's (node:sqlite `DatabaseSync` with `{readOnly:true}` — verified working in this repo during measurement).
- [ ] **Step 5: GREEN.** `node scripts/tests/test-check-rule-coverage.mjs` — all 8 PASS. Register in `scripts/tests/run-all.mjs`; run `node scripts/tests/run-all.mjs` fully green. Paste.
- [ ] **Step 6: Real-tree RED preserved for Task 13.** Run the gate against the REAL dirs/mirror (no env overrides): expected exit 1 listing all 16 files as missing `RULE_IDS` — paste it; this is Task 13's starting RED, witnessed at the moment the gate is born.
- [ ] **Step 7: Commit** (gate + self-test + run-all registration). Message: `feat(rule-coverage Task 12): the coverage gate — reports always, blocks only on what the commit itself broke`.

---### Task 13: `RULE_IDS` declarations in all 16 hook files

**Files:**
- Modify: all 10 of `scripts/hooks/rules/*.mjs`, all 3 of `scripts/hooks/stop-rules/*.mjs`, all 3 of `scripts/hooks/observers/*.mjs` — one `export const RULE_IDS = [...];` line added directly under each file's header comment.
- Test: the Task 12 gate against the real tree + the existing hook suites.

**Interfaces:**
- Consumes: Task 12's gate (its Step 6 output is this task's RED).
- Produces: the real coverage number, and the declaration set Task 14 banks as the baseline.

Proposed declarations, from each file's own measured header (the mapping is per-file judgement; the three marked ⚠ MUST be confirmed against the registry `statement` texts before landing — read the candidate rule's statement from the mirror and check it describes what the file enforces; a wrong id cannot slip silently because the gate rejects non-registry ids, but a *plausible-yet-wrong* id needs this human check):

| File | RULE_IDS | Registry anchor |
|---|---|---|
| rules/agent-concurrency-ceiling.mjs | `['10.5a']` | §10.5a ceilings (A) |
| rules/brainstorm-before-creative.mjs | `['1']` ⚠ | §1 mandatory-skill trigger "brainstorming before ANY creative work" (B) |
| rules/debugging-before-fix-edit.mjs | `['5']` ⚠ | §5 "debugging starts with evidence, never a guess" (B) |
| rules/fix-cycle-limit.mjs | `['5']` | §5 3-fix rule (B) |
| rules/geniza-fallback-declaration.mjs | `['10.13']` | grep = declared fallback (A) |
| rules/lessons-before-commit.mjs | `['10.16']` | lessons at close (B) |
| rules/main-only-no-worktrees.mjs | `['9']` | work on main (A) |
| rules/no-concurrent-suite-run.mjs | `['11a']` | never two suite runs (A) |
| rules/stale-dev-server.mjs | `['11a']` | restart serve.js after build (A, same §) |
| rules/symbolic-grep-use-serena.mjs | `['10.17']` | Serena for symbol work (A) |
| stop-rules/live-url-verified.mjs | `['10.10']` | a push is not a release (B) |
| stop-rules/ui-playwright-before-done.mjs | `['10.2']` | not verified until seen in UI (B) |
| stop-rules/verify-before-success-claim.mjs | `['1']` ⚠ | §1 trigger "verification-before-completion before ANY success claim" (B) |
| observers/edit-tracker.mjs · session-events.mjs · verification-outcomes.mjs | `[]` each | observers observe; an EXPLICIT empty declaration keeps "no export" unambiguous — the gate can then hard-require the export on every scanned file, so a future rule file that forgets to declare is caught rather than mistaken for an observer |

Expected distinct covered A/B rules from this table: `{10.5a, 1, 5, 10.13, 10.16, 9, 11a, 10.17, 10.10, 10.2}` = **10 of 58** (not the spec's illustrative 13 — files ≠ rules; say this number plainly in the task report).

- [ ] **Step 1: RED already witnessed** — Task 12 Step 6's pasted run (16 files missing RULE_IDS, exit 1). If Task 13 executes in a fresh session, re-run `node scripts/check-rule-coverage.mjs` and paste it fresh.
- [ ] **Step 2: Confirm the three ⚠ mappings** — print statements for candidate ids `1`, `5`, `2` from the mirror; pick per the anchor column; record the confirmation (id → first 10 words of statement) in the task output. If a header names a different governing rule than proposed, the header wins — update the table in the commit message.
- [ ] **Step 3: Add the 16 export lines.** Each carries a one-line comment, e.g. in main-only-no-worktrees.mjs: `export const RULE_IDS = ['9']; // registry ids this file enforces IN FACT — read by scripts/check-rule-coverage.mjs (static parse, never imported)`. Observers: `export const RULE_IDS = []; // observer — records, enforces nothing; explicit so the coverage gate can require this export on every scanned file`.
- [ ] **Step 4: GREEN.** `node scripts/check-rule-coverage.mjs` → exit 0 (no baseline exists yet — baseline-missing becomes an error only once Task 14 wires the gate into check-meta; until then the gate treats an absent baseline as "not yet banked", prints `no committed baseline yet — regression detection arms after --update-baseline`, and this exact behavior is one of Task 12's implemented details), printing `RULE COVERAGE: 10 of 58 ... (48 open)` (or the measured numbers if a batch regrouped rules). Paste.
- [ ] **Step 5: Counter-RED — the hooks still work.** The added export must not change runtime behavior: `node scripts/tests/test-hooks-groupa.mjs && node scripts/tests/test-hooks-groupb.mjs && node scripts/tests/test-hooks-wiring.mjs` all green. Paste.
- [ ] **Step 6: Commit** the 16 files. Message: `feat(rule-coverage Task 13): every rule file declares what it enforces — measured coverage: 10 of 58`.

---

### Task 14: The committed baseline + check-meta wiring + the DoD regression proof

**Files:**
- Create: `docs/process/rule-coverage-baseline.json` (via the explicit command, never by hand)
- Modify: `scripts/check-meta.mjs` (one line after :139)
- Test: the spec's own DoD-4 red-green, on the real tree

**Interfaces:**
- Consumes: Tasks 12–13.
- Produces: the armed, wired gate — spec DoD items 3–4.

- [ ] **Step 1: Bank the baseline explicitly.** `node scripts/check-rule-coverage.mjs --update-baseline` → writes `docs/process/rule-coverage-baseline.json` with the 10 (measured) covered ids. Paste the file's content. This is the ONLY sanctioned write path to this file; the README from Task 4 gains one line saying so.
- [ ] **Step 2: Wire into check-meta.** Insert after line 139 (`run('check-rules-mirror', ...)` — ordering matters: the mirror self-heals first, so this gate reads a verified mirror):
```js
run('check-rule-coverage', 'check-rule-coverage (RULE_IDS declarations vs the registry; blocks only on regression vs the committed baseline — the standing gap is a number, not a red)', 'check-rule-coverage.mjs');
```
- [ ] **Step 3: GREEN.** `node scripts/check-meta.mjs` — full run, the new gate green among the others, the coverage line visible in its section. Paste that section.
- [ ] **Step 4: The spec's DoD-4 RED, observed on the real tree** ("הסרת הצהרה מקובץ קיים מפילה אותו"): edit `scripts/hooks/rules/main-only-no-worktrees.mjs`, change `['9']` to `[]`. Run `node scripts/check-rule-coverage.mjs` → exit 1, `REGRESSION: '9' ...`. Run `node scripts/check-meta.mjs` → the gate contributes a failure. Paste both.
- [ ] **Step 5: Restore** `['9']`; both commands green again; baseline file bytes untouched throughout (diff shows nothing). Paste. (This is the bugfix-shaped regression red-green of DoD line 7, applied to the gate itself.)
- [ ] **Step 6: Counter-RED.** `META_SKIP_GATE` honors the new id like any other: `META_SKIP_GATE=check-rule-coverage node scripts/check-meta.mjs` with the Step 4 breakage temporarily reapplied → check-meta reports the skip loudly (per its escape-hatch design) instead of failing; restore afterwards. And a normal green run twice in a row → identical output (no hidden state). Paste.
- [ ] **Step 7: Commit** baseline + check-meta line. Message: `feat(rule-coverage Task 14): coverage is banked — losing an enforced rule now blocks the commit that loses it`.

---

### Task 15: Arc close — spec DoD audit with pasted evidence

**Files:** none created (evidence + `docs/STATUS-BOARD.md` update + H9 table). This task exists so DoD verification is a reviewable deliverable of its own, not a sentence at the end of Task 14.

- [ ] **Step 1: Spec §5, line by line, each with fresh pasted evidence:**
  1. Zero rules without a group — `SELECT count(*) FROM rule_revisions WHERE is_current AND rule_group IS NULL` on PG **and** the mirror equivalent → both 0.
  2. Every A/B rule has mechanism + target — the Task 5–11 closing query → 0 violations; plus distribution: `SELECT mechanism, count(*) FROM rule_revisions WHERE is_current AND rule_group IN ('A','B') GROUP BY mechanism` pasted (the arc's headline artifact: what to implement, where, how many — spec §6).
  3. Every rule file declares RULE_IDS and every declared id exists — the gate's own green run.
  4. Gate wired, prints, blocks on regression — Task 14 Steps 3–5 evidence, referenced by commit hash + re-run now.
  5. Every `none` demotion carries documented owner approval — list every entry across batch-01..07 with `rule_group` or `mechanism` = `none` newly set this arc, and for each quote its batch file's approval date + cost/importance fields. Zero entries lacking them (the CLI made that impossible; show it held).
- [ ] **Step 2: Full suites, serialized, idle machine (§11a):** `py -3 -m pytest tests/ -q` (via `node scripts/check-pytest.mjs`) · `node scripts/tests/run-all.mjs` · `npx playwright test` (plain — no flags; any failure including intermittent → superpowers:systematic-debugging, never a re-run-until-green). Paste tails + exit codes.
- [ ] **Step 3: `node scripts/check-meta.mjs` fully green.** Paste summary.
- [ ] **Step 4: Independent re-audit** — dispatch a fresh `spec-traceability-auditor` agent against `docs/superpowers/specs/2026-08-08-rule-coverage-design.md` (against the SPEC, not this plan or the register, per the per-phase gate in CLAUDE.md §3). Its verdict pasted; any unmet line → the phase is incomplete, escalate to the owner.
- [ ] **Step 5: Close per `docs/process/checklists/arc-close.md`:** lessons → §11 (candidate: the two measured defects — a column written by no path, and a digest that skips the column everyone reads — both caught by measuring before planning), geniza deposits (`python scripts/ingest.py --scope` after the docs land), STATUS-BOARD + H9 table with the burn-down: **arc 1 of 6 done; what remains for the grand final: arcs 2–6 (implement A, remaining B, the C judge, the content-plane spec, §14 portable architecture)** — and the freshly measured "N of 58, M open" number as arc 2's opening line.
- [ ] **Step 6: Commit** docs. Message: `feat(rule-coverage Task 15): arc 1 closed — every rule decided, coverage measured and banked`.

---

## Self-review (performed while writing)

- **Spec coverage:** §1 closed vocabulary+target → Tasks 1, 4, 12 (three-layer rejection, each justified) · §2 batches/owner/demotion/regroup-reporting → Tasks 4–11 (structural: MAX_BATCH, approved_by_owner, cost/importance; checkpoint per batch; regroups reported in-batch) · §3 RULE_IDS in code + phantom-id-is-error → Tasks 12–13 · §4 gate, number-always, regression-only blocking, committed baseline, explicit update → Tasks 12, 14 · §5 DoD 1–5 → Task 15 items 1–5 (DoD-4's exact RED is Task 14 Step 4) · §6 handoff to arc 2 → Task 15 Step 5 · §"הדרישות" item 3 → every task's counter-RED; items 1–2 recorded as binding arc 2.
- **Placeholder scan:** every code step carries the code; every command is exact; batch tasks share one fully-written step template with per-task id lists fixed in the table (nothing says "similar to Task N" without the content being present).
- **Type consistency:** digest tuple 8-shape (Task 2) = check-rules-mirror SELECT (Task 2) = rebuild SELECT (Task 2); `validate_batch(batch, current)`/`apply_batch(pg_conn, mirror_conn, batch)` used identically in Tasks 4–11; gate output line format identical in Tasks 12/13/14; baseline path `docs/process/rule-coverage-baseline.json` everywhere; env override names identical in Tasks 12 steps.

## Open items for the owner (raised in conversation at execution start, per §10.8)

1. **C-group (54) and none-group (22) mechanism values.** The vocabulary contains `judge` and `none`, but spec §2's scope classifies only the 6 unclassified + 39 A + 19 B. This plan therefore leaves `mechanism` NULL for C and group-none rules (their group already encodes the answer). If the owner prefers the columns filled now (`judge`/`none` mechanically, one extra 2-line batch-style apply), it is a 10-minute addition — but it is beyond the spec text, so it needs an explicit owner word, not a planner's initiative.
2. **`mechanism_target` for `none`:** planned as required-NULL (a target for "not enforceable" is meaningless). Spec §1's sentence "כל ערך נושא גם יעד" could be read as literally-every-value; confirm the planned reading.
3. **The three ⚠ RULE_IDS mappings** (brainstorm-before-creative → `1`, debugging-before-fix-edit → `5`, verify-before-success-claim → `1`) are proposed, verified against statements at Task 13 Step 2 — flag now in case the owner wants them decided in conversation instead.

---

## Controller rulings on the plan's three open questions (2026-08-08)

All three were routine (§10.8) and are decided here rather than sent to the owner.

**Q1 — do C-group and none-group rules get `mechanism` filled now?** NO, they stay NULL. The spec's
DoD (§5.2) requires a mechanism for **A and B only**, and filling `judge` for 54 rules now would be a
classification claim this arc has not earned — arc 4 makes it, from evidence. The vocabulary carries
`judge` and `none` because the column must be able to hold them, not because they must be populated
today.

**Q2 — does `mechanism='none'` carry a target?** NO. A target answers "on what is this checked", and a
rule that is not mechanically checked has nothing to answer with. A required-but-empty target would be
a field filled to satisfy a constraint, which is the shape of every dead column. The CHECK constraint
must therefore permit a NULL target when the mechanism is `none`, and require one otherwise.

**Q3 — the three ambiguous `RULE_IDS` mappings.** Decided by reading what the rules actually say
rather than by their file names, and the corpus settles it:

    rule 1  = "All 14 skills live in the superpowers plugin…"  -> the SKILLS rule
    rule 5  = "Triggered by any failure. From systematic-debugging: Phase 1 —"  -> the DEBUGGING PROTOCOL

  - `brainstorm-before-creative.mjs`     -> `['1']`  — it enforces the skill trigger, not a protocol.
  - `debugging-before-fix-edit.mjs`      -> `['1']`  — §6.4 calls these "the three §1 triggers", and
                                            this one demands the SKILL be invoked. Rule 5 is the
                                            protocol the skill then runs; the rule that enforces 5 is
                                            `fix-cycle-limit.mjs` (the 3-fix ceiling), which already
                                            maps there.
  - `verify-before-success-claim.mjs`    -> `['1']`  — same shape: it demands
                                            `verification-before-completion` be invoked.

  A file may declare more than one id, so a later arc can add `5` to the debugging rule if it comes to
  enforce the protocol itself rather than the skill invocation. Declaring it today would claim coverage
  the code does not provide, which is the exact false-coverage this gate exists to detect.
