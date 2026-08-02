# Data-Model Refactor (R-75) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 193-row shape with a core + 0..n mechanism blocks + a triggered route, so that no consumer ever has to re-derive what a field means.

**Architecture:** `data.py` stays the **authored** source (the owner edits it; it is the human artefact). A new build-time module `model.py` is the **single place that interprets the legacy encoding** and emits a structured `items` array into the payload, beside the existing keys. Consumers migrate to `items`; the legacy keys stay until every consumer has moved, then a gate forbids reading them. This is the spec's §9 order — converter, non-conversion report, adapter, consumer migration, gates on.

**Tech Stack:** Python 3.10 (`build.py`, `data.py`, `sources.py`), vanilla JS (`app.js`), Playwright + TypeScript (`tests/`). No new dependencies.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-03-data-model-design.md`. §4 Waiver Gate applies: a plan may not waive, defer, or reinterpret any spec line. Raise it with the owner instead.
- **DoD-10 · safety invariance:** No `safe` value, `bcheck` stage, `temp`, or cook duration may be **changed**. This refactor **moves** values; it never edits them. Every task asserts this.
- **94°C stays** (R-79): `texture.target_c` keeps its value; a missing source becomes `provenance:'craft'`, never a substituted number.
- **`safe=0` and absent `safe` are DIFFERENT** and must stay distinguishable through the converter: `0` → "mechanism not applicable" → `safety: []`; absent → "we hold no figure" → also no thermal block, but recorded in the non-conversion report under a different reason.
- **Tests:** `tests/TEST-AUTHORING-CONTRACT.md` is binding — `test`/`seedApp` from `./_fixtures`, never Playwright's `test`; no `waitForTimeout`; assert on rendered DOM or a real consumer's value. **A test that passes on its first run is void.**
- **Regex inside a `page.evaluate` template literal:** build it with `new RegExp(${JSON.stringify('…')})`. A bare `\s` in a TS template literal collapses to `s` (L47).
- **Suite:** `npx playwright test`, plain. Capture exit codes directly (`cmd; ec=$?`), never through a pipe. Nothing on port 8123 first. Machine idle.
- **Hebrew:** any new user-facing string updates **all six** language dictionaries in `lang/*.json` in the same change (§10.20).
- **Commit per task.** Never `--no-verify`.

---

## File Structure

| File | Responsibility |
|---|---|
| `model.py` **(new)** | The whole converter: legacy row → structured item. The ONLY place that knows what `safe=0`, `somid`, `wrap` meant. Exports `build_items()` and `SCHEMA_VERSION`. |
| `model_triggers.py` **(new)** | Parsing `mid`/`somid`/`wrap`/`rest` prose into route steps + triggers, and deciding what is a note instead. Kept separate because it is pattern-matching over Hebrew prose and will churn independently of the schema. |
| `model_guards.py` **(new)** | The four gates of spec §7, run at build time. Separate from the converter so a gate can never be "helpfully" relaxed by the code it audits. |
| `build.py` **(modify)** | Call `model.build_items(...)` after the sources merge; add `items` to `payload`; run `model_guards`; write the non-conversion report. |
| `app.js` **(modify)** | `MODEL` accessor block near `citedSafeC`; migrate `.safe` consumers to it. |
| `tests/model-*.spec.ts` **(new)** | Behavioural assertions over the shipped model, through real render paths. |

---

## Task 1: `model.py` — the core + safety blocks, and the sentinel dies here

**Files:**
- Create: `model.py`
- Modify: `build.py` (after the `equipment_map` block, before `payload = {`)
- Test: `tests/model-safety.spec.ts`

**Interfaces:**
- Produces: `model.build_items(cuts, specials, makes) -> (items:list, unconverted:list)`
  - `items[i]` = `{id, name:{he,en}, category, cut_form, weight_kg, safety:[…], texture:{…}, route:[…], notes:[…], legacy_ref}`
  - `unconverted[i]` = `{id, name, field, value, reason}`
- Produces: `model.SCHEMA_VERSION = 1`

- [ ] **Step 1: Write the failing test**

`tests/model-safety.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items && DATA.items.length)`);
};

test('M1 · every produce row carries an EMPTY safety list, not a zero', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var byName = {};
    DATA.items.forEach(function(it){ byName[it.name.he] = it; });
    var corn = byName['תירס'];
    return { hasCorn: !!corn,
             safety: corn ? corn.safety : null,
             anyZeroAnywhere: DATA.items.some(function(it){
               return (it.safety||[]).some(function(b){ return b.kind==='thermal' && Number(b.instant_c)===0; });
             }) };
  })()`) as any;
  expect(r.hasCorn).toBe(true);
  expect(r.safety).toEqual([]);          // the empty list IS the answer
  expect(r.anyZeroAnywhere).toBe(false); // no sentinel survived anywhere
});

test('M2 · brisket keeps its cited 63°C, unchanged, with a source', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var th = (b.safety||[]).filter(function(x){ return x.kind==='thermal'; })[0];
    return { instant: th && th.instant_c, src: th && th.source_id, target: b.texture && b.texture.target_c };
  })()`) as any;
  expect(r.instant).toBe(63);      // DoD-10: MOVED, never changed
  expect(r.target).toBe(95);       // R-79: 94/95°C stays exactly as authored
  expect(r.src).not.toBeNull();
});

test('M3 · a tgt with no source is flagged craft, never silently promoted', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    return DATA.items.filter(function(it){
      return it.texture && it.texture.target_c != null
          && it.texture.source_id == null
          && it.texture.provenance !== 'craft';
    }).map(function(it){ return it.name.he; });
  })()`) as string[];
  expect(bad).toEqual([]);
});

// NEGATIVE (DoD-6): a row whose `safe` is ABSENT is not the same as one whose `safe` is 0.
test('M4 · an absent safe and a zero safe are distinguishable in the report', async ({ page }) => {
  await boot(page);
  const kinds = await page.evaluate(`(function(){
    var m = {};
    (DATA.unconvertedReasons||[]).forEach(function(r){ m[r] = (m[r]||0)+1; });
    return m;
  })()`) as Record<string, number>;
  expect(Object.keys(kinds)).toContain('safe-not-applicable');
  expect(Object.keys(kinds)).toContain('safe-absent');
});
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

```
npx playwright test tests/model-safety.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: FAIL at `waitForFunction` — `DATA.items` does not exist yet. **If it fails for any other reason, stop and read the error; a red phase that is red for the wrong reason is the same defect arriving early (L45).**

- [ ] **Step 3: Write `model.py`**

```python
# -*- coding: utf-8 -*-
"""The one place that knows what the legacy flat row meant.

Every other consumer reads the structured item. `safe` encodes three states —
a cited floor, 0 meaning "not applicable" (every ירקות/פירות row), and absence
meaning "we hold no figure" — and R-82 is what happens when each consumer
decides for itself. That decision now happens exactly here, once.
"""
SCHEMA_VERSION = 1

# Corpus source ids — docs/sources/corpus/NN-*/
SRC_FOOD_CODE, SRC_FSIS_APPENDIX_A, SRC_BALDWIN = 1, 2, 15


def _thermal_block(row, unconverted):
    raw = row.get("safe")
    if raw is None or raw == "":
        unconverted.append({"id": row.get("n"), "name": row.get("heb"),
                            "field": "safe", "value": None, "reason": "safe-absent"})
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError):
        unconverted.append({"id": row.get("n"), "name": row.get("heb"),
                            "field": "safe", "value": raw, "reason": "safe-unparsable"})
        return None
    if v == 0:
        # NOT a temperature. The data layer's encoding of "core temperature does
        # not govern this item" — every produce row carries it.
        unconverted.append({"id": row.get("n"), "name": row.get("heb"),
                            "field": "safe", "value": 0, "reason": "safe-not-applicable"})
        return None
    src = (row.get("src") or {}).get("safe") or {}
    return {"kind": "thermal", "instant_c": int(round(v)), "curve": None,
            "basis": None, "basis_ref": None,
            "source_id": src.get("corpus_id", SRC_FOOD_CODE)}


def _texture(row):
    tgt = row.get("tgt")
    if tgt is None:
        return None
    src = (row.get("src") or {}).get("tgt") or {}
    sid = src.get("corpus_id")
    return {"target_c": tgt,
            "doneness": row.get("doneness"),
            "source_id": sid,
            # R-79: a target with no primary source is craft, and says so. It is
            # never replaced and never allowed to read as verified.
            "provenance": "cited" if sid is not None else "craft"}


def build_items(cuts, specials, makes):
    items, unconverted = [], []
    for row in list(cuts) + list(specials):
        safety = []
        th = _thermal_block(row, unconverted)
        if th:
            safety.append(th)
        items.append({
            "id": row.get("n"),
            "name": {"he": row.get("heb"), "en": row.get("eng")},
            "category": row.get("cat"),
            "cut_form": row.get("cut_form"),
            "weight_kg": row.get("kg"),
            "safety": safety,
            "texture": _texture(row),
            "route": [],
            "notes": [],
            "legacy_ref": row.get("n"),
        })
    return items, unconverted
```

- [ ] **Step 4: Wire it into `build.py`**

Insert immediately before `payload = {`:

```python
import model as _model
_items, _unconverted = _model.build_items(CUTS, SPECIALS, MAKES)
print("[model] items:", len(_items), "· unconverted entries:", len(_unconverted))
```

and inside `payload`, add:

```python
    "items": _items,
    "schemaVersion": _model.SCHEMA_VERSION,
    "unconvertedReasons": sorted({u["reason"] for u in _unconverted}),
```

- [ ] **Step 5: Build and run the test**

```
python build.py 2>&1 | tail -3
npx playwright test tests/model-safety.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: PASS, 4/4.

- [ ] **Step 6: Prove DoD-10 — no safety value moved**

```
python -c "
import data, model
items,_ = model.build_items(data.CUTS, data.SPECIALS, data.MAKES)
by = {i['id']: i for i in items}
bad = []
for r in list(data.CUTS)+list(data.SPECIALS):
    th = [b for b in by[r['n']]['safety'] if b['kind']=='thermal']
    old = r.get('safe')
    if old not in (None,'',0) and (not th or th[0]['instant_c'] != int(round(float(old)))):
        bad.append((r['heb'], old, th))
print('safety values altered:', len(bad), bad[:5])
"
```

Expected: `safety values altered: 0`.

- [ ] **Step 7: Commit**

```bash
git add model.py build.py tests/model-safety.spec.ts
git commit -m "feat(model): core + thermal blocks, and the sentinel dies in one place"
```

---

## Task 2: the non-conversion report — the list that must not be silent

**Files:**
- Modify: `build.py`
- Create: `scripts/model-report.mjs` (renders the report to markdown)
- Test: `tests/model-report.spec.ts`

**Interfaces:**
- Consumes: `model.build_items()` → `unconverted`
- Produces: `docs/analysis/2026-08-03-model-conversion-report.md`, regenerated by every build

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect, seedApp } from './_fixtures';

test('R1 · every item is either fully converted or named in the report', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const r = await page.evaluate(`(function(){
    var total = DATA.items.length;
    var named = (DATA.unconvertedIds||[]).length;
    var silent = DATA.items.filter(function(it){
      // an item with no safety block AND no entry in the report is a silent drop
      return (it.safety||[]).length===0 && (DATA.unconvertedIds||[]).indexOf(it.id)===-1;
    }).map(function(it){ return it.name.he; });
    return { total: total, named: named, silent: silent };
  })()`) as any;
  expect(r.silent).toEqual([]);   // silence about a cut reads as coverage
});
```

- [ ] **Step 2: Run it, watch it fail**

```
npx playwright test tests/model-report.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: FAIL — `DATA.unconvertedIds` is undefined, so every produce row reads as silently dropped.

- [ ] **Step 3: Emit the ids and write the report**

In `build.py`, add to `payload`: `"unconvertedIds": sorted({u["id"] for u in _unconverted if u["id"] is not None}),`

and after the payload is built:

```python
import io as _io, collections as _coll
_by_reason = _coll.defaultdict(list)
for u in _unconverted:
    _by_reason[u["reason"]].append(u)
with _io.open("docs/analysis/2026-08-03-model-conversion-report.md", "w", encoding="utf-8") as _f:
    _f.write("# דוח אי-המרה — מודל הנתונים (R-75)\n\n")
    _f.write("**נוצר אוטומטית בכל בנייה. אם משהו לא הומר — הוא נקוב כאן בשם.**\n\n")
    _f.write("| פריטים | %d |\n|---|---|\n| רשומות אי-המרה | %d |\n\n" % (len(_items), len(_unconverted)))
    for _reason in sorted(_by_reason):
        _rows = _by_reason[_reason]
        _f.write("\n## `%s` — %d\n\n| # | פריט | שדה | ערך |\n|---|---|---|---|\n" % (_reason, len(_rows)))
        for _u in _rows:
            _f.write("| %s | %s | `%s` | `%s` |\n" % (_u["id"], _u["name"], _u["field"], _u["value"]))
print("[model] conversion report written:", len(_unconverted), "entries")
```

- [ ] **Step 4: Build, read the report with your own eyes, run the test**

```
python build.py 2>&1 | tail -3
head -30 docs/analysis/2026-08-03-model-conversion-report.md
npx playwright test tests/model-report.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: PASS. The report names 27 `safe-not-applicable` and 47 `safe-absent` rows.

- [ ] **Step 5: Commit**

```bash
git add build.py docs/analysis/2026-08-03-model-conversion-report.md tests/model-report.spec.ts
git commit -m "feat(model): the non-conversion report — nothing is dropped in silence"
```

---

## Task 3: `model_triggers.py` — R-80, prose becomes steps with triggers

**Files:**
- Create: `model_triggers.py`
- Modify: `model.py` (fill `route` and `notes`)
- Test: `tests/model-route.spec.ts`

**Interfaces:**
- Produces: `model_triggers.parse(row) -> (route:list, notes:list, unparsed:list)`
- Trigger leaf shapes, closed set: `{"at_core_temp":{"c":int}}` · `{"after_elapsed":{"h":float}}` · `{"every":{"min":int}}` · `{"at_stage":{"at":"start"|"end"}}` · `{"when_safe_met":{}}`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect, seedApp } from './_fixtures';

test('T1 · "עטיפה ב-70°C" is a wrap step fired by core temperature, not a note', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var wrap = (b.route||[]).filter(function(s){ return s.action==='wrap'; })[0];
    return { has: !!wrap, trigger: wrap && wrap.trigger };
  })()`) as any;
  expect(r.has).toBe(true);
  expect(r.trigger).toEqual({ at_core_temp: { c: 70 } });
});

test('T2 · a tip is kept as a note and never becomes a step', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const r = await page.evaluate(`(function(){
    var withTips = DATA.items.filter(function(it){ return (it.notes||[]).length>0; });
    var leaked = DATA.items.filter(function(it){
      return (it.route||[]).some(function(s){ return !s.trigger || Object.keys(s.trigger).length===0; });
    }).map(function(it){ return it.name.he; });
    return { noteCount: withTips.length, leaked: leaked };
  })()`) as any;
  expect(r.noteCount).toBeGreaterThan(0);
  expect(r.leaked).toEqual([]);   // every step has a trigger; prose without one is a note
});
```

- [ ] **Step 2: Run it, watch it fail**

```
npx playwright test tests/model-route.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: FAIL — `route` is `[]` for every item.

- [ ] **Step 3: Write `model_triggers.py`**

```python
# -*- coding: utf-8 -*-
"""Legacy prose (`mid` / `somid` / `wrap` / `rest`) -> route steps with triggers.

The owner's requirement (2026-08-03): "עטיפה ב-70°C is an action fired by a
temperature, not a note." Anything that is genuinely advice ("30-60 שנ'/צד —
יותר=גומי") stays advice, in `notes`. Nothing is discarded either way.
"""
import re

_TEMP = re.compile(r'(\d{2,3})\s*°?\s*[CcצC]')
_EVERY = {'הפיכה': 'flip', 'הפיכת עור': 'flip', 'סיבוב שיפוד': 'rotate'}
_ACTION = [('עטיפה', 'wrap'), ('עטיפת', 'wrap'), ('גלייז', 'glaze'), ('מריחה', 'baste'),
           ('צינון', 'chill'), ('ייבוש', 'dry'), ('ניקוז', 'drain'), ('דקירת', 'prick'),
           ('חריטת', 'score'), ('קילוף', 'peel')]


def _action_of(text):
    for needle, act in _ACTION:
        if needle in text:
            return act
    return None


def parse(row):
    route, notes, unparsed = [], [], []
    for field in ('mid', 'somid'):
        raw = (row.get(field) or '').strip()
        if not raw or raw in ('אין', '-'):
            continue
        if raw in _EVERY:
            route.append({'action': _EVERY[raw], 'trigger': {'every': {'min': 45}},
                          'source': 'legacy:' + field})
            continue
        m = _TEMP.search(raw)
        act = _action_of(raw)
        if m and act:
            route.append({'action': act, 'trigger': {'at_core_temp': {'c': int(m.group(1))}},
                          'source': 'legacy:' + field})
            continue
        if 'בסיום' in raw and act:
            route.append({'action': act, 'trigger': {'at_stage': {'at': 'end'}},
                          'source': 'legacy:' + field})
            continue
        if 'עד סוף' in raw and 'בטיחות' in raw:
            route.append({'action': 'hold', 'trigger': {'when_safe_met': {}},
                          'source': 'legacy:' + field})
            continue
        if act and not m:
            # a real action with no stated trigger — NOT invented, reported
            unparsed.append({'id': row.get('n'), 'name': row.get('heb'), 'field': field,
                             'value': raw, 'reason': 'action-without-trigger'})
            notes.append({'text': raw, 'lang': 'he'})
            continue
        notes.append({'text': raw, 'lang': 'he'})       # advice, kept
    rest = row.get('rest')
    if isinstance(rest, (int, float)) and rest > 0:
        route.append({'action': 'rest', 'trigger': {'at_stage': {'at': 'end'}},
                      'params': {'min': int(rest)}, 'source': 'legacy:rest'})
    return route, notes, unparsed
```

- [ ] **Step 4: Call it from `model.py`**

In `build_items`, replace the `"route": []` / `"notes": []` lines with:

```python
        _route, _notes, _unparsed = model_triggers.parse(row)
        unconverted.extend(_unparsed)
```

and use `"route": _route, "notes": _notes,`. Add `import model_triggers` at the top.

- [ ] **Step 5: Build, run, and read what did NOT parse**

```
python build.py 2>&1 | tail -3
grep -A20 'action-without-trigger' docs/analysis/2026-08-03-model-conversion-report.md | head -25
npx playwright test tests/model-route.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: PASS. The report gains an `action-without-trigger` section — **read it; it is the real output of this task.**

- [ ] **Step 6: Commit**

```bash
git add model_triggers.py model.py tests/model-route.spec.ts docs/analysis/2026-08-03-model-conversion-report.md
git commit -m "feat(model): mid/somid become route steps with triggers; advice stays advice"
```

---

## Task 4: `model_guards.py` — the four gates, failing the build

**Files:**
- Create: `model_guards.py`
- Modify: `build.py`
- Test: `tests/model-guards.spec.ts`

**Interfaces:**
- Produces: `model_guards.run(items) -> list[str]` (empty = clean; non-empty = build fails)

- [ ] **Step 1: Write the failing test** — a guard is only real if a violation actually stops the build.

```ts
import { test, expect, seedApp } from './_fixtures';

test('G1 · the shipped model violates none of the four gates', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const bad = await page.evaluate(`(function(){
    var out = [];
    DATA.items.forEach(function(it){
      (it.safety||[]).forEach(function(b){
        if (b.source_id == null) out.push(it.name.he + ':' + b.kind + ':no-source');
        if (b.kind === 'thermal' && Number(b.instant_c) === 0) out.push(it.name.he + ':sentinel');
      });
      (it.route||[]).forEach(function(s){
        if (!s.trigger || Object.keys(s.trigger).length === 0) out.push(it.name.he + ':' + s.action + ':no-trigger');
      });
    });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
});
```

- [ ] **Step 2: Run it**

```
npx playwright test tests/model-guards.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: it must FAIL first. If it passes on the first run it is void — check that `DATA.items` is really populated and that the assertion can fire at all (add a deliberate bad item locally, confirm the test goes red, remove it).

- [ ] **Step 3: Write `model_guards.py`**

```python
# -*- coding: utf-8 -*-
"""Spec §7. Separate from the converter on purpose: a gate must never be relaxed
by the code it audits."""
import os

CORPUS = os.path.join("docs", "sources", "corpus")


def _corpus_ids():
    ids = set()
    if os.path.isdir(CORPUS):
        for name in os.listdir(CORPUS):
            head = name.split("-", 1)[0]
            if head.isdigit():
                ids.add(int(head))
    return ids


def run(items):
    problems, corpus = [], _corpus_ids()
    for it in items:
        for b in it.get("safety") or []:
            sid = b.get("source_id")
            if sid is None:
                problems.append("%s · %s · safety block with no source_id" % (it["name"]["he"], b["kind"]))
            elif corpus and sid not in corpus:
                problems.append("%s · source_id %s does not resolve to a corpus folder" % (it["name"]["he"], sid))
            if b.get("kind") == "thermal" and b.get("instant_c") == 0:
                problems.append("%s · sentinel 0 survived into a thermal block" % it["name"]["he"])
        tex = it.get("texture") or {}
        if tex.get("target_c") is not None and tex.get("source_id") is None and tex.get("provenance") != "craft":
            problems.append("%s · texture target with no source and no craft flag" % it["name"]["he"])
        for s in it.get("route") or []:
            trig = s.get("trigger") or {}
            if not trig:
                problems.append("%s · step '%s' has no trigger" % (it["name"]["he"], s.get("action")))
            # reachability: a core-temp trigger above the item's own target can never fire
            ct = (trig.get("at_core_temp") or {}).get("c")
            if ct is not None and tex.get("target_c") is not None and ct > float(tex["target_c"]):
                problems.append("%s · step '%s' fires at %s°C but the target is %s°C — unreachable"
                                % (it["name"]["he"], s.get("action"), ct, tex["target_c"]))
    return problems
```

- [ ] **Step 4: Wire into `build.py`, right after `build_items`**

```python
import model_guards as _mguards
_problems = _mguards.run(_items)
if _problems:
    print("[model:guards] FAIL —", len(_problems), "problem(s):")
    for _p in _problems[:40]:
        print("   x", _p)
    raise SystemExit(1)
print("[model:guards] OK - %d items, all four gates clean" % len(_items))
```

- [ ] **Step 5: Prove the gate BITES (this step is the point of the task)**

Temporarily add a bad item in `model.py` (`safety:[{"kind":"thermal","instant_c":0,"source_id":None}]`), run `python build.py; ec=$?`, confirm **exit 1** and the printed reason, then remove it and confirm the build returns to 0. Paste both outputs.

- [ ] **Step 6: Run the test, then commit**

```bash
npx playwright test tests/model-guards.spec.ts; ec=$?; echo "EXIT=$ec"
git add model_guards.py build.py tests/model-guards.spec.ts
git commit -m "feat(model): the four gates, and proof that they fail the build"
```

---

## Task 5: `app.js` reads the model — the consumers migrate

**Files:**
- Modify: `app.js` — `citedSafeC` becomes a thin reader over the model; `askFire`, `askContextFor`, `vcIdentifiedSafeItem`, and the work-plan `bcheck` at `app.js:4751` read `MODEL`
- Test: `tests/model-consumers.spec.ts`

**Interfaces:**
- Consumes: `DATA.items` (Task 1), guarded (Task 4)
- Produces: `MODEL.item(key)` · `MODEL.thermal(item)` · `MODEL.safeC(item)` — returns a number or `null`, never a fallback

- [ ] **Step 1: Write the failing test** — assert on RENDERED text, through the real ask panel, exactly as `catalog-sweep-safety.spec.ts` F(b) does.

```ts
import { test, expect, seedApp } from './_fixtures';

const askLocal = async (page: any, q: string) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-askai': '0' });
  await page.waitForFunction(`typeof MODEL==='object' && typeof askFire==='function'`);
  await page.evaluate(`openAsk();`);
  await page.waitForSelector('#askq');
  await page.fill('#askq', q);
  await page.click('#askgo');
  await page.waitForSelector('.abubble');
  return await page.evaluate(`document.querySelector('.abubble').textContent`) as string;
};

test('C1 · corn still answers with no number, now via the model', async ({ page }) => {
  const shown = await askLocal(page, 'האם תירס בטוח');
  expect(shown).not.toContain('63');
});

test('C2 · brisket still answers 63°C, now via the model', async ({ page }) => {
  const shown = await askLocal(page, 'בטיחות בריסקט');
  expect(shown).toContain('63');
});

test('C3 · no consumer reads the legacy scalar any more', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof MODEL==='object'`);
  const usesLegacy = await page.evaluate(
    `typeof citedSafeC==='function' && citedSafeC({safe:63}) === null`) as boolean;
  expect(usesLegacy).toBe(true);   // the old shape no longer resolves; only model items do
});
```

- [ ] **Step 2: Run it, watch C1/C2/C3 fail** (`MODEL` undefined).

```
npx playwright test tests/model-consumers.spec.ts; ec=$?; echo "EXIT=$ec"
```

- [ ] **Step 3: Add the `MODEL` accessor in `app.js`, directly above `citedSafeC`**

```js
// The single reader of the structured model. citedSafeC() was the single reader of the
// legacy scalar (R-82); this replaces it in the same role, one layer up.
const MODEL = {
  byId: null,
  init(){ this.byId = {}; (DATA.items||[]).forEach(it => { this.byId[it.id] = it; }); },
  item(o){ if(!this.byId) this.init(); return o && this.byId[o.n != null ? o.n : o.id] || null; },
  thermal(it){ return it && (it.safety||[]).find(b => b.kind === 'thermal') || null; },
  safeC(it){ const t = this.thermal(it); return t ? t.instant_c : null; },   // null, never a fallback
  mechanisms(it){ return it ? (it.safety||[]).map(b => b.kind) : []; },
};
```

- [ ] **Step 4: Migrate the four call sites** — replace `citedSafeC(c)` with `MODEL.safeC(MODEL.item(c))` in `askFire` and `askContextFor`; `vcIdentifiedSafeItem` likewise; and at `app.js:4751` replace the `safe!=null ? safe : tgt` substitution with `MODEL.safeC(...)`, dropping the `tgt` fallback entirely.

- [ ] **Step 5: Run the model tests AND the whole R-69 file** (the existing safety assertions are the regression net):

```
npx playwright test tests/model-consumers.spec.ts tests/catalog-sweep-safety.spec.ts; ec=$?; echo "EXIT=$ec"
```

Expected: all green. **Any R-69 failure means the migration changed behaviour — stop and diagnose, do not adjust the old test.**

- [ ] **Step 6: Commit**

```bash
git add app.js tests/model-consumers.spec.ts
git commit -m "feat(model): consumers read the model; the legacy scalar has no readers left"
```

---

## Task 6: full suite, then the release

- [ ] **Step 1: Machine idle** — close the MCP browser, confirm nothing on 8123, no heavy agents running (§11a; this cost a phantom failure on 2026-08-03).
- [ ] **Step 2:** `npx playwright test; ec=$?; echo "EXIT=$ec"` — **1144+ passed, exit 0.**
- [ ] **Step 3:** run it a second time; both clean (H7).
- [ ] **Step 4:** any failure — including a single intermittent one — is a bug. Diagnose with `systematic-debugging`; **never re-run until green.**
- [ ] **Step 5:** bump `build.py` version + `WHATS_NEW`, translate the new string into all six `lang/*.json` (§10.20), write `docs/releases/vNNN-ux-report.md` (H14), commit with the H7/DoD-12/L29/H14 markers, push, poll the live URL, verify with Playwright (stamp **and** a feature probe **and** a negative check).

---

## Self-Review

**Spec coverage:** §1 core → Task 1 · §2 safety blocks → Task 1 (thermal) + reported gaps → Task 2 · §3 texture + R-79 craft flag → Task 1 (M3) · §4 route/triggers → Task 3 · §5 notes → Task 3 (T2) · §6 nutrition → **not in this plan by design** (spec §11 puts the filling in a later wave; the schema leaves the slot) · §7 gates → Task 4 · §8 source ids → Task 1 + Task 4 · §9 migration order → the task order itself · §10 DoD → Task 1 Step 6, Task 4 Step 5, Task 6.

**Known narrowing, stated not hidden:** `cure`/`drying`/`fermentation`/`aging`/`parasite` blocks are **defined in the spec but only `thermal` is built here.** The other five need per-item values that exist today only as prose in `SPECIALS`/`MAKES`, and inventing them would violate DoD-10. **They land as an explicit `unconverted` reason (`mechanism-not-extracted`) so the report names every affected item.** This is a scope boundary the owner must confirm — it is raised in the morning report, not decided silently.

**Type consistency:** `build_items` returns `(items, unconverted)` in Tasks 1–3; `model_guards.run(items)` takes only items; `MODEL.safeC` returns `number|null` and every consumer treats `null` as "say no number".
