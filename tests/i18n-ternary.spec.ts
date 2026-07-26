// Task 3 (v268 localization plan) — literal-both-sides `he?'א':'b'` ternaries refactored to `L('א','b')`.
// Spec: docs/superpowers/plans/2026-07-26-v268-localization.md "## Task 3";
// docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §11 ("Literal ternaries → v268").
//
// This task's own DoD: he-mode output for the refactored sites must be BYTE-IDENTICAL to the pre-refactor
// `he?'א':'b'` behaviour — L(he,en) returns `he` verbatim whenever getLang()==='he' (app.js ~8593), so this
// is a refactor-safety net, not a feature test. fr/de/es/it come later (Task 8-11 translate the harvested
// keys) — asserting fr now would be premature (the dict entries don't exist yet).
//
// 5 representative converted sites, spanning 5 different screens/subsystems so the safety net isn't
// clustered in one function:
//   1. _occTile          (equipment occupancy tile, occ2-big branch)      — app.js ~709
//   2. equipSpecNote     (equipment spec badges — 4 converted pairs)      — app.js ~7594 (post-refactor ~7587)
//   3. copilotStallInfo  (live copilot stall advisory: title + body)     — app.js ~6653 (post-refactor ~6647)
//   4. _gearConciergePreview (gear concierge preview: names + level)     — app.js ~7499 (post-refactor ~7490)
//   5. aiSafetyCaveat    (AI safety-numbers caveat banner)                — app.js ~5314 (post-refactor ~5308)
import { test, expect, seedApp } from './_fixtures';

const bootHe = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(
    `typeof _occTile==='function' && typeof equipSpecNote==='function' && typeof copilotStallInfo==='function' && typeof _gearConciergePreview==='function' && typeof aiSafetyCaveat==='function'`);
};

test('i18n-ternary: he-mode byte-identical — _occTile occ2-big size unit (סמ״ר)', async ({ page }) => {
  await bootHe(page);
  const html = await page.evaluate(
    `_occTile({cm2:500, name:'Steak'}, {perSlotCm2:100})`) as string;
  expect(html).toContain('500 סמ״ר');
  expect(html).not.toContain('cm²');
});

test('i18n-ternary: he-mode byte-identical — equipSpecNote (4 converted label/unit pairs)', async ({ page }) => {
  await bootHe(page);
  const html = await page.evaluate(
    `equipSpecNote({min_bath_l:5, footprint_cm2:200, casing_mm:22, scale_res:1})`) as string;
  expect(html).toBe(
    '<span class="eq-spec">אמבט ≥ 5 ל׳ · שטח ~200 סמ״ר · מעטה 22 מ״מ · משקל ≥ 1 (למינון קיור מדויק)</span>');
});

test('i18n-ternary: he-mode byte-identical — copilotStallInfo title + body (stall phase)', async ({ page }) => {
  await bootHe(page);
  const info = await page.evaluate(`copilotStallInfo(70)`) as { title: string; body: string; phase: string };
  expect(info.phase).toBe('stall');
  expect(info.title).toBe('אתה בתוך הסטָאל');
  expect(info.body).toBe(
    'התאדות-קירור סביב 65–77°C — נורמלי לחלוטין, יכול להימשך 1–3 שעות. אל תעלה חום בפאניקה. אפשרויות: סבלנות, ' +
    'או "Texas Crutch" — עטוף בנייר קצבים/אלומיניום כשהקרום כהה ויציב (בערך 68–70°C) כדי לפרוץ. עטיפה מוקדמת מדי מרככת את הקרום.');
});

test('i18n-ternary: he-mode byte-identical — _gearConciergePreview names + suggested level', async ({ page }) => {
  await bootHe(page);
  const html = await page.evaluate(
    `_gearConciergePreview({smoker:true, grill:true}, 'beginner')`) as string;
  expect(html).toContain('מעשנה');
  expect(html).toContain('גריל');
  expect(html).toContain('רמת ממשק מוצעת');
  expect(html).toContain('מתחיל');
  expect(html).not.toContain('Smoker');
  expect(html).not.toContain('Beginner');
});

test('i18n-ternary: he-mode byte-identical — aiSafetyCaveat full Hebrew sentence', async ({ page }) => {
  await bootHe(page);
  const html = await page.evaluate(`aiSafetyCaveat('הטמפ המומלצת היא 75°C')`) as string;
  expect(html).toBe(
    '<div class="ai-caveat">⚠ מספרי טמפ׳/ריפוי/בטיחות בתשובת ה-AI אינם מאומתים — אמת מול כרטיס המתכון והמחשבון באפליקציה לפני ביצוע.</div>');
});
