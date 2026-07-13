import { test, expect } from '@playwright/test';

// Wave 5 batch 2 — expanded chrome coverage (wizard) + showPanel auto-translation hook.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('i18n coverage: wizard step buttons + review CTAs translate to English', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`document.querySelector('[data-cwgo="1"]').textContent`)).toContain('Next');
  expect(await page.evaluate(`document.querySelector('[data-cwgo="5"]').textContent`)).toContain('Review');
  expect(await page.evaluate(`document.querySelector('#cwGenPlan').textContent`)).toContain('Generate');
  expect(await page.evaluate(`document.querySelector('#cwSaveEvent').textContent`)).toContain('Save');
  // back to Hebrew restores
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`document.querySelector('#cwGenPlan').textContent`)).toContain('צור תוכנית');
});

test('i18n: showPanel auto-translates data-i18n chrome inside dynamic panels', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`showPanel('<div class="panel-body"><span id="t1" data-i18n="path.event">יש לי אירוע</span><input id="t2" data-i18n-ph="search.ph"></div>')`);
  expect(await page.evaluate(`document.querySelector('#t1').textContent`)).toBe('I have an event');
  expect(await page.evaluate(`document.querySelector('#t2').getAttribute('placeholder')`)).toContain('Search');
});
