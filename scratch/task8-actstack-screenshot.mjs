import { chromium } from 'playwright';
import path from 'node:path';

const dist = path.resolve('dist/index.html');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.goto('file:///' + dist.replace(/\\/g, '/'));
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mk-uilevel-asked', 'true');
  localStorage.setItem('mk-timers', JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'חזה בקר', fired: 1 } }));
  localStorage.setItem('mk-bcheck-due', JSON.stringify({ 'st-ev1-b-bcheck@1': { name: 'שוק', temp: 74, tid: 'st-ev1-b-bcheck', acked: false } }));
});
await page.reload();
await page.waitForLoadState('domcontentloaded');
await page.evaluate(() => {
  const w = window;
  w.renderAlarm(); w.renderBcheckAlarm(); w.mkShowTimerWarn('st-ev1-c-smoke', 'צלעות', 110);
});
await page.waitForFunction(() => document.querySelectorAll('#mkActStack .mk-alarm').length === 3, null, { timeout: 5000 });
await page.screenshot({ path: 'mockups/task8-actstack-390x844.png' });
await browser.close();
console.log('done');
