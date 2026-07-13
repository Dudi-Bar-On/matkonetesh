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

async function openPlan(page: any) {
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
  await page.click('[data-tlview="plan"]');
  await page.waitForSelector('.workplan');
}

test('timer sync: a stage timer shares state across plan<->items views (shared st- tid)', async ({ page }) => {
  await openPlan(page);
  await page.click('#planStartRow .plan-startbtn');                             // start the plan (timers are gated until then)
  await page.waitForSelector('.workplan .timer[data-tid^="st-"]');
  const tid = await page.evaluate(`document.querySelector('.workplan .timer[data-tid^="st-"]').dataset.tid`) as string;
  await page.click(`.workplan .timer[data-tid="${tid}"] [data-play]`);          // start this stage timer in the plan view
  const rec = await page.evaluate(`store.get('mk-timers')[${JSON.stringify(tid)}]`) as any;
  expect(rec && rec.end).toBeTruthy();
  await page.click('[data-tlview="items"]');                                     // switch to the items view
  await page.waitForSelector(`.tl-stage .timer[data-tid="${tid}"]`, { state: 'attached' });  // stage detail may be collapsed (in DOM, hidden)
  // the SAME stage timer is running there (resumed from shared state), not reset
  expect(await page.evaluate(`document.querySelector('.tl-stage .timer[data-tid="${tid}"] [data-play]').textContent`)).toBe('❚❚');
});

test('all 3 plan shapes (vertical/accordion/horizontal) render timers', async ({ page }) => {
  await openPlan(page);
  await page.click('[data-tlshape="5"]');   // accordion
  await page.waitForSelector('.wp-accordion');
  expect(await page.evaluate(`document.querySelectorAll('.wp-accordion .timer').length`)).toBeGreaterThan(0);
  await page.click('[data-tlshape="3"]');   // horizontal
  await page.waitForSelector('.wp-horiz');
  expect(await page.evaluate(`document.querySelectorAll('.wp-horiz .timer').length`)).toBeGreaterThan(0);
});

test('voice-cook shows a "running now" strip for parallel timers, tappable to jump', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var now=Date.now();
    store.set('mk-timers', { 'st-a-0':{end:now+3600000}, 'st-b-0':{end:now+1800000} });   // two timers running
    openVoiceCook([
      {t:new Date(now+60000), label:'עשן חזה', kind:'smoke', tid:'st-a-0', dur:3600},
      {t:new Date(now+600000), label:'סו-ויד צלעות', kind:'sv', tid:'st-b-0', dur:1800}
    ]);
  })()`);
  await page.waitForSelector('.vc-running .vc-runchip');
  expect(await page.evaluate(`document.querySelectorAll('.vc-running .vc-runchip').length`)).toBe(2);   // both parallel timers listed
  await page.click('[data-vcjump="1"]');                                                               // jump to the 2nd
  expect(await page.evaluate(`document.querySelector('.vc-label').textContent`)).toContain('צלעות');
});

test('start plan: timers are gated until "התחל תוכנית" is pressed', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-menu', JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }));
      localStorage.setItem('mk-tlserve', JSON.stringify('23:59'));   // far enough that the plan is feasible mid-day
    } catch {}
  });
  await page.goto('/index.html');
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#planStartRow .plan-startbtn');
  expect(await page.evaluate(`document.getElementById('tlList').classList.contains('plan-idle')`)).toBe(true);   // timers disabled
  await page.click('#planStartRow .plan-startbtn');
  expect(await page.evaluate(`document.getElementById('tlList').classList.contains('plan-idle')`)).toBe(false);  // now enabled
  expect(await page.evaluate(`planStarted()`)).toBe(true);   // per-event start state (scoped key)
});

test('feasibility: strict mode warns + blocks starting when the plan cannot finish by serve time', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-menu', JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }));
      localStorage.setItem('mk-tlserve', JSON.stringify('00:01'));   // serve already in the past -> plan is behind
      localStorage.setItem('mk-plan-strict', JSON.stringify(true));
    } catch {}
  });
  await page.goto('/index.html');
  await page.evaluate(`openTimeline()`);
  await page.waitForSelector('#planStartRow .plan-startbtn');
  expect(await page.evaluate(`!!document.querySelector('#planStartRow .plan-warn')`)).toBe(true);            // warning shown
  expect(await page.evaluate(`document.querySelector('#planStartRow .plan-startbtn').disabled`)).toBe(true); // start blocked in strict mode
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
