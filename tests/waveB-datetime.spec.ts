import { test, expect } from '@playwright/test';

// Wave B — serve time is a full datetime, not a clock-only value anchored to "today".
// An 18h cook served tomorrow must schedule against tomorrow's serve, not instantly read "behind".

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
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
  const iso = await page.evaluate(`isoDate(serveDateTime())`) as string;
  expect(iso >= new Date().toISOString().slice(0,10)).toBeTruthy();   // fell back to today/tomorrow, not 2020
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
