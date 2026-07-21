import { test, expect } from '@playwright/test';

// Wave 5 — data-MT hydration: [data-mt] recipe prose is async-translated into the active language
// behind the numeric guard (via showPanel's hook). No-op in Hebrew; safe fallback without an AI key.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('data-MT: hydrateMT translates [data-mt] prose in English mode (behind the guard)', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`window.__mtMock=function(){ return 'A smoky brisket, 95 note.'; };`);
  await page.evaluate(`showPanel('<div class="panel-body"><p class="itemdesc" data-mt>חזה בקר מעושן, 95 מעלות</p></div>')`);
  await page.waitForFunction(`!!document.querySelector('.itemdesc') && document.querySelector('.itemdesc').textContent.indexOf('smoky')>=0`);
  expect(await page.evaluate(`document.querySelector('.itemdesc').textContent`)).toContain('smoky');
});

test('data-MT: hydrateMT is a no-op in Hebrew mode', async ({ page }) => {
  await init(page);   // Hebrew by default
  await page.evaluate(`window.__mtMock=function(){ return 'SHOULD NOT APPEAR'; };`);
  await page.evaluate(`showPanel('<div class="panel-body"><p class="itemdesc" data-mt>חזה בקר</p></div>')`);
  await page.waitForFunction(`!!document.querySelector('.itemdesc')`);
  await page.evaluate(`new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); })`);
  expect(await page.evaluate(`document.querySelector('.itemdesc').textContent`)).toBe('חזה בקר');   // untouched
});

test('data-MT: a number-mangling translation is rejected — prose stays in Hebrew', async ({ page }) => {
  await init(page);
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`window.__mtMock=function(){ return 'Brisket with no numbers at all.'; };`);   // drops the 95
  await page.evaluate(`showPanel('<div class="panel-body"><p class="itemdesc" data-mt>חזה בקר ל-95 מעלות</p></div>')`);
  await page.waitForFunction(`!!(document.querySelector('.itemdesc')||{})._mtDone`);
  await page.evaluate(`new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); })`);
  expect(await page.evaluate(`document.querySelector('.itemdesc').textContent`)).toBe('חזה בקר ל-95 מעלות');   // guard kept the safe source
});
