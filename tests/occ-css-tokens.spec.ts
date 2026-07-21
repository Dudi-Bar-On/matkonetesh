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
