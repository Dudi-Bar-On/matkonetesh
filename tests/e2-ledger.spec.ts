import { test, expect, seedApp } from './_fixtures';

// E2 · Task 1 (spec §4.3, Q3). The reservation ledger's store primitives — eqmLedger/eqmLedgerAdd/
// eqmLedgerHeld — plus the KIND_TO_STAGE extension that maps oven→cook (closing a registered E1-gate
// item, review finding M2). Tasks 2-3 build EQM.availability/allocate/release on top of these exact
// signatures; this task tests only the primitives themselves, against the real localStorage-backed store.
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
