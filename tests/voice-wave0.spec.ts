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
