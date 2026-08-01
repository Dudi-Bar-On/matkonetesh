import { test, expect, seedApp } from './_fixtures';

// R-62 Task 2b — vcBuildClaimMap's `seen` set (app.js:7856) must recognise BOTH vocabularies: the narrow
// safety one (safetyTokenRe) AND the wide claim-only one (claimOnlyTokenRe, Task 2a's time/mass/length
// tokens). Task 2a built CLAIM_ONLY_UNIT so vcClaimVerdict could release a duration/weight/spacing claim,
// but vcBuildClaimMap — the function that turns the classifier's raw JSON into the map vcClaimVerdict
// reads — filtered every claim through the NARROW vocabulary only, so a `duration` claim's text (e.g.
// "6 שעות") was never a member of `seen` and was silently discarded before vcGuardSpoken's wide pass ever
// ran. This is exactly the gap vg-classifier-wiring.spec.ts's D-wire test named and deliberately did NOT
// exercise (see its own comment, app.js:7856 reference) because building the claims Map BY HAND — the
// pattern every prior test in this arc used — bypasses vcBuildClaimMap entirely and therefore can never
// reproduce this defect. Every test below drives the REAL vcBuildClaimMap (or the full
// classifier→vcBuildClaimMap→vcGuardSpoken pipeline via vcAskFlow), never a hand-built Map.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof vcBuildClaimMap==='function' && typeof vcGuardSpoken==='function'`);
};

test.describe('R-62 Task 2b · vcBuildClaimMap recognises the wide (claim-only) vocabulary', () => {

  test('the claim map itself now contains a duration claim reached via the wide vocabulary', async ({ page }) => {
    await boot(page);
    const out = await page.evaluate(() => {
      const w = window as any;
      const src = 'עשן ב-110°C במשך 6 שעות.';
      const map = w.vcBuildClaimMap(src, { claims: [
        { text: '110°C',  kind: 'chamber_temp', value: 110, unit: 'C',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.95 },
        { text: '6 שעות', kind: 'duration',     value: 6,   unit: 'h',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.9 },
      ]});
      return {
        size: map ? map.size : 0,
        hasTemp: !!(map && map.get('110°C')),
        hasDuration: !!(map && map.get('6 שעות')),
      };
    });
    // Before the Task 2b fix: size===1, hasDuration===false — the duration claim was discarded by the
    // narrow `seen` set before vcClaimVerdict ever saw it. This is the map-contents assertion (DoD-4:
    // observable state), not an internal flag.
    expect(out.size).toBe(2);
    expect(out.hasTemp).toBe(true);
    expect(out.hasDuration).toBe(true);
  });

  test('HEADLINE — a real answer with a temperature and a duration goes through vcAskFlow end to end: the temperature is ruled on, the duration is released', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-lang': JSON.stringify('he'),
      'mk-gemkey': JSON.stringify('test-key'),
    });
    await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
    // Capture what actually reaches speech, without a real TTS call (p0-spoken-safety.spec.ts /
    // vg-classifier-wiring.spec.ts D-wire precedent).
    await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
    const answer = 'עשן ב-110°C במשך 6 שעות.';
    const claims = [
      { text: '110°C',  kind: 'chamber_temp', value: 110, unit: 'C',
        subject: { item: null, category: null, form: 'unknown' }, confidence: 0.96 },
      { text: '6 שעות', kind: 'duration',     value: 6,   unit: 'h',
        subject: { item: null, category: null, form: 'unknown' }, confidence: 0.9 },
    ];
    await page.evaluate(({ answer, claims }) => {
      const w = window as any;
      w.vcTasks = []; w.vcIdx = 0;
      w.__vcAskMock = answer;
      w.__vcClassCalls = 0;
      w.__vcClassMock = () => ({ claims });   // the CLASSIFIER'S raw JSON — vcBuildClaimMap runs for real
    }, { answer, claims });
    await page.evaluate(`vcAskFlow('שאלה: מה התהליך')`);
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    const classCalls = await page.evaluate(() => (window as any).__vcClassCalls);
    expect(classCalls).toBe(1);          // exactly one classifier call for this one answer
    expect(spoken).toContain('110°C');   // chamber_temp released verbatim (free kind, real narrow token)
    expect(spoken).toContain('6 שעות');  // duration RELEASED — the Task 2b fix, proven end to end from the
                                          // classifier's raw JSON all the way to the spoken string, through
                                          // the real vcBuildClaimMap — not a hand-built claims Map
    expect(spoken).not.toContain('[…]'); // neither number was redacted
  });

  // ── Negative cases (mandatory per DoD §3) — all driven through the REAL vcBuildClaimMap ──────────

  test('NEGATIVE — a wide-vocabulary token misclassified as a SAFETY kind with no identifiable subject is still redacted', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const src = 'עשן ב-110°C במשך 6 שעות.';
      // The classifier's raw JSON, NOT a hand-built claims Map — proves the wide vocabulary reaching the
      // map does not bypass the SAFETY-kind subject gate (D1/D2) that already governs the narrow path.
      const claims = w.vcBuildClaimMap(src, { claims: [
        { text: '110°C',  kind: 'chamber_temp',      value: 110, unit: 'C',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.95 },
        { text: '6 שעות', kind: 'internal_safe_temp', value: 6,  unit: 'h',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.99 },
      ]});
      return w.vcGuardSpoken(src, { t1: null, t2: null, cat: null }, 'he', claims);
    });
    expect(said).not.toContain('6 שעות');
    expect(said).toContain('[…] שעות');
  });

  test('NEGATIVE — a duration claim below the confidence floor, reached through the real claim map, is not released', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const src = 'עשן ב-110°C במשך 6 שעות.';
      const claims = w.vcBuildClaimMap(src, { claims: [
        { text: '110°C',  kind: 'chamber_temp', value: 110, unit: 'C',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.95 },
        { text: '6 שעות', kind: 'duration',     value: 6,   unit: 'h',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.5 },
      ]});
      return w.vcGuardSpoken(src, { t1: null, t2: null, cat: null }, 'he', claims);
    });
    expect(said).not.toContain('6 שעות');
    expect(said).toContain('[…] שעות');
  });

  test('NEGATIVE — with claims===null the output is byte-identical to today (structural invariant, unaffected by this fix)', async ({ page }) => {
    await boot(page);
    const q = 'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.';
    const [withNull, without] = await page.evaluate((q) => {
      const w = window as any;
      return [
        w.vcGuardSpoken(q, { t1: null, t2: null, cat: null }, 'he', null),
        w.vcGuardSpoken(q, { t1: null, t2: null, cat: null }, 'he'),
      ];
    }, q);
    expect(withNull).toBe(without);
    expect(withNull).toBe('עשן ב-[…] במשך […] שעות עד […] פנימי. המספרים האלה אינם מאומתים — בדוק בכרטיס הפריט.');
  });

  test('NEGATIVE — the narrow vocabulary itself is unchanged: a claim on a token safetyTokenRe never sees, and CLAIM_ONLY_UNIT never sees either, is still discarded', async ({ page }) => {
    await boot(page);
    const out = await page.evaluate(() => {
      const w = window as any;
      const src = 'הגש ב-71°C.';
      const map = w.vcBuildClaimMap(src, { claims: [
        { text: '999xyz', kind: 'chamber_temp', value: 999, unit: 'xyz',
          subject: { item: null, category: null, form: 'unknown' }, confidence: 0.99 },  // never appeared
      ]});
      return map === null;
    });
    expect(out).toBe(true);
  });
});
