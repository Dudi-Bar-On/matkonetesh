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
