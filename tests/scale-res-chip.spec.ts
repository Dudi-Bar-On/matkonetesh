import { test, expect } from '@playwright/test';

// scale_res ships on 67 cured recipes (54 makes + 13 specials) as a dosing-precision
// recommendation but had no consumer: equipSpecNote() never read it, and openMake/openSpec
// never rendered an equipment section at all (only openCut did). This spec proves the note
// now actually reaches the DOM on a make and a special that carry scale_res, and stays absent
// where scale_res is absent (a plain cut).

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openMake==='function' && typeof openSpec==='function' && typeof openCut==='function' && typeof equipSectionHtml==='function'`);
};

test('S1: a cured MAKE with scale_res renders an eq-sec with a scale chip and the dosing note', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    var key=Object.keys(DATA.makes).find(function(k){return DATA.makes[k].equip && DATA.makes[k].equip.spec && DATA.makes[k].equip.spec.scale_res;});
    if(!key) return {key:null};
    openMake(key);
    await new Promise(function(res){setTimeout(res,700);});
    var s=document.querySelector('.eq-sec');
    return { key: key, present: !!s, html: s ? s.innerHTML : '', text: s ? s.innerText : '' };
  })()`) as any;
  expect(r.key, 'no cured make with scale_res found in DATA.makes').not.toBeNull();
  console.log('S1 make key:', r.key);
  expect(r.present).toBe(true);
  expect(r.text).toMatch(/⚖️|משקל/);
  expect(r.html).toContain('משקל ≥ 0.1g');
});

test('S2: a cured SPECIAL with scale_res renders an eq-sec with the dosing note', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    var s0=DATA.specials.find(function(s){return s.equip && s.equip.spec && s.equip.spec.scale_res;});
    if(!s0) return {n:null};
    openSpec(s0);
    await new Promise(function(res){setTimeout(res,700);});
    var s=document.querySelector('.eq-sec');
    return { n: s0.n, present: !!s, html: s ? s.innerHTML : '', text: s ? s.innerText : '' };
  })()`) as any;
  expect(r.n, 'no cured special with scale_res found in DATA.specials').not.toBeNull();
  console.log('S2 special n:', r.n);
  expect(r.present).toBe(true);
  expect(r.text).toMatch(/⚖️|משקל/);
  expect(r.html).toContain('משקל ≥ 0.1g');
});

test('S3: a non-cured item with no scale_res does not render the dosing note (negative case)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    var c=DATA.cuts.find(function(c){return !(c.equip && c.equip.spec && c.equip.spec.scale_res);});
    if(!c) return {n:null};
    openCut(c);
    await new Promise(function(res){setTimeout(res,700);});
    var s=document.querySelector('.eq-sec');
    return { n: c.n, present: !!s, html: s ? s.innerHTML : '' };
  })()`) as any;
  expect(r.n, 'no non-cured cut found in DATA.cuts').not.toBeNull();
  console.log('S3 cut n:', r.n);
  // the section may or may not be present (cuts have no scale_res at all), but either way
  // the cure-dosing scale note must never appear
  expect(r.html).not.toContain('למינון קיור');
});

test('S4: the scale note renders in Hebrew with no Latin leak (unit token excepted)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    var key=Object.keys(DATA.makes).find(function(k){return DATA.makes[k].equip && DATA.makes[k].equip.spec && DATA.makes[k].equip.spec.scale_res;});
    if(!key) return {note:null};
    openMake(key);
    await new Promise(function(res){setTimeout(res,700);});
    var specs=document.querySelectorAll('.eq-spec');
    var note=null;
    for(var i=0;i<specs.length;i++){ if(specs[i].textContent.indexOf('למינון קיור')>=0){ note=specs[i].textContent; break; } }
    return { note: note };
  })()`) as any;
  expect(r.note).not.toBeNull();
  // strip the app-controlled unit token '0.1g' (ASCII digits+letter are expected/allowed), then
  // assert no OTHER Latin letters leaked into the Hebrew note
  const stripped = (r.note as string).replace(/0\.1g/g, '');
  expect(stripped).not.toMatch(/[A-Za-z]/);
  expect(r.note).toContain('משקל ≥ 0.1g (למינון קיור מדויק)');
});
