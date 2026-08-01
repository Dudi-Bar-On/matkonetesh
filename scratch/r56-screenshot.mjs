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
  localStorage.setItem('mk-events', JSON.stringify([{ id: 'shotev1', name: 'ארוחת שבת', createdAt: 1 }]));
});
await page.reload();
await page.waitForLoadState('domcontentloaded');
await page.evaluate(() => {
  const w = window;
  const computed = [{
    blocked: false,
    m: { heb: 'חזה בקר', key: 'shot-brisket' },
    stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'st-shotev1-shot-brisket-bcheck', temp: 74 }],
  }];
  w.scheduleBcheckDue(computed, []);
});
await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'), null, { timeout: 5000 });
await page.screenshot({ path: 'mockups/r56-bcheck-with-event-name-390x844.png' });
console.log('done — event-name row screenshot taken');
await browser.close();
