import { test, expect } from '@playwright/test';
test('the round-grill class computes to a true circle (equal w/h, 50% radius)', async ({ page }) => {
  await page.goto('/index.html');
  const r = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'occ2-grill occ2-round';
    el.style.width = '216px';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const out = { w: Math.round(rect.width), h: Math.round(rect.height), radius: cs.borderRadius };
    el.remove();
    return out;
  });
  expect(r.w).toBe(r.h);                 // a circle: width === height
  expect(r.radius).toMatch(/50%|108px/); // border-radius:50% (or its resolved px)
});
test('the over token resolves (theme tokens present)', async ({ page }) => {
  await page.goto('/index.html');
  const over = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--over').trim());
  expect(over.length).toBeGreaterThan(0);
});
// The real themes are the JS THEMES object (applied as inline styles on <html>), not CSS class blocks.
// So the diagram tokens must live in EVERY theme — a dark theme must not fall back to the light --over.
test('diagram tokens are themed per theme (dark charcoal differs from light cream)', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(`typeof setTheme==='function' && typeof THEMES!=='undefined'`);
  const read = async () => await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string) => cs.getPropertyValue(n).trim();
    return { over:g('--over'), overL:g('--over-l'), grate:g('--grate'), cool:g('--cool'), cooll:g('--cooll') };
  });
  await page.evaluate(`setTheme('cream')`);   const cream = await read();
  await page.evaluate(`setTheme('charcoal')`); const dark = await read();
  await page.evaluate(`setTheme('cream')`);   // restore
  // every diagram token is defined in both themes...
  for (const k of ['over','overL','grate','cool','cooll'] as const) {
    expect(cream[k].length, `cream --${k}`).toBeGreaterThan(0);
    expect(dark[k].length, `charcoal --${k}`).toBeGreaterThan(0);
  }
  // ...and the dark theme is NOT just inheriting the light values (proves it's themed, not a fallback)
  expect(dark.over).not.toBe(cream.over);
  expect(dark.cooll).not.toBe(cream.cooll);
});
