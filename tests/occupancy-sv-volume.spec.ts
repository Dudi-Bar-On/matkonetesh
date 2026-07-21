import { test, expect } from '@playwright/test';

// H2 (refactoring report §3): the sous-vide branch summed each item's min_bath_l (the bath size an item
// REQUIRES) as if it were additive displacement. Two cuts each needing a 24 L bath reported 48 L used of
// 24 L → a false ">100% over" warning (observed live at ~500%). min_bath_l is a per-item CONSTRAINT (the
// bath must be ≥ this), not consumption. Fix: the binding requirement is the LARGEST single item's need;
// with 2+ items the true fill is higher (displacement we don't have), so the % is a floor, not "over".

const boot = async (page: any, litres: number) => {
  await page.addInitScript(([L]: [number]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id: 'sv1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [L] } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [litres]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceOccupancy==='function' && typeof itemOccupancy==='function'`);
};

// build a computed[] of sv-stage items overlapping in one bath, and read deviceOccupancy at a shared instant
const svOcc = (keys: string[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'sv', start:new Date(t0), end:new Date(t0+30*3600e3), temp:68}] }; };
  var computed=${JSON.stringify(keys)}.map(mk);
  ${JSON.stringify(keys)}.forEach(function(k){ setItemCooker(k,'sv','sv1'); });
  var reqs=${JSON.stringify(keys)}.map(function(k){ return itemOccupancy(resolveItem(k),'sv').litres; });
  var o=deviceOccupancy('sv1', t0+2*3600e3, computed, null);
  return { reqs:reqs, usedLitres:o.usedLitres, pct:o.pct, over:o.over, pctFloor:o.pctFloor, itemCount:o.items.length };
})()`;

test('V1: itemOccupancy sv reports the bath REQUIREMENT (min_bath_l), unchanged', async ({ page }) => {
  await boot(page, 24);
  const litres = await page.evaluate(`itemOccupancy(resolveItem('cut-1'),'sv').litres`);
  expect(litres).toBe(24);   // brisket needs a ≥24 L bath
});

test('V2: two items sharing a bath use the MAX requirement, not the SUM (kills the false over)', async ({ page }) => {
  // size the bath to the larger requirement so both fit
  await boot(page, 24);
  const r = await page.evaluate(svOcc(['cut-1', 'cut-2'])) as any;
  const maxReq = Math.max(...r.reqs);
  const sumReq = r.reqs.reduce((a: number, b: number) => a + b, 0);
  expect(r.itemCount).toBe(2);
  expect(r.usedLitres).toBe(maxReq);          // the binding requirement is the largest, not the sum
  expect(r.usedLitres).not.toBe(sumReq);      // explicitly NOT additive (that was the bug)
  expect(r.over).toBe(false);                 // they fit a bath sized to the largest — no false over
  expect(r.pctFloor).toBe(true);              // 2+ items → the % is a floor (displacement unknown)
});

test('V3: an item needing a bigger bath than you own IS flagged over (a real fit failure)', async ({ page }) => {
  await boot(page, 12);   // a 12 L bath, but brisket needs 24
  const r = await page.evaluate(svOcc(['cut-1'])) as any;
  expect(r.usedLitres).toBe(24);
  expect(r.over).toBe(true);                  // 24 L item does not fit a 12 L bath — a genuine over
});

test('V4: a single item that fits is exactly full, not a floor', async ({ page }) => {
  await boot(page, 24);
  const r = await page.evaluate(svOcc(['cut-1'])) as any;
  expect(r.pct).toBe(100);
  expect(r.over).toBe(false);
  expect(r.pctFloor).toBe(false);             // one item → exact, no floor marker
});

test('V5: the rendered bath shows a floor %, not a red over-capacity warning, for a fitting pair', async ({ page }) => {
  await boot(page, 24);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'sv', start:new Date(t0), end:new Date(t0+30*3600e3), temp:68}] }; };
    var computed=['cut-1','cut-2'].map(mk);
    ['cut-1','cut-2'].forEach(function(k){ setItemCooker(k,'sv','sv1'); });
    var o=deviceOccupancy('sv1', t0+2*3600e3, computed, null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    var t=div.innerText; var over=!!div.querySelector('.occ-bar-over');
    return { text:t, hasOverBar:over, barDir:(div.querySelector('.occ-bar span')||{}).getAttribute?div.querySelector('.occ-bar span').getAttribute('dir'):null };
  })()`) as any;
  expect(r.hasOverBar).toBe(false);           // NOT the red over style
  expect(r.text).toMatch(/≥\d+%/);            // a floor marker
  expect(r.barDir).toBe('ltr');               // the % readout stays an LTR island (H1 RTL fix)
});
