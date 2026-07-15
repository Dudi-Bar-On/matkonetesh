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

test('W2-P3: pace/ETA math — states, rate, projection, and verdict vs serve', async ({ page }) => {
  await bootCopilot(page);
  const pace = (s: any) => page.evaluate(`copilotPace(${JSON.stringify(s)})`);
  expect((await pace({ targetC: 95 }) as any).state).toBe('no-reading');
  expect((await pace({ probes: [{ t: 1000, tempC: 60 }] }) as any).state).toBe('no-target');
  expect((await pace({ probes: [{ t: 1000, tempC: 60 }], targetC: 95 }) as any).state).toBe('need-more');
  // 60→70 over 1h, target 95 → rate 10°C/h, 2.5h left, ETA at t=12,600,000
  const p = await pace({ probes: [{ t: 0, tempC: 60 }, { t: 3600000, tempC: 70 }], targetC: 95 }) as any;
  expect(p.state).toBe('projected'); expect(p.rate).toBe(10); expect(p.hoursLeft).toBe(2.5); expect(p.etaMs).toBe(12600000);
  // verdict vs a serve deadline
  expect((await pace({ probes: [{ t: 0, tempC: 60 }, { t: 3600000, tempC: 70 }], targetC: 95, serveTs: 12600000 - 30 * 60000 }) as any).verdict).toBe('behind');
  expect((await pace({ probes: [{ t: 0, tempC: 60 }, { t: 3600000, tempC: 70 }], targetC: 95, serveTs: 12600000 + 60 * 60000 }) as any).verdict).toBe('ahead');
  // stall: flat in the 65-77 band
  expect((await pace({ probes: [{ t: 0, tempC: 68 }, { t: 3600000, tempC: 68.5 }], targetC: 95 }) as any).state).toBe('stall');
  // done: at/above target
  expect((await pace({ probes: [{ t: 0, tempC: 96 }], targetC: 95 }) as any).state).toBe('done');
});

test('W2-P3: probe check-in UI logs a reading and updates the pace card', async ({ page }) => {
  await bootCopilot(page);
  await page.evaluate(`startLiveCook()`);
  await page.waitForSelector('#panel .cop-probe #copTarget');
  await page.fill('#panel #copTarget', '95');
  await page.click('#panel #copTargetSet');
  await page.waitForSelector('#panel #copProbe');
  await page.fill('#panel #copProbe', '70');
  await page.click('#panel #copProbeLog');
  await page.waitForTimeout(150);
  expect(await page.evaluate(`liveSession().targetC`)).toBe(95);
  expect(await page.evaluate(`liveSession().probes.length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('#panel .cop-probe').textContent`)).toContain('another');   // "Log another reading to project…"
  expect(/[֐-׿]/.test(await page.evaluate(`document.querySelector('#panel .cop-probe').textContent`) as string)).toBe(false);   // English, no leak
});
