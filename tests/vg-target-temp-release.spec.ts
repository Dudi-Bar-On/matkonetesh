import { test, expect, seedApp } from './_fixtures';

// ── Guard fix · Task 1 (owner rulings 1.8.26 + 2.8.26) ────────────────────────────────────────────
// Evidence: docs/analysis/2026-08-02-asado-guard-repro.md — a live v285 asado answer had 90°C/95°C
// classified CORRECTLY as `internal_target_temp` at confidence 0.98 and redacted anyway, because
// SAFETY_CLAIM_SAFETY_KINDS demanded numeric EQUALITY with the catalog `safe` figure (63) that a
// texture target can never have.
// Owner ruling 2.8.26: an internal TARGET temperature is RELEASED when it is ≥ the catalog `safe`
// value, and REDACTED when it is below it. Monotone in the safe direction; it removes no protection.
//
// Change 1 covers `vcClaimVerdict` only. `internal_safe_temp` and `cure_ppm` keep the equality rule.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof vcGuardSpoken==='function' && typeof vcClaimVerdict==='function'`);
};

// The fixture's reference figure comes from the SAME catalog the guard reads (vcClaimSubjectSafeC →
// catUniformSafe) — never a hard-coded safety number in the test. Chicken is uniformly 74°C.
const chickenSafe = (page: any) => page.evaluate(`catUniformSafe(askFindCategory('עוף'))`) as Promise<number>;

const targetClaim = (text: string, value: number) => ({
  text, kind: 'internal_target_temp', value, unit: 'C',
  subject: { item: null, category: 'עוף', form: 'whole' }, confidence: 0.98,
});

test.describe('Guard fix · change 1 — an internal target temp at or above the safe floor survives', () => {

  test('C1-a · a target temp ABOVE the catalog safe value is spoken verbatim (the asado shape)', async ({ page }) => {
    await boot(page);
    const safe = await chickenSafe(page);
    expect(safe).toBe(74);                        // the fixture's premise, read from the catalog itself
    const said = await page.evaluate(([c]: any[]) => {
      const w = window as any;
      return w.vcGuardSpoken('הבא אותו ל-90°C פנימי לרכות.', {t1:null,t2:null,cat:null}, 'he',
        new Map([[c.text, c]]));
    }, [targetClaim('90°C', 90)]);
    expect(said).toContain('90°C');               // 90 ≥ 74 → released
    expect(said).not.toContain('[…]');
    expect(said).not.toContain('לפי המדריך המאומת');   // released verbatim, NOT stamped as our verified figure
  });

  test('C1-b · NEGATIVE — a target temp BELOW the safe floor is still redacted', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(([c]: any[]) => {
      const w = window as any;
      return w.vcGuardSpoken('הבא אותו ל-50°C פנימי לרכות.', {t1:null,t2:null,cat:null}, 'he',
        new Map([[c.text, c]]));
    }, [targetClaim('50°C', 50)]);
    expect(said).not.toContain('50');             // 50 < 74 → protection unchanged
    expect(said).toContain('[…]');
  });

  test('C1-c · NEGATIVE — internal_safe_temp keeps the strict equality rule (no protection removed)', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const c = { text:'90°C', kind:'internal_safe_temp', value:90, unit:'C',
                  subject:{ item:null, category:'עוף', form:'whole' }, confidence:0.98 };
      return w.vcGuardSpoken('הטמפרטורה הבטוחה לעוף היא 90°C.', {t1:null,t2:null,cat:null}, 'he',
        new Map([[c.text, c]]));
    });
    expect(said).not.toContain('90');             // 90 ≠ 74 and the kind is a SAFE claim → still redacted
    expect(said).toContain('[…]');
  });

  test('C1-d · NEGATIVE — an unidentified subject is still redacted even above any floor', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const c = { text:'90°C', kind:'internal_target_temp', value:90, unit:'C',
                  subject:{ item:'תנין', category:null, form:'whole' }, confidence:0.98 };
      return w.vcGuardSpoken('הבא את התנין ל-90°C.', {t1:null,t2:null,cat:null}, 'he',
        new Map([[c.text, c]]));
    });
    expect(said).not.toContain('90');             // no reference figure → nothing to compare → redact
    expect(said).toContain('[…]');
  });

  // DoD-8/9 evidence — the whole change 1 path end-to-end through the REAL ask flow (model answer →
  // classifier → guard → vcRender), read from the rendered Hebrew transcript the user actually sees.
  test('C1-e · DoD-8/9 — the released target temps render in the Hebrew voice-panel transcript at 390x844', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                          'mk-gemkey': JSON.stringify('test-key') });
    await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
    await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
    await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'אסאדו',t:new Date()}]); })()`);
    await page.waitForSelector('#vcBody');
    await page.evaluate(`(function(){
      window.__vcAskMock='לעוף שלם הטמפרטורה הפנימית הבטוחה היא 74°C. להבאה לרכות מומלץ להמשיך ל-90°C ואף ל-95°C.';
      window.__vcClassMock=function(){ return { claims:[
        {text:'74°C', kind:'internal_safe_temp',   value:74, unit:'C', subject:{item:null,category:'עוף',form:'whole'}, confidence:0.98},
        {text:'90°C', kind:'internal_target_temp', value:90, unit:'C', subject:{item:null,category:'עוף',form:'whole'}, confidence:0.98},
        {text:'95°C', kind:'internal_target_temp', value:95, unit:'C', subject:{item:null,category:'עוף',form:'whole'}, confidence:0.98}
      ]}; };
    })()`);
    try {
      await page.evaluate(`vcAskFlow('שאלה: לאיזו טמפרטורה להביא את העוף')`);
      await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('90°C')>=0; })()`);
      const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
      expect(shown).toContain('90°C');
      expect(shown).toContain('95°C');
      expect(shown).toContain('74°C');
      expect(shown).not.toContain('[…]');
      expect(shown).not.toMatch(/[A-Za-z]{3}/);     // Hebrew transcript — no English leak (DoD-9)
      await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
      await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
      await page.screenshot({ path: '.superpowers/sdd/guard-fix-1-target-release-390x844.png' });
    } finally {
      await page.evaluate(`window.__vcClassMock=null; window.__vcAskMock=null;`);
    }
  });
});

// ── Change 2 — the immediate acknowledgement must fire on SAFETY answers too ──────────────────────
// Owner ruling 1.8.26: *"אנחנו מראש מוכנים לשלם בזמן ארוך יותר ולכן גם מוציאים באופן מיידי הודעה קולית
// רגע בודק אז המשתמש רגוע ויש זמן להחזיר תשובה בדוקה ואיכותית."*
// Evidence (repro §4): `firstSentence` was never marked in ANY of the five live runs — the early-opener
// gate (vcStreamSafe) requires a DIGIT-FREE sentence and a safety answer's first sentence always carries
// a number, so the user got 19.5 s of total silence. The fixed acknowledgement phrase (VC_ACK, "רגע,
// בודק.") is digit-free BY CONSTRUCTION and is never model output, so speaking it cannot leak anything
// the guard would have redacted — the content gate is untouched.
const askHarness = `(async function(digitFirst){
  var w=window; var streamed=[]; var preGuardTts=-1;
  w.__gemTtsStreamMock=function(t){ streamed.push(String(t)); return Promise.resolve(undefined); };
  w.__gemTtsMock=function(){ return {mock:true}; };
  w.__gemPlayMock=async function(){};
  var realGuard=w.vcGuardSpoken;
  w.vcGuardSpoken=function(t,ti,l,c){ if(preGuardTts<0) preGuardTts=streamed.length; return realGuard(t,ti,l,c); };
  w.__vcAskStreamMock=async function(_q,onDelta){
    if(digitFirst){ onDelta('משוך אותו ב-96 מעלות פנימי. '); onDelta('אחר כך תן לו לנוח.');
                    return 'משוך אותו ב-96 מעלות פנימי. אחר כך תן לו לנוח.'; }
    onDelta('קודם כל, תן לזה להתייצב. '); onDelta('משוך אותו ב-96 מעלות פנימי.');
    return 'קודם כל, תן לזה להתייצב. משוך אותו ב-96 מעלות פנימי.';
  };
  try{ await w.vcAskFlow('שאלה מתי למשוך'); }
  finally{ delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock;
           w.vcGuardSpoken=realGuard; }
  return { streamed:streamed, preGuardTts:preGuardTts, a:String(vcLastQA&&vcLastQA.a), lat:w.vcLatReport() };
})`;

test.describe('Guard fix · change 2 — the immediate acknowledgement fires on a digit-bearing answer', () => {

  test('C2-a · a digit-bearing first sentence still gets an immediate SPOKEN acknowledgement', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-gemkey': JSON.stringify('k-test') });
    await page.waitForFunction(`typeof vcAskFlow==='function'`);
    const r = await page.evaluate(`${askHarness}(true)`) as any;
    expect(r.preGuardTts).toBe(1);                       // exactly ONE pre-guard request — the quota covenant holds
    expect(r.streamed[0]).toContain('רגע, בודק');         // …and it is the fixed acknowledgement
    expect(r.streamed[0]).not.toMatch(/\d/);             // digit-free by construction — the content gate is untouched
    expect(r.streamed.some((s: string) => s.includes('96'))).toBe(false);  // the model's number never left early
    expect(r.lat.firstSentence).toBe(undefined);          // no MODEL sentence was released early
    expect(r.a).toContain('אינו מאומת');                   // the guarded answer still lands on screen
  });

  test('C2-b · NEGATIVE — a digit-free first sentence still speaks the MODEL opener, not the ack', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-gemkey': JSON.stringify('k-test') });
    await page.waitForFunction(`typeof vcAskFlow==='function'`);
    const r = await page.evaluate(`${askHarness}(false)`) as any;
    expect(r.preGuardTts).toBe(1);
    expect(r.streamed[0]).toContain('קודם כל');            // unchanged: the real opener wins when it is safe
    expect(r.streamed[0]).not.toContain('רגע, בודק');
    expect(typeof r.lat.firstSentence).toBe('number');
  });
});

// ── Change 3 — the bare lower bound of a claim-only range ─────────────────────────────────────────
// Evidence (repro §5): in the ribs answer "5 עד 6 שעות" the classifier emitted a `duration` claim for
// "6 שעות" only — the bare "5" carries no unit of its own, so no claim can key on it, and it fell to the
// blind bare-digit sweep and was redacted. The user reads "[…] עד 6 שעות" and experiences exactly the
// same complaint: the numbers are missing. The lower bound is released ONLY when the upper bound of the
// very same range is released by the SAME decision table — never on its own.
const ribs = (text: string, dur: string | null) => ({
  text,
  claims: ([
    ['110°C', { text:'110°C', kind:'chamber_temp', value:110, unit:'C',
                subject:{item:null,category:null,form:'unknown'}, confidence:0.96 }],
  ] as any[]).concat(dur ? [[dur, { text:dur, kind:'duration', value:6, unit:'h',
                subject:{item:null,category:null,form:'unknown'}, confidence:0.97 }]] : []),
});

test.describe('Guard fix · change 3 — a released range keeps its bare lower bound', () => {

  test('C3-a · "5 עד 6 שעות" survives whole once the upper bound is released', async ({ page }) => {
    await boot(page);
    const f = ribs('עשן ב-110°C במשך 5 עד 6 שעות.', '6 שעות');
    const said = await page.evaluate((x: any) => (window as any)
      .vcGuardSpoken(x.text, {t1:null,t2:null,cat:null}, 'he', new Map(x.claims)), f);
    expect(said).toContain('5 עד 6 שעות');
    expect(said).not.toContain('[…]');
  });

  test('C3-b · the hyphen form "5-6 שעות" survives byte-identically too', async ({ page }) => {
    await boot(page);
    const f = ribs('עשן ב-110°C במשך 5-6 שעות.', '6 שעות');
    const said = await page.evaluate((x: any) => (window as any)
      .vcGuardSpoken(x.text, {t1:null,t2:null,cat:null}, 'he', new Map(x.claims)), f);
    expect(said).toContain('5-6 שעות');
    expect(said).not.toContain('[…]');
  });

  test('C3-c · NEGATIVE — no claim on the upper bound → BOTH numbers still redacted, byte-identical to today', async ({ page }) => {
    await boot(page);
    const f = ribs('עשן ב-110°C במשך 5 עד 6 שעות.', null);   // duration claim absent
    const [withClaims, today] = await page.evaluate((x: any) => {
      const w = window as any;
      return [w.vcGuardSpoken(x.text, {t1:null,t2:null,cat:null}, 'he', new Map(x.claims)),
              w.vcGuardSpoken(x.text, {t1:null,t2:null,cat:null}, 'he', null)];
    }, f);
    expect(withClaims).not.toContain('5 עד 6');
    expect(withClaims).toContain('[…]');
    // and with NO claims at all the output is unchanged from the shipped guard — the new pass is inert
    expect(today).toContain('[…]');
    expect(today).not.toContain('110°C');
  });

  test('C3-d · NEGATIVE — a low-confidence duration claim releases neither bound', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map<string, any>([
        ['110°C',  { text:'110°C',  kind:'chamber_temp', value:110, unit:'C',
                     subject:{item:null,category:null,form:'unknown'}, confidence:0.96 }],
        ['6 שעות', { text:'6 שעות', kind:'duration', value:6, unit:'h',
                     subject:{item:null,category:null,form:'unknown'}, confidence:0.70 }],
      ]);
      return w.vcGuardSpoken('עשן ב-110°C במשך 5 עד 6 שעות.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('5 עד 6');
    expect(said).toContain('[…]');
  });

  // DoD-8/9 evidence — the ribs shape the owner actually complained about, rendered end-to-end.
  test('C3-e · DoD-8/9 — the whole range renders in the Hebrew voice-panel transcript at 390x844', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                          'mk-gemkey': JSON.stringify('test-key') });
    await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
    await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
    await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'צלעות',t:new Date()}]); })()`);
    await page.waitForSelector('#vcBody');
    await page.evaluate(`(function(){
      window.__vcAskMock='עשן את הצלעות ב-110°C במשך 5 עד 6 שעות.';
      window.__vcClassMock=function(){ return { claims:[
        {text:'110°C',  kind:'chamber_temp', value:110, unit:'C', subject:{item:null,category:null,form:'unknown'}, confidence:0.96},
        {text:'6 שעות', kind:'duration',     value:6,   unit:'h', subject:{item:null,category:null,form:'unknown'}, confidence:0.97}
      ]}; };
    })()`);
    try {
      await page.evaluate(`vcAskFlow('שאלה: כמה זמן לעשן צלעות')`);
      await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('5 עד 6 שעות')>=0; })()`);
      const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
      expect(shown).toContain('110°C');
      expect(shown).toContain('5 עד 6 שעות');
      expect(shown).not.toContain('[…]');
      expect(shown).not.toMatch(/[A-Za-z]{3}/);     // Hebrew transcript — no English leak (DoD-9)
      await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
      await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
      await page.screenshot({ path: '.superpowers/sdd/guard-fix-3-range-390x844.png' });
    } finally {
      await page.evaluate(`window.__vcClassMock=null; window.__vcAskMock=null;`);
    }
  });
});
