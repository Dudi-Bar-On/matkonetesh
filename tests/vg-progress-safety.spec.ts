// Task 14 (§2.4) — the `progress` category (C1-C5, deduplicated on verdict change) + the remaining
// safety triggers (S4, V3). Read tests/TEST-AUTHORING-CONTRACT.md before touching this file.
import { test, expect, seedApp } from './_fixtures';

test.describe('§2.4 · pace and safety triggers', () => {
  // `progress`'s OWN default is 'whenAway' (Task 10 ruling — chatter is quiet unless the user stepped
  // away), and a Playwright page is 'visible' by default, so it is gated OFF here unless forced 'always'.
  // That gate is Task 10's concern, already covered there; this test isolates the dedup mechanism itself.
  test('C1-C5 · the verdict speaks on a CHANGE and is silent on a repeat', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-progress': JSON.stringify('always') });
    // Task 12's queue only drains the SECOND distinct utterance once the first's (mocked) speaker promise
    // resolves — a real microtask boundary, not a Playwright-level wait — so this polls the observable
    // count instead of reading it synchronously (TEST-AUTHORING-CONTRACT §4: condition, never a timeout).
    await page.evaluate(() => {
      const w = window as any; w.__c = 0; w.vcSpeak = () => { w.__c++; return Promise.resolve(); };
      w.copilotAnnouncePace({ state: 'projected', verdict: 'behind' });
      w.copilotAnnouncePace({ state: 'projected', verdict: 'behind' });   // same verdict → silent
      w.copilotAnnouncePace({ state: 'stall' });
    });
    await page.waitForFunction(() => (window as any).__c === 2);
    expect(await page.evaluate(() => (window as any).__c)).toBe(2);
  });

  test('C1 · reaching the internal target is SAFETY — spoken with every category OFF', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-timers': JSON.stringify('off'), 'mk-pref-voice-progress': JSON.stringify('off'),
      'mk-pref-voice-steps': JSON.stringify('off'), 'mk-pref-voice-answers': JSON.stringify('off'),
      'mk-pref-voice-schedule': JSON.stringify('off') });
    const said = await page.evaluate(() => {
      const w = window as any; const out: string[] = [];
      w.vcSpeak = (t: string) => { out.push(t); return Promise.resolve(); };
      w.copilotAnnouncePace({ state: 'done', lastTemp: 96 });
      return out;
    });
    expect(said.join(' ')).toContain('הגיע ליעד');
    await expect(page.locator('#mkVoiceAct')).toBeVisible();
  });

  // L42: enters through the REAL production door — openVoiceCook + vcAction('qtemp') (the "what's the
  // temp?" voice-cook button), not a direct poke at voiceSay — so this fails on the actual seam that was
  // changed (app.js's qtemp handler), not on an injected one. vcTasks/vcIdx are plain top-level `let`
  // (not window properties, per vg-voice-panel.spec.ts A11's comment) — openVoiceCook is the real door.
  test('V3 · vcAction(qtemp) is heard even with steps OFF, and stays visible as a toast', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-steps': JSON.stringify('off') });
    const said = await page.evaluate(() => {
      const w = window as any; const out: string[] = [];
      w.vcSpeak = (t: string) => { out.push(t); return Promise.resolve(); };
      w.openVoiceCook([{ t: new Date(), label: 'בדיקת ליבה', det: '74°C בליבה', kind: 'bcheck' }]);
      out.length = 0;   // discard the panel-open read-aloud — this test is about the qtemp ANSWER
      w.vcAction('qtemp');
      return out;
    });
    expect(said.length).toBe(1);
    expect(said[0]).toContain('74');
    await expect(page.locator('.toast')).toContainText('74');
  });

  test('NEGATIVE · opening the copilot panel repeatedly says nothing new', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-progress': JSON.stringify('always') });
    const n = await page.evaluate(() => {
      const w = window as any; let c = 0; w.vcSpeak = () => { c++; return Promise.resolve(); };
      for (let i = 0; i < 5; i++) w.copilotAnnouncePace({ state: 'projected', verdict: 'on-pace' });
      return c;
    });
    expect(n).toBe(1);
  });
});
