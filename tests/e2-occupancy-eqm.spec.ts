import { test, expect, seedApp } from './_fixtures';

// Equipment programme E2 · Task 4 (O-6, D11). deviceOccupancy (app.js) DELEGATES its pct/over fit
// verdict to equipment.js's eqmFitVerdict (Task 2) — out.pct <- usedPct, out.over <- !sumFits, both
// byte-identical to the pre-E2 arithmetic (the pre-existing occupancy suite is the witness, run with
// ZERO edits in the report). The occupancy view's empty-device fall-through ("✓ הכל נכנס" unconditionally)
// is a lie D11 forbids — an unknown-capacity device with no items must show a neutral line instead.

const boot = async (page: any, kit: any[]) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify(kit),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof deviceOccupancy==='function' && typeof _occFitHtml==='function' && typeof eqmFitVerdict==='function'`);
};

// plain area cabinet — cut-1 has a well-known measured footprint (1320 cm², occupancy-slots.spec.ts)
const KIT_AREA = [{ id:'d1', cat:'smoker', type:'קטל (ככלי עישון)', name:'קטל', cap:{racks:1, areaCm2:2400, canHang:false} }];

test('D11: unknown-capacity device with zero items renders the neutral line, never the ✓ fall-through', async ({ page }) => {
  await boot(page, []);   // empty kit → devId resolves to no device at all → cap.known===false
  const r = await page.evaluate(`(function(){
    var o = deviceOccupancy('missing-device', Date.now(), [], null);
    return { html: _occFitHtml(o), knownCap: o.cap.known, itemCount: o.items.length };
  })()`) as any;
  expect(r.knownCap).toBe(false);
  expect(r.itemCount).toBe(0);
  expect(r.html).toContain('אין נתוני קיבולת');
  expect(r.html).not.toContain('הכל נכנס');
});

test('O-6: deviceOccupancy DELEGATES pct/over to eqmFitVerdict — proven by call, and numerically identical', async ({ page }) => {
  await boot(page, KIT_AREA);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var m=resolveItem('cut-1');
    var dev=equipByCat('smoker')[0];
    var item={ m:m, stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:110}] };
    setItemCooker('cut-1','smoke','d1');
    var occ=itemOccupancy(m,'smoke',dev);
    var cap=deviceCapacity(dev);
    var calls=0;
    var orig=eqmFitVerdict;
    eqmFitVerdict=function(){ calls++; return orig.apply(null, arguments); };
    var o=deviceOccupancy('d1', t0+1*3600e3, [item], null);
    eqmFitVerdict=orig;   // restore — do not leak the spy into later evaluates
    var demands = (occ.cm2!=null) ? [{metric:'area_cm2', amount:occ.cm2}] : [];
    var verdict = orig(cap, demands);
    return { pct:o.pct, usedPct:verdict.usedPct, over:o.over, sumFits:verdict.sumFits, calls:calls, cm2:occ.cm2 };
  })()`) as any;
  expect(r.cm2).not.toBeNull();                     // sanity: the item actually has a known area (test isn't vacuous)
  expect(r.calls).toBeGreaterThan(0);                // proves deviceOccupancy actually CALLS eqmFitVerdict — not a numeric coincidence
  expect(typeof r.pct).toBe('number');
  expect(r.pct).toBe(r.usedPct);
  expect(r.over).toBe(!r.sumFits);
});
