import { test, expect, seedApp } from './_fixtures';

// D3 (docs/analysis/2026-08-01-voice-output-audit.md N1): openReminders() used to build the derived
// cure/dry reminder list ONLY when the panel itself was opened — nothing ever surfaced it otherwise, so a
// 7-day cure relied entirely on the user remembering to look. Fix: allReminders()/remindersDue() are
// pulled out of openReminders so a home banner (syncReminderBanner → #cReminderBanner) shows a due
// reminder on any screen, UNCONDITIONALLY (no notification permission needed — it's in-app DOM, not an
// OS notification). Per the task brief's honesty requirement: this is "fires while the app is open, plus
// a Notification when permitted" — the same limit the existing toast at app.js ~8100 already states for
// stage alerts, not a stronger promise.
function overdueCureProject(id: string) {
  const start = new Date(); start.setDate(start.getDate() - 10);   // started 10 days ago, 7-day cure → 3 days overdue
  return [{ id, name: 'חזה כבוש', type: 'cure', source: 'made', stage: 'curing', start: start.toISOString().slice(0, 10), days: 7 }];
}

test.describe('D3: multi-day cure/dry reminders get a real firing path', () => {
  test('a due reminder shows a home banner (unconditional), opens the real panel, and clears once resolved', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-pantry': JSON.stringify(overdueCureProject('rem-test-1')),
    });

    const banner = page.locator('#cReminderBanner #reminderBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('תזכורת');
    await expect(banner).toContainText('ריפוי/ייבוש');

    // consumer exists: tapping the banner opens the real Reminders panel with the due row visible.
    await banner.click();
    await expect(page.locator('.shop-line', { hasText: 'חזה כבוש' })).toBeVisible();
    // honesty note (task brief: "be honest about the platform limit rather than papering over it").
    await expect(page.locator('.panel-body')).toContainText('התראת מערכת');

    // resolving the underlying project (pantry item removed) clears the banner on the next home sync —
    // proves the banner is DERIVED live state, not a one-shot flag that survives its own cause.
    await page.evaluate(() => { localStorage.setItem('mk-pantry', '[]'); (window as any).cRefreshHome(); });
    await expect(page.locator('#cReminderBanner #reminderBanner')).toHaveCount(0);
  });

  test('a NOT-yet-due reminder does not show the banner (negative case)', async ({ page }) => {
    const start = new Date();   // starts today; a 7-day cure is not due for a week
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-pantry': JSON.stringify([{ id: 'rem-test-2', name: 'שוק טרי', type: 'cure', source: 'made', stage: 'curing', start: start.toISOString().slice(0, 10), days: 7 }]),
    });
    await expect(page.locator('#cReminderBanner #reminderBanner')).toHaveCount(0);
  });

  test('checkReminders() fires a Notification+vibrate at most ONCE per reminder id when alerts are enabled', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-tlalerts': JSON.stringify(true),
      'mk-pantry': JSON.stringify(overdueCureProject('rem-test-3')),
    });
    const calls = await page.evaluate(() => {
      const w = window as any;
      Object.defineProperty(w.Notification, 'permission', { value: 'granted', configurable: true });
      let notifyCalls = 0, vibrateCalls = 0;
      const origNotify = w.mkNotify, origVibrate = w.mkVibrate;
      w.mkNotify = (...args: any[]) => { notifyCalls++; return origNotify.apply(null, args); };
      w.mkVibrate = (...args: any[]) => { vibrateCalls++; return origVibrate.apply(null, args); };
      w.checkReminders();
      w.checkReminders();   // a second, immediate re-check must NOT double-fire the same due reminder
      return { notifyCalls, vibrateCalls, stored: JSON.parse(localStorage.getItem('mk-reminders-notified') || '{}') };
    });
    expect(calls.notifyCalls).toBe(1);
    expect(calls.vibrateCalls).toBe(1);
    expect(Object.keys(calls.stored).length).toBe(1);
  });
});
