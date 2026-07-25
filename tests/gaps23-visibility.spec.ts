import { test, expect, seedApp } from './_fixtures';

// Owner-verification gaps 2-3 (2026-07-25): the v264 fixes (BUG-2 Wave B — eqDeriveAreaCm2, eqDeviceSuspect,
// deviceCapacity precedence) were functionally correct but INVISIBLE in the real UI flows the owner actually
// walks — dims extracted correctly but hidden behind the collapsed "Advanced" section, the derived area
// computed only for the fit math and never offered/shown, the repair hint vague, and a suspect explicit
// value still getting the tight measured-tolerance. Every test here DRIVES THE REAL UI — opens forms, clicks,
// types, reads rendered text/chips — never asserts an internal function's return value alone.
//
// Repro scripts this test file's walk patterns are reused from (read-only diagnostics, not modified):
// scratch/debug-v264/gap2-ai-lookup.mjs, scratch/debug-v264/gap3-repair-flow.mjs.

// #panel slides in via a CSS transition — a screenshot taken mid-slide is not evidence of anything.
// Waits on the CONDITION (no running Web Animations on the panel), never a fixed timer (DoD #11).
async function settled(page: any) {
  await page.waitForFunction(`(function(){ var p=document.querySelector('#panel'); return !p || !p.getAnimations || p.getAnimations().length===0; })()`);
}

// ── (a) Fix 1 + Fix 2 — AI lookup with dims-only: Advanced auto-opens, the derived-area suggestion
//        renders under the empty area field, and Accept fills it. ─────────────────────────────────────
test('gap2 (a): AI lookup with dims-only auto-opens Advanced and offers the derived area', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), 'mk-gemkey': JSON.stringify('k') });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof aiLookupDevice==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel [data-eqpick="smoker"]');
  await page.click('#panel [data-eqpick="smoker"]');
  await page.waitForSelector('#panel #eqLookup');

  // the plausible real answer from a product page: outer dims + rack count, NO total area, NO shelf dims
  await page.evaluate(`window.__aiMock={
    name:'הנפח אביה 150', subtype:'ארון / קבינט', fuel:'wood',
    racks:5, zones:null, channels:null, bathL:null, volume:null, nozzles:null,
    areaCm2:null, maxC:null, canHang:null, hooks:null, waterPan:null,
    dimH_cm:150, dimW_cm:60, dimD_cm:43, shelfW_cm:null, shelfD_cm:null,
    note:'מעשנת ארון מקצועית, 5 מדפים', details:'150×60×43 ס"מ · 5 מדפים · פלדה'
  };`);
  await page.fill('#panel #eqLookupQ', 'https://www.hanapach.co.il/avia-150');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='5'`);

  // Fix 1: dims are pro-tier and were filled by the AI lookup — Advanced must be auto-opened
  expect(await page.evaluate(`(document.querySelector('#panel details.eq-adv')||{}).open`)).toBe(true);

  // Fix 2: dims+racks present, areaCm2 empty -> a one-tap suggestion renders under the area field
  await page.waitForSelector('#panel .eq-area-suggest');
  const suggestText = (await page.locator('#panel .eq-area-suggest').textContent()) || '';
  expect(suggestText).toContain('60');
  expect(suggestText).toContain('43');
  expect(suggestText).toContain('12,900');
  expect(suggestText).toContain('משוער');   // outer dims only -> estimated, not measured

  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-verify-advanced-suggestion-he.png' });

  // Accept fills the field with the derived number, and the suggestion clears
  await page.click('#panel .eq-area-accept');
  await expect(page.locator('#panel #eqProp-areaCm2')).toHaveValue('12900');
  expect(await page.evaluate(`!!document.querySelector('#panel .eq-area-suggest')`)).toBe(false);

  // Fix 4 (chosen path): saving with all 3 outer dims present renders ONE combined labeled chip
  // ("📏 150×60×43 ס״מ") instead of three identical-icon chips — the "cleaner" of the two ruled options.
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  const chipText = (await page.locator('#panel .eq-dev-chips').textContent()) || '';
  expect(chipText).toContain('150×60×43');
  expect(chipText).not.toContain('12,900');   // explicit areaCm2 now stored -> no derived-area chip alongside it
  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-labeled-chips-combined-he.png' });
});

// ── (b) Fix 3(a)+(b) — the repair flow: the hint names what will be used, Advanced auto-opens with a
//        prompt, typing dims offers+accepts the suggestion, and the saved device fits the brisket. ────────
test('gap3 (b): repair flow completes end-to-end — hint names the fallback, Advanced opens, saved device fits', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true',
    // the owner's real device: explicit BAD area (one shelf's area saved as the total), NO dims/shelf keys —
    // his lookup predates those fields; dims live only in free-text notes the app never parses.
    'mk-equipment': JSON.stringify([{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח אביה 150',
      cap: { racks: 5, areaCm2: 2580 }, specSource: 'ai', notes: 'מידות: 150×60×43 ס"מ, 5 מדפים' }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof eqDeviceSuspect==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev-suspect');
  await page.click('#panel [data-eqrepair="d1"]');
  await page.waitForSelector('#panel #eqProp-areaCm2.eq-repair-focus');

  // Fix 3(a): the hint names what WILL BE USED if cleared — no dims stored yet -> the class default, with its number
  const hint = (await page.locator('#panel .eq-repair-hint').textContent()) || '';
  expect(hint).toContain('ברירת-מחדל');
  expect(hint).toContain('7,900');

  // Fix 3(b): no dims on the stored device -> Advanced auto-opens with a short prompt to type them
  expect(await page.evaluate(`(document.querySelector('#panel details.eq-adv')||{}).open`)).toBe(true);
  await expect(page.locator('#panel .eq-repair-dims-prompt')).toBeVisible();

  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-repair-form-prompt-he.png' });

  // type the real dims -> Fix 2's suggestion appears LIVE (already wired to these same inputs)
  await page.fill('#panel #eqProp-dimW_cm', '60');
  await page.fill('#panel #eqProp-dimD_cm', '43');
  await page.waitForSelector('#panel .eq-area-suggest');
  const suggestText = (await page.locator('#panel .eq-area-suggest').textContent()) || '';
  expect(suggestText).toContain('12,900');

  await page.click('#panel .eq-area-accept');
  await expect(page.locator('#panel #eqProp-areaCm2')).toHaveValue('12900');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');

  // saved device: the suspect chip is gone, and the card shows the real area
  expect(await page.evaluate(`!!document.querySelector('#panel .eq-dev-suspect')`)).toBe(false);
  const chipText = (await page.locator('#panel .eq-dev-chips').textContent()) || '';
  expect(chipText).toContain('12900');

  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-labeled-chips-he.png' });

  // the owner's end-to-end: the brisket now fits — rendered occupancy view (real DOM, not an internal
  // function alone), same math bug2-shelf-dims.spec.ts's BUG-2b already proves for this exact number.
  await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var computed=[{ m:resolveItem('cut-1'), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }];
    setItemCooker('cut-1','smoke','d1');
    openOccupancyView(computed, new Date(t0+9*3600e3), null);
    var body=document.querySelector('#occBody');
    if(body) body.innerHTML=occupancyViewHtml(computed, t0+2*3600e3, null);
  })()`);
  await page.waitForSelector('.occ2-dev');
  await settled(page);
  const occText = await page.evaluate(`document.querySelector('.occ-wrap').innerText`);
  expect(occText).toContain('הנפח אביה 150');
  expect(occText).not.toContain('לא נכנס למדף בודד');   // the exact pre-fix failure sentence — must NOT appear
  await page.screenshot({ path: 'mockups/gaps23-occupancy-fits-he.png' });
});

// ── (c) Fix 3(c) regression — a SUSPECT explicit area is demoted to the LOOSE tolerance (was tight). ───
// Synthetic single-item fixture (DoD #6 minimality) so the exact numbers are pinned rather than depending
// on a real recipe's footprint: racks:2, areaCm2:1500 -> ratio 750 < 800 -> suspect. usableCm2=round(1500*.85)
// =1275; perSlotCm2=round(1275/2)=638. A 850cm2 item: tight threshold 638*1.10=701.8 (850 is HARD -> 'over',
// the pre-fix behaviour); loose threshold 638*1.6=1020.8 (850 is SOFT -> 'tight', the fixed behaviour).
test('gap-fix 3(c): a suspect explicit area uses LOOSE tolerance, not the old tight/measured one', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true',
    'mk-equipment': JSON.stringify([{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'חשוד', cap: { racks: 2, areaCm2: 1500 } }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof deviceOccupancy==='function' && typeof eqDeviceSuspect==='function'`);
  const r = await page.evaluate(`(function(){
    var suspect = eqDeviceSuspect(equipList()[0]);
    var t0=Date.parse('2026-07-24T06:00:00');
    var meta={ key:'test-item', heb:'פריט בדיקה', equip:{spec:{footprint_cm2:850}} };
    var computed=[{ m:meta, devId:'d1', stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }];
    var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
    return { suspect:suspect, verdict:o.fit.verdict, measured:o.fit.measured, perSlot:o.cap.perSlotCm2,
             hardLen:o.fit.hardItems.length, softLen:o.fit.softItems.length };
  })()`) as any;
  expect(r.suspect).toBe(true);
  expect(r.perSlot).toBe(638);
  expect(r.measured).toBe(false);   // Fix 3(c): suspect demotes measured -> loose, regardless of the explicit value
  expect(r.verdict).toBe('tight');  // 850 is bad-but-soft under the loose 1.6x tolerance, never 'over'
  expect(r.hardLen).toBe(0);
  expect(r.softLen).toBe(1);
});

// ── (d) Fix 5 — editing a device without touching a bool field must not materialize it. ────────────────
test('gap-fix 5: editing a device without touching bools stores no canHang/waterPan key', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true',
    'mk-equipment': JSON.stringify([{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 5 } }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof openEquipment==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.click('#panel [data-eqedit="d1"]');
  await page.waitForSelector('#panel #eqProp-canHang');
  // the select shows "not stated" (empty value), not a materialized true/false, before any save
  expect(await page.locator('#panel #eqProp-canHang').inputValue()).toBe('');
  expect(await page.locator('#panel #eqProp-waterPan').inputValue()).toBe('');
  // touch an UNRELATED field only, then save
  await page.fill('#panel #eqName', 'ארון מעודכן');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`equipList()[0].name==='ארון מעודכן'`);
  const cap = await page.evaluate(`equipList()[0].cap`) as any;
  expect('canHang' in cap).toBe(false);
  expect('waterPan' in cap).toBe(false);
  // absent still resolves to the class default AT READ TIME (never stored) — propOf, chipsFor read through it
  expect(await page.evaluate(`propOf(equipList()[0],'canHang')`)).toBe(true);   // 'ארון / קבינט' class default
  expect(await page.evaluate(`document.querySelectorAll('#panel .eq-dev .eq-chip').length`)).toBeGreaterThan(0);
});

// ── (e) English coverage — no Hebrew leak on the new strings this wave adds. ─────────────────────────────
test('gaps23 (e): English mode — suggestion, bool default option, and derived-area/dims chips fully translate', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('en'), 'mk-uilevel-asked': 'true', 'mk-gemkey': JSON.stringify('k') });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof aiLookupDevice==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.click('#panel [data-eqpick="smoker"]');
  await page.waitForSelector('#panel #eqLookup');
  await page.evaluate(`window.__aiMock={
    name:'Avia 150', subtype:'ארון / קבינט', fuel:'wood',
    racks:5, areaCm2:null, maxC:null, canHang:null, hooks:null, waterPan:null,
    dimH_cm:150, dimW_cm:60, dimD_cm:43, shelfW_cm:null, shelfD_cm:null, note:'x'
  };`);
  await page.fill('#panel #eqLookupQ', 'https://hanapach.co.il/avia-150');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='5'`);

  // Fix 2 suggestion — fully translated
  await page.waitForSelector('#panel .eq-area-suggest');
  const suggestText = (await page.locator('#panel .eq-area-suggest').textContent()) || '';
  expect(suggestText).toContain('Derived from dimensions');
  expect(suggestText).toContain('estimated');
  expect(suggestText).toContain('Accept');
  expect(suggestText).not.toMatch(/[֐-׿]/);

  // Fix 5 bool "not stated" option — fully translated
  const boolOpt = (await page.locator('#panel #eqProp-canHang option[value=""]').textContent()) || '';
  expect(boolOpt).toContain('Default');
  expect(boolOpt).not.toMatch(/[֐-׿]/);

  // save WITHOUT accepting the suggestion -> dims persist, area stays derived-not-stored -> Fix 4's
  // combined dims chip + derived-area chip both render, fully translated
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  const chipsText = (await page.locator('#panel .eq-dev-chips').textContent()) || '';
  expect(chipsText).toContain('12,900');
  expect(chipsText).toContain('estimated');
  expect(chipsText).toContain('cm');
  expect(chipsText).not.toMatch(/[֐-׿]/);

  // MINOR (review bundle, 2026-07-25): the assertion above (`toContain('cm')`) is satisfied by EITHER chip
  // — the derived-area chip's own unit is "cm²", and 'cm' is a substring of 'cm²' — so it never actually
  // proved the DIMS chip's own translated unit rendered. Scope to that chip specifically and pin its exact
  // unit text (no trailing ²) so a regression in the dims chip's own translation would be caught here.
  const dimsChipText = (await page.locator('#panel .eq-dev-chips .eq-chip:has-text("150×60×43")').textContent()) || '';
  expect(dimsChipText).toContain('cm');
  expect(dimsChipText).not.toContain('cm²');
});

// ── Fix wave 2 (review Important, 2026-07-25): accepted estimates keep their provenance ────────────────
// Bug: the derived-area suggestion labels an outer-dims-derived value "משוער" (estimated), but clicking
// Accept wrote it into cap.areaCm2 as a PLAIN explicit value — deviceCapacity's `measured = area>0 &&
// !eqDeviceSuspect(dev)` then granted it TIGHT FIT_SLOT_TOL confidence, silently discarding the safety
// margin the label promised. Fixture (DoD #6 minimality): racks:2, outer dims 60×50 -> derived area
// 6000cm² (estimated, no shelf dims so shelf-dims-derived/measured never mixes in), NOT suspect
// (6000/2=3000 >= 800) so eqDeviceSuspect cannot explain the loose tolerance — isolates the areaEst
// mechanism from the pre-existing suspect-demotion mechanism (Fix 3(c), a separate code path).
// usableCm2=round(6000*.85)=5100; perSlotCm2=round(5100/2)=2550; tight cutoff=2550*1.10=2805; loose
// cutoff=2550*1.6=4080. A 3500cm² demand sits BETWEEN the two cutoffs, so the two tolerances give
// DIFFERENT verdicts — 'over' under the (bug) tight/measured path, 'tight' under the (fixed) loose path.
test('gaps23 review: accept-estimated keeps LOOSE tolerance provenance — chip shows משוער', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof deviceOccupancy==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel [data-eqpick="smoker"]');
  await page.click('#panel [data-eqpick="smoker"]');
  await page.waitForSelector('#panel #eqCapKey');                 // manual entry (no AI key seeded) — no #eqLookup here
  await page.fill('#panel #eqCapKey', '2');                       // racks
  await page.click('#panel details.eq-adv summary');              // outer dims live in the collapsed Advanced section
  await page.fill('#panel #eqProp-dimW_cm', '60');
  await page.fill('#panel #eqProp-dimD_cm', '50');
  await page.waitForSelector('#panel .eq-area-suggest');
  const suggestText = (await page.locator('#panel .eq-area-suggest').textContent()) || '';
  expect(suggestText).toContain('6,000');
  expect(suggestText).toContain('משוער');                          // outer dims only -> estimated, not measured

  await page.click('#panel .eq-area-accept');
  await expect(page.locator('#panel #eqProp-areaCm2')).toHaveValue('6000');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');

  // the accepted ESTIMATE keeps its provenance visible on the card — same dashed derived-chip styling +
  // משוער suffix the pre-save suggestion used (review Important, item 4).
  const chipText = (await page.locator('#panel .eq-dev-chips').textContent()) || '';
  expect(chipText).toContain('6000');
  expect(chipText).toContain('משוער');
  expect(await page.evaluate(`!!document.querySelector('#panel .eq-dev-chips .eq-chip-derived')`)).toBe(true);

  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-areaest-chip.png' });

  // the occupancy math: the accepted estimate must still resolve to LOOSE tolerance (areaMeasured:false),
  // and the crafted 3500cm² demand must land on 'tight' (loose-soft), never 'over' (tight-hard) — the RED
  // this test closes was verdict:'over' with measured:true (Accept silently promoted the estimate).
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var d=equipList()[0];
    var meta={ key:'test-item', heb:'פריט בדיקה', equip:{spec:{footprint_cm2:3500}} };
    var computed=[{ m:meta, devId:d.id, stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }];
    var o=deviceOccupancy(d.id, t0+2*3600e3, computed, null);
    return { areaEst: !!(d.cap && d.cap.areaEst), measured:o.fit.measured, perSlot:o.cap.perSlotCm2, verdict:o.fit.verdict };
  })()`) as any;
  expect(r.areaEst).toBe(true);
  expect(r.perSlot).toBe(2550);
  expect(r.measured).toBe(false);   // review Important: accepted ESTIMATE keeps LOOSE tolerance, never measured
  expect(r.verdict).toBe('tight');  // 3500 is over the tight 2805 cutoff but under the loose 4080 cutoff
});

// Bug (cont'd): the flag must also CLEAR the moment the user manually edits the area to a DIFFERENT number
// and saves — typing is human confirmation of that new number, full stop. Fixture starts already-accepted
// (cap.areaEst:true, area 6000cm²) so this test isolates the CLEARING behaviour from the accepting one
// above (DoD #6). BEFORE: perSlot=round(round(6000*.85)/2)=2550, a 2400cm² demand is <= perSlot -> 'ok'
// regardless of tolerance (the bad-item gate is cm2>perSlotCm2, independent of measured/estimated) — the
// SAME item must still be checked after, so any verdict change is attributable to the tolerance/area edit,
// not a different demand. AFTER manually editing area to 5300cm² (still smoker/racks:2, still not suspect:
// 5300/2=2650>=800): perSlot=round(round(5300*.85)/2)=2253, the same 2400cm² demand is now > perSlot (bad)
// but <= perSlot*1.10=2478.3 (tight cutoff) -> 'tight'. 'ok' -> 'tight' is the flip this test proves.
test('gaps23 review: manual edit after accept clears areaEst — verdict flips to tight, chip loses the marker', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true',
    'mk-equipment': JSON.stringify([{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'משוער-קודם',
      cap: { racks: 2, areaCm2: 6000, areaEst: true }, specSource: 'manual' }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof deviceOccupancy==='function'`);

  const occCheck = `(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var meta={ key:'test-item', heb:'פריט בדיקה', equip:{spec:{footprint_cm2:2400}} };
    var computed=[{ m:meta, devId:'d1', stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }];
    var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
    return { measured:o.fit.measured, perSlot:o.cap.perSlotCm2, verdict:o.fit.verdict };
  })()`;
  const before = await page.evaluate(occCheck) as any;
  expect(before.measured).toBe(false);
  expect(before.perSlot).toBe(2550);
  expect(before.verdict).toBe('ok');

  await page.evaluate(`openEquipment()`);
  await page.click('#panel [data-eqedit="d1"]');
  await page.waitForSelector('#panel #eqProp-areaCm2');
  expect(await page.locator('#panel #eqProp-areaCm2').inputValue()).toBe('6000');
  await page.fill('#panel #eqProp-areaCm2', '5300');   // human-typed edit to a DIFFERENT number = confirmation
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');

  const cap = await page.evaluate(`equipList()[0].cap`) as any;
  expect(cap.areaCm2).toBe(5300);
  expect('areaEst' in cap).toBe(false);   // manual edit to a new value clears the provenance flag

  const chipText = (await page.locator('#panel .eq-dev-chips').textContent()) || '';
  expect(chipText).toContain('5300');
  expect(chipText).not.toContain('משוער');
  expect(await page.evaluate(`!!document.querySelector('#panel .eq-dev-chips .eq-chip-derived')`)).toBe(false);

  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-areaest-cleared-he.png' });

  const after = await page.evaluate(occCheck) as any;
  expect(after.measured).toBe(true);
  expect(after.perSlot).toBe(2253);
  expect(after.verdict).toBe('tight');   // the flip this test exists to prove: 'ok' (loose) -> 'tight' (measured)
});

// ── IMPORTANT-2 (untested branch, 2026-07-25): the repair hint's DERIVABLE variant had zero test/screenshot
// coverage — "אם יישאר ריק: יחושב מהמידות (X ס״מ²)" (app.js doSave's sibling, drawForm's repair-focus block,
// the `derivedNow` branch). Fixture: the owner's real repro (suspect explicit 2580/5 racks<800) but WITH
// dims already stored (dimW_cm/dimD_cm — the "AI lookup already got the dims, only the total was wrong"
// case), so eqDeriveAreaCm2 has something to offer and the hint must name IT, not the class default.
test('gap3 review (derivable-hint): repair hint on a suspect device WITH stored dims names the DERIVED value, and clearing+saving applies it as an estimate', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true',
    'mk-equipment': JSON.stringify([{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח אביה 150',
      cap: { racks: 5, areaCm2: 2580, dimW_cm: 60, dimD_cm: 43 }, specSource: 'ai' }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof openEquipment==='function' && typeof eqDeviceSuspect==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev-suspect');
  await page.click('#panel [data-eqrepair="d1"]');
  await page.waitForSelector('#panel #eqProp-areaCm2.eq-repair-focus');

  // IMPORTANT-2: the hint names the DERIVED value (dims are already stored) — not the class default (7,900)
  const hint = (await page.locator('#panel .eq-repair-hint').textContent()) || '';
  expect(hint).toContain('יחושב מהמידות');
  expect(hint).toContain('12,900');
  expect(hint).not.toContain('ברירת-מחדל');
  expect(hint).not.toContain('7,900');

  await settled(page);
  await page.screenshot({ path: 'mockups/gaps23-repair-hint-derivable-he.png' });

  // clear + save -> no explicit area stored; the derived (ESTIMATED) number actually applies at read time
  await page.fill('#panel #eqProp-areaCm2', '');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');

  expect(await page.evaluate(`!!document.querySelector('#panel .eq-dev-suspect')`)).toBe(false);
  const chipText = (await page.locator('#panel .eq-dev-chips').textContent()) || '';
  expect(chipText).toContain('12,900');
  expect(chipText).toContain('משוער');

  const r = await page.evaluate(`(function(){
    var d=equipList()[0];
    var cap=deviceCapacity(d);
    return { hasExplicit: (d.cap.areaCm2!=null && d.cap.areaCm2!==''), areaCm2:cap.areaCm2, areaMeasured:cap.areaMeasured };
  })()`) as any;
  expect(r.hasExplicit).toBe(false);
  expect(r.areaCm2).toBe(12900);
  expect(r.areaMeasured).toBe(false);   // derived from outer dims only -> estimated, never "measured"
});
