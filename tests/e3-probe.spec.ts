import { test, expect, seedApp } from './_fixtures';

// E3 Task 3 — AMENDMENT O-7 (owner ruling 2026-07-25, "temperature probe availability is required,
// especially for smokers and ovens"; spec docs/superpowers/specs/2026-07-25-equipment-cooking-constraint-
// design.md "AMENDMENT O-7"; plan docs/superpowers/plans/2026-07-26-equipment-e3-validity-gates.md Task 3).
//
// DERIVATION (equipment.js, deriveRequires): a stage GATED BY INTERNAL TEMPERATURE (probe target,
// kind:'bcheck') is executable only with a temperature probe. itemStages() (app.js, D1) already computes
// the ONE real structural marker for this — it appends a kind:'bcheck' stage whenever the item carries a
// numeric meta.obj.safe/tgt. deriveRequires reads that SAME marker off the `stages` array it already built
// (never a second safe/tgt read, never a prose/text heuristic) and tags capability.probe:true onto the
// item's LAST device-stage row — the device the item is in when it leaves its last cook stage, immediately
// before rest/bcheck (SAME-KIND-STAGE ASSUMPTION documented at the derivation site: itemStages emits at
// most one row per REQ_KIND today, so "the last row pushed" is unambiguous).
//
// AMENDMENT O-7a (owner ruling 2026-07-26, superseding O-7's device-integral branch — see the spec's
// AMENDMENT O-7a block) — probe capability is now STANDALONE-ONLY: a device-integral `hasProbe` (a
// smoker/oven's built-in, typically-ambient thermometer) NEVER satisfies `capability.probe`; the property
// itself is removed from EQUIP_CATS smoker/oven (app.js). This file's tests below are updated to match:
// test (c) is INVERTED (device-integral does NOT satisfy) and the real-click UI flow that used to toggle
// it is replaced with a check that the form field is gone.
//
// SATISFACTION (equipment.js, eqmOwnershipRow + eqmProbeSatisfiedBy/eqmProbeAvailable): ANY owned
// standalone probe device — EQUIP_CATS' own first-class 'probe' category (a MEATER/Inkbird/instant-read/
// etc; EQUIP_OTHER_ITEMS carries NO probe/thermometer entry at all — grepped and confirmed) — ONLY. A
// device-integral flag, even if present in stored data (e.g. stale pre-O-7a records), is never consulted.
//
// GAP SURFACING (app.js, eqmValidity): an unmet probe requirement on a failing row is surfaced as its own
// {kind:'probe'} gap line (EQM_KIND_HE.probe = ['מדחום','Probe']), distinct from the device-kind gap, so
// the WHY panel never conflates "you don't own a smoker" with "your smoker has no way to check doneness".
//
// FIXTURES:
//   cut-1 (brisket, data.py: safe=63, tgt=95) — bcheck-gated, used for the pure-derivation sanity check.
//   spec-4 (בייקון חזיר / Pork Bacon, data.py: smt=90, tgt=65 numeric, no `safe` key at all) — a SPECIAL
//     item, whose itemProfile carries exactly ONE cited method ('smoke'), so its derived requires list is
//     ONE row — the cleanest real fixture for isolating the probe gap from any other device-kind gap.
//   make-m-brat — a MAKE item; DATA.makes entries (data.py's make() constructor) carry NO safe/tgt field
//     at all, so NO make item is ever bcheck-gated — the real "time-only" negative fixture (d).

const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof EQM==='object' && typeof deriveRequires==='function' && typeof eqmValidity==='function' && typeof eqmProbeAvailable==='function'`);
};

// smoker with plenty of temp headroom (spec-4's cited smt=90) but NO hasProbe stated and no standalone —
// the exact "device without a probe" kit the task brief asks for.
const SMOKER_NO_PROBE = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];

// ── sanity: confirm the real bcheck marker + last-row tagging before trusting anything built on it ──────
test('sanity — cut-1 is bcheck-gated (data.py: safe=63) and its smoke-only combo derives ONE row carrying capability.probe', async ({ page }) => {
  await boot(page, null);
  const obj = await page.evaluate(`(function(){ var m=resolveItem('cut-1'); return { safe:m.obj.safe, tgt:m.obj.tgt }; })()`) as any;
  expect(obj.safe).toBe(63);
  const hasBcheck = await page.evaluate(`itemStages(resolveItem('cut-1'), 'c:smoke', true).some(function(s){ return s.kind==='bcheck'; })`);
  expect(hasBcheck).toBe(true);
  const rows = await page.evaluate(`deriveRequires(resolveItem('cut-1'), 'c:smoke')`) as any[];
  expect(rows.length).toBe(1);
  expect(rows[0].kind).toBe('smoker');
  expect(rows[0].capability && rows[0].capability.probe).toBe(true);
});

test('sanity — spec-4 (Pork Bacon) is bcheck-gated via a numeric tgt (no safe key at all) and derives exactly one probe-carrying row', async ({ page }) => {
  await boot(page, null);
  const obj = await page.evaluate(`(function(){ var m=resolveItem('spec-4'); return { safe:m.obj.safe, tgt:m.obj.tgt, smt:m.obj.smt }; })()`) as any;
  expect(obj.safe).toBeUndefined();
  expect(obj.tgt).toBe(65);
  const rows = await page.evaluate(`deriveRequires(resolveItem('spec-4'), 'smoke')`) as any[];
  expect(rows.length).toBe(1);
  expect(rows[0].kind).toBe('smoker');
  expect(rows[0].capability.maxTempC).toBe(90);
  expect(rows[0].capability.probe).toBe(true);
});

// ── (d) NEGATIVE — a time-only item (no bcheck) derives NO probe capability anywhere ─────────────────────
test('(d) negative — make-m-brat (a MAKE item; no safe/tgt field exists on the raw data) derives NO probe capability on EITHER cited method', async ({ page }) => {
  await boot(page, null);
  const obj = await page.evaluate(`(function(){ var m=resolveItem('make-m-brat'); return { safe:m.obj.safe, tgt:m.obj.tgt }; })()`) as any;
  expect(obj.safe).toBeUndefined();
  expect(obj.tgt).toBeUndefined();
  const hasBcheckGrill = await page.evaluate(`itemStages(resolveItem('make-m-brat'), 'grill', true).some(function(s){ return s.kind==='bcheck'; })`);
  const hasBcheckSmoke = await page.evaluate(`itemStages(resolveItem('make-m-brat'), 'smoke', true).some(function(s){ return s.kind==='bcheck'; })`);
  expect(hasBcheckGrill).toBe(false);
  expect(hasBcheckSmoke).toBe(false);
  const rowsGrill = await page.evaluate(`deriveRequires(resolveItem('make-m-brat'), 'grill')`) as any[];
  const rowsSmoke = await page.evaluate(`deriveRequires(resolveItem('make-m-brat'), 'smoke')`) as any[];
  expect(rowsGrill.length).toBeGreaterThan(0);
  expect(rowsSmoke.length).toBeGreaterThan(0);
  expect(rowsGrill.every((r: any) => !(r.capability && r.capability.probe))).toBe(true);
  expect(rowsSmoke.every((r: any) => !(r.capability && r.capability.probe))).toBe(true);
});

test.describe('ownership + WHY panel — real clicks', () => {
  // ── (a) a probe-requiring item + a kit whose serving device has NO probe and no standalone ──────────
  test('(a) ownership answers partial (never ok) — the probe gap alone blocks an otherwise-capable smoker', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    const r = await page.evaluate(`EQM.ownership(deriveRequires(resolveItem('spec-4'), 'smoke'))`) as any;
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([]);                                  // a smoker IS owned, and it clears maxTempC
    expect(r.partial.map((x: any) => x.kind)).toEqual(['smoker']);  // owned but doesn't meet ALL capabilities
  });

  test('(a) the why/fix panel names the probe gap distinctly — real click, screenshot', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מיובש ומעושן"]');
    const card = page.locator('[data-kind="spec"][data-n="4"]');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveClass(/eq-inv\b/);       // uncookable — the smoker's ONLY cited path fails
    await page.click('[data-kind="spec"][data-n="4"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    const panel = page.locator('#panel .eq-inv-panel');
    const why = await panel.locator('.eq-inv-why').innerText();
    expect(why).toContain('דרוש: מדחום');           // the probe gap, named on its own line
    expect(why).toContain('חסר');                    // 'missing', not 'owned but insufficient' — no standalone/integral covers it
    expect(why).toContain('דרוש: מעשנה');            // the device-kind gap still shows too (owned but insufficient) — both true, both shown
    await page.locator('#panel').screenshot({ path: 'mockups/e3-probe-gap-panel.png' });
  });

  // ── (b) the SAME kit + a standalone probe accessory, added via the REAL Equipment Manager "add
  // device" flow — satisfied. (EQUIP_CATS' own first-class 'probe' category, cat:'probe' — the plan
  // brief's guessed "accessories checklist" location, EQUIP_OTHER_ITEMS, carries no such entry; verified
  // live before writing this test, see the file-header comment.) ──────────────────────────────────────
  test('(b) adding a standalone probe device via the real Equipment Manager satisfies the gap — real clicks, screenshot', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await page.evaluate(`openEquipment()`);
    await page.waitForSelector('#panel #eqAddNew');
    await page.click('#panel #eqAddNew');
    await page.waitForSelector('#panel [data-eqpick="probe"]');
    await page.click('#panel [data-eqpick="probe"]');
    await page.waitForSelector('#panel #eqSave');
    await page.selectOption('#panel #eqCat', 'probe');
    await page.selectOption('#panel #eqType', 'מיידי (instant-read)');
    await page.fill('#panel #eqName', 'Test Thermapen');
    await page.click('#panel #eqSave');
    await page.waitForFunction(`equipByCat('probe').length===1`);
    await page.click('#panel .x');
    await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);

    // pure-function confirmation (the exact call the panel/chip reads)
    const r = await page.evaluate(`EQM.ownership(deriveRequires(resolveItem('spec-4'), 'smoke'))`) as any;
    expect(r.ok).toBe(true);

    // real-UI confirmation: the catalog card loses its invalid treatment, and re-opening the item shows no panel
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מיובש ומעושן"]');
    const card = page.locator('[data-kind="spec"][data-n="4"]');
    await card.scrollIntoViewIfNeeded();
    await expect(card).not.toHaveClass(/eq-inv\b/);
    await page.screenshot({ path: 'mockups/e3-probe-standalone-satisfied.png' });
    await page.click('[data-kind="spec"][data-n="4"]');
    await page.waitForSelector('#panel #methodArea');
    expect(await page.locator('#panel .eq-inv-panel').count()).toBe(0);
  });

  // ── (c) AMENDMENT O-7a — device-integral is NOT a satisfier. The Equipment Manager's Advanced section
  // no longer offers a `hasProbe` toggle at all (removed from EQUIP_CATS smoker/oven); confirm that via a
  // real click into the edit form, then confirm ownership stays exactly as (a) left it — unowned probe. ──
  test('(c) O-7a — the device-integral hasProbe field is gone from the real Equipment Manager form, and the smoker alone (no standalone) still fails ownership — real clicks', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    // pre-condition: partial, exactly as (a) established
    const before = await page.evaluate(`EQM.ownership(deriveRequires(resolveItem('spec-4'), 'smoke'))`) as any;
    expect(before.ok).toBe(false);

    await page.evaluate(`openEquipment()`);
    await page.waitForSelector('#panel [data-eqedit="d1"]');
    await page.click('#panel [data-eqedit="d1"]');
    await page.waitForSelector('#panel #eqSave');
    const adv = page.locator('#panel details.eq-adv');
    await adv.locator('summary').click();
    expect(await page.locator('#panel #eqProp-hasProbe').count()).toBe(0);   // O-7a: field removed, real DOM check
    // #eqBack (the edit sub-form's own "חזרה" ✕, app.js `eq-sheet-x`/`#eqBack`) returns to the device LIST
    // still inside #panel — NOT the same control as `.x` (the generic panel-top close, only reachable once
    // back at the list, per test (b)'s identical two-step close above). Both real clicks, no waitForTimeout.
    await page.click('#panel #eqBack');
    await page.waitForSelector('#panel #eqAddNew');
    await page.click('#panel .x');
    await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);

    const after = await page.evaluate(`EQM.ownership(deriveRequires(resolveItem('spec-4'), 'smoke'))`) as any;
    expect(after.ok).toBe(false);   // nothing changed the kit — still unsatisfied; no way left to set it via the smoker
  });

  // ── (c) unit-level — INVERTED for O-7a: a device carrying legacy/stray `cap.hasProbe:true` data (e.g. a
  // record saved before this amendment shipped) must NOT satisfy the probe requirement — device-integral
  // is never a satisfier, regardless of how the flag got onto the device. ──────────────────────────────
  test('(c) O-7a INVERTED — a device seeded with legacy hasProbe:true does NOT satisfy, with no standalone owned', async ({ page }) => {
    const SMOKER_INTEGRAL = [{ id: 'd2', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון-פרו', cap: { racks: 4, areaCm2: 6000, maxC: 150, hasProbe: true } }];
    await boot(page, SMOKER_INTEGRAL);
    expect(await page.evaluate(`equipByCat('probe').length`)).toBe(0);   // fixture minimality: confirm no standalone is present
    const r = await page.evaluate(`EQM.ownership(deriveRequires(resolveItem('spec-4'), 'smoke'))`) as any;
    expect(r.ok).toBe(false);                                   // O-7a: device-integral never satisfies, even with the legacy prop present
    expect(r.partial.map((x: any) => x.kind)).toEqual(['smoker']);
  });
});

// ── (e) EN leak — the new probe copy renders correctly in English, no Hebrew leak ────────────────────────
test('(e) EN leak — English mode: the probe gap line reads in English, no Hebrew characters', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en'),
    'mk-equipment': JSON.stringify(SMOKER_NO_PROBE), 'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof eqInvPanelHtml==='function'`);
  const html = await page.evaluate(`eqInvPanelHtml(resolveItem('spec-4'))`) as string;
  expect(html).toContain('Requires: Probe');
  expect(html).toContain('missing');
  expect(html).not.toMatch(/[֐-׿]/);   // zero Hebrew characters anywhere in the panel
});

// ── DoD-10 safety invariance — the probe derivation/ownership/gap logic reads bcheck/safe/tgt, temp and
// cook-duration data but must never ALTER any of it (mirrors the identical pattern already proven for
// deriveRequires/EQM.ownership/eqmValidity in tests/e1-derive-requires.spec.ts, e1-ownership.spec.ts and
// e3-validity.spec.ts). ────────────────────────────────────────────────────────────────────────────────
test('DoD-10 safety invariance — probe derivation/ownership/gaps never mutate the item object or its stages', async ({ page }) => {
  await boot(page, SMOKER_NO_PROBE);
  const eq = await page.evaluate(`(function(){
    var m = resolveItem('spec-4');
    var before = { obj: JSON.stringify(m.obj), stages: JSON.stringify(itemStages(m, 'smoke', true)) };
    var reqs = deriveRequires(m, 'smoke');
    EQM.ownership(reqs);
    eqmValidity(resolveItem('spec-4'));
    var after = { obj: JSON.stringify(resolveItem('spec-4').obj), stages: JSON.stringify(itemStages(resolveItem('spec-4'), 'smoke', true)) };
    return before.obj===after.obj && before.stages===after.stages;
  })()`) as boolean;
  expect(eq).toBe(true);
});
