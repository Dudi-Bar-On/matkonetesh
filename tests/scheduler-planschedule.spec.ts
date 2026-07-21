import { test, expect } from '@playwright/test';

// Phase 4a: the backward walk (start = serve - Σ durations) is the app's entire scheduler. It was
// implemented TWICE — buildList (Date arithmetic, unguarded s.hours) and combinedEventsRows (ms
// arithmetic, (s.hours||0), device-relevant stages only). planSchedule() makes it ONE pure function
// and records latestFinish/slack, which a real placer (4b) needs. No time may change.

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof planSchedule==='function'`);
};

test('P1: stages are laid backward from serve — last ends exactly at serve, each start = end - hours', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var serve=Date.parse('2026-07-24T19:00:00');
    var stages=[{kind:'prep',hours:1},{kind:'smoke',hours:8},{kind:'rest',hours:0.5}];
    var p=planSchedule(stages, serve);
    return { serve:serve, startMs:p.startMs,
             s:p.stages.map(function(x){return {kind:x.kind,hours:x.hours,startMs:x.startMs,endMs:x.endMs};}) };
  })()`) as any;
  const H = 3600e3;
  expect(r.s[2].endMs).toBe(r.serve);                    // the chain ends exactly at serve
  expect(r.s[2].startMs).toBe(r.serve - 0.5 * H);
  expect(r.s[1].endMs).toBe(r.s[2].startMs);             // contiguous, no gaps
  expect(r.s[1].startMs).toBe(r.serve - 8.5 * H);
  expect(r.s[0].endMs).toBe(r.s[1].startMs);
  expect(r.s[0].startMs).toBe(r.serve - 9.5 * H);
  expect(r.startMs).toBe(r.s[0].startMs);                // startMs is the whole chain's start clock
});

test('P2: the relaxation IS the latest-feasible position — latestFinish equals end, slack is zero', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var stages=[{kind:'smoke',hours:6},{kind:'rest',hours:1}];
    var p=planSchedule(stages, Date.parse('2026-07-24T19:00:00'));
    return p.stages.map(function(x){return {latest:x.latestFinishMs, end:x.endMs, slack:x.slackMs};});
  })()`) as any[];
  r.forEach((x: any) => {
    expect(x.latest).toBe(x.end);   // nothing may finish later than this, or serve is missed
    expect(x.slack).toBe(0);        // a placer (4b) moves stages EARLIER, creating slack; the relaxation has none
  });
});

// The divergence between the two old copies: buildList used `s.hours` unguarded, so a stage with no
// hours produced NaN and poisoned every earlier stage in the chain. The unified walk takes the safe
// reading (treat as 0) — a finite chain, never NaN.
test('P3: a stage with a missing duration yields a finite chain, never NaN', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var serve=Date.parse('2026-07-24T19:00:00');
    var p=planSchedule([{kind:'prep'},{kind:'smoke',hours:4}], serve);
    return { startMs:p.startMs, allFinite:p.stages.every(function(x){return isFinite(x.startMs)&&isFinite(x.endMs);}),
             prepHours:p.stages[0].hours };
  })()`) as any;
  expect(r.allFinite).toBe(true);
  expect(Number.isNaN(r.startMs)).toBe(false);
  expect(r.prepHours).toBe(0);
  expect(r.startMs).toBe(Date.parse('2026-07-24T19:00:00') - 4 * 3600e3);
});

test('P4: it is pure — it does not mutate the stages passed in, and repeats identically', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var stages=[{kind:'smoke',hours:5},{kind:'rest',hours:1}];
    var serve=Date.parse('2026-07-24T19:00:00');
    var a=planSchedule(stages, serve);
    var mutated = stages.some(function(s){ return 'start' in s || 'end' in s; });
    var b=planSchedule(stages, serve);
    return { mutated:mutated, same:JSON.stringify(a)===JSON.stringify(b) };
  })()`) as any;
  expect(r.mutated).toBe(false);   // placements are returned, not written onto the generator's output
  expect(r.same).toBe(true);       // deterministic
});

// The real regression fence: the shipped renderer must produce exactly the times planSchedule computes.
// If buildList kept its own copy of the walk, this drifts — which is the defect Phase 4a removes.
test('P5: the work-plan renderer produces exactly the times planSchedule computes', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:4, areaCm2:6000 } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({ guests:8, appetite:'reg', kosher:false, keys:['cut-1','cut-7'], sides:[], drinks:[], desserts:[], gpm:0 }));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function' && typeof planSchedule==='function'`);
  await page.evaluate(`openTimeline()`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  await page.locator('#panel').getByText('תוכנית עבודה').first().click();
  await page.waitForFunction(`!!(window._wpCtx && window._wpCtx.computed && window._wpCtx.computed.length)`);

  const r = await page.evaluate(`(function(){
    var cx=window._wpCtx, out=[];
    (cx.computed||[]).forEach(function(c){
      if(!c || !c.stages || !c.stages.length || c.blocked) return;
      var serve=c.stages[c.stages.length-1].end.getTime();     // the chain's own end
      var p=planSchedule(c.stages, serve);
      c.stages.forEach(function(s,i){
        out.push({ key:c.m.key, kind:s.kind,
                   renderedStart:s.start.getTime(), plannedStart:p.stages[i].startMs,
                   renderedEnd:s.end.getTime(),     plannedEnd:p.stages[i].endMs });
      });
    });
    return out;
  })()`) as any[];

  expect(r.length).toBeGreaterThan(0);
  r.forEach((x: any) => {
    expect(x.renderedStart, `${x.key}/${x.kind} start`).toBe(x.plannedStart);
    expect(x.renderedEnd, `${x.key}/${x.kind} end`).toBe(x.plannedEnd);
  });
});
