# Wave 5 + Wave 4 — agent returns (verbatim)

Captured from the workflow journal.


## ?

Report at `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W5-D-api-docs.md`.

**🔴 #1 finding — the app's text model has a shutdown date.** `gemini-2.5-flash` (`app.js:4206`) is listed on Google's official deprecations table: release June 17 2025, **shutdown October 16 2026**, replacement `gemini-3.6-flash`. ~3 months out; every AI feature routes through that one constant. Verified in two independent fetches. The models page still shows it as available and unlabelled — only the deprecations page reveals it.

**Web Bluetooth — prior conclusion CONFIRMED, evidence upgraded and one fact strengthened.** Spec is a "Draft Community Group Report, 3 June 2026" (never W3C REC track). W1-H said Apple "has given no signal of intent"; actually **WebKit filed `position: oppose` (standards-positions #570, closed 2 Dec 2025)** and Mozilla lists it "harmful" — two of three engines are formally against. caniuse: 76.78%, no Safari/iOS at any version, no Firefox. Backgrounding: the IDL is `[Exposed=Window]` (no worker/SW) and Chrome freezes background pages, suspending timers and fetch callbacks. I could **not** read spec §5.2.2, so I make no claim the spec mandates disconnect — the two verified facts suffice.

**Gemini TTS — preview-only, not deprecated.** `gemini-2.5-flash-preview-tts` still listed, no shutdown date, successor `gemini-3.1-flash-tts-preview`. The app's `generateContent` transport is **not** deprecated ("remains fully supported", no sunset) despite the new Interactions API. All 6 voice names in `app.js:5003` are valid; PCM 24kHz/mono/16-bit decode matches exactly. Pricing $0.50/1M text in, $10.00/1M audio out. Two gaps I refused to fill: audio tokens-per-second isn't documented anywhere (so no $/minute figure is derivable), and Google's pricing vs rate-limits pages **contradict each other** on free-tier TTS — the "3 RPM/15 RPD" figure is blog-only, so I dropped it.

**🔴 Anova is licence-blocked.** An official API does exist (portal + published BLE GATT UUIDs, announced 29 Jul 2025) — but the ToU (eff. 21 May 2025) limits it to **"personal, non-commercial purposes"**, bars key-sharing and redistribution, and caps liability at $100. W1-H called it "the best risk/reward integration in this whole survey" — true technically, false contractually. Reclassify to self-host/hobbyist only. MEATER: official but **BETA**, `/login` takes **email + password** (no OAuth), 2 req/60s recommended, read-only, explicitly unsupported by MEATER.

**Hebrew-TTS verdict: keep the two-tier design, fix the routing.** Gemini is the only path with a *documented* Hebrew guarantee (`he` in the supported-languages table, auto-detected — no `languageCode` param exists). `speechSynthesis` is Baseline-available but **no spec or vendor doc guarantees a Hebrew voice on any device**; I dropped the iOS-Carmit/Android/Windows claims entirely as unverifiable from primary sources. The app's fallback structure is already correct (`app.js:4990-4999` returns null cleanly).

**🔴 But there's a real product defect:** `gemSpeak` requires a BYOK key (`app.js:5026`) and `vcSpeak` only calls it `if(gemKey())` (`app.js:5061`) — so **managed-AI users never reach the guaranteed-Hebrew voice**, even though the Worker's allow-list (`worker/index.js:43`) already matches `...preview-tts:generateContent` and would forward it. Users on the app's default online path get the weaker voice; that's backwards.

One near-miss recorded to prevent a fourth false alarm: `Grep` renders `app.js:4214` with backslashes in the URL. `Read` shows correct forward slashes — display artifact, not a bug. I verified before reporting.

## ?

Nothing tracked was modified — three new files only.

**DIAGRAMS** → `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W5-E-diagrams.md` (4 mermaid diagrams, every node carrying `file:line`; all four validated for parse hazards and class/node resolution):

- **(a) System architecture** — 9 Python authoring modules → `build.py` (one build step) → byte-identical `index.html` + `dist/index.html` (2,701,065 bytes each, measured) + content-hashed `sw.js`; runtime = single-file PWA, `localStorage`, one outbound fetch site (`app.js:4223` in `gemFetch`), Cloudflare Pages + Worker-held key → Gemini, with BYOK fallback.
- **(b) Plan pipeline** — `itemStages:3213 → equipPlan:973 → planSchedule:2978 → schedulePlacements:3089 → safetyDiff:3039 → tasks/UI`. Two things the drawing exposes: the cross-event path (`:7840,:7850`) runs **only** `itemStages → planSchedule` — equipment enrichment and capacity placement are single-event-only; and `window._planSafetyViolations` (`:5711-5717`) has **no production reader** while its sibling `_plcConflicts` (`:5692`) reaches the user at `:5739`.
- **(c) Safety architecture** — split into ENFORCED (structural: `equipPlan` can only add 2 fields; a placement is a start/end pair of the same length; `SCHED_PULL_MAX_MS` refuses rather than reschedules; `mtGuard` rejects number-changing translations), ADVISORY (`bcheck`, `cureScaleGuardHTML`, `aiSafetyNote/Caveat` — output byte-identical either way), INERT (`safetyDiff`), and UNGUARDED (voice-cook Q&A `:5269-5300`, measured 0 guard occurrences; worker fail-open `worker/index.js:56`). Includes a measured guard-coverage table — `askRefuse` has exactly **1** production call site.
- **(d) Data/citation flow** — `scratch/research/*.json → gen_sources.py → sources.py → build.py:85-105 merge → 279 shipped src blocks`, annotated with the three traps that produced false alarms, plus a live contradiction: `gen_sources.py:91-92` says MAKE `calc` overrides are applied at build time; `build.py:96-102` skips them.

**SKILLS** → `docs/process/skills/`:

1. **`verify-against-the-runtime-path/SKILL.md`** — name the consumer, walk backwards, measure at the consumer's input, prefer executing to reading, state the path in the finding. Baseline RED phase is the three real false alarms (table of claim / artifact checked / path not traced / truth), including the controller repeating the error while "independently verifying."
2. **`no-inert-shipment/SKILL.md`** — a value with no production reader is not done; a test asserting the value rather than the effect is not a test. Built around `_plcConflicts` (wired) vs `_planSafetyViolations` (inert) — same function, six lines apart. Both carry rationalization tables, red-flag lists, and an honest "still untested" note naming the pressure scenario each needs.

I re-measured every inherited number; three changed (482 not 483 guards; 3,985 not 3,986 merged keys; 19 not 32 stale `cure=2.5` overlays out of 32 `calc` overrides). Corrections are recorded in a "Measurements taken" table. No conclusion changed.

## ?

Report written to `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W5-C-second-opinion.md`.

**Top 10 (all evidence-backed; 3 self-disproved claims dropped, listed in §7):**
1. **CRITICAL** — Worker token cap bypassed entirely: `worker/index.js:43` admits `:streamGenerateContent`, but metering at `77-87` reads `j.usageMetadata` from a JSON **array** (or SSE text that throws) → `used=0`, never written. One-word URL edit = unlimited spend on the owner's Gemini key.
2. **HIGH** — KV counter is read-modify-write across a multi-second upstream call (`worker/index.js:53→66→84`); concurrent calls lose updates, so `cap` is not an upper bound.
3. **HIGH** — `gen_sources.py:91-98` prints 32 make-calc overrides as "APPLIED"; `build.py:96-103` discards them and writes to a level `app.js` never reads (`grep`: only `b.calc`). **18 salt values measurably differ** — `n-kabanos` ships 18 g/kg vs researched 25.
4. **HIGH** — fr/de/es in the language picker at 83/3985 keys (2.1%); measured French: wizard **92% Hebrew**, events 100%, catalog 56%, under `dir=ltr`. English is 0% — machinery is fine, the gate at `app.js:6878` isn't.
5. **HIGH** — Alarm banner + OS notification Hebrew-only in every language (`app.js:2387,2398,2408-2411`); measured at `lang=en`: `aria-label="טיימר הסתיים"`, button `🔕 עצור`.
6. **HIGH** — `addDays()` (`app.js:2790`) loses a day across spring DST: `addDays('2026-03-26',2)` → `2026-03-27`. Shifts "end of cure — remove and rinse" (`9281`) one day early.
7. **MED-HIGH** — `today()` returns UTC date, `isoDate()` returns local; measured disagreement of one day between local midnight and 03:00.
8. **MED-HIGH** — AI numeric guard is unit-blind (`app.js:4304`): 74 °F passes as *grounded* against 74 °C, so the strong refusal never fires.
9. **MEDIUM** — No CSP/security headers (`build.py:427-428`) while the Gemini key is in `localStorage`; `centralUrl` accepts `http://` unvalidated.
10. **MEDIUM** — `serve.js:33` fork-crash loop: measured **1,146 restarts in 6 s** with no `dist/`.

**Disagreements with W1-A** (full table in §8): its 4 worker findings are correct but all secondary — it missed both quota-breaking ones (#1, #2). It calls the AI layer "best-engineered" without auditing the one regex enforcing the safety contract (#8). Its `build.py` findings are latent (`</script`, measured zero occurrences) while the live pipeline drop (#3) went unexamined, and it quotes `build.py:96-102`'s Wave-0 comment without testing it — that comment's stated root cause is impossible at the actual merge destination (a CAPA closed on an unverified cause). It says `serve.js` warrants "no findings" (#10 disagrees). It has **zero** i18n (#4, #5) and **zero** date/time (#6, #7) findings. Framing disagreement: its 14 captured-but-unread device properties are filed as dead code — the form *asks the user to type them*, so that's a UX defect, not housekeeping. I confirm and do not dispute its §0 re-checks, the `store.set()` return-value gap, and the pluralization bug (which I'd rank last).

## ?

Report at `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W5-B-ux.md`. No source file modified; scratch PNGs deleted.

**Design-system verdict:** colour is a real, well-governed token system (4 themes × ~36 vars, `app.js:6840–6853`/`6995`; charcoal re-skins even the occupancy diagrams cleanly — `p2-dark.png`). Type/space/radius are **not** tokenised: 34 distinct font sizes (8.5–90px in 0.5px steps), 24 padding + 16 gap values, 21 radii, and the one radius token `--r` is used twice. `--fscale` threaded through 618/624 font-sizes is excellent.

**Top 8 (all reproduced live at 390×844, `node serve.js`, not screenshot-only):**
1. **Work Plan opens 2.1 screens above "now"** — `.wp-next` at y=1550, viewport 721, `scrollTop=0` forced (`app.js:2505`); nothing scrolls to it.
2. **Occupancy scrubber = 330×16px, thumb 15px, `position:static`** (`app.css:1636`) — fails WCAG 2.5.8 and scrolls away with its clock; no sticky element exists in `.panel-body`.
3. **Occupancy tile labels truncate to 2–3 chars** (`חז…`, `Go…`) — `Math.max(18,…)` (`app.js:568`) gives a 47px tile → 26px label room vs 47px needed; full name only in `title=` (dead on touch).
4. **Serve-date clips the year** → `22/07/202` at every `--fscale` — `app.css:556 width:120px`.
5. **Accent tokens used as ink fail AA on all 3 light themes** — `.chome-ask` 2.06:1, `.chome-kick` 1.77:1, `.occ2-fit-ok` 3.40:1; the neutral ramp got an AA pass, the accent ramp never did.
6. **11/11 equipment-form controls have unlinked labels** (no `for=`, no wrapping) — label text isn't tappable; `#eqvArea` numeric field lacks `inputmode`.
7. **Sub-44px targets cluster on the time-critical screens** — 26px stage-expand, **13px** "block if not enough time" safety checkbox, 34px method chips.
8. **`✓ everything fits` is the fall-through for an empty device** (`app.js:674`) — same defect class as commits `8c4a3de`/`6f05cab`, one level up.

**Preserve:** the colour tokens + `color-scheme`/`theme-color` wiring; `--fscale`; logical-property RTL and the `dir="ltr"` number-unit islands (`app.js:631`); the global `:focus-visible !important` (`app.css:825`) that neutralises 10 `outline:none`; global reduced-motion (`:1615`); undo-toast reset (`app.js:5649`); full-row `<label>` work-plan checkboxes; drawn-not-hidden empty shelves; `body.is-cooking` home reorder.

**Corrected a would-be false alarm:** `app.css:390–464` (~70 lines of hardcoded theme hex) is **dead code** — `applyAppearance()` strips `t-vintage`/`t-gold`/`light` and nothing re-adds them. Live hardcoded hexes are ~120, not 258.

## ?

Report: `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W5-A-measured.md`

**Lighthouse 13.4.0 emits no `performance` and no `pwa` category** (measured: categories = accessibility, best-practices, seo, agentic-browsing). Scores identical desktop/mobile-throttled: **A11y 94, Best-Practices 100, SEO 82** (agentic 67/66). Failing: color-contrast, label-content-name-mismatch, landmark-one-main, meta-description, robots-txt (11,313 errors), llms-txt.

**Core Web Vitals** (390×844, 4× CPU, Slow 4G, fresh isolated context): **cold LCP 2,863 ms · CLS 0.29 (Bad) · TBT 853 ms · FCP 1,913 ms · loadEnd 5,314 ms**. Warm-SW: LCP 1,110 / CLS 0.00 / TBT 611. Desktop unthrottled: LCP 347 / TBT 58. Parse cost of the single-file doc at 4×: ParseHTML 400.3 ms + v8.compile 177.9 ms + EvaluateScript 266.1 ms + Layout 812.0 ms.

**Worst a11y failures:** contrast 1.77:1 (footer stamp), 2.65:1 (hero), 2.95/2.97/3.03:1; **25 of 36** interactive elements under 44 px (18 lane-chips at 37 px, `#cHomeAiMore` 26 px); `<main>` measures **0×0** so the skip link goes nowhere; **zero aria-live regions at rest**; 13 unlabelled form fields; wizard opens without moving focus and Chrome itself logs "Blocked aria-hidden … descendant retained focus".

**Confirmed W1-D:** cwLbl hardcoded `שלב 1/6` in English mode; English footer "Data is local, no network connection"; 619.5 ms render-blocking fonts request; `.capp-ico` exactly 40×40; occ2/timeline zero ARIA; **§3.4 quantified — English 36–37 long tasks / 4,984–5,061 ms per 8 s (62% of wall-clock) vs Hebrew 0 long tasks, reproduced twice.**

**Refuted/corrected:** "2.6 MB payload" — it's **660 KB on the wire** (4.07:1 compression), the cost is parse not bandwidth; "contrast was audited and passed" — cream is the **worst** of 4 themes with 5 AA failures (charcoal 0, walnut 2, slate 2); skip-link listed as a positive is broken; toast's aria-live is created-on-insert, no region at rest; `.cnav` 78×70 and FAB 78×88 **pass** 44 px.

**New, not in W1-D:** a first visit transfers **2,117,219 bytes — three full copies of the document** (`SHELL=['./','index.html',…]` in the shipped sw.js + `no-cache`), 62% waste; the origin returns **HTTP 200 + 2.27 MB for every unknown path** (no real 404), which is the sole cause of both SEO failures.

## ?

**`C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W4-B-pricing.md`**

| | Free (אש) | **Pit Pass** (anchor) | Pitmaster | Instructor (later) |
|---|---|---|---|---|
| IL / intl | ₪0 | **₪29mo · ₪249yr / $8.99 · $59** | ₪59 · ₪499 / $17.99 · $129 | ₪1,490+/seat |
| Managed AI | 25 actions/mo | 400 | 1,500 | pooled |
| BYOK | **unlimited, free forever** ($0 owner cost, `app.js:4214`) | ✅ | ✅ | ✅ |
| Adds | all deterministic features | copilot, photo, 60min TTS, sync | pro/thinking routing, Guardian, Coach | rosters |

**Boundary: deterministic ⇒ free forever; probabilistic ⇒ metered.** Three independent reasons, not one: (a) ethical — gating cure/botulism guards gives non-payers a measurably less safe product, worst for beginners who pay least; (b) **economic — it costs $0 to give away**: `askRefuse`/`AI_REFUSALS` (`app.js:4146-4197`) is pure regex firing *before* any network call, `cureScaleGuardHTML` (`1849`), `SAFETY_FACTS()` (`4127`), `UMAKE_CALC` (`8571`), 279 cited `src` blocks — all local, zero marginal cost, so no revenue is sacrificed; (c) strategic — the refusal card is the viral demo and must be reachable with no key. Corollary: guards attach to features, never plans. **`mk-uilevel` must not be a price axis** — it inverts safety.

**Triggers:** (1) BYOK key wall `openKeyManager:4512` — highest volume, the offer is *less* work than status quo; (2) hour 7 of a brisket `copilotAskNow:5448` — highest intent but **never hard-gate mid-cook**; grant an emergency allowance, convert at cook-end; (3) journal after a rated cook `8646`; (4) first photo tap `9310` (one free lifetime); (5) cloud sync on 2nd device; (6) meter exhaustion degrades to `wcimLocal`/`askFire`, never a dead end.

**Prices:** ₪249/yr = ₪211 net at Israel's 18% VAT ≈ **$57 — the same net as $59 intl**, so tiers are priced identically and only tax display differs. Israel is the #3 LTV market ($27.0, Adapty); take the *top* of ai-strategy's ₪199–249 range — at ₪199 margin is too thin after Gemini's 2026-07-02 price rise. Annual is the hero (BBQ is seasonal). Measured COGS ≈ **$0.0035/text action** → Pit Pass ~71% gross margin; the shipped 2M-token cap ceilings at **~$2.58/user/mo**.

**Metering does not currently hold — 4 launch blockers.** `worker/index.js:56` `catch { rec = { active: true } }` yields no `cap`, so the quota check at `:58` *and* the metering at `:77` are both skipped — the record is never rewritten, so the grant is **permanent and never self-heals**. Fix: fail closed. Same class at `:58` — a missing `cap` means unlimited (B2). Plus TOCTOU read`:53`/write`:84`, zero rate limiting in all 91 lines, and the real revenue leak: the code is a **shareable bearer string** (`central-code.mjs:37`) with no device binding under `CORS: '*'` (`:21`) — one paid code serves fifty people, no bug required.

Two findings beyond the brief: **TTS already meters against the same cap** (`app.js:5030`) but its audio-token price differs 4× across sources — allowances are placeholders until measured; and **MT hydration is an uncapped leak** — per-element calls at 600 tokens (`6974`) with the cache silently ceasing to persist above 3,000 entries (`6981`), so translation re-runs forever. Move it to build time; `6993` already short-circuits on a pre-translated dict. Also flagged: W1-F's Tier-D gap (`vcAskAI:5269-5300`, unguarded and *spoken*) is a **paid-launch blocker** — selling an unguarded spoken safety number is a different liability from giving one away.

## ?

No source files modified. Report at `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W4-A-unit-economics.md`; model at `scratchpad/unit_econ.py`.

**COST/USER/MONTH** (Gemini paid tier, ai.google.dev/gemini-api/docs/pricing fetched 2026-07-22: $0.30/$2.50 per 1M tok, TTS $10/1M audio, **search $35/1k grounded prompts**):
- A · Curious browser $0.27 · B · Weekend griller $0.67 · C · Enthusiast+VoiceCook **$2.83** · D · Charcutier $1.10 · blended $1.22

**THE BRIEF'S PREMISE IS HALF WRONG.** Measured: photo analysis is the *cheapest* AI feature ($0.0014/call — Gemini's tiling caps a 4032×3024 photo at ~1,548 tok). TTS is real but only 16% of persona C. **77–90% of every persona's bill is the `$0.035` grounded-search request fee**, not tokens. Persona C = search $2.17 (77%) + TTS $0.45 (16%) + *all tokens* $0.21 (8%) — so the Hebrew tokens/char assumption barely matters.

**COST CLIFFS**
1. 🔴 `google_search` attached **unconditionally** at `app.js:4249` (Ask-the-Fire) and `5278` (Voice Q&A) — even for questions the app already answers from its own catalog. Making it conditional: C $2.83→$0.99, B $0.67→$0.17 (**3–4× cut**), and it closes hallucination surface #3 in W1-F.
2. 🔴 The 1,500 RPD free grounding allowance is **per-project, not per-user** — 45,000/mo shared by everyone. Covers only **725 enthusiasts**, then steps to full rate.
3. 🔴 `worker/index.js:76` meters `usageMetadata.totalTokenCount`; grounding is a per-*request* fee that appears in no token counter. **The 2M-token cap authorises ~$16/mo per code and meters ~10% of it.**
4. 🟠 **Zero rate limiting anywhere** — the only `debounce` in app.js is the catalog search box (`2781`). One leaked code at 1 req/s = **$126/hour**; the token cap intervenes only after ~7 min.
5. 🟠 **TTS silently bills the owner** — runtime-verified, not read: `gemSpeak` (`5025`) gates on `gemKey()` but calls `gemFetch` without `opts.key`, so `gemMode()` routes to managed. Intercepted fetch confirmed the TTS request going to the Worker with `X-Access-Code` and no `x-goog-api-key`.
6. 🟡 Measured: `aiJSON` makes **2 billed attempts** on an HTTP-200-with-empty-candidate (`4374`) — a 400 on the two grounded callers costs $0.07 per tap.

**MINIMUM VIABLE PRICE: $4.99/mo floor, $7.99 defensible.** $2.99 is gross-margin **negative** (−8.7%) against persona C today. $4.99 gives only 37.7% worst-case as the code stands, but **78.3% after the search-conditional fix**. $7.99 is safe either way (62% → 87%). No flat plan is honest without a dollar-denominated per-user ceiling, given cliff #4.

## ?

**Report: `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W4-C-market.md`**

**TAM/SAM/SOM** — Bottom-up gives ~$870M US (134.79M households × 70% grill/smoker ownership [HPBA 2023 SOTBI] × 23% "hobby" motivation × $40 ARPU). **I reject it.** Total *global* paid recipe-app revenue is projected at $399.8M by 2027 (electroiq) — the bottom-up US figure is 2.2× the entire global paid category. Honest **TAM = $40–80M/yr** worldwide; **SAM = $15–30M/yr** (Hebrew slice $0.5–1.5M); **SOM = $90k–$255k ARR at Year 3** (0.5–1.5% of SAM), of which Israel contributes only $16k–$60k. Israel = 10.178M people (CBS, Jan 2026); Hebrew speakers ~9M worldwide.

**Competitor verdict** — The market is barbelled: free hardware-tethered apps (MEATER free, Weber Connect free, Traeger free, ThermoWorks free, Anova $10/yr) vs. paid content (AmazingRibs $34.95/yr, ChefSteps Studio Pass $69/yr, Modernist Cuisine in print). The middle — paid hardware-agnostic planning software — is **thin but NOT empty**: Time To Plate sells backward-planning across real appliances (incl. smoker) for $39–99/yr, and Weber BBQ Timer ships a free "Cook Plan" that finishes dishes together. **`docs/ai-strategy.md:77` ("Nobody owns the software-first AI copilot") is overstated and should be corrected.**

**Defensible differentiation** — (1) **Hebrew-first**: verified uncontested; a Hebrew search returns blogs and butcher shops, zero apps. Moat against entry, not a revenue source. (2) **Cited corpus**: real and measured — 279 `"src"` blocks in the shipped bundle (re-verified independently), 130 cuts + 47 specials = 177 items, USDA FSIS + Baldwin. No competitor publishes per-item dated provenance. **But "guards your cure" is a claim the code doesn't earn** — the cure guard is advisory (test G8 proves grams are byte-identical), both plan-depth gates are 0% built. (3) **Capacity scheduler: genuinely uncontested** — I fetched Time To Plate, Weber BBQ Timer and BBQ Replay; none mention rack space, dimensions or shelf capacity. Caveat: `footprint_cm2` is static, so 4 and 40 guests claim identical grate area. (4) **Charcuterie**: ~4% of the smoking audience (r/Charcuterie 44k vs r/smoking 1.0M) — a credibility wedge, not a market.

**Top risks** — R1 general AI absorbs the use case (ChatGPT 900M WAU Feb 2026, 50M paying); R2 a vendor adds planning (Weber already ships "Cook Plan" and already works with any grill); R3 Hebrew market can't fund it (Year-3 midpoint ~$38k/yr, below one Israeli dev salary); R4 **unit economics may be inverted** — 2M tokens/mo/user cap at Gemini 2.5 Flash $0.30/$2.50 per M = $17.76–$60/yr against a planned ~$49–59/yr, and **no billing code exists anywhere** (verified: every `billing` hit in `app.js` is a Google Cloud TTS error string, every `stripE` is `stripEmoji`); R5 Anova's paywall backlash precedent; R6 `app.js:334`/`3931`/`3939` still claim offline/local, contradicting the online-first decision.

Verdict: not venture-scale — a credible solo/lifestyle business or OEM/acquisition target. Highest-leverage move is shipping the two safety gates, which converts the one uncopyable asset from marketing into product.

## ?

`C:\Users\dudib\source\repos\matconetesh\docs\analysis\2026-07-22-business-model.md`

**Recommended model:** Two tiers only, not three. Free (אש · Ember) = unlimited BYOK forever + all deterministic safety + 25 managed actions with **live web lookup off**; Pit Pass = 400 actions + 40 live lookups + full Copilot + cloud sync. Key packaging decision I added: **make grounded web search the paid capability** — it is 77–90% of all COGS (W4-A §0) *and* the #3 hallucination surface (W1-F §3), so gating it cuts free-tier cost from $0.27 to ~$0.03/user/mo and improves free-tier safety. Defer Pitmaster (pro/thinking COGS unmeasured) and all B2B.

**Price points:** ₪249/yr (hero) · ₪29/mo IL; $59/yr (hero) · $8.99/mo intl — net-of-VAT parity, not a geographic premium. Annual is the hero (BBQ is seasonal). **These clear a 78–79% gross margin only AFTER `google_search` is made conditional**; today they yield 36–40% against an enthusiast in Voice Cook mode. If that fix does not ship, the honest price is $79/yr with a 150-action allowance, not $59.

**Reconciliation that kills the current plan:** W4-B's 400-action allowance is costed at $0.0035/action; W4-A *measures* Ask-the-Fire at $0.0381 — 10.9× higher, because 92% is a per-request search fee no token counter can see. 400 actions all spent on Ask-the-Fire = $15.24 COGS against $4.42 net revenue: **−245% margin, losing $10.82/user/month** on the app's most prominent button. Also corrected: W4-B guessed photo analysis at weight 3; W4-A measured it the *cheapest* feature ($0.0014) — weight 1.

**Technical blockers to revenue (all re-verified by me, not taken from the reports):** worker fail-open at `worker/index.js:56` (malformed KV → `{active:true}` with no `cap` → `:58` and `:77` both skip, so the record never self-heals — a permanent silent free rider); cap-by-omission (`:58`); TOCTOU read `:53`/write `:84`; zero rate limiting in all 91 lines ($126/hr on one leaked code); CORS `*` (`:21`) plus a 72-bit bearer code (`central-code.mjs:36`) with **no account system to bind it to** — one paid code serves fifty people. Meter is blind to ~90% of cost: the 2M-token default authorises ~$16/mo and meters ~$1.60. Plus a hard safety gate — `vcAskAI` (`app.js:5269-5300`) speaks unguarded safety numbers aloud with search on.

**Two citation corrections:** the offline-copy contradiction is at `build.py:334`, not `app.js:334` (which is `deviceSilhouette`) — right fact, wrong file, in both W1-F and W4-C. Fact confirmed in `dist/index.html:1916`.

**Honest recommendation: do not monetise now.** The problem is misdiagnosed — it is unbounded *cost*, not missing revenue, and the search conditional captures 68% of the gap ($1.22 → $0.39 blended) in days versus weeks-to-months for accounts + metering + billing. There is zero analytics anywhere (verified), so every allowance is a guess, and §2.4 shows what a 10.9× guess costs. Israel Year-3 midpoint is ~$38k/yr — below one developer salary — and the real revenue needs English, which is not finished. Ship Stage 0 (search gate, `vcAskAI` guard, rate limit, fail-closed, TTS key) in ~1 week; revisit charging in ~2 quarters against the six trigger conditions in §6.4.
