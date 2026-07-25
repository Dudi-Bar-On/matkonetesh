import { test, expect, seedApp } from './_fixtures';

// E1 · Task 5 (spec §4.1-D3). Two cooking-area fields coexisted with nothing distinguishing them: the
// free-text #eqvArea -> cap.area (display-only) and the numeric areaCm2 (the ONLY field deviceCapacity
// reads for fit). D3 makes areaCm2 canonical: the device chip renders areaCm2, and the redundant
// free-text input is removed. This test pins the chip repoint behaviourally; the input removal is
// confirmed by the DoD-8 screenshot (Step 6).
const DEV = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, area: '9999 free-text', areaCm2: 6000 } }];
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
                        'mk-equipment': JSON.stringify(DEV), 'mk-equip-set': 'true' });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof deviceCapacity==='function'`);
};

test('the device chip renders the canonical areaCm2, not the free-text cap.area alias', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openEquipment()`);
  await page.waitForFunction(`document.querySelector('.eq-chip')!==null`);
  const chips = await page.evaluate(`Array.from(document.querySelectorAll('.eq-chip')).map(e=>e.textContent).join(' | ')`) as string;
  expect(chips).toContain('6000');            // canonical numeric area
  expect(chips).not.toContain('9999');        // the free-text alias must no longer be shown
});

test('the redundant free-text cooking-area input is gone from the add/edit form', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openEquipment()`);
  await page.waitForFunction(`document.querySelector('.eq-chip')!==null`);
  // Real edit affordance confirmed by grep of app.js's drawList wiring: `[data-eqedit]` (id-keyed).
  await page.click('#panel [data-eqedit="d1"]');
  await page.waitForFunction(`document.querySelector('#eqProp-areaCm2')!==null`);
  expect(await page.evaluate(`document.querySelectorAll('#eqvArea').length`)).toBe(0);
  expect(await page.evaluate(`document.querySelectorAll('#eqProp-areaCm2').length`)).toBe(1);
});

test('DoD-10 safety invariance — deviceCapacity still reads areaCm2 unchanged (fit math untouched)', async ({ page }) => {
  await boot(page);
  const cap = await page.evaluate(`deviceCapacity(equipList()[0])`) as any;
  expect(cap.areaCm2).toBe(6000);             // unchanged: areaCm2 was always the fit source
  expect(cap.mode).toBe('area');
});
