import { test, expect, seedApp } from './_fixtures';

// ── R-64 · the entity ladder (owner report 2.8.26) ────────────────────────────────────────────────
// Evidence: docs/analysis/2026-08-02-lamb-beef-misattribution.md — measured live on v287, not inferred.
// The question "מהי טמפרטורת הבטיחות לצלעות כבש" was answered with OUR OWN sentence
// "לפי המדריך, הטמפרטורה הבטוחה עבור צלעות בקר (דינו): 63°C." — a different animal, carrying the app's
// highest authority marker — while every genuine lamb figure in the same answer was redacted.
//
// Five sub-fixes, each with its own test below:
//   A · the distinguishing word must count — askFindEntity ranks by COVERAGE of the question's own words
//   B · the leading sentence is gated — unambiguous AND consistent with those words, or it is not spoken
//   C · the ladder — item → (item with no cited figure → "we don't have it") → category → mixed range
//   D · vcHitsUniformSafeC refuses a hit set that crosses subjects, even when the VALUE is uniform
//   E · (owner amendment 2.8.26) the classifier may CHOOSE a category from OUR OWN vocabulary — כבש→טלה
//
// Every test drives the REAL resolution path on the REAL catalog. The lesson this bug already cost twice
// (v286's hand-built claim map; the duplicate-ack test that never opened the voice panel): a test that
// does not run the real path is not evidence.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof askFindEntity==='function' && typeof vcResolveTiers==='function'
                              && typeof vcSafeSubstitution==='function' && typeof vcGuardSpoken==='function'`);
};

const LAMB_Q = 'מהי טמפרטורת הבטיחות לצלעות כבש';
// The model's own answer, in the shape the owner received: five numbers, so the "exactly one number"
// eligibility rule sends the whole sentence to redaction and the guard appends OUR sentence.
const LAMB_A = 'טמפרטורת הבטיחות הפנימית המומלצת לבשר כבש היא 63°C עם מנוחה של 3 דקות לפחות. '
             + 'אם מדובר בכבש טחון, יש להגיע ל-71°C. בצלעות כבש בבישול ארוך מגיעים ל-90°C עד 95°C.';

const sub = (page: any, q: string) => page.evaluate(
  `vcSafeSubstitution(vcResolveTiers(${JSON.stringify(q)}), 'he')`) as Promise<string>;

test.describe('R-64 A · the distinguishing word counts', () => {

  // The measured defect: "צלעות כבש", "צלעות כבש בגריל" and bare "צלעות" all returned the SAME list in
  // the SAME order, beef first, because a token under 4 characters contributes zero to the score.
  test('A1 · "צלעות כבש" resolves to the LAMB row, and the hit SET is unchanged', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var h=askFindEntity(${JSON.stringify(LAMB_Q)}.toLowerCase())||[];
      return { first:h[0]&&h[0].heb, firstCat:h[0]&&h[0].cat,
               set:h.map(function(x){return x.heb;}).sort(),
               bare:(askFindEntity('צלעות')||[]).map(function(x){return x.heb;}).sort() };
    })()`) as any;
    expect(r.first).toBe('צלעות כבש (קארה)');
    expect(r.firstCat).toBe('טלה');
    // ordering-only change: the SET of matches is byte-identical to what "צלעות" alone finds
    expect(r.set).toEqual(r.bare);
  });

  // NEGATIVE (DoD-6): a single-token question has nothing to distinguish — its order must not move.
  test('A2 · a single-token question keeps its shipped order (אסאדו → אסאדו)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(askFindEntity('אסאדו במעשנה')||[]).map(function(x){return x.heb;})`) as string[];
    expect(r[0]).toBe('אסאדו');
  });
});

test.describe('R-64 B · the leading sentence is gated', () => {

  // ★ THE OWNER'S OWN CASE, through the REAL ask flow, asserted on the RENDERED transcript. DoD-4/8/9.
  test('B1 · the lamb question never renders a BEEF row (390x844)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                          'mk-gemkey': JSON.stringify('test-key') });
    await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
    await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
    await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'צלעות כבש (קארה)',t:new Date()}]); })()`);
    await page.waitForSelector('#vcBody');
    await page.evaluate(`window.__vcAskMock=${JSON.stringify(LAMB_A)}; window.__vcClassMock=null;`);
    try {
      await page.evaluate(`vcAskFlow(${JSON.stringify(LAMB_Q)})`);
      await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a');
        return a && a.textContent.indexOf('לפי המדריך')>=0; })()`);
      const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
      expect(shown).toContain('צלעות כבש');
      expect(shown).not.toContain('בקר');            // ← the reported defect, in the rendered text
      expect(shown).toContain('63°C');
      await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
      await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
      await page.screenshot({ path: '.superpowers/sdd/entity-ladder-lamb-390x844.png' });
    } finally {
      await page.evaluate(`window.__vcAskMock=null; window.__vcClassMock=null;`);
    }
  });

  // NEGATIVE (DoD-6): when the winning row does NOT carry every word the candidates distinguish on, the
  // sentence is refused rather than attributed to the wrong row.
  test('B2 · an inconsistent hand-built resolution is refused', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var all=askAllItems();
      var beef=all.filter(function(m){return m.heb==='צלעות בקר (דינו)';})[0];
      var lamb=all.filter(function(m){return m.heb==='צלעות כבש (קארה)';})[0];
      return vcSafeSubstitution({t1:null,t2:beef,cat:null,t2all:[beef,lamb],q:'צלעות כבש'},'he');
    })()`) as string;
    expect(said).not.toContain('בקר');
  });
});

test.describe('R-64 C · the ladder', () => {

  // OWNER RULING 2.8.26 — an item we HAVE with no cited safety figure says so explicitly, and must NOT
  // fall back to its category: נקניקיות reads "uniform 71°C" from ONE pre-cooked row out of 39, and 71
  // on raw merguez is a dangerous number.
  test('C1 · מרגז says we have no figure — never the category 71°C, never "check the item card"', async ({ page }) => {
    await boot(page);
    const q = 'מה הדרך המומלצת להכין נקניקיות מרגז על הגריל';
    const s = await sub(page, q);
    expect(s).toContain('אין לנו ערך בטיחות מאומת');
    expect(s).toContain('מרגז');
    expect(s).not.toContain('71');
    // and the WHOLE guarded answer must not send the cook to a card that carries no figure
    const said = await page.evaluate(`vcGuardSpoken('מומלץ לצלות עד 71°C פנימי, כ-10 דקות.',
        vcResolveTiers(${JSON.stringify(q)}), 'he', null)`) as string;
    expect(said).not.toContain('כרטיס הפריט');
    expect(said).toContain('אין לנו ערך בטיחות מאומת');
  });

  // OWNER RULING 2.8.26 — a MIXED category answers with the range and BOTH representatives, from our own
  // tables, identified as cuts. Today "בקר" renders a screen with no safety number at all.
  test('C2 · a mixed category answers with both representatives (63 and 71), from the catalog', async ({ page }) => {
    await boot(page);
    const s = await sub(page, 'מה טמפרטורת הבטיחות לבקר');
    expect(s).toContain('63°C');
    expect(s).toContain('71°C');
    const names = await page.evaluate(`askAllItems().filter(function(m){return m.cat==='בקר';}).map(function(m){return m.heb;})`) as string[];
    expect(names.some(n => s.includes(n))).toBe(true);        // representatives are REAL catalog rows
  });

  // DoD-8/9 evidence for BOTH new sentences: rendered in the real Hebrew voice transcript at 390x844.
  for (const c of [
    { id:'merguez', q:'מה הדרך המומלצת להכין נקניקיות מרגז על הגריל',
      a:'צלה את המרגז על 200°C במשך 10 דקות עד 71°C פנימי.', want:'אין לנו ערך בטיחות מאומת' },
    { id:'beef', q:'מה טמפרטורת הבטיחות לבקר',
      a:'טמפרטורת הבטיחות היא 63°C, ולבשר טחון 71°C.', want:'זה תלוי בנתח' },
  ]) {
    test(`C4-${c.id} · the new sentence renders in the Hebrew transcript (390x844)`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                            'mk-gemkey': JSON.stringify('test-key') });
      await page.waitForFunction(`typeof vcAskFlow==='function'`);
      await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
      await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
      await page.waitForSelector('#vcBody');
      await page.evaluate(`window.__vcAskMock=${JSON.stringify(c.a)}; window.__vcClassMock=null;`);
      try {
        await page.evaluate(`vcAskFlow(${JSON.stringify(c.q)})`);
        await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a');
          return a && a.textContent.indexOf(${JSON.stringify(c.want)})>=0; })()`);
        const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
        expect(shown).toContain(c.want);
        expect(shown).not.toMatch(/[A-Za-z]{3}/);       // Hebrew transcript, no English leak (DoD-9)
        await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
        await page.screenshot({ path: `.superpowers/sdd/entity-ladder-${c.id}-390x844.png` });
      } finally {
        await page.evaluate(`window.__vcAskMock=null; window.__vcClassMock=null;`);
      }
    });
  }

  // REGRESSION (brief case 4) — this works today and must not break.
  test('C3 · עוף and עוף בגריל both answer 74°C, and agree with each other', async ({ page }) => {
    await boot(page);
    const a = await sub(page, 'מה טמפרטורת הבטיחות לעוף');
    const b = await sub(page, 'עוף בגריל');
    expect(a).toContain('74°C');
    expect(a).toBe(b);
  });
});

test.describe('R-64 D · uniform value is not correct subject', () => {

  test('D1 · a hit set crossing categories is refused even when every safe value agrees', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var hits=askFindEntity('צלעות')||[];
      var cats={}; hits.forEach(function(h){ cats[h.cat]=1; });
      var lamb=hits.filter(function(h){ return h.cat==='טלה'; });
      return { cats:Object.keys(cats).length, mixed:vcHitsUniformSafeC(hits), sameCat:vcHitsUniformSafeC(lamb) };
    })()`) as any;
    expect(r.cats).toBeGreaterThan(1);
    expect(r.mixed).toBeNull();          // crosses בקר/טלה → refused
    expect(r.sameCat).toBe(63);          // NEGATIVE: one subject, uniform → still allowed
  });

  // REGRESSION (brief case 5) — v287's own live case, with the classifier's live subject shape: the
  // guide's 63 leads (verified marker) and 90/95 are released. Nothing here may be lost to the new gates.
  test('D2 · asado still speaks 63 as the guide\'s figure and releases 90/95', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var mk=function(t,v,k){ return {text:t, kind:k, value:v, unit:'C',
        subject:{category:'beef', item:'asado', form:'whole'}, confidence:1.0}; };
      var cs=[mk('63°C',63,'internal_safe_temp'), mk('90°C',90,'internal_target_temp'), mk('95°C',95,'internal_target_temp')];
      var m=new Map(); cs.forEach(function(c){ m.set(c.text,c); });
      return vcGuardSpoken('טמפרטורת הבטיחות לבשר בקר היא 63°C. כדי שהאסאדו ייצא רך, המשך עד 90°C עד 95°C.',
        vcResolveTiers('שאלה: מה טמפרטורת הבטיחות באסאדו'), 'he', m);
    })()`) as string;
    expect(said).toContain('90°C');
    expect(said).toContain('95°C');
    expect(said).toContain('63°C');
    expect(said).toContain('לפי המדריך המאומת');
    expect(said).not.toContain('[…]');
  });

  // REGRESSION (brief case 6) — a target BELOW the cited floor is still redacted.
  test('D3 · a target below the floor is still redacted', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var c={text:'50°C', kind:'internal_target_temp', value:50, unit:'C',
             subject:{category:'beef', item:'asado', form:'whole'}, confidence:1.0};
      return vcGuardSpoken('הוצא את האסאדו ב-50°C ואז ב-52°C.',
        vcResolveTiers('שאלה: מה טמפרטורת הבטיחות באסאדו'), 'he', new Map([[c.text,c]]));
    })()`) as string;
    expect(said).not.toContain('50°C');
    expect(said).toContain('[…]');
  });
});

test.describe('R-64 E · the classifier may CHOOSE from our own vocabulary (owner amendment 2.8.26)', () => {

  // "שאלה על כבש תחזיר כמו טלה" — כבש≈טלה is semantic knowledge no token scoring reaches: כבש is not a
  // category in the catalog and askFindCategory is a plain substring. The classifier returns an
  // identifier FROM OUR LIST; the number still comes from our tables.
  test('E1 · bare "כבש" resolves through the catalog category טלה and answers 63°C', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(`(function(){
      var q='מהי טמפרטורת הבטיחות לכבש';
      var pre={ ent:(askFindEntity(q)||[]).length, cat:askFindCategory(q) };
      var claims=vcBuildClaimMap('הטמפרטורה היא 63°C ו-71°C.',
        { subject_category:'טלה', claims:[
          {text:'63°C', kind:'internal_safe_temp', value:63, unit:'C', subject:{item:'kebes', category:null, form:'whole'}, confidence:1.0}
        ]});
      return { pre:pre, said:vcSafeSubstitution(vcResolveTiers(q),'he',claims) };
    })()`) as any;
    expect(r.pre.ent).toBe(0);        // premise: no item, no lexical category — read from the live catalog
    expect(r.pre.cat).toBeNull();
    expect(r.said).toContain('63°C');
    expect(r.said).toContain('טלה');
  });

  // NEGATIVE (DoD-6): the model may only CHOOSE — an invented value is ignored, never looked up.
  test('E2 · an invented category is refused and the deterministic ladder stands', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(`(function(){
      var q='מהי טמפרטורת הבטיחות לכבש';
      var claims=vcBuildClaimMap('הטמפרטורה היא 63°C.',
        { subject_category:'שור מיתולוגי', claims:[
          {text:'63°C', kind:'internal_safe_temp', value:63, unit:'C', subject:{item:'x', category:null, form:'whole'}, confidence:1.0}
        ]});
      return vcSafeSubstitution(vcResolveTiers(q),'he',claims);
    })()`) as string;
    expect(said).toBe('');
  });
});

// DoD-9 / seven shipped languages: the new sentences must render translated, with no Hebrew leak.
test.describe('R-64 · i18n', () => {
  for (const lang of ['fr', 'de', 'es', 'it', 'ru']) {
    test(`the new ladder sentences carry no Hebrew in ${lang}`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
      await page.evaluate(() => (window as any).__mkLangReady);
      await page.waitForFunction(`typeof vcSafeSubstitution==='function'`);
      // The QUESTION stays Hebrew here on purpose: what is under test is the language of the prose the
      // ladder authors, not the resolver's own language coverage (askFindCategory reads the Hebrew and
      // English catalog names only — that gap is exactly what the classifier's constrained choice, E1,
      // exists to cover, and it is not what this test measures).
      const r = await page.evaluate(`(function(){
        return { nofig: vcSafeSubstitution(vcResolveTiers('נקניקיות מרגז על הגריל'),${JSON.stringify(lang)}),
                 mixed: vcSafeSubstitution(vcResolveTiers('מה טמפרטורת הבטיחות לבקר'),${JSON.stringify(lang)}) };
      })()`) as any;
      expect(r.nofig).not.toBe('');
      expect(r.mixed).not.toBe('');
      // The item/category NAMES route through the __names__ dict (itemName/t); what this asserts is the
      // STATIC prose the ladder itself authors — it must never leak its Hebrew source string.
      expect(r.nofig).not.toContain('אין לנו ערך בטיחות מאומת');
      expect(r.mixed).not.toContain('זה תלוי בנתח');
      expect(r.mixed).not.toContain('בקטגוריית');
    });
  }
});
