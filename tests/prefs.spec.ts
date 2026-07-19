import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof pref==='function' && typeof setPref==='function'`);
};

test('P1: pref() returns the default for absent and invalid values; setPref validates', async ({ page }) => {
  await boot(page);
  // absent → default
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  expect(await page.evaluate(`pref('autonomy')`)).toBe('advise');
  expect(await page.evaluate(`pref('theme')`)).toBe('cream');
  expect(await page.evaluate(`pref('uiLevel')`)).toBe('mid');
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1);
  expect(await page.evaluate(`pref('tlShape')`)).toBe(null);
  // invalid stored value → default (never the garbage)
  await page.evaluate(`store.set('mk-pref-units','furlongs'); store.set('mk-theme','neon'); store.set('mk-fontscale',99)`);
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  expect(await page.evaluate(`pref('theme')`)).toBe('cream');
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1);
  // setPref accepts valid, rejects invalid, and persists
  expect(await page.evaluate(`setPref('units','imperial')`)).toBe(true);
  expect(await page.evaluate(`pref('units')`)).toBe('imperial');
  expect(await page.evaluate(`setPref('units','stones')`)).toBe(false);
  expect(await page.evaluate(`pref('units')`)).toBe('imperial');       // unchanged by the rejected write
  expect(await page.evaluate(`setPref('nope','x')`)).toBe(false);      // unknown key
  // numeric coercion parity with the old fontScale()
  expect(await page.evaluate(`setPref('fontScale',1.15)`)).toBe(true);
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1.15);
});
