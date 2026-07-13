import { test, expect } from '@playwright/test';

// Wave E6 (data-safety): switching events must never lose unsaved work, and must be explicit.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('E6: switching to an event from an unsaved draft snapshots it with a restore-undo', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){
    setMenuCtx('cook'); store.set('mk-active', null);
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-2'],sides:[],drinks:[],desserts:[],gpm:0});   // a draft (content, no active)
    store.set('mk-events', [{id:'ev-A', name:'חתונה', serve:'19:00', menu:{keys:['cut-1']}}]);
  })()`);
  await page.evaluate(`evLoad('ev-A')`);
  expect(await page.evaluate(`store.get('mk-active')`)).toBe('ev-A');
  expect(await page.evaluate(`menuState().keys.join(',')`)).toContain('cut-1');   // now showing the event
  // the switch is explicit + offers to restore the draft
  expect(await page.evaluate(`document.querySelector('#toast').textContent`)).toContain('חתונה');
  expect(await page.evaluate(`document.querySelector('#toast [data-undo]').textContent`)).toBe('שחזר טיוטה');
  // undo restores the draft (cut-2, no active)
  await page.evaluate(`document.querySelector('#toast [data-undo]').click()`);
  expect(await page.evaluate(`menuState().keys.join(',')`)).toContain('cut-2');
  expect(await page.evaluate(`store.get('mk-active')`)).toBeFalsy();
});

test('E6: switching away from an active event persists its edits (no loss)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){
    store.set('mk-events', [
      {id:'ev-A', name:'A', serve:'19:00', menu:{guests:8,keys:['cut-1']}},
      {id:'ev-B', name:'B', serve:'18:00', menu:{guests:8,keys:['cut-2']}}
    ]);
  })()`);
  await page.evaluate(`evLoad('ev-A')`);                    // active A
  await page.evaluate(`(function(){ const m=menuState(); m.keys=['cut-1','cut-3']; saveMenu(m); })()`);   // edit A
  await page.evaluate(`evLoad('ev-B')`);                    // switch → A's edits must be saved to its record
  const aKeys = await page.evaluate(`(evList().find(e=>e.id==='ev-A').menu.keys||[]).join(',')`);
  expect(aKeys).toContain('cut-3');                         // edit survived the switch
  expect(await page.evaluate(`store.get('mk-active')`)).toBe('ev-B');
});

test('E6: an explicit switch toast names the event even with no draft to rescue', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ store.set('mk-events', [{id:'ev-A', name:'ברית', serve:'12:00', menu:{keys:['cut-1']}}]); })()`);
  await page.evaluate(`evLoad('ev-A')`);
  expect(await page.evaluate(`document.querySelector('#toast').textContent`)).toContain('ברית');
  expect(await page.evaluate(`!!document.querySelector('#toast [data-undo]')`)).toBe(false);   // nothing to undo
});
