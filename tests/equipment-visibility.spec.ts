import { test, expect } from '@playwright/test';

// Covers three real-usage defects the owner hit in v251:
//  V1-V3  cookerFor dropped the smoke stage to "no device" once a grill was owned alongside a smoker
//  V4-V7  the pit-tools dock ignored an explicit Customize-home toggle below pro level
//  V8-V11 recipe equipment (DATA.cuts[].equip) shipped in the payload but nothing rendered it

const KIT = [
  { id: 'd1', cat: 'smoker', type: 'ארון', name: 'הנפח אביה 150', cap: { racks: 4 }, specSource: 'manual' },
  { id: 'd2', cat: 'grill', type: 'קטל', name: 'וובר קטל', cap: {}, specSource: 'manual' },
  { id: 'd3', cat: 'probe', type: 'פרוב אלחוטי', name: 'MEATER', cap: { channels: 2 }, specSource: 'manual' },
  { id: 'd4', cat: 'other', type: 'knife', name: 'סכין פריסה', cap: {} },
];

const boot = async (page: any, kit: any[] | null = KIT) => {
  await page.addInitScript(([k]: [any[] | null]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    if (k) { localStorage.setItem('mk-equipment', JSON.stringify(k)); localStorage.setItem('mk-equip-set', JSON.stringify(true)); }
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cookerFor==='function' && typeof homeModOn==='function' && typeof equipSectionHtml==='function'`);
};

// ── cookerFor: a purpose-built smoker outranks a grill-that-can-also-smoke ──────────────
test('V1: smoke stage resolves to the smoker, not null, when a grill is also owned', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    return { cands: cookerCandidates('smoke').map(function(d){return d.name;}),
             smoke: (cookerFor('cut-1','smoke')||{}).name || null };
  })()`) as any;
  expect(r.cands).toHaveLength(2);          // the grill is still a candidate (you *can* smoke on it)
  expect(r.smoke).toBe('הנפח אביה 150');    // but the smoker wins the auto-pick
});

test('V2: an explicit assignment still overrides the native-category preference', async ({ page }) => {
  await boot(page);
  const name = await page.evaluate(`(function(){
    setItemCooker('cut-1','smoke','d2');
    return (cookerFor('cut-1','smoke')||{}).name || null;
  })()`);
  expect(name).toBe('וובר קטל');
});

test('V3: two devices of the same class stay ambiguous (needs a pick)', async ({ page }) => {
  await boot(page, [
    { id: 's1', cat: 'smoker', type: 'ארון', name: 'מעשנה א', cap: {}, specSource: 'manual' },
    { id: 's2', cat: 'smoker', type: 'חבית', name: 'מעשנה ב', cap: {}, specSource: 'manual' },
  ]);
  const smoke = await page.evaluate(`(cookerFor('cut-1','smoke')||{}).name || null`);
  expect(smoke).toBeNull();
});

// ── home module gating: an explicit toggle beats the level default ──────────────────────
const dockState = (page: any, level: string, custom: any) => page.evaluate(`(function(){
  store.set('mk-uilevel', ${JSON.stringify(level)});
  store.set('mk-homecustom', ${JSON.stringify(custom)});
  return homeModOn('cHomeDock');
})()`);

test('V4: dock is hidden at mid level by default', async ({ page }) => {
  await boot(page);
  expect(await dockState(page, 'mid', null)).toBe(false);
});

test('V5: an explicit opt-in shows the dock at mid level', async ({ page }) => {
  await boot(page);
  expect(await dockState(page, 'mid', { order: ['cHomeDock'], off: [], on: ['cHomeDock'] })).toBe(true);
});

test('V6: an explicit hide beats the pro-level default', async ({ page }) => {
  await boot(page);
  expect(await dockState(page, 'pro', { order: ['cHomeDock'], off: ['cHomeDock'], on: [] })).toBe(false);
});

test('V7: opting in at mid level actually renders the dock on the home screen', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    store.set('mk-uilevel','mid');
    store.set('mk-homecustom',{order:HOME_MODULES.map(function(m){return m.id;}), off:[], on:['cHomeDock']});
    if(typeof cNavGo==='function') cNavGo('home');
    await new Promise(function(r){setTimeout(r,400);});
    if(typeof cRefreshHome==='function') cRefreshHome();
    await new Promise(function(r){setTimeout(r,600);});
    var dk=document.querySelector('#cHomeDock');
    return { hidden: dk ? dk.hidden : null, off: dk ? dk.classList.contains('home-mod-off') : null,
             tools: dk ? dk.querySelectorAll('.dockbtn').length : 0 };
  })()`) as any;
  expect(r.hidden).toBe(false);
  expect(r.off).toBe(false);
  expect(r.tools).toBeGreaterThan(0);
});

// ── recipe equipment surfaces in the catalog ────────────────────────────────────────────
const openBrisket = async (page: any) => page.evaluate(`(async function(){
  openCut(DATA.cuts.find(function(c){return c.n===1;}));
  await new Promise(function(r){setTimeout(r,700);});
  var s=document.querySelector('.eq-sec');
  return { present: !!s, text: s ? s.innerText : '',
           chips: s ? s.querySelectorAll('.eqc').length : 0,
           need: s ? s.querySelectorAll('.eqc-need').length : 0,
           miss: s ? s.querySelectorAll('.eqc-miss').length : 0,
           specs: s ? [].map.call(s.querySelectorAll('.eq-spec'), function(e){return e.innerText.trim();}) : [] };
})()`) as Promise<any>;

test('V8: the cut card renders an equipment section with chips', async ({ page }) => {
  await boot(page);
  const r = await openBrisket(page);
  expect(r.present).toBe(true);
  expect(r.chips).toBeGreaterThan(5);
  expect(r.need).toBeGreaterThan(0);
});

test('V9: owned vs missing is marked against the user kit', async ({ page }) => {
  await boot(page);
  const r = await openBrisket(page);
  expect(r.text).toContain('מדחום');        // probe — owned
  expect(r.text).toContain('מעשנה');        // smoker — owned
  expect(r.miss).toBeGreaterThan(0);        // e.g. cutting board, sous-vide — not owned
});

test('V10: spec notes render and do not duplicate the base footprint per phase', async ({ page }) => {
  await boot(page);
  const r = await openBrisket(page);
  const area = r.specs.filter((s: string) => s.indexOf('סמ״ר') >= 0);
  expect(area).toHaveLength(1);             // brisket footprint stated once, not per phase
  expect(r.specs.join(' ')).toContain('ל׳'); // sous-vide min bath volume
});

test('V11: no raw vocabulary token leaks to the UI', async ({ page }) => {
  await boot(page);
  const leaked = await page.evaluate(`(async function(){
    var out=[];
    for (var i=0;i<DATA.cuts.length;i++){
      var eq=DATA.cuts[i].equip; if(!eq) continue;
      var toks=[].concat(eq.need||[], eq.opt||[]);
      Object.keys(eq.by||{}).forEach(function(p){ toks=toks.concat(eq.by[p].need||[], eq.by[p].opt||[]); });
      toks.forEach(function(tk){ if(!equipTokenInfo(tk)) out.push(DATA.cuts[i].heb+':'+tk); });
    }
    return out;
  })()`) as string[];
  expect(leaked, `tokens with no label/icon: ${leaked.join(' | ')}`).toEqual([]);
});
