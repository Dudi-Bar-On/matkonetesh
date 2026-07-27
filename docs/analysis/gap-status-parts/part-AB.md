# Gap status — Band 3.A SAFETY + Band 3.B CORRECTNESS

**Source of gaps:** `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §3.A (lines 323–342) + §3.B (lines 343–497).
**Status verified against:** CHANGELOG v261–v272, code (`app.js`, `worker/index.js`, `serve.js`, `build.py`, `data.py`, `sources.py`) at HEAD, and the three 2026-07-22 analyses. Every verdict is grounded in a cited line; none guessed.

**Counts — Safety (A1–A15): 15 gaps — 4 CLOSED, 3 PARTIAL, 8 OPEN, 0 WAIVED. Correctness (B1–B31): 31 gaps — 2 CLOSED, 1 PARTIAL, 28 OPEN, 0 WAIVED.**

## 3.A · SAFETY

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| A1 | Safety | S5 | Voice Cook Q&A (`vcAskAI`) was unguarded spoken web-grounded AI | P0-app | **CLOSED v262** | `vcAskFlow` now calls `vcGuardSpoken(answer,tiers,ansL)` before speaking (app.js:6571); `google_search` conditional via `searchFor('vcAsk',!!ent)` (6551). CHANGELOG v262 spoken-safety hardening. |
| A2 | Safety | S5 | `vcTranslateToEn` translated+spoke recipe content with no guard | P0-app | **CLOSED v262** | `vcSpeakContent` gates on `vcTransSafe(text,en)` value+unit-class set-compare; fail → speaks Hebrew (app.js:6364-6375). CHANGELOG v262 "voice-translation gained a numeric guard". |
| A3 | Safety | S5 | AI numeric guard unit-blind (74°F matched 74°C grounding) | P0-app | **CLOSED v262** | `aiSafetyToC(n,unit)` converts F→C before compare (app.js:5418-5421); `aiUngroundedSafety` runs on normalized values (5451). CHANGELOG v262 "Fahrenheit … no longer misread as Celsius". |
| A4 | Safety | S5 | Diagnose has no refusal gate nor vetted grounding | P0-app/P3 | **OPEN** | No release adds `askSafetyIntent`/`SAFETY_FACTS()` to the diagnose grounding builder; not in CHANGELOG v261–272. |
| A5 | Safety | S2 | Thermometer refuse-to-schedule + cure task must BLOCK (not warn) | P2 | **PARTIAL** | Thermometer admission built in E3 v266 (internal-temp recipes require a probe; add-to-plan blocked). Cure BLOCK NOT built — `cureScaleGuardHTML` still returns an advisory `<div>`, dose printed regardless (app.js:2585-2609, 2652-2656). |
| A6 | Safety | S2 | `bcheck` ticked but the numeric reading never recorded | P3 | **OPEN** | Task is a plain checkbox `data-wpck` (app.js:7258-7260); bcheck stage carries a target temp but no numeric input (4058). P3 "record the reading" not shipped. |
| A7 | Safety | S2 | `safetyDiff` computed but never surfaced to the user | P3 | **OPEN** | Only writes `window._planSafetyViolations` (app.js:6983,6989); no reader anywhere. Comment still claims "surfaced" (6981-6982). P3 not done. |
| A8 | Safety | S7 | Alarm banner + OS notification Hebrew-only in every language | P6 | **OPEN** | Banner heading + `aria-label='טיימר הסתיים'` + per-row `🔕 עצור` hardcoded (app.js:3160-3162); notify text hardcoded (3139). Only "Stop all" localized (3163). |
| A9 | Safety | S8 | `addDays()` lost a day across spring DST | P0-app | **CLOSED v263** | Rewritten all-UTC: `Date.UTC` parse + `setUTCDate`/`getUTCDate` + `toISOString` (app.js:3553-3558). CHANGELOG v263 "Date math is now DST-proof". |
| A10 | Safety | S1 | Kabanos (spec-10) cure type contradicts its own citation | P4 | **OPEN** | Still `cure="…Cure #2"` and `smt=50` cold-smoke (data.py:152); `sausage_dry("…","Cure #2",…)` (data.py:490). Citation says Cure #1 + cook to 68-71°C. |
| A11 | Safety | S1 | 18 researched salt overrides computed, "APPLIED", silently discarded | P4 | **PARTIAL** | Silent-clobber hazard fixed — build now explicitly ignores sources' `calc` with an honest comment (build.py:96-102, "Wave 0 safety fix"). But the 18 researched values are still NOT applied — reconciliation deferred to "Wave 2b / T6". |
| A12 | Safety | S5 | Guard/caveat text never reaches speech | P0-app | **PARTIAL** | The voice-ask path is now guarded in speech via `vcGuardSpoken` (A1, v262). But the 5 visual guard sites (cure-scale etc.) still emit HTML only and never feed TTS. |
| A13 | Safety | S5 | Model output reaches `innerHTML` unescaped | P0-app/P3 | **OPEN** | `padvRender` reason still `<div class="pp-desc">${r.reason}</div>` with no `esc()` (app.js:10060); sibling seasoning path IS escaped (10240), so inconsistent, flagged path unfixed. |
| A14 | Safety | S1 | Three offal `safe` floors sourced to culinary blogs (65 vs 72°C) | P4 | **OPEN** | Goose Liver `safe=65` (data.py:80), Veal/Lamb Sweetbreads `safe=65` (81,82) — unchanged; USDA-cited comparator is 72 (78,79). Data Correction Gate item, no owner sign-off recorded. |
| A15 | Safety | S5 | `hebSpeechText` has no `%` and no pH/aw spoken rule | P0-app | **OPEN** | No `%`/pH replacement added to the speech-text ruleset; not in CHANGELOG v261–272. |

## 3.B · CORRECTNESS

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| B1 | Correctness | S3 | Three different capacity rules for one device | P5b | **OPEN** | One capacity verdict is P5b, "ships only after the before/after review (D6)"; not built. v266 E3 "capability-aware serving" touches sufficiency, not the 3-rule unification. |
| B2 | Correctness | S2 | Serve time — three surfaces, 3.5 h apart | P5a | **OPEN** | Plan-pipeline extraction (P5a) not started; `mk-tlserve` global never written back to `ev.serve`. |
| B3 | Correctness | S2 | Multi-day items blocked in one view, scheduled in the other | P5a | **OPEN** | `combinedEventsRows` still has no multi-day/`blocked` concept. P5a not started. |
| B4 | Correctness | S2 | Only the vertical plan shape can be ticked | P5a | **OPEN** | Three renderers dispatched (app.js:7250-7252); checkbox key logic lives only in `renderWpVertical` (7258-7260). No evidence accordion/horizontal gained checkboxes. |
| B5 | Correctness | S3 | Advisory vs clash banner disagree by construction | P5b | **OPEN** | `_plcConflicts` pre-shift vs `cookerContention` post-shift under different rules; unchanged. P5b not built. |
| B6 | Correctness | S3 | Combined view calls every clash "Smoker" | P5b | **OPEN** | Hardcoded `חפיפת מעשנה` / "Smoker overlap" persists (app.js:9764). P0 R5 interim only neutralized the no-equipment false warning (CHANGELOG v263), not the mislabel. |
| B7 | Correctness | S3 | Bath advice contradicts the occupancy model | P5b | **OPEN** | `_svBatch` Math.max with no litre check vs `deviceOccupancy` pctFloor; unchanged. P5b not built. |
| B8 | Correctness | S2 | Rendering the plan writes user state | P5a | **OPEN** | `buildList` still assigns `st.method`/`st.stage`/`st.ready` then persists. P5a not started. |
| B9 | Correctness | S2 | Window-global singletons in a parallel-events app | P5a | **OPEN** | `_wpTasks`/`_wpCtx`/`_plcConflicts`/`_wpServe`/`_planSafetyViolations` still window-global. P5a not started. |
| B10 | Correctness | S4 | `cardSess` keyed by item only, shared across events | P5b | **OPEN** | Keyspace schema is P5b; unchanged. |
| B11 | Correctness | S3 | `cookerFor` conflates "no gear" with "needs a pick" | P5b | **OPEN** | `null` at both branches; unchanged. |
| B12 | Correctness | S4 | `store.set` return ignored; success reported unconditionally | P5b | **OPEN** | No evidence the `toast('נרשם ✓')` path now checks the boolean; not in CHANGELOG. |
| B13 | Correctness | S4 | Checkbox keys are the translated label (lang switch wipes ticks; refuel rows collide) | P5b | **OPEN** | Key still `'wpck:'+sc+':'+tk.label` on the translated label (app.js:7258). One task identity is P5b, unbuilt. |
| B14 | Correctness | S2 | ⚡ card toggles don't reach the plan outside a project | P5a | **OPEN** | `activeMethods` still reads only `store.get('method:…')`, never `cardSess`; unchanged. |
| B15 | Correctness | S2 | Copilot reserves no rest and follows the wrong event | P5a/P8 | **OPEN** | `restMin` still never written to the session shape; unchanged. |
| B16 | Correctness | S2 | Timers are stopwatches, not schedule-aware | P5a | **OPEN** | `wireTimer` still counts from the ▶ press; no reconciliation with plan clock. Unchanged. |
| B17 | Correctness | S7 | `"1 events"` — no plural helper | P6 | **OPEN** | `${list.length} ${L('אירועים','events')}` with no singular branch (app.js:9787,9824). No `plural()` helper exists. |
| B18 | Correctness | S8 | `today()` returns UTC date; `isoDate()` returns local date | P5b | **OPEN** | `today()` UTC via `toISOString` (app.js:3547); `isoDate()` local via getFullYear/Month/Date (6803). Divergent. (A9 DST fix is a separate, closed item.) |
| B19 | Correctness | S6 | Worker token cap bypassed by `:streamGenerateContent` | P0-worker | **OPEN** | Router still admits `streamGenerateContent` (worker/index.js:43); metering `JSON.parse(text)` skips a streamed array body (77-86). Blocked on PRE-3. |
| B20 | Correctness | S6 | Worker fails OPEN on a corrupted KV record | P0-worker | **OPEN** | Still `catch { rec = { active: true }; }` (worker/index.js:56) — no cap, never rewritten. Blocked on PRE-3. |
| B21 | Correctness | S6 | Worker usage counter is a read-modify-write race | P0-worker | **OPEN** | Read at :53, upstream at :66, write at :84 — unchanged. Blocked on PRE-3. |
| B22 | Correctness | S6 | No timeout/AbortController on the upstream Gemini fetch | P0-worker | **OPEN** | `fetch(...)` at worker/index.js:66-70 has no `signal`. Blocked on PRE-3. |
| B23 | Correctness | S9 | `serve.js` fork-crash restart loop | Phase −1 (L18) | **CLOSED** | De-clustered to a SINGLE in-memory process; the `cluster.on('exit',fork)` respawn is gone (serve.js:1-10), SIGINT/SIGTERM handlers added (53-55). Lesson L18. |
| B24 | Correctness | S1 | `build.py _js_str` does not escape `</script` | P4 | **OPEN** | Latent — app.js `__JS__` is substituted raw at build.py:586, not through `_js_str`; no `</script` build guard added. (Build did gain F5/i18n asserts, not this one.) |
| B25 | Correctness | S9 | Service-worker registration catch is empty | P7 | **OPEN** | No evidence the SW `.register` catch gained a body; not in CHANGELOG. |
| B26 | Correctness | S9 | SW gate stricter than platform (`protocol==='https:'`) | Phase −1 (PRE-6) | **CLOSED** | Gate now `self.isSecureContext` — covers trusted localhost so the update channel is testable (app.js:11397, comment "2026-07-23, owner §4 sign-off"). |
| B27 | Correctness | S9 | First visit downloads the whole document three times | P7 | **OPEN** | SW `SHELL` double-key + `no-cache` on index.html; delivery-shell work (P7) not done. |
| B28 | Correctness | S9 | Origin returns 200 + 2.27 MB for every unknown path | P7 | **OPEN** | Cloudflare Pages SPA fallback; no `robots.txt`/`llms.txt` shipped. P7 not done. |
| B29 | Correctness | S1 | Nine cuts violate the `saved`/`svh` relation; invariant is wrong comparison | P4 | **OPEN** | Flagged "defect or hand-tuning is open"; no data correction shipped. |
| B30 | Correctness | S1 | Six cuts carry `svt=0` as a "no sous-vide" sentinel | P4 | **OPEN** | Unchanged; no data cleanup shipped. |
| B31 | Correctness | S1 | Five `MAKE_SOURCES` carry a stale "CRITICAL GAP … cure=None … botulism" note | P4 | **PARTIAL** | The hazard mechanism is neutralized — build now ignores sources' `calc` so the bad note can't drive a value (build.py:96-102). The stale note text itself is not confirmed removed. |
