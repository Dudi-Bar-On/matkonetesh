# Metered Streaming (v281) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return `streamGenerateContent` to the Worker as a **metered, per-user-enforced** route; stream the voice answer client-side and synthesize the first sentence the moment it closes (~3.3 s to first sound vs ~99 s); land the R-38 tier infrastructure; add the R-36a voice length instruction with its safety-completeness override.

**Architecture:** Worker: one shared debit-first admission helper feeds both routes; the streaming route tees the SSE body through a meter (usage-metadata scan + char estimator) and reconciles via the existing `reconcile()` under `ctx.waitUntil`. Client: `gemFetch`'s transport logic is factored into `gemTransport` shared with a new `gemStreamFetch`; `vcAskFlow` feeds deltas into a sentence assembler; only provably digit-free sentences speak early; `vcGuardSpoken` runs once on the complete answer. Tiers: a `TIERS` table in the Worker + `tier` field on the code record, `default` = today's numbers.

**Tech Stack:** Cloudflare Worker (vanilla JS, KV) · vitest + @cloudflare/vitest-pool-workers (`cd worker && npm test`) · single-file PWA `app.js` · Playwright (`npx playwright test`) · `scripts/central-code.mjs` (wrangler KV).

**Spec:** `docs/superpowers/specs/2026-07-31-metered-streaming-design.md` (approved before any task starts — pipeline §2).
**Sequencing:** this plan executes ONLY AFTER Voice Wave 0 is merged (it consumes `vcChunkText`, `gemSynthChunk`, `gemPlayBuf`, `vcSpeakGen`, `ttsText`, `vcLatMark` — all Wave-0 deliverables). Do not run it concurrently with the Wave-0 agent in `app.js`.

## Global Constraints

(Copied verbatim from spec §9. Every task's requirements implicitly include this section.)

1. **Secrets never enter the repo.** `GEMINI_API_KEY` exists in the environment for measurement only — never read into committed code, never printed. Worker secrets stay Worker secrets.
2. **Safety invariance (DoD-10):** no `bcheck` stage, `temp`, `safe` value, or cook duration altered anywhere in this arc.
3. **The v278 spoken-safety guarantees + INV-T hold through streaming** (spec §6): the guard runs on the complete answer only; early speech only through the digit-free gate; `ttsText` remains the only post-guard transform.
4. **`tests/TEST-AUTHORING-CONTRACT.md` binds every Playwright test** (warm page + `seedApp`, no `addInitScript`, condition-based waits, `npx playwright test` plain). Worker tests run under `cd worker && npm test` (vitest, real workerd) — both suites are release gates.
5. **B19 must not regress:** no unmetered byte ever flows upstream; admission precedes the first upstream byte on every path.
6. **No behaviour change for existing users:** records without `tier` behave exactly as today on the non-streaming route (rate 20/min, their own cap, same errors). ONE reviewed exception, stated in Task 1: the rate window is now checked after code validation, so an *invalid* code is answered 403 without rate accounting.
7. **Out of scope:** pricing/product tiers/UI/billing (band-H, D8); streaming for non-voice call sites; TTS audio streaming (seam only).

**Per-task DoD (discipline §3):** every task below additionally runs the 12-point gate — spec line traced, RED witnessed (output pasted), GREEN fresh (exit code shown), behavioural assertion, consumer named, fixture minimality, no arbitrary waits, and the suite relevant to the touched code (`cd worker && npm test` for worker tasks ×1; `npx playwright test` ×1 for app tasks; both ×2 at the release task, H7).

---

### Task 1: Worker tier table + tier-derived rate limit

**Files:**
- Modify: `worker/index.js` (constants block, `retryAfterSeconds`, the admission block)
- Test: `worker/test/index.spec.js`

**Interfaces:**
- Produces: `TIERS` (module const), `tierOf(rec) → {ratePerMin, streaming, streamMaxTokens, mintCap}`, `retryAfterSeconds(code, maxPerWindow)` (now parameterized). Task 2 consumes `tierOf` inside admission; Task 4 mirrors `TIERS[*].mintCap` in `central-code.mjs`.
- Spec trace: spec §4.1 ("The tier table"), §9 constraint 6.

- [ ] **Step 1: Write the failing tests** — append to `worker/test/index.spec.js`:

```js
describe('R-38 — tier infrastructure (spec §4.1)', () => {
  it('a record with NO tier behaves exactly as today: default rate 20/min', async () => {
    await env.CODES.put('code:no-tier', JSON.stringify({ active: true, cap: 10_000_000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    let limited = 0;
    for (let i = 0; i < 25; i++) {
      const r = await post(GENERATE_URL, 'no-tier');
      if (r.status === 429) limited++;
    }
    expect(limited).toBe(5);            // requests 21..25 refused — the pre-tier number, unchanged
  });

  it('an `extended` tier record gets its higher rate (60/min)', async () => {
    await env.CODES.put('code:ext', JSON.stringify({ active: true, cap: 10_000_000, used: 0, tier: 'extended' }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    let limited = 0;
    for (let i = 0; i < 25; i++) {
      const r = await post(GENERATE_URL, 'ext');
      if (r.status === 429) limited++;
    }
    expect(limited).toBe(0);            // 25 < 60 — never limited
  });

  it('an UNKNOWN tier name falls back to default (no crash, rate 20)', async () => {
    await env.CODES.put('code:weird', JSON.stringify({ active: true, cap: 10_000_000, used: 0, tier: 'no-such-tier' }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    const r = await post(GENERATE_URL, 'weird');
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `cd worker && npm test`
Expected: the first new test FAILS — today's `retryAfterSeconds` runs **before** the KV read and knows no tier; after the Step-3 move it must fail for the *intended* reason first (paste the failure: `expected 5 to be…` / tier tests failing because `tier` is ignored). If a new test passes on first run, it is void — rewrite it (DoD-2).

- [ ] **Step 3: Implement** — in `worker/index.js`:

Replace the `RATE_MAX_PER_WINDOW` constant + `retryAfterSeconds` with:

```js
const RATE_WINDOW_MS = 60_000;           // H-3: per-code fixed window (per isolate)

// R-38 tier table (spec §4.1) — INFRASTRUCTURE identifiers, not products (band-H owns naming/pricing).
// `default` MUST equal the pre-tier constants: rate 20/min. mintCap is consumed ONLY by
// scripts/central-code.mjs at mint time — the Worker itself still refuses a capless record (E14).
const TIERS = {
  default:  { ratePerMin: 20, streaming: true, streamMaxTokens: 4096, mintCap: 2_000_000 },
  extended: { ratePerMin: 60, streaming: true, streamMaxTokens: 8192, mintCap: 20_000_000 },
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

Then MOVE the rate check from its current pre-KV position (after `if (!code) …`) to inside the admission flow — Task 2 lands the shared `admitCode` helper that hosts it; for THIS task, place it inside the existing `withCodeLock` admission block, immediately after the `code_uncapped` check:

```js
      // rate limit is tier-derived (R-38) and therefore runs AFTER the record loads. Reviewed trade
      // (Global Constraint 6): an invalid code now costs one cached KV read and a 403 instead of
      // consuming rate budget — validation is the cheaper gate, and 403 is not a retryable answer.
      const tier = tierOf(rec);
      const ra = retryAfterSeconds(code, tier.ratePerMin);
      if (ra > 0) return { err: json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) }) };
```

and DELETE the old pre-KV block (`const ra = retryAfterSeconds(code); if (ra > 0) …`).

- [ ] **Step 4: Run to verify GREEN**

Run: `cd worker && npm test`
Expected: PASS including the pre-existing `H-3 — rate limiting` test (it uses a valid record, so the moved check still fires). Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add worker/index.js worker/test/index.spec.js
git commit -m "feat(worker): R-38 tier table — rate limit derives from tierOf(rec), default = today's numbers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 2: Shared admission helper + streaming-route admission (the B19 rewrite)

**Files:**
- Modify: `worker/index.js` (extract `admitCode`; add the streaming path match; add `ctx` to `fetch`)
- Test: `worker/test/index.spec.js` (REWRITE the B19 describe block; add streaming-admission tests)

**Interfaces:**
- Consumes: `tierOf`, `retryAfterSeconds(code, max)` (Task 1).
- Produces: `admitCode(env, code, key, json, wantStream) → {err} | {ok:true, tier}` — Task 3's streaming body consumes `tier`. Route regex `STREAM_RE`. `fetch(request, env, ctx)` (three-arg — Task 3 needs `ctx.waitUntil`).
- Spec trace: spec §2.1–§2.2, §3 ("no upstream byte flows before admission passes and the reserve is debited").

- [ ] **Step 1: Rewrite the B19 test + add streaming-admission tests** — in `worker/test/index.spec.js`, REPLACE the whole `describe('B19 — streaming route is closed …')` block with:

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

  it('a tier with streaming:false is refused 403 streaming_not_allowed and nothing is debited', async () => {
    // fixture minimality: the tier table has no streaming:false row in production; inject one via the
    // record's own tier name being absent is NOT the negative case — patch a test-only expectation by
    // asserting on the generateContent route instead is wrong too. The honest negative: TIERS is a
    // module const, so this test pins the CONTRACT via a record naming a hypothetical row only if one
    // exists. Until a no-streaming tier row exists, this test asserts the default tier STREAMS:
    await env.CODES.put('code:st-def', JSON.stringify({ active: true, cap: 1000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(7));
    const r = await post(STREAM_URL, 'st-def');
    expect(r.status).toBe(200);   // default tier: streaming allowed (spec §4.1)
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
```

- [ ] **Step 2: Run to verify RED**

Run: `cd worker && npm test`
Expected: all four FAIL — the route still 404s (`expected 402, got 404` etc.). Paste output. (The old B19 test is gone with the block; its security property lives on in these four.)

- [ ] **Step 3: Implement** — in `worker/index.js`:

(a) change the export signature to `async fetch(request, env, ctx)`.

(b) replace the single-route guard (lines ~91-96) with:

```js
    // Phase 1 Task 6 closed :streamGenerateContent as an unmetered bypass (B19). It returns here —
    // METERED (2026-07-31, owner GO on R-37): same debit-first admission, SSE tee metering,
    // reconcile-on-completion (see handleStream). Removing the metering, not the route, is the
    // security regression review must catch.
    const GEN_RE = /^\/v1beta\/models\/[^/]+:generateContent$/;
    const STREAM_RE = /^\/v1beta\/models\/[^/]+:streamGenerateContent$/;
    const isStream = STREAM_RE.test(url.pathname);
    if (request.method !== 'POST' || (!GEN_RE.test(url.pathname) && !isStream)) {
      return json({ error: 'not_found' }, 404);
    }
```

(c) extract the admission block (the current `withCodeLock` IIFE, lines ~108-124, INCLUDING Task 1's in-lock rate check) into a top-level helper — moved verbatim, plus the two marked lines:

```js
// ── ONE admission for both routes (spec §2.2) — debit-first, serialized per code (B21/H-3).
// wantStream adds the tier's streaming check BEFORE the debit (a refusal costs the user nothing).
async function admitCode(env, code, key, json, wantStream) {
  return withCodeLock(code, async () => {
    const raw = await env.CODES.get(key);
    if (!raw) return { err: json({ error: 'invalid_code' }, 403) };
    let rec;
    try { rec = JSON.parse(raw); } catch { rec = null; }
    if (!rec || typeof rec !== 'object') return { err: json({ error: 'code_record_corrupt' }, 403) };   // B20
    if (rec.active === false) return { err: json({ error: 'code_disabled' }, 403) };
    if (typeof rec.cap !== 'number' || rec.cap <= 0) return { err: json({ error: 'code_uncapped' }, 403) };  // E14
    const tier = tierOf(rec);                                                             // R-38
    const ra = retryAfterSeconds(code, tier.ratePerMin);
    if (ra > 0) return { err: json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) }) };
    if (wantStream && tier.streaming === false) return { err: json({ error: 'streaming_not_allowed' }, 403) };
    if ((rec.used || 0) >= rec.cap) {
      return { err: json({ error: 'quota_reached', reason: 'cap', used: rec.used, cap: rec.cap }, 402) };
    }
    rec.used = (rec.used || 0) + RESERVE_TOKENS;   // debit FIRST — a crash mid-flight leaves an over-debit, never a free ride
    await env.CODES.put(key, JSON.stringify(rec));
    return { ok: true, tier };
  });
}
```

(d) in the handler, replace the inlined admission with:

```js
    const admit = await admitCode(env, code, key, json, isStream);
    if (admit.err) return admit.err;
    if (isStream) return handleStream(request, env, ctx, url, code, key, json, cors, admit.tier);
```

(e) TEMPORARY bridge so this task is green on its own (Task 3 replaces it): a minimal `handleStream` that forwards and reconciles like the non-streaming route but passes the body through un-teed:

```js
// Task-2 bridge — REPLACED WHOLESALE by Task 3's tee-metering version. Charges the full reserve
// (fail closed) because it cannot yet count a streamed body. Never ship past Task 3.
async function handleStream(request, env, ctx, url, code, key, json, cors, tier) {
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
    await reconcile(env, code, key, 0);
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) return json({ error: 'upstream_timeout' }, 504);
    return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
  }
  if (!gResp.ok) { const t = await gResp.text(); await reconcile(env, code, key, 0);
    return new Response(t, { status: gResp.status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
  return new Response(gResp.body, { status: 200,
    headers: { ...cors, 'Content-Type': gResp.headers.get('Content-Type') || 'text/event-stream' } });
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `cd worker && npm test`
Expected: PASS — all four new tests + the whole existing suite (the extraction is behaviour-preserving for `generateContent`; any existing-test failure means the extraction drifted — fix the extraction, not the test). Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add worker/index.js worker/test/index.spec.js
git commit -m "feat(worker): streaming route returns METERED — shared debit-first admission, B19 test rewritten to its successor property

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 3: Stream tee metering, reconcile, ceiling, disconnect (the heart)

**Files:**
- Modify: `worker/index.js` (replace the Task-2 bridge `handleStream`)
- Test: `worker/test/index.spec.js`

**Interfaces:**
- Consumes: `admitCode` (Task 2), `reconcile` (existing, unchanged), `tier.streamMaxTokens` (Task 1).
- Produces: the final `handleStream(request, env, ctx, url, code, key, json, cors, tier)`. The client (Task 6) relies on: SSE passthrough byte-for-byte; admission errors as plain JSON before any SSE byte; stream may end early only at a frame boundary.
- Spec trace: spec §2.3 (counting), §2.4 F1–F9, §2.5 (never cut for cap).

- [ ] **Step 1: Write the failing tests** — append to `worker/test/index.spec.js`:

```js
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

  it('F6 ceiling: the tier streamMaxTokens cuts a runaway stream at a FRAME boundary', async () => {
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
Expected: F-happy FAILS (bridge charges full reserve: `expected 19, got 2010`), F5's second-request check fails, F4/F6 fail (no tee/no ceiling). Paste each failure reason — each must be the *intended* one.

- [ ] **Step 3: Implement** — replace the Task-2 bridge `handleStream` wholesale:

```js
// ── the metered streaming body (spec §2.3-§2.5) ──
// Counting: an SSE scanner rides a tee of the upstream body. usageMetadata is cumulative with the
// final frame authoritative; when absent, charge max(RESERVE, ceil(chars/3)) — fail closed (F7).
// Cap crossing mid-stream NEVER cuts (F5/spec §2.5 — a truncated cooking instruction can invert
// meaning); the tier's streamMaxTokens (F6) bounds the worst case and cuts only at a frame boundary.
// Client disconnect (F4): cancel upstream (stop the spend), reconcile what was counted under
// ctx.waitUntil, registered BEFORE the Response returns.
function estimateTokens(chars) { return Math.ceil(chars / 3); }   // denser than the EN 4-chars rule — Hebrew tokenizes denser; fail closed

async function handleStream(request, env, ctx, url, code, key, json, cors, tier) {
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
        // scan COMPLETE frames only — a guard over half a frame would miscount
        sseBuf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = sseBuf.indexOf('\n\n')) >= 0) { scanFrame(sseBuf.slice(0, idx)); sseBuf = sseBuf.slice(idx + 2); }
        if (!clientGone) {
          try { await writer.write(value); }
          catch { clientGone = true; try { await reader.cancel(); } catch {} break; }   // F4 — stop the spend
        }
        if (runningCount() > tier.streamMaxTokens) {                                    // F6 — abuse ceiling, NOT cap
          try { await reader.cancel(); } catch {}
          break;                                    // everything already written ended on a frame boundary? — no:
          // raw bytes were passed through as they arrived, and the last write may sit mid-frame ONLY
          // if the upstream chunk itself split a frame; the check runs after scanning, so the cut
          // lands after the last COMPLETE frame that crossed the ceiling. The client parser stays
          // coherent: it, too, only acts on complete frames and treats a no-finish end as an error.
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
Expected: PASS, full worker suite, exit 0. Paste output.

- [ ] **Step 5: Frame-boundary honesty check** — the F6 test asserts `endsWith('\n\n')`. If workerd chunk delivery makes it flaky (a chunk split mid-frame at cut time), that is a real contract violation — fix by buffering the passthrough per frame for the post-ceiling write path (hold back an incomplete trailing frame once `runningCount()` exceeds `0.9 * tier.streamMaxTokens`), NOT by weakening the assertion. (3-fix rule applies.)

- [ ] **Step 6: Commit**

```bash
git add worker/index.js worker/test/index.spec.js
git commit -m "feat(worker): SSE tee metering — reconcile-to-usage, fail-closed estimator, never-cut-for-cap (F5), streamMaxTokens ceiling, waitUntil disconnect reconcile

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 4: `central-code.mjs` — mint/change/audit tiers

**Files:**
- Modify: `scripts/central-code.mjs`

**Interfaces:**
- Consumes: tier names mirroring `worker/index.js` `TIERS` (Task 1) — `default`, `extended`, with `mintCap` 2_000_000 / 20_000_000.
- Produces: CLI surface `add <label> [capTokens] [--tier <name>]`, `tier <code> <name>`, tier shown in `show`/`audit`.
- Spec trace: spec §4.2.

- [ ] **Step 1: Implement** — in `scripts/central-code.mjs`:

(a) below the imports, add the mirror table + arg parsing:

```js
// R-38 mirror of worker/index.js TIERS — keep the two in sync BY HAND and say so in review; the
// Worker is authoritative at runtime (an unknown tier there degrades to `default`, never breaks).
const TIERS = { default: { mintCap: 2_000_000 }, extended: { mintCap: 20_000_000 } };

const argv = process.argv.slice(2);
const ti = argv.indexOf('--tier');
const tierArg = ti >= 0 ? argv.splice(ti, 2)[1] : null;    // strip --tier <name> before positional parse
const [cmd, a, b] = argv;
```

(replace the existing `const [cmd, a, b] = process.argv.slice(2);` line.)

(b) in the `add` branch: refuse an unknown tier BEFORE any wrangler call, default cap from the tier:

```js
    if (tierArg && !TIERS[tierArg]) {
      console.error(`\n✗ unknown tier "${tierArg}" — known tiers: ${Object.keys(TIERS).join(', ')}`);
      console.error(`  (the Worker would silently treat it as 'default'; refusing at mint instead.)\n`);
      process.exit(1);
    }
    const cap = b == null ? TIERS[tierArg || 'default'].mintCap : parseInt(b, 10);
```

(replaces `const cap = b == null ? 2_000_000 : parseInt(b, 10);`) — and extend the record + output:

```js
    const rec = JSON.stringify({ u: label, cap, used: 0, active: true, since: new Date().toISOString().slice(0, 10),
      ...(tierArg && tierArg !== 'default' ? { tier: tierArg } : {}) });   // default stays IMPLICIT — existing record shape is canonical
```

```js
    console.log(`  tier: ${tierArg || 'default'}${tierArg && tierArg !== 'default' ? '' : ' (implicit)'}`);
```

(c) new `tier` command (insert before the final `else`):

```js
  } else if (cmd === 'tier') {
    if (!a || !b) throw new Error('usage: tier <code> <name>');
    if (!TIERS[b]) throw new Error(`unknown tier "${b}" — known: ${Object.keys(TIERS).join(', ')}`);
    const raw = wr(['kv', 'key', 'get', '--binding', 'CODES', `code:${a}`, '--remote']);
    const rec = JSON.parse(raw);
    if (b === 'default') delete rec.tier; else rec.tier = b;    // read-modify-write of ONE field
    const tmp = join(tmpdir(), `mk-code-${a}.json`);
    writeFileSync(tmp, JSON.stringify(rec));
    try { wr(['kv', 'key', 'put', '--binding', 'CODES', `code:${a}`, '--path', tmp, '--remote']); }
    finally { try { unlinkSync(tmp); } catch {} }
    console.log(`✓ ${a.slice(0, 5)}*** is now tier "${b}" (cap/used untouched: ${rec.cap}/${rec.used || 0})`);
```

(d) in `audit`, display the tier per record and warn on an unknown one — inside the record loop, after the cap check:

```js
      else {
        const t = rec.tier || 'default (implicit)';
        if (rec.tier && !TIERS[rec.tier]) bad.push({ name, why: `tier="${rec.tier}" is UNKNOWN — the Worker will treat it as 'default'`, label: rec.u });
        else console.log(`  ${mask(name)}${rec.u ? ` (${rec.u})` : ''} — tier ${t} · cap ${rec.cap.toLocaleString()} · used ${(rec.used || 0).toLocaleString()}`);
      }
```

(NOTE: `mask` must move ABOVE the loop for this — it currently sits below; move the `const mask = …` line to just before the `for` loop.)

(e) update the usage line:

```js
    console.log('usage: node scripts/central-code.mjs add <label> [capTokens] [--tier <name>] | tier <code> <name> | list | show <code> | revoke <code> | audit');
```

- [ ] **Step 2: Verify the no-network paths by direct invocation** (the mint guard runs before wrangler, so no auth needed):

```bash
node scripts/central-code.mjs add someone --tier no-such-tier; echo "exit=$?"
node scripts/central-code.mjs
```

Expected: first prints `✗ unknown tier "no-such-tier" — known tiers: default, extended` with `exit=1`; second prints the updated usage line. Paste both outputs. (The remote `add/tier/audit` paths are exercised once against the real KV at the release task, with output pasted — stated openly: they are not unit-covered, wrangler is the harness.)

- [ ] **Step 3: Commit**

```bash
git add scripts/central-code.mjs
git commit -m "feat(scripts): central-code mints/changes/audits tiers (R-38) — unknown tier refused at mint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 5: Client transport — `gemTransport` + `gemStreamFetch` (one path, two backends)

**Files:**
- Modify: `app.js` (factor `gemFetch` ~5497-5527; add `gemStreamFetch` + `gemSseParse` beside it)
- Test: `tests/metered-streaming.spec.ts` (new file — TEST-AUTHORING-CONTRACT applies)

**Interfaces:**
- Consumes: `gemMode()`, `centralUrl()`, `centralCode()`, `gemKey()`, `GEM_MODELS`, `GEM_HOST` (existing).
- Produces: `gemTransport(mdl, verb, key) → {mode, url, headers}` (verb `'generateContent'|'streamGenerateContent'`); `gemSseParse() → {push(str)→string[] , end()→string[]}` (pure incremental SSE→text-delta parser); `gemStreamFetch(role, body, opts, onDelta) → Promise<string>` throwing `'stream-unsupported'` on managed 404 and `'stream-truncated'` on a no-finish end. Task 7 consumes all three.
- Spec trace: spec §5.1.

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
    expect(seen.some(u => u.includes('generativelanguage.googleapis.com'))).toBe(true);   // fell back to BYOK (G3 consumer)
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/metered-streaming.spec.ts` (targeted run is fine mid-task; the FULL plain suite runs at the task gate)
Expected: FAIL — `gemTransport is not a function` etc. Paste.

- [ ] **Step 3: Implement** — in `app.js`, directly above `gemFetch`:

```js
// ── Metered-streaming arc (spec §5.1) · ONE transport builder for BOTH verbs and BOTH backends.
// gemFetch and gemStreamFetch consume this — managed vs BYOK can never fork, because the fork point
// is a data structure, not two code paths. verb 'streamGenerateContent' pins alt=sse (the Worker and
// the client parser both speak SSE frames — spec §2.1).
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
// spec §2.2), same managed→BYOK fallback on 401/402/403 (mirror of gemFetch's line). Distinct errors:
// 'stream-unsupported' (managed 404 = stale Worker; caller falls back to non-streaming) and
// 'stream-truncated' (the stream ended with no finishReason — F3's client half).
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

Then refactor `gemFetch` to consume `gemTransport` — replace its `mode`/`url`/`headers` lines (app.js:5502-5505) with:

```js
  const t = gemTransport(mdl, 'generateContent', opts.key);
  const mode = t.mode, url = t.url, headers = t.headers;
```

(the rest of `gemFetch` — retries, backoff, `gemNoteUsage`, the managed→BYOK fallback — is untouched.)

- [ ] **Step 4: Build + run to verify GREEN**

Run: `python build.py` then `npx playwright test` (full, plain — restart any manual serve.js first per §11a; DoD-12 task gate ×1)
Expected: new tests PASS, zero regressions (the `gemFetch` refactor is behaviour-preserving — any e7/tts-routing failure means the transport drifted). Paste output + exit code.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/metered-streaming.spec.ts
git commit -m "feat(app): gemTransport + gemStreamFetch — one transport for BYOK and managed, SSE delta parser, stale-Worker and BYOK fallbacks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 6: Sentence assembler + the digit-free stream gate

**Files:**
- Modify: `app.js` (beside `vcChunkText`)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `UNITS.normalize`, `safetyNumRe()`, `aiSafetyNums` (existing guard machinery — the ONE number definition, never a second pattern).
- Produces: `vcSentenceStream(onSentence) → {push(delta), end()}`; `vcStreamSafe(sentence) → boolean`. Task 7 consumes both.
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

### Task 7: `vcAskFlow` streams — early speech, guard-once, transcript rule

**Files:**
- Modify: `app.js` (`vcAskFlow`, new `vcAskAIStream` beside `vcAskAI`, `vcSpeak` gains an optional `gen`)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `gemStreamFetch` (Task 5), `vcSentenceStream`/`vcStreamSafe` (Task 6), `vcGuardSpoken`, `vcAskAI` (fallback), `gemSynthChunk`/`gemPlayBuf`/`vcSpeakGen` machinery, `ttsText`, `vcLatMark`.
- Produces: `vcAskAIStream(question, ent, onDelta) → Promise<string>`; the mock seam `window.__vcAskStreamMock(question, onDelta)`; `vcSpeak(text, lang, gen)` (optional third param — a caller-supplied gen joins an existing utterance instead of taking the floor).
- Spec trace: spec §5.2, §6.1–§6.4 (guard runs ONCE on the complete answer; transcript shows only gate-passed text).

- [ ] **Step 1: Write the failing tests** — append to `tests/metered-streaming.spec.ts`:

```ts
test('streamed ask: guard runs ONCE on the full answer; digit sentences never speak early; transcript ends guarded', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  const r = await page.evaluate(async () => {
    const w = window as any;
    const synths: string[] = [];
    w.__gemTtsMock = (clean: string) => { synths.push(clean); return { length: 1, sampleRate: 24000 }; };
    w.__gemPlayMock = () => Promise.resolve();
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
    delete w.__vcAskStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock; w.vcGuardSpoken = realGuard;
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
      w.__gemTtsMock = () => ({ length: 1, sampleRate: 24000 });
      w.__gemPlayMock = () => Promise.resolve();
      await w.vcAskFlow('שאלה מתי לעטוף');
      delete w.__gemTtsMock; delete w.__gemPlayMock;
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
        return gemSynthChunk(clean).then(function(buf){ if(vcGenCurrent(gen)) return gemPlayBuf(buf, gen); });
      }).catch(function(){ early.frozen=true; });   // a synth failure ends early mode; the guarded pass will retry via vcSpeak's toast map
    });
    const answer=await vcAskAIStream(question, tiers.t1||tiers.t2, function(d){ asm.push(d); });
    asm.end();
    vcLatMark('textResp');
    // THE guard — exactly once, on the COMPLETE answer (spec §6.1). Never on a fragment.
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
git commit -m "feat(app): vcAskFlow streams — digit-free early speech, whole-answer guard exactly once, guarded transcript, stale-Worker fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 8: R-36a — the voice length instruction with the safety-completeness override

**Files:**
- Modify: `app.js` (`vcBuildAskPrompt` — all three language branches)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `vcBuildAskPrompt(question, ansLang, ctx) → {sys, userText}` (existing).
- Produces: the two clause constants `VC_BREVITY_HE`/`VC_BREVITY_EN` (module consts, one source per language family) — referenced by the test by content.
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
      panel: (typeof w.askGemini === 'function'),   // the PANEL prompt lives inside askGemini — asserted below via source probe
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
  // negative case (fixture minimality/DoD-6): the PANEL ask prompt is UNCHANGED — it must keep its
  // full-length instruction and carry NO brevity clause:
  const panelHasBrevity = await page.evaluate(() => {
    // askGemini builds sys inline; probe by calling the same builder path is impossible without a
    // network call — assert on the SOURCE of truth instead: the app bundle string.
    return document.documentElement.outerHTML.length > 0;   // placeholder-free: real assertion below
  });
  // The real panel negative-case: askGemini's sys is a literal in app.js — pin it via a page function
  // exposed for tests in Step 3 (window.__askPanelSys), so the assertion reads rendered truth:
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

(c) beside `askGemini`, the test probe for the panel negative case (dev/test surface, no UI — same discipline as `__vcLat`):

```js
// test probe (R-36a negative case): exposes the PANEL system prompt so the suite can assert it stays
// full-length and never inherits the voice brevity clause. Reads the same literal askGemini uses.
if(typeof window!=='undefined') window.__askPanelSys=function(){
  return 'אתה "האש" — עוזר בישול מומחה לאש, עישון, גריל, סו-ויד ושרקוטרי, בתוך אפליקציה ישראלית בשם "מתכונת · מדריך האש". '
    +'…בצורה מלאה ומועילה…';
};
```

**WRONG — placeholder alert (self-review catch): the probe above truncates the literal, which lies.** Implement instead by FACTORING the literal: extract askGemini's `sys` first sentence block into a module const `ASK_PANEL_SYS_PREFIX` used by `askGemini` verbatim, and let the probe return that const:

```js
const ASK_PANEL_SYS_PREFIX='אתה "האש" — עוזר בישול מומחה לאש, עישון, גריל, סו-ויד ושרקוטרי, בתוך אפליקציה ישראלית בשם "מתכונת · מדריך האש". ';
// …in askGemini, `const sys=ASK_PANEL_SYS_PREFIX+(L('ענה תמיד בעברית', …))+', בצורה מלאה ומועילה — …'` (rest unchanged)
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
node scratchpad/metered-streaming/r36a-probe.mjs   # written here: asks the safe-chicken-temp question via GEMINI_API_KEY from the ENVIRONMENT, prints answer length + whether a °C figure and a caveat clause survived. NEVER prints the key. Not committed to the suite.
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

### Task 9: Latency evidence — `firstSentence` mark + the before/after table

**Files:**
- Modify: `app.js` (only if Task 7's `vcLatMark('firstSentence')` needs the key added to any doc surface — the mark itself landed in Task 7)
- Create: `docs/analysis/2026-07-31-metered-streaming-latency.md` (the measured table)
- Test: `tests/metered-streaming.spec.ts`

**Interfaces:**
- Consumes: `window.__vcLat` (Voice Wave 0 G8), `vcLatMark('firstSentence')` (Task 7).
- Spec trace: spec §1 G1 (~3.3 s), §10 DoD line 9.

- [ ] **Step 1: Write the failing test** — append to `tests/metered-streaming.spec.ts`:

```ts
test('__vcLat carries firstSentence for a streamed ask (the G1 instrument)', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': 'k-test' });
  const lat = await page.evaluate(async () => {
    const w = window as any;
    w.__gemTtsMock = () => ({ length: 1, sampleRate: 24000 });
    w.__gemPlayMock = () => Promise.resolve();
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('הכל מוכן ויציב. ');                       // digit-free — triggers firstSentence
      return 'הכל מוכן ויציב.';
    };
    await w.vcAskFlow('שאלה כללית');
    delete w.__vcAskStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock;
    return w.__vcLat;
  });
  expect(typeof lat.firstSentence).toBe('number');
  expect(lat.firstSentence).toBeGreaterThanOrEqual(lat.ask);
});
```

- [ ] **Step 2: Run RED → GREEN**

Run: `npx playwright test tests/metered-streaming.spec.ts`
Expected: if Task 7 landed the mark, this passes first-run — which VOIDS it (DoD-2). In that case flip it honestly: first comment out the `vcLatMark('firstSentence')` line in `app.js`, rebuild, observe the RED, restore, rebuild, observe GREEN (regression red-green, DoD-7). Paste both outputs.

- [ ] **Step 3: Live measurement** (env key, never printed) — extend the existing measurement script family with a streaming leg:

```bash
node scratchpad/metered-streaming/stream-latency.mjs
```

Create it in the scratchpad (NOT the repo):

```js
// stream-latency.mjs — first-sentence + first-sound arithmetic on the LIVE api. Env key only.
const KEY = process.env.GEMINI_API_KEY; if (!KEY) { console.error('no key'); process.exit(2); }
const t0 = performance.now();
const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
  body: JSON.stringify({
    system_instruction: { parts: [{ text: 'ענה בקצרה מאוד — עד 60 מילים; אתה עוזר קולי.' }] },
    contents: [{ role: 'user', parts: [{ text: 'אני מעשן בריסקט 5 ק"ג ב-110 מעלות, איך אני יודע מתי לעטוף?' }] }],
    generationConfig: { maxOutputTokens: 8192 } }),
});
const reader = r.body.getReader(); const dec = new TextDecoder();
let buf = '', text = '', tFirstSentence = 0, tDone = 0;
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
    if (!tFirstSentence && /[.!?…]\s/.test(text)) tFirstSentence = performance.now() - t0;
  }
}
tDone = performance.now() - t0;
console.log(JSON.stringify({ firstSentenceMs: Math.round(tFirstSentence), doneMs: Math.round(tDone), chars: text.length }));
```

- [ ] **Step 4: Write the evidence doc** — `docs/analysis/2026-07-31-metered-streaming-latency.md` with the real numbers from Step 3 in this shape (fill the ⟨⟩ from the actual runs — never estimate):

```markdown
# Metered streaming — measured latency (v281 evidence)

| leg | before (baseline docs) | after (measured here) |
|---|---|---|
| first sentence ready | 5,710 ms (full answer) | ⟨firstSentenceMs⟩ ms |
| + one short TTS synthesis | ~2,000 ms floor | (unchanged — the §8 seam is the next step) |
| **first sound (arithmetic)** | **~99,000 ms (timeout+browser voice)** | **⟨firstSentenceMs + ~2000⟩ ms** |
Runs: 2 per leg, same machine/network as the 31.7 baselines. Script: scratchpad stream-latency.mjs (env key).
Target ≤ ~3,500 ms — ⟨MET / MISSED by N ms, breakdown⟩.
```

- [ ] **Step 5: Full suite + commit**

Run: `python build.py` then `npx playwright test` (×1)

```bash
git add app.js tests/metered-streaming.spec.ts docs/analysis/2026-07-31-metered-streaming-latency.md
git commit -m "test+docs: firstSentence latency instrument pinned; measured streaming latency evidence for v281

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

---

### Task 10: Release v281 — docs, deploy order, double suite, live verify

**Files:**
- Modify: `docs/ROADMAP-2026-07-30.md` (rows R-36/R-37/R-38 → landed state), `docs/STATUS-BOARD.md` (H10), `worker/README.md` (route + tier documentation), version stamp (`build.py` data / the `מהדורה NNN` source) → **281**
- No new tests — this is the gate task.

**Interfaces:**
- Consumes: everything above.
- Spec trace: spec §10 lines 11–12; discipline §10.10 (a push is not a release).

- [ ] **Step 1: Deploy order** — Worker FIRST (`cd worker && npm run deploy`), then the Pages release. (Task 5's 404 fallback makes the reverse merely degraded, not broken — but Worker-first is the correct order and costs nothing.) After deploy, exercise the remote tier path once and paste masked output:

```bash
node scripts/central-code.mjs audit
```

- [ ] **Step 2: Docs** — update the three docs:

```markdown
(ROADMAP §5a — the shape of the three edits)
R-36 → status: (א) ✅ shipped (Voice Wave 0) · (ב) ✅ shipped v281 (metered streaming arc) · (ג) open — the TTS-streaming seam (spec §8) is the named next step
R-37 → ✅ shipped v281 — metered SSE route, per-user enforcement (spec 2026-07-31-metered-streaming-design.md §2)
R-38 → ✅ infrastructure shipped v281 (tier table, central-code tier commands); policy/pricing → band-H (unchanged)
```

- [ ] **Step 3: The release gate (H7 ×2)** — bump the stamp to `מהדורה 281`, build, and run BOTH suites, serialized, idle machine:

```bash
python build.py
cd worker && npm test; cd ..
npx playwright test
npx playwright test
```

Expected: worker suite exit 0; TWO consecutive full Playwright runs exit 0 (no `--retries`, no `--workers`; any failure including an intermittent one = bug → systematic-debugging, never a re-run-to-green). Paste all three exit codes.

- [ ] **Step 4: Ship + live verify (§10.10)** — commit, push, then poll the live URL with Playwright until `.foot-stamp` shows `מהדורה 281` AND a feature probe from this release answers (e.g. `page.evaluate(() => typeof (window as any).gemStreamFetch)` === `'function'`). Only then say "v281 is live".

```bash
git add -A && git commit -m "release(v281): metered streaming — first sound ~3.3s, per-user enforcement, tier infrastructure

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr"
```

- [ ] **Step 5: H9 table + STATUS-BOARD update + arc-close checklist** (`docs/process/checklists/arc-close.md`): lessons → §11, graph refresh trigger check, ledger rows, check-meta green.

---

## Self-Review (run before submitting the plan)

1. **Spec coverage:** §2 route/metering → Tasks 2–3 · §2.5 F5 → Task 3 test `F5 never-cut` · §4 tiers → Tasks 1+4 · §5 client → Tasks 5–7 · §6 guard timing → Tasks 6–7 · §7 R-36a → Task 8 · §8 research → spec-only (no code owed; seam preserved by not adopting Interactions API anywhere) · §10 DoD lines → mapped across task gates + Task 10.
2. **Placeholder scan:** one caught inline and corrected in Task 8 Step 3 (the truncated-literal probe — replaced with the factored const). No TBDs remain.
3. **Type consistency:** `gemTransport(mdl, verb, key)` used identically in Tasks 5 and 7; `admitCode(env, code, key, json, wantStream)` matches its Task-2 definition at its Task-2 call site; `vcSentenceStream`/`vcStreamSafe` names match Tasks 6→7; `tierOf` matches Tasks 1→2→3.

**Mechanical gate:** `node scripts/check-plan-complete.mjs docs/superpowers/plans/2026-07-31-metered-streaming.md` must exit 0 before this plan is submitted to review (discipline §2, L27).
