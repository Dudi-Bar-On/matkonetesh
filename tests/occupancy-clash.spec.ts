import { test, expect } from '@playwright/test';

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({guests:8,appetite:'reg',kosher:false,keys:['cut-1','cut-7'],sides:[],drinks:[],desserts:[],gpm:0}));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cookerContention==='function' && typeof deviceOccupancy==='function'`);
};

const BIG   = [{ id:'d1', cat:'smoker', type:'ארון / קבינט',  name:'הנפח אביה 150', cap:{racks:4, areaCm2:6000} }];
const SMALL = [{ id:'d1', cat:'smoker', type:'קמאדו / קרמי', name:'קמאדו',        cap:{racks:1, areaCm2:1650} }];

const CLASHES = `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
  return cookerContention([ mk('cut-1',0,12,110), mk('cut-7',6,11,107) ]);
})()`;

test('C1: brisket + ribs on a 4-rack smoker is NOT a clash (they fit)', async ({ page }) => {
  await boot(page, BIG);
  const clashes = await page.evaluate(CLASHES) as any[];
  expect(clashes).toEqual([]);
});

test('C2: the same pair on a single-grate kamado IS a clash, for area', async ({ page }) => {
  await boot(page, SMALL);
  const clashes = await page.evaluate(CLASHES) as any[];
  expect(clashes).toHaveLength(1);
  expect(clashes[0].reason).toBe('area');
  expect(clashes[0].items.map((i: any) => i.key).sort()).toEqual(['cut-1', 'cut-7']);
  expect(clashes[0].pct).toBeGreaterThan(100);
});

test('C3: items that fit but need different temperatures clash for temp', async ({ page }) => {
  await boot(page, BIG);
  const clashes = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    return cookerContention([ mk('cut-1',0,12,110), mk('cut-7',6,11,160) ]);
  })()`) as any[];
  expect(clashes).toHaveLength(1);
  expect(clashes[0].reason).toBe('temp');
  expect(clashes[0].compat.tempSpread).toBe(50);
});

test('C4: unknown capacity never produces an area clash', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח', cap:{racks:4, areaCm2:0} }]);
  const clashes = await page.evaluate(CLASHES) as any[];
  expect(clashes.filter((c: any) => c.reason === 'area')).toEqual([]);
});

test('C5: the work plan shows no clash advisory for a pair that fits', async ({ page }) => {
  await boot(page, BIG);
  const r = await page.evaluate(`(async function(){
    openTimeline();
    await new Promise(function(r){setTimeout(r,2000);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
    var cl=p.querySelector('.wp-clash');
    return { shown: !!cl, text: cl?cl.innerText:'' };
  })()`) as any;
  expect(r.shown).toBe(false);
});

test('C6: no advisory ever tells the user to stagger a start (no such control exists)', async ({ page }) => {
  await boot(page, SMALL);
  const text = await page.evaluate(`(async function(){
    openTimeline();
    await new Promise(function(r){setTimeout(r,2000);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
    return p.innerText;
  })()`) as string;
  expect(text).not.toContain('הסט את ההתחלה');
  expect(text).not.toContain('stagger the start');
});

// Task 5 review gate: the clash flag was keyed by item alone, so an item with stages on TWO devices
// (a bath, then the smoker) got the warning icon on every one of its rows — including the row for the
// device that is perfectly fine. The flag must be scoped to the contended stage.
test('C7: only the contended stage of a multi-device item is flagged', async ({ page }) => {
  await boot(page, [
    { id:'d1', cat:'smoker',   type:'קמאדו / קרמי',      name:'קמאדו', cap:{racks:1, areaCm2:1650} },
    { id:'d2', cat:'sousvide', type:'טבילה (immersion)', name:'מקל',   cap:{baths:[24]} },
  ]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    setItemCooker('cut-1','sv','d2'); setItemCooker('cut-1','smoke','d1'); setItemCooker('cut-7','smoke','d1');
    // cut-1 sits in the bath early, then joins cut-7 on the over-capacity kamado
    var a={ m:resolveItem('cut-1'), stages:[
      {kind:'sv',    start:new Date(t0),          end:new Date(t0+4*3600e3),  temp:68},
      {kind:'smoke', start:new Date(t0+4*3600e3), end:new Date(t0+12*3600e3), temp:110}] };
    var b={ m:resolveItem('cut-7'), stages:[
      {kind:'smoke', start:new Date(t0+5*3600e3), end:new Date(t0+11*3600e3), temp:107}] };
    var cl=cookerContention([a,b]);
    var flagged={};
    cl.forEach(function(c){ c.items.forEach(function(i){ flagged[i.key+'|'+i.kind]=1; }); });
    return { clashes:cl.length, devs:cl.map(function(c){return c.devName;}), flagged:Object.keys(flagged).sort() };
  })()`) as any;
  expect(r.clashes).toBe(1);
  expect(r.devs).toEqual(['קמאדו']);
  expect(r.flagged).toEqual(['cut-1|smoke', 'cut-7|smoke']);   // NOT 'cut-1|sv' — the bath is fine
});
