import { test, expect } from '@playwright/test';

// Wave E5 (consolidated cross-event shopping) + Wave F leftovers (persistent checkboxes, now/next cue).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('E5: cross-event shopping sums quantities and attributes each item to its events', async ({ page }) => {
  await init(page);
  const d = await page.evaluate(`(function(){
    store.set('mk-events', [
      {id:'ev-A', name:'חתונה', menu:{keys:['cut-1']}},
      {id:'ev-B', name:'בר', menu:{keys:['cut-1']}}
    ]);
    store.set('mk-menuqty-ev-A', {'cut-1':4000});   // 4 kg
    store.set('mk-menuqty-ev-B', {'cut-1':2500});   // 2.5 kg
    const cd = crossEventShopData();
    const brisket = cd.items.find(i=>i.key==='cut-1');
    return { itemCount: cd.items.length, eventCount: cd.eventCount, totalKg: brisket && brisket.totalKg, brkCount: brisket && brisket.events.length };
  })()`) as any;
  expect(d.eventCount).toBe(2);
  expect(d.itemCount).toBe(1);       // same cut merged into one line
  expect(d.totalKg).toBeCloseTo(6.5, 1);   // 4 + 2.5 summed across events
  expect(d.brkCount).toBe(2);        // per-event breakdown retained
});

test('E5: the consolidated cart renders grouped lines with a unified xshop tick', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){
    store.set('mk-events', [{id:'ev-A', name:'חתונה', menu:{keys:['cut-1']}}, {id:'ev-B', name:'בר', menu:{keys:['cut-1']}}]);
    openCrossEventCart();
  })()`);
  await page.waitForSelector('[data-xshop]');
  const has = await page.evaluate(`document.querySelectorAll('[data-xshop]').length`);
  expect(has).toBeGreaterThan(0);
  // ticking persists to an xshop: key
  await page.evaluate(`document.querySelector('[data-xshop]').click()`);
  const anyTicked = await page.evaluate(`(function(){ for(let i=0;i<localStorage.length;i++){ if((localStorage.key(i)||'').indexOf('xshop:')===0 && store.get(localStorage.key(i))) return true; } return false; })()`);
  expect(anyTicked).toBe(true);
});

test('F: plan checkboxes persist by task identity across a rebuild', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlview','plan'); setTlShape('1');
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0}); })()`);
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('.wp-ck[data-wpck]');
  // check the first task, then force a rebuild and confirm it stays checked
  const key = await page.evaluate(`document.querySelector('.wp-ck[data-wpck]').dataset.wpck`);
  await page.evaluate(`(function(k){ const cb=document.querySelector('.wp-ck[data-wpck="'+k+'"]'); cb.checked=true; cb.dispatchEvent(new Event('change')); })(${JSON.stringify(key)})`);
  await page.evaluate(`openTimeline()`);   // rebuild
  await page.waitForSelector('.wp-ck[data-wpck]');
  const stillChecked = await page.evaluate(`(function(k){ const cb=document.querySelector('.wp-ck[data-wpck="'+k+'"]'); return cb? cb.checked : null; })(${JSON.stringify(key)})`);
  expect(stillChecked).toBe(true);
});

test('F: the plan marks a now/next task', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlview','plan'); setTlShape('1');
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0}); })()`);
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('.workplan');
  expect(await page.evaluate(`!!document.querySelector('.wp-row.wp-next')`)).toBe(true);
});
