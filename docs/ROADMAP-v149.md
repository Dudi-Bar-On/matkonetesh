# מתכונת אש — Implementation Roadmap (from Analysis v149)

**Date:** 2026-07-13 · **Branch:** `improvements` · **Baseline:** `main`@v149 (stable). This roadmap sequences **every** recommendation from `ANALYSIS-v149.md` (10 dimensions, ~120 findings) into shippable waves, ordered by dependency and risk. Finding IDs (e.g. `AI #1`, `T2`, `UX #3`) reference `docs/ANALYSIS-v149.md`.

> **Reading:** **§A** program principles + the business-track decision. **§B** the dependency spine (what unblocks what). **§C** the waves, each with its findings, effort, verification, and release. **§D** the deferred matkonet-platform backlog. **§E** open decisions.

> **Implementation status (as of v168, single `main` branch):**
> - ✅ **Wave 0** (v150) · **Wave 1** (v151) · **Wave 2a/2b** (v152 + CSS/JS extraction v157) — done.
> - ✅ **Wave 3 AI track** (v168): centralized `gemFetch` transport — API key moved to the `x-goog-api-key` **header** (out of the URL), **AbortController timeout**, transient-**retry with backoff**, and the **`GEM_URL` endpoint-indirection seam** (AI #8 / money seam); a **numeric-invariant safety guard** flags unverified temp/cure/nitrite numbers in AI answers (AI #4); a standing **disclaimer** on open Q&A (AI #7).
> - 🟡 **Wave 3 PWA track**: `storage.persist()` + validated import + quota surfacing done (Ops Wave C); remaining — `mk-schema` migration runner, maskable icon, manifest `shortcuts`/`screenshots`.
> - 🟡 **Wave 4** — **UX #3 (menu-builder consolidation, the "biggest single UX win") done (v169):** the guided **wizard is now the single builder** — its preset quick-starts (`מנגל מעורב`, fill-from-favorites…) moved into the wizard picker, the confusing in-wizard "open the other builder" jump button removed, and all "build menu" entries (More sheet, helper answer, AI planner) route to the wizard. The legacy `openMenu` panel is retired as an entry point. **UX/IA track complete** (v169–v172): UX #3 (builder consolidation), #6 (single primary review CTA), #7 (collapsed shape controls), #10 (More-sheet regroup), #12 (real global home search), #13 (positive wording + shared `aiSpinner` loading), #14 (clickable wizard steps). **a11y depth core done (v173):** a skip-link to the focusable `<main id="mainContent">`, and the AI answer thread is now a `role="log"` `aria-live="polite"` region (announces answers). On top of Wave 1's keyboard/aria-pressed/timer-a11y work. Remaining Wave 4: **content polish** (cheese descriptions, glossary, citations — incremental authoring, gates nothing) + finer a11y/UI-debt (44px-target audit, heading hierarchy). (Seasoning dedup already done in `build.py`.)
> - 🟡 **Wave 5** (multilingual i18n) — **foundation shipped (v174):** the `t()` chrome seam, a pluggable `getLang()`/`setLang()` provider (host-driven via `window.__MATKONET_HOST__` — the matkonet module seam), a `data-i18n`/`-html`/`-ph` DOM walker (`applyI18n`), `applyLang()` (sets `<html>` lang/dir + `.lang-en`), and an **English/עברית switcher** in the Appearance panel. A starter chrome table translates the home paths/hero/search + settings labels and flips to LTR. **CHROME ONLY** — machine-translating recipe/data prose stays gated behind the T1 numeric-safety guard (deferred). **Batch 2 (v175):** `showPanel` auto-translates `data-i18n` panels; the wizard flow fully covered. **Batch 3 (v176): the T1 numeric-invariant safety guard is built** — `mtNumSig`/`mtSafe`/`mtGuard` (a translation is accepted only if it preserves the exact number multiset) + `mtTranslate` (gated, cached per lang+content, `gemFetch`-backed with a mock seam, safe Hebrew fallback on any mismatch/failure). This is the gate the roadmap required; MT of data is now unblocked. Remaining: wire `mtTranslate` into item/recipe rendering (English prose behind the guard); expand the chrome table to full coverage; then ar/ru/es/fr/de.
> - Separately, the entire **OPERATIONS-v157** analysis (Waves A–F, v158–v167) shipped: night/next-day datetime, background alarms, data-loss guards, the internal-temp safety gate, pro multi-event, and workflow legibility.

---

## §A · Program principles

1. **Safety and security ship first, alone, to `main`.** The cure-warning bug and the AI-XSS are live on the deployed app; they don't wait behind a refactor.
2. **`main`/v149 stays the stable baseline.** Each wave lands on a feature branch off `improvements`, merges to `main` with a version bump + tag + Cloudflare deploy only when its Playwright suite is green.
3. **Byte-identical output where possible.** The keystone refactor (T2, extract CSS/JS) is designed to produce an identical `index.html`, so it carries near-zero regression risk and can land early.
4. **Every wave adds tests.** Extend the Playwright suite per wave; after T2, add a Node unit-test layer for pure helpers (`kosherStatus`, order-effect, temp math).
5. **Build seams, not lock-in.** The i18n `getLang()` provider and the `aiJSON()` endpoint indirection are built platform-agnostic so matkonetesh works standalone today and slots into matkonet later without rework.
6. **Ship value continuously.** Waves are ordered so that after each one the app is strictly better for real users — not "better only once the whole program finishes."

### The business-model track (decision)
The matkonetesh roadmap **does not wait on the matkonet PRD.** The monetization work splits by backend dependency:
- **In matkonetesh now (standalone-safe, no backend):** **only the platform-agnostic seams** — the i18n `getLang()` provider (Wave 5) and the `aiJSON()` endpoint indirection (Wave 2b). **Decision (2026-07-13): hold ALL live revenue.** No affiliate links and no content packs ship in matkonetesh before matkonet; we build only the seams so both futures stay cheap.
- **Deferred to the matkonet platform (needs the PRD):** managed-AI paid tier, accounts + sync, B2B Pro billing, dataset licensing, **and affiliate/commerce + content packs** (held per the decision above). See **§D**.

---

## §B · The dependency spine

The ordering is driven by five "unlock" relationships:

- **`esc()` helper (AI #1) → everything that renders text.** Add it in Wave 0 (security), then reuse it for user text (arch #6) and as the invariant that i18n/AI-prose safety builds on.
- **T1 safety-number extraction (Content #1, i18n P0-#1, AI #4) → safe i18n.** Numbers must leave prose before any translation ships. Start in Wave 0 (the calc.cure fix) and complete the structural extraction in Wave 2.
- **T2 extract CSS/JS (arch #1) → tooling, the `t()` seam, the module boundary, unit tests, de-god-functioning.** The keystone. Land it early in Wave 2; almost everything structural depends on it.
- **`DATA` as `JSON.parse` + state layer (T3, arch #3) → lazy-loading (perf #3/#6) and clean persistence hand-off to a host.** Wave 2.
- **i18n `t()` seam + `getLang()` provider (§9) → all multilingual work AND the clean matkonet module boundary.** Wave 5, after T1 + T2.

Everything else (content polish, UX/IA overhaul, AI hardening, PWA robustness, a11y depth) is largely independent and slots into parallelizable tracks once the spine is in place.

---

## §C · The waves

### Wave 0 — Safety & Security hotfix → **v150**, merge to `main` immediately
The only wave that jumps the queue. Small, high-stakes, independently shippable.

| Finding | What | Effort |
|---|---|---|
| Content #1 | `SG()`: put cure **type** in `calc.cure`, rate in `cureRate` — restores the ⚠ warning + correct "Cure #1/#2" on 47 sausages | S |
| Content #2 | Kabanos/Landjäger → `Cure #2` label; raise kabanos salt to ~28 g/kg | S |
| Content #6 (safety subset) | Add `calc=` to `sausage_smoked`/`sausage_dry` so the 5 fermented/dried makes (`m-sopr/sauci/cacc/nduja/sucuk`) can run the safety calc | S |
| Content #7 | Standardize dried-sausage salt to ~28 g/kg across both systems | S |
| AI #1 | Add one `esc()` helper; wrap every AI string before `innerHTML` (Ask, voice, plan preview, diagnose, journal, season-rec, wcim) | M |
| T6 (safety subset) | Apply any already-researched CUT/SPEC temperature corrections currently stuck in `scratch/research/*.json` as "pending" | S |

**Verify:** extend `data-integrity.spec.ts` to assert every cured make renders a `'1'`/`'2'` cure type and shows the warning; add an XSS regression test (inject `<img onerror>` via `__aiMock`, assert no script execution / escaped output). **Release:** v150 to `main` → Cloudflare.

---

### Wave 1 — Make the app work for everyone → **v151**
Core UX loop + the accessibility/contrast failures. After this the product does its job for keyboard, screen-reader, and dark-theme users.

| Finding | What | Effort |
|---|---|---|
| UX #1 | Wire `toggleCart()` to an add-to-menu control on cards + item panel; fix the 3 phantom-"＋" empty-state strings | S |
| UX #2 | Fix resume: validate `mk-cook` for the active context; route to the wizard/timeline, not the events list | S |
| a11y #1 | Keyboard operability — sibling `keydown` at the delegated handler (3190) + `tabindex`/`role` on cards/paths/chips | L |
| UI #8 | Global `:focus-visible` ring (pairs with a11y #1) | S |
| a11y #4 | `aria-pressed`/`aria-selected` on chips/methods/lang/tabs | M |
| a11y #5 | `aria-label` on icon back-buttons + steppers; live stepper value | S |
| a11y #3 | Timers: `aria-label` buttons, `role="timer"` + `aria-live`, and a real oscillator alarm tone (fixes the silent alarm for everyone) | S |
| UI #1 + UI #2 | Tokenize the ~14 hard-coded light backgrounds + the dark-text leaks → repairs the charcoal dark theme | M |
| a11y #2 | Reassign `--ember2`/`--ember`/`.saved` text roles to AA-passing tokens (default theme) | M |
| UI #4 | Smoke-test every tool panel in charcoal (mostly covered by UI #1/#2) | M |

**Verify:** new `a11y.spec.ts` — tab to a card + Enter opens it; toggles expose pressed state; add an axe-core (or computed-contrast) check per theme. **Release:** v151.

---

### Wave 2 — Foundations refactor → **v152** (split into 2a/2b)
The enabling layer. Designed for low regression risk (byte-identical output for the extraction).

**Wave 2a — extraction, perf quick wins, offline**
| Finding | What | Effort |
|---|---|---|
| **T2 / arch #1** | **Extract CSS→`app.css`, JS→`app.js`, concatenate in build.py; assert identical `index.html`** | M |
| arch #10 / UI #5 | Delete dead theme CSS, `.fold-corner`, `foldCorner()` calls, `if(false)` blocks, retired no-ops | S |
| arch #13 / perf #11 | Delete `_app_check.js` + the two root `.zip` archives | S |
| perf #2 | `const DATA = JSON.parse('…')` instead of an object literal | S |
| perf #4 | Debounce search ~120 ms + ratings `Map` + memoize `kosherStatus` | S/M |
| perf #7, #9, #10 | Memoize `menuState()`; write-through cache in `store`; `kosherStatus` cache | S |
| PWA #4 / T3 | `store.set` returns success/failure + surfaces a quota toast; `storage.estimate()` warning | S |
| T4 (PWA #1/#2, perf #1/#5) | Service worker (cache-first shell, version-keyed) + self-hosted woff2 fonts (default pair only, lazy alternates) + update-refresh toast | M |
| PWA #3 / UI #11 | Fix `theme_color`/`background_color` to cream; update `<meta>` on theme switch | S |
| PWA #5 / perf #8 | Emit `dist/_headers` (no-cache HTML/manifest; immutable icons/fonts) | S |

**Wave 2b — state layer, modularization, hardening**
| Finding | What | Effort |
|---|---|---|
| arch #3 | `KEYS` registry for all `mk-*` keys + a `mount(host, html, wire)` helper | L |
| arch #5 | Split `app.js` into per-domain files concatenated in build (`catalog/wizard/voice/ai/timeline/seasonings/state`) | M |
| arch #6 | Apply `esc()` to all user-sourced text interpolations (extends Wave 0's helper) | M |
| arch #8 | Route swallowed errors through `toast()`/console; distinguish quota | M |
| arch #9 | Strip `__aiMock`/`__vcAskMock`/`__vcTransMock` behind a build-time `__TEST__` flag | S |
| arch #2 / T6 | Make the data pipeline authoritative — CUT/SPEC research values apply (or fail the build) like MAKE `calc` | M |
| arch #11 | Move build-time recipe normalization from build.py into `data.py`/`normalize.py` | S/M |
| arch #12 | Export pure helpers; add a Node unit-test layer (temp math, order-effect, kashrut) | M |
| UI #3 | `--fscale`: route the 52 inline `font-size` through an `fs(px)` helper/classes | M |
| UI #7 | Single source for the cream theme (`:root` vs `THEMES.cream`) | M |
| aiJSON **seam** | Abstract the Gemini endpoint/model behind `GEM_MODEL`/`GEM_URL()` + a single call wrapper (AI #8) so a managed proxy is later a config swap — **platform-agnostic monetization seam** | S |

**Verify:** the extraction must produce a byte-identical `index.html` (diff gate in CI); full Playwright suite green; new unit tests pass; Lighthouse/TBT before-after on the `JSON.parse` + font changes. **Release:** v152.

---

### Wave 3 — AI hardening + PWA/persistence robustness → **v153**
Independent of i18n; protects data and the AI layer. Can run parallel to Wave 4.

**AI track:** AI #2 (AbortController timeouts) · AI #3 (fix inverted retry + backoff) · AI #4/T1 (numeric-unit detector over AI prose — redact/flag fabricated cure/temp) · AI #5 (separate instruction from user data in prompts) · AI #6 (in-flight guard + LRU cache) · AI #7 (disclaimer on open Q&A) · AI #9 (key in `x-goog-api-key` header) · AI #10 (decouple AI mode from TTS key) · AI #11 (distinct "catalog not ready" state).

**PWA/persistence track:** PWA #6 (validated, non-destructive import with migration) · PWA #7 (single `mk-schema` + migration runner, folding in the 3 existing) · PWA #8 (`storage.persist()` + backup nudge) · PWA #9 (generate manifest from build.py; fix counts) · PWA #10 (padded maskable icon) · PWA #11 (`shortcuts` + `screenshots` + 180px apple-touch-icon).

**Verify:** AI-timeout + retry unit tests via the mock seam; import/export round-trip + migration test; manifest-count assertion. **Release:** v153.

---

### Wave 4 — Content quality & UX/IA overhaul → **v154**
The largest polish body; content is low-risk and can land incrementally.

**Content track (mostly S):** #3 (remove 6 duplicate seasonings) · #4 (tzatziki/toum spelling) · #5 (geresh normalization + dedup-normalize) · #8 (28 cheese descriptions) · #9 (12 house-rub tags) · #10 (Arabic-letters origin) · #11 (fix stale header, dedup by id+kind) · #12 (field type consistency) · #13 (glossary terms) · #14 (citation notes + per-item verified date; inline poultry hold-time note).

**UX/IA track:** #3 (consolidate the two menu builders — **L**, biggest single UX win) · #4 (explicit event/cook context toggle) · #5 (onboarding overlay replacing the cold level prompt) · #6 (single primary CTA on wizard review) · #7 (default to one vertical timeline; collapse shape controls) · #8 (compact timeline item rows; de-duplicate the safety warning) · #9 (simplify uiLevel/menuCtx) · #10 (regroup the More sheet by nouns) · #11 (wizard picker scroll) · #12 (unify search; real global home search) · #13 (positive "ready product" wording + shared AI loading pattern) · #14 (clickable progress steps).

**UI/architecture debt:** UI #6 (font-family vars) · #9 (dedupe `.card` rule) · #10 (migrate inline-style sprawl — **L**, incremental) · #12 (RTL physical props → logical) · #13 (per-theme accent tokens) · #14 (`!important` audit + desktop breakpoint) · arch #4 (split god functions — incremental) · arch #7 (extract `card()`/`panelShell()` scaffolding).

**a11y depth:** #6 (live regions for AI results + step counters) · #7 (associate form labels) · #8 (heading hierarchy) · #9 (44px tap targets) · #10 (skip-link + focus restore on in-place re-renders).

**Verify:** data-integrity test asserts no duplicate seasoning names and 279/301 counts; UX consolidation covered by updated wizard/menu specs. **Release:** v154 (or split content→v154, UX→v155 if the UX consolidation runs long).

---

### Wave 5 — Multilingual (i18n) → **v156** (English first)
Depends on Wave 0's `esc()`, Wave 2's T2 extraction + T1 structural completion.

1. **Safety guard (i18n P0-#1 / T1):** finish number-extraction into structured fields; `noMT` tagging; numeric-invariant MT check. *Gate — nothing translates until this is in.*
2. **`t()` seam + `getLang()` provider (P0-#3, #10):** build-time keyed table (Hebrew inline + fallback); pluggable provider (standalone `store`; host `window.__MATKONET_HOST__`/`postMessage`) — **the matkonet module seam**.
3. **`eng` neutralization (P0-#2):** freeze `eng` as an id; add a localized display-name map; replace the 7 `eng.includes()` branches with explicit tags.
4. **Formatting + RTL (P1-#7, P2-#8/#9):** `curLocale()`; per-language `dir`; convert the ~12 physical CSS rules; category/glossary label layer.
5. **English end-to-end (P1-#4/#5/#6, #11):** static chrome bundle; generalize `vcTranslateToEn`→`mtTranslate()`; persist the translation cache (`hash+lang+dataVersion`); lazy `lang.en.json`.
6. **Then `ar`/`ru`, then `es`/`fr`/`de`** — mostly AI-assisted content, human-reviewed chrome + safety.

**Verify:** language-switch e2e; a test asserting the numeric-invariant guard rejects a corrupted temperature; RTL/LTR layout snapshot. **Release:** v156 (en), then per-language.

---

### Wave 6-Money — Seams only (per 2026-07-13 decision)
**Decision: hold ALL live revenue in matkonetesh until matkonet.** No affiliate links, no content packs ship here now. The only monetization-related work done in matkonetesh is the **platform-agnostic seams**, and those live in earlier waves regardless:
- The **`aiJSON()`/`askGemini()` endpoint-indirection seam** — built in **Wave 2b** (`GEM_MODEL`/`GEM_URL()` + a single call wrapper) so a managed tier later is a config swap.
- The **i18n `getLang()` provider** — built in **Wave 5**, so a host can drive locale.

Affiliate/commerce and content packs are moved to the deferred platform backlog (**§D**) and revisited when the matkonet PRD lands.

---

## §D · Deferred — matkonet platform backlog (needs the PRD)
Not built in matkonetesh. Tracked here so nothing is lost:
- **Managed-AI paid tier** — proxy, metering (Workers KV), quota on the search path, Stripe/Paddle billing.
- **Accounts + cross-device sync** — the `localStorage`→cloud step (`product.html:324`); matkonetesh's `KEYS`/`mk-schema` layer (Wave 2b) makes the hand-off clean.
- **B2B "Pro"** — seats, invoicing, branded PDFs, multi-event management.
- **Dataset / white-label licensing** — commercializing `sources.py`.
- **matkonetesh-as-module wiring** — the host consumes the i18n `getLang()` provider (Wave 5) and the `aiJSON()` seam (Wave 2b); the host supplies locale + managed-AI endpoint, matkonetesh supplies the vertical.

*When the matkonet PRD lands, revisit this list and decide which lines the platform delivers vs. which (if any) matkonetesh ships standalone-first.*

---

## §E · Open decisions for you
1. **Version cadence:** ship each wave as its own release (v150…v156, more granular, faster feedback) — or batch Waves 1–2 into one bigger release? *Recommend: granular; Wave 0 alone first.*
2. **Wave 4 split:** keep the big polish wave as one, or split content (v154) from the UX/IA consolidation (v155)? *Recommend: split — the UX builder-consolidation (UX #3) is an L and shouldn't gate the quick content fixes.*
3. **Standalone revenue:** ~~affiliate only vs. packs vs. hold~~ → **DECIDED 2026-07-13: seams only, hold ALL revenue** until matkonet. No affiliate or packs ship in matkonetesh now.
4. **Kickoff:** green-light **Wave 0** now (I'll produce a detailed per-task implementation plan for it and start), and I'll draft detailed plans for later waves as we reach them.

*Nothing is implemented; `main`/v149 is the stable baseline and all work is isolated on `improvements`.*
