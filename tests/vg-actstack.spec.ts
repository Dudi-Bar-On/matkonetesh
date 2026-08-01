import { test, expect, seedApp } from './_fixtures';

test.describe('§2.3 · the ordered act stack', () => {
  test('B7 · three cards at once, all reachable, none pushed off a 390×844 screen',
    async ({ isolatedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'חזה בקר', fired: 1 } }),
      'mk-bcheck-due': JSON.stringify({ 'st-ev1-b-bcheck@1': { name: 'שוק', temp: 74, tid: 'st-ev1-b-bcheck', acked: false } }) });
    await page.evaluate(() => {
      const w = window as any;
      w.renderAlarm(); w.renderBcheckAlarm(); w.mkShowTimerWarn('st-ev1-c-smoke', 'צלעות', 110);
    });
    await page.waitForFunction(() => document.querySelectorAll('#mkActStack .mk-alarm').length === 3);
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#mkActStack .mk-alarm')].map(e => e.id));
    expect(order).toEqual(['mkBcheckAlarm', 'mkAlarm', 'mkWarnAlarm']);   // safety first, always
    for (const id of order) {
      const box = await page.locator('#' + id).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);               // zero horizontal overflow
    }
    await expect(page.locator('#mkActStack')).toHaveClass(/mk-actstack-scroll/);
  });

  test('NEGATIVE · with ONE card there is no internal scroll and nothing else changed',
    async ({ isolatedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'חזה בקר', fired: 1 } }) });
    await page.evaluate(() => (window as any).renderAlarm());
    await expect(page.locator('#mkAlarm')).toBeVisible();
    await expect(page.locator('#mkActStack')).not.toHaveClass(/mk-actstack-scroll/);
    await page.locator('#mkAlarm .mka-stop').click();                     // the shipped listener still works
    await expect(page.locator('#mkAlarm')).toHaveCount(0);
  });
});
