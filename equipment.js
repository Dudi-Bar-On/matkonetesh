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

// ── requires derivation (Q4 source 1: AUTO-DERIVED). Reads the SAME stage data the plan computes, so it
// cannot disagree with the plan (the anti-drift property, spec §4.2). ONE row per cook-device stage
// (kind smoke/sv/cook → device-kind via REQ_KIND); prep/note/dry/rest/bcheck are not device stages and
// are skipped. This function reads ONLY recipe data — itemStages (app.js) and itemStageSpec (app.js) —
// which is the ONE shared recipe-static source both the plan (via itemOccupancy, which now also reads
// itemStageSpec) and this function read directly. NO equipment-registry state is read here: itemStageSpec
// deliberately never touches equipList()/localStorage, so THIS function is a pure projection that feeds
// EQM.ownership AND EQM.availability from ONE list (§4.2), regardless of what the caller currently owns.
//
// Review fix (Critical): a prior version called itemOccupancy(meta, s.kind, null) directly, whose
// standalone (dev=null) path resolves hanging via ownsHangingDevice() — LIVE registry state — so the same
// recipe could derive different rows purely because owned equipment changed. cap.hang below is therefore
// a recipe PREFERENCE (spec.hang, whatever the recipe asks for), never gated on ownership; whether an
// OWNED device actually satisfies that preference is resolved per-device at ownership time (Task 3,
// EQM.ownership), not here. Because hang no longer suppresses the area demand, a single row may now carry
// BOTH cap.hang and demand.area_cm2 — legal per the schema (capability? and demand? are independent
// optionals).
//
// D2 — device properties the requires model READS today (spec §4.1, "honestly"): the demand/capability
// here consumes areaCm2 (via deviceCapacity, at ownership time), cap.baths (via chooseBath), canHang+hooks
// (via deviceCanHang), and maxC (device temp ceiling). The other 14 registered properties stay PARKED and
// are NOT activated by E1: plates/nozzles go live in E6 (choosePlate/chooseNozzle join); bagKind/bagW are
// an E6 sealer stretch (F4); lid/fan/accuracy/pulse/rotisserie/speed/steam/throughput/waterPan/watts have
// no requires consumer in this spec's scope. This comment is E1's D2 deliverable — the honest accounting
// that stops the plan from claiming to have "activated the device properties".
//
// DECLARED rows (grinder/stuffer/sealer/curing, source:'declared', altOf) are authored DATA and land in
// E6 — deriveRequires emits none. The row SCHEMA (below) already carries those fields so E6 adds no shape.
function deriveRequires(meta, methodKey, order){
  if(!meta || !meta.obj || typeof itemStages!=='function') return [];
  const stages = itemStages(meta, methodKey, true, order) || [];
  const rows = [];
  stages.forEach(function(s){
    const kind = REQ_KIND[s.kind]; if(!kind) return;            // only smoke/sv/cook become requires rows
    const spec = (typeof itemStageSpec==='function') ? itemStageSpec(meta, s.kind) : {};
    const row = { role:'cook', kind:kind, source:'derived' };
    const cap = {};
    if(typeof s.temp==='number' && s.temp>0) cap.maxTempC = s.temp;              // device must REACH the cited temp
    if(s.kind==='sv'){
      const litres = Number(spec.min_bath_l)||0;
      if(litres>0){
        cap.bathMinL = litres;                                                   // bath must be this big
        row.demand = { metric:'litres', amount:litres };
      }
    } else {
      if(spec.hang) cap.hang = spec.hang;                                       // recipe PREFERENCE — resolved per-device at ownership time
      const fp = spec.footprint_cm2;
      if(fp!=null && !isNaN(Number(fp)) && Number(fp)>0) row.demand = { metric:'area_cm2', amount:Number(fp) };
    }
    if(Object.keys(cap).length) row.capability = cap;
    rows.push(row);
  });
  return rows;
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
