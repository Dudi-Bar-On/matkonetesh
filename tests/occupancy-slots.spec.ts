import { test, expect } from '@playwright/test';

// H4: deviceOccupancy assigns each area item to a specific slot (shelf/zone) via a deterministic
// chronological arrival-order packer, so occupancy becomes a claim about slots that exist. Fixes the
// "56%, green" lie for a load where the brisket fits no single shelf.

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceOccupancy==='function'`);
};

// 5-shelf cabinet: 6000 cm² × 0.85 = 5100 usable / 5 = 1020 cm² per shelf. Brisket (1320) fits no shelf.
const CABINET = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5, areaCm2:6000} }];

// build computed[] of area-mode items all on d1, overlapping, and read deviceOccupancy at a shared instant
const occAt = (keys: string[], devId = 'd1', kind = 'smoke') => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'${kind}', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
  var computed=${JSON.stringify(keys)}.map(mk);
  ${JSON.stringify(keys)}.forEach(function(k){ setItemCooker(k,'${kind}','${devId}'); });
  var o=deviceOccupancy('${devId}', t0+2*3600e3, computed, null);
  return {
    slotCount:(o.slots||[]).length, slotKind:o.cap.slotKind, perSlotCm2:o.cap.perSlotCm2,
    slotOver:o.slotOver, unplaced:(o.unplaced||[]).map(function(i){return i.key;}),
    itemSlots:o.items.map(function(i){return {key:i.key, slot:i.slot, cm2:i.cm2};}),
    slots:(o.slots||[]).map(function(s){return {i:s.i, used:s.usedCm2, over:s.over, keys:s.items.map(function(x){return x.key;})};})
  };
})()`;

test('S1: the packer is deterministic — same plan yields identical slot assignment', async ({ page }) => {
  await boot(page, CABINET);
  const a = await page.evaluate(occAt(['cut-1', 'cut-7', 'cut-9', 'cut-10']));
  const b = await page.evaluate(occAt(['cut-1', 'cut-7', 'cut-9', 'cut-10']));
  expect(a).toEqual(b);
});

test('S2: a brisket that fits no single shelf is placed and flagged over (not "56% green")', async ({ page }) => {
  await boot(page, CABINET);
  const r = await page.evaluate(occAt(['cut-1', 'cut-7', 'cut-9', 'cut-10'])) as any;
  expect(r.slotCount).toBe(5);
  expect(r.perSlotCm2).toBe(1020);
  const brisket = r.itemSlots.find((i: any) => i.key === 'cut-1');
  expect(brisket.slot).not.toBeNull();                 // it IS placed (on a shelf), not dropped
  const brisketSlot = r.slots.find((s: any) => s.i === brisket.slot);
  expect(brisketSlot.over).toBe(true);                 // 1320 > 1020 → that shelf is over
  expect(r.slotOver).toBe(true);                       // the device honestly reports "over", not comfortable
});

test('S3: small cuts that fit together share one shelf (side by side)', async ({ page }) => {
  await boot(page, CABINET);
  // cut-7 (360) + cut-9 (96) + cut-10 (150) = 606 ≤ 1020 → they belong on one shelf together
  const r = await page.evaluate(occAt(['cut-7', 'cut-9', 'cut-10'])) as any;
  const sharedSlots = r.slots.filter((s: any) => s.keys.length >= 2);
  expect(sharedSlots.length).toBeGreaterThan(0);       // at least one shelf holds 2+ items
  // and no shelf is over (they genuinely fit)
  expect(r.slotOver).toBe(false);
});

test('S4: an unmeasured item is not placed on a shelf and not counted as unplaced', async ({ page }) => {
  await boot(page, CABINET);
  const mkKey = await page.evaluate(`Object.keys(DATA.makes).find(function(k){ var e=DATA.makes[k].equip; var s=e&&e.spec||{}; return !s.hang && s.footprint_cm2==null; })`);
  const r = await page.evaluate(occAt(['cut-1', 'make-' + mkKey])) as any;
  const make = r.itemSlots.find((i: any) => i.key === 'make-' + mkKey);
  expect(make.cm2).toBeNull();                          // unmeasured (H1)
  expect(make.slot).toBeNull();                         // not assigned a shelf
  expect(r.unplaced).not.toContain('make-' + mkKey);    // "unmeasured" is distinct from "unplaced" (fits nowhere)
});

test('S5: with an unknown cooking area, no shelf assignment is invented', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5, areaCm2:0} }]);
  const r = await page.evaluate(occAt(['cut-1', 'cut-7'])) as any;
  expect(r.perSlotCm2).toBeNull();                      // no area → no per-slot capacity
  r.itemSlots.forEach((i: any) => expect(i.slot).toBeNull());   // nothing placed
});

test('S6: an oven packs items into its racks', async ({ page }) => {
  await boot(page, [{ id:'ov1', cat:'oven', type:'ביתי', name:'תנור', cap:{racks:3, areaCm2:4400} }]);
  const r = await page.evaluate(occAt(['cut-7', 'cut-9', 'cut-10'], 'ov1', 'cook')) as any;
  expect(r.slotCount).toBe(3);
  expect(r.slotKind).toBe('rack');
  const placed = r.itemSlots.filter((i: any) => i.slot !== null);
  expect(placed.length).toBeGreaterThan(0);            // items land on oven racks
});

test('S7: the rendered view names the item that fits no single shelf (not a comfortable %)', async ({ page }) => {
  await boot(page, CABINET);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
    var computed=['cut-1','cut-7','cut-9','cut-10'].map(mk);
    ['cut-1','cut-7','cut-9','cut-10'].forEach(function(k){ setItemCooker(k,'smoke','d1'); });
    var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { warn:(div.querySelector('.occ2-fit-over')||{}).innerText||'', overStyled:!!div.querySelector('.occ2-big'), brisketHeb:resolveItem('cut-1').heb };
  })()`) as any;
  expect(r.warn).toContain(r.brisketHeb);        // the brisket is named as the item that doesn't fit
  expect(r.warn).toMatch(/מדף בודד/);            // "a single shelf"
  expect(r.overStyled).toBe(true);               // the tile reads over, not a comfortable green
});
