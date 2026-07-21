import { test, expect } from '@playwright/test';

// H4 (owner request): an oven is a rack-based cooking device like a cabinet smoker, so it belongs in the
// occupancy model. It needs (1) an areaCm2 property with per-type class defaults (it never got one in
// Phase 0) and (2) inclusion in the occupancy view's device set (which covered only smoker/grill/sousvide).

const boot = async (page: any, kit: any[] = []) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    if (k.length) { localStorage.setItem('mk-equipment', JSON.stringify(k)); localStorage.setItem('mk-equip-set', JSON.stringify(true)); }
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof propOf==='function' && Array.isArray(EQUIP_CATS) && typeof deviceOccupancy==='function'`);
};

test('OV1: every oven type has a usable areaCm2 class default (build gate)', async ({ page }) => {
  await boot(page);
  const missing = await page.evaluate(`(function(){
    var c=EQUIP_CATS.find(function(x){return x.cat==='oven';});
    var p=(c.props||[]).find(function(x){return x.key==='areaCm2';});
    if(!p) return ['oven: no areaCm2 prop'];
    var out=[];
    (c.types||[]).forEach(function(tp){ var v=propDef('oven','areaCm2',tp); if(typeof v!=='number'||!(v>0)) out.push('oven/'+tp+' -> '+v); });
    return out;
  })()`) as string[];
  expect(missing, `oven types with no usable areaCm2 default: ${missing.join(' | ')}`).toEqual([]);
});

test('OV2: deviceCapacity reads an oven as a rack-based area device', async ({ page }) => {
  await boot(page, [{ id: 'ov1', cat: 'oven', type: 'ביתי', name: 'תנור ביתי', cap: { racks: 3, areaCm2: 4400 } }]);
  const c = await page.evaluate(`deviceCapacity(equipByCat('oven')[0])`) as any;
  expect(c.mode).toBe('area');
  expect(c.areaCm2).toBe(4400);
  expect(c.racks).toBe(3);
  expect(c.known).toBe(true);
});

test('OV3: an oven appears in the occupancy view device set (was smoker/grill/sousvide only)', async ({ page }) => {
  await boot(page, [{ id: 'ov1', cat: 'oven', type: 'ביתי', name: 'תנור ביתי', cap: { racks: 3, areaCm2: 4400 } }]);
  // deviceOccupancy resolves an oven, and occupancyViewHtml renders it (an item on the oven)
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('cut-1'), stages:[{kind:'cook', start:new Date(t0), end:new Date(t0+4*3600e3), temp:120}] };
    setItemCooker('cut-1','cook','ov1');
    var html=occupancyViewHtml([item], t0+1*3600e3, null);
    var o=deviceOccupancy('ov1', t0+1*3600e3, [item], null);
    return { viewHasOven: html.indexOf('תנור ביתי')>=0, devName:o.devName, mode:o.mode };
  })()`) as any;
  expect(r.viewHasOven).toBe(true);
  expect(r.devName).toBe('תנור ביתי');
  expect(r.mode).toBe('area');
});
