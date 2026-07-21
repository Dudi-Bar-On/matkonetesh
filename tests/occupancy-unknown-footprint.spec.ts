import { test, expect } from '@playwright/test';

// H1 (docs/analysis/2026-07-21-refactoring-report.md §3): itemOccupancy used to end with
// `cm2:Number(spec.footprint_cm2)||0`, so an item with NO recorded footprint (make_equip in
// equipment_map.py never sets footprint_cm2 for a non-hung make) silently contributed 0 cm² to
// a cooker's used area while the device still reported a precise, falsely-low usage %. The
// cardinal rule is "never invent a measurement" — unknown must read as unknown (null), never 0.

const KIT = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }];

const boot = async (page: any, kit: any[] = KIT) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    if (k.length) { localStorage.setItem('mk-equipment', JSON.stringify(k)); localStorage.setItem('mk-equip-set', JSON.stringify(true)); }
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof resolveItem==='function' && typeof itemOccupancy==='function' && typeof DATA==='object'`);
};

// Finds a real footprint-less, non-hung make in the shipped data — never hardcode a make id,
// since the derivation in equipment_map.py could legitimately start filling in a footprint later.
const FIND_UNKNOWN_MAKE = `(function(){
  return Object.keys(DATA.makes).find(function(k){
    var e=DATA.makes[k].equip; var s=e&&e.spec||{};
    return !s.hang && s.footprint_cm2==null;
  });
})()`;

test('U1: itemOccupancy returns a real number for a known footprint, and null (never 0) for an unknown one', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var known=itemOccupancy(resolveItem('cut-1'),'smoke');
    var k=${FIND_UNKNOWN_MAKE};
    var unknown=itemOccupancy(resolveItem('make-'+k),'smoke');
    return { k:k, known:known, unknown:unknown };
  })()`) as any;
  expect(r.k, 'no footprint-less, non-hung make found in DATA.makes').toBeTruthy();
  expect(r.known.mode).toBe('area');
  expect(r.known.cm2).toBe(1320);          // brisket footprint from the recipe equip block
  expect(r.unknown.mode).toBe('area');
  expect(r.unknown.cm2).toBeNull();        // NOT 0 — unknown must read as unknown
});

test('U2: deviceOccupancy sums only known footprints and counts the unknown item separately', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var k=${FIND_UNKNOWN_MAKE};
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    var computed=[ mk('cut-1',0,12,110), mk('make-'+k,0,12,80) ];
    return { k:k, occ:deviceOccupancy('d1', t0+1*3600e3, computed) };
  })()`) as any;
  expect(r.k).toBeTruthy();
  expect(r.occ.items.length).toBe(2);
  expect(r.occ.usedCm2).toBe(1320);              // known-only — the unknown item does NOT vanish as a silent 0
  expect(r.occ.unknownCm2Count).toBe(1);
  const unkItem = r.occ.items.find((i: any) => i.key === 'make-' + r.k);
  expect(unkItem.cm2).toBeNull();                // null flows through into the items list too
});

test('U3: two known-footprint cuts report zero unknowns and an exact (non-floor) percentage', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var t0=Date.parse('2026-07-24T06:00:00');
    var mk=function(key,startH,endH,temp){ return { m:resolveItem(key), stages:[{kind:'smoke', start:new Date(t0+startH*3600e3), end:new Date(t0+endH*3600e3), temp:temp}] }; };
    var computed=[ mk('cut-1',0,12,110), mk('cut-7',6,11,107) ];
    return deviceOccupancy('d1', t0+8*3600e3, computed);
  })()`) as any;
  expect(r.unknownCm2Count).toBe(0);
  expect(r.usedCm2).toBe(1680);          // 1320 + 360, same fixture as O12
  expect(r.pct).toBe(33);                // exact — no floor when nothing is unknown
});

test('U4: the rendered occupancy view marks a floor percentage and notes the unknown-size item', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });   // the app is mobile-first
  // Step 1: a bare boot just to discover a footprint-less make whose OWN default cook method is
  // 'smoke' (MAKE_COOK[cat].methods[0].key==='smoke') — needed because this test drives the real
  // menu -> timeline -> work-plan pipeline, which derives stages from the recipe itself rather
  // than a hand-built fixture.
  await boot(page, []);
  const k = await page.evaluate(`(function(){
    var smokeCats=Object.keys(MAKE_COOK).filter(function(c){ return MAKE_COOK[c].methods[0].key==='smoke'; });
    return Object.keys(DATA.makes).find(function(k){
      var m=DATA.makes[k];
      if(smokeCats.indexOf(m.cat)<0) return false;
      var e=m.equip; var s=e&&e.spec||{};
      return !s.hang && s.footprint_cm2==null;
    });
  })()`) as string;
  expect(k, 'no footprint-less make with a default smoke method found').toBeTruthy();

  // Step 2: re-boot with a real kit + menu containing a known cut (cut-1) and the footprint-less
  // make, both eligible for the sole smoker in the kit (cookerFor auto-assigns — only one candidate).
  await page.addInitScript(([kk]: [string]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify([{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'הנפח', cap: { racks: 4, areaCm2: 6000 } }]));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    localStorage.setItem('mk-menu', JSON.stringify({ guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1', 'make-' + kk], sides: [], drinks: [], desserts: [], gpm: 0 }));
    localStorage.setItem('mk-tlserve', JSON.stringify('19:00'));
  } catch {} }, [k]);
  await page.reload();
  await page.waitForFunction(`typeof openOccupancyView==='function'`);

  await page.evaluate(`openTimeline()`);
  await page.locator('#panel').waitFor({ state: 'visible' });
  await page.locator('#panel').getByText('תוכנית עבודה').first().click();
  await page.locator('[data-occview]').click();
  await expect(page.locator('.occ-wrap')).toBeVisible();

  // Deterministically scrub to the middle of the unknown-footprint make's own smoke stage —
  // read the real computed stage window from window._wpCtx rather than guessing a clock time.
  const scrub = await page.evaluate(`(function(){
    var cx=window._wpCtx||{}, computed=cx.computed||[];
    var c=computed.find(function(x){ return x.m && x.m.key==='make-${k}'; });
    if(!c) return {found:false};
    var s=(c.stages||[]).find(function(st){ return st.kind==='smoke'; });
    if(!s) return {found:false};
    var mid=(s.start.getTime()+s.end.getTime())/2;
    var sl=document.querySelector('#occRange');
    sl.value=String(mid); sl.dispatchEvent(new Event('input',{bubbles:true}));
    return {found:true, mid:mid};
  })()`) as any;
  expect(scrub.found, 'the unknown-footprint make never produced a smoke stage in the real plan').toBe(true);

  const devCard = page.locator('.occ-dev').first();
  await expect(devCard).toBeVisible();
  await expect.poll(async () => (await devCard.locator('.occ-item').count())).toBeGreaterThan(0);

  const text = await devCard.innerText();
  expect(text).toMatch(/≥\d+%/);                                          // floor marker on the bar
  expect(text).toMatch(/ללא מידה ידועה/);                                  // Hebrew unknown-size note
  // the ≥ readout must be an LTR island — without dir="ltr" the RTL bidi flips it to read as "≤26%"
  // (at most), the opposite of the intended floor. This guards that fix.
  await expect(devCard.locator('.occ-bar span')).toHaveAttribute('dir', 'ltr');
});
