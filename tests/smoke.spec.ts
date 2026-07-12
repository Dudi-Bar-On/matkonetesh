import { test, expect } from '@playwright/test';

// Hygiene: isolate every spec — reset localStorage before each (per project lesson).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});

test('home loads and bottom nav switches screens', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#scr-home')).toBeVisible();

  await page.click('[data-cnav="catalog"]');
  await expect(page.locator('#scr-catalog')).toBeVisible();

  await page.click('[data-cnav="home"]');
  await expect(page.locator('#scr-home')).toBeVisible();
});

test('cut panel renders the sources block', async ({ page }) => {
  await page.goto('/index.html');
  // Open brisket (n=1) via the app's own opener; DATA/openCut are top-level bindings,
  // reachable by bare name inside a string-form evaluate.
  await page.evaluate(`(function(){ var c = DATA.cuts.find(function(x){return x.n===1}); openCut(c); })()`);
  await expect(page.locator('#panel')).toContainText('מקורות ואימות');
  // brisket now carries real citations — Baldwin (safety) + an AmazingRibs link
  await expect(page.locator('#panel')).toContainText('Baldwin');
  expect(await page.locator('#panel a[href*="amazingribs.com"]').count()).toBeGreaterThanOrEqual(1);
});
