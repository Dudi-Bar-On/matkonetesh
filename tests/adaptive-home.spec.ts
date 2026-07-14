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
