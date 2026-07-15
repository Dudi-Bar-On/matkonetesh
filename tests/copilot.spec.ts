import { test, expect } from '@playwright/test';

// Wave 2 — Live Cook Copilot.
const bootCopilot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof startLiveCook==='function' && typeof openCopilot==='function'`);
};

test('W2-P1: live cook session lifecycle + copilot shell (Now/Next stages)', async ({ page }) => {
  await bootCopilot(page);
  // start a live session → session stored + _liveCookState is live + the copilot panel opens
  await page.evaluate(`startLiveCook()`);
  expect(await page.evaluate(`!!liveSession()`)).toBe(true);
  expect(await page.evaluate(`_liveCookState().live`)).toBe(true);
  await page.waitForSelector('#panel .cop-actions');
  // renders Now/Next from the flattened work-plan tasks
  await page.evaluate(`window._wpTasks=[{t:new Date(Date.now()-1000),label:'Smoke the brisket',sub:'110C',dur:3600,tid:'st-cook-cut-1-smoke'},{t:new Date(Date.now()+3600000),label:'Wrap in foil',sub:'at 70C',dur:0,tid:''}]; openCopilot();`);
  await page.waitForSelector('#panel .cop-stage');
  const txt = await page.evaluate(`document.querySelector('#panel').textContent`) as string;
  expect(txt).toContain('Smoke the brisket');
  expect(txt).toContain('Now');
  expect(txt).toContain('Wrap in foil');
  expect(/[֐-׿]/.test(await page.evaluate(`document.querySelector('#panel .cop-stagek').textContent`) as string)).toBe(false);
  // end session → cleared
  await page.click('#copStop');
  await page.waitForTimeout(150);
  expect(await page.evaluate(`!!liveSession()`)).toBe(false);
});

test('W2-P1: the home cooking banner opens the Copilot when a live session exists', async ({ page }) => {
  await bootCopilot(page);
  await page.evaluate(`(function(){ startLiveCook(); closePanel(); cNavGo('home'); })()`);
  await page.waitForSelector('#cCooking:not([hidden])');
  await page.click('#cCooking');
  await page.waitForSelector('#panel .cop-hdr');
  expect(await page.evaluate(`!!document.querySelector('#panel .cop-hdr')`)).toBe(true);   // Copilot, not the Active-now hub
});
