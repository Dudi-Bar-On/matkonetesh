import { test, expect } from '@playwright/test';

const boot = async (page: any, seedGear?: any) => {
  await page.addInitScript((g: any) => {
    try {
      localStorage.clear(); localStorage.setItem('mk-lang', JSON.stringify('en')); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      if (g) { localStorage.setItem('mk-gear', JSON.stringify(g)); localStorage.setItem('mk-gear-set', JSON.stringify(true)); }
    } catch {}
  }, seedGear);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof equipList==='function' && typeof equipMigrateFromGear==='function'`);
};

test('T1: migration seeds devices from mk-gear; aggregators work', async ({ page }) => {
  await boot(page, { smoker: 'אופסט / סטיק-ברנר', grill: 'קטל', sousvide: 'טבילה (immersion)', thermo: 'פרוב אלחוטי', grinder: 'ייעודית', torch: 'יש', humidity: 'אין' });
  const list = await page.evaluate(`equipList()`) as any[];
  expect(list.length).toBe(6);                                  // smoker/grill/sousvide/thermo/grinder/torch; 'אין' humidity skipped
  expect(await page.evaluate(`equipConfigured()`)).toBe(true);
  expect(await page.evaluate(`hasCat('sousvide')`)).toBe(true);
  expect(await page.evaluate(`primaryOf('smoker').type`)).toBe('אופסט / סטיק-ברנר');
  expect(await page.evaluate(`equipByCat('probe').length`)).toBe(1);  // thermo → probe
  expect(await page.evaluate(`hasGear('torch')`)).toBe(true);         // extra gear queryable
  await page.evaluate(`(function(){ const l=equipList(); l.push({id:equipId(),cat:'probe',type:'פרוב אלחוטי',name:'MEATER',cap:{channels:4}}); l.push({id:equipId(),cat:'probe',type:'פרוב נעוץ',name:'Inkbird',cap:{channels:4}}); equipSave(l); })()`);
  expect(await page.evaluate(`probeChannels()`)).toBe(8);
  await page.evaluate(`equipMigrateFromGear()`);
  expect((await page.evaluate(`equipList()`) as any[]).length).toBe(8);   // idempotent, no double-seed (6 migrated + 2 probes)
});

test('T2: capabilities are computed from the device list', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:equipId(),cat:'grill',type:'קטל',name:'Weber'}]); equipSetConfigured();`);
  expect(await page.evaluate(`canGrill()`)).toBe(true);
  expect(await page.evaluate(`canSmoke()`)).toBe(true);   // kettle grill can smoke
  expect(await page.evaluate(`canSV()`)).toBe(false);
  expect(await page.evaluate(`homeGear().canGrill`)).toBe(true);
  await page.evaluate(`equipSave([{id:equipId(),cat:'sousvide',type:'טבילה (immersion)',name:'Anova'}]);`);
  expect(await page.evaluate(`canSV()`)).toBe(true);
  expect(await page.evaluate(`canGrill()`)).toBe(false);
  expect(await page.evaluate(`gearConfigured()`)).toBe(true);
});

test('T3: tips and notes read the device list', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:equipId(),cat:'smoker',type:'פלטים',name:'Traeger'}]); equipSetConfigured(); setLang('en');`);
  expect(await page.evaluate(`preheatHint()`)).toContain('pellet');
  expect((await page.evaluate(`smokerTip()`) as string).length).toBeGreaterThan(0);
  const note = await page.evaluate(`gearThermoNote({safe:74})`) as string;
  expect(note).toContain('thermometer');
});

test('T4: concierge writes device entries into mk-equipment', async ({ page }) => {
  await boot(page);
  await page.evaluate(`gearConciergeApply(gearFromText('a pellet smoker, a weber kettle and a MEATER'), 'mid')`);
  expect(await page.evaluate(`hasCat('smoker')`)).toBe(true);
  expect(await page.evaluate(`hasCat('grill')`)).toBe(true);
  expect(await page.evaluate(`hasCat('probe')`)).toBe(true);           // MEATER → wireless probe
  expect(await page.evaluate(`primaryOf('smoker').type`)).toContain('פלט');
  expect(await page.evaluate(`equipConfigured()`)).toBe(true);
  expect(await page.evaluate(`store.get('mk-uilevel')`)).toBe('mid');
});

test('T5: manager adds/removes devices; settings opens it', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqAdd');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.selectOption('#panel #eqType', 'פלטים');
  await page.fill('#panel #eqName', 'My Traeger');
  await page.fill('#panel #eqCapKey', '2');
  await page.click('#panel #eqAdd');
  await page.waitForSelector('#panel .eq-card');
  expect(await page.evaluate(`equipByCat('smoker').length`)).toBe(1);
  expect(await page.evaluate(`primaryOf('smoker').cap.racks`)).toBe(2);
  expect(await page.evaluate(`equipConfigured()`)).toBe(true);
  await page.click('#panel .eq-rm');
  expect(await page.evaluate(`equipByCat('smoker').length`)).toBe(0);
  expect(await page.evaluate(`typeof openEquipment==='function' && typeof openGear==='undefined'`)).toBe(true);
});

test('B1: aiLookupDevice + aiBrandModels normalize AI output; no-key guarded', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiMock={fuel:'pellet',racks:3,zones:null,channels:null,bathL:null,note:'stainless'};`);
  const r = await page.evaluate(`aiLookupDevice('Traeger Pro 575','smoker')`) as any;
  expect(r.fuel).toBe('pellet'); expect(r.cap.racks).toBe(3); expect(r.cap.zones).toBeUndefined();
  await page.evaluate(`window.__aiMock={models:['Pro 575','Ironwood 885','Timberline']}`);
  const m = await page.evaluate(`aiBrandModels('Traeger','smoker')`) as string[];
  expect(m).toContain('Ironwood 885'); expect(m.length).toBe(3);
  expect(await page.evaluate(`(EQUIP_BRANDS.probe||[]).includes('MEATER')`)).toBe(true);
  await page.evaluate(`store.set('mk-gemkey',''); window.__aiMock=null;`);
  expect(await page.evaluate(`aiLookupDevice('x','smoker').then(()=>'ok').catch(e=>String(e.message))`)).toContain('no-key');
});

test('B2: in-place edit + AI lookup prefills; no-key hides AI buttons', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'eq-1',cat:'smoker',type:'פלטים',name:'Old Name',cap:{racks:1}}]); equipSetConfigured();`);
  // no key → AI buttons hidden
  await page.evaluate(`store.set('mk-gemkey',''); openEquipment();`);
  await page.waitForSelector('#panel #eqAdd');
  expect(await page.evaluate(`!document.querySelector('#panel #eqLookup')`)).toBe(true);
  // edit the device in place
  await page.click('#panel [data-eqedit="eq-1"]');
  await page.waitForFunction(`(document.querySelector('#panel #eqName')||{}).value==='Old Name'`);
  await page.fill('#panel #eqName','New Name');
  await page.click('#panel #eqAdd');   // Save
  await page.waitForTimeout(120);
  expect(await page.evaluate(`equipList().length`)).toBe(1);   // updated, not duplicated
  expect(await page.evaluate(`equipList()[0].name`)).toBe('New Name');
  // with key → AI lookup appears + prefills capacity
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiMock={fuel:'pellet',racks:4,note:'x'}; openEquipment();`);
  await page.waitForSelector('#panel #eqLookup');
  await page.selectOption('#panel #eqCat','smoker');
  await page.fill('#panel #eqName','Traeger Ironwood');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='4'`);
  expect(await page.evaluate(`(document.querySelector('#panel #eqCapKey')||{}).value`)).toBe('4');
});

test('C1: cookerFor resolves (single-fit auto, ambiguous→pick, assignment)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'sm1',cat:'smoker',type:'אופסט / סטיק-ברנר',name:'Big Offset'}]); equipSetConfigured();`);
  expect(await page.evaluate(`(cookerFor('cut-1','smoke')||{}).name`)).toBe('Big Offset');   // single-fit auto
  await page.evaluate(`equipSave([{id:'sm1',cat:'smoker',type:'אופסט / סטיק-ברנר',name:'Big Offset'},{id:'sm2',cat:'smoker',type:'פלטים',name:'Pellet'}]);`);
  expect(await page.evaluate(`cookerFor('cut-1','smoke')`)).toBe(null);   // 2 smokers → ambiguous
  await page.evaluate(`setItemCooker('cut-1','smoke','sm2')`);
  expect(await page.evaluate(`(cookerFor('cut-1','smoke')||{}).name`)).toBe('Pellet');
  expect(await page.evaluate(`cookerLabel('cut-1','smoke')`)).toBe('Pellet');
  // a charcoal grill counts as a smoke candidate
  await page.evaluate(`equipSave([{id:'g1',cat:'grill',type:'פחם',name:'Kettle'}]);`);
  expect(await page.evaluate(`(cookerFor('cut-1','smoke')||{}).name`)).toBe('Kettle');   // now single smoke-capable device
});
