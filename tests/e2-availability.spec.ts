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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Fix wave 2 — re-review "Important d", 2026-07-25: wave 1's per-slot floor used FIT_SLOT_TOL (1.10)
// UNCONDITIONALLY, which is stricter than the app's own design for ESTIMATED areas — deviceOccupancy's
// own hard/soft split (app.js ~505-520) gives an estimate the much looser FIT_HARD_FACTOR (1.6). The
// floor now branches on cap.areaMeasured, mirroring that precedent exactly. Also verifies eqmFitVerdict's
// return shape split (sumFits/floorFits) documented for Task 4's delegation.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

// sm2: NO stored cap.areaCm2 — deviceCapacity falls through to the class default for
// 'אופסט / סטיק-ברנר' (app.js EQUIP_CATS smoker props, def:5000), so known:true but areaMeasured:false.
// usableCm2 = round(5000*PACK_EFF) = round(5000*0.85) = 4250; racks=2 (stored, no class default exists
// for racks) → perSlotEst = 4250/2 = 2125. Measured floor threshold = 2125*FIT_SLOT_TOL(1.10) = 2337.5;
// estimated floor threshold = 2125*FIT_HARD_FACTOR(1.6) = 3400. A demand of 2800 sits strictly BETWEEN
// the two thresholds: blocked under the (wrong, wave-1) unconditional 1.10 floor, allowed under the
// correct estimated-area 1.6 floor — and the whole-device sum (2800 ≤ 4250) fits easily either way, so a
// 'busy' verdict here is attributable ONLY to which floor tolerance was applied.
const SM2 = { id:'sm2', cat:'smoker', type:'אופסט / סטיק-ברנר', name:'SEst', cap:{racks:2} };
const ESTIMATED_ROW = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:2800} };

test('FIX (wave 2) — estimated-area leniency: a demand between the measured and estimated floor thresholds is NOT blocked on a device with no stored areaCm2 (class-default estimate)', async ({ page }) => {
  await boot(page, [ SM2 ]);   // fixture minimality (DoD-6): only the one estimated-area device the scenario needs
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(ESTIMATED_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('free');   // 2800/4250 ≈ 66% used, well under the 90% "tight" line — plainly free once the floor is not hit
});

test('FIX (wave 2) regression guard: the pre-existing MEASURED-device floor test stays exactly the FIT_SLOT_TOL(1.10) behaviour (unchanged by the areaMeasured branch)', async ({ page }) => {
  await boot(page);
  // Identical scenario to "FIX 1 — per-slot floor" above (sm1, cap.areaCm2:4800 → areaMeasured:true) —
  // re-asserted here under its own name so this fix wave's diff carries an explicit witness that the
  // measured branch (FIT_SLOT_TOL) is untouched, not just that the file-wide suite happens to stay green.
  const r = await page.evaluate(`EQM.availability([${JSON.stringify(BIG_SINGLE_ROW)}], ${JSON.stringify(W)})`) as any;
  expect(r.state).toBe('busy');
});

test('unit probe: eqmFitVerdict returns sumFits/floorFits with the documented meanings (over-demand -> sumFits false; floor-only violation -> sumFits true + floorFits false)', async ({ page }) => {
  await boot(page);   // sm1: cap.areaCm2:4800 (measured) → usableCm2=4080, racks=2, perSlotEst=2040
  const r = await page.evaluate(`(function(){
    const dev = equipList().find(function(d){ return d.id==='sm1'; });
    const cap = deviceCapacity(dev);
    const overDemand = eqmFitVerdict(cap, [{metric:'area_cm2', amount:4500}]);      // 4500 > usableCm2(4080) -> whole-device sum alone fails
    const floorOnly  = eqmFitVerdict(cap, [{metric:'area_cm2', amount:2300}]);      // sum 2300<=4080 fits; single demand 2300 > perSlot(2040)*FIT_SLOT_TOL(1.10)=2244 -> floor alone fails
    return { overDemand: overDemand, floorOnly: floorOnly };
  })()`) as any;
  expect(r.overDemand.sumFits).toBe(false);
  expect(r.floorOnly.sumFits).toBe(true);
  expect(r.floorOnly.floorFits).toBe(false);
  expect(r.floorOnly.fits).toBe(false);   // fits = sumFits && floorFits — the combined verdict availability() still consumes
});
