import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof propOf==='function' && Array.isArray(EQUIP_CATS)`);
};

test('E1: every props[].def key is a real type string (build gate)', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    const out=[];
    EQUIP_CATS.forEach(function(c){
      (c.props||[]).forEach(function(p){
        if(p.def && typeof p.def==='object'){
          Object.keys(p.def).forEach(function(k){
            if((c.types||[]).indexOf(k)<0) out.push(c.cat+'.'+p.key+' -> '+k);
          });
        }
      });
    });
    return out;
  })()`) as string[];
  expect(bad, `def keys not present in types[]: ${bad.join(' | ')}`).toEqual([]);
});

test('E2: every property declares an icon and a tier', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    const out=[];
    EQUIP_CATS.forEach(function(c){ (c.props||[]).forEach(function(p){
      if(!p.em) out.push(c.cat+'.'+p.key+' missing em');
      if(['core','pro'].indexOf(p.tier)<0) out.push(c.cat+'.'+p.key+' bad tier');
      if(['num','bool','choice'].indexOf(p.kind)<0) out.push(c.cat+'.'+p.key+' bad kind');
    }); });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
});

test('E3: propOf resolves stored value -> class default -> undefined', async ({ page }) => {
  await boot(page);
  // unset -> class default by type
  expect(await page.evaluate(`propOf({cat:'smoker',type:'פלטים',cap:{}},'maxC')`)).toBe(260);
  expect(await page.evaluate(`propOf({cat:'smoker',type:'חשמלי',cap:{}},'maxC')`)).toBe(135);
  // stored wins
  expect(await page.evaluate(`propOf({cat:'smoker',type:'פלטים',cap:{maxC:200}},'maxC')`)).toBe(200);
  // no default, not stored -> undefined
  expect(await page.evaluate(`propOf({cat:'smoker',type:'פלטים',cap:{}},'hooks')`)).toBe(undefined);
  // UNITS: an out-of-range number is usually the wrong unit, not nonsense — convert, never discard
  const P = `EQUIP_CATS.find(c=>c.cat==='smoker').props.find(p=>p.key==='maxC')`;
  expect(await page.evaluate(`propCoerce(${P}, 260).v`)).toBe(260);          // plausible as °C -> untouched
  expect(await page.evaluate(`propCoerce(${P}, 500).v`)).toBe(500);          // 500°C is real (lava/kamado)
  expect(await page.evaluate(`propCoerce(${P}, 900).v`)).toBe(482.22);       // impossible in °C -> 900°F
  expect(await page.evaluate(`propCoerce(${P}, 900).conv`)).toBe('F->C');    // and it says so
  expect(await page.evaluate(`propCoerce(${P}, 99999)`)).toBe(null);         // implausible everywhere
  const V = `EQUIP_CATS.find(c=>c.cat==='vacuum').props.find(p=>p.key==='bagW')`;
  expect(await page.evaluate(`propCoerce(${V}, 300).v`)).toBe(30);           // 300 mm -> 30 cm
  expect(await page.evaluate(`propCoerce(${V}, 30).v`)).toBe(30);            // already cm -> untouched
  // manual entry accepts a unit suffix, so typing "500F" or "300mm" is not a trap
  expect(await page.evaluate(`propParse(${P}, '500F').v`)).toBe(260);
  expect(await page.evaluate(`propParse(${V}, '300mm').v`)).toBe(30);
  expect(await page.evaluate(`propParse(${P}, '210').v`)).toBe(210);         // bare number = canonical unit
  // unknown key -> undefined, never a throw
  expect(await page.evaluate(`propOf({cat:'smoker',type:'פלטים',cap:{}},'nope')`)).toBe(undefined);
  // bool default
  expect(await page.evaluate(`propOf({cat:'grill',type:'פלנצ׳ה / פלטה',cap:{}},'lid')`)).toBe(false);
  expect(await page.evaluate(`propOf({cat:'grill',type:'פחם',cap:{}},'lid')`)).toBe(true);
});
