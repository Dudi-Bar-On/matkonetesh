import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function' && typeof deviceSilhouette==='function'`);
};
const MEASURED = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5, areaCm2:12000} }];
const render = (keys: string[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
  var computed=${JSON.stringify(keys)}.map(mk);
  ${JSON.stringify(keys)}.forEach(function(k){ setItemCooker(k,'smoke','d1'); });
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
  return { shelves:div.querySelectorAll('.occ2-shelf').length,
           empties:div.querySelectorAll('.occ2-empty').length,
           listItems:div.querySelectorAll('.occ2-list li').length,
           name:(div.querySelector('.occ2-nm')||{}).textContent||'',
           hasCabinet:!!div.querySelector('.occ2-rack') };
})()`;
test('a cabinet renders one shelf per rack, names empties, and lists items', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(render(['cut-7','cut-9'])) as any;  // two small cuts on a big cabinet
  expect(r.hasCabinet).toBe(true);
  expect(r.shelves).toBe(5);
  expect(r.empties).toBeGreaterThan(0);           // free shelves drawn, not hidden
  expect(r.listItems).toBeGreaterThan(0);         // a11y list present
  expect(r.name).toContain('אביה 150');
});
test('an over item (measured area too small) renders as an over tile + red fit line', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5, areaCm2:6000} }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
    var computed=['cut-1','cut-7'].map(mk);
    ['cut-1','cut-7'].forEach(function(k){ setItemCooker(k,'smoke','d1'); });
    var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { over:!!div.querySelector('.occ2-big'), fitOver:!!div.querySelector('.occ2-fit-over'),
             fitText:(div.querySelector('.occ2-fit-over')||{}).textContent||'' };
  })()`) as any;
  expect(r.over).toBe(true);
  expect(r.fitOver).toBe(true);
  expect(r.fitText).toContain(await page.evaluate(`resolveItem('cut-1').heb`));
});
