# ULTIMATE Knowledge & Gaps — matconetesh (Matkonet · מדריך האש), v258

**Date:** 2026-07-22 · **Version described:** v258 (`build.py:334` footer stamp, `מהדורה 258 · 22.7.26`)
**Basis:** the 2026-07-22 discovery sweep — 8 Wave-1 discovery reports, 8 Wave-2 adversarial verification
reports, 5 Wave-5 measurement/second-opinion reports, 3 Wave-4 business reports, cross-referenced against
`2026-07-22-status-and-gaps.md` and the roster in `2026-07-22-discovery-sweep-roster.md`.

**Standing rules this document was written under.** Evidence or it does not exist — every claim carries a
`file:line`, a test name, a measured number, or a primary-source URL. Unverifiable claims are dropped, not
softened. **Where a Wave-1 finding was REFUTED in Wave-2, it does not appear in the gap list at all** — it
appears in §4, which is a first-class deliverable, because the pattern of false alarms is itself one of this
project's most important findings.

**Reading paths.** Product/strategy → §1, §2, §3.H, §7. Engineering → §1, §3.A–§3.F, §6, §7.
Auditors and anyone about to re-run this exercise → §4 first, then §5.

> **Note on a missing input.** `docs/analysis/sweep/W1-GRAPH-docs.md` was named in the synthesis brief but
> does not exist in `docs/analysis/sweep/`. No knowledge-graph findings are incorporated. This document
> therefore covers code, specs, the running app, domain science, non-functional properties and business —
> not a document-graph analysis.

---

## Table of contents

1. [What this app IS](#1-what-this-app-is)
2. [What is genuinely delivered and solid](#2-what-is-genuinely-delivered-and-solid)
3. [Gaps, ranked, by band](#3-gaps-ranked-by-band)
   - [A · SAFETY](#3a--safety-close-first) · [B · Correctness](#3b--correctness) ·
     [C · Orchestrator & workflows](#3c--orchestrator--workflows) ·
     [D · Equipment-to-plan](#3d--equipment-to-plan) · [E · AI](#3e--ai) ·
     [F · Non-functional](#3f--non-functional-i18n-a11y-pwa-perf) ·
     [G · Product-platform](#3g--product-platform) · [H · Business](#3h--business-and-monetization-unstarted)
4. [Corrected claims — the refutation ledger](#4-corrected-claims--the-refutation-ledger)
5. [Contradictions between documents, and orphaned specifications](#5-contradictions-between-documents-and-orphaned-specifications)
6. [What no document covers — the surfaces only the running app revealed](#6-what-no-document-covers--the-surfaces-only-the-running-app-revealed)
7. [Recommended closing order, with reasoning](#7-recommended-closing-order-with-reasoning)
8. [Confidence, and what the sweep could not settle](#8-confidence-and-what-the-sweep-could-not-settle)

---

## 1. What this app IS

### 1.1 The product, in one paragraph

Matkonet (מתכונת · מדריך האש, "Fire Guide") is a **Hebrew-first, mobile-first cooking-orchestration PWA for
live-fire and low-temperature cooking** — smoking, sous-vide, grilling and charcuterie. It is not a recipe
app with timers bolted on. Its centre of gravity is a **plan**: the user picks dishes and a serving time, and
the app works *backwards* to produce a scheduled, equipment-aware, capacity-checked work plan with tasks,
timers, internal-temperature gates and a live-cook copilot. The distinguishing assets are (a) a **cited**
recipe corpus — 279 `src` blocks across 130 cuts, 47 specials and 102 makes, traced to USDA FSIS, 9 CFR and
Baldwin's pasteurization tables — and (b) a **physical capacity model**: the app knows how much grate area a
brisket claims, how many shelves your cabinet has, and how many litres your sous-vide bath holds. No
competitor found in the Wave-4 survey models rack space at all.

### 1.2 Architecture

**A single-file PWA, authored in Python, built by one script, served from Cloudflare Pages, with one
outbound network call site.**

```
Authoring (Python, source of truth)          build.py (the only build step)      Output
──────────────────────────────────           ────────────────────────────        ──────
data.py            130 CUTS · 47 SPECIALS    :29-82  merge sausages,             index.html          (repo root, 2,701,065 B)
                   · MAKES · GLOSSARY                descriptions, seasonings    dist/index.html     (byte-identical)
sausages_new.py    52 NEW_SAUSAGES           :85-105 merge cited sources         dist/sw.js          (cache name = md5(html)[:8])
sources.py         4,931 lines, generated    :96-102 'calc' key SKIPPED          dist/_headers
  ← gen_sources.py ← scratch/research/*.json :110-116 equipment_map.apply        dist/manifest + icons
equipment_map.py   derives recipe.equip      :118-127 payload → DATA_JSON        site/  (flattened)
descriptions.py · house_rub_map.py           :352-377 lang/*.json + *.data.json
seasonings*.py                                        → I18N_DICTS_JSON
                                             :129-342 HTML template
app.js   9,564 lines, no ES modules          :378    __CSS__ __JS__ __DATA__
app.css  1,710 lines                                 __I18N_DICTS__ substituted
lang/    en.json 309 · en.data.json 3,677
         fr/de/es 83 keys each
```

Runtime is a single HTML document (2,689,578 bytes decoded, **659,999 bytes on the wire** — the origin
compresses 4.07:1). All five screens (`home`, `wizard`, `catalog`, `events`, `projects`) exist in the DOM
simultaneously and are toggled by an `.on` class; measured rects confirm `scr-home 390×1271` and the other
four at `0×0` (W5-A §3.3). Persistence is `localStorage` through `store.get/set` (`app.js:1433-1435`) with a
throttled quota warning (`mkStorageWarn`, `:1438`).

**Network.** There is exactly **one** `fetch()` call site in `app.js` — line 4223, inside `gemFetch`
(`app.js:4208-4236`), verified by grep with no `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket` or
dynamic `import()` anywhere (VERIFY-W1-A C15). Two modes: **managed** (through a Cloudflare Worker holding
`GEMINI_KEY` as a Wrangler secret, gated on an `X-Access-Code` checked against a KV store) and **BYOK** (the
user's own key, `x-goog-api-key` header). Google Fonts loads separately via `<link>` at `build.py:144-146`.

**Model dependency.** `const GEM_MODEL='gemini-2.5-flash'` at `app.js:4206`; TTS via
`gemini-2.5-flash-preview-tts` at `app.js:5030`.

### 1.3 The core loop, as built

```
menuState().keys  →  buildList (app.js:5653)
   → itemProfile (2922) → activeMethods (832)      resolve which methods are on
   → itemStages (3213)                             emit prep/sv/dry/smoke/cook/rest
                                                   + bcheck when safe|tgt is numeric (3260-3261)
   → equipPlan (973, called 5673)                  PURE enrich: adds fuelNote / refuelEveryMin only
   → planSchedule (2978, called 5678 and 7850)     PURE backward relaxation — every item ends at serve
   → [caller mutates stages .start/.end at 5679]
   → schedulePlacements (3089, called 5691)        PURE capacity placement, pull-earlier within 2 h
   → [shift applied at 5704-5706 iff uniform non-zero slack, 5701-5702]
   → safetyDiff (3039, checked 5712-5718)          runtime invariant: kind|hours|temp|safe unchanged
   → workPlanHtml (5771) → window._wpTasks (5878)
        → renderWpVertical (5934) / Accordion (5945) / Horizontal (5952)
        → wireTimer (2326) · _copilotStages (5362) · openVoiceCook (5517)

cross-event:  combinedEventsRows (7832) → itemStages ✔ → planSchedule ✔
              equipPlan ✘   schedulePlacements ✘   blocked/multiDay ✘
```

The single-event path is the real product. The cross-event path is a **different, weaker product** built from
two of the five stages (VERIFY-W1-G §5.3, confirmed).

### 1.4 The domain model

- **177 catalogued items** (130 cuts + 47 specials) plus 102 "makes" (from-scratch builds), each carrying a
  merged `src` citation block. Cut ids 1..130 contiguous, special ids 1..47 contiguous, no gaps or duplicates
  (VERIFY-W1-E C16).
- **`safe`** = the pathogen-kill floor (63 / 71 / 74 °C by category, matching USDA FSIS). **`tgt`** = the
  texture target, which may legitimately sit *below* `safe` on **36 cuts** because sous-vide pasteurizes by
  time×temp — documented in the app's own glossary at `data.py:228`.
- **`bcheck`** = an internal-temperature stage kind emitted for every item with a numeric `safe`/`tgt`.
- **Cure/nitrite** = `calc.cure` is a *type* discriminator (`'1'`/`'2'`) with the rate in `calc.cureRate`;
  156 ppm ingoing for comminuted products, 120 ppm for bacon.
- **Equipment 2.0** = a device registry (`mk-equipment`) over 16 typed categories in `EQUIP_CATS`
  (`app.js:34`), each with capacity keys (`racks`, `areaCm2`, `baths`, `hooks`, `channels`, `maxC`) and typed
  `props[]` with units and bounds.
- **Occupancy** = `deviceCapacity` (305) × `itemOccupancy` (356) → `deviceOccupancy` (438-519) → per-slot
  packing (`packDevice`, 403), a fit ladder (`out.fit`, 499-515), compatibility (`occupancyCompat`, 375) and
  hanging-hook overflow (`hooksOver`, 516), rendered as **device silhouettes** (cabinet / offset / grill /
  vessel / hanging bay) rather than percentage bars.

### 1.5 The AI surface

**14 distinct Gemini entry points**, all live and reachable from real UI (13 catalogued by W1-F, plus
`vcTranslateToEn` found in verification):

| # | Feature | Core fn | Guard tier |
|---|---|---|---|
| 1 | Ask the Fire (chat) | `askGemini` 4237 | **A** — `askRefuse` 4448 + `aiSafetyNote` 4454 |
| 2 | Photo analyzer | `gemVision` 9296 | **B** — `aiSafetyNote` vs `SAFETY_FACTS()` 9326 |
| 3 | Live Cook Copilot "what now" | `copilotAskNow` 5448 | **B** — `aiSafetyNote` 5464, no `askRefuse` |
| 4 | Diagnose-a-cook | `aiDiagnose` 8475 | **C** — `aiSafetyCaveat` 8499 only |
| 5 | Journal insights | `aiJournalInsights` 8646 | **C** — `aiSafetyCaveat` 8664 only |
| 6 | **Voice Cook hands-free Q&A** | `vcAskAI`/`vcAskFlow` 5269-5300 | **D — none** |
| 7 | **Voice Cook content translation** | `vcTranslateToEn` 5186/5196 | **D — none** |
| 8-12 | Recipe-gen · event planner · what-can-I-make · pantry advisor · seasoning rec | 8563 · 8314 · 8182 · 9169 · 8406 | structural: catalog-key validators; cure/salt numbers never asked of the model (8571) |
| 13 | Equipment spec lookup | `aiLookupDevice`/`aiBrandModels` 6306/6368 | range/unit sanity 6338-6363 |
| 14 | Data-MT translation | `mtTranslate` 6962 | `mtGuard`/`mtNumSig` numeric-invariant 6956-6958 |

`AI_TOOLS` (`app.js:9330`) lists only 5 of the 14; the rest live at their point of use.

### 1.6 Development and verification posture

- **82 Playwright spec files**; `tests/*.spec.ts`. The commit that closed occupancy Phase 2 (`92961db`) names
  four defects found *by viewing rendered screenshots*, which is direct evidence the plan's own §10.2 viewing
  discipline was followed.
- **No CI exists.** `ls .github` → absent; `package.json` `"test": "echo \"Error: no test specified\" && exit 1"`.
  The suite runs only when a human types `npx playwright test` (VERIFY-W1-F R1).
- **No module system.** `typeof X==='function'` appears **482 times across 427 lines** (W5-E re-measurement;
  W1-A said 483 — a regex-variant artifact). This is the de-facto module system, and the structural cause of
  the "inert shipment" failure mode.
- **No minifier** anywhere in `build.py`.
- **The owner's standing product decision (2026-07-22): the app is ONLINE-FIRST with an AI key.** Offline
  purity is explicitly not the standard. Shipped copy has not caught up — see §3.G.1.

---

## 2. What is genuinely delivered and solid

Each row below survived adversarial verification. These are the load-bearing assets; nothing here should be
re-litigated.

### 2.1 The cited corpus — verified end to end

| Claim | Evidence |
|---|---|
| **279 `src` blocks ship**: 130/130 cuts, 47/47 specials, 102/102 makes | VERIFY-W1-E C1 replicated the full pipeline (`MAKES.update(NEW_SAUSAGES)` first per `build.py:29`, then the `sources.py` merge per `:87-103`): `makes WITHOUT sources: []`, `orphan MAKE_SOURCES keys: []` |
| Every one of the 130 cuts carries a `src.safe` sub-citation | VERIFY-W1-E C1 |
| Recipe→equipment tagging is complete | `equipment_map.apply(CUTS, SPECIALS, MAKES)` executed for real: **279 recipes tagged, `uncovered` = 1** = Halloumi (correct — a direct-grill cheese) |
| Hang-classification derived at build time = **28** specs, inside the plan's own [10,40] gate | Counted in the **built** `dist/index.html`, not a source grep (VERIFY-W1-B C8) |
| Data integrity clean on the joins | `CUT_DESC`→CUTS 130/130, `SPEC_DESC`→SPECIALS 19/19, 0 orphans; `MAKES.update` id collisions 0 (50+52→102); `build.calc` sanity across all 102 makes: 0 issues (W5-C §2.3) |

### 2.2 The food science — none disproved

- **`safe` floors match USDA FSIS** by category: beef/lamb/pork whole-muscle 63, poultry 74, ground 71,
  fish 63, shellfish 63, produce none (VERIFY-W1-E C9).
- **Ground meat is genuinely modelled, not just labelled.** Kebab (`data.py:22`, `svt=55 svh="2-3" safe=71
  tgt=65`) and Hamburger (`:23`, `svt=55 svh="2.5" safe=71 tgt=55`) cite Baldwin's **ground-as-slab** table
  verbatim ("55C 20mm=2.5h… Hold ≥2h after core reaches 55C") and the citation records a *correction actually
  applied* (hamburger 1.5h → 2.5h). VERIFY-W1-E C10.
- **Nitrite dosing is regulatorily precise.** 156 ppm = the USDA comminuted ingoing maximum, derived
  arithmetically in `2026-07-21-nitrite-dosing-threshold.md:45,49` against 9 CFR 424.21 (VERIFY-W1-E C11).
- **Anisakis/parasite risk reaches the user through five paths**, not just a citation: fish prep step
  (`app.js:1381`), the safety-check step (`:1388`), the troubleshooting FAQ (`:3823-3824`, matching FDA's
  −20 °C/7 d or −35 °C/15 h rule), an AI-tooltip regex (`:4089`), and the glossary (`data.py:230`).
  VERIFY-W1-E C13.
- **Technique modelling is coherent**: sous-vide come-up-time caveat injected on every `sv` stage
  (`app.js:3254-3256`); cold ≤30 °C vs hot smoke (`data.py:201-202`); pH ≤5.3 dry / 4.6-5.2 semi-dry and
  Aw ≈0.85 via 30-40 % loss named as "the first safety barrier" (`data.py:231,233`), echoed into generated
  phase text with case-hardening/ventilation guidance (`:408,410`). VERIFY-W1-E C14.

### 2.3 The equipment & occupancy layer — the most completely delivered feature

Wave-1 conformance ran clause-by-clause over six plans and Wave-2 re-derived every substantive row
independently.

| Plan | Result |
|---|---|
| `2026-07-20-equipment-occupancy-layer.md` (1,276 lines, 9 tasks) | **8 DONE, 1 SUPERSEDED** (T7's `.occ-*` markup, documented) |
| `2026-07-21-occupancy-view-phase2.md` (996 lines, 10 tasks) | **10 DONE**, 3 with documented post-ship refinements |
| `2026-07-20-equipment-properties-completion.md` (742 lines, 6 tasks) | **6 DONE** (T5 via a better mechanism than specified) |
| `2026-07-17-phase3a-slice1-prefs-framework.md` (596 lines, 6 tasks) | **6 DONE** |
| `2026-07-15-equipment-2.0-slice-1a.md` (551 lines, 6 tasks) | **6 DONE** — T3/T4 upgraded from "by inference" to directly citable in verification (VERIFY-W1-B R2) |
| `2026-07-15-i18n-foundation-phase0.md` (363 lines, 5 tasks) | **4 DONE, 1 PARTIAL** (T3 — see §5.3) |

Confirmed specifics worth knowing: `deviceOccupancy` at `app.js:438-519` with `packDevice` (403),
`out.fit` honesty ladder (499-515), `hooksOver` (516) read at both `652` (bay CSS class) and `668` (fit-line
warning); `occupancyCompat` with exact `TEMP_TOL_C=6` and `/`-split wood intersection; `cookerContention`
(258-289) judging by the stricter per-slot verdict; `deviceSilhouette` (334-340) and the five body renderers;
`deviceDisplayName` deduping by `id` rather than object identity. Theme tokens (`--over`, `--over-l`,
`--grate`, `--cool`, `--cooll`) are defined for **all four** live themes in the JS `THEMES` object
(`app.js:6840-6848`), applied as inline custom properties at `:6999`, asserted by `occ-css-tokens.spec.ts:24-26`
(VERIFY-W1-B R1).

### 2.4 The AI transport and structured-output layer

`gemFetch` (`app.js:4208-4236`) is the best-engineered transport in the codebase, and every specific claim
about it checked out (VERIFY-W1-A C15):

- `AbortController` + 25 s default (`4216, 4220-4221`), per-caller overrides 12–40 s
- exponential backoff `500·2^i` (`4219`), retry restricted to 429/500/502/503/504 (`4227`) and
  `AbortError`/`failed to fetch` (`4230`)
- managed→BYOK fallback on 401/402/403 (`4226`)
- distinct `timeout` / `api-<status>` / original error so callers can branch (`4228, 4232`)

`aiJSON` (`4338-4374`) layers a three-stage repair chain — fence-strip → control-char strip → `aiRepairJson`
(`4379-4384`) — plus one whole-call retry; **it cannot crash on a malformed model response** (VERIFY-W1-A C16).
All seven numbered AI features fail *loudly* with a local-first fallback; all seven cited ranges were checked,
not sampled: `8227-8234`, `8283-8287`, `8364-8366`, `8444-8453`, `8507-8509`, `8596-8599`, `8671-8672`. No
silent failure, no stuck loading state (VERIFY-W1-A C17).

**Cure and salt dosing is never asked of the model** (`app.js:8571`, presets at `8531`) — the single most
important structural safety decision in the AI design, and it holds (VERIFY-W1-F C9).

### 2.5 The AI trust layer that *does* exist, and its tests

Contrary to the Wave-1 report, an adversarial fixture corpus already ships. `tests/ai-trust.spec.ts` contains
a 16-entry `DANGEROUS` list including verbatim the four prompts W1-F proposed creating, and implements three
of its four proposed eval axes (VERIFY-W1-F R1):

- `test('W1-P5: refuse classifier catches dangerous intents and lets safe questions through')` — all 5
  refusal ids across 15 phrasings **plus 7 negative carve-outs** (`'how much cure #1 for 2kg salami'` → `null`)
- `test('W1-P3: numeric guard flags ungrounded safety numbers…')` and
  `test('W1-P7: a fabricated safety number is always escalated; a vetted one is not')`
- `test('W1-P1: Ask-the-Fire answers in the UI language…')`, `test('v246: AI prompts force metric units…')`
- `tests/wave5-mt-safety.spec.ts` `test('T1 guard: mtSafe requires an exact number multiset match')`
- `tests/wave3-ai-hardening.spec.ts` — 7 transport tests
- `tests/ai-trust.spec.ts` `test('v250: live probe telemetry is NOT vetted grounding for the safety guard')`

### 2.6 The scheduler and the capacity placer

- **`planSchedule` is genuinely pure** (`2978-2991`, fresh `out[]`, input untouched) with an explicit
  `Number(s.hours)||0` NaN guard (`2984`) used by both call sites.
- **`schedulePlacements` genuinely fires and genuinely reschedules.** This was the single Wave-1 workflow
  claim that verification overturned: `tests/scheduler-placement.spec.ts:153` ("C3: a small pull staggers the
  real plan and the timeline says the item is ready early") boots a real one-zone gas grill sized to fit
  either item but never both, calls `openTimeline()`, and asserts `.tl-early`. It **passed live**
  (15/15 in `scheduler-placement` + `equipplan-seam`). `.tl-early` is emitted only by `readyEarlyNote`
  (`5976-5982`), which requires `readyEarlyMs>0`, written only at `5706` — the chip cannot appear unless the
  whole Phase-4b path fired end to end. Companion tests B1/B2/B4/C1 confirm the rest.
- **`safetyDiff` is correctly shaped** (`3039-3052`): compares `kind`/`hours`/`temp`/`safe` and deliberately
  *not* `start`/`end`, with a count-mismatch branch at `3041`, run on every rebuild.
- **`_preheatRow`/`preheatMinutes` (`934-953`) covers all 8 smoker types including the cabinet** (30 min vs
  the 45 min default) and is read by `buildList` at `5721-5722`; `equipplan-seam.spec.ts` P3a/P3b/P3c pass
  green (VERIFY-W1-G C2).
- **`_unresolved` (`5904-5913`) honestly surfaces** items awaiting a cooker pick rather than hiding them.

### 2.7 PWA update delivery — sound

Every sub-claim confirmed (VERIFY-W1-D §2): `reg.update()` on load **and** on `visibilitychange`→visible
(`app.js:9559-9561`) with the code's own comment naming the real prior failure ("v255 reached the server but
not the device"); a deliberate skip when a live cook is running (`9552`); the generated `sw.js` uses
`skipWaiting()` + `clients.claim()` and deletes every non-current cache on `activate` (`build.py:404-423`)
with the cache name derived from `md5(html)[:8]` (`:403`); `_headers` sets `no-cache` on
index.html/manifest/sw.js and `max-age=31536000, immutable` on `*.png` (`:427-428`). Installability is not
blocked — the manifest has `name`, `short_name`, `start_url`, `scope`, `display:"standalone"`, 192/512 icons
plus one `maskable`. iOS A2HS meta is complete (`build.py:139-142`).

### 2.8 Accessibility and design foundations that are real

- Global `:focus-visible{outline:2px solid var(--ember)!important}` (`app.css:825`) — measured working, and
  it neutralises 10 `outline:none` rules.
- **Body-text contrast passes on all four themes**: `--bone` 8.72 / 15.62 / 10.60 / 12.27; `--smoke` 5.06 /
  8.69 / 4.83 / 4.84; `--ash` 6.80 / 6.35 / 6.82 / 7.09 (W5-A §3.1). The `--smoke` token even records its own
  before/after fix in a comment (`app.css:11`, 2.65:1 → 5.5:1).
- **Zoom is not blocked** (`build.py:133`), no positive `tabindex` anywhere, `applyLang()` correctly sets
  `documentElement.lang`/`.dir` (`app.js:6935-6936`), the settings panel is a correct
  `role="dialog" aria-modal="true"` that moves focus inside on open and closes on Esc,
  **zero unnamed buttons**, **zero `<img>` without alt**.
- **Colour is a real, well-governed token system** — 4 themes × ~36 vars; charcoal re-skins even the
  occupancy diagrams cleanly. `--fscale` threaded through 618 of 624 font-sizes.
- Deliberate bidi handling: `dir="ltr"` islands around number+unit runs (`app.js:544,567,569,631,652,668`)
  **and** a documented decision *not* to isolate a mixed Hebrew+number string (`app.js:5979-5980`, L13).
- Search is debounced with an explicit perf comment (`app.js:2781`); the 279-card grid does not rebuild per
  keystroke.
- `serve.js` path traversal is genuinely unreachable — `dist/` is loaded into a `Map` whose keys are the only
  servable paths (`serve.js:36-45`).
- **Zero console errors** across the entire 45-surface walkthrough in both languages (W1-C).
- Lighthouse 13.4.0: **Accessibility 94, Best Practices 100** (identical desktop and 4×-throttled mobile).

---

## 3. Gaps, ranked, by band

Severity is stated per item. **Every item below survived Wave-2 verification**; refuted findings are in §4.
Confidence is noted where it is not "measured or read at the cited line".

### 3.A · SAFETY (close first)

| # | Severity | Gap | Evidence |
|---|---|---|---|
| **A1** | 🔴 **Critical** | **Voice Cook hands-free Q&A is a fully unguarded, spoken, web-grounded free-text AI path.** `vcAskAI`/`vcAskFlow` (`app.js:5269-5300`) is a separate hand-rolled Gemini caller with `google_search` on (`5278`). Independently re-derived: `aiSafetyNote`/`aiSafetyCaveat` render at **exactly** `4454, 5464, 8499, 8664, 9326` — not here; `askRefuse(` has its definition (`4197`) and **one** call site (`4448`, Ask-the-Fire only). `vcCookContext()` (`5233-5240`) injects the step label and live probe telemetry and never `SAFETY_FACTS()`. The raw answer is rendered (`5128`) **and spoken** (`5296 vcSpeak(answer, ansL)`). | VERIFY-W1-F C4; independently re-verified by the sweep controller |
| **A2** | 🔴 Critical | **A second unguarded spoken model path**, found only in verification. `vcTranslateToEn` (`app.js:5186`, transport `5196`) translates the app's own Hebrew recipe/step content to English with **no guard of any kind**, caches it (`5185`) and speaks it (`vcSpeakContent` `5203-5213`, `vcSpeak(en,'en')` at `5212`). The correct guard is already written 1,700 lines away: `mtTranslate` (`6962`) routes the *same content class* through `mtGuard`/`mtSafe` (`6951-6958`), rejecting any translation whose number multiset differs. "עשן ב-110 מעלות" → "smoke at 210 degrees" would be spoken and cached. | VERIFY-W1-F R3 |
| **A3** | 🔴 Critical | **The AI numeric guard is unit-blind.** `aiSafetyNums` (`app.js:4302-4306`) puts the unit in a **non-capturing** group and extracts only the bare number; `aiUngroundedSafety` (`4308-4312`) then string-compares values. An answer reading *"pull the chicken at 74 °F"* is checked against grounding containing *"74 °C"*, **matches, and is classified grounded** — so the strong `🚫 do not rely on these numbers` escalation (`4319-4324`) never fires. 74 °F is raw poultry. Same blindness for °C/°F, ppm/%, %/pH. Secondary: matching is by value across the whole context, so a fabricated `6.25%` passes if `6.25%` appears anywhere for an unrelated quantity. | W5-C §5 |
| **A4** | 🟠 High | **Diagnose has neither a refusal gate nor vetted grounding.** `diagnoseGrounding` (`8465-8474`) builds trouble-index + journal + pantry text and never calls `askSafetyIntent`/`SAFETY_FACTS()` — contrast `askContextFor` (`4140-4141`). Only the Tier-C caveat at `8499`. And `aiSafetyCaveat` returns `''` for text with neither a number nor one of the keywords `ניטריט\|nitrite\|Cure #1\|ריפוי\|פסטור\|pasteur` — so **"that mold is probably fine, keep drying" gets no flag at all**. | VERIFY-W1-F C5, C6 |
| **A5** | 🟠 High | **The two named plan-depth safety commitments are 0 % built**: *refuse to schedule* poultry/charcuterie without a registered thermometer, and the cure task must **BLOCK**, not warn, without a 0.1 g scale. Today `gearThermoNote()` renders passive advice, and `cureScaleGuardHTML` (`app.js:1849-1874`, `hardMax=5*d`, `advMax=20*d`) writes into a **separate** string that lands in a separate node (`guard.innerHTML=g`, `1926`) while the dose is computed at `1918` and rendered at `1919`, untouched. **The output is byte-identical whether the warning fires or not**; corroborated by `tests/cure-scale-guard.spec.ts` G8. | `2026-07-22-status-and-gaps.md` §A.1; VERIFY-W1-E C5 |
| **A6** | 🟠 High | **`bcheck` is checked off but never *recorded*.** The task row does render a persisted checkbox (`app.js:5940` `data-wpck`, persisted at `5766` under `wpck:<scope>:<label>`), so "no confirmation step" is wrong — but the complete inventory of `bcheck` in `app.js` is `3035` (comment), `3261` (emission), `5159-5161` (voice), `5815` (task), `5993` (timeline) and **none accepts a numeric input**. Nothing blocks progression; the only "block" affordance in the plan layer is time-based (`5598`). Monitoring exists; verification and corrective action do not. | VERIFY-W1-E R5, C4 |
| **A7** | 🟠 High | **`safetyDiff` is detected but not surfaced.** Called exactly once (`5716`); its output goes to `window._planSafetyViolations.push(...)` (`5717`). `grep -rn "_planSafetyViolations" app.js tests/` returns **three** hits: the write (`5711`), the push (`5717`), and `tests/safety-invariant.spec.ts:81`. **Nothing in the app reads it.** The code comment at `5709-5710` claims violations are "recorded and **surfaced** rather than quietly shipped into a cook"; the surfacing half is not implemented. Contrast its sibling `_plcConflicts` (`5692`), which does reach the user at `5739`. | VERIFY-W1-E R6; W5-E (c) |
| **A8** | 🟠 High | **The alarm banner and the OS notification are Hebrew-only in every language, including the `aria-label`.** Measured at `lang=en`: `{"aria":"טיימר הסתיים","text":"⏰ טיימר הסתיים \| Brisket rest \| 🔕 עצור"}`. Sources: `app.js:2409-2411` (heading, `🔕 עצור`, `🔕 עצור הכל`), `2408` (`aria-label`), `2398` (default timer name), `2387` (SW notification title + body fallback). This is the surface that tells you the meat is done or the cure stage is over. | W5-C §4.2, measured in a clean Playwright context |
| **A9** | 🟠 High | **`addDays()` loses a day across the spring DST boundary.** `app.js:2790` parses `'YYYY-MM-DD'` as **UTC** midnight, mutates with `setDate()` in **local** time, reads back via `toISOString()` in **UTC**. Measured with `TZ=Asia/Jerusalem`: `addDays('2026-03-26',2) = 2026-03-27` (expected `-03-28`); `addDays('2026-03-26',14) = 2026-04-08` (expected `-04-09`). It drives the cure/dry reminder dates — `app.js:9281` *"סיום כבישה — הוצא ושטוף / End of cure — remove and rinse"*, `3546`, plus `3523, 8717, 9219, 9230, 9273, 9275-9278`. **The error direction shortens a nitrite cure.** | W5-C §3.1, executed |
| **A10** | 🟠 High | **Kabanos (`spec-10`) contradicts its own bundled citation and was never fixed.** `sources.py:3353` reads *"FLAG: current says 'fermentation culture + Cure #2' — WRONG per Marianski… cure with Cure #1 (2.5 g/kg = 156 ppm), hot-smoke then bake to internal 68-71 °C… Cooked product → Cure #1."* Shipped: `data.py:152` still `cure="תרבית התססה + Cure #2"`; `:490` `sausage_dry(…,"Cure #2",…)`; `:524` `setcalc("spec-10", cure="2")`. `sausage_dry()`'s 8 phases (`403-412`) contain **no cook step** — phase 6 is optional **cold** smoke ≤25 °C, which also contradicts the row's own `smt=50`. SPECIALS carry no `safe` key at all and `tgt="—"`, so the item has **no numeric safety floor**, while the `src.safe` it *does* ship describes a process the recipe does not implement. | VERIFY-W1-E C6 |
| **A11** | 🟠 High | **18 researched salt overrides are computed, printed as "APPLIED", and silently discarded.** `gen_sources.py:59-66` reads the correct location (`makes_map[mid]['build']['calc']`) and `:91-98` prints *"MAKE calc overrides (APPLIED via sources.py merge)"*. They are not applied — `build.py:96-102` skips the key, and even without the skip `:103` writes `MAKES[_mid][_k]`, the make's **top level**, which the app never reads (`grep -o "…\.calc\b" app.js` → `4 b.calc`, `1 ref.calc`; `b` is the build object). **Measured: 18 salt values differ.** `n-kabanos` ships **18 g/kg against 25 researched — 28 % below** — on a Cure #1 semi-dry sausage, where salt is a hurdle alongside nitrite. | W5-C §2.1, executed against the real modules |
| **A12** | 🟡 Medium | **Guard and caveat text never reaches speech.** All five guard sites emit HTML only; none of the 20 `vcSpeak`/`sysSpeak`/`gemSpeak` call sites passes caveat text. A sighted user reading an answer sees "⚠ do not rely on this number"; a user hearing the same answer does not. | VERIFY-W1-F C16 |
| **A13** | 🟡 Medium | **Model output reaches `innerHTML` unescaped.** `app.js:8246` `` const reason=r.reason?`<div class="pp-desc">${r.reason}</div>`:'' `` — no `esc()` — fed by `app.js:9176` `reason:r.reason` with **no type guard**. `padvRender`'s `warnings` (`8254`, from `9177`) take the same route. (For contrast, `aiSeasonRec`'s `r.reason` at `8415` *is* type-guarded and escaped at `8423` — the Wave-1 report picked the wrong example.) | VERIFY-W1-F R4 |
| **A14** | 🟡 Medium | **Offal `safe` floors are sourced to culinary blogs**, below the app's own USDA-cited organ floor. n=74 Goose Liver `safe=65` → ChefSteps; n=75/76 Sweetbreads `safe=65` → amazingfoodmadeeasy.com; n=80 Veal Brain `safe=65` → offallygoodcooking.com. The correct comparator is **72 °C** (n=72/73/78/79, cited to `ask.usda.gov`), not 74 °C (which is the *poultry*-organ policy). This is inconsistent with `baldwin-backbone.md:7` ("Never guess."). Not asserted unsafe — asserted under-sourced. | VERIFY-W1-E C12 |
| **A15** | 🟡 Medium | **`hebSpeechText` has no `%` rule and no pH/aw rule** (`app.js:4969-4983`, all 12 replacements read). Both appear in `SAFETY_FACTS()` (`4127`, `4129`), which is a candidate to be read aloud. | VERIFY-W1-F C15 |

### 3.B · Correctness

Grouped by cause. All measured unless noted.

**B-i · Two views of one plan disagree** (all seven measured in the running app, VERIFY-W1-G confirmed)

1. **Three different capacity rules for one device.** `schedulePlacements` tests whole-device
   `cap.usableCm2` (`3155`); `cookerContention` uses the per-slot honest verdict
   (`o.fit.verdict==='over'||o.over`, `277-281`); `combinedEventsRows` uses whole-device only
   (`o.over||!o.compat.tempOk`, `7882`). Measured on a 5-rack 6000 cm² cabinet with brisket 1320 + short ribs
   600: `combinedEventsRows → false` (no warning), `cookerContention → true` (clash). The comment at
   `277-281` **names this exact bug**; the fix landed in one path and not the other.
2. **Serve time — three surfaces, two on the same screen, 3.5 h apart.** `mk-tlserve` is a **global** key
   (`5545`), written by the input (`5637`), never written back to `ev.serve`. After one real `input` event
   19:00→22:30: the input, serve bar and whole plan read **22:30**; the event identity banner directly above
   reads `ev.serve` = **19:00** (`5617`); the combined timeline reads `parseServeTime(ev.serve, ev)` = 19:00
   with every start 3.5 h wrong (`7834`). The serve *date* diverges in reverse (`mk-tlservedate-<scope>` at
   `5532` vs `ev.date`). Screenshot: `docs/analysis/shots/w1g-serve-divergence.png`.
3. **Multi-day items: blocked in one view, scheduled in the other.** `blocked = profile.multiDay && !st.ready`
   (`5668`) exists only in `buildList`; `combinedEventsRows` has no such concept. A dry-cured Soppressata
   (`m-sopr`, `data.py:656`) renders as *"not included in the daily schedule"* in one view and as a **9-minute
   row starting nine minutes before serve** in the other.
4. **Only one of three plan shapes can be ticked.** `wp-ck`/`data-wpck`/`wp-done`/`wp-next` appear **only** in
   `renderWpVertical` (`5938-5943`). Accordion (`5945`) and horizontal (`5952`) render the same 15 tasks with
   0 checkboxes, 0 done markers, 0 "next" cue. The state is in storage; it is invisible in two shapes.
5. **Advisory vs clash banner disagree by construction.** `_plcConflicts` is computed at `5691-5692`
   (**before** the shift at `5693-5707`); `cookerContention` at `5777` (**after**), under a different rule.
   Verified divergence window: `bath-temp` fires on strict `p.temp!==r.temp` (`3137`) while `tempOk` allows
   `spread<=TEMP_TOL_C`=6 °C (`294`), so a 1–6 °C bath split raises the advisory with the banner silent.
6. **The combined view calls every clash "Smoker".** Hardcoded `⚠ מעשנה`/`Smoker` (`7947`) and *"One smoker
   will not be enough…"* (`7950`) while `contention` is populated from `sv`/`smoke`/`cook` stages
   (`7853-7856, 7877-7884`) — so a sous-vide bath conflict is reported as a smoker conflict.
7. **The bath advice contradicts the occupancy model.** `_svBatch` takes `Math.max` of the baths with **no
   litre check** (`5785`) and instructs "use the N L bath for all" (`5837`), while `deviceOccupancy`'s own
   comment (`483-486`) says the volume % is a floor because displacement is unknown, and sets `pctFloor` when
   2+ items share (`492`). Measured: plan says "use the 24 L bath for all"; model says `pct 100, pctFloor
   TRUE`. **Bonus divergence:** the occupancy vessel view recommends the **smallest** vessel that fits via
   `chooseBath` (`630`, `3001-3010`) — the opposite rule.

**B-ii · State model**

8. **Rendering the plan writes user state.** `st` *is* `allState[m.key]`; `buildList` assigns `st.method`,
   `st.svSmokeOrder`, `st.stage`, `st.ready` (`5661-5670`) then persists the whole map (`tlSetState`, `5684`).
   Merely *looking* at the plan commits a method choice; "what would sv-only cost me?" cannot be evaluated
   without writing that choice. This destroys the prerequisite `planSchedule`'s own comment establishes at
   `2976-2977` ("two candidate schedules can coexist") — established at 2978, destroyed at 5679.
9. **Window-global singletons in an app that models parallel events.** `_wpTasks` (`5878`), `_wpCtx` (`5775`),
   `_plcConflicts` (`5692`), `_wpServe`/`_wpStart` (`5758`), `_planSafetyViolations` (`5711`). Storage keys
   *are* scoped; memory collapses to one slot. **Measured:** with a live cook on Event A, opening Event B's
   timeline re-pointed the copilot at B's tasks while A's session was still live
   (`_wpTasks` 12→9, `_copilotStages().cur` "🌊 סו-ויד 68° — בריסקט" → "🌶️ שפשף ראב — פרגיות").
10. **`cardSess` is keyed by item only** (`843`) — a card's scratch method state is shared across every event.
11. **`cookerFor` conflates "no gear" with "needs a pick"** — `null` at both `243` and `253`. Both current
    callers do the extra `cookerCandidates()` check; the next one may not.
12. **`store.set`'s return value is ignored and success is reported unconditionally.** `store.set`
    (`1435`) catches internally and returns `true`/`false` and cannot throw — so the `try/catch` wrappers at
    `3641`, `8792`, `8822` are dead catches. The live defect: `8822` ignores the boolean and `8823` fires
    `toast('נרשם ביומן ✓')` regardless, so **a failed write reports success**.

**B-iii · The work plan itself**

13. **Checkbox keys are the *translated* label** — `'wpck:'+sc+':'+tk.label` (`5938`), and every label is built
    through `L(he,en)`. **Switching language wipes the ticks** (measured: done rows 2 → 0). The same shape
    **collides**: every refuel row for one fuel shares the identical label `L('🪵 הוספת '+fuel,…)` (`5871`),
    so on a stick-burner (`REFUEL_MIN` 45 min) three rows at 19:15/20:00/20:45 share **one** checkbox key —
    ticking the first marks all three done, on the one device where a missed refuel puts the fire out. The
    codebase knows better: the shopping list deliberately keys on "the stable (language-independent) label"
    (`7916`).
14. **The ⚡ card toggles do not reach the plan outside a project.** `if(curProject) store.set(methodKeyFor(key),next); else cardSet('method:'+key,next)` (`2186`); `activeMethods` reads `store.get('method:'+key)` only
    (`832-839`) and never consults `cardSess`. Measured with a real click: DOM shows `sv:off smoke:ON`,
    `activeMethods` returns `["sv","smoke"]`, and the rendered plan still contains the 30-hour sous-vide
    stage — under a hint that says **"Active methods — the plan updates"** (`1020`) and a plan that says the
    method is **"taken from the switches on the card (⚡)"** (`5634`).
15. **The copilot reserves no rest and follows the wrong event.** `readyBy = s.serveTs - (s.restMin||0)*60000`
    (`5413`), but **`restMin` is never written** — the session shape is `{startedAt,scope,serveTs,probes}`
    (`5354`). Brisket's `rest=60` (`data.py:6`) schedules a 1 h rest (`3257`) the verdict ignores, so
    "core hits target exactly at serve" reads as **on pace**.
16. **Timers are stopwatches, not schedule-aware.** `dur:Math.round(s.hours*3600)` is baked into the task
    (`5838`) and `wireTimer` (`2326-2338`) counts from the ▶ press. Nothing reconciles a timer with the clock
    time the plan assigned. Start the smoke 40 min late and every downstream clock time stays put.
17. **`"1 events"`.** `app.js:7973` renders `` `${list.length} ${L('אירועים','events')}` `` — reproduced at
    runtime (`n=1 → "1 events"`). No shared `plural()` helper exists anywhere in `app.js`. **This is the only
    live site** (see §4.A.3).

**B-iv · Dates**

18. **`today()` returns the UTC date; `isoDate()` returns the local date.** `app.js:2789` vs `5531` — two
    conventions for one concept in one file. Measured at 01:30 local Israel: `today() → 2026-07-21`,
    `isoDate() → 2026-07-22`. `today()` drives the cure-complete gate (`3426`), the overdue-⏰ marker
    (`3550`) and ~15 other comparisons; `isoDate()` writes the serve date (`5604`); the two are compared
    against each other through the reminder flow. Every local day between midnight and 03:00 — **precisely
    the hours an overnight-brisket user is holding the phone** — `today()` is off by one.

**B-v · Infrastructure and build**

19. 🔴 **Worker: the token cap is bypassed entirely by `:streamGenerateContent`.** `worker/index.js:43` admits
    **both** `generateContent` and `streamGenerateContent`; `:77-87` is the only place `rec.used` is
    incremented, and it does `JSON.parse(text)` then reads `j.usageMetadata`. For a stream the body is a
    **JSON array** — parse succeeds, `usageMetadata` is `undefined`, `used === 0`, nothing is written. With
    `?alt=sse` the parse throws and the `catch` explicitly skips metering. **A holder of any capped code
    changes one word in the URL and consumes the owner's Gemini key without limit, forever.** The cap is the
    entire abuse model for this Worker.
20. 🔴 **Worker: fail-open on a corrupted KV record.** `worker/index.js:53-60` — if `raw` is truthy but not
    valid JSON, `catch { rec = { active: true }; }`. `rec.active === false` at `:57` is then false, **and**
    `typeof rec.cap === 'number'` at `:58` is false because `cap` is `undefined`, so the cap check never
    fires and the metering block at `:77` is skipped too — **so the record is never rewritten and the grant
    is permanent and never self-heals.** Failure direction is backwards.
21. 🟠 **Worker: the usage counter is a read-modify-write race.** Read at `:53`, a multi-second upstream
    round-trip at `:66`, write at `:84`. Two concurrent requests both read `used=U` and the later write wins.
    KV is additionally eventually consistent (the author's own note, `:76`). A client firing N parallel
    requests records ~1/N of its consumption. **Cap is not an upper bound.**
22. 🟠 **Worker: no timeout on the upstream Gemini fetch** (`:66-70`) — no `signal`, no `AbortController`.
    The `try/catch` at `:71-73` returns 502 on *unreachable*, but a hanging response is not an exception.
    Asymmetric with the client-side `gemFetch`, which is careful about exactly this.
23. 🟠 **`serve.js` fork-crash loop.** `serve.js:33` `cluster.on('exit', () => cluster.fork())` — no backoff,
    no health gate; each worker reads all of `dist/` at startup (`:39-46`). Measured in an empty directory:
    **1,146 crash-restarts in 6 s (~191/s)**, burying the real `ENOENT` in a scrolling wall. This is exactly
    what a contributor hits running Playwright before `python build.py`.
24. 🟡 **`build.py:347-348` `_js_str` does not escape `</script`.** The real function body was extracted and
    executed: `'a</script>b'` survives verbatim. Output is substituted into `<script>__JS__</script>`
    (`:340, :378`). **Latent, not live** — zero occurrences in any source today, and the built `index.html`
    contains exactly one `</script`. There is no build-time guard. (Precision: the HTML tokenizer only ends
    script data on `</script` followed by whitespace, `/` or `>`.)
25. 🟡 **The service-worker registration catch is completely empty** (`app.js:9562`) — on the one call that
    installs the offline shell and the update-delivery channel, a 404/syntax/policy failure produces no
    console trace, no toast, no fallback.
26. 🟡 **The SW gate is stricter than the platform.** `if('serviceWorker' in navigator && location.protocol==='https:')`
    (`9546`). On `http://localhost` `isSecureContext` measured **true** while `protocol` is `http:`, so the
    SW, its update toast and its SW-delivered alarms are **unexercisable by any local or CI run**
    (`getRegistrations() → 0`).
27. 🟠 **A first visit downloads the whole document three times.** The shipped `sw.js` has
    `SHELL=['./','index.html',…]` — two cache keys for one resource — while `_headers` sets `no-cache` on
    index.html, so neither can be served from the HTTP cache and `addAll` refetches twice. Measured on a
    cold Slow-4G load: three requests of 661,330 / 660,951 / 661,002 bytes; **total first visit 2,117,219
    bytes, of which 1,321,953 (62 %) is pure waste.**
28. 🟠 **The origin returns HTTP 200 + 2.27 MB for every unknown path** (`/robots.txt`, `/llms.txt`, arbitrary
    paths) — the Cloudflare Pages SPA fallback. This is the sole cause of both failing SEO audits
    (`robots-txt`: 11,313 parse errors starting at `<!DOCTYPE html>`; `llms-txt`: missing H1), and every
    crawler probe or broken link costs 645 KB of egress.

**B-vi · Data**

29. 🟡 **Nine cuts violate the `saved`/`svh` relation, and the invariant itself is the wrong comparison.**
    n=49 Salmon (`saved=1.5`, `svh="0.75"`), n=50 Trout, n=106 Grilled Watermelon, and six shellfish with
    `svh="0"` yet `saved>0` (n=120,121,122,128,129,130). `saved` actually means *smoker* hours saved vs the
    smoke-only path (`app.js:1569`, `2092`, glossary `data.py:227`), so the meaningful check is
    `saved ≈ soh − smh` — which **mismatches by >0.35 h on 29 of 130 cuts** (n=12 Beef Pastrami: soh 8,
    smh 2, saved 3.0). *Whether this is a defect or hand-tuning is open* — flagged, not asserted.
30. 🟡 **Six cuts carry `svt=0`** (the same six shellfish) as a "no sous-vide path" sentinel.
31. 🟡 **Five `MAKE_SOURCES` entries carry a stale "CRITICAL GAP … cure=None … botulism/Listeria risk" note**
    — `m-cacc`, `m-nduja`, `m-sauci`, `m-sopr`, `m-sucuk` — all equally stale, because `sausage_dry()`
    hardcodes `calc=dict(salt=28, cure='2', cureRate=2.5, …)` at `data.py:400` regardless of the label passed
    in. Not a live defect; a **documentation hazard** — precisely the kind of note that could cause a future
    reader to "fix" a non-problem by applying the source's own bad `calc`.

### 3.C · Orchestrator & workflows

| # | Sev | Gap | Evidence |
|---|---|---|---|
| C1 | 🟠 | **The Phase 3a solver is 0 % built.** `orchestrate`, `movesForClash`, `applyMove`: 0 hits in `app.js`, 0 in `dist/index.html`, all three `typeof === "undefined"` at runtime. | VERIFY-W1-G §0.3 |
| C2 | 🟠 | **No AI proposer exists.** `aiPropose\|proposeMove\|planMove\|aiOrchestrat` → **zero matches** tree-wide. `safetyDiff` is the correctly-shaped gate for one and is not wired to anything AI. | VERIFY-W1-F C12 |
| C3 | 🟠 | **Cross-event resource allocation does not exist.** `combinedEventsRows` (`7832-7887`) skips `equipPlan` and `schedulePlacements` entirely and has no `blocked` concept. The only cross-event signal is a raw time-overlap that ignores device and capacity. | VERIFY-W1-G §5.3 |
| C4 | 🟠 | **The placer searches with the wrong fit test.** `_windowFits` is tested against **whole-device** `cap.usableCm2` (`3155`) while `perSlot` (`3118`) is only ever used to *reject* (`3144-3146`), never to search. The candidate set is `[latestFinishMs] ∪ {startMs of already-placed stages}` (`3149-3151`), so a pull is 0 or a jump to another item's start. Volume (sous-vide) stages take the early return at `3129→3141` and always carry `slackMs:0`. **On a large cabinet it will rarely fire, by design** (`B4` asserts exactly that). *NB: "inert in practice / never reschedules" was REFUTED — see §4.G.1.* | VERIFY-W1-G R1 |
| C5 | 🟠 | **A non-uniform slack set is silently discarded.** `if(uniq.length!==1 \|\| !uniq[0]) return;` (`5701-5702`). Any item with a sous-vide stage (always slack 0) plus a pulled smoke stage produces `[0,X]` → discarded. A *successful* placement pushes no conflict (`3172-3173`), so the advisory says nothing and the plan silently keeps the over-subscribed relaxation. | VERIFY-W1-G §5.2 |
| C6 | 🟡 | **The advisory recommends a feature that does not exist** — *"cook in batches"* (`3195`, `3199`) with no batch feature anywhere. | VERIFY-W1-G §4 |
| C7 | 🟡 | **`SCHED_PULL_MAX_MS` (`3065`) has no UI and no explanation of the number.** | VERIFY-W1-G §4 |
| C8 | 🟡 | **The user cannot influence**: stage durations (from `svh`/`smh` via `upperHours`, `app.js:6` — correct as a safety stance, but there is no "I know this brisket runs fast" affordance), shelf assignment (`packDevice` at `403/441`, no override), preheat minutes, or method from the work-plan view (`methodOpts` lives in `itemRowHtml` `5971`, items view only). | VERIFY-W1-G §4 |
| C9 | 🟠 | **The Work Plan opens 2.1 screens above "now".** `.wp-next` measured at y=1550 in a 721 px viewport with `scrollTop=0` forced (`app.js:2505`); nothing scrolls to it. | W5-B, reproduced live |
| C10 | 🟡 | **Voice-cook's jump list drops the day marker.** The work plan labels cross-day tasks `יום לפני` via `fmtClockRel` (`4881`); the voice jump list builds its `<option>` from bare `fmtClock(tk.t)` (`5115`), producing `04:20 → 05:00 → 12:15 → 11:00 → 12:15`. The array is verified monotonic (`inversions: []`) — the hands-free surface hides the one field that makes it legible. Related: `openVoiceCook` seeks with `vcTasks.findIndex(t=>t.t>=now)` (`5520`), correct only because the array happens to be sorted. | W1-C D5, VERIFY-W1-C confirmed |
| C11 | 🟡 | **The occupancy view orders empty devices above the occupied one.** *(This is the narrow residual after the "opens on an empty rack" claim was refuted — see §4.C.1.)* | VERIFY-W1-C R/D15 |
| C12 | 🟡 | **The Live Copilot is the thinnest surface in the app** — two cards plus a chip, then ≈430 CSS px of empty space in an 844 px viewport, on the screen named "your cook in real time". No serve countdown, no temperature, no other running timers, all of which exist one screen away. | VERIFY-W1-C D12 (figure corrected from ~900 px) |

### 3.D · Equipment-to-plan

| # | Sev | Gap | Evidence |
|---|---|---|---|
| D1 | 🟠 | **`choosePlate`/`chooseNozzle` are built, correct, tested and called from nowhere.** Defined `app.js:3014`/`3024`; every other occurrence is `tests/equip-chooser.spec.ts:20,51,64,74`. Their sibling `chooseBath` **is** wired (`app.js:630`). Verification also hunted for an equivalent join under other names (`grind_mm\|grindMm\|plates\|casingMm\|nozzle`, Hebrew `פלטה\|פייה`): every hit is **capture** (`90,95` multiCap; `6342-6345,6651` AI ingestion) or **display** (`6391` chips) — never a match or a warning. **There is no recipe↔device join for grinder plates or stuffer nozzles anywhere.** | VERIFY-W1-B C2, VERIFY-W1-G §0.2 |
| D2 | 🟠 | **Fourteen device properties are read for display only.** *The Wave-1 claim that they have zero readers is FALSE (§4.A.1)* — all 14 render as chips via the generic loop at `app.js:6393-6399`. The real, narrower finding: **none feeds the planning, occupancy or safety engine**, in contrast with `hooks`/`canHang`, which `deviceCanHang` reads via `propOf` at `330`. And the framing matters: the equipment form **asks the user to type them** on a 390 px screen, so this is wasted user effort in the app's most tedious flow, not housekeeping. Properties: `nozzles, plates, bagKind, bagW, lid, fan, accuracy, pulse, rotisserie, speed, steam, throughput, waterPan, watts`. | VERIFY-W1-A R1; W5-C §8 (framing) |
| D3 | 🟠 | **The device editor has two cooking-area fields; only one drives the engine.** On one form: `#eqvArea` (label "שטח בישול", saved to `d.cap.area` at `6552`, read only by a display chip at `6392` and the preview at `6674`) and `#eqProp-areaCm2` (label "📐 שטח בישול כולל (ס״מ²)", the typed property `devCapacity` actually reads via `propOf(dev,'areaCm2')` at `319` to compute fit, shelves and every occupancy verdict). Nothing on screen distinguishes them. | VERIFY-W1-C D16 |
| D4 | 🟠 | **The `equipPlan` seam is narrow.** `DEVICE_FUEL` (`964-967`) has 7 of the 8 smoker types (`ארון / קבינט` absent); `REFUEL_MIN` (`957-962`) is non-zero for exactly 3 (offset 45, WSM 90, kettle 60). All 5 grill types and all 3 oven types are absent from both, and near-misses are genuinely different strings (`קטל` vs `קטל (ככלי עישון)`). `equipPlan` only touches `smoke`/`cook` kinds (`977`). **Corrected scope:** `equipPlan` is *not* the only device→plan path — `_preheatRow` (`934-953`) covers all 8 smoker types incl. the cabinet and is read at `5721-5722`, and `SMOKER_TIPS` (`912-932`) covers all 8 on the card. What holds: **the plan's cook stages carry no equipment-specific instruction.** | VERIFY-W1-G C2 |
| D5 | 🟠 | **Occupancy demand ignores guest count and piece count.** `footprint_cm2` is a static per-recipe constant, so 4 guests and 40 guests claim identical grate area. Fix is derivable from existing data (`rawGramsFor` + the catalog reference weight; per-piece × count for sausages). *Owner-raised.* | `2026-07-22-status-and-gaps.md` §C.10 |
| D6 | 🟡 | **Probe-channel budgeting is still a footer count.** `probeChannels()` (`229`) sums `cap.channels`; its only consumer is the footer template at `6425`. No planning code reads it. `navigator.bluetooth`, `requestDevice`, `GATT`: **zero hits repo-wide**. | VERIFY-W1-H #1, #2, #39 |
| D7 | 🟡 | **Charcuterie Slice B is 0 %** — cylinder loads, vacuum liquid-seal warning, grind-plate matching. | status-and-gaps §C.7 |
| D8 | 🟡 | **Warm-up is smoker-only** — no bath come-up, grill chimney or oven preheat task. (`watts`, already captured, is the honest input for a sous-vide come-up.) | status-and-gaps §C.12 |
| D9 | 🟡 | **`grz` (direct/indirect grill zoning) is populated on 118/130 cuts** (`ישיר` 59, `דו-אזורי` 30, `עקיף→ישיר` 19, `עקיף` 10) with **exactly one consumer** — a grill summary line at `app.js:2035`. Nothing in the scheduler, plan or occupancy layer reads it. | VERIFY-W1-E C15 |
| D10 | 🟡 | **A pellet or electric smoker owner still sees "🪵 wood: oak" on the smoke task itself** — only the refuel wording was made device-aware. | status-and-gaps §C.9 |
| D11 | 🟡 | **`✓ everything fits` is the fall-through for an empty device** (`app.js:674`) — the same defect class as commits `8c4a3de`/`6f05cab`, one level up. | W5-B |

### 3.E · AI

| # | Sev | Gap | Evidence |
|---|---|---|---|
| **E1** | 🔴 | **The app's text model has a shutdown date: 16 October 2026.** `gemini-2.5-flash` (`app.js:4206`) appears on Google's official deprecations table (release 17 Jun 2025, shutdown 16 Oct 2026, replacement `gemini-3.6-flash`), verified in two independent fetches. The models page still shows it available and unlabelled — only the deprecations page reveals it. **Every AI feature routes through that one constant.** ~3 months out. | W5-D §2a |
| **E2** | 🔴 | **`google_search` is attached unconditionally** at `app.js:4249` (Ask-the-Fire) and `5278` (Voice Q&A) — even for questions the app answers from its own catalog. It is simultaneously **77–90 % of all COGS** (a `$0.035` per-request grounded fee that appears in no token counter) and **hallucination surface #3** (indirect injection from whatever page Google returns). Making it conditional cuts persona C from $2.83 → $0.99/mo and persona B from $0.67 → $0.17, **and** closes an injection surface. One fix, two bands. | W4-A §cliff 1; W1-F §3.3 |
| E3 | 🟠 | **There is no CI at all.** `ls .github` → absent; `package.json` test script is an error stub. The 82-file suite runs only when a human types the command. | VERIFY-W1-F R1 |
| E4 | 🟠 | **The grounding axis is genuinely untested.** `grep -rl "aiValidateKeys\|aiValidateItems\|aiValidateSeasonings" tests/` returns **nothing**, despite those three validators (`app.js:4387`, `4394`, `8393`) being the primary defence for 7 features. | VERIFY-W1-F R1 |
| E5 | 🟠 | **`aiConfirmPanel` is not the universal contract it is claimed to be.** Definition at `4404`, exactly **two** call sites: `8363` (event planner) and `8594` (recipe generator). The **seasoning recommender writes app state directly** from its own AI-generated panel — `cwApplySeasKind(key, kind, …)` fired straight from a `[data-seasadd]` click inside `seasonRecRender` (`8433-8440`). The weaker claim ("nothing auto-applies") does survive. An orchestrator must **establish** this contract, not inherit it. | VERIFY-W1-F R6 |
| E6 | 🟠 | **The managed→BYOK fallback is silent.** `app.js:4226`: on 401/402/403 with a personal key present it re-enters `gemFetch` with `{key:gemKey()}` and returns — no toast, no state change, no "quota exhausted" surface. The user silently starts spending their own key. | VERIFY-W1-F C14 |
| E7 | 🟠 | **Managed-AI users never reach the guaranteed-Hebrew voice.** `gemSpeak` requires a BYOK key (`app.js:5026`) and `vcSpeak` only calls it `if(gemKey())` (`5061`) — yet the Worker's allow-list (`worker/index.js:43`) already matches `…preview-tts:generateContent` and would forward it. Gemini is the **only** path with a *documented* Hebrew guarantee (`he` in the supported-languages table); `speechSynthesis` has no spec or vendor guarantee of a Hebrew voice on any device. Users on the app's default online path get the weaker voice. That is backwards. | W5-D |
| E8 | 🟠 | **TTS silently bills the owner.** Runtime-verified by intercepting the fetch, not read: `gemSpeak` (`5025`) gates on `gemKey()` but calls `gemFetch` **without** `opts.key`, so `gemMode()` routes to managed — the TTS request goes to the Worker with `X-Access-Code` and no `x-goog-api-key`. | W4-A §cliff 5 |
| E9 | 🟠 | **MT hydration is an uncapped leak.** Per-element calls at ~600 tokens (`app.js:6974`) with the cache silently ceasing to persist above 3,000 entries (`6981`), so translation re-runs forever. `6993` already short-circuits on a pre-translated dict — the fix is to move it to build time. | W4-B |
| E10 | 🟡 | **`aiJSON` makes 2 billed attempts on an HTTP-200-with-empty-candidate** (`4374`) — a 400 on the two grounded callers costs ~$0.07 per tap. | W4-A §cliff 6 |
| E11 | 🟡 | **No constrained decoding.** `grep -n responseSchema app.js` → **0 hits**; only `responseMimeType:'application/json'` at `4352`, and that is dropped when `search` is on (`4348-4352`). Schema conformance is entirely post-hoc. Acceptable given comprehensive validators — but a right-JSON/wrong-field-types object can slip through. | VERIFY-W1-F C11 |
| E12 | 🟡 | **User free text is concatenated directly into prompts** with no delimiting or sanitization: `4245` (`'שאלה: '+q`), `8317`, `8470` (`'תיאור התקלה: '+problem`), `8566`, `5266`. Safety constraints in the system prompts are **soft** instructions (`4242`, `5258`, `5264`, `8478`, `9307-9308`) — the guard layer is the enforcement, which is why the Tier-C/D holes matter. | VERIFY-W1-F C10 |
| E13 | 🟡 | **`vcSpeak`'s TTS error messages are Hebrew-only.** The 429/quota, 403/billing, 404/model-not-found mapping is real and well-designed, but all four detail strings (`app.js:5065-5068`) are bare Hebrew literals; only the envelope is bilingual (`5069`). An English-UI user gets *"Gemini voice: חריגת מכסה — הקראה קולית (TTS) מוגבלת מאוד… — switching to the system voice."* | VERIFY-W1-F R7 |
| E14 | 🟡 | **Worker security posture is dev/beta by the author's own statement, and the product is now online-first.** CORS `Access-Control-Allow-Origin:'*'` (`index.js:21`, with the author's "tighten for production" comment); **no rate limiting in all 91 lines**; unauthenticated health check leaks `hasKey` (`38-40`); the access code is a **shareable 72-bit bearer string** (`scripts/central-code.mjs:36`) with **no account system to bind it to**; `cap:0` codes are unmetered as well as uncapped. | VERIFY-W1-F C13; VERIFY-W1-A C18-C21 |
| E15 | 🟡 | **No CSP or security headers while the Gemini key lives in `localStorage`.** `build.py:427-428` writes only `Cache-Control` rules. The key is read at `app.js:5006`, the access code at `5009`; the page loads a third-party stylesheet (`build.py:146`); and `centralUrl` (`app.js:4533`) accepts a pasted origin **with no scheme validation**, so `http://` is accepted and the access code goes out in cleartext. **No exploitable injection was found** (AI answers escaped at `4454`, equipment names at `6590`, no `eval`/`new Function`) — this is defence-in-depth, and it is four lines in a file that already emits `_headers`. | W5-C §1.3 |
| E16 | 🟡 | **The AI hub lists 5 of 14 features** (`AI_TOOLS`, `9330`) — discoverability, not functionality. | VERIFY-W1-F C3 |

### 3.F · Non-functional (i18n, a11y, PWA, perf)

**F-i · i18n**

1. 🟠 **fr/de/es ship in the language picker at 2.1 % coverage with no gate.** Build output on every run:
   `de: 83/3985 (2%)`, `es: 83/3985 (2%)`, `fr: 83/3985 (2%)`. `app.js:6878` derives `I18N_LANGS` from
   *whatever files exist*. Measured Hebrew leakage in French mode, under `dir="ltr"`:
   **wizard 33/36 nodes = 92 %**, **events 2/2 = 100 %**, **catalog 130/231 = 56 %**, home 9/51 = 18 %.
   There is **no `fr/de/es.data.json`**, so even a complete chrome dictionary would leave all item
   descriptions untranslated. And **all 53 Hebrew toast messages leak Hebrew for fr/de/es** — exact lookup
   against an 83-key dict with no English fallback in `tr()`. *(English is clean: 0 % across all five
   screens — the machinery works; the gate does not.)*
2. 🟠 **The English-mode leaks that remain are few but sharp.** Confirmed: `'רענן עכשיו'` (the PWA update
   toast's **button**, `9553`), the default `'בטל'` action label (`2776`) — neither is rescuable by
   `tnode()`'s prefix-strip regex (`6917`) because both begin with a Hebrew letter — and the hardcoded
   wizard step counter `'שלב '+n+'/'+len` (`7166`, confirmed live: `cwTitle`=`🎉 Event wizard`, step buttons
   `Step 1: Basics`, `cwLbl`=**`שלב 1/6`**). Beyond that class: the alarm banner (§3.A.8), the method-toggle
   keys (F-i.3), the catalog metric line and count (`1679`, `1563-1571`), and the kosher chip which renders
   `"Kosher only"` and then **reverts to `"✓ כשר בלבד"` on the first click** (`1705` rewrites what `1697`
   built with `L()`); `buildFilterBar` is never called from `applyLang`, so a live switch never re-renders
   it. A static scan finds **367 lines** building HTML with a Hebrew literal not passed through `L(`/`t(` —
   an upper bound (some are `data-mt` blocks), but the alarm banner proves the class is live.
3. 🟠 **An i18n attribute name collides with a domain attribute name, and English destroys every recipe's
   method toggles.** `methodToggleHTML` emits `<button data-mt="sv">🌊 Sous-vide</button>` (`1019`);
   `hydrateMT` (`6989`) treats `data-mt` as *the source text*
   (`el._mkMt !== undefined ? el._mkMt : (el.getAttribute('data-mt') || el.textContent || '')`). Everywhere
   else `data-mt` is a bare attribute so `getAttribute` returns `""` and it falls back to `textContent`;
   here it carries a value, so `src="sv"`, no dictionary hit, and `textContent` is overwritten with `"sv"`.
   `hydrateMT` returns early for Hebrew (`6987`), which is exactly why only Hebrew is unaffected. Measured on
   a fresh English boot: `["sv","smoke","grill"]`. It is the **only valued** `data-mt` in the file
   (1 valued vs 67 bare).
4. 🟡 **RTL isolation is applied locally, not systematically.** 7 `dir="ltr"` uses, all in the `occ2` cluster.
   Older strings such as `'עד ~68-71° פנים'` (`2888`) carry none. *Not claimed as a visual defect* — the
   Wave-1 hedge is correct and echoed.
5. 🟡 **14 of 15 `data-i18n*` attributes in `build.py` are dead markup.** `applyI18n` (`6905`) queries
   **exclusively** `[data-i18n-html]`; `build.py` ships 13 `data-i18n=`, 1 `data-i18n-ph=` and exactly one
   working `data-i18n-html=` (`:166`). The strings still translate — via `tnode`'s Hebrew-source text walker,
   not the attribute mechanism.

**F-ii · Performance** (all measured on live production, 390×844, DPR 3, 4× CPU, Slow 4G, fresh isolated context)

6. 🟠 **Cold Core Web Vitals: LCP 2,863 ms · CLS 0.29 (Bad) · TBT 853 ms · FCP 1,913 ms · loadEnd 5,314 ms.**
   The worst layout shift is a **single event scoring 0.2873 at 5,270 ms** — 3.4 s *after* first paint, when
   the app's own JS finishes booting and rewrites the home screen. Lighthouse's warm run reports 0.053, a
   **5.5× under-report**. Warm-SW: LCP 1,110 / CLS 0.00 / TBT 611. Desktop unthrottled: LCP 347 / TBT 58.
7. 🟠 **The cost is parse, not bandwidth.** `decodedBodySize 2,689,578` vs `encodedBodySize 659,999` — 4.07:1.
   Main-thread at 4×: ParseHTML **400.3 ms**, `v8.compile` **177.9 ms**, EvaluateScript **266.1 ms**,
   Layout **812.0 ms** (longest single event 542.3 ms), total RunTask 1,753.6 ms. DOM at rest is small:
   620 elements, depth 7. **Any remediation framed around "a 2.6 MB download" is aimed at the wrong number.**
8. 🔴 **In non-Hebrew mode, 62 % of wall-clock is spent in main-thread long tasks while a timer runs.**
   `app.js:9540` is a `MutationObserver` on `document.body` (`childList`, `subtree`) that re-runs
   `applyI18n` + `tnode` + `hydrateMT` over the **whole body** on a 50 ms debounce whenever the language is
   not Hebrew; `tnode` (`6907-6921`) walks every text node via `createTreeWalker` **plus** a full
   `querySelectorAll('[placeholder],[aria-label],[title]')`. `wireTimer`'s `tick` (`2338`,
   `setInterval(tick,250)`) writes `textContent` every 250 ms, which per spec replaces the child Text node
   and is therefore a `childList` mutation. **Measured, reproduced twice within 1.5 %:**

   | UI language | frames in 8 s | p95 frame | long tasks | long-task time |
   |---|---|---|---|---|
   | he | 481 | 17.0 ms | **0** | **0 ms** |
   | en (run 1) | 254 | 143.6 ms | **36** | **4,984 ms** |
   | en (run 2) | 248 | 141.1 ms | **37** | **5,061 ms** |

   ~60 fps → ~32 fps, one ~135 ms task every ~220 ms, for the entire duration of a cook. Measured on the
   **home** screen (585 elements); the catalog grid adds hundreds more to the same walk, so this is a floor.
9. 🟡 **Render-blocking Google Fonts on the critical path**: requested at 645.9 ms, finished 1,265.4 ms —
   **619.5 ms blocking** before an FCP of 1,913 ms — then 6 woff2 files totalling 102,070 bytes that do not
   finish until 3,324 ms.
10. 🟡 **No minification** for 882,106 B of JS and 171,796 B of CSS (`grep -in "terser\|uglify\|minif\|csso\|esbuild" build.py` → 0).

**F-iii · Accessibility** (Lighthouse 13.4.0 / axe-core 4.12.0 + DOM measurement)

11. 🟠 **Scores: A11y 94 · Best Practices 100 · SEO 82** (identical desktop and throttled mobile). Failing
    audits: `color-contrast`, `label-content-name-mismatch`, `landmark-one-main`, `meta-description`,
    `robots-txt`, `llms-txt`. *Note: this Lighthouse build emits **no `performance` and no `pwa` category** —
    any future report quoting either score for this app is quoting something the toolchain does not produce.*
12. 🟠 **The default theme is the worst of four for contrast — 5 of 8 measured pairs fail AA.**
    `.foot-stamp` **1.77:1**, hero `<b>` **2.66:1**, `.ptag` 2.95:1, active nav 2.98:1, `#cHomeAiMore` 3.04:1.
    **charcoal fails 0 of 8**; walnut and slate fail 2 each. The neutral ramp got an AA pass; the accent ramp
    never did.
13. 🟠 **`<main>` measures 0×0.** `<main id="mainContent" tabindex="-1">` exists and is visible but lives
    inside `#scr-catalog`, one of the four screens sitting at 0×0. So the visible home content is **outside**
    `<main>` — that is the `landmark-one-main` failure, and it means **the skip link skips to a zero-size
    element on a hidden screen**.
14. 🟠 **Zero `aria-live` regions exist in the document at rest.** `toast()` does set `role="status"` and
    `aria-live="polite"` (`2774`) — but on the element it creates in the same operation that inserts the
    text, which is frequently not announced. *(The timeline's 10 pre-mounted `tt-alert` regions are the
    correct pattern and do exist.)*
15. 🟠 **25 of 36 interactive elements on home are under 44 px** (0 are under 24, which is why Lighthouse
    `target-size` passes): 18 `lane-chip` at **37 px**, `#cHomeAiMore` at **26 px**, `#cPathCook` 30 px,
    panel close 30×30. Elsewhere: the **13×13 px** "block when short on time" safety checkbox, the
    occupancy scrubber at 330×**16** with a 15 px thumb and `position:static` (so it scrolls away with its
    own clock), recipe step checkboxes 26×26, timer ▶/↻ 30×30, wizard step segments **55×7 px**, the
    pantry's destructive `×` at **14×20** beside 26×26 steppers. **`.cnav` (78×70) and the FAB (78×88) pass.**
16. 🟠 **`occ2` and the cook timeline carry no ARIA.** All ten `_occ*` builders in the shipped bundle emit
    **0** `aria-*` and **0** `role=`. The rendered timeline: 30 elements, 4 with any ARIA (all the same
    expand-button label), **0** list/`ul`/`ol` semantics for a sequenced cook plan. The fit verdict —
    the single most decision-critical output of the occupancy feature — flips silently for a screen-reader user.
17. 🟠 **Focus is not managed on the wizard, and Chrome says so.** After clicking the FAB,
    `scr-wizard.contains(document.activeElement) === false`. Chrome's own issue log, verbatim: *"Blocked
    aria-hidden on an element because its descendant retained focus… Element with focus: `<button.x>`;
    Ancestor with aria-hidden: `<aside.panel#panel>`."*
18. 🟡 **13 unlabelled form fields** per Chrome's issue panel — including the primary home search box
    (placeholder only). **11 of 11 equipment-form controls have unlinked labels** (no `for=`, no wrapping),
    so the label text is not tappable, and `#eqvArea` lacks `inputmode`.
19. 🟡 **Wizard step 2 puts 279 buttons into the accessibility tree at once**, each with a ~40-word
    accessible name (the entire card paragraph), no list or group semantics, no headings between categories.
20. 🟡 **`label-content-name-mismatch`**: `#cHomeLang` has `aria-label="Language"` while displaying
    `🇮🇱 עברית ▾` — a voice-control user saying the visible word cannot activate it.
21. 🟡 **`.cnav` is a plain `<div>`** — 0 `nav` landmarks, 0 `role="navigation"`, 0 `aria-current`.
22. 🟡 **User-uploaded content photos ship with `alt=""`** (`app.js:3631`).
23. 🟡 **No `prefers-color-scheme` anywhere** (`app.css`, `index.html`, `build.py`, `dist/index.html` — 0
    occurrences; no `matchMedia` probe). Default is bright cream (`PREFS.theme.def='cream'`, `6803`); a good
    dark theme exists but a user at a smoker at 02:00 gets `rgb(250,236,216)` at full brightness until they
    find Settings → Appearance.

**F-iv · PWA and shell**

24. 🟡 **Installability is passive** — `beforeinstallprompt`/`deferredPrompt`/`appinstalled`: **0** matches in
    `app.js`, `index.html` and `build.py`. Installs are not blocked, just never solicited.
25. 🟡 **The manifest has no `shortcuts` and no `screenshots`** — no richer desktop install dialog, no
    long-press jump list to "Active cook" / "New event".
26. 🟡 **No `meta description`.**

**F-v · UI craft** (reproduced live at 390×844)

27. 🟠 **The serving DATE clips the year.** `<input type="date">` at `app.css:555-556` `width:120px`; value
    reads back `2026-07-22` but the field paints **`22/07/202`** — the last digit eaten by the calendar
    glyph. `scrollWidth === clientWidth`, so no DOM signal fires. **This is the single field that decides
    whether a 30-hour cook lands on the right day**, and it clips at every `--fscale`.
28. 🟠 **Navigating to Catalog scrolls the search box off-screen while telling you to use it.**
    `cNavGo('catalog')` calls `main.scrollIntoView({block:'start'})` (`7137`). Measured on arrival:
    `scrollY 179`, `#q` top **−72**, `.cshead` (back + ☰) top **−179**, burger not visible. The visible hero
    reads *"בחר קטגוריה או חפש למעלה"* — "pick a category or search **above**".
29. 🟠 **Occupancy tile labels truncate to 2–3 characters** (`חז…`, `Go…`) — `Math.max(18,…)` (`app.js:568`)
    yields a 47 px tile giving 26 px of label room against 47 px needed; the full name lives only in
    `title=`, which is dead on touch.
30. 🟡 **The work plan says it cannot check capacity, then reports a capacity conflict on the next line.**
    `unresolvedHtml` (`5913`) and `contentionHtml` (`5914`) are concatenated bare at `5924` with no mutual
    guard, and they are **not** mutually exclusive by construction: `_unresolved` collects items where
    `cookerFor()` is ambiguous while `_clashes` (`262-288`) is computed only over items that **did** resolve.
31. 🟡 **A sous-vide bath's over-capacity is described in Hebrew as an *area* overflow.** `5920`
    `L('חורגים מהשטח של','exceed the capacity of')` — English is dimension-neutral, Hebrew says "area", and
    it fires for volume devices because `280` sets `bad='area'` for *any* over-verdict. The same feature
    prints the bath in litres 5,000 lines earlier (`637`).
32. 🟡 **The short-time warning is ungrammatical in both languages and reports raw minutes.**
    `fmtServe` (`5562`) returns `"אתמול 05:00"`; the template (`5594`) prefixes `ב-` → *"at-yesterday 05:00"*;
    English is the same shape. `1627 דק׳` is 27 hours expressed in minutes.
33. 🟡 **Row chevrons never mirror** — every `.cmore-item` renders a hard-coded `←`, measured `['←','←','←','←']`
    in English.
34. 🟡 **A "⎙ PDF" print button appears on every panel** from the shared `toolTop` header — including the
    first-run "how much experience do you have?" modal, the More sheet and the language picker.
35. 🟡 **The Projects header block reads as broken** — the title box wraps to 68×72 while five action chips
    wrap raggedly across three rows (no overflow; measured `[]`).
36. 🟡 **Type, space and radius are not tokenised**: 34 distinct font sizes (8.5–90 px in 0.5 px steps), 24
    padding values, 16 gaps, 21 radii, and the one radius token `--r` is used twice. *(Colour is the
    counter-example and is excellent.)*

### 3.G · Product-platform

1. 🟠 **The shipped product still tells users it works with no network — in four places, in both languages.**
   `build.py:334` renders the footer *"הנתונים מקומיים, ללא חיבור לרשת"* on **every screen**, and
   `lang/en.json:261` **deliberately translates it** ("Data is local, no network connection.") — so it ships
   in every shipped language, which is worse than a Hebrew-only stale string. Plus `app.js:3929`
   (*"בלי התקנה, בלי חשבון, בלי שרת"* — no installation, no account, no server, while `worker/` exists),
   `app.js:3931`/`3939`, and `README.md:4` ("fully local-first"). Confirmed live in production on v258.
   **This directly contradicts the owner's 2026-07-22 online-first decision** and sits one tap from an AI hub
   that requires a key and a network.
2. 🟡 **No unified `mk-schema` migration registry** (flagged since ROADMAP-v149).
3. 🟡 **Zero analytics anywhere** (verified). Every allowance, tier and threshold would be a guess.
4. 🟡 **No account system.** The managed access code is a 72-bit bearer string with no device binding under
   `CORS: '*'` — one paid code serves fifty people, no bug required.
5. 🟡 **No cloud sync** (deliberately deferred pending a business decision).
6. 🟡 **No probe integration and no log-import path** (see §7 step 12 for the staged recommendation).
7. 🟡 **Dead surface area**: 9 orphaned functions with zero callers anywhere (`svBaths` 230, `gearLabelFor`
   794, `groupOf` 1731, `svOrderDesc` 2958, `itemPickLabel` 3292, `cNavState` 7127, `cwSeasFull_desc` 7292,
   `cwToggleSeasByKind` 7333, `cwSeedResume` 7458 — each verified against the `window[fn]` dynamic-dispatch
   escape hatch at `7591, 8848, 9348, 9446`); 4 self-documented stubs (`saveCart` 1459, `cwPaintMethods` 7459,
   `cwPaintProteins` 7460, `cwUpdateHint` 7461); ~70 lines of dead theme CSS at `app.css:390-464`, stripped
   on every paint by `applyAppearance` (`app.js:6997`); 14 of 15 dead `data-i18n*` attributes.
8. 🟡 **116 empty catches in `app.js`** (`catch(e){}`; 129 whitespace-tolerant). The large majority are
   legitimate progressive-enhancement guards; the exceptions with user-visible consequences are named in
   §3.B.12 and §3.B.25.

### 3.H · Business and monetization (unstarted)

Wave 4 ran after discovery deliberately, because pricing depends on knowing what exists and what it costs.

1. 🔴 **There is no billing code anywhere.** Verified: every `billing` hit in `app.js` is a Google Cloud TTS
   error string; every `stripE` is `stripEmoji`.
2. 🔴 **Metering is blind to roughly 90 % of cost.** `worker/index.js:76` meters
   `usageMetadata.totalTokenCount`; grounded search is a **per-request** fee that appears in no token
   counter. **The 2M-token default cap authorises ~$16/mo per code and meters ~$1.60.**
3. 🔴 **Four revenue blockers in 91 lines of Worker**, all re-verified: fail-open (`:56`) that is
   *permanent* because the record is never rewritten; cap-by-omission (`:58`); TOCTOU read `:53` / write
   `:84`; **zero rate limiting** — one leaked code at 1 req/s = **$126/hour**, with the token cap
   intervening only after ~7 minutes.
4. 🟠 **Measured unit economics** (Gemini paid tier, pricing fetched 2026-07-22): persona A curious browser
   **$0.27**/mo · B weekend griller **$0.67** · C enthusiast + Voice Cook **$2.83** · D charcutier **$1.10** ·
   blended **$1.22**. **77–90 % of every persona's bill is the `$0.035` grounded-search request fee**, not
   tokens. Persona C = search $2.17 (77 %) + TTS $0.45 (16 %) + *all tokens* $0.21 (8 %). Photo analysis,
   assumed expensive, is measurably the **cheapest** feature ($0.0014/call — Gemini's tiling caps a
   4032×3024 photo at ~1,548 tokens). The free grounding allowance (1,500 RPD) is **per-project, not
   per-user** — 45,000/mo shared by everyone, covering ~725 enthusiasts.
5. 🟠 **The two business reports contradict each other by 10.9×, and the reconciliation kills the plan as
   drafted.** W4-B costed an "action" at $0.0035; W4-A **measured** Ask-the-Fire at $0.0381. A 400-action
   allowance all spent on Ask-the-Fire = $15.24 COGS against $4.42 net revenue: **−245 % margin, losing
   $10.82/user/month on the app's most prominent button.**
6. 🟠 **Minimum viable price**: $4.99/mo floor, $7.99 defensible. $2.99 is gross-margin **negative** (−8.7 %)
   against persona C as the code stands. $4.99 yields 37.7 % worst-case today but **78.3 % after the
   search-conditional fix**. The recommended packaging (₪249/yr hero · ₪29/mo IL; $59/yr · $8.99/mo intl —
   net-of-VAT parity, not a geographic premium) **clears 78–79 % gross margin only after that fix**; today
   it yields 36–40 %.
7. 🟠 **The free/paid boundary that the code already earns**: deterministic ⇒ free forever; probabilistic ⇒
   metered. Three independent reasons — ethical (gating cure/botulism guards gives non-payers a measurably
   less safe product), **economic** (`askRefuse`/`AI_REFUSALS` at `4146-4197` is pure regex firing *before*
   any network call; `cureScaleGuardHTML` `1849`; `SAFETY_FACTS()` `4127`; `UMAKE_CALC` `8571`; 279 cited
   `src` blocks — all local, **zero marginal cost**, so no revenue is sacrificed), and strategic (the refusal
   card is the viral demo). Corollary: **`mk-uilevel` must never be a price axis** — it inverts safety.
   Packaging decision that follows from the measurement: **make grounded web search the paid capability** —
   it is 77–90 % of COGS *and* the #3 hallucination surface, so gating it cuts free-tier cost from $0.27 to
   ~$0.03/user/mo **and improves free-tier safety**.
8. 🟠 **Market reality.** Bottom-up gives ~$870M US — **rejected**, because total *global* paid recipe-app
   revenue is projected at $399.8M by 2027, so the bottom-up US figure is 2.2× the entire global category.
   Honest **TAM $40–80M/yr worldwide · SAM $15–30M (Hebrew slice $0.5–1.5M) · SOM $90k–$255k ARR at Year 3**,
   of which Israel contributes $16k–$60k. Israel Year-3 midpoint ≈ **$38k/yr — below one Israeli developer
   salary.** Not venture-scale; a credible solo/lifestyle business or an OEM/acquisition target.
9. 🟠 **The competitive claim in `docs/ai-strategy.md:77` ("Nobody owns the software-first AI copilot") is
   overstated and should be corrected.** The market is barbelled — free hardware-tethered apps (MEATER,
   Weber Connect, Traeger, ThermoWorks; Anova $10/yr) vs paid content (AmazingRibs $34.95/yr, ChefSteps
   Studio Pass $69/yr). The middle is **thin but not empty**: Time To Plate sells backward-planning across
   real appliances including a smoker for $39–99/yr, and Weber BBQ Timer ships a free "Cook Plan" that
   finishes dishes together.
10. ✅ **What differentiation is real, measured**: (a) **Hebrew-first** — verified uncontested; a Hebrew
    search returns blogs and butcher shops, zero apps. A moat against entry, not a revenue source.
    (b) **Cited corpus** — real and measured (279 `src` blocks re-verified independently); no competitor
    publishes per-item dated provenance. **But "guards your cure" is a claim the code does not yet earn** —
    the cure guard is advisory and both plan-depth gates are 0 % built. (c) **Capacity scheduler —
    genuinely uncontested**; Time To Plate, Weber BBQ Timer and BBQ Replay were fetched and none mentions
    rack space, dimensions or shelf capacity. Caveat: `footprint_cm2` is static (§3.D.5).
    (d) **Charcuterie** — ~4 % of the smoking audience (r/Charcuterie 44k vs r/smoking 1.0M): a credibility
    wedge, not a market.
11. 🟠 **Anova is licence-blocked.** An official API does exist (developer portal, published BLE GATT UUIDs,
    announced 29 Jul 2025) — but the ToU (effective 21 May 2025) limits it to **"personal, non-commercial
    purposes"**, bars key-sharing and redistribution, and caps liability at $100. W1-H called it "the best
    risk/reward integration in this whole survey": **true technically, false contractually.** Reclassify to
    self-host/hobbyist only.
12. **Honest recommendation, adopted: do not monetise now.** The problem is misdiagnosed — it is unbounded
    *cost*, not missing revenue. The search conditional captures 68 % of the gap ($1.22 → $0.39 blended) in
    days, against weeks-to-months for accounts + metering + billing. There is zero analytics, so every
    allowance is a guess, and the 10.9× miss above shows what a guess costs. Ship the Stage-0 cost/safety
    work in ~1 week; revisit charging in ~2 quarters. **Selling an unguarded spoken safety number (§3.A.1)
    is a different liability from giving one away** — A1/A2 are paid-launch blockers, not merely bugs.

---

## 4. Corrected claims — the refutation ledger

**This section is a first-class deliverable.** Wave 2 adjudicated **261 substantive claims** across eight
Wave-1 reports:

| Verdict | A | B | C | D | E | F | G | H | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| CONFIRMED | 22 | 57 | 21 | 22 | 16 | 16 | 24 | 28 | **206** |
| **REFUTED** | 5 | 4 | 3 | 4 | 9 | 8 | 1 | 8 | **42** |
| UNVERIFIABLE | 1 | 2 | 0 | 1 | 1 | 3 | 1 | 4 | **13** |

**A 16 % refutation rate on reports written under an explicit "evidence or it does not exist" rule.** Add the
three pre-sweep false alarms and the total corrected count is **45**. That number is the finding.

### 4.0 The three pre-existing false alarms (do not re-raise)

| Claim | Verdict | Truth |
|---|---|---|
| "A ~2.5 g Cure #1 dose on a 1 g scale warns nobody" | **FALSE** | `cureScaleGuardHTML` (`app.js:1849`) sets `hardMax = 5×d`; on a 1 g scale that is 5 g, so a 2.5 g dose is **below** it and the **hard** warning fires, naming botulism risk. Three production call sites (1899/1911/1920). Fails safe when no scale is registered. |
| "No `safe`/pasteurization value carries a citation (0 of 177 items)" | **FALSE** | **279 `src` blocks ship**, merged from `sources.py` at build (`build.py:84-105`). The auditor grepped `data.py` only. Re-confirmed independently in this sweep (VERIFY-W1-E C1, C2). |
| "55/56 toasts are untranslated" | **FALSE** | They live in `lang/en.data.json` (3,677 keys), merged with `en.json` at `build.py:352-366`. **48–53 of 53 covered.** W1-D checked `en.json` alone; **the sweep controller repeated the identical error while "independently verifying"**, and W1-B caught both by running the app. |

### 4.A · Refuted in `W1-A-code.md` (5)

1. **"14 captured device properties have zero readers" — FALSE. All 14 are read at runtime.** The report's
   grep (`propOf([^)]*,'X')\|\.cap\.X\b`) is reproducible and really returns 0 — and is the wrong grep. Every
   read is **bracket notation**: `app.js:6393-6399` (the generic device-chip loop over the category's own
   schema), `6390` (`multiCap`, covering `plates`/`nozzles`), `2998` (`_sizesOf`), `6602` (`propVal`, edit
   pre-fill). **Runtime proof:** one device per category saved with all 14 keys populated → 14 chips
   rendered; `cap={}` → 0 chips. `chipsFor` is live (called at `6432`, covered by
   `equipment-props.spec.ts:150` and `equipment-walkthrough.spec.ts:82`).
   **What survives (now §3.D.2):** the 14 are read for **display only** — none feeds the planning/occupancy/
   safety engine.
2. **The marquee exemplar for the "systemic pattern" is a misquote — `equipPlan` is called UNGUARDED.**
   The report quotes `app.js:5673` as `if(typeof equipPlan==='function') stages=equipPlan(...)`. The actual
   line is `stages=equipPlan(m, st.method, stages, (typeof evScope==='function'?evScope():null));` — the
   `typeof` guards **`evScope`**, a different function, inside an argument. `grep -n equipPlan app.js` returns
   the definition (973), two comments (3035, 5862) and this **one unguarded call site**. Delete `equipPlan`
   and it throws a loud `ReferenceError` — the *opposite* of the silent-no-op failure mode.
   **What survives:** the general pattern is real — 482–483 `typeof …==='function'` guards do exist.
3. **The second pluralization site (`app.js:8010`) is unreachable with n=1.** Line 8009 opens the block with
   `if(list.length>=2){`. Runtime check: `#cetFull` does not render at n=1 at all. **One live bug site, not two.**
4. **The contrast case (`app.js:5900`, `cookerStripHtml`) contains no count and no conditional.** The line is
   a ternary on whether the strip renders at all; no number is interpolated, no singular/plural branch exists.
   The narrative "the fix exists ad hoc in one place and was not extracted" **has no referent**.
5. **The empty-catch count is wrong** — 108 claimed, **116** actual (`catch(e){}`), 129 whitespace-tolerant,
   0 for `catch{}`. Directionally harmless (it strengthens the surrounding point), but the printed figure is
   not what the file contains.

*Also downgraded:* the causal claim that low internal structure **caused** the higher defect density in the
`wire` and `Live Cook Copilot` regions is **UNVERIFIABLE** — n=2 regions, no baseline, and equally explained
by those regions being the newest and most churned code. It was honestly hedged as "consistent with", so it
is not a defect in the report — but **no plan should be built on it.**

### 4.B · Refuted in `W1-B-conformance.md` (4) — all in the *conservative* direction

1. **The Doc-2 T4 caveat ("not independently re-verified… would require a full app.css diff") is refuted —
   the clause is fully verifiable and fully met.** The premise ("3 `:root` blocks") is wrong: `app.css` has
   exactly **one** `:root` (`:2`), and the other two CSS theme blocks (`html.light,html.t-vintage` at `:390`;
   `html.t-gold` at `:437`) are **dead legacy**, stripped on every paint by `applyAppearance`
   (`app.js:6997`). The real themes are the JS `THEMES` object (`6840-6848`) applied as inline custom
   properties (`6999`), and **all four** define all five diagram tokens.
   `tests/occ-css-tokens.spec.ts:24-26` asserts it and passed live.
2. **"DONE by strong inference" for Doc 3 T3/T4 and Doc 5 T3/T4 is refuted — all four are directly citable.**
   Obtained in under a minute: `propField` (`6603`), the core/pro tier split (`6622-6623`), field ids
   (`6609,6613,6619`) read back at (`6538,6557`); `chipsFor` (`6388`) with the property-chip block
   (`6394-6398`); all five ported helpers (`932, 953, 987, 1026, 8139`) with `grep -c "gearState" app.js` → **0**;
   `gearConciergeApply` (`6144`). **CONFIRMED outright.**
3. **Orphan #9 ("not confirmed, worth a follow-up") is refuted — it is confirmable and confirmed.** One grep
   settles it: `build.py` ships **13** `data-i18n=` and **1** `data-i18n-ph=`; the only runtime reader is
   `applyI18n` (`6905`), which queries **exclusively** `[data-i18n-html]`, of which `build.py` ships exactly
   one (`:166`). **14 of 15 are dead markup — upgrade to a confirmed finding.**
4. **"63 occupancy specs" is wrong.** `ls tests/occ*.spec.ts` → **19** files; `grep -c "^test("` → **86**
   tests. No subset boundary produces 63. No finding is invalidated (every cited test name — O1–O25, C1–C7,
   H3a–H3d, W4/W6 — exists and a sample re-ran green), but the stated run size is unsupported.

*Unverifiable:* live passes for the ~14 occupancy specs not re-run (names confirmed at the cited numbering,
simply not re-executed); and commit `92961db`'s "Full suite 366/366 green", which is a claim about a past run
that cannot be settled from a repo whose suite now has 82 spec files.

### 4.C · Refuted in `W1-C-app-walkthrough.md` (3)

1. **D15 "Opening the occupancy view lands on an empty rack… a default of 'the busiest moment' would open on
   the answer" — REFUTED. The busiest-moment default already exists and is deliberate.** `app.js:695-713`
   `_occOpenAt` carries a comment explaining exactly this reasoning and does `if(anyAt(span.now)) return
   span.now;` then scans every stage start keeping the fullest. `openOccupancyView` calls it at `718`. The
   view opened at 08:09 **because `anyAt(08:09)` returned true** — the Anova bath was loaded, which the report
   itself states. **The fix it proposes is the code already shipping.** Residual (now §3.C.11): device card
   **order**.
2. **D18 "'פרויקטים ומזווה' … the pantry is ~800 px below; the label promises a destination the tap does not
   reach" — REFUTED.** `openPantry` (`3502-3505`) closes the panel and calls `cNavGo('projects')`. Measured
   after a real call: `screenOn:true, scrollY:0`, pantry header at **docTop 382** in an **844 px** viewport,
   with its first four inventory rows visible. **The report's own screenshot shows the same thing.**
3. **D22 "'הבא11:00' — the badge and the time run together with no separator" — REFUTED.** `app.css:160`
   `.wp-nowtag{padding:0 5px;margin-inline-end:5px}`, and the report's **own** evidence file `wp-p2.png`
   shows the pill on its own line above the time. `הבא11:00` is what `textContent` returns — **a DOM-dump
   artefact, not something a user sees.**

*Corrections carried forward:* D12's "~900 px of empty space" is impossible inside an 844 px viewport — it is
≈**430** CSS px. D6's "9 of 70 Hebrew nodes" is **seed-dependent** (5 of 58 unseeded) — quote the mechanism
and the 2 % build number, never the ratio. D16's "both render their effective value as a placeholder" clause
is dropped (`#eqProp-areaCm2` shipped with no placeholder in an independent run). Screenshot count is **188**,
not 190.

*Also recorded:* W1-C itself investigated and **dropped nine** of its own would-be findings before publishing
— the bidi-scrambled header (disproved by per-character `Range.getBoundingClientRect()`), the inverted
`24 ל׳` unit, the "out-of-order" task list (monotonic; the real defect is the missing day marker), the nav
covering the wizard buttons, "voice-cook is a dead end" (its own no-arg call, not the real path), the
overflowing badge, flag-emoji rendering (a headless-Chromium font gap), "293 English strings leak into the
Hebrew seasonings panel" (they are proper names of rubs), and a 263-node "Hebrew leak" that was the catalog
screen behind an open panel. **This is the discipline that should be normal.**

### 4.D · Refuted in `W1-D-nonfunctional.md` (4)

1. **"55 of 56 toast strings (98 %) have no English translation" — REFUTED.** Re-extracted every `toast(`
   call site and diffed against the **merged** dict: 85 call sites, **53** with a Hebrew literal first
   argument, **0 missing**. Every named "representative miss" resolves (`'הפרויקט נמחק'`→`Project deleted`,
   `'מפתח לא תקין'`→`Invalid key`, `'כל הנתונים אופסו'`→`All data reset`…), confirmed against the **shipped
   `index.html`**, not just the source dicts. The report's own count of 56 sites is also wrong; it is 53.
2. **"The PWA update toast is untranslated" — REFUTED as stated.** `'גרסה חדשה זמינה'` → `"A new version is
   available"`, present in the shipped bundle. **New defect found while refuting it (now §3.F-i.2):** the
   toast's *action-button* label `'רען עכשיו'`/`'רענן עכשיו'` and the default `'בטל'` (`2776`) **are**
   genuinely absent, and `tnode()`'s prefix-strip regex cannot rescue either because both begin with a Hebrew
   letter. **Scope: 2 strings, not 55.**
3. **"Three toasts are structurally unfixable by adding a dict entry" — REFUTED.** `6107`/`6108` route every
   Hebrew segment through `L(he,en)`, which returns the inline English outright for `lang==='en'` — only the
   language-neutral `⚠`/`✓` prefix is literal. `5323` is `toast('❓ '+alts[0])` where `alts[0]` is the user's
   own speech-recognition input. **None of the three is a defect.**
4. **"56 distinct evidenced instances, supersedes the recorded 18" — REFUTED.** The actual English-mode count
   for this class is **3**: `'רענן עכשיו'` (9553), the default `'בטל'` (2776), and `cwLbl` (7166).

**What the refutation upgraded rather than removed:** the fr/de/es picture is genuinely bad and the report
*under*-sold it — **all 53 toast messages leak Hebrew for fr/de/es**, exact lookup against an 83-key dict with
no English fallback. The report reached a partly-right conclusion for the wrong reason and mis-assigned the
defect to English.

### 4.E · Refuted in `W1-E-food-safety.md` (9) — the largest cluster, all data-derivation errors

1. **"32 of 102 `MAKE_SOURCES` entries carry a `calc` override where `cure` is the bare number 2.5" — FALSE
   as stated.** 32 carry a `calc` key; **only 19** have `cure: 2.5`. The other **13** have `cure: None`
   (all `n-*` ids from `sausages_new.py`). **The conclusion survives and is stronger**: merging `cure: None`
   would make `if(calc.cure)` (`1918`) falsy and delete the entire cure line, dose and warning — worse than
   the 2.5 case. `build.py:96-102` remains load-bearing.
2. **"One of these (`m-nduja`) also carries a CRITICAL GAP note" — FALSE. Five do**: `m-cacc`, `m-nduja`,
   `m-sauci`, `m-sopr`, `m-sucuk`. The documentation hazard is **5× larger** than reported (now §3.B.31).
3. **"156 ppm… squarely inside the microbiologically-effective range (72–150 ppm)" — self-contradictory:
   156 > 150.** PMC6043430 was re-fetched live and says *"did not grow in the presence of 72 to 150 ppm
   nitrite"*. The defensible statement is the one the app's own doc makes: **156 ppm is the USDA comminuted
   ingoing maximum**, with the 200 ppm finished-product ceiling above it. Nothing suggests the dose is
   unsafe — only that the stated justification does not hold arithmetically.
4. **"Bacon at ~2.0 g/kg matches 9 CFR 424.22(b)'s bacon-specific 120 ppm mandate exactly" — wrong
   regulation.** 9 CFR 424.22(b) is method-specific: pumped/massaged bacon *shall be used at* 120 ppm;
   immersion-cured *shall not exceed* 120 ppm; **dry-cured bacon shall not exceed 200 ppm**. `bacon()`
   (`data.py:415-428`) is unambiguously a **dry** cure (phase 1 = `"1 · כבישה יבשה (equilibrium)"`, rubbed
   on and vacuum-sealed). 120 ppm is legal and conservative there — but it is not "the mandate, exactly";
   the cited mandate governs a production method the app does not model.
5. **HACCP "Verification: Absent. No confirmation step, no logged reading" — half false.** Every Work-Plan
   task row **including `bcheck`** renders a checkbox whose state is **persisted across rebuilds** under
   `wpck:<scope>:<label>` (render `5940`, persist `5766`, `bcheck` enters `tasks` at `5815`). That is a
   confirmation step, and it is logged as a boolean. **The correct finding is "checked off, never
   *recorded*"** — no numeric field for the measured value (now §3.A.6).
6. **`safetyDiff` is "Real, enforced" — refuted: detected, not enforced, and not surfaced either.** Now
   §3.A.7. The report's framing of it as the app's one "real, enforced" control is **overstated**: it is a
   runtime *assertion harness* — one step better than a test-only check, still invisible to the cook.
7. **"33 specials lack a `safe` citation, but this is not a gap because those 33 have no `safe` field" — the
   finding is right, the stated reason is false.** **Zero of 47** specials carry a `safe` field; the key does
   not exist anywhere in `SPECIALS` (verified key union: `age, cat, cure, diff, eng, heb, n, note, smh, smt,
   tgt, wood`). The real distinction is **category** — all 33 are `cat="גבינה"`.
8. **"No cut claims to save more time than its own sous-vide hold takes — internally consistent" — false,
   twice over.** Nine cuts violate the stated invariant, **and the invariant is the wrong comparison**:
   `saved` means *smoker* hours saved versus the smoke-only path (`app.js:1569`, `2092`, `data.py:227`).
   The meaningful check `saved ≈ soh − smh` mismatches by >0.35 h on **29 of 130** cuts. (Now §3.B.29,
   flagged rather than asserted as a defect.)
9. **"No negative, zero, or absurd values found" — false for `svt`.** Six cuts carry `svt=0` (now §3.B.30).
   They satisfy the report's own stated bound while contradicting its prose.

*Unverifiable:* the USDA FSIS chart itself could not be re-fetched — both `fsis.usda.gov` and the
`foodsafety.gov` mirror return **HTTP 403**. The 63/71/74 values and the whole-muscle-vs-ground distinction
were verified *inside the repo*; 9 CFR 424.21/424.22 and PMC6043430 were fetched successfully.

*Also worth preserving:* W1-E **disproved two of its own near-misses before publishing** — "52 of 102
MAKE_SOURCES entries are orphaned" (an artefact of not calling `MAKES.update(NEW_SAUSAGES)` first) and
"33 specials lack a safety citation" as a gap. And its §3.1 `safe`-floor table **silently omits 2 of the 13
categories present** — organ meats (12 cuts, `safe ∈ {63×1, 65×4, 72×4, 74×3}`) and sausages (1 cut, 71) —
so "every `safe` value sampled traces to USDA FSIS's standard chart" overstates the coverage actually shown.

### 4.F · Refuted in `W1-F-ai.md` (8)

1. **"No `evals/`, no fixture corpus, no CI gate on AI quality — confirmed absent by search" — REFUTED. The
   fixture file already exists: `tests/ai-trust.spec.ts`**, containing verbatim the four prompts the report
   proposed creating, inside a 16-entry adversarial corpus, and implementing **three of its four proposed
   axes** (refusal with 15 phrasings + 7 negative carve-outs; numeric fidelity; output-language). The report
   searched for `evals/` and never opened `tests/`.
   **What survives (now §3.E.3, §3.E.4):** there is **no CI at all**, and the **grounding axis is genuinely
   untested**.
2. **"13 distinct AI entry points" (presented as a complete inventory) — REFUTED; there is a 14th, and it is
   the one most similar to the Tier-D hole the whole report is built around.** Enumerating from
   `grep -n "gemFetch(" app.js` gives 9 transport call sites; the 13 features account for 8.
   **`vcTranslateToEn` (`5186`, transport `5196`)** was missed — because the report enumerated from the
   feature/UI layer instead of from the transport.
3. **"The mitigating factor is structurally present everywhere except `vcAskAI`" — REFUTED.**
   `vcTranslateToEn` is a second exception, **and a worse one**: `mtTranslate` guards the *same content class*
   with `mtGuard`/`mtSafe`; `vcTranslateToEn` returns the model's text raw (`5200`), caches it (`5185`) and
   speaks it. Now §3.A.2.
4. **"`aiSeasonRec`'s `r.reason` truncation is the only type guard on that field" — REFUTED; that field is
   one of the *best*-guarded in the file** (`8415` full type guard with a safe default, HTML-escaped at
   `8423`) — and the report missed the field that is actually unguarded: the pantry advisor's `r.reason`
   (`9176`, no type guard) interpolated **unescaped** into `innerHTML` at `8246`/`8254`. Now §3.A.13.
5. **"Diagnose's example chips invite exactly the dangerous inputs the refusal list exists for" — REFUTED as
   stated.** The chips are real at `8514`, but **neither would trigger `askRefuse` even if it were wired in**:
   `unsafe-mold` (`4177`) requires `/(עובש|mold)/` **AND** a second term (`wash|scrub|eat|safe|cut.?off|…`),
   and "עובש **לבן** על הסלמי" matches none — white mold is the *normal* case per `SAFETY_FACTS()` (`4128`);
   "נתקע ב-68 מעלות" matches no `AI_REFUSALS` test at all. The underlying finding is confirmed; **using this
   justification would send a fixer to write a gate these chips still bypass.**
6. **"Every existing AI-writes-state feature routes through `aiConfirmPanel`" — REFUTED.** Definition at
   `4404`, exactly two call sites (`8363`, `8594`); the seasoning recommender writes state directly
   (`8433-8440`). Now §3.E.5 — the orchestrator's proposed contract must say *establish*, not *inherit*.
7. **"`vcSpeak`'s error-mapping distinguishes 429/403/404 with tailored Hebrew+English messages" — REFUTED.**
   All four detail strings (`5065-5068`) are **Hebrew-only**; only the envelope is bilingual (`5069`).
   **The report converted a real i18n defect into a compliment.** Now §3.E.13.
8. **"`app.js:334` still ships 'הנתונים מקומיים, ללא חיבור לרשת'" — REFUTED as a citation.**
   `grep -c "הנתונים מקומיים" app.js` → **0**; `app.js:334` is `deviceSilhouette()`. **The substance is
   correct against the right source**: the string ships from **`build.py:334`** and appears at
   `index.html:1916`. The README phrase is on `README.md:4`, not `:3`. Flagged because a fixer sent to
   `app.js:334` would find nothing and could conclude the finding was stale. *(Two separate documents made
   this same citation error; W5-C caught it independently.)*

*Unverifiable:* the relative risk **ordering** in §3 (a judgment call with no in-repo referent — though
consistent with the evidence, since hands-free + spoken + zero guards + search-grounded is the union of every
risk factor present); the four orchestrator failure modes (design arguments about a component that does not
exist, though every analogy they rest on is real); and whether account-level Cloudflare WAF rules exist
(dashboard state, not repo state — **report the in-repo half, drop the rest**).

### 4.G · Refuted in `W1-G-workflows.md` (1) — but a load-bearing one

1. **"The whole Phase 4b story is inert in practice. The app never reschedules; it only advises." — FALSE,
   and a passing test in the repo proves it in the real UI.** `tests/scheduler-placement.spec.ts:153`
   ("C3: a small pull staggers the real plan and the timeline says the item is ready early") was **run**:
   `✓ 15 [chromium] › C3 … (3.0s) · 15 passed (13.0s)`. `.tl-early` is emitted **only** by `readyEarlyNote`
   (`5976-5982`), requiring `readyEarlyMs>0`, written **only** at `5706` — after `schedulePlacements` returned
   non-zero slack, after the uniform-slack gate passed, after the stage times were rewritten. The chip cannot
   appear unless the entire path fired end to end. B1/B2/B4/C1 confirm the rest of the mechanism is live.
   **The defensible sentence is: "for a roomy cabinet the placer almost never fires, and the fit test it does
   use is the wrong one."** (Now §3.C.4.)

*Unverifiable:* the "22 realistic menus → 0/22 non-zero slack" sweep — an ad-hoc browser probe with no script
committed, so there is nothing to re-run. Plausible for the stated kit; **not settleable from the repo, and
the conclusion drawn from it is refuted above.**

*Accuracy corrections:* line anchors drift by one in five places (`5700-5701`→`5701-5702`; `5705-5707`→
`5704-5706`; `5712`→`5711`; `5903-5912`→`5904-5913`; `5975-5987`→`5976-5983`) — the quoted code is
verbatim-correct in every case. **§5.8 overstates "the seam"**: `equipPlan` is not the only device→plan path,
and the code comment at `971-972` that the report quotes *as fact* is itself wrong (see §5.8 below). The flow
diagram's `K2` node omits `bath-too-small` (`3139`). **There is no "sample kit" anywhere in the app**
(`mk-equipment` is only ever written by `equipSave`, `222`); the cabinet is simply the first entry in
`EQUIP_CATS.smoker.types` (`35`) and hence the default `<select>` option.

### 4.H · Refuted in `W1-H-probes.md` (8) — feasibility research, external sources

1. **Bluefy requires "iOS 11+" — REFUTED.** The same App Store listing says **"Requires iOS 12.0 or later."**
2. **The "Chrome team" background-Bluetooth quotation and the throttling sentence — REFUTED (citation).** Two
   independent fetches of the cited Progressier page, the second asking for *every* sentence containing
   background/throttl/screen/native-app, returned only *"Just like a native app, a PWA can connect to nearby
   devices via Bluetooth…"* and *"If your app requires Bluetooth on iOS, you will have to create a native
   app rather than a PWA."* **The quoted sentence is not on that page, there is no throttling text at all,
   and Progressier is a third-party PWA vendor, not the Chrome team.** *(The substance — that a web page
   cannot hold a background Bluetooth service — is CONFIRMED on better evidence: MDN's "This API is not
   available in Web Workers", the `[Exposed=Window]` IDL, transient-activation requirements, WebBluetoothCG
   issue #422 open since 2018, and Chrome's documented freezing of background pages.)*
3. **`combustion-ble` listed inside the "Yes — fully open, official" cell — REFUTED (attribution).** It is a
   **community** package by legrego, not under the `combustion-inc` org (whose 8 repos contain no Python SDK).
   The `bleak` dependency is correct; the "official" framing is not.
4. **Govee's "two-byte temp/humidity values" — REFUTED.** GoveeWatcher documents **three** octets
   concatenated into one integer carrying *both* values (`03 21 5d` → 205149; temp /10000 = 20.5149 °C,
   humidity %1000/10 = 14.9 %).
5. **"Web Bluetooth can read advertisement data via `watchAdvertisements()`, making Govee the easiest
   reverse-engineering target" — REFUTED (material).** WebBluetoothCG's own `implementation-status.md`:
   `getDevices()` and `watchAdvertisements()` are **behind `chrome://flags/#enable-experimental-web-platform-features`**.
   A shipped browser cannot read raw BLE advertisements without the user manually enabling an experimental
   flag. **Combustion (GATT connect, no flag) is strictly easier.**
6. **"A GitHub discussion covers pulling previous-cook info via the MEATER API, so import could poll the same
   JSON" — REFUTED.** Discussion #34 is an *unanswered customer complaint* (0 comments, no maintainer reply)
   that shared "Previous Cooks" weblinks show incorrect data. Worse: the API exposes only `/devices` and
   `/devices/{id}` **current** state, and returns a device only while the app or Block holds an active
   Bluetooth **and** Cloud connection. **MEATER cannot act as a retrospective log source at all**, and can
   only be polled *during* a cook the phone app is already bridging.
7. **Joule "implying it relies on Wi-Fi/cloud beyond initial pairing" — REFUTED (inference).** The same
   ChefSteps article continues: *"Additionally, to make changes during a cook, you will need to be back
   within Bluetooth range."* That is the **opposite** implication — the device cooks autonomously with *no*
   connection.
8. **`accuracy` is a property "that nothing currently reads" — REFUTED (wording).** `chipsFor` (`6388`,
   loop `6394-6399`) renders every declared prop as a device chip. **Say "no logic consumes it", not "nothing
   reads it."** (Same class as §4.A.1.)

*Unverifiable:* Android Deep Doze scan-deferral (the cited Android page does not discuss it; the only other
cite is a personal blog); wake-lock battery drain and `visibilitychange` re-acquisition (standard MDN
guidance, but **the report's own citations do not carry it**); Inkbird's 2-year CSV export (a single community
forum post); and the CORS behaviour of the Anova/MEATER cloud APIs (requires a live cross-origin request with
real credentials — the report's hedge and its proxy proposal are correct).

### 4.I · Corrections raised in Wave 5 against Wave 1 and Wave 4

| Corrected claim | Truth |
|---|---|
| "Shipped payload is 2.6 MB" (W1-D §3.1, framed as bandwidth) | **660 KB on the wire**, 4.07:1 compression. The parse cost is real; the bandwidth framing is wrong. |
| "Contrast was audited and passed on the default theme" (W1-D §4.1, read as a positive) | The core **body** tokens do pass — but cream has **5 measured AA failures on accent text**, down to 1.77:1, and is the **worst of the four themes**. charcoal fails 0 of 8. |
| "charcoal/walnut/slate contrast unverified, not failing" (W1-D §4.1) | **Now verified**: charcoal 0/8, walnut 2/8, slate 2/8. |
| "A skip-link to `#mainContent` exists" (W1-D §4.2, listed as a positive) | The link and target exist, but **the target measures 0×0 on a hidden screen** — the skip link goes nowhere, and this is also the root cause of `landmark-one-main`, which W1-D did not predict. |
| "`toast()` sets `aria-live` — correct pattern" (W1-D §4.2) | **Zero `aria-live` regions exist at rest.** A region created in the same operation that inserts its text is frequently not announced. |
| "`.cnav`/`.chip` sizes need a rendered DOM" (W1-D §4.4) | **Now measured — and `.cnav` (78×70) and the FAB (78×88) PASS.** The real failures are 18 lane-chips at 37 px and `#cHomeAiMore` at 26 px. |
| "258 hardcoded theme hexes in app.css" (W5-B's own first pass) | **~120 live.** `app.css:390-464` (~70 lines) is dead code, stripped by `applyAppearance`. |
| "483 `typeof …==='function'` guards" (W1-A) | **482** across 427 lines (regex-variant artifact; the finding is unchanged). Also **3,985** not 3,986 merged keys, and **19** not 32 stale `cure=2.5` overlays out of 32 `calc` overrides. |
| "Apple has given no signal of intent to ship Web Bluetooth" (W1-H) | **Strengthened, not refuted**: WebKit filed **`position: oppose`** (standards-positions #570, closed 2 Dec 2025) and Mozilla lists it "harmful". **Two of three engines are formally against.** Treat Safari/iOS support as *not coming*, not *not yet*. |
| "Anova is the best risk/reward integration in this whole survey" (W1-H) | **True technically, false contractually** — the ToU limits the API to personal, non-commercial use. |
| "Cost per AI action ≈ $0.0035" (W4-B) | **Measured at $0.0381** for Ask-the-Fire — **10.9×** — because 92 % is a per-request search fee no token counter can see. |
| "Photo analysis is an expensive feature, weight 3" (W4-B) | **Measured the cheapest feature** ($0.0014/call), weight 1. |
| "Nobody owns the software-first AI copilot" (`ai-strategy.md:77`) | **Overstated** — Time To Plate and Weber's free "Cook Plan" both exist. |

*Three claims W5-C developed and then disproved by testing, recorded so nobody re-raises them:* `build.py:348`
replacing every ASCII space with U+2028 (a **file-reader display artefact**; the escaping is correct);
French not surviving a reload (observed twice interactively, **disproved** with an instrumented clean context
over six set-then-reload cycles); and `addDays`/`daysBetween` broken for negative-UTC-offset timezones (the
round-trip cancels unless a DST transition falls *inside* the span). W5-D likewise recorded that `Grep`
renders `app.js:4214`'s URL with backslashes while `Read` shows forward slashes — **a display artifact, not a
bug**, verified before reporting.

### 4.J · What the pattern of false alarms teaches

Every single refutation in §4.A–§4.F shares one shape: **a grep, a quotation, or a single artifact was
trusted without tracing the runtime path.**

- §4.A.1 ran a real grep that really returned 0 and concluded absence — the reads were bracket notation two
  thousand lines away.
- §4.A.2 quoted a `typeof` guard that guards a **different function on the same line**.
- §4.A.3 missed an `if` on the line **directly above**.
- §4.A.4 described a conditional that is not there.
- §4.D.1 (and false alarm #3, and the **controller's own repetition of it**) diffed against one dictionary
  file while the runtime dict is two files merged at build.
- §4.E.1–2, §4.E.7–9 derived data claims without replicating the build pipeline.
- §4.F.1 searched for `evals/` and never opened `tests/`.
- §4.F.2 enumerated features from the UI layer instead of from the transport.
- §4.B.1 accepted a plan's own vocabulary ("three `:root` blocks") as a description of the shipped mechanism.

**The cheapest reliable defence found was not a better regex — it was running the thing.** The 14-property
refutation took one 30-line Playwright script against the already-built artifact and produced an unambiguous
14-chips-vs-0-chips answer no amount of grepping would have settled. Two skills were codified from this and
now live at `docs/process/skills/`: **`verify-against-the-runtime-path/SKILL.md`** (name the consumer, walk
backwards, measure at the consumer's input, prefer executing to reading, state the path in the finding) and
**`no-inert-shipment/SKILL.md`** (a value with no production reader is not done; a test asserting the value
rather than the effect is not a test — built around `_plcConflicts` (wired) vs `_planSafetyViolations`
(inert), the same function six lines apart).

---

## 5. Contradictions between documents, and orphaned specifications

### 5.1 Doc 1 T7 (`.occ-*`) vs Doc 2 (`.occ2-*`) — documented supersession

`2026-07-20-equipment-occupancy-layer.md` T7 specifies the occupancy view as a flat `%` bar with
`.occ-dev/.occ-bar/.occ-item/.occ-slots/.occ-warn`. `2026-07-21-occupancy-view-phase2.md` replaces every one
of those classes with device silhouettes. This is **documented** — the Phase-2 plan's own "Naming note"
(line 38) anticipates exactly the collision and the removal — and T10 was met to the letter: current state is
`grep -cE "occ-(bar|item|slots|warn|empty|unknown|hang|facts|dev|h)\b" app.js` → **0**; `.occ2-` in app.css →
**59**; the only surviving `.occ-` rules (`app.css:1635-1639`) are **exactly** T10's explicit "keep" list and
all five are still referenced. **The residual risk: a reader of Doc 1 alone would build dead code.**

### 5.2 Doc 3 T5 names `PROP_BOUNDS`; the shipped code uses a better mechanism

The plan prescribes `const PROP_BOUNDS={maxC:[40,600], …}` and calls it out **by name in its own
Self-Review**. `grep -rn "PROP_BOUNDS" .` (excluding node_modules) hits **only** the plan document
(`:624`, `:642`) and the sweep reports — **zero** in `app.js`, `dist/index.html`, `index.html`, `build.py` or
any test. The shipped mechanism (`app.js:6354-6363`) reuses per-prop `bounds`/`alt` via `propCoerce`
(`149`). Behaviour-equivalent, arguably better, **symbol absent — so the plan's own named-symbol self-check
fails against current code.**

### 5.3 Doc 6 T3: the specified mechanism was abandoned **and the regression test was rewritten to match**

The plan specified wrapping ~22 hardcoded Hebrew `toast()` literals in `L(he,en)`. Verified in three
independent legs: (1) the named sites are **still raw Hebrew literals** (`app.js:4740, 3468, 3537, 3566,
3641, 5306, 6098`) — while other, later toasts *are* `L()`-wrapped (`4556, 5069, 5209, …`), so the mechanism
exists and simply was not applied to Task 3's table; (2) the runtime path that saves it is `toast()`'s
`tr()` → `getDict()` → `I18N_DICTS.en` ← the **merged** dict; (3) **the test was rewritten.**
`tests/i18n-foundation.spec.ts:35` is now `test('Change 3: interpolated toasts render English in English
mode')` with the comment *"standalone toasts are already dict-covered; interpolated ones (e.g. restore-count)
can never be dict keys"*, and it drives `importData`, not `copyText`. **The plan's own Step-1 test
(`setLang('en'); copyText('hello')`) no longer exists.**

> **This is the most important process finding in the sweep: a test may not be narrowed to fit the
> implementation.** The DoD was met, the documented path was abandoned, and the regression coverage was
> quietly reduced to match. Nothing in the repo records that trade.

### 5.4 Doc 2 T2: shipped behaviour deliberately no longer implements the plan

`app.js:298` `FIT_HARD_FACTOR = 1.6`, then a rationale comment naming a real regression ("a 1320 cm² brisket
on a 1275 cm² shelf — a 3.5 % overhang — was reported as 'fits nowhere' AND raised a clash banner"), then
`:303` `FIT_SLOT_TOL = 1.10`. The shipped test at `:509` is
`hard = it.cm2 > cap.perSlotCm2 * (cap.areaMeasured ? FIT_SLOT_TOL : FIT_HARD_FACTOR)`. The plan's Step 3
prescribes only `FIT_HARD_FACTOR` and states *"When the user entered a real area, there is no slack (any
overflow is hard)"* — **behaviour the shipped code deliberately no longer implements.** Divergence real,
in-code rationale real, tests green. This is the **good** version of §5.3: the trade is recorded where a
maintainer will find it.

### 5.5 A live pipeline contradiction: "APPLIED" vs discarded

`gen_sources.py:91-98` prints *"MAKE calc changes are applied at build time via the sources.py merge
(build.calc), so they are DONE, not pending"* and then `"(N make calc overrides applied)"`.
`build.py:96-103` discards the key **and** writes to a nesting level the app never reads. **Two files in one
repository state opposite things about the same data**, and a build reports success while dropping its
payload. Consequence: §3.A.11 (18 salt values, `n-kabanos` 28 % low).

### 5.6 A corrective action closed against an unverified root cause

`build.py:96-102`'s comment justifies the skip: *"the auto-generated sources carried a stale numeric `'cure'`
(2.5) that clobbered the type and silently suppressed the dried-safety warning."* The described failure is
**real for the intended destination and impossible at the actual one** — merged into `build.calc`,
`app.js:1919` would render "Cure #2.5" and `1924`'s `calc.cure==='2'` dry-cure warning would go false, exactly
as described; but the merge writes to the **top level**, which nothing reads, so no user ever saw it. The
actual root cause is a **field-name collision between two schemas sharing the key `calc.cure` with different
meanings and units** — `2.5` is a *rate* in the researched JSON, `'1'|'2'` is a *type* in `build.calc` with
the rate in `cureRate`. **The collision is still live in `sources.py`** and will recur the moment anyone wires
`calc` through properly. Effectiveness was never validated: nobody checked that a dry-cured make still shows
the warning, nor that the researched values landed.

### 5.7 Comments in the code that assert things the code does not do

| Comment | Reality |
|---|---|
| `app.js:5709-5710` — safetyDiff violations are "recorded and **surfaced** rather than quietly shipped into a cook" | The surfacing half is not implemented; `_planSafetyViolations` has no production reader (§3.A.7) |
| `app.js:971-972` — `equipPlan` is the single point where equipment facts enter the plan | False: `_preheatRow`/`preheatMinutes` (`934-953`) also maps device type → the plan's scheduled light-up time and label, and is read at `5721-5722` |
| `app.js:7332` — `cwToggleSeasByKind` is "used by tests/legacy" | `grep -r cwToggleSeasByKind tests/` → **zero hits** |
| `worker/index.js:76` — metering is "best-effort… fine for a small dev cohort" | A reasonable trade **only if the failure is bounded**; it is not — loss is proportional to concurrency (§3.B.21), and §3.B.19 defeats the cap entirely |
| `build.py:96-102` — see §5.6 | |

### 5.8 Document-vs-decision and document-vs-document conflicts

1. **Offline-first copy vs the online-first decision** — four shipped instances (§3.G.1), one of them
   deliberately translated into English.
2. **`app.js:334` cited for the offline footer by two independent documents.** `app.js:334` is
   `deviceSilhouette()`. The string is at **`build.py:334`** and `dist/index.html:1916`. A fixer sent to the
   wrong file would find nothing and could conclude the finding was stale.
3. **Doc 1's "Known limitation" (plan line 1224)** still reads as open while `app.js:453`/`7832` show it
   resolved (commit `30634ac`) — a documentation-freshness gap, not a functional one.
4. **W4-B vs W4-A** on per-action cost (10.9×) and on photo-analysis weight (§3.H.5).
5. **W1-H vs W5-D** on Anova (§3.H.11) and on Apple's Web Bluetooth position (§4.I).
6. **`ai-strategy.md:77`** vs the measured competitive landscape (§3.H.9).
7. **`README.md`** still frames the app as "fully local-first (all user data in `localStorage`)" (`:4`).

### 5.9 Orphaned specifications — commitments made in a plan, never delivered, never withdrawn

| # | Commitment | Where deferred | State |
|---|---|---|---|
| 1 | "Warn when no grinder plate matches" — the recipe↔device join | Doc 3 line 24, explicitly pushed to "the consumption layer, which is blocked on this one" | **Two plans deep, still not delivered.** `choosePlate` exists (commit `bb789aa`), called from nowhere |
| 2 | The stuffer-nozzle equivalent | Doc 3 T5 Self-Review, same paragraph | Same status |
| 3 | Spec §3 "Slice A: preheat, fuel, refuel" | Doc 1 Self-Review, plan line 1220 | Follow-on plan not found among the six largest specs nor elsewhere in the sweep's search |
| 4 | Spec §5 C2 "probe channels monitoring" | Doc 1 Self-Review, plan line 1222 | `probeChannels()` exists as a sum; no live-monitoring or occupancy tie-in |
| 5 | `PREF_PRESETS` / `prefPreset()` + the preset selector | Doc 4 Global Constraints, plan line 21, moved to "Slice 2" | `grep -c "PREF_PRESETS\|prefPreset" app.js` → **0** |
| 6 | The 7 orchestrator knobs (`autonomy, shareTolC, woodSwap, holdEnabled, aiRank, slotModel, holdMaxH`) | Doc 4, plan line 199 — **by design**: *"registered now so Slice 2/3 only add their consumers… no consumer = no dead controls"* | `grep -c "pref('<k>')"` → **0** for every one. `grep -n "autopilot" app.js` → exactly one hit, the validator enum at `6814`. **Working as specified; recorded so no future auditor mistakes it for drift** |
| 7 | "Phase 3 (auto-optimize + live)" | Doc 5, plan line 532 | No autopilot logic anywhere |
| 8 | Full voice-assistant localization for fr/de/es (`vcBuildAskPrompt`, `vcAnsLang`/`vcLang`) | Doc 6 Task 5 follow-on note, plan line 346 | 2 % coverage, confirmed live — the deferral was never picked up |
| 9 | Cleanup of the dead `data-i18n=` markup | Doc 6 Task 5 follow-on note | **Confirmed outstanding** — 14 of 15 attributes are dead (§4.B.3) |
| 10 | Phase 3a hold-safety spine (`holdCapMin`, danger-zone accumulator, `safetyGate`) | status-and-gaps §A.2 | Unbuilt. Currently unreachable because nothing generates hold moves — **a prerequisite, not a live hazard** |

---

## 6. What no document covers — the surfaces only the running app revealed

This section exists because the roster's Axis 4 was created after a purely document-driven audit **missed
TTS, a real and substantial feature**. Everything below required a browser, an executed script, or a real
click; none of it is derivable from reading source.

**Required a fresh boot in a specific state**

1. **The `data-mt` attribute-name collision** (§3.F-i.3). Visible only on a *fresh English boot* with the
   language persisted **before** the first render — a live switch does not reproduce it the same way.
2. **The kosher chip reverting to Hebrew on the first tap** — required one real click on a chip that had just
   rendered correctly in English.
3. **The alarm banner being Hebrew-only** — required an actual timer to fire in English mode.
4. **`cwLbl` rendering `שלב 1/6`** while its siblings correctly read `Step 1: Basics`.

**Required pixels, not the DOM**

5. **The serving date clipping the year.** `scrollWidth === clientWidth`, so **no DOM-level overflow signal
   fires at all** — only an element screenshot shows `22/07/202`.
6. **Occupancy tile labels truncating to 2–3 characters**, with the full name surviving only in `title=`.
7. **The Projects header block wrapping raggedly across three rows** — with an overflow scan returning `[]`.
8. **Contrast ratios per theme** — computed from the *live* token sets, which is how cream turned out to be
   the worst of four rather than the audited-and-passed one.

**Required navigation or scroll state**

9. **Catalog auto-scrolling its own search box off-screen** (`scrollY 179`, `#q` top −72) while the visible
   copy says "search above".
10. **The Work Plan opening 2.1 screens above "now"** (`.wp-next` at y=1550, `scrollTop` forced to 0).
11. **The occupancy scrubber scrolling away with its own clock** (`position:static`, 16 px tall).

**Required a real interaction sequence**

12. **The serve-time divergence** — one real `input` event produced a banner reading 19:00 directly above an
    input reading 22:30, with the combined timeline 3.5 h wrong.
13. **The refuel checkbox collision** — required a real stick-burner plan in the DOM to see three rows at
    19:15/20:00/20:45 sharing one `data-wpck` key.
14. **The language switch wiping work-plan ticks** — required a real `setLang('en')` + re-render (2 → 0).
15. **The ⚡ card toggle not reaching the plan** — required a real click plus reading `itemProfile` and the
    rendered plan together.
16. **The copilot following the wrong event** — required two live sessions open at once.
17. **The multi-day Soppressata scheduled nine minutes before serve** — required rendering both views on the
    same event.
18. **The 14 device properties rendering as chips** — *the refutation itself* needed a browser.

**Required a trace or an executed script**

19. **62 % of wall-clock in long tasks in non-Hebrew mode.** W1-D predicted the mechanism from code and was
    right; only a trace produced 36–37 long tasks / ~5,000 ms per 8 s, reproduced twice, against **zero** in
    Hebrew.
20. **Cold CLS 0.29 vs Lighthouse's warm 0.053** — a 5.5× under-report, and the shift fires 3.4 s *after*
    first paint when the app's own JS rewrites the home screen.
21. **The document downloading three times on a first visit** — visible only by mapping every
    `ResourceSendRequest`→`ResourceFinish` pair by requestId.
22. **HTTP 200 + 2.27 MB for every unknown path** — visible only by fetching `/robots.txt` and an arbitrary
    path from the live page.
23. **`<main>` measuring 0×0**, and therefore the skip link going nowhere and `landmark-one-main` failing.
24. **Chrome's own console issue**: *"Blocked aria-hidden on an element because its descendant retained
    focus."* The browser diagnosed a defect no reader would have found.
25. **13 unlabelled form fields**, from Chrome's issue panel rather than markup inference.
26. **`serve.js`'s 1,146 restarts in 6 s** — required copying it into an empty directory and running it.
27. **`addDays()` losing a day** — required executing Node with `TZ=Asia/Jerusalem`; **`today()` vs
    `isoDate()`** required executing at a specific wall-clock hour.
28. **TTS silently billing the owner** — required intercepting the outbound fetch and observing
    `X-Access-Code` with no `x-goog-api-key`.
29. **The `streamGenerateContent` bypass** — required reading the router **against** the meter. Either file
    alone looks correct.
30. **The 18 discarded salt overrides** — required executing the real Python modules and diffing researched
    against shipped, not reading either.

**Not covered by any document, and still not settled**

31. **Screen-reader announcement behaviour as actually spoken** by NVDA/VoiceOver/TalkBack. The sweep measured
    the accessibility tree and live-region presence; nobody ran a real AT session.
32. **A rendered measurement of the `occ2` diagram's ARIA.** The bundle-level result (10 builders, 0 ARIA) is
    solid; getting the widget on screen inside a session budget was not achieved.
33. **Real-device performance.** Everything is emulated at 4× CPU throttling; no physical mid-range Android
    was used.
34. **Whether the app is *usable* by a cook with greasy hands at a fire.** Every touch target was measured;
    no user has been observed.

---

## 7. Recommended closing order, with reasoning

The ordering principle: **bound the harm, then bound the cost, then bound the drift, then build the thing the
owner remembers.** Steps 0–2 are days; each later step assumes the previous one shipped.

---

### Step 0 — Stage 0: the bleeding (≈1 week)

**Do all five together; they share one deploy and they gate everything downstream.**

| Item | Why now |
|---|---|
| **Guard `vcAskAI` (§3.A.1) and `vcTranslateToEn` (§3.A.2)** | These are the only paths where a wrong safety number is **spoken** to a cook whose hands are busy, with no visible caveat to catch it later, from a web-grounded model. The guards already exist (`askRefuse` 4197, `aiSafetyNote` 4315-4326, `mtGuard`/`mtSafe` 6951-6958) — this is wiring, not invention. A2's guard is the *same file*, ~1,700 lines away. |
| **Make `google_search` conditional (§3.E.2)** | One change, two bands: cuts blended COGS $1.22 → $0.39 (68 % of the entire cost gap) **and** closes hallucination surface #3. Nothing else in this document has that ratio. |
| **Fix `aiSafetyNums`'s unit-blindness (§3.A.3)** | 74 °F passing as grounded against 74 °C means the **strong** refusal never fires on the exact confusion most likely to kill someone. This regex is the single place the app's stated contract "never invents safety numbers" is enforced. |
| **Worker: fail **closed**, drop `streamGenerateContent` from the router until metering handles it, add a per-code rate limit, debit **before** forwarding (§3.B.19–22, §3.H.3)** | The cap is the entire abuse model and it is defeated by a one-word URL edit, by a corrupted record that never self-heals, and by concurrency. $126/hour on one leaked code. |
| **Route TTS through the managed path (§3.E.7, §3.E.8)** | Two bugs, one fix: managed users currently get the *weaker* voice while the owner is silently billed for the better one. |

**Do not defer any of these behind the model migration.** They are independent.

---

### Step 1 — Migrate off `gemini-2.5-flash` (§3.E.1)

**Hard external deadline: 16 October 2026.** Every AI feature routes through one constant (`app.js:4206`),
so the change is small — but the *validation* is not, and the app has **no CI** (§3.E.3). Ship the migration
with the eval harness that already exists (`tests/ai-trust.spec.ts`) wired into an actual CI job, plus the
missing grounding assertions (§3.E.4). Reasoning: this is the only gap in the document with a date attached
by a third party, and doing it before Step 2 means the safety gates are built and tested against the model
that will still be running.

---

### Step 2 — The two named safety commitments (§3.A.5)

Refuse to schedule poultry/charcuterie without a registered thermometer; make the cure task **BLOCK** without
a 0.1 g scale. Reasoning: they are **small, named, long-outstanding, and the only remaining items with a
direct health consequence**. They also convert the app's one uncopyable marketing claim — "guards your cure"
— from a claim the code does not earn into product (§3.H.10b). The mechanism to copy is already in the
codebase: `cureScaleGuardHTML`'s thresholds are correct (`hardMax=5*d`), it is only the *effect* that is
missing.

---

### Step 3 — Make monitoring into control

- **Surface `safetyDiff` violations** (§3.A.7). `_plcConflicts` already shows the way — same function, six
  lines apart, one wired and one not. This is also the **precondition for any AI proposer**: an invariant
  nobody sees cannot gate anything.
- **Record the `bcheck` reading**, not just the tick (§3.A.6). The checkbox and its persistence already exist
  (`5766`, `5940`); what is missing is a numeric field and a corrective-action path.

Reasoning: these two convert the HACCP shape the app already has (hazard → limit → monitor) into the two
links it lacks (verify → correct), and they are the cheapest such conversion available.

---

### Step 4 — Dates and alarms (§3.A.8, §3.A.9, §3.B.18)

One `dayKey()` producing the local calendar day, one `parseDay()` consuming it, `addDays` arithmetic in UTC
or on integer parts, and a lint ban on bare `new Date('YYYY-MM-DD')`. Wrap the alarm banner, its `aria-label`,
the default timer name and the SW notification in `L()`.

Reasoning: a cure reminder firing **one day early** and a "the meat is done" alarm that a non-Hebrew user
cannot read are both safety-adjacent, both reproduced by execution, and both small. They sit here rather than
in Step 0 only because Step 0's items are unbounded-harm and these are bounded.

---

### Step 5 — Three assertions, one per boundary (the preventive action)

This is the **highest-leverage structural item in the entire document**, and it is three assertions, not a
refactor:

1. **`build.py` fails the build** if any override `gen_sources.py` reports as APPLIED is absent from the
   emitted payload — then fix the 18 salt values and the `calc.cure` schema collision, and resolve Kabanos
   (§3.A.10, §3.A.11, §5.5, §5.6).
2. **A Playwright assertion** that no rendered leaf node matches `/[֐-׿]/` while `getLang() !== 'he'`
   (§3.F-i.2). *This is the only thing that stops leak #368.*
3. **The Worker debits a per-code budget before forwarding**, so metering cannot depend on the shape of a
   response the caller chose (already covered in Step 0; restated here because it is the same principle).

Reasoning: findings §3.B.19, §3.A.11, §3.A.8, §3.A.9 and §3.B.18 are **the same nonconformance in five
costumes** — a value is computed in one place and consumed in another and nothing asserts the two agree. The
same shape appears in `app.js` (482 `typeof` guards), in the Python pipeline, and in the Worker. Point fixes
leave the mechanism intact; each assertion converts a silent divergence into a loud failure, which is what
none of the five defects had.

---

### Step 6 — Wire what already exists (cheap, high visible value)

`choosePlate`/`chooseNozzle` into the work-plan steps (§3.D.1) · `equipPlan` into the multi-event view
(§3.C.3) · the fuel line onto the smoke task (§3.D.10) · collapse the two area fields (§3.D.3) · either feed
the 14 captured properties into the engine or **stop asking the user to type them** (§3.D.2).

Reasoning: this closes the "registered kit is ignored" complaint at its root, and every piece is already
built, correct and in some cases already unit-tested. It is also the band where the project's characteristic
failure mode — **inert shipment** — is concentrated, so closing it validates the new `no-inert-shipment`
skill on real work.

---

### Step 7 — One capacity rule, one resource timeline

Collapse the three capacity rules into one (§3.B-i.1), give every physical device **one resource timeline
across all events**, and make the cross-event view run the same five-stage pipeline as the single-event view
(§3.C.3, §3.B-i.3, §3.B-i.5, §3.B-i.6). Fix the serve-time triple-source problem (§3.B-i.2) by scoping
`mk-tlserve` per event.

Reasoning: **~90 % deterministic, no AI needed**, and it collapses seven separate "two views disagree"
defects into one model. It is also the precondition for the orchestrator: a solver cannot propose moves
across events when the two views cannot agree what a clash is.

---

### Step 8 — Guest-count-scaled occupancy demand (§3.D.5)

Owner-raised, derivable from existing data (`rawGramsFor` + the catalog reference weight; per-piece × count
for sausages). Reasoning: it makes **every capacity claim in the app honest at real party sizes**, and the
capacity scheduler is the one differentiator the competitive survey found genuinely uncontested — shipping it
with a static footprint undercuts the only defensible moat.

---

### Step 9 — i18n: gate first, then the leaks

Put a coverage threshold on the language picker (`app.js:6878`) or a `__meta__.ready` flag emitted by
`build.py` (§3.F-i.1) — that single change makes the existing build-time coverage print **actionable instead
of decorative** and removes a 92 %-Hebrew French wizard from the product today. Then the English-mode leaks in
priority order: `data-mt` collision (§3.F-i.3), the two toast labels and `cwLbl` (§3.F-i.2), the catalog
metric line and kosher chip.

Reasoning: the machinery works (English is 0 % Hebrew across all five screens). This is a gate problem, not a
translation problem, and the gate is one condition.

---

### Step 10 — Performance and accessibility, in measured-impact order

1. **Scope the MutationObserver** (§3.F-ii.8) — 62 % of wall-clock is the largest measured non-functional win
   available, it lands squarely on the app's core use case (a timer running for hours), and it is
   language-conditional today only by accident.
2. **Fix `<main>`/the skip link** (§3.F-iii.13) — one structural change that also clears `landmark-one-main`.
3. **Accent contrast on the cream theme** (§3.F-iii.12) — 5 AA failures on the *default* theme, worst 1.77:1.
4. **Touch targets on the time-critical screens** (§3.F-iii.15) — the 13 px safety checkbox and the 16 px
   scrubber first; the bottom nav already passes.
5. **The serve-date field** (§3.F-v.27) — the highest-consequence single field in the app.
6. **Pre-mount live regions**, add ARIA and list semantics to `occ2` and the timeline (§3.F-iii.14, .16).
7. **`sw.js` SHELL dedupe** (§3.B.27) — 62 % of a first visit's bytes, one line.
8. **A real 404** (§3.B.28) — clears both SEO audits and stops paying 645 KB per crawler probe.
9. Fonts, minification, CLS (§3.F-ii.6, .9, .10) — real but lower ratio than the above.

---

### Step 11 — Then the orchestrator

**Only now.** Build the Phase 3a solver with the hold-safety spine (`holdCapMin`, danger-zone accumulator,
`safetyGate`) as its precondition, and AI as a **proposer, never an executor**, gated by `safetyDiff` —
which by this point is surfaced (Step 3) and sits on top of one capacity rule (Step 7).

Two non-negotiable design constraints, both established by evidence:

- **The move vocabulary must structurally exclude `hours`, `temp` and `safe` as targets** — schema-level
  exclusion first, `safetyDiff` as the second, defence-in-depth layer. This mirrors the two-layer pattern
  already proven for catalog-key grounding ("don't invent" in the prompt + `aiValidateKeys` dropping any that
  got invented anyway).
- **The confirm-before-apply contract must be *established*, not inherited** — because §4.F.6 showed
  `aiConfirmPanel` covers only 2 of the AI-writes-state features. The weaker true statement ("nothing
  auto-applies") is what the orchestrator argument actually needs, and it must be made explicit.

Moves should be evaluated **as a batch against `schedulePlacements` before commit**, never applied one by one
— the placement pass is already "the first code in the app where one item's time depends on another's"
(`3056`), and a proposer issuing moves serially would re-introduce exactly the over-subscription it was built
to solve.

---

### Step 12 — Probes: log-import first, live BLE last

1. **Log-import (all platforms, ship first).** Accept a pasted/uploaded CSV — ThermoWorks, Weber Connect,
   Govee and Inkbird all export it natively — and render a post-cook temperature graph against the plan's
   `safe` target and `bcheck` stages. Zero new permissions, zero Bluetooth, identical on iOS and Android.
2. **Anova cloud API — reclassify to self-host/hobbyist only** (§3.H.11). Technically the best integration
   found; contractually limited to personal, non-commercial use. Do not build a shipped product feature on it.
3. **MEATER Cloud REST — live-only, and only while the user's app or Block is actively bridging.** It is
   **not** a retrospective import path (§4.H.6).
4. **Web Bluetooth — an Android/desktop-Chrome bonus, explicitly scoped "phone propped up, screen on".**
   Combustion Inc's open MIT GATT spec is the one vendor where building from official docs is realistic.
   `copilotLogProbe(tempC)` (`app.js:5381`) is a drop-in for any source; `copilotPace` (`5395-5416`) is a
   pure function of `session.probes` and needs **zero** changes to the pace math.

**Name the blockers up front:** iOS has no Web Bluetooth and two of three engines have formally filed against
it; even on Android a backgrounded or screen-off tab cannot hold a GATT connection for a 12-hour cook
(`[Exposed=Window]`, no worker path, Chrome freezes background pages); and vendor CORS behaviour is
undocumented, so assume a thin proxy.

---

### Step 13 — Revisit monetization in ~2 quarters (§3.H.12)

**Not now.** The problem is unbounded *cost*, not missing revenue, and Step 0 captures 68 % of it in days
against weeks-to-months for accounts + metering + billing. Preconditions to revisit: Step 0 shipped, some
analytics existing (there are none today, so every allowance is a guess — and the 10.9× miss in §3.H.5 shows
what a guess costs), the English product finished (the real revenue needs it; Israel's Year-3 midpoint is
~$38k/yr, below one developer salary), and the two safety gates from Step 2 shipped — because **selling an
unguarded spoken safety number is a materially different liability from giving one away.**

When it does happen: two tiers, not three; **deterministic ⇒ free forever, probabilistic ⇒ metered**; grounded
web search as the paid capability; `mk-uilevel` never a price axis.

---

## 8. Confidence, and what the sweep could not settle

### 8.1 Confidence by band

| Band | Confidence | Why |
|---|---|---|
| Citation coverage & data integrity | **Very high** | Replicated the build pipeline twice, independently, including the `NEW_SAUSAGES` merge order that produced a false alarm in the first pass |
| Code structure, dead code, worker security | **High** | Every claim re-opened at the cited line; absence claims re-tested against bracket notation, dynamic `window[fn]` dispatch, the i18n dictionary walk and the build-time merge |
| Spec↔code conformance | **High** | 57 confirmations; the four refutations all ran in the *conservative* direction (the report under-claimed) |
| Running-app defects | **High** | Two independent Playwright runs on separate ports against the same artifact; every one of 20 cited line numbers exact; three claims struck |
| Measured non-functional numbers | **High** | Traces, axe-core, and DOM measurement on **live production**; the MutationObserver cost reproduced twice within 1.5 % |
| Food-science claims | **Medium-high** | Values, categories and citation URLs verified in-repo; 9 CFR and PMC6043430 re-fetched live; **the FSIS chart itself returns HTTP 403** and could not be re-read (§8.2) |
| AI guard coverage | **High** | Guard coverage re-derived by grepping every `gemFetch(` caller rather than trusting the feature inventory — which is how the 14th entry point was found |
| Probe/telemetry feasibility | **Medium** | Research, not audit. 28 of 40 claims confirmed against primary vendor material; **8 refuted, 4 unverifiable** — the highest error rate of any axis |
| Business & unit economics | **Medium** | COGS measured against live pricing pages; **market sizing is inherently an estimate**, and the report says so — it rejected its own bottom-up figure as 2.2× the entire global paid category |

### 8.2 What the sweep could not settle

1. **The USDA FSIS safe-minimum-internal-temperature chart itself.** Both `fsis.usda.gov` and the
   `foodsafety.gov` mirror return **HTTP 403**. The 63/71/74 °C values and the whole-muscle-vs-ground
   distinction were verified *inside the repo* — values, categories, and the citation URLs that point at the
   chart — and 9 CFR 424.21/424.22 plus PMC6043430 were fetched successfully. **The chart's own text was not
   re-read in this session.**
2. **Whether the 29 `saved` mismatches (§3.B.29) are a defect or hand-tuned figures.** The check the original
   report ran was the wrong comparison; the right one produces 29 outliers. Whether that is drift or
   deliberate is a **product question the sweep cannot answer.**
3. **Whether the `2 h` low end of Kebab's `svh="2-3"` is adequate.** The citation's `≥2h` clause is met, but
   the *same* citation gives 20 mm @ 55 °C = 2.5 h and 25 mm = 2.75 h, and cut 17's own note calls a 1 kg
   kebab log "thick". **Worth a look; not a fabrication.**
4. **Whether a 65 °C floor is defensible for foie gras, sweetbreads and veal brain** (§3.A.14). No primary
   source was found either confirming or contradicting it. The finding is about **citation quality against
   the project's own stated standard**, not about safety.
5. **Screen-reader behaviour as actually spoken.** The accessibility tree and live-region presence were
   measured; no NVDA/VoiceOver/TalkBack session was run.
6. **A rendered ARIA measurement of the `occ2` occupancy diagram.** The bundle-level result (10 builders,
   0 `aria-*`, 0 `role=`) is solid; the widget could not be got on screen inside a session budget.
7. **Real-device performance.** Everything is 4×-CPU emulation. No physical mid-range Android was used.
8. **Bidi mis-rendering as a *visual* defect.** One concrete mixed-direction string was captured in a live
   LTR document (`📋 התפריט · 8 guests · ~2.2 kg בשר`), but the per-character measurement that disproved the
   original scrambling claim (§4.C, dropped-claims #1/#2) was not repeated across the app.
9. **Whether account-level Cloudflare WAF or rate-limiting rules exist.** That is dashboard state, not repo
   state. **The in-repo half is reported (`worker/wrangler.toml` has only the `CODES` KV binding, no
   rate-limit binding); the rest is dropped.**
10. **CORS behaviour of the Anova and MEATER cloud APIs.** Neither vendor documents
    `Access-Control-Allow-Origin`; settling it requires a live cross-origin request with real credentials.
    **Assume a proxy is needed until verified.**
11. **The causal claim that low internal structure caused higher defect density** in `wire` and
    `Live Cook Copilot` (§4.A). Both premises are true; the inference is not settleable from this repo.
    **No plan should be built on it.**
12. **Live-model behavioural drift** — Hebrew-in-English script leakage and similar. This class genuinely
    needs periodic *live* model runs, not mocks; the sweep ran none.
13. **Whether the app is usable by a cook with greasy hands at a fire.** Every touch target was measured.
    No user has been observed. **This is the largest unmeasured surface in the product.**

### 8.3 A standing note for whoever audits this next

Three false alarms preceded this sweep. Forty-two more findings were refuted inside it, **including one the
sweep controller personally propagated after believing he had independently verified it.** The failure mode
is not carelessness — every one of those reports cited real line numbers and ran real commands. The failure
mode is **stopping at the first artifact.**

Before you report an absence: name the consumer, walk backwards to it, measure at the consumer's own input,
prefer executing to reading, and state the path you traced inside the finding itself. The two skills at
`docs/process/skills/verify-against-the-runtime-path/` and `docs/process/skills/no-inert-shipment/` exist
because of the evidence in §4. Use them.
