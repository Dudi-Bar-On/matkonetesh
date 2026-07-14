# AI Strategy — audit, refactor, new features & monetization

Synthesis of a 3-lens analyst panel (implementation auditor · product/monetization strategist · AI-trust & food-safety specialist), all grounded in the current codebase. Goal: make the AI a **pro, market-#1, loved-and-paid-for** layer.

---

## TL;DR — the one-line strategy

> Be the AI pitmaster that **stands watch over your cook and guards your cure** — *free & offline* for the vetted data, *paid & turnkey* for the confidence — and own it in **Hebrew first** before anyone notices the category exists.

Three moves get us there, in order:
1. **Make the AI provably safe & trustworthy** (prerequisite to charging for it, and the moat).
2. **Ship the Live Cook Copilot** (the flagship people pay for; ~70% of the plumbing already exists).
3. **Add a Managed-AI paid tier** (the switch that turns a beloved free app into a business).

---

## What's already strong (the moat — keep & build on)

The AI layer is **above the median for a single-file PWA**. Real shared infra already exists and a principled contract is followed: *optional · grounded-only · never invents safety numbers · output→action · local-first fallback*.

- **`gemFetch`** transport: timeout, exponential backoff, retries only transient statuses, key in header, and a deliberate **endpoint-indirection seam** (`GEM_HOST`/`GEM_URL`) already built as the monetization-proxy hook.
- **`aiJSON`** + `aiValidateKeys/Items`: a shared JSON caller that forbids inventing keys/safety numbers and **drops any catalog key the model invents** (validated against `cwAllItems()`). This is the single best thing in the codebase.
- **Safety-number discipline**: recipe generator takes creative prose from AI but **salt/cure/nitrite numbers come from app presets** (`UMAKE_CALC`), never the model. The DATA-translation path has a numeric guard (`mtNumSig`/`mtSafe`) that rejects any translation altering a number.
- **Local-first degradation**: `wcimLocal`, `pantryAdvisorLocal`, `askFire` compute deterministically first; AI only enriches. No key ⇒ full functionality.
- **Source-cited data**: `CUT_SOURCES` → Baldwin's pasteurization tables, USDA/FSIS, AmazingRibs, each with a `verified` date; `sourcesBlock` renders them with an explicit `UNVERIFIED` state. **ChatGPT structurally cannot match this.**

The existing AI surface is already broad (11 features): Ask-the-Fire, voice Q&A + TTS, recipe generator, diagnose-a-cook, journal insights, seasoning-suggest, "what can I make", pairing/scheduling advisor, event planner, the AI hub, and AI translation.

---

## PART A — Trust & food-safety (do this FIRST; it's the liability line AND the moat)

**The exposure is narrow but real:** the two **free-prose** flows — Ask-the-Fire and Diagnose — are where the LLM can *speak* a wrong number, and **Diagnose has no safety flag at all**.

- **Ask-the-Fire** runs at temperature 0.8 with live web search and only *asks* the model not to invent numbers. Grounding is attached **only when a catalog entity is fuzzy-matched** — so *"how much Cure #1 for 2 kg salami?"* or *"what temp kills botulism?"* matches nothing → **zero grounding → free-generated nitrite dose**. The only guard is `aiSafetyCaveat`, a regex that *flags* (doesn't correct) and misses bare Fahrenheit, salt `%`, pH, and water-activity.
- **Diagnose** renders `diagnosis/causes/fixes` as free strings with **no numeric guard and no caveat** — and its own example chips include "white mold on the salami" and "stalled at 68°". A wrong "wash the mold and keep drying" or invented hold-temp ships unflagged.
- The four **structured** features (recipe-gen, scheduling advisor, what-can-I-make, event planner, seasoning) are well-contained (key-validated, numbers app-owned) — the model of how to do it right.

**Trust architecture (the principle):** *The app's calculators & vetted DATA own every number. The LLM may only retrieve, select-from, and explain them — it may never state a safety number of its own.*

| Priority | Fix | Reuse |
|---|---|---|
| 🔴 **H** | Add a safety caveat/guard to **Diagnose & Journal** renderers (currently unflagged) | `aiSafetyCaveat` |
| 🔴 **H** | **Numeric-invariant guard on AI answers** — any safety number not in the injected vetted context is redacted → "see the calculator", not just flagged | `mtNumSig` |
| 🔴 **H** | **Always-on safety grounding by intent** (cure/nitrite/temp/botulism/pasteurization) — not only on entity match | `askContextFor` |
| 🔴 **H** | **Deterministic refuse/deflect** classifier for known-dangerous intents (no-nitrite shelf-stable cure, under-pasteurized poultry SV, uncontrolled ferment) → canned sourced cards | new |
| 🟡 M | Extend the safety regex (°F, salt %, pH, aw); standardize a **two-tier badge** everywhere: ✓ *Verified app data (cited)* vs ✨ *AI — verify* | — |
| 🟡 M | Bind **citations** to AI safety answers; add `confidence`/`needs_calculator` to schemas → low-confidence deep-links to `openCalc` | `sourcesBlock` |
| 🟢 L | Track **fermentation pH & water-activity** for dry-cure (the real botulism hurdles, not yet modelled); add an adversarial **safety self-test** to the suite | — |

**Why this is a moat, not a chore:** "the app **caught a dangerous idea**" is the killer demo — when it *refuses* "can I skip the pink salt in my dry salami?" and explains why with a citation, that's the story users tell other users. "AI explains, calculators decide · verified against USDA & Baldwin · it will never guess a number that could make you sick" is a sentence no general chatbot can honestly print.

---

## PART B — Existing-AI refactor (raises quality across every feature at once)

Two parallel infra tiers exist: JSON features route through the excellent `aiJSON`, but **5 free-text callers hand-roll** body/fetch/extract/empty-check (candidate-extraction copy-pasted 5×). And **one model, thinking OFF** everywhere (`gemini-2.5-flash`, `thinkingBudget:0`) — reasoning is disabled even for Diagnosis and Event-planning, the two features that need it most.

**Shared-infra refactor (each is small, localized, high-leverage):**

| ID | Change | Payoff |
|---|---|---|
| A1 | **`gemText()`** — one free-text caller (sibling of `aiJSON`); refactor the 5 hand-rolled callers onto it | kills 5× duplication |
| A2 | **Model router** — optional `tier`/`thinking` param; route Diagnosis & Event-planning to `gemini-2.5-pro`/thinking-on, keep quick Q&A on flash | **biggest quality lever**, and the natural free/paid line |
| A3 | **`responseSchema`** in JSON mode (typed) instead of prose-hint + fence-stripping | near-eliminates bad-JSON failures |
| A4 | **Output-language** param in the grounded-prompt builder | fixes the **Hebrew-in-English-UI leak** across all features at once |
| A5 | **Response cache + in-flight abort** (per-panel `AbortController`) | instant reopen, and fixes the **panel-reopen-after-close bug** + adds cancel |
| A6 | **One caveat/citation layer** applied to *any* answer with safety numbers (voice + diagnosis included) | enforces the trust contract in one place |

**Quick wins already worth doing:** the **English-output gap** (AI answers come back Hebrew in the English UI — a direct hit to the "English 100%" promise) is A4; streaming Ask-the-Fire; caching wcim/padv/insights; making journal-insight suggestions tappable (deep-link like wcim does).

---

## PART C — Killer new AI features (prioritized)

The market splits into hardware-tethered apps (MEATER, Traeger) and content subscriptions (AmazingRibs $34.95/yr) and single-trick cure calculators. **Nobody owns the software-first AI copilot** spanning BBQ + smoking + sous-vide + grilling + charcuterie, grounded in cited data, offline, helping *during* the cook. That gap is exactly where this app sits. Every feature below converts a **unique asset** (cited data · offline · gear/level awareness · journal · multi-event engine · persistent timers) into something payable.

### Tier 0 — the flagship
- **🏆 Live Cook Copilot** — a session that runs *during* the cook: anchored to your stall/temp data, drives the persistent timers, and at hour 7 answers the only question that matters — **"what do I do right now?"** Detects the stall, tells you whether/when to wrap, and given a probe reading says "you're 90 min behind — here's the fix." *Why it wins:* an $80 brisket + 12h + guests + no second chance → the dominant emotion is **fear of ruining it**, and insurance against disaster is the most payable feeling in the niche. **~70% of the plumbing exists** (timers, `is-cooking`, stall data, journal, `aiConfirmPanel`). Complexity **L**.

### Tier 1 — high love + high willingness-to-pay
- **📸 Photo analyzer** — bark/smoke-ring/doneness read, or a charcuterie slice/mold/case-hardening read, always "looks done — **confirm with a probe**". Multimodal, ties to the journal photos. **M**
- **🧫 Charcuterie Safety Guardian** — AI that *checks not invents*: "your salami's lost 28% — below the ~35% minimum; keep drying." Deepest moat; scariest domain; essentially uncontested in Hebrew. **M**
- **⏱️ Adaptive schedule agent** — "dinner moved to 14:00" → recomputes the whole backward plan across the multi-event timeline + resolves smoker clashes (you already have clash detection). **M**
- **📈 Probe-curve interpreter + ETA** — import a MEATER/Combustion/Inkbird CSV, fit the curve, predict finish ± band. Rides their hardware without competing. **M–L**
- **🎓 Personal Coach** — longitudinal journal intelligence: "your 5★ briskets all rested >45 min and wrapped ~70°C; your 3★ wrapped early." The "app knows me / makes me better" retention driver; pure switching-cost moat. **M**

### Tier 2 — strong delighters, lighter build
Cookout Orchestrator (choreograph the whole day on 1 smoker + 1 grill) · Conversational menu designer · Wood/charcoal/rub advisor (on the cited seasoning corpus) · Shopping & butcher-translator intelligence · **AI onboarding concierge** ("I've got a Weber + a sous-vide stick + a MEATER" → configures gear + level; first-run magic, **S**) · Hands-free live voice copilot.

---

## PART D — Monetization / going business

**The central decision — BYOK vs Managed AI.** Today AI needs the user's own Gemini key: great privacy, but a **hard ceiling** — 95% of serious hobbyists won't create and paste an API key. **Recommendation: keep BYOK free forever, add a Managed ("turnkey") AI tier as the paid product.** Resolve the offline-first principle honestly: the app stays fully functional offline (data, calculators, timers, multi-event, journal, BYOK-AI all work with no network); Managed AI is an **opt-in online convenience** — a thin stateless proxy (a Cloudflare Worker fits the existing deploy) that injects our key, meters usage, and enforces the same grounding/validation. "Managed AI goes through our server; BYOK/offline stays private on your device" — that transparency is itself a trust asset.

| Tier | Contents | Price |
|---|---|---|
| **Free** — win the category on love | Full source-cited catalog, all calculators, timers, multi-event, journal, adaptive home, glossary/sources — **+ BYOK AI (all AI features free with your own key)** | ₪0 |
| **Pit Pass** (subscription) | **Managed AI** (no key) · Live Copilot + voice · Photo analysis · Charcuterie Guardian · Personal Coach · **cloud sync/backup** (journal+projects, currently local-only) | ~**₪199–249/yr** (~$49–59; anchor just above AmazingRibs' $34.95) |
| **Pro Tools** (one-time) | Offline/compute-free power features: advanced multi-event orchestration UI, full charcuterie calculator suite, pro export/print, extra themes — for the sub-averse | ~$29–39 |

**Willingness-to-pay, ranked:** (1) turnkey AI without the key hassle · (2) rescue-my-cook confidence · (3) food-safety trust · (4) don't-lose-my-history (cloud sync) · (5) get-better-over-time (coach). **Annual is the hero price** (BBQ is seasonal). **B2B later:** Instructor Mode (class teachers, per-seat), Catering Mode (scale to 100+ covers), **white-label/OEM** (license the copilot+cited-data brain to grill/probe brands — the biggest long-term lever), ethical affiliate (cuts/wood/rubs/cure-salts/probes, kept clearly separate from the safety layer), giftable annual passes.

---

## Recommended sequencing (my synthesis)

1. **Wave 1 — Trust + infra foundation** (Part A H-items + Part B A1/A2/A4/A5/A6). Small, localized, reuses patterns already written (`mtNumSig`, `aiSafetyCaveat`, `sourcesBlock`). This is the liability line *and* the moat *and* the free/paid model line — do it before anything else, and before charging. Also closes the English-output i18n leak.
2. **Wave 2 — Flagship: Live Cook Copilot** (+ probe/ETA + adaptive schedule + voice). The emotional heart and the paid anchor; most infra exists.
3. **Wave 3 — Delight & retention**: Photo analyzer, Personal Coach, Charcuterie Guardian, onboarding concierge.
4. **Wave 4 — Business**: Managed-AI proxy tier + cloud sync + tiering + paywall; then B2B/OEM.

**Path to #1 (highest-leverage):** ship the Copilot · add Managed AI · own charcuterie safety · win Hebrew-first then flip the bilingual switch to expand · build the journal→coach→community flywheel.

---

*Panel sources — competitive: MEATER, Traeger WiFIRE, AmazingRibs Pitmaster Club ($34.95/yr), DeliApp/Curesmith cure calculators. Codebase grounding cited inline throughout (functions/lines current as of this analysis).*
