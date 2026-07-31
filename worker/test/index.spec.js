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
