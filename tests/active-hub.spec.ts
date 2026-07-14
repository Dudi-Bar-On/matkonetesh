import { test, expect } from '@playwright/test';

// "Active now" hub — one place for ongoing/long-term timers + a way back to an active plan/cook/project.
const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openActive==='function'`);
};

test('active hub: aggregates timers, plans and long-term projects with a jump-back', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ var now=Date.now();
    store.set('mk-timers',{ 'cut-1-sv-0':{end:now+90*60*1000,name:'SV'}, 'spec-1-smoke-0':{end:now-5000,fired:1,name:'Smoke'} });
    store.set('mk-plan-started-cook', now);
    store.set('mk-pantry',[{id:'p1',name:'Salami',key:'spec-1',type:'dry',startW:1000,curW:820,factor:0.62,start:'2026-06-20',doneSteps:[]}]);
    openActive(); })()`);
  await page.waitForSelector('#panel.open .active-row');
  // three sections present: timers, cooks/plans, long-term projects
  expect(await page.evaluate(`document.querySelectorAll('#panel .active-sec').length`)).toBe(3);
  // a running timer, a ringing timer, a plan row and a project row all render
  expect(await page.evaluate(`document.querySelectorAll('#panel .active-row').length`)).toBeGreaterThanOrEqual(4);
  expect(await page.evaluate(`!!document.querySelector('#panel .active-row.ring')`)).toBe(true);   // ringing timer highlighted
  expect(await page.evaluate(`!!document.querySelector('#panel .atimer-remain[data-end]')`)).toBe(true);   // running timer counts live
  expect(await page.evaluate(`!!document.querySelector('#panel [data-aplan]')`)).toBe(true);   // active cook plan → jump back
  expect(await page.evaluate(`!!document.querySelector('#panel [data-aproj]')`)).toBe(true);   // long-term project → jump back
});

test('active hub: the ✕ stops (removes) a timer', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ var now=Date.now(); store.set('mk-timers',{ 'cut-1-sv-0':{end:now+3600000,name:'SV'}, 'cut-2-sv-0':{end:now+3600000,name:'SV2'} }); openActive(); })()`);
  await page.waitForSelector('#panel.open .ar-x');
  expect(await page.evaluate(`Object.keys(store.get('mk-timers')||{}).length`)).toBe(2);
  await page.click('#panel .active-row .ar-x');
  await page.waitForTimeout(150);
  expect(await page.evaluate(`Object.keys(store.get('mk-timers')||{}).length`)).toBe(1);
});

test('active hub: the home cooking banner opens it', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ store.set('mk-timers',{ 'cut-1-sv-0':{end:Date.now()+3600000,name:'SV'} }); cRefreshHome(); })()`);
  await page.waitForSelector('#cCooking:not([hidden])');
  await page.click('#cCooking');
  await page.waitForSelector('#panel.open .active-sec');
  // opens the Active hub (Timers + Cooks/plans always render; Long-term projects is conditional on having one)
  expect(await page.evaluate(`document.querySelectorAll('#panel .active-sec').length`)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(`!!document.querySelector('#panel .atimer-remain[data-end]')`)).toBe(true);
});
