import { test, expect } from '@playwright/test';

// Wave 5 — i18n core: per-language dictionaries, t(hebrew), dir/lang switch, non-destructive
// translation (Hebrew restored on switch-back), host-locale seam, and a second language (French).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('t(): Hebrew source by default, translation when a language is set', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`t('יש לי אירוע')`)).toBe('יש לי אירוע');
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`t('יש לי אירוע')`)).toBe('I have an event');
  expect(await page.evaluate(`getLang()`)).toBe('en');
});

test('setLang switches dir/lang, translates chrome, and restores Hebrew on switch-back', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`document.documentElement.lang`)).toBe('en');
  expect(await page.evaluate(`document.documentElement.dir`)).toBe('ltr');
  expect(await page.evaluate(`document.querySelector('[data-i18n="path.project"]').textContent`)).toContain('Advanced project');
  expect(await page.evaluate(`document.querySelector('[data-i18n-html="home.what"]').innerHTML`)).toContain('<b>cooking</b>');
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`document.documentElement.dir`)).toBe('rtl');
  expect(await page.evaluate(`document.querySelector('[data-i18n="path.project"]').textContent`)).toContain('פרויקט מתקדם');   // restored
  expect(await page.evaluate(`document.querySelector('[data-i18n-html="home.what"]').innerHTML`)).toContain('מדליקים');       // restored
});

test('a second language (French) works from the same mechanism', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('fr')`);
  expect(await page.evaluate(`document.querySelector('[data-i18n="path.project"]').textContent`)).toContain('Projet avancé');
  expect(await page.evaluate(`t('בקר')`)).toBe('Bœuf');
});

test('getLang honors a host-provided locale (matkonet module seam)', async ({ page }) => {
  await init(page);
  await page.evaluate(`window.__MATKONET_HOST__={lang:'fr'}`);
  expect(await page.evaluate(`getLang()`)).toBe('fr');   // host overrides stored/default
  await page.evaluate(`delete window.__MATKONET_HOST__`);
  expect(await page.evaluate(`getLang()`)).toBe('he');
});

test('t() falls back to the Hebrew source (or explicit fallback) for unknown strings', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`t('מחרוזת לא מוכרת')`)).toBe('מחרוזת לא מוכרת');
  expect(await page.evaluate(`t('x','fallback')`)).toBe('fallback');
});
