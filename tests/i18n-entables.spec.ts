// Task 4 (v268 localization plan) — delete the 9 parallel `_EN` tables; reroute each
// `getLang()==='he'?NAME:NAME_EN` selector through `t()` (dict lookup keyed by the Hebrew value).
// Spec: docs/superpowers/plans/2026-07-26-v268-localization.md "## Task 4";
// docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §2 mech-4, §3.3 mode 2.
//
// This task's own DoD: he-mode output for every rerouted selector must be BYTE-IDENTICAL to the
// pre-refactor `getLang()==='he'?NAME:NAME_EN` behaviour (t()'s getDict() is null in he-mode, so it
// returns the Hebrew arg verbatim — same as the old ternary's he-branch). Each selector is also proven
// dict-driven by injecting a throwaway dict entry at runtime and switching language — this does not
// require fr/de/es/it translations to exist yet (Task 8's job); it proves the WIRING, not the copy.
//
// The 9 tables (spec §3.3 mode 2 a/b/c) and their selector:
//   1. SMOKER_TIPS   -> smokerTip()               (flat, app.js ~1077)
//   2. KIND_LABEL    -> kindLabel(k)               (flat, app.js ~1283)
//   3. SPK_HEAT      -> heatLabel(v,heLabel)        (array-of-pairs, app.js ~1308)
//   4. DONE_SCALES   -> doneLabel(cut,k)            (nested, ctx='doneness', app.js ~2961)
//   5. STAGE_LABEL   -> stageLabel(k)               (flat, app.js ~4284)
//   6. THEMES.name   -> themeName(k)                (flat-prop, app.js ~8520)
//   7. FONT_PAIRS.name -> fontName(k)               (flat-prop, app.js ~8524)
//   8. FONT_SCALE_LABELS -> scaleLabel(s)           (flat, app.js ~8531)
//   9. SHAPE_NAMES   -> shapeName(k)                (flat, app.js ~8738)
import { test, expect, seedApp } from './_fixtures';

const bootHe = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(
    `typeof smokerTip==='function' && typeof kindLabel==='function' && typeof heatLabel==='function' && ` +
    `typeof doneLabel==='function' && typeof stageLabel==='function' && typeof themeName==='function' && ` +
    `typeof fontName==='function' && typeof scaleLabel==='function' && typeof shapeName==='function' && ` +
    `typeof I18N_DICTS==='object'`);
};

// Injects a throwaway dict entry for `lang` and switches to it — proves the selector is DICT-DRIVEN
// without needing a real translation to exist (Task 8 populates the real fr/de/es/it copy later).
const seedDictAndSwitch = (page: any, lang: string, key: string, value: string) =>
  page.evaluate(`(function(){
    I18N_DICTS['${lang}'] = I18N_DICTS['${lang}'] || {};
    I18N_DICTS['${lang}'][${JSON.stringify(key)}] = ${JSON.stringify(value)};
    setLang('${lang}');
  })()`);

const HE = {
  smokerTip_pellet: 'פלט: שגר-ושכח. לעשן חזק יותר — הוסף צינור/מבוך עשן (smoke tube), ועשן ב-max smoke בשעתיים הראשונות כשהבשר קר.',
  kindLabel_rub: 'ראב יבש',
  stageLabel_building: '⏳ בתהליך',
  themeName_cream: 'שמנת חמה',
  fontName_current: 'נוכחי',
  scaleLabel_1: 'רגיל',
  shapeName_5: 'צירים מתקפלים',
  heatLabel_0: '😌 עדין',
  doneLabel_steak_rare: 'נא',
};

test('T4 1/9 — smokerTip(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  await page.evaluate(`equipSave([{id:equipId(),cat:'smoker',type:'פלטים',name:'Traeger'}]); equipSetConfigured();`);
  expect(await page.evaluate(`smokerTip()`)).toBe(HE.smokerTip_pellet);
  await seedDictAndSwitch(page, 'fr', HE.smokerTip_pellet, 'SEEDED-FR-SMOKER-TIP');
  expect(await page.evaluate(`smokerTip()`)).toBe('SEEDED-FR-SMOKER-TIP');
});

test('T4 2/9 — kindLabel(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`kindLabel('rub')`)).toBe(HE.kindLabel_rub);
  await seedDictAndSwitch(page, 'fr', HE.kindLabel_rub, 'SEEDED-FR-RUB');
  expect(await page.evaluate(`kindLabel('rub')`)).toBe('SEEDED-FR-RUB');
});

test('T4 3/9 — heatLabel(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`heatLabel(0, ${JSON.stringify(HE.heatLabel_0)})`)).toBe(HE.heatLabel_0);
  await seedDictAndSwitch(page, 'fr', HE.heatLabel_0, 'SEEDED-FR-MILD');
  expect(await page.evaluate(`heatLabel(0, ${JSON.stringify(HE.heatLabel_0)})`)).toBe('SEEDED-FR-MILD');
});

test('T4 4/9 — doneLabel(): he byte-identical + ctx-scoped dict-driven after seeding (does not leak into the unrelated bare kg/raw-weight sense)', async ({ page }) => {
  await bootHe(page);
  const cut = { doneness: { scale: 'steak' } };
  expect(await page.evaluate(`doneLabel(${JSON.stringify(cut)}, 'rare')`)).toBe(HE.doneLabel_steak_rare);
  // seed the TABLE-SCOPED ctx key ('נא␟doneness') — the bare 'נא' key must stay untouched by this
  await seedDictAndSwitch(page, 'fr', HE.doneLabel_steak_rare + '␟doneness', 'SEEDED-FR-RARE');
  expect(await page.evaluate(`doneLabel(${JSON.stringify(cut)}, 'rare')`)).toBe('SEEDED-FR-RARE');
  // the unrelated bare-keyed sense (kg/raw-weight, L('נא','raw')) must NOT pick up the ctx'd entry
  expect(await page.evaluate(`L(${JSON.stringify(HE.doneLabel_steak_rare)}, 'raw')`)).toBe('raw');
});

test('T4 5/9 — stageLabel(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`stageLabel('building')`)).toBe(HE.stageLabel_building);
  await seedDictAndSwitch(page, 'fr', HE.stageLabel_building, 'SEEDED-FR-BUILDING');
  expect(await page.evaluate(`stageLabel('building')`)).toBe('SEEDED-FR-BUILDING');
});

test('T4 6/9 — themeName(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`themeName('cream')`)).toBe(HE.themeName_cream);
  await seedDictAndSwitch(page, 'fr', HE.themeName_cream, 'SEEDED-FR-CREAM');
  expect(await page.evaluate(`themeName('cream')`)).toBe('SEEDED-FR-CREAM');
});

test('T4 7/9 — fontName(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`fontName('current')`)).toBe(HE.fontName_current);
  await seedDictAndSwitch(page, 'fr', HE.fontName_current, 'SEEDED-FR-CURRENT');
  expect(await page.evaluate(`fontName('current')`)).toBe('SEEDED-FR-CURRENT');
});

test('T4 8/9 — scaleLabel(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`scaleLabel(1)`)).toBe(HE.scaleLabel_1);
  await seedDictAndSwitch(page, 'fr', HE.scaleLabel_1, 'SEEDED-FR-REGULAR');
  expect(await page.evaluate(`scaleLabel(1)`)).toBe('SEEDED-FR-REGULAR');
});

test('T4 9/9 — shapeName(): he byte-identical + dict-driven after seeding', async ({ page }) => {
  await bootHe(page);
  expect(await page.evaluate(`shapeName('5')`)).toBe(HE.shapeName_5);
  await seedDictAndSwitch(page, 'fr', HE.shapeName_5, 'SEEDED-FR-ACCORDION');
  expect(await page.evaluate(`shapeName('5')`)).toBe('SEEDED-FR-ACCORDION');
});

test('T4 — none of the 9 _EN tables remain in the source', async ({ page }) => {
  await bootHe(page);
  for (const name of ['SMOKER_TIPS_EN', 'KIND_LABEL_EN', 'STAGE_LABEL_EN', 'THEME_NAMES_EN',
    'FONT_NAMES_EN', 'SHAPE_NAMES_EN', 'DONE_SCALES_EN', 'SPK_HEAT_EN', 'FONT_SCALE_LABELS_EN']) {
    expect(await page.evaluate(`typeof ${name}`)).toBe('undefined');
  }
});
