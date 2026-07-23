import { test, expect, seedApp } from './_fixtures';

// Wave 4 UX batch 3 — real global home search (UX #12) + shared AI-loading spinner (UX #13).

const init = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
};

test('UX #12: the home search is editable and carries the query into the catalog search', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`document.querySelector('#cHomeSearchInput').hasAttribute('readonly')`)).toBe(false);
  await page.evaluate(`(function(){ const inp=document.querySelector('#cHomeSearchInput'); inp.value='בריסקט'; inp.dispatchEvent(new Event('input')); })()`);
  expect(await page.evaluate(`document.querySelector('#q').value`)).toBe('בריסקט');          // query carried to the catalog search box
  expect(await page.evaluate(`document.querySelector('#scr-home').classList.contains('on')`)).toBe(false);   // navigated off home
});

test('UX #13: aiSpinner produces one shared AI-loading markup used across the app', async ({ page }) => {
  await init(page);
  const html = await page.evaluate(`aiSpinner('בודק')`) as string;
  expect(html).toContain('wcim-loading');   // the shared AI-loading class
  expect(html).toContain('ask-dots');        // shared animated dots
  expect(html).toContain('בודק');            // the label
});
