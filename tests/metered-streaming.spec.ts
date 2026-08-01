import { test, expect, seedApp } from './_fixtures';

test('gemTransport builds the managed streaming URL+header without forking from BYOK', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') });
  const t = await page.evaluate(() => (window as any).gemTransport('gemini-x', 'streamGenerateContent'));
  expect(t.mode).toBe('managed');
  expect(t.url).toBe('https://w.example/v1beta/models/gemini-x:streamGenerateContent?alt=sse');
  expect(t.headers['X-Access-Code']).toBe('abc123');
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });        // BYOK world
  const b = await page.evaluate(() => (window as any).gemTransport('gemini-x', 'streamGenerateContent'));
  expect(b.mode).toBe('byok');
  expect(b.url).toContain('generativelanguage.googleapis.com');
  expect(b.url).toContain(':streamGenerateContent?alt=sse');
  expect(b.headers['x-goog-api-key']).toBe('k-test');
});

test('gemSpeakSeg plays streamed PCM incrementally: firstAudio marks BEFORE the stream completes', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });
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
  await seedApp(page, { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') });
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

test('gemSseParse yields text deltas over the REAL Google wire format (\\r\\n\\r\\n frames), including a tear landing inside the separator itself', async ({ page }) => {
  // Proven against the live API (2026-08-01): CRLFCRLF=1, LFLF=0 — Google separates SSE frames with
  // \r\n\r\n, never \n\n. A fixture using only \n\n proves nothing about production (the bug this test
  // guards against). The nastiest real case: the tear lands INSIDE the four-byte separator itself.
  await seedApp(page, {});
  const out = await page.evaluate(() => {
    const p = (window as any).gemSseParse();
    const f = (t: string) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }) + '\r\n\r\n';
    const a = p.push(f('שלום, '));
    const whole = f('עולם. 63.5');
    // tear the separator itself: whole ends '...}\r\n\r\n' — split so the first push carries the JSON
    // plus only the FIRST \r\n of the separator, and the second push starts with the trailing \r\n.
    const sepStart = whole.length - 4;                // index of the \r\n\r\n
    const b = p.push(whole.slice(0, sepStart + 2));    // '...}\r\n'  (half the separator)
    const c = p.push(whole.slice(sepStart + 2));       // '\r\n'      (the other half)
    return { a, b, c };
  });
  expect(out.a).toEqual(['שלום, ']);
  expect(out.b).toEqual([]);                       // separator torn in half — not yet a complete frame
  expect(out.c).toEqual(['עולם. 63.5']);            // completed once the separator's second half arrives
});

test('gemSseParse still handles \\n\\n-delimited frames (fixture-only servers, and the pre-existing coverage)', async ({ page }) => {
  await seedApp(page, {});
  const out = await page.evaluate(() => {
    const p = (window as any).gemSseParse();
    const f = (t: string) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }) + '\n\n';
    return p.push(f('שלום עולם'));
  });
  expect(out).toEqual(['שלום עולם']);
});

test('gemSpeakSeg schedules streamed PCM over the REAL Google wire format (\\r\\n\\r\\n frames) — a \\n\\n-only fixture would mask this', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });
  const pcm = Buffer.alloc(4800, 7).toString('base64');
  const frame = (d: string) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: d } }] } }] }) + '\r\n\r\n';
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 200, contentType: 'text/event-stream', body: frame(pcm) + frame(pcm) }));
  try {
    const out = await page.evaluate(async () => {
      const w = window as any;
      // if the CRLF frame is never parsed, gemPlayPcmStream throws 'no-audio' and gemSpeakSegAttempt
      // silently falls back to the blocking synth path — mock that fallback so the failure surfaces
      // as a clean assertion (usedFallback) instead of an uncaught network error from a fake key.
      let usedFallback = 0;
      w.__gemTtsMock = () => { usedFallback++; return { length: 1, sampleRate: 24000 }; };
      w.__gemPlayMock = () => Promise.resolve();
      const gen = w.vcNewSpeakGen();
      await w.gemSpeakSeg('שלום, המעשנה יציבה.', 'he', gen);
      delete w.__gemTtsMock; delete w.__gemPlayMock;
      return { firstAudio: w.__vcLat && w.__vcLat.firstAudio, chunks: w.__gemAudioChunks, usedFallback };
    });
    expect(out.usedFallback).toBe(0);        // streaming must succeed on its own — no silent fallback
    expect(typeof out.firstAudio).toBe('number');
    expect(out.chunks).toBe(2);
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});

test('managed streaming 404 (stale Worker) throws stream-unsupported; managed 402 with a BYOK key retries BYOK', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') });
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }));
  try {
    const err = await page.evaluate(async () => {
      try { await (window as any).gemStreamFetch('text', { contents: [] }, {}, () => {}); return ''; }
      catch (e: any) { return String(e.message || e); }
    });
    expect(err).toBe('stream-unsupported');
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }

  await seedApp(page, { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123'), 'mk-gemkey': JSON.stringify('k-test') });
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

// ── Task 4 (re-planned 2026-08-01). The quota covenant (hotfix 0bee32f) is the first assertion in this
// file for a reason: the answer's TTS request count must not grow. `preGuardTts` is snapshotted INSIDE
// the guard spy, so it counts exactly the requests issued before the whole-answer guard ran — the
// number the per-minute rate limit actually sees, independent of how many sentences the fixture has.
test('streamed ask: exactly ONE TTS request before the guard, and the guard runs ONCE on the full answer', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });
  const r = await page.evaluate(async () => {
    const w = window as any;
    const streamed: string[] = [], blocking: string[] = [];
    w.__gemTtsStreamMock = (clean: string) => { streamed.push(clean); return Promise.resolve(undefined); };
    w.__gemTtsMock = (clean: string) => { blocking.push(clean); return { mock: true }; };
    w.__gemPlayMock = async () => {};
    let guardCalls = 0, preGuardTts = -1;
    const realGuard = w.vcGuardSpoken;
    w.vcGuardSpoken = function (t: string, tiers: any, lang: string) {
      guardCalls++; preGuardTts = streamed.length + blocking.length; return realGuard(t, tiers, lang);
    };
    const shownDuringStream: string[] = [];
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('קודם כל, תן לזה להתייצב. ');            // digit-free — the opener, spoken early
      shownDuringStream.push(String(vcLastQA && vcLastQA.a));
      onDelta('משוך אותו ב-96 מעלות פנימי. ');          // digit-bearing — must never be spoken early
      onDelta('אחר כך תן לו לנוח קצת. ');
      onDelta('בהצלחה.');
      return 'קודם כל, תן לזה להתייצב. משוך אותו ב-96 מעלות פנימי. אחר כך תן לו לנוח קצת. בהצלחה.';
    };
    await w.vcAskFlow('שאלה מתי למשוך את הבריסקט');
    const a = String(vcLastQA && vcLastQA.a);
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock;
    w.vcGuardSpoken = realGuard;
    return { streamed, blocking, guardCalls, preGuardTts, a, shownDuringStream, lat: w.__vcLat };
  });
  expect(r.guardCalls).toBe(1);                                  // ONCE, on the complete answer (spec §6.1)
  expect(r.preGuardTts).toBe(1);                                 // THE quota covenant: one opening request, never one per sentence
  expect(r.streamed[0]).toContain('קודם כל');                     // the digit-free opener spoke early
  expect(r.streamed[0]).not.toContain('משוך');                    // and ONLY it — the gate froze on sentence 2
  expect(r.shownDuringStream[0]).toBe('קודם כל, תן לזה להתייצב. …'); // transcript: gate-passed text only (spec §6.4)
  // the digit sentence reached synthesis ONLY via the post-guard remainder, and the guard REDACTED it
  // (96 is ungrounded in this fixture) — no synthesis call ever carried the raw model digits:
  expect(r.streamed.concat(r.blocking).some(s => s.includes('96'))).toBe(false);
  expect(r.a).toContain('אינו מאומת');                            // final transcript IS the guarded string
  expect(r.a.startsWith('קודם כל, תן לזה להתייצב.')).toBe(true);
  expect(typeof r.lat.firstSentence).toBe('number');
  expect(r.lat.firstSentence).toBeLessThanOrEqual(r.lat.textResp);  // the opener left before the answer closed
});

// The gate's negative case (DoD-6): when the FIRST sentence carries a number, nothing is spoken early at
// all and the flow degrades to exactly today's behaviour — full answer, guard, then vcSpeak.
test('streamed ask: a digit-bearing first sentence speaks NOTHING early (spec §6.2 freeze)', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });
  const r = await page.evaluate(async () => {
    const w = window as any;
    const streamed: string[] = [], blocking: string[] = [];
    w.__gemTtsStreamMock = (c: string) => { streamed.push(c); return Promise.resolve(undefined); };
    w.__gemTtsMock = (c: string) => { blocking.push(c); return { mock: true }; };
    w.__gemPlayMock = async () => {};
    let preGuardTts = -1;
    const realGuard = w.vcGuardSpoken;
    w.vcGuardSpoken = function (t: string, tiers: any, lang: string) {
      preGuardTts = streamed.length + blocking.length; return realGuard(t, tiers, lang);
    };
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('משוך אותו ב-96 מעלות פנימי. ');
      onDelta('אחר כך תן לו לנוח.');
      return 'משוך אותו ב-96 מעלות פנימי. אחר כך תן לו לנוח.';
    };
    await w.vcAskFlow('שאלה מתי למשוך');
    const a = String(vcLastQA && vcLastQA.a);
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock;
    w.vcGuardSpoken = realGuard;
    return { preGuardTts, a, firstSentence: w.__vcLat.firstSentence };
  });
  expect(r.preGuardTts).toBe(0);                 // nothing synthesized before the guard
  expect(r.firstSentence).toBe(undefined);       // and no early-sentence mark was taken
  expect(r.a).toContain('אינו מאומת');            // the guarded answer still lands on screen
});

// The seam (R-47(b) — the owner's gap regression): the remainder must be scheduled at the audio-clock
// time the opener ENDS, not at "now". Observable: the startAt the remainder's first segment receives.
test('the post-guard remainder is scheduled at the opener\'s cursor, not at "now"', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });
  const starts = await page.evaluate(async () => {
    const w = window as any;
    const seen: any[] = [];
    // the mock returns a cursor exactly as the real gemSpeakSeg does: previous end + this segment's length
    w.__gemTtsStreamMock = (_t: string, _l: string, _g: number, startAt: number) => {
      seen.push(startAt); return Promise.resolve((startAt || 0) + 4);
    };
    w.__gemTtsMock = () => ({ mock: true });
    w.__gemPlayMock = async (_b: any, _g: number, startAt: number) => { seen.push('buf:' + startAt); };
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('קודם כל, תן לזה להתייצב. ');
      onDelta('אחר כך עטוף אותו היטב ותן לו לנוח על השיש עד שהקרום מתייצב לגמרי.');
      return 'קודם כל, תן לזה להתייצב. אחר כך עטוף אותו היטב ותן לו לנוח על השיש עד שהקרום מתייצב לגמרי.';
    };
    await w.vcAskFlow('שאלה מה עכשיו');
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock;
    return seen;
  });
  expect(starts[0]).toBe(undefined);   // the opener starts the utterance — no cursor yet
  expect(starts[1]).toBe(4);           // the remainder's first segment resumes exactly where the opener ended
});

// gemPlayPcmStream must (a) honour a startAt and (b) resolve once the last PCM frame is SCHEDULED —
// not after it has finished playing. Waiting for playback would delay the remainder's synthesis by the
// opener's whole duration and reopen the very gap R-47(b) closed.
test('gemSpeakSeg honours startAt and resolves when the last frame is scheduled, not when it finishes', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('k-test') });
  const pcm = Buffer.alloc(4800, 7).toString('base64');   // 100ms of 24kHz 16-bit mono
  const frame = (d: string) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: d } }] } }] }) + '\n\n';
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 200, contentType: 'text/event-stream', body: frame(pcm) + frame(pcm) }));
  try {
    const out = await page.evaluate(async () => {
      const w = window as any;
      const ctx = w.gemAudioCtx();
      const startAt = ctx.currentTime + 5;                       // pretend a previous segment ends 5s out
      const cursor = await w.gemSpeakSeg('שלום.', 'he', w.vcNewSpeakGen(), startAt);
      return { cursor, startAt, atResolve: ctx.currentTime };
    });
    // IEEE-754 non-associativity note: (startAt + 0.1) + 0.1 can land one ULP below the direct sum
    // startAt + 0.2 (verified: deterministic, not flaky — e.g. (5+0.1)+0.1 === 5.199999999999999 in V8).
    // The 1e-9 tolerance is far below one 24kHz sample period (~42µs) — it cannot mask a real scheduling bug.
    expect(out.cursor).toBeGreaterThanOrEqual(out.startAt + 0.2 - 1e-9);   // both 100ms frames queued AFTER startAt
    expect(out.cursor).toBeGreaterThan(out.atResolve);              // resolved while the audio is still in the future
  } finally { await page.unroute('**/models/*:streamGenerateContent*'); }
});

// D1's instrument must measure the OPENER's first sound. The remainder streams too, so without
// first-write-wins the second stream silently overwrites firstAudio and D1 measures the wrong moment.
test('vcLatMark: the "first…" marks are first-write-wins per answer, and a new ask resets them', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const w = window as any;
    w.vcLatMark('ask'); w.vcLatMark('firstAudio');
    const first = w.__vcLat.firstAudio;
    w.vcLatMark('firstAudio');                       // the remainder's stream — must NOT move the mark
    const afterSecond = w.__vcLat.firstAudio;
    w.vcLatMark('ask');                              // a NEW question starts a new measurement
    const afterNewAsk = w.__vcLat.firstAudio;
    return { same: first === afterSecond, afterNewAsk, report: w.vcLatReport() };
  });
  expect(r.same).toBe(true);
  expect(r.afterNewAsk).toBe(undefined);
  expect(r.report).toHaveProperty('ask');            // vcLatReport (the real consumer) still reads it
});

// Spec §5.1: a stale Worker (streaming route not deployed) must still answer, via non-streaming vcAskAI.
test('stale Worker: streaming 404 falls back to non-streaming vcAskAI — the ask still answers', async ({ page }) => {
  await seedApp(page, { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') });
  await page.route('**/models/*:streamGenerateContent*', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }));
  await page.route('**/models/*:generateContent*', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'עטוף כשהקרום יציב.' }] } }], usageMetadata: { totalTokenCount: 5 } }) }));
  try {
    const a = await page.evaluate(async () => {
      const w = window as any;
      w.__gemTtsStreamMock = () => Promise.resolve(undefined);
      w.__gemTtsMock = () => ({ mock: true });
      w.__gemPlayMock = async () => {};
      await w.vcAskFlow('שאלה מתי לעטוף');
      delete w.__gemTtsStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock;
      return String(vcLastQA && vcLastQA.a);
    });
    expect(a).toContain('עטוף כשהקרום יציב');
  } finally {
    await page.unroute('**/models/*:streamGenerateContent*');
    await page.unroute('**/models/*:generateContent*');
  }
});

test('DoD-8/9: the mid-stream transcript renders the gate-passed opener in Hebrew at 390x844', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('he'), 'mk-gemkey': JSON.stringify('k-test') });
  await page.setViewportSize({ width: 390, height: 844 });
  // openVoiceCook fires a fire-and-forget vcWarmAck() network pre-warm — block it (same pattern as the
  // R-32/DoD-8 tests in voice-wave0.spec.ts) so a fake test key never races a real fetch.
  await page.route(/generativelanguage|gemini/i, r => r.abort());
  try {
  // Mocks installed BEFORE openVoiceCook: the panel-open announcement (vcSpeakContent, app.js openVoiceCook)
  // calls the real vcSpeak/gemSpeak chain immediately — without the TTS mock seam in place first it would
  // hit the (aborted) network and toast an unrelated "read-aloud error", muddying the DoD-8 evidence.
  await page.evaluate(() => {
    const w = window as any;
    w.__gemTtsStreamMock = () => Promise.resolve(undefined);
    w.__gemTtsMock = () => ({ mock: true }); w.__gemPlayMock = async () => {};
  });
  await page.evaluate(`(function(){ closePanel(); vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; openVoiceCook(vcTasks); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(() => {
    const w = window as any;
    w.__vcAskStreamMock = async (_q: string, onDelta: (d: string) => void) => {
      onDelta('קודם כל, תן לבשר להתייצב על השיש. ');
      await new Promise(res => { w.__releaseAnswer = res; });        // held open until the test releases it
      onDelta('בהצלחה.');
      return 'קודם כל, תן לבשר להתייצב על השיש. בהצלחה.';
    };
    w.vcAskFlow('שאלה מה עושים עכשיו');                              // deliberately NOT awaited
  });
  await page.waitForFunction(`vcLastQA && /…$/.test(String(vcLastQA.a))`);   // condition wait, not a timeout
  await page.screenshot({ path: 'mockups/task4-stream-transcript-he-390x844.png' });
  const shown = await page.evaluate(`String(vcLastQA.a)`) as string;
  expect(shown).toBe('קודם כל, תן לבשר להתייצב על השיש. …');
  expect(shown).not.toMatch(/[A-Za-z]/);                                     // no English leak (DoD-9)
  await page.evaluate(() => (window as any).__releaseAnswer());
  await page.waitForFunction(`vcLastQA && !/…$/.test(String(vcLastQA.a))`);
  await page.evaluate(() => { const w = window as any;
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; delete w.__gemTtsMock; delete w.__gemPlayMock; });
  } finally { await page.unroute(/generativelanguage|gemini/i); }
});
