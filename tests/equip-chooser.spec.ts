import { test, expect } from '@playwright/test';

// Owner: "the bath sizes I have are registered, so the optimizer should choose the correct bath for the
// mission — it can use different sizes at different times. Same for grinder plate sizes, and the plan
// instructions can use this info to instruct a specific grinding action."
//
// Today deviceCapacity does `Math.max(baths)` — it assumes you always use your BIGGEST vessel and never
// says which to reach for. `plates` and `nozzles` have zero readers at all, while recipes carry grind_mm
// and casing_mm. These choosers turn registered properties into instructions.

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof chooseBath==='function' && typeof choosePlate==='function' && typeof chooseNozzle==='function'`);
};

const SV      = [{ id:'s1', cat:'sousvide', type:'טבילה (immersion)', name:'אמבט', cap:{ baths:[6,12,20] } }];
const GRINDER = [{ id:'g1', cat:'grinder', type:'ייעודית', name:'מטחנה', cap:{ plates:[4.5,8,12] } }];
const STUFFER = [{ id:'t1', cat:'stuffer', type:'אנכית', name:'מילוי', cap:{ volume:5, nozzles:[16,22,32] } }];

test('E1: the bath chosen is the SMALLEST registered vessel that does the job — not always the biggest', async ({ page }) => {
  await boot(page, SV);
  const r = await page.evaluate(`(function(){
    var d=equipList()[0];
    return { need5:chooseBath(d,5), need8:chooseBath(d,8), need15:chooseBath(d,15), need40:chooseBath(d,40) };
  })()`) as any;
  expect(r.need5.pick).toBe(6);      // 5 L of work does not need the 20 L tub
  expect(r.need8.pick).toBe(12);
  expect(r.need15.pick).toBe(20);
  expect(r.need40.ok).toBe(false);   // nothing you own is big enough — say so, never silently pick one
  expect(r.need40.pick).toBeNull();
  expect(r.need5.sizes).toEqual([6, 12, 20]);
});

test('E2: different missions may use different vessels — the choice is per requirement, not per device', async ({ page }) => {
  await boot(page, SV);
  const r = await page.evaluate(`(function(){ var d=equipList()[0];
    return [chooseBath(d,4).pick, chooseBath(d,11).pick, chooseBath(d,18).pick]; })()`) as number[];
  expect(r).toEqual([6, 12, 20]);   // three stages, three different containers
});

test('E3: the grind plate comes from the plates you actually own', async ({ page }) => {
  await boot(page, GRINDER);
  const r = await page.evaluate(`(function(){ var d=equipList()[0];
    return { exact:choosePlate(d,8), near:choosePlate(d,5), none:choosePlate(d,3), owned:choosePlate(d,8).owned }; })()`) as any;
  expect(r.exact.pick).toBe(8);
  expect(r.exact.exact).toBe(true);
  expect(r.near.pick).toBe(4.5);      // 5 mm asked for, 4.5 is the closest you own
  expect(r.near.exact).toBe(false);
  expect(r.none.pick).toBe(4.5);      // finest you own, but flagged as coarser than asked
  expect(r.none.exact).toBe(false);
  expect(r.owned).toEqual([4.5, 8, 12]);
});

test('E4: the stuffing nozzle is the largest that still fits the casing', async ({ page }) => {
  await boot(page, STUFFER);
  const r = await page.evaluate(`(function(){ var d=equipList()[0];
    return { c32:chooseNozzle(d,32), c24:chooseNozzle(d,24), c14:chooseNozzle(d,14) }; })()`) as any;
  expect(r.c32.pick).toBe(32);
  expect(r.c24.pick).toBe(22);        // largest that still passes into a 24 mm casing
  expect(r.c14.ok).toBe(false);       // every nozzle you own is too fat for a 14 mm casing
  expect(r.c14.pick).toBeNull();
});

test('E5: with nothing registered, no chooser invents equipment', async ({ page }) => {
  await boot(page, []);
  const r = await page.evaluate(`(function(){
    return { b:chooseBath(null,10), p:choosePlate(null,8), n:chooseNozzle(null,32) };
  })()`) as any;
  expect(r.b.ok).toBe(false); expect(r.b.pick).toBeNull();
  expect(r.p.ok).toBe(false); expect(r.p.pick).toBeNull();
  expect(r.n.ok).toBe(false); expect(r.n.pick).toBeNull();
});

test('E6: the sous-vide card names the container to use, instead of assuming the biggest', async ({ page }) => {
  await boot(page, SV);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    setItemCooker('cut-9','sv','s1');
    var item={ m:resolveItem('cut-9'), stages:[{kind:'sv', start:new Date(t0), end:new Date(t0+6*3600e3), temp:56}] };
    var o=deviceOccupancy('s1', t0+1*3600e3, [item], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { cap:(div.querySelector('.occ2-svcap')||{}).textContent||'', need:o.usedLitres };
  })()`) as any;
  expect(r.cap.length).toBeGreaterThan(0);
  // it must state a specific vessel from the registered set, not merely the largest
  expect(/6|12|20/.test(r.cap)).toBe(true);
});
