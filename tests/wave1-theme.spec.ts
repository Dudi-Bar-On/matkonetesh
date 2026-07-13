import { test, expect } from '@playwright/test';

// Wave 1d — theme robustness (UI #1/#2, a11y #2).
// Raised-panel tints + strong ink are now theme-aware tokens, so the charcoal (dark) theme
// stops leaking hard-coded light backgrounds and unreadable dark text.

const cs = (page: any, v: string) =>
  page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('${v}').trim()`);

test('UI #1/#2: tint + ink tokens flip correctly between cream (light) and charcoal (dark)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');

  // default "Warm Cream": warm/cool tints are light, strong ink is dark
  expect(await cs(page, '--tint-warm')).toBe('#fff6ec');
  expect(await cs(page, '--tint-info')).toBe('#e7ecff');
  expect(await cs(page, '--ink-strong')).toBe('#3a2418');
  expect(await cs(page, '--saved-ink')).toBe('#3f7d2f');

  // switch to charcoal: every tint flips dark and the strong ink flips light
  await page.evaluate(`setTheme('charcoal')`);
  expect(await cs(page, '--tint-warm')).toBe('#2c2519');
  expect(await cs(page, '--tint-info')).toBe('#202a44');
  expect(await cs(page, '--tint-warn')).toBe('#3a201c');
  expect(await cs(page, '--ink-strong')).toBe('#f7ecdb'); // light ink on dark bg (was #3a2418, invisible)
  expect(await cs(page, '--saved-ink')).toBe('#8fce76');
});

test('UI #1: a real raised panel resolves its background to the token (not a fixed light hex)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-theme', JSON.stringify('charcoal')); } catch {} });
  await page.goto('/index.html');
  // the home "about" panel used a hard-coded warm gradient; in charcoal it must now be dark
  const bg = await page.evaluate(`(function(){var e=document.querySelector('.chome-about'); if(!e) return ''; return getComputedStyle(e).backgroundImage||getComputedStyle(e).background;})()`) as string;
  // dark charcoal tint (#2c2519 -> rgb(44,37,25)); must NOT contain the old light 255,246,236
  expect(bg).not.toContain('255, 246, 236');
});
