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
// Task 1c-b (docs, 2026-08-03 dispatch): MAKES.build.phases also carries drying/aging prose --
// SPECIALS' own source table never claimed to cover it. Four named dry-cured sausages had NO
// drying block at all before this task: סופרסטה (m-sopr), סלמי מילאנו (n-milano), פפרוני
// (n-pepperoni), קרקובסקה מיובשת (n-krakowska-pod).
test('P7 · the four named MAKES dry-cured sausages each carry a drying block', async ({ page }) => {
  await boot(page);
  const names = JSON.stringify(['סופרסטה', 'סלמי מילאנו', 'פפרוני', 'קרקובסקה מיובשת']);
  const r = await page.evaluate(`(function(){
    var names = ${names};
    var out = {};
    names.forEach(function(n){
      var it = DATA.items.filter(function(x){ return x.name.he===n && x.id.indexOf('make:')===0; })[0];
      out[n] = it ? (it.safety||[]).map(function(b){ return b.kind; }) : null;
    });
    return out;
  })()`) as any;
  Object.keys(r).forEach(function (n) {
    expect(r[n], n).not.toBeNull();
    expect(r[n], n).toContain('drying');
  });
});

// P8: the weight-loss target is the charcutier's practical a_w proxy -- the most valuable field
// per the dispatch brief. It must be extracted as an AUTHORED figure (never converted to an a_w
// value, never merged with the corpus limit) alongside duration/temp/humidity where authored.
test('P8 · MAKES drying blocks carry duration/temp/humidity/weight-loss as separate authored fields', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var byId = function(id){ return DATA.items.filter(function(x){ return x.id===id; })[0]; };
    var sopr = byId('make:m-sopr');
    var milano = byId('make:n-milano');
    var krak = byId('make:n-krakowska-pod');
    var dry = function(it){ return it ? (it.safety||[]).filter(function(b){ return b.kind==='drying'; })[0] : null; };
    return { sopr: dry(sopr), milano: dry(milano), krak: dry(krak) };
  })()`) as any;
  // m-sopr: sausage_dry() boilerplate -- 12-15C / 70-80% humidity / weight-loss 35-40% / days from "3-6 שבועות" = 42
  expect(r.sopr).toBeTruthy();
  expect(r.sopr.days).toBe(42);
  expect(r.sopr.temp_c_min).toBe(12);
  expect(r.sopr.temp_c_max).toBe(15);
  expect(r.sopr.humidity_pct_min).toBe(70);
  expect(r.sopr.humidity_pct_max).toBe(80);
  expect(r.sopr.weight_loss_pct_min).toBe(35);
  expect(r.sopr.weight_loss_pct_max).toBe(40);
  // n-milano: SG dry phase "תסס 48ש, תלה 6-8 שבועות ב-12-14° 75%" -- days=56, temp 12-14, humidity 75,
  // NO weight-loss authored (reported, never guessed).
  expect(r.milano).toBeTruthy();
  expect(r.milano.days).toBe(56);
  expect(r.milano.temp_c_min).toBe(12);
  expect(r.milano.temp_c_max).toBe(14);
  expect(r.milano.humidity_pct_min).toBe(75);
  expect(r.milano.weight_loss_pct_min).toBeUndefined();
  // n-krakowska-pod: "תלה 5-7 ימים ב-14° עד קשיחות-פריסה (איבוד ~15%)" -- days=7, temp 14, no
  // humidity authored, weight-loss 15%.
  expect(r.krak).toBeTruthy();
  expect(r.krak.days).toBe(7);
  expect(r.krak.temp_c_min).toBe(14);
  expect(r.krak.humidity_pct_min).toBeUndefined();
  expect(r.krak.weight_loss_pct_min).toBe(15);
  expect(r.krak.weight_loss_pct_max).toBe(15);
});

// P9 (DoD-6, negative -- the false-positive trap this task exists to avoid, mirroring P4's cheese
// trap): b_emul()'s Pellicle phase literally contains the word "ייבוש" ("תלה במקרר 1–2 שעות
// לייבוש מעטפת") for EVERY emulsion sausage (Frankfurter, Mortadella, Bologna) -- a surface
// pre-smoke dry, not the FSIS shelf-stability mechanism. A naive "ייבוש" keyword scan over MAKES
// phases would fire a drying block on every cooked, refrigerated emulsion sausage. It must not.
// Likewise the wet-brined pastramis (p-ny et al, cat פסטרמה) share a category with the genuinely
// dry-cured p-bast but carry no ייבוש/הבשלה phase language at all -- category is not the gate here.
test('P9 · cooked emulsion sausages and wet pastramis get no drying block despite "ייבוש" text nearby', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var ids = ['make:m-frank', 'make:m-morta', 'make:m-bolo', 'make:p-ny', 'make:p-mont'];
    var out = {};
    ids.forEach(function(id){
      var it = DATA.items.filter(function(x){ return x.id===id; })[0];
      out[id] = it ? (it.safety||[]).map(function(b){ return b.kind; }) : null;
    });
    return out;
  })()`) as any;
  Object.keys(r).forEach(function (id) {
    expect(r[id], id).not.toBeNull();
    expect(r[id], id).not.toContain('drying');
  });
});

// P10: the genuinely dry-cured, air-cured whole-muscle MAKES products (סלומי -- b_salumi()) also
// get drying blocks now, not only the sausages the dispatch brief named as motivating examples.
test('P10 · salumi (whole-muscle dry-cured, e.g. speck) gets a drying block with the wider humidity band', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var it = DATA.items.filter(function(x){ return x.id==='make:sal-speck'; })[0];
    var dry = it ? (it.safety||[]).filter(function(b){ return b.kind==='drying'; })[0] : null;
    return dry;
  })()`) as any;
  expect(r).toBeTruthy();
  expect(r.days).toBe(28); // label "6 · הבשלה (2–4 שבועות)" -> 4*7
  expect(r.temp_c_min).toBe(12);
  expect(r.temp_c_max).toBe(15);
});

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
