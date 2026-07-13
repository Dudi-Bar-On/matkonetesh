import { test, expect } from '@playwright/test';

// Wave 2a — foundations (perf + PWA/offline).

test('perf #2: DATA still loads fully via JSON.parse (single-quote wrapping is intact)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  const c = await page.evaluate(`({cuts:DATA.cuts.length, specials:DATA.specials.length, makes:Object.keys(DATA.makes).length, seasonings:DATA.seasonings.length})`) as any;
  expect(c.cuts).toBe(130);
  expect(c.specials).toBe(47);
  expect(c.makes).toBe(102);
  expect(c.seasonings).toBeGreaterThan(290);
  // a value with an apostrophe/geresh round-trips (guards the single-quote escaping)
  expect(await page.evaluate(`typeof DATA.cuts[0].heb`)).toBe('string');
});

test('PWA: service worker + _headers are emitted, and theme-color tracks the active theme', async ({ page, request }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');

  const tc = () => page.evaluate(`document.querySelector('meta[name="theme-color"]').getAttribute('content')`) as Promise<string>;
  expect((await tc()).toLowerCase()).toBe('#fdf6ec');           // cream base (was stale #16110d)
  await page.evaluate(`setTheme('charcoal')`);
  expect((await tc()).toLowerCase()).toBe('#17150f');           // follows the theme

  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toContain("const CACHE='mk-");        // version-keyed precache shell

  const hd = await request.get('/_headers');
  expect(hd.status()).toBe(200);
  expect(await hd.text()).toContain('/index.html');
});
