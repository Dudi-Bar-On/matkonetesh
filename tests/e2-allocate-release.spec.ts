import { test, expect, seedApp } from './_fixtures';

// Equipment programme E2 · Task 3 (spec §5.1). EQM.allocate/EQM.release — the hold lifecycle.
// allocate is ALL-OR-NOTHING: if EQM.availability says busy for the whole requires set, NOTHING is
// written (a half-booked event is a lie in both directions). release flips every 'held' entry whose
// holder type+id match to 'released' (Q3: cancelling an event frees everything, one call).
//
// KIT/boot/W/SMOKE_ROW/BATH_ROW mirror Task 2's constants (tests/e2-availability.spec.ts) — defined
// locally here rather than imported across spec files (owner instruction, this task's brief).
const KIT = [ {id:'sm1', cat:'smoker', type:'ארון / קבינט', name:'S', cap:{racks:2, areaCm2:4800}},
              {id:'sv1', cat:'sousvide', name:'B', cap:{baths:[12,24]}} ];
const boot = async (page: any, kit: any = KIT) => {
  await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                        'mk-equipment': JSON.stringify(kit) });
  await page.waitForFunction(`typeof EQM!=='undefined'`);
};
const W = { startMs: 1000, endMs: 2000 };
const SMOKE_ROW = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:1320} };
// BATH_ROW gains tempC:63 (owner ruling 2026-07-25, spec §4.3 amendment, post Task-2 review): a hold
// without its cited bath temperature would blind eqmFitVerdict's bath-temp exclusivity check (Task 2).
// This is the planned contract — extending the brief's literal BATH_ROW with tempC, with the committed
// spec amendment as the paper trail (this task's brief note "CONTEXT FROM TASKS 1-2").
const BATH_ROW  = { role:'cook', kind:'bath',   source:'derived', capability:{bathMinL:24}, demand:{metric:'litres', amount:24, tempC:63} };

test('allocate writes one held entry per demand row, tagged with the holder', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const a = EQM.allocate([${JSON.stringify(SMOKE_ROW)}, ${JSON.stringify(BATH_ROW)}], ${JSON.stringify(W)}, {type:'event', id:'ev9'});
    return { a: a, ledger: eqmLedger() };
  })()`) as any;
  expect(r.a.ok).toBe(true);
  expect(r.a.holdIds.length).toBe(2);
  expect(r.ledger.every((e:any)=>e.holder.id==='ev9' && e.state==='held')).toBe(true);
  // tempC round-trip (owner ruling 2026-07-25, spec §4.3 amendment): the allocated bath entry's
  // capacityDemand must carry the cited tempC through into the ledger, or a later exclusivity check
  // (eqmFitVerdict, Task 2) has nothing real to compare against.
  const bathEntry = r.ledger.find((e:any) => e.deviceId === 'sv1');
  expect(bathEntry.capacityDemand.tempC).toBe(63);
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
  // Demand amount adjusted from the brief's literal 3500 to 2200 (implementer note, this task): sm1
  // (KIT[0], cap.areaCm2:4800, racks:2) has usableCm2=4080, perSlotEst=2040, and a per-slot floor
  // threshold of 2040*FIT_SLOT_TOL(1.10)=2244 (Task 2's own eqmFitVerdict per-slot floor, owner ruling
  // 2026-07-25, spec C4 — shipped in the BASE commit this task starts from, tests/e2-availability.spec.ts
  // documents the same arithmetic for sm1). 3500 exceeds that floor by itself, so it would answer 'busy'
  // on the very FIRST allocate regardless of any hold, never reaching the sum-overflow scenario this test
  // targets. 2200 sits between the per-slot floor threshold (2244, single demand fits) and half the
  // whole-device sum threshold (2040, so two concurrent 2200s overflow 4080) — isolating the intended
  // assertion (fits alone; two concurrent holds overflow the sum) the same way Task 2's own
  // BIG_SINGLE_ROW/SMOKE_ROW pair isolates the floor check from the sum check.
  const r = await page.evaluate(`(function(){
    const big = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:2200} };
    EQM.allocate([big], ${JSON.stringify(W)}, {type:'event', id:'first'});
    const whileHeld = EQM.allocate([big], ${JSON.stringify(W)}, {type:'event', id:'second'}).ok;
    EQM.release({type:'event', id:'first'});
    const afterFree = EQM.allocate([big], ${JSON.stringify(W)}, {type:'event', id:'second'}).ok;
    return { whileHeld: whileHeld, afterFree: afterFree };
  })()`) as any;
  expect(r.whileHeld).toBe(false);
  expect(r.afterFree).toBe(true);
});

// BUGFIX — allocate inherits EQM.availability's capability gate (spec §5.1, owner Decision 3,
// 2026-07-26): allocate reserves on availability.perRow[i].deviceId, so a row whose only right-kind
// device fails a capability requires (here: maxTempC) must now resolve 'busy' at the availability
// re-check inside allocate — ALL-OR-NOTHING means nothing is written to the ledger at all.
test('BUGFIX — allocate inherits the capability gate: a row whose only right-kind device fails maxTempC reserves NOTHING', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:4, areaCm2:6000, maxC:150} }]);
  const row = { role:'cook', kind:'smoker', source:'derived', capability:{maxTempC:300}, demand:{metric:'area_cm2', amount:1000} };
  const r = await page.evaluate(`(function(){
    const before = eqmLedger().length;
    const a = EQM.allocate([${JSON.stringify(row)}], ${JSON.stringify(W)}, {type:'event', id:'ev-capblind'});
    return { a: a, delta: eqmLedger().length - before };
  })()`) as any;
  expect(r.a.ok).toBe(false);
  expect(r.a.holdIds).toEqual([]);
  expect(r.delta).toBe(0);
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
