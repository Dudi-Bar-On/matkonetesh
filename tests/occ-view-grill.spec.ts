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
const grillRender = (type: string) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var item={ m:resolveItem('cut-9'), stages:[{kind:'cook', start:new Date(t0), end:new Date(t0+1*3600e3), temp:220}] };
  setItemCooker('cut-9','cook','g1');
  var o=deviceOccupancy('g1', t0+30*60e3, [item], null);
  var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
  var g=div.querySelector('.occ2-grill');
  return { round:!!div.querySelector('.occ2-round'), rect:!!div.querySelector('.occ2-rect'),
           zones:div.querySelectorAll('.occ2-zone').length,
           zoneLabel:(div.querySelector('.occ2-zl')||{}).textContent||'',
           facts:(div.querySelector('.occ2-facts')||{}).textContent||'' };
})()`;
test('a kettle grill draws a round body with heat zones labelled אזור', async ({ page }) => {
  await boot(page, [{ id:'g1', cat:'grill', type:'קטל', name:'Weber 67', cap:{zones:2, areaCm2:3600} }]);
  const r = await page.evaluate(grillRender('קטל')) as any;
  expect(r.round).toBe(true);
  expect(r.rect).toBe(false);
  expect(r.zones).toBe(2);
  expect(r.zoneLabel).toContain('אזור');       // NOT "מדף"
  expect(r.facts).toContain('אזורי חום');       // slot label from capHe
});
test('a gas grill draws a rectangular body', async ({ page }) => {
  await boot(page, [{ id:'g1', cat:'grill', type:'גז', name:'גז', cap:{zones:3, areaCm2:4200} }]);
  const r = await page.evaluate(grillRender('גז')) as any;
  expect(r.rect).toBe(true);
  expect(r.round).toBe(false);
  expect(r.zones).toBe(3);
});
