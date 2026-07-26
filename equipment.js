/*═══════════════════════════════════════════════════════════════════════════════════════════════════
  equipment.js · EQM — the Equipment Manager module (strangler-fig, spec §3, owner Q5)

  Inlined by build.py BEFORE app.js into the single shipped <script> (ruling F5). Shares app.js's one
  runtime scope — NO ES modules. app.js reaches this module ONLY through the global `EQM` (five methods)
  and the pure projection `deriveRequires` (the spec's compute-once design: ownership and availability
  answer from the SAME requires list, so the caller composes EQM.ownership(deriveRequires(meta))).
  E2 widened this surface with THREE more legitimate entry points: `eqmFitVerdict` (app.js's
  deviceOccupancy calls it directly for pct/over — the SAME fit arithmetic EQM.availability uses, so the
  occupancy view and the booking gate can never drift apart) and `KIND_TO_STAGE` (app.js's
  evSyncEquipmentHolds maps a requires row's device-kind back to its stage.kind to find that stage's
  computed window before calling EQM.allocate) are called BY app.js; the newly-extracted
  `eqmDeviceMeetsRow` is the shared capability predicate CALLED FROM WITHIN this module by both
  `eqmOwnershipRow` and `EQM.availability` (never called directly by app.js) so those two verdicts can
  never diverge from each other.

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
        // owner ruling 2026-07-25: capacityDemand.tempC (spec §4.3 amendment, added post Task-2 review).
        // The cited bath temperature rides the demand so eqmFitVerdict's volume branch (below) can
        // enforce ONE-circulator/ONE-temperature exclusivity — the cross-event twin of the single-event
        // bath-temp detector (app.js:3210). A demand with no tempC (legacy/area rows, or a caller who
        // never cited one) stays temp-agnostic and never blocks sharing (see eqmFitVerdict).
        if(typeof s.temp==='number' && s.temp>0) row.demand.tempC = s.temp;
      }
    } else {
      if(spec.hang) cap.hang = spec.hang;                                       // recipe PREFERENCE — resolved per-device at ownership time
      const fp = spec.footprint_cm2;
      if(fp!=null && !isNaN(Number(fp)) && Number(fp)>0) row.demand = { metric:'area_cm2', amount:Number(fp) };
    }
    if(Object.keys(cap).length) row.capability = cap;
    rows.push(row);
  });
  // ── AMENDMENT O-7 (owner ruling 2026-07-25, spec Amendments block): a stage GATED BY INTERNAL
  // TEMPERATURE (probe target, kind:'bcheck') is executable only with a temperature probe. itemStages()
  // (app.js, D1) already computes the ONE real structural marker for "internal-temp-gated": it appends a
  // kind:'bcheck' stage whenever the item carries a numeric meta.obj.safe/tgt — read straight from the
  // `stages` array this function was just built from (one source of truth; no second safe/tgt read here,
  // and no text/prose heuristic — a real, cited, structural field or nothing).
  //
  // WHICH ROW carries capability.probe: the physical check happens ONCE — on whichever device the item is
  // in when it leaves its LAST cook-device stage, immediately before rest/bcheck — so the capability rides
  // ONLY the last row this function collected, never every row. SAME-KIND-STAGE ASSUMPTION (documented
  // here, the registered E3-input from the plan's Global Constraints): itemStages structurally emits AT
  // MOST ONE stage of each REQ_KIND (smoke/sv/cook) per combo/order today, so "the last row pushed" is
  // unambiguous both temporally (rows preserve stages' original order — see the forEach above) and by
  // kind (no combo today produces two rows of the SAME kind competing for "last"). If a future combo ever
  // emitted two device stages of one kind, this position-based rule would still pick the temporally-last
  // row correctly (array order is preserved regardless of kind repeats) — but the kind-uniqueness half of
  // this note would need re-checking against that new shape before trusting it blindly.
  if(rows.length && stages.some(function(st){ return st && st.kind==='bcheck'; })){
    const lastRow = rows[rows.length-1];
    if(!lastRow.capability) lastRow.capability = {};
    lastRow.capability.probe = true;
  }
  return rows;
}

// eqmOwnershipRow — Task 3 (spec §5.1). One derived cook row → 'ok' | 'partial' | 'missing'.
// cookerCandidates(stageKind) already returns the OWNED devices that can serve this stage (the ONE
// substitution policy), so ownership is "do I own a candidate, and does at least one meet the capability".
// Only the DECLARED process kinds — grinder/stuffer/sealer/curing — have no KIND_TO_STAGE entry; E6
// extends this with their category resolution. The guard below returns 'missing' for an unmapped kind
// rather than crashing (deriveRequires emits none of these process kinds today, so this is dormant until
// E6 adds their producers).
// E3 Task 4 (spec §7.2, plan Task 4) · optional `list` override — threaded straight through to
// cookerCandidates/eqmProbeSatisfiedBy so a caller can ask "what would ownership say with THIS device
// list instead of the live equipList()?" without ever mutating real state. Omitted by every existing
// caller (app.js's eqmValidity/eqmRequiresChip, this file's own EQM.ownership below) — falls through to
// the live kit exactly as before.
// eqmDeviceMeetsRow(dev, row, list) — the ONE per-device CAPABILITY predicate (spec §5.1). Extracted
// verbatim from eqmOwnershipRow's per-candidate check below (BUGFIX, owner Decision 3, 2026-07-26: this
// is the same code, unchanged) so eqmOwnershipRow AND EQM.availability share ONE definition and can never
// diverge again. Deliberately CAPACITY-BLIND by design — it answers only "can this device ever serve this
// row's requires" (hang/bathMinL/maxTempC/probe), never "is there room right now" (that stays
// eqmFitVerdict's ledger-aware job, called separately by each caller that needs it).
//
// THE BUG this closes (spec §5.1 "satisfying requires"): EQM.availability used to pick the FIRST
// kind-matching owned device and apply ONLY eqmFitVerdict's capacity arithmetic — never this capability
// gate — so a right-kind device that could never satisfy the row (too cold to reach a cited stage temp; no
// standalone probe for a bcheck-gated row) was still reported 'free'/serving. allocate() inherited the
// bug because it reserves on availability.perRow[i].deviceId. Fixed by calling this predicate from BOTH
// eqmOwnershipRow and EQM.availability's owned.some() (before the capacity check), so a device must clear
// BOTH capability and capacity to ever serve a row.
function eqmDeviceMeetsRow(dev, row, list){
  const cap = (row && row.capability) || {};
  const demand = (row && row.demand) || null;
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
  // AMENDMENT O-7a (owner ruling 2026-07-26, superseding O-7's device-integral branch): probe
  // availability is STANDALONE-ONLY — any owned EQUIP_CATS cat:'probe' device (e.g. a MEATER/Inkbird),
  // never THIS candidate's own device-integral state. Rationale (owner, in conversation): a
  // device-integral "probe" on a smoker/oven is typically an AMBIENT/chamber thermometer, not a
  // meat-internal one, so it never actually satisfied the internal-temp (bcheck) gate this capability
  // guards — and this realigns with the app's own display semantics (`hasCat('probe')`, app.js:958). A
  // standalone probe is portable, so it satisfies regardless of which candidate device ends up serving
  // the row — `dev` is accepted only for call-signature compatibility below, never consulted.
  if(cap.probe && !eqmProbeSatisfiedBy(dev, list)) return false;
  return true;
}
function eqmOwnershipRow(row, list){
  const stageKind = KIND_TO_STAGE[row && row.kind];
  const owned = (stageKind && typeof cookerCandidates==='function') ? cookerCandidates(stageKind, list) : [];
  if(!owned.length) return 'missing';                       // no device of the kind at all
  const meets = owned.some(function(dev){ return eqmDeviceMeetsRow(dev, row, list); });
  return meets ? 'ok' : 'partial';                          // owns the kind but no unit clears the capability
}

// AMENDMENT O-7a satisfier (owner ruling 2026-07-26, superseding O-7's device-integral branch, spec
// Amendments block) — the ONE definition of "is a probe available", shared by eqmOwnershipRow's
// per-device gate above and eqmProbeAvailable's kit-wide gap check below. STANDALONE-ONLY: ANY owned
// device of EQUIP_CATS' own first-class 'probe' category (cat:'probe' — a MEATER/Inkbird/instant-read/
// etc, the app's REAL "do you own a thermometer" registry entry; EQUIP_OTHER_ITEMS carries no
// probe/thermometer entry at all, so this dedicated device category is the real satisfier). A standalone
// probe is a portable tool, so it satisfies ANY row regardless of which device physically serves the
// stage — never gated on `dev` at all.
// Culinary rationale for dropping the device-integral branch (owner, in conversation, 2026-07-26): "my
// original intention when I said probe I meant a standalone probe preferred wireless like my MEATER and
// Inkbird … focus on this kind of probes and not a device integrated one." A smoker/oven's built-in
// "probe" is typically an AMBIENT (chamber) thermometer, not a meat-internal one, so it never truly
// cleared the internal-temp (bcheck) gate `capability.probe` guards. This also realigns with the app's
// own display semantics — `hasCat('probe')` (app.js:958, homeGear's `hasProbe` field) was already
// standalone-based and is UNRELATED to the EQUIP_CATS `hasProbe` boolean prop this amendment removes from
// smoker/oven (app.js EQUIP_CATS) — same field name, two different things; only the latter is deleted.
// `dev` remains in the signature only for call-site compatibility with eqmOwnershipRow's per-candidate
// call above — it is never consulted.
// E3 Task 4 (unchanged by O-7a): same optional `list` override as eqmOwnershipRow above — the
// standalone-probe check must also read the WHAT-IF kit, never the live equipList(), or a what-if that
// removes the kit's only probe device would still report it available.
function eqmProbeSatisfiedBy(dev, list){
  return typeof equipByCat==='function' && equipByCat('probe', list).length>0;
}
// eqmProbeAvailable(row) — the SAME O-7a satisfier, now COLLAPSED (standalone-only means probe
// availability is kit-wide and row/`dev`-independent by construction): every candidate device would
// resolve to the identical eqmProbeSatisfiedBy(null) answer regardless of which one `dev` is, so the old
// per-candidate `cookerCandidates(...).some(...)` scan is DEAD code under O-7a — removed. `row` stays in
// the signature for call-site compatibility (every caller passes a row/`null` question) but is no longer read.
function eqmProbeAvailable(row){
  return eqmProbeSatisfiedBy(null);
}

// ── the ONE fit arithmetic (O-6). deviceOccupancy (app.js) delegates here in E2 Task 4, and
// availability applies the same function to ledger entries — one arithmetic, two callers, zero drift.
// Area: SUM of known demands vs usableCm2 (PACK_EFF already inside), PLUS a per-slot FLOOR (owner
// ruling 2026-07-25, spec C4 re-wording, post Task-2 review): no SINGLE demand may exceed one slot's
// ESTIMATED capacity — the whole-device sum alone can hide an oversized single demand inside a
// comfortable total (e.g. one huge brisket reads as "60% used" even though it can never physically sit
// on one rack). This is the CHEAP floor the owner asked for now ("cheap floor now, full per-slot at
// E3"); full per-slot bin-packing (which rack, which combination of demands actually sits where) is
// E3's job, not this function's — see spec C4: "E2's EQM.availability uses the whole-device sum plus a
// per-slot FLOOR … full per-slot packing over ledger entries lands at E3". Litres: MAX of demands vs
// bath litres — min_bath_l is a per-item CONSTRAINT, not additive displacement (deviceOccupancy's rule,
// app.js:497 — items SHARE a bath, so litres never summed across occupants), PLUS temp exclusivity
// (owner ruling 2026-07-25, spec §4.3 capacityDemand.tempC amendment): one circulator runs ONE bath at
// ONE temperature, so demands that CITE a tempC must all AGREE to share; a demand carrying no tempC
// (legacy/area-shaped, or simply uncited) is temp-agnostic and never blocks. Unknown capacity NEVER
// fits: a device whose size we don't know must not absorb bookings silently (D11's spirit).
//
// FIX WAVE 2 (2026-07-25, re-review "Important d"): the per-slot floor now branches on cap.areaMeasured,
// mirroring deviceOccupancy's OWN measured/estimated precedent for exactly this floor (app.js ~505-520,
// out.fit's hard/soft split): `const hard = it.cm2 > cap.perSlotCm2 * (cap.areaMeasured ? FIT_SLOT_TOL :
// FIT_HARD_FACTOR);`. A MEASURED slot earns only the small FIT_SLOT_TOL (1.10) physical-overhang margin;
// an ESTIMATED (class-default) slot earns the much looser FIT_HARD_FACTOR (1.6) — app.js's own comment
// at the constant's definition (~line 295) says a class-default estimate "can plausibly run ~30-50%
// larger", so a modest overflow on a GUESS must not hard-block at the same 10% margin a real measurement
// earns. Wave 1 used FIT_SLOT_TOL unconditionally, which was stricter than the app's own design for
// estimated areas — closed here.
//
// Return shape also SPLITS into `sumFits`/`floorFits` so callers can read only what they need without
// the two owner-added E2 gates changing meaning for existing readers:
//   - `sumFits` = the whole-device sum check ALONE — this is exactly what deviceOccupancy's `out.over`
//     has always meant (area: `usedCm2>usableCm2`, app.js:504; volume: `maxReq>cap.litres`, app.js:500).
//     Task 4's `deviceOccupancy` delegation reads ONLY this field (`over → !sumFits`), so that
//     delegation stays byte-identical to the pre-E2 arithmetic — no behavior change for the occupancy
//     view from this split.
//   - `floorFits` = the per-slot floor ALONE (area) / the bath-temp-exclusivity gate ALONE (volume) —
//     both are NEW gates this module adds on top of deviceOccupancy's historical arithmetic and have no
//     deviceOccupancy precedent to stay byte-identical to; they are availability-only, owner-ruled
//     behavior (fix wave 1 + wave 2).
//   - `fits` = `sumFits && floorFits` — the combined verdict `EQM.availability` consumes (unchanged
//     external behavior for availability: still one boolean, same combination the pre-split code computed
//     inline).
function eqmFitVerdict(cap, demands){
  if(!cap || !cap.known) return { fits:false, sumFits:false, floorFits:false, usedPct:null, room:null };
  const amts = (demands||[]).map(function(d){ return (d && Number(d.amount)) || 0; });
  if(cap.mode==='volume'){
    // Bath-temp exclusivity: only demands that CITE a tempC must agree with one another; an untempC'd
    // demand never blocks (temp-agnostic). Cited bath temperatures are exact integers/halves — never a
    // fuzzy accumulated float — so strict !== is the correct equality test here; no epsilon is needed
    // or wanted (an epsilon would risk quietly merging two genuinely different cited temperatures).
    const tempedTemps = (demands||[]).filter(function(d){ return d && typeof d.tempC==='number'; })
                                      .map(function(d){ return d.tempC; });
    const tempsDisagree = tempedTemps.length>1 && tempedTemps.some(function(tc){ return tc!==tempedTemps[0]; });
    const maxReq = amts.length ? Math.max.apply(null, amts) : 0;
    const sumFits = maxReq <= cap.litres;      // deviceOccupancy's out.over precedent (app.js:500), negated
    const floorFits = !tempsDisagree;          // NEW gate (fix wave 1 FIX 2) — no deviceOccupancy precedent
    return { fits: sumFits && floorFits, sumFits: sumFits, floorFits: floorFits,
             usedPct: cap.litres>0 ? Math.round(maxReq/cap.litres*100) : null,
             room: Math.max(0, cap.litres - maxReq) };
  }
  const sum = amts.reduce(function(a,b){ return a+b; }, 0);
  // per-slot FLOOR: perSlotEst estimates ONE slot's share of the device's usable area. The tolerance
  // (`tol`) branches on cap.areaMeasured — see the FIX WAVE 2 block above the function for the full
  // reasoning; the two constants (app.js ~line 298/303, TOP-LEVEL consts) are referenced here BY NAME at
  // CALL time, not at eval time. equipment.js inlines BEFORE app.js into the combined <script> (ruling
  // F5/H2), so at the moment equipment.js's own top-level statements run, app.js's top-level consts do
  // not exist yet (consts do not hoist across the inline boundary). But this reference lives inside a
  // FUNCTION BODY: eqmFitVerdict only EXECUTES when something calls it, and nothing calls it — no user
  // interaction, no test — until the whole inlined <script> (both files) has finished evaluating. So the
  // reference is safe by construction. Verified live this session via the tests below (a real
  // page.evaluate call into EQM.availability, which reaches this line): if either constant were
  // unresolved at call time the per-slot-floor tests in tests/e2-availability.spec.ts would fail with a
  // ReferenceError instead of the expected verdict — they instead pass GREEN, which is the probe.
  const perSlotEst = cap.usableCm2 / Math.max(1, cap.racks);
  const tol = cap.areaMeasured ? FIT_SLOT_TOL : FIT_HARD_FACTOR;
  const oversizedSingle = amts.some(function(a){ return a > perSlotEst * tol; });
  const sumFits = sum <= cap.usableCm2;      // deviceOccupancy's out.over precedent (app.js:504), negated — Task 4 delegates over→!sumFits, byte-identical
  const floorFits = !oversizedSingle;        // NEW gate (fix wave 1 C4 + wave 2 measured/estimated split) — no deviceOccupancy precedent
  return { fits: sumFits && floorFits, sumFits: sumFits, floorFits: floorFits,
           usedPct: cap.usableCm2>0 ? Math.round(sum/cap.usableCm2*100) : null,
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
// Task 2 made `availability` functional; E2 Task 3 makes `allocate`/`release` functional. Only
// `alternatives` (E5) still throws.
const EQM = {
  // physical, catalog-level, window-independent (spec §5.1). The SINGLE verdict all three E3 gates read
  // (§5.2) — B-i.1's "three capacity rules for one device" closed to one, structurally. Answers from the
  // SAME requires list EQM.availability (E2) will use (§4.2). E1's only production reader is the catalog
  // requires chip (Task 4); E3 adds the plan-add and event-add gates.
  // E3 Task 4: optional `list` override (2nd arg) — threaded straight to eqmOwnershipRow, itself threaded
  // to cookerCandidates/eqmProbeSatisfiedBy. Omitted by every pre-existing caller, so this stays
  // byte-identical to the live-kit read those callers already rely on; app.js's retroactive-invalidation
  // what-if (eqmValidityWithKit) is the one caller that ever passes it.
  ownership: function(requires, list){
    const missing=[], partial=[];
    (requires||[]).forEach(function(row){
      const v = eqmOwnershipRow(row, list);
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
        // BUGFIX (spec §5.1, owner Decision 3, 2026-07-26): a candidate must satisfy the row's FULL
        // requires — kind (already true, `owned` is kind-filtered) AND every capability check
        // (maxTempC/probe/hang/bathMinL) — before capacity/ledger fit is even considered. Shared with
        // eqmOwnershipRow via eqmDeviceMeetsRow so the two verdicts can never diverge.
        if(!eqmDeviceMeetsRow(dev, row)) return false;
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
  // holder-tracked reservation (spec §5.1) — E2 Task 3. ALL-OR-NOTHING: re-checks EQM.availability
  // (Task 2) over the whole requires set first — if the combined verdict is 'busy', nothing is written
  // at all (a half-booked event is a lie in both directions, in either direction: it would either claim
  // equipment it never reserved, or silently leave a caller thinking a booking succeeded when only part
  // of it did). Otherwise writes one 'held' ledger entry per row that carries a `demand`, on the SAME
  // deviceId availability() chose for that row's index (perRow[i].deviceId) — never re-resolved
  // independently, so allocate can never disagree with the availability check that gated it.
  // capacityDemand copies metric+amount+tempC from row.demand (owner ruling 2026-07-25, capacityDemand.tempC
  // amendment, spec §4.3): a sv row's cited tempC rides into the REAL held ledger entry, or
  // eqmFitVerdict's bath-temp exclusivity check (volume branch) has nothing real to compare against once
  // actual events start allocating baths — verified round-trip by tests/e2-allocate-release.spec.ts.
  allocate: function(requires, window, holder){
    const avail = EQM.availability(requires, window);
    if(avail.state==='busy') return { ok:false, holdIds:[] };
    const ids = [];
    (requires||[]).forEach(function(row, i){
      if(!row || !row.demand) return;                       // capability-only rows reserve nothing
      const devId = avail.perRow[i] && avail.perRow[i].deviceId; if(!devId) return;
      ids.push(eqmLedgerAdd({ deviceId: devId, window: { startMs: window.startMs, endMs: window.endMs },
        capacityDemand: Object.assign({ metric: row.demand.metric, amount: row.demand.amount },
          (typeof row.demand.tempC==='number') ? { tempC: row.demand.tempC } : {}),   // owner ruling 2026-07-25: bath-temp exclusivity — a hold without its tempC would blind the fit check
        holder: { type: holder.type, id: holder.id }, state: 'held' }));
    });
    return { ok: true, holdIds: ids };
  },
  // frees ALL of a holder's holds, ONLY that holder's (spec §5.1, Q3: cancelling an event frees
  // everything, one call) — E2 Task 3. Flips matching 'held' entries to 'released' in place; never
  // deletes (release-vs-delete keeps the audit trail, per the ledger section comment above — a sweep is
  // a later concern). Matches on holder.type+id together, so two different holder TYPES sharing the same
  // id string can never cross-free each other's holds.
  release: function(holder){
    const list = eqmLedger(); let n = 0;
    list.forEach(function(e){
      if(e && e.state==='held' && e.holder && holder &&
         e.holder.type===holder.type && e.holder.id===holder.id){ e.state='released'; n++; }
    });
    eqmLedgerWrite(list);
    return { freed: n };
  },
  // replacement ladder (spec §7.1) — Phase E5.
  alternatives: function(missingReq){
    throw new Error('EQM.alternatives: not implemented until E5 (replacement ladder)');
  },
};

// E3 Task 4 (spec §7.2 point 3, plan Task 4) · a PLAIN HELPER, deliberately NOT a 6th EQM method (ruling
// F3/F5 — the module's surface is fixed at exactly five). Released "or a targeted ledger sweep" per the
// spec's own wording: releases EVERY held ledger entry pointing at deviceId, regardless of holder — a
// device delete's impact can span several different holders (the active plan has none, but every SAVED
// event that ever allocated this device does), and the ledger already carries deviceId on every entry, so
// a targeted deviceId sweep is simpler and more complete than replaying EQM.release(holder) once per
// holder. Same release-vs-delete convention as EQM.release above (flips state, never removes the row —
// keeps the audit trail).
function eqmReleaseByDevice(deviceId){
  if(!deviceId) return { freed: 0 };
  const list = eqmLedger(); let n = 0;
  list.forEach(function(e){ if(e && e.state==='held' && e.deviceId===deviceId){ e.state='released'; n++; } });
  eqmLedgerWrite(list);
  return { freed: n };
}
