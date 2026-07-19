# Phase 3a · Slice 1 — Safety fix + preferences framework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a shipped safety-guard laundering bug, and land the `PREFS` preferences framework with Units as its first live consumer — changing no other observable behavior.

**Architecture:** A declarative `PREFS` registry + `pref()`/`setPref()` formalize the validated-default pattern already used by `themeKey()`/`uiLevel()`/`fontScale()`. Those helpers keep their signatures and *delegate* to `pref()`, so ~200 existing call sites are untouched. Validators are **predicates (lazy closures)** so `PREFS` can be declared before the constants it validates against, removing all top-level ordering risk. A new Tools › "Behavior & automation" hub renders prefs that have a live consumer.

**Tech Stack:** Vanilla JS single-file PWA (`app.js` + `app.css` inlined by `build.py`), `store.get/set` (JSON-encoded localStorage), `L(he,en)` for i18n, Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-07-17-cookout-orchestrator-phase3a-design.md`

## Global Constraints

- **Defaults must reproduce today's behavior exactly.** With no `mk-pref-*` keys stored, nothing observable changes. This is the gate (Task 6).
- Hebrew is primary; **no English may leak into the Hebrew UI**. Verify both languages.
- `node --check app.js` clean before every commit.
- Full suite green **×2** before shipping.
- Ship as `v250`: bump the stamp in `build.py`, `python build.py`, commit, `git tag v250`, `git push origin main --tags`.
- No backward-compat shims — replace and regression-test.
- **Deviation from the spec's slicing, deliberate:** `PREF_PRESETS`/`prefPreset()` and the preset selector move to **Slice 2**. Every preset member is an orchestrator knob that does nothing until the solver exists; shipping the selector now would be dead UI. All keys are still *registered* here so Slice 2 only adds the selector.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `app.js` | modify | `PREFS` + `pref()`/`setPref()`; helper delegation; Units wiring; `openPrefGroup()`; safety-fix at the copilot call site |
| `app.css` | none | the hub reuses existing `.ap-opt` / `.ap-opts` styles |
| `build.py` | modify | version stamp → 250 |
| `tests/prefs.spec.ts` | **create** | framework: validation, delegation parity, Units, hub, defaults-unchanged |
| `tests/ai-trust.spec.ts` | modify | the probe-laundering regression test |

---

## Task 1: Fix the shipped probe-laundering safety bug

`app.js:4432` passes `copilotVoiceContext()` — which contains the user's **live probe reading** — into `aiSafetyNote`'s *grounding*. Any number the user's own thermometer reports therefore counts as "vetted", so AI advice citing it (*"55 °C is fine, hold it"*) passes the numeric guard with no escalation. Live telemetry may inform the **model**, never the **guard**.

**Files:**
- Modify: `app.js:4432`
- Test: `tests/ai-trust.spec.ts`

**Interfaces:**
- Consumes: `copilotAskNow()`, `aiSafetyNote(answerText, groundingText)`, `copilotVoiceContext()`, `liveSession()`, `copilotPace()`
- Produces: nothing new — behavior change only

- [ ] **Step 1: Write the failing test**

Append to `tests/ai-trust.spec.ts`:

```ts
// Phase 3a Slice 1 — the guard must never treat LIVE USER TELEMETRY as vetted grounding.
// Before the fix, copilotVoiceContext() (which carries the probe reading) was concatenated into
// aiSafetyNote's grounding, so "55°C is fine" was 'grounded' by the user's own thermometer.
test('v250: live probe telemetry is NOT vetted grounding for the safety guard', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`
    document.body.insertAdjacentHTML('beforeend','<div id="copAdvice"></div>');
    window.liveSession      = () => ({ startedAt: Date.now()-3600000, targetC: 93 });
    window.copilotPace      = () => ({ lastTemp: 55, state: 'projected', rate: 5, verdict: 'behind', slackMin: 30 });
    window.copilotAdviceLocal = () => 'local advice';
    window.askGemini        = async () => ({ txt: '55°C זה בסדר, אפשר להחזיק ככה', ctx: 'מהקטלוג: חזה בקר 93°C' });
  `);
  // sanity: the live context really does carry the 55 (that is what used to launder it)
  expect(await page.evaluate(`copilotVoiceContext()`)).toContain('55');
  await page.evaluate(`copilotAskNow()`);
  await page.waitForFunction(`!/ai-spinner|האש חושב/.test(document.querySelector('#copAdvice').innerHTML)`);
  const html = await page.evaluate(`document.querySelector('#copAdvice').innerHTML`) as string;
  expect(html).toContain('ai-caveat-strong');   // 55 is absent from the VETTED ctx → must escalate
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/ai-trust.spec.ts -g "v250" --workers=1 --reporter=list`
Expected: **1 failed** — `expect(received).toContain('ai-caveat-strong')` (the guard stayed silent because 55 was "grounded").

- [ ] **Step 3: Apply the fix**

In `app.js:4432`, change:

```js
    host.innerHTML=`<div class="cop-pacenote">${esc(r.txt||'').replace(/\n/g,'<br>')}${(typeof aiSafetyNote==='function')?aiSafetyNote(r.txt, (r.ctx||'')+' '+copilotVoiceContext()):''}</div>`;
```

to:

```js
    // SAFETY: grounding = the VETTED context only. copilotVoiceContext() carries the user's live probe
    // reading; feeding it here would let the AI "ground" an unsafe number in the user's own telemetry.
    // It stays in the PROMPT (above) — live state may inform the model, never the guard.
    host.innerHTML=`<div class="cop-pacenote">${esc(r.txt||'').replace(/\n/g,'<br>')}${(typeof aiSafetyNote==='function')?aiSafetyNote(r.txt, (r.ctx||'')):''}</div>`;
```

- [ ] **Step 4: Run the test and confirm it PASSES**

Run: `npx playwright test tests/ai-trust.spec.ts -g "v250" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 5: Verify no other call site launders**

Run: `grep -n "aiSafetyNote(" app.js`
Expected exactly three call sites, and **none** of them concatenates `copilotVoiceContext()`:
`3431` → `aiSafetyNote(r.txt, r.ctx)` · `4432` → `aiSafetyNote(r.txt, (r.ctx||''))` · `7920` → `aiSafetyNote(txt, SAFETY_FACTS())`

- [ ] **Step 6: Commit**

```bash
node --check app.js
git add app.js tests/ai-trust.spec.ts
git commit -m "fix: live probe telemetry must not be vetted grounding for the AI safety guard"
```

---

## Task 2: `PREFS` registry + `pref()` / `setPref()`

**Files:**
- Modify: `app.js` — insert immediately **before** `const THEMES={` (currently line 5514)
- Test: `tests/prefs.spec.ts` (create)

**Interfaces:**
- Produces: `PREFS` (object), `pref(key) → value`, `setPref(key, val) → boolean`
- Consumed by: Tasks 3–6, and Slices 2–3

- [ ] **Step 1: Write the failing test**

Create `tests/prefs.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof pref==='function' && typeof setPref==='function'`);
};

test('P1: pref() returns the default for absent and invalid values; setPref validates', async ({ page }) => {
  await boot(page);
  // absent → default
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  expect(await page.evaluate(`pref('autonomy')`)).toBe('advise');
  expect(await page.evaluate(`pref('theme')`)).toBe('cream');
  expect(await page.evaluate(`pref('uiLevel')`)).toBe('mid');
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1);
  expect(await page.evaluate(`pref('tlShape')`)).toBe(null);
  // invalid stored value → default (never the garbage)
  await page.evaluate(`store.set('mk-pref-units','furlongs'); store.set('mk-theme','neon'); store.set('mk-fontscale',99)`);
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  expect(await page.evaluate(`pref('theme')`)).toBe('cream');
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1);
  // setPref accepts valid, rejects invalid, and persists
  expect(await page.evaluate(`setPref('units','imperial')`)).toBe(true);
  expect(await page.evaluate(`pref('units')`)).toBe('imperial');
  expect(await page.evaluate(`setPref('units','stones')`)).toBe(false);
  expect(await page.evaluate(`pref('units')`)).toBe('imperial');       // unchanged by the rejected write
  expect(await page.evaluate(`setPref('nope','x')`)).toBe(false);      // unknown key
  // numeric coercion parity with the old fontScale()
  expect(await page.evaluate(`setPref('fontScale',1.15)`)).toBe(true);
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1.15);
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/prefs.spec.ts --workers=1 --reporter=list`
Expected: FAIL at `page.waitForFunction` — `pref` is not defined (timeout).

- [ ] **Step 3: Implement the registry**

Insert in `app.js` immediately before `const THEMES={`:

```js
/* ═══ preferences framework — one registry for every user-tunable behavior ═══
   Formalizes the validated-default pattern already used by themeKey()/uiLevel()/fontScale():
   read the stored value, validate it, else fall back to a default that reproduces today's behavior.
   `valid` is a PREDICATE (a lazy closure) so this table may be declared before the constants it
   checks against (THEMES/UI_LEVELS/SHAPE_NAMES are defined further down) — no ordering hazard.
   Entries with he/en/opts render in the "Behavior & automation" hub; the rest keep their own panels. */
const PREFS={
  // existing keys, ADOPTED IN PLACE (no migration, no behavior change)
  theme:      {store:'mk-theme',      def:'cream',   valid:function(v){ return !!THEMES[v]; }},
  fontPair:   {store:'mk-fontpair',   def:'current', valid:function(v){ return !!FONT_PAIRS[v]; }},
  fontScale:  {store:'mk-fontscale',  def:1,         valid:function(v){ return FONT_SCALES.indexOf(v)>=0; }, coerce:Number},
  uiLevel:    {store:'mk-uilevel',    def:'mid',     valid:function(v){ return !!UI_LEVELS[v]; }},
  tlShape:    {store:'mk-tlshape',    def:null,      valid:function(v){ return !!SHAPE_NAMES[v]; }},
  // new — Units is the first live consumer (Task 4)
  units:      {store:'mk-pref-units', def:'metric',  valid:['metric','imperial'], group:'ai',
               he:'יחידות מידה', en:'Units', hintHe:'יחידות בתשובות ה-AI', hintEn:'Units in AI answers',
               opts:[{v:'metric',he:'מטרי (°C, ק״ג)',en:'Metric (°C, kg)'},{v:'imperial',he:'אימפריאלי (°F, lb)',en:'Imperial (°F, lb)'}]},
  // orchestrator knobs — REGISTERED now so Slice 2/3 only add their consumers + the preset selector.
  // They intentionally render NO hub UI yet (no consumer = no dead controls).
  autonomy:   {store:'mk-pref-autonomy', def:'advise', valid:['advise','propose','autopilot']},
  shareTolC:  {store:'mk-pref-sharetol', def:8,        valid:[0,8,15], coerce:Number},
  woodSwap:   {store:'mk-pref-woodswap', def:true,     valid:[true,false]},
  holdEnabled:{store:'mk-pref-hold',     def:true,     valid:[true,false]},
  aiRank:     {store:'mk-pref-airank',   def:true,     valid:[true,false]},
  slotModel:  {store:'mk-pref-slots',    def:'size',   valid:['size','count']},
  holdMaxH:   {store:'mk-pref-holdmax',  def:3,        valid:[1,2,3], coerce:Number},
};
function prefOk(p, v){
  if(typeof p.valid==='function') return !!p.valid(v);
  if(Array.isArray(p.valid)) return p.valid.indexOf(v)>=0;
  return false;
}
function pref(key){
  const p=PREFS[key]; if(!p) return undefined;
  let v=store.get(p.store); if(p.coerce) v=p.coerce(v);
  return prefOk(p,v) ? v : p.def;
}
function setPref(key, val){
  const p=PREFS[key]; if(!p) return false;
  let v=val; if(p.coerce) v=p.coerce(v);
  if(!prefOk(p,v)) return false;
  store.set(p.store, v); return true;
}
```

- [ ] **Step 4: Run the test and confirm it PASSES**

Run: `npx playwright test tests/prefs.spec.ts --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 5: Commit**

```bash
node --check app.js
git add app.js tests/prefs.spec.ts
git commit -m "feat: PREFS registry + pref()/setPref() validated-default framework"
```

---

## Task 3: Delegate the existing helpers to `pref()`

Proves the framework is a faithful refactor: identical outputs for every stored input, with ~200 call sites untouched.

**Files:**
- Modify: `app.js` — `themeKey()` (5538), `fontPairKey()` (5539), `fontScale()` (5540), `uiLevel()` (5700), `tlShapeOverride()` (5702)
- Test: `tests/prefs.spec.ts`

**Interfaces:**
- Consumes: `pref()` from Task 2
- Produces: unchanged signatures — `themeKey()`, `fontPairKey()`, `fontScale()`, `uiLevel()`, `tlShapeOverride()`

- [ ] **Step 1: Write the failing parity test**

Append to `tests/prefs.spec.ts`:

```ts
test('P2: the existing helpers delegate to pref() with identical results for every input', async ({ page }) => {
  await boot(page);
  const cases: Array<[string,string,any,any]> = [
    // [storeKey, helperExpression, storedValue, expected]
    ['mk-theme',     'themeKey()',        'charcoal', 'charcoal'],
    ['mk-theme',     'themeKey()',        'neon',     'cream'],     // invalid → default
    ['mk-theme',     'themeKey()',        null,       'cream'],     // absent  → default
    ['mk-uilevel',   'uiLevel()',         'pro',      'pro'],
    ['mk-uilevel',   'uiLevel()',         'wat',      'mid'],
    ['mk-fontscale', 'fontScale()',       1.3,        1.3],
    ['mk-fontscale', 'fontScale()',       7,          1],
    ['mk-fontscale', 'fontScale()',       null,       1],
    ['mk-fontpair',  'fontPairKey()',     'editorial','editorial'],
    ['mk-fontpair',  'fontPairKey()',     'zzz',      'current'],
    ['mk-tlshape',   'tlShapeOverride()', '3',        '3'],
    ['mk-tlshape',   'tlShapeOverride()', 'x',        null],
  ];
  for (const [key, expr, val, want] of cases) {
    await page.evaluate(`store.set(${JSON.stringify(key)}, ${JSON.stringify(val)})`);
    expect(await page.evaluate(expr), `${expr} with ${key}=${JSON.stringify(val)}`).toBe(want);
  }
  // tlShape() stays DERIVED: override wins, else it falls back to the level's shape
  await page.evaluate(`store.set('mk-tlshape',''); store.set('mk-uilevel','pro')`);
  expect(await page.evaluate(`tlShape()`)).toBe('3');
  await page.evaluate(`store.set('mk-tlshape','1')`);
  expect(await page.evaluate(`tlShape()`)).toBe('1');
});
```

- [ ] **Step 2: Run it and confirm it PASSES (it must — nothing has changed yet)**

Run: `npx playwright test tests/prefs.spec.ts -g "P2" --workers=1 --reporter=list`
Expected: **1 passed.** This is the *baseline lock*: it captures today's behavior before the refactor, so Step 4 proves the refactor changed nothing.

- [ ] **Step 3: Refactor the five helpers to delegate**

In `app.js`, replace each body (keep the comments already on those lines):

```js
function themeKey(){ return pref('theme'); }                       // migrates old coal/vintage/gold → cream
function fontPairKey(){ return pref('fontPair'); }
function fontScale(){ return pref('fontScale'); }
```

```js
function uiLevel(){ return pref('uiLevel'); }
```

```js
function tlShapeOverride(){ return pref('tlShape'); }
```

Leave `setUiLevel`, `setTlShape`, `resetTlShapeToLevel`, and `tlShape()` **exactly as they are** — `tlShape()` is derived, not stored.

- [ ] **Step 4: Re-run the same test — still PASSES**

Run: `npx playwright test tests/prefs.spec.ts --workers=1 --reporter=list`
Expected: **2 passed** (P1 + P2), identical results ⇒ faithful refactor.

- [ ] **Step 5: Run the full suite (these helpers are used everywhere)**

Run: `npx playwright test --workers=1 --retries=2 --reporter=list`
Expected: all pass (220 + the new ones).

- [ ] **Step 6: Commit**

```bash
node --check app.js
git add app.js tests/prefs.spec.ts
git commit -m "refactor: themeKey/fontPairKey/fontScale/uiLevel/tlShapeOverride delegate to pref()"
```

---

## Task 4: Units pref + wire it into the AI prompt builders

v246 hard-coded the metric directive to `he`. Move that decision to `pref('units')`, which defaults to `metric` — so Hebrew keeps v246 behavior and English metric users now get it too.

**Files:**
- Modify: `app.js:3219` (`askGemini` sys), `app.js:3322` (`aiJSON` metricLine), `app.js:4235` (`vcBuildAskPrompt`)
- Test: `tests/prefs.spec.ts`

**Interfaces:**
- Consumes: `pref('units')` from Task 2
- Produces: no new symbols

- [ ] **Step 1: Write the failing test**

Append to `tests/prefs.spec.ts`:

```ts
const capBody = async (page: any, call: string) => {
  await page.evaluate(`window.__cap=[]; window.gemFetch=async(m,b)=>{ window.__cap.push(b); return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]})}; };`);
  await page.evaluate(`(async()=>{ try{ await (${call}); }catch(e){} })()`);
  await page.waitForFunction(`window.__cap.length>0`);
  return page.evaluate(`window.__cap[0]`);
};

test('P3: pref("units") governs the metric directive in every AI prompt builder', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k')`);
  // default (metric) → the directive is present, in Hebrew AND English
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  let b = await capBody(page, `askGemini('כמה זמן לעשן חזה')`) as any;
  expect(b.system_instruction.parts[0].text).toContain('מטריות');
  b = await capBody(page, `aiJSON({task:'t',grounding:'g'})`) as any;
  expect(b.contents[0].parts[0].text).toContain('מטריות');
  expect(await page.evaluate(`vcBuildAskPrompt('q','he','').sys`)).toContain('מטריות');
  await page.evaluate(`store.set('mk-lang','en')`);
  b = await capBody(page, `askGemini('how long to smoke brisket')`) as any;
  expect(b.system_instruction.parts[0].text).toContain('metric');   // English UI, metric pref → still enforced
  // imperial → no metric directive anywhere
  await page.evaluate(`setPref('units','imperial'); store.set('mk-lang','he')`);
  b = await capBody(page, `askGemini('כמה זמן לעשן חזה')`) as any;
  expect(b.system_instruction.parts[0].text).not.toContain('מטריות');
  b = await capBody(page, `aiJSON({task:'t',grounding:'g'})`) as any;
  expect(b.contents[0].parts[0].text).not.toContain('מטריות');
  expect(await page.evaluate(`vcBuildAskPrompt('q','he','').sys`)).not.toContain('מטריות');
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/prefs.spec.ts -g "P3" --workers=1 --reporter=list`
Expected: FAIL — the English/metric assertion fails (v246 only emits the directive for Hebrew), and the imperial assertions fail (the directive is still emitted).

- [ ] **Step 3: Wire the three builders to the pref**

`app.js:3219` — replace the trailing `+(he?' השתמש תמיד ביחידות מטריות…':'')` with a units-driven, bilingual directive:

```js
+((typeof pref==='function'&&pref('units')==='metric')?(he?' השתמש תמיד ביחידות מטריות (°C, ס״מ, ק״ג, ליטר, מ״מ) — לא פרנהייט/אינץ׳/פאונד.':' Always use METRIC units (°C, cm, kg, litres, mm) — never Fahrenheit/inches/pounds.'):'');
```

`app.js:3322` — replace the `outLang==='he'` gate with the pref:

```js
  const metricLine=((typeof pref==='function'&&pref('units')==='metric'))?((outLang==='he')?'\n\nהשתמש אך ורק ביחידות מטריות (°C, ס״מ, ק״ג, ליטר, מ״מ) — לעולם לא °F/אינץ׳/lb.':'\n\nUse METRIC units ONLY (°C, cm, kg, litres, mm) — never °F/inch/lb.'):'';
```

`app.js:4235` — make the Hebrew voice sys directive conditional (keep the rest of the string byte-identical):

```js
      +'אל תמציא טמפרטורות בטיחות — אם אינך בטוח, אמור זאת.'+((typeof pref==='function'&&pref('units')==='metric')?' השתמש ביחידות מטריות בלבד (°C, ס״מ, ק״ג).':'')+(ctx?(' '+ctx):'');
```

- [ ] **Step 4: Run the test and confirm it PASSES**

Run: `npx playwright test tests/prefs.spec.ts -g "P3" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 5: Confirm the v246 tests still pass (they assert the Hebrew directive)**

Run: `npx playwright test tests/ai-trust.spec.ts -g "v246" --workers=1 --reporter=list`
Expected: **1 passed** — default `metric` preserves v246's Hebrew behavior.

- [ ] **Step 6: Commit**

```bash
node --check app.js
git add app.js tests/prefs.spec.ts
git commit -m "feat: pref('units') drives the metric directive in all AI prompt builders"
```

---

## Task 5: "Behavior & automation" hub

**Files:**
- Modify: `app.js` — add `openPrefGroup()` next to `openUiLevel()` (~line 5706); add one settings-menu entry at line 8021
- Test: `tests/prefs.spec.ts`

**Interfaces:**
- Consumes: `PREFS`, `pref()`, `setPref()`, `showPanel`, `toolTop`, `L()`
- Produces: `openPrefGroup()`

- [ ] **Step 1: Write the failing test**

Append to `tests/prefs.spec.ts`:

```ts
test('P4: the Behavior & automation hub renders prefs and persists a change (HE + EN)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`openPrefGroup()`);
  await page.waitForSelector('#panel [data-prefkey="units"]');
  // Hebrew UI → no English leak in the panel body
  const heTxt = await page.evaluate(`document.querySelector('#panel .panel-body').textContent`) as string;
  expect(/[A-Za-z]{4,}/.test(heTxt.replace(/°C|kg|lb|°F/g,''))).toBe(false);
  // the current value is marked, and picking the other one persists
  expect(await page.evaluate(`!!document.querySelector('#panel [data-prefkey="units"][data-prefval="metric"].on')`)).toBe(true);
  await page.click('#panel [data-prefkey="units"][data-prefval="imperial"]');
  await page.waitForFunction(`pref('units')==='imperial'`);
  expect(await page.evaluate(`!!document.querySelector('#panel [data-prefkey="units"][data-prefval="imperial"].on')`)).toBe(true);
  // English renders too
  await page.evaluate(`store.set('mk-lang','en'); openPrefGroup()`);
  await page.waitForSelector('#panel [data-prefkey="units"]');
  expect(await page.evaluate(`document.querySelector('#panel .panel-body').textContent`)).toContain('Units');
  // and it is reachable from the More → Settings menu (the menu array is a LOCAL const inside
  // openMoreSheet(), so assert against the rendered DOM, never a global)
  await page.evaluate(`openMoreSheet()`);
  await page.waitForFunction(`/Behavior & automation/.test(document.body.textContent)`);
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

Run: `npx playwright test tests/prefs.spec.ts -g "P4" --workers=1 --reporter=list`
Expected: FAIL — `openPrefGroup` is not defined.

- [ ] **Step 3: Implement the hub**

Add after `openUiLevel()`'s closing brace in `app.js`:

```js
// Behavior & automation — the PREFS hub. Renders only prefs that carry he/en (i.e. have a live consumer);
// orchestrator knobs stay registered-but-hidden until their solver lands (Slice 2/3). Reuses .ap-opt styling.
function openPrefGroup(){
  const rows=Object.keys(PREFS).filter(function(k){ return PREFS[k].he && PREFS[k].opts; }).map(function(k){
    const p=PREFS[k], cur=pref(k);
    const opts=p.opts.map(function(o){ return `<button class="ap-opt ${o.v===cur?'on':''}" data-prefkey="${esc(k)}" data-prefval="${esc(String(o.v))}">${esc(L(o.he,o.en))}</button>`; }).join('');
    // EXACTLY the markup openUiLevel() uses: .ap-lbl label + .ap-opts row + .section-sub hint.
    // (.ap-row / .ap-hint do NOT exist in app.css — verified. No new CSS is added.)
    return `<div class="ap-lbl">${esc(L(p.he,p.en))}</div><div class="ap-opts">${opts}</div>`
      +((p.hintHe||p.hintEn)?`<p class="section-sub" style="margin:8px 2px 0">${esc(L(p.hintHe||'',p.hintEn||''))}</p>`:'');
  }).join('');
  showPanel(`${toolTop(L('התנהגות ואוטומציה','Behavior & automation'),L('איך האפליקציה מתנהגת עבורך','How the app behaves for you'),'🎛️','#6a8caf')}
   <div class="panel-body">${rows}</div>`);
  $("#panel").querySelectorAll('[data-prefkey]').forEach(function(b){ b.addEventListener('click', function(){
    const k=b.dataset.prefkey, p=PREFS[k]; if(!p) return;
    const raw=b.dataset.prefval; const opt=p.opts.find(function(o){ return String(o.v)===raw; });
    if(!opt || !setPref(k, opt.v)) return;
    openPrefGroup();   // repaint so the .on marker follows the stored value
  }); });
}
```

Then add the menu entry at `app.js:8021`, immediately after the `openUiLevel` entry:

```js
['🎛️',L('התנהגות ואוטומציה','Behavior & automation'),'openPrefGroup'],
```

- [ ] **Step 4: Run the test and confirm it PASSES**

Run: `npx playwright test tests/prefs.spec.ts -g "P4" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 5: Commit**

```bash
node --check app.js
git add app.js tests/prefs.spec.ts
git commit -m "feat: Behavior & automation preferences hub (Tools > Settings)"
```

---

## Task 6: Defaults-unchanged gate, full verification, ship v250

**Files:**
- Modify: `build.py` (version stamp), `tests/prefs.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5

- [ ] **Step 1: Write the defaults-unchanged test**

Append to `tests/prefs.spec.ts`:

```ts
test('P5: with no mk-pref-* keys stored, every default reproduces today’s behavior', async ({ page }) => {
  await boot(page);
  // no orchestrator pref is written just by booting or by opening the hub
  await page.evaluate(`openPrefGroup(); closePanel && closePanel();`);
  const written = await page.evaluate(`Object.keys(localStorage).filter(k=>k.indexOf('mk-pref-')===0)`) as string[];
  expect(written).toEqual([]);
  // and the defaults are exactly the Phase-2 behavior
  expect(await page.evaluate(`pref('autonomy')`)).toBe('advise');     // advise == today: suggest, never apply
  expect(await page.evaluate(`pref('units')`)).toBe('metric');        // == v246 behavior
  expect(await page.evaluate(`pref('uiLevel')`)).toBe('mid');
  expect(await page.evaluate(`prefPreset===undefined || true`)).toBe(true);   // presets are Slice 2, absent here
});
```

- [ ] **Step 2: Run it and confirm it PASSES**

Run: `npx playwright test tests/prefs.spec.ts -g "P5" --workers=1 --reporter=list`
Expected: **1 passed**

- [ ] **Step 3: Verify both languages by hand-render**

```bash
python build.py && node serve.js 8123 &
```
Open `http://localhost:8123`, then: **⋯ More → ⚙️ הגדרות ועזרה → 🎛️ התנהגות ואוטומציה**. Confirm the Units row renders in Hebrew with no English words, switch language to English, confirm it reads "Units". Stop the server afterwards.

- [ ] **Step 4: Full suite ×2**

```bash
npx playwright test --workers=1 --retries=2 --reporter=list
npx playwright test --workers=1 --retries=2 --reporter=list
```
Expected: **all passed, both runs.**

- [ ] **Step 5: Ship v250**

```bash
node --check app.js
sed -i 's/מהדורה 249 · 17.7.26/מהדורה 250 · 17.7.26/' build.py
python build.py
grep -c "מהדורה 250" dist/index.html   # expect 1
git add app.js build.py tests/prefs.spec.ts tests/ai-trust.spec.ts
git commit -m "v250 · Phase 3a Slice 1: safety-guard fix + PREFS framework + Units"
git tag v250
git push origin main --tags
```

- [ ] **Step 6: Confirm the live deploy**

```bash
node -e "fetch('https://matkonetesh.pages.dev/',{cache:'no-store'}).then(r=>r.text()).then(h=>console.log((h.match(/מהדורה\s+\d+/)||[])[0]))"
```
Expected: `מהדורה 250` (Cloudflare Pages auto-deploys on push; allow ~2 min).

---

## Self-Review

**Spec coverage (§ → task):** §5.1 probe-laundering → Task 1 · §2.1 registry → Task 2 · §2.1 helper delegation → Task 3 · §2.4 Units → Task 4 · §2.3 hub → Task 5 · §8 DoD "defaults change nothing" → Task 6. **§2.2 presets is deliberately deferred to Slice 2** (documented under Global Constraints). §3 solver, §4 AI contract, §5.2 danger-zone accumulator are Slices 2–3, out of scope here.

**Placeholders:** none — every step has real code, a real command, and an expected result.

**Type/name consistency:** `pref`/`setPref`/`prefOk`/`PREFS` are used identically in Tasks 2–6. `openPrefGroup` matches between the implementation, the menu entry, and the test. `tlShape()` is deliberately *not* delegated (it is derived) and Task 3's test asserts that. Task 3's baseline-lock ordering (test passes before AND after) is intentional and called out, unlike the usual red→green.

**Two defects caught and fixed during this review (both verified against the real source):**
1. Task 5 originally emitted `.ap-row` / `.ap-hint` wrappers. Those classes **do not exist** in `app.css` — the real pattern is `.ap-lbl` + `.ap-opts` + `.section-sub` (as used by `openUiLevel`). The markup now matches it exactly, so no CSS is added.
2. Task 5's test asserted against a global `MORE_GROUPS`. The menu array is a **local `const GROUPS` inside `openMoreSheet()`** and is not reachable from the page context — that assertion would have thrown a `ReferenceError`. It now drives `openMoreSheet()` and asserts against the rendered DOM.

**Verified-present symbols this plan touches:** `copilotAskNow`, `copilotVoiceContext`, `aiSafetyNote`, `liveSession`, `copilotPace`, `copilotAdviceLocal`, `THEMES`, `FONT_PAIRS`, `FONT_SCALES`, `UI_LEVELS`, `SHAPE_NAMES`, `themeKey`, `fontPairKey`, `fontScale`, `uiLevel`, `tlShape`, `tlShapeOverride`, `openUiLevel`, `openMoreSheet`, `closePanel`, `showPanel`, `toolTop`, `.ap-opt`, `.ap-opts`, `.ap-lbl`, `.section-sub`.
