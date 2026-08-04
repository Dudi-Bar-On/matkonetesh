import { test, expect, seedApp } from './_fixtures';

// A.3 — the doneness selector's subtitle states something false about food safety.
//
// app.js:3255 renders, above the rare→well buttons:
//     "טמפ׳ פנים = מידת עשייה; הזמן משפיע על מרקם בלבד"
//     ("internal temp = doneness; time affects texture only")
//
// Time at temperature is exactly what pasteurises. It is not a texture variable that happens to
// sit near a safety number — it is the second axis OF the safety number. Saying otherwise removes
// the one mechanism that can make a low internal temperature a safe choice.
//
// Found by review-08 (2026-08-03) and kept by the owner's 2026-08-04 ruling, which struck the rest
// of that finding down: doneness IS the cook's choice and the app advises rather than polices, so
// no warning and no block. But the sentence is not a preference — it is a factual claim, and it is
// wrong. It is the only part of U-1 that survived review.
//
// This repo proves it against itself. Beef tongue (A.2) carries an instantaneous floor of 71 °C
// from USDA/FSIS while its sous-vide leg holds 70 °C for 24-48 h — below the floor, and safe, on
// time-at-temperature alone (Baldwin). Under the sentence as written that item is inexplicable.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof DATA==='object' && Array.isArray(DATA.cuts) && typeof openCut==='function'`);
};

// Open the first cut that actually has a doneness selector.
const openWithDoneness = async (page: any) => {
  const name = await page.evaluate(`(function(){
    var c=DATA.cuts.filter(function(x){return x.doneness && x.doneness.levels;})[0];
    if(!c) return null;
    openCut(c);
    return c.heb;
  })()`) as string | null;
  expect(name, 'no catalogue item has a doneness selector').not.toBeNull();
  await page.waitForSelector('.dn-wrap');
  return name!;
};

// D1 — the false claim must not be on screen, in Hebrew.
test('D1: the doneness subtitle does not claim time affects texture only', async ({ page }) => {
  await boot(page);
  await openWithDoneness(page);
  const head = await page.locator('.dn-head').first().innerText();
  expect(head).not.toContain('מרקם בלבד');
});

// D2 — and it must say the true thing instead. Deleting the clause would leave the screen silent
// about the mechanism, which is what made the sentence damaging in the first place.
test('D2: the subtitle names time-at-temperature as pasteurising', async ({ page }) => {
  await boot(page);
  await openWithDoneness(page);
  const head = await page.locator('.dn-head').first().innerText();
  expect(head).toContain('מידת עשייה');          // the original, true half is kept
  expect(head).toMatch(/מפסטר|פִסטור|פסטור/);      // the corrected half
});

// D3 — English carries the same correction. review-08 found the Italian cooking instructions for
// this very item rendering in English, so a Hebrew-only fix is not a fix.
test('D3: English states the same thing, with no leak of the old claim', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en') });
  await page.waitForFunction(`typeof DATA==='object' && Array.isArray(DATA.cuts) && typeof openCut==='function'`);
  await openWithDoneness(page);
  const head = await page.locator('.dn-head').first().innerText();
  expect(head.toLowerCase()).not.toContain('texture only');
  expect(head.toLowerCase()).toMatch(/pasteuris|pasteuriz/);
});

// D4 — safety invariance. The ruling is explicit that doneness stays the cook's choice: correcting
// a sentence may not remove a level, move a level's temperature, or change the default.
test('D4: every doneness level and the default are byte-identical to the catalogue', async ({ page }) => {
  await boot(page);
  const rec = await page.evaluate(`(function(){
    var c=DATA.cuts.filter(function(x){return x.doneness && x.doneness.levels;})[0];
    openCut(c);
    var btns=[].slice.call(document.querySelectorAll('.dn-btn')).map(function(b){
      return {key:b.dataset.done, shown:b.querySelector('.dn-c').innerText, on:b.classList.contains('on')};
    });
    return {levels:c.doneness.levels, def:c.doneness.default, btns:btns};
  })()`) as any;

  for (const b of rec.btns) {
    expect(Number(String(b.shown).replace(/[^\d.]/g, ''))).toBe(Number(rec.levels[b.key].c));
  }
  expect(rec.btns.filter((b: any) => b.on).map((b: any) => b.key)).toEqual([rec.def]);
});
