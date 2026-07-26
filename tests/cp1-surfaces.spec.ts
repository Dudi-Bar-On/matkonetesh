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

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CP1 · Task 4 (spec 2026-07-25 §4 "AI copilot/ask/menu grounding", plan Task 4). The AI grounding
// builders fed the model catalog smt/smh literals directly — askContextFor's catalog-entity summary
// (feeds askGemini's outgoing prompt) and the LOCAL "instant answers" engine (askCutTimes/askFire,
// real UI in the Ask-the-Fire panel) — so the assistant/local engine could answer 105° for brisket
// while every other surface (Task 1-3) already says 120°. Both REUSE svSmokeFinish(meta) — the SAME
// accessor wrapper the card/grid/work-plan already reuse — never re-deriving the methodKey/order
// lookup (binding reviewer note). svt/svh/sot/soh stay untouched (spec §5: svt is safety-invariant).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── (a) Real-UI: the "instant answers" panel (Ask-the-Fire LOCAL engine, no AI key configured) ─────
test('CP1 Task4(a): Ask-the-Fire LOCAL instant answer shows the wired smoke finish, not catalog 105°/3ש (brisket)', async ({ page }) => {
  const wired = await wiredFinish(page, 'cut-1');
  const catalogSmt = await page.evaluate(() => (window as any).resolveItem('cut-1').obj.smt);
  expect(catalogSmt, 'sanity: catalog smt for brisket').toBe(105);
  expect(wired.t, 'sanity: the citation overrides the catalog value').not.toBe(catalogSmt);

  await page.evaluate(() => (window as any).openAsk());
  await page.waitForSelector('#askq', { timeout: 10000 });
  await page.fill('#askq', 'כמה זמן לעשן בריסקט');
  await page.click('#askgo');
  await page.waitForSelector('#askthread .ask-a .abubble', { timeout: 10000 });
  const answer = await page.locator('#askthread .ask-a .abubble').first().innerText();
  expect(answer, `local answer was: ${answer}`).toContain(`${wired.t}°`);
  expect(answer).not.toContain('105°');
  await page.locator('#askthread').screenshot({ path: 'mockups/cp1-ask-local-brisket.png' });
});

// ── (b) String-assertion: AI grounding (askContextFor → the model payload via askGemini/gemFetch) ──
// The ctx text is never rendered literally in the UI — it is model-input text (per the task's own
// framing) — so this asserts the BUILT STRING directly (askContextFor), then confirms it actually
// reaches the real outgoing network payload (askGemini, gemFetch intercepted — same seam
// tests/ai-trust.spec.ts uses) so the fix is proven live, not just as an inert helper.
test('CP1 Task4(b): AI grounding context carries the wired finish, not catalog 105°/3ש, and reaches the model payload (brisket)', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-gemkey': JSON.stringify('test-key') });
  await page.waitForFunction(`typeof askGemini==='function' && typeof askContextFor==='function' && typeof svSmokeFinish==='function'`);
  const wired = await page.evaluate(() => (window as any).svSmokeFinish((window as any).resolveItem('cut-1')));

  const ctx = await page.evaluate(() => (window as any).askContextFor('בריסקט').ctx);
  expect(ctx, `ctx was: ${ctx}`).toContain(`עישון ${wired.t}°C`);
  expect(ctx).not.toContain('עישון 105°C');

  await page.evaluate(`window.__cap=[]; window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body}); return { ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]}) }; };`);
  await page.evaluate(`askGemini('בריסקט', [])`);
  await page.waitForFunction(`window.__cap.length > 0`, undefined, { timeout: 10000 });
  const body = await page.evaluate(`window.__cap[0].body`) as any;
  const promptText = body.contents[body.contents.length - 1].parts[0].text;
  expect(promptText, `outgoing prompt was: ${promptText}`).toContain(`עישון ${wired.t}°C`);
  expect(promptText).not.toContain('עישון 105°C');
});

// ── negative: askContextFor / askCutTimes stay catalog-identical for an uncited item (romaine) ─────
test('CP1 Task4 negative: AI grounding + local instant answer stay catalog-identical for an uncited item (romaine hearts)', async ({ page }) => {
  const catalog = await page.evaluate(() => {
    const m = (window as any).resolveItem('cut-103');
    return { smt: m.obj.smt, smh: m.obj.smh, hasCitation: !!(m.obj.order_svsmoke && m.obj.order_svsmoke.smoke) };
  });
  expect(catalog.hasCitation, 'sanity: romaine hearts carries no order_svsmoke citation').toBe(false);

  const ctx = await page.evaluate(() => (window as any).askContextFor('חסה רומאית').ctx);
  expect(ctx, `ctx was: ${ctx}`).toContain(`עישון ${catalog.smt}°C/${catalog.smh}ש`);

  await page.evaluate(() => (window as any).openAsk());
  await page.waitForSelector('#askq', { timeout: 10000 });
  await page.fill('#askq', 'כמה זמן לעשן חסה רומאית');
  await page.click('#askgo');
  await page.waitForSelector('#askthread .ask-a .abubble', { timeout: 10000 });
  const answer = await page.locator('#askthread .ask-a .abubble').first().innerText();
  expect(answer, `local answer was: ${answer}`).toContain(`${catalog.smt}°`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE CP1 GATE (spec 2026-07-25 §8: "per-surface fidelity witnesses; the six formerly-wrong surfaces
// render citation values; screenshots each"). One sweep per item: EVERY §4 surface — catalog grid
// card, item card (stat line + raw table), per-item timeline (stage rows), work-plan (row label +
// expanded detail), the combined events screen, and the AI grounding context — must agree on the
// SAME figure. Two wired items (brisket = beef, cut-113 = wired seafood) plus the negative control
// (cut-103, no citation at all, forced onto its sv+smoke ALT combo so the same surfaces are
// exercised) closes CP1. The sv+smoke combo is force-pinned via mk-tlstate-draft (the exact
// per-item method-override mechanism the app's own method toggle writes) so every surface reads the
// SAME method, independent of each item's own default toggle state (brisket/shrimp already default
// to it; romaine's card default is grill-only — methodRules ~942 — so it must be pinned to be
// comparable at all, per the spec's own note that sv+smoke is "a valid alt combo" for produce).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

type GateItem = { key: string; heb: string; tileGroup: string; label: string; isProduce: boolean };
const GATE_POSITIVE: GateItem[] = [
  { key: 'cut-1', heb: 'בריסקט', tileGroup: 'בשר אדום', label: 'brisket', isProduce: false },
  { key: 'cut-113', heb: "חסילון ג'מבו", tileGroup: 'ים', label: 'jumbo-shrimp', isProduce: false },
];
const GATE_NEGATIVE: GateItem = { key: 'cut-103', heb: 'חסה רומאית', tileGroup: 'צמחי', label: 'romaine-negative', isProduce: true };

async function pinSvSmoke(page: any, key: string): Promise<string> {
  // NOTE: store is a top-level `const` in app.js (a classic, non-module script) — it is visible to a
  // bare-identifier reference evaluated in the page's own global scope (a STRING body, like every other
  // spec file's store.set/get calls), but NOT as a `window.store` property (const never attaches to
  // window) — hence the string-template form here rather than an arrow function reading window.store.
  return page.evaluate(`(function(){
    var meta = resolveItem(${JSON.stringify(key)});
    var mk = itemProfile(meta).methods.find(function(m){ return m.combo && m.combo.indexOf('sv') >= 0 && m.combo.indexOf('smoke') >= 0; }).key;
    store.set('mk-tlstate-draft', { ${JSON.stringify(key)}: { method: mk, methodPinned: true, ready: true, svSmokeOrder: 'sv-smoke' } });
    return mk;
  })()`);
}

async function runGateSweep(page: any, item: GateItem, expectWired: boolean) {
  const mk = await pinSvSmoke(page, item.key);
  const gt = await page.evaluate(({ key, mk }: { key: string; mk: string }) => {
    const meta = (window as any).resolveItem(key);
    const wired = (window as any).svSmokeFinish(meta);
    const stages = (window as any).effectiveSchedule(meta, { methodKey: mk }).stages;
    const totalH = stages.reduce((a: number, s: any) => a + (s.hours || 0), 0);
    return { wired, catalogT: meta.obj.smt, catalogH: meta.obj.smh, totalH };
  }, { key: item.key, mk });
  expect(gt.wired, `[${item.label}] sanity: svSmokeFinish must resolve a value`).toBeTruthy();
  if (expectWired) expect(gt.wired.t, `[${item.label}] sanity: the citation overrides the catalog value`).not.toBe(gt.catalogT);
  else expect(gt.wired.t, `[${item.label}] sanity: no citation → the accessor falls back to the catalog value`).toBe(gt.catalogT);
  const shot = (s: string) => `mockups/cp1-gate-${item.label}-${s}.png`;

  // ── 1. catalog GRID card ──
  await page.click('button[data-cnav="catalog"]');
  await page.click(`button.cattile[data-tilegroup="${item.tileGroup}"]`);
  const cardSel = '.card[data-kind="cut"]';
  await page.waitForSelector(cardSel, { timeout: 15000 });
  const gridCard = page.locator(cardSel).filter({ hasText: item.heb }).first();
  await gridCard.scrollIntoViewIfNeeded();
  if (item.isProduce) {
    // produce grid cards never read smtV/smhV at all (cutCard app.js ~1748) — the "גריל" line is the
    // only cook-figure shown and is always the catalog's sot, regardless of the pinned combo above.
    const grillLine = await gridCard.locator('.meta').first().locator('span', { hasText: 'גריל' }).first().innerText();
    const catalogSot = await page.evaluate((key: string) => (window as any).resolveItem(key).obj.sot, item.key);
    expect(grillLine, `[${item.label}] grid grill line was: ${grillLine}`).toContain(`${catalogSot}°`);
  } else {
    const gridLine = await gridCard.locator('.meta span', { hasText: 'עישון' }).innerText();
    expect(gridLine, `[${item.label}] grid line was: ${gridLine}`).toContain(`${gt.wired.t}°`);
    if (expectWired) expect(gridLine).not.toContain(`${gt.catalogT}°`);
  }

  // ── 2. item CARD: stat line + raw table ──
  await gridCard.click();
  await page.waitForSelector('#panel .panel-body #methodArea .steps', { timeout: 10000 });
  const stats = await page.locator('#panel .statline .stat').allInnerTexts();
  const statLabel = item.isProduce ? 'גימור' : 'עישון';
  const smokeStat = stats.find(s => s.includes(statLabel));
  expect(smokeStat, `[${item.label}] stat line was: ${JSON.stringify(stats)}`).toBeTruthy();
  expect(smokeStat).toContain(`${gt.wired.t}°`);
  const rawRows = await page.locator('#panel .raw').first().locator('table tr').allInnerTexts();
  const rawLabel = item.isProduce ? 'גימור לאחר סו-ויד' : 'עישון';
  const rawSmokeRow = rawRows.find(r => r.includes(rawLabel));
  expect(rawSmokeRow, `[${item.label}] raw rows were: ${JSON.stringify(rawRows)}`).toBeTruthy();
  expect(rawSmokeRow).toContain(`${gt.wired.t}°C`);
  await page.locator('#panel').screenshot({ path: shot('card') });
  await page.evaluate(() => { const x = document.querySelector('#panel .x') as HTMLElement | null; if (x) x.click(); });

  // ── 3. per-item TIMELINE (stage rows, default "by item" view) — the pinned sv+smoke combo above ──
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:[${JSON.stringify(item.key)}],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    store.set('mk-tlview','items');
    openTimeline();
  })()`);
  await page.waitForSelector('#panel .tlcard', { timeout: 10000 });
  const tlCard = page.locator('#panel .tlcard').first();
  await tlCard.locator('[data-tlexp]').click();
  await tlCard.locator('.tl-stages').first().waitFor({ state: 'visible' });
  const stageTexts = await page.locator('#panel .tl-stage').allInnerTexts();
  const smokeRow = stageTexts.find(t => t.includes('עישון'));
  expect(smokeRow, `[${item.label}] timeline rows were: ${JSON.stringify(stageTexts)}`).toBeTruthy();
  expect(smokeRow).toContain(`${gt.wired.t}°`);
  await tlCard.screenshot({ path: shot('timeline') });

  // ── 4. WORK-PLAN row label + expanded detail (same underlying buildList(), plan view) ──
  await page.evaluate(`(function(){
    store.set('mk-tlview','plan');
    store.set('mk-tlplandetail','full');
    store.set('mk-tlshape','5');
    openTimeline();
  })()`);
  await page.waitForSelector('#tlList .wp-acc', { timeout: 10000 });
  const smokeAcc = page.locator('#tlList .wp-acc').filter({ hasText: 'עישון' }).first();
  await smokeAcc.waitFor({ state: 'visible' });
  const rowLabel = await smokeAcc.locator('.wp-atitle').innerText();
  expect(rowLabel, `[${item.label}] work-plan row label was: ${rowLabel}`).toContain(`${gt.wired.t}°`);
  await smokeAcc.locator('.wp-acch').click();
  await smokeAcc.locator('.wp-accb').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const acc = Array.from(document.querySelectorAll('#tlList .wp-acc')).find(el => (el.textContent || '').includes('עישון'));
    return !!acc && acc.classList.contains('open');
  });
  const detText = await smokeAcc.locator('.wp-det').innerText();
  expect(detText, `[${item.label}] work-plan detail was: ${detText}`).toContain(`${gt.wired.t}°`);
  await smokeAcc.screenshot({ path: shot('workplan') });

  // ── 5. combined EVENTS screen (spec table: "itemStages ✓ v264, unchanged" — asserted anyway) ──
  // NOTE: store.set(k,v) stringifies v ITSELF (app.js store.set) — pass raw objects here, never
  // JSON.stringify them again (that produced a doubly-encoded string store.get would return unparsed).
  await page.evaluate(`(function(){
    store.set('mk-events', [{id:'gate-ev', name:'gate', serve:'19:00', menu:{keys:[${JSON.stringify(item.key)}]}}]);
    store.set('mk-tlstate-gate-ev', { ${JSON.stringify(item.key)}: { method: ${JSON.stringify(mk)}, ready: true } });
  })()`);
  const evRow = await page.evaluate((key: string) =>
    (window as any).combinedEventsRows().find((r: any) => r.key === key), item.key);
  expect(evRow, `[${item.label}] events row must exist`).toBeTruthy();
  expect(evRow.totalH, `[${item.label}] events total hours must match the accessor's own stage sum`).toBeCloseTo(gt.totalH, 5);
  await page.evaluate(() => (window as any).openCombinedTimeline());
  await page.waitForSelector('#panel .cet-row', { timeout: 10000 });
  await page.locator('#panel').screenshot({ path: shot('events') });

  // ── 6. AI grounding context (model-input text — string assertion, no UI to click) ──
  const ctx = await page.evaluate((heb: string) => (window as any).askContextFor(heb).ctx, item.heb);
  expect(ctx, `[${item.label}] AI grounding ctx was: ${ctx}`).toContain(`עישון ${gt.wired.t}°C`);
  if (expectWired) expect(ctx).not.toContain(`עישון ${gt.catalogT}°C`);
}

for (const item of GATE_POSITIVE) {
  test(`CP1 GATE: ${item.label} — every §4 surface agrees on the wired finish (card, grid, timeline, work-plan, events, AI)`, async ({ page }) => {
    await runGateSweep(page, item, true);
  });
}

test('CP1 GATE negative: romaine hearts (cut-103, no citation) stays consistent on catalog values everywhere, including AI grounding', async ({ page }) => {
  await runGateSweep(page, GATE_NEGATIVE, false);
});
