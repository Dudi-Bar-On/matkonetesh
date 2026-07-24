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

// Phase A completion gate, FIX 1 — SAFETY_UNIT had NO word-form units ("degrees", "deg C", "celsius",
// "fahrenheit"), only the symbol/abbreviation forms (°C, °F, C, F). aiSafetyNums returned [] for every
// word-form input, which made vcGuardSpoken's early-return ("no safety numbers at all -> untouched")
// let the raw model text through UNGUARDED. The app's OWN English TTS readout speaks "${m[1]} degrees"
// (app.js ~5310) and the English system prompt is biased toward prose, not °C — so this is not a
// theoretical gap, it is the shape the app's own English surface produces.
test('FIX 1 — word-form units extract like their symbol-form equivalents', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('hold at 74 degrees')`)).toEqual([74]);
  expect(await page.evaluate(`aiSafetyNums('74 degrees Celsius')`)).toEqual([74]);
  // 165F -> (165-32)*5/9 = 73.888... -> rounds to 74, same convention as the existing °F test above.
  expect(await page.evaluate(`aiSafetyNums('165 degrees Fahrenheit')`)).toEqual([74]);
  expect(await page.evaluate(`aiSafetyNums('74 deg C')`)).toEqual([74]);
});

// Phase A completion gate, FIX 2 — a comma-grouped thousands number ("1,063°C") defeated the ON-SCREEN
// escalation: aiSafetyNums('sear at 1,063°C') matched only the tail "63" (the comma is not part of the
// plain \d+(?:\.\d+)? number pattern), so a hallucinated "1,063°C" read as GROUNDED whenever the vetted
// context happened to contain "63" in any other figure. (The spoken path was already safe by accident —
// its digit counter, built on the same SAFETY_NUM, saw two digit runs from the split and took the
// fail-closed "redact everything" branch — this fix is the on-screen surface only.)
test('FIX 2 — a comma-grouped thousands number extracts as its FULL value, not just the tail', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('sear at 1,063°C')`)).toEqual([1063]);
  expect(await page.evaluate(`aiUngroundedSafety('sear at 1,063°C','בטיחות 63°C')`)).toEqual([1063]);
  // Hebrew decimal notation ("63,5" meaning 63.5) is NOT thousands grouping (needs exactly 3 digits after
  // the comma) — unchanged from today (verified against the pre-fix baseline by execution): it still
  // splits into two runs and only the tail "5°C" is a recognised token.
  expect(await page.evaluate(`aiSafetyNums('63,5°C')`)).toEqual([5]);
});

// Phase A gate close — FIX C, defect 1: the old SAFETY_UNIT "deg" fragment had no word boundary after
// "deg", so it matched as a PREFIX inside unrelated words. Confirmed by execution before that fix
// (scratch/verify-phase-a-gate-v6.js): aiSafetyNums('5 degradation events') -> [5]. Still a non-match today
// under the REGRESSION FIX (2026-07-24): "degradation"/"degradition" never match (?:rees?)? (the letters
// after "deg" are "rad", not "ree"), and the letter immediately following "deg" ('r') is not a `.` and IS
// an [A-Za-z] letter, so neither branch of the new fragment can complete.
test('FIX C — "degradation" is not mistaken for a temperature unit', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('5 degradation events')`)).toEqual([]);
  expect(await page.evaluate(`aiSafetyNums('74degradation')`)).toEqual([]);
});

// REGRESSION FIX (2026-07-24, closes 0ab7baa) — the FIX C mandatory-unit-letter design (deg\b[ \t]*(?:C\b|
// ...)) stopped matching bare "deg" entirely, which ALSO stopped matching real unguarded temperatures:
// measured on the real built app, "pull it at 74 deg and it is safe" reached vcSpeak completely unguarded.
// The fix makes the unit letter OPTIONAL again (deg(?:rees?)?\.?(?![A-Za-z]) branch), so "74 deg"/"74 deg."/
// "74 DEG" are recognised, AND makes the letter-boundary check `\b`-free so the compact spoken/typed forms
// "74degC"/"74degF" (no space at all — g immediately followed by the unit letter, where \b cannot match)
// are recognised too.
test('REGRESSION — bare "deg" (with/without a period, any case) is recognised as a temperature unit', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('74 deg')`)).toEqual([74]);
  expect(await page.evaluate(`aiSafetyNums('74 deg.')`)).toEqual([74]);
  expect(await page.evaluate(`aiSafetyNums('74 DEG')`)).toEqual([74]);
});
test('REGRESSION — compact "74degC"/"74degF" (no space, no \\b between "deg" and the unit letter) are recognised', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('74degC')`)).toEqual([74]);
  expect(await page.evaluate(`aiSafetyNums('74degF')`)).toEqual([23]);   // (74-32)*5/9 = 23.33 -> rounds to 23
  expect(await page.evaluate(`aiSafetyNums('2 degC')`)).toEqual([2]);
});
// ACCEPTED REVERSAL (owner ruling, 2026-07-24) — "3 deg of freedom" now MATCHES -> [3], the opposite of
// FIX C's own explicit non-match test (which asserted []). This is deliberate, not a re-introduced defect:
// making bare "deg" a valid unit again (the regression fix above) is what "74 deg" being recognised
// REQUIRES, and there is no way to keep "deg" unit-less-valid for a real temperature while refusing it for
// "deg of freedom" — the token "deg" is identical in both. Consistent with every other ruling on this
// function (fail toward OVER-redaction, never toward a leak): "slice at a 45 degree angle" is already
// accepted as an over-match below; refusing bare "deg" to protect an engineering idiom, at the price of
// leaking a real unguarded "74 deg" temperature, was the inconsistent choice. Do NOT "fix" this back to []
// — that reopens the regression this whole change closes.
test('ACCEPTED — "3 deg of freedom" is over-matched -> [3] (documents the deliberate reversal, do not revert)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('3 deg of freedom')`)).toEqual([3]);
});

// Phase A gate close — FIX C, defect 3 (the worst class: a VALUE CORRUPTION, not an over-flag): the old
// fragment's trailing "\.?" let the unconditional "\s*" reach across a sentence-ending period and bind the
// NEXT sentence's stray "F" as if it were this number's unit. Confirmed by execution before the fix:
// aiSafetyNums('hold at 63 degrees. F is what the probe shows.') -> [17] (63 misread as Fahrenheit and
// converted). Dropping \.? stops the cross-sentence bind; the number now extracts as 63, untouched.
test('FIX C — a sentence-ending period never binds the next sentence\'s unit letter (value-corruption fix)', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`aiSafetyNums('hold at 63 degrees. F is what the probe shows.')`)).toEqual([63]);
});
