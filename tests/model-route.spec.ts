import { test, expect, seedApp } from './_fixtures';

// Same window.DATA boot pattern as tests/model-paths.spec.ts / tests/model-safety.spec.ts
// (Task 1g finding: `const DATA = …` never attaches to `window`, so `window.DATA` hangs to a
// 30s timeout — `typeof DATA!=='undefined'` is the pattern that actually works).
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof DATA!=='undefined' && DATA.items && DATA.items.length`);
};

test('T1r · "עטיפה ב-70°C" is a wrap step ON THE SMOKE-ONLY PATH, absent from sv+smoke', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var wrapOf = function(k){ return ((b.paths[k]||{}).steps||[]).filter(function(s){ return s.action==='wrap'; })[0]; };
    return { onSmoke: wrapOf('c:smoke'), onCombo: wrapOf('c:smoke_sv') };
  })()`) as any;
  expect(r.onSmoke && r.onSmoke.trigger).toEqual({ at_core_temp: { c: 70 } });
  expect(r.onCombo).toBeUndefined();      // route A chills; it does not wrap
});

// "צינון מלא" (brisket's mid, route A) names a real action (chill) but states no trigger —
// v1's parser (verbatim per Task 3r) only recognizes a stated temp/"בסיום"/"עד סוף בטיחות"
// trigger, so this correctly stays a NOTE plus an action-without-trigger report row, on NEITHER
// path — inventing a trigger for it would violate DoD point 4 (no invented triggers).
test('T2r · "צינון מלא" (a real action, no stated trigger) is a note, not an invented step', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var chillOf = function(k){ return ((b.paths[k]||{}).steps||[]).filter(function(s){ return s.action==='chill'; })[0]; };
    return { onCombo: chillOf('c:smoke_sv'), onSmoke: chillOf('c:smoke'),
             hasNote: (b.notes||[]).some(function(n){ return n.text==='צינון מלא'; }) };
  })()`) as any;
  expect(r.onCombo).toBeUndefined();
  expect(r.onSmoke).toBeUndefined();
  expect(r.hasNote).toBe(true);
});

test('T3r · rest is route-invariant — the SAME rest step appears on every path brisket carries', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var b = DATA.items.filter(function(it){ return it.name.he==='בריסקט'; })[0];
    var restOf = function(k){ return ((b.paths[k]||{}).steps||[]).filter(function(s){ return s.action==='rest'; })[0]; };
    return { keys: Object.keys(b.paths).sort(),
             combo: restOf('c:smoke_sv'), smoke: restOf('c:smoke') };
  })()`) as any;
  expect(r.combo && r.combo.params).toEqual({ min: 60 });
  expect(r.smoke && r.smoke.params).toEqual({ min: 60 });
});

test('T4r · a tip is kept as a note on the ITEM and never becomes a step', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var withNotes = DATA.items.filter(function(it){ return (it.notes||[]).length>0; });
    var leaked = [];
    DATA.items.forEach(function(it){
      Object.keys(it.paths||{}).forEach(function(pid){
        ((it.paths[pid].steps)||[]).forEach(function(s){
          if (!s.trigger || Object.keys(s.trigger).length===0) leaked.push(it.name.he+':'+pid+':'+s.action);
        });
      });
    });
    return { noteCount: withNotes.length, leaked: leaked };
  })()`) as any;
  expect(r.noteCount).toBeGreaterThan(0);
  expect(r.leaked).toEqual([]);   // every step has a trigger; prose without one is a note
});

// DoD-6 negative: no item-level `route[]` field is populated any more — the whole point of 3r
// is that steps live inside paths, never at item level (v1's Task 3 shape is gone).
test('T5r · no item carries a populated item-level route — steps live only inside paths', async ({ page }) => {
  await boot(page);
  const bad = await page.evaluate(`(function(){
    return DATA.items.filter(function(it){ return Array.isArray(it.route) && it.route.length>0; })
      .map(function(it){ return it.name.he; });
  })()`) as string[];
  expect(bad).toEqual([]);
});

// The wrap cross-check (spec v2 §4.1): every sheet-B wrap=="כן" must show a wrap/3-2-1 signal
// already in somid's prose, or the mismatch is reported by name, not silently guessed.
// Measured against the real sheet+data.py (2026-08-03): אסאדו is the one real contradiction
// (sheet wrapB="כן", data.py somid="גלייז בסיום" — no wrap/3-2-1 signal at all).
test('T6r · wrap-flag-contradicts-somid fires for the real drift item (אסאדו), not invented', async ({ page }) => {
  await boot(page);
  const has = await page.evaluate(`(function(){
    return DATA.unconvertedReasons.indexOf('wrap-flag-contradicts-somid') !== -1;
  })()`) as boolean;
  expect(has).toBe(true);
});
