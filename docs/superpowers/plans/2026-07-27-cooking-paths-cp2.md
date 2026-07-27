# Cooking Paths CP2 — the item-card path panel (Variant B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render inside every item card a selectable **cooking-paths panel** (approved Variant B — expandable list) that lists *all* of the item's paths from `itemPaths(meta)` — cited ones selectable, CP3 placeholders shown as "בקרוב — מקור בבדיקה" — where selecting a cited path re-renders the card's stat line, step list and raw-data table through `effectiveSchedule` and moves the per-recipe default (O-1), persisted.

**Architecture:** CP2 adds **no new schedule math**. It consumes CP1's `itemPaths(meta)` / `effectiveSchedule(meta, sel)` / `itemStages` — the single stage authority — and re-renders existing *cited* output. A new `mk-item-path` store holds the per-recipe default (distinct from the per-event override `mk-tlstate-<scope>`); with no stored default, resolution is byte-identical to today's `methodRules` default combo.

**Tech Stack:** vanilla JS (`app.js`, inlined by `build.py`), `app.css`, `lang/*.json` i18n dictionaries, Playwright specs under `tests/`.

## Global Constraints

Every task's requirements implicitly include this section.

1. **Safety invariance (DoD-10, spec §5).** No `bcheck` stage, `safe`/`svt` value, temperature or cook duration may be computed or mutated. A path is offered **only when its schedule is cited** — never formula-generated. Each task names its fidelity witness (rendered figures === the path's cited stage values).
2. **Default resolution.** `effectiveSchedule(meta)` with no explicit `sel` resolves the stored per-recipe default; **with no stored default the result is byte-identical to today** — every task touching it must prove that.
3. **i18n (hard).** Every new user-facing string is a **static** `L('<he>','<en>')` literal so the extractor registers it and `build.py` **Guard A** enforces a translation in **every** active language (ru/de/es/fr/it must be added to `lang/<code>.json` in the same task). Numeric/temp/hour readouts are `dir="ltr"` islands (L13).
4. **Reuse, don't fork.** Citations come from the item's existing `c.src.<facet>` / `order_*` data that `srcRow`/`orderNoteHTML` already render — not a parallel citation store.
5. **Test standard.** Real-UI Playwright walks: real clicks, assert rendered DOM, `tests/_fixtures` `seedApp`, `waitForFunction` never `waitForTimeout`. A behavioural claim proven only by `page.evaluate` is not acceptable. Every test must be **witnessed RED for the intended reason** (DoD-2) — a test that passes on first run is void.
6. **Owner copy decisions (fixed).** (1) path-order arrow uses the **existing no-space literal** from `sourcesBlock()`. (2) the smoke-only path cites the same AmazingRibs reference, worded "(טור עישון בלבד)". (3) placeholder rows read "בקרוב — מקור בבדיקה" and tapping one **toasts**, never selects. (4) **no** catalog-grid multi-path hint — scope stays on the card panel. (5) the "חוסך מעשנת" stat **drops when inapplicable** (shown only for sv→smoke).
7. **Line anchors drift.** Tasks 3–9 shift line numbers in `app.js` (Task 3 first, by inserting a line inside `openCut`). Every task re-derives its anchors with `serena`/grep at the start rather than trusting a number written here. Where this plan prints a number it is the **pre-CP2** value, kept only so the content anchor can be recognised.

---

## Task 1 — The per-recipe default path store (O-1): `setItemPath` / `itemDefaultPath`, a REAL `cited` flag, and CP3 placeholder emission

**Spec line:** *"**The default path** is per-recipe data (O-1: the card is where the default lives); absent an explicit default, today's `methodRules` default combo governs (unchanged behavior)."* (spec §2, final bullet) — and *"**`itemPaths(meta) → [{key, label, stages-params, cited:{ref,url,note}, default:boolean}]`** … A path exists ⟺ its schedule is cited"* (spec §2).

**Files:**
- Modify `app.js` — insert the new store block immediately **before** `function itemPaths(meta){` (currently line **4176**); rewrite the body of `itemPaths` (**4176–4190**) and `effectiveSchedule` (**4194–4198**).
- Modify `app.js` line **1872** (`eqmValidity`, the `let paths; try{ paths = itemPaths(meta) || []; }` line) and line **2156** (`eqmValidityWithKit`, the identical line) — filter `cited:false` entries out of the equipment verdict.
- Modify `lang/en.json`, `lang/ru.json`, `lang/de.json`, `lang/es.json`, `lang/fr.json`, `lang/it.json` — the two placeholder-label keys this task introduces (each task carries its OWN new keys' translations, because `build.py` Guard A fails the build the moment a KNOWN key lacks a value in an active language — a task that deferred its translations to Task 2 could not build, let alone test).
- Modify `lang/_extracted.json`, `lang/_callsite-sig.json` — regenerated artifacts (Guard D + the extractor-staleness spec).
- Create `tests/cp2-default-path.spec.ts`.

**Interfaces:**
- **Consumes:** `store.get/set` (app.js 1628–1631), `itemProfile(meta)` (3793), `comboHasSvSmoke(meta,methodKey)` (4217), `svOrderName(k)` (3834), `itemStages(meta,methodKey,ready,order)` (4094), `isProduce(c)` (1208), `L(he,en)` (8706).
- **Produces:**
  - `const MK_ITEM_PATH = 'mk-item-path'` — the localStorage key (a single recipe-scoped map `{itemKey: pathId}`; deliberately **not** `evScope()`-suffixed, unlike `mk-item-cooker-<scope>` — §3.5's per-occurrence override is the existing `mk-tlstate-<evScope>` store, which this must never collide with).
  - `setItemPath(itemKey, pathId)` → `void` — writes/clears the per-recipe default.
  - `storedPathId(meta)` → `string|null` — raw stored id, no validation.
  - `itemDefaultPath(meta)` → `path|null` — the stored id **resolved against the current enumeration** (a stale/uncited id resolves to `null`).
  - `pathCited(meta, methodKey, order)` → `boolean` — the REAL cited flag (D1).
  - `CP2_PENDING_PATHS` → `[{id, label:()=>string}]` — the CP3 placeholder registry.
  - `itemPaths(meta)` → `[{id, methodKey, order, label, cited, isDefault}]` — same shape, now with a real `cited` and a store-driven `isDefault`; **emits `cited:false` placeholder entries** (`methodKey:null, order:null`).
  - `effectiveSchedule(meta, sel)` → `{stages, path:{methodKey, order}}` — unchanged signature; absent fields now fall back to the stored default.

---

- [ ] **Step 1: Verify the anchors with serena before touching anything.**

```bash
# every symbol + line this task edits must be real in the CURRENT app.js
grep -n "function itemPaths\|function effectiveSchedule\|function comboHasSvSmoke\|function svOrderName\|function isProduce\|function metaCut" app.js
sed -n '1872p;2156p' app.js      # the two eqmValidity itemPaths consumers
sed -n '4176,4198p' app.js       # itemPaths + effectiveSchedule bodies
```

Expected: `itemPaths` at 4176, `effectiveSchedule` at 4194, `comboHasSvSmoke` at 4217, `svOrderName` at 3834, `isProduce` at 1208, `metaCut` at 2443; lines 1872 and 2156 are both `let paths; try{ paths = itemPaths(meta) || []; }catch(e){ paths = []; }`. If any differ, re-anchor before editing — do not edit by line number alone.

Symbol-shaped confirmation (Serena, per §10.17):

```
mcp__serena__find_symbol            name_path="itemPaths"           relative_path="app.js"  include_body=true
mcp__serena__find_referencing_symbols name_path="itemPaths"         relative_path="app.js"
mcp__serena__find_symbol            name_path="effectiveSchedule"   relative_path="app.js"  include_body=true
mcp__serena__find_referencing_symbols name_path="effectiveSchedule" relative_path="app.js"
```

`find_referencing_symbols` for `effectiveSchedule` must return exactly **one** production caller — `svSmokeFinish` (4213). That single-caller fact is the blast-radius budget for Step 5 and must be re-confirmed here, not remembered.

- [ ] **Step 2: Write the failing test — a REAL-UI walk proving a stored default moves the card's own rendered number, plus the "nothing stored ⇒ byte-identical" invariance.**

Create `tests/cp2-default-path.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 1 (spec 2026-07-25 §2: "The default path is per-recipe data (O-1: the card is where the
// default lives); absent an explicit default, today's methodRules default combo governs (unchanged
// behavior)"). The store is mk-item-path {itemKey → pathId}; itemPaths reads it for isDefault and
// effectiveSchedule reads it when the caller left a field unspecified.
//
// The BEHAVIOURAL witness is deliberately the CARD, not the model: the brisket's "עישון" stat is
// rendered from svSmokeFinish → effectiveSchedule (app.js 4209-4216, the accessor's ONE production
// caller), so a stored reverse-order default must visibly change 120° → 75° on a real click-through.

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(
    `typeof openCut==='function' && typeof resolveItem==='function' && typeof itemPaths==='function' && typeof effectiveSchedule==='function'`);
};

// real click-through to the brisket card — catalog → בשר אדום → the grid card (same walk as
// tests/cp1-card-unified.spec.ts, which is the reviewed/shipped convention for this item).
const openBrisketCard = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gridCard = page.locator('.card[data-kind="cut"]').filter({ hasText: 'בריסקט' }).first();
  await gridCard.scrollIntoViewIfNeeded();
  await gridCard.click();
  await page.waitForSelector('#panel .panel-body .statline .stat', { timeout: 10000 });
};

const smokeStat = async (page: any) => {
  const stats = await page.locator('#panel .statline .stat').allInnerTexts();
  return stats.find(s => s.includes('עישון')) || `NO-SMOKE-STAT in ${JSON.stringify(stats)}`;
};

// ── (a) INVARIANCE: with NOTHING stored, resolution is byte-identical to today ─────────────────────
test('(a) no stored default → effectiveSchedule === itemStages default, byte-for-byte (unchanged behavior)', async ({ page }) => {
  await boot(page);
  const same = await page.evaluate(`(function(){
    const ids=['cut-1','cut-2','cut-103'];
    return ids.every(function(k){
      const m=resolveItem(k);
      return JSON.stringify(effectiveSchedule(m).stages)===JSON.stringify(itemStages(m, undefined, true));
    });
  })()`) as boolean;
  expect(same, 'absent an explicit default, today\'s default combo must govern — unchanged').toBe(true);
});

test('(a2) no stored default → the brisket card still renders the forward sv→smoke finish', async ({ page }) => {
  await boot(page);
  await openBrisketCard(page);
  expect(await smokeStat(page)).toContain('120°');
});

// ── (b) THE FEATURE: a stored per-recipe default changes the CARD'S OWN rendered number ────────────
test('(b) a stored per-recipe default (reverse order) re-renders the brisket card at the cited 75°, not 120°', async ({ page }) => {
  await boot(page);
  // read the reverse path's id + its cited temp LIVE — never hardcode a schedule value (setup only)
  const info = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    const rev=itemPaths(m).find(function(p){ return p.order==='smoke-sv'; });
    const st=effectiveSchedule(m,{methodKey:rev.methodKey,order:'smoke-sv'}).stages.find(function(s){ return s.kind==='smoke'; });
    return { id:rev.id, temp:st.temp };
  })()`) as { id: string; temp: number };
  expect(info.temp, 'sanity: the cited reverse smoke really differs from the forward 120°').toBe(75);

  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': info.id }) });
  await openBrisketCard(page);
  const stat = await smokeStat(page);
  expect(stat).toContain(`${info.temp}°`);
  expect(stat).not.toContain('120°');
});

test('(b2) itemPaths marks the STORED entry isDefault — and exactly one entry carries it', async ({ page }) => {
  await boot(page);
  const id = await page.evaluate(`itemPaths(resolveItem('cut-1')).find(function(p){return p.order==='smoke-sv';}).id`) as string;
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': id }) });
  const r = await page.evaluate(`(function(){
    const ps=itemPaths(resolveItem('cut-1'));
    return { def: ps.filter(function(p){return p.isDefault;}).map(function(p){return p.id;}), n: ps.length };
  })()`) as { def: string[]; n: number };
  expect(r.def).toEqual([id]);
});

// ── (c) NEGATIVE: a stale stored id can never silently move a schedule ─────────────────────────────
test('(c) negative — a stored id that no longer enumerates falls back to today\'s rule', async ({ page }) => {
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': 'c:does_not_exist' }) });
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1'), ps=itemPaths(m);
    return { firstIsDefault: ps[0].isDefault,
             identical: JSON.stringify(effectiveSchedule(m).stages)===JSON.stringify(itemStages(m, undefined, true)) };
  })()`) as { firstIsDefault: boolean; identical: boolean };
  expect(r.firstIsDefault).toBe(true);
  expect(r.identical).toBe(true);
});

// ── (d) D1: the cited flag is REAL, and the CP3 placeholders are emitted ───────────────────────────
test('(d) itemPaths emits CP3 placeholder entries with cited:false and no methodKey', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const ps=itemPaths(resolveItem('cut-1'));
    const soon=ps.filter(function(p){ return p.cited===false; });
    return { ids: soon.map(function(p){return p.id;}),
             noMethodKey: soon.every(function(p){ return p.methodKey===null; }),
             noneDefault: soon.every(function(p){ return p.isDefault===false; }),
             citedIds: ps.filter(function(p){return p.cited===true;}).map(function(p){return p.id;}) };
  })()`) as any;
  expect(r.ids).toEqual(['oven-only', 'sv-oven']);
  expect(r.noMethodKey).toBe(true);
  expect(r.noneDefault).toBe(true);
  expect(r.citedIds.length, 'the cited entries CP1 enumerated are all still there').toBeGreaterThan(1);
});

test('(d2) the cited flag can actually be false — every enumerated reverse-order path is cited by its order_smokesv ref', async ({ page }) => {
  await boot(page);
  // NON-VACUOUS BY CONSTRUCTION (DoD-2): strip the citation ref on the live DATA object and re-enumerate.
  // A hard-coded `cited:true` keeps saying true → RED; a real flag follows the citation → GREEN. The
  // mutation is restored in a `finally` so a throw inside itemPaths cannot strip brisket's reverse
  // citation for every later assertion on this warm worker page.
  const r2 = await page.evaluate(`(function(){
    const c=DATA.cuts.find(function(x){return x.n===1;});
    const keep=c.order_smokesv.ref;
    try{ delete c.order_smokesv.ref;
         return itemPaths(metaCut(c)).filter(function(p){return p.order==='smoke-sv';}).map(function(p){return p.cited;});
    } finally { c.order_smokesv.ref=keep; }
  })()`) as boolean[];
  expect(r2, 'a reverse path whose citation ref is gone is NOT cited').toEqual([false]);

  // …and across the whole catalog the flag TRACKS the citation rather than being hard-coded either way
  const r = await page.evaluate(`(function(){
    var bad=[], n=0;
    (DATA.cuts||[]).forEach(function(c){
      var m=metaCut(c);
      itemPaths(m).filter(function(p){return p.order==='smoke-sv';}).forEach(function(p){
        n++;
        var ref=c.order_smokesv && c.order_smokesv.ref;
        if(p.cited !== !!ref) bad.push(c.n+':'+p.id);
      });
    });
    return { n: n, bad: bad };
  })()`) as { n: number; bad: string[] };
  expect(r.n, 'sanity: reverse-order paths exist to check').toBeGreaterThan(0);
  expect(r.bad).toEqual([]);   // the flag tracks the citation, it is not hard-coded
});

// ── (e) REGRESSION GUARD: placeholders must never reach the equipment verdict ──────────────────────
test('(e) placeholders are excluded from eqmValidity.okPaths (an uncited path is never "cookable")', async ({ page }) => {
  const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
  await boot(page, { 'mk-equipment': JSON.stringify(SMOKER), 'mk-equip-set': 'true' });
  const r = await page.evaluate(`(function(){
    const v=eqmValidity(resolveItem('cut-1'));
    return { ok: v.okPaths, hasSoon: v.okPaths.indexOf('oven-only')>=0 || v.okPaths.indexOf('sv-oven')>=0 };
  })()`) as { ok: string[]; hasSoon: boolean };
  expect(r.hasSoon, `okPaths was ${JSON.stringify(r.ok)}`).toBe(false);
});
```

- [ ] **Step 3: Run it and WITNESS RED for the intended reason (DoD-2).**

```bash
npx playwright test tests/cp2-default-path.spec.ts --reporter=list
```

Expected failures, and the reason each proves:
- `(b)` → `Error: expect(received).toContain(expected) … Expected substring: "75°" / Received string: "עישון 120° / 1.5ש"` — the store is not read; nothing consumes `mk-item-path`.
- `(b2)` → `Expected: ["c:smoke_sv:rev"] / Received: ["c:smoke_sv"]` — `isDefault` is still the hard-coded `i===0`.
- `(d)` → `Expected: ["oven-only","sv-oven"] / Received: []` — no placeholder is emitted (this is D1's first half).
- `(d2)` → `Expected: [false] / Received: [true]` on the `r2` assertion — the literal proof that `cited:true` is hard-coded (D1). The whole-catalog half of the same test (`r.bad`) would pass vacuously on its own; the `r2` half is what gives it teeth, which is why it is written into the file in Step 2 rather than "amended later".
- `(a)`, `(a2)`, `(c)` are expected **GREEN on first run** and are stated here as *invariance* assertions, not as new behaviour — they exist to fail if Step 4/5 breaks today's semantics. That is their whole job; they are not the RED witness for this task and must not be counted as one.
- `(e)` is **also GREEN on first run** — but for a reason that changes mid-task: today no placeholder is emitted at all, so nothing uncited can reach `okPaths`. It becomes RED the moment Step 4 emits the placeholders and BEFORE Step 5b adds the filter. **Step 5b witnesses it**; do not skip that witness on the grounds that (e) "was already green".

- [ ] **Step 4: Implement — the store, the real `cited` flag, the placeholder registry, and the store-driven `isDefault`.**

Insert immediately **before** `function itemPaths(meta){` (app.js 4176), inside the existing "Cooking Paths" comment block:

```js
// ── CP2 · O-1: the PER-RECIPE default path (spec §2: "The default path is per-recipe data (O-1: the
// card is where the default lives); absent an explicit default, today's methodRules default combo
// governs (unchanged behavior)"). ONE localStorage map {itemKey → pathId}, recipe-scoped.
// DELIBERATELY NOT evScope()-suffixed (unlike mk-item-cooker-<scope>, app.js 289-290, whose store
// pattern this copies): the per-OCCURRENCE override is the existing mk-tlstate-<evScope> store
// (app.js 6148-6150) — spec §3.5, "a plan-level change overrides FOR THAT occurrence only". These two
// stores must never share a key.
const MK_ITEM_PATH='mk-item-path';
function itemPathMap(){ return store.get(MK_ITEM_PATH)||{}; }
function setItemPath(itemKey, pathId){
  if(!itemKey) return;
  const m=itemPathMap();
  if(pathId) m[itemKey]=pathId; else delete m[itemKey];
  store.set(MK_ITEM_PATH, m);
}
function storedPathId(meta){ const k=meta&&meta.key; return k?(itemPathMap()[k]||null):null; }
// The stored default RESOLVED against the item's CURRENT enumeration. A stored id that no longer
// enumerates (gear change, data change, or a CP3 placeholder that never became cited) resolves to
// null → today's rule governs. A stale write can therefore never silently move a schedule.
function itemDefaultPath(meta){
  const id=storedPathId(meta); if(!id) return null;
  const p=(itemPaths(meta)||[]).find(function(x){ return x.id===id && x.cited!==false; });
  return p||null;
}
// THE REAL cited flag (CP2 review defect D1 — it was hard-coded `true`, which stamped "cited" on every
// row and made the placeholder state unreachable). A path is CITED when the card can NAME the source
// behind its schedule: a reverse-ORDER entry is cited only when the item carries the order_smokesv
// citation ref that produced it (comboHasSvSmoke already gates the SAFETY condition, pasteurize:true —
// this gates the ATTRIBUTION). Method entries are cited by construction (spec §2: itemPaths enumerates
// only what the item's own cited catalog schedule supports). Verified over the whole catalog: all 13
// order_smokesv blocks in sources.py carry a ref, so this flips nothing today — test (d2) proves it
// can still return false.
function pathCited(meta, methodKey, order){
  if(order==='smoke-sv'){ const o=meta&&meta.obj&&meta.obj.order_smokesv; return !!(o&&o.ref); }
  return true;
}
// CP3 placeholders (spec §7 research track; owner decision 3, 2026-07-27). The path kinds the research
// batch will fill, surfaced NOW as cited:false rows so the panel ships the state CP3's data will
// trigger. They carry NO methodKey/order and are never selectable, never resolved to stages, and never
// offered to the equipment verdict — so they cannot touch a temp, an hour, or a safety value.
// The label is a THUNK, not a value: L() must run at render time or the string freezes in whichever
// language the page booted in. The moment CP3's data makes the same id a CITED entry above, the
// placeholder stops being emitted — that is the spec's "data + citation only — zero new JS" bar.
const CP2_PENDING_PATHS=[
  { id:'oven-only', label:function(){ return L('תנור בלבד','Oven only'); } },
  { id:'sv-oven',   label:function(){ return L('סו-ויד→תנור','Sous-vide→oven'); } }
];
```

Replace the body of `itemPaths` (4176–4190):

```js
function itemPaths(meta){
  const p = (typeof itemProfile==='function') ? itemProfile(meta) : null;
  if(!p || !p.methods) return [];
  const out = [];
  p.methods.forEach(function(m){
    out.push({ id:m.key, methodKey:m.key, order:null, label:m.label||m.key,
               cited:pathCited(meta, m.key, null), isDefault:false });
    if(m.combo && m.combo.indexOf('sv')>=0 && m.combo.indexOf('smoke')>=0 &&
       typeof comboHasSvSmoke==='function' && comboHasSvSmoke(meta, m.key)){
      out.push({ id:m.key+':rev', methodKey:m.key, order:'smoke-sv',
                 // owner decision 1 (2026-07-27): the path-order arrow is the EXISTING no-space
                 // literal already keyed in all 6 languages — svOrderName's spaced '←' form is the
                 // timeline <select>'s, and is deliberately NOT reused here.
                 label:L('עישון→סו-ויד','Smoke→sous-vide'),
                 cited:pathCited(meta, m.key, 'smoke-sv'), isDefault:false });
    }
  });
  // CP3 placeholders — cuts only, and never produce (an "oven-only" salad is not a research gap).
  if(meta && meta.kind==='cut' && meta.obj && typeof isProduce==='function' && !isProduce(meta.obj) && out.length){
    CP2_PENDING_PATHS.forEach(function(q){
      if(out.some(function(x){ return x.id===q.id; })) return;   // CP3's cited entry wins and suppresses it
      out.push({ id:q.id, methodKey:null, order:null, label:q.label(), cited:false, isDefault:false });
    });
  }
  // O-1: the stored per-recipe default wins. With nothing stored — or a stale/uncited stored id — the
  // FIRST enumerated CITED entry is the default, which is byte-identical to CP1's `isDefault:i===0`
  // (placeholders are appended last and are never cited, so they can never take the slot).
  const want=storedPathId(meta);
  let def=want?out.find(function(x){ return x.id===want && x.cited!==false; }):null;
  if(!def) def=out.find(function(x){ return x.cited!==false; });
  if(def) def.isDefault=true;
  return out;
}
```

> **Waiver-gate note (§4):** the reverse entry's label changes from `svOrderName('smoke-sv')` (`'עישון ← עישון'`-style, spaced `←`) to `L('עישון→סו-ויד','Smoke→sous-vide')` per owner decision 1. This is an owner instruction, not a plan-side reinterpretation; `svOrderName` itself is **untouched**, so the timeline's `<select data-tlorder>` option text and every `selectOption('smoke-sv')` **value** are unchanged (D7 does not fire — no `<option value>` is edited by this task).

- [ ] **Step 5: Implement — `effectiveSchedule` resolves the absent-`sel` case from the stored default.**

Replace `effectiveSchedule` (4194–4198):

```js
function effectiveSchedule(meta, sel){
  // O-1: the per-recipe default fills in ONLY the fields the caller left unspecified. With nothing
  // stored, `def` is null, both fields stay undefined, and this is itemStages' own default — byte-
  // identical to CP1 (test (a) asserts the identity across three items).
  const def=(typeof itemDefaultPath==='function')?itemDefaultPath(meta):null;
  const mk = (sel && sel.methodKey) ? sel.methodKey : (def?def.methodKey:undefined);
  // A caller that NAMED an order — even `order:null`, which means "this path HAS no order" — owns it
  // outright. Only a caller that omitted the field ENTIRELY inherits the stored default's order. The
  // distinction is load-bearing: itemPaths emits the forward sv+smoke entry as `{methodKey:'c:smoke_sv',
  // order:null}`, so a truthiness test would make the forward row inherit a stored REVERSE order and
  // print 75° under the forward citation — a rendered figure that does not trace to the source printed
  // beside it (spec §5 / DoD-10). svSmokeFinish (app.js 4209-4216) calls effectiveSchedule with NO
  // `order` key at all, so it still inherits a stored reverse order for its own combo, unchanged.
  const hasOrd = !!(sel && Object.prototype.hasOwnProperty.call(sel,'order') && sel.order!==undefined);
  const inherit = !hasOrd && !!(def && def.order && (!sel || !sel.methodKey || sel.methodKey===def.methodKey));
  const ord = hasOrd ? (sel.order||undefined) : (inherit?def.order:undefined);
  return { stages: itemStages(meta, mk, true, ord) || [], path: { methodKey: mk||null, order: ord||null } };
}
```

- [ ] **Step 5b: WITNESS the placeholder filter RED before adding it — the filter is a NEW production change and must be proven load-bearing (DoD-2 / DoD-5).**

With Step 4 applied (placeholders emitted) and lines **1872**/**2156** still untouched, run:

```bash
npx playwright test tests/cp2-default-path.spec.ts -g "placeholders are excluded" --reporter=list
```

Expected RED: `expect(received).toBe(expected) — Expected: false / Received: true` with the message `okPaths was ["c:smoke_sv",…,"oven-only","sv-oven"]` — an uncited path counted as cookable, because `eqmValidity` pushes unconditionally when `req` is empty (app.js 1885-1887: `if(!req.length){ okPaths.push(p.id); … return; }`). Paste that output. **Only then** apply the filter below and re-run the same command to GREEN.

Then the two equipment-verdict guards. `eqmValidity` (line **1872**) and `eqmValidityWithKit` (line **2156**) both iterate **every** `itemPaths` entry and call `deriveRequires(meta, p.methodKey, p.order)`; a placeholder with `methodKey:null` returns an empty `req` and would be pushed into `okPaths` as "trivially cookable", corrupting `eqInvPanelHtml`'s fix list. Replace **both** lines with:

```js
  // CP2: placeholders (cited:false, no methodKey) are NOT cookable paths — an uncited path can never
  // satisfy an equipment verdict. Filtered here so E1/E3's okPaths/level logic is unchanged by CP2.
  let paths; try{ paths = (itemPaths(meta)||[]).filter(function(p){ return p.cited!==false; }); }catch(e){ paths = []; }
```

- [ ] **Step 6: Add the two new keys' translations, regenerate the i18n artifacts.**

Add to each of the six files (chrome section, alongside the existing `"סו-ויד→עישון"` entry):

| key | en | ru | de | es | fr | it |
|---|---|---|---|---|---|---|
| `תנור בלבד` | Oven only | Только духовка | Nur Ofen | Solo horno | Four uniquement | Solo forno |
| `סו-ויד→תנור` | Sous-vide→oven | Су-вид → духовка | Sous-vide → Ofen | Cocción al vacío → horno | Cuisson sous vide → four | Cottura sottovuoto → forno |

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py       # second run: Guard A + Guard D must both pass clean
```

Expected on the second `python build.py`: `[i18n:Guard-A] OK — <N> KNOWN keys + <M> names covered in all 6 active langs` and no Guard D drift line, exit 0. A missing translation fails here with `[i18n:Guard-A] … missing: 'תנור בלבד'` — that failure is the gate working, fix the JSON, do not bypass it.

- [ ] **Step 7: Run the test and see it GREEN.**

```bash
npx playwright test tests/cp2-default-path.spec.ts --reporter=list
```
Expected: `8 passed`, exit code 0 — the file defines exactly eight tests: (a), (a2), (b), (b2), (c), (d), (d2), (e). Paste the output.

Then the CP1 contract that must not have moved:

```bash
npx playwright test tests/cp1-accessor.spec.ts tests/cp1-card-unified.spec.ts tests/cp1-surfaces.spec.ts tests/e3-validity.spec.ts tests/e3-retro.spec.ts tests/e1-derive-requires.spec.ts --reporter=list
```
Expected: all pass, exit 0. `cp1-accessor`'s *"effectiveSchedule default === itemStages default (identity, byte-for-byte)"* passing on an empty store **is** the spec's "unchanged behavior" clause, proven by a test written before this task existed.

**Safety / fidelity witness (DoD-10):** this task computes no temp, no hour, no `safe`/`svt`, and adds no `bcheck` stage. `itemStages` is called with the same three arguments it always was — only *which cited path* is named changes, and only when the user's own store names one. Placeholders carry `methodKey:null` and are filtered out of `eqmValidity`/`eqmValidityWithKit`, so they never reach `deriveRequires`. Witness: test **(a)** (byte-identical stage JSON for three items with an empty store), test **(c)** (a stale id cannot move a schedule), test **(e)** (a placeholder is never "cookable").

- [ ] **Step 8: Commit.**

```bash
git add app.js lang/en.json lang/ru.json lang/de.json lang/es.json lang/fr.json lang/it.json lang/_extracted.json lang/_callsite-sig.json tests/cp2-default-path.spec.ts
git commit -m "$(cat <<'EOF'
feat(cp2): per-recipe default path store (O-1) + a real cited flag + CP3 placeholder entries

spec 2026-07-25 §2: "The default path is per-recipe data (O-1: the card is where the default
lives); absent an explicit default, today's methodRules default combo governs (unchanged behavior)".

- mk-item-path {itemKey → pathId}: setItemPath / storedPathId / itemDefaultPath (store pattern
  from setItemCooker, app.js 290). Recipe-scoped, NOT evScope-suffixed — mk-tlstate-<evScope>
  stays the per-occurrence override (spec §3.5).
- itemPaths: isDefault now resolves the STORED default (stale/uncited id → today's rule);
  cited is a REAL flag (pathCited) instead of a hard-coded true (review defect D1); CP3
  placeholders (oven-only, sv-oven) emitted cited:false with no methodKey.
- effectiveSchedule fills in only what the caller left unspecified; a stored order applies only
  to its own methodKey. Empty store → byte-identical to CP1 (asserted on 3 items).
- eqmValidity + eqmValidityWithKit filter cited:false — an uncited path is never cookable.

Safety: no temp/hour/safe/svt/bcheck computed or mutated; itemStages' arguments unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 2 — Path presentation helpers: label, figures (LTR islands), and the per-path citation

**Spec line:** *"**The card's path panel (the owner's #2):** the card lists ALL `itemPaths` entries with their cited schedules compact (per path: device icons, key temps/hours, the citation marker)"* (spec §3, item 3).

**Files:**
- Modify `app.js` — insert four helpers immediately **after** `function comboHasSvSmoke(meta,methodKey){…}` closes (currently line **4222**), i.e. before the `/* ---- per-recipe extras … ---- */` divider at 4224.
- Modify `lang/{en,ru,de,es,fr,it}.json` — the two new keys this task introduces.
- Modify `lang/_extracted.json`, `lang/_callsite-sig.json`.
- Create `tests/cp2-path-presentation.spec.ts`.

**Interfaces:**
- **Consumes:** `itemPaths(meta)` / `effectiveSchedule(meta,sel)` / `pathCited` (Task 1), `L(he,en)` (8706), `store` — none directly.
- **Produces:**
  - `pathIcons(p)` → `string` — emoji run for the path (`🌊`/`💨`/`🔥`/`🎛`), language-neutral.
  - `pathFigures(meta, p)` → `string` — HTML: the path's device stages as `<span dir="ltr">68°/30ש</span> → <span dir="ltr">120°/1.5ש</span>`, read **from `effectiveSchedule` stages only**; `''` for an uncited path.
  - `pathCitation(meta, p)` → `{ref, url}|null` — D6: the order paths read `order_svsmoke` / `order_smokesv`; the smoke-only path reads `order_svsmoke` with the owner's `(טור עישון בלבד)` qualifier (owner decision 2); other paths fall back to `c.src.<facet>`.
  - `pathCiteHTML(meta, p)` → `string` — `✓ מקור מצוטט · <ref>` (`.cite-ok`) or `⏳ בקרוב — מקור בבדיקה` (`.cite-soon`).

---

- [ ] **Step 1: Verify the citation sources are where D6 says they are.**

```bash
sed -n '4217,4224p' app.js                       # comboHasSvSmoke close + the insertion point
sed -n '2844,2862p' app.js                       # sourcesBlock — the ONLY existing order-citation reader
sed -n '21,32p' sources.py                       # brisket order_svsmoke.ref / order_smokesv.ref
```

Expected: `order_svsmoke.ref = 'AmazingRibs — Texas-Style Smoked Brisket'` with a `url`; `order_smokesv.ref = 'Baldwin — pasteurization by thickness'` with a `url`; `sourcesBlock` renders `c.src.{sv,smoke,grill,safe,cure}` via `srcRow` and the two `order_*` blocks via `orderNoteHTML`. Re-anchor if any differ.

```
mcp__serena__find_symbol name_path="sourcesBlock"    relative_path="app.js" include_body=true
mcp__serena__find_symbol name_path="orderNoteHTML"   relative_path="app.js" include_body=true
```

- [ ] **Step 2: Write the failing test.**

Create `tests/cp2-path-presentation.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 2 (spec 2026-07-25 §3 item 3: "the card lists ALL itemPaths entries with their cited
// schedules compact (per path: device icons, key temps/hours, the citation marker)").
//
// The helpers are PURE PRESENTATION over CP1's accessor: every temp/hour they print is READ from
// effectiveSchedule's stages, never recomputed (spec §5). This spec is the model-level contract; the
// rendered-DOM proof is tests/cp2-path-panel.spec.ts (Task 3), which clicks the real panel.

const boot = async (page: any, lang = 'he') => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
  await page.waitForFunction(
    `typeof pathFigures==='function' && typeof pathCitation==='function' && typeof pathCiteHTML==='function' && typeof itemPaths==='function'`);
};

// ── FIDELITY (DoD-10): every printed number === the stage value it came from ───────────────────────
// The expectation is derived from itemStages DIRECTLY, not from a second effectiveSchedule call — a
// test that asks the same accessor the implementation asks can only ever agree with it (it would have
// missed the order-inheritance bug Task 1 Step 5's `hasOwnProperty` guard closes).
test('pathFigures prints ONLY numbers that appear in that path\'s cited stages', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    return itemPaths(m).filter(function(p){return p.cited;}).map(function(p){
      const st=(itemStages(m, p.methodKey, true, p.order||undefined)||[])
        .filter(function(s){ return s.temp!=null; });
      const fig=pathFigures(m,p);
      const nums=(fig.match(/\\d+(?:\\.\\d+)?/g)||[]).map(Number);
      const allowed=[]; st.forEach(function(s){ allowed.push(s.temp, Math.round(s.hours*10)/10); });
      return { id:p.id, fig:fig, rogue:nums.filter(function(n){ return allowed.indexOf(n)<0; }) };
    });
  })()`) as any[];
  expect(r.length).toBeGreaterThan(1);
  for (const row of r) {
    expect(row.rogue, `path ${row.id} printed ${row.fig}`).toEqual([]);
    // spec §5 / DoD-10: `bcheck` is a SAFETY verification stage (temp = safe||tgt, hours 0), never a
    // device setpoint. It must not appear in the compact schedule line, and its 0-hour tail must not
    // render as if it were a cook duration.
    expect(row.fig, 'the bcheck safety temp is never a path figure').not.toContain('/0ש');
  }
  const safe = await page.evaluate(`resolveItem('cut-1').obj.safe`) as number;
  for (const row of r)
    expect(row.fig, `the safety value ${safe}° must not render as a cooking stage`).not.toContain(`${safe}°`);
});

// ── the FORWARD row must not inherit a stored REVERSE order (Task 1 Step 5's hasOwnProperty guard) ──
test('the forward sv→smoke row prints its OWN cited figures even when the reverse path is the stored default', async ({ page }) => {
  await boot(page);
  const rev = await page.evaluate(
    `itemPaths(resolveItem('cut-1')).find(function(p){return p.order==='smoke-sv';}).id`) as string;
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
                        'mk-item-path': JSON.stringify({ 'cut-1': rev }) });
  await page.waitForFunction(`typeof pathFigures==='function' && typeof itemPaths==='function'`);
  const fwdFig = await page.evaluate(`(function(){ const m=resolveItem('cut-1');
    const f=itemPaths(m).find(function(p){ return p.methodKey && p.methodKey.indexOf('smoke_sv')>=0 && !p.order; });
    return pathFigures(m,f); })()`) as string;
  expect(fwdFig, 'the forward row prints the forward cited finish (order_svsmoke, 120°)').toContain('120');
  expect(fwdFig, 'and never the reverse citation\'s 75° under the forward label').not.toContain('75');
});

// ── L13: the WHOLE figure run — numbers AND the arrow — is ONE dir="ltr" island ────────────────────
// A bare '→' left between two isolated LTR islands inside an RTL run is laid out by bidi with the
// logically-first island rightmost, so the arrow points away from the stage it leads to. Asserting
// only that DIGITS live in islands cannot detect that (the stripped remainder holds no digit).
test('L13 — the whole figure run (numbers AND the arrow) is ONE dir="ltr" island', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    const m=resolveItem('cut-1'), out=[];
    itemPaths(m).filter(function(p){return p.cited;}).forEach(function(p){
      const fig=pathFigures(m,p); if(!fig) return;
      const stripped=fig.replace(/<span dir="ltr"[^>]*>[\\s\\S]*?<\\/span>/g,'');
      if(/\\d|→/.test(stripped)) out.push('outside-island '+p.id+' :: '+fig);
      if((fig.match(/dir="ltr"/g)||[]).length!==1) out.push('multi-island '+p.id+' :: '+fig);
    });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
});

// ── D6: the order paths read the order_* citations, not a src facet ───────────────────────────────
test('D6 — the sv→smoke path cites order_svsmoke.ref and the reverse path cites order_smokesv.ref', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1'), c=m.obj;
    const fwd=itemPaths(m).find(function(p){ return p.methodKey && p.methodKey.indexOf('smoke_sv')>=0 && !p.order; });
    const rev=itemPaths(m).find(function(p){ return p.order==='smoke-sv'; });
    return { fwd:pathCitation(m,fwd), rev:pathCitation(m,rev),
             wantFwd:{ref:c.order_svsmoke.ref, url:c.order_svsmoke.url},
             wantRev:{ref:c.order_smokesv.ref, url:c.order_smokesv.url} };
  })()`) as any;
  expect(r.fwd).toEqual(r.wantFwd);
  expect(r.rev).toEqual(r.wantRev);
});

// ── owner decision 2: the smoke-only path cites the SAME AmazingRibs ref + the Hebrew qualifier ────
test('owner decision 2 — the smoke-only path cites the same AmazingRibs ref, worded "(טור עישון בלבד)"', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1'), c=m.obj;
    const so=itemPaths(m).find(function(p){ return p.methodKey==='c:smoke'; });
    return { got: so?pathCitation(m,so):null, base: c.order_svsmoke.ref };
  })()`) as any;
  expect(r.got, 'brisket must enumerate a smoke-only path for this assertion to have teeth').toBeTruthy();
  expect(r.got.ref).toBe(`${r.base} (טור עישון בלבד)`);

  // …and the qualifier belongs to the smoke-ONLY path alone: a smoke+grill route is not that source's
  // column, and mis-attributing a citation is the one thing the Baldwin-backbone doctrine forbids.
  const sg = await page.evaluate(`(function(){ const m=resolveItem('cut-1');
    const p=itemPaths(m).find(function(x){ return x.methodKey==='c:grill_smoke'; });
    return p?pathCitation(m,p):null; })()`) as any;
  if (sg) expect(sg.ref, 'only the smoke-ONLY path carries the smoke-only-column qualifier').not.toContain('טור עישון בלבד');
});

// ── the citation MARKER: cited vs placeholder ─────────────────────────────────────────────────────
test('pathCiteHTML marks cited paths .cite-ok with the ref, and placeholders .cite-soon', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1'), ps=itemPaths(m);
    const c1=ps.find(function(p){return p.cited;}), s1=ps.find(function(p){return p.cited===false;});
    return { cited:pathCiteHTML(m,c1), soon:pathCiteHTML(m,s1), soonFig:pathFigures(m,s1) };
  })()`) as any;
  expect(r.cited).toContain('cite-ok');
  expect(r.cited).toContain('מקור מצוטט');
  expect(r.soon).toContain('cite-soon');
  expect(r.soon).toContain('בקרוב — מקור בבדיקה');
  expect(r.soonFig, 'an uncited path has no schedule to print').toBe('');
});

// ── DoD-9: no English leak in any non-he language ─────────────────────────────────────────────────
for (const lang of ['ru', 'de', 'es', 'fr', 'it']) {
  test(`DoD-9 — the citation marker and placeholder wording are localized in ${lang}`, async ({ page }) => {
    await boot(page, lang);
    const r = await page.evaluate(`(function(){
      const m=resolveItem('cut-1'), ps=itemPaths(m);
      return { soon:pathCiteHTML(m, ps.find(function(p){return p.cited===false;})),
               label:ps.find(function(p){return p.cited===false;}).label };
    })()`) as any;
    expect(r.soon, 'Hebrew must not leak into a non-he language').not.toContain('בקרוב');
    expect(r.soon, 'English fallback is a dict miss, not a translation').not.toContain('Coming soon');
    expect(r.label).not.toContain('תנור בלבד');
    expect(r.label).not.toBe('Oven only');
  });
}
```

- [ ] **Step 3: Run and WITNESS RED.**

```bash
npx playwright test tests/cp2-path-presentation.spec.ts --reporter=list
```
Expected: every test fails in `boot`, at the `waitForFunction` — `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` — because `pathFigures`/`pathCitation`/`pathCiteHTML` do not exist yet. Paste the output. (This is a genuine RED for the intended reason: the helpers are absent. It is not a vacuous pass.)

- [ ] **Step 4: Implement the helpers.**

Insert after `comboHasSvSmoke`'s closing brace (app.js 4222):

```js
// ── CP2 · path PRESENTATION helpers (spec §3 item 3: "the card lists ALL itemPaths entries with their
// cited schedules compact (per path: device icons, key temps/hours, the citation marker)").
// These are PURE PRESENTATION over CP1's accessor: every number printed is READ from the stage objects
// effectiveSchedule returns. Nothing here computes, rounds up, or derives a temp, an hour, a safe
// value or a bcheck stage (spec §5) — the only arithmetic is a one-decimal DISPLAY trim of the hours
// the stage already carries, the same `Math.round(h*10)/10` the scheduler's advice line uses (4075).
const PATH_KIND_ICON={ sv:'🌊', smoke:'💨', grill:'🔥', cook:'🎛', oven:'🎛' };
function pathIcons(p){
  if(!p) return '';
  if(p.cited===false) return '🎛';                    // placeholder: one neutral device glyph
  const mk=String(p.methodKey||'');
  const parts=[];
  if(mk.indexOf('sv')>=0)    parts.push(PATH_KIND_ICON.sv);
  if(mk.indexOf('smoke')>=0) parts.push(PATH_KIND_ICON.smoke);
  if(mk.indexOf('grill')>=0) parts.push(PATH_KIND_ICON.grill);
  if(!parts.length) parts.push(PATH_KIND_ICON.cook);
  if(p.order==='smoke-sv') parts.reverse();           // the row's glyphs read in the path's own order
  return parts.join('');
}
// One display-trimmed hours value straight off the stage. NEVER re-derives from catalog svh/smh/soh.
function pathHours(h){ return (h==null)?null:(Math.round(h*10)/10); }
// The compact schedule: every DEVICE stage of THIS path as "temp°/hoursש", joined by the same no-space
// arrow the sources box already uses (owner decision 1, 2026-07-27). The WHOLE run is one dir="ltr"
// island with `unicode-bidi:isolate` — L13: two separately-isolated fragments with a bare neutral '→'
// between them are laid out by bidi with the logically-first fragment RIGHTMOST, so the arrow points
// away from the stage it leads to (the same class of failure as '≥' flipping to '≤').
//
// The kind whitelist is a spec §5 / DoD-10 requirement, not tidiness: itemStages appends a `bcheck`
// stage carrying `temp: safe||tgt` and `hours: 0` (app.js 4165-4167) — a SAFETY verification target,
// not a device setpoint. A bare `s.temp!=null` filter would print the item's `safe` value as if it
// were a cooking stage ("… → 63°/0ש"), which is exactly the conflation the spec forbids. `rest`,
// `dry`, `note` and `prep` carry no temp and are excluded by the same rule.
const CP_FIGURE_KINDS=['sv','smoke','cook'];       // device stages only — never bcheck/rest/dry/note/prep
function pathFigures(meta, p){
  if(!p || p.cited===false) return '';               // an uncited path has no schedule to print
  let stages=[]; try{ stages=effectiveSchedule(meta,{methodKey:p.methodKey, order:p.order}).stages||[]; }catch(e){ stages=[]; }
  const hh=L('ש','h');
  const bits=stages.filter(function(s){ return s && s.temp!=null && CP_FIGURE_KINDS.indexOf(s.kind)>=0; }).map(function(s){
    const h=pathHours(s.hours);
    return `${s.temp}°${(h!=null&&h>0)?`/${h}${hh}`:''}`;
  });
  return bits.length ? `<span dir="ltr" style="unicode-bidi:isolate">${bits.join(' → ')}</span>` : '';
}
// D6 — WHERE a path's citation actually lives. The two ORDER paths carry their own citation blocks
// (order_svsmoke / order_smokesv, the same objects sourcesBlock's "🔀 השפעת סדר" lines read, app.js
// 2852-2861); everything else falls back to the item's src facet. Owner decision 2 (2026-07-27): the
// SMOKE-ONLY path cites the SAME AmazingRibs reference as sv→smoke, worded "(טור עישון בלבד)" —
// it is the smoke-only column of that one source, not a separate one.
function pathCitation(meta, p){
  if(!p || p.cited===false) return null;
  const c=(meta&&meta.obj)||{};
  const mk=String(p.methodKey||'');
  const hasSV=mk.indexOf('sv')>=0, hasSmoke=mk.indexOf('smoke')>=0;
  if(hasSV && hasSmoke){
    const o=(p.order==='smoke-sv')?c.order_smokesv:c.order_svsmoke;
    if(o&&o.ref) return { ref:o.ref, url:o.url||null };
  }
  // Gated on the smoke-ONLY key, not on a `hasSmoke && !hasSV` substring test: `c:grill_smoke` also
  // satisfies that test, and a smoke+grill route is NOT the smoke-only column of that source. Owner
  // decision 2 is about the smoke-ONLY path, and mis-attributing a citation is the one thing the
  // Baldwin-backbone doctrine forbids.
  if(mk==='c:smoke' && c.order_svsmoke && c.order_svsmoke.ref){
    return { ref:`${c.order_svsmoke.ref} ${L('(טור עישון בלבד)','(smoke-only column)')}`, url:c.order_svsmoke.url||null };
  }
  const s=c.src||{};
  const facet = hasSV ? s.sv : (hasSmoke ? s.smoke : (mk.indexOf('grill')>=0 ? s.grill : null));
  if(facet && facet.ref && facet.ref!=='UNVERIFIED') return { ref:facet.ref, url:facet.url||null };
  return null;
}
// The row's citation MARKER. Cited → the ✓ badge + the source name (proper nouns render as stored,
// exactly as sourcesBlock's srcRow does — citation refs are authored English, never machine-translated).
// Uncited → the CP3 placeholder marker (owner decision 3: the row reads "בקרוב — מקור בבדיקה").
function pathCiteHTML(meta, p){
  if(!p || p.cited===false)
    return `<span class="cite-soon">⏳ ${L('בקרוב — מקור בבדיקה','Coming soon — source under review')}</span>`;
  const cit=pathCitation(meta,p);
  const ok=`<span class="cite-ok">✓ ${L('מקור מצוטט','cited source')}</span>`;
  if(!cit) return ok;
  const link=cit.url?` <a href="${cit.url}" target="_blank" rel="noopener" style="color:var(--ember2);text-decoration:none">↗</a>`:'';
  return `${ok} <span style="color:var(--smoke);font-weight:600">· ${cit.ref}${link}</span>`;
}
```

- [ ] **Step 5: Add the two new keys' translations, regenerate, verify Guard A.**

| key | en | ru | de | es | fr | it |
|---|---|---|---|---|---|---|
| `בקרוב — מקור בבדיקה` | Coming soon — source under review | Скоро — источник проверяется | Demnächst — Quelle wird geprüft | Próximamente — fuente en revisión | Bientôt — source en cours de vérification | Prossimamente — fonte in verifica |
| `(טור עישון בלבד)` | (smoke-only column) | (колонка «только копчение») | (Spalte „nur Räuchern“) | (columna «solo ahumado») | (colonne « fumage seul ») | (colonna «solo affumicatura») |

`מקור מצוטט` and `ש` are **already keyed in all six languages** — reused, not re-added.

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py
```
Expected on the second run: `[i18n:Guard-A] OK …`, `[i18n:Guard-B]` numeric-safety pass, exit 0.

- [ ] **Step 6: Run and see GREEN.**

```bash
npx playwright test tests/cp2-path-presentation.spec.ts --reporter=list
```
Expected: `11 passed`, exit 0 — fidelity, the forward-order regression, L13, D6, owner decision 2, the citation marker, and DoD-9 × 5. Paste it.

**Safety / fidelity witness (DoD-10):** the only arithmetic in this task is `Math.round(h*10)/10` on an hours value the stage already carries (display trim, the same convention as app.js 4075). No `svt`, `safe`, `tgt`, `bcheck` or cook duration is read from the catalog or derived — `pathFigures` reads `s.temp`/`s.hours` off `effectiveSchedule` output only, and the "no rogue number" test asserts that byte-for-byte against the stage list.

- [ ] **Step 7: STAGE ONLY — do NOT commit. Task 3 commits this task's diff together with its own.**

These four helpers have **no production reader** until Task 3 wires them into `cpRowHTML`. Committing them alone would put unreachable functions in the repo at a commit boundary — precisely what `docs/process/skills/no-inert-shipment/SKILL.md` exists to stop and what DoD-5 ("Consumer exists … name the render path AND confirm it fires on the real data") forbids. The tests here are the model-level contract; the rendered-DOM proof arrives with the consumer.

```bash
git add app.js lang/en.json lang/ru.json lang/de.json lang/es.json lang/fr.json lang/it.json \
  lang/_extracted.json lang/_callsite-sig.json tests/cp2-path-presentation.spec.ts
git status --short          # staged, UNCOMMITTED — Task 3 Step 8 commits both halves in one commit
```

Expected: the staged list above and **no new commit** in `git log --oneline -1`. Do not run `git commit` in this task.

---

## Task 3 — The variant-B path panel: row/panel builder in `openCut`, the CSS, placeholder rows, and select-to-set-default

**Spec line:** *"**The card's path panel (the owner's #2):** the card lists ALL `itemPaths` entries with their cited schedules compact (per path: device icons, key temps/hours, the citation marker); the default is selected; tapping another path re-renders the card's schedule from it and (per O-1) sets the per-recipe default. O-2's consult button rides this panel when it lands (E-programme)."* (spec §3, item 3.)

**Files:**
- Modify `app.js` — new builder `cookingPathsPanel(meta)` + wiring `wireCookingPaths(root, meta, reopen)` inserted after `pathCiteHTML` (end of Task 2's block, ~line 4290 after Task 2 lands — re-anchor with serena, do not trust the arithmetic).
- Modify `app.js` **2902/2903** — the panel's render anchor: after the `.statline` closing `</div>` (line 2902) and before `${donenessSelector(c)}` (line 2903).
- Modify `app.js` **2949–2950** — the wiring call, immediately after `showPanel(html);` / `wireEqInvPanel($("#panel"));`.
- Modify `app.css` — append the variant-B block at the end (currently 1780 lines).
- Modify `lang/{en,ru,de,es,fr,it}.json`, `lang/_extracted.json`, `lang/_callsite-sig.json`.
- Create `tests/cp2-path-panel.spec.ts`.

**Interfaces:**
- **Consumes:** `itemPaths(meta)`, `setItemPath(itemKey,pathId)`, `storedPathId(meta)` (Task 1); `pathIcons`, `pathFigures`, `pathCiteHTML` (Task 2); `metaCut(c)` (2443), `showPanel` (3306), `toast(msg)` (3585), `pendingProject`/`curProject` (1648), `openCut(c)` (2864), `L` (8706).
- **Produces:**
  - `cookingPathsPanel(meta)` → `string` — the variant-B DOM (`''` when the item enumerates no paths at all).
  - `wireCookingPaths(root, meta, reopen)` → `void` — expand/collapse, placeholder→toast, cited→persist+re-render. `reopen` is a zero-arg callback the caller supplies to re-render its own card.

---

- [ ] **Step 1: Verify the render anchor and the approved mockup DOM/CSS.**

```bash
sed -n '2899,2905p' app.js        # the statline close + donenessSelector — the insertion point
sed -n '2946,2952p' app.js        # showPanel(html) + wireEqInvPanel — the wiring point
sed -n '88,107p'  mockups/cp2/variant-b-list.html   # the APPROVED CSS block, verbatim
sed -n '124,132p' mockups/cp2/variant-b-list.html   # the APPROVED markup skeleton
grep -n -- "--line2\|--fresh-l\|--fresh:\|--char2\|--char:\|--ash:\|--bone:\|--smoke:\|--ember:" app.css | head
```

Expected: line 2902 is `     </div>` (closing `.statline`), 2903 is `     ${donenessSelector(c)}`; 2949 is `  showPanel(html);`, 2950 the `wireEqInvPanel` line. Every CSS custom property the mockup uses (`--line`, `--line2`, `--char`, `--char2`, `--fresh`, `--fresh-l`, `--ember`, `--ash`, `--bone`, `--smoke`) must already be defined in `app.css` — confirmed present at app.css 5/13/15/16/19. Re-anchor before editing if any line differs.

- [ ] **Step 2: Write the failing test — a real-UI walk over the rendered panel.**

Create `tests/cp2-path-panel.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 3 (spec 2026-07-25 §3 item 3). The APPROVED variant-B panel (mockups/cp2/variant-b-list.html,
// owner-approved 2026-07-27 per §10.9) rendered into the real openCut card. Every assertion below is on
// RENDERED DOM after REAL CLICKS — never page.evaluate on the model (owner standard, spec §1.3).

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(`typeof openCut==='function' && typeof cookingPathsPanel==='function'`);
};

const openBrisketCard = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gridCard = page.locator('.card[data-kind="cut"]').filter({ hasText: 'בריסקט' }).first();
  await gridCard.scrollIntoViewIfNeeded();
  await gridCard.click();
  await page.waitForSelector('#panel #cpList', { timeout: 10000 });
};

const expand = async (page: any) => {
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody') && document.querySelector('#cpListBody').style.display==='block'`);
};

test.beforeEach(async ({ page }) => { await boot(page); });

// ── §3.3 "lists ALL itemPaths entries" — the panel must not narrow the set (review defect D12) ─────
test('the panel lists ALL itemPaths entries — cited rows AND the CP3 placeholder rows', async ({ page }) => {
  await openBrisketCard(page);
  await expand(page);
  const domIds = await page.locator('#cpListBody .cp-row').evaluateAll(
    (els: Element[]) => els.map(e => e.getAttribute('data-id')));
  const modelIds = await page.evaluate(`itemPaths(resolveItem('cut-1')).map(function(p){return p.id;})`) as string[];
  expect(domIds).toEqual(modelIds);                                     // ALL, in order, none dropped
  expect(domIds).toContain('oven-only');                                // owner decision 3 / D1
  expect(await page.locator('#cpListBody .cp-row.soon').count()).toBe(2);
});

// ── the panel sits below the stat line, above the doneness selector (§3.3 layout) ─────────────────
test('the panel renders between the stat line and the doneness selector', async ({ page }) => {
  await openBrisketCard(page);
  const order = await page.evaluate(`(function(){
    const kids=[].slice.call(document.querySelector('#panel .panel-body').children);
    const ix=function(sel){ return kids.findIndex(function(k){ return k.matches(sel)||k.querySelector(sel); }); };
    return { stat: ix('.statline'), panel: ix('#cpList') };
  })()`) as { stat: number; panel: number };
  expect(order.panel).toBeGreaterThan(order.stat);
  expect(order.panel).toBeGreaterThan(-1);
});

// ── the default is pre-selected and carries the badge (§3.3 "the default is selected") ────────────
test('the default path is pre-selected: .on + the ברירת מחדל badge, on exactly one row', async ({ page }) => {
  await openBrisketCard(page);
  await expand(page);
  expect(await page.locator('#cpListBody .cp-row.on').count()).toBe(1);
  expect(await page.locator('#cpListBody .cp-row.on .cp-def-badge').count()).toBe(1);
  expect(await page.locator('#panel #cpListMain .cp-def-badge').count()).toBe(1);
});

// ── D5 + D2 + D4: selecting a path MOVES the badge and re-renders the CARD'S OWN numbers ──────────
test('D5/D2/D4 — tapping the reverse-order row moves the default badge AND re-renders the stat line and raw table', async ({ page }) => {
  await openBrisketCard(page);
  await expand(page);
  const revRow = page.locator('#cpListBody .cp-row[data-id$=":rev"]');
  await expect(revRow).toHaveCount(1);
  const revId = await revRow.getAttribute('data-id');

  await revRow.click();
  await page.waitForFunction(
    `(function(){ const r=document.querySelector('#cpListBody .cp-row.on, #panel [data-id="${revId}"]');
                  const on=document.querySelector('#panel .cp-row.on'); return !!on && on.getAttribute('data-id')==='${revId}'; })()`);

  // D5 — the badge MOVED (it is not baked into render-time HTML of the old default)
  const badgeRow = await page.locator('#panel .cp-row').filter({ has: page.locator('.cp-def-badge') })
    .first().getAttribute('data-id');
  expect(badgeRow).toBe(revId);

  // D2 — the CARD'S OWN stat line now shows the reverse path's cited 75°, not the forward 120°
  const stats = await page.locator('#panel .statline .stat').allInnerTexts();
  const smoke = stats.find(s => s.includes('עישון'));
  expect(smoke, `stat line was ${JSON.stringify(stats)}`).toContain('75°');
  expect(smoke).not.toContain('120°');

  // D4 — the RAW-DATA TABLE re-rendered from the same path. Matched on the SCHEDULE row's full label:
  // a bare 'סו-ויד+עישון' substring also matches the unconditional reference row
  // 'טיפול באמצע (סו-ויד+עישון)', so a .find() on it would depend on row order.
  // (The value follows the stored default here because svSmokeFinish asks effectiveSchedule for the
  // sv+smoke combo WITHOUT naming an order, so it inherits the stored reverse order for that combo —
  // Task 1 Step 5. Task 7 later gives the table its own path presentation.)
  const rawRows = await page.locator('#panel .raw').first().locator('table tr').allInnerTexts();
  const rawSmoke = rawRows.find(r => r.includes("טמפ' / זמן עישון (סו-ויד+עישון)"));
  expect(rawSmoke, `raw rows were ${JSON.stringify(rawRows)}`).toContain('75°C');
  expect(rawSmoke).not.toContain('120°C');
});

// ── O-1: the selection PERSISTS as the per-recipe default across a full reopen ────────────────────
test('O-1 — the selection persists: close, reopen the card, the same row is still the default', async ({ page }) => {
  await openBrisketCard(page);
  await expand(page);
  const revId = await page.locator('#cpListBody .cp-row[data-id$=":rev"]').getAttribute('data-id');
  await page.locator(`#cpListBody .cp-row[data-id="${revId}"]`).click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='${revId}'`);

  await page.click('#panel .x');
  await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);
  await openBrisketCard(page);
  await expand(page);
  expect(await page.locator('#panel .cp-row.on').getAttribute('data-id')).toBe(revId);
});

// ── D9 + owner decision 3: tapping a PLACEHOLDER toasts and NEVER selects ─────────────────────────
test('D9 — tapping a "soon" row (a row the wiring really bound) toasts and does not select it', async ({ page }) => {
  await openBrisketCard(page);
  await expand(page);
  const before = await page.locator('#panel .cp-row.on').getAttribute('data-id');
  const soon = page.locator('#cpListBody .cp-row.soon').first();
  const soonId = await soon.getAttribute('data-id');

  // the row must actually carry the listener the click will fire — prove it, then click it
  expect(await soon.evaluate((el: any) => !!el.__cpBound), 'the soon row must be a WIRED row').toBe(true);
  await soon.click();

  await page.waitForFunction(`document.querySelector('#toast') && document.querySelector('#toast').classList.contains('show')`);
  expect(await page.locator('#toast').innerText()).toContain('מקור מצוטט');
  expect(await page.locator('#panel .cp-row.on').getAttribute('data-id')).toBe(before);   // selection unmoved
  expect(await page.locator(`#panel .cp-row[data-id="${soonId}"].on`).count()).toBe(0);
  expect(await page.locator(`#panel .cp-row[data-id="${soonId}"] .radio`).count(), 'no radio on a soon row').toBe(0);
});

// ── the placeholder row's own copy (owner decision 3) ─────────────────────────────────────────────
test('owner decision 3 — the placeholder rows read "בקרוב — מקור בבדיקה", exactly once per row', async ({ page }) => {
  await openBrisketCard(page);
  await expand(page);
  const txt = await page.locator('#cpListBody .cp-row.soon').first().innerText();
  expect(txt).toContain('בקרוב — מקור בבדיקה');
  expect(txt.split('בקרוב — מקור בבדיקה').length - 1,
    'the owner asked for that copy once — the figure slot must stay empty on a placeholder row').toBe(1);
  // L13 (Task 2): a cited row's whole figure run is ONE isolated LTR island, arrow included
  expect(await page.locator('#cpListBody .cp-row.on .crfig span[dir="ltr"]').count()).toBe(1);
});

// ── DoD-9 Hebrew/i18n: no English leak, count pill singular/plural ────────────────────────────────
test('DoD-9 — the count pill agrees in number (Hebrew)', async ({ page }) => {
  await openBrisketCard(page);
  const pill = await page.locator('#panel #cpListCount').innerText();
  const n = await page.evaluate(`itemPaths(resolveItem('cut-1')).length`) as number;
  expect(n).toBeGreaterThan(1);
  expect(pill).toContain(String(n));
  expect(pill).toContain('מסלולים');
  expect(pill).not.toContain('מסלול אחד');
});

for (const lang of ['ru', 'de', 'es', 'fr', 'it']) {
  test(`DoD-9 — the panel chrome is localized in ${lang}, no Hebrew and no English fallback`, async ({ page }) => {
    await boot(page, { 'mk-lang': JSON.stringify(lang) });
    await openBrisketCard(page);
    await expand(page);
    const txt = await page.locator('#panel #cpList').innerText();
    expect(txt).not.toContain('בקרוב');
    expect(txt).not.toContain('מסלולים');
    expect(txt).not.toContain('Cooking paths');
    expect(txt).not.toContain('Coming soon');
  });
}

// ── DoD-8 visual evidence at 390×844 ──────────────────────────────────────────────────────────────
test('DoD-8 — screenshots at 390×844: collapsed, expanded, after a switch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBrisketCard(page);
  await page.locator('#panel').screenshot({ path: 'mockups/cp2-panel-collapsed-390x844.png' });
  await expand(page);
  await page.locator('#panel').screenshot({ path: 'mockups/cp2-panel-expanded-390x844.png' });
  const revId = await page.locator('#cpListBody .cp-row[data-id$=":rev"]').getAttribute('data-id');
  await page.locator(`#cpListBody .cp-row[data-id="${revId}"]`).click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='${revId}'`);
  await page.locator('#panel').screenshot({ path: 'mockups/cp2-panel-after-switch-390x844.png' });
});
```

- [ ] **Step 3: Run and WITNESS RED.**

```bash
npx playwright test tests/cp2-path-panel.spec.ts --reporter=list
```
Expected: every test fails in `boot` at `waitForFunction` — `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` — `cookingPathsPanel` does not exist. Paste the output. After Step 4 renders the DOM but before Step 5 wires it, re-run to witness the *second* RED shape: the "D5/D2/D4" and "D9 soon-row" tests fail on `el.__cpBound` / an unmoved `.cp-row.on` — proving the wiring, not just the markup, is what those tests measure.

- [ ] **Step 4: Implement the builder + the CSS.**

Insert after `pathCiteHTML` in app.js:

```js
// ── CP2 · the CARD'S PATH PANEL (spec §3 item 3; owner-approved variant B, mockups/cp2/variant-b-list.html,
// §10.9 visual approval 2026-07-27). An expandable list: a collapsed header naming the current default,
// and a radio list of EVERY itemPaths entry — cited rows selectable, CP3 placeholder rows shown but not
// (owner decision 3). Layout leaves the header's END slot free so O-2's consult button "rides this panel
// when it lands" without a re-layout.
function cpCountLabel(n){
  return (n===1) ? L('מסלול אחד','one path') : `${n} ${L('מסלולים','paths')}`;
}
function cpDefBadge(){ return `<span class="cp-def-badge">${L('ברירת מחדל','Default')}</span>`; }
function cpRowHTML(meta, p){
  const cls=`cp-row${p.isDefault?' on':''}${p.cited===false?' soon':''}`;
  const radio=(p.cited===false)?'':'<div class="radio"></div>';   // a placeholder is not a choice
  // A placeholder's figure slot is EMPTY: pathCiteHTML already prints "⏳ בקרוב — מקור בבדיקה" on the
  // line directly below, and the owner asked for that copy once, not twice in the same row.
  const fig=(p.cited===false) ? '' : pathFigures(meta,p);
  return `<div class="${cls}" data-id="${p.id}" role="option" aria-selected="${p.isDefault?'true':'false'}">`+
         radio+
         `<div class="crmain">`+
           `<div class="crtitle">${pathIcons(p)} ${p.label}${p.isDefault?cpDefBadge():''}</div>`+
           `<div class="crfig">${fig}</div>`+
           `<div class="crcite">${pathCiteHTML(meta,p)}</div>`+
         `</div></div>`;
}
function cpHeadMainHTML(meta, cur){
  if(!cur) return '';
  return `${pathIcons(cur)} ${cur.label}${cur.isDefault?cpDefBadge():''}`;
}
function cookingPathsPanel(meta){
  let paths=[]; try{ paths=itemPaths(meta)||[]; }catch(e){ paths=[]; }
  if(!paths.length) return '';                       // nothing cited to offer — never invent a panel
  const cur=paths.find(function(p){ return p.isDefault; })||paths[0];
  return `<div class="cp-list" id="cpList" aria-label="${L('מסלולי בישול','Cooking paths')}">`+
    `<button class="cp-list-head" id="cpListHead" type="button" aria-expanded="false" aria-controls="cpListBody">`+
      `<span class="cp-lh-main" id="cpListMain">${cpHeadMainHTML(meta,cur)}</span>`+
      `<span class="cp-lh-count" id="cpListCount"><span>${cpCountLabel(paths.length)}</span><span class="chev">▾</span></span>`+
    `</button>`+
    `<div class="cp-list-body" id="cpListBody" role="listbox" style="display:none">`+
      paths.map(function(p){ return cpRowHTML(meta,p); }).join('')+
    `</div></div>`;
}
```

Render anchor — app.js, between line **2902** (`     </div>`, closing `.statline`) and **2903** (`     ${donenessSelector(c)}`), insert:

```js
     ${typeof cookingPathsPanel==='function'?cookingPathsPanel(meta):''}
```

Append to `app.css` (end of file — the approved mockup block, ported to the project's `calc(Npx * var(--fscale))` font convention; no `prefers-color-scheme` query, same reason as the `.eqm-req`/`.eq-inv` blocks above it):

```css
/* CP2 Task 3 (spec 2026-07-25 §3 item 3) · the card's COOKING PATHS panel — the owner-approved
   variant B (mockups/cp2/variant-b-list.html, §10.9 approval 2026-07-27). Same inline-var mechanism
   as the .eqm-req / .eq-inv blocks above: theme tokens only, no media query. */
.cp-list{ margin:18px 0 4px; border:1.5px solid var(--line2); border-radius:16px; background:var(--char2); overflow:hidden; }
.cp-list-head{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:none; border:none; padding:14px 16px; cursor:pointer; text-align:start; font-family:var(--font-body); }
.cp-lh-main{ display:flex; align-items:center; gap:8px; font-weight:800; font-size:calc(14px * var(--fscale)); color:var(--bone); }
.cp-def-badge{ font-size:calc(9.5px * var(--fscale)); font-weight:800; background:var(--fresh-l); color:var(--fresh);
  padding:2px 8px; border-radius:999px; white-space:nowrap; }
.cp-lh-count{ display:flex; align-items:center; gap:5px; font-size:calc(12px * var(--fscale)); color:var(--ash); font-weight:700; flex:0 0 auto; }
.cp-lh-count .chev{ transition:transform .2s; display:inline-block; }
.cp-lh-count.open .chev{ transform:rotate(180deg); }
.cp-list-body{ border-top:1px solid var(--line2); }
.cp-row{ display:flex; align-items:center; gap:10px; padding:12px 16px; border-top:1px solid var(--line); cursor:pointer; }
.cp-row:first-child{ border-top:none; }
.cp-row .radio{ width:18px; height:18px; border-radius:50%; border:2px solid var(--line2); flex:0 0 auto;
  display:grid; place-items:center; background:var(--char); }
.cp-row.on .radio{ border-color:var(--ember); }
.cp-row.on .radio:after{ content:''; width:9px; height:9px; border-radius:50%; background:var(--ember); }
.cp-row .crmain{ flex:1; min-width:0; }
.cp-row .crtitle{ font-weight:700; font-size:calc(13.5px * var(--fscale)); color:var(--bone);
  display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.cp-row .crfig{ font-size:calc(12px * var(--fscale)); color:var(--ash); margin-top:2px; }
.cp-row .crcite{ font-size:calc(11px * var(--fscale)); margin-top:2px; }
.cp-row.soon{ opacity:.55; cursor:default; }
.cite-ok{ display:inline-flex; align-items:center; gap:3px; color:var(--fresh); font-weight:800; }
.cite-soon{ display:inline-flex; align-items:center; gap:3px; color:var(--terra-d); font-weight:800; }
```

- [ ] **Step 5: Implement the wiring — expand/collapse, placeholder→toast, cited→persist + re-render.**

Insert after `cookingPathsPanel` in app.js:

```js
// Wiring for the path panel. `reopen` is a zero-arg callback the CALLER supplies to re-render its own
// card — CP2 review defect D2/D4: a path switch must re-render the CARD'S OWN numbers (openCut computes
// smtV/smhV locally at 2873-2874 and stamps them into the stat line AND the raw-data table), so
// re-rendering a sub-div would leave stale figures beside a moved badge. The whole card is the unit of
// re-render, and every number in it comes back through effectiveSchedule — which Task 1 taught to read
// the default we just wrote. Nothing here computes a temp, an hour, or a safety value.
function wireCookingPaths(root, meta, reopen){
  const host=root&&root.querySelector('#cpList'); if(!host) return;
  const head=host.querySelector('#cpListHead'), body=host.querySelector('#cpListBody'),
        count=host.querySelector('#cpListCount');
  if(head&&body&&count){
    head.addEventListener('click', function(){
      const open=body.style.display!=='block';
      body.style.display=open?'block':'none';
      count.classList.toggle('open', open);
      head.setAttribute('aria-expanded', open?'true':'false');
    });
  }
  host.querySelectorAll('.cp-row').forEach(function(row){
    row.__cpBound=true;   // firing-guard (L19): the test proves it clicked a row the wiring really bound
    row.addEventListener('click', function(){
      const id=row.getAttribute('data-id');
      let p=null; try{ p=(itemPaths(meta)||[]).find(function(x){ return x.id===id; }); }catch(e){ p=null; }
      if(!p) return;
      if(p.cited===false){        // owner decision 3: a placeholder TOASTS, it never selects
        toast(L('המסלול הזה עדיין בבדיקת מקורות — יתווסף כשיהיה לו מקור מצוטט',
                'This path is still under source review — it will be added once it has a cited source'));
        return;
      }
      if(row.classList.contains('on')) return;      // already the default — nothing to move
      setItemPath(meta.key, id);                    // O-1: the card is where the default lives
      if(typeof reopen==='function') reopen();
    });
  });
}
```

Wire it in `openCut`, immediately after line **2950** (`if(typeof wireEqInvPanel==='function') wireEqInvPanel($("#panel"));`):

```js
  // CP2 (spec §3 item 3): tapping a path sets the per-recipe default and re-renders the card FROM it.
  // The re-render is a full openCut() — the card's stat line (2888-2902) and raw-data table (2921-2946)
  // both bake smtV/smhV computed at 2873-2874, so nothing short of re-running the builder gets them
  // consistent with the new default (review defect D2/D4). `pendingProject=curProject` before the call
  // is the app's own established re-open idiom (app.js 4366) — openCut's first line moves
  // pendingProject into curProject, so omitting it would silently drop the project context.
  // Panel scroll is restored because showPanel (3313) hard-resets it to 0.
  if(typeof wireCookingPaths==='function') wireCookingPaths($("#panel"), meta, function(){
    const body=$("#panel").querySelector('.panel-body');
    const y=body?body.scrollTop:0;
    pendingProject=curProject;
    openCut(c);
    const nb=$("#panel").querySelector('.panel-body'); if(nb) nb.scrollTop=y;
  });
```

- [ ] **Step 6: Add the new keys' translations, regenerate, verify Guard A.**

| key | en | ru | de | es | fr | it |
|---|---|---|---|---|---|---|
| `מסלולי בישול` | Cooking paths | Способы приготовления | Garwege | Rutas de cocción | Parcours de cuisson | Percorsi di cottura |
| `מסלול אחד` | one path | один способ | ein Garweg | una ruta | un parcours | un percorso |
| `מסלולים` | paths | способов | Garwege | rutas | parcours | percorsi |
| `המסלול הזה עדיין בבדיקת מקורות — יתווסף כשיהיה לו מקור מצוטט` | This path is still under source review — it will be added once it has a cited source | Этот способ ещё проходит проверку источников — он появится, когда у него будет цитируемый источник | Dieser Garweg wird noch auf Quellen geprüft — er kommt hinzu, sobald eine zitierte Quelle vorliegt | Esta ruta aún está en revisión de fuentes: se añadirá cuando tenga una fuente citada | Ce parcours est encore en cours de vérification des sources — il sera ajouté dès qu'il aura une source citée | Questo percorso è ancora in verifica delle fonti: verrà aggiunto quando avrà una fonte citata |

`ברירת מחדל` is **already keyed in all six languages** — reused, not re-added.

**Disclosed limitation (not a waiver — no spec line is narrowed):** the dict is binary singular/plural, so Russian's few-form (2–4 → *способа*) cannot be expressed; `способов` is used for every n>1, which is correct for 0 and 5+ (brisket renders 5). This matches the app's existing `__units__` convention (`"סועדים": "гости"`). Raise it with the owner if he wants a three-form mechanism — do not silently add one.

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py
```
Expected: `[i18n:Guard-A] OK …`, exit 0.

- [ ] **Step 7: Run and see GREEN, then look at the screenshots.**

```bash
npx playwright test tests/cp2-path-panel.spec.ts --reporter=list
```
Expected: `14 passed`, exit 0 — ALL-entries, layout, default pre-selected, D5/D2/D4, O-1 persistence, D9 soon-row, owner decision 3, the Hebrew count pill, DoD-9 × 5, DoD-8. Paste the output.

```bash
# DoD-8: actually LOOK at all three, at 390×844 — do not tick this from the file existing
ls -l mockups/cp2-panel-collapsed-390x844.png mockups/cp2-panel-expanded-390x844.png mockups/cp2-panel-after-switch-390x844.png
```
Open each and confirm against `mockups/cp2/variant-b.png`: the collapsed header names the default with its badge; the expanded list shows every row with icons, LTR figure islands and a citation marker; the two placeholder rows are dimmed with no radio; after the switch the badge and the filled radio have both moved and the stat line reads 75°.

Then the neighbouring contracts:

```bash
npx playwright test tests/cp1-card-unified.spec.ts tests/cp1-surfaces.spec.ts tests/cp2-default-path.spec.ts tests/cp2-path-presentation.spec.ts tests/e3-validity.spec.ts tests/i18n-completeness.spec.ts tests/i18n-extractor.spec.ts tests/i18n-Lcontract.spec.ts --reporter=list
```
Expected: all pass, exit 0.

**Safety / fidelity witness (DoD-10):** the panel renders only strings; every number in it comes from `pathFigures` → `effectiveSchedule` stages (Task 2's fidelity assertion covers it), and the select handler's entire mutation is `setItemPath(meta.key, id)` — one localStorage write of a path **id**. No `bcheck` stage, `safe`, `svt`, temp or duration is computed or mutated. Placeholder rows return before any write, so an uncited path can never become the default. The card re-render is a re-invocation of the *existing* `openCut`, which re-derives through the same accessor — the D5/D2/D4 test asserts the re-rendered stat line and raw table equal the newly selected path's cited values (75°C), not the old ones.

- [ ] **Step 8: Commit — Task 2's staged helpers AND this task's consumer, in ONE commit.**

Task 2 deliberately left its diff staged and uncommitted (no production reader until now); this commit is where those helpers acquire one, so both halves land together and no commit boundary carries inert code.

```bash
git add app.js app.css lang/en.json lang/ru.json lang/de.json lang/es.json lang/fr.json lang/it.json lang/_extracted.json lang/_callsite-sig.json tests/cp2-path-presentation.spec.ts tests/cp2-path-panel.spec.ts mockups/cp2-panel-collapsed-390x844.png mockups/cp2-panel-expanded-390x844.png mockups/cp2-panel-after-switch-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): the card's cooking-paths panel (owner-approved variant B) + select-to-set-default

spec 2026-07-25 §3 item 3: "the card lists ALL itemPaths entries with their cited schedules
compact ...; the default is selected; tapping another path re-renders the card's schedule from
it and (per O-1) sets the per-recipe default."

- pathIcons / pathFigures / pathCitation / pathCiteHTML (Task 2's presentation helpers, committed
  here with their first production reader): figures are read off effectiveSchedule stages only,
  device kinds only (bcheck's safety temp is never a figure), the whole run in ONE dir="ltr"
  island so bidi cannot invert the arrow (L13), and the arrow is the existing no-space literal
  (owner decision 1). D6: the order rows cite order_svsmoke.ref / order_smokesv.ref; owner
  decision 2: the smoke-ONLY row cites the same AmazingRibs ref, "(טור עישון בלבד)".
- cookingPathsPanel(meta) renders the approved variant-B DOM between the stat line and the
  doneness selector; wireCookingPaths handles expand/collapse and row selection.
- lists ALL entries, cited AND the CP3 placeholders (owner decision 3): dimmed, no radio, and
  tapping one TOASTS instead of selecting. The test asserts it clicked a row the wiring bound.
- selecting a cited row writes mk-item-path and re-renders the whole card, so the stat line and
  the raw-data table follow the new path (review defects D2/D4) and the default badge MOVES (D5).
- CSS ported from mockups/cp2/variant-b-list.html to the project's fscale/token conventions.
- screenshots at 390x844: collapsed, expanded, after a switch.

Safety: renders strings only; the sole mutation is one localStorage write of a path id. No
temp/hour/safe/svt/bcheck computed or mutated; figures come from effectiveSchedule stages.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 4 — The stat-line seam: extract it, prove it identical, then make it path-driven and drop "חוסך מעשנת" when inapplicable (owner decision 5 / D3)

**Spec line:** *"**The item card** re-renders its cooking content from it: stat line, step list, raw-data table — all from stages. `composedSteps`/`svSteps`/`soSteps` retire from schedule duty…"* (spec §3, item 2) — and the surfaces table row *"Item card stat line / steps / raw table | `composedSteps`/`svSteps` on catalog smt/smh | `effectiveSchedule`"* (spec §4).

**Files:**
- Modify `app.js` — insert the seam block immediately **after** `sourcesBlock`'s closing brace (pre-CP2 line **2863**) and before `function openCut(c){`. **Task 3 already shifted every line number below `openCut`'s opening — anchor by content (Step 1), never by these numbers.**
- Modify `app.js` — openCut's `smokeFin` / `smtV` / `smhV` locals (pre-CP2 **2873–2874**; the D2 root: the card bakes these into the stat line, the raw table AND the steps). **One edit, in Step 4.**
- Modify `app.js` — the `.statline` block (pre-CP2 **2888–2902**), replaced by one call. **One edit, in Step 4.**
- Modify `lang/_extracted.json`, `lang/_callsite-sig.json` — **regenerated**: this task MOVES ~10 `L()` call sites out of `openCut` into a new function, which is exactly what Guard D's structural signature tracks. **No new user-facing string is added and none is edited**, so no `lang/<code>.json` changes.
- Create `tests/cp2-statline-seam.spec.ts`.

**Interfaces:**
- **Consumes:** `itemDefaultPath(meta)` (Task 1), `effectiveSchedule(meta,sel)` (Task 1), `svSmokeFinish(meta)` (app.js 4209), `isProduce(c)` (1208), `upperHours(h)` (6), `dots(n)`, `L(he,en)` (8706).
- **Produces (final signatures — Tasks 5/6/7 bind to these):**
  - `cardPathSel(meta)` → `{id, methodKey, order, label}|null` — the card's resolved selection (null = no explicit per-recipe default; today's rule governs).
  - `pathStages(meta, sel)` → `stage[]` — `effectiveSchedule` output, never throws.
  - `pathHasKind(stages, kind)` → `boolean`.
  - `pathSmokeLeg(meta, sel)` → `{t,h}|null` — the SELECTED path's smoke stage; with `sel===null` it is `svSmokeFinish(meta)`, byte-identical to today.
  - `savedStatApplies(meta, sel, stages)` → `boolean` — owner decision 5.
  - `cardStatlineHTML(c, meta, sel)` → `string` — the **inner** HTML of `.statline`.
  - `openCut` now exposes `<div class="statline" id="cardStatline">` and its locals `pathSel` / `smokeFin` / `smtV` / `smhV` are path-driven. **Task 7 owns the raw-data table's own path presentation** — this task only corrects the `smtV`/`smhV` values the table already consumes.

---

- [ ] **Step 1: Verify every anchor before touching anything (content anchors, not line arithmetic).**

```bash
cd C:/Users/dudib/source/repos/matconetesh
grep -n 'function sourcesBlock\|function openCut\|<div class="statline">\|cookingPathsPanel(meta)\|${donenessSelector(c)}\|svSmokeFinish(meta):null' app.js
grep -n "function isProduce\|function upperHours\|function dots\|function svSmokeFinish" app.js
grep -rn "חוסך מעשנת" app.js tests/          # must appear ONCE, in app.js, and in NO test
```

Expected **AFTER Task 3 has landed** — locate all of these by CONTENT, never by the numbers written here (Task 3 inserted a line into `openCut`, so every number below this point has moved):
- `sourcesBlock`'s closing `}` is immediately followed by `function openCut(c){` — the seam's insertion point;
- inside `openCut`, `const smokeFin=(typeof svSmokeFinish==='function')?svSmokeFinish(meta):null;` and, on the next line, `const smtV=smokeFin?smokeFin.t:c.smt, smhV=smokeFin?smokeFin.h:c.smh;`;
- the `.statline` block opens at `<div class="statline">` and closes at the `</div>` immediately preceding `${typeof cookingPathsPanel==='function'?cookingPathsPanel(meta):''}` (Task 3's render anchor), which is itself followed by `${donenessSelector(c)}`;
- `isProduce` 1208, `upperHours` 6, `svSmokeFinish` 4209 (these are above `openCut` and did not move);
- `חוסך מעשנת` appears in `app.js` **once** and in **no** test — so dropping it in Step 9 cannot silently break a spec.

Symbol-shaped confirmation (Serena, §10.17):

```
mcp__serena__find_symbol             name_path="openCut"        relative_path="app.js" include_body=true
mcp__serena__find_referencing_symbols name_path="svSmokeFinish" relative_path="app.js"
```

`svSmokeFinish`'s referencing symbols must be exactly `openCut` (2873) — that single-caller fact is the blast radius of Step 9 and must be re-confirmed here, not remembered.

- [ ] **Step 2: Write the failing test — the seam, its invariance, and (phase B) owner decision 5 + D8.**

Create `tests/cp2-statline-seam.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 4 (spec 2026-07-25 §3 item 2: "The item card re-renders its cooking content from it:
// stat line, step list, raw-data table — all from stages").
//
// PHASE A is a pure extraction — the card's stat line moves into cardStatlineHTML(c,meta,sel) with NO
// behaviour change; test (a) is its RED witness (the seam must OWN the rendered DOM) and (b) is the
// invariance guard. PHASE B is a real behaviour change delivered by this same task: owner decision 5
// (2026-07-27) — "חוסך מעשנת" quantifies the smoker hours the sv→smoke route saves and DROPS when the
// selected path is not sv→smoke — plus review defect D8 (a selected path with no smoke stage must not
// leave sv→smoke figures in the stat line). Tests (c)-(f) are phase B's RED witnesses.

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(
    `typeof openCut==='function' && typeof cardStatlineHTML==='function' && typeof cardPathSel==='function' && typeof itemPaths==='function'`);
};

// real click-through: bottom-nav קטלוג → the group tile → the grid card (the shipped convention in
// tests/cp1-card-unified.spec.ts). NEVER page.evaluate to open a card — the owner standard (spec §1.3).
const openCard = async (page: any, group: string, name: string) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click(`button.cattile[data-tilegroup="${group}"]`);
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').filter({ hasText: name }).first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel .panel-body .statline .stat', { timeout: 10000 });
};

const statPairs = async (page: any): Promise<string[][]> =>
  page.locator('#panel .statline .stat').evaluateAll((els: Element[]) => els.map(e => [
    (e.querySelector('.l') as HTMLElement).innerText.trim(),
    (e.querySelector('.v') as HTMLElement).innerText.replace(/\s+/g, ' ').trim()]));

const labels = async (page: any) => (await statPairs(page)).map(p => p[0]);

// ── (a) PHASE A · the SEAM owns the rendered DOM (RED: cardStatlineHTML does not exist) ────────────
test('(a) the card\'s .statline is rendered BY cardStatlineHTML — the seam owns the DOM, no second copy', async ({ page }) => {
  await boot(page);
  await openCard(page, 'בשר אדום', 'בריסקט');
  const same = await page.evaluate(`(function(){
    const el=document.querySelector('#panel #cardStatline');
    if(!el) return 'NO #cardStatline';
    const m=resolveItem('cut-1');
    const want=cardStatlineHTML(m.obj, m, cardPathSel(m));
    const norm=function(s){ return String(s).replace(/\\s+/g,' ').trim(); };
    return norm(el.innerHTML)===norm(want) ? true : ('DOM: '+norm(el.innerHTML)+'\\nFN : '+norm(want));
  })()`);
  expect(same).toBe(true);
});

// ── (b) PHASE A · INVARIANCE: the brisket stat line still reads its catalog + cited values ─────────
test('(b) invariance — brisket stat line: svt/svh catalog, the CITED sv+smoke finish, tgt, safe, saved', async ({ page }) => {
  await boot(page);
  await openCard(page, 'בשר אדום', 'בריסקט');
  const pairs = await statPairs(page);
  const get = (l: string) => (pairs.find(p => p[0] === l) || [])[1];
  expect(get('סו-ויד')).toContain('68°');
  expect(get('סו-ויד')).toContain('30');
  expect(get('עישון')).toContain('120°');          // the cited order_svsmoke finish (CP1), not 105°
  expect(get('עישון')).not.toContain('105°');
  expect(get('יעד מרקם')).toContain('95°');
  expect(get('בטיחות')).toContain('63°');
  expect(get('חוסך מעשנת'), 'the default path IS sv→smoke — the stat must stay').toContain('9');
});

// ── (c) PHASE B · owner decision 5: the stat DROPS when the resolved path is not sv→smoke ─────────
test('(c) owner decision 5 — an offal card (default path = grill only) shows NO "חוסך מעשנת"', async ({ page }) => {
  await boot(page);
  await openCard(page, 'איברים', 'לב בקר');
  const l = await labels(page);
  expect(l, 'a grill-only default cannot "save smoker hours"').not.toContain('חוסך מעשנת');
  expect(l, 'the rest of the stat line is untouched').toContain('יעד מרקם');
});

test('(d) owner decision 5 — the stat also drops on the REVERSE order (smoke→sv is not sv→smoke)', async ({ page }) => {
  await boot(page);
  const revId = await page.evaluate(`itemPaths(resolveItem('cut-1')).find(function(p){return p.order==='smoke-sv';}).id`) as string;
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': revId }) });
  await openCard(page, 'בשר אדום', 'בריסקט');
  expect(await labels(page)).not.toContain('חוסך מעשנת');
});

// ── (e) PHASE B · D8: a selected path with NO smoke stage leaves no sv→smoke figures behind ───────
test('(e) D8 — with the smoke-only path selected, the stat line shows ITS cited 110°/12ש and drops סו-ויד', async ({ page }) => {
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': 'c:smoke' }) });
  // read the smoke-only path's own cited stage LIVE — never hardcode a schedule value (setup only)
  const want = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    const s=effectiveSchedule(m,{methodKey:'c:smoke'}).stages.find(function(x){return x.kind==='smoke';});
    return { t:s.temp, h:s.hours };
  })()`) as { t: number; h: number };
  expect(want.t, 'sanity: the smoke-only path really differs from the sv+smoke 120°').toBe(110);

  await openCard(page, 'בשר אדום', 'בריסקט');
  const pairs = await statPairs(page);
  const l = pairs.map(p => p[0]);
  const smoke = (pairs.find(p => p[0] === 'עישון') || [])[1];
  expect(smoke, `stat line was ${JSON.stringify(pairs)}`).toContain(`${want.t}°`);
  expect(smoke).toContain(String(want.h));
  expect(smoke, 'D8: the sv+smoke finish must not survive a smoke-only selection').not.toContain('120°');
  expect(l, 'a smoke-only path has no sous-vide stage — the stat drops').not.toContain('סו-ויד');
  expect(l, 'and no smoker-saved either').not.toContain('חוסך מעשנת');
  expect(l).toContain('בטיחות');
});

// ── (f) NEGATIVE · with nothing selected, NOTHING is gated away (the phase-A contract holds) ──────
test('(f) negative — no stored path: the offal card still shows סו-ויד/עישון stats (only decision 5 applies)', async ({ page }) => {
  await boot(page);
  await openCard(page, 'איברים', 'לב בקר');
  const l = await labels(page);
  expect(l).toContain('סו-ויד');
  expect(l).toContain('עישון');
});

// ── DoD-8 · visual evidence at 390×844 ────────────────────────────────────────────────────────────
test('DoD-8 — screenshots at 390×844: brisket default, offal (no saved stat), smoke-only selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await openCard(page, 'בשר אדום', 'בריסקט');
  await page.locator('#panel #cardStatline').screenshot({ path: 'mockups/cp2-statline-brisket-390x844.png' });
  await page.click('#panel .x');
  await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);
  await openCard(page, 'איברים', 'לב בקר');
  await page.locator('#panel #cardStatline').screenshot({ path: 'mockups/cp2-statline-offal-390x844.png' });
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': 'c:smoke' }) });
  await openCard(page, 'בשר אדום', 'בריסקט');
  await page.locator('#panel #cardStatline').screenshot({ path: 'mockups/cp2-statline-smokeonly-390x844.png' });
});
```

- [ ] **Step 3: Run it and WITNESS RED — phase A's reason.**

```bash
npx playwright test tests/cp2-statline-seam.spec.ts --reporter=list
```

Expected: **every** test fails inside `boot`, at the `waitForFunction` — `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` — because `cardStatlineHTML` / `cardPathSel` do not exist. Paste the output. That is the honest phase-A RED: the seam is absent. It is **not** the RED for owner decision 5 — Step 8 witnesses that separately, after phase A is green.

- [ ] **Step 4: Implement PHASE A — the extraction, at the FINAL signature, with no behaviour change on an empty store.**

The seam is introduced with the signature Tasks 5/6/7 bind to, and the four resolver helpers land with it. That is deliberate: giving phase A a temporary `(c, meta, smokeFin)` signature would make test (a) — which calls `cardStatlineHTML(m.obj, m, cardPathSel(m))` — structurally unable to pass, and would make phase A's `boot()` time out on `typeof cardPathSel==='function'`. The helpers are **behaviour-neutral with an empty store**: `cardPathSel` returns `null`, and `pathSmokeLeg(meta, null)` **is** `svSmokeFinish(meta)`, verbatim. Phase B then changes only `cardStatlineHTML`'s body and adds one predicate.

Insert immediately **after** `sourcesBlock`'s closing brace:

```js
// ── CP2 · the CARD'S STAT-LINE SEAM (spec §3 item 2: "The item card re-renders its cooking content
// from it: stat line, step list, raw-data table — all from stages"). PHASE A is a MOVE of the markup
// that lived inline in openCut: same tags, same L() literals, same values. It exists so a path switch
// has ONE place to re-render (review defect D2: openCut computed smtV/smhV locally and stamped them
// into the stat line, the raw table AND the steps, so re-rendering a sub-div left stale figures beside
// a moved badge). No temp, hour, safe or bcheck value is computed here.

// The card's resolved SELECTION. null = no explicit per-recipe default, in which case every helper
// below falls back to exactly what the card did before CP2 (spec §2: "absent an explicit default,
// today's methodRules default combo governs (unchanged behavior)").
function cardPathSel(meta){
  const p=(typeof itemDefaultPath==='function')?itemDefaultPath(meta):null;
  return p?{ id:p.id, methodKey:p.methodKey, order:p.order, label:p.label }:null;
}
function pathStages(meta, sel){
  try{ return effectiveSchedule(meta, sel?{methodKey:sel.methodKey, order:sel.order}:undefined).stages||[]; }
  catch(e){ return []; }
}
function pathHasKind(stages, kind){ return (stages||[]).some(function(s){ return s && s.kind===kind; }); }
// The SELECTED path's smoke leg. With no explicit selection this is svSmokeFinish (4209) verbatim —
// the fixed "this item's sv+smoke combo finish" slot the stat line has always shown. With a selection
// it is that path's OWN cited smoke stage, or null when the path has no smoke stage at all (review
// defect D8: a smoke-less path must not leave sv→smoke figures behind). Reads s.temp/s.hours off
// itemStages' output — computes nothing.
function pathSmokeLeg(meta, sel){
  if(sel){
    const s=pathStages(meta,sel).find(function(x){ return x.kind==='smoke'; });
    return (s && s.temp!=null)?{t:s.temp, h:s.hours}:null;
  }
  return (typeof svSmokeFinish==='function')?svSmokeFinish(meta):null;
}
function cardStatlineHTML(c, meta, sel){
  const hh=L('ש','h');
  const leg=pathSmokeLeg(meta, sel);          // sel===null ⇒ svSmokeFinish(meta), byte-for-byte
  const smtV=leg?leg.t:c.smt, smhV=leg?leg.h:c.smh;
  if(isProduce(c)) return `
       <div class="stat"><div class="l">${L('גריל','Grill')}</div><div class="v">${c.sot}°<small> / ${Math.round(upperHours(c.soh)*60)}${L("ד'",'m')}</small></div></div>
       <div class="stat"><div class="l">${L('סו-ויד','Sous-vide')}</div><div class="v">${c.svt}°<small> / ${c.svh}${hh}</small></div></div>
       <div class="stat"><div class="l">${L('גימור','Finish')}</div><div class="v">${smtV}°</div></div>
       <div class="stat"><div class="l">${L('קושי','Difficulty')}</div><div class="v">${dots(c.diff)}</div></div>
       `;
  return `
       <div class="stat"><div class="l">${L('סו-ויד','Sous-vide')}</div><div class="v">${c.svt}°<small> / ${c.svh}${hh}</small></div></div>
       <div class="stat"><div class="l">${L('עישון','Smoke')}</div><div class="v">${smtV}°<small> / ${smhV}${hh}</small></div></div>
       ${(c.grt!=null||c.grillable===false)?`<div class="stat"><div class="l">${L('גריל','Grill')}</div><div class="v">${c.grillable===false?'—':`${c.grt}°<small> / ${c.grh}${hh}</small>`}</div></div>`:''}
       <div class="stat"><div class="l">${L('יעד מרקם','Texture target')}</div><div class="v" id="tgtStat">${c.tgt}°</div></div>
       ${c.safe?`<div class="stat"><div class="l">${L('בטיחות','Safety')}</div><div class="v">${c.safe}°</div></div>`:''}
       <div class="stat"><div class="l">${L('חוסך מעשנת','Smoker saved')}</div><div class="v" style="color:#a7d086">${c.saved}${hh}</div></div>
       `;
}
```

Replace openCut's `smokeFin`/`smtV`/`smhV` locals (the two lines Step 1 located by content) with the **final** resolution — this is the one openCut edit this task makes; Step 9 does not touch openCut again:

```js
  // CP2 (spec §3 item 2, review defect D2): the card's own numbers come from the SELECTED path. This
  // one resolution feeds the stat line (#cardStatline), the raw-data table and the step list
  // (paintMethod → composedSteps), which is why re-rendering a sub-div was never enough. With nothing
  // stored, cardPathSel is null and pathSmokeLeg IS svSmokeFinish — pre-CP2 output, verbatim.
  const pathSel=(typeof cardPathSel==='function')?cardPathSel(meta):null;
  const smokeFin=(typeof pathSmokeLeg==='function')?pathSmokeLeg(meta,pathSel):((typeof svSmokeFinish==='function')?svSmokeFinish(meta):null);
  const smtV=smokeFin?smokeFin.t:c.smt, smhV=smokeFin?smokeFin.h:c.smh;
```

Then replace the whole `.statline` block (`<div class="statline">` through its closing `</div>`, the one immediately preceding Task 3's `cookingPathsPanel` line) with:

```js
     <div class="statline" id="cardStatline">${cardStatlineHTML(c, meta, pathSel)}</div>
```

> `hh` replaces the four inline `L('ש','h')` calls — same literal, same key, fewer call sites. Guard D sees the delta; Step 6 regenerates the manifest. `id="tgtStat"` is preserved verbatim: `wireDoneness(c)` (openCut ~3005) writes into it. `smtV`/`smhV` remain openCut locals because the raw-data table (Task 7's territory until it moves) still reads them.

- [ ] **Step 5: Run — phase A green, and the invariance assertions still hold.**

```bash
npx playwright test tests/cp2-statline-seam.spec.ts -g "^\(a\)|^\(b\)|^\(f\)" --reporter=list
```

> The pattern is **anchored and escaped on purpose.** Playwright's `-g` is a JS regex over the full title: `(a)` is a capture group matching the bare letter `a`, which appears in almost every title here (`(c) owner decision 5 — an offal card …`), so `-g "(a)|(b)|(f)"` silently runs the WHOLE file and the "3 passed" expectation below becomes unreadable.

Expected: `3 passed`. Tests (c)/(d)/(e) still FAIL — that is phase B, not yet built (they are excluded from this filtered run). Paste the output; do not proceed past a failing (a)/(b)/(f).

- [ ] **Step 6: Regenerate the i18n artifacts (Guard D) and confirm the build is clean.**

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py          # second run: Guard A + Guard D must both pass with NO regen env var
git diff --stat lang/    # expect ONLY lang/_extracted.json + lang/_callsite-sig.json to move
```
Expected on the second run: `[i18n:Guard-A] OK — <N> KNOWN keys + <M> names covered in all 6 active langs`, no Guard D drift line, exit 0. **No `lang/<code>.json` may appear in that diff** — this task adds and edits no string.

- [ ] **Step 7: Commit phase A on its own — an extraction and a behaviour change never share a commit.**

```bash
git add app.js lang/_extracted.json lang/_callsite-sig.json tests/cp2-statline-seam.spec.ts
git commit -m "$(cat <<'EOF'
refactor(cp2): extract the card's stat line into cardStatlineHTML — the seam a path switch re-renders

spec 2026-07-25 §3 item 2: "The item card re-renders its cooking content from it: stat line,
step list, raw-data table — all from stages."

Zero behaviour change on an empty store: same markup, same L() literals, same values (asserted —
the seam's output must EQUAL the rendered #cardStatline, and the brisket stat line still reads
68°/30ש, the cited 120° finish, 95°/63°, 9ש). Behaviour follows in the next commit.

The seam lands at its FINAL signature (c, meta, sel) with its four resolvers — cardPathSel /
pathStages / pathHasKind / pathSmokeLeg — because pathSmokeLeg(meta, null) IS svSmokeFinish(meta)
verbatim, so an empty store is byte-identical while the extraction stays a true seam (a temporary
smokeFin parameter would have had to be re-cut a commit later, and its test could never pass).

Safety: nothing computed or mutated; with no stored default the smoke leg is still svSmokeFinish.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

- [ ] **Step 8: WITNESS RED for PHASE B — owner decision 5 and D8, with the seam already in place.**

```bash
npx playwright test tests/cp2-statline-seam.spec.ts -g "owner decision 5|D8" --reporter=list
```

Expected failures, and the reason each proves:
- `(c)` → `Expected: not to contain "חוסך מעשנת" / Received: ["סו-ויד","עישון","גריל","יעד מרקם","בטיחות","חוסך מעשנת"]` — the stat is rendered unconditionally for every non-produce item, so a grill-only offal card claims it saves smoker hours. **This is D3's witness: the first draft implemented owner decision 5 nowhere.**
- `(d)` → same shape on the brisket with the reverse path stored — the reverse order saves nothing.
- `(e)` → `Expected substring: "110°" / Received string: "עישון 120° / 1.5ש"` plus `Received` labels still containing `"סו-ויד"` — the stat line is pinned to the sv+smoke slot regardless of the selected path (D8).

- [ ] **Step 9: Implement PHASE B — gate the device stats and drop the saved stat. No signature change, no second openCut edit.**

`cardPathSel` / `pathStages` / `pathHasKind` / `pathSmokeLeg` and openCut's `pathSel` resolution already landed in Step 4 (behaviour-neutral on an empty store). Phase B adds **one** predicate and replaces **one** function body.

Insert immediately **before** `cardStatlineHTML`:

```js
// Owner decision 5 (2026-07-27): "חוסך מעשנת" quantifies the smoker hours the sv→smoke route saves by
// doing the cooking in the bath. It is meaningless on a grill-only, smoke-only or REVERSE path, so it
// DROPS when inapplicable. Purely presentational — c.saved is neither read for math nor written.
function savedStatApplies(meta, sel, stages){
  if(!meta || !meta.obj || meta.obj.saved==null) return false;
  if(sel && sel.order==='smoke-sv') return false;          // smoke→sv saves nothing; it adds a leg
  const st=stages||pathStages(meta,sel);
  return pathHasKind(st,'sv') && pathHasKind(st,'smoke');
}
```

Replace the BODY of `cardStatlineHTML` (Step 4's version) with the path-aware one — **the signature `(c, meta, sel)` does not change**:

```js
function cardStatlineHTML(c, meta, sel){
  const hh=L('ש','h');
  const st=pathStages(meta, sel);
  const leg=pathSmokeLeg(meta, sel);
  const smtV=leg?leg.t:c.smt, smhV=leg?leg.h:c.smh;
  if(isProduce(c)) return `
       <div class="stat"><div class="l">${L('גריל','Grill')}</div><div class="v">${c.sot}°<small> / ${Math.round(upperHours(c.soh)*60)}${L("ד'",'m')}</small></div></div>
       <div class="stat"><div class="l">${L('סו-ויד','Sous-vide')}</div><div class="v">${c.svt}°<small> / ${c.svh}${hh}</small></div></div>
       <div class="stat"><div class="l">${L('גימור','Finish')}</div><div class="v">${smtV}°</div></div>
       <div class="stat"><div class="l">${L('קושי','Difficulty')}</div><div class="v">${dots(c.diff)}</div></div>
       `;
  // A device stat is gated ONLY when the user has explicitly chosen a path (sel!==null): without a
  // selection the stat line is byte-identical to phase A, which is the spec's "unchanged behavior"
  // clause. The VALUES are untouched either way — svt/svh stay the item's own safety-invariant
  // catalog values (spec §5: svt untouched); only the smoke leg follows the path.
  const gate=function(kind){ return !sel || pathHasKind(st, kind); };
  const rows=[];
  if(gate('sv'))    rows.push(`<div class="stat"><div class="l">${L('סו-ויד','Sous-vide')}</div><div class="v">${c.svt}°<small> / ${c.svh}${hh}</small></div></div>`);
  if(gate('smoke') && leg!==null || (!sel && gate('smoke')))
                    rows.push(`<div class="stat"><div class="l">${L('עישון','Smoke')}</div><div class="v">${smtV}°<small> / ${smhV}${hh}</small></div></div>`);
  if((c.grt!=null||c.grillable===false) && gate('cook'))
                    rows.push(`<div class="stat"><div class="l">${L('גריל','Grill')}</div><div class="v">${c.grillable===false?'—':`${c.grt}°<small> / ${c.grh}${hh}</small>`}</div></div>`);
  rows.push(`<div class="stat"><div class="l">${L('יעד מרקם','Texture target')}</div><div class="v" id="tgtStat">${c.tgt}°</div></div>`);
  if(c.safe) rows.push(`<div class="stat"><div class="l">${L('בטיחות','Safety')}</div><div class="v">${c.safe}°</div></div>`);
  if(savedStatApplies(meta, sel, st))
                    rows.push(`<div class="stat"><div class="l">${L('חוסך מעשנת','Smoker saved')}</div><div class="v" style="color:#a7d086">${c.saved}${hh}</div></div>`);
  return `
       `+rows.join(`
       `)+`
       `;
}
```

`openCut` needs **no further edit** — Step 4 already resolves `pathSel` and passes it into the render anchor. Confirm that, rather than editing twice:

```bash
grep -n "cardStatlineHTML(c, meta, pathSel)\|const pathSel=(typeof cardPathSel" app.js   # one hit each
grep -c "cardStatlineHTML(c, meta, smokeFin)" app.js                                     # must be 0
```

> **Known intermediate state, closed by Task 5 (stated, not hidden):** Task 3 already lets a user store a path whose combo differs from the card's active method toggles. Between this commit and Task 5's, such a user sees a corrected stat line beside toggles that still show the old combo. Task 5's RED witness is exactly that inconsistency; per §10.1 the phase is not done until it is closed.

- [ ] **Step 10: Run and see GREEN — this spec, then the neighbours.**

```bash
npx playwright test tests/cp2-statline-seam.spec.ts --reporter=list
```
Expected: `7 passed`, exit 0. Paste it.

```bash
npx playwright test tests/cp1-card-unified.spec.ts tests/cp1-surfaces.spec.ts tests/cp1-accessor.spec.ts \
  tests/cp2-default-path.spec.ts tests/cp2-path-panel.spec.ts tests/bug3-order-finish.spec.ts \
  tests/bug1-smoke-labels.spec.ts tests/order-effect.spec.ts --reporter=list
```
Expected: all pass, exit 0. `cp1-card-unified`'s stat-line assertion passing through the new seam is the proof the extraction kept the CP1 contract.

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py && python build.py
```
Expected: `[i18n:Guard-A] OK …`, exit 0, and again **no `lang/<code>.json` in `git diff --stat lang/`**.

- [ ] **Step 11: Look at the screenshots (DoD-8) — do not tick this from the files existing.**

```bash
ls -l mockups/cp2-statline-brisket-390x844.png mockups/cp2-statline-offal-390x844.png mockups/cp2-statline-smokeonly-390x844.png
```
Confirm at 390×844: brisket shows five stats ending in `חוסך מעשנת 9ש`; the offal card shows the same layout **without** the saved stat and with no gap where it was; the smoke-only card shows `עישון 110° / 12ש`, `יעד מרקם`, `בטיחות` and nothing else.

**Safety / fidelity witness (DoD-10):** no `bcheck` stage, `safe`, `svt`, `tgt`, temp or duration is computed or mutated. `svt`/`svh`/`tgt`/`safe` render from the item's own catalog fields exactly as before (spec §5: svt is safety-invariant); the only value that moves is the smoke leg, read as `s.temp`/`s.hours` off `effectiveSchedule`'s stage objects. Dropping a stat removes a rendered `<div>` — it changes no number. Witness: test **(b)** (brisket's five values unchanged), test **(f)** (nothing is gated away without a selection), test **(e)** (the smoke value equals the live stage, read from the accessor in the test itself).

- [ ] **Step 12: Commit phase B.**

```bash
git add app.js lang/_extracted.json lang/_callsite-sig.json tests/cp2-statline-seam.spec.ts \
  mockups/cp2-statline-brisket-390x844.png mockups/cp2-statline-offal-390x844.png mockups/cp2-statline-smokeonly-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): the card's stat line follows the SELECTED path + "חוסך מעשנת" drops when inapplicable

spec 2026-07-25 §3 item 2 (card re-renders its cooking content from the accessor) + owner
decision 5 (2026-07-27): the smoker-saved stat is shown only for sv→smoke.

- savedStatApplies(meta,sel,stages) + the gated cardStatlineHTML body (the resolvers cardPathSel /
  pathStages / pathHasKind / pathSmokeLeg and openCut's pathSel landed with the seam, one commit
  earlier, where they were byte-neutral on an empty store).
- D8: a selected path with no smoke stage drops the smoke stat instead of showing the sv→smoke
  finish; a path with no sv stage drops the sous-vide stat. Gating applies ONLY when the user has
  chosen a path — with nothing stored the stat line is unchanged (asserted on an offal card).
- owner decision 5 delivered here by name (review defect D3: the first draft delivered it nowhere).

Safety: no temp/hour/safe/svt/tgt/bcheck computed or mutated; svt/svh/tgt/safe render from the
item's own catalog fields, the smoke leg from effectiveSchedule's stage objects.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 5 — The selection state machine: one `selectCardPath`, the combo follows the path, expanded-through-re-render + auto-collapse, and a placeholder that writes nothing

**Spec line:** *"the default is selected; tapping another path re-renders the card's schedule from it and (per O-1) sets the per-recipe default."* (spec §3, item 3) — and the owner's binding anchor *"the only single source of truth is the item and recipes behind the card"* (spec §1.4 / O-1).

**Files:**
- Modify `app.js` — insert the state machine + open-state helpers immediately **after** `wireCookingPaths`'s closing brace (Task 3's block; anchor by content: `grep -n "function wireCookingPaths" app.js`).
- Modify `app.js` — inside `wireCookingPaths`: the head-click handler and the row-click handler (Task 3's bodies), replaced to call the new helpers.
- Modify `app.js` — openCut's method-toggle handler (pre-CP2 **2995**, `if(curProject) store.set(methodKeyFor(key),next); else cardSet('method:'+key,next);`) → `setCardCombo(key,next)`, so one function owns the combo write.
- Modify `app.js` — `closePanel` (**3367**): call `cpResetOpen()` as its first statement (every SETUP owns a TEARDOWN, §11a).
- Modify `app.css` — three lines appended to the CP2 block (the stat-line cross-fade).
- Create `tests/cp2-path-select.spec.ts`.
- **No `lang/*.json` change and no `_callsite-sig` regen**: this task adds, removes and edits **zero** `L()` call sites.

**Interfaces:**
- **Consumes:** `itemPaths(meta)` / `setItemPath(itemKey,pathId)` (Task 1), `cardPathSel(meta)` (Task 4), `cpRowHTML(meta,p)` / `cpHeadMainHTML(meta,cur)` / `wireCookingPaths(root,meta,reopen)` (Task 3), `store` (1628), `methodKeyFor(key)` (1005), `cardSet(k,v)` (1019), `curProject` (1648), `toast(msg)` (3585), `$` .
- **Produces:**
  - `cardComboOf(p)` → `string[]|null` — a path's methodKey decoded to a method combo (`'c:smoke_sv'` → `['smoke','sv']`); `null` for a non-cut key or a placeholder.
  - `sameCombo(a,b)` → `boolean` — order-insensitive combo equality (Task 6 threads it).
  - `setCardCombo(itemKey, combo)` → `void` — the combo write, named once. Writes the persistent method store **and** the session store, so the combo has the same lifetime as the persistent path default it implies.
  - `selectCardPath(meta, id)` → `boolean` — validate → persist the per-recipe default → write the path's combo. `false` for an unknown/uncited id (nothing written).
  - `cpSetOpen(host, open, key)` → `void`, `cpAutoCollapse(key)` → `void`, `cpResetOpen()` → `void`, module state `_cpListOpenKey` / `_cpCollapseTmo` — the panel's open state survives the card re-render **for that item only**, then collapses ~380 ms later (the approved mockup's confirmation gesture); `closePanel` cancels both.

---

- [ ] **Step 1: Verify Task 3's wiring is where this task edits it.**

```bash
cd C:/Users/dudib/source/repos/matconetesh
grep -n "function wireCookingPaths\|function cookingPathsPanel\|function cpRowHTML\|function cpHeadMainHTML" app.js
sed -n "$(grep -n 'function wireCookingPaths' app.js | cut -d: -f1),+34p" app.js
grep -n "cardSet('method:'+key,next)" app.js        # the toggle handler's inline two-store rule
grep -n "wireCookingPaths(\$(\"#panel\")" app.js     # Task 3's call site + its inline reopen closure
grep -n "^\.cp-list{\|^\.cp-row{\|^\.statline{" app.css
```

Expected: `wireCookingPaths` exists with the `row.__cpBound=true` firing-guard and an inline `head.addEventListener('click', …)` that flips `body.style.display`; the toggle handler line is a single `if(curProject) store.set(methodKeyFor(key),next); else cardSet('method:'+key,next);`; `app.css` has `.statline{…}` (628) and the CP2 block from Task 3 at the end. Re-anchor if any differ — **do not edit by line number alone.**

- [ ] **Step 2: Write the failing test — real clicks on the panel, asserting the card's OWN state.**

Create `tests/cp2-path-select.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 5 (spec 2026-07-25 §3 item 3: "…tapping another path re-renders the card's schedule from
// it and (per O-1) sets the per-recipe default", and §1.4: "the only single source of truth is the item
// and recipes behind the card").
//
// A PATH IS A COMBO PLUS AN ORDER. Task 3's handler persisted the path id and re-rendered — but never
// wrote the combo, so tapping "עישון" (smoke-only) left the method toggles, the step list and the
// method note on sv+smoke: the card disagreed with its own default. This task makes ONE function own
// the transition. Every assertion is on RENDERED DOM after REAL CLICKS.

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(`typeof openCut==='function' && typeof selectCardPath==='function' && typeof cpSetOpen==='function'`);
};

const openBrisket = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').filter({ hasText: 'בריסקט' }).first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel #cpList', { timeout: 10000 });
};
const expand = async (page: any) => {
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
};
const onToggles = async (page: any) =>
  page.locator('#panel .mtoggle.on').evaluateAll((els: Element[]) => els.map(e => e.getAttribute('data-mt')));
const statLabels = async (page: any) =>
  page.locator('#panel #cardStatline .stat .l').allInnerTexts();

test.beforeEach(async ({ page }) => { await boot(page); });

// ── (a) THE HOLE: selecting the smoke-only path must move the CARD'S OWN state, not just the badge ──
test('(a) tapping the smoke-only row switches the method toggles, the note and the stat line to it', async ({ page }) => {
  await openBrisket(page);
  await expand(page);
  expect(await onToggles(page), 'precondition: the brisket card opens on sv+smoke').toEqual(['sv', 'smoke']);

  const row = page.locator('#cpListBody .cp-row[data-id="c:smoke"]');
  await expect(row, 'the smoke-only path must enumerate for this test to have teeth').toHaveCount(1);
  await row.click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='c:smoke'`);

  expect(await onToggles(page), 'the toggles ARE the path — one state').toEqual(['smoke']);
  expect(await statLabels(page)).not.toContain('סו-ויד');
  expect(await page.locator('#panel .method-note').innerText()).not.toContain('סו-ויד');
});

// ── (b) the panel comes back EXPANDED across the re-render, then auto-collapses (approved mockup) ───
test('(b) after a select the list stays open showing the moved radio, then collapses on its own', async ({ page }) => {
  await openBrisket(page);
  await expand(page);
  const revId = await page.locator('#cpListBody .cp-row[data-id$=":rev"]').getAttribute('data-id');
  await page.locator(`#cpListBody .cp-row[data-id="${revId}"]`).click();

  // still open, and the radio + badge are on the new row — the visible confirmation the default moved
  await page.waitForFunction(`(function(){
    const b=document.querySelector('#cpListBody'), on=document.querySelector('#panel .cp-row.on');
    return !!b && b.style.display==='block' && !!on && on.getAttribute('data-id')==='${revId}';
  })()`);
  expect(await page.locator(`#panel .cp-row[data-id="${revId}"] .cp-def-badge`).count()).toBe(1);

  // …and then it collapses itself (~380ms) — condition-waited, never waitForTimeout (DoD-11)
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='none'`);
  expect(await page.locator('#panel #cpListMain').innerText(), 'the collapsed header names the new default')
    .toContain(await page.locator(`#panel .cp-row[data-id="${revId}"] .crtitle`).innerText().then(s => s.split('\n')[0].trim()));
});

// ── (c) D9 · a placeholder tap toasts and writes NOTHING (not the default, not the combo) ──────────
test('(c) D9 — tapping a "soon" row toasts, and leaves the stored default AND the toggles untouched', async ({ page }) => {
  await openBrisket(page);
  await expand(page);
  const before = { on: await page.locator('#panel .cp-row.on').getAttribute('data-id'), tg: await onToggles(page) };
  const soon = page.locator('#cpListBody .cp-row.soon').first();
  expect(await soon.evaluate((el: any) => !!el.__cpBound), 'the soon row must be a WIRED row').toBe(true);
  await soon.click();
  await page.waitForFunction(`document.querySelector('#toast') && document.querySelector('#toast').classList.contains('show')`);

  expect(await page.locator('#panel .cp-row.on').getAttribute('data-id')).toBe(before.on);
  expect(await onToggles(page)).toEqual(before.tg);
  expect(await page.evaluate(`localStorage.getItem('mk-item-path')`), 'an uncited path never becomes the default').toBeNull();
});

// ── (d) the stat line never gets stuck faded by the swap animation ─────────────────────────────────
test('(d) the cross-fade never leaves the stat line invisible', async ({ page }) => {
  await openBrisket(page);
  await expand(page);
  await page.locator('#cpListBody .cp-row[data-id$=":rev"]').click();
  await page.waitForFunction(`(function(){
    const el=document.querySelector('#panel #cardStatline');
    return !!el && getComputedStyle(el).opacity==='1' && !el.classList.contains('swap');
  })()`);
  expect(await page.locator('#panel #cardStatline .stat').count()).toBeGreaterThan(2);
});

// ── (e) O-1 · the transition persists as the per-recipe default across a full reopen ───────────────
test('(e) O-1 — select smoke-only, close, reopen: the row, the toggles and the stat line all come back', async ({ page }) => {
  await openBrisket(page);
  await expand(page);
  await page.locator('#cpListBody .cp-row[data-id="c:smoke"]').click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='c:smoke'`);
  await page.click('#panel .x');
  await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);

  await openBrisket(page);
  await expand(page);
  expect(await page.locator('#panel .cp-row.on').getAttribute('data-id')).toBe('c:smoke');
  expect(await onToggles(page)).toEqual(['smoke']);
  expect(await statLabels(page)).not.toContain('סו-ויד');
});

// ── (f) the per-recipe default and the combo have ONE lifetime — they survive a reload together ─────
test('(f) after a reload the panel\'s selected row and the method toggles still agree', async ({ page }) => {
  await openBrisket(page);
  await expand(page);
  await page.locator('#cpListBody .cp-row[data-id="c:smoke"]').click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='c:smoke'`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(`typeof openCut==='function' && typeof cookingPathsPanel==='function'`);
  await openBrisket(page);
  await expand(page);
  expect(await page.locator('#panel .cp-row.on').getAttribute('data-id')).toBe('c:smoke');
  expect(await onToggles(page), 'the toggles must agree with the PERSISTED path, not revert to rules.def').toEqual(['smoke']);
});

// ── DoD-8 · visual evidence at 390×844 ────────────────────────────────────────────────────────────
test('DoD-8 — screenshots at 390×844: mid-select (open) and settled (collapsed)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBrisket(page);
  await expand(page);
  await page.locator('#cpListBody .cp-row[data-id="c:smoke"]').click();
  // freeze the 380ms auto-collapse BEFORE shooting: waiting for display==='block' and then screenshotting
  // lets the collapse fire in between, which would silently produce a COLLAPSED "mid-select (open)"
  // shot — DoD-8 evidence that can be wrong without the test failing is worse than no evidence.
  await page.evaluate('clearTimeout(_cpCollapseTmo)');
  await expect(page.locator('#cpListBody')).toBeVisible();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='c:smoke'`);
  await page.locator('#panel').screenshot({ path: 'mockups/cp2-select-open-390x844.png' });
  // re-arm the collapse deliberately, then shoot the settled state
  await page.evaluate('cpAutoCollapse(resolveItem("cut-1").key)');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='none'`);
  await page.locator('#panel').screenshot({ path: 'mockups/cp2-select-collapsed-390x844.png' });
});
```

- [ ] **Step 3: Run and WITNESS RED — each failure for its own reason.**

```bash
npx playwright test tests/cp2-path-select.spec.ts --reporter=list
```

Expected: every test fails in `boot` at the `waitForFunction` — `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` — `selectCardPath` / `cpSetOpen` do not exist. Paste it. Then, after Step 4 defines them but **before** the handlers are rewired in Step 5, re-run to witness the second RED shape, which is the one that matters:

```bash
npx playwright test tests/cp2-path-select.spec.ts -g "^\(a\)|^\(b\)" --reporter=list
```

> Anchored and escaped: unescaped `(a)` is a capture group matching the bare letter `a`, which appears in nearly every title in this file, so `-g "(a)|(b)"` would run the whole spec and this second RED — the one that matters — could not be read off the output.

Expected: `(a)` → `expect(received).toEqual(expected) — Expected: ["smoke"] / Received: ["sv","smoke"]` (Task 3's handler wrote the path id and nothing else, so the card's toggles, note and steps stayed on sv+smoke); `(b)` → `TimeoutError … waiting for function` on the `display==='block'` condition (the re-rendered panel comes back collapsed, so the confirmation gesture never happens). Paste both.

- [ ] **Step 4: Implement — the state machine and the open-state helpers.**

Insert immediately **after** `wireCookingPaths`'s closing brace:

```js
// ── CP2 · the SELECTION STATE MACHINE (spec §3 item 3 + O-1). A path is a COMBO plus an ORDER, so
// choosing one must move the card's combo too — otherwise the panel says "smoke-only" while the
// method toggles, the method note and the step list still say sv+smoke, and the card contradicts its
// own default (the very failure the single-source spec exists to kill).
function cardComboOf(p){
  const mk=String((p&&p.methodKey)||'');
  if(mk.indexOf('c:')!==0) return null;                    // only the cut card's combo keys decode
  const parts=mk.slice(2).split('_').filter(Boolean);
  return parts.length?parts:null;
}
function sameCombo(a,b){
  if(!a||!b||a.length!==b.length) return false;
  return a.slice().sort().join('_')===b.slice().sort().join('_');
}
// The method-combo write, named once so the toggle handler and the path panel cannot drift.
//
// It writes BOTH stores, deliberately. A CP2 path default is PERSISTENT (mk-item-path, localStorage,
// O-1) and Task 6's toggle handler records every combo flick as one — so the combo it implies must
// persist too. Writing only the ephemeral session store (cardSess, app.js 1017, in-memory for the
// visit) left a reload with the panel's `.on` row, the stat line and the steps derived from the
// PERSISTED path while the method toggles had reverted to rules.def: the panel says "smoke-only" while
// the toggles say sv+smoke — the exact card-vs-itself contradiction the single-source spec exists to
// kill (spec §1.4). The session store is still written so the current visit reads it without a store
// round-trip, and mk-item-path already crosses the catalog/project boundary by design (it is keyed by
// itemKey, not by evScope), so the method store crossing it is the same scope, not a new one.
//
// DISCLOSED BEHAVIOUR CHANGE (§10.8 routine call, noted — not a spec waiver): a method-toggle flick on
// a CATALOG card now persists where it used to be per-visit. State it in this task's report.
function setCardCombo(itemKey, combo){
  store.set(methodKeyFor(itemKey), combo);
  cardSet('method:'+itemKey, combo);
}
// ONE transition. Returns false — writing NOTHING — for an unknown id or a CP3 placeholder (owner
// decision 3: a placeholder toasts, it never selects). The combo it writes came from an ENUMERATED
// path, and itemProfile only enumerates combos that already passed validCombo (app.js 3798), so no
// invalid combo can enter this way. Nothing here computes or mutates a temp, an hour, a safe value or
// a bcheck stage — it writes one path id and one method array.
function selectCardPath(meta, id){
  if(!meta || !meta.key || !id) return false;
  let p=null; try{ p=(itemPaths(meta)||[]).find(function(x){ return x.id===id; }); }catch(e){ p=null; }
  if(!p || p.cited===false) return false;
  setItemPath(meta.key, id);                               // O-1: the card is where the default lives
  const combo=cardComboOf(p);
  if(combo) setCardCombo(meta.key, combo);                 // the toggles ARE the path — one state
  return true;
}
// The panel's open state must survive the card re-render, or the user never sees the radio move. The
// approved mockup (mockups/cp2/variant-b-list.html, §10.9) then collapses it ~380ms later — that
// collapse IS the confirmation that the per-recipe default moved.
//
// The open flag is keyed to the ITEM and the timer is cancellable, because neither is scoped by the
// DOM: showPanel replaces the panel wholesale (app.js 3309, `p.innerHTML=html`), so a bare boolean
// would re-open the path list of the NEXT card the user opens inside the 380 ms window, and a
// still-pending timer would collapse a list belonging to a different card (or race a test that has
// just waited for `display==='block'`). Both are real: `cardClear` is called from exactly one site
// (resetRecipeProgress, app.js 10819), so nothing else tears this state down.
let _cpListOpenKey=null, _cpCollapseTmo=0;
function cpSetOpen(host, open, key){
  if(!host) return;
  const body=host.querySelector('#cpListBody'), count=host.querySelector('#cpListCount'), head=host.querySelector('#cpListHead');
  if(!body) return;
  body.style.display=open?'block':'none';
  if(count) count.classList.toggle('open', open);
  if(head) head.setAttribute('aria-expanded', open?'true':'false');
  _cpListOpenKey = open ? (key||_cpListOpenKey) : null;
}
function cpResetOpen(){ clearTimeout(_cpCollapseTmo); _cpListOpenKey=null; }
function cpAutoCollapse(key){
  clearTimeout(_cpCollapseTmo);
  _cpCollapseTmo=setTimeout(function(){
    const panel=$("#panel");
    if(!panel || !panel.classList.contains('open') || _cpListOpenKey!==key){ _cpListOpenKey=null; return; }
    cpSetOpen(panel.querySelector('#cpList'), false, key);
  }, 380);
}
```

And add `cpResetOpen()` as the FIRST statement of `closePanel` (app.js 3367) — every SETUP owns a matching TEARDOWN (§11a):

```js
function closePanel(){
  if(typeof cpResetOpen==='function') cpResetOpen();   // CP2: cancel a pending path-list auto-collapse and drop the open key
```

- [ ] **Step 5: Implement — rewire `wireCookingPaths` onto the state machine.**

Inside `wireCookingPaths`, replace the head-click handler block with:

```js
  if(head&&body&&count) head.addEventListener('click', function(){ cpSetOpen(host, body.style.display!=='block', meta.key); });
  if(_cpListOpenKey===meta.key) cpSetOpen(host, true, meta.key);   // THIS item's panel comes back as the user left it
```

and replace the row-click handler's **select** branch (Task 3's `setItemPath(meta.key, id); if(typeof reopen==='function') reopen();`) with:

```js
      if(row.classList.contains('on')) return;                // already the default — nothing to move
      if(!selectCardPath(meta, id)) return;                   // unknown/uncited → nothing written
      _cpListOpenKey=meta.key;                                // stay open through the re-render…
      if(typeof reopen==='function') reopen();
      const sl=$("#panel").querySelector('#cardStatline');     // …and cross-fade the new figures in
      if(sl){ sl.classList.add('swap'); requestAnimationFrame(function(){ sl.classList.remove('swap'); }); }
      cpAutoCollapse(meta.key);                               // …then collapse: the O-1 confirmation
```

Replace openCut's method-toggle store line (**2995**) with the named helper — identical semantics, one owner:

```js
    setCardCombo(key, next);
```

Append to the CP2 block at the end of `app.css`:

```css
/* CP2 Task 5 · the stat line cross-fades when a path switch swaps its figures (approved mockup's
   `.statline.swap` behaviour). Fade-IN only: the class is added to the freshly rendered node and
   removed on the next frame, so a dropped frame can never leave the stat line invisible. */
.statline{transition:opacity .18s ease}
.statline.swap{opacity:0}
```

- [ ] **Step 6: Run and see GREEN, then the neighbours.**

```bash
npx playwright test tests/cp2-path-select.spec.ts --reporter=list
```
Expected: `7 passed`, exit 0 — (a)–(f) plus DoD-8. Paste it.

```bash
npx playwright test tests/cp2-path-panel.spec.ts tests/cp2-statline-seam.spec.ts tests/cp2-default-path.spec.ts \
  tests/cp2-path-presentation.spec.ts tests/cp1-card-unified.spec.ts tests/cp1-surfaces.spec.ts \
  tests/e3-validity.spec.ts tests/e1-derive-requires.spec.ts --reporter=list
```
Expected: all pass, exit 0. Task 3's own "D5/D2/D4" test passing through the new handler is the proof the rewiring kept its contract.

```bash
python build.py          # NO regen: this task adds/removes/edits zero L() call sites
```
Expected: `[i18n:Guard-A] OK …` and no Guard D drift line, exit 0. **If Guard D reports drift, stop** — it means an `L()` call site moved unintentionally; find it before regenerating.

- [ ] **Step 7: Look at the screenshots (DoD-8).**

```bash
ls -l mockups/cp2-select-open-390x844.png mockups/cp2-select-collapsed-390x844.png
```
Confirm at 390×844 against `mockups/cp2/variant-b.png`: mid-select the list is open with the filled radio and the badge on `עישון`; settled, the list is collapsed and the header reads `💨 עישון · ברירת מחדל`, the toggles show only 🔥/💨 state consistent with it, and the stat line below has no `סו-ויד` tile.

**Safety / fidelity witness (DoD-10):** the transition's entire mutation is two writes — one `mk-item-path` entry (a path **id**) and one method array, the same array shape the method toggles have written since before CP2. No `bcheck` stage, `safe`, `svt`, temp or duration is computed or mutated; the combo is taken from an enumerated path, and `itemProfile` enumerates only `validCombo`-passing combos, so no invalid combo can be written. A placeholder returns `false` **before** any write — test (c) asserts `mk-item-path` is still absent after tapping one.

- [ ] **Step 8: Commit.**

```bash
git add app.js app.css tests/cp2-path-select.spec.ts mockups/cp2-select-open-390x844.png mockups/cp2-select-collapsed-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): one selection state machine — the combo follows the path, and the panel confirms the move

spec 2026-07-25 §3 item 3: "…tapping another path re-renders the card's schedule from it and
(per O-1) sets the per-recipe default"; §1.4: the card is the single source of truth.

- selectCardPath(meta,id): validate → setItemPath → setCardCombo. A path is a combo plus an
  order, so choosing one moves the method toggles, the method note and the step list with it —
  Task 3's handler wrote only the id, leaving the card contradicting its own default.
- setCardCombo names the combo write once and gives it ONE lifetime: it writes the persistent
  method store as well as the session store, because the path default it implies is persistent
  (mk-item-path). Writing only the ephemeral store left a reload with the panel on the persisted
  path and the toggles back on rules.def — the card contradicting itself (asserted, test (f)).
  DISCLOSED: a method-toggle flick on a CATALOG card now persists (was per-visit).
- cpSetOpen/_cpListOpenKey carry the panel's open state through the card re-render FOR THAT ITEM,
  then cpAutoCollapse(key) collapses it ~380ms later — the approved mockup's confirmation gesture.
  closePanel calls cpResetOpen(), so a pending collapse can never land on another card's panel.
- D9: a placeholder tap toasts and writes NOTHING (asserted: mk-item-path stays absent).
- .statline cross-fade is fade-IN only, so it can never leave the stat line invisible.

Safety: two writes only — a path id and a method array (from an already validCombo-checked
enumerated path). No temp/hour/safe/svt/bcheck computed or mutated.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 6 — The step list re-derives per selected path: thread the path through `paintMethod` → `composedSteps`, and compose the reverse order from its own cited stages

**Spec line:** *"**The item card** re-renders its cooking content from it: stat line, **step list**, raw-data table — all from stages. `composedSteps`/`svSteps`/`soSteps` retire from schedule duty (their non-schedule prose either re-anchors to stages or is folded; the plan enumerates every consumer — strangler discipline, no big-bang deletion)."* (spec §3, item 2.)

**Files:**
- Modify `app.js` — insert `smokeSvSteps(c, stages)` immediately **before** `function composedSteps(c, combo, smokeFin){` (currently line **1051**).
- Modify `app.js` **1051** — `composedSteps`' signature gains a 4th parameter and one early branch.
- Modify `app.js` — openCut's `paintMethod` (currently **2968–2975**): thread the selected path's order + stages; and openCut's toggle handler + Task 3's `wireCookingPaths(...)` call, both re-pointed at one named `reopenCard` closure.
- Modify `lang/en.json`, `lang/ru.json`, `lang/de.json`, `lang/es.json`, `lang/fr.json`, `lang/it.json` — the three new keys.
- Modify `lang/_extracted.json`, `lang/_callsite-sig.json`.
- Create `tests/cp2-steps-path.spec.ts`.

**Interfaces:**
- **Consumes:** `effectiveSchedule(meta,sel)` (4194), `cardPathSel(meta)` (Task 4), `cardComboOf(p)` / `sameCombo(a,b)` / `setCardCombo` / `setItemPath` (Task 5/1), `ctxMethods(c,key)` (1026), `injectSeasoningSteps(steps,key,tmpl)` (1273), `stepHTML(key,which,i,s)` (3074), `wireSteps(key,which,steps)` (3103), `upperHours` (6), `L`.
- **Produces:**
  - `smokeSvSteps(c, stages)` → `[[title, body, seconds], …]` — the reverse-order step list, composed **from the cited stage objects**, no schedule math.
  - `composedSteps(c, combo, smokeFin, opts)` → step tuples — `opts = {order:'smoke-sv'|null, stages:stage[]|null}`; **omitting `opts` is byte-identical to today** (every existing caller keeps working unchanged).
  - `openCut`'s `reopenCard()` closure — the card's ONE re-render entry point, shared by the path panel and the method toggles.

---

- [ ] **Step 1: Verify the real call chain before threading anything.**

```bash
cd C:/Users/dudib/source/repos/matconetesh
sed -n '1050,1052p' app.js                       # the composedSteps signature + its comment
grep -n "composedSteps(" app.js                  # EVERY caller — the blast radius of a signature change
sed -n "$(grep -n '  function paintMethod' app.js | cut -d: -f1),+8p" app.js
sed -n '1555,1557p;1578,1580p' app.js            # svSteps / soSteps — the sv-first prose this bypasses
grep -n "function injectSeasoningSteps\|function stepHTML\|function wireSteps" app.js
```

Expected: `composedSteps` at 1051; its callers are `paintMethod` (openCut ~2970) **and** the work-plan detail path — list them from the grep output and confirm each still passes 3 arguments (the 4th is optional by construction, so no caller changes). `svSteps` 1555 prints *"אין צורך בעטיפה — הבישול הושלם בסו-ויד"* — the sv-first claim that is FALSE when the smoke comes first on raw meat, which is why the reverse order needs its own composer rather than a temp swap.

```
mcp__serena__find_symbol             name_path="composedSteps" relative_path="app.js" include_body=true
mcp__serena__find_referencing_symbols name_path="composedSteps" relative_path="app.js"
```

- [ ] **Step 2: Write the failing test — the step list, in order, after a real click.**

Create `tests/cp2-steps-path.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 6 (spec 2026-07-25 §3 item 2: "…stat line, step list, raw-data table — all from stages").
// The step list is the last card surface still composed from a FIXED order: svSteps (app.js 1555)
// always emits sous-vide first and then claims "no wrap needed — cooking was completed in the
// sous-vide", which is exactly backwards for the cited reverse path (smoke on RAW meat, then the bath
// does the pasteurizing). Threading the selected path through composedSteps fixes the ORDER, and the
// reverse composer reads its numbers off the cited stages instead of re-deriving them.

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(`typeof openCut==='function' && typeof composedSteps==='function' && typeof smokeSvSteps==='function'`);
};
const openBrisket = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').filter({ hasText: 'בריסקט' }).first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel #methodArea .steps .step', { timeout: 10000 });
};
const stepTitles = async (page: any) => page.locator('#panel #methodArea .step .step-t').allInnerTexts();
const stepsText = async (page: any) => page.locator('#panel #methodArea .steps').innerText();

// ── (a) THE ORDER BUG: with the reverse path stored, the smoke step must come BEFORE the bath ──────
test('(a) reverse path — the smoke step precedes the sous-vide step, and the sv-first prose is gone', async ({ page }) => {
  await boot(page);
  const revId = await page.evaluate(`itemPaths(resolveItem('cut-1')).find(function(p){return p.order==='smoke-sv';}).id`) as string;
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': revId }) });
  await openBrisket(page);

  const titles = await stepTitles(page);
  const iSmoke = titles.findIndex(t => t.includes('עישון'));
  const iSV = titles.findIndex(t => t.includes('סו-ויד'));
  expect(iSmoke, `titles were ${JSON.stringify(titles)}`).toBeGreaterThan(-1);
  expect(iSV).toBeGreaterThan(-1);
  expect(iSmoke, 'smoke→sous-vide means the SMOKE step comes first').toBeLessThan(iSV);

  const txt = await stepsText(page);
  expect(txt, 'the bath has not happened yet when this smoke runs').not.toContain('אין צורך בעטיפה');
  expect(txt, 'the cited reverse smoke is 75°, never the forward 120°').not.toContain('120°');
  expect(txt).toContain('75°');
});

// ── (b) FIDELITY: every number the reverse steps print exists in that path's own stages ────────────
test('(b) fidelity — no step prints a number absent from the reverse path\'s cited stages', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    const rev=itemPaths(m).find(function(p){return p.order==='smoke-sv';});
    const stages=effectiveSchedule(m,{methodKey:rev.methodKey,order:'smoke-sv'}).stages;
    const steps=smokeSvSteps(m.obj, stages);
    const allowed=[]; stages.forEach(function(s){
      if(s.temp!=null) allowed.push(s.temp);
      if(s.hours!=null) allowed.push(Math.round(s.hours*10)/10, Math.round((s.hours||0)*3600));
    });
    const nums=[]; steps.forEach(function(s){ (String(s[0]+' '+s[1]).match(/\\d+(?:\\.\\d+)?/g)||[]).forEach(function(n){ nums.push(Number(n)); }); });
    return { rogue: nums.filter(function(n){ return allowed.indexOf(n)<0; }), n: steps.length };
  })()`) as { rogue: number[]; n: number };
  expect(r.n).toBeGreaterThan(3);
  expect(r.rogue, 'the reverse composer prints stage values only — it derives nothing').toEqual([]);
});

// ── (c) INVARIANCE: with nothing stored, the brisket steps are today's sv-first list, unchanged ────
test('(c) invariance — no stored path: sous-vide first, the cited 120° finish, svSteps prose intact', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  const titles = await stepTitles(page);
  expect(titles.findIndex(t => t.includes('סו-ויד'))).toBeLessThan(titles.findIndex(t => t.includes('עישון')));
  const txt = await stepsText(page);
  expect(txt).toContain('120°');
  expect(txt).toContain('אין צורך בעטיפה');
});

// ── (d) real click: switching to smoke-only re-derives the steps from THAT path ────────────────────
test('(d) tapping the smoke-only row re-derives the steps: 110°/12ש, no sous-vide step at all', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
  await page.locator('#cpListBody .cp-row[data-id="c:smoke"]').click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='c:smoke'`);
  await page.waitForSelector('#panel #methodArea .steps .step', { timeout: 10000 });

  const txt = await stepsText(page);
  expect(txt).toContain('110°');
  expect(txt).not.toContain('120°');
  expect(await stepTitles(page)).not.toContain('ואקום + סו-ויד');
});

// ── (e) the toggles and the panel are ONE state — a toggle click moves the selected row ────────────
test('(e) flipping the 🔥 גריל toggle moves the panel\'s selected row to the grill combo\'s path', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
  const before = await page.locator('#panel .cp-row.on').getAttribute('data-id');
  expect(before).toBe('c:smoke_sv');

  await page.click('#panel .mtoggle[data-mt="grill"]');
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='c:grill_smoke_sv'`);
  expect(await page.locator('#panel .mtoggle.on').evaluateAll((e: Element[]) => e.map(x => x.getAttribute('data-mt'))))
    .toEqual(['sv', 'smoke', 'grill']);
  expect(await stepsText(page)).toContain('גימור גריל');
});

// ── DoD-9 · the new reverse-step strings are localized, no Hebrew and no English fallback ─────────
for (const lang of ['ru', 'de', 'es', 'fr', 'it']) {
  test(`DoD-9 — the reverse-order step list is localized in ${lang}`, async ({ page }) => {
    const revId = await (async () => { await boot(page); return page.evaluate(`itemPaths(resolveItem('cut-1')).find(function(p){return p.order==='smoke-sv';}).id`) as Promise<string>; })();
    await boot(page, { 'mk-lang': JSON.stringify(lang), 'mk-item-path': JSON.stringify({ 'cut-1': revId }) });
    await openBrisket(page);
    const txt = await stepsText(page);
    expect(txt).not.toContain('ראב על בשר גולמי');
    expect(txt).not.toContain('Rub on raw meat');
  });
}

// ── DoD-8 · visual evidence at 390×844 ────────────────────────────────────────────────────────────
test('DoD-8 — screenshot at 390×844: the reverse-order step list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const revId = await page.evaluate(`itemPaths(resolveItem('cut-1')).find(function(p){return p.order==='smoke-sv';}).id`) as string;
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': revId }) });
  await openBrisket(page);
  await page.locator('#panel #methodArea').screenshot({ path: 'mockups/cp2-steps-reverse-390x844.png' });
});
```

- [ ] **Step 3: Run and WITNESS RED.**

```bash
npx playwright test tests/cp2-steps-path.spec.ts --reporter=list
```

Expected: all fail in `boot` at `waitForFunction` — `smokeSvSteps` does not exist. Then, to witness the ORDER failure specifically (the reason this task exists), temporarily define `function smokeSvSteps(){return[];}` nowhere — instead run the same assertions against the current composer:

```bash
npx playwright test tests/cp2-steps-path.spec.ts -g "reverse path" --reporter=list
```
After Step 4 adds `smokeSvSteps` but **before** Step 5 threads it, this must fail with:
`expect(received).toBeLessThan(expected) — Expected: < 1 / Received: 4` on `iSmoke < iSV`, plus `Received string` still containing `"אין צורך בעטיפה — הבישול הושלם בסו-ויד"` — the literal proof that the steps ignore the selected path's order. Paste it.

Test `(e)` fails at its `waitForFunction` (`c:grill_smoke_sv` never becomes the selected row) — today the toggle handler repaints the steps and leaves the panel's `.on` row on the old combo.

- [ ] **Step 4: Implement — the reverse-order composer, built from the cited stages.**

Insert immediately **before** `function composedSteps(...)` (app.js 1051):

```js
// ── CP2 · the REVERSE-ORDER (smoke→sv) step list. Composed FROM the stage objects itemStages built
// for order:'smoke-sv' (app.js 4101-4121, the order_smokesv citation) — this function computes no
// temperature and no duration: it renders each stage's own label, note and sub-line, all of which are
// already cited-aware and localized there (v264 Waves A/C), and converts the stage's own hours to the
// step timer's seconds exactly as every other generator does. It exists because svSteps (1555) hard-
// codes the sv→smoke ORDER in its prose ("no wrap needed — cooking was completed in the sous-vide"),
// a claim that is false when the smoke runs first on raw meat.
function smokeSvSteps(c, stages){
  const st=stages||[];
  const steps=[[L('ראב על בשר גולמי','Rub on raw meat'),
                L('שפשף את התיבול ישירות על הבשר החי ויבש היטב — ללא סו-ויד מקדים.',
                  'Rub the seasoning straight onto the raw meat and pat it thoroughly dry — no pre sous-vide.'), 0]];
  const KINDS=['smoke','sv','note','cook','rest','bcheck'];
  st.forEach(function(s){
    if(!s || KINDS.indexOf(s.kind)<0) return;
    const body=[s.sub, s.note].filter(Boolean).join(' · ');
    steps.push([s.label,
                body||L('לפי הלוח המצוטט למסלול זה.','Per this path\'s cited schedule.'),
                Math.round((Number(s.hours)||0)*3600)]);
  });
  return steps;
}
```

Change `composedSteps`' signature and add one branch at the very top of its body (after `const has=…`):

```js
function composedSteps(c, combo, smokeFin, opts){
  const has=m=>combo.includes(m);
  // CP2 (spec §3 item 2): the SELECTED path drives the step list. `opts` is optional — every existing
  // caller passes three arguments and gets byte-identical output, which is the strangler discipline
  // the spec asks for (no big-bang deletion of svSteps/soSteps).
  if(opts && opts.order==='smoke-sv' && has('sv') && has('smoke') && (opts.stages||[]).length)
    return smokeSvSteps(c, opts.stages);
  const produce=isProduce(c), offal=isOffal(c);
```

- [ ] **Step 5: Implement — thread the path through `paintMethod`, and give the card ONE re-render entry point.**

In `openCut`, immediately after `wireEqInvPanel($("#panel"));` (the line Task 3 anchors on), define the shared closure and re-point Task 3's call at it:

```js
  // CP2: ONE re-render entry point for the card. A path select (panel) and a method toggle change the
  // SAME state, so both re-render the whole card from it — openCut recomputes pathSel/smokeFin/smtV
  // (2873-2875) and every surface below follows (review defects D2/D4). `pendingProject=curProject`
  // is the app's own re-open idiom (4366): openCut's first line moves pendingProject into curProject,
  // so omitting it silently drops the project context. showPanel (3313) hard-resets scroll — restore it.
  const reopenCard=function(){
    const body=$("#panel").querySelector('.panel-body');
    const y=body?body.scrollTop:0;
    pendingProject=curProject;
    openCut(c);
    const nb=$("#panel").querySelector('.panel-body'); if(nb) nb.scrollTop=y;
  };
  if(typeof wireCookingPaths==='function') wireCookingPaths($("#panel"), meta, reopenCard);
```

Replace `paintMethod`'s body (openCut ~2968–2975):

```js
  function paintMethod(){
    const combo=ctxMethods(c,key);
    // CP2 (spec §3 item 2): the ORDER is a path dimension, so the step list must ask the accessor for
    // THIS path's stages. The stored order applies only to its OWN combo — a user who toggled to a
    // different method set must never inherit another path's order (the same rule effectiveSchedule
    // enforces at the model level).
    const sel=(typeof cardPathSel==='function')?cardPathSel(meta):null;
    const selCombo=(sel&&typeof cardComboOf==='function')?cardComboOf(sel):null;
    const ord=(sel && sel.order && selCombo && sameCombo(selCombo, combo))?sel.order:null;
    const stages=ord?(effectiveSchedule(meta,{methodKey:sel.methodKey, order:ord}).stages||[]):null;
    const steps=injectSeasoningSteps(composedSteps(c,combo,smokeFin,{order:ord, stages:stages}), key, !curProject);
    // the checklist key carries the order too: two orders are two different step lists, and a tick on
    // step 3 of one must never land on step 3 of the other.
    const mkey='m-'+combo.slice().sort().join('_')+(ord?('-'+ord):'');
    $("#methodArea").innerHTML=`<div class="method-note">${comboNote(combo)}</div><div class="steps">`+
      steps.map((s,i)=>stepHTML(key,mkey,i,s)).join("")+`</div>`;
    wireSteps(key,mkey,steps);
  }
```

Replace the method-toggle handler's tail (the `setCardCombo(key, next);` line from Task 5 through `clearTimers(); paintMethod();`):

```js
    setCardCombo(key, next);
    // CP2: the toggles and the path panel are ONE state — a combo change IS a path change, so record
    // it as the per-recipe default (O-1) and re-render the card from it. The id format is the profile's
    // own method key, so the new combo's row is the one itemPaths marks isDefault.
    if(typeof setItemPath==='function') setItemPath(key, 'c:'+next.slice().sort().join('_'));
    clearTimers(); reopenCard();
```

- [ ] **Step 6: Add the three new keys' translations, regenerate, verify Guard A.**

| key | en | ru | de | es | fr | it |
|---|---|---|---|---|---|---|
| `ראב על בשר גולמי` | Rub on raw meat | Натирка по сырому мясу | Rub auf rohem Fleisch | Adobo sobre la carne cruda | Rub sur la viande crue | Rub sulla carne cruda |
| `שפשף את התיבול ישירות על הבשר החי ויבש היטב — ללא סו-ויד מקדים.` | Rub the seasoning straight onto the raw meat and pat it thoroughly dry — no pre sous-vide. | Вотрите специи прямо в сырое мясо и тщательно обсушите — без предварительного су-вида. | Die Gewürze direkt auf das rohe Fleisch reiben und gründlich trocken tupfen — ohne vorheriges Sous-vide. | Frota el condimento directamente sobre la carne cruda y sécala bien: sin cocción al vacío previa. | Frottez l'assaisonnement directement sur la viande crue et séchez-la bien — sans cuisson sous vide préalable. | Massaggia il condimento direttamente sulla carne cruda e asciugala bene — senza cottura sottovuoto preliminare. |
| `לפי הלוח המצוטט למסלול זה.` | Per this path's cited schedule. | По цитируемому графику этого способа. | Nach dem zitierten Zeitplan dieses Garwegs. | Según el programa citado de esta ruta. | Selon le programme cité de ce parcours. | Secondo il programma citato di questo percorso. |

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py
```
Expected on the second run: `[i18n:Guard-A] OK …`, `[i18n:Guard-B]` numeric-safety pass, exit 0. A missing value fails here with `[i18n:Guard-A] … missing: 'ראב על בשר גולמי'` — that failure is the gate working; fix the JSON, never bypass it.

- [ ] **Step 7: Run and see GREEN, then the neighbours — the step generators have many consumers.**

```bash
npx playwright test tests/cp2-steps-path.spec.ts --reporter=list
```
Expected: `11 passed`, exit 0. Paste it.

```bash
npx playwright test tests/cp1-card-unified.spec.ts tests/cp1-surfaces.spec.ts tests/cp2-path-select.spec.ts \
  tests/cp2-statline-seam.spec.ts tests/cp2-path-panel.spec.ts tests/bug3-order-finish.spec.ts \
  tests/bug1-smoke-labels.spec.ts tests/order-effect.spec.ts tests/i18n-completeness.spec.ts \
  tests/i18n-Lcontract.spec.ts tests/i18n-extractor.spec.ts --reporter=list
```
Expected: all pass, exit 0. `bug1-smoke-labels` / `bug3-order-finish` / `order-effect` drive the timeline's `<select data-tlorder>` with `selectOption('smoke-sv')` — **no `<option value>` is edited by this task (D7 does not fire)**, and their passing proves the timeline's own order seam is untouched.

- [ ] **Step 8: Look at the screenshot (DoD-8).**

```bash
ls -l mockups/cp2-steps-reverse-390x844.png
```
Confirm at 390×844: step 1 is `ראב על בשר גולמי`, step 2 is the smoke stage at 75° carrying the *"עישון קצר — הפסטור המלא בסו-ויד"* sub-line, step 3 is `איטום ומעבר לסו-ויד`, step 4 is the 68° bath labelled *"כולל פסטור"*, and the timers on the smoke and bath steps read the stage hours.

**Safety / fidelity witness (DoD-10):** `smokeSvSteps` computes nothing — every title is a stage's own `label`, every body is its own `note`/`sub`, and the only arithmetic is `hours × 3600` for the step timer, the same conversion `composedSteps`/`svSteps` already do (1071, 1081). The `bcheck` stage is passed through as a step, never synthesized or dropped. `composedSteps`' 4th argument is optional, so every existing caller keeps its exact output. Witness: test **(b)** (no step prints a number absent from that path's stages), test **(c)** (the default step list is unchanged, 120° and the svSteps prose intact).

- [ ] **Step 9: Commit.**

```bash
git add app.js lang/en.json lang/ru.json lang/de.json lang/es.json lang/fr.json lang/it.json \
  lang/_extracted.json lang/_callsite-sig.json tests/cp2-steps-path.spec.ts mockups/cp2-steps-reverse-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): the step list re-derives from the selected path (order included)

spec 2026-07-25 §3 item 2: "…stat line, step list, raw-data table — all from stages …
strangler discipline, no big-bang deletion."

- smokeSvSteps(c,stages): the reverse (smoke→sv) step list, composed from the CITED stages
  themselves — stage.label/.note/.sub, hours×3600 for the timer, no schedule math. svSteps'
  sv-first prose ("no wrap needed — cooking was completed in the sous-vide") is false when the
  smoke runs first on raw meat, so the reverse order gets its own composer instead of a temp swap.
- composedSteps gains an OPTIONAL 4th arg {order,stages}; three-argument callers are unchanged.
- paintMethod asks cardPathSel for the selected path and passes that path's stages; a stored
  order applies only to its own combo. The checklist key carries the order (two orders are two
  step lists — a tick must not cross over).
- one reopenCard() closure now serves both the path panel and the method toggles, and a toggle
  records the new combo as the per-recipe default, so the panel's selected row follows it.

Safety: no temp/hour/safe/svt computed; the bcheck stage is passed through, never synthesized.
Timeline <option value> untouched — the order specs still selectOption('smoke-sv').

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 7 — The card's raw-data table becomes path-driven (D4), and the sources box stays

**Spec line:** *"Item card stat line / steps / raw table | `composedSteps`/`svSteps` on catalog smt/smh | `effectiveSchedule`"* and *"Item card path info | one bottom sources box | full path panel (§3.3) **+ the sources box stays**"* (spec §4, surfaces inventory).

**Files:**
- Modify `app.js` — insert `cardActivePath(meta)` + `cardRawTableHTML(c, meta, sel)` immediately **after** `cardStatlineHTML` (Task 4's block; anchor by content).
- Modify `app.js` — openCut's raw-data block (pre-Task-4 lines **2921–2946**, the `<div class="raw">…</div>` that precedes `${sourcesBlock(c)}`), replaced by one call. **`${sourcesBlock(c)}` is not touched** — the spec says the box stays.
- Modify `lang/en.json`, `lang/ru.json`, `lang/de.json`, `lang/es.json`, `lang/fr.json`, `lang/it.json` — the two new keys.
- Modify `lang/_extracted.json`, `lang/_callsite-sig.json`.
- Create `tests/cp2-rawtable-path.spec.ts`.

**Interfaces:**
- **Consumes:** `cardPathSel(meta)` / `pathSmokeLeg(meta,sel)` (Task 4), `itemPaths(meta)` (Task 1), `pathFigures(meta,p)` / `pathIcons(p)` (Task 2), `isProduce` (1208), `grillLine(c)` (2823), `upperHours` (6), `L`.
- **Produces:**
  - `cardActivePath(meta, sel)` → `path|null` — the `itemPaths` entry the card is currently rendering: matched against the SELECTION first (methodKey + order), falling back to `isDefault` (which Task 1 resolves from the store) only when there is no selection. Taking `sel` is what keeps the row's label and its figures describing the same path.
  - `cardRawTableHTML(c, meta, sel)` → `string` — the full `<div class="raw" id="cardRawTable">…</div>`: a leading **מסלול נבחר** row carrying the active path's icons/label/figures, the active schedule row marked `.rawpath-on`, and the sv+smoke row's label switching to the reverse wording when the active order is `smoke-sv`.

---

- [ ] **Step 1: Verify the raw block and the sources box are where this task edits them.**

```bash
cd C:/Users/dudib/source/repos/matconetesh
grep -n "נתוני גלם מהטבלה" app.js                      # the raw table's heading — the block's start
grep -n '\${sourcesBlock(c)}' app.js                    # the box that must NOT move
sed -n "$(grep -n 'נתוני גלם מהטבלה' app.js | cut -d: -f1),+26p" app.js
grep -n "function grillLine\|function cardStatlineHTML\|function pathFigures" app.js
```

Expected: one raw-data block inside `openCut`, opening `<div class="raw">` and closing immediately before `${sourcesBlock(c)}`; its non-produce table has the `סו-ויד+עישון` row using `smtV`/`smhV` and the `עישון בלבד` row using `c.sot`/`c.soh`; `grillLine` at 2823. Re-anchor from this grep — Tasks 4–6 shifted every line number in this file.

- [ ] **Step 2: Write the failing test.**

Create `tests/cp2-rawtable-path.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 7 (spec 2026-07-25 §4: "Item card stat line / steps / raw table … → effectiveSchedule",
// and "Item card path info | one bottom sources box | full path panel (§3.3) + the sources box stays").
// Review defect D4: the raw-data table is path-driven and must re-render on a path switch — and it
// must SAY which path it is showing, or a reader cannot tell the reverse schedule from the forward one
// (both are legitimately in the table; only one is active).

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(`typeof openCut==='function' && typeof cardRawTableHTML==='function' && typeof cardActivePath==='function'`);
};
const openBrisket = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').filter({ hasText: 'בריסקט' }).first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel #cardRawTable', { timeout: 10000 });
};
const rows = async (page: any) => page.locator('#panel #cardRawTable table tr').allInnerTexts();
const expand = async (page: any) => {
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
};

// ── (a) the table NAMES the path it is showing ────────────────────────────────────────────────────
test('(a) the raw table leads with a "מסלול נבחר" row carrying the active path\'s label and figures', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  const r = await rows(page);
  expect(r[0], `rows were ${JSON.stringify(r)}`).toContain('מסלול נבחר');
  expect(r[0]).toContain('68°');           // the default path's sous-vide leg
  expect(r[0]).toContain('120°');          // …and its cited smoke finish
  // COHERENCE: the leading row's NAME and its FIGURES describe the same path — the forward one here
  expect(r[0], 'the label must name the path whose figures are printed beside it').not.toContain('עישון→סו-ויד');
  expect(r[0]).not.toContain('75°');
  // L13: the figures are LTR islands, not bare digits in an RTL run
  expect(await page.locator('#panel #cardRawTable tr.rawpath span[dir="ltr"]').count()).toBeGreaterThan(1);
  expect(await page.locator('#panel #cardRawTable tr.rawpath-on').count(), 'exactly one schedule row is the active one').toBe(1);
});

// ── (b) D4 · a real path switch re-renders the table, label included ──────────────────────────────
test('(b) D4 — switching to the reverse order re-renders the table: the row reads עישון→סו-ויד at 75°C', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  await expand(page);
  const revId = await page.locator('#cpListBody .cp-row[data-id$=":rev"]').getAttribute('data-id');
  await page.locator(`#cpListBody .cp-row[data-id="${revId}"]`).click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='${revId}'`);

  const r = await rows(page);
  const smokeRow = r.find(x => x.includes('עישון→סו-ויד'));
  expect(smokeRow, `rows were ${JSON.stringify(r)}`).toBeTruthy();
  expect(smokeRow).toContain('75°C');
  expect(smokeRow).not.toContain('120°C');
  expect(r[0]).toContain('מסלול נבחר');
  expect(r[0]).toContain('75°');
  // COHERENCE (the reason cardActivePath takes the selection): the leading row must NAME the reverse
  // path whose figures it prints — one path's name over another's numbers is the bug, not a cosmetic
  expect(r[0], 'the leading row names the path it is showing').toContain('עישון→סו-ויד');
  expect(r[0]).not.toContain('120°');
  // the forward SCHEDULE label is gone — scoped to the schedule row's own full literal. A bare
  // 'סו-ויד+עישון' substring would also match the catalog reference row 'טיפול באמצע (סו-ויד+עישון)',
  // which is unconditional and must survive, so that assertion could never pass.
  expect(r.find(x => x.includes("טמפ' / זמן עישון (סו-ויד+עישון)")),
    'the forward SCHEDULE label is gone while the reverse is active').toBeFalsy();
  expect(r.find(x => x.includes('טיפול באמצע (סו-ויד+עישון)')),
    'and the catalog REFERENCE row for that treatment still survives').toBeTruthy();
});

// ── (c) the active-row marker follows a path with no sv leg at all ────────────────────────────────
test('(c) with the smoke-only path selected, the ACTIVE row is the smoke-only row', async ({ page }) => {
  await boot(page, { 'mk-item-path': JSON.stringify({ 'cut-1': 'c:smoke' }) });
  await openBrisket(page);
  const on = await page.locator('#panel #cardRawTable tr.rawpath-on').innerText();
  expect(on).toContain('עישון בלבד');
  expect(on).toContain('110°C');
  expect((await rows(page))[0]).toContain('מסלול נבחר');
});

// ── (d) spec §4 · THE SOURCES BOX STAYS — the panel does not replace it ───────────────────────────
test('(d) the bottom sources box still renders, with both order-impact lines, after a path switch', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  await expand(page);
  await page.locator('#cpListBody .cp-row[data-id$=":rev"]').click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id').endsWith(':rev')`);

  const boxes = page.locator('#panel .raw');
  expect(await boxes.count(), 'the raw table AND the sources box — two .raw blocks').toBe(2);
  const src = await boxes.last().innerText();
  expect(src).toContain('מקורות ואימות');
  expect(src).toContain('השפעת סדר');
  expect(src).toContain('AmazingRibs');
  expect(src).toContain('Baldwin');
});

// ── (e) INVARIANCE: every catalog reference row the table always had is still there ───────────────
test('(e) invariance — the catalog reference rows (sear, mid, rest, rub, wood, coal, difficulty) survive', async ({ page }) => {
  await boot(page);
  await openBrisket(page);
  const txt = (await rows(page)).join('\n');
  for (const label of ['צריבה', 'זמן מנוחה', 'מרינדה / ראב', "צ'אנקים / עץ", 'פחם מומלץ', 'רמת קושי'])
    expect(txt, `missing reference row: ${label}`).toContain(label);
});

// ── (f) produce items keep their own table untouched ──────────────────────────────────────────────
test('(f) negative — a produce card\'s raw table is unchanged and carries no path row', async ({ page }) => {
  await boot(page);
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="צמחי"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  await page.locator('.card[data-kind="cut"]').first().click();
  await page.waitForSelector('#panel #cardRawTable', { timeout: 10000 });
  const txt = (await rows(page)).join('\n');
  expect(txt).toContain('ראב הבית (תבנית)');
  expect(txt).not.toContain('מסלול נבחר');
});

// ── DoD-9 · localized in every active language ────────────────────────────────────────────────────
for (const lang of ['ru', 'de', 'es', 'fr', 'it']) {
  test(`DoD-9 — the raw table's path row is localized in ${lang}`, async ({ page }) => {
    await boot(page, { 'mk-lang': JSON.stringify(lang) });
    await openBrisket(page);
    const first = (await rows(page))[0];
    expect(first).not.toContain('מסלול נבחר');
    expect(first).not.toContain('Selected path');
  });
}

// ── DoD-8 · visual evidence at 390×844 ────────────────────────────────────────────────────────────
test('DoD-8 — screenshots at 390×844: the raw table default vs after a reverse switch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await openBrisket(page);
  await page.locator('#panel #cardRawTable').screenshot({ path: 'mockups/cp2-rawtable-default-390x844.png' });
  await expand(page);
  await page.locator('#cpListBody .cp-row[data-id$=":rev"]').click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id').endsWith(':rev')`);
  await page.locator('#panel #cardRawTable').screenshot({ path: 'mockups/cp2-rawtable-reverse-390x844.png' });
  await page.locator('#panel .raw').last().screenshot({ path: 'mockups/cp2-sourcesbox-stays-390x844.png' });
});
```

- [ ] **Step 3: Run and WITNESS RED.**

```bash
npx playwright test tests/cp2-rawtable-path.spec.ts --reporter=list
```

Expected: every test fails in `boot` at `waitForFunction` — `cardRawTableHTML` / `cardActivePath` do not exist. Paste it.

Now the behavioural RED the task is really about — the label/value contradiction — and it must be staged so the run can actually reach the assertion. Defining the helpers in Step 4 is not enough: until Step 5 renders them, `openCut` still emits the OLD inline `<div class="raw">` with no `id="cardRawTable"`, so every test dies in `openBrisket` at `waitForSelector('#panel #cardRawTable')` with a `TimeoutError` — a missing element, not a label contradiction. So:

1. Apply Step 4 **and** Step 5, but with the reverse branch **pinned off** — emit the forward label unconditionally, i.e. temporarily write `const rev=false;` in place of `const rev=!!(sel && sel.order==='smoke-sv');`.
2. Run:

```bash
npx playwright test tests/cp2-rawtable-path.spec.ts -g "D4 —" --reporter=list
```

Expected RED, for the intended reason: `expect(received).toBeTruthy() — Received: undefined` on `smokeRow` — the table labels the reverse schedule *"סו-ויד+עישון"* even while the reverse path is selected, so the value moved to 75°C under a label that denies it. Paste it.

3. Restore the real `const rev=!!(sel && sel.order==='smoke-sv');` and re-run the same command to GREEN. Paste that too.

- [ ] **Step 4: Implement the builder.**

Insert immediately **after** `cardStatlineHTML` (Task 4's block):

```js
// ── CP2 · the CARD'S RAW-DATA TABLE, path-driven (spec §4: "Item card stat line / steps / raw table …
// → effectiveSchedule"; review defect D4). The table keeps every catalog REFERENCE row it always had —
// it is "raw data from the table" and that is its job — and gains two things a multi-path card needs:
// a leading row NAMING the active path with its compact cited figures, and a marker on whichever
// schedule row that path actually uses. The sv+smoke row's LABEL follows the active order, because the
// same numbers under the wrong label is the contradiction this whole spec exists to kill.
// The path the table is actually SHOWING. It takes the selection, not just the stored default: the row
// beneath it prints figures resolved from `sel`, and `isDefault` is not a stable identity — methods[0]
// is activeMethods(c,key) (app.js 3801-3803), which is gear- and session-dependent, so a stale
// mk-item-path id, a gear change that removes the stored combo, or any future non-persisting selection
// would put one path's NAME over another path's FIGURES. That is the same-numbers-wrong-label
// contradiction this task exists to kill, so the resolver must answer for the selection first.
function cardActivePath(meta, sel){
  let paths=[]; try{ paths=itemPaths(meta)||[]; }catch(e){ paths=[]; }
  if(sel && sel.methodKey){
    const hit=paths.find(function(p){ return p.methodKey===sel.methodKey && (p.order||null)===(sel.order||null); });
    if(hit) return hit;
  }
  return paths.find(function(p){ return p.isDefault; })||null;
}
// NOTE on the absent `typeof` guards below: pathSmokeLeg / pathStages / pathHasKind / pathFigures /
// pathIcons are created by THIS plan (Tasks 2 and 4), not by an optional runtime. Guarding them would
// turn a task-ordering mistake into a table that quietly falls back to pre-CP1 catalog values under a
// CP2 label — silent degradation, the shape docs/process/skills/no-inert-shipment/SKILL.md exists to
// prevent. They are called unconditionally so a missing helper throws on first render.
function cardRawTableHTML(c, meta, sel){
  const hd=`<h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px">${L('נתוני גלם מהטבלה','Raw data from the table')}</h4>`;
  const leg=pathSmokeLeg(meta,sel);
  const smtV=leg?leg.t:c.smt, smhV=leg?leg.h:c.smh;
  if(isProduce(c)) return `<div class="raw" id="cardRawTable">${hd}<table>
        <tr><td>${L('גריל / אש ישירה','Grill / direct heat')}</td><td>${c.sot}°C · ~${Math.round(upperHours(c.soh)*60)} ${L("דק'",'min')}</td></tr>
        <tr><td>${L('סו-ויד (ריכוך)','Sous-vide (soften)')}</td><td>${c.svt}°C · ${c.svh} ${L('שעות','hours')}</td></tr>
        <tr><td>${L('גימור לאחר סו-ויד','Finish after sous-vide')}</td><td>${smtV}°C · ~${Math.round(upperHours(smhV)*60)} ${L("דק'",'min')}</td></tr>
        <tr><td>${L('ראב הבית (תבנית)','House rub (template)')}</td><td>${c.rub}</td></tr>
        <tr><td>${L('טיפ הכנה','Prep tip')}</td><td>${c.somid||'—'}</td></tr>
        <tr><td>${L('עץ לעשן (אופציונלי)','Wood for smoke (optional)')}</td><td>${c.wood}</td></tr>
        <tr><td>${L('רמת קושי','Difficulty','heading')}</td><td>${c.diff} / 5</td></tr>
       </table></div>`;
  const p=cardActivePath(meta, sel);
  const rev=!!(sel && sel.order==='smoke-sv');
  // which schedule row the active path actually uses: the sv+smoke row (forward or reverse) when the
  // path has both legs, the smoke-only row when it has no sous-vide leg, neither otherwise.
  const st=pathStages(meta,sel);
  const usesSvSmoke=pathHasKind(st,'sv') && pathHasKind(st,'smoke');
  const usesSmokeOnly=!pathHasKind(st,'sv') && pathHasKind(st,'smoke');
  const pathRow=p?`<tr class="rawpath"><td>${L('מסלול נבחר','Selected path')}</td><td>${pathIcons(p)} ${p.label} · ${pathFigures(meta,p)}</td></tr>`:'';
  return `<div class="raw" id="cardRawTable">${hd}<table>
        ${pathRow}
        <tr><td>${L("טמפ' / זמן סו-ויד",'Sous-vide temp / time')}</td><td>${c.svt}°C · ${c.svh} ${L('שעות','hours')}</td></tr>
        <tr class="${usesSvSmoke?'rawpath-on':''}"><td>${rev?L("טמפ' / זמן עישון (עישון→סו-ויד)",'Smoke temp / time (smoke→sous-vide)'):L("טמפ' / זמן עישון (סו-ויד+עישון)",'Smoke temp / time (sous-vide+smoke)')}</td><td>${smtV}°C · ${smhV} ${L('שעות','hours')}</td></tr>
        <tr class="${usesSmokeOnly?'rawpath-on':''}"><td>${L("טמפ' / זמן עישון בלבד",'Smoke-only temp / time')}</td><td>${c.sot}°C · ${c.soh} ${L('שעות','hours')}</td></tr>
        ${grillLine(c)?`<tr><td>${L("גריל (טמפ' / זמן / אזור)",'Grill (temp / time / zone)')}</td><td>${grillLine(c)}</td></tr>`:''}
        <tr><td>${L("טמפ' יעד (מרקם) / בטיחות",'Target temp (texture) / safety')}</td><td>${c.tgt}°C${c.safe?` / ${c.safe}°C`:''}</td></tr>
        <tr><td>${L('צריבה','Sear')}</td><td>${c.sear}</td></tr>
        <tr><td>${L('טיפול באמצע (סו-ויד+עישון)','Mid-cook treatment (sous-vide+smoke)')}</td><td>${c.mid}</td></tr>
        <tr><td>${L('טיפול / עטיפה (עישון בלבד)','Treatment / wrap (smoke-only)')}</td><td>${c.somid}</td></tr>
        <tr><td>${L('זמן מנוחה','Rest time')}</td><td>${c.rest} ${L("דק'",'min')}</td></tr>
        <tr><td>${L('מרינדה / ראב','Marinade / rub')}</td><td>${c.rub}</td></tr>
        <tr><td>${L("צ'אנקים / עץ",'Chunks / wood')}</td><td>${c.wood}</td></tr>
        <tr><td>${L('פחם מומלץ','Recommended charcoal')}</td><td>${c.coal}</td></tr>
        <tr><td>${L('רמת קושי','Difficulty','heading')}</td><td>${c.diff} / 5</td></tr>
       </table></div>`;
}
```

Append to the CP2 block at the end of `app.css`:

```css
/* CP2 Task 7 · the raw table's active-path rows. Token-only, no media query (same as the blocks above). */
#cardRawTable tr.rawpath td{ color:var(--bone); font-weight:700; border-bottom:1px solid var(--line2); }
#cardRawTable tr.rawpath-on td{ background:var(--char2); box-shadow:inset 2px 0 0 var(--ember); }
```

- [ ] **Step 5: Render it — one line in `openCut`, and the sources box left exactly where it is.**

Replace openCut's whole raw-data block (`<div class="raw">` … `</div>` immediately preceding `${sourcesBlock(c)}`) with:

```js
     ${cardRawTableHTML(c, meta, pathSel)}
     ${sourcesBlock(c)}
```

> **Spec §4 compliance, stated:** `sourcesBlock(c)` is untouched — *"full path panel (§3.3) + the sources box stays"*. Its `🔀 השפעת סדר` lines keep showing BOTH cited orders regardless of which one is selected; that is the citation record, not the active schedule, and test (d) guards it.

- [ ] **Step 6: Add the two new keys' translations, regenerate, verify Guard A.**

| key | en | ru | de | es | fr | it |
|---|---|---|---|---|---|---|
| `מסלול נבחר` | Selected path | Выбранный способ | Gewählter Garweg | Ruta seleccionada | Parcours sélectionné | Percorso selezionato |
| `טמפ' / זמן עישון (עישון→סו-ויד)` | Smoke temp / time (smoke→sous-vide) | Темп./время копчения (копчение→су-вид) | Räuchertemp./-zeit (Räuchern→Sous-vide) | Temp./tiempo de ahumado (ahumado→cocción al vacío) | Temp./durée de fumage (fumage→sous vide) | Temp./tempo di affumicatura (affumicatura→sottovuoto) |

Every other label in the rebuilt table is an **existing** key, moved verbatim — no re-add, no re-word.

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py
git diff --stat lang/
```
Expected on the second run: `[i18n:Guard-A] OK …`, exit 0; the diff touches the six language files (two keys each) plus the two artifacts, nothing else.

- [ ] **Step 7: Run and see GREEN, then the neighbours.**

```bash
npx playwright test tests/cp2-rawtable-path.spec.ts --reporter=list
```
Expected: `12 passed`, exit 0. Paste it.

```bash
npx playwright test tests/cp1-card-unified.spec.ts tests/cp1-surfaces.spec.ts tests/cp2-path-panel.spec.ts \
  tests/cp2-statline-seam.spec.ts tests/cp2-path-select.spec.ts tests/cp2-steps-path.spec.ts \
  tests/cp2-default-path.spec.ts tests/cp2-path-presentation.spec.ts tests/i18n-completeness.spec.ts --reporter=list
```
Expected: all pass, exit 0. `cp1-card-unified`'s raw-table assertion (`סו-ויד+עישון` row = the wired finish, never 105°C) passing through the rebuilt table is the proof the CP1 contract survived — and Task 3's own D4 assertion still passes because the reverse row now carries its own label.

- [ ] **Step 8: Look at the screenshots (DoD-8).**

```bash
ls -l mockups/cp2-rawtable-default-390x844.png mockups/cp2-rawtable-reverse-390x844.png mockups/cp2-sourcesbox-stays-390x844.png
```
Confirm at 390×844: the default table leads with `מסלול נבחר · ⚡ סו-ויד + עישון … 68°/30ש → 120°/1.5ש` and the ember-edged active row is the `סו-ויד+עישון` one; after the switch, the leading row and the active row both read the reverse (75°) and the row label says `עישון→סו-ויד`; the sources box below still shows both order-impact lines with their `↗` links.

**Safety / fidelity witness (DoD-10):** every value in the table is the same expression it was before — `c.svt/c.svh`, `c.sot/c.soh`, `c.tgt/c.safe`, `grillLine(c)` and the catalog reference fields, rendered verbatim; the only value that follows the path is `smtV/smhV`, which comes from `pathSmokeLeg` → `effectiveSchedule` stage objects (Task 4's witness). No `bcheck` stage, `safe`, `svt`, temp or duration is computed or mutated; the active-row marker and the leading row add markup only. `sourcesBlock` is byte-untouched. Witness: test **(e)** (every catalog reference row survives), test **(f)** (the produce table is unchanged and gets no path row), test **(d)** (both cited orders still render in the sources box after a switch).

- [ ] **Step 9: Commit.**

```bash
git add app.js app.css lang/en.json lang/ru.json lang/de.json lang/es.json lang/fr.json lang/it.json \
  lang/_extracted.json lang/_callsite-sig.json tests/cp2-rawtable-path.spec.ts \
  mockups/cp2-rawtable-default-390x844.png mockups/cp2-rawtable-reverse-390x844.png mockups/cp2-sourcesbox-stays-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): the card's raw-data table is path-driven, and the sources box stays

spec 2026-07-25 §4: "Item card stat line / steps / raw table … → effectiveSchedule" and
"Item card path info | one bottom sources box | full path panel (§3.3) + the sources box stays".

- cardRawTableHTML(c,meta,sel) + cardActivePath(meta): the table keeps every catalog REFERENCE
  row and gains a leading "מסלול נבחר" row (icons + label + the path's compact cited figures, in
  dir="ltr" islands) plus a .rawpath-on marker on the schedule row the active path actually uses.
- the sv+smoke row's LABEL follows the active order — the same numbers under "סו-ויד+עישון"
  while the reverse path is selected was the contradiction this spec exists to kill (D4).
- sourcesBlock is untouched and still renders both cited order-impact lines (asserted).

Safety: every value is the expression it already was; only the smoke leg follows the path, via
effectiveSchedule's stage objects. No temp/hour/safe/svt/bcheck computed or mutated.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 8 — The plan/event-level selector generalizes from `SV_SMOKE_ORDERS` to `itemPaths` (spec §3.5), with the D7 migration and the `comboHasSvSmoke` gate re-sited

**Spec line:** *"**Plan/event level (the owner's #4):** the timeline/event path selector offers the same `itemPaths` set; a plan-level change overrides FOR THAT occurrence only and always resolves through the item's cited entries — semantics never restated (O-1 law). The existing svSmokeOrder seam becomes a special case of path selection"* (spec §3, item 5) — and the §4 surfaces row *"Timeline stage rows + order select | `itemStages` ✓ (v264) | unchanged, selector generalizes to paths"*.

**Files:**
- Modify `app.js` — insert the six plan-level helpers immediately **after** `comboHasSvSmoke`'s closing brace (currently line **4222**, i.e. after Task 2's presentation block, which is inserted at that same point; re-anchor by content).
- Modify `app.js` **7312–7319** — the plan-view order strip (`orderItems` filter + `orderControlsHtml`), inside `buildList`. **7319 is `orderControlsHtml`'s terminating `</div>`:'';` and is the LAST line to replace — 7320 is `const _blk=computed.filter(c=>c.blocked)…`, a live definition read ~34 lines later at 7354. Deleting it produces a `ReferenceError` that takes out the whole timeline.
- Modify `app.js` **7416–7421** — the per-item timeline card's `showOrder` / `orderRow` / `orderWarn`.
- Modify `app.js` **7479–7481** — the `[data-tlorder]` change handler → `[data-tlpath]`.
- Modify `lang/{en,ru,de,es,fr,it}.json` — the two new keys this task introduces.
- Modify `lang/_extracted.json`, `lang/_callsite-sig.json`.
- **Migrate (D7)** — `tests/bug1-smoke-labels.spec.ts` (locators L35, L68, L150, L177; `selectOption` L37, L70, L152, L161, L179), `tests/bug3-order-finish.spec.ts` (locators L122, L181; `selectOption` L123, L182), `tests/order-effect.spec.ts` (locator L40; `selectOption` L44).
- Create `tests/cp2-plan-selector.spec.ts`.

**Interfaces:**
- **Consumes:** `itemPaths(meta)` (Task 1), `comboHasSvSmoke(meta,methodKey)` (4217), `svSmokeOrderDefault()` (3840), `itemStages` via the existing `buildList` call (7053), `tlState()`/`tlSetState(s)` (6149/6150), `itemName(m)` (8687), `esc`, `L(he,en)` (8706).
- **Produces:**
  - `tlPathChoices(meta)` → `path[]` — every `itemPaths` entry, cited **and** placeholder, in enumeration order (§3.3's "ALL entries", D12).
  - `tlPathOrderAttr(p)` → `'sv-smoke'|'smoke-sv'|''` — the sv/smoke ORDER a path resolves to; `''` when the path's combo does not carry both legs.
  - `tlPathIdFor(meta, st)` → `string|null` — the path id the **occurrence state** (`st.method` + `st.svSmokeOrder`) currently names.
  - `tlPathEligible(meta)` → `boolean` — ≥2 **cited** entries, i.e. the occurrence has a real choice.
  - `tlApplyPath(all, itemKey, p)` → `void` — writes the per-occurrence override into `tlState` only (`method`+`methodPinned`+`pathPinned`+`svSmokeOrder`); never touches `mk-item-path`. `pathPinned` is the flag Task 9 reads to decide whether an occurrence inherits the card's per-recipe default.
  - `tlPathSelectHTML(meta, st)` → `string` — `<select data-tlpath="<key>">` whose options carry `value="<path id>"` and `data-tlpathorder="<order>"`; placeholders render `disabled`.

---

- [ ] **Step 1: Verify every anchor with serena and grep before touching anything — Tasks 1–7 moved every line number in this file.**

```bash
cd C:/Users/dudib/source/repos/matconetesh
grep -n "function comboHasSvSmoke\|function svSmokeOrderDefault\|function tlState\|function tlSetState\|function itemPaths" app.js
grep -n "data-tlorder" app.js                      # the THREE sites this task rewrites
grep -n "const orderItems=computed.filter" app.js   # the plan-strip gate
grep -n "const showOrder=comboHasSvSmoke" app.js    # the per-card gate
grep -n "^  buildList();" app.js                    # openTimeline's tail — the handler must re-enter it
```

Expected (pre-CP2 values, re-anchor if Tasks 1–7 shifted them): `comboHasSvSmoke` 4217, `svSmokeOrderDefault` 3840, `tlState` 6149, `tlSetState` 6150; `data-tlorder` at **7317** (plan strip), **7419** (per-card row) and **7479** (the change handler); `orderItems` at **7312**; `showOrder` at **7416**; `buildList();` at **7517**.

```
mcp__serena__find_symbol             name_path="comboHasSvSmoke" relative_path="app.js" include_body=true
mcp__serena__find_referencing_symbols name_path="comboHasSvSmoke" relative_path="app.js"
mcp__serena__find_symbol             name_path="itemPaths"       relative_path="app.js" include_body=true
```

`comboHasSvSmoke`'s referencing symbols must include the two `buildList` sites (7312, 7416) **and** `itemPaths` (Task 1's `pathCited`/reverse-entry gate). That second reference is the whole D12 answer and must be re-confirmed here, not remembered: the safety gate (`order_smokesv.sv.pasteurize===true`) does not move — it lives **inside** the enumeration, so a reverse path that fails it never becomes an option in the first place.

- [ ] **Step 2: Write the failing test — real interactions on the real timeline, asserting the OCCURRENCE'S RENDERED SCHEDULE.**

Create `tests/cp2-plan-selector.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 8 (spec 2026-07-25 §3 item 5: "the timeline/event path selector offers the same itemPaths
// set; a plan-level change overrides FOR THAT occurrence only and always resolves through the item's
// cited entries"; §4: "unchanged, selector generalizes to paths").
//
// The old control was an ORDER select over SV_SMOKE_ORDERS' two literals, shown only when
// comboHasSvSmoke passed. It is now a PATH select over itemPaths. The safety gate does NOT move: the
// reverse entry is emitted by itemPaths only when comboHasSvSmoke holds (cited order_smokesv with
// pasteurize:true), and the danger-zone WARNING keeps its own comboHasSvSmoke gate.
//
// The seeding idiom (saveMenu + openTimeline through page.evaluate) is the shipped convention of every
// timeline spec in this suite (tests/bug1-smoke-labels.spec.ts:31, tests/bug3-order-finish.spec.ts,
// tests/order-effect.spec.ts) — it is SETUP. Every assertion below is on RENDERED DOM after a REAL
// interaction (selectOption / click), never on the model.

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(
    `typeof openTimeline==='function' && typeof tlPathSelectHTML==='function' && typeof tlPathChoices==='function' && typeof itemPaths==='function'`);
};

const openPlan = async (page: any, keys: string[], view: 'items' | 'plan' = 'items') => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:${JSON.stringify(keys)},sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    store.set('mk-tlview',${JSON.stringify(view)});
    openTimeline();
  })()`);
  await page.waitForSelector('#panel select[data-tlpath]', { timeout: 15000 });
};

// expand the item card so its stage rows are the VISIBLE evidence (the shipped idiom, bug1 L46-48)
const expandFirstCard = async (page: any) => {
  const card = page.locator('#panel .tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });
};
const stageRows = async (page: any): Promise<string[]> =>
  page.locator('#panel .tl-stage').allInnerTexts();
const pathSel = (page: any) => page.locator('#panel select[data-tlpath]').first();
const optionValueForOrder = async (page: any, order: string): Promise<string> => {
  const v = await pathSel(page).locator(`option[data-tlpathorder="${order}"]`).first().getAttribute('value');
  expect(v, `no option carries data-tlpathorder="${order}"`).toBeTruthy();
  return v as string;
};

// ── (a) §3.5 + D12: the selector offers the SAME itemPaths set — ALL entries, none dropped ─────────
test('(a) the plan-level selector lists every itemPaths entry, in order, placeholders included but disabled', async ({ page }) => {
  await boot(page);
  await openPlan(page, ['cut-1']);
  const domIds = await pathSel(page).locator('option').evaluateAll(
    (els: Element[]) => els.map(e => (e as HTMLOptionElement).value));
  const modelIds = await page.evaluate(`itemPaths(resolveItem('cut-1')).map(function(p){return p.id;})`) as string[];
  expect(domIds, 'the selector must not narrow the set the card panel shows').toEqual(modelIds);

  const disabled = await pathSel(page).locator('option[disabled]').evaluateAll(
    (els: Element[]) => els.map(e => (e as HTMLOptionElement).value));
  const soonIds = await page.evaluate(
    `itemPaths(resolveItem('cut-1')).filter(function(p){return p.cited===false;}).map(function(p){return p.id;})`) as string[];
  expect(disabled, 'an uncited path is offered for visibility but is NEVER selectable').toEqual(soonIds);
  expect(await pathSel(page).locator('option[disabled]').first().innerText()).toContain('בקרוב — מקור בבדיקה');
});

// ── (b) THE POINT: the OCCURRENCE'S SCHEDULE actually changes, not just the option list ────────────
test('(b) choosing the reverse path re-renders the occurrence\'s stage rows at the cited 75°, and raises the danger-zone warning', async ({ page }) => {
  await boot(page);
  await openPlan(page, ['cut-1']);
  await expandFirstCard(page);
  const before = (await stageRows(page)).join('\n');
  expect(before, 'precondition: the occurrence opens on the forward sv→smoke finish').toContain('120°');

  const revValue = await optionValueForOrder(page, 'smoke-sv');
  await pathSel(page).selectOption(revValue);
  await page.waitForFunction(
    `Array.from(document.querySelectorAll('#panel .tl-stage')).some(function(r){ return (r.textContent||'').indexOf('75°')>=0; })`);

  await expandFirstCard(page);
  const after = (await stageRows(page)).join('\n');
  expect(after, 'the occurrence now runs the cited reverse smoke leg').toContain('75°');
  expect(after, 'and the forward finish is gone from this occurrence').not.toContain('120°');
  await expect(page.locator('#panel .tl-safety-warn').first()).toBeVisible();
  expect(await page.locator('#panel .tl-safety-warn').first().innerText()).toContain('טמפ׳-סכנה');
});

// ── (c) a NON-order path: the selector is a PATH selector, so the sv leg can disappear entirely ────
test('(c) choosing the smoke-only path drops the sous-vide stage row from the occurrence', async ({ page }) => {
  await boot(page);
  await openPlan(page, ['cut-1']);
  await expandFirstCard(page);
  expect((await stageRows(page)).join('\n')).toContain('סו-ויד');

  await pathSel(page).selectOption('c:smoke');
  await page.waitForFunction(
    `!Array.from(document.querySelectorAll('#panel .tl-stage')).some(function(r){ return (r.textContent||'').indexOf('סו-ויד')>=0; })`);
  await expandFirstCard(page);
  const after = (await stageRows(page)).join('\n');
  expect(after, 'a smoke-only path has no bath leg — the old order select could never express this').not.toContain('סו-ויד');
  expect(after).toContain('עישון');
  expect(await page.locator('#panel .tl-safety-warn').count(), 'no sv+smoke combo → no reverse-order warning').toBe(0);
});

// ── (d) O-1 boundary: the plan-level change is PER-OCCURRENCE, never the recipe default ────────────
test('(d) §3.5 — the override lands in mk-tlstate-<scope> and mk-item-path is never written', async ({ page }) => {
  await boot(page);
  await openPlan(page, ['cut-1']);
  const revValue = await optionValueForOrder(page, 'smoke-sv');
  await pathSel(page).selectOption(revValue);
  await page.waitForFunction(
    `Array.from(document.querySelectorAll('#panel .tl-stage')).some(function(r){ return (r.textContent||'').indexOf('75°')>=0; })`);

  const st = await page.evaluate(`tlState()['cut-1']`) as any;
  expect(st.svSmokeOrder, 'the occurrence carries the reverse order').toBe('smoke-sv');
  expect(st.methodPinned, 'and the method it belongs to is pinned for this occurrence').toBe(true);
  expect(st.pathPinned, 'the occurrence OWNS this path — Task 9 must not overwrite it from the card default').toBe(true);
  expect(await page.evaluate(`localStorage.getItem('mk-item-path')`),
    'a plan-level change must NEVER become the per-recipe default (spec §3.5 / O-1)').toBeNull();

  // and the CARD still opens on its own default — the two stores are independent
  await page.evaluate(`closePanel(); openCut(resolveItem('cut-1').obj);`);
  await page.waitForSelector('#panel #cardStatline .stat', { timeout: 10000 });
  const stats = await page.locator('#panel #cardStatline .stat').allInnerTexts();
  expect(stats.find(s => s.includes('עישון')), `card stats were ${JSON.stringify(stats)}`).toContain('120°');
});

// ── (e) D12 / SAFETY: the comboHasSvSmoke gate still governs WHICH paths exist ─────────────────────
test('(e) an sv+smoke item WITHOUT cited order_smokesv is offered a selector but never a reverse path', async ({ page }) => {
  await boot(page);
  // pick the subject LIVE from the catalog (setup only) — never hardcode which item lacks the citation
  const key = await page.evaluate(`(function(){
    var hit=null;
    (DATA.cuts||[]).forEach(function(c){
      if(hit) return;
      var m=metaCut(c); if(c.order_smokesv) return;
      var p=itemProfile(m); if(!p) return;
      var both=p.methods.some(function(x){ return x.combo && x.combo.indexOf('sv')>=0 && x.combo.indexOf('smoke')>=0; });
      if(both && itemPaths(m).filter(function(x){return x.cited!==false;}).length>1) hit=m.key;
    });
    return hit;
  })()`) as string;
  expect(key, 'the catalog must contain an sv+smoke item without cited reverse data').toBeTruthy();

  await openPlan(page, [key]);
  expect(await pathSel(page).locator('option[data-tlpathorder="smoke-sv"]').count(),
    'comboHasSvSmoke gates the ENTRY: no cited pasteurize:true reverse data → no reverse path, anywhere').toBe(0);
  expect(await pathSel(page).locator('option').count(), 'but the item still gets its other cited paths').toBeGreaterThan(1);
  expect(await page.locator('#panel .tl-safety-warn').count()).toBe(0);
});

// ── (f) the PLAN view strip carries the same control over the same occurrence ──────────────────────
test('(f) the work-plan strip offers the same set and changes the same occurrence', async ({ page }) => {
  await boot(page);
  await openPlan(page, ['cut-1'], 'plan');
  const strip = page.locator('#panel .tl-orderstrip').first();
  await expect(strip).toBeVisible();
  const stripIds = await strip.locator('select[data-tlpath] option').evaluateAll(
    (els: Element[]) => els.map(e => (e as HTMLOptionElement).value));
  const modelIds = await page.evaluate(`itemPaths(resolveItem('cut-1')).map(function(p){return p.id;})`) as string[];
  expect(stripIds).toEqual(modelIds);

  const revValue = await optionValueForOrder(page, 'smoke-sv');
  await pathSel(page).selectOption(revValue);
  await expect(page.locator('#panel .tl-safety-warn').first()).toBeVisible();
  expect(await page.evaluate(`tlState()['cut-1'].svSmokeOrder`)).toBe('smoke-sv');
});

// ── (g) the control NAMES itself as a path control (DoD-9, Hebrew) ────────────────────────────────
test('(g) the label reads מסלול בישול, not the retired סדר בישול wording', async ({ page }) => {
  await boot(page);
  await openPlan(page, ['cut-1']);
  const row = page.locator('#panel .tl-order').first();
  expect(await row.innerText()).toContain('מסלול בישול');
  await openPlan(page, ['cut-1'], 'plan');
  expect(await page.locator('#panel .tl-orderstrip-lbl').first().innerText()).toContain('מסלול בישול');
});

// ── DoD-8 · visual evidence at 390×844 ────────────────────────────────────────────────────────────
test('DoD-8 — screenshots at 390×844: the item-card selector, the plan strip, and after a switch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await openPlan(page, ['cut-1']);
  await page.locator('#panel .tlcard').first().screenshot({ path: 'mockups/cp2-plan-selector-card-390x844.png' });
  const revValue = await optionValueForOrder(page, 'smoke-sv');
  await pathSel(page).selectOption(revValue);
  await page.waitForFunction(
    `Array.from(document.querySelectorAll('#panel .tl-stage')).some(function(r){ return (r.textContent||'').indexOf('75°')>=0; })`);
  await expandFirstCard(page);
  await page.locator('#panel .tlcard').first().screenshot({ path: 'mockups/cp2-plan-selector-after-switch-390x844.png' });
  await openPlan(page, ['cut-1'], 'plan');
  await page.locator('#panel .tl-orderstrip').first().screenshot({ path: 'mockups/cp2-plan-selector-strip-390x844.png' });
});
```

- [ ] **Step 3: Run it and WITNESS RED for the intended reason (DoD-2).**

```bash
npx playwright test tests/cp2-plan-selector.spec.ts --reporter=list
```

Expected: **every** test fails in `boot` at the `waitForFunction` — `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` — because `tlPathSelectHTML` / `tlPathChoices` do not exist. Paste the output.

Then, after Step 4 defines the helpers but **before** Step 5 renders them, re-run to witness the RED that actually names the defect:

```bash
npx playwright test tests/cp2-plan-selector.spec.ts -g "(a)|(c)" --reporter=list
```
Expected: `(a)` and `(c)` fail at `page.waitForSelector('#panel select[data-tlpath]')` — `TimeoutError: Timeout 15000ms exceeded` — because the timeline still renders `select[data-tlorder]` with the two `SV_SMOKE_ORDERS` literals. That is the literal proof the selector has not generalized: the occurrence can express only an ORDER, never the smoke-only or grill combos the card panel already lists. Paste it.

- [ ] **Step 4: Implement the plan-level path helpers.**

Insert immediately **after** `comboHasSvSmoke`'s closing brace (and after Task 2's presentation block):

```js
// ── CP2 · the PLAN/EVENT-LEVEL PATH SELECTOR (spec §3 item 5: "the timeline/event path selector offers
// the same itemPaths set; a plan-level change overrides FOR THAT occurrence only and always resolves
// through the item's cited entries"). This REPLACES the two-literal SV_SMOKE_ORDERS <select>; the
// existing svSmokeOrder seam becomes one dimension of a path, exactly as the spec says.
//
// SAFETY, stated once (spec §5, "the reverse-order eligibility gate generalizes per path kind"): the
// comboHasSvSmoke gate does NOT move and is NOT loosened. It lives inside itemPaths, where it decides
// whether the reverse ENTRY exists at all (cited order_smokesv with sv.pasteurize===true). What
// generalizes here is only the selector's VISIBILITY rule — from "this item's combo has both legs" to
// "this occurrence has more than one cited path to choose between". The danger-zone warning keeps its
// own explicit comboHasSvSmoke gate below.
function tlPathChoices(meta){
  try{ return itemPaths(meta)||[]; }catch(e){ return []; }
}
// Which sv/smoke ORDER a path resolves to. '' for a path whose combo does not carry both legs — the
// order is meaningless there and must never linger in the occurrence state.
function tlPathOrderAttr(p){
  const mk=String((p&&p.methodKey)||'');
  const both=mk.indexOf('sv')>=0 && mk.indexOf('smoke')>=0;
  return both?(p.order||svSmokeOrderDefault()):'';
}
// The path id the OCCURRENCE currently names, resolved from the existing per-event state (st.method +
// st.svSmokeOrder) — no new store, no migration: mk-tlstate-<evScope> keeps being the per-occurrence
// override (spec §3.5), and mk-item-path keeps being the per-recipe default (O-1). They never mix.
function tlPathIdFor(meta, st){
  const want=(st&&st.svSmokeOrder)||svSmokeOrderDefault();
  const ps=tlPathChoices(meta).filter(function(p){ return p.cited!==false; });
  const hit=ps.find(function(p){
    if(p.methodKey!==(st&&st.method)) return false;
    const o=tlPathOrderAttr(p);
    return o? (o===want) : true;
  });
  if(hit) return hit.id;
  const def=ps.find(function(p){ return p.isDefault; })||ps[0];
  return def?def.id:null;
}
// A selector is worth showing when the occurrence has a real choice: ≥2 CITED entries. Placeholders are
// listed (spec §3.3's "ALL entries") but can never make an item "choosable" on their own.
function tlPathEligible(meta){
  return tlPathChoices(meta).filter(function(p){ return p.cited!==false; }).length>1;
}
// The per-occurrence write. Nothing here computes or mutates a temp, an hour, a safe value or a bcheck
// stage — it records WHICH cited path this occurrence runs; buildList then re-derives the stages through
// itemStages exactly as it always has (app.js 7053).
function tlApplyPath(all, itemKey, p){
  if(!all || !itemKey || !p || p.cited===false) return;
  const st=all[itemKey]=all[itemKey]||{ready:true};
  st.method=p.methodKey;
  st.methodPinned=true;                                   // an explicit occurrence choice, same as the method <select>
  st.pathPinned=true;                                     // …and it owns the ORDER too — Task 9 reads this to decide
                                                          // whether the occurrence inherits the card's default path
  const ord=tlPathOrderAttr(p);
  st.svSmokeOrder=ord||svSmokeOrderDefault();             // a path without both legs resets the order — never inherits
}
function tlPathSelectHTML(meta, st){
  const cur=tlPathIdFor(meta, st);
  const soonTxt=L('בקרוב — מקור בבדיקה','Coming soon — source under review');
  const opts=tlPathChoices(meta).map(function(p){
    const soon=(p.cited===false);
    // data-tlpathorder is the STABLE hook the order regression specs select through (D7 migration):
    // option VALUES are now path ids, so a literal selectOption('smoke-sv') no longer resolves.
    return `<option value="${esc(p.id)}" data-tlpathorder="${tlPathOrderAttr(p)}"${soon?' disabled':''}${(!soon&&p.id===cur)?' selected':''}>`+
           `${p.label}${soon?` — ${soonTxt}`:''}</option>`;
  }).join('');
  return `<select data-tlpath="${esc(meta.key)}">${opts}</select>`;
}
```

- [ ] **Step 5: Render it — the plan strip, the per-item card row, and the handler.**

Replace app.js **7312–7319** (the `orderItems` filter through `orderControlsHtml`'s terminating `</div>`:'';` — **not** 7320, which is `const _blk=…`):

```js
    // CP2 (spec §3 item 5): the plan strip is a PATH selector now, not an order selector. Visibility
    // generalizes to "this occurrence has more than one cited path"; the danger-zone warning keeps its
    // own comboHasSvSmoke gate below, unchanged and un-loosened.
    const orderItems=computed.filter(c=>!c.blocked && tlPathEligible(c.m));
    const orderControlsHtml=orderItems.length?`<div class="tl-orderstrip">
      <div class="tl-orderstrip-lbl">🔄 ${L('מסלול בישול לכל פריט:','Cooking path per item:')}</div>
      ${orderItems.map(c=>`<div class="tl-order tl-order-plan">
        <span class="tl-order-lbl">${itemName(c.m)}:</span>
        ${tlPathSelectHTML(c.m, c.st)}
      </div>${(comboHasSvSmoke(c.m, c.st.method) && c.st.svSmokeOrder==='smoke-sv')?`<div class="tl-safety-warn">⚠️ <b>${itemName(c.m)}:</b> ${L('הבשר שוהה בטמפ׳-סכנה בשלב העישון <u>לפני</u> הפסטור. שלב הסו-ויד המסומן "כולל פסטור" חייב להתבצע במלואו. בספק — עבור לסדר סו-ויד←עישון.','The meat sits in the danger zone during the smoke stage <u>before</u> pasteurization. The sous-vide stage marked "incl. pasteurization" must be carried out in full. When in doubt — switch to the sous-vide→smoke order.')}</div>`:''}`).join('')}
    </div>`:'';
```

Then prove the neighbouring definition survived — the one-character range error that costs a debug cycle:

```bash
grep -n "const _blk=computed.filter" app.js    # must STILL exist, exactly once
grep -n '\${_blk.length?' app.js               # its reader, still present
```

Replace app.js **7416–7421** (`showOrder` / `orderRow` / `orderWarn`):

```js
    // CP2: the per-item card's control is the same path selector. `showOrder` keeps its exact old name
    // and meaning for the WARNING (comboHasSvSmoke — the cited pasteurize:true gate); the SELECTOR's
    // own gate is tlPathEligible.
    const showOrder=comboHasSvSmoke(m, st.method);
    const orderRow=tlPathEligible(m)?`<div class="tl-order">
        <span class="tl-order-lbl">${L('מסלול בישול','Cooking path')}:</span>
        ${tlPathSelectHTML(m, st)}
      </div>`:'';
    const orderWarn=(showOrder && st.svSmokeOrder==='smoke-sv')?`<div class="tl-safety-warn">⚠️ <b>${L('דורש תשומת-לב:','Needs attention:')}</b> ${L('הבשר שוהה בטמפ׳-סכנה בשלב העישון <u>לפני</u> הפסטור. שלב הסו-ויד המסומן "כולל פסטור" חייב להתבצע במלואו — לפי טבלת פסטור מוכרת לפי עובי. בספק — עבור לסדר סו-ויד←עישון.','The meat sits in the danger zone during the smoke stage <u>before</u> pasteurization. The sous-vide stage marked "incl. pasteurization" must be carried out in full — per a recognized pasteurization table by thickness. When in doubt — switch to the sous-vide→smoke order.')}</div>`:'';
```

Replace app.js **7479–7481** (the `[data-tlorder]` change handler):

```js
    list.querySelectorAll('[data-tlpath]').forEach(sel=>sel.addEventListener('change',()=>{
      // CP2 (spec §3 item 5): a plan-level change overrides FOR THAT OCCURRENCE only — it writes
      // mk-tlstate-<evScope> and never mk-item-path (the per-recipe default lives on the card, O-1).
      const all=tlState(); const k=sel.dataset.tlpath;
      const meta=resolveItem(k); if(!meta) return;      // resolveItem is unconditional everywhere else
                                                        // (app.js 3617); the null-check is for an unknown key
      const p=tlPathChoices(meta).find(function(x){ return x.id===sel.value; });
      if(!p || p.cited===false) return;                 // an uncited path is never selectable (options are disabled too)
      tlApplyPath(all, k, p); tlSetState(all); buildList();
    }));
```

- [ ] **Step 6: D7 — migrate every spec that drives this control, by name.**

The option VALUES changed from the two order literals to path ids, and the attribute from `data-tlorder` to `data-tlpath`. Three spec files select through it; each gets one local helper and its call sites re-pointed. **No assertion is weakened or deleted** — each still selects the same reverse/forward path and asserts the same rendered output.

The two documents that also mention `data-tlorder` — `docs/analysis/sweep/W1-G-workflows.md:296` and `docs/analysis/sweep/VERIFY-W1-G-workflows.md:83` — are **dated analysis snapshots of the pre-CP2 code and are deliberately NOT edited**; rewriting a dated audit would falsify the record. CP2's own state is documented by this plan.

Add this helper near the top of each of the three files (below the imports):

```ts
// CP2 Task 8 migration (D7): the timeline's order <select> is now a PATH selector — `select[data-tlpath]`
// whose option VALUES are itemPaths ids. Each option still carries the sv/smoke order it resolves to in
// data-tlpathorder, so this picks exactly the path the old selectOption('<order>') picked.
const pickOrder = async (panel: any, order: 'sv-smoke' | 'smoke-sv') => {
  const sel = panel.locator('select[data-tlpath]').first();
  const value = await sel.locator(`option[data-tlpathorder="${order}"]`).first().getAttribute('value');
  if (!value) throw new Error(`no path option resolves to order "${order}"`);
  await sel.selectOption(value);
};
```

`tests/bug1-smoke-labels.spec.ts` — replace the locator lines **35, 68, 150, 177** and the select lines **37, 70, 152, 161, 179**:

```bash
# each pair `const orderSel = panel.locator('select[data-tlorder]').first(); await expect(orderSel).toBeVisible();`
# becomes a visibility check on the new control, and each selectOption becomes pickOrder(panel, …).
python - <<'PY'
import io,re
for f in ['tests/bug1-smoke-labels.spec.ts','tests/bug3-order-finish.spec.ts','tests/order-effect.spec.ts']:
    s=io.open(f,encoding='utf-8').read()
    s=s.replace("const orderSel = panel.locator('select[data-tlorder]').first();",
                "const orderSel = panel.locator('select[data-tlpath]').first();")
    s=re.sub(r"await orderSel\.selectOption\('(sv-smoke|smoke-sv)'\);",
             r"await pickOrder(panel, '\1');", s)
    io.open(f,'w',encoding='utf-8').write(s)
print('migrated')
PY
grep -rn "data-tlorder\|orderSel.selectOption" tests/    # must return NOTHING
```

Then insert the `pickOrder` helper into each of the three files (after the `import` line) and confirm:

```bash
grep -c "pickOrder" tests/bug1-smoke-labels.spec.ts tests/bug3-order-finish.spec.ts tests/order-effect.spec.ts
```
Expected: `bug1` 6 (1 definition + 5 uses), `bug3` 3, `order-effect` 2.

- [ ] **Step 7: Add the two new keys' translations, regenerate, verify Guard A.**

`סדר בישול` and `סדר בישול (סו-ויד/עישון):` remain keyed in all six languages (they are still used by other prose) — they are simply no longer read by these two render sites; nothing is removed from the dict.

| key | en | ru | de | es | fr | it |
|---|---|---|---|---|---|---|
| `מסלול בישול` | Cooking path | Способ приготовления | Garweg | Ruta de cocción | Parcours de cuisson | Percorso di cottura |
| `מסלול בישול לכל פריט:` | Cooking path per item: | Способ приготовления для каждого блюда: | Garweg je Gericht: | Ruta de cocción por plato: | Parcours de cuisson par plat : | Percorso di cottura per piatto: |

`בקרוב — מקור בבדיקה` is reused from Task 2 — not re-added.

```bash
node scripts/i18n-extract.mjs app.js lang/_extracted.json --allow-collisions
I18N_REGEN_SIG=1 python build.py
python build.py
```
Expected on the second run: `[i18n:Guard-A] OK — <N> KNOWN keys + <M> names covered in all 6 active langs`, `[i18n:Guard-B] OK`, no Guard D drift line, exit 0.

- [ ] **Step 8: Run and see GREEN — this spec, then the three migrated specs, then the neighbours.**

```bash
npx playwright test tests/cp2-plan-selector.spec.ts --reporter=list
```
Expected: `8 passed`, exit 0. Paste it.

```bash
npx playwright test tests/bug1-smoke-labels.spec.ts tests/bug3-order-finish.spec.ts tests/order-effect.spec.ts --reporter=list
```
Expected: all pass, exit 0. These three are the D7 witness: the migrated calls still drive the same reverse order and still assert `עישון 75°` / `עישון קר 60°` / the danger-zone warning — **the regression guards survived the value change intact.**

```bash
npx playwright test tests/cp1-surfaces.spec.ts tests/cp1-card-unified.spec.ts tests/cp2-default-path.spec.ts \
  tests/cp2-path-panel.spec.ts tests/cp2-path-select.spec.ts tests/cp2-steps-path.spec.ts \
  tests/cp2-rawtable-path.spec.ts tests/timeline-enhancements.spec.ts tests/e3-validity.spec.ts \
  tests/occupancy-view.spec.ts --reporter=list
```
Expected: all pass, exit 0.

- [ ] **Step 9: Look at the screenshots (DoD-8) — do not tick this from the files existing.**

```bash
ls -l mockups/cp2-plan-selector-card-390x844.png mockups/cp2-plan-selector-after-switch-390x844.png mockups/cp2-plan-selector-strip-390x844.png
```
Confirm at 390×844: the item card's row reads `מסלול בישול:` with a select whose open list shows every path (the two placeholders greyed with the `בקרוב` suffix); after the switch the stage rows read 75° and the ⚠️ danger-zone warning is present; the plan strip shows the same control under `🔄 מסלול בישול לכל פריט:`.

**Safety / fidelity witness (DoD-10):** no `bcheck` stage, `safe`, `svt`, temp or duration is computed or mutated. `buildList` still derives every stage through the unchanged `itemStages(m, st.method, st.ready, st.svSmokeOrder)` call (app.js 7053) — this task only changes *which cited path the occurrence names*. The reverse-order eligibility gate is untouched and un-loosened: `comboHasSvSmoke` still decides inside `itemPaths` whether the reverse entry exists (cited `order_smokesv` with `sv.pasteurize===true`), and the danger-zone warning keeps its own explicit `comboHasSvSmoke` gate — in fact **tightened**, since a stale stored `svSmokeOrder:'smoke-sv'` on a non-sv+smoke method can no longer raise a warning that does not apply. Uncited placeholders render `disabled` **and** are rejected again in the handler. Witness: test **(e)** (an item without cited reverse data is never offered one), test **(b)** (the warning appears exactly when the reverse path is chosen), test **(d)** (the recipe default is never written).

- [ ] **Step 10: Commit.**

```bash
git add app.js lang/en.json lang/ru.json lang/de.json lang/es.json lang/fr.json lang/it.json \
  lang/_extracted.json lang/_callsite-sig.json tests/cp2-plan-selector.spec.ts \
  tests/bug1-smoke-labels.spec.ts tests/bug3-order-finish.spec.ts tests/order-effect.spec.ts \
  mockups/cp2-plan-selector-card-390x844.png mockups/cp2-plan-selector-after-switch-390x844.png \
  mockups/cp2-plan-selector-strip-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): the plan/event selector generalizes from sv-smoke ORDERS to the full itemPaths set

spec 2026-07-25 §3 item 5: "the timeline/event path selector offers the same itemPaths set; a
plan-level change overrides FOR THAT occurrence only and always resolves through the item's cited
entries"; §4: "unchanged, selector generalizes to paths".

- tlPathChoices / tlPathOrderAttr / tlPathIdFor / tlPathEligible / tlApplyPath / tlPathSelectHTML.
- <select data-tlorder> (two SV_SMOKE_ORDERS literals) → <select data-tlpath> over EVERY itemPaths
  entry; placeholders are listed but disabled, and rejected again in the handler.
- the occurrence's SCHEDULE really changes: choosing smoke-only drops the sous-vide stage row that
  an order-only select could never express (asserted on rendered .tl-stage rows).
- the override writes mk-tlstate-<evScope> ONLY — mk-item-path is never touched (asserted).
- SAFETY: comboHasSvSmoke does not move — it still gates whether the reverse ENTRY exists inside
  itemPaths (cited order_smokesv, pasteurize:true), and it still gates the danger-zone warning,
  now also excluding a stale order left on a non-sv+smoke method. Only the selector's visibility
  rule generalized (≥2 cited paths).
- D7 migration: option values are path ids, so bug1-smoke-labels / bug3-order-finish / order-effect
  select through a pickOrder(panel, order) helper on the options' data-tlpathorder hook. Every
  assertion in those three regression specs is unchanged and still green.

Safety: no temp/hour/safe/svt/bcheck computed or mutated; itemStages' arguments unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 9 — The per-recipe default REACHES the occurrence: an unpinned plan/event item inherits the card's default path (§3.5 / O-1)

**Spec line:** *"**Plan/event level (the owner's #4):** the timeline/event path selector offers the same `itemPaths` set; **a plan-level change overrides FOR THAT occurrence only** and always resolves through the item's cited entries — semantics never restated (O-1 law)."* (spec §3, item 5) — and the owner's binding anchor *"At the plan level allow to change the cooking path, but **the only single source of truth is the item and recipes behind the card**"* (spec §1.4 / O-1).

**Why this task exists.** Task 8 delivers the *override* direction and asserts the two stores stay separate. The *inheritance* direction is the other half of the same sentence: an "override for that occurrence only" presupposes something to override. Concretely, after Tasks 1–8 the sv/smoke **ORDER** never reaches the plan — `buildList` does `if(!st.svSmokeOrder) st.svSmokeOrder=svSmokeOrderDefault();` (app.js **7047**) and `combinedEventsRows` does `order=st.svSmokeOrder||svSmokeOrderDefault()` (app.js **9805**), both of which resolve to `'sv-smoke'` no matter what path the card names as its default. So a user who sets the brisket card's default to the cited **reverse** path opens the timeline and sees the **forward** 120° schedule: the card contradicting the plan, which is the exact failure this whole spec was written to kill. Without this task the omission is an unraised §4 waiver.

The METHOD half is already carried: `itemProfile`'s `methods[0]` is `comboMethodEntry(c, activeMethods(c,key), …)` (app.js **3801–3803**), and Task 5's `setCardCombo` writes the persistent method store, so `profile.methods[0].key` follows the card's combo. This task makes that inheritance **explicit** (resolved from `itemDefaultPath`, not incidentally through a second store) and closes the order gap.

**Files:**
- Modify `app.js` — insert `occPathFor(meta, st, profile)` immediately **after** Task 8's plan-level helper block (anchor by content: `grep -n "function tlPathSelectHTML" app.js`).
- Modify `app.js` **7046–7047** — `buildList`'s two default-fill lines, replaced by one `occPathFor` call.
- Modify `app.js` **9805** — `combinedEventsRows`' `method`/`order` resolution, replaced by one `occPathFor` call.
- Create `tests/cp2-plan-inherits-default.spec.ts`.
- **No `lang/*.json`, no `app.css`, no `_callsite-sig` regen:** this task adds, removes and edits **zero** `L()` call sites and zero user-facing strings.

**Interfaces:**
- **Consumes:** `itemDefaultPath(meta)` (**Task 1**), `svSmokeOrderDefault()` (3840), `itemProfile(meta)` (3793), `st.pathPinned` (**Task 8**'s `tlApplyPath`), `itemStages` via the unchanged `buildList` (7053) and `combinedEventsRows` (9806) calls.
- **Produces:**
  - `occOrderPinned(st)` → `boolean` — does the occurrence own its sv/smoke order? `st.pathPinned` alone on CP2-stamped state; on pre-CP2 state, also a stored non-default order (which could only have come from the retired `[data-tlorder]` select).
  - `occPathFor(meta, st, profile)` → `{method, order}` — the (methodKey, order) an occurrence runs: its own pinned choice when it has one, otherwise the item's per-recipe default path, otherwise today's rule. **Pure** — it reads state and returns a pair; it writes nothing and computes no temp, hour or duration.
  - `st._cp2` (occurrence-state stamp, written by `buildList`) — marks state whose order-pin has been normalized to `pathPinned`, so an *inherited* order can never later be mistaken for an explicit one.

---

- [ ] **Step 1: Verify the two resolution sites and the pin flag before touching anything.**

```bash
cd C:/Users/dudib/source/repos/matconetesh
grep -n "if(!st.methodPinned || !st.method) st.method=profile.methods\[0\].key;" app.js
grep -n "if(!st.svSmokeOrder) st.svSmokeOrder=svSmokeOrderDefault();" app.js
grep -n "const method=st.method||profile.methods\[0\].key" app.js
grep -n "st.pathPinned=true" app.js                  # Task 8 must already write it
grep -n "function itemDefaultPath\|function svSmokeOrderDefault\|function tlPathSelectHTML" app.js
```

Expected (pre-CP2 numbers; Tasks 1–8 shifted everything below `openCut` — anchor by content): `buildList`'s pair at **7046/7047**, `combinedEventsRows`' resolution at **9805**, `svSmokeOrderDefault` at **3840**, `itemDefaultPath` from Task 1, and **exactly one** `st.pathPinned=true` (inside Task 8's `tlApplyPath`). If `pathPinned` is missing, stop — Task 8 is incomplete and this task's override branch has nothing to read.

```
mcp__serena__find_symbol             name_path="buildList"           relative_path="app.js" include_body=true
mcp__serena__find_symbol             name_path="combinedEventsRows"  relative_path="app.js" include_body=true
mcp__serena__find_referencing_symbols name_path="itemDefaultPath"    relative_path="app.js"
```

`itemDefaultPath`'s referencing symbols before this task must be `cardPathSel` (Task 4) only. That single-caller fact is the blast-radius budget for Step 4 and must be re-confirmed here, not remembered.

- [ ] **Step 2: Write the failing test — set the default on the CARD with real clicks, then read the PLAN.**

Create `tests/cp2-plan-inherits-default.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 9 (spec 2026-07-25 §3 item 5: "a plan-level change overrides FOR THAT occurrence only";
// §1.4 / O-1: "the only single source of truth is the item and recipes behind the card").
//
// The INHERITANCE direction. Task 8 proved the override does not leak upward (mk-item-path is never
// written from the plan). This proves the default flows downward: an occurrence with no plan-level
// choice of its own runs the path the CARD names — method AND order — and an occurrence that DOES have
// one keeps it. The default is always set through the real card panel, never by seeding mk-item-path,
// because "the card is where the default lives" is the claim under test.

const boot = async (page: any, kv: Record<string, string> = {}) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(
    `typeof openCut==='function' && typeof openTimeline==='function' && typeof occPathFor==='function' && typeof cookingPathsPanel==='function'`);
};

const openBrisketCard = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').filter({ hasText: 'בריסקט' }).first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel #cpList', { timeout: 10000 });
};
const expand = async (page: any) => {
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
};

// pick the card's default through the REAL panel — the affordance the owner approved
const setCardDefault = async (page: any, selector: string) => {
  await openBrisketCard(page);
  await expand(page);
  const row = page.locator(selector);
  await expect(row, `the panel must offer ${selector} for this test to have teeth`).toHaveCount(1);
  const id = await row.getAttribute('data-id');
  await row.click();
  await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='${id}'`);
  await page.click('#panel .x');
  await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);
  return id as string;
};

// the plan, seeded through the shipped timeline idiom (SETUP only — tests/bug1-smoke-labels.spec.ts:31)
const openPlan = async (page: any, view: 'items' | 'plan' = 'items') => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00'); store.set('mk-tlview',${JSON.stringify(view)}); openTimeline();
  })()`);
  await page.waitForSelector('#panel .tlcard', { timeout: 15000 });
};
const expandFirstCard = async (page: any) => {
  const card = page.locator('#panel .tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });
};
const stageText = async (page: any) => (await page.locator('#panel .tl-stage').allInnerTexts()).join('\n');

// ── (a) THE HOLE: the card's reverse default must reach the occurrence's rendered stage rows ────────
test('(a) a reverse-order card default re-renders the timeline occurrence at the cited 75°, not 120°', async ({ page }) => {
  await boot(page);
  await setCardDefault(page, '#cpListBody .cp-row[data-id$=":rev"]');

  await openPlan(page);
  await expandFirstCard(page);
  const txt = await stageText(page);
  expect(txt, `stage rows were:\n${txt}`).toContain('75°');
  expect(txt, 'the forward finish must not survive the card\'s reverse default').not.toContain('120°');
  // SAFETY (spec §5): the reverse order carries the danger-zone advisory, and it must travel with it
  await expect(page.locator('#panel .tl-safety-warn').first()).toBeVisible();
  expect(await page.locator('#panel .tl-safety-warn').first().innerText()).toContain('טמפ׳-סכנה');
});

// ── (b) the OVERRIDE still wins: a plan-level choice is not overwritten by the card default ────────
test('(b) §3.5 — an occurrence pinned to the forward path keeps it after the card default moves', async ({ page }) => {
  await boot(page);
  await openPlan(page);
  // pin this occurrence to the FORWARD path through the real selector (Task 8's control). Go via the
  // reverse option first: selecting the value the control already shows is not a reliable change event,
  // and the pin must come from a real interaction, not from a same-value re-select.
  const sel = () => page.locator('#panel select[data-tlpath]').first();
  const rev = await sel().locator('option[data-tlpathorder="smoke-sv"]').first().getAttribute('value');
  const fwd = await sel().locator('option[data-tlpathorder="sv-smoke"]').first().getAttribute('value');
  expect(rev, 'the reverse path must be offered').toBeTruthy();
  expect(fwd, 'the forward path must be offered').toBeTruthy();
  await sel().selectOption(rev as string);
  await page.waitForFunction(`(tlState()['cut-1']||{}).svSmokeOrder==='smoke-sv'`);
  await sel().selectOption(fwd as string);
  await page.waitForFunction(`(function(){ const s=tlState()['cut-1']||{}; return s.pathPinned===true && s.svSmokeOrder==='sv-smoke'; })()`);

  // now move the CARD's default to the reverse path
  await page.evaluate(`closePanel()`);
  await setCardDefault(page, '#cpListBody .cp-row[data-id$=":rev"]');

  await openPlan(page);
  await expandFirstCard(page);
  const txt = await stageText(page);
  expect(txt, 'the occurrence keeps its own pinned forward path').toContain('120°');
  expect(txt).not.toContain('75°');
  expect(await page.locator('#panel .tl-safety-warn').count(), 'and no reverse-order warning applies').toBe(0);
});

// ── (c) the EVENTS screen inherits it too (§3.4 "Events combined screen") ──────────────────────────
test('(c) the combined events screen shows the card default\'s own total duration', async ({ page }) => {
  await boot(page);
  // the two paths' totals, read LIVE off their own cited stages (setup only — never a hardcoded number)
  const want = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    const sum=function(st){ return st.reduce(function(a,s){return a+(s.hours||0);},0); };
    const rev=itemPaths(m).find(function(p){return p.order==='smoke-sv';});
    return { fwd: sum(itemStages(m, rev.methodKey, true, undefined)),
             rev: sum(itemStages(m, rev.methodKey, true, 'smoke-sv')) };
  })()`) as { fwd: number; rev: number };
  expect(want.rev, 'the two paths must really differ in total hours for this test to have teeth').not.toBe(want.fwd);

  await page.evaluate(`(function(){ store.set('mk-events',[{id:'ev-A',name:'ארוחה',serve:'19:00',menu:{keys:['cut-1'],guests:8},updated:Date.now()}]); })()`);
  await setCardDefault(page, '#cpListBody .cp-row[data-id$=":rev"]');

  await page.click('[data-cnav="events"]');
  await page.waitForSelector('#cEvBody .cet-hero .cet-row');
  const dur = await page.locator('#cEvBody .cet-hero .cet-row .cet-dur').first().innerText();
  expect(dur, `the hero duration must be the REVERSE path's own total; got "${dur}"`).toContain(want.rev.toFixed(1));
  expect(dur).not.toContain(want.fwd.toFixed(1));
});

// ── (d) INVARIANCE: with nothing stored, the occurrence state is byte-identical to today ───────────
test('(d) invariance — no per-recipe default: the occurrence resolves exactly as before CP2', async ({ page }) => {
  await boot(page);
  await openPlan(page);
  await expandFirstCard(page);
  expect(await stageText(page), 'the untouched default is still the forward cited finish').toContain('120°');
  const st = await page.evaluate(`(function(){ const s=tlState()['cut-1']||{};
    return { m:s.method, o:s.svSmokeOrder, want:itemProfile(resolveItem('cut-1')).methods[0].key, def:svSmokeOrderDefault() }; })()`) as any;
  expect(st.m, 'method = profile.methods[0].key, unchanged').toBe(st.want);
  expect(st.o, 'order = svSmokeOrderDefault(), unchanged').toBe(st.def);
  expect(await page.locator('#panel .tl-safety-warn').count()).toBe(0);
});

// ── (e) SAFETY: a card default with no sv+smoke combo leaves NO stale reverse order behind ────────
test('(e) selecting the smoke-only path on the card leaves the occurrence with no reverse order', async ({ page }) => {
  await boot(page);
  await setCardDefault(page, '#cpListBody .cp-row[data-id$=":rev"]');   // first make it reverse…
  await openPlan(page);                                                 // …and let the plan record it
  await page.waitForFunction(`(tlState()['cut-1']||{}).svSmokeOrder==='smoke-sv'`);
  await page.evaluate(`closePanel()`);

  await setCardDefault(page, '#cpListBody .cp-row[data-id="c:smoke"]'); // …then move to smoke-only
  await openPlan(page);
  await expandFirstCard(page);
  const txt = await stageText(page);
  expect(txt, 'a smoke-only path has no bath leg').not.toContain('סו-ויד');
  expect(txt).toContain('עישון');
  expect(await page.evaluate(`(tlState()['cut-1']||{}).svSmokeOrder`),
    'an order is meaningless without both legs — it must reset, never linger').toBe('sv-smoke');
  expect(await page.locator('#panel .tl-safety-warn').count(),
    'and a stale reverse order must not raise a danger-zone warning that does not apply').toBe(0);
});

// ── (f) MIGRATION: a PRE-CP2 occurrence order (no pathPinned, no _cp2 stamp) is never reset ────────
test('(f) a pre-CP2 stored order survives the first buildList and is not overwritten by the card default', async ({ page }) => {
  await boot(page);
  // legacy state exactly as the retired [data-tlorder] handler wrote it: an order, no pin, no stamp.
  // Written through the app's OWN key resolver (tlStateKey) — the scope depends on menuCtx, so a
  // hardcoded 'mk-tlstate-cook' would silently seed a store nothing reads.
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    store.set(tlStateKey(), { 'cut-1': { ready:true, svSmokeOrder:'smoke-sv' } });
    openTimeline();
  })()`);
  await page.waitForSelector('#panel .tlcard', { timeout: 15000 });
  await expandFirstCard(page);
  expect(await stageText(page), 'the user\'s existing plan-level order still governs').toContain('75°');
  const st = await page.evaluate(`tlState()['cut-1']`) as any;
  expect(st.svSmokeOrder, 'unchanged').toBe('smoke-sv');
  expect(st.pathPinned, 'and it has been normalized to the flag, once').toBe(true);
  expect(st._cp2, 'the stamp retires the legacy heuristic for this occurrence').toBe(1);
});

// ── DoD-8 · visual evidence at 390×844 ────────────────────────────────────────────────────────────
test('DoD-8 — screenshot at 390×844: the timeline occurrence running the card\'s reverse default', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await setCardDefault(page, '#cpListBody .cp-row[data-id$=":rev"]');
  await openPlan(page);
  await expandFirstCard(page);
  await page.locator('#panel .tlcard').first().screenshot({ path: 'mockups/cp2-plan-inherits-reverse-390x844.png' });
});
```

- [ ] **Step 3: Run it and WITNESS RED for the intended reason (DoD-2).**

```bash
npx playwright test tests/cp2-plan-inherits-default.spec.ts --reporter=list
```

Expected: **every** test fails in `boot` at the `waitForFunction` — `TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` — because `occPathFor` does not exist. Paste the output.

Then the RED that names the defect. Add `occPathFor` (Step 4's first block) but do **not** yet rewire either call site, and run:

```bash
npx playwright test tests/cp2-plan-inherits-default.spec.ts -g "^\(a\)|^\(c\)|^\(e\)" --reporter=list
```

> Anchored and escaped: bare `(a)` is a capture group matching the letter `a` and would run the whole file.

Expected failures, and the reason each proves:
- `(a)` → `expect(received).toContain(expected) — Expected substring: "75°" / Received string: "… עישון 120° / 1.5ש …"` — `buildList` resolved `st.svSmokeOrder` from `svSmokeOrderDefault()` and never asked the item what its default path is, so the plan runs the forward schedule while the card names the reverse one.
- `(c)` → the hero's `.cet-dur` still reads the FORWARD total — the events screen has the same gap.
- `(e)` → fails on `not.toContain('סו-ויד')` **or** on the lingering `'smoke-sv'`, depending on which half is reached first: with the order pinned to the reverse literal from the earlier step and the combo moved to smoke-only, the occurrence carries an order its own combo cannot express.

Paste all three.

- [ ] **Step 4: Implement — one resolver, two call sites.**

Insert immediately **after** Task 8's `tlPathSelectHTML`:

```js
// ── CP2 · the per-recipe default REACHES the occurrence (spec §3 item 5: "a plan-level change overrides
// FOR THAT occurrence only"; §1.4 / O-1: "the only single source of truth is the item and recipes behind
// the card"). An OVERRIDE presupposes something to override: with no plan-level choice of its own, an
// occurrence runs the item's per-recipe default path — METHOD and ORDER. Before this, the order half was
// hard-wired to svSmokeOrderDefault() at both resolution sites, so a card whose default was the cited
// REVERSE path was contradicted by its own plan.
//
// PURE: reads state, returns a pair. Writes nothing, and computes no temp, no hour, no duration and no
// safe value — itemStages still derives every stage from the (methodKey, order) it is handed, exactly as
// it always has. The reverse path can only BE the default when comboHasSvSmoke held inside itemPaths
// (cited order_smokesv with sv.pasteurize===true), so the safety gate is upstream of this and unmoved.
// `st._cp2` is the migration stamp, and it is what makes the ORDER pin unambiguous. Without it the
// legacy heuristic below would eat itself: buildList PERSISTS the resolved order into `st`, so an
// order that was merely INHERITED from the card would look, on the next pass, exactly like a
// pre-CP2 explicit choice ('smoke-sv' ≠ the default) and would freeze — the card could then never
// move that occurrence again. Stamped state trusts `pathPinned` alone; unstamped state (written
// before CP2 existed) gets the heuristic exactly once, in buildList.
function occOrderPinned(st){
  if(!st) return false;
  if(st._cp2) return !!st.pathPinned;
  // pre-CP2 state only: a non-default order can only have come from the retired [data-tlorder] select,
  // which never set methodPinned. A user's existing plan-level order is never silently reset.
  return !!(st.pathPinned || (st.svSmokeOrder && st.svSmokeOrder!==svSmokeOrderDefault()));
}
function occPathFor(meta, st, profile){
  const dp=(typeof itemDefaultPath==='function')?itemDefaultPath(meta):null;
  const mPinned=!!(st && st.methodPinned && st.method);
  const method=mPinned ? st.method
                       : ((dp&&dp.methodKey) || (profile&&profile.methods&&profile.methods[0]&&profile.methods[0].key));
  // An inherited order applies only when the default path is THIS method's: an order belongs to its own
  // combo and must never cross combos (the same rule effectiveSchedule enforces at the model level), so
  // a smoke-only default RESETS the order instead of leaving 'smoke-sv' on a combo that cannot express it.
  const inherited=(dp && dp.methodKey===method && dp.order) ? dp.order : null;
  const order=occOrderPinned(st) ? st.svSmokeOrder : (inherited || svSmokeOrderDefault());
  return { method:method, order:order };
}
```

Replace `buildList`'s two default-fill lines (**7046–7047**, located by content in Step 1) with:

```js
      // CP2 (spec §3 item 5): an UNPINNED occurrence inherits the item's per-recipe default path —
      // method AND order. A pinned occurrence keeps its own override; that is what "overrides FOR THAT
      // occurrence only" means. The `itemStages(m, st.method, st.ready, st.svSmokeOrder)` call below is
      // byte-unchanged — only which cited path it is asked for can differ.
      //
      // The stamp runs BEFORE the resolution and exactly once per occurrence: it converts a pre-CP2
      // explicit order into the `pathPinned` flag while that is still distinguishable, and from then on
      // `pathPinned` is the only pin signal anyone reads.
      if(!st._cp2){ if(st.svSmokeOrder && st.svSmokeOrder!==svSmokeOrderDefault()) st.pathPinned=true; st._cp2=1; }
      { const _op=occPathFor(m, st, profile); st.method=_op.method; st.svSmokeOrder=_op.order; }
```

Replace `combinedEventsRows`' resolution line (**9805**) with:

```js
        const _op=occPathFor(meta, st, profile);
        const method=_op.method, ready=(st.ready!==false), order=_op.order;
```

> **Disclosure (§10.8, noted not waived) — the one §3.4 surface this task does NOT change.** `eqmRequiresMethodKey` (app.js **1771**) derives the equipment-requires methodKey from `methodRules(c).def`, so EQM's requires/holds follow neither the card's combo nor its path — a divergence that predates CP2 and is marked *"(already)"* in the spec's §4 surfaces table. Changing it moves equipment **holds**, which is safety-adjacent E-programme territory with its own gates. **Raise it with the owner in conversation** as a CP2 finding for the E-programme; do not fold it in here and do not record it as done. Task 11's gate carries it as an explicit open item.

- [ ] **Step 5: Run and see GREEN — this spec, then every neighbour that reads occurrence state.**

```bash
npx playwright test tests/cp2-plan-inherits-default.spec.ts --reporter=list
```
Expected: `7 passed`, exit 0 — (a)–(f) plus DoD-8. Paste it.

```bash
npx playwright test tests/cp2-plan-selector.spec.ts tests/cp2-path-select.spec.ts tests/cp2-statline-seam.spec.ts \
  tests/cp2-steps-path.spec.ts tests/cp2-rawtable-path.spec.ts tests/cp2-default-path.spec.ts \
  tests/bug1-smoke-labels.spec.ts tests/bug3-order-finish.spec.ts tests/order-effect.spec.ts \
  tests/timeline-enhancements.spec.ts tests/wave2-combined.spec.ts tests/wave2-multievent.spec.ts \
  tests/waveE-multievent-pro.spec.ts tests/occupancy-multievent.spec.ts tests/p0-cross-event-warning.spec.ts \
  tests/scheduler-planschedule.spec.ts tests/e2-event-holds.spec.ts tests/e3-validity.spec.ts --reporter=list
```
Expected: all pass, exit 0. This list is not decoration: `combinedEventsRows` feeds occupancy, cross-event contention and the scheduler specs, and `buildList`'s `st` is what the equipment-hold specs read. Task 8's test (d) passing here is the proof the override direction still holds in both directions at once.

```bash
python build.py          # NO regen: this task adds/removes/edits zero L() call sites
git diff --stat lang/    # must be EMPTY
```
Expected: `[i18n:Guard-A] OK …`, no Guard D drift line, exit 0, and **no file under `lang/` in the diff**. If Guard D reports drift, stop and find which `L()` site moved.

- [ ] **Step 6: Look at the screenshot (DoD-8).**

```bash
ls -l mockups/cp2-plan-inherits-reverse-390x844.png
```
Confirm at 390×844: the expanded timeline card's stage rows read `עישון 75°` **before** `סו-ויד 68° (כולל פסטור)`, the ⚠️ danger-zone advisory is present above them, and the item's start clock is earlier than the forward path's by the difference in total hours — the plan running the path the card names.

**Safety / fidelity witness (DoD-10):** no `bcheck` stage, `safe`, `svt`, temp or duration is computed or mutated. `buildList` still derives stages through the byte-unchanged `itemStages(m, st.method, st.ready, st.svSmokeOrder)` call (app.js 7053) and `combinedEventsRows` through its own unchanged `itemStages(meta, method, ready, order)` — this task only changes *which cited path the occurrence names*. The reverse path is offered at all only because `comboHasSvSmoke` held inside `itemPaths` (cited `order_smokesv`, `sv.pasteurize===true`), so the eligibility gate is upstream and unmoved; and an order can no longer linger on a combo that cannot express it, which **tightens** the danger-zone warning rather than loosening it. Witness: test **(d)** (empty store → the occurrence's `method`/`svSmokeOrder` are byte-identical to today's rule), test **(e)** (no stale reverse order, no inapplicable warning), test **(a)** (the advisory travels with the order it belongs to), test **(f)** (a pre-CP2 plan-level order is never reset out from under the user).

- [ ] **Step 7: Commit.**

```bash
git add app.js tests/cp2-plan-inherits-default.spec.ts mockups/cp2-plan-inherits-reverse-390x844.png
git commit -m "$(cat <<'EOF'
feat(cp2): an unpinned plan/event occurrence inherits the card's per-recipe default path

spec 2026-07-25 §3 item 5: "a plan-level change overrides FOR THAT occurrence only and always
resolves through the item's cited entries"; §1.4 / O-1: "the only single source of truth is the
item and recipes behind the card".

Task 8 delivered the override direction. This is the other half of the same sentence: an override
presupposes something to override. The sv/smoke ORDER never reached the plan — buildList (7047) and
combinedEventsRows (9805) both resolved it from svSmokeOrderDefault(), so a card whose default was
the cited REVERSE path was contradicted by its own timeline and events screen.

- occPathFor(meta, st, profile) + occOrderPinned(st): the occurrence's (method, order) — its own
  pinned choice when it has one, otherwise the item's per-recipe default path, otherwise today's
  rule. Pure; writes nothing.
- st._cp2: a one-time stamp buildList writes BEFORE resolving. It converts a pre-CP2 explicit order
  (written by the retired [data-tlorder] select, which never pinned) into pathPinned while that is
  still distinguishable, and retires the heuristic afterwards. Without it the heuristic would eat
  itself: buildList persists the resolved order, so an INHERITED 'smoke-sv' would look like an
  explicit choice on the next pass and freeze — the card could never move that occurrence again.
- an inherited order applies only to ITS OWN combo, so a smoke-only default resets the order
  instead of leaving a reverse order on a combo that cannot express it — this TIGHTENS the
  danger-zone warning's applicability.
- empty store → the occurrence's method/svSmokeOrder are byte-identical to pre-CP2 (asserted).

Raised, not fixed here: eqmRequiresMethodKey (1771) still derives from methodRules(c).def, so the
equipment requires/holds follow neither the card's combo nor its path. Pre-CP2 divergence, marked
"(already)" in the spec's §4 table; moving holds is E-programme territory — owner decision pending.

Safety: no temp/hour/safe/svt/bcheck computed or mutated; itemStages' arguments unchanged at both
sites. comboHasSvSmoke still gates whether the reverse path exists, inside itemPaths.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 10 — The both-directions i18n leak gate for every CP2 surface (test-only), proven RED by a dict mutation

**Spec line:** *"**The card's path panel (the owner's #2):** the card lists ALL `itemPaths` entries with their cited schedules compact (per path: device icons, key temps/hours, the citation marker)"* (spec §3, item 3) — under **DoD-9**: *"Any user-facing string: rendered in Hebrew, no English leak, correct singular/plural on interpolated counts, correct domain term."*

**What this task is, and what it is NOT.** It is a consolidated both-directions leak gate over every CP2 surface, in every active language. It makes **no production change** — and that is a correction, recorded here so the reasoning is not lost:

> The earlier draft of this task added a `_mkLangRepaint`/`setLangRepaint` hook and a `pathLabel(p)` normalizer, justified by "switching language with a recipe open leaves the panel in Hebrew". **Both were traced through the real render path and both are unreachable.** Every language switcher in the app — `openLangMenu` (11438), `openAppearance` (8969), `openTools` (8565), the More panel (11408) — reaches `setLang` only via `wireLangRow`, and all four call `showPanel(html)` first, which does `p.innerHTML=html` (3309) and clears the repaint hooks (3308). The open card is therefore **destroyed before** `applyLang` ever runs, and the user's next card render is a fresh `L()` pass in the new language with or without a hook. There is no control anywhere that changes language while a recipe card stays mounted, so the defect the hook claimed to fix does not exist, the hook would have had no production consumer (DoD-5, `no-inert-shipment`), and its "RED witness" would have passed on first run (DoD-2). `pathLabel` is likewise a no-op: `comboMethodEntry`'s label (3782) is `L()`-built at call time, the reverse and placeholder labels are `L()` literals, and `t()` on a dict-keyed Hebrew string returns the same string. Both are dropped. *(`_mkMethodRepaint` has the same unreachability, and it is pre-existing — Chesterton's Fence: not this plan's to remove.)*

Because there is no production change, this task's tests are **invariance guards**, and Step 3 proves they have teeth the only honest way: a deliberate runtime dict mutation that makes them fail for exactly the reason they exist, witnessed and then removed.

**Files:**
- Create `tests/cp2-i18n-panel-leak.spec.ts`.
- Modify **nothing** in `app.js`, `app.css` or `lang/`. No `_extracted.json` / `_callsite-sig.json` regen: zero `L()` call sites move.

**Interfaces:**
- **Consumes:** `getDict()` (8681), `I18N_DICTS` (the per-language maps `getDict` indexes), `itemPaths(meta)` (Task 1), the rendered classes Tasks 2/3/7/8 produce (`.cp-row .crtitle`, `.crfig`, `.cite-ok`, `.cite-soon`, `#cpListCount`, `#cpListMain`, `#cardRawTable tr.rawpath`, `select[data-tlpath]`).
- **Produces:** no production symbol. One spec file.

---

- [ ] **Step 1: Read the reference spec and confirm the mechanism.**

Read `tests/i18n-equip-method-leak.spec.ts` end to end **before writing** — it is the shipped both-directions pattern this task follows: per language, derive `forbidden` (the English value) and `expected` (the dict value) **from the live dict**, enforce the forbidden set only where `dict[he] !== en` (the loanword clause), and assert the expected value positively.

```bash
cd C:/Users/dudib/source/repos/matconetesh
grep -n "function getDict\|function applyLang\|function tnode\|function wireLangRow\|function setLang" app.js
grep -n "function cpRowHTML\|function cpHeadMainHTML\|function cardRawTableHTML\|function tlPathSelectHTML" app.js
grep -rn "wireLangRow(" app.js               # every real language switcher — each preceded by showPanel
```

Expected: `wireLangRow` is called from exactly four sites (8565, 8969, 11408, 11438), each inside a function that called `showPanel` first — the trace that retired the repaint hook above. Confirm it rather than trusting this paragraph.

```
mcp__serena__find_symbol             name_path="applyLang"  relative_path="app.js" include_body=true
mcp__serena__find_referencing_symbols name_path="setLang"   relative_path="app.js"
```

Note the mechanism the assertions rely on: for a non-Hebrew language `applyLang` calls `tnode(document.body)`, which rewrites a text node **only when the node's whole trimmed text is an exact dict key**. Every composite node the CP2 panel builds (`🌊💨 ⚡ סו-ויד + עישון`, `68°/30ש → 120°/1.5ש`) is not a dict key — so a CP2 string that is localized at all is localized because it went through `L()` at render time, and this spec is what proves it did.

- [ ] **Step 2: Write the spec.**

Create `tests/cp2-i18n-panel-leak.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// CP2 · Task 10 — the BOTH-DIRECTIONS i18n leak GATE for every CP2 surface (spec 2026-07-25 §3 item 3,
// under DoD-9). Pattern taken from tests/i18n-equip-method-leak.spec.ts (the shipped both-directions
// gate): per language, derive from the LIVE dict what must NOT render (the English value) and what MUST
// render (the dict value), and enforce the "must not be English" direction ONLY where the dict value
// genuinely differs from English — the loanword clause (de/es/fr/it 'ש' → "h" IS English, legitimately;
// only ru differs, 'ч.').
//
// THIS SPEC ADDS NO BEHAVIOUR AND GUARDS NONE OF ITS OWN. It is an invariance gate: Guard A already
// forces a value for every CP2 key in every active language, so a correctly built panel is localized
// the moment it renders. The gate exists to FAIL LATER — the day a CP2 string is routed around the dict,
// interpolated into a composite that L() never sees, or added without a translation. Its teeth are
// proven by the deliberate dict mutation in the task's Step 3, not by a first-run failure.
//
// The Hebrew-glyph assertions are made PER CHROME ELEMENT, never over the panel's whole innerText.
// Citation refs are authored source names rendered exactly as stored and are deliberately never
// machine-translated (sources.py), so a blanket "no Hebrew glyph anywhere in #cpList" assertion would
// flag correct behaviour as a leak and the fix would be to weaken it. Same carve-out shape as
// tests/i18n-equip-method-leak.spec.ts uses for loanwords.

const LANGS = ['ru', 'de', 'es', 'fr', 'it'] as const;
const HEB = /[֐-׿]/;

// The Hebrew SOURCE keys the CP2 surfaces render. This literal list IS the contract (they are static
// L() literals in app.js, which is what the extractor registers and Guard A enforces); the test derives
// every expected/forbidden VALUE from the live dict, never from a hard-coded translation.
const CP2_KEYS = [
  'מסלולי בישול',            // panel aria-label (Task 3)
  'מסלולים',                 // the count pill, n>1 (Task 3)
  'ברירת מחדל',              // the default badge (Task 3)
  'מקור מצוטט',              // the ✓ citation marker (Task 2)
  'בקרוב — מקור בבדיקה',      // the CP3 placeholder marker (Task 2 / owner decision 3)
  'תנור בלבד',               // placeholder label (Task 1)
  'סו-ויד→תנור',             // placeholder label (Task 1)
  'עישון→סו-ויד',            // the reverse path label (Task 1 / owner decision 1)
  '(טור עישון בלבד)',         // the smoke-only citation qualifier (Task 2 / owner decision 2)
  'מסלול נבחר',              // the raw table's active-path row (Task 7)
  'מסלול בישול',             // the plan-level selector's label (Task 8)
  'ש',                       // the hours unit inside the LTR figure islands (Task 2)
];

const boot = async (page: any, lang: string) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
  await page.waitForFunction(`typeof openCut==='function' && typeof cookingPathsPanel==='function' && typeof getDict==='function'`);
};

// real click-through to the brisket card (the shipped convention, tests/cp1-card-unified.spec.ts)
const openBrisketCard = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel #cpList', { timeout: 10000 });
};
const expand = async (page: any) => {
  await page.click('#panel #cpListHead');
  await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
};

// The CHROME the app itself generates, element by element — every citation REF span excluded by
// construction, because a ref is authored text and not the dict's business.
const CHROME_SEL = [
  '#panel #cpListMain',
  '#panel #cpListCount',
  '#panel #cpListBody .cp-row .crtitle',
  '#panel #cpListBody .cp-row .crfig',
  '#panel #cpListBody .cp-row .crcite .cite-ok',
  '#panel #cpListBody .cp-row .crcite .cite-soon',
  '#panel #cardRawTable tr.rawpath td',
];
const chromeText = async (page: any): Promise<string> => {
  const parts: string[] = [];
  for (const sel of CHROME_SEL) parts.push(...await page.locator(sel).allInnerTexts());
  return parts.join('\n');
};

// per-language enforcement sets, computed from the LIVE dict (loanword-safe by construction)
const dictSets = (page: any) => page.evaluate(`(function(keys){
  const d=getDict()||{}, en=(typeof I18N_DICTS!=='undefined'? (I18N_DICTS['en']||{}) : {});
  const forbidden=[], expected=[];
  keys.forEach(function(k){
    const dv=d[k], ev=en[k];
    if(dv==null || ev==null) return;
    expected.push({key:k, val:dv});
    // enforce "not the English fallback" ONLY when the dict genuinely differs from English (loanword
    // clause) AND the English token is long enough to match as a word without colliding with unrelated
    // text (e.g. "h" occurs inside "thickness").
    if(dv!==ev && ev.length>=3) forbidden.push({key:k, val:ev});
  });
  return {forbidden, expected};
})(${JSON.stringify(CP2_KEYS)})`);

const wordAbsent = (hay: string, needle: string) =>
  !(new RegExp(`(?<![A-Za-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`).test(hay));

// ── (0) he BASELINE — the key list is real, i.e. these strings actually render ─────────────────────
test('(0) he baseline — every CP2 key in the contract list actually renders', async ({ page }) => {
  await boot(page, 'he');
  await openBrisketCard(page);
  await expand(page);
  const card = (await chromeText(page)) + '\n' + (await page.locator('#panel #cpList').innerText());
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00'); openTimeline();
  })()`);
  await page.waitForSelector('#panel select[data-tlpath]', { timeout: 15000 });
  const plan = await page.locator('#panel .tl-order').first().innerText();
  const txt = card + '\n' + plan;
  const missing = CP2_KEYS.filter(k => k !== 'ש' && !txt.includes(k));
  expect(missing, `the key list must describe what CP2 really renders; surfaces were:\n${txt}`).toEqual([]);
});

// ── (1) the CARD surfaces, per language: no raw Hebrew, no English fallback, dict values present ────
for (const lang of LANGS) {
  test(`(1) the card's path panel and raw-table path row are dict-localized in ${lang}`, async ({ page }) => {
    await boot(page, lang);
    const sets = await dictSets(page) as { forbidden: { key: string; val: string }[]; expected: { key: string; val: string }[] };
    expect(sets.expected.length, 'the live dict must hold CP2 values to enforce (else this test is vacuous)').toBeGreaterThan(5);

    await openBrisketCard(page);
    await expand(page);
    const chrome = await chromeText(page);
    const full = await page.locator('#panel #cpList').innerText();

    expect(chrome, `raw Hebrew leaked into the ${lang} panel chrome:\n${chrome}`).not.toMatch(HEB);
    for (const f of sets.forbidden)
      expect(wordAbsent(chrome, f.val), `English fallback "${f.val}" (key ${f.key}) rendered instead of the ${lang} dict value; chrome:\n${chrome}`).toBe(true);
    for (const e of sets.expected.filter(e => e.key !== 'מסלול בישול'))
      expect(full, `expected the ${lang} dict value "${e.val}" (key ${e.key}) to render; panel:\n${full}`).toContain(e.val);
  });
}

// ── (2) the PLAN-LEVEL selector (Task 8's surface), per language ───────────────────────────────────
for (const lang of LANGS) {
  test(`(2) the plan-level path selector is dict-localized in ${lang}`, async ({ page }) => {
    await boot(page, lang);
    await page.evaluate(`(function(){
      saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
      store.set('mk-tlserve','19:00'); openTimeline();
    })()`);
    await page.waitForSelector('#panel select[data-tlpath]', { timeout: 15000 });
    const row = await page.locator('#panel .tl-order').first().innerText();
    const opts = (await page.locator('#panel select[data-tlpath] option').allInnerTexts()).join('\n');
    const txt = row + '\n' + opts;

    expect(txt, `the plan-level path selector carries raw Hebrew in ${lang}:\n${txt}`).not.toMatch(HEB);
    const sets = await dictSets(page) as { forbidden: { key: string; val: string }[]; expected: { key: string; val: string }[] };
    for (const f of sets.forbidden)
      expect(wordAbsent(txt, f.val), `English fallback "${f.val}" (key ${f.key}) in the ${lang} selector:\n${txt}`).toBe(true);
    const label = sets.expected.find(e => e.key === 'מסלול בישול');
    if (label) expect(txt, `the ${lang} label must render`).toContain(label.val);
    const soon = sets.expected.find(e => e.key === 'בקרוב — מקור בבדיקה');
    if (soon) expect(opts, 'the disabled placeholder options carry the localized wording').toContain(soon.val);
  });
}

// ── DoD-8 · visual evidence at 390×844, in a non-Hebrew language ──────────────────────────────────
test('DoD-8 — screenshot at 390×844: the panel in ru', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, 'ru');
  await openBrisketCard(page);
  await expand(page);
  await page.locator('#panel').screenshot({ path: 'mockups/cp2-panel-ru-390x844.png' });
});
```

- [ ] **Step 3: WITNESS the gate RED — by mutating the dict, not by hoping it fails.**

First the honest baseline:

```bash
npx playwright test tests/cp2-i18n-panel-leak.spec.ts --reporter=list
```

Expected: `12 passed`, exit 0 — **on first run**. State that plainly. This task adds no production behaviour, so there is nothing for a first run to fail on; Guard A already forces a dict value for every CP2 key. A guard whose green run is its normal state must still be *observed failing for the intended reason* (DoD-2), so prove it:

Temporarily insert this line into test **(1)**, immediately after `await boot(page, lang);` — it simulates the exact defect the gate exists to catch (a CP2 string resolving to its English fallback in a localized page). It is written with `page.evaluate(fn, arg)` rather than a template string precisely so there is no nested-interpolation ambiguity to get wrong:

```ts
    // TEMPORARY RED PROBE — remove after witnessing. Forces one CP2 key to its English value.
    await page.evaluate(([lg, key]: string[]) => {
      (window as any).I18N_DICTS[lg][key] = ((window as any).I18N_DICTS['en'] || {})[key];
    }, [lang, 'מסלולים']);
```

```bash
npx playwright test tests/cp2-i18n-panel-leak.spec.ts -g "^\(1\)" --reporter=list
```

Expected RED × 5, for exactly the intended reason:
`expect(received).toBe(expected) — Expected: true / Received: false` with the message `English fallback "paths" (key מסלולים) rendered instead of the ru dict value; chrome: … 5 paths …` — the count pill printing the English fallback inside a localized panel.

Paste that output, then **delete the probe line** and re-run to confirm `12 passed` again. A probe left in the file is a broken test; `grep -n "TEMPORARY RED PROBE" tests/` must return nothing before Step 4.

Then the second direction, the one the per-element carve-out exists for — prove the assertion is not vacuous by pointing it at prose it must NOT flag:

```bash
# a Hebrew citation NOTE/REF is authored text and must never be treated as a leak
grep -n "לא לגריל ישיר" sources.py     # a real Hebrew-authored citation note in the catalog
```

Confirm from the run above that no failure mentions an authored citation string. If one does, the carve-out is wrong: the fix is to narrow `CHROME_SEL`, never to widen the loanword clause.

- [ ] **Step 4: Confirm nothing in the build moved.**

```bash
python build.py          # NO regen: this task adds/removes/edits zero L() call sites
git diff --stat lang/    # must be EMPTY
git status --short app.js app.css    # must be EMPTY — this task changes no production file
```
Expected: `[i18n:Guard-A] OK …`, `[i18n:Guard-B] OK`, `[i18n:Guard-C] OK`, no Guard D drift line, exit 0, an empty `lang/` diff, and **no modification to `app.js` or `app.css`**. If either production file is dirty, something was implemented here that belongs to another task's DoD — revert it and raise it.

Then the neighbours, because a new spec that seeds language state can perturb them:

```bash
npx playwright test tests/i18n-completeness.spec.ts tests/i18n-Lcontract.spec.ts tests/i18n-extractor.spec.ts \
  tests/i18n-equip-method-leak.spec.ts tests/i18n-entables.spec.ts tests/cp2-path-panel.spec.ts \
  tests/cp2-path-select.spec.ts tests/cp2-rawtable-path.spec.ts tests/cp2-plan-selector.spec.ts \
  tests/cp2-plan-inherits-default.spec.ts tests/cp1-card-unified.spec.ts tests/timeline-enhancements.spec.ts --reporter=list
```
Expected: all pass, exit 0.

- [ ] **Step 5: Look at the screenshot (DoD-8/DoD-9).**

```bash
ls -l mockups/cp2-panel-ru-390x844.png
```
Confirm at 390×844, in Russian: the collapsed header reads `Су-вид → копчение · По умолчанию.`, the count pill reads `5 способов`, each row's citation marker reads `✓ указанный источник · AmazingRibs — …` (the source name stays as authored — citation refs are never machine-translated), the placeholder rows read `Скоро — источник проверяется`, and the figure islands read `68°/30ч. → 120°/1.5ч.` with **no Hebrew glyph in any app-generated string**.

**Safety / fidelity witness (DoD-10):** this task changes no production file, renders nothing new and computes nothing — `git status --short app.js app.css` is empty by design (Step 4). The numeric-invariance witness is the screenshot above read against the Hebrew shots from Tasks 3/5: `68°/30 → 120°/1.5` are byte-identical across languages, and `build.py`'s Guard B independently asserts no translated value altered a number or its unit.

- [ ] **Step 6: Commit.**

```bash
git add tests/cp2-i18n-panel-leak.spec.ts mockups/cp2-panel-ru-390x844.png
git commit -m "$(cat <<'EOF'
test(cp2): both-directions i18n leak gate for every CP2 surface, in all 5 non-Hebrew languages

spec 2026-07-25 §3 item 3, under DoD-9 ("rendered in Hebrew, no English leak, correct domain term").

Per ru/de/es/fr/it: no raw Hebrew in any app-generated CP2 string, no English fallback where the
live dict holds a differing value (loanword-safe: de/es/fr/it 'ש' → "h" IS English and is never
flagged), and the positive assertion that the dict value renders — across the card's path panel,
the raw table's path row and the plan-level path selector.

Hebrew-absence is asserted PER CHROME ELEMENT, never over the panel's whole innerText: citation
refs are authored source names rendered as stored and deliberately never machine-translated, so a
blanket assertion would flag correct behaviour and get weakened.

Test-only, by correction. An earlier draft added a _mkLangRepaint hook for "switching language with
a recipe open", plus a pathLabel() normalizer. Both were traced through the real render path and
both are unreachable: all four language switchers (openLangMenu 11438, openAppearance 8969,
openTools 8565, More 11408) call showPanel first, which replaces the panel and clears the hooks, so
no control changes language while a card stays mounted — the hook would have had no production
consumer (DoD-5 / no-inert-shipment) and its "RED witness" passed on first run (DoD-2). pathLabel
is a no-op: every path label is already L()-built at render time. Both dropped.

The gate's teeth were witnessed by a temporary dict mutation forcing one CP2 key to its English
fallback (5 RED, for exactly the asserted reason), then removed.

Safety: no production file touched; numbers byte-identical across languages (screenshot + Guard B).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Task 11 — The CP2 phase gate: build guards, the plain full suite, bilingual real-UI evidence, every DoD line quoted, and an independent re-audit

**Spec line:** *"| **CP2** | the card path panel + default selection (O-1); plan-level path selector generalized | real-UI walks incl. path switch round-trips; **owner visual approval of the panel (mockup first, §10.9)** |"* (spec §8, phasing table) — with the per-phase gate from `docs/process/development-discipline.md` §3: *"every DoD line in the governing spec quoted and marked MET with evidence; any unmet line → phase incomplete, escalate; independent re-audit by a fresh agent **against the spec, not against the ledger**."*

**Files:**
- Create `scratch/cp2/gate/` — the evidence directory (build output, suite output, the audit matrix). **Not** a report `.md` in `docs/`: the gate's output is pasted into the conversation for the owner, per §10.6.
- Create `mockups/cp2-gate-*-390x844.png` — the bilingual real-UI evidence set produced in Step 4.
- Modify **nothing** in `app.js`, `app.css`, `lang/`, or `tests/`. **If this gate finds a defect, it is fixed under the DoD of the task that owns it** (write the failing test first, witness RED, fix, re-run) — never patched inside the gate.

**Interfaces:**
- **Consumes:** every artifact Tasks 1–10 produced — `tests/cp2-default-path.spec.ts`, `cp2-path-presentation.spec.ts`, `cp2-path-panel.spec.ts`, `cp2-statline-seam.spec.ts`, `cp2-path-select.spec.ts`, `cp2-steps-path.spec.ts`, `cp2-rawtable-path.spec.ts`, `cp2-plan-selector.spec.ts`, `cp2-plan-inherits-default.spec.ts`, `cp2-i18n-panel-leak.spec.ts`; the mockup approval record `mockups/cp2/variant-b.png` + `mockups/cp2/variant-b-list.html`.
- **Produces:** the pasted gate evidence — build-guard output, one plain full-suite run, the bilingual screenshot set, the quoted-DoD matrix, and a fresh-agent re-audit verdict. **No release.**

---

- [ ] **Step 1: Pre-flight — a clean tree, a fresh build, and no server on 8123 (§11a).**

Two suite runs must never race, and Playwright's managed server collides with a manual `serve.js` on 8123. Pause every CPU-heavy background agent for the duration of Steps 2–3.

```bash
cd C:/Users/dudib/source/repos/matconetesh
git status --short                     # the CP2 commits are in; nothing uncommitted may be in app.js/app.css/lang/tests
git log --oneline -14                  # Tasks 1-10's commits, in order
netstat -ano | grep ":8123" || echo "port 8123 free"
```
Expected: `git status --short` shows no modified `app.js`, `app.css`, `lang/*`, `tests/*` (untracked mockups are fine); port 8123 free. The log shows **ten** CP2 commits — Task 1, Task 3 (which also carries Task 2's staged helpers: they had no production reader until then, so they were deliberately never committed alone), Task 4 phase A, Task 4 phase B, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10. **If a manual server is up, stop it and re-verify the port refuses before continuing** — do not proceed with a port collision.

- [ ] **Step 2: The build guards — A, B and C — with output pasted (D11).**

```bash
mkdir -p scratch/cp2/gate
python build.py 2>&1 | tee scratch/cp2/gate/build.txt
echo "exit=$?"
grep -n "Guard-A\|Guard-B\|Guard-C\|Guard-D" scratch/cp2/gate/build.txt
```
Expected, pasted verbatim into the summary:
- `[i18n:Guard-A] OK — <N> KNOWN keys + <M> names covered in all 6 active langs`
- `[i18n:Guard-B] OK — numbers+units preserved across all active langs`
- `[i18n:Guard-C] OK — no prompt-echo/refusal garbage in any active-lang value`
- no Guard D drift line, exit code `0`.

Any violation is a **stop**: a Guard-A miss means a CP2 string is unlocalized; a Guard-B failure means a translation altered a number, which is a §5 safety failure and must be escalated, not worked around.

- [ ] **Step 3: The full suite — plain, once, nothing added (DoD-12 / D11).**

`npx playwright test` and nothing else. **No `--retries`, no `--workers`, no `-g`, no `--project`.** The config is authoritative (`retries: 0`, `workers: 20`, both certified). Let the run COMPLETE so Playwright tears down its own server; never kill it mid-flight.

```bash
npx playwright test 2>&1 | tee scratch/cp2/gate/suite.txt
echo "exit=$?"
tail -5 scratch/cp2/gate/suite.txt
```
Expected: `<N> passed (<t>)` and exit code `0`, where `<N>` equals the pre-CP2 baseline plus this programme's new tests:

| task | spec file | tests |
|---|---|---|
| 1 | `cp2-default-path` | 8 |
| 2 | `cp2-path-presentation` | 11 |
| 3 | `cp2-path-panel` | 14 |
| 4 | `cp2-statline-seam` | 7 |
| 5 | `cp2-path-select` | 7 |
| 6 | `cp2-steps-path` | 11 |
| 7 | `cp2-rawtable-path` | 12 |
| 8 | `cp2-plan-selector` | 8 |
| 9 | `cp2-plan-inherits-default` | 7 |
| 10 | `cp2-i18n-panel-leak` | 12 |
| | **total** | **97** |

Verify the arithmetic against the files rather than trusting the table — a stale count either raises a false alarm or masks a genuinely missing test:

```bash
for f in tests/cp2-*.spec.ts; do printf "%s " "$f"; grep -c "^\s*test(" "$f"; done
npx playwright test tests/cp2-default-path.spec.ts tests/cp2-path-presentation.spec.ts tests/cp2-path-panel.spec.ts \
  tests/cp2-statline-seam.spec.ts tests/cp2-path-select.spec.ts tests/cp2-steps-path.spec.ts \
  tests/cp2-rawtable-path.spec.ts tests/cp2-plan-selector.spec.ts tests/cp2-plan-inherits-default.spec.ts \
  tests/cp2-i18n-panel-leak.spec.ts --list | tail -3
```

(The `grep -c` count is a lower bound — the `for (const lang of …)` loops expand at runtime, which is why `--list` is the authority.) Record the baseline for the arithmetic:

```bash
git stash list >/dev/null; git log --oneline -1 --format=%H > scratch/cp2/gate/head.txt
grep -c "passed" scratch/cp2/gate/suite.txt
```

**Any failure — including an intermittent one — is a bug.** Do not re-run to see if it passes. Debug it via `superpowers:systematic-debugging`, fix it under the owning task's DoD (failing test first), and then re-run this step from scratch. Paste the final line of the run.

- [ ] **Step 4: Bilingual real-UI evidence at 390×844 — Hebrew AND one other language.**

A dedicated, throwaway walk that captures the CP2 surfaces as a user sees them. Write it to `scratch/cp2/gate/` so it never enters the suite count.

Create `scratch/cp2/gate/evidence.spec.ts`:

```ts
import { test, expect, seedApp } from '../../../tests/_fixtures';

// CP2 phase gate — the bilingual evidence set (§3 DoD-8 + DoD-9). NOT part of the suite: it lives under
// scratch/ and is run explicitly with --config, so it can never inflate the DoD-12 count.
const LANGS: [string, string][] = [['he', 'he'], ['ru', 'ru']];

const openBrisketCard = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  await page.waitForSelector('.card[data-kind="cut"]', { timeout: 15000 });
  const gc = page.locator('.card[data-kind="cut"]').first();
  await gc.scrollIntoViewIfNeeded();
  await gc.click();
  await page.waitForSelector('#panel #cpList', { timeout: 10000 });
};

for (const [lang, tag] of LANGS) {
  test(`CP2 gate evidence — ${tag}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
    await page.waitForFunction(`typeof openCut==='function' && typeof cookingPathsPanel==='function'`);

    // 1 · the card, panel collapsed — the default named in the header
    await openBrisketCard(page);
    await page.locator('#panel').screenshot({ path: `mockups/cp2-gate-card-${tag}-390x844.png` });

    // 2 · the panel expanded — ALL paths, cited rows + the CP3 placeholders
    await page.click('#panel #cpListHead');
    await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
    await page.locator('#panel').screenshot({ path: `mockups/cp2-gate-panel-${tag}-390x844.png` });

    // 3 · a real path switch round-trip — the stat line, steps and raw table follow it
    const revId = await page.locator('#cpListBody .cp-row[data-id$=":rev"]').getAttribute('data-id');
    await page.locator(`#cpListBody .cp-row[data-id="${revId}"]`).click();
    await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='${revId}'`);
    await page.locator('#panel').screenshot({ path: `mockups/cp2-gate-switched-${tag}-390x844.png` });
    await page.locator('#panel #cardRawTable').screenshot({ path: `mockups/cp2-gate-rawtable-${tag}-390x844.png` });

    // 4 · round-trip BACK to the default — the badge, the figures and the steps all return
    await page.click('#panel #cpListHead');
    await page.waitForFunction(`document.querySelector('#cpListBody').style.display==='block'`);
    const fwd = await page.locator('#cpListBody .cp-row').first().getAttribute('data-id');
    await page.locator(`#cpListBody .cp-row[data-id="${fwd}"]`).click();
    await page.waitForFunction(`document.querySelector('#panel .cp-row.on').getAttribute('data-id')==='${fwd}'`);
    await page.locator('#panel').screenshot({ path: `mockups/cp2-gate-roundtrip-${tag}-390x844.png` });

    // 5 · the plan-level selector on the same item
    await page.evaluate(`(function(){
      saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
      store.set('mk-tlserve','19:00'); openTimeline();
    })()`);
    await page.waitForSelector('#panel select[data-tlpath]', { timeout: 15000 });
    await page.locator('#panel .tlcard').first().screenshot({ path: `mockups/cp2-gate-plansel-${tag}-390x844.png` });
  });
}
```

Create `scratch/cp2/gate/evidence.config.ts`:

```ts
import base from '../../../playwright.config';
export default { ...base, testDir: '.', workers: 1, reporter: [['list']] as any };
```

```bash
npx playwright test --config scratch/cp2/gate/evidence.config.ts --reporter=list
ls -l mockups/cp2-gate-*-390x844.png
```
Expected: `2 passed`, exit 0, and **12** PNGs (6 per language).

**Now open every one of the 12 and actually look at them** — DoD-8 is not satisfied by a file existing. Confirm, per language:
- the collapsed header names the default path with its `ברירת מחדל` / `По умолчанию.` badge;
- the expanded list shows every path with icons, LTR figure islands and a citation marker, and exactly two dimmed placeholder rows with no radio;
- after the switch the badge and filled radio moved, the stat line reads 75°, and the raw table's `מסלול נבחר` / `Выбранный способ` row and its ember-edged active row both read the reverse;
- after the round-trip everything is back to 120° and the original badge position;
- the plan card's selector reads `מסלול בישול:` / `Способ приготовления:`;
- in `ru`: **no Hebrew glyph anywhere**, and the numbers are byte-identical to the Hebrew shots.

- [ ] **Step 5: Quote every governing DoD line and mark it MET with the evidence that proves it.**

Build the matrix in the conversation (per §3's per-phase gate: *"every DoD line in the governing spec quoted and marked MET with evidence"*). Quote the spec text verbatim — do not paraphrase, and do not mark a line MET from an agent's report; verify each yourself against the pasted output and the screenshots.

```bash
sed -n '/^## 3 · Rendering architecture/,/^## 6/p' docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md
sed -n '/^## 5 · Safety invariance/,/^## 6/p'      docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md
sed -n '/^## 8 · Phasing/,/^## 9/p'                docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md
sed -n '/^## 9 · Open items/,$p'                   docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md
sed -n '/^## §3 · The per-task DoD gate/,/^## §4/p' CLAUDE.md
```

The matrix has one row per line below, each with **MET / UNMET** and a named artifact (test name + spec file, or screenshot filename, or pasted output):

| # | Spec/DoD line (quoted) | Evidence |
|---|---|---|
| S-1 | §3.3 *"the card lists ALL `itemPaths` entries with their cited schedules compact (per path: device icons, key temps/hours, the citation marker)"* | `cp2-path-panel` "(the panel lists ALL itemPaths entries…)" asserts `domIds === modelIds`; `mockups/cp2-gate-panel-he-390x844.png` |
| S-2 | §3.3 *"the default is selected"* | `cp2-path-panel` "(the default path is pre-selected…)" — exactly one `.cp-row.on` + one badge |
| S-3 | §3.3 *"tapping another path re-renders the card's schedule from it"* | `cp2-path-panel` D5/D2/D4; `cp2-steps-path` (d); `cp2-rawtable-path` (b); gate screenshots 3 + 4 (the round-trip) |
| S-4 | §3.3 *"and (per O-1) sets the per-recipe default"* | `cp2-default-path` (b)/(b2); `cp2-path-panel` "O-1 — the selection persists" |
| S-5 | §3.2 *"The item card re-renders its cooking content from it: stat line, step list, raw-data table — all from stages"* | `cp2-statline-seam` (a)/(e); `cp2-steps-path` (a)/(b); `cp2-rawtable-path` (a)/(b) |
| S-6 | §3.5 *"the timeline/event path selector offers the same `itemPaths` set"* | `cp2-plan-selector` (a) — DOM option ids `===` the model's |
| S-7 | §3.5 *"a plan-level change overrides FOR THAT occurrence only"* | `cp2-plan-selector` (d) — `mk-tlstate` written, `mk-item-path` null, card default unmoved; `cp2-plan-inherits-default` (b) — a pinned occurrence keeps its path after the card default moves |
| S-7b | §3.5 *"…**and always resolves through the item's cited entries** — semantics never restated (O-1 law)"* + §1.4 *"the only single source of truth is the item and recipes behind the card"* | `cp2-plan-inherits-default` (a) the timeline occurrence runs the card's reverse default at the cited 75°, (c) the events hero's own total follows it, (d) empty store → byte-identical to pre-CP2, (e) no stale order on a combo that cannot express it. **Carries one RAISED item, not a MET one:** `eqmRequiresMethodKey` (app.js 1771) still derives from `methodRules(c).def`, so equipment requires/holds follow neither the card's combo nor its path — a pre-CP2 divergence the spec's §4 table marks *"(already)"*. Report it to the owner as an E-programme decision; **do not mark this row MET on the strength of the other four tests without stating it.** |
| S-8 | §4 *"Item card path info … full path panel (§3.3) + the sources box stays"* | `cp2-rawtable-path` (d) — two `.raw` blocks, both order-impact lines present after a switch |
| S-9 | §5 *"Every temp/hour any surface shows traces to a cited entry via `itemStages` — the refactor REMOVES formula surfaces, adds none. `bcheck`/`safe`/`svt` values untouched."* | `cp2-path-presentation` "prints ONLY numbers that appear in that path's cited stages" — including the two explicit assertions that the `bcheck` safety temp and its `/0ש` tail never render as a cooking figure; `cp2-steps-path` (b); `cp2-default-path` (a) byte-identical stages; `cp2-plan-inherits-default` (d); Guard B OK |
| S-10 | §5 *"The reverse-order eligibility gate (`comboHasSvSmoke`-class …) generalizes per path kind"* | `cp2-default-path` (d2); `cp2-plan-selector` (e); `cp2-plan-inherits-default` (e) |
| S-11 | §8 CP2 gate *"real-UI walks incl. path switch round-trips"* | every CP2 spec drives real clicks; the gate's round-trip screenshots 3 → 4 |
| S-12 | §8 CP2 gate *"owner visual approval of the panel (mockup first, §10.9)"* | variant B approved 2026-07-27 (`mockups/cp2/variant-b.png`); shipped panel matches — gate screenshots 1–2. **NEW UI NOT IN THE APPROVED MOCKUP, for explicit owner confirmation:** the raw table's leading `מסלול נבחר` row and its `.rawpath-on` ember-edged active row (Task 7) — evidence `mockups/cp2-gate-rawtable-he-390x844.png` and `mockups/cp2-gate-rawtable-ru-390x844.png`. Present them as an addition awaiting approval, not as covered by the variant-B approval. |
| S-13 | §9.1 *"Path panel density … compact vs expandable (owner picks visually)"* | RESOLVED — variant B (expandable list) |
| S-14 | §9.2 *"Grid card line — default path's figures only (proposed) vs a multi-path hint"* | RESOLVED — owner decision 4: **no** catalog-grid multi-path hint; scope stayed on the card panel. **State this to the owner explicitly as the resolution of an open item, not as a silent omission.** |
| O-1 | Owner copy decision 1 (2026-07-27): *the path-order arrow uses the EXISTING no-space literal from `sourcesBlock()`* | `cp2-i18n-panel-leak` (0) — the contract list includes `עישון→סו-ויד` and the test fails if it does not render; `cp2-rawtable-path` (b) asserts the leading row reads `עישון→סו-ויד`. Confirm by eye in gate screenshot 2 that **no** spaced `עישון ← סו-ויד` form appears in the panel (that form is the timeline `<select>`'s and `svOrderName` is untouched). |
| O-2 | Owner copy decision 2: *the smoke-only path cites the SAME AmazingRibs reference, worded "(טור עישון בלבד)"* | `cp2-path-presentation` "owner decision 2 — …" asserts `ref === '<order_svsmoke.ref> (טור עישון בלבד)'` **and** that a smoke+grill path never carries the qualifier |
| O-3 | Owner copy decision 3: *placeholder rows read "בקרוב — מקור בבדיקה" and tapping one **toasts**, never selects* | `cp2-path-panel` "D9 — tapping a 'soon' row (a row the wiring really bound)…" (asserts `__cpBound` before clicking, then the toast, then the unmoved selection) and "owner decision 3 — … exactly once" (the copy is not duplicated in the row); `cp2-path-select` (c) — nothing written; `cp2-plan-selector` (a) — the plan-level options are `disabled` and the handler re-rejects |
| O-4 | Owner copy decision 4: *NO catalog-grid multi-path hint* | Same as S-14 — nothing was built; `git show` the CP2 commits and confirm `cutCard`'s grid line is untouched. State it to the owner as a resolution. |
| O-5 | Owner copy decision 5: *the "חוסך מעשנת" stat DROPS when inapplicable (only for sv→smoke)* | `cp2-statline-seam` (c) an offal card (grill-only default) shows no `חוסך מעשנת`, (d) the reverse order drops it too, (e) the smoke-only path drops it, (b) it STAYS on the sv→smoke default, (f) nothing is gated away with no selection; `mockups/cp2-statline-offal-390x844.png` looked at |
| D-1…D-12 | The §3 twelve-point DoD, quoted line by line | per task: spec traced (S-rows), RED witnessed (each task's own RED step output — including Task 1 Step 5b's placeholder-filter witness, Task 4 Step 8's owner-decision-5 witness, Task 7 Step 3's pinned-`rev` witness and Task 10 Step 3's dict-mutation probe), GREEN, behavioural assertions on rendered DOM, consumers named, negative cases, regression red-green (Task 8's three migrated specs), screenshots looked at, Hebrew + 5-language check (`cp2-i18n-panel-leak`), safety invariance (S-9), no `waitForTimeout` (grep below), full suite (Step 3) |

```bash
grep -rn "waitForTimeout" tests/cp2-*.spec.ts scratch/cp2/gate/evidence.spec.ts    # DoD-11: must return NOTHING
grep -rn "test.skip\|test.fixme\|test.only" tests/cp2-*.spec.ts                     # must return NOTHING
grep -rn "TEMPORARY RED PROBE" tests/                                               # Task 10's probe removed
grep -rn "const rev=false" app.js                                                   # Task 7's pinned-rev witness reverted
```

Any row that cannot be marked MET with a named artifact makes the **phase incomplete** — escalate it to the owner in conversation with the spec text and the reason (§4 waiver gate). Do not soften it into a caveat, and do not defer it into CP3.

- [ ] **Step 6: Independent re-audit by a fresh agent — against the SPEC, not against this ledger.**

Dispatch one subagent that has not seen this plan. Give it the spec and the code; **do not give it the matrix above** — an auditor handed the answers audits the answers.

```
Task(subagent_type: general-purpose)
prompt:
  Repo C:/Users/dudib/source/repos/matconetesh, branch main.
  Read ONLY: docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md (§3.2, §3.3, §3.5,
  §4, §5, §8's CP2 row, §9.1, §9.2) and docs/process/development-discipline.md §3.
  Do NOT read any file under docs/superpowers/plans/ or scratch/cp2/ — you are auditing the SHIPPED CODE
  against the SPEC, not a plan's self-report.
  For each spec requirement in those sections, find the code in app.js/app.css that implements it (use
  serena find_symbol / find_referencing_symbols) and the test in tests/ that PROVES it, then judge:
    MET (name file+symbol+test name) / PARTIAL (say exactly what is missing) / UNMET / NOT-APPLICABLE.
  Verify independently, do not take a comment's word for it:
    - does the panel really list EVERY itemPaths entry, placeholders included?
    - does selecting a path really change the card's stat line, steps AND raw table (not just a badge)?
    - is the per-recipe default really separate from the per-occurrence override (two stores) — AND does
      an occurrence with no override of its own actually RUN the item's default path (both directions of
      "overrides for that occurrence only")?
    - does anything compute or mutate a temp, hour, safe, svt or bcheck value anywhere in the CP2 diff?
      (`git log --oneline` the cp2 commits, then `git show` each and read every changed hunk.) In
      particular: does any rendered figure trace to the citation printed beside it, and is the bcheck
      safety temperature ever rendered as a cooking setpoint?
    - is any test asserting only via page.evaluate on the model where the spec demands a rendered surface?
    - does any test in tests/cp2-*.spec.ts pass without ever being able to fail (an assertion whose
      expectation is derived from the same call the implementation makes, or a substring that is present
      in every state)?
  Return a table + a one-line verdict. Report what you actually verified and what you could not.
```

Paste the auditor's verdict verbatim. **Any PARTIAL or UNMET is a defect**: fix it under the owning task's DoD (failing test first, RED witnessed), then re-run Steps 2–5. Never argue an auditor's finding away in prose.

- [ ] **Step 7: Report to the owner and STOP.**

Give the §10.6 three-part summary — **DONE** (what CP2 delivered, with the pasted build + suite output and the 12 screenshots), **NEXT** (CP3: research batch 1 paths as data, whose zero-new-JS proof is that a cited entry replaces a CP2 placeholder row with no code change), **LEFT UNTIL THE GRAND FINAL** (CP3 + CP4 on this spec, and the E-programme items that ride the panel — O-2's consult button, O-5's fix list). Include, called out by name — each of these is a decision the owner must actually see, not a footnote:
- **§9.2 resolved by owner decision 4** — no catalog-grid multi-path hint;
- **all five owner copy decisions, each with the test that proves it** — matrix rows O-1…O-5;
- **NEW UI awaiting approval:** the raw table's leading `מסלול נבחר` row and its ember-edged active row (Task 7) are not in the approved variant-B mockup — show `mockups/cp2-gate-rawtable-he-390x844.png` and ask;
- **RAISED, not fixed:** `eqmRequiresMethodKey` (app.js 1771) derives the equipment requires/holds methodKey from `methodRules(c).def`, so EQM follows neither the card's combo nor its path. Pre-CP2 divergence, marked *"(already)"* in the spec's §4 table; moving equipment holds is safety-adjacent E-programme work. Owner decides whether it becomes an E-programme item;
- **DISCLOSED behaviour change** from Task 5: a method-toggle flick on a **catalog** card now persists (was per-visit), because the path default it records is persistent (O-1) and the two must have one lifetime;
- **the disclosed Russian plural limitation** from Task 3 (the dict is binary singular/plural, so 2–4 → *способа* cannot be expressed; `способов` is used for every n>1) — the owner decides whether a three-form mechanism is wanted;
- **retired from this plan, with the trace:** the language-switch repaint hook and `pathLabel` normalizer the first draft of Task 10 proposed — no control in the app changes language while a card stays mounted, so both were inert (Task 10's header carries the full render-path trace);
- the exact suite count and runtime.

**This gate authorizes nothing beyond itself.** It is not a release:

> CP2 is **not shipped** until the owner approves. A push is not a release (§10.10): a version stamp goes live only after `python build.py`, a version bump, a push, and **Playwright verification of the live Cloudflare URL** — the `.foot-stamp` matching the shipped `מהדורה NNN` **plus** a CP2 feature probe (the `#cpList` panel) present on the live page, polled until it appears. None of that is pre-authorized here, and no step of it may be skipped, batched or assumed.

```bash
# the gate's own evidence, kept out of the suite and out of docs/
git add scratch/cp2/gate/ mockups/cp2-gate-*-390x844.png
git commit -m "$(cat <<'EOF'
chore(cp2): phase-gate evidence — build guards A/B/C, the plain full suite, bilingual 390x844 walks

spec 2026-07-25 §8: "CP2 | the card path panel + default selection (O-1); plan-level path selector
generalized | real-UI walks incl. path switch round-trips; owner visual approval of the panel".

- python build.py: Guard-A/B/C OK, no Guard-D drift (scratch/cp2/gate/build.txt).
- npx playwright test, plain (no --workers, no --retries, no -g): output in
  scratch/cp2/gate/suite.txt.
- bilingual real-UI evidence at 390x844 (he + ru), 6 shots each: card, panel expanded, after a
  path switch, the raw table, the round-trip back to the default, the plan-level selector. The
  evidence walk lives under scratch/ with its own config so it cannot inflate the suite count.
- every §3.2/§3.3/§3.5/§4/§5/§8/§9 line quoted and marked MET with a named artifact; independent
  re-audit run against the spec by a fresh agent.

NOT a release: no version bump, no push, no live verification is authorized by this gate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
EOF
)"
```

---

## Out of scope

- **CP3** — acquiring new cited paths as data (oven-only / sv→oven become real cited entries); the panel already renders `cited:false` placeholders, so CP3 is "zero new JS".
- **O-2 consult-AI button** (E-programme) — the panel header leaves room; no build here.
- **CP4** — E4-remainder per-event override windows + O-3 timeline-impact preview.
- **Catalog-grid multi-path hint** — owner copy decision 4: scope stays on the card panel.
