import { test, expect } from '@playwright/test';

// The setpoint hazard (scheduler spec §6.3): occupancyCompat.setpoint = max(temps) is rendered as a device
// fact. Running a pit at the maximum of two items' required temperatures RAISES the cooler item's cook
// temperature. It is display-only today, but it must state the delta and name who pays it — before any
// solver can turn "share a device" into an automatic move.

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function' && typeof deviceOccupancy==='function'`);
};

const CABINET = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{ racks:5, areaCm2:12000 } }];

// two items sharing one cooker at DIFFERENT temperatures
const render = (temps: number[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var keys=['cut-7','cut-9'];
  var computed=keys.map(function(k,i){
    setItemCooker(k,'smoke','d1');
    return { m:resolveItem(k), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:${JSON.stringify(temps)}[i]}] };
  });
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
  var d=div.querySelector('.occ2-tdelta');
  return { setpoint:o.compat.setpoint, spread:o.compat.tempSpread,
           deltaText:d?d.textContent:'', hasDelta:!!d, cardText:div.textContent||'',
           coolerName:resolveItem(keys[${JSON.stringify(temps)}[0]<${JSON.stringify(temps)}[1]?0:1]).heb };
})()`;

test('S1: sharing a cooker at different temps states the delta and names who is raised', async ({ page }) => {
  await boot(page, CABINET);
  const r = await page.evaluate(render([104, 110])) as any;
  expect(r.setpoint).toBe(110);          // the pit runs at the max...
  expect(r.spread).toBe(6);
  expect(r.hasDelta).toBe(true);         // ...and the card must SAY that costs the cooler item 6°
  expect(r.deltaText).toContain('6');
  expect(r.cardText).toContain(r.coolerName);   // named, not a faceless warning
});

test('S2: one temperature (or one item) shows no delta — nothing is being raised', async ({ page }) => {
  await boot(page, CABINET);
  const r = await page.evaluate(render([110, 110])) as any;
  expect(r.spread).toBe(0);
  expect(r.hasDelta).toBe(false);
});
