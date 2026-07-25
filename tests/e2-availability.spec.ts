import { test, expect, seedApp } from './_fixtures';

// Equipment programme E2 · Task 2 (spec §5.1). eqmFitVerdict is the ONE shared fit arithmetic —
// deviceOccupancy (app.js:497) delegates here in E2 Task 4, and EQM.availability applies the SAME
// function to ledger entries, so there is one arithmetic and two callers, never drift between them.
// D11's negative cases (no device of the kind; empty registry) are first-class here: the "✓ everything
// fits" fall-through (app.js ~674/683) must be structurally impossible through this path.
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
