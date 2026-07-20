import { test, expect } from '@playwright/test';

const boot = async (page: any, kit: any[] = []) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    if (k.length) { localStorage.setItem('mk-equipment', JSON.stringify(k)); localStorage.setItem('mk-equip-set', JSON.stringify(true)); }
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof propOf==='function' && Array.isArray(EQUIP_CATS)`);
};

test('O1: every cooker type has an areaCm2 class default', async ({ page }) => {
  await boot(page);
  const missing = await page.evaluate(`(function(){
    var out=[];
    ['smoker','grill'].forEach(function(cat){
      var c=EQUIP_CATS.find(function(x){return x.cat===cat;});
      var p=(c.props||[]).find(function(x){return x.key==='areaCm2';});
      if(!p){ out.push(cat+': no areaCm2 prop'); return; }
      (c.types||[]).forEach(function(tp){
        var v=propDef(cat,'areaCm2',tp);
        if(typeof v!=='number' || !(v>0)) out.push(cat+'/'+tp+' -> '+v);
      });
    });
    return out;
  })()`) as string[];
  expect(missing, `types with no usable areaCm2 default: ${missing.join(' | ')}`).toEqual([]);
});

test('O2: a stored areaCm2 overrides the class default', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'שלי', cap: { areaCm2: 7200 } }]);
  const r = await page.evaluate(`(function(){
    var d=equipByCat('smoker')[0];
    return { stored: propOf(d,'areaCm2'), classDefault: propDef('smoker','areaCm2','ארון / קבינט') };
  })()`) as any;
  expect(r.stored).toBe(7200);
  expect(r.classDefault).not.toBe(7200);
});

test('O3: area units convert (in² and m² -> cm²)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var p=EQUIP_CATS.find(function(c){return c.cat==='smoker';}).props.find(function(x){return x.key==='areaCm2';});
    return { inch: propParse(p,'800in2'), metre: propParse(p,'0.5m2'), bare: propParse(p,'4400') };
  })()`) as any;
  expect(Math.round(r.inch.v)).toBe(5161);   // 800 in² = 5161.3 cm²
  expect(Math.round(r.metre.v)).toBe(5000);  // 0.5 m² = 5000 cm²
  expect(r.bare.v).toBe(4400);
});
