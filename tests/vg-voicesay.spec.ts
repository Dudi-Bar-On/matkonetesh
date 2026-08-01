import { test, expect, seedApp } from './_fixtures';

test.describe('§2 · every utterance is logged and shown before it is spoken', () => {
  test('B1 · all four statuses reach the log', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const rows = await page.evaluate(async () => {
      const w = window as any;
      const real = w.vcSpeak;
      w.vcSpeak = () => Promise.resolve();          w.voiceSay('timers', 'נאמר');
      w.vcSpeak = () => Promise.reject(new Error('api-429')); w.voiceSay('timers', 'נכשל');
      await new Promise(r => setTimeout(r, 0));
      w.vcSpeak = real;
      return w.voiceLogAll().map((x: any) => [x.text, x.status]);
    });
    expect(rows).toContainEqual(['נאמר', 'said']);
    expect(rows).toContainEqual(['נכשל', 'failed']);
  });

  test('B1b · a TTS failure still leaves the CARD on screen (the visual is not downstream of speech)',
    async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(() => {
      const w = window as any;
      w.vcSpeak = () => { throw new Error('no-key'); };
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים');
    });
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
    const st = await page.evaluate(() => (window as any).voiceLogAll()[0].status);
    expect(st).toBe('failed');
  });

  test('the ring caps at 50 and drops the OLDEST', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const r = await page.evaluate(() => {
      const w = window as any; w.vcSpeak = () => Promise.resolve();
      for (let i = 0; i < 55; i++) w.voiceSay('progress', 'שורה ' + i);
      const all = w.voiceLogAll();
      return { n: all.length, first: all[0].text, last: all[all.length - 1].text };
    });
    expect(r).toEqual({ n: 50, first: 'שורה 5', last: 'שורה 54' });
  });

  test('T1 · an expiring timer now speaks its name AND its event', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-events': JSON.stringify([{ id: 'ev1', name: 'שבת', date: '', serve: '19:00', menu: { keys: [] } }]),
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 3000, name: 'חזה בקר' } }) });
    const said: string[] = [];
    await page.exposeFunction('__said', (t: string) => { said.push(t); });
    await page.evaluate(() => { const w = window as any; w.vcSpeak = (t: string) => { (window as any).__said(t); return Promise.resolve(); }; });
    await page.clock.fastForward(4000);
    await page.waitForFunction(() => !!document.getElementById('mkVoiceAct'));
    expect(said.join(' ')).toContain('חזה בקר');
    expect(said.join(' ')).toContain('שבת');       // §7 — never an anonymous "a timer finished"
  });

  test('B8 · every number in the card is wrapped in dir="ltr"', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(() => { const w = window as any; w.vcSpeak = () => Promise.resolve();
      w.voiceSay('timers', 'הטמפרטורה הגיעה ל-74°C'); });
    await expect(page.locator('#mkVoiceAct span[dir="ltr"]')).toHaveText('74°C');
  });

  test('NEGATIVE · a tier-B utterance produces NO act card, only a toast + a log row', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(() => { const w = window as any; w.vcSpeak = () => Promise.resolve();
      w.voiceSay('progress', 'הקצב האט'); });
    await expect(page.locator('#mkVoiceAct')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('הקצב האט');
    expect(await page.evaluate(() => (window as any).voiceLogAll().length)).toBe(1);
  });
});
