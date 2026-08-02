import { test, expect, seedApp } from './_fixtures';

// ── R-69 · the catalogue sweep's three safety shapes (owner priority, 2026-08-02) ─────────────────
// Evidence: docs/analysis/2026-08-02-catalog-ai-sweep.md — 279/279 catalogue items asked the owner's own
// question against the LIVE v289 app. 48 items returned a wrong or unbacked safety claim. Three shapes:
//
//   F · `0°C` spoken as THE safe temperature — 26 items (every ירקות/פירות row carries safe=0, the
//       encoding of "not applicable", and vcIdentifiedSafeItem could not tell 0 from a cited figure).
//   G · the "לפי המדריך המאומת" stamp on a number the question's own subject does not hold — 15 items.
//       Two mechanisms, both reproduced below: (G-a) the claim's subject is a DIFFERENT food than the one
//       the user asked about; (G-b) the number is the row's `tgt` (a texture target) while the sentence
//       claims an internal SAFETY temperature.
//   I · the answer's subject is a different food — the part that is OURS: askFindEntity's direct tier
//       matches a short catalogue name INSIDE a longer question word ("ברי" inside "בקלבריה"), and the
//       app then names that row in its own voice.
//
// Every fixture below is a VERBATIM shape from the sweep, and every assertion is on RENDERED text or on
// the string the real guard returns — never on an internal flag (L45: a test that does not exercise the
// real path is not evidence; the claim maps here are fed through vcBuildClaimMap, the same builder the
// live classifier response goes through, not hand-assembled Maps).

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof askFindEntity==='function' && typeof vcResolveTiers==='function'
                              && typeof vcSafeSubstitution==='function' && typeof vcGuardSpoken==='function'
                              && typeof vcBuildClaimMap==='function'`);
};

const sub = (page: any, q: string) => page.evaluate(
  `vcSafeSubstitution(vcResolveTiers(${JSON.stringify(q)}), 'he')`) as Promise<string>;

// The rendered-transcript driver, same shape entity-ladder.spec.ts C4 uses: the REAL vcAskFlow, the REAL
// guard, the REAL renderer — only the model's answer is mocked, because the defect is in what WE do to it.
async function renderAnswer(page: any, q: string, a: string, want: string, shot: string, claimJson?: string) {
  await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                        'mk-gemkey': JSON.stringify('test-key') });
  await page.waitForFunction(`typeof vcAskFlow==='function'`);
  await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock=${JSON.stringify(a)}; window.__vcClassMock=${claimJson || 'null'};`);
  try {
    await page.evaluate(`vcAskFlow(${JSON.stringify(q)})`);
    await page.waitForFunction(`(function(){ var el=document.querySelector('.vc-qa-a');
      return el && el.textContent.indexOf(${JSON.stringify(want)})>=0; })()`);
    const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
    await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
    await page.screenshot({ path: `.superpowers/sdd/${shot}-390x844.png` });
    return shown;
  } finally {
    await page.evaluate(`window.__vcAskMock=null; window.__vcClassMock=null;`);
  }
}

// ══ SHAPE F · `0°C` is not a safety temperature ═══════════════════════════════════════════════════
test.describe('F · safe=0 is "not applicable", never a spoken safe temperature', () => {

  // The sweep's own verbatim case, cut-81 · תירס:
  //   "לפי המדריך, הטמפרטורה הבטוחה עבור תירס: 0°C. תירס בטוח לאכילה אפילו כשהוא נא, כך שאין עבורו
  //    טמפרטורת בטיחות מינימלית כמו בבשר."
  test('F1 · תירס never renders 0°C as the guide\'s safe temperature (390x844)', async ({ page }) => {
    const shown = await renderAnswer(page,
      'מה טמפרטורת הבטיחות בתירס',
      // The live shape carries the model's own numbers too — they are what sends the guard down the
      // redaction path where our own sentence is appended. Without one, no sentence is spoken at all.
      'תירס בטוח לאכילה אפילו כשהוא נא, כך שאין עבורו טמפרטורת בטיחות מינימלית כמו בבשר. '
      + 'צלה אותו כ-15 דקות ב-200°C עד חריכה.',
      'תירס', 'sweep-F-corn');
    expect(shown).not.toContain('0°C');
    expect(shown).toContain('אין לנו ערך בטיחות מאומת');
    expect(shown).toContain('תירס');
  });

  // The whole shape, not one example: every ירקות/פירות row the sweep listed.
  test('F2 · no ירקות/פירות row speaks a 0°C safe temperature — and meat is untouched', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var rows=askAllItems().filter(function(m){ return m.cat==='ירקות'||m.cat==='פירות'; });
      var bad=[];
      rows.forEach(function(m){
        var s=vcSafeSubstitution(vcResolveTiers('מה טמפרטורת הבטיחות ב'+m.heb),'he');
        if(/0°C|:\\s*0\\b/.test(s)) bad.push(m.heb+' → '+s);
      });
      return { n:rows.length, bad:bad,
               meat:vcSafeSubstitution(vcResolveTiers('מה טמפרטורת הבטיחות באסאדו'),'he') };
    })()`) as any;
    expect(r.n).toBeGreaterThanOrEqual(20);         // premise: the rows really are in the catalogue
    expect(r.bad).toEqual([]);
    // NEGATIVE (DoD-6): a row that DOES hold a cited figure still speaks it — the fix must not silence data.
    expect(r.meat).toContain('63°C');
  });

  // A model that says "0°C" itself must not have it stamped with the guide's authority either: `safe=0`
  // was in the marker-eligible set (vcVerifiedSafeNums returned [0,85] for cut-102 — measured).
  test('F3 · a model-spoken 0°C never carries the verified marker', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var t=vcResolveTiers('מה טמפרטורת הבטיחות בתירס');
      return { nums:vcVerifiedSafeNums(t.t2),
               said:vcGuardSpoken('אפשר להגיש תירס כבר ב-0°C.', t, 'he', null) };
    })()`) as any;
    expect(r.nums).not.toContain(0);
    expect(r.said).not.toContain('לפי המדריך המאומת');
  });
});

// ══ SHAPE G · the verified stamp on a figure the question's subject does not hold ═════════════════
test.describe('G · the verified stamp requires the subject the user asked about', () => {

  // G-a, the sweep's `make-m-droe` (דרוורס) case, reproduced with the classifier subject that produces it
  // (measured: subject.item "duck"/"ברווז"/"turkey" all bind to poultry rows and stamp 74°C).
  test('G1 · דרוורס: 74°C from a poultry row is not stamped with the guide', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var claims=vcBuildClaimMap('אם התכוונת לברווז או עוף, טמפרטורת הבטיחות הפנימית היא 74°C.',
        { claims:[{text:'74°C', kind:'internal_safe_temp', value:74, unit:'C',
                   subject:{item:'duck', category:null, form:'whole'}, confidence:1.0}] });
      return vcGuardSpoken('אם התכוונת לברווז או עוף, טמפרטורת הבטיחות הפנימית היא 74°C.',
        vcResolveTiers('מה טמפרטורת הבטיחות בדרוורס'), 'he', claims);
    })()`) as string;
    expect(said).not.toContain('לפי המדריך המאומת');
    expect(said).toContain('[…]');
    expect(said).toContain('אין לנו ערך בטיחות מאומת');
  });

  // G-a again, the sweep's `spec-43` רוקפור case: a cheese question answered with beef's 63°C, stamped.
  test('G2 · רוקפור: beef\'s 63°C is not stamped with the guide', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var claims=vcBuildClaimMap('אם התכוונת לרוסטביף, טמפרטורת הבטיחות הפנימית היא 63°C.',
        { claims:[{text:'63°C', kind:'internal_safe_temp', value:63, unit:'C',
                   subject:{item:'רוסטביף', category:null, form:'whole'}, confidence:1.0}] });
      return vcGuardSpoken('אם התכוונת לרוסטביף, טמפרטורת הבטיחות הפנימית היא 63°C.',
        vcResolveTiers('מה טמפרטורת הבטיחות ברוקפור'), 'he', claims);
    })()`) as string;
    expect(said).not.toContain('לפי המדריך המאומת');
    expect(said).toContain('[…]');
  });

  // G-b, the sweep's #1-ranked case `cut-102` שום שלם מעושן: the row holds tgt=85 and safe=0, and the
  // sentence claims an internal SAFETY temperature. A texture target may not borrow the safety authority.
  test('G3 · שום מעושן: a tgt claimed as a SAFETY temperature loses the marker', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var q='מה טמפרטורת הבטיחות בשום שלם מעושן';
      var a='בשום אין טמפרטורת בטיחות כמו בבשר, אבל מומלץ להגיע לטמפרטורה פנימית של 85°C.';
      var mk=function(kind){ return vcBuildClaimMap(a, { claims:[{text:'85°C', kind:kind, value:85, unit:'C',
             subject:{item:'garlic', category:null, form:'whole'}, confidence:1.0}] }); };
      var t=vcResolveTiers(q);
      return { row:{safe:t.t2.obj.safe, tgt:t.t2.obj.tgt},
               asSafety:vcGuardSpoken(a, t, 'he', mk('internal_safe_temp')),
               asTarget:vcGuardSpoken(a, t, 'he', mk('internal_target_temp')) };
    })()`) as any;
    expect(r.row.safe).toBe(0);                     // premise, read from the live catalogue
    expect(r.row.tgt).toBe(85);
    expect(r.asSafety).not.toContain('לפי המדריך המאומת');
    // NEGATIVE (DoD-6): the SAME number claimed as the doneness target it actually is keeps working —
    // R-3's approved safe/tgt marker set is not being re-litigated here, only its misuse as a safety floor.
    expect(r.asTarget).toContain('85°C');
  });

  // NEGATIVE / REGRESSION (the live asado case, R-53/R-62): when the claim's subject IS the question's
  // subject, the verified figure and the released targets must survive the new gate untouched.
  test('G4 · asado still speaks 63°C as the guide\'s figure and releases 90/95', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var a='טמפרטורת הבטיחות לבשר בקר היא 63°C. כדי שהאסאדו ייצא רך, המשך עד 90°C עד 95°C.';
      var claims=vcBuildClaimMap(a, { claims:[
        {text:'63°C', kind:'internal_safe_temp',   value:63, unit:'C', subject:{item:'asado', category:'beef', form:'whole'}, confidence:1.0},
        {text:'90°C', kind:'internal_target_temp', value:90, unit:'C', subject:{item:'asado', category:'beef', form:'whole'}, confidence:1.0},
        {text:'95°C', kind:'internal_target_temp', value:95, unit:'C', subject:{item:'asado', category:'beef', form:'whole'}, confidence:1.0}]});
      return vcGuardSpoken(a, vcResolveTiers('שאלה: מה טמפרטורת הבטיחות באסאדו'), 'he', claims);
    })()`) as string;
    expect(said).toContain('63°C');
    expect(said).toContain('לפי המדריך המאומת');
    expect(said).toContain('90°C');
    expect(said).toContain('95°C');
    expect(said).not.toContain('[…]');
  });

  // DoD-8/9 · the sweep's #1-ranked line, in the REAL Hebrew transcript. The classifier mock carries the
  // live response SHAPE (a parsed {claims:[…]} object, exactly what vcClassifySafetyClaims parses out of
  // the API response and hands to vcBuildClaimMap) — not a hand-assembled Map (L45, defect 1).
  test('G5 · the שום מעושן answer renders with no verified stamp (390x844)', async ({ page }) => {
    const shown = await renderAnswer(page,
      'מה טמפרטורת הבטיחות בשום שלם מעושן',
      'בשום אין טמפרטורת בטיחות כמו בבשר, אבל כדי שהוא יהיה מוכן, רך ובטוח למאכל, '
      + 'מומלץ להגיע לטמפרטורה פנימית של 85°C.',
      'אינו מאומת', 'sweep-G-garlic',
      JSON.stringify({ claims:[{ text:'85°C', kind:'internal_safe_temp', value:85, unit:'C',
                                 subject:{item:'garlic', category:null, form:'whole'}, confidence:1.0 }] }));
    expect(shown).not.toContain('לפי המדריך המאומת');
    expect(shown).not.toContain('85°C');
    expect(shown).toMatch(/\[…\]/);
    expect(shown).not.toMatch(/[A-Za-z]{3}/);        // Hebrew transcript, no English leak (DoD-9)
  });
});

// ══ SHAPE I · the app must not name a food nobody asked about ═════════════════════════════════════
test.describe('I · a catalogue name buried inside a question word is not a match', () => {

  // The sweep's `make-n-linguica-cal` case: asked about a smoked PORK sausage, the app said, in its own
  // voice, "אין לנו ערך בטיחות מאומת לברי" — the cheese ברי, matched inside the word "בקלבריה".
  test('I1 · a קלבריה question never names the cheese ברי (390x844)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var q='מה טמפרטורת הבטיחות בקלבריה';
      return { hits:(askFindEntity(q)||[]).map(function(h){return h.heb;}),
               said:vcSafeSubstitution(vcResolveTiers(q),'he') };
    })()`) as any;
    expect(r.said).not.toContain('ברי');
    const shown = await renderAnswer(page,
      'מה טמפרטורת הבטיחות בקלבריה',
      'טמפרטורת הבטיחות הפנימית לנקניקיית קלברזה מחזיר היא 71°C.',
      'אינו מאומת', 'sweep-I-calabresa');
    expect(shown).not.toContain('ברי');
  });

  // NEGATIVE (DoD-6): the cheese itself is still found when it is actually the word asked about.
  test('I2 · a real ברי question still resolves to ברי', async ({ page }) => {
    await boot(page);
    const said = await sub(page, 'מה טמפרטורת הבטיחות בברי');
    expect(said).toContain('ברי');
  });
});

// ══ DoD-9 · the seven shipped languages ═══════════════════════════════════════════════════════════
// No NEW user-facing string is introduced by this fix — the corrected paths land on sentences that
// already ship translated. This asserts that the sentence the F fix now produces really is translated
// on each language, with no Hebrew source-string leak.
test.describe('R-69 · i18n', () => {
  for (const lang of ['en', 'fr', 'de', 'es', 'it', 'ru']) {
    test(`the corn answer carries no Hebrew source string in ${lang}`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
      await page.evaluate(() => (window as any).__mkLangReady);
      await page.waitForFunction(`typeof vcSafeSubstitution==='function'`);
      const said = await page.evaluate(
        `vcSafeSubstitution(vcResolveTiers('מה טמפרטורת הבטיחות בתירס'),${JSON.stringify(lang)})`) as string;
      expect(said).not.toBe('');
      expect(said).not.toContain('0°C');
      expect(said).not.toContain('אין לנו ערך בטיחות מאומת');
    });
  }
});

// ══ F(b) · shape F again — in the LOCAL ask engine, a path the R-69 fix never covered ═════════════
// Found 2026-08-03 while designing the data-model refactor, by asking Serena for every consumer of
// `.safe` in app.js (§10.17). The R-69 fix hardened `vcIdentifiedSafeItem` (the VOICE path) so that
// `safe=0` — the data layer's "not applicable", carried by every ירקות/פירות row — can no longer be
// spoken as a cited figure. `askFire` (the LOCAL ask engine, "⚡ מנוע מקומי") was never touched, and it
// carries its own fallback:
//
//     `טמפ׳ בטיחות ${c.safe||63}°C`
//
// so `0||63` and `undefined||63` both render **63** — a number that appears nowhere in the row and
// traces to no source. Reproduced in the real UI at 390x844 before this test was written: asking
// "האם תירס בטוח" rendered "תירס: טמפ׳ בטיחות 63°C", stamped with the app's own ⚡מקומי badge, i.e.
// asserted as OUR verified value rather than a model's guess.
//
// Reachability is branch-ordered and that is why the sweep missed it: the earlier
// `has('טמפ','חום','מעלות')` branch is correctly guarded (`${c.safe?...:''}`), so any question containing
// the word "טמפרטורה" never reaches this one. It takes a safety question WITHOUT a temperature word.
// 27 of 130 catalogue cuts carry a falsy `safe` and are therefore affected.
test.describe('F(b) · the local ask engine never invents a safety number', () => {

  const askLocal = async (page: any, q: string) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-askai': '0' });   // '0' = local engine, no network
    await page.waitForFunction(`typeof askFire==='function' && typeof openAsk==='function'`);
    await page.evaluate(`openAsk();`);
    await page.waitForSelector('#askq');
    await page.fill('#askq', q);
    await page.click('#askgo');
    await page.waitForSelector('.abubble');
    return await page.evaluate(`document.querySelector('.abubble').textContent`) as string;
  };

  // RED before the fix: renders "תירס: טמפ׳ בטיחות 63°C".
  test('F(b)1 · a safety question about corn shows no fabricated 63°C (390x844)', async ({ page }) => {
    const shown = await askLocal(page, 'האם תירס בטוח');
    expect(shown).toContain('תירס');
    expect(shown).not.toContain('63');
    expect(shown).not.toMatch(/טמפ׳ בטיחות\s*\d/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'mockups/rb-corn-local-ask-390x844.png' });
  });

  // The same shape reached through two other phrasings that also skip the temperature branch.
  test('F(b)2 · the other phrasings that reach this branch are equally clean', async ({ page }) => {
    for (const q of ['בטיחות בצל', 'האם חציל בטוח']) {
      const shown = await askLocal(page, q);
      expect(shown).not.toContain('63');
    }
  });

  // NEGATIVE (DoD-6) · a row that DOES hold a cited safety figure must still show it, unchanged.
  test('F(b)3 · brisket still shows its real cited 63°C', async ({ page }) => {
    const shown = await askLocal(page, 'בטיחות בריסקט');
    expect(shown).toContain('בריסקט');
    expect(shown).toContain('63');
  });

  // The invariant behind the fix, asserted over the WHOLE catalogue rather than three samples:
  // no cut with a falsy `safe` may produce a safety number from this engine.
  // The regex below is built with `new RegExp` from a plain string, NOT written as a literal inside the
  // template literal. Reason, paid for once: inside a TS template literal `\s` is not a recognised escape
  // and collapses to a bare `s`, so the first draft of this test reached the browser as /…s*d/, matched
  // nothing, and passed on its first run while proving nothing. The contract voids a first-run pass
  // (L45), which is the only reason it was caught. Escaping is easy to get wrong twice; not escaping
  // at all cannot be.
  test('F(b)4 · no falsy-safe cut anywhere in the catalogue yields a number', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-askai': '0' });
    await page.waitForFunction(`typeof askFire==='function'`);
    const bad = await page.evaluate(`(function(){
      var re = new RegExp(${JSON.stringify('טמפ׳ בטיחות\\s*\\d')});
      var out=[];
      DATA.cuts.filter(function(c){ return !c.safe; }).forEach(function(c){
        var r=askFire('בטיחות '+c.heb);
        var t=(r&&r.t?String(r.t):String(r)).replace(/<[^>]+>/g,'');
        if(re.test(t)) out.push(c.heb+' → '+t.slice(0,60));
      });
      return out;
    })()`) as string[];
    // guard the guard: the regex must be able to fire at all (an interceptor that never matches is
    // indistinguishable from a passing test — TEST-AUTHORING-CONTRACT §6).
    const canFire = await page.evaluate(
      `new RegExp(${JSON.stringify('טמפ׳ בטיחות\\s*\\d')}).test('בריסקט: טמפ׳ בטיחות 63°C.')`) as boolean;
    expect(canFire).toBe(true);
    expect(bad).toEqual([]);
  });
});
