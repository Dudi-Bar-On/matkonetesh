// Task 13 (§2.4) — the schedule cards (S1/S2/S3) are armed OUTSIDE the notification-permission gate.
// Read tests/TEST-AUTHORING-CONTRACT.md before touching this file.
import { test, expect, seedApp } from './_fixtures';

test.describe('§2.4 · stage-start alerts appear INSIDE the app', () => {
  test('S1/S2 · a card fires with NO notification permission and mk-tlalerts OFF',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    // mk-tlalerts deliberately NOT seeded; Notification.permission left at 'default'
    await page.evaluate(() => {
      const w = window as any; w.vcSpeak = () => Promise.resolve();
      w.__armScheduleCard(new Date(Date.now() + 5000), 'sched:test', 'הזמן להתחיל: חזה בקר');
    });
    await expect(page.locator('#mkVoiceAct')).toHaveCount(0);
    await page.clock.fastForward(6000);
    await page.waitForFunction(() => !!document.getElementById('mkVoiceAct'));
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
  });

  test('NEGATIVE · a stale event arms NO schedule card (§4.5 site 1)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-events': JSON.stringify([{ id: 'ev1', name: 'שעברה', date: '2026-07-25', serve: '19:00', menu: { keys: [] } }]),
      'mk-active': 'ev1', 'mk-timers': JSON.stringify({}) });
    await page.evaluate(() => (window as any).openTimeline());
    await page.clock.fastForward(24 * 3600e3);
    await expect(page.locator('#mkVoiceAct')).toHaveCount(0);
  });

  test('NEGATIVE · with the schedule category OFF the CARD still appears, only the voice is silent',
    async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-schedule': JSON.stringify('off') });
    let spoke = 0;
    await page.exposeFunction('__spoke', () => { spoke++; });
    await page.evaluate(() => {
      const w = window as any; w.vcSpeak = () => { (window as any).__spoke(); return Promise.resolve(); };
      w.voiceSay('schedule', 'הזמן להתחיל: חזה בקר', { tier: 'act', key: 'k' }); });
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
    expect(spoke).toBe(0);
    expect(await page.evaluate(() => (window as any).voiceLogAll()[0].status)).toBe('skipped');
  });
});
