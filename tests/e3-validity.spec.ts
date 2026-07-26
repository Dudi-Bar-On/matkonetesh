import { test, expect, seedApp } from './_fixtures';

// E3 Task 1 (spec §5.2 + AMENDMENT O-5, plan docs/superpowers/plans/2026-07-26-equipment-e3-validity-gates.md).
// eqmValidity(meta) fuses E1's EQM.ownership with CP1's itemPaths into the two O-5 honesty levels: the
// catalog's bold-invalid treatment (uncookable = full emphasis + "חסר ציוד" badge; blocked-default =
// lighter emphasis, no badge — "prevents crying wolf on an item the user can in fact cook another cited
// way") and the item panel's why-and-how-to-fix explanation.
//
// Fixture: make-m-brat (DATA.makes['m-brat'], cat 'נקניקיות' — the MAKE_COOK fresh-sausage profile) offers
// TWO independent cited paths with DIFFERING device-kind requirements — grill (default, index 0) and
// smoke (alternate, index 1) — the cleanest real fixture for exercising both honesty levels without
// touching the cook-engine's combo-validity rules. cut-1 (sv+smoke default) is used separately to prove
// gap dedup across a default combo that touches TWO device kinds at once.

const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmValidity==='function' && typeof equipConfigured==='function' && typeof itemPaths==='function'`);
};

const BATH   = [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [20] } }];
const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
// non-charcoal type — deliberately NOT in cookerCandidates('smoke')'s charcoal/kettle/gas merge list, so
// this kit's grill-ownership never accidentally also counts as a smoker candidate.
const FULL = SMOKER.concat([{ id: 'g1', cat: 'grill', type: 'חשמלי', name: 'גריל', cap: { areaCm2: 5000, maxC: 300 } }]);

// ── sanity: confirm the fixture really offers a grill-default + smoke-alternate cited path pair before
// trusting any level assertion built on it (never take the data's shape on faith) ─────────────────────
test('sanity — make-m-brat offers a grill-default + smoke-alternate cited path pair', async ({ page }) => {
  await boot(page, null);
  const paths = await page.evaluate(`itemPaths(resolveItem('make-m-brat'))`) as any[];
  expect(paths.map(p => p.methodKey)).toEqual(['grill', 'smoke']);
  expect(paths[0].isDefault).toBe(true);
  expect(paths[1].label).toContain('עישון קצר');
});

test.describe('eqmValidity(meta) — the contract shape', () => {
  test('(d) negative — unconfigured kit: always ok, zero equipment noise (R5)', async ({ page }) => {
    await boot(page, null);
    expect(await page.evaluate(`equipConfigured()`)).toBe(false);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v).toEqual({ level: 'ok', okPaths: [], gaps: [], fixes: [] });
  });

  test('a fully-equipped kit (owns both device kinds): ok, no gaps, no fixes', async ({ page }) => {
    await boot(page, FULL);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v.level).toBe('ok');
    expect(v.gaps).toEqual([]);
    expect(v.fixes).toEqual([]);
  });

  test('(a) uncookable — a kit satisfying NEITHER path: level uncookable, no switch-path fix', async ({ page }) => {
    await boot(page, BATH);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v.level).toBe('uncookable');
    expect(v.okPaths).toEqual([]);
    // the DEFAULT path here is grill-only (a single-stage method) — its own gap is exactly 'grill',
    // never 'smoker' (that belongs to the OTHER path, not the default's own missing/partial rows).
    expect(v.gaps).toEqual([{ kind: 'grill', state: 'missing' }]);
    expect(v.fixes.map((f: any) => f.type)).toEqual(['configure', 'replace-e5']);   // no switch-path — nothing works
  });

  test('(c) blocked-default — the default (grill) path fails but the smoke alternate works', async ({ page }) => {
    await boot(page, SMOKER);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v.level).toBe('blocked-default');
    expect(v.okPaths).toEqual(['smoke']);
    expect(v.gaps).toEqual([{ kind: 'grill', state: 'missing' }]);
    const switchFix = v.fixes.find((f: any) => f.type === 'switch-path');
    expect(switchFix).toBeTruthy();
    expect(switchFix.pathId).toBe('smoke');
    expect(switchFix.label).toContain('עישון קצר');
    expect(v.fixes.map((f: any) => f.type)).toEqual(['configure', 'switch-path', 'replace-e5']);
  });

  test('multi-gap dedup — a default combo touching TWO device kinds (cut-1, sv+smoke) surfaces both, deduped', async ({ page }) => {
    await boot(page, []);   // configured, but owns literally nothing
    const v = await page.evaluate(`eqmValidity(resolveItem('cut-1'))`) as any;
    expect(v.level).toBe('uncookable');
    const kinds = v.gaps.map((g: any) => g.kind).sort();
    expect(kinds).toEqual(['bath', 'smoker']);
    expect(v.gaps.every((g: any) => g.state === 'missing')).toBe(true);
  });

  // CP2-INPUT (binding, from CP1 review): itemPaths[].isDefault is session/gear-dependent and must NEVER
  // be read as "the recipe default" — flipping isDefault on every path must not change the verdict.
  test('CP2-INPUT negative — level determination never reads itemPaths[].isDefault', async ({ page }) => {
    await boot(page, SMOKER);
    const level = await page.evaluate(`(function(){
      var meta = resolveItem('make-m-brat');
      var orig = itemPaths;
      window.itemPaths = function(m){ return orig(m).map(function(p,i){ return Object.assign({}, p, { isDefault: i!==0 }); }); };
      var v = eqmValidity(meta);
      window.itemPaths = orig;
      return v.level;
    })()`);
    expect(level).toBe('blocked-default');   // unaffected by isDefault having been flipped
  });

  test('DoD-10 safety invariance — eqmValidity never mutates the item object', async ({ page }) => {
    await boot(page, BATH);
    const eq = await page.evaluate(`(function(){
      var before = JSON.stringify(resolveItem('make-m-brat').obj);
      eqmValidity(resolveItem('make-m-brat')); eqmValidity(resolveItem('make-m-brat'));
      return before === JSON.stringify(resolveItem('make-m-brat').obj);
    })()`) as boolean;
    expect(eq).toBe(true);
  });
});

test.describe('catalog + item-panel UI (real clicks)', () => {
  test('(a)+(e) uncookable catalog card: bold-invalid class + חסר ציוד badge — screenshot', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveClass(/eq-inv\b/);
    await expect(card.locator('.eq-inv-badge')).toContainText('חסר ציוד');
    await page.screenshot({ path: 'mockups/e3-catalog-bold-invalid.png' });
  });

  test('(c) blocked-default catalog card: SOFT class, no badge — screenshot', async ({ page }) => {
    await boot(page, SMOKER);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    const cls = await card.getAttribute('class');
    expect(cls).toContain('eq-inv-soft');
    expect(cls).not.toMatch(/(^| )eq-inv( |$)/);   // never the bold class at the same time
    expect(await card.locator('.eq-inv-badge').count()).toBe(0);
    await page.screenshot({ path: 'mockups/e3-catalog-blocked-default.png' });
  });

  test('(d) negative — unconfigured kit: no bold-invalid treatment anywhere on the card', async ({ page }) => {
    await boot(page, null);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    const cls = await card.getAttribute('class');
    expect(cls).not.toContain('eq-inv');
    expect(await card.locator('.eq-inv-badge').count()).toBe(0);
  });

  test('(b) the why/fix panel — uncookable: WHY names the missing kind, fixes = configure + replace-e5 only — screenshot', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    const panel = page.locator('#panel .eq-inv-panel');
    const panelCls = await panel.getAttribute('class');
    expect(panelCls).not.toContain('eq-inv-panel-soft');
    const why = await panel.locator('.eq-inv-why').innerText();
    expect(why).toContain('דרוש: גריל/אש');
    expect(await panel.locator('[data-eqfix="configure"]').count()).toBe(1);
    expect(await panel.locator('[data-eqfix="switch-path"]').count()).toBe(0);
    expect(await panel.locator('[data-eqfix="replace-e5"]').count()).toBe(1);
    await expect(panel.locator('[data-eqfix="replace-e5"]')).toBeDisabled();
    await page.locator('#panel').screenshot({ path: 'mockups/e3-panel-uncookable.png' });
  });

  test('(c) the why/fix panel — blocked-default: soft class, switch-path names the working path — screenshot', async ({ page }) => {
    await boot(page, SMOKER);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    const panel = page.locator('#panel .eq-inv-panel');
    const panelCls = await panel.getAttribute('class');
    expect(panelCls).toContain('eq-inv-panel-soft');
    const switchBtn = panel.locator('[data-eqfix="switch-path"]');
    await expect(switchBtn).toContainText('עישון קצר');
    await expect(switchBtn).toContainText('זמין במסלול');
    await page.locator('#panel').screenshot({ path: 'mockups/e3-panel-blocked-default.png' });
  });

  test('(d) negative — unconfigured kit: no why/fix panel at all when the item is opened', async ({ page }) => {
    await boot(page, null);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel #methodArea');
    expect(await page.locator('#panel .eq-inv-panel').count()).toBe(0);
  });

  test('the configure fix deep-links to the Equipment Manager', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    await page.click('#panel [data-eqfix="configure"]');
    await page.waitForFunction(() => !document.querySelector('#panel .eq-inv-panel') && !!document.querySelector('#panel .eq-wrap'));
  });
});

test.describe('umake generator-panel surface (E3-input, T1 surface list)', () => {
  const UMAKE_KEY = 'umake-t1';
  const seedUmake = { [UMAKE_KEY]: { heb: 'נקניקיית בדיקה', eng: 'Test sausage', cat: 'נקניקיות', diff: 2, build: { materials: [], phases: [], intro: '' }, ai: true } };

  test('(e) an umake row gets the same bold-invalid treatment as the catalog card', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
      'mk-equipment': JSON.stringify(BATH), 'mk-equip-set': 'true',
      'mk-gemkey': JSON.stringify('test-key'),
      'mk-umakes': JSON.stringify(seedUmake),
    });
    await page.waitForFunction(`typeof openRecipeGen==='function'`);
    await page.evaluate(`openRecipeGen()`);
    await page.waitForSelector(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const row = page.locator(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const cls = await row.getAttribute('class');
    expect(cls).toContain('eq-inv');
    await expect(row.locator('.eq-inv-badge')).toContainText('חסר ציוד');
    await page.locator('#panel').screenshot({ path: 'mockups/e3-umake-panel-bold-invalid.png' });
  });

  test('negative — a fully-equipped kit renders the umake row with no bold-invalid treatment', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
      'mk-equipment': JSON.stringify(FULL), 'mk-equip-set': 'true',
      'mk-gemkey': JSON.stringify('test-key'),
      'mk-umakes': JSON.stringify(seedUmake),
    });
    await page.waitForFunction(`typeof openRecipeGen==='function'`);
    await page.evaluate(`openRecipeGen()`);
    await page.waitForSelector(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const row = page.locator(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const cls = await row.getAttribute('class');
    expect(cls).not.toContain('eq-inv');
    expect(await row.locator('.eq-inv-badge').count()).toBe(0);
  });
});

// ── (f) EN leak + L13 ─────────────────────────────────────────────────────────────────────────────
// Scoped to this task's OWN authored copy (title, gap-state text, configure/replace-e5 fix labels) via
// the UNCOOKABLE state, which carries no switch-path row — sidesteps a pre-existing, out-of-scope gap:
// itemPaths()/MAKE_COOK's path labels (e.g. 'עישון קצר') are plain Hebrew literals with no L() wrapping,
// so a switch-path fix's appended <path label> is not itself localized; that inherited data limitation
// is unrelated to eqmValidity/eqInvPanelHtml, which localize every string THEY author correctly.
test('(f) EN leak + L13 — English mode: own-authored panel copy in English, no Hebrew leak, no bare numerals', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en'),
    'mk-equipment': JSON.stringify(BATH), 'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof eqInvPanelHtml==='function'`);
  const html = await page.evaluate(`eqInvPanelHtml(resolveItem('make-m-brat'))`) as string;
  expect(html).toContain('This item cannot be cooked with your equipment');
  expect(html).toContain('Requires: Grill');
  expect(html).toContain('missing');
  expect(html).toContain('Add/configure equipment in Equipment Management');
  expect(html).toContain('Equipment replacement');
  expect(html).not.toMatch(/[֐-׿]/);   // zero Hebrew characters anywhere in the panel

  const badgeHtml = await page.evaluate(`eqInvState('make-m-brat').badge`) as string;
  expect(badgeHtml).toContain('Missing equipment');
  expect(badgeHtml).not.toMatch(/[֐-׿]/);

  // L13 applicability check: the concern is bidi flipping a NUMERIC READOUT's visual order inside
  // Hebrew RTL prose (e.g. "≥12 L" reading as "≤"). The O-5 gaps/fixes contract carries no measured
  // numerals at all — the only digit anywhere in this panel is the literal milestone label "(E5)" in
  // the replace-e5 placeholder, which is plain ASCII, never embedded in Hebrew RTL context here (this
  // very assertion runs in English/LTR mode), and reads identically forwards or backwards — not a
  // numeric-readout bidi hazard L13 exists to catch. Documented, not asserted as a no-digit rule.
  expect(html).toContain('(E5)');
});

// ═══ FIX WAVE 1 (2026-07-26, E3 Task 1 review "Important") — generation-stamped memoization ═══════
// eqmValidity/eqInvState ran 3-4 uncached ownership computations PER CARD on the catalog grid's
// per-keystroke re-render path (perf #4's debounce, app.js:1581 — ~279 cards). This block proves:
//   (i)   a re-render with an UNCHANGED kit computes ZERO ownership the second time (cache hit);
//   (ii)  a REAL equipment-form save (equipSave, the one mutation choke point) bumps the generation
//         and the next render recomputes for real — not just "recomputes", but recomputes CORRECTLY.
// (iii, the existing-18-tests-stay-green requirement) is proven by leaving every test above untouched.
test.describe('FIX WAVE 1 — generation-stamped ownership memoization', () => {
  test('cache proof — an unchanged-kit re-render computes ZERO ownership; a REAL equipment-form save invalidates it', async ({ page }) => {
    await boot(page, BATH);

    // Instrument the REAL EQM.ownership + render (both top-level bindings the app itself calls bare,
    // same monkeypatch technique the CP2-INPUT test above already uses on itemPaths) — counts every
    // ownership computation and marks when a render pass has completed, so the waits below are on
    // OBSERVABLE conditions, never a fixed timeout. Installed BEFORE the first catalog render (not
    // after) — installing it after would let that first, un-measured render already warm the cache for
    // every card, making the "first" measured render a false cache-hit instead of the real cold start.
    await page.evaluate(`(function(){
      window.__eqmOwnCalls = 0; window.__renderCalls = 0;
      var origOwn = EQM.ownership;
      EQM.ownership = function(){ window.__eqmOwnCalls++; return origOwn.apply(EQM, arguments); };
      var origRender = render;
      window.render = function(){ var r = origRender.apply(this, arguments); window.__renderCalls++; return r; };
    })()`);

    // RENDER A — a REAL click into the מלאכה category tile (the group m-brat lives in): the very FIRST
    // render of every card in the group under this kit's generation → must compute real ownership.
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.waitForFunction(`window.__renderCalls>=1`);
    expect(await page.locator('[data-mid="m-brat"]').count()).toBe(1);   // fixture check — never take the filtered set on faith
    const own1 = await page.evaluate(`window.__eqmOwnCalls`) as number;
    expect(own1).toBeGreaterThan(0);

    // RENDER B — a REAL keystroke in the REAL #q search input (fill() dispatches a genuine 'input'
    // event through the app's own perf #4 debounce; not a direct catView()/render() call), narrowing
    // the SAME group to a SUBSET of render A's cards — every key it renders was already primed by
    // render A, so a warm cache must serve every one of them for free. RED WITNESS (see the fix-wave
    // report section): on pre-fix app.js this assertion FAILS (own2 > 0) because eqInvState/
    // eqmRequiresChip recomputed ownership from scratch on every single render, cache or not.
    await page.evaluate(`window.__eqmOwnCalls=0; window.__renderCalls=0;`);
    await page.fill('#q', 'א');
    await page.waitForFunction(`window.__renderCalls>=1`);
    expect(await page.locator('[data-mid="m-brat"]').count()).toBe(1);   // still in the (narrowed) result set
    const own2 = await page.evaluate(`window.__eqmOwnCalls`) as number;
    expect(own2).toBe(0);

    const genBefore = await page.evaluate(`eqmKitGen()`) as number;

    // GEN-BUMP — mutate the kit through the REAL equipment-manager form (not equipSave() called
    // directly): add a grill, the device kind m-brat's DEFAULT (grill) path is missing under BATH.
    await page.evaluate(`openEquipment()`);
    await page.waitForSelector('#panel #eqAddNew');
    await page.click('#panel #eqAddNew');
    await page.waitForSelector('#panel [data-eqpick="grill"]');
    await page.click('#panel [data-eqpick="grill"]');
    await page.waitForSelector('#panel #eqSave');
    await page.selectOption('#panel #eqCat', 'grill');
    await page.selectOption('#panel #eqType', 'פחם');
    await page.fill('#panel #eqName', 'Test Grill');
    await page.click('#panel #eqSave');
    await page.waitForFunction(`equipByCat('grill').length===1`);
    const genAfter = await page.evaluate(`eqmKitGen()`) as number;
    expect(genAfter).toBeGreaterThan(genBefore);   // equipSave (the ONE choke point) bumped _eqKitGen
    await page.click('#panel .x');
    await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);

    // RENDER C — same filtered card set as render B (trailing space trims away, same query, same
    // keys) — ONLY the kit changed. A stale cache would keep serving render B's ownership verdict
    // (still 0 calls, still uncookable); the generation stamp must force a real recompute, AND that
    // recompute must be CORRECT (not just non-zero).
    await page.evaluate(`window.__eqmOwnCalls=0; window.__renderCalls=0;`);
    await page.fill('#q', 'א ');
    await page.waitForFunction(`window.__renderCalls>=1`);
    const own3 = await page.evaluate(`window.__eqmOwnCalls`) as number;
    expect(own3).toBeGreaterThan(0);
    const cardCls = await page.locator('[data-mid="m-brat"]').getAttribute('class');
    expect(cardCls).not.toContain('eq-inv');   // the grill just added now satisfies the default combo — verdict genuinely changed, not just recomputed
  });

  test('functional smoke — real catalog search with a configured kit: grid filters correctly, eq-inv badge stays correct', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.waitForSelector('[data-mid="m-brat"]');
    const before = await page.locator('#makeGrid [data-mid]').count();
    expect(before).toBeGreaterThan(2);   // sanity: the group has more than a couple items, so a name search is a real narrowing

    // real keystroke: search m-brat's own Hebrew name ("בראטוורסט", Bratwurst). Not asserted UNIQUE —
    // n-thuringer ("טורינגר רוסטבראטוורסט", Rostbratwurst) shares the same root substring, so at most 2
    // cards can match; the grid must genuinely narrow, and m-brat must still be one of the results.
    await page.fill('#q', 'בראטוורסט');
    await page.waitForFunction(`(function(){ var g=document.querySelectorAll('#makeGrid [data-mid]');
      return g.length>0 && g.length<${before} && document.querySelector('#makeGrid [data-mid="m-brat"]'); })()`);
    const after = await page.locator('#makeGrid [data-mid]').count();
    expect(after).toBeLessThan(before);   // the real search genuinely narrowed the grid
    expect(after).toBeLessThanOrEqual(2);
    const card = page.locator('[data-mid="m-brat"]');
    // the badge/class came off the SAME memoized cache path exercised above — must still be correct
    await expect(card).toHaveClass(/eq-inv\b/);
    await expect(card.locator('.eq-inv-badge')).toContainText('חסר ציוד');
  });
});

// ═══ FIX WAVE 2 (2026-07-26, E3 Task 1 RE-VERIFICATION, "Important") — dynamic-key gen bumps ═══════
// FIX WAVE 1 bumped _eqKitGen at the ONE mutation choke point its grep audit found (equipSave). The
// re-verification found TWO more reachable UI paths that mutate mk-equipment WITHOUT going through
// equipSave — both write localStorage through a DYNAMIC key variable (import's backup-key loop,
// wipe's prefix-filtered removeItem loop and its undo-toast raw restore), so a literal grep for
// "mk-equipment" never finds them. Neither bumped the generation, so eqmValidity's gen-keyed cache
// (_eqValidityCache, keyed by meta.key + eqmKitGen()) kept serving a PRE-mutation verdict to any card
// already rendered under the old generation — wrong until the next full reload.
test.describe('FIX WAVE 2 — dynamic-key gen bumps (importData / wipeAllData)', () => {
  test('restore (importData, real Settings UI) — WITHOUT reload, the re-rendered card reflects the restored kit', async ({ page }) => {
    await boot(page, BATH);   // bath only: m-brat's default (grill) AND alt (smoke) paths both unowned → invalid

    // PRE-CONDITION (real UI, RENDER 1): confirm the card starts invalid under the seeded kit before
    // touching import at all — never trust the fixture's shape on faith.
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.waitForSelector('[data-mid="m-brat"]');
    const cardBefore = page.locator('[data-mid="m-brat"]');
    await expect(cardBefore).toHaveClass(/eq-inv\b/);
    await expect(cardBefore.locator('.eq-inv-badge')).toContainText('חסר ציוד');

    // Build the backup blob the way exportData() produces it (app.js:7108-7115): {app, ver, exported,
    // data}, where `data` holds the exact strings importData's own setItem loop will write back
    // verbatim. Fixture-minimal (DoD #6): the only key that matters to this scenario is mk-equipment —
    // importData only touches keys present in `data`, so this restores a DIFFERING kit (FULL: smoker +
    // grill, satisfies the default grill path) without needing a full-localStorage snapshot.
    const backupJson = JSON.stringify({
      app: 'matkonet', ver: 1, exported: new Date().toISOString(),
      data: { 'mk-equipment': JSON.stringify(FULL) },
    });

    // Drive the REAL import through the REAL Settings UI: openBackup() is the exact handler the
    // "💾 גיבוי ושחזור" tools-grid button calls (same evaluate-a-bare-global-function technique the
    // FIX WAVE 1 block above already uses for openEquipment()) — real panel markup, real #bkImp file
    // input, real 'change' listener (app.js:7967) that calls the real importData(file) with a REAL
    // FileReader. #bkImp is `type="file" hidden` (app.js:7957); Playwright's setInputFiles sets the
    // files property directly and does not require the input to be visible, so the `hidden` attribute
    // (it's a real file input behind a styled <label for="bkImp">, not a test obstacle) is not worked
    // around — state:'attached' instead of the default 'visible' matches that deliberate hiding.
    await page.evaluate(`openBackup()`);
    await page.waitForSelector('#panel #bkImp', { state: 'attached' });
    await page.setInputFiles('#panel #bkImp', {
      name: 'matkonet-backup-test.json', mimeType: 'application/json', buffer: Buffer.from(backupJson),
    });

    // Wait on an OBSERVABLE condition (DoD #11: no arbitrary waits) — the real FileReader's onload is
    // async, so poll for the actual post-import kit content (importData's own render() call has
    // already fired by the time this is true, since the setItem loop runs before render() in source order).
    await page.waitForFunction(`equipByCat('grill').length===1 && equipByCat('smoker').length===1`);

    // RED WITNESS on pre-fix app.js: importData's setItem loop never bumped _eqKitGen, so
    // eqmValidity's cache for 'make-m-brat' is still keyed to the PRE-import generation and returns the
    // stale 'invalid' verdict from RENDER 1 above, even though render() just ran again with the new
    // (now-valid) kit already in localStorage — the card stays wrongly marked eq-inv until reload.
    // GREEN after the fix: the explicit _eqKitGen++ at the end of importData's success path forces a
    // real cache miss on this render, so the card correctly loses eq-inv/its badge.
    const cardAfter = page.locator('[data-mid="m-brat"]');
    await expect(cardAfter).not.toHaveClass(/eq-inv\b/);
    await expect(cardAfter.locator('.eq-inv-badge')).toHaveCount(0);
  });

  test('wipe + undo (real wipe click-through + real undo click) — WITHOUT reload, the restored kit’s verdict is correct after an intervening equipment change', async ({ page }) => {
    await boot(page, BATH);   // same invalid-kit fixture as above

    // PRE-CONDITION (real UI): card starts invalid.
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.waitForSelector('[data-mid="m-brat"]');
    await expect(page.locator('[data-mid="m-brat"]')).toHaveClass(/eq-inv\b/);

    // Real wipe click-through: openBackup() (same real handler as above) → arm (1st real click) →
    // confirm (2nd real click, app.js:7980-7984's two-tap-to-confirm guard) → the REAL wipeAllData()
    // runs: removes every 'mk-'-prefixed key (mk-equipment AND mk-equip-set among them, via a dynamic
    // key k — literal-grep-invisible, the exact finding under test), resets nav state, renders, closes
    // the panel, and shows the undo toast (app.js:7978-7994).
    await page.evaluate(`openBackup()`);
    await page.waitForSelector('#panel #bkWipe');
    await page.click('#panel #bkWipe');
    await page.click('#panel #bkWipe');
    await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);
    expect(await page.evaluate(`equipConfigured()`)).toBe(false);   // mk-equip-set really was wiped

    // wipeAllData resets activeGroup to null (app.js:7999) but never calls catView() — only render(),
    // which re-renders #grid/#makeGrid/#specGrid in place without touching which catalog SECTION is
    // visible (that toggle is catView()'s job, app.js:2257-2278). We're still in the 'cat' section from
    // the earlier real click (its container stays visible), and activeGroup=null now means UNFILTERED
    // (effectiveCats() returns null → every item, app.js:2187-2190) — so m-brat re-appears in the SAME
    // still-visible grid with no extra navigation needed; still waiting on the selector itself is real
    // synchronization, not an assumption.
    await page.waitForSelector('[data-mid="m-brat"]');
    // Sanity (either fixed or buggy code agrees here): unconfigured kit → eqmValidity's own R5 gate
    // (app.js:1812, checked BEFORE the cache) always answers 'ok', independent of this bug.
    await expect(page.locator('[data-mid="m-brat"]')).not.toHaveClass(/eq-inv\b/);

    // Intervening REAL equipment mutation — the exact production choke point (equipSave + the
    // equipSetConfigured() its own real UI form always pairs it with, app.js:7696), called directly
    // for determinism instead of the multi-field form (the import test above already proves the
    // through-real-UI path for a mk-equipment mutation; this is the well-tested OTHER half — equipSave
    // itself — used only as fixture setup here). Configures a grill: m-brat's default path is now
    // satisfied, so this legitimately caches m-brat as OK under this (correctly bumped) generation —
    // the precondition the undo bug needs to have something wrong to serve stale.
    await page.evaluate(`(function(){
      equipSave([{ id:'gX', cat:'grill', type:'פחם', name:'Intervening Grill', brand:'', model:'', fuel:'', cap:{}, specSource:'manual', notes:'' }]);
      equipSetConfigured();
      render();
    })()`);
    await page.waitForFunction(`equipByCat('grill').length===1`);
    await expect(page.locator('[data-mid="m-brat"]')).not.toHaveClass(/eq-inv\b/);   // real, freshly-cached: grill added → default path OK

    // Real undo click. The wipe's toast (app.js:3251-3259, still the same #toast element — nothing else
    // in this flow calls toast()) auto-hides its `.show` class after 5s but the button and its
    // addEventListener('click', ...) closure are never removed; dispatching .click() on the actual DOM
    // node runs the exact same handler a real pointer click would (undoFn is the app's own closure, not
    // a test double) while staying immune to the 5s CSS fade becoming a flaky actionability race — no
    // arbitrary wait (DoD #11), a real production code path.
    await page.evaluate(`document.querySelector('#toast [data-undo]').click()`);
    // Observable completion condition: the undo's raw setItem loop restores the pre-wipe snapshot
    // synchronously (mk-equipment back to BATH — one sousvide device with a 20L bath).
    await page.waitForFunction(`(function(){ var l=equipList(); return l.length===1 && l[0].cat==='sousvide' && JSON.stringify(l[0].cap.baths)==='[20]'; })()`);

    // RED WITNESS on pre-fix app.js: neither the wipe nor the undo bumped _eqKitGen, so the generation
    // is still the one the intervening equipSave() call set — the SAME generation _eqValidityCache
    // already holds an 'ok' entry for 'make-m-brat' under (from the intervening grill). The undo
    // restored the ORIGINAL invalid (bath-only) kit into localStorage, but the stale cache hit keeps
    // serving the intervening kit's 'ok' verdict — the card wrongly stays free of the eq-inv badge even
    // though the kit actually sitting in storage right now cannot cook m-brat by any cited path.
    // GREEN after the fix: the undo path's explicit _eqKitGen++ forces a real cache miss, so the
    // re-render correctly recomputes against the just-restored (invalid) kit.
    const cardFinal = page.locator('[data-mid="m-brat"]');
    await expect(cardFinal).toHaveClass(/eq-inv\b/);
    await expect(cardFinal.locator('.eq-inv-badge')).toContainText('חסר ציוד');
  });
});
