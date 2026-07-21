import { test, expect } from '@playwright/test';

// S2 (refactoring report §2): occupancyCompat.setpoint = max(temps) among items sharing a cooker. It is
// advisory / display-only. If a future scheduler ever wrote it back onto a stage's `temp`, it would raise
// a lower-temp cut ABOVE its recipe temperature — a food-safety violation. These tests fence that: the
// occupancy pipeline must never mutate a stage temp. (The guard was proven to actually CATCH the violation
// by temporarily injecting `s.temp = setpoint` into cookerContention — see the commit notes.)

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id: 'sm1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000 } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyCompat==='function' && typeof cookerContention==='function'`);
};

test('SF1: setpoint is the max temp but occupancyCompat never mutates the input items', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var items=[{temp:110, wood:'אלון'},{temp:130, wood:'אלון'}];
    var before=items.map(function(i){return i.temp;});
    var c=occupancyCompat(items);
    var after=items.map(function(i){return i.temp;});
    return { setpoint:c.setpoint, before:before, after:after };
  })()`) as any;
  expect(r.setpoint).toBe(130);            // advisory value is the max
  expect(r.after).toEqual(r.before);       // ...but the input items are untouched (110 stays 110)
  expect(r.after).toEqual([110, 130]);
});

test('SF2: running cookerContention over items sharing a cooker at different temps never changes a stage temp', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:temp}] }; };
    // brisket at 110, spareribs deliberately at 130 — a 20°C spread → a temp clash on the one smoker
    var computed=[ mk('cut-1',110), mk('cut-7',130) ];
    setItemCooker('cut-1','smoke','sm1'); setItemCooker('cut-7','smoke','sm1');
    var before=computed.map(function(c){return c.stages[0].temp;});
    var clashes=cookerContention(computed, null);   // runs deviceOccupancy + occupancyCompat internally
    var after=computed.map(function(c){return c.stages[0].temp;});
    return { clashCount:clashes.length, reason:(clashes[0]||{}).reason, before:before, after:after };
  })()`) as any;
  expect(r.clashCount).toBe(1);            // the temp mismatch IS detected (that's the point of setpoint/compat)
  expect(r.reason).toBe('temp');
  expect(r.after).toEqual(r.before);       // ...and yet NO stage temp was raised to the 130 setpoint
  expect(r.after).toEqual([110, 130]);     // each cut keeps its own recipe temp
});

test('SF3: setpoint has exactly one reader in production and it is a display chip, not a temp write', async ({ page }) => {
  await boot(page);
  // occupancyDevHtml renders the setpoint as a fact chip; assert it appears as display text, and that
  // deviceOccupancy exposes compat.setpoint without touching item temps.
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:temp}] }; };
    var computed=[ mk('cut-1',110), mk('cut-7',130) ];
    setItemCooker('cut-1','smoke','sm1'); setItemCooker('cut-7','smoke','sm1');
    var o=deviceOccupancy('sm1', t0+1*3600e3, computed, null);
    return { setpoint:o.compat.setpoint, itemTemps:o.items.map(function(i){return i.temp;}).sort(),
             srcTemps:computed.map(function(c){return c.stages[0].temp;}) };
  })()`) as any;
  expect(r.setpoint).toBe(130);
  expect(r.srcTemps).toEqual([110, 130]);   // source stages untouched by the occupancy read
  expect(r.itemTemps).toEqual([110, 130]);  // the occupancy snapshot carries each real temp, not the setpoint
});
