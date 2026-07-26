# Full localization (offline dictionary) — design

**Status:** approved-direction (owner brainstorm 2026-07-26), pending spec review.
**Origin:** the v267 real-UI audit (`docs/analysis/2026-07-26-v267-ui-audit-phase1.md`) found fr/de/es/it
render ~550 strings/language in **English**, because the app is he/en-bilingual in its code and fr/de/es/it
are only a dictionary overlay over the explicitly-keyed strings. The "99% coverage" metric measured
`fr.json ÷ en.json` keys and was blind to every inline `L(he,en)` / `he?x:y` string.

## Goal
Every user-facing string renders in the active language — offline, instantly, with no English fallback —
for en/fr/de/es/it now and every queued language after. Safety numbers can never be altered by translation.

## Owner decisions (brainstorm)
1. **Completeness: everything** — UI chrome, cooking-step prose, AND recipe/category/cut names.
2. **Mechanism: offline pre-translated dictionary** built by the local `translategemma` pipeline, with a
   **build-time coverage guard** and a **permanent render-path leak-scan test**.
3. **Rollout: incremental** — **v268** = chrome-complete (static + ternaries + guard + test);
   **v269** = interpolated step-prose templates + per-language names.
4. Marathon stays **paused**; re-run through the complete extraction afterward so queued languages are born
   complete.

## How translation resolves today (traced, app.js)
- `L(he,en)` (8587): `he`→he; `en`→en arg; fr/de/es/it→`dict[he]` if present **else the en arg**. So an
  `L` string is localized only if its Hebrew source is a key in the target dict.
- `t(he,fallback)` (8582): `dict[he] ?? fallback ?? he`.
- `itemName(m)` (8581): non-Hebrew → `m.eng` (English name, always).
- `he ? 'א':'b'` ternaries: no dict path — English for every non-Hebrew language.
- `data-mt` prose (descriptions): translated by `hydrateMT` from `{lang}.data.json` — **works today**, leave it.
- Dict = `lang/{code}.json` (chrome) + `lang/{code}.data.json` (prose), merged at build (`build.py:382-407`).

## Scope sizing (measured in app.js)
`L(` 1612 occ (~800–1000 unique) · `L(\`` interpolated 73 · `t(` 196 · `he?'…':'…'` 116 · names ~279+cats ·
`data-mt` 70 (leave) · `data-i18n` 6.

---

## Architecture

### A1 — Auto-extractor (`scripts/i18n-extract.mjs`)
Parse `app.js` with a JS parser (acorn) and collect every **static** call:
- `L(strLit, strLit)` → emit `{he: arg0, en: arg1}`.
- `t(strLit, …)` → emit `{he: arg0, en: arg0}` if no en is known (t has no en arg; en falls back to he — but
  these keys usually already have data-mt/en coverage; flag any with no en).
- Skip calls whose first arg is a template literal or non-literal (those are the interpolated/dynamic set,
  handled by A2/A3).
Output `lang/_extracted.json` = `{ "<he>": "<en>" }` (deduped). This is the **canonical chrome key set**.
Because each `L` call carries its own English, **en is free** — no en translation needed.

### A2 — Interpolated templates: new `Lt(heTpl, enTpl, params)` helper (v269)
```js
function Lt(heTpl, enTpl, params){
  const s = L(heTpl, enTpl);                 // dict lookup by the TEMPLATE string (the key)
  return s.replace(/\{(\w+)\}/g, function(_, k){ return (params && params[k]!=null) ? params[k] : '{'+k+'}'; });
}
```
Refactor the 73 interpolated `L(\`…${x}…\`, \`…${x}…\`)` → `Lt('…{x}…','…{x}…',{x})`. The template (with
`{placeholders}`) is the dict key; the extractor emits it like any static `L`. **Interpolated params —
which include every temperature/duration — are substituted at runtime and never enter the dict or the
translator.** Param values that are themselves words (wood, coal) are pre-translated via `t(...)` at the
call site, exactly as today.

### A3 — Ternary refactor (v268 where literal, v269 where computed)
- Literal-both-sides `he ? 'א' : 'b'` → `L('א','b')` (mechanical, extractor picks it up).
- Computed `he ? heVar : enVar` (e.g. `he?slotHe:slotEn`): make the SOURCE dict-aware — replace the two
  variables with a single `t('<he source>')` (or `L`) so one localized value flows. Enumerated per site in
  the plan (a minority of the 116; the plan lists each).

### A4 — Names (v269)
`itemName(m)` non-Hebrew branch → `t(m.heb, m.eng)` (dict lookup by Hebrew name, English name as fallback).
Category/cut/make names likewise. Add the Hebrew names to the extracted key set so the pipeline translates
them per language. Keeps `m.eng` as the guaranteed fallback (never blank).

### A5 — Translation pipeline
Feed `lang/_extracted.json` (he→en pairs) to the existing bulk pipeline in **English-pivot** mode (§10.19),
producing `{he: <target>}` per language, gated by the safety-lexicon. Merge into `lang/{code}.json`. Run on
the local GPU (`translategemma:27b`, ~$0). Existing good translations are preserved (merge, don't clobber).

### A6 — Build-time coverage guard (`build.py`)
After assembling `I18N_DICTS`, for each **active** language (en/fr/de/es/it now; queued langs as they land):
- every key in `_extracted.json` MUST exist in the merged dict, and
- `dict[key]` MUST differ from the Hebrew source **unless** the key is in `lang/_i18n-allow-identical.json`
  (legitimate loanwords/proper nouns: Picanha, Kebab, Sous-vide, brand names).
Any violation **fails the build** (exit 1) and prints the offending keys+languages. This replaces the
misleading "% coverage" line. (For v268 the guard is scoped to the **static+ternary** key set; the
interpolated+name keys are added to the guard in v269 when their layers land — so the guard never demands
coverage of strings that don't yet exist as keys.)

### A7 — Permanent render-path leak-scan test (`tests/i18n-completeness.spec.ts`)
The audit diagnostic, productionized: for each active non-Hebrew language, render every major screen (home,
catalog, recipe detail ×2, equipment, work-plan, cart, woods, seasonings, ask, tools, about, help, prefs)
and assert **zero Hebrew-leak nodes** and **zero English-fallback nodes** (a Latin string identical to the
en render and not in the identical-allowlist). This is the consumer-level gate the audit proved necessary;
it runs in the normal suite. v268: assert on the chrome set (recipe step prose / names excluded via a
documented skip-list until v269 lands them, so the test tracks the shipped scope, not future scope).

## Safety invariance
No temperature, cure %, salt, safe value, or cook duration is ever a dictionary value — each is a runtime
interpolation param (A2) or already an LTR numeric island (L13). The translator only ever sees template
wording. The existing data-mt number-mangling guard remains for prose. §3.10 assertion: the leak-scan test
+ a targeted test that an `Lt` template's numeric params are byte-identical across languages.

## Phasing
**v268 (chrome-complete):** A1 extractor · A3 literal ternaries → L · A5 translate the static+ternary key set
to fr/de/es/it · A6 guard (static+ternary scope) · A7 test (chrome scope). Every button/label/panel/message/
dialog fully localized for the 5 languages. Recipe step prose + names still en-fallback (documented, tracked).
**v269 (prose + names):** A2 `Lt` + 73 interpolated refactors · A3 computed ternaries · A4 names · extend A5/
A6/A7 to cover the prose+name keys. Full localization complete.
**After:** re-run the marathon through A1→A5 so all 23 queued languages are born complete; each is added to
the A6 guard + A7 test as it ships.

## Out of scope
- `data-mt` description prose (already localized).
- The AI-runtime path / smoker lookup (separate track; owner providing EVAL-key access).
- Changing the translation model or the safety-gate design.

## Definition of Done (per phase, gated by §3 discipline)
- Extractor emits a deterministic key set; unit-checked on a known sample.
- Every refactored call renders byte-identical output in Hebrew mode (no Hebrew regression) — asserted.
- fr/de/es/it: leak-scan test = 0 leaks on the phase's scope; screenshots at 390×844 looked at.
- Build guard fails on a seeded missing key (RED), passes when filled (GREEN) — both witnessed.
- Safety invariance asserted (numbers identical across languages).
- Full suite green (plain `npx playwright test`), diag/temp specs removed.
- Live-verify per §10.10 + real-AI/production-verified per owner (ship ≠ production until verified).
