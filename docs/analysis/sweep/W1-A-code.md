# W1-A · Code Sweep — app.js, app.css, serve.js, build.py, worker/

**Date:** 2026-07-22 · **Version audited:** v258 (working tree matches `git log` HEAD `380c57a`)
**Scope:** `app.js` (9,564 lines), `app.css` (1,710 lines), `serve.js` (57 lines), `build.py` (430 lines), `worker/index.js` (91 lines).
**Method:** every finding below was grepped/read against the CURRENT file, not inferred from prior reports. Where an earlier document (`2026-07-21-refactoring-report.md`) claimed a defect, it was re-checked against today's code; several have since been fixed by commits between 2026-07-21 20:30 and 2026-07-22 01:22 (`92961db`…`fc80664`) — those are recorded in §0 so later agents don't re-flag them.

---

## 0. Claims re-checked and found ALREADY FIXED (do not re-report)

| Old claim | Current state | Evidence |
|---|---|---|
| `equipPlan` seam never built | Built. `function equipPlan(meta, methodKey, stages, scope)` at `app.js:973`, called from the single-event work-plan at `app.js:5673` | `app.js:973,5673` |
| `scale_res` shipped, never read | Read once, in the equipment-requirements renderer | `app.js:6266` |
| `hooksOver` computed, read by nothing | Read in 2 places: bay-badge CSS class and the fit-line warning text | `app.js:652,668` (set at `516`) |
| H1 unmeasured footprint counted as 0 cm² | Returns `null` (unknown), never 0; kept out of both the slotted and unplaced buckets | `app.js:369,426` |
| H2 `min_bath_l` summed across items (false 500% overs) | Now takes `Math.max` of per-item requirements, and the % is explicitly flagged as a floor (`pctFloor`) | `app.js:487-492` |
| H3 hanging gated on a `hooks` accessory, not the device | `deviceCanHang()` reads the device's own `canHang`+`hooks` only | `app.js:330` |
| S3 two same-class devices → item silently invisible to clash/occupancy | Surfaced as a "🔧 Awaiting cooker assignment" advisory strip listing every unresolved item | `app.js:5901-5913` |
| Scheduler walk duplicated in `combinedEventsRows` (6-line reimplementation) | Both the single-event and cross-event views now call one `planSchedule()` | `app.js:2978,5678,7850`; comment at `7847-7849` documents the dedup |
| Shopping-cart weight used the whole-cut catalog figure while the print menu used the per-guest figure (5.5 kg vs 3.7 kg) | Both now call one `rawGramsFor()` | `app.js:4713` (comment names the old 3-copy drift), call sites at `2595,2606,2614,4764,4791,7900` |
| `linear-gradient(90deg)` runs backwards under `dir=rtl` in the device diagrams | Could not confirm on current CSS — the `occ2-*` gradients are now symmetric repeating grate/dash textures (`app.css:1652,1670,1672`), not the asymmetric fill the old report described. **Dropped per the no-unverifiable-claims rule**; a visual RTL check belongs to the Axis-4/7 UI agents, not this static read. |

---

## 1. Architecture map of `app.js`

Single 9,564-line file, no ES modules, no `import`/`export` — everything lives in global function/const scope, banner-commented into regions:

| Lines | Region |
|---|---|
| 1–28 | DATA embed, tiny helpers |
| 28–973 | Equipment 2.0 catalog (`EQUIP_CATS`), cooker/occupancy engine (`cookerFor`, `deviceOccupancy`, `packDevice`), method-toggle engine |
| 973–1033 | `equipPlan` seam + rest of method-toggle rules |
| 1033–1138 | recipe engine |
| 1138–1432 | unified seasoning picker |
| 1432–1471 | checklist/timer state, shopping-cart state (`store`, `mkStorageWarn`) |
| 1471–1826 | category colors/icons, card rendering, two-tier category system |
| 1826–2012 | detail panel + calculators (cure-scale guard at `1829`) |
| 2012–2565 | from-scratch build renderer |
| 2565–2718 | shopping list, glossary |
| **2718–4264** | banner-labelled just **"wire"** — **1,546 lines**, no sub-headers. Mixes DOM event wiring, HTML-template rendering, menu/quantity state (`rawGramsFor` at `4713`), and the entire "Ask the Fire" AI chat feature (`4113-4262`) in one undifferentiated region |
| 4264–4964 | AI infrastructure layer (`gemFetch`, `aiJSON`, safety-caveat/numeric-guard functions) — well isolated and commented |
| 4964–5345 | voice-cook mode (TTS + speech recognition) |
| **5345–6795** | **"Live Cook Copilot"** — **1,450 lines**, single banner, no sub-headers. Contains work-plan generation, `equipPlan`/`planSchedule` wiring, cooker-assignment UI, timeline rendering, and the copilot session shell together |
| 6795–6868 | preferences framework |
| 6868–7128 | i18n foundation (`applyLang`, `tnode`, `hydrateMT`) |
| 7128–7636 | navigation router (Concept C) |
| 7636–7738 | "Active now" hub |
| 7738–8124 | event manager, `combinedEventsRows`, cross-event cart |
| 8124–9131 | 7 AI features (`FEATURE 1`–`7`), each clearly banner-delimited — the best-organized region in the file |
| 9131–9544 | pantry advisor (AI feature 2), remaining wiring |
| 9544–9564 | boot sequence, service-worker registration |

**Structural finding:** the two largest regions (`wire`, 1,546 lines; `Live Cook Copilot`, 1,450 lines — together 31% of the file) have no internal sub-structure, unlike the AI-features block which is cleanly banner-divided per feature. Rendering, persistence and business logic are interleaved inside single functions throughout both (e.g. the work-plan generator both computes `planSchedule()` and returns template-literal HTML in the same function). This is where "tangled responsibility" concentrates; it is also where the equipment/scheduling defects in §0 lived, which is consistent with less structure correlating with more defects.

**Systemic pattern — the likely root cause of the "inert feature" failure mode:**
`grep -c "typeof [A-Za-z_$]*==='function'" app.js` → **483 occurrences**, roughly one every 20 lines. The codebase's de-facto module system is "check the function exists before calling it," e.g. `app.js:5673`: `if(typeof equipPlan==='function') stages=equipPlan(...)`. This is defensively correct (never throws), but it means a renamed, mistyped, or accidentally-deleted function does not fail loudly anywhere — the call site just silently no-ops. This is structurally the same shape as the `equipPlan`/`hooksOver`/`scale_res` inert-shipment failures the task asked to hunt for, generalized across the whole file: nothing forces a caller and its callee to agree that both exist. No lint rule or build step catches a broken wire-up; only manual QA (exactly what produced the 2026-07-21 report) does.

---

## 2. Dead code — computed values and functions with no consumer

Verified by: extracting every top-level `function name(...)`, counting whole-word occurrences of `name` across `app.js`, then re-checking every candidate with ≤1 occurrence against `tests/*.spec.ts` (82 spec files) and the built bundles (`index.html`, `dist/`). None of the following are called from any test or production path.

**Orphaned functions (zero callers anywhere):**
| Function | Location | Note |
|---|---|---|
| `svBaths()` | `app.js:230` | thin wrapper `equipByCat('sousvide')`, unused |
| `gearLabelFor(method)` | `app.js:794` | method→Hebrew-label map, unused |
| `groupOf(cat)` | `app.js:1731` | category→group lookup via `CAT_GROUPS`, unused |
| `svOrderDesc(k)` | `app.js:2958` | sv/smoke-order description getter, unused |
| `itemPickLabel(meta)` | `app.js:3292` | "origin · category" label builder, unused |
| `cNavState()` | `app.js:7127` | bundles current nav/wizard state into one object, unused |
| `cwSeasFull_desc(s)` | `app.js:7292` | seasoning short-description formatter; the renderer it was written for (`cwPaintSeasFull`, `7299`) does not call it |
| `cwToggleSeasByKind(key,sid)` | `app.js:7333` | comment claims `"compat: … used by tests/legacy"` — **that comment is stale**: `grep -rn cwToggleSeasByKind tests/*.ts` returns zero hits |
| `cwSeedResume()` | `app.js:7458` | calls `cwPaintReview()` but is itself never invoked |

**Explicit intentional stubs (self-documented, lower priority — flagged only because they add dead surface area, not because they're bugs):**
`saveCart()` — `app.js:1459`, body `/* mk-cart retired */`; `cwPaintMethods()` — `app.js:7459`, `/* legacy no-op retained */`; `cwPaintProteins()` — `app.js:7460`, same; `cwUpdateHint()` — `app.js:7461`, `/* legacy no-op */`.

**Built-and-tested-but-never-wired (independently reconfirmed, matches `2026-07-22-status-and-gaps.md` §C.6):**
`choosePlate(dev, wantMm)` (`app.js:3014`) and `chooseNozzle(dev, casingMm)` (`app.js:3024`) are called only from `tests/equip-chooser.spec.ts` via direct `page.evaluate()` — never from any `app.js` production code path. `chooseBath` (their sibling, `app.js:3004`) IS wired, at `app.js:630`.

**Captured-but-never-read device properties** — 14 properties are defined as capture-schema keys in `EQUIP_CATS` (so the equipment form asks the user for them and stores them) but are never read anywhere via `propOf()` or `.cap.<key>`:
`nozzles` (`app.js:95`), `plates` (`90`), `bagKind` (`81`), `bagW` (`79`), `lid` (`54`), `fan` (`67`), `accuracy` (`88`), `pulse` (`83`), `rotisserie` (`58`), `speed` (`97`), `steam` (`68`), `throughput` (`92`), `waterPan` (`46`), `watts` (`74`). Verified with `grep -c "propOf([^)]*,'X')\|\.cap\.X\b"` = 0 for each, across the whole file.

---

## 3. Duplicated logic / missing shared abstraction

The two previously-known duplications (quantity formula, scheduler walk) are **fixed** — see §0. One live duplication-by-omission remains:

**No shared pluralization helper exists.** `grep -n "function.*[Pp]lural"` returns nothing in `app.js`. Every count+label site hand-rolls its own string, and at least two currently produce the wrong grammatical number:
- `app.js:7973`: `` `${list.length} ${L('אירועים','events')}` `` → renders **"1 אירועים"** ("1 events") when `list.length===1`.
- `app.js:8010`: same pattern, same bug, in the combined-schedule hero header.

Contrast with `app.js:5900` (`cookerStripHtml`) which gets a different count label right by inlining its own conditional — i.e. the fix exists ad hoc in one place and was not extracted, so the next site (7973/8010) repeats the mistake. This matches the "same rule implemented more than once, and they drift" pattern the task called out — the fix here is one small shared `plural(n, sing, plur)` helper, not a rewrite.

---

## 4. Fragility — unguarded assumptions, silent catches, missing feedback

- **`build.py:347-348`** — `_js_str()` escapes `\`, `'`, `\n`, `\r`, U+2028, U+2029 before wrapping `DATA_JSON`/`I18N_DICTS_JSON` in a JS string literal, but does **not** escape the substring `</script`. That string is then embedded as `<script>__JS__</script>` (`build.py:340`), and `__DATA__` is substituted *inside* that script body (`app.js:2`: `const DATA = __DATA__;`). The HTML parser tokenizes `</script` case-insensitively before any JS runs; if any recipe/i18n string ever contains that literal substring, the outer `<script>` tag closes early and the build silently truncates the app on load. Currently not triggered (no source string contains it today — checked via `grep -rn "</script" data.py sausages_new.py lang/*.json`, zero hits), but nothing prevents it and there is no build-time guard.
- **`build.py:334`** — the page footer unconditionally renders `הנתונים מקומיים, ללא חיבור לרשת` ("data is local, no network connection") on every single page load, in every language. Not overridden anywhere in `app.js` (`grep -n "footnote\|הנתונים מקומיים" app.js` → 0 hits). This is the same stale claim flagged in the README (`docs/analysis/2026-07-22-discovery-sweep-roster.md:11`), but here it is baked into the HTML template itself and shown to every user, not just documentation — a stronger instance of the same conflict, and it directly contradicts the app's current online-first/AI-key architecture.
- **`app.js:9562`** — `navigator.serviceWorker.register('sw.js')...catch(function(){})`. A completely empty catch on the one call that installs the PWA's offline shell, install prompt, and update-delivery channel (the surrounding comment at `9555-9558` explains the update-delivery mechanism this depends on). If registration fails for any reason (sw.js 404, syntax error, browser policy), there is no console trace, no toast, no fallback — the failure is invisible to both the user and to whoever is debugging a report of "the app never updates."
- **`app.js:1433-1435`** — `store.set()` already catches its own `localStorage.setItem` failures internally and raises a throttled (60s) global toast via `mkStorageWarn()` (`1438-1442`) when the failure is quota-related; it returns `false` on any failure and never throws. Given that, the several call sites elsewhere that additionally wrap `store.set(...)` in their own `try{...}catch(e){}` (e.g. `app.js:3641`, `8792`, `8822`) are wrapping a call that cannot throw — the catch is dead. The real defect this masks: none of these sites check the boolean `store.set()` returns, so e.g. `app.js:8822-8823` (save a journal note) shows an unconditional `toast('נרשם ביומן ✓')` ("Recorded ✓") even when the write failed; the only feedback on failure is the decoupled, throttled, generic storage-full banner — not tied to the specific action, and not shown at all if another action already triggered it in the last 60 seconds.
- **`app.js:242-253`** (`cookerFor`) — by design returns `null` when two owned devices are of the same class and the user hasn't picked one (documented, and now surfaced via the advisory strip per §0/S3). Worth noting only because every caller must remember to treat `null` as "ambiguous, not absent" rather than "no device owned" — both states currently produce the same falsy return, so a caller checking `if(!cookerFor(...))` cannot distinguish "no gear" from "gear needs a pick" without also calling `cookerCandidates(kind).length`. Not a bug today (both current call sites do the extra check), but a footgun for the next one.

**Empty-catch count:** 108 occurrences of `catch(e){}`/`catch{}` in `app.js`. The large majority (~100) are legitimate progressive-enhancement guards around optional browser APIs (`navigator.vibrate`, `Notification`, `AudioContext`, `speechSynthesis`, wake-lock) where silent failure is the correct behavior. The ones called out above are the exceptions where the swallowed path has a user-visible consequence.

---

## 5. Network/API error handling (online-first is now the primary path)

**This is the best-engineered part of the codebase.** All outbound network traffic funnels through exactly one `fetch()` call site: `app.js:4223`, inside `gemFetch()` (`app.js:4208-4236`). It has:
- an explicit per-call timeout via `AbortController` (default 25s, callers override — 12s/15s/20s/30s/40s depending on feature),
- retry with exponential backoff (`500ms·2^i`) restricted to transient statuses (429/500/502/503/504) and network-level `AbortError`/`failed to fetch`,
- automatic managed→BYOK fallback on 401/402/403 from the central proxy (`app.js:4226`),
- a distinct `Error('timeout')` vs `Error('api-'+status)` vs the original network error, so callers can branch on cause.

`aiJSON()` (`app.js:4338-4374`) layers a 3-stage JSON-repair fallback on top (strip code fences → strip control characters → repair common LLM malformations like `"k":,`) before finally throwing a clean `bad-json` error — it cannot crash on a malformed model response.

Every one of the 7 numbered AI features (`app.js:8124-9300`) that calls `aiJSON`/`gemFetch` wraps the call in its own `try/catch` with a **local-first-then-AI-enhance** pattern: render the deterministic local result immediately, attempt the AI enrichment in the background, and on failure show a specific Hebrew toast plus fall back to the already-rendered local result (e.g. `app.js:8222-8237` `openWhatCanIMake`, `8278-8289` `runPantryAdvisor`, `8356-8368` `evPlanRun`, `8442-8456` `openSeasonRecAI`, `8504-8511` `runDiagnose`, `8589-8600` `runGenerateRecipe`, `8667-8672` `openJournalInsights`). No AI call site was found that fails silently or leaves the UI in a stuck loading state.

The one asymmetry: **`worker/index.js`'s own outbound call to Gemini has none of this.** See §6.

---

## 6. `worker/index.js` — API key safety and rate limiting

Scope note: CORS wildcard and the token-cap-only abuse model are already covered in `W1-F-ai.md` §7 (confirms `Access-Control-Allow-Origin:'*'` at `index.js:21` and the lack of per-minute/per-IP throttling — not repeated here). This section adds what that pass did not cover:

- **Fail-open on a corrupted KV record.** `worker/index.js:53-57`:
  ```js
  const raw = await env.CODES.get('code:' + code);
  if (!raw) return json({ error: 'invalid_code' }, 403);
  let rec;
  try { rec = JSON.parse(raw); } catch { rec = { active: true }; }
  ```
  If a code exists in KV (`raw` is truthy) but its value is not valid JSON, the catch substitutes `{active:true}` — i.e. malformed stored data **grants** access (unlimited, since `rec.cap` is then `undefined` and the cap check at `58-60` only fires when `typeof rec.cap==='number'`), rather than denying it. The failure direction is backwards: a corrupted record should fail closed, not open.
- **Usage is unmetered (not just uncapped) for any code with no `cap` set.** The metering block at `77-87` is gated by the same `typeof rec.cap==='number' && rec.cap>0` condition as the enforcement check, so an uncapped code (documented as an intentional admin pattern, `worker/README.md:58`: `cap 0` = uncapped) never has `rec.used` written at all. This is consistent with the documented design (uncapped is intentional), but it also means there is **no usage record whatsoever** for such a code — not even for later auditing/billing — since the same flag that disables the limit also disables the counter.
- **No timeout on the upstream fetch.** `worker/index.js:66-70` calls `fetch(GEMINI_BASE + ..., {...})` with no `AbortController`/timeout, unlike the client-side `gemFetch` (§5) which is careful about exactly this. A slow/hanging Gemini response holds the Worker open until the platform's own execution-time limit, with no graceful early error back to the client.
- **Unauthenticated health check leaks key presence.** `worker/index.js:38-40`: `GET /` returns `{ok:true, service:'matkonet-ai', hasKey: !!env.GEMINI_KEY}` with no auth. Low severity (doesn't leak the key itself), but lets anyone probe whether a given deployment is misconfigured before bothering with access codes.

`serve.js` is test-infrastructure only (the Playwright `webServer`), not a production path — no findings warranted there beyond noting it correctly maps request paths through an in-memory `Map` rather than the filesystem, so path traversal isn't reachable (comment at `serve.js:36-37` states this design reasoning explicitly and it checks out).

---

## Summary counts

| Category | Count |
|---|---|
| Claims re-checked and found already fixed | 8 |
| Orphaned functions (zero callers) | 9 |
| Explicit dead stubs (self-documented) | 4 |
| Built-but-unwired functions (tested, never called in production) | 2 |
| Captured device properties with zero readers | 14 |
| Duplicated-logic / missing-abstraction findings | 1 (pluralization, 2 live bug sites) |
| Fragility findings | 5 |
| Worker findings (new, beyond W1-F) | 4 |
