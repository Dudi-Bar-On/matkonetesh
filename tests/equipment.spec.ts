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
  await page.waitForSelector('#panel [data-eqpick="smoker"]');   // empty state: quick-add category chips
  await page.click('#panel [data-eqpick="smoker"]');              // → add form for smoker
  await page.waitForSelector('#panel #eqSave');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.selectOption('#panel #eqType', 'פלטים');
  await page.fill('#panel #eqName', 'My Traeger');
  await page.fill('#panel #eqCapKey', '2');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.evaluate(`equipByCat('smoker').length`)).toBe(1);
  expect(await page.evaluate(`primaryOf('smoker').cap.racks`)).toBe(2);
  expect(await page.evaluate(`equipConfigured()`)).toBe(true);
  await page.click('#panel [data-eqrm]');            // remove
  expect(await page.evaluate(`equipByCat('smoker').length`)).toBe(0);
  expect(await page.evaluate(`typeof openEquipment==='function' && typeof openGear==='undefined'`)).toBe(true);
});

test('B1: aiLookupDevice + aiBrandModels normalize AI output; no-key guarded', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiMock={fuel:'pellet',racks:3,zones:null,channels:null,bathL:null,note:'stainless'};`);
  const r = await page.evaluate(`aiLookupDevice('Traeger Pro 575','smoker')`) as any;
  expect(r.fuel).toBe('pellet'); expect(r.cap.racks).toBe(3); expect(r.cap.zones).toBeUndefined();
  await page.evaluate(`window.__aiMock={models:[{name:'Pro 575',spec:'Pellet · 2 racks'},{name:'Ironwood 885',spec:'Pellet · 3 racks'},'Timberline']}`);
  const m = await page.evaluate(`aiBrandModels('Traeger','smoker')`) as Array<{name:string,spec:string}>;
  expect(m.map(x=>x.name)).toContain('Ironwood 885'); expect(m.length).toBe(3);
  expect(m[0]).toHaveProperty('spec');   // catalogue cards render a spec line
  expect(await page.evaluate(`(EQUIP_BRANDS.probe||[]).includes('MEATER')`)).toBe(true);
  await page.evaluate(`store.set('mk-gemkey',''); window.__aiMock=null;`);
  expect(await page.evaluate(`aiLookupDevice('x','smoker').then(()=>'ok').catch(e=>String(e.message))`)).toContain('no-key');
});

test('B6: "Other" is an accessories checklist (presets toggle; add a custom item; hasGear consistent)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'s1',cat:'smoker',type:'פלטים',name:'X',cap:{racks:2}}]); equipSetConfigured(); openEquipment();`);
  await page.waitForSelector('#panel #eqAddNew');
  await page.click('#panel #eqAddNew');                                  // header Add → picker
  await page.click('#panel [data-eqpick="other"]');                      // Other → the checklist (not a device form)
  await page.waitForSelector('#panel .eq-othlist');
  expect(await page.evaluate(`!document.querySelector('#panel #eqLookupQ') && !document.querySelector('#panel #eqName')`)).toBe(true);   // no name/lookup form
  expect(await page.evaluate(`document.querySelectorAll('#panel [data-eqothkey]').length`)).toBeGreaterThan(8);
  // check "torch" preset → device added + hasGear('torch') true (drives recipe finishing tips)
  await page.click('#panel [data-eqothkey="torch"]');
  await page.waitForFunction(`equipByCat('other').some(d=>d.type==='torch')`);
  expect(await page.evaluate(`hasGear('torch')`)).toBe(true);
  expect(await page.evaluate(`document.querySelector('#panel [data-eqothkey="torch"]').classList.contains('on')`)).toBe(true);
  await page.click('#panel [data-eqothkey="torch"]');                    // uncheck → removed
  await page.waitForFunction(`!equipByCat('other').some(d=>d.type==='torch')`);
  expect(await page.evaluate(`hasGear('torch')`)).toBe(false);
  // add a CUSTOM accessory ("scale") → appears as its own removable row + persists
  await page.fill('#panel #eqOthNew', 'משקל דיגיטלי');
  await page.click('#panel #eqOthAdd');
  await page.waitForFunction(`equipByCat('other').some(d=>d.name==='משקל דיגיטלי')`);
  expect(await page.evaluate(`document.querySelectorAll('#panel [data-eqothdev]').length`)).toBe(1);
  await page.click('#panel [data-eqothdev]');                            // click the custom row → removes it
  await page.waitForFunction(`!equipByCat('other').some(d=>d.name==='משקל דיגיטלי')`);
});

test('B7: pre-defined custom "Other" items appear in the checklist as editable rows (not orphaned)', async ({ page }) => {
  await boot(page);
  // a preset item (torch) + a CUSTOM item defined before (a scale) — the exact "defined before" case
  await page.evaluate(`equipSave([{id:'o1',cat:'other',type:'torch',name:'מבער / לפיד',cap:{}},{id:'o2',cat:'other',type:'scale',name:'משקל דיגיטלי',cap:{}}]); equipSetConfigured(); openEquipment();`);
  await page.waitForSelector('#panel .eq-othchips');
  expect(await page.evaluate(`document.querySelectorAll('#panel .eq-othchips .eq-chip').length`)).toBe(2);   // both show as chips
  expect(await page.evaluate(`!!document.querySelector('#panel .eq-dev')`)).toBe(false);                     // chips, not device cards
  await page.click('#panel [data-eqaddcat="other"]');                    // "Edit accessories"
  await page.waitForSelector('#panel .eq-othlist');
  expect(await page.evaluate(`document.querySelector('#panel [data-eqothkey="torch"]').getAttribute('aria-checked')`)).toBe('true');   // preset pre-checked
  // the custom "scale" is NOT dropped — it shows as its own custom row and is removable
  expect(await page.evaluate(`[...document.querySelectorAll('#panel [data-eqothdev] .eq-oth-lbl')].map(x=>x.textContent).join('|')`)).toContain('משקל דיגיטלי');
  expect(await page.evaluate(`document.querySelector('#panel [data-eqothkey="board"]').getAttribute('aria-checked')`)).toBe('false');
});

test('B4: aiLookupDevice extracts metric + all category caps (volume/nozzles/area), rejects URL names', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k')`);
  // stuffer: cylinder volume (L) + output-tube sizes (mm) + extra details
  await page.evaluate(`window.__aiMock={name:'Hakka 5L SV-5', subtype:'אנכית', volume:5, nozzles:[10,20,30,40], note:'2-speed', details:'food-grade stainless'};`);
  const st = await page.evaluate(`aiLookupDevice('haka 5L','stuffer')`) as any;
  expect(st.name).toBe('Hakka 5L SV-5');
  expect(st.cap.volume).toBe(5);
  expect(st.nozzles).toEqual([10,20,30,40]);
  expect(st.details).toContain('stainless');
  // smoker: total area from areaCm2 (metric) + a stray cross-category cap is filtered out
  await page.evaluate(`window.__aiMock={name:'Traeger Pro 575', racks:2, channels:1, areaCm2:3703};`);
  const sm = await page.evaluate(`aiLookupDevice('traeger','smoker')`) as any;
  expect(sm.cap.racks).toBe(2);
  expect(sm.cap.channels).toBeUndefined();     // stray channels on a smoker → dropped
  expect(sm.area).toBe('3703 cm²');            // metric, not "575 in²"
  // a URL must NEVER become the device name (Hebrew search URLs render as %-escape codes)
  await page.evaluate(`window.__aiMock={name:'https://hakka.com/sv5', racks:1};`);
  expect(await page.evaluate(`aiLookupDevice('https://hakka.com/sv5','smoker').then(r=>r.name)`)).toBe('');
  // nozzles given as a loose string are parsed to mm numbers
  await page.evaluate(`window.__aiMock={volume:3, nozzles:'16, 22, 32 mm'};`);
  expect(await page.evaluate(`aiLookupDevice('x','stuffer').then(r=>JSON.stringify(r.nozzles))`)).toBe('[16,22,32]');
});

test('B5: acmFmt metric formatting + aiRepairJson recovers the malformed AI JSON that broke stuffer lookups', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`acmFmt(3703)`)).toBe('3703 cm²');
  expect(await page.evaluate(`acmFmt(20000)`)).toBe('2 m²');
  // the real failure: Gemini emitted `"nozzles":,` (empty value) → invalid JSON → whole lookup lost
  expect(await page.evaluate(`JSON.stringify(JSON.parse(aiRepairJson('{"a":1,"nozzles":,"b":null}')))`)).toBe('{"a":1,"nozzles":null,"b":null}');
  expect(await page.evaluate(`JSON.stringify(JSON.parse(aiRepairJson('{"a":[1,2,],"b":2,}')))`)).toBe('{"a":[1,2],"b":2}');
  expect(await page.evaluate(`JSON.stringify(JSON.parse(aiRepairJson('{"a":{},"b":[],"c":"x"}')))`)).toBe('{"a":{},"b":[],"c":"x"}');  // valid JSON untouched
});

test('B2: edit + AI lookup prefills; no-key hides AI buttons', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'eq-1',cat:'smoker',type:'פלטים',name:'Old Name',cap:{racks:1}}]); equipSetConfigured();`);
  // no key: open the edit form → no AI buttons
  await page.evaluate(`store.set('mk-gemkey',''); openEquipment();`);
  await page.waitForSelector('#panel [data-eqedit="eq-1"]');
  await page.click('#panel [data-eqedit="eq-1"]');
  await page.waitForSelector('#panel #eqSave');
  expect(await page.evaluate(`!document.querySelector('#panel #eqLookup')`)).toBe(true);
  await page.waitForFunction(`(document.querySelector('#panel #eqName')||{}).value==='Old Name'`);
  await page.fill('#panel #eqName','New Name');
  await page.click('#panel #eqSave');
  await page.waitForTimeout(120);
  expect(await page.evaluate(`equipList().length`)).toBe(1);   // updated, not duplicated
  expect(await page.evaluate(`equipList()[0].name`)).toBe('New Name');
  // with key: add a new device via the AI lookup
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiMock={fuel:'pellet',racks:4,note:'x'}; openEquipment();`);
  await page.waitForSelector('#panel #eqAddNew');
  await page.click('#panel #eqAddNew');                          // header Add → category picker
  await page.click('#panel [data-eqpick="smoker"]');             // pick Smoker → the form
  await page.waitForSelector('#panel #eqLookup');
  await page.selectOption('#panel #eqCat','smoker');
  await page.fill('#panel #eqName','Traeger Ironwood');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='4'`);
  expect(await page.evaluate(`(document.querySelector('#panel #eqCapKey')||{}).value`)).toBe('4');
});

test('B3: sous-vide multi-bath + stuffer volume/output-sizes (one device each); vacuum no-capacity; Hebrew sub-type labels', async ({ page }) => {
  await boot(page);
  // one sous-vide circulator, several bath sizes (12 & 24) → one device, multi-value list
  await page.evaluate(`openEquipment();`);
  await page.click('#panel [data-eqpick="sousvide"]');
  await page.waitForSelector('#panel #eqSave');
  expect(await page.evaluate(`!document.querySelector('#panel #eqCapKey')`)).toBe(true);   // no single-capacity field
  await page.fill('#panel #eqName', 'Anova');
  // add several bath instances via the chip editor (and remove one to prove add+remove)
  await page.fill('#panel #eqMultiIn', '12'); await page.click('#panel #eqMultiAdd');
  await page.fill('#panel #eqMultiIn', '40'); await page.click('#panel #eqMultiAdd');
  await page.fill('#panel #eqMultiIn', '24'); await page.click('#panel #eqMultiAdd');
  expect(await page.locator('#panel .eq-multi-chip').count()).toBe(3);
  await page.locator('#panel .eq-multi-chip .eq-multi-x').last().click();   // chips sort ascending → remove the 40 L
  expect(await page.locator('#panel .eq-multi-chip').count()).toBe(2);
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.evaluate(`primaryOf('sousvide').cap.baths`)).toEqual([12, 24]);
  expect(await page.evaluate(`equipByCat('sousvide').length`)).toBe(1);   // one device, not two
  // stuffer: cylinder volume (single) + output tube sizes (multi instances)
  await page.click('#panel #eqAddNew');
  await page.click('#panel [data-eqpick="stuffer"]');
  await page.waitForSelector('#panel #eqSave');
  expect(await page.evaluate(`(document.querySelector('#panel #eqCat')||{}).value`)).toBe('stuffer');
  await page.fill('#panel #eqName', 'LEM 5L');
  await page.fill('#panel #eqCapKey', '5');           // cylinder volume
  for (const s of ['16', '20', '26']) { await page.fill('#panel #eqMultiIn', s); await page.click('#panel #eqMultiAdd'); }
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.evaluate(`primaryOf('stuffer').cap.volume`)).toBe(5);
  expect(await page.evaluate(`primaryOf('stuffer').cap.nozzles`)).toEqual([16, 20, 26]);
  // vacuum: its own category, no capacity of any kind
  await page.click('#panel #eqAddNew');
  await page.click('#panel [data-eqpick="vacuum"]');
  await page.waitForSelector('#panel #eqSave');
  expect(await page.evaluate(`(document.querySelector('#panel #eqCat')||{}).value`)).toBe('vacuum');
  expect(await page.evaluate(`!document.querySelector('#panel #eqCapKey') && !document.querySelector('#panel #eqMultiWrap')`)).toBe(true);
  await page.fill('#panel #eqName', 'FoodSaver');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.evaluate(`equipByCat('vacuum').length`)).toBe(1);
  // typeLabel: Hebrew strips an English "(hint)", keeps a Hebrew one, and maps legacy 'other' keys
  expect(await page.evaluate(`setLang('he'); typeLabel('טבילה (immersion)')`)).toBe('טבילה');
  expect(await page.evaluate(`typeLabel('גז (עם תיבת עשן)')`)).toBe('גז (עם תיבת עשן)');
  expect(await page.evaluate(`typeLabel('torch')`)).toBe('מבער / לפיד');
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

test('C2: work plan labels the cooker on cook stages', async ({ page }) => {
  await boot(page);
  await page.evaluate(`(function(){
    equipSave([{id:'sv1',cat:'sousvide',type:'טבילה (immersion)',name:'My Bath'}]); equipSetConfigured();
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00'); store.set('mk-tlview','plan'); openTimeline();
  })()`);
  await page.waitForSelector('#panel .workplan');
  const txt = await page.evaluate(`document.querySelector('#panel .workplan').textContent`);
  expect(txt).toContain('My Bath');   // the single sous-vide device auto-labels the SV stage
});

test('P2: cookerContention flags overlapping same-cooker stages', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'sm1',cat:'smoker',type:'אופסט / סטיק-ברנר',name:'Offset'}]); equipSetConfigured();`);
  const clashes = await page.evaluate(`(function(){ const now=Date.now(); return cookerContention([
    {blocked:false, m:{key:'cut-1',heb:'A',eng:'A'}, stages:[{kind:'smoke',start:new Date(now),end:new Date(now+3600000)}]},
    {blocked:false, m:{key:'cut-2',heb:'B',eng:'B'}, stages:[{kind:'smoke',start:new Date(now+1800000),end:new Date(now+5400000)}]}
  ]); })()`) as any[];
  expect(clashes.length).toBe(1);
  expect(clashes[0].devName).toBe('Offset');
  const none = await page.evaluate(`(function(){ const now=Date.now(); return cookerContention([
    {blocked:false, m:{key:'cut-1',heb:'A',eng:'A'}, stages:[{kind:'smoke',start:new Date(now),end:new Date(now+3600000)}]},
    {blocked:false, m:{key:'cut-2',heb:'B',eng:'B'}, stages:[{kind:'smoke',start:new Date(now+7200000),end:new Date(now+10800000)}]}
  ]); })()`) as any[];
  expect(none.length).toBe(0);   // non-overlapping windows → no clash
});

test('P3: sous-vide — same-temp items share one bath (no clash); different temps clash', async ({ page }) => {
  await boot(page);
  await page.evaluate(`equipSave([{id:'sv1',cat:'sousvide',type:'טבילה (immersion)',name:'Anova',cap:{baths:[12,24]}}]); equipSetConfigured();`);
  // same temp (55°) + overlapping → they batch into one bath → NOT a clash
  const same = await page.evaluate(`(function(){ const now=Date.now(); return cookerContention([
    {blocked:false, m:{key:'a',heb:'A',eng:'A'}, stages:[{kind:'sv',temp:55,start:new Date(now),end:new Date(now+3600000)}]},
    {blocked:false, m:{key:'b',heb:'B',eng:'B'}, stages:[{kind:'sv',temp:55,start:new Date(now+600000),end:new Date(now+4200000)}]}
  ]); })()`) as any[];
  expect(same.length).toBe(0);
  // different temps (55 vs 63) + overlapping → one bath can't hold two temps → clash
  const diff = await page.evaluate(`(function(){ const now=Date.now(); return cookerContention([
    {blocked:false, m:{key:'a',heb:'A',eng:'A'}, stages:[{kind:'sv',temp:55,start:new Date(now),end:new Date(now+3600000)}]},
    {blocked:false, m:{key:'b',heb:'B',eng:'B'}, stages:[{kind:'sv',temp:63,start:new Date(now+600000),end:new Date(now+4200000)}]}
  ]); })()`) as any[];
  expect(diff.length).toBe(1);
});
