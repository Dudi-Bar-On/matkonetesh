# Equipment E2 — Reservation Ledger + Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The net-new `mk-eqm-ledger` reservation store, `EQM.availability` answering free/partial/busy over a time window from ONE shared fit arithmetic, `EQM.allocate`/`release` holder-tracked with cancel-frees-all, and the occupancy display rewired to module-owned math (O-6) — with the D11 empty-device lie killed.

**Architecture:** Strangler-fig step 2. The fit arithmetic that `deviceOccupancy` owns today (area = sum vs `usableCm2`; volume = MAX-requirement, never additive) is EXTRACTED into `equipment.js` as `eqmFitVerdict` — `deviceOccupancy` delegates to it (byte-identical numbers, the full suite is the witness), and `EQM.availability` applies the SAME function to ledger entries. One arithmetic, two callers, zero drift — this is how AMENDMENT O-6's "no parallel data path" is satisfied structurally rather than by promise.

**Tech Stack:** vanilla JS in `equipment.js` (inlined before app.js, F5-guarded) + `app.js` call sites · localStorage via the app's `store` · Playwright tests on the warm-page fixtures.

## Global Constraints

- Spec §4.3 ledger entry, verbatim shape: `{ id, deviceId, window:{ startMs, endMs }, capacityDemand:{ metric, amount }, holder, state }`; `holder := { type:'event'|'plan', id }`; `state := 'held' | 'released'`.
- Spec §5.1 contracts, verbatim: `EQM.availability(requires, window) → { state, room }` with `state ∈ 'free'|'partial'|'busy'`; `EQM.allocate(requires, window, holder) → { ok, holdIds }` (availability-checked, "will not over-book past busy"); `EQM.release(holder) → { freed }` flipping EVERY holder entry.
- **D11 (spec §5.1, first-class):** an empty or absent device answers `busy`/missing — NEVER the "✓ everything fits" fall-through. Negative case tested.
- **Volume semantics (deviceOccupancy app.js:497-506, preserved verbatim):** `min_bath_l` is a per-item CONSTRAINT, not additive displacement — the binding number is the LARGEST single requirement vs bath litres. Area semantics: SUM of known demands vs `usableCm2` (`deviceCapacity` app.js:305; `PACK_EFF` discount already inside `usableCm2`).
- **Phase-gate DoD (spec §8 row E2, verbatim):** "`availability` answers free/partial/busy incl. **D11 negative case**; allocate/release round-trip leaves `itemStages` byte-identical".
- AMENDMENT O-6: the usage display sources from EQM in THIS phase — no transition period where the view computes numbers the module doesn't own.
- AMENDMENT O-7 (probe capability): **placed in E3** with the validity gates (it is an ownership-capability check consumed by the gates; the amendment grants E2/E3 planning the placement). Named here so the E3 planner cannot miss it.
- **D5 guest-scaling: OWNER RULING 2026-07-25 — named future gap, NOT in E2.** `capacityDemand.amount` carries the static `footprint_cm2`/`min_bath_l` exactly as today (spec flag F2 resolved).
- **Oven gap (E1 gate REGISTERED item, closes here):** `KIND_TO_STAGE` gains `oven:'cook'` BEFORE any consumer can meet a `kind:'oven'` row — an oven-owner must never answer `missing` for a cook row an oven satisfies.
- F3/F5 stand: EQM stays exactly five `name: function` keys; app.js only CALLS `EQM.*`; `python build.py` green after every equipment.js/app.js change.
- H2 stands: no top-level equipment.js statement calls an app.js function.
- §2.2 safety invariance: no `bcheck`/`temp`/`safe`/duration path touched; every task's tests include the byte-identical `itemStages` witness where the task touches derivation-adjacent code.
- Suite baseline **540** (post foot-news). Plain `npx playwright test`, machine idle, verbatim final output pasted. No waitForTimeout. Never `git add -A`.
- Work on `main`. Reports: `.superpowers/sdd/e2-task-N-report.md`.

## File Structure

- `equipment.js` — grows: ledger primitives (`eqmLedger`, `eqmLedgerAdd`, `eqmLedgerSweep`), the shared fit arithmetic (`eqmFitVerdict`), `KIND_TO_STAGE.oven`, and the three EQM method bodies (`availability`, `allocate`, `release`) replacing their throwing stubs.
- `app.js` — `deviceOccupancy` delegates its fit verdict to `eqmFitVerdict` (Task 4); the occupancy view's empty-device path calls `EQM.availability` (Task 4); event cancel/delete calls `EQM.release` and event save writes holds (Task 5).
- `tests/e2-ledger.spec.ts`, `tests/e2-availability.spec.ts`, `tests/e2-allocate-release.spec.ts`, `tests/e2-occupancy-eqm.spec.ts`, `tests/e2-event-holds.spec.ts` — one spec file per task.

---

### Task 1: Ledger store primitives + the oven mapping

**Files:**
- Modify: `equipment.js` (KIND_TO_STAGE line ~21; new ledger section above the EQM literal)
- Test: `tests/e2-ledger.spec.ts`

**Interfaces:**
- Consumes: `store.get/set` (app.js global, hoisted — call-time only per H2).
- Produces (Tasks 2-3 rely on these exact signatures): `eqmLedger() → entry[]` (parsed, ALL states); `eqmLedgerHeld(deviceId, window) → entry[]` (state==='held' AND window-overlapping: `e.window.startMs < window.endMs && e.window.endMs > window.startMs`); `eqmLedgerAdd(entry) → id`; `KIND_TO_STAGE = { smoker:'smoke', grill:'cook', bath:'sv', oven:'cook' }`.

- [ ] **Step 1: failing tests** — write `tests/e2-ledger.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof EQM!=='undefined'`);
};

test('ledger primitives: add → read round-trip, id returned, shape preserved', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const id = eqmLedgerAdd({ deviceId:'d1', window:{startMs:1000, endMs:2000},
      capacityDemand:{metric:'area_cm2', amount:1320}, holder:{type:'event', id:'ev1'}, state:'held' });
    const all = eqmLedger();
    return { id: id, n: all.length, e: all[0] };
  })()`) as any;
  expect(typeof r.id).toBe('string');
  expect(r.n).toBe(1);
  expect(r.e.deviceId).toBe('d1');
  expect(r.e.capacityDemand).toEqual({metric:'area_cm2', amount:1320});
  expect(r.e.holder).toEqual({type:'event', id:'ev1'});
  expect(r.e.state).toBe('held');
});

test('eqmLedgerHeld: window overlap in, non-overlap out, released out (negative case)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    eqmLedgerAdd({ deviceId:'d1', window:{startMs:1000, endMs:2000}, capacityDemand:{metric:'area_cm2', amount:100}, holder:{type:'event', id:'a'}, state:'held' });
    eqmLedgerAdd({ deviceId:'d1', window:{startMs:5000, endMs:6000}, capacityDemand:{metric:'area_cm2', amount:200}, holder:{type:'event', id:'b'}, state:'held' });
    eqmLedgerAdd({ deviceId:'d1', window:{startMs:1500, endMs:1800}, capacityDemand:{metric:'area_cm2', amount:300}, holder:{type:'event', id:'c'}, state:'released' });
    eqmLedgerAdd({ deviceId:'d2', window:{startMs:1000, endMs:2000}, capacityDemand:{metric:'area_cm2', amount:400}, holder:{type:'event', id:'d'}, state:'held' });
    return eqmLedgerHeld('d1', {startMs:1500, endMs:2500}).map(e=>e.capacityDemand.amount);
  })()`) as any;
  expect(r).toEqual([100]);   // overlaps; 200 later, 300 released, 400 other device — all excluded
});

test('edge-touching windows do NOT overlap (end==start is a clean handoff)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    eqmLedgerAdd({ deviceId:'d1', window:{startMs:1000, endMs:2000}, capacityDemand:{metric:'area_cm2', amount:100}, holder:{type:'event', id:'a'}, state:'held' });
    return eqmLedgerHeld('d1', {startMs:2000, endMs:3000}).length;
  })()`) as any;
  expect(r).toBe(0);
});

test('KIND_TO_STAGE maps oven → cook (E1-gate registered item closed)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`KIND_TO_STAGE['oven']`)).toBe('cook');
});
```

- [ ] **Step 2: RED** — run `npx playwright test tests/e2-ledger.spec.ts`. Expected: 4 failed — tests 1-3 at `eqmLedgerAdd is not defined`; test 4 expecting `'cook'`, receiving `undefined`. Paste per-assertion output.
- [ ] **Step 3: implement** in `equipment.js`. Extend the map at line ~21: `const KIND_TO_STAGE = { smoker:'smoke', grill:'cook', bath:'sv', oven:'cook' };` and update the comment above `eqmOwnershipRow` (the "oven unmappable" M2 sentence is now stale — rewrite it to say declared/process kinds remain E6). Then above the EQM literal:

```js
// ── the reservation ledger (spec §4.3, Q3) — the ONE net-new store. Entries are never deleted in E2,
// only flipped to 'released' (release-vs-delete keeps the audit trail; a sweep is a later concern).
// D5 note (owner 2026-07-25): capacityDemand carries the STATIC footprint/min_bath_l — guest-scaling
// is a named future gap; the field's shape already accepts a scaled amount when that lands.
const EQM_LEDGER_KEY = 'mk-eqm-ledger';
function eqmLedger(){
  try{ const v = JSON.parse(store.get(EQM_LEDGER_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch(e){ return []; }
}
function eqmLedgerWrite(list){ store.set(EQM_LEDGER_KEY, JSON.stringify(list||[])); }
function eqmLedgerAdd(entry){
  const list = eqmLedger();
  const id = 'h' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  list.push(Object.assign({ id: id }, entry));
  eqmLedgerWrite(list);
  return id;
}
// Held entries on ONE device overlapping a window. Half-open [startMs, endMs): touching edges are a
// clean handoff, not a conflict — the same convention the scheduler's stage windows already use.
function eqmLedgerHeld(deviceId, window){
  return eqmLedger().filter(function(e){
    return e && e.state==='held' && e.deviceId===deviceId && e.window &&
           e.window.startMs < window.endMs && e.window.endMs > window.startMs;
  });
}
```

- [ ] **Step 4: build + GREEN** — `python build.py` (F5 stays green), then the spec file: 4 passed. Paste.
- [ ] **Step 5: commit** — `git add equipment.js tests/e2-ledger.spec.ts` · `feat(equip): E2 Task 1 - mk-eqm-ledger primitives + oven mapping (registered E1-gate item closed)`.

---

### Task 2: The shared fit arithmetic + `EQM.availability`

**Files:**
- Modify: `equipment.js` (new `eqmFitVerdict`; replace the `availability` stub body)
- Test: `tests/e2-availability.spec.ts`

**Interfaces:**
- Consumes: Task 1's `eqmLedgerHeld`; app.js hoisted `cookerCandidates`, `deviceCapacity`, `equipList` (call-time only).
- Produces: `eqmFitVerdict(cap, demands) → { fits:boolean, usedPct:number|null, room:number|null }` where `cap` is a `deviceCapacity()` result and `demands` is an array of `capacityDemand` objects — **area: SUM of amounts vs `cap.usableCm2`; litres: MAX of amounts vs `cap.litres`** (the deviceOccupancy app.js:497 rule, verbatim semantics); unknown capacity (`!cap.known`) → `fits:false, usedPct:null` (an unknown must never masquerade as room — D11's spirit). `EQM.availability(requires, window) → { state:'free'|'partial'|'busy', room, perRow:[{kind, state, deviceId|null}] }`.

- [ ] **Step 1: failing tests** — `tests/e2-availability.spec.ts` (fixture: seed `mk-equipment` with ONE smoker `{id:'sm1', cat:'smoker', type:'ארון / קבינט', cap:{racks:2, areaCm2:4800}}` — usableCm2 = 4800×PACK_EFF; and for bath cases ONE sousvide `{id:'sv1', cat:'sousvide', cap:{baths:[12,24]}}`; copy the exact seeding shape from tests/e1-ownership.spec.ts):

```ts
import { test, expect, seedApp } from './_fixtures';
const KIT = [ {id:'sm1', cat:'smoker', type:'ארון / קבינט', name:'S', cap:{racks:2, areaCm2:4800}},
              {id:'sv1', cat:'sousvide', name:'B', cap:{baths:[12,24]}} ];
const boot = async (page: any, kit: any = KIT) => {
  await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                        'mk-equipment': JSON.stringify(kit) });
  await page.waitForFunction(`typeof EQM!=='undefined'`);
};
const W = { startMs: 1000, endMs: 2000 };
const SMOKE_ROW = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:1320} };
const BATH_ROW  = { role:'cook', kind:'bath',   source:'derived', capability:{bathMinL:24}, demand:{metric:'litres', amount:24} };

test('free: empty ledger, demand fits with margin', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(SMOKE_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('free');
  expect(r.room).toBeGreaterThan(0);
});

test('busy: overlapping holds already consume the device; non-overlapping window stays free', async ({ page }) => {
  await boot(page);
  await page.evaluate(`(function(){
    eqmLedgerAdd({deviceId:'sm1', window:{startMs:900, endMs:1500}, capacityDemand:{metric:'area_cm2', amount:3000}, holder:{type:'event', id:'e1'}, state:'held'});
    eqmLedgerAdd({deviceId:'sm1', window:{startMs:900, endMs:1500}, capacityDemand:{metric:'area_cm2', amount:900}, holder:{type:'event', id:'e1'}, state:'held'});
  })()`);
  const overlap = await page.evaluate(`EQM.availability([${JSON.stringify(SMOKE_ROW)}], ${JSON.stringify(W)})`) as any;
  const later   = await page.evaluate(`EQM.availability([${JSON.stringify(SMOKE_ROW)}], {startMs:5000, endMs:6000})`) as any;
  expect(overlap.state).toBe('busy');     // 3000+900 held + 1320 new > 4800*PACK_EFF
  expect(later.state).toBe('free');
});

test('bath litres aggregate by MAX, not sum (deviceOccupancy rule preserved)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`eqmLedgerAdd({deviceId:'sv1', window:{startMs:900, endMs:1500}, capacityDemand:{metric:'litres', amount:12}, holder:{type:'event', id:'e1'}, state:'held'})`);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(BATH_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).not.toBe('busy');   // max(12 held, 24 new) = 24 ≤ 24L bath — items SHARE a bath
});

test('D11 negative case: no device of the kind → busy with the row named, never a silent fit', async ({ page }) => {
  await boot(page, [ KIT[1] ]);   // bath only — no smoker
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(SMOKE_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('busy');
  expect(r.perRow[0].deviceId).toBeNull();
});

test('D11: EMPTY registry → busy (the app.js:674 "everything fits" lie must be impossible here)', async ({ page }) => {
  await boot(page, []);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(SMOKE_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('busy');
});

test('DoD-10: availability round-trip leaves itemStages byte-identical', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m = resolveItem('cut-1');
    const before = JSON.stringify(itemStages(m, undefined, true));
    EQM.availability(deriveRequires(m, eqmRequiresMethodKey(m)), ${JSON.stringify(W)});
    return { same: JSON.stringify(itemStages(m, undefined, true)) === before };
  })()`) as any;
  expect(r.same).toBe(true);
});
```

- [ ] **Step 2: RED** — all fail at the `availability` stub's throw (`not implemented until E2`). Paste per-assertion.
- [ ] **Step 3: implement** in `equipment.js`:

```js
// ── the ONE fit arithmetic (O-6). deviceOccupancy (app.js) delegates here in E2 Task 4, and
// availability applies the same function to ledger entries — one arithmetic, two callers, zero drift.
// Area: SUM of known demands vs usableCm2 (PACK_EFF already inside). Litres: MAX of demands vs bath
// litres — min_bath_l is a per-item CONSTRAINT, not additive displacement (deviceOccupancy's rule).
// Unknown capacity NEVER fits: a device whose size we don't know must not absorb bookings silently.
function eqmFitVerdict(cap, demands){
  if(!cap || !cap.known) return { fits:false, usedPct:null, room:null };
  const amts = (demands||[]).map(function(d){ return (d && Number(d.amount)) || 0; });
  if(cap.mode==='volume'){
    const maxReq = amts.length ? Math.max.apply(null, amts) : 0;
    return { fits: maxReq <= cap.litres, usedPct: cap.litres>0 ? Math.round(maxReq/cap.litres*100) : null,
             room: Math.max(0, cap.litres - maxReq) };
  }
  const sum = amts.reduce(function(a,b){ return a+b; }, 0);
  return { fits: sum <= cap.usableCm2, usedPct: cap.usableCm2>0 ? Math.round(sum/cap.usableCm2*100) : null,
           room: Math.max(0, cap.usableCm2 - sum) };
}
```

and the `availability` body (inside the EQM literal, keeping the `name: function` F5 shape):

```js
  // ledger + capacity fit over a window (spec §5.1). Per requires row: find the owned candidate
  // devices (same cookerCandidates policy ownership uses), and the row is served by the FIRST device
  // where held-demands + this demand still fit. free = every row fits with margin on some device;
  // partial = every row fits but at least one lands ≥90% used; busy = some row fits nowhere.
  // D11: no candidate device, empty registry, unknown capacity → that row is busy, deviceId:null —
  // the "✓ everything fits" fall-through is impossible by construction here.
  availability: function(requires, window){
    const perRow = []; let worst = 'free'; let minRoom = null;
    (requires||[]).forEach(function(row){
      const stageKind = KIND_TO_STAGE[row && row.kind];
      const owned = (stageKind && typeof cookerCandidates==='function') ? cookerCandidates(stageKind) : [];
      let served = null, rowRoom = null, tight = false;
      owned.some(function(dev){
        const cap = deviceCapacity(dev);
        const held = eqmLedgerHeld(dev.id, window).map(function(e){ return e.capacityDemand; });
        const all = held.concat(row.demand ? [row.demand] : []);
        const v = eqmFitVerdict(cap, all);
        if(!v.fits) return false;
        served = dev; rowRoom = v.room; tight = v.usedPct!=null && v.usedPct >= 90;
        return true;
      });
      perRow.push({ kind: row ? row.kind : null, state: served ? (tight ? 'partial' : 'free') : 'busy',
                    deviceId: served ? served.id : null });
      if(!served) worst = 'busy';
      else if(tight && worst!=='busy') worst = 'partial';
      if(rowRoom!=null) minRoom = (minRoom==null) ? rowRoom : Math.min(minRoom, rowRoom);
    });
    return { state: worst, room: minRoom, perRow: perRow };
  },
```

- [ ] **Step 4: build + GREEN** — `python build.py`; spec file 6 passed. Paste.
- [ ] **Step 5: commit** — `git add equipment.js tests/e2-availability.spec.ts` · `feat(equip): E2 Task 2 - eqmFitVerdict (one arithmetic) + EQM.availability with D11 negative cases`.

---

### Task 3: `EQM.allocate` / `EQM.release` — the hold lifecycle

**Files:**
- Modify: `equipment.js` (replace the two stub bodies)
- Test: `tests/e2-allocate-release.spec.ts`

**Interfaces:**
- Consumes: Task 2's `availability` + Task 1's ledger primitives.
- Produces: `EQM.allocate(requires, window, holder) → { ok, holdIds:[] }` — on `availability.state==='busy'` returns `{ok:false, holdIds:[]}` and writes NOTHING (all-or-nothing, no partial booking); otherwise writes one `held` entry per row that carries a `demand`, on that row's serving `deviceId`. `EQM.release(holder) → { freed:N }` — flips every `held` entry whose holder type+id match.

- [ ] **Step 1: failing tests** — `tests/e2-allocate-release.spec.ts` (same KIT/boot/W/SMOKE_ROW/BATH_ROW constants as Task 2):

```ts
test('allocate writes one held entry per demand row, tagged with the holder', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const a = EQM.allocate([${JSON.stringify(SMOKE_ROW)}, ${JSON.stringify(BATH_ROW)}], ${JSON.stringify(W)}, {type:'event', id:'ev9'});
    return { a: a, ledger: eqmLedger() };
  })()`) as any;
  expect(r.a.ok).toBe(true);
  expect(r.a.holdIds.length).toBe(2);
  expect(r.ledger.every((e:any)=>e.holder.id==='ev9' && e.state==='held')).toBe(true);
});

test('allocate refuses to over-book: busy means ok:false and the ledger is UNTOUCHED (all-or-nothing)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    eqmLedgerAdd({deviceId:'sm1', window:${JSON.stringify(W)}, capacityDemand:{metric:'area_cm2', amount:4000}, holder:{type:'event', id:'e1'}, state:'held'});
    const before = eqmLedger().length;
    const a = EQM.allocate([${JSON.stringify(SMOKE_ROW)}], ${JSON.stringify(W)}, {type:'event', id:'ev9'});
    return { a: a, delta: eqmLedger().length - before };
  })()`) as any;
  expect(r.a.ok).toBe(false);
  expect(r.a.holdIds).toEqual([]);
  expect(r.delta).toBe(0);
});

test('release frees ALL of one holder and ONLY that holder (cancel-frees-holds, Q3)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    EQM.allocate([${JSON.stringify(SMOKE_ROW)}], ${JSON.stringify(W)}, {type:'event', id:'mine'});
    EQM.allocate([${JSON.stringify(BATH_ROW)}], ${JSON.stringify(W)}, {type:'event', id:'other'});
    const rel = EQM.release({type:'event', id:'mine'});
    const states = {};
    eqmLedger().forEach(function(e){ states[e.holder.id] = e.state; });
    return { rel: rel, states: states };
  })()`) as any;
  expect(r.rel.freed).toBe(1);
  expect(r.states['mine']).toBe('released');
  expect(r.states['other']).toBe('held');
});

test('released capacity is really free again (allocate, release, allocate succeeds)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const big = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:3500} };
    EQM.allocate([big], ${JSON.stringify(W)}, {type:'event', id:'first'});
    const whileHeld = EQM.allocate([big], ${JSON.stringify(W)}, {type:'event', id:'second'}).ok;
    EQM.release({type:'event', id:'first'});
    const afterFree = EQM.allocate([big], ${JSON.stringify(W)}, {type:'event', id:'second'}).ok;
    return { whileHeld: whileHeld, afterFree: afterFree };
  })()`) as any;
  expect(r.whileHeld).toBe(false);
  expect(r.afterFree).toBe(true);
});

test('DoD-10 phase-gate line: full allocate-then-release cycle leaves itemStages byte-identical', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m = resolveItem('cut-1');
    const before = JSON.stringify(itemStages(m, undefined, true));
    const reqs = deriveRequires(m, eqmRequiresMethodKey(m));
    EQM.allocate(reqs, ${JSON.stringify(W)}, {type:'event', id:'x'});
    EQM.release({type:'event', id:'x'});
    return JSON.stringify(itemStages(m, undefined, true)) === before;
  })()`) as any;
  expect(r).toBe(true);
});
```

- [ ] **Step 2: RED** — all 5 fail at the `allocate` stub throw. Paste per-assertion.
- [ ] **Step 3: implement** — replace the two stub bodies in the EQM literal (keep `name: function` shape):

```js
  // holder-tracked reservation (spec §5.1). ALL-OR-NOTHING: if availability says busy for the set,
  // nothing is written — a half-booked event is a lie in both directions.
  allocate: function(requires, window, holder){
    const avail = EQM.availability(requires, window);
    if(avail.state==='busy') return { ok:false, holdIds:[] };
    const ids = [];
    (requires||[]).forEach(function(row, i){
      if(!row || !row.demand) return;                       // capability-only rows reserve nothing
      const devId = avail.perRow[i] && avail.perRow[i].deviceId; if(!devId) return;
      ids.push(eqmLedgerAdd({ deviceId: devId, window: { startMs: window.startMs, endMs: window.endMs },
        capacityDemand: { metric: row.demand.metric, amount: row.demand.amount },
        holder: { type: holder.type, id: holder.id }, state: 'held' }));
    });
    return { ok: true, holdIds: ids };
  },
  // frees ALL of a holder's holds (spec §5.1, Q3: cancelling an event frees everything, one call).
  release: function(holder){
    const list = eqmLedger(); let n = 0;
    list.forEach(function(e){
      if(e && e.state==='held' && e.holder && holder &&
         e.holder.type===holder.type && e.holder.id===holder.id){ e.state='released'; n++; }
    });
    eqmLedgerWrite(list);
    return { freed: n };
  },
```

- [ ] **Step 4: build + GREEN** — spec file 5 passed; paste. Also re-run `tests/e1-module-seam.spec.ts`: its throw-test asserted availability/allocate/release throw phase names — those stubs are now REAL, so that assertion is legitimately obsolete. Update it to assert only `alternatives` throws (E5), citing this task in the test comment. **This is a planned contract change with this plan line as its paper trail — not a Waiver-Gate item.**
- [ ] **Step 5: commit** — `git add equipment.js tests/e2-allocate-release.spec.ts tests/e1-module-seam.spec.ts` · `feat(equip): E2 Task 3 - allocate/release hold lifecycle (all-or-nothing, cancel-frees-holds)`.

---

### Task 4: O-6 — `deviceOccupancy` delegates the verdict; the display's empty-device lie dies

**Files:**
- Modify: `app.js` (`deviceOccupancy` fit computation, area+volume branches ~app.js:490-520; the occupancy view fit line `_occFitHtml` ~app.js:664-684)
- Test: `tests/e2-occupancy-eqm.spec.ts`

**Interfaces:**
- Consumes: `eqmFitVerdict` (Task 2).
- Produces: NO new surface — this is the O-6 rewiring. `deviceOccupancy`'s pct/over math routes through `eqmFitVerdict` with IDENTICAL results (the pre-existing occupancy suite is the witness); the view with an unknown-capacity device and no items shows a neutral `אין נתוני קיבולת` / `no capacity data` line instead of the unconditional `✓ הכל נכנס` fall-through.

**Implementer notes (locate by symbol via Serena — line numbers drift):** the volume branch (`maxReq` → `out.pct`/`out.over`) and the area branch become calls into `eqmFitVerdict(cap, demands)` where `demands` maps `out.items` to `{metric, amount}` shapes; keep `pctFloor`/`unknownCm2Count` handling in app.js (display concerns, not fit arithmetic). In `_occFitHtml`, the final `✓` return gains a guard for the no-capacity-no-items state (D11's display-side cure; the data-side cure is Task 2's availability). After body edits RE-READ the comment blocks above both symbols and update them (stale-comment gate). DoD-8: 390×844 screenshots, populated AND empty states, both looked at.

- [ ] **Step 1: failing tests** — (a) unknown-capacity device, zero items → the view must NOT render `הכל נכנס` (assert the neutral string); (b) a populated device's rendered pct equals `eqmFitVerdict`'s number for the same inputs (compute both via page.evaluate, compare). RED with per-assertion attribution: (a) fails on the current fall-through, (b) fails while the wiring is absent.
- [ ] **Step 2: implement the delegation + the view guard.**
- [ ] **Step 3: identity witness** — run the pre-existing occupancy suite (`npx playwright test tests/occupancy-hanging.spec.ts tests/equipment-visibility.spec.ts` + any `occ`-matching spec) — ALL green with ZERO edits to those files. A pre-existing occupancy test needing any change means the delegation changed behavior → STOP; that is a defect, not a test problem.
- [ ] **Step 4: build + screenshots + full suite verbatim.**
- [ ] **Step 5: commit** — `git add app.js tests/e2-occupancy-eqm.spec.ts` · `feat(equip): E2 Task 4 - deviceOccupancy delegates to eqmFitVerdict; empty-device fall-through removed (O-6, D11)`.

---

### Task 5: Production wiring — events hold and free real windows

**Files:**
- Modify: `app.js` (event save/schedule path allocates; event cancel/delete releases — locate the event persistence function and delete handler via Serena by role; the implementer confirms exact symbols and lists EVERY caller of anything touched in the report)
- Test: `tests/e2-event-holds.spec.ts`

**Interfaces:**
- Consumes: `EQM.allocate`/`release` (Task 3), `deriveRequires` + `eqmRequiresMethodKey` (E1), the event's computed stage windows (the same `computed` the work plan renders; smoke row ↔ smoke stage window, bath row ↔ sv window, via `KIND_TO_STAGE`).
- Produces: the DoD-5 consumers — a saved event with scheduled cook stages owns holds `holder:{type:'event', id:<eventId>}` matching its stage windows; delete/cancel frees them all; re-save releases old holds FIRST then re-allocates (idempotent, no ghost holds).

- [ ] **Step 1: failing tests** — driven through the REAL UI path (§10.2 — the wizard flow existing event specs use, seeded kit): (a) saving an event with one smoked item → `eqmLedger()` has ≥1 held entry with the event's holder id and window equal to the item's computed smoke-stage times; (b) deleting the event flips all its entries to released; (c) edit→re-save leaves exactly ONE generation of holds; (d) NEGATIVE: an event needing no device (or empty kit) writes zero holds and the save still succeeds — **holds must never block saving in E2; blocking is E3's gate, explicitly not here.**
- [ ] **Step 2: RED witnessed, per-assertion.**
- [ ] **Step 3: implement** — release-then-allocate inside the save path; release inside delete/cancel.
- [ ] **Step 4: build + GREEN + full suite verbatim** (state the arithmetic: 540 + all E2 tests).
- [ ] **Step 5: commit** — `git add app.js tests/e2-event-holds.spec.ts` · `feat(equip): E2 Task 5 - event lifecycle writes/frees ledger holds (release-then-allocate, cancel-frees-all)`.

---

## Self-review (performed at authoring, 2026-07-25)

1. **Spec coverage:** §4.3 ledger shape → T1; capacity-math absorption → T2 (`eqmFitVerdict`); §5.1 availability incl. D11 → T2; allocate/release incl. Q3 cancel-frees → T3; O-6 same-phase display rewiring → T4; phase-DoD "round-trip byte-identical" → T2+T3 tests; oven registered item → T1; O-7 → explicitly placed E3 (header); D5 → explicitly out (owner ruling, header); event-window production consumer → T5. **Honest gap:** spec's `room` = "how many more of this demand fit"; T2 returns room in capacity units (cm²/L), not demand-multiples — deliberate E2 simplification (nothing renders room yet; E3's gates format it). Reviewer may challenge; this line is the disclosure.
2. **Placeholder scan:** T4/T5 name app.js symbols by ROLE with Serena-locate instructions instead of embedded code — deliberate for the two integration tasks whose surrounding code the implementer must read fresh; every equipment.js change carries complete code. No TBD/TODO.
3. **Type consistency:** `eqmFitVerdict(cap, demands)` consistent across T2 definition, T2 availability caller, T4 delegation; holder `{type,id}` consistent T1/T3/T5; `KIND_TO_STAGE.oven` added T1, consumed T2/T5; `window:{startMs,endMs}` half-open everywhere.
