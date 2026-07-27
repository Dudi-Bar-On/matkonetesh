# Gap status — bands 3.C (Orchestrator & workflows), 3.D (Equipment-to-plan), 3.E (AI)

Read-only synthesis. Source of gaps: `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §§3.C–3.E (lines 498–551).
Status grounded in: `CHANGELOG.md` v261–v272, `docs/analysis/2026-07-22-audit-orchestrator.md`,
`docs/analysis/2026-07-22-status-and-gaps.md`, and code probes against `app.js` / `worker/index.js` / `build.py`.
Subsystems (S1–S11) and phases per `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` §2.1 / §4.

**Band counts.**
- **3.C Orchestrator & workflows (12):** CLOSED 0 · PARTIAL 0 · OPEN 12 · WAIVED 0. (C3 has an interim R5 mitigation shipped v263, but the gap — cross-event *allocation* — is unbuilt.)
- **3.D Equipment-to-plan (11):** CLOSED 1 (D3) · PARTIAL 3 (D4, D10, D11) · OPEN 7 (D1, D2, D5, D6, D7, D8, D9) · WAIVED 0.
- **3.E AI (16):** CLOSED 6 (E1, E2, E3, E4, E7, E8) · PARTIAL 2 (E9, E12) · OPEN 8 (E5, E6, E10, E11, E13, E14, E15, E16) · WAIVED 0.

---

## 3.C · Orchestrator & workflows

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| C1 | 3.C | S2 | Phase 3a solver 0% built (`orchestrate`/`movesForClash`/`applyMove`) | P8 (not started) | OPEN | `grep -nE "function orchestrate|movesForClash|applyMove|safetyGate" app.js` = 0 hits; audit-orchestrator P3A-7/8 NOT DONE; charter D1 (orchestrator last) |
| C2 | 3.C | S2·S5 | No AI proposer; `safetyDiff` gate not wired to any AI | P8 (not started) | OPEN | `grep -Ec "aiPropose|proposeMove|planMove|aiOrchestrat|safetyGate" app.js` = 0; audit P3A-12 NOT DONE |
| C3 | 3.C | S2·S3 | Cross-event resource allocation does not exist; only raw smoke-window time-overlap | P9 (after P8); R5 interim in P0 | OPEN | status-and-gaps §B.4; charter R5/P9. Interim: false cross-event warning neutralised for unconfigured kit (CHANGELOG v263). `combinedEventsRows` gained occupancy-based *detection* (audit OCC-9) but no allocation |
| C4 | 3.C | S2·S3 | Placer searches on whole-device `usableCm2`, not `perSlot`; volume stages early-return slack 0 | P5a/P8 | OPEN | `schedulePlacements` (app.js:3860), `_windowFits` (3844) unchanged in shape; no fix in v261–v272 |
| C5 | 3.C | S2 | Non-uniform slack set silently discarded (`uniq.length!==1` guard) | P5a/P8 | OPEN | scheduler-internal advisory path unchanged; not addressed in CHANGELOG |
| C6 | 3.C | S2 | Advisory recommends a "cook in batches" feature that does not exist | P8 | OPEN | no batch feature; unchanged |
| C7 | 3.C | S2·S10 | `SCHED_PULL_MAX_MS` has no UI / no explanation | P8/P7 | OPEN | constant-only; unchanged |
| C8 | 3.C | S2·S10 | User cannot influence stage durations, shelf assignment, preheat, or method from work-plan view | P7/P8 | OPEN | no override affordances shipped v261–v272 |
| C9 | 3.C | S10 | Work Plan opens ~2.1 screens above "now"; nothing scrolls to `.wp-next` | P7 (product surface) | OPEN | UI/product; no scroll-to-now fix in CHANGELOG |
| C10 | 3.C | S8·S10 | Voice-cook jump list drops the day marker (`fmtClock` vs `fmtClockRel`) | P7 | OPEN | not addressed; v270 only relabels the speech-language button |
| C11 | 3.C | S3·S10 | Occupancy view orders empty devices above the occupied one | P7 | OPEN | narrow residual; no ordering fix in CHANGELOG (occupancy honesty ladder addressed fit-verdict, not device order) |
| C12 | 3.C | S10 | Live Copilot is the thinnest surface (~430px empty); no serve countdown/temperature/other timers | P7 | OPEN | product surface; unchanged |

---

## 3.D · Equipment-to-plan

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| D1 | 3.D | S2·S3 | `choosePlate`/`chooseNozzle` built+tested, called from nowhere in production | equip consumption (post-E3, unsched)/P8 | OPEN | defined app.js:3785/3795, **no callers** (`grep -nE "choosePlate|chooseNozzle"` = defs only); audit CONS-11/13, PROP-13 NOT DONE |
| D2 | 3.D | S3 | 14 device properties read for display (chips) only; none feeds planning/occupancy/safety | P5b | OPEN | audit PROP-8 (most of ~20 props have zero consumers); chips at app.js:6389-6398; unchanged |
| D3 | 3.D | S3 | Two cooking-area form fields (`#eqvArea` + `#eqProp-areaCm2`); only one drove the engine | **E1 (v263)** | **CLOSED (v263)** | CHANGELOG v263 "two cooking-area fields collapsed into one canonical metric field"; single `areaCm2` core prop (app.js:37/82/93); no `#eqvArea` residue |
| D4 | 3.D | S2 | `equipPlan` seam narrow; cook stages carry no equipment-specific instruction | P5a/P8 | PARTIAL | `equipPlan` shipped (app.js:973-986, sets `fuelNote`/`refuelEveryMin` only); audit CONS-1 PARTIAL, D4 "what holds: cook stages carry no equip instruction" |
| D5 | 3.D | S3 | Occupancy demand ignores guest count and piece count (`footprint_cm2` static) | P5b (owner-raised) | OPEN | `footprint_cm2` static (app.js:494); `rawGramsFor` per-guest exists but only for the shopping/menu list (app.js:3352/3363/3371), not for `itemOccupancy` demand |
| D6 | 3.D | S3 | Probe-channel budgeting is a footer count only; no BLE | equip consumption (unsched) | OPEN | `probeChannels` 2 hits (def + footer 6425); `navigator.bluetooth`/`requestDevice`/`GATT` = 0; audit CONS-18 NOT DONE |
| D7 | 3.D | S2·S3 | Charcuterie Slice B 0% — cylinder loads, vacuum liquid-seal warn, grind-plate matching | equip Slice B (unsched) | OPEN | audit CONS-10/11/13/14 NOT DONE |
| D8 | 3.D | S2 | Warm-up is smoker-only; no bath come-up, grill chimney, or oven preheat task | P5a/P8 | OPEN | audit CONS-4 / D2 NOT DONE (`earliestSmoke` filters `kind==='smoke'`). v267 wood-load advisory is flavor, not preheat |
| D9 | 3.D | S2·S3 | `grz` grill zoning on 118/130 cuts has exactly one consumer (grill summary line) | P5a/P8 | OPEN | audit W1-E C15; nothing in scheduler/plan/occupancy reads `grz`; unchanged |
| D10 | 3.D | S2 | Pellet/electric owner still sees "🪵 wood: oak" on the smoke task itself | P5a/P8 | PARTIAL | audit CONS-7 PARTIAL: refuel wording device-aware (`equipPlan`→`fuelNote`), smoke task's own fuel line still reads recipe `wood`/`coal` (app.js ~5826). v267 wood-load advisory added, does not suppress the line |
| D11 | 3.D | S3 | "✓ everything fits" is the fall-through for an empty device | P5b | PARTIAL | occupancy Phase 2 honesty ladder reworked the grate fall-through (explicit "NOT fall through to ✓ everything fits" guard, app.js:801-810; `out.fit` default handling); specific empty-device path materially changed but the fall-through class not fully certified closed |

---

## 3.E · AI

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| E1 | 3.E | S5 | Text model `gemini-2.5-flash` shuts down 2026-10-16; every AI feature routes through it | **P1 (v261)** | **CLOSED (v261)** | CHANGELOG v261 migration text→`gemini-3.6-flash`, TTS→`gemini-3.1-flash-tts-preview` via model registry; 2.5-flash commented out (app.js:5087/5090, legacy at 5095) |
| E2 | 3.E | S5 | `google_search` attached unconditionally (COGS + injection surface #3) | **P0-app (v262–v263)** | **CLOSED** | `searchFor('ask',!!ctx)?[{google_search:{}}]:undefined` (app.js:5255) + `searchFor('vcAsk',!!ent)` (6551); comments "P0-app item 3: search only when local grounding is empty" |
| E3 | 3.E | S9 | No CI at all; `package.json` test script an error stub | **PRE-2** | **CLOSED** | `.github/workflows/` has `test.yml` + `eval.yml`; `package.json` `"test": "playwright test"` (not a stub) |
| E4 | 3.E | S5 | Grounding validators (`aiValidateKeys/Items/Seasonings`) untested | **PRE-5** | **CLOSED** | `tests/ai-validators.spec.ts` exists (`grep -rl` now returns it) |
| E5 | 3.E | S5 | `aiConfirmPanel` not the universal contract; seasoning recommender writes state directly | P8 precondition | OPEN | `aiConfirmPanel` still 3 sites; `[data-seasadd]` click → `cwApplySeasKind` directly (app.js:10250-10253), bypassing the panel; audit R6 pattern unchanged |
| E6 | 3.E | S5 | Managed→BYOK fallback is silent (no toast/state change on 401/402/403) | P0/P1 | OPEN | app.js ~5231: `if(mode==='managed' && [401,402,403]... && gemKey()){ return gemFetch(...{key:gemKey()}); }` — still no toast/state change |
| E7 | 3.E | S5 | Managed-AI users never reach the guaranteed-Hebrew Gemini voice | **P0-app (v263)** | **CLOSED (v263)** | CHANGELOG v263 "Voice replies route through managed AI correctly — TTS works for managed-access users"; `vcSpeak` now gates on `aiAvail()` "P0-app item 4: a managed-only user must reach Gemini TTS" (app.js:6210-6214) |
| E8 | 3.E | S5·S6 | TTS silently bills the owner (routes to Worker unmetered) | **P0-app (v263)** | **CLOSED (v263)** | v263 made managed TTS intentional (E7) + added per-call usage metering `gemNoteUsage` "P0-app item 7" (app.js ~5231). NB: worker-side bounded/debit-first cap is E14 / P0-worker, not shipped |
| E9 | 3.E | S7 | MT hydration uncapped leak; cache stops persisting >3000 entries | P6 | PARTIAL | build-time localization overhaul (CHANGELOG v268–v270: ~1,300 strings unified, build-time coverage guard, ~740 data values baked) removes the runtime re-run driver; but the >3000-entry persistence cap code still present (app.js:8712) |
| E10 | 3.E | S5 | `aiJSON` makes 2 billed attempts on HTTP-200-empty-candidate | P1/P5 | OPEN | `aiJSON` (app.js:5478); v271 raised output budget (truncation) but the empty-candidate retry cost is unaddressed |
| E11 | 3.E | S5 | No constrained decoding (`responseSchema`) | P1/P5 | OPEN | `grep -nc responseSchema app.js` = 0; only `responseMimeType:'application/json'` |
| E12 | 3.E | S5 | User free text concatenated into prompts with no delimiting/sanitization | P0-app | PARTIAL | spoken-safety guard layer strengthened (CHANGELOG v262 numeric/unit guard, redaction) — the "enforcement" E12 names — but the raw concatenation itself is unchanged |
| E13 | 3.E | S7 | `vcSpeak` TTS error detail strings are Hebrew-only | P6 | OPEN | app.js:6218-6221 — four `if(...) m='<bare Hebrew literal>'` inside the `.catch`; only the envelope uses `L(...)` (6222); not swept into the unified translatable path |
| E14 | 3.E | S6 | Worker security posture dev/beta; CORS `*`, no rate limit, health leaks `hasKey`, shareable bearer code, `cap:0` unmetered | **P0-worker (not shipped)** | OPEN | `worker/index.js:21` CORS `'*'` "tighten for production"; `:39` health returns `hasKey`; no rate-limit code |
| E15 | 3.E | S9 | No CSP / security headers while Gemini key lives in `localStorage` | P0/P7 | OPEN | `build.py:636` `_headers` writes only `Cache-Control`; no CSP/HSTS/X-Frame |
| E16 | 3.E | S9·S10 | AI hub lists 5 of 14 features (discoverability) | P7 | OPEN | `AI_TOOLS` unchanged; no CHANGELOG entry |
