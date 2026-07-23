// Model migration diagnostic — pins down the exact api-400 the app hit flipping to gemini-3.6-flash.
// Runs in CI with GEMINI_EVAL_KEY (the key is used only in the request URL, NEVER printed). Prints
// status + Google's error body for each (model × payload) combo so we know precisely which field 3.x
// rejects, rather than guessing. Read-only probe: creates nothing, changes no app behaviour.
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
    return { status: r.status, ok: r.ok, body: text.slice(0, 900) };
  } catch (e) { return { status: 0, ok: false, body: 'FETCH THREW: ' + (e && e.message) }; }
}

const line = (s) => console.log(s);

// 1) What 3.x / flash models does THIS key actually see on the developer API?
line('===== ListModels (gemini-3.x and flash only) =====');
const list = await call('models', null);
if (list.ok) {
  try {
    const names = (JSON.parse(list.body).models || []).map(m => m.name).filter(n => /gemini-3|flash/.test(n));
    line(names.length ? names.join('\n') : '(no gemini-3/flash models visible — page may be truncated; body below)');
    if (!names.length) line(list.body);
  } catch { line('parse failed; raw: ' + list.body); }
} else { line(`ListModels status ${list.status}: ${list.body}`); }

// 2) For each candidate model, try progressively-richer payloads to isolate the offending field.
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const PAYLOADS = {
  'minimal': { contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }] },
  '+thinkingBudget:0': { contents: [{ parts: [{ text: 'Reply OK.' }] }], generationConfig: { thinkingConfig: { thinkingBudget: 0 } } },
  '+google_search': { contents: [{ parts: [{ text: 'Reply OK.' }] }], tools: [{ google_search: {} }] },
  '+both (like the app)': { contents: [{ parts: [{ text: 'Reply OK.' }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.8, maxOutputTokens: 64, thinkingConfig: { thinkingBudget: 0 } } },
};
for (const model of MODELS) {
  line(`\n===== ${model} =====`);
  for (const [label, body] of Object.entries(PAYLOADS)) {
    const r = await call(`models/${model}:generateContent`, body);
    const verdict = r.ok ? 'OK' : `FAIL ${r.status}`;
    line(`  ${label.padEnd(22)} -> ${verdict}`);
    if (!r.ok) line(`      ${r.body.replace(/\s+/g, ' ').slice(0, 400)}`);
  }
}
line('\n===== done =====');
