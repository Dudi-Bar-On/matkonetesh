import { test, expect, seedApp } from './_fixtures';

// Wave 5 — accessible flag language switcher (home globe button → language menu; also in More/Appearance).

const init = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
};

test('a globe button on home opens a flag language menu with all languages', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`!!document.querySelector('#cHomeLang')`)).toBe(true);
  await page.evaluate(`openLangMenu()`);
  await page.waitForSelector('.lang-flag');
  const flags = await page.evaluate(`[...document.querySelectorAll('.lang-flag [data-setlang], .lang-flag')].length ? [...document.querySelectorAll('.lang-flag')].map(b=>b.dataset.setlang) : []`) as string[];
  expect(flags).toContain('he');
  expect(flags).toContain('en');
  expect(flags).toContain('fr');
  // the current language is marked pressed
  expect(await page.evaluate(`document.querySelector('.lang-flag[data-setlang="he"]').getAttribute('aria-pressed')`)).toBe('true');
});

test('picking a flag switches the language', async ({ page }) => {
  await init(page);
  await page.evaluate(`openLangMenu()`);
  await page.waitForSelector('.lang-flag[data-setlang="fr"]');
  await page.evaluate(`document.querySelector('.lang-flag[data-setlang="fr"]').click()`);
  expect(await page.evaluate(`getLang()`)).toBe('fr');
  expect(await page.evaluate(`document.documentElement.lang`)).toBe('fr');
});
