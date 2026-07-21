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
test('a sous-vide draws a vessel with a bag per item and NO percentage', async ({ page }) => {
  await boot(page, [{ id:'s1', cat:'sousvide', type:'טבילה (immersion)', name:'אמבט', cap:{baths:[12]} }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var a={ m:resolveItem('cut-9'), stages:[{kind:'sv', start:new Date(t0), end:new Date(t0+6*3600e3), temp:56}] };
    setItemCooker('cut-9','sv','s1');
    var o=deviceOccupancy('s1', t0+1*3600e3, [a], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { vessel:!!div.querySelector('.occ2-vessel'), bags:div.querySelectorAll('.occ2-bag').length,
             cap:(div.querySelector('.occ2-svcap')||{}).textContent||'',
             hasPct:/%/.test(div.textContent||''), noList:!div.querySelector('.occ2-list') };
  })()`) as any;
  expect(r.vessel).toBe(true);
  expect(r.bags).toBeGreaterThan(0);
  expect(r.hasPct).toBe(false);       // sous-vide never shows a % (H2)
  expect(r.cap.length).toBeGreaterThan(0);
  expect(r.noList).toBe(true);        // the shelf a11y list is for area devices only
});
