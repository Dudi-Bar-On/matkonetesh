# AI Model-Selection Registry + Gemini Text/TTS Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's single hard-coded Gemini model constant (`GEM_MODEL`) and the eight copy-pasted `thinkingConfig:{thinkingBudget:0}` fragments with a data-driven **role registry** (`GEM_MODELS`) + a per-usage **thinking layer**, so the text migration (`gemini-2.5-flash` → `gemini-3.6-flash`) and the TTS migration (`gemini-2.5-flash-preview-tts` → `gemini-3.1-flash-tts-preview`) each become a one-registry-row edit, guarded by a live preflight.

**Architecture:** A build-time `GEM_MODELS` registry maps a *role* (`text` | `tts`) to `{ id, kind, tier, think, caps }`. Resolvers `gemModel`/`gemId` read it. Request builders `gemGen(role, gen, opts)` (text — applies the model's thinking knob via `gemThink`) and `gemTtsGen(voice)` (audio) build per-`kind` payloads; response readers `gemReadText`/`gemReadAudio` are selected per `kind` and each guards its shape. The existing transport `gemFetch` gains one line that resolves a role→id at the top; everything below it (managed→BYOK→off routing, retry/backoff, key-in-header) is untouched. Thinking is an abstract scale (`minimal<low<medium<high`) translated per model — the 2.5/3.5 numeric `thinkingBudget` knob or the 3.x enum `thinkingLevel` knob, never both — driven by the owner-owned `AI_THINK` usage→level policy table.

**Tech Stack:** Single-file vanilla-JS PWA (`app.js` + `app.css` + a Python data layer, inlined by `python build.py` into `dist/index.html`). Tests: Playwright `page.evaluate` against the built app, exactly like `tests/wave3-ai-hardening.spec.ts` (behavioral — assert the emitted request body/URL and the reader outputs, never internals). The live preflight lives in the isolated `evals/` Playwright project (`npm run eval`), never in the mandated `npx playwright test` run.

**Authoritative design:** `docs/analysis/program/model-selection-architecture-design.md` (all 8 decisions LOCKED/approved). Migration facts: `docs/analysis/program/gemini-3.6-thinking-research.md` (text), `docs/analysis/program/tts-3.1-migration-research.md` (TTS).

## Global Constraints

*(Every task's requirements implicitly include this section. Values copied verbatim from the design + `CLAUDE.md`.)*

- **ONLINE-FIRST with an AI key** (owner decision 2026-07-22). **Single-file PWA** — `build.py` inlines `app.js`/`app.css`/the Python data layer into `dist/index.html`.
- **Hebrew-first (RTL), mobile-first — but THIS change is DEVELOPER-ONLY.** No user-facing string changes. TTS voice and AI answer **content** are unchanged. DoD 8 (screenshot) and DoD 9 (Hebrew check) are **N/A** for every task here — there is no visual or user-facing-string change; state that explicitly rather than skipping silently.
- **Safety invariance (DoD 10).** No `bcheck` stage, `temp`, `safe` value, or cook duration is touched. The recipe-MT numeric guard (`mtNumSig`/`mtSafe`/`mtGuard`, `app.js:6951-6958`) is the `dataMT` safety net and stays **unchanged**.
- **Thinking level is DEVELOPER-ONLY (decision 8).** No user toggle, no user-facing model picker (decision Q2/§3). `AI_THINK` is the single owner-edited policy table.
- **Registry is BUILD-TIME config-as-data (decision 1).** No managed-Worker runtime override. No `textStrong` row (decision 2 — YAGNI). No `gemText()`/`gemCall()` consolidation (decision 4 — deferred follow-up).
- **Never emit both thinking knobs.** `gemThink` returns exactly one shape (`thinkingLevel` XOR `thinkingBudget` XOR nothing) — the mutual-exclusivity 400 is structurally impossible.
- **Migrations are one-row edits, each independently revertable** (decision 3), with a commented `textLegacy` rollback pin.
- **Preflight is a pre-ship GATE (decision 5).** The `ListModels` + one-real-call-per-role preflight must pass green **before** the text/tts migrations are deployed.
- **Tests wait on conditions** (`waitForFunction`/`expect.poll`), never `waitForTimeout` (DoD 11).
- **Full suite via plain `npx playwright test`** — never `--workers`/`--retries` (DoD 12, §11a). The root config runs `python build.py` itself, so every suite run tests a fresh build. After a manual `python build.py`, **restart any manual `serve.js`** before a manual check; **stop the manual :8123 server** before running the suite.
- **Secrets never enter the repo.** The Gemini key for the live preflight is an owner-provisioned CI/env secret (`GEMINI_EVAL_KEY`), never committed, never echoed.

## Sequencing gate (safety-critical — read before starting)

Tasks 1–6 are **behavior-preserving on the current models** and may be committed locally on `main` freely. The **push that deploys** (Cloudflare Pages builds from `main`) is **Task 9**, and it is gated on the **Task-6 preflight passing green with a real key**. Do **not** deploy Tasks 7/8 (the actual model changes) until the preflight has confirmed both new ids exist and one real call per role succeeds. If the `GEMINI_EVAL_KEY` is unavailable when Tasks 7/8 are ready, **HALT and raise with the owner** — shipping a model change unverified is exactly the `gemini-3.6-flash` failure this work exists to prevent (an important, safety-adjacent decision; §10.8).

---

### Task 1: Model registry + resolvers (`GEM_MODELS`, `gemModel`, `gemId`)

Introduce the registry with rows pointing at the **current** ids (text = `gemini-2.5-flash` numeric-knob, tts = `gemini-2.5-flash-preview-tts` no-knob). Nothing reads it yet, so behavior is byte-identical. This is the seam every later task builds on.

**Files:**
- Modify: `app.js:4205-4206` (insert the registry between `const GEM_HOST=…` and `const GEM_MODEL=…`)
- Test: `tests/ai-model-registry.spec.ts` (create)

**Interfaces:**
- Consumes: nothing (foundational).
- Produces:
  - `GEM_MODELS` — `{ text:{id,kind:'text',tier,think:{knob:'budget'},caps}, tts:{id,kind:'audio',tier,voiceDefault,think:{knob:'none'},caps} }`
  - `gemModel(role) → row` (falls back to the `text` row for an unknown role)
  - `gemId(role) → string` (the concrete model id)

- [ ] **Step 1: Write the failing test**

Create `tests/ai-model-registry.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// Behavioral seam tests for the AI model-selection registry (design:
// docs/analysis/program/model-selection-architecture-design.md). Asserts the emitted
// request URL/body and reader outputs, exactly like tests/wave3-ai-hardening.spec.ts — never internals.

export const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof gemId==='function'`);
};

test('registry: gemId/gemModel resolve roles to concrete ids and default unknown roles to text', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    textId: gemId('text'),
    ttsId: gemId('tts'),
    textKind: gemModel('text').kind,
    ttsKind: gemModel('tts').kind,
    unknownId: gemId('nope'),
  })`) as any;
  expect(r.textId).toBe('gemini-2.5-flash');
  expect(r.ttsId).toBe('gemini-2.5-flash-preview-tts');
  expect(r.textKind).toBe('text');
  expect(r.ttsKind).toBe('audio');
  expect(r.unknownId).toBe('gemini-2.5-flash');   // unknown role falls back to the text row
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: FAIL — `gemId is not defined` (the registry does not exist yet).

- [ ] **Step 3: Write minimal implementation**

In `app.js`, immediately **after** line 4205 (`const GEM_HOST='https://generativelanguage.googleapis.com/v1beta/models/';`) and **before** line 4206 (`const GEM_MODEL='gemini-2.5-flash';…`), insert:

```js
// ── AI model registry: the single source of truth for model id + payload rule + response-reader kind.
// role → { id, kind, tier, think, caps }. A migration or a new model is a DATA edit here, not code
// (decision 1: build-time config-as-data, no runtime Worker override; decision 2: no `textStrong` row until a feature needs it).
const GEM_MODELS = {
  // 'text' still points at gemini-2.5-flash (NUMERIC thinking knob) until the migration flips it (Task 7).
  text: { id:'gemini-2.5-flash', kind:'text', tier:'fast',
          think:{ knob:'budget' },                 // 2.5/3.5 numeric budget; values from THINK_BUDGET (added by the thinking layer, Task 2)
          caps:{ search:true, jsonMode:true, jsonModeExcludesSearch:true } },
  tts:  { id:'gemini-2.5-flash-preview-tts', kind:'audio', tier:'tts', voiceDefault:'Kore',
          think:{ knob:'none' },                   // audio model — no thinking field is ever emitted
          caps:{ audio:true } },
  // textLegacy rollback pin (a commented row) is added by Task 6, once the migration is imminent.
};
function gemModel(role){ return GEM_MODELS[role] || GEM_MODELS.text; }
function gemId(role){ return gemModel(role).id; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite (DoD 12) and confirm no regression**

Run: `npx playwright test`
Expected: 100% green (the registry is defined-but-unread; behavior is identical). DoD 10 met: no plan/safety data touched. DoD 8/9 N/A (developer-only).

- [ ] **Step 6: Commit**

```bash
git add app.js tests/ai-model-registry.spec.ts
git commit -m "feat(ai): add GEM_MODELS role registry + gemModel/gemId (rows at current ids, behavior identical)"
```

---

### Task 2: Thinking layer (`THINK_ORDER`, `THINK_BUDGET`, `nearestLevel`, `warnClamp`, `gemThink`, `AI_THINK`, `thinkFor`)

The abstract per-usage thinking scale and its per-model translation. Tests use **throwaway registry roles** (`__b` budget, `__t` level) plus the stable `tts` (no-knob) role, so these assertions are *model-migration-stable* — the mechanism is tested here, the current `text` model's knob is tested in Task 1/7.

**Files:**
- Modify: `app.js` (insert the thinking layer immediately after the `GEM_MODELS` block from Task 1)
- Test: `tests/ai-model-registry.spec.ts` (append)

**Interfaces:**
- Consumes: `gemModel(role)`, `GEM_MODELS` (Task 1).
- Produces:
  - `THINK_ORDER = ['minimal','low','medium','high']`
  - `THINK_BUDGET = {minimal:0, low:512, medium:2048, high:8192}`
  - `nearestLevel(want, supported) → level` (nearest supported, preferring lower on a tie)
  - `warnClamp(role, requested, resolved)` (console.warn diagnostic)
  - `gemThink(role, level) → {thinkingLevel}|{thinkingBudget}|undefined`
  - `AI_THINK` — usage→`{level, floor?}` policy table
  - `thinkFor(usage) → level` (developer-only; no userPref knob)

- [ ] **Step 1: Write the failing tests**

Append to `tests/ai-model-registry.spec.ts` (`init` is already defined/exported in this file):

```ts
test('thinking: numeric-knob translation, no-knob returns nothing, unknown level floors to minimal', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__b = { kind:'text', think:{ knob:'budget' } };   // throwaway numeric-knob role (migration-stable)
    return {
      low: gemThink('__b','low'),
      minimal: gemThink('__b','minimal'),
      high: gemThink('__b','high'),
      tts: gemThink('tts','high') ?? 'UNDEF',
      bogus: gemThink('__b','not-a-level'),
    };
  })()`) as any;
  expect(r.low).toEqual({ thinkingBudget: 512 });
  expect(r.minimal).toEqual({ thinkingBudget: 0 });
  expect(r.high).toEqual({ thinkingBudget: 8192 });
  expect(r.tts).toBe('UNDEF');                    // knob:'none' → never a thinking field
  expect(r.bogus).toEqual({ thinkingBudget: 0 }); // unknown level → 'minimal' floor
});

test('thinking: enum-knob clamps to nearest supported preferring lower, and logs the clamp', async ({ page }) => {
  await init(page);
  const warnings: string[] = [];
  page.on('console', (m: any) => { if (m.text().includes('thinking level clamped')) warnings.push(m.text()); });
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__t = { kind:'text', think:{ knob:'level', levels:['minimal','medium'] } };
    const near = nearestLevel('low', ['minimal','medium']);   // low is equidistant → prefer lower → minimal
    const clamped = gemThink('__t','low');
    const exact = gemThink('__t','medium');                    // supported exactly → no clamp
    return { near, clamped, exact };
  })()`) as any;
  expect(r.near).toBe('minimal');
  expect(r.clamped).toEqual({ thinkingLevel: 'minimal' });
  expect(r.exact).toEqual({ thinkingLevel: 'medium' });
  await expect.poll(() => warnings.length).toBeGreaterThan(0);   // warnClamp fired for the clamp (not the exact match)
});

test('thinking: AI_THINK policy maps each usage to its approved level (§2.2.4)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    ask: thinkFor('ask'), diagnose: thinkFor('diagnose'), vcAsk: thinkFor('vcAsk'),
    eventPlan: thinkFor('eventPlan'), seasonRec: thinkFor('seasonRec'), dataMT: thinkFor('dataMT'),
    translate: thinkFor('translate'), vision: thinkFor('vision'), keyProbe: thinkFor('keyProbe'),
    centralTest: thinkFor('centralTest'), wcim: thinkFor('wcim'), unknown: thinkFor('whatever'),
  })`) as any;
  expect(r).toEqual({
    ask:'low', diagnose:'high', vcAsk:'low', eventPlan:'medium', seasonRec:'minimal', dataMT:'minimal',
    translate:'minimal', vision:'low', keyProbe:'minimal', centralTest:'minimal', wcim:'minimal', unknown:'minimal',
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: FAIL — `gemThink is not defined` / `thinkFor is not defined` / `nearestLevel is not defined`.

- [ ] **Step 3: Write minimal implementation**

In `app.js`, immediately after the `GEM_MODELS` + `gemModel`/`gemId` block from Task 1, insert:

```js
// ── Per-usage thinking level: one abstract scale (minimal<low<medium<high), translated per model.
const THINK_ORDER  = ['minimal','low','medium','high'];
const THINK_BUDGET = { minimal:0, low:512, medium:2048, high:8192 };   // representative budgets for the NUMERIC (2.5/3.5) knob
function warnClamp(role, requested, resolved){ try{ console.warn('[AI] thinking level clamped', role, requested, '→', resolved); }catch(e){} }
// nearest supported enum value, PREFERRING LOWER on a tie (cheaper; never an accidental cost/quality increase).
function nearestLevel(want, supported){
  const i = THINK_ORDER.indexOf(want);
  for(let d=0; d<THINK_ORDER.length; d++){
    const lo=THINK_ORDER[i-d]; if(lo && supported.indexOf(lo)>=0) return lo;   // lower checked first at equal distance
    const hi=THINK_ORDER[i+d]; if(hi && supported.indexOf(hi)>=0) return hi;
  }
  return supported[0];
}
// → the thinkingConfig object for a role at a level, or undefined when the model exposes no knob.
function gemThink(role, level){
  const t = gemModel(role).think || {knob:'none'};
  if(t.knob==='none') return undefined;                                   // TTS / non-thinking model → emit nothing
  let want = THINK_ORDER.indexOf(level)>=0 ? level : 'minimal';           // unknown/garbage → safe cheap floor
  if(t.knob==='level'){                                                    // Gemini 3.x enum
    if(t.levels && t.levels.indexOf(want)<0){ const got=nearestLevel(want, t.levels); warnClamp(role, level, got); want=got; }
    return { thinkingLevel: want };
  }
  if(t.knob==='budget'){                                                   // Gemini 2.5/3.5 numeric
    return { thinkingBudget: (t.map||THINK_BUDGET)[want] };
  }
  return undefined;
}
// The ONE owner-edited thinking/cost policy table (§2.2.2 / §2.2.4). `floor` = the level a future bounded
// user preference may never go below (decision 8: developer-only NOW, the toggle is deferred). `floor` is
// approved safety-floor metadata — do NOT drop it; it is intentionally not yet read by thinkFor.
const AI_THINK = {
  ask:        { level:'low',     floor:'low'    },   // grounded prose that can emit safety numbers → floored
  diagnose:   { level:'high',    floor:'medium' },   // highest-stakes reasoning → never cheap
  vcAsk:      { level:'low',     floor:'low'    },   // voice, safety-adjacent, latency-capped
  eventPlan:  { level:'medium'                  },
  wcim:       { level:'minimal'                 },
  seasonRec:  { level:'minimal'                 },
  dataMT:     { level:'minimal'                 },   // recipe MT — the numeric guard (mtNumSig) is the safety net
  translate:  { level:'minimal'                 },
  vision:     { level:'low'                     },   // advisory read; the probe decides
  keyProbe:   { level:'minimal'                 },
  centralTest:{ level:'minimal'                 },
};
function thinkFor(usage){ return (AI_THINK[usage]||{level:'minimal'}).level; }   // developer-only (decision 8): no userPref knob
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: 100% green (still nothing production reads the thinking layer). DoD 10 met; DoD 8/9 N/A.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/ai-model-registry.spec.ts
git commit -m "feat(ai): thinking layer — gemThink/nearestLevel/AI_THINK/thinkFor (abstract level → per-model knob)"
```

---

### Task 3: Request/response seam (`gemGen`, `gemTtsGen`, `gemReadText`, `gemReadAudio`) — consumed by `aiJSON` + `gemSpeak`

Create the four seam functions and **immediately wire their consumers** so nothing ships inert (`no-inert-shipment`): `aiJSON` uses `gemGen`+`gemReadText`; `gemSpeak` uses `gemTtsGen`+`gemReadAudio`. Ids stay literal (role resolution is Task 4), thinking stays `minimal` (→ current behavior). Every rewrite below is byte-identical in effect.

**Files:**
- Modify: `app.js` (insert the four functions after the thinking layer from Task 2)
- Modify: `app.js:4339` (aiJSON destructure — add `think='minimal'`)
- Modify: `app.js:4347-4358` (aiJSON `mkBody` — gen via `gemGen`)
- Modify: `app.js:4363-4367` (aiJSON `callOnce` — extractor via `gemReadText`)
- Modify: `app.js:5030,5033-5037` (gemSpeak — gen via `gemTtsGen`, decode via `gemReadAudio`)
- Test: `tests/ai-model-registry.spec.ts` (append)

**Interfaces:**
- Consumes: `gemModel`, `gemThink` (Tasks 1–2); `pcmToBuffer`, `b64ToPcm16` (`app.js:5013-5024`, hoisted).
- Produces:
  - `gemGen(role, gen, opts) → generationConfig` (applies `gemThink(role, opts.think||'minimal')`; never both knobs)
  - `gemTtsGen(voice) → {responseModalities, speechConfig}`
  - `gemReadText(json) → string` (throws `empty-<reason>`; guards its kind)
  - `gemReadAudio(json) → {buf: AudioBuffer, rate: number}` (throws `no-audio`; guards its kind)

- [ ] **Step 1: Write the failing tests**

Append to `tests/ai-model-registry.spec.ts`:

```ts
test('seam: gemGen applies the role thinking knob (default minimal) and never adds audio fields', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__b = { kind:'text', think:{ knob:'budget' } };   // migration-stable numeric role
    return {
      low: gemGen('__b', {temperature:0.8, maxOutputTokens:1600}, {think:'low'}),
      def: gemGen('__b', {maxOutputTokens:20}),                    // no opts → default think 'minimal'
      tts: gemGen('tts', {temperature:0.4}, {think:'high'}),
    };
  })()`) as any;
  expect(r.low).toEqual({ temperature:0.8, maxOutputTokens:1600, thinkingConfig:{ thinkingBudget:512 } });
  expect(r.def).toEqual({ maxOutputTokens:20, thinkingConfig:{ thinkingBudget:0 } });
  expect(r.tts.thinkingConfig).toBeUndefined();       // audio role → no thinking field
  expect(r.tts.responseModalities).toBeUndefined();   // gemGen does not add audio fields (that is gemTtsGen)
});

test('seam: gemTtsGen builds the audio generationConfig with the given voice or the tts default', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({ withVoice: gemTtsGen('Puck'), fallback: gemTtsGen() })`) as any;
  expect(r.withVoice).toEqual({ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:'Puck' } } } });
  expect(r.fallback.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');   // gemModel('tts').voiceDefault
});

test('seam: gemReadText joins text parts, throws with the finishReason when empty, guards its kind', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    const ok = gemReadText({candidates:[{content:{parts:[{text:'hello '},{text:'world'}]}}]});
    let emptyErr='none'; try{ gemReadText({candidates:[{content:{parts:[{text:''}]},finishReason:'SAFETY'}]}); }catch(e){ emptyErr=String(e.message); }
    let audioErr='none'; try{ gemReadText({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:''}}]}}]}); }catch(e){ audioErr=String(e.message); }
    return { ok, emptyErr, audioErr };
  })()`) as any;
  expect(r.ok).toBe('hello world');
  expect(r.emptyErr).toBe('empty-SAFETY');
  expect(r.audioErr).toContain('empty');   // an audio-only response has no text → guarded, not returned as ''
});

test('seam: gemReadAudio decodes PCM inlineData to a buffer and throws no-audio on a text-only response', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    const pcm=new Int16Array([0, 16384, -16384]);
    const bytes=new Uint8Array(pcm.buffer); let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
    const b64=btoa(s);
    const out=gemReadAudio({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000', data:b64}}]}}]});
    let textErr='none'; try{ gemReadAudio({candidates:[{content:{parts:[{text:'hi'}]}}]}); }catch(e){ textErr=String(e.message); }
    return { rate: out.rate, len: out.buf.length, isBuf: (typeof AudioBuffer!=='undefined' && out.buf instanceof AudioBuffer), textErr };
  })()`) as any;
  expect(r.rate).toBe(24000);
  expect(r.len).toBe(3);
  expect(r.isBuf).toBe(true);
  expect(r.textErr).toBe('no-audio');   // a text response has no inlineData → guarded
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: FAIL — `gemGen is not defined` / `gemTtsGen is not defined` / `gemReadText is not defined` / `gemReadAudio is not defined`.

- [ ] **Step 3: Write minimal implementation**

**(3a)** In `app.js`, after the thinking layer from Task 2, insert the four seam functions:

```js
// ── REQUEST/RESPONSE seam. text and audio share the registry + transport but never a builder or a reader.
// REQUEST — text roles: normalize a base generationConfig, applying the model's thinking knob exactly once.
function gemGen(role, gen, opts){
  const out = Object.assign({}, gen||{});
  const tc = gemThink(role, (opts && opts.think) || 'minimal');
  if(tc) out.thinkingConfig = tc; else delete out.thinkingConfig;   // one knob or none → the mutual-exclusivity 400 is impossible
  return out;
}
// REQUEST — audio role: the TTS-shaped generationConfig, in ONE builder.
function gemTtsGen(voice){
  return { responseModalities:['AUDIO'],
           speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName: voice || gemModel('tts').voiceDefault } } } };
}
// RESPONSE — kind:'text' reader (dedups the hand-rolled extractors; guards its kind).
function gemReadText(json){
  const c = json && json.candidates && json.candidates[0];
  const t = c && c.content && (c.content.parts||[]).map(function(p){return p.text||'';}).join('').trim();
  if(!t){ const fr=(c&&c.finishReason)||(json&&json.promptFeedback&&json.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
  return t;
}
// RESPONSE — kind:'audio' reader (the app.js:5033-5037 decode, in ONE place; guards its kind).
function gemReadAudio(json){
  const c = json && json.candidates && json.candidates[0];
  const part = c && c.content && c.content.parts.find(function(p){return p.inlineData;});
  if(!part) throw new Error('no-audio');
  const rate = parseInt((part.inlineData.mimeType.match(/rate=(\d+)/)||[])[1] || '24000');
  return { buf: pcmToBuffer(b64ToPcm16(part.inlineData.data), rate), rate };
}
```

**(3b)** Wire `gemGen`+`gemReadText` into `aiJSON`. Change the destructure at `app.js:4339`:

```js
// BEFORE
  const {task, schemaHint, grounding='', temperature=0.4, maxTokens=1200, search=false}=opts||{};
// AFTER
  const {task, schemaHint, grounding='', temperature=0.4, maxTokens=1200, search=false, think='minimal'}=opts||{};
```

Change `mkBody` at `app.js:4351` (inside `mkBody=()=>{ … }`):

```js
// BEFORE
    const gen={temperature,maxOutputTokens:maxTokens,thinkingConfig:{thinkingBudget:0}};
    if(!search) gen.responseMimeType='application/json';
// AFTER
    const gen=gemGen('text', {temperature,maxOutputTokens:maxTokens}, {think});   // 'text' still resolves to 2.5-flash; minimal→thinkingBudget:0 (identical)
    if(!search) gen.responseMimeType='application/json';
```

Change `callOnce` at `app.js:4363-4367`:

```js
// BEFORE
    const j=await r.json();
    const cand=j.candidates&&j.candidates[0];
    const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
    if(!txt){ const fr=(cand&&cand.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
    return txt;
// AFTER
    const j=await r.json();
    return gemReadText(j);
```

**(3c)** Wire `gemTtsGen`+`gemReadAudio` into `gemSpeak` (id literal kept for now). Change `app.js:5030`:

```js
// BEFORE
    const r=await gemFetch('gemini-2.5-flash-preview-tts', {contents:[{parts:[{text:clean}]}], generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:gemVoice()}}}}}, {timeout:20000});
// AFTER
    const r=await gemFetch('gemini-2.5-flash-preview-tts', {contents:[{parts:[{text:clean}]}], generationConfig: gemTtsGen(gemVoice())}, {timeout:20000});
```

Change `app.js:5033-5037` (leave the `if(!r.ok){…}` block above it at 5031-5032 unchanged):

```js
// BEFORE
    const j=await r.json();
    const part=j.candidates&&j.candidates[0]&&j.candidates[0].content.parts.find(p=>p.inlineData);
    if(!part) throw new Error('no-audio');
    const rate=parseInt((part.inlineData.mimeType.match(/rate=(\d+)/)||[])[1]||'24000');
    buf=pcmToBuffer(b64ToPcm16(part.inlineData.data), rate);
// AFTER
    const j=await r.json();
    buf=gemReadAudio(j).buf;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full suite (DoD 12) — regression on the refactored consumers**

Run: `npx playwright test`
Expected: 100% green. `tests/ai-trust.spec.ts` (which stubs `window.gemFetch` and exercises `aiJSON`/`aiSeasonRec`/etc.) proves `aiJSON`'s `gemGen`/`gemReadText` refactor is behavior-preserving. DoD 10 met (mtNumSig untouched); DoD 8/9 N/A.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/ai-model-registry.spec.ts
git commit -m "feat(ai): request/response seam (gemGen/gemTtsGen/gemReadText/gemReadAudio); wire aiJSON + gemSpeak"
```

---

### Task 4: `gemFetch` resolves role→id at the top

One added line lets `gemFetch('text', …)` / `gemFetch('tts', …)` resolve to the concrete id, while literal ids still pass through (so the wave3 transport tests and `askValidateKey`'s raw-key probe keep working). Transport, routing, retry/backoff — all untouched.

**Files:**
- Modify: `app.js:4208-4214` (gemFetch: resolve at top, use resolved id in both URL branches)
- Test: `tests/wave3-ai-hardening.spec.ts` (append one transport test)

**Interfaces:**
- Consumes: `GEM_MODELS`, `GEM_MODEL`, `gemId` (Task 1); `GEM_URL`, `centralUrl` (existing).
- Produces: `gemFetch(roleOrId, body, opts)` — first arg may now be a registry role **or** a literal id.

- [ ] **Step 1: Write the failing test**

Append to `tests/wave3-ai-hardening.spec.ts` (its `init` is defined at the top of that file):

```ts
test('transport: gemFetch resolves a registry role to its concrete model id in the request URL', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(async function(){
    store.set('mk-gemkey','K');
    const urls=[];
    window.fetch = async (url, opts)=>{ urls.push(url); return { ok:true, status:200, json: async()=>({}) }; };
    await gemFetch('text', {contents:[]}, {retries:0});
    await gemFetch('tts', {contents:[]}, {retries:0});
    await gemFetch('gemini-2.5-flash-preview-tts', {contents:[]}, {retries:0});   // a literal id must still pass through
    return { urls, textId: gemId('text'), ttsId: gemId('tts') };
  })()`) as any;
  expect(r.urls[0]).toContain(r.textId + ':generateContent');   // 'text' → concrete id
  expect(r.urls[1]).toContain(r.ttsId + ':generateContent');    // 'tts'  → concrete id
  expect(r.urls[2]).toContain('gemini-2.5-flash-preview-tts:generateContent');   // literal passthrough
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/wave3-ai-hardening.spec.ts -g "resolves a registry role"`
Expected: FAIL — `urls[0]` contains `text:generateContent` (the role string passed straight through), not `gemini-2.5-flash:generateContent`.

- [ ] **Step 3: Write minimal implementation**

In `app.js`, add the resolver line after `opts=opts||{};` (line 4209), and use the resolved id `mdl` in the URL builders at line 4214:

```js
// BEFORE (4208-4214)
async function gemFetch(model, body, opts){
  opts=opts||{};
  // transport: MANAGED … → BYOK … → off.
  const mode = opts.key ? 'byok' : gemMode();
  if(mode==='off') throw new Error('no-key');
  const url = (mode==='managed') ? (centralUrl()+'/v1beta/models/'+(model||GEM_MODEL)+':generateContent') : GEM_URL(model);
// AFTER
async function gemFetch(model, body, opts){
  opts=opts||{};
  const mdl = GEM_MODELS[model] ? GEM_MODELS[model].id : (model||GEM_MODEL);   // role → concrete id; a literal id passes through
  // transport: MANAGED … → BYOK … → off.
  const mode = opts.key ? 'byok' : gemMode();
  if(mode==='off') throw new Error('no-key');
  const url = (mode==='managed') ? (centralUrl()+'/v1beta/models/'+mdl+':generateContent') : GEM_URL(mdl);
```

Leave the managed→BYOK recursion at line 4226 (`return gemFetch(model, body, …)`) unchanged — it re-enters and re-resolves idempotently.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/wave3-ai-hardening.spec.ts`
Expected: PASS (the new test + all four existing transport tests, which pass `GEM_MODEL` — a literal id that still passes through).

- [ ] **Step 5: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: 100% green. DoD 10 met; DoD 8/9 N/A.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/wave3-ai-hardening.spec.ts
git commit -m "feat(ai): gemFetch resolves a registry role to its model id at the top (literal ids pass through)"
```

---

### Task 5: Wire all 9 call sites to roles + their `AI_THINK` levels (still on current model ids)

Flip every literal `GEM_MODEL`/TTS-literal call to a **role**, build each `generationConfig` via `gemGen`/`gemTtsGen`, and thread each site's `AI_THINK` level (§2.2.4). Still on `gemini-2.5-flash`/`preview-tts`, so the suite stays green — this proves the seam is behavior-preserving **before** any model change. Re-point the wave3 seam test and the `GEM_MODEL` alias.

**Files:**
- Modify: `app.js:4206` (repoint `GEM_MODEL` to the registry alias)
- Modify: `app.js:4250,4252,4255-4257` (askGemini — #1, usage `ask`)
- Modify: `app.js:4261` (askValidateKey — #2, usage `keyProbe`)
- Modify: `app.js:4361` (aiJSON callOnce — #3, gemFetch role)
- Modify: `app.js:8479` (aiDiagnose — #3a, usage `diagnose`)
- Modify: `app.js:8318` (aiPlanEvent — #3b, usage `eventPlan`)
- Modify: `app.js:4554` (central-access test — #4, usage `centralTest`)
- Modify: `app.js:5030` (gemSpeak — #5, role `tts`)
- Modify: `app.js:5195-5196` (vcTranslateToEn — #6, usage `translate`)
- Modify: `app.js:5279-5280` (vcAskAI — #7, usage `vcAsk`)
- Modify: `app.js:6974-6975` (mtTranslate — #8, usage `dataMT`)
- Modify: `app.js:9299-9300` (gemVision — #9, usage `vision`)
- Modify: `tests/wave3-ai-hardening.spec.ts:59-66` (re-point the seam test to `gemId(...)`)
- Test: `tests/ai-model-registry.spec.ts` (append the wiring behavioral test)

**Interfaces:**
- Consumes: `gemGen`, `gemTtsGen`, `gemReadText`, `thinkFor`, `gemId` (Tasks 1–3); `gemFetch` role resolution (Task 4).
- Produces: no new symbols. Sites #3c (`aiSeasonRec`, `wcimAI`, `pantryAdvisorAI`) and the unmapped `aiLookupDevice`/`aiBrandModels`/`aiGenerateRecipe`/`aiJournalInsights` keep `aiJSON`'s default `think:'minimal'` (§2.2.4 row 3 — callers override only upward).

- [ ] **Step 1: Write the failing test**

Append to `tests/ai-model-registry.spec.ts`:

```ts
test('wiring: text sites emit role text + their AI_THINK level; TTS emits audio + no thinking', async ({ page }) => {
  await init(page);
  await page.evaluate(`typeof aiAvail`);   // ensure app globals are present
  const r = await page.evaluate(`(async function(){
    store.set('mk-gemkey','K');
    const cap={};
    window.gemFetch = async (model, body, opts)=>{
      (cap[model]=cap[model]||[]).push(body);
      if(model==='tts') return { ok:false, status:503, json:async()=>({}) };   // capture the request, skip WebAudio playback
      return { ok:true, status:200, json:async()=>({ candidates:[{ content:{ parts:[
        { text:'{"diagnosis":"x","causes":[],"fixes":[],"related":[],"guests":2,"appetite":"reg","kosher":false,"keys":[],"sides":[],"drinks":[],"desserts":[],"rationale":"r","recommend":[]}' }
      ]}}]}); };
    };
    await askGemini('כמה זמן לעשן חזה?', []);          // #1 ask → low
    try{ await gemSpeak('שלום', 'he'); }catch(e){}       // #5 tts → api-503 after capture, no playback
    await aiDiagnose('הבשר יבש');                         // #3a diagnose → high
    await aiPlanEvent('ארוחה ל-8 אנשים');                // #3b eventPlan → medium
    await aiJSON({task:'t', schemaHint:'{}'});           // #3 default → minimal
    return {
      roles: Object.keys(cap).sort(),
      textThinking: (cap['text']||[]).map(b=> b.generationConfig.thinkingConfig),
      ttsGen: cap['tts'] ? cap['tts'][0].generationConfig : null,
    };
  })()`) as any;
  expect(r.roles).toEqual(['text','tts']);                       // every caller went out as a ROLE, not a literal id
  // order: askGemini, aiDiagnose, aiPlanEvent, aiJSON — on 2.5-flash the knob is the NUMERIC budget
  expect(r.textThinking).toEqual([
    { thinkingBudget: 512 },    // ask = low
    { thinkingBudget: 8192 },   // diagnose = high
    { thinkingBudget: 2048 },   // eventPlan = medium
    { thinkingBudget: 0 },      // aiJSON default = minimal
  ]);
  expect(r.ttsGen.responseModalities).toEqual(['AUDIO']);        // audio modality
  expect(r.ttsGen.thinkingConfig).toBeUndefined();               // TTS carries no thinking field
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/ai-model-registry.spec.ts -g "wiring: text sites"`
Expected: FAIL — before wiring, `cap` is keyed by the literal ids (`gemini-2.5-flash`/`gemini-2.5-flash-preview-tts`), so `r.roles` is not `['text','tts']`; and `askGemini`/`aiDiagnose`/… still send `thinkingBudget:0`, so `r.textThinking` is `[{thinkingBudget:0},{thinkingBudget:0},{thinkingBudget:0},{thinkingBudget:0}]`.

- [ ] **Step 3: Write the implementation (all 9 sites + alias + seam test re-point)**

**(5a)** Repoint the `GEM_MODEL` alias at `app.js:4206`:

```js
// BEFORE
const GEM_MODEL='gemini-2.5-flash';   // 3.6-flash REVERTED 2026-07-23: returned api-400 on EVERY call via the Gemini Developer API (generativelanguage). 'gemini-3.6-flash' is not a valid id on this endpoint (likely Vertex-only). Migration still owed before the 2.5 shutdown (2026-10-16) — needs ListModels to find the correct developer-API id first.
// AFTER
const GEM_MODEL = gemId('text');   // back-compat alias only — GEM_MODELS.text (above) is the source of truth; every call site now passes a ROLE, not this constant.
```

**(5b)** askGemini (#1). At `app.js:4250` change the `generationConfig`; at `4252` the call; at `4255-4257` the extractor:

```js
// 4250 BEFORE:  generationConfig:{temperature:0.8,maxOutputTokens:1600,thinkingConfig:{thinkingBudget:0}}
// 4250 AFTER:
    generationConfig: gemGen('text', {temperature:0.8, maxOutputTokens:1600}, {think: thinkFor('ask')})
// 4252 BEFORE:  const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
// 4252 AFTER:
  const r=await gemFetch('text', body, {timeout:30000});
// 4255-4257 BEFORE:
//   const cand=j.candidates&&j.candidates[0];
//   const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
//   if(!txt){ const fr=(cand&&cand.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
// 4255-4257 AFTER (behavior-identical — gemReadText throws the same 'empty-'+fr):
  const txt=gemReadText(j);
```

**(5c)** askValidateKey (#2) at `app.js:4261`:

```js
// BEFORE
  try{ await gemFetch(GEM_MODEL, {contents:[{parts:[{text:'שלום'}]}],generationConfig:{maxOutputTokens:20,thinkingConfig:{thinkingBudget:0}}}, {key, retries:0, timeout:12000}); return true; }catch(e){ return false; }
// AFTER
  try{ await gemFetch('text', {contents:[{parts:[{text:'שלום'}]}], generationConfig: gemGen('text', {maxOutputTokens:20}, {think: thinkFor('keyProbe')})}, {key, retries:0, timeout:12000}); return true; }catch(e){ return false; }
```

**(5d)** aiJSON callOnce (#3) at `app.js:4361`:

```js
// BEFORE
    const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
// AFTER
    const r=await gemFetch('text', body, {timeout:30000});
```

**(5e)** aiDiagnose (#3a) at `app.js:8479`:

```js
// BEFORE
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.4,maxTokens:1100});
// AFTER
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.4,maxTokens:1100, think: thinkFor('diagnose')});
```

**(5f)** aiPlanEvent (#3b) at `app.js:8318`:

```js
// BEFORE
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1500});
// AFTER
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1500, think: thinkFor('eventPlan')});
```

**(5g)** central-access test (#4) at `app.js:4554`:

```js
// BEFORE
    try{ await gemFetch(GEM_MODEL, {contents:[{parts:[{text:'שלום'}]}], generationConfig:{maxOutputTokens:5, thinkingConfig:{thinkingBudget:0}}}, {retries:0, timeout:15000}); …
// AFTER
    try{ await gemFetch('text', {contents:[{parts:[{text:'שלום'}]}], generationConfig: gemGen('text', {maxOutputTokens:5}, {think: thinkFor('centralTest')})}, {retries:0, timeout:15000}); …
```

**(5h)** gemSpeak (#5) at `app.js:5030` — swap the TTS literal for the role (gen already uses `gemTtsGen` from Task 3):

```js
// BEFORE
    const r=await gemFetch('gemini-2.5-flash-preview-tts', {contents:[{parts:[{text:clean}]}], generationConfig: gemTtsGen(gemVoice())}, {timeout:20000});
// AFTER
    const r=await gemFetch('tts', {contents:[{parts:[{text:clean}]}], generationConfig: gemTtsGen(gemVoice())}, {timeout:20000});
```

**(5i)** vcTranslateToEn (#6) at `app.js:5195-5196`:

```js
// 5195 BEFORE:    generationConfig:{temperature:0.2,maxOutputTokens:300,thinkingConfig:{thinkingBudget:0}} };
// 5195 AFTER:
    generationConfig: gemGen('text', {temperature:0.2, maxOutputTokens:300}, {think: thinkFor('translate')}) };
// 5196 BEFORE:  const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
// 5196 AFTER:
  const r=await gemFetch('text', body, {timeout:30000});
```

**(5j)** vcAskAI (#7) at `app.js:5279-5280`:

```js
// 5279 BEFORE:    generationConfig:{temperature:0.6,maxOutputTokens:400,thinkingConfig:{thinkingBudget:0}} };
// 5279 AFTER:
    generationConfig: gemGen('text', {temperature:0.6, maxOutputTokens:400}, {think: thinkFor('vcAsk')}) };
// 5280 BEFORE:  const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
// 5280 AFTER:
  const r=await gemFetch('text', body, {timeout:30000});
```

**(5k)** mtTranslate (#8) at `app.js:6974-6975`:

```js
// 6974 BEFORE:        contents:[{role:'user',parts:[{text:src}]}], generationConfig:{temperature:0.2,maxOutputTokens:600,thinkingConfig:{thinkingBudget:0}} };
// 6974 AFTER:
        contents:[{role:'user',parts:[{text:src}]}], generationConfig: gemGen('text', {temperature:0.2, maxOutputTokens:600}, {think: thinkFor('dataMT')}) };
// 6975 BEFORE:      const r=await gemFetch(GEM_MODEL, body, {timeout:20000}); const j=await r.json();
// 6975 AFTER:
      const r=await gemFetch('text', body, {timeout:20000}); const j=await r.json();
```

**(5l)** gemVision (#9) at `app.js:9299-9300`:

```js
// 9299 BEFORE:  const body={ contents:[{parts:[{inlineData:{mimeType:m[1], data:m[2]}}, {text:prompt}]}], generationConfig:{temperature:0.4, maxOutputTokens:800, thinkingConfig:{thinkingBudget:0}} };
// 9299 AFTER:
  const body={ contents:[{parts:[{inlineData:{mimeType:m[1], data:m[2]}}, {text:prompt}]}], generationConfig: gemGen('text', {temperature:0.4, maxOutputTokens:800}, {think: thinkFor('vision')}) };
// 9300 BEFORE:  const r=await gemFetch(GEM_MODEL, body, {timeout:40000}); if(!r.ok) throw new Error('api-'+r.status);
// 9300 AFTER:
  const r=await gemFetch('text', body, {timeout:40000}); if(!r.ok) throw new Error('api-'+r.status);
```

**(5m)** Re-point the wave3 seam test at `tests/wave3-ai-hardening.spec.ts:59-66` so it asserts through the registry (survives the migration):

```ts
// BEFORE
test('seam: GEM_URL centralizes the endpoint and defaults the model (no key in URL)', async ({ page }) => {
  await init(page);
  const d = await page.evaluate(`GEM_URL()`) as string;
  const t = await page.evaluate(`GEM_URL('gemini-2.5-flash-preview-tts')`) as string;
  expect(d).toContain('gemini-2.5-flash:generateContent');   // 3.6-flash reverted (api-400 on the developer API); still on 2.5 pending the correct 3.x id
  expect(t).toContain('preview-tts:generateContent');
  expect(d).not.toContain('key=');
});
// AFTER
test('seam: GEM_URL centralizes the endpoint and resolves registry roles (no key in URL)', async ({ page }) => {
  await init(page);
  const ids = await page.evaluate(`({ text: gemId('text'), tts: gemId('tts') })`) as any;
  const d = await page.evaluate(`GEM_URL(gemId('text'))`) as string;
  const t = await page.evaluate(`GEM_URL(gemId('tts'))`) as string;
  expect(d).toContain(ids.text + ':generateContent');   // tracks the registry across the migration
  expect(t).toContain(ids.tts + ':generateContent');
  expect(d).not.toContain('key=');
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/ai-model-registry.spec.ts tests/wave3-ai-hardening.spec.ts`
Expected: PASS (wiring test + re-pointed seam test).

- [ ] **Step 5: Full suite (DoD 12) — the seam is proven behavior-preserving on the CURRENT models**

Run: `npx playwright test`
Expected: 100% green. `gemini-2.5-flash` accepts every `thinkingBudget` value emitted here, so no site regresses. DoD 10 met (no plan/safety data; `mtNumSig` untouched); DoD 8/9 N/A.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/ai-model-registry.spec.ts tests/wave3-ai-hardening.spec.ts
git commit -m "feat(ai): wire all 9 call sites to roles + AI_THINK levels; re-point wave3 seam test to gemId()"
```

---

### Task 6: Migration preflight (`ListModels` + one-real-call-per-role) + the `textLegacy` rollback pin

The pre-ship GATE (decision 5). A deterministic helper `modelIsListed` (RED/GREEN witnessed with no key) plus a key-gated live spec in the isolated `evals/` project that confirms each role's id **exists** on the developer API and that **one real call per role** succeeds through the app's own payload builders (text → non-empty text; tts → a real `inlineData` audio part). Also adds the commented `textLegacy` row so the text migration can be flipped back in one line.

**Files:**
- Create: `evals/lib/preflight.ts` (the `modelIsListed` helper)
- Create: `evals/tests/preflight.spec.ts` (deterministic helper test + key-gated live preflight)
- Modify: `app.js` (add the commented `textLegacy` row inside `GEM_MODELS`)

**Interfaces:**
- Consumes: `gemId`, `gemGen`, `gemTtsGen`, `gemReadText`, `gemReadAudio`, `gemFetch`, `gemVoice` (Tasks 1–5, in-page).
- Produces: `modelIsListed(list, id) → boolean`.

- [ ] **Step 1: Write the failing test**

Create `evals/tests/preflight.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { modelIsListed } from '../lib/preflight';

// PRE-4 / decision 5 — the model-migration preflight. The helper test is deterministic (no key). The live
// test confirms each role id EXISTS (ListModels) and one REAL call per role succeeds through the app's own
// payload builders — the check that catches the thinkingBudget/thinkingLevel 400 that shipped on gemini-3.6.
const LIVE_KEY = process.env.GEMINI_EVAL_KEY || process.env.GEMINI_API_KEY || '';

test('preflight helper: modelIsListed matches a ListModels entry by bare id or models/<id> name', () => {
  const list = { models: [ { name: 'models/gemini-3.6-flash' }, { name: 'models/gemini-3.1-flash-tts-preview' } ] };
  expect(modelIsListed(list, 'gemini-3.6-flash')).toBe(true);
  expect(modelIsListed(list, 'gemini-3.1-flash-tts-preview')).toBe(true);
  expect(modelIsListed(list, 'gemini-9.9-imaginary')).toBe(false);
  expect(modelIsListed({}, 'gemini-3.6-flash')).toBe(false);
});

const bootLive = async (page: any, key: string) => {
  await page.addInitScript((k: string) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gemkey', JSON.stringify(k));
  } catch {} }, key);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof gemId==='function' && typeof gemGen==='function' && typeof gemTtsGen==='function' && typeof gemReadAudio==='function'`);
};

test('preflight LIVE: each role id is listed AND one real call per role returns its kind', async ({ page }) => {
  test.skip(!LIVE_KEY,
    'No live key (GEMINI_EVAL_KEY / GEMINI_API_KEY). The model-migration preflight is a pre-ship GATE ' +
    '(decision 5) and needs the owner-provisioned key. This skip is EXPECTED with no key — it is visible, not a silent pass.');
  await bootLive(page, LIVE_KEY);
  const ids = await page.evaluate(`({ text: gemId('text'), tts: gemId('tts') })`) as any;

  // 1) ListModels — confirm each id EXISTS on the developer API (kills the "invalid id" red herring, §5)
  const listRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': LIVE_KEY } });
  const list = await listRes.json();
  expect(modelIsListed(list, ids.text)).toBe(true);
  expect(modelIsListed(list, ids.tts)).toBe(true);

  // 2) One REAL call per role, through the app's own builders (catches the payload 400 the id check would miss)
  const textOut = await page.evaluate(`(async function(){
    const body={ contents:[{role:'user',parts:[{text:'Say the single word OK.'}]}], generationConfig: gemGen('text', {maxOutputTokens:16}, {think:'minimal'}) };
    const r = await gemFetch('text', body, {retries:0, timeout:30000});
    if(!r.ok) throw new Error('text api-'+r.status);
    return gemReadText(await r.json());
  })()`) as string;
  expect(textOut.trim().length).toBeGreaterThan(0);   // text role → non-empty text

  const audio = await page.evaluate(`(async function(){
    const body={ contents:[{parts:[{text:'שלום'}]}], generationConfig: gemTtsGen(gemVoice()) };
    const r = await gemFetch('tts', body, {retries:0, timeout:30000});
    if(!r.ok) throw new Error('tts api-'+r.status);
    const out = gemReadAudio(await r.json());
    return { rate: out.rate, len: out.buf.length };
  })()`) as any;
  expect(audio.len).toBeGreaterThan(0);    // tts role → a real inlineData audio part decoded to samples
  expect(audio.rate).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run eval -- -g "preflight helper"`
Expected: FAIL — `Cannot find module '../lib/preflight'` (the helper does not exist yet).

- [ ] **Step 3: Write minimal implementation**

**(6a)** Create `evals/lib/preflight.ts`:

```ts
// Model-migration preflight helper (design: PRE-4-eval-harness-design.md; decision 5). Pure + deterministic
// so it is RED/GREEN witnessed with no key; the live ListModels/real-call checks live in evals/tests/preflight.spec.ts.
export interface ListModelsResponse { models?: Array<{ name?: string }>; }

/** True if the developer-API ListModels response contains the given model id (bare, or as `models/<id>`). */
export function modelIsListed(list: ListModelsResponse, id: string): boolean {
  const models = (list && list.models) || [];
  return models.some(m => typeof m?.name === 'string' && (m.name === id || m.name.endsWith('/' + id)));
}
```

**(6b)** In `app.js`, add the commented rollback pin inside `GEM_MODELS`, immediately after the `tts` row (replacing the `// textLegacy … Task 6` placeholder comment left in Task 1):

```js
  // ROLLBACK PIN (decision 3): the outgoing text model, kept as a one-line flip-back. To roll the text
  // migration back, swap this object into the `text` row above. It uses the 2.5/3.5 NUMERIC knob.
  // textLegacy: { id:'gemini-2.5-flash', kind:'text', tier:'fast',
  //               think:{ knob:'budget', map:{minimal:0, low:512, medium:2048, high:8192} },
  //               caps:{ search:true, jsonMode:true, jsonModeExcludesSearch:true } },
```

- [ ] **Step 4: Run tests to verify pass / visible skip**

Run: `npm run eval`
Expected: `preflight helper …` PASS; `preflight LIVE …` **SKIPPED** with its reason printed (visible — this repo has no key). The commented `textLegacy` row is inert (a comment) so the Task 1 registry tests are unaffected.

- [ ] **Step 5: Full suite (DoD 12) — confirm the root suite is untouched**

Run: `npx playwright test`
Expected: 100% green. Task 6 adds only `evals/` files (never discovered by the root config) + one app.js comment. DoD 10 met; DoD 8/9 N/A.

- [ ] **Step 6: Commit**

```bash
git add evals/lib/preflight.ts evals/tests/preflight.spec.ts app.js
git commit -m "feat(ai): migration preflight (ListModels + one-real-call-per-role) + textLegacy rollback pin"
```

---

### Task 7: MIGRATION — flip the `text` row to `gemini-3.6-flash`

The text migration: one registry row changes **id** (`gemini-2.5-flash` → `gemini-3.6-flash`) and **knob** (`budget` → `level`), so every text site's thinking now translates to the 3.x `thinkingLevel` enum — never the `thinkingBudget:0` that 3.6 rejects. Isolated and revertable (flip the `textLegacy` pin back). Verified: `gemini-3.6-flash` is a valid developer-API id and `thinkingLevel:'minimal'` yields 0 thinking tokens on short calls (`gemini-3.6-thinking-research.md`).

> **GATE:** do not deploy this beyond local commits until the Task-6 preflight has passed green against `gemini-3.6-flash` (decision 5 / Sequencing gate).

**Files:**
- Modify: `app.js` (the `text` row in `GEM_MODELS`)
- Modify: `tests/ai-model-registry.spec.ts` (update the two migration-sensitive assertions — the `text` id, and the wiring test's thinking encoding)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `gemId('text') === 'gemini-3.6-flash'`; `gemThink('text', level) → {thinkingLevel: level}`.

- [ ] **Step 1: Update the failing tests**

**(7a)** In `tests/ai-model-registry.spec.ts`, update the Task 1 registry test's text-id assertion and add the level-knob assertions:

```ts
// in 'registry: gemId/gemModel resolve roles …' — change:
  expect(r.textId).toBe('gemini-2.5-flash');
// to:
  expect(r.textId).toBe('gemini-3.6-flash');
// and change the fallback assertion:
  expect(r.unknownId).toBe('gemini-2.5-flash');
// to:
  expect(r.unknownId).toBe('gemini-3.6-flash');
```

Add a new migration test:

```ts
test('migration(text): text resolves to gemini-3.6-flash and emits the thinkingLevel enum (never thinkingBudget)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    id: gemId('text'),
    minimal: gemThink('text','minimal'),
    high: gemThink('text','high'),
    gen: gemGen('text', {temperature:0.8, maxOutputTokens:1600}, {think:'low'}),
  })`) as any;
  expect(r.id).toBe('gemini-3.6-flash');
  expect(r.minimal).toEqual({ thinkingLevel: 'minimal' });   // 3.x enum — 0 thinking tokens on short calls
  expect(r.high).toEqual({ thinkingLevel: 'high' });
  expect(r.gen).toEqual({ temperature:0.8, maxOutputTokens:1600, thinkingConfig:{ thinkingLevel:'low' } });
  expect(r.gen.thinkingConfig.thinkingBudget).toBeUndefined();   // never the knob 3.6 rejects
});
```

**(7b)** In the Task 5 wiring test (`'wiring: text sites emit role text …'`), update the thinking encoding from the numeric budget to the enum level (the observable effect of the migration):

```ts
// change:
  expect(r.textThinking).toEqual([
    { thinkingBudget: 512 }, { thinkingBudget: 8192 }, { thinkingBudget: 2048 }, { thinkingBudget: 0 },
  ]);
// to:
  expect(r.textThinking).toEqual([
    { thinkingLevel: 'low' },      // ask
    { thinkingLevel: 'high' },     // diagnose
    { thinkingLevel: 'medium' },   // eventPlan
    { thinkingLevel: 'minimal' },  // aiJSON default
  ]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: FAIL — the registry still returns `gemini-2.5-flash` / `{thinkingBudget:…}` (the row is not flipped yet).

- [ ] **Step 3: Write minimal implementation**

In `app.js`, change the `text` row of `GEM_MODELS`:

```js
// BEFORE
  text: { id:'gemini-2.5-flash', kind:'text', tier:'fast',
          think:{ knob:'budget' },
          caps:{ search:true, jsonMode:true, jsonModeExcludesSearch:true } },
// AFTER
  text: { id:'gemini-3.6-flash', kind:'text', tier:'fast',
          think:{ knob:'level', levels:['minimal','low','medium','high'] },   // Gemini 3.x enum; 'minimal' = 0 thinking tokens
          caps:{ search:true, jsonMode:true, jsonModeExcludesSearch:true } },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: 100% green (tests stub the network; the id/knob change is behavioral and covered above). DoD 10 met (no plan/safety data; `mtNumSig` still the `dataMT` net); DoD 8/9 N/A.

- [ ] **Step 6: Preflight GATE + commit**

Before deploying (Task 9): run the Task-6 preflight with a real key — `GEMINI_EVAL_KEY=… npm run eval` — and confirm the LIVE preflight PASSES for `text` (id listed + a real non-empty text call). If no key is available, HALT and raise with the owner (Sequencing gate). Then commit locally:

```bash
git add app.js tests/ai-model-registry.spec.ts
git commit -m "feat(ai)!: migrate text model gemini-2.5-flash -> gemini-3.6-flash (thinkingLevel enum knob)"
```

---

### Task 8: MIGRATION — flip the `tts` row to `gemini-3.1-flash-tts-preview`

The TTS migration: one registry row changes **id** only. Verified: `gemini-3.1-flash-tts-preview` accepts the app's exact current TTS payload and returns `audio/L16` 24 kHz mono PCM, so `gemTtsGen`/`gemReadAudio` need **no** change (`tts-3.1-migration-research.md`). Isolated and revertable.

> **GATE:** do not deploy beyond local commits until the Task-6 preflight has passed green against `gemini-3.1-flash-tts-preview` (real `inlineData` audio part).

**Files:**
- Modify: `app.js` (the `tts` row in `GEM_MODELS`)
- Modify: `tests/ai-model-registry.spec.ts` (update the `tts` id assertion)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `gemId('tts') === 'gemini-3.1-flash-tts-preview'`; `gemThink('tts', …)` still `undefined`.

- [ ] **Step 1: Update the failing test**

In `tests/ai-model-registry.spec.ts`, change the Task 1 registry test's tts-id assertion and add a migration assertion:

```ts
// change:
  expect(r.ttsId).toBe('gemini-2.5-flash-preview-tts');
// to:
  expect(r.ttsId).toBe('gemini-3.1-flash-tts-preview');
```

Add:

```ts
test('migration(tts): tts resolves to gemini-3.1-flash-tts-preview and still carries no thinking knob', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({ id: gemId('tts'), think: gemThink('tts','high') ?? 'UNDEF', kind: gemModel('tts').kind })`) as any;
  expect(r.id).toBe('gemini-3.1-flash-tts-preview');
  expect(r.think).toBe('UNDEF');   // audio model — knob:'none' unchanged
  expect(r.kind).toBe('audio');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: FAIL — the `tts` row still resolves to `gemini-2.5-flash-preview-tts`.

- [ ] **Step 3: Write minimal implementation**

In `app.js`, change the `tts` row `id`:

```js
// BEFORE
  tts:  { id:'gemini-2.5-flash-preview-tts', kind:'audio', tier:'tts', voiceDefault:'Kore',
          think:{ knob:'none' },
          caps:{ audio:true } },
// AFTER
  tts:  { id:'gemini-3.1-flash-tts-preview', kind:'audio', tier:'tts', voiceDefault:'Kore',
          think:{ knob:'none' },
          caps:{ audio:true } },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/ai-model-registry.spec.ts`
Expected: PASS. The re-pointed wave3 seam test (reads `gemId('tts')` dynamically) and the Task 5 wiring test (id-independent for TTS) also stay green.

- [ ] **Step 5: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: 100% green. `gemReadAudio` unchanged (verified same encoding). DoD 10 met; DoD 8/9 N/A.

- [ ] **Step 6: Preflight GATE + commit**

Before deploying: confirm the Task-6 preflight PASSES for `tts` (id listed + a real call returning an `inlineData` audio part) — `GEMINI_EVAL_KEY=… npm run eval`. Then commit locally:

```bash
git add app.js tests/ai-model-registry.spec.ts
git commit -m "feat(ai)!: migrate TTS model gemini-2.5-flash-preview-tts -> gemini-3.1-flash-tts-preview"
```

---

### Task 9: Build, version bump, full-suite gate, and live-verify the release

Ship the migrated build. This is the single deploy (`main` push → Cloudflare Pages), gated on the preflight (Tasks 7/8 Step 6). Bump the stamp, rebuild, run the full suite, then verify the LIVE URL per §10.10 before reporting the release.

**Files:**
- Modify: `build.py:334` (the `.foot-stamp` version literal)

**Interfaces:**
- Consumes: the migrated registry (Tasks 7–8).
- Produces: a deployed `dist/index.html` whose stamp and model ids are verified live.

- [ ] **Step 1: Preflight GATE (precondition)**

Confirm the Task-6 live preflight has PASSED for **both** roles against the new ids (`GEMINI_EVAL_KEY=… npm run eval` → `preflight LIVE` PASSED, not skipped). If it has not, HALT — do not proceed (decision 5 / Sequencing gate).

- [ ] **Step 2: Bump the version stamp**

In `build.py:334`, bump the release number (currently 260 → 261; keep the `D.M.YY` date current):

```
// BEFORE:  …<b class="foot-stamp" style="color:var(--ember2)">מהדורה 260 · 23.7.26</b>…
// AFTER:   …<b class="foot-stamp" style="color:var(--ember2)">מהדורה 261 · 23.7.26</b>…
```

- [ ] **Step 3: Rebuild and (if a manual server is running) restart it**

Run: `python build.py`
Then, if a manual `serve.js` is up for local checks, stop and restart it (§11a — the clustered server caches `dist/` at startup). For the suite this is automatic (its `webServer.command` rebuilds).

- [ ] **Step 4: Full-suite regression gate (DoD 12)**

Run: `npx playwright test`
Expected: 100% green — nothing else, no `--workers`/`--retries`. This is the last regression gate before the push.

- [ ] **Step 5: Commit and push (the deploy)**

```bash
git add build.py
git commit -m "chore(release): מהדורה 261 — ship AI model registry + gemini-3.6-flash / 3.1-tts migration"
git push
```

- [ ] **Step 6: Live-verify with Playwright (§10.10) — poll, do not assume**

Cloudflare Pages rebuilds from source (minutes). Poll `https://matkonetesh.pages.dev` until BOTH hold, then report the release:

```
// (a) version stamp matches what was shipped
await page.goto('https://matkonetesh.pages.dev');
const stamp = await page.locator('.foot-stamp').textContent();
expect(stamp).toContain('מהדורה 261');
// (b) a feature probe from THIS release is present (the stamp alone can be right while the payload is stale)
const probe = await page.evaluate(`({ text: (typeof gemId==='function' && gemId('text')), tts: (typeof gemId==='function' && gemId('tts')) })`);
expect(probe.text).toBe('gemini-3.6-flash');
expect(probe.tts).toBe('gemini-3.1-flash-tts-preview');
```

Do not tell the owner the version is live until both pass. DoD 10 met (no plan/safety data changed anywhere in this programme); DoD 8/9 N/A (developer-only).

---

## Self-Review

**1. Spec coverage — the 8 LOCKED decisions:**
- **D1 (build-time registry, defer Worker override):** Task 1 (`GEM_MODELS` build-time; no Worker override). ✓
- **D2 (`textStrong` reserved, not populated):** not created; noted in Task 1 comment + Global Constraints (YAGNI). ✓
- **D3 (no auto fallback; rollback pin):** Task 6 (`textLegacy` commented row); Tasks 7/8 each one revertable row. ✓
- **D4 (minimal seam first; defer `gemText`/`gemCall`):** Tasks 1–5 do the minimal seam; consolidation explicitly out of scope (Global Constraints). ✓
- **D5 (id = gemini-3.6-flash; keep ListModels + one-real-call preflight):** Task 6 (preflight), Task 7 (id), Task 9 Step 1 gate. ✓
- **D6 (TTS first-class role + same preflight):** Task 3 (`gemTtsGen`/`gemReadAudio`), Task 5 (`tts` role), Task 6 (preflight covers tts), Task 8 (tts migration). ✓
- **D7 (`AI_THINK` developer map + floors + §2.2.4 starting config):** Task 2 (`AI_THINK` verbatim incl. floors), Task 5 (per-site levels from §2.2.4). ✓
- **D8 (developer-only; no user toggle):** Task 2 `thinkFor(usage)` has no userPref knob; Global Constraints. ✓

**Spec coverage — the 9 call sites (§1.2 / §2.2.4):** #1 askGemini `ask` (5b), #2 askValidateKey `keyProbe` (5c), #3 aiJSON default `minimal` (3b/5d) with #3a diagnose `high` (5e) + #3b eventPlan `medium` (5f) + #3c seasonRec/wcim/pantry `minimal` (default), #4 central-test `centralTest` (5g), #5 gemSpeak `tts` (3c/5h), #6 vcTranslateToEn `translate` (5i), #7 vcAskAI `vcAsk` (5j), #8 mtTranslate `dataMT` (5k), #9 gemVision `vision` (5l). ✓ Artifacts: `GEM_MODELS`, `gemModel`/`gemId`, `gemGen`/`gemTtsGen`/`gemThink`/`nearestLevel`/`AI_THINK`/`thinkFor`/`THINK_ORDER`/`THINK_BUDGET`, `gemReadText`/`gemReadAudio`, `gemFetch` role resolution, the §2.2.4 level map, the wave3 re-point, the preflight, both migrations. ✓

**2. Placeholder scan:** no "TBD"/"similar to Task N"/"add error handling". Every code step shows complete before/after code. The one deliberately-inert artifact (`AI_THINK.floor`) is documented as approved metadata, not a placeholder. ✓

**3. Type/signature consistency:** `gemId(role)→string`, `gemModel(role)→row`, `gemThink(role,level)→{thinkingLevel}|{thinkingBudget}|undefined`, `gemGen(role,gen,opts)→config`, `gemTtsGen(voice)→config`, `gemReadText(json)→string`, `gemReadAudio(json)→{buf,rate}`, `thinkFor(usage)→level`, `modelIsListed(list,id)→boolean` — used identically in every task. `gemFetch`'s first arg is role-or-literal throughout. The migration-sensitive assertions (text id, tts id, the wiring test's thinking encoding) are updated in exactly the task that changes them (7a/7b, 8), so no stale expectation survives. ✓

**Note surfaced during review (not a blocker):** the `.foot-stamp` footnote still reads *"הנתונים מקומיים, ללא חיבור לרשת"* ("data is local, no network") — stale vs the online-first pivot. Out of scope here (user-facing string; Circle of Control) — flagged for a future copy task, not fixed in this developer-only change.
