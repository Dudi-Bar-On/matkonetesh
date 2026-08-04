import { test, expect, seedApp } from './_fixtures';

// A.2 — beef tongue ships a safety floor that contradicts the source governing it.
//
// Found by review-06 and confirmed visually by review-08 (2026-08-03). Level-1 "blocking"
// under the owner's 2026-08-04 ruling: this is not a doneness preference the cook chooses,
// it is a cited floor that disagrees with its own citation.
//
// The governing source is already in this repo:
//   docs/sources/corpus/04-askusda-variety-meats/organ-meat-temps.csv, extraction=VERBATIM,
//   re-verified 2026-08-02 against ask.fsis.usda.gov. Its sentence, quoted in full:
//     "Organs, such as kidney, liver, stomach, tongue, and tripe, from red meats (beef, veal,
//      pork, or lamb) should be cooked to a minimum internal temperature of 160 °F"
//   160 F = 71.1 C.
//
// The catalogue shipped `safe: 63` for לשון בקר, and its `cat` is בקר rather than
// איברים פנימיים — so no organ-class rule ever looked at it. Its own technique fields were
// already right (svt 70, tgt 70); only the safety floor was low.
//
// SCOPE, stated deliberately. The same CSV carries this caveat verbatim: the article "does not
// explicitly cover heart or chitterlings". So this fixes tongue, which the source NAMES, and
// leaves לב בקר (63), שקדי עגל/טלה (65) and מוח עגל (65) untouched — no other corpus source
// covers them, and stretching a regulatory threshold past the class its source governs is the
// exact defect class review-06 found 53 times. Those three are reported, not silently raised.

const USDA_RED_MEAT_ORGAN_C = 71;   // 160 F = 71.1 C, stored rounded like every other floor

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof DATA==='object' && Array.isArray(DATA.cuts)`);
};

// T1 — the item the source names by name.
test('T1: beef tongue carries the USDA red-meat organ floor, not the generic beef one', async ({ page }) => {
  await boot(page);
  const rec = await page.evaluate(`(function(){
    return DATA.cuts.filter(function(c){return String(c.heb||'').indexOf('לשון')>=0;})[0]||null;
  })()`) as any;

  expect(rec, 'לשון בקר must exist in the catalogue').not.toBeNull();
  expect(rec.safe).toBe(USDA_RED_MEAT_ORGAN_C);

  // This test first also asserted tgt >= safe. That assertion was WRONG and is deliberately gone:
  // the owner's 2026-08-04 ruling puts a texture target below the floor in the "flag it" tier, not
  // the "block it" tier — the cook chooses doneness. Tongue is the clearest case for that ruling:
  // tgt is 70 against a 71 floor, and its SV leg holds 70C for 24-48h, which pasteurizes orders of
  // magnitude past an instantaneous 71. Asserting tgt >= safe would have forced a real number
  // upward to satisfy a rule the owner had already rejected.
  //
  // What replaces it has teeth the old one lacked: the floor must carry the citation that actually
  // governs it. 63 shipped for months while its own chip cited Baldwin's 54.4 — a value, a citation
  // and a governing source that were three different numbers.
  expect(String(rec.src?.safe?.ref || '')).toMatch(/USDA|FSIS/);
  expect(String(rec.src?.safe?.url || '')).toContain('fsis.usda.gov');
});

// T2 — the class, so the same hole cannot reopen next to it. Only the five organs the source
// names, and only on the four red-meat species it names. Poultry giblets are a different row
// of the same CSV (165 F) and are deliberately out of this assertion.
test('T2: every red-meat organ the USDA article names is at or above its floor', async ({ page }) => {
  await boot(page);
  const rows = await page.evaluate(`(function(){
    var NAMED = ['לשון','כבד','כליה','כליות','קיבה','כרס'];      // tongue, liver, kidney, stomach, tripe
    var RED   = ['בקר','עגל','טלה','כבש','חזיר'];                 // beef, veal, lamb, pork
    var POULTRY = ['עוף','אווז','ברווז','הודו'];
    return DATA.cuts.filter(function(c){
      var h=String(c.heb||'');
      if(!NAMED.some(function(w){return h.indexOf(w)>=0;})) return false;
      if(POULTRY.some(function(w){return h.indexOf(w)>=0;})) return false;   // giblets: different row
      return RED.some(function(w){return h.indexOf(w)>=0;});
    }).map(function(c){return {heb:c.heb, safe:c.safe};});
  })()`) as Array<{ heb: string; safe: number }>;

  expect(rows.length).toBeGreaterThan(0);          // the filter must actually select something
  const below = rows.filter(r => Number(r.safe) < USDA_RED_MEAT_ORGAN_C);
  expect(below, `below the 71C floor: ${JSON.stringify(below)}`).toEqual([]);
});

// T3 — what the user reads. A floor is only a floor if it reaches the screen; review-08 found
// tongue rendering 63 on the card with a citation chip beside it.
test('T3: the tongue card renders 71, not 63', async ({ page }) => {
  await boot(page);
  await page.evaluate(`(function(){
    var c=DATA.cuts.filter(function(x){return String(x.heb||'').indexOf('לשון')>=0;})[0];
    openCut(c);                       // openCut takes the record, not an index
  })()`);
  await page.waitForFunction(`document.body.innerText.indexOf('מינימום בטיחות')>=0`);
  const shown = await page.evaluate(`document.body.innerText`) as string;

  expect(shown).toContain('לשון בקר');
  // The card states the floor twice — the readout chip and the safety-check line. Both must agree
  // with the source, so this reads the sentence a cook actually follows at the grill.
  const m = shown.match(/מינימום בטיחות\s*(\d+)/);
  expect(m, 'no safety-minimum sentence on the tongue card').not.toBeNull();
  expect(Number(m![1])).toBe(USDA_RED_MEAT_ORGAN_C);
});
