# W1-F — AI Surface & Guards Audit

**Scope:** every AI feature and its trust/safety guards, in `app.js`, `worker/index.js`, and the AI planning docs.
**Method:** every claim below cites `file:line` against the current tree; nothing is asserted from the docs alone. Cross-checked against `git log` (Wave 1 trust commits v214–v219, Wave 3 v226) to avoid re-reporting fixed issues.

**Standing context:** the owner's 2026-07-22 decision makes online + an AI key the primary model, not an offline fallback. `app.js:334` (the in-app footer, not `README.md`) still ships the sentence **"הנתונים מקומיים, ללא חיבור לרשת"** ("data is local, no network connection") — a live document-vs-decision conflict. `README.md:3` also still reads "fully local-first". Marketing copy at `app.js:3931,3939` makes the same offline-first claim ("Private by default... stored locally on device only"; "Full offline coming next"). All should be revisited under the new decision, not just README.

---

## 1. Feature inventory (13 distinct AI entry points, all wired to real UI)

| # | Feature | Core fn | UI wiring | Guard applied |
|---|---|---|---|---|
| 1 | Ask the Fire (chat) | `askGemini` `app.js:4237` | `openAsk` `4419`, home `#cHomeAsk` `9485`, settings menu `9426` | `askRefuse` (4448) + `aiSafetyNote` (4454) — full stack |
| 2 | Live Cook Copilot "what now" | `copilotAskNow` `5448` (calls `askGemini`) | `#copAskNow` button `5503/5515` inside `openCopilot` | `aiSafetyNote` (5464) only — **no `askRefuse`** |
| 3 | Voice Cook hands-free Q&A | `vcAskAI`/`vcAskFlow` `5269–5300` | mic command inside Voice Cook mode (`vcToggleMic` `5303`, `vcRender` `5081`) | **none** — see §2 |
| 4 | Recipe generator | `aiGenerateRecipe` `8563` | `openRecipeGen` `8614`, AI hub, `#cProjGen` `8776` | structural: calc numbers are app-supplied (`UMAKE_CALC`), never AI (8571) |
| 5 | Diagnose-a-cook | `aiDiagnose` `8475` | `openDiagnoseAI` `8513`, AI hub, `#tAiDiag` `3988` | `aiSafetyCaveat` only (8499) — **weaker tier**, see §2 |
| 6 | Journal insights | `aiJournalInsights` `8646` | `openJournalInsights` `8667`, `#jInsights` `3637` | `aiSafetyCaveat` only (8664) |
| 7 | What can I make | `wcimAI` `8182` | `openWhatCanIMake` `8222`, `#cProjWcim` `8774` | `aiValidateItems` (catalog-key grounding); not a safety-number domain |
| 8 | Pantry / scheduling advisor | `pantryAdvisorAI` `9169` | `openPantryAdvisor` `8291`, `#cProjAdv` `8775` | `aiValidateItems` + durations always recomputed in-app (9176), never trusted from AI |
| 9 | Event planner | `aiPlanEvent` `8314` | `openEventPlanner` `8369`, `#cEvAiPlan` `9516` | `aiValidateKeys` + kosher re-filter (8320-8321) |
| 10 | Seasoning recommender | `aiSeasonRec` `8406` | `openSeasonRecAI` `8442`, `[data-spkairec]` `1253` | `aiValidateSeasonings` (catalog-id grounding) |
| 11 | Equipment spec lookup | `aiLookupDevice`/`aiBrandModels` `6306`/`6368` | equipment picker `6648`/`6664` | numeric range/unit sanity checks (6338-6363); not a food-safety domain |
| 12 | Photo analyzer (multimodal) | `gemVision` `9296` | `openPhotoAnalyze` `9310`, AI hub | `aiSafetyNote` against `SAFETY_FACTS()` (9326) — full stack; prompt also forbids stating a temp from the photo (9307-9308) |
| 13 | AI translation (data-MT) | `mtTranslate` `6962` | `hydrateMT` `6987`, runs automatically on language switch | `mtGuard`/`mtNumSig` — numeric-invariant, rejects any translation that changes a number (6956-6958, 6980) |

Plus infrastructure: `gemFetch` (4208, centralized transport/timeout/retry/BYOK↔managed fallback), `aiJSON` (4338, the shared structured caller with grounding + validation), `gemSpeak`/`sysSpeak`/`vcSpeak` (TTS, §8).

All 13 are live, reachable from real buttons — none are dormant/orphaned code. The AI Tools hub (`AI_TOOLS` `9330`) only lists 5 of the 13 (photo, ask, recipe-gen, diagnose, journal); the other 8 live at their natural point of use (pantry, event, equipment, seasoning screens) — a discoverability gap, not a functionality gap.

---

## 2. Guards — NOT applied uniformly. One fully unguarded free-text path found.

The trust stack has three tiers, and they are **not** applied consistently:
- **Tier A (full):** `askRefuse` (deterministic pre-filter, `AI_REFUSALS` 5 entries `4146-4196`) + `aiSafetyNote` (numeric-invariant, escalates to a blocking "don't rely on this" card when a safety number isn't in the injected grounding, `4315-4326`). Applied only to Ask-the-Fire (4448+4454).
- **Tier B (partial):** `aiSafetyNote` alone, no `askRefuse`. Applied to Live Cook Copilot (5464) and Photo analyzer (9326, grounded against `SAFETY_FACTS()` directly since there's no chat history to check).
- **Tier C (weak):** `aiSafetyCaveat` alone — a regex that *flags* any number-looking text as "unverified", with **no comparison to grounding**, so it cannot distinguish a correct cited number from a fabricated one. Applied to Diagnose (8499) and Journal insights (8664).
- **Tier D (none):** no refusal, no numeric guard, no caveat, no visual flag, nothing.

**Tier D is real, not hypothetical: Voice Cook hands-free Q&A (`vcAskAI`/`vcAskFlow`, `app.js:5269-5300`).**
- `vcAskAI` (5269) is its own hand-rolled Gemini caller (`google_search` tool enabled, 5278) — a fourth free-text path parallel to `askGemini`, sharing none of its guards.
- The system prompt (`vcBuildAskPrompt` 5238-5267) carries only a *soft* instruction — "Do not invent safety temperatures — if unsure, say so" — no `askRefuse`, no `SAFETY_FACTS()` injection (`vcCookContext()` 5233-5239 injects only the current step label + live probe telemetry, never the vetted safety anchors that `askContextFor` forces in for Ask-the-Fire).
- `vcAskFlow` (5287-5300) both **renders** the raw answer unescaped-of-caveat (`vcLastQA` → `esc(vcLastQA.a)` at `5128`, no caveat call) and **speaks it aloud** (`vcSpeak(answer, ansL)` at `5296`) with zero safety layer.
- This is the exact scenario Wave 1 (v214-v219) was built to close for the other flows, but the fix never reached this caller. Confirmed by grep: `aiSafetyNote`/`aiSafetyCaveat` appear at exactly 5 render sites in the whole file (4454, 5464, 8499, 8664, 9326) — `vcAskAI`'s output is not one of them.

Secondary gap: **Diagnose has no `askRefuse` and no grounded check**, despite its own example chips inviting exactly the dangerous inputs the refusal list exists for ("white mold on the salami", "stalled at 68 degrees" — `8514`). `diagnoseGrounding()` (`8465-8474`) never calls `askSafetyIntent`/`SAFETY_FACTS()` the way `askContextFor` does (`4140-4141`) — so even a safety-relevant diagnosis question gets zero vetted anchor to ground against, only the weak Tier-C caveat.

---

## 3. Hallucination surface — ranked

1. **🔴 Voice Cook hands-free Q&A spoken safety numbers** (`vcAskAI` `5269`, `vcSpeak` `5296`). Highest risk: hands-free by design (user is mid-cook, away from the screen), zero guard of any tier, `google_search` on (indirect-injection surface from whatever page Google returns), and the one place a wrong number reaches the user by voice with no accompanying visual caveat to catch it later. **Priority fix.**
2. **🟠 Diagnose qualitative (non-numeric) unsafe advice** (`aiDiagnose` `8475`, `diagnoseRender` `8488`). The numeric guard only fires on number-shaped text (`aiSafetyHasNumbers` `4290-4292`); a qualitative claim like "that mold is probably fine, keep drying" carries no number and slips past even the weak Tier-C caveat entirely undetected. No `askRefuse` gate either — the deterministic mold/nitrite/pasteurization refusals that catch this exact phrasing in Ask-the-Fire never see Diagnose input.
3. **🟠 Ask-the-Fire indirect prompt injection via `google_search`** (`askGemini` `4237-4259`, tool enabled `4249`). A malicious or wrong web page returned by grounded search could cause the model to assert a wrong safety claim. Partially mitigated — `aiUngroundedSafety` (`4308-4312`) catches *numeric* claims not present in `SAFETY_FACTS`/catalog grounding and escalates to the blocking card — but a qualitative claim ("nitrite is optional if you use enough salt") without a bare number still passes through with, at most, the mild caveat.
4. **🟡 Live Cook Copilot same class, smaller blast radius** (`copilotAskNow` `5448`) — has `aiSafetyNote` (good) but no `askRefuse`; query is app-constructed from session state (`copilotVoiceContext()`) rather than raw free text, which narrows but doesn't eliminate injection/hallucination exposure.
5. **🟢 Structured-JSON features** (recipe-gen, event planner, wcim, pantry advisor, seasoning) — well-contained: every catalog key is validated post-hoc (`aiValidateKeys`/`aiValidateItems`/`aiValidateSeasonings`), and the one domain that matters most — cure/salt dosing — is **never** asked of the model at all; it's assembled from `UMAKE_CALC` app presets (`8571`). This is the correct pattern; it should be the template for #1 and #2, not the exception.

---

## 4. Prompts — safety constraints, injection exposure, format fragility

- **Safety constraints are present but soft** in every free-text system prompt ("do not invent safety numbers, say so if unsure": `4242` Ask-the-Fire's `sys`, `8478` Diagnose task, `5258`/`5264` Voice Q&A, `9307-9308` Photo). These are model-behavior instructions, not enforcement — the enforcement is the downstream guard layer (§2), which is why the Tier-D/Tier-C gaps in §2-3 matter: a soft instruction alone is exactly what the guard layer exists to backstop, and two live paths don't have it.
- **User free text is concatenated directly into prompts** in every free-text/structured caller: `askGemini` (`4245` `'שאלה: '+q`), `aiPlanEvent` (`8317` prompt embedded in `task`), `aiDiagnose` (`8470` `'תיאור התקלה: '+problem`), `aiGenerateRecipe` (`8566`), `vcAskAI` (`5266` `question`). No sanitization or delimiting beyond string concatenation. The mitigating factor structurally present everywhere except vcAskAI: output is either (a) schema-validated + catalog-key-filtered (`aiJSON` callers), or (b) numeric-guarded (`askGemini`/photo). `vcAskAI` has neither — its output is free prose with no downstream check at all, so it is also the path with the least defense-in-depth against injection consequences, not just against hallucination.
- **Output-format fragility:** `aiJSON` (`4338-4374`) handles the realistic Gemini JSON failure modes — fence-stripped, one retry on 4xx/empty, then a conservative repair pass for common malformations (`aiRepairJson` `4379-4384`: `"k":,` → `"k":null,` etc.) before giving up with `bad-json`. This is solid, pragmatic engineering — matches the `llm-structured-output` skill's "never use JSON mode without a schema + validate downstream" guidance, though Gemini's `responseMimeType:'application/json'` here is JSON-syntax mode, not a hard schema (`generationConfig` `4351-4358`) — schema conformance is enforced entirely by the app's own post-hoc validators, not by constrained decoding. That's acceptable given the validators are comprehensive, but it means a subtly-wrong-shaped object (right JSON, wrong field types) can still slip through in a few spots — e.g. `aiPlanEvent`'s `raw.guests` is `parseInt`-guarded (`8325`) but `aiSeasonRec`'s `r.reason` truncation (`8415`) is the only type guard on that field.

---

## 5. Proposed evaluation harness (none exists today)

No `evals/`, no fixture corpus, no CI gate on AI quality — confirmed absent by search. `ai-prd.md:150-157` already specifies the right *shape* (separate the deterministic wrapper from the live model call, mock the model, test everything else offline) but no harness file exists to run it. Concrete, minimal proposal, reusing the mock seams already wired in (`window.__aiMock` `4335`, `window.__vcAskMock`, `window.__mtMock` `6969`):

| Axis | What to measure | Fixtures | Pass bar |
|---|---|---|---|
| **Grounding** | Every catalog key/id in a JSON-feature response exists in `cwAllItems()`/`seasoningsFor()` | ~20 mocked responses per feature (7 JSON features), including adversarial ones that invent a key | 100% of invented keys dropped (`aiValidateKeys` etc. already do this — the eval just needs to assert it in CI, not add new logic) |
| **Numeric fidelity** | `mtSafe`/`aiUngroundedSafety` correctly reject any translation/answer that drops, adds, or alters a number vs. source/grounding | Reuse `mtNumSig` unit tests as a template; add ~15 adversarial pairs (temp swapped, digit dropped, `65°C`→`650°C`) for the AI-answer guard, not just MT | 0 false-accepts on a corpus of deliberately mangled numbers; track false-reject rate separately (over-blocking a correct cited number is a UX cost, not a safety one, but should be visible) |
| **Refusal** | `AI_REFUSALS[].test()` fires on the 5 documented intents *and* their paraphrases; does NOT fire on legitimate quantity questions (the existing `quantity` carve-out at `4154`) | The existing `docs/ai-trust-wave1.md:21` prompt list ("no-nitrite shelf-stable salami", "sous-vide chicken 55°C 1h", "wash the mold and keep drying", "how much cure for 2kg salami") — turn this into an actual Playwright/unit fixture file, it is currently just prose in a planning doc | 100% recall on the 5 canonical phrasings + ≥1 paraphrase each; 0 false-positives on the quantity-question carve-out |
| **Hebrew output quality** | No Hebrew-in-English or English-in-Hebrew leaks (the exact bug W1-P1 fixed for JSON features); RTL-safe punctuation; no literal `°F`/imperial when `pref('units')==='metric'` | Run every JSON-feature prompt in both `getLang()` states via `outLang` (`4343-4346`); assert output strings match language via a script-detection regex (Hebrew block vs Latin) | 0 script-mismatch strings in sampled real (non-mocked) runs — this one axis genuinely needs live-model runs periodically, not just mocks, since language leakage is a model-behavior regression class |

The harness should run mocked (fast, CI-gated, every PR) for grounding/numeric/refusal, and a small live-model smoke batch (manual or scheduled, not per-PR — costs tokens) for Hebrew-quality drift, mirroring the `agent-evaluation`/`llm-evaluation` skill guidance of automated-metric-fast-loop + periodic-live-check.

---

## 6. AI-as-orchestrator readiness

**Current state: `safetyDiff` (`app.js:3039-3052`) exists and is real, but it is a self-check on the deterministic scheduler's own transform (the Phase-4b placement pass, `3053+`), not a gate on any AI-generated change.** No AI proposer exists in the codebase today — confirmed by exhaustive grep (`aiPropose`, `proposeMove`, `planMove`, `aiOrchestrat` all return zero matches). `safetyDiff` is invoked once, at `5716`, comparing `_planSafetyBase[key]` (the plan before placement) against the plan after placement, and the comparison is deliberately narrow: it compares `kind`, `hours`, `temp`, `safe` per stage and **not** `start`/`end` — "moving a stage in time is exactly what placement is for" (`3038` comment). This is precisely the right invariant shape for gating an AI proposer, and it's ready to be reused as-is for that purpose — but it isn't wired to anything AI yet.

**What a structured move vocabulary needs**, built from what the plan layer already exposes:
- A move should be expressible as **{itemKey, stageIndex/tid, action, payload}** where `action` is a closed enum from a small set the deterministic layer already implements: `shiftStart` (Δminutes — this is literally what `schedulePlacements`/the placement pass already does, `3053+`, `5691`), `assignDevice` (device id from `chooseBath`/`choosePlate`/`chooseNozzle`-style capacity resolution, `3004-3031`), `adjustServe` (Δminutes — `copilotAdjustServe` `5385-5392` already does exactly this deterministically), `wrap`/`crutch` (a flagged event, not a numeric change — `copilotStallInfo` `5368-5379` already models the semantics).
- **The vocabulary must structurally exclude** `hours`, `temp`, `safe` as move targets — not just validate them post-hoc. The safest design mirrors `aiValidateKeys`: define the move schema so those fields are never accepted input shapes at all (schema-level exclusion), then run `safetyDiff` as the second, defense-in-depth layer catching anything a bug in the first layer let through — exactly the two-layer pattern already used for catalog-key grounding (`aiJSON` prompt says "don't invent" + `aiValidateKeys` drops any that got invented anyway).
- **Failure modes to design against**, evidenced by patterns already fought elsewhere in this codebase:
  1. *Silent no-op moves that look successful.* `wcimAI`/`pantryAdvisorAI` already show the pattern to copy: merge AI output with the deterministic baseline (`8230-8231`, `9174-9178`) rather than replace it — an orchestrator move that fails validation should fall back to the last-known-good plan, not an empty one.
  2. *A move whose `payload` is syntactically valid but semantically means "cancel a `bcheck` gate."* `safetyDiff` catches a changed `safe` value but has no concept of a gate being *removed* from the stage list entirely — that's the `count` mismatch branch (`3041`), which today only fires on an accidental add/drop, not a deliberate one. An orchestrator needs the count-preserving invariant to be a hard precondition of the move schema, not just a diff-time check.
  3. *Cascading moves across a shared device* — the existing placement pass already handles one item's timing depending on another's (`3056` "the first code in the app where one item's time depends on another's"); an AI proposer issuing moves one at a time without seeing this coupling could re-introduce the over-subscription problem the placement pass was built to solve. Moves should be evaluated as a batch against `schedulePlacements` before commit, not applied one-by-one.
  4. *No confirmation gate.* Every existing AI-writes-state feature routes through `aiConfirmPanel` (`4402-4417`) — explicit user apply/cancel, nothing auto-applies. An orchestrator that runs *during* a live cook needs the same contract or a deliberately-scoped, narrower auto-apply allowlist (e.g., `adjustServe` only) — silently rescheduling a live multi-item cook without confirmation would be a first for this codebase and a bigger trust break than any of the free-text answer risks above.

**Verdict: the invariant is ready; the proposer is not. Building the proposer is the right next step per the architecture already in place, provided (a) the move vocabulary is schema-restricted before it ever reaches `safetyDiff`, not just checked by it, and (b) it inherits the confirm-before-apply contract every other AI-writes-state feature already uses.**

---

## 7. Worker security (`worker/index.js`)

- **Key exposure:** solid. `GEMINI_KEY` is a Wrangler secret, never in the repo (`worker/README.md:35`); the app never sees it, only the per-user access code (`worker/index.js:50-51`).
- **CORS is wide open by design, flagged by the author, not yet tightened:** `Access-Control-Allow-Origin: '*'` (`index.js:21`, comment "tighten to your app origin(s) for production" on the same line; reiterated in `worker/README.md:70`). Any origin holding a valid code can call the proxy — acceptable for the documented "dev/beta" cohort, a real gap before wider rollout.
- **No request-rate limiting, only a cumulative token cap.** `rec.cap`/`rec.used` (`index.js:58-59`, default 2,000,000 tokens/month per `scripts/central-code.mjs:35`) is the only abuse control, and it is explicitly **eventually-consistent** ("KV is eventually consistent — fine for a small dev cohort," `index.js:76`) — a burst of concurrent requests on one leaked code can exceed the cap before the counter catches up (classic TOCTOU on the read-then-write at `77-87`). There is no per-minute/per-IP throttle at the Worker layer at all; Cloudflare's platform-level DDoS protection is the only backstop. `carol 0` (uncapped code, documented in `worker/README.md:58`) has literally no usage ceiling.
- **Graceful managed→BYOK fallback is itself a minor exposure surface:** on a 401/402/403 from the managed path, `gemFetch` (`app.js:4226`) automatically retries with the user's own key if one is stored — sensible UX, but means a user with both configured never sees a clear "your managed quota is exhausted" state; it silently starts spending their personal key/quota instead.
- **Verdict:** appropriate for the stated "dev/beta, small invited cohort" scope, explicitly documented as such by its own author (`worker/README.md:69-73`). Before the Managed-AI paid tier (`docs/ai-strategy.md:96` Part D) goes live to the public, three items are required, not optional: origin-restricted CORS, per-code rate limiting (not just monthly cap), and closing the KV race window (e.g., a short-TTL in-memory/Durable-Object counter ahead of the eventually-consistent KV write).

---

## 8. Hebrew TTS — `hebSpeechText` + Gemini TTS path

- **`hebSpeechText`** (`app.js:4969-4983`) is a deterministic regex normalizer, not model-based — this is the right architecture for a safety-adjacent transform: it cannot hallucinate a number, only reformat one for pronunciation (`°C`→"מעלות", ranges `60-65`→"60 עד 65", units `ק"ג`→"קילו", `דק'`→"דקות"). It preserves every digit it touches; no numeric-invariant guard is needed here because the transform is deterministic and auditable, unlike the AI paths in §2-3.
- **Coverage gaps observed in the regex set:** no handling for `%` (relevant given cure/salt percentages appear elsewhere in the app), no explicit pH/aw phonetic spelling (these do appear in `SAFETY_FACTS()` text, `4127-4129`, which is a candidate to eventually pass through `speechText` if voice ever reads safety anchors aloud — it currently doesn't, see below).
- **The caveat/guard text never reaches speech.** `aiSafetyNote`/`aiSafetyCaveat` render as HTML `<div>` elements appended to the answer (`4454`, `5464`, `8499`, `8664`, `9326`) — none of these five call sites also passes the caveat text through `vcSpeak`/`gemSpeak`/`sysSpeak`. A sighted user reading Ask-the-Fire's answer sees "⚠ do not rely on this number" next to it; a user who has that same answer read aloud (or who asks via hands-free Voice Cook, §2 Tier D) never hears the equivalent warning. This is a real gap between the visual and audio channels, distinct from and in addition to the Tier-D guard gap in §2.
- **Cloud TTS (`gemSpeak`, `5025-5047`) vs. browser `speechSynthesis` (`sysSpeak`, `5048-5056`):** the app already documents and handles the real-world gap well — Gemini TTS requires Google Cloud Billing (`vcSpeak`'s error-mapping at `5063-5069` distinguishes 429/quota, 403/billing, 404/model-not-found with tailored Hebrew+English messages) and falls back to system voice automatically (`5070`, `5072`). Caching is sensible (`gemCache`, keyed by `clean+gemVoice()`, capped at 40 entries, `5038`). One robustness note: `gemCache` is a plain in-memory `Map` (`5004`) with no size-bytes bound, only entry-count — long/unusual TTS strings (e.g., a full Diagnose answer) could each hold a multi-second `AudioBuffer`; capped at 40 entries this is bounded but not small, worth a size-aware eviction if voice answers grow longer.

---

*Cross-references: `docs/ai-strategy.md`, `docs/ai-trust-wave1.md` (Wave 1 plan, shipped v214-v219 per `git log`), `ai-prd.md`, `ai-implementation-plan.md`, `docs/analysis/2026-07-22-discovery-sweep-roster.md` (this sweep's Axis 8 brief).*
