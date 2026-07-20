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

test('O4: deviceCapacity derates a smoker area by the packing factor', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'שלי', cap: { racks: 4, areaCm2: 6000 } }]);
  const c = await page.evaluate(`deviceCapacity(equipByCat('smoker')[0])`) as any;
  expect(c.mode).toBe('area');
  expect(c.areaCm2).toBe(6000);
  expect(c.usableCm2).toBe(5100);   // 6000 * 0.85
  expect(c.racks).toBe(4);
  expect(c.known).toBe(true);
});

test('O5: a sous-vide device reports volume, not area', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'מקל', cap: { baths: [12, 24] } }]);
  const c = await page.evaluate(`deviceCapacity(equipByCat('sousvide')[0])`) as any;
  expect(c.mode).toBe('volume');
  expect(c.litres).toBe(24);        // largest configured bath
});

test('O6: itemOccupancy reports a cut footprint in area mode', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'שלי', cap: { racks: 4 } }]);
  const o = await page.evaluate(`itemOccupancy(resolveItem('cut-1'),'smoke')`) as any;
  expect(o.mode).toBe('area');
  expect(o.cm2).toBe(1320);         // brisket footprint from the recipe equip block
  expect(o.hooks).toBe(0);
});

test('O7: capacity is "unknown" rather than wrong when nothing is configured', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(`deviceCapacity(null)`) as any;
  expect(c.known).toBe(false);
  expect(c.usableCm2).toBe(0);
});

test('O8: itemOccupancy(meta,\'sv\') reports volume mode with litres from the recipe spec', async ({ page }) => {
  await boot(page);
  const o = await page.evaluate(`itemOccupancy(resolveItem('cut-1'),'sv')`) as any;
  expect(o.mode).toBe('volume');
  expect(o.litres).toBe(24);   // brisket's by.sv.spec.min_bath_l
  expect(o.cm2).toBe(0);
});

test('O9: deviceCapacity on a grill reads cap.zones into the racks field', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'grill', type: 'פחם', name: 'שלי', cap: { zones: 3, areaCm2: 4000 } }]);
  const c = await page.evaluate(`deviceCapacity(equipByCat('grill')[0])`) as any;
  expect(c.mode).toBe('area');
  expect(c.racks).toBe(3);     // grills use cap.zones where smokers use cap.racks
});

test('O10: deviceCapacity reports hooks only when the device can actually hang', async ({ page }) => {
  await boot(page, [
    { id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'תולה', cap: { canHang: true, hooks: 6 } },
    { id: 'd2', cat: 'smoker', type: 'קטל (ככלי עישון)', name: 'לא תולה', cap: { canHang: false, hooks: 6 } },
  ]);
  const r = await page.evaluate(`(function(){
    var devs=equipByCat('smoker');
    return { hanging: deviceCapacity(devs[0]).hooks, notHanging: deviceCapacity(devs[1]).hooks };
  })()`) as any;
  expect(r.hanging).toBe(6);
  expect(r.notHanging).toBe(0);   // canHang false -> hooks:0 even though a hooks count is present
});

// Finding 1 regression: the AI equipment-lookup path (app.js aiLookupDevice) writes a bare
// cap.bathL and never populates cap.baths. deviceCapacity must honour that legacy/live field
// rather than silently substituting the class default (propOf(dev,'maxL')) — substituting a
// default here would report known:true with an invented number, which is the one thing this
// layer must never do.
test('O11: a sous-vide device with only cap.bathL (no cap.baths) reports the real bath size, not the class default', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'AI-filled', cap: { bathL: 18 } }]);
  const c = await page.evaluate(`deviceCapacity(equipByCat('sousvide')[0])`) as any;
  expect(c.mode).toBe('volume');
  expect(c.known).toBe(true);
  expect(c.litres).toBe(18);   // NOT propOf(dev,'maxL') === 20 for 'טבילה (immersion)'
});

// A minimal computed[] fixture: two cuts smoking on one device across overlapping windows.
const FIXTURE = `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key,kind,startH,endH,temp){
    return { m:resolveItem(key), stages:[{kind:kind, start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] };
  };
  return { t0:t0, computed:[ mk('cut-1','smoke',0,12,110), mk('cut-7','smoke',6,11,107) ] };
})()`;

test('O12: reports both items and summed area at an instant inside both windows', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+8*3600e3, f.computed);
  })()`) as any;
  expect(r.items.map((i: any) => i.key).sort()).toEqual(['cut-1', 'cut-7']);
  expect(r.usedCm2).toBe(1680);            // 1320 + 360
  expect(r.pct).toBe(33);                  // 1680 / 5100 usable
  expect(r.over).toBe(false);              // fits comfortably — this is the false-positive killer
});

test('O13: an instant outside a window excludes that item', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+2*3600e3, f.computed);
  })()`) as any;
  expect(r.items.map((i: any) => i.key)).toEqual(['cut-1']);
  expect(r.usedCm2).toBe(1320);
});

test('O14: over-capacity is reported when the items genuinely do not fit', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'קמאדו / קרמי', name: 'קמאדו', cap: { racks: 1, areaCm2: 1650 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+8*3600e3, f.computed);
  })()`) as any;
  expect(r.over).toBe(true);               // 1680 cm² > 1403 usable on a kamado (1650 * 0.85, rounded)
  expect(r.pct).toBeGreaterThan(100);
});

test('O15: unknown capacity yields pct null and never reports over', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 0 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+8*3600e3, f.computed);
  })()`) as any;
  expect(r.pct).toBeNull();
  expect(r.over).toBe(false);              // never warn on a figure we do not have
});

// Task 3 review gate: the volume branch of deviceOccupancy shipped untested, and Task 5's clash
// detection derives from it. A sous-vide bath budgets litres, never area.
test('O16: a sous-vide bath budgets volume, not area', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'מקל', cap: { baths: [12, 24] } }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'sv', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    setItemCooker('cut-1','sv','d1');
    return deviceOccupancy('d1', t0+2*3600e3, [ mk('cut-1',0,30,68) ]);
  })()`) as any;
  expect(r.mode).toBe('volume');
  expect(r.usedLitres).toBe(24);        // brisket declares min_bath_l 24
  expect(r.usedCm2).toBe(0);            // volume mode must never accrue area
  expect(r.pct).toBe(100);              // 24 of a 24 L bath
  expect(r.over).toBe(false);           // exactly full is not over
});

test('O17: a capacity that rounds away to nothing is treated as unknown, not as Infinity', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 0.4 } }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    return deviceOccupancy('d1', t0+1*3600e3, [ mk('cut-1',0,12,110) ]);
  })()`) as any;
  expect(r.pct).toBeNull();
  expect(r.over).toBe(false);
});

test('O18: brisket 110C and ribs 107C are compatible and share hickory', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const c = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+8*3600e3, f.computed).compat;
  })()`) as any;
  expect(c.tempSpread).toBe(3);
  expect(c.tempOk).toBe(true);
  expect(c.setpoint).toBe(110);            // run at the higher, pull the faster item on internal temp
  expect(c.commonWood).toBe('היקורי');
  expect(c.woodOk).toBe(true);
});

test('O19: a wide temperature spread is flagged incompatible', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const c = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    return deviceOccupancy('d1', t0+8*3600e3, [ mk('cut-1',0,12,110), mk('cut-7',6,11,160) ]).compat;
  })()`) as any;
  expect(c.tempSpread).toBe(50);
  expect(c.tempOk).toBe(false);
});

test('O20: a single item is always compatible with itself', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const c = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+2*3600e3, f.computed).compat;
  })()`) as any;
  expect(c.tempSpread).toBe(0);
  expect(c.tempOk).toBe(true);
});

// Task 4 review gate: the wood-intersection NEGATIVE branch shipped untested, and it is the spot a
// subtle reduce/seed bug would silently claim two cuts share a wood they do not. occupancyCompat is
// pure, so these drive it directly rather than through a device fixture.
test('O21: two cuts with disjoint woods are flagged — no common wood', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(`occupancyCompat([{temp:110,wood:'אלון'},{temp:108,wood:'תפוח'}])`) as any;
  expect(c.commonWood).toBeNull();
  expect(c.woodOk).toBe(false);
  expect(c.tempOk).toBe(true);          // temperature is fine — only the wood conflicts
});

test('O22: a three-way intersection keeps only the wood common to all', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(`occupancyCompat([
    {temp:110,wood:'אלון/היקורי'},{temp:108,wood:'היקורי/תפוח'},{temp:112,wood:'היקורי/אלון'}
  ])`) as any;
  expect(c.commonWood).toBe('היקורי');   // אלון is in 1 and 3 but not 2 — must not survive
  expect(c.woodOk).toBe(true);
});

test('O23: an item with no recorded wood adds no constraint', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(`occupancyCompat([{temp:110,wood:'אלון/היקורי'},{temp:108,wood:''}])`) as any;
  expect(c.woodOk).toBe(true);           // an unrecorded wood is not a conflict
  expect(c.tempOk).toBe(true);
});

// Task 6: hanging is a second occupancy channel — a hung item frees grate area entirely rather
// than shrinking its footprint, so it must never accrue cm2 and must consume exactly one hook.
test('O24: hung items consume hooks and no grate area', async ({ page }) => {
  await boot(page, [
    { id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח', cap:{racks:4, areaCm2:6000, canHang:true, hooks:6} },
    { id:'d2', cat:'other', type:'hooks', name:'ווים', cap:{count:6} },
  ]);
  const r = await page.evaluate(`(function(){
    var hung=Object.keys(DATA.makes).filter(function(k){ var e=DATA.makes[k].equip; return e && e.spec && e.spec.hang; });
    if(!hung.length) return {none:true};
    var m=resolveItem('make-'+hung[0]);
    return { count:hung.length, occ:itemOccupancy(m,'smoke') };
  })()`) as any;
  expect(r.none).toBeUndefined();
  expect(r.count).toBeGreaterThan(0);
  expect(r.occ.mode).toBe('hang');
  expect(r.occ.hooks).toBe(1);
  expect(r.occ.cm2).toBe(0);
});

test('O25: exceeding the hook count is reported without touching area', async ({ page }) => {
  await boot(page, [
    { id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח', cap:{racks:4, areaCm2:6000, canHang:true, hooks:1} },
    { id:'d2', cat:'other', type:'hooks', name:'ווים', cap:{count:1} },
  ]);
  const r = await page.evaluate(`(function(){
    var hung=Object.keys(DATA.makes).filter(function(k){ var e=DATA.makes[k].equip; return e && e.spec && e.spec.hang; }).slice(0,2);
    if(hung.length<2) return {skip:true};
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(k){ return { m:resolveItem('make-'+k), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:75}] }; };
    return deviceOccupancy('d1', t0+1*3600e3, hung.map(mk));
  })()`) as any;
  // If fewer than 2 makes carry spec.hang, the derivation under-matched — that is a real failure, not a skip.
  expect(r.skip, 'fewer than 2 makes carry spec.hang — the derivation under-matched').toBeUndefined();
  expect(r.hooksUsed).toBe(2);
  expect(r.hooksOver).toBe(true);
  expect(r.usedCm2).toBe(0);
});
