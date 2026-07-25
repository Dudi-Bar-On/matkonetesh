# Equipment & Cooking-Constraint Programme — Equipment Manager as SSOT — Spec

**Date:** 2026-07-25 · **Status: APPROVED by the owner, 2026-07-25** (spec-file review, pipeline gate 2 —
`writing-plans` may begin).

**Owner's spec-review rulings, 2026-07-25 — all six §12 flags confirmed as drafted, none overridden:**
**F1** the P9 boundary stands where §10 draws it — the capacity-share ledger + availability query are IN now
(per Q3); the automated cross-event re-allocator stays OUT (per R5) until its own phase. · **F2**
`capacityDemand` ships with the static footprint; D5 guest-scaling is a **named future gap**, not an E2
commitment. · **F3** `EQM` stays a five-method API; the delete-impact query remains internal. · **F4**
day-one declared requires = grinder + stuffer; the sealer row is an E6 stretch. · **F5** `equipment.js`
inlines before `app.js` with the `build.py` single-definition assertion. · **F6** `EQM.alternatives` runs
with `search:false`.

**Author's brief.** The owner brainstormed this programme and **approved the design** (decisions Q1, Q3, Q4,
Q5 and the nine approved design sections, reproduced verbatim as the fixed skeleton in §0.1). This document
turns those fixed decisions into a precise, implementable, fully-traced spec. **The owner's decisions are
FIXED and are not re-litigated here.** Wherever implementation precision required a judgement the owner's
decisions did not settle, this draft *makes* the call and *flags it explicitly* in §12 (self-review) for the
owner's confirmation on spec review — the same discipline the P0-app spec used, which worked.

**Baseline:** current `HEAD` on `main`, `26bc779` (`מהדורה 262 · 24.7.26`, `build.py:334`). Every `app.js:N`
citation below is **1-based** (matching `Read`/`Grep`/every existing doc in this repo) and was **grep- and
Serena-verified this session, 2026-07-25**, against the live 9,970-line `app.js` — not carried over from the
charter's or ULTIMATE doc's v258 numbers, several of which have drifted (e.g. `aiJSON` is now at `app.js:4617`,
not the `4427` the P0-app spec cited at `מהדורה 261`; the P0-app `AI_SEARCH` registry has since **shipped**,
`app.js:4286`). Where a citation differs from an older document, this spec's number is the current one.
**All current-state claims trace to `docs/analysis/2026-07-25-equipment-substrate-map.md`** (committed at this
same HEAD) **or to this session's own Serena verification**, noted per-claim.

**Headline correction, carried from the substrate map so it is never repeated.** `equipPlan` **EXISTS**
(`app.js:973`, wired into the live render path at `app.js:6069`, covered by `tests/equipplan-seam.spec.ts`).
The refactoring report's "`equipPlan` never built / formally waived" claim is a **closed** technical case
(built `75d946a`, 2026-07-21). L1 survives only as a *process* lesson (the Waiver Gate). This spec does not
re-build `equipPlan`; it builds the ledger/allocation layer `equipPlan` never was.

---

## 0. Traceability

### 0.1 · The owner's fixed decisions (reproduced verbatim — the skeleton this spec fills in)

- **Q1 · One reconciled programme, foundation-first.** Absorbs charter S2-orchestrator / S3 / P8 / P9
  fragments. Dependency spine: **Equipment Manager (SSOT) → validity propagation → cooking order →
  replacements/AI.** Voice is a separate parallel track (**OUT** of this spec). Navigation redesign comes
  **after** equipment (Q2) and is **OUT** — but the surfaces this spec creates (device management, allocation
  timeline, invalid-cook states, replacement approval) feed that future nav design.
- **Q3 · Capacity-share allocation.** A reservation claims **capacity** (rack area cm² / bath litres / grill
  zones) for a time window, not the whole device. Two briskets share a cabinet if they fit. `deviceOccupancy`'s
  existing fit arithmetic becomes the capacity math **inside** the ledger. Availability answers are
  **yes / partial ("room for X more") / no.**
- **Q4 · Requires model: one schema, two sources.** Every item exposes a `requires` list. **Cooking-device
  rows** (smoker/bath/oven/grill + capacity demand + temp capability) are **AUTO-DERIVED** from existing stage
  data (`itemStages` kinds, `smt/svt/…` temps, footprints) — zero migration, 3,677 items covered day one,
  cannot drift. **Processing devices** (grinder, stuffer, sealer, curing chamber) and **alternatives/changed
  flows** are **DECLARED** data, authored where relevant, starting with makes/sausages where they are
  mandatory. Both the physical-ownership check and the window check answer from the **SAME** list.
- **Q5 · Module form: separate source file.** New `equipment.js`, inlined by `build.py` (one-time build
  change; shipped app stays a single file). **ONE narrow global API: `EQM.*`.** `app.js` never reaches inside.
  Existing equipment code migrates across incrementally behind the green suite. **Standing principle adopted
  (recorded, §2.7): strangler-fig** — every re-architected pillar leaves in its own source file; `app.js`
  shrinks by attrition, never big-bang. Source-level modules (shared runtime, no ES modules).

The nine approved design sections (Module · three-store Data model · four-question API · Validity propagation
· Cooking order · Replacements · Retroactive invalidation · Charter absorption · Testing) are specified in
§3–§11 respectively.

### 0.2 · Every deliverable to its governing source

| Design element | Owner decision | Charter (`2026-07-22-…-charter.md`) | ULTIMATE gap id(s) | Phase (this spec) |
|---|---|---|---|---|
| `equipment.js` module + `EQM.*` API + strangler-fig | Q5 | S2 §2.1 ("private closure, 5 window globals"); D5 (extraction gets its own phase) | — (structural) | E1 |
| Device registry (evolve `mk-equipment`; live/parked props) | Q4, §2 | S3 §2.1; P5b | D2, D3 | E1 |
| `requires` schema + auto-derivation (3,677 items) | Q4 | S2/S3 | D4 (scope), D1 (join) | E1, E6 |
| Reservation ledger `mk-eqm-ledger` + capacity math | Q3, §2 | S3 (P5b "one capacity verdict"); **P9** | B-i.1, C3, C4, D5, D11 | E2 |
| `EQM.ownership` / `availability` / `allocate` / `release` / `alternatives` | Q3/Q4, §3 | S3; **P8** hold-safety spine | B-i.1, C1, C3 | E1, E2, E5 |
| Validity propagation — three gates, one verdict | §4 | S3 ("one shared verdict 2/3 bypass") | **B-i.1**, B-i.6, D11 | E3 |
| Cooking order (recipe default + per-event override) | §5 | S2 (order reaches temps, not devices — map §1.7) | C8 (one affordance) | E4 |
| Replacements ladder (declared → AI → approve/deny → persist) | §6 | S2 orchestrator (C2 "no AI proposer") | C2, D1, D7 | E5 |
| Retroactive invalidation (warn + impact list, never silent) | §7 | S3/S4 (identity of a held device) | (new — surfaced by this design) | E3 |
| Charter reconciliation table | §8 | all of the above | §9 (this spec) | — |
| Declared-requires authoring for makes | Q4, §6/§9 | S2/S3 | D1, D7 (grind-plate) | E6 |

**Governing process document:** `docs/process/development-discipline.md` (§3 the 12-point DoD, §4 the Waiver
Gate — both bound in §11). **Governing product framing:** `CLAUDE.md` ("safety values trace to primary
sources"; online-first; secrets never enter the repo).

---

## 1. Evidence baseline (Serena-verified this session, `app.js` @ `26bc779`)

Every symbol below was confirmed live via `find_symbol` and grep-confirmed for its 1-based line this session.
The one-line offset a reader will notice between Serena's `body_location.start_line` and these numbers is
Serena's indexing anchor; the numbers here are the **grep `^function`/`^const` 1-based lines**, matching the
substrate map and every other doc in the repo.

### 1.1 · What exists and is solid (this spec absorbs it, does not rebuild it)

- **Device data model.** `EQUIP_CATS` (`app.js:34`, 9 categories, typed `props[]` + scalar `capKey`/array
  `multiCap`); `deviceCapacity(dev)` (`app.js:305`, area→`usableCm2`, sous-vide→`{mode:'volume',litres}` with
  a commented measurement→class-default precedence); `equipList()` (`app.js:221`, reads `mk-equipment`);
  `equipConfigured()` (`app.js:754`, the `mk-equip-set` boolean gate); `equipSetConfigured()` (`app.js:755`);
  legacy migration `equipMigrateFromGear()` (`app.js:757`). Device on-disk shape:
  `{id, cat, type, name, brand, model, fuel, cap:{…}, specSource, notes}`.
- **The honest capacity/fit engine — this becomes the ledger's capacity math (Q3).** `deviceOccupancy(devId,
  tMs, computed, scope)` (`app.js:438`) answers "what is on device X at instant `tMs`", returning per-slot
  placement and an honesty-laddered `fit` verdict (`ok`/`tight`/`over`) — **it re-scans `computed[]` on every
  call; it is not a stored table.** `deviceCapacity` (`app.js:305`), `itemOccupancy(meta, stageKind, dev)`
  (`app.js:356`), `packDevice` (`app.js:403`), `chooseBath(dev, needL)` (`app.js:3014`, smallest-that-fits),
  `schedulePlacements(computed, scope)` (`app.js:3099`, the real device-capacity time-shifting placer, bounded
  by `SCHED_PULL_MAX_MS`).
- **The enrichment seam.** `equipPlan(meta, methodKey, stages, scope)` (`app.js:973`) — one production call
  site, `buildList` at `app.js:6069`; its own contract comment: *"may ENRICH a stage… may never change one: no
  duration, no temperature, no kind, no order."* Scope is narrow (`smoke`/`cook` only, smoker-only
  `DEVICE_FUEL`/`REFUEL_MIN` at `app.js:964`/`957`).
- **The equipment UI (CRUD surface where this spec's gates + delete-warning attach).** `openEquipment()`
  (`app.js:6773`), `openOccupancyView(computed, serve, scope)` (`app.js:714`, wired to a real `data-occview`
  button), five device-silhouette renderers (`_occCabinetBody` `app.js:572` et al., CSS `occ2-*`).
- **The cooking-order seam E4 generalizes.** `SV_SMOKE_ORDERS` (`app.js:2963`), `svSmokeOrderDefault()`
  (`app.js:2969`, returns `'sv-smoke'`), stored per-item-per-event as `st.svSmokeOrder` in `buildList`
  (`app.js:6061`) and `evState[key].svSmokeOrder` in `combinedEventsRows` (`app.js:8267`) — **both call sites
  pass it into the same `itemStages`**, so the two plan surfaces already agree by construction.
- **The guarded AI layer E5 rides on (more mature than the P0-app spec assumed).** `aiJSON` (`app.js:4617`,
  takes a caller-supplied `search` boolean, builds `tools`/validates); the **`AI_SEARCH` registry +
  `searchFor(usage, hasLocalGrounding)` resolver** (`app.js:4286`, P0-app item 3 — **shipped since
  `מהדורה 261`**); **`aiConfirmPanel(o)` (`app.js:4681`) — the existing approve/deny contract E5 reuses**
  (today 2 call sites; E5 adds device-replacement as the third); the grounding validators
  `aiValidateItems` (`app.js:4671`) / `aiValidateSeasonings` (`app.js:8819`); the safety-number guard
  `aiSafetyNums` (`app.js:4560`) / `aiUngroundedSafety` (`app.js:4588`); entity resolution `askFindEntity(q)`
  (`app.js:4032`).
- **The primitives every new string/store touches.** `store` (`app.js:1433`, catches internally, returns
  bool); `toast(msg, undoFn, actionLabel)` (`app.js:2772`); `getLang()` (`app.js:7280`); `L(he, en)`
  (`app.js:7292`); `resolveItem(key)` (`app.js:2804`, resolves any catalog key to `{…, obj}`); `itemStages`
  (`app.js:3223`, builds `{kind, hours, temp}`, **carries no device field** — devices enter downstream only).

### 1.2 · What is genuinely absent — the work this spec authorizes (keystone, substrate map §3)

> **No function in `app.js` takes `(deviceId, proposedStart, proposedEnd)` and returns a free/busy answer
> without first re-deriving the full stage set for every item across every event.** There is no persisted
> reservation record — `mk-item-cooker-<scope>` (`app.js:241`) stores a manual device *pick*, not a window.
> `combinedEventsRows` (`app.js:8260`), the only cross-event surface, **bypasses `equipPlan` and
> `schedulePlacements` entirely** and only samples the honest verdict at stage-start instants, gated off
> unless `equipConfigured()`.

The Phase-3a solver (`orchestrate`/`movesForClash`/`applyMove`/`safetyGate`) has **zero declarations**
(grep-confirmed). **This spec builds the reservation ledger + availability query + validity gates + manual
allocate/release + manual replacement choice — the *detection and blocking and manual-choice* layer. It does
NOT build the automated move-solver (re-planning); that stays P8 (§10).**

---

## 2. Global constraints (apply to every phase, every task)

1. **Hebrew-first (DoD-9, L13).** Every new user-facing string — invalid badges, blocked-add toasts,
   availability answers, delete-impact warnings, replacement dialogs — ships in Hebrew (the base language)
   with an English counterpart through the existing `L(he,en)` mechanism (`app.js:7292`). Proposed copy is
   given per-item in §4/§7 and marked **proposed, not final** — each takes its DoD-9 native/fluent pass at
   implementation time; approval of this spec does not freeze wording. **L13:** any surface that renders a
   number beside its Hebrew label (every availability "room for {n} more", every "{n} events / {m} cooks"
   impact count, every capacity readout) needs a `dir="ltr"` island around the digits/unit, or the RTL
   context visually flips a comparison operator or misorders a number/unit pair. Counts are interpolated, so
   correct singular/plural is required (there is **no** shared `plural()` helper today — ULTIMATE B-iii.17,
   `"1 events"` — so the plan must not assume one; build the correct form explicitly per string).
2. **Safety invariance (DoD-10) — the load-bearing invariant of this entire programme.** The Equipment
   Manager is a **pure read-and-reserve layer**. **No `EQM.*` call, no ledger write, no validity gate, and no
   replacement approval may ever alter a stored `bcheck` stage, `temp`, `safe`/`tgt`/`cure`/`cureRate` value,
   or any cook/cure duration**, and none may write to `itemStages`'s returned stage list. `equipPlan`'s
   existing contract (*"may enrich, may never change: no duration, no temperature, no kind, no order"*,
   `app.js:969-972`) is the model and is **extended to the whole `EQM.*` surface**. **The required assertion,
   named once here and reused per-task:** snapshot both `resolveItem(key).obj` **and** the full
   `itemStages(meta, methodKey, ready, order)` output array for every item under test **before** and **after**
   exercising any `EQM.ownership`/`availability`/`allocate`/`release`/`alternatives` round-trip (including a
   full allocate-then-release cycle and an accepted replacement), and assert **byte-identical** (deep-equal).
   This mirrors the existing `safetyDiff` plan-boundary invariant (`app.js`) without reusing that function —
   `EQM.*` never touches `itemStages`/`planSchedule`, so `safetyDiff` is not a dependency, only its *pattern*.
3. **TDD (DoD-2/3).** Every task: witnessed RED (test written first, run, observed failing for the stated
   reason, output pasted) → GREEN → full suite. Each `EQM.*` function is TDD'd **at the module boundary** (§10)
   before any UI wires to it. No production code before a witnessed failing test.
4. **Serena-first on `app.js` and `equipment.js` (`CLAUDE.md` §10.17).** Every edit is symbol-shaped on a
   ~10k-line monolith and a new module — `find_symbol`/`get_symbols_overview`/`replace_symbol_body`/
   `find_referencing_symbols` are the tools, not text-matching `Edit`. This spec's own citations were all
   Serena-verified; the executing subagents do the same, pointed at the single shared Serena server
   (`CLAUDE.md` §10.17a).
5. **Suite (DoD-12).** `npx playwright test` — plain, nothing else. The full suite (~**512** tests at time of
   writing; exact count confirmed at plan time via `--list`, **never** by running under `--workers=1`) guards
   every extraction and every wiring. `retries:0`, `workers` at the certified ceiling. Never `--retries`,
   never `--workers=1`. Any failure, including an intermittent one, is a bug (`systematic-debugging`), never
   re-run to pass. Per §11a: never two suite runs concurrently; run serialized, no competing CPU-heavy agents.
6. **Waiver Gate (`CLAUDE.md` §4, `development-discipline.md` §4).** Nothing in this spec waives, narrows, or
   defers a charter/ULTIMATE requirement. Where this document made an implementation choice the owner's
   verbatim decision did not spell out, it is flagged in that section **and** in §12 — none is treated as
   settled without the owner reviewing this file. **One reconciliation deserves the owner's explicit eye
   (§12, flag F1): building the reservation ledger now brings the cross-event *availability substrate*
   forward of the charter's P9 ("cross-event allocation waits until after the orchestrator", R5).** This
   spec's reading is that R5 defers the *automated cross-event re-allocator*, which stays out (§10), while
   owner decision Q3 explicitly authorizes the *capacity-share reservation ledger and its availability query*
   now. That reading is stated openly, per the Gate, not buried.
7. **Strangler-fig (standing architectural principle, adopted per Q5 — recorded here so future pillars
   follow it).** Every re-architected pillar leaves `app.js` into its **own source file**, inlined by
   `build.py` into the single shipped `<script>`, exposing **one** narrow global namespace; `app.js` never
   reaches inside. `app.js` shrinks by **attrition**, never by a big-bang rewrite. Source-level modules share
   one runtime scope (no ES modules). `equipment.js`/`EQM` is the first application of this principle.

---

## 3. Module — `equipment.js` + the `EQM.*` API (owner design §1, Q5)

**New source file `equipment.js`.** `build.py` currently inlines `app.js` + `app.css` + the Python data layer
into `dist/index.html` (`CLAUDE.md`). This spec adds `equipment.js` to that inline list as a **one-time build
change** (specified here; `build.py` is **not** edited by this spec — that is a plan-phase E1 task). The
shipped app remains a single file.

**Inlining order (E1 task — precise, because it is load-bearing).** `equipment.js` is concatenated into the
same `<script>` as `app.js`. Top-level `function` declarations hoist within one script, but `const EQM = …`
does **not** hoist and must be evaluated before any `app.js` top-level code path reads it. `equipment.js`
therefore inlines **before** `app.js`, and `EQM` is a `const` object literal assembled at module-eval time
from functions defined in the same file. The build must assert (a `build.py` check, S1's "zero assertions"
lesson) that `EQM` and its five methods are defined exactly once and that `app.js` contains no second
definition — the anti-`_js_str`-style silent-drop guard.

**The one narrow global — `EQM`, exactly five methods (§3 four-question API + one mutator pair):**

```
EQM.ownership(requires)            → { ok, missing:[…], partial:[…] }        // physical, catalog-level
EQM.availability(requires, window) → { state:'free'|'partial'|'busy', room } // ledger + capacity fit
EQM.allocate(requires, window, holder) → { ok, holdIds:[…] }                 // holder-tracked reservation
EQM.release(holder)                → { freed:N }                             // frees ALL of a holder's holds
EQM.alternatives(missingReq)       → [ { kind:'declared'|'ai', … } ]         // replacement ladder
```

`app.js` calls **only** these. The existing equipment internals (`EQUIP_CATS`, `deviceOccupancy`,
`deviceCapacity`, `deviceCanHang`, `equipList`, `packDevice`, `chooseBath`, `choosePlate`, `chooseNozzle`,
`itemOccupancy`, `cookerFor`, `cookerCandidates`, `schedulePlacements`) **migrate into `equipment.js`
incrementally, behind the green suite**, one symbol at a time — each migration is its own DoD-gated task that
must leave the full suite green (the 512 tests reach these through the DOM and are the equivalence oracle,
mirroring D5's `safetyDiff`-oracle discipline for the P5a pipeline extraction). **E1 ships the module scaffold
+ `EQM.ownership` + the requires model; it does not require every internal to have migrated first** — `EQM`
may, during migration, call back into `app.js`-resident helpers via a documented, shrinking shim list (the
compatibility-shim pattern D5 mandates for the 5 `window` globals), so long as the *public* surface stays the
five methods.

---

## 4. Data model — three stores (owner design §2)

### 4.1 · Device registry — evolves `mk-equipment`, **no migration** (Q4)

`mk-equipment` (`equipList()`, `app.js:221`) stays the store of record; its record shape is unchanged, so
**no data migration**. The Equipment Manager gains it as its registry. Two named registry-hygiene fixes land
in E1 as part of "the registry becomes canonical":

- **D3 — collapse the two cooking-area fields.** Today `#eqvArea` (free text → `d.cap.area`, display-only) and
  `#eqProp-areaCm2` (numeric → `propParse` → the only field `deviceCapacity` reads for fit) coexist with
  nothing on screen distinguishing them (substrate map §1.1). E1 names `areaCm2` the canonical capacity field
  and demotes `cap.area` to an explicit display-only alias (or removes its input) — a UI change, screenshotted
  at 390×844 (DoD-8).
- **D2 — the 14 display-only properties, enumerated honestly (which become live, which stay parked).** The
  owner's §2 requires this be stated "honestly." Under **this spec's scope**:

  | Property | Disposition under this spec |
  |---|---|
  | `plates` (grinder plate mm) | **Becomes LIVE (E6)** — the declared-requires grinder join finally gives `choosePlate` (`app.js:3024`, D1) a production consumer |
  | `nozzles` (stuffer nozzle mm) | **Becomes LIVE (E6)** — declared-requires stuffer join gives `chooseNozzle` (`app.js:3034`, D1) a consumer |
  | `bagKind`, `bagW` (sealer/vacuum) | **Candidate-live (E6, flagged F4)** — only if a sealed make declares a sealer requires row; otherwise stay parked. Owner to confirm E6 covers sealer or defers it |
  | `lid`, `fan`, `accuracy`, `pulse`, `rotisserie`, `speed`, `steam`, `throughput`, `waterPan`, `watts` | **Stay PARKED, honestly.** No `requires` consumer in this spec's scope. `watts` is the honest input for a sous-vide come-up task (D8) — but warm-up task generation is plan-pipeline work, **out of scope (§10)**. Named here so the plan does not silently claim to have "activated the device properties" |

  Already-live today (context, not in the 14): `hooks`/`canHang` (via `deviceCanHang`), `areaCm2`,
  `cap.baths`/`channels`/`zones`. The requires model (§4.2) reads these; it does not newly activate them.

### 4.2 · The `requires` schema — one shape, two sources (Q4)

Every catalog item (cut / spec / make / umake) exposes a **`requires` list**. Each row:

```
{ role:'cook'|'process', kind:'smoker'|'bath'|'oven'|'grill'|'grinder'|'stuffer'|'sealer'|'curing',
  capability?:{ minTempC?, maxTempC?, hang?, bathMinL?, plateMm?, nozzleMm? },
  demand?:{ metric:'area_cm2'|'litres'|'zones', amount },      // capacity claimed (§4.3)
  source:'derived'|'declared', altOf?:<reqId> }                // provenance; altOf marks a replacement row
```

**Source 1 — AUTO-DERIVED (zero migration, all 3,677 items day one, cannot drift).** A pure function
`deriveRequires(meta, methodKey, order)` reads the **same** stage data the plan already computes —
`itemStages(meta, methodKey, ready, order)` kinds (`app.js:3223`), the cited method temps (`obj.smt/svt/sot`,
resolved exactly as `askContextFor` reads them), and the footprint the occupancy engine already uses
(`itemOccupancy`, `app.js:356`, `meta.obj.equip.spec.footprint_cm2` / `min_bath_l` / `hang`). It maps
`stage.kind` → `kind` via the existing `cookerCandidates` policy (`app.js:233`; `smoke`→smoker + a
charcoal/kettle/gas grill, `cook`→grill|oven, `sv`→bath — *erratum corrected 2026-07-25 after the E1
whole-branch review: this line previously mis-stated the pre-existing policy as "cook→smoker|oven"; the
code was always as now described*) and attaches `capability.maxTempC` from the cited temps and `demand`
from the footprint (*E1 note: a `minTempC`/hold-low capability — the cold-smoke constraint — has no
derivable source in E1 and is an OPEN owner question recorded at the phase boundary, not silently
dropped*). **Because it is derived from the same inputs the plan reads, it cannot disagree with the
plan** — this is the anti-drift property the owner named, and it closes D4's "no device requirement is declared
in data" for the **cook** role structurally (the narrow `equipPlan` fuel/refuel enrichment breadth is a
separate, out-of-scope concern, §10). `sv` is covered here from day one (unlike `equipPlan`, which never
touches `sv`).

**Source 2 — DECLARED (authored data, E6).** Processing devices (grinder, stuffer, sealer, curing chamber)
and alternative/changed-flow rows are authored in the data layer (`data.py`, merged at build time), **starting
with makes/sausages where a grinder + stuffer are mandatory**. A declared row carries `source:'declared'`; an
alternative carries `altOf` pointing at the row it can replace. Authoring is a bounded, reviewable data task
(E6), not a migration.

**The invariant that closes S3's "three capacity rules" (B-i.1):** the **physical-ownership check
(`EQM.ownership`) and the window check (`EQM.availability`) answer from the SAME `requires` list** — there is
one source of truth for "what does this cook need", consulted by every gate. See §5.

### 4.3 · The reservation ledger — **NET-NEW** `mk-eqm-ledger` (Q3)

The one genuinely new store. An array of entries:

```
{ id, deviceId, window:{ startMs, endMs }, capacityDemand:{ metric, amount }, holder, state }
   holder := { type:'event'|'plan', id }        // who reserved it — cancelling frees all of a holder's holds
   state  := 'held' | 'released'
```

**Capacity math is `deviceOccupancy`'s existing fit arithmetic, absorbed (Q3).** The ledger does **not**
re-invent fit; `EQM.availability` computes, for a candidate `(deviceId, window, capacityDemand)`, the sum of
overlapping `held` entries' demands against the device's capacity (`deviceCapacity`, `app.js:305`), using the
**same** per-slot honesty ladder `deviceOccupancy` already implements (`ok`/`tight`/`over`, area-vs-volume,
the bath-litre precedence). "Two briskets share a cabinet if they fit" is exactly the per-slot sum staying
within `usableCm2`; a bath is the litre sum staying within the bath volume. **`capacityDemand` derivation
(flag F2):** E1/E2 derive `amount` from the **same static `footprint_cm2`/`min_bath_l`** the engine uses today
(`itemOccupancy`) — which means D5 (occupancy demand ignores guest/piece count) is **NOT auto-fixed** by
adopting the ledger; the static footprint flows straight through. D5's guest-scaling fix ("derivable from
`rawGramsFor` + reference weight") is a clean enhancement the ledger's `capacityDemand` field is *shaped to
accept* but which this spec does **not** commit E2 to building — owner to confirm whether D5 is in E2 or stays
a named future gap (§12, F2).

---

## 5. The four-question API + validity propagation (owner design §3 + §4)

### 5.1 · The four questions (contracts)

**`EQM.ownership(requires) → { ok, missing, partial }` — physical, catalog-level, window-independent.**
For each `requires` row, scan the registry (`equipList()`) for an owned device whose `cat`/`type` maps to the
row's `kind` **and** whose capability satisfies the row's `capability` (temp ceiling via `deviceCapacity`/
temp props, `hang` via `deviceCanHang`, bath size via `chooseBath`, plate/nozzle via `choosePlate`/
`chooseNozzle`). `missing` = rows with **no** owning device of the kind. `partial` = rows where a device of
the kind is owned but a capability sub-requirement is unmet (e.g. owns a bath but none reaches the size; owns
a smoker that cannot hang). `ok` = every row fully satisfied. **This is the single verdict all three gates
call (§5.2) — closing B-i.1 structurally: one rule, not three.**

**`EQM.availability(requires, window) → { state, room }` — ledger + capacity fit.** For the device(s)
satisfying `requires`, over `window`: `free` = the new `capacityDemand` fits with margin; `partial` = it fits
but leaves the device near capacity, with `room` naming how many more of this demand fit ("room for X more",
Q3's partial answer); `busy` = it does not fit. **D11 negative case is a first-class requirement:** an empty
or absent device answers `busy`/`missing`, **never** the "`✓ everything fits`" fall-through the current
occupancy view shows for an empty device (`app.js:674`) — the negative case is tested (DoD-6).

**`EQM.allocate(requires, window, holder) → { ok, holdIds }` / `EQM.release(holder) → { freed }`.**
`allocate` writes one `held` entry per satisfied requires row to `mk-eqm-ledger`, tagged with `holder`, after
an `availability` check (it will not over-book past `busy`). `release(holder)` flips **every** entry for that
holder to `released` — **cancelling an event frees all its holds** (Q3), a single call, no per-device
bookkeeping at the call site.

**`EQM.alternatives(missingReq) → [suggestion]` — the replacement ladder (§7).**

### 5.2 · Validity propagation — one rule, three gates (owner design §4)

All three gates call the **same** `EQM.ownership`; the event gate additionally consults `EQM.availability`
for the window. One verdict, three surfaces — this is the structural closure of S3's "a correct shared
verdict that 2 of 3 consumers bypass" and of B-i.1 and B-i.6 (a bath conflict is reported as a bath conflict,
because the ledger holds the real `deviceId` and the requires row holds the real `kind` — no more hardcoded
`⚠ מעשנה`/"Smoker" for every clash).

| Gate | Trigger | Verdict source | Behaviour on failure | Proposed Hebrew (proposed, not final — §2.1) |
|---|---|---|---|---|
| **Catalog / recipe card** | Rendering a card | `EQM.ownership` | Card shows the item **BOLD-invalid** with the reason; not blocked from *viewing* | badge `חסר ציוד` / reason `דרוש: <kind>` · EN `Missing equipment` / `Requires: <kind>` |
| **Plan-add** | Adding item to a plan | `EQM.ownership` | **BLOCKED** with reason | toast `לא נוסף — חסר <device>` · EN `Not added — missing <device>` |
| **Event-add** | Adding item to a dated event | `EQM.ownership` **+** `EQM.availability(window)` | **BLOCKED** with reason (missing device **or** busy window) | `<device> תפוס בחלון הזה` · EN `<device> is busy in this window` — device name in a `dir="ltr"` island where Latin/numeric |

Each gate's reason string is derived from the `missing`/`partial` rows (or the `busy` device), so it names the
real device kind. **The three gates are the same verdict rendered three ways — not three rules.**

---

## 6. Cooking order (owner design §5)

**Recipe-level default + per-event override, generalizing the existing `svSmokeOrder` seam.** Today the seam
is sous-vide-specific: `SV_SMOKE_ORDERS` (`app.js:2963`), `svSmokeOrderDefault()` (`app.js:2969`), stored per
item-per-event (`st.svSmokeOrder` `app.js:6061`; `evState[key].svSmokeOrder` `app.js:8267`), both feeding one
`itemStages`. E4 **generalizes this exact seam** into a named per-recipe **default order** plus a **per-event
override**, without changing that both plan surfaces read from one place (the property the map §1.7 confirms
holds today by construction).

**Order feeds the ledger (Q3/§5).** Because `deriveRequires` (§4.2) reads `itemStages(…, order)`, and
`itemStages` already branches on order (`app.js:3223`, `order==='smoke-sv'` builds a different stage
sequence), **flipping the order re-sequences the derived requires' windows** — the smoke stage and the bath
stage swap their time slots, so their ledger reservations move with them. This is the "order feeds the ledger;
flipping it re-sequences allocation windows" the owner named, and it drops out for free from deriving requires
off the order-aware `itemStages`, **provided E4 lands after E2** (the ledger exists to re-sequence into).
**Safety-invariance still holds:** order changes *which cited stage runs when*, never a `temp`/`safe`/duration
— `itemStages` already owns that, and `comboHasSvSmoke` (`app.js:3274`) still gates the reverse order on cited
`order_smokesv` data, never a heuristic (map §1.7). E4 must not touch that gate.

> **AMENDMENT O-1 — owner ruling in conversation, 2026-07-25 (catalog-first order selection).**
> The **catalog item is the FIRST place where order is selected**: the recipe card exposes the item's
> order (its per-recipe default), and that selection *is* the default every downstream surface inherits.
> The event plan and the single-item cook flow may **override** it, per occurrence. The **source of
> truth for what an order MEANS — times, temperatures, effects, and consequences — is always the lowest
> layer: the item recipe in the catalog** (the cited `order_smokesv`-class data in `sources.py`);
> no upper layer may restate or recompute those semantics, an override only picks among the item's
> cited orders. Consequences for E4 planning: (a) the §7 charter note "E4 adds **one** affordance"
> widens to **two** — the catalog-card default selector and the per-occurrence override — C8 stays
> PARTIAL either way and the safety analysis is unchanged (order selection never touches temps or
> durations, which remain cited data); (b) the eligibility gate (`comboHasSvSmoke`) applies identically
> at both layers — an order the item's data does not cite is not offered anywhere, so the catalog can
> never promise what the cook screen would refuse. Registered companion (authoring track):
> `docs/analysis/program/registered-2026-07-25-order-vocabulary.md`.

> **AMENDMENT O-2 — owner ruling in conversation, 2026-07-25 (the consulting-AI button).**
> Next to BOTH decision surfaces — the **order-change option** (§6, both O-1 layers) and the
> **replacement / substitute-device option** (§7, E5) — the app offers a **consult-AI button**: a live,
> AI-composed explanation of *what this action means* (consequences of flipping the order; what cooking
> on the alternative device type changes), grounded first in the item's own cited data and then in **the
> best reliable web sources, fetched live with search grounding, citations shown**. Binding rails:
> **(a) advisory only** — the consult answer never mutates state, never enters the plan, and is not a
> source of truth; O-1 stands: semantics live in the item's cited data, and approving a replacement
> remains the user's explicit act (E5's approve/deny contract). **(b)** All existing AI trust rails
> apply unchanged — the numeric guard on safety figures (model-originated numbers are never presented
> as verified), dangerous-intent refusal, and `aiAvail()` gating (online-first). **(c)** This is a NEW
> AI usage with its own `AI_SEARCH` registry key with search grounding **enabled** — it does not alter
> E5's separate alternatives-suggestion call (deterministic ladder first, `search:false`), which stays
> as specified; suggestion and consultation are different calls with different grounding policies.
> **(d)** Delivery rides the phase that owns each surface: E4 (order side), E5 (replacement side).
> If voiced later under the voice track, `vcGuardSpoken` applies as everywhere.

> **AMENDMENT O-3 — owner ruling in conversation, 2026-07-25 (timeline impact + the infeasibility
> dialogue).** An order change or a device substitution may move stage windows and therefore the
> **timeline of the plan or of ongoing event(s)**. Three binding requirements:
> **(1) Show the impact.** Before the user confirms such a change, the affected timeline is shown —
> which stages move, what the new serve-readiness looks like, which other items/events are touched
> (the ledger re-sequencing of §6 made visible, not silent).
> **(2) The orchestrator re-synchronizes.** The scheduler/orchestrator owns making everything on time
> and synchronized after the change — re-sequencing, re-allocating devices via the ledger, and
> optimizing across the affected event(s), not merely recomputing one item.
> **(3) The infeasibility dialogue.** When the orchestrator concludes the current schedule CANNOT
> deliver on time, it must not silently accept or silently refuse — it opens a dialogue with the user
> offering the honest options: **delay the supply/serving time**, apply **another fixing operation**
> (different device assignment, a different cited order, splitting across devices where the data
> allows), or **cancel the request** as undeliverable in the current schedule. The user decides.
> **Safety rail (non-negotiable):** feasibility fixes operate on the SCHEDULE side only — shift
> times, reassign devices, choose among the item's cited orders. **Never** compress a cited cook/cure
> duration or raise a temperature to make a timeline fit (the setpoint-fence principle generalized:
> the schedule serves the recipe, never the reverse).
> **Delivery:** the feasibility computation is E2's availability/ledger + the existing scheduler; the
> impact preview and the dialogue ride the surfaces that trigger them (E4 order side, E5 replacement
> side; E3's retroactive-invalidation flow shows the same impact view when equipment changes strike
> existing plans). Exact task placement is decided at those phases' planning, carrying this amendment
> as binding text. O-2's consult button may EXPLAIN the options; the options themselves are
> deterministic scheduler output, never AI-generated.

> **AMENDMENT O-4 — owner ruling in conversation, 2026-07-25 (cited ranges are free parameters).**
> Refines O-3's safety rail without weakening it. Some stage durations/temperatures are defined in the
> item's cited data **as ranges or alternative cited schedules** — e.g. a sous-vide hold of "2–4 h", a
> time-defined smoke of "1.5–2 h" (the `order_smokesv` entries already carry exactly this shape,
> `h:'1.5-2'`), or a cited higher-temperature schedule that shortens a smoke. **Within those cited
> bounds, the parameter is FREE for the orchestrator** — a legitimate schedule-side degree of freedom
> for hitting the timeline, alongside O-3's shift/reassign/reorder moves. Binding boundaries:
> **(a) Cited endpoints only.** A parameter is free ONLY where the item's own cited data defines the
> range or the alternative schedule. No interpolation formulas, no extrapolation past an endpoint, no
> transferring a range from one item to another. Absent cited range ⇒ the value is fixed, O-3's rail
> applies verbatim.
> **(b) Safety minimums always hold.** The pasteurization/safety minimum end of a cited range is a
> floor, never crossable; a stage **gated by internal temperature** (probe target, `bcheck`) is NOT
> time-adjustable — its gate is the thermometer, not the clock.
> **(c) Approval or auto mode.** Every free-parameter adjustment is SHOWN in O-3's impact preview.
> In default mode the user approves before it applies; a **system-settings "auto mode"** lets the user
> pre-authorize the orchestrator to apply free-parameter adjustments autonomously (the preview still
> shows what was adjusted, after the fact). Auto mode never extends to O-3's dialogue decisions
> (delay serving / cancel) — those always ask.
> **(d) Data note for the authoring track:** ranges must be stored as structured cited data (min/max +
> source), not prose, for the orchestrator to use them — rides the same registered authoring item as
> the order vocabulary (`registered-2026-07-25-order-vocabulary.md`), and "maybe there are more" free
> parameters enter the same way: cited, structured, one at a time.
> **(e) Range acquisition — owner addendum, 2026-07-25.** Ranges obey O-1's bottom-layer law: they
> live on the **catalog item recipe** as cited data. Where an item lacks a range, **AI may be used to
> acquire one by querying the source-of-truth data sources** (the app's named primary-source canon —
> USDA/FSIS, Baldwin, 9 CFR — via the O-2 search-grounded stack), returning the value WITH its
> citation. An AI-acquired range is a **sourcing channel, not a runtime value**: before the
> orchestrator may use it, the user explicitly approves it (shown with its citation) and it is
> written into the item's cited data — it never floats as an ephemeral model output, and acquisition
> is **never covered by auto mode** (it changes the source-of-truth layer; auto mode only applies
> adjustments within ranges the item already carries). An acquired range can never relax an existing
> cited safety minimum, and untraceable AI output (no primary-source citation) is rejected, not
> stored — "every safe value must trace to a cited primary source, never guess" applies to ranges
> exactly as to single values.

> **AMENDMENT O-5 — owner ruling in conversation, 2026-07-25 (the uncookable item explains itself).**
> A catalog item that **cannot be cooked with the owned equipment** is **emphasized to the user** (the
> bold-invalid treatment of §5.2) **with a clear, simple explanation of WHY and HOW TO FIX IT** —
> never a bare badge. Binding shape:
> **(1) Two honesty levels.** *Uncookable* = NO cited method of the item resolves against the owned
> kit — full bold-invalid emphasis. *Default-method-blocked* = the default combo fails but another
> cited method works — lighter emphasis, and the working method IS one of the fixes offered. The
> distinction prevents crying wolf on an item the user can in fact cook another cited way.
> **(2) WHY, concretely.** Name the device(s): which required kind is missing entirely and which is
> owned-but-insufficient (the `partial` verdict — e.g. bath too small for the demanded litres), read
> straight from `EQM.ownership`'s missing/partial rows. Plain language, Hebrew-first, one line per gap.
> **(3) HOW TO FIX, deterministically.** The offered fixes are the real ones, in order of cheapness:
> add/configure the device in the Equipment Manager (deep-link there); switch to another **cited**
> method/order of the same item that the owned kit satisfies; use a **cited** replacement device when
> E5's ladder offers one (approve/deny as specified). O-2's consult button may sit beside the
> explanation to elaborate — but the fix list itself is deterministic output of ownership + the item's
> own cited data, never AI-generated.
> **(4) Delivery.** Task 4's informational chip is the seed (per-kind ok/partial/missing); the full
> emphasized why-and-fix treatment is **E3's** bold-invalid surface (same verdict, escalated), with
> E5 supplying the replacement-fix path when it lands. E3's plan carries this amendment as binding.

> **AMENDMENT O-6 — owner ruling in conversation, 2026-07-25 (the device-usage display reads EQM).**
> The existing graphic display of device usage (the occupancy view) **is part of the Equipment
> Management domain and sources its data from the module** — it becomes a READER of `EQM`
> (availability/ledger) with **no parallel data path**. The spec already absorbs `deviceOccupancy`'s
> fit math into the ledger (§4.3/Q3, E2); this ruling binds the VISUALIZATION to the same source in
> the SAME phase: when E2 rewires the math, the display rewires with it — no transition period in
> which the view computes usage numbers the module doesn't own. Any future usage/occupancy surface
> (including P7's C11 ordering work) reads EQM only.

---

## 7. Replacements (owner design §6) + Retroactive invalidation (owner design §7)

> **AMENDMENT O-2 applies to this section's E5 surface** (see the full block in §6): a consult-AI
> button beside the replacement offer explains, live and web-grounded with citations, what cooking on
> the alternative device changes — advisory only, distinct from the alternatives-suggestion call
> (which keeps its deterministic-first, `search:false` policy).

### 7.1 · The replacement ladder (§6)

`EQM.alternatives(missingReq)` returns suggestions in a fixed, deterministic-first order:

1. **Declared `alt` rows first (deterministic).** Any `requires` row whose `altOf` points at `missingReq` and
   whose own `EQM.ownership` passes — the user already owns a declared substitute. Deterministic, no AI, no
   cost. Presented first.
2. **AI-suggested second — through the EXISTING guarded AI layer.** Only if no declared alternative is owned.
   Grounded on the **device registry + the requires row** (never free web content for this call), routed
   through `aiJSON` (`app.js:4617`) with `search:false` (a device-substitution question is answered from the
   user's own kit, not the web — the `AI_SEARCH`/`searchFor` `'auto'` policy, `app.js:4286`, already yields
   `false` when local grounding is present, which it always is here). The AI proposes a substitution from what
   the user owns; it never invents a device.
3. **ALWAYS user approve/deny — reuse `aiConfirmPanel` (`app.js:4681`).** No substitution — declared or AI —
   ever applies silently. The existing approve/deny panel (today 2 call sites) gains device-replacement as its
   third. Proposed Hebrew: `להחליף ל-<alt>?` / EN `Replace with <alt>?` (proposed, not final).
4. **Approval persists on the plan; deny stays invalid.** An approved replacement is stored on the plan
   (a new scoped key, e.g. `mk-eqm-altpick-<scope>`, schema-registered per S4's keyspace lesson) so it
   survives re-render; **deny leaves the item bold-invalid** (§5.2) — the app never silently proceeds with a
   device the user rejected.

**This is C2 ("no AI proposer exists") closed for the *replacement* axis — and only that axis.** An AI
proposer for *moves/re-scheduling* is a different thing and is **out of scope (§10)** — that is P8.

### 7.2 · Retroactive invalidation (§7)

Deleting a held device from `openEquipment` (`app.js:6773`) must **WARN with the full impact list**, never
fail silently and never hard-block:

1. On delete, `EQM` computes impact: `mk-eqm-ledger` entries whose `deviceId` is the doomed device (→ the
   events holding it) **plus** the plans/events whose `requires` are satisfied **only** by that device (re-run
   `EQM.ownership` with the device removed; the rows that flip to `missing` are the dependents).
2. **Warn:** proposed Hebrew `ציוד זה משמש ב-<N> אירועים ו-<M> בישולים מתוכננים. למחוק בכל זאת?` /
   EN `This device is used by <N> events and <M> planned cooks. Delete anyway?` — `<N>`/`<M>` in `dir="ltr"`
   islands (L13), correct singular/plural (§2.1). (Proposed, not final.)
3. **On confirm:** the device is removed (**removal is never hard-blocked** — the owner's decision), its holds
   are released (`EQM.release` on the affected holders, or a targeted ledger sweep), and every dependent flips
   to **bold-invalid** via the same §5.2 verdict — **visible, never silent**. The user can then use the
   replacement ladder (§7.1) on each newly-invalid item.

---

## 8. Charter absorption — reconciliation table (owner design §8; §4 Waiver Gate applies to the reconciliation itself)

The charter's subsystem gap **counts** (S2=25, S3=15, …) are rollups; the ULTIMATE doc does not enumerate them
as numbered lists. This table therefore reconciles against the **enumerable, citable** ULTIMATE gap IDs in the
equipment/capacity/orchestrator space — **§3.B-i (7), §3.C (12), §3.D (11) = 30 IDs** — plus the charter's own
**P8** solver row and **P9** cross-event row. Every row gets a disposition: **COVERED** (this spec closes it),
**PARTIAL** (this spec closes part; the remainder is named + placed), or **NOT-HERE** (explicitly out, with
its real home). **Nothing is silently dropped** — that is the Waiver Gate applied to this table.

### 8.1 · §3.B-i — capacity / "two views of one plan disagree"

| ID | Gap | Disposition | Where / why |
|---|---|---|---|
| **B-i.1** | Three different capacity rules for one device | **COVERED** | One `EQM.ownership`/`availability` verdict, all three gates (§5.2) + ledger capacity math (§4.3). The exact structural closure the owner named |
| B-i.2 | Serve time — three surfaces, 3.5 h apart | **NOT-HERE** | The serve-instant identity/keyspace (charter §8 "the serve instant"; S4/P5b) — not an equipment concern |
| B-i.3 | Multi-day items blocked in one view, scheduled in other | **NOT-HERE** | Plan-pipeline `blocked` concept + cross-event render (P5a / P9) |
| B-i.5 | Advisory vs clash banner disagree by construction | **PARTIAL** | The **shared verdict** (§5.2) removes the *rule* divergence; the *render-timing* divergence (`_plcConflicts` computed before the shift vs `cookerContention` after) is plan-pipeline (P5a) |
| B-i.6 | Combined view calls every clash "Smoker" | **COVERED** | Ledger holds the real `deviceId`, requires holds the real `kind` — reasons name the true device (§5.2) |
| B-i.7 | Bath advice contradicts the occupancy model (smallest vs largest) | **PARTIAL** | E2 absorbs the fit arithmetic into one place; the smallest-vs-largest **selection** unification is charter **R6** (one shared bath-selection function) — named, placed, not silently merged |
| B-i.4 | Only one of three plan shapes can be ticked | **NOT-HERE** | Work-plan render (P7 / S2) |

### 8.2 · §3.C — orchestrator & workflows

| ID | Gap | Disposition | Where / why |
|---|---|---|---|
| **C1** | Phase-3a solver 0% built | **PARTIAL** | The **hold-safety spine** (`allocate`/`release` + the §2.2 safety invariance) is built (E2/E5). The **move-solver** (`movesForClash`/`applyMove`) is **OUT** — stays P8 (§10) |
| **C2** | No AI proposer exists | **COVERED** (replacement axis only) | E5 AI-suggested **replacements** through the guarded layer (§7.1). AI **move**-proposal is OUT (P8) |
| **C3** | Cross-event resource allocation does not exist | **COVERED** (substrate) | The ledger + `EQM.availability` answer cross-event free/partial/busy; holds are holder-tracked across events (§4.3/§5). **Automated cross-event re-allocation stays P9** (§10, flag F1) |
| **C4** | Placer searches with the wrong fit test (whole-device) | **PARTIAL** | `EQM.availability` uses the **per-slot** honest verdict (§4.3); the *placer's candidate-set search* improvement is P5a/P8 |
| C8 | User cannot influence durations/shelf/preheat/method | **PARTIAL** | E4 adds **two** affordances (AMENDMENT O-1: the catalog-card default order selector + the per-occurrence override, §6) — order selection only, never durations/temps. The rest (shelf/preheat/duration overrides) is P7 |
| C5 | Non-uniform slack set silently discarded (`uniq.length!==1`) | **NOT-HERE** | Plan-pipeline scheduling advisory (P5a/P8); the ledger does not touch intra-item slack |
| C6 | Advisory recommends non-existent "cook in batches" | **NOT-HERE** | Advisory copy (P7); capacity-share (§4.3) addresses the underlying share concept but not the copy |
| C7 | `SCHED_PULL_MAX_MS` has no UI | **NOT-HERE** | P7 |
| C9 | Work Plan opens 2.1 screens above "now" | **NOT-HERE** | P7 scroll |
| C10 | Voice-cook jump list drops the day marker | **NOT-HERE** | Voice — separate track (Q1) |
| C11 | Occupancy view orders empty devices above occupied | **NOT-HERE** | P7 UI ordering |
| C12 | Live Copilot is the thinnest surface | **NOT-HERE** | P7 |

### 8.3 · §3.D — equipment-to-plan

| ID | Gap | Disposition | Where / why |
|---|---|---|---|
| **D1** | `choosePlate`/`chooseNozzle` built, tested, called nowhere | **COVERED** | E6 declared-requires grinder/stuffer join gives both a production consumer at last (§4.1, §7.1) |
| D2 | 14 device properties read for display only | **PARTIAL** | Enumerated honestly (§4.1): `plates`/`nozzles` go live (E6); most stay parked, named |
| **D3** | Two cooking-area fields, only one drives the engine | **COVERED** | E1 registry hygiene names `areaCm2` canonical (§4.1) |
| D4 | The `equipPlan` seam is narrow (smoker-only fuel, no `sv`) | **PARTIAL** | The **requires** path covers all kinds incl. `sv` from day one (§4.2); the `equipPlan` **fuel/refuel enrichment** breadth is a separate enrichment gap (P7), named |
| D5 | Occupancy demand ignores guest/piece count | **PARTIAL / flag F2** | The ledger's `capacityDemand` is *shaped* for guest-scaling but E2 inherits the static footprint by default; owner to confirm scope (§4.3, §12) |
| D7 | Charcuterie Slice B 0% | **PARTIAL** | E6 covers the **grind-plate/nozzle** join (= D1); cylinder loads + vacuum liquid-seal warning are broader, OUT |
| **D11** | "everything fits" is the fall-through for an empty device | **COVERED** | `EQM.availability` negative case answers `busy`/`missing`, tested (§5.1, DoD-6) |
| D6 | Probe-channel budgeting is a footer count | **NOT-HERE** | Probe/BLE track (§10) |
| D8 | Warm-up is smoker-only (no bath come-up) | **NOT-HERE** | Task-generation (P7); `watts` named as the honest future input (§4.1) |
| D9 | `grz` grill zoning has one consumer | **NOT-HERE** | Candidate future requires-capability; not this spec |
| D10 | Pellet/electric owner still sees "wood: oak" | **NOT-HERE** | Enrichment copy (P7) |

### 8.4 · Charter P8 / P9

| Charter row | Disposition | Where / why |
|---|---|---|
| **P8** `orchestrate` / `movesForClash` / `applyMove` (the move-solver) | **NOT-HERE** | Automated re-planning stays P8 (§10). This spec is detection + blocking + manual choice |
| **P8** `safetyGate` / hold-safety spine | **PARTIAL** | The reservation ledger + `allocate`/`release` + the §2.2 safety invariance **is** the hold-safety spine; the solver's own `safetyGate` stays P8 |
| **P9** Cross-event allocation | **PARTIAL** | The cross-event **ledger + availability query** is built now (Q3); the **automated cross-event re-allocator** R5 defers stays P9 (§10, flag F1) |

### 8.5 · Tally

**33 rows mapped** (30 ULTIMATE IDs + P8 solver + P8 spine + P9). **18 absorbed** — **7 COVERED**
(B-i.1, B-i.6, C2, C3, D1, D3, D11) + **11 PARTIAL** (B-i.5, B-i.7, C1, C4, C8, D2, D4, D5, D7, P8-spine, P9).
**15 explicitly NOT-COVERED-HERE**, each with a named home (P5a plan-pipeline · P7 product surface · P8
move-solver · voice track · probe track · charter R6 bath selection · S4 serve identity). **Nothing dropped
silently.**

---

## 9. Phasing — six independently-shippable, DoD-gated sub-scopes

Suggested decomposition; the plan decides exact tasks. Each phase is independently shippable and gated by the
full DoD (§11). Dependency order is a spine, not a strict serial chain — E3/E4/E5/E6 fan out once their
prerequisites land.

| Phase | Scope | Ships | Depends on | Gate (headline) |
|---|---|---|---|---|
| **E1** | Module + registry + requires-derivation | `equipment.js` scaffold + `build.py` inline; `EQM.ownership`; `requires` schema + `deriveRequires` for all 3,677 items; D3 area-field collapse; D2 live/parked enumeration | — | `EQM.ownership` returns ok/missing/partial correctly, TDD'd at the boundary; suite green; safety-invariance snapshot identical |
| **E2** | Ledger + availability | `mk-eqm-ledger`; `EQM.availability` (capacity math absorbed from `deviceOccupancy`); `EQM.allocate`/`release`; holder-tracked, cancel-frees-holds | E1 | `availability` answers free/partial/busy incl. **D11 negative case**; allocate/release round-trip leaves `itemStages` byte-identical |
| **E3** | Validity gates | Three gates (catalog bold-invalid · plan-add blocked · event-add blocked), all one verdict; retroactive-invalidation warn+impact | E1 (ownership); E2 (event-add window block) | All three gates render the same verdict at 390×844; Hebrew screenshotted; delete-warning shows real N/M |
| **E4** | Cooking order | Recipe default + per-event override generalizing `svSmokeOrder`; order re-sequences ledger windows | E2 | Flipping order moves the ledger windows; `temp`/`safe`/duration byte-identical; `comboHasSvSmoke` gate untouched |
| **E5** | Replacements + AI | `EQM.alternatives` ladder (declared → AI via guarded `aiJSON` → `aiConfirmPanel` approve/deny → persist/deny) | E1 (alternatives on requires); E3 (invalid states to replace) | Denied replacement stays invalid; AI call carries `search:false`; approval persists across re-render |
| **E6** | Declared-requires authoring for makes | `source:'declared'` grinder/stuffer(/sealer?) rows on makes/sausages; `choosePlate`/`chooseNozzle` join wired (D1) | E1 (requires schema) | A make missing a grinder is bold-invalid; the negative case (owned grinder, wrong plate mm) tested |

---

## 10. Out of scope — explicit boundaries (flag every one; §4 Waiver Gate governs any later change)

- **Voice / Voice-Cook** — its own parallel track (Q1). C10 and any spoken surface of equipment state are not
  here.
- **Navigation redesign** — comes **after** equipment (Q2). The surfaces this spec creates (device
  management, allocation timeline, invalid-cook states, replacement approval) are **inputs** to that future
  nav spec, not built into a new nav here.
- **The P7 home-screen / product-surface work** — the occupancy-view ordering (C11), the Live Copilot (C12),
  the scroll-to-now (C9), `SCHED_PULL_MAX_MS` UI (C7), the "cook in batches" copy (C6), enrichment copy
  (D8/D10), and all presentation-token / layout work stay P7.
- **The full orchestrator solver's automated RESOLUTION** — `movesForClash`/`applyMove` and any **automated
  re-planning / re-allocation** (moving cooks across time or devices to resolve a clash). **This spec builds
  detection + blocking + manual choice only.** Automated re-planning stays **P8**; automated **cross-event**
  re-allocation stays **P9** (R5). Bringing either forward is a future owner decision, not an implicit
  extension of this spec. **(Flag F1 — the boundary the owner should eye: the *ledger/availability substrate*
  is brought forward now per Q3; the *automated re-allocator* is not.)**
- **The plan-pipeline extraction (P5a)** — B-i.3, B-i.5 (timing), C4 (search), C5. `EQM.*` consumes the
  pipeline's output; it does not extract the render closure. That is P5a's own spec.
- **D5 guest-count-scaled demand**, **charter R6 bath-selection unification**, **the `equipPlan` fuel/refuel
  enrichment breadth (D4)** — named, placed, not built here unless the owner folds them in (§12).

---

## 11. Definition of Done — binding `CLAUDE.md` §3 (12 points) + charter §5

### 11.1 · Program-level gates (charter §5, quoted verbatim)

> **§5.1** Every task passes the 12-point DoD in `CLAUDE.md` §3. No exceptions, including *witnessed RED*, a
> **named production consumer** for any computed value, a screenshot at **390 × 844** for any UI change, and a
> full green suite with no `--retries` and no `--workers=1`.

> **§5.3** The Waiver Gate stands (§4). Any requirement that cannot be met is raised **in conversation** with
> the spec text and the reason. Recording it in a document does not count as raising it. Per D2, this now
> includes anything the assistant would otherwise call "deferred."

**Charter §5.2 (Data Correction Gate) does not apply** — this programme alters **no** `safe`/`cure`/salt
value (§2.2; every phase's safety-invariance assertion proves it).

### 11.2 · `CLAUDE.md` §3's 12-point per-task gate — how each point binds here

1. **Spec requirement traced.** Every task quotes its §0.2 row + the owner decision + the ULTIMATE/charter id.
2. **RED witnessed.** Each `EQM.*` function and each gate has a test written first, observed failing for the
   intended reason, output pasted. A test that passes on first run is void.
3. **GREEN.** Full test command fresh, output + exit code pasted.
4. **Behavioural assertion.** Every test asserts an **observable effect** — a rendered bold-invalid badge, a
   blocked add, a ledger entry a real gate reads, a spoken/visible reason — never a computed `requires` field
   that nothing consumes.
5. **Consumer exists (L8).** Every derived value (`requires`, `capacityDemand`, an `availability` verdict) has
   a named production reader that **fires on real data** — the gate, the card renderer, the delete-warning.
   The requires model's own reason for existing is that the three gates read it; name the render path and
   confirm it executes.
6. **Fixture minimality + negative case.** The **D11 negative case** (empty/absent device answers `busy`, not
   "everything fits") is mandatory; a make with the wrong grinder plate mm (E6) is a required negative case.
7. **Regression red-green** for the bugfix-shaped items (B-i.1's three-rules divergence, B-i.6's "Smoker"
   mislabel, D3's two-area-field, D11's fall-through): defect reverted → test FAILING → fix restored → test
   PASSING, both outputs pasted.
8. **Visual evidence.** Every UI change (bold-invalid card, blocked-add toast, availability answer,
   delete-warning, replacement panel) screenshotted at **390 × 844** and looked at.
9. **Hebrew check (L13).** Every new string rendered in Hebrew, no English leak, correct singular/plural on
   `<N>`/`<M>`/room counts, `dir="ltr"` islands around all numerals/device-Latin. Screenshot.
10. **Safety invariance.** The §2.2 assertion (snapshot `resolveItem(key).obj` + full `itemStages` output
    before/after every `EQM.*` round-trip; byte-identical) is named and run in **every** phase — this is the
    single most important gate of this programme.
11. **No arbitrary waits.** Tests wait on conditions (`waitForFunction`), never `waitForTimeout`.
12. **Full suite green.** `npx playwright test` plain, output pasted. Never `--retries`/`--workers=1`. Any
    failure, including intermittent, is a bug.

### 11.3 · Phase-level completion

- A phase is complete when every DoD line above is quoted MET with evidence, and an **independent re-audit by
  a fresh agent against this spec (not against a ledger)** confirms every §0.2 row the phase claims.
- The **programme** is complete when E1–E6 each pass, the §8 reconciliation table's 18 absorbed rows are each
  demonstrably closed (COVERED) or their PARTIAL remainder is demonstrably placed in its named phase, and a
  fresh agent confirms no NOT-HERE row was silently converted into a silent drop.

---

## 12. Self-review — judgement calls flagged for the owner's spec review

Per the `brainstorming` skill and the P0-app precedent: every place this draft decided something the owner's
verbatim decisions did **not** settle is surfaced here, as *proposed*, for confirm/override on spec review.
None is treated as settled by virtue of appearing above.

**Placeholders — none left.** Every section has concrete current-state (Serena-verified), a concrete
contract, a concrete phase, and concrete (proposed) Hebrew copy. Nothing reads "TBD."

**Ambiguity / judgement calls flagged (not silently resolved as fact):**

- **F1 — the charter-ordering reconciliation (the one that most deserves the owner's eye).** R5 says
  "cross-event allocation waits until after the orchestrator" (P9). Owner decision Q3 authorizes a
  capacity-share reservation ledger with holders across events, queryable now. This spec's reading:
  **R5 defers the automated cross-event *re-allocator* (still OUT, §10); Q3 authorizes the *ledger +
  availability query* now.** That reading is stated openly per the Waiver Gate (§2.6) — but it is a
  spec-author interpretation of how Q3 and R5 fit, and the owner should confirm the P9 boundary is drawn
  where §10 draws it (substrate now, automated re-allocation later), or move it.
- **F2 — `capacityDemand` derivation / D5 scope.** The ledger's `capacityDemand` inherits the **static**
  `footprint_cm2` today, so adopting the ledger does **not** by itself fix D5 (guest/piece-count scaling).
  The field is *shaped* to accept the scaled value; this spec does **not** commit E2 to building the scaling.
  Owner: is D5 in E2, or a named future gap?
- **F3 — five methods, not more.** `EQM` is drawn as exactly `ownership`/`availability`/`allocate`/`release`/
  `alternatives`. A reasonable alternative splits `allocate`/`release` out or adds an `impact(deviceId)` query
  for the delete-warning (§7.2) as a sixth public method rather than an internal. Proposed as internal to keep
  the surface narrow (Q5); owner may prefer it public.
- **F4 — sealer/vacuum in E6.** Whether `bagKind`/`bagW` (D2) go live depends on whether E6 authors a
  **sealer** requires row for sealed makes, or stops at grinder+stuffer. Proposed: grinder+stuffer are the
  mandatory day-one set (the owner named "makes/sausages where they're mandatory"); sealer is proposed as an
  E6 stretch, flagged rather than assumed.
- **F5 — inlining order + build assertion.** `equipment.js` inlines **before** `app.js` with a `build.py`
  assertion that `EQM` is defined exactly once (§3). This is an implementation-precision call the owner's Q5
  ("inlined by `build.py`") did not spell out; it follows S1's "build.py has zero assertions" lesson but is
  the author's call on *how*.
- **F6 — `EQM.alternatives` AI call carries `search:false`.** A device-substitution answer is grounded on the
  user's own kit, so web search is off (§7.1). Defensible from the `AI_SEARCH` `'auto'` policy, but it is a
  spec-author reading of "grounded on device registry + requires," not an owner instruction.

**Scope checked against Circle of Control.** Adjacent real defects found while mapping and **explicitly not
folded in**: charter **R6** (bath-selection smallest-vs-largest unification — named in B-i.7's disposition,
left to R6), **D4** enrichment breadth, **D5** guest-scaling (F2), the **P5a** timing divergences (B-i.5/C4),
and the **P8** move-solver (C1/C2-move-axis). Each is named in §8 or §10 with its real home, not silently
absorbed and not silently dropped.

**Waiver Gate self-check.** Nothing above waives, narrows, or defers a charter/ULTIMATE requirement. Every
NOT-HERE row in §8 keeps its charter phase; every PARTIAL names the phase that carries its remainder. The one
item that *could* read as a phase-reordering — bringing the cross-event ledger forward of P9 — is surfaced as
**F1**, in conversation-ready form, exactly as the Gate requires, and rests on the owner's own Q3 decision.

---

**End of DRAFT.** Awaiting owner approval of this file before `writing-plans` begins (§2 pipeline).
