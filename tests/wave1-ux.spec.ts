import { test, expect } from '@playwright/test';

// Wave 1a — core UX loop:
//  UX #1: the catalog is no longer a dead-end — a real add-to-menu control (wired to the
//         previously-orphaned toggleCart) sits on every card + the item panel.
//  UX #2: "continue where you left off" works for the Cook path (validates mk-cook, not mk-menu)
//         and the resume card returns you to the wizard, not the events list.

test('UX #1: add-to-menu from a catalog card puts the item in the plan (toggleCart is wired)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.click('[data-cnav="catalog"]');
  await page.fill('#q', 'בקר');                 // search populates #grid (default catalog is category tiles)
  await page.waitForSelector('#grid .card [data-addmenu]');
  expect(await page.evaluate(`(menuState().keys||[]).length`)).toBe(0);

  const btn = page.locator('#grid .card [data-addmenu]').first();
  const key = await btn.getAttribute('data-addmenu');
  await btn.click();
  expect(await page.evaluate(`menuHasKey(${JSON.stringify(key)})`)).toBe(true);
  expect(await page.evaluate(`(menuState().keys||[]).length`)).toBe(1);
  // the re-rendered button for this key reflects the pressed state
  const pressed = await page.evaluate(`(function(k){var b=document.querySelector('[data-addmenu="'+k+'"]');return b?b.getAttribute('aria-pressed'):null;})(${JSON.stringify(key)})`);
  expect(pressed).toBe('true');
});

test('UX #1: the item panel exposes an add-to-menu button too', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var c=DATA.cuts.find(function(x){return x.n===1}); openCut(c); })()`); // brisket panel
  await page.waitForSelector('#extras .exaddmenu');
  await page.click('#extras .exaddmenu');
  expect(await page.evaluate(`menuHasKey('cut-1')`)).toBe(true);
  expect(await page.evaluate(`(menuState().keys||[]).length`)).toBe(1);
});

test('UX #2: a Cook draft surfaces on home and resumes into the wizard (not the events list)', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-context', JSON.stringify('cook'));
      localStorage.setItem('mk-cook', JSON.stringify({ guests: 4, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }));
      localStorage.setItem('mk-cresume', JSON.stringify({ title: 'בישול', serv: 4, ctx: 'cook', step: 5, ts: 1 }));
    } catch {}
  });
  await page.goto('/index.html');
  await page.evaluate(`cRefreshHome()`);
  // previously stayed hidden because it validated mk-menu (empty in cook context)
  expect(await page.evaluate(`document.getElementById('cResume').hidden`)).toBe(false);

  await page.click('#cResume');
  expect(await page.evaluate(`menuCtx()`)).toBe('cook');                                   // context restored
  expect(await page.evaluate(`document.getElementById('scr-wizard').classList.contains('on')`)).toBe(true); // routed to the wizard, not events
});
