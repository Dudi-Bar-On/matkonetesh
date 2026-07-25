import { test, expect, seedApp } from './_fixtures';

// CP1 · Task 2 (spec 2026-07-25 §3.2, plan docs/superpowers/plans/2026-07-25-cooking-paths-cp1.md).
// The item CARD's stat line / plan steps / raw-data table must render the item's smoke/sv finish from
// the ONE accessor (effectiveSchedule) — killing the owner-reported contradiction: the card showed the
// catalog's 105°/3ש smoke finish for the brisket while the timeline showed the cited 120°/1.5ש
// (order_svsmoke.smoke). Real-UI walk per the owner's binding standard (spec §1.3): catalog nav clicks,
// not page.evaluate-only — copied from the systematic-debug evidence
// (scratch/debug-v264/gap1-card-vs-timeline.mjs). menu-seed + openTimeline() via evaluate follows the
// SAME already-reviewed/shipped convention as tests/bug3-order-finish.spec.ts (d)/(d2) — only the app
// setup step, not a surface the user clicks through.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof openCut==='function' && typeof resolveItem==='function' && typeof effectiveSchedule==='function' && typeof itemProfile==='function'`);
};

// The expected WIRED finish, read LIVE from the accessor — never hardcoded (per the task instructions).
async function wiredSmokeFinish(page: any, key: string) {
  return page.evaluate((k: string) => {
    const meta = (window as any).resolveItem(k);
    const profile = (window as any).itemProfile(meta);
    const m = profile.methods.find((x: any) => x.combo && x.combo.indexOf('sv') >= 0 && x.combo.indexOf('smoke') >= 0);
    const stages = (window as any).effectiveSchedule(meta, { methodKey: m.key }).stages;
    const smoke = stages.find((s: any) => s.kind === 'smoke');
    return { t: smoke.temp, h: smoke.hours, catalogT: meta.obj.smt, catalogH: meta.obj.smh };
  }, key);
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

// ── (a)+(b)+(c)+(d) in one real-UI walk: catalog click-through → card → timeline, same item ─────────
test('CONTRADICTION-KILL: brisket card (stat line, steps, raw table) shows the wired finish and matches the timeline — never the stale 105°', async ({ page }) => {
  const exp = await wiredSmokeFinish(page, 'cut-1');
  // sanity: the citation really does override the catalog for this item (or this test would be vacuous)
  expect(exp.catalogT, 'sanity: catalog smt for brisket').toBe(105);
  expect(exp.t, 'sanity: a citation actually overrides the catalog value').not.toBe(exp.catalogT);

  // ── real click-through: bottom-nav קטלוג → בשר אדום tile → the Brisket grid card ──
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
  const cardSel = '.card[data-kind="cut"]';
  await page.waitForSelector(cardSel, { timeout: 15000 });
  const gridCard = page.locator(cardSel).filter({ hasText: 'בריסקט' }).first();
  await gridCard.scrollIntoViewIfNeeded();
  await gridCard.click();
  await page.waitForSelector('#panel .panel-body #methodArea .steps', { timeout: 10000 });

  // (a) stat line: the "עישון" stat shows the wired temp/hours, not the catalog 105°
  const stats = await page.locator('#panel .statline .stat').allInnerTexts();
  const smokeStat = stats.find(s => s.includes('עישון'));
  expect(smokeStat, `stat line was: ${JSON.stringify(stats)}`).toBeTruthy();
  expect(smokeStat).toContain(`${exp.t}°`);
  expect(smokeStat).not.toContain('105°');
  await page.locator('#panel').screenshot({ path: 'mockups/cp1-card-brisket.png' });

  // (b) plan steps: the smoker-firing + smoke steps mention the wired temp, never 105°
  const stepsText = await page.locator('#methodArea .steps').innerText();
  expect(stepsText).toContain(`${exp.t}°`);
  expect(stepsText).not.toContain('105°');

  // (c) raw-data table: the "עישון (סו-ויד+עישון)" row matches the wired finish, not the catalog row
  const rawRows = await page.locator('#panel .raw').first().locator('table tr').allInnerTexts();
  const rawSmokeRow = rawRows.find(r => r.includes('סו-ויד+עישון'));
  expect(rawSmokeRow, `raw rows were: ${JSON.stringify(rawRows)}`).toBeTruthy();
  expect(rawSmokeRow).toContain(`${exp.t}°C`);
  expect(rawSmokeRow).not.toContain('105°C');

  // ── (d) CONTRADICTION-KILL: open the timeline for the SAME item — card value === timeline value ──
  await page.evaluate(() => { const x = document.querySelector('#panel .x') as HTMLElement | null; if (x) x.click(); });
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  await page.waitForSelector('#tlBody', { timeout: 10000 });
  await page.waitForFunction(() => { const b = document.getElementById('tlBody'); return !!b && b.textContent!.length > 50; });
  const expandBtn = page.locator('#tlBody [data-tlexp]').first();
  if (await expandBtn.count()) await expandBtn.click().catch(() => {});
  const tlStages = await page.locator('#tlBody .tl-stage').allInnerTexts();
  const tlSmokeStage = tlStages.find(s => s.includes('עישון'));
  expect(tlSmokeStage, `timeline stages were: ${JSON.stringify(tlStages)}`).toBeTruthy();
  expect(tlSmokeStage).toContain(`${exp.t}°`);   // === the card's value — the contradiction is dead
  await page.locator('#tlBody .tlcard').first().screenshot({ path: 'mockups/cp1-timeline-brisket.png' });
});

// ── (e) negative (regression control): an item with NO order_svsmoke citation renders IDENTICAL ────
// values to today (assert against the catalog values directly — real-UI walk, produce category).
test('negative: romaine hearts (no order_svsmoke citation) card values stay byte-identical to the catalog', async ({ page }) => {
  const catalog = await page.evaluate(() => {
    const m = (window as any).resolveItem('cut-103');
    return { smt: m.obj.smt, smh: m.obj.smh, hasCitation: !!(m.obj.order_svsmoke && m.obj.order_svsmoke.smoke) };
  });
  expect(catalog.hasCitation, 'sanity: romaine hearts must carry no order_svsmoke citation for this to be a real negative case').toBe(false);

  // real click-through: bottom-nav קטלוג → צמחי tile (ירקות/פירות) → the Romaine Hearts grid card
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="צמחי"]');
  const cardSel = '.card[data-kind="cut"]';
  await page.waitForSelector(cardSel, { timeout: 15000 });
  const gridCard = page.locator(cardSel).filter({ hasText: 'חסה רומאית' }).first();
  await gridCard.scrollIntoViewIfNeeded();
  await gridCard.click();
  await page.waitForSelector('#panel .panel-body #methodArea .steps', { timeout: 10000 });

  // produce statline shows a "גימור" (Finish) stat with smt only (no hours)
  const stats = await page.locator('#panel .statline .stat').allInnerTexts();
  const finishStat = stats.find(s => s.includes('גימור'));
  expect(finishStat, `stats were: ${JSON.stringify(stats)}`).toBeTruthy();
  expect(finishStat).toContain(`${catalog.smt}°`);

  const rawRows = await page.locator('#panel .raw').first().locator('table tr').allInnerTexts();
  const finishRow = rawRows.find(r => r.includes('גימור לאחר סו-ויד'));
  expect(finishRow, `raw rows were: ${JSON.stringify(rawRows)}`).toBeTruthy();
  expect(finishRow).toContain(`${catalog.smt}°C`);
  await page.locator('#panel').screenshot({ path: 'mockups/cp1-card-romaine-negative.png' });
});
