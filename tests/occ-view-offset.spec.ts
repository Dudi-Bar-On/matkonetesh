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
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
test('an offset smoker draws a barrel with a firebox and grate rows', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'אופסט / סטיק-ברנר', name:'אופסט', cap:{racks:2, areaCm2:9000} }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('cut-7'), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:110}] };
    setItemCooker('cut-7','smoke','d1');
    var o=deviceOccupancy('d1', t0+1*3600e3, [item], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { barrel:!!div.querySelector('.occ2-barrel'), firebox:!!div.querySelector('.occ2-firebox'),
             grates:div.querySelectorAll('.occ2-grate').length, noRack:!div.querySelector('.occ2-rack') };
  })()`) as any;
  expect(r.barrel).toBe(true);
  expect(r.firebox).toBe(true);
  expect(r.grates).toBe(2);       // one grate row per rack
  expect(r.noRack).toBe(true);    // NOT the cabinet fallback anymore
});
