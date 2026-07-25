/*═══════════════════════════════════════════════════════════════════════════════════════════════════
  equipment.js · EQM — the Equipment Manager module (strangler-fig, spec §3, owner Q5)

  Inlined by build.py BEFORE app.js into the single shipped <script> (ruling F5). Shares app.js's one
  runtime scope — NO ES modules. app.js reaches this module ONLY through the global `EQM` (five methods)
  and the pure projection `deriveRequires` (the spec's compute-once design: ownership and availability
  answer from the SAME requires list, so the caller composes EQM.ownership(deriveRequires(meta))).

  ORDERING (H2): equipment.js runs before app.js, so it contains NO top-level statement that CALLS an
  app.js function — only declarations and the EQM literal of inline function expressions. app.js's top-level
  `function` declarations hoist across the combined script, so EQM's method BODIES may reference them
  freely at call time (after app.js has evaluated); app.js's top-level `const`s are off-limits at eval
  time (they don't hoist) but fine at call time.
═══════════════════════════════════════════════════════════════════════════════════════════════════*/

// stage.kind → device-kind (cookerCatForKind primary, spec §4.2). smoke→smoker, sv→bath, cook→grill.
const REQ_KIND = { smoke: 'smoker', sv: 'bath', cook: 'grill' };
// device-kind → stage-kind, so EQM.ownership can REUSE cookerCandidates (the one substitution policy:
// smoke→smoker|grill, cook→grill|oven, sv→bath) instead of copying it. E6 extends this with the
// declared process kinds (grinder/stuffer/sealer/curing) and their own category resolution.
// E2 Task 1 closes the review-M2 gap: 'oven' — the schema's 4th cook device-kind (see EQM_KIND_HE in
// app.js) — now maps to 'cook', the same stage 'grill' answers (cookerCandidates('cook') already returns
// grill|oven, spec §4.2 substitution policy), so an oven-owner no longer answers 'missing' for a cook row
// an oven satisfies. Only the DECLARED process kinds (grinder/stuffer/sealer/curing) remain unmapped —
// they have no requires-row producer until E6 gives them their own category resolution.
const KIND_TO_STAGE = { smoker: 'smoke', grill: 'cook', bath: 'sv', oven: 'cook' };

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

// eqmOwnershipRow — Task 3 (spec §5.1). One derived cook row → 'ok' | 'partial' | 'missing'.
// cookerCandidates(stageKind) already returns the OWNED devices that can serve this stage (the ONE
// substitution policy), so ownership is "do I own a candidate, and does at least one meet the capability".
// Only the DECLARED process kinds — grinder/stuffer/sealer/curing — have no KIND_TO_STAGE entry; E6
// extends this with their category resolution. The guard below returns 'missing' for an unmapped kind
// rather than crashing (deriveRequires emits none of these process kinds today, so this is dormant until
// E6 adds their producers).
function eqmOwnershipRow(row){
  const stageKind = KIND_TO_STAGE[row && row.kind];
  const owned = (stageKind && typeof cookerCandidates==='function') ? cookerCandidates(stageKind) : [];
  if(!owned.length) return 'missing';                       // no device of the kind at all
  const cap = (row && row.capability) || {};
  const demand = (row && row.demand) || null;
  const meets = owned.some(function(dev){
    // cap.hang is a recipe PREFERENCE (spec.hang), never AND-gated with the row's area demand: the schema
    // allows a single row to carry BOTH cap.hang and demand.area_cm2 (see the deriveRequires comment above)
    // even though current real data never combines them (cut_equip sets footprint only, make_equip sets
    // hang only, special_equip neither). A device satisfies a hang-preference row via EITHER hanging
    // capacity (deviceCanHang) OR area fit (deviceCapacity), never requiring both — when no area demand
    // rides along the row, hang is the only satisfier, which is today's real shape.
    if(cap.hang){
      const hangs = deviceCanHang(dev);
      const areaFits = (demand && demand.metric==='area_cm2') ? (deviceCapacity(dev).usableCm2 >= demand.amount) : false;
      if(!hangs && !areaFits) return false;
    }
    if(cap.bathMinL){ const b=chooseBath(dev, cap.bathMinL); if(!b || !b.ok) return false; }
    // cap.maxTempC = the cited stage temp; a FLOOR the device's own maxC must reach — never an upper
    // bound on cooking temp (review finding M4 — the name reads like a ceiling but it is a minimum).
    if(cap.maxTempC){ const mx=Number(propOf(dev,'maxC')); if(mx>0 && mx<cap.maxTempC) return false; }
    return true;
  });
  return meets ? 'ok' : 'partial';                          // owns the kind but no unit clears the capability
}

// ── the ONE fit arithmetic (O-6). deviceOccupancy (app.js) delegates here in E2 Task 4, and
// availability applies the same function to ledger entries — one arithmetic, two callers, zero drift.
// Area: SUM of known demands vs usableCm2 (PACK_EFF already inside). Litres: MAX of demands vs bath
// litres — min_bath_l is a per-item CONSTRAINT, not additive displacement (deviceOccupancy's rule,
// app.js:497 — items SHARE a bath, so litres never summed across occupants). Unknown capacity NEVER
// fits: a device whose size we don't know must not absorb bookings silently (D11's spirit).
function eqmFitVerdict(cap, demands){
  if(!cap || !cap.known) return { fits:false, usedPct:null, room:null };
  const amts = (demands||[]).map(function(d){ return (d && Number(d.amount)) || 0; });
  if(cap.mode==='volume'){
    const maxReq = amts.length ? Math.max.apply(null, amts) : 0;
    return { fits: maxReq <= cap.litres, usedPct: cap.litres>0 ? Math.round(maxReq/cap.litres*100) : null,
             room: Math.max(0, cap.litres - maxReq) };
  }
  const sum = amts.reduce(function(a,b){ return a+b; }, 0);
  return { fits: sum <= cap.usableCm2, usedPct: cap.usableCm2>0 ? Math.round(sum/cap.usableCm2*100) : null,
           room: Math.max(0, cap.usableCm2 - sum) };
}

// ── the reservation ledger (spec §4.3, Q3) — the ONE net-new store. Entries are never deleted in E2,
// only flipped to 'released' (release-vs-delete keeps the audit trail; a sweep is a later concern).
// D5 note (owner 2026-07-25): capacityDemand carries the STATIC footprint/min_bath_l — guest-scaling
// is a named future gap; the field's shape already accepts a scaled amount when that lands.
// Store convention (corrected 2026-07-25 after Task 1 review): `store.get`/`store.set` (app.js
// ~1442-1444) already JSON.parse/stringify internally — every call site passes/reads RAW values
// (equipList, savePantry, ...). Do NOT wrap with JSON.stringify/parse here; that double-encodes and
// silently swallows the ledger the moment any future code writes this key the normal way.
const EQM_LEDGER_KEY = 'mk-eqm-ledger';
function eqmLedger(){
  const v = store.get(EQM_LEDGER_KEY);          // store.get already catches internally, never throws — fail closed to [] on anything but a real array
  return Array.isArray(v) ? v : [];
}
function eqmLedgerWrite(list){ store.set(EQM_LEDGER_KEY, list || []); }
function eqmLedgerAdd(entry){
  const list = eqmLedger();
  const id = 'h' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  list.push(Object.assign({ id: id }, entry));
  eqmLedgerWrite(list);
  return id;
}
// Held entries on ONE device overlapping a window. Half-open [startMs, endMs): touching edges are a
// clean handoff, not a conflict — the same convention the scheduler's stage windows already use.
function eqmLedgerHeld(deviceId, window){
  return eqmLedger().filter(function(e){
    return e && e.state==='held' && e.deviceId===deviceId && e.window &&
           e.window.startMs < window.endMs && e.window.endMs > window.startMs;
  });
}

// ── the ONE narrow global (ruling F3/F5: exactly five methods). E1 made `ownership` functional; E2
// Task 2 makes `availability` functional. `allocate`/`release` (E2 Task 3) and `alternatives` (E5) still throw.
const EQM = {
  // physical, catalog-level, window-independent (spec §5.1). The SINGLE verdict all three E3 gates read
  // (§5.2) — B-i.1's "three capacity rules for one device" closed to one, structurally. Answers from the
  // SAME requires list EQM.availability (E2) will use (§4.2). E1's only production reader is the catalog
  // requires chip (Task 4); E3 adds the plan-add and event-add gates.
  ownership: function(requires){
    const missing=[], partial=[];
    (requires||[]).forEach(function(row){
      const v = eqmOwnershipRow(row);
      if(v==='missing') missing.push(row);
      else if(v==='partial') partial.push(row);
    });
    return { ok: missing.length===0 && partial.length===0, missing:missing, partial:partial };
  },
  // ledger + capacity fit over a window (spec §5.1). Per requires row: find the owned candidate
  // devices (same cookerCandidates policy ownership uses), and the row is served by the FIRST device
  // where held-demands + this demand still fit. free = every row fits with margin on some device;
  // partial = every row fits but at least one lands ≥90% used; busy = some row fits nowhere.
  // D11: no candidate device, empty registry, unknown capacity → that row is busy, deviceId:null —
  // the "✓ everything fits" fall-through (app.js's occupancy fit line) is impossible by construction here.
  availability: function(requires, window){
    const perRow = []; let worst = 'free'; let minRoom = null;
    (requires||[]).forEach(function(row){
      const stageKind = KIND_TO_STAGE[row && row.kind];
      const owned = (stageKind && typeof cookerCandidates==='function') ? cookerCandidates(stageKind) : [];
      let served = null, rowRoom = null, tight = false;
      owned.some(function(dev){
        const cap = deviceCapacity(dev);
        const held = eqmLedgerHeld(dev.id, window).map(function(e){ return e.capacityDemand; });
        const all = held.concat(row.demand ? [row.demand] : []);
        const v = eqmFitVerdict(cap, all);
        if(!v.fits) return false;
        served = dev; rowRoom = v.room; tight = v.usedPct!=null && v.usedPct >= 90;
        return true;
      });
      perRow.push({ kind: row ? row.kind : null, state: served ? (tight ? 'partial' : 'free') : 'busy',
                    deviceId: served ? served.id : null });
      if(!served) worst = 'busy';
      else if(tight && worst!=='busy') worst = 'partial';
      if(rowRoom!=null) minRoom = (minRoom==null) ? rowRoom : Math.min(minRoom, rowRoom);
    });
    return { state: worst, room: minRoom, perRow: perRow };
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
