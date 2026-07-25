import { test, expect, seedApp } from './_fixtures';

// Equipment programme E1 · Task 1 (spec §3, ruling F5). The strangler-fig seam: equipment.js is inlined
// BEFORE app.js into the single shipped <script>, exposing ONE narrow global EQM with EXACTLY five
// methods. In E1 only EQM.ownership becomes functional (Task 3); availability/allocate/release (E2) and
// alternatives (E5) ship as phase-stubs that THROW when called — scaffold, never silent no-ops.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof EQM!=='undefined'`);
};

test('EQM exists as one global object (H3: reachable by bare name, no window.)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`typeof EQM`)).toBe('object');
  expect(await page.evaluate(`EQM!==null`)).toBe(true);
});

test('EQM exposes EXACTLY five methods, all functions (ruling F3/F5)', async ({ page }) => {
  await boot(page);
  const keys = await page.evaluate(`Object.keys(EQM).filter(k=>typeof EQM[k]==='function').sort()`) as string[];
  expect(keys).toEqual(['allocate', 'alternatives', 'availability', 'ownership', 'release']);
  expect(await page.evaluate(`Object.keys(EQM).length`)).toBe(5);   // no sixth surface member
});

// E2 Task 2 made `availability` functional (tests/e2-availability.spec.ts covers it), and E2 Task 3
// makes `allocate`/`release` functional (tests/e2-allocate-release.spec.ts covers them) — this assertion
// is now legitimately obsolete for those three; ONLY `alternatives` (E5) still throws its phase name.
// Planned contract change, same shape as Task 2's narrowing of this same test: the plan's Task-3 Step 4
// documents this as the expected obsolescence, not a Waiver-Gate item.
test('the not-yet-implemented method throws its phase name (scaffold, not a silent no-op)', async ({ page }) => {
  await boot(page);
  for (const [m, phase] of [['alternatives','E5']] as const) {
    const msg = await page.evaluate(`(function(){ try{ EQM['${m}']({},{},{}); return 'NO-THROW'; }catch(e){ return String(e.message||e); } })()`) as string;
    expect(msg).toContain(phase);
  }
});

test('deriveRequires is a global function seam (Task 2 fills its body)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`typeof deriveRequires`)).toBe('function');
});
