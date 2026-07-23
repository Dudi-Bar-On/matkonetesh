// Model migration diagnostic — pins down how gemini-3.6-flash's "thinking" is controlled on the
// Gemini Developer API (v1beta :generateContent), so the app can migrate off gemini-2.5-flash's
// thinkingBudget:0 without an uncontrolled token-cost blowup.
//
// Runs in CI with GEMINI_EVAL_KEY (the key is used ONLY in the request URL, NEVER printed). For each
// (model x thinking-config) it prints status + Google's exact error body, and for the calls that
// succeed it prints usageMetadata (promptTokenCount / thoughtsTokenCount / candidatesTokenCount /
// totalTokenCount) + finishReason — so we measure, not guess, which control minimises thinking cost.
// Read-only probe: creates nothing, changes no app behaviour, touches no production file.
//
// Usage (CI): GEMINI_EVAL_KEY=... node scripts/model-diag.mjs
const KEY = process.env.GEMINI_EVAL_KEY || process.env.GEMINI_API_KEY;
if (!KEY) { console.error('NO KEY (GEMINI_EVAL_KEY/GEMINI_API_KEY) — cannot run diagnostic'); process.exit(2); }
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function call(path, body) {
  const url = `${BASE}/${path}?key=${KEY}`;            // key in URL, never logged
  try {
    const r = await fetch(url, body ? {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    } : {});
    const text = await r.text();
    return { status: r.status, ok: r.ok, body: text };
  } catch (e) { return { status: 0, ok: false, body: 'FETCH THREW: ' + (e && e.message) }; }
}

const line = (s) => console.log(s);

// Pull the token accounting out of a successful generateContent response.
function usage(rawBody) {
  try {
    const j = JSON.parse(rawBody);
    const u = j.usageMetadata || {};
    const fr = (j.candidates && j.candidates[0] && j.candidates[0].finishReason) || '?';
    // Did we actually get answer text back, or did thinking eat the whole output budget?
    let txt = '';
    try { txt = (j.candidates[0].content.parts || []).map(p => p.text || '').join(''); } catch { /* none */ }
    return {
      prompt: u.promptTokenCount ?? '-',
      thoughts: u.thoughtsTokenCount ?? 0,
      cand: u.candidatesTokenCount ?? '-',
      total: u.totalTokenCount ?? '-',
      finish: fr,
      answered: txt.trim().length > 0,
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------
// 1) What 3.x / flash models does THIS key actually see on the developer API?
// ---------------------------------------------------------------------------------------------------
line('===== ListModels (gemini-3.x and flash only) =====');
const list = await call('models', null);
if (list.ok) {
  try {
    const names = (JSON.parse(list.body).models || []).map(m => m.name).filter(n => /gemini-3|flash/.test(n));
    line(names.length ? names.join('\n') : '(no gemini-3/flash models visible — page may be truncated; body below)');
    if (!names.length) line(list.body.slice(0, 900));
  } catch { line('parse failed; raw: ' + list.body.slice(0, 900)); }
} else { line(`ListModels status ${list.status}: ${list.body.slice(0, 900)}`); }

// ---------------------------------------------------------------------------------------------------
// 2) Original isolation probe — which single field does 3.x reject? (kept for the regression record)
// ---------------------------------------------------------------------------------------------------
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const PAYLOADS = {
  'minimal': { contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }] },
  '+thinkingBudget:0': { contents: [{ parts: [{ text: 'Reply OK.' }] }], generationConfig: { thinkingConfig: { thinkingBudget: 0 } } },
  '+google_search': { contents: [{ parts: [{ text: 'Reply OK.' }] }], tools: [{ google_search: {} }] },
  '+both (like the app)': { contents: [{ parts: [{ text: 'Reply OK.' }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.8, maxOutputTokens: 64, thinkingConfig: { thinkingBudget: 0 } } },
};
line('\n===== FIELD-ISOLATION PROBE (does the model reject the field at all?) =====');
for (const model of MODELS) {
  line(`\n----- ${model} -----`);
  for (const [label, body] of Object.entries(PAYLOADS)) {
    const r = await call(`models/${model}:generateContent`, body);
    const verdict = r.ok ? 'OK' : `FAIL ${r.status}`;
    line(`  ${label.padEnd(22)} -> ${verdict}`);
    if (!r.ok) line(`      ${r.body.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------------------------------
// 3) THINKING-CONTROL MATRIX — the point of this diagnostic.
//    Same reasoning prompt + same output envelope for every config; only the thinking control varies.
//    A prompt that needs a little arithmetic reasoning, so thoughtsTokenCount actually differs by level.
//    maxOutputTokens generous (1600, the app's upper bound) so thinking has room to be measured.
// ---------------------------------------------------------------------------------------------------
const PROMPT = 'A smoker holds 3 racks; each rack fits 4 slabs. Two racks are full and the third holds 1 slab. How many more slabs fit in total? Reply with only the number.';
const ENV = { temperature: 0.8, maxOutputTokens: 1600 };           // app-like output envelope
const contents = [{ parts: [{ text: PROMPT }] }];

// Each entry: label -> { gen (generationConfig), tools? }. gen is merged onto ENV.
const MATRIX = {
  'baseline (no thinkingConfig)':      { gen: {} },
  'thinkingBudget:0':                  { gen: { thinkingConfig: { thinkingBudget: 0 } } },
  'thinkingBudget:128':                { gen: { thinkingConfig: { thinkingBudget: 128 } } },
  'thinkingBudget:512':                { gen: { thinkingConfig: { thinkingBudget: 512 } } },
  'thinkingBudget:-1 (dynamic)':       { gen: { thinkingConfig: { thinkingBudget: -1 } } },
  'thinkingLevel:"minimal"':           { gen: { thinkingConfig: { thinkingLevel: 'minimal' } } },
  'thinkingLevel:"low"':               { gen: { thinkingConfig: { thinkingLevel: 'low' } } },
  'thinkingLevel:"medium"':            { gen: { thinkingConfig: { thinkingLevel: 'medium' } } },
  'thinkingLevel:"high"':              { gen: { thinkingConfig: { thinkingLevel: 'high' } } },
  'thinkingLevel:"off" (bad-value probe)': { gen: { thinkingConfig: { thinkingLevel: 'off' } } },
  'thinkingLevel@top-level (wrong nest)':  { gen: { thinkingLevel: 'minimal' } },
  'thinkingLevel:minimal + includeThoughts:false': { gen: { thinkingConfig: { thinkingLevel: 'minimal', includeThoughts: false } } },
  'thinkingLevel:minimal + thinkingBudget:0 (both)': { gen: { thinkingConfig: { thinkingLevel: 'minimal', thinkingBudget: 0 } } },
  'MIGRATION CANDIDATE: minimal + google_search': { gen: { thinkingConfig: { thinkingLevel: 'minimal' } }, tools: [{ google_search: {} }] },
};

for (const model of MODELS) {
  line(`\n===== THINKING MATRIX · ${model} =====`);
  line('  config'.padEnd(52) + 'status   prompt thoughts cand total  finish        answered');
  for (const [label, spec] of Object.entries(MATRIX)) {
    const body = { contents, generationConfig: { ...ENV, ...spec.gen } };
    if (spec.tools) body.tools = spec.tools;
    const r = await call(`models/${model}:generateContent`, body);
    if (r.ok) {
      const u = usage(r.body);
      if (u) {
        line('  ' + label.padEnd(50) + `OK      ${String(u.prompt).padStart(6)} ${String(u.thoughts).padStart(8)} ${String(u.cand).padStart(5)} ${String(u.total).padStart(5)}  ${String(u.finish).padEnd(13)} ${u.answered ? 'yes' : 'NO'}`);
      } else {
        line('  ' + label.padEnd(50) + 'OK (usage parse failed) ' + r.body.replace(/\s+/g, ' ').slice(0, 160));
      }
    } else {
      line('  ' + label.padEnd(50) + `FAIL ${r.status}`);
      line('      ' + r.body.replace(/\s+/g, ' ').slice(0, 320));
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// 4) TTS MIGRATION PROBE — find & VERIFY the "3.1 tts" developer-API id (do not guess it).
//    The app's real TTS call (app.js:5030) is reproduced exactly. Success is defined by what
//    gemReadAudio (app.js:5034-5037) actually needs: HTTP 200 AND an inlineData part whose
//    mimeType contains rate=NNN. Control = gemini-2.5-flash-preview-tts (today's model).
// ---------------------------------------------------------------------------------------------------
line('\n===== TTS · candidate model ids (ListModels, matching /tts/i | /3\\.1/ | /preview-tts/i) =====');
const ttsIds = new Set();
if (list.ok) {
  try {
    const models = JSON.parse(list.body).models || [];
    for (const m of models) {
      if (/tts/i.test(m.name) || /3\.1/.test(m.name) || /preview-tts/i.test(m.name)) {
        const methods = (m.supportedGenerationMethods || []).join(',') || '(none advertised)';
        const audio = /audio|tts|speech/i.test((m.description || '') + m.name) ? 'audio?' : '';
        line(`  ${m.name.padEnd(42)} methods=[${methods}] ${audio}`);
        if (/tts/i.test(m.name)) ttsIds.add(m.name.replace(/^models\//, ''));
      }
    }
  } catch (e) { line('  parse failed: ' + e.message); }
}
// Always probe the control + the primary 3.1 candidate even if list ordering/paging hides them.
const TTS_CONTROL = 'gemini-2.5-flash-preview-tts';
ttsIds.add(TTS_CONTROL);
ttsIds.add('gemini-3.1-flash-tts-preview');   // the visible 3.1 tts id — VERIFY, don't trust

// The app's exact TTS payload (app.js:5030), voiceName parameterised.
const ttsPayload = (voice) => ({
  contents: [{ parts: [{ text: 'שלום, זו בדיקה' }] }],
  generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
});
async function ttsProbe(model, voice) {
  const r = await call(`models/${model}:generateContent`, ttsPayload(voice));
  if (!r.ok) return { ok: false, status: r.status, err: r.body.replace(/\s+/g, ' ').slice(0, 300) };
  try {
    const j = JSON.parse(r.body);
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const part = parts.find(p => p.inlineData);
    if (!part) return { ok: true, status: 200, hasAudio: false, note: '200 but NO inlineData; body: ' + r.body.replace(/\s+/g, ' ').slice(0, 200) };
    const mime = part.inlineData.mimeType || '';
    const rateMatch = mime.match(/rate=(\d+)/);
    return { ok: true, status: 200, hasAudio: true, mime, rate: rateMatch ? rateMatch[1] : '(no rate= in mimeType!)', b64len: (part.inlineData.data || '').length };
  } catch (e) { return { ok: true, status: 200, hasAudio: false, note: 'parse failed: ' + e.message }; }
}

line('\n===== TTS · POST the app payload (voiceName:"Kore") — control first, then candidates =====');
const ordered = [TTS_CONTROL, ...[...ttsIds].filter(m => m !== TTS_CONTROL)];
const ttsWinners = [];
for (const model of ordered) {
  const p = await ttsProbe(model, 'Kore');
  if (p.ok && p.hasAudio) {
    line(`  ${model.padEnd(42)} -> AUDIO OK  mimeType="${p.mime}"  rate=${p.rate}  b64len=${p.b64len}`);
    if (model !== TTS_CONTROL) ttsWinners.push({ model, mime: p.mime, rate: p.rate });
  } else if (p.ok) {
    line(`  ${model.padEnd(42)} -> 200 but NO AUDIO — ${p.note}`);
  } else {
    line(`  ${model.padEnd(42)} -> FAIL ${p.status}`);
    line(`      ${p.err}`);
  }
}

// 4b) On each 3.x winner, check whether the voice-config shape / encoding differs from 2.5-preview-tts:
//     re-probe with a DIFFERENT prebuilt voice to confirm prebuiltVoiceConfig is still honoured.
if (ttsWinners.length) {
  line('\n===== TTS · winner detail — alternate voice ("Puck") to confirm voice-config shape =====');
  for (const w of ttsWinners) {
    const p = await ttsProbe(w.model, 'Puck');
    if (p.ok && p.hasAudio) line(`  ${w.model.padEnd(42)} voice=Puck -> AUDIO OK  mimeType="${p.mime}"  rate=${p.rate}`);
    else if (p.ok) line(`  ${w.model.padEnd(42)} voice=Puck -> 200 but NO AUDIO — ${p.note}`);
    else { line(`  ${w.model.padEnd(42)} voice=Puck -> FAIL ${p.status}`); line(`      ${p.err}`); }
  }
} else {
  line('\n===== TTS · NO 3.x TTS id returned audio — the app must stay on gemini-2.5-flash-preview-tts =====');
}

line('\n===== done =====');
