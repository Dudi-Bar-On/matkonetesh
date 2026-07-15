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

test('W2-P2: stall detection helper + advisory card during smoke stages', async ({ page }) => {
  await bootCopilot(page);
  // helper classification (65-77°C band) + bilingual
  expect(await page.evaluate(`copilotStallInfo(70).phase`)).toBe('stall');
  expect(await page.evaluate(`copilotStallInfo(70).inStall`)).toBe(true);
  expect(await page.evaluate(`copilotStallInfo(50).phase`)).toBe('below');
  expect(await page.evaluate(`copilotStallInfo(90).phase`)).toBe('above');
  const body = await page.evaluate(`copilotStallInfo(70).body`) as string;
  expect(/[֐-׿]/.test(body)).toBe(false);   // English body in English UI
  expect(body).toContain('Crutch');
  // the stall card shows when the current stage is a smoke stage
  await page.evaluate(`startLiveCook(); window._wpTasks=[{t:new Date(Date.now()-1000),label:'Smoke',sub:'',dur:3600,tid:'st-cook-cut-1-smoke',kind:'smoke'},{t:new Date(Date.now()+3600000),label:'Rest',sub:'',dur:0,tid:'',kind:'rest'}]; openCopilot();`);
  await page.waitForSelector('#panel .cop-stall');
  await page.evaluate(`closePanel()`);
  // ...but NOT when the current/next stage isn't smoke
  await page.evaluate(`window._wpTasks=[{t:new Date(Date.now()-1000),label:'Rest',sub:'',dur:0,tid:'',kind:'rest'}]; openCopilot();`);
  await page.waitForSelector('#panel .cop-actions');
  expect(await page.evaluate(`!!document.querySelector('#panel .cop-stall')`)).toBe(false);
  await page.evaluate(`closePanel()`);
  // a probe reading in the stall band → the "in the stall" state (cop-stall-on + the temp shown)
  await page.evaluate(`(function(){ var s=liveSession(); s.probes=[{t:Date.now(),tempC:71}]; store.set(liveKey(), s); window._wpTasks=[{t:new Date(Date.now()-1000),label:'Smoke',sub:'',dur:3600,tid:'st-cook-cut-1-smoke',kind:'smoke'}]; openCopilot(); })()`);
  await page.waitForSelector('#panel .cop-stall-on');
  expect(await page.evaluate(`document.querySelector('#panel .cop-stallh').textContent`)).toContain('71');
});
