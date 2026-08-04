import { test, expect, seedApp } from './_fixtures';

// A.1 — the nitrite dose must be DECLARED, and the note must state the rate actually used.
//
// Found by the method-review panel (review-06 / review-08, 2026-08-03) and ranked level-1
// "blocking" by the owner's 2026-08-04 ruling: a nitrite dose is weighed out on a scale and
// eaten. A wrong cook temperature can be caught with a thermometer; this cannot.
//
// Measured on the running app before this test was written (bacon, 1000 g), verbatim:
//     Cure #1
//     2.0 ג׳
//     2 ג׳/ק״ג                                          <- the rate actually applied
//     Cure #1 ב-2.5 ג׳/ק״ג ≈ 156ppm ניטריט (תקני ובטוח).  <- the note, two lines below
// Two rates on one screen, and the one labelled "standard and safe" is not the one used.
//
// Two defects, one screen:
//   (a) app.js:2843-2845 read `calc.cureRate||2.5`, and the `smoked` and `dry` presets carry
//       no cureRate key at all (app.js:2962-2963). 2.5 is reached by fallback, not declaration.
//   (b) app.js:2850 hardcodes the 2.5 sentence for EVERY cure==='1' preset, bacon included.
//
// Primary sources, from this repo's corpus (docs/sources/corpus):
//   9 CFR 424.21(c) — sodium nitrite, chopped meat: 0.25 oz per 100 lb = 0.15625 g/kg = 156 ppm.
//     Cure #1 is 6.25% sodium nitrite, so 156 ppm ingoing == 2.5 g/kg of Cure #1 exactly.
//     => 2.5 is the RIGHT number for smoked/dry. The defect is that nothing declares it.
//   9 CFR 424.22(b)(3) — dry cured bacon: 200 ppm ingoing maximum.
//     bacon at 2.0 g/kg Cure #1 = 125 ppm, inside that ceiling. 2.0 is right too.
// Both numbers are correct. Neither is stated where the user reads it.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof openCalc==='function'`);
};

const openCalcFor = async (page: any, ptype: string, grams: number) => {
  await page.evaluate(`openCalc()`);
  await page.waitForSelector('#saltHost [data-saltcalc]');
  await page.selectOption('#ptype', ptype);
  await page.waitForSelector('#saltHost [data-w]');
  await page.fill('#saltHost [data-w]', String(grams));
  await page.waitForFunction(`document.querySelector('#saltHost').innerText.indexOf('Cure #')>=0`);
};

const RATE = /(\d+(?:\.\d+)?)\s*ג׳\/ק״ג/g;

// The rate the calculator actually applied, taken from the Cure dose row.
const appliedRate = async (page: any): Promise<number> => {
  const txt: string = await page.locator('#saltHost').innerText();
  const m = txt.match(/Cure #\d[\s\S]{0,60}?(\d+(?:\.\d+)?)\s*ג׳\/ק״ג/);
  if (!m) throw new Error('no Cure dose row in:\n' + txt);
  return parseFloat(m[1]);
};

const noteText = async (page: any): Promise<string> => {
  await page.locator('#saltHost .calcnote').first().waitFor({ state: 'attached' });
  return page.locator('#saltHost .calcnote').first().innerText();
};

// R1 — bacon. The note may not name a rate other than the one just applied.
// RED before the fix: applied 2, note says 2.5.
test('R1: bacon — the note names the rate actually applied, not a hardcoded 2.5', async ({ page }) => {
  await boot(page);
  await openCalcFor(page, 'bacon', 1000);

  const applied = await appliedRate(page);
  expect(applied).toBe(2);                                  // preset declares cureRate: 2.0

  const note = await noteText(page);
  const named = [...note.matchAll(RATE)].map(m => parseFloat(m[1]));
  expect(named.length).toBeGreaterThan(0);                  // the note must state a rate at all
  for (const n of named) expect(n).toBe(applied);
});

// R2 — dry-cured (Cure #2), the uncooked class. Its note warns that accuracy is critical
// for safety and then names no rate at all. RED before the fix: named.length === 0.
test('R2: dry-cured — the note that calls accuracy critical must state the rate', async ({ page }) => {
  await boot(page);
  await openCalcFor(page, 'dry', 1000);

  const applied = await appliedRate(page);
  expect(applied).toBe(2.5);                                // 9 CFR 424.21(c): 156 ppm nitrite

  const note = await noteText(page);
  const named = [...note.matchAll(RATE)].map(m => parseFloat(m[1]));
  expect(named.length).toBeGreaterThan(0);
  for (const n of named) expect(n).toBe(applied);
});

// R3 — the fail-safe itself. `smoked` renders 2.5 both before and after the fix, so no rendered
// assertion on it can distinguish declaration from fallback. What CAN be observed is the guarantee
// the fix actually adds: a preset with no rate must SURFACE that, not quietly become 2.5.
//
// This drives the real calculator with a cure-bearing preset that has no cureRate — exactly the
// shape `smoked` and `dry` had before the fix — and reads what the user would see.
//
// An earlier version of this test asserted on String(wireCalcBox) instead. It failed against the
// FIXED code, because the comment explaining the removal contains the pattern it searched for and
// build.py inlines comments into dist. A source-text assertion cannot tell code from prose; this
// one cannot pass without the behaviour being right.
test('R3: a preset with no declared rate surfaces the gap instead of defaulting to 2.5', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openCalc()`);
  await page.waitForSelector('#saltHost [data-saltcalc]');

  const shown = await page.evaluate(`(function(){
    var host=document.querySelector('#saltHost');
    var calc={salt:18,cure:'1',sugar:1,water:10,brine:false};   // cure declared, rate NOT
    host.innerHTML=calcBoxHTML(calc);
    wireCalcBox(host, calc);
    host.querySelector('[data-w]').value='1000';
    host.querySelector('[data-w]').dispatchEvent(new Event('input'));
    return {note: host.querySelector('.calcnote').innerText, body: host.innerText};
  })()`) as { note: string; body: string };

  // The old behaviour put a weighable "2.5 g/kg" on screen for a rate nobody declared.
  expect(shown.body).not.toMatch(/Cure #1[\s\S]{0,60}?2\.5\s*ג׳\/ק״ג/);
  // The new behaviour says so, in words the user can act on.
  expect(shown.note).toContain('אינו מוגדר');
});
