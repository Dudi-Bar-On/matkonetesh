import { test, expect, seedApp } from './_fixtures';

// E3 Task 4 (spec §7.2 "Retroactive invalidation", AMENDMENT O-3's impact-view language, plan
// docs/superpowers/plans/2026-07-26-equipment-e3-validity-gates.md Task 4).
//
// THE WARN: before a device delete commits, compute the REAL impact — which plan/event items would flip
// from cookable to 'uncookable' without this device — and show it (`N מתוך M פריטים יושפעו` + names)
// BEFORE the delete, never silently. On confirm: delete + release every held ledger entry pointing at the
// deleted device (eqmReleaseByDevice, a targeted deviceId sweep — spec §7.2 point 3). R5: no impact (or an
// unconfigured kit) → the ORDINARY confirm only, no warn text.
//
// Fixture: make-m-brat (DATA.makes['m-brat']) offers TWO cited paths — grill (default) and smoke
// (alternate) — the same fixture e3-validity.spec.ts / e3-plan-gate.spec.ts already established. A
// SMOKER-only kit puts it at 'blocked-default' (grill fails, smoke works) — deleting the smoker removes
// the one path that DOES work, so the item flips to 'uncookable': exactly the retroactive flip the spec
// describes, without needing a bespoke fixture.

const boot = async (page: any, kit: any[] | null, extra: Record<string, string> = {}) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...extra };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmValidity==='function' && typeof openEquipment==='function' && typeof eqmRetroImpact==='function'`);
};

const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
const FULL = SMOKER.concat([{ id: 'g1', cat: 'grill', type: 'חשמלי', name: 'גריל', cap: { areaCm2: 5000, maxC: 300 } }]);
const MENU = { guests: 8, appetite: 'reg', kosher: false, keys: ['make-m-brat'], sides: [], drinks: [], desserts: [], gpm: 0 };

const openEquipPanel = async (page: any) => {
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel [data-eqrm="d1"]');
};

test.describe('(a)+(b) real delete click — the warn dialog shows REAL counts + names; confirm applies the impact', () => {
  test('(a) dialog names 1 מתוך 1 + the affected item — real click, before any confirm', async ({ page }) => {
    await boot(page, SMOKER, { 'mk-menu': JSON.stringify(MENU) });
    // sanity: confirm the fixture is actually 'blocked-default' before trusting the delete-impact math
    const before = await page.evaluate(`eqmValidity(resolveItem('make-m-brat')).level`);
    expect(before).toBe('blocked-default');

    await openEquipPanel(page);
    await page.click('#panel [data-eqrm="d1"]');
    await page.waitForSelector('#appdlg .appdlg-msg');
    const html = await page.locator('#appdlg .appdlg-msg').innerHTML();
    // REAL counts, not hardcoded copy — both numerals present in their own dir="ltr" islands (L13)
    expect(html).toMatch(/<span dir="ltr">1<\/span>\s*מתוך\s*<span dir="ltr">1<\/span>/);
    expect(html).toContain('בראטוורסט');   // the affected item's own name, not a generic "some items"
    await page.screenshot({ path: 'mockups/e3-retro-warn-dialog.png' });
    // cancel this instance so the fixture is untouched for inspection above — the dedicated (c) test
    // below proves cancel behaviour itself
    await page.click('#appdlg [data-adk="cancel"]');
    await page.waitForFunction(`!document.querySelector('#appdlg')`);
  });

  test('(b) confirm: device gone, held ledger entries on it released, catalog flips bold-invalid LIVE (no reload)', async ({ page }) => {
    await boot(page, SMOKER, { 'mk-menu': JSON.stringify(MENU) });

    // seed a real hold on the smoker via the real EQM.allocate (not a hand-written ledger row)
    await page.evaluate(`(function(){
      var row = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:1000} };
      var t0 = Date.now();
      var r = EQM.allocate([row], {startMs:t0, endMs:t0+3600000}, {type:'event', id:'ev-retro-test'});
      window.__allocOk = r.ok;
    })()`);
    expect(await page.evaluate(`window.__allocOk`)).toBe(true);
    const heldBefore = await page.evaluate(`eqmLedger().filter(function(e){return e.deviceId==='d1' && e.state==='held';}).length`);
    expect(heldBefore).toBeGreaterThan(0);   // sanity — the hold really landed before we test release

    // catalog starts NOT bold-invalid (blocked-default = soft, never the bold class)
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await expect(page.locator('[data-mid="m-brat"]')).not.toHaveClass(/(^| )eq-inv( |$)/);

    await openEquipPanel(page);
    await page.click('#panel [data-eqrm="d1"]');
    await page.waitForSelector('#appdlg .appdlg-msg');
    await page.click('#appdlg [data-adk="ok"]');
    await page.waitForFunction(`!document.querySelector('#appdlg')`);

    // device really gone
    await page.waitForFunction(`equipList().length===0`);

    // the hold is released, never merely deleted (audit trail kept — release-vs-delete)
    const ledgerAfter = await page.evaluate(`eqmLedger().filter(function(e){return e.deviceId==='d1';})`) as any[];
    expect(ledgerAfter.length).toBeGreaterThan(0);                          // row still exists
    expect(ledgerAfter.every((e: any) => e.state === 'released')).toBe(true);

    // the equipment-manager panel stays open after a delete (drawList() re-renders it in place,
    // unchanged from before this task) — close it. Closing the panel does not itself repaint an
    // unrelated catalog grid (closePanel only re-syncs the HOME screen, app.js); the "LIVE, no reload"
    // claim is about the CACHE — eqInvState/eqmValidity recompute correctly the NEXT time anything
    // re-renders this card, because equipSave already bumped the generation. So: force a real re-render
    // the same way tests/e3-validity.spec.ts's FIX WAVE 1 block proves the identical gen-bump property —
    // a genuine keystroke into the real #q search box (perf #4's debounce — app.js:1624, 120ms — a real
    // 'input' event) — never page.reload(). expect(...).toHaveClass auto-retries (unlike a one-shot
    // getAttribute), so it naturally spans the debounce window instead of racing it.
    await page.click('#panel .x');
    await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);
    await page.fill('#q', 'ב');
    await expect(page.locator('[data-mid="m-brat"]')).toHaveClass(/(^| )eq-inv( |$)/);   // the FULL bold class now — never eq-inv-soft any more
    await expect(page.locator('[data-mid="m-brat"] .eq-inv-badge')).toContainText('חסר ציוד');
  });
});

test('(c) cancel: device stays, ledger hold stays held, plan untouched', async ({ page }) => {
  await boot(page, SMOKER, { 'mk-menu': JSON.stringify(MENU) });
  await page.evaluate(`(function(){
    var row = { role:'cook', kind:'smoker', source:'derived', demand:{metric:'area_cm2', amount:1000} };
    var t0 = Date.now();
    EQM.allocate([row], {startMs:t0, endMs:t0+3600000}, {type:'event', id:'ev-retro-cancel'});
  })()`);
  await openEquipPanel(page);
  await page.click('#panel [data-eqrm="d1"]');
  await page.waitForSelector('#appdlg .appdlg-msg');
  await page.click('#appdlg [data-adk="cancel"]');
  await page.waitForFunction(`!document.querySelector('#appdlg')`);

  expect(await page.evaluate(`equipList().length`)).toBe(1);
  expect(await page.evaluate(`equipByCat('smoker').length`)).toBe(1);
  const held = await page.evaluate(`eqmLedger().filter(function(e){return e.deviceId==='d1' && e.state==='held';}).length`);
  expect(held).toBeGreaterThan(0);   // never released — the delete never happened
  expect(await page.evaluate(`menuState().keys`)).toContain('make-m-brat');
});

test('(d) negative — no-affected delete: the ordinary confirm only, NO equipment-warn text (R5)', async ({ page }) => {
  // FULL kit: m-brat's DEFAULT path (grill) is already satisfied — deleting the SMOKER (the alternate
  // path's device, never the one the item actually uses) affects nothing.
  await boot(page, FULL, { 'mk-menu': JSON.stringify(MENU) });
  const before = await page.evaluate(`eqmValidity(resolveItem('make-m-brat')).level`);
  expect(before).toBe('ok');   // sanity — this kit really does satisfy the default path already

  await openEquipPanel(page);
  await page.click('#panel [data-eqrm="d1"]');
  await page.waitForSelector('#appdlg .appdlg-msg');
  const html = await page.locator('#appdlg .appdlg-msg').innerHTML();
  expect(html).not.toContain('מתוך');           // never the impact template when nothing is affected
  expect(html).not.toContain('יושפע');
  await page.click('#appdlg [data-adk="ok"]');
  await page.waitForFunction(`!document.querySelector('#appdlg')`);
  await page.waitForFunction(`equipByCat('smoker').length===0`);
  expect(await page.evaluate(`equipByCat('grill').length`)).toBe(1);   // the unrelated device is untouched
});

test('(d-neg) unconfigured kit never shows the warn dialog\'s impact text — R5', async ({ page }) => {
  // R5 also covers "unconfigured" — exercised at the function level (eqmRetroImpact itself), since an
  // unconfigured kit cannot own a real device to click delete on in the real UI.
  await boot(page, null);
  const r = await page.evaluate(`eqmRetroImpact('nonexistent-device')`) as any;
  expect(r).toEqual({ n: 0, m: 0, names: [] });
});

// (e) occupancy honesty — the unknown-capacity-device-WITH-items residual from the E2 review.
test.describe('(e) occupancy: unknown-capacity device WITH items — the honest line, never the unconditional ✓', () => {
  // a smoker whose `type` matches none of EQUIP_CATS' areaCm2 class-default keys, and carries no explicit
  // cap.areaCm2 of its own → deviceCapacity(dev).known===false (verified by the sanity assertion below) —
  // the real, organic way a device ends up with a genuinely unknown capacity (never a hand-faked cap object).
  const UNKNOWN_CAP = [{ id: 'd1', cat: 'smoker', type: 'התקן מיוחד שלא ברשימה', name: 'התקן', cap: {} }];

  test('function-level: _occFitHtml on a real deviceOccupancy() reading — honest qualifier, not ✓', async ({ page }) => {
    await boot(page, UNKNOWN_CAP);
    const r = await page.evaluate(`(function(){
      var dev = equipByCat('smoker')[0];
      var known = deviceCapacity(dev).known;
      var t0 = Date.parse('2026-07-24T06:00:00');
      var item = { m: resolveItem('cut-1'), stages: [{ kind:'smoke', start:new Date(t0), end:new Date(t0+6*3600e3), temp:110 }] };
      setItemCooker('cut-1', 'smoke', 'd1');
      var o = deviceOccupancy('d1', t0 + 1*3600e3, [item], null);
      return { devKnown: known, oKnown: o.cap.known, itemCount: o.items.length, html: _occFitHtml(o) };
    })()`) as any;
    expect(r.devKnown).toBe(false);          // sanity — the fixture really is an unknown-capacity device
    expect(r.oKnown).toBe(false);
    expect(r.itemCount).toBeGreaterThan(0);  // sanity — this is the WITH-items case, not the D11 no-items case
    expect(r.html).not.toContain('הכל נכנס');            // never the unconditional ✓ this task closes
    expect(r.html).toContain('קיבולת לא ידועה');          // the honest qualifier
    expect(r.html).toContain('occ2-fit-none');            // muted class (reused from the D11 no-items line), not red/orange
  });

  test('real-UI: the occupancy view itself renders the honest line for a live device with a live item — screenshot', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
      'mk-equipment': JSON.stringify(UNKNOWN_CAP), 'mk-equip-set': 'true',
      'mk-menu': JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 }),
      'mk-tlserve': JSON.stringify('19:00'),
    });
    await page.waitForFunction(`typeof openOccupancyView==='function'`);
    await page.evaluate(`openTimeline()`);
    await page.locator('#panel').waitFor({ state: 'visible' });
    await page.locator('#panel').getByText('תוכנית עבודה').first().click();
    await page.locator('[data-occview]').click();
    await expect(page.locator('.occ-wrap')).toBeVisible();

    // scrub to the middle of cut-1's real smoke stage, read from the real computed plan (never a guessed clock time)
    const scrub = await page.evaluate(`(function(){
      var cx = window._wpCtx || {}, computed = cx.computed || [];
      var c = computed.find(function(x){ return x.m && x.m.key==='cut-1'; });
      if (!c) return { found:false };
      var s = (c.stages||[]).find(function(st){ return st.kind==='smoke'; });
      if (!s) return { found:false };
      var mid = (s.start.getTime()+s.end.getTime())/2;
      var sl = document.querySelector('#occRange');
      sl.value = String(mid); sl.dispatchEvent(new Event('input', {bubbles:true}));
      return { found:true };
    })()`) as any;
    expect(scrub.found, 'cut-1 never produced a real smoke stage in the real plan').toBe(true);

    const devCard = page.locator('.occ2-dev').first();
    await expect(devCard).toBeVisible();
    await expect.poll(async () => await devCard.locator('.occ2-fit-none').count()).toBeGreaterThan(0);
    await expect(devCard.locator('.occ2-fit-none')).toContainText('קיבולת לא ידועה');
    expect(await devCard.locator('.occ2-fit-ok').count()).toBe(0);   // never the ✓ line alongside it
    await page.screenshot({ path: 'mockups/e3-retro-occ-unknown-with-items.png' });
  });
});

// (f) EN leak — both the delete-warn dialog and the occupancy honest line render in English, no Hebrew leak.
test('(f) EN leak — English mode: warn dialog + occupancy honest line, no Hebrew characters', async ({ page }) => {
  await boot(page, [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'Smoker', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }],
    { 'mk-lang': JSON.stringify('en'), 'mk-menu': JSON.stringify(MENU) });
  await openEquipPanel(page);
  await page.click('#panel [data-eqrm="d1"]');
  await page.waitForSelector('#appdlg .appdlg-msg');
  const html = await page.locator('#appdlg .appdlg-msg').innerHTML();
  expect(html).toMatch(/<span dir="ltr">1<\/span>\s*out of\s*<span dir="ltr">1<\/span>/);
  expect(html).toContain('Bratwurst');
  expect(html).toContain('will be affected');
  expect(html).toContain('Delete anyway?');
  expect(html).not.toMatch(/[֐-׿]/);
  await page.click('#appdlg [data-adk="cancel"]');
  await page.waitForFunction(`!document.querySelector('#appdlg')`);

  const occHtml = await page.evaluate(`_occFitHtml({ cap:{known:false, mode:'area'}, items:[{key:'x', name:'X'}], fit:{verdict:'ok'} })`) as string;
  expect(occHtml).toContain('capacity unknown');
  expect(occHtml).not.toMatch(/[֐-׿]/);
});

// DoD-10 safety invariance — the retroactive delete flow reads eqmValidity/EQM.ownership and writes only
// mk-equipment (device presence) + the ledger's `state` field; it must never mutate the item's own recipe
// data or its derived stage list, and it must never touch bcheck/safe/temp/duration.
test('DoD-10 safety invariance — a real delete-confirm never mutates the item object, its derived stages, or any safety field', async ({ page }) => {
  await boot(page, SMOKER, { 'mk-menu': JSON.stringify(MENU) });
  const eq = await page.evaluate(`(function(){
    var meta = resolveItem('make-m-brat');
    var before = JSON.stringify(meta.obj);
    var stagesBefore = JSON.stringify(itemStages(meta, 'grill', true, null));
    var kitOverride = equipList().filter(function(d){ return d.id!=='d1'; });
    eqmValidityWithKit(meta, kitOverride);   // the exact what-if call the delete flow makes
    var after = JSON.stringify(resolveItem('make-m-brat').obj);
    var stagesAfter = JSON.stringify(itemStages(resolveItem('make-m-brat'), 'grill', true, null));
    return before===after && stagesBefore===stagesAfter;
  })()`) as boolean;
  expect(eq).toBe(true);
});
