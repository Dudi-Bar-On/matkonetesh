import { test, expect } from '@playwright/test';

// Wave 4 UX batch 2 — More-sheet regroup (UX #10) + collapsed timeline shape controls (UX #7).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('UX #10: the More sheet is grouped into noun sections, all tools still reachable', async ({ page }) => {
  await init(page);
  await page.evaluate(`openTools()`);
  await page.waitForSelector('.toolgroup');
  const groups = await page.evaluate(`[...document.querySelectorAll('.toolgroup-h')].map(h=>h.textContent)`) as string[];
  expect(groups.length).toBe(4);
  expect(groups).toContain('תכנון ובישול');
  const idxs = await page.evaluate(`[...document.querySelectorAll('.toolbtn[data-tool]')].map(b=>+b.dataset.tool)`) as number[];
  expect(idxs.length).toBe(15);              // all 15 tools present
  expect(new Set(idxs).size).toBe(15);       // indices unique — no flat.indexOf collision
});

test('UX #7: timeline shape controls are collapsed into a details toggle (default closed, still switchable)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlview','plan'); setTlShape('1');
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0}); })()`);
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#tlList .tl-shapedet');
  expect(await page.evaluate(`document.querySelector('#tlList .tl-shapedet').open`)).toBe(false);   // collapsed by default
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-shapedet [data-tlshape]').length`)).toBeGreaterThan(1);   // shapes still available inside
  expect(await page.evaluate(`document.querySelector('#tlList .tl-shapedet summary').textContent`)).toContain('תצוגה');
});
