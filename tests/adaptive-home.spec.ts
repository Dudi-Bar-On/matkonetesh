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

const FULLGEAR = `store.set('mk-gear-set',true); store.set('mk-gear',{smoker:'אופסט / סטיק-ברנר',grill:'פחם',sousvide:'סו-ויד',thermo:'מדחום',grinder:'מטחנה',stuffer:'מזרק'});`;

test('adaptive home Phase 3: gear-gated quick-pick lanes jump straight to a cut, no dead chips, no h-scroll', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  // full-gear (Pitmaster) → all three lanes
  await page.evaluate(`(function(){ ${FULLGEAR} cNavGo('home'); })()`);
  await page.waitForSelector('.chome-lanes .lane');
  expect(await page.evaluate(`document.querySelectorAll('.chome-lanes .lane').length`)).toBe(3);
  expect(await page.evaluate(`!!document.querySelector('.lane-smoke') && !!document.querySelector('.lane-grill') && !!document.querySelector('.lane-sv')`)).toBe(true);
  // every chip resolved to a real cut (the resolveItem guard) — expected counts per lane
  expect(await page.evaluate(`document.querySelectorAll('.lane-smoke .lane-chip').length`)).toBe(7);
  expect(await page.evaluate(`document.querySelectorAll('.lane-grill .lane-chip').length`)).toBe(7);
  expect(await page.evaluate(`document.querySelectorAll('.lane-sv .lane-chip').length`)).toBe(6);
  // English mode → English cut names, no Hebrew leak
  const names = await page.evaluate(`Array.from(document.querySelectorAll('.chome-lanes .lane-chip')).map(b=>b.textContent).join('|')`) as string;
  expect(/[֐-׿]/.test(names)).toBe(false);
  expect(names).toContain('Brisket');
  // the rail scrolls on its own — the page body does NOT scroll horizontally at 390px
  expect(await page.evaluate(`document.body.scrollWidth <= window.innerWidth + 1`)).toBe(true);
  // a chip is the single-cut fast lane: tap → the cut panel opens (skips the wizard)
  await page.click('.lane-smoke .lane-chip:first-child');
  await page.waitForSelector('#panel.open .panel-top h2');
  expect(await page.evaluate(`document.querySelector('#panel .panel-top h2').textContent`)).toContain('Brisket');
  expect(await page.evaluate(`document.querySelector('#scr-wizard').classList.contains('on')`)).toBe(false);
  await page.evaluate(`closePanel()`);
  // default persona (no sous-vide) → no 💧 lane
  await page.evaluate(`(function(){ store.set('mk-gear',{smoker:'מעשנה',grill:'גריל',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'}); cNavGo('home'); })()`);
  await page.waitForSelector('.chome-lanes .lane');
  expect(await page.evaluate(`document.querySelectorAll('.chome-lanes .lane').length`)).toBe(2);
  expect(await page.evaluate(`!document.querySelector('.lane-sv')`)).toBe(true);
  // Hebrew mode → Hebrew names re-rendered (no English leak in the smoker lane)
  await page.evaluate(`(function(){ ${FULLGEAR} store.set('mk-lang','he'); applyLang(); cNavGo('home'); })()`);
  await page.waitForSelector('.lane-smoke .lane-chip');
  const heNames = await page.evaluate(`Array.from(document.querySelectorAll('.lane-smoke .lane-chip')).map(b=>b.textContent).join('|')`) as string;
  expect(/בריסקט/.test(heNames)).toBe(true);
});

test('adaptive home Phase 3: editing gear from Home re-gates the lanes on panel close (no nav needed)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  await page.evaluate(`(function(){ ${FULLGEAR} cNavGo('home'); })()`);
  await page.waitForSelector('.lane-sv');
  expect(await page.evaluate(`document.querySelectorAll('.chome-lanes .lane').length`)).toBe(3);
  // open "My gear" from Home and turn sous-vide off, like a real user
  await page.evaluate(`openGear()`);
  await page.waitForSelector('#panel.open [data-gear="sousvide"]');
  await page.selectOption('#panel [data-gear="sousvide"]', 'אין');
  await page.click('#gearDone');   // Save and close
  await page.waitForTimeout(150);
  // home re-gated on close WITHOUT any navigation: the 💧 lane is gone
  expect(await page.evaluate(`document.querySelector('#scr-home').classList.contains('on')`)).toBe(true);
  expect(await page.evaluate(`!document.querySelector('.lane-sv')`)).toBe(true);
  expect(await page.evaluate(`document.querySelectorAll('.chome-lanes .lane').length`)).toBe(2);
});

test('adaptive home Phase 4: gear chip + multi-event bar + pro pit-tools dock (with negative gating)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-uilevel', JSON.stringify('pro'));
    localStorage.setItem('mk-events', JSON.stringify([
      {id:'ev-a',name:'Fri BBQ',serve:'19:00',date:'2026-07-20',menu:{guests:8,keys:['cut-1']}},
      {id:'ev-b',name:'Sat BBQ',serve:'19:00',date:'2026-07-20',menu:{guests:6,keys:['cut-1']}}
    ])); } catch {} });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  await page.evaluate(`(function(){ ${FULLGEAR} cNavGo('home'); })()`);
  await page.waitForSelector('.chome-lanes .lane');
  // gear chip: configured → visible, English, no Hebrew leak
  expect(await page.evaluate(`document.querySelector('#cHomeGearChip').hidden`)).toBe(false);
  const gc = await page.evaluate(`document.querySelector('#cHomeGearChip').textContent`) as string;
  expect(/[֐-׿]/.test(gc)).toBe(false); expect(gc).toContain('My gear');
  // once configured, the chip replaces the boot "set up your gear" banner (no stale duplicate)
  expect(await page.evaluate(`document.querySelector('#cGearBanner').children.length`)).toBe(0);
  // multi-event bar: 2 events → visible with count, English
  expect(await page.evaluate(`document.querySelector('#cHomeMultiEv').hidden`)).toBe(false);
  const mv = await page.evaluate(`document.querySelector('#cHomeMultiEv').textContent`) as string;
  expect(mv).toContain('2 cookouts'); expect(/[֐-׿]/.test(mv)).toBe(false);
  // pit-tools dock: pro → 4 tools, English, no h-scroll
  expect(await page.evaluate(`document.querySelector('#cHomeDock').hidden`)).toBe(false);
  expect(await page.evaluate(`document.querySelectorAll('#cHomeDock .dockbtn').length`)).toBe(4);
  // no dead buttons: every dock action resolves to a real function
  expect(await page.evaluate(`Array.from(document.querySelectorAll('#cHomeDock .dockbtn')).every(b=>typeof window[b.dataset.hfn]==='function')`)).toBe(true);
  const dk = await page.evaluate(`document.querySelector('#cHomeDock').textContent`) as string;
  expect(/[֐-׿]/.test(dk)).toBe(false); expect(dk).toContain('Pitmaster');
  expect(await page.evaluate(`document.body.scrollWidth <= window.innerWidth + 1`)).toBe(true);
  // a dock button opens its tool (Salt/cure calc)
  await page.click('#cHomeDock .dockbtn:first-child');
  await page.waitForSelector('#panel.open .panel-top h2, #panel.open h2');
  expect(await page.evaluate(`document.querySelector('#panel h2').textContent`)).toContain('Calculators');
  await page.evaluate(`closePanel()`);
  // multi-event bar → the combined command center
  await page.click('#cHomeMultiEv');
  await page.waitForSelector('#panel.open .cet-row, #panel.open .shop-empty');
  await page.evaluate(`closePanel()`);
  // NEGATIVE gating: not pro → no dock; <2 events → no bar; gear unconfigured → no chip
  await page.evaluate(`(function(){ store.set('mk-uilevel','mid'); store.set('mk-events',[{id:'ev-a',name:'BBQ',serve:'19:00',menu:{guests:8,keys:['cut-1']}}]); store.set('mk-gear-set',false); cNavGo('home'); })()`);
  await page.waitForTimeout(120);
  expect(await page.evaluate(`document.querySelector('#cHomeDock').hidden`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#cHomeMultiEv').hidden`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#cHomeGearChip').hidden`)).toBe(true);
});

test('adaptive home Phase 4: projects card demotes when there is no charcuterie gear', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  // charcuterie gear present → full project card (description shown)
  await page.evaluate(`(function(){ ${FULLGEAR} cNavGo('home'); })()`);
  expect(await page.evaluate(`document.body.classList.contains('gear-noproj')`)).toBe(false);
  expect(await page.evaluate(`getComputedStyle(document.querySelector('#cPathProj p')).display`)).not.toBe('none');
  // no grinder/stuffer → demoted to a slim card (description hidden), still present + tappable
  await page.evaluate(`(function(){ store.set('mk-gear',{smoker:'מעשנה',grill:'גריל',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'}); cNavGo('home'); })()`);
  expect(await page.evaluate(`document.body.classList.contains('gear-noproj')`)).toBe(true);
  expect(await page.evaluate(`getComputedStyle(document.querySelector('#cPathProj p')).display`)).toBe('none');
  expect(await page.evaluate(`!document.querySelector('#cPathProj').hidden`)).toBe(true);
});

test('adaptive home Phase 4: gear banner <-> chip stay symmetric across (un)configure (e.g. full reset)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gear-set', JSON.stringify(true)); localStorage.setItem('mk-gear', JSON.stringify({smoker:'מעשנה',grill:'גריל',sousvide:'אין',thermo:'אין',grinder:'אין',stuffer:'אין'})); } catch {} });
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cRefreshHome==='function'`);
  await page.evaluate(`cNavGo('home')`); await page.waitForTimeout(80);
  // configured → chip shown, no set-up banner
  expect(await page.evaluate(`!document.querySelector('#cHomeGearChip').hidden`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#cGearBanner').children.length`)).toBe(0);
  // gear becomes unconfigured (as a full data reset does) → the set-up banner comes BACK, chip hides
  await page.evaluate(`(function(){ store.set('mk-gear-set',false); cRefreshHome(); })()`); await page.waitForTimeout(80);
  expect(await page.evaluate(`document.querySelector('#cHomeGearChip').hidden`)).toBe(true);
  expect(await page.evaluate(`!!document.querySelector('#cGearBanner #gearBanner')`)).toBe(true);
  expect(/[֐-׿]/.test(await page.evaluate(`document.querySelector('#cGearBanner').textContent`) as string)).toBe(false);   // English, no leak
  await page.click('#cGearBanner #gearBanner');   // opens the gear editor
  await page.waitForSelector('#panel.open [data-gear="sousvide"]');
  await page.evaluate(`closePanel()`);
  // re-configure → chip returns, banner clears again
  await page.evaluate(`(function(){ store.set('mk-gear-set',true); cRefreshHome(); })()`); await page.waitForTimeout(80);
  expect(await page.evaluate(`!document.querySelector('#cHomeGearChip').hidden`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#cGearBanner').children.length`)).toBe(0);
});
