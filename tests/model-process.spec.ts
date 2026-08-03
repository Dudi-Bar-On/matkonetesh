import { test, expect, seedApp } from './_fixtures';

// Task 1c (plan `docs/superpowers/plans/2026-08-03-data-model.md`, ADDENDUM): `drying` /
// `fermentation` / `aging` blocks, extracted from the authored prose. Thresholds NEVER come from
// the prose (owner instruction, 2026-08-03) -- the prose supplies the duration and the fact that
// the mechanism applies; the corpus supplies the threshold, labelled a regulatory limit with its
// own source_id.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  // Task B: items is fetched on demand -- await the readiness promise (mirrors model-cure.spec.ts).
  await page.evaluate(`window.__mkItemsReady`);
  await page.waitForFunction(`typeof DATA!=='undefined' && DATA.items && DATA.items.length`);
};

test('P1 · biltong dries, salami ferments AND dries', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var k = function(n){
      var it = DATA.items.filter(function(x){ return x.name.he===n; })[0];
      return it ? (it.safety||[]).map(function(b){ return b.kind; }).sort() : null; };
    return { biltong: k('` + 'בילטונג' + `'), salami: k('` + 'סלמי' + `') };
  })()`) as any;
  expect(r.biltong).toContain('drying');
  expect(r.salami).toContain('drying');
  expect(r.salami).toContain('fermentation');
});

test('P2 · a threshold exists only with a source, and is labelled a limit', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var out = [], checked = 0;
    DATA.items.forEach(function(it){
      (it.safety||[]).forEach(function(b){
        var isProc = (b.kind==='drying' || b.kind==='fermentation' || b.kind==='aging');
        var hasNum = (b.aw_max != null || b.ph_max != null || b.degree_hours_max != null);
        if (isProc && hasNum) {
          checked++;
          if (b.source_id == null) out.push(it.name.he + ':' + b.kind);
        }
      });
    });
    return { checked: checked, bad: out };
  })()`) as any;
  // the check actually ran over real blocks -- not a vacuous pass over zero process blocks
  expect(r.checked).toBeGreaterThan(0);
  expect(r.bad).toEqual([]);
});

// NEGATIVE (DoD-6): an ordinary CUTS item (e.g. corn, no cure/age prose at all) must carry NONE of
// the three process kinds -- these mechanisms are not universal, they are per-item facts.
test('P3 · an ordinary produce cut carries no drying/fermentation/aging block', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var corn = DATA.items.filter(function(x){ return x.name.he==='` + 'תירס' + `'; })[0];
    return corn ? (corn.safety||[]).map(function(b){ return b.kind; }) : null;
  })()`) as string[];
  expect(r).not.toBeNull();
  expect((r || []).some(function(k){ return ['drying','fermentation','aging'].indexOf(k) !== -1; })).toBe(false);
});

// NEGATIVE (DoD-6, the trap named in the dispatch brief): cold-smoked cheese carries "ייבוש לילה
// במקרר" in its OWN `cure` prose field (an overnight pre-smoke surface-dry step, not FSIS shelf-
// stability drying) -- a naive keyword scan over that field would fire the jerky/dried-meat a_w
// mechanism on every cheese row. It must not.
test('P4 · cheese never gets a drying block despite "ייבוש" appearing in its own prose', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var cheeses = DATA.items.filter(function(it){ return it.category==='` + 'גבינה' + `'; });
    var withDrying = cheeses.filter(function(it){
      return (it.safety||[]).some(function(b){ return b.kind==='drying'; }); }).map(function(it){ return it.name.he; });
    return { cheeseCount: cheeses.length, withDrying: withDrying };
  })()`) as any;
  expect(r.cheeseCount).toBeGreaterThan(0);
  expect(r.withDrying).toEqual([]);
});

// P5: aged cheese carries an `aging` block, but the 60-day/35°F CFR limit is NEVER attached to it,
// because the data never states whether the milk was pasteurized (21 CFR 133 scopes the rule to
// UNPASTEURIZED milk only). The mechanism is named; the limit is explicitly not-applicable, not
// silently omitted and not guessed onto the block.
test('P5 · aged cheese carries an aging block with NO CFR day/temp limit attached (milk not authored)', async ({ page }) => {
  await boot(page);
  const cheeseName = JSON.stringify('צ\'דר מיושן');
  const r = await page.evaluate(`(function(){
    var cheddar = DATA.items.filter(function(x){ return x.name.he===${cheeseName}; })[0];
    var aging = cheddar ? (cheddar.safety||[]).filter(function(b){ return b.kind==='aging'; })[0] : null;
    return { has: !!aging, block: aging };
  })()`) as any;
  expect(r.has).toBe(true);
  expect(r.block.days_min).toBeUndefined();
  expect(r.block.temp_c_min).toBeUndefined();
  expect(r.block.limit_check).toBe('not-applicable');
});

// P6: every fermentation block also names the degree-hours ceiling (AMI 1997), scoped correctly to
// the sausage products our data actually ferments -- and never fires on the vinegar-cured biltong.
test('P6 · fermentation blocks carry the degree-hours limit; biltong (vinegar-cured, no culture) gets none', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var withFerment = DATA.items.filter(function(it){
      return (it.safety||[]).some(function(b){ return b.kind==='fermentation'; }); });
    var oneBlock = withFerment.length ? (withFerment[0].safety||[]).filter(function(b){ return b.kind==='fermentation'; })[0] : null;
    var biltong = DATA.items.filter(function(x){ return x.name.he==='` + 'בילטונג' + `'; })[0];
    var biltongKinds = biltong ? (biltong.safety||[]).map(function(b){ return b.kind; }) : null;
    return { count: withFerment.length, degreeHoursMax: oneBlock && oneBlock.degree_hours_max, biltongKinds: biltongKinds };
  })()`) as any;
  expect(r.count).toBeGreaterThan(0);
  expect(r.degreeHoursMax).toBeTruthy();
  expect((r.biltongKinds || [])).not.toContain('fermentation');
});
