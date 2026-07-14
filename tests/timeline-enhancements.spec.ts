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

test('voice cook has a jump-to-step selector that lists every task and jumps directly', async ({ page }) => {
  await init(page, ['cut-1','cut-2']);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline(); })()`);
  await page.waitForSelector('#tlList');
  await page.evaluate(`(function(){ closePanel(); openVoiceCook(window._wpTasks||[]); })()`);
  await page.waitForSelector('#vcBody');
  expect(await page.evaluate(`!!document.querySelector('#vcStepJump')`)).toBe(true);
  const nTasks = await page.evaluate(`vcTasks.length`) as number;
  const opts = await page.evaluate(`Array.from(document.querySelectorAll('#vcStepJump option')).length`) as number;
  expect(opts).toBe(nTasks);   // every step is listed, not just items
  // selecting a step jumps vcIdx straight to it
  await page.selectOption('#vcStepJump', { index: 4 });
  await page.waitForTimeout(150);
  expect(await page.evaluate(`vcIdx`)).toBe(4);
});

test('work-plan: a REAL tap highlights that exact task (not another), one marker, persists across views', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-tlview', JSON.stringify('plan'));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1','cut-2']}}])); } catch {} });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline('st-ev-a-cut-1-smoke'); })()`);
  await page.waitForSelector('#tlList .workplan'); await page.waitForTimeout(400);
  // pick a cut-2 task that is NOT its first one (the exact class of bug we hit) and REALLY click it
  const clickedText = await page.evaluate(`(function(){ const els=Array.from(document.querySelectorAll('#tlList [data-tlitem="cut-2"]')); const el=els[els.length-1]; el.setAttribute('data-testpick','1'); return el.textContent.replace(/\\s+/g,' ').trim().slice(0,30); })()`);
  await page.locator('[data-testpick="1"]').click({ position: { x: 120, y: 10 } });   // click the body, away from the checkbox
  await page.waitForTimeout(150);
  // the EXACT tapped element is the single highlight
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('[data-testpick="1"]').classList.contains('tl-sel')`)).toBe(true);
  // clicking the row body did NOT toggle its done checkbox
  expect(await page.evaluate(`(function(){ const cb=document.querySelector('[data-testpick="1"] .wp-ck'); return cb?cb.checked:false; })()`)).toBe(false);
  // switch to By-item → the item's card is the single marker (cut-2)
  await page.click('[data-tlview="items"]'); await page.waitForTimeout(500);
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('.tlcard.tl-sel [data-tlexp]').getAttribute('data-tlexp')`)).toBe('cut-2');
  // back to work-plan → still a single marker on a cut-2 task
  await page.click('[data-tlview="plan"]'); await page.waitForTimeout(500);
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('#tlList .tl-sel').getAttribute('data-tlitem')`)).toBe('cut-2');
});
