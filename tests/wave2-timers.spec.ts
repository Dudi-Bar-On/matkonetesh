import { test, expect } from '@playwright/test';

// Work-plan + voice-cook countdown timers (user-requested addition during Wave 2).

test('work-plan: timed stages get a real countdown timer', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-menu', JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }));
    } catch {}
  });
  await page.goto('/index.html');
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#tlList .tlcard');
  const timers = await page.evaluate(`document.querySelectorAll('#tlList .tl-stage .timer').length`);
  expect(timers).toBeGreaterThan(0);
  // and each is wired (has a play button + live-alert region)
  expect(await page.evaluate(`!!document.querySelector('#tlList .tl-stage .timer [data-play]')`)).toBe(true);
  expect(await page.evaluate(`!!document.querySelector('#tlList .tl-stage .timer .tt-alert')`)).toBe(true);
});

test('voice-cook: a prominent timer appears with a next task and is wired for spoken alerts', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  // two tasks 1h apart -> the current task's timer counts down to the next
  await page.evaluate(`(function(){ var now=Date.now(); openVoiceCook([
    {t:new Date(now+60000), label:'עשן את החזה', kind:'smoke'},
    {t:new Date(now+3660000), label:'הוצא ועטוף', kind:'smoke'}
  ]); })()`);
  await page.waitForSelector('.vc-timerwrap .timer');
  expect(await page.evaluate(`!!document.querySelector('.vc-timerwrap .timer [data-play]')`)).toBe(true);
  // ~1h duration
  const sec = await page.evaluate(`+document.querySelector('.vc-timerwrap .timer').dataset.sec`);
  expect(sec).toBeGreaterThan(3000);
  expect(sec).toBeLessThan(3700);
});

test('work-plan PLAN view (תוכנית עבודה) also shows countdown timers', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-menu', JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }));
    } catch {}
  });
  await page.goto('/index.html');
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#tlList [data-tlview="plan"]');
  await page.click('[data-tlview="plan"]');                    // switch to the plan (work-plan) view
  await page.waitForSelector('.workplan');
  const timers = await page.evaluate(`document.querySelectorAll('.workplan .wp-timer .timer').length`);
  expect(timers).toBeGreaterThan(0);
});

test('work-plan shows a live "time until serving" bar with a progress fill', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-menu', JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }));
    } catch {}
  });
  await page.goto('/index.html');
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#tlList .tlcard');
  const bar = await page.evaluate(`(function(){ var b=document.getElementById('serveBar');
    return { hidden:b.hidden, remain:document.getElementById('serveRemain').textContent,
             at:document.getElementById('serveAt').textContent, fill:document.getElementById('serveFill').style.width }; })()`) as any;
  expect(bar.hidden).toBe(false);
  expect(bar.at).toContain('🍽️');           // serve clock time
  expect(bar.remain).toContain('הגשה');       // "…until serving" (or "serving time reached")
  expect(bar.fill).toMatch(/%$/);             // progress fill is a percentage width
});

test('timers persist: a running voice-cook timer survives a re-render (was: reset on return)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var now=Date.now(); openVoiceCook([
    {t:new Date(now+60000), label:'עשן', kind:'smoke'},
    {t:new Date(now+3660000), label:'עטוף', kind:'smoke'}
  ]); })()`);
  await page.waitForSelector('.vc-timerwrap .timer [data-play]');
  await page.click('.vc-timerwrap .timer [data-play]');        // start it (▶ -> running)
  // it is now persisted in mk-timers
  const rec = await page.evaluate(`store.get('mk-timers')`) as any;
  expect(Object.keys(rec).length).toBeGreaterThan(0);
  // simulate leaving and returning to the screen: a full re-render
  await page.evaluate(`vcRender()`);
  await page.waitForSelector('.vc-timerwrap .timer [data-play]');
  // the timer resumed running instead of resetting (play shows the pause glyph)
  expect(await page.evaluate(`document.querySelector('.vc-timerwrap .timer [data-play]').textContent`)).toBe('❚❚');
});
