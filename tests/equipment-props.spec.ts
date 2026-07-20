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

test('E3b: propParse converts exactly once, reports .conv accurately, and rejects mismatched suffixes', async ({ page }) => {
  await boot(page);
  const P = `EQUIP_CATS.find(c=>c.cat==='smoker').props.find(p=>p.key==='maxC')`;
  const V = `EQUIP_CATS.find(c=>c.cat==='vacuum').props.find(p=>p.key==='bagW')`;
  const G = `EQUIP_CATS.find(c=>c.cat==='grinder').props.find(p=>p.key==='throughput')`; // maxKg-like prop with lb->kg in alt

  // suffix conversion applies exactly once and reports the conversion used
  expect(await page.evaluate(`propParse(${P}, '500F').v`)).toBe(260);
  expect(await page.evaluate(`propParse(${P}, '500F').conv`)).toBe('F->C');
  // bare number (no suffix) = canonical unit, no conversion
  expect(await page.evaluate(`propParse(${P}, '210').v`)).toBe(210);
  expect(await page.evaluate(`propParse(${P}, '210').conv`)).toBe(null);
  // DEFECT 2: propParse must report the conversion it actually applied
  expect(await page.evaluate(`propParse(${V}, '300mm').v`)).toBe(30);
  expect(await page.evaluate(`propParse(${V}, '300mm').conv`)).toBe('mm->cm');
  // DEFECT 1: 3000mm -> 300cm is implausible; must NOT be converted a second time by propCoerce's alt fallback
  expect(await page.evaluate(`propParse(${V}, '3000mm')`)).toBe(null);
  // DEFECT 3: a length suffix on a temperature property is a dimension mismatch -> reject, never silently accept
  expect(await page.evaluate(`propParse(${P}, '300mm')`)).toBe(null);
  // case-insensitive suffix matching
  expect(await page.evaluate(`propParse(${P}, '500f')`)).toEqual({ v: 260, conv: 'F->C' });
  // space between number and suffix is tolerated
  expect(await page.evaluate(`propParse(${G}, '11 lb').v`)).toBe(4.99);
  expect(await page.evaluate(`propParse(${G}, '11 lb').conv`)).toBe('lb->kg');
  // non-numeric / empty text -> null, never a guess
  expect(await page.evaluate(`propParse(${P}, 'abc')`)).toBe(null);
  expect(await page.evaluate(`propParse(${P}, '')`)).toBe(null);
});

test('E4: cooler is ownable; grinder has a plates list; accessories carry numeric props', async ({ page }) => {
  await boot(page);
  // the cooler was in the recipe vocabulary but not ownable — recipes could require unownable gear
  expect(await page.evaluate(`EQUIP_OTHER_ITEMS.some(x=>x.key==='cooler')`)).toBe(true);
  expect(await page.evaluate(`(EQUIP_OTHER_ITEMS.find(x=>x.key==='cooler')||{}).em`)).toBeTruthy();
  // grinder plates reuse the existing multiCap mechanism (same as stuffer nozzles)
  const g = await page.evaluate(`(EQUIP_CATS.find(c=>c.cat==='grinder')||{}).multiCap`) as any;
  expect(g && g.key).toBe('plates');
  expect(g.uHe).toBeTruthy(); expect(g.em).toBeTruthy();
  // numeric accessory properties
  const scale = await page.evaluate(`(EQUIP_OTHER_ITEMS.find(x=>x.key==='scale').props||[]).map(p=>p.key)`) as string[];
  expect(scale).toContain('maxKg');
  const hooks = await page.evaluate(`(EQUIP_OTHER_ITEMS.find(x=>x.key==='hooks').props||[]).map(p=>p.key)`) as string[];
  expect(hooks).toContain('count');
  // every accessory property also declares an icon
  const bad = await page.evaluate(`(function(){const o=[];EQUIP_OTHER_ITEMS.forEach(function(x){(x.props||[]).forEach(function(p){if(!p.em)o.push(x.key+'.'+p.key);});});return o;})()`) as string[];
  expect(bad).toEqual([]);
});

test('E5: accessory properties declare tier and kind; propOf resolves them via EQUIP_OTHER_ITEMS', async ({ page }) => {
  await boot(page);
  // sibling of E2, but for accessories (EQUIP_OTHER_ITEMS) instead of categories (EQUIP_CATS)
  const bad = await page.evaluate(`(function(){
    const out=[];
    EQUIP_OTHER_ITEMS.forEach(function(x){ (x.props||[]).forEach(function(p){
      if(!p.em) out.push(x.key+'.'+p.key+' missing em');
      if(['core','pro'].indexOf(p.tier)<0) out.push(x.key+'.'+p.key+' bad tier');
      if(['num','bool','choice'].indexOf(p.kind)<0) out.push(x.key+'.'+p.key+' bad kind');
    }); });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
  // propOf must resolve accessory device props by looking up EQUIP_OTHER_ITEMS via dev.type (the accessory key)
  expect(await page.evaluate(`propOf({cat:'other',type:'curechamber',cap:{}},'tempC')`)).toBe(13);
  expect(await page.evaluate(`propOf({cat:'other',type:'curechamber',cap:{}},'rhPct')`)).toBe(78);
  expect(await page.evaluate(`propOf({cat:'other',type:'humidity',cap:{}},'rhPct')`)).toBe(78);
  // stored value still wins over the class default
  expect(await page.evaluate(`propOf({cat:'other',type:'curechamber',cap:{tempC:4}},'tempC')`)).toBe(4);
  // the existing category path must remain byte-identical
  expect(await page.evaluate(`propOf({cat:'smoker',type:'פלטים',cap:{}},'maxC')`)).toBe(260);
});

test('E6: device cards show property chips with icons', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'s1',cat:'smoker',type:'ארון / קבינט',name:'אביה',cap:{racks:5,maxC:150,canHang:true}}]); equipSetConfigured(); openEquipment();`);
  await page.waitForSelector('#panel .eq-dev');
  const chips = await page.evaluate(`[...document.querySelectorAll('#panel .eq-dev-chips .eq-chip')].map(x=>x.textContent.trim())`) as string[];
  expect(chips.join(' | ')).toContain('🌡️');            // maxC chip with its icon
  expect(chips.join(' | ')).toContain('150');
  expect(chips.join(' | ')).toContain('🪝');            // canHang chip
  // a property left at its class default is NOT chipped (chips show what you set / what matters)
  await page.evaluate(`equipSave([{id:'s2',cat:'smoker',type:'פלטים',name:'P',cap:{racks:2}}]); openEquipment();`);
  await page.waitForSelector('#panel .eq-dev');
});

test('E6b: core props render inline with icons; pro props hide in Advanced; values persist', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'s1',cat:'smoker',type:'פלטים',name:'X',cap:{racks:2}}]); equipSetConfigured(); openEquipment();`);
  await page.click('#panel [data-eqedit="s1"]');
  await page.waitForSelector('#panel #eqProp-maxC');
  // core visible, pro inside a collapsed <details>
  expect(await page.evaluate(`!!document.querySelector('#panel #eqProp-maxC')`)).toBe(true);
  expect(await page.evaluate(`!!document.querySelector('#panel #eqProp-canHang')`)).toBe(true);
  expect(await page.evaluate(`!!document.querySelector('#panel .eq-adv #eqProp-hooks')`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#panel .eq-adv').open`)).toBe(false);
  // the class default shows as the placeholder, so an empty field is not "missing"
  expect(await page.evaluate(`document.querySelector('#panel #eqProp-maxC').placeholder`)).toContain('260');
  // every property label carries its icon
  expect(await page.evaluate(`document.querySelector('#panel [data-propfor="maxC"]').textContent`)).toContain('🌡️');
  // set and persist
  await page.fill('#panel #eqProp-maxC', '210');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`(equipList()[0].cap||{}).maxC===210`);
  // bool round-trips
  await page.click('#panel [data-eqedit="s1"]');
  await page.waitForSelector('#panel #eqProp-canHang');
  expect(await page.evaluate(`propOf(equipList()[0],'maxC')`)).toBe(210);
});

test('E7: AI lookup extracts properties, bounds them via propCoerce, and never invents', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k')`);
  // in-range values are kept as given (canonical unit, no conversion needed)
  await page.evaluate(`window.__aiMock={name:'X',subtype:'פלטים',maxC:260,canHang:false,waterPan:true};`);
  let r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(260);
  expect(r.props.waterPan).toBe(true);
  expect(r.props.canHang).toBe(false);          // bool `false` must pass through, not be treated as absent
  // out-of-range but a unit explains it -> CONVERTED, not discarded (a US page reporting °F)
  await page.evaluate(`window.__aiMock={maxC:900};`);
  r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(482.22);
  // out-of-range and NOTHING explains it -> discarded (a wrong value is worse than an absent one)
  await page.evaluate(`window.__aiMock={maxC:99999};`);
  r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(undefined);
  // null means "the page didn't say" -> absent, so the class default applies
  await page.evaluate(`window.__aiMock={maxC:null};`);
  r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(undefined);
  // vacuum seal width bounded too, via the same propCoerce path — implausible in any unit -> discarded
  await page.evaluate(`window.__aiMock={bagW:9999};`);
  r = await page.evaluate(`aiLookupDevice('x','vacuum')`) as any;
  expect(r.props.bagW).toBe(undefined);
  // ...while a value only plausible in mm converts rather than being rejected (300mm -> 30cm)
  await page.evaluate(`window.__aiMock={bagW:300};`);
  r = await page.evaluate(`aiLookupDevice('x','vacuum')`) as any;
  expect(r.props.bagW).toBe(30);
});

test('E7b: manual numeric prop input goes through propParse — unit suffix converts, mismatched unit is rejected', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'s1',cat:'smoker',type:'פלטים',name:'X',cap:{racks:2}}]); equipSetConfigured(); openEquipment();`);
  // typing '500F' into max-temp must store the CONVERTED value (260), never the raw 500
  await page.click('#panel [data-eqedit="s1"]');
  await page.waitForSelector('#panel #eqProp-maxC');
  await page.fill('#panel #eqProp-maxC', '500F');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`(equipList()[0].cap||{}).maxC===260`);
  // typing '300mm' into the same field is a dimension mismatch — must be REJECTED, not stored as 300
  await page.click('#panel [data-eqedit="s1"]');
  await page.waitForSelector('#panel #eqProp-maxC');
  await page.fill('#panel #eqProp-maxC', '300mm');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`!(equipList()[0].cap||{}).hasOwnProperty('maxC')`);
});
