import { test, expect, seedApp } from './_fixtures';

// BUG-1 (owner bug round, 2026-07-25): itemStages() app.js hard-coded the stage label "עישון קר"
// (Cold smoke) for EVERY smoke→sv reverse-order stage, ignoring the citation's own order_smokesv.smoke.cold
// flag. 10 beef items (cold:false, 70-75°C — e.g. cut-1 Brisket at 75°) were mislabeled as cold-smoked on
// the timeline / plan strip / Live Copilot / Voice (all read the same stage list). Siblings cheeseBuild()
// and pantryAddFinish() hard-coded the same text unconditionally (no cold flag exists in cheese data at
// all, so those always render plain "עישון" after the fix). The safety-warning copy at app.js ~6377/6480
// becomes temp-agnostic ("שלב העישון" / "the smoke stage") — its LOGIC (warn on smoke-sv order) is
// untouched, only the wording that named the stage "cold".
//
// Investigation evidence (read-only repro scripts + screenshots): scratch/bug1-cold-smoke/.
// Reference (correct) pattern already in the codebase: sourcesBlock() app.js:2152, which branches on
// ob.smoke.cold.
//
// Data used by these tests (verified directly against sources.py / data.py, see report):
//   cut-1  (בריסקט/Brisket):        order_smokesv.smoke = {t:75, h:'1.5-2', cold:False}  → upperHours=2
//   cut-35 (ירך טלה/Leg of Lamb):    order_smokesv.smoke = {t:60, h:'1-2',   cold:True}   (the cited positive
//                                    control — 3 lamb items keep קר; owner ruling, citation governs)
//   spec-19 (גבינת שמנת מעושנת/Smoked Cream Cheese): cat='גבינה', smt=110, cure set, own note says HOT —
//                                    no cold-style flag exists in cheese data at all → always plain "עישון"

test.beforeEach(async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
});

// ── (a) Beef, cold:false — must NOT say "cold smoke" ──────────────────────────────────────────────
test('BUG-1(a) UI: brisket (cold:false, cited 75°) shows plain "עישון 75°", never "עישון קר"', async ({ page }) => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const orderSel = panel.locator('select[data-tlorder]').first();
  await expect(orderSel).toBeVisible();
  await orderSel.selectOption('smoke-sv');
  await expect(panel.locator('.tl-safety-warn')).toBeVisible();

  const stageTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage')).map(r => (r.textContent || '').trim()));
  const smokeRow = stageTexts.find(t => t.includes('עישון'));
  expect(smokeRow, `expected one .tl-stage row to mention עישון; rows were: ${JSON.stringify(stageTexts)}`).toBeTruthy();
  expect(smokeRow).toContain('עישון 75°');
  expect(smokeRow).not.toContain('עישון קר');

  // expand the card so the stage row with the fixed label is the visible evidence, not just present in the DOM
  const card = panel.locator('.tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: 'mockups/bug1-fixed-brisket.png' });
});

// ── (b) Lamb, cold:true — the FLAG-HONORED POSITIVE CASE / regression control ────────────────────
// NOTE (disclosed per systematic-debugging): pre-fix, this test ALSO passes — the unfixed itemStages()
// hard-codes "עישון קר" unconditionally, so a cold:true item renders correctly BY ACCIDENT. This test's
// only job is to prove the fix does not flip the 3 cited-cold lamb items to plain. Its meaningfulness was
// verified by mutation: temporarily inverting the fixed branch (osm.cold===true → osm.cold!==true) turned
// this test RED — see the report for the pasted before/after output.
test('BUG-1(b) UI: leg of lamb (cited cold:true, 60°) still shows "עישון קר 60°" — flag honored both ways', async ({ page }) => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-35'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const orderSel = panel.locator('select[data-tlorder]').first();
  await expect(orderSel).toBeVisible();
  await orderSel.selectOption('smoke-sv');
  await expect(panel.locator('.tl-safety-warn')).toBeVisible();

  const stageTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage')).map(r => (r.textContent || '').trim()));
  const smokeRow = stageTexts.find(t => t.includes('עישון'));
  expect(smokeRow, `expected one .tl-stage row to mention עישון; rows were: ${JSON.stringify(stageTexts)}`).toBeTruthy();
  expect(smokeRow).toContain('עישון קר 60°');

  // expand the card so the stage row with the (unchanged, correctly-cold) label is the visible evidence
  const card = panel.locator('.tlcard').first();
  await card.locator('[data-tlexp]').click();
  await card.locator('.tl-stages').first().waitFor({ state: 'visible' });
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: 'mockups/bug1-fixed-lamb.png' });
});

// ── (b2) pure-engine cross-check on itemStages() directly (mirrors order-effect.spec.ts's pattern) ──
test('BUG-1(b2) engine: itemStages branches on osm.cold, not a blanket "always cold"', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    function coldLabel(key){
      var meta=resolveItem(key);
      var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
      var stages=itemStages(meta, mm.key, true, 'smoke-sv');
      var smoke=stages.find(function(s){return s.kind==='smoke';});
      return smoke.label;
    }
    return { brisket: coldLabel('cut-1'), lamb: coldLabel('cut-35') };
  })()`) as any;
  expect(r.brisket).toBe('עישון 75°');
  expect(r.lamb).toBe('עישון קר 60°');
});

// ── (c) Cheese — no cold-style flag in cheese data at all → always plain "עישון" ──────────────────
test('BUG-1(c) UI: smoked cream cheese (smt=110, own note says HOT) build phase renders plain "עישון"', async ({ page }) => {
  await page.evaluate(`(function(){ openProjectWizard(resolveItem('spec-19')); })()`);
  const panel = page.locator('#panel');
  await panel.locator('[data-pwt="scratch"]').click();
  await panel.locator('[data-pwcreate]').click();

  const body = page.locator('#cProjBody');
  await expect(body).toBeVisible();
  const stepTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#cProjBody .cpc-step')).map(l => (l.textContent || '').trim()));
  const smokeStep = stepTexts.find(t => t.includes('עישון'));
  expect(smokeStep, `expected a prep step mentioning עישון; steps were: ${JSON.stringify(stepTexts)}`).toBeTruthy();
  expect(smokeStep).not.toContain('עישון קר');
  expect(smokeStep).toContain('עישון');
});

// ── (c2) pantryAddFinish() sibling — bought cheese, "add finish" flow ──────────────────────────────
test('BUG-1(c2) UI: pantryAddFinish() on a bought cheese also renders plain "עישון", not "עישון קר"', async ({ page }) => {
  await page.evaluate(`(function(){
    var meta=resolveItem('spec-19');
    var a=pantry();
    a.push({id:'test-bought-cheese', key:meta.key, name:meta.heb, source:'bought', stage:'ready', start:today(), doneSteps:[]});
    savePantry(a);
    cNavGo('projects');
  })()`);
  const body = page.locator('#cProjBody');
  await expect(body.locator('[data-cpfinish="test-bought-cheese"]')).toBeVisible();
  await body.locator('[data-cpfinish="test-bought-cheese"]').click();

  const subText = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('#cProjBody .cproj-card'))
      .find(c => c.querySelector('[data-cpfinish], [data-cpplan]'));
    return document.querySelector('#cProjBody .cpc-sub')?.textContent || '';
  });
  expect(subText).toContain('עישון');
  expect(subText).not.toContain('עישון קר');
});

// ── (d) Safety-warning copy — temp-agnostic; LOGIC (warn on smoke-sv order) is untouched ──────────
test('BUG-1(d) UI: danger-zone safety warning names "שלב העישון", not "העישון הקר"', async ({ page }) => {
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const orderSel = panel.locator('select[data-tlorder]').first();
  await expect(orderSel).toBeVisible();
  await orderSel.selectOption('smoke-sv');
  const warn = panel.locator('.tl-safety-warn').first();
  await expect(warn).toBeVisible();
  const warnText = await warn.innerText();
  expect(warnText).toContain('שלב העישון');
  expect(warnText).not.toContain('העישון הקר');
  // the LOGIC is untouched: the warning still only appears for the smoke-sv (reverse) order and still
  // names pasteurization as the requirement — assert both survive unchanged.
  expect(warnText).toContain('פסטור');
  await orderSel.selectOption('sv-smoke');
  await expect(warn).toBeHidden({ timeout: 5000 }).catch(async () => {
    // some layouts remove the node instead of hiding it — either is an acceptable "warning gone" signal
    expect(await panel.locator('.tl-safety-warn').count()).toBe(0);
  });
});

// ── (e) English mode — inline L() pairs, no leaked Hebrew for the changed strings ─────────────────
test('BUG-1(e) EN: brisket shows "Smoke 75°" (not "Cold smoke"), warning says "smoke stage" — no Hebrew leak', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en') });
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const orderSel = panel.locator('select[data-tlorder]').first();
  await expect(orderSel).toBeVisible();
  await orderSel.selectOption('smoke-sv');
  await expect(panel.locator('.tl-safety-warn')).toBeVisible();

  const stageTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#panel .tl-stage')).map(r => (r.textContent || '').trim()));
  const smokeRow = stageTexts.find(t => /Smoke/i.test(t));
  expect(smokeRow, `expected one .tl-stage row to mention Smoke; rows were: ${JSON.stringify(stageTexts)}`).toBeTruthy();
  expect(smokeRow).toContain('Smoke 75°');
  expect(smokeRow).not.toContain('Cold smoke');
  expect(smokeRow || '').not.toMatch(/[֐-׿]/);   // no leaked Hebrew glyphs

  const warnText = await panel.locator('.tl-safety-warn').first().innerText();
  expect(warnText.toLowerCase()).toContain('smoke stage');
  expect(warnText.toLowerCase()).not.toContain('cold smoke');
  expect(warnText).not.toMatch(/[֐-׿]/);
});

// ── DoD-10 safety invariance: the fix changes the LABEL only — temp/hours/kind stay cited-identical ─
test('BUG-1 invariance: fixed itemStages temp/hours/kind for brisket match the citation exactly (75°, 2.0h)', async ({ page }) => {
  const r = await page.evaluate(`(function(){
    var meta=resolveItem('cut-1');
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
    var stages=itemStages(meta, mm.key, true, 'smoke-sv');
    var smoke=stages.find(function(s){return s.kind==='smoke';});
    var sv=stages.find(function(s){return s.kind==='sv';});
    return { temp: smoke.temp, hours: smoke.hours, kind: smoke.kind, label: smoke.label, svTemp: sv.temp, svHours: sv.hours };
  })()`) as any;
  // citation: sources.py CUT_SOURCES[1].order_smokesv.smoke = {t:75, h:'1.5-2', cold:False} (upperHours('1.5-2')=2)
  //           .order_smokesv.sv = {t:68, h:'30', pasteurize:True} — matches the pre-fix screenshot (75°, 2.0ש)
  expect(r.temp).toBe(75);
  expect(r.hours).toBe(2);
  expect(r.kind).toBe('smoke');
  expect(r.svTemp).toBe(68);
  expect(r.svHours).toBe(30);
  // the ONLY thing this fix changes is the label text itself
  expect(r.label).toBe('עישון 75°');
});
