import { test, expect } from '@playwright/test';

// Phase 4b: the relaxation ends every item at serve, so a shared cooker is maximally over-subscribed by
// construction. schedulePlacements() moves stages EARLIER (never later — that would miss serve) until no
// instant exceeds the device's honest capacity. It may never alter a duration, a temperature, or an order.

// Run-artefact screenshots go to test-results/ (gitignored), NOT docs/analysis/shots/ (tracked).
// Writing them into a tracked directory left every full suite run — and therefore every CI run —
// with two modified tracked PNGs, i.e. a permanently dirty working tree. The committed
// docs/analysis/shots/p4-*.png remain as the deliberate, audit-cited evidence of that state;
// they are simply no longer overwritten by a test run.
const SHOTS = 'test-results/';

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof schedulePlacements==='function' && typeof deviceOccupancy==='function'`);
};

// One shelf, 700 cm² gross -> 595 usable. cut-7(360)+cut-10(150)=510 fits; adding cut-9(96)=606 does not.
const TIGHT = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:1, areaCm2:700 } }];
const ROOMY = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:5, areaCm2:12000 } }];

// Build a relaxed plan (every item ending at serve, as the app does today) and place it.
const RUN = (keys: string[], hours = 4) => `(function(){
  var serve=Date.parse('2026-07-24T19:00:00');
  var computed=${JSON.stringify(keys)}.map(function(k){
    var m=resolveItem(k);
    var stages=[{kind:'smoke', hours:${hours}, temp:110, tid:'st-'+k}];
    var p=planSchedule(stages, serve);
    stages[0].start=new Date(p.stages[0].startMs); stages[0].end=new Date(p.stages[0].endMs);
    setItemCooker(k,'smoke','d1');
    return {m:m, stages:stages};
  });
  var res=schedulePlacements(computed, null);
  var out=[];
  Object.keys(res.placements).forEach(function(tid){ var pl=res.placements[tid];
    out.push({tid:tid, startMs:pl.startMs, endMs:pl.endMs, latestFinishMs:pl.latestFinishMs,
              slackMs:pl.slackMs, devId:pl.devId, cm2:pl.demandCm2}); });
  return { serve:serve, placed:out, conflicts:res.conflicts,
           relaxed:computed.map(function(c){return {tid:c.stages[0].tid, start:c.stages[0].start.getTime(), end:c.stages[0].end.getTime(), hours:c.stages[0].hours, temp:c.stages[0].temp};}) };
})()`;

// concurrent demand at any instant must never exceed usable area
const maxConcurrent = (placed: any[]) => {
  const pts = new Set<number>();
  placed.forEach(p => { pts.add(p.startMs); pts.add(p.endMs - 1); });
  let peak = 0;
  pts.forEach(t => {
    let sum = 0;
    placed.forEach(p => { if (t >= p.startMs && t < p.endMs) sum += (p.cm2 || 0); });
    if (sum > peak) peak = sum;
  });
  return peak;
};

test('B1: an over-subscribed cooker is staggered along the timeline — the relaxation piled them all on serve', async ({ page }) => {
  await boot(page, TIGHT);
  // 1h cooks: resolving the overlap needs a ~1h pull, inside SCHED_PULL_MAX_MS, so the placer may act silently
  const r = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'], 1)) as any;
  // the relaxation really did end every item at the same instant (the defect being fixed)
  const relaxedEnds = new Set(r.relaxed.map((x: any) => x.end));
  expect(relaxedEnds.size).toBe(1);
  expect([...relaxedEnds][0]).toBe(r.serve);
  // after placement, no instant exceeds 595 usable cm²
  expect(maxConcurrent(r.placed)).toBeLessThanOrEqual(595);
  // ...which is only possible if something actually moved earlier
  const ends = new Set(r.placed.map((p: any) => p.endMs));
  expect(ends.size).toBeGreaterThan(1);
});

test('B2: nothing is ever placed later than the relaxation (that would miss serve)', async ({ page }) => {
  await boot(page, TIGHT);
  const r = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'], 1)) as any;
  r.placed.forEach((p: any) => {
    expect(p.endMs, `${p.tid} must not finish after its latest feasible finish`).toBeLessThanOrEqual(p.latestFinishMs);
    expect(p.slackMs).toBe(p.latestFinishMs - p.endMs);   // slack is exactly how far it was pulled earlier
    expect(p.slackMs).toBeGreaterThanOrEqual(0);
  });
});

test('B3: durations and temperatures are never altered by placement', async ({ page }) => {
  await boot(page, TIGHT);
  const r = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'], 1)) as any;
  const byTid: any = {}; r.relaxed.forEach((x: any) => { byTid[x.tid] = x; });
  r.placed.forEach((p: any) => {
    const src = byTid[p.tid];
    expect(p.endMs - p.startMs, `${p.tid} duration`).toBe(src.hours * 3600e3);   // exact, not "about"
    expect(src.temp).toBe(110);                                                  // untouched
  });
});

test('B4: a cooker with room leaves the plan alone — no gratuitous shifting', async ({ page }) => {
  await boot(page, ROOMY);
  const r = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'])) as any;
  r.placed.forEach((p: any) => {
    expect(p.slackMs, `${p.tid} should not be moved when everything already fits`).toBe(0);
    expect(p.endMs).toBe(r.serve);
  });
  expect(r.conflicts.length).toBe(0);
});

test('B5: placement is deterministic — same plan, same result', async ({ page }) => {
  await boot(page, TIGHT);
  const a = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'], 1)) as any;
  const b = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'], 1)) as any;
  expect(JSON.stringify(a.placed)).toBe(JSON.stringify(b.placed));
});

test('B6: an item that fits on no shelf at all is reported as a conflict, never silently overlapped', async ({ page }) => {
  // brisket 1320 cm² cannot fit a 595 cm² shelf at any time — staggering cannot rescue it
  await boot(page, TIGHT);
  const r = await page.evaluate(RUN(['cut-1'])) as any;
  expect(r.conflicts.length).toBeGreaterThan(0);
  expect(JSON.stringify(r.conflicts)).toContain('cut-1');
});

// Two regimes, both correct. A pull the cook could plausibly absorb happens silently; a pull that would
// finish the food absurdly early is REFUSED and advised instead — cold ribs are not a scheduling success.
test('C1: a pull beyond the bound is refused and advised, not silently applied', async ({ page }) => {
  await boot(page, TIGHT);
  // 6h cooks on a one-shelf cooker: separating them needs a 6h pull, well past SCHED_PULL_MAX_MS (2h)
  const r = await page.evaluate(RUN(['cut-7', 'cut-10', 'cut-9'], 6)) as any;
  const far = r.conflicts.filter((c: any) => c.reason === 'pull-too-far');
  expect(far.length).toBeGreaterThan(0);
  expect(far[0].neededMs).toBeGreaterThan(far[0].maxMs);
  // and nothing was moved behind the user's back
  r.placed.forEach((p: any) => expect(p.slackMs).toBe(0));
});

test('C2: the REAL plan states an unresolvable load instead of leaving it silently over-subscribed', async ({ page }) => {
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
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`openTimeline()`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  const advice = page.locator('.sched-advice');
  await expect.poll(async () => await advice.count()).toBeGreaterThan(0);
  await expect(advice.first()).toBeVisible();
  await page.locator('#panel').screenshot({ path: SHOTS + 'p4-advice-he.png' });
});

// The small-pull regime in the real UI: two quick grill items on a grill too small for both. This is the
// everyday case the feature exists for — cook one, then the other, half an hour apart.
test('C3: a small pull staggers the real plan and the timeline says the item is ready early', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof itemStages==='function' && typeof resolveItem==='function'`);
  // find two quick 'cook' items with known footprints, so the needed pull is well inside the bound
  const keys = await page.evaluate(`(function(){
    var out=[];
    Object.keys(DATA.cuts||{}).forEach(function(k){
      if(out.length>=2) return;
      var m=resolveItem('cut-'+k)||resolveItem(k); if(!m) return;
      var e=m.obj&&m.obj.equip||m.equip; var sp=e&&e.spec||{};
      if(sp.hang || sp.footprint_cm2==null) return;
      var p=(typeof itemProfile==='function')?itemProfile(m):null; if(!p||!p.methods||!p.methods.length) return;
      var st=itemStages(m,p.methods[0].key,false,null)||[];
      var ck=st.filter(function(s){return s.kind==='cook';});
      if(ck.length===1 && ck[0].hours>0 && ck[0].hours<=1.5) out.push({key:m.key, cm2:sp.footprint_cm2});
    });
    return out;
  })()`) as any[];
  test.skip(keys.length < 2, 'no two quick cook-items with known footprints in the data');

  const area = Math.round((keys[0].cm2 + keys[1].cm2) * 0.8 / 0.85);   // fits either alone, never both
  await page.addInitScript(([k, a]: [any[], number]) => { try {
    localStorage.setItem('mk-equipment', JSON.stringify([{ id:'g1', cat:'grill', type:'גז', name:'גריל', cap:{ zones:1, areaCm2:a } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({ guests:6, appetite:'reg', kosher:false, keys:[k[0].key, k[1].key], sides:[], drinks:[], desserts:[], gpm:0 }));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} }, [keys, area]);
  await page.reload();
  await page.waitForFunction(`typeof openTimeline==='function'`);
  await page.evaluate(`openTimeline()`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  const early = page.locator('.tl-early');
  await expect.poll(async () => await early.count()).toBeGreaterThan(0);
  await expect(early.first()).toContainText('לפני ההגשה');
  await page.locator('#panel').screenshot({ path: SHOTS + 'p4-early-he.png' });
});
