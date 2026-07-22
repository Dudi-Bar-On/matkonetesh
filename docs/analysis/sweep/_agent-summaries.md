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
