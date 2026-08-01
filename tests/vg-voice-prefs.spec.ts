// Task 10 (R-52 §1.3/§1.4/§1.5, owner ruling F-1) — the five voice-category PREFS keys, the
// ttsCategoryEnabled/voiceMode gate with the safety short-circuit, and the TTS_ROUTE rows.
// Test-authoring contract: tests/TEST-AUTHORING-CONTRACT.md — test/seedApp from ./_fixtures only.
import { test, expect, seedApp } from './_fixtures';

test.describe('§1 · category gating', () => {
  test('A1 · safety is true with every key off AND with a throwing store', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-pref-voice-timers': JSON.stringify('off'), 'mk-pref-voice-schedule': JSON.stringify('off'),
      'mk-pref-voice-steps': JSON.stringify('off'), 'mk-pref-voice-answers': JSON.stringify('off'),
      'mk-pref-voice-progress': JSON.stringify('off') });
    const r = await page.evaluate(() => {
      const w = window as any;
      const before = w.ttsCategoryEnabled('safety');
      const realGet = w.store.get;
      w.store.get = () => { throw new Error('storage exploded'); };
      const during = w.ttsCategoryEnabled('safety');
      const others = ['timers', 'schedule', 'steps', 'answers', 'progress'].map(c => w.ttsCategoryEnabled(c));
      w.store.get = realGet;
      return { before, during, others };
    });
    expect(r.before).toBe(true);
    expect(r.during).toBe(true);       // the short-circuit returns before `store` is reached
    expect(r.others).toEqual([false, false, false, false, false]);
  });

  test('A2 · safety is NOT a PREFS key and renders no clickable control', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const keys = await page.evaluate(() => Object.keys((window as any).PREFS));
    expect(keys.some(k => /voice/i.test(k) && /safety/i.test(k))).toBe(false);
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules [data-cat="safety"] button')).toHaveCount(0);
  });

  test('A3 · timers and schedule are independent, both directions', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const r = await page.evaluate(() => {
      const w = window as any;
      w.setVoiceMode('timers', 'off'); w.setVoiceMode('schedule', 'always');
      const a = [w.ttsCategoryEnabled('timers'), w.ttsCategoryEnabled('schedule')];
      w.setVoiceMode('timers', 'always'); w.setVoiceMode('schedule', 'off');
      return [a, [w.ttsCategoryEnabled('timers'), w.ttsCategoryEnabled('schedule')]];
    });
    expect(r).toEqual([[false, true], [true, false]]);
  });

  test('A4 · every category OFF still produces the visual counterpart (P1)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-timers': JSON.stringify('off'), 'mk-pref-voice-progress': JSON.stringify('off') });
    const spoke = await page.evaluate(() => {
      const w = window as any; let n = 0; w.vcSpeak = () => { n++; return Promise.resolve(); };
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים');
      w.voiceSay('progress', 'הקצב האט');
      return { n, log: w.voiceLogAll().map((r: any) => r.status) };
    });
    expect(spoke.n).toBe(0);                                  // vcSpeak never called
    expect(spoke.log).toEqual(['skipped', 'skipped']);        // never a SILENT drop
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
    await expect(page.locator('.toast')).toContainText('הקצב האט');
  });

  test('A5 · NEGATIVE · a garbage stored value falls back to def via prefOk', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-pref-voice-timers': JSON.stringify('maybe') });
    const m = await page.evaluate(() => (window as any).voiceMode('timers'));
    expect(m).toBe('always');
  });

  test('A8 · an unknown/unlisted category resolves to speaking, never silence', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const r = await page.evaluate(() => {
      const w = window as any;
      return { mode: w.voiceMode('nope-not-a-real-category'), enabled: w.ttsCategoryEnabled('nope-not-a-real-category') };
    });
    expect(r.mode).toBe('always');
    expect(r.enabled).toBe(true);
  });

  test('A9 · TTS_ROUTE carries the four new rows, safety routed to gemini (the PRIMARY)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const route = await page.evaluate(() => (window as any).TTS_ROUTE);
    expect(route.timer).toBe('cloud');
    expect(route.schedule).toBe('cloud');
    expect(route.progress).toBe('gemini');
    expect(route.safety).toBe('gemini');
  });
});
