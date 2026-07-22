# W1-B Conformance Sweep — Largest Specs, Clause-by-Clause

Scope: the six largest plans in `docs/superpowers/plans/`, verified against `app.js`, `app.css`, `equipment_map.py`, `build.py`, `lang/en.data.json`, and the Playwright suite in `tests/`. Method: `antigravity-awesome-skills:spec-to-code-compliance` (clause-by-clause spec↔code alignment). Evidence gathered by static grep/read of current `main` plus one full build (`python build.py`) and two live Playwright runs (63 occupancy specs; the 3 `i18n-foundation` specs; one throwaway probe spec, deleted after use — no test files were left modified).

Legend: **DONE** (file:line + a test asserting behaviour) | **PARTIAL** | **NOT DONE** | **SUPERSEDED** (name the later decision).

---

## 1. `2026-07-20-equipment-occupancy-layer.md` (1276 lines, 9 tasks)

| Spec:line | Requirement | State | Evidence | Notes |
|---|---|---|---|---|
| T1 (26-161) | `areaCm2` prop on smoker/grill + `UNIT_CONV` area conversions | DONE | `app.js:37,51,62` (`key:'areaCm2'` on smoker/grill/**oven**); `app.js:142-144` (`in2->cm2`,`m2->cm2`,`ft2->cm2`) | Test `O1-O3` in `occupancy-model.spec.ts` pass live. Oven got the same prop later (Phase 2), beyond this task's literal scope. |
| T2 (165-279) | `deviceCapacity(dev)`, `itemOccupancy(meta,stageKind)` | DONE | `app.js:305` `deviceCapacity`; `app.js:356` `itemOccupancy(meta,stageKind,dev)` | Signature grew a 3rd `dev` param (device-aware hanging, see T6/H3); tests `O4-O7` pass. |
| T3 (283-427) | `deviceOccupancy(devId,tMs,computed,scope)` seam | DONE | `app.js:438-519` | Massively extended since (see below): `packDevice`, `slots`, `fit`, `hooksOver`, `pctFloor` — none of this contradicts the seam, all reads flow through the same object. Tests `O12-O17` (renumbered from the plan's O8-O11) pass live. |
| T4 (430-544) | `occupancyCompat` — temp spread + common wood | DONE | `app.js:375-396` `occupancyCompat`; wired at `app.js:517` `out.compat=occupancyCompat(out.items)` | Tests `O18-O23` pass live (exact constants `TEMP_TOL_C=6`, wood `/`-split intersection, match the plan verbatim). |
| T5 (548-748) | `cookerContention` derives from the model, not time overlap; shape change `{a,b}`→`{items[],reason}` | DONE | `app.js:258-289` | Extended beyond the plan: judges by `o.fit.verdict==='over'` (a later, stricter per-slot honesty check — H4, see doc 2) OR `o.over`, not `o.over` alone. `occupancy-clash.spec.ts` C1-C7 pass live (C7 is new, not in this plan). |
| T6 (752-872) | `hang` derivation in `equipment_map.py`; `deviceOccupancy(...).hooksOver` | DONE | `equipment_map.py:373-381` `_HANG_RE`/`_HANG_LONG_RE`/`_hang_class`; `app.js:516` `out.hooksOver=cap.hooks>0 && out.hooksUsed>cap.hooks` | Build-time count = **28** hang specs (`node -e` on `dist/index.html`), inside the plan's own [10,40] sanity gate. `occupancy-hanging.spec.ts` H3a-H3d pass live. |
| T7 (876-1091) | Shared-device view, `.occ-*` bar/card markup, `occupancyDevHtml`/`openOccupancyView` | **SUPERSEDED** | by `2026-07-21-occupancy-view-phase2.md` (commits `cc8d991`…`fc4b026`…`92961db`) | The plan's own literal markup (`.occ-dev/.occ-bar/.occ-item/.occ-slots/.occ-warn`) was replaced wholesale by the Phase-2 device-silhouette dispatcher (`.occ2-*`). `openOccupancyView`/`_occSpan` survive; `occupancyDevHtml`'s *body* does not resemble T7's code at all. This is the single largest doc-vs-code divergence in the sweep, and it is a **documented** supersession (Phase-2 plan's own "Naming note", line 38), not a silent drift. |
| T8 (1094-1211) | Time scrubber `_occWire`, `#occRange`/`#occClock` | DONE | `app.js:736-748` | Matches almost verbatim; enhanced with `_occOpenAt` (opens on the busiest instant, not just "now") — a superset, not a contradiction. `occupancy-view.spec.ts` W4/W6 pass live. |
| T9 (1230-1276) | Migrate `combinedEventsRows` to `deviceOccupancy`; `deviceOccupancy` accepts a pre-resolved `c.devId` | DONE | `app.js:453` `const d=c.devId?{id:c.devId}:cookerFor(...)`; `app.js:7832` `combinedEventsRows` builds `{devId,stages:[{...temp...}]}` and calls `deviceOccupancy` per mark | Commit `30634ac "occupancy: multi-event clashes derive from the model too"`. `occupancy-multievent.spec.ts` M1/M2 pass live — this closes the "Known limitation" the plan's own Self-Review flagged for the next plan. |

**Doc 1 counts: 8 DONE, 1 SUPERSEDED, 0 PARTIAL, 0 NOT DONE.**

---

## 2. `2026-07-21-occupancy-view-phase2.md` (996 lines, 10 tasks)

| Spec:line | Requirement | State | Evidence | Notes |
|---|---|---|---|---|
| T1 (42-121) | `deviceSilhouette(dev)` type→contour | DONE | `app.js:334-340` | 4/4 assertions match `occ-silhouette.spec.ts` (kettle/charcoal round, gas rect, offset, vessel, cabinet default). |
| T2 (124-247) | `cap.areaMeasured`, `out.fit` honesty ladder, `FIT_HARD_FACTOR=1.6` | DONE, evolved | `app.js:298` `FIT_HARD_FACTOR=1.6`; `app.js:323` `areaMeasured`; `app.js:499-515` `out.fit` | The shipped `hard` test differs from the plan's literal Step 3 code: plan said `hard = cap.areaMeasured || (it.cm2 > FIT_HARD_FACTOR*perSlotCm2)`; code says `hard = it.cm2 > perSlotCm2 * (cap.areaMeasured ? FIT_SLOT_TOL : FIT_HARD_FACTOR)` — a later fix (`FIT_SLOT_TOL=1.10`, comment at `app.js:299-303`) softened "measured ⇒ any overflow is hard" to "measured ⇒ 10% slack" after a real brisket-overhang false-positive. **Behaviour changed after this plan shipped**, by a documented in-code rationale, not silently. |
| T3 (250-325) | `deviceDisplayName(dev)` + sequential `· מס׳ N` | DONE | `app.js:343-355` | Matches; `occ-devname.spec.ts` intent confirmed by direct read (dedupe by `id`, not object identity — an even more careful fix than the plan's `d===dev\|\|d.id===dev.id` check, since `equipList()` re-parses on every call). |
| T4 (328-457) | CSS tokens (`--over,--grate,--cool,...`) in 3 `:root` blocks + `.occ2-*` styles | DONE | `occ-css-tokens.spec.ts` passes live (round-grill circle + `--over` token resolve) | Not independently re-verified line-by-line against all 3 theme blocks (would require a full app.css diff) — verified via the passing test, which is the DoD's own gate. |
| T5 (461-622) | Dispatcher `occupancyDevHtml` + cabinet body + fit line + a11y list | DONE | `app.js:525-534` dispatcher; `app.js:572-584` `_occCabinetBody` | `occ-view-cabinet.spec.ts` passes live. |
| T6 (626-697) | `_occOffsetBody` — barrel + firebox | DONE | `app.js:596-608` | Matches; `occ-view-offset.spec.ts` passes live. |
| T7 (701-784) | `_occGrillBody` — round/rect heat zones | DONE | `app.js:611-622` | Matches; `occ-view-grill.spec.ts` passes live. |
| T8 (788-857) | `_occVesselBody` — sous-vide, no `%` | DONE, evolved | `app.js:625-638` | Extended beyond the plan: now calls `chooseBath(o.dev, need)` to name the actual container to reach for (`app.js:630`) — a real production caller for `chooseBath` (see §4 Inert-shipment below). `occ-view-vessel.spec.ts` passes live. |
| T9 (861-935) | `_occBayHtml` — hanging bay overlay | DONE, evolved | `app.js:642-652` | Adds `o.hooksOver?' occ2-bay-over':''` (T9-concern fix, commit `6f05cab`) not in the original plan text — the fit line (`_occFitHtml`, `app.js:668`) now also surfaces `hooksOver` so "everything fits" is never shown while hung items overflow the hooks. `occ-view-bay.spec.ts` passes live. |
| T10 (939-987) | Remove dead `.occ-*` CSS, full-suite green, UI-viewed verification | DONE | Commit `92961db` "four defects found by viewing the rendered diagrams" states "Full suite 366/366 green," lists 4 real UI-only defects (RTL leak, tile clipping, LTR gutter overlap, sous-vide "1 racks" mislabel) found by *viewing* screenshots — exactly the discipline the plan's §10.2 mandates | This is strong positive evidence the §10.2 viewing discipline was actually followed, not just claimed. |

**Doc 2 counts: 10 DONE (3 with documented post-ship refinements), 0 PARTIAL/NOT DONE/SUPERSEDED.**

---

## 3. `2026-07-20-equipment-properties-completion.md` (742 lines, 6 tasks, shipped v251)

| Spec:line | Requirement | State | Evidence | Notes |
|---|---|---|---|---|
| T1 (39-311) | `props[]` schema, `propOf`/`propDef`/`propSpec`, type-key build gate (E1), unit `propCoerce` | DONE | `app.js:106` `propSpec`; `app.js:117` `propDef`; `app.js:122` `propOf`; `app.js:131` `UNIT_CONV`; `app.js:149` `propCoerce` | `equipment-props.spec.ts` has 12 tests (plan specified 8, E1-E8); E1 is the build gate the plan calls "what proves the type strings above are exact." |
| T2 (314-406) | `cooler` item, grinder `multiCap.plates`, numeric accessory props | DONE | `app.js:6218` `key:'cooler'`; `app.js:90` `multiCap:{key:'plates',...}` | Confirmed by direct grep, not just test presence. |
| T3 (410-514) | Render props in device form, core inline / pro `<details>` | DONE | `paintVerify` renders `propField()` per `props[]`; `#eqProp-<key>` ids present | Not re-verified pixel-for-pixel; inferred from function presence + passing `equipment-props.spec.ts` (12/12, not individually re-run in this sweep — time-boxed). |
| T4 (518-573) | Property chips with icons on device cards | DONE | `chipsFor` extension present (confirmed by grep for the `.eq-chip` property-chip block) | Same caveat as T3. |
| T5 (576-670) | AI lookup extracts `props{}`, bounded, never invents | **DONE, via a different bounds mechanism than specified** | `app.js:6354-6363` — validation reuses `propCoerce(p,v)` against each prop's own `bounds`/`alt` (from T1), **not** a separate `const PROP_BOUNDS={...}` map as the plan's Step 3 literally prescribes | `grep -n "PROP_BOUNDS" app.js` → **zero hits**. The DoD (out-of-range AI values discarded, in-range kept, null→unset) is met — verified by reading the actual discard/convert logic — but the specific named symbol the plan's Self-Review calls out ("Type/name consistency… `props` is the return key") never existed as `PROP_BOUNDS`. A literal `grep` for the plan's own named artifact fails; the *behaviour* does not. |
| T6 (673-729) | No-regression gate (E8), ship v251 | DONE (superseded by later ships) | `build.py` version stamp is now `מהדורה 258 · 22.7.26` (`build.py:334`) | v251 shipped and was subsequently bumped many times; nothing regressed the E8 guarantees as far as this sweep found (existing `equipList()[0].cap.racks`, `probeChannels()`, `canSmoke()` all still function per doc-5 checks below). |

**Doc 3 counts: 5 DONE, 1 DONE-with-mechanism-drift, 0 PARTIAL/NOT DONE.**

**Related inert-shipment finding (see §4):** the deferred "warn when no grinder plate matches" (line 24, explicitly pushed to "the consumption layer, which is blocked on this one") was later attempted in commit `bb789aa` (`chooseBath`/`choosePlate`/`chooseNozzle`), but only `chooseBath` got a production caller (the Phase-2 sous-vide vessel body, doc 2 T8). `choosePlate`/`chooseNozzle` remain uncalled outside their own test file — so the deferred requirement is **still NOT DONE for grinder/stuffer**, three plans later.

---

## 4. `2026-07-17-phase3a-slice1-prefs-framework.md` (596 lines, 6 tasks, shipped v250)

| Spec:line | Requirement | State | Evidence | Notes |
|---|---|---|---|---|
| T1 (37-114) | Fix probe-telemetry-as-grounding safety bug | DONE | `app.js:5464` `aiSafetyNote(r.txt,(r.ctx\|\|''))` — `copilotVoiceContext()` no longer concatenated; the plan's 3 named call sites (`app.js:4454,5464,9326` in current numbering) all pass `r.ctx`/`SAFETY_FACTS()` only | Matches the plan's own "Step 5: verify no other call site launders" grep exactly. |
| T2 (118-237) | `PREFS` registry, `pref()`/`setPref()` | DONE | `app.js:6801` `const PREFS=`; `app.js:6827` `pref`; `app.js:6832` `setPref` | Verified by direct read against the plan's literal object (theme/fontPair/fontScale/uiLevel/tlShape/units + 7 orchestrator knobs) — keys match. |
| T3 (241-329) | 5 existing helpers delegate to `pref()` | DONE | `app.js:6864-6866` (`themeKey`,`fontPairKey`,`fontScale`), `app.js:7026` (`uiLevel`), `app.js:7028` (`tlShapeOverride`) — all one-line delegations | Exact match to plan text. |
| T4 (332-420) | `pref('units')` governs metric directive in 3 AI prompt builders | DONE | `app.js:4242,4345,5264` all gate on `pref('units')==='metric'` | Line numbers shifted (plan said 3219/3322/4235) due to intervening code, content matches. |
| T5 (424-511) | "Behavior & automation" hub `openPrefGroup()` | DONE | `app.js:7053` `function openPrefGroup()` | Matches `.ap-lbl`/`.ap-opts` reuse the plan calls for (no new CSS). |
| T6 (515-596) | Defaults-unchanged gate (P5), ship v250 | DONE | `tests/prefs.spec.ts` has 5 tests (P1-P5, matching the plan's 5) | Version now `258`; v250 gate itself not independently re-run in this sweep. |

**Doc 4 counts: 6 DONE, 0 PARTIAL/NOT DONE.**

**By-design non-consumer note (not a defect):** the 7 "orchestrator knobs" (`autonomy`,`shareTolC`,`woodSwap`,`holdEnabled`,`aiRank`,`slotModel`,`holdMaxH`) registered in `PREFS` have **zero consumers anywhere in `app.js`** (`grep -n "pref('autonomy')" app.js` → no hits; same for the other six). This is **exactly what the plan specifies** ("registered now so Slice 2/3 only add their consumers… no consumer = no dead controls" — line 199) and matches the CONTEXT's "Known 0%: Phase 3a solver." Flagged here only so a future auditor does not mistake it for drift — it is the plan working as designed, confirmed present in `openPrefGroup`'s own filter (`app.js:7057`, roughly: renders only prefs with `he && opts`, which the 7 knobs lack).

---

## 5. `2026-07-15-equipment-2.0-slice-1a.md` (551 lines, 6 tasks, shipped v230)

| Spec:line | Requirement | State | Evidence | Notes |
|---|---|---|---|---|
| T1 (26-133) | `mk-equipment` device-list model, `EQUIP_CATS`, aggregators, `equipMigrateFromGear` | DONE | `app.js:34` `EQUIP_CATS`; `app.js:221-229` `equipList/equipSave/equipId/equipByCat/hasCat/hasGear/primaryOf/cookers/probeChannels`; `app.js:754-755` `equipConfigured/equipSetConfigured`; `app.js:757` `equipMigrateFromGear` | All present verbatim. |
| T2 (136-207) | Port `canSV/canSmoke/canGrill/homeGear/gearConfigured` | DONE | `app.js:32` `gearConfigured`; `app.js:786-796` `canSV/canSmoke/canGrill/gearCan/homeGear` | Matches. |
| T3 (211-306) | Port `smokerTip/preheatHint/gearMissingHelp/gearThermoNote/wcimGearOk` off `gearState()` | Not independently re-verified line-by-line (time-boxed) | — | `gearState` itself is confirmed deleted (T5 evidence below), which is necessary but not sufficient proof T3's specific bodies match; treat as **DONE by strong inference**, not full citation. |
| T4 (309-378) | Concierge (`gearConciergeApply`) emits device-list entries | Not independently re-verified (time-boxed) | — | Same caveat as T3. |
| T5 (382-492) | `openEquipment()` manager; delete `openGear`/`gearState`/`saveGear`/`gearSetConfigured` | DONE | `app.js:6377` `function openEquipment()`; `grep -n "function openGear(\|function gearState(\|function saveGear(\|function gearSetConfigured(" app.js` → **zero hits** | Deletion requirement positively confirmed (absence, not just presence). |
| T6 (496-530) | Full-suite regression, ship v230 | DONE (superseded by later ships) | `build.py` stamp now `258` | Not independently re-run for this sweep. |

**Doc 5 counts: 4 DONE (2 solidly, 2 by strong inference), 0 PARTIAL/NOT DONE.**

**Orphaned commitment confirmed:** the plan's own "Follow-on slices" (line 532) name "Phase 3 (auto-optimize + live)" as a future slice. `grep -n "'autopilot'" app.js` → only the `PREFS.autonomy` registration (doc 4, line 6814) — no autopilot/auto-optimize logic anywhere. Consistent with CONTEXT's "Phase 3a solver… 0%."

---

## 6. `2026-07-15-i18n-foundation-phase0.md` (363 lines, 5 tasks, shipped v229)

| Spec:line | Requirement | State | Evidence | Notes |
|---|---|---|---|---|
| T1 (21-90) | `L(he,en)` dict-aware for fr/de/es, English untouched | DONE | `app.js:6896` `function L(he,en)` matches plan exactly (`he`→source, `en`→inline arg, other→`getDict()[he]` else inline `en`) | `i18n-foundation.spec.ts` "Change 1" passes live (re-run in this sweep). |
| T2 (94-161) | `LANGNAME` map; `aiJSON` `outLang` names the real language; `mtTranslate` dedupe | DONE | `app.js:6880` `const LANGNAME={en:'English',...}` | "Change 2" passes live. |
| T3 (165-268) | Wrap ~22 hardcoded-Hebrew `toast()` literals in `L(he,en)` | **PARTIAL / mechanism-superseded** | See detail below | The literal instruction (wrap in `L()`) was **not applied** to the sites the plan named; the *observable behaviour* (English toast text) is nonetheless achieved through a different, later mechanism. |
| T4 (272-305) | Build-time i18n coverage report (non-fatal) | DONE | `build.py:376` `print("[i18n] %s: %d/%d keys vs en (%d%%)%s" ...)` | Confirmed live in this sweep's own `python build.py` run: `[i18n] de: 83/3985 keys vs en (2%)` etc. |
| T5 (309-363) | Ship v229 | DONE (superseded by later ships) | `build.py` stamp now `258` | — |

**Doc 6 counts: 4 DONE, 1 PARTIAL.**

### Detail on T3 (the one real PARTIAL in this sweep)

All ~16 checked Hebrew toast literals from the plan's table (`app.js:668,2381,2450,2479,2501,2554,3591×2,4158,4159,4182,4183,4194,4824,4826,4827,4837` in the plan's original numbering) are **still raw Hebrew string literals in `app.js` today, not wrapped in `L(...)`** — confirmed by direct grep, e.g. `app.js:4740`: `function copyText(t){...toast('הרשימה הועתקה ✓');...toast('הועתק');}`. A literal `Edit`-level check of the plan's Task 3 Step 3 therefore reads NOT DONE.

However, empirically re-running the exact scenario the plan's own Task 3 test specified (`setLang('en'); copyText('hello')`) in a throwaway spec (created, run, and deleted in this sweep) returns **`"List copied ✓"`** — correct English. The reason: `toast()` (`app.js:2775`) already runs every message through `tr(msg)=getDict()[msg]||msg`, and `getDict()` returns `I18N_DICTS['en']` for English (not `null`) — so any Hebrew literal that has a matching key in `lang/en.data.json` is translated at render time without needing `L()` at all. Direct check confirms **all 16** table strings *are* present as keys in `lang/en.data.json` (e.g. line 2001: `"הרשימה הועתקה ✓": "List copied ✓"`).

**This is a genuine plan/code contradiction, not a false alarm:** the *live* `tests/i18n-foundation.spec.ts` "Change 3" test no longer even tests `copyText` — it was rewritten (at some undated point after the plan shipped) to test `importData`'s *interpolated* restore-count toast instead, with an explanatory comment: `// standalone toasts are already dict-covered; interpolated ones (e.g. restore-count) can never be dict keys`. That comment is the project's own admission that Task 3's literal mechanism (code-level `L()` wrapping) was abandoned in favour of a dictionary-level fix, and the regression test was quietly narrowed to match — rather than the plan's originally-specified `copyText`-based test being kept and passing on its own terms. The DoD (English toasts show English) is met; the implementation path and its test coverage diverge from what the plan documents.

---

## Contradictions found

1. **Doc 1 T7 vs Doc 2 (whole doc).** Doc 1 specifies the occupancy view's markup as `.occ-dev/.occ-bar/.occ-item/.occ-slots/.occ-warn`, rendered from a flat `%` bar. Doc 2 replaces every one of those classes with `.occ2-*` device-silhouette diagrams (cabinet/offset/grill/vessel/bay). This is a **documented** supersession (Doc 2's own "Naming note", line 38, anticipates exactly this collision-then-replacement), so it is reported as SUPERSEDED, not a silent contradiction — but a reader of Doc 1 alone, without Doc 2, would implement dead code.

2. **Doc 3 (equipment-properties-completion) Task 5 vs shipped code.** The plan names a specific new symbol, `const PROP_BOUNDS={...}`, as the AI-lookup validation mechanism and calls it out by name in its own Self-Review ("Type/name consistency"). The shipped code instead reuses `propCoerce`/`props[].bounds` from Task 1 — a real, better (DRY) design decision, but it means the plan's own named-symbol self-check does not hold against current code. `grep PROP_BOUNDS app.js` returns nothing.

3. **Doc 6 (i18n-foundation) Task 3 vs shipped code and its own test.** Covered in full above — the plan's literal mechanism (per-site `L()` wrapping) was not applied to the sites it names; a dictionary-driven mechanism was substituted; the regression test was rewritten to stop asserting the originally-specified scenario. Functionally equivalent outcome, divergent implementation and test coverage from what the doc claims.

4. **CONTEXT's `chooseBath`/`choosePlate`/`chooseNozzle` claim — verified true, and traced to its origin.** None of the six audited plans mentions these three functions by name (they come from commit `bb789aa`, outside this sweep's document set — likely the deferred "consumption layer" plan doc 3 explicitly pushes out of scope at line 24, which the sweep did not find as a separate large plan doc). `chooseBath` now has one production caller (`app.js:630`, Doc 2 T8's vessel body). `choosePlate`/`chooseNozzle` (`app.js:3014`,`3024`) have **no caller anywhere except their own test**, `tests/equip-chooser.spec.ts` — a clean inert-shipment case: registered grinder-plate/stuffer-nozzle properties (Doc 3 T1/T2) are captured, stored, and "chosen" by a pure function that computes the right answer, but no UI or work-plan ever reads that answer. The commit message that introduced them claims the sous-vide, grinder-plate and nozzle-choice problems were all "fixed" together; only one of the three actually reaches a screen.

---

## Inert-shipment hunt — summary

| Symbol | Computed at | Consumed at | Verdict |
|---|---|---|---|
| `chooseBath(dev,needL)` | `app.js:3004` | `app.js:630` (`_occVesselBody`, Doc 2 T8) | Wired — NOT inert. |
| `choosePlate(dev,wantMm)` | `app.js:3014` | **nowhere in `app.js`** — only `tests/equip-chooser.spec.ts:51,74` | **Inert.** The grinder `props.throughput`/`multiCap.plates` data (Doc 3 T1/T2) is captured but never joined to a recipe's `grind_mm` in any user-visible surface. |
| `chooseNozzle(dev,casingMm)` | `app.js:3024` | **nowhere in `app.js`** — only `tests/equip-chooser.spec.ts:64,74` | **Inert.** Same pattern for stuffer nozzles. |
| `PREFS.autonomy/shareTolC/woodSwap/holdEnabled/aiRank/slotModel/holdMaxH` | `app.js:6801` `PREFS` | **no consumer** | Not inert by accident — the plan (Doc 4, line 199) explicitly designs this as "registered, no UI, no dead controls." Correctly documented, not a violation of the mission's letter-of-the-law but flagged per instructions since it does technically match "registered and never read." |
| Doc 6 T3's per-site `L()` wrapping | (never written) | — | The *requirement* is unimplemented; the *outcome* is delivered by a substitute mechanism (`lang/en.data.json` + `toast()`'s existing `tr()`). Not "computed and unread" — the opposite pattern (read via a path the plan didn't specify). Documented above, not double-counted here. |

---

## Orphaned commitments (10 most significant)

1. **Doc 3 line 24 / Doc 3 T5's Self-Review** — "warn when no grinder plate matches" (the recipe↔device join). Explicitly deferred to a "consumption-layer plan" which does not appear among the six largest specs and was not found elsewhere in `docs/superpowers/plans/`. `choosePlate` exists (commit `bb789aa`) but is never called from a warning, a work-plan row, or any UI. **Two plans deep, still not delivered.**
2. **Doc 3 T5's Self-Review**, same paragraph — the stuffer-nozzle equivalent (`choosePlate`'s sibling `chooseNozzle`). Same status.
3. **Doc 1's Self-Review (line 1220-1221)** — "Spec §3 (Slice A: preheat, fuel, refuel)" — explicitly deferred, its own follow-on plan not found among the six audited docs nor (by name) elsewhere in the sweep's search.
4. **Doc 1's Self-Review (line 1221)** — "Spec §5 C2 (probe channels monitoring)" — deferred to Slice A above; `probeChannels()` exists as a simple sum (Doc 5 T1) but no live-monitoring/occupancy tie-in was found.
5. **Doc 4's Global Constraints (line 21)** — `PREF_PRESETS`/`prefPreset()` and the preset selector, moved to "Slice 2." `grep -n "PREF_PRESETS\|prefPreset" app.js` → no hits. Still absent.
6. **Doc 4's 7 orchestrator knobs** (`autonomy` etc.) — registered with zero consumers, per design, awaiting the Phase 3a solver. Confirmed still 0% (matches CONTEXT).
7. **Doc 5 line 532** — "Phase 2 (contention warn+suggest)" is delivered (occupancy layer + Phase 2 diagrams). **"Phase 3 (auto-optimize + live)" is not** — no autopilot logic anywhere in `app.js`.
8. **Doc 6's Task 5 follow-on note (line 346)** — full voice-assistant localization (`vcBuildAskPrompt`, `vcAnsLang`/`vcLang`) explicitly left he/en-only. `de`/`es`/`fr` coverage is still ~2% per this sweep's own `python build.py` output (`[i18n] de: 83/3985 keys vs en (2%)`), consistent with the deferral never having been picked up.
9. **Doc 6's Task 5 follow-on note (line 346)** — "the dead `data-i18n=` markup (build.py)" flagged as a deferred cleanup from an audit; not independently re-verified in this sweep (would require a `build.py` grep outside the time budget), listed here as a claim worth a follow-up check, not a confirmed finding.
10. **Doc 1's "Known limitation" note (line 1224)** — flagged `combinedEventsRows` as needing migration "in the follow-on." This one is **resolved** (Doc 1 T9, commit `30634ac`) — included here only to note that the doc's own text is now stale in-place (still reads as an open limitation) even though the code has moved past it. Not a functional gap, a documentation-freshness gap.

---

## What could not be verified in the time budget (flagged, not claimed)

- Doc 3 Tasks 3-4 (form rendering, chips) and Doc 5 Tasks 3-4 (tip/note porting, concierge) were confirmed present by symbol-existence and passing-test-file evidence, not by re-reading every line of the rendering code against the plan's exact HTML strings. Treat those rows as DONE-by-strong-inference.
- App.css token-by-token diff for Doc 2 T4 (3 `:root` blocks) was not performed; the passing `occ-css-tokens.spec.ts` was accepted as the DoD's own gate, per that task's literal wording ("Step 4… PASS (2/2)").
