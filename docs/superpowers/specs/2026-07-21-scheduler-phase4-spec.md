# Phase 4 · The scheduler — placing along the timeline

**Date:** 2026-07-21
**Status:** DRAFT — owner authorised starting Phase 4; the 4b/4c algorithm scope needs an explicit go before building.
**Basis:** `docs/analysis/2026-07-21-scheduling-architecture.md` (full diagnosis + proposed algorithm) and the refactoring report §7 items 18–22.
**Fixes:** owner complaint #4 — *"the orchestration optimization is very poor, not taking into account the time; all the cuts are mounted from the beginning and not along the timeline as it should be."*

---

## 1. The diagnosis (why this is structural, not a bug)

Every item's stage chain is laid out by one backward walk from serve:
`start(stage_i) = serve − Σ_{j≥i} hours_j` (app.js:5031-5036, inside `buildList`).

There is **no cross-item term** in that expression. Two items cannot see each other; a device cannot influence when anything happens; capacity is consulted only *after* every time is fixed.

Because every item's **last** stage is pinned to end exactly at serve, and last stages are short (`rest` 10–30 min, `bcheck` 0), **every item's cook ends within minutes of every other item's**. The architecture does not occasionally collide — it **manufactures the maximum possible number of collisions, deterministically, on every plan.** That is precisely what the owner observed.

In scheduling terms the walk is the **backward critical-path pass of an RCPSP with all resource constraints removed** — the *resource-unconstrained relaxation*. That is a legitimate and necessary FIRST step (it yields each stage's latest-feasible finish, hence its slack). The defect is that the app **ships the relaxation as the solution**, and every downstream consumer (item view, work plan, timers, notifications, voice-cook, multi-event) treats it as a schedule.

**It is implemented twice, independently:** `buildList` (app.js:5031-5036, `Date` arithmetic, all stages) and `combinedEventsRows` (app.js:7109-7116, millisecond arithmetic, only `smoke`/`cook`/`sv`, different device-scope resolution). Two copies of the same design defect, not obviously semantically identical — the same divergent-copy class as the cart-quantity bug (three copies, two wrong).

The occupancy model (H1–H4, Phase 2) is genuinely good but is wired as a **verifier**: "given a finished schedule, what is on device D at instant t?" A placer needs the inverse, and that function does not exist.

---

## 2. Target architecture

Three separable layers, in order. Each is independently shippable and testable.

1. **Relax** — the existing backward walk, extracted once, pure, yielding `latestFinish` / `latestStart` / `slack` per stage. *No behaviour change.*
2. **Place** — a resource-constrained pass that moves stages **earlier** than their latest-feasible position so devices are not over-subscribed. Nothing is ever pushed later than the relaxation put it (that would miss serve).
3. **Repair** — when placement cannot satisfy every device, walk a ladder of safe moves; if none suffices, **advise** rather than silently produce an impossible plan.

**Placements become data, not mutation.** Today `s.start`/`s.end` are mutated onto the generator's output, so two candidate schedules cannot coexist and no solver can compare alternatives. Placements move to a separate addressable structure keyed by stage id; the renderer reads it.

---

## 3. Phase 4a — extract `planSchedule()` (the prerequisite, no behaviour change)

**This is the only part cleared to build now.**

- Add a top-level pure `planSchedule(item, serveMs) -> { stages:[{id, kind, hours, startMs, endMs, latestFinishMs, slackMs}], startMs }`.
- It computes exactly today's backward walk — **byte-identical times** — and additionally records `latestFinish` (= the relaxation's end) and `slack` (initially 0 for every stage, since the relaxation IS the latest-feasible position).
- Both call sites (`buildList`, `combinedEventsRows`) delegate to it. The second copy is **deleted**.
- Stage identity: a stable `id` per (itemKey, stageIndex, kind) so placements can be keyed without relying on object identity.

**Acceptance:** for a corpus of plans (single item, multi-item, sv+smoke combo, multi-event), the times produced before and after are **identical to the millisecond**, in both call sites. The two implementations' current differences (numeric type, stage filtering, device-scope resolution) must be reconciled explicitly and any difference that changes an output is reported as a defect found, not silently normalised.

---

## 4. Phase 4b — placement (needs owner go)

Backward serial schedule-generation over the relaxation:

- Priority rule: **least slack → largest demand → fewest feasible devices → stable key** (total order, deterministic).
- Per-device feasible-window sweep using the Phase 2 occupancy model as the capacity oracle (`packDevice`/`deviceOccupancy` inverted into a "where/when does this fit" query).
- A stage may be moved **earlier only**. Its own duration, temperature and ordering are untouched.
- Output is a placement set; the relaxation is retained so slack is always computable.

## 5. Phase 4c — repair ladder (needs owner go)

Ordered, each fully safe: **share → hang → reassign device → shift a shiftable stage earlier → hold refrigerated → advise the user.** Limited-discrepancy search under a wall-clock guard, so it degrades to "advise" rather than hanging the UI.

---

## 6. The safety boundary — non-negotiable

**This layer may never alter a `bcheck` stage, a `temp`, a `safe` figure, or a cook duration.**

Forbidden moves must be **structurally unrepresentable**, not filtered after the fact: shortening a cook, raising a temperature (including indirectly), shortening/skipping a rest below `p.restMin`, moving/dropping a `bcheck`, flipping sv↔smoke ordering to gain a window, batching sous-vide at unequal temps, trimming the sv come-up allowance, or treating an unknown capacity as infinite/zero to force a fit.

**Lexicographic objective — never a weighted sum.** A weighted sum permits trading safety for convenience at some exchange rate. There is no such rate.

**The setpoint hazard (live today, one step from laundering):** `occupancyCompat.setpoint = Math.max(temps)` is rendered as a device fact. Running a pit at the max of two items' required temperatures **raises the cooler item's cook temperature**. Bounded today by `TEMP_TOL_C=6` and display-only — but the moment a solver uses `share` automatically with `shareTolC=15`, the app silently changes a cook temperature by up to 15 °C and calls it scheduling.
**Requirement:** `share` beyond `TEMP_TOL_C` is a *proposal shown with the temperature delta stated*, never an automatic move — and the displayed setpoint should carry the delta **now**, before any solver exists. (Small, safe, shippable independently of 4b/4c.)

---

## 7. Testing

1. **4a equivalence:** identical millisecond output before/after across the plan corpus, both call sites; the deleted duplicate provably had no unique behaviour (or its differences are reported).
2. **Determinism:** same plan → identical placement every call.
3. **The headline case:** N items on one cooker no longer all end at serve; their cooks are staggered and the device is never over-subscribed at any instant.
4. **Safety fences (must FAIL to compile/construct, not merely be rejected):** no move can reduce `hours` on smoke/cook/sv, alter `temp`, or move a `bcheck`.
5. **Never later than the relaxation:** no stage finishes after its `latestFinish` (that would miss serve).
6. **Degradation:** unsolvable load → an explicit advisory naming what to change, never a silently impossible plan.
7. Full suite green; Phase 2 diagrams still agree with the new times; UI-verified at 390px.
