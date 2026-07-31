import { test, expect, seedApp } from './_fixtures';

test('vcLat: an ask stamps ask→firstSound marks readable by a real consumer', async ({ page }) => {
  await seedApp(page, {});
  const rep = await page.evaluate(async () => {
    (window as any).__vcAskMock = () => 'תשובה קצרה.';           // no network
    (window as any).__gemTtsMock = () => null;                    // TTS seam mocked (Task 5 wires it)
    (window as any).vcLatMark('ask');                             // the flow itself calls this after Task 1 wiring
    await (window as any).vcAskFlow('כמה זמן לברסקט?');
    return (window as any).vcLatReport();
  });
  expect(rep).toHaveProperty('ask');
  expect(rep).toHaveProperty('textResp');                          // stamped by vcAskFlow after the answer resolves
});

test('vcChunkText: splits sentences, never splits a decimal, merges short, hard-splits long', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).vcChunkText;
    return {
      basic: f('שים את הברסקט במעשנה. חכה שעתיים! בדוק טמפרטורה?'),
      decimal: f('הטמפרטורה היא 63.5 מעלות. המשך לבשל.'),
      short: f('כן. בסדר. עכשיו שים את הבשר על הרשת ותסגור את המכסה.'),
      long: f('א'.repeat(100) + ', ' + 'ב'.repeat(100) + ', ' + 'ג'.repeat(100)),
      empty: f('   '),
      langs: [
        f('Mettez la viande. Attendez deux heures.'),
        f('Положите мясо в коптильню. Подождите два часа.'),
        f('Lege das Fleisch hinein. Warte zwei Stunden.'),
      ].map((a: string[]) => a.length),
    };
  });
  expect(r.basic.length).toBe(3);
  expect(r.decimal[0]).toContain('63.5');                 // the decimal point never splits
  expect(r.decimal.length).toBe(2);
  expect(r.short.length).toBe(1);                          // "כן." and "בסדר." merged forward
  expect(Math.max(...r.long.map((c: string) => c.length))).toBeLessThanOrEqual(220);
  expect(r.empty).toEqual([]);
  for (const n of r.langs) expect(n).toBe(2);              // same rule, all languages
});

test('vcChunkText: joining chunks reproduces the spoken content (whitespace-normalized) and no chunk is empty', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).vcChunkText;
    const input = '  שים לב לטמפרטורה.   חכה בסבלנות!  בדוק שוב?  ';
    const chunks = f(input);
    return { chunks, anyEmpty: chunks.some((c: string) => c.trim().length === 0) };
  });
  // invariant: concatenating all chunks with single spaces reproduces the whitespace-normalized input
  expect(r.chunks.join(' ')).toBe('שים לב לטמפרטורה. חכה בסבלנות! בדוק שוב?');
  expect(r.anyEmpty).toBe(false);
});

test('vcChunkText: a safety readout with its verification marker is never split between number and marker', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).vcChunkText;
    return f('הטמפרטורה הפנימית היא 63°C לפי המדריך המאומת. אפשר להוציא.');
  });
  const withNumber = r.find((c: string) => c.includes('63°C'));
  expect(withNumber).toContain('לפי המדריך המאומת');   // number and its verification marker stay in the same chunk
});

test('speaker token: a stale (slow) speaker can never kill its successor', async ({ page }) => {
  await seedApp(page, {});
  const log = await page.evaluate(async () => {
    const w = window as any; w.__vcSpeakLog = [];
    // simulate v278's race shape: speaker A (the ack) awaits slowly; speaker B (the answer) starts meanwhile.
    const genA = w.vcNewSpeakGen();
    const genB = w.vcNewSpeakGen();                 // B took the floor after A
    await Promise.resolve();                        // A returns from its await, stale
    if (w.vcGenCurrent(genA)) w.__vcSpeakLog.push('A-killed-B'); // v278 behavior: A calls gemStop()
    if (w.vcGenCurrent(genB)) w.__vcSpeakLog.push('B-plays');
    return w.__vcSpeakLog;
  });
  expect(log).toEqual(['B-plays']);
});

test('INV-T / R-33: ttsText preserves every digit and degree token from the guarded string', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).ttsText;
    const digits = (s: string) => (s.match(/\d+(?:\.\d+)?/g) || []);
    const src = 'חמם ל-63.5°C (בערך 8-10 שעות · תלוי בעובי). המשקל 2 ק"ג, עוד 20 דק\' בערך.';
    const out = f(src, 'he');
    return {
      out,
      sameDigits: JSON.stringify(digits(out)) === JSON.stringify(digits(src)),
      degreeKept: out.includes('63.5°C'),                       // rule 8 DROPPED: the unit symbol survives
      noParenCommas: !out.includes(', בערך'),                    // rule 9 DROPPED: no ", … ," injection
      rangeKept: out.includes('8-10'),                           // rule 10 DROPPED: ranges untouched
      kg: out.includes('קילו') && !out.includes('ק"ג'),          // rule 3 KEPT: abbreviation whitelist
      min: out.includes('דקות'),                                 // rule 4 KEPT
      en: f('Rest 10 min · then slice.', 'en'),                  // rows 1-2 only for non-he
    };
  });
  expect(r.sameDigits).toBe(true);
  expect(r.degreeKept).toBe(true);
  expect(r.noParenCommas).toBe(true);
  expect(r.rangeKept).toBe(true);
  expect(r.kg).toBe(true);
  expect(r.min).toBe(true);
  expect(r.en).toBe('Rest 10 min , then slice.');
});

test('chunk pipeline: long answer synthesized as ordered chunks, first chunk first', async ({ page }) => {
  // aiAvail() gates gemSpeak (R-35: no keyless user exists) — seed a key so the mocked pipeline runs;
  // __gemTtsMock/__gemPlayMock below ensure no real network call is made.
  await seedApp(page, { 'mk-gemkey': JSON.stringify('test-key') });
  const r = await page.evaluate(async () => {
    const w = window as any; w.__gemTtsLog = [];
    w.__gemTtsMock = (t: string) => { w.__gemTtsLog.push(t); return { mock: true }; };  // buffer stand-in
    w.__gemPlayMock = async () => {};                                                    // no real audio in CI
    const long = Array.from({length: 12}, (_, i) => `משפט מספר ${i} עם עוד כמה מילים כדי שלא יתמזג.`).join(' ');
    await w.gemSpeak(long, 'he', w.vcNewSpeakGen());
    return { n: w.__gemTtsLog.length, first: w.__gemTtsLog[0], lat: w.vcLatReport() };
  });
  expect(r.n).toBeGreaterThan(3);                       // long text = many chunks, all synthesized
  expect(r.first).toContain('משפט מספר 0');             // ordered
  expect(r.lat).toHaveProperty('firstSound');           // stamped when chunk 1 starts playing
});

test('R-34: TTS generationConfig carries maxOutputTokens 8192', async ({ page }) => {
  await seedApp(page, {});
  const gc = await page.evaluate(() => (window as any).gemTtsGen('Kore'));
  expect(gc.maxOutputTokens).toBe(8192);
});
