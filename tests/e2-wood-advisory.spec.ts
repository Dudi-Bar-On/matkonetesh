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
  // …and no BLOCKING dialog was ever raised by this advisory. Narrowed post R-52/R-57/R-62 (Tasks
  // 13/14, commits 5635b46/25f27e2): the voice bus's P1 rule ("everything spoken also appears
  // visually") wired S4 (plan-running-late, a genuine safety trigger, unconditional per
  // ttsCategoryEnabled('safety')==='always') into buildList's own render path. This fixture's brisket
  // (long smoke) + fixed 19:00 serve is realistically "behind schedule" whenever the suite runs, so S4
  // now legitimately fires — and in a test env with no AI key configured, vcSpeak's own pre-existing
  // M5 guard (silent-failure-hunter audit, app.js ~7669) toasts a "connect an AI key" hint rather than
  // failing silently. That toast is `role="status" aria-live="polite"` — non-blocking by construction,
  // as this very test proves two lines up (the checkbox stayed enabled and the row still went wp-done
  // with the toast showing). It is unrelated to the wood advisory itself (verified: it fires even
  // before the checkbox is touched, from a plain openTimeline() render — see the S4 code path, not the
  // wood-gate code at app.js ~9319). The codebase's actual BLOCKING-dialog primitive is `#appdlg`
  // (`.appdlg-card[role="dialog"][aria-modal="true"]`, app.js ~3927) — asserting its absence is what
  // the comment above ("no blocking toast/dialog") actually meant; a bare `#toast` count was an
  // over-broad proxy that happened to coincide with zero-toasts before any render-path voice trigger
  // existed. Tightened, not weakened: this still fails if ANY modal/blocking surface appears.
  expect(await page.locator('#appdlg [aria-modal="true"]').count()).toBe(0);
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
  // Finding 2 (review, minor): a kind:'text' field holding Hebrew wood names must not pop a numeric
  // mobile keyboard — it must NOT inherit inputmode="decimal" from the generic numeric-prop branch.
  const im = await page.getAttribute('#panel #eqProp-loadedWood', 'inputmode');
  expect(im).not.toBe('decimal');
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

// Fixture-minimality gap (code review, commit 71052d8): tests 1-8 above ALL use cut-1 (brisket,
// wood="אלון/היקורי") — a wood-bearing recipe. The gate at the review-flagged line (app.js ~7085) reads
// `if(cwood){...}` — any TRUTHY wood, including the "no wood" sentinel string "ללא" that real
// CUTS/SPECIALS carry (goose liver, veal brain, romaine hearts, halloumi, banana, biltong — data.py).
// Those items still have smt/smh (a smoke stage exists) but the recipe explicitly calls for NO wood, so
// the advisory nagging "check/load a suitable wood: ללא" is nonsensical. cut-74 (Goose Liver, data.py
// n=74, cat="איברים פנימיים"/offal) is used here: wood="ללא", smt=110/smh=0.3 (has a smoke stage), and —
// critically — offal's methodRules default to ['grill'] (not smoke), so the kit below deliberately owns
// ONLY a smoker whose TYPE ('ארון / קבינט', cabinet) is excluded from canGrill()'s smoker-type allowlist
// (app.js ~957: קמאדו/קטל/WSM/אופסט only) — no sous-vide, no grill device — so canGrill()===false and
// canSV()===false, leaving 'smoke' as the ONLY gear-capable valid combo: gearAwareDefault naturally
// auto-selects the smoke method on this smoker-only kit (verified by reading app.js's methodRules /
// canGrill / gearAwareDefault — not assumed), giving a real .wp-smoke row without forcing any method
// override. loadedWood is left unset (empty) — the exact precondition that makes the buggy gate fire.
test('9 (Finding-1 fixture-minimality fix): a wood="ללא" (no-wood) recipe never shows the wood advisory, even with an empty loadedWood', async ({ page }) => {
  const kit = JSON.stringify([
    { id: 'sm2', cat: 'smoker', type: 'ארון / קבינט', name: 'הארון שלי', cap: { racks: 1 } },
  ]);
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.evaluate(`(function(){
    equipSave(${kit});
    equipSetConfigured();
    saveMenu({guests:4,appetite:'reg',kosher:false,keys:['cut-74'],sides:[],drinks:[],desserts:[],gpm:0});
    setItemCooker('cut-74','smoke','sm2');
    store.set('mk-tlserve','19:00');
    store.set('mk-tlview','plan');
    openTimeline();
  })()`);
  await page.waitForSelector('#panel .workplan');
  // sanity: the gear-adapted default really did select the smoke-only method for this offal item (guards
  // the whole test against a silent method-selection drift making the assertion vacuous for the wrong reason).
  await page.waitForSelector('#panel .wp-row.wp-smoke');
  const row = page.locator('#panel .wp-row.wp-smoke');
  const txt = await row.innerText();
  expect(txt).not.toContain('🪵');
  expect(txt).not.toContain('בדוק וטען');
  expect(txt).not.toContain('המתכון מבקש');
  // the specific nonsensical pre-fix nag this test guards against: "Check/load a suitable wood: ללא"
  expect(txt).not.toContain('ללא');
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'scratch/wood-advisory-nowood-absent-390x844.png' });   // DoD §3.8/§3.9 evidence
});
