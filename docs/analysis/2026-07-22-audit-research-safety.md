# Audit — Research, Safety/Sources, i18n, and four 2026-07-21 analyses vs. shipped code

**Auditor scope:** `docs/research/*.md`, `docs/sources/*.md`, `RESEARCH-BRIEF-sources.md`,
`docs/analysis/2026-07-21-{nitrite-dosing-threshold,hebrew-terminology,requirements-conformance,
device-visualization,walkthrough-defects}.md`, `docs/superpowers/{plans,specs}/2026-07-15-i18n-foundation-phase0*.md`.

**Method:** every claim below was re-verified against HEAD (`fc80664`, v258, 2026-07-22), NOT against the
analysis documents' own findings — those documents were written 2026-07-21 and a large volume of work
(40+ commits) shipped after most of them, including several commits that explicitly reference and close
findings from these exact documents. Verification = grep/read of `app.js`/`data.py`/`app.css` + running the
relevant Playwright spec files live (not just reading test source).

---

## SAFETY — harshest scrutiny, ADVISORY vs ENFORCED called out explicitly

| ID | Requirement (short) | Source doc:line | State | ADVISORY / ENFORCED | Evidence | Notes |
|---|---|---|---|---|---|---|
| S1 | Hard-warn cure dose < 5×scale-readability; advisory < 20×d | nitrite-dosing-threshold.md:11-12,318,327 | **DONE** (as specified) | **ADVISORY ONLY** | `cureScaleGuardHTML` app.js:1849-1874, `scaleReadability()` app.js:1836-1844, exact 5d/20d NIST-derived thresholds reproduced verbatim. `tests/cure-scale-guard.spec.ts` G1-G10 all pass live. | The doc itself only asks for "warn hard," not a hard block (§5.4 pseudocode says "BLOCK / hard warn" ambivalently). Shipped behavior renders a styled warning `<div>` and nothing else — G8 explicitly asserts the computed cure grams are **byte-identical** with or without the guard; no button is disabled, no save/plan action is gated. If any stricter document (e.g. plan-depth-model's "the task BLOCKS," outside my scope but referenced by requirements-conformance.md) is the bar, this is **NOT DONE**. |
| S2 | Recipe-level `scale_res` should gate cure dosing (D7, referenced in requirements-conformance.md:130,260) | requirements-conformance.md | **PARTIAL** | **ADVISORY** | `scale_res` now renders as an info chip (app.js:6266) and the guard (S1) independently reads the **registered scale device's** resolution, not the recipe's `scale_res` field. | Two different, uncorrelated signals: the recipe says "this needs a 0.1g scale" (display only) while the guard math uses whatever scale the user registered (or assumes 1g). The two never cross-check each other. |
| S3 | Every safety number (`safe`, pasteurization time, cure/nitrite figures) traces to a cited primary source; never guessed (P3) | agent-research-protocol.md:20-25, baldwin-backbone.md, RESEARCH-BRIEF-sources.md §0,§3,§8 | **NOT DONE** | N/A — no citation exists to enforce | `grep -c '\bsrc\b' data.py` = **0** across all 1012 lines / 130 cuts + 47 specials. UI to display it is fully built and correct (`sourcesBlock()`/`srcRow()` app.js:2037-2063, renders "⚠ Not yet source-verified" for `UNVERIFIED` items) — but **every single item hits the "not yet verified against a primary source" fallback path** (app.js:2048) because none carry `src` at all. | This is the actual deliverable of the entire sources research task and it was never executed — 0 of 177 items. The consuming UI was pre-built (possibly by the same effort that wrote the protocol docs) but the research itself never ran. |
| S4 | Order-effect data (sv→smoke vs smoke→sv) recorded per item, `order_smokesv` requires `pasteurize:true` + citation | RESEARCH-BRIEF-sources.md §4 | **NOT DONE** | N/A | `grep -c "order_svsmoke\|order_smokesv" data.py` = **0**. Full render support exists (app.js:2052-2061, "🔀 Order impact" block) and is dead code for lack of data. | Same pattern as S3 — infrastructure shipped, data never authored. |
| S5 | Plan transforms (equipPlan/placement) may never alter `kind`/`hours`/`temp`/`safe` | (not in my doc set; noted because it bears on S1/S3 enforcement posture) | **DONE** | **ENFORCED** | `safetyDiff(before,after)` app.js:3039-3052 is a runtime invariant check (not test-only) comparing every stage field except start/end. | Genuine, structural safety enforcement — but it guards against the *plan layer* corrupting numbers, not against an under-dosed cure being scheduled at all. Distinct from S1. |

**Bottom line on safety:** the one safety mechanism squarely inside my scope (cure-dose vs. scale
readability) is well-built and numerically faithful to the sourced derivation, but it is advisory-only —
identical output whether or not the guard fires. The far larger safety commitment in my scope — that every
`safe`/pasteurization number in the 177-item catalog carries a primary-source citation — was never carried
out at all, despite the display layer for it being complete.

---

## Hebrew terminology (hebrew-terminology.md)

| ID | Requirement | Doc ref | State | Evidence |
|---|---|---|---|---|
| H1 | 8 call sites / 6 string literals: תנור→מכשיר (Part 2a table) | hebrew-terminology.md:74-90 | **DONE** | All 6 strings confirmed at current line numbers: `לא הוגדרו מכשירים` (690), `שיוך מכשיר:` (5900), `התנגשות מכשיר` (5914, 5942, 5948), `תפוסת מכשירים` (5917 area + occ view title). `tests/hebrew-cooker-term.spec.ts` H1/H2/H3 — **3/3 pass live**. |
| H2 | Grill heat-zones mislabeled "מדפים" (shelves) — Part 2b finding #1 | hebrew-terminology.md:96-116 | **DONE** | Fixed via the device-occupancy rewrite: `cap.slotLabelHe/slotLabelEn` sourced from `EQUIP_CATS.capHe/capEn`, not hardcoded (app.js:542). `tests/occ-view-grill.spec.ts` confirms zones labelled "אזור" live. |
| H3 | Definite/indefinite inconsistency, two "Cooker occupancy" entry points — Part 2b finding #3 | hebrew-terminology.md:139-145 | **DONE** | Both sites now read indefinite "תפוסת מכשירים." |
| H4 | `שיוך תנור/מעשנה:` doubly misnames — Part 2b finding #4 | hebrew-terminology.md:147-153 | **DONE** | Now `שיוך מכשיר:` (app.js:5900), matching `cookerCandidates()`'s actual selectable set. |
| H5 | Singular/plural mismatch pattern, 4 cited sites — Part 2b finding #2 | hebrew-terminology.md:118-137 | **PARTIAL** | The 4 originally-cited sites were superseded by the occupancy rewrite (moot) or not re-checked individually. The underlying **pattern still reproduces**: Events list header still renders `"1 אירועים"` for exactly one event (app.js:7973, `` `${list.length} ${L('אירועים','events')}` `` — no singular branch) — confirmed live in `walkthrough-defects.md` N2 and still present at HEAD (see N2 below). |
| H6 (Rule 2) | Shared pluralization helper (`heCount`/`Lc`) to stop this class of bug recurring | hebrew-terminology.md:189-198 | **NOT DONE** | `grep -c "function heCount\|function Lc("` = 0. No such helper exists; each site remains a hand-written (and easily-omitted) ternary. |

---

## Device visualization (device-visualization.md)

Design doc's 7 acceptance criteria (§0) re-scored against HEAD's `occ2-*` implementation (a full rewrite
since the doc was written — `deviceSilhouette`, `_occCabinetBody`, `_occGrillBody`, `_occVesselBody`,
`_occBayHtml`, `_occFitHtml`, `_occListHtml`, per-slot packer at app.js:407-436).

| # | Criterion | State | Evidence |
|---|---|---|---|
| A1-A3 | Named location; two items on one shelf side-by-side; N shelves look like N shelves | **DONE** | `slots[]`/`perSlotCm2` packer (app.js:407-436, the design doc's own §6 "single highest-impact change"); `tests/occ-view-cabinet.spec.ts` — "a cabinet renders one shelf per rack, names empties, and lists items" **passes live**. |
| A4 | Hanging reads as hanging, distinct from a grate | **DONE** | Separate hook bay (`_occBayHtml`, gated on `cap.hooks>0`), rendered above the shelf stack, shelves stay drawn empty beneath. |
| A5 | Usage % at a future instant, honest | **DONE** for area (ok/tight/over fit ladder, `tests/occ-fit-ladder.spec.ts` 3/3 pass); **DONE** for sous-vide by *deliberately showing no percentage* — `tests/occ-view-vessel.spec.ts` "draws a vessel with a bag per item and **NO percentage**" passes live, matching the design doc's §2.5 explicit recommendation against a dishonest number. |
| A6 | Device-relevant facts (temp, wood, setpoint cost) | **DONE** | Header shows setpoint + wood + a named setpoint-delta line ("X runs N° above its own target") per scheduler spec §6.3. |
| A7 | Three device classes look like three different objects | **DONE** | `deviceSilhouette()` dispatches vessel / offset-barrel / grill-round / grill-rect / cabinet; `tests/occ-view-grill.spec.ts` confirms a round kettle vs. a rectangular gas grill render differently, live. |
| §1.4 | Unknown footprint renders as unknown, never 0 | **DONE** | `tests/occupancy-unknown-footprint.spec.ts` U1-U4, 4/4 pass — null propagates, never silently zeroed. |
| §1.5 | Sous-vide occupancy = max requirement, not sum | **DONE** (implied by A5/no-percentage result above; the old ">100%, red" bug is gone) |
| §1.6 | Hanging gated on the *device's* hooks, not a global accessory | **DONE** | `cap.hooks>0` check reads `deviceCapacity(dev)`, not a separate `{cat:'other',type:'hooks'}` item. |
| §2.6 | Density ribbon, ±20min ghosting, next-event line | **NOT DONE** | `grep -c "occ-ribbon\|nextEvent\|deviceTimeline"` = 0. No ribbon, no ghost/soon states, no next-event sentence exist anywhere in `app.js`. |
| §2.7 | Diagram `aria-hidden`, separate accessible `<ul>` list, tap targets | **PARTIAL** | `_occListHtml()` (app.js:677-687) ships exactly the "item · slot · cm²" accessible list the doc asked for. Tap targets: tiles are still plain `<div class="occ2-tile">` (app.js:562-570), not `<button>` — the doc's "every tile opens the assignment sheet" is **not** implemented. |

Net: 5 of 7 top-level criteria fully done, both remaining sub-items from §1 fixed, the ribbon/ghosting
feature (§2.6) and tappable tiles are the two genuine gaps left.

---

## Requirements conformance (requirements-conformance.md) — re-scored at HEAD

The document's headline defects (D1-D11) and the "waived `equipPlan` seam" have moved substantially since
2026-07-21. Re-verified individually:

| ID | Defect | Doc's original state | **State at HEAD** | Evidence |
|---|---|---|---|---|
| equipPlan seam | "0 occurrences… never built" | MISS | **DONE** | `function equipPlan(meta, methodKey, stages, scope)` app.js:973; `tests/equipplan-seam.spec.ts` P3a-P3f, **6/6 pass live**. |
| D1 | Preheat contradicts itself (45 vs ~15 min) | OPEN | **FIXED** | One `PREHEAT` table (app.js:938) drives both the scheduled light-up and its label; `equipplan-seam.spec.ts` P3b/P3c assert the same number in both places. |
| D3 | Fuel never reconciled with `dev.fuel` | OPEN | **FIXED** | equipPlan reads the device's fuel, not the recipe's. |
| D4 | Reload reminder fixed, no cadence table | OPEN | **FIXED** | `refuelEveryMin` (app.js:983), real refuel tasks pushed to the plan (app.js:5861-5867); test P3f "a stick burner gets refuel tasks; a pellet smoker gets none" passes. |
| D5 | All capacity decorative | FIXED (already) | **FIXED** (confirmed still true) | |
| D6 | Second same-class cooker hides items from clash detection | PARTIAL | **FIXED** | commit `1586b0f` ("S3/D6"). |
| D7 | Scale resolution unused in dosing | OPEN | **PARTIAL / ADVISORY** | see Safety S1/S2 above. |
| D8 | Nozzles fully orphaned | OPEN | **FIXED** | `chooseNozzle(dev, casingMm)` app.js:3024 — picks the largest nozzle that still fits the casing, refuses to invent one; shipped in the most recent commit at HEAD (`bb789aa`). |
| D9 | Edge vs. chamber vacuum never checked | OPEN | **STILL OPEN** | `bagKind` remains a single (declaration-only) occurrence; no liquid-seal / "freeze the marinade" warning exists. |
| D10 | Probe channels are a display count only | OPEN | **STILL OPEN** | `probeChannels()` (app.js:229) still has only its definition + one footer display line; no per-item channel budgeting/allocation exists. |
| D11 | Cooler hold advice ungated on ownership | PARTIAL | **STILL OPEN** | The "faux cambro" advisory lines (app.js:5432, 5443) carry no `hasGear('cooler')`/ownership check — content and defect both verified unchanged, only line numbers shifted. |
| Phase 3a orchestrator (`orchestrate`, `movesForClash`, `applyMove`) | MISS | **STILL MISS** | `grep -c "function orchestrate\|movesForClash\|function applyMove"` = 0. |
| `PREF_PRESETS` / `prefPreset()` (Simple/Balanced/Pro selector) | MISS | **STILL MISS** | 0 occurrences of either. |
| Plan-depth model (49 reqs, incl. cure-BLOCKS commitment) | 0% | **STILL 0%** | `planDepth`/`depth:` tags remain absent (out of my primary scope, but directly bears on S1/S2 above). |

**The single most consequential update since 2026-07-21:** the `equipPlan` seam — the mechanism the whole
consumption-layer arc was said to be missing — has been built and is now the actual root of D1/D3/D4's
fixes. The Phase 3a orchestrator and plan-depth model remain entirely unbuilt, as does D9/D10/D11.

---

## Walkthrough defects register (walkthrough-defects.md) — current status of all 9

| ID | Defect | Original severity | **State at HEAD** | Evidence |
|---|---|---|---|---|
| C1 | Shopping list ignores guest count, disagrees with Print menu by 2.7× | Critical | **FIXED** | `rawGramsFor()` unified across `renderMenu`/`openMenuPrint`/`shopData`/`crossEventShopData` (commit `4e215b1`); `tests/cart-quantity.spec.ts` Q1-Q6, **6/6 pass live**. |
| C2 | Auto cooker-assignment double-books sous-vide bath while grill sits idle | Critical | **PARTIAL** | Root cause (M1, below) is still present, so the *default* assignment logic is unchanged. But the *consequence* — an unexecutable over-capacity schedule — is now substantially mitigated: `schedulePlacements()` (Phase 4b, `tests/scheduler-placement.spec.ts`) actively staggers over-subscribed devices and reports conflicts instead of silently over-booking, and `safetyDiff` guards the transform. Not independently re-driven end-to-end through the wizard in this audit; classified PARTIAL on code evidence. |
| M1 | Grill cuts (picanha, kebab) default to sous-vide+smoke instead of grill | Major | **STILL OPEN** | `methodRules()` (app.js:825-826): `if(c.doneness) return {..., def:['sv','smoke'], ...}` — unconditional for every "steak-like" item, no grill-category special case. Unchanged from the reported defect. |
| M2 | Wizard category filter chips can't be deselected by a second tap | Major | **STILL OPEN** | `cwPaintPicker()` click handler (app.js:7205): `cwActiveCat=el.dataset.cwcat\|\|null;` — no toggle-off branch when the same chip is clicked again. No test exists for this interaction. |
| M3 | Charcoal-grill "Add" form silently discards heat-zones/area fields | Major | **Not independently re-verified** | The general equipment-form-validation defect class (numeric fields silently dropping bad input) was fixed for numeric *property* fields (commit `cf9458a`, "M2" in that commit's own numbering — a different bug than walkthrough M2 above). Whether the *capacity* field (`racks`/`zones`/`areaCm2`) specifically for a charcoal grill now persists was not re-driven through the live form in this audit; flagged for a real-click check. |
| M4 | English mode leaves Events screen partially untranslated + mixed-language date | Major | **FIXED** | All cited strings now route through `L()`: status badge "Active" (app.js ~7995), "🛒 Shopping"/"🖨️ Print menu" (8000-8001), "Delete all events" (8008); date string now uses `toLocaleDateString('en-US', …)` when not Hebrew (app.js:7992), eliminating the mixed-language month-name bug. |
| N1 | Timeline date field visually clips the year (120px fixed width) | Minor | **STILL OPEN (code evidence)** | `.calcrow input{width:120px}` (app.css:556) is unchanged and still applies to `#tlServeDate`; not visually re-driven in this audit. |
| N2 | "1 אירועים" — wrong Hebrew plural for exactly one event | Minor | **STILL OPEN** | app.js:7973: `` `${list.length} ${L('אירועים','events')}` `` — no singular branch. Same root cause as Hebrew-terminology H5/H6 (no shared pluralization helper). |
| N3 | Non-ISO date string assigned to a native `<input type="date">` | Minor | **FIXED** | `serveDateStr = isoDate(serveDateTime())` (app.js:5627) — `isoDate()` (app.js:5531) returns proper `yyyy-MM-dd`, not the localized display string. |

**Score: 4 fixed (C1, M4, N3, + D-series above), 1 partial (C2), 4 still open (M1, M2, N1, N2), 1 not
independently re-verified (M3).**

---

## i18n Foundation Phase 0 (plan + design spec)

| Task | Requirement | State | Evidence |
|---|---|---|---|
| 1 | `L()` becomes dict-aware for fr/de/es, Hebrew/English behavior unchanged | **DONE** | app.js:6896-6902 matches the spec's proposed diff verbatim; `tests/i18n-foundation.spec.ts` "Change 1" passes. |
| 2 | `aiJSON` `outLang` names the real target language via shared `LANGNAME` | **DONE** | `LANGNAME` map app.js:6880, consumed at 4344 (`aiJSON`) and 6972 (`mtTranslate`); test "Change 2" passes. |
| 3 | ~20 hardcoded Hebrew toasts routed through `L()` so English mode shows English | **PARTIAL — regressed from the plan's DoD** | Only the **interpolated** toasts were wrapped (commit `eeab832`, explicitly titled "…standalone ones already dict-covered"). That premise is **false**: direct lookup of `lang/en.json` shows **all 18** of the plan's cited "standalone" toast strings (storage-full, seasoning-updated, project/reminder/entry-deleted, list-copied, speech-recognition errors ×5, backup-import errors ×4, etc.) are **absent from the English dictionary**. In English mode these 18 toasts still render in Hebrew. `tests/i18n-foundation.spec.ts`'s own "Change 3" test only covers the interpolated case, so nothing in CI catches this gap. |
| 4 | Build-time i18n coverage report, non-fatal | **DONE** | `python build.py` prints `[i18n] de: 83/3985 keys vs en (2%)` etc., matching the spec's exact format. |
| — | fr/de/es dictionaries authored | **Explicitly out of scope / NOT DONE** | 83/3985 keys (2%) each — this was the plan's own stated non-goal ("Phase 0 makes them possible, it does not fill them"), so this is expected, not a defect. |

---

## Research reports (docs/research/) — strategic recommendations vs. what shipped

These are recommendation documents, not requirements with a pass/fail bar of their own; verified only
whether their recommendations have since been acted on.

| Doc | Recommendation | State |
|---|---|---|
| 02-ai-platforms.md | Stay on Gemini, cheap-default+escalate tiering, BYOK-free / thin proxy for paid | **PARTIALLY ACTED ON** — BYOK-only Gemini calling exists (pre-dates this report); no evidence of the cheap-default+escalate tiering logic (model selection by task) in `app.js`. |
| 04a-architecture.md | One Cloudflare Worker on the `GEM_HOST` seam as AI proxy + sync, TWA for Play, defer Apple | **PARTIALLY ACTED ON** — `worker/index.js` + `wrangler.toml` + `scripts/central-code.mjs` implement exactly the recommended dev/beta proxy (per-user access codes, token caps, KV-backed, "This is the dev/beta form… production path adds subscription auth" per `worker/README.md`). No `/sync` endpoint, no D1, no TWA/Bubblewrap packaging found. |
| 04b-business.md | Paddle as Merchant-of-Record, web-first, standalone product w/ shared identity/entitlements backend | **NOT DONE** — `grep -rn "paddle\|stripe"` across `app.js`/`worker/` = 0 hits. No billing integration of any kind exists; the dev-proxy's own README names Paddle entitlements as future work. |

---

## Summary counts

- **Safety (my scope, S1-S5):** 1 DONE-as-specified-but-advisory-only, 1 PARTIAL, 2 NOT DONE (source citations + order-effect data — the core sources-research deliverable), 1 DONE (structural invariant, different concern).
- **Hebrew terminology (H1-H6):** 4 DONE, 1 PARTIAL (pattern recurs elsewhere), 1 NOT DONE (systemic fix).
- **Device visualization (7 criteria + 5 sub-items):** 10 DONE, 1 PARTIAL, 1 NOT DONE.
- **Requirements-conformance defects (14 tracked):** 8 FIXED (incl. the equipPlan seam itself), 1 PARTIAL, 5 STILL OPEN/MISS.
- **Walkthrough register (9 defects):** 3 FIXED outright (C1, M4, N3), 1 PARTIAL (C2), 4 STILL OPEN (M1, M2, N1, N2), 1 unverified in this pass (M3).
- **i18n Phase 0 (4 tasks):** 3 DONE, 1 PARTIAL with a confirmed regression (18 toasts still leak Hebrew in English mode).
- **Research reports (business/architecture):** 0 fully done, 2 partially acted on, 1 (billing) not started — expected, these were framed as pending owner decisions.
