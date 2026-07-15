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
