import { test, expect } from '@playwright/test';

// Wave 5 — the recipe engine renders cooking steps in native English OFFLINE (no AI key),
// via generation-time i18n (L()), and a language switch regenerates the open panel. Numbers
// in the steps must survive the translation unchanged.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.waitForTimeout(200);
};

test('a cut detail panel renders steps in English with no AI key', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`openCut(DATA.cuts.find(x=>x.n===1)||DATA.cuts[0])`);
  await page.waitForTimeout(400);
  const txt = await page.evaluate(`document.getElementById('methodArea').textContent`);
  // step titles + bodies are English, no Hebrew letters in the generated plan
  expect(txt).toMatch(/sous-vide|smoke|sear|prep|rest/i);
  expect(txt).not.toMatch(/[֐-׿]/);   // no Hebrew leaked into the English plan
});

test('switching the open panel to Hebrew regenerates the steps in Hebrew', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`openCut(DATA.cuts.find(x=>x.n===1)||DATA.cuts[0])`);
  await page.waitForTimeout(300);
  await page.evaluate(`setLang('he')`);
  await page.waitForTimeout(300);
  const txt = await page.evaluate(`document.getElementById('methodArea').textContent`);
  expect(txt).toMatch(/[֐-׿]/);   // Hebrew is back
});

test('numbers in a generated step survive translation to English', async ({ page }) => {
  await init(page);
  // Hebrew plan numbers
  await page.evaluate(`setLang('he')`);
  await page.evaluate(`openCut(DATA.cuts.find(x=>x.n===1)||DATA.cuts[0])`);
  await page.waitForTimeout(300);
  const he = await page.evaluate(`document.getElementById('methodArea').textContent`);
  await page.evaluate(`setLang('en')`);
  await page.waitForTimeout(300);
  const en = await page.evaluate(`document.getElementById('methodArea').textContent`);
  const nums = (s: string) => (s.match(/\d+/g) || []).map(Number).sort((a, b) => a - b);
  // every temperature/time figure present in Hebrew is still present in English
  const heNums = nums(he), enNums = nums(en);
  for (const n of heNums) expect(enNums).toContain(n);
});
