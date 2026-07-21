# Status & Gap Report — where the app actually stands

**Date:** 2026-07-22 · **Version audited:** v258 (live) · **Suite:** 413 passing, 0 arbitrary waits
**Method:** three independent auditors over ~40 documents (~12,000 lines of specification), each verifying claims **against the code**, never against a plan, ledger or commit message. Every safety-bearing claim was then re-verified by hand — **two of the three auditors produced a false safety alarm** (see §0).

---

## 0. Corrections to the audit itself (verify before you alarm)

| Claim | Verdict | Evidence |
|---|---|---|
| "A ~2.5 g Cure #1 dose on a 1 g scale warns nobody" | **FALSE** | `cureScaleGuardHTML` (app.js:1849) sets `hardMax = 5×d`; with a 1 g scale that is 5 g, so a 2.5 g dose is below it and the **hard** warning fires, naming botulism risk. Called from 3 production paths (1899/1911/1920). Fails safe when no scale is registered. |
| "No `safe`/pasteurization value carries a citation (0 of 177 items)" | **FALSE** | 279 `"src"` blocks in the shipped bundle; they live in `sources.py` and are merged at build. `tests/data-integrity.spec.ts` asserts every cut carries one and passes. The auditor grepped `data.py` only. |

What *is* true and narrower: the recipe field `spec.scale_res` is unread — the guard derives from the **live computed dose vs the registered scale's readability** instead, which is the owner-approved deviation and the stronger check.

---

## 1. What is genuinely delivered

- **Equipment 2.0 Phase 1** and the **Occupancy Layer** — essentially 100%, and occupancy was *over*-delivered (the graphical Phase 2 device diagrams were not in any original plan).
- **Live Cook Copilot** — fully shipped with tests, despite the AI strategy doc framing it as "70% exists".
- **Every safety commitment in REVIEW-v147 and OPERATIONS-v157** — cure labelling, nitrite dosing, background alarms, overnight scheduling, silent-data-loss fixes, the operational `bcheck` internal-temp gate, deterministic AI refuse/deflect — all re-confirmed **in code**, none abandoned or inert.
- **New this session:** the `equipPlan` seam (the waived requirement, and the single biggest change since 2026-07-21), `planSchedule`/`schedulePlacements` capacity-aware scheduling, the runtime `safetyDiff` invariant, `deviceCanReach` thermal gate, per-slot clash detection, and a test suite with zero arbitrary waits.

---

## 2. The gaps that matter, in priority order

### A · Safety (close first)
1. **Plan-depth model — 0% built (49 requirements)**, including both named safety commitments: *refuse to schedule* poultry/charcuterie without a registered thermometer, and the cure task must **BLOCK**, not merely warn, without a 0.1 g scale. Today `gearThermoNote()` renders passive advice and the cure guard is advisory (its own test G8 proves the grams are byte-identical whether or not the warning shows).
2. **Phase 3a hold-safety spine** (`holdCapMin`, danger-zone accumulator, `safetyGate`) — unbuilt. Currently unreachable because nothing generates hold moves, so it is a *prerequisite* rather than a live hazard.

### B · The orchestrator the owner remembers
3. **The Phase 3a solver is 0% built** — `orchestrate`, `movesForClash`, `applyMove` do not exist. Two of three planned build slices never happened, and the version numbers reserved for them were consumed by other work. **This is the owner's recollection being correct.** What exists instead: a capacity-aware placer that shifts stages earlier within one event and advises when it cannot.
4. **Cross-event resource allocation does not exist.** Placement and capacity are computed per event. The only cross-event signal is a raw time-overlap of *smoke windows* (app.js:7870) that ignores which device, ignores capacity, and covers no other stage kind — so two events on different smokers are falsely flagged while two events sharing one bath are not flagged at all.
5. **`equipPlan` enriches only the single-event plan** — the multi-event view never calls it, so preheat/fuel/refuel facts can disagree between the two views.

### C · Registered kit that still does not reach the plan
6. **`choosePlate` / `chooseNozzle` are built, correct and tested — and called from nowhere in production.** (Built this session; only `chooseBath` was wired. My omission.)
7. **Charcuterie Slice B — 0%**: cylinder loads, vacuum liquid-seal warning, grind-plate matching.
8. **Probe-channel budgeting (D10)** — still just a footer count, unchanged since the 2026-07-17 audit.
9. **A pellet or electric smoker owner still sees "🪵 wood: oak" on the smoke task itself** — only the refuel wording was made device-aware.
10. **Occupancy demand ignores guest count and piece count** (owner-raised): `footprint_cm2` is a static per-recipe constant, so 4 guests and 40 guests claim identical grate area. Fix is derivable from existing data (`rawGramsFor` + the catalog reference weight; per-piece × count for sausages).
11. **Fourteen registered device properties have zero readers**: `nozzles`, `plates`, `bagKind`, `bagW`, `lid`, `fan`, `accuracy`, `pulse`, `rotisserie`, `speed`, `steam`, `throughput`, `waterPan`, `watts`.
12. **Warm-up is smoker-only** — no bath come-up, grill chimney, or oven preheat task. (`watts` may be the honest input for the sous-vide come-up.)

### D · Walkthrough defects still open
**M1** grill cuts (picanha/kebab) default to sous-vide+smoke — *the root cause of C2* · **M2** wizard chip toggle · **N1** date field clips the year · **N2** "1 אירועים" mis-pluralisation (no shared plural helper; 4+ sites affected) · **M3** charcoal-grill form never re-verified.

### E · Product / platform
13. **i18n regression** — 18 checked toasts are absent from `lang/en.json` and still render Hebrew in English mode; fr/de/es remain structurally incomplete.
14. No unified `mk-schema` migration registry (flagged since ROADMAP-v149) · manifest lacks `shortcuts`/`screenshots` · no AI response caching/dedup · cloud sync and billing deliberately deferred pending a business decision.

---

## 3. Proposed order for closing them

1. **Safety first** — the two plan-depth commitments (thermometer gate, cure block). Small, named, and the only outstanding items with a health consequence.
2. **Wire what already exists** — `choosePlate`/`chooseNozzle` into the work-plan steps, `equipPlan` into the multi-event view, the fuel line on the smoke task. Cheap, high visible value, closes the "registered kit is ignored" complaint.
3. **Cross-event resource timeline** — one resource timeline per physical device across all events. Fixes both the false clashes and the missed ones. ~90% deterministic; no AI needed.
4. **Guest-count-scaled occupancy demand** — the owner's own item; makes every capacity claim honest at real party sizes.
5. **Walkthrough M1** — grill cuts defaulting to sv+smoke; fixes C2 at the root.
6. **Then the Phase 3a solver** — with the safety spine (`holdCapMin`, danger-zone accumulator) as its precondition, and AI as a *proposer* gated by `safetyDiff`, never an executor.
7. Charcuterie Slice B · probe channels · plural helper · i18n toasts · platform items.
