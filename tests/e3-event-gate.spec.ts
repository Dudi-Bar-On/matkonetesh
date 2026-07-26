import { test, expect, seedApp } from './_fixtures';

// E3 Task 5 (spec §5.2, plan docs/superpowers/plans/2026-07-26-equipment-e3-validity-gates.md).
// The event-add gate: adding an item to a DATED event is BLOCKED when the item is 'uncookable'
// (ownership — same verdict/copy as Task 2's plan-add gate, reused verbatim) OR when the item's derived
// cook window inside THIS event answers 'busy' via EQM.availability (a DISTINCT reason — the device is
// owned, but occupied then). An undated working menu ("a plan", per the spec's own table) is unaffected —
// this second check applies ONLY once menuCtx()==='event' AND the working menu carries a evDate (the
// spec's "dated event"). R5: an unconfigured kit is NEVER blocked by either leg.
//
// IMPLEMENTATION NOTE (no new call sites): Task 2 already enumerated and wired EVERY add entry-point
// (card add-menu, wizard picker, presets, evPlanApply, pantryToPlan, spkGoInstance, legacy add/swap)
// through exactly two choke points — eqmAddGate(key) / eqmAddGateKeys(keys). There is no separate
// "add-to-event" UI: an "event" IS the working menu (menuState()) once it carries a date, saved or not.
// So Task 5 extends THOSE SAME two functions with a second check (eqmEventWindowCheck) — every one of
// Task 2's 9 enumerated paths inherits the window-busy leg for free, with no new wiring to regress. This
// file exercises the two REAL, most-used entry points (card add-menu, real clicks) plus the distinct-copy
// assertion; Task 2's own file remains the source of truth for the full 9-path enumeration (unchanged by
// this task — verified below that a representative second path, the wizard picker, also inherits it).
//
// WINDOW DERIVATION (reused, not reinvented): eqmItemWindows(meta, serve) — extracted from
// evSyncEquipmentHolds's own per-item stage/window computation (app.js, E2 Task 5) into its own function
// so the gate's CHECK can never disagree with the real hold the next save's EQM.allocate call would
// WRITE for the same item. eqmEventWindowCheck(meta) resolves `serve` from the CURRENT working menu's
// evDate + store('mk-tlserve') — the exact same inputs evSaveCurrent/evSyncEquipmentHolds use — then runs
// EQM.availability([row], window) per derived row (never the whole requires list against one shared
// window — a multi-stage item can have DIFFERENT windows per row, the same reason evSyncEquipmentHolds
// calls EQM.allocate once per row rather than once per item).
//
// Fixtures:
//   BATH   — sous-vide bath only (no grill) — make-m-brat's default (grill) path is uncookable here,
//            IDENTICAL to tests/e3-plan-gate.spec.ts's BATH fixture (reused, not reinvented).
//   KIT2   — one smoker (sm1, DELIBERATELY SMALL capacity: racks:1, areaCm2:3000) + one standalone probe
//            (pr1 — O-7a: cut-1's smoke stage is bcheck-gated, so a probeless kit would already read
//            'uncookable', confounding the busy-window scenario). sm1's capacity fits exactly ONE cut-1
//            (1320 cm² footprint, e2-event-holds.spec.ts's own fixture fact) with margin (usableCm2=2550,
//            1320<2550) but NOT two (2640>2550) — the exact arithmetic tests/e2-availability.spec.ts's
//            "busy: overlapping holds" test already relies on (sum > usableCm2 ⇒ busy), sized here so a
//            SECOND cut-1 in the SAME window is the forcing function, not a coincidence of rounding.
//   DAY    — +2 days (UTC-normalized), same convention as tests/e2-event-holds.spec.ts / occupancy-
//            multievent.spec.ts, so this file's computed windows agree with the app's.
//   DAY2   — +6 days — far enough from DAY that cut-1's ~12h smoke window (backward from a fixed 19:00
//            serve) can never overlap it — the "free window" fixture for the positive case.

const BATH = [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [20] } }];
const KIT2 = [
  { id: 'sm1', cat: 'smoker', type: 'ארון / קבינט', name: 'המעשנת שלי', cap: { racks: 1, areaCm2: 3000 } },
  { id: 'pr1', cat: 'probe', type: 'מיידי (instant-read)', name: 'Thermapen' },
];
const DAY = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const DAY2 = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);

const boot = async (page: any, kit: any[] | null, extra: Record<string, string> = {}) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...extra };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmValidity==='function' && typeof toggleCart==='function' &&
    typeof eqmAddGate==='function' && typeof eqmEventWindowCheck==='function' &&
    typeof eqmItemWindows==='function' && typeof cStartNewEvent==='function'`);
};

// Real wizard SAVE flow (identical technique to tests/e2-event-holds.spec.ts's saveEventViaWizard) —
// used to seed a REAL, already-saved event (with real ledger holds) for the busy-window scenarios.
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

// Starts a FRESH, DATED, UNSAVED draft — "a dated event" per the spec's own table — without saving it,
// so the add-gate's window-busy leg is exercised BEFORE any save/allocate happens (the check must never
// require a save first; the whole point is to stop a doomed add before the user gets that far).
async function startDatedDraft(page: any, date: string) {
  await page.evaluate(`cStartNewEvent()`);
  await page.waitForSelector('#cwEvName');
  await page.evaluate(`(function(){ var m=cwMenu(); m.evDate=${JSON.stringify(date)}; cwSave(m); })()`);
}

const openMakes = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="מלאכה"]');
};
const openCuts = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.click('button.cattile[data-tilegroup="בשר אדום"]');
};

test('(1) uncookable item is BLOCKED in a dated-event context — same reason/copy as the plan-add gate, real click, not added', async ({ page }) => {
  await boot(page, BATH);
  await startDatedDraft(page, DAY);
  await openMakes(page);
  await page.click('[data-addmenu="make-m-brat"]');
  await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — חסר גריל/אש'`);
  await page.screenshot({ path: 'mockups/e3-event-gate-uncookable.png' });
  const keys = await page.evaluate(`menuState().keys`) as string[];
  expect(keys).not.toContain('make-m-brat');
});

test('(2) cookable item is BLOCKED for a BUSY window — distinct reason, item not added', async ({ page }) => {
  await boot(page, KIT2);
  await saveEventViaWizard(page, { name: 'טקס א', date: DAY, keys: ['cut-1'] });
  // sanity: the seed really wrote a real hold on sm1 covering cut-1's real smoke-stage window
  const seeded = await page.evaluate(`eqmLedger().filter(function(e){ return e.state==='held' && e.deviceId==='sm1'; }).length`);
  expect(seeded).toBe(1);
  await startDatedDraft(page, DAY);   // event B: same day → same default 19:00 serve → identical derived window
  await openCuts(page);
  await page.click('[data-addmenu="cut-1"]');
  await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — עסוק בחלון הזה: מעשנה'`);
  await page.screenshot({ path: 'mockups/e3-event-gate-busy.png' });
  const keys = await page.evaluate(`menuState().keys`) as string[];
  expect(keys).not.toContain('cut-1');
});

test('(3) cookable item with a FREE window ADDS normally — real click, item present, no block toast', async ({ page }) => {
  await boot(page, KIT2);
  await startDatedDraft(page, DAY2);
  await openCuts(page);
  await page.click('[data-addmenu="cut-1"]');
  await page.waitForFunction(`(menuState().keys||[]).includes('cut-1')`);
  expect(await page.evaluate(`menuState().keys`)).toContain('cut-1');
  const toastShown = await page.evaluate(`!!(document.querySelector('#toast')&&document.querySelector('#toast').classList.contains('show')&&document.querySelector('#toast').textContent.indexOf('לא נוסף')===0)`);
  expect(toastShown).toBe(false);
});

test('(4) R5 — an unconfigured kit is NEVER blocked at the event gate, even in a would-be-busy dated scenario', async ({ page }) => {
  await boot(page, null);
  await startDatedDraft(page, DAY);
  await openCuts(page);
  await page.click('[data-addmenu="cut-1"]');
  await page.waitForFunction(`(menuState().keys||[]).includes('cut-1')`);
  expect(await page.evaluate(`menuState().keys`)).toContain('cut-1');
});

test('(5) the two block reasons are DISTINCT — uncookable copy != busy copy, asserted on the actual rendered DOM text', async ({ page }) => {
  await boot(page, BATH);
  await startDatedDraft(page, DAY);
  await openMakes(page);
  await page.click('[data-addmenu="make-m-brat"]');
  await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent.indexOf('לא נוסף')===0`);
  const uncookableTxt = await page.evaluate(`document.querySelector('#toast').textContent`) as string;

  await boot(page, KIT2);
  await saveEventViaWizard(page, { name: 'טקס ב', date: DAY, keys: ['cut-1'] });
  await startDatedDraft(page, DAY);
  await openCuts(page);
  await page.click('[data-addmenu="cut-1"]');
  await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent.indexOf('לא נוסף')===0`);
  const busyTxt = await page.evaluate(`document.querySelector('#toast').textContent`) as string;

  expect(uncookableTxt).not.toBe(busyTxt);
  expect(uncookableTxt).toContain('חסר');
  expect(busyTxt).toContain('עסוק בחלון הזה');
});

// A second, independently-wired add entry-point (Task 2's #2, the wizard dish-picker `data-cwpick`)
// inherits the window-busy leg too — proving the gate lives in the shared choke point, not duplicated
// per-callsite logic that could drift.
test('(6) a second add entry-point (wizard dish-picker) inherits the window-busy leg — real click, BLOCKED', async ({ page }) => {
  await boot(page, KIT2);
  await saveEventViaWizard(page, { name: 'טקס ג', date: DAY, keys: ['cut-1'] });
  await startDatedDraft(page, DAY);
  await page.evaluate(`cwGo(1)`);
  await page.waitForSelector('#cwPickList [data-cwpick="cut-1"]');
  await page.click('#cwPickList [data-cwpick="cut-1"]');
  await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='לא נוסף — עסוק בחלון הזה: מעשנה'`);
  expect(await page.evaluate(`menuState().keys`)).not.toContain('cut-1');
});

// EN leak — the busy-window toast renders in English with zero Hebrew leak (§2.1 Global Constraint).
test('(EN) busy-window toast renders in English, no Hebrew leak', async ({ page }) => {
  await boot(page, KIT2, { 'mk-lang': JSON.stringify('en') });
  await saveEventViaWizard(page, { name: 'Party A', date: DAY, keys: ['cut-1'] });
  await startDatedDraft(page, DAY);
  await openCuts(page);
  await page.click('[data-addmenu="cut-1"]');
  await page.waitForFunction(`(document.querySelector('#toast')||{}).textContent==='Not added — busy in this window: Smoker'`);
  const txt = await page.evaluate(`document.querySelector('#toast').textContent`) as string;
  expect(txt).not.toMatch(/[֐-׿]/);
  expect(await page.evaluate(`menuState().keys`)).not.toContain('cut-1');
});

// DoD-10 safety invariance — the window-busy check reads eqmItemWindows/EQM.availability and must never
// mutate the item's own data or its derived stage list (same pattern as e3-plan-gate.spec.ts's own
// DoD-10 witness, and the E2 pattern for EQM.availability round-trips).
test('DoD-10 safety invariance — a window-busy blocked add never mutates the item object or its derived stages', async ({ page }) => {
  await boot(page, KIT2);
  await saveEventViaWizard(page, { name: 'טקס בטיחות', date: DAY, keys: ['cut-1'] });
  await startDatedDraft(page, DAY);
  const eq = await page.evaluate(`(function(){
    var meta = resolveItem('cut-1');
    var before = JSON.stringify(meta.obj);
    var stagesBefore = JSON.stringify(itemStages(meta, eqmRequiresMethodKey(meta), true));
    eqmAddGate('cut-1');   // BLOCKED (busy) — the exact call every gated write site makes
    var after = JSON.stringify(resolveItem('cut-1').obj);
    var stagesAfter = JSON.stringify(itemStages(resolveItem('cut-1'), eqmRequiresMethodKey(resolveItem('cut-1')), true));
    return before===after && stagesBefore===stagesAfter;
  })()`) as boolean;
  expect(eq).toBe(true);
});
