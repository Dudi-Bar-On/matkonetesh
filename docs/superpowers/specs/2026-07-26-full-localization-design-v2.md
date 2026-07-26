# Full localization (offline dictionary) — design **v2 → v3-amended**

**Status:** spec, **v3** (v2 amended in place to resolve the v2 review's APPROVE-WITH-FIXES — C-1, C-2,
I-A..I-E, M-1..M-6; changelog in **§19**). v1 left in place at `2026-07-26-full-localization-design.md`.
**Origin:** the v267 real-UI audit (`docs/analysis/2026-07-26-v267-ui-audit-phase1.md`) — fr/de/es/it render
~550 strings/language in **English** because the app is he/en-bilingual *in code* and fr/de/es/it are only a
dictionary overlay over the explicitly-keyed subset. The "99% coverage" metric measured `fr.json ÷ en.json`
keys and was blind to every inline `L(he,en)`, `he?x:y`, `_EN` table, name, and toast.
**This spec is a design only — no production code changes.** All line numbers below were re-confirmed against
`app.js` at HEAD.

## Goal (unchanged)
Every user-facing string renders in the active language — offline, instantly, no English fallback — for
en/fr/de/es/it now and every queued language after. Safety numbers can never be altered by translation.

## The v2 thesis (owner's simplification mandate)
Collapse the ~8 leak mechanisms into **one canonical entry** through which all UI text flows, plus a
**build-time extractor that is the single source of truth for the key set**, plus **three build guards** so
that **a user-facing string not present in the dict for an active language cannot reach production — the
build fails.** Two things the build cannot see (a brand-new inline Hebrew literal a dev forgets to route
through `L`; an AI/prose path) are caught by an instrumented, state-driving render-path test. Simpler and
safer, not clever: the change is *fewer* mechanisms, each guarded by construction.

---

## 1 · Changes from v1 (each finding → resolution)

| Finding | v1 status | v2 resolution |
|---|---|---|
| **C1** build-time numeric safety guard | Absent — v1 relied on templating numbers out of strings; but safety numbers live *inside* translatable `L` strings (2651, 2666, 10323, 10881) and would ship unguarded on the chrome path | **§4.3 Guard B** (C-1 + **S-1**): build.py fails if a translated dict value's **unit-token-preserving** number-set drifts from its Hebrew source-key's — a **Python port of `vcTransSafe`/`vcNumPairs`/`VC_UNIT_CLASS` (8655-8679)**, **extended (S-1) with magnitude-specific sub-classes** (`tempC`/`tempF`, `massG`/`massKg`, `timeMin`/`timeHr`/`timeDay`) so a **within-class** swap is caught (`71°C→71°F`, `2.5 g/kg→2.5 kg` = a 1000× cure error, `יום↔דקה`) as well as the cross-class swap (`ppm→%`) and any digit change — **fail-closed** on any unclassifiable unit. (The coarse port alone did **not** catch `°C→°F`; that over-claim is corrected.) **Residual:** a source with a genuinely unspecified unit (`68 מעלות`, no C/F) stays coarse/tolerant. Safety numbers in `L` strings are covered whether or not templated out. |
| **C2** extractor blind to `_EN` tables / expr-arg / concat | v1 A1 extracted only static `L(strLit,strLit)`; the 9 `_EN` tables, ~48 `L(x.he,x.en)` expr-args, 11 concat-`L`, and the design's own `SMOKER_TIPS_EN` example (1090→1100) were never in scope | **§3 extractor harvest modes 2-4** bring every one into the key set (parallel-he/en-object harvest subsumes `_EN` tables + expr-args; concat-`L`→`Lt` in v269). **§5 KNOWN-vs-COVERAGE** stated explicitly: extractor output = KNOWN set, the **leak-scan test = the real COVERAGE gate**. |
| **C3** 56 raw Hebrew `toast()` | Not addressed | **§7**: `toast()` **already** dict-localizes (`tr(msg)`, 3540-3541) — the gap is that the Hebrew toast literals are never extracted. Extractor harvest mode 3 captures `toast(strLit,…)` first-args + the default `'בטל'` action label → they land in the dict, get translated, and the existing `tr()` renders them. No new path. |
| **I1** homograph key-collisions | Not addressed | **§6**: optional 3rd arg `L(he,en,ctx)` → compound key `he␟ctx` (U+241F sentinel) for the ~31 colliding chrome senses; data names get a dedicated `__names__` namespace so a recipe named 'אש' can't collide with chrome fire/heat. Extractor dedup keys on the compound key, so no silent sense-collapse. |
| **I2** leak test visits 13 screens, not states | v1 A7 rendered a static screen subset | **§8**: the test **drives into states** (recipe-under-insufficient-gear panel via the REAL auto-resolve path, edit forms, a wizard, event planner, a fired toast, language-switch-while-recipe-open), scans attributes + text, and **names residual uncovered surface honestly**. |
| **I3** deterministic fallback detection | v1 A7 compared fr-render to en-render + an unbounded identical-allowlist | **§8.2**: instrument `L()` with a `window.__i18nTrace` hook that records the *actual* English-fallback branch. Test asserts the trace is empty minus a small curated **loanword** allow-list. No string-diffing, no per-string blinding. |
| **I4** "en is free" is false for `t()`; attributes/units | v1 A1 said "en is free"; attributes/units unstated | **§3.2 + §9**: single-arg `t(he)` leaks Hebrew in English (getDict non-null for en, 8580); en therefore joins the translate scope for the t-set, and every `t()` must carry a real English arg. Attributes (`placeholder`/`aria-label`/`title`) and unit glyphs (`__units__`) are in extractor + guard + test scope; the test scans attributes (tnode already does, 8612). |
| **I5** Italian AI → English; LANGNAME | Not addressed | **§10**: add `it` (and other active langs) to `LANGNAME` (8571); fix the `||'English'` default (5498) and `||lang` default (8695). AI-reply + TTS-voice locale coverage stated explicitly and phased (voice picker is he/en). |
| **Scoping** names into v268; two-literal ternary; 73 templates in v269 | v1 put names in v269 | **§11**: names → **v268** (mechanical, number-free) so the flagship recipe screen isn't a localized frame with an English title. Literal ternaries → `L('א','b')` v268. Computed ternaries → two-literal `L`/`t` v269. 73 interpolated `Lt` → v269, budgeted as surgery. |
| **Simplification** (owner ask) | v1 kept all ~8 mechanisms | **§2**: fold to one canonical `L`; delete the `_EN` tables; unify `t`≡`L` (v269); keep `data-i18n`/tnode as an ambient safety-net and `data-mt` separate (Chesterton). |

---

## 2 · Mechanism inventory — keep / fold / delete (Chesterton's Fence)

Every current mechanism, why it exists, and its fate. **Understand-before-remove is applied to each.**

| # | Mechanism | Why it exists (the fence) | Fate |
|---|---|---|---|
| 1 | `L(he,en)` (8587) | Generation-time i18n: recipe steps/prose are built by JS at render, not static DOM, so they need an inline function that picks the language; the `en` arg gives zero-regression English + a guaranteed fallback | **KEEP — canonical entry.** Extended to `L(he,en,ctx?)` for homographs. |
| 2 | `t(he,fallback)` (8582) | Dict-lookup label with a fallback — used where the call site has no distinct English literal | **FOLD into `L` (v269).** `t` becomes `const t = L` once every call carries a real English 2nd arg; single-arg `t(he)` is the deprecation target (it is the I4 leak). |
| 3 | literal ternary `he?'א':'b'` | Inline language switch that predates/duplicates `L` | **FOLD → `L('א','b')`** (literal: v268; computed: v269). |
| 4 | `getLang()==='he'?X:X_EN` over 9 `_EN` tables | A hand-built English lookup table parallel to the Hebrew table; convenient but never reaches the dict, so fr/de/es/it get English and the tables silently drift | **DELETE the `_EN` tables.** Harvest `{he:HEB[k], en:HEB_EN[k]}` into the key set; route the selector through `L`. |
| 5 | `data-i18n`/`-html`/tnode DOM-walk (8595-8613) | Translates the **static shell** by walking text nodes/attrs and matching Hebrew content against the dict — efficient for build-once HTML, keeps Hebrew in the markup | **KEEP — ambient safety-net.** Not a primary path. New strings must go through `L`; tnode remains to catch static Hebrew literals and to translate attributes/units. |
| 6 | `data-mt` async prose (8710) | AI machine-translation of **unbounded** DATA descriptions, numeric-guarded (8703), with an offline-dict short-circuit (8714) | **KEEP SEPARATE (Chesterton — brief says don't break it).** Document that it shares the numeric guard and the offline dict; it is out of the finite-dict scope. |
| 7 | `itemName(m)` → `m.eng` (8581) + category/cut/make names | Names live in DATA as heb+eng | **FOLD → dict `__names__` sub-map, resolved INSIDE `itemName`** (v268 mechanical; I-D). `itemName` reads `getDict().__names__[m.heb]` — **no** `L`/`t`/`ctx` call, **no** flat `he␟name` key. |
| 8 | raw `toast()` Hebrew (3537) | `toast()` already dict-localizes (`tr`, 3540); the Hebrew literals were simply never extracted | **FOLD via the extractor** (harvest mode 3). No new path. |

**Net result:** the primary path collapses from mechanisms {1,2,3,4,7,8} to **one function `L`** feeding **one
key set** (the extractor's output), with {5} an ambient net and {6} a separate guarded AI path. A UI string is
now *localized-by-construction* if it flows through `L` (or is harvested), and the build fails if its key is
missing for an active language.

**Migration / rollback note.** Every fold is mechanical and **Hebrew-mode output is byte-identical** before
and after (DoD §15.7 asserts it), so each is a self-contained, independently revertable commit with **no data
migration**:
- *Delete `_EN` tables* — migration: harvest the pairs (extractor mode 2) → translate → delete the table +
  rewrite the one selector site. Rollback: `git revert` restores the table; the dict keys it seeded are inert
  (harmless) if left. Chesterton-safe because the table was only ever a hand-built en lookup.
- *`t` ≡ `L` (v269)* — migration: give every `t(he)` a real English 2nd arg (extractor `needs-en` list is the
  worklist), then `const t = L`. Rollback: restore the old `t` body; call sites with a 2nd arg still work
  under the old semantics (`fallback` = the en arg), so rollback is safe at any point.
- *Homograph `ctx` / `__names__`* — additive (new optional arg, new dict sub-map); rollback drops the arg and
  the sub-map with no effect on 2-arg keys.
The **feature flag is the phase itself**: v268 ships the folds that are byte-identical in Hebrew and
build-guarded in the other languages; if any language's translation is not ready, Guard A fails the build
**before** ship — so a half-done fold cannot reach production, which is the rollback of last resort.

---

## 3 · The canonical entry + the extractor

### 3.1 `L(he, en, ctx?)` — the one function
- **he** — the Hebrew source, and the **dict key** (unless `ctx` is present).
- **en** — the shipped English, returned directly in en-mode (zero-regression) and used as the **guaranteed
  fallback** for any language whose dict lacks the key.
- **ctx** (optional) — homograph disambiguator (§6). When present the dict key is `he + '␟' + ctx`; the
  displayed Hebrew in he-mode is still `he` (L returns the `he` arg in he-mode, so nothing is stripped).

Runtime contract (design; the current L at 8587 is extended, not rewritten):
```
function L(he, en, ctx){
  const l = getLang();
  if (l === 'he') return he;
  const key = ctx ? (he + '␟' + ctx) : he;
  if (l === 'en') { if (window.__i18nTrace) __i18nTrace.push({key, en, lang:'en', hit: !!(getDict()&&getDict()[key])}); return en != null ? en : he; }
  const d = getDict();
  if (d && d[key] != null) return d[key];
  if (window.__i18nTrace) __i18nTrace.push({key, en, lang:l});   // real English-fallback event (I3)
  return en != null ? en : he;
}
```
The `__i18nTrace` read is a single `if` on an absent global in production (~free); it is only populated by
the test harness (§8.2). The `lang:'en'` record is **diagnostic only** (it carries `hit` = "does en.json hold
the key") and is **excluded from §8.2's emptiness assertion** — en never leaks via `L` (it returns the inline
`en` arg), so only the non-en `d[key]`-miss records can fail the leak test (C-2).

### 3.2 `t` and the "en is free" correction (I4)
Today `t(heb, fallback)` = `dict[heb] ?? fallback ?? heb`, and `getDict()` is **non-null for English**
(8580). So `t('שלום')` with no fallback, key missing from en, returns **Hebrew in English** — a leak.
- **v268:** the extractor emits every `t(...)` first-arg into the key set, and flags any `t(he)` with **no**
  English second arg (these must gain one, sourced from the call-site's parallel English or the harvest).
  **en is NOT free for the t-set** — en joins the translate + guard scope so the t-keys have real English.
- **v269:** `const t = L` — one function. Every `t` call now has `(he, en[, ctx])` and inherits L's
  English-fallback (never Hebrew) + trace instrumentation.

**`en.json` for the `L`-set is a build ARTIFACT, not hand-maintained (I-A).** For every `L(he, en)` site the
shipped English is the **inline `en` arg** (8590) — `L` never reads the dict in en-mode. So `en.json`'s `L`-set
entries are **generated from the extractor's `en` args**, and `en.json[key]` equals what `L` returns *by
construction* (today ~320 keys; the extractor's full `L`-set is ~800-1000). This scopes what Guard A's en pass
can meaningfully assert (I-A): see §4.2 — the en pass is **not** a rendered-string validator for the `L`-set
(comparing the artifact to itself is a tautology); its real job is the **`t(he)`-with-no-en case** (the
`needs-en` worklist), which is the actual I4 leak.

### 3.3 The extractor `scripts/i18n-extract.mjs` (Node + acorn, dev-time)
Parses `app.js` (AST, not regex) and emits `lang/_extracted.json` = `{ "<key>": "<en>" }`, deduped on the
compound key. **This file is committed.** It is the **KNOWN key set** — see §5 for why that is not coverage.
Four harvest modes:

1. **Static `L`/`t`.** `L(strLit, strLit [, strLit])` → `{ key: he[␟ctx] , en }`. `t(strLit, strLit)` →
   same. `t(strLit)` with no en → emit `{he: he, en: he}` **and record a `needs-en` warning** (I4).
2. **Parallel he/en object harvest — subsumes the 9 `_EN` tables AND the ~48 `L(x.he,x.en)` expr-args.**
   All 9 `_EN` tables enumerated and classified (I-B): **7 are flat objects** — `SMOKER_TIPS_EN`@1090,
   `KIND_LABEL_EN`@1287, `STAGE_LABEL_EN`@4288, `THEME_NAMES_EN`@8549, `FONT_NAMES_EN`@8550,
   `FONT_SCALE_LABELS_EN`@8551, `SHAPE_NAMES_EN`@8747 — and **2 are special shapes** that the flat `NAME[k]`
   pairing **misses** (`SPK_HEAT`@1311, `DONE_SCALES`@2964). Mode 2 handles three shapes:
   - **(a) Flat parallel objects.** `const NAME_EN = {k:en}` paired with `const NAME = {k:he}` (or an object
     literal with sibling **string-literal** `he:`/`en:`): emit `{he: NAME[k], en: NAME_EN[k]}` per shared key.
   - **(b) Array-of-pairs partner (I-B).** `SPK_HEAT = [[0,'😌 עדין'],…]` (1311) is an **array of `[key,heLabel]`
     pairs** whose partner `SPK_HEAT_EN = {0:'😌 Mild',…}` (1312) is an **object** — flat `NAME[k]` indexing does
     not fit an array. Harvest by iterating the array's pairs and joining on the pair's first element:
     `{he: pair[1], en: SPK_HEAT_EN[pair[0]]}`.
   - **(c) Nested / leaf-pair recursion (I-B).** `DONE_SCALES` (2964) / `DONE_SCALES_EN` (2970) are **2-level
     nested** (`{steak:{rare:'נא',…},…}` ↔ `{steak:{rare:'Rare',…},…}`). Recurse both trees in lockstep to the
     **leaf** string pairs, emitting `{he: leaf_he, en: leaf_en}` per matching leaf path.
   For every object literal with sibling string-literal `he:`/`en:` (PREHEAT 1106, DEVICE_FUEL, `cm()` catalog
   entries, `prop.opts`, makes, capability specs — the shapes behind `L(r.he,r.en)`@1121, `L(f.he,f.en)`@1149,
   `L(c.he,c.en)`@7800, `L(o.he,o.en)`@7849, `L(mk.uHe,mk.uEn)`@7808, etc.) emit `{he, en}`. After harvest the
   `_EN` tables are **deleted from source** and each selector `(getLang()==='he'?NAME:NAME_EN)[k]` becomes an
   `L`/`t` call over the seeded key (the SPK_HEAT/DONE_SCALES selectors — `heatLabel`@1313, `doneLabel`@2976 —
   resolve via the ctx keys from M-3 below).
   - **Allow/deny + table-homograph ctx (M-3).** Mode 2 harvests **UI-facing** tables only; an explicit
     **deny-list** excludes internal `{he,en}` config objects that never render, so the key set does not bloat
     with non-UI strings (new `_EN`/`{he,en}` tables default to harvest; the deny-list is the reviewed
     exception). A table leaf can also be a **homograph with no `L(…,ctx)` call site** to carry a hint — e.g.
     `DONE_SCALES.steak.rare = 'נא'` (2965), which is also the Hebrew word "please". To keep the §6 collision
     lint from false-tripping and the wrong sense from shipping, mode 2 emits such table homographs under a
     **table-scoped ctx** derived from the table/scale name (`'נא␟doneness'`), and the selector resolves through
     that same ctx key; non-homograph leaves stay bare-keyed.
3. **Toasts.** `toast(strLit, …)` first-arg → `{he, en}` (en supplied via harvest/translation; the
   extractor flags toast literals lacking English). Plus the default action label `'בטל'` (3541).
4. **Names (I-D — ONE scheme).** `itemName`/category/cut/make names → a nested dict **`__names__` sub-map**,
   keyed by `m.heb`, value = the translation (`en.json.__names__[m.heb] = m.eng`). This is **not** a flat
   `he␟name` compound key and **not** an `L`/`t` call — the sole consumer is `itemName` (§11), which reads
   `getDict().__names__[m.heb]` directly. The extractor emits the `__names__` sub-map; Guard A scopes
   `__names__.*`.

**Cannot be statically keyed** (handled by v269): concat-`L` (`L('לא נכנס ל'+slotHe+…)`, 11 sites incl.
safety numbers at 3975/3983) and template-literal-`L`. These become `Lt(heTpl, enTpl, params)` in v269 (§11);
the extractor emits the **template with `{placeholders}`** as the key.

---

## 4 · The three build guards (all in `build.py`, Python)

Rationale for Python: Cloudflare Pages builds with `python build.py` and has **no guaranteed Node** — so the
enforcement must be Python, reading the committed `lang/_extracted.json` (produced by the Node extractor
locally). The Node/acorn extractor never runs on Cloudflare. Staleness of the committed artifact is caught by
the test suite (§8.3), not the build.

Guards run after `I18N_DICTS` is assembled (build.py 382-408), for **each active language** (en/fr/de/es/it
now; queued langs as they land). Any violation → **`sys.exit(1)`** with the offending keys+languages printed.
This **replaces** the misleading `keys ÷ en keys` percentage line (406).

### 4.1 Guard A — coverage (the leak-proof-by-construction gate)
For every key in `_extracted.json` (scoped to the phase's layers — §11): the key **must exist** in the merged
dict for the language, and `dict[key]` **must differ** from the Hebrew source unless the key is listed in
`lang/_i18n-allow-identical.json` (legitimate loanwords/proper nouns: Picanha, Kebab, Sous-vide, brand names).
Missing or unexpectedly-identical → build fails. *This is the property "a string not in the dict for an active
language cannot ship."*

### 4.2 (folded into A) — for en specifically, **scoped honestly (I-A)**
en is an active language; the guard runs on it too — but what its en pass **can** assert is scoped by the fact
that **`en.json`'s `L`-set is a generated artifact** (§3.2): `en.json[key]` == the inline `en` arg by
construction, so requiring it to "exist and differ from Hebrew" for the `L`-set is a **tautology / artifact-
integrity check**, not a validation of the rendered English. The **meaningful** en enforcement (the real I4
case) is: every extracted **`t(he)` with no English 2nd arg** — the extractor's `needs-en` list — must acquire
one, and the en pass **fails the build while `needs-en` is non-empty**. So:
- **Do not red-fail en for the `L`-set** on an "identical to Hebrew" basis — its value is the inline arg (only
  genuine loanwords equal Hebrew, and those are on the allow-list).
- **Do not claim the en pass validates the rendered string** — it validates presence/`needs-en`, and the
  rendered truth for en (as for every language) is the §8.2 Hebrew-block DOM scan + non-en trace.
- The staleness gate (§8.3) is what proves `en.json` actually matches the current extractor output.

### 4.3 Guard B — numeric safety, **UNIT-TOKEN-PRESERVING** (magnitude-specific) — **C1 + S-1**

**History of this guard.** v1 mirrored the unit-**blind** `mtNumSig` (app.js:8642, `/\d+(?:[.,]\d+)?/g`),
which passes *any* same-digit change. **C-1** (v2 review) replaced it with a faithful **Python port of
`vcNumPairs`/`vcTransSafe` (8662-8679)** + `VC_UNIT_CLASS` (8655-8661): each number is paired with the
**CLASS of quantity** it carries, the multisets are compared **unordered**, and any unclassifiable unit
falls back to strict positional compare — **fail-closed**. That port catches a **digit drift**, a
**cross-class** swap (`156ppm→156%` — `ppm` and `pct` are *distinct* classes), and fails closed on the
unknown.

**S-1 (this safety re-review) — the ported classes are COARSE, and a within-class swap slips through.**
`VC_UNIT_CLASS` (8655-8661) buckets by quantity KIND, not magnitude: **`°C` and `°F` both → `temp`**,
**`דק`/`שע׳`/`יום` (min/hr/day) all → `time`**, **`g`/`kg` both → `mass`**. So a translation that keeps the
digit but swaps the unit *within* a class — `71°C→71°F`, `יום↔דקה`, `2.5 g/kg→2.5 kg` — produces the
identical `71:temp` / `2.5:mass` pair and **PASSES**. On a cure-salt dose `g↔kg` is a **1000× error**;
`°C↔°F` on a doneness floor is a food-safety failure. The earlier claim that Guard B "catches `°C→°F`" was
therefore **wrong for the coarse port** and is corrected throughout (§1 C1 row, §13.1, §18, §19). **Owner
decision (safety-first): STRENGTHEN Guard B to unit-token preservation.**

**The new rule.** For each number in the Hebrew **source key** that carries an **explicit** unit token, the
**same magnitude-specific unit** must be present on the corresponding number in the translated **value**, or
the build FAILS. The coarse classes are split into magnitude-specific **sub-classes** — `tempC`/`tempF`,
`massG`/`massKg`, `timeMin`/`timeHr`/`timeDay` — **only when the unit is explicit** (a C/F glyph or word;
`g`/`גרם`/`ג׳` vs `kg`/`ק״ג`; `דק`/`min` vs `שע`/`hr` vs `יום`/`day`), alongside the already-magnitude-distinct
`ppm`, `pct`, and `cm²` (`area`) / `cm` (`len`). Classification is **explicit-first, coarse-fallback**: a token
that names a magnitude gets the sub-class; a **generic** unit (bare `°`, Hebrew `מעלות` = "degrees" with no
C/F) gets the **coarse** class and stays **tolerant**; a genuinely unclassifiable unit stays `'?'` and **fails
closed**. The `?ctx` split of the key is dropped before classification (`key.split(SENT)[0]`), exactly as
before.

```python
# ── Guard B — numeric safety, UNIT-TOKEN-PRESERVING. Extends the ported app.js
#    vcNumPairs/vcTransSafe (8662-8679) + VC_UNIT_CLASS (8655-8661): the coarse classes
#    (temp/time/mass) split into MAGNITUDE-SPECIFIC sub-classes whenever the unit token is
#    explicit; a generic unit (bare מעלות/degrees) stays COARSE + tolerant; unclassifiable → FAIL CLOSED. ──
import re, sys

SAFETY_NUM = r'(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)'      # app.js:5329 (grouped-thousands OR decimal)

# Hebrew abbreviation marks: ASCII-quote(U+0022), gershayim(U+05F4), geresh(U+05F3), apostrophe.
# NOTE: the runtime VC_UNIT_CLASS@8660 uses ["׳'] and OMITS gershayim(U+05F4) — so the real token
# ק״ג does not classify at runtime (it fails closed). Guard B's port INCLUDES gershayim so the real
# tokens classify; the runtime omission is one item of follow-up T-GuardB-runtime (below / §17).
QM = "[\"״׳']"

# EXPLICIT sub-class patterns come FIRST; the GENERIC/coarse pattern of each family comes AFTER, so a °C
# classifies as tempC (not the bare-° coarse temp). Matched on the text AFTER the number. Tokens verified
# against the real safety L-strings (code points noted): 71°C @10881, ≈156ppm/2.5 ג׳/ק״ג @2651/2666,
# 68 מעלות @10323, 1 ס״מ / 24ש @2655.
VC_UNIT_CLASS = [
    # temperature — explicit Celsius / Fahrenheit FIRST, then GENERIC degrees (coarse → tolerant)
    (re.compile(r'^(?:°\s*C|C\b|celsius|צלזיוס)', re.I),          'tempC'),   # 71°C → °(U+00B0)+C
    (re.compile(r'^(?:°\s*F|F\b|fahrenheit|פרנהייט)', re.I),      'tempF'),
    (re.compile(r'^(?:°|מעלות|degrees?)', re.I),                 'temp'),    # 68 מעלות — no C/F → coarse
    # mass — kilogram, then gram, then generic/imperial
    (re.compile('^(?:ק' + QM + r'?ג|kg\b|kilos?)', re.I),         'massKg'),  # ק״ג → ק(U+05E7)+gershayim(U+05F4)+ג
    (re.compile('^(?:ג' + QM + r'?|גרם|grams?|g\b)', re.I),       'massG'),   # ג׳  → ג(U+05D2)+geresh(U+05F3)
    (re.compile(r'^(?:lbs?\b|pounds?)', re.I),                   'mass'),
    # time — minute / hour / day, each its own magnitude
    (re.compile('^(?:דק(?:ות|' + QM + r')?|minutes?|mins?\b)', re.I), 'timeMin'),
    (re.compile('^(?:שעות|שע' + QM + r'?|hours?|hrs?\b)', re.I),  'timeHr'),
    (re.compile(r'^(?:ימים|יום|days?)', re.I),                   'timeDay'),
    # already magnitude-distinct
    (re.compile(r'^(?:ppm)', re.I),                              'ppm'),
    (re.compile(r'^(?:%|אחוז|percent)', re.I),                   'pct'),
    (re.compile('^(?:ס' + QM + r'?מ\s*(?:²|2)|cm\s*(?:²|2))', re.I), 'area'), # cm² → ס(U+05E1)+gershayim+מ
    (re.compile('^(?:ס' + QM + r'?מ|cm\b)', re.I),               'len'),     # cm (bare — thickness)
]
COARSE = {'tempC': 'temp', 'tempF': 'temp', 'massG': 'mass', 'massKg': 'mass',
          'timeMin': 'time', 'timeHr': 'time', 'timeDay': 'time'}           # sub-class → coarse family
def coarse_of(c):
    return COARSE.get(c, c)                                                  # ppm/pct/area/len/temp/…/'?' → self

def safety_num_val(s):                                                       # app.js:5421 — strip commas, then float
    return float(s.replace(',', ''))
def vc_num_pairs(text):                                                      # app.js:8662 → [(value, class), …]
    s = str(text or ''); out = []
    for m in re.finditer(SAFETY_NUM, s):
        rest = re.sub(r'^[\s\-–]+', '', s[m.end():])                        # skip separators trailing the number
        cls = '?'
        for rx, c in VC_UNIT_CLASS:
            if rx.match(rest):
                cls = c; break                                              # first match wins → explicit before coarse
        out.append((safety_num_val(m.group(0)), cls))
    return out

def unit_ok(src_cls, val_cls):                                              # DIRECTIONAL: the Hebrew source governs
    if src_cls == val_cls:
        return True
    if coarse_of(src_cls) != coarse_of(val_cls):
        return False                                                        # different quantity kind → unsafe
    return src_cls == coarse_of(src_cls)                                    # source GENERIC → tolerate a specific glyph;
                                                                            # source EXPLICIT → translation must match exactly

def vc_trans_safe(src, translated):                                        # app.js:8672 — unordered, FAIL CLOSED
    a, b = vc_num_pairs(src), vc_num_pairs(translated)
    if len(a) != len(b):
        return False
    if any(c == '?' for _, c in a) or any(c == '?' for _, c in b):
        return a == b                                                       # any unclassifiable unit → strict POSITIONAL
    used = [False] * len(b)                                                  # match each source number to a DISTINCT
    def match(i):                                                           # translated number of EQUAL value and
        if i == len(a):                                                     # unit_ok class (N is tiny — 1-3 numbers)
            return True
        for j in range(len(b)):
            if not used[j] and a[i][0] == b[j][0] and unit_ok(a[i][1], b[j][1]):
                used[j] = True
                if match(i + 1):
                    return True
                used[j] = False
        return False
    return match(0)

# Run per active language over the CHROME dict only (the _extracted.json key set — M-2).
SENT = '␟'                                                             # ␟ ctx sentinel (U+241F)
fail = False
for code in ACTIVE_LANGS:                                                   # en/fr/de/es/it; queued langs as they land
    d = _i18n.get(code, {})
    for key, _en in _extracted.items():
        src_he = key.split(SENT)[0]                                        # the Hebrew source carries the numbers; drop ␟ctx
        val = d.get(key)
        if val is None:
            continue                                                        # missing key is Guard A's job, not Guard B's
        if not vc_trans_safe(src_he, val):
            print('[i18n:GuardB] %s / %r : numeric/unit drift  src=%r  val=%r' % (code, key, src_he, val)); fail = True
if fail:
    sys.exit(1)
```

This puts the safety numbers inside `L` strings (`≈156ppm`, `71°C`, `68 מעלות`, `2.5 ג׳/ק״ג`) under a **hard,
unit-token-preserving** build gate on the chrome path, which today has none.

**What is now caught vs the residual (stated honestly).**
- **Caught — new (S-1):** `71°C→71°F` (`tempC`≠`tempF`, the doneness-floor swap), `2.5 g/kg→2.5 kg`
  (`massG`≠`massKg`, the **1000× cure-salt error**), `יום↔דקה↔שעה` (`timeDay`/`timeMin`/`timeHr`).
- **Caught — already (coarse port):** a digit drift, a **cross-class** swap (`ppm→%`, `temp↔mass`), a count
  change, and any genuinely unclassifiable unit (fail-closed).
- **RESIDUAL — cannot be caught, named:** a source number whose unit is **genuinely unspecified** — e.g.
  `L('הבשר נתקע ב-68 מעלות','The meat stalled at 68 degrees')` at **app.js:10323**, where `מעלות`/`degrees`
  names *no* scale — is classed **coarse `temp`** and is **tolerant of both `°C` and `°F`** in the
  translation. Guard B **cannot pin C vs F when the Hebrew source itself does not.** This is a narrow,
  deliberate hole: the string is a diagnostic example (not a dose or a safety floor), and failing it would be
  a false positive against a legitimate `68 °C` rendering. The only fix is to make the Hebrew source explicit
  (`68°C`) — **never** to relax the guard. Listed again in `RESIDUAL-UNCOVERED` (§14).

**Tolerance / no false positives.** Because a *generic* source class tolerates a more-specific translation
glyph (`unit_ok` returns True when the SOURCE side is coarse), the common, safe pattern "Hebrew `68 מעלות` →
French `68 °C`" passes. An *explicit* source unit forces an exact sub-class match — and the chrome safety
strings overwhelmingly **keep the glyph** (`°C`, `ppm`, `%`, `g`/`kg`, `cm²`) across languages, so the match
is satisfied by construction, not by luck. A translation that legitimately reorders clauses still passes
(the compare is an unordered value+unit match, not positional) unless an unclassifiable unit forces the
fail-closed positional branch.

**Lexicon fidelity (verified against the real strings — codepoints checked, not assumed).** The sub-class
patterns match the *exact* tokens the safety `L`-strings use: grams `ג׳` = `ג`(U+05D2)+geresh(U+05F3); kg
`ק״ג` = `ק`(U+05E7)+**gershayim(U+05F4)**+`ג`(U+05D2); `71°C` = `71`+`°`(U+00B0)+`C`; `156ppm` = ASCII `ppm`;
`68 מעלות` = generic degrees (no C/F); cm `ס״מ` = `ס`(U+05E1)+gershayim+`מ`. The build port's mass/area/len
classes **include gershayim (U+05F4)** so `ק״ג`/`ס״מ` classify — closing a real hole in the runtime original
(§4.3 header note; folded into follow-up T-GuardB-runtime). The `24ש` (bare `ש`=hours) / `24h` (bare `h`) at
2655 are deliberately **left unclassified** (fail-closed, positional) rather than risk a bare-letter false
match; harmless because both sides are `'?'` and compare equal positionally.

**Deliberate divergence + FOLLOW-UP (do not weaken anything).** Guard B is **intentionally STRICTER than the
runtime `vcTransSafe` (8672)**: the runtime still buckets coarsely (a within-class swap passes at runtime),
and its mass regex omits gershayim. Build-time strictness is chosen because the build is the single point
where a whole language's dict is validated before ship, and a within-class swap there is catastrophic
(1000× dose / wrong safety floor). This asymmetry is logged as a named follow-up, **not** a silent gap and
**not** a weakening:
> **FOLLOW-UP · T-GuardB-runtime** (out of v268/v269 scope — named, not deferred-silently): harden the
> runtime `VC_UNIT_CLASS`/`vcTransSafe` (8655-8679) with the same magnitude-specific sub-classes **and**
> gershayim(U+05F4) coverage, and point the DATA/`data-mt` guard (`mtGuard`→`mtSafe`→`mtNumSig`, invoked at
> **8703**) at the strengthened `vcTransSafe` — it is still `mtNumSig`-only, fully unit-blind. Both are
> pre-existing hazards on the DATA/voiced paths, tracked in §17. The build guard leads; the runtime follows.

- **Fail-closed → the lexicon is extended, not weakened (as C-1 requires).** An **unknown unit fails the
  build**: a translated number whose unit `VC_UNIT_CLASS` cannot classify (e.g. a target-language word-unit
  like French `degrés`, German `Grad`, not yet in the lexicon) forces strict positional compare and, against
  a Hebrew source classified as `temp`, mismatches → RED. This is intentional: the fix is to **extend
  `VC_UNIT_CLASS`** with the target-language unit tokens (adding them to the correct magnitude-specific
  sub-class — e.g. `celsius`/`צלזיוס`→`tempC`) or keep glyph units `°C`/`min`/`kg`/`%`/`ppm`/`cm²` in the
  translation (which the chrome safety strings overwhelmingly already do, and which are all classified
  today), **never** to relax the guard. The lexicon can grow safely because the default is *fail*, not *pass*.
- **Scope (M-2): `_extracted.json` chrome keys only.** Guard B covers the finite chrome dict. The `.data.json`
  bulk prose (item descriptions) is the async `data-mt` path and stays **runtime**-guarded by the existing
  `mtGuard`/`mtSafe` at 8703 — Guard B does not (and is not meant to) re-check it at build time. Hardening
  that runtime path is follow-up T-GuardB-runtime.
- **Fraction glyphs (M-6).** `SAFETY_NUM` does not match a vulgar-fraction glyph (`½`, `¼`) and reads `1/2` as
  the two numbers 1 and 2, so a `½`↔`1/2` swap across languages would surface as a mismatch. **Harmless today**
  — no chrome safety `L`-string carries a fraction glyph (the safety numbers are `71°C`/`156ppm`/`2.5 kg`/
  `68 מעלות`-shaped). Noted as a known edge of the numeric mirror; if a fraction ever enters a safety string,
  normalize it (`½`→`0.5`) before the signature compare.
- **Templated-out numbers pass trivially.** Numbers refactored into v269 `Lt` runtime `{params}` never enter
  the dict, so they are not Guard B's concern; Guard B covers the residual literal-number strings that remain
  dict values.

**Pre-existing, out of scope (noted, not fixed): the DATA-path and runtime guards are also unit-imprecise.**
The runtime `data-mt` gate at 8703 uses `mtGuard`→`mtSafe`→`mtNumSig` — the same unit-*blindness* Guard B
fixes for the chrome path — and even the runtime `vcTransSafe` (8672) that guards the voiced/verify path is
**coarse** (a within-class `°C↔°F`/`g↔kg` swap passes there) with the gershayim gap noted above. They are the
DATA/voiced paths, out of this spec's scope; flagged here (and §17) as pre-existing hazards under **follow-up
T-GuardB-runtime**, not repaired by v2.

### 4.4 Guard C — placeholder-set equality (v269, for `Lt` templates)
For every template key/value pair, the set of `{name}` placeholders in the value **must equal** the set in the
Hebrew source. A translation that dropped `{temp}` or invented `{x}` fails the build. (No-op in v268 — no
templates in the dict yet.)

### 4.5 Guard D — call-site structural signature — **the real enforcement boundary (I-E)**
**The honest boundary, stated (I-E).** build.py reads the **committed** `lang/_extracted.json`; the Node/acorn
extractor **never runs on Cloudflare** (`python build.py` alone, no guaranteed Node). So a dev who edits an
`L` string — or adds an `L`/`t`/`toast` call site — and forgets to regenerate the artifact would pass the
Cloudflare deploy build and **ship a leak**; only the local suite (§8.3) catches it. "The build fails" was
therefore an overclaim. Two layers make the boundary real, and the spec states exactly what each catches:

1. **Guard D (Cloudflare-side, Python, no acorn).** build.py computes a **cheap structural signature** of
   app.js's localization call sites — a regex pass counting `\bL\(`, `\bt\(`, `\btoast\(` and hashing (sha1)
   the sorted list of their **static string-literal args** (the `'…'`/`"…"` first/second args the extractor
   keys on). The Node extractor writes this identical signature into `lang/_extracted.json` as `"__sig__"`
   when it regenerates. If build.py's freshly-computed signature ≠ the committed `__sig__`, **`sys.exit(1)`**:
   the artifact is stale vs the call sites. This runs at deploy time on Cloudflare.
   - **Honest guarantee:** Guard D is a **structural** signature (call-count + literal-arg hash), **not** a
     full AST re-extraction. It catches an added/removed/renamed call site or an edited string literal; a
     change preserving the exact literal-arg multiset but altering semantics could pass Guard D.
2. **The suite is the authority (hard pre-deploy gate).** `npx playwright test` includes §8.2 (the leak scan)
   **and** §8.3 (the exact staleness gate: re-run the full acorn extractor, deep-equal the committed artifact).
   This is stated as a **required release step** — no deploy without a green local/CI suite on the committed
   HEAD. Guard D is the defense-in-depth backstop for the Cloudflare-only path; the suite is the complete
   check. **The spec does not claim `python build.py` alone proves coverage.**

---

## 5 · KNOWN vs COVERAGE — stated so it is never conflated again (C2)
- `_extracted.json` (Guard A) proves the **KNOWN** keys are translated. It is **not** coverage: it cannot see
  a Hebrew literal a developer wrote inline and forgot to route through `L`, nor an AI/prose path.
- **Coverage is proven only by the render-path leak-scan test (§8)**, which drives the real app and asserts
  zero Hebrew-leak nodes and zero real English-fallback events. "Extractor emitted N keys" is **never** a
  coverage claim. The two gates are complementary: Guard A is fast and total over the known set; the test is
  the consumer-level truth the audit proved necessary.

---

## 6 · Homograph disambiguation (I1)
~31 Hebrew keys carry 2-3 English senses (אש = fire/heat, יעד = target/goal, עישון = smoking ×3). One
`{he:en}` dict entry ⇒ one translation for all senses ⇒ the wrong sense ships, and the extractor's dedup
silently picks one.

- **Chrome:** optional 3rd arg `L(he, en, ctx)` → compound key `he␟ctx` (`␟` = U+241F UNIT SEPARATOR, which
  never appears in copy). `L('אש','Fire','fire')` and `L('אש','Heat','heat')` yield distinct keys → distinct
  dict entries → distinct translations. Only the ~31 colliding sites take a 3rd arg; everything else stays
  2-arg. The translation pipeline sees `he␟ctx`; the human/model translates the `he` portion with `ctx` as a
  hint comment.
- **Bare-key retention (I-C) — REQUIRED for the tnode static path.** tnode/applyI18n (8604-8612; 59
  `data-i18n` sites) key static-shell text nodes **and** attributes by the **bare visible Hebrew**
  (`d[k]`, k = raw trimmed text, 8606-8607/8612) — tnode can **never** synthesize a `he␟ctx` key. So the `␟ctx`
  split is **additive over the `L()` path only**: the **bare `he` key is KEPT** in every dict, carrying the
  **most-common sense**, so a homograph that also renders as static shell text (or an attribute) still finds
  `d['אש']` and does **not** leak Hebrew in fr/de/es/it. The extractor therefore emits, for each ctx'd
  homograph, **BOTH** the bare `he` key (most-common sense, its `en` = the primary sense's English) **and** the
  `he␟ctx` keys (per sense). *(If a future audit proves a given homograph word never renders via tnode — only
  ever through `L(…,ctx)` — its bare key may be dropped; until proven, keep it. State which per word.)* The
  collision lint (below) still fires when two sites supply different `en` for the same bare `he` **without** a
  `ctx`; a site that DID pass `ctx` contributes to `he␟ctx`, and the bare key takes the designated primary
  sense.
- **Names vs chrome namespace (decided; the ONE names scheme — I-D):** data names live under a dedicated dict
  sub-map `__names__` (keyed by `m.heb`), **resolved directly by `itemName`** (`getDict().__names__[m.heb]`,
  §11) — **physically separate** from chrome keys, and **not** a flat `he␟name` key and **not** an `L`/`t`
  call. A recipe named 'אש' can never collide with the chrome fire/heat entries. This resolves I-D (the v2
  draft contradicted itself — §6 said `__names__` while §3.1/§11 implied a flat `he␟name` via `L`; the flat
  scheme is dropped) and answers A4's collision risk from the brief.
- Extractor: emits `he␟ctx` and `__names__.*` as distinct keys; a **collision lint** fails extraction if two
  call sites share a bare `he` key but supply different `en` values without a `ctx` (surfacing an
  unnoticed homograph as an error, not a silent pick).

---

## 7 · Toasts (C3)
`toast()` (3537) already runs `tr(msg)` = `getDict()[msg] ?? msg` (3540-3541), so a toast is localized the
moment its Hebrew string is a dict key. The 55 raw-Hebrew toasts render Hebrew only because those strings were
never extracted. Resolution is pure coverage:
- Extractor harvest mode 3 captures every `toast(strLit,…)` first-arg + the default `'בטל'` label → they
  enter `_extracted.json` → Guard A forces their translation → `tr()` renders them. **No new mechanism.**
- Toasts fired after `applyLang` are covered because `tr()` reads the current dict at fire time (not a
  one-shot DOM scan) — the exact reason a static screen scan never caught them.
- The state-driving test **fires at least one toast per language** (§8) so the path is exercised, not assumed.

---

## 8 · The permanent render-path leak-scan test (I2, I3, I4)
`tests/i18n-completeness.spec.ts`, runs in the normal suite (plain `npx playwright test`), 390×844. For each
active non-Hebrew language:

### 8.1 Drive into STATES, not just screens (I2)
Beyond the 13 screens, the test performs the interactions that render the worst leaks — using the **real**
paths (no `setItemCooker` shortcut; the audit Finding 2 proved shortcuts mis-measure):
- Open a recipe **under an insufficient kit** (seed a single-insufficient-gear equipment set) → the cooking
  plan + the "⚠ cannot be cooked with your equipment" panel + capability reasons.
- Open at least one **edit form** and one **wizard** (the equipment add wizard).
- Open the **event planner**.
- **Fire a toast** (e.g. save an entity) and scan it while shown.
- **Switch language while a recipe panel is open** (exercises `_mkMethodRepaint`, 8630, and the step
  regenerator).
Assertions are on **rendered state**. Any state the test does not yet drive is listed in a
`RESIDUAL-UNCOVERED` block in the spec file header and the test's top comment — **stated honestly**, never
implied as covered.

### 8.2 Deterministic fallback + Hebrew-leak detection (I3) — **GREEN-in-v268 corrected (C-2)**
- Before driving, the harness sets `window.__i18nTrace = []`. `L()` (and `t`≡`L` in v269) pushes a record on
  the real English-fallback branch (§3.1); in **en-mode** it also pushes a **diagnostic** record tagged
  `lang:'en'`. **The emptiness assertion ignores the `lang:'en'` records (C-2 fix (1)):** en returns its
  inline `en` arg by construction (§3.2), so a `lang:'en'` record is never a leak — en's correctness is proved
  by Guard A + the Hebrew-block DOM scan below, not by the trace. (Equivalently, `L()` could push only the
  real dict-miss on non-en; we keep the en record for diagnostics and filter it here.) After each driven state,
  assert the trace **filtered to non-en fallback records, then minus the loanword allow-list
  (`lang/_i18n-allow-identical.json`), then minus the phase-scoped deferred set (`lang/_i18n-deferred.json`)**
  is **empty** — a *deterministic* signal of an untranslated key, not a fr-vs-en string heuristic.
- **Phase-scoped DEFERRED exclusion `lang/_i18n-deferred.json` — DISTINCT from the loanword allow-list (C-2
  fix (2)).** v268 knowingly defers the 73 interpolated templates + 11 concat-`L` (§11). In v268 these still
  hit `L`'s English-fallback branch at runtime — their runtime `he` arg is a **data-interpolated** string that
  is not a dict key — and the **REQUIRED** insufficient-kit state (§8.1) drives straight through them: the
  conflict lines at app.js:3970-3986 ARE this concat-`L` set (~84 legitimate v268 fallbacks). A loanword
  allow-list (single words) cannot absorb full-sentence fallbacks. `_i18n-deferred.json` holds the
  extractor-emitted **template keys** for these sites (with `{placeholders}`, §3.3). The test compiles each
  into an **anchored regex** (`{name}` → `[\s\S]*?`, all literals escaped) and drops any trace record whose
  interpolated `key` matches — subtracting *exactly* the deferred templates and nothing else, so a new,
  unrelated leak still fails. **Honest trade (stated):** in v268 these keys are knowingly English, enumerated
  in `_i18n-deferred.json` **and** `RESIDUAL-UNCOVERED` (§14). The list is **non-growing** and **shrinks to
  empty by end of v269**: as each site becomes `Lt`, its template key enters the dict, is translated, `d[key]`
  hits, no fallback is pushed, and the deferred entry is removed. When the file is empty the gate is
  `trace(non-en) − loanwords == empty` with **no** deferral — the v269 end-state. So the v268 assertion is
  exactly `trace(non-en) − loanwords − deferred == empty`, and it can go GREEN.
  *(Computed-ternaries (`he?heVar:enVar`, folded only in v269) render the English var **directly**, bypassing
  `L`, so they never enter the trace at all — they show English-not-target, invisible to the trace and passing
  the Hebrew-block DOM scan trivially. They are tracked in `RESIDUAL-UNCOVERED`, not in the trace-deferred
  regex set, because there is no trace record to subtract.)*
- **Hebrew-leak:** walk text nodes **and** `placeholder`/`aria-label`/`title` attributes (tnode already
  touches these, 8612) and assert **no** `[֐-׿]` (Hebrew block) content in any non-Hebrew language —
  except inside a documented `dir="ltr"` numeric island or the language-picker native-name row (flagged for
  owner confirmation per audit Finding 4).
- The curated allow-list is **loanwords only** (Picanha/Kebab/Sous-vide/brand names) — small, reviewed, and
  it no longer blinds the test to regressions per-string (the trace flags the *branch*, so an allow-listed
  loanword that later gains a real translation still passes, and a newly-missing key still fails).

### 8.3 Extractor staleness gate
A spec (`tests/i18n-extractor.spec.ts` or a step in the above) **re-runs the extractor** and asserts its
output deep-equals the committed `lang/_extracted.json`. This closes the gap that build.py cannot run acorn:
if `app.js` gained/changed an `L` key without regenerating the artifact, the suite goes red.

### 8.4 Units (I4)
Assert equipment-screen unit glyphs render as `cm²`/`L` (not `ס״מ²`/`ל׳`) — the `__units__` interpolation
(8600) must have the relevant unit entries in each dict; they are in Guard A scope.

---

## 9 · Attributes & units (I4)
- **Attributes:** raw Hebrew `placeholder`/`aria-label`/`title` (e.g. `placeholder="יעד 94°…"`,
  `aria-label="סגור"`) are translated by tnode (8612) **if** their Hebrew is a dict key. v268: the extractor
  harvests attribute literals from the HTML-building template strings where they are statically present, and
  the test scans attributes (§8.2). Any attribute built via `L(...)` is already covered.
- **Interpolated-Hebrew attributes (M-5) — named residual.** tnode's attribute pass (8612) translates an
  attribute only on an **exact** `d[raw.trim()]` dict hit. An attribute whose value is a **runtime-interpolated
  Hebrew** string (a number/param spliced in — e.g. a ``placeholder=`יעד ${x}°…` `` not routed through `L`)
  never exact-matches a dict key, so tnode cannot translate it. Attributes built through `L(...)` are fine —
  `L` picks the language at generation, so the `L`-wrapped `placeholder` at **app.js:10326** is already
  covered; the residual is the **non-`L`, runtime-interpolated** attribute class. Listed in
  `RESIDUAL-UNCOVERED` (§14); the v269 `Lt` refactor (which routes interpolated strings through the dict by
  template key) is the fix, tracked there.
- **Units:** `__units__` (`ס״מ²→cm²`, `ל׳→L`) and `__pre__` are dict sub-maps consumed by tnode's `interp`
  (8600-8601). They are in Guard A scope so each active dict must carry them. **No unit is ever a safety
  number** — units are glyph substitutions, numbers pass through untouched.

---

## 10 · AI/voice locale (I5)
- **`LANGNAME` (8571)** gains `it` (and any active language): `{en,ar,ru,es,fr,de,it,…}`. This fixes:
  - `aiJSON` (5498) `LANGNAME[outLang]||'English'` — Italian AI replies stop defaulting to English.
  - `mtTranslate` (8695) `LANGNAME[lang]||lang` — Italian prose MT stops being told to translate to the
    ambiguous token "it".
- **Build assertion `active-langs ⊆ LANGNAME` (M-1).** build.py, after assembling `_i18n`, asserts every
  active language code (each `lang/<code>.json`, excluding `.data.json`) is present as a key in app.js's
  `LANGNAME` literal — read app.js, match `const LANGNAME={…}`, check membership; **missing → `sys.exit(1)`**.
  This makes I5 **non-recurring**: the next queued language cannot ship without its `LANGNAME` entry, so
  `aiJSON` (5498, `||'English'`) and `mtTranslate` (8695, `||lang`) can never silently default its AI replies /
  prose-MT to English again. (Today `it` is the missing entry — added above; the assertion would currently
  RED until it is added, which is the point.)
- **Coverage statement (explicit, phased — not silently out of scope):**
  - AI JSON replies (reasons/notes/tips): localized for every language in `LANGNAME` from v268.
  - `data-mt` prose: already per-language via the offline dict + guarded AI.
  - **TTS neural voice** (`vcPickVoice`, voice picker) is **he/en only today**; extending the spoken-voice
    locale to fr/de/es/it is **named as a follow-up**, not part of v268/v269 (it depends on available Gemini
    voices, a separate track). The AI *text* reply is localized; the *spoken voice* selection is the residual.

---

## 11 · Names, ternaries, templates — phasing detail
- **Names → v268 (mechanical, number-free) — ONE scheme (I-D).** Names live in a dict **`__names__` sub-map**
  keyed by `m.heb`; `itemName(m)` resolves them **directly** — no `L`/`t`/`ctx` call, no flat `he␟name` key.
  The non-Hebrew branch of `itemName` (8581) becomes:
  ```js
  function itemName(m){ if(!m) return '';
    const l=getLang(); if(l==='he') return m.heb||m.eng||'';
    if(l==='en') return m.eng||m.heb||'';                                  // en: shipped English, zero-regression
    const nm=getDict().__names__||{}; return nm[m.heb] || m.eng || m.heb || '';   // fr/de/es/it: __names__, fallback m.eng (never blank)
  }
  ```
  Category/cut/make names resolve the same way. **~59 callers are unchanged** — they call `itemName`, not the
  dict. Extractor harvest **mode 4** emits the `__names__` sub-map (`__names__[m.heb] = m.eng`); Guard A scopes
  `__names__.*`; the pipeline translates the names per language. Rationale for v268 (not v269): the flagship
  recipe screen must not be a fully-localized frame around an English title — the audit's most visible defect.
- **Literal ternaries → v268.** `he?'א':'b'` → `L('א','b')` (mechanical; extractor mode 1 picks it up).
- **Computed ternaries → v269.** `he?heVar:enVar` (e.g. `he?slotHe:slotEn`) → make the source dict-aware:
  replace the two vars with a single `t('<he>','<en>')`/`L` so one localized value flows AND arg0 is
  extractable and falls back to **English, not Hebrew**. Enumerated per-site in the v269 plan.
- **73 interpolated templates → v269 (surgery, budgeted honestly).** New helper:
  ```js
  function Lt(heTpl, enTpl, params){
    const s = L(heTpl, enTpl);                                  // dict lookup by the TEMPLATE key
    return s.replace(/\{(\w+)\}/g, (_,k)=> (params && params[k]!=null) ? params[k] : '{'+k+'}');
  }
  ```
  Refactor `L(\`…${x}…\`, \`…${x}…\`)` and the 11 concat-`L` → `Lt('…{x}…','…{x}…',{x})`. **Every
  temperature/duration/dose is a runtime `{param}`, substituted after the dict lookup — it never enters the
  dict or the translator.** These refactors are surgery (nested Hebrew clauses; asymmetric he-raw vs en-`t()`
  params like 3975/3983 which carry cm²/°C) — budgeted as the bulk of v269, gated by Guard C (placeholder
  equality) and Guard B (numeric).
- **`t`≡`L` ordering footgun (M-4) — sequence the v269 edit atomically.** Old `t(he, fallback)` returns
  `dict[he] ?? fallback ?? he`, and `getDict()` is **null in he-mode** (8580) — so `t('שלום','Hello')` in
  **Hebrew** returns `'Hello'` (the fallback): adding an English 2nd arg to a `t()` call **before** flipping
  `const t = L` would render **English in Hebrew**. Mitigated because there are **zero** existing 2-arg
  string-literal `t()` sites (re-verified at HEAD: grep `t('…','…')` / `t("…","…")` → **0 matches**). The v269
  migration must be **atomic**: either flip `const t = L` in the **same commit** that adds the en 2nd args, or
  add en args only **after** `t ≡ L` is in place — never a 2-arg `t()` under the old `t` body. DoD §15.7
  (Hebrew byte-identical) is the regression net that catches a violation.

---

## 12 · Translation pipeline (unchanged mechanism, extended scope)
Feed `lang/_extracted.json` (he→en pairs, incl. `␟ctx` and `__names__` keys) to the existing bulk pipeline in
**English-pivot** mode (§10.19), producing `{key: <target>}` per language, gated by the safety lexicon. Merge
into `lang/{code}.json` (merge, don't clobber existing good translations). Local GPU (`translategemma:27b`,
~$0). The **marathon (23 queued languages) stays paused** and is re-run through the *final* extraction
afterward so each queued language is born complete; each is added to Guard A + the test as it ships.

---

## 13 · Safety invariance — TRUE against the code
This section is written to be verifiable against `app.js`, not aspirational.

1. **No safety number is silently translatable.** Safety numbers that live inside `L` strings today (2651,
   2666, 10323, 10881) are covered by **Guard B (§4.3), which is UNIT-TOKEN-PRESERVING (C-1 + S-1)** — it
   ports `vcTransSafe`/`VC_UNIT_CLASS` and **extends the coarse classes into magnitude-specific sub-classes**,
   so the build fails on a digit drift, on a **cross-class** swap (`156ppm→156%`), **and on a within-class**
   swap the coarse port missed (`71°C→71°F` via `tempC`≠`tempF`; `2.5 g/kg→2.5 kg` via `massG`≠`massKg`;
   `יום↔דקה` via `timeDay`≠`timeMin`), and it **fails closed** on any unclassifiable unit. **Residual, stated:**
   a source whose unit is genuinely unspecified (`68 מעלות` at 10323 — no C/F glyph) is classed coarse `temp`
   and cannot be pinned to C vs F; it stays tolerant (the fix is to make the Hebrew explicit, never to relax
   the guard). Numbers refactored into `Lt` params (v269) never enter the dict at all (Guard C proves the
   placeholder survived; the param value is substituted at runtime from the same source expression that
   produced the Hebrew number).
2. **The runtime guard is unchanged and still guards the DATA/`data-mt` path** (mtNumSig/mtSafe/mtGuard
   8642-8681, invoked at 8703). v2 **adds** a build gate for the chrome path; it does not weaken the runtime
   one.
3. **`vcTransSafe`/`vcNumPairs`/`VC_UNIT_CLASS` (8655-8679) and the voiced-number path are untouched** — no
   `bcheck` stage, `temp`, `safe` value, or cook duration is altered by any v2 change. Guard B (§4.3) is a
   **Python port of these functions' semantics** applied at build time to the chrome dict; it does not modify
   the runtime originals. The localize path only ever selects *which pre-approved string* renders; it never
   computes or rewrites a number.
4. **`itemName`/names carry no safety numbers** (names are number-free), so the v268 name refactor is
   safety-inert by construction.
5. **§3.10 assertion:** the leak-scan test + a targeted test that (a) a rendered safety string's numbers are
   byte-identical across all active languages, and (b) Guard B fails on a seeded digit-flip **and on a
   seeded within-class unit swap (`71°C`→`71°F`)** and passes when corrected (RED/GREEN both witnessed).

---

## 14 · Phasing
**v268 — chrome-complete + names + all-surface routing:**
extractor (harvest modes 1-4, incl. array-partner + nested recursion) · literal-ternary→`L` · **delete the 9
`_EN` tables**, route via `L` · toast + attribute + unit coverage · **names → `__names__` (resolved in
`itemName`)** · homograph `ctx` for the ~31 collisions **with the bare `he` key retained** (I-C) · translate
the static+ternary+`_EN`+toast+name key set to fr/de/es/it · **Guard A (coverage) + Guard B (unit-token-preserving
numeric) + Guard D (call-site signature) + `active-langs⊆LANGNAME`** · state-driving leak test with
`__i18nTrace` (en-excluded) + attribute scan + staleness gate + `_i18n-deferred.json` exclusion · `LANGNAME`
gains `it`. Every button/label/panel/message/dialog/toast/name fully localized for the 5 languages.

**`RESIDUAL-UNCOVERED` (v268) — stated honestly, tracked, each with its closer:**
1. **Interpolated templates + concat-`L` (~84).** Still English-fallback in v268; enumerated in
   `lang/_i18n-deferred.json` (template keys), subtracted from the leak-scan trace (§8.2). **Closer:** v269
   `Lt` refactor — the list is non-growing and empties by end of v269.
2. **Computed ternaries (`he?heVar:enVar`).** Render the **English** var directly, bypassing `L` — they show
   English-not-target in fr/de/es/it and are **invisible to the trace** (no `L` record) and pass the
   Hebrew-block DOM scan trivially (English carries no Hebrew). Tracked here, **not** in the trace-deferred
   regex set. **Closer:** v269 computed-ternary fold → single `t`/`L`.
3. **Non-`L`, runtime-interpolated attributes (M-5).** `placeholder`/`aria-label`/`title` whose value splices
   a runtime value into Hebrew and is not routed through `L` — tnode's exact-match attribute pass cannot
   translate them. **Closer:** v269 `Lt`/attribute routing.
4. **TTS spoken-voice locale beyond he/en (§10).** AI *text* replies are localized from v268; the *voice*
   selection is a named follow-up.

**v269 — interpolated prose + deeper simplification:**
`Lt` + 73 template refactors + 11 concat-`L` · computed-ternary fold · **`t` ≡ `L` unification** ·
**Guard C (placeholder equality)** · extend Guard A/B + test to the template+computed keys · re-run the
marathon through the final extraction. Full localization complete; the primary path is one function.

---

## 15 · Per-phase Definition of Done (§3-aligned; each line needs evidence pasted at execution)

**Both phases:**
1. **Spec line traced** — each task cites the §here it satisfies.
2. **RED witnessed** — Guard A seeded with a missing key → build observed FAILING (exit 1, output pasted);
   Guard B seeded with a digit-flip **or a within-class unit swap (`71°C`→`71°F`)** in a translated safety value → build observed FAILING. The leak test:
   a seeded raw-Hebrew node/toast → test observed FAILING for the intended reason.
3. **GREEN** — key filled / digit corrected / string routed → `python build.py` and `npx playwright test`
   run fresh, output + exit code pasted.
4. **Behavioural assertion** — every new test asserts a **rendered** effect (DOM text/attribute or a fired
   toast), never a computed field nothing reads.
5. **Consumer exists** — every harvested/extracted key has a real render path named (the `L`/`t`/`tr`/tnode
   site); per L8 confirm it fires on real data (the state-driving test IS that confirmation).
6. **Fixture minimality + negative case** — the insufficient-gear kit contains only what triggers the
   "cannot be cooked" panel; the **negative** (Hebrew mode unchanged) is asserted.
7. **Regression red-green** — for each folded mechanism, revert the fold → Hebrew-mode render observed
   byte-identical (no Hebrew regression) is the invariant; a seeded regression is observed failing then
   passing.
8. **Visual evidence** — recipe-under-kit, an edit form, and a toast screenshotted at **390×844** in
   fr + one other language, actually looked at.
9. **Hebrew check** — every new/refactored user-facing string rendered in Hebrew: no English leak, correct
   singular/plural on interpolated counts, correct domain term; numeric/math readouts keep their `dir="ltr"`
   island (L13).
10. **Safety invariance** — §13.5 assertions pasted: cross-language numeric identity + Guard B RED/GREEN.
    Confirm no `bcheck`/`temp`/`safe`/duration touched.
11. **No arbitrary waits** — the state-driving test waits on conditions (`waitForFunction` on panel/toast
    presence), never `waitForTimeout`.
12. **Full suite green** — plain `npx playwright test`, output pasted, no `--retries`/`--workers=1`. Any
    failure (incl. intermittent) debugged via systematic-debugging, never re-run until green.

**Per-phase gate:** every DoD line quoted MET with evidence; independent re-audit by a fresh agent **against
this spec, not the ledger**. Live-verify per §10.10 (foot-stamp `מהדורה NNN` + a feature probe on the live
URL). Owner handoff per §10.21: a Hebrew numbered use-case script (screen · exact action · expected result)
per localized surface.

---

## 16 · Durability property (preserved and made explicit)
The Hebrew-source-as-key design turns any future **edit of a Hebrew string into a build break** (Guard A: the
old key is now missing) rather than a silent runtime leak — the single biggest win, and v2 strengthens it
(Guard B/C make a *number* edit break too). **Price, stated:** editing a Hebrew copy string requires a
re-translate cycle for that key across all active languages before the build passes again. This is
intentional: a stale translation cannot ship. For pure-typo fixes, the workflow is: edit Hebrew → run the
extractor → run the pipeline for the one changed key → commit; the guard confirms all languages are refreshed.

---

## 17 · Out of scope (named, not silently dropped)
- `data-mt` description prose — already localized + guarded (Chesterton: untouched). **Pre-existing hazards,
  noted not fixed — named follow-up `T-GuardB-runtime`:** (a) its runtime numeric guard
  (`mtGuard`→`mtSafe`→`mtNumSig`, invoked at 8703) is **`mtNumSig`-only — fully unit-blind**; and (b) even the
  runtime `vcTransSafe`/`VC_UNIT_CLASS` (8655-8679) that guards the voiced/verify path is **coarse** (a within-class
  `°C↔°F`/`g↔kg` swap passes there) **and** its mass char-class omits gershayim (U+05F4), so `ק״ג` is
  unclassified. The fix (out of v268/v269 scope): point the DATA guard at a magnitude-specific `vcTransSafe` and
  split the runtime classes exactly as Guard B (§4.3) does. The DATA/`.data.json`/voiced paths are out of this
  spec's scope; flagged not silently dropped.
- The AI-runtime grounding / smoker device lookup (audit Finding 3) — separate track, needs a live key.
- TTS neural **voice** locale beyond he/en (§10) — named follow-up.
- Changing the translation model or the safety-gate *design* — unchanged.

---

## 18 · Self-review against the brief's findings

| Finding | Resolved (v3-amended) | Deferred / phased |
|---|---|---|
| C1 build numeric guard | **§4.3 Guard B — UNIT-TOKEN-PRESERVING** (Python port of `vcTransSafe`/`VC_UNIT_CLASS`, **extended with magnitude-specific sub-classes**; catches digit + cross-class (`ppm→%`) **+ within-class** (`°C↔°F`, `g↔kg`, `min↔hr↔day`); fail-closed) — **C-1 + S-1**; residual = unit-unspecified source (`68 מעלות`) named | runtime-guard hardening → follow-up **T-GuardB-runtime** (§4.3/§17) |
| C2 extraction blindness + KNOWN≠COVERAGE | **§3.3 modes 2-4** (harvest `_EN`/expr-arg/toast/names, incl. array-partner + nested) + **§5** explicit | concat-`L`/templates → v269 (§11); tracked in `_i18n-deferred.json` (**C-2**) |
| C3 raw toasts | **§7** (extraction coverage; toast already localizes) | — |
| I1 homographs | **§6** (`ctx` compound key **+ retained bare `he` key for tnode**, I-C; `__names__` namespace, I-D; table-ctx, M-3; collision lint) | — |
| I2 state-driving test | **§8.1** (drives into states, honest `RESIDUAL-UNCOVERED` block, §14) | — |
| I3 deterministic fallback | **§8.2** (`__i18nTrace` instrumenting `L`; **en records excluded**, deferred set subtracted — GREEN-in-v268, **C-2**) | — |
| I4 t() leak + attrs + units | **§3.2, §4.2, §9, §8.2/8.4** (en artifact scoped honestly I-A; interpolated-attr residual named M-5) | full `t`≡`L` unify → v269 (atomic, **M-4**) |
| I5 Italian AI / LANGNAME | **§10** (add `it`; fix both defaults; **build assertion `active-langs⊆LANGNAME`**, M-1) | TTS voice locale → follow-up (named) |
| Scoping (names v268, two-literal ternary, 73 templates v269) | **§11** (names→v268 via `__names__`, I-D; literal ternary→v268) | computed ternary + 73 templates + concat-`L` → v269 |
| Simplification mandate | **§2** (fold to one `L`; delete `_EN`; `t`≡`L`; keep tnode net + data-mt separate) | `t`≡`L` lands v269 |
| Enforcement boundary (v2-review **I-E**) | **§4.5 Guard D** (Cloudflare-side call-site signature) + **§8.3** suite as hard pre-deploy gate — boundary stated honestly | — |
| Durability property | **§16** (preserved + strengthened + priced) | — |

**Deliberately deferred to v269 (budgeted, not dropped):** the 73 interpolated `Lt` templates + 11 concat-`L`
(tracked in `lang/_i18n-deferred.json`, subtracted from the v268 leak scan and emptying by end of v269), the
computed-ternary fold, and the `t`≡`L` unification — the surgical, safety-number-bearing changes scoped to
v269. **Deliberately out of scope (named):** AI grounding/smoker lookup; TTS spoken-voice locale beyond he/en;
the **pre-existing** unit-blindness of the runtime `data-mt` guard at 8703 **and the coarse classes /
gershayim gap in the runtime `vcTransSafe` (8655-8679)** — both folded into follow-up **T-GuardB-runtime** (§17),
flagged not fixed.

---

## 19 · v2-review amendments (finding → section changed)

The v2 review returned **APPROVE-WITH-FIXES**. Each finding below was resolved by amending v2 in place.
Every code reference was re-verified against `app.js`/`build.py` at HEAD (line numbers re-confirmed).

| # | Finding (short) | Section(s) changed | Resolution |
|---|---|---|---|
| **C-1** | Guard B mirrored unit-**blind** `mtNumSig` (any same-digit change passes) — a safety hole | §4.3; §1 C1 row; §13.1; §18 | Guard B ported to **`vcTransSafe`/`vcNumPairs`/`VC_UNIT_CLASS`** (8655-8679): number paired with unit-CLASS, unordered multiset compare, **fail-closed** on any unclassified unit. Catches a digit drift **and a cross-class swap** (`ppm→%`). *(The COARSE port alone does **not** catch a within-class swap `°C↔°F`/`g↔kg` — that is **S-1** below; the earlier "catches `°C→°F`" wording is corrected there.)* |
| **C-2** | Leak-scan test could **not** go GREEN in v268 (en pushes trace on every call; ~84 deferred concat-`L`/template fallbacks the required insufficient-kit state drives through) | **§8.2** (rewritten); §3.1 note; §3.2; §14 RESIDUAL | (1) `lang:'en'` trace records **excluded** from the emptiness assertion (en correct-by-construction). (2) New **phase-scoped `lang/_i18n-deferred.json`** (template keys, regex-matched), **distinct** from the loanword allow-list: v268 asserts `trace(non-en) − loanwords − deferred == empty`; deferred list is non-growing and **empties by end of v269**. Honest trade stated. |
| **S-1** | The C-1 port's `VC_UNIT_CLASS` is **coarse** (`°C`/`°F`→`temp`; `min`/`hr`/`day`→`time`; `g`/`kg`→`mass`), so a **within-class** same-digit unit swap (`71°C→71°F`, `יום↔דקה`, `g↔kg` = a 1000× cure-salt error) **passes** the guard — the spec wrongly claimed `°C→°F` was caught | **§4.3** (rewritten, magnitude-specific); §1 C1 row; §13.1; §13.5; §15; §18 | **Owner decision: STRENGTHEN to unit-token preservation.** Coarse classes split into magnitude-specific sub-classes (`tempC`/`tempF`, `massG`/`massKg`, `timeMin`/`timeHr`/`timeDay`) **when the unit is explicit**; classify explicit-first, fall back to coarse; a **directional** `unit_ok` requires an explicit source unit to match exactly while a **generic** source (`68 מעלות`) stays tolerant. Patterns verified against the real tokens (grams `ג׳`=U+05D2+U+05F3; kg `ק״ג` uses **gershayim U+05F4**, which the runtime regex@8660 omits). **Residual named:** unit-unspecified source can't pin C vs F. **Follow-up `T-GuardB-runtime`:** harden runtime `vcTransSafe`(8672) + data-mt guard(8703) the same way. |
| **I-A** | en.json for the `L`-set is an extractor **artifact**; Guard A's en pass over-claimed | **§3.2** (added); **§4.2** (rewritten) | en.json `L`-set = generated from inline `en` args (~320 today, extractor emits ~800-1000). Guard A's en pass is scoped to the real I4 case — **`t(he)`-no-en** (`needs-en` list); it is **not** a rendered-string validator for the `L`-set (tautology). |
| **I-B** | Harvest mode 2's flat `NAME[k]` misses `SPK_HEAT` (array-of-pairs) + `DONE_SCALES` (nested) — 2 of 9 `_EN` tables leak | **§3.3 mode 2** (rewritten) | All 9 tables enumerated (7 flat + 2 special). Added **(b) array-of-pairs** harvesting (`SPK_HEAT`@1311 ↔ `SPK_HEAT_EN`@1312) and **(c) nested/leaf-pair recursion** (`DONE_SCALES`@2964 ↔ `_EN`@2970). |
| **I-C** | `␟ctx` keys can't be formed by tnode (keys by bare visible Hebrew) → deleting bare keys leaks Hebrew in static shell | **§6** (added bullet); §14 | **Bare `he` key retained** in every dict (most-common sense) alongside `he␟ctx`; the `␟ctx` split is **additive over the `L()` path only**. Optional per-word proof-of-no-tnode allowed to drop a bare key. |
| **I-D** | Names keying internally contradictory (`__names__` sub-map vs flat `he␟name` via `L`; nothing reads `__names__`) | **§2 mech 7**; **§3.3 mode 4**; **§6**; **§11** (all made consistent) | **ONE scheme**: names live in a `__names__` sub-map keyed by `m.heb`, **resolved directly by `itemName`** (`getDict().__names__[m.heb]`) — no `L`/`t`/`ctx`, no flat key. Threaded through `itemName` (8581) + extractor mode 4 + Guard A. Explicit `itemName` body given. |
| **I-E** | "The build fails" was really "local build+suite fails" — Cloudflare `python build.py` alone ships stale | **§4.5 Guard D** (added); §8.3; §14 | Boundary stated honestly: **Guard D** = Cloudflare-side Python **call-site structural signature** (regex count + literal-arg sha1 vs committed `__sig__`, no acorn); **the suite (§8.2+§8.3) is the hard pre-deploy gate** and the complete check. No claim that `python build.py` alone proves coverage. |
| **M-1** | I5 can recur for the next queued language | **§10** (added) | build.py asserts **`active-langs ⊆ LANGNAME`** (reads app.js's `LANGNAME` literal); missing → `sys.exit(1)`. |
| **M-2** | Guard B scope unstated | **§4.3** | Scoped to `_extracted.json` **chrome** keys; `.data.json` prose stays runtime-guarded (8703). |
| **M-3** | Mode-2 needs allow/deny + a ctx path for table homographs (`'נא'`=rare/"please" @2965) | **§3.3 mode 2** | Deny-list for non-UI `{he,en}` objects; table homographs emitted under a **table-scoped ctx** (`'נא␟doneness'`) so the collision lint doesn't false-trip. |
| **M-4** | `t≡L` ordering footgun (en 2nd arg before `const t=L` renders English in Hebrew) | **§11** (added) | Sequence the v269 edit **atomically**; **zero** existing 2-arg string-literal `t()` sites (re-verified: 0 matches). |
| **M-5** | Interpolated-Hebrew attributes not caught by tnode | **§9** (added); §14 RESIDUAL | Named residual: **non-`L`, runtime-interpolated** attributes (exact-match tnode misses them). `L`-wrapped attrs (e.g. 10326) already covered. v269 `Lt` closes it. |
| **M-6** | Fraction glyphs (`½`, `1/2`) in the numeric mirror | **§4.3** | Noted: `SAFETY_NUM` reads `1/2` as {1,2} and skips `½`; **harmless today** (no fraction glyph in chrome safety strings); normalize `½`→`0.5` if one ever appears. |

**Re-verification note.** All amendments were checked against source at HEAD: `L`@8587, `getDict`@8580,
`t`@8582, `itemName`@8581, `mtNumSig`@8642, `VC_UNIT_CLASS`@8655-8661, `vcNumPairs`@8662, `vcTransSafe`@8672,
`SAFETY_NUM`@5329, `safetyNumRe`@5416, `safetyNumVal`@5421, `LANGNAME`@8571 (lacks `it`; used @5498 `||'English'`
+ @8695 `||lang`), `tnode`/`applyI18n`@8595-8613 (keys by bare Hebrew), `SPK_HEAT`@1311 + `SPK_HEAT_EN`@1312,
`DONE_SCALES`/`_EN`@2964/2970, `'נא'`@2965, safety `L`-strings `71°C`@10881 / `2.5 ג׳/ק״ג ≈156ppm`@2651,2666 / `68 מעלות`@10323 (generic, no C/F) / `1 ס״מ`,`24ש`@2655, `VC_UNIT_CLASS`@8660 mass char-class omits gershayim U+05F4 (so `ק״ג` is runtime-unclassified — S-1), `toast` `tr()`@3540-3541, concat-`L`@3975/3983, `build.py`@382-408
(no Node/acorn on Cloudflare). Nine `_EN` tables confirmed (1090/1287/1312/2970/4288/8549/8550/8551/8747).
