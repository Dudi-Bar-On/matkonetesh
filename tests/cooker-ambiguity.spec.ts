import { test, expect } from '@playwright/test';

// S3 / residual D6 (refactoring report §2): with two devices of the SAME class (e.g. two smokers),
// cookerFor returns null (ambiguous), and cookerContention + deviceOccupancy then silently skip the item.
// So owning a second smoker made cuts INVISIBLE to the clash detector — more equipment, less awareness.
// Plan §7 fix: "surface 'needs a pick' instead of silence." The per-item cooker picker already exists;
// the gap was that nothing told the user they must assign. This adds that prompt.

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
  await page.waitForFunction(`typeof openTimeline==='function' && typeof cookerFor==='function'`);
};

const TWO_SMOKERS = [
  { id: 'sm1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון גדול', cap: { racks: 4, areaCm2: 6000 } },
  { id: 'sm2', cat: 'smoker', type: 'WSM / חבית', name: 'חבית', cap: { racks: 3, areaCm2: 3300 } },
];
const ONE_SMOKER = [{ id: 'sm1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון גדול', cap: { racks: 4, areaCm2: 6000 } }];

// open the work-plan tab and return its text
const workPlanText = `(async function(){
  openTimeline();
  await new Promise(function(r){setTimeout(r,1500);});
  var p=document.querySelector('#panel');
  var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
  if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1000);}); }
  return { text: p.innerText, hasAdvisory: !!p.querySelector('.wp-assign') };
})()`;

test('A1: cookerFor is genuinely ambiguous with two same-class smokers (the underlying condition)', async ({ page }) => {
  await boot(page, TWO_SMOKERS);
  const resolved = await page.evaluate(`(cookerFor('cut-1','smoke')||{}).id || null`);
  expect(resolved).toBeNull();   // two smokers, no assignment → ambiguous (this is the condition S3 handles)
});

test('A2: the work plan surfaces an "awaiting cooker assignment" advisory (not silence)', async ({ page }) => {
  await boot(page, TWO_SMOKERS);
  const r = await page.evaluate(workPlanText) as any;
  expect(r.hasAdvisory).toBe(true);
  expect(r.text).toContain('שיוך מכשיר');    // names the need to assign a cooker (מכשיר, not תנור — that means OVEN)
  expect(r.text).toContain('בריסקט');        // and lists the unassigned item(s)
});

test('A3: with a single smoker there is no ambiguity and no advisory (negative case)', async ({ page }) => {
  await boot(page, ONE_SMOKER);
  const r = await page.evaluate(workPlanText) as any;
  expect(r.hasAdvisory).toBe(false);
});

test('A4: assigning each cut to a different smoker resolves it — advisory gone, detection active', async ({ page }) => {
  await boot(page, TWO_SMOKERS);
  const r = await page.evaluate(`(async function(){
    setItemCooker('cut-1','smoke','sm1');
    setItemCooker('cut-7','smoke','sm2');
    openTimeline();
    await new Promise(function(r){setTimeout(r,1500);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1000);}); }
    return { hasAdvisory: !!p.querySelector('.wp-assign'),
             brisketDev:(cookerFor('cut-1','smoke')||{}).id, ribsDev:(cookerFor('cut-7','smoke')||{}).id };
  })()`) as any;
  expect(r.hasAdvisory).toBe(false);      // both resolved → prompt gone
  expect(r.brisketDev).toBe('sm1');
  expect(r.ribsDev).toBe('sm2');
});
