import { test, expect, seedApp } from './_fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

// Instrument every outbound TTS request so the DoD-8 count assertion is measured, not assumed.
const COUNTING_FETCH = `
  window.__ttsCalls = [];
  window.__realFetch = window.fetch;
  window.__installFetch = function(handler){
    window.fetch = async function(u,o){
      const url=String(u&&u.url?u.url:u);
      if(/:streamGenerateContent|:generateContent|\\/v1\\/tts:synthesize/.test(url)) window.__ttsCalls.push(url);
      return handler(url,o);
    };
  };
  window.__restoreFetch = function(){ window.fetch = window.__realFetch; };
  window.__gemini429 = function(){
    return new Response(JSON.stringify({error:{code:429,message:'You exceeded your current quota',
      details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo', retryDelay:'0s'}]}}),
      {status:429, headers:{'Content-Type':'application/json'}});
  };`;

test('R-45 DoD-2+3+8: a Gemini 429 falls over to Cloud ONCE — sound comes out and the request count does not grow', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    window.__installFetch(async function(url){
      if(url.indexOf('/v1/tts:synthesize')>=0) return new Response(window.__pcmBytes(0.4), {status:200});
      return window.__gemini429();                               // every Gemini TTS request 429s
    });
    try{
      const gen=vcNewSpeakGen();
      const startAt=gemAudioCtx().currentTime+1.0;
      const before=window.__gemAudioChunks;
      const cursor=await ttsSpeakSeg('שלום','he',gen,startAt,'answer');
      return { cursor, startAt, calls: window.__ttsCalls.slice(), audible: window.__gemAudioChunks-before };
    } finally { window.__restoreFetch(); }
  })()`);
  // DoD-2: the user gets SOUND, not silence
  expect(r.audible).toBe(1);
  expect(r.cursor).toBeGreaterThan(r.startAt + 0.3);
  // DoD-3: exactly ONE fallback hop — one Gemini attempt, one Cloud request. Not a loop.
  const gemini = r.calls.filter((u: string) => u.includes('GenerateContent'));
  const cloud = r.calls.filter((u: string) => u.includes('/v1/tts:synthesize'));
  expect(gemini.length).toBe(1);
  expect(cloud.length).toBe(1);
  // DoD-8: 2 requests total — v281's own worst case for this chunk was 4 (attempt ×2, retry ×2)
  expect(r.calls.length).toBe(2);
});

// Regression pin: a plain NETWORK failure on the stream attempt (connection refused / DNS / "Failed to
// fetch") is not one of §4.1's three fallback triggers (429/timeout/no-audio), so ttsFallbackWorthy(e) is
// false and the secondary must NOT be tried. Before this fix that path was thrown straight out of
// ttsSpeakSeg — SILENCE. v281's own universal safety net (any stream failure -> blocking gemSynthChunk +
// gemPlayBuf) is restored here: 2 Gemini requests (stream + blocking), 0 Cloud requests, audio comes out.
test('R-45 regression: a non-fallback-worthy stream failure (network) still produces audio via blocking Gemini, never Cloud', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    // a base64 PCM16 payload, in the SAME envelope shape gemReadAudio expects off generateContent
    const pcmB64 = (function(){
      const bytes = window.__pcmBytes(0.3);
      let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
      return btoa(s);
    })();
    window.__installFetch(async function(url){
      if(url.indexOf(':streamGenerateContent')>=0) throw new TypeError('Failed to fetch');   // plain network blip — NOT fallback-worthy
      if(url.indexOf(':generateContent')>=0){
        return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000', data: pcmB64}}]}}]}),
          {status:200, headers:{'Content-Type':'application/json'}});
      }
      throw new Error('the secondary must NOT be reached — this failure is not fallback-worthy: '+url);
    });
    try{
      const gen=vcNewSpeakGen();
      const startAt=gemAudioCtx().currentTime+1.0;
      const cursor=await ttsSpeakSeg('שלום','he',gen,startAt,'answer');
      return { cursor, startAt, calls: window.__ttsCalls.slice() };
    } finally { window.__restoreFetch(); }
  })()`);
  // sound, not silence — the cursor advanced by roughly the clip's duration past startAt
  expect(r.cursor).toBeGreaterThan(r.startAt + 0.2);
  expect(r.cursor).toBeLessThan(r.startAt + 0.5);
  // note: the blocking path's verb is the lowercase-'g' 'generateContent' while the stream attempt's is
  // camelCase 'streamGenerateContent' — a case-INSENSITIVE match is required to count both (the existing
  // DoD-2+3+8 test above only ever sees the stream call, so its capital-G filter never had to catch this).
  const gemini = r.calls.filter((u: string) => /generatecontent/i.test(u));
  const cloud = r.calls.filter((u: string) => u.includes('/v1/tts:synthesize'));
  expect(gemini.length).toBe(2);     // 1 stream attempt + 1 blocking generateContent (v281 safety net)
  expect(cloud.length).toBe(0);      // the secondary is never touched for a non-fallback-worthy error
  expect(r.calls.length).toBe(2);
});

test('R-45 DoD-4: a BYOK user never calls the secondary and never goes silent', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...BYOK });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    window.__installFetch(async function(url){
      if(url.indexOf('/v1/tts:synthesize')>=0) throw new Error('the secondary must never be reached by a BYOK user');
      return new Response(window.__pcmBytes(0.3), {status:200});   // pretend Gemini answers (mocked below anyway)
    });
    window.__gemTtsStreamMock = async function(t,l,g){ window.__spoke=(window.__spoke||0)+1; return gemAudioCtx().currentTime+0.3; };
    try{
      const gen=vcNewSpeakGen();
      const cursor=await ttsSpeakSeg('התראה קצרה','he',gen,0,'alert');   // an ALERT — a cloud row in the table
      return { cursor, spoke: window.__spoke, cloudCalls: window.__ttsCalls.filter(function(u){return u.indexOf('/v1/tts:synthesize')>=0;}).length };
    } finally { window.__restoreFetch(); delete window.__gemTtsStreamMock; }
  })()`);
  expect(r.cloudCalls).toBe(0);        // skipped cleanly — design §2
  expect(r.spoke).toBe(1);             // and it still SPEAKS — no mysterious silence (DoD-4)
  expect(typeof r.cursor).toBe('number');
});

test('R-45: a 403 permission failure is NOT fallback-worthy — a second engine cannot fix billing', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsFallbackWorthy==='function'`);
  const r = await page.evaluate(`({
    rate:    ttsFallbackWorthy(new Error('api-429: RESOURCE_EXHAUSTED')),
    quota:   ttsFallbackWorthy(new Error('api-400: quota')),
    timeout: ttsFallbackWorthy(new Error('timeout')),
    noAudio: ttsFallbackWorthy(new Error('no-audio')),
    perm:    ttsFallbackWorthy(new Error('api-403: permission denied')),
    other:   ttsFallbackWorthy(new Error('api-404: model not found'))
  })`);
  expect(r.rate).toBe(true);
  expect(r.quota).toBe(true);
  expect(r.timeout).toBe(true);
  expect(r.noAudio).toBe(true);
  expect(r.perm).toBe(false);
  expect(r.other).toBe(false);
});

test('R-45 §4.2: an alert routes to the secondary and an answer does not — same code path, table-driven', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    window.__installFetch(async function(url){ return new Response(window.__pcmBytes(0.2), {status:200}); });
    try{
      // ttsSpeakSeg checks window.__gemTtsStreamMock UNCONDITIONALLY, at the same first-line position
      // gemSpeakSeg already used (required so every existing voice test that installs the mock keeps
      // working) — so it must stay UNINSTALLED for the alert call, or it would short-circuit the cloud
      // decision this call is testing and never reach cloudSpeakSeg at all.
      await ttsSpeakSeg('התראה','he',vcNewSpeakGen(),0,'alert');
      const afterAlert = window.__ttsCalls.filter(function(u){return u.indexOf('/v1/tts:synthesize')>=0;}).length;
      window.__gemTtsStreamMock = async function(){ return gemAudioCtx().currentTime+0.2; };
      await ttsSpeakSeg('תשובה','he',vcNewSpeakGen(),0,'answer');
      const afterAnswer = window.__ttsCalls.filter(function(u){return u.indexOf('/v1/tts:synthesize')>=0;}).length;
      return { afterAlert, afterAnswer };
    } finally { window.__restoreFetch(); delete window.__gemTtsStreamMock; }
  })()`);
  expect(r.afterAlert).toBe(1);        // alert → cloud
  expect(r.afterAnswer).toBe(1);       // answer → gemini (the cloud counter did not move)
});

test('R-45: vcSpeak threads the use case through to the decision point', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof vcSpeak==='function' && typeof ttsSpeakSeg==='function'`);
  await page.evaluate(`{
    window.__seen=[];
    window.__ttsSpeakSegReal=window.ttsSpeakSeg;
    window.ttsSpeakSeg=async function(t,l,g,s,useCase){ window.__seen.push(useCase); return (s||0)+0.1; };
  }`);
  try{
    await page.evaluate(`{
      vcSpeak('תשובה','he');                       // default
      vcSpeak('התראה','he','alert');
      vcSpeakContent('שלב');
    }`);
    await page.waitForFunction(`window.__seen && window.__seen.length>=3`);
    const r = await page.evaluate(`window.__seen.slice()`);
    expect(r).toContain('answer');
    expect(r).toContain('alert');
    expect(r).toContain('step');
  } finally {
    await page.evaluate(`{ window.ttsSpeakSeg=window.__ttsSpeakSegReal; delete window.__ttsSpeakSegReal; }`);
  }
});

test('R-45 DoD-5: the safety guard cannot be bypassed by routing to the secondary', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof vcGuardSpoken==='function' && typeof ttsSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  await page.evaluate(COUNTING_FETCH);
  const r = await page.evaluate(`(async()=>{
    // An UNVERIFIED safety number: no tier evidence backs 71, so vcGuardSpoken must strip/redact it.
    const raw='הוצא את העוף כשהליבה מגיעה ל-71 מעלות.';
    const guarded=vcGuardSpoken(raw, {t1:[], t2:[]}, 'he');
    window.__cloudSaw=[]; window.__geminiSaw=[];
    window.__installFetch(async function(url,o){
      const body=JSON.parse((o&&o.body)||'{}');
      if(url.indexOf('/v1/tts:synthesize')>=0){ window.__cloudSaw.push(body.text); return new Response(window.__pcmBytes(0.2),{status:200}); }
      window.__geminiSaw.push(JSON.stringify(body));
      return window.__gemini429();                     // force the fallback so BOTH engines see this text
    });
    try{
      const gen=vcNewSpeakGen();
      await ttsSpeakSeg(guarded,'he',gen,0,'answer');  // gemini first (429) → cloud second
      const gen2=vcNewSpeakGen();
      await ttsSpeakSeg(guarded,'he',gen2,0,'alert');  // routed straight to cloud
      return { raw, guarded, cloudSaw: window.__cloudSaw.slice(), geminiSaw: window.__geminiSaw.slice() };
    } finally { window.__restoreFetch(); }
  })()`);
  // the guard actually did something — otherwise the rest of this test proves nothing
  expect(r.guarded).not.toBe(r.raw);
  expect(r.cloudSaw.length).toBe(2);                                   // fallback path + routed path
  // NEITHER engine ever receives the unguarded text, on EITHER route into the secondary
  for (const seen of r.cloudSaw) {
    expect(seen).toBe(r.guarded);
    expect(seen).not.toContain('71');
  }
  for (const seen of r.geminiSaw) expect(seen).not.toContain('71');
});

test('R-45 DoD-5: the guard runs upstream of provider selection — vcSpeak never hands raw text to any engine', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsSpeakSeg==='function'`);
  await page.evaluate(`window.__segSaw=[]; window.__realSeg=window.ttsSpeakSeg;
    window.ttsSpeakSeg=async function(t,l,g,s,u){ window.__segSaw.push({t,u}); return (s||0)+0.1; };`);
  await page.evaluate(`(function(){
    const raw='טמפ׳ ליבה 71 מעלות.';
    vcSpeak(vcGuardSpoken(raw, {t1:[],t2:[]}, 'he'), 'he', 'answer');
  })()`);
  await page.waitForFunction(`window.__segSaw.length>0`);
  const saw = await page.evaluate(`window.__segSaw.map(function(x){return x.t;}).join(' ')`);
  await page.evaluate(`window.ttsSpeakSeg=window.__realSeg;`);
  expect(saw).not.toContain('71');
});

test('R-45 DoD-6: barge-in stops the secondary, including audio already SCHEDULED on the clock', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    window.fetch=async function(){ return new Response(window.__pcmBytes(3.0), {status:200}); };
    try{
      const gen=vcNewSpeakGen();
      const ctx=gemAudioCtx();
      // schedule 5 s in the FUTURE: start(t0) has fired but no sound has been produced yet — the exact
      // hazard gemPlayBuf's "gemSrc assigned BEFORE start()" comment names.
      const p=cloudSpeakSeg('טקסט ארוך','he',gen, ctx.currentTime+5.0);
      await new Promise(function(res){ const t=setInterval(function(){ if(gemSrc){ clearInterval(t); res(); } }, 10); });
      const hadSrc = !!gemSrc, wasSpeaking = vcSpeaking;
      let stopped=false;
      const src=gemSrc; src.addEventListener('ended', function(){ stopped=true; });
      gemStop();                                        // the barge-in
      const afterSrc = gemSrc, afterSpeaking = vcSpeaking;
      await new Promise(function(res){ const t=setInterval(function(){ if(stopped){ clearInterval(t); res(); } }, 10); });
      vcNewSpeakGen();                                  // a new speaker takes the floor
      return { hadSrc, wasSpeaking, afterSrc, afterSpeaking, stopped, cursor: await p };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.hadSrc).toBe(true);                 // the queued source is REACHABLE before it plays
  expect(r.wasSpeaking).toBe(true);
  expect(r.afterSrc).toBeNull();               // gemStop() cleared it
  expect(r.afterSpeaking).toBe(false);
  expect(r.stopped).toBe(true);                // and the AudioBufferSourceNode actually stopped
});

test('R-45 DoD-6: a barge-in during cloud SYNTHESIS never schedules the audio at all', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudSpeakSeg==='function'`);
  await page.evaluate(PCM_HELPERS);
  const r = await page.evaluate(`(async()=>{
    const realFetch=window.fetch;
    let release; const gate=new Promise(function(res){ release=res; });
    window.fetch=async function(){ await gate; return new Response(window.__pcmBytes(1.0), {status:200}); };
    try{
      const gen=vcNewSpeakGen();
      const startAt=gemAudioCtx().currentTime+1.0;
      const before=window.__gemAudioChunks;
      const p=cloudSpeakSeg('שלום','he',gen,startAt);
      vcNewSpeakGen();                                  // barge-in WHILE the request is in flight
      release();
      const cursor=await p;
      return { cursor, startAt, scheduled: window.__gemAudioChunks-before, src: gemSrc };
    } finally { window.fetch=realFetch; }
  })()`);
  expect(r.cursor).toBe(r.startAt);            // the cursor is returned untouched — the contract holds
  expect(r.scheduled).toBe(0);                 // nothing was ever put on the audio clock
  expect(r.src).toBeNull();
});

// R-45 DoD-7: the service-account secret must not be in what we ship. This reads the BUILT bundle, not
// the source — the build is what reaches a user (the v267 lesson: measure the artifact, not a proxy).
test('R-45 DoD-7: no service-account material is present in the shipped bundle', () => {
  const dist = readFileSync(resolve(process.cwd(), 'dist/index.html'), 'utf8');
  for (const needle of [
    'BEGIN PRIVATE KEY', 'PRIVATE KEY-----', 'private_key', 'client_email',
    'iam.gserviceaccount.com', 'oauth2.googleapis.com/token',
    'urn:ietf:params:oauth:grant-type:jwt-bearer', 'GCP_SA_JSON',
  ]) {
    expect(dist).not.toContain(needle);
  }
  // positive control: the bundle DOES contain the client half, so this test is reading the right file
  expect(dist).toContain('/v1/tts:synthesize');
  expect(dist).toContain('cloudSpeakSeg');
});
