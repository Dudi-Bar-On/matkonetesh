# Agent returned summaries — verbatim

Each agent writes a full report file in this directory AND returns a compact summary to the controller.
Those returned summaries are recorded here **verbatim**, because a summary can carry a verdict or caveat
phrased differently from the report file. Nothing is paraphrased in this document.

Controller corrections (where a claim was independently verified and found wrong) are added as clearly
marked `> CONTROLLER:` notes beneath the relevant summary — the original text is never edited.

---

## W1-H · Probe & sous-vide telemetry feasibility
**Completed:** 2026-07-22 · **Report:** `W1-H-probes.md` · **Cost:** ~134k tokens, 40 tool uses

**Browser-BLE verdict:** Web Bluetooth works today on Android Chrome/Edge/Samsung Internet and desktop Chromium (proven with a live BBQ-probe demo), but is completely absent on iOS/iPadOS Safari with no Apple roadmap — hard platform wall, not a version gap. Even on Android, a backgrounded/screen-off tab cannot reliably hold a GATT connection for a 12+ hour cook; this is a page-lifecycle limit, not a fixable bug.

| Vendor | BLE spec | Cloud API | Verdict |
|---|---|---|---|
| Meater | reverse-engineered only | **Yes (official beta)** | Cloud API, not BLE |
| ThermoWorks | none found | none (CSV export only) | Neither — log-import only |
| Inkbird | reverse-engineered per-model | none (CSV export) | Neither — log-import |
| Combustion Inc | **Yes, open MIT-licensed spec** | no | Best case for direct BLE |
| Govee | reverse-engineered advertisements | none (CSV export) | Neither — log-import |
| Weber Connect | none (WebSocket, encrypted) | none (CSV export) | Neither — log-import |
| Anova | **Yes (WiFi models)** | **Yes, official, open to all** | Best case overall — BLE + cloud |
| Joule | Bluetooth for pairing only | none found | Neither |

**iOS blocker:** absolute for native Web Bluetooth; only workaround is Bluefy, a niche third-party iOS browser bridging to CoreBluetooth — real but poor UX, unclear if it works with an installed PWA.

**Staged recommendation:** (1) log-import first — CSV upload from vendor apps (ThermoWorks/Weber/Govee/Inkbird all export it), works identically on iOS/Android, zero new permissions; (2) Anova cloud API for WiFi sous-vide models — plain HTTPS, no Bluetooth, works on iOS too (pending a CORS check, likely needs a thin proxy); (3) MEATER Cloud REST API, same shape, officially beta; (4) Web Bluetooth live readings via Combustion Inc's open GATT spec, scoped explicitly as Android/desktop-only, screen-on, not a background/unattended feature.

> **CONTROLLER:** accepted as-is. This axis was feasibility research, not an audit — the app has no probe
> integration today beyond `probeChannels()` summing channels into a footer chip (app.js:229, ~6425), and
> `navigator.bluetooth` appears nowhere. The finding that materially changes product thinking: **live BLE
> cannot be the primary design** (iOS wall + no background GATT over a long cook), so log-import must be the
> baseline path and live BLE an Android/desktop enhancement. Anova's official open API is the one place
> live sous-vide telemetry is genuinely reachable on every platform.

## W1-F · AI surface
**Completed:** 2026-07-22 · **Report:** `W1-F-ai.md` · **Cost:** ~267k tokens, 48 tool uses

**Inventory:** 13 wired AI features (Ask-the-Fire, Live Copilot Q&A, Voice Cook Q&A, recipe-gen, diagnose, journal insights, what-can-I-make, pantry advisor, event planner, seasoning rec, equipment lookup, photo analyzer, data-MT translation) — none dormant, all reachable from real UI. `app.js:334` still ships "הנתונים מקומיים, ללא חיבור לרשת" (local, no network) — conflicts with the online-first decision; same claim repeated at `app.js:3931,3939` and `README.md:3`.

**Unguarded call path:** Voice Cook hands-free Q&A (`vcAskAI`/`vcAskFlow`, `app.js:5269-5300`) is a fourth, separate free-text Gemini caller with `google_search` on — zero `askRefuse`, zero `SAFETY_FACTS` grounding, zero `aiSafetyNote`/`aiSafetyCaveat`, and the raw answer is both displayed and **spoken aloud** with no caveat in either channel. Confirmed by exhaustive grep: the caveat/note functions appear at exactly 5 render sites in the whole file, and this isn't one of them. Diagnose (`8475`) is a secondary, weaker gap — no `askRefuse`, only the ungrounded Tier-C `aiSafetyCaveat`.

**Top hallucination risks (ranked):** 1) Voice Cook spoken safety numbers (hands-free, zero guard) 2) Diagnose qualitative unsafe advice (no number → guard never fires) 3) Ask-the-Fire indirect injection via `google_search` (partially mitigated by numeric guard) 4) Copilot "what now" (has the numeric guard, missing refusal) 5) structured JSON features — well-contained, cure/salt numbers never asked of the model at all.

**Eval harness (3 lines):** mock-driven CI checks for grounding (assert `aiValidateKeys` drops invented keys), numeric fidelity (adversarial-mangled-number corpus against `mtSafe`/`aiUngroundedSafety`), and refusal recall (turn `docs/ai-trust-wave1.md`'s prompt list into an actual fixture file); plus a small periodic live-model batch for Hebrew-output script-leak detection, since that class needs real model runs.

**Orchestrator verdict:** `safetyDiff` (`app.js:3039`) is real and correctly shaped (diffs `kind`/`hours`/`temp`/`safe`, deliberately ignores `start`/`end`) but is currently only a self-check on the deterministic placement pass — no AI proposer exists (confirmed by grep). It's ready to gate one, provided the move vocabulary schema-excludes `hours`/`temp`/`safe` as targets up front (not just post-hoc-checks them) and inherits the `aiConfirmPanel` confirm-before-apply contract every other AI-writes-state feature already uses.

> **CONTROLLER — INDEPENDENTLY VERIFIED, finding CONFIRMED.** I re-checked the unguarded-voice claim by hand
> because it is safety-critical and two earlier auditors produced false alarms. It holds:
> `app.js:5269-5300` calls `gemFetch(GEM_MODEL, …)` with `tools:[{google_search:{}}]`, and the answer is
> spoken via `vcSpeak(answer, ansL)`. A grep of lines 5255-5310 returns **0** occurrences of `askRefuse`,
> `SAFETY_FACTS`, `aiSafetyNote` or `aiSafetyCaveat`, while those guards exist and are used elsewhere
> (`askRefuse` ×2, safety note/caveat ×8).
>
> **Why this ranks above every other open gap:** it is hands-free (the cook's hands are busy and they act on
> what they hear), spoken (no visible caveat, no source), web-grounded (indirect-injection surface), and
> live in v258 today. A wrong internal temperature spoken aloud mid-cook is precisely the harm the app's
> entire safety architecture exists to prevent. Recommend fixing before the sweep completes.

## W1-D · Non-functional (i18n/RTL, PWA, performance, a11y)
**Completed:** 2026-07-22 · **Report:** `W1-D-nonfunctional.md` · **Cost:** ~219k tokens, 67 tool uses

**Per-property verdict:** i18n/RTL — failing at scale for non-Hebrew users. PWA — update-delivery sound; install passive; docs contradict the model. Performance — large but mostly deliberate; one real uncapped runtime cost. Accessibility — good foundations, weak on custom widgets.

**Untranslated user-facing strings found: 56** — 55 of 56 toast() calls have no lang/en.json entry (only 1 works), plus a hardcoded-Hebrew wizard step counter (app.js:7166).

**10 highest-impact:** 1) 55/56 toasts untranslated. 2) The PWA "new version available" toast (app.js:9553) untranslated. 3) About copy claims "no installation... no server" (app.js:3929). 4) "No network connection" in the live footer of every screen (build.py:334), both languages. 5) reg.update() on load + visibilitychange with content-hashed SW caches correctly implemented; fixes the diagnosed "v255 reached the server but not the device". 6) No beforeinstallprompt/install CTA. 7) fr/de/es cover 83/3985 keys (2%), no item-description layer, no English fallback. 8) A full-document TreeWalker text scan fires ~4x/sec for the whole duration of a running cook timer when UI language is not Hebrew (app.js:9540 + 2338). 9) No minification in build.py for 882KB JS + 172KB CSS. 10) Occupancy-diagram and timeline widgets carry zero ARIA roles/live-regions.

Positives preserved: contrast fix on theme tokens, global !important :focus-visible, toast()'s aria-live="polite", debounced search, deliberate bidi-isolation in occ2. Browser-dependent claims dropped, not softened.

> **CONTROLLER — FINDING #1 IS FALSE. I ALSO GOT IT WRONG.**
> The toasts are covered. Measured against BOTH dictionaries (see `_toast-verification.txt`):
> lang/en.json 309 keys covers 1 toast; **lang/en.data.json 3,677 keys covers 48**. Combined coverage is
> **48 of 53 Hebrew toast literals — only 5 are genuinely missing**, not 55.
> W1-D checked only en.json. **I repeated the identical error in my own verification and reported
> "~98% untranslated" to the owner as verified.** W1-B independently got this right and proved it by
> running the app in English (copyText renders "List copied").
> LESSON: verifying against one artifact is not verification — the real lookup path must be traced. Third
> false alarm in this project's audits; the first one the controller propagated.
> The other nine W1-D findings are unaffected and stand pending Wave 2.

## W1-E · Food science, HACCP & citations
**Completed:** 2026-07-22 · **Report:** `W1-E-food-safety.md` · **Cost:** ~271k tokens, 70 tool uses

**HACCP verdict:** the architecture has the SHAPE of HACCP but only hazard-ID and limit-display are built. bcheck stages (app.js:3260-3261, 5815, 5993) are checklist reminders, not gates — no reading recorded, nothing blocks progression, no corrective action. Cure dosing (cureScaleGuardHTML, app.js:1849-1874) likewise: it warns of botulism risk but output is byte-identical whether it fires or not. safetyDiff() (app.js:3039-3052) is a genuine runtime invariant, but guards schedule corruption, not "did the user verify the temperature".

**Citation-chain integrity: VERIFIED SOLID** — 130/130 cuts, 47/47 specials, 102/102 makes carry a merged src block (279 total) via build.py:84-105. A prior document's "0 citations" claim is false — it grepped only data.py, missing the sources.py build-time merge. The agent nearly produced two false alarms itself (52 orphaned make-citations; "nduja has no cure") and disproved both by replicating the build pipeline.

**Real unresolved defect:** Kabanos (spec-10) — its own bundled citation (sources.py) flags "current says Cure #2 — WRONG per Marianski, cooked product -> Cure #1" and requires a 68-71C cook step. Never applied.

**Science claims: none disproved.** safe floors (63/71/74C) match USDA FSIS; ground meat correctly uses Baldwin's ground-as-slab table; bacon uses the bacon-specific 120ppm (9 CFR 424.22(b)). Lower confidence: foie gras/veal-brain/sweetbread safe=65C cites culinary blogs.

**8 gaps:** bcheck monitoring-only; cure guard advisory-only; kabanos cure type; 32/102 MAKE_SOURCES stale numeric calc.cure defused only by a build.py:96-98 skip; blog-sourced safe values; no pH/Aw measurement enforcement; tgt < safe unexplained in UI for 36 items; grill-zone direct/indirect out of scope.

> **CONTROLLER — partially verified.** The kabanos citation text in sources.py does discuss Cure #1 vs #2
> and a 68-71C internal cook. End-to-end confirmation of the SHIPPED values was blocked by a Windows cp1252
> encoding failure reading data.py; carried to Wave 2 rather than asserted. The citation-coverage result
> independently corroborates that the earlier "0 citations" alarm was false.

## W1-A · Code, line by line
**Completed:** 2026-07-22 · **Report:** `W1-A-code.md` · **Cost:** ~252k tokens, 84 tool uses

**Counts:** 8 prior claims re-verified as already fixed; 9 orphaned functions; 4 dead stubs; 2 built-but-unwired functions; 14 captured device properties with zero readers; 1 duplication finding; 5 fragility findings; 4 worker findings.

**Top 10:** 1) 483 typeof X==='function' guards (~1 per 20 lines) act as a de-facto module system — a broken wire-up silently no-ops instead of throwing, the same shape as the equipPlan/hooksOver inert-shipment failures, generalized codebase-wide. 2) worker/index.js:56 malformed KV record fails OPEN. 3) build.py:347-348 _js_str() does not escape the script-close sequence inside a live script tag. 4) build.py:334 footer hardcodes "no network connection". 5) app.js:9562 SW register catch swallows all install/update failures. 6) choosePlate/chooseNozzle unit-tested, zero production callers. 7) 14 device properties captured and never read. 8) "1 events" plural bug; no shared plural() helper. 9) worker/index.js:66 outbound Gemini fetch has no timeout. 10) 9 orphaned functions, one with a stale comment claiming test usage.

Positive: gemFetch/aiJSON and all 7 AI call sites are well-engineered — timeout/retry/backoff/JSON-repair/local-first fallback.

> **CONTROLLER — VERIFIED (security).** Read worker/index.js:48-60. The fail-open is real and worse than
> stated: a malformed record becomes {active:true}, which passes the disable check AND skips the quota cap
> (typeof rec.cap === 'number' is false). A corrupted KV record grants unmetered Gemini usage billed to the
> owner — material now that the product is online-first with paid tiers planned. No outbound timeout confirmed.

## W1-B · Spec-to-code conformance (largest specs, clause by clause)
**Completed:** 2026-07-22 · **Report:** `W1-B-conformance.md` · **Cost:** ~276k tokens, 56 tool uses

Ran 63 occupancy tests + 3 i18n tests live, plus a build.

**Counts:** Doc1 equipment-occupancy-layer (9 tasks): 8 DONE, 1 SUPERSEDED. Doc2 occupancy-view-phase2 (10): 10 DONE. Doc3 equipment-properties-completion (6): 5 DONE, 1 done-via-different-mechanism. Doc4 phase3a-slice1-prefs (6): 6 DONE. Doc5 equipment-2.0-slice-1a (6): 4 solid, 2 by inference. Doc6 i18n-foundation-phase0 (5): 4 DONE, 1 PARTIAL.

**4 contradictions:** 1) Doc1 Task 7 .occ-* bar markup vs Doc2 .occ2-* rewrite — documented supersession, but a reader of Doc1 alone would build dead code. 2) Doc3 Task 5 names const PROP_BOUNDS; shipped code reuses props[].bounds/propCoerce — same behaviour, better mechanism, but the plan's own named-symbol self-check fails. 3) Doc6 Task 3 specified wrapping ~22 toast() literals in L(he,en); instead they were added to lang/en.data.json and ride toast()'s dict lookup — **verified empirically live** (copyText in English renders "List copied"); the regression test was quietly rewritten post-ship to stop testing the specified scenario. 4) The chooseBath/choosePlate/chooseNozzle claim — verified true, traced to bb789aa.

**Top orphaned commitments:** grinder-plate and stuffer-nozzle "which to use" warnings (choosePlate/chooseNozzle exist, zero production callers); Doc1 Slice A preheat/fuel/refuel and probe-channel monitoring; Doc4 PREF_PRESETS and all 7 orchestrator knobs (0%, by design); Doc5 "Phase 3 auto-optimize + live" (no autopilot code); Doc6 voice-assistant fr/de/es (2% coverage, confirmed live).

> **CONTROLLER — this agent CAUGHT W1-D's error and mine.** Its contradiction #3 is the correct account of
> the toast mechanism, established empirically rather than by grepping a single file. Note also its finding
> that a regression test was rewritten post-ship to stop testing the scenario its plan specified — a process
> defect worth carrying into the program: a test may not be narrowed to fit the implementation.
