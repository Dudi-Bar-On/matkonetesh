# Review 05 — Test Quality Audit: do the tests return value, or only cost effort?

**Date:** 2026-08-03 · **Branch:** main · **Scope:** the whole suite, emphasis on the 30 `model-*` tests
added 2026-08-02/03 · **Constraint honoured:** no test file was modified or added; the only repository
file this task writes is this report.

---

## 0 · Verdict

**The 30 model tests are green, fast, well-commented, and do not constrain the artefact they claim to
guard.** A mutation experiment run against the shipped `dist/items.json` shows that a change which sets
**every cooking safety temperature in the catalogue to 999 °C** is caught by **one assertion, about one
item, matched by its literal Hebrew name**. A change that **deletes every `paths` object from all 279
items** — the entire deliverable of Tasks 1g/3r — leaves **22 of the 25 modelled predicates green**.

The suite's problem is not thin coverage. It is a **shape** problem, repeated 30 times:

> *locate one named item → assert its literal shipped values*, or
> *filter all items → assert the filtered list is empty.*

The first shape restates the artefact. The second passes when the mechanism produces nothing at all.
Neither shape can fail when the converter degrades, which is the only failure mode this arc has actually
suffered — five times, in shipped bytes, through 1,176 green tests.

**Under this project's own DoD-5 the number of behavioural proofs among the 30 is zero**, and that is not
an interpretation: `app.js:11462` states it in the source.

---

## 1 · Method and first-hand evidence

Three independent observations, all reproducible:

**(a) The 30 tests are green.** Run directly, exit code captured without a pipe, port 8123 confirmed free:

```
npx playwright test tests/model-*.spec.ts --reporter=line ; ec=$?
30 passed (16.6s)
EXIT=0
```

**(b) PX1 prints its own coverage, and the numbers are the finding.** From that run's console output:

```
[PX1 coverage] items=177 engine-ids=916 model-ids=315 allowed-skips=601 real-failures=0
[PX1 allow-list] (467×) CUTS: grill-inclusive combo — out of current model scope
[PX1 allow-list] (130×) CUTS: solo-sv combo — out of current model scope
[PX1 allow-list] (4×)   SPECIALS: no smt in source data.py row
```

`items=177`, not 279. **`601 of 916` engine-emitted ids (65.6 %) are waived by the allow-list.**

**(c) Mutation analysis.** I re-implemented 25 of the 30 tests' data predicates in Node (the five omitted
need the live `itemPaths`/`resolveItem` engine) and ran them against mutated copies of the shipped
`dist/items.json` in the scratchpad. **The baseline fidelity check passed: all 25 reproduce GREEN against
the real artefact**, so they are green for the reason modelled here. Each mutation is a defect a converter
regression could plausibly introduce.

| Mutation (applied to all 279 items) | KILLED | **SURVIVED** |
|---|---:|---:|
| **I: every `thermal.instant_c` → 999** | **1** | **24** |
| **F: every leg temperature `t` → 0** (the shipped shellfish defect, generalised) | **1** | **24** |
| **H: fabricate `{every:{min:45}}` on every step** (the shipped defect, generalised) | **1** | **24** |
| **K: every `texture.target_c` → 40** | **1** | **24** |
| A: delete **all** `paths` | 3 | **22** |
| G: null **every** `source_id` | 3 | **22** |
| B: delete all `steps` | 2 | **23** |
| L: delete all `notes` | 2 | **23** |
| E: delete all `cure` blocks | 4 | **21** |
| J: **remove all 102 MAKES items** from the catalogue | 5 | **20** |
| D: delete all drying/fermentation/aging blocks | 8 | **17** |
| C: delete **all** `safety` blocks | 12 | **13** |

Read the top four rows again. Each is a mutation that would put a wrong number in front of a cook, and
each is caught by exactly **one** test — always because that test names one item literally (`בריסקט`),
never because a rule holds across the catalogue.

Mutation **I** deserves its own sentence: setting *every* safety temperature in the shipped catalogue to
999 °C is detected only by `M2`, which happens to check brisket's 63. The other **102 of 103** thermal
blocks are unguarded. `data-integrity.spec.ts` does not help — it asserts range bounds on `DATA.cuts`,
the converter's **input**, which mutation I leaves untouched.

---

## 2 · Findings, ranked by what could reach a user

### R1 — A wrong safety temperature in the item model reaches the artefact undetected (102 of 103 blocks)

`M2` is the suite's only assertion on a thermal value, and it is item-literal. There is **no invariant**
of the form "every `thermal.instant_c` lies in the physical safety band", "every item's `instant_c`
equals the `safe` value of its own source row", or "no item's `texture.target_c` sits below its own
`instant_c` without a curve". All three exist as shapes elsewhere in this repo — `data-integrity.spec.ts`
already asserts `safe ∈ [50,75]`, `svt ∈ [40,90]`, `smt ∈ [80,260]` across **all 130 cuts**. **The project
already owns the right test shape and simply did not apply it to the new artefact.** That is the single
most actionable gap in this report and it is roughly an hour of work.

*Mitigation today:* nothing in production reads `DATA.items`, so R1 is latent, not live. It becomes live
on the day a consumer lands — which is exactly the day the suite will be trusted to have guarded it.

### R2 — DoD-5 is violated by all 30 tests, and the source code says so

```
app.js:11462  // Nothing in production reads DATA.items yet (consumer migration is a later
app.js:11463  // task) — the model-* specs are the real, exercised consumer of this load path
app.js:11464  // until then (docs/process/skills/no-inert-shipment/SKILL.md).
```

Verified by grep: the only `DATA.items` references in `app.js` are the three lines that *write* it.
`DATA.unconvertedReasons` — asserted by `M4` and `T6r` — is written by `build.py:140` and read by
**nothing** in `app.js`. So all 30 tests assert on one of two fields with zero production readers.

The comment cites `no-inert-shipment` as cover. It is the inversion of that skill. The skill exists
because a mechanism shipped that nothing invoked; naming the test as the consumer makes the test the
only thing keeping the mechanism alive, which is the definition of inert shipment with a green tick
attached. This is **L42 exactly** — "three tasks green, feature dead" — recurring one arc later, and
**L45**: these tests are green, and the mechanism that makes them green is `JSON.parse` of a file the
product never opens.

### R3 — Four of the five shipped defects have no test shape anywhere in the suite

| Defect (all confirmed present in `dist/items.json` today) | Test shape that would catch it | Exists? |
|---|---|---|
| `{'every':{'min':45}}` fabricated on **17** steps | *Every trigger's origin traces to a token in the source row's prose; the trigger vocabulary is closed and each member is derivable.* | **No — and `T4r` pushes the opposite way.** See R4. |
| `rub`/`wood`/`diff`/`saved` dropped from **all 279** items | *Every authored column in `data.py` is either present in the item model or named in `unconvertedReasons` with a reason.* A completeness ledger over the input columns. | **No.** No test mentions any of the four names. There is no column-coverage assertion of any kind. |
| `curve`/`basis` null on **103/103** thermal blocks | *At least N thermal blocks carry a `curve`; a block with `basis` set carries `basis_ref`; an item whose `tgt < safe` carries a curve or a named reason.* | **No.** The strings `curve` and `basis` appear in **zero** test files. `model.py:142` hard-codes `"curve": None, "basis": None, "basis_ref": None` — the field is a literal, not a computation. See R6. |
| Three durations misattributed from unrelated phases | *A duration's value equals a number that appears in the phase it is attributed to.* Provenance-of-value, not shape-of-value. | **No.** `P8` pins `days=42/56/7` for three items — a snapshot of the output, which cannot distinguish "parsed correctly" from "parsed from the wrong phase and happens to be this number". |
| `0`-sentinel shipping as `{"t":0}` legs on six shellfish items | *No leg carries a zero or empty temperature; the sentinel is converted or reported everywhere it appears.* | **Partially, and it misses.** `M1` asserts `anyZeroAnywhere` — but scoped to `safety[].kind==='thermal'`. Legs are a different field. Confirmed in the artefact: **7 legs carry `t:0` or `t:""`** (6 shellfish + `חלומי`), all green. The commit was titled *"the sentinel dies in one place"*, and that is literally true. |

Only the **`every`** defect is even adjacent to an existing assertion, and that adjacency is adverse.

### R4 — `T4r` actively rewards fabrication

```ts
// T4r
if (!s.trigger || Object.keys(s.trigger).length===0) leaked.push(...);
expect(r.leaked).toEqual([]);   // every step has a trigger
```

This asserts that **no step may lack a trigger**. A converter that encounters prose with no stated
trigger has two options: drop the step (and fail T4r), or invent a trigger (and pass it). The shipped
artefact took the second: `{'every':{'min':45}}` on 17 steps, a value that appears nowhere in the source
prose. Mutation H confirms the mechanics — fabricating that exact trigger on **all 309 steps** in the
catalogue leaves **24 of 25** predicates green, and `T4r` among them by design.

`T2r` states the correct principle in its own comment — *"inventing a trigger for it would violate DoD
point 4"* — and then tests it for **one action on one item**. The general rule the comment articulates
was never encoded. `T4r`, the test that *is* general, encodes the opposite pressure.

This is the most serious *test-design* defect in the batch: not an absent test, but a present test whose
incentive points at the failure.

### R5 — The negative cases are mostly restatements, not negatives

DoD-6 negatives are marked in eight places. They are not equivalent:

**Genuine negatives** — they assert the mechanism fires *elsewhere* while withholding *here*, so they die
if the mechanism dies:

- `CU3` (biltong: no cure block, **but** `anyCureInCatalogue` is true) — killed by mutations C and E. ✅
- `P4` (cheese, `ייבוש` in its own prose, no drying block) and `P9` (emulsion sausages/wet pastramis) —
  real false-positive traps against real bait text. Both are guarded only by an existence check
  (`cheeseCount>0`, `it!==null`), not by "drying fires elsewhere", so both survive mutation C. Good
  intent, one guard short. ⚠️
- `P11`'s `m-droe` leg ("ללא התססה" → no fermentation block) — a real discriminating case. ✅

**Vacuous negatives** — they pass when the feature produces nothing, and one cannot fail at all:

- `M1` "every produce row carries an EMPTY safety list" — **survives deleting every safety block from all
  279 items** (mutation C). The assertion `safety === []` is satisfied by success and by total failure.
- `P3` "corn carries no drying/fermentation/aging" — same fixture, same vacuity (mutation C, D).
- `PA3` "corn carries no fabricated smoke path" — corn has **no `paths` object at all**; the predicate
  cannot fail.
- `T5r` "no item carries a populated item-level `route`" — **`route` is a key no `model*.py` file ever
  writes.** Verified by grep: zero occurrences. This asserts the absence of a field the producer has no
  code path to emit. It is unfalsifiable by construction.

So: **4 real, 2 half-guarded, 4 vacuous.** DoD-6 is satisfied in letter on all eight.

### R6 — Two assertions are tautologies over the code, not tests of it

**`M3`** — *"a tgt with no source is flagged craft, never silently promoted"*:

```python
# model.py:_texture()
"provenance": "cited" if sid is not None else "craft"
```

The predicate is `source_id == null && provenance !== 'craft'`. Since `provenance` is *assigned from*
`source_id` on the adjacent line, that conjunction is **unsatisfiable for any input data**. `M3` tests the
identity of a Python ternary. It survived mutation G (nulling every `source_id`) — the mutation that
should have been its whole reason to exist.

Measured, for context: **all 136 texture blocks ship `provenance: 'craft'` with `source_id: null`.**
Not one is `cited`. The "cited" branch has never executed in a shipped build, and `M3` cannot tell you.

**`T6r`** — asserts one string is present in `DATA.unconvertedReasons`, an array of ~10 distinct strings.
It proves a reason was emitted at least once; it says nothing about *which item*, *how many*, or whether
the right item drifted. The test's own comment names `אסאדו` as the one real case; the assertion never
mentions it.

### R7 — Coverage cliff: 22 named items carry the suite; 102 items are invisible to every universal gate

The 30 tests name **≈22 distinct items** out of 279 (**7.9 %**). Every high-value assertion in the batch is
attached to one of them.

Worse, the two tests that *are* universal both open with:

```ts
var ref = it.legacy_ref;
if (!ref) return;      // PA2 and PX1, identically
```

Measured against the shipped artefact: **all 102 MAKES items have `legacy_ref: null`.** So `PA2` and `PX1`
— the path-vocabulary gate and the engine/model cross-check, the two structurally strongest tests written
in this arc — **silently skip 36.6 % of the catalogue**. PX1's own log says `items=177`; nothing in the
test compares 177 against `DATA.items.length`, so the skip is invisible on a green run.

What sits inside that invisible 36.6 %:

| | MAKES (102 items) |
|---|---|
| with `paths` | **0** |
| with `thermal` block | **0** |
| with `cure` block | 54 |
| with **no `safety` at all** | 47 |

**102 charcuterie products — the nitrite-cured, fermented, shelf-stable category with the highest
consequence of a wrong number — ship with zero thermal blocks and zero cooking paths, and no test asserts
that they should have any.** Mutation J confirms the governance level: deleting all 102 items from the
catalogue outright leaves **20 of 25** predicates green.

Separately: `model-cure.spec.ts`'s header comment states MAKES-as-items is *"built and correct … but
gated OFF the shipped payload"*. **102 MAKES items ship today.** The comment is stale, all three
`CU*` tests pass either way, and nothing observed the gate flipping. A binary shipping decision changed
under a fully green suite without a single assertion noticing.

### R8 — The suite pins the artefact where the spec asked it to constrain the converter

Splitting the 30 by what they would survive:

**Data snapshots (would need editing if a *correct* converter improvement changed output) — 19:**
`M2, PA1, T1r, T2r, T3r, CU1, P1, P5, P7, P8, P10, P11, T6r, M1, P3, PA3, T5r, M3, M4`.
`P8` and `P10` are the purest: eleven literal numbers pinned across three items. They are useful — they
encode a genuine authored-prose→field mapping — but they constrain three of ~100 MAKES rows and cannot
generalise. Nothing checks the other ~97 parse correctly, or at all.

**Converter constraints (a rule that must hold for every input) — 6:**
`M5` (id uniqueness — real, catches a real collision class), `P2` and `CU2` (sourced-threshold /
no-false-breach, both correctly guarded with `checked > 0` so they cannot pass vacuously — **these two are
the best-designed assertions in the batch**), `PX1` (both-direction set diff — the strongest idea here,
undermined by the 65.6 % allow-list and the 102-item skip), `PA2` (vacuous when `paths` is empty), `B1`.

**Genuinely behavioural — 1, and it is not in the model files:** `service-worker.spec.ts`'s two Task B
tests. Real navigation on `isolatedPage`, real SW, real offline, cache-entry verified, and a **real
negative leg** (`route(…).abort()` → boot degrades without crashing). That is what the other 30 should
look like. It is worth noting the irony that its negative leg asserts "`DATA.items` stays empty, nothing
crashes" — an assertion that is only *correct* because nothing reads the field, and which becomes a
silent-failure signature the moment a consumer lands.

**The spec's headline mechanism is the clearest case of pinning over constraining.** Design §2.1 is
titled **"`thermal` — עקומה, לא מספר"** (*a curve, not a number*), with `curve`, `basis` and `basis_ref`
as the payload, and the stated purpose that *"36 rows where `tgt < safe` stop being an anomaly"*.
Shipped: 103/103 blocks with `curve: null`, hard-coded. Tested: `M2`, which asserts
`instant_c === 63` — **the single number the spec section exists to replace**. The suite's only thermal
assertion pins precisely the pre-spec shape.

---

## 3 · Where assurance is duplicated, and where it is absent

**Duplicated.** Safety numbers on the **legacy** structures (`DATA.cuts` / `specials` / `makes`) are
covered several times over: `data-integrity.spec.ts` (range bounds, source blocks, order-B gate),
`catalog-sweep-safety.spec.ts` (330 lines, R-69/R-82 sweep shapes), `safety-invariant.spec.ts`,
`wave0-safety.spec.ts`, `p0-safety-nums.spec.ts`, `waveCD-safety-storage.spec.ts`. The legacy layer is
well defended, and correctly so — it is what production actually renders.

**Absent — the more useful half:**

1. **Any invariant over item-model safety numbers.** 103 thermal + 136 texture blocks; the ported
   `data-integrity` range shape covers zero of them. (R1)
2. **Input→output completeness.** No test asserts that a column authored in `data.py` survives into the
   item model or is named as unconverted. Four columns vanished from 279 items silently. (R3)
3. **Provenance of a converted value.** No test asserts that a number in the model equals the number in
   the row it came from. `M2` asserts brisket's 63 is 63; nothing asserts item *N*'s value came from item
   *N*'s row. Misattribution is invisible by construction.
4. **A closed trigger vocabulary with derivation.** The artefact carries `at_stage:268`,
   `at_core_temp:23`, `every:17`, `when_safe_met:3`. Nothing constrains that set, and `T4r` pressures it
   to grow. (R4)
5. **`curve`/`basis` — asserted nowhere at all.** (R6, R8)
6. **The 102 MAKES items** — skipped by both universal gates, and no test asserts they should carry a
   path or a thermal block. (R7)
7. **A cardinality gate.** `PX1` computes `items=177` and never compares it to 279. A future change that
   drops half the catalogue from the gate's reach stays green and stays silent.
8. **The tautology check itself.** Nothing in the DoD asks "could this assertion fail for any input?" —
   which is why `M3` and `T5r` were written, reviewed, and merged.

---

## 4 · What is genuinely good, and should not be lost

- **`service-worker.spec.ts` Task B** — the only behavioural proof in the batch. Real page, real network,
  real offline, real negative leg. The model of what to copy.
- **`P2` and `CU2`** — both carry an explicit `checked > 0` / `checkedCount > 0` guard so they cannot pass
  over zero blocks. That is the exact discipline the other 23 need; it is already written, in this repo,
  by this team.
- **`PX1`'s architecture** — re-deriving the engine's own id set in the browser and diffing it as sets in
  **both directions**, with each waiver carrying a written reason rather than a growing bucket, is a
  genuinely strong design. Fix the 102-item skip and shrink the 65.6 % allow-list and it becomes the best
  gate in the suite.
- **`M5`** — id uniqueness, catching a real measured 47-way collision class. A real invariant.
- **`P4`/`P9`** — real false-positive traps against real bait text (`ייבוש` in cheese and emulsion prose).
  One guard short of excellent.
- **The commentary.** These files explain *why* far better than most production code does — including
  honest recorded refutations (`model-paths.spec.ts`'s `window.DATA` finding; the contract's own
  1.8.2026 truth-correction). That habit is worth more than the tests it annotates.

---

## 5 · Contract compliance (`TEST-AUTHORING-CONTRACT.md` §6, DoD §3)

| Requirement | Status |
|---|---|
| §1 warm-page fixture, no `addInitScript` | **Met** — all 30 use `test`/`seedApp` from `./_fixtures`. |
| §4 no `waitForTimeout` (DoD-11) | **Met** — condition waits throughout. |
| §5 exit code captured directly | **Met** in this audit; 30 passed, exit 0. |
| §6 **assert on an observable effect** (DoD-4/5) | **Not met, 30/30.** Every assertion targets `DATA.items` or `DATA.unconvertedReasons`; neither has a production reader. |
| §6 **RED before GREEN** (DoD-2) | **Unverifiable from the repo, and unfalsifiable for at least two.** `M3` and `T5r` cannot fail for any input (R6) — whatever RED was recorded for them was not a RED of the shipped predicate. |
| DoD-6 negative case tested | **Met in form, 4 of 8 in substance** (R5). |

The contract's own §6 states: *"a test that passed on its first run is void."* An assertion that cannot
fail on **any** run is the limiting case of that rule, and the gate does not currently ask the question.

---

## 6 · The five defects, answered directly

> *What kind of test would have caught each, and why does the suite not contain it?*

The honest common answer: **all five are input→output relations, and every one of the 30 tests is an
output-only predicate.** A test that reads only `dist/items.json` can check that a value is *plausible*;
it can never check that it is *the right value, from the right row, and that nothing was lost on the way*.
The one test file that does cross a boundary — `PX1`, which re-derives the engine's ids and diffs them —
is the one test whose whole architecture the other 29 should have shared. The converter has a source of
truth (`data.py`, `sources.py`, the sheet) sitting in the same repo, and not one assertion reads both
sides.

---

## 7 · Ranked list, by what could reach a user

1. **R1** — a wrong safety temperature in 102 of 103 thermal blocks reaches the artefact undetected.
   Latent only while `DATA.items` has no reader; live the day one lands.
2. **R7** — 102 charcuterie items outside every universal gate, with 0 thermal blocks and 0 paths, and no
   test that says they should have any.
3. **R4** — `T4r` rewards inventing a trigger, and the artefact took the reward 17 times.
4. **R3** — four authored columns and the spec's headline `curve`/`basis` mechanism have no test shape at
   all; both were lost silently.
5. **R2** — DoD-5 violated 30/30; the suite is the only consumer, so the model is inert by definition.
6. **R6** — two assertions that cannot fail, one of which (`M3`) covers 136 blocks that are 100 % `craft`.
7. **R5** — four of eight negatives are restatements of the positive.
8. **R8** — 19 of 30 pin output; the spec's central mechanism is pinned in its pre-spec shape.

---

## 8 · Reproducing this audit

The mutation harness is in the session scratchpad
(`…/scratchpad/mut.mjs`) — 25 predicates × 13 catalogue mutations, reading `dist/items.json` only. It
writes nothing to the repository and needs no browser. Its baseline check confirms all 25 reproduce the
real suite's GREEN before any mutation is applied.

---

## תקציר לבעלים

30 הבדיקות ירוקות — ואינן מגינות על כלום. הרצתי ניסוי מוטציה על `dist/items.json` שנשלח בפועל: **שינוי
שמעלה את כל טמפרטורות הבטיחות בקטלוג ל-999°C נתפס בידי טענה אחת בלבד, על פריט אחד (בריסקט), רק מפני
ששמו כתוב בבדיקה במפורש.** 102 מתוך 103 בלוקים תרמיים אינם מכוסים כלל. מחיקת **כל** ה-`paths` מכל 279
הפריטים משאירה 22 מתוך 25 הבדיקות ירוקות.

הבדיקות בודקות את **הנתונים**, לא את הממיר — ולכן אף אחת מחמש התקלות שנשלחו לא הייתה יכולה להיתפס: כולן
יחסים בין קלט לפלט, וכל 30 הבדיקות קוראות רק את הפלט. חמור מכך, `T4r` דורשת שלכל צעד יהיה טריגר — כלומר
היא **מתגמלת המצאה**, וזה בדיוק מה שקרה: `{'every':{'min':45}}` על 17 צעדים. שתי בדיקות (`M3`, `T5r`)
אינן יכולות להיכשל על שום קלט — הן טאוטולוגיות; `M3` "מוודאת" 136 בלוקים שכולם ממילא `craft`.

שתי שכבות שהן עיוורון גמור: **PA2 ו-PX1, שתי הבדיקות האוניברסליות היחידות, מדלגות בשקט על 102 פריטי
MAKES** (אין להם `legacy_ref`) — שהם דווקא הקטגוריה המסוכנת ביותר: מליחה בניטריט, התססה, יציבות מדף. הם
נשלחים עם **אפס** בלוקים תרמיים ואפס נתיבים, ואף בדיקה לא אומרת שצריך שיהיו. ומנגנון הכותרת של המפרט
עצמו — `curve`/`basis`, "עקומה, לא מספר" — נשלח `null` ב-103/103, והמילים `curve`/`basis` אינן מופיעות
באף קובץ בדיקה.

חומרה: המודל עדיין לא נקרא בייצור, אז זה **רדום ולא חי** — אבל ביום שיחובר צרכן, הסוויטה תיחשב כמי
שכבר שמרה על המספרים האלה, והיא לא. הצעד היחיד הכי משתלם: להעתיק את צורת הבדיקה שכבר כתובה אצלכם ב-
`data-integrity.spec.ts` (טווחים על כל 130 הנתחים) גם על `DATA.items`. שעה עבודה, וסוגר את הפער החמור ביותר.
