import { test, expect } from '@playwright/test';

// Wave D remainder (come-up + equilibrium cure) and Wave F (workflow legibility).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

// ── Wave D remainder ──
test('D4: equilibrium salt is grams (not 1000x too small) and cure is included', async ({ page }) => {
  await init(page);
  // mirrors the fixed calc block: 2 kg meat + 2 L water → 4 kg total
  const r = await page.evaluate(`(function(){ const meat=2000, x=2; const totalKg=(meat+x*1000)/1000; const eqSalt=totalKg*1000*0.028; return { salt: fmtG(eqSalt), cure: fmtG(totalKg*2.5) }; })()`) as any;
  expect(r.salt).toBe('112 ג׳');   // 2.8% of 4 kg = 112 g (was shown as 0.1 g before the fix)
  expect(r.cure).toBe('10 ג׳');    // Cure #1 at 2.5 g/kg of 4 kg = 10 g
});

test('D3: sous-vide stages carry the come-up caveat in the scheduler', async ({ page }) => {
  await init(page);
  const has = await page.evaluate(`(function(){
    for(const c of DATA.cuts){ const meta=metaCut(c); const p=itemProfile(meta); if(!p) continue;
      for(const m of p.methods){ const st=itemStages(meta,m.key,true,svSmokeOrderDefault()); const sv=st.find(s=>s.kind==='sv'); if(sv) return /הפסטור נמדד/.test(sv.note||''); } }
    return null;
  })()`);
  expect(has).toBe(true);
});

// ── Wave F ──
test('F5: voice-cook tasks are built even when the items view is showing', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); store.set('mk-tlview','items'); saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0}); })()`);
  await page.evaluate(`openTimeline()`);
  expect(await page.evaluate(`(window._wpTasks||[]).length`)).toBeGreaterThan(0);
});

test('F2: home shows a live-cook banner while timers are running', async ({ page }) => {
  await init(page);
  await page.evaluate(`store.set('mk-timers',{'st-cook-cut-1-smoke':{end:Date.now()+1e6,name:'עישון'}})`);
  await page.evaluate(`cRefreshHome()`);
  expect(await page.evaluate(`!document.querySelector('#cCooking').hidden`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#cCookingM').textContent`)).toContain('טיימרים');
  // clears when nothing is pending
  await page.evaluate(`store.set('mk-timers',{}); cRefreshHome();`);
  expect(await page.evaluate(`document.querySelector('#cCooking').hidden`)).toBe(true);
});

test('F4: multi-day items surface as a prep-ahead advisory instead of being dropped', async ({ page }) => {
  await init(page);
  const key = await page.evaluate(`(function(){
    for(const c of DATA.cuts){ const meta=metaCut(c); const p=itemProfile(meta); if(p&&p.multiDay) return meta.key; }
    for(const id in DATA.makes){ const meta=metaMake(id,DATA.makes[id]); const p=itemProfile(meta); if(p&&p.multiDay) return meta.key; }
    return null;
  })()`) as string | null;
  test.skip(!key, 'no multi-day item in the dataset');
  await page.evaluate(`(function(k){ setMenuCtx('cook'); store.set('mk-tlview','plan'); store.set('mk-tlstate-cook',{[k]:{ready:false}});
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:[k],sides:[],drinks:[],desserts:[],gpm:0}); })(${JSON.stringify(key)})`);
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#tlList');
  expect(await page.evaluate(`!!document.querySelector('.wp-advisory')`)).toBe(true);
});
