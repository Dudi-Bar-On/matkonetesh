# Cooking Paths — Single-Source Design (owner ruling 2026-07-25)

**Status:** DRAFT for owner review. **Origin:** the v264 verification round — the owner found the item
card showing 105° while the timeline showed 120° for the same cook, traced to TWO disjoint step
generators; his ruling (verbatim anchors in §1) chose the full single-source refactor over
surface-patching, expanded to a complete cooking-paths model.

## 1 · The owner's ruling (binding anchors)

1. **"Full single-source refactor"** — `itemStages` becomes the ONE stage authority; the card
   re-renders from it. No surface may compute cooking temps/hours its own way.
2. **"Cards should contain all the valid cooking combinations"** — e.g. Brisket: sous-vide+smoker
   (sv→smoke), smoker→sous-vide, smoker-only, oven-only, sous-vide→oven, "and maybe others."
3. **"Test this very carefully, especially from Playwright"** — real-UI walks are the acceptance
   standard for every task (the round's hard lesson: function-level probes lied; clicking didn't).
4. **"At the plan level allow to change the cooking path, but the only single source of truth is the
   item and recipes behind the card"** — AMENDMENT O-1's catalog-first law, generalized from ORDER
   to the whole PATH.
5. **"Go over some or all the resources and get from the internet best reliable sources the missing
   cooking-path possibilities"** — a cited-sources research track fills path gaps; nothing enters
   uncited (the Baldwin-backbone doctrine unchanged).

## 2 · The path model

**A cooking path = an ordered device-method sequence for an item**, e.g. `sv→smoke`, `smoke→sv`,
`smoke` (only), `oven` (only), `sv→oven`. Today's data already encodes paths implicitly:
`methodRules`/`itemProfile` combos (`c:smoke_sv`-class keys) + the cited order schedules
(`order_svsmoke`, `order_smokesv`). This spec makes the set **enumerable and complete**:

- **`itemPaths(meta) → [{key, label, stages-params, cited:{ref,url,note}, default:boolean}]`** — a
  pure derivation over the item's cited data: every combo×cited-order pairing the citations support,
  plus **new single-device and cross-device paths added by the research track as cited entries**.
  A path exists ⟺ its schedule is cited (an `oven-only brisket` path appears only when a primary
  source backs its temps/hours). No formula-generated paths, ever.
- **Data shape (research layer):** a per-item `paths` block in the research JSONs → `sources.py`
  (same pipeline as `order_smokesv`), each entry carrying its full cited schedule
  `{seq:['sv','oven'], stages:{sv:{t,h}, oven:{t,h}}, ref, url, note}`. The gen_sources drift guard
  (shipped in Wave C) extends to cross-report path stages vs catalog values.
- **Acceptance bar inherited from the order-vocabulary registry:** adding a path to an item is
  **data + citation only — zero new JS**.
- **The default path** is per-recipe data (O-1: the card is where the default lives); absent an
  explicit default, today's `methodRules` default combo governs (unchanged behavior).

## 3 · Rendering architecture — one authority, every surface

`itemStages(meta, methodKey, ready, order)` is already path-parameterized; a path key resolves to
its (methodKey, order) pair. The refactor:

1. **`effectiveSchedule(meta, pathKey?)`** — a thin accessor over `itemStages` returning the stage
   list + per-stage cited labels/sub-lines for the item's selected-or-default path. THE only way any
   surface obtains cooking temps/hours/labels.
2. **The item card** re-renders its cooking content from it: stat line, step list, raw-data table —
   all from stages. `composedSteps`/`svSteps`/`soSteps` retire from schedule duty (their non-schedule
   prose either re-anchors to stages or is folded; the plan enumerates every consumer — strangler
   discipline, no big-bang deletion).
3. **The card's path panel (the owner's #2):** the card lists ALL `itemPaths` entries with their
   cited schedules compact (per path: device icons, key temps/hours, the citation marker); the
   default is selected; tapping another path re-renders the card's schedule from it and (per O-1)
   sets the per-recipe default. O-2's consult button rides this panel when it lands (E-programme).
4. **Every other surface reads the same accessor:** catalog grid card line, timeline (already on
   itemStages), work-plan rows AND their expandable detail text, events screen, EQM requires
   derivation (already), **AI copilot/ask grounding** (today it reads catalog smt/smh and would
   contradict the timeline — it moves to effectiveSchedule so the assistant answers what the plan
   shows), voice.
5. **Plan/event level (the owner's #4):** the timeline/event path selector offers the same
   `itemPaths` set; a plan-level change overrides FOR THAT occurrence only and always resolves
   through the item's cited entries — semantics never restated (O-1 law). The existing svSmokeOrder
   seam becomes a special case of path selection (E4's order work rides on this rather than beside
   it — see §6).

## 4 · Surfaces inventory (from the systematic-debug evidence — all must land)

| Surface | Today | After |
|---|---|---|
| Item card stat line / steps / raw table | `composedSteps`/`svSteps` on catalog smt/smh | `effectiveSchedule` |
| Item card path info | one bottom sources box | full path panel (§3.3) + the sources box stays |
| Catalog grid card cook line | `cutCard` smt/smh literal | default path's key figures |
| Timeline stage rows + order select | `itemStages` ✓ (v264) | unchanged, selector generalizes to paths |
| Work-plan row labels | `itemStages` ✓ | unchanged |
| Work-plan expandable detail | `composedSteps` (contradicts its own row) | `effectiveSchedule` |
| Events combined screen | `itemStages` ✓ | unchanged |
| AI copilot/ask/menu grounding | catalog smt/smh | `effectiveSchedule` of the active path |
| Voice | reads work-plan tasks ✓ | unchanged |
| Cheese/pantry finish steps | fixed labels (Wave A) | fold into stages where schedule-bearing |

## 5 · Safety invariance (non-negotiable)

Every temp/hour any surface shows traces to a cited entry via `itemStages` — the refactor REMOVES
formula surfaces, adds none. `bcheck`/`safe`/`svt` values untouched. `occupancyCompat.setpoint`
fence untouched. Per-task DoD-10 form: the **data-fidelity witness** (rendered values === citations
byte-for-byte across every touched surface) plus byte-identical stages for items whose path set is
unchanged. The reverse-order eligibility gate (`comboHasSvSmoke`-class: a path is OFFERED only when
its cited safety conditions hold, e.g. `pasteurize:true`) generalizes per path kind.

## 6 · Programme fit

- **Absorbs E4's catalog side**: O-1's two order affordances become the path panel + plan-level
  path change (order is a path dimension). **E4's remaining scope** — per-event override windows,
  O-3 timeline-impact preview, ledger re-sequencing — rides ON this model afterward (the ledger
  work from E2 is untouched; `deriveRequires` already takes the path's methodKey/order).
- **O-5's how-to-fix options** ("switch to another cited method/order") get their real substrate:
  the fix list = other `itemPaths` entries the owned kit satisfies (EQM.ownership per path).
- **E2's endgame** (pinned resume point) is unaffected and closes on its own track.

## 7 · Research track (the owner's #5)

Per-item path-possibility research from primary sources (AmazingRibs/Baldwin/USDA-class, the
existing canon), through the existing research-JSON → gen_sources pipeline. Scope control: batch 1 =
the high-traffic items (brisket, ribs, chicken, salmon + the owner's picks); each proposed path
lands as a cited entry or not at all; the drift guard reports every new path vs catalog values at
generation time. This is authoring work parallel to the code phases, merging via data-only commits.

## 8 · Phasing (each phase gated by real-UI walks + full suite + owner check where marked)

| Phase | Delivers | Gate |
|---|---|---|
| **CP1** | `effectiveSchedule` + every §4 surface unified on it — kills all contradictions; NO new UX | per-surface fidelity witnesses; the six formerly-wrong surfaces render citation values; screenshots each |
| **CP2** | the card path panel + default selection (O-1); plan-level path selector generalized | real-UI walks incl. path switch round-trips; **owner visual approval of the panel (mockup first, §10.9)** |
| **CP3** | research batch 1 paths live as data | zero-new-JS proof: a new path reaches the card with data+citation only |
| **CP4** | E4-remainder integration (per-event override + O-3 impact preview on paths) | rides the equipment programme's E4 planning |

## 9 · Open items the owner should glance at

1. **Path panel density** — a brisket may carry 5+ paths; CP2's mockup will propose compact vs
   expandable presentation (owner picks visually, per §10.9).
2. **Grid card line** — show the default path's figures only (proposed) vs a multi-path hint.
3. **Research batch 1 item list** — proposal at CP3 start; owner may name priorities.
4. **`composedSteps` retirement depth** — CP1 re-anchors schedule numbers; full prose unification
   may extend into CP2; the plan will draw the exact line per consumer.
