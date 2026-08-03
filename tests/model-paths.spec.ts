import { test, expect, seedApp } from './_fixtures';

// NOTE (plan deviation): the plan's own Task 1g snippet waits on `window.DATA`. `const DATA = …`
// at script scope never attaches to `window` (unlike `var`) — so `window.DATA` is permanently
// `undefined` and this predicate can never fire, hanging every test to the 30s timeout. Task 1's
// own test file (model-safety.spec.ts) avoided the bug by testing `typeof DATA!=='undefined'`
// instead; matched here. Confirmed via a standalone Playwright probe against the same served
// page: `window.DATA` was undefined while a bare `DATA.items` evaluate returned 177 items.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof DATA!=='undefined' && DATA.items && DATA.items.length`);
};

test('PA1 · brisket carries TWO paths with their own legs, keyed by itemPaths ids', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var ab = b.paths && b.paths['c:smoke_sv'], sb = b.paths && b.paths['c:smoke'];
    return { keys: b.paths ? Object.keys(b.paths).sort() : null,
             svLeg: ab && ab.legs && ab.legs.sv,           // ← data.svt/svh, MOVED not rewritten
             soLeg: sb && sb.legs && sb.legs.smoke,        // ← data.sot/soh
             tgtB:  sb && sb.texture && sb.texture.target_c };
  })()`) as any;
  expect(r.keys).toContain('c:smoke_sv');
  expect(r.keys).toContain('c:smoke');
  expect(r.svLeg).toEqual({ t: 68, h: '30' });   // exactly data.py's svt/svh upper (DoD-10: moved)
  expect(r.soLeg).toEqual({ t: 110, h: '12' });
  expect(r.tgtB).toBe(95);                        // R-79: 95 stays, ON ITS PATH
});

// PA2 — deviates from the plan's static regex (`^c:(sv|smoke|grill)...$`): measured against the
// real app, SPECIALS' itemProfile('spec') branch (app.js:4390) always returns a single method
// with the LITERAL key 'smoke' (no 'c:' prefix) — a static 'c:' regex would reject a legitimate
// SPECIALS path id as "invented" when it is exactly what itemPaths emits for that table. The
// real contract is "every paths key is a key itemPaths(meta) actually emits for THIS item" — so
// this test resolves each item back to its app.js meta (via resolveItem) and asks itemPaths
// itself, rather than approximating its vocabulary with a hand-written pattern.
test('PA2 · every path key is an id itemPaths can emit for THAT item — no invented vocabulary', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    var out = [];
    DATA.items.forEach(function(it){
      var ref = it.legacy_ref;
      if (!ref) return;
      var legacyKey = ref.table === 'cuts' ? ('cut-' + ref.n) : ('spec-' + ref.n);
      var meta = resolveItem(legacyKey);
      if (!meta) { out.push(it.name.he + ':unresolvable-legacy-key'); return; }
      var validIds = itemPaths(meta).map(function(p){ return p.id; });
      Object.keys(it.paths || {}).forEach(function(k){
        if (validIds.indexOf(k) === -1) out.push(it.name.he + ':' + k + ' (valid=' + validIds.join(',') + ')');
      });
    });
    return out;
  })()`) as string[];
  expect(bad).toEqual([]);
});

// NEGATIVE (DoD-6): an item the sheet never described (a vegetable) gets NO sheet-derived path fields.
test('PA3 · corn carries no smoke-only path fabricated from a sheet it was never in', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var c = DATA.items.filter(function(it){ return it.name.he==='תירס'; })[0];
    var p = (c.paths||{})['c:smoke'];
    return { hasSheetTexture: !!(p && p.texture && p.texture.provenance==='owner-sheet') };
  })()`) as any;
  expect(r.hasSheetTexture).toBe(false);
});
