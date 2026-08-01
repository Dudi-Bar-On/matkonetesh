import { test, expect, seedApp } from './_fixtures';

const ANSWERS = [
  'הטמפרטורה הבטוחה לאסאדו היא 63°C, המשך ל-71°C, ולרכות ~93°C.',
  'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.',
  'הוצא אותו ב-165 פנימי.',                 // bare digit run, no unit anywhere (G-A1 hole 1)
  'טווח 63°C-74°C.',                         // a range token
  'אין כאן שום מספר.',                       // no tokens at all
];

test.describe('R-62 Task 3 · P6 — every failure path is byte-identical to today', () => {
  for (const [name, mock] of [
    ['api error',        () => { throw new Error('api-429'); }],
    ['timeout',          () => { throw new Error('timeout'); }],
    ['malformed JSON',   () => { throw new SyntaxError('Unexpected token'); }],
    ['schema violation', () => ({ claims: [{ nope: 1 }] })],
    ['empty claims',     () => ({ claims: [] })],
    ['no token match',   () => ({ claims: [{ text: '999°C', kind: 'chamber_temp', value: 999, unit: 'C', confidence: 1 }] })],
  ] as [string, any][]) {
    test(`D6 · ${name} → identical output`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked': 'true' });
      const pairs = await page.evaluate(async (src) => {
        const w = window as any;
        // eslint-disable-next-line no-eval
        // Safe here: `src.fn` is a fixed literal from THIS test file's own `mock` array above (never
        // user/network input), stringified only to cross the page.evaluate() serialization boundary and
        // reconstituted into a function page-side — the same pattern the shipped __vcAskMock/__aiMock
        // test seams already use (app.js:7809).
        w.__vcClassMock = eval('(' + src.fn + ')');
        const out: [string, string][] = [];
        for (const a of src.answers) {
          const claims = await w.vcClassifySafetyClaims(a);      // exercises the real failure path
          out.push([w.vcGuardSpoken(a, {t1:null,t2:null,cat:null}, 'he', claims),
                    w.vcGuardSpoken(a, {t1:null,t2:null,cat:null}, 'he')]);   // today's 3-arg call
        }
        w.__vcClassMock = null;
        return out;
      }, { fn: String(mock), answers: ANSWERS });
      for (const [withClass, today] of pairs) expect(withClass).toBe(today);
    });
  }

  test('D10 · the read-aloud path never calls the classifier (zero AI requests)', async ({ isolatedPage: page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    let calls = 0;
    await page.route('**/generateContent*', r => { calls++; return r.abort(); });
    try {
      await page.evaluate(() => {
        const w = window as any;
        w.vcSpeakContent('הוצא את החזה מהמעשנה ועטוף אותו.');   // steps
        w.vcSpeak('הטיימר של החזה הסתיים.', 'he', 'timer');      // timers
      });
      await page.waitForFunction(() => true);
      expect(calls).toBe(0);      // no TTS key seeded → no request at all; the point is the CLASSIFIER
      const seen = await page.evaluate(() => (window as any).__vcClassCalls || 0);
      expect(seen).toBe(0);
    } finally { await page.unroute('**/generateContent*'); }
  });

  test('D9 · ask and vcAsk stay low; safetyClass is a NEW row', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const t = await page.evaluate(() => {
      const w = window as any;
      return { ask: w.thinkFor('ask'), vcAsk: w.thinkFor('vcAsk'), cls: w.thinkFor('safetyClass'),
               search: w.searchFor('safetyClass', false) };
    });
    expect(t).toEqual({ ask: 'low', vcAsk: 'low', cls: 'high', search: false });
  });

  // The tests above exercise vcClassifySafetyClaims/vcGuardSpoken standalone — real, but they never prove
  // vcAskFlow ITSELF calls the classifier and threads its result into the guard as the 4th argument (the
  // actual spec §5.2 wiring this task adds). This test drives the real entry point (vcAskFlow, the same
  // seam p0-spoken-safety.spec.ts uses via __vcAskMock) with a mocked classifier response, and proves the
  // wiring by its OBSERVABLE effect: the exact D3 answer/claims pair (vg-classifier-verdicts.spec.ts) that
  // releases chamber_temp/duration only when claims reach the guard. Before the wiring lands, vcAskFlow
  // still calls vcGuardSpoken with 3 args → claims is always undefined → everything is redacted and this
  // is RED for the right reason. It also counts the classifier calls per answer — the request-budget proof
  // DoD-3 requires ("count the calls in a test", not a comment).
  test('D-wire · vcAskFlow threads the classifier result into the guard, exactly once per answer', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-lang': JSON.stringify('he'),
      'mk-gemkey': JSON.stringify('test-key'),
    });
    await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
    // capture what actually reaches speech, without a real TTS call (p0-spoken-safety.spec.ts precedent)
    await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
    // Two chamber_temp tokens ONLY (both matched by the shared narrow safetyTokenRe). This test predates
    // Task 2b: at the time it was written, a duration/weight/spacing claim's `text` (e.g. "6 שעות") was
    // never a member of vcBuildClaimMap's `seen` set (app.js:7856 then only matched safetyTokenRe) and was
    // silently dropped before the guard ever saw it — a gap this test deliberately did NOT exercise (it
    // used two chamber_temp tokens to stay green while the gap was reported separately). Task 2b fixed
    // vcBuildClaimMap's `seen` set to also match claimOnlyTokenRe (CLAIM_ONLY_UNIT), closing that gap; the
    // duration case is now proven end-to-end through this exact vcAskFlow pipeline in
    // tests/vg-claim-map-wide-vocab.spec.ts ("HEADLINE" test). This test is kept as-is (chamber_temp only)
    // since it still validates the wiring/budget claims below.
    const answer = 'עשן ב-110°C ואז הורד ל-95°C.';
    const claims = [
      { text:'110°C', kind:'chamber_temp', value:110, unit:'C', subject:{item:null,category:null,form:'unknown'}, confidence:0.96 },
      { text:'95°C',  kind:'chamber_temp', value:95,  unit:'C', subject:{item:null,category:null,form:'unknown'}, confidence:0.95 },
    ];
    await page.evaluate(({ answer, claims }) => {
      const w = window as any;
      w.vcTasks = []; w.vcIdx = 0;
      w.__vcAskMock = answer;
      w.__vcClassCalls = 0;
      w.__vcClassMock = () => ({ claims });
    }, { answer, claims });
    await page.evaluate(`vcAskFlow('שאלה: מה התהליך')`);
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    const classCalls = await page.evaluate(() => (window as any).__vcClassCalls);
    expect(classCalls).toBe(1);         // exactly one classifier call for this one answer — the budget
    expect(spoken).toContain('110°C');  // chamber_temp released verbatim — proves claims reached the guard
    expect(spoken).toContain('95°C');   // second chamber_temp released verbatim too
    expect(spoken).not.toContain('…');  // neither number was redacted
  });
});
