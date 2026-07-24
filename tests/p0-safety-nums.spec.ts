import { test, expect, seedApp } from './_fixtures';

// P0-app item 2 (spec §3.2) — aiSafetyNums had two extraction defects in one function:
//   A · unit-blindness: the unit token was non-capturing, so 74°F and 74°C both extracted as 74.
//   B · range-phrase gap: a unit shared by two hyphenated bounds ("ירידה 30-40%") extracted only 40.
// Both are fixed in the extractor; aiUngroundedSafety needs no change for either.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof aiSafetyNums==='function' && typeof aiUngroundedSafety==='function'`);
};

test('A3 defect A — a Fahrenheit answer normalizes to Celsius and no longer matches a Celsius grounding value', async ({ page }) => {
  await boot(page);
  // 74°F is 23°C — nowhere near the 74°C poultry floor. Today it extracts as a bare 74 and reads GROUNDED.
  expect(await page.evaluate(`aiSafetyNums('74°F is safe for chicken')`)).toEqual([23]);
  expect(await page.evaluate(`aiUngroundedSafety('74°F is safe for chicken','מהקטלוג: חזה עוף 74°C')`)).toEqual([23]);
});

test('A3 defect A, the other direction — a CORRECT Fahrenheit restatement stops being false-flagged', async ({ page }) => {
  await boot(page);
  // B2-02 in the banked baseline: 165°F IS 74°C. Today it reads ungrounded — the guard cries wolf on a
  // correct answer. (165-32)*5/9 = 73.89 → rounds to 74, matching the grounding.
  expect(await page.evaluate(`aiSafetyNums('cook the breast to 165°F')`)).toEqual([74]);
  expect(await page.evaluate(`aiUngroundedSafety('cook the breast to 165°F','מהקטלוג: חזה עוף 74°C')`)).toEqual([]);
});

test('B10 defect B — a range sharing one trailing unit contributes BOTH bounds', async ({ page }) => {
  await boot(page);
  // The app's own dry-salami grounding writes "ירידה 30-40%": the 30 has no unit glued to it, so today
  // only [40] is extracted and a correct 30% in the answer has nothing to match.
  expect(await page.evaluate(`aiSafetyNums('ירידה 30-40%')`)).toEqual([30, 40]);
  expect(await page.evaluate(`aiSafetyNums('spores are destroyed at 100-121°C')`)).toEqual([100, 121]);
});

test('Hebrew מעלות is read as Celsius-native (the app data convention), not skipped', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('הטמפ׳ הבטוחה היא 74 מעלות')`)).toEqual([74]);
});

test('DoD-6 negative case — the already-correct majority is byte-identical (additive fix, not a behaviour change)', async ({ page }) => {
  await boot(page);
  // All-Celsius, no range notation, no Fahrenheit: every one of these extracted the same values before
  // the fix and must extract the same values after it.
  expect(await page.evaluate(`aiSafetyNums('בטיחות 74°C · סו-ויד 63°C')`)).toEqual([74, 63]);
  expect(await page.evaluate(`aiSafetyNums('cure #1 at 156 ppm')`)).toEqual([156]);
  expect(await page.evaluate(`aiSafetyNums('ferment to pH 5.3')`)).toEqual([5.3]);
  expect(await page.evaluate(`aiSafetyNums('use 2.5% salt')`)).toEqual([2.5]);
  expect(await page.evaluate(`aiSafetyNums('rest it a while, then slice thin')`)).toEqual([]);
});

test('output preserves TEXTUAL order across mixed range and single-number input', async ({ page }) => {
  await boot(page);
  // Reviewer Important-1: the two-pass version emitted every range before every standalone number
  // regardless of where each appeared in the text. Order is not safety-critical for today's only
  // consumer (aiUngroundedSafety does a Set-membership check), but the contract is now explicit
  // and locked, because Task 2's spoken guard is built on this function's output.
  expect(await page.evaluate(`aiSafetyNums('cure 156 ppm, then dry until 30-40% weight loss')`)).toEqual([156, 30, 40]);
});
