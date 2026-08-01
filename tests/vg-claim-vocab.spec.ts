import { test, expect, seedApp } from './_fixtures';

// R-62 Task 2a — CLAIM_ONLY_UNIT (time/mass/length claim-only vocabulary; see app.js comment above
// vcGuardSpoken). This spec proves the trap named in the task brief does NOT hold for the shipped code:
//   1. eligibility (aiSafetyNums / safetyNumRe — the SHARED SAFETY_UNIT tokenizer) is UNCHANGED — a
//      time/mass/length unit still does not make aiSafetyNums see a number.
//   2. with claims===null/undefined, vcGuardSpoken's output is BYTE-IDENTICAL to the pre-Task-2a shape,
//      for both an answer that passes through completely untouched today AND a mixed temp+duration
//      answer that enters the guard.
//   3. widening can only ever RELEASE a number the guard was already going to redact — it can release a
//      genuine duration/weight/length claim, but a claim whose kind/confidence/subject fails the SAME
//      decision table used for temperature (D1/D2 in vg-classifier-verdicts.spec.ts) is still redacted
//      even when reached through the wider vocabulary.
//
// NOTE: every test below that exercises the release/redaction machinery pairs its time/mass/length
// number with a REAL recognised temp token (e.g. "110°C"). A time-only answer with no SAFETY_UNIT token
// anywhere never enters the guard at all (nAiNums===0 && digitRuns!==1 → early "return src", the guard's
// own named example — "wait 20 minutes then 10 more") — that shape is covered by its own dedicated test
// below and must stay untouched by construction, not exercised as if it were a redaction case.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof aiSafetyNums==='function' && typeof vcGuardSpoken==='function'`);
};

test.describe('R-62 Task 2a · CLAIM_ONLY_UNIT (time/mass/length) release path', () => {

  test('eligibility unchanged — aiSafetyNums still does not see a time/mass/length unit', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(`aiSafetyNums('החזק 6 שעות')`)).toEqual([]);
    expect(await page.evaluate(`aiSafetyNums('שקלו 500 גרם')`)).toEqual([]);
    expect(await page.evaluate(`aiSafetyNums('אורך 10 ס"מ')`)).toEqual([]);
    // The SAME inputs alongside a real temp token still see ONLY the temp number — proving CLAIM_ONLY_UNIT
    // was never merged into SAFETY_UNIT (a merge would make aiSafetyNums see the "6" too).
    expect(await page.evaluate(`aiSafetyNums('עשן ב-110°C במשך 6 שעות')`)).toEqual([110]);
  });

  test('digitRuns (safetyNumRe match count) unchanged for a time-bearing answer', async ({ page }) => {
    await boot(page);
    const n = await page.evaluate(`('החזק 6 שעות ואז 2 נוספות'.match(safetyNumRe())||[]).length`);
    expect(n).toBe(2);   // "6" and "2" — the bare-digit definition itself is untouched
  });

  test('claims===null: a pure duration answer (no temp) passes through UNTOUCHED, exactly as today', async ({ page }) => {
    await boot(page);
    const q = 'המתן 20 דקות ואז עוד 10.';
    const said = await page.evaluate((q) => (window as any).vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', null), q);
    expect(said).toBe(q);   // digitRuns===2, nAiNums===0 → early return `src` — the guard's own named example
  });

  test('claims===null: the mixed temp+duration answer is BYTE-IDENTICAL to the pre-Task-2a redaction shape', async ({ page }) => {
    await boot(page);
    const q = 'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.';
    const said = await page.evaluate((q) => (window as any).vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', null), q);
    // Both temp tokens redacted whole (narrow pass, unchanged); the duration digit redacted alone with
    // "שעות" surviving as untouched literal text (wide-pass default path, byte-for-byte the old
    // bare-digit-sweep shape) — this is the EXACT string the task's own RED evidence captured.
    expect(said).toBe('עשן ב-[…] במשך […] שעות עד […] פנימי. המספרים האלה אינם מאומתים — בדוק בכרטיס הפריט.');
  });

  test('claims===null: an undefined 4th arg (the one pre-existing call site) is identical to explicit null', async ({ page }) => {
    await boot(page);
    const q = 'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.';
    const [withUndefined, withNull] = await page.evaluate((q) => {
      const w = window as any;
      return [w.vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he'), w.vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', null)];
    }, q);
    expect(withUndefined).toBe(withNull);
  });

  test('a genuine duration claim (time) is released through the wide vocabulary', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['6 שעות', { text:'6 שעות', kind:'duration', value:6, unit:'h',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.9 }]]);
      return w.vcGuardSpoken('עשן ב-110°C במשך 6 שעות.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).toContain('6 שעות');       // released, no marker
    expect(said).not.toContain('[…] שעות'); // NOT the redacted shape
  });

  test('a genuine weight (mass) claim is released through the wide vocabulary', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['500 גרם', { text:'500 גרם', kind:'weight', value:500, unit:'g',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.9 }]]);
      return w.vcGuardSpoken('שקלו 500 גרם והחזיקו ב-110°C.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).toContain('500 גרם');
  });

  // ── Negative cases (mandatory per DoD §3) ─────────────────────────────────────────────────────

  test('NEGATIVE — a time-bearing (mixed) answer with NO claims map stays exactly as today', async ({ page }) => {
    await boot(page);
    const q = 'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.';
    const said = await page.evaluate((q) => (window as any).vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', null), q);
    expect(said).not.toContain('6 שעות');   // NOT released — no claims map at all
    expect(said).toContain('[…] שעות');     // digit redacted, unit word survives — today's exact shape
  });

  test('NEGATIVE — a duration claim below the confidence floor is NOT released', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['6 שעות', { text:'6 שעות', kind:'duration', value:6, unit:'h',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.5 }]]);
      return w.vcGuardSpoken('עשן ב-110°C במשך 6 שעות.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('6 שעות');
    expect(said).toContain('[…] שעות');
  });

  test('NEGATIVE — a claim reached via the wide vocabulary but classified as a SAFETY kind with an unidentified subject is NOT released', async ({ page }) => {
    await boot(page);
    // A misclassification scenario: the classifier tags a time-shaped token as internal_safe_temp (a
    // SAFETY kind, not a FREE kind) with no subject at all. Even reached through CLAIM_ONLY_UNIT, this
    // MUST fall through the same subject-identification gate D1/D2 already prove for the narrow path —
    // proving the wide vocabulary does not bypass the decision table, only widens which tokens can reach it.
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['6 שעות', { text:'6 שעות', kind:'internal_safe_temp', value:6, unit:'h',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.99 }]]);
      return w.vcGuardSpoken('עשן ב-110°C במשך 6 שעות.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('6 שעות');
    expect(said).toContain('[…] שעות');
  });
});
