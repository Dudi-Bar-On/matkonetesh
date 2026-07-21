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
test('a hanging device draws a bay with lit hooks and keeps the shelves below empty', async ({ page }) => {
  // Find a hangable make (salami-type) so itemOccupancy returns mode:'hang'.
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון תלייה', cap:{racks:3, areaCm2:9000, canHang:true, hooks:8} }]);
  const r = await page.evaluate(`(function(){
    var hangKey=Object.keys(DATA.makes).find(function(k){ var e=DATA.makes[k].equip; var s=e&&e.spec||{}; return !!s.hang; });
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('make-'+hangKey), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+10*3600e3), temp:75}] };
    setItemCooker('make-'+hangKey,'smoke','d1');
    var o=deviceOccupancy('d1', t0+2*3600e3, [item], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { bay:!!div.querySelector('.occ2-bay'), hung:div.querySelectorAll('.occ2-hung').length,
             litHooks:div.querySelectorAll('.occ2-hooks span:not(.occ2-off)').length,
             emptyShelves:div.querySelectorAll('.occ2-empty').length };
  })()`) as any;
  expect(r.bay).toBe(true);
  expect(r.hung).toBeGreaterThan(0);
  expect(r.litHooks).toBeGreaterThan(0);
  expect(r.emptyShelves).toBe(3);   // all 3 shelves stay empty — hanging frees grate area (H3)
});

test('the bay itself reads over when there are more hung items than hooks', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:3, areaCm2:9000, canHang:true, hooks:1} }]);
  const r = await page.evaluate(`(function(){
    var hung=Object.keys(DATA.makes).filter(function(k){ var e=DATA.makes[k].equip; return e&&e.spec&&e.spec.hang; }).slice(0,2);
    var t0=Date.parse('2026-07-24T06:00:00');
    hung.forEach(function(k){ setItemCooker('make-'+k,'smoke','d1'); });
    var computed=hung.map(function(k){ return { m:resolveItem('make-'+k), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:75}] }; });
    var o=deviceOccupancy('d1', t0+1*3600e3, computed, null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { hooksOver:o.hooksOver, bayOver:!!div.querySelector('.occ2-bay-over') };
  })()`) as any;
  expect(r.hooksOver).toBe(true);
  expect(r.bayOver).toBe(true);   // the bay, not only the fit line, shows the overflow
});
