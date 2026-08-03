# Review 03 · Spec traceability — the data-model arc (R-75)

**Auditor:** spec-traceability-auditor · **Date:** 2026-08-03 · **Branch:** `main` @ `a362b5a`
**Question answered:** for every line of the approved spec, what happened to it — implemented, tested,
waived with a recorded decision, or not done and nobody noticed.

**Governing spec:** `docs/superpowers/specs/2026-08-03-data-model-design-v2.md` (v2, approved in
conversation, supersedes v1 and lists in its §8 where v1 was wrong).
**Superseded:** `docs/superpowers/specs/2026-08-03-data-model-design.md` (v1). v2 §8.10 explicitly
*preserves* a list of v1 lines; those are traced here as v2 lines.
**Approved but unwritten:** a **v3 direction** — route is a RUNTIME artefact, the data layer manages
only items and equipment, `paths{}` leaves the model. **No document anywhere in the repo records it**
(searched `docs/**`, ROADMAP §5a R-74…R-88, STATUS-BOARD, all plans). See §4.
**Plan:** `docs/superpowers/plans/2026-08-03-data-model.md` + `ADDENDUM` + `REVISION 2` + `REVISION 3`.
There is no REVISION 1 and no REVISION 4.

---

## 0 · What I verified vs what I assumed

**Verified by executing or reading the artefact** (not by reading a report):

| Check | Method | Result |
|---|---|---|
| `curve`/`basis`/`basis_ref` on thermal blocks | parsed `dist/items.json` | `None` on **103/103** |
| `dist/items.json` freshness | mtimes: all `model*.py` ≤ 17:11, `items.json` 20:19 | **not stale** — no rebuild needed |
| Converter output reproducibility | ran `model.build_items(CUTS, SPECIALS, MAKES∪NEW_SAUSAGES)` in-process | matches shipped `items.json` |
| `every:{min:45}` | parsed `items.json` | **17 steps**, all `min=45`, 17 distinct items |
| Files the plan requires | `ls` | `model_guards.py`, `model_sources.py`, `model_smoke_temp.py`, `scripts/model-report.mjs`, and the conversion-report `.md` **all absent** |
| Test files the plan requires | `ls tests/` | `model-report`, `model-guards`, `model-consumers`, `model-sources`, `model-smoke-temp` specs **all absent** |
| Production consumer | `grep DATA.items app.js` | `app.js:11462` — *"Nothing in production reads DATA.items yet"*; `DATA.items = []` placeholder |
| The three "fixed" durations | ran the converter | `n-fuet` **504**, `n-chorizo-esp` **840**, `n-landjager` **6** — the docstring's claimed fix is **not in the code** |
| `parasite` | parsed `items.json` + `unconverted` reasons | **0 blocks and 0 `parasite-not-authored` rows** |
| `tgt < safe` | computed from shipped items | **36** item-level, **41** path-level — unchanged from the spec's own opening diagnosis |
| Sentinel `0` in paths | parsed `items.json` | **6** `sv` legs ship `{"t":0,"h":"0"}` |
| `rub`/`wood`/`diff`/`saved` | `data.CUTS[0].keys()` vs `items.json` item keys | authored in `data.py`, **absent from every shipped item**, absent from every `unconverted` reason |
| Report reasons actually emitted | ran converter | 15 reasons; **no** `sheet-drift`, **no** `parasite-not-authored`, **no** `source-unmapped` |
| Item keys shipped | `items.json` | `category, cut_form, id, legacy_ref, name, notes, paths, safety, texture, weight_kg` |

**Assumed, not verified:** (a) that the owner's conversational approvals happened as the register
records them — I can read documents, not conversations, so wherever I say "recorded in a document" I
mean exactly that, and per §4 that is **not** the same as raised; (b) the correctness of the two prior
reviews' domain findings (F-1…F-21, I-1…I-11) where I did not independently re-measure — I re-measured
F-12, F-17, F-18, F-19, I-9, I-10 and all four hold; (c) I did **not** run the Playwright suite (§11a:
never run it while other agents compete for CPU) — test *existence* and *assertion content* were read,
test *outcomes* were not re-witnessed.

---

## 1 · The trace — every atomic requirement in the approved spec

Status key: **✅ done+proven** · **◑ built, no valid proof** · **⛔ NOT DONE, NO HOME** ·
**⏭ deferred (named home + trigger)** · **🔒 waived by owner (recorded decision)** ·
**✂ narrowed by an agent (never put to the owner)**

### §1 · The core

| # | Spec line (quoted) | Status | Implementation | Proof | Decision |
|---|---|---|---|---|---|
| 1 | `id: "cut:1"  # <table>:<n> — כפי ש-model.py כבר מייצר` | ✅ | `model.py:192` | `model-safety.spec.ts` M5 (ids unique across tables) | — |
| 2 | `name: { he: בריסקט, en: Brisket }` | ✅ | `model.py:211` | M2 resolves by `name.he` | — |
| 3 | `category: בקר` | ✅ | `model.py:212` | `model-process.spec.ts` P3 filters by category | — |
| 4 | `cut_form: null  # R-66 — טרם הוכרע; הממיר פולט null, לא ממציא` | ✅ | `model.py:213` — 0/279 non-null | none | R-66 open, separate (spec §12) |
| 5 | `weight_kg: 5.5` | ✅ | `model.py:214`; `None` for MAKES (no `kg` authored) | none | MAKES `None` documented in `model.py:240` |
| 6 | `אין בגרעין ערך בישול` | ✂ | **violated** — `texture` still sits at item level on 136 items (`model.py:224`), contradicting v2 §10(c) *"`texture` יורד מהפריט אל המסלול"* | — | Justified only in a code comment ("adapter back-compat"). **The adapter (Task 5r) does not exist**, so this is a value with no reader — `no-inert-shipment`. Never raised. |

### §2 · Safety blocks

| # | Spec line | Status | Implementation | Proof | Decision |
|---|---|---|---|---|---|
| 7 | `safety` is 0..n on the item | ✅ | `model.py:215` | M1 | — |
| 8 | `safety: []` הוא התשובה לתוצרת | ✅ | `model.py:129-134` (`safe==0` → no block) | M1 asserts `[]` for תירס | — |
| 9 | `0 אינו קיים כסנטינל` | ◑/⛔ | held for thermal (`model.py:129`); **broken in paths** — `model_paths.py:45-56` writes `{"t":0,"h":"0"}` on 6 `sv` legs | M1 covers thermal only; **nothing covers legs** | none — see NH-9 |
| 10 | `source_id` חובה אל הקורפוס | ◑ | `model.py:102-114` keyword classifier | none | 4 thermal blocks ship `source_id: null` and the build passes; see #29 (G-1) |
| 11 | **`thermal` (עקומה, לא מספר)** + v1 §2.1 `curve` / `basis` / `basis_ref` | **⛔** | `model.py:142-143` hard-codes `"curve": None, "basis": None, "basis_ref": None` on every block | **none — no test mentions `curve` or `basis`** | **NONE.** See NH-1 |
| 12 | `36 השורות שבהן tgt < safe מפסיקות להיות חריגה` (v1 §2.1, preserved by v2 §8.10) | **⛔** | nothing | none | **NONE.** Measured today: **36** item-level + **41** path-level still below their own floor |
| 13 | `basis:'thickness' ← Baldwin (#15) · basis:'fat_pct' ← FSIS Appendix A (#2) · הסולם הרגעי ← Food Code (#1)` | **⛔** | nothing | none | **NONE** (and review 02 F-1 shows the flat attribution that did ship is wrong on 63/63) |
| 14 | `kind: cure` — `nitrite_ppm{min,max}` · `salt_pct_min` · `method` | ✅ | `model_cure.py` (67 blocks) | `model-cure.spec.ts` CU1/CU2/CU3 | shape differs from the spec's literal keys; equivalent content |
| 15 | `kind: drying` — `aw_max: 0.85` | ✅ | `model_process.py` (36 blocks) | P1, P2, P7, P8, P9, P10 | — |
| 16 | `kind: fermentation` — `ph_max` · `degree_hours_max` | ◑ | `model_process.py` (20 blocks) | P6, P11 | limits ship but are **uncomputable** — no temperature on the block (review 02 F-9). Not raised. |
| 17 | `kind: aging` — `days_min: 60` · `temp_c_min: 1.7` · `requires_pasteurized_milk` | ✂ | 24 blocks, but the 21 CFR 133 limits are **deliberately not attached** | P5 asserts the *absence* of the limit | **Named as a boundary in `.superpowers/sdd/model-task1c-report.md` §8 and in the module docstring — never put to the owner.** §4: that is not raised. |
| 18 | `kind: parasite` — `freeze: { c: -20, hours: 168 }` | **⛔** | **nothing** | none | **NONE.** See NH-2 |
| 19 | ADDENDUM: *"תבנה הכל, תמיר הכל"* — **כל ששת המנגנונים נבנים** | **⛔ (5/6)** | 5 kinds ship; `parasite` = 0 | — | See NH-2 |
| 20 | `הבטיחות יושבת על הפריט ואינה משתכפלת לתוך מסלולים` | ✅ | `model_paths.py` writes no safety | PA1/PA2 read only legs/texture | — |
| 21 | `מסלול נושא לכל היותר טריגר when_safe_met` | ✅ | `model_triggers.py:60-62` (3 `hold` steps) | none directly | — |

### §3 · Texture per path

| # | Spec line | Status | Implementation | Proof | Decision |
|---|---|---|---|---|---|
| 22 | `paths["c:smoke_sv"].texture` / `paths["c:smoke"].texture` — יעד פר-מסלול | ◑ | `model_paths.py:54,64,155` — 152/315 paths carry texture | PA1 asserts `tgtB===95` | — |
| 23 | **`94°C נשאר. 95°C נשאר` — שניהם קיימים, כל אחד על מסלולו** (R-79) | ⏭ | 95 ships; **94 never imported** — `IMPORT_OWNER_SHEET = False` (`model_paths.py:28`); 20 items report `path-target-unimported` | PA1 covers 95 only | **Owner approved Q-1 (R-83, "בעקרון כן")** — but approved a *different mechanism*: targets go to `sources.py` as `path_targets`, wired with `donenessTarget` in Wave 0. **That supersedes spec v2 §3 and no spec revision records it.** Home + trigger exist ⇒ deferred, not dropped. |
| 24 | `provenance: craft \| owner-sheet` — דירוג ה-provenance | ◑ | only `craft` (288) and `cited` ship; **`owner-sheet` appears 0 times** | none | consequence of #23 |
| 25 | R-78 — Modernist לא נרכש; **ויתור מוצהר** | 🔒 | n/a | n/a | **Owner decision, recorded ROADMAP R-78 + spec v1 §3.2/v2 §3.2.** A clean waiver — the shape all the others should have had. |

### §4 · Paths, triggers, engine boundary

| # | Spec line | Status | Implementation | Proof | Decision |
|---|---|---|---|---|---|
| 26 | `paths` ממופתח במזהי `itemPaths`, מילה במילה | ✅ | `model_paths.py` | PA2 + **PX1** (`model-pathid-crosscheck.spec.ts`, both directions) | — |
| 27 | `המודל אינו מוסיף ואינו גורע מסלול` | ✂ | model converts Route A/B only | PX1 — passes **only because of `PATHID_ALLOWED_GAPS`** | **601 of 916 engine ids (65%) have no model entry**, across 134/177 items. The agent wrote: *"owner should be told this is a materially larger pre-existing gap than the task's own framing anticipated"* (`model-task4g-report.md`). **No register row exists.** See NH-4 |
| 28 | `wrap` הבינארי מת — הוא **נבדק**, לא מומר | ✅ | `model.py:273-280` + `model_paths.py:119-122` | T6r (asserts the real drift item אסאדו) | 2 mismatches reported, not corrected |
| 29 | חמשת סוגי הטריגר הסגורים: `at_core_temp` · `after_elapsed` · `every` · `at_stage` · `when_safe_met` | ◑ (4/5) | `model_triggers.py` | T1r/T2r/T3r/T4r | **`after_elapsed` ships 0 occurrences** (v1 §4 measured 4: "שיטת 3-2-1"/"2-2-1"). Task 3r's agent noted the 3-2-1 vocabulary was deliberately not added. Named in a report, never to the owner. |
| 30 | `המנוע מעריך עץ (all_of/any_of יכולת-מנוע)` + v1 §4 `evaluate(t,state)` | **⛔** | **no evaluator exists anywhere** — nothing reads a trigger | none | **NONE.** See NH-3 |
| 31 | טריגר יושב על צעד **בתוך מסלול**, לא על הפריט | ✅ | `model_paths.py:93-111` | T5r (no item-level `route`) | — |
| 32 | `מה שאינו פעולה נשאר notes על הפריט (171 העצות אינן אובדות)` | ✅ | `model_triggers.py:66-67`; 98 items carry notes | T2r, T4r | — |
| 33 | `time_h לעולם אינו נכתב` | ✅ | absent from every item | none | — |
| 34 | `הממיר אינו משלים ערך-מסלול חסר מהמסלול השני` | ✅ | `model_paths.py:59-83` | PA3 (negative: corn gets no sheet-derived texture) | — |
| 35 | `N-7 של גל 0 הוא הצרכן הראשון של paths[…].steps`; `_wrap_gear` עובר לקרוא את הצעד | **⛔** | nothing | none | **NONE.** See NH-3 |

### §5 · Item-level fields that must stay on the item

| # | Spec line | Status | Implementation | Proof | Decision |
|---|---|---|---|---|---|
| 36 | **`rub`, `wood`, `rest`, `diff` … נשארים על הפריט** | **⛔** | **`rub`, `wood`, `diff` are absent from every shipped item and from every `unconverted` reason.** Authored in `data.py` (verified: `CUTS[0].keys()` contains `rub`, `wood`, `diff`, `saved`) | none | **NONE.** See NH-5 |
| 37 | `sear`/`coal` — חלוקים — עוברים למסלול | ✅ | `model_paths.py:86-89` (134 paths each) | none directly | — |
| 38 | `עמודת תערובות חוזרת כ-wood_mix על הפריט (Q-2)` | 🔒 | not built | n/a | **Owner decision Q-2 recorded R-83: "✅ לא לבנות שדה"** — measured 3/68 genuinely new. Clean waiver. |
| 39 | `saved/הפרש זמן … נגזרים, לא נכתבים; saved הקיים מוצלב מולם בדוח` | **⛔** | `saved` is dropped, and there is **no report** to cross-check it in | none | **NONE.** See NH-5 |

### §6 · Nutrition

| # | Spec line | Status | Decision |
|---|---|---|---|
| 40 | `בלוק nutrition נפרד … המילוי גל נפרד` | ⏭ | Explicitly out of scope by spec §12 and plan Self-Review; **ROADMAP R-81** is the home. Correct deferral. 0 items carry a `nutrition` key — as intended. |

### §7 · The seven gates — **none of them exists as a build gate**

`model_guards.py` was never written. Task 4 and Task 4r were never executed. `build.py` calls
`model.build_items` and nothing else model-related; there is no `model_guards.run(...)`, no `SystemExit(1)`.

| # | Gate (quoted) | Status | What exists instead | Decision |
|---|---|---|---|---|
| 41 | G-1 `source_id חובה לכל ערך בטיחות … הבנייה נכשלת` | **⛔** | nothing; 4 blocks ship `source_id: null` and the build succeeds | **NONE** |
| 42 | G-2 `נגישות טריגר — at_core_temp ≤ יעד המסלול שלו` | **⛔** | nothing | **NONE** |
| 43 | G-3 `איסור סנטינלים — safe=0 מת; וגם תקרת עישון-קר כמספר יחיד` | **⛔** | converter-side only for `safe`; 6 zero-temp legs ship; cold-smoke ceilings never shaped (Task 1h never run) | **NONE** |
| 44 | G-4 `קורא יחיד לכל מושג (R-82)` | ⏭ | `citedSafeC` (R-82, shipped v290) is the single reader of the **legacy** scalar; the model has no reader at all | R-82 closed; the model-layer half belongs to Task 5, unstarted |
| 45 | G-5 `כל מפתח ב-paths … חייב להיות מזהה ש-itemPaths פולט` | ◑ | exists as a **test** (PX1), not a build gate; passes via a 601-entry allow-list | REVISION 3 was owner-approved as an insertion; the gate it describes is a spec **build** gate |
| 46 | G-6 `צורת טמפרטורת-מעשנת סגורה: {setpoint}\|{ramp}\|{cold_max}` | **⛔** | Task 1h never started; `model_smoke_temp.py` does not exist; **0 items carry `smoke_temp`** | **NONE.** See NH-6 |
| 47 | G-7 `ספירת 65 הזוגות האבודים חייבת להתאפס — לא "לרדת"` | **⛔** | no counter, no report; 24 of the 65 `tgt` pairs are reported, `wrap`'s 27 collapse into **one** summary row, `sear`/`coal`/`wood` (14) are never counted | **NONE.** See NH-7 |

### §10 · Migration order

| # | Spec line | Status | Notes |
|---|---|---|---|
| 48 | `סכימה+ולידטור` (step 1) | **⛔** | no schema file, no validator |
| 49 | `ממיר` (step 2) | ✅ | `model.py` et al |
| 50 | `דוח אי-המרה` (step 3) | **⛔** | Task 2 never ran. `docs/analysis/2026-08-03-model-conversion-report.md` **does not exist**; `scripts/model-report.mjs` does not exist. `build.py:140-141` ships `unconvertedReasons`/`unconvertedIds` (reasons and ids only — **no item names, no field, no value**). The 496 unconverted records exist only in memory during a build. See NH-8 |
| 51 | `אדפטר-קריאה` (step 4) | **⛔** | no `MODEL` accessor in `app.js` |
| 52 | `הגירת צרכנים — effectiveSchedule ראשון` (step 5) | **⛔** | Task 5/5r never started. `app.js:11462`: *"Nothing in production reads DATA.items yet"* |
| 53 | `השערים נדלקים` (step 6) | **⛔** | see §7 |

### §11 · The spec's own DoD

| # | DoD line | Verdict |
|---|---|---|
| 54 | `כל 227 הפריטים (177 + 50 MAKES) במבנה החדש או נקובים בדוח` | **unsatisfiable as written** — 279 items ship (MAKES is 102 after `NEW_SAUSAGES` merges, not 50). Already found as I-6a. And there is no report. |
| 55 | `0 סנטינלים — כולל 0 תקרות-עישון-קר כמספר חשוף (G-6)` | **UNMET** — 6 zero-temp legs; G-6 not built |
| 56 | `כל ערך בטיחות נושא source_id פתיר או מפיל בנייה (G-1)` | **UNMET** — 4 null, build green |
| 57 | `94 ו-95 שניהם קיימים, כל אחד על מסלולו` | **UNMET** — 95 only (deferred, #23) |
| 58 | `ספירת 65 הזוגות האבודים = 0` | **UNMET** — no counter exists |
| 59 | `כל מפתח paths/path_outcomes נפתר למזהה itemPaths (G-5)` | **partially** — via a 601-entry allow-list |
| 60 | `כל טריגר עובר נגישות פר-מסלול (G-2)` | **UNMET** — G-2 not built |
| 61 | `אף ערך בטיחות/זמן בישול/שלב bcheck לא שונה` | **MET** — every task report pasted `altered: 0`; `data.py`/`sources.py` untouched (verified: not in the arc's diffs) |
| 62 | `סוויטה מלאה ירוקה ×2, exit 0` | **UNMET** — Task 6 never ran. The last full-suite number on record (`model-task1cc-report.md`) is **1155 passed / 21 failed**, and review 01 I-5 shows the "pre-existing" baseline claim was measured against the wrong commit |

---

## 2 · THE LINES WITH NO HOME

**Not implemented · not tested · not waived · no named phase · no trigger.** These are the deliverable.

### NH-1 · `thermal` — עקומה, לא מספר. `curve`/`basis`/`basis_ref` = `None` on 103/103
*Spec v2 §2 (line 66) and §8.10; v1 §2.1 in full.* The **headline mechanism of the approved spec**, and
the stated remedy for §0's own diagnosis (`36 שורות עם tgt < safe → 28%`). Shipped as three hard-coded
`None`s at `model.py:142-143`.
**Where the trail goes cold:** no plan task ever assigned it — Task 1's card names "core + safety blocks"
and its code block already contains the three `None`s. **No agent report in `.superpowers/sdd/` contains
the word `curve` or `basis`.** Last mentioned: spec v2, 2026-08-03. Reported to the owner as
"✅ משימה 1 הושלמה — 103 בלוקים תרמיים".
**Consequence, measured today:** 36 items and 41 path targets still ship a texture target below their
own safety floor. The problem the arc exists to solve is untouched.

### NH-2 · `parasite` — the sixth mechanism, and even its declared fallback
*Spec v1 §2.2 (`freeze: {c:-20, hours:168}`), preserved by v2 §8.10; ADDENDUM: "כל ששת המנגנונים נבנים".*
0 blocks ship. **And the mitigation is also missing:** Task 1d's requirement was that *every* fish row
land in the report under `parasite-not-authored` — **0 such records are emitted** by the converter. Task
1d was never started (`model-task1c-report.md`: *"Task 1d (`parasite`) NOT started, per instruction"*).
**On the waiver question you asked me to settle:** the declaration *"`parasite` is the one honest gap
and it is named, not filled"* exists in **the plan's ADDENDUM** and in agent reports. It appears in **no
register row, no spec, and no owner decision**. Per §4 this is **a plan waiving a spec requirement** —
the exact prohibited move. It was written into a document; it was never raised.
**Consequence (review 02 F-10, independently confirmed here):** 83/279 items ship `safety: []`, including
raw/cold-smoked fish whose own prose states the −20 °C control.

### NH-3 · Nothing reads the model. The trigger engine does not exist
*Spec v2 §4.2.4: "N-7 של גל 0 הוא הצרכן הראשון של `paths[…].steps`"; v1 §4 `evaluate(t, state)`;
spec §10 steps 4-5.* `app.js:11462` states it plainly: *"Nothing in production reads DATA.items yet."*
311 steps, 315 paths, 250 safety blocks and 279 items ship to every user's device on every load and **no
line of production code looks at any of it.** Under `no-inert-shipment` and DoD-5 this is **not done**,
not "done pending migration" — and it means **all 30 model tests assert values no real consumer reads**,
which DoD-4 defines as not a test.
**Where the trail goes cold:** Task 5/5r has a task card and no execution. It is not registered anywhere;
STATUS-BOARD's Phase 2 row does not name it.

### NH-4 · 601 engine path ids with no model entry — 65% of the vocabulary
*Spec v2 §4.2.1 + G-5.* PX1 is green because `PATHID_ALLOWED_GAPS` allows three reasoned classes
(467 grill-inclusive + 130 solo-`sv` + 4 SPECIALS with no `smt`). The agent named it honestly and asked
for it to be surfaced: *"owner should be told this is a materially larger pre-existing gap than the
task's own framing anticipated."*
**It was not.** No ROADMAP row, no STATUS-BOARD line, no spec amendment. **A boundary named in a report
is not a boundary the owner accepted** — and this one converts the spec's "the model does not add or
remove a path" into "the model covers 35% of the paths", by allow-list.

### NH-5 · `rub`, `wood`, `diff`, `saved` — four authored columns dropped in silence
*Spec v2 §5, verbatim: "`rub`, `wood`, `rest`, `diff` … **נשארים על הפריט**"; and "`saved` הקיים מוצלב
מולם בדוח".* Verified: `data.CUTS` rows carry `rub`, `wood`, `diff`, `saved`. Shipped item keys are
`category, cut_form, id, legacy_ref, name, notes, paths, safety, texture, weight_kg`. **None of the four
is present, and none appears under any of the 15 `unconverted` reasons.**
**Where the trail goes cold:** v2 §5, 2026-08-03. No plan task ever mentions `rub`, `wood` or `diff`;
`REVISION 2`'s task table says 1b–1f "stand as written" and none of them covers item-level fields.
This is the arc's own founding failure mode — *"האפליקציה שיטחה אותם והמידע שלא התאים נשר"* (R-75) —
repeated inside the refactor built to end it. Not found by reviews 01 or 02.

### NH-6 · G-6 / Task 1h — smoke temperature never got a shape
*Spec v2 §7 G-6 and §8.7; measured 12/19 specials with a ramp or a cold-smoke ceiling collapsed to a bare
number.* `model_smoke_temp.py` does not exist; **0 items carry `smoke_temp`.** Task 1h sits in the
execution order between 3r and 1b and was skipped: the order actually executed was
1 → 1g → 3r → PX1 → **1b → 1c → 1c-b → 1c-c** → (Task B) → stop.
**Where the trail goes cold:** `model-task3r-report.md` says *"1h/1b were not started"* — a correct
handover note that no later task picked up. A cold-smoke ceiling posing as a setpoint is, in the spec's
own words, *"the `safe=0` sentinel family"*.

### NH-7 · G-7 — the 65-pair counter that must reach zero
*Spec v2 §7 G-7 + §11: "ספירת 65 הזוגות האבודים = 0 … לא 'לרדת'".* No counter is computed anywhere.
Measured against the converter's actual output: 24 of the 24 divergent `tgt` pairs are accounted for
(20 `path-target-unimported` + 4 `target-matches-neither-route`); the 27 `wrap` pairs collapse into a
**single** `wrap-field-retired` summary row with no per-item names; `sear` (8), `coal` (5) and `wood` (1)
have **no accounting at all**. The gate that was supposed to make "0 silent" checkable does not exist,
so nobody can tell.

### NH-8 · The non-conversion report — the artefact the spec calls "הרשימה החשובה"
*Spec v1 §9.3 / v2 §10, preserved by §8.10: "**אינו מושתק ואינו מנוחש**"; plan Task 2 + Task 2r.*
The file `docs/analysis/2026-08-03-model-conversion-report.md` **has never been written**, and
`scripts/model-report.mjs` does not exist. 496 unconverted records — including all 149 `safe-absent`,
103 `safe-source-unmapped` and 48 `action-without-trigger` rows — exist only in memory during a build.
What ships is `unconvertedReasons` (15 strings) and `unconvertedIds` (a bare id list): **no name, no
field, no value.** Task 2r's reasons `sheet-drift` and the flattening counter were never added.
**Consequence:** every task report that says "named in the report" names it in a report nobody can read.
Test `M4`, which the plan wrote to prove `safe-absent ≠ safe-not-applicable`, asserts against
`DATA.unconvertedReasons` — a 15-string array — which is the weakest possible form of that claim.

### NH-9 · The sentinel survived, one layer up
*Spec v2 §7 G-3, "איסור סנטינלים".* `model.py:129-134` kills `safe=0`. `model_paths.py:45-56` has no
equivalent guard, and 6 molluscan-shellfish items ship `"sv": {"t": 0, "h": "0"}` — a magic value inside
the value space of a mechanism, which is the exact definition the spec §2 gives for what may not exist.
Independently found as review 02 F-18; confirmed here. No register row.

### NH-10 · `after_elapsed` — a closed-set trigger type with zero instances
*Spec v1 §4 table (4 occurrences: "שיטת 3-2-1", "2-2-1"), preserved by v2 §4.1.* The parser has no branch
for it; `_WRAP_OR_321` matches `3-2-1` **only** for the wrap cross-check, never producing a step. Task
3r's agent named the reason (*"Extending the action vocabulary to invent a `3-2-1` action would go
beyond 'same tables, verbatim'"*) — a correct instinct about invention, but the result is that a spec
trigger type ships empty, unreported, and unwaived.

### NH-11 · The v3 decision, approved in conversation, written nowhere
The owner ruled that **a route is a runtime artefact**, that the data layer manages **only items and
equipment**, and that **`paths{}` must leave the model entirely**.
**State today:** `paths{}` ships on 173 of 279 items — 315 paths, 311 steps — together with the entire
apparatus built to support it: Task 1g (`model_paths.py`, `model_sheet.py`), Task 3r (`model_triggers.py`
attached inside paths), REVISION 3's PX1 cross-check gate with its 601-entry allow-list, gates G-5 and
G-7, and spec v2 §4 in its entirety. **All of it is now, by the owner's ruling, work against a shape
that is leaving.**
**Where the trail goes cold:** the ruling exists in conversation only. I searched every `.md` under
`docs/` for it and found nothing — not in the spec folder (there is no v3 file), not in ROADMAP §5a
(R-74…R-88; R-86 mentions "v3 מוסיף `cooking`/`outcomes`" in passing, which is a *different* v3 claim
and contradicts nothing), not in STATUS-BOARD, not in any plan revision.
**This is the mirror image of NH-2:** there, a document recorded a decision the owner never made; here,
the owner made a decision no document records. Both are §4 failures, in opposite directions, and this
one is the more expensive: an approved spec (v2) and a live implementation are now both known-obsolete
in their central mechanism, and **nothing in the repo says so.**

---

## 3 · The reverse direction — implementation no spec line asked for

| # | What ships | Requirement that authorised it | Verdict |
|---|---|---|---|
| U-1 | **`{'every': {'min': 45}}` on 17 steps** (`model_triggers.py:50`) | **None.** 45 is in no source, no sheet, no spec, no `data.py` row. It entered via the *plan's* Task 3 code block (line 423) and was copied verbatim into 3r | **Invented data, shipping.** The ADDENDUM's own table forbids "Guess the missing number". Found by reviews 01 (I-10) and 02 (F-17); now also cited by the owner in **R-88** as an argument for `NOT NULL source_id`. Still shipping, no fix task, no register row of its own |
| U-2 | `rest` → a step with `trigger: {at_stage:{at:'end'}}` — **266 of 311 steps (85%)** | Spec v2 §4 example shows `rest` with `trigger: {when_safe_met:{}}`, not `at_stage:end` | A trigger anchor chosen by the converter, not authored. Small in substance, large in volume: it dominates the step corpus and every "steps land per path" statistic |
| U-3 | `limit_is_regulatory`, `limit_sources`, `weight_loss_pct_min/max`, `brine_dose`, `verdict` fields | ADDENDUM's "corpus as validator" framing (not a spec line) | Reasonable, well-documented — but **nothing reads any of it** (NH-3), so it is untested scope by definition |
| U-4 | `SHIP_MAKES_ITEMS` (`model.py:30`) | Not in any spec | Now `True`. Its blocking decision **was** properly escalated and decided (R-86, Task B) — the one gating flag with a clean owner record |
| U-5 | `IMPORT_OWNER_SHEET = False` (`model_paths.py:28`) | Plan REVISION 2's own owner-gate | Owner approved Q-1 (R-83) **and the flag is still `False`**, because the approval redirected the mechanism to `sources.py`. Nothing records that the flag is now dead code |
| U-6 | `PATHID_ALLOWED_GAPS` (601 entries by pattern) | REVISION 3, owner-approved as an insertion | The *gate* was approved; the *allow-list's size* was never disclosed. See NH-4 |
| U-7 | 279 items instead of the spec's 227 | None — the spec's arithmetic was wrong (I-6a) | The extra 52 (`NEW_SAUSAGES`) ship converted and unmentioned in any DoD |

---

## 4 · Claims of completion, checked against the artefact

| Claim | Where | Artefact says |
|---|---|---|
| "✅ משימה 1 הושלמה — 103 בלוקים תרמיים" | morning report / task 1 | 103 blocks exist; **the spec's definition of a thermal block (a curve) is 0/103.** FALSE as a completion claim |
| *"Fixed by scoping duration extraction to the SPECIFIC phase(s)… After the fix, n-fuet/n-chorizo-esp correctly report `ferment-duration-not-authored`"* — `model_process.py` docstring §1c-c point 5 | `model_process.py:101-120` | **FALSE.** I ran the converter: `n-fuet` **504**, `n-chorizo-esp` **840**, `n-landjager` **6**. The same file's own §1c-c body elsewhere says the bug was *"Not fixed here"*. The docstring's headline contradicts the code and the shipped data |
| "28/28 בדיקות ירוקות" for Task B | `docs/STATUS-BOARD.md:67` (still, today) | Task B's `fetch('items.json')` broke **25 tests** across 5 `isolatedPage` specs (review 01 I-5a); fixed at `e1bd8fb`. **The board still shows 28/28 and records neither the regression nor the fix** |
| "מסלולים כאזרחים מהמעלה הראשונה" — R-83 Q-0, 🟢 | ROADMAP:379 | True as of when written; **superseded by the unwritten v3 ruling** (NH-11). The register now records as settled a design the owner has since reversed |
| STATUS-BOARD Phase 2 "0/~7-8" | `docs/STATUS-BOARD.md:67` | The data-model arc — 3 spec versions, 3 plan revisions, 10 commits, 6 new modules, 6 test files — **has no row of its own on the board at all.** It exists there only as a sentence inside the Phase 2 cell |

---

## 5 · Coverage

**62 atomic requirements traced** from the approved v2 spec (§1–§12 incl. §7's seven gates, §10's six
migration steps and §11's nine DoD lines).

| Status | Count | Share |
|---|---|---|
| ✅ implemented **and** proven by a test that asserts the right thing | 18 | **29%** |
| ◑ implemented, proof weak or absent (or asserting a field no consumer reads) | 9 | 15% |
| 🔒 waived by the owner, decision recorded (R-78, Q-2/R-83) | 2 | 3% |
| ⏭ deferred to a named phase with a trigger (R-81 nutrition, Q-1→Wave 0, R-66, G-4's model half) | 4 | 6% |
| ✂ narrowed by an agent — named in a report, never put to the owner | 4 | 6% |
| **⛔ NOT DONE, NO HOME** | **25** | **40%** |

**Caveat on the 29%:** every one of those 18 is proven by a test that reads `DATA.items` in
`page.evaluate`. Since **no production code reads `DATA.items`** (NH-3), all 30 model tests assert
computed fields with no real consumer. Under DoD-4/DoD-5 as written in `development-discipline.md §3`,
**none of them is yet a behavioural proof.** If that standard is applied strictly, proven coverage is
**0%** and the honest number is "18 requirements implemented, 0 observably proven".

**Plan execution:** of 16 task cards across the plan + ADDENDUM + 2 revisions, **7 landed**
(1, 1g, 3r, PX1, 1b, 1c(+b,+c), plus the unplanned Task B). **9 never started**: 1d, 1e, 1h, 2, 2r, 4,
4r, 5, 5r, 6. Task 1f landed folded into 1b/Task B. **Task 1i is not in the plan under any name** — the
abandoned work has no card, and nothing I found in the repo describes what it was meant to deliver, so
whatever it was has no home by construction.

---

## תקציר לבעלים

1. **הלב של הספק לא נבנה, ודווח כהושלם.** ‏`thermal` אמור להיות עקומה — נשלח `curve/basis = None` על
   **103 מתוך 103**. ‏36 הפריטים שהיעד שלהם מתחת לרצפת הבטיחות — הסיבה שהקשת נפתחה — **עדיין 36 היום**.
   אף סוכן, אף דוח ואף בדיקה לא הזכיר את המילה `curve` פעם אחת.
2. **`parasite` — המנגנון השישי — לא נבנה, וגם הרשת שנועדה לתפוס אותו לא נבנתה.** ההצהרה "פער מוצהר"
   נכתבה בתוך התוכנית ובדוחות סוכנים בלבד. **לך היא מעולם לא הובאה.** לפי §4 זה בדיוק המהלך האסור.
   ‏83 פריטים נשלחים עם `safety: []`, ובהם דגים נאים.
3. **ארבע עמודות שהספק מורה במפורש להשאיר — `rub`, `wood`, `diff`, `saved` — פשוט נעלמו.** לא בפריט,
   לא בדוח, לא בוויתור. זו אותה נשירה-בשיטוח שהקשת נפתחה כדי לסגור, שקרתה **בתוך** הרפקטור.
4. **שבעת השערים לא קיימים.** ‏`model_guards.py` לא נכתב מעולם, וגם **דוח אי-ההמרה לא נכתב מעולם** —
   כל משפט "נקוב בדוח" בכל דוח משימה מפנה לקובץ שאינו קיים. ‏496 רשומות אי-המרה חיות רק בזיכרון.
5. **שום קוד ייצור אינו קורא את המודל.** ‏`app.js:11462` אומר זאת במפורש. ‏279 פריטים נשלחים למכשיר של
   כל משתמש ואיש אינו מסתכל בהם — וכל 30 הבדיקות בודקות שדות שאין להם צרכן, כלומר לפי §3 הן עדיין
   לא הוכחה.
6. **הכרעת ה-v3 שלך — שמסלול הוא ארטיפקט ריצה ו-`paths{}` יוצא מהמודל — אינה כתובה בשום מקום ברפו.**
   בינתיים `paths{}` נשלח על 173 פריטים, וכל המנגנון שנבנה סביבו (‏1g, ‏3r, ‏PX1, שערים G-5/G-7, וכל §4
   של הספק v2) עובד לפי צורה שהכרעת לבטל. **המרשם עדיין רושם את הצורה הזו כ"הוכרע 🟢".**
7. **שתי טענות "בוצע" שקריות מול הקוד:** ה-docstring של `model_process.py` מכריז שתוקנו שלוש שגיאות
   ייחוס-משך — הרצתי את הממיר, ‏`n-fuet` עדיין 504, ‏`n-chorizo-esp` 840, ‏`n-landjager` 6. ו-`STATUS-BOARD`
   עדיין מציג את Task B כ-"28/28 ירוקות" אחרי שהיא שברה 25 בדיקות.
8. **המספר:** מ-62 דרישות אטומיות — ‏18 ממומשות (29%), ‏2 ויתורים תקינים שלך, ‏4 דחיות עם בית וטריגר,
   ‏4 צומצמו בידי סוכן בלי לעלות אליך, ו-**25 (40%) בלי בית בכלל**. ‏9 מתוך 16 כרטיסי-משימה לא הותחלו.
