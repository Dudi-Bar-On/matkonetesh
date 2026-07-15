# Wave 2 — Live Cook Copilot (design & build plan)

The flagship: *the pitmaster on your shoulder.* A live session for one cook that drives the timers, detects the stall, takes a probe reading and says on-pace/behind + an ETA, recomputes when you're running late, and does it hands-free by voice. Scope (owner-approved): **coach + adaptive + voice.**

## Principles
- **Local-first.** The core — stages, timers, stall detection, pace/ETA — works with **no API key** (deterministic from the vetted data). AI only *enriches* the "what do I do now?" guidance when a key exists.
- **Rides Wave 1.** Every AI answer goes through the trust stack (grounding, numeric guard, refuse, caveat) — the copilot can never hand you an unsafe number.
- **Reuse, don't duplicate.** Build on the existing timer engine, `itemStages`, the backward scheduler, and the voice stack (infra map confirmed). One genuinely new subsystem: probe capture + pace/ETA math.

## Session model (the one new store key)
`mk-cook-live-<scope>` = `{ startedAt, key, method, order, ready, targetC, serveTs, probes:[{t,tempC}], wrapped }`. Keyed per `evScope()` like `mk-plan-started-<scope>` / `mk-tlstate-<scope>`, so `_liveCookState()`, the `#cCooking` banner, and the Active-now hub pick it up with the same scan pattern — zero extra wiring. Stage timers stay the existing `st-<scope>-<itemKey>-<kind>` records in `mk-timers`.

## How each capability maps to existing infra (from the infra map)
- **Stages + schedule:** `itemStages(meta, method, ready, order)` (app.js:2126) + the backward-schedule loop (buildList app.js:4307-4312). Target internal from `donenessTarget`/`safe`/`tgt`.
- **Timers:** create/drive via `timerHTML`+`wireTimer`+`_timerSet` with the `st-<scope>-…` ids → auto-appears in `openActive`, `#cCooking`, the alarm overlay, `_liveCookState`/`is-cooking`. `wireTimer`'s `warnSec/onWarn/onEnd` = ready-made spoken-alert hooks.
- **Stall/wrap content:** already authored — the rescue strings (app.js:2677-2678), the cut's `somid` wrap-at-temp via `soTreatText` (app.js:643), the glossary. Copilot just *selects* it.
- **Adaptive recompute:** the "reschedule from now" logic already exists in `renderPlanStartRow` (app.js:4239, shift serve so earliest→now); multi-event via `combinedEventsRows`.
- **Voice:** reuse `openVoiceCook`, `vcSpeak`/`gemSpeak`, `vcAskFlow`/`vcAskAI`/`vcBuildAskPrompt`, `vcToggleMic`. The single seam to widen is `vcCookContext()` (app.js:4041) — inject elapsed time, last probe, on-pace/behind, ETA so the existing voice Ask answers with full session awareness.

## The new subsystem — probe → pace → ETA
- **Owner's probe gear (design around it):** **MEATER Pro XL** (wireless; MEATER app + Cloud/Link + BLE), **Inkbird latest probe** (app), **Inkbird ISV-300W sous-vide** (app). Both Inkbird products have apps; MEATER has app + cloud.
- **Capture:** a "log probe reading" input (°C, auto-timestamp) → appended to `probes[]`. **Manual entry first** — device-agnostic, works with all three today (read the value off the MEATER/Inkbird app, type it in). **Follow-on (later increment):** Web Bluetooth live reads from MEATER/Inkbird (Chrome PWA supports it, keeps offline model) and/or app CSV export import. The ISV-300W is a set-temp circulator, so **sous-vide stages are time-at-temp, not a ramp** — the pace/ETA math applies to the smoke/roast ramp stages, while SV stages just track the held-temp duration.
- **Pace:** from the last ≥2 readings fit a local rate (°C/h). Expected finish = now + (targetC − lastTemp)/rate. Compare finish vs (serveTs − restMin): **on-pace / behind / ahead**, with a fix ("bump the pit / wrap now / plan a longer rest / push serve +30").
- **Stall detection:** rate ≈ 0 while lastTemp is in the 65–77 °C band → surface the stall card (existing content) + the crutch option.
- **Honesty:** ETA shows a ± band from rate variance; with <2 readings it says "log another reading to project a finish time." Never fabricates.

## Phased build (each shippable + Playwright-tested, HE+EN, suite green, review the new-math + voice phases)
- **W2-P1 — Session shell.** `mk-cook-live-<scope>` lifecycle (start/stop), `openCopilot()` panel showing current+next stage and the live stage timers (reused). Start entry point (see decision). Local-only.
- **W2-P2 — Stall detection + wrap/crutch advice.** Deterministic stall detection from probes/elapsed → select + show the existing stall/wrap content (grounded, Wave-1-guarded).
- **W2-P3 — Probe check-in → on-pace/behind + ETA.** The new capture + pace + ETA math + the fix suggestions. The headline moment.
- **W2-P4 — Adaptive recompute.** "Running late / serve moved / ahead" → recompute the plan + timers (reuse renderPlanStartRow + the scheduler; multi-event via combinedEventsRows).
- **W2-P5 — Voice copilot.** Widen `vcCookContext` with the session verdict/ETA; proactive spoken stall + stage alerts via the timer hooks; reuse the voice panel + mic router.
- **W2-P6 — "What do I do now?" AI advisor.** One grounded AI call over the full session state (stage, elapsed, probe, pace, ETA, stall) → actionable guidance, Wave-1-guarded, with a deterministic local fallback when no key.

## Decisions (owner-locked 2026-07-15)
1. **Start from the work-plan + home banner** — "▶ Start live cook" on the work-plan (next to the voice-cook launch), and once a session is live the home `#cCooking` banner opens the Copilot.
2. **Voice folded into the existing voice-cook panel** — the copilot is "voice-cook + session awareness"; widen `vcCookContext`, reuse the panel/mic/ask flow.

Everything else is engineering on top of existing infra (autonomous). Acceptance per phase: RTL+LTR @390px, HE+EN, no Hebrew leak, suite green (with the load-flake retry caveat), review pass on P3 (new math) + P5/P6 (voice/AI).
