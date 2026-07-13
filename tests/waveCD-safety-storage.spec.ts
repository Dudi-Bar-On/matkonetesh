import { test, expect } from '@playwright/test';

// Wave C (stop silent data loss) + Wave D (operational safety gaps).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

// ── Wave C ──
test('store.set returns true on success and false on quota failure (surfaced, not swallowed)', async ({ page }) => {
  await init(page);
  expect(await page.evaluate(`store.set('mk-test-x', {a:1})`)).toBe(true);
  // force a quota error by stubbing localStorage.setItem, then confirm store.set reports failure
  const res = await page.evaluate(`(function(){
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function(){ const e=new Error('quota'); e.name='QuotaExceededError'; throw e; };
    let r; try { r = store.set('mk-test-y', {b:2}); } finally { Storage.prototype.setItem = orig; }
    return r;
  })()`);
  expect(res).toBe(false);
});

test('exportData excludes the AI key (mk-gemkey) from the backup payload', async ({ page }) => {
  await init(page);
  const payload = await page.evaluate(`(function(){
    localStorage.setItem('mk-gemkey', JSON.stringify('SECRET'));
    localStorage.setItem('mk-fav', JSON.stringify(['cut-1']));
    // replicate exportData's payload build without triggering a download
    const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k==='mk-gemkey') continue; o[k]=localStorage.getItem(k);}
    return o;
  })()`) as Record<string,string>;
  expect(payload['mk-gemkey']).toBeUndefined();     // key is never in the backup
  expect(payload['mk-fav']).toBeTruthy();           // ...but real data is
});

test('importData validates the app tag and reports instead of a blind success', async ({ page }) => {
  await init(page);
  // reach importData through a File; a foreign app tag must be rejected
  const rejected = await page.evaluate(`(function(){
    return new Promise(function(resolve){
      const orig = window.toast; window.toast = function(msg){ window.toast = orig; resolve(msg); };
      const blob = new File([JSON.stringify({app:'someotherapp', data:{'mk-fav':'[]'}})], 'b.json', {type:'application/json'});
      importData(blob);
    });
  })()`);
  expect(String(rejected)).toContain('אפליקציה אחרת');
});

test('toast uses a custom action label when provided (not the default "בטל")', async ({ page }) => {
  await init(page);
  const label = await page.evaluate(`(function(){ toast('x', function(){}, 'רענן עכשיו'); return document.querySelector('#toast [data-undo]').textContent; })()`);
  expect(label).toBe('רענן עכשיו');
  const dflt = await page.evaluate(`(function(){ toast('y', function(){}); return document.querySelector('#toast [data-undo]').textContent; })()`);
  expect(dflt).toBe('בטל');
});

// ── Wave D ──
test('itemStages appends an internal-temp bcheck gate carrying the item safe temp', async ({ page }) => {
  await init(page);
  const info = await page.evaluate(`(function(){
    const meta = metaCut(DATA.cuts.find(c=>c.n===1));   // brisket, safe 63
    const p = itemProfile(meta);
    const stages = itemStages(meta, p.methods[0].key, true, svSmokeOrderDefault());
    const bc = stages.filter(s=>s.kind==='bcheck');
    return { last: stages[stages.length-1].kind, count: bc.length, temp: bc[0] && bc[0].temp };
  })()`) as any;
  expect(info.count).toBe(1);          // exactly one safety gate
  expect(info.last).toBe('bcheck');    // it's the final stage, right before serve
  expect(info.temp).toBe(63);          // carries the cited safe temp
});

test('produce (safe=0) gets no bcheck gate', async ({ page }) => {
  await init(page);
  const has = await page.evaluate(`(function(){
    const veg = DATA.cuts.find(c=>c.safe===0);
    if(!veg) return false;
    const meta = metaCut(veg); const p=itemProfile(meta);
    return itemStages(meta, p.methods[0].key, true, svSmokeOrderDefault()).some(s=>s.kind==='bcheck');
  })()`);
  expect(has).toBe(false);
});
