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
    // R-56: the storage key is bound to the OCCURRENCE (tid + its scheduled instant), not just the tid —
    // so it is looked up by prefix rather than asserted as an exact literal.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mk-bcheck-due') || '{}'));
    const storedKey = Object.keys(stored).find((k) => k.indexOf('test-bcheck-tid-1@') === 0);
    expect(storedKey).toBeTruthy();
    expect(stored[storedKey as string]).toBeTruthy();

    // explicit acknowledgement (not an auto-timeout — this is safety content).
    await page.locator('[data-bcheckack]').click();
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    // R-56: acknowledging no longer DELETES the record (that erased the "already surfaced" fact and let
    // the same occurrence re-fire) — it marks it acked, and the record stays in storage.
    const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mk-bcheck-due') || '{}'));
    expect(stored2[storedKey as string]).toBeTruthy();
    expect(stored2[storedKey as string].acked).toBe(true);
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

// R-56 (owner-reported regression on v282, 2026-08-01): ackBcheck DELETED the key it was acknowledging,
// so "never surfaced" and "surfaced and acknowledged" both looked like "absent" — the guard in
// scheduleBcheckDue (`if(_bcheckDue()[key]) return`) could no longer tell them apart, and the card
// re-fired on every re-entry to the event. The D2 tests above only asserted the card APPEARS; none
// asserted what happens AFTER acknowledgement, which is exactly the gap the owner hit.
//
// Fix: the acknowledgement record is now bound to the OCCURRENCE (the stage's tid + its scheduled start
// instant), not just the stage's identity (tid alone) — and acknowledging marks the record `acked` rather
// than deleting it. A re-entry to the same, already-acked cook keeps the same key (same tid, same start)
// and stays suppressed. A NEW cook of the same item computes a NEW start (planSchedule reruns from a new
// serve time) and therefore a NEW key — the safety gate fires again, exactly as it must.
test.describe('R-56: bcheck acknowledgement is bound to the occurrence, not the stage', () => {
  test('regression: re-running scheduleBcheckDue for the same occurrence after acknowledging does not resurface the card', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    // NOTE: page.clock's installed time keeps ticking in real wall-clock ms (proven while authoring this
    // test — it is NOT frozen), so the stage's `start` must be a FIXED instant captured once, not
    // recomputed as "now - 1000" on every call — otherwise each re-entry would compute a genuinely
    // DIFFERENT `start` and this test would be exercising the "new occurrence" path instead of the
    // "same occurrence, re-entered" path it's meant to prove.
    const startMs = await page.evaluate(() => Date.now() - 1000);
    const fire = (start: number) => (window as any).scheduleBcheckDue([{
      blocked: false,
      m: { heb: 'צלעות חזיר', key: 'test-ribs' },
      stages: [{ kind: 'bcheck', start: new Date(start), tid: 'test-bcheck-tid-regress', temp: 63 }],
    }], []);

    // first entry into the event: buildList calls scheduleBcheckDue, the card fires.
    await page.evaluate(fire, startMs);
    await expect(page.locator('#mkBcheckAlarm')).toBeVisible();
    await expect(page.locator('#mkBcheckAlarm')).toContainText('צלעות חזיר');

    await page.locator('[data-bcheckack]').click();
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);

    // re-entering the SAME event calls buildList -> scheduleBcheckDue again, with the IDENTICAL occurrence
    // (same tid, same fixed start — nothing about the cook changed). This is the exact regression: the
    // card must stay gone.
    await page.evaluate(fire, startMs);
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
  });

  test('safety negative case (mandatory): a NEW cook of the same item — different start — raises the check again after acknowledgement', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });

    await page.evaluate(() => {
      const computed = [{
        blocked: false,
        m: { heb: 'כתף חזיר', key: 'test-shoulder' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'test-bcheck-tid-newcook', temp: 91 }],
      }];
      (window as any).scheduleBcheckDue(computed, []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toBeVisible();
    await page.locator('[data-bcheckack]').click();
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);

    // a fresh cook of the SAME item (same tid — same stage identity in the same event) scheduled for a
    // DIFFERENT instant: this is what planSchedule produces when the owner starts cooking it again.
    await page.evaluate(() => {
      const computed = [{
        blocked: false,
        m: { heb: 'כתף חזיר', key: 'test-shoulder' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() + 500), tid: 'test-bcheck-tid-newcook', temp: 91 }],
      }];
      (window as any).scheduleBcheckDue(computed, []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);   // not due yet at the new instant
    await page.clock.fastForward(600);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
    await expect(page.locator('#mkBcheckAlarm')).toContainText('כתף חזיר');
  });

  test('reload persistence: an acknowledged check stays acknowledged, an unacknowledged one still shows', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => {
      const computed = [
        { blocked: false, m: { heb: 'הודו שלם', key: 'test-turkey' }, stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'test-bcheck-tid-acked', temp: 74 }] },
        { blocked: false, m: { heb: 'סלמון', key: 'test-salmon' }, stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'test-bcheck-tid-unacked', temp: 63 }] },
      ];
      (window as any).scheduleBcheckDue(computed, []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toContainText('הודו שלם');
    await expect(page.locator('#mkBcheckAlarm')).toContainText('סלמון');

    await page.locator('[data-bcheckack*="test-bcheck-tid-acked"]').click();
    await expect(page.locator('#mkBcheckAlarm')).not.toContainText('הודו שלם');
    await expect(page.locator('#mkBcheckAlarm')).toContainText('סלמון');

    await page.reload();
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
    await expect(page.locator('#mkBcheckAlarm')).toContainText('סלמון');
    await expect(page.locator('#mkBcheckAlarm')).not.toContainText('הודו שלם');
  });

  test('the event name renders on each row, matching the timer alarm\'s existing pattern', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-events': JSON.stringify([{ id: 'evtest1', name: 'ארוחת שבת', createdAt: 1 }]),
    });
    await page.evaluate(() => {
      const computed = [{
        blocked: false,
        m: { heb: 'חזה בקר', key: 'test-brisket-ev' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'st-evtest1-test-brisket-ev-bcheck', temp: 74 }],
      }];
      (window as any).scheduleBcheckDue(computed, []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toBeVisible();
    await expect(page.locator('#mkBcheckAlarm')).toContainText('חזה בקר');
    await expect(page.locator('#mkBcheckAlarm')).toContainText('ארוחת שבת');
  });
});
