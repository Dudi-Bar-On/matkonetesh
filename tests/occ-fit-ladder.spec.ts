import { test, expect, seedApp } from './_fixtures';

// A cabinet. areaCm2 8500 → usable ~7225 / 5 = ~1445 per shelf... we want ~1020, so use 6000.
// Estimated (class-default) area vs user-measured area is the axis under test.
// BUG-2 (Wave B, 2026-07-25): the 'ארון / קבינט' class default moved 6000→7900 (a sourced 3-model average
// — see the props block comment in app.js, EQUIP_CATS). ESTIMATE below is a 6-rack fixture (not 5) so the
// per-shelf estimate lands back in the same "bad but within 1.6x tolerance" band the test is actually
// about: usableCm2=round(7900*0.85)=6715, perSlot=round(6715/6)=1119 — brisket 1320 > 1119 (bad) but
// <= 1119*1.6=1790 (not hard) → 'tight'. MEASURED (used by the other two tests) is unaffected — it stores
// its own explicit areaCm2:6000, never touching the class default.
const boot = async (page: any, kit: any[]) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify(kit),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof deviceOccupancy==='function' && typeof FIT_HARD_FACTOR!=='undefined'`);
};
// cabinet with NO cap.areaCm2 → area comes from the class default (estimate). racks:6 — see the note above.
const ESTIMATE = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:6} }];
// cabinet WITH a user area too small for the brisket → measured.
const MEASURED = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5, areaCm2:6000} }];

const fitAt = (keys: string[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
  var computed=${JSON.stringify(keys)}.map(mk);
  ${JSON.stringify(keys)}.forEach(function(k){ setItemCooker(k,'smoke','d1'); });
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  return { verdict:o.fit.verdict, measured:o.fit.measured, hard:o.fit.hardItems, soft:o.fit.softItems, perSlot:o.cap.perSlotCm2, areaMeasured:o.cap.areaMeasured };
})()`;

test('estimate + moderate overflow → tight (orange), never over', async ({ page }) => {
  await boot(page, ESTIMATE);
  const r = await page.evaluate(fitAt(['cut-1','cut-7','cut-9'])) as any;   // cut-1 = brisket 1320
  expect(r.areaMeasured).toBe(false);
  // brisket 1320 vs an ESTIMATED shelf, within 1.6x → tight, not over
  expect(r.verdict).toBe('tight');
  const brisketHeb = await page.evaluate("resolveItem('cut-1').heb");
  expect(r.soft).toContain(brisketHeb);
});
test('user-measured area too small → over (red), names the item', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(fitAt(['cut-1','cut-7','cut-9'])) as any;
  expect(r.areaMeasured).toBe(true);
  expect(r.perSlot).toBe(1020);
  expect(r.verdict).toBe('over');
  expect(r.hard.length).toBeGreaterThan(0);
});
test('everything fits → ok (green)', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(fitAt(['cut-7','cut-9','cut-10'])) as any;  // all small
  expect(r.verdict).toBe('ok');
  expect(r.hard.length).toBe(0);
  expect(r.soft.length).toBe(0);
});
