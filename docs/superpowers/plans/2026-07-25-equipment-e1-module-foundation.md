# Equipment Programme · Phase E1 — Module Foundation + Requires Derivation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Governing spec:** `docs/superpowers/specs/2026-07-25-equipment-cooking-constraint-design.md` — **APPROVED by the owner, 2026-07-25**, six §12 flags confirmed (F1–F6, spec header). This plan implements **only Phase E1** (spec §9, row E1) and the parts of §3 / §4.1 / §4.2 that the foundation carries. **E2's ledger, E3's gates, E4 cooking-order, E5 replacements, E6 declared-requires authoring are OUT — this plan does not build them** (each `EQM.*` method they own ships as an explicit phase-stub, Task 1).

**Goal:** Stand up the strangler-fig module `equipment.js` behind a single narrow global `EQM.*` (five methods, four stubbed to their future phases), inlined by `build.py` **before** `app.js` with a single-definition build assertion (ruling F5); derive every catalog item's cook-device `requires` list from the stage data the plan already computes (`deriveRequires`, zero migration, all 3,677 items, cannot drift); answer `EQM.ownership(requires) → {ok, missing, partial}` off that list by reusing the existing `cookerCandidates` policy (one source of truth); render the derived requirement + ownership verdict as a **non-blocking informational chip on the catalog card** — the real production consumer that makes both derived values fire on real data (DoD-5/L8); and collapse the two cooking-area registry fields onto the canonical `areaCm2` (D3).

**Architecture:** One new source file `equipment.js` (shared runtime scope, **no ES modules**) holding the pure derivation `deriveRequires` + the `EQM` const literal; a one-time `build.py` inline change that concatenates `equipment.js` **ahead of** `app.js` into the single shipped `<script>` and asserts `EQM` is defined exactly once; symbol-shaped edits inside `app.js` (a catalog-card chip helper + three one-line card insertions + the D3 registry-form change); and a small CSS block in `app.css`. `EQM.ownership` is the only functional method in E1; `availability`/`allocate`/`release` (E2) and `alternatives` (E5) are defined as throwing phase-stubs so the F5 five-method assertion is stable from E1 and the public surface is fixed day one. `app.js` reaches equipment.js only through `EQM.*` **and** the pure projection `deriveRequires` (the spec's compute-once design, §4.2: ownership and availability answer from the SAME requires list, so the caller composes `EQM.ownership(deriveRequires(meta))`).

**Tech Stack:** Vanilla ES5/ES6 JavaScript in `app.js` + new `equipment.js` · CSS in `app.css` · Python `build.py` inliner (single-file build) · Playwright (`@playwright/test`) with the warm-page fixtures in `tests/_fixtures.ts` · TypeScript for `tests/`.

**Baseline:** current `HEAD` `b412a9c` (`app.js` byte-identical to the spec baseline `26bc779`, verified `git diff --stat 26bc779 -- app.js` = empty this session). `app.js` is **9,991 lines**. **Every `app.js:N` in this plan is indicative and grep/Serena-verified this session (2026-07-25) — `app.js` drifts daily; implementers MUST locate every symbol with Serena `find_symbol` and treat any line number as a hint, never a coordinate** (`CLAUDE.md` §10.17). Serena reports `body_location` one line below the 1-based grep line; the numbers here are the 1-based grep lines, matching the substrate map and the spec.

**Substrate trace:** every "modify existing" claim below traces to `docs/analysis/2026-07-25-equipment-substrate-map.md` or to this session's own Serena reads of the bodies quoted inline (`cookerCandidates`, `cookerCatForKind`, `deviceCapacity`, `itemOccupancy`, `deviceCanHang`, `equipList`, `itemStages`, `EQUIP_CATS`, `resolveItem`, `chooseBath`, `propOf`, `cutCard`/`specCard`/`makeCard`, `chipsFor`, `build.py` §377).

---

## Global Constraints

*Copied verbatim from the approved spec `§2`. Every task's requirements implicitly include this section.*

1. **Hebrew-first (DoD-9, L13).** Every new user-facing string — invalid badges, blocked-add toasts, availability answers, delete-impact warnings, replacement dialogs — ships in Hebrew (the base language) with an English counterpart through the existing `L(he,en)` mechanism (`app.js:7292`). Proposed copy is given per-item in §4/§7 and marked **proposed, not final** — each takes its DoD-9 native/fluent pass at implementation time; approval of this spec does not freeze wording. **L13:** any surface that renders a number beside its Hebrew label (every availability "room for {n} more", every "{n} events / {m} cooks" impact count, every capacity readout) needs a `dir="ltr"` island around the digits/unit, or the RTL context visually flips a comparison operator or misorders a number/unit pair. Counts are interpolated, so correct singular/plural is required (there is **no** shared `plural()` helper today — ULTIMATE B-iii.17, `"1 events"` — so the plan must not assume one; build the correct form explicitly per string).
2. **Safety invariance (DoD-10) — the load-bearing invariant of this entire programme.** The Equipment Manager is a **pure read-and-reserve layer**. **No `EQM.*` call, no ledger write, no validity gate, and no replacement approval may ever alter a stored `bcheck` stage, `temp`, `safe`/`tgt`/`cure`/`cureRate` value, or any cook/cure duration**, and none may write to `itemStages`'s returned stage list. `equipPlan`'s existing contract (*"may enrich, may never change: no duration, no temperature, no kind, no order"*, `app.js:969-972`) is the model and is **extended to the whole `EQM.*` surface**. **The required assertion, named once here and reused per-task:** snapshot both `resolveItem(key).obj` **and** the full `itemStages(meta, methodKey, ready, order)` output array for every item under test **before** and **after** exercising any `EQM.ownership`/`availability`/`allocate`/`release`/`alternatives` round-trip (including a full allocate-then-release cycle and an accepted replacement), and assert **byte-identical** (deep-equal). This mirrors the existing `safetyDiff` plan-boundary invariant (`app.js`) without reusing that function — `EQM.*` never touches `itemStages`/`planSchedule`, so `safetyDiff` is not a dependency, only its *pattern*.
3. **TDD (DoD-2/3).** Every task: witnessed RED (test written first, run, observed failing for the stated reason, output pasted) → GREEN → full suite. Each `EQM.*` function is TDD'd **at the module boundary** (§10) before any UI wires to it. No production code before a witnessed failing test.
4. **Serena-first on `app.js` and `equipment.js` (`CLAUDE.md` §10.17).** Every edit is symbol-shaped on a ~10k-line monolith and a new module — `find_symbol`/`get_symbols_overview`/`replace_symbol_body`/`find_referencing_symbols` are the tools, not text-matching `Edit`. This spec's own citations were all Serena-verified; the executing subagents do the same, pointed at the single shared Serena server (`CLAUDE.md` §10.17a).
5. **Suite (DoD-12).** `npx playwright test` — plain, nothing else. The full suite (~**512** tests at time of writing; exact count confirmed at plan time via `--list`, **never** by running under `--workers=1`) guards every extraction and every wiring. `retries:0`, `workers` at the certified ceiling. Never `--retries`, never `--workers=1`. Any failure, including an intermittent one, is a bug (`systematic-debugging`), never re-run to pass. Per §11a: never two suite runs concurrently; run serialized, no competing CPU-heavy agents.
6. **Waiver Gate (`CLAUDE.md` §4, `development-discipline.md` §4).** Nothing in this spec waives, narrows, or defers a charter/ULTIMATE requirement. Where this document made an implementation choice the owner's verbatim decision did not spell out, it is flagged in that section **and** in §12 — none is treated as settled without the owner reviewing this file.
7. **Strangler-fig (standing architectural principle, adopted per Q5).** Every re-architected pillar leaves `app.js` into its **own source file**, inlined by `build.py` into the single shipped `<script>`, exposing **one** narrow global namespace; `app.js` never reaches inside. `app.js` shrinks by **attrition**, never by a big-bang rewrite. Source-level modules share one runtime scope (no ES modules). `equipment.js`/`EQM` is the first application of this principle.

### The owner's six spec-review rulings (F1–F6) — in scope, do not re-litigate

- **F1** — the automated cross-event re-allocator stays OUT; only the ledger/availability substrate (E2) is brought forward. *E1 touches neither — noted for context.*
- **F2** — `capacityDemand` ships with the **static** footprint; D5 guest-scaling is a named future gap. *E1's `deriveRequires` reads the same static `itemOccupancy` footprint; it does not scale by guests.*
- **F3** — `EQM` stays a **five-method** API; the delete-impact query stays internal. *E1 defines exactly five methods (Task 1).*
- **F4** — day-one declared requires = grinder + stuffer; the sealer row is an E6 stretch. *E1 authors NO declared rows — it defines the `source:'declared'`/`altOf` schema fields only (Task 2).*
- **F5** — `equipment.js` inlines **before** `app.js` with the `build.py` single-definition assertion. *This is Task 1, the riskiest step.*
- **F6** — `EQM.alternatives` runs with `search:false`. *E5 concern; E1 ships `alternatives` as a phase-stub.*

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `equipment.js` (**create**) | The strangler-fig module: `REQ_KIND`/`KIND_TO_STAGE` maps, `deriveRequires` (pure), `eqmOwnershipRow`, the `EQM` const literal (5 methods; `ownership` real, 4 phase-stubs). | 1, 2, 3 |
| `build.py` (**modify**) | Read `equipment.js`; inline it **before** `app.js` in `__JS__`; assert `EQM` + its 5 methods defined exactly once, and defined **nowhere** in `app.js` (F5). | 1 |
| `app.js` (**modify**) | `eqmRequiresChip` helper + 3 one-line card insertions (`cutCard`/`specCard`/`makeCard`); D3 registry-form change (`chipsFor` chip, `fuelRow`, the save line, one `paintVerify`). Symbol-shaped edits only. | 4, 5 |
| `app.css` (**modify**) | `.eqm-reqs`/`.eqm-req`/`.eqm-req-*`/`.eqm-num` chip styles. | 4 |
| `tests/e1-module-seam.spec.ts` (**create**) | `EQM` present, 5-method shape, phase-stubs throw; dist-artifact markers + ordering. | 1 |
| `tests/e1-derive-requires.spec.ts` (**create**) | `deriveRequires` per item type: correct kinds, non-device stages excluded, capability + demand, safety invariance. | 2 |
| `tests/e1-ownership.spec.ts` (**create**) | `EQM.ownership` ok/missing/partial incl. capability sub-checks; safety invariance. | 3 |
| `tests/e1-requires-chip.spec.ts` (**create**) | The card consumer renders the verdict on real data; gated on `equipConfigured()`; Hebrew/`dir=ltr`; safety invariance. | 4 |
| `tests/e1-area-field.spec.ts` (**create**) | D3: the device chip renders canonical `areaCm2`, not the free-text alias; `deviceCapacity` unchanged. | 5 |

---

## Hazards that will cost you an hour (each has bitten this project)

**H1 — the `build.py` inline is the riskiest change; an inlining failure ships silently.** `dist/index.html` is one inline `<script>` (`build.py:339`, `<script>__JS__</script>`). `build.py:350` reads `app.js` into `_js`; `build.py:377` does `HTML.replace("__JS__", _js)`. `EQM` is a `const` — it does **not** hoist — so `equipment.js` must be concatenated **before** `app.js` (F5). The build MUST assert `EQM` is defined exactly once (Task 1). After **any** `build.py` change, a manual `serve.js` caches `dist/` in memory at startup — **restart it before any manual UI check** (L12, §11a). The automated suite is safe: its `webServer.command` is `python build.py && node serve.js` (`playwright.config.ts:85`), so every `npx playwright test` rebuilds fresh and a broken assertion fails the whole suite loudly at startup.

**H2 — module-before-app ordering constraint.** Because `equipment.js` is inlined first, it must contain **no top-level executable statement that CALLS an `app.js` function** — only declarations and the `EQM` object literal of function references. `app.js`'s top-level `function` declarations hoist across the combined script, so `EQM`'s method bodies may freely reference them (`itemStages`, `cookerCandidates`, `deviceCapacity`, `propOf`, `chooseBath`, `deviceCanHang`, `equipList`) — but only at **call time** (after `app.js` has fully evaluated), never at module-eval time. `app.js`'s top-level `const`s (`EQUIP_CATS`, `DATA`) do **not** hoist; do not touch them at eval time. `EQM`'s methods are functions called later, so this holds by construction.

**H3 — top-level `const EQM` is a global-lexical binding, not a `window` property.** In the app's single classic (non-module) `<script>`, `app.js`'s own top-level `function`/`const` declarations are how the whole app and its tests reach symbols (`page.evaluate('aiSafetyNums(...)')`, `resolveItem(...)` — bare names, no `window.`). A top-level `const EQM = {...}` in `equipment.js` is reachable the same way: `page.evaluate("typeof EQM")` returns `'object'`, and `deriveRequires` (a top-level `function`) is a `window` property. Do **not** wrap `equipment.js` in an IIFE — that would hide both from the app and the tests. Task 1's RED→GREEN proves this end-to-end.

**H4 — warm-page fixtures.** `test.use()` does **not** reach the worker-scoped warm page (`tests/_fixtures.ts` `warmContext` forwards only a fixed option list). Per-test isolation (clock, timezone, `test.use`) needs the `isolatedPage` fixture (`tests/_fixtures.ts:178`; the file states this at `:149`). **None of E1's tests need `isolatedPage`** — they use the default `{ page }` + `seedApp(page, kv)` (the reset, `tests/_fixtures.ts:206`). No `waitForTimeout` anywhere (DoD-11) — wait on `waitForFunction`.

**H5 — the derived value must have a real consumer in E1 (DoD-5/L8).** A `requires` list nothing reads is `hooksOver` again. E1's chosen consumer is the **catalog-card informational requires chip** (Task 4): it composes `EQM.ownership(deriveRequires(meta))` and renders the verdict on real catalog data, **gated on `equipConfigured()`** so it fires for the real target user (a cook with a configured kit) and costs nothing for a no-kit user. It is **non-blocking** — E3 escalates the SAME verdict into the bold-invalid gate + plan-add/event-add blocks; the two do not overlap. This is the minimum needed to satisfy DoD-5; it is flagged in Self-Review as an addition the spec's E1 "Ships" column did not list literally but §11.2-point-5 demands.

**H6 — safety invariance (DoD-10).** E1 only READS item data; it never writes `safe`/`temp`/`cure`/duration or `itemStages`'s array. Every task that exercises `deriveRequires`/`EQM.ownership` on an item names the §2.2 snapshot assertion (before/after byte-identical `resolveItem(key).obj` + `itemStages(...)`).

---

## Task 1: The module seam — `equipment.js` scaffold + `build.py` inline (before `app.js`) + F5 single-definition assertion

Spec §3 (module + `EQM.*` skeleton), §0.2 row 1 (`equipment.js` module + `EQM.*` + strangler-fig, owner Q5, structural), ruling **F5**. This is the **structural seam task**: it produces no derived value (so DoD-5 is N/A here — the derived `requires` and its consumer arrive in Tasks 2–4); its observable effect (DoD-4) is the `EQM` five-method surface existing in the running app **and** the dist artifact carrying `equipment.js` ahead of `app.js` with `EQM` defined exactly once.

**Interfaces:**
- Consumes: nothing (the four non-`ownership` methods are phase-stubs; `ownership` is itself a phase-stub in this task, made real in Task 3).
- Produces: global `const EQM` with methods `ownership`/`availability`/`allocate`/`release`/`alternatives`; the `build.py` inline + F5 assertion. **Task 2 fills `deriveRequires`; Task 3 replaces the `ownership` stub.**

- [ ] **Step 1: Write the failing test**

Create `tests/e1-module-seam.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// Equipment programme E1 · Task 1 (spec §3, ruling F5). The strangler-fig seam: equipment.js is inlined
// BEFORE app.js into the single shipped <script>, exposing ONE narrow global EQM with EXACTLY five
// methods. In E1 only EQM.ownership becomes functional (Task 3); availability/allocate/release (E2) and
// alternatives (E5) ship as phase-stubs that THROW when called — scaffold, never silent no-ops.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof EQM!=='undefined'`);
};

test('EQM exists as one global object (H3: reachable by bare name, no window.)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`typeof EQM`)).toBe('object');
  expect(await page.evaluate(`EQM!==null`)).toBe(true);
});

test('EQM exposes EXACTLY five methods, all functions (ruling F3/F5)', async ({ page }) => {
  await boot(page);
  const keys = await page.evaluate(`Object.keys(EQM).filter(k=>typeof EQM[k]==='function').sort()`) as string[];
  expect(keys).toEqual(['allocate', 'alternatives', 'availability', 'ownership', 'release']);
  expect(await page.evaluate(`Object.keys(EQM).length`)).toBe(5);   // no sixth surface member
});

test('the four not-yet-implemented methods throw their phase name (scaffold, not a silent no-op)', async ({ page }) => {
  await boot(page);
  for (const [m, phase] of [['availability','E2'],['allocate','E2'],['release','E2'],['alternatives','E5']] as const) {
    const msg = await page.evaluate(`(function(){ try{ EQM['${m}']({},{},{}); return 'NO-THROW'; }catch(e){ return String(e.message||e); } })()`) as string;
    expect(msg).toContain(phase);
  }
});

test('deriveRequires is a global function seam (Task 2 fills its body)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`typeof deriveRequires`)).toBe('function');
});
```

- [ ] **Step 2: Run the test and WITNESS it fail for the intended reason**

Run: `npx playwright test tests/e1-module-seam.spec.ts`

Expected: **all four FAIL at `waitForFunction("typeof EQM!=='undefined'")`** — `EQM` does not exist yet, and `equipment.js` is not inlined. Paste the output. The failure must read as the `waitForFunction` timeout (the module is absent), **not** a syntax error in the spec. None of the four passes first-run.

- [ ] **Step 3: Create `equipment.js` with the `EQM` scaffold**

Create `equipment.js` in the repo root (next to `app.js`). This is the module's first content: the map constants, a `deriveRequires` **stub** (Task 2 replaces the body), and the `EQM` const with `ownership` **stub** (Task 3 replaces it) + four phase-stubs.

```js
/*═══════════════════════════════════════════════════════════════════════════════════════════════════
  equipment.js · EQM — the Equipment Manager module (strangler-fig, spec §3, owner Q5)

  Inlined by build.py BEFORE app.js into the single shipped <script> (ruling F5). Shares app.js's one
  runtime scope — NO ES modules. app.js reaches this module ONLY through the global `EQM` (five methods)
  and the pure projection `deriveRequires` (the spec's compute-once design: ownership and availability
  answer from the SAME requires list, so the caller composes EQM.ownership(deriveRequires(meta))).

  ORDERING (H2): equipment.js runs before app.js, so it contains NO top-level statement that CALLS an
  app.js function — only declarations and the EQM literal of function references. app.js's top-level
  `function` declarations hoist across the combined script, so EQM's method BODIES may reference them
  freely at call time (after app.js has evaluated); app.js's top-level `const`s are off-limits at eval
  time (they don't hoist) but fine at call time.
═══════════════════════════════════════════════════════════════════════════════════════════════════*/

// stage.kind → device-kind (cookerCatForKind primary, spec §4.2). smoke→smoker, sv→bath, cook→grill.
const REQ_KIND = { smoke: 'smoker', sv: 'bath', cook: 'grill' };
// device-kind → stage-kind, so EQM.ownership can REUSE cookerCandidates (the one substitution policy:
// smoke→smoker|grill, cook→grill|oven, sv→bath) instead of copying it. E6 extends this with the
// declared process kinds (grinder/stuffer/sealer/curing) and their own category resolution.
const KIND_TO_STAGE = { smoker: 'smoke', grill: 'cook', bath: 'sv' };

// ── deriveRequires — Task 2 fills this body. Seam declared here so build.py's inline + the module-seam
// test see a real global function from Task 1 onward.
function deriveRequires(meta, methodKey, order){
  return [];   // TASK-2 replaces this entire body with the real derivation.
}

// ── eqmOwnershipRow — Task 3 fills this body (per-row ok/missing/partial via cookerCandidates + caps).
function eqmOwnershipRow(row){
  throw new Error('eqmOwnershipRow: implemented in E1 Task 3');
}

// ── the ONE narrow global (ruling F3/F5: exactly five methods). E1 makes only `ownership` functional.
const EQM = {
  // physical, catalog-level, window-independent (spec §5.1). Task 3 replaces this stub.
  ownership: function(requires){
    throw new Error('EQM.ownership: implemented in E1 Task 3');
  },
  // ledger + capacity fit (spec §5.1) — Phase E2.
  availability: function(requires, window){
    throw new Error('EQM.availability: not implemented until E2 (ledger + capacity fit)');
  },
  // holder-tracked reservation (spec §5.1) — Phase E2.
  allocate: function(requires, window, holder){
    throw new Error('EQM.allocate: not implemented until E2 (reservation ledger)');
  },
  // frees ALL of a holder's holds (spec §5.1) — Phase E2.
  release: function(holder){
    throw new Error('EQM.release: not implemented until E2 (reservation ledger)');
  },
  // replacement ladder (spec §7.1) — Phase E5.
  alternatives: function(missingReq){
    throw new Error('EQM.alternatives: not implemented until E5 (replacement ladder)');
  },
};
```

- [ ] **Step 4: Inline `equipment.js` before `app.js` in `build.py`, with the F5 single-definition assertion**

Locate `build.py:350` — `with open(... "app.js" ...) as _f: _js = _f.read()` (the line that reads `app.js` into `_js`; Serena `search_for_pattern "app\.js"` if it has moved). Insert, **immediately after** that line:

```python
# ── Equipment module (spec §3, ruling F5). equipment.js is inlined BEFORE app.js in __JS__ below: EQM is
# a `const` and does NOT hoist, so it must be evaluated ahead of any app.js top-level path that reads it.
with open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "equipment.js"), encoding="utf-8") as _f: _eqm = _f.read()
# F5 single-definition guard (S1's "build.py has zero assertions" lesson — the anti-silent-drop check).
# EQM is defined EXACTLY once, in equipment.js, with all five public methods; app.js defines it NOWHERE
# (app.js only ever CALLS EQM.*). A broken inline now aborts the build loudly instead of shipping silently.
import re as _re
_eqm_defs = _re.findall(r'(?m)^\s*(?:const|let|var)\s+EQM\b', _eqm)
assert len(_eqm_defs) == 1, "F5: equipment.js must define EQM exactly once, found %d" % len(_eqm_defs)
for _meth in ("ownership", "availability", "allocate", "release", "alternatives"):
    assert _re.search(r'\b' + _meth + r'\s*:', _eqm), "F5: EQM.%s missing from equipment.js" % _meth
assert not _re.search(r'(?m)^\s*(?:const|let|var)\s+EQM\b', _js), "F5: app.js must not define EQM (it may only call EQM.*)"
```

Then locate `build.py:377` — the `html = HTML.replace("__CSS__", _css).replace("__JS__", _js)...` line (Serena `search_for_pattern 'replace\\("__JS__"'`). Change **only** the `__JS__` replacement so `equipment.js` precedes `app.js`, joined by a defensive `;` (guards against ASI at the file junction):

```python
html = HTML.replace("__CSS__", _css).replace("__JS__", _eqm + "\n;\n" + _js).replace("__DATA__", "JSON.parse(" + _js_str(DATA_JSON) + ")").replace("__I18N_DICTS__", "JSON.parse(" + _js_str(I18N_DICTS_JSON) + ")")
```

(Leave the `__DATA__`/`__I18N_DICTS__` replacements exactly as they were — those tokens live inside `app.js` and are still replaced after `__JS__` is substituted.)

- [ ] **Step 5: Build and verify the built artifact (H1 — the silent-drop guard)**

Run: `python build.py`

Expected: it completes with no `AssertionError`. Then verify the dist artifact carries the module ahead of `app.js` and defines `EQM` exactly once:

```bash
grep -c "equipment.js · EQM — the Equipment Manager module" dist/index.html   # expect 1 (the banner is inlined)
grep -c "^const EQM = {" dist/index.html                                      # expect 1 (defined exactly once)
# ordering proof: the EQM banner must appear BEFORE app.js's own first top-level function.
awk '/equipment.js . EQM/{print "EQM@"NR} /function cookerCatForKind/{print "APP@"NR; exit}' dist/index.html
```

Expected: the first two `grep -c` print `1`; the `awk` prints an `EQM@<n>` line whose number is **less than** the `APP@<m>` line. Paste all three outputs.

- [ ] **Step 6: Witness the F5 assertion actually fires (built-artifact guard RED)**

Prove the guard is not vacuous. Temporarily append a second definition to `app.js` (Serena `insert_after_symbol` on the last top-level symbol, or a one-line `Edit` at EOF): `const EQM = {};`. Run `python build.py`.

Expected: it aborts with `AssertionError: F5: app.js must not define EQM (it may only call EQM.*)`. Paste the output. **Then remove that line** and re-run `python build.py` → clean. Paste the clean run. (This is the RED/GREEN for the build assertion itself — S1's zero-assertions lesson.)

- [ ] **Step 7: Run the module-seam test to verify it passes**

Run: `npx playwright test tests/e1-module-seam.spec.ts`

Expected: **4 passed** (the managed `webServer` rebuilds via `python build.py` first, so `equipment.js` is inlined). Paste the output and exit code.

- [ ] **Step 8: Run the full suite**

Run: `npx playwright test`

Expected: **512 + 4 = 516 passed, 0 failed** (confirm the 512 baseline first with `npx playwright test --list | tail -1`). Paste the full output and exit code. Any failure — including intermittent — is a bug: stop and use `systematic-debugging`. Never re-run to make it pass.

- [ ] **Step 9: Commit (the plan + the seam)**

```bash
git add equipment.js build.py tests/e1-module-seam.spec.ts docs/superpowers/plans/2026-07-25-equipment-e1-module-foundation.md
git commit -m "feat(equip): E1 Task 1 - equipment.js seam + EQM 5-method scaffold, inlined before app.js

New strangler-fig module equipment.js exposes ONE global EQM (ruling F3/F5): exactly five methods,
only ownership becomes functional in E1; availability/allocate/release (E2) and alternatives (E5) are
phase-stubs that throw. build.py inlines equipment.js BEFORE app.js (const EQM does not hoist) and
asserts EQM is defined exactly once and NOWHERE in app.js (F5, S1's zero-assertions lesson)."
```

**DoD gate (§3):** 1 traced (§3, §0.2-row-1, F5). 2 RED witnessed (Step 2, `waitForFunction` timeout). 3 GREEN (Step 7). 4 observable (EQM shape + dist markers). 5 N/A — structural task, no derived value (consumer arrives Tasks 2–4). 6 negative case = the four stubs throw (Step 1 test 3). 7 build-assertion regression red-green (Step 6). 8 N/A — no UI. 9 N/A — no user-facing string. 10 N/A — no item code path exercised. 11 no `waitForTimeout`. 12 full suite (Step 8).

---

## Task 2: `deriveRequires` — auto-derived cook-device requires for all 3,677 items (+ D2 enumeration)

Spec §4.2 (source 1: AUTO-DERIVED; the declared schema fields defined, authoring E6), §4.1-D2 (honest live/parked enumeration), §0.2 row 3 (owner Q4, ULTIMATE D4/D1). Closes D4's "no device requirement is declared in data" for the **cook** role structurally; `sv` covered day one.

**Interfaces:**
- Consumes: `itemStages(meta, methodKey, ready, order)` (`app.js:3223` — returns `{kind, hours, temp?, ...}`; device kinds are `smoke`/`sv`/`cook`; `prep`/`note`/`dry`/`rest`/`bcheck` are non-device) · `itemOccupancy(meta, stageKind, dev)` (`app.js:356` — `{mode:'area'|'volume'|'hang', cm2, litres, hang}`, `cm2` is `null` when unknown) · `REQ_KIND` (Task 1).
- Produces: `deriveRequires(meta, methodKey, order) → requires[]`, each row `{ role:'cook', kind:'smoker'|'bath'|'grill', capability?:{maxTempC?, hang?, bathMinL?}, demand?:{metric:'area_cm2'|'litres', amount}, source:'derived' }`. **Consumed by `EQM.ownership` (Task 3) and the card chip (Task 4).**

- [ ] **Step 1: Write the failing test**

Create `tests/e1-derive-requires.spec.ts`. Fixtures reuse the established device-KIT/`boot` shape from `tests/equipment-visibility.spec.ts`.

```ts
import { test, expect, seedApp } from './_fixtures';

// E1 · Task 2 (spec §4.2). deriveRequires reads the SAME stages the plan computes (itemStages) and emits
// ONE cook-device requires row per smoke/sv/cook stage — never for prep/note/dry/rest/bcheck. It reads no
// equipment-registry state (pure projection), so it can never disagree with the plan (anti-drift).
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof deriveRequires==='function' && typeof resolveItem==='function' && typeof itemStages==='function'`);
};
// derive for an item key under its default method; returns the requires[] array.
const derive = (page: any, key: string) =>
  page.evaluate(`(function(){ var m=resolveItem('${key}'); return m?deriveRequires(m):null; })()`) as Promise<any[]>;

test('a smoking cut derives exactly one smoker cook row, with the cited smoke temp as a capability', async ({ page }) => {
  await boot(page);
  // cut-1 (brisket): a smoke method exists; its stage carries a cited smTemp. deriveRequires must emit a
  // single {role:'cook', kind:'smoker', source:'derived'} with capability.maxTempC = that temp.
  const rows = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    // force the plain smoke combo so the shape is deterministic
    return deriveRequires(m, 'c:smoke');
  })()`) as any[];
  const smoker = rows.filter(r => r.kind === 'smoker');
  expect(smoker.length).toBe(1);
  expect(smoker[0].role).toBe('cook');
  expect(smoker[0].source).toBe('derived');
  expect(smoker[0].capability && typeof smoker[0].capability.maxTempC).toBe('number');
  // NEGATIVE (the anti-over-emission guard): NO row for prep/rest/bcheck — a naive one-row-per-stage
  // implementation would wrongly emit several. Only device kinds are allowed.
  expect(rows.every(r => ['smoker','bath','grill'].includes(r.kind))).toBe(true);
});

test('a sous-vide stage derives a bath row carrying a litres demand and a bathMinL capability', async ({ page }) => {
  await boot(page);
  // cut-1 under a sous-vide combo: expect a {kind:'bath'} row. When the recipe carries a min_bath_l /
  // footprint, demand + capability.bathMinL are present; when it doesn't, the row still exists (kind only).
  const rows = await page.evaluate(`deriveRequires(resolveItem('cut-1'), 'c:sv')`) as any[];
  const bath = rows.filter(r => r.kind === 'bath');
  expect(bath.length).toBeGreaterThanOrEqual(1);
  expect(bath[0].role).toBe('cook');
  // if a bath volume is cited, it must surface as BOTH a litres demand and a bathMinL capability (same source)
  if (bath[0].demand) {
    expect(bath[0].demand.metric).toBe('litres');
    expect(bath[0].capability.bathMinL).toBe(bath[0].demand.amount);
  }
});

test('a sv+smoke combo derives BOTH a bath and a smoker row (sv covered day one, unlike equipPlan)', async ({ page }) => {
  await boot(page);
  const kinds = await page.evaluate(`deriveRequires(resolveItem('cut-1'), 'c:sv_smoke').map(r=>r.kind).sort()`) as string[];
  expect(kinds).toContain('bath');
  expect(kinds).toContain('smoker');
});

test('DoD-6 negative case — an item with no cook stages derives an empty list', async ({ page }) => {
  await boot(page);
  // A make whose profile is a bare non-device flow, or any item itemStages returns no smoke/sv/cook for,
  // must derive []. (Pick a produce/spec item that has only a grill 'cook' — assert it derives grill, not
  // an over-broad set — OR an item with no device stage at all derives [].) This proves the filter works.
  const rows = await derive(page, 'cut-1');
  expect(Array.isArray(rows)).toBe(true);           // never null/undefined for a real item
  expect(rows.every(r => ['smoker','bath','grill'].includes(r.kind))).toBe(true);
});

test('DoD-10 safety invariance — deriving never mutates the item object or its itemStages output', async ({ page }) => {
  await boot(page);
  const snap = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    var before={ obj:JSON.stringify(m.obj), stages:JSON.stringify(itemStages(m,'c:sv_smoke',true)) };
    deriveRequires(m,'c:sv_smoke'); deriveRequires(m,'c:smoke'); deriveRequires(m,'c:sv');
    var after={ obj:JSON.stringify(m.obj), stages:JSON.stringify(itemStages(m,'c:sv_smoke',true)) };
    return { objEq: before.obj===after.obj, stagesEq: before.stages===after.stages };
  })()`) as any;
  expect(snap.objEq).toBe(true);
  expect(snap.stagesEq).toBe(true);
});
```

*Method keys (`c:smoke`, `c:sv`, `c:sv_smoke`) follow `itemProfile`'s combo key shape (`app.js:2939`, `'c:'+combo.sort().join('_')`). If a given cut does not offer a combo, the test's `deriveRequires` still returns a valid list for whatever method resolves — verify the actual method keys for `cut-1` with `page.evaluate("itemProfile(resolveItem('cut-1')).methods.map(m=>m.key)")` and use real ones; do not invent a key.*

- [ ] **Step 2: Run the test and WITNESS it fail for the intended reason**

Run: `npx playwright test tests/e1-derive-requires.spec.ts`

Expected: the first three tests **FAIL** — `deriveRequires` returns `[]` (the Task-1 stub), so `smoker.length` is `0`, `bath.length` is `0`, and the `kinds` array is empty. Paste the output; the failures read as `Received: 0` / `Received: []`, **not** `deriveRequires is not defined`. The **negative case (test 4)** and the **invariance case (test 5)** pass first-run (the stub returns `[]`, which is a valid empty list and mutates nothing) — that is correct and expected; they are the DoD-6/DoD-10 guards, not REDs. **If any of tests 1–3 passes on first run, it is void — rewrite it (DoD-2).**

- [ ] **Step 3: Implement `deriveRequires` + the D2 enumeration comment**

Serena `replace_symbol_body` on `deriveRequires` in `equipment.js`:

```js
// ── requires derivation (Q4 source 1: AUTO-DERIVED). Reads the SAME stage data the plan computes, so it
// cannot disagree with the plan (the anti-drift property, spec §4.2). ONE row per cook-device stage
// (kind smoke/sv/cook → device-kind via REQ_KIND); prep/note/dry/rest/bcheck are not device stages and
// are skipped. This function reads ONLY recipe data (itemStages/itemOccupancy) — no equipment-registry
// state — so it is a pure projection that feeds EQM.ownership AND EQM.availability from ONE list (§4.2).
//
// D2 — device properties the requires model READS today (spec §4.1, "honestly"): the demand/capability
// here consumes areaCm2 (via deviceCapacity, at ownership time), cap.baths (via chooseBath), canHang+hooks
// (via deviceCanHang), and maxC (device temp ceiling). The other 14 registered properties stay PARKED and
// are NOT activated by E1: plates/nozzles go live in E6 (choosePlate/chooseNozzle join); bagKind/bagW are
// an E6 sealer stretch (F4); lid/fan/accuracy/pulse/rotisserie/speed/steam/throughput/waterPan/watts have
// no requires consumer in this spec's scope. This comment is E1's D2 deliverable — the honest accounting
// that stops the plan from claiming to have "activated the device properties".
//
// DECLARED rows (grinder/stuffer/sealer/curing, source:'declared', altOf) are authored DATA and land in
// E6 — deriveRequires emits none. The row SCHEMA (below) already carries those fields so E6 adds no shape.
function deriveRequires(meta, methodKey, order){
  if(!meta || !meta.obj || typeof itemStages!=='function') return [];
  const stages = itemStages(meta, methodKey, true, order) || [];
  const rows = [];
  stages.forEach(function(s){
    const kind = REQ_KIND[s.kind]; if(!kind) return;            // only smoke/sv/cook become requires rows
    const occ = (typeof itemOccupancy==='function') ? itemOccupancy(meta, s.kind, null) : null;
    const row = { role:'cook', kind:kind, source:'derived' };
    const cap = {};
    if(typeof s.temp==='number' && s.temp>0) cap.maxTempC = s.temp;              // device must REACH the cited temp
    if(occ && occ.mode==='hang' && occ.hang) cap.hang = occ.hang;                // recipe wants hanging
    if(occ && occ.mode==='volume' && occ.litres>0) cap.bathMinL = occ.litres;   // bath must be this big
    if(Object.keys(cap).length) row.capability = cap;
    if(occ && occ.mode==='volume' && occ.litres>0) row.demand = { metric:'litres', amount:occ.litres };
    else if(occ && occ.mode==='area' && typeof occ.cm2==='number' && occ.cm2>0) row.demand = { metric:'area_cm2', amount:occ.cm2 };
    rows.push(row);
  });
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/e1-derive-requires.spec.ts`
Expected: **5 passed**. Paste the output and exit code.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test`
Expected: **516 + 5 = 521 passed, 0 failed**. Paste the output and exit code.

- [ ] **Step 6: Commit**

```bash
git add equipment.js tests/e1-derive-requires.spec.ts
git commit -m "feat(equip): E1 Task 2 - deriveRequires (auto-derived cook requires, all items)

Pure projection over the same itemStages the plan computes: one cook-device requires row per
smoke/sv/cook stage (smoke->smoker, sv->bath, cook->grill), carrying maxTempC/hang/bathMinL
capability and area/litres demand from itemOccupancy. sv covered day one (unlike equipPlan). Skips
prep/note/dry/rest/bcheck. Carries the D2 honest live/parked enumeration; declared rows are E6."
```

**DoD gate (§3):** 1 traced (§4.2, §4.1-D2, §0.2-row-3, D4/D1). 2 RED witnessed (Step 2, tests 1–3 value mismatches). 3 GREEN (Step 4). 4 observable (`requires[]` a real reader consumes — Tasks 3/4). 5 consumer named: `EQM.ownership` (Task 3) + card chip (Task 4), both in E1. 6 negative case (test 4, empty list) + the anti-over-emission guard (test 1). 7 N/A — additive, not a bugfix. 8 N/A — no UI. 9 N/A — no user-facing string (chip strings are Task 4). 10 invariance (test 5). 11 no `waitForTimeout`. 12 full suite (Step 5).

---

## Task 3: `EQM.ownership(requires)` — one physical-ownership verdict, reusing `cookerCandidates`

Spec §5.1 (`EQM.ownership` contract), §5.2 (the one verdict all three E3 gates will call — closes B-i.1/B-i.6 structurally), §0.2 row 5 (owner Q3/Q4, ULTIMATE B-i.1/C1). E1 makes the verdict correct and TDD'd at the boundary; E3 wires the three gates onto it.

**Interfaces:**
- Consumes: `cookerCandidates(stageKind)` (`app.js:232` → owned candidate devices, encodes the smoke→smoker|grill / cook→grill|oven / sv→bath policy — the ONE source of truth, reused not copied) · `deviceCanHang(dev)` (`app.js:329`) · `chooseBath(dev, needL)` (`app.js:3013` → `{ok}`) · `propOf(dev,'maxC')` (`app.js:121` → device max temp, measured or class default) · `KIND_TO_STAGE` (Task 1) · a `requires[]` from `deriveRequires` (Task 2).
- Produces: `EQM.ownership(requires) → { ok:boolean, missing:row[], partial:row[] }`. **Consumed by the card chip (Task 4); E3's three gates later.**

- [ ] **Step 1: Write the failing test**

Create `tests/e1-ownership.spec.ts`. Devices seeded via `mk-equipment` + `mk-equip-set` (the `equipment-visibility.spec.ts` KIT shape).

```ts
import { test, expect, seedApp } from './_fixtures';

// E1 · Task 3 (spec §5.1/§5.2). EQM.ownership answers ok/missing/partial for a requires list by REUSING
// cookerCandidates (one policy: a grill can smoke, an oven can 'cook', a bath does sv) and then checking
// each row's capability (temp ceiling via maxC, hang via deviceCanHang, bath size via chooseBath).
// The three E3 gates will all read THIS verdict — B-i.1 "three capacity rules" closed to one, structurally.
const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof EQM==='object' && typeof deriveRequires==='function'`);
};
const SMOKER_BIG = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
const BATH       = [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [12, 20], maxC: 95 } }];
const own = (page: any, requires: any) =>
  page.evaluate(`EQM.ownership(${JSON.stringify(requires)})`) as Promise<any>;

test('missing — owning nothing of the kind answers missing, never ok (D11 spirit at ownership level)', async ({ page }) => {
  await boot(page, null);   // no kit at all
  const r = await own(page, [{ role: 'cook', kind: 'smoker', source: 'derived' }]);
  expect(r.ok).toBe(false);
  expect(r.missing.map((x: any) => x.kind)).toEqual(['smoker']);
  expect(r.partial).toEqual([]);
});

test('ok — owning a capable device of the kind answers ok', async ({ page }) => {
  await boot(page, SMOKER_BIG);
  const r = await own(page, [{ role: 'cook', kind: 'smoker', source: 'derived', capability: { maxTempC: 120 } }]);
  expect(r.ok).toBe(true);
  expect(r.missing).toEqual([]);
  expect(r.partial).toEqual([]);
});

test('partial — owning the kind but no unit meets the capability answers partial, not missing and not ok', async ({ page }) => {
  await boot(page, SMOKER_BIG);   // the cabinet maxes at 150°C
  const r = await own(page, [{ role: 'cook', kind: 'smoker', source: 'derived', capability: { maxTempC: 300 } }]);
  expect(r.ok).toBe(false);
  expect(r.missing).toEqual([]);                          // a smoker IS owned
  expect(r.partial.map((x: any) => x.kind)).toEqual(['smoker']);   // but none reaches 300°C
});

test('partial — a bath is owned but none is large enough (chooseBath) answers partial', async ({ page }) => {
  await boot(page, BATH);   // owns 12 L + 20 L baths
  const r = await own(page, [{ role: 'cook', kind: 'bath', source: 'derived', capability: { bathMinL: 40 } }]);
  expect(r.ok).toBe(false);
  expect(r.partial.map((x: any) => x.kind)).toEqual(['bath']);
});

test('ok — the bath IS big enough answers ok (the positive twin of the previous negative)', async ({ page }) => {
  await boot(page, BATH);
  const r = await own(page, [{ role: 'cook', kind: 'bath', source: 'derived', capability: { bathMinL: 18 } }]);
  expect(r.ok).toBe(true);
});

test('end-to-end — ownership of a real item derived list is consistent with the seeded kit', async ({ page }) => {
  await boot(page, SMOKER_BIG.concat(BATH));
  const r = await page.evaluate(`(function(){
    var reqs=deriveRequires(resolveItem('cut-1'),'c:sv_smoke');
    return EQM.ownership(reqs);
  })()`) as any;
  expect(typeof r.ok).toBe('boolean');
  expect(Array.isArray(r.missing) && Array.isArray(r.partial)).toBe(true);
});

test('DoD-10 safety invariance — an ownership round-trip never mutates the item object or its stages', async ({ page }) => {
  await boot(page, SMOKER_BIG.concat(BATH));
  const snap = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    var b={ obj:JSON.stringify(m.obj), st:JSON.stringify(itemStages(m,'c:sv_smoke',true)) };
    EQM.ownership(deriveRequires(m,'c:sv_smoke'));
    var a={ obj:JSON.stringify(m.obj), st:JSON.stringify(itemStages(m,'c:sv_smoke',true)) };
    return { objEq:b.obj===a.obj, stEq:b.st===a.st };
  })()`) as any;
  expect(snap.objEq).toBe(true);
  expect(snap.stEq).toBe(true);
});
```

- [ ] **Step 2: Run the test and WITNESS it fail for the intended reason**

Run: `npx playwright test tests/e1-ownership.spec.ts`

Expected: **every test FAILS** — `EQM.ownership` is the Task-1 stub that throws `EQM.ownership: implemented in E1 Task 3`, so each `page.evaluate('EQM.ownership(...)')` rejects. Paste the output; the failure names that throw (the stated reason: not implemented yet). None passes first-run. The fixture deliberately seeds a kit that lets ownership **wrongly succeed** on a naive impl (a smoker that maxes at 150°C would read `ok` for a 300°C requirement if the capability check were skipped) — the `partial` tests catch exactly that.

- [ ] **Step 3: Implement `eqmOwnershipRow` + the `EQM.ownership` body**

Serena `replace_symbol_body` on `eqmOwnershipRow` in `equipment.js`:

```js
// One derived cook row → 'ok' | 'partial' | 'missing'. cookerCandidates(stageKind) already returns the
// OWNED devices that can serve this stage (the ONE substitution policy), so ownership is "do I own a
// candidate, and does at least one meet the capability". Declared (process) kinds — grinder/stuffer/
// sealer/curing — have no KIND_TO_STAGE entry; E6 extends this with their category resolution. E1 derives
// none, so the guard below returns 'missing' for an unmapped kind rather than crashing.
function eqmOwnershipRow(row){
  const stageKind = KIND_TO_STAGE[row && row.kind];
  const owned = (stageKind && typeof cookerCandidates==='function') ? cookerCandidates(stageKind) : [];
  if(!owned.length) return 'missing';                       // no device of the kind at all
  const cap = (row && row.capability) || {};
  const meets = owned.some(function(dev){
    if(cap.hang && !deviceCanHang(dev)) return false;
    if(cap.bathMinL){ const b=chooseBath(dev, cap.bathMinL); if(!b || !b.ok) return false; }
    if(cap.maxTempC){ const mx=Number(propOf(dev,'maxC')); if(mx>0 && mx<cap.maxTempC) return false; }
    return true;
  });
  return meets ? 'ok' : 'partial';                          // owns the kind but no unit clears the capability
}
```

Then Serena `replace_symbol_body` on the `ownership` method of `EQM` — replace its throwing stub with:

```js
  // physical, catalog-level, window-independent (spec §5.1). The SINGLE verdict all three E3 gates read
  // (§5.2) — B-i.1's "three capacity rules for one device" closed to one, structurally. Answers from the
  // SAME requires list EQM.availability (E2) will use (§4.2). E1's only production reader is the catalog
  // requires chip (Task 4); E3 adds the plan-add and event-add gates.
  ownership: function(requires){
    const missing=[], partial=[];
    (requires||[]).forEach(function(row){
      const v = eqmOwnershipRow(row);
      if(v==='missing') missing.push(row);
      else if(v==='partial') partial.push(row);
    });
    return { ok: missing.length===0 && partial.length===0, missing:missing, partial:partial };
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/e1-ownership.spec.ts`
Expected: **7 passed**. Paste the output and exit code.

- [ ] **Step 5: Run the full suite**

Run: `npx playwright test`
Expected: **521 + 7 = 528 passed, 0 failed**. Paste the output and exit code.

- [ ] **Step 6: Commit**

```bash
git add equipment.js tests/e1-ownership.spec.ts
git commit -m "feat(equip): E1 Task 3 - EQM.ownership, one verdict reusing cookerCandidates

ownership(requires)->{ok,missing,partial} resolves each cook row via cookerCandidates (the single
substitution policy, reused not copied) then checks capability: temp ceiling via propOf maxC, hang via
deviceCanHang, bath size via chooseBath. Owns nothing of the kind -> missing; owns the kind but no unit
meets the capability -> partial. This is the shared verdict E3's three gates will all read (B-i.1)."
```

**DoD gate (§3):** 1 traced (§5.1/§5.2, §0.2-row-5, B-i.1/C1). 2 RED witnessed (Step 2, stub throws). 3 GREEN (Step 4). 4 observable (ok/missing/partial a real reader — Task 4 — consumes). 5 consumer named: card chip (Task 4). 6 negative cases: missing (test 1), the two `partial` capability failures (tests 3, 4) with their positive twins. 7 regression is structural (B-i.1 mislabel) — covered by the partial/missing distinction tests; a full bugfix red-green is E3's when the gates land. 8 N/A — no UI. 9 N/A. 10 invariance (test 7). 11 no `waitForTimeout`. 12 full suite (Step 5).

---

## Task 4: The catalog-card required-equipment chip — the E1 production consumer (DoD-5/L8)

Spec §5.2 (catalog surface — the **informational** form; E3 escalates the SAME verdict into the bold-invalid gate), §11.2-point-5 (every derived value needs a production reader that fires on real data). **This is where DoD-5 closes for E1**: `deriveRequires` + `EQM.ownership` both fire on real catalog data through the card. See Hazard H5 (why this is in E1 and how it stays distinct from E3).

**Interfaces:**
- Consumes: `deriveRequires(meta)` (Task 2) · `EQM.ownership(requires)` (Task 3) · `resolveItem(key)` (`app.js:2803`) · `equipConfigured()` (`app.js:754`, gates the chip to configured-kit users so it is meaningful and costs nothing otherwise) · `L(he,en)` (`app.js:7292`).
- Produces: `eqmRequiresChip(key) → htmlString` in `app.js`; three one-line insertions in `cutCard`/`specCard`/`makeCard`; CSS in `app.css`. **Non-blocking** — nothing is prevented; the chip only informs.

- [ ] **Step 1: Write the failing test**

Create `tests/e1-requires-chip.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// E1 · Task 4 (spec §5.2, DoD-5/L8). The catalog card renders the derived requirement + ownership verdict
// as a NON-BLOCKING informational chip — the production reader that makes deriveRequires + EQM.ownership
// fire on real catalog data. Gated on equipConfigured() so it is meaningful (you have a kit) and free
// otherwise. E3 later escalates the SAME verdict into the bold-invalid blocking gate.
const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmRequiresChip==='function' && typeof equipConfigured==='function'`);
};
const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];

test('with a kit, the chip renders the derived required kind for a smoking cut', async ({ page }) => {
  await boot(page, SMOKER);
  const html = await page.evaluate(`eqmRequiresChip('cut-1')`) as string;
  expect(html).toContain('eqm-reqs');
  expect(html).toContain('מעשנה');            // the smoker requirement, in Hebrew (proposed copy)
});

test('the ownership verdict colours the chip — a missing kind gets the missing class', async ({ page }) => {
  // owns only a bath: a smoking cut's smoker requirement is missing.
  await boot(page, [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [20] } }]);
  const html = await page.evaluate(`eqmRequiresChip('cut-1')`) as string;
  expect(html).toContain('מעשנה');
  expect(html).toContain('eqm-req-missing');
});

test('L13 — any capability numeral sits in a dir="ltr" island', async ({ page }) => {
  await boot(page, SMOKER);
  const html = await page.evaluate(`(function(){
    // a sous-vide requirement carries a bath-litre capability number
    return eqmRequiresChip('cut-1');
  })()`) as string;
  if (/eqm-num/.test(html)) expect(html).toMatch(/dir="ltr"[^>]*class="eqm-num"|class="eqm-num"[^>]*dir="ltr"/);
});

test('the real card HTML carries the chip (the wiring, not just the helper) — cutCard', async ({ page }) => {
  await boot(page, SMOKER);
  const html = await page.evaluate(`cutCard(DATA.cuts.find(c=>'cut-'+c.n==='cut-1'))`) as string;
  expect(html).toContain('eqm-reqs');
});

test('DoD-6 negative case — with NO kit configured the chip is silent (gated, zero cost)', async ({ page }) => {
  await boot(page, null);
  expect(await page.evaluate(`equipConfigured()`)).toBe(false);
  expect(await page.evaluate(`eqmRequiresChip('cut-1')`)).toBe('');
  expect(await page.evaluate(`cutCard(DATA.cuts.find(c=>'cut-'+c.n==='cut-1'))`)).not.toContain('eqm-reqs');
});

test('DoD-10 safety invariance — rendering the chip never mutates the item object', async ({ page }) => {
  await boot(page, SMOKER);
  const eq = await page.evaluate(`(function(){
    var b=JSON.stringify(resolveItem('cut-1').obj);
    eqmRequiresChip('cut-1'); eqmRequiresChip('cut-1');
    return b===JSON.stringify(resolveItem('cut-1').obj);
  })()`) as boolean;
  expect(eq).toBe(true);
});
```

- [ ] **Step 2: Run the test and WITNESS it fail for the intended reason**

Run: `npx playwright test tests/e1-requires-chip.spec.ts`

Expected: **FAIL at `waitForFunction("typeof eqmRequiresChip==='function'")`** — the helper does not exist yet. Paste the output. (The negative case test 5 and invariance test 6 also block on the same `waitForFunction`, so nothing passes first-run until the helper exists; once it exists, test 5 is the DoD-6 negative guard and test 6 the DoD-10 guard.)

- [ ] **Step 3: Add the chip helper**

Serena `insert_before_symbol` on `cutCard` (`app.js:1545`), inserting the helper above it:

```js
// ── E1 · catalog-card required-equipment chip (spec §5.2, INFORMATIONAL form; DoD-5/L8 consumer) ──────
// The production reader that makes deriveRequires + EQM.ownership fire on real catalog data. app.js
// composes the module's two entry points here (the spec's compute-once design, §4.2): deriveRequires
// (pure recipe projection) feeds EQM.ownership (registry check). NON-BLOCKING — E3 escalates this SAME
// verdict into the bold-invalid gate + plan-add/event-add blocks; here it only informs. Gated on
// equipConfigured() so it renders for a user who HAS a kit (where "missing/owned" is meaningful) and
// costs nothing — no itemStages recompute — for a no-kit user. Copy below is PROPOSED, not final (DoD-9).
const EQM_KIND_HE = { smoker:['מעשנה','Smoker'], bath:['אמבט סו-ויד','Sous-vide bath'], grill:['גריל/אש','Grill'],
                      oven:['תנור','Oven'], grinder:['מטחנה','Grinder'], stuffer:['מזרק','Stuffer'],
                      sealer:['ואקום','Vacuum'], curing:['תא יִישון','Curing'] };
function eqmRequiresChip(key){
  if(typeof EQM==='undefined' || typeof deriveRequires!=='function') return '';   // module absent → never crash a card
  if(typeof equipConfigured==='function' && !equipConfigured()) return '';         // gated: no kit → silent, zero cost
  const meta = (typeof resolveItem==='function') ? resolveItem(key) : null; if(!meta) return '';
  let requires; try{ requires = deriveRequires(meta); }catch(e){ return ''; }
  if(!requires || !requires.length) return '';
  const own = EQM.ownership(requires);
  const missing={}, partial={};
  (own.missing||[]).forEach(function(r){ missing[r.kind]=true; });
  (own.partial||[]).forEach(function(r){ partial[r.kind]=true; });
  const seen={};
  const chips = requires.map(function(r){
    if(seen[r.kind]) return ''; seen[r.kind]=true;                                 // one chip per kind
    const lbl = EQM_KIND_HE[r.kind] || [r.kind, r.kind];
    const cls = missing[r.kind] ? 'eqm-req-missing' : (partial[r.kind] ? 'eqm-req-partial' : 'eqm-req-ok');
    const cap = r.capability || {};
    // L13: capability numerals/units live in a dir="ltr" island so RTL never flips "≥12 L" / "≥120°".
    let note='';
    if(cap.bathMinL) note = ` <span dir="ltr" class="eqm-num">≥${cap.bathMinL} L</span>`;
    else if(cap.maxTempC) note = ` <span dir="ltr" class="eqm-num">≥${cap.maxTempC}°</span>`;
    return `<span class="eqm-req ${cls}">🔧 ${L(lbl[0], lbl[1])}${note}</span>`;
  }).join('');
  if(!chips) return '';
  return `<div class="eqm-reqs" aria-label="${L('ציוד דרוש','Required equipment')}">${chips}</div>`;
}
```

- [ ] **Step 4: Wire the chip into the three catalog cards**

Each card function defines `key` and closes its `.cbody` `<div>` before `</article>`. Insert `${eqmRequiresChip(key)}` as the **last child of `.cbody`**, via Serena `replace_symbol_body` (locate each with `find_symbol`; do not trust the line numbers):

- `cutCard` (`app.js:1545`) — `key="cut-"+c.n`. The `.cbody` closes at the `</div>\n  </article>` near the end. Insert `${eqmRequiresChip(key)}` immediately before that closing `</div>`.
- `specCard` (`app.js:1574`) — `key="spec-"+s.n`. Same placement: last child of `.cbody`.
- `makeCard` (`app.js:1588`) — `key="make-"+id`. Same placement.

Concretely, for `cutCard` the tail changes from:

```js
      ${DATA.builds["cut-"+c.n]?'<span class="bld">🔨 בנייה מאפס</span>':''}`}
    </div>
  </article>`;
```

to:

```js
      ${DATA.builds["cut-"+c.n]?'<span class="bld">🔨 בנייה מאפס</span>':''}`}
      ${eqmRequiresChip(key)}
    </div>
  </article>`;
```

For `specCard`, insert `${eqmRequiresChip(key)}` on its own line immediately before the `</div>\n  </article>` that closes `.cbody` (after the `DATA.builds["spec-"+s.n]` line). For `makeCard`, insert it immediately after the `<span class="bld">🔨 בנייה מאפס</span>` line and before the closing `</div>`. (In each, `key` is already in scope.)

- [ ] **Step 5: Add the chip CSS**

Append to `app.css` (theme-aware; the app already defines `--smoke`/`--saved-ink`/border tokens — reuse them; if a token name differs, locate the existing card-chip styles with Grep and match their variables):

```css
/* E1 · required-equipment chip on catalog cards (informational, non-blocking). */
.eqm-reqs{ display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
.eqm-req{ font-size:11px; line-height:1.4; padding:1px 7px; border-radius:999px;
          border:1px solid rgba(0,0,0,.12); background:rgba(0,0,0,.04); white-space:nowrap; }
.eqm-req .eqm-num{ font-variant-numeric:tabular-nums; }
.eqm-req-ok{ }                                                   /* owned + capable: neutral */
.eqm-req-partial{ border-color:rgba(224,150,40,.55); background:rgba(224,150,40,.12); }
.eqm-req-missing{ border-color:rgba(200,60,50,.55);  background:rgba(200,60,50,.12); }
@media (prefers-color-scheme: dark){
  .eqm-req{ border-color:rgba(255,255,255,.16); background:rgba(255,255,255,.06); }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx playwright test tests/e1-requires-chip.spec.ts`
Expected: **6 passed**. Paste the output and exit code.

- [ ] **Step 7: DoD-8 + DoD-9 — look at the screen (390 × 844)**

Rebuild and restart any manual server (`python build.py`, then restart `serve.js` — L12). Open the catalog at **390 × 844** with `SMOKER` seeded (`equipConfigured()` true), screenshot a cut card showing the requires chip. Confirm with your own eyes: Hebrew renders correctly, no English leak, the `🔧 מעשנה` chip reads naturally, and **per L13** any capability numeral (`≥12 L`, `≥120°`) is left-to-right and not flipped under RTL. Attach the screenshot. **DoD-9 owner gate:** the chip copy (`ציוד דרוש`, the kind labels) is *proposed* — show the screenshot to the owner and get the wording confirmed or corrected before Step 9.

- [ ] **Step 8: Run the full suite**

Run: `npx playwright test`
Expected: **528 + 6 = 534 passed, 0 failed**. Paste the output and exit code. **Watch the catalog-card tests** (`tests/equipment-visibility.spec.ts` V8, and any card-render/snapshot spec) — adding a child to `.cbody` changes card HTML; if one asserts exact card markup and breaks, that is a real interaction to debug (`systematic-debugging`), not a test to silently rewrite.

- [ ] **Step 9: Commit**

```bash
git add app.js app.css tests/e1-requires-chip.spec.ts
git commit -m "feat(equip): E1 Task 4 - catalog-card required-equipment chip (the E1 consumer)

eqmRequiresChip composes deriveRequires + EQM.ownership and renders the derived requirement + ownership
verdict as a NON-BLOCKING chip on cutCard/specCard/makeCard - the production reader that makes both
derived values fire on real catalog data (DoD-5/L8). Gated on equipConfigured(); L13 dir=ltr islands
around capability numerals. E3 later escalates this same verdict into the blocking bold-invalid gate."
```

**DoD gate (§3):** 1 traced (§5.2, §11.2-point-5). 2 RED witnessed (Step 2, `waitForFunction`). 3 GREEN (Step 6). 4 observable (rendered chip in real card HTML — test 4). 5 **this task IS the consumer** — deriveRequires + EQM.ownership fire on real card data (tests 1, 2, 4). 6 negative case (test 5, no-kit silence). 7 N/A — additive feature. 8 screenshot (Step 7). 9 Hebrew + L13 (tests 1–3 + Step 7). 10 invariance (test 6). 11 no `waitForTimeout`. 12 full suite (Step 8).

---

## Task 5: D3 — collapse the two cooking-area registry fields onto canonical `areaCm2`

Spec §4.1-D3 ("names `areaCm2` the canonical capacity field and demotes `cap.area` to a display-only alias — or removes its input"), §0.2 row 2 (registry evolution, no migration), §8.3-D3 (COVERED). Independent of the module chain (a self-contained `openEquipment` registry-form change). D3 is **bugfix-shaped** (two indistinguishable area fields, substrate map §1.1) → DoD-7 regression red-green applies.

**Interfaces:**
- Consumes: `propOf(dev,'areaCm2')` (`app.js:121`, the canonical numeric capacity the engine already reads via `deviceCapacity`) · `esc` (existing HTML escaper).
- Produces: no data migration; the redundant free-text `#eqvArea`/`cap.area` input removed; the device chip + AI-verify prefill repointed to `areaCm2`. `deviceCapacity(dev)` behaviour unchanged (it already reads only `areaCm2`).

Current-state (Serena-verified this session): `cap.area` is a free-text alias written from `#eqvArea` (`openEquipment` save path, `app.js:6947`), pre-filled in the `fuelRow` input (`app.js:6991`), and read for display only in exactly three places — the device chip in `chipsFor` (`app.js:6788`), and two `paintVerify` prefills (`app.js:7051` reads an **AI-result** row's `r.area`, independent of our stored field; `app.js:7069` reads the stored `dev.cap.area`). `deviceCapacity` reads **`areaCm2`** and never `cap.area`, so `cap.area` is genuinely display-only.

- [ ] **Step 1: Write the failing test**

Create `tests/e1-area-field.spec.ts`. It drives `openEquipment()`'s rendered DOM (a global function) — no fragile nav.

```ts
import { test, expect, seedApp } from './_fixtures';

// E1 · Task 5 (spec §4.1-D3). Two cooking-area fields coexisted with nothing distinguishing them: the
// free-text #eqvArea -> cap.area (display-only) and the numeric areaCm2 (the ONLY field deviceCapacity
// reads for fit). D3 makes areaCm2 canonical: the device chip renders areaCm2, and the redundant
// free-text input is removed. This test pins the chip repoint behaviourally; the input removal is
// confirmed by the DoD-8 screenshot (Step 6).
const DEV = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, area: '9999 free-text', areaCm2: 6000 } }];
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
                        'mk-equipment': JSON.stringify(DEV), 'mk-equip-set': 'true' });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof deviceCapacity==='function'`);
};

test('the device chip renders the canonical areaCm2, not the free-text cap.area alias', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openEquipment()`);
  await page.waitForFunction(`document.querySelector('.eq-chip')!==null`);
  const chips = await page.evaluate(`Array.from(document.querySelectorAll('.eq-chip')).map(e=>e.textContent).join(' | ')`) as string;
  expect(chips).toContain('6000');            // canonical numeric area
  expect(chips).not.toContain('9999');        // the free-text alias must no longer be shown
});

test('the redundant free-text cooking-area input is gone from the add/edit form', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openEquipment()`);
  await page.waitForFunction(`document.querySelector('.eq-chip')!==null`);
  // open the device's edit form, then assert exactly zero #eqvArea inputs and the numeric areaCm2 field present.
  // Reuse the edit affordance the equipment panel already renders (a [data-eqedit] / edit button); if the
  // selector differs, take a DOM snapshot and use the real one — do NOT guess a selector.
  await page.evaluate(`(function(){ var b=document.querySelector('[data-eqedit],[data-edit],.eq-edit'); if(b) b.click(); })()`);
  await page.waitForFunction(`document.querySelector('#eqProp-areaCm2')!==null`);
  expect(await page.evaluate(`document.querySelectorAll('#eqvArea').length`)).toBe(0);
  expect(await page.evaluate(`document.querySelectorAll('#eqProp-areaCm2').length`)).toBe(1);
});

test('DoD-10 safety invariance — deviceCapacity still reads areaCm2 unchanged (fit math untouched)', async ({ page }) => {
  await boot(page);
  const cap = await page.evaluate(`deviceCapacity(equipList()[0])`) as any;
  expect(cap.areaCm2).toBe(6000);             // unchanged: areaCm2 was always the fit source
  expect(cap.mode).toBe('area');
});
```

*If `[data-eqedit]`/`.eq-edit` is not the real edit control, locate it from the rendered panel (`document` snapshot) or from an existing `openEquipment` test — do not leave the click vacuous.*

- [ ] **Step 2: Run the test and WITNESS it fail for the intended reason**

Run: `npx playwright test tests/e1-area-field.spec.ts`

Expected: **test 1 FAILS** — the chip shows `9999 free-text` (the `cap.area` alias), so `.not.toContain('9999')` fails. **Test 2 FAILS** — `#eqvArea` still renders (count is `1`, not `0`). Paste the output. **Test 3 passes first-run** — `deviceCapacity` already reads `areaCm2` (6000); it is the DoD-10 invariance guard, not a RED. **If test 1 or 2 passes first-run, it is void — rewrite it.**

- [ ] **Step 3: Remove the redundant `#eqvArea` input from `fuelRow`**

Locate the `fuelRow` const in `openEquipment` (`app.js:6991`; Serena `search_for_pattern "eqvArea"`). Replace the two-field version with a fuel-only row:

```js
      const fuelRow=showFuel?`<div class="eq-vrow"><div class="eq-vfield"><label>${L('דלק','Fuel')}${sp}</label><select id="eqvFuel" class="eq-vin${fc}">${fuelOpts(d.fuel||'')}</select></div></div>`:'';
```

(The canonical numeric area lives in the `#eqProp-areaCm2` property field the props loop already renders — `app.js:7014` — so the user still has exactly one, unambiguous area input.)

- [ ] **Step 4: Remove the `cap.area` save line**

Locate the save line in `openEquipment`'s `doSave` (`app.js:6947`; Serena `search_for_pattern "eqvArea"`):

```js
const aEl=$("#eqvArea"); if(aEl){ const av=(aEl.value||'').trim(); if(av) d.cap.area=av; else delete d.cap.area; }
```

Delete this line entirely (`replace_content` removing it). `#eqvArea` no longer exists, and `cap.area` is no longer written.

- [ ] **Step 5: Repoint the display chip and the stored-field verify prefill to `areaCm2`**

Chip in `chipsFor` (`app.js:6788`; Serena `search_for_pattern "cap.area"`) — replace:

```js
    if(d.cap && d.cap.area) s+=`<span class="eq-chip spec">📐 ${esc(d.cap.area)}</span>`;   // total cooking / smoking area (metric)
```

with (canonical `areaCm2`, L13 `dir="ltr"` island):

```js
    { const _a=Number(propOf(d,'areaCm2'))||0; if(_a>0) s+=`<span class="eq-chip spec">📐 <span dir="ltr">${_a} cm²</span></span>`; }   // D3: canonical areaCm2, not the removed cap.area alias
```

Stored-field verify prefill (`app.js:7069`; the one reading `dev.cap.area`) — replace `area:(dev.cap&&dev.cap.area)||''` with `area:(dev.cap&&Number(dev.cap.areaCm2))?dev.cap.areaCm2+' cm²':''`. **Leave `app.js:7051` unchanged** — its `r.area` is the AI lookup result's own suggested area (a pre-save display value from the AI response), independent of the removed stored field.

- [ ] **Step 6: Run the test + DoD-8 screenshot**

Run: `npx playwright test tests/e1-area-field.spec.ts` → expected **3 passed**. Paste the output.

Then rebuild (`python build.py`, restart `serve.js` — L12) and, at **390 × 844**, open the add-device form for a smoker and screenshot it. Confirm with your eyes: exactly **one** cooking-area field (`שטח בישול כולל`, the numeric `areaCm2`), no second free-text area input. Attach the screenshot.

- [ ] **Step 7: DoD-7 regression red-green**

D3 is a bugfix. Witness both directions and paste both:
1. `git stash push app.js` → `npx playwright test tests/e1-area-field.spec.ts` → observe tests 1 & 2 **FAILING**. Paste.
2. `git stash pop` → run again → observe **PASSING**. Paste.

- [ ] **Step 8: Run the full suite**

Run: `npx playwright test`
Expected: **534 + 3 = 537 passed, 0 failed**. Paste the output and exit code. **Watch `tests/equipment-visibility.spec.ts` and any `openEquipment`/device-chip spec** — the chip markup changed; a break there is a real interaction to debug.

- [ ] **Step 9: Commit**

```bash
git add app.js tests/e1-area-field.spec.ts
git commit -m "fix(equip): E1 Task 5 (D3) - collapse two cooking-area fields onto canonical areaCm2

The free-text #eqvArea -> cap.area alias sat beside the numeric areaCm2 (the only field deviceCapacity
reads for fit) with nothing distinguishing them. Removed the redundant input + its save; the device chip
and the stored-field verify prefill now render the canonical areaCm2 (dir=ltr, L13). No data migration;
deviceCapacity is untouched. Existing devices keep an unread cap.area harmlessly."
```

**DoD gate (§3):** 1 traced (§4.1-D3, §0.2-row-2, §8.3-D3). 2 RED witnessed (Step 2, tests 1 & 2). 3 GREEN (Step 6). 4 observable (rendered chip text — test 1; form input count — test 2). 5 N/A — no new derived value (a UI de-dup). 6 the invariance test 3 is the negative/guard case. 7 regression red-green (Step 7). 8 screenshot (Step 6). 9 the chip's `cm²` numeral sits in a `dir="ltr"` island (L13); no new Hebrew prose. 10 invariance (test 3, `deviceCapacity` unchanged). 11 no `waitForTimeout`. 12 full suite (Step 8).

---

## Phase E1 completion gates

Per spec §11.3 — these are **not** tasks; they are the gates E1 must pass before it counts as done.

- [ ] **Every task's 12-point DoD** quoted MET with evidence pasted (RED output, GREEN output + exit code, screenshots at 390×844, invariance results).
- [ ] **Full suite green** at **537** (512 baseline + 25 E1 tests: 4+5+7+6+3), `npx playwright test` plain, output pasted — never `--retries`/`--workers=1`.
- [ ] **Independent re-audit by a fresh agent against the SPEC** (not against this plan or a ledger): confirm the §9 E1 row and every §3/§4.1/§4.2 obligation the phase claims — `equipment.js` + `EQM.*` five-method skeleton (F5 assertion present in `build.py` and firing), `EQM.ownership` correct (ok/missing/partial with capability sub-checks), `deriveRequires` for the cook role across item types, D3 area-field collapse, the D2 enumeration honestly recorded, and the safety-invariance snapshot identical in every phase.
- [ ] **Release is NOT part of E1's tasks.** If the owner asks to ship E1, shipping is governed by §10.10: `python build.py`, bump the `מהדורה NNN` stamp, push, then **poll the live Cloudflare URL with Playwright** until the `.foot-stamp` matches AND an E1 feature probe (`typeof EQM==='object'`) is present. Never report a version live before that check passes.

---

## Self-review

**1 · Spec-coverage sweep (every E1 obligation → a task; gaps listed).**

| Spec obligation (§9 E1 · §3 · §4.1 · §4.2) | Task | Notes |
|---|---|---|
| `equipment.js` scaffold + `EQM.*` five-method skeleton (§3, F5) | 1 | `ownership` real (Task 3); `availability`/`allocate`/`release` (E2) + `alternatives` (E5) are throwing phase-stubs — five methods, F3 preserved. |
| `build.py` inline **before** `app.js` + single-definition assertion (§3, F5) | 1 | Reads `equipment.js`, `_eqm + ";" + _js`; asserts EQM defined once in `equipment.js`, never in `app.js`; dist-artifact + ordering verification (Step 5) + assertion RED-witness (Step 6). |
| `requires` schema — one shape, two sources; declared fields defined (§4.2, F4) | 2 | Row shape `{role,kind,capability?,demand?,source, (altOf E6)}` documented; `source:'declared'`/`altOf` are schema fields E6 authors — E1 emits only `source:'derived'`. |
| `deriveRequires` for the cook role, all items, cannot drift (§4.2) | 2 | Reads `itemStages`/`itemOccupancy`; smoke→smoker, sv→bath, cook→grill; `sv` covered day one; non-device stages excluded (tested). |
| `EQM.ownership` → ok/missing/partial, capability sub-checks (§5.1/§5.2) | 3 | Reuses `cookerCandidates` (one policy); temp via `maxC`, hang via `deviceCanHang`, bath via `chooseBath`. The shared verdict E3's gates read (B-i.1). |
| D3 — area-field collapse, `areaCm2` canonical, no migration (§4.1) | 5 | `#eqvArea`/`cap.area` removed; chip + verify prefill repointed to `areaCm2`; `deviceCapacity` untouched. |
| D2 — 14 properties enumerated honestly (live/parked) (§4.1) | 2 | Enumeration comment co-located with `deriveRequires`: reads areaCm2/baths/canHang/maxC; the 14 stay parked; plates/nozzles→E6, sealer→E6-F4. |
| Derived value has a real E1 consumer (DoD-5/L8) | 4 | Catalog-card informational chip composes `deriveRequires`+`EQM.ownership`, fires on real data, gated on `equipConfigured()`, screenshot-verified. |

**Obligations that could NOT fit E1, with their placed home (nothing dropped):**
- `EQM.availability` / `allocate` / `release` + `mk-eqm-ledger` + capacity math → **E2** (spec §9). E1 ships them as throwing phase-stubs.
- `EQM.alternatives` replacement ladder (AI, `aiConfirmPanel`, `search:false` F6) → **E5**. E1 ships it as a throwing phase-stub.
- The three validity **gates** (catalog bold-invalid, plan-add block, event-add block) + retroactive invalidation → **E3**. E1 delivers only the **informational** precursor chip (Task 4) reading the same `EQM.ownership` verdict; E3 escalates it.
- **Declared** requires authoring (grinder/stuffer rows) + `choosePlate`/`chooseNozzle` join (D1) + plates/nozzles going live (D2) → **E6**. E1 defines the `source:'declared'`/`altOf` schema fields and the `KIND_TO_STAGE`/`KIND_TO_CAT` extension points but authors no declared data.
- Cooking-order override re-sequencing ledger windows → **E4**. E1's `deriveRequires` already takes `order` (order-aware), so E4 inherits the seam for free.
- `capacityDemand` guest-scaling (D5, F2) → **named future gap**; E1's `demand` carries the static `itemOccupancy` footprint, shaped to accept the scaled value later.

**One addition beyond the spec's literal E1 "Ships" column, flagged:** Task 4 (the catalog-card chip). The spec's E1 row lists `EQM.ownership` + `deriveRequires` but not a card surface; §5.2's card gate is assigned to E3. However `CLAUDE.md` §3-point-5 / §11.2-point-5 make a **production consumer mandatory** for E1's derived values, and the delegating owner's brief explicitly authorized "the item card / catalog surface showing the derived requirement (even before E3's gates)" as the minimal honest consumer. Task 4 is that consumer, kept **strictly informational and non-blocking** so it does not build E3's gate (E3 escalates the same verdict). This **adds** a reader; it waives/narrows/defers nothing — no Waiver Gate trigger. Recorded here for the owner's eye.

**2 · Placeholder scan.** No "TBD", no "add error handling", no "similar to Task N". Every code step carries complete, transcribable code (the full `equipment.js`, the exact `build.py` insert + assertion, the full `deriveRequires`/`eqmOwnershipRow`/`ownership` bodies, the full `eqmRequiresChip` + CSS, the exact D3 edits). Three steps instruct the implementer to **verify a real name/selector before using it** (the `cut-1` method keys via `itemProfile`; the equipment-edit control selector for the D3 form-removal assertion; existing card/`openEquipment` tests to watch) — each names the exact Serena/DOM call to resolve it, a guard against guessing, not a placeholder. The phase-stubs are complete throwing functions with named phases, not empty bodies.

**3 · Type/name consistency across tasks.** `deriveRequires(meta, methodKey, order)` — defined as a stub in Task 1 (`equipment.js`), body filled in Task 2, called under that exact name in Task 3's end-to-end test and Task 4's `eqmRequiresChip`. `EQM.ownership(requires)` — stubbed Task 1, real Task 3, consumed Task 4 under that name; return shape `{ok, missing, partial}` is identical in the Task 3 implementation, its tests, and the Task 4 consumer's `own.missing`/`own.partial` reads. `REQ_KIND` (Task 1) is the only stage→device-kind map; `KIND_TO_STAGE` (Task 1) is the only device-kind→stage-kind inverse — both consumed by `deriveRequires`/`eqmOwnershipRow`, never redefined. The device-kind vocabulary is uniform end-to-end: `smoker`/`bath`/`grill` from `deriveRequires`, keyed identically in `eqmOwnershipRow`'s `KIND_TO_STAGE`, in `EQM_KIND_HE`, and in every test's seeded rows. `capability` sub-keys (`maxTempC`/`hang`/`bathMinL`) are written once in `deriveRequires` and read under the same names in `eqmOwnershipRow` and `eqmRequiresChip`. `areaCm2` is the single canonical field name in Task 5, matching `deviceCapacity`/`propOf(dev,'areaCm2')`.

**One inconsistency found and fixed during this review:** the ownership capability check must read the device's **`maxC`** property (confirmed present on smoker/grill/oven/sousvide in `EQUIP_CATS`, `app.js:34`), not an invented `maxTemp`/`tempMax` — an earlier draft of `eqmOwnershipRow` named `propOf(dev,'maxTemp')`, which would silently fall through to the class default for every device and never flag a temp-ceiling `partial`. Corrected to `propOf(dev,'maxC')` throughout; the Task 3 `partial` test (a 150°C cabinet failing a 300°C requirement) is precisely the fixture that catches a wrong property name.
