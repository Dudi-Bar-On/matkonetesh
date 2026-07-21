import { test, expect } from '@playwright/test';

// Wave B — serve time is a full datetime, not a clock-only value anchored to "today".
// An 18h cook served tomorrow must schedule against tomorrow's serve, not instantly read "behind".

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  // Pin "now" to a deterministic mid-day. These tests assert today/tomorrow rollover with clock-only
  // serve times ('23:59', '00:01'), which are only reliably ahead/behind away from the midnight boundary
  // — without this the suite failed whenever it happened to execute them near 00:00 (real failure 2026-07-21).
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00'));
  await page.goto('/index.html');
};

test('serveDateTime: a serve time already passed today rolls to tomorrow (ad-hoc)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlservedate-cook',null); store.set('mk-tlserve','00:01'); })()`);
  const r = await page.evaluate(`(function(){ return [isoDate(serveDateTime()), isoDate(new Date())]; })()`) as string[];
  expect(r[0]).not.toBe(r[1]);   // 00:01 already passed → rolls forward
});

test('serveDateTime: a serve time still ahead today stays today', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlservedate-cook',null); store.set('mk-tlserve','23:59'); })()`);
  const r = await page.evaluate(`(function(){ return [isoDate(serveDateTime()), isoDate(new Date())]; })()`) as string[];
  expect(r[0]).toBe(r[1]);
});

test('serveDateTime: an explicit future date pins the serve day (no roll)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlserve','19:00'); store.set('mk-tlservedate-cook','2026-12-25'); })()`);
  expect(await page.evaluate(`isoDate(serveDateTime())`)).toBe('2026-12-25');
});

test('serveDateTime: a stale past ad-hoc date is dropped (not pinned behind forever)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlserve','19:00'); store.set('mk-tlservedate-cook','2020-01-01'); })()`);
  // Compare entirely page-side: the page clock is pinned (init), so a Node-side `new Date()` here would
  // compare a fixed 2026-07-15 against the real wall-clock date and spuriously fail.
  const ok = await page.evaluate(`isoDate(serveDateTime()) >= isoDate(new Date())`) as boolean;
  expect(ok).toBeTruthy();   // stale 2020 date dropped → fell back to today/tomorrow, not 2020
});

test('parseServeTime: an event schedules against its own calendar date', async ({ page }) => {
  await init(page);
  const iso = await page.evaluate(`isoDate(parseServeTime('19:00', {date:'2026-08-01'}))`);
  expect(iso).toBe('2026-08-01');
});

test('serveDayLabel / fmtServe: today is terse, tomorrow is tagged', async ({ page }) => {
  await init(page);
  const today = await page.evaluate(`(function(){ var d=new Date(); d.setHours(19,0,0,0); return [serveDayLabel(d), fmtServe(d)]; })()`) as string[];
  expect(today[0]).toBe('היום');
  expect(today[1]).not.toContain('היום');   // fmtServe omits the tag when it's today
  const tmr = await page.evaluate(`(function(){ var d=new Date(Date.now()+86400000); d.setHours(19,0,0,0); return [serveDayLabel(d), fmtServe(d)]; })()`) as string[];
  expect(tmr[0]).toBe('מחר');
  expect(tmr[1]).toContain('מחר');
});

test('serve bar shows the serve day for a next-day cook', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlserve','19:00'); store.set('mk-tlservedate-cook', isoDate(new Date(Date.now()+86400000)));
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0}); })()`);
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#serveBar:not([hidden])');
  expect(await page.evaluate(`document.querySelector('#serveAt').textContent`)).toContain('מחר');
});
