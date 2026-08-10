# v268 — Chrome-complete localization Implementation Plan

> **‏✅ בוצעה — סומן 10.8.26.** ‏28 הפקדות המשך · לוקליזציה v268
>
> **למה הסימון הזה קיים:** ‏`check-plan-complete` דיווח על 11 מ-34 התוכניות כפגומות. הבדיקה הראשונה
> אי-פעם של השער מול הקורפוס הקיים — הוא נבנה ב-L27 והורץ רק על מה שנכתב אחריו. **התוכניות אינן
> קטועות; הן היסטוריות, וכתובות בסגנון שקדם לדרישת בלוקי-הקוד.** רשום כ-R-119, הוכרע ע"י הבעלים
> ‏10.8.26: קו-בסיס מוצהר + סימון ביצוע, בלי שכתוב תיעוד של עבודה שכבר נחתה.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax. The **authoritative design is the approved spec**
> `docs/superpowers/specs/2026-07-26-full-localization-design-v2.md` (v3-amended) — each task cites the spec
> §; read that § for the exact contract/pseudo-code, this plan gives the task boundary, the TDD cycle, and the
> exact test/commands. Verify every code detail against `app.js`/`build.py` at HEAD.

**Goal:** Every UI chrome string (buttons, labels, panels, messages, dialogs, toasts, and recipe/category
NAMES) renders in the active language for en/fr/de/es/it — offline, no English fallback — enforced by build
guards, with a state-driving render test. (Interpolated step-prose is v269.)

**Architecture:** One canonical `L(he,en,ctx?)` all UI text flows through; the 9 parallel `_EN` tables
deleted; a committed extractor (`lang/_extracted.json`) is the single source of the key set; three build
guards (coverage / unit-token numeric / call-site signature) make an unlocalized string fail the build.

**Tech Stack:** vanilla JS (`app.js`), Python build (`build.py`), Playwright tests, Node+acorn dev extractor,
local `translategemma:27b` pipeline (`scratch/translate-bulk/`).

## Global Constraints (every task's requirements implicitly include these)
- **Safety-number invariance:** no temp/cure/salt/duration is ever altered by translation. Numbers stay as
  literal dict values guarded by **Guard B (unit-token-preserving, spec §4.3)**; none are computed/rewritten
  by the localize path. No `bcheck`/`temp`/`safe`/cook-duration touched.
- **Hebrew-mode byte-identical:** every refactor (ternary→L, `_EN` deletion, names, `ctx`) must produce
  identical Hebrew-mode output — `getDict()` returns null in he (app.js:8580) so all dict paths are no-ops in
  Hebrew. Each task asserts this.
- **Offline:** base UI localization renders from the dict; no runtime AI for chrome.
- **§10.19** (translation QA: semantic + physical verify), **§10.20** (a new string → all active dicts),
  **§10.21** (owner test handoff = Hebrew use-case script) apply.
- **DoD = spec §15** (RED witnessed incl. a seeded guard failure; GREEN with pasted output; behavioural/
  rendered assertions; he-byte-identical regression check; 390×844 screenshots looked at; full suite plain
  `npx playwright test`, no `--retries`/`--workers=1`).
- **Suite hygiene (§11a):** run targeted specs during dev; the FULL suite only on an idle machine with the
  translation marathon paused (it is paused). Restart any manual `serve.js` after `python build.py`.
- Marathon stays **paused** until Task 2's extractor exists; re-run through it after v268 (separate step).

---

## Task 1 — Extend `L` to `L(he,en,ctx)` + `__i18nTrace` hook
**Files:** Modify `app.js` (the `L` function, 8587). Test: `tests/i18n-Lcontract.spec.ts` (new).
**Interfaces — Produces:** `L(he,en,ctx?)` — he-mode returns `he`; en-mode returns `en`; other langs return
`dict[ctx?he+'␟'+ctx:he] ?? en ?? he`; pushes to `window.__i18nTrace` on the real fallback branch (and a
diagnostic `lang:'en'` record). Exact contract: **spec §3.1** (copy its function body).
- [ ] **Step 1 — failing test.** Write `tests/i18n-Lcontract.spec.ts`: seed en, `page.evaluate` calls
  `L('שלום','Hello')`→'Hello'; `L('שלום','Hello','greet')` keys `'שלום␟greet'`; in he-mode both return
  `'שלום'`; with `window.__i18nTrace=[]` a fr-mode dict-miss pushes one record. Assert all.
- [ ] **Step 2 — run, expect FAIL** (ctx arg unsupported / no trace): `npx playwright test tests/i18n-Lcontract.spec.ts` → FAIL.
- [ ] **Step 3 — implement** per spec §3.1 (extend `L` at app.js:8587; additive 3rd arg + the `if(window.__i18nTrace)` pushes).
- [ ] **Step 4 — run, expect PASS.** Paste output.
- [ ] **Step 5 — he-byte-identical guard.** Add an assertion: for a sample of 20 existing `L('he','en')`
  sites rendered in he-mode, output equals the bare `he` (no behavior change). Run, PASS.
- [ ] **Step 6 — commit:** `feat(i18n): L(he,en,ctx) + __i18nTrace hook (spec §3.1) — additive, he byte-identical`

## Task 2 — The extractor `scripts/i18n-extract.mjs` (+ acorn dev-dep)
**Files:** Create `scripts/i18n-extract.mjs`; modify `package.json` (add `acorn` devDependency); create
`lang/_extracted.json` (committed artifact). Test: `tests/i18n-extractor.spec.ts` (new) OR a node assert in the script.
**Interfaces — Produces:** `lang/_extracted.json` = `{ "<key>": "<en>" }` deduped on compound key; a
`needs-en` warning list; a collision-lint error on same-`he`/different-`en` without `ctx`. Harvest modes 1-4:
**spec §3.3** (static L/t; parallel he/en objects incl. the 9 `_EN` tables with **array-partner + nested
recursion** per I-B; toasts + `'בטל'`; names → `__names__`). Deny-list non-UI objects (M-3).
- [ ] **Step 1 — failing test.** `tests/i18n-extractor.spec.ts`: run the extractor on a fixture snippet
  containing one static `L`, one `_EN` table (flat + nested + array-partner), one `toast('…')`, one name
  object; assert the emitted keys + a seeded homograph collision throws.
- [ ] **Step 2 — run, expect FAIL** (no extractor).
- [ ] **Step 3 — implement** the acorn AST walker per spec §3.3 (modes 1-4, deny-list, collision-lint).
- [ ] **Step 4 — run, expect PASS;** then run on the real `app.js` → write `lang/_extracted.json`; print
  KNOWN-set size + `needs-en` count. Paste.
- [ ] **Step 5 — commit:** `feat(i18n): acorn extractor → lang/_extracted.json (spec §3.3, harvest modes 1-4)`

## Task 3 — Literal ternaries `he?'א':'b'` → `L('א','b')`
**Files:** Modify `app.js` (the ~111 literal-both-sides ternaries; NOT the computed ones — those are v269).
**Interfaces — Consumes:** Task 1 `L`. Pattern + enumeration: **spec §11** + `he?'…':'…'` sites.
- [ ] **Step 1 — enumerate.** `rg -n "\bhe\s*\?\s*['\`]" app.js` → list; separate literal-both-sides from
  computed (computed = a variable on either branch → defer to v269, do NOT touch).
- [ ] **Step 2 — failing test.** Pick 5 representative refactored sites; a spec asserts they render the fr
  dict value in fr-mode (after Task 8-11 translate them) and `he` in he-mode. For THIS task the immediate
  assertion is he-byte-identical (fr comes later): assert he-mode output unchanged for the 5 sites.
- [ ] **Step 3 — refactor** each literal ternary → `L('א','b')`. (Mechanical; the `const he=getLang()==='he'`
  local may become unused at some sites — remove if so.)
- [ ] **Step 4 — run the he-byte-identical assertion + the existing suite subset touching those screens; PASS.**
- [ ] **Step 5 — re-run the extractor** (Task 2) so the new `L` keys enter `_extracted.json`; commit both.
- [ ] **Step 6 — commit:** `refactor(i18n): literal he?a:b ternaries → L(a,b) (spec §11) — he byte-identical`

## Task 4 — Delete the 9 `_EN` tables; reroute selectors through `L`
**Files:** Modify `app.js` (delete `SMOKER_TIPS_EN` 1090-area, `KIND_LABEL_EN`, `STAGE_LABEL_EN`,
`THEME_NAMES_EN`, `FONT_NAMES_EN`, `SHAPE_NAMES_EN` 8747, `DONE_SCALES_EN` 2970, `SPK_HEAT_EN` 1312,
`FONT_SCALE_LABELS_EN`; rewrite each `getLang()==='he'?NAME:NAME_EN` selector). **Prereq:** Task 2 harvested
their pairs into `_extracted.json`. Design: **spec §2 mech-4, §3.3 mode 2**.
- [ ] **Step 1 — failing test.** For each table's selector site (e.g. `smokerTip()` 1100), a spec asserts the
  he-mode label is unchanged and the fr-mode label is the dict value (fr comes after translate; assert he now).
- [ ] **Step 2 — verify harvest.** Confirm every `NAME_EN[k]` value is present in `_extracted.json` (grep) BEFORE deleting.
- [ ] **Step 3 — delete tables + reroute** each selector `(getLang()==='he'?NAME:NAME_EN)[k]` → `L(NAME[k], <harvested en literal>)` (or `t(NAME[k])` after the key is seeded). Per spec §3.3 mode-2 note.
- [ ] **Step 4 — run he-byte-identical + touched-screen specs; PASS. Re-run extractor.**
- [ ] **Step 5 — commit:** `refactor(i18n): delete 9 _EN tables, route selectors through L (spec §2/§3.3) — he byte-identical`

## Task 5 — Homograph `ctx` on the colliding sites
**Files:** Modify `app.js` (~31 chrome collisions + table homographs per M-3). **Consumes:** Task 1 `ctx`,
Task 2 collision-lint. Design: **spec §6**.
- [ ] **Step 1 — surface collisions.** Run the extractor's collision-lint → it errors listing same-`he`/
  different-`en` sites. This IS the RED (the build/extract fails).
- [ ] **Step 2 — add `ctx`** to each colliding `L(he,en)` → `L(he,en,ctx)` (distinct sense per site) per spec §6.
- [ ] **Step 3 — re-run extractor; collision-lint passes (GREEN); `␟ctx` keys distinct in `_extracted.json`.**
  Assert bare `he` key retained for tnode (spec I-C).
- [ ] **Step 4 — commit:** `fix(i18n): disambiguate ~31 homograph keys via L(he,en,ctx) (spec §6)`

## Task 6 — Names → `__names__` + `itemName` refactor
**Files:** Modify `app.js` (`itemName` 8581 → read `getDict().__names__[m.heb] ?? m.eng`); extractor mode 4
already harvests names. Design: **spec §11, §6 (namespace), I-D (one scheme: `__names__`)**.
- [ ] **Step 1 — failing test.** Seed fr; assert a recipe title renders the fr name (after translate) and he
  name in he-mode; `m.eng` fallback when key absent. (he/fallback assertion now; fr after Task 8.)
- [ ] **Step 2 — run, expect FAIL** (itemName returns m.eng in fr).
- [ ] **Step 3 — implement** the `itemName` `__names__` lookup; ensure category/cut/make name sites use it.
- [ ] **Step 4 — run he + fallback assertions PASS; re-run extractor (names in `__names__`).**
- [ ] **Step 5 — commit:** `feat(i18n): recipe/category names via __names__ + itemName (spec §11/I-D)`

## Task 7 — Toast + attribute + unit-glyph coverage
**Files:** Modify `app.js` only if a raw `toast()`/attribute isn't harvestable as-is. Design: **spec §7, §9**
(toast already localizes via `tr()` 3540; attributes via tnode 8612; units via `__units__`).
- [ ] **Step 1 — verify coverage.** Confirm the extractor harvested the 55 raw-Hebrew `toast()` literals +
  `'בטל'` + static attribute literals + `__units__` glyphs (`ס״מ²→cm²`,`ל׳→L`) into `_extracted.json`.
- [ ] **Step 2 — for any raw toast/attr NOT statically harvestable** (interpolated), wrap its static portion
  in `L`/add to `__units__`; name the residual interpolated-attribute class (spec M-5) in the test's `RESIDUAL-UNCOVERED`.
- [ ] **Step 3 — he-byte-identical + a toast-fires-localized assertion (in Task 12's test); commit.**
- [ ] **Step 4 — commit:** `feat(i18n): toast + attribute + unit coverage into the extracted key set (spec §7/§9)`

## Task 8 — Translate the expanded key set → fr/de/es/it
**Files:** `lang/{en,fr,de,es,it}.json` (merge); use `scratch/translate-bulk/` pipeline (English-pivot,
safety-gated). **Prereq:** Tasks 2-7 (final `_extracted.json`). Design: **spec §12**. Marathon paused; local GPU.
- [ ] **Step 1 — regenerate** `lang/_extracted.json` (final routed code); en.json L-set = the `en` args
  (artifact, spec I-A); resolve the `needs-en` list (give every `t(he)` a real English).
- [ ] **Step 2 — translate** the new keys (chrome + `␟ctx` + `__names__` + toasts + units) to fr/de/es/it via
  the pipeline; merge into `lang/{code}.json` (don't clobber good existing translations); safety-lexicon gate.
- [ ] **Step 3 — spot-verify** (§10.19) a sample per language renders correctly (real DOM, Task 12 does the full check).
- [ ] **Step 4 — commit:** `feat(i18n): translate expanded chrome+names key set → fr/de/es/it (spec §12, local pipeline)`

## Task 9 — Guard A (coverage) in `build.py`
**Files:** Modify `build.py` (after `I18N_DICTS` assembly, 382-408; replace the `%` line 406). Design: **spec §4.1/§4.2**.
- [ ] **Step 1 — RED:** add Guard A; seed a missing key (delete one from fr.json) → `python build.py` exits 1
  naming the key+lang. Paste. Restore.
- [ ] **Step 2 — GREEN:** `python build.py` exits 0 with all keys present. Paste.
- [ ] **Step 3** — en scoped to the `t(he)`-no-en case (spec I-A); loanword allow-list `lang/_i18n-allow-identical.json`.
- [ ] **Step 4 — commit:** `feat(build): Guard A — coverage gate, build fails on an unlocalized active-lang key (spec §4.1)`

## Task 10 — Guard B (unit-token-preserving numeric safety) in `build.py`
**Files:** Modify `build.py`. Design: **spec §4.3** (copy its Python port: `SAFETY_NUM`, `safety_num_val`,
`VC_UNIT_CLASS` with magnitude sub-classes tempC/tempF/massG/massKg/timeMin/Hr/Day, directional `unit_ok`, fail-closed).
- [ ] **Step 1 — RED (digit):** seed a digit-flip in a translated safety value (`71°C`→`17°C`) → build fails. Paste.
- [ ] **Step 2 — RED (unit swap):** seed `71°C`→`71°F` and `2.5 ג׳/ק״ג`→`2.5 kg` → build fails (the S-1 catch). Paste. Restore.
- [ ] **Step 3 — GREEN:** correct values → build exits 0. Assert the residual (`68 מעלות` tolerates °C/°F) does NOT false-fail. Paste.
- [ ] **Step 4 — commit:** `feat(build): Guard B — unit-token-preserving numeric safety gate (spec §4.3, catches °C↔°F / g↔kg)`

## Task 11 — Guard D + `active-langs ⊆ LANGNAME` + `LANGNAME` gains `it`
**Files:** Modify `build.py` (Guard D structural signature; the LANGNAME-subset assertion) and `app.js`
(`LANGNAME` 8571 add `it`+active langs; the 5498/8695 defaults). Design: **spec §4.5, §10, M-1**.
- [ ] **Step 1 — RED:** Guard D — change an `L(` call-site count without regenerating `_extracted.json` →
  build fails (structural drift). The `active-langs⊄LANGNAME` assertion fails when a lang is missing from LANGNAME.
- [ ] **Step 2 — GREEN:** add `it` to LANGNAME; regenerate signature → build exits 0.
- [ ] **Step 3 — commit:** `feat(build): Guard D call-site signature + active-langs⊆LANGNAME; LANGNAME+it (spec §4.5/§10)`

## Task 12 — State-driving leak-scan test + staleness gate + cleanup + full suite
**Files:** Create `tests/i18n-completeness.spec.ts`; delete `tests/_diag-{wood,i18n,i18n-scope}.spec.ts`.
Design: **spec §8** (drive recipe-under-insufficient-kit, edit form, wizard, event planner, fire a toast,
lang-switch-while-open; `__i18nTrace` empty minus `_i18n-allow-identical.json` minus `_i18n-deferred.json`;
Hebrew-block DOM+attribute scan; §8.3 extractor-staleness gate; §8.4 units).
- [ ] **Step 1 — write the test** per spec §8; create `lang/_i18n-deferred.json` (the v269 template/concat/
  computed-ternary keys) so the trace assertion can pass in v268.
- [ ] **Step 2 — RED first:** seed a raw untranslated Hebrew node/toast → the test FAILS for that reason. Paste.
- [ ] **Step 3 — GREEN:** with translations in place, the test passes for en/fr/de/es/it. Screenshots 390×844
  (recipe-under-kit, an edit form, a toast) in fr + one other language — looked at.
- [ ] **Step 4 — staleness gate:** the test re-runs the extractor and asserts it deep-equals committed
  `_extracted.json` (RED if `app.js` changed a key without regenerating).
- [ ] **Step 5 — delete the 3 temp `_diag-*.spec.ts`; run the FULL suite** (translation paused, idle machine):
  plain `npx playwright test` → all green, output + exit code pasted.
- [ ] **Step 6 — commit:** `test(i18n): state-driving leak-scan completeness gate + staleness; remove diag specs (spec §8)`

---

## Release (after Task 12 clean)
Version-bump to v268 (build.py stamp + CHANGELOG + WHATS_NEW in all active dicts per §10.20); build; pause
translation; full-suite witness; push; **§10.10 live-verify** (foot-stamp `מהדורה 268` + a feature probe);
**§10.21 owner handoff** = a Hebrew numbered use-case script per localized surface (open the app in French,
open a recipe, see the panel/steps-chrome/buttons in French; switch to Italian; etc.); then production-verify
via the real Worker/AI path (owner: ship ≠ production until verified). Then re-run the paused marathon through
the final extractor.

## Self-Review (writing-plans)
- **Spec coverage:** every v268 §14 item mapped — extractor (T2), literal ternary (T3), `_EN` delete (T4),
  homograph (T5), names (T6), toast/attr/unit (T7), translate (T8), Guard A/B/D + LANGNAME (T9/10/11), test
  (T12). ✓
- **Placeholders:** none — detailed code lives in the cited committed spec §§; TDD test intent + commands are concrete.
- **Type/name consistency:** `L(he,en,ctx)`, `__i18nTrace`, `__names__`, `_extracted.json`,
  `_i18n-allow-identical.json`, `_i18n-deferred.json`, Guard A/B/D used consistently and matching the spec.
- **Ordering:** L-extension → extractor → routing (ternary/_EN/ctx/names/toasts) → translate → guards → test.
  Guards after translation so the build isn't red mid-development. ✓
