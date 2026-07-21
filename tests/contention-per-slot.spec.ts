import { test, expect } from '@playwright/test';

// cookerContention still judged a clash by o.over — the WHOLE-DEVICE area sum — which is the exact lie the
// H4/Phase-2 work removed from the occupancy card: a brisket that fits no single shelf leaves a 5-shelf
// cabinet at ~35% overall, so the work-plan banner reported "no clash" while the card said it fits nowhere.
// The honest signal is the fit ladder (o.fit.verdict), and both surfaces must read the same one.

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cookerContention==='function' && typeof deviceOccupancy==='function'`);
};

// 5 shelves, 6000 cm² gross -> 5100 usable -> 1020 per shelf. Brisket 1320 fits NO shelf, yet the whole
// device is only ~35% loaded.
const MEASURED = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:5, areaCm2:6000 } }];
// same shelves, NO areaCm2 -> the area is a class-default ESTIMATE
const ESTIMATE = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:5 } }];

const RUN = (keys: string[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var computed=${JSON.stringify(keys)}.map(function(k){
    setItemCooker(k,'smoke','d1');
    return { m:resolveItem(k), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] };
  });
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  var cl=cookerContention(computed, null);
  return { clashes:cl.length, reasons:cl.map(function(c){return c.reason;}),
           wholeDeviceOver:o.over, pct:o.pct, slotOver:o.slotOver, verdict:o.fit.verdict };
})()`;

test('K1: a cut that fits no single shelf IS a clash, even though the device is only ~35% full', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(RUN(['cut-1', 'cut-7'])) as any;   // brisket 1320 (> 1020/shelf) + spareribs
  // the conditions that made the old check miss it:
  expect(r.wholeDeviceOver).toBe(false);          // whole-device area says "comfortable"...
  expect(r.pct).toBeLessThan(60);
  expect(r.verdict).toBe('over');                 // ...while the honest per-slot verdict says it fits nowhere
  // the banner must now agree with the card
  expect(r.clashes).toBe(1);
  expect(r.reasons).toContain('area');
});

test('K2: a load that genuinely fits every shelf is not reported as a clash', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(RUN(['cut-7', 'cut-9'])) as any;   // 360 + 96, both well inside one shelf
  expect(r.verdict).toBe('ok');
  expect(r.clashes).toBe(0);
});

test('K3: an ESTIMATED area that is merely tight is not escalated to a hard clash', async ({ page }) => {
  // the owner-approved accuracy model: an estimate may say "might be tight", never a confident failure
  await boot(page, ESTIMATE);
  const r = await page.evaluate(RUN(['cut-1', 'cut-7'])) as any;
  if (r.verdict === 'tight') expect(r.clashes).toBe(0);   // advisory only — the card shows it in orange
  expect(['tight', 'ok', 'over']).toContain(r.verdict);
});
