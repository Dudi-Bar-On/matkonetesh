import { test, expect, seedApp } from './_fixtures';

// CP1 · Task 3 (spec 2026-07-25 §4, plan docs/superpowers/plans/2026-07-25-cooking-paths-cp1.md).
// Two more §4 surfaces re-anchor onto the ONE accessor Task 1/2 built: the catalog GRID card's cook
// line (cutCard, app.js ~1731) and the work-plan row's EXPANDABLE DETAIL text (workPlanHtml's
// composedSteps call, app.js ~6475). Both REUSE svSmokeFinish(meta) — the exact wrapper Task 2 wired
// into openCut (app.js ~2268) — never re-deriving the methodKey/order lookup (binding reviewer note).
// Real-UI walk per the owner's binding standard (spec §1.3): catalog nav clicks / plan-view clicks +
// an actual expand tap, never page.evaluate-only for the assertions themselves.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof openTimeline==='function' && typeof saveMenu==='function' && typeof svSmokeFinish==='function' && typeof resolveItem==='function'`);
};

// The expected WIRED finish, read LIVE from the accessor — never hardcoded (same convention as
// tests/cp1-card-unified.spec.ts's wiredSmokeFinish helper).
async function wiredFinish(page: any, key: string) {
  return page.evaluate((k: string) => (window as any).svSmokeFinish((window as any).resolveItem(k)), key);
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

// ── (a) Surface 1: catalog GRID card cook line shows the wired finish, not the catalog 105°/3ש ──────
test('CP1 Task3(a): brisket catalog GRID card cook line shows the wired finish, not catalog 105°/3ש', async ({ page }) => {
  const catalogSmt = await page.evaluate(() => (window as any).resolveItem('cut-1').obj.smt);
  expect(catalogSmt, 'sanity: catalog smt for brisket').toBe(105);
  const wired = await wiredFinish(page, 'cut-1');
  expect(wired, 'sanity: svSmokeFinish must return a wired value for brisket').toBeTruthy();
  expect(wired.t, 'sanity: the citation actually overrides the catalog value').not.toBe(catalogSmt);

  // real click-through: bottom-nav קטלוג → בשר אדום tile → the Brisket grid card (never opened)
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  const cardSel = '.card[data-kind="cut"]';
  await page.waitForSelector(cardSel, { timeout: 15000 });
  const gridCard = page.locator(cardSel).filter({ hasText: 'בריסקט' }).first();
  await gridCard.scrollIntoViewIfNeeded();

  const smokeLine = await gridCard.locator('.meta span', { hasText: 'עישון' }).innerText();
  expect(smokeLine, `grid card smoke line was: ${smokeLine}`).toContain(`${wired.t}°`);
  expect(smokeLine).not.toContain('105°');
  await gridCard.screenshot({ path: 'mockups/cp1-grid-brisket.png' });
});

// ── (c) negative (regression control): an item with NO order_svsmoke citation at all renders a
// BYTE-IDENTICAL grid cook line to the catalog. Discovered LIVE (not hardcoded) — cut-3 turned out to
// carry an order_svsmoke citation that happens to equal the catalog value (105°/1.5ש), which would make
// a mutation-proof negative control if hardcoded; a genuinely uncited item is required instead.
test('CP1 Task3(c) negative: an uncited item\'s GRID card cook line stays byte-identical to the catalog', async ({ page }) => {
  const info = await page.evaluate(`(function(){
    var c = DATA.cuts.find(function(c){ return !isProduce(c) && !c.order_svsmoke; });
    if (!c) return null;
    return { key: 'cut-'+c.n, cat: c.cat, group: groupOf(c.cat), heb: c.heb, smt: c.smt, smh: c.smh };
  })()`) as any;
  expect(info, 'sanity: at least one non-produce cut with no order_svsmoke citation must exist for a real negative case').toBeTruthy();

  await page.click('button[data-cnav="catalog"]');
  await page.click(`button.cattile[data-tilegroup="${info.group}"]`);
  const cardSel = '.card[data-kind="cut"]';
  await page.waitForSelector(cardSel, { timeout: 15000 });
  const gridCard = page.locator(cardSel).filter({ hasText: info.heb }).first();
  await gridCard.scrollIntoViewIfNeeded();

  const smokeLine = await gridCard.locator('.meta span', { hasText: 'עישון' }).innerText();
  expect(smokeLine, `grid card (${info.key}) smoke line was: ${smokeLine}`).toContain(`${info.smt}°`);
  expect(smokeLine).toContain(`/${info.smh}ש`);
});

// ── (b) Surface 2: work-plan row + its own EXPANDABLE DETAIL text must agree (self-contradiction dies)
test('CP1 Task3(b): work-plan brisket smoke row — the expanded detail temp === the row label temp', async ({ page }) => {
  await page.evaluate(`(function(){
    store.set('mk-tlview','plan');
    store.set('mk-tlplandetail','full');
    store.set('mk-tlshape','5');
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  await page.waitForSelector('#tlList .wp-acc', { timeout: 10000 });

  const smokeAcc = page.locator('#tlList .wp-acc').filter({ hasText: 'עישון' }).first();
  await smokeAcc.waitFor({ state: 'visible' });
  const label = await smokeAcc.locator('.wp-atitle').innerText();

  // the real click a user makes: tap the collapsed row's header to expand it
  await smokeAcc.locator('.wp-acch').click();
  await smokeAcc.locator('.wp-accb').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const acc = Array.from(document.querySelectorAll('#tlList .wp-acc')).find(el => (el.textContent || '').includes('עישון'));
    return !!acc && acc.classList.contains('open');
  });
  const det = await smokeAcc.locator('.wp-det').innerText();

  const labelTemp = (label.match(/(\d+(?:\.\d+)?)°/) || [])[1];
  const detTemp = (det.match(/(\d+(?:\.\d+)?)°/) || [])[1];
  expect(labelTemp, `row label was: ${label}`).toBeTruthy();
  expect(detTemp, `detail text was: ${det}; row label was: ${label}`).toBeTruthy();
  expect(detTemp, `detail (${det}) must show the SAME temp as its own row label (${label}) — never the stale catalog 105°`).toBe(labelTemp);
  expect(det).not.toContain('105°');

  await smokeAcc.screenshot({ path: 'mockups/cp1-workplan-detail-brisket.png' });
});

// ── (d) second findDetail collision (review finding, wave 1): meatGrillSteps' OFFAL branch pushes a
// step "הכנה לצלייה" ("Prep for grilling") that CONTAINS the Hebrew substring "צלייה" before the real
// grill step labeled EXACTLY "צלייה" ("Grill"). Pre-fix substring-first matching hit the prep step's
// text first; the exact-first tier (app.js findDetail, ~6503) must repair it. cut-69 (Beef Heart) is
// offal with default combo grill-only (methodRules ~948: def:['grill']) — verified LIVE below, never
// hardcoded — so its plan row is built from meatGrillSteps' offal branch, the exact collision site.
test('CP1 Task3(d) second findDetail collision: offal grill-only item (cut-69) plan detail shows the REAL grill step, not the prep-for-grilling step', async ({ page }) => {
  // sanity, read LIVE: cut-69 is Beef Heart / offal, and its default active combo really is grill-only
  const combo = await page.evaluate(`(function(){
    var c = resolveItem('cut-69');
    var p = itemProfile(c);
    return { eng: c.obj.eng, cat: c.obj.cat, combo: p.methods[0].combo };
  })()`) as any;
  expect(combo.eng, 'sanity: cut-69 is Beef Heart').toBe('Beef Heart');
  expect(combo.cat, 'sanity: cut-69 is offal (איברים פנימיים)').toBe('איברים פנימיים');
  expect(combo.combo, 'sanity: cut-69 default active combo is grill-only').toEqual(['grill']);

  await page.evaluate(`(function(){
    store.set('mk-tlview','plan');
    store.set('mk-tlplandetail','full');
    store.set('mk-tlshape','5');
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-69'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  await page.waitForSelector('#tlList .wp-acc', { timeout: 10000 });

  // the offal grill-only item's single cook stage renders as "🔥 גריל / אש ישירה" (itemStages ~3494,
  // combo.length===1 label) — its EXPANDABLE detail is what findDetail resolves from meatGrillSteps'
  // offal cardSteps, the exact collision the reviewer found.
  const grillAcc = page.locator('#tlList .wp-acc').filter({ hasText: 'גריל' }).first();
  await grillAcc.waitFor({ state: 'visible' });

  // the real click a user makes: tap the collapsed row's header to expand it
  await grillAcc.locator('.wp-acch').click();
  await grillAcc.locator('.wp-accb').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const acc = Array.from(document.querySelectorAll('#tlList .wp-acc')).find(el => (el.textContent || '').includes('גריל'));
    return !!acc && acc.classList.contains('open');
  });
  const det = await grillAcc.locator('.wp-det').innerText();

  // REAL grill step (meatGrillSteps offal branch, label exactly "צלייה"): "...עד השחמה יפה..." + the
  // doneness-specific offalDoneNote ("צלה חם ומהיר כמו סטייק — מדחום פנים 55°" for Beef Heart).
  expect(det, `detail was: ${det}`).toContain('השחמה יפה');
  expect(det, `detail was: ${det}`).toContain('מדחום פנים');
  // WRONG match (pre-fix substring-first hit "הכנה לצלייה" / "Prep for grilling" instead): its text talks
  // about a skewer for small pieces and salting timing — must NOT appear.
  expect(det, `detail was: ${det}`).not.toContain('שיפוד');
  expect(det, `detail was: ${det}`).not.toContain('מוקדם מוציא נוזלים');

  await grillAcc.screenshot({ path: 'mockups/cp1-offal-grill-detail.png' });
});
