# Cooking Paths CP1 — Single-Source Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every surface that shows cooking temps/hours/labels reads ONE accessor over `itemStages` — killing the card-vs-timeline contradictions (105° vs 120°), the work-plan detail contradicting its own row, and the AI grounding contradicting the plan. NO new UX in CP1 (the path panel is CP2).

**Architecture:** `effectiveSchedule(meta, pathKey?)` wraps `itemStages` (+ the existing path→(methodKey, order) resolution) and returns the stage list with cited labels/sub-lines. `itemPaths(meta)` enumerates the item's cited paths (existing combos × cited orders in CP1 — research-added paths are CP3 data). The card/grid/work-plan-detail/AI surfaces re-anchor to the accessor; `composedSteps`/`svSteps`/`soSteps` lose their schedule-number authority (prose re-anchored, numbers never computed locally again).

**Tech Stack:** app.js (+ tests). No equipment.js changes. No data changes in CP1.

## Global Constraints

- Spec (approved 2026-07-25): §3.1 accessor is THE only way any surface obtains cooking temps/hours/labels; §4 surface table is the completeness bar; §5 safety invariance — every rendered temp/hour traces to a cited entry via `itemStages`; `bcheck`/`safe`/`svt` untouched; setpoint fence untouched; no formula paths added.
- OWNER TEST STANDARD (binding, spec §1.3): every task verified by REAL-UI Playwright walks — clicking what a user clicks, asserting rendered text — never page.evaluate-only. Screenshots 390×844 of every touched surface, looked at.
- DATA-FIDELITY witness per task (the DoD-10 form): rendered values === the citation/stage values byte-for-byte for a wired item AND an unwired (fallback) item.
- MACHINE CONTENTION: a bulk-translation GPU job may be running. Targeted specs anytime; FULL suite only if `ollama ps` shows no generation AND scratch/translate-bulk/PROGRESS.log has no in-flight chunk — otherwise DEFER the full-suite witness to the controller (state it; DONE_WITH_CONCERNS).
- Suite baseline 605. Stage only named files; never `git add -A`. Reports `.superpowers/sdd/cp1-task-N-report.md`. Serena for symbol work; stale-comment gate after body replaces.
- Path key format: reuse the existing method-combo keys (`c:smoke_sv`-class) + order suffix where an order applies — CP1 does NOT invent a new key namespace; `itemPaths` returns `{methodKey, order}` pairs with a composed display id.

## File Structure

- `app.js` — new `itemPaths(meta)` + `effectiveSchedule(meta, sel?)` (near itemStages); card cooking-content re-render (`openCut` region); `cutCard` grid line; work-plan detail text; AI grounding builders.
- `tests/cp1-accessor.spec.ts`, `tests/cp1-card-unified.spec.ts`, `tests/cp1-surfaces.spec.ts` — per task.

---

### Task 1: `itemPaths` + `effectiveSchedule` — the accessor

**Files:** Modify `app.js` (insert both functions directly below `itemStages`); Test `tests/cp1-accessor.spec.ts`.

**Interfaces:**
- Consumes: `itemProfile`, `itemStages`, `comboHasSvSmoke`, the `order_svsmoke`/`order_smokesv` fields.
- Produces (Tasks 2-4 rely on EXACTLY): `itemPaths(meta) → [{id, methodKey, order, label, cited:boolean, isDefault:boolean}]` — one entry per profile method; for a sv+smoke combo method ALSO a second entry with `order:'smoke-sv'` when `comboHasSvSmoke(meta, methodKey)` (the cited reverse order); `isDefault` marks the profile's default method in its default order. `effectiveSchedule(meta, sel?) → {stages, path}` where `sel` is `{methodKey?, order?}` (absent → the default path) and `stages` is the raw `itemStages(meta, methodKey, true, order)` output (labels/subs already cited-aware from the v264 waves).

- [ ] **Step 1: failing tests** — `tests/cp1-accessor.spec.ts` (boot pattern from tests/e1-ownership.spec.ts):

```ts
test('itemPaths enumerates cited paths: brisket has the sv+smoke combo in BOTH cited orders + its other methods', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`itemPaths(resolveItem('cut-1')).map(p=>p.id)`) as string[];
  expect(r.some(id=>id.includes('smoke_sv') && !id.includes('rev'))).toBe(true);   // default order entry
  expect(r.some(id=>id.includes('rev'))).toBe(true);                               // cited reverse order entry
  expect(new Set(r).size).toBe(r.length);                                          // unique ids
});
test('reverse-order path appears ONLY where cited (negative case)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-103');   // no order_smokesv (verified in Wave C tests)
    return itemPaths(m).filter(p=>p.order==='smoke-sv').length;
  })()`) as number;
  expect(r).toBe(0);
});
test('effectiveSchedule default === itemStages default (identity, byte-for-byte)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    return JSON.stringify(effectiveSchedule(m).stages)===JSON.stringify(itemStages(m, undefined, true));
  })()`) as boolean;
  expect(r).toBe(true);
});
test('effectiveSchedule respects an explicit selection', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    const s=effectiveSchedule(m, {methodKey:'c:smoke_sv', order:'smoke-sv'}).stages;
    const sm=s.find(x=>x.kind==='smoke');
    return sm ? sm.temp : null;
  })()`) as number;
  expect(r).toBe(75);   // the cited reverse-order warm smoke
});
```

- [ ] **Step 2: RED** — all fail (`itemPaths is not defined`). Paste per-assertion.
- [ ] **Step 3: implement** in app.js below `itemStages`:

```js
// ── Cooking Paths (spec 2026-07-25, CP1). A path = a cited (methodKey, order) pair. itemPaths
// ENUMERATES what the item's citations support — one entry per profile method, plus a reverse-order
// entry where comboHasSvSmoke says the citation exists. NO formula paths: an entry exists iff its
// schedule is cited (CP3 adds research-cited single-device paths as DATA, zero new JS here).
function itemPaths(meta){
  const p = (typeof itemProfile==='function') ? itemProfile(meta) : null;
  if(!p || !p.methods) return [];
  const out = [];
  p.methods.forEach(function(m, i){
    out.push({ id:m.key, methodKey:m.key, order:null, label:m.label||m.key, cited:true, isDefault:i===0 });
    if(m.combo && m.combo.indexOf('sv')>=0 && m.combo.indexOf('smoke')>=0 &&
       typeof comboHasSvSmoke==='function' && comboHasSvSmoke(meta, m.key)){
      out.push({ id:m.key+':rev', methodKey:m.key, order:'smoke-sv',
                 label:(typeof svOrderName==='function'?svOrderName('smoke-sv'):'smoke→sv'),
                 cited:true, isDefault:false });
    }
  });
  return out;
}
// THE one way any surface obtains cooking stages (spec §3.1). sel={methodKey?,order?}; absent → the
// item's default path. Returns itemStages' own output untransformed — labels/sub-lines are already
// cited-aware there (v264 Waves A/C), so every consumer inherits them identically.
function effectiveSchedule(meta, sel){
  const mk = sel && sel.methodKey ? sel.methodKey : undefined;
  const ord = sel && sel.order ? sel.order : undefined;
  return { stages: itemStages(meta, mk, true, ord) || [], path: { methodKey: mk||null, order: ord||null } };
}
```

- [ ] **Step 4: build + GREEN** (`python build.py`, targeted 4/4, VERBATIM). **Step 5: commit** — `git add app.js tests/cp1-accessor.spec.ts` · `feat(paths): CP1 Task 1 - itemPaths + effectiveSchedule (the one schedule accessor)`.

---

### Task 2: The item card renders its cooking content from the accessor

**Files:** Modify `app.js` (`openCut` region ~2243-2320: stat line ~2267, plan steps via `composedSteps`/`svSteps` ~992/1487, raw table ~2304); Test `tests/cp1-card-unified.spec.ts`.

**Interfaces:** Consumes Task 1's accessor. Produces: the card's stat line, step list, and raw-data table show the DEFAULT PATH's stage values (identical numbers to the timeline's default view — the contradiction dies). `svSteps`/`soSteps` schedule NUMBERS (temps/hours) are replaced by reads from the stage list; their prose frames remain (this is the CP1 line the spec §9.4 draws — numbers re-anchored, deep prose unification may extend in CP2).

**Implementer notes:** locate by symbol via Serena. The step generators receive the stages (pass the stage list in, or read via one call at the top of `openCut` and thread it). EVERY number the card prints for smoke/sv/grill stages must come from `effectiveSchedule(meta).stages` — grep the region for `c.smt|c.smh|c.svt|c.svh|smTemp|smoke` literals afterward and account for each remaining reference in the report (display-only leftovers like the sources box are exempt and listed). The negative case: an item with no order data renders IDENTICAL values to today (regression — assert against the catalog values).

- [ ] **Step 1: failing tests** — real-UI: open the catalog → open Brisket's card (copy the walk from scratch/debug-v264/gap1-card-vs-timeline.mjs): (a) the stat line shows the WIRED finish (120°, not 105°) — RED today; (b) the steps text contains the wired values and NOT `105°`; (c) the raw table row matches; (d) contradiction-kill: open the timeline for the same item in the same test — card values === timeline row values (the end-to-end the owner asked for); (e) negative: an unwired item's card values unchanged vs catalog. Screenshots of card + timeline.
- [ ] **Step 2: RED per-assertion. Step 3: implement. Step 4: build + real-UI GREEN + screenshots looked at. Step 5: commit** — `feat(paths): CP1 Task 2 - item card cooking content from effectiveSchedule (contradiction killed)`.

---

### Task 3: Grid card line + work-plan expandable detail

**Files:** Modify `app.js` (`cutCard` ~1731 smoke line; the work-plan `det` text ~6433); Test `tests/cp1-surfaces.spec.ts` (part 1).

**Interfaces:** Consumes the accessor. Produces: the catalog grid card's cook line shows the default path's smoke figures; the work-plan row's expandable detail text derives from the SAME stages as its row label (self-contradiction dies).

- [ ] Steps: RED-first real-UI ((a) grid card line ≠ `105°/3ש` for brisket, matches the wired values; (b) expand a work-plan row: the detail's temps === the row label's temps — RED today), implement, build, GREEN, screenshots, commit — `feat(paths): CP1 Task 3 - grid line + work-plan detail unified`.

---

### Task 4: AI grounding unified + the CP1 gate

**Files:** Modify `app.js` (the copilot/ask/menu grounding builders ~4259-4359 — every place that feeds `smt/smh`-class values into AI context); Test `tests/cp1-surfaces.spec.ts` (part 2).

**Interfaces:** Consumes the accessor. Produces: AI context strings carry the active path's stage values (the assistant can no longer contradict the plan). NOTE: grounding is TEXT for the model — assert the built context string (via the existing test seams for grounding, grep how wave5/ai-trust tests read it) contains the wired values and not the stale ones.

- [ ] Steps: RED-first, implement, GREEN. THEN THE CP1 GATE (this task closes the phase): (a) the full-surface sweep test — for brisket and one seafood item, EVERY §4 surface renders the same cited values (card, grid, timeline, work-plan row+detail, events, AI context) — one test, all assertions; (b) full suite (contention rule: defer to controller if GPU busy); (c) screenshots of every surface, looked at. Commit — `feat(paths): CP1 Task 4 - AI grounding unified; CP1 full-surface gate green`.

---

## Self-review (authoring, 2026-07-25)

1. **Spec coverage:** §3.1 accessor→T1; §3.2 card→T2; §4 table rows: grid/work-plan-detail→T3, AI→T4, timeline/events/voice/EQM already unified (verified v264) — the T4 sweep asserts them anyway; §5 safety — no formula added, fidelity witnesses per task. CP2/3/4 explicitly out.
2. **Placeholders:** T2-T4 are integration tasks with Serena-anchored notes per the E2 precedent; T1 carries complete code. No TBDs.
3. **Type consistency:** `itemPaths` entry shape consistent T1↔(CP2 future); `effectiveSchedule(meta, sel)` signature consistent T1→T2/T3/T4; `sel` shape `{methodKey, order}` matches itemStages' own params.
