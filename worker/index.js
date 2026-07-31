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
const LOCKS = new Map();   // code -> tail promise
function withCodeLock(code, fn) {
  const tail = (LOCKS.get(code) || Promise.resolve()).then(fn, fn);
  LOCKS.set(code, tail.then(() => {}, () => {}));
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
        let idx;
        while ((idx = sseBuf.indexOf('\n\n')) >= 0) { scanFrame(sseBuf.slice(0, idx)); sseBuf = sseBuf.slice(idx + 2); }
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
    const isStream = STREAM_RE.test(url.pathname);
    if (request.method !== 'POST' || (!GEN_RE.test(url.pathname) && !isStream)) {
      return json({ error: 'not_found' }, 404);
    }

    if (!env.GEMINI_KEY) return json({ error: 'server_misconfigured', detail: 'GEMINI_KEY secret not set' }, 500);

    const code = (request.headers.get('x-access-code') || '').trim();
    if (!code) return json({ error: 'missing_code' }, 401);

    const ra = retryAfterSeconds(code);
    if (ra > 0) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) });

    const key = 'code:' + code;

    const admit = await admitCode(env, code, key, json);
    if (admit.err) return admit.err;
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
