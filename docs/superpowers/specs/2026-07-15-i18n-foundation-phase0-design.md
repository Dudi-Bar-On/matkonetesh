# i18n Foundation (Phase 0) — Design Spec

**Date:** 2026-07-15
**Status:** Approved direction (owner chose "i18n Foundation first") → ready for implementation plan
**Precedes:** Equipment 2.0 (Phase 1). Backs the audit in `docs/i18n-audit-2026-07-15.md`.
**Discipline:** heavy pre-customer development, no backward-compat burden; always verify **Hebrew AND English** (English = the generic non-Hebrew locale, not special); regression-test → fix → 100% DoD.

## 1. Why (from the audit)
- `L(he, en)` (app.js:5086) is a **hard 2-language switch** used at **~1,333 sites** — it never consults the dict, so fr/de/es fall back to English everywhere.
- `aiJSON`'s `outLang` (app.js:3249-3250) **hardcodes "write in ENGLISH" for any non-Hebrew language** → AI features are English-only for fr/de/es.
- **~20 hardcoded Hebrew `toast()` strings** bypass i18n entirely → permanently Hebrew even in English mode ⇒ English is **not** truly 100%.
- **No coverage tooling** → rewording a Hebrew string silently orphans its dict key in every language.

Fixing these now — before Equipment 2.0 adds ~40 more strings — makes new features multi-language-ready **by construction** and fixes live English bugs.

## 2. Goals
1. Make `L()` **dictionary-aware for fr/de/es** *without changing shipped Hebrew or English behavior*.
2. Fix `aiJSON` `outLang` to target the **actual** language.
3. Route the **~20 hardcoded Hebrew toasts** through `L()` (fixes English now, dict-extensible later).
4. Add a **build-time i18n coverage check**.

## 3. Non-goals (deferred)
- Full semantic-keyed i18n rewrite (Hebrew-string-as-key stays).
- Collapsing the ~10 duplicate binary helpers (`itemName`/`kindLabel`/…) — opportunistic, not required here.
- Removing the dead `data-i18n="..."` markup — opportunistic.
- **Authoring** the fr/de/es dictionaries — a separate translation effort. Phase 0 makes them *possible*, it does not fill them.

## 4. Changes

### Change 1 — `L()` becomes dict-aware (the keystone)
Current (app.js:5086): `function L(he,en){ return getLang()==='he'?he:(en!=null?en:he); }`
New:
```js
function L(he,en){
  const l = getLang();
  if(l==='he') return he;
  if(l==='en') return en!=null ? en : he;                 // shipped English: inline arg wins → ZERO regression
  const d = getDict();                                     // fr/de/es: prefer the per-lang dict, keyed by Hebrew source
  return (d && d[he]!=null) ? d[he] : (en!=null ? en : he); // fall back to English, then Hebrew
}
```
**Rationale / safety:** Hebrew and English paths are byte-for-byte unchanged (English keeps using the curated inline `en` the ~1,333 sites already pass). Only fr/de/es route through `getDict()[he]`, so **every `L()` site becomes localizable by adding `"<hebrew>": "<translation>"` to `lang/<code>.json` — no per-site code change**. This is the single change that lifts the 2-language ceiling.

### Change 2 — `aiJSON` `outLang` targets the real language
Current (app.js:3249-3250): non-`he` `outLang` emits "…in ENGLISH."
New: interpolate the target language name from the existing `LANGNAME` map (app.js:5156, `{en,ar,ru,es,fr,de}`) → `LANGNAME[outLang] || 'English'`. Confirm AI callers pass `outLang: getLang()`. Apply the same target-language fix to `vcBuildAskPrompt`'s branch (app.js:4104-4120) if low-risk; otherwise note as an immediate follow-on.

### Change 3 — route hardcoded Hebrew toasts through `L()`
Wrap each hardcoded Hebrew `toast()` (audit list: app.js 668, 1368, 2360, 2381, 2450, 2479, 2554, 3591, 4158-4194, 4824-4837) in `L('<he>','<en>')` — correct in English immediately, dict-extensible for fr/de/es. Interpolated parts (item names) route their data through `t()` where applicable. Watch the known gotchas: apostrophes inside `L('…')` and literal `״` (per memory `i18n-english`).

### Change 4 — build-time i18n coverage check
Add to `build.py`: for each `lang/<code>.json` (non-he), print **coverage %** vs the `en.json` key set and a list of **orphaned keys** (present in a lang file but absent from `en.json`). Non-fatal (warning line), so it informs every build without blocking, and catches silent orphaning going forward.

## 5. Behavior / data flow
- **Hebrew:** unchanged. **English:** visually unchanged *except* the ~20 toasts now render English.
- **fr/de/es:** any `L()` string whose Hebrew key exists in `lang/<code>.json` now localizes; unfilled keys fall back to English (as today). AI output follows `getLang()`.
- **Error handling:** `getDict()` empty/missing → `L()` falls back to `en` → `he` (never throws). Unknown `outLang` → `'English'` default.

## 6. Testing (Playwright: Hebrew AND English, plus a French smoke)
- **HE:** full suite green (Hebrew `L()` branch untouched); exhaustive Hebrew render shows no English leaks.
- **EN:** exhaustive English sweep = **0 Hebrew leaks, including the previously-hardcoded toasts** (force-show each by seeding the state that triggers it — per the v189 "hidden elements escape the sweep" lesson) → verifies Change 3.
- **FR smoke:** seed a couple of known `L()` Hebrew strings into `lang/fr.json`, set `mk-lang='fr'`, assert those render French and an unfilled one falls back to English → verifies Change 1's dict path.
- **outLang:** inspect the prompt `aiJSON` builds for `outLang:'fr'`/`'de'` — contains the target language name, not "ENGLISH" → verifies Change 2.
- **Coverage check:** runs and prints during `python build.py` (smoke).
- `node --check app.js` clean; **full suite green ×2**.

## 7. Definition of Done (100%)
- [ ] `L()` dict-aware per §4.1; Hebrew + English behavior provably unchanged (sweep).
- [ ] `aiJSON` `outLang` names the target language; callers pass `getLang()`.
- [ ] All ~20 hardcoded toasts routed through `L()`; English sweep shows them translated.
- [ ] Build coverage check prints per-language coverage % + orphans.
- [ ] New/updated tests (HE+EN sweep incl. forced toasts + FR smoke + outLang assertion); suite green ×2; `node --check` clean.
- [ ] Reviewed (self + code-review pass) and fixed; verified with real clicks in HE + EN.
- [ ] Shipped as vNNN (commit + tag + push).

## 8. Downstream
Equipment 2.0 (Phase 1) is then authored on top: its UI strings use the now-dict-aware `L()` (fr/de/es-ready by construction), and its AI device-spec helper localizes via the fixed `outLang`.
