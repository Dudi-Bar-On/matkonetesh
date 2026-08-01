// worker/test/index.spec.js
//
// Real-workerd characterisation tests for worker/index.js (PRE-3, gap-closing
// program Phase -1, Part 2 Task 2). This suite does NOT fix worker/index.js —
// that is P0-worker's job. It establishes current behaviour, including
// tests that are deliberately RED today because the defect they describe
// has not been fixed yet.
//
// Runs the Worker's actual `fetch` handler inside real `workerd`, via
// @cloudflare/vitest-pool-workers (see ../vitest.config.mjs for why this file
// uses `cloudflareTest()`/`exports.default.fetch` rather than the
// `defineWorkersConfig`/`fetchMock` shape the design doc and task brief
// describe — that API does not exist in the installed package version).
//
// The outbound call to Gemini (worker/index.js:66, `fetch(GEMINI_BASE + ...)`)
// runs in the same isolate as this test file (see vitest.config.js's
// `wrangler.configPath`), so `vi.spyOn(globalThis, "fetch")` intercepts it —
// no real network access, no real GEMINI_KEY. Confirmed against
// cloudflare/workers-sdk's own request-mocking fixture
// (fixtures/vitest-pool-workers-examples/request-mocking/test/imperative.test.ts).

import { env, exports } from 'cloudflare:workers';
import { reset } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://example.com';
const GENERATE_URL = `${ORIGIN}/v1beta/models/gemini-test:generateContent`;
const STREAM_URL = `${ORIGIN}/v1beta/models/gemini-test:streamGenerateContent`;

function geminiOkResponse(totalTokenCount) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      usageMetadata: { totalTokenCount },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function post(url, code, body = '{}') {
  return exports.default.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': code },
    body,
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await reset(); // isolate KV between tests — see fixtures/.../reset/test/reset.test.ts
});

describe('D1 — fail-CLOSED on a malformed KV record (P0-worker fix)', () => {
  it('a non-JSON KV record is rejected with 403, never served', async () => {
    await env.CODES.put('code:corrupt', 'not-valid-json{]');

    // NOTE: `mockImplementation`, not `mockResolvedValue` — a pre-built
    // Response is constructed in the *test's* own context; reading its body
    // from inside the request's own context then trips real workerd's
    // per-request I/O isolation ("Cannot perform I/O on behalf of a
    // different request"). The Response must be built lazily, at call time,
    // inside the request that will consume it. Discovered empirically.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(999));

    const response = await post(GENERATE_URL, 'corrupt');

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('code_record_corrupt');
    expect(fetchSpy).not.toHaveBeenCalled(); // never reaches Gemini
  });
});

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

// Google's REAL wire format separates SSE frames with \r\n\r\n, never \n\n (proven against the live
// API 2026-08-01: CRLFCRLF=1, LFLF=0). `sseFrames` above uses \n\n only — it proves the Worker parses
// its OWN fixture, not that it parses what Google actually sends. `sseFramesCRLF` closes that gap,
// including tearing the separator itself across two enqueued chunks (the nastiest real case).
function sseFramesCRLF(chunks) {       // build lazily INSIDE mockImplementation (workerd I/O isolation)
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) {
      for (const chunk of chunks) c.enqueue(enc.encode(chunk));
      c.close();
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

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

  it('F-happy over the REAL \\r\\n\\r\\n wire format: used reconciles to the FINAL usageMetadata, including a frame torn INSIDE the separator itself', async () => {
    await env.CODES.put('code:st-crlf', JSON.stringify({ active: true, cap: 100000, used: 10 }));
    const frame1 = 'data: ' + JSON.stringify(frameText('שלום, ', 3)) + '\r\n\r\n';
    const frame2 = 'data: ' + JSON.stringify(frameText('עולם.', 9)) + '\r\n\r\n';
    // tear frame2's own separator in half across two enqueued chunks: '...}\r\n' then '\r\n'
    const sepStart = frame2.length - 4;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      sseFramesCRLF([frame1, frame2.slice(0, sepStart + 2), frame2.slice(sepStart + 2)]));
    const r = await post(STREAM_URL, 'st-crlf');
    expect(r.status).toBe(200);
    const bodyText = await r.text();
    expect(bodyText).toContain('שלום, ');
    expect(bodyText).toContain('עולם.');
    await vi.waitFor(async () => {          // reconcile rides ctx.waitUntil — poll the observable state
      expect(JSON.parse(await env.CODES.get('code:st-crlf')).used).toBe(10 + 9);
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

describe('B22 — upstream timeout', () => {
  it('an aborted upstream fetch maps to 504 upstream_timeout', async () => {
    await env.CODES.put('code:slow', JSON.stringify({ active: true, cap: 1000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new DOMException('The operation was aborted', 'AbortError')));
    const response = await post(GENERATE_URL, 'slow');
    expect(response.status).toBe(504);
    expect((await response.json()).error).toBe('upstream_timeout');
  });
});

describe('E14 — health endpoint does not leak configuration', () => {
  it('GET / carries no hasKey field', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/`, { method: 'GET' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect('hasKey' in body).toBe(false);
  });
});

describe('Metering — valid JSON record (worker/index.js:58-60, 77-87)', () => {
  it('GREEN: a code under its cap is proxied and the debit is applied to KV', async () => {
    await env.CODES.put(
      'code:under-cap',
      JSON.stringify({ active: true, cap: 1000, used: 5 })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(42));

    const response = await post(GENERATE_URL, 'under-cap');

    expect(response.status).toBe(200);
    const rec = JSON.parse(await env.CODES.get('code:under-cap'));
    // worker/index.js:82 — `rec.used = (rec.used || 0) + used;`
    expect(rec.used).toBe(5 + 42);
  });

  it('GREEN: a code at its cap is refused with 402 before reaching Gemini', async () => {
    await env.CODES.put(
      'code:at-cap',
      JSON.stringify({ active: true, cap: 100, used: 100 })
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await post(GENERATE_URL, 'at-cap');

    // worker/index.js:58-60 — quota_reached, 402, before the upstream fetch.
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error).toBe('quota_reached');
    expect(fetchSpy).not.toHaveBeenCalled();

    // Refusal must not itself write a debit.
    const rec = JSON.parse(await env.CODES.get('code:at-cap'));
    expect(rec.used).toBe(100);
  });
});

describe('E14 — CORS is an allowlist, not *', () => {
  it('an allowlisted origin is reflected; a foreign origin gets no ACAO', async () => {
    const ok = await exports.default.fetch(`${ORIGIN}/`, {
      method: 'OPTIONS', headers: { Origin: 'https://matkonetesh.pages.dev' } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://matkonetesh.pages.dev');
    const bad = await exports.default.fetch(`${ORIGIN}/`, {
      method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('H-3 — rate limiting', () => {
  it('requests beyond the per-code window get 429 with Retry-After', async () => {
    await env.CODES.put('code:spammy', JSON.stringify({ active: true, cap: 10_000_000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    let limited = null;
    for (let i = 0; i < 25; i++) {
      const r = await post(GENERATE_URL, 'spammy');
      if (r.status === 429) { limited = r; break; }
    }
    expect(limited).not.toBeNull();
    expect((await limited.json()).error).toBe('rate_limited');
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});

describe('E14 — cap is mandatory (cap-by-omission fails closed)', () => {
  it('a record without a positive numeric cap is refused with 403 code_uncapped', async () => {
    await env.CODES.put('code:capless', JSON.stringify({ active: true }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await post(GENERATE_URL, 'capless');
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('code_uncapped');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('B21/D3 — metering race is fixed: per-code lock + debit-first + reconcile', () => {
  it('N concurrent requests: the final `used` reflects ALL N debits, none lost', async () => {
    const N = 5;
    const TOKENS_PER_REQUEST = 10;
    await env.CODES.put(
      'code:racer',
      JSON.stringify({ active: true, cap: 100000, used: 0 })
    );

    // Widen the race window: each mocked upstream call independently delays
    // before resolving with its OWN freshly-created Response. Real workerd
    // enforces genuine per-request I/O isolation — a `Response`/stream
    // object created while handling one request cannot be read from a
    // different request's context ("Cannot perform I/O on behalf of a
    // different request"), discovered empirically when this test first
    // tried to synchronise by resolving N requests' fetches from a single
    // shared array of resolvers. Each request must create and consume only
    // its own Response. The delay (comfortably longer than a local KV
    // get/put) is what forces the interleave: all N requests' KV reads
    // (worker/index.js:53) complete before any of their delayed fetches
    // resolve, so all N observe the same pre-request `used` value.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(geminiOkResponse(TOKENS_PER_REQUEST)), 30);
        })
    );

    const responses = await Promise.all(
      Array.from({ length: N }, () => post(GENERATE_URL, 'racer'))
    );

    expect(responses.every((r) => r.status === 200)).toBe(true);

    const rec = JSON.parse(await env.CODES.get('code:racer'));
    const correctTotal = N * TOKENS_PER_REQUEST; // 50 — every debit landed (PRE-3 design D3 acceptance)
    expect(rec.used).toBe(correctTotal);
  });
});

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
