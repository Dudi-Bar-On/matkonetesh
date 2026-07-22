# VERIFY-W1-G — adversarial verification of `W1-G-workflows.md`

Verifier pass · 2026-07-22 · domain: workplan / workflow core loop
Method: every substantive claim re-opened at its cited `file:line`; every "X is missing" claim re-searched
under other names, other files and other mechanisms; the placement claims re-tested by **running the suite**
(`npx playwright test scheduler-placement equipplan-seam` → **15/15 passed**, fresh `python build.py` + `serve.js`).
No source file was modified. (A stale `node serve.js 8123` left over from the audit was stopped so Playwright
could start its own server; nothing in the repo was touched.)

**Score: 24 CONFIRMED · 1 REFUTED · 1 UNVERIFIABLE** (+3 accuracy corrections, listed at the end).

---

## REFUTED

### R1 — §5.1 "the whole Phase 4b story is **inert in practice**. The app never reschedules; it only advises."

**This is false, and a passing test in the repo proves it in the real UI.**

`tests/scheduler-placement.spec.ts:153` — *"C3: a small pull staggers the real plan and the timeline says the
item is ready early"* — boots a real menu on a one-zone gas grill sized to fit either item but never both,
calls `openTimeline()`, and asserts `.tl-early` renders containing `לפני ההגשה`. I ran it:

```
✓ 15 [chromium] › tests\scheduler-placement.spec.ts:153:5 › C3: a small pull staggers the real plan
  and the timeline says the item is ready early (3.0s)
15 passed (13.0s)
```

`.tl-early` is emitted **only** by `readyEarlyNote` (`app.js:5976-5982`), which requires `c.readyEarlyMs>0`,
which is written **only** at `app.js:5706` — i.e. after `schedulePlacements` returned a non-zero slack, after
the uniform-slack gate at `5701-5702` passed, and after the stage times were rewritten at `5704-5705`. The
chip cannot appear unless the entire Phase 4b path fired end-to-end. Companion tests confirm the rest of the
mechanism is live, not dead code: `B1` (over-subscribed cooker really is staggered), `B2` (`slackMs` equals the
distance pulled), `B4` (a roomy cooker is deliberately left alone), `C1` (`pull-too-far` is raised and
`slackMs` stays 0 past `SCHED_PULL_MAX_MS`).

What survives from §5.1 — verified independently and worth keeping:

* `_windowFits` is tested against **whole-device** `cap.usableCm2` (`app.js:3155`), while `perSlot`
  (`3118`) is only ever used to **reject** (`3144-3146`), never to search. CONFIRMED.
* The candidate set is `[latestFinishMs] ∪ {startMs of already-placed stages}` (`3149-3151`) — so a pull is
  0 or a jump to another item's start. CONFIRMED.
* Volume (sous-vide) stages take the early return at `3129→3141` and therefore always carry `slackMs:0`.
  CONFIRMED.
* On a large cabinet the placer will rarely fire, **by design** (`B4` asserts exactly that).

The defensible sentence is "*for a roomy cabinet the placer almost never fires, and the fit test it does use is
the wrong one*". "Inert in practice / never reschedules" is contradicted by a green test.

---

## UNVERIFIABLE

### U1 — §5.1's sweep counters: "22 realistic menus → 0/22 non-zero slack, 0/22 shift applied"

Not reproduced: the sweep was an ad-hoc browser probe with no script committed to the repo, so there is
nothing to re-run. The numbers are *plausible* for the stated kit (5-rack 6000 cm² cabinet ⇒ 5100 usable ⇒
almost everything fits at `latestFinish` on the first candidate, plus every sv stage pinned at slack 0), but
they cannot be settled from the repo, and the conclusion drawn from them is refuted above (R1).

---

## CONFIRMED (own evidence, independent of the report's probes)

| # | Claim | My evidence |
|---|---|---|
| §0.1 | `equipPlan` has one definition + one call site; multi-event never calls it | `equipPlan(` occurs at `app.js:973` (def) and `5673` (call) only; the other two hits (`3035`, `5862`) are prose. `combinedEventsRows` (`7832-7887`) calls `itemProfile`/`itemStages`/`planSchedule`/`cookerFor`/`deviceOccupancy` — no `equipPlan`, no `schedulePlacements` |
| §0.2 | `choosePlate`/`chooseNozzle` have zero production callers | repo-wide grep: defs at `app.js:3014,3024` (and the two build outputs); every call site is `tests/equip-chooser.spec.ts:20,51,64,74`. Sibling `chooseBath` **is** called at `app.js:630` |
| §0.3 | Phase 3a solver absent | `orchestrate` / `movesForClash` / `applyMove`: 0 hits in `app.js`, 0 in `dist/index.html` |
| §2.1 | Three different capacity rules for one device | `schedulePlacements` → whole-device `cap.usableCm2` (`3155`); `cookerContention` → `(o.fit.verdict==='over')\|\|o.over` (`280`); `combinedEventsRows` → `o.over \|\| !o.compat.tempOk` (`7882`). The comment at `274-279` names the bug the third path still has. Their arithmetic checks out: 6000·0.85=5100 usable, /5 racks=1020 per slot, 1320+600=1920 ⇒ 38 %, `over` false, but 1320 > 1020·`FIT_SLOT_TOL`(1.10) ⇒ `hardItems` ⇒ `verdict:'over'` (`503-511`) |
| §2.2 | Serve time: three surfaces, two on one screen | `mk-tlserve` is a **global** key (`5545`, `5626`, `5637`) while the serve *date* is scoped (`mk-tlservedate-<scope>`, `5532`). The input writes only `mk-tlserve` (`5637`); `ev.serve` is written only by `evSaveCurrent` (`7759`) and read back only by `evLoad` (`7780`). The banner reads `ev.serve` (`5617`), the combined view reads `parseServeTime(ev.serve, ev)` (`7834`) and the legend `ev.serve` (`7942`). Their screenshot `docs/analysis/shots/w1g-serve-divergence.png` exists and shows banner `הגשה 19:00` above an input reading `22:30` and a bar reading `22:30` |
| §2.3 | Multi-day: blocked in one view, scheduled in the other | `blocked=profile.multiDay && !st.ready` (`5668`) exists only in `buildList`; `multiDay` is read in exactly two places (`3217`, `5668`) and never inside `combinedEventsRows`. `m-sopr` is real (`data.py:656`, present in `dist/index.html`), category `נקניק מיובש` ⇒ `MAKE_COOK` `{multiDay:true, buildMin:0, restMin:0, methods:[{hours:0.15}]}` (`2905-2906`) ⇒ a 9-minute row in the combined view |
| §2.4 | Only the vertical shape can be checked off | `wp-ck` / `data-wpck` / `wp-done` / `wp-next` appear **only** in `renderWpVertical` (`5938-5943`) and its wiring (`5766`). `renderWpAccordion` (`5945`) and `renderWpHorizontal` (`5952`) emit none of them |
| §2.5 | The ⚡ card toggles never reach the plan outside a project | `curProject` defaults to `null` (`1453`) and is set only when opening a pantry project (`2065`, `2417`). The handler: `if(curProject) store.set(methodKeyFor(key),next); else cardSet('method:'+key,next)` (`2186`). `activeMethods` reads `store.get('method:'+key)` only (`832-839`) and `itemProfile` calls it (`2926`); `cardSess` (`843`) is never consulted. The hint says "Active methods — the plan updates" (`1020`) and the plan says "taken from the switches on the card (⚡)" (`5634`) |
| §2.6 | Bath advice contradicts the occupancy model | `_svBatch` picks `Math.max.apply(null,baths)` with no litre check (`5785`) and renders "use the N L bath for all" (`5837`); `deviceOccupancy`'s own comment (`483-486`) says the volume % is a floor because displacement is unknown, and sets `pctFloor` when 2+ items share (`492`). Bonus divergence the report missed: the occupancy vessel view recommends the **smallest** vessel that fits via `chooseBath` (`630`, `3001-3010`) — the opposite rule to `_svBatch`'s max |
| §2.7 | Advisory and clash banner can disagree | `_plcConflicts` is computed at `5691-5692` (**before** the shift at `5693-5707`); `cookerContention` at `5777` (**after**). Concrete divergence window I verified myself: `bath-temp` fires on strict `p.temp!==r.temp` (`3137`) while `tempOk` allows `spread<=TEMP_TOL_C` = 6 °C (`294`, `occupancyCompat`) — a 1-6 °C bath split raises the advisory with the banner silent |
| §2.8 | Combined view calls every clash "Smoker" | Hardcoded `⚠ מעשנה`/`Smoker` (`7947`) and "One smoker will not be enough…" (`7950`), while `contention` is set from any device in `marksByDev`, populated from `sv`/`smoke`/`cook` stages (`7853-7856`, `7877-7884`) |
| §3.1 | The scheduler's purity is discarded by its caller | `planSchedule` is pure (`2978-2991`, fresh `out[]`, input untouched); `buildList` writes the result onto the stage objects at `5679` and the placement pull rewrites the same fields at `5704-5705` |
| §3.2 | Rendering the plan writes user state to storage | `st` is `allState[m.key]` (`5661-5662`); `st.method` (`5664`), `st.svSmokeOrder` (`5665`), `st.stage`/`st.ready` (`5667`) are assigned, then `tlSetState(allState)` persists the whole map (`5684`) |
| §3.3 | Window-global singletons in a multi-event app | `_plcConflicts` `5692`, `_planSafetyViolations` `5711`, `_wpServe`/`_wpStart` `5758`, `_wpCtx` `5775`, `_wpTasks` `5878`; `_copilotStages` reads the global `_wpTasks` (`5362`) and `openVoiceCook` is handed it (`5767`, `5510`). Storage keys *are* scoped (`5532`, `5581`, `5349`) — the collapse is in memory only, as stated |
| §3.4 | `cardSess` is keyed by item only | `cardSess` `843`, `cardSet('method:'+key,…)` `2186` — no scope component |
| §4 | The can / cannot table | Spot-checked every anchor: method dropdown + `methodPinned` `6042-6043`; order `data-tlorder` gated by `comboHasSvSmoke` (`3264-3271`, cited data `order_smokesv`); cooker strip `5893-5898` (only when ≥2 candidates); plan-start / strict / push+30 / reschedule `5586-5604`; view+shape+detail `5761-5763`; `SCHED_PULL_MAX_MS` has no UI (`3065`, single reference); durations come from data (`upperHours`, `app.js:6`); shelf assignment is computed by `packDevice` (`403`, used `441`) with no override; preheat derived from `_preheatRow` (`946-952`) |
| §5.2 | A non-uniform slack set is silently discarded | `const uniq=…; if(uniq.length!==1 \|\| !uniq[0]) return;` at `5701-5702` (report says 5700-5701; text matches exactly). A *successful* placement pushes no conflict (`3172-3173`), so the advisory says nothing |
| §5.3 | The multi-event view is a weaker product | Follows from §0.1/§2.1/§2.2/§2.3, all confirmed above, all in `combinedEventsRows` `7832-7887` |
| §5.5 | Two shapes can't be ticked; language wipes ticks; refuel keys collide | Key = `'wpck:'+sc+':'+tk.label` (`5938`) and every label is built through `L(he,en)`. The refuel rows all use the identical label `L('🪵 הוספת '+fuel,'🪵 Add '+fuel)` (`5871`) in a loop, so N rows share one key. Corroboration the codebase knows better: the shopping list deliberately keys on "the stable (language-independent) label so checkbox state survives a language switch" (`7916`) |
| §5.6 | The copilot reserves no rest and follows the wrong event | `readyBy = s.serveTs - (s.restMin\|\|0)*60000` (`5413`); `restMin` in `app.js` occurs only in `MAKE_COOK`/`itemProfile`/`leadHours`/`itemStages` (`2886-2949`, `3257`) — **nothing ever writes `session.restMin`**. Session shape is `{startedAt,scope,serveTs,probes}` (`5354`); `copilotSetTarget` adds `targetC` (`5382`), `copilotAdjustServe` updates `serveTs` (`5389`). Brisket's `rest=60` (`data.py:6`) ⇒ `itemStages` schedules a 1 h rest (`3257`) the verdict ignores |
| §5.7 | Timers are stopwatches | `dur:Math.round(s.hours*3600)` baked into the task (`5838`) → `timerHTML` (`2279-2285`); `wireTimer` (`2326-2338`) counts from the ▶ press and persists an end-timestamp in `mk-timers` — no reference to the stage's scheduled `start`. `copilotAdjustServe` (`5385-5392`) is the only re-anchor and it writes the global `mk-tlserve` |
| §5.8 | The `equipPlan` seam is empty for most kit | `DEVICE_FUEL` (`964-967`) has 7 of the 8 smoker types — `ארון / קבינט` absent; `REFUEL_MIN` (`957-962`) is non-zero for exactly 3 (offset 45, WSM 90, kettle 60). All 5 grill types and all 3 oven types are absent from both, and the near-misses are genuinely different strings (`קטל` vs `קטל (ככלי עישון)`, `גז` vs `גז (עם תיבת עשן)`). `equipPlan` only touches `smoke`/`cook` kinds (`977`). **See correction C2** |
| §6 | The five smaller notes | `itemCookerScope` falls back to `evScope()` (`240`) so `schedulePlacements(computed,null)` at `5691` is correctly scoped; `safetyDiff` (`3039-3051`) compares kind/hours/temp/safe and deliberately not start/end, and runs every rebuild (`5712-5718`); `deviceCanReach` returns `ok:true` when `maxC` is unstated (`3086`); `Number(s.hours)\|\|0` guard at `2983`, used by both call sites (`5678`, `7850`); `_unresolved` at `5904-5913` |

---

## Accuracy corrections (do not change any verdict, but the report should not be quoted as-is)

**C1 — line anchors drift by one in five places.** `5700-5701`→`5701-5702` (slack gate); `5705-5707`→`5704-5706`
(shift apply); `5712`→`5711` (`_planSafetyViolations`); `5903-5912`→`5904-5913` (`_unresolved`);
`5975-5987`→`5976-5983` (the ⏳ chip). The quoted code is verbatim-correct in every case.

**C2 — §5.8 overstates "the seam".** `equipPlan` is not the only device→plan path, and the code comment at
`971-972` that the report quotes as fact is itself wrong. `_preheatRow`/`preheatMinutes` (`934-953`) maps
device *type* → the plan's scheduled light-up time and its label, covers all 8 smoker types **including the
cabinet** (30 min vs the 45 min default), and is read by `buildList` at `5721-5722`. Verified green:
`equipplan-seam.spec.ts` P3a/P3b/P3c ("the real plan lights the fire preheatMinutes before the first smoke,
not a hardcoded 45"). Separately, `SMOKER_TIPS`/`SMOKER_TIPS_EN` (`912-932`) carry device-specific prose for
all 8 smoker types, rendered on the item card at `1022`. The report's literal claim — that `equipPlan` itself
is a no-op for most kit and that the plan's **cook stages** carry no equipment-specific instruction — holds;
the framing "the equipment seam is empty for most of the equipment" does not.

**C3 — two small factual slips.** (a) The flow diagram's `K2` node lists six conflict reasons and omits
`bath-too-small` (`3139`). (b) §5.8 calls the cabinet "the one seeded in the sample kit" — there is no sample
kit anywhere in the app (`mk-equipment` is only ever written by `equipSave`, `222`); the cabinet is simply the
first entry in `EQUIP_CATS.smoker.types` (`35`), hence the default `<select>` option, and the standard test
fixture. (c) The environment note states `dist/index.html` was 2,270,442 bytes; the artifact present before I
ran anything (built 09:18 today, after the last `app.js` edit at 01:03) was 2,701,065 bytes.
