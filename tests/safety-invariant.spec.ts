import { test, expect } from '@playwright/test';

// SAFETY (audit): "no move may shorten a cook, alter a temp, or touch a bcheck" was enforced only by TESTS.
// Nothing in production checked it, so any future edit to equipPlan / placement / a repair rung could break
// it silently and the suite would only catch the cases someone thought to write. safetyDiff() makes the rule
// a runtime invariant: the plan layer verifies its own output and refuses a transformation that violates it.

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof safetyDiff==='function'`);
};

const S = `[{kind:'prep',hours:1},{kind:'smoke',hours:8,temp:110},{kind:'rest',hours:0.5},{kind:'bcheck',hours:0,safe:74}]`;

test('V1: an unchanged plan reports no violations', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(`safetyDiff(${S}, ${S})`) as any[];
  expect(v).toEqual([]);
});

test('V2: shortening a cook is a violation', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(`(function(){ var a=${S}, b=JSON.parse(JSON.stringify(a)); b[1].hours=6; return safetyDiff(a,b); })()`) as any[];
  expect(v.length).toBeGreaterThan(0);
  expect(JSON.stringify(v)).toContain('hours');
});

test('V3: raising a temperature is a violation', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(`(function(){ var a=${S}, b=JSON.parse(JSON.stringify(a)); b[1].temp=125; return safetyDiff(a,b); })()`) as any[];
  expect(v.length).toBeGreaterThan(0);
  expect(JSON.stringify(v)).toContain('temp');
});

test('V4: dropping or altering the bcheck gate is a violation', async ({ page }) => {
  await boot(page);
  const dropped = await page.evaluate(`(function(){ var a=${S}, b=JSON.parse(JSON.stringify(a)); b.splice(3,1); return safetyDiff(a,b); })()`) as any[];
  expect(dropped.length).toBeGreaterThan(0);
  const lowered = await page.evaluate(`(function(){ var a=${S}, b=JSON.parse(JSON.stringify(a)); b[3].safe=60; return safetyDiff(a,b); })()`) as any[];
  expect(lowered.length).toBeGreaterThan(0);
  expect(JSON.stringify(lowered)).toContain('safe');
});

test('V5: reordering stages is a violation (a bcheck must never precede its cook)', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(`(function(){ var a=${S}, b=JSON.parse(JSON.stringify(a)); var t=b[1]; b[1]=b[2]; b[2]=t; return safetyDiff(a,b); })()`) as any[];
  expect(v.length).toBeGreaterThan(0);
});

test('V6: moving a stage in TIME is allowed — that is the whole point of placement', async ({ page }) => {
  await boot(page);
  const v = await page.evaluate(`(function(){
    var a=${S}, b=JSON.parse(JSON.stringify(a));
    b.forEach(function(s){ s.start=new Date(0); s.end=new Date(3600e3); });   // times differ wildly
    return safetyDiff(a,b);
  })()`) as any[];
  expect(v).toEqual([]);   // start/end are placement's business; durations and temps are not
});

test('V7: the real plan passes its own invariant after equipPlan + placement', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:1, areaCm2:1700 } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({ guests:8, appetite:'reg', kosher:false, keys:['cut-1','cut-7'], sides:[], drinks:[], desserts:[], gpm:0 }));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function' && typeof safetyDiff==='function'`);
  await page.evaluate(`openTimeline()`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  await page.waitForFunction(`!!(window._wpCtx && window._wpCtx.computed && window._wpCtx.computed.length)`);
  // the plan records any violation it detected in its own output; a healthy plan records none
  const violations = await page.evaluate(`window._planSafetyViolations || []`) as any[];
  expect(violations).toEqual([]);
});
