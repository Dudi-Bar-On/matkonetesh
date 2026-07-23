import { test, expect, seedApp } from './_fixtures';
const boot = async (page: any, kit: any[]) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify(kit),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof deviceDisplayName==='function'`);
};
test('two devices with the same name get sequential מס׳ N; a unique one gets no suffix', async ({ page }) => {
  await boot(page, [
    { id:'a', cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5} },
    { id:'b', cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5} },
    { id:'c', cat:'grill',  type:'קטל',          name:'Weber 67', cap:{zones:2} },
  ]);
  const names = await page.evaluate(`equipList().map(function(d){return deviceDisplayName(d);})`) as string[];
  expect(names[0]).toBe('אביה 150 · מס׳ 1');
  expect(names[1]).toBe('אביה 150 · מס׳ 2');
  expect(names[2]).toBe('Weber 67');   // unique → no suffix
});
test('a device with no name falls back to its translated type', async ({ page }) => {
  await boot(page, [{ id:'a', cat:'oven', type:'ביתי', cap:{racks:3} }]);
  const n = await page.evaluate(`deviceDisplayName(equipList()[0])`) as string;
  expect(n.length).toBeGreaterThan(0);
  expect(n).not.toContain('מס׳');
});

// Minor found in review: equipList() re-parses on every call, so object identity never matches across the
// boundary and numbering leant entirely on id. A device with no id used to match index 0 and be numbered
// "1" — a wrong number is worse than none.
test('a device with no id gets the bare name, never a fabricated number', async ({ page }) => {
  await boot(page, [
    { cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5} },
    { cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5} },
  ] as any);
  const names = await page.evaluate(`equipList().map(function(d){return deviceDisplayName(d);})`) as string[];
  names.forEach(n => expect(n).not.toContain('מס׳'));
});
