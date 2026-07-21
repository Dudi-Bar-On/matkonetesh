import { test, expect } from '@playwright/test';

// H3 (refactoring report §3): hanging was inert from BOTH ends. (1) itemOccupancy gated on
// equipOwnsToken('hooks') — a separate accessory — so a cabinet smoker declaring canHang:true/hooks:8
// never enabled hanging. (2) deviceOccupancy.hooksOver was computed but read by nothing, so exceeding
// the hook count never warned. Fix: hanging is driven by the DEVICE's own canHang+hooks, and hooksOver
// both computes AND renders: the Phase 2 diagram (T5-T9) shows the hanging channel as `.occ2-bay` and
// surfaces hook overflow as a red `.occ2-fit-over` line (restored in T9 — the T5 rewrite had briefly
// dropped the old `.occ-warn`, which would have let a hook overflow read as a false "✓ everything fits").

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof itemOccupancy==='function' && typeof deviceCanHang==='function'`);
};

const CABINET_WITH_HOOKS = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:4, areaCm2:6000, canHang:true, hooks:8} }];
const CABINET_NO_HOOKS  = [{ id:'d1', cat:'smoker', type:'קטל (ככלי עישון)', name:'קטל', cap:{racks:1, areaCm2:2400, canHang:false} }];

// a make that hangs (spec.hang), discovered at runtime
const hungMakeKey = `Object.keys(DATA.makes).find(function(k){ var e=DATA.makes[k].equip; return e && e.spec && e.spec.hang; })`;

test('H3a: a cabinet with its OWN canHang+hooks hangs a hangable item — no accessory needed', async ({ page }) => {
  await boot(page, CABINET_WITH_HOOKS);
  const r = await page.evaluate(`(function(){
    var k=${hungMakeKey}; var m=resolveItem('make-'+k); var dev=equipByCat('smoker')[0];
    return { deviceCanHang:deviceCanHang(dev), occ:itemOccupancy(m,'smoke',dev) };
  })()`) as any;
  expect(r.deviceCanHang).toBe(true);
  expect(r.occ.mode).toBe('hang');
  expect(r.occ.hooks).toBe(1);
  expect(r.occ.cm2).toBe(0);        // hanging frees grate area entirely
});

test('H3b: on a device that CANNOT hang, the same item falls back to grate area', async ({ page }) => {
  await boot(page, CABINET_NO_HOOKS);
  const r = await page.evaluate(`(function(){
    var k=${hungMakeKey}; var m=resolveItem('make-'+k); var dev=equipByCat('smoker')[0];
    return { deviceCanHang:deviceCanHang(dev), occ:itemOccupancy(m,'smoke',dev) };
  })()`) as any;
  expect(r.deviceCanHang).toBe(false);
  expect(r.occ.mode).toBe('area');   // no hooks on this device → it rests on the grate
});

test('H3c: deviceOccupancy hangs items on a hanging-capable device and frees the grate', async ({ page }) => {
  await boot(page, CABINET_WITH_HOOKS);
  const r = await page.evaluate(`(function(){
    var k=${hungMakeKey};
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('make-'+k), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:75}] };
    setItemCooker('make-'+k,'smoke','d1');
    var o=deviceOccupancy('d1', t0+1*3600e3, [item], null);
    return { hooksUsed:o.hooksUsed, usedCm2:o.usedCm2 };
  })()`) as any;
  expect(r.hooksUsed).toBe(1);
  expect(r.usedCm2).toBe(0);         // hung → no grate area consumed
});

test('H3d: exceeding the hook count is flagged in the model AND surfaces as a red over-warning naming the overflow (no false green)', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:4, areaCm2:6000, canHang:true, hooks:1} }]);
  const r = await page.evaluate(`(function(){
    var hung=Object.keys(DATA.makes).filter(function(k){ var e=DATA.makes[k].equip; return e && e.spec && e.spec.hang; }).slice(0,2);
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(k){ return { m:resolveItem('make-'+k), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:75}] }; };
    hung.forEach(function(k){ setItemCooker('make-'+k,'smoke','d1'); });
    var o=deviceOccupancy('d1', t0+1*3600e3, hung.map(mk), null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { hooksOver:o.hooksOver, hooksUsed:o.hooksUsed,
             bay:!!div.querySelector('.occ2-bay'), hungTags:div.querySelectorAll('.occ2-hung').length,
             emptyShelves:div.querySelectorAll('.occ2-empty').length,
             fitOver:!!div.querySelector('.occ2-fit-over'),
             fitText:(div.querySelector('.occ2-fit-over')||{}).textContent||'',
             fitOk:!!div.querySelector('.occ2-fit-ok') };
  })()`) as any;
  expect(r.hooksOver).toBe(true);      // model flags the overflow (H3 intent preserved at the data layer)
  expect(r.hooksUsed).toBe(2);
  expect(r.bay).toBe(true);            // the hanging channel renders (Phase 2 T9) — H3 intent: hanging has its own visible bay
  expect(r.hungTags).toBe(2);          // both hung items are shown even though only 1 hook exists
  expect(r.emptyShelves).toBe(4);      // shelves stay empty regardless — hanging never falls back to the grate (H3)
  // hook overflow now surfaces as a red fit line (the T5 rewrite had dropped the old view's hooks warning —
  // restored so the device can never read a false "✓ everything fits" while items have nowhere to hang).
  expect(r.fitOver).toBe(true);
  expect(r.fitOk).toBe(false);         // NOT a false green
  expect(r.fitText).toContain('2/1');  // the hooks readout (used/total) as an LTR island
});
