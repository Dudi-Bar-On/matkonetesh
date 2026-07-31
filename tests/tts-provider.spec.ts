import { test, expect, seedApp } from './_fixtures';

// R-45 · two-provider TTS layer. Design: docs/superpowers/specs/2026-08-01-tts-provider-layer-design.md
const MANAGED = { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') };
const BYOK = { 'mk-gemkey': JSON.stringify('personal-key-1234567890') };

test('R-45 §4.2: the routing table is data, and resolution filters it by availability', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  const managed = await page.evaluate(`({
    table: JSON.parse(JSON.stringify(TTS_ROUTE)),
    answer: ttsProviderFor('answer'),
    step:   ttsProviderFor('step'),
    alert:  ttsProviderFor('alert'),
    unknown: ttsProviderFor('a-use-case-nobody-added-a-row-for'),
    missing: ttsProviderFor(undefined),
    avail: ttsCloudAvail()
  })`);
  // the table itself matches the design's §4.2 rows exactly
  expect(managed.table).toEqual({ answer: 'gemini', step: 'gemini', alert: 'cloud' });
  expect(managed.avail).toBe(true);
  expect(managed.answer).toBe('gemini');
  expect(managed.step).toBe('gemini');
  expect(managed.alert).toBe('cloud');
  // an unlisted use case falls to the PRIMARY, never to silence
  expect(managed.unknown).toBe('gemini');
  expect(managed.missing).toBe('gemini');
});

test('R-45 §2/DoD-4: a BYOK user has no secondary — every use case resolves to Gemini', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...BYOK });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  const r = await page.evaluate(`({ avail: ttsCloudAvail(), alert: ttsProviderFor('alert'), answer: ttsProviderFor('answer') })`);
  expect(r.avail).toBe(false);                 // no legitimate way to authenticate — design §2
  expect(r.alert).toBe('gemini');              // the cloud row degrades, it does not go silent
  expect(r.answer).toBe('gemini');
});

test('R-45: the session latch takes the secondary out of routing without an error', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  expect(await page.evaluate(`ttsProviderFor('alert')`)).toBe('cloud');
  await page.evaluate(`ttsCloudOff = true`);
  expect(await page.evaluate(`ttsCloudAvail()`)).toBe(false);
  expect(await page.evaluate(`ttsProviderFor('alert')`)).toBe('gemini');
});

test('R-45: the voice mapping produces a real Chirp3-HD name for each supported app language', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudVoiceFor==='function'`);
  const r = await page.evaluate(`({
    he: cloudVoiceFor('he'), en: cloudVoiceFor('en'), ru: cloudVoiceFor('ru'), junk: cloudVoiceFor('zz')
  })`);
  expect(r.he).toEqual({ languageCode: 'he-IL', voice: 'he-IL-Chirp3-HD-Kore' });
  expect(r.en.languageCode).toBe('en-US');
  expect(r.en.voice).toContain('Chirp3-HD');
  expect(r.ru.languageCode).toBe('ru-RU');
  expect(r.junk.languageCode).toBe('he-IL');   // unknown language falls to the app's own default
});

// A 0.5 s LINEAR16 @24 kHz mono tone, as the Worker route returns it: raw PCM16LE bytes.
const PCM_HELPERS = `
  window.__pcmBytes = function(seconds){
    const n = Math.round(24000*seconds), b = new Uint8Array(n*2), dv = new DataView(b.buffer);
    for(let i=0;i<n;i++) dv.setInt16(i*2, Math.round(3000*Math.sin(i/12)), true);
    return b;
  };`;

test('R-45 DoD-1: cloudSpeakSeg honours the cursor contract — it returns the audio-clock END time', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const calls=[]; const realFetch=window.fetch;
    window.fetch=async function(u,o){ calls.push(String(u)); return new Response(window.__pcmBytes(0.5), {status:200, headers:{'Content-Type':'audio/l16'}}); };
    try{
      const gen=vcNewSpeakGen();
      const ctx=gemAudioCtx();
      const startAt=ctx.currentTime+2.0;                 // a FUTURE cursor, as a mid-answer chunk gets
      const cursor=await cloudSpeakSeg('שלום','he',gen,startAt);
      return { cursor, startAt, url: calls[0], calls: calls.length };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.calls).toBe(1);
  expect(r.url).toContain('/v1/tts:synthesize');
  expect(typeof r.cursor).toBe('number');
  // the returned cursor is an audio-clock time AT OR AFTER startAt, advanced by the clip's duration
  expect(r.cursor).toBeGreaterThan(r.startAt + 0.4);
  expect(r.cursor).toBeLessThan(r.startAt + 0.7);
});

test('R-45 DoD-1: two chained segments queue back-to-back — the second starts where the first ended', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    window.fetch=async function(){ return new Response(window.__pcmBytes(0.3), {status:200}); };
    try{
      const gen=vcNewSpeakGen();
      const c0=await cloudSpeakSeg('אחת','he',gen, gemAudioCtx().currentTime+1.5);
      const c1=await cloudSpeakSeg('שתיים','he',gen,c0);
      return { c0, c1 };
    } finally { window.fetch=realFetch; }
  })()`);
  // no gap and no overlap: the second clip's end is one clip-length past the first's end
  expect(r.c1 - r.c0).toBeGreaterThan(0.25);
  expect(r.c1 - r.c0).toBeLessThan(0.42);
});

test('R-45: a 501 from the Worker is the clean-skip signal, not an error the user sees', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSynthChunk==='function'`);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    window.fetch=async function(){ return new Response(JSON.stringify({error:'tts_secondary_unconfigured'}), {status:501, headers:{'Content-Type':'application/json'}}); };
    try{
      let msg='';
      try{ await cloudSynthChunk('שלום','he'); }catch(e){ msg=String(e.message); }
      return { msg, unavailable: ttsCloudUnavailableErr(new Error(msg)) };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.msg).toContain('cloud-unavailable');
  expect(r.unavailable).toBe(true);
});
