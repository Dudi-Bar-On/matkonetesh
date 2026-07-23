import { test, expect } from '@playwright/test';

// Behavioral seam tests for the AI model-selection registry (design:
// docs/analysis/program/model-selection-architecture-design.md). Asserts the emitted
// request URL/body and reader outputs, exactly like tests/wave3-ai-hardening.spec.ts — never internals.

export const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof gemId==='function'`);
};

test('registry: gemId/gemModel resolve roles to concrete ids and default unknown roles to text', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    textId: gemId('text'),
    ttsId: gemId('tts'),
    textKind: gemModel('text').kind,
    ttsKind: gemModel('tts').kind,
    unknownId: gemId('nope'),
  })`) as any;
  expect(r.textId).toBe('gemini-3.6-flash');
  expect(r.ttsId).toBe('gemini-2.5-flash-preview-tts');
  expect(r.textKind).toBe('text');
  expect(r.ttsKind).toBe('audio');
  expect(r.unknownId).toBe('gemini-3.6-flash');   // unknown role falls back to the text row
});

test('migration(text): text resolves to gemini-3.6-flash and emits the thinkingLevel enum (never thinkingBudget)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    id: gemId('text'),
    minimal: gemThink('text','minimal'),
    high: gemThink('text','high'),
    gen: gemGen('text', {temperature:0.8, maxOutputTokens:1600}, {think:'low'}),
  })`) as any;
  expect(r.id).toBe('gemini-3.6-flash');
  expect(r.minimal).toEqual({ thinkingLevel: 'minimal' });   // 3.x enum — 0 thinking tokens on short calls
  expect(r.high).toEqual({ thinkingLevel: 'high' });
  expect(r.gen).toEqual({ temperature:0.8, maxOutputTokens:1600, thinkingConfig:{ thinkingLevel:'low' } });
  expect(r.gen.thinkingConfig.thinkingBudget).toBeUndefined();   // never the knob 3.6 rejects
});

test('thinking: numeric-knob translation, no-knob returns nothing, unknown level floors to minimal', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__b = { kind:'text', think:{ knob:'budget' } };   // throwaway numeric-knob role (migration-stable)
    return {
      low: gemThink('__b','low'),
      minimal: gemThink('__b','minimal'),
      high: gemThink('__b','high'),
      tts: gemThink('tts','high') ?? 'UNDEF',
      bogus: gemThink('__b','not-a-level'),
    };
  })()`) as any;
  expect(r.low).toEqual({ thinkingBudget: 512 });
  expect(r.minimal).toEqual({ thinkingBudget: 0 });
  expect(r.high).toEqual({ thinkingBudget: 8192 });
  expect(r.tts).toBe('UNDEF');                    // knob:'none' → never a thinking field
  expect(r.bogus).toEqual({ thinkingBudget: 0 }); // unknown level → 'minimal' floor
});

test('thinking: enum-knob clamps to nearest supported preferring lower, and logs the clamp', async ({ page }) => {
  await init(page);
  const warnings: string[] = [];
  page.on('console', (m: any) => { if (m.text().includes('thinking level clamped')) warnings.push(m.text()); });
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__t = { kind:'text', think:{ knob:'level', levels:['minimal','medium'] } };
    const near = nearestLevel('low', ['minimal','medium']);   // low is equidistant → prefer lower → minimal
    const clamped = gemThink('__t','low');
    const exact = gemThink('__t','medium');                    // supported exactly → no clamp
    return { near, clamped, exact };
  })()`) as any;
  expect(r.near).toBe('minimal');
  expect(r.clamped).toEqual({ thinkingLevel: 'minimal' });
  expect(r.exact).toEqual({ thinkingLevel: 'medium' });
  await expect.poll(() => warnings.length).toBeGreaterThan(0);   // warnClamp fired for the clamp (not the exact match)
});

test('thinking: AI_THINK policy maps each usage to its approved level (§2.2.4)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    ask: thinkFor('ask'), diagnose: thinkFor('diagnose'), vcAsk: thinkFor('vcAsk'),
    eventPlan: thinkFor('eventPlan'), seasonRec: thinkFor('seasonRec'), dataMT: thinkFor('dataMT'),
    translate: thinkFor('translate'), vision: thinkFor('vision'), keyProbe: thinkFor('keyProbe'),
    centralTest: thinkFor('centralTest'), wcim: thinkFor('wcim'), unknown: thinkFor('whatever'),
  })`) as any;
  expect(r).toEqual({
    ask:'low', diagnose:'high', vcAsk:'low', eventPlan:'medium', seasonRec:'minimal', dataMT:'minimal',
    translate:'minimal', vision:'low', keyProbe:'minimal', centralTest:'minimal', wcim:'minimal', unknown:'minimal',
  });
});

test('seam: gemGen applies the role thinking knob (default minimal) and never adds audio fields', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__b = { kind:'text', think:{ knob:'budget' } };   // migration-stable numeric role
    return {
      low: gemGen('__b', {temperature:0.8, maxOutputTokens:1600}, {think:'low'}),
      def: gemGen('__b', {maxOutputTokens:20}),                    // no opts → default think 'minimal'
      tts: gemGen('tts', {temperature:0.4}, {think:'high'}),
    };
  })()`) as any;
  expect(r.low).toEqual({ temperature:0.8, maxOutputTokens:1600, thinkingConfig:{ thinkingBudget:512 } });
  expect(r.def).toEqual({ maxOutputTokens:20, thinkingConfig:{ thinkingBudget:0 } });
  expect(r.tts.thinkingConfig).toBeUndefined();       // audio role → no thinking field
  expect(r.tts.responseModalities).toBeUndefined();   // gemGen does not add audio fields (that is gemTtsGen)
});

test('seam: gemTtsGen builds the audio generationConfig with the given voice or the tts default', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({ withVoice: gemTtsGen('Puck'), fallback: gemTtsGen() })`) as any;
  expect(r.withVoice).toEqual({ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:'Puck' } } } });
  expect(r.fallback.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');   // gemModel('tts').voiceDefault
});

test('seam: gemReadText joins text parts, throws with the finishReason when empty, guards its kind', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    const ok = gemReadText({candidates:[{content:{parts:[{text:'hello '},{text:'world'}]}}]});
    let emptyErr='none'; try{ gemReadText({candidates:[{content:{parts:[{text:''}]},finishReason:'SAFETY'}]}); }catch(e){ emptyErr=String(e.message); }
    let audioErr='none'; try{ gemReadText({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:''}}]}}]}); }catch(e){ audioErr=String(e.message); }
    return { ok, emptyErr, audioErr };
  })()`) as any;
  expect(r.ok).toBe('hello world');
  expect(r.emptyErr).toBe('empty-SAFETY');
  expect(r.audioErr).toContain('empty');   // an audio-only response has no text → guarded, not returned as ''
});

test('seam: gemReadAudio decodes PCM inlineData to a buffer and throws no-audio on a text-only response', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    const pcm=new Int16Array([0, 16384, -16384]);
    const bytes=new Uint8Array(pcm.buffer); let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
    const b64=btoa(s);
    const out=gemReadAudio({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000', data:b64}}]}}]});
    let textErr='none'; try{ gemReadAudio({candidates:[{content:{parts:[{text:'hi'}]}}]}); }catch(e){ textErr=String(e.message); }
    return { rate: out.rate, len: out.buf.length, isBuf: (typeof AudioBuffer!=='undefined' && out.buf instanceof AudioBuffer), textErr };
  })()`) as any;
  expect(r.rate).toBe(24000);
  expect(r.len).toBe(3);
  expect(r.isBuf).toBe(true);
  expect(r.textErr).toBe('no-audio');   // a text response has no inlineData → guarded
});

test('wiring: text sites emit role text + their AI_THINK level; TTS emits audio + no thinking', async ({ page }) => {
  await init(page);
  await page.evaluate(`typeof aiAvail`);   // ensure app globals are present
  const r = await page.evaluate(`(async function(){
    store.set('mk-gemkey','K');
    const cap={};
    window.gemFetch = async (model, body, opts)=>{
      (cap[model]=cap[model]||[]).push(body);
      if(model==='tts') return { ok:false, status:503, json:async()=>({}) };   // capture the request, skip WebAudio playback
      return { ok:true, status:200, json:async()=>({ candidates:[{ content:{ parts:[
        { text:'{"diagnosis":"x","causes":[],"fixes":[],"related":[],"guests":2,"appetite":"reg","kosher":false,"keys":[],"sides":[],"drinks":[],"desserts":[],"rationale":"r","recommend":[]}' }
      ]}}]}) };
    };
    await askGemini('כמה זמן לעשן חזה?', []);          // #1 ask → low
    try{ await gemSpeak('שלום', 'he'); }catch(e){}       // #5 tts → api-503 after capture, no playback
    await aiDiagnose('הבשר יבש');                         // #3a diagnose → high
    await aiPlanEvent('ארוחה ל-8 אנשים');                // #3b eventPlan → medium
    await aiJSON({task:'t', schemaHint:'{}'});           // #3 default → minimal
    return {
      roles: Object.keys(cap).sort(),
      textThinking: (cap['text']||[]).map(b=> b.generationConfig.thinkingConfig),
      ttsGen: cap['tts'] ? cap['tts'][0].generationConfig : null,
    };
  })()`) as any;
  expect(r.roles).toEqual(['text','tts']);                       // every caller went out as a ROLE, not a literal id
  // order: askGemini, aiDiagnose, aiPlanEvent, aiJSON — on 3.6-flash the knob is the thinkingLevel ENUM
  expect(r.textThinking).toEqual([
    { thinkingLevel: 'low' },      // ask
    { thinkingLevel: 'high' },     // diagnose
    { thinkingLevel: 'medium' },   // eventPlan
    { thinkingLevel: 'minimal' },  // aiJSON default
  ]);
  expect(r.ttsGen.responseModalities).toEqual(['AUDIO']);        // audio modality
  expect(r.ttsGen.thinkingConfig).toBeUndefined();               // TTS carries no thinking field
});
