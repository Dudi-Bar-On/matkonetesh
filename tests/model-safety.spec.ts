import { test, expect, seedApp } from './_fixtures';

// Task B: `items` is no longer inlined in DATA_JSON — app.js fetches dist/items.json on demand and
// resolves window.__mkItemsReady once DATA.items is hydrated (mirrors window.__mkLangReady, Dec-A1).
// Awaiting the promise (rather than polling DATA.items.length) is what proves the fetch actually
// happened, not merely that the value eventually appears.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.evaluate(`window.__mkItemsReady`);
  await page.waitForFunction(`typeof DATA!=='undefined' && DATA.items && DATA.items.length`);
};

// B1 · the load path is genuinely exercised: items.json is fetched over the network (not just
// present because it was inlined), and the readiness promise resolves with every item DATA ends up
// holding — proof the promise's resolution IS what populates DATA.items, not a coincidence of timing.
test('B1 · items.json is actually fetched, and __mkItemsReady resolves with the loaded catalogue', async ({ page }) => {
  const respPromise = page.waitForResponse((r: any) => /\/items\.json(\?|$)/.test(r.url()));
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  const resp = await respPromise;
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  const resolved = await page.evaluate(`window.__mkItemsReady.then(function(items){ return items.length; })`);
  expect(resolved).toBe(body.length);
  expect(resolved).toBeGreaterThan(0);
  const live = await page.evaluate(`DATA.items.length`);
  expect(live).toBe(resolved);
});

test('M1 · every produce row carries an EMPTY safety list, not a zero', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var byName = {};
    DATA.items.forEach(function(it){ byName[it.name.he] = it; });
    var corn = byName['תירס'];
    return { hasCorn: !!corn,
             safety: corn ? corn.safety : null,
             anyZeroAnywhere: DATA.items.some(function(it){
               return (it.safety||[]).some(function(b){ return b.kind==='thermal' && Number(b.instant_c)===0; });
             }) };
  })()`) as any;
  expect(r.hasCorn).toBe(true);
  expect(r.safety).toEqual([]);          // the empty list IS the answer
  expect(r.anyZeroAnywhere).toBe(false); // no sentinel survived anywhere
});

test('M2 · brisket keeps its cited 63°C, unchanged, with a source', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var th = (b.safety||[]).filter(function(x){ return x.kind==='thermal'; })[0];
    return { instant: th && th.instant_c, src: th && th.source_id, target: b.texture && b.texture.target_c };
  })()`) as any;
  expect(r.instant).toBe(63);      // DoD-10: MOVED, never changed
  expect(r.target).toBe(95);       // R-79: 94/95°C stays exactly as authored
  expect(r.src).not.toBeNull();
});

test('M3 · a tgt with no source is flagged craft, never silently promoted', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    return DATA.items.filter(function(it){
      return it.texture && it.texture.target_c != null
          && it.texture.source_id == null
          && it.texture.provenance !== 'craft';
    }).map(function(it){ return it.name.he; });
  })()`) as string[];
  expect(bad).toEqual([]);
});

// NEGATIVE (DoD-6): a row whose `safe` is ABSENT is not the same as one whose `safe` is 0.
test('M4 · an absent safe and a zero safe are distinguishable in the report', async ({ page }) => {
  await boot(page);
  const kinds = await page.evaluate(`(function(){
    var m = {};
    (DATA.unconvertedReasons||[]).forEach(function(r){ m[r] = (m[r]||0)+1; });
    return m;
  })()`) as Record<string, number>;
  expect(Object.keys(kinds)).toContain('safe-not-applicable');
  expect(Object.keys(kinds)).toContain('safe-absent');
});

// Regression net for the id-collision bug found while implementing Task 1: CUTS and SPECIALS both
// number their rows n=1.. independently (47-way overlap measured against real data.py), so a bare
// `id: row.n` silently collapses two different items onto one id.
test('M5 · item ids are unique across the whole catalogue (cuts + specials do not collide)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var ids = DATA.items.map(function(it){ return it.id; });
    var uniq = {};
    ids.forEach(function(id){ uniq[id] = (uniq[id]||0)+1; });
    var dupes = Object.keys(uniq).filter(function(k){ return uniq[k] > 1; });
    return { total: ids.length, uniqueCount: Object.keys(uniq).length, dupes: dupes };
  })()`) as any;
  expect(r.dupes).toEqual([]);
  expect(r.uniqueCount).toBe(r.total);
});
