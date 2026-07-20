# Equipment Occupancy Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app know how much of a cooker each cut actually occupies, at any moment in time — so a "clash" means *genuinely does not fit* rather than *overlaps in time*, and the user can see the shelf layout that proves it.

**Architecture:** One pure, queryable seam — `deviceOccupancy(devId, tMs, computed, scope)` returns the full state of a device at an instant (who is on it, area/volume used, hooks used, temperature spread, common wood). Everything else *derives* from it: the clash warnings become a read of the model, and the new graphical view renders the same object. Never two sources of truth. Area capacity comes from a new `areaCm2` device property; hanging comes from a new recipe-derived `hang` class.

**Tech Stack:** Vanilla JS in `app.js` (single-file PWA), CSS in `app.css`, recipe derivation in `equipment_map.py`, build via `python build.py`, tests in Playwright (`tests/*.spec.ts`).

## Global Constraints

- **Hebrew is primary. No English may leak into Hebrew UI.** Every user-facing string uses `L('עברית','English')`. Device/recipe names render via existing helpers (`t()`, `itemName()`), never hardcoded.
- **The source of the HTML shell is `build.py`** — it *writes* both `index.html` and `dist/index.html`. Never edit `index.html` directly; it is gitignored and regenerated.
- **Rebuild before testing:** `python build.py`. Tests serve `dist/index.html`.
- **Safety invariance:** this layer may never alter a `bcheck` stage, a `temp`, a `safe` value, or any computed duration. It adds occupancy metadata and advisories only.
- **No-equipment gate:** with `mk-equip-set` unset, behavior must be byte-identical to today. Every new function returns a neutral value when equipment is not configured.
- **Never invent a measurement.** If a capacity figure is unknown, degrade to "unknown" and do not warn — never block a plan on a number we do not have.
- **Packing efficiency is `PACK_EFF = 0.85`** — a cooker's usable area is 85% of its stated area (smoke must circulate). Use this exact constant.
- **Temperature tolerance is `TEMP_TOL_C = 6`** — items within 6°C of each other may share a cooker. Use this exact constant.
- **Existing test suite is 254 and must stay green.** Run the full suite twice before shipping.
- Escape all interpolated user/device text with `esc()`.

---

### Task 1: `areaCm2` capacity property for cookers

Nothing can compute occupancy without a cooking-area figure. Smokers and grills gain an `areaCm2` property with per-type class defaults, reusing the existing property framework (`props[]`, `propOf`, `propCoerce`, `propParse`, `UNIT_CONV`).

**Files:**
- Modify: `app.js` — `EQUIP_CATS`, the `smoker` entry `props[]` (~line 40) and the `grill` entry `props[]` (~line 45)
- Modify: `app.js` — `UNIT_CONV` (add area conversions)
- Test: `tests/occupancy-model.spec.ts` (create)

**Interfaces:**
- Consumes: existing `propOf(dev,key)`, `propDef(cat,key,type)`, `UNIT_CONV`, `EQUIP_CATS`
- Produces: `propOf(dev,'areaCm2')` → total cooking area in cm² for any smoker/grill

**Exact type strings (copy verbatim — abbreviated keys silently never fire):**
- smoker `types`: `'ארון / קבינט'`, `'אופסט / סטיק-ברנר'`, `'פלטים'`, `'קמאדו / קרמי'`, `'WSM / חבית'`, `'קטל (ככלי עישון)'`, `'גז (עם תיבת עשן)'`, `'חשמלי'`
- grill `types`: `'פחם'`, `'גז'`, `'קטל'`, `'פלנצ׳ה / פלטה'`, `'לבה / אינפרא'`

- [ ] **Step 1: Write the failing test**

Create `tests/occupancy-model.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O1 fails with "smoker: no areaCm2 prop".

- [ ] **Step 3: Add the area conversions to `UNIT_CONV`**

Find `UNIT_CONV` in `app.js` and add these entries alongside the existing ones (keep the established key format, e.g. `'F->C'`, `'mm->cm'`):

```js
'in2->cm2': function(v){ return v*6.4516; },
'm2->cm2':  function(v){ return v*10000; },
'ft2->cm2': function(v){ return v*929.03; },
```

- [ ] **Step 4: Add the `areaCm2` prop to the smoker category**

In `EQUIP_CATS`, the `smoker` entry's `props:[...]` array, add as the FIRST entry (it is the most important capacity figure):

```js
{key:'areaCm2', he:'שטח בישול כולל', en:'Total cooking area', kind:'num', unit:'ס״מ²', em:'📐', tier:'core',
 bounds:[200,40000], alt:['in2->cm2','m2->cm2','ft2->cm2'],
 def:{'ארון / קבינט':6000,'אופסט / סטיק-ברנר':5000,'פלטים':3700,'קמאדו / קרמי':1650,
      'WSM / חבית':3300,'קטל (ככלי עישון)':2400,'גז (עם תיבת עשן)':3500,'חשמלי':4400}},
```

- [ ] **Step 5: Add the `areaCm2` prop to the grill category**

In the `grill` entry's `props:[...]`, add as the FIRST entry:

```js
{key:'areaCm2', he:'שטח צלייה כולל', en:'Total grilling area', kind:'num', unit:'ס״מ²', em:'📐', tier:'core',
 bounds:[200,40000], alt:['in2->cm2','m2->cm2','ft2->cm2'],
 def:{'פחם':2000,'גז':2800,'קטל':2400,'פלנצ׳ה / פלטה':1800,'לבה / אינפרא':1500}},
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O1, O2, O3 PASS.

- [ ] **Step 7: Run the existing property suite (this touches shared property machinery)**

```bash
npx playwright test tests/equipment-props.spec.ts tests/equipment.spec.ts --workers=1 --retries=2 --reporter=line
```

Expected: all PASS. Test E1 (the build gate asserting every `props[].def` key is a real type string) must still pass — it is what proves the type strings above are exact.

- [ ] **Step 8: Commit**

```bash
git add app.js tests/occupancy-model.spec.ts
git commit -m "occupancy: areaCm2 capacity property for smokers and grills"
```

---

### Task 2: Capacity and footprint primitives

Pure helpers that turn a device into its capacity and an item-stage into its consumption. No DOM, no storage writes.

**Files:**
- Modify: `app.js` — insert directly after `cookerContention` (~line 257), before `equipConfigured`
- Test: `tests/occupancy-model.spec.ts` (extend)

**Interfaces:**
- Consumes: `propOf`, `equipByCat`, `equipList`, `equipOwnsToken` (from v252), `resolveItem`
- Produces:
  - `PACK_EFF` = `0.85`, `TEMP_TOL_C` = `6`
  - `deviceCapacity(dev)` → `{mode:'area'|'volume', areaCm2, usableCm2, racks, hooks, litres, known:bool}`
  - `itemOccupancy(meta, stageKind)` → `{mode:'area'|'hang'|'volume', cm2, hooks, litres, hang:'short'|'long'|null}`

- [ ] **Step 1: Write the failing tests**

Append to `tests/occupancy-model.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O4 fails with "deviceCapacity is not defined".

- [ ] **Step 3: Implement the primitives**

Insert in `app.js` after `cookerContention`:

```js
// ── occupancy primitives ───────────────────────────────────────────────────────────────────
// A cooker's stated area is never fully usable — smoke has to circulate, and packing pieces
// shoulder-to-shoulder gives uneven bark. Everything downstream budgets against usableCm2.
const PACK_EFF=0.85;
const TEMP_TOL_C=6;      // items within this many °C of each other may share one cooker

function deviceCapacity(dev){
  const none={mode:'area', areaCm2:0, usableCm2:0, racks:0, hooks:0, litres:0, known:false};
  if(!dev) return none;
  if(dev.cat==='sousvide'){
    const baths=(dev.cap&&Array.isArray(dev.cap.baths))?dev.cap.baths.map(Number).filter(function(n){return n>0;}):[];
    const litres=baths.length?Math.max.apply(null,baths):(propOf(dev,'maxL')||0);
    return {mode:'volume', areaCm2:0, usableCm2:0, racks:0, hooks:0, litres:litres, known:litres>0};
  }
  const area=Number(propOf(dev,'areaCm2'))||0;
  const racks=Number(dev.cap&&(dev.cap.racks||dev.cap.zones))||0;
  const hooks=(propOf(dev,'canHang')===true)?(Number(propOf(dev,'hooks'))||0):0;
  return {mode:'area', areaCm2:area, usableCm2:Math.round(area*PACK_EFF), racks:racks, hooks:hooks, known:area>0};
}

// What one item consumes during a given stage kind. Hanging (Task 6) frees grate area entirely,
// which is why it is a distinct mode rather than a smaller footprint.
function itemOccupancy(meta, stageKind){
  const none={mode:'area', cm2:0, hooks:0, litres:0, hang:null};
  if(!meta) return none;
  const eq=(meta.obj&&meta.obj.equip)||meta.equip; if(!eq) return none;
  const by=(eq.by&&eq.by[stageKind])||{};
  const spec=Object.assign({}, eq.spec||{}, by.spec||{});
  if(stageKind==='sv') return {mode:'volume', cm2:0, hooks:0, litres:Number(spec.min_bath_l)||0, hang:null};
  const hang=spec.hang||null;
  if(hang && equipOwnsToken('hooks')) return {mode:'hang', cm2:0, hooks:1, litres:0, hang:hang};
  return {mode:'area', cm2:Number(spec.footprint_cm2)||0, hooks:0, litres:0, hang:null};
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O1-O7 PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/occupancy-model.spec.ts
git commit -m "occupancy: deviceCapacity and itemOccupancy primitives"
```

---

### Task 3: `deviceOccupancy(devId, tMs, computed, scope)` — the queryable state

The seam. Given a device and an instant, return everything true about that device then. The view and the warnings both read this — neither computes its own occupancy.

**Files:**
- Modify: `app.js` — insert after `itemOccupancy`
- Test: `tests/occupancy-model.spec.ts` (extend)

**Interfaces:**
- Consumes: `deviceCapacity`, `itemOccupancy`, `cookerFor`, `equipList`, `itemName`, `resolveItem`
- Produces:

```js
deviceOccupancy(devId, tMs, computed, scope) -> {
  dev, devName, mode:'area'|'volume', t:tMs,
  cap:{areaCm2, usableCm2, racks, hooks, litres, known},
  items:[{key,name,kind,cm2,hooks,litres,start,end,temp,wood}],
  usedCm2, usedLitres, hooksUsed,
  pct,            // 0..100+ against usable capacity, null when capacity unknown
  over:bool       // strictly exceeds usable capacity
}
```

`computed` is the array `buildList` already builds — each entry `{m, stages:[{kind,start,end,temp,...}], blocked?}`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/occupancy-model.spec.ts`:

```ts
// A minimal computed[] fixture: two cuts smoking on one device across overlapping windows.
const FIXTURE = `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key,kind,startH,endH,temp){
    return { m:resolveItem(key), stages:[{kind:kind, start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] };
  };
  return { t0:t0, computed:[ mk('cut-1','smoke',0,12,110), mk('cut-7','smoke',6,11,107) ] };
})()`;

test('O8: reports both items and summed area at an instant inside both windows', async ({ page }) => {
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

test('O9: an instant outside a window excludes that item', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+2*3600e3, f.computed);
  })()`) as any;
  expect(r.items.map((i: any) => i.key)).toEqual(['cut-1']);
  expect(r.usedCm2).toBe(1320);
});

test('O10: over-capacity is reported when the items genuinely do not fit', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'קמאדו / קרמי', name: 'קמאדו', cap: { racks: 1, areaCm2: 1650 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+8*3600e3, f.computed);
  })()`) as any;
  expect(r.over).toBe(true);               // 1680 cm² > 1402 usable on a kamado
  expect(r.pct).toBeGreaterThan(100);
});

test('O11: unknown capacity yields pct null and never reports over', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 0 } }]);
  const r = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+8*3600e3, f.computed);
  })()`) as any;
  expect(r.pct).toBeNull();
  expect(r.over).toBe(false);              // never warn on a figure we do not have
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O8 fails with "deviceOccupancy is not defined".

- [ ] **Step 3: Implement `deviceOccupancy`**

Insert in `app.js` after `itemOccupancy`:

```js
// The single source of truth for "what is on this device right now". The occupancy view renders this
// object and the clash advisories derive from it — so a diagram and a warning can never disagree.
function deviceOccupancy(devId, tMs, computed, scope){
  const dev=equipList().find(function(d){return d && d.id===devId;})||null;
  const cap=deviceCapacity(dev);
  const out={dev:dev, devName:dev?(dev.name||t(dev.type)||''):'', mode:cap.mode, t:tMs, cap:cap,
             items:[], usedCm2:0, usedLitres:0, hooksUsed:0, pct:null, over:false};
  (computed||[]).forEach(function(c){
    if(!c || c.blocked || !c.stages || !c.m) return;
    c.stages.forEach(function(s){
      if(['smoke','cook','sv'].indexOf(s.kind)<0 || !s.start || !s.end) return;
      const st=s.start.getTime(), en=s.end.getTime();
      if(tMs<st || tMs>=en) return;
      const d=cookerFor(c.m.key, s.kind, scope); if(!d || d.id!==devId) return;
      const occ=itemOccupancy(c.m, s.kind);
      out.items.push({key:c.m.key, name:(typeof itemName==='function'?itemName(c.m):c.m.heb),
                      kind:s.kind, cm2:occ.cm2, hooks:occ.hooks, litres:occ.litres,
                      start:st, end:en, temp:(s.temp!=null?s.temp:null),
                      wood:(c.m.obj&&c.m.obj.wood)||c.m.wood||''});
      out.usedCm2+=occ.cm2; out.usedLitres+=occ.litres; out.hooksUsed+=occ.hooks;
    });
  });
  if(cap.known){
    if(cap.mode==='volume'){
      out.pct=Math.round(out.usedLitres/cap.litres*100);
      out.over=out.usedLitres>cap.litres;
    } else {
      out.pct=Math.round(out.usedCm2/cap.usableCm2*100);
      out.over=out.usedCm2>cap.usableCm2;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O1-O11 PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/occupancy-model.spec.ts
git commit -m "occupancy: deviceOccupancy(devId,t,computed) queryable state seam"
```

---

### Task 4: Temperature and wood compatibility

Area is not the only thing that decides whether two cuts can share a pit. Two items 3°C apart sharing hickory are fine; two items 40°C apart are not, however well they fit. Today nothing checks this for a smoker at all.

**Files:**
- Modify: `app.js` — extend `deviceOccupancy` and add `occupancyCompat`
- Test: `tests/occupancy-model.spec.ts` (extend)

**Interfaces:**
- Consumes: the `out.items[]` built in Task 3 (each carries `temp` and `wood`)
- Produces: `deviceOccupancy(...).compat` →

```js
{ tempSpread:number|null, tempOk:bool, setpoint:number|null,
  woods:[string], commonWood:string|null, woodOk:bool }
```

**Wood strings are slash-separated Hebrew lists** — e.g. brisket `'אלון/היקורי'`, spareribs `'היקורי/תפוח'`. Split on `/`, trim, intersect.

- [ ] **Step 1: Write the failing tests**

Append to `tests/occupancy-model.spec.ts`:

```ts
test('O12: brisket 110C and ribs 107C are compatible and share hickory', async ({ page }) => {
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

test('O13: a wide temperature spread is flagged incompatible', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const c = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    return deviceOccupancy('d1', t0+8*3600e3, [ mk('cut-1',0,12,110), mk('cut-7',6,11,160) ]).compat;
  })()`) as any;
  expect(c.tempSpread).toBe(50);
  expect(c.tempOk).toBe(false);
});

test('O14: a single item is always compatible with itself', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]);
  const c = await page.evaluate(`(function(){
    var f=${FIXTURE};
    return deviceOccupancy('d1', f.t0+2*3600e3, f.computed).compat;
  })()`) as any;
  expect(c.tempSpread).toBe(0);
  expect(c.tempOk).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O12 fails — `compat` is undefined.

- [ ] **Step 3: Implement `occupancyCompat` and wire it in**

Insert in `app.js` immediately before `deviceOccupancy`:

```js
// Two cuts can only share a pit if the pit can be at one temperature that suits both, and if one
// wood serves both. Area alone was never the whole constraint.
function occupancyCompat(items){
  const temps=(items||[]).map(function(i){return i.temp;}).filter(function(v){return v!=null;});
  const spread=temps.length?(Math.max.apply(null,temps)-Math.min.apply(null,temps)):null;
  const woodSets=(items||[]).map(function(i){
    return String(i.wood||'').split('/').map(function(s){return s.trim();}).filter(Boolean);
  }).filter(function(a){return a.length;});
  let common=null;
  if(woodSets.length){
    common=woodSets.reduce(function(acc,set){ return acc.filter(function(w){return set.indexOf(w)>=0;}); }, woodSets[0].slice());
  }
  return {
    tempSpread: spread,
    tempOk: spread==null || spread<=TEMP_TOL_C,
    setpoint: temps.length?Math.max.apply(null,temps):null,
    woods: woodSets.length?[].concat.apply([],woodSets).filter(function(w,i,a){return a.indexOf(w)===i;}):[],
    commonWood: (common&&common.length)?common[0]:null,
    woodOk: !woodSets.length || woodSets.length<2 || !!(common&&common.length)
  };
}
```

Then, in `deviceOccupancy`, immediately before `return out;`, add:

```js
  out.compat=occupancyCompat(out.items);
```

- [ ] **Step 4: Run to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O1-O14 PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/occupancy-model.spec.ts
git commit -m "occupancy: temperature and wood compatibility"
```

---

### Task 5: Derive clash warnings from the model

The payoff. `cookerContention` currently flags any two items overlapping in time on one device — which is why a 4-rack smoker holding a brisket and a rack of ribs reports a clash it does not have. A clash now means **over capacity, or temperature-incompatible** — and the dead-end "stagger the start" text (which points at a control the app does not have) goes away.

**Files:**
- Modify: `app.js:241-257` — `cookerContention`
- Modify: `app.js:~4981` — the `contentionHtml` advisory in `workPlanHtml`
- Test: `tests/occupancy-clash.spec.ts` (create)

**Interfaces:**
- Consumes: `deviceOccupancy`
- Produces: `cookerContention(computed, scope)` → `[{devId, devName, at, reason:'area'|'temp', pct, items:[{key,name}], compat}]`

**Note the shape change:** the old entries carried `{a, b}` (a pair). The new entries carry `items[]` (all items overlapping at the moment of worst contention) plus a `reason`. The consumer at `app.js:~4981` and the `_clashOcc` map at `app.js:~4875` must both be updated — `_clashOcc` keys off `cl.a.key`/`cl.b.key` today and must key off every entry in `cl.items`.

- [ ] **Step 1: Write the failing tests**

Create `tests/occupancy-clash.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

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
  await page.waitForFunction(`typeof cookerContention==='function' && typeof deviceOccupancy==='function'`);
};

const BIG   = [{ id:'d1', cat:'smoker', type:'ארון / קבינט',  name:'הנפח אביה 150', cap:{racks:4, areaCm2:6000} }];
const SMALL = [{ id:'d1', cat:'smoker', type:'קמאדו / קרמי', name:'קמאדו',        cap:{racks:1, areaCm2:1650} }];

const CLASHES = `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
  return cookerContention([ mk('cut-1',0,12,110), mk('cut-7',6,11,107) ]);
})()`;

test('C1: brisket + ribs on a 4-rack smoker is NOT a clash (they fit)', async ({ page }) => {
  await boot(page, BIG);
  const clashes = await page.evaluate(CLASHES) as any[];
  expect(clashes).toEqual([]);
});

test('C2: the same pair on a single-grate kamado IS a clash, for area', async ({ page }) => {
  await boot(page, SMALL);
  const clashes = await page.evaluate(CLASHES) as any[];
  expect(clashes).toHaveLength(1);
  expect(clashes[0].reason).toBe('area');
  expect(clashes[0].items.map((i: any) => i.key).sort()).toEqual(['cut-1', 'cut-7']);
  expect(clashes[0].pct).toBeGreaterThan(100);
});

test('C3: items that fit but need different temperatures clash for temp', async ({ page }) => {
  await boot(page, BIG);
  const clashes = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    return cookerContention([ mk('cut-1',0,12,110), mk('cut-7',6,11,160) ]);
  })()`) as any[];
  expect(clashes).toHaveLength(1);
  expect(clashes[0].reason).toBe('temp');
  expect(clashes[0].compat.tempSpread).toBe(50);
});

test('C4: unknown capacity never produces an area clash', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח', cap:{racks:4, areaCm2:0} }]);
  const clashes = await page.evaluate(CLASHES) as any[];
  expect(clashes.filter((c: any) => c.reason === 'area')).toEqual([]);
});

test('C5: the work plan shows no clash advisory for a pair that fits', async ({ page }) => {
  await boot(page, BIG);
  const r = await page.evaluate(`(async function(){
    openTimeline();
    await new Promise(function(r){setTimeout(r,2000);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
    var cl=p.querySelector('.wp-clash');
    return { shown: !!cl, text: cl?cl.innerText:'' };
  })()`) as any;
  expect(r.shown).toBe(false);
});

test('C6: no advisory ever tells the user to stagger a start (no such control exists)', async ({ page }) => {
  await boot(page, SMALL);
  const text = await page.evaluate(`(async function(){
    openTimeline();
    await new Promise(function(r){setTimeout(r,2000);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
    return p.innerText;
  })()`) as string;
  expect(text).not.toContain('הסט את ההתחלה');
  expect(text).not.toContain('stagger the start');
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-clash.spec.ts --workers=1 --reporter=line
```

Expected: C1 fails — a clash is still reported for a pair that fits.

- [ ] **Step 3: Rewrite `cookerContention` to derive from the model**

Replace the whole body of `cookerContention` (`app.js:241-257`) with:

```js
// A clash is now a real physical conflict — over usable capacity, or two items that cannot share one
// temperature — evaluated at every moment a device's load changes. Overlapping in time is not a clash.
function cookerContention(computed, scope){
  const marks={};                                   // every instant a device's load could change
  (computed||[]).forEach(function(c){
    if(!c || c.blocked || !c.stages) return;
    c.stages.forEach(function(s){
      if(['smoke','cook','sv'].indexOf(s.kind)<0 || !s.start || !s.end) return;
      const d=cookerFor(c.m.key, s.kind, scope); if(!d) return;
      (marks[d.id]=marks[d.id]||[]).push(s.start.getTime());
    });
  });
  const clashes=[];
  Object.keys(marks).forEach(function(devId){
    let worst=null;
    marks[devId].forEach(function(tMs){
      const o=deviceOccupancy(devId, tMs, computed, scope);
      if(o.items.length<2) return;                  // one item can never conflict with itself
      const bad=o.over?'area':(!o.compat.tempOk?'temp':null);
      if(!bad) return;
      if(!worst || (o.pct||0)>(worst.pct||0)) worst={devId:devId, devName:o.devName, at:tMs,
        reason:bad, pct:o.pct, compat:o.compat,
        items:o.items.map(function(i){return {key:i.key, name:i.name, kind:i.kind};})};   // kind drives the move-target lookup
    });
    if(worst) clashes.push(worst);
  });
  return clashes;
}
```

- [ ] **Step 4: Update the two consumers in `workPlanHtml`**

At `app.js:~4875`, replace the `_clashOcc` construction (which reads `cl.a`/`cl.b`) with:

```js
    const _clashOcc={}; _clashes.forEach(function(cl){ cl.items.forEach(function(i){ _clashOcc[i.key]=1; }); });
```

and at `app.js:~4933` change the per-task flag from the old `key@start` lookup to:

```js
contention:!!_clashOcc[c.m.key]
```

At `app.js:~4981`, replace the `contentionHtml` block with:

```js
    const contentionHtml=_clashes.length?`<div class="wp-advisory wp-clash">⚠️ <b>${L('התנגשות תנור','Cooker clash')}:</b> ${_clashes.map(function(cl){
      const names=cl.items.map(function(i){return esc(i.name);}).join(' + ');
      const last=cl.items[cl.items.length-1];
      const other=cookerCandidates(last.kind).filter(function(d){return d.id!==cl.devId;});   // candidates for THIS stage kind, not always 'smoke'
      const move=other.length?` <button class="mchip cookmove" data-cookermove="${esc(last.key)}|${esc(last.kind)}|${esc(other[0].id)}">${L('העבר','Move')} ${esc(last.name)} → ${esc(other[0].name||t(other[0].type))}</button>`:'';
      const why=cl.reason==='area'
        ? `${L('חורגים מהשטח של','exceed the capacity of')} <b>${esc(cl.devName)}</b> (${cl.pct}%)`
        : `${L('דורשים טמפרטורות שונות על','need different temperatures on')} <b>${esc(cl.devName)}</b> (${L('פער','spread')} ${cl.compat.tempSpread}°C)`;
      return `${names} ${why}${move}`;
    }).join('<br>')}</div>`:'';
```

- [ ] **Step 5: Run the new tests to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-clash.spec.ts --workers=1 --reporter=line
```

Expected: C1-C6 PASS.

- [ ] **Step 6: Run every suite that touches contention**

```bash
npx playwright test tests/workplan.spec.ts tests/wave2-combined.spec.ts tests/wave2-multievent.spec.ts tests/waveE-multievent-pro.spec.ts tests/equipment-visibility.spec.ts --workers=1 --retries=2 --reporter=line
```

Expected: all PASS. `combinedEventsRows` (`app.js:~6880`) computes its own cross-event smoker overlap and is deliberately NOT changed by this task — confirm those tests still pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add app.js tests/occupancy-clash.spec.ts
git commit -m "occupancy: clashes derive from capacity and temperature, not time overlap"
```

---

### Task 6: Hanging as a second occupancy channel

Hanging frees grate area entirely, so it is a distinct channel rather than a smaller footprint. No recipe declares hanging today — 28 of the 102 `makes` mention it in prose only — so this task derives the data first.

**Files:**
- Modify: `equipment_map.py` — add `hang` derivation into the `spec` block
- Modify: `app.js` — `itemOccupancy` already branches on `spec.hang` (Task 2); extend `deviceOccupancy` to budget hooks
- Test: `tests/occupancy-model.spec.ts` (extend)

**Interfaces:**
- Consumes: `deviceCapacity().hooks`, `itemOccupancy().hooks`
- Produces: recipe `equip.spec.hang` = `'short'|'long'`; `deviceOccupancy(...).hooksOver` (bool)

**Length is a CLASS, not a measurement** — we have no real dimensions and must not invent centimetres. `'short'` = a link or coil; `'long'` = a full salami, rib rack, or whole bird.

- [ ] **Step 1: Write the failing test**

Append to `tests/occupancy-model.spec.ts`:

```ts
test('O15: hung items consume hooks and no grate area', async ({ page }) => {
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

test('O16: exceeding the hook count is reported without touching area', async ({ page }) => {
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
  // Task 6 Step 3 must derive at least two hanging makes; if it did not, that is a real failure, not a skip.
  expect(r.skip, 'fewer than 2 makes carry spec.hang — the derivation under-matched').toBeUndefined();
  expect(r.hooksUsed).toBe(2);
  expect(r.hooksOver).toBe(true);
  expect(r.usedCm2).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O15 fails — no make carries `spec.hang`.

- [ ] **Step 3: Derive `hang` in `equipment_map.py`**

In `equipment_map.py`, inside the function that builds a recipe's `spec` block, add:

```python
# Hanging is a second occupancy mode — a hung item frees grate area entirely. Length is a CLASS,
# never a measurement: we have no real dimensions and must not invent centimetres.
_HANG_RE = re.compile(r'תל(?:ה|יי?ה|ות)|לתלות|ווים|וו\b')
_HANG_LONG_RE = re.compile(r'סלמי|שוק|צלעות|עוף שלם|ברווז|קולג׳י|לונזה|קופה')

def _hang_class(text):
    """'long' for a full salami / rib rack / whole bird, 'short' for links and coils; None if it never hangs."""
    if not _HANG_RE.search(text):
        return None
    return 'long' if _HANG_LONG_RE.search(text) else 'short'
```

and where the `spec` dict is assembled for a make, add:

```python
    _hang = _hang_class(_all_text)          # _all_text = the concatenated recipe prose already used for token derivation
    if _hang:
        spec['hang'] = _hang
```

- [ ] **Step 4: Extend `deviceOccupancy` to budget hooks**

In `app.js`, inside `deviceOccupancy`, immediately after the `if(cap.known){...}` block, add:

```js
  out.hooksOver = cap.hooks>0 && out.hooksUsed>cap.hooks;
```

- [ ] **Step 5: Run to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-model.spec.ts --workers=1 --reporter=line
```

Expected: O1-O16 PASS. Confirm the build log still reports the expected recipe counts.

- [ ] **Step 6: Verify the derivation did not over-match**

```bash
python build.py && node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const m=h.match(/\"hang\":\"(short|long)\"/g)||[];console.log('hang specs:',m.length)"
```

Expected: a count between 10 and 40 (28 makes mention hanging in prose; some mentions are incidental). If the count exceeds 40, the regex is over-matching — tighten `_HANG_RE` and re-run. Report the final number.

- [ ] **Step 7: Commit**

```bash
git add app.js equipment_map.py tests/occupancy-model.spec.ts
git commit -m "occupancy: hanging as a second channel, derived from recipe prose"
```

---

### Task 7: The shared-device occupancy view

Render `deviceOccupancy` — shelves with the cuts placed on them, a usage bar, the hook rail, and the device facts that matter (temperature setpoint, common wood). Read-only; it renders the model and never computes its own occupancy.

**Files:**
- Modify: `app.js` — add `occupancyViewHtml`, `openOccupancyView`; add the launch button to the work-plan toolbar at `app.js:~4986` (the `.tl-detailtoggle` row)
- Modify: `app.css` — append the `.occ-*` block
- Test: `tests/occupancy-view.spec.ts` (create)

**Interfaces:**
- Consumes: `deviceOccupancy`, `equipList`, `equipTokenInfo` (v252), `showPanel`, `toolTop`, `fmtClockRel`
- Produces: `openOccupancyView(computed, serve, scope)`; `window._occT` (the scrubbed instant, ms) for Task 8

- [ ] **Step 1: Write the failing tests**

Create `tests/occupancy-view.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const KIT = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{racks:4, areaCm2:6000} }];

const boot = async (page: any) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({guests:8,appetite:'reg',kosher:false,keys:['cut-1','cut-7'],sides:[],drinks:[],desserts:[],gpm:0}));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} }, [KIT]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openOccupancyView==='function'`);
};

const openPlanThenView = `(async function(){
  openTimeline();
  await new Promise(function(r){setTimeout(r,2000);});
  var p=document.querySelector('#panel');
  var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
  if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
  var b=document.querySelector('[data-occview]');
  if(!b) return {noButton:true};
  b.click();
  await new Promise(function(r){setTimeout(r,1200);});
  var v=document.querySelector('.occ-wrap');
  return { present: !!v, text: v?v.innerText:'', devices: document.querySelectorAll('.occ-dev').length,
           chips: document.querySelectorAll('.occ-item').length, bars: document.querySelectorAll('.occ-bar').length };
})()`;

test('W1: the work plan offers an occupancy view and it opens', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(openPlanThenView) as any;
  expect(r.noButton).toBeUndefined();
  expect(r.present).toBe(true);
  expect(r.devices).toBeGreaterThan(0);
});

test('W2: the view places the cuts and shows a usage percentage', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(openPlanThenView) as any;
  expect(r.chips).toBeGreaterThan(0);
  expect(r.bars).toBeGreaterThan(0);
  expect(r.text).toMatch(/%/);
  expect(r.text).toContain('הנפח אביה 150');
});

test('W3: the view is Hebrew-clean', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(openPlanThenView) as any;
  const latin = (r.text.match(/[A-Za-z]{3,}/g) || []).filter((w: string) => !/^(AI|PDF|BBQ)$/i.test(w));
  expect(latin, `English leaked into the Hebrew view: ${latin.join(', ')}`).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-view.spec.ts --workers=1 --reporter=line
```

Expected: W1 fails waiting for `openOccupancyView`.

- [ ] **Step 3: Implement the view**

Insert in `app.js` after `deviceOccupancy`:

```js
// ── shared-device occupancy view ───────────────────────────────────────────────────────────
// Renders deviceOccupancy() and nothing else — the diagram and the clash advisories must never
// be able to disagree, so this computes no occupancy of its own.
function occupancyDevHtml(o){
  const he=(typeof getLang!=='function'||getLang()==='he');
  const cap=o.cap;
  const pct=(o.pct==null)?null:Math.max(0,Math.min(100,o.pct));
  const barCls=o.over?'occ-bar-over':(o.pct!=null&&o.pct>80?'occ-bar-warn':'');
  const bar=(o.pct==null)
    ? `<div class="occ-unknown">${L('שטח לא ידוע — הוסף את שטח הבישול בכרטיס הציוד','Area unknown — add the cooking area on the device card')}</div>`
    : `<div class="occ-bar ${barCls}"><i style="width:${pct}%"></i><span>${o.pct}%</span></div>`;
  const items=o.items.length
    ? o.items.map(function(i){
        const frac=(cap.usableCm2>0&&i.cm2>0)?Math.max(8,Math.round(i.cm2/cap.usableCm2*100)):18;
        return `<span class="occ-item${i.hooks?' occ-hang':''}" style="flex:0 0 ${frac}%" title="${esc(i.name)}">${i.hooks?'🪝':'🥩'} ${esc(i.name)}${i.cm2?`<small>${i.cm2} ${he?'סמ״ר':'cm²'}</small>`:''}</span>`;
      }).join('')
    : `<span class="occ-empty">${L('פנוי','Free')}</span>`;
  const facts=[];
  if(o.compat.setpoint!=null) facts.push(`🌡️ ${o.compat.setpoint}°C`);
  if(o.compat.commonWood)     facts.push(`🪵 ${esc(t(o.compat.commonWood))}`);
  else if(o.compat.woods.length>1) facts.push(`🪵 ${L('עצים שונים','different woods')}`);
  if(cap.racks)  facts.push(`🗄️ ${cap.racks} ${he?'מדפים':'racks'}`);
  if(cap.hooks)  facts.push(`🪝 ${o.hooksUsed}/${cap.hooks}`);
  const warn=o.over
    ? `<div class="occ-warn">⚠ ${L('חריגה מהקיבולת','Over capacity')}</div>`
    : (!o.compat.tempOk?`<div class="occ-warn">⚠ ${L('פער טמפרטורות','Temperature spread')} ${o.compat.tempSpread}°C</div>`:'');
  return `<div class="occ-dev">
      <div class="occ-h"><b>${esc(o.devName)}</b><span class="occ-facts">${facts.join(' · ')}</span></div>
      ${bar}
      <div class="occ-slots">${items}</div>
      ${warn}
    </div>`;
}
function occupancyViewHtml(computed, tMs, scope){
  const devs=equipList().filter(function(d){return d && ['smoker','grill','sousvide'].indexOf(d.cat)>=0;});
  if(!devs.length) return `<div class="occ-wrap"><p class="section-sub">${L('לא הוגדרו תנורים.','No cookers configured.')}</p></div>`;
  return `<div class="occ-wrap">${devs.map(function(d){
    return occupancyDevHtml(deviceOccupancy(d.id, tMs, computed, scope));
  }).join('')}</div>`;
}
function openOccupancyView(computed, serve, scope){
  if(typeof showPanel!=='function') return;
  const span=_occSpan(computed);
  window._occT=span.now;
  showPanel(`${toolTop(L('תפוסת התנורים','Cooker occupancy'),L('מה נמצא על כל תנור, ומתי','What is on each cooker, and when'),'🗄️','#7a5c3c')}
    <div class="panel-body">
      <div id="occScrub"></div>
      <div id="occBody">${occupancyViewHtml(computed, window._occT, scope)}</div>
    </div>`);
  _occWire(computed, span, scope);
}
// the plan's overall time span, and a sensible starting instant (now, clamped into the span)
function _occSpan(computed){
  let lo=Infinity, hi=-Infinity;
  (computed||[]).forEach(function(c){ if(!c||!c.stages) return; c.stages.forEach(function(s){
    if(!s.start||!s.end) return; lo=Math.min(lo,s.start.getTime()); hi=Math.max(hi,s.end.getTime()); }); });
  if(!isFinite(lo)){ const n=Date.now(); return {lo:n, hi:n+3600e3, now:n}; }
  const n=Date.now();
  return {lo:lo, hi:hi, now:Math.max(lo, Math.min(hi, n))};
}
function _occWire(computed, span, scope){ /* filled in by Task 8 */ }
```

- [ ] **Step 4: Add the launch button to the work-plan toolbar**

At `app.js:~4986`, inside the `.tl-detailtoggle` row, add this button immediately before the `cop-launch` button:

```js
<button class="mchip" data-occview>🗄️ ${L('תפוסת תנורים','Cooker occupancy')}</button>
```

**Scope warning — read this before wiring.** `workPlanHtml` spans `app.js:4869-4989`; the handler site `wireRows()` starts at `app.js:5078` and is a **sibling function**, not nested inside it. `computed`, `serve`, and `_ckScope` are therefore **NOT in scope at the wiring site** — referencing them there throws a `ReferenceError`. Use the codebase's established stash pattern (the same one `window._wpTasks` uses).

Inside `workPlanHtml`, immediately after `const _ckScope=...` (`app.js:~4872`), add:

```js
    window._wpCtx={computed:computed, serve:serve, scope:_ckScope};   // wireRows() is a sibling scope — hand it the context explicitly
```

Then wire the button inside `wireRows()`, alongside the `[data-cookermove]` handler (~`app.js:5101`):

```js
    list.querySelectorAll('[data-occview]').forEach(function(b){ b.addEventListener('click',function(){
      const cx=window._wpCtx||{}; openOccupancyView(cx.computed||[], cx.serve, cx.scope);
    }); });
```

- [ ] **Step 5: Append the styles**

Append to `app.css`:

```css
/* ── cooker occupancy view ──────────────────────────────────────────────────── */
.occ-wrap{display:flex;flex-direction:column;gap:12px}
.occ-dev{background:var(--char2);border:1px solid var(--line);border-radius:12px;padding:12px}
.occ-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin-bottom:8px}
.occ-h b{font-size:calc(15px * var(--fscale));color:var(--bone)}
.occ-facts{font-size:calc(12.5px * var(--fscale));color:var(--ash);opacity:.9}
.occ-bar{position:relative;height:20px;background:var(--char);border:1px solid var(--line);border-radius:999px;overflow:hidden;margin-bottom:8px}
.occ-bar i{display:block;height:100%;background:linear-gradient(90deg,#2f8f5b,#7ab648);transition:width .2s}
.occ-bar span{position:absolute;inset-inline-end:8px;top:0;line-height:20px;font-size:calc(11.5px * var(--fscale));font-weight:800;color:var(--bone)}
.occ-bar-warn i{background:linear-gradient(90deg,#c98a2e,#e0b153)}
.occ-bar-over i{background:linear-gradient(90deg,#c2553f,#e07a5f)}
.occ-slots{display:flex;flex-wrap:wrap;gap:5px}
.occ-item{display:flex;flex-direction:column;justify-content:center;background:var(--char);border:1.5px solid var(--line2);border-radius:8px;padding:6px 8px;font-size:calc(12.5px * var(--fscale));font-weight:700;color:var(--ash);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.occ-item small{font-weight:600;opacity:.75;font-size:calc(11px * var(--fscale))}
.occ-hang{border-style:dashed}
.occ-empty{font-size:calc(12.5px * var(--fscale));color:var(--ash);opacity:.6}
.occ-unknown{font-size:calc(12px * var(--fscale));color:var(--ash);opacity:.8;margin-bottom:8px}
.occ-warn{margin-top:8px;font-size:calc(12.5px * var(--fscale));font-weight:700;color:#e07a5f}
```

- [ ] **Step 6: Run to verify they pass**

```bash
python build.py && npx playwright test tests/occupancy-view.spec.ts --workers=1 --reporter=line
```

Expected: W1, W2, W3 PASS.

- [ ] **Step 7: Commit**

```bash
git add app.js app.css tests/occupancy-view.spec.ts
git commit -m "occupancy: shared-device view rendering the occupancy model"
```

---

### Task 8: Time scrubber

Occupancy changes as items go on and come off, so a static diagram undersells it. A scrubber moves the instant across the plan's span and re-renders. Read-only — dragging items between devices is deliberately out of scope until the model is trusted.

**Files:**
- Modify: `app.js` — implement `_occWire`, replacing the Task 7 stub
- Modify: `app.css` — append the `.occ-scrub` block
- Test: `tests/occupancy-view.spec.ts` (extend)

**Interfaces:**
- Consumes: `_occSpan`, `occupancyViewHtml`, `window._occT`
- Produces: a re-render of `#occBody` on scrub

- [ ] **Step 1: Write the failing test**

Append to `tests/occupancy-view.spec.ts`:

```ts
test('W4: scrubbing to a later instant changes what is on the cooker', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    openTimeline();
    await new Promise(function(r){setTimeout(r,2000);});
    var p=document.querySelector('#panel');
    var wp=[].slice.call(p.querySelectorAll('button,.chip,.mchip')).find(function(e){return /תוכנית עבודה/.test(e.innerText);});
    if(wp){ wp.click(); await new Promise(function(r){setTimeout(r,1200);}); }
    document.querySelector('[data-occview]').click();
    await new Promise(function(r){setTimeout(r,1000);});
    var sl=document.querySelector('#occRange');
    if(!sl) return {noSlider:true};
    sl.value=sl.min; sl.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(function(r){setTimeout(r,400);});
    var early=document.querySelector('#occBody').innerText;
    sl.value=sl.max; sl.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(function(r){setTimeout(r,400);});
    var late=document.querySelector('#occBody').innerText;
    return { noSlider:false, changed: early!==late, hasClock: !!document.querySelector('#occClock') };
  })()`) as any;
  expect(r.noSlider).toBe(false);
  expect(r.hasClock).toBe(true);
  expect(r.changed).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
python build.py && npx playwright test tests/occupancy-view.spec.ts --workers=1 --reporter=line
```

Expected: W4 fails with `noSlider: true`.

- [ ] **Step 3: Implement `_occWire`**

Replace the `_occWire` stub in `app.js` with:

```js
function _occWire(computed, span, scope){
  const host=$("#occScrub"); if(!host) return;
  const fmt=function(ms){ const d=new Date(ms); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  host.innerHTML=`<div class="occ-scrub">
      <input type="range" id="occRange" min="${span.lo}" max="${span.hi}" step="60000" value="${span.now}"
             aria-label="${L('שעה בתוכנית','Time in the plan')}">
      <div class="occ-scrubrow"><button class="mchip" id="occNow">${L('עכשיו','Now')}</button><b id="occClock">${fmt(span.now)}</b></div>
    </div>`;
  const sl=$("#occRange"), clock=$("#occClock"), body=$("#occBody");
  const paint=function(){
    window._occT=Number(sl.value);
    if(clock) clock.textContent=fmt(window._occT);
    if(body)  body.innerHTML=occupancyViewHtml(computed, window._occT, scope);
  };
  sl.addEventListener('input', paint);
  const nb=$("#occNow"); if(nb) nb.addEventListener('click',function(){ sl.value=String(span.now); paint(); });
}
```

- [ ] **Step 4: Append the scrubber styles**

Append to `app.css`:

```css
.occ-scrub{margin-bottom:12px}
.occ-scrub input[type=range]{width:100%;accent-color:var(--ember2)}
.occ-scrubrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px}
.occ-scrubrow b{font-size:calc(15px * var(--fscale));color:var(--bone);font-variant-numeric:tabular-nums}
```

- [ ] **Step 5: Run to verify it passes**

```bash
python build.py && npx playwright test tests/occupancy-view.spec.ts --workers=1 --reporter=line
```

Expected: W1-W4 PASS.

- [ ] **Step 6: Run the full suite twice**

```bash
npx playwright test --workers=1 --retries=2 --reporter=line
npx playwright test --workers=1 --retries=2 --reporter=line
```

Expected: green both times. Report the total count (254 existing + the new specs).

- [ ] **Step 7: Verify in English as well as Hebrew**

```bash
python build.py
```

Then confirm manually (or via a scratch script) that with `mk-lang='en'` the occupancy view renders "Cooker occupancy", "Free", "Over capacity" — and that with `mk-lang='he'` no English appears. W3 covers the Hebrew direction automatically.

- [ ] **Step 8: Commit**

```bash
git add app.js app.css tests/occupancy-view.spec.ts
git commit -m "occupancy: time scrubber across the plan span"
```

---

## Self-Review Notes

**Spec coverage.** This plan implements spec §5 C1 (two occupancy modes — Tasks 2, 6) and C3's volume budgeting (Task 2 `deviceCapacity`, Task 3). It adds what the spec lacked: the `areaCm2` property (Task 1 — nothing could compute without it), temperature/wood compatibility (Task 4), the model-derived clash (Task 5), and the owner-requested view (Tasks 7, 8).

**Deliberately deferred, with reasons:**
- **Spec §3 (Slice A: preheat, fuel, refuel) and §4 (Slice B: charcuterie)** — independent of occupancy; each is its own plan. The spec's build order put A first, but the owner's priority is the collision and the view, so occupancy is reordered ahead. The `equipPlan` seam that A introduces is *not* required by this plan: occupancy reads `computed` stages directly rather than enriching them.
- **Spec §5 C2 (probe channels)** — monitoring, not occupancy; belongs with Slice A.
- **Drag-to-reassign in the view** — read-only until the model is trusted, per the owner.

**Known limitation to carry into the next plan:** `combinedEventsRows` (`app.js:~6880`) still does its own cross-event smoker overlap on time alone, so the multi-event view can still report a false clash. Task 5 deliberately leaves it untouched to keep the diff reviewable; it should be migrated to `deviceOccupancy` in the follow-on.

**Type consistency check.** `deviceCapacity` returns `{mode, areaCm2, usableCm2, racks, hooks, litres, known}` — used with those exact names in Tasks 3, 6, 7. `itemOccupancy` returns `{mode, cm2, hooks, litres, hang}` — consumed in Tasks 3 and 6. `deviceOccupancy` returns `{dev, devName, mode, t, cap, items, usedCm2, usedLitres, hooksUsed, pct, over, compat, hooksOver}` — `compat` added in Task 4, `hooksOver` in Task 6, both consumed in Tasks 5 and 7. `cookerContention` entries change shape from `{a,b}` to `{devId, devName, at, reason, pct, compat, items}`; both consumers are updated in Task 5 Step 4.

---

### Task 9: Migrate the multi-event view to the occupancy model

`combinedEventsRows` (`app.js:~6987`) still flags a cross-event clash whenever two smoke windows overlap in time — the same false positive Task 5 removed from the single-event plan. Until this lands, the app holds two contradictory notions of a clash.

**This is NOT a mechanical swap.** Three real obstacles, which is why it is its own task:
1. `combinedEventsRows` builds its own lightweight rows — it keeps only a `smoke` window `{start,end}` in ms, **discards temperatures**, and never calls `cookerFor` at all (it assumes a single smoker). `deviceOccupancy` needs `{m, stages:[{kind, start:Date, end:Date, temp}]}`.
2. Each event has its **own scope** for item→cooker assignments (`mk-item-cooker-<scope>`, `mk-tlstate-<id>`), but `deviceOccupancy(devId, tMs, computed, scope)` takes ONE scope for every item. A cross-event query spans scopes.
3. Cross-event items may legitimately sit on the same physical device from different events.

**Files:**
- Modify: `app.js` — `deviceOccupancy` (accept a pre-resolved device per entry); `combinedEventsRows`
- Test: `tests/occupancy-multievent.spec.ts` (create)

**Interfaces:**
- Produces: `deviceOccupancy` honours an optional `devId` on a computed entry — `const d = c.devId ? {id:c.devId} : cookerFor(c.m.key, s.kind, scope)`. This is the minimal generalisation: each caller resolves the device in whatever scope it owns, and the model stays scope-agnostic.

- [ ] **Step 1: Write the failing test**

Create `tests/occupancy-multievent.spec.ts`. Two events, each with one cut, smoke windows overlapping, one 4-rack cabinet smoker shared. Assert: `combinedEventsRows()` reports NO contention (they fit), and that a genuinely over-capacity pair (single-grate kamado) DOES report contention. Model the fixtures on `tests/occupancy-clash.spec.ts` C1/C2 and on `tests/wave2-multievent.spec.ts` for how events are seeded.

- [ ] **Step 2: Run it and confirm it fails** — the fitting pair is currently flagged.

- [ ] **Step 3: Let a computed entry carry its own resolved device**

In `deviceOccupancy`, replace the device lookup with:

```js
      const d=c.devId?{id:c.devId}:cookerFor(c.m.key, s.kind, scope);   // caller may pre-resolve in its own event scope
      if(!d || d.id!==devId) return;
```

- [ ] **Step 4: Rebuild `combinedEventsRows` rows into computed shape**

Keep real `Date` stages and carry `temp` through (it is currently discarded), resolve each item's device with that event's own scope, set `devId` on the entry, then derive contention per device via `deviceOccupancy` exactly as `cookerContention` does — over capacity or `!compat.tempOk`. Preserve the existing `rows[].contention` boolean so `cPaintEvents` and the home multi-event bar keep working unchanged.

- [ ] **Step 5: Run the multi-event regression set**

```bash
npx playwright test tests/occupancy-multievent.spec.ts tests/wave2-multievent.spec.ts tests/wave2-combined.spec.ts tests/waveE-multievent-pro.spec.ts tests/occupancy-clash.spec.ts --workers=1 --retries=2 --reporter=line
```

- [ ] **Step 6: Commit**

```bash
git add app.js tests/occupancy-multievent.spec.ts
git commit -m "occupancy: multi-event clashes derive from the model too"
```
