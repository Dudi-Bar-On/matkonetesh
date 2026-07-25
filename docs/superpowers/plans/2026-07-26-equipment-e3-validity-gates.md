# Equipment E3 — Validity Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The three validity gates of spec §5.2 — catalog bold-invalid (with O-5's why-and-how-to-fix), plan-add blocked, event-add blocked — all reading ONE ownership verdict; O-7's probe capability; retroactive-invalidation warn with real counts. The uncookable item explains itself, everywhere.

**Architecture:** Convergence phase: E1's `EQM.ownership` supplies the verdict; CP1's `itemPaths` supplies the honest-levels enumeration (uncookable = NO cited path's requires are satisfiable; default-blocked = another cited path works); O-5's fix list is deterministic output of ownership × paths. Task 5 (event-add window gate) is the ONLY E2-endgame-dependent task and runs LAST — the phase can gate on T1–T4 with T5 explicitly pending E2's close if needed.

**Tech Stack:** app.js + equipment.js (derivation only) + tests. Real-UI Playwright walks are the acceptance standard per task (the standing owner ruling).

## Global Constraints

- Spec §5.2 verbatim: all three gates call the SAME `EQM.ownership`; the event gate additionally consults `EQM.availability` for the window. Catalog = BOLD-invalid, viewing never blocked; plan-add = BLOCKED with reason (`לא נוסף — חסר <device>`); event-add = BLOCKED (window-aware, T5).
- AMENDMENT O-5 verbatim shape: two honesty levels (uncookable / default-method-blocked with lighter emphasis); WHY names devices from ownership's missing/partial rows, Hebrew-first, one line per gap; HOW-TO-FIX deterministic in order of cheapness — (1) configure the device (deep-link to the equipment manager), (2) switch to another CITED path the owned kit satisfies (from `itemPaths` × ownership), (3) cited replacement when E5 lands (placeholder row, disabled, labeled E5); the fix list is never AI-generated (O-2's consult button is a separate later affordance).
- AMENDMENT O-7: internal-temp-gated stages (probe target / `bcheck`) ⇒ `capability.probe`; satisfied by a device-integral probe property (smokers/ovens) OR an owned standalone probe (the accessories checklist has thermometer-class entries — verify the real key). Derivation lives in `deriveRequires` (equipment.js); the ownership check extends `eqmOwnershipRow`.
- CP2-INPUT (binding, from CP1 review): `itemPaths[].isDefault` is session/gear-dependent — honesty-level logic must enumerate ALL paths, never trust isDefault as the recipe default.
- E3-INPUTS absorbed here: umake generator-panel chip coverage (T1 surface list); unknown-capacity-device-WITH-items display honesty (T4); same-kind-stage assumption documented at first touch (T3 comment). NOT here (stay registered): C4 full per-slot packing; room-semantics formatting (T5 formats `room` when it lands); method-pin simplification; capability-blind serving (E2 endgame, owner decision pending).
- Safety invariance §2.2; F3/F5 (app.js only CALLS EQM.*); H2; store convention; suite baseline 621; real-UI walks + screenshots 390×844 per task; verbatim suite tails; machine-contention rule (translation may hold the GPU — defer full suites to controller when busy); stage-by-name; reports `.superpowers/sdd/e3-task-N-report.md`.

## File Structure

- `equipment.js` — T3: probe derivation in `deriveRequires` + `eqmOwnershipRow` probe check.
- `app.js` — T1: `eqmValidity(meta)` (the honesty-level resolver over itemPaths × ownership) + the bold-invalid card treatment + the why/fix panel + umake surface; T2: the plan-add gate; T4: retroactive warn + occupancy honesty; T5: event-add gate.
- Tests: `tests/e3-validity.spec.ts` (T1), `tests/e3-plan-gate.spec.ts` (T2), `tests/e3-probe.spec.ts` (T3), `tests/e3-retro.spec.ts` (T4), `tests/e3-event-gate.spec.ts` (T5).

---

### Task 1: `eqmValidity` + the catalog bold-invalid + the O-5 why/fix panel

**Files:** Modify `app.js`; Test `tests/e3-validity.spec.ts`.

**Interfaces:**
- Consumes: `itemPaths(meta)` (CP1), `deriveRequires(meta, methodKey, order)`, `eqmRequiresMethodKey(meta)`, `EQM.ownership(requires)`, `equipConfigured()`.
- Produces (T2/T4/T5 rely on EXACTLY): `eqmValidity(meta) → { level:'ok'|'blocked-default'|'uncookable', okPaths:[pathId], gaps:[{kind, state:'missing'|'partial'}], fixes:[{type:'configure'|'switch-path'|'replace-e5', label, pathId?}] }` — computed by running ownership over EVERY `itemPaths` entry's derived requires: `uncookable` = no path satisfiable; `blocked-default` = default path unsatisfiable but some path ok; `ok` otherwise. Gated on `equipConfigured()` (unconfigured → always 'ok' — R5 lineage, no equipment noise).

- [ ] **Step 1: failing tests** — real-UI: (a) seed a kit that satisfies NOTHING for a smoked item (e.g. grill-only kit vs a smoker-requiring make) → its catalog card carries the bold-invalid class + `חסר ציוד` badge; (b) tap/open → the why/fix panel lists the missing kind (`דרוש: מעשנה`) and the fixes (configure deep-link present; no switch-path row when no path works); (c) a kit satisfying the grill-only path of a multi-path cut → `blocked-default` lighter emphasis + the switch-path fix names the WORKING path; (d) unconfigured kit → NO invalid treatment anywhere (negative, R5); (e) umake generator-panel entries carry the same verdict treatment (the E1-gate registered surface); (f) EN leak + L13 on any numerals. RED first per-assertion.
- [ ] **Step 2: implement.** `eqmValidity` in app.js (near eqmRequiresChip; reuses its gating pattern); card class + badge in cutCard/specCard/makeCard + the umake panel renderer; the panel (reuse the app's existing sheet/panel pattern — Serena-locate how eqmRequiresChip's card context opens details) with WHY lines from `gaps` and FIX rows from `fixes` (configure → `openEquipment()` deep-link; switch-path → sets the path per CP1's selection mechanism seed — in E3 it may simply navigate/label since CP2's selector isn't built; label honestly `זמין במסלול: <label>`).
- [ ] **Step 3: build + GREEN + screenshots** (bold-invalid card, the panel, blocked-default lighter state — 390×844, looked at). **Step 4: commit** `feat(equip): E3 Task 1 - eqmValidity + catalog bold-invalid + O-5 why/fix panel`.

---

### Task 2: The plan-add gate

**Files:** Modify `app.js` (the add-to-plan action path — Serena-locate the handler the catalog's add-menu uses); Test `tests/e3-plan-gate.spec.ts`.

**Interfaces:** Consumes `eqmValidity`. Produces: adding an `uncookable` item to the plan is BLOCKED with the spec's toast (`לא נוסף — חסר <device>` + EN pair); `blocked-default` items ADD normally (only viewing emphasis differs — the spec blocks on uncookable, not on a working-alternative); unconfigured users never blocked (R5).

- [ ] Steps: RED real-UI (attempt the add via the real ＋ flow → toast text + the item NOT in the plan store), implement (gate at the single add entry-point — enumerate ALL add paths via find_referencing_symbols and cover each: card add-menu, wizard, generator — list them in the report), GREEN, screenshots, commit `feat(equip): E3 Task 2 - plan-add gate (uncookable blocked with reason)`.

---

### Task 3: O-7 probe capability

**Files:** Modify `equipment.js` (`deriveRequires` + `eqmOwnershipRow`); `app.js` only if the probe property needs schema registration (EQUIP_CATS prop on smoker/oven — verify existing `probeChannels`-class props first; reuse if present); Test `tests/e3-probe.spec.ts`.

**Interfaces:** Consumes: the stage list (which stages are internal-temp-gated — the item's `bcheck`/probe-target markers; find the REAL field: grep bcheck usage in itemStages/data). Produces: internal-temp-gated stage ⇒ its requires row gains `capability.probe:true`; `eqmOwnershipRow` satisfies probe via device-integral probe prop OR any owned standalone thermometer/probe accessory (find the real accessory key in EQUIP_OTHER_ITEMS); document the same-kind-stage impossibility assumption at the derivation site (the registered E3-input).

- [ ] Steps: RED (a probe-requiring item + probe-less kit → ownership partial with the probe gap named; + the positive: standalone probe accessory satisfies), implement, GREEN (targeted + the e1/e2 seam files — the row schema grew a capability key: verify no existing consumer breaks), screenshots of the chip/panel showing the probe gap, commit `feat(equip): E3 Task 3 - O-7 probe capability (derive + ownership + accessory satisfier)`.

---

### Task 4: Retroactive-invalidation warn + occupancy display honesty

**Files:** Modify `app.js` (device delete/edit path in openEquipment; the occupancy view's unknown-cap-WITH-items state); Test `tests/e3-retro.spec.ts`.

**Interfaces:** Consumes `eqmValidity`, `EQM.release`, `eqmLedger`. Produces: deleting/downgrading a device recomputes validity for plan+event items and shows the spec's warning with REAL counts (`N מתוך M פריטים יושפעו`) BEFORE confirming; on confirm, affected holds released (targeted holder sweep per spec §7); the occupancy view's unknown-capacity-device-WITH-items state shows the honest qualifier instead of the unconditional ✓ (the E2-review registered residual).

- [ ] Steps: RED real-UI (delete the only smoker while a smoked item sits in a plan → warning names 1/M; confirm → holds released, catalog flips bold-invalid live), implement, GREEN, screenshots (the warning dialog with real numbers), commit `feat(equip): E3 Task 4 - retroactive invalidation warn (real N/M) + occupancy honesty`.

---

### Task 5 (LAST — E2-endgame-dependent): The event-add gate

**Files:** Modify `app.js` (event add path); Test `tests/e3-event-gate.spec.ts`.

**PRECONDITION:** E2's close (the owner's capability-blind-serving decision + gate-prep). If E2 is not closed when T1–T4 finish, the phase gate runs on T1–T4 with T5 documented PENDING — do not improvise around the dependency.

**Interfaces:** Consumes `eqmValidity` + `EQM.availability(requires, window)` (E2). Produces: adding an item to an event is blocked when uncookable (ownership) OR when the event's window answers `busy` (availability) — with the reason distinguishing "you don't own it" from "it's occupied then" (`עסוק בחלון הזה` class copy, proposed); `room` formatted here per the registered semantics input.

- [ ] Steps: RED real-UI, implement, GREEN, screenshots, commit `feat(equip): E3 Task 5 - event-add gate (ownership + window availability)`.

---

## Self-review (authoring, 2026-07-26)

1. **Spec coverage:** §5.2 three gates → T1/T2/T5; O-5 full shape → T1; O-7 → T3; §7 retroactive → T4; the phase-gate DoD row (spec §8 E3: "all three gates render the same verdict at 390×844; Hebrew screenshotted; delete-warning shows real N/M") → T1+T2+T5 screenshots + T4's dialog. E3-INPUTS routed in Global Constraints (absorbed vs stay-registered lists explicit).
2. **Placeholders:** integration tasks Serena-anchored per the established precedent; T1 carries the full eqmValidity contract. No TBDs.
3. **Type consistency:** `eqmValidity` shape consistent T1→T2/T4/T5; probe rides `capability` (E1's optional-capability pattern); pathId ties to CP1's itemPaths ids.
