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

const CORS = {
  'Access-Control-Allow-Origin': '*',            // tighten to your app origin(s) for production
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-access-code',
  'Access-Control-Max-Age': '86400',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);

    // health check
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'matkonet-ai', hasKey: !!env.GEMINI_KEY }, 200);
    }

    // only proxy generateContent (and streamGenerateContent) calls
    if (request.method !== 'POST' || !/^\/v1beta\/models\/[^/]+:(generateContent|streamGenerateContent)$/.test(url.pathname)) {
      return json({ error: 'not_found' }, 404);
    }

    if (!env.GEMINI_KEY) return json({ error: 'server_misconfigured', detail: 'GEMINI_KEY secret not set' }, 500);

    // ── access control ──
    const code = (request.headers.get('x-access-code') || '').trim();
    if (!code) return json({ error: 'missing_code' }, 401);

    const raw = await env.CODES.get('code:' + code);
    if (!raw) return json({ error: 'invalid_code' }, 403);
    let rec;
    try { rec = JSON.parse(raw); } catch { rec = { active: true }; }
    if (rec.active === false) return json({ error: 'code_disabled' }, 403);
    if (typeof rec.cap === 'number' && rec.cap > 0 && (rec.used || 0) >= rec.cap) {
      return json({ error: 'quota_reached', reason: 'cap', used: rec.used, cap: rec.cap }, 402);
    }

    // ── forward to Gemini with the server-side key ──
    const body = await request.text();
    let gResp;
    try {
      gResp = await fetch(GEMINI_BASE + url.pathname + url.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body,
      });
    } catch (e) {
      return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
    }
    const text = await gResp.text();

    // ── best-effort token metering (KV is eventually consistent — fine for a small dev cohort) ──
    if (gResp.ok && typeof rec.cap === 'number' && rec.cap > 0) {
      try {
        const j = JSON.parse(text);
        const used = (j.usageMetadata && j.usageMetadata.totalTokenCount) || 0;
        if (used > 0) {
          rec.used = (rec.used || 0) + used;
          rec.lastUsed = new Date().toISOString();
          await env.CODES.put('code:' + code, JSON.stringify(rec));
        }
      } catch { /* non-JSON or streamed body — skip metering */ }
    }

    return new Response(text, { status: gResp.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  },
};
