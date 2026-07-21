# Occupancy-View Phase 2 (Device Diagrams) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `%`-bar occupancy card with a device-shaped diagram per cooker (cabinet shelf-stack, offset barrel, grill heat-zones, sous-vide vessel, hanging bay), rendered entirely from `deviceOccupancy()`, matching the owner-approved mockup.

**Architecture:** The honest model (H1–H4) already emits `slots[]`, `unplaced[]`, `item.slot`, `cap.*`, `compat`. Phase 2 adds three small **model** helpers (`deviceSilhouette`, `cap.areaMeasured` + `out.fit`, `deviceDisplayName`) and rewrites the **view** (`occupancyDevHtml`) into a dispatcher over five pure sub-renderers. The view computes no placement — it renders `o` and nothing else, so the diagram and the warnings can never disagree.

**Tech Stack:** Single-file offline PWA. `app.js` (source), `app.css` (source), `build.py` inlines to `dist/index.html`. Tests: Playwright (`npx playwright test`, config already at workers:6). Manual UI: `node serve.js` after a build (restart after every build — lesson L12).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-21-occupancy-view-phase2-spec.md` governs. The pixel target is `scratchpad/occupancy-mockup.html` (artifact rev3, approved).
- **One source of truth:** the view renders `deviceOccupancy(o)` only; it computes no occupancy/placement of its own. New model values live in `deviceOccupancy`/helpers, never in the view.
- **Honest fill — three states only:** solid = measured, dashed = `cm2===null` (unmeasured, never numbered, never on a shelf), empty = free (drawn, not hidden). No fourth state; no invented measurement.
- **Fit ladder is a model value** (`out.fit.verdict` ∈ `'ok'|'tight'|'over'`): green ✓ / orange ◐ "ייתכן צפוף" (estimate, moderate overflow) / red ⚠ "…לא נכנס" (measured, OR a single item > `FIT_HARD_FACTOR × perSlotCm2`). `FIT_HARD_FACTOR = 1.6`.
- **Round grill draws as a true circle** (`width===height`, `border-radius:50%`). Non-negotiable (owner regression).
- **Colors from app tokens** (`--char/--ember/--ash/--bone/--smoke/--line/--fresh/--over/--grate/--cool/…`). **Every text size uses `calc(Npx * var(--fscale))`** so accessibility text-scaling works. Works in all three themes (light, light-HC app.css:389, dark app.css:435).
- **Bilingual:** every string via `L(he,en)`; RTL correct; numeric/`≥`/°C readouts wrapped `dir="ltr"` where a bidi flip is possible (lesson L13).
- **Device label:** `out.devName` comes from `deviceDisplayName(dev)` (name + sequential `· מס׳ N`/`· #N` for duplicates).
- **TDD, per discipline §10:** write the failing test FIRST (witness RED), implement minimally, GREEN, commit. Playwright is part of testing AND debugging; a feature is done only when UI-verified by a *viewed* screenshot at 390px. Full suite once; if 100% green, the gate is met.
- **No scheduler/packer/resolution change.** `openOccupancyView`, `_occOpenAt`, `_occWire`, the scrubber are untouched.

---

## File Structure

- **Modify `app.js`:**
  - Add `deviceSilhouette(dev)` (near `deviceCapacity`, ~app.js:308).
  - Add `FIT_HARD_FACTOR` const + `cap.areaMeasured` + `out.fit` block inside `deviceOccupancy` (~app.js:400–461).
  - Add `deviceDisplayName(dev)`; use it to set `out.devName` (app.js:404).
  - Rewrite `occupancyDevHtml(o)` (app.js:466–514) into a dispatcher + shared header/fit-line/a11y-list.
  - Add sub-renderers `_occCabinetBody(o)`, `_occOffsetBody(o)`, `_occGrillBody(o)`, `_occVesselBody(o)`, `_occBayHtml(o)`.
- **Modify `app.css`:** add missing tokens (`--over,--over-l,--grate,--cool,--cooll,--fresh-l`) to all three `:root` blocks; add the `.occ2-*` diagram styles.
- **Tests (new):** `tests/occ-silhouette.spec.ts`, `tests/occ-fit-ladder.spec.ts`, `tests/occ-devname.spec.ts`, `tests/occ-view-cabinet.spec.ts`, `tests/occ-view-offset.spec.ts`, `tests/occ-view-grill.spec.ts`, `tests/occ-view-vessel.spec.ts`, `tests/occ-view-bay.spec.ts`.
- **Build:** `python build.py` after JS/CSS changes; the build gate (E1 etc.) must stay green.

**Naming note:** new CSS classes are prefixed `occ2-` to avoid colliding with the current `.occ-*` block (app.css:1628) during the rewrite; the old `.occ-*` block is removed in the final task once nothing references it.

---

## Task 1: `deviceSilhouette(dev)` — type→contour mapping

**Files:**
- Modify: `app.js` (add function after `deviceCanHang`/`ownsHangingDevice`, ~app.js:315)
- Test: `tests/occ-silhouette.spec.ts`

**Interfaces:**
- Produces: `deviceSilhouette(dev) -> 'cabinet'|'offset'|'grill-round'|'grill-rect'|'vessel'` — pure, global function.

- [ ] **Step 1: Write the failing test** — `tests/occ-silhouette.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceSilhouette==='function'`);
};
const sil = (page: any, cat: string, type: string) =>
  page.evaluate(`deviceSilhouette({cat:${JSON.stringify(cat)}, type:${JSON.stringify(type)}})`);

test('cabinet smoker and every oven type map to cabinet', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'smoker', 'ארון / קבינט')).toBe('cabinet');
  for (const t of ['ביתי','דק','פיצה']) expect(await sil(page, 'oven', t)).toBe('cabinet');
  expect(await sil(page, 'smoker', 'חשמלי')).toBe('cabinet');   // default rack device
});
test('offset smoker maps to offset', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'smoker', 'אופסט / סטיק-ברנר')).toBe('offset');
});
test('grill body shape: round for kettle/charcoal, rect for gas', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'grill', 'קטל')).toBe('grill-round');
  expect(await sil(page, 'grill', 'פחם')).toBe('grill-round');
  expect(await sil(page, 'grill', 'גז')).toBe('grill-rect');
  expect(await sil(page, 'grill', 'פלנצ׳ה / פלטה')).toBe('grill-rect');
});
test('sous-vide maps to vessel', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'sousvide', 'טבילה (immersion)')).toBe('vessel');
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/occ-silhouette.spec.ts`
Expected: FAIL — `deviceSilhouette` is not a function.

- [ ] **Step 3: Implement minimally** — add to `app.js` after app.js:315:

```js
// Type-based device contour (Phase 2). Model-based per-body shape capture is deferred to the
// add-device AI lookup; today the silhouette is a pure function of (cat, type).
function deviceSilhouette(dev){
  if(!dev) return 'cabinet';
  if(dev.cat==='sousvide') return 'vessel';
  if(dev.cat==='grill') return (['קטל','פחם'].indexOf(dev.type)>=0) ? 'grill-round' : 'grill-rect';
  if(dev.cat==='smoker' && dev.type==='אופסט / סטיק-ברנר') return 'offset';
  return 'cabinet';   // all other smokers + all ovens: a truthful stacked-grate view
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npx playwright test tests/occ-silhouette.spec.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add app.js tests/occ-silhouette.spec.ts
git commit -m "feat(occ): deviceSilhouette — type-based device contour (Phase 2 T1)"
```

---

## Task 2: `cap.areaMeasured` + `out.fit` honesty verdict

**Files:**
- Modify: `app.js` — add `FIT_HARD_FACTOR` const near the top constants; set `cap.areaMeasured` in/after `deviceCapacity` read; add the `out.fit` block in `deviceOccupancy` before `return out` (app.js:461).
- Test: `tests/occ-fit-ladder.spec.ts`

**Interfaces:**
- Consumes: `deviceOccupancy(devId,tMs,computed,scope)`, `packDevice`, existing `cap`, `out.slots`, `out.unplaced` (Task-0 model, already shipped).
- Produces: `out.fit = { verdict:'ok'|'tight'|'over', measured:boolean, hardItems:string[], softItems:string[] }`; `out.cap.areaMeasured:boolean`; global `FIT_HARD_FACTOR=1.6`.

- [ ] **Step 1: Write the failing test** — `tests/occ-fit-ladder.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// A 5-shelf cabinet. areaCm2 8500 → usable ~7225 / 5 = ~1445 per shelf... we want ~1020, so use 6000.
// Estimated (class-default) area vs user-measured area is the axis under test.
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceOccupancy==='function' && typeof FIT_HARD_FACTOR!=='undefined'`);
};
// cabinet with NO cap.areaCm2 → area comes from the class default (estimate). racks:5.
const ESTIMATE = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5} }];
// cabinet WITH a user area too small for the brisket → measured.
const MEASURED = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5, areaCm2:6000} }];

const fitAt = (keys: string[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
  var computed=${JSON.stringify(keys)}.map(mk);
  ${JSON.stringify(keys)}.forEach(function(k){ setItemCooker(k,'smoke','d1'); });
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  return { verdict:o.fit.verdict, measured:o.fit.measured, hard:o.fit.hardItems, soft:o.fit.softItems, perSlot:o.cap.perSlotCm2, areaMeasured:o.cap.areaMeasured };
})()`;

test('estimate + moderate overflow → tight (orange), never over', async ({ page }) => {
  await boot(page, ESTIMATE);
  const r = await page.evaluate(fitAt(['cut-1','cut-7','cut-9'])) as any;   // cut-1 = brisket 1320
  expect(r.areaMeasured).toBe(false);
  // brisket 1320 vs an ESTIMATED shelf, within 1.6x → tight, not over
  expect(r.verdict).toBe('tight');
  expect(r.soft).toContain(resolveHeb(page, 'cut-1'));
});
test('user-measured area too small → over (red), names the item', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(fitAt(['cut-1','cut-7','cut-9'])) as any;
  expect(r.areaMeasured).toBe(true);
  expect(r.perSlot).toBe(1020);
  expect(r.verdict).toBe('over');
  expect(r.hard.length).toBeGreaterThan(0);
});
test('everything fits → ok (green)', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(fitAt(['cut-7','cut-9','cut-10'])) as any;  // all small
  expect(r.verdict).toBe('ok');
  expect(r.hard.length).toBe(0);
  expect(r.soft.length).toBe(0);
});

async function resolveHeb(page: any, key: string){ return await page.evaluate(`resolveItem(${JSON.stringify(key)}).heb`); }
```

> Implementer note: `resolveHeb` returns a Promise — `await` it before `toContain`, or inline the value. Fix the helper usage if the linter flags it; the assertion intent is "the brisket's Hebrew name is in softItems."

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-fit-ladder.spec.ts` → FAIL (`o.fit` undefined / `FIT_HARD_FACTOR` undefined).

- [ ] **Step 3: Implement minimally**

Add the constant near the other occupancy constants (e.g. beside `PACK_EFF`/`TEMP_TOL_C`):

```js
// A default shelf area is a rough class estimate; a real shelf can plausibly run ~30-50% larger, so a
// modest overflow on an ESTIMATE is "might be tight", not "won't fit". Past this factor no slack explains
// it → over even on an estimate. When the user entered a real area, there is no slack (any overflow is hard).
const FIT_HARD_FACTOR = 1.6;
```

In `deviceCapacity` (app.js:307 return for area devices), add `areaMeasured`:

```js
  return {mode:'area', areaCm2:area, usableCm2:Math.round(area*PACK_EFF), racks:racks, hooks:hooks,
          known:area>0, areaMeasured:!!(dev.cap && Number(dev.cap.areaCm2)>0)};
```
(For the sousvide/none branches, `areaMeasured` is absent → falsy, which is correct.)

In `deviceOccupancy`, just before `out.hooksOver=…` (app.js:459), add:

```js
  // Fit verdict (Phase 2 honesty ladder) — a MODEL value so the diagram, the sentence and the a11y list agree.
  // Only area devices; volume devices fold into the H2 over-rule below.
  out.fit = {verdict:'ok', measured:!!cap.areaMeasured, hardItems:[], softItems:[]};
  if(cap.mode==='area' && cap.perSlotCm2!=null){
    const bad=[];                                   // measured items that overflow a single slot, or fit nowhere
    (out.slots||[]).forEach(function(sl){ sl.items.forEach(function(it){ if(it.cm2!=null && it.cm2>cap.perSlotCm2) bad.push(it); }); });
    (out.unplaced||[]).forEach(function(it){ if(it.cm2!=null) bad.push(it); });
    bad.forEach(function(it){
      const hard = cap.areaMeasured || (it.cm2 > FIT_HARD_FACTOR*cap.perSlotCm2);
      (hard?out.fit.hardItems:out.fit.softItems).push(it.name);
    });
    out.fit.verdict = out.fit.hardItems.length ? 'over' : (out.fit.softItems.length ? 'tight' : 'ok');
  } else if(cap.mode==='volume'){
    // an item needing a bigger bath than owned is a hard over (H2)
    if(out.over){ out.fit.verdict='over'; out.fit.measured=!!cap.known; }
  }
```

- [ ] **Step 4: Run to verify GREEN** — `npx playwright test tests/occ-fit-ladder.spec.ts` → PASS (3/3).

- [ ] **Step 5: Regression** — `npx playwright test tests/occupancy-slots.spec.ts tests/occupancy-oven.spec.ts` → still green (the `out.slots`/`unplaced` shapes are unchanged).

- [ ] **Step 6: Commit**

```bash
git add app.js tests/occ-fit-ladder.spec.ts
git commit -m "feat(occ): out.fit honesty ladder (ok/tight/over) + cap.areaMeasured (Phase 2 T2)"
```

---

## Task 3: `deviceDisplayName(dev)` — name + sequential number

**Files:**
- Modify: `app.js` — add `deviceDisplayName(dev)`; use it at app.js:404 to set `out.devName`.
- Test: `tests/occ-devname.spec.ts`

**Interfaces:**
- Consumes: `equipList()`, `t(dev.type)`.
- Produces: `deviceDisplayName(dev) -> string`. `out.devName` now = `deviceDisplayName(dev)`.

- [ ] **Step 1: Write the failing test** — `tests/occ-devname.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceDisplayName==='function'`);
};
test('two devices with the same name get sequential מס׳ N; a unique one gets no suffix', async ({ page }) => {
  await boot(page, [
    { id:'a', cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5} },
    { id:'b', cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5} },
    { id:'c', cat:'grill',  type:'קטל',          name:'Weber 67', cap:{zones:2} },
  ]);
  const names = await page.evaluate(`equipList().map(function(d){return deviceDisplayName(d);})`) as string[];
  expect(names[0]).toBe('אביה 150 · מס׳ 1');
  expect(names[1]).toBe('אביה 150 · מס׳ 2');
  expect(names[2]).toBe('Weber 67');   // unique → no suffix
});
test('a device with no name falls back to its translated type', async ({ page }) => {
  await boot(page, [{ id:'a', cat:'oven', type:'ביתי', cap:{racks:3} }]);
  const n = await page.evaluate(`deviceDisplayName(equipList()[0])`) as string;
  expect(n.length).toBeGreaterThan(0);
  expect(n).not.toContain('מס׳');
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-devname.spec.ts` → FAIL (`deviceDisplayName` undefined).

- [ ] **Step 3: Implement minimally** — add to `app.js` (near `deviceCapacity`):

```js
// The card shows the device's OWN name (e.g. "אביה 150"), not just its function. When two devices share a
// base name, disambiguate them with a sequential number in equipList() order — "אביה 150 · מס׳ 1 / 2".
function deviceDisplayName(dev){
  if(!dev) return '';
  const base = dev.name || (typeof t==='function'?t(dev.type):dev.type) || '';
  const same = equipList().filter(function(d){ return d && (d.name||(typeof t==='function'?t(d.type):d.type)||'')===base; });
  if(same.length<2) return base;
  const idx = same.findIndex(function(d){ return d===dev || d.id===dev.id; });
  const he = (typeof getLang!=='function'||getLang()==='he');
  return base + (he ? ' · מס׳ '+(idx+1) : ' · #'+(idx+1));
}
```

Change app.js:404 from `devName:dev?(dev.name||t(dev.type)||''):''` to:
```js
             devName:dev?deviceDisplayName(dev):'',
```

- [ ] **Step 4: Run to verify GREEN** — `npx playwright test tests/occ-devname.spec.ts` → PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add app.js tests/occ-devname.spec.ts
git commit -m "feat(occ): deviceDisplayName — device name + sequential מס׳ N (Phase 2 T3)"
```

---

## Task 4: CSS — tokens + `.occ2-*` diagram styles

**Files:**
- Modify: `app.css` — add missing tokens to all three `:root` blocks (~app.css:4, :389, :435); add the `.occ2-*` block near the existing `.occ-*` block (~app.css:1628).
- Test: `tests/occ-css-tokens.spec.ts` (a lightweight presence/circle gate) — plus visual verification deferred to Task 10.

**Interfaces:**
- Produces: CSS classes consumed by Tasks 5–9: `.occ2-dev,.occ2-h,.occ2-nm,.occ2-set,.occ2-facts,.occ2-ty,.occ2-rack,.occ2-shelf,.occ2-n,.occ2-tile,.occ2-tile-t,.occ2-tile-m,.occ2-big,.occ2-bleed,.occ2-empty,.occ2-offset,.occ2-barrel,.occ2-firebox,.occ2-grate,.occ2-grill,.occ2-round,.occ2-rect,.occ2-zones,.occ2-zone,.occ2-zl,.occ2-free,.occ2-vessel,.occ2-wl,.occ2-circ,.occ2-bags,.occ2-bag,.occ2-svcap,.occ2-bay,.occ2-hooks,.occ2-hung,.occ2-fit-ok,.occ2-fit-tight,.occ2-fit-over,.occ2-list`. Tokens `--over,--over-l,--grate,--cool,--cooll,--fresh-l`.

- [ ] **Step 1: Write the failing test** — `tests/occ-css-tokens.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
test('the round-grill class computes to a true circle (equal w/h, 50% radius)', async ({ page }) => {
  await page.goto('/index.html');
  const r = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'occ2-grill occ2-round';
    el.style.width = '216px';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const out = { w: Math.round(rect.width), h: Math.round(rect.height), radius: cs.borderRadius };
    el.remove();
    return out;
  });
  expect(r.w).toBe(r.h);                 // a circle: width === height
  expect(r.radius).toMatch(/50%|108px/); // border-radius:50% (or its resolved px)
});
test('the over token resolves (theme tokens present)', async ({ page }) => {
  await page.goto('/index.html');
  const over = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--over').trim());
  expect(over.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-css-tokens.spec.ts` → FAIL (no `.occ2-round` rule; `--over` empty).

- [ ] **Step 3: Implement** — Add the missing tokens to each of the three `:root` blocks (values from the approved mockup, adapted per theme). Light (`:root`, ~app.css:15, after `--fresh`):

```css
  --fresh-l:#d8f0e8; --over:#c2553f; --over-l:#f7e4de;
  --grate:#e9d7bf; --cool:#8fb8c9; --cooll:#eef4f6;
```

Light-high-contrast block (~app.css:389–391) — darker, AA-safe:
```css
  --fresh-l:#cfe8de; --over:#8a2a12; --over-l:#f0d8ce;
  --grate:#d8c4a4; --cool:#3a6a80; --cooll:#e2eef2;
```

Dark block (~app.css:435–438):
```css
  --fresh-l:rgba(127,201,168,.14); --over:#e8795f; --over-l:rgba(232,121,95,.16);
  --grate:rgba(245,222,180,.16); --cool:#9fc7d6; --cooll:rgba(143,184,201,.14);
```

Then add the diagram stylesheet (port of the mockup, tokenised, `--fscale` on every text size) after the `.occ-scrubrow` rule (~app.css:1650):

```css
/* ── Phase 2 device diagrams ─────────────────────────────────────────── */
.occ2-dev{background:var(--char2);border:1px solid var(--line);border-radius:16px;padding:13px 13px 11px;direction:rtl}
.occ2-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:11px}
.occ2-nm{font-size:calc(16px * var(--fscale));font-weight:800;color:var(--bone)}
.occ2-set{font-size:calc(16px * var(--fscale));font-weight:800;color:var(--ember);font-variant-numeric:tabular-nums;margin-inline-start:auto}
.occ2-facts{width:100%;font-size:calc(11.5px * var(--fscale));color:var(--smoke);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap}
.occ2-ty{font-weight:800;color:var(--ember2)}
/* rack / cabinet / oven */
.occ2-rack{display:flex;flex-direction:column;gap:5px}
.occ2-shelf{position:relative;min-height:38px;display:flex;align-items:stretch;gap:4px;padding:3px 24px 8px 3px;border-radius:8px}
.occ2-shelf::after{content:"";position:absolute;inset-inline:6px;bottom:2px;height:5px;border-radius:2px;background:repeating-linear-gradient(90deg,var(--grate) 0 7px,transparent 7px 11px)}
.occ2-n{position:absolute;inset-inline-start:6px;top:50%;transform:translateY(-60%);font-size:calc(11px * var(--fscale));font-weight:800;color:var(--smoke);font-variant-numeric:tabular-nums}
.occ2-shelf.occ2-over{background:var(--over-l)}
.occ2-tile{background:var(--char3);border:1.5px solid var(--line2);border-radius:7px;display:flex;flex-direction:column;justify-content:center;gap:1px;padding:5px 9px;min-height:30px;overflow:hidden;white-space:nowrap}
.occ2-tile-t{font-size:calc(13px * var(--fscale));font-weight:700;color:var(--bone);text-overflow:ellipsis;overflow:hidden}
.occ2-tile-m{font-size:calc(10.5px * var(--fscale));color:var(--smoke);font-variant-numeric:tabular-nums}
.occ2-tile.occ2-dashed{border-style:dashed;background:transparent}
.occ2-big{position:relative;flex:1 1 100%;border-color:var(--over);background:var(--over-l)}
.occ2-big::after{content:"⚠";position:absolute;inset-inline-start:6px;top:50%;transform:translateY(-50%);color:var(--over);font-size:calc(13px * var(--fscale));font-weight:900}
.occ2-big .occ2-tile-t{color:var(--over)}
.occ2-bleed{flex:0 0 14px;align-self:center;height:26px;border-radius:0 3px 3px 0;background:repeating-linear-gradient(45deg,var(--over) 0 3px,transparent 3px 7px);opacity:.6}
.occ2-empty{align-self:center;font-size:calc(11px * var(--fscale));color:var(--smoke);opacity:.7}
/* offset barrel */
.occ2-offset{position:relative;padding-inline-end:34px}
.occ2-barrel{border:2px solid var(--ash);border-radius:22px;background:var(--char3);padding:9px 12px;display:flex;flex-direction:column;gap:5px}
.occ2-firebox{position:absolute;inset-inline-end:2px;bottom:14px;width:30px;height:46px;border:2px solid var(--ash);border-radius:7px;background:repeating-linear-gradient(45deg,var(--ember2) 0 4px,transparent 4px 9px);opacity:.85}
.occ2-grate{position:relative;min-height:30px;display:flex;gap:4px;align-items:stretch;padding:2px 4px 6px}
.occ2-grate::after{content:"";position:absolute;inset-inline:2px;bottom:1px;height:4px;border-radius:2px;background:repeating-linear-gradient(90deg,var(--grate) 0 6px,transparent 6px 10px)}
/* grill zones */
.occ2-grill{border:2.5px solid var(--ash);overflow:hidden;background:repeating-linear-gradient(90deg,var(--grate) 0 6px,transparent 6px 10px),repeating-linear-gradient(0deg,var(--grate) 0 6px,transparent 6px 10px);background-color:var(--char3)}
.occ2-rect{border-radius:14px;min-height:88px}
.occ2-round{aspect-ratio:1/1;margin-inline:auto;border-radius:50%}
.occ2-zones{display:grid;grid-template-columns:repeat(2,1fr);height:100%;min-height:88px}
.occ2-zone{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 8px;text-align:center}
.occ2-zone+.occ2-zone{border-inline-start:1.5px dashed var(--ash)}
.occ2-zl{font-size:calc(10.5px * var(--fscale));color:var(--smoke)}
.occ2-free{color:var(--smoke);opacity:.7;font-size:calc(12px * var(--fscale))}
/* sous-vide vessel */
.occ2-vessel{border:2px solid var(--cool);border-top:none;border-radius:0 0 14px 14px;background:linear-gradient(180deg,var(--cooll),color-mix(in srgb,var(--cool) 22%,transparent));padding:16px 12px 12px;position:relative;min-height:86px}
.occ2-wl{position:absolute;top:0;inset-inline:0;height:2px;background:var(--cool);opacity:.6}
.occ2-circ{position:absolute;top:-8px;inset-inline-start:50%;width:10px;height:22px;border-radius:3px;background:var(--ash);transform:translateX(-50%)}
.occ2-bags{display:flex;gap:8px;justify-content:center;align-items:flex-end;flex-wrap:wrap}
.occ2-bag{background:var(--char2);border:1.5px solid var(--cool);border-radius:8px;padding:7px 11px;text-align:center;font-size:calc(12.5px * var(--fscale));font-weight:700;color:var(--bone)}
.occ2-svcap{text-align:center;font-size:calc(11.5px * var(--fscale));color:var(--smoke);margin-top:9px;font-variant-numeric:tabular-nums}
/* hanging bay */
.occ2-bay{border:1px dashed var(--line2);border-radius:10px;padding:8px 24px 9px 8px;margin-bottom:8px;position:relative;background:var(--fresh-l)}
.occ2-bay .occ2-n{color:var(--fresh);top:9px;transform:none}
.occ2-hooks{display:flex;gap:3px;font-size:calc(13px * var(--fscale));margin-bottom:7px;color:var(--fresh)}
.occ2-hooks .occ2-off{opacity:.32}
.occ2-hungrow{display:flex;gap:5px;align-items:flex-start}
.occ2-hung{border:1.5px solid var(--fresh);border-top:2px dotted var(--fresh);border-radius:0 0 7px 7px;background:var(--char2);padding:5px 9px 6px;position:relative;text-align:center;font-size:calc(12px * var(--fscale));font-weight:700;color:var(--bone)}
.occ2-hung.occ2-long{min-height:42px;display:flex;align-items:flex-end}
/* fit line + a11y list */
.occ2-fit-ok{margin-top:9px;font-size:calc(11.5px * var(--fscale));color:var(--fresh);font-weight:700}
.occ2-fit-tight{margin-top:9px;font-size:calc(12px * var(--fscale));font-weight:700;color:var(--ember);display:flex;align-items:center;gap:5px}
.occ2-fit-over{margin-top:9px;font-size:calc(12px * var(--fscale));font-weight:700;color:var(--over);display:flex;align-items:center;gap:5px}
.occ2-list{list-style:none;margin:9px 0 0;padding:9px 2px 0;border-top:1px solid var(--line);font-size:calc(11.5px * var(--fscale));color:var(--ash)}
.occ2-list li{display:flex;gap:6px;padding:2px 0;font-variant-numeric:tabular-nums}
.occ2-list .occ2-s{color:var(--smoke)}
```

- [ ] **Step 4: Build + run GREEN** — `python build.py` then `npx playwright test tests/occ-css-tokens.spec.ts` → PASS (2/2). (The test loads `dist/index.html`, so a build is required.)

- [ ] **Step 5: Commit**

```bash
git add app.css dist/index.html tests/occ-css-tokens.spec.ts
git commit -m "feat(occ): Phase 2 diagram CSS + missing tokens across 3 themes (Phase 2 T4)"
```

---

## Task 5: Dispatcher `occupancyDevHtml` + cabinet body + fit line + a11y list

**Files:**
- Modify: `app.js` — rewrite `occupancyDevHtml` (app.js:466–514); add `_occHeaderHtml(o)`, `_occFitHtml(o)`, `_occListHtml(o)`, `_occCabinetBody(o)`, and stub `_occOffsetBody/_occGrillBody/_occVesselBody` to fall back to `_occCabinetBody` (real ones land in T6–T8), `_occBayHtml` stubbed to `''` (T9).
- Test: `tests/occ-view-cabinet.spec.ts`

**Interfaces:**
- Consumes: `deviceOccupancy` object `o` (all fields), `deviceSilhouette`, `esc`, `L`, `t`, `getLang`.
- Produces: `occupancyDevHtml(o) -> string`; `_occCabinetBody(o)`, `_occFitHtml(o)`, `_occListHtml(o)`, `_occHeaderHtml(o)`.

- [ ] **Step 1: Write the failing test** — `tests/occ-view-cabinet.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function' && typeof deviceSilhouette==='function'`);
};
const MEASURED = [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'אביה 150', cap:{racks:5, areaCm2:12000} }];
const render = (keys: string[]) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
  var computed=${JSON.stringify(keys)}.map(mk);
  ${JSON.stringify(keys)}.forEach(function(k){ setItemCooker(k,'smoke','d1'); });
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
  return { shelves:div.querySelectorAll('.occ2-shelf').length,
           empties:div.querySelectorAll('.occ2-empty').length,
           listItems:div.querySelectorAll('.occ2-list li').length,
           name:(div.querySelector('.occ2-nm')||{}).textContent||'',
           hasCabinet:!!div.querySelector('.occ2-rack') };
})()`;
test('a cabinet renders one shelf per rack, names empties, and lists items', async ({ page }) => {
  await boot(page, MEASURED);
  const r = await page.evaluate(render(['cut-7','cut-9'])) as any;  // two small cuts on a big cabinet
  expect(r.hasCabinet).toBe(true);
  expect(r.shelves).toBe(5);
  expect(r.empties).toBeGreaterThan(0);           // free shelves drawn, not hidden
  expect(r.listItems).toBeGreaterThan(0);         // a11y list present
  expect(r.name).toContain('אביה 150');
});
test('an over item (measured area too small) renders as an over tile + red fit line', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון', cap:{racks:5, areaCm2:6000} }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }; };
    var computed=['cut-1','cut-7'].map(mk);
    ['cut-1','cut-7'].forEach(function(k){ setItemCooker(k,'smoke','d1'); });
    var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { over:!!div.querySelector('.occ2-big'), fitOver:!!div.querySelector('.occ2-fit-over'),
             fitText:(div.querySelector('.occ2-fit-over')||{}).textContent||'' };
  })()`) as any;
  expect(r.over).toBe(true);
  expect(r.fitOver).toBe(true);
  expect(r.fitText).toContain(await page.evaluate(`resolveItem('cut-1').heb`));
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-view-cabinet.spec.ts` → FAIL (no `.occ2-rack` — old markup still emitted).

- [ ] **Step 3: Implement** — replace `occupancyDevHtml` (app.js:466–514) with:

```js
// Phase 2: a device-shaped diagram per cooker, rendered from `o` (deviceOccupancy) ALONE. The dispatcher
// picks the silhouette; each *_Body renders only the interior; the header, fit line and a11y list are shared.
function occupancyDevHtml(o){
  const sil = deviceSilhouette(o.dev);
  let body;
  if(sil==='vessel')       body=_occVesselBody(o);
  else if(sil==='offset')  body=_occOffsetBody(o);
  else if(sil==='grill-round'||sil==='grill-rect') body=_occGrillBody(o, sil==='grill-round');
  else                     body=_occCabinetBody(o);
  const bay = (o.cap && o.cap.hooks>0) ? _occBayHtml(o) : '';
  return `<div class="occ2-dev">${_occHeaderHtml(o)}${bay}${body}${_occFitHtml(o)}${_occListHtml(o)}</div>`;
}
function _occHeaderHtml(o){
  const he=(typeof getLang!=='function'||getLang()==='he');
  const cap=o.cap, facts=[];
  if(o.compat && o.compat.commonWood) facts.push(`🪵 ${esc(t(o.compat.commonWood))}`);
  else if(o.compat && o.compat.woods && o.compat.woods.length>1) facts.push(`🪵 ${L('עצים שונים','different woods')}`);
  if(cap.slots) facts.push(`🗄️ ${cap.slots} ${he?(cap.slotLabelHe||'מדפים'):(cap.slotLabelEn||'racks')}`);
  if(cap.hooks) facts.push(`🪝 ${o.hooksUsed}/${cap.hooks}`);
  const set = (o.compat && o.compat.setpoint!=null) ? `<span class="occ2-set" dir="ltr">${o.compat.setpoint}°</span>` : '';
  return `<div class="occ2-h"><span class="occ2-nm">${esc(o.devName)}</span>${set}<div class="occ2-facts">${facts.join('')}</div></div>`;
}
// One tile for one item. Solid = measured; dashed (no number) = unmeasured (H1); over = capped + hatched bleed.
function _occTile(it, cap){
  const he=(typeof getLang!=='function'||getLang()==='he');
  if(it.cm2==null)  // unmeasured → dashed, never numbered
    return `<div class="occ2-tile occ2-dashed" title="${esc(it.name)}"><span class="occ2-tile-t">${esc(it.name)}</span><span class="occ2-tile-m">${L('מידה לא ידועה','size unknown')}</span></div>`;
  if(cap.perSlotCm2!=null && it.cm2>cap.perSlotCm2)  // over a single slot
    return `<div class="occ2-tile occ2-big" title="${esc(it.name)}"><span class="occ2-tile-t">${esc(it.name)}</span><span class="occ2-tile-m" dir="ltr">${it.cm2} ${he?'סמ״ר':'cm²'}</span></div><div class="occ2-bleed"></div>`;
  const frac=(cap.perSlotCm2>0)?Math.max(18,Math.round(it.cm2/cap.perSlotCm2*100)):40;
  return `<div class="occ2-tile" style="flex:0 0 ${frac}%" title="${esc(it.name)}"><span class="occ2-tile-t">${esc(it.name)}</span><span class="occ2-tile-m" dir="ltr">${it.cm2}</span></div>`;
}
// Cabinet / oven: a vertical shelf stack; empty shelves drawn, not hidden.
function _occCabinetBody(o){
  const cap=o.cap;
  if(cap.perSlotCm2==null && !(cap.slots>0))
    return `<div class="occ2-empty">${L('שטח לא ידוע — הוסף את שטח הבישול בכרטיס הציוד','Area unknown — add the cooking area on the device card')}</div>`;
  const rows=[];
  for(let i=0;i<cap.slots;i++){
    const sl=(o.slots||[])[i]||{items:[],over:false};
    const tiles = sl.items.length ? sl.items.map(function(it){return _occTile(it, cap);}).join('')
                                  : `<span class="occ2-empty">${L('מדף פנוי','shelf free')}</span>`;
    rows.push(`<div class="occ2-shelf${sl.over?' occ2-over':''}"><span class="occ2-n">${i+1}</span>${tiles}</div>`);
  }
  return `<div class="occ2-rack">${rows.join('')}</div>`;
}
// interim fallbacks — replaced in T6–T8
function _occOffsetBody(o){ return _occCabinetBody(o); }
function _occGrillBody(o){ return _occCabinetBody(o); }
function _occVesselBody(o){ return _occCabinetBody(o); }
function _occBayHtml(o){ return ''; }   // real bay in T9
// Fit line — a MODEL value (o.fit). Green ok / orange tight / red over, naming the items.
function _occFitHtml(o){
  const f=o.fit||{verdict:'ok'};
  if(f.verdict==='over'){
    const who = (f.hardItems&&f.hardItems.length) ? esc(f.hardItems.join(', '))+' — ' : '';
    const slotHe=(o.cap.slotKind==='zone')?'אזור':'מדף', slotEn=(o.cap.slotKind==='zone')?'zone':'shelf';
    const msg = (o.mode==='volume') ? L('חריגה מהקיבולת','Over capacity')
                                    : L('לא נכנס ל'+slotHe+' בודד','does not fit a single '+slotEn);
    return `<div class="occ2-fit-over">⚠ ${who}${msg}</div>`;
  }
  if(f.verdict==='tight'){
    const who = (f.softItems&&f.softItems.length) ? esc(f.softItems.join(', '))+' — ' : '';
    return `<div class="occ2-fit-tight">◐ ${who}${L('ייתכן צפוף — השטח מוערך. הזן שטח בישול אמיתי לבדיקה מדויקת','might be tight — area is estimated. Enter a real cooking area for a precise check')}</div>`;
  }
  return `<div class="occ2-fit-ok">✓ ${L('הכל נכנס','everything fits')}</div>`;
}
// The accessible / printable layer: item · slot · cm² for every placed area item.
function _occListHtml(o){
  if(o.mode==='volume') return '';
  const he=(typeof getLang!=='function'||getLang()==='he');
  const slotHe=(o.cap.slotKind==='zone')?'אזור':'מדף', slotEn=(o.cap.slotKind==='zone')?'zone':'shelf';
  const lis=(o.items||[]).filter(function(it){return it.mode==='area';}).map(function(it){
    const where = (it.slot!=null) ? `${he?slotHe:slotEn} ${it.slot+1}` : L('לא משובץ','unplaced');
    const size = (it.cm2!=null) ? ` · ${it.cm2} ${he?'סמ״ר':'cm²'}` : ` · ${L('מידה לא ידועה','size unknown')}`;
    return `<li><b>${esc(it.name)}</b><span class="occ2-s">· ${where}${size}</span></li>`;
  });
  return lis.length ? `<ul class="occ2-list">${lis.join('')}</ul>` : '';
}
```

- [ ] **Step 4: Build + run GREEN** — `python build.py` then `npx playwright test tests/occ-view-cabinet.spec.ts` → PASS (2/2).

- [ ] **Step 5: Regression** — `npx playwright test tests/occupancy-slots.spec.ts` → **note:** the old test `S7` asserts `.occ-warn`/`.occ-bar-over` (old markup). Update `occupancy-slots.spec.ts` S7 to the new classes (`.occ2-fit-over`, over tile) since the markup changed by design. Run both files green.

- [ ] **Step 6: Commit**

```bash
git add app.js dist/index.html tests/occ-view-cabinet.spec.ts tests/occupancy-slots.spec.ts
git commit -m "feat(occ): device-diagram dispatcher + cabinet body + fit line + a11y list (Phase 2 T5)"
```

---

## Task 6: `_occOffsetBody` — barrel + firebox

**Files:**
- Modify: `app.js` — replace the `_occOffsetBody` fallback with the real barrel renderer.
- Test: `tests/occ-view-offset.spec.ts`

**Interfaces:**
- Consumes: `o` (deviceOccupancy for an offset smoker), `_occTile`, `L`.
- Produces: `_occOffsetBody(o) -> string` (`.occ2-offset` barrel + firebox + grate rows).

- [ ] **Step 1: Write the failing test** — `tests/occ-view-offset.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
test('an offset smoker draws a barrel with a firebox and grate rows', async ({ page }) => {
  await boot(page, [{ id:'d1', cat:'smoker', type:'אופסט / סטיק-ברנר', name:'אופסט', cap:{racks:2, areaCm2:9000} }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('cut-7'), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:110}] };
    setItemCooker('cut-7','smoke','d1');
    var o=deviceOccupancy('d1', t0+1*3600e3, [item], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { barrel:!!div.querySelector('.occ2-barrel'), firebox:!!div.querySelector('.occ2-firebox'),
             grates:div.querySelectorAll('.occ2-grate').length, noRack:!div.querySelector('.occ2-rack') };
  })()`) as any;
  expect(r.barrel).toBe(true);
  expect(r.firebox).toBe(true);
  expect(r.grates).toBe(2);       // one grate row per rack
  expect(r.noRack).toBe(true);    // NOT the cabinet fallback anymore
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-view-offset.spec.ts` → FAIL (`.occ2-barrel` absent — still cabinet fallback).

- [ ] **Step 3: Implement** — replace `_occOffsetBody`:

```js
// Horizontal offset smoker: a lying barrel with a firebox to the side; grates run across.
function _occOffsetBody(o){
  const cap=o.cap;
  if(cap.perSlotCm2==null && !(cap.slots>0))
    return `<div class="occ2-empty">${L('שטח לא ידוע — הוסף את שטח הבישול בכרטיס הציוד','Area unknown — add the cooking area on the device card')}</div>`;
  const rows=[];
  for(let i=0;i<cap.slots;i++){
    const sl=(o.slots||[])[i]||{items:[],over:false};
    const tiles = sl.items.length ? sl.items.map(function(it){return _occTile(it, cap);}).join('')
                                  : `<span class="occ2-empty">${L('רשת פנויה','grate free')}</span>`;
    rows.push(`<div class="occ2-grate">${tiles}</div>`);
  }
  return `<div class="occ2-offset"><div class="occ2-firebox"><span>${L('תא בערה','firebox')}</span></div><div class="occ2-barrel">${rows.join('')}</div></div>`;
}
```

- [ ] **Step 4: Build + run GREEN** — `python build.py` then `npx playwright test tests/occ-view-offset.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js dist/index.html tests/occ-view-offset.spec.ts
git commit -m "feat(occ): offset-smoker barrel + firebox silhouette (Phase 2 T6)"
```

---

## Task 7: `_occGrillBody` — heat zones, round or rect

**Files:**
- Modify: `app.js` — replace `_occGrillBody` fallback with the zones renderer (accepts `isRound`). Update the dispatcher call already passes `sil==='grill-round'`.
- Test: `tests/occ-view-grill.spec.ts`

**Interfaces:**
- Consumes: `o` (grill deviceOccupancy), `_occTile`, `L`, `getLang`.
- Produces: `_occGrillBody(o, isRound) -> string` (`.occ2-grill` + `.occ2-round`/`.occ2-rect` + `.occ2-zones`/`.occ2-zone`).

- [ ] **Step 1: Write the failing test** — `tests/occ-view-grill.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
const grillRender = (type: string) => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var item={ m:resolveItem('cut-9'), stages:[{kind:'cook', start:new Date(t0), end:new Date(t0+1*3600e3), temp:220}] };
  setItemCooker('cut-9','cook','g1');
  var o=deviceOccupancy('g1', t0+30*60e3, [item], null);
  var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
  var g=div.querySelector('.occ2-grill');
  return { round:!!div.querySelector('.occ2-round'), rect:!!div.querySelector('.occ2-rect'),
           zones:div.querySelectorAll('.occ2-zone').length,
           zoneLabel:(div.querySelector('.occ2-zl')||{}).textContent||'',
           facts:(div.querySelector('.occ2-facts')||{}).textContent||'' };
})()`;
test('a kettle grill draws a round body with heat zones labelled אזור', async ({ page }) => {
  await boot(page, [{ id:'g1', cat:'grill', type:'קטל', name:'Weber 67', cap:{zones:2, areaCm2:3600} }]);
  const r = await page.evaluate(grillRender('קטל')) as any;
  expect(r.round).toBe(true);
  expect(r.rect).toBe(false);
  expect(r.zones).toBe(2);
  expect(r.zoneLabel).toContain('אזור');       // NOT "מדף"
  expect(r.facts).toContain('אזורי חום');       // slot label from capHe
});
test('a gas grill draws a rectangular body', async ({ page }) => {
  await boot(page, [{ id:'g1', cat:'grill', type:'גז', name:'גז', cap:{zones:3, areaCm2:4200} }]);
  const r = await page.evaluate(grillRender('גז')) as any;
  expect(r.rect).toBe(true);
  expect(r.round).toBe(false);
  expect(r.zones).toBe(3);
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-view-grill.spec.ts` → FAIL (no `.occ2-round`/`.occ2-zone`).

- [ ] **Step 3: Implement** — replace `_occGrillBody`:

```js
// Grill: a TOP-VIEW of heat zones side by side. Round contour for a kettle (a true circle), rect otherwise.
// Zone labels are "אזור N" only — the model does NOT know direct vs indirect, so it never claims to.
function _occGrillBody(o, isRound){
  const cap=o.cap, n=Math.max(1, cap.slots||1);
  const he=(typeof getLang!=='function'||getLang()==='he');
  const cells=[];
  for(let i=0;i<n;i++){
    const sl=(o.slots||[])[i]||{items:[]};
    const inner = sl.items.length ? sl.items.map(function(it){return _occTile(it, cap);}).join('')
                                  : `<span class="occ2-free">${L('פנוי','free')}</span>`;
    cells.push(`<div class="occ2-zone">${inner}<span class="occ2-zl">${he?'אזור':'zone'} ${i+1}</span></div>`);
  }
  return `<div class="occ2-grill ${isRound?'occ2-round':'occ2-rect'}"><div class="occ2-zones">${cells.join('')}</div></div>`;
}
```

- [ ] **Step 4: Build + run GREEN** — `python build.py` then `npx playwright test tests/occ-view-grill.spec.ts` → PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add app.js dist/index.html tests/occ-view-grill.spec.ts
git commit -m "feat(occ): grill heat-zone top-view, round kettle + rect (Phase 2 T7)"
```

---

## Task 8: `_occVesselBody` — sous-vide vessel

**Files:**
- Modify: `app.js` — replace `_occVesselBody` fallback with the vessel renderer.
- Test: `tests/occ-view-vessel.spec.ts`

**Interfaces:**
- Consumes: `o` (sous-vide deviceOccupancy: `mode:'volume'`, `items[].litres`, `cap.litres`, `usedLitres`), `L`, `esc`.
- Produces: `_occVesselBody(o) -> string` (`.occ2-vessel` + `.occ2-bags`/`.occ2-bag` + `.occ2-svcap`). No `%`.

- [ ] **Step 1: Write the failing test** — `tests/occ-view-vessel.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
test('a sous-vide draws a vessel with a bag per item and NO percentage', async ({ page }) => {
  await boot(page, [{ id:'s1', cat:'sousvide', type:'טבילה (immersion)', name:'אמבט', cap:{baths:[12]} }]);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var a={ m:resolveItem('cut-9'), stages:[{kind:'sv', start:new Date(t0), end:new Date(t0+6*3600e3), temp:56}] };
    setItemCooker('cut-9','sv','s1');
    var o=deviceOccupancy('s1', t0+1*3600e3, [a], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { vessel:!!div.querySelector('.occ2-vessel'), bags:div.querySelectorAll('.occ2-bag').length,
             cap:(div.querySelector('.occ2-svcap')||{}).textContent||'',
             hasPct:/%/.test(div.textContent||''), noList:!div.querySelector('.occ2-list') };
  })()`) as any;
  expect(r.vessel).toBe(true);
  expect(r.bags).toBeGreaterThan(0);
  expect(r.hasPct).toBe(false);       // sous-vide never shows a % (H2)
  expect(r.cap.length).toBeGreaterThan(0);
  expect(r.noList).toBe(true);        // the shelf a11y list is for area devices only
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-view-vessel.spec.ts` → FAIL (no `.occ2-vessel`).

- [ ] **Step 3: Implement** — replace `_occVesselBody`:

```js
// Sous-vide: an open-topped vessel with a water line + circulator, one bag per item. NO % (H2): we count
// bags and the largest single required litres; true fill needs displacement we do not have.
function _occVesselBody(o){
  const he=(typeof getLang!=='function'||getLang()==='he');
  const bags=(o.items||[]).map(function(it){ return `<div class="occ2-bag">${esc(it.name)}</div>`; }).join('')
    || `<span class="occ2-free">${L('ריק','empty')}</span>`;
  const need=o.usedLitres||0, has=(o.cap&&o.cap.litres)||0;
  const cap = `${(o.items||[]).length} ${L('שקיות','bags')} · ${L('הגדולה דורשת','largest needs')} ${need} ${he?'ל׳':'L'} · ${L('האמבט','bath')} ${has} ${he?'ל׳':'L'}`;
  return `<div class="occ2-vessel"><div class="occ2-wl"></div><div class="occ2-circ"></div><div class="occ2-bags">${bags}</div></div><div class="occ2-svcap" dir="ltr">${cap}</div>`;
}
```

- [ ] **Step 4: Build + run GREEN** — `python build.py` then `npx playwright test tests/occ-view-vessel.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js dist/index.html tests/occ-view-vessel.spec.ts
git commit -m "feat(occ): sous-vide vessel silhouette, no percentage (Phase 2 T8)"
```

---

## Task 9: `_occBayHtml` — hanging bay overlay

**Files:**
- Modify: `app.js` — replace the `_occBayHtml` stub with the real bay; it renders above the shelves for any device with `cap.hooks>0`, and the shelves below still draw empty.
- Test: `tests/occ-view-bay.spec.ts`

**Interfaces:**
- Consumes: `o` (device with hooks; `o.items[].hooks`, `o.hooksUsed`, `cap.hooks`), `L`, `esc`.
- Produces: `_occBayHtml(o) -> string` (`.occ2-bay` + `.occ2-hooks` lit/off + `.occ2-hung`).

- [ ] **Step 1: Write the failing test** — `tests/occ-view-bay.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
test('a hanging device draws a bay with lit hooks and keeps the shelves below empty', async ({ page }) => {
  // Find a hangable make (salami-type) so itemOccupancy returns mode:'hang'.
  await boot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'ארון תלייה', cap:{racks:3, areaCm2:9000, canHang:true, hooks:8} }]);
  const r = await page.evaluate(`(function(){
    var hangKey=Object.keys(DATA.makes).find(function(k){ var e=DATA.makes[k].equip; var s=e&&e.spec||{}; return !!s.hang; });
    var t0=Date.parse('2026-07-24T06:00:00');
    var item={ m:resolveItem('make-'+hangKey), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+10*3600e3), temp:75}] };
    setItemCooker('make-'+hangKey,'smoke','d1');
    var o=deviceOccupancy('d1', t0+2*3600e3, [item], null);
    var div=document.createElement('div'); div.innerHTML=occupancyDevHtml(o);
    return { bay:!!div.querySelector('.occ2-bay'), hung:div.querySelectorAll('.occ2-hung').length,
             litHooks:div.querySelectorAll('.occ2-hooks span:not(.occ2-off)').length,
             emptyShelves:div.querySelectorAll('.occ2-empty').length };
  })()`) as any;
  expect(r.bay).toBe(true);
  expect(r.hung).toBeGreaterThan(0);
  expect(r.litHooks).toBeGreaterThan(0);
  expect(r.emptyShelves).toBe(3);   // all 3 shelves stay empty — hanging frees grate area (H3)
});
```

- [ ] **Step 2: Run to verify RED** — `npx playwright test tests/occ-view-bay.spec.ts` → FAIL (`_occBayHtml` returns '').

- [ ] **Step 3: Implement** — replace `_occBayHtml`:

```js
// Hanging bay overlay — a separate channel above the shelves. Lit hooks = in use, dimmed = free. Longer
// items hang lower. The shelves below still render empty: the visual proof that hanging frees grate area.
function _occBayHtml(o){
  const cap=o.cap, used=o.hooksUsed||0, total=cap.hooks||0;
  const hung=(o.items||[]).filter(function(it){return it.mode==='hang';});
  if(!hung.length && !used) return '';
  let hooks='';
  for(let i=0;i<total;i++) hooks += `<span class="${i<used?'':'occ2-off'}">🪝</span>`;
  const tags=hung.map(function(it){
    const longCls = (it.name && it.name.length>6) ? ' occ2-long' : '';
    return `<div class="occ2-hung${longCls}">${esc(it.name)}</div>`;
  }).join('');
  return `<div class="occ2-bay"><span class="occ2-n" dir="ltr">${used}/${total}</span><div class="occ2-hooks">${hooks}</div><div class="occ2-hungrow">${tags}</div></div>`;
}
```

- [ ] **Step 4: Build + run GREEN** — `python build.py` then `npx playwright test tests/occ-view-bay.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js dist/index.html tests/occ-view-bay.spec.ts
git commit -m "feat(occ): hanging-bay overlay, shelves stay empty below (Phase 2 T9)"
```

---

## Task 10: Integration, cleanup, and full UI verification

**Files:**
- Modify: `app.css` — remove the now-dead `.occ-*` block (app.css:1628–1650) once nothing references it (grep first).
- Modify: `app.js` — remove any dead helper left from the old `occupancyDevHtml` (grep for `occ-bar`, `occ-item`, `occ-slots`, `occ-warn` string literals; delete only what is unreferenced).
- Verify: `occupancyViewHtml`, `openOccupancyView`, `_occWire`, the scrubber all still work end-to-end.

**Interfaces:**
- Consumes: everything from T1–T9.
- Produces: a clean build with no orphaned old-view code; UI verified.

- [ ] **Step 1: Grep for stragglers**

Run: `grep -nE "occ-(bar|item|slots|warn|empty|unknown|hang|facts|dev|h|wrap)\b" app.js app.css`
Expected: only `.occ-wrap`/`.occ-scrub*` (the panel shell + scrubber, still used by `openOccupancyView`/`_occWire`) remain in `app.js`. Everything tied to the old card body should be gone. Remove the dead `.occ-dev/.occ-h/.occ-bar*/.occ-slots/.occ-item*/.occ-hang/.occ-empty/.occ-unknown/.occ-warn/.occ-facts` rules from `app.css`. **Keep** `.occ-wrap`, `.occ-scrub`, `.occ-scrubrow`.

- [ ] **Step 2: Build**

Run: `python build.py`
Expected: build gates green (E1 version stamp etc.).

- [ ] **Step 3: Full suite**

Run: `npx playwright test`
Expected: 100% green. If any pre-existing occupancy spec asserted the old markup, update its assertions to the new `.occ2-*` classes (the markup changed by design — this is a spec update, not a regression waiver). Re-run until 100% green.

- [ ] **Step 4: Manual UI verification (viewed, not just captured) — §10.2**

```bash
python build.py
node serve.js &          # restart AFTER the build — the in-memory server caches dist/ (lesson L12)
```
Then via Playwright (a scratch script or the MCP browser): seed a kit with a cabinet smoker (with a name + areaCm2), an offset smoker, a kettle grill, a sous-vide, an oven, and a hanging device; open the occupancy view; at 390px, Hebrew:
- **screenshot → VIEW it** and confirm: cabinet shelf stack with numbered shelves + named device; offset barrel + firebox; kettle as a **true circle** with 2 zones; vessel with bags and no %; oven shelf stack; hanging bay with lit hooks over empty shelves; fit lines coloured correctly.
- Toggle to **English**, screenshot → VIEW: all strings translated, RTL/LTR correct, no `≥`/°/cm² bidi flips.
- Toggle **dark theme**, screenshot → VIEW: tokens legible, circle intact.
- Drag the **scrubber**: the diagrams repaint at different instants (items appear/leave).
Stop `serve.js` before any further `npx playwright test` run (it collides with Playwright's managed server — L12).

- [ ] **Step 5: Commit**

```bash
git add app.js app.css dist/index.html tests/
git commit -m "chore(occ): remove dead old-view CSS/JS; full suite + UI green (Phase 2 T10)"
```

- [ ] **Step 6: Version bump + ship** (after owner sees the UI screenshots)

Bump the version stamp per the build convention; `python build.py`; deploy. (Deferred to the owner's go, per §10.)

---

## Self-Review (done at plan-write time)

- **Spec coverage:** §2 honesty ladder → T2+T5(`_occFitHtml`). §3.1 silhouette → T1. §3.2 areaMeasured/fit → T2. §3.3 name → T3. §4.1 cabinet → T5. §4.2 offset → T6. §4.3 grill round/rect → T7. §4.4 vessel → T8. §4.5 bay → T9. §5 themes/tokens/bilingual → T4 + every render task. §6 tests → each task's spec + T10 UI. All covered.
- **Placeholder scan:** every code step contains real code; no TBD.
- **Type consistency:** `_occTile(it,cap)`, `_occCabinetBody/_occOffsetBody/_occVesselBody(o)`, `_occGrillBody(o,isRound)`, `_occBayHtml(o)`, `_occFitHtml(o)`, `_occListHtml(o)`, `_occHeaderHtml(o)`, `deviceSilhouette(dev)`, `deviceDisplayName(dev)`, `out.fit.{verdict,measured,hardItems,softItems}`, `cap.areaMeasured` — names consistent across all tasks and the dispatcher in T5.
- **Known coupling:** T5 changes markup, so the old `occupancy-slots` S7 assertion is updated in T5 Step 5; T10 sweeps any other old-markup assertions. Flagged, not silent.
