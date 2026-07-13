import { test, expect } from '@playwright/test';

// In-app alarm banner — a ringing (fired) timer is visible and stoppable from any screen, not only
// from its own timer's panel.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('a fired timer surfaces an in-app alarm banner with a Stop button', async ({ page }) => {
  await init(page);
  await page.evaluate(`store.set('mk-timers', {'st-cook-cut-1-smoke':{end:Date.now()-500, name:'עישון חזה'}})`);
  await page.evaluate(`startTimerWatch()`);
  await page.waitForSelector('#mkAlarm');
  expect(await page.evaluate(`document.querySelector('#mkAlarm .mka-name').textContent`)).toContain('עישון חזה');
  await page.evaluate(`document.querySelector('#mkAlarm [data-alarmstop]').click()`);   // stop it
  expect(await page.evaluate(`!!document.querySelector('#mkAlarm')`)).toBe(false);       // banner gone
  expect(await page.evaluate(`anyTimerRinging()`)).toBe(false);                          // timer acknowledged
  expect(await page.evaluate(`Object.keys(store.get('mk-timers')||{}).length`)).toBe(0);
});

test('the banner names the owning event and lists multiple ringing timers with Stop All', async ({ page }) => {
  await init(page);
  await page.evaluate(`store.set('mk-events', [{id:'ev-A', name:'חתונה', menu:{keys:['cut-1']}}])`);
  await page.evaluate(`store.set('mk-timers', {'st-ev-A-cut-1-smoke':{end:Date.now()-5,name:'עישון',fired:1}, 'st-cook-cut-2-sv':{end:Date.now()-5,name:'סו-ויד',fired:1}})`);
  await page.evaluate(`renderAlarm()`);
  await page.waitForSelector('#mkAlarm .mka-stopall');
  expect(await page.evaluate(`document.querySelectorAll('#mkAlarm .mka-row').length`)).toBe(2);
  expect(await page.evaluate(`document.querySelector('#mkAlarm').textContent`)).toContain('חתונה');   // event named on the ev-A timer
  await page.evaluate(`document.querySelector('[data-alarmstopall]').click()`);
  expect(await page.evaluate(`anyTimerRinging()`)).toBe(false);
  expect(await page.evaluate(`!!document.querySelector('#mkAlarm')`)).toBe(false);
});

test('reopening the app while a timer is ringing shows the banner on boot', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-timers', JSON.stringify({'st-cook-cut-1-smoke':{end:Date.now()-1000, name:'סו-ויד צלעות', fired:1}})); } catch {} });
  await page.goto('/index.html');
  await page.waitForSelector('#mkAlarm');
  expect(await page.evaluate(`document.querySelector('#mkAlarm .mka-name').textContent`)).toContain('סו-ויד צלעות');
});
