import { test, expect } from '@playwright/test';

// Wave A — background-resilient alarms: wake-lock keeps the page alive, alarms route through the
// SW registration (so they show on mobile), and a fired timer vibrates + re-pulses until acknowledged.

const init = async (page: any, stubVibrate = false) => {
  await page.addInitScript((stub: boolean) => {
    if (stub) { try { Object.defineProperty(navigator, 'vibrate', { value: (p: any) => { (window as any).__vib = ((window as any).__vib || []).concat([p]); return true; }, configurable: true }); } catch {} }
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  }, stubVibrate);
  await page.goto('/index.html');
};

test('anyTimerActive / anyTimerRinging reflect timer state', async ({ page }) => {
  await init(page);
  await page.evaluate(`store.set('mk-timers', {'a':{end:Date.now()+1e6}})`);
  expect(await page.evaluate(`anyTimerActive()`)).toBe(true);
  expect(await page.evaluate(`anyTimerRinging()`)).toBe(false);
  await page.evaluate(`store.set('mk-timers', {'a':{end:Date.now()-1, fired:1}})`);
  expect(await page.evaluate(`anyTimerActive()`)).toBe(false);   // fired timers are no longer "active"
  expect(await page.evaluate(`anyTimerRinging()`)).toBe(true);   // ...they're "ringing" until cleared
});

test('mkNotify degrades gracefully with no SW / no permission (never throws)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){ try{ return mkNotify('t','b','tag'); }catch(e){ return 'THREW:'+e.message; } })()`);
  expect(r).toBe(false);   // no registration, permission not granted → false, not an exception
});

test('mkVibrate forwards its pattern to navigator.vibrate', async ({ page }) => {
  await init(page, true);
  await page.evaluate(`mkVibrate([111,22,111])`);
  expect(await page.evaluate(`(window.__v_pat||(window.__vib&&window.__vib[0])||[]).join(',')`)).toBe('111,22,111');
});

test('wake-lock helpers never throw (API present or absent)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(async function(){ try{ await acquireWakeLock(); releaseWakeLock(); syncWakeLock(); return 'ok'; }catch(e){ return 'THREW:'+e.message; } })()`);
  expect(r).toBe('ok');
});

test('a fired timer beeps, vibrates and marks itself fired (background watcher)', async ({ page }) => {
  await init(page, true);
  await page.evaluate(`store.set('mk-timers', {'st-ev-A-cut-1-smoke':{end:Date.now()-500, name:'עישון חזה'}})`);
  await page.evaluate(`if(typeof startTimerWatch==='function') startTimerWatch();`);
  await page.waitForFunction(`!!(store.get('mk-timers')['st-ev-A-cut-1-smoke']||{}).fired`, null, {timeout:15000});
  expect(await page.evaluate(`store.get('mk-timers')['st-ev-A-cut-1-smoke'].fired`)).toBeTruthy();
  expect(await page.evaluate(`(window.__vib||[]).length`)).toBeGreaterThan(0);   // vibration pattern was issued on fire
});
