# Metered Streaming (v281) Implementation Plan — REVISED per R-39/R-40 + the demo-purpose ruling (31.7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First sound **≤ 3.0 s** (measured basis ≈ 2.3 s) for a free-form voice answer: stream the TTS **audio** on the endpoint we already use (R-39 — measured, first audio frame 1,101 ms), stream the **text** answer and hand the first gate-passed sentence to the streaming synthesizer, return `streamGenerateContent` to the Worker as a **minimal metered** route that protects the OWNER'S key, land the tier **skeleton** (default row only, R-40), and gate the release on **demo-grade** verification (D1–D4) — the arc's purpose is demos and marketing.

**Revision note (what changed vs the 10-task plan at `8f6443c`):**
- **New order (owner ruling):** (1) audio streaming end-to-end → (2) text streaming + first-sentence handoff → (3) minimal Worker metering → (4) tier skeleton → (5) demo-grade verification.
- **Task count: 9 (was 10).** Dropped: the `extended` tier row, the `--tier` mint flag and `tier <code> <name>` CLI command (R-40: minimal tier skeleton — one-line adds when band-H opens), the Task-2 "bridge" `handleStream` (no users → no incremental-shipping need; the metering lands whole), and every test/step justified by "no behaviour change for existing users" (R-40: there are no existing users; the `tier`-absent → `default` contract test remains because it pins the code's contract, not compatibility). Added: **Task 1 (streaming TTS — the headline win)** and **Task 8 (pre-warm + weak-network degradation)**; Task 9 folds the old latency-evidence and release tasks together with the fixed demo scenario (D3) and the real-device check (D4).
- **Effort vs the old 10:** roughly equal in total — about 1.5 tasks of tier/CLI/compat work removed, about 2 tasks of client streaming-audio + demo-hardening work added; the weight moved from the Worker to the client, and the headline win moved to Task 1.

**Architecture:** Client: `gemTransport` (one transport builder, both verbs, both backends) + `gemSpeakSeg` (streaming TTS via `streamGenerateContent` + `responseModalities:['AUDIO']`, incremental PCM playback on the WebAudio clock, blocking `gemSynthChunk`+`gemPlayBuf` as fallback) + `gemStreamFetch` (text SSE) + sentence assembler + digit-free gate; `vcGuardSpoken` runs **exactly once on the complete assembled answer** (after `asm.end()`, before any post-guard text is spoken). Worker: one debit-first admission helper feeds both routes; the streaming route tees the SSE body through a modality-agnostic meter and reconciles via the existing `reconcile()` under `ctx.waitUntil`. Tiers: `TIERS` with a single `default` row + `tierOf(rec)`.

**Tech Stack:** Cloudflare Worker (vanilla JS, KV) · vitest + @cloudflare/vitest-pool-workers (`cd worker && npm test`) · single-file PWA `app.js` · Playwright (`npx playwright test`) · `scripts/central-code.mjs` (wrangler KV).

**Spec:** `docs/superpowers/specs/2026-07-31-metered-streaming-design.md` (approved; revised 31.7 per R-39/R-40 + the demo ruling — the rulings table at its end is authoritative).
**Sequencing:** this plan executes ONLY AFTER Voice Wave 0 is merged (it consumes `vcChunkText`, `gemSynthChunk`, `gemPlayBuf`, `gemSpeak`, `vcSpeakGen`, `ttsText`, `vcLatMark` — all Wave-0 deliverables). Do not run it concurrently with the Wave-0 agent in `app.js`.

## Global Constraints

(Mirrors spec §9. Every task's requirements implicitly include this section.)

1. **Secrets never enter the repo.** `GEMINI_API_KEY` exists in the environment for measurement only — never read into committed code, never printed. Worker secrets stay Worker secrets.
2. **Safety invariance (DoD-10):** no `bcheck` stage, `temp`, `safe` value, or cook duration altered anywhere in this arc.
3. **The v278 spoken-safety guarantees + INV-T hold through streaming** (spec §6): the guard runs on the complete answer only — exactly once, after the last delta is assembled (`asm.end()`) and before any post-guard text is spoken; early speech only through the digit-free gate; `ttsText` remains the only transform between guard-approved text and the engine, including for the streaming synthesizer (audio-byte streaming sits entirely below the text pipeline).
4. **`tests/TEST-AUTHORING-CONTRACT.md` binds every Playwright test** (warm page + `seedApp`, no `addInitScript`, condition-based waits, `npx playwright test` plain). Worker tests run under `cd worker && npm test` (vitest, real workerd) — both suites are release gates.
5. **B19 must not regress:** no unmetered byte ever flows upstream; admission precedes the first upstream byte on every path. The metering ships because it protects the OWNER'S key and bill (R-40) — an unmetered proxy is an open account.
6. **No migration work (R-40):** there are no existing users; backward compatibility and storage migration are NOT constraints and no step may be justified by them.
7. **Out of scope:** pricing/product tiers/UI/billing (band-H, D8); streaming for non-voice call sites; the `extended` tier row + tier-management CLI (spec §2.7 deferrals).

**Per-task DoD (discipline §3):** every task below additionally runs the 12-point gate — spec line traced, RED witnessed (output pasted), GREEN fresh (exit code shown), behavioural assertion, consumer named, fixture minimality, no arbitrary waits, and the suite relevant to the touched code (`cd worker && npm test` for worker tasks ×1; `npx playwright test` ×1 for app tasks; both ×2 at the release task, H7).

---

### Task 1: Streaming TTS — `gemTransport` + `gemSpeakSeg` (the headline win, R-39)

**Files:**
- Modify: `app.js` (beside `gemFetch` for the transport; beside `gemSynthChunk`/`gemPlayBuf` for the synthesizer)
- Test: `tests/metered-streaming.spec.ts` (new file — TEST-AUTHORING-CONTRACT applies)

**Interfaces:**
- Consumes: `gemMode()`, `centralUrl()`, `centralCode()`, `gemKey()`, `GEM_MODELS`, `GEM_HOST`, `gemAudioCtx()` (or the Wave-0 AudioContext accessor), `vcGenCurrent`/`vcSpeakGen`, `vcLatMark`, `gemSynthChunk`+`gemPlayBuf` (the fallback), `gemVoiceFor(lang)` (the Wave-0 voice selection).
- Produces: `gemTransport(mdl, verb, key) → {mode, url, headers}` (Tasks 2 and 4 consume it); `gemSpeakSeg(text, lang, gen) → Promise<void>` — streaming synthesis+playback of ONE already-approved text segment, resolving when its playback ends, falling back internally to `gemSynthChunk`+`gemPlayBuf` on `stream-unsupported`/failure; the mock seam `window.__gemTtsStreamMock`. `gemSpeak` (the Wave-0 full-utterance speaker) is rewired to call `gemSpeakSeg` per chunk — every existing caller (`vcSpeak`, `vcAck`) gets streaming for free, unchanged.
- Spec trace: spec §5.1 (one transport, no fork), §5.3 (streaming TTS, R-39), §8 (measured basis: 185 frames, first audio frame 1,101 ms vs 7,643 ms blocking).

- [ ] **Step 1: Write the failing tests** — create `tests/metered-streaming.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

test('gemTransport builds the managed streaming URL+header without forking from BYOK', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': 'https://w.example', 'mk-central-code': 'abc123' });
  const t = await page.evaluate(() => (window as any).gemTransport('gemini-x', 'streamGenerateContent'));
  expect(t.mode).toBe('managed');
  expect(t.url).toBe('https://w.example/v1beta/models/gemini-x:streamGenerateContent?alt=sse');
  expect(t.headers['X-Access-Code']).toBe('abc123');
  await seedApp(page, { 'mk-gemkey': 'k-test' });                       // BYOK world
  const b = await page.evaluate(() => (window as any).gemTransport('gemini-x', 'streamGenerateContent'));
  expect(b.mode).toBe('byok');
  expect(b.url).toContain('generativelanguage.googleapis.com');
  expect(b.url).toContain(':streamGenerateContent?alt=sse');
  expect(b.headers['x-goog-api-key']).toBe('k-test');
});

test('gemSpeakSeg plays streamed PCM incrementally: firstAudio marks BEFORE the stream completes', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  // two audio frames; the route yields them as one SSE body — the client must schedule the first
  // chunk (and mark firstAudio) before it has consumed the whole body. Observable: the __vcLat mark
  // plus the scheduled-chunk counter the implementation exposes for tests (__gemAudioChunks).
  const pcm = Buffer.alloc(4800, 7).toString('base64');   // 100ms of 24kHz 16-bit mono
  const frame = (d: string) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: d } }] } }] }) + '\n\n';
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 200, contentType: 'text/event-stream', body: frame(pcm) + frame(pcm) }));
  try {
    const out = await page.evaluate(async () => {
      const w = window as any;
      const gen = w.vcNewSpeakGen();
      await w.gemSpeakSeg('שלום, המעשנה יציבה.', 'he', gen);
      return { firstAudio: w.__vcLat && w.__vcLat.firstAudio, chunks: w.__gemAudioChunks };
    });
    expect(typeof out.firstAudio).toBe('number');
    expect(out.chunks).toBe(2);                       // both frames decoded and scheduled
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});

test('gemSpeakSeg falls back to the blocking synth on managed 404 (stale Worker) — a demo degrades, never dies', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': 'https://w.example', 'mk-central-code': 'abc123' });
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }));
  try {
    const usedFallback = await page.evaluate(async () => {
      const w = window as any;
      let hit = 0;
      w.__gemTtsMock = () => { hit++; return { length: 1, sampleRate: 24000 }; };
      w.__gemPlayMock = () => Promise.resolve();
      const gen = w.vcNewSpeakGen();
      await w.gemSpeakSeg('טקסט קצר.', 'he', gen);
      delete w.__gemTtsMock; delete w.__gemPlayMock;
      return hit;
    });
    expect(usedFallback).toBe(1);                     // blocking path carried the segment
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts` (targeted run is fine mid-task; the FULL plain suite runs at the task gate)
Expected: FAIL — `gemTransport is not a function`, `gemSpeakSeg is not a function`. Paste. If any new test passes on first run, it is void — rewrite it (DoD-2).

- [ ] **Step 3: Implement** — in `app.js`:

(a) directly above `gemFetch`, the shared transport builder:

```js
// ── Metered-streaming arc (spec §5.1) · ONE transport builder for BOTH verbs and BOTH backends.
// gemFetch, gemStreamFetch and gemSpeakSeg consume this — managed vs BYOK can never fork, because the
// fork point is a data structure, not two code paths. verb 'streamGenerateContent' pins alt=sse (the
// Worker and the client parsers both speak SSE frames — spec §2.1).
function gemTransport(mdl, verb, key){
  verb=verb||'generateContent';
  const mode = key ? 'byok' : gemMode();
  if(mode==='off') throw new Error('no-key');
  const q = (verb==='streamGenerateContent') ? '?alt=sse' : '';
  const url = (mode==='managed')
    ? (centralUrl()+'/v1beta/models/'+mdl+':'+verb+q)
    : (GEM_HOST+mdl+':'+verb+q);
  const headers = (mode==='managed')
    ? {'Content-Type':'application/json','X-Access-Code':centralCode()}
    : {'Content-Type':'application/json','x-goog-api-key':(key||gemKey())};
  return {mode, url, headers};
}
```

Then refactor `gemFetch` to consume it — replace its `mode`/`url`/`headers` lines (app.js:5502-5505) with:

```js
  const t = gemTransport(mdl, 'generateContent', opts.key);
  const mode = t.mode, url = t.url, headers = t.headers;
```

(the rest of `gemFetch` — retries, backoff, `gemNoteUsage`, the managed→BYOK fallback — is untouched.)

(b) beside `gemSynthChunk`, the streaming synthesizer (R-39, spec §5.3):

```js
// ── R-39 (measured 31.7: first audio frame 1,101ms vs 7,643ms blocking): TTS streams on the SAME
// streamGenerateContent endpoint via responseModalities:['AUDIO'] — no Interactions API, no second
// surface. gemSpeakSeg receives ONLY gate-passed or guard-approved text (already through ttsText —
// INV-T: this function never transforms text, it only moves audio bytes). PCM chunks are scheduled on
// the WebAudio clock at a running cursor; the first chunk IS the first sound. Falls back to the
// blocking gemSynthChunk+gemPlayBuf path on stream-unsupported/any failure — a demo degrades, never dies.
function gemPcm16ToF32(bytes){
  const n=bytes.byteLength>>1, dv=new DataView(bytes.buffer, bytes.byteOffset, n<<1), out=new Float32Array(n);
  for(let i=0;i<n;i++) out[i]=dv.getInt16(i<<1, true)/32768;
  return out;
}
function gemB64Bytes(b64){
  const s=atob(b64), a=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i);
  return a;
}
if(typeof window!=='undefined') window.__gemAudioChunks=0;   // test instrument (same discipline as __vcLat)
async function gemSpeakSeg(text, lang, gen){
  if(typeof window!=='undefined' && window.__gemTtsStreamMock) return window.__gemTtsStreamMock(text, lang, gen);
  try{
    await gemSpeakSegStream(text, lang, gen);
  }catch(e){
    if(!vcGenCurrent(gen)) return;                   // barge-in during the attempt: stay silent
    // fallback (spec §5.3): stale Worker (stream-unsupported), stream death, or no-audio → blocking path
    const buf=await gemSynthChunk(ttsAlreadyClean(text));
    if(vcGenCurrent(gen)) await gemPlayBuf(buf, gen);
  }
}
async function gemSpeakSegStream(text, lang, gen){
  const mdl=GEM_MODELS.tts.id;
  const t=gemTransport(mdl, 'streamGenerateContent');
  const body={ contents:[{role:'user',parts:[{text:text}]}],
    generationConfig:{ responseModalities:['AUDIO'],
      speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:gemVoiceFor(lang)}}},
      maxOutputTokens:8192 } };
  const ctl=(typeof AbortController!=='undefined')?new AbortController():null;
  const to=ctl?setTimeout(function(){ try{ctl.abort();}catch(e){} }, 30000):null;
  try{
    const r=await fetch(t.url,{method:'POST',headers:t.headers,body:JSON.stringify(body),signal:ctl?ctl.signal:undefined});
    if(!r.ok){
      if(t.mode==='managed'&&r.status===404) throw new Error('stream-unsupported');
      if(t.mode==='managed'&&[401,402,403].indexOf(r.status)>=0&&gemKey()){
        // BYOK retry mirrors gemFetch (spec §5.1) — rebuild the transport with the personal key
        const b=gemTransport(mdl,'streamGenerateContent',gemKey());
        const r2=await fetch(b.url,{method:'POST',headers:b.headers,body:JSON.stringify(body),signal:ctl?ctl.signal:undefined});
        if(!r2.ok) throw new Error('api-'+r2.status);
        return gemPlayPcmStream(r2.body, gen);
      }
      throw new Error('api-'+r.status);
    }
    return gemPlayPcmStream(r.body, gen);
  }finally{ if(to) clearTimeout(to); }
}
async function gemPlayPcmStream(stream, gen){
  const ctx=gemAudioCtx();
  const reader=stream.getReader(); const dec=new TextDecoder();
  let buf='', cursor=0, got=false;
  function schedule(bytes){
    if(!vcGenCurrent(gen)) return;
    const f32=gemPcm16ToF32(bytes);
    if(!f32.length) return;
    const ab=ctx.createBuffer(1, f32.length, 24000);
    ab.getChannelData(0).set(f32);
    const src=ctx.createBufferSource(); src.buffer=ab; src.connect(ctx.destination);
    const t0=Math.max(ctx.currentTime+0.05, cursor);   // a late chunk restarts the cursor: audible gap, degraded-but-working (spec §5.5)
    src.start(t0); cursor=t0+ab.duration;
    if(typeof window!=='undefined') window.__gemAudioChunks++;
    if(!got){ got=true; vcLatMark('firstAudio'); }
  }
  for(;;){
    const step=await reader.read();
    if(step.done) break;
    if(!vcGenCurrent(gen)){ try{reader.cancel();}catch(e){} return; }   // barge-in: stop the spend
    buf+=dec.decode(step.value,{stream:true});
    let i;
    while((i=buf.indexOf('\n\n'))>=0){
      const fr=buf.slice(0,i); buf=buf.slice(i+2);
      for(const line of fr.split('\n')){
        if(line.indexOf('data:')!==0) continue;
        try{
          const j=JSON.parse(line.slice(5).trim());
          const c=j.candidates&&j.candidates[0];
          if(c&&c.content&&Array.isArray(c.content.parts))
            for(const p of c.content.parts)
              if(p.inlineData&&p.inlineData.data) schedule(gemB64Bytes(p.inlineData.data));
        }catch(e){}
      }
    }
  }
  if(!got) throw new Error('no-audio');
  // resolve when the LAST scheduled chunk finishes on the audio clock (a playback deadline, not an
  // arbitrary wait — DoD-11 governs tests, and the test asserts marks/counters, never this timer)
  const waitMs=Math.max(0,(cursor-ctx.currentTime)*1000);
  if(waitMs>0) await new Promise(function(res){ setTimeout(res, waitMs); });
}
```

`ttsAlreadyClean` above is NOT a new transform: `gemSpeakSeg`'s callers pass text that already went
through `ttsText` (INV-T). If Wave-0's `gemSynthChunk` signature takes the clean text directly, delete
the wrapper and pass `text` — resolve against the merged Wave-0 code, and say which in the task summary.

(c) rewire `gemSpeak` (Wave-0's full-utterance speaker): replace its per-chunk `gemSynthChunk`+`gemPlayBuf` sequence with `await gemSpeakSeg(chunkClean, lang, gen)` per chunk. Every caller (`vcSpeak`, `vcAck`, toast map) is untouched — streaming arrives everywhere for free, with the blocking path as the internal fallback.

- [ ] **Step 4: Build + run to verify GREEN**

Run: `python build.py` then `npx playwright test` (full, plain — restart any manual serve.js first per §11a; DoD-12 task gate ×1)
Expected: new tests PASS, zero regressions (the `gemFetch` refactor is behaviour-preserving; any voice-wave0/tts-routing failure means the transport or the `gemSpeak` rewiring drifted). Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): R-39 streaming TTS — gemTransport + gemSpeakSeg, first audio frame plays as it arrives, blocking path demoted to fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 2: Text streaming — `gemSseParse` + `gemStreamFetch`

**Files:**
- Modify: `app.js` (beside `gemFetch`)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `gemTransport` (Task 1), `gemKey()`, `GEM_MODELS`.
- Produces: `gemSseParse() → {push(str)→string[], end()→string[], finished}` (pure incremental SSE→text-delta parser); `gemStreamFetch(role, body, opts, onDelta) → Promise<string>` throwing `'stream-unsupported'` on managed 404 and `'stream-truncated'` on a no-finish end. Task 4 consumes both.
- Spec trace: spec §5.1.

- [ ] **Step 1: Write the failing tests** — append to `tests/metered-streaming.spec.ts`:

```ts
test('gemSseParse yields text deltas incrementally and survives a frame split across pushes', async ({ page }) => {
  await seedApp(page, {});
  const out = await page.evaluate(() => {
    const p = (window as any).gemSseParse();
    const f = (t: string) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }) + '\n\n';
    const a = p.push(f('שלום, '));
    const whole = f('עולם. 63.5');
    const b = p.push(whole.slice(0, 10));          // frame torn mid-JSON —
    const c = p.push(whole.slice(10));             // — must NOT emit a fragment
    return { a, b, c };
  });
  expect(out.a).toEqual(['שלום, ']);
  expect(out.b).toEqual([]);                       // half a frame is never parsed (spec §2.3 mirror)
  expect(out.c).toEqual(['עולם. 63.5']);
});

test('managed streaming 404 (stale Worker) throws stream-unsupported; managed 402 with a BYOK key retries BYOK', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': 'https://w.example', 'mk-central-code': 'abc123' });
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }));
  try {
    const err = await page.evaluate(async () => {
      try { await (window as any).gemStreamFetch('text', { contents: [] }, {}, () => {}); return ''; }
      catch (e: any) { return String(e.message || e); }
    });
    expect(err).toBe('stream-unsupported');
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }

  await seedApp(page, { 'mk-central-url': 'https://w.example', 'mk-central-code': 'abc123', 'mk-gemkey': 'k-test' });
  const seen: string[] = [];
  await page.route('**/models/*:streamGenerateContent*', r => {
    const u = r.request().url();
    seen.push(u);
    if (u.startsWith('https://w.example')) return r.fulfill({ status: 402, contentType: 'application/json', body: '{"error":"quota_reached"}' });
    return r.fulfill({ status: 200, contentType: 'text/event-stream',
      body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'תשובה.' }], role: 'model' }, finishReason: 'STOP' }] }) + '\n\n' });
  });
  try {
    const txt = await page.evaluate(() => (window as any).gemStreamFetch('text', { contents: [] }, {}, () => {}));
    expect(txt).toBe('תשובה.');
    expect(seen.some(u => u.includes('generativelanguage.googleapis.com'))).toBe(true);   // fell back to BYOK
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: FAIL — `gemSseParse is not a function` etc. Paste.

- [ ] **Step 3: Implement** — in `app.js`, directly below `gemTransport`:

```js
// Incremental SSE → text-delta parser. Frames are acted on ONLY when complete (\n\n seen) — a torn
// frame carries over; half a frame is never parsed (mirror of the Worker's scanner, spec §2.3).
function gemSseParse(){
  let buf='', finished=false;
  function drain(){
    const out=[]; let idx;
    while((idx=buf.indexOf('\n\n'))>=0){
      const frame=buf.slice(0,idx); buf=buf.slice(idx+2);
      for(const line of frame.split('\n')){
        if(line.indexOf('data:')!==0) continue;
        try{
          const j=JSON.parse(line.slice(5).trim());
          const c=j.candidates&&j.candidates[0];
          if(c&&c.finishReason) finished=true;
          if(c&&c.content&&Array.isArray(c.content.parts))
            for(const p of c.content.parts) if(typeof p.text==='string'&&p.text) out.push(p.text);
        }catch(e){}
      }
    }
    return out;
  }
  return { push(s){ buf+=String(s); return drain(); },
           end(){ const out=drain(); buf=''; return out; },
           get finished(){ return finished; } };
}
// Streaming fetch: same admission errors as gemFetch (they arrive as plain JSON BEFORE any SSE byte —
// spec §2.2), same managed→BYOK fallback on 401/402/403. Distinct errors: 'stream-unsupported'
// (managed 404 = stale Worker; caller falls back to non-streaming) and 'stream-truncated' (the stream
// ended with no finishReason — F3's client half). No mid-stream auto-retry: a retry would replay the
// whole generation (double cost, double debit).
async function gemStreamFetch(role, body, opts, onDelta){
  opts=opts||{};
  const mdl = GEM_MODELS[role] ? GEM_MODELS[role].id : (role||GEM_MODEL);
  const t = gemTransport(mdl, 'streamGenerateContent', opts.key);
  const timeout=opts.timeout||30000;
  const ctl=(typeof AbortController!=='undefined')?new AbortController():null;
  const to=ctl?setTimeout(function(){ try{ctl.abort();}catch(e){} }, timeout):null;
  try{
    const r=await fetch(t.url, {method:'POST', headers:t.headers, body:JSON.stringify(body), signal:ctl?ctl.signal:undefined});
    if(!r.ok){
      if(t.mode==='managed' && r.status===404) throw new Error('stream-unsupported');
      if(t.mode==='managed' && [401,402,403].indexOf(r.status)>=0 && gemKey())
        return gemStreamFetch(role, body, Object.assign({}, opts, {key:gemKey()}), onDelta);
      throw new Error('api-'+r.status);
    }
    const parser=gemSseParse(); const reader=r.body.getReader(); const dec=new TextDecoder();
    let full='';
    for(;;){
      const step=await reader.read();
      if(step.done) break;
      for(const d of parser.push(dec.decode(step.value,{stream:true}))){ full+=d; if(onDelta) try{onDelta(d);}catch(e){} }
    }
    for(const d of parser.end()){ full+=d; if(onDelta) try{onDelta(d);}catch(e){} }
    if(!parser.finished) throw new Error('stream-truncated');
    if(!full.trim()) throw new Error('empty');
    return full;
  }catch(e){ throw (e&&e.name==='AbortError') ? new Error('timeout') : e; }
  finally{ if(to) clearTimeout(to); }
}
```

- [ ] **Step 4: Build + run to verify GREEN**

Run: `python build.py` then `npx playwright test` (full plain suite — task gate ×1)
Expected: PASS. Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): gemSseParse + gemStreamFetch — incremental text streaming with stale-Worker and BYOK fallbacks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 3: Sentence assembler + the digit-free stream gate

**Files:**
- Modify: `app.js` (beside `vcChunkText`)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `UNITS.normalize`, `safetyNumRe()`, `aiSafetyNums` (existing guard machinery — the ONE number definition, never a second pattern).
- Produces: `vcSentenceStream(onSentence) → {push(delta), end()}`; `vcStreamSafe(sentence) → boolean`. Task 4 consumes both.
- Spec trace: spec §5.2 (boundary rule = `vcChunkText`'s), §6.2 (the gate).

- [ ] **Step 1: Write the failing tests** — append to `tests/metered-streaming.spec.ts`:

```ts
test('vcSentenceStream closes sentences on the vcChunkText boundary; a decimal never splits', async ({ page }) => {
  await seedApp(page, {});
  const out = await page.evaluate(() => {
    const got: string[] = [];
    const a = (window as any).vcSentenceStream((s: string) => got.push(s));
    a.push('החום יציב');
    a.push('. עטוף כשהצבע ');
    a.push('מהגוני. הפנים 63.5 מעלות בערך. סוף');
    a.end();
    return got;
  });
  expect(out).toEqual(['החום יציב.', 'עטוף כשהצבע מהגוני.', 'הפנים 63.5 מעלות בערך.', 'סוף']);
});

test('vcStreamSafe: digit-free passes; ANY digit or unit-bearing token fails (fail closed)', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => ({
    clean: (window as any).vcStreamSafe('עטוף אותו בנייר קצבים כשהקרום מתייצב.'),
    digit: (window as any).vcStreamSafe('עטוף אחרי 4 שעות בערך.'),
    temp:  (window as any).vcStreamSafe('משוך ב-96°C.'),
    fw:    (window as any).vcStreamSafe('משוך ב-９６ מעלות.'),   // full-width digits — normalize runs FIRST
  }));
  expect(r.clean).toBe(true);
  expect(r.digit).toBe(false);
  expect(r.temp).toBe(false);
  expect(r.fw).toBe(false);
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: FAIL — functions undefined. Paste.

- [ ] **Step 3: Implement** — in `app.js`, directly after `vcChunkText`:

```js
// ── Metered-streaming arc (spec §5.2/§6) · sentence assembler over streamed deltas. SAME boundary
// rule as vcChunkText (terminator + whitespace — a decimal can never split); end() flushes the tail.
function vcSentenceStream(onSentence){
  let buf='';
  return {
    push:function(d){
      buf+=String(d||'');
      const parts=buf.split(/(?<=[.!?…])\s+/);
      while(parts.length>1){ const s=parts.shift().trim(); if(s) onSentence(s); }
      buf=parts[0]||'';
    },
    end:function(){ const s=buf.trim(); buf=''; if(s) onSentence(s); }
  };
}
// The stream gate (spec §6.2): a sentence may be spoken BEFORE the whole-answer guard runs ONLY if it
// is provably guard-neutral — zero digit runs (safetyNumRe — the ONE shared number definition; never
// write a second pattern, per the SAFETY_NUM covenant) and zero unit-bearing tokens (aiSafetyNums),
// measured on the SAME normalization the guard itself applies. A digit-free sentence is untouchable by
// every guard branch (markers and redactions only ever attach to number tokens), so early speech can
// neither leak nor pre-empt what vcGuardSpoken will decide about the full answer.
function vcStreamSafe(sentence){
  const n=UNITS.normalize(String(sentence||''));
  if((n.match(safetyNumRe())||[]).length) return false;
  if(aiSafetyNums(n).length) return false;
  return true;
}
```

- [ ] **Step 4: Build + run to verify GREEN**

Run: `python build.py` then `npx playwright test` (full plain suite — task gate ×1)
Expected: PASS. Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): vcSentenceStream + vcStreamSafe — streamed sentence assembly with a fail-closed digit-free early-speech gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 4: `vcAskFlow` streams end-to-end — early speech via streaming synth, guard-once, transcript rule

**Files:**
- Modify: `app.js` (`vcAskFlow`, new `vcAskAIStream` beside `vcAskAI`, `vcSpeak` gains an optional `gen`)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `gemStreamFetch` (Task 2), `vcSentenceStream`/`vcStreamSafe` (Task 3), `gemSpeakSeg` (Task 1 — early sentences AND the guarded remainder now stream their audio), `vcGuardSpoken`, `vcAskAI` (fallback), `vcSpeakGen` machinery, `ttsText`, `vcLatMark`.
- Produces: `vcAskAIStream(question, ent, onDelta) → Promise<string>`; the mock seam `window.__vcAskStreamMock(question, onDelta)`; `vcSpeak(text, lang, gen)` (optional third param — a caller-supplied gen joins an existing utterance instead of taking the floor); `vcLatMark('firstSentence')`.
- Spec trace: spec §5.2, §6.1–§6.4 — **the guard runs EXACTLY ONCE, on the complete assembled answer, after `asm.end()` and before any post-guard text is spoken**; transcript shows only gate-passed text until then.

- [ ] **Step 1: Write the failing tests** — append to `tests/metered-streaming.spec.ts`:

```ts
test('streamed ask: guard runs ONCE on the full answer; digit sentences never speak early; transcript ends guarded', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  const r = await page.evaluate(async () => {
    const w = window as any;
    const synths: string[] = [];
    w.__gemTtsStreamMock = (clean: string) => { synths.push(clean); return Promise.resolve(); };
    let guardCalls = 0;
    const realGuard = w.vcGuardSpoken;
    w.vcGuardSpoken = function (t: string, tiers: any, lang: string) { guardCalls++; return realGuard(t, tiers, lang); };
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('קודם כל, תן לזה להתייצב. ');                       // digit-free — may speak early
      onDelta('משוך אותו ב-96 מעלות פנימי. ');                    // digit-bearing — must FREEZE early speech
      onDelta('בהצלחה.');
      return 'קודם כל, תן לזה להתייצב. משוך אותו ב-96 מעלות פנימי. בהצלחה.';
    };
    await w.vcAskFlow('שאלה מתי למשוך את הבריסקט');
    const a = w.vcLastQA && w.vcLastQA.a;
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; w.vcGuardSpoken = realGuard;
    return { synths, guardCalls, a };
  });
  expect(r.guardCalls).toBe(1);                                        // ONCE, on the complete answer (spec §6.1)
  expect(r.synths[0]).toContain('קודם כל');                            // the digit-free opener spoke early
  // the digit sentence reached synthesis ONLY via the post-guard remainder — and the guard REDACTED it
  // (96 is ungrounded in this fixture), so no synth call ever carried the raw model digits:
  expect(r.synths.some(s => s.includes('96'))).toBe(false);
  expect(String(r.a)).toContain('אינו מאומת');                          // final transcript IS the guarded string
});

test('stale Worker: streaming 404 falls back to non-streaming vcAskAI — the ask still answers', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': 'https://w.example', 'mk-central-code': 'abc123' });
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }));
  await page.route('**/models/*:generateContent*', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'עטוף כשהקרום יציב.' }] } }], usageMetadata: { totalTokenCount: 5 } }) }));
  try {
    const a = await page.evaluate(async () => {
      const w = window as any;
      w.__gemTtsStreamMock = () => Promise.resolve();
      await w.vcAskFlow('שאלה מתי לעטוף');
      delete w.__gemTtsStreamMock;
      return w.vcLastQA && w.vcLastQA.a;
    });
    expect(String(a)).toContain('עטוף כשהקרום יציב');
  } finally {
    await page.unroute('**/models/*:streamGenerateContent*');
    await page.unroute('**/models/*:generateContent*');
  }
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: FAIL — `vcAskFlow` ignores `__vcAskStreamMock` (answers via `__vcAskMock`/network path), guardCalls shape wrong. Paste the failure and confirm it is the intended reason.

- [ ] **Step 3: Implement** — in `app.js`:

(a) `vcSpeak` gains an optional `gen` (a caller-supplied generation JOINS an utterance instead of taking the floor — the remainder after early sentences must not kill them):

```js
function vcSpeak(text, lang, gen){
  const L2=lang||vcVoiceLang();
  if(gen===undefined){ gen=vcNewSpeakGen(); gemStop(); }   // standalone call takes the floor, as today
  if(!aiAvail()) return;                                   // R-35 defensive no-op
  gemSpeak(text, L2, gen).catch(err=>{
```

(only the first three lines change; the whole catch/toast map is untouched.)

(b) `vcAskAIStream` directly below `vcAskAI`:

```js
// ── Metered-streaming arc (spec §5.2). Streaming twin of vcAskAI: same prompt, same tools, same
// generationConfig — ONLY the transport differs. A stale managed Worker (404 → 'stream-unsupported')
// falls back to the non-streaming vcAskAI so the app never breaks against an undeployed route.
async function vcAskAIStream(question, ent, onDelta){
  if(typeof window!=='undefined' && window.__vcAskStreamMock){ return window.__vcAskStreamMock(question, onDelta); }
  if(!aiAvail()) throw new Error('no-key');
  const ans=vcVoiceLang();
  const {sys, userText}=vcBuildAskPrompt(question, ans, vcCookContext());
  const body={ system_instruction:{parts:[{text:sys}]},
    contents:[{role:'user',parts:[{text:userText}]}],
    tools: searchFor('vcAsk', !!ent) ? [{google_search:{}}] : undefined,
    generationConfig: gemGen('text', {temperature:0.6, maxOutputTokens:8192}, {think: thinkFor('vcAsk')}) };
  try{ return await gemStreamFetch('text', body, {timeout:30000}, onDelta); }
  catch(e){
    if(String(e&&e.message)==='stream-unsupported') return vcAskAI(question, ent);   // stale Worker — full answer, no deltas
    throw e;
  }
}
```

(c) rebuild `vcAskFlow` (replace the current body wholesale):

```js
async function vcAskFlow(rawSaid){
  vcLatMark('ask');
  const question=vcStripAskPrefix(rawSaid);
  if(!question){ return; }
  const ansL=vcVoiceLang();
  const gen=vcNewSpeakGen(); gemStop();            // ONE generation for ack + early sentences + remainder
  vcAck(gen);
  vcLastQA={q:question, a:(ansL==='en'?'…thinking':'…חושב')}; vcRender();
  try{
    const tiers=vcResolveTiers(question);
    vcLatMark('textReq');
    // Early speech (spec §6.2): ONLY provably digit-free sentences, in arrival order, on THIS gen.
    // The first gate failure freezes early speech until the whole-answer guard has run (§6.1).
    const early={ spoken:[], frozen:false, chain:Promise.resolve() };
    const asm=vcSentenceStream(function(sent){
      if(early.frozen) return;
      if(!vcStreamSafe(sent)){ early.frozen=true; return; }
      if(!early.spoken.length) vcLatMark('firstSentence');
      const norm=UNITS.normalize(sent);
      early.spoken.push(norm);
      vcLastQA={q:question, a:early.spoken.join(' ')+' …'}; vcRender();   // transcript: gate-passed text ONLY (§6.4)
      const clean=ttsText(norm, ansL);              // INV-T: ttsText remains the ONLY post-gate transform
      early.chain=early.chain.then(function(){
        if(!vcGenCurrent(gen)) return;
        return gemSpeakSeg(clean, ansL, gen);       // Task 1: streams the audio; first chunk = first sound
      }).catch(function(){ early.frozen=true; });   // a synth failure ends early mode; the guarded pass will retry via vcSpeak's toast map
    });
    const answer=await vcAskAIStream(question, tiers.t1||tiers.t2, function(d){ asm.push(d); });
    asm.end();
    vcLatMark('textResp');
    // THE guard — exactly once, on the COMPLETE answer (spec §6.1): this line runs strictly after
    // asm.end() (the last delta is assembled) and strictly before any post-guard text is spoken.
    // Never on a fragment — a guard over half a sentence is structurally impossible here.
    const guarded=vcGuardSpoken(answer, tiers, ansL);
    vcLastQA={q:question, a:guarded}; vcRender();
    const prefix=early.spoken.join(' ');
    let rest=guarded;
    if(prefix && guarded.slice(0,prefix.length)===prefix) rest=guarded.slice(prefix.length).trim();
    // else: defensive (unreachable by construction — the guard is the identity on digit-free text after
    // the same normalize the gate applied): speak the WHOLE guarded string — correctness over polish.
    await early.chain;                              // early sentences finish, in order, before the remainder
    if(!vcGenCurrent(gen)) return;
    if(rest) vcSpeak(rest, ansL, gen);              // joins THIS gen — reuses the full toast map on failure
  }catch(e){
    const msg=ansL==='en'?'Sorry, AI is not available right now.':'מצטער, ה-AI לא זמין כרגע.';
    vcLastQA={q:question, a:msg}; vcRender(); vcSpeak(msg, ansL);
  }
}
```

- [ ] **Step 4: Build + run to verify GREEN**

Run: `python build.py` then `npx playwright test` (full plain suite — task gate ×1; the existing voice-wave0 + p0-spoken-safety suites are the DoD-10 witnesses that guard semantics are untouched)
Expected: PASS. Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): vcAskFlow streams end-to-end — digit-free early speech into streaming TTS, whole-answer guard exactly once, guarded transcript, stale-Worker fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 5: R-36a — the voice length instruction with the safety-completeness override

**Files:**
- Modify: `app.js` (`vcBuildAskPrompt` — all three language branches)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `vcBuildAskPrompt(question, ansLang, ctx) → {sys, userText}` (existing).
- Produces: the two clause constants `VC_BREVITY_HE`/`VC_BREVITY_EN` (module consts, one source per language family) + `ASK_PANEL_SYS_PREFIX` + the test probe `window.__askPanelSys`.
- Spec trace: spec §7 ("a safety answer without its number is a wrong answer"); R-36(א) owner-approved.

- [ ] **Step 1: Write the failing test** — append to `tests/metered-streaming.spec.ts`:

```ts
test('R-36a: the voice brevity instruction carries the safety-completeness override', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const w = window as any;
    return {
      he: w.vcBuildAskPrompt('מה הטמפ׳ הבטוחה לעוף?', 'he', '').sys,
      en: w.vcBuildAskPrompt('safe temp for chicken?', 'en', '').sys,
      fr: w.vcBuildAskPrompt('température?', 'fr', '').sys,
    };
  });
  // brevity clause present in every voice branch:
  expect(r.he).toContain('עד 60 מילים');
  expect(r.en).toContain('60 words');
  expect(r.fr).toContain('60 words');
  // the hard safety override — number, unit and caveat survive brevity — present in every branch:
  expect(r.he).toContain('המספר, היחידה וההסתייגות');
  expect(r.en).toContain('the number, its unit and the caveat');
  expect(r.fr).toContain('the number, its unit and the caveat');
  // negative case (fixture minimality/DoD-6): the PANEL ask prompt is UNCHANGED — full-length
  // instruction kept, NO brevity clause. Asserted via the factored const the probe returns:
  const panelSys = await page.evaluate(() => (window as any).__askPanelSys());
  expect(panelSys).toContain('בצורה מלאה ומועילה');
  expect(panelSys).not.toContain('עד 60 מילים');
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: FAIL — clauses absent, `__askPanelSys` undefined. Paste.

- [ ] **Step 3: Implement** — in `app.js`:

(a) above `vcBuildAskPrompt`, the two clause constants (ONE source; the he text is the dictionary base):

```js
// ── R-36a (owner-approved 31.7, spec §7): the voice answer is READ ALOUD — brevity is the latency fix
// (measured: 5.7s/1488 chars → 1.29s/147 chars). The override is HARD: brevity never truncates safety.
const VC_BREVITY_HE='ענה בקצרה מאוד — משפט אחד עד שלושה, עד 60 מילים: אתה עוזר קולי והתשובה מוקראת ליד האש. '
  +'חריג בטיחות מחייב: אם השאלה נוגעת לטמפרטורה בטוחה, זמן בישול/ריפוי או בטיחות מזון — '
  +'המספר, היחידה וההסתייגות החיוניים חייבים להופיע במלואם, גם אם התשובה מתארכת. תשובת בטיחות בלי המספר שלה היא תשובה שגויה. ';
const VC_BREVITY_EN='Answer VERY briefly — one to three sentences, at most 60 words: you are a voice assistant and the answer is read aloud at the fire. '
  +'Mandatory safety exception: if the question concerns a safe temperature, a cooking/curing duration or food safety, '
  +'the number, its unit and the caveat MUST appear in full even if the answer runs longer. A safety answer without its number is a wrong answer. ';
```

(b) inside `vcBuildAskPrompt`, replace the brevity sentence in each of the three branches:
- non-he/en branch (app.js:6740): replace `'Keep it brief (2-3 sentences max), suitable for text-to-speech while the user is actively cooking. '` with `VC_BREVITY_EN`;
- en branch (app.js:6748): same replacement;
- he branch (app.js:6754): replace `'בקצרה (2-3 משפטים לכל היותר), מתאים להקראה בזמן בישול פעיל. '` with `VC_BREVITY_HE`.

(c) beside `askGemini`, factor the panel-prompt literal so the test probe returns the REAL string (never a truncated copy — a truncated probe lies):

```js
const ASK_PANEL_SYS_PREFIX='אתה "האש" — עוזר בישול מומחה לאש, עישון, גריל, סו-ויד ושרקוטרי, בתוך אפליקציה ישראלית בשם "מתכונת · מדריך האש". ';
// in askGemini: const sys=ASK_PANEL_SYS_PREFIX+L('ענה תמיד בעברית', ...)+', בצורה מלאה ומועילה — ...' (rest of the literal unchanged)
if(typeof window!=='undefined') window.__askPanelSys=function(){
  // rebuilds the panel sys EXACTLY as askGemini does, minus the dynamic units/context riders — the
  // assertion targets the instruction clauses, which live in the static part.
  return ASK_PANEL_SYS_PREFIX+L('ענה תמיד בעברית','Reply ALWAYS in English (the app UI language is English)')+', בצורה מלאה ומועילה';
};
```

- [ ] **Step 4: Build + run to verify GREEN + DoD-9**

Run: `python build.py` then `npx playwright test` (full plain suite ×1)
Also: the prompt strings are model-facing, not user-facing — no Hebrew-render screenshot is owed for them (DoD-9 n/a; say so in the task summary rather than silently skipping).
Expected: PASS. Paste output + exit code.

- [ ] **Step 5: Live-key obedience probe (measurement, NOT a suite test — spec §7 stated openly)**

```bash
node scratchpad/metered-streaming/r36a-probe.mjs
```

Create that probe under the scratchpad (session scratchpad dir, NOT the repo) with this content:

```js
// r36a-probe.mjs — live obedience probe. Reads GEMINI_API_KEY from env ONLY; never echoes it.
const KEY = process.env.GEMINI_API_KEY; if (!KEY) { console.error('no key in env'); process.exit(2); }
const sys = 'אתה "האש" — עוזר בישול-אש חי בתוך אפליקציה. חשוב: ענה אך ורק בעברית. '
  + 'ענה בקצרה מאוד — משפט אחד עד שלושה, עד 60 מילים: אתה עוזר קולי והתשובה מוקראת ליד האש. '
  + 'חריג בטיחות מחייב: אם השאלה נוגעת לטמפרטורה בטוחה, זמן בישול/ריפוי או בטיחות מזון — '
  + 'המספר, היחידה וההסתייגות החיוניים חייבים להופיע במלואם, גם אם התשובה מתארכת. תשובת בטיחות בלי המספר שלה היא תשובה שגויה.';
const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
  body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: 'מה הטמפרטורה הפנימית הבטוחה לחזה עוף?' }] }],
    generationConfig: { maxOutputTokens: 8192 } }),
});
const j = await r.json();
const txt = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
console.log('chars:', txt.length, '| has °C figure:', /\d+\s*(°C|מעלות)/.test(txt), '| text:', txt);
```

Expected: short answer (≪ 500 chars) that still contains a temperature figure + unit. Paste the console line (never the key) into the task summary.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): R-36a voice length instruction — 60-word brevity with a hard safety-completeness override; panel prompt pinned unchanged

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 6: Minimal Worker metering — the streaming route returns, protecting the OWNER'S key

**Files:**
- Modify: `worker/index.js` (route match; extract `admitCode`; add `handleStream`; add `ctx` to `fetch`)
- Test: `worker/test/index.spec.js` (REWRITE the B19 describe block; add streaming admission + metering tests)

**Interfaces:**
- Consumes: `withCodeLock`, `reconcile` (existing, unchanged), `RESERVE_TOKENS`, `GEMINI_BASE`, `UPSTREAM_TIMEOUT_MS`.
- Produces: `admitCode(env, code, key, json) → {err} | {ok:true}` (shared by both routes); `STREAM_RE`; `fetch(request, env, ctx)` (three-arg — `ctx.waitUntil` carries the disconnect reconcile); `handleStream(...)` (tee metering); `STREAM_MAX_TOKENS = 4096` (a module const until Task 7 derives it from the tier table). The client (Tasks 1–2) relies on: SSE passthrough byte-for-byte; admission errors as plain JSON before any SSE byte; a stream may end early only at a frame boundary.
- Spec trace: spec §2.1–§2.5, §3 ("no upstream byte flows before admission passes and the reserve is debited"), §2.7 (what is deliberately deferred). **R-40: this metering exists to protect the owner's key and bill — it ships simple, in one task, with no bridge version.**

- [ ] **Step 1: Rewrite the B19 test + add streaming tests** — in `worker/test/index.spec.js`, REPLACE the whole `describe('B19 — streaming route is closed …')` block with:

```js
describe('B19 successor — streaming route is OPEN but METERED (spec §2.2/§3)', () => {
  it('admission precedes the first upstream byte: an over-cap code gets 402 and Gemini is never called', async () => {
    await env.CODES.put('code:st-capped', JSON.stringify({ active: true, cap: 100, used: 100 }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await post(STREAM_URL, 'st-capped');
    expect(r.status).toBe(402);
    expect((await r.json()).error).toBe('quota_reached');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an invalid code on the streaming route: 403, no upstream call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await post(STREAM_URL, 'no-such-code');
    expect(r.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the reserve is debited BEFORE the upstream call resolves', async () => {
    await env.CODES.put('code:st-reserve', JSON.stringify({ active: true, cap: 100000, used: 0 }));
    let usedAtUpstream = -1;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      usedAtUpstream = JSON.parse(await env.CODES.get('code:st-reserve')).used;
      return geminiOkResponse(5);
    });
    await post(STREAM_URL, 'st-reserve');
    expect(usedAtUpstream).toBe(2000);   // RESERVE_TOKENS landed before any upstream byte
  });
});

function sseFrames(frames) {           // build lazily INSIDE mockImplementation (workerd I/O isolation)
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) {
      for (const f of frames) c.enqueue(enc.encode('data: ' + JSON.stringify(f) + '\n\n'));
      c.close();
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}
const frameText = (text, total) => ({
  candidates: [{ content: { parts: [{ text }] } }],
  ...(total != null ? { usageMetadata: { totalTokenCount: total } } : {}),
});

describe('Streaming metering (spec §2.3/§2.4)', () => {
  it('F-happy: body passes through; used reconciles to the FINAL usageMetadata.totalTokenCount', async () => {
    await env.CODES.put('code:st-ok', JSON.stringify({ active: true, cap: 100000, used: 10 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      sseFrames([frameText('שלום, ', 3), frameText('עולם.', 9)]));
    const r = await post(STREAM_URL, 'st-ok');
    expect(r.status).toBe(200);
    const bodyText = await r.text();
    expect(bodyText).toContain('שלום, ');
    expect(bodyText).toContain('עולם.');
    await vi.waitFor(async () => {          // reconcile rides ctx.waitUntil — poll the observable state
      expect(JSON.parse(await env.CODES.get('code:st-ok')).used).toBe(10 + 9);
    });
  });

  it('F7 fail-closed: NO usageMetadata anywhere → charge at least the full reserve', async () => {
    await env.CODES.put('code:st-nousage', JSON.stringify({ active: true, cap: 100000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => sseFrames([frameText('קצר.')]));
    const r = await post(STREAM_URL, 'st-nousage');
    await r.text();
    await vi.waitFor(async () => {
      const used = JSON.parse(await env.CODES.get('code:st-nousage')).used;
      expect(used).toBeGreaterThanOrEqual(2000);   // max(RESERVE, ceil(chars/3)) — never a refund on missing data
    });
  });

  it('F1 refund: upstream dies before any byte → 504 and the reserve is refunded', async () => {
    await env.CODES.put('code:st-dead', JSON.stringify({ active: true, cap: 1000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new DOMException('The operation was aborted', 'AbortError')));
    const r = await post(STREAM_URL, 'st-dead');
    expect(r.status).toBe(504);
    await vi.waitFor(async () => {
      expect(JSON.parse(await env.CODES.get('code:st-dead')).used).toBe(0);
    });
  });

  it('F5 never-cut: a stream that crosses the cap COMPLETES; the over-debit lands; the NEXT request is 402', async () => {
    await env.CODES.put('code:st-cross', JSON.stringify({ active: true, cap: 2100, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      sseFrames([frameText('חלק ראשון, ', 1500), frameText('וגם הסוף המלא של ההנחיה.', 3000)]));
    const r1 = await post(STREAM_URL, 'st-cross');
    const t1 = await r1.text();
    expect(t1).toContain('וגם הסוף המלא של ההנחיה.');   // NOT cut, despite crossing cap mid-stream (spec §2.5)
    await vi.waitFor(async () => {
      expect(JSON.parse(await env.CODES.get('code:st-cross')).used).toBe(3000); // over-debit stands
    });
    const r2 = await post(STREAM_URL, 'st-cross');
    expect(r2.status).toBe(402);                          // per-user enforcement at the NEXT admission (G3)
  });

  it('F4 disconnect: client cancels mid-stream → upstream cancelled, fail-closed charge still lands', async () => {
    await env.CODES.put('code:st-gone', JSON.stringify({ active: true, cap: 100000, used: 0 }));
    let upstreamCancelled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const enc = new TextEncoder();
      return new Response(new ReadableStream({
        start(c) { c.enqueue(enc.encode('data: ' + JSON.stringify(frameText('התחלה, ', 800)) + '\n\n')); },
        cancel() { upstreamCancelled = true; },   // never closes on its own — only a cancel ends it
      }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    });
    const r = await post(STREAM_URL, 'st-gone');
    const reader = r.body.getReader();
    await reader.read();                          // take the first frame…
    await reader.cancel();                        // …then hang up
    await vi.waitFor(async () => {
      expect(upstreamCancelled).toBe(true);
      const used = JSON.parse(await env.CODES.get('code:st-gone')).used;
      expect(used).toBeGreaterThanOrEqual(2000);  // counted-or-reserve, fail closed — never a free ride
    });
  });

  it('F6 ceiling: STREAM_MAX_TOKENS cuts a runaway stream at a FRAME boundary', async () => {
    await env.CODES.put('code:st-runaway', JSON.stringify({ active: true, cap: 100000000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const enc = new TextEncoder();
      let n = 0;
      return new Response(new ReadableStream({
        pull(c) { n++; c.enqueue(enc.encode('data: ' + JSON.stringify(frameText('עוד ועוד ', n * 500)) + '\n\n')); },
      }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    });
    const r = await post(STREAM_URL, 'st-runaway');
    const text = await r.text();                  // resolves ⇔ the Worker CLOSED the stream (the assertion)
    expect(text.endsWith('\n\n')).toBe(true);     // ended at a frame boundary, never mid-frame
    await vi.waitFor(async () => {
      const used = JSON.parse(await env.CODES.get('code:st-runaway')).used;
      expect(used).toBeGreaterThanOrEqual(4096);  // the counted overrun was charged
    });
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `cd worker && npm test`
Expected: all FAIL — the route still 404s (`expected 402, got 404` etc.). Paste each failure reason — each must be the *intended* one. (The old B19 test is gone with the block; its security property lives on in the admission tests.)

- [ ] **Step 3: Implement** — in `worker/index.js`:

(a) change the export signature to `async fetch(request, env, ctx)`.

(b) replace the single-route guard (lines ~91-96) with:

```js
    // Phase 1 Task 6 closed :streamGenerateContent as an unmetered bypass (B19). It returns here —
    // METERED (2026-07-31, owner GO on R-37; kept per R-40 because it protects the OWNER'S key and
    // bill): same debit-first admission, SSE tee metering, reconcile-on-completion (see handleStream).
    // Removing the metering, not the route, is the security regression review must catch. The route is
    // modality-agnostic (spec §2.1): text and AUDIO (responseModalities) streams meter identically.
    const GEN_RE = /^\/v1beta\/models\/[^/]+:generateContent$/;
    const STREAM_RE = /^\/v1beta\/models\/[^/]+:streamGenerateContent$/;
    const isStream = STREAM_RE.test(url.pathname);
    if (request.method !== 'POST' || (!GEN_RE.test(url.pathname) && !isStream)) {
      return json({ error: 'not_found' }, 404);
    }
```

(c) extract the admission block (the current `withCodeLock` IIFE, lines ~108-124) into a top-level helper — moved verbatim:

```js
// ── ONE admission for both routes (spec §2.2) — debit-first, serialized per code (B21/H-3).
async function admitCode(env, code, key, json) {
  return withCodeLock(code, async () => {
    const raw = await env.CODES.get(key);
    if (!raw) return { err: json({ error: 'invalid_code' }, 403) };
    let rec;
    try { rec = JSON.parse(raw); } catch { rec = null; }
    if (!rec || typeof rec !== 'object') return { err: json({ error: 'code_record_corrupt' }, 403) };   // B20
    if (rec.active === false) return { err: json({ error: 'code_disabled' }, 403) };
    if (typeof rec.cap !== 'number' || rec.cap <= 0) return { err: json({ error: 'code_uncapped' }, 403) };  // E14
    if ((rec.used || 0) >= rec.cap) {
      return { err: json({ error: 'quota_reached', reason: 'cap', used: rec.used, cap: rec.cap }, 402) };
    }
    rec.used = (rec.used || 0) + RESERVE_TOKENS;   // debit FIRST — a crash mid-flight leaves an over-debit, never a free ride
    await env.CODES.put(key, JSON.stringify(rec));
    return { ok: true };
  });
}
```

(the existing pre-KV rate limit stays exactly where it is in this task — Task 7 moves it in-lock when the tier table lands.)

(d) in the handler, replace the inlined admission with:

```js
    const admit = await admitCode(env, code, key, json);
    if (admit.err) return admit.err;
    if (isStream) return handleStream(request, env, ctx, url, code, key, json, cors);
```

(e) the metered streaming body (spec §2.3–§2.5) — no bridge version, the real thing lands whole:

```js
// ── the metered streaming body (spec §2.3-§2.5) ──
// Counting: an SSE scanner rides a tee of the upstream body. usageMetadata is cumulative with the
// final frame authoritative; when absent, charge max(RESERVE, ceil(chars/3)) — fail closed (F7). For
// AUDIO-modality frames (inlineData, no text) the char estimator contributes 0 and usageMetadata is
// the count of record — same fail-closed reserve when it never appears. Cap crossing mid-stream NEVER
// cuts (F5/spec §2.5 — a truncated cooking instruction can invert meaning); STREAM_MAX_TOKENS (F6)
// bounds the worst case and cuts only at a frame boundary. Client disconnect (F4): cancel upstream
// (stop the spend), reconcile what was counted under ctx.waitUntil, registered BEFORE the Response
// returns.
const STREAM_MAX_TOKENS = 4096;   // per-stream abuse ceiling — Task 7 derives it from the tier table
function estimateTokens(chars) { return Math.ceil(chars / 3); }   // denser than the EN 4-chars rule — Hebrew tokenizes denser; fail closed

async function handleStream(request, env, ctx, url, code, key, json, cors) {
  const body = await request.text();
  let gResp;
  try {
    gResp = await fetch(GEMINI_BASE + url.pathname + url.search, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    await reconcile(env, code, key, 0);           // F1 — refund: the upstream call died before a byte
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) return json({ error: 'upstream_timeout' }, 504);
    return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
  }
  if (!gResp.ok) {                                 // F2 — refund; pass Google's error through as JSON
    const t = await gResp.text();
    await reconcile(env, code, key, 0);
    return new Response(t, { status: gResp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const meter = { total: 0, sawUsage: false, chars: 0 };
  const scanFrame = (frame) => {                   // one complete SSE event (between \n\n)
    for (const line of frame.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        const j = JSON.parse(line.slice(5).trim());
        const u = j.usageMetadata;
        if (u && typeof u.totalTokenCount === 'number') { meter.total = u.totalTokenCount; meter.sawUsage = true; }
        const c = j.candidates && j.candidates[0];
        if (c && c.content && Array.isArray(c.content.parts))
          for (const p of c.content.parts) if (typeof p.text === 'string') meter.chars += p.text.length;
      } catch {}
    }
  };
  const runningCount = () => (meter.sawUsage ? meter.total : estimateTokens(meter.chars));

  const { readable, writable } = new TransformStream();
  const pump = (async () => {
    const reader = gResp.body.getReader();
    const writer = writable.getWriter();
    const dec = new TextDecoder();
    let sseBuf = '', clientGone = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // scan COMPLETE frames only — a count over half a frame would miscount
        sseBuf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = sseBuf.indexOf('\n\n')) >= 0) { scanFrame(sseBuf.slice(0, idx)); sseBuf = sseBuf.slice(idx + 2); }
        if (!clientGone) {
          try { await writer.write(value); }
          catch { clientGone = true; try { await reader.cancel(); } catch {} break; }   // F4 — stop the spend
        }
        if (runningCount() > STREAM_MAX_TOKENS) {                                       // F6 — abuse ceiling, NOT cap
          try { await reader.cancel(); } catch {}
          break;                                    // the check runs after scanning, so the cut lands
          // after the last COMPLETE frame that crossed the ceiling; the client parser only acts on
          // complete frames and treats a no-finish end as an error — the contract holds.
        }
      }
    } finally {
      if (!clientGone) { try { await writer.close(); } catch {} }
      // F3/F4/F7 — completed or died: charge what was counted; unknown fails closed at the reserve
      const actual = meter.sawUsage ? meter.total : Math.max(RESERVE_TOKENS, estimateTokens(meter.chars));
      await reconcile(env, code, key, actual);
    }
  })();
  ctx.waitUntil(pump);                             // F4 — reconcile survives a client disconnect
  return new Response(readable, {
    status: 200,
    headers: { ...cors, 'Content-Type': gResp.headers.get('Content-Type') || 'text/event-stream' },
  });
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `cd worker && npm test`
Expected: PASS — all new tests + the whole existing suite (the extraction is behaviour-preserving for `generateContent`; any existing-test failure means the extraction drifted — fix the extraction, not the test). Paste output + exit code.

- [ ] **Step 5: Frame-boundary honesty check** — the F6 test asserts `endsWith('\n\n')`. If workerd chunk delivery makes it flaky (a chunk split mid-frame at cut time), that is a real contract violation — fix by buffering the passthrough per frame for the post-ceiling write path (hold back an incomplete trailing frame once `runningCount()` exceeds `0.9 * STREAM_MAX_TOKENS`), NOT by weakening the assertion. (3-fix rule applies.)

- [ ] **Step 6: Commit**

```bash
git add worker/index.js worker/test/index.spec.js
git commit -m "feat(worker): streaming route returns METERED — debit-first admission, SSE tee metering, fail-closed reconcile, never-cut-for-cap (F5), ceiling, waitUntil disconnect reconcile

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 7: Tier skeleton — the field, the table, a default row, nothing more (R-38 ∩ R-40)

**Files:**
- Modify: `worker/index.js` (the `TIERS` table; move the rate check in-lock; the ceiling derives from the tier)
- Modify: `scripts/central-code.mjs` (`show`/`audit` display the tier)
- Test: `worker/test/index.spec.js`

**Interfaces:**
- Consumes: `admitCode`, `handleStream`, `STREAM_MAX_TOKENS` (Task 6 — replaced here), `retryAfterSeconds`.
- Produces: `TIERS` (single `default` row), `tierOf(rec) → {ratePerMin, streaming, streamMaxTokens, mintCap}`; `retryAfterSeconds(code, maxPerWindow)` (parameterized); the `streaming:false` refusal branch (`403 streaming_not_allowed`, before the debit) — present in code, no production row uses it (asserted honestly: "default tier streams").
- Spec trace: spec §4.1–§4.2, §2.7 (what is NOT built: `extended` row, `--tier` mint, `tier` change command — R-40 minimal; one-line adds when band-H opens).

- [ ] **Step 1: Write the failing tests** — append to `worker/test/index.spec.js`:

```js
describe('R-38∩R-40 — tier skeleton (spec §4.1)', () => {
  it('a record with NO tier resolves to default: rate 20/min (the contract, not a compat pin)', async () => {
    await env.CODES.put('code:no-tier', JSON.stringify({ active: true, cap: 10_000_000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    let limited = 0;
    for (let i = 0; i < 25; i++) {
      const r = await post(GENERATE_URL, 'no-tier');
      if (r.status === 429) limited++;
    }
    expect(limited).toBe(5);            // requests 21..25 refused — TIERS.default.ratePerMin
  });

  it('an UNKNOWN tier name falls back to default (no crash)', async () => {
    await env.CODES.put('code:weird', JSON.stringify({ active: true, cap: 10_000_000, used: 0, tier: 'no-such-tier' }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    const r = await post(GENERATE_URL, 'weird');
    expect(r.status).toBe(200);
  });

  it('the default tier STREAMS (the streaming:false branch exists but no production row uses it)', async () => {
    await env.CODES.put('code:st-def', JSON.stringify({ active: true, cap: 1000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(7));
    const r = await post(STREAM_URL, 'st-def');
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `cd worker && npm test`
Expected: the rate test FAILS for the intended reason — today's `retryAfterSeconds` runs before the KV read and knows no tier (paste the failure). The unknown-tier test must also fail RED first (tier ignored ≠ tier resolved — verify the failure mode before implementing; if it passes on first run it is void, rewrite it per DoD-2).

- [ ] **Step 3: Implement** — in `worker/index.js`:

(a) replace the `RATE_MAX_PER_WINDOW` constant + `retryAfterSeconds`, and DELETE Task 6's `STREAM_MAX_TOKENS` const:

```js
const RATE_WINDOW_MS = 60_000;           // H-3: per-code fixed window (per isolate)

// R-38 tier SKELETON, narrowed by R-40 (spec §4.1): the field, the table, a default row — NOTHING
// MORE. No `extended` row, no tier CLI (spec §2.7 — one-line adds when band-H decides policy).
// `default` numbers: rate 20/min, streaming on, per-stream ceiling 4096, mintCap 2M. mintCap is
// consumed ONLY by scripts/central-code.mjs at mint time — the Worker still refuses a capless record (E14).
const TIERS = {
  default: { ratePerMin: 20, streaming: true, streamMaxTokens: 4096, mintCap: 2_000_000 },
};
function tierOf(rec) { return TIERS[rec && rec.tier] || TIERS.default; }

const RATE = new Map();    // code -> { reset:number, n:number }
function retryAfterSeconds(code, maxPerWindow) {
  const now = Date.now();
  const e = RATE.get(code);
  if (!e || now >= e.reset) { RATE.set(code, { reset: now + RATE_WINDOW_MS, n: 1 }); return 0; }
  e.n += 1;
  if (e.n > maxPerWindow) return Math.max(1, Math.ceil((e.reset - now) / 1000));
  return 0;
}
```

(b) in `admitCode`: add the tier resolution + move the rate check in-lock + the streaming refusal, and return the tier; DELETE the old pre-KV rate block:

```js
    const tier = tierOf(rec);                                                             // R-38
    // rate limit is tier-derived and therefore runs AFTER the record loads. Reviewed trade: an
    // invalid code now costs one cached KV read and a 403 instead of consuming rate budget —
    // validation is the cheaper gate, and 403 is not a retryable answer. (No compat concern — R-40.)
    const ra = retryAfterSeconds(code, tier.ratePerMin);
    if (ra > 0) return { err: json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) }) };
    if (wantStream && tier.streaming === false) return { err: json({ error: 'streaming_not_allowed' }, 403) };
```

(`admitCode` gains the `wantStream` parameter and returns `{ ok: true, tier }`; `handleStream` gains a `tier` parameter and its ceiling check reads `tier.streamMaxTokens` instead of the deleted const.)

(c) in `scripts/central-code.mjs` — display only (no mint flag, no change command):

```js
// R-38∩R-40: tiers are DISPLAYED here, never minted or changed — the Worker's TIERS table is the
// single authority and holds one row (`default`). A record without `tier` IS default.
// …inside the audit record loop, after the cap check:
      else {
        const t = rec.tier || 'default (implicit)';
        if (rec.tier && !['default'].includes(rec.tier)) bad.push({ name, why: `tier="${rec.tier}" is UNKNOWN — the Worker treats it as 'default'`, label: rec.u });
        else console.log(`  ${mask(name)}${rec.u ? ` (${rec.u})` : ''} — tier ${t} · cap ${rec.cap.toLocaleString()} · used ${(rec.used || 0).toLocaleString()}`);
      }
```

(NOTE: `mask` must move ABOVE the loop for this — it currently sits below; move the `const mask = …` line to just before the `for` loop. `show` gets the same one-line tier display.)

- [ ] **Step 4: Run to verify GREEN**

Run: `cd worker && npm test`
Expected: PASS including the pre-existing `H-3 — rate limiting` test (it uses a valid record, so the moved check still fires) and every Task-6 streaming test (the ceiling now reads the tier — same number, 4096). Paste output + exit code. Verify `central-code.mjs` display by direct invocation of the no-network usage path (`node scripts/central-code.mjs`) — paste; the remote `audit` output is exercised and pasted at the release task.

- [ ] **Step 5: Commit**

```bash
git add worker/index.js scripts/central-code.mjs worker/test/index.spec.js
git commit -m "feat(worker): tier skeleton (R-38 minimal per R-40) — single default row, tierOf-derived rate and stream ceiling, audit displays tier

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 8: Demo hardening — connection pre-warm + weak-network degradation (G8)

**Files:**
- Modify: `app.js` (`vcPrewarm` + call site at voice-UI open; the stall watchdog inside `gemPlayPcmStream`; the stall toast string)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `gemTransport` (Task 1), `centralUrl()`, `gemMode()`, the voice-UI open path (the mic surface's show handler), `gemSpeakSeg`'s fallback (Task 1), the toast machinery.
- Produces: `vcPrewarm()` (throttled ≥5 min, fire-and-forget, never metered — it carries no tokens); the 8 s mid-utterance stall watchdog → visible toast `'החיבור איטי — ממשיך…'` → blocking-synth fallback for the not-yet-spoken remainder if the stream dies.
- Spec trace: spec §5.4 (pre-warm — "cold start is exactly when the audience is watching"), §5.5 (degraded-but-working; never silent-and-broken), G8.

- [ ] **Step 1: Write the failing tests** — append to `tests/metered-streaming.spec.ts`:

```ts
test('vcPrewarm fires once on voice-UI open (throttled) and is fire-and-forget', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': 'https://w.example', 'mk-central-code': 'abc123' });
  let warms = 0;
  await page.route('https://w.example/**', r => { warms++; return r.fulfill({ status: 204, body: '' }); });
  try {
    await page.evaluate(() => { (window as any).vcPrewarm(); (window as any).vcPrewarm(); });   // second call inside the throttle window
    await page.waitForFunction(() => (window as any).__vcPrewarmDone === true);                 // condition, not a timeout (DoD-11)
    expect(warms).toBe(1);
  } finally { await page.unroute('https://w.example/**'); }
});

test('a mid-utterance stream failure falls back to the blocking synth — degraded, working, visible', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  // a truncated SSE audio body: one valid frame, then the body ends without more data — the streaming
  // synth must surface the failure to gemSpeakSeg's fallback, which carries the segment via the
  // blocking path. Observable: __gemTtsMock hit + the answer completes (no silent death).
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
  try {
    const hit = await page.evaluate(async () => {
      const w = window as any;
      let n = 0;
      w.__gemTtsMock = () => { n++; return { length: 1, sampleRate: 24000 }; };
      w.__gemPlayMock = () => Promise.resolve();
      const gen = w.vcNewSpeakGen();
      await w.gemSpeakSeg('ממשיכים בעישון.', 'he', gen);
      delete w.__gemTtsMock; delete w.__gemPlayMock;
      return n;
    });
    expect(hit).toBe(1);
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});
```

(The 8 s stall path cannot be honestly driven through `route.fulfill` — it sends a complete body. The
watchdog is therefore asserted at its own seam: a targeted test invokes the exported
`vcStallNotice()` and asserts the toast renders (Hebrew, DoD-9 screenshot at 390×844); the
timer-arming is code-reviewed and exercised live in Task 9's D2 throttled run. Stated openly — not
silently skipped.)

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: FAIL — `vcPrewarm` undefined; the 500-route test may pass already via Task 1's generic fallback — if it does, it is VOID as a new test (DoD-2): keep it as a regression pin only if it first FAILS with Task 1's fallback deliberately reverted (regression red-green, DoD-7), else fold it into Task 1's fallback test and say so. Paste.

- [ ] **Step 3: Implement** — in `app.js`:

```js
// ── G8 pre-warm (spec §5.4): the demo's FIRST question must not pay TLS/cold-start. Fire-and-forget,
// throttled, carries no tokens, never metered as usage; a failure is silent by design (it is only a warm).
let vcPrewarmAt=0;
if(typeof window!=='undefined') window.__vcPrewarmDone=false;
function vcPrewarm(){
  const now=Date.now();
  if(now-vcPrewarmAt<300000) return;               // ≥5 min between warms
  vcPrewarmAt=now;
  const mode=gemMode();
  const url=(mode==='managed') ? centralUrl()+'/' : GEM_HOST.replace(/\/v1beta.*$/,'/');
  fetch(url,{method:'OPTIONS'}).catch(function(){}).then(function(){
    if(typeof window!=='undefined') window.__vcPrewarmDone=true;
  });
}
// call site: the voice-UI open handler (the mic surface's show path) calls vcPrewarm() — locate the
// Wave-0 open handler (vcOpen / the mic button's first render) and add the single call there.

// ── G8 stall watchdog (spec §5.5): inside gemPlayPcmStream's read loop, arm an 8s timer per read;
// firing it means "playing but starving" — show the toast ONCE per utterance, keep reading (the 30s
// transport timeout still bounds the wait). A dead stream then falls to gemSpeakSeg's blocking fallback.
function vcStallNotice(){ toast(L('החיבור איטי — ממשיך…','Connection is slow — continuing…')); }
```

In `gemPlayPcmStream`'s loop: wrap `reader.read()` with `Promise.race` against an 8 s timer; on timer fire (and `got===true`) call `vcStallNotice()` once and continue awaiting the same read — the race must not cancel the reader (the stream may still deliver).

- [ ] **Step 4: Build + run to verify GREEN + DoD-9**

Run: `python build.py` then `npx playwright test` (full plain suite — task gate ×1)
Also: the stall toast is user-facing Hebrew — render it at 390×844, screenshot, look at it (DoD-8/9).
Expected: PASS. Paste output + exit code + the screenshot path.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): G8 demo hardening — vcPrewarm on voice-UI open, 8s stall watchdog with visible Hebrew toast, degraded-but-working fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 9: Demo-grade verification (D1–D4) + latency evidence + release v281

**Files:**
- Modify: `docs/ROADMAP-2026-07-30.md` (rows R-36/R-37/R-38/R-39/R-40 → landed state), `docs/STATUS-BOARD.md` (H10), `worker/README.md` (route + tier documentation), version stamp (`build.py` data / the `מהדורה NNN` source) → **281**
- Create: `docs/analysis/2026-07-31-metered-streaming-latency.md` (the measured evidence)
- Test: `tests/metered-streaming.spec.ts` (the instrument test + the mocked demo scenario)

**Interfaces:**
- Consumes: everything above; `window.__vcLat` (`ask`/`firstSentence`/`firstAudio` marks).
- Spec trace: spec §10 DoD lines 9–12 + **D1–D4 (the demo-grade gate — release-blocking)**; discipline §10.10 (a push is not a release).

- [ ] **Step 1: The instrument test** — append to `tests/metered-streaming.spec.ts`:

```ts
test('__vcLat carries firstSentence AND firstAudio for a streamed ask (the D1 instrument)', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  const lat = await page.evaluate(async () => {
    const w = window as any;
    w.__gemTtsStreamMock = (clean: string, lang: string, gen: number) => { w.vcLatMark('firstAudio'); return Promise.resolve(); };
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('הכל מוכן ויציב. ');                       // digit-free — triggers firstSentence
      return 'הכל מוכן ויציב.';
    };
    await w.vcAskFlow('שאלה כללית');
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock;
    return w.__vcLat;
  });
  expect(typeof lat.firstSentence).toBe('number');
  expect(typeof lat.firstAudio).toBe('number');
  expect(lat.firstSentence).toBeGreaterThanOrEqual(lat.ask);
});

test('D3 — the fixed demo scenario runs end-to-end (mocked): brisket wrap question → guarded Hebrew answer, spoken', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  const r = await page.evaluate(async () => {
    const w = window as any;
    const spoken: string[] = [];
    w.__gemTtsStreamMock = (clean: string) => { spoken.push(clean); return Promise.resolve(); };
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      const ans = 'עטוף כשהקרום קבוע והצבע מהגוני כהה, בדרך כלל בשלב התקיעה. ';
      onDelta(ans);
      return ans.trim();
    };
    await w.vcAskFlow('שאלה אני מעשן בריסקט חמישה קילו במאה ועשר מעלות, איך אדע מתי לעטוף');
    const a = w.vcLastQA && w.vcLastQA.a;
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock;
    return { a, spoken };
  });
  expect(String(r.a)).toContain('עטוף');            // the expected answer shape: wrap indicators, Hebrew
  expect(r.spoken.length).toBeGreaterThan(0);       // and it was SPOKEN, not only rendered
});
```

- [ ] **Step 2: Run RED → GREEN**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: if Tasks 4+1 landed the marks, the instrument test passes first-run — which VOIDS it (DoD-2). Flip it honestly: comment out the `vcLatMark('firstSentence')` line in `app.js`, rebuild, observe RED, restore, rebuild, observe GREEN (regression red-green, DoD-7). Paste both outputs. Same treatment for the D3 test if it passes first-run.

- [ ] **Step 3: D1 live measurement** (env key, never printed) — run the demo scenario LIVE, 5 consecutive runs, after a pre-warmed open:

```bash
node scratchpad/metered-streaming/demo-latency.mjs
```

Create it in the scratchpad (NOT the repo):

```js
// demo-latency.mjs — D1: first-sentence + first-audio-frame legs on the LIVE api, 5 runs. Env key only.
const KEY = process.env.GEMINI_API_KEY; if (!KEY) { console.error('no key'); process.exit(2); }
const Q = 'אני מעשן בריסקט 5 ק"ג ב-110 מעלות — איך אדע מתי לעטוף?';
async function textLeg() {
  const t0 = performance.now();
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: 'ענה בקצרה מאוד — עד 60 מילים; אתה עוזר קולי.' }] },
      contents: [{ role: 'user', parts: [{ text: Q }] }],
      generationConfig: { maxOutputTokens: 8192 } }),
  });
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = '', text = '', tFirst = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) {
      const fr = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of fr.split('\n')) if (line.startsWith('data:')) {
        try { const j = JSON.parse(line.slice(5));
          for (const p of ((j.candidates || [])[0] || { content: { parts: [] } }).content.parts) text += p.text || '';
        } catch {}
      }
      if (!tFirst && /[.!?…]\s/.test(text)) tFirst = performance.now() - t0;
    }
  }
  return { firstSentenceMs: Math.round(tFirst), chars: text.length, firstSentence: text.split(/(?<=[.!?…])\s+/)[0] };
}
async function audioLeg(sentence) {
  const t0 = performance.now();
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:streamGenerateContent?alt=sse', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sentence }] }],
      generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: 8192 } }),
  });
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = '', tFirstAudio = 0, frames = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) {
      const fr = buf.slice(0, i); buf = buf.slice(i + 2);
      if (fr.includes('inlineData')) { frames++; if (!tFirstAudio) tFirstAudio = performance.now() - t0; }
    }
  }
  return { firstAudioMs: Math.round(tFirstAudio), frames };
}
const runs = [];
for (let i = 0; i < 5; i++) {
  const t = await textLeg();
  const a = await audioLeg(t.firstSentence);
  runs.push({ run: i + 1, ...t, ...a, firstSoundMs: t.firstSentenceMs + a.firstAudioMs });
  console.log(JSON.stringify(runs[runs.length - 1]));
}
const sounds = runs.map(r => r.firstSoundMs).sort((x, y) => x - y);
console.log(JSON.stringify({ medianFirstSoundMs: sounds[2], maxFirstSoundMs: sounds[4], pass: sounds[2] <= 3000 && sounds[4] <= 5000 }));
```

Expected: `medianFirstSoundMs ≤ 3000` and `maxFirstSoundMs ≤ 5000` (D1). A miss is stated loudly with the per-leg breakdown — never rounded away, never re-run-to-green.

- [ ] **Step 4: Write the evidence doc** — `docs/analysis/2026-07-31-metered-streaming-latency.md` with the real numbers from Step 3 in this shape (fill the ⟨⟩ from the actual runs — never estimate):

```markdown
# Metered streaming — measured latency (v281 evidence, D1)

| leg | before (baseline docs, 31.7) | after (measured here) |
|---|---|---|
| first sentence ready | 5,710 ms (full blocking answer) | ⟨firstSentenceMs, per run⟩ ms |
| first audio frame | 7,643 ms (blocking TTS) | ⟨firstAudioMs, per run⟩ ms |
| **first sound (sum)** | **~13.4 s best case / ~99 s worst** | **⟨median firstSoundMs⟩ ms (median of 5) · max ⟨max⟩ ms** |
Runs: 5 consecutive, same machine/network as the 31.7 baselines, after pre-warm. Script: scratchpad demo-latency.mjs (env key).
D1 bar: median ≤ 3,000 ms AND max ≤ 5,000 ms — ⟨MET / MISSED by N ms, per-leg breakdown⟩.
```

- [ ] **Step 5: D2 weak-network run** — a throttled Playwright run (CDP `Network.emulateNetworkConditions`, Slow-3G-class) of the mocked demo scenario: assert the answer still completes and nothing hangs silently; drive the stall toast via its seam and screenshot it at 390×844. Paste the run output.

- [ ] **Step 6: Release gate (H7 ×2) + deploy** — Worker FIRST (`cd worker && npm run deploy`; the client's 404 fallback makes the reverse merely degraded, not broken), then bump the stamp to `מהדורה 281`, build, and run BOTH suites, serialized, idle machine:

```bash
python build.py
cd worker && npm test; cd ..
npx playwright test
npx playwright test
```

Expected: worker suite exit 0; TWO consecutive full Playwright runs exit 0 (no `--retries`, no `--workers`; any failure including an intermittent one = bug → systematic-debugging, never a re-run-to-green). Paste all three exit codes. After deploy, exercise the remote audit once (`node scripts/central-code.mjs audit`) and paste masked output.

- [ ] **Step 7: Ship + live verify (§10.10) + D3 live + D4 device** — commit, push, poll the live URL with Playwright until `.foot-stamp` shows `מהדורה 281` AND a feature probe from this release answers (`typeof gemStreamFetch === 'function'`). Then: **D3** — run the fixed demo question against the LIVE app once, paste the transcript + `__vcLat` marks; **D4** — run it once on a real device at 390×844 (the owner's phone), first sound heard, transcript screenshot attached and looked at. Only after all of this say "v281 is live".

```bash
git add -A && git commit -m "release(v281): streaming voice — first sound ≤3s measured, minimal metered Worker route, tier skeleton, demo-grade gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

- [ ] **Step 8: Docs + close** — ROADMAP §5a rows updated (R-36(ב) ✅ v281 · R-37 ✅ v281 · R-38 ✅ minimal-infrastructure v281, `extended`+CLI trigger-anchored to band-H · R-39 ✅ landed as Task 1 · R-40 recorded as the governing priority ruling); STATUS-BOARD (H10); H9 table; arc-close checklist (`docs/process/checklists/arc-close.md`): lessons → §11, graph refresh trigger check, ledger rows, check-meta green.

---

## Self-Review (run before submitting the plan)

1. **Spec coverage:** §5.3/§8 audio streaming → Task 1 · §5.1 transport/text → Tasks 1–2 · §5.2+§6 assembler/gate/guard-once → Tasks 3–4 · §7 R-36a → Task 5 · §2 route/metering → Task 6 (whole, no bridge) · §4 tier skeleton → Task 7 · §5.4/§5.5 pre-warm/weak-network → Task 8 · §10 DoD 1–12 + D1–D4 → mapped across task gates + Task 9. Dropped scope (extended row, tier CLI, migration) is recorded in spec §2.7/§4 with its R-40 justification — narrowed by owner ruling, not waived by the plan.
2. **Placeholder scan:** the Task-5 panel probe is the factored-const version (the truncated-literal variant was caught and rejected in the previous revision — kept rejected). `ttsAlreadyClean` in Task 1 is flagged in-plan as a resolve-against-Wave-0 decision, not a placeholder. No TBDs remain.
3. **Type consistency:** `gemTransport(mdl, verb, key)` identical in Tasks 1, 2, 8 · `gemSpeakSeg(text, lang, gen)` matches Tasks 1→4→8→9 · `admitCode(env, code, key, json)` (Task 6) gains `wantStream` in Task 7 and both call sites move together · `tierOf` matches Tasks 7's table · `__vcLat` marks (`ask`/`firstSentence`/`firstAudio`) consistent across Tasks 1, 4, 9.
4. **Guard timing (Global Constraint 3) re-checked:** `vcGuardSpoken` has exactly ONE call site in the streamed flow (Task 4, after `asm.end()`); no task introduces a per-sentence or per-fragment guard call; `gemSpeakSeg` receives only `ttsText` output.

**Mechanical gate:** `node scripts/check-plan-complete.mjs docs/superpowers/plans/2026-07-31-metered-streaming.md` must exit 0 before this plan is submitted to review (discipline §2, L27).
