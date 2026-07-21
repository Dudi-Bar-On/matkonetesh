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
  await page.waitForSelector('#tlList .tlcard');
  await page.waitForFunction(`!!document.querySelector('.tl-focus')`);
  // the flash now lands on the exact stage row inside the card; it belongs to cut-1
  expect(await page.evaluate(`(function(){ const f=document.querySelector('.tl-focus'); if(!f) return 'NONE'; const card=f.closest('.tlcard'); const xb=card&&card.querySelector('[data-tlexp]'); return xb?xb.getAttribute('data-tlexp'):'NONE'; })()`)).toBe('cut-1');
  await page.click('[data-tlview="plan"]');
  await page.waitForFunction(`!!document.querySelector('#tlList .workplan') && !!document.querySelector('.tl-focus')`);
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
  await page.click('[data-tlallopen]');
  await page.waitForFunction(`Array.from(document.querySelectorAll('#tlList .tl-stages')).filter(function(x){return getComputedStyle(x).display!=='none';}).length===${total}`);
  expect(await page.evaluate(`Array.from(document.querySelectorAll('#tlList .tl-stages')).filter(s=>getComputedStyle(s).display!=='none').length`)).toBe(total);
  await page.click('[data-tlallopen]');
  await page.waitForFunction(`Array.from(document.querySelectorAll('#tlList .tl-stages')).filter(function(x){return getComputedStyle(x).display!=='none';}).length===0`);
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
  await page.waitForFunction(`vcIdx===4`);
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
  await page.waitForSelector('#tlList .workplan');
  await page.waitForFunction(`document.querySelectorAll('#tlList [data-tlitem="cut-2"]').length>0`);
  // pick a cut-2 task that is NOT its first one (the exact class of bug we hit) and REALLY click it
  const clickedText = await page.evaluate(`(function(){ const els=Array.from(document.querySelectorAll('#tlList [data-tlitem="cut-2"]')); const el=els[els.length-1]; el.setAttribute('data-testpick','1'); return el.textContent.replace(/\\s+/g,' ').trim().slice(0,30); })()`);
  await page.locator('[data-testpick="1"]').click({ position: { x: 120, y: 10 } });   // click the body, away from the checkbox
  await page.waitForFunction(`document.querySelectorAll('#tlList .tl-sel').length===1`);
  // the EXACT tapped element is the single highlight
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('[data-testpick="1"]').classList.contains('tl-sel')`)).toBe(true);
  // clicking the row body did NOT toggle its done checkbox
  expect(await page.evaluate(`(function(){ const cb=document.querySelector('[data-testpick="1"] .wp-ck'); return cb?cb.checked:false; })()`)).toBe(false);
  // switch to By-item → the item's card is the single marker (cut-2)
  await page.click('[data-tlview="items"]');
  await page.waitForFunction(`!!document.querySelector('.tlcard.tl-sel [data-tlexp]')`);
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('.tlcard.tl-sel [data-tlexp]').getAttribute('data-tlexp')`)).toBe('cut-2');
  // back to work-plan → still a single marker on a cut-2 task
  await page.click('[data-tlview="plan"]');
  await page.waitForFunction(`!!document.querySelector('#tlList .workplan') && document.querySelectorAll('#tlList .tl-sel').length===1`);
  expect(await page.evaluate(`document.querySelectorAll('#tlList .tl-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('#tlList .tl-sel').getAttribute('data-tlitem')`)).toBe('cut-2');
});

test('view switch re-focuses the SELECTED task, not the item first task (grill≠sous-vide bug)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-tlview', JSON.stringify('plan'));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1','cut-2']}}])); } catch {} });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline(); })()`);
  await page.waitForSelector('#tlList .workplan');
  await page.waitForFunction(`document.querySelectorAll('#tlList [data-tlitem="cut-2"]').length>0`);
  // select a NON-first stage of cut-2 (its smoke task), by a real click
  await page.evaluate(`(function(){ const els=Array.from(document.querySelectorAll('#tlList [data-tlitem="cut-2"]')); const smoke=els.find(e=>/wp-smoke/.test(e.className)); smoke.setAttribute('data-pick','1'); })()`);
  await page.locator('[data-pick="1"]').click({ position: { x: 130, y: 12 } });
  await page.waitForFunction(`document.querySelectorAll('#tlList .tl-sel').length===1`);
  // round-trip the view
  await page.click('[data-tlview="items"]');
  await page.waitForFunction(`!!document.querySelector('#tlList .tlcard')`);
  await page.click('[data-tlview="plan"]');
  // this test asserts on BOTH the persistent .tl-sel and the transient .tl-focus flash, so wait for both —
  // waiting only for .tl-sel let the assertion run before the flash was applied.
  await page.waitForFunction(`!!document.querySelector('#tlList .workplan') && !!document.querySelector('#tlList .tl-sel') && !!document.querySelector('#tlList .tl-focus')`);
  // BOTH the persistent selection and the transient scroll/flash must be the SMOKE task, not sv
  const r = await page.evaluate(`(function(){ const kind=el=>el?((el.className.match(/wp-(sv|smoke|grill|rest|bcheck)/)||[])[1]||''):'NONE'; return { sel:kind(document.querySelector('#tlList .tl-sel')), flash:kind(document.querySelector('#tlList .tl-focus')) }; })()`) as any;
  expect(r.sel).toBe('smoke');     // persistent highlight on the selected task
  expect(r.flash).toBe('smoke');   // scroll/flash also lands on it (was 'sv' — the bug)
});

test('doneness scale is English in English mode (no Hebrew rare/medium/well)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-tlview', JSON.stringify('items')); localStorage.setItem('mk-tlplandetail', JSON.stringify('full'));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-108']}}])); } catch {} });   // cut-108 (Hanger) has a doneness scale
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline(); })()`);
  await page.waitForSelector('#tlList .tlcard');
  await page.evaluate(`document.querySelectorAll('#tlList .tl-stages').forEach(s=>s.style.display='block')`);
  await page.waitForFunction(`Array.from(document.querySelectorAll('#tlList .tl-stages')).filter(function(x){return getComputedStyle(x).display!=='none';}).length>0`);
  const heb = await page.evaluate(`(function(){ const r=document.querySelector('#tlList'); const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,null);const a=[];let n;while((n=w.nextNode())){const t=(n.nodeValue||'').trim(); if(/[֐-׿]/.test(t))a.push(t);} return a; })()`) as string[];
  expect(heb).toEqual([]);   // no Hebrew doneness labels leaking
});

test('coming from a specific step marks that step inside the by-item card', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-tlview', JSON.stringify('plan'));
    localStorage.setItem('mk-events', JSON.stringify([{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1','cut-2']}}])); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`(function(){ evLoad('ev-a'); openTimeline(); })()`);
  await page.waitForSelector('#tlList .workplan');
  await page.waitForFunction(`document.querySelectorAll('#tlList [data-tlitem="cut-2"]').length>0`);
  // select cut-2's SMOKE step in the work-plan
  const tid = await page.evaluate(`(function(){ const els=Array.from(document.querySelectorAll('#tlList [data-tlitem="cut-2"]')); const smoke=els.find(e=>/wp-smoke/.test(e.className)); smoke.setAttribute('data-pick','1'); return smoke.querySelector('[data-tid]').getAttribute('data-tid'); })()`) as string;
  await page.locator('[data-pick="1"]').click({ position: { x: 130, y: 12 } });
  await page.waitForFunction(`document.querySelectorAll('#tlList .tl-sel').length===1`);
  // go into the by-item view
  await page.click('[data-tlview="items"]');
  await page.waitForFunction(`document.querySelectorAll('.tl-step-sel').length===1`);
  // exactly one step is marked, and it is the one we came from
  expect(await page.evaluate(`document.querySelectorAll('.tl-step-sel').length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('.tl-step-sel [data-tid]').getAttribute('data-tid')`)).toBe(tid);
  // its card is selected and the steps are expanded (visible)
  expect(await page.evaluate(`document.querySelector('.tlcard.tl-sel [data-tlexp]').getAttribute('data-tlexp')`)).toBe('cut-2');
  expect(await page.evaluate(`getComputedStyle(document.querySelector('.tl-step-sel').closest('.tl-stages')).display`)).toBe('block');
});
