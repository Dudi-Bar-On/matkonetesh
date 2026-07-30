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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    const json = (obj, status, extra) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', ...(extra || {}) } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // health check — E14: never reveal configuration state to an unauthenticated caller
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'matkonet-ai' }, 200);
    }

    // only proxy generateContent. B19 (Phase 1): the streaming route is CLOSED — the app has zero
    // callers of :streamGenerateContent, and the metering below cannot parse a streamed body, so
    // admitting it was an unmetered bypass. Re-opening requires stream-aware metering first.
    if (request.method !== 'POST' || !/^\/v1beta\/models\/[^/]+:generateContent$/.test(url.pathname)) {
      return json({ error: 'not_found' }, 404);
    }

    if (!env.GEMINI_KEY) return json({ error: 'server_misconfigured', detail: 'GEMINI_KEY secret not set' }, 500);

    const code = (request.headers.get('x-access-code') || '').trim();
    if (!code) return json({ error: 'missing_code' }, 401);

    const ra = retryAfterSeconds(code);
    if (ra > 0) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) });

    const key = 'code:' + code;

    // ── debit-first admission, serialized per code (B21/H-3) ──
    const admit = await withCodeLock(code, async () => {
      const raw = await env.CODES.get(key);
      if (!raw) return { err: json({ error: 'invalid_code' }, 403) };
      let rec;
      try { rec = JSON.parse(raw); } catch { rec = null; }
      if (!rec || typeof rec !== 'object') return { err: json({ error: 'code_record_corrupt' }, 403) };   // B20
      if (rec.active === false) return { err: json({ error: 'code_disabled' }, 403) };
      if (typeof rec.cap !== 'number' || rec.cap <= 0) return { err: json({ error: 'code_uncapped' }, 403) };  // E14: cap-by-omission fails closed
      if ((rec.used || 0) >= rec.cap) {
        return { err: json({ error: 'quota_reached', reason: 'cap', used: rec.used, cap: rec.cap }, 402) };
      }
      rec.used = (rec.used || 0) + RESERVE_TOKENS;   // debit FIRST — a crash mid-flight leaves an over-debit, never a free ride
      await env.CODES.put(key, JSON.stringify(rec));
      return { ok: true };
    });
    if (admit.err) return admit.err;

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
