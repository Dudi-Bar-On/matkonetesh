import { test, expect } from '@playwright/test';

const KIT = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{racks:4, areaCm2:6000} }];

const boot = async (page: any) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({guests:8,appetite:'reg',kosher:false,keys:['cut-1','cut-7'],sides:[],drinks:[],desserts:[],gpm:0}));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} }, [KIT]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openOccupancyView==='function'`);
};

const openPlanThenView = `(async function(){
  openTimeline();
  await new Promise(function(r){setTimeout(r,2000);});
  var p=document.querySelector('#panel');
  var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
  if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
  var b=document.querySelector('[data-occview]');
  if(!b) return {noButton:true};
  b.click();
  await new Promise(function(r){setTimeout(r,1200);});
  var v=document.querySelector('.occ-wrap');
  return { present: !!v, text: v?v.innerText:'', devices: document.querySelectorAll('.occ-dev').length,
           chips: document.querySelectorAll('.occ-item').length, bars: document.querySelectorAll('.occ-bar').length };
})()`;

test('W1: the work plan offers an occupancy view and it opens', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(openPlanThenView) as any;
  expect(r.noButton).toBeUndefined();
  expect(r.present).toBe(true);
  expect(r.devices).toBeGreaterThan(0);
});

test('W2: the view places the cuts and shows a usage percentage', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(openPlanThenView) as any;
  expect(r.chips).toBeGreaterThan(0);
  expect(r.bars).toBeGreaterThan(0);
  expect(r.text).toMatch(/%/);
  expect(r.text).toContain('הנפח אביה 150');
});

test('W3: the view is Hebrew-clean', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(openPlanThenView) as any;
  const latin = (r.text.match(/[A-Za-z]{3,}/g) || []).filter((w: string) => !/^(AI|PDF|BBQ)$/i.test(w));
  expect(latin, `English leaked into the Hebrew view: ${latin.join(', ')}`).toEqual([]);
});

// Controller review of Task 7: chips were sized flex:0 0 <proportion>%, so a 360 cm² item beside a
// 1320 cm² brisket landed at ~7% of the row and clipped its own name and figure. Proportion must not
// cost legibility — flex-grow plus a CSS min-width floors it.
test('W5: no occupancy chip clips its own label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });   // the app is mobile-first; a desktop width hides the clip
  await boot(page);
  const r = await page.evaluate(`(async function(){
    openTimeline();
    await new Promise(function(r){setTimeout(r,2000);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
    document.querySelector('[data-occview]').click();
    await new Promise(function(r){setTimeout(r,1000);});
    return [].map.call(document.querySelectorAll('.occ-item'), function(e){
      return { txt:e.innerText.replace(/\\n/g,' '), clipped: e.scrollWidth > e.clientWidth+1 };
    });
  })()`) as any[];
  expect(r.length).toBeGreaterThan(1);                       // needs at least two chips to be meaningful
  const clipped = r.filter((c: any) => c.clipped).map((c: any) => c.txt);
  expect(clipped, `chips clipping their label: ${clipped.join(' | ')}`).toEqual([]);
});
