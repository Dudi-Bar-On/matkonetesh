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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Fix wave 1 — owner rulings 2026-07-25 (post Task-2 review). Two spec-level gaps the reviewer surfaced,
// both ruled on in conversation and committed as amendments to
// docs/superpowers/specs/2026-07-25-equipment-cooking-constraint-design.md:
//   FIX 1 — per-slot FLOOR (C4 re-wording): "cheap floor now, full per-slot at E3".
//   FIX 2 — capacityDemand.tempC bath exclusivity (§4.3 amendment): one circulator, one temperature.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

// sm1 (KIT[0]): cap.areaCm2=4800, cap.racks=2 → usableCm2 = round(4800*PACK_EFF) = round(4800*0.85) = 4080;
// perSlotEst = usableCm2 / racks = 2040; floor threshold = perSlotEst * FIT_SLOT_TOL(1.10) = 2244.
// 2300 is BIGGER than the per-slot floor (2244) but SMALLER than the whole-device usable total (4080) —
// the exact case the sum-only check cannot see: a single demand that can never physically sit on one
// rack, hiding inside a comfortable 2300/4080≈56% whole-device total.
const BIG_SINGLE_ROW = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:2300} };

test('FIX 1 — per-slot floor (C4 re-wording): a single demand bigger than one slot but smaller than the whole-device total answers busy', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(BIG_SINGLE_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('busy');
});

// Bath-temp exclusivity rows: same litres (10L, well under sv1's 24L bath) so any 'busy' verdict below is
// attributable ONLY to the temp check, never to litre overflow — the isolation the mutation witness relies on.
const BATH_ROW_T63    = { role:'cook', kind:'bath', source:'derived', demand:{metric:'litres', amount:10, tempC:63} };
const BATH_ROW_T85    = { role:'cook', kind:'bath', source:'derived', demand:{metric:'litres', amount:10, tempC:85} };
const BATH_ROW_NOTEMP = { role:'cook', kind:'bath', source:'derived', demand:{metric:'litres', amount:10} };
const heldBathAt63 = (page: any) => page.evaluate(`eqmLedgerAdd({deviceId:'sv1', window:{startMs:900, endMs:1500}, capacityDemand:{metric:'litres', amount:10, tempC:63}, holder:{type:'event', id:'e1'}, state:'held'})`);

test('FIX 2 — bath temp exclusivity: a differing cited tempC on an overlapping hold answers busy (one circulator, one temperature)', async ({ page }) => {
  await boot(page);
  await heldBathAt63(page);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(BATH_ROW_T85)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('busy');
});

test('FIX 2 — bath temp exclusivity: the SAME cited tempC on an overlapping hold shares the bath, not busy', async ({ page }) => {
  await boot(page);
  await heldBathAt63(page);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(BATH_ROW_T63)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).not.toBe('busy');
});

test('FIX 2 — bath temp exclusivity: a legacy demand carrying NO tempC is temp-agnostic and is never blocked by a held tempC demand', async ({ page }) => {
  await boot(page);
  await heldBathAt63(page);
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(BATH_ROW_NOTEMP)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).not.toBe('busy');
});
