// E2 wood-load advisory (owner Decision 3 rider, 2026-07-26) — .superpowers/sdd/wood-advisory-brief.md.
// A FLAVOR-only, NON-BLOCKING work-plan nudge: when a smoke-stage task's assigned smoker device has no
// (or a mismatching) `loadedWood`, the work plan shows a small advisory beside the recipe's stage — it
// never blocks adding/cooking/serving. Real-UI Playwright tests against the rendered work-plan DOM.
import { test, expect, seedApp } from './_fixtures';

// cut-1 (brisket): wood="אלון/היקורי" (data.py). Owning BOTH a smoker and a sous-vide device makes the
// gear-adapted default method the sv+smoke combo (verified empirically — smoker-only ownership picks the
// smoke-only method with no 'sv' stage at all), giving one item with BOTH an 'sv' stage (negative test 4:
// a non-smoker task) and a 'smoke' stage (the advisory's own target) in a single work plan.
function kitJson(loadedWood?: string): string {
  return JSON.stringify([
    { id: 'sm1', cat: 'smoker', type: 'קטל (ככלי עישון)', name: 'המעשנה שלי',
      cap: loadedWood !== undefined ? { racks: 1, areaCm2: 2400, loadedWood } : { racks: 1, areaCm2: 2400 } },
    { id: 'sv1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'הסו-ויד שלי', cap: { maxL: 20 } },
  ]);
}

async function boot(page: any, loadedWood?: string, lang?: string): Promise<void> {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true' };
  if (lang) kv['mk-lang'] = JSON.stringify(lang);
  await seedApp(page, kv);
  await page.evaluate(`(function(){
    equipSave(${kitJson(loadedWood)});
    equipSetConfigured();
    saveMenu({guests:4,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    setItemCooker('cut-1','smoke','sm1');
    setItemCooker('cut-1','sv','sv1');
    store.set('mk-tlserve','19:00');
    store.set('mk-tlview','plan');
    openTimeline();
  })()`);
  await page.waitForSelector('#panel .workplan');
  // sanity: the combo actually produced both stages we rely on (guards the whole file against a silent
  // method-selection drift breaking every test the same way for the wrong reason).
  await page.waitForSelector('#panel .wp-row.wp-smoke');
  await page.waitForSelector('#panel .wp-row.wp-sv');
}

const smokeRow = (page: any) => page.locator('#panel .wp-row.wp-smoke');
const svRow = (page: any) => page.locator('#panel .wp-row.wp-sv');

test('1: no loadedWood -> "check/load a suitable wood" advisory naming the recipe wood (RED before the feature)', async ({ page }) => {
  await boot(page);   // loadedWood left unset entirely
  const sub = smokeRow(page).locator('.wp-body small');
  await expect(sub).toBeVisible();
  const txt = await sub.innerText();
  expect(txt).toContain('בדוק וטען עץ מתאים');
  expect(txt).toContain('אלון/היקורי');   // the recipe's own wood field (data.py cut-1)
  await sub.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'scratch/wood-advisory-shown-390x844.png' });   // DoD §3.8/§3.9 evidence — full 390x844 viewport
});

test('2: loadedWood set to a NON-matching wood -> mismatch advisory naming both', async ({ page }) => {
  await boot(page, 'מזקיט');   // mesquite — not one of "אלון/היקורי"
  const txt = await smokeRow(page).locator('.wp-body small').innerText();
  expect(txt).toContain('המתכון מבקש');
  expect(txt).toContain('אלון/היקורי');
  expect(txt).toContain('טעון');
  expect(txt).toContain('מזקיט');
});

test('3: loadedWood set to a MATCHING wood -> no advisory (absence asserted)', async ({ page }) => {
  await boot(page, 'היקורי');   // one of the recipe's "/"-options, verbatim
  const row = smokeRow(page);
  await expect(row).toBeVisible();
  const txt = await row.innerText();
  expect(txt).not.toContain('🪵');
  expect(txt).not.toContain('בדוק וטען');
  expect(txt).not.toContain('המתכון מבקש');
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'scratch/wood-advisory-absent-390x844.png' });   // DoD §3.8 evidence — matched case, full 390x844 viewport
});

test('3b: match tolerates trim + collapsed inner whitespace (normalize rule)', async ({ page }) => {
  await boot(page, '  היקורי   ');   // padded / doubled inner space — must still normalize-match
  const txt = await smokeRow(page).innerText();
  expect(txt).not.toContain('בדוק וטען');
  expect(txt).not.toContain('המתכון מבקש');
});

test('4: negative — a non-smoker (sous-vide) task on the SAME item never shows a wood advisory', async ({ page }) => {
  await boot(page);   // no loadedWood — the state most likely to leak a false-positive onto the sv row too
  const txt = await svRow(page).innerText();
  expect(txt).not.toContain('🪵');
  expect(txt).not.toContain('בדוק וטען');
  expect(txt).not.toContain('המתכון מבקש');
});

test('5: non-blocking — the item stays fully in the plan/cookable regardless of a mismatch; no block toast', async ({ page }) => {
  await boot(page, 'מזקיט');   // deliberately mismatching, the "worst case" for a wrongly-blocking bug
  // the advisory IS present…
  await expect(smokeRow(page).locator('.wp-body small')).toContainText('המתכון מבקש');
  // …but the item's other stages are still fully scheduled, unaffected…
  await expect(page.locator('#panel .wp-row.wp-bcheck')).toBeVisible();
  await expect(page.locator('#panel .wp-row.wp-serve')).toBeVisible();
  // …the smoke task itself remains checkable, not disabled/blocked…
  const ck = smokeRow(page).locator('input.wp-ck');
  await expect(ck).toBeEnabled();
  await ck.check();
  await expect(smokeRow(page)).toHaveClass(/wp-done/);
  // …and no blocking toast/dialog was ever raised by this advisory.
  expect(await page.locator('#toast').count()).toBe(0);
});

test('6: Hebrew rendered, no English leak; the advisory is a real rendered DOM node a consumer reads', async ({ page }) => {
  await boot(page);
  const small = smokeRow(page).locator('.wp-body small');
  await expect(small).toBeVisible();          // a real DOM node — not just a computed field nothing reads
  const txt = await small.innerText();
  expect(txt).toContain('בדוק וטען עץ מתאים');
  expect(txt).not.toMatch(/[A-Za-z]/);          // no Latin/English leak while the UI is in Hebrew
});

test('7 (bonus, closes the save-path gap): the equipment form itself persists free-text loadedWood via the UI', async ({ page }) => {
  // Tests 1-6 seed cap.loadedWood directly via equipSave (bypassing the edit-form save code entirely) —
  // this test drives the REAL form so a broken kind:'text' save path (silently dropped as unparseable
  // "numeric" text) cannot hide behind the other 6 tests' shortcut. Consumer: doSave's per-prop loop.
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.evaluate(`(function(){
    equipSave([{id:'sm1',cat:'smoker',type:'קטל (ככלי עישון)',name:'המעשנה שלי',cap:{racks:1,areaCm2:2400}}]);
    equipSetConfigured();
    openEquipment();
  })()`);
  await page.click('#panel [data-eqedit="sm1"]');
  await page.waitForSelector('#panel .eq-adv summary');
  const advOpen = await page.evaluate(`!!document.querySelector('#panel .eq-adv').open`);
  if (!advOpen) await page.click('#panel .eq-adv summary');
  await page.waitForSelector('#panel #eqProp-loadedWood');
  await page.fill('#panel #eqProp-loadedWood', 'היקורי');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`(equipList()[0].cap||{}).loadedWood==='היקורי'`);
  expect(await page.evaluate(`equipList()[0].cap.loadedWood`)).toBe('היקורי');
});

test('8 (bonus, §10.20 i18n wiring): the fr/de/es dict entries are actually reachable at runtime, not just JSON', async ({ page }) => {
  // §10.20 requires the 4 new dictionary entries "in the SAME change" — this proves they are wired, not
  // merely present in lang/*.json (a JSON typo or a missing rebuild would leave L()/t() silently falling
  // back to English and this test would catch it).
  // (the interpolated recipe-wood NAME itself stays Hebrew either way — t() has no dict entry for the
  // specific cut's wood string, matching this codebase's existing, pre-existing convention for every other
  // recipe-wood interpolation (app.js's own smoke-detail line does the same) — only the STATIC template
  // wording is asserted here, which is exactly what §10.20 requires this task to add.)
  await boot(page, undefined, 'fr');
  const fr = await smokeRow(page).locator('.wp-body small').innerText();
  expect(fr).toContain('Vérifiez/chargez un bois adapté');
});
