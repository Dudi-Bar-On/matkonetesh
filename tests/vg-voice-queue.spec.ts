import { test, expect, seedApp } from './_fixtures';

// A deterministic fake speaker: resolves only when the test releases it, and records call order.
const FAKE = `(() => { const w = window;
  w.__spoken = []; w.__release = null;
  w.vcSpeak = (t, l, uc) => { w.__spoken.push([uc, t]);
    return new Promise(res => { w.__release = res; }); }; })()`;

test.describe('§3 · the collision law', () => {
  test('B3 · timers does NOT cut — it enters after the current segment', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      w.voiceSay('steps', 'משפט ארוך של הקראת שלב');
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים'); });
    // the step is still the only thing that has reached the speaker
    expect(await page.evaluate(() => (window as any).__spoken.length)).toBe(1);
    await page.evaluate(() => (window as any).__release());          // the segment ends
    await page.waitForFunction(() => (window as any).__spoken.length === 2);
    const order = await page.evaluate(() => (window as any).__spoken.map((s: any) => s[0]));
    expect(order).toEqual(['steps', 'timers']);
  });

  test('B2 · safety CUTS, the cut row is logged, and F-5 resumes from the sentence START',
    async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      // pretend the step utterance is mid-way through its second chunk
      w.voiceSay('steps', 'משפט ראשון. משפט שני. משפט שלישי.');
      w.vcSpeakProgress = { gen: 1, chunks: ['משפט ראשון.', 'משפט שני.', 'משפט שלישי.'], idx: 1, lang: 'he', useCase: 'steps' };
      w.voiceSay('safety', 'עצור — החזה בטמפרטורת סכנה.'); });
    const spoken = await page.evaluate(() => (window as any).__spoken.map((s: any) => s[1]));
    expect(spoken[1]).toContain('עצור');                              // cut in, immediately
    const log = await page.evaluate(() => (window as any).voiceLogAll().map((r: any) => r.status));
    expect(log).toContain('cut');
    await page.evaluate(() => (window as any).__release());
    await page.waitForFunction(() => (window as any).__spoken.length === 3);
    const resumed = await page.evaluate(() => (window as any).__spoken[2][1]);
    expect(resumed.startsWith('ממשיך: ')).toBe(true);
    expect(resumed).toContain('משפט שני.');                           // the WHOLE interrupted sentence
    expect(resumed).not.toContain('משפט ראשון');                      // not from the top either
  });

  test('B4 · two timers in the same second → ONE merged utterance naming both', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-timers': JSON.stringify({ 'st-ev1-a-x': { end: 1000, name: 'חזה' }, 'st-ev1-b-x': { end: 1000, name: 'שוק' } }) });
    await page.evaluate(FAKE);
    await page.clock.fastForward(2000);
    await page.waitForFunction(() => (window as any).__spoken.length > 0);
    const all = await page.evaluate(() => (window as any).__spoken);
    expect(all.length).toBe(1);
    expect(all[0][1]).toContain('חזה');
    expect(all[0][1]).toContain('שוק');
    expect(all[0][1]).not.toMatch(/\d/);          // constraint: names only, ZERO temperature numbers
  });

  test('B5 · NEGATIVE · a dropped progress item is marked "not played", never vanished', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      w.voiceSay('steps', 'הקראה');
      w.voiceSay('progress', 'הקצב האט');            // priority 5, behind…
      w.voiceSay('timers', 'הטיימר הסתיים'); });     // …a priority-1 item → it falls
    const rows = await page.evaluate(() => (window as any).voiceLogAll().map((r: any) => [r.text, r.status]));
    expect(rows).toContainEqual(['הקצב האט', 'skipped']);
    const q = await page.evaluate(() => (window as any).voiceQueueState().q.map((x: any) => x.cat));
    expect(q).not.toContain('progress');
  });

  test('B6 · while the mic is listening only safety speaks; the rest waits', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      w.vcRec = { stop() {}, _stop: false };            // pretend recognition is live
      w.voiceSay('progress', 'הקצב האט');
      w.voiceSay('timers', 'הטיימר הסתיים'); });
    expect(await page.evaluate(() => (window as any).__spoken.length)).toBe(0);
    await page.evaluate(() => { const w = window as any; w.voiceSay('safety', 'עצור — טמפרטורת סכנה.'); });
    const spoken = await page.evaluate(() => (window as any).__spoken.map((s: any) => s[1]));
    expect(spoken).toEqual(['עצור — טמפרטורת סכנה.']);
    const q = await page.evaluate(() => (window as any).voiceQueueState().q.length);
    expect(q).toBeGreaterThan(0);                        // still queued, not dropped
  });

  test('D11 · request count per single utterance is unchanged (one generateContent call)',
    async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const calls = await page.evaluate(async () => {
      const w = window as any;
      let n = 0;
      w.vcSpeak = (t: string, l: string, uc: string) => { n++; return Promise.resolve(); };
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים');
      await new Promise(r => setTimeout(r, 0));
      return n;
    });
    expect(calls).toBe(1);                                // ONE vcSpeak call = ONE utterance, queue or not
  });
});
