import { test, expect } from '@playwright/test';

// Wave 5 — i18n foundation: the t() chrome seam, pluggable getLang() provider, and DOM translation.
// (Chrome only — no machine translation of recipe/safety data, which stays gated behind the T1 guard.)

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('t() returns Hebrew by default and English when the language is set', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`t('path.event')`)).toBe('יש לי אירוע');
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`t('path.event')`)).toBe('I have an event');
  expect(await page.evaluate(`getLang()`)).toBe('en');
});

test('switching language sets html dir/lang and translates tagged chrome', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`document.documentElement.lang`)).toBe('en');
  expect(await page.evaluate(`document.documentElement.dir`)).toBe('ltr');
  expect(await page.evaluate(`document.documentElement.classList.contains('lang-en')`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('[data-i18n="path.event"]').textContent`)).toBe('I have an event');
  expect(await page.evaluate(`document.querySelector('#cHomeSearchInput').getAttribute('placeholder')`)).toContain('Search');
  expect(await page.evaluate(`document.querySelector('[data-i18n-html="home.what"]').innerHTML`)).toContain('<b>cooking</b>');   // inline markup preserved
  // back to Hebrew, RTL restored
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`document.documentElement.dir`)).toBe('rtl');
  expect(await page.evaluate(`document.querySelector('[data-i18n="path.event"]').textContent`)).toBe('יש לי אירוע');
});

test('getLang honors a host-provided locale (matkonet module seam)', async ({ page }) => {
  await init(page);
  await page.evaluate(`window.__MATKONET_HOST__={lang:'en'}`);
  expect(await page.evaluate(`getLang()`)).toBe('en');   // host overrides stored/default
  await page.evaluate(`delete window.__MATKONET_HOST__`);
  expect(await page.evaluate(`getLang()`)).toBe('he');
});

test('t() falls back to the key (or an explicit fallback) for unknown chrome keys', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`t('nonexistent.key')`)).toBe('nonexistent.key');
  expect(await page.evaluate(`t('nonexistent.key','Fallback')`)).toBe('Fallback');
});
