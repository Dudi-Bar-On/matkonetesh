import { test, expect, seedApp } from './_fixtures';

// #panel slides in via a CSS transition (app.css: `.panel{transition:transform .26s ...}`) — a screenshot
// taken mid-slide is not evidence of anything. Waits on the CONDITION (no running Web Animations on the
// panel), never a fixed timer, per DoD #11.
async function settled(page: any) {
  await page.waitForFunction(`(function(){ var p=document.querySelector('#panel'); return !p || !p.getAnimations || p.getAnimations().length===0; })()`);
}

// BUG-2 (Wave B, owner bug round 2026-07-25): the AI device lookup stored ONE shelf's area (2580 = 60×43)
// as the הנפח אביה 150's TOTAL cooking area (5-shelf cabinet, 150×60×43cm outer). deviceCapacity/packDevice
// then divided that already-too-small "total" by racks AGAIN → a phantom ~439cm² shelf → the real 1320cm²
// brisket read "לא נכנס למדף בודד" (repro: scratch/bug2-shelf-math/repro-bad-2580.png). The fix: (1) a
// hardened AI-lookup prompt (AREA_CM2_SCHEMA_FIELD, app.js), (2) dims/shelf-derived total area
// (eqDeriveAreaCm2, app.js next to deviceCapacity), (3) a plausibility flag + one-tap repair chip
// (eqDeviceSuspect + the device-card UI), and the RIDER: outer-dims capture → derived volume (litres).
//
// cut-1 = בריסקט (Brisket), footprint_cm2 = 1320 — the exact repro number (occ-fit-ladder.spec.ts already
// documents this same fixture value under the same fit-ladder machinery this spec drives).

const fitBoot = async (page: any, kit: any[]) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify(kit),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof deviceOccupancy==='function' && typeof eqDeviceSuspect==='function' && typeof eqDeriveAreaCm2==='function'`);
};

const briskFitAt = () => `(function(){
  var t0=Date.parse('2026-07-24T06:00:00');
  var computed=[{ m:resolveItem('cut-1'), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }];
  setItemCooker('cut-1','smoke','d1');
  var o=deviceOccupancy('d1', t0+2*3600e3, computed, null);
  return { verdict:o.fit.verdict, measured:o.fit.measured, hard:o.fit.hardItems, soft:o.fit.softItems,
           perSlot:o.cap.perSlotCm2, areaCm2:o.cap.areaCm2, areaMeasured:o.cap.areaMeasured };
})()`;

// ── (a) THE SCENARIO TABLE, pinned as tests ────────────────────────────────────────────────────
test('BUG-2a: pre-fix repro pinned — {racks:5, areaCm2:2580} (one shelf stored as total) reads OVER, and eqDeviceSuspect flags it', async ({ page }) => {
  await fitBoot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{ racks:5, areaCm2:2580 } }]);
  const r = await page.evaluate(briskFitAt()) as any;
  expect(r.areaCm2).toBe(2580);              // explicit stored value wins precedence — untouched by derivation
  expect(r.perSlot).toBeLessThan(500);       // the phantom ~439cm² shelf the bug report describes
  expect(r.verdict).toBe('over');            // 1320cm² brisket does not fit a ~439cm² shelf — repro-bad-2580.png
  expect(r.hard).toContain(await page.evaluate("resolveItem('cut-1').heb"));
  const suspect = await page.evaluate(`eqDeviceSuspect(equipList()[0])`);
  expect(suspect).toBe(true);                // 2580/5=516 < 800 -> flagged suspect
});

test('BUG-2a: the FIXED total {racks:5, areaCm2:12900} (real total, matching 5×60×43) fits, and is NOT suspect', async ({ page }) => {
  await fitBoot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{ racks:5, areaCm2:12900 } }]);
  const r = await page.evaluate(briskFitAt()) as any;
  expect(r.areaCm2).toBe(12900);
  expect(r.verdict).toBe('ok');              // repro-good-12900.png: "הכל נכנס"
  expect(r.hard.length).toBe(0);
  expect(r.soft.length).toBe(0);
  const suspect = await page.evaluate(`eqDeviceSuspect(equipList()[0])`);
  expect(suspect).toBe(false);               // 12900/5=2580 >= 800 -> not suspect, no chip
});

// ── (b) derivation: shelf dims present, NO areaCm2 -> total is DERIVED, not defaulted ─────────
test('BUG-2b: shelfW=60,shelfD=43,racks=5, no areaCm2 -> areaCm2 derives to 12900 (measured), brisket fits', async ({ page }) => {
  await fitBoot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{ racks:5, shelfW_cm:60, shelfD_cm:43 } }]);
  const r = await page.evaluate(briskFitAt()) as any;
  // RED (pre-fix / derivation absent) would resolve areaCm2 via the CLASS DEFAULT (7900, unmeasured)
  // instead of the real shelf measurement (12900, measured) — a different, wrong number even though the
  // real shelf dims were sitting right there in cap. See the regression red/green evidence in the report.
  expect(r.areaCm2).toBe(12900);
  expect(r.areaMeasured).toBe(true);         // a REAL shelf measurement, not an estimate -> tight FIT_SLOT_TOL
  expect(r.verdict).toBe('ok');              // brisket 1320 << 2193 usable per shelf
});

test('BUG-2b (visual): the occupancy view renders the derived-12900 אביה 150 with the brisket fitting', async ({ page }) => {
  await fitBoot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{ racks:5, shelfW_cm:60, shelfD_cm:43 } }]);
  await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var computed=[{ m:resolveItem('cut-1'), stages:[{kind:'smoke', start:new Date(t0), end:new Date(t0+8*3600e3), temp:110}] }];
    setItemCooker('cut-1','smoke','d1');
    window._mkTestComputed=computed;
    openOccupancyView(computed, new Date(t0+9*3600e3), null);
    window._occT=t0+2*3600e3;
    var body=document.querySelector('#occBody');
    if(body) body.innerHTML=occupancyViewHtml(computed, window._occT, null);
  })()`);
  await page.waitForSelector('.occ2-dev');
  await settled(page);
  const text = await page.evaluate(`document.querySelector('.occ-wrap').innerText`);
  expect(text).toContain('הנפח אביה 150');
  expect(text).not.toContain('לא נכנס למדף בודד');   // the exact failure sentence in repro-bad-2580.png — must NOT appear
  await page.screenshot({ path: 'mockups/bug2-fixed-aviah-derived-12900-he.png' });
});

test('BUG-2b (negative): outer dims ONLY (no shelf dims) derive an ESTIMATE, not a measurement', async ({ page }) => {
  await fitBoot(page, [{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{ racks:5, dimW_cm:60, dimD_cm:43 } }]);
  const r = await page.evaluate(briskFitAt()) as any;
  expect(r.areaCm2).toBe(12900);             // same arithmetic as the shelf-derived case (outer footprint ≈ shelf here)
  expect(r.areaMeasured).toBe(false);        // OUTER dims are an approximation — flagged estimated, not measured
});

// ── (c) dims -> derived VOLUME (rider), captured through the real save flow ────────────────────
test('BUG-2c: outer dims 150×60×43cm -> volumeL derives to 387 and shows as a "387 ליטר" chip on the card', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof openEquipment==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.click('#panel [data-eqpick="smoker"]');
  await page.waitForSelector('#panel #eqSave');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.selectOption('#panel #eqType', 'ארון / קבינט');
  await page.fill('#panel #eqName', 'הנפח אביה 150');
  await page.fill('#panel #eqCapKey', '5');
  await page.click('#panel .eq-adv summary');   // dims are 'pro' tier -> behind the collapsed "Advanced" details
  await page.fill('#panel #eqProp-dimH_cm', '150');
  await page.fill('#panel #eqProp-dimW_cm', '60');
  await page.fill('#panel #eqProp-dimD_cm', '43');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  const volumeL = await page.evaluate(`equipByCat('smoker')[0].cap.volumeL`);
  expect(volumeL).toBe(387);                                     // 150*60*43/1000 = 387
  const chipText = await page.evaluate(`document.querySelector('#panel .eq-dev-chips').textContent`);
  expect(chipText).toContain('387');
  expect(chipText).toContain('ליטר');
  await settled(page);
  await page.screenshot({ path: 'mockups/bug2-fixed-volume-he.png' });
});

// ── (d) the repair chip's one-tap action ───────────────────────────────────────────────────────
test('BUG-2d: the suspect chip renders on a bad device, and its "re-check" opens the edit form focused on areaCm2', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('he'), 'mk-uilevel-asked': 'true',
    'mk-equipment': JSON.stringify([{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'הנפח אביה 150', cap:{ racks:5, areaCm2:2580 } }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof openEquipment==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev-suspect');
  const chipText = await page.evaluate(`document.querySelector('#panel .eq-dev-suspect').textContent`);
  expect(chipText).toContain('שטח מדף חשוד');
  expect(chipText).toContain('בדוק שוב');
  await settled(page);
  await page.screenshot({ path: 'mockups/bug2-suspect-chip-he.png' });
  await page.click('#panel [data-eqrepair="d1"]');
  await page.waitForSelector('#panel #eqProp-areaCm2.eq-repair-focus');   // the lighter option: edit form, focused field
  const focused = await page.evaluate(`document.activeElement && document.activeElement.id`);
  expect(focused).toBe('eqProp-areaCm2');
  const hint = await page.evaluate(`(document.querySelector('#panel .eq-repair-hint')||{}).textContent||''`);
  expect(hint.length).toBeGreaterThan(0);
  await settled(page);
  await page.screenshot({ path: 'mockups/bug2-repair-focus-he.png' });
});

// ── (e) English coverage — no Hebrew leak on the NEW sentence-level strings this wave adds ──────
// Scope note: dims/shelf-dims props (dimH_cm etc.) reuse the EXISTING generic props-chip loop, whose
// `p.unit` is a literal, untranslated abbreviation for every prop in EQUIP_CATS (e.g. vacuum's `bagW`
// already ships `unit:'ס״מ'` with no L() wrapper) — a pre-existing, codebase-wide convention this wave
// does not touch. This test scopes its "no Hebrew leak" assertion to the two things Wave B actually
// authored: the suspect chip's copy (fully L()-paired) and the volumeL chip's unit (L('ליטר','L')).
test('BUG-2e: English mode — suspect chip copy + the volumeL chip unit are fully translated, no Hebrew leak', async ({ page }) => {
  await seedApp(page, {
    'mk-lang': JSON.stringify('en'), 'mk-uilevel-asked': 'true',
    'mk-equipment': JSON.stringify([{ id:'d1', cat:'smoker', type:'ארון / קבינט', name:'Avia 150', cap:{ racks:5, areaCm2:2580, volumeL:387 } }]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof openEquipment==='function'`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev-suspect');
  const suspectText = await page.evaluate(`document.querySelector('#panel .eq-dev-suspect').textContent`);
  expect(suspectText).toContain('Suspicious shelf area');
  expect(suspectText).toContain('Re-check');
  expect(suspectText).not.toMatch(/[֐-׿]/);   // no Hebrew codepoints leaked into English mode
  const chipsText = await page.evaluate(`document.querySelector('#panel .eq-dev-chips').textContent`);
  expect(chipsText).toContain('387');
  expect(chipsText).toContain('L');
  expect(chipsText).not.toContain('ליטר');    // the volumeL unit specifically must translate
  await settled(page);
  await page.screenshot({ path: 'mockups/bug2-suspect-chip-en.png' });
});
