import { test, expect, seedApp } from './_fixtures';

// D2 (docs/analysis/2026-08-01-voice-output-audit.md N2/S6): the bcheck (internal-temp check) stage is
// the sole pre-serve safety gate, and itemStages() gives it hours:0 by design — DoD-10 forbids touching
// that. But workPlanHtml never attached a tid/dur to it either, so it had NO active trigger: a static
// table row nobody was ever notified about. "The right moment" (per the task brief) is the instant the
// stage before it finishes — which is exactly what planSchedule already computes as a 0-hour stage's
// own `start`. scheduleBcheckDue (app.js) reads that existing timestamp and fires a persistent, explicit-
// dismiss in-app card (renderBcheckAlarm/#mkBcheckAlarm, the same .mk-alarm structure as D1) — this is
// UNCONDITIONAL, unlike the mk-tlalerts-gated stage-start reminders, because it is the safety channel.
test.describe('D2: bcheck safety check gets a real firing path', () => {
  test('fires an in-app "due now" card at its scheduled instant, independent of mk-tlalerts', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    // mk-tlalerts intentionally NOT seeded (off by default) — the safety card must fire regardless.
    await seedApp(page, { 'mk-uilevel-asked': 'true' });

    await page.evaluate(() => {
      const w = window as any;
      const computed = [{
        blocked: false,
        m: { heb: 'חזה בקר', key: 'test-brisket' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() + 5000), tid: 'test-bcheck-tid-1', temp: 74 }],
      }];
      w.scheduleBcheckDue(computed, []);
    });

    // RED-proving assertion: before the scheduled instant, nothing shows.
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);

    await page.clock.fastForward(6000);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));

    const card = page.locator('#mkBcheckAlarm');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('role', 'alertdialog');
    await expect(card).toContainText('חזה בקר');
    await expect(card).toContainText('74°');   // the safety-bearing target temp, not a generic "check now"

    // persisted (store), not merely rendered in-memory — a reopen after the moment passed must still show it.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mk-bcheck-due') || '{}'));
    expect(stored['test-bcheck-tid-1']).toBeTruthy();

    // explicit acknowledgement (not an auto-timeout — this is safety content).
    await page.locator('[data-bcheckack]').click();
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mk-bcheck-due') || '{}'));
    expect(stored2['test-bcheck-tid-1']).toBeUndefined();
  });

  test('an already-passed instant surfaces immediately (app reopened after the moment passed)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => {
      const w = window as any;
      const computed = [{
        blocked: false,
        m: { heb: 'שוק טלה', key: 'test-lamb' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'test-bcheck-tid-2', temp: 88 }],
      }];
      w.scheduleBcheckDue(computed, []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toBeVisible();
    await expect(page.locator('#mkBcheckAlarm')).toContainText('שוק טלה');
  });

  test('safety invariance: scheduling the notification never touches the stage\'s own safety fields', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const stage = await page.evaluate(() => {
      const w = window as any;
      const s = { kind: 'bcheck', start: new Date(Date.now() + 1000), tid: 'test-bcheck-tid-3', temp: 74, hours: 0, safety: undefined };
      const computed = [{ blocked: false, m: { heb: 'עוף שלם', key: 'test-chicken' }, stages: [s] }];
      w.scheduleBcheckDue(computed, []);
      return { temp: s.temp, hours: s.hours, kind: s.kind };
    });
    expect(stage).toEqual({ temp: 74, hours: 0, kind: 'bcheck' });   // DoD-10: unchanged by the scheduling call
  });
});
