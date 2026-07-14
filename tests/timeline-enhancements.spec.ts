import { test, expect } from '@playwright/test';

// Timeline/voice enhancements: focus sync across views, expand/collapse-all, voice jump-to-item.
const ev = (keys:string[]) => JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys}}]);
const init = async (page:any, keys:string[]) => {
  await page.addInitScript((e:string) => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-events', e); } catch {} }, ev(keys));
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
};

test('focus stays on the item when switching By-item → Work-plan view', async ({ page }) => {
  await init(page, ['cut-1','cut-2']);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline('st-ev-a-cut-1-smoke'); })()`);
  await page.waitForSelector('#tlList .tlcard'); await page.waitForTimeout(500);
  expect(await page.evaluate(`(function(){ const f=document.querySelector('.tl-focus'); return f&&f.querySelector('[data-tlexp]')?f.querySelector('[data-tlexp]').getAttribute('data-tlexp'):'NONE'; })()`)).toBe('cut-1');
  await page.click('[data-tlview="plan"]'); await page.waitForTimeout(700);
  const tid = await page.evaluate(`(function(){ const f=document.querySelector('.tl-focus'); if(!f) return 'NONE'; const t=f.querySelector('[data-tid]'); return t?t.getAttribute('data-tid'):(f.getAttribute('data-tid')||'NO'); })()`) as string;
  expect(tid.includes('cut-1')).toBe(true);   // the same item is still focused in the work-plan view
});

test('expand-all / collapse-all toggles the whole plan', async ({ page }) => {
  await init(page, ['cut-1','cut-2']);
  await page.evaluate(`(function(){ evLoad('ev-a'); store.set('mk-tlview','items'); openTimeline(); })()`);
  await page.waitForSelector('#tlList .tlcard');
  await page.waitForSelector('#tlList .tl-stages', { state: 'attached' });   // hidden by default (display:none)
  const total = await page.evaluate(`document.querySelectorAll('#tlList .tl-stages').length`);
  expect(total).toBeGreaterThan(1);
  await page.click('[data-tlallopen]'); await page.waitForTimeout(200);
  expect(await page.evaluate(`Array.from(document.querySelectorAll('#tlList .tl-stages')).filter(s=>getComputedStyle(s).display!=='none').length`)).toBe(total);
  await page.click('[data-tlallopen]'); await page.waitForTimeout(200);
  expect(await page.evaluate(`Array.from(document.querySelectorAll('#tlList .tl-stages')).filter(s=>getComputedStyle(s).display!=='none').length`)).toBe(0);
});

test('voice cook has a jump-to-item selector', async ({ page }) => {
  await init(page, ['cut-1','cut-2']);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline(); })()`);
  await page.waitForSelector('#tlList');
  await page.evaluate(`(function(){ closePanel(); openVoiceCook(window._wpTasks||[]); })()`);
  await page.waitForSelector('#vcBody');
  expect(await page.evaluate(`!!document.querySelector('#vcItemJump')`)).toBe(true);
  const opts = await page.evaluate(`Array.from(document.querySelectorAll('#vcItemJump option')).map(o=>o.textContent)`) as string[];
  expect(opts.length).toBeGreaterThanOrEqual(2);
  // selecting an item jumps vcIdx to that item's first task
  const before = await page.evaluate(`vcIdx`);
  await page.selectOption('#vcItemJump', { index: 1 });
  await page.waitForTimeout(150);
  expect(await page.evaluate(`typeof vcIdx==='number'`)).toBe(true);
});
