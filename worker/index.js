/* ────────────────────────────────────────────────────────────────────────
   Matkonet · managed-AI proxy (Cloudflare Worker)

   Holds the Gemini API key server-side and gates access with per-user codes,
   so selected users run AI through YOUR key while everyone else uses BYOK.

   Requires:
     • secret  GEMINI_KEY   — your Gemini API key   (wrangler secret put GEMINI_KEY)
     • KV       CODES        — per-user access codes  (see wrangler.toml + README)

   The app POSTs to  <worker>/v1beta/models/<model>:generateContent
   with header  X-Access-Code: <code>. This Worker validates the code, meters
   usage, then forwards the request to Gemini with the real key and returns the
   response verbatim. It speaks the same generateContent contract as Google, so
   the app's transport code is unchanged above this layer.
   ──────────────────────────────────────────────────────────────────────── */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const UPSTREAM_TIMEOUT_MS = 60_000;      // B22
const RESERVE_TOKENS = 2000;             // debit-first provisional charge, reconciled to actual usage
const RATE_WINDOW_MS = 60_000;           // H-3: per-code fixed window (per isolate)
const RATE_MAX_PER_WINDOW = 20;

// E14: CORS is an allowlist. ALLOWED_ORIGINS is a plain wrangler var (comma-separated), NOT a secret.
const DEFAULT_ALLOWED_ORIGINS = ['https://matkonetesh.pages.dev', 'http://localhost:8123'];
function allowedOrigins(env) {
  return env.ALLOWED_ORIGINS
    ? String(env.ALLOWED_ORIGINS).split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-access-code',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowedOrigins(env).includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;   // no ACAO header at all for a foreign origin — the browser blocks the read
}

// H-3: per-code serialization within this isolate. Fixes the B21 check-then-act race for all
// concurrency a single isolate sees (which is what the PRE-3 harness measures). Cross-isolate
// concurrency still rides KV eventual consistency; debit-first bounds that exposure to ~one
// RESERVE per isolate. The atomic cross-isolate fix is a Durable Object — Sync Thread / S1
// (trigger-anchored per H8; do not silently attempt it here).
// The lock must never outlive its holder. A holder whose request is interrupted mid-critical-section
// (client abort / navigation away / a torn-down request context) leaves a promise that NEVER settles —
// not resolved, not rejected — so a `finally` INSIDE the holder can never run, and neither can any
// timer the holder registered: both die with the context. Chaining unconditionally on that promise is
// what bricked an access code in production for every later request until timeout (evidence:
// docs/analysis/2026-08-02-asado-guard-repro.md §1). The release is therefore enforced on the WAITER's
// side, whose own context is alive and whose own timer is the only clock still running. Bounded
// staleness (LOCK_MAX_MS) beats a permanent deadlock; the critical sections here are a KV get + put,
// so the ceiling is orders of magnitude above any healthy holder and only a dead one ever hits it.
const LOCKS = new Map();   // code -> tail promise (settles when that holder releases)
const LOCK_MAX_MS = 5_000; // longest a waiter will honour a predecessor before declaring it dead
function withCodeLock(code, fn) {
  const prev = LOCKS.get(code);
  let gate;
  if (!prev) {
    gate = Promise.resolve();
  } else {
    let timer;
    gate = Promise.race([
      prev.then(() => {}, () => {}),
      new Promise((resolve) => { timer = setTimeout(resolve, LOCK_MAX_MS); }),
    ]).then(() => { clearTimeout(timer); }, () => { clearTimeout(timer); });
  }
  const tail = gate.then(fn, fn);
  const released = tail.then(() => {}, () => {});
  LOCKS.set(code, released);
  // Drop the entry once released, so LOCKS cannot grow without bound across every code an isolate has
  // ever seen. A dead holder never reaches here — its stale entry is displaced by the next waiter.
  released.then(() => { if (LOCKS.get(code) === released) LOCKS.delete(code); }, () => {});
  return tail;
}

const RATE = new Map();    // code -> { reset:number, n:number }
function retryAfterSeconds(code) {
  const now = Date.now();
  const e = RATE.get(code);
  if (!e || now >= e.reset) { RATE.set(code, { reset: now + RATE_WINDOW_MS, n: 1 }); return 0; }
  e.n += 1;
  if (e.n > RATE_MAX_PER_WINDOW) return Math.max(1, Math.ceil((e.reset - now) / 1000));
  return 0;
}

async function reconcile(env, code, key, actualTokens) {
  await withCodeLock(code, async () => {
    const raw = await env.CODES.get(key);
    if (!raw) return;
    let rec; try { rec = JSON.parse(raw); } catch { return; }
    if (!rec || typeof rec !== 'object') return;
    rec.used = Math.max(0, (rec.used || 0) - RESERVE_TOKENS + actualTokens);
    rec.lastUsed = new Date().toISOString();
    await env.CODES.put(key, JSON.stringify(rec));
  });
}

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

  // Google's real wire format separates SSE frames with \r\n\r\n, not \n\n (proven against the live
  // API 2026-08-01: CRLFCRLF=1, LFLF=0) — GEM_SSE_SEP matches either, and a tear landing inside the
  // separator itself resolves once sseBuf is rescanned on the next chunk (no stateful regex state).
  const GEM_SSE_SEP = /\r\n\r\n|\n\n/;
  const meter = { total: 0, sawUsage: false, chars: 0 };
  const scanFrame = (frame) => {                   // one complete SSE event (between blank lines)
    for (const line of frame.split(/\r?\n/)) {
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

  // Deviates from the brief's literal sketch — proven necessary by measurement, not guessed (3-fix
  // rule / systematic-debugging). Two prior designs were tried and empirically falsified in real
  // workerd (via @cloudflare/vitest-pool-workers): (1) a TransformStream whose `writer.closed` was
  // raced against the upstream read — `writer.closed` never rejected when the CLIENT cancelled the
  // Response body reader while a read was in flight. (2) a lazy custom `ReadableStream` whose own
  // `cancel()` callback was expected to fire on client disconnect — it never fired either, while a
  // `pull()` was in flight, EVEN with 15s of observation. Root cause (confirmed by a passing minimal
  // repro that omitted the surrounding request/response round trip): once the response has already
  // been returned from the request's own `fetch()` call, further work belonging to that request keeps
  // executing correctly ONLY if it is pinned via `ctx.waitUntil` from the START — a lazily-invoked
  // `pull()`/`cancel()` that the runtime calls later, on demand, is NOT itself so pinned, and workerd's
  // per-request I/O isolation (see this file's `deleteAllDurableObjects` neighbour and D1's own
  // comment) then never delivers the client's cancel signal into it. The fix: go back to an EAGER pump
  // — pinned via `ctx.waitUntil(pump)` BEFORE the Response returns (as the brief specified) — and
  // detect the disconnect via `request.signal` (the ORIGINAL request's AbortSignal, attached
  // synchronously, in the SAME live context, before any await) instead of a stream-internal signal.
  // Confirmed empirically: with the pump pinned from the start, `request.signal`'s `abort` event fires
  // and unblocks the race. Same contract as the brief's version: SSE scanning per complete frame, cap
  // never cuts mid-stream (F5), STREAM_MAX_TOKENS cuts at a frame boundary (F6), disconnect stops the
  // upstream spend and still reconciles fail-closed (F4).
  const clientGone = new Promise((resolve) => {
    request.signal.addEventListener('abort', () => resolve(true));
  });

  const { readable, writable } = new TransformStream();
  const pump = (async () => {
    const reader = gResp.body.getReader();
    const writer = writable.getWriter();
    const dec = new TextDecoder();
    let sseBuf = '', disconnected = false;
    try {
      for (;;) {
        const raced = await Promise.race([
          reader.read().then((r) => ({ kind: 'read', ...r })),
          clientGone.then(() => ({ kind: 'gone' })),
        ]);
        if (raced.kind === 'gone') {
          disconnected = true;
          try { await reader.cancel(); } catch {}    // F4 — stop the spend on the upstream
          break;
        }
        const { done, value } = raced;
        if (done) break;
        // scan COMPLETE frames only — a count over half a frame would miscount
        sseBuf += dec.decode(value, { stream: true });
        let m;
        while ((m = GEM_SSE_SEP.exec(sseBuf))) { scanFrame(sseBuf.slice(0, m.index)); sseBuf = sseBuf.slice(m.index + m[0].length); }
        try { await writer.write(value); } catch {}    // the client is gone; ignore, `clientGone` already covers it
        if (runningCount() > STREAM_MAX_TOKENS) {       // F6 — abuse ceiling, NOT cap
          try { await reader.cancel(); } catch {}
          break;                                    // the check runs after scanning, so the cut lands
          // after the last COMPLETE frame that crossed the ceiling; the client parser only acts on
          // complete frames and treats a no-finish end as an error — the contract holds.
        }
      }
    } finally {
      if (!disconnected) { try { await writer.close(); } catch {} }
      // F3/F7 — completed or cut normally: the last reported usageMetadata IS authoritative (spec
      // §2.3's "final frame wins"); unknown falls back to the reserve-or-estimate floor.
      // F4 — disconnected: a partial usageMetadata seen before the client hung up is NOT authoritative
      // (the model may have kept climbing right up to the moment we stopped listening) — always floor
      // at the RESERVE regardless of what was counted, never trust a lower mid-stream figure.
      const actual = disconnected
        ? Math.max(RESERVE_TOKENS, meter.sawUsage ? meter.total : estimateTokens(meter.chars))
        : (meter.sawUsage ? meter.total : Math.max(RESERVE_TOKENS, estimateTokens(meter.chars)));
      await reconcile(env, code, key, actual);
    }
  })();
  ctx.waitUntil(pump);                             // pins the pump so it keeps running (and can still
                                                    // receive the disconnect signal) after the Response returns
  return new Response(readable, {
    status: 200,
    headers: { ...cors, 'Content-Type': gResp.headers.get('Content-Type') || 'text/event-stream' },
  });
}

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    const json = (obj, status, extra) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', ...(extra || {}) } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // health check — E14: never reveal configuration state to an unauthenticated caller
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'matkonet-ai' }, 200);
    }

    // Phase 1 Task 6 closed :streamGenerateContent as an unmetered bypass (B19). It returns here —
    // METERED (2026-07-31, owner GO on R-37; kept per R-40 because it protects the OWNER'S key and
    // bill): same debit-first admission, SSE tee metering, reconcile-on-completion (see handleStream).
    // Removing the metering, not the route, is the security regression review must catch. The route is
    // modality-agnostic (spec §2.1): text and AUDIO (responseModalities) streams meter identically.
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

    const ra = retryAfterSeconds(code);
    if (ra > 0) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) });

    const key = 'code:' + code;

    const admit = await admitCode(env, code, key, json);
    if (admit.err) return admit.err;
    if (isTts) return handleCloudTts(request, env, code, key, json, cors);
    if (isStream) return handleStream(request, env, ctx, url, code, key, json, cors);

    // ── forward to Gemini (Task 6: timeout) ──
    const body = await request.text();
    let gResp, text;
    try {
      gResp = await fetch(GEMINI_BASE + url.pathname + url.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      text = await gResp.text();
    } catch (e) {
      await reconcile(env, code, key, 0);   // refund the reserve — the upstream call died
      if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) return json({ error: 'upstream_timeout' }, 504);
      return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
    }

    // ── reconcile the reserve to actual usage ──
    let actual = 0;
    if (gResp.ok) {
      try { actual = (JSON.parse(text).usageMetadata || {}).totalTokenCount || 0; } catch { actual = RESERVE_TOKENS; }
      // non-parseable 200 body: keep the full reserve as the debit — fail closed, never free
    }
    await reconcile(env, code, key, actual);

    return new Response(text, { status: gResp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
