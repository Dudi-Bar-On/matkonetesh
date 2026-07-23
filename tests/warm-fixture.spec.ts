import { test, expect, seedApp } from './_fixtures';

// Contract spec for the warm-page architecture (docs/research/warm-page-architecture-research.md as
// amended by W0). Serial on purpose: A then B MUST land on the same worker and the same warm page —
// the reuse+reset contract is exactly what is under test here.
test.describe.configure({ mode: 'serial' });

test('A: seeds its own state onto the warm page and leaves a JS-heap marker', async ({ warm: page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-warm-proof-a': '"A"' });
  expect(await page.evaluate(`localStorage.getItem('mk-warm-proof-a')`)).toBe('"A"');
  expect(await page.evaluate(`typeof DATA !== 'undefined'`)).toBe(true);   // the app actually booted at DCL
  await page.evaluate(`window.__warmHeapMarker = 'set-by-A'`);
  expect(await page.evaluate(`window.__warmHeapMarker`)).toBe('set-by-A');
});

test('B: same worker, same page — A\'s storage and heap are GONE after the standard reset', async ({ warm: page }) => {
  // The very same Page object crossed tests (reuse), yet nothing of A survives (reset):
  expect((page as any).__mkWarmServed).toBeGreaterThanOrEqual(2);
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-warm-proof-b': '"B"' });
  expect(await page.evaluate(`localStorage.getItem('mk-warm-proof-a')`)).toBeNull();      // storage isolation
  expect(await page.evaluate(`localStorage.getItem('mk-warm-proof-b')`)).toBe('"B"');
  expect(await page.evaluate(`typeof window.__warmHeapMarker`)).toBe('undefined');        // fresh JS heap (reload re-runs the app from zero)
});

test('the warm page traps addInitScript with a migration hint', async ({ warm: page }) => {
  expect(() => (page as any).addInitScript(() => {})).toThrow(/seedApp|isolatedPage/);
});

test('isolatedPage: fresh classic context — storage not shared, addInitScript allowed', async ({ warm, isolatedPage }) => {
  await seedApp(warm, { 'mk-uilevel-asked': 'true', 'mk-warm-proof-x': '"X"' });
  await isolatedPage.addInitScript(() => { try { localStorage.setItem('mk-iso-proof', '"I"'); } catch {} });   // must NOT throw
  await isolatedPage.goto('/index.html');
  expect(await isolatedPage.evaluate(`localStorage.getItem('mk-warm-proof-x')`)).toBeNull();   // separate storage
  expect(await isolatedPage.evaluate(`localStorage.getItem('mk-iso-proof')`)).toBe('"I"');     // classic seeding path intact
});
