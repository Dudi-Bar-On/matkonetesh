import { test, expect } from '@playwright/test';

// Wave 5 — the dictionary translator (tnode): exact, emoji-prefixed, and interpolated chrome; plus
// itemName() swapping to the item's English name in English mode.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

const tn = (page: any, text: string) => page.evaluate(`(function(){ const d=document.createElement('div'); d.textContent=${JSON.stringify(text)}; tnode(d); return d.textContent; })()`);

test('tnode translates exact, emoji-prefixed, and interpolated Hebrew chrome', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  expect(await tn(page, 'בקר')).toBe('Beef');                 // exact category
  expect(await tn(page, '🥩 בקר')).toBe('🥩 Beef');            // emoji-prefixed chip
  expect(await tn(page, '🔥 BBQ קלאסי')).toBe('🔥 Classic BBQ'); // prefix + latin-leading rest
  expect(await tn(page, '53 פריטים')).toBe('53 items');        // interpolated count
  expect(await tn(page, '8 סועדים')).toBe('8 guests');
});

test('tnode is a no-op in Hebrew, and leaves unknown strings alone', async ({ page }) => {
  await init(page);   // Hebrew
  expect(await tn(page, 'בקר')).toBe('בקר');                   // no translation in Hebrew mode
  await page.evaluate(`setLang('en')`);
  expect(await tn(page, 'מחרוזת לא מוכרת xyz')).toBe('מחרוזת לא מוכרת xyz');   // unknown → untouched
});

test('itemName uses the English name in English mode, Hebrew otherwise', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`itemName({heb:'בריסקט',eng:'Brisket'})`)).toBe('בריסקט');
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`itemName({heb:'בריסקט',eng:'Brisket'})`)).toBe('Brisket');
  expect(await page.evaluate(`itemName({heb:'משהו',eng:''})`)).toBe('משהו');   // falls back to Hebrew when no eng
});
