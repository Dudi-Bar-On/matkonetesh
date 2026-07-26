import { test, expect, seedApp } from './_fixtures';

// E3 Task 2 (spec §5.2, plan docs/superpowers/plans/2026-07-26-equipment-e3-validity-gates.md).
// The plan-add gate: adding an 'uncookable' item to the plan is BLOCKED with the spec's reason toast
// (`לא נוסף — חסר <device>` / EN `Not added — missing <device>`); a 'blocked-default' item ADDS normally
// (spec §5.2 blocks on 'uncookable' only — a working alternative cited path exists, so the add proceeds;
// the catalog's lighter emphasis for blocked-default is view-only, O-5 point 1); unconfigured users are
// NEVER blocked (R5 — eqmValidity always answers 'ok' with no kit configured).
//
// Fixture: identical to tests/e3-validity.spec.ts — make-m-brat (DATA.makes['m-brat']) offers TWO cited
// paths, grill (default) and smoke (alternate).
//   BATH   (sous-vide bath only)  → uncookable   (neither path satisfied — default gap kind: 'grill')
//   SMOKER (smoker only)          → blocked-default (grill fails, smoke works)
//   FULL   (smoker + grill)       → ok
//
// ADD-PATH ENUMERATION (find_referencing_symbols on saveMenu + toggleCart; full detail + the gate-site
// list in .superpowers/sdd/e3-task-2-report.md). No single low-level choke point exists — saveMenu is
// also the WRITE function for programmatic restores (evLoad) that must NEVER be gated (per the task's own
// instruction) — so the gate sits at each user-action layer that turns a "new key" into a write:
//   1. card add-menu / item-panel ✚         → toggleCart(key)                    — tested below, real click
//   2. wizard dish-picker (data-cwpick)      → cwPaintPickList's click handler    — tested below, real click
//   3. "quick start" style presets           → presetMenu(style)                 — tested below, real click
//   4. "from favorites" (favorites-add)      → presetFromFavs()                  — tested below, real click
//   5. AI event-planner's apply flow         → evPlanApply(plan)                 — tested below, direct call
//                                                (the AI JSON round-trip itself is unmockable in this
//                                                harness; the real production WRITE function is exercised)
//   6. pantry/project → bridge to plan       → pantryToPlan(pid)                 — tested below, direct call
//   7. seasoning-picker "go instance" add    → spkGoInstance(key,...)            — tested below, direct call
//   8. legacy meal-builder manual add        → renderMenu's [data-addcat] handler — gated in code, NOT
//      (openMenu → ➕ הוסף מנה)                                                     independently
//      9. legacy meal-builder dish swap      → swapDish(i)                          Playwright-exercised:
//   (both openMenu-scoped — a secondary/legacy surface the wizard has replaced as the primary add flow,
//   "UX #3" app.js:5560 — both route through the SAME eqmAddGate/eqmAddGateKeys already proven correct by
//   the 7 tests above; disclosed here rather than silently left untested)
// NOT gated (checked, confirmed inapplicable — see .superpowers/sdd/e3-task-2-report.md):
//   - presetFromCart() — `cart` is a permanently-empty Set (app.js:1598, "vestigial... kept empty to
//     avoid breakage") — cannot ever add anything, cookable or not. Verified below.
//   - favStar/toggleFav (the ★ button) — writes only the separate favorites list, never the plan.
//   - the recipe generator (aiGenerateRecipe/runGenerateRecipe, "מחולל מתכונים") — saves to "המתכונים
//     שלי" (a NEW catalog entry via umakeSave), never adds to the current plan.
//   - voice — no voice add-to-plan mechanism exists (grep-confirmed); also CLAUDE.md: a separate track.
//   - evLoad / evClearActive / evNewDraft / evLoad's undo-toast restore — PROGRAMMATIC restores. Gating
//     here would silently strip an already-saved event's items on every load, which is exactly the
//     silent behaviour spec §7's (separate, later) retroactive-invalidation task forbids. Proven NOT
//     gated below (an uncookable item survives a real evLoad intact).
//   - resetMenu's own undo-toast restore (E3 gate-prep, Task 2 review Minor) — a 4th programmatic-restore
//     bypass of the same shape, found late and disclosed here rather than left silently unlisted: `prev`
//     (the pre-reset menu, possibly holding an uncookable item) is restored verbatim on undo, same
//     reasoning as evLoad's undo — gating it would silently strip an item the user had BEFORE they reset.
//     Proven NOT gated below.

const boot = async (page: any, kit: any[] | null, extra: Record<string, string> = {}) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...extra };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmValidity==='function' && typeof toggleCart==='function' && typeof eqmAddGate==='function'`);
};

const BATH   = [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [20] } }];
const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
const FULL = SMOKER.concat([{ id: 'g1', cat: 'grill', type: 'חשמלי', name: 'גריל', cap: { areaCm2: 5000, maxC: 300 } }]);

const openCatalogMakes = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="מלאכה"]');
};

test.describe('(1) card add-menu — the primary ✚ flow, real clicks', () => {
  test('(a) uncookable item + configured kit: real ✚ click is BLOCKED — toast text + not in store + button stays off — screenshot', async ({ page }) => {
    await boot(page, BATH);
    await openCatalogMakes(page);
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    await page.screenshot({ path: 'mockups/e3-plan-gate-toast.png' });
    const keys = await page.evaluate(`menuState().keys`) as string[];
    expect(keys).not.toContain('make-m-brat');
    const btnCls = await page.locator('[data-mid="m-brat"] [data-addmenu]').getAttribute('class');
    expect(btnCls).not.toMatch(/(^| )on( |$)/);
    expect(await page.locator('[data-mid="m-brat"] [data-addmenu]').getAttribute('aria-pressed')).toBe('false');
  });

  test('(b) blocked-default item: adds normally — the working-alternative item is never blocked, only view emphasis differs', async ({ page }) => {
    await boot(page, SMOKER);
    await openCatalogMakes(page);
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`(menuState().keys||[]).includes('make-m-brat')`);
    expect(await page.evaluate(`menuState().keys`)).toContain('make-m-brat');
    expect(await page.evaluate(`!!(document.querySelector('#toast')&&document.querySelector('#toast').classList.contains('show')&&document.querySelector('#toast').textContent.indexOf('לא נוסף')===0)`)).toBe(false);
  });

  test('(c) unconfigured kit: never blocked, adds normally (R5)', async ({ page }) => {
    await boot(page, null);
    await openCatalogMakes(page);
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`(menuState().keys||[]).includes('make-m-brat')`);
    expect(await page.evaluate(`menuState().keys`)).toContain('make-m-brat');
  });

  test('(d) fully-equipped (ok) kit: adds normally', async ({ page }) => {
    await boot(page, FULL);
    await openCatalogMakes(page);
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`(menuState().keys||[]).includes('make-m-brat')`);
    expect(await page.evaluate(`menuState().keys`)).toContain('make-m-brat');
  });

  test('removing an already-added item is never gated — toggle-off is not an add', async ({ page }) => {
    await boot(page, FULL);
    await openCatalogMakes(page);
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`(menuState().keys||[]).includes('make-m-brat')`);
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`!(menuState().keys||[]).includes('make-m-brat')`);
  });

  // (f) EN leak — the plan-add gate's own toast copy renders correctly in English, no Hebrew leak.
  test('(f) EN leak — English mode: the block toast reads in English, no Hebrew characters', async ({ page }) => {
    await boot(page, BATH, { 'mk-lang': JSON.stringify('en') });
    await openCatalogMakes(page);
    await page.click('[data-mid="m-brat"] [data-addmenu]');
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='Not added — missing Grill'`);
    const txt = await page.evaluate(`document.querySelector('#toast').textContent`) as string;
    expect(txt).not.toMatch(/[֐-׿]/);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
  });
});

test.describe('(2) every enumerated add path — uncookable case', () => {
  test('wizard dish-picker (data-cwpick): real click is BLOCKED', async ({ page }) => {
    await boot(page, BATH);
    await page.click('[data-cnav="wizard"]');
    await page.evaluate(`cwGo(1)`);
    await page.waitForSelector('#cwPickList [data-cwpick="make-m-brat"]');
    await page.click('#cwPickList [data-cwpick="make-m-brat"]');
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
    // never visually marked "selected" either — the render-side confirmation the add never happened
    const style = await page.locator('#cwPickList [data-cwpick="make-m-brat"]').getAttribute('style');
    expect(style || '').not.toContain('ember');
  });

  test('"from favorites" (presetFromFavs — the favorites-add-to-plan path): real wizard chip click is BLOCKED', async ({ page }) => {
    await boot(page, BATH, { 'mk-fav': JSON.stringify(['make-m-brat']) });
    await page.click('[data-cnav="wizard"]');
    await page.evaluate(`cwGo(1); cNavGo('wizard'); cwPaintPicker();`);
    await page.waitForSelector('#cwPickList [data-cwpreset="__fav"]');
    await page.click('#cwPickList [data-cwpreset="__fav"]');
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
  });

  test('"quick start" style preset (presetMenu): real wizard chip click drops an uncookable pick, toast fires', async ({ page }) => {
    await boot(page, BATH);
    // recipesInCat is stubbed so every category presetMenu consults deterministically offers ONLY
    // make-m-brat as a candidate — proves the REAL presetMenu function routes its picks through the
    // gate, without depending on which random item the unstubbed data would have offered.
    await page.evaluate(`(function(){ window.__origRecipesInCat = recipesInCat; window.recipesInCat = function(){ return ['make-m-brat']; }; })()`);
    await page.click('[data-cnav="wizard"]');
    await page.evaluate(`cwGo(1); cNavGo('wizard'); cwPaintPicker();`);
    await page.waitForSelector('#cwPickList [data-cwpreset="מנגל מעורב"]');
    await page.click('#cwPickList [data-cwpreset="מנגל מעורב"]');
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
    await page.evaluate(`window.recipesInCat = window.__origRecipesInCat;`);
  });

  test('AI event-planner apply flow (evPlanApply — the "generator"): uncookable keys are filtered before the write, toast fires', async ({ page }) => {
    await boot(page, BATH);
    await page.evaluate(`evPlanApply({guests:8,appetite:'reg',kosher:false,keys:['make-m-brat'],sides:[],drinks:[],desserts:[],rationale:''})`);
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
  });

  test('pantry/project bridge to plan (pantryToPlan): a ready pantry item resolving to an uncookable key is BLOCKED', async ({ page }) => {
    await boot(page, BATH);
    await page.evaluate(`store.set('mk-pantry',[{id:'p1',key:'make-m-brat',name:'בראטוורסט',source:'bought',stage:'ready'}])`);
    await page.evaluate(`pantryToPlan('p1')`);
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
  });

  test('seasoning-picker "go instance" add (spkGoInstance): BLOCKED for an uncookable key', async ({ page }) => {
    await boot(page, BATH);
    await page.evaluate(`spkGoInstance('make-m-brat', null, true)`);
    await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
    expect(await page.evaluate(`menuState().keys`)).not.toContain('make-m-brat');
  });
});

test.describe('(3) confirmed NOT gated — programmatic writes and inert paths', () => {
  test('evLoad (restoring a saved event) is NEVER gated — an uncookable item survives a real load intact', async ({ page }) => {
    await boot(page, BATH);
    await page.evaluate(`store.set('mk-events', [{id:'ev-A', name:'בדיקה', serve:'19:00', menu:{keys:['make-m-brat']}}])`);
    await page.evaluate(`evLoad('ev-A')`);
    expect(await page.evaluate(`menuState().keys`)).toContain('make-m-brat');   // never silently stripped
  });

  // E3 gate-prep (Task 2 review Minor) — the 4th programmatic-restore path, same shape as evLoad above:
  // resetMenu's own undo-toast restores `prev` (the pre-reset menu) VERBATIM via a real click on the
  // toast's [data-undo] button — never through eqmAddGate. Gating it would silently strip an uncookable
  // item the user already had BEFORE they hit reset, exactly the silent-strip behaviour this whole
  // "programmatic restore" family is deliberately exempt from.
  test('resetMenu\'s undo-toast restore is NEVER gated — a real undo click brings an uncookable item back intact', async ({ page }) => {
    await boot(page, BATH, { 'mk-menu': JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['make-m-brat'], sides: [], drinks: [], desserts: [], gpm: 0 }) });
    await page.evaluate(`resetMenu()`);
    await page.waitForFunction(`(menuState().keys||[]).length===0`);   // sanity — the reset itself really cleared the plan
    await page.waitForSelector('#toast [data-undo]');
    await page.click('#toast [data-undo]');
    await page.waitForFunction(`(menuState().keys||[]).includes('make-m-brat')`);
    expect(await page.evaluate(`menuState().keys`)).toContain('make-m-brat');   // never silently stripped on undo
  });

  test('presetFromCart is confirmed inert — cart is a permanently-empty Set, adds nothing regardless of kit', async ({ page }) => {
    await boot(page, FULL);   // even a fully-equipped kit — proves the emptiness, not the gate, is why nothing is added
    await page.evaluate(`presetFromCart()`);
    expect(await page.evaluate(`(menuState().keys||[]).length`)).toBe(0);
  });
});

// DoD-10 safety invariance — the gate reads eqmValidity/resolveItem and writes only the plan's `keys`
// membership array; it must never mutate the item's own data or its derived stage list. Snapshots
// resolveItem(...).obj and itemStages(...) before/after a BLOCKED add attempt (mirrors the pattern named
// once in spec §2.2 and already exercised for eqmValidity itself in tests/e3-validity.spec.ts).
test('DoD-10 safety invariance — a blocked add never mutates the item object or its derived stages', async ({ page }) => {
  await boot(page, BATH);
  const eq = await page.evaluate(`(function(){
    var meta = resolveItem('make-m-brat');
    var before = JSON.stringify(meta.obj);
    var stagesBefore = JSON.stringify(itemStages(meta, 'grill', true, null));
    eqmAddGate('make-m-brat');   // BLOCKED — the exact call every gated write site makes
    var after = JSON.stringify(resolveItem('make-m-brat').obj);
    var stagesAfter = JSON.stringify(itemStages(resolveItem('make-m-brat'), 'grill', true, null));
    return before===after && stagesBefore===stagesAfter;
  })()`) as boolean;
  expect(eq).toBe(true);
});
