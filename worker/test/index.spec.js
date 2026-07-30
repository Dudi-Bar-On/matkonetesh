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

describe('B19 — streaming route is closed (app never calls it)', () => {
  it('POST :streamGenerateContent returns 404 and no upstream call', async () => {
    await env.CODES.put('code:streamer', JSON.stringify({ active: true, cap: 1000, used: 10 }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await post(STREAM_URL, 'streamer');
    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
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

describe('CORS — current header value (worker/index.js:20-21)', () => {
  it('characterises today\'s Access-Control-Allow-Origin as "*", not the app origin', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://an-arbitrary-origin.example' },
    });

    expect(response.status).toBe(204);
    // worker/index.js:21 — 'Access-Control-Allow-Origin': '*' — a leaked or
    // shared access code works from any origin. P0-worker tightens this to
    // the app's own origin; once fixed, this exact assertion must change.
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('D3 (bonus) — metering is a check-then-act race (worker/index.js:53, 66, 84)', () => {
  it('GREEN (characterises current race): N concurrent requests lose all but one update', async () => {
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
    const correctTotal = N * TOKENS_PER_REQUEST; // 50, if every debit landed
    // Not a RED assertion of `correctTotal` (that would presume a specific
    // fix — e.g. an atomic increment — that P0-worker hasn't chosen yet).
    // Instead this documents the actual lost-update shape: every one of the
    // N requests read `used: 0` before any of them wrote, so the last write
    // wins and only one request's worth of usage survives.
    expect(rec.used).toBe(TOKENS_PER_REQUEST);
    expect(rec.used).not.toBe(correctTotal);
  });
});
