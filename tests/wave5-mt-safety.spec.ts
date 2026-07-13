import { test, expect } from '@playwright/test';

// Wave 5 — T1 numeric-invariant guard: machine translation of recipe prose is accepted only if it
// preserves every number; a number-mangling translation is rejected to the safe Hebrew source.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('T1 guard: mtSafe requires an exact number multiset match', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`mtSafe('עשן ל-95 מעלות פנים, 24 שעות', 'Smoke to 95°C internal, 24 hours')`)).toBe(true);   // numbers preserved
  expect(await page.evaluate(`mtSafe('עשן ל-95 מעלות', 'Smoke it through')`)).toBe(false);                                   // number dropped
  expect(await page.evaluate(`mtSafe('ריפוי Cure #1 ב-2.5 גרם', 'Cure #1 at 25 grams')`)).toBe(false);                        // 2.5 → 25: the dangerous case, caught
  expect(await page.evaluate(`mtSafe('1,5 ק״ג', '1.5 kg')`)).toBe(true);                                                     // comma/dot normalized
});

test('T1 mtTranslate: he passthrough, guarded caching, and rejection of a number-losing MT', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`(async()=>await mtTranslate('בדיקה','he'))()`)).toBe('בדיקה');   // same language → passthrough
  const good = await page.evaluate(`(async function(){ window.__mtMock=function(){ return 'Smoke to 95 degrees, 24 hours'; }; return await mtTranslate('עשן ל-95 מעלות, 24 שעות','en'); })()`) as string;
  expect(good).toContain('95');
  expect(good).toContain('Smoke');
  // it was cached (guarded), so a second call returns the same even with the mock removed
  const cached = await page.evaluate(`(async function(){ window.__mtMock=null; return await mtTranslate('עשן ל-95 מעלות, 24 שעות','en'); })()`) as string;
  expect(cached).toBe(good);
  // a number-losing MT is rejected → the Hebrew source is returned (and NOT cached)
  const bad = await page.evaluate(`(async function(){ window.__mtMock=function(){ return 'Smoke it for a while'; }; return await mtTranslate('חמם ל-77 מעלות פנים','en'); })()`) as string;
  expect(bad).toBe('חמם ל-77 מעלות פנים');
});
