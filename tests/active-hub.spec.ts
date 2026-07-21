import { test, expect } from '@playwright/test';

// "Active now" hub — one place for ongoing/long-term timers + a way back to an active plan/cook/project.
const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  // gate on the app being genuinely ready, not merely on one symbol existing: under full-suite contention
  // the gap between "openActive is defined" and "boot finished" widens, and calling into a half-booted app
  // left the panel unopened until the 30s timeout.
  await page.waitForFunction(`document.readyState==='complete' && typeof openActive==='function' && typeof store!=='undefined' && typeof cRefreshHome==='function'`);
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
  await page.waitForFunction(`Object.keys(store.get('mk-timers')||{}).length===1`);   // wait on the store, not a guess
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

test('active hub: a plan-timer jump opens the timeline focused on that item', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',date:'2026-07-20',menu:{guests:8,keys:['cut-1','make-1']}}])); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline('st-ev-a-cut-1-smoke'); })()`);
  await page.waitForSelector('#tlList .tlcard');
  // Wait for the focus flash to actually land AND its card to expand — the exact end-state the assertions
  // check — instead of guessing 300ms. The fixed wait raced the render under parallel load and flaked.
  await page.waitForFunction(`(function(){ var f=document.querySelector('.tl-focus'); if(!f) return false; var stg=f.closest('.tl-stages'); return stg && getComputedStyle(stg).display==='block'; })()`);
  // the flash lands on the exact stage row inside cut-1's card, and the steps are expanded
  expect(await page.evaluate(`(function(){ const f=document.querySelector('.tl-focus'); const c=f&&f.closest('.tlcard'); const xb=c&&c.querySelector('[data-tlexp]'); return xb?xb.getAttribute('data-tlexp'):'NONE'; })()`)).toBe('cut-1');
  const stagesShown = await page.evaluate(`(function(){ const f=document.querySelector('.tl-focus'); const stg=f&&f.closest('.tl-stages'); return stg?getComputedStyle(stg).display:'n/a'; })()`);
  expect(stagesShown).toBe('block');
});

test('events: tapping an event opens its work-plan; the ✏️ Edit button opens the wizard', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1']}}])); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`cNavGo('events')`);
  await page.waitForSelector('.cevcard .cev-name');
  await page.click('.cevcard .cev-name');   // tap the event body
  await page.waitForSelector('#panel.open #tlBody');   // → work-plan (timeline), not the wizard
  expect(await page.evaluate(`document.querySelector('#scr-wizard').classList.contains('on')`)).toBe(false);
  await page.evaluate(`closePanel()`);
  await page.evaluate(`cNavGo('events')`);
  await page.waitForSelector('[data-evedit]');
  await page.click('[data-evedit]');   // Edit → wizard
  await expect(page.locator('#scr-wizard')).toHaveClass(/on/);
});

test('active hub: a timer with a stale Hebrew name shows a localized name (derived from its key)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1']}}])); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openActive==='function'`);
  await page.evaluate(`(function(){ store.set('mk-timers',{ 'st-ev-a-cut-1-smoke':{end:Date.now()+3600000,name:'עישון 105° · בריסקט'} }); openActive(); })()`);
  await page.waitForSelector('#panel.open .active-row[data-ajump]');
  const nm = await page.evaluate(`document.querySelector('#panel .active-row[data-ajump] .ar-main b').textContent`) as string;
  expect(/[֐-׿]/.test(nm)).toBe(false);   // no leftover Hebrew from the stored name
  expect(nm).toContain('Brisket');        // resolved from the key: "Smoke · Brisket"
});

test('active hub: timer focus works in the WORK-PLAN view too (exact timer element)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-tlview', JSON.stringify('plan'));   // chronological work-plan view
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1','make-1']}}])); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openActive==='function'`);
  await page.evaluate(`(function(){ store.set('mk-timers',{ 'st-ev-a-cut-1-smoke':{end:Date.now()+3600000,name:'x'} }); openActive(); })()`);
  await page.waitForSelector('#panel.open .active-row[data-ajump]');
  await page.click('#panel .active-row[data-ajump] .ar-main');
  await page.waitForSelector('#tlList .workplan');
  // wait for the focus to land on the exact timer's task — not a fixed 700ms that races the render under load
  await page.waitForFunction(`(function(){ var f=document.querySelector('.tl-focus'); if(!f) return false; var t=f.querySelector('[data-tid]'); return (t?t.getAttribute('data-tid'):f.getAttribute('data-tid'))==='st-ev-a-cut-1-smoke'; })()`);
  // the exact smoke timer's task is highlighted (not just the plan opened at the top)
  const tid = await page.evaluate(`(function(){ const f=document.querySelector('.tl-focus'); if(!f) return 'NONE'; const t=f.querySelector('[data-tid]'); return t?t.getAttribute('data-tid'):(f.getAttribute('data-tid')||'NO-TID'); })()`);
  expect(tid).toBe('st-ev-a-cut-1-smoke');
});

test('work-plan shows an event-identity banner (which event you are in)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'Friday BBQ',serve:'19:00',date:'2026-07-20',menu:{guests:8,keys:['cut-1']}}])); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline(); })()`);
  // wait for the banner AND its name content to be populated (the div can appear a beat before its <b> text)
  await page.waitForFunction(`(function(){ var b=document.querySelector('#tlBody .tl-evbanner b'); return b && b.textContent.trim().length>0; })()`);
  expect(await page.evaluate(`document.querySelector('#tlBody .tl-evbanner b').textContent`)).toBe('Friday BBQ');
});

test('floating Active-now shortcut: shows while cooking, opens the hub, hides with panels / when idle', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof syncActiveFab==='function'`);
  // idle → hidden (property AND actually not painted — the [hidden] attr must beat the class's display:flex)
  expect(await page.evaluate(`document.querySelector('#cActiveFab').hidden`)).toBe(true);
  expect(await page.evaluate(`getComputedStyle(document.querySelector('#cActiveFab')).display`)).toBe('none');
  // a running timer → shown on the home screen
  await page.evaluate(`(function(){ store.set('mk-timers',{'st-ev-a-cut-1-smoke':{end:Date.now()+3600000,name:'x'}}); cNavGo('home'); })()`);
  await page.waitForSelector('#cActiveFab:not([hidden])');
  expect(await page.evaluate(`getComputedStyle(document.querySelector('#cActiveFab')).display`)).not.toBe('none');   // actually painted while cooking
  // its label is localized (English UI → no Hebrew leak)
  expect(/[֐-׿]/.test(await page.evaluate(`document.querySelector('#cActiveFabT').textContent`) as string)).toBe(false);
  // shown on other screens too
  await page.evaluate(`cNavGo('catalog')`);
  expect(await page.evaluate(`document.querySelector('#cActiveFab').hidden`)).toBe(false);
  // tap → Active-now hub opens, and the fab hides while the panel is up
  await page.click('#cActiveFab');
  await page.waitForSelector('#panel.open .active-sec');
  expect(await page.evaluate(`document.querySelector('#cActiveFab').hidden`)).toBe(true);
  // close + clear timers → hidden
  await page.evaluate(`(function(){ closePanel(); store.set('mk-timers',{}); cNavGo('home'); })()`);
  await page.waitForFunction(`document.querySelector('#cActiveFab').hidden===true`);   // wait on the state, not a guess
  expect(await page.evaluate(`document.querySelector('#cActiveFab').hidden`)).toBe(true);
});
