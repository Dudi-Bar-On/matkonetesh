import { test, expect } from '@playwright/test';

// Phase 3: equipPlan is the seam where equipment enters stage generation. It was waived, and its absence is
// the root cause of the whole refactoring report — without it no equipment fact can change a duration or a
// time, by construction. D1 is the visible symptom: the plan hardcodes a 45-minute preheat while
// preheatHint() separately knows a pellet smoker needs ~15, so the scheduled time and the advice contradict.

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    if (k.length) { localStorage.setItem('mk-equipment', JSON.stringify(k)); localStorage.setItem('mk-equip-set', JSON.stringify(true)); }
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof equipPlan==='function' && typeof preheatMinutes==='function'`);
};

const PELLET   = [{ id:'d1', cat:'smoker', type:'פלטים',          name:'פלט',  cap:{ racks:4, areaCm2:6000 } }];
const CHARCOAL = [{ id:'d1', cat:'smoker', type:'WSM / חבית',     name:'חבית', cap:{ racks:2, areaCm2:4000 } }];
const CABINET  = [{ id:'d1', cat:'smoker', type:'ארון / קבינט',   name:'ארון', cap:{ racks:5, areaCm2:9000 } }];

test('P3a: preheat minutes come from the DEVICE — a pellet smoker is not a charcoal drum', async ({ page }) => {
  await boot(page, PELLET);
  const pellet = await page.evaluate(`preheatMinutes()`) as number;
  await boot(page, CHARCOAL);
  const charcoal = await page.evaluate(`preheatMinutes()`) as number;
  await boot(page, CABINET);
  const cabinet = await page.evaluate(`preheatMinutes()`) as number;
  expect(pellet).toBeGreaterThan(0);
  expect(pellet).toBeLessThan(charcoal);      // a pellet heats fast; a charcoal chimney does not
  expect(cabinet).toBeLessThanOrEqual(charcoal);
});

test('P3b: the scheduled light-up and its label state the SAME number (D1 — one source of truth)', async ({ page }) => {
  await boot(page, PELLET);
  const r = await page.evaluate(`(function(){
    return { mins:preheatMinutes(), hint:preheatHint() };
  })()`) as any;
  // the hint text must contain the very number the schedule uses — they cannot drift apart
  expect(String(r.hint)).toContain(String(r.mins));
});

test('P3c: the real plan lights the fire preheatMinutes before the first smoke, not a hardcoded 45', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id:'d1', cat:'smoker', type:'פלטים', name:'פלט', cap:{ racks:4, areaCm2:9000 } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({ guests:8, appetite:'reg', kosher:false, keys:['cut-1'], sides:[], drinks:[], desserts:[], gpm:0 }));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openTimeline==='function' && typeof preheatMinutes==='function'`);
  await page.evaluate(`openTimeline()`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  const r = await page.evaluate(`(function(){
    var mins=preheatMinutes();
    var cx=window._wpCtx||{};
    var earliest=null;
    (cx.computed||[]).forEach(function(c){ if(!c||c.blocked||!c.stages) return;
      c.stages.forEach(function(s){ if(s.kind==='smoke' && (!earliest||s.start<earliest)) earliest=s.start; }); });
    var row=document.querySelector('.tl-preheat');
    var expected=earliest? new Date(earliest.getTime()-mins*60e3) : null;
    var hh=expected?String(expected.getHours()).padStart(2,'0')+':'+String(expected.getMinutes()).padStart(2,'0'):'';
    return { mins:mins, expectedClock:hh, rowText:row?row.textContent:'' };
  })()`) as any;
  expect(r.mins).toBe(15);                              // pellet
  expect(r.rowText).toContain('15 דק׳');                 // the LABEL states the device's own number...
  expect(r.rowText).not.toContain('45 דק׳');             // ...not the old hardcoded one
  expect(r.rowText).toContain(r.expectedClock);         // ...and the fire is SCHEDULED at that offset
});

test('P3d: equipPlan is a no-op without a kit, and pure with one', async ({ page }) => {
  await boot(page, []);
  const noKit = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    var stages=[{kind:'smoke',hours:8,temp:110}];
    var out=equipPlan(m,'smoke',stages,null);
    return { same:JSON.stringify(out)===JSON.stringify(stages), len:out.length };
  })()`) as any;
  expect(noKit.same).toBe(true);                 // nothing invented when nothing is configured

  await boot(page, CHARCOAL);
  const withKit = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    var stages=[{kind:'smoke',hours:8,temp:110}];
    setItemCooker('cut-1','smoke','d1');
    var out=equipPlan(m,'smoke',stages,null);
    return { mutatedInput:('refuelEveryMin' in stages[0])||('fuelNote' in stages[0]),
             hours:out[0].hours, temp:out[0].temp, refuel:out[0].refuelEveryMin||0 };
  })()`) as any;
  expect(withKit.mutatedInput).toBe(false);      // pure — the caller's stages are untouched
  expect(withKit.hours).toBe(8);                 // it enriches; it must never change a duration
  expect(withKit.temp).toBe(110);                // ...or a temperature
  expect(withKit.refuel).toBeGreaterThan(0);     // a charcoal drum needs refuelling; that is a device fact
});

test('P3e: a pellet smoker gets no refuel cadence — the fact comes from the device, not the recipe', async ({ page }) => {
  await boot(page, PELLET);
  const r = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    setItemCooker('cut-1','smoke','d1');
    var out=equipPlan(m,'smoke',[{kind:'smoke',hours:8,temp:110}],null);
    return { refuel:out[0].refuelEveryMin||0 };
  })()`) as any;
  expect(r.refuel).toBe(0);
});

// D4 with a real consumer: the refuel cadence becomes actual tasks on the clock, or it is just another
// computed-and-never-read field — the exact failure this whole refactor exists to stop.
test('P3f: a stick burner gets refuel tasks in the plan; a pellet smoker gets none', async ({ page }) => {
  const run = async (type: string) => {
    await page.addInitScript(([t]: [string]) => { try {
      localStorage.clear();
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-lang', JSON.stringify('he'));
      localStorage.setItem('mk-equipment', JSON.stringify([{ id:'d1', cat:'smoker', type:t, name:'x', cap:{ racks:4, areaCm2:9000 } }]));
      localStorage.setItem('mk-equip-set', JSON.stringify(true));
      localStorage.setItem('mk-menu', JSON.stringify({ guests:8, appetite:'reg', kosher:false, keys:['cut-1'], sides:[], drinks:[], desserts:[], gpm:0 }));
      localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
    } catch {} }, [type]);
    await page.goto('/index.html');
    await page.waitForFunction(`typeof openTimeline==='function'`);
    await page.evaluate(`openTimeline()`);
    await page.locator('#panel').waitFor({ state: 'visible' });
    await page.locator('#panel').getByText('תוכנית עבודה').first().click();
    await page.waitForFunction(`Array.isArray(window._wpTasks) && window._wpTasks.length>0`);
    return await page.evaluate(`(window._wpTasks||[]).filter(function(t){return /הוספת/.test(t.label||'');}).length`) as number;
  };
  const stick = await run('אופסט / סטיק-ברנר');
  expect(stick).toBeGreaterThan(0);          // a long cook on a stick burner needs repeated splits
  const pellet = await run('פלטים');
  expect(pellet).toBe(0);                    // the hopper feeds itself — inventing tasks here would be noise
});
