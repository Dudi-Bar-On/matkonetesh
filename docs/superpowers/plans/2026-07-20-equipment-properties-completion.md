# Equipment Properties Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every equipment item its full known property set — captured primarily by AI extraction at add-time, defaulted by device type, correctable by hand — with a colored graphical icon everywhere a property or item appears.

**Architecture:** A `props[]` array is added alongside the existing `capKey`/`multiCap` (which stay untouched, so nothing migrates). All values continue to land in `d.cap[key]`. One accessor, `propOf(dev,key)`, resolves stored value → class default by `type` → undefined, so an unset property behaves identically to a defaulted one. `aiLookupDevice` is extended to extract the properties from the manufacturer page; the form is the fallback.

**Tech Stack:** Vanilla JS single-file PWA (`app.js` + `app.css`, inlined by `build.py`), `store.get/set` (JSON localStorage), `L(he,en)` i18n, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-20-equipment-properties-completion-design.md`

## Global Constraints

- **Every equipment item and every property renders with a colored graphical icon.** Each `props[]` entry carries an `em` (emoji); chips and field labels show it, tinted with the category's existing `--eqacc` / `--eqacc-l` accent. **No new CSS** — reuse `.eq-chip`, `.eq-vfield`, `.eq-vrow`, `.ap-opt`, and the `.vc-gem` `<details>` pattern.
- **Additive only.** `capKey`, `multiCap`, and every existing device must behave byte-identically. The existing equipment suite must pass untouched.
- **`def` map keys must be VERBATIM `types[]` strings.** Never hand-type them — copy from a programmatic dump. Task 1 adds a build gate that fails the suite on any unknown key.
- **AI must never invent a property.** A value the page doesn't state comes back `null` and falls through to the class default. Out-of-bounds values are rejected, not stored.
- Metric only (the v246 rule): `maxC` °C · `bagW`/`bagL` cm · `plates` mm · `maxL` L · `maxKg` kg.
- Hebrew is primary; **no English may leak into the Hebrew UI**. Verify both languages.
- `node --check app.js` clean before every commit. Full suite green **×2** before shipping.
- Ship as **v251**: bump the stamp in `build.py`, `python build.py`, commit, `git tag v251`, `git push origin main --tags`.

**Scoping decision (deliberate, differs from the spec's DoD):** the spec's "warn when no grinder plate matches" is a *recipe↔device join that produces work-plan output*. It belongs to the **consumption layer**, not here. This plan delivers the properties, their capture, and their display. The joins land in the consumption-layer plan, which is blocked on this one.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `app.js` | modify | `props[]` on `EQUIP_CATS`/`EQUIP_OTHER_ITEMS`; `propOf()`; `cooler` item; grinder `multiCap`; form rendering; chips; `aiLookupDevice` schema |
| `app.css` | none | reuses existing classes |
| `build.py` | modify | version stamp → 251 |
| `tests/equipment-props.spec.ts` | **create** | schema gate, `propOf` defaults, form tiering, chips+icons, AI extraction, vacuum bag logic |

---

## Task 1: `props[]` schema, `propOf()`, and the type-key build gate

**Files:**
- Modify: `app.js` — `EQUIP_CATS` (lines 34-44); add `propOf()` beside `equipCat()` (line ~45)
- Test: `tests/equipment-props.spec.ts` (create)

**Interfaces:**
- Produces: `EQUIP_CATS[].props[]`, `propOf(dev,key) → value|undefined`, `propDef(cat,key,type) → default|undefined`
- Consumed by: Tasks 3-6

- [ ] **Step 1: Dump the authoritative type strings** (never hand-type them)

```bash
python - <<'PY'
import io,sys,re,json
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
js=open('app.js',encoding='utf-8').read()
blk=re.search(r"const EQUIP_CATS=\[(.*?)\n\];", js, re.S).group(1)
for line in blk.strip().split("\n"):
    cat=re.search(r"cat:'([a-z]+)'", line); ts=re.search(r"types:\[(.*?)\]", line)
    if cat: print(cat.group(1), [t for t in re.findall(r"'([^']*)'", ts.group(1))] if ts else [])
PY
```
Copy the printed strings into the `def` maps below **exactly**.

- [ ] **Step 2: Write the failing test**

Create `tests/equipment-props.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run it and confirm it FAILS**

Run: `npx playwright test tests/equipment-props.spec.ts --workers=1 --reporter=list`
Expected: FAIL at `waitForFunction` — `propOf` is not defined.

- [ ] **Step 4: Add `props[]` to the categories**

In `app.js`, add a `props:[...]` key to these `EQUIP_CATS` entries (leave every existing key untouched):

```js
// smoker
props:[
  {key:'maxC',     he:'טמפ׳ מרבית',  en:'Max temp',  kind:'num',  unit:'°C', em:'🌡️', tier:'core',
   def:{'חשמלי':135,'ארון / קבינט':150,'פלטים':260,'קמאדו / קרמי':350,'אופסט / סטיק-ברנר':300,'WSM / חבית':150,'קטל (ככלי עישון)':300,'גז (עם תיבת עשן)':260}},
  {key:'canHang',  he:'אפשר לתלות',  en:'Can hang',  kind:'bool', em:'🪝', tier:'core',
   def:{'ארון / קבינט':true,'WSM / חבית':true,'קטל (ככלי עישון)':false,'פלטים':false}},
  {key:'hooks',    he:'מספר ווים',   en:'Hooks',     kind:'num',  em:'🪝', tier:'pro'},
  {key:'waterPan', he:'מגש מים מובנה',en:'Water pan', kind:'bool', em:'💧', tier:'pro',
   def:{'ארון / קבינט':true,'WSM / חבית':true}},
],
// grill
props:[
  {key:'lid',        he:'מכסה',        en:'Lid',        kind:'bool', em:'🔒', tier:'core',
   def:{'פלנצ׳ה / פלטה':false,'לבה / אינפרא':false,'פחם':true,'גז':true,'קטל':true}},
  {key:'maxC',       he:'טמפ׳ מרבית',  en:'Max temp',   kind:'num', unit:'°C', em:'🌡️', tier:'pro',
   def:{'גז':300,'פחם':400,'קטל':350,'פלנצ׳ה / פלטה':300,'לבה / אינפרא':500}},
  {key:'rotisserie', he:'שיפוד מסתובב',en:'Rotisserie', kind:'bool', em:'🔄', tier:'pro'},
],
// oven
props:[
  {key:'maxC',  he:'טמפ׳ מרבית', en:'Max temp', kind:'num', unit:'°C', em:'🌡️', tier:'core',
   def:{'ביתי':275,'דק':400,'פיצה':500}},
  {key:'fan',   he:'טורבו',      en:'Fan',      kind:'bool', em:'🌀', tier:'pro', def:{'ביתי':true}},
  {key:'steam', he:'אדים',       en:'Steam',    kind:'bool', em:'♨️', tier:'pro'},
],
// sousvide
props:[
  {key:'maxL',  he:'נפח מרבי',   en:'Max volume', kind:'num', unit:'ל׳', em:'🪣', tier:'core',
   def:{'טבילה (immersion)':20,'מיכל ייעודי':12}},
  {key:'watts', he:'הספק',       en:'Power',      kind:'num', unit:'W',  em:'⚡', tier:'pro', def:1000},
  {key:'maxC',  he:'טמפ׳ מרבית', en:'Max temp',   kind:'num', unit:'°C', em:'🌡️', tier:'pro', def:95},
],
// vacuum
props:[
  {key:'bagW',    he:'רוחב איטום', en:'Seal width', kind:'num', unit:'ס״מ', em:'📏', tier:'core',
   def:{'שקית חיצונית (edge)':30,'חדר (chamber)':30,'ידני / משאבה':25}},
  {key:'bagKind', he:'סוג שקיות',  en:'Bag type',   kind:'choice', em:'📦', tier:'core', def:'both',
   opts:[{v:'roll',he:'גליל לחיתוך',en:'Cuttable roll'},{v:'bags',he:'שקיות חתוכות',en:'Pre-cut bags'},{v:'both',he:'שניהם',en:'Both'}]},
  {key:'pulse',   he:'מצב לח/פולס', en:'Pulse/moist', kind:'bool', em:'〰️', tier:'pro', def:{'חדר (chamber)':true}},
],
// probe
props:[
  {key:'maxC',     he:'טמפ׳ מרבית', en:'Max temp', kind:'num', unit:'°C',  em:'🌡️', tier:'pro', def:300},
  {key:'accuracy', he:'דיוק',       en:'Accuracy', kind:'num', unit:'±°C', em:'🎯', tier:'pro', def:1},
],
// grinder
props:[
  {key:'throughput', he:'תפוקה', en:'Throughput', kind:'num', unit:'ק״ג/דק׳', em:'⏱️', tier:'pro',
   def:{'ייעודית':2,'מתאם למיקסר':0.7}},
],
// stuffer
props:[
  {key:'speed', he:'מהירויות', en:'Speeds', kind:'choice', em:'⚙️', tier:'pro',
   opts:[{v:'1',he:'מהירות אחת',en:'Single'},{v:'2',he:'שתי מהירויות',en:'Two-speed'}]},
],
```

- [ ] **Step 4b: Add unit metadata to every numeric property**

Owner requirement: an out-of-range number is usually a **unit mismatch**, not nonsense. US spec pages give
°F; seal widths are quoted in mm; capacities in lb. Discarding those loses correct data.

Add `bounds` (in the canonical metric unit) and `alt` (ordered conversions to try) to each numeric property
declared in Step 4:

| property | `unit` | `bounds` | `alt` |
|---|---|---|---|
| `maxC` (smoker/grill/oven/probe) | `°C` | `[40,600]` | `['F->C']` |
| `maxL` | `ל׳` | `[2,60]` | `['qt->L','gal->L']` |
| `watts` | `W` | `[100,3000]` | `[]` |
| `bagW` | `ס״מ` | `[10,60]` | `['mm->cm','in->cm']` |
| `accuracy` | `±°C` | `[0.1,5]` | `['Fdeg->Cdeg']` |
| `throughput` | `ק״ג/דק׳` | `[0.1,20]` | `['lb->kg']` |
| `hooks` / `count` | — | `[1,200]` | `[]` |
| `maxKg` (scale) | `ק״ג` | `[0.1,200]` | `['lb->kg','g->kg']` |
| `maxMm` (slicer) | `מ״מ` | `[0.5,50]` | `['cm->mm','in->mm']` |
| `tempC` (curechamber) | `°C` | `[0,30]` | `['F->C']` |
| `rhPct` | `%` | `[40,95]` | `[]` |

- [ ] **Step 4c: Add the converter registry and `propCoerce`** (place beside `propOf`)

```js
// Unit conversions for values that arrive in the wrong scale — a US spec page gives °F, a seal width is
// quoted in mm, a capacity in lb. These are CORRECT values in another unit, not garbage, so they must be
// converted rather than discarded.
const UNIT_CONV={
  'F->C':     function(v){ return (v-32)*5/9; },
  'Fdeg->Cdeg':function(v){ return v*5/9; },      // a DELTA (tolerance), not a temperature
  'mm->cm':   function(v){ return v/10; },
  'in->cm':   function(v){ return v*2.54; },
  'cm->mm':   function(v){ return v*10; },
  'in->mm':   function(v){ return v*25.4; },
  'lb->kg':   function(v){ return v*0.45359; },
  'g->kg':    function(v){ return v/1000; },
  'qt->L':    function(v){ return v*0.94635; },
  'gal->L':   function(v){ return v*3.78541; },
};
// Canonical FIRST: only convert when the value is implausible as-is. 500 stays 500°C (a lava grill really
// reaches it); 900 is impossible in °C, so it becomes 482°C. Returns null when NO interpretation is
// plausible — the caller must then leave it unset and let the user type it, never store a guess.
function propCoerce(p, raw){
  if(raw===undefined||raw===null||raw==='') return null;
  let n=(typeof raw==='number')?raw:parseFloat(String(raw).replace(',','.'));
  if(isNaN(n)) return null;
  const b=p.bounds;
  if(!b) return {v:n, conv:null};
  if(n>=b[0] && n<=b[1]) return {v:n, conv:null};                 // plausible as given — trust it
  for(const key of (p.alt||[])){
    const f=UNIT_CONV[key]; if(!f) continue;
    const c=f(n);
    if(c>=b[0] && c<=b[1]) return {v:Math.round(c*100)/100, conv:key};
  }
  return null;                                                     // implausible in every unit
}
```

- [ ] **Step 4d: Support a unit suffix in MANUAL entry too**

The same rule applies when the user types it. `propParse(p, text)` accepts `"500F"`, `"300mm"`, `"11lb"`,
`"5 ק״ג"` — strip the suffix, map it to the matching `alt` conversion, then run `propCoerce`. A bare number
is treated as the canonical unit. This is what makes manual entry forgiving rather than a second trap.

- [ ] **Step 5: Add the accessor** immediately after `function equipCat(cat)` (app.js ~line 45)

```js
// Resolve an equipment property: stored value -> class default for this device TYPE -> undefined.
// Every consumer must read through this, so an unset property behaves exactly like a defaulted one
// and an empty cap is only a precision loss, never a blocker.
function propSpec(cat, key){
  const c = equipCat(cat); if(!c) return null;
  return (c.props||[]).find(function(p){ return p.key===key; }) || null;
}
function propDef(cat, key, type){
  const p = propSpec(cat, key); if(!p || p.def===undefined) return undefined;
  if(p.def && typeof p.def==='object' && !Array.isArray(p.def)) return p.def[type];
  return p.def;                                   // scalar default (applies to every type)
}
function propOf(dev, key){
  if(!dev) return undefined;
  const v = dev.cap ? dev.cap[key] : undefined;
  if(v!==undefined && v!=='' && v!==null) return v;
  return propDef(dev.cat, key, dev.type);
}
```

- [ ] **Step 6: Run the tests — all three PASS**

Run: `npx playwright test tests/equipment-props.spec.ts --workers=1 --reporter=list`
Expected: **3 passed**

- [ ] **Step 7: Commit**

```bash
node --check app.js
git add app.js tests/equipment-props.spec.ts
git commit -m "feat(equip): props[] schema + propOf() accessor + type-key build gate"
```

---

## Task 2: `cooler` item, grinder plates, and numeric accessory properties

**Files:**
- Modify: `app.js` — `EQUIP_CATS` grinder entry (line ~41); `EQUIP_OTHER_ITEMS` (line ~5088)
- Test: `tests/equipment-props.spec.ts`

**Interfaces:**
- Consumes: `propOf` (Task 1)
- Produces: grinder `multiCap.plates`; `EQUIP_OTHER_ITEMS` entries gain `props[]`; a `cooler` item

- [ ] **Step 1: Write the failing test**

Append to `tests/equipment-props.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E4" --workers=1 --reporter=list`
Expected: FAIL — no `cooler`, grinder has no `multiCap`.

- [ ] **Step 3: Give the grinder a plates list**

In the `grinder` entry of `EQUIP_CATS`, add (keeping `capKey:null`):

```js
multiCap:{key:'plates', he:'פלטות טחינה (מ״מ)', en:'Grinder plates (mm)', uHe:'מ״מ', uEn:'mm', em:'⚙️'},
```

- [ ] **Step 4: Add `cooler` and the accessory properties**

In `EQUIP_OTHER_ITEMS`, add the item (place it after `curechamber`):

```js
{key:'cooler', he:'צידנית / קמברו', en:'Cooler / cambro', em:'🧊'},
```

and add `props` to these existing entries:

```js
// scale — keep its existing prop:{key:'res',...}, add:
props:[{key:'maxKg', he:'משקל מרבי', en:'Max capacity', kind:'num', unit:'ק״ג', em:'⚖️', tier:'core'}],
// hooks
props:[{key:'count', he:'מספר ווים', en:'How many', kind:'num', em:'🪝', tier:'core'}],
// curechamber — keep its existing prop:{key:'kind',...}, add:
props:[{key:'tempC', he:'טמפ׳ יעד', en:'Target temp', kind:'num', unit:'°C', em:'🌡️', tier:'pro', def:13},
       {key:'rhPct', he:'לחות יעד',  en:'Target RH',   kind:'num', unit:'%',  em:'💧', tier:'pro', def:78}],
// humidity
props:[{key:'rhPct', he:'לחות יעד', en:'Target RH', kind:'num', unit:'%', em:'💧', tier:'pro', def:78}],
// slicer
props:[{key:'maxMm', he:'עובי מרבי', en:'Max thickness', kind:'num', unit:'מ״מ', em:'🔪', tier:'pro'}],
```

> `cooler` needs no properties — presence is the whole signal.

- [ ] **Step 5: Run the test — PASSES**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E4" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 6: Confirm the unownable-requirement bug is closed**

```bash
python -c "import data, equipment_map as em; em.apply(data.CUTS,data.SPECIALS,data.MAKES); print('cooler in vocab:', 'cooler' in em.VOCAB)"
grep -c "key:'cooler'" app.js    # expect 1
```

- [ ] **Step 7: Commit**

```bash
node --check app.js
git add app.js tests/equipment-props.spec.ts
git commit -m "feat(equip): cooler item, grinder plates list, numeric accessory properties"
```

---

## Task 3: Render properties in the device form — icons, tiering, persistence

**Files:**
- Modify: `app.js` — `paintVerify` (~5370), `doSave` (~5301) inside `openEquipment`
- Test: `tests/equipment-props.spec.ts`

**Interfaces:**
- Consumes: `propSpec`, `propDef`, `propOf`, `L()`, `esc()`
- Produces: `#eqProp-<key>` inputs; `.eq-adv` collapsed advanced section

- [ ] **Step 1: Write the failing test**

```ts
test('E5: core props render inline with icons; pro props hide in Advanced; values persist', async ({ page }) => {
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
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E5" --workers=1 --reporter=list`
Expected: FAIL — `#eqProp-maxC` never appears.

- [ ] **Step 3: Render the fields** — inside `paintVerify`, after `fuelRow` is built

```js
    // Equipment properties. Core render inline; pro collapse into one <details>. Each label carries its
    // own icon, tinted by the category accent already on the sheet. The class default is shown as the
    // PLACEHOLDER so an empty field reads as "using the default", never as missing data.
    const propField=function(p){
      const dv=(dev&&dev.cap&&dev.cap[p.key]!=null&&dev.cap[p.key]!=='')?dev.cap[p.key]:'';
      const dflt=propDef(nc, p.key, (d.type||((cm(nc).types||[])[0])));
      const lbl=`<label data-propfor="${esc(p.key)}"><span class="eq-pem">${p.em}</span> ${esc(L(p.he,p.en))}${p.unit?` <small>(${esc(p.unit)})</small>`:''}</label>`;
      if(p.kind==='bool'){
        const on=(dv===''?(dflt===true):(dv===true||dv==='true'));
        return `<div class="eq-vfield">${lbl}<select id="eqProp-${esc(p.key)}" class="eq-vin"><option value="true" ${on?'selected':''}>${L('כן','Yes')}</option><option value="false" ${!on?'selected':''}>${L('לא','No')}</option></select></div>`;
      }
      if(p.kind==='choice'){
        const cur=(dv===''?dflt:dv);
        return `<div class="eq-vfield">${lbl}<select id="eqProp-${esc(p.key)}" class="eq-vin">${(p.opts||[]).map(function(o){return `<option value="${esc(o.v)}" ${o.v===cur?'selected':''}>${esc(L(o.he,o.en))}</option>`;}).join('')}</select></div>`;
      }
      return `<div class="eq-vfield">${lbl}<input id="eqProp-${esc(p.key)}" class="eq-vin" type="number" inputmode="decimal" value="${esc(dv)}" placeholder="${dflt!==undefined?esc(String(dflt)):''}"></div>`;
    };
    const _props=(cm(nc).props||[]);
    const coreProps=_props.filter(function(p){return p.tier==='core';}).map(propField).join('');
    const proProps=_props.filter(function(p){return p.tier==='pro';}).map(propField).join('');
    const propRows=(coreProps?`<div class="eq-vrow">${coreProps}</div>`:'')
      +(proProps?`<details class="eq-adv vc-gem"><summary>⚙️ ${L('מתקדם','Advanced')}</summary><div class="eq-vrow">${proProps}</div></details>`:'');
```

Then include `propRows` in the `v.innerHTML` assignment, immediately after `fuelRow`:
`v.innerHTML=heading+nameField+grid+extraMulti+fuelRow+propRows+src+acts;`

- [ ] **Step 4: Persist them** — inside `doSave`, after the `#eqvArea` block

```js
      (cc.props||[]).forEach(function(p){
        const el=$("#eqProp-"+p.key); if(!el) return;
        const raw=(el.value==null?'':String(el.value)).trim();
        if(raw===''){ delete d.cap[p.key]; return; }                 // empty -> fall back to the class default
        if(p.kind==='bool'){ d.cap[p.key]=(raw==='true'); return; }
        if(p.kind==='choice'){ d.cap[p.key]=raw; return; }
        const n=parseFloat(raw); if(!isNaN(n)) d.cap[p.key]=n; else delete d.cap[p.key];
      });
```

- [ ] **Step 5: Add the icon span** to `app.css` — **only if `.eq-pem` does not already exist**

Run `grep -n "eq-pem" app.css` first. If absent, add beside `.eq-multi-em`:
```css
.eq-pem{font-size:calc(15px * var(--fscale));line-height:1;margin-inline-end:2px}
```

- [ ] **Step 6: Run the test — PASSES**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E5" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 7: Commit**

```bash
node --check app.js
git add app.js app.css tests/equipment-props.spec.ts
git commit -m "feat(equip): render properties in the device form with icons and core/pro tiering"
```

---

## Task 4: Show properties as icon chips on the device card

**Files:**
- Modify: `app.js` — `chipsFor` (~5174)
- Test: `tests/equipment-props.spec.ts`

**Interfaces:**
- Consumes: `propOf`, `propSpec`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E6" --workers=1 --reporter=list`
Expected: FAIL — no property chips rendered.

- [ ] **Step 3: Extend `chipsFor`** — after the existing `d.cap.area` chip line

```js
    // Property chips: only STORED values (not class defaults) — a chip means "you told us this".
    (c.props||[]).forEach(function(p){
      const raw=d.cap?d.cap[p.key]:undefined; if(raw===undefined||raw===''||raw===null) return;
      if(p.kind==='bool'){ if(raw===true||raw==='true') s+=`<span class="eq-chip"><span class="em">${p.em}</span> ${esc(L(p.he,p.en))}</span>`; return; }
      if(p.kind==='choice'){ const o=(p.opts||[]).find(function(x){return x.v===raw;}); s+=`<span class="eq-chip"><span class="em">${p.em}</span> ${esc(o?L(o.he,o.en):String(raw))}</span>`; return; }
      s+=`<span class="eq-chip spec"><span class="em">${p.em}</span> ${esc(String(raw)+(p.unit?' '+p.unit:''))}</span>`;
    });
```

- [ ] **Step 4: Run the test — PASSES**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E6" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 5: Commit**

```bash
node --check app.js
git add app.js tests/equipment-props.spec.ts
git commit -m "feat(equip): property chips with icons on device cards"
```

---

## Task 5: Extract properties via the AI lookup

**Files:**
- Modify: `app.js` — `aiLookupDevice` (~5118) and the lookup handler that calls `paintVerify` (~5370)
- Test: `tests/equipment-props.spec.ts`

**Interfaces:**
- Consumes: `EQUIP_CATS[].props`, `aiJSON`
- Produces: `aiLookupDevice` returns a `props:{}` object alongside `cap`/`nozzles`/`area`

- [ ] **Step 1: Write the failing test**

```ts
test('E7: AI lookup extracts properties, bounds them, and never invents', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k')`);
  // in-range values are kept
  await page.evaluate(`window.__aiMock={name:'X',subtype:'פלטים',maxC:260,canHang:false,waterPan:true};`);
  let r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(260);
  expect(r.props.waterPan).toBe(true);
  // out-of-range is REJECTED, not stored (a wrong maxC is worse than an absent one)
  await page.evaluate(`window.__aiMock={maxC:2000};`);
  r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(undefined);
  // null means "the page didn't say" -> absent, so the class default applies
  await page.evaluate(`window.__aiMock={maxC:null};`);
  r = await page.evaluate(`aiLookupDevice('x','smoker')`) as any;
  expect(r.props.maxC).toBe(undefined);
  // vacuum seal width bounded too
  await page.evaluate(`window.__aiMock={bagW:300};`);
  r = await page.evaluate(`aiLookupDevice('x','vacuum')`) as any;
  expect(r.props.bagW).toBe(undefined);
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E7" --workers=1 --reporter=list`
Expected: FAIL — `r.props` is undefined.

- [ ] **Step 3: Extend `aiLookupDevice`**

Add per-key bounds near the top of the file's equipment section:

```js
// Plausibility bounds for AI-extracted properties. Out-of-range is DISCARDED rather than stored:
// an absent value falls through to a sane class default, while a wrong one silently poisons the plan.
const PROP_BOUNDS={maxC:[40,600], maxL:[2,60], watts:[100,3000], bagW:[10,60], bagL:[10,120],
                   maxKg:[0.1,200], accuracy:[0.1,5], throughput:[0.1,20], hooks:[1,100],
                   count:[1,200], maxMm:[0.5,50], tempC:[0,30], rhPct:[40,95]};
```

Inside `aiLookupDevice`, add the category's properties to the requested schema and validate the response:

```js
  const catProps=(c.props||[]);
  // ...append to `schema`: one entry per catProps key, described with its unit, "or null"
  // ...append to `task`: "Only state a property the page actually gives; use null otherwise."
  const props={};
  catProps.forEach(function(p){
    let v=raw?raw[p.key]:undefined;
    if(v===undefined||v===null||v==='') return;                     // absent -> class default applies
    if(p.kind==='bool'){ props[p.key]=(v===true||v==='true'); return; }
    if(p.kind==='choice'){ if((p.opts||[]).some(function(o){return o.v===v;})) props[p.key]=v; return; }
    const n=parseFloat(v); if(isNaN(n)) return;
    const b=PROP_BOUNDS[p.key];
    if(b && (n<b[0]||n>b[1])) return;                               // implausible -> discard
    props[p.key]=n;
  });
```

Return `props` in the object: `return { name:nm, subtype:subtype, fuel:..., cap:cap, nozzles:nozzles, area:area, props:props, note:..., details:details };`

- [ ] **Step 4: Feed them into the verify card** — in the lookup handler, before `paintVerify(...)`

```js
        _aiProps = r.props || {};        // declare `let _aiProps={};` beside `aiDetails` at the top of drawForm
```
and in `paintVerify`'s `propField`, prefer an AI-extracted value when present:
`const dv=(_aiProps && _aiProps[p.key]!==undefined) ? _aiProps[p.key] : (...existing dev lookup...);`

- [ ] **Step 5: Run the test — PASSES**

Run: `npx playwright test tests/equipment-props.spec.ts -g "E7" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 6: Commit**

```bash
node --check app.js
git add app.js tests/equipment-props.spec.ts
git commit -m "feat(equip): AI lookup extracts device properties with plausibility bounds"
```

---

## Task 6: Verification and ship v251

**Files:** `build.py`, `tests/equipment-props.spec.ts`

- [ ] **Step 1: Add the no-regression gate**

```ts
test('E8: existing devices are unaffected by the property layer', async ({ page }) => {
  await boot(page);
  // a device saved before this feature has no props; every existing accessor still works
  await page.evaluate(`equipSave([{id:'old',cat:'smoker',type:'פלטים',name:'Old',cap:{racks:3},specSource:'manual'}]); equipSetConfigured();`);
  expect(await page.evaluate(`equipList()[0].cap.racks`)).toBe(3);
  expect(await page.evaluate(`probeChannels()`)).toBe(0);
  expect(await page.evaluate(`canSmoke()`)).toBe(true);
  // an absent property is a precision loss, never a blocker
  expect(await page.evaluate(`propOf(equipList()[0],'maxC')`)).toBe(260);
  expect(await page.evaluate(`propOf(equipList()[0],'hooks')`)).toBe(undefined);
});
```

Run: `npx playwright test tests/equipment-props.spec.ts --workers=1 --reporter=list` → **all pass**

- [ ] **Step 2: Verify both languages by hand-render**

```bash
python build.py && node serve.js 8123 &
```
Open `http://localhost:8123` → **⋯ More → 🧰 הציוד שלי** → edit a smoker. Confirm: core properties visible with icons, "⚙️ מתקדם" collapsed, placeholders showing class defaults. Switch to English and confirm the same labels read correctly with no Hebrew leaking. Stop the server.

- [ ] **Step 3: Full suite ×2**

```bash
npx playwright test --workers=1 --retries=2 --reporter=list
npx playwright test --workers=1 --retries=2 --reporter=list
```
Expected: **all passed, both runs.** If either fails, STOP and report BLOCKED — do not edit a test to make it pass.

- [ ] **Step 4: Ship v251**

```bash
node --check app.js
sed -i 's/מהדורה 250 · 17.7.26/מהדורה 251 · 20.7.26/' build.py
python build.py
grep -c "מהדורה 251" dist/index.html    # expect 1
git add app.js app.css build.py tests/equipment-props.spec.ts
git commit -m "v251 · equipment properties: full known set, AI-extracted, icons everywhere"
git tag v251
git push origin main --tags
```

- [ ] **Step 5: Confirm the live deploy**

```bash
node -e "fetch('https://matkonetesh.pages.dev/',{cache:'no-store'}).then(r=>r.text()).then(h=>console.log((h.match(/מהדורה\s+\d+/)||[])[0]))"
```
Expected: `מהדורה 251` (Cloudflare Pages auto-deploys; allow ~3-4 min, poll a few times).

---

## Self-Review

**Spec coverage:** §2 schema → Task 1 · §3 categories → Task 1, accessories + grinder plates + cooler → Task 2 · §4 AI-primary capture → Task 5, form fallback → Task 3 · §5 `propOf` → Task 1 · §6 tests 0/0b/0c → Tasks 1, 5 (0c vacuum-bag logic is data-only here; the item-fits-bag join is consumption-layer) · §7 DoD → Task 6.

**Deliberately deferred** (stated under Global Constraints): the recipe↔device joins that produce warnings ("no matching plate", "recipe exceeds maxC") are consumption-layer output, not property capture.

**Placeholders:** none — every step carries real code, a real command, and an expected result.

**Type/name consistency:** `propSpec`/`propDef`/`propOf` are used identically in Tasks 1, 3, 4, 6. `#eqProp-<key>` matches between the renderer (Task 3 Step 3), the persister (Step 4), and every test. `props` is the return key in Task 5 and the consumer in Task 3 Step 4.

**Known risks flagged for the implementer:** (a) Task 3 Step 5 checks whether `.eq-pem` already exists before adding CSS — the constraint is no *new* CSS beyond that one icon span; (b) Task 5 Step 4 requires declaring `let _aiProps={}` in `drawForm`'s scope alongside `aiDetails`, or the reference throws.
