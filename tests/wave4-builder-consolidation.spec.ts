import { test, expect } from '@playwright/test';

// Wave 4 UX #3 — one builder: the guided wizard. The legacy openMenu panel is retired as an entry
// point, its preset quick-starts moved into the wizard picker, and the in-wizard jump button removed.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('UX #3: openBuilder routes the "build menu" entry into the wizard picker step', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('event'); openBuilder(); })()`);
  expect(await page.evaluate(`cWiz.step`)).toBe(1);                       // landed on the picker step
  expect(await page.evaluate(`!!document.querySelector('#scr-wizard.on')`)).toBe(true);   // wizard is the active screen
});

test('UX #3: the in-wizard jump-to-legacy-panel button is gone', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`!!document.querySelector('#cwOpenMenu')`)).toBe(false);
});

test('UX #3: the wizard picker shows preset quick-starts, and applying one fills the menu', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('event'); const m=menuState(); m.keys=[]; saveMenu(m); cwGo(1); cNavGo('wizard'); cwPaintPicker(); })()`);
  await page.waitForSelector('#cwPickList [data-cwpreset]');
  const before = await page.evaluate(`(menuState().keys||[]).length`);
  await page.evaluate(`document.querySelector('#cwPickList [data-cwpreset="מנגל מעורב"]').click()`);
  const after = await page.evaluate(`(menuState().keys||[]).length`);
  expect(before).toBe(0);
  expect(after).toBeGreaterThan(0);   // the preset seeded a menu inside the wizard
});

test('UX #3: presets hide once the picker is filtered (only shown in the full list)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('event'); cwGo(1); cNavGo('wizard'); cwPaintPicker(); })()`);
  await page.waitForSelector('#cwPickList [data-cwpreset]');   // visible unfiltered
  await page.evaluate(`(function(){ cwQuery='בריסקט'; cwPaintPickList(); })()`);
  expect(await page.evaluate(`!!document.querySelector('#cwPickList [data-cwpreset]')`)).toBe(false);   // hidden when searching
});
