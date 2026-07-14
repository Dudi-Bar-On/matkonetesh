import { test, expect } from '@playwright/test';

// Adaptive home — Phase 0 plumbing: cRefreshHome stamps body classes by gear + level + live state.
const boot = async (page:any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
};
const cls = (page:any) => page.evaluate(`Array.from(document.body.classList).filter(c=>/^(is-cooking|gear-|lvl-)/.test(c)).sort().join(' ')`);

test('adaptive home: gear + level stamp the right body classes', async ({ page }) => {
  await boot(page);
  // default persona: smoker+grill, no sous-vide, no charcuterie, no probe, intermediate
  await page.evaluate(`(function(){ store.set('mk-gear-set',true); store.set('mk-gear',{smoker:'מעשנה',grill:'גריל',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'}); store.set('mk-uilevel','mid'); cRefreshHome(); })()`);
  expect(await cls(page)).toBe('gear-noprobe gear-noproj gear-nosv lvl-mid');
  // pitmaster: all gear + pro + a live timer → no demotion classes, is-cooking, lvl-pro
  await page.evaluate(`(function(){ store.set('mk-gear',{smoker:'אופסט / סטיק-ברנר',grill:'פחם',sousvide:'סו-ויד',thermo:'מדחום',grinder:'מטחנה',stuffer:'מזרק'}); store.set('mk-uilevel','pro'); store.set('mk-timers',{'st-x-cut-1-smoke':{end:Date.now()+3600000,name:'x'}}); cRefreshHome(); })()`);
  expect(await cls(page)).toBe('is-cooking lvl-pro');
  // beginner, grill-only, idle
  await page.evaluate(`(function(){ store.set('mk-gear',{smoker:'אין',grill:'גז',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'}); store.set('mk-uilevel','beginner'); store.set('mk-timers',{}); cRefreshHome(); })()`);
  expect(await cls(page)).toBe('gear-noprobe gear-noproj gear-nosv lvl-beg');
});

test('adaptive home: greeting is localized (no Hebrew leak in English mode)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`cRefreshHome()`);
  const g = await page.evaluate(`document.querySelector('#cGreet').textContent`) as string;
  expect(/[֐-׿]/.test(g)).toBe(false);
  expect(/morning|afternoon|evening/i.test(g)).toBe(true);
});

test('adaptive home Phase 1: merged hosting card + gear-aware kick, i18n round-trips', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gear-set', JSON.stringify(true)); localStorage.setItem('mk-gear', JSON.stringify({smoker:'מעשנה',grill:'גריל',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'})); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  await page.waitForTimeout(300);
  // two path cards now (merged hosting + project), the "or just cook" branch lives inside the hosting card, and the old chrome is gone
  expect(await page.evaluate(`document.querySelectorAll('#scr-home .cpaths .cpath').length`)).toBe(2);
  expect(await page.evaluate(`!!document.querySelector('.cpath.event #cPathCook')`)).toBe(true);
  expect(await page.evaluate(`!document.querySelector('.chome-sub') && !document.querySelector('.chome-credit-top')`)).toBe(true);
  // gear-aware kick (default persona has no sous-vide)
  expect(await page.evaluate(`document.querySelector('#cHomeKick').textContent`)).toBe('Smoke · Grill · Fire');
  // the two flows don't collide: card tap = new event; branch tap = cook (no double-fire)
  await page.evaluate(`document.querySelector('.cpath.event .pico').click()`); await page.waitForTimeout(120);
  expect(await page.evaluate(`menuCtx()`)).toBe('event');
  await page.evaluate(`cNavGo('home')`); await page.waitForTimeout(100);
  await page.evaluate(`document.querySelector('#cPathCook').click()`); await page.waitForTimeout(120);
  expect(await page.evaluate(`menuCtx()`)).toBe('cook');
  // adding a sous-vide brings the word back
  await page.evaluate(`(function(){ store.set('mk-gear',{smoker:'מעשנה',grill:'גריל',sousvide:'סו-ויד',thermo:'אין',grinder:'אין',stuffer:'אין'}); cNavGo('home'); })()`); await page.waitForTimeout(100);
  expect(await page.evaluate(`document.querySelector('#cHomeKick').textContent`)).toBe('Sous-vide · Smoke · Grill · Fire');
  // EN → HE → EN round-trips both the merged card title AND the kick (regression guard for the cloneNode _mkO bug)
  await page.evaluate(`(function(){ store.set('mk-gear',{smoker:'מעשנה',grill:'גריל',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'}); store.set('mk-lang','he'); applyLang(); cNavGo('home'); })()`); await page.waitForTimeout(150);
  expect(await page.evaluate(`document.querySelector('.cpath.event h3').textContent`)).toContain('מארח');
  expect(/סו-ויד/.test(await page.evaluate(`document.querySelector('#cHomeKick').textContent`))).toBe(false);
  // RTL: the "most-popular" badge sits on the leading (right) edge via inset-inline-start (resolves to `right` in RTL, `left` in LTR)
  const ptagHe = await page.evaluate(`(function(){ const cs=getComputedStyle(document.querySelector('.cpath.event .ptag')); return {left:cs.left, right:cs.right}; })()`);
  expect(ptagHe.right).toBe('16px');   // RTL: inset-inline-start resolves to the right (leading) edge
  await page.evaluate(`(function(){ store.set('mk-lang','en'); applyLang(); cNavGo('home'); })()`); await page.waitForTimeout(150);
  expect(await page.evaluate(`document.querySelector('.cpath.event h3').textContent`)).toBe('Hosting? Plan the cookout');
  const ptagEn = await page.evaluate(`(function(){ const cs=getComputedStyle(document.querySelector('.cpath.event .ptag')); return {left:cs.left, right:cs.right}; })()`);
  expect(ptagEn.left).toBe('16px');   // LTR: inset-inline-start resolves to the left (leading) edge
});

test('adaptive home Phase 2: a live cook lifts the banner to the top of the fold (gated on is-cooking)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  // a running timer = a live cook → the banner shows and body.is-cooking is stamped
  await page.evaluate(`(function(){ store.set('mk-timers',{'cut-1-sv-0':{end:Date.now()+3600000,name:'SV'}}); cNavGo('home'); })()`);
  await page.waitForSelector('#cCooking:not([hidden])');
  expect(await page.evaluate(`document.body.classList.contains('is-cooking')`)).toBe(true);
  const pos = await page.evaluate(`(function(){ const top=s=>document.querySelector(s).getBoundingClientRect().top;
    return { cook:top('#cCooking'), hero:top('.chome-hero'), ask:top('.chome-ask'), paths:top('.cpaths'), search:top('.chome-search'), header:top('.capp-top') }; })()`);
  // lifted above the hero, Ask-the-Fire, and the path cards...
  expect(pos.cook).toBeLessThan(pos.hero);
  expect(pos.cook).toBeLessThan(pos.ask);
  expect(pos.cook).toBeLessThan(pos.paths);
  // ...but still below the sticky header + search bar
  expect(pos.cook).toBeGreaterThan(pos.search);
  expect(pos.search).toBeGreaterThan(pos.header);
  // gating proof: with the banner still shown, dropping is-cooking returns it to its natural spot (below the hero)
  await page.evaluate(`document.body.classList.remove('is-cooking')`);
  const cook2 = await page.evaluate(`document.querySelector('#cCooking').getBoundingClientRect().top`);
  const hero2 = await page.evaluate(`document.querySelector('.chome-hero').getBoundingClientRect().top`);
  expect(cook2).toBeGreaterThan(hero2);
});
