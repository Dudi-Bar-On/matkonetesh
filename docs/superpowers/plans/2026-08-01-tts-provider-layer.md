# TTS Provider Layer Implementation Plan (R-45)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended)
> or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Design (authoritative):** `docs/superpowers/specs/2026-08-01-tts-provider-layer-design.md` @ `4fb5806`.
**Research reference (mechanics only, no credential):** `docs/research/2026-07-31-cloud-tts-evaluation.md`.

**Goal:** Run two TTS engines behind one decision point — Gemini as primary, Cloud TTS / Chirp3-HD as
secondary — used both as a one-shot fallback when the primary fails and as the routed choice for use cases
where speed and quota beat timbre.

**Architecture:** A new `ttsSpeakSeg(text, lang, gen, startAt, useCase)` becomes the *only* place a provider
is chosen. It honours the shipped v281 cursor contract exactly (`→ cursor`, an audio-clock time). Cloud TTS
runs **only** through the Cloudflare Worker (service-account JWT → OAuth token → `text:synthesize`), because
a service-account private key must never reach the browser. `gemSpeakSeg` is **not modified**.

**Tech Stack:** Vanilla ES5-flavoured JS in `app.js` (single-file PWA, inlined by `build.py`) · Cloudflare
Worker (`worker/index.js`, WebCrypto RS256) · Playwright (app) · Vitest + `@cloudflare/vitest-pool-workers`
(worker).

---

## ⚠️ SEQUENCING — read before scheduling this plan

**Functions/files this plan touches, in full:**

| File | Symbols **modified** | Symbols **added** |
|---|---|---|
| `app.js` | `gemSpeak` (loop body + signature `+useCase`) · `vcSpeak` (signature `+useCase`) · `vcSpeakContent` · 4 `vcSpeak(...)` call sites (timer warn/end, mic prompt, qtemp/qwhen) | `TTS_ROUTE`, `TTS_ROUTE_DEFAULT`, `ttsCloudOff`, `ttsCloudAvail`, `ttsProviderFor`, `ttsFallbackWorthy`, `ttsCloudUnavailableErr`, `ttsPrefetch`, `ttsSpeakSeg`, `cloudVoiceFor`, `CLOUD_TTS_VOICE`, `cloudSynthChunk`, `cloudSpeakSeg` |
| `worker/index.js` | the route dispatch inside `export default.fetch` (adds one branch) | `TTS_BASE`, `TTS_MAX_CHARS`, `SA_TOKEN`, `b64url`, `pemToPkcs8`, `saAccessToken`, `handleCloudTts` |
| `worker/test/index.spec.js` | — | new `describe` blocks appended |
| `tests/tts-provider.spec.ts` | — | new file |

**Explicitly NOT touched:** `gemSpeakSeg`, `gemSpeakSegAttempt`, `gemSpeakSegStream`, `gemPlayBuf`,
`gemPlayPcmStream`, `gemSynthChunk`, `gemSynthChunkRetrying`, `vcGuardSpoken`, `vcChunkText`,
`vcCoalesceTtsChunks`.

- **Task 4 of the metered-streaming arc modifies `gemSpeakSeg` and is blocked on an owner ruling.** This plan
  deliberately routes *around* `gemSpeakSeg` rather than through it, so the two can land in either order with
  **zero textual collision in `app.js`**. The only shared *caller* is `gemSpeak`; if the other task also edits
  `gemSpeak`, sequence this plan **after** it and re-anchor Task 4 Step 3 below.
- **Task 6 of that arc is editing `worker/index.js` right now.** This plan **adds** a route and composes with
  the existing metered `handleStream` path — it does not rewrite the dispatch, does not change `withCodeLock`,
  `admitCode`, `reconcile`, `retryAfterSeconds`, `corsHeaders`, or any existing regex. Land this **after**
  Task 6 and re-read `worker/index.js` before Task 1 Step 3.

---

## Global Constraints

Copied verbatim / traced from the design and from `CLAUDE.md`. Every task's requirements include these.

1. **Cursor contract is sacred.** Design §3: *"`cloudSpeakSeg` מקבלת את **אותה חתימה** ומחזירה את **אותו ערך**
   כמו `gemSpeakSeg` — `(text, lang, gen, startAt) → cursor`."* Any provider returns the audio-clock time at
   which its audio ends.
2. **A service-account private key never reaches the browser.** Design §2. Cloud TTS is Worker-only.
   Secret name: `GCP_SA_JSON` (a `wrangler secret put`, never in `wrangler.toml`, never in the repo).
3. **A BYOK user cannot reach Cloud TTS.** Design §2: *"משתמש BYOK לא יכול להשתמש ב-Cloud TTS … הספק המשני
   פשוט אינו זמין, ושרשרת הנפילה מדלגת עליו."* Skip cleanly — no error, no mysterious silence.
4. **Request count must not grow.** Design §4.3: *"אין שינוי במספר הבקשות. תיקון המכסה מ-`0bee32f` מקודש:
   הספק המשני מחליף בקשה, לא מוסיף."* See the arithmetic table below — it is a hard budget, not a hope.
5. **The safety guard runs before provider selection and applies identically to both engines.** Design §5.
   `vcGuardSpoken` runs on the *text* at `app.js:7480`, upstream of `vcSpeak`. Nothing in this plan may run
   before it or hand un-guarded text to any engine.
6. **Fallback is exactly one hop, never a chain.** Design §4.1: *"נפילה **אחת**, לא שרשרת אינסופית."*
7. **No user-facing provider picker.** Design §4.3.
8. **Never print, log, or commit a key or secret** — not in code, tests, reports, or commit messages.
   Test service-account material is an ephemeral key pair generated inside the test process.
9. **Test authoring:** every app test obeys `tests/TEST-AUTHORING-CONTRACT.md` — `test`/`seedApp` from
   `./_fixtures`, `JSON.stringify`'d seed values, condition waits only, no `waitForTimeout`, no
   `addInitScript` on the warm page, every `route` cleaned up in `try/finally`.
10. **Suite command:** `npx playwright test` — plain. No `--retries`, no `--workers`, no `--grep` as a
    substitute at the gate.

### The request-count budget (Constraint 4, made concrete)

Per TTS chunk, worst case, counting only outbound synthesis requests:

| Situation | Shipped v281 (baseline) | After this plan | Grows? |
|---|---|---|---|
| Gemini succeeds | 1 | 1 | no |
| Gemini 429, **BYOK** (no secondary) | ≤4 (`gemSpeakSeg`: attempt=stream+blocking, ×2 for the one retry) | ≤4 — **`gemSpeakSeg` is called unchanged** | no |
| Gemini 429, **managed** (secondary available) | ≤4 | **2** (1 Gemini stream + 1 Cloud) — the secondary *replaces* the retry | **shrinks** |
| Stale Worker (`stream-unsupported`) | 2 (stream + blocking) | 2 (stream + blocking) — unchanged path | no |
| `alert` routed to Cloud, Cloud configured | 1 (Gemini) | 1 (Cloud) | no |
| `alert` routed to Cloud, Worker returns 501/404 | 1 | 2 **once**, then latched to 1 for the session | bounded, once |

**The trap this avoids:** calling `gemSpeakSeg` (which owns the one allowed Gemini retry) *and then* Cloud —
that would be 5 requests where v281 allows 4. The plan calls `gemSpeakSegStream` **directly** in the
managed path, so the remedial request goes to the secondary instead of to a Gemini retry.

---

## File Structure

- **`worker/index.js`** — gains a `POST /v1/tts:synthesize` route. Auth helpers (`b64url`, `pemToPkcs8`,
  `saAccessToken`) and the handler (`handleCloudTts`) live next to `handleStream`, above the default export.
  Same admission chain as every other route: CORS → method/path → code header → `retryAfterSeconds` →
  `admitCode` (debit-first, fail-closed) → work → `reconcile`.
- **`app.js`** — one new contiguous block placed **immediately after `gemPlayPcmStream` ends
  (line 6819, before the `── Hotfix v281` comment block at 6821)**. It contains, in order: the routing table,
  availability + resolution, the fallback predicate, `cloudSynthChunk`/`cloudSpeakSeg`, and `ttsSpeakSeg`.
  *Why one block and not a module:* `build.py` inlines `app.js` into `dist/index.html`; the codebase has no
  module system. "One place" here means one adjacent, readable block next to the decision point — putting
  the table 3,000 lines from `ttsSpeakSeg` would re-create exactly the scattered-`if` problem §4.2 forbids.
- **`tests/tts-provider.spec.ts`** — new spec, all R-45 app-side DoD proofs.
- **`worker/test/index.spec.js`** — appended `describe` blocks for the new route.

### Where the §4.2 routing table lives, and its shape (the design asks this to be decided, with reasoning)

```js
const TTS_ROUTE = { answer:'gemini', step:'gemini', alert:'cloud' };
const TTS_ROUTE_DEFAULT = 'gemini';
```

**Shape — a flat `useCase → providerId` object literal.** Reasoning:

- It is **data**, exactly as §4.2 requires (*"הטבלה הזו היא **נתון שניתן לשנות במקום אחד**, לא `if` מפוזר בקוד"*).
  Adding a voice surface is adding a row; no call site ever names a provider.
- A **flat map, not a predicate list**: the design's three rows are keyed purely on "what kind of speech is
  this", with no conditions. A rules array would invite conditions and would smuggle the scattered `if`s back
  inside the table.
- **Availability is applied outside the table, in `ttsProviderFor`.** The table states *preference*; whether a
  provider is reachable is a runtime fact (managed vs BYOK, Worker configured or not). Baking availability
  into the table would make it un-owner-editable.
- **An unknown key falls to `TTS_ROUTE_DEFAULT`, never to silence.** A future call site that forgets to pass a
  use case gets the primary engine, which is the safe direction.

Use-case names (English IDs, full words — the owner's naming preference) and their call sites:

| useCase | design §4.2 row | call sites |
|---|---|---|
| `answer` | תשובת AI חופשית → Gemini | `vcSpeak` default; `app.js:7482` (guarded AI answer), `:7494`, `:7095`, `:7066` |
| `step` | הקראת שלב/משימה → Gemini | `vcSpeakContent` (`:7119`); `qtemp` (`:7080`/`:7081`), `qwhen` (`:7087`) |
| `alert` | התראות קצרות/חוזרות → Cloud | timer `onWarn`/`onEnd` (`:7063`/`:7064`); mic listening prompt (`:7529`) |

---

## Task 1: Worker route — Cloud TTS via service account

**Files:**
- Modify: `worker/index.js` (add helpers above `export default`; add one branch inside `fetch`)
- Test: `worker/test/index.spec.js` (append)

**Interfaces:**
- Consumes: existing `withCodeLock`, `admitCode`, `reconcile`, `retryAfterSeconds`, `corsHeaders`,
  `estimateTokens`, `RESERVE_TOKENS`, `UPSTREAM_TIMEOUT_MS` — all unchanged.
- Produces: `POST <worker>/v1/tts:synthesize`, header `X-Access-Code: <code>`,
  body `{ text: string, languageCode?: string, voice?: string }`.
  - `200` → raw PCM16LE mono @24000 Hz, `Content-Type: audio/l16; rate=24000; channels=1`
  - `501 {error:'tts_secondary_unconfigured'}` → the secret is not set (the client's clean-skip signal)
  - `403 invalid_code|code_record_corrupt|code_disabled|code_uncapped` · `402 quota_reached` ·
    `429 rate_limited` + `Retry-After` · `504 upstream_timeout` · `502 upstream_unreachable|tts_auth_failed|no_audio`
    · `400 empty_text` · `413 text_too_long`

- [ ] **Step 1: Write the failing tests**

Append to `worker/test/index.spec.js`:

```js
// ── R-45 · Cloud TTS secondary provider (design §2, §6.7) ──────────────────
// The service-account material used here is an EPHEMERAL RSA key pair generated inside this test
// process. It is not a credential, it authenticates nothing, and it never leaves the isolate.
const TTS_URL = `${ORIGIN}/v1/tts:synthesize`;

async function fakeServiceAccountJson(clientEmail) {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  let s = ''; for (const b of pkcs8) s += String.fromCharCode(b);
  const b64 = btoa(s).replace(/(.{64})/g, '$1\n');
  return JSON.stringify({
    client_email: clientEmail,
    private_key: '-----BEGIN PRIVATE KEY-----\n' + b64 + '\n-----END PRIVATE KEY-----\n',
    token_uri: 'https://oauth2.googleapis.com/token',
  });
}

async function postTts(code, body) {
  return exports.default.fetch(TTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': code },
    body: JSON.stringify(body),
  });
}

// LINEAR16 @24k: 12 samples of silence is enough to prove bytes round-trip.
function ttsOkUpstream() {
  const pcm = new Uint8Array(24);
  let s = ''; for (const b of pcm) s += String.fromCharCode(b);
  return new Response(JSON.stringify({ audioContent: btoa(s) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function oauthOkUpstream() {
  return new Response(JSON.stringify({ access_token: 'test-only-not-a-real-token', expires_in: 3600 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
}
// Routes the two distinct upstreams the route talks to. `calls` records which were hit.
function mockTtsUpstreams(calls, synthResponse) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const u = String(input && input.url ? input.url : input);
    calls.push(u);
    if (u.includes('oauth2.googleapis.com')) return oauthOkUpstream();
    if (u.includes('texttospeech.googleapis.com')) return synthResponse ? synthResponse() : ttsOkUpstream();
    throw new Error('unexpected upstream: ' + u);
  });
}

describe('R-45 — Cloud TTS route protections', () => {
  it('with no GCP_SA_JSON secret the route answers 501 tts_secondary_unconfigured and calls nothing upstream', async () => {
    await env.CODES.put('code:tts1', JSON.stringify({ cap: 100000, used: 0 }));
    const calls = [];
    mockTtsUpstreams(calls);
    const prev = env.GCP_SA_JSON; delete env.GCP_SA_JSON;
    try {
      const r = await postTts('tts1', { text: 'שלום' });
      expect(r.status).toBe(501);
      expect((await r.json()).error).toBe('tts_secondary_unconfigured');
      expect(calls).toEqual([]);
    } finally { if (prev !== undefined) env.GCP_SA_JSON = prev; }
  });

  it('an over-cap code gets 402 and no upstream call — admission precedes synthesis', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('over-cap@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts2', JSON.stringify({ cap: 10, used: 10 }));
    const calls = [];
    mockTtsUpstreams(calls);
    const r = await postTts('tts2', { text: 'שלום' });
    expect(r.status).toBe(402);
    expect(calls).toEqual([]);
  });

  it('a corrupt KV record fails CLOSED with 403 on the TTS route too', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('corrupt@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts3', 'not-valid-json{]');
    const calls = [];
    mockTtsUpstreams(calls);
    const r = await postTts('tts3', { text: 'שלום' });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('code_record_corrupt');
    expect(calls).toEqual([]);
  });

  it('a record without a positive numeric cap is refused 403 code_uncapped', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('uncapped@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts4', JSON.stringify({ used: 0 }));
    const calls = [];
    mockTtsUpstreams(calls);
    const r = await postTts('tts4', { text: 'שלום' });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('code_uncapped');
  });

  it('happy path: audio bytes come back and `used` reconciles to the CHARACTER estimate', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('happy@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts5', JSON.stringify({ cap: 100000, used: 0 }));
    const calls = [];
    mockTtsUpstreams(calls);
    const text = 'עשן את הבריסקט.';                       // 15 chars → ceil(15/3) = 5
    const r = await postTts('tts5', { text });
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toContain('audio/l16');
    expect((await r.arrayBuffer()).byteLength).toBe(24);
    expect(calls.some((u) => u.includes('texttospeech.googleapis.com/v1/text:synthesize'))).toBe(true);
    const rec = JSON.parse(await env.CODES.get('code:tts5'));
    expect(rec.used).toBe(Math.ceil(text.length / 3));      // reserve debited then reconciled away
  });

  it('an upstream synthesis error refunds the reserve and passes the status through', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('upstream-err@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts6', JSON.stringify({ cap: 100000, used: 0 }));
    const calls = [];
    mockTtsUpstreams(calls, () => new Response(JSON.stringify({ error: { code: 429 } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }));
    const r = await postTts('tts6', { text: 'שלום' });
    expect(r.status).toBe(429);
    const rec = JSON.parse(await env.CODES.get('code:tts6'));
    expect(rec.used).toBe(0);                               // refunded
  });

  it('text past the per-request ceiling is refused 413 and refunded, with no upstream call', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('too-long@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts7', JSON.stringify({ cap: 100000, used: 0 }));
    const calls = [];
    mockTtsUpstreams(calls);
    const r = await postTts('tts7', { text: 'א'.repeat(5000) });
    expect(r.status).toBe(413);
    expect(calls).toEqual([]);
    expect(JSON.parse(await env.CODES.get('code:tts7')).used).toBe(0);
  });

  it('rate limiting applies: past the window the TTS route returns 429 with Retry-After', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('rate@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts8', JSON.stringify({ cap: 1000000, used: 0 }));
    mockTtsUpstreams([]);
    let last;
    for (let i = 0; i < 22; i++) last = await postTts('tts8', { text: 'שלום' });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('CORS stays an allowlist on the TTS route', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('cors@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts9', JSON.stringify({ cap: 100000, used: 0 }));
    mockTtsUpstreams([]);
    const foreign = await exports.default.fetch(TTS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-code': 'tts9', Origin: 'https://evil.example' },
      body: JSON.stringify({ text: 'שלום' }),
    });
    expect(foreign.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('no service-account material ever appears in a response body or header', async () => {
    env.GCP_SA_JSON = await fakeServiceAccountJson('leak@example.iam.gserviceaccount.com');
    await env.CODES.put('code:tts10', JSON.stringify({ cap: 100000, used: 0 }));
    mockTtsUpstreams([], () => new Response('{"error":{"message":"boom"}}',
      { status: 500, headers: { 'Content-Type': 'application/json' } }));
    const r = await postTts('tts10', { text: 'שלום' });
    const body = await r.text();
    const headers = JSON.stringify([...r.headers]);
    for (const needle of ['BEGIN PRIVATE KEY', 'private_key', 'client_email', 'iam.gserviceaccount.com', 'assertion=']) {
      expect(body).not.toContain(needle);
      expect(headers).not.toContain(needle);
    }
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail for the right reason**

```bash
cd worker && npx vitest run
```

Expected: the ten new tests FAIL. The first ones fail with `expect(501).toBe(...)` receiving **404** — the
route does not exist yet (`not_found` is the current dispatch answer for any unknown path). That is the
intended RED reason. If any of them passes on the first run it is void — rewrite it.

- [ ] **Step 3: Add the auth helpers and the handler to `worker/index.js`**

Insert immediately **after** the `handleStream` function ends (the line `}` closing `handleStream`, currently
line 201) and **before** `export default {`:

```js
// ── R-45 · Cloud TTS (secondary provider) ─────────────────────────────────────────────────────────
// Design: docs/superpowers/specs/2026-08-01-tts-provider-layer-design.md §2. Cloud TTS accepts NO API
// keys (empirically verified 401 CREDENTIALS_MISSING — docs/research/2026-07-31-cloud-tts-evaluation.md
// §4); it requires a service-account OAuth principal. A service-account private key in the PWA bundle is
// a published key, so this route exists precisely so the browser never sees one. The secret is
// GCP_SA_JSON (`wrangler secret put GCP_SA_JSON`) — never in wrangler.toml, never in the repo.
const TTS_BASE = 'https://texttospeech.googleapis.com';
const TTS_MAX_CHARS = 1200;   // the API's own limit is 5000 BYTES; our largest chunk is ~265 chars
                              // (vcTtsRemainderBudget) — this is a generous ceiling, not a constraint.

// Cached access token. Keyed by `iss` as well as expiry: a rotated secret must never be served a token
// minted from the previous one (and it makes the worker test suite deterministic per client_email).
let SA_TOKEN = { value: '', exp: 0, iss: '' };

function b64url(bytes) {
  const a = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToPkcs8(pem) {
  const b64 = String(pem).replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
// Self-signed RS256 JWT → OAuth2 access token (the jwt-bearer grant). Cloudflare WebCrypto signs it;
// the token is reused for ~an hour. Throws a MESSAGE ONLY — never the key, never the assertion.
async function saAccessToken(env) {
  let sa;
  try { sa = JSON.parse(env.GCP_SA_JSON); } catch { throw new Error('sa_json_invalid'); }
  if (!sa || !sa.client_email || !sa.private_key) throw new Error('sa_json_invalid');
  const now = Math.floor(Date.now() / 1000);
  if (SA_TOKEN.value && SA_TOKEN.iss === sa.client_email && SA_TOKEN.exp - 60 > now) return SA_TOKEN.value;
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud, iat: now, exp: now + 3600,
  })));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claim));
  const jwt = header + '.' + claim + '.' + b64url(sig);
  const r = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + encodeURIComponent(jwt),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error('sa_token_' + r.status);       // status only — the body can echo the assertion
  const j = await r.json();
  if (!j.access_token) throw new Error('sa_token_empty');
  SA_TOKEN = { value: j.access_token, exp: now + (j.expires_in || 3600), iss: sa.client_email };
  return SA_TOKEN.value;
}

// Metering (design/research §3.2): Cloud TTS bills per INPUT CHARACTER, so the charge is known BEFORE
// the call — no usage envelope to parse. It is converted through the same estimateTokens() the streaming
// route already fails closed with, so `used`/`cap` keep meaning one thing across all three routes.
// Admission (debit-first, per-code lock, fail-closed on corrupt KV) already ran in `fetch` before we get
// here — exactly like handleStream.
async function handleCloudTts(request, env, code, key, json, cors) {
  let req = null;
  try { req = JSON.parse(await request.text()); } catch { req = null; }
  const text = req && typeof req.text === 'string' ? req.text : '';
  if (!text.trim()) { await reconcile(env, code, key, 0); return json({ error: 'empty_text' }, 400); }
  if (text.length > TTS_MAX_CHARS) {
    await reconcile(env, code, key, 0);
    return json({ error: 'text_too_long', max: TTS_MAX_CHARS }, 413);
  }
  let token;
  try { token = await saAccessToken(env); }
  catch { await reconcile(env, code, key, 0); return json({ error: 'tts_auth_failed' }, 502); }  // never echo the cause
  let g;
  try {
    g = await fetch(TTS_BASE + '/v1/text:synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: req.languageCode || 'he-IL', name: req.voice || 'he-IL-Chirp3-HD-Kore' },
        // LINEAR16 @24 kHz mono is what the CLIENT's audio path already speaks end to end
        // (gemPcm16ToF32 + a 24000 Hz AudioBuffer, app.js) — no decoding step, no format negotiation.
        audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    await reconcile(env, code, key, 0);
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) return json({ error: 'upstream_timeout' }, 504);
    return json({ error: 'upstream_unreachable' }, 502);
  }
  if (!g.ok) {
    const t = await g.text();
    await reconcile(env, code, key, 0);
    return new Response(t, { status: g.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const j = await g.json();
  const b64 = j.audioContent || '';
  if (!b64) {
    await reconcile(env, code, key, Math.max(RESERVE_TOKENS, estimateTokens(text.length)));   // fail closed
    return json({ error: 'no_audio' }, 502);
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  await reconcile(env, code, key, estimateTokens(text.length));
  return new Response(bytes, { status: 200, headers: { ...cors, 'Content-Type': 'audio/l16; rate=24000; channels=1' } });
}
```

- [ ] **Step 4: Wire the route into the dispatch**

In `worker/index.js`, inside `export default { async fetch(...) }`. Replace this block (currently lines
222–232):

```js
    const GEN_RE = /^\/v1beta\/models\/[^/]+:generateContent$/;
    const STREAM_RE = /^\/v1beta\/models\/[^/]+:streamGenerateContent$/;
    const isStream = STREAM_RE.test(url.pathname);
    if (request.method !== 'POST' || (!GEN_RE.test(url.pathname) && !isStream)) {
      return json({ error: 'not_found' }, 404);
    }

    if (!env.GEMINI_KEY) return json({ error: 'server_misconfigured', detail: 'GEMINI_KEY secret not set' }, 500);

    const code = (request.headers.get('x-access-code') || '').trim();
    if (!code) return json({ error: 'missing_code' }, 401);
```

with:

```js
    const GEN_RE = /^\/v1beta\/models\/[^/]+:generateContent$/;
    const STREAM_RE = /^\/v1beta\/models\/[^/]+:streamGenerateContent$/;
    const TTS_RE = /^\/v1\/tts:synthesize$/;                 // R-45 secondary provider
    const isStream = STREAM_RE.test(url.pathname);
    const isTts = TTS_RE.test(url.pathname);
    if (request.method !== 'POST' || (!GEN_RE.test(url.pathname) && !isStream && !isTts)) {
      return json({ error: 'not_found' }, 404);
    }

    // The TTS route does not use GEMINI_KEY; the Gemini routes do not use GCP_SA_JSON. Each checks only
    // its own secret. 501 (not 500) on a missing GCP_SA_JSON is the CLIENT'S clean-skip signal (design
    // §2 / DoD 4): "the secondary is not configured here", not "the server is broken".
    if (!isTts && !env.GEMINI_KEY) return json({ error: 'server_misconfigured', detail: 'GEMINI_KEY secret not set' }, 500);
    if (isTts && !env.GCP_SA_JSON) return json({ error: 'tts_secondary_unconfigured' }, 501);

    const code = (request.headers.get('x-access-code') || '').trim();
    if (!code) return json({ error: 'missing_code' }, 401);
```

Then, immediately after the existing admission lines (currently 239–241), replace:

```js
    const admit = await admitCode(env, code, key, json);
    if (admit.err) return admit.err;
    if (isStream) return handleStream(request, env, ctx, url, code, key, json, cors);
```

with:

```js
    const admit = await admitCode(env, code, key, json);
    if (admit.err) return admit.err;
    if (isTts) return handleCloudTts(request, env, code, key, json, cors);
    if (isStream) return handleStream(request, env, ctx, url, code, key, json, cors);
```

- [ ] **Step 5: Run the worker tests to verify they pass**

```bash
cd worker && npx vitest run
```

Expected: PASS — the ten new tests plus every pre-existing one (D1, B19 successor, streaming metering
F1/F4/F5/F6/F7, B22, E14 ×3, H-3, B21/D3). Paste the full output including the exit code.

- [ ] **Step 6: Document the new secret in the Worker README**

Append to `worker/README.md`:

```markdown
## R-45 · Cloud TTS secondary provider

`POST /v1/tts:synthesize` (header `X-Access-Code`) synthesizes speech through Google Cloud
Text-to-Speech and returns raw PCM16LE mono @24 kHz.

It requires one more secret — a **service account** JSON, because Cloud TTS refuses API keys outright
(`CREDENTIALS_MISSING`):

    wrangler secret put GCP_SA_JSON     # paste the whole service-account JSON file

Never put it in `wrangler.toml` and never commit it. The service account needs the Cloud Text-to-Speech
API enabled on the project and the `roles/serviceusage.serviceUsageConsumer` + TTS user permissions.

Without the secret the route answers `501 {"error":"tts_secondary_unconfigured"}` — that is the client's
signal to skip the secondary provider cleanly, not an error to show a user.

Metering is identical in unit to the other routes: Cloud TTS bills per input character, so the charge is
known before the call and is converted with the same `estimateTokens()` (chars/3, fail-closed).
```

- [ ] **Step 7: Commit**

```bash
git add worker/index.js worker/test/index.spec.js worker/README.md
git commit -m "feat(worker): Cloud TTS route behind the same debit-first admission (R-45 §2)"
```

---

## Task 2: The routing table and provider resolution

**Files:**
- Modify: `app.js` — insert a new block at line 6820 (after `gemPlayPcmStream` closes, before the
  `── Hotfix v281` comment at 6821)
- Test: `tests/tts-provider.spec.ts` (new file)

**Interfaces:**
- Consumes: `gemMode()`, `centralUrl()`, `centralCode()`, `VC_LOCALES`, `vcVoiceLang()` (all existing).
- Produces:
  - `TTS_ROUTE` — `{answer:'gemini', step:'gemini', alert:'cloud'}`
  - `TTS_ROUTE_DEFAULT` — `'gemini'`
  - `ttsCloudAvail() → boolean`
  - `ttsProviderFor(useCase) → 'gemini' | 'cloud'`
  - `ttsCloudOff` — a session latch (`let`, mutable), set when the Worker reports the secondary unconfigured
  - `CLOUD_TTS_VOICE` — `{ 'he-IL': 'he-IL-Chirp3-HD-Kore', ... }`
  - `cloudVoiceFor(lang) → { languageCode, voice }`

- [ ] **Step 1: Write the failing test**

Create `tests/tts-provider.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// R-45 · two-provider TTS layer. Design: docs/superpowers/specs/2026-08-01-tts-provider-layer-design.md
const MANAGED = { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') };
const BYOK = { 'mk-gemkey': JSON.stringify('personal-key-1234567890') };

test('R-45 §4.2: the routing table is data, and resolution filters it by availability', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  const managed = await page.evaluate(`({
    table: JSON.parse(JSON.stringify(TTS_ROUTE)),
    answer: ttsProviderFor('answer'),
    step:   ttsProviderFor('step'),
    alert:  ttsProviderFor('alert'),
    unknown: ttsProviderFor('a-use-case-nobody-added-a-row-for'),
    missing: ttsProviderFor(undefined),
    avail: ttsCloudAvail()
  })`);
  // the table itself matches the design's §4.2 rows exactly
  expect(managed.table).toEqual({ answer: 'gemini', step: 'gemini', alert: 'cloud' });
  expect(managed.avail).toBe(true);
  expect(managed.answer).toBe('gemini');
  expect(managed.step).toBe('gemini');
  expect(managed.alert).toBe('cloud');
  // an unlisted use case falls to the PRIMARY, never to silence
  expect(managed.unknown).toBe('gemini');
  expect(managed.missing).toBe('gemini');
});

test('R-45 §2/DoD-4: a BYOK user has no secondary — every use case resolves to Gemini', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...BYOK });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  const r = await page.evaluate(`({ avail: ttsCloudAvail(), alert: ttsProviderFor('alert'), answer: ttsProviderFor('answer') })`);
  expect(r.avail).toBe(false);                 // no legitimate way to authenticate — design §2
  expect(r.alert).toBe('gemini');              // the cloud row degrades, it does not go silent
  expect(r.answer).toBe('gemini');
});

test('R-45: the session latch takes the secondary out of routing without an error', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  expect(await page.evaluate(`ttsProviderFor('alert')`)).toBe('cloud');
  await page.evaluate(`ttsCloudOff = true`);
  expect(await page.evaluate(`ttsCloudAvail()`)).toBe(false);
  expect(await page.evaluate(`ttsProviderFor('alert')`)).toBe('gemini');
});

test('R-45: the voice mapping produces a real Chirp3-HD name for each supported app language', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudVoiceFor==='function'`);
  const r = await page.evaluate(`({
    he: cloudVoiceFor('he'), en: cloudVoiceFor('en'), ru: cloudVoiceFor('ru'), junk: cloudVoiceFor('zz')
  })`);
  expect(r.he).toEqual({ languageCode: 'he-IL', voice: 'he-IL-Chirp3-HD-Kore' });
  expect(r.en.languageCode).toBe('en-US');
  expect(r.en.voice).toContain('Chirp3-HD');
  expect(r.ru.languageCode).toBe('ru-RU');
  expect(r.junk.languageCode).toBe('he-IL');   // unknown language falls to the app's own default
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx playwright test tests/tts-provider.spec.ts
```

Expected: FAIL — all four time out on `page.waitForFunction("typeof ttsProviderFor==='function'")`, because
nothing defines it. That is the intended RED reason.

- [ ] **Step 3: Add the block to `app.js`**

Insert at line 6820 — i.e. after `gemPlayPcmStream`'s closing `}` and its trailing blank line, immediately
before the `// ── Hotfix v281 (owner-reported live regression…` comment:

```js
/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   R-45 · TWO-PROVIDER TTS LAYER — Gemini primary, Cloud TTS (Chirp3-HD) secondary.
   Design: docs/superpowers/specs/2026-08-01-tts-provider-layer-design.md (owner instruction 1.8.2026).
   Everything below is ONE decision point. gemSpeakSeg / gemSpeakSegAttempt / gemSpeakSegStream /
   gemPlayBuf / gemPlayPcmStream are deliberately UNCHANGED — the seam sits above them, so the shipped
   v281 cursor contract (text, lang, gen, startAt) → cursor is preserved by construction rather than by
   promise. A provider that returns anything else re-opens owner-reported regressions (b) long silence
   between lines and (d) audible jitter DURING playback.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

// §4.2 · THE routing table. DATA, in one place — adding a voice surface is adding a row, never an `if`
// at a call site. The table states PREFERENCE; availability is applied separately, in ttsProviderFor,
// because "is the secondary reachable" is a runtime fact (managed vs BYOK) and not an owner-editable one.
const TTS_ROUTE = {
  answer: 'gemini',   // §4.2 — תשובת AI חופשית: pronunciation quality is the core of the product
  step:   'gemini',   // §4.2 — הקראת שלב/משימה: same timbre as answers, for consistency
  alert:  'cloud',    // §4.2 — התראות קצרות/חוזרות: speed and quota beat timbre
};
const TTS_ROUTE_DEFAULT = 'gemini';   // an unlisted use case gets the PRIMARY — never silence

// Session latch. Set (once) when the Worker answers "the secondary is not configured here" — after that
// the secondary simply is not in routing for this session. Not persisted: a redeployed Worker should be
// discovered on the next load, not stay disabled forever.
let ttsCloudOff = false;

// §2 — a BYOK user CANNOT reach Cloud TTS: it authenticates only with a service account, which lives in
// the Worker and can never be handed to a browser. So the secondary exists exactly when the managed
// Worker is the transport. This is stated, not hidden (design §2, DoD 4).
function ttsCloudAvail(){ return !ttsCloudOff && gemMode()==='managed'; }

// The ONE resolution function. Table lookup, then availability.
function ttsProviderFor(useCase){
  const want = TTS_ROUTE[useCase] || TTS_ROUTE_DEFAULT;
  if(want==='cloud' && !ttsCloudAvail()) return 'gemini';   // clean skip — no error, no silence
  return want;
}

// Chirp3-HD voice names verified against Google's own voice list (docs/research/2026-07-31-cloud-tts-
// evaluation.md §1 — 30 he-IL-Chirp3-HD-* voices, same voice names as Gemini TTS). 'Kore' matches the
// app's own gemVoice() default, so the two engines sound as close as two engines can.
const CLOUD_TTS_VOICE = {
  'he-IL':'he-IL-Chirp3-HD-Kore', 'en-US':'en-US-Chirp3-HD-Kore', 'fr-FR':'fr-FR-Chirp3-HD-Kore',
  'de-DE':'de-DE-Chirp3-HD-Kore', 'es-ES':'es-ES-Chirp3-HD-Kore', 'it-IT':'it-IT-Chirp3-HD-Kore',
  'ru-RU':'ru-RU-Chirp3-HD-Kore',
};
function cloudVoiceFor(lang){
  const lc = (VC_LOCALES[lang] && CLOUD_TTS_VOICE[VC_LOCALES[lang]]) ? VC_LOCALES[lang] : 'he-IL';
  return { languageCode: lc, voice: CLOUD_TTS_VOICE[lc] };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx playwright test tests/tts-provider.spec.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/tts-provider.spec.ts
git commit -m "feat(voice): the R-45 routing table + provider resolution (design §4.2)"
```

---

## Task 3: `cloudSpeakSeg` — the secondary provider, honouring the cursor contract

**Files:**
- Modify: `app.js` — append to the R-45 block created in Task 2
- Test: `tests/tts-provider.spec.ts` (append)

**Interfaces:**
- Consumes: `TTS_MAX`-free; `centralUrl()`, `centralCode()`, `cloudVoiceFor(lang)` (Task 2),
  `gemAudioCtx()`, `gemPcm16ToF32(bytes)`, `gemPlayBuf(buf, gen, startAt)`, `vcGenCurrent(gen)` (existing).
- Produces:
  - `cloudSynthChunk(text, lang) → Promise<Uint8Array>` (PCM16LE @24 kHz mono)
  - `cloudSpeakSeg(text, lang, gen, startAt) → Promise<cursor>` — **the same signature and return value as
    `gemSpeakSeg`** (design §3)
  - `ttsCloudUnavailableErr(err) → boolean` — true for the "secondary not configured here" shapes
  - test seam `window.__cloudTtsMock(text, lang, gen, startAt)` (mirrors `window.__gemTtsStreamMock`)

- [ ] **Step 1: Write the failing tests**

Append to `tests/tts-provider.spec.ts`:

```ts
// A 0.5 s LINEAR16 @24 kHz mono tone, as the Worker route returns it: raw PCM16LE bytes.
const PCM_HELPERS = `
  window.__pcmBytes = function(seconds){
    const n = Math.round(24000*seconds), b = new Uint8Array(n*2), dv = new DataView(b.buffer);
    for(let i=0;i<n;i++) dv.setInt16(i*2, Math.round(3000*Math.sin(i/12)), true);
    return b;
  };`;

test('R-45 DoD-1: cloudSpeakSeg honours the cursor contract — it returns the audio-clock END time', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const calls=[]; const realFetch=window.fetch;
    window.fetch=async function(u,o){ calls.push(String(u)); return new Response(window.__pcmBytes(0.5), {status:200, headers:{'Content-Type':'audio/l16'}}); };
    try{
      const gen=vcNewSpeakGen();
      const ctx=gemAudioCtx();
      const startAt=ctx.currentTime+2.0;                 // a FUTURE cursor, as a mid-answer chunk gets
      const cursor=await cloudSpeakSeg('שלום','he',gen,startAt);
      return { cursor, startAt, url: calls[0], calls: calls.length };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.calls).toBe(1);
  expect(r.url).toContain('/v1/tts:synthesize');
  expect(typeof r.cursor).toBe('number');
  // the returned cursor is an audio-clock time AT OR AFTER startAt, advanced by the clip's duration
  expect(r.cursor).toBeGreaterThan(r.startAt + 0.4);
  expect(r.cursor).toBeLessThan(r.startAt + 0.7);
});

test('R-45 DoD-1: two chained segments queue back-to-back — the second starts where the first ended', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    window.fetch=async function(){ return new Response(window.__pcmBytes(0.3), {status:200}); };
    try{
      const gen=vcNewSpeakGen();
      const c0=await cloudSpeakSeg('אחת','he',gen, gemAudioCtx().currentTime+1.5);
      const c1=await cloudSpeakSeg('שתיים','he',gen,c0);
      return { c0, c1 };
    } finally { window.fetch=realFetch; }
  })()`);
  // no gap and no overlap: the second clip's end is one clip-length past the first's end
  expect(r.c1 - r.c0).toBeGreaterThan(0.25);
  expect(r.c1 - r.c0).toBeLessThan(0.42);
});

test('R-45: a 501 from the Worker is the clean-skip signal, not an error the user sees', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSynthChunk==='function'`);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    window.fetch=async function(){ return new Response(JSON.stringify({error:'tts_secondary_unconfigured'}), {status:501, headers:{'Content-Type':'application/json'}}); };
    try{
      let msg='';
      try{ await cloudSynthChunk('שלום','he'); }catch(e){ msg=String(e.message); }
      return { msg, unavailable: ttsCloudUnavailableErr(new Error(msg)) };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.msg).toContain('cloud-unavailable');
  expect(r.unavailable).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx playwright test tests/tts-provider.spec.ts
```

Expected: the three new tests FAIL on
`page.waitForFunction("typeof cloudSpeakSeg==='function'")` / `cloudSynthChunk` timing out. The four Task-2
tests still pass.

- [ ] **Step 3: Implement**

Append to the R-45 block in `app.js`, after `cloudVoiceFor`:

```js
// Cloud TTS is reachable ONLY through the Worker (design §2). This is a deliberate hard-coding of the
// managed transport: there is no BYOK branch here and there must never be one, because the only
// credential Cloud TTS accepts is a service-account private key, and a key in this bundle is a
// published key. Returns raw PCM16LE @24 kHz mono — the exact shape gemPcm16ToF32 already reads.
async function cloudSynthChunk(text, lang){
  const v = cloudVoiceFor(lang);
  const ctl=(typeof AbortController!=='undefined')?new AbortController():null;
  const to=ctl?setTimeout(function(){ try{ctl.abort();}catch(e){} }, 20000):null;   // same budget as gemSynthChunk
  try{
    const r = await fetch(centralUrl()+'/v1/tts:synthesize', {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Access-Code':centralCode()},
      body: JSON.stringify({ text: text, languageCode: v.languageCode, voice: v.voice }),
      signal: ctl?ctl.signal:undefined });
    if(!r.ok){
      // 501 = this Worker has no service account configured; 404 = a Worker deployed before R-45.
      // Both mean "the secondary does not exist here" — a CONFIGURATION fact, not a synthesis failure.
      if(r.status===501||r.status===404) throw new Error('cloud-unavailable-'+r.status);
      let reason=''; try{ const eb=await r.json(); reason=(eb&&eb.error)||''; }catch(_){}
      throw new Error('cloud-'+r.status+(reason?': '+reason:''));
    }
    const ab = await r.arrayBuffer();
    if(!ab || !ab.byteLength) throw new Error('no-audio');
    return new Uint8Array(ab);
  }catch(e){ throw (e&&e.name==='AbortError') ? new Error('timeout') : e; }
  finally{ if(to) clearTimeout(to); }
}
function ttsCloudUnavailableErr(err){ return /cloud-unavailable/.test(String((err&&err.message)||'')); }

// ── THE CONTRACT (design §3): the SAME signature and the SAME return value as gemSpeakSeg —
// (text, lang, gen, startAt) → cursor, an audio-clock time. Playback is delegated to the EXISTING
// gemPlayBuf, which already (a) threads startAt→endAt, (b) assigns gemSrc BEFORE start(t0) so gemStop()
// can cancel a chunk that is queued-but-not-yet-audible (barge-in, DoD 6), and (c) guards vcSpeaking
// with `gemSrc===src`. Re-implementing any of that here would re-open the v281 regressions.
async function cloudSpeakSeg(text, lang, gen, startAt){
  if(typeof window!=='undefined' && window.__cloudTtsMock) return window.__cloudTtsMock(text, lang, gen, startAt);
  const bytes = await cloudSynthChunk(text, lang);
  if(!vcGenCurrent(gen)) return startAt;              // barge-in during synthesis: never schedule it
  const ctx = gemAudioCtx();
  const f32 = gemPcm16ToF32(bytes);
  if(!f32.length) throw new Error('no-audio');
  const ab = ctx.createBuffer(1, f32.length, 24000);
  ab.getChannelData(0).set(f32);
  if(typeof window!=='undefined') window.__gemAudioChunks++;   // same instrument the streamed path bumps
  return await gemPlayBuf(ab, gen, startAt);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx playwright test tests/tts-provider.spec.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/tts-provider.spec.ts
git commit -m "feat(voice): cloudSpeakSeg — the secondary provider on the v281 cursor contract (R-45 §3)"
```

---

## Task 4: `ttsSpeakSeg` — the single decision point, one-shot fallback, use-case threading

**Files:**
- Modify: `app.js` — append `ttsFallbackWorthy`, `ttsPrefetch`, `ttsSpeakSeg` to the R-45 block;
  rewrite the body of `gemSpeak` (currently `app.js:6917`–`6962`); change `vcSpeak` (`:6967`) and the seven
  call sites at `:7063`, `:7064`, `:7080`, `:7081`, `:7087`, `:7119`, `:7529`
- Test: `tests/tts-provider.spec.ts` (append)

**Interfaces:**
- Consumes: `ttsProviderFor` (Task 2), `cloudSpeakSeg`, `ttsCloudUnavailableErr` (Task 3),
  `gemSpeakSeg`, `gemSpeakSegStream`, `gemSynthChunk`, `gemSynthChunkRetrying`, `gemPlayBuf`,
  `gemIsRateLimited`, `gemTrackPending`, `vcGenCurrent` (existing).
- Produces:
  - `ttsSpeakSeg(text, lang, gen, startAt, useCase) → Promise<cursor>` — the ONLY provider decision point
  - `ttsFallbackWorthy(err) → boolean`
  - `ttsPrefetch(text, gen) → Promise<AudioBuffer>`
  - `gemSpeak(text, lang, gen, useCase)` — signature gains a 4th parameter, default `'answer'`
  - `vcSpeak(text, lang, useCase)` — signature gains a 3rd parameter, default `'answer'`

- [ ] **Step 1: Write the failing tests**

Append to `tests/tts-provider.spec.ts`:

```ts
// Instrument every outbound TTS request so the DoD-8 count assertion is measured, not assumed.
const COUNTING_FETCH = `
  window.__ttsCalls = [];
  window.__realFetch = window.fetch;
  window.__installFetch = function(handler){
    window.fetch = async function(u,o){
      const url=String(u&&u.url?u.url:u);
      if(/:streamGenerateContent|:generateContent|\\/v1\\/tts:synthesize/.test(url)) window.__ttsCalls.push(url);
      return handler(url,o);
    };
  };
  window.__restoreFetch = function(){ window.fetch = window.__realFetch; };
  window.__gemini429 = function(){
    return new Response(JSON.stringify({error:{code:429,message:'You exceeded your current quota',
      details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo', retryDelay:'0s'}]}}),
      {status:429, headers:{'Content-Type':'application/json'}});
  };`;

test('R-45 DoD-2+3+8: a Gemini 429 falls over to Cloud ONCE — sound comes out and the request count does not grow', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    window.__installFetch(async function(url){
      if(url.indexOf('/v1/tts:synthesize')>=0) return new Response(window.__pcmBytes(0.4), {status:200});
      return window.__gemini429();                               // every Gemini TTS request 429s
    });
    try{
      const gen=vcNewSpeakGen();
      const startAt=gemAudioCtx().currentTime+1.0;
      const before=window.__gemAudioChunks;
      const cursor=await ttsSpeakSeg('שלום','he',gen,startAt,'answer');
      return { cursor, startAt, calls: window.__ttsCalls.slice(), audible: window.__gemAudioChunks-before };
    } finally { window.__restoreFetch(); }
  })()`);
  // DoD-2: the user gets SOUND, not silence
  expect(r.audible).toBe(1);
  expect(r.cursor).toBeGreaterThan(r.startAt + 0.3);
  // DoD-3: exactly ONE fallback hop — one Gemini attempt, one Cloud request. Not a loop.
  const gemini = r.calls.filter((u: string) => u.includes('GenerateContent'));
  const cloud = r.calls.filter((u: string) => u.includes('/v1/tts:synthesize'));
  expect(gemini.length).toBe(1);
  expect(cloud.length).toBe(1);
  // DoD-8: 2 requests total — v281's own worst case for this chunk was 4 (attempt ×2, retry ×2)
  expect(r.calls.length).toBe(2);
});

test('R-45 DoD-4: a BYOK user never calls the secondary and never goes silent', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...BYOK });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    window.__installFetch(async function(url){
      if(url.indexOf('/v1/tts:synthesize')>=0) throw new Error('the secondary must never be reached by a BYOK user');
      return new Response(window.__pcmBytes(0.3), {status:200});   // pretend Gemini answers (mocked below anyway)
    });
    window.__gemTtsStreamMock = async function(t,l,g){ window.__spoke=(window.__spoke||0)+1; return gemAudioCtx().currentTime+0.3; };
    try{
      const gen=vcNewSpeakGen();
      const cursor=await ttsSpeakSeg('התראה קצרה','he',gen,0,'alert');   // an ALERT — a cloud row in the table
      return { cursor, spoke: window.__spoke, cloudCalls: window.__ttsCalls.filter(function(u){return u.indexOf('/v1/tts:synthesize')>=0;}).length };
    } finally { window.__restoreFetch(); delete window.__gemTtsStreamMock; }
  })()`);
  expect(r.cloudCalls).toBe(0);        // skipped cleanly — design §2
  expect(r.spoke).toBe(1);             // and it still SPEAKS — no mysterious silence (DoD-4)
  expect(typeof r.cursor).toBe('number');
});

test('R-45: a 403 permission failure is NOT fallback-worthy — a second engine cannot fix billing', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsFallbackWorthy==='function'`);
  const r = await page.evaluate(`({
    rate:    ttsFallbackWorthy(new Error('api-429: RESOURCE_EXHAUSTED')),
    quota:   ttsFallbackWorthy(new Error('api-400: quota')),
    timeout: ttsFallbackWorthy(new Error('timeout')),
    noAudio: ttsFallbackWorthy(new Error('no-audio')),
    perm:    ttsFallbackWorthy(new Error('api-403: permission denied')),
    other:   ttsFallbackWorthy(new Error('api-404: model not found'))
  })`);
  expect(r.rate).toBe(true);
  expect(r.quota).toBe(true);
  expect(r.timeout).toBe(true);
  expect(r.noAudio).toBe(true);
  expect(r.perm).toBe(false);
  expect(r.other).toBe(false);
});

test('R-45 §4.2: an alert routes to the secondary and an answer does not — same code path, table-driven', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    window.__installFetch(async function(url){ return new Response(window.__pcmBytes(0.2), {status:200}); });
    window.__gemTtsStreamMock = async function(){ return gemAudioCtx().currentTime+0.2; };
    try{
      await ttsSpeakSeg('התראה','he',vcNewSpeakGen(),0,'alert');
      const afterAlert = window.__ttsCalls.filter(function(u){return u.indexOf('/v1/tts:synthesize')>=0;}).length;
      await ttsSpeakSeg('תשובה','he',vcNewSpeakGen(),0,'answer');
      const afterAnswer = window.__ttsCalls.filter(function(u){return u.indexOf('/v1/tts:synthesize')>=0;}).length;
      return { afterAlert, afterAnswer };
    } finally { window.__restoreFetch(); delete window.__gemTtsStreamMock; }
  })()`);
  expect(r.afterAlert).toBe(1);        // alert → cloud
  expect(r.afterAnswer).toBe(1);       // answer → gemini (the cloud counter did not move)
});

test('R-45: vcSpeak threads the use case through to the decision point', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof vcSpeak==='function' && typeof ttsSpeakSeg==='function'`);
  const r = await page.evaluate(`(async()=>{
    window.__seen=[];
    const real=window.ttsSpeakSeg;
    window.ttsSpeakSeg=async function(t,l,g,s,useCase){ window.__seen.push(useCase); return (s||0)+0.1; };
    try{
      vcSpeak('תשובה','he');                       // default
      vcSpeak('התראה','he','alert');
      vcSpeakContent('שלב');
      await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(res); }); });
      await window.__mkIdle;
      return window.__seen.slice();
    } finally { window.ttsSpeakSeg=real; }
  })()`);
  expect(r).toContain('answer');
  expect(r).toContain('alert');
  expect(r).toContain('step');
});
```

> **Note for the implementer on the last test:** `vcSpeak` is fire-and-forget. Rather than a timed wait,
> assert on the observable set with a condition wait — replace the two-frame + `__mkIdle` lines with:
> `await page.waitForFunction("window.__seen && window.__seen.length>=3")` placed **outside** the
> `page.evaluate`, and have the evaluate return `window.__seen`. Rework the block that way if the inline
> form is not deterministic; **never** introduce `waitForTimeout`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx playwright test tests/tts-provider.spec.ts
```

Expected: the five new tests FAIL — `typeof ttsSpeakSeg==='function'` / `ttsFallbackWorthy` never becomes
true. The seven earlier tests still pass.

- [ ] **Step 3: Add `ttsFallbackWorthy`, `ttsPrefetch` and `ttsSpeakSeg` to `app.js`**

Append to the R-45 block, after `cloudSpeakSeg`:

```js
// §4.1 names EXACTLY three fallback triggers: 429/quota, timeout, no-audio. Nothing else falls over —
// a 403 is a real permission/billing problem that a second engine cannot fix (and v281 already made
// "never retry a 403" law), a 404 is a wrong model name, and a stream-unsupported is handled separately
// below because the EXISTING blocking path already answers it correctly.
function ttsFallbackWorthy(err){
  const s = String((err&&err.message)||'');
  if(/api-403/.test(s)) return false;
  return gemIsRateLimited(err) || /timeout|no-audio/.test(s);
}
// Lookahead-1 prefetch. When the secondary is available the prefetch does NOT retry Gemini — the ONE
// remedial request belongs to the secondary (design §4.3: "הספק המשני מחליף בקשה, לא מוסיף"). Without a
// secondary the shipped gemSynthChunkRetrying behaviour is used, byte for byte.
function ttsPrefetch(text, gen){
  return ttsCloudAvail() ? gemSynthChunk(text) : gemSynthChunkRetrying(text, gen);
}

// ══ THE ONE DECISION POINT (design §3) ══════════════════════════════════════════════════════════
// (text, lang, gen, startAt) → cursor, plus a useCase for the §4.2 table. Every caller in gemSpeak goes
// through here; no other function in the app names a provider.
//
// Request-count discipline (design §4.3, hotfix 0bee32f is sacred): in the MANAGED path this calls
// gemSpeakSegStream DIRECTLY rather than gemSpeakSeg, because gemSpeakSeg owns the ONE allowed Gemini
// retry. Calling gemSpeakSeg and then the secondary would be 5 requests where v281 allows 4. Calling the
// stream once and then the secondary is 2. The secondary REPLACES the retry; it never adds to it.
//   BYOK (no secondary): gemSpeakSeg is invoked unchanged, retry and all — behaviour identical to v281.
async function ttsSpeakSeg(text, lang, gen, startAt, useCase){
  // the same test seam gemSpeakSeg exposes, at the same position — every existing voice test that
  // installs window.__gemTtsStreamMock keeps working through the new decision point.
  if(typeof window!=='undefined' && window.__gemTtsStreamMock) return window.__gemTtsStreamMock(text, lang, gen);
  const provider = ttsProviderFor(useCase);

  if(provider==='cloud'){
    try{
      return await cloudSpeakSeg(text, lang, gen, startAt);
    }catch(e){
      if(!vcGenCurrent(gen)) return startAt;
      if(!ttsCloudUnavailableErr(e)) throw e;      // a real synthesis failure surfaces — no silent double-spend
      ttsCloudOff = true;                          // latched ONCE per session: this Worker has no secondary
      return await gemSpeakSeg(text, lang, gen, startAt);
    }
  }

  if(!ttsCloudAvail()) return await gemSpeakSeg(text, lang, gen, startAt);   // BYOK — the v281 path, untouched

  try{
    return await gemSpeakSegStream(text, lang, gen);
  }catch(e){
    if(!vcGenCurrent(gen)) return startAt;         // barge-in during the attempt: stay silent
    if(String((e&&e.message)||'')==='stream-unsupported'){
      // a Worker deployed before streaming — the EXISTING blocking path is the right answer, not a
      // different engine (gemSpeakSegAttempt's own branch, reproduced here so gemSpeakSeg stays untouched)
      const buf = await gemSynthChunk(text);
      return vcGenCurrent(gen) ? await gemPlayBuf(buf, gen, startAt) : startAt;
    }
    if(!ttsFallbackWorthy(e)) throw e;
    return await cloudSpeakSeg(text, lang, gen, startAt);   // §4.1 — ONE hop, never a chain
  }
}
```

- [ ] **Step 4: Rewrite `gemSpeak` to use the decision point**

Replace `gemSpeak` (currently `app.js:6917`, the line `async function gemSpeak(text, lang, gen){` through
its closing `}` at 6962) with:

```js
async function gemSpeak(text, lang, gen, useCase){
  if(gen===undefined) gen=vcNewSpeakGen();
  if(!aiAvail()) throw new Error('no-key');            // defensive only — R-35: no keyless user exists
  const L2=lang||vcVoiceLang();
  const UC=useCase||'answer';                          // R-45 §4.2 — the routing key, defaulted, never absent
  // sentence-level split only (min:0 → vcChunkText never merges, so this is the same sentence
  // boundaries the old per-sentence request bug was already using) — vcCoalesceTtsChunks does the
  // actual request-economy coalescing below.
  const sentences=vcChunkText(ttsText(text, L2), {min:0, max:9999});
  const chunks=vcCoalesceTtsChunks(sentences);
  if(!chunks.length) return;
  vcLatMark('ttsReq1');
  // Regression fix (b)+(d) — UNCHANGED from v281: `cursor` is the running audio-clock time threaded
  // across EVERY chunk boundary, and `pending` is the lookahead-1 prefetch. R-45 changes only WHICH
  // engine answers a chunk (ttsSpeakSeg, the single decision point) and what happens when the prefetched
  // Gemini synthesis fails: with a secondary available, the fallback REPLACES the retry (ttsPrefetch
  // drops gemSynthChunkRetrying's retry precisely so the count cannot grow — design §4.3).
  let cursor;
  let pending=null;
  for(let i=0;i<chunks.length;i++){
    if(!vcGenCurrent(gen)) return;
    if(i===0) vcLatMark('firstSound');
    try{
      if(pending && pending.idx===i){
        let buf=null, fellOver=false;
        try{
          buf=await pending.promise;
        }catch(e){
          if(!vcGenCurrent(gen)) return;                // barge-in while prefetching: never schedule it
          if(!ttsCloudAvail() || !ttsFallbackWorthy(e)) throw e;
          fellOver=true;                                // the ONE remedial request goes to the secondary
        }
        if(!vcGenCurrent(gen)) return;
        if(i+1<chunks.length) pending={idx:i+1, promise:gemTrackPending(ttsPrefetch(chunks[i+1], gen))};
        cursor = fellOver ? await cloudSpeakSeg(chunks[i], L2, gen, cursor)
                          : await gemPlayBuf(buf, gen, cursor);
      } else {
        // chunk 0 (or any chunk reached with nothing pre-fetched): the decision point picks the engine.
        const p=ttsSpeakSeg(chunks[i], L2, gen, cursor, UC);
        if(i+1<chunks.length) pending={idx:i+1, promise:gemTrackPending(ttsPrefetch(chunks[i+1], gen))};
        cursor=await p;
      }
    }catch(err){ err.chunkIdx=i; throw err; }           // position → visible error (Task 6)
    if(!vcGenCurrent(gen)) return;
  }
  vcLatMark('done');
}
```

- [ ] **Step 5: Thread the use case through `vcSpeak` and its call sites**

In `vcSpeak` (`app.js:6967`), change the signature line and the `gemSpeak` call:

```js
function vcSpeak(text, lang, useCase){
  const L2=lang||vcVoiceLang();
  const UC=useCase||'answer';                      // R-45 §4.2 — see TTS_ROUTE
  const gen=vcNewSpeakGen();                       // taking the floor invalidates every in-flight speaker
  gemStop();
```

and, further down in the same function:

```js
  gemSpeak(text, L2, gen, UC).catch(err=>{
```

Then update these five call sites — each is a one-argument change:

| Line | Before | After |
|---|---|---|
| `:7063` | `vcSpeak(vcVoiceLang()==='en'? … :'עוד פחות מדקה');` | `vcSpeak(vcVoiceLang()==='en'? … :'עוד פחות מדקה', vcVoiceLang(), 'alert');` |
| `:7064` | `vcSpeak(vcVoiceLang()==='en'?'Time is up for this step.':'הזמן לשלב הזה נגמר.');` | `vcSpeak(vcVoiceLang()==='en'?'Time is up for this step.':'הזמן לשלב הזה נגמר.', vcVoiceLang(), 'alert');` |
| `:7080` | `vcSpeak(m? … :'No temperature for this step.', 'en');` | `vcSpeak(m? … :'No temperature for this step.', 'en', 'step');` |
| `:7081` | `vcSpeak(m? … :'אין טמפרטורה במשימה הזו', 'he');` | `vcSpeak(m? … :'אין טמפרטורה במשימה הזו', 'he', 'step');` |
| `:7087` | `vcSpeak(say, vcVoiceLang());` | `vcSpeak(say, vcVoiceLang(), 'step');` |
| `:7119` | `function vcSpeakContent(text){ vcSpeak(text, vcVoiceLang()); }` | `function vcSpeakContent(text){ vcSpeak(text, vcVoiceLang(), 'step'); }` |
| `:7529` | `vcSpeak(vcVoiceLang()==='en'?'Listening. Say: …':'מאזין. אמור: …', vcVoiceLang());` | `vcSpeak(vcVoiceLang()==='en'?'Listening. Say: …':'מאזין. אמור: …', vcVoiceLang(), 'alert');` |

**Leave unchanged** (they take the `'answer'` default correctly): `:7482`, `:7494`, `:7066`, `:7095`.
No user-facing string is added, removed, or altered by this task — DoD-9 has nothing to check here, and the
plan says so rather than skipping it silently.

- [ ] **Step 6: Run the R-45 tests to verify they pass**

```bash
npx playwright test tests/tts-provider.spec.ts
```

Expected: 12 passed.

- [ ] **Step 7: Run the two voice suites the seam sits under — they must be unaffected**

```bash
npx playwright test tests/voice-wave0.spec.ts tests/p0-tts-routing.spec.ts
```

Expected: all pass, unchanged. If any fails, the seam broke the shipped contract — **stop** and diagnose with
`systematic-debugging`; do not adjust the old tests to fit the new code.

- [ ] **Step 8: Commit**

```bash
git add app.js tests/tts-provider.spec.ts
git commit -m "feat(voice): ttsSpeakSeg — one decision point, one-hop fallback, use-case routing (R-45 §3/§4)"
```

---

## Task 5: The two invariance proofs — safety guard and barge-in

The design calls both of these out as **dedicated** tests (§5: *"בדיקה ייעודית תוכיח זאת"*; DoD 5 and 6).
They are a separate task because a reviewer can reject either one on its own.

**Files:**
- Test: `tests/tts-provider.spec.ts` (append)
- Modify: `app.js` **only if a test proves a defect** — the expectation is that no production change is needed,
  because `vcGuardSpoken` runs upstream of `vcSpeak` and `gemPlayBuf` already owns `gemSrc`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tts-provider.spec.ts`:

```ts
test('R-45 DoD-5: the safety guard cannot be bypassed by routing to the secondary', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof vcGuardSpoken==='function' && typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    // An UNVERIFIED safety number: no tier evidence backs 71, so vcGuardSpoken must strip/redact it.
    const raw='הוצא את העוף כשהליבה מגיעה ל-71 מעלות.';
    const guarded=vcGuardSpoken(raw, {t1:[], t2:[]}, 'he');
    window.__cloudSaw=[]; window.__geminiSaw=[];
    window.__installFetch(async function(url,o){
      const body=JSON.parse((o&&o.body)||'{}');
      if(url.indexOf('/v1/tts:synthesize')>=0){ window.__cloudSaw.push(body.text); return new Response(window.__pcmBytes(0.2),{status:200}); }
      window.__geminiSaw.push(JSON.stringify(body));
      return window.__gemini429();                     // force the fallback so BOTH engines see this text
    });
    try{
      const gen=vcNewSpeakGen();
      await ttsSpeakSeg(guarded,'he',gen,0,'answer');  // gemini first (429) → cloud second
      const gen2=vcNewSpeakGen();
      await ttsSpeakSeg(guarded,'he',gen2,0,'alert');  // routed straight to cloud
      return { raw, guarded, cloudSaw: window.__cloudSaw.slice(), geminiSaw: window.__geminiSaw.slice() };
    } finally { window.__restoreFetch(); }
  })()`);
  // the guard actually did something — otherwise the rest of this test proves nothing
  expect(r.guarded).not.toBe(r.raw);
  expect(r.cloudSaw.length).toBe(2);                                   // fallback path + routed path
  // NEITHER engine ever receives the unguarded text, on EITHER route into the secondary
  for (const seen of r.cloudSaw) {
    expect(seen).toBe(r.guarded);
    expect(seen).not.toContain('71');
  }
  for (const seen of r.geminiSaw) expect(seen).not.toContain('71');
});

test('R-45 DoD-5: the guard runs upstream of provider selection — vcSpeak never hands raw text to any engine', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(`window.__segSaw=[]; window.__realSeg=window.ttsSpeakSeg;
    window.ttsSpeakSeg=async function(t,l,g,s,u){ window.__segSaw.push({t,u}); return (s||0)+0.1; };`);
  await page.evaluate(`(function(){
    const raw='טמפ׳ ליבה 71 מעלות.';
    vcSpeak(vcGuardSpoken(raw, {t1:[],t2:[]}, 'he'), 'he', 'answer');
  })()`);
  await page.waitForFunction(`window.__segSaw.length>0`);
  const saw = await page.evaluate(`window.__segSaw.map(function(x){return x.t;}).join(' ')`);
  await page.evaluate(`window.ttsSpeakSeg=window.__realSeg;`);
  expect(saw).not.toContain('71');
});

test('R-45 DoD-6: barge-in stops the secondary, including audio already SCHEDULED on the clock', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    window.fetch=async function(){ return new Response(window.__pcmBytes(3.0), {status:200}); };
    try{
      const gen=vcNewSpeakGen();
      const ctx=gemAudioCtx();
      // schedule 5 s in the FUTURE: start(t0) has fired but no sound has been produced yet — the exact
      // hazard gemPlayBuf's "gemSrc assigned BEFORE start()" comment names.
      const p=cloudSpeakSeg('טקסט ארוך','he',gen, ctx.currentTime+5.0);
      await new Promise(function(res){ const t=setInterval(function(){ if(gemSrc){ clearInterval(t); res(); } }, 10); });
      const hadSrc = !!gemSrc, wasSpeaking = vcSpeaking;
      let stopped=false;
      const src=gemSrc; src.addEventListener('ended', function(){ stopped=true; });
      gemStop();                                        // the barge-in
      const afterSrc = gemSrc, afterSpeaking = vcSpeaking;
      await new Promise(function(res){ const t=setInterval(function(){ if(stopped){ clearInterval(t); res(); } }, 10); });
      vcNewSpeakGen();                                  // a new speaker takes the floor
      return { hadSrc, wasSpeaking, afterSrc, afterSpeaking, stopped, cursor: await p };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.hadSrc).toBe(true);                 // the queued source is REACHABLE before it plays
  expect(r.wasSpeaking).toBe(true);
  expect(r.afterSrc).toBeNull();               // gemStop() cleared it
  expect(r.afterSpeaking).toBe(false);
  expect(r.stopped).toBe(true);                // and the AudioBufferSourceNode actually stopped
});

test('R-45 DoD-6: a barge-in during cloud SYNTHESIS never schedules the audio at all', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    let release; const gate=new Promise(function(res){ release=res; });
    window.fetch=async function(){ await gate; return new Response(window.__pcmBytes(1.0), {status:200}); };
    try{
      const gen=vcNewSpeakGen();
      const startAt=gemAudioCtx().currentTime+1.0;
      const before=window.__gemAudioChunks;
      const p=cloudSpeakSeg('שלום','he',gen,startAt);
      vcNewSpeakGen();                                  // barge-in WHILE the request is in flight
      release();
      const cursor=await p;
      return { cursor, startAt, scheduled: window.__gemAudioChunks-before, src: gemSrc };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.cursor).toBe(r.startAt);            // the cursor is returned untouched — the contract holds
  expect(r.scheduled).toBe(0);                 // nothing was ever put on the audio clock
  expect(r.src).toBeNull();
});
```

- [ ] **Step 2: Run the tests and record the result honestly**

```bash
npx playwright test tests/tts-provider.spec.ts
```

These four are **invariance** tests: the plan's prediction is that DoD-5's two pass immediately (the guard is
structurally upstream) and DoD-6's two pass immediately (`gemPlayBuf` owns `gemSrc`). Per DoD-2 a test that
passes on the first run is void as a *feature* test — so for each of the four, do this before accepting it:

1. Revert the invariant temporarily. For DoD-5, change the Step-1 test to pass `raw` instead of `guarded`
   into `ttsSpeakSeg` and confirm the assertion **FAILS** (`expect(seen).not.toContain('71')`). For DoD-6,
   comment out `gemSrc=src;` in `gemPlayBuf` and confirm the barge-in test **FAILS** with `hadSrc:false`.
2. Paste both outputs (broken → FAIL, restored → PASS) as the RED/GREEN evidence.
3. Restore the code and the test.

If any of the four fails **without** breaking anything, that is a real defect in the seam — fix it in `app.js`
and record the fix here; do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add tests/tts-provider.spec.ts app.js
git commit -m "test(voice): R-45 DoD-5/DoD-6 — the guard and barge-in bind the secondary identically"
```

---

## Task 6: Bundle-secret proof, full-suite gate, and the DoD sweep

**Files:**
- Test: `tests/tts-provider.spec.ts` (append the bundle check)
- Build: `dist/index.html` (regenerated, not hand-edited)

- [ ] **Step 1: Write the failing bundle test**

Append to `tests/tts-provider.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// R-45 DoD-7: the service-account secret must not be in what we ship. This reads the BUILT bundle, not
// the source — the build is what reaches a user (the v267 lesson: measure the artifact, not a proxy).
test('R-45 DoD-7: no service-account material is present in the shipped bundle', () => {
  const dist = readFileSync(resolve(process.cwd(), 'dist/index.html'), 'utf8');
  for (const needle of [
    'BEGIN PRIVATE KEY', 'PRIVATE KEY-----', 'private_key', 'client_email',
    'iam.gserviceaccount.com', 'oauth2.googleapis.com/token',
    'urn:ietf:params:oauth:grant-type:jwt-bearer', 'GCP_SA_JSON',
  ]) {
    expect(dist).not.toContain(needle);
  }
  // positive control: the bundle DOES contain the client half, so this test is reading the right file
  expect(dist).toContain('/v1/tts:synthesize');
  expect(dist).toContain('cloudSpeakSeg');
});
```

- [ ] **Step 2: Build, then run the bundle test**

```bash
python build.py
npx playwright test tests/tts-provider.spec.ts
```

Expected: 17 passed. If `dist/index.html` still lacks `cloudSpeakSeg`, the build did not pick up `app.js` —
fix that before reading the negative assertions, because they would pass vacuously.

- [ ] **Step 3: Run the worker suite fresh**

```bash
cd worker && npx vitest run; ec=$?; echo "exit=$ec"
```

Paste the full output and the exit code.

- [ ] **Step 4: Run the FULL app suite — plain**

Before running: stop any manual `serve.js` on port 8123 (it collides with Playwright's managed server), and
pause every CPU-heavy background agent (§11a — the worker count assumes an idle machine). Let the run
**complete**; never kill it mid-flight.

```bash
npx playwright test; ec=$?; echo "exit=$ec"
```

**No `--retries`, no `--workers`, no `--grep`.** Any failure — including an intermittent one — is a bug:
diagnose it with `systematic-debugging`, never re-run until green.

- [ ] **Step 5: Map the design's §6 DoD to evidence and paste the table**

Fill this in with real quotes and outputs; an unmet line means the phase is incomplete and is escalated,
not deferred.

| # | Design §6 line | Where it is proven | Evidence |
|---|---|---|---|
| 1 | `cloudSpeakSeg` מכבדת את חוזה הסמן — ההשמעה רציפה גם כשמקטע אחד הגיע מספק אחר | Task 3 tests 1–2 (`cursor` = audio-clock end; two chained segments queue back-to-back with no gap/overlap) | |
| 2 | נפילה מ-429 של Gemini ל-Cloud — נבדקת עם 429 מדומה, ומוכח שיוצא **קול** | Task 4 test 1 (`audible === 1`, cursor advanced) | |
| 3 | נפילה מתרחשת **פעם אחת** ואינה לולאה | Task 4 test 1 (`gemini.length === 1 && cloud.length === 1`) | |
| 4 | משתמש BYOK: הספק המשני מדולג במפורש, בלי שגיאה ובלי שקט מסתורי | Task 2 test 2 + Task 4 test 2 (`cloudCalls === 0` **and** `spoke === 1`) | |
| 5 | שער הבטיחות חל על שני הספקים — בדיקה ייעודית | Task 5 tests 1–2, with the revert-and-observe-RED evidence | |
| 6 | קטיעה עוצרת גם ספק משני, כולל קטע שכבר תוזמן | Task 5 tests 3–4, with the `gemSrc=src` revert evidence | |
| 7 | סוד חשבון-השירות אינו מופיע בחבילה — נבדק ב-`dist/index.html` | Task 6 test (built bundle, with a positive control) | |
| 8 | מספר הבקשות פר-תשובה לא גדל | Task 4 test 1 (`calls.length === 2`, vs v281's worst case of 4) + the budget table at the top of this plan | |

- [ ] **Step 6: Per-task DoD-12 items that do NOT apply, with the reason stated**

- **DoD-8 (visual evidence at 390 × 844):** N/A — this work adds no UI. No element, string, or layout
  changes. Stating it rather than skipping it silently.
- **DoD-9 (Hebrew check):** N/A — no user-facing string is added, removed, or altered. Every existing
  read-aloud toast in `vcSpeak` is untouched, including `VC_TTS_RATE_LIMIT`.
- **DoD-10 (safety invariance):** no `bcheck` stage, `temp`, `safe` value, or cook duration is touched.
  The assertion that proves it is Task 5 test 1: the guarded text handed to *both* engines is byte-identical
  to `vcGuardSpoken`'s output, and the guard itself is unmodified.

- [ ] **Step 7: Commit**

```bash
git add tests/tts-provider.spec.ts dist/index.html
git commit -m "test(voice): R-45 DoD-7 bundle-secret proof + full DoD evidence sweep"
```

---

## Owner-facing items this plan could not settle (raised, not waived — §4)

1. **The `GCP_SA_JSON` secret does not exist yet.** The design's §2 requires the Worker to hold a service
   account; the research doc §8 records the same precondition (*"הבעלים יוצר service account ומפעיל את ה-API
   בפרויקט"*). Every task above is implementable and fully testable without it — the Worker suite uses an
   ephemeral in-process key pair, and the app suite mocks the route. But **the secondary provider cannot be
   verified live** until the owner creates the service account, enables the Cloud Text-to-Speech API, and
   runs `wrangler secret put GCP_SA_JSON`. Until then the Worker answers `501` and the app degrades exactly
   as DoD-4 specifies. Nothing is deferred; a *deployment precondition* is named.
2. **Hebrew Chirp3-HD voice quality is unheard.** Research §9: *"איכות קול עברית בפועל — לא הופק אודיו"*, and
   the owner's own listening test (decision 6129) chose Gemini on quality. The plan hard-codes
   `he-IL-Chirp3-HD-Kore` to match `gemVoice()`'s default. If the owner's listening test after (1) prefers a
   different voice, it is a one-line change to `CLOUD_TTS_VOICE`.
3. **`§10.9` interactive mockup:** not applicable — no visual change. Flagging that the gate was considered
   and found inapplicable, rather than passed over.
