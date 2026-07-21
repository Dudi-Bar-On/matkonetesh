import { test, expect } from '@playwright/test';

// SAFETY (audit): cookerCandidates filters by CATEGORY only — it never asks whether a cooker can actually
// reach the temperature a cut needs. An electric smoker tops out at 135 °C; a 160 °C stage assigned to it is
// thermally impossible and went completely unflagged. maxC already exists on every device (with per-type
// class defaults) and was read by nothing that matters.

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceCanReach==='function' && typeof schedulePlacements==='function'`);
};

const ELECTRIC = [{ id:'d1', cat:'smoker', type:'חשמלי', name:'חשמלי', cap:{ racks:4, areaCm2:9000 } }];        // maxC default 135
const KAMADO   = [{ id:'d1', cat:'smoker', type:'קמאדו / קרמי', name:'קמאדו', cap:{ racks:2, areaCm2:4000 } }];  // maxC default 350

const RUN = (temp: number) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  setItemCooker('cut-7','smoke','d1');
  var computed=[{ m:resolveItem('cut-7'), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+4*3600e3), temp:${temp}}] }];
  var res=schedulePlacements(computed, null);
  var ceil=res.conflicts.filter(function(c){return c.reason==='temp-ceiling';});
  var div=document.createElement('div'); div.innerHTML=_schedAdviceHtml(res.conflicts, computed);
  return { ceilings:ceil.length, first:ceil[0]||null, adviceText:div.textContent||'' };
})()`;

test('T1: deviceCanReach reports the device ceiling honestly', async ({ page }) => {
  await boot(page, ELECTRIC);
  const r = await page.evaluate(`(function(){
    var d=equipList()[0];
    return { at160:deviceCanReach(d,160), at110:deviceCanReach(d,110), atNull:deviceCanReach(d,null) };
  })()`) as any;
  expect(r.at160.ok).toBe(false);       // 160 °C on a 135 °C electric smoker is impossible
  expect(r.at160.maxC).toBe(135);
  expect(r.at110.ok).toBe(true);
  expect(r.atNull.ok).toBe(true);       // no temperature stated → nothing to judge, never a false alarm
});

test('T2: a stage hotter than the cooker can reach is flagged, naming the cut and the ceiling', async ({ page }) => {
  await boot(page, ELECTRIC);
  const r = await page.evaluate(RUN(160)) as any;
  expect(r.ceilings).toBe(1);
  expect(r.first.maxC).toBe(135);
  expect(r.first.tempC).toBe(160);
  expect(r.adviceText).toContain('135');    // the advisory states the actual ceiling
  expect(r.adviceText).toContain('160');    // ...and what was asked of it
});

test('T3: within the ceiling there is no warning — and a hotter cooker takes the same stage happily', async ({ page }) => {
  await boot(page, ELECTRIC);
  expect(((await page.evaluate(RUN(110))) as any).ceilings).toBe(0);
  await boot(page, KAMADO);
  expect(((await page.evaluate(RUN(160))) as any).ceilings).toBe(0);   // kamado reaches 350
});

test('T4: a user-entered maxC overrides the class default', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'קמאדו / קרמי', name:'קמאדו', cap:{ racks:2, areaCm2:4000, maxC:120 } }]);
  const r = await page.evaluate(RUN(160)) as any;
  expect(r.ceilings).toBe(1);
  expect(r.first.maxC).toBe(120);   // the owner's own number wins over the 350 default
});
