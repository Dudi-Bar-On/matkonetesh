# Warm-page flake — panel synthesis and verdict

**Date:** 2026-07-24 · **Inputs:** `flake-panel-architect.md` (acf36f8) · `flake-panel-evidence.md`
(55520f1) · `flake-panel-research.md` (2d0ab72) · partial sweep `sweep-logs/w24.log` · 22 monitored
campaign runs (`m1b-capacity-probes-2026-07-23.md`) · preserved Cert-Run-5 traces.

## The verdict — a run-start cold-parse stampede with a self-amplifying restart cascade

**Mechanism (each link evidence-backed):**
1. **At run start, all N workers simultaneously** spawn browsers and execute their ONE cold parse of the
   2.7 MB inlined app (p50 2.15 s, max 4.9 s **on an idle machine** — W0). N simultaneous cold parses on
   8 P-cores collide.
2. **The first-scheduled spec absorbs the stampede.** `active-hub.spec.ts` is alphabetically first with
   9 tests vs 8 workers — *every worker's first navigation lands there* (B). Its seeds apply in <15 ms in
   every trace — it is not "heavy", it is **first**. Under stampede coincidence those first navs blow the
   15 s navigationTimeout: Cert-Run-5's 8 failures cluster in a **342 ms window, 4.7 s after run start** (B).
3. **The kill makes it worse — the cascade.** A nav-timeout fails the test → Playwright kills that worker →
   the replacement re-enters with ANOTHER full cold parse → the stampede re-feeds itself (A's amplifier,
   confirmed by the cold-goto-timeout signature at `_fixtures.ts:50` and by failures spreading to later
   files in the worst runs).
4. **Whether a run survives is scheduling luck** → the observed ~50%-clean bursty distribution at 8-12
   workers, and the guaranteed collapse at 20-24 (stampede width ∝ workers; sweep + campaigns).

**Confirmed contributors (real, not the driver):**
- **V8 compilation-cache eviction on alternate reloads** — perfect 141 ms ↔ 1915 ms alternation across 60
  isolated navigations, server time identical (C; V8 source: `MarkCompactPrologue()` ages the script
  cache). Raises steady-state reload cost ~2× on odd reloads; sub-2 s, so not the 15 s killer.
- **Renderer heap growth ~2.5 MB/reload, no plateau** (A, tracing-off) — a REAL app-side leak worth its own
  investigation, but B found **no late-run failure pattern**, so at today's suite length it is not the
  flake driver. Filed as an app bug lead.
- **Worker-lifetime tracing + teardown CDP** (`clearCookies`) — teardown timeouts observed alongside nav
  failures (C); a compounding stressor; B's "one shared gate releasing" 29 ms teardown convergence fits a
  CDP/event-loop gate under the same stampede.

**Refuted (by measurement, not opinion):** server head-of-line / Node backpressure and Defender/thermal
per-reload theories — `responseEnd` identical on fast vs slow reloads (C). "Heaviest-spec" theory —
seeds < 15 ms (B). "Disturbance" theory — 12 gates, all clean (C-rerun campaign). "P-core oversubscription
as steady-state ceiling" — already corrected in L21.

**What we got wrong along the way (kept honest):** 'load'→DCL was necessary but not the flake; the 60 s
navTimeout was dead config; P-core-fitting treated a contaminated sample as a mechanism; the heap-aging
ignition story (A) was plausible but B's start-of-sequence evidence demotes it. Four mis-diagnoses before
instrumentation settled it — the §10.14/§11a instrument-first discipline is the only reason this converged.

## Fix options (for the owner)

| # | Fix | Mechanism attacked | Cost | Risk |
|---|---|---|---|---|
| F1 | **Stagger the cold parses** — per-worker warmup offset (e.g. `parallelIndex × ~700 ms`) or a 2-3-slot semaphore around the ONE cold goto in `warmPage` | Kills the stampede at its source (the owner's own "pre-warm phase" idea from the original brief) | ~10 lines in `_fixtures.ts` | Adds ≤ N×0.7 s to run START only (~5 s at 8 workers) — steady state untouched |
| F2 | **Cold-goto headroom** — the worker-setup goto gets its own generous timeout (e.g. 28 s < 30 s test ceiling); warm reloads keep 15 s | Absorbs residual coincidence + breaks the kill→cold-parse cascade | 1 line | A genuinely hung first nav surfaces 13 s later than today |
| F3 | **Trace-off A/B campaign** | Quantifies the tracing/teardown compounding | 1 campaign (~15 min) | none — measurement only |
| F4 | App heap-leak hunt (2.5 MB/reload) | The long-term health item | separate task (app-side, Serena-ready) | — |

**Recommendation:** F1+F2 together (surgical, attack ignition AND amplifier), then a 7-run certification
campaign at workers:8; F3 optional after; F4 filed into the gap program. No change is final until the
owner declares it on campaign results.
