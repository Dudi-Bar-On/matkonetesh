import { test, expect } from '@playwright/test';

// aiValidateKeys / aiValidateItems / aiValidateSeasonings are the allow-list filters that stop a
// model inventing a recipe or a seasoning. Before 2026-07-22 no spec referenced any of them.
// They are pure functions over a valid set, so they are tested directly via page.evaluate.

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(
    `typeof aiValidateKeys==='function' && typeof aiValidateItems==='function' && typeof aiValidateSeasonings==='function'`
  );
};

test('aiValidateKeys keeps real catalog keys and drops invented ones', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var real = cwAllItems()[0].key;
    return aiValidateKeys([real, 'totally-invented-key']);
  })()`);
  expect(r.kept).toHaveLength(1);
  expect(r.dropped).toEqual(['totally-invented-key']);
});

test('aiValidateKeys returns empty for a non-array', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`aiValidateKeys(null)`);
  expect(r.kept).toEqual([]);
  expect(r.dropped).toEqual([]);
});

test('aiValidateKeys keeps both copies of a duplicate valid key — no dedup, unlike aiValidateItems', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var real = cwAllItems()[0].key;
    return aiValidateKeys([real, real]);
  })()`);
  expect(r.kept).toHaveLength(2);
  expect(r.dropped).toEqual([]);
});

test('aiValidateItems drops a duplicate key rather than keeping it twice', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var real = cwAllItems()[0].key;
    return aiValidateItems([{key: real}, {key: real}, {key: 'nope'}]);
  })()`);
  expect(r.kept).toHaveLength(1);
  expect(r.dropped).toHaveLength(2);
});

test('aiValidateItems drops an item with no key at all', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`aiValidateItems([{}, {key: null}])`);
  expect(r.kept).toEqual([]);
  expect(r.dropped).toHaveLength(2);
});

test('aiValidateSeasonings keeps only ids valid for the given category', async ({ page }) => {
  await boot(page);
  // Categories in this catalog are Hebrew strings (e.g. 'בקר', not 'beef') — derived at runtime via
  // cwAllCats() rather than hardcoded, same rationale as boot() deriving valid keys from cwAllItems().
  const r = await page.evaluate(`(function(){
    var cats = cwAllCats();
    var cat = null, list = [];
    for (var i=0;i<cats.length;i++){
      var l = seasoningsFor(cats[i], false);
      if (l.length > 0) { cat = cats[i]; list = l; break; }
    }
    var real = list[0].id;
    return { r: aiValidateSeasonings([real, real, 'invented-seasoning'], cat, false), n: list.length };
  })()`);
  expect(r.n).toBeGreaterThan(0);
  expect(r.r.kept).toHaveLength(1);
  expect(r.r.dropped).toHaveLength(2);
});
