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

---

# ADDENDUM — owner instruction, 2026-08-03 01:50

> **"תבנה הכל, תמיר הכל, תבדוק הכל תדווח — לא פחות מזה."**

This overrides the scope boundary named in the Self-Review above. **All six mechanism kinds are built.**
The boundary is no longer a question for the owner; it is closed as: build them.

**DoD-10 still binds, and it is the hard part.** No safety value may be *invented*. This is the line, and
every task below stays on the authored side of it:

| Allowed | Forbidden |
|---|---|
| **Extract** what the data states (`calc.salt = 18` → `salt_g_per_kg: 18`) | **Compute** a safety claim the data does not make |
| **Attach** a regulatory limit from the corpus AS a limit (`nitrite_ppm_max: 200`, source #6) | Present that limit as if it were the item's own value |
| **Check** the authored value against the corpus limit and report a breach | Silently clamp a value so it passes |
| **Report** a mechanism we can see but cannot quantify | Guess the missing number |

The payoff of this framing: the corpus stops being a filing cabinet and becomes a **validator**. Every
cure dose is checked against 9 CFR §424.21's 200 ppm ceiling (#6) and CFIA's 100 ppm floor (#11); every
drying block against FSIS a_w 0.85 (#9); every fermentation against AMI 1997 degree-hours (#10).
**That check is the real deliverable here**, more than the block itself.

## What each mechanism is extracted FROM — measured 2026-08-03

| Kind | Source in the authored data | Shape |
|---|---|---|
| `thermal` | `CUTS.safe`, and `SPECIALS.tgt` when numeric | numeric — Task 1 |
| `cure` | **`MAKES[*].build.calc`** = `{salt, cure:'1'/'2'/None, cureRate, sugar, water, brine}` — **already structured, 50 rows** · `SPECIALS.cure` prose naming Cure #1/#2 and day counts | mixed |
| `drying` | `SPECIALS.age` prose · `SPECIALS.cat == בשר מיובש` | prose |
| `fermentation` | `MAKES[*].build.phases` prose naming תסיסה/תרבית · `SPECIALS.cure` likewise | prose |
| `aging` | `SPECIALS.age` prose · cheese rows | prose |
| `parasite` | **NOT authored anywhere.** Fish rows carry no freezing field. | absent |

**`parasite` is the one honest gap and it is named, not filled.** The corpus holds FDA's freezing table
(#5), but *which of our fish is served raw* is a culinary fact nobody has authored. Every fish row lands
in the report under `parasite-not-authored` and no block is created. A data gap named is not a mechanism
skipped.

---

## Task 1b: `cure` blocks — the structured half, and the corpus as validator

**Files:** Create `model_cure.py` · Modify `model.py` · Test `tests/model-cure.spec.ts`
**Interfaces:** `model_cure.block(row) -> (block|None, unconverted:list)`

- [ ] **Step 1 — failing test** (`tests/model-cure.spec.ts`)

```ts
import { test, expect, seedApp } from './_fixtures';

const boot = async (p: any) => {
  await seedApp(p, { 'mk-uilevel-asked': 'true' });
  await p.waitForFunction(`!!(window.DATA && DATA.items)`);
};

test('CU1 · a cured item carries a cure block with its AUTHORED dose', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var withCure = DATA.items.filter(function(x){
      return (x.safety||[]).some(function(b){ return b.kind==='cure'; }); });
    var one = withCure.filter(function(x){
      return (x.safety||[]).some(function(b){ return b.kind==='cure' && b.salt_g_per_kg != null; }); })[0];
    var b = one && (one.safety||[]).filter(function(z){ return z.kind==='cure'; })[0];
    return { count: withCure.length, name: one && one.name.he, block: b };
  })()`) as any;
  expect(r.count).toBeGreaterThan(0);
  expect(r.block.salt_g_per_kg).toBeGreaterThan(0);
  expect(r.block.source_id).not.toBeNull();
});

test('CU2 · every cure dose is checked against the CFR ceiling and the CFIA floor', async ({ page }) => {
  await boot(page);
  const breaches = await page.evaluate(`(function(){
    var out = [];
    DATA.items.forEach(function(it){
      (it.safety||[]).forEach(function(b){
        if (b.kind==='cure' && b.limit_check==='breach') out.push(it.name.he + ':' + b.limit_reason);
      });
    });
    return out;
  })()`) as string[];
  expect(breaches).toEqual([]);
});

// NEGATIVE (DoD-6): a FRESH sausage (calc.cure === null) must get NO cure block.
test('CU3 · a fresh sausage carries no cure block at all', async ({ page }) => {
  await boot(page);
  const kinds = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(x){ return x.name.he==='בראטוורסט'; })[0];
    return b ? (b.safety||[]).map(function(z){ return z.kind; }) : null;
  })()`) as string[];
  expect(kinds).not.toContain('cure');
});
```

- [ ] **Step 2 — run it, watch it fail.** `npx playwright test tests/model-cure.spec.ts; ec=$?; echo "EXIT=$ec"`

- [ ] **Step 3 — write `model_cure.py`**

```python
# -*- coding: utf-8 -*-
"""`cure` blocks: extracted from what is authored, validated against the corpus.

MAKES carry a STRUCTURED calc, so those need no prose parsing at all. SPECIALS carry
Hebrew prose that reliably names Cure #1 / Cure #2 and often a day count. Nothing here
computes a ppm figure and presents it as the item's own value: the regulatory ceiling
and floor are attached as LIMITS, each with its corpus id.
"""
import re

SRC_CFR_424_21, SRC_CFR_424_22, SRC_CFIA = 6, 7, 11

NITRITE_PPM_MAX = 200      # 9 CFR 424.21 — no more than 200 ppm nitrite in the finished product
NITRITE_PPM_MIN = 100      # CFIA — the floor the CFR does not state
SALT_PCT_MIN = 2.5         # CFIA, alongside the nitrite floor

_CURE_N = re.compile(r"Cure\s*#\s*([12])", re.I)
_DAYS = re.compile(r"(\d+)\s*(?:-\s*\d+\s*)?ימים")


def _from_calc(calc):
    if not isinstance(calc, dict):
        return None
    ctype = calc.get("cure")
    if ctype in (None, "", 0):
        return None                       # fresh — no cure mechanism, and that IS the answer
    return {"cure_type": str(ctype), "cure_rate_g_per_kg": calc.get("cureRate"),
            "salt_g_per_kg": calc.get("salt"), "sugar_g_per_kg": calc.get("sugar"),
            "brine": bool(calc.get("brine"))}


def _from_prose(text):
    if not text:
        return None
    m = _CURE_N.search(text)
    if not m:
        return None
    out = {"cure_type": m.group(1), "cure_rate_g_per_kg": None, "salt_g_per_kg": None,
           "sugar_g_per_kg": None, "brine": ("תמלחת" in text or "כבישה רטובה" in text)}
    d = _DAYS.search(text)
    if d:
        out["cure_days"] = int(d.group(1))
    return out


def block(row):
    """Returns (block|None, unconverted:list). Never invents a dose."""
    unconv = []
    build = row.get("build") if isinstance(row.get("build"), dict) else None
    base = _from_calc(build.get("calc")) if build else None
    if base is None:
        base = _from_prose(row.get("cure"))
    if base is None:
        return None, unconv

    base["kind"] = "cure"
    base["nitrite_ppm_max"] = NITRITE_PPM_MAX      # LIMITS from the corpus, not our values
    base["nitrite_ppm_min"] = NITRITE_PPM_MIN
    base["salt_pct_min"] = SALT_PCT_MIN
    base["source_id"] = SRC_CFR_424_21
    base["limit_sources"] = [SRC_CFR_424_21, SRC_CFR_424_22, SRC_CFIA]

    salt = base.get("salt_g_per_kg")
    if salt is None:
        base["limit_check"] = "unknown"
        base["limit_reason"] = "no authored salt figure"
        unconv.append({"id": row.get("n"), "name": row.get("heb"), "field": "cure",
                       "value": row.get("cure"), "reason": "cure-dose-not-authored"})
    elif (float(salt) / 10.0) < SALT_PCT_MIN:
        base["limit_check"] = "below-cfia-floor"
        base["limit_reason"] = "salt %.1f g/kg = %.2f%% < CFIA %.1f%%" % (
            salt, float(salt) / 10.0, SALT_PCT_MIN)
    else:
        base["limit_check"] = "within"
        base["limit_reason"] = None
    return base, unconv
```

- [ ] **Step 4 — call it from `model.py`** for `SPECIALS` and for every `MAKES` entry (see Task 1f: MAKES
  become items, `id = "make:" + mid`). Append the block to `safety`; extend `unconverted`.
- [ ] **Step 5 — build, read the report, run the test.** **If CU2 finds a breach, that is a FINDING, not a
  test to relax.** Report it; never adjust the limit to make it pass.
- [ ] **Step 6 — commit:** `feat(model): cure blocks, validated against the CFR ceiling and CFIA floor`

---

## Task 1c: `drying`, `fermentation`, `aging` — the prose mechanisms

**Files:** Create `model_process.py` · Modify `model.py` · Test `tests/model-process.spec.ts`
**Interfaces:** `model_process.blocks(row) -> (list, unconverted:list)`

- [ ] **Step 1 — failing test**

```ts
test('P1 · biltong dries, salami ferments AND dries', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const r = await page.evaluate(`(function(){
    var k = function(n){
      var it = DATA.items.filter(function(x){ return x.name.he===n; })[0];
      return it ? (it.safety||[]).map(function(b){ return b.kind; }).sort() : null; };
    return { biltong: k('בילטונג'), salami: k('סלמי') };
  })()`) as any;
  expect(r.biltong).toContain('drying');
  expect(r.salami).toContain('drying');
});

test('P2 · a threshold exists only with a source, and is labelled a limit', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const bad = await page.evaluate(`(function(){
    var out = [];
    DATA.items.forEach(function(it){
      (it.safety||[]).forEach(function(b){
        var isProc = (b.kind==='drying' || b.kind==='fermentation' || b.kind==='aging');
        var hasNum = (b.aw_max != null || b.ph_max != null || b.degree_hours_max != null);
        if (isProc && hasNum && b.source_id == null) out.push(it.name.he + ':' + b.kind);
      });
    });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
});
```

- [ ] **Step 2 — run, watch it fail. Step 3 — write `model_process.py`**

```python
# -*- coding: utf-8 -*-
"""drying / fermentation / aging, read out of the authored prose.

Thresholds are NEVER read out of the prose — the prose says "4-7 ימים בייבוש מאוורר",
never an a_w. The threshold comes from the corpus and is labelled a LIMIT with its source
id. What the prose supplies is the DURATION and the fact that the mechanism applies.
"""
import re

SRC_JERKY_2014, SRC_GD_2023, SRC_AMI_1997, SRC_21CFR133, SRC_LISTERIA = 9, 8, 10, 12, 13

AW_MAX_SHELF_STABLE = 0.85        # FSIS jerky guideline (#9) / GD-2023-0002 (#8)
PH_MAX_FERMENT = 5.3              # GD-2023-0002 (#8), AMI 1997 (#10)
DEGREE_HOURS = {"le_90F": 1200, "f_90_100F": 1000, "gt_100F": 900}   # AMI 1997 (#10)
CHEESE_AGE_DAYS_MIN, CHEESE_AGE_TEMP_C_MIN = 60, 1.7                 # 21 CFR 133 (#12)

_DAYS = re.compile(r"(\d+)(?:\s*-\s*(\d+))?\s*ימים")
_WEEKS = re.compile(r"(\d+)(?:\s*-\s*(\d+))?\s*שבועות")
_DRY = ("ייבוש", "מיובש", "ייבש", "בילטונג")
_FERM = ("תסיסה", "תרבית", "מותסס", "מחמיץ")
_AGE = ("יישון", "הבשלה", "מיושן")


def _days(text):
    m = _DAYS.search(text or "")
    if m:
        return int(m.group(2) or m.group(1))
    m = _WEEKS.search(text or "")
    if m:
        return int(m.group(2) or m.group(1)) * 7
    return None


def blocks(row):
    out, unconv = [], []
    hay = " ".join(str(row.get(k) or "") for k in ("cure", "age", "note", "cat", "heb"))

    if any(w in hay for w in _DRY):
        out.append({"kind": "drying", "days": _days(row.get("age") or hay),
                    "aw_max": AW_MAX_SHELF_STABLE, "limit_is_regulatory": True,
                    "source_id": SRC_JERKY_2014,
                    "limit_sources": [SRC_JERKY_2014, SRC_GD_2023]})
    if any(w in hay for w in _FERM):
        out.append({"kind": "fermentation", "ph_max": PH_MAX_FERMENT,
                    "degree_hours_max": DEGREE_HOURS, "limit_is_regulatory": True,
                    "source_id": SRC_GD_2023,
                    "limit_sources": [SRC_GD_2023, SRC_AMI_1997]})
        if _days(row.get("age") or "") is None:
            unconv.append({"id": row.get("n"), "name": row.get("heb"), "field": "age",
                           "value": row.get("age"), "reason": "ferment-duration-not-authored"})
    if any(w in hay for w in _AGE) and "גבינ" in hay:
        out.append({"kind": "aging", "days_min": CHEESE_AGE_DAYS_MIN,
                    "temp_c_min": CHEESE_AGE_TEMP_C_MIN, "requires_pasteurized_milk": False,
                    "limit_is_regulatory": True, "source_id": SRC_21CFR133,
                    "limit_sources": [SRC_21CFR133, SRC_LISTERIA]})
    return out, unconv
```

- [ ] **Steps 4–6** — call from `model.py`; build; read the report; run the test; commit
  `feat(model): drying, fermentation and aging blocks, thresholds sourced not guessed`

---

## Task 1d: `parasite` — the gap, named

- [ ] **Step 1 — failing test** (append to `tests/model-process.spec.ts`)

```ts
test('P3 · every fish row is named in the report under parasite-not-authored', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const r = await page.evaluate(`(function(){
    var fish = DATA.items.filter(function(it){ return it.category==='דג'; });
    var silent = fish.filter(function(it){
      var noBlock = (it.safety||[]).every(function(b){ return b.kind!=='parasite'; });
      return noBlock && (DATA.unconvertedIds||[]).indexOf(it.id) === -1;
    }).map(function(it){ return it.name.he; });
    return { fishCount: fish.length, silent: silent };
  })()`) as any;
  expect(r.fishCount).toBeGreaterThan(0);
  expect(r.silent).toEqual([]);
});
```

- [ ] **Steps 2–4** — run it red; in `model.py`, for every `category == 'דג'` row with no authored freezing
  field, append `{"reason": "parasite-not-authored", ...}` to `unconverted` and **create no block**; build;
  run; commit. The FDA table (#5) states the regulation, not which of OUR items is served raw.

---

## Task 1e: `source_id` resolution — 80+ prose refs → 19 corpus ids

**Files:** Create `model_sources.py` · Modify `model.py` · Test `tests/model-sources.spec.ts`

Task 1's agent measured **80+ distinct reference strings** in `sources.py`. A wrong id is worse than a
missing one.

- [ ] **Step 1** — dump every distinct `ref` with its frequency and **read the list yourself**.
- [ ] **Step 2 — failing test:** source ids are distributed, not all defaulted to one entry.

```ts
test('S1 · source ids are distributed, not all defaulted to one corpus entry', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items)`);
  const ids = await page.evaluate(`(function(){
    var s = {};
    DATA.items.forEach(function(it){
      (it.safety||[]).forEach(function(b){ s[b.source_id] = (s[b.source_id]||0)+1; }); });
    return s;
  })()`) as Record<string, number>;
  expect(Object.keys(ids).length).toBeGreaterThan(2);
});
```

- [ ] **Step 3** — write `model_sources.py` with an explicit `REF_TO_CORPUS` dict: **one entry per
  reference string you actually read**, mapping to a corpus id or to `None`. `None` is a legitimate,
  reportable answer (`source-unmapped`); a guess is not. Derived refs (`meatsandsausages.com`) map to the
  primary that replaced them (#6/#7) — `00-SOURCE-MAP.md` §10 records those replacements.
- [ ] **Steps 4–5** — build; the report gains a `source-unmapped` section; **read it**; commit.

---

## Task 1f: MAKES become items

`MAKES` (50 build-from-scratch recipes) were outside Task 1's loop and carry the most structured safety
data in the catalogue. Add them in `model.py` with `id = "make:" + mid` and their cure block from Task 1b.
Assert `DATA.items.length === 130 + 47 + 50 === 227` and that no existing consumer breaks.

---

## Revised Task 6

The full suite runs after **1, 1b, 1c, 1d, 1e, 1f, 2, 3, 4, 5** — not before. Everything above is
build-time and test-time; nothing reaches a user until Task 5 migrates the consumers and Task 6 gates it.

---

# REVISION 2 — the owner's spreadsheet + Wave 0 alignment (2026-08-03)

**Governing spec: `docs/superpowers/specs/2026-08-03-data-model-design-v2.md` (supersedes v1 upon
owner approval).** Measurement base: `docs/analysis/2026-08-03-sheet-vs-app-reconciliation.md`.
The spreadsheet finding: an item has 0..n ROUTES; 65 (field,item) pairs were lost to the flattening
(tgt 24 · wrap 27 · sear 8 · coal 5 · wood 1). Route ids are **the ones `itemPaths` (app.js:4760)
already emits** (`c:smoke_sv`, `c:smoke`, `:rev` …) — never a new vocabulary (spec v2 §4.1, gate G-5).

**What this revision does to the existing tasks:**

| Task | Status |
|---|---|
| 1 (core+thermal) | **LANDED** (`9a31a1d`) — unchanged, except Task 1g moves `texture` from the item onto `paths` |
| 1b–1f (cure/process/parasite/sources/MAKES) | **Stand as written** — mechanisms are item-level (measured: `safe` identical across both sheet routes 68/68) |
| 2 (report) | Amended by Task 2r below (new reasons + the 65-pair counter) |
| **3 (triggers)** | **REPLACED by Task 3r** — v1's Task 3 parses `mid`/`somid` into one item-level `route[]`, which re-flattens the two sheets. Steps must land per path |
| 4 (guards) | Amended by Task 4r (G-5/G-6/G-7, per-path reachability) |
| 5 (consumers) | Amended: `MODEL.path(item, id)` added; the schedule consumer is `effectiveSchedule` |
| 6 (suite+release) | Unchanged; runs after everything below |

**New global constraint (spec v2 §4.2):** the converter NEVER fills a path's field from the other
path, never invents a path id, and never writes a derivable (`time_h`, `saved`). Missing = report row.
**Owner gate before Task 1g Step 5:** Q-1 (import the sheet's second-route texture targets as
`provenance:'owner-sheet'`) must be approved in conversation; until then the import is behind
`IMPORT_OWNER_SHEET = False` and those targets land in the report as `path-target-unimported`.

---

## Task 1g: `model_paths.py` — routes become first-class, keyed by `itemPaths` ids

**Files:** Create `model_paths.py`, `model_sheet.py` · Modify `model.py` · Test `tests/model-paths.spec.ts`
**Interfaces:**
- `model_sheet.load() -> {by_item_he: {...}}` — reads `docs/sources/owner-sheet/0{1,2,3}-*.csv`,
  **Hebrew-name-first join** (the Duck/Goose trap, reconciliation §1), alias `נקניקיות→נקניקיות מוכנות`.
- `model_paths.build(row, sheet) -> (paths: dict, unconverted: list)` — keys are `c:`-style ids.

- [ ] **Step 1: failing test** (`tests/model-paths.spec.ts`)

```ts
import { test, expect, seedApp } from './_fixtures';

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`!!(window.DATA && DATA.items && DATA.items.length)`);
};

test('PA1 · brisket carries TWO paths with their own legs, keyed by itemPaths ids', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var ab = b.paths && b.paths['c:smoke_sv'], sb = b.paths && b.paths['c:smoke'];
    return { keys: b.paths ? Object.keys(b.paths).sort() : null,
             svLeg: ab && ab.legs && ab.legs.sv,           // ← data.svt/svh, MOVED not rewritten
             soLeg: sb && sb.legs && sb.legs.smoke,        // ← data.sot/soh
             tgtB:  sb && sb.texture && sb.texture.target_c };
  })()`) as any;
  expect(r.keys).toContain('c:smoke_sv');
  expect(r.keys).toContain('c:smoke');
  expect(r.svLeg).toEqual({ t: 68, h: '30' });   // exactly data.py's svt/svh upper (DoD-10: moved)
  expect(r.soLeg).toEqual({ t: 110, h: '12' });
  expect(r.tgtB).toBe(95);                        // R-79: 95 stays, ON ITS PATH
});

test('PA2 · every path key is an id itemPaths can emit — no invented vocabulary', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    var ok = /^c:(sv|smoke|grill)(_(sv|smoke|grill))*(:rev)?$/;
    var out = [];
    DATA.items.forEach(function(it){
      Object.keys(it.paths||{}).forEach(function(k){ if(!ok.test(k)) out.push(it.name.he+':'+k); });
    });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
});

// NEGATIVE (DoD-6): an item the sheet never described (a vegetable) gets NO sheet-derived path fields.
test('PA3 · corn carries no smoke-only path fabricated from a sheet it was never in', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var c = DATA.items.filter(function(it){ return it.name.he==='תירס'; })[0];
    var p = (c.paths||{})['c:smoke'];
    return { hasSheetTexture: !!(p && p.texture && p.texture.provenance==='owner-sheet') };
  })()`) as any;
  expect(r.hasSheetTexture).toBe(false);
});
```

- [ ] **Step 2: run it, watch PA1/PA2 fail** (`paths` undefined).
  `npx playwright test tests/model-paths.spec.ts; ec=$?; echo "EXIT=$ec"`

- [ ] **Step 3: write `model_sheet.py`** — csv loader (`utf-8-sig`), returns per-item dict
  `{he, routeA: {...cols…}, routeB: {...}}`; join is he-first, en fallback, the one alias explicit.
  Unmatched sheet row → raise (there are none today; a future rename must be loud).

- [ ] **Step 4: write `model_paths.py`**

```python
# -*- coding: utf-8 -*-
"""Routes as first-class data, keyed by the SAME ids itemPaths emits (spec v2 §4.1).

The flat row holds route A's sv+smoke legs (svt/svh/smt/smh), route B's smoke leg
(sot/soh), and per-route fields that the flattening collapsed (reconciliation §2).
Nothing here fills one path's field from the other path, and nothing invents an id.
"""
IMPORT_OWNER_SHEET = False   # Q-1 — flips to True only on the owner's spoken approval

def _hours_upper(h):
    s = str(h or '').strip()
    return s  # moved verbatim; range parsing stays in the JS consumer it already lives in

def build(row, sheet_row, unconverted):
    paths = {}
    if row.get("svt") is not None and row.get("smt") is not None:
        paths["c:smoke_sv"] = {
            "legs": {"sv": {"t": row["svt"], "h": _hours_upper(row.get("svh"))},
                     "smoke": {"t": row["smt"], "h": _hours_upper(row.get("smh"))}},
            "texture": None, "sear": None, "coal": None, "steps": [],
        }
    if row.get("sot") is not None:
        paths["c:smoke"] = {
            "legs": {"smoke": {"t": row["sot"], "h": _hours_upper(row.get("soh"))}},
            "texture": {"target_c": row.get("tgt"), "source_id": None, "provenance": "craft"},
            "sear": None, "coal": None, "steps": [],
        }
    # data.py's single tgt: reconciliation §2.2 measured which route it matches.
    # kept=A → it belongs to c:smoke_sv; kept=B → c:smoke; ambiguous → report, both stay None.
    if sheet_row:
        a_t, b_t = sheet_row.get("tgtA"), sheet_row.get("tgtB")
        d_t = row.get("tgt")
        if d_t is not None and a_t is not None and b_t is not None and a_t != b_t:
            if d_t == a_t and "c:smoke_sv" in paths:
                paths["c:smoke_sv"]["texture"] = {"target_c": d_t, "source_id": None, "provenance": "craft"}
                if "c:smoke" in paths:
                    if IMPORT_OWNER_SHEET:
                        paths["c:smoke"]["texture"] = {"target_c": b_t, "source_id": None, "provenance": "owner-sheet"}
                    else:
                        unconverted.append({"id": row.get("n"), "name": row.get("heb"),
                                            "field": "tgt:c:smoke", "value": b_t,
                                            "reason": "path-target-unimported"})
            elif d_t == b_t and "c:smoke" in paths:
                if "c:smoke_sv" in paths:
                    if IMPORT_OWNER_SHEET:
                        paths["c:smoke_sv"]["texture"] = {"target_c": a_t, "source_id": None, "provenance": "owner-sheet"}
                    else:
                        unconverted.append({"id": row.get("n"), "name": row.get("heb"),
                                            "field": "tgt:c:smoke_sv", "value": a_t,
                                            "reason": "path-target-unimported"})
            else:
                unconverted.append({"id": row.get("n"), "name": row.get("heb"),
                                    "field": "tgt", "value": d_t,
                                    "reason": "target-matches-neither-route"})
        # sear/coal move onto the path from each sheet route; identical → item keeps one copy is FINE,
        # but the model still writes them per path so no consumer re-derives (G-4).
        for key, col in (("c:smoke_sv", "A"), ("c:smoke", "B")):
            if key in paths:
                paths[key]["sear"] = sheet_row.get("sear" + col)
                paths[key]["coal"] = sheet_row.get("coal" + col)
    # order_smokesv (sources.py) → the :rev path — moved verbatim, only when cited (13 items today)
    os_ = row.get("order_smokesv")
    if os_ and os_.get("sv", {}).get("pasteurize") is True:
        paths["c:smoke_sv:rev"] = {"legs": os_, "texture": None, "sear": None, "coal": None, "steps": []}
    return paths, unconverted
```

- [ ] **Step 5: wire into `model.py`** — items gain `"paths": _paths`; item-level `texture` becomes
  the DEFAULT path's texture (adapter compatibility) and is marked `"texture_scope": "path"`.
- [ ] **Step 6: DoD-10 proof** — extend Task 1 Step 6's script: for every item, every leg value in
  `paths` equals the source field in `data.py`/`sources.py` byte-for-byte (svt/svh/smt/smh/sot/soh/
  order_smokesv). Expected: `path values altered: 0`. Paste output.
- [ ] **Step 7: commit** `feat(model): paths keyed by itemPaths ids — the flattening reversed`

---

## Task 3r (replaces Task 3): triggers land INSIDE paths

**Files:** Create `model_triggers.py` · Modify `model_paths.py` · Test `tests/model-route.spec.ts`

v1's Task 3 parser and closed trigger set survive **verbatim** (same `_TEMP`/`_ACTION`/`_EVERY`
tables, same "advice stays advice"); the change is the attachment point and one new cross-check:

- `mid` parses into `paths["c:smoke_sv"].steps` · `somid` into `paths["c:smoke"].steps` ·
  `rest` (measured route-invariant 68/68) appends a rest step to EVERY path.
- **The wrap cross-check replaces wrap conversion** (spec v2 §4.1): for every sheet-B `wrap=="כן"`,
  a wrap-or-3-2-1 step must have parsed out of `somid`; mismatch →
  `{"reason": "wrap-flag-contradicts-somid"}`. The `wrap` field itself is dropped, its information
  content proven redundant (27/27, reconciliation §2.1) — named in the report as `wrap-field-retired`.

- [ ] **Step 1: failing test** — T1 changes to assert the step lives on the PATH:

```ts
test('T1r · "עטיפה ב-70°C" is a wrap step ON THE SMOKE-ONLY PATH, absent from sv+smoke', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var wrapOf = function(k){ return ((b.paths[k]||{}).steps||[]).filter(function(s){ return s.action==='wrap'; })[0]; };
    return { onSmoke: wrapOf('c:smoke'), onCombo: wrapOf('c:smoke_sv') };
  })()`) as any;
  expect(r.onSmoke && r.onSmoke.trigger).toEqual({ at_core_temp: { c: 70 } });
  expect(r.onCombo).toBeUndefined();      // route A chills; it does not wrap
});
```

- [ ] Steps 2–5 as v1 Task 3 (red → parser → build → read the `action-without-trigger` AND
  `wrap-flag-contradicts-somid` report sections → green).
- [ ] **Commit:** `feat(model): triggers attach to their path; the wrap flag retires with proof`

---

## Task 1h: specials' smoke temperature gets a shape (G-6)

**Files:** Create `model_smoke_temp.py` · Modify `model.py` · Test `tests/model-smoke-temp.spec.ts`

Measured (reconciliation §4): 12/19 sheet specials carry a ramp (`"60-75°C עולה"`), a cold-smoke
CEILING (`"עישון קר ≤30°C"`), or "no smoke", all collapsed into a bare number or None+prose.
A ceiling rendered as a setpoint is the `safe=0` sentinel family.

- Closed shape: `{"kind":"setpoint","c":90}` | `{"kind":"ramp","from":60,"to":75}` |
  `{"kind":"cold_max","c":30}` | `None` (no smoke stage).
- Extraction: `smt` + the sheet's `טמפ' עישון` prose + `note` (the app moved the ramp text into
  notes — measured, e.g. kielbasa "עישון מדורג 60→75°C"). Prose that names a ramp/ceiling wins over
  the bare `smt` number; **the number itself is never changed, only re-labelled** (DoD-10).
- Failing test asserts: gouda's block is `{kind:'cold_max', c:30}` and NO consumer-visible setpoint
  of 30 exists; kielbasa is `{kind:'ramp', from:60, to:75}`; negative: bacon stays
  `{kind:'setpoint', c:90}`.
- **Commit:** `feat(model): smoke temperature has a shape — a ceiling can no longer pose as a setpoint`

---

## Task 2r: report amendments

Add to the Task 2 renderer: reasons `path-target-unimported` · `target-matches-neither-route` ·
`wrap-flag-contradicts-somid` · `wrap-field-retired` · `sheet-drift` (the §3 drift rows: svt 3,
sot 9, soh 2, svh 3, diff 1, mid 1 — value in each source, **informational, nothing changed**), and a
**flattening counter**: `65 route-divergent pairs → N converted · M reported · 0 silent` (G-7 feeds
on this exact number; the test asserts N+M=65).

---

## Task 4r: guard amendments (G-5 · G-6 · G-7 + per-path reachability)

Extend `model_guards.run(items)`:

```python
        for pid, p in (it.get("paths") or {}).items():
            if not _PATH_ID_RE.match(pid):
                problems.append("%s · invented path id %s" % (it["name"]["he"], pid))      # G-5
            tex = p.get("texture") or {}
            for s in p.get("steps") or []:
                ct = ((s.get("trigger") or {}).get("at_core_temp") or {}).get("c")
                if ct is not None and tex.get("target_c") is not None and ct > float(tex["target_c"]):
                    problems.append("%s · %s · step '%s' fires at %s but THIS PATH targets %s"
                                    % (it["name"]["he"], pid, s.get("action"), ct, tex["target_c"]))  # G-2r
        st = it.get("smoke_temp")
        if isinstance(st, dict) and st.get("kind") == "cold_max" and st.get("as_setpoint"):
            problems.append("%s · cold ceiling rendered as setpoint" % it["name"]["he"])   # G-6
```

plus the G-7 build-time assertion: the flattening counter reads `65 → converted+reported, silent==0`,
else exit 1. Step "prove the gate BITES" (deliberate bad item, exit 1, remove, exit 0) applies to each.
**Commit:** `feat(model): gates G-5..G-7 — path ids, smoke-temp shape, zero silent flattening`

---

## Task 5r: consumer amendments

`MODEL` gains `path(it, id)` and `defaultPath(it)`; **`effectiveSchedule` is the first migrated
consumer** (it is THE schedule surface — spec v2 §10): `itemStages` reads legs via the adapter,
byte-identical output asserted against a pre-migration snapshot for all 227 items (the CP2-style
invariance test). `path_outcomes` (Wave 0, `sources.py`) is NOT built here; Task 4r's G-5 already
guarantees key compatibility the day it lands.

---

## REVISION 3 — the path-id cross-check gate (owner-approved insertion, 2026-08-03)

**Files:** Create `tests/model-pathid-crosscheck.spec.ts` · no production files touched.
**Order:** runs **after Task 3r, before 1h/1b–1f** (see the updated execution order below) — it
must land before the mechanism tasks so any drift THEY introduce into `model_paths.py`'s id
vocabulary is caught immediately, not discovered later at Task 4r/5r.

**Why it exists.** `model_paths.py` hard-codes the path ids it emits as literals (`"c:smoke_sv"`,
`"c:smoke"`, `"smoke"`, the `":rev"` suffix) — a Python mirror of three JS functions:
`methodRules` (app.js:1157, which app.js:2541 calls "single source of truth"), `comboMethodEntry`,
and `itemProfile`/`itemPaths` (app.js:4760). Task 2.3 ("שכבת אוצר-השיטות", Wave 0) expands the
method vocabulary from today's 3 primitives (`allowed:['sv','smoke','grill']`) to ~30 primary + ~10
secondary, and its own task card touches `data.py`/schema. When it lands, `itemPaths` will emit a
different id vocabulary and the Python mirror goes stale **silently** — the model would produce
keys nobody looks up, and nothing would fail loudly. That is the `no-inert-shipment` failure mode,
arriving by drift instead of by omission. This gate converts that silent staleness into an
immediate, loud failure.

**What it asserts.** `PX1` resolves every `DATA.items` row back to its app.js meta (via
`resolveItem` on its `legacy_ref`), calls the real `itemPaths(meta)`, and compares — **as sets, per
item, in both directions** — the ids it emits against `Object.keys(item.paths)`:
- an engine id with no model entry ("missing-from-model" — a path the model would silently ignore
  if the engine started emitting it as the default/primary route), and
- a model key the engine never emits for that item ("extra-in-model" — a stale or invented id, the
  exact failure mode PA2 already guards for the *engine ⊇ model* direction; PX1 adds the reverse).

**The discovery that shaped the design.** Measured against the current build (before this test
existed): `methodRules` allows `sv`/`smoke`/`grill` in combination for essentially every CUTS
category, so `itemProfile` validly enumerates several grill-inclusive combos and a solo-`sv` combo
per item — but `model_paths.py` **only ever converts two routes** ("Route A" sv+smoke, "Route B"
smoke-only), exactly as its own module docstring already says. Running PX1 with an empty allow-list
produced **601 divergences across 134 of 177 items** — not isolated drift, but the current,
pre-existing, documented scope of the converter. Encoding that honestly as 130 literal per-item
entries would be an unmaintainable, un-auditable list, so PX1's allow-list (`PATHID_ALLOWED_GAPS`)
is **reasoned patterns**, not a flat id list: "any CUTS id containing `grill`", "CUTS solo-`sv`
(`c:sv` exactly)", and — kept as a small, closed, **named** list per the task's own instruction —
the 4 SPECIALS rows with no `smt` in `data.py` (בילטונג, סלמי, צ'וריסו מיובש, פפרוני). Each rule
carries its reason inline; a divergence that matches none of the three fails the test by name.

- [x] **Step 1: RED witnessed** — `PATHID_ALLOWED_GAPS` temporarily emptied; run showed 601 named
  divergences (467 grill-inclusive + 130 solo-sv + 4 specials-no-smt), each stating item+id+table.
- [x] **Step 2: GREEN** — allow-list restored; `real-failures=0`, all three rules exercised
  (467×/130×/4×), coverage totals logged every run (`engine-ids=916 model-ids=315`).
- [x] **Step 3: the gate BITES** — `model_paths.py`'s `_cut_paths` temporarily renamed `c:smoke` →
  `c:smoke_X` for `cuts:1` (בריסקט) only; rebuild; PX1 failed naming בריסקט in BOTH directions
  (`engine emits 'c:smoke' but model has no entry` / `model has 'c:smoke_X' but the engine never
  emits it`), and the existing `PA1`/`PA2` specs failed too, independently confirming the same
  corruption. Reverted; rebuild; all 15 tests (PX1 + the 3 existing model specs) green again.
- [x] **Commit:** `test(model): PX1 — the path-id cross-check gate, guarding against Wave 0 drift`

**Revised execution order (supersedes the line below for this insertion only):**
**1 ✅ → 1g → 3r → REVISION 3 (PX1) → 1h → 1b → 1c → 1d → 1e → 1f → 2+2r → 4+4r → 5+5r → 6.**

---

## Revised execution order

**1 ✅ → 1g → 3r → 1h → 1b → 1c → 1d → 1e → 1f → 2+2r → 4+4r → 5+5r → 6.**
Rationale: 1g/3r/1h reshape what 1b–1f attach to (mechanism blocks stay item-level, so 1b–1f are
unchanged in content, but running them after 1g avoids a double migration of `model.py`'s item loop).
Owner gates in-flight: **Q-1 before 1g Step 5's flag flip** (default stays False and ships honestly
reported) · Q-2 (wood_mix) rides Task 1g if approved, else lands as a declared-waiver report line ·
Q-3 needs no code either way.
