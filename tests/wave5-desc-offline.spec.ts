import { test, expect } from '@playwright/test';

// Wave 5 — item descriptions are pre-translated (lang/en.data.json) so they render in English
// OFFLINE (no AI key), via hydrateMT's dict-first path; MT is only the fallback.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('a pre-translated description renders in English with no AI key', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  // no mk-gemkey set → mtTranslate can't run; this must come from the pre-translated dict
  await page.evaluate(`showPanel('<div class="panel-body"><p class="itemdesc" data-mt>נתח שומני ועשיר במיוחד (מכסה הצלע); תוצאה דקדנטית.</p></div>')`);
  await page.waitForFunction(`document.querySelector('.itemdesc') && /rib cap/i.test(document.querySelector('.itemdesc').textContent)`);
  expect(await page.evaluate(`document.querySelector('.itemdesc').textContent`)).toContain('rib cap');
});

test('switching a description back to Hebrew restores the original', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`showPanel('<div class="panel-body"><p class="itemdesc" data-mt>נתח שומני ועשיר במיוחד (מכסה הצלע); תוצאה דקדנטית.</p></div>')`);
  await page.waitForFunction(`/rib cap/i.test(document.querySelector('.itemdesc').textContent)`);
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`document.querySelector('.itemdesc').textContent`)).toContain('מכסה הצלע');   // restored Hebrew
});
