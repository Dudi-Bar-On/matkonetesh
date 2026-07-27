import { test, expect, seedApp } from './_fixtures';

// LEAK BUG (owner, reported in Russian, 2026-07-27): the recipe "Equipment for this cut" section rendered
// EQUIPMENT NAMES and PHASE-ROW LABELS in ENGLISH for every non-Hebrew active language, and the MAKE
// method label/note rendered its raw Hebrew. Three render sites bypassed the i18n dict:
//   1. equipChip (app.js ~7587):        `esc(he ? i.he : i.en)`  → English fallback, never the dict value
//   2. EQUIP_PHASE_LABEL (app.js ~7614): `he ? lab[0] : lab[1]`   → English fallback for phase rows
//   3. MAKE_COOK method label/note:      raw Hebrew literals, only ever reached via a bare t() lookup
// tnode() (the DOM Hebrew→X translator) could NOT rescue any of these: it only rewrites Hebrew source
// text, so an English fallback survives untouched (this is exactly why the owner saw English chips).
//
// The fix routes every site through L(he, en), which prefers the per-language dict value and falls back
// to English (never raw Hebrew) on a genuine miss. This test asserts BOTH failure directions the prior
// suite missed: (a) no raw Hebrew glyph in the chips/labels, AND (b) no English fallback where the dict
// holds a real (differing) translation — i.e. the rendered text is genuinely dict-driven, not i.en.
//
// Loanword-safe by construction: a chip is only required to differ from English when the language's own
// dict value for it differs from English (e.g. de "Sous-vide" == en "Sous-vide" is a legitimate loanword
// and is never flagged); the forbidden/expected sets are computed per-language from the live dict.

const LANGS = ['ru', 'de', 'es', 'fr', 'it'] as const;
const HEB = /[֐-׿]/;

// cut-1 (Brisket) carries base equipment AND per-phase (sv/smoke) equipment → exercises equipChip AND
// EQUIP_PHASE_LABEL in one recipe.
for (const lang of LANGS) {
  test(`i18n[${lang}] equipment chips + phase labels are dict-localized (no English fallback, no raw Hebrew)`, async ({ page }) => {
    await seedApp(page, { 'mk-lang': JSON.stringify(lang), 'mk-uilevel-asked': 'true' });

    const res = await page.evaluate(() => {
      // configure a kit so chips render (ownership marks are irrelevant to the label text under test)
      equipSave([
        { cat: 'smoker', type: 'ארון / קבינט', cap: { areaCm2: 7900, maxC: 150 } },
        { cat: 'sousvide', type: 'טבילה (immersion)', cap: { baths: [24] } },
        { cat: 'probe', type: 'פרוב אלחוטי', cap: { channels: 2 } },
      ]);
      equipSetConfigured();
      openCut(resolveItem('cut-1').obj);

      const dict = getDict() || {};
      const eq = resolveItem('cut-1').obj.equip;
      const toks = new Set();
      (eq.need || []).concat(eq.opt || []).forEach((t) => toks.add(t));
      Object.values(eq.by || {}).forEach((b) => { (b.need || []).concat(b.opt || []).forEach((t) => toks.add(t)); });

      // per-language forbidden (English that must NOT show) + expected (dict value that SHOULD show)
      const forbidden = new Set();
      const expected = new Set();
      toks.forEach((tok) => {
        const i = equipTokenInfo(tok); if (!i) return;
        const dv = dict[i.he];
        if (dv != null && dv !== i.en) { forbidden.add(i.en); expected.add(dv); }
      });
      Object.keys(eq.by || {}).forEach((ph) => {
        const lab = EQUIP_PHASE_LABEL[ph]; if (!lab) return;
        const dv = dict[lab[0]];
        if (dv != null && dv !== lab[1]) { forbidden.add(lab[1]); expected.add(dv); }
      });

      // rendered chip/label NAMES (strip emoji + ✓/✗ marks)
      // strip emoji, their U+FE0E/U+FE0F variation selectors + U+200D joiners (else "🌡️Probe" leaves a
      // stray ️ before the name and an exact compare misses), and the ✓/✗ ownership marks.
      const clean = (s) => (s || '').replace(/[\p{Extended_Pictographic}︎️‍]/gu, '').replace(/[✓✗]/g, '').trim();
      const chipNames = Array.from(document.querySelectorAll('#panel .eqc')).map((el) => clean(el.textContent));
      const rlNames = Array.from(document.querySelectorAll('#panel .eq-rl')).map((el) => clean(el.textContent));
      const allNames = chipNames.concat(rlNames);

      return {
        forbidden: Array.from(forbidden),
        expected: Array.from(expected),
        chipNames, rlNames, allNames,
      };
    });

    // sanity: the recipe actually rendered an equipment section with translatable chips
    expect(res.chipNames.length, `expected .eqc chips to render; got ${JSON.stringify(res.chipNames)}`).toBeGreaterThan(0);
    expect(res.rlNames.length, `expected .eq-rl phase labels to render; got ${JSON.stringify(res.rlNames)}`).toBeGreaterThan(0);
    expect(res.forbidden.length, 'expected the live dict to hold real translations to enforce').toBeGreaterThan(0);

    // (a) NO raw Hebrew leak in any chip/phase-label name
    for (const nm of res.allNames) {
      expect(nm, `raw Hebrew leaked in an equipment chip/label: ${JSON.stringify(nm)}`).not.toMatch(HEB);
    }
    // (b) NO English fallback where a real translation exists (the bug)
    for (const eng of res.forbidden) {
      expect(res.allNames, `English fallback "${eng}" rendered instead of the ${lang} dict value; names=${JSON.stringify(res.allNames)}`).not.toContain(eng);
    }
    // (c) POSITIVE: each expected dict value actually renders (proves it is dict-driven, not just "not-English")
    for (const exp of res.expected) {
      expect(res.allNames, `expected ${lang} dict value "${exp}" to render as a chip/label; names=${JSON.stringify(res.allNames)}`).toContain(exp);
    }
  });
}

// MAKE method label/note: a smoked make (make-n-kielbasa, cat "נקניק מעושן") whose profile method label
// is "עישון" and note carries temperatures. Assert the rendered timeline stage label/note is localized
// (no raw Hebrew) AND that the note preserves the temperature numbers verbatim (safety invariance).
for (const lang of LANGS) {
  test(`i18n[${lang}] MAKE method label + note render localized with temperatures preserved`, async ({ page }) => {
    await seedApp(page, { 'mk-lang': JSON.stringify(lang), 'mk-uilevel-asked': 'true' });
    const res = await page.evaluate(() => {
      const meta = resolveItem('make-n-kielbasa');
      const prof = itemProfile(meta);
      // the localized profile is what every consumer (timeline/plan/dropdown) reads
      const m = prof.methods[0];
      const dict = getDict() || {};
      // itemStages renders label as `${t(m.label)} ${tempC}` and note as t(m.note)
      const label = (typeof t === 'function') ? t(m.label) : m.label;
      const note = (typeof t === 'function') ? t(m.note) : m.note;
      return { rawLabel: m.label, rawNote: m.note, label, note };
    });
    // label localized (no raw Hebrew) — the smoked method must read as the language's word for "smoke"
    expect(res.label, `MAKE method label leaked raw Hebrew: ${JSON.stringify(res.label)}`).not.toMatch(HEB);
    expect(res.note, `MAKE method note leaked raw Hebrew: ${JSON.stringify(res.note)}`).not.toMatch(HEB);
    // DoD-10 safety invariance: every number in the Hebrew source note survives in the translation
    const nums = (res.rawNote.match(/\d+/g) || []);
    for (const n of nums) {
      expect(res.note, `translated note dropped the temperature "${n}" (source: ${res.rawNote}) → ${res.note}`).toContain(n);
    }
  });
}
