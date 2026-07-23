# AI model selection & payload architecture — a design

**Date:** 2026-07-23 · **Status:** DESIGN FOR OWNER APPROVAL (no source modified) · **Scope:** how the app
selects a Gemini model and builds the per-model request payload, so it can migrate models cleanly, absorb
per-model payload differences, and add future models with the least machinery.

**Why this exists.** A migration off `gemini-2.5-flash` failed: `gemini-3.6-flash` returned HTTP 400 on every
call. Two causes, one of which the current architecture cannot localize — see §1. The owner asked to *"select
[the model] at runtime or place different model calls in the code … be prepared for the future and to sequel
new models."* The 2.5-flash developer endpoint shuts down **2026-10-16**, so the migration is owed.

**Two migrations, not one.** The **text** model (`gemini-2.5-flash`) is the pressing case, but the **TTS** model
(`gemini-2.5-flash-preview-tts`, `app.js:5030`) migrates too — soon, to a *"3.1 tts"* model — and must be handled
by the *same* disciplined mechanism. TTS is a genuinely different kind of model (audio-shaped request, base64-PCM
audio response — not text/JSON), so the registry must make it a **first-class role with its own payload builder
and its own response reader**, not force it through the text path. Both migrations must reduce to a config change.

**Method.** Every claim about current behaviour was settled by reading `app.js` and `worker/index.js` and is
cited as `file:line`. This is a design document; it recommends and surfaces decisions — it does not implement.
Per the brainstorming HARD-GATE, implementation waits on owner approval of the decisions in §7.

---

## 1. Current-state trace — how a model is chosen and a payload built today

### 1.1 The one constant, and the transport around it

- `GEM_HOST` — the developer-API base (`app.js:4205`).
- `GEM_MODEL = 'gemini-2.5-flash'` — **the single model constant** (`app.js:4206`). Its own comment records
  the failed flip: *"3.6-flash REVERTED … returned api-400 on EVERY call … 'gemini-3.6-flash' is not a valid
  id on this endpoint (likely Vertex-only). Migration still owed before the 2.5 shutdown (2026-10-16) — needs
  ListModels to find the correct developer-API id first."*
- `GEM_URL(model)` builds the BYOK URL, defaulting the segment to `GEM_MODEL` (`app.js:4207`).
- `gemFetch(model, body, opts)` is the sole transport (`app.js:4208-4236`). It picks the channel —
  `managed` (central Worker holds the key, `X-Access-Code` header) → `byok` (user key) → `off`
  (`app.js:4212-4215`) — does timeout / exponential backoff / transient-status retry (`4216-4235`), and on a
  managed 401/402/403 falls back to the user's own key (`app.js:4226`). **`gemFetch` takes the model id as its
  first argument and passes it straight through; it never inspects the model or touches the body.**
- Channel state: `gemKey()` (`app.js:5006`), `centralUrl()` (`5008`), `centralCode()` (`5009`),
  `gemMode()` (`app.js:5010`, returns `managed` | `byok` | `off`).

**The transport seam is genuinely good and is not what needs changing.** What needs changing is everything
*above* it — the id and the body — which today lives at each call site.

### 1.2 The model is not one value + one payload — it is already two models and eight hand-built bodies

There are **two distinct concrete models in use**, and the payload is rebuilt inline at every call site. The
`thinkingConfig:{thinkingBudget:0}` line — the exact fragment that 3.6-flash rejects — is duplicated in **eight**
places.

| # | Call site | `app.js` | Model passed | Payload shape (beyond `contents`) |
|---|---|---|---|---|
| 1 | `askGemini` (Ask-the-Fire chat) | body `4246-4251`, call `4252` | `GEM_MODEL` | `system_instruction` · `tools:[{google_search}]` · `temp 0.8` / `1600` · **`thinkingConfig:{thinkingBudget:0}`** |
| 2 | `askValidateKey` (key probe) | `4261` | `GEM_MODEL` | tiny · **`thinkingBudget:0`** |
| 3 | `aiJSON.mkBody` (all structured features) | `4347-4358`, call `4361` | `GEM_MODEL` | `system_instruction` · **conditional** `tools:[{google_search}]` · **conditional** `responseMimeType:'application/json'` · **`thinkingBudget:0`** |
| 4 | central-access test | `4554` | `GEM_MODEL` | tiny · **`thinkingBudget:0`** |
| 5 | `gemSpeak` (TTS) | `5030` | **`'gemini-2.5-flash-preview-tts'` (literal, not `GEM_MODEL`)** | `responseModalities:['AUDIO']` · `speechConfig` · **no `thinkingConfig`** · **no `system_instruction`** · BYOK-only (`5026`) |
| 6 | `vcTranslateToEn` (voice EN) | `5193-5195`, call `5196` | `GEM_MODEL` | `system_instruction` · `temp 0.2` / `300` · **`thinkingBudget:0`** |
| 7 | `vcAskAI` (voice Q&A) | `5276-5279`, call `5280` | `GEM_MODEL` | `system_instruction` · `tools:[{google_search}]` · `temp 0.6` / `400` · **`thinkingBudget:0`** |
| 8 | `mtTranslate` (recipe data MT) | `6973-6974`, call `6975` | `GEM_MODEL` | `system_instruction` · `temp 0.2` / `600` · **`thinkingBudget:0`** |
| 9 | `gemVision` (photo read) | `9299`, call `9300` | `GEM_MODEL` | multimodal `inlineData`+`text` · `temp 0.4` / `800` · **`thinkingBudget:0`** · **no `system_instruction`** · **no `tools`** |

Three facts fall out of this table and drive the whole design:

1. **"The model" is already a family, not a value.** The TTS model (#5) is a hard-coded literal that bypasses
   `GEM_MODEL` and carries a *completely different* `generationConfig` (audio modality, no thinking). The code
   already proves that different jobs need different ids and different payloads — it just hasn't named the
   pattern.
2. **The quirk that broke the migration is copy-pasted eight times.** `thinkingConfig:{thinkingBudget:0}` is a
   per-model payload constraint (2.5-flash / 3.5-flash accept it; 3.6-flash 400s on it), yet it lives at eight
   independent call sites. A model that rejects it forces eight edits, and any one missed edit ships a 400.
3. **Payload capability toggles already vary per call and one cross-constraint is already handled ad hoc.** The
   toggles observed: web search (`tools:[{google_search}]`), JSON mode (`responseMimeType`), thinking-off,
   audio modality, multimodal input. And one *incompatibility* — `responseMimeType:'application/json'` together
   with `google_search` returns 400 — is already worked around, but **only inside `aiJSON`** (`app.js:4348-4352`).
   Nothing generalizes it.

### 1.2a The TTS path in full — a different model, a different payload, a different response shape

The TTS caller `gemSpeak(text, lang)` (`app.js:5025-5047`) is the one place that already proves *"the model" is a
family with divergent request AND response shapes*. Traced end to end:

- **Different channel gate.** It requires a personal key up front — `const key=gemKey(); if(!key) throw 'no-key'`
  (`app.js:5026`) — so TTS is **BYOK-only** in practice, even though the `gemFetch` call underneath still routes
  managed→BYOK. (Making TTS a role does not change this unless the owner intends it to.)
- **Different id.** The literal `'gemini-2.5-flash-preview-tts'` is passed directly, bypassing `GEM_MODEL`
  entirely (`app.js:5030`).
- **Different request payload.** `generationConfig:{responseModalities:['AUDIO'], speechConfig:{voiceConfig:
  {prebuiltVoiceConfig:{voiceName:gemVoice()}}}}` (`app.js:5030`). **No `thinkingConfig`, no `system_instruction`,
  no `tools`** — none of the text-model fields apply. The voice comes from `gemVoice()` (`app.js:5011`, default
  `'Kore'`), surfaced as a `<select>` (`app.js:5129`).
- **Different response shape — audio, not text.** The reply is decoded as **base64 PCM inside `inlineData`**, not
  as `content.parts[].text`: find the part carrying `inlineData` (`app.js:5034`), throw `no-audio` if absent
  (`5035`), parse the sample rate out of `inlineData.mimeType` via `rate=(\d+)` (`5036`), then
  `pcmToBuffer(b64ToPcm16(part.inlineData.data), rate)` (`5037`), cache the `AudioBuffer` keyed by
  `clean+gemVoice()` (`5028`, `5039`), and play it through WebAudio (`app.js:5042-5046`). **The text callers'
  extractor — `content.parts.map(p=>p.text).join('')` — would return an empty string here.**
- **Note the `inlineData` collision.** `gemVision` also touches `inlineData` (`app.js:9299`) but on the **input**
  (an image sent *to* the model); TTS uses `inlineData` on the **output** (audio returned *from* it). Same field
  name, opposite direction — which is exactly why a single universal "read the model's response" function is the
  wrong abstraction.
- **A rename is already anticipated in the UI.** `vcSpeak` already catches a TTS 404 with *"מודל ההקראה לא נמצא —
  ייתכן שהשם השתנה בצד Google"* ("TTS model not found — the name may have changed on Google's side")
  (`app.js:5067`), and on any TTS failure falls back to the browser's `sysSpeak` (`app.js:5070`). So TTS already
  has a **functional fallback**, and the code already expects the id to change — the registry simply makes that
  change a one-liner instead of an edit to a buried literal.

### 1.3 The managed Worker needs no per-model logic — and that is an asset

`worker/index.js` forwards `POST /v1beta/models/<model>:generateContent` to Gemini verbatim; its route regex
accepts **any** model segment (`worker/index.js:43`) and it re-emits the body unchanged (`worker/index.js:63-70`).
Its contract note is explicit: *"It speaks the same generateContent contract as Google, so the app's transport
code is unchanged above this layer"* (`worker/index.js:11-15`). **Consequence:** model selection is entirely a
client concern today, *and* the Worker is a ready-made place to serve a runtime model override later (§4, §5)
without new proxy logic — it already passes whatever id the client asks for.

### 1.4 Prior art already points here

`docs/ai-strategy.md` Part B already proposes **A1 `gemText()`** (one free-text caller to kill the 5× hand-rolled
duplication) and **A2 a "Model router"** with an optional `tier`/`thinking` param routing Diagnose & Event-planning
to a stronger, thinking-on model while quick Q&A stays on flash (`docs/ai-strategy.md:64-66`). This design is the
concrete form of A1+A2, extended to cover the payload-normalization problem that A2 named but did not spec.

### 1.5 Tests are coupled to the literal id

`tests/wave3-ai-hardening.spec.ts:62-63` asserts the default URL contains `gemini-2.5-flash:generateContent` and
that `GEM_URL('gemini-2.5-flash-preview-tts')` resolves — so **the migration also edits a test**, and the design
should let that test assert through the registry rather than a frozen string (§5).

---

## 2. Q1 — A model registry / payload abstraction

**Goal:** one source of truth mapping a *role* the app asks for → a concrete model id **and** its payload rules,
so no call site hard-codes a quirk like `thinkingConfig`.

### Options

- **Option A — Capability-declarative registry + a tiny body normalizer.** Registry rows are plain data:
  `{ id, thinking, … }`. One function, `gemGen(role, gen)`, takes a base `generationConfig` and applies the
  row's rules (adds / omits `thinkingConfig`). Call sites ask for a role and pass their intent; the layer emits
  the right config. New model whose quirks fit existing flags = **a data edit, no code**.
- **Option B — Per-model transform function.** Each row carries a `fixBody(body)` function that rewrites a
  canonical body. Maximally flexible, but a *function per model* is code, not data — it defeats "new model =
  data-only," is harder to review, and invites divergence. Rejected as over-built for the demonstrated need.
- **Option C — Minimal helper only.** Keep every call site building its own body, but funnel the thinking
  decision through one `withThinking(gen)` helper and keep a bare id list. Smallest diff, fixes *only* the
  thinking quirk, and leaves the id still effectively hard-coded per site. Under-serves "select at runtime" and
  "per-feature calls."

### Recommendation — **Option A.**

It localizes the exact fragment that broke (one place decides `thinkingConfig`), it is data-driven for future
models, and it is proportionate to a cooking app — no plugin system, no per-model code. Each row also declares a
`kind` (`'text'` | `'audio'`) so the response-reading seam knows which shape to expect — the mechanism that keeps
the TTS audio path and the text path from leaking into one another (§2.1). Sketch:

```js
// ── AI model registry: the single source of truth for id + payload + response shape ──
const GEM_MODELS = {
  // role → concrete model + how its payload differs. 'kind' selects the response reader.
  // 'thinking' (text kinds only):
  //   'off'         → emit thinkingConfig:{thinkingBudget:0}   (2.5-flash, 3.5-flash)
  //   'unsupported' → emit NOTHING                             (3.6-flash — the field 400s)
  //   'on'          → emit thinkingConfig:{thinkingBudget:N}   (a future reasoning tier)
  text: { id:'gemini-2.5-flash',             kind:'text',  thinking:'off', tier:'fast',
          caps:{ search:true, jsonMode:true, jsonModeExcludesSearch:true } },
  tts:  { id:'gemini-2.5-flash-preview-tts', kind:'audio', tier:'tts',
          voiceDefault:'Kore', caps:{ audio:true } },
  // 'textStrong' is intentionally ABSENT until a feature needs it (§3, YAGNI).
};

function gemModel(role){ return GEM_MODELS[role] || GEM_MODELS.text; }
function gemId(role){ return gemModel(role).id; }

// REQUEST — text roles: normalize a base generationConfig, applying the model's thinking quirk once.
// Call sites build their OWN temperature/maxOutputTokens/etc and hand it here.
function gemGen(role, gen){
  const m = gemModel(role); const out = Object.assign({}, gen||{});
  if(m.thinking==='off')       out.thinkingConfig = {thinkingBudget:0};
  else if(m.thinking==='on')   out.thinkingConfig = {thinkingBudget: m.thinkingBudget||-1};
  else                         delete out.thinkingConfig;   // 'unsupported'/'none'/audio
  return out;
}
```

**Per-text-call-site change is mechanical and small.** Site #1 (`askGemini`, `app.js:4250`) becomes:

```js
generationConfig: gemGen('text', {temperature:0.8, maxOutputTokens:1600})
// …and the call:  gemFetch('text', body, {timeout:30000})   // role, not GEM_MODEL
```

For that to work, **`gemFetch` resolves a role to an id at the top** (one added line): if its first argument is a
registry role, use `gemModel(role).id`; else treat it as a literal id (keeps `askValidateKey`'s raw-key probe and
any direct-id call working). This is the whole seam: **id lives in the registry, thinking-quirk lives in
`gemGen`, transport is untouched.**

### 2.1 TTS is a first-class role, with its OWN payload builder and response reader

TTS must sit *in* the registry (so its migration is a config change too) while keeping its audio-shaped request
and audio response off the text path. The registry's `kind` field does this: **the request builder and the
response reader are chosen per role, and text and `tts` never share either.**

```js
// REQUEST — audio role: the TTS-shaped generationConfig lives in ONE builder, not a call-site literal.
function gemTtsGen(voice){
  return { responseModalities:['AUDIO'],
           speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName: voice || gemModel('tts').voiceDefault } } } };
}

// RESPONSE — two typed readers. A role uses exactly one; the registry's `kind` says which,
// and each reader guards its kind so a wiring mistake fails loudly instead of returning ''.
function gemReadText(json){            // for kind:'text' — dedups the 6 hand-rolled extractors
  const c = json.candidates && json.candidates[0];
  const t = c && c.content && (c.content.parts||[]).map(p=>p.text||'').join('').trim();
  if(!t){ const fr=(c&&c.finishReason)||(json.promptFeedback&&json.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
  return t;
}
function gemReadAudio(json){           // for kind:'audio' — the app.js:5033-5037 decode, in ONE place
  const c = json.candidates && json.candidates[0];
  const part = c && c.content && c.content.parts.find(p=>p.inlineData);
  if(!part) throw new Error('no-audio');
  const rate = parseInt((part.inlineData.mimeType.match(/rate=(\d+)/)||[])[1] || '24000');
  return { buf: pcmToBuffer(b64ToPcm16(part.inlineData.data), rate), rate };   // AudioBuffer, never text
}
```

`gemSpeak` (`app.js:5030-5037`) then reads as a role with its own builder and reader, id no longer inlined:

```js
const r = await gemFetch('tts', { contents:[{parts:[{text:clean}]}], generationConfig: gemTtsGen(gemVoice()) }, {timeout:20000});
// … r.ok check unchanged …
const { buf } = gemReadAudio(await r.json());   // audio reader — NOT gemReadText
```

**Why this is the right seam.** The abstraction never exposes a single "call a model → get text" function that a
`tts` role would have to lie about. The transport (`gemFetch`) stays response-agnostic — it returns the raw
`Response` exactly as today — and the **caller picks the reader its role's `kind` dictates**. A text feature can
never accidentally run `gemReadAudio` (and vice-versa) because each reader is selected by role and asserts its
shape. This is the concrete answer to *"the 'call a model' seam must not assume a text/JSON response shape."*

**Fuller consolidation (do after the migration, from strategy A1).** A `gemCall(role, spec)` /`gemText(role, spec)`
that builds the *entire* body from an intent `spec` — `{system, contents, search, json, temperature, maxTokens}` —
would also fold the `jsonModeExcludesSearch` cross-constraint (`app.js:4348-4352`) out of `aiJSON` and into one
place, and retire the 5 hand-rolled free-text callers. Recommended as the **follow-up**, not the migration-blocking
first step — see §7 decision 4.

---

## 3. Q2 / Q3 — runtime selection and per-feature calls

These two questions share one answer: **the role is the feature-facing contract; the registry resolves it.**

### Q3 — per-feature calls (`callModel('text-fast', …)` vs `callModel('text-strong', …)`)

Roles decouple the feature from the id exactly as the owner described. A feature declares *what class of model it
wants*; the registry owns *which concrete model that is today*.

| Feature | Role today | Future role (strategy A2) |
|---|---|---|
| Ask-the-Fire, voice Q&A, quick translate, seasoning JSON | `text` (fast) | `text` |
| Diagnose-a-cook, Event/Cookout planning, Live Copilot reasoning | `text` | **`textStrong`** (thinking-on / pro) |
| Photo read | `text` (multimodal on flash) | `text` or a `vision` role if a model diverges |
| Voice TTS | `tts` | `tts` |

`textStrong` is **reserved but not populated** now (YAGNI, §12.3 of the discipline). The day the Copilot/Diagnose
quality lever is wanted, it is one registry row plus changing those call sites from `'text'` to `'textStrong'` —
no plumbing.

### Q2 — where selection is decided

Options for *how the concrete id is chosen*:

- **Build-time registry (config-as-data).** The id lives in `GEM_MODELS`; changing it is a one-line edit + a
  `python build.py` + ship. **Selection happens at build time, per role.**
- **Managed-Worker runtime override.** The Worker (which already sits in the request path and holds server-side
  config, `worker/index.js:11-15`) serves a small `role → id` map; managed-tier clients consult it and can be
  migrated by editing a KV value — **no client rebuild, no waiting on a Cloudflare Pages build**. BYOK clients
  keep the build-time default.
- **User-facing model picker in Settings.** A dropdown letting the end user choose a Gemini model.

**Recommendation — build-time registry now; managed-Worker override as an optional Phase-2 lever; *not* a
user-facing picker.**

- A cooking app's users do not want to pick Gemini SKUs, and letting them is a **safety and support liability** —
  a user could select a model that breaks JSON mode or the grounding contract, silently degrading the
  never-invent-a-safety-number guarantee. This is a clear YAGNI + do-no-harm call.
- The owner's actual need — *flip the model fast* — is met by the build-time registry: the migration becomes a
  one-line data change (§5). That is the least machinery that solves the stated problem.
- "Select at **runtime**" (the owner's word) is genuinely useful for one case: hot-swapping the model for
  managed-tier users without waiting on a Pages rebuild, and rolling back instantly if a new model misbehaves in
  the field. The Worker override delivers exactly that and needs **no new proxy logic** — the Worker already
  forwards whatever id it is handed. Deferred until the managed tier is live (§7 decision 1) so we don't build a
  control plane before there's traffic on it.

---

## 4. Q4 — future-proofing and fallback

### Adding a new model

**Data-only when the new model's quirks fit existing flags.** Worked example — the very model that broke:

```js
// Add / retarget a row. If 3.6-flash rejects thinkingConfig, that is ONE field:
text: { id:'gemini-3.6-flash', thinking:'unsupported', tier:'fast',
        caps:{ search:true, jsonMode:true, jsonModeExcludesSearch:true } },
```

`gemGen('text', …)` now emits **no** `thinkingConfig` for every one of the eight call sites at once — the 400
cause is removed in a single edit. A genuinely new quirk (say a model needs a new `generationConfig` field) costs
**one new capability flag + one branch in `gemGen`** — small and localized, still no call-site churn.

**What the registry alone cannot fix — and the preflight that covers it.** The 3.6 failure had a *second* cause
the registry can't express: `'gemini-3.6-flash'` may not be a valid id on the developer API at all (the comment at
`app.js:4206` suspects Vertex-only) and *"needs ListModels to find the correct developer-API id first."* So the
future-proofing has two halves:
1. **Payload quirks → the registry** (above).
2. **"Is this id real and does a real call succeed?" → a preflight**, run before shipping a model change: hit the
   developer API's **ListModels** to confirm the id exists, then fire **one real call per role** against the
   candidate and assert a 200 + non-empty body. This is the natural job of the eval harness already designed in
   this same folder (`docs/analysis/program/PRE-4-eval-harness-design.md`) — the model-migration preflight should
   be a mode of it (§7 decision 5).

### Fallback chain (try model A, fall back to B)?

**Recommendation — no automatic per-request model fallback. Adopt a fast rollback lever instead.**

- The app already has **two** fallback layers: transport (managed → BYOK, `app.js:4226`) and *functional*
  (local-first — `wcimLocal`/deterministic compute, and translate failures return the safe Hebrew source,
  `app.js:6978`). A third, model-level automatic chain is complexity the owner's need does not require (Occam-build,
  §12.3).
- A **silent** model downgrade is a *safety* concern: if `textStrong` (thinking-on, used for the highest-stakes
  Diagnose/Copilot answers) quietly fell back to a weaker model, answer quality for the scariest features would
  degrade invisibly — against the trust contract. Failing visibly and letting the user retry is safer.
- What *is* worth having is a **rollback pin, not a runtime chain**: keep the outgoing model as a named row
  (e.g. `textLegacy: {id:'gemini-2.5-flash', thinking:'off', …}`) so that if a new default misbehaves in the
  field, the owner flips `text.id` back (or flips the Worker override) in one line. That is a deliberate,
  observable rollback — the good half of "fallback" without the hidden-downgrade risk.

---

## 5. Q5 — how this design turns the migration into a config change (and would have caught the 3.6 break)

**The migration becomes data.** To move `text` off 2.5-flash:

```js
text: { id:'<correct-3.x-developer-api-id>', thinking:'<off|unsupported>', tier:'fast', caps:{…} },
```

`python build.py`, ship. Eight call sites inherit the new id and the correct `thinkingConfig` behaviour with **zero**
call-site edits. Compare today: the same migration means editing `GEM_MODEL` **and** hunting eight inlined
`thinkingConfig` fragments, where one miss ships a 400.

**The TTS migration is the same one-line change.** To move TTS from `gemini-2.5-flash-preview-tts` to the coming
*"3.1 tts"* model:

```js
tts: { id:'gemini-3.1-tts', kind:'audio', tier:'tts', voiceDefault:'Kore', caps:{ audio:true } },
```

`gemSpeak` inherits the new id with **no** change to its call site, its TTS-shaped payload (`gemTtsGen`), or its
audio reader (`gemReadAudio`) — because none of those hard-code the id anymore (contrast the buried literal at
`app.js:5030` today). If the 3.1 TTS model changes the voice-config shape or the audio encoding, that lands in the
**one** builder / **one** reader, not scattered. And the same preflight (below) applies: a ListModels check that
`gemini-3.1-tts` is a real developer-API id, plus one real TTS call asserting a non-empty `inlineData` audio part
before shipping — the exact failure `vcSpeak`'s 404 handler (`app.js:5067`) exists to catch, now caught before the
owner's users hit it.

**How it would have caught the 3.6 incompatibility before shipping — both failure modes:**

1. **The `thinkingConfig` 400.** Setting `thinking:'unsupported'` on the 3.6 row makes `gemGen` omit the field
   everywhere in one place. Even absent that foresight, the **preflight** (§4) fires one real call per role; the
   400 surfaces in CI/pre-ship, not in the owner's hands.
2. **The invalid-id 400.** The **ListModels preflight** (§4) confirms the id exists on the developer API *before*
   the flip — the precise check the `app.js:4206` comment says is owed. The registry can't invent a correct id,
   but the preflight refuses to ship a wrong one.

**And the test stops fighting the migration.** `tests/wave3-ai-hardening.spec.ts:62-63` currently freezes the
literal `gemini-2.5-flash`. Re-pointing it at `gemId('text')` / `gemId('tts')` makes the suite assert *"the
default resolves and the TTS role resolves,"* which stays green across a model change instead of failing on the
string — while a **new** preflight test asserts the live id is reachable.

---

## 6. Recommended shape, in one picture

```
 feature code ──asks for a ROLE──▶  GEM_MODELS[role]         (data: id + caps + thinking rule)
   gemFetch('text', body)                 │
   gemGen('text', {temp,max})             ├─ gemId(role)  ─────────▶ concrete id  ─┐
                                          └─ gemGen(role, gen) ▶ correct payload  ─┤
                                                                                   ▼
                                                            gemFetch (UNCHANGED transport:
                                                            managed→BYOK→off, retry/backoff,
                                                            resolves role→id at the top)
                                                                                   │
                                            ┌──────────────────────────────────────┤
                                            ▼                                       ▼
                                  BYOK: developer API                    Managed: Worker (verbatim
                                  (build-time registry id)               forward; OPTIONAL Phase-2
                                                                         role→id override in KV)
```

Everything new is **data + two small functions** (`gemGen`, role-resolution in `gemFetch`). The transport, the
Worker, and the safety/grounding layers are untouched.

---

## 7. Decisions for the owner

1. **Runtime-selection lever.** Ship the **build-time registry** only now (solves the migration with the least
   machinery), and **defer** the managed-Worker `role→id` override until the managed tier is live? *(Recommended.
   Reversible.)* Or build the Worker override in the same pass?
2. **`textStrong` now or later.** **Reserve** the role and stay single-model until Diagnose/Copilot actually want
   the stronger, thinking-on tier (strategy A2)? *(Recommended — YAGNI.)* Or populate it now?
3. **Fallback stance.** Confirm **no automatic model fallback chain**, adopting the observable **rollback pin**
   (`textLegacy` row + one-line flip) instead? *(Recommended. This is safety-adjacent — a silent downgrade of the
   Diagnose/Copilot model is the risk — so it is an explicit owner sign-off, not a routine call.)*
4. **First-implementation scope.** Do the **minimal seam** first — `GEM_MODELS` + `gemId` + `gemGen` +
   role-resolution in `gemFetch` + the ~9 call-site wraps (this alone unblocks the migration) — and treat the
   fuller **`gemText()`/`gemCall()` consolidation** (strategy A1: retire the 5 hand-rolled callers, centralize
   the JSON+search 400 workaround) as a **follow-up**? *(Recommended.)* Or do both together?
5. **The migration's open unknown (not answerable from code).** The correct 3.x **developer-API** model id is
   still unknown — the `app.js:4206` comment says a **ListModels** lookup is required, and 2.5-flash shuts down
   **2026-10-16**. Approve making a **ListModels + one-real-call-per-role preflight** a mode of the existing eval
   harness (`PRE-4-eval-harness-design.md`) and running it to pick the id? This is the step that converts "flip a
   constant and hope" into "flip a row that a preflight proved."

*No source file was modified in producing this document.*
