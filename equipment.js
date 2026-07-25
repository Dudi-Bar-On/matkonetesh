/*═══════════════════════════════════════════════════════════════════════════════════════════════════
  equipment.js · EQM — the Equipment Manager module (strangler-fig, spec §3, owner Q5)

  Inlined by build.py BEFORE app.js into the single shipped <script> (ruling F5). Shares app.js's one
  runtime scope — NO ES modules. app.js reaches this module ONLY through the global `EQM` (five methods)
  and the pure projection `deriveRequires` (the spec's compute-once design: ownership and availability
  answer from the SAME requires list, so the caller composes EQM.ownership(deriveRequires(meta))).

  ORDERING (H2): equipment.js runs before app.js, so it contains NO top-level statement that CALLS an
  app.js function — only declarations and the EQM literal of function references. app.js's top-level
  `function` declarations hoist across the combined script, so EQM's method BODIES may reference them
  freely at call time (after app.js has evaluated); app.js's top-level `const`s are off-limits at eval
  time (they don't hoist) but fine at call time.
═══════════════════════════════════════════════════════════════════════════════════════════════════*/

// stage.kind → device-kind (cookerCatForKind primary, spec §4.2). smoke→smoker, sv→bath, cook→grill.
const REQ_KIND = { smoke: 'smoker', sv: 'bath', cook: 'grill' };
// device-kind → stage-kind, so EQM.ownership can REUSE cookerCandidates (the one substitution policy:
// smoke→smoker|grill, cook→grill|oven, sv→bath) instead of copying it. E6 extends this with the
// declared process kinds (grinder/stuffer/sealer/curing) and their own category resolution.
const KIND_TO_STAGE = { smoker: 'smoke', grill: 'cook', bath: 'sv' };

// ── deriveRequires — Task 2 fills this body. Seam declared here so build.py's inline + the module-seam
// test see a real global function from Task 1 onward.
function deriveRequires(meta, methodKey, order){
  return [];   // TASK-2 replaces this entire body with the real derivation.
}

// ── eqmOwnershipRow — Task 3 fills this body (per-row ok/missing/partial via cookerCandidates + caps).
function eqmOwnershipRow(row){
  throw new Error('eqmOwnershipRow: implemented in E1 Task 3');
}

// ── the ONE narrow global (ruling F3/F5: exactly five methods). E1 makes only `ownership` functional.
const EQM = {
  // physical, catalog-level, window-independent (spec §5.1). Task 3 replaces this stub.
  ownership: function(requires){
    throw new Error('EQM.ownership: implemented in E1 Task 3');
  },
  // ledger + capacity fit (spec §5.1) — Phase E2.
  availability: function(requires, window){
    throw new Error('EQM.availability: not implemented until E2 (ledger + capacity fit)');
  },
  // holder-tracked reservation (spec §5.1) — Phase E2.
  allocate: function(requires, window, holder){
    throw new Error('EQM.allocate: not implemented until E2 (reservation ledger)');
  },
  // frees ALL of a holder's holds (spec §5.1) — Phase E2.
  release: function(holder){
    throw new Error('EQM.release: not implemented until E2 (reservation ledger)');
  },
  // replacement ladder (spec §7.1) — Phase E5.
  alternatives: function(missingReq){
    throw new Error('EQM.alternatives: not implemented until E5 (replacement ladder)');
  },
};
