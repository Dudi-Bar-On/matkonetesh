# Wave 1 (browser) + Wave 2 (verification) + Wave 3 (synthesis) — agent returns, verbatim


## ?

Report: `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\W1-C-app-walkthrough.md` · 188 screenshots in `docs\analysis\shots\sweep\`

**Covered (45 surfaces, he + en, some fr/de):** first-run modal, home, catalog landing + cuts, cut detail, events, projects/pantry, more-sheet, wizard steps 1-6, cart, scheduler (item + work-plan), occupancy (9-device seeded kit), meal builder, equipment manager + edit + add forms, AI hub, voice-cook (real path, 23 tasks), live copilot, appearance, journal, active-now, Ask, seasonings + detail, calculators, woods, guide, rescue, about, key manager, UI level, prefs, backup, recipe gen, gear concierge, reminders, cut translator, home customize, combined timeline, AI event planner, print menu, language switching, 320px. **Zero console errors anywhere.**

**Defects: 6 high, 11 medium, 7 low.**

**8 most significant surprises**
1. **`data-mt` attribute-name collision** — i18n's `hydrateMT` (app.js:6989) treats `data-mt`'s *value* as source text; the method toggles use `data-mt="sv"` as a domain key (app.js:1019), so in EVERY non-Hebrew language the three method buttons on every recipe are overwritten with raw keys `sv`/`smoke`/`grill`. It returns early for `he`, which is why nobody saw it.
2. **The serving date paints `22/07/202`** — value verifiably `2026-07-22`, `scrollWidth===clientWidth` so no DOM signal; only pixels reveal it. The field that decides which day a 30h cook lands on.
3. **The shipped UI still says "הנתונים מקומיים, ללא חיבור לרשת"** — the offline claim is in the app footer, not just the README.
4. **Tapping the kosher filter once permanently reverts it to Hebrew** in English (app.js:1705 overwrites the `L()` output at 1697); and `#count` is hard-coded Hebrew (1679), as is every card's metric line (1563-1571).
5. **Two cooking-area fields on the device editor**, near-identical Hebrew labels; `#eqvArea`→`cap.area` is display-only, `#eqProp-areaCm2` is what the fit engine reads. Fill the wrong one, capacity planning silently ignores you.
6. **Navigating to Catalog scrolls the search box AND the ☰ header off-screen** (`scrollY=179`, `#q` top `-72`) while the visible copy says "or search above".
7. **The work plan says "I cannot check capacity" and then reports a capacity conflict on the next line** — and the Hebrew calls a sous-vide bath overflow an *area* overflow (app.js:5920) for a device it measures in litres.
8. **Everything you touch with greasy hands is the smallest thing on screen**: step checkboxes 26×26, timer ▶/↻ 30×30, wizard step nav **55×7**, scheduler checkbox **13×13**, pantry delete **14×20** — while the bottom nav is 78×70.

I dropped 9 claims that did not survive measurement, listed in §3 — including two bidi "scrambles" (per-character `getBoundingClientRect` proved both render correctly), a task-ordering bug (array is monotonic; the day marker is what's missing, and only in voice-cook), a nav-overlap, and a voice-cook "dead end" that was an artefact of my own no-arg call.

## ?

Report written. No tracked source file modified.

**FLOW MAP** (single-event): `menuState.keys` → `buildList` (app.js:5653) → `itemProfile`/`activeMethods` (2922/832) → `itemStages` (3213) → `equipPlan` PURE (973) → `planSchedule` PURE (2978) → **caller writes times onto stages** (5679) → `schedulePlacements` PURE (3089) → shift applied only if all stages share one slack (5700) → `workPlanHtml` (5771) → `window._wpTasks` global (5878) → 3 shapes (5934/5945/5952) → `wireTimer` (2326), `_copilotStages` (5362), `openVoiceCook` (5517).
**Multi-event** (`combinedEventsRows`, 7832) runs only `itemStages` + `planSchedule`: no `equipPlan`, no `schedulePlacements`, no `blocked` concept, and a weaker contention rule (7882).

**Known context — all three CONFIRMED.** `orchestrate/movesForClash/applyMove` are `undefined` at runtime. `choosePlate`/`chooseNozzle` appear exactly once each in dist (definition only) — but are unit-tested in `tests/equip-chooser.spec.ts:51,64`, so they read as covered. `equipPlan` has one call site (5673).

**VIEW DIVERGENCES (measured):**
1. **Three capacity rules, one device.** Placer uses whole-device area (3155); clash banner uses per-slot (277); combined view uses whole-device only (7882). Measured: same instant, brisket+ribs → combined says *no clash*, single-event says *clash*. The comment at 277-281 names this bug as fixed — it was fixed in only one of the two paths.
2. **Serve time.** `mk-tlserve` is global and never written back to `ev.serve`. Real edit 19:00→22:30: plan+serve bar say 22:30, the event banner 100px above says 19:00, combined view says 19:00 with every start 3.5h wrong. Screenshot: `docs/analysis/shots/w1g-serve-divergence.png`.
3. **Multi-day items.** Single-event excludes them ("not included in the daily schedule"); combined view scheduled a weeks-long dry-cured salami 9 minutes before serve.
4. **Plan shapes.** 15 tasks: vertical has 15 checkboxes + done + "Next"; accordion and horizontal have 0/0/0.

**8 GAPS A COOK WOULD NOTICE:**
1. **The placer never places.** 22-menu sweep: 0 non-zero slacks, 0 shifts. It tests fit against whole-device area while the binding limit is per-shelf, and only ever pulls to another item's start. `readyEarlyMs` and `SCHED_PULL_MAX_MS` are inert.
2. **When it would place, the caller discards it** (5700-5701): any item with an sv stage (slack always 0) plus a pulled smoke stage → shift dropped, and no advisory fires because successful placement raises no conflict.
3. **The multi-event view is a weaker product** — no equipment, no capacity placement, no blocked items, weaker clash rule.
4. **Serve time contradicts itself on the same screen** (§2.2).
5. **Check-off is broken three ways**: absent in 2 of 3 shapes; key is the translated label so a language switch wipes ticks (2→0); identical refuel labels collide — 3 stick-burner refuels at 19:15/20:00/20:45 share **one** checkbox key.
6. **Copilot reserves no rest.** `copilotPace` reads `s.restMin` (5413) which is never written — verified `'restMin' in session === false`. "On pace" can mean zero rest on a brisket the plan gives 1h. Also `_copilotStages` reads the single global `_wpTasks`: opening event B re-pointed event A's live session at B's tasks.
7. **Timers are stopwatches** (5838/2326) — not reconciled with the clock time the plan assigned; starting 40min late shifts nothing.
8. **The equipment seam is empty for most kit.** Probed all 16 `EQUIP_CATS` types: 7/8 smokers get a fuel note (the **default** cabinet gets none), 0/5 grills, 0/3 ovens — both tables are keyed by smoker-type strings.

Also verified as *not* bugs: `schedulePlacements(computed, null)` resolves the correct scope via `itemCookerScope` (240); the runtime safety invariant (3039) genuinely runs and found no violations. Separately, `_svBatch` (5782) tells the cook "use the 24L bath for all" with no volume check, while `deviceOccupancy` (485) states it cannot verify that fill.

## ?

Report written to `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-D-nonfunctional.md`. (The two modified PNGs are screenshots touched at 09:21 by a concurrent browser-driving agent; `build.py` has zero references to `docs/analysis` — I modified no source.)

**CONFIRMED: 22 · REFUTED: 4 · UNVERIFIABLE: 1**

REFUTED (all four are the same root error — diffing `lang/en.json` alone instead of the runtime dict; `build.py:362-366` merges `en.data.json` into `I18N_DICTS.en`, traced `toast`→`getDict()` app.js:6889→`I18N_DICTS` app.js:6877→`build.py:378`):

1. **"55 of 56 toasts (98%) untranslated"** — FALSE. 53 Hebrew-literal toast sites, **0 missing** from the merged dict (309 + 3,677 keys). Every named "representative miss" resolves: `הפרויקט נמחק`→"Project deleted", `מפתח לא תקין`→"Invalid key", `כל הנתונים אופסו`→"All data reset", `נשמר ל"המתכונים שלי" ✓`→'Saved to "My recipes" ✓'. Confirmed in the shipped `index.html`, not just source. This is recorded false alarm #3, repeated verbatim.

2. **"The PWA update toast (app.js:9553) is untranslated"** — FALSE for the message: `גרסה חדשה זמינה`→"A new version is available", present in the built `index.html`.

3. **"Three toasts are structurally unfixable"** (app.js:5323, 6107, 6108) — FALSE. 6107/6108 wrap every segment in `L('שוחזרו','Restored')`, and `L()` returns the inline English for `lang==='en'` (app.js:6899); only the `⚠`/`✓` emoji is literal. 5323 interpolates the user's own speech input.

4. **"56 distinct evidenced untranslated strings, supersedes 18"** — FALSE. Actual English-mode count is **3**.

NEW defect the report missed (found while refuting #2): toast *action-button* labels do leak Hebrew — `'רענן עכשיו'` (app.js:9553; "Refresh now" absent from `index.html`) and the default `'בטל'` (app.js:2776, `tr(actionLabel||'בטל')`). Neither is rescued by `tnode()`'s prefix-strip — its regex `^([^A-Za-z0-9֐-׿]+)(.+)$` requires a non-Hebrew leading char.

The report's §1.4 sub-claim survives and is the *real* i18n finding it mis-assigned to English: **fr/de/es cover 0 of 53 toasts** (83-key dicts, exact lookup, no English fallback in `tr()`), vs 53/53 for English. All of §2 (PWA), §3 (performance, incl. the 4×/sec TreeWalker mechanism), §1.2 `cwLbl`, §1.3 (all three doc conflicts), and six §4 accessibility findings are CONFIRMED; charcoal/walnut/slate contrast is UNVERIFIABLE and was correctly not claimed.

## ?

CONFIRMED 16 · REFUTED 8 · UNVERIFIABLE 3 — written to C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-F-ai.md

REFUTED findings:
1. §5 "no fixture corpus / no eval harness — confirmed absent by search" and "the W1-P7 prompt list is currently just prose in a planning doc". `tests/ai-trust.spec.ts` exists and implements 3 of the 4 proposed axes, including the exact 4 prompts named, inside a 16-entry `const DANGEROUS = [...]` corpus plus `test('W1-P7: every dangerous prompt hits a safety layer')`, refusal recall on 15 phrasings + 7 carve-outs, and numeric-guard tests. What survives: no CI at all (`.github` absent; `package.json` test = stub), and the Grounding axis is untested (`grep -rl "aiValidateKeys|aiValidateItems|aiValidateSeasonings" tests/` → nothing).
2. §1 "13 distinct AI entry points" — there are 14. `grep -n "gemFetch(" app.js` exposes `vcTranslateToEn` (app.js:5186, transport 5196), spoken aloud via `vcSpeakContent` 5203-5213.
3. §4 "mitigating factor present everywhere except vcAskAI" — `vcTranslateToEn` is a second exception, and worse: `mtTranslate` guards the same content class with `mtGuard`/`mtSafe` (6951-6958); `vcTranslateToEn` returns model text raw, caches it, speaks it.
4. §4 "aiSeasonRec's r.reason truncation is the only type guard on that field" — that field is fully guarded (`typeof r.reason==='string'` at 8415) and escaped (`esc()` at 8423). The actually-unguarded field is `pantryAdvisorAI`'s `reason:r.reason` (9176), rendered UNESCAPED into innerHTML at app.js:8246 — an injection path the report missed.
5. §2 "Diagnose's example chips invite exactly the dangerous inputs the refusal list exists for" — neither chip matches any `AI_REFUSALS` test; `unsafe-mold` (4177) needs a second term (wash/eat/trim/…) and "עובש **לבן**" is the normal case per SAFETY_FACTS 4128. The underlying finding still holds; the justification does not.
6. §6 "Every AI-writes-state feature routes through aiConfirmPanel" — only 2 call sites (8363, 8594). The seasoning recommender writes state directly via `cwApplySeasKind` at 8433-8440.
7. §8 "vcSpeak error mapping … tailored Hebrew+English messages" — all four detail strings (5065-5068) are Hebrew-only literals with no `L()`; only the toast envelope is bilingual.
8. §0 citation "app.js:334 ships 'הנתונים מקומיים…'" — `grep -c` in app.js = 0; app.js:334 is `deviceSilhouette()`. Substance confirmed at build.py:334 / index.html:1916; README phrase is at README.md:4 not :3.

The headline finding (Tier D — Voice Cook Q&A unguarded, spoken, search-grounded) is CONFIRMED by independent re-derivation: guard sites are exactly 4454/5464/8499/8664/9326 and `askRefuse(` has one call site (4448).

## ?

**CONFIRMED 24 · REFUTED 1 · UNVERIFIABLE 1** — written to `C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-G-workflows.md`

REFUTED (1):
- **§5.1 "readyEarlyMs, the ⏳ chip, SCHED_PULL_MAX_MS and the whole Phase 4b story are inert in practice — the app never reschedules; it only advises."** False. `tests/scheduler-placement.spec.ts:153` ("C3: a small pull staggers the real plan and the timeline says the item is ready early") drives the real UI via `openTimeline()` and asserts `.tl-early` renders. I ran it: `15 passed (13.0s)`, C3 among them. `.tl-early` is emitted only by `readyEarlyNote` (`app.js:5976-5982`), which requires `c.readyEarlyMs>0`, written only at `app.js:5706` — after a non-zero slack from `schedulePlacements`, after the uniform-slack gate at `5701-5702`, after the stage rewrite at `5704-5705`. The chip cannot appear unless the whole path fired. `B1`/`B2`/`B4`/`C1` also pass, covering staggering, slack accounting, the deliberate no-op on a roomy cooker, and the `pull-too-far` refusal. What survives: whole-device `usableCm2` is the wrong fit test (`3155` vs per-slot only rejecting at `3144`), the candidate set is `[latestFinish] ∪ {placed starts}` (`3149-3151`), and sv stages always carry slack 0 (`3129→3141`).

UNVERIFIABLE (1):
- §5.1's "22 realistic menus → 0/22 slack, 0/22 shift". No script committed; ad-hoc browser probe, nothing to re-run. Plausible for that kit, but the conclusion drawn from it is refuted above.

Corrections that do not flip a verdict: (1) five anchors drift by one line (`5700-5701`→`5701-5702`, `5705-5707`→`5704-5706`, `5712`→`5711`, `5903-5912`→`5904-5913`, `5975-5987`→`5976-5983`); quoted code is verbatim-correct. (2) §5.8's framing "the equipment seam is empty" overstates — `_preheatRow`/`preheatMinutes` (`app.js:934-953`, read at `5721-5722`) is a second device-type→plan path covering all 8 smoker types incl. the cabinet, green in `equipplan-seam.spec.ts` P3a/P3c; `SMOKER_TIPS` (`912-932`) covers all 8 on the card. Its literal claim (equipPlan is a no-op for most kit; cook stages carry no equipment instruction) holds. (3) No "sample kit" exists (`mk-equipment` written only by `equipSave`, `222`) — the cabinet is just `EQUIP_CATS.smoker.types[0]`; and the diagram's K2 node omits `bath-too-small` (`3139`).

No source file was modified. I stopped two stale `node serve.js 8123` processes left over from the audit so Playwright could start its own server.

## ?

CONFIRMED 28 · REFUTED 8 · UNVERIFIABLE 4 (40 claims). Report at C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-H-probes.md. All Section 0 code cites (app.js:229, 6425, 85, 88, 5381, 5395-5416, 3261, 5159-5161, 5815, 5993) are exact; zero Bluetooth code repo-wide, not just in app.js.

REFUTED:
1. §1 Progressier quote "A PWA that runs a Bluetooth-connected service in the background... not possible on any platform" (+ "traffic is throttled when backgrounded/screen-off"). Two fetches of progressier.com/pwa-capabilities/bluetooth, one asking for every sentence containing background/throttl/screen/native app, return no such text. Progressier is also not "the Chrome team". The underlying limit is real but must be sourced to MDN ("not available in Web Workers") + WebBluetoothCG issue #422 (open since 2018).
2. §3 "a GitHub discussion specifically covers pulling previous-cook info via the API" — meater discussion #34 is an unanswered customer complaint (0 comments) about incorrect Previous Cooks weblinks. The README exposes only /devices and /devices/{id} live state, returned only while the app/Block holds an active BT+Cloud connection. MEATER is not a log-import source and cannot be polled with the phone app closed.
3. §2 "Web Bluetooth can technically read advertisement data via watchAdvertisements()" / Govee "easiest target". WebBluetoothCG implementation-status.md: getDevices() and watchAdvertisements() are behind chrome://flags/#enable-experimental-web-platform-features (Chrome 85 flagged). Not buildable for real users.
4. §4 Joule inference "implying it relies on Wi-Fi/cloud for anything beyond the initial pairing" — the same ChefSteps source continues "to make changes during a cook, you will need to be back within Bluetooth range", i.e. autonomous cooking with no connection.
5. §2 combustion-ble Python package listed inside the "fully open, official" cell — it is community (github.com/legrego/combustion_ble); the combustion-inc org has no Python SDK.
6. §1 Bluefy "iOS 11+" — App Store says "Requires iOS 12.0 or later".
7. §2 Govee "two-byte temp/humidity values" — GoveeWatcher documents three concatenated octets encoding both (03 21 5d → 205149; /10000 = 20.5149C, %1000/10 = 14.9%).
8. §0 accuracy "that nothing currently reads" — chipsFor (app.js:6388, loop 6394-6399) generically renders every declared prop including accuracy as a device chip. Correct wording: no logic consumes it.

UNVERIFIABLE: Android Doze scan-deferral/connection-drop (cited Android page does not say it; other cite is a personal blog); wake-lock battery drain + visibilitychange re-acquisition (absent from cited sources); Inkbird 2-year CSV export (single community forum post); Anova/MEATER CORS (report already hedges correctly).

Survived intact: Anova (UUID 0e140000-0af1-4582-a242-773e63054c68, protobuf+COBS, "available to everyone"), MEATER Cloud API details verbatim, ThermoWorks, Weber, Inkbird BLE, Combustion MIT spec + SDKs, caniuse 76.78%, and the §5/§6 wiring analysis.

## ?

CONFIRMED 57 | REFUTED 4 | UNVERIFIABLE 2 — full detail at C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-B-conformance.md

All four contradictions and both inert-shipment findings SURVIVED refutation with independent evidence. The 4 REFUTED items are the report's own hedges (it under-claimed) plus one wrong number:

R1. Doc 2 T4's caveat "not re-verified against all 3 theme blocks" is refuted. app.css has ONE :root (line 2, tokens at 17-18); the other two CSS theme blocks are dead legacy that applyAppearance strips every paint (app.js:6997 `el.classList.remove('light','t-vintage','t-gold')`). Real themes are the JS THEMES object (app.js:6840-6848) — all 4 (cream/charcoal/walnut/slate) carry all 5 diagram tokens with distinct values. occ-css-tokens.spec.ts:26 asserts exactly this; passed live. T4 is fully DONE and fully verifiable.

R2. "DONE by strong inference" for Doc 3 T3/T4 + Doc 5 T3/T4 is refuted — all four are directly citable: app.js:6603 propField, 6622-6623 core/pro tiers, 6388/6394-6398 chipsFor property chips; app.js:932 smokerTip, 953 preheatHint, 987 gearMissingHelp, 1026 gearThermoNote, 8139 wcimGearOk, 6144 gearConciergeApply. Also `grep -c gearState app.js` → 0 (zero references, stronger than the report's claim).

R3. Orphan #9 ("dead data-i18n markup — not confirmed") is refuted as unconfirmed: it IS confirmed. build.py ships 13 `data-i18n=` + 1 `data-i18n-ph=`; the only runtime reader is applyI18n (app.js:6905) which queries exclusively `[data-i18n-html]`. 14 of 15 attributes are never read.

R4. Methodology header "63 occupancy specs" is wrong: 19 occ*.spec.ts files, 86 tests. No subset yields 63.

Fresh evidence run: 23/23 Playwright tests passed (14.1s); `python build.py` → `[i18n] de/es/fr: 83/3985 (2%)`, git clean; 28 `"hang":` keys counted in built dist/index.html (build pipeline, not a source grep); PROP_BOUNDS → zero hits outside the plan doc; choosePlate/chooseNozzle → zero callers outside tests, and no equivalent plate/nozzle join exists under any other name (checked grind_mm/plates/nozzle/פלטה/פייה and equipPlan).

UNVERIFIABLE: (1) "passes live" for the ~14 occupancy specs I did not re-run (names all verified to exist); (2) commit 92961db's "366/366 green" — a past-run claim not settleable from the repo today.

## ?

CONFIRMED: 22 · REFUTED: 5 · UNVERIFIABLE: 1
Report: C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-A-code.md
Tree verified unchanged from the audited commit (`git diff 380c57a..HEAD` empty for all audited files); no source file modified.

REFUTED findings:

1. **"14 captured device properties with zero readers" (§2) — FALSE.** All 14 are read at runtime. The report's grep only matched dot-notation; every read is bracket notation: `app.js:6393-6399` `(c.props||[]).forEach(... d.cap[p.key] ...)` in the live chip renderer (called at `6432`), `6390` for the `multiCap` keys `plates`/`nozzles`, `2998` `_sizesOf`, `6602` form prefill. Playwright proof against the built app: 14 properties set → 14 chips rendered; `cap={}` → 0 chips. Narrower true claim: display-only, never reaches the planning engine.

2. **§1's exemplar for the "systemic pattern" is a misquote.** Report quotes `app.js:5673` as `if(typeof equipPlan==='function') stages=equipPlan(...)`. Actual line: `stages=equipPlan(m, st.method, stages, (typeof evScope==='function'?evScope():null));` — the guard is on `evScope`. `equipPlan` has one call site, unguarded; deleting it throws loudly. (The general 483-guard count is correct — verified exactly 483.)

3. **§3's second plural bug site `app.js:8010` — unreachable.** Line 8009 is `if(list.length>=2){`, so the count is never 1. Runtime: `#cetFull` absent at n=1. One live bug site, not two.

4. **§3's contrast case `app.js:5900` (`cookerStripHtml`) has no count and no conditional** — it renders `🔧 Assign cooker:`. The "fix exists ad hoc in one place" narrative has no referent.

5. **Empty-catch count wrong:** `catch(e){}` = 116, `catch{}` = 0 (129 whitespace-tolerant), not 108.

Two corrections inside CONFIRMED findings: the stale-offline footer (§4) **is** translated — `lang/en.json:261` → "Data is local, no network connection", so the false claim ships in both languages (finding survives, supporting evidence was unsound); and §5's "all outbound network traffic" excludes Google Fonts `<link>` tags at `build.py:144-146`.

## ?

CONFIRMED 16 · REFUTED 9 · UNVERIFIABLE 1. Report: C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-E-food-safety.md (no source file touched).

REFUTED, with evidence:
1. "32 of 102 MAKE_SOURCES calc overrides where cure is the bare number 2.5" — 32 have a `calc` key but only **19** are `cure: 2.5`; the other **13** are `cure: None` (all `n-*` from sausages_new). Conclusion survives; count is wrong.
2. "**One** of these 32 (m-nduja) carries a CRITICAL GAP note" — **five** do: m-cacc, m-nduja, m-sauci, m-sopr, m-sucuk. All five are equally stale (all ship `calc.cure='2'` via data.py:400).
3. "156 ppm is squarely inside the microbiologically-effective range (72-150 ppm)" — 156 > 150. Re-fetched PMC6043430: "did not grow in the presence of 72 to 150 ppm nitrite".
4. Bacon "matches 9 CFR 424.22(b)'s 120 ppm mandate exactly" — re-fetched Cornell LII: 120 ppm is *required* for **pumped/massaged** bacon; **dry-cured** bacon (which data.py:421 "כבישה יבשה" actually is) is "shall not exceed **200 ppm**", no minimum. Wrong clause.
5. §1 "Verification: absent, no confirmation step" — every Work-Plan row incl. `bcheck` has a **persisted checkbox** (app.js:5940 render, app.js:5766 `store.set`). Only the *numeric reading* is missing.
6. §1 `safetyDiff` is "Real, **enforced**" — it writes to `window._planSafetyViolations` (app.js:5717) and the **only** reader in the repo is tests/safety-invariant.spec.ts:81. Nothing blocks, nothing renders; the code comment's "surfaced" is unimplemented.
7. §2.1 rationale "those 33 specials have no `safe` field in data.py" — **0 of 47** specials have a `safe` field, including the 14 that *do* carry a `src.safe` citation. Conclusion right, reason false (the real distinction is `cat="גבינה"`, n=15..47).
8. §5 "`saved` vs `svh`: no cut saves more than its sous-vide hold — internally consistent" — **9 cuts violate it** (n=49 Salmon 1.5 vs 0.75; n=50 Trout 1.2 vs 0.5; n=106; and six shellfish with `svh="0"` yet saved 0.26-0.85). Also the wrong invariant: `saved` = smoker hours vs smoke-only (app.js:1569/2092, data.py:227); `saved ≈ soh−smh` mismatches on **29/130**.
9. §5 "no negative, **zero**, or absurd values" — six cuts carry `svt=0` (n=120,121,122,128,129,130).

Also corrected inside CONFIRMED items: §3.1's table omits 2 of 13 categories (12 organ cuts incl. four at 72°C, plus one at 71); §3.4's comparator is 72°C not 74°C; §2.3's discriminator cite should be app.js:1919/1922-1923 not 8533-8534; §4's unresolved `grz` question is now settled — one consumer only (app.js:2035), not wired into the scheduler.

## ?

CONFIRMED 21 · REFUTED 3 · UNVERIFIABLE 0. Report at C:\Users\dudib\source\repos\matconetesh\docs\analysis\sweep\VERIFY-W1-C-app-walkthrough.md. All 20 cited line numbers are exact; no source file modified.

REFUTED:

**D15 ("occupancy opens on an empty rack; a 'busiest moment' default would open on the answer")** — that default already ships. `app.js:698-713` `_occOpenAt` returns the wall clock only `if(anyAt(span.now))`, else scans every stage start and returns the instant with the most items; the comment at 695-697 states this intent verbatim. It opened at 08:09 *because* the Anova bath was loaded then — which the report itself says. The real residual issue is device card order, not the default time.

**D18 ("פרויקטים ומזווה … pantry is ~800 px below, the tap does not reach it")** — `openPantry` → `cNavGo('projects')`, and I measured the `📦 מזווה — חומרי גלם` header at docTop **382** in an 844 px viewport at scrollY 0, with four inventory rows visible below it. The report's own screenshot `he-07-projects.png` (390×844 CSS) shows the same. Destination is on screen.

**D22 ("הבא11:00 — badge and time run together, no separator")** — `app.css:160` `.wp-nowtag{padding:0 5px;margin-inline-end:5px}`, and the report's own `wp-p2.png` shows the orange `הבא` pill on its own line *above* `11:00`. `הבא11:00` is a `textContent` artefact (no whitespace node at `app.js:5941`), not pixels.

Three CONFIRMED findings carry number corrections: D12's "~900 px of empty space" is impossible in an 844 px viewport (≈430); D6's "9 of 70 Hebrew nodes" is seed-dependent (5/58 unseeded — the 2 % build figure replicated exactly, 83/3985 for de/es/fr); D16's "both render their value as a placeholder" is wrong for `#eqProp-areaCm2` (no placeholder). D1 I reproduced from scratch — injecting `.calcrow input[type=date]` value `2026-07-22` into the live page paints `22/07/202` at w120/sw118/cw118.

## ?

`C:\Users\dudib\source\repos\matconetesh\docs\analysis\2026-07-22-ULTIMATE-knowledge-and-gaps.md`

**VERDICT:** A Hebrew-first cooking-orchestration PWA whose *hardest* parts are its best — 279 verified citations, a physical capacity/occupancy model no competitor has, a genuinely pure scheduler, a hardened AI transport. Its weakest parts are its *boundaries*: five separate defects are one nonconformance in five costumes — a value computed in one place, consumed in another, with nothing asserting they agree (worker metering, the sources merge, the `L()` wrapper, two date conventions, 482 `typeof` guards). Three items are unbounded-harm-or-cost and shippable in a week; one has a third-party deadline (16 Oct 2026).

**GAPS BY BAND (141 total):** SAFETY 15 · Correctness 31 · Orchestrator+workflows 12 · Equipment-to-plan 11 · AI 16 · Non-functional 36 · Product-platform 8 · Business 12.

**CORRECTED/REFUTED: 45** — 42 REFUTED in Wave-2 verification (A5 · B4 · C3 · D4 · E9 · F8 · G1 · H8) plus the 3 pre-sweep false alarms; also 13 UNVERIFIABLE and ~13 further Wave-5 corrections against Wave-1/Wave-4. Adjudication totals: 206 CONFIRMED / 42 REFUTED / 13 UNVERIFIABLE = **16% refutation rate under an explicit evidence-only rule**. Every refutation shares one shape: a grep, a quote, or one artifact trusted without tracing the runtime path. Notably struck: "14 device props have zero readers" (all 14 render as chips), "the placer is inert / never reschedules" (a green test proves it fires), "55/56 toasts untranslated" (0 of 53 missing), "no AI eval fixtures exist" (`tests/ai-trust.spec.ts` already has them), "occupancy opens on an empty rack" (`_occOpenAt` already defaults to the busiest moment).

**TOP 10, IN ORDER:**
1. Stage 0 — guard `vcAskAI` + `vcTranslateToEn` (spoken, unguarded, search-grounded safety numbers)
2. Stage 0 — make `google_search` conditional (68% of all COGS *and* hallucination surface #3, one change)
3. Stage 0 — fix `aiSafetyNums` unit-blindness (74 °F passes as grounded against 74 °C)
4. Stage 0 — Worker: fail closed, drop `streamGenerateContent`, rate-limit, debit before forwarding
5. Migrate off `gemini-2.5-flash` before 16 Oct 2026, with CI + the missing grounding assertions
6. The two named safety commitments: thermometer gate, cure **block** (not warn)
7. Surface `safetyDiff`; record the `bcheck` reading, not just the tick
8. One `dayKey()`/`parseDay()` (DST cure-reminder loss) + `L()` the alarm banner and OS notification
9. Three boundary assertions: build fails on dropped overrides · no-Hebrew-leaf test · pre-spend debit
10. Wire what exists — `choosePlate`/`chooseNozzle`, `equipPlan` into multi-event, collapse the two area fields

Then: one capacity rule + cross-event timeline → guest-scaled occupancy → i18n coverage gate → perf/a11y (MutationObserver first, 62% of wall-clock) → the Phase 3a orchestrator → probes (log-import first) → monetization deferred ~2 quarters.
