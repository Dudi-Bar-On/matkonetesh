import { test, expect } from '@playwright/test';

// Parallel multi-event: each event (or the 'cook' route) is an independent session — timers are
// namespaced per event, start-state is per event, and a global watcher fires alarms across all events.

test('scoping: evScope reflects the active context/event and namespaces stage timer ids', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  expect(await page.evaluate(`(function(){ setMenuCtx('cook'); return evScope(); })()`)).toBe('cook');
  expect(await page.evaluate(`(function(){ setMenuCtx('event'); store.set('mk-active','ev-A'); return evScope(); })()`)).toBe('ev-A');

  // a stage timer built while event A is active carries A's scope in its id
  await page.evaluate(`(function(){ setMenuCtx('event'); store.set('mk-active','ev-A'); saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0}); })()`);
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#tlList .tl-stage .timer[data-tid]', { state: 'attached' });
  const tid = await page.evaluate(`document.querySelector('#tlList .tl-stage .timer[data-tid]').dataset.tid`) as string;
  expect(tid).toContain('ev-A');
});

test('isolation: plan start-state is per event (starting A does not start B)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ setMenuCtx('event'); store.set('mk-active','ev-A'); setPlanStarted(Date.now()); })()`);
  expect(await page.evaluate(`(function(){ store.set('mk-active','ev-A'); return planStarted(); })()`)).toBe(true);
  expect(await page.evaluate(`(function(){ store.set('mk-active','ev-B'); return planStarted(); })()`)).toBe(false);   // event B independent
});

test('dashboard: the events list shows a running-timer badge per event', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var now=Date.now();
    store.set('mk-events', [{id:'ev-A', name:'חתונה', serve:'19:00', menu:{keys:['cut-1']}, updated:now}]);
    store.set('mk-timers', { 'st-ev-A-cut-1-2':{end:now+3600000,name:'עישון'}, 'st-ev-A-cut-1-4':{end:now+1800000,name:'סו-ויד'} });
  })()`);
  expect(await page.evaluate(`evRunningCount('ev-A')`)).toBe(2);
  await page.click('[data-cnav="events"]');
  await page.waitForSelector('.cevcard');
  expect(await page.evaluate(`!!document.querySelector('.cev-running')`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('.cev-running').textContent`)).toContain('2');
});

test('R2: tlState (method/order/stage-done) is isolated per event', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ setMenuCtx('event'); store.set('mk-active','ev-A'); tlSetState({'cut-1':{method:'sv',ready:false}}); })()`);
  expect(await page.evaluate(`(function(){ store.set('mk-active','ev-A'); return (tlState()['cut-1']||{}).method; })()`)).toBe('sv');
  expect(await page.evaluate(`(function(){ store.set('mk-active','ev-B'); return Object.keys(tlState()).length; })()`)).toBe(0);   // event B independent
});

test('R1: resetPlanTimers clears only the current event, not parallel events', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var f=Date.now()+1e6;
    store.set('mk-timers', {'st-ev-A-cut-1-smoke':{end:f}, 'st-ev-B-cut-1-smoke':{end:f}});
    setMenuCtx('event'); store.set('mk-active','ev-A'); resetPlanTimers();
  })()`);
  const keys = await page.evaluate(`Object.keys(store.get('mk-timers')||{})`) as string[];
  expect(keys).not.toContain('st-ev-A-cut-1-smoke');   // this event cleared
  expect(keys).toContain('st-ev-B-cut-1-smoke');        // the parallel event survives
});

test('global alarm: an expired timer is detected + fired even without its screen open (parallel events)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`store.set('mk-timers', {'st-ev-A-cut-1-2':{end:Date.now()-500, name:'עישון חזה'}})`);   // already expired, unfired
  await page.evaluate(`if(typeof startTimerWatch==='function') startTimerWatch();`);
  await page.waitForFunction(`!!(store.get('mk-timers')['st-ev-A-cut-1-2']||{}).fired`, null, {timeout:15000});
  const rec = await page.evaluate(`store.get('mk-timers')['st-ev-A-cut-1-2']`) as any;
  expect(rec.fired).toBeTruthy();   // the global watcher fired the alarm
});
