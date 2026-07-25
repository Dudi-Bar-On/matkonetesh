import { test, expect, seedApp } from './_fixtures';

// BUG-3 / Wave C (owner ruling, 2026-07-25, explicit): "Wire now for all 18." order_svsmoke in
// sources.py carries cited post-sous-vide finishing schedules for 18 items — 10 beef (finish 120°/1.5h-
// class values) + 8 seafood n=113,114,115,117,118,119,126,127 (gentle ~100°/9min finishes) — that
// itemStages()'s default sv→smoke branch (app.js ~3420) never read; it used the catalog's smt/smh, so
// e.g. SV'd shrimp was scheduled for a 230° reblast while the cited correct 100° finish sat orphaned.
//
// Verified directly against sources.py / data.py (see report for the full derivation):
//   cut-1   (בריסקט/Brisket):      catalog smt/smh = 105°/3h   → order_svsmoke.smoke = {t:120,h:'1.5',cold:false}
//   cut-113 (שרימפס ג'מבו/Jumbo Shrimp): catalog smt/smh = 230°/0.1h → order_svsmoke.smoke = {t:100,h:'0.15',cold:false}
//   cut-103 (חסה רומאית/Romaine Hearts): NO order_svsmoke at all (produce, sv+smoke is a valid alt combo,
//                                        not the card default) — the negative case: smt/smh must stay
//                                        catalog-identical (250°/0.05h) when no citation exists.
//
// The 18-item scope: sources.py CUT_SOURCES[n].order_svsmoke.smoke for n in
//   [1,2,10,14,21,24,25,51,52,56]  (beef, from scratch/research/beef-1-braising.json)
//   [113,114,115,117,118,119,126,127]  (seafood/fish, from scratch/research/seafood-fish.json)
// — the set the deep investigation flagged as DIFFERING from the catalog's smt/smh (the wiring itself is
// generic/data-driven — any item with order_svsmoke.smoke gets read — this list is the verification scope).
const BEEF18 = [1, 2, 10, 14, 21, 24, 25, 51, 52, 56];
const SEAFOOD18 = [113, 114, 115, 117, 118, 119, 126, 127];
const ALL18 = [...BEEF18, ...SEAFOOD18];

test.beforeEach(async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
});

// ── (a) engine: brisket default (sv→smoke) order reads the CITED finish, not catalog smt/smh ──────
test('BUG-3(a) engine: brisket default-order finish = cited 120°/1.5h (not catalog 105°/3h)', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    var meta=resolveItem('cut-1');
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
    var stages=itemStages(meta, mm.key, true, 'sv-smoke');
    var smoke=stages.find(function(s){return s.kind==='smoke';});
    return { temp: smoke.temp, hours: smoke.hours, label: smoke.label, catalogSmt: meta.obj.smt, catalogSmh: meta.obj.smh, cited: meta.obj.order_svsmoke.smoke };
  })()`) as any;
  // sanity: the citation itself is what we think it is
  expect(r.cited).toEqual({ t: 120, h: '1.5', cold: false });
  expect(r.catalogSmt).toBe(105);
  // the WIRED assertion — this is what must go from RED to GREEN
  expect(r.temp).toBe(120);
  expect(r.hours).toBe(1.5);
  expect(r.label).toBe('עישון 120°');   // plain smoke — order_svsmoke.smoke.cold is false, never true today
});

// ── (b) engine: shrimp default-order finish = cited gentle 100°/9min (not catalog 230° reblast) ──
test('BUG-3(b) engine: jumbo shrimp default-order finish = cited 100°/0.15h (not catalog 230°/0.1h)', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    var meta=resolveItem('cut-113');
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
    var stages=itemStages(meta, mm.key, true, 'sv-smoke');
    var smoke=stages.find(function(s){return s.kind==='smoke';});
    return { temp: smoke.temp, hours: smoke.hours, label: smoke.label, catalogSmt: meta.obj.smt, catalogSmh: meta.obj.smh, cited: meta.obj.order_svsmoke.smoke };
  })()`) as any;
  expect(r.cited).toEqual({ t: 100, h: '0.15', cold: false });
  expect(r.catalogSmt).toBe(230);
  expect(r.temp).toBe(100);
  expect(r.hours).toBe(0.15);
  expect(r.label).toBe('עישון 100°');
});

// ── (c) negative: an item WITHOUT order_svsmoke keeps smt/smh byte-identical ───────────────────────
test('BUG-3(c) engine negative: romaine hearts (no order_svsmoke citation) keeps catalog smt/smh untouched', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    var meta=resolveItem('cut-103');
    var hasCitation = !!(meta.obj.order_svsmoke && meta.obj.order_svsmoke.smoke);
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
    var stages=itemStages(meta, mm.key, true, 'sv-smoke');
    var smoke=stages.find(function(s){return s.kind==='smoke';});
    return { hasCitation: hasCitation, temp: smoke.temp, hours: smoke.hours, catalogSmt: meta.obj.smt, catalogSmh: meta.obj.smh };
  })()`) as any;
  expect(r.hasCitation).toBe(false);
  expect(r.catalogSmt).toBe(250);
  expect(r.catalogSmh).toBe('0.05');
  // byte-identical to the catalog values — nothing was wired because there was nothing cited
  expect(r.temp).toBe(r.catalogSmt);
  expect(r.hours).toBe(0.05);
});

// ── boundary: smoke-ONLY combo (no sv) stays OUT of scope even for an item that DOES carry the
// citation — proves the hasSV guard, not just "no citation" (the romaine case above conflates the two).
test('BUG-3(c2) engine negative: brisket smoke-ONLY combo ignores order_svsmoke.smoke despite carrying it', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    var meta=resolveItem('cut-1');
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.length===1&&m.combo[0]==='smoke';});
    var stages=itemStages(meta, mm.key, true, 'sv-smoke');
    var smoke=stages.find(function(s){return s.kind==='smoke';});
    return { found: !!mm, hasCitation: !!(meta.obj.order_svsmoke&&meta.obj.order_svsmoke.smoke), temp: smoke.temp, hours: smoke.hours, mSmTemp: mm.smTemp, mSmHours: mm.smHours };
  })()`) as any;
  expect(r.found, 'brisket must offer a smoke-only combo to exercise this boundary').toBe(true);
  expect(r.hasCitation).toBe(true);   // brisket DOES carry order_svsmoke.smoke — the point of this test
  // no sv stage in this combo => no "post-sv finish" to cite => the smoke-only method entry's own
  // temp/hours (catalog sot/soh, per comboMethodEntry), untouched by order_svsmoke
  expect(r.temp).toBe(r.mSmTemp);
  expect(r.hours).toBe(r.mSmHours);
  expect(r.temp).not.toBe(120);   // sanity: NOT the cited order_svsmoke.smoke value (120°) that would
  expect(r.hours).not.toBe(1.5);  // leak in if the hasSV guard were missing
});

// ── (d) UI: the muted timeline sub-line renders for BOTH a reverse-order stage and a wired finish ──
test('BUG-3(d) UI: timeline sub-line renders — reverse-order explainer AND wired-finish explainer', async ({ page }) => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const card = panel.locator('.tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });

  // default order (sv→smoke) is selected by default — the newly-wired finish's sub-line
  const subLines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage-sub')).map(el => (el.textContent || '').trim()));
  expect(subLines.find(t => t.includes('גימור לאחר סו-ויד — מקור מצוטט')),
    `expected a wired-finish sub-line; sub-lines were: ${JSON.stringify(subLines)}`).toBeTruthy();
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: 'mockups/bug3-wired-brisket.png' });

  // switch to the reverse order — its own (pre-existing feature, now sub-lined) explainer
  const orderSel = panel.locator('select[data-tlorder]').first();
  await orderSel.selectOption('smoke-sv');
  await expect(panel.locator('.tl-safety-warn')).toBeVisible();
  const subLines2 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage-sub')).map(el => (el.textContent || '').trim()));
  expect(subLines2.find(t => t.includes('עישון קצר — הפסטור המלא בסו-ויד')),
    `expected a reverse-order sub-line; sub-lines were: ${JSON.stringify(subLines2)}`).toBeTruthy();
});

// ── shrimp UI screenshot (gentle wired finish, distinct item from brisket) ─────────────────────────
test('BUG-3(d2) UI: jumbo shrimp timeline shows the wired gentle finish', async ({ page }) => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-113'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const card = panel.locator('.tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });
  const stageTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage')).map(r => (r.textContent || '').trim()));
  const smokeRow = stageTexts.find(t => t.includes('עישון'));
  expect(smokeRow, `expected a smoke stage row; rows were: ${JSON.stringify(stageTexts)}`).toBeTruthy();
  expect(smokeRow).toContain('עישון 100°');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: 'mockups/bug3-wired-shrimp.png' });
});

// ── (e) sourcesBlock shows the citation note for brisket's order boxes ─────────────────────────────
test('BUG-3(e) UI: sourcesBlock renders order_smokesv.note for brisket ("only surface needs pasteurizing")', async ({ page }) => {
  await page.evaluate(`openCut(DATA.cuts.find(function(x){return x.n===1;}))`);
  const raw = page.locator('#panel .raw').last();
  await expect(raw).toBeVisible();
  const text = await raw.innerText();
  expect(text).toContain('only surface needs pasteurizing');
  // order_svsmoke has no cited note for cut-1 — the box must render without one, not crash (Hebrew UI default)
  expect(text).toContain('סו-ויד→עישון');
});

// ── (f) EN mode: no Hebrew leak in the new composed sub-lines ───────────────────────────────────────
test('BUG-3(f) EN: sub-lines render in English, no leaked Hebrew glyphs', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en') });
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const card = panel.locator('.tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });
  const subLines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage-sub')).map(el => (el.textContent || '').trim()));
  const wired = subLines.find(t => /post-sous-vide finish/i.test(t));
  expect(wired, `expected an EN wired-finish sub-line; sub-lines were: ${JSON.stringify(subLines)}`).toBeTruthy();
  expect(wired).toContain('post-sous-vide finish — cited source');
  expect(wired || '').not.toMatch(/[֐-׿]/);

  const orderSel = panel.locator('select[data-tlorder]').first();
  await orderSel.selectOption('smoke-sv');
  await expect(panel.locator('.tl-safety-warn')).toBeVisible();
  const subLines2 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage-sub')).map(el => (el.textContent || '').trim()));
  const rev = subLines2.find(t => /short smoke/i.test(t));
  expect(rev, `expected an EN reverse-order sub-line; sub-lines were: ${JSON.stringify(subLines2)}`).toBeTruthy();
  expect(rev).toContain('short smoke — full pasteurization in the sous-vide');
  expect(rev || '').not.toMatch(/[֐-׿]/);
});

// ── (g) DATA-FIDELITY (this wave's DoD-10 form, owner-ruling wave): every wired stage temp/hour ────
// equals its citation byte-for-byte, for all 18 items, and safe/bcheck/svt/svh stay UNTOUCHED.
test('BUG-3(g) DATA-FIDELITY: all 18 wired items match their citation exactly; safety fields untouched', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    function upperHoursJS(h){
      if(typeof h!=='string') return parseFloat(h)||0;
      var parts=h.replace(/[^0-9.\\-]/g,'').split('-').filter(Boolean);
      if(!parts.length) return 0;
      return parseFloat(parts[parts.length-1])||0;
    }
    var ns=${JSON.stringify(ALL18)};
    return ns.map(function(n){
      var meta=resolveItem('cut-'+n);
      var cited=meta.obj.order_svsmoke.smoke;
      var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
      var stages=itemStages(meta, mm.key, true, 'sv-smoke');
      var smoke=stages.find(function(s){return s.kind==='smoke';});
      var sv=stages.find(function(s){return s.kind==='sv';});
      var bcheck=stages.find(function(s){return s.kind==='bcheck';});
      return {
        n: n,
        citedT: cited.t, citedH: upperHoursJS(cited.h),
        wiredT: smoke.temp, wiredH: smoke.hours,
        svT: sv?sv.temp:null, catalogSvt: meta.obj.svt,
        svH: sv?sv.hours:null, catalogSvh: upperHoursJS(meta.obj.svh),
        bcheckT: bcheck?bcheck.temp:null,
        catalogSafe: (meta.obj.safe!=null?meta.obj.safe:meta.obj.tgt)
      };
    });
  })()`) as any[];

  expect(r.length).toBe(18);
  for (const row of r) {
    expect(row.wiredT, `n=${row.n} temp`).toBe(row.citedT);
    expect(row.wiredH, `n=${row.n} hours`).toBe(row.citedH);
    // safety invariance — the wave changes finish-stage temps ONLY; sv/safety stay catalog-identical
    expect(row.svT, `n=${row.n} sv temp untouched`).toBe(row.catalogSvt);
    expect(row.svH, `n=${row.n} sv hours untouched`).toBe(row.catalogSvh);
    expect(row.bcheckT, `n=${row.n} bcheck/safe target untouched`).toBe(row.catalogSafe);
  }
});
