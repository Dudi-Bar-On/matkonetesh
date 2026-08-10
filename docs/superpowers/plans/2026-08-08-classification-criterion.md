# Classification Criterion + Reclassification of 95 Rules — Implementation Plan

> **‏✅ בוצעה — סומן 10.8.26.** ‏9 הפקדות המשך · 158 מ-159 כללים מסווגים
>
> **למה הסימון הזה קיים:** ‏`check-plan-complete` דיווח על 11 מ-34 התוכניות כפגומות. הבדיקה הראשונה
> אי-פעם של השער מול הקורפוס הקיים — הוא נבנה ב-L27 והורץ רק על מה שנכתב אחריו. **התוכניות אינן
> קטועות; הן היסטוריות, וכתובות בסגנון שקדם לדרישת בלוקי-הקוד.** רשום כ-R-119, הוכרע ע"י הבעלים
> ‏10.8.26: קו-בסיס מוצהר + סימון ביצוע, בלי שכתוב תיעוד של עבודה שכבר נחתה.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Spec (approved, registered):** `docs/superpowers/specs/2026-08-08-classification-criterion-design.md`
**Goal:** Write the repeatable classification criterion, PROVE its repeatability by measuring
agreement between two independent blind classifiers on a fresh 20-rule sample (≥85% before anything
is applied), and only then re-classify the 95 rules currently in `C` and `none` — in owner-approved
batches of ≤10 through the existing `scripts/classify_rules.py` machinery, unchanged.

**Architecture:** Three small pure-Python function groups (sampling/packet building,
answer validation/comparison, batch preparation) added in one module `src/rules_store/criterion.py`
with three thin CLIs, following the exact pattern of `src/rules_store/classify.py` +
`scripts/classify_rules.py` (pure validation testable without a DB; CLI wraps it). Measurement is
made **structurally prior** to application: the batch preparer refuses to run unless a
`VERDICT: PASS` result file exists, and the sampler refuses to draw once the unmeasured pool drops
below 20. Independence is enforced by construction: classifiers receive an **anonymized packet**
(opaque tokens, statement text only, no `rule_id`, no `rule_group`, no `mechanism`) whose generator
is tested to never emit the truth columns; the token→rule_id mapping lives in a file the
classifiers are never given; comparison runs only after both answer files exist.

**Tech Stack:** Python 3.14 (`py -3`), pytest, sqlite3 against the `rules.sqlite` mirror (read —
note: the mirror's `rule_revisions` table holds current rows only and has **no `is_current`
column**), PostgreSQL via the existing `classify.apply_batch` write path (write — reused as-is, no
changes), Claude Code `Agent` tool for the two classifier subagents.

## Global Constraints

- **§4 Waiver Gate:** nothing in the spec is waived, deferred, narrowed, or reinterpreted here. Any
  conflict discovered during execution goes to the owner in conversation, not into a file.
- **Owner ruling, binding:** both classifiers run on model **`fable`**, reasoning effort **`high`
  or better**. Every classifier dispatch in this plan passes `model: "fable"` to the Agent tool and
  states the effort requirement in the dispatch prompt; a dispatch that cannot honor it is not sent.
- **Threshold:** agreement **≥ 85%** on a sample of **exactly 20** = **at most 3 disagreements**
  (≥ 17/20 group-level matches). Measured BEFORE any application, structurally (Task 7's preparer
  refuses without a PASS verdict file).
- **Fresh samples only:** a rule drawn into any measurement round (pass or fail) is recorded in a
  ledger and never drawn again. Sample size is never shrunk to fit a small pool.
- **Revision ceiling: 3 revisions (4 measurements total).** Justification in Task 5. On the 4th
  failed measurement OR pool < 20, the arc STOPS and produces the boundary-blur report for the
  owner (spec §5).
- **`approved_by_owner` is written ONLY after the owner approves that specific batch in
  conversation.** Every generated draft carries `"approved_by_owner": null`. Tasks 1–7 can run
  unattended; Task 8 (application) cannot, per-batch. This is stated per task below.
- **Existing machinery reused as-is:** `src/rules_store/classify.py` and
  `scripts/classify_rules.py` are **not modified**. MAX_BATCH=10, the approval-date refusal, and
  the demotion cost/importance refusal are their job, not re-implemented here.
- **No safety values touched** (DoD-10): this arc writes only `rule_group`/`mechanism`/
  `mechanism_target` on rule rows and process docs. No `bcheck`, `temp`, `safe`, or duration
  anywhere in scope; no app code is modified, so the assertion is the diff itself
  (`git diff --stat` shows no `app.js`/`app.css`/`data.py`/`sources.py`).
- **Scope is exactly the 95** (C=56, `none`=39) fixed by the spec. The mirror currently also holds
  **L75 and L76 with NULL `rule_group`** (measured 9.8.26) — they postdate the spec, are NOT
  classified by this arc, and are reported to the owner in Task 9 as a follow-up decision.
- Per-task verification: `py -3 -X utf8 -m pytest tests/ -q` fresh, output pasted, exit code shown.
  `npx playwright test` (plain, no flags, serialized per §11a) once per task that changes repo code
  (Tasks 1–3, 7) before its commit. Every new script that prints Hebrew reconfigures
  stdout/stderr to UTF-8 at entry (L74 — copy the exact block at the top of
  `scripts/classify_rules.py`; the cp1252 UnicodeEncodeError was reproduced live while preparing
  this plan).

## File map

| Path | Role | Task |
|---|---|---|
| `docs/process/rule-coverage/criterion/criterion.md` | THE criterion — one file, versioned sections | 1 |
| `src/rules_store/criterion.py` | all pure logic: draw, packet, validate, compare, prepare | 2, 3, 7 |
| `scripts/criterion_sample.py` | CLI: draw round sample / build apply-pass chunks | 2 |
| `scripts/criterion_compare.py` | CLI: validate both answer files, emit verdict | 3 |
| `scripts/criterion_prepare_batches.py` | CLI: agreed→batch drafts, disagreed→owner list | 7 |
| `docs/process/rule-coverage/criterion/measured-ids.json` | ledger of every rule ever sampled | 2 |
| `docs/process/rule-coverage/criterion/rounds/round-N/` | `packet.md`, `mapping.json`, `answers-alpha.json`, `answers-beta.json`, `result.md` | 4, 5 |
| `docs/process/rule-coverage/criterion/apply/` | 5 chunk packets + mappings + 2 merged answer files | 6 |
| `docs/process/rule-coverage/batch-08.md` … `batch-17.md` | drafts, `approved_by_owner: null` | 7 |
| `docs/process/rule-coverage/criterion/disagreements-for-owner.md` | both readings + both reasons per disputed rule | 7 |
| `docs/process/rule-coverage/criterion/boundary-blur-report.md` | written ONLY if the ceiling/pool stop fires | 5 |
| `tests/test_criterion_sampling.py`, `tests/test_criterion_compare.py`, `tests/test_criterion_batches.py` | the arc's pytest files | 1–3, 7 |

---

### Task 1: The criterion file — one file, a decision procedure

**Files:**
- Create: `docs/process/rule-coverage/criterion/criterion.md`
- Test: `tests/test_criterion_sampling.py` (first tests in it)

**Interfaces:**
- Produces: the criterion text that Task 2's `build_packet` embeds verbatim, and the constant
  `CRITERION_PATH = ROOT / "docs/process/rule-coverage/criterion/criterion.md"` later code reads.

**Can run unattended:** yes (the criterion's CONTENT is fixed by the approved spec §1; writing it
down is transcription plus the answer schema).

The file contains, in this order:

1. Header: `# קריטריון הסיווג — נוהל החלטה` + `## גרסה 1 — 2026-08-09` (revisions in Task 5 append
   `## גרסה N — <date>` sections with a one-line "מה השתנה ולמה"; the file is ONE file, git-tracked,
   and each measurement round records which version it measured).
2. The three questions **verbatim from spec §1** — the ש1/ש2/ש3 block including the routing arrows
   and the ש1 burden-of-proof clause ("מי שעונה 'כן' חייב לנקוב בארטיפקט ובדפוס… 'בטח אפשר לכתוב
   regex' אינו תשובה").
3. The 12-value mechanism vocabulary table copied from
   `docs/superpowers/specs/2026-08-08-rule-coverage-design.md` §1 (a classifier proposing A/B must
   name a mechanism from it, plus a concrete target).
4. The **answer schema** — one JSON object per token, exact required fields per verdict:

```json
{"token": "R01", "group": "A",
 "artifact": "הפקודה המלאה במטען pretooluse:Bash", "pattern": "git commit בצירוף כתיבת קובץ",
 "mechanism": "pretooluse:Bash", "mechanism_target": "git commit",
 "reason": "משפט אחד"}
{"token": "R02", "group": "B",
 "mechanism": "sessionstart", "mechanism_target": "docs/STATUS-BOARD.md",
 "observed_prior_facts": "היכן העובדות הקודמות נצפות", "reason": "משפט אחד"}
{"token": "R03", "group": "C", "reason": "איזו משמעות/איכות/כוונה נדרש להעריך"}
{"token": "R04", "group": "none",
 "cost": "מדוע אין תנאי ציות / מה עולה לשפוט", "importance": "גבוהה/בינונית/נמוכה + משפט"}
```

   Field rules (these are what Task 3's `validate_answers` enforces): `A` requires non-empty
   `artifact`, `pattern`, `mechanism` (from the vocabulary), `mechanism_target` — an A without a
   named artifact AND pattern is schema-invalid, which is the ש1 burden of proof made mechanical.
   `B` requires `mechanism` (vocabulary), `mechanism_target`, `observed_prior_facts`. `C` requires
   `reason`. `none` requires `cost` and `importance` — supplied blind, because a blind classifier
   cannot know whether its `none` is a demotion, so it always writes both (which is exactly what
   `classify.validate_batch` will later demand).
5. A closing note: **agreement is measured on `group` only**; mechanism/target differences on an
   agreed group are surfaced to the owner in the batch prose (Task 7), never averaged.

- [ ] **Step 1: Write the failing test first**

```python
# tests/test_criterion_sampling.py
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRITERION = ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "criterion.md"

def test_criterion_file_is_the_full_decision_procedure():
    assert CRITERION.exists(), "criterion.md not written yet"
    text = CRITERION.read_text(encoding="utf-8")
    for token in ("ש1", "ש2", "ש3", "חובת הוכחה", "גרסה 1"):
        assert token in text, f"criterion is missing {token!r}"
    # answer schema must name every verdict's required fields
    for token in ('"group"', '"artifact"', '"pattern"', '"cost"', '"importance"',
                  '"observed_prior_facts"'):
        assert token in text, f"answer schema is missing {token!r}"

def test_criterion_contains_no_per_rule_answers():
    # The criterion is a procedure, not an answer key. No corpus rule_id may appear with a verdict.
    text = CRITERION.read_text(encoding="utf-8")
    import re
    assert not re.search(r"\bL\d{1,3}\b\s*[→:|]\s*(A|B|C|none)\b", text), \
        "criterion.md embeds a per-rule answer — that is contamination of every future classifier"
```

- [ ] **Step 2: Run it, observe it fail for the intended reason**

Run: `py -3 -X utf8 -m pytest tests/test_criterion_sampling.py -q`
Expected: FAIL on `assert CRITERION.exists()` with the message "criterion.md not written yet" —
an assertion failure on the missing deliverable, NOT an import error. **COUNTER-RED for this task:**
`test_criterion_contains_no_per_rule_answers` — temporarily add the line `L55 → A` to a draft of
the file and observe THAT test fail, then remove the line. Paste both outputs.

- [ ] **Step 3: Write `criterion.md`** with the five sections above, the spec §1 block copied
  verbatim (open the spec side-by-side; the three questions must be character-identical including
  the ⇒ clause).

- [ ] **Step 4: Run the tests, expect PASS** — `py -3 -X utf8 -m pytest tests/test_criterion_sampling.py -q`

- [ ] **Step 5: Full checks + commit**

```
py -3 -X utf8 -m pytest tests/ -q
npx playwright test
git add docs/process/rule-coverage/criterion/criterion.md tests/test_criterion_sampling.py
git commit -m "feat(criterion arc, Task 1): the classification criterion, one file, spec-verbatim"
```

---

### Task 2: Sampling + blind-packet machinery

**Files:**
- Create: `src/rules_store/criterion.py` (module; this task adds `load_pool`, `draw_sample`,
  `build_packet`, `load_ledger`, `record_draw`)
- Create: `scripts/criterion_sample.py`
- Create: `docs/process/rule-coverage/criterion/measured-ids.json` (initialized `{"rounds": []}` by
  the first real draw; the empty-ledger shape is under test)
- Test: `tests/test_criterion_sampling.py` (extend)

**Interfaces:**
- Consumes: `criterion.md` from Task 1; the `rules.sqlite` mirror (read-only), table
  `rule_revisions` with columns `rule_id, title_he, statement, rule_group` — current rows only, no
  `is_current` column.
- Produces, exact signatures Tasks 3/4/6 rely on:

```python
POOL_GROUPS = ("C", "none")   # the 95: C=56, none=39 — measured, spec-fixed
SAMPLE_SIZE = 20
MAX_MEASUREMENTS = 4          # 1 initial + 3 revisions (Task 5)

def load_pool(mirror_path) -> dict[str, dict]:
    """rule_id -> {"title_he":…, "statement":…}; ONLY rule_group in POOL_GROUPS; the returned
    dicts NEVER carry rule_group/mechanism/mechanism_target — stripped at the query, not later."""

def draw_sample(pool_ids: list[str], measured_ids: set[str], seed: int) -> list[str]:
    """Deterministic: sorted(pool - measured), random.Random(seed).sample(…, SAMPLE_SIZE).
    Raises ValueError('unmeasured pool has N rules, fewer than 20 — ARC STOP: write the
    boundary-blur report (spec §5)') when len(pool - measured) < SAMPLE_SIZE."""

def build_packet(rules: dict[str, dict], sample_ids: list[str], criterion_text: str,
                 seed: int, token_prefix: str = "R") -> tuple[str, dict[str, str]]:
    """Returns (packet_markdown, mapping token->rule_id). Tokens R01.. in an order shuffled by
    random.Random(seed) — packet order never equals corpus order. Packet = criterion text +
    per-token title_he + statement. HARD GUARANTEE (tested): the packet string contains none of
    'rule_group', 'mechanism', any rule_id from the sample, and no group letter next to a token."""
```

- CLI: `py -3 scripts/criterion_sample.py --round N --seed N` writes
  `docs/process/rule-coverage/criterion/rounds/round-N/packet.md` and `…/mapping.json`, appends
  `{"round": N, "seed": N, "criterion_version": <current max גרסה in criterion.md>, "drawn": [...],
  "verdict": null}` to the ledger **at draw time** (a failed round's rules are still consumed —
  that is the fresh-sample rule), and refuses (`exit 1`, message printed) if `--round N` already
  exists in the ledger, if `N > MAX_MEASUREMENTS`, or if the pool refusal fires. Apply mode (Task
  6): `--apply --chunk K` (K=1..5) draws the K-th 19-rule slice of ALL 95 sorted rule_ids (no
  ledger; tokens `S01..S95` globally numbered, chunk K covering S(19K−18)..S(19K)) into
  `criterion/apply/chunk-K-packet.md` + `chunk-K-mapping.json`.

**Can run unattended:** yes.

- [ ] **Step 1: Write the module stub** — `src/rules_store/criterion.py` with the functions
  defined and each body `return {}` / `return []` / `return ("", {})` so tests fail on
  **assertions**, never on import (a module-not-found or KeyError RED is void).

- [ ] **Step 2: Write the failing tests**

```python
# appended to tests/test_criterion_sampling.py
import json, sqlite3, pytest
from src.rules_store import criterion

def _mini_mirror(tmp_path):
    db = tmp_path / "mini.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE rule_revisions (rule_id TEXT, title_he TEXT, statement TEXT, "
                 "rule_group TEXT, mechanism TEXT, mechanism_target TEXT)")
    rows = [(f"L{i}", f"כותרת {i}", f"טקסט הכלל {i}", "C" if i % 2 else "none", None, None)
            for i in range(1, 46)]
    rows.append(("A9", "כלל A", "לא בבריכה", "A", "ci-gate", "x"))   # must be excluded
    conn.executemany("INSERT INTO rule_revisions VALUES (?,?,?,?,?,?)", rows)
    conn.commit(); conn.close()
    return db

def test_pool_holds_only_C_and_none_and_never_the_truth_columns(tmp_path):
    pool = criterion.load_pool(_mini_mirror(tmp_path))
    assert "A9" not in pool and len(pool) == 45
    assert all(set(v) == {"title_he", "statement"} for v in pool.values())

def test_draw_is_deterministic_excludes_measured_and_refuses_small_pool(tmp_path):
    pool = criterion.load_pool(_mini_mirror(tmp_path))
    ids = list(pool)
    s1 = criterion.draw_sample(ids, set(), seed=1)
    assert s1 == criterion.draw_sample(ids, set(), seed=1) and len(s1) == 20
    s2 = criterion.draw_sample(ids, set(s1), seed=2)
    assert not set(s1) & set(s2)                       # fresh sample, by construction
    with pytest.raises(ValueError, match="ARC STOP"):  # 45 - 40 = 5 < 20
        criterion.draw_sample(ids, set(s1) | set(s2), seed=3)

def test_packet_is_blind_by_construction(tmp_path):
    pool = criterion.load_pool(_mini_mirror(tmp_path))
    sample = criterion.draw_sample(list(pool), set(), seed=1)
    packet, mapping = criterion.build_packet(pool, sample, "CRITERION TEXT ש1 ש2 ש3", seed=1)
    assert "CRITERION TEXT" in packet
    assert sorted(mapping) == [f"R{i:02d}" for i in range(1, 21)]
    assert sorted(mapping.values()) == sorted(sample)
    for forbidden in ["rule_group", "mechanism", *sample]:
        assert forbidden not in packet, f"packet leaks {forbidden!r} — independence broken"
    # shuffled: token order must not equal sorted corpus order
    assert [mapping[f"R{i:02d}"] for i in range(1, 21)] != sorted(sample)
```

- [ ] **Step 3: Run, observe RED** — `py -3 -X utf8 -m pytest tests/test_criterion_sampling.py -q`.
  Expected: the three new tests FAIL on value assertions against the stubs (`len(pool) == 45` vs
  `{}`; the refusal test fails with "DID NOT RAISE ValueError"). Paste. **COUNTER-RED:** the
  `forbidden` loop in `test_packet_is_blind_by_construction` and the small-pool `pytest.raises`
  ARE the counter-reds — after implementing, temporarily make `load_pool` include `rule_group` in
  the row dicts, observe the blind-packet test fail, revert. Paste both outputs.

- [ ] **Step 4: Implement** the module (real bodies per the signatures above; `load_pool` query:
  `SELECT rule_id, title_he, statement FROM rule_revisions WHERE rule_group IN ('C','none')` —
  selecting only three columns is what makes the stripping structural) and the CLI (UTF-8
  reconfigure block first, `ROOT`/`sys.path` prelude copied from `scripts/classify_rules.py`).

- [ ] **Step 5: GREEN + suite + commit**

```
py -3 -X utf8 -m pytest tests/test_criterion_sampling.py -q     # PASS, paste
py -3 -X utf8 -m pytest tests/ -q
npx playwright test
git add src/rules_store/criterion.py scripts/criterion_sample.py tests/test_criterion_sampling.py
git commit -m "feat(criterion arc, Task 2): blind sampling — fresh-sample and pool-stop refusals are code"
```

---

### Task 3: Answer validation + agreement comparison

**Files:**
- Modify: `src/rules_store/criterion.py` (add `validate_answers`, `compare_answers`)
- Create: `scripts/criterion_compare.py`
- Test: `tests/test_criterion_compare.py`

**Interfaces:**
- Consumes: `mapping.json` and the two answer files from a round directory; the answer schema from
  Task 1; `classify.VOCAB` (imported — single source of vocabulary truth; `classify.py` untouched).
- Produces:

```python
def validate_answers(answers: list[dict], expected_tokens: set[str]) -> list[str]:
    """Full-sentence errors (classify.validate_batch style — never raises on shape): missing/extra/
    duplicate tokens; group not in {"A","B","C","none"}; A missing artifact/pattern/mechanism/
    mechanism_target or mechanism not in classify.VOCAB; B missing mechanism/mechanism_target/
    observed_prior_facts; C missing reason; none missing cost/importance. Empty list == usable."""

def compare_answers(alpha: list[dict], beta: list[dict], mapping: dict[str, str]) -> dict:
    """{"total": N, "agreements": int, "verdict": "PASS"|"FAIL",   # PASS iff total-agreements <= 3
        "disagreements": [{"token":…, "rule_id":…, "alpha_group":…, "beta_group":…,
                           "alpha_reason":…, "beta_reason":…}, …],
        "mechanism_conflicts": [same shape + both mechanism/target proposals]}
    Agreement is on `group` only. A mechanism difference on an agreed group goes to
    mechanism_conflicts for the Task 7 batch prose — never counted as disagreement, never
    silently dropped."""
```

- CLI: `py -3 scripts/criterion_compare.py --round N` reads
  `rounds/round-N/{mapping.json,answers-alpha.json,answers-beta.json}`, **refuses with exit 1 if
  either answer file is absent** ("comparison runs only after BOTH classifiers have finished —
  answers-beta.json is missing"), refuses if either fails `validate_answers`, else writes
  `rounds/round-N/result.md` containing: criterion version measured, seed, the count
  `agreements/20`, the line `VERDICT: PASS` or `VERDICT: FAIL`, and the disagreement table with
  both readings and both reasons per rule (spec DoD-5 shape). It also back-fills `"verdict"` into
  that round's ledger entry. `--apply` mode (Task 6) merges nothing itself; it compares the two
  merged 95-token apply answer files with threshold logic DISABLED (no PASS/FAIL — application
  agreement is per-rule routing, not a criterion measurement), refuses unless exactly the 95
  expected tokens are present in both, and writes `apply/agreement.json`.

**Can run unattended:** yes.

- [ ] **Step 1: stubs** — add both functions; `validate_answers` returns `[]`, `compare_answers`
  returns `{"total": 0, "agreements": 0, "verdict": "", "disagreements": [],
  "mechanism_conflicts": []}` so every RED is a value assertion, never a KeyError.

- [ ] **Step 2: failing tests**

```python
# tests/test_criterion_compare.py
from src.rules_store import classify, criterion

MAP = {f"R{i:02d}": f"L{i}" for i in range(1, 21)}

def _ans(token, group, **kw):
    base = {"token": token, "group": group, "reason": "כי"}
    if group == "A":
        base |= {"artifact": "המטען", "pattern": "git commit", "mechanism": "pretooluse:Bash",
                 "mechanism_target": "git commit"}
    if group == "B":
        base |= {"mechanism": "sessionstart", "mechanism_target": "docs/**",
                 "observed_prior_facts": "מונה במחסן המצב"}
    if group == "none":
        base |= {"cost": "שיפוט", "importance": "גבוהה"}
    return base | kw

def _full(groups):
    return [_ans(f"R{i:02d}", g) for i, g in enumerate(groups, 1)]

def test_17_of_20_passes_and_16_fails():
    alpha = _full(["C"] * 20)
    beta3 = _full(["C"] * 17 + ["none"] * 3)
    r = criterion.compare_answers(alpha, beta3, MAP)
    assert (r["agreements"], r["verdict"]) == (17, "PASS")
    beta4 = _full(["C"] * 16 + ["none"] * 4)
    r = criterion.compare_answers(alpha, beta4, MAP)
    assert (r["agreements"], r["verdict"]) == (16, "FAIL")
    d = r["disagreements"][0]
    assert d["rule_id"] == "L17" and d["alpha_reason"] and d["beta_reason"]

def test_burden_of_proof_is_schema_not_politeness():
    bad = _full(["C"] * 20)
    bad[0] = {"token": "R01", "group": "A", "reason": "בטח אפשר regex"}  # A with no artifact
    errs = criterion.validate_answers(bad, set(MAP))
    assert any("artifact" in e and "R01" in e for e in errs)

def test_missing_token_is_an_error_not_a_skip():
    errs = criterion.validate_answers(_full(["C"] * 19), set(MAP))
    assert any("R20" in e for e in errs)

def test_agreed_group_with_different_mechanism_is_a_conflict_not_a_disagreement():
    alpha, beta = _full(["A"] * 20), _full(["A"] * 20)
    beta[0]["mechanism"] = "ci-gate"; beta[0]["mechanism_target"] = "scripts/**"
    r = criterion.compare_answers(alpha, beta, MAP)
    assert r["verdict"] == "PASS" and r["agreements"] == 20
    assert r["mechanism_conflicts"][0]["rule_id"] == "L1"
```

- [ ] **Step 3: RED observed** — `py -3 -X utf8 -m pytest tests/test_criterion_compare.py -q`;
  all fail on value assertions vs the stubs (e.g. `(0, '') == (17, 'PASS')`). Paste.
  **COUNTER-RED:** `test_burden_of_proof_is_schema_not_politeness` and
  `test_missing_token_is_an_error_not_a_skip` are the counter-reds (what must NOT be accepted);
  additionally, after implementing, run the CLI on a round dir containing only
  `answers-alpha.json` and paste the exit-1 refusal naming the missing beta file.

- [ ] **Step 4: Implement.**

- [ ] **Step 5: GREEN + suite + commit**

```
py -3 -X utf8 -m pytest tests/test_criterion_compare.py -q
py -3 -X utf8 -m pytest tests/ -q
npx playwright test
git add src/rules_store/criterion.py scripts/criterion_compare.py tests/test_criterion_compare.py
git commit -m "feat(criterion arc, Task 3): agreement measured on group, burden of proof is schema"
```

---

### Task 4: Measurement round 1 — two blind classifiers, one packet

**Files:**
- Create (by running the CLIs, never by hand): `docs/process/rule-coverage/criterion/rounds/round-1/`
  — `packet.md`, `mapping.json`, `answers-alpha.json`, `answers-beta.json`, `result.md`; ledger
  updated.

**Can run unattended:** yes — this measures; it applies nothing.

**Interfaces:** consumes Task 2's sampler and Task 3's comparer; produces `result.md` whose
`VERDICT: PASS` line is what Task 7's preparer greps for.

- [ ] **Step 1 (RED for this procedure task):** before any answers exist, run
  `py -3 scripts/criterion_compare.py --round 1` → expected exit 1, "round-1 does not exist / both
  answer files required". Then run `py -3 scripts/criterion_sample.py --round 1 --seed 1` and
  re-run the comparer → still exit 1 (answers missing). Paste both refusals. This is the
  "measurement machinery cannot be short-circuited" RED — an observed refusal, not a crash.

- [ ] **Step 2: Dispatch BOTH classifiers in ONE message** (two `Agent` calls in the same block —
  parallel by construction: each starts before either finishes, so neither's output can reach the
  other; two agents is within §10.5a's light-parallel allowance and no suite is running). Both
  dispatches identical except the name alpha/beta. Exact dispatch:
  `subagent_type: "general-purpose"`, `model: "fable"`, prompt:

  > You are classifier ALPHA [/BETA] running at reasoning effort HIGH — if you cannot run at high
  > effort, answer only the word REFUSED. Below is a classification criterion and 20 anonymized
  > rules (R01–R20). Apply the criterion to each rule IN ORDER, exactly as written — ש1 then ש2
  > then ש3. Answer ש1 "כן" only if you can name the concrete artifact and the concrete pattern;
  > "surely a regex exists" is a "לא". **Use NO tools of any kind — no Read, no Grep, no Bash, no
  > database, no web.** Everything you need is in this message; any tool use invalidates the
  > measurement. Return ONLY a JSON array of 20 objects matching the answer schema embedded in the
  > criterion below, one object per token, no prose before or after.
  >
  > [full contents of `rounds/round-1/packet.md` pasted inline]

  The packet is pasted inline (no file path given) so the classifier needs zero repo access — the
  artifacts that hold the truth (`mapping.json`, `rules.sqlite`) are never named to it, and the
  packet itself is already proven truth-free by `test_packet_is_blind_by_construction`.

- [ ] **Step 3: The controller (not the classifiers) saves the outputs** verbatim to
  `rounds/round-1/answers-alpha.json` and `answers-beta.json` — only after BOTH have returned.
  If either returned `REFUSED`, non-JSON, or its report shows tool use, that classifier is
  re-dispatched fresh with the same packet; its partner's saved answers are shown to no one.

- [ ] **Step 4: Compare** — `py -3 scripts/criterion_compare.py --round 1`. Paste `result.md`
  in full: `agreements/20`, `VERDICT`, the disagreement table with both readings and reasons.

- [ ] **Step 5: Contamination check (COUNTER-RED):** for both answer files run
  `py -3 -X utf8 -c "import json,sys; a=json.load(open(sys.argv[1],encoding='utf-8')); sys.exit(1 if any('rule_id' in e or not str(e.get('token','')).startswith('R') for e in a) else 0)" <file>`
  → exit 0 required. Answers speak in tokens only; an answer that names a real rule_id proves the
  classifier looked things up — the round is VOID, recorded as failed in the ledger, and the next
  round number/seed is used with a fresh sample.

- [ ] **Step 6: Route on verdict** — PASS → commit the round directory + ledger
  (`git add docs/process/rule-coverage/criterion && git commit -m "feat(criterion arc, Task 4): round-1 measured — <N>/20 <VERDICT>"`)
  and proceed to Task 6 (Task 5 is then skipped and its H9 line says so). FAIL → commit the same
  evidence, proceed to Task 5. Either way the owner is shown the result in the task summary
  (§10.6) — a FAIL is a finding, not an embarrassment.

---

### Task 5: Revision rounds — ceiling 3 revisions, then the boundary-blur report

**Files:**
- Modify: `docs/process/rule-coverage/criterion/criterion.md` (append `## גרסה N` per revision)
- Create per round: `rounds/round-{2,3,4}/…` (same shape as round-1)
- Create only on final stop: `docs/process/rule-coverage/criterion/boundary-blur-report.md`

**Can run unattended:** yes (revising the criterion's WORDING to remove an ambiguity is method
work; it changes no rule and waives nothing — but a revision that would change a question's
ROUTING, contradicting spec §1's procedure, is a spec change and goes to the owner in conversation
first, §4).

**The ceiling: at most 3 revisions — 4 measurements total (`MAX_MEASUREMENTS = 4`, already enforced
in code by the Task 2 sampler). Justification, twofold, so the number is not arbitrary:**
1. **Pool arithmetic makes a 5th measurement impossible without breaking the spec.** Fresh samples
   of exactly 20 from a pool of 95 permit at most ⌊95/20⌋ = 4 disjoint draws (after 4, only 15
   unmeasured rules remain; the spec's DoD-3 forbids re-measuring a used sample, and shrinking the
   sample would silently redefine the threshold — "85% of 15" is not a quantity the approved spec
   defines). So 4 is not chosen; it is the maximum the spec permits.
2. **It matches the project's own 3-fix rule (discipline §5):** three failed revisions of the same
   criterion is precisely the moment the discipline defines as "stop and question the
   architecture" — here the architecture is the A/C boundary itself, and spec §5 already names the
   deliverable at that moment: WHERE the boundary blurs, not an eleventh sub-clause.

**Per revision round K (K = 2, 3, 4), reached only if round K−1 FAILED:**

- [ ] **Step 1: Diagnose from evidence** — read round-(K−1)'s disagreement table. For each
  disagreement, name which question (ש1/ש2/ש3) the two classifiers answered differently and what
  ambiguity in its WORDING permitted both readings.
- [ ] **Step 2: Revise the criterion** — append `## גרסה K — <date>` to `criterion.md`: the changed
  wording plus one line per change citing the disagreement (round, token, rule_id) that forced it.
  Tightenings only — a revision that adds a sub-clause per disagreement is the spec-§5 smell; if a
  revision needs more than 2 new clauses, say so in the round commit as a boundary-blur signal.
- [ ] **Step 3: Fresh sample** — `py -3 scripts/criterion_sample.py --round K --seed K`. The
  sampler refuses reused round numbers, `K > 4`, and pool < 20 (all Task 2-tested); a refusal at
  this step IS the stop condition — go to the stop block below.
- [ ] **Step 4: Repeat Task 4 Steps 2–6 verbatim for round K** — fresh classifier subagents, never
  ones from a previous round (their context holds old samples and old reasoning).

**The stop block — fires when round 4 FAILS, or the sampler refuses on pool < 20:**

- [ ] Write `docs/process/rule-coverage/criterion/boundary-blur-report.md` for the owner, in
  Hebrew, containing exactly: (1) all measured rounds — seed, criterion version, agreements/20;
  (2) every disagreement across all rounds grouped by the QUESTION it split on, with both readings
  and both reasons; (3) the named blur zone(s) — stated as WHERE the boundary is genuinely
  blurred, per spec §5's own words ("הדיווח לבעלים הוא 'היכן הגבול מטושטש'", not another clause);
  (4) the explicit line: **the arc STOPS here; no rule is reclassified; the 95 keep their current
  groups until the owner rules.** Commit, update `docs/STATUS-BOARD.md`, end the arc with the H9
  table. Tasks 6–8 do not run.

---

### Task 6: The apply pass — all 95 rules, both classifiers, still blind

**Precondition (structural, not prose):** a `rounds/round-N/result.md` containing `VERDICT: PASS`
exists. Task 7's preparer re-checks this itself; this task also does not start without it.

**Files:**
- Create (by running CLIs): `docs/process/rule-coverage/criterion/apply/` —
  `chunk-{1..5}-packet.md`, `chunk-{1..5}-mapping.json`, then merged `answers-alpha.json`,
  `answers-beta.json` (95 entries each, tokens S01–S95), `agreement.json`.

**Can run unattended:** yes — classification opinions are produced; nothing is applied, and the
outputs land in draft files the existing CLI will refuse until the owner's date exists.

- [ ] **Step 1:** For K = 1..5: `py -3 scripts/criterion_sample.py --apply --chunk K` (5 × 19 = 95
  — ALL of C ∪ `none`, including rules used in measurement rounds: spec §3 says all 95 are
  reclassified by both classifiers under the passing criterion, uniformly).
- [ ] **Step 2:** Per chunk, dispatch classifier ALPHA and BETA exactly as Task 4 Step 2 (same
  prompt with tokens S…, `model: "fable"`, effort HIGH, no tools, packet inline, both calls in one
  message) — chunks run **sequentially**, one pair at a time (§10.5a), fresh subagents per chunk.
  The controller saves each pair to `apply/chunk-K-answers-{alpha,beta}.json`, runs the Task 4
  Step 5 contamination check on each file, then merges the five chunks into the two 95-entry
  answer files with
  `py -3 -X utf8 -c "import json; [open('docs/process/rule-coverage/criterion/apply/answers-%s.json'%w,'w',encoding='utf-8').write(json.dumps(sum((json.load(open('docs/process/rule-coverage/criterion/apply/chunk-%d-answers-%s.json'%(k,w),encoding='utf-8')) for k in range(1,6)),[]),ensure_ascii=False,indent=1)) for w in ('alpha','beta')]"`
  (command pasted with its output in the task record).
- [ ] **Step 3:** `py -3 scripts/criterion_compare.py --apply` → `apply/agreement.json` with
  per-rule routing: `agreed` (group match) vs `disputed`, plus `mechanism_conflicts`. Paste the
  headline counts (e.g. "agreed 84, disputed 11"). **COUNTER-RED:** delete one chunk's answers in
  a scratch copy and observe the `--apply` comparer refuse (exit 1 — "expected 95 tokens, found
  76") — a lost chunk must be a said error, never 76 silently-processed rules. Paste the refusal.
- [ ] **Step 4:** Commit:
  `git add docs/process/rule-coverage/criterion/apply && git commit -m "feat(criterion arc, Task 6): 95 rules dual-classified blind — N agreed, M disputed"`.

---

### Task 7: Batch preparation — drafts the CLI will refuse until the owner speaks

**Files:**
- Modify: `src/rules_store/criterion.py` (add `prepare_batches`)
- Create: `scripts/criterion_prepare_batches.py`
- Create (by running it): `docs/process/rule-coverage/batch-08.md` … up to `batch-17.md` (≤10
  entries each; numbering continues arc 1's batch-07), and
  `docs/process/rule-coverage/criterion/disagreements-for-owner.md`
- Test: `tests/test_criterion_batches.py`

**Interfaces:**
- Consumes: `apply/answers-alpha.json`, `apply/answers-beta.json`, the 5 chunk mappings,
  and `classify.validate_batch` (imported, unmodified) as the draft self-check.
- Produces:

```python
def prepare_batches(alpha: list[dict], beta: list[dict], mapping: dict[str, str],
                    start_batch: int = 8) -> tuple[list[dict], list[dict]]:
    """(batches, disputed). Each batch dict is the exact ```json``` payload for a batch file:
    {"batch": n, "approved_by_owner": None, "entries": [...]} with len(entries) <= 10 — never
    more, never a date. Entry fields come from the AGREED verdict: group A/B -> rule_group +
    alpha's mechanism/mechanism_target (a mechanism conflict is carried into the batch prose,
    both proposals shown; the owner's batch approval decides); group C -> rule_group "C",
    mechanism None, mechanism_target None (matches the corpus convention: only A/B carry a
    mechanism — measured 9.8.26: all 56 current C rows have mechanism NULL); group "none" ->
    rule_group "none", mechanism "none", cost + importance (alpha's text; beta's appended after
    " · " when different). disputed = rules whose groups differ, each carrying both full answers.
    Raises ValueError on a none-entry lacking cost/importance rather than inventing one."""
```

- CLI: `py -3 scripts/criterion_prepare_batches.py` — **first greps the passing verdict:** refuses
  with exit 1 ("no measurement round has VERDICT: PASS — the criterion is unproven; application is
  forbidden (spec §2)") unless some `rounds/round-N/result.md` contains `VERDICT: PASS`; the
  criterion directory is taken from env var `RULE_COVERAGE_CRITERION_DIR`, defaulting to
  `docs/process/rule-coverage/criterion`, exactly so this refusal stays testable against an empty
  scratch directory. This is requirement "measurement before application" made structural: the
  generator of the application artifacts cannot run before the measurement passes. Then it writes
  the batch files in the arc-1 shape (proposal table with both classifiers' reasons, mandatory
  `## הורדות מוצעות` section — every entry landing `none` listed with cost vs importance, or the
  literal line `אין הורדות מוצעות במנה זו` — and exactly one ```json``` fence) and the
  disagreements file (both readings + both reasons per rule, DoD-5). Finally it self-checks every
  generated draft through `classify.validate_batch` against current Postgres state (same
  `_load_current` query as `classify_rules.py`) and asserts the ONLY error on each draft is the
  missing `approved_by_owner` — proving each draft is one owner sentence away from applying, with
  no other latent refusal waiting to burn an approval.

**Can run unattended:** yes — drafts only. **The one thing it can never do:** write anything but
`null` into `approved_by_owner`. That is under test.

- [ ] **Step 1: stub** — `prepare_batches` returning `([], [])`.

- [ ] **Step 2: failing tests**

```python
# tests/test_criterion_batches.py
import pytest
from src.rules_store import classify, criterion
from tests.test_criterion_compare import _full, MAP   # reuse the answer factories

def test_agreed_rules_split_into_batches_of_at_most_ten_with_null_approval():
    alpha = _full(["C"] * 20); beta = _full(["C"] * 20)
    batches, disputed = criterion.prepare_batches(alpha, beta, MAP, start_batch=8)
    assert disputed == []
    assert [b["batch"] for b in batches] == [8, 9]
    assert all(len(b["entries"]) <= 10 for b in batches)
    assert all(b["approved_by_owner"] is None for b in batches)   # NEVER a date
    assert sum(len(b["entries"]) for b in batches) == 20

def test_disputed_rules_are_withheld_with_both_readings():
    alpha = _full(["C"] * 20)
    beta = _full(["C"] * 19 + ["none"])
    batches, disputed = criterion.prepare_batches(alpha, beta, MAP)
    assert sum(len(b["entries"]) for b in batches) == 19          # the disputed one is NOT applied
    assert disputed[0]["rule_id"] == "L20"
    assert disputed[0]["alpha"]["group"] == "C" and disputed[0]["beta"]["group"] == "none"

def test_none_entries_carry_cost_and_importance_and_drafts_are_one_approval_from_valid():
    alpha = _full(["none"] * 20); beta = _full(["none"] * 12 + ["C"] * 8)
    batches, _ = criterion.prepare_batches(alpha, beta, MAP)
    current = {f"L{i}": "none" for i in range(1, 21)}
    assert sum(len(b["entries"]) for b in batches) == 12
    for b in batches:
        for e in b["entries"]:
            assert e["rule_group"] == "none" and e["mechanism"] == "none"
            assert e["cost"].strip() and e["importance"].strip()
        errors = classify.validate_batch(b, current)
        assert len(errors) == 1 and "approved_by_owner" in errors[0]   # the ONLY missing thing

def test_a_verdict_maps_group_mechanism_and_target():
    alpha = _full(["A"] * 20); beta = _full(["A"] * 20)
    batches, _ = criterion.prepare_batches(alpha, beta, MAP)
    e = batches[0]["entries"][0]
    assert (e["rule_group"], e["mechanism"], e["mechanism_target"]) == \
        ("A", "pretooluse:Bash", "git commit")
```

- [ ] **Step 3: RED observed** — all four fail on value assertions vs `([], [])` (e.g.
  `[] == [8, 9]`). Paste. **COUNTER-RED:** `test_disputed_rules_are_withheld_with_both_readings`
  (a disputed rule must NOT be applied) and the `approved_by_owner is None` assertion (a date must
  NOT appear) are the counter-reds; additionally, after implementing, run
  `$env:RULE_COVERAGE_CRITERION_DIR = "<scratchpad empty dir>"; py -3 scripts/criterion_prepare_batches.py`
  → exit 1, the no-PASS refusal message pasted (then unset the env var).

- [ ] **Step 4: Implement**, then run the real CLI once. Paste: the list of generated batch files,
  entries-per-batch, the disputed count, and the self-check line ("every draft: 1 error,
  approved_by_owner only").

- [ ] **Step 5: GREEN + suite + commit**

```
py -3 -X utf8 -m pytest tests/test_criterion_batches.py -q
py -3 -X utf8 -m pytest tests/ -q
npx playwright test
git add src/rules_store/criterion.py scripts/criterion_prepare_batches.py tests/test_criterion_batches.py docs/process/rule-coverage/batch-*.md docs/process/rule-coverage/criterion/disagreements-for-owner.md
git commit -m "feat(criterion arc, Task 7): batch drafts one approval away — disputed withheld, approval always null"
```

---

### Task 8: Owner approval and application — the task that CANNOT run unattended

**Files:**
- Modify (date only, per approved batch): `docs/process/rule-coverage/batch-08.md` …
- Modify (by the applier): Postgres `rule_revisions` + `rules.sqlite` via
  `scripts/classify_rules.py` — **unchanged machinery**.

**Can run unattended: NO — explicitly.** Every batch requires the owner's approval **in
conversation** before its `approved_by_owner` is set. There is no batch-approval shortcut and no
"approve all ten" unless the owner himself says exactly that; a controller who infers, bundles, or
pre-fills a date has violated §4 and the reason the CLI refusal exists. If the owner is absent,
this task WAITS — the arc's unattended portion ended at Task 7.

Per batch N (8 … up to 17), sequentially:

- [ ] **Step 1:** Show the owner batch N's proposal table, its `## הורדות מוצעות` section (every
  demotion with cost vs importance — the owner's binding caveat "אם הוא חשוב אז גם אכיפה יקרה
  יכולה להיות שווה" is answered per rule, never assumed), and any mechanism conflicts with both
  proposals. Rules moving INTO A or B are called out by name — each one grows arc 2, and spec §3
  says the owner hears it now, not at the end.
- [ ] **Step 2 (RED, once, before the first approval):**
  `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-08.md --dry-run` → expected
  **REFUSED, exit 1**, the `approved_by_owner` error printed. Paste. This is the observed proof
  that the gate holds on the real files, not only in unit tests. **COUNTER-RED:** after the date
  is filled in Step 3, the same `--dry-run` prints the would-be changes and exits 0 — the gate
  distinguishes, it doesn't just block.
- [ ] **Step 3:** Only after the owner's explicit approval of batch N: edit that one batch file's
  `"approved_by_owner": null` → `"approved_by_owner": "<the actual date of the actual approval>"`,
  then `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-NN.md` → paste the
  `applied … regrouped …` output. Commit:
  `git add docs/process/rule-coverage/batch-NN.md rules.sqlite && git commit -m "feat(criterion arc, Task 8): batch NN applied — owner approved <date>"`.
  An owner rejection or amendment of an entry: edit per his words, re-run `--dry-run`, re-present;
  a rejected entry moves to the disagreements file for his ruling — it does not silently vanish.
- [ ] **Step 4 (after the last batch):** `node scripts/check-rule-coverage.mjs` — paste the full
  output. The coverage denominator (A+B count) has changed; if the gate reports a regression
  because a formerly-covered rule left A/B **under an owner-approved batch**, run
  `node scripts/check-rule-coverage.mjs --update-baseline` and cite that batch's approval in the
  commit message — this is the README's own sanctioned path (the baseline updates only AFTER the
  owner approved the coverage change, which he did, per batch, in Step 3).
- [ ] **Step 5:** Present `disagreements-for-owner.md` (both readings + both reasons per disputed
  rule — spec DoD-5) to the owner for per-rule rulings; rulings given become one final batch file
  (`batch-18.md` if needed, same Steps 1–3). Disputed rules with no ruling yet keep their current
  groups and are listed in the STATUS-BOARD gap ledger — nothing unlanded (H8).

---

### Task 9: Arc close — DoD walk, deltas, deposits

**Files:**
- Modify: `docs/STATUS-BOARD.md`, `docs/ROADMAP-2026-07-30.md` (arc status), discipline §11 if
  lessons emerged.

**Can run unattended:** yes, except that the arc-2 size delta and the L75/L76 question are decision
inputs PRESENTED to the owner, and the summary is shown per §10.6.

- [ ] **Step 1: DoD walk against spec §4, line by line, evidence quoted:**
  (1) criterion written, one file → `criterion.md` + its content test; (2) agreement ≥85% on 20,
  measured and PASTED → `rounds/round-N/result.md`; (3) any failed round re-measured on a FRESH
  sample → the ledger's disjoint `drawn` lists, checked mechanically:
  `py -3 -X utf8 -c "import json; r=json.load(open('docs/process/rule-coverage/criterion/measured-ids.json',encoding='utf-8'))['rounds']; ids=[i for x in r for i in x['drawn']]; print('DISJOINT' if len(ids)==len(set(ids)) else 'OVERLAP — DoD-3 VIOLATED')"`
  → `DISJOINT` pasted; (4) all 95 reclassified in approved batches → the applied-batch commits +
  the mirror count query pasted
  (`py -3 -X utf8 -c "import sqlite3; print(sqlite3.connect('rules.sqlite').execute('select rule_group, count(*) from rule_revisions group by rule_group').fetchall())"`);
  (5) disagreement list delivered to the owner with both readings → Task 8 Step 5; (6) arc-2 size
  delta measured and reported → next step.
- [ ] **Step 2: Arc-2 delta:** paste before (A=27, B=19, C=56, none=39, NULL=2 — measured 9.8.26)
  vs after from the same query, plus `check-rule-coverage.mjs`'s new "N of M covered" line. State
  plainly: arc 2's implementation queue grew/shrank by X rules; arc 4's judge queue is now Y.
- [ ] **Step 3:** Flag **L75, L76** (NULL `rule_group`, post-spec arrivals, outside this arc's 95)
  to the owner as a one-batch follow-up decision.
- [ ] **Step 4:** `node scripts/check-meta.mjs` green, pasted. `python scripts/ingest.py --scope`
  (the new criterion/ docs enter the geniza), `node scripts/check-geniza-fresh.mjs` green. Lessons
  → discipline §11 (at minimum: what the blind-measurement mechanics taught, and round-1's
  agreement number as the calibration datum). Update `docs/STATUS-BOARD.md` (H10), end with the H9
  table. Docs commit via
  `bash scripts/sync-docs.sh "criterion arc closed — 95 rules reclassified under a measured criterion"`.

---

## Self-review (performed; findings folded in)

- **Spec coverage:** §1 criterion → Task 1; §2 two independent classifiers, fable/high, blind,
  85% = ≤3/20, fresh samples, measure-before-apply → Tasks 2–5 (structural: sampler refusals +
  preparer's PASS-grep); §3 all-95 by both classifiers, ≤10-entry batches with per-batch owner
  approval via the existing machinery, disputed withheld to an owner list, A/B growth reported at
  batch time → Tasks 6–8; §4 DoD 1–6 → Task 9 walk; §5 blur report → Task 5 stop block. No spec
  line waived, deferred, or narrowed.
- **Type consistency:** `prepare_batches` consumes the same answer-dict shape
  `validate_answers`/`compare_answers` define (Task 1 schema); `classify.validate_batch(batch,
  current)` signature confirmed against `src/rules_store/classify.py:49`; `MAX_MEASUREMENTS = 4`
  is defined in Task 2 and cited by Task 5; token prefixes R (rounds) vs S (apply) are consistent
  across Tasks 2/4/6.
- **Placeholder scan:** no TBD/TODO/"similar to Task N"; every command, path, seed, size, and
  threshold is literal.
