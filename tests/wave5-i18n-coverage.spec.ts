import { test, expect } from '@playwright/test';

// Wave 5 — coverage: the wizard translates, panels auto-translate, and switch-back restores Hebrew.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('wizard step buttons + review CTAs translate to English and restore on switch-back', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`document.querySelector('[data-cwgo="1"]').textContent`)).toContain('Next');
  expect(await page.evaluate(`document.querySelector('#cwGenPlan').textContent`)).toContain('Generate');
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`document.querySelector('#cwGenPlan').textContent`)).toContain('צור תוכנית');   // restored, not stuck in English
});

test('showPanel auto-translates dictionary chrome inside dynamic panels', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`showPanel('<div class="panel-body"><span id="t1">יש לי אירוע</span><input id="t2" placeholder="חפש הכל — נתח, נקניקייה, מתבל…"></div>')`);
  expect(await page.evaluate(`document.querySelector('#t1').textContent`)).toBe('I have an event');
  expect(await page.evaluate(`document.querySelector('#t2').getAttribute('placeholder')`)).toContain('Search');
});
