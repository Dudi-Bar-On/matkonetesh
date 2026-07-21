import { test, expect } from '@playwright/test';

// Correct kashrut classification across every item type (species/recipe-based).
const EXPECT: Record<string, string[]> = {
  // morcilla & sundae are PORK blood sausages -> classified 'pork' (non-kosher either way)
  pork: ['cut-7', 'cut-8', 'cut-29', 'spec-4', 'make-m-brat', 'make-n-milano',
    'make-n-chorizo-esp', 'make-sal-coppa', 'make-m-nduja', 'make-n-kase',
    'make-n-morcilla', 'make-n-sundae'],
  shellfish: ['cut-113', 'cut-117', 'cut-123', 'cut-124', 'cut-128', 'cut-130', 'cut-126'],
  dairy: ['spec-15', 'spec-21', 'spec-39', 'spec-47', 'cut-105'],
  kosher: ['cut-1', 'cut-4', 'cut-5', 'cut-9', 'cut-44', 'cut-49', 'cut-50', 'cut-125', 'cut-127',
    'cut-72', 'cut-74', 'cut-83', 'cut-97', 'spec-5', 'make-p-ny', 'make-p-turkey',
    'make-sal-bresaola', 'make-s-chicken', 'make-m-merg', 'make-m-kofta', 'make-m-chick',
    'make-m-droe', 'make-m-sucuk', 'make-n-cevapi', 'make-fish-lox', 'make-fish-mackerel',
    // false-positive regressions: kebab (mici cross-ref note) + sucuk-taze (pork casing option)
    'cut-17', 'make-n-sucuk-taze'],
};

test('kosher classification is correct across every item type', async ({ page }) => {
  await page.goto('/index.html');
  const keys = Object.values(EXPECT).flat();
  const got = await page.evaluate(
    `(function(){var ks=${JSON.stringify(keys)},o={};ks.forEach(function(k){o[k]=kosherStatus(k);});return o;})()`
  ) as Record<string, string>;

  const wrong: string[] = [];
  for (const [status, ks] of Object.entries(EXPECT))
    for (const k of ks)
      if (got[k] !== status) wrong.push(`${k}: expected ${status}, got ${got[k]}`);
  expect(wrong, '\n' + wrong.join('\n')).toEqual([]);
});

test('kosher filter excludes shellfish everywhere (catalog + wizard)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  // wizard picker with kosher on must contain NO shellfish or pork
  await page.click('[data-cnav="wizard"]');
  await page.evaluate(`cwGo(1)`);
  await page.waitForSelector('#cwPickList [data-cwpick]');
  const before = await page.evaluate(`Array.from(document.querySelectorAll('#cwPickList [data-cwpick]')).filter(el=>['shellfish','pork','treif'].includes(kosherStatus(el.dataset.cwpick))).length`);
  expect(before).toBeGreaterThan(0);
  await page.evaluate(`document.getElementById('cwKosher').click()`);
  await page.waitForFunction(`Array.from(document.querySelectorAll('#cwPickList [data-cwpick]')).filter(function(el){return ['shellfish','pork','treif'].includes(kosherStatus(el.dataset.cwpick));}).length===0`);
  const after = await page.evaluate(`Array.from(document.querySelectorAll('#cwPickList [data-cwpick]')).filter(el=>['shellfish','pork','treif'].includes(kosherStatus(el.dataset.cwpick))).length`);
  expect(after).toBe(0);
});
