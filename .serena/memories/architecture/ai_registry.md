# matconetesh — AI / Gemini registry surface

All in `app.js`, clustered roughly lines 4200–4330 (the "gem*"/"AI_*" naming family). Locations
confirmed live via Serena `find_symbol` on 2026-07-24 (line numbers are exact `find_symbol` output,
not estimates):

- `GEM_HOST` — app.js:4204. `'https://generativelanguage.googleapis.com/v1beta/models/'` (direct
  Google endpoint).
- `GEM_MODELS` — app.js:4208-4220. The model registry:
  - `text` → `gemini-3.6-flash` (`think.knob:'level'`, levels minimal/low/medium/high; `caps`:
    search + jsonMode, and jsonMode EXCLUDES search — `jsonModeExcludesSearch:true`).
  - `tts` → `gemini-3.1-flash-tts-preview` (audio, `voiceDefault:'Kore'`, `think.knob:'none'` — no
    thinking field is ever emitted for the audio model).
  - A commented-out `textLegacy` entry (`gemini-2.5-flash`, the OLD numeric `'budget'` knob) is kept
    inline as "ROLLBACK PIN (decision 3)" — a one-line flip-back if the 3.x migration needs reverting.
    Cross-references the assistant's own `model-migration-arc` memory.
- `AI_THINK` — app.js:4253-4265. Per-role thinking-level map: `ask`/`vcAsk` → level low, floor low
  (grounded prose that can emit safety numbers — floored so it's never cheapened further);
  `diagnose` → level high, floor medium (highest-stakes reasoning); `eventPlan` → medium;
  `wcim`/`seasonRec`/`dataMT`/`translate`/`keyProbe`/`centralTest` → minimal; `vision` → low.
- `gemGen(role, gen, opts)` — app.js:4269-4274. Builds `thinkingConfig` via
  `gemThink(role, opts.think||'minimal')`, then merges it onto `gen` or deletes the key entirely —
  inline comment: "one knob or none → the mutual-exclusivity 400 is impossible".
- `gemThink(role, level)` — app.js:4238. Has exactly ONE caller in the whole file: `gemGen` at
  app.js:4272 (confirmed BOTH via Serena `find_referencing_symbols` and a `Grep` cross-check — same-
  file reference search is accurate on this repo).
- `gemFetch(model, body, opts): Promise<Response>` — app.js:4297-4326. The actual network call.

**worker/index.js is a SEPARATE, smaller surface** (91 lines): exports `CORS`, `GEMINI_BASE`, a
`json()` helper, and `export default { fetch(request, env) {...} }` (its `fetch` handler uses local
vars `rec`, `gResp` — read as "record"/"Gemini response"). This was NOT traced against `gemFetch`
in the 2026-07-24 session — do not assume they are the same call path (one may be a
direct-to-Google BYOK path, the other a server-key-holding proxy path) until someone actually reads
both bodies and confirms. The Worker is where the real Gemini/Cloudflare secrets live (Worker
secrets, never in the repo).
