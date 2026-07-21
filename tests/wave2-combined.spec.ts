import { test, expect } from '@playwright/test';

// Combined multi-event timeline: every event's item-start actions merged onto one color-coded schedule.

test('combined timeline merges all events\' starts, sorted by time, color-coded per event', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var now=Date.now();
    store.set('mk-events', [
      {id:'ev-A', name:'חתונה', serve:'19:00', menu:{keys:['cut-1'],guests:8}, updated:now},
      {id:'ev-B', name:'בר מצווה', serve:'20:30', menu:{keys:['cut-4'],guests:12}, updated:now}
    ]);
  })()`);
  // the merged rows include items from both events, time-sorted
  const rows = await page.evaluate(`combinedEventsRows().map(function(r){return {name:r.name, ev:r.ev.name, t:r.start.getTime()};})`) as any[];
  expect(rows.length).toBe(2);
  expect(rows.map(r => r.ev)).toContain('חתונה');
  expect(rows.map(r => r.ev)).toContain('בר מצווה');
  expect(rows[0].t).toBeLessThanOrEqual(rows[1].t);   // sorted by start time

  // the events screen shows the combined view inline as a hero: color-coded rows + a legend
  await page.click('[data-cnav="events"]');
  await page.waitForSelector('#cEvBody .cet-hero .cet-row');
  expect(await page.evaluate(`document.querySelectorAll('#cEvBody .cet-hero .cet-row').length`)).toBe(2);
  expect(await page.evaluate(`document.querySelectorAll('#cEvBody .cet-hero .cet-legend .cet-leg').length`)).toBe(2);
  // and the title opens the full focused/printable combined-view panel
  await page.click('#cetFull');
  await page.waitForSelector('#panel .cet-row');
  expect(await page.evaluate(`document.querySelectorAll('#panel .cet-row').length`)).toBe(2);
  expect(await page.evaluate(`document.querySelectorAll('#panel .cet-legend .cet-leg').length`)).toBe(2);
});

test('multi-event hero: tapping a combined-timeline row opens that event, focused on the item', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-events', JSON.stringify([
      {id:'ev-a',name:'Friday BBQ',serve:'19:00',date:'2026-07-20',menu:{guests:8,keys:['cut-1','cut-2']}},
      {id:'ev-b',name:'Sat Wedding',serve:'18:00',date:'2026-07-21',menu:{guests:20,keys:['cut-3','cut-4']}}
    ])); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cNavGo==='function'`);
  await page.evaluate(`cNavGo('events')`);
  await page.waitForSelector('#cEvBody .cet-hero .cet-row[data-cetgo]');
  // no Hebrew leaks in the hero (English mode)
  const heb = await page.evaluate(`(function(){ const r=document.querySelector('#cEvBody .cet-hero'); const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,null);const a=[];let n;while((n=w.nextNode())){const t=(n.nodeValue||'').trim(); if(/[֐-׿]/.test(t))a.push(t);} return a; })()`) as string[];
  expect(heb).toEqual([]);
  // REAL click on a row that belongs to ev-b (cut-4)
  await page.evaluate(`(function(){ const rows=Array.from(document.querySelectorAll('#cEvBody .cet-hero .cet-row[data-cetgo="ev-b"]')); const r=rows.find(x=>x.getAttribute('data-cetitem')==='cut-4'); r.setAttribute('data-pick','1'); })()`);
  await page.locator('[data-pick="1"]').click();
  await page.waitForSelector('#panel.open #tlBody');
  await page.waitForFunction(`store.get('mk-active')==='ev-b' && _tlFocusKey==='cut-4'`);
  expect(await page.evaluate(`store.get('mk-active')`)).toBe('ev-b');           // that event became active
  expect(await page.evaluate(`(menuState().keys||[]).join(',')`)).toBe('cut-3,cut-4');   // its menu loaded
  expect(await page.evaluate(`_tlFocusKey`)).toBe('cut-4');                     // focused on the tapped item
});
