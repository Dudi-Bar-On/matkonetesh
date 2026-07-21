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
  await page.waitForFunction(`!liveSession()`);        // condition, not a 150ms guess (DoD #11)
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
  // the reading must be persisted AND the card re-rendered before asserting — under parallel load the old
  // fixed 150ms wait expired first, which is what made this test flake in a full run (DoD #11).
  await page.waitForFunction(`(liveSession()||{}).probes && liveSession().probes.length===1`);
  await page.waitForFunction(`/another/.test((document.querySelector('#panel .cop-probe')||{}).textContent||'')`);
  expect(await page.evaluate(`liveSession().targetC`)).toBe(95);
  expect(await page.evaluate(`liveSession().probes.length`)).toBe(1);
  expect(await page.evaluate(`document.querySelector('#panel .cop-probe').textContent`)).toContain('another');   // "Log another reading to project…"
  expect(/[֐-׿]/.test(await page.evaluate(`document.querySelector('#panel .cop-probe').textContent`) as string)).toBe(false);   // English, no leak
});

test('W2-P4: adaptive recompute — pushing serve flips the verdict and syncs the plan serve', async ({ page }) => {
  await bootCopilot(page);
  // a "behind" session: 60→70 over 1h (rate 10 → ETA now+2.5h), serve in 90 min → behind
  await page.evaluate(`(function(){ startLiveCook(); var s=liveSession(); s.targetC=95; s.probes=[{t:Date.now()-3600000,tempC:60},{t:Date.now(),tempC:70}]; s.serveTs=Date.now()+90*60000; store.set(liveKey(), s); })()`);
  expect(await page.evaluate(`copilotPace(liveSession()).verdict`)).toBe('behind');
  // push serve +90 min → now ahead, and mk-tlserve updated in lockstep
  await page.evaluate(`copilotAdjustServe(90)`);
  expect(await page.evaluate(`copilotPace(liveSession()).verdict`)).toBe('ahead');
  expect(await page.evaluate(`!!store.get('mk-tlserve')`)).toBe(true);
  // the +1h UI button advances the serve by exactly 60 min
  await page.evaluate(`openCopilot()`);
  await page.waitForSelector('#panel [data-copserve="60"]');
  const before = await page.evaluate(`liveSession().serveTs`) as number;
  await page.click('#panel [data-copserve="60"]');
  await page.waitForFunction(`liveSession().serveTs === ${'${before}'} + 3600000`.replace('${before}', String(before)));
  const after = await page.evaluate(`liveSession().serveTs`) as number;
  expect(after - before).toBe(3600000);
});

test('W2-P5: voice context includes the live-session pace/ETA/verdict', async ({ page }) => {
  await bootCopilot(page);
  await page.evaluate(`(function(){ startLiveCook(); var s=liveSession(); s.targetC=95; s.probes=[{t:Date.now()-3600000,tempC:60},{t:Date.now(),tempC:70}]; s.serveTs=Date.now()+90*60000; store.set(liveKey(), s); })()`);
  const ctx = await page.evaluate(`copilotVoiceContext()`) as string;
  expect(ctx).toContain('70');    // last probe reading
  expect(ctx).toContain('95');    // target
  expect(ctx).toContain('מאחר');  // "behind" verdict, in the Hebrew grounding
  // it folds into the voice Ask context even with no current voice task
  const vctx = await page.evaluate(`vcCookContext()`) as string;
  expect(vctx).toContain('70');
  // no live session → no live context
  await page.evaluate(`stopLiveCook()`);
  expect(await page.evaluate(`copilotVoiceContext()`)).toBe('');
});

test('W2-P6: "what do I do now?" — deterministic advice by state + renders (no key needed)', async ({ page }) => {
  await bootCopilot(page);
  const adv = (s: any) => page.evaluate(`copilotAdviceLocal(${JSON.stringify(s)})`);
  expect(await adv({ targetC: 95, serveTs: 0, probes: [{ t: 0, tempC: 60 }, { t: 3600000, tempC: 70 }] })).toContain('behind');
  expect(await adv({ targetC: 95, probes: [{ t: 0, tempC: 68 }, { t: 3600000, tempC: 68.5 }] })).toContain('Crutch');
  expect(await adv({ targetC: 95, probes: [{ t: 0, tempC: 96 }] })).toContain('rest');
  expect(await adv({ targetC: 95, probes: [{ t: 0, tempC: 60 }] })).toContain('another');
  // no key → clicking shows the deterministic advice, English, no AI call needed
  await page.evaluate(`(function(){ store.set('mk-gemkey',''); startLiveCook(); var s=liveSession(); s.targetC=95; s.probes=[{t:Date.now()-3600000,tempC:68},{t:Date.now(),tempC:68.5}]; store.set(liveKey(), s); openCopilot(); })()`);
  await page.click('#panel #copAskNow');
  await page.waitForSelector('#panel #copAdvice .cop-pacenote');
  const advice = await page.evaluate(`document.querySelector('#panel #copAdvice').textContent`) as string;
  expect(advice).toContain('stall');
  expect(/[֐-׿]/.test(advice)).toBe(false);
});
