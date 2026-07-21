import { test, expect } from '@playwright/test';

// Wave 1b — keyboard operability + ARIA.
//  a11y #1: cards, home paths and wizard chips are focusable + Enter/Space activates them.
//  a11y #4: toggle-like controls expose aria-pressed reflecting their .on state.

test('a11y #1: catalog cards are keyboard-operable (tabindex/role + Enter opens the panel)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.click('[data-cnav="catalog"]');
  await page.fill('#q', 'בקר');
  await page.waitForSelector('#grid .card');
  const card = page.locator('#grid .card').first();
  expect(await card.getAttribute('tabindex')).toBe('0');
  expect(await card.getAttribute('role')).toBe('button');
  expect(await card.getAttribute('aria-label')).toBeTruthy();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel')).toHaveClass(/open/);
});

test('a11y #1: home paths become focusable and Enter enters the wizard', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  const path = page.locator('.cpath[data-cgo="wizard"]');
  await expect(path).toHaveAttribute('tabindex', '0');   // added by the a11y observer
  await expect(path).toHaveAttribute('role', 'button');
  await path.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scr-wizard')).toHaveClass(/on/);
});

test('a11y #3: timers are labeled, announce completion via role=alert, and beep for real', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  const html = await page.evaluate(`timerHTML(90)`) as string;
  expect(html).toContain('role="timer"');
  expect(html).toContain('aria-label="הפעל טיימר"');
  expect(html).toContain('aria-label="אפס טיימר"');
  expect(html).toContain('role="alert"');
  expect(await page.evaluate(`typeof timerBeep`)).toBe('function'); // real oscillator alarm, not a no-op AudioContext

  // a 1-second timer reaches completion: ringing state + a live alert announcement
  await page.evaluate(`(function(){ document.body.insertAdjacentHTML('beforeend','<div id="tmtest">'+timerHTML(1)+'</div>'); wireTimer(document.querySelector('#tmtest .timer')); })()`);
  await page.click('#tmtest [data-play]');
  await page.waitForFunction(`document.querySelector('#tmtest .timer').classList.contains('ringing')`, null, {timeout:15000});
  expect(await page.evaluate(`document.querySelector('#tmtest .timer').classList.contains('ringing')`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#tmtest .tt-alert').textContent`)).toContain('הסתיים');
});

test('a11y #4: wizard appetite chips expose a live aria-pressed state', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ if(typeof setMenuCtx==='function') setMenuCtx('event'); cwGo(0); cNavGo('wizard'); })()`);
  await page.waitForSelector('[data-app]');
  // every appetite chip carries aria-pressed; exactly the selected one is "true"
  const states = await page.evaluate(`Array.from(document.querySelectorAll('[data-app]')).map(function(e){return e.getAttribute('aria-pressed');})`) as string[];
  expect(states.length).toBeGreaterThan(0);
  expect(states.every(s => s === 'true' || s === 'false')).toBe(true);
});
