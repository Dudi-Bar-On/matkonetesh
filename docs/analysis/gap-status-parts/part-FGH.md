# Gap status — Bands 3.F (non-functional), 3.G (product-platform), 3.H (business/monetization)

Read-only synthesis. Source of gaps: `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §3.F/§3.G/§3.H (lines 552–807). Baseline audited v258; status assessed against v272 (CHANGELOG v261–v272) + live code probes.

## Counts per band

- **Band F (non-functional, 36 gaps):** CLOSED 3 · PARTIAL 1 · WAIVED 1 · OPEN 31.
  The i18n subsystem (S7) closed via the v268–v272 localization overhaul; **all performance, a11y, PWA, and UI-craft gaps remain OPEN — charter Phase P7 (product surface) has not started.**
- **Band G (product-platform, 8 gaps):** PARTIAL 1 · DEFERRED 4 · OPEN 3.
- **Band H (business/monetization, 12 items):** DEFERRED 9 · OPEN 3.
  Per charter R8/§12 "do not monetise now"; P10 deferred. The **marketing-claim corrections (R8) are largely NOT done** — only the footer offline string was fixed (see H-9, H-10, G-1).

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| F-1 | 3.F-i | S7 | fr/de/es shipped at 2.1% coverage with no gate; item data untranslated; 53 toasts leak Hebrew | P6 | **CLOSED (v268–v272)** | CHANGELOG v268 (full chrome), v269 (data values: names/categories/origins/woods), v270–v272; coverage Guard A + numeric Guard B; 5 active langs he/en/fr/de/es/it (`build.py` `_active_langs`); `tests/i18n-completeness.spec.ts` render-path leak gate |
| F-2 | 3.F-i | S7 | English-mode leaks (`רענן עכשיו`, `בטל`, step counter, kosher chip reverting) | P6 | **CLOSED (v268–v272)** | v268 "every button, label, panel, message, dialog, toast" unified; leak test drives fired-toast + language-switch-while-open + raw-Hebrew DOM scan |
| F-3 | 3.F-i | S7 | `data-mt="sv"` collision destroys English method toggles; `hydrateMT` treats value as source | P6 | **CLOSED (v268–v272)** | v268 "~1,300 inline bilingual strings unified into one translatable path fed by an extractor; nine parallel English lookup tables removed"; v270 work-plan method labels translated + leak test drives the timeline |
| F-4 | 3.F-i | S7 | RTL isolation applied locally, not systematically (was 7 `dir="ltr"`) | P6 | **PARTIAL** | `dir="ltr"` grew 7→18 in app.js (more coverage) but still ad-hoc per-site, no systematic mechanism; 🟡, not a claimed visual defect |
| F-5 | 3.F-i | S7 | 14 of 15 `data-i18n*` attributes are dead markup (`applyI18n` queries only `[data-i18n-html]`) | P6 | **OPEN** | `build.py` still ships 13 `data-i18n` + 1 `data-i18n-ph` + 1 `data-i18n-html` (unchanged); dead markup persists (also G-7). Minor |
| F-6 | 3.F-ii | S9/S10 | Cold CWV bad: LCP 2863 · CLS 0.29 · TBT 853 (JS boot rewrites home 3.4s after paint) | P7 | **OPEN** | No P7 perf work in CHANGELOG v261–v272 |
| F-7 | 3.F-ii | S9 | Cost is parse not bandwidth: decoded 2.69MB, ParseHTML 400ms, Layout 812ms at 4× | P7 | **OPEN** | Not addressed; P7 not started |
| F-8 | 3.F-ii | S7/S9 | Non-Hebrew: 62% wall-clock in long tasks — whole-body `MutationObserver` re-runs applyI18n+tnode+hydrateMT on 250ms timer ticks | P6/P7 | **OPEN** | 🔴 Still present: `app.js:11390` observes `document.body {childList,subtree}` and re-runs `applyI18n`/`tnode`/`hydrateMT` on 50ms debounce when `lang!=='he'`. The i18n overhaul unified strings but did NOT remove this walk |
| F-9 | 3.F-ii | S9 | Render-blocking Google Fonts on critical path (~620ms block + 102KB woff2) | P7 | **OPEN** | `build.py:150` / `index.html:18` still load 8 external Google Font families (`display=swap` only) |
| F-10 | 3.F-ii | S9 | No minification for 882KB JS + 172KB CSS | P7 | **OPEN** | `grep -inE "terser|uglify|minif|csso|esbuild" build.py` → 0 |
| F-11 | 3.F-iii | S10/S9 | Lighthouse A11y 94 · SEO 82; failing color-contrast, landmark-one-main, meta-description, robots/llms-txt | P7 | **OPEN** | No P7 a11y work; wave1/wave4-a11y tests are discovery characterization, not fixes |
| F-12 | 3.F-iii | S10 | Default (cream) theme worst contrast — 5 of 8 pairs fail AA (`.foot-stamp` 1.77:1) | P7 | **OPEN** | Accent ramp still untokenised/uncorrected; P7 not started |
| F-13 | 3.F-iii | S10/S9 | `<main>` measures 0×0 (inside hidden `#scr-catalog`); skip link targets a hidden element | P7 | **OPEN** | Not addressed |
| F-14 | 3.F-iii | S9 | Zero `aria-live` regions at rest; `toast()` sets live attrs on the just-inserted node | P7 | **OPEN** | Not addressed |
| F-15 | 3.F-iii | S10 | 25 of 36 home interactive targets under 44px (lane-chip 37px, 13px safety checkbox) | P7 | **OPEN** | Not addressed |
| F-16 | 3.F-iii | S3/S9 | `occ2` + cook timeline carry 0 ARIA / 0 role; fit verdict flips silently for SR users | P7 | **OPEN** | Not addressed |
| F-17 | 3.F-iii | S9 | Wizard focus not managed; Chrome logs aria-hidden-with-focus | P7 | **OPEN** | Not addressed |
| F-18 | 3.F-iii | S9 | 13 unlabelled form fields; 11/11 equipment-form labels unlinked; `#eqvArea` no inputmode | P7 | **OPEN** | Not addressed (equipment form reworked E1–E3 for logic, not label linkage) |
| F-19 | 3.F-iii | S9 | Wizard step 2 puts 279 buttons in the a11y tree, ~40-word names, no group semantics | P7 | **OPEN** | Not addressed |
| F-20 | 3.F-iii | S9 | `label-content-name-mismatch`: `#cHomeLang` aria-label "Language" vs visible `🇮🇱 עברית ▾` | P7 | **OPEN** | Not addressed |
| F-21 | 3.F-iii | S9/S10 | `.cnav` is a plain `<div>` — 0 nav landmarks, 0 aria-current | P7 | **OPEN** | `build.py:331` still `<div class="cnav">` with plain buttons |
| F-22 | 3.F-iii | S9 | User-uploaded content photos ship `alt=""` | P7 | **OPEN** | `app.js:3631` not changed |
| F-23 | 3.F-iii | S10 | No `prefers-color-scheme`; bright cream default at 02:00 | P7 | **WAIVED** | Mechanism explicitly rejected: app themes at runtime via JS, dead media-query block removed (review finding I1, `app.css:1750/1763`). Auto-dark UX concern not otherwise solved — flag if owner wants it |
| F-24 | 3.F-iv | S9 | Installability passive — no `beforeinstallprompt`/`deferredPrompt`/`appinstalled` | P7 | **OPEN** | 0 matches in app.js/index.html/build.py |
| F-25 | 3.F-iv | S9 | Manifest has no `shortcuts`, no `screenshots` | P7 | **OPEN** | `grep shortcuts\|screenshots` → 0 |
| F-26 | 3.F-iv | S9 | No `meta description` | P7 | **OPEN** | `name="description"` → 0 in build.py/index.html (also F-11 SEO failure) |
| F-27 | 3.F-v | S10 | Serving DATE clips the year (`22/07/202`), `width:120px`, no DOM signal | P7 | **OPEN** | `app.css:555-556` not changed |
| F-28 | 3.F-v | S10 | Navigating to Catalog scrolls the search box off-screen while telling you to use it | P7 | **OPEN** | `cNavGo('catalog')` `scrollIntoView` unchanged |
| F-29 | 3.F-v | S10 | Occupancy tile labels truncate to 2–3 chars; full name only in dead `title=` | P7 | **OPEN** | `app.js:568` `Math.max(18,…)` unchanged |
| F-30 | 3.F-v | S3 | "Cannot check capacity" then reports a capacity conflict on the next line | P5b | **OPEN** | Capacity unification (one verdict, D6) not shipped |
| F-31 | 3.F-v | S3 | SV bath over-capacity described in Hebrew as *area* overflow for volume devices | P5b | **OPEN** | `bad='area'` for any over-verdict; capacity unification not shipped |
| F-32 | 3.F-v | S10 | Short-time warning ungrammatical both languages (`ב-אתמול`); reports raw minutes (`1627 דק׳`) | P7 | **OPEN** | Not addressed |
| F-33 | 3.F-v | S7/S10 | Row chevrons never mirror — hard-coded `←` in English | P7 | **OPEN** | Not addressed |
| F-34 | 3.F-v | S10 | "⎙ PDF" print button appears on every panel incl. first-run modal + language picker | P7 | **OPEN** | Shared `toolTop` header unchanged |
| F-35 | 3.F-v | S10 | Projects header block reads as broken (title box 68×72, chips wrap raggedly) | P7 | **OPEN** | Not addressed |
| F-36 | 3.F-v | S10 | Type, space, radius not tokenised (34 font sizes, 24 paddings, 21 radii) | P7 | **OPEN** | No `--space/--radius/--type` tokens in app.css; only `--r` radius token, redefined per theme + used ~few times. Colour tokenised (the counter-example) — matches charter S10 |
| G-1 | 3.G | S9/S7 | "Works with no network" claim in 4 places, both languages — contradicts online-first decision | P0/P2 (R8/R11) | **PARTIAL** | Footer offline claim (was `build.py:334`) **removed** — footer now "…נשמרים בדפדפן"; BUT about panel `app.js:4778-4779` ("קובץ אחד. בלי שרת" / "בלי התקנה, בלי חשבון, בלי שרת") and `README.md:4` ("fully local-first") **still stale** |
| G-2 | 3.G | S4 | No unified `mk-schema` migration registry (since ROADMAP-v149) | P5b | **OPEN** | Charter puts migration registry in P5b (not started) |
| G-3 | 3.G | S11 | Zero analytics anywhere — every allowance/tier/threshold is a guess | P10 | **DEFERRED (R8)** | Charter §12 "do not monetise now"; analytics deferred with pricing |
| G-4 | 3.G | S11 | No account system; managed code is a 72-bit bearer, no device binding, CORS `*` | P10 | **DEFERRED (R8)** | Accounts deferred; CORS still `*` (worker unchanged, see H-3) |
| G-5 | 3.G | S11 | No cloud sync (deliberately deferred pending a business decision) | P10 | **DEFERRED** | Owner-deferred by original design |
| G-6 | 3.G | S2/S3 | No probe integration, no log-import path (staged rec §7 step 12) | P7/later | **DEFERRED** | Staged future recommendation; not scheduled in v261–v272 |
| G-7 | 3.G | S9/S10 | Dead surface: 9 orphan fns, 4 stubs, ~70 lines dead theme CSS, 14/15 dead `data-i18n` | P7 | **OPEN** | No cleanup shipped; overlaps F-5. E1–E3 added code, did not remove the orphans |
| G-8 | 3.G | S5 | 116 empty catches (`catch(e){}`) — majority legitimate PE guards | P7 | **OPEN** | Not swept; the user-visible exceptions live in §3.B.12/§3.B.25 |
| H-1 | 3.H | S11 | No billing code anywhere | P10 | **DEFERRED (R8)** | Charter R8 pricing deferred; §12 "do not monetise now" |
| H-2 | 3.H | S6/S5 | Metering blind to ~90% of cost (grounded-search per-request fee unmetered); 2M cap authorises ~$16 meters ~$1.60 | P10 / P0-app | **DEFERRED (R8)** | Full metering deferred (P10). Underlying **cost** partly mitigated by P0-app search-conditional target ($1.22→$0.39) + v263 token metering; but search-fee metering itself not built |
| H-3 | 3.H | S6 | Four Worker revenue blockers: fail-open, cap-by-omission, TOCTOU, zero rate limiting | P0-worker | **OPEN** | 🔴 `worker/index.js` still 91 lines; CORS still `'*'`; no `429`/`Retry-After`/rate-limit/debit-first. P0-worker ("Blocked on PRE-3") shows no ship in v261–v272 |
| H-4 | 3.H | S11 | Measured unit economics (blended $1.22/mo; 77–90% is the $0.035 search fee) | P10 | **DEFERRED (R8)** | Analysis finding; pricing deferred |
| H-5 | 3.H | S11 | Two business reports contradict 10.9×; reconciliation kills the drafted allowance model | P10 | **DEFERRED (R8)** | Analysis finding; pricing deferred |
| H-6 | 3.H | S11 | Minimum viable price $4.99 floor / $7.99 defensible; margin positive only after search fix | P10 | **DEFERRED (R8)** | Pricing deferred |
| H-7 | 3.H | S11 | Free/paid boundary the code already earns: deterministic free, probabilistic (search) metered | P10 | **DEFERRED (R8)** | Packaging decision deferred |
| H-8 | 3.H | S11 | Market reality: TAM $40–80M · SOM $90k–255k ARR; Israel Y3 ≈ $38k — not venture-scale | P10 | **DEFERRED (R8)** | Analysis finding |
| H-9 | 3.H | S11 | Competitive claim `docs/ai-strategy.md:77` "Nobody owns the software-first AI copilot" overstated | P10 (R8 marketing) | **OPEN** | R8 says correct now; `ai-strategy.md:77` **still says** "**Nobody owns** the software-first AI copilot … offline" — NOT corrected |
| H-10 | 3.H | S11/S2 | Real differentiation measured (Hebrew-first, cited corpus, capacity scheduler); BUT "guards your cure" is a claim the code doesn't earn | P2 (R8 marketing) | **OPEN** | Differentiation confirmed (279 `src` blocks). Cure-guard claim still unearned: cure guard remains advisory — P2 (cure task blocks without a 0.1g scale) not shipped in v261–v272 |
| H-11 | 3.H | S11 | Anova is licence-blocked (personal/non-commercial ToU) — reclassify to hobbyist only | P10 | **DEFERRED (R8)** | Documentation reclassification; no integration exists; commercial track deferred |
| H-12 | 3.H | S11 | Honest recommendation adopted: do not monetise now — problem is unbounded cost, not missing revenue | P10 | **DEFERRED (owner-adopted)** | This IS the R8/§12 decision. A1/A2 flagged as paid-launch blockers, not current bugs |
