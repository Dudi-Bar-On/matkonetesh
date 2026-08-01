import { test, expect, seedApp } from './_fixtures';

// D1 (docs/analysis/2026-08-01-voice-output-audit.md V-1, owner ruling 2026-08-01: "voice is never the
// only channel — everything spoken must also appear visually"). Before this fix, wireTimer's onWarn
// latch (app.js ~3309) called ONLY the caller's onWarn callback (vcSpeak, at the voice-cook call site) —
// nothing touched the DOM. A muted/out-of-earshot user got no signal at the 2-minute mark. The fix adds
// mkShowTimerWarn/mkClearTimerWarn — a persistent card reusing the renderAlarm/.mk-alarm pattern — driven
// directly by wireTimer's own warn latch, so ANY caller that sets opts.warnSec+onWarn gets the visual for
// free (today that is only the voice-cook timer, app.js vcRender ~7254).
//
// isolatedPage + page.clock: wireTimer's tick is a real setInterval driven by Date.now() deltas: a fake
// clock is the only way to cross a warn threshold without a real 2-minute sleep (TEST-AUTHORING-CONTRACT
// §2 — clock is exactly the documented reason to leave the warm page).
test.describe('D1: timer warning gets a persistent visual counterpart', () => {
  test('mk-alarm-style card appears once the warn threshold is crossed, and clears on explicit dismiss', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });

    await page.evaluate(() => {
      const w = window as any;
      const host = document.createElement('div');
      host.innerHTML = w.timerHTML(10, 'test-warn-tid', 'חזה בקר');
      document.body.appendChild(host);
      const tm = host.querySelector('.timer') as HTMLElement;
      w.wireTimer(tm, { warnSec: 8, onWarn: () => {}, onEnd: () => {} });
      (tm.querySelector('[data-play]') as HTMLElement).click();
    });

    // RED-proving assertion: before the timer even starts counting down past the warn threshold, no card.
    await expect(page.locator('#mkWarnAlarm')).toHaveCount(0);

    // Cross the warn threshold (sec=10, warnSec=8 → fires once left<=8, i.e. after ~2s elapsed).
    await page.clock.fastForward(3000);
    await page.waitForFunction(() => !!document.getElementById('mkWarnAlarm'));

    const card = page.locator('#mkWarnAlarm');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('role', 'alertdialog');
    await expect(card).toContainText('חזה בקר');   // the exact timer name, not a generic label
    await expect(card).toContainText('עוד פחות מדקה');   // left=7s < 60s → the same "under a minute" wording vcSpeak's onWarn caller uses

    // explicit dismissal (not an auto-timeout) — DoD requirement from the task brief ("needs persistence
    // and explicit dismissal", unlike toast()).
    await page.locator('[data-warnstop]').click();
    await expect(page.locator('#mkWarnAlarm')).toHaveCount(0);
  });

  test('the card is cleared automatically once the real alarm takes over (timer reaches zero)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });

    await page.evaluate(() => {
      const w = window as any;
      const host = document.createElement('div');
      host.innerHTML = w.timerHTML(4, 'test-warn-tid-2', 'שוק טלה');
      document.body.appendChild(host);
      const tm = host.querySelector('.timer') as HTMLElement;
      w.wireTimer(tm, { warnSec: 3, onWarn: () => {}, onEnd: () => {} });
      (tm.querySelector('[data-play]') as HTMLElement).click();
    });

    await page.clock.fastForward(1500);
    await page.waitForFunction(() => !!document.getElementById('mkWarnAlarm'));
    await expect(page.locator('#mkWarnAlarm')).toBeVisible();

    await page.clock.fastForward(5000);   // run past the timer's own end
    await page.waitForFunction(() => !document.getElementById('mkWarnAlarm'));
    await expect(page.locator('#mkWarnAlarm')).toHaveCount(0);
  });
});
