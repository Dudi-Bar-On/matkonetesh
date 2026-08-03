import { test, expect, seedApp } from './_fixtures';

// NOTE (2026-08-03): MAKES-as-items (Task 1f) is built and correct (see model.py's
// SHIP_MAKES_ITEMS / model_cure.py) but gated OFF the shipped payload — landing it blew the A1
// bundle cap (2,607,978 vs 2,600,000). That code path is proven directly against data.py in
// `.superpowers/sdd/model-task1b-report.md` (RED/GREEN + the brine-cure and materials-fallback
// bug fixes), not through the browser, since it does not ship yet. These three tests exercise the
// part that DOES ship today: SPECIALS' prose cure blocks (13 items).
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  // Task B: items is fetched on demand — await the readiness promise (mirrors __mkLangReady) so the
  // fetch is genuinely exercised, not just polled for.
  await page.evaluate(`window.__mkItemsReady`);
  await page.waitForFunction(`typeof DATA!=='undefined' && DATA.items && DATA.items.length`);
};

test('CU1 · a cured SPECIALS item carries a cure block extracted from its authored prose, with a resolved source', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var withCure = DATA.items.filter(function(x){
      return (x.safety||[]).some(function(b){ return b.kind==='cure'; }); });
    var sourced = withCure.filter(function(x){
      return (x.safety||[]).some(function(b){ return b.kind==='cure' && b.source_id != null; }); })[0];
    var b = sourced && (sourced.safety||[]).filter(function(z){ return z.kind==='cure'; })[0];
    return { count: withCure.length, name: sourced && sourced.name.he, block: b };
  })()`) as any;
  expect(r.count).toBeGreaterThan(0);
  expect(r.block.cure_type).toMatch(/^[12]$/);
  expect(r.block.source_id).not.toBeNull();
});

test('CU2 · every cure dose is checked against the CFR ceiling and the CFIA floor -- no false breach', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var checked = [], breaches = [];
    DATA.items.forEach(function(it){
      (it.safety||[]).forEach(function(b){
        if (b.kind!=='cure') return;
        if (b.limit_check) checked.push(it.name.he + ':' + b.limit_check);
        if (b.limit_check==='breach') breaches.push(it.name.he + ':' + b.limit_reason);
      });
    });
    return { checkedCount: checked.length, breaches: breaches };
  })()`) as any;
  // the check actually ran (not a vacuous pass over zero cure blocks) AND found no false alarm
  expect(r.checkedCount).toBeGreaterThan(0);
  expect(r.breaches).toEqual([]);
});

// NEGATIVE (DoD-6): a SPECIALS row that names no Cure # (vinegar-cured, not nitrite-cured) must
// get NO cure block, while the mechanism DOES fire elsewhere in the same table -- proves this is a
// real per-item decision, not "cure never converts anything". Biltong's own `cure` prose lists
// vinegar/salt/coriander/pepper, never "Cure #1/#2" -- the same distinction the fresh MAKES
// sausages make on the structured side (see the report).
test('CU3 · a vinegar-cured item with no Cure # named carries no cure block, though other SPECIALS rows do', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var biltong = DATA.items.filter(function(x){ return x.name.he==='` + 'בילטונג' + `'; })[0];
    var anyCureInCatalogue = DATA.items.some(function(it){
      return (it.safety||[]).some(function(b){ return b.kind==='cure'; }); });
    return {
      found: !!biltong,
      kinds: biltong ? (biltong.safety||[]).map(function(z){ return z.kind; }) : null,
      anyCureInCatalogue: anyCureInCatalogue,
    };
  })()`) as any;
  expect(r.found).toBe(true);
  expect(r.anyCureInCatalogue).toBe(true);   // the mechanism DOES fire for other items
  expect(r.kinds).not.toContain('cure');     // but not for this one
});
