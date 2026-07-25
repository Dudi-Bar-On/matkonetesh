import { test, expect, seedApp } from './_fixtures';

// E2 Task 5 (plan docs/superpowers/plans/2026-07-25-equipment-e2-ledger-availability.md) — production
// wiring: a saved event's device-staged items own real ledger holds (EQM.allocate, release-then-allocate
// so a re-save is idempotent); deleting an event frees them all (EQM.release, Q3 cancel-frees-holds); an
// event needing no device (or an empty kit) still saves cleanly with zero holds — holds NEVER block a
// save in E2 (blocking is E3's gate, deliberately not this one).
//
// UI-path note (§10.2): the SAVE flow is driven through the real wizard — cStartNewEvent() → cwSave() to
// populate the working menu (the same technique tests/wizard-date-locale.spec.ts already uses for
// evDate) → cwGo(5) to reach the review step → a real Playwright .click() on the shipped #cwSaveEvent
// button, the exact element production wires to evSaveCurrent (app.js build.py:256). DELETE is driven
// through evDelete(id) directly: it is the exact function the real delete button's confirm-dialog
// handler calls (app.js "data-evdel" wiring: `appConfirm(...).then(y=>{ if(y===true){ evDelete(id);
// ...} })`) — the confirm-dialog ceremony around it is orthogonal to what Task 5 wires and is not
// re-verified here.

// cut-1 = brisket, footprint 1320 cm², smoke-only 110°C/12h (same fixture fact tests/occupancy-multievent
// .spec.ts and the plan's own Task 2/3 tests rely on) — one smoke-kind requires row, one smoke stage.
const KIT = [{ id: 'sm1', cat: 'smoker', type: 'ארון / קבינט', name: 'המעשנת שלי', cap: { racks: 2, areaCm2: 4800 } }];

const boot = async (page: any, kit: any[] = KIT) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify(kit),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof EQM==='object' && typeof eqmLedger==='function' && typeof cStartNewEvent==='function' && typeof deriveRequires==='function'`);
};

// day+2 computed in Node (UTC-normalized), matching tests/occupancy-multievent.spec.ts's convention so
// both the test and the page agree on the calendar date.
const DAY = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

// Drives the REAL wizard save flow and returns the saved event's id. Waits on the saved record's OWN
// `updated` timestamp advancing past a `t0` captured just before the click — true for a brand-new event
// (mk-active goes null→id) AND for a re-save of an already-active one (mk-active is unchanged, but
// `updated` still moves) — a real condition, never an arbitrary wait (DoD-11).
async function saveEventViaWizard(page: any, opts: { name: string; date: string; keys: string[] }) {
  const t0 = await page.evaluate(`Date.now()`);
  await page.evaluate(`cStartNewEvent()`);
  await page.waitForSelector('#cwEvName');
  await page.evaluate(`(function(){
    var m = cwMenu();
    m.keys = ${JSON.stringify(opts.keys)};
    m.evName = ${JSON.stringify(opts.name)};
    m.evDate = ${JSON.stringify(opts.date)};
    cwSave(m);
  })()`);
  await page.evaluate(`cwGo(5)`);
  await page.locator('#cwSaveEvent').click();
  await page.waitForFunction(`(function(t0){
    var id = store.get('mk-active');
    if(!id) return false;
    var e = evList().find(function(x){ return x.id===id; });
    return !!e && e.updated>=t0;
  })(${t0})`);
  return (await page.evaluate(`store.get('mk-active')`)) as string;
}

// Real "edit" path — the ✏️ button, [data-evedit] — evLoad(id) then reopen the wizard; saves again.
async function editAndReSave(page: any, id: string) {
  const t0 = await page.evaluate(`Date.now()`);
  await page.evaluate(`cNavGo('events')`);
  await page.waitForSelector(`[data-evedit="${id}"]`);
  await page.locator(`[data-evedit="${id}"]`).click();
  await page.waitForSelector('#cwEvName');
  await page.evaluate(`cwGo(5)`);
  await page.locator('#cwSaveEvent').click();
  await page.waitForFunction(`(function(id,t0){
    var e = evList().find(function(x){ return x.id===id; });
    return !!e && e.updated>=t0;
  })(${JSON.stringify(id)}, ${t0})`);
}

test('a: saving an event with one smoked item writes a held ledger entry whose window equals the real computed smoke-stage window', async ({ page }) => {
  await boot(page);
  const id = await saveEventViaWizard(page, { name: 'טקס א', date: DAY, keys: ['cut-1'] });
  const r = await page.evaluate(`(function(){
    var meta = resolveItem('cut-1');
    var methodKey = eqmRequiresMethodKey(meta);
    var stages = itemStages(meta, methodKey, true);
    var t = '19:00'.split(':').map(Number);
    var serve = new Date('${DAY}'+'T00:00:00'); serve.setHours(t[0],t[1],0,0);
    var sched = planSchedule(stages, serve.getTime());
    var idx = stages.findIndex(function(s){ return s.kind==='smoke'; });
    var expected = { startMs: sched.stages[idx].startMs, endMs: sched.stages[idx].endMs };
    var mine = eqmLedger().filter(function(e){ return e.holder && e.holder.type==='event' && e.holder.id==='${id}'; });
    return { mine: mine, expected: expected };
  })()`) as any;
  expect(r.mine.length).toBe(1);                          // cut-1 is smoke-only — exactly one requires row, one hold
  expect(r.mine[0].state).toBe('held');
  expect(r.mine[0].deviceId).toBe('sm1');
  expect(r.mine[0].capacityDemand).toEqual({ metric: 'area_cm2', amount: 1320 });
  expect(r.mine[0].window).toEqual(r.expected);            // DoD-5(a): window equals the item's REAL computed smoke-stage window
});

test('b: deleting the event flips ALL its held entries to released', async ({ page }) => {
  await boot(page);
  const id = await saveEventViaWizard(page, { name: 'טקס ב', date: DAY, keys: ['cut-1'] });
  const before = await page.evaluate(`eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}'; }).length`);
  expect(before).toBeGreaterThanOrEqual(1);                // sanity: there really is something to free
  await page.evaluate(`evDelete('${id}')`);                // the exact function the real delete confirm-handler calls
  const after = await page.evaluate(`(function(){
    var mine = eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}'; });
    return { n: mine.length, allReleased: mine.every(function(e){ return e.state==='released'; }) };
  })()`) as any;
  expect(after.n).toBe(before);                            // release-vs-delete: entries survive, only state flips (Task 1's contract)
  expect(after.allReleased).toBe(true);
});

test('c: edit → re-save leaves exactly ONE generation of holds (no ghosts)', async ({ page }) => {
  await boot(page);
  const id = await saveEventViaWizard(page, { name: 'טקס ג', date: DAY, keys: ['cut-1'] });
  const firstGen = await page.evaluate(`eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}' && e.state==='held'; }).length`);
  expect(firstGen).toBe(1);
  await editAndReSave(page, id);
  const r = await page.evaluate(`(function(){
    var mine = eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}'; });
    return { held: mine.filter(function(e){ return e.state==='held'; }).length,
             released: mine.filter(function(e){ return e.state==='released'; }).length,
             total: mine.length };
  })()`) as any;
  expect(r.held).toBe(1);                                  // still exactly one LIVE generation
  expect(r.released).toBe(1);                               // the pre-re-save generation was released, not left held (release-then-allocate)
  expect(r.total).toBe(2);                                  // never deleted (Task 1: entries are never deleted in E2) — 1 released + 1 held
});

// d1/d2 deliberately do NOT test a brand-new event with no demand — that would pass identically whether
// or not Task 5's wiring exists at all (a hold-less save was already true before this task), which is
// exactly DoD-2's "a test that passed on first run is void" trap. Instead: create a REAL hold first, then
// remove the demand and re-save, so the assertion can only pass if release-then-allocate actually fires —
// witnessed RED against the pre-Task-5 baseline (the stale hold stayed 'held' forever, since delete/
// re-save touched no ledger state at all).
test('d1: removing the item and re-saving frees the stale hold and writes zero new ones — the save still succeeds', async ({ page }) => {
  await boot(page);
  const id = await saveEventViaWizard(page, { name: 'טקס א׳', date: DAY, keys: ['cut-1'] });
  const firstHeld = await page.evaluate(`eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}' && e.state==='held'; }).length`);
  expect(firstHeld).toBe(1);                                // sanity: there really was a hold to free
  const t0 = await page.evaluate(`Date.now()`);
  await page.evaluate(`cNavGo('events')`);
  await page.waitForSelector(`[data-evedit="${id}"]`);
  await page.locator(`[data-evedit="${id}"]`).click();
  await page.waitForSelector('#cwEvName');
  await page.evaluate(`(function(){ var m=cwMenu(); m.keys=[]; cwSave(m); })()`);   // drop the item — no device demand from here on
  await page.evaluate(`cwGo(5)`);
  await page.locator('#cwSaveEvent').click();
  await page.waitForFunction(`(function(id,t0){
    var e = evList().find(function(x){ return x.id===id; });
    return !!e && e.updated>=t0;
  })(${JSON.stringify(id)}, ${t0})`);
  const r = await page.evaluate(`(function(){
    var ev = evList().find(function(x){ return x.id==='${id}'; });
    var mine = eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}'; });
    return { saved: !!ev, held: mine.filter(function(e){ return e.state==='held'; }).length,
             released: mine.filter(function(e){ return e.state==='released'; }).length };
  })()`) as any;
  expect(r.saved).toBe(true);                               // CRITICAL BOUNDARY: the save succeeds regardless
  expect(r.held).toBe(0);                                    // no device demand anymore → zero LIVE holds
  expect(r.released).toBe(1);                                // the stale hold was actually freed, not abandoned
});

test('d2: the owned kit disappears; re-saving frees the stale hold, allocate refuses a new one, and the save still succeeds', async ({ page }) => {
  await boot(page);                                          // starts WITH the smoker
  const id = await saveEventViaWizard(page, { name: 'טקס ב׳', date: DAY, keys: ['cut-1'] });
  const firstHeld = await page.evaluate(`eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}' && e.state==='held'; }).length`);
  expect(firstHeld).toBe(1);
  await page.evaluate(`store.set('mk-equipment', [])`);      // the kit disappears entirely (equipment sold/removed)
  const t0 = await page.evaluate(`Date.now()`);
  await page.evaluate(`cNavGo('events')`);
  await page.waitForSelector(`[data-evedit="${id}"]`);
  await page.locator(`[data-evedit="${id}"]`).click();
  await page.waitForSelector('#cwEvName');
  await page.evaluate(`cwGo(5)`);
  await page.locator('#cwSaveEvent').click();
  await page.waitForFunction(`(function(id,t0){
    var e = evList().find(function(x){ return x.id===id; });
    return !!e && e.updated>=t0;
  })(${JSON.stringify(id)}, ${t0})`);
  const r = await page.evaluate(`(function(){
    var ev = evList().find(function(x){ return x.id==='${id}'; });
    var mine = eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${id}'; });
    return { saved: !!ev, held: mine.filter(function(e){ return e.state==='held'; }).length,
             released: mine.filter(function(e){ return e.state==='released'; }).length };
  })()`) as any;
  expect(r.saved).toBe(true);                               // CRITICAL BOUNDARY: allocate refusing never blocks the save
  expect(r.held).toBe(0);                                    // D11: no candidate device → busy → allocate writes nothing
  expect(r.released).toBe(1);                                // the stale hold was still freed
});

// Beyond the plan's explicit (a)-(d): evDeleteAll ("Delete all events", cPaintEvents' #cEvDelAll button)
// wipes the whole event list the same way evDelete wipes one — a real, wired production path this task
// touched (app.js) that would otherwise orphan every event's holds on a full reset. Included as a small,
// same-family completeness fix (disclosed in the task report), not scope creep: it reuses EQM.release
// exactly like evDelete, adds no new surface, and is cheap to prove.
test('e: deleting ALL events frees every event\'s holds, not just one', async ({ page }) => {
  await boot(page);
  const idA = await saveEventViaWizard(page, { name: 'טקס E1', date: DAY, keys: ['cut-1'] });
  const idB = await saveEventViaWizard(page, { name: 'טקס E2', date: DAY, keys: ['cut-1'] });
  const before = await page.evaluate(`(function(){
    return { a: eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${idA}' && e.state==='held'; }).length,
             b: eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${idB}' && e.state==='held'; }).length };
  })()`) as any;
  expect(before.a).toBe(1);
  expect(before.b).toBe(1);                                 // sanity: both events really hold something to free
  await page.evaluate(`evDeleteAll()`);                     // the exact function the real "Delete all events" confirm-handler calls
  const after = await page.evaluate(`(function(){
    return { a: eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${idA}'; }).every(function(e){ return e.state==='released'; }),
             b: eqmLedger().filter(function(e){ return e.holder && e.holder.id==='${idB}'; }).every(function(e){ return e.state==='released'; }) };
  })()`) as any;
  expect(after.a).toBe(true);
  expect(after.b).toBe(true);
});

// DoD-10 (phase-gate + plan Task 5 header): the wiring must not alter itemStages/temps. A save+delete
// cycle runs deriveRequires/itemStages/planSchedule (evSyncEquipmentHolds) purely as READS into a
// throwaway local array — this witnesses that cut-1's OWN itemStages() output is byte-identical before
// and after a real save-then-delete round trip through the wired wizard/delete path (same shape as Task
// 2's and Task 3's own DoD-10 witnesses).
test('DoD-10: a real save+delete cycle leaves itemStages byte-identical (safety invariance)', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(`JSON.stringify(itemStages(resolveItem('cut-1'), undefined, true))`);
  const id = await saveEventViaWizard(page, { name: 'טקס בטיחות', date: DAY, keys: ['cut-1'] });
  await page.evaluate(`evDelete('${id}')`);
  const after = await page.evaluate(`JSON.stringify(itemStages(resolveItem('cut-1'), undefined, true))`);
  expect(after).toBe(before);
});
