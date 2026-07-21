import { test, expect } from '@playwright/test';

// Owner complaint #2: "all the devices including sous vide have title ovens". תנור means OVEN specifically
// and is also the app's oven CATEGORY name, so using it as the generic word for a smoker / grill / bath is
// simply wrong. The generic term is מכשיר. This fences the regression.

test('H1: the occupancy view of a SOUS-VIDE bath never calls it an oven', async ({ page }) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id:'s1', cat:'sousvide', type:'טבילה (immersion)', name:'אמבט', cap:{ baths:[12] } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyViewHtml==='function' && typeof deviceOccupancy==='function'`);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('cut-9'), stages:[{kind:'sv', start:new Date(t0), end:new Date(t0+6*3600e3), temp:56}] };
    setItemCooker('cut-9','sv','s1');
    var html=occupancyViewHtml([item], t0+1*3600e3, null);
    var div=document.createElement('div'); div.innerHTML=html;
    return { text:div.textContent||'' };
  })()`) as any;
  expect(r.text.length).toBeGreaterThan(0);
  expect(r.text).not.toContain('תנור');       // a bath is not an oven
});

test('H2: no user-facing string uses תנור as the generic word for a cooker', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(`typeof L==='function'`);
  // the phrases that used to say "oven" when they meant "any cooker"
  const generic = await page.evaluate(`(function(){
    var bad=[];
    [['תפוסת התנורים','occupancy title'],['תפוסת תנורים','occupancy button'],['לא הוגדרו תנורים','empty state'],
     ['התנגשות תנור','clash'],['שיוך תנור','assign'],['ממתין לשיוך תנור','awaiting assignment'],
     ['מה נמצא על כל תנור','occupancy subtitle']].forEach(function(p){
       if(document.documentElement.innerHTML.indexOf(p[0])>=0) bad.push(p[0]+' ('+p[1]+')');
     });
    return bad;
  })()`) as string[];
  expect(generic, `generic 'oven' wording still present: ${generic.join(' | ')}`).toEqual([]);
});

test('H3: the oven CATEGORY itself is still called תנור — the word is correct there', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(`Array.isArray(EQUIP_CATS)`);
  const he = await page.evaluate(`(EQUIP_CATS.find(function(c){return c.cat==='oven';})||{}).he`) as string;
  expect(he).toBe('תנור');   // an oven really is an oven; only the GENERIC use was wrong
});
