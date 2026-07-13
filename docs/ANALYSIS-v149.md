# מתכונת אש — Deep Analysis v149

**Date:** 2026-07-13 · **Branch:** `improvements` (off `main`@v149) · **Method:** 10 parallel read-only specialist analysts over `build.py` + data modules. Findings below are de-duplicated across agents, ranked by impact/effort, and the flagship items were re-verified against live code (line refs are in `build.py` unless noted).

> **How to read this:** Start with **§1 Do-First (the 6 P0s)** — these are either safety, security, or "the app can't do its main job." Then **§2 Cross-cutting themes** (one fix pays off in several dimensions). **§3** is the full per-dimension catalogue. **§4–5** are the two new strategic tracks you asked for — multilingual and business model — plus the standalone-vs-`matkonet`-module architecture note.

---

## §1 · Do-First — the 6 P0s

| # | Finding | Dimension | Effort | Why now |
|---|---------|-----------|--------|---------|
| **1** | **Cure safety warning is silently suppressed on 47 cured sausages** | Content/Safety | **S** | Highest safety-per-effort in the whole review. One-line builder fix. |
| **2** | **AI output → HTML injection → localStorage/API-key exfiltration** | AI/Security | **M** | Prompt-injected markup can read the user's Gemini key + all local data and exfiltrate it. |
| **3** | **Catalog is a dead-end — you can't add a catalog item to a menu** | UX | **M** | `toggleCart()` is defined but never wired to any control. The core loop is broken. |
| **4** | **Cook drafts never resume; "continue" routes to the wrong screen** | UX | **S** | Validates `mk-menu` instead of `mk-cook`, then opens the list not the plan. |
| **5** | **The entire UI is keyboard-inoperable** | Accessibility | **L** | Cards, home paths, and every wizard chip are non-focusable `<div>`/`<span>` with no `keydown` handler. |
| **6** | **Wrong nitrite (Cure #1 vs #2) on long-dried sausages** | Content/Safety | **S** | Kabanos & Landjäger instruct Cure #1 + sub-safe salt on multi-day unrefrigerated products. |

### 1 — Cure warning suppressed on 47 sausages *(verified live)*
`sausages_new.py` `SG()` writes the cure **rate** (`2.5`) into `calc.cure`, but the calculator gates its safety warning on the cure **type**: `build.py:2525` → `calc.cure==='2' ? '⚠ מוצר מיובש לא מבושל — דיוק ה-Cure קריטי…'`. Since `2.5 !== '2'`, **47 dried/fermented makes** (all SG sausages + `m-frank/morta/…`, all `sal-*`) render a nonsensical "Cure #2.5" **and show no warning and no 156 ppm note** — exactly the products where nitrite dosing is most dangerous. **Fix:** in `SG()` set `calc.cure` to the type (`'1'`/`'2'`, inferred from Cure-#2/dry/smoke) and put `2.5` in `cureRate` (the JS already reads `calc.cureRate||2.5`).

### 2 — AI-XSS / key exfiltration *(verified live)*
No `esc()`/`escapeHtml` helper exists anywhere in `build.py`, yet AI responses are rendered into the DOM via `innerHTML` (73 `innerHTML` sites total). Three AI paths run with `google_search` grounding on (`build.py:4283, 4341, 5099`), so model output can include attacker-influenced content. A response containing `<img src=x onerror=…>` executes with access to `localStorage` — which holds the **Gemini API key** (`mk-gemkey`) and every user record — and can POST it anywhere. **Fix:** add a single `esc()` helper; render AI free-text as `textContent` or through an allowlist sanitizer before any `innerHTML`; never interpolate raw model output into an HTML string. This is the one bug that turns "bring your own key" into "lose your own key."

### 3 — Catalog dead-end *(verified live)*
`toggleCart()` exists at `build.py:2124` and appears **exactly once** in the file (defined, never called). Catalog cards and item panels expose no "add to menu" affordance, and empty states reference a "+" button that doesn't exist. A user browsing the 279-item catalog has no path to put anything on a menu — the wizard is the *only* way in. **Fix:** wire `toggleCart()` to an add/remove control on cards and in `openCut/openSpec/openMake`; reconcile the empty-state copy.

### 4 — Broken cook resume
The "continue cooking" flow checks for a saved `mk-menu` instead of the `mk-cook` draft it should validate, and then routes to the catalog list rather than the saved plan. Drafts are effectively unresumable. **Fix:** validate `mk-cook`; route to the plan view with the saved state.

### 5 — Keyboard-inoperable UI
Catalog items are `<article class="card">` (`build.py:2206+`), home paths are `<div class="cpath">` (`1336+`), and every wizard selector is a `<span class="cmethod"/".chip">` — none have `tabindex`/`role`, and they're opened purely by a delegated `click` listener (`build.py:3190`) with **no `keydown` companion**. A keyboard or switch-access user cannot open a recipe or make a single choice. **Fix (central):** add a sibling `keydown` handler at `3190` firing the same logic on Enter/Space for `[data-cgo],[data-cwm],[data-app],.chip,.card`, plus `tabindex="0"`+`role="button"` on those templates. (RTL and reduced-motion, by contrast, are genuinely well done.)

### 6 — Wrong nitrite on dried sausages
`n-kabanos` / `n-landjager` pass `cure="…(Cure #2 עדיף)"` but the builder prefixes `Cure #1`, yielding a self-contradictory label on long-dried products that require **Cure #2**; kabanos salt is 1.8% (below the water-activity hurdle). **Fix:** pass the full `"Cure #2 …"` label for dried SG sausages; raise dried-sausage salt to ~28 g/kg (see §3 Content #7).

---

## §2 · Cross-cutting themes (fix once, win several places)

These were flagged independently by multiple agents — do them as shared infrastructure, not per-symptom.

- **T1 · Safety numbers baked into prose.** Both the **content** and **i18n** agents converged here: cure %, salt, and internal temps live inside free-text phase strings (`sausages_new.py:11,16`; `"חלוט 75-80° (לא רתיחה!)"`). Today that's a data-integrity risk; the moment translation ships it's a *botulism* risk (a mis-translated "לא רתיחה" / "do not boil"). **Shared fix:** extract every safety number into structured fields rendered through the existing `calcBox` path (numbers from data, labels around them) so they bypass both display bugs *and* translation. Tag any residual safety prose `noMT`.

- **T2 · Extract CSS/JS out of the Python string templates.** The **architecture** agent's keystone: pull the `<style>` and `<script>` blocks into real `app.css`/`app.js` files concatenated into the shell at build time (raw string, **zero interpolation → near-zero risk**). This is the enabler for almost everything else — real tooling (a bundler, an eslint pass that would have caught the missing `esc()`), the `t()` i18n seam, and a clean **module boundary** for `matkonet`. Do it early; it's mechanical.

- **T3 · `store`/`DATA` parsing.** PWA, performance, and architecture all hit the state layer: `const DATA = __DATA__` (`build.py:1499`) is parsed as a **JS object literal**, not `JSON.parse('…')` (measurably slower cold-start; one-line build change), the 888 KB blob is parsed **entirely at startup** even though `src` citations (251 KB) and seasonings (200 KB) are only needed on demand, and `store.set` **swallows quota errors** (silent data loss). **Shared fix:** `JSON.parse` the DATA blob, lazy-load the citation/seasoning sub-blobs, and make `store.set` surface quota failures.

- **T4 · No service worker.** PWA, performance, and architecture all note the app claims "PWA" but ships no SW — no offline, no install-quality caching, and the 8-font CDN load blocks first paint. **Shared fix:** add a minimal cache-first SW for the shell + fonts + lazy language bundles; subset the fonts to the ~2 actually used by default.

- **T5 · Theme + `--fscale` correctness.** The **UI** agent: the dark "charcoal" theme is broken (hard-coded light colors leak through), while — per the **accessibility** agent — the *default* "Warm Cream" theme fails AA contrast on the category label (1.92:1), the "popular" tag (2.95:1), and the saved badge (1.80:1). Ironically charcoal has excellent contrast where it isn't broken. **Shared fix:** move small-text roles onto passing tokens; repair the charcoal overrides; contain `--fscale` leaks.

- **T6 · Data-pipeline drift (safety-adjacent).** `gen_sources.py` applies MAKE calc overrides but only **reports** researched CUT/SPEC value changes without applying them — verified values silently don't reach the app. Reconcile the pipeline so researched values land (with the P3 "never guess safety numbers" rule intact).

---

## §3 · Full findings by dimension

### Architecture
- **[P0] T2** — extract CSS/JS to `app.css`/`app.js`, concatenate at build. Keystone refactor; unblocks tooling, i18n, and the module boundary.
- **[P1] T6** — data-pipeline drift: researched CUT/SPEC values reported, not applied.
- **[P1] T3** — `store` parses/serializes on every access; no schema/versioning on `mk-*` keys.
- **[P2]** — `build.py` is a 7,450-line monolith of string templates; no build-time validation. After T2, add a lint/format pass.

### UX
- **[P0 #3]** catalog dead-end (`toggleCart` orphaned).
- **[P0 #4]** broken cook resume.
- **[P1]** empty states reference a phantom "+" affordance; onboarding popup can intercept first clicks.
- **[P2]** wizard has no visible progress/state persistence if interrupted; back-arrow ambiguity in RTL.

### UI / visual
- **[P1] T5** — charcoal dark theme broken (hard-coded light colors).
- **[P1]** `--fscale` leaks into unintended elements at large text sizes.
- **[P2] T4** — 8 font families loaded from CDN, ~2 used by default; blocks paint.
- **[P2]** inconsistent spacing/scale tokens across panels.

### AI / security
- **[P0 #2]** AI output → `innerHTML` with no `esc()` → key/data exfiltration.
- **[P1]** BYOK key stored in plain `localStorage` (unavoidable client-side, but see §5 managed-AI); no rate-limit/abuse guard on the grounded chat path.
- **[P2]** AI prompts are Hebrew-hardcoded (interacts with §4 i18n); `AI_JSON_SYS` correctly refuses to emit safety numbers — keep that invariant.

### PWA / offline
- **[P0/P1] T4** — no service worker; app is not actually installable/offline-capable.
- **[P1] T3** — `store.set` swallows `QuotaExceededError` → silent data loss for curing logs/journals.
- **[P2]** no manifest polish (icons/splash), no update-prompt flow.

### Performance
- **[P1] T3** — `DATA` parsed as object literal, not `JSON.parse`; whole 888 KB blob parsed at startup.
- **[P1]** search re-renders all 279 cards with a `localStorage` read + regex **per card, per keystroke** — visible mobile jank. **Fix:** debounce, ratings **Map**, memoize `kosherStatus`.
- **[P2]** `src` citations (251 KB) + seasonings (200 KB) are cold-start parsed but on-demand-used → lazy-load.
- **Verified strengths:** gzip transfer is fine (~337 KB); card listeners are already delegated (no leak). This is a **main-thread parse/re-render** problem, not bandwidth.

### Accessibility
- **[P0 #5]** keyboard-inoperable core UI.
- **[P1] T5** — default theme fails AA contrast (measured: 1.92 / 2.95 / 1.80:1).
- **[P1]** timers: icon-only unlabeled buttons, no `aria-live` countdown, and the "alarm" constructs an `AudioContext` but **plays no sound for anyone** (real bug).
- **[P2]** toggles expose no `aria-pressed`/`aria-selected` (wizard state invisible to AT); unlabeled steppers/back-arrows; heading-level skips.
- **[P3]** sub-44px tap targets; no skip-link; focus lost on in-place re-renders.

### Content & data quality
- **[P0 #1]** `calc.cure` = 2.5 suppresses warning on 47 makes.
- **[P1 #6]** Kabanos/Landjäger wrong-nitrite + sub-safe salt.
- **[P1]** 6 duplicate seasonings leak to the picker (dedup only runs EXT-vs-BASE, not within BASE); "דזטיקי" (tzatziki) misspelled, "תום" (toum) mistranslit — the correct spellings exist but lose the dedup coin-flip.
- **[P2]** 18 makes have no `calc` at all (incl. safety-critical `m-sopr/sauci/cacc/nduja/sucuk`); dried-sausage salt inconsistent across the two systems (22–24 vs 28–30 g/kg).
- **[P2]** 28 of 47 SPECIALS (the cheeses) have no rich description; 12 house rubs carry no flavor/heat tags though they're the default rub for every cut.
- **[P3]** Arabic letters inside the Hebrew "תورينגיה" origin; geresh-vs-apostrophe inconsistency (also weakens dedup); glossary misses terms the recipes use (equilibrium curing, confit, dextrose, Fermento, spatchcock).
- **Verified strength:** source citations are **100% coverage — 1008 ref blocks, 0 missing URLs**, reputable domains. The editorial/safety moat is real and monetizable (§5).

---

## §4 · New track — Multilingual + smart translation

**Baseline (measured):** ~233K translatable Hebrew chars — **24% UI chrome / 76% data-driven content**. No app-level i18n exists today; the only bilingual code is the voice-cook feature (`vcTranslateToEn`, cache Map) — a working prototype to generalize.

**Recommended architecture (5 bullets):**
1. **One seam:** a build-time-generated `t(key)` table with **Hebrew inlined + fallback**, plus `curLocale()` for date/number formatting and `dir` — all derived from a single pluggable `getLang()`.
2. **Split by risk:** UI chrome + glossary + category labels + **all cure/temp/pasteurization strings** are **static & human-reviewed**; long-form catalog prose is **AI-translated at runtime** (existing Gemini path); numeric safety outputs stay language-neutral via `calcBox` (this is **T1**).
3. **Protect the numbers:** extract embedded numbers into structured fields; guard any residual MT with a numeric-invariant check (the `°/%/ג׳/ק״ג` token multiset must be unchanged) + a `noMT` flag.
4. **Keep the file lean:** inline **only** Hebrew; ship small static `lang.<code>.json` (chrome + names + safety) lazily via the SW; **persist** AI content translations in `localStorage` keyed by `hash+lang+dataVersion` — never pre-bake 177K chars/language into the bundle.
5. **Order:** `en` first (validates the LTR path + the ~12 physical CSS rules that need `dir`-awareness), then `ar`/`ru` (large IL audiences; `ar` exercises RTL-with-shaping), then `es`/`fr`/`de` (rich BBQ/charcuterie vocabulary, mostly AI-assisted).

**Trap to avoid:** `eng` is **load-bearing control flow** (7 recipe branches switch on `c.eng.includes('Garlic'/'Ribs'/…)`), not a spare translation slot. Freeze it as a language-neutral id; add a separate localized display-name map keyed by the stable item key.

**Phasing:** **P0** = T1 safety guard + `t()` seam + locale/`dir` plumbing. **P1** = English static chrome + AI content cache + persistence + module locale seam. **P2** = additional languages.

---

## §5 · New track — Business model / monetization

**The counter-intuitive core:** in a single view-source-able 1.5 MB HTML, *anything shipped to the client can be pirated* — so **server-gated AI is the only thing that paywalls cleanly**, and the BYOK design already routes all 7 features through one seam (`aiJSON()`/`askGemini()`), making a managed proxy a one-endpoint swap.

| Bet | Model | Margin / cost | Effort | Priority |
|-----|-------|---------------|--------|----------|
| **Managed-AI tier** | ₪19–29/mo; app brings the key via a Cloudflare Worker proxy | ~$0.30–1.50/user/mo → **80–95% margin** (calls are deliberately cheap: `thinkingBudget:0`, tight caps) | M standalone / S as module | **P0** |
| **Affiliate / commerce** | Contextual buy-links in the *already-built* charcoal-supplier guide (`3881`), gear-gap "purchase suggestion" (`4013`), per-make materials (`7057`) | ~$0 run-cost, ships in the HTML | **S** | **P1 — do now** |
| **Premium "Craft" packs** | ₪29–59 each / ₪99 lifetime for advanced charcuterie/cure programs | ~$0; rides the verified-source moat + safe-cure calc | M (authoring + soft license) | P1 |
| **B2B "Pro"** (caterers/butchers) | ₪99–199/mo — multi-event scheduler, branded PDFs, kosher-safe menus | needs accounts/billing | L | P2 |
| **License the verified dataset / white-label** | flat/per-unit to appliance & meat brands | enterprise motion | L | P3 |

**The BYOK crux:** BYOK is $0 for you but the single highest adoption wall — the mobile-first Hebrew user won't create a Google AI Studio key, so the AI (the best part) is invisible to most. **Managed AI is the natural first paywall**; keep BYOK as the free/power-user tier to soften "you monetized the AI."

**Standalone vs. module-in-`matkonet`:**
- **matkonetesh owns** (fits local-first, no-account): **affiliate + content packs**.
- **The `matkonet` platform owns** (infra with scale across verticals): **managed AI + accounts/sync + B2B billing**. matkonetesh becomes the platform's **premium "Fire & Charcuterie" vertical** and an **acquisition funnel**; the verified-source moat is what justifies charging for the platform at all.
- **Don't** build a second payments/accounts stack in matkonetesh if `matkonet` is imminent — build the Worker proxy only if you need standalone revenue *before* the platform ships.

**Recommended sequence:** ① affiliate commerce (S, now) → ② managed-AI tier (as the platform's tier if imminent, else a Worker) → ③ Craft packs → ④ B2B/licensing later.

---

## §6 · Suggested execution roadmap

- **Wave 0 — Safety & security hotfix (S–M, do immediately):** #1 cure warning, #6 nitrite labels, #2 AI-XSS `esc()`. Small, high-stakes, shippable to `main` before anything else.
- **Wave 1 — Make the app work (S–M):** #3 catalog→menu, #4 cook resume, #5 keyboard operability (central handler first), T5 default-theme contrast. This is "the product does its job for everyone."
- **Wave 2 — Foundations (M):** T2 extract CSS/JS, T3 `JSON.parse`+lazy-load+`store` quota, T4 service worker + font subset, search debounce/memoize. Enables everything after.
- **Wave 3 — Strategic tracks (M+):** i18n P0 (T1 + `t()` seam + English), then managed-AI + affiliate. Sequence per §4/§5 and the eventual `matkonet` PRD.

*Open decision for you:* which wave(s) to green-light, and whether the i18n and monetization foundations should assume the `matkonet` platform (defer accounts/AI infra to it) or ship standalone-first. I have not started any implementation.
