// Task 2 (v268 localization plan) — the acorn extractor scripts/i18n-extract.mjs.
// Spec: docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §3.3 (harvest modes 1-4),
// §6 (homograph collision-lint), I-B (array-partner + nested recursion), M-3 (deny-list).
// Pure Node-side test — no browser/page needed, so this imports @playwright/test directly rather
// than the warm-page fixtures in ./_fixtures.
import { test, expect } from '@playwright/test';

// Dynamic import: the test file is transformed to CJS by Playwright's esbuild pass, and scripts/
// i18n-extract.mjs is a real ES module (acorn is ESM-first) — `await import(...)` is the correct
// interop, a static `import` of a CJS-transformed file cannot load ESM synchronously.
const extractorModule = import('../scripts/i18n-extract.mjs');

// ── fixture 1 — one of each harvest-mode shape, no collision ──
const FIXTURE_OK = `
L('שלום עולם','Hello world');
t('רק עברית ואין תרגום');

// mode 2(a) — flat _EN table
const FOO={a:'שלום','key-b':'טוב מאוד'};
const FOO_EN={a:'Hello there','key-b':'Very good'};
function fooLabel(k){ return (getLang()==='he'?FOO:FOO_EN)[k]||k; }

// mode 2(c) — nested / leaf-pair recursion (DONE_SCALES-shape)
const NEST={grp:{x:'נא',y:'עשוי'}};
const NEST_EN={grp:{x:'Rare',y:'Well done'}};

// mode 2(b) — array-of-pairs partner (SPK_HEAT-shape)
const ARR=[[0,'😌 עדין'],[1,'🌶 קל']];
const ARR_EN={0:'😌 Mild',1:'🌶 Light'};
function heatLabel(v,heLabel){ return getLang()==='he'?heLabel:(ARR_EN[v]||heLabel); }

// mode 3 — toast, no English yet
toast('הודעה בלי אנגלית');

// mode 4 — names
const REC={heb:'סטייק', eng:'Steak', cat:'meat'};

// M-3 deny-list — an internal, never-rendered config object shaped like the generic {he,en} pair
const INTERNAL_CFG={he:'לא בתצוגה', en:'never shown', flag:true};
`;

const FIXTURE_COLLISION = `
L('אש','Fire');
L('אש','Heat');
`;

test('extractor: harvest modes 1-4 emit the expected keys (flat + nested + array-partner + toast + name)', async () => {
  const { extract } = await extractorModule;
  const { known, needsEn } = extract(FIXTURE_OK, { denyTables: new Set(['INTERNAL_CFG']) });

  // mode 1 — static L / t
  expect(known['שלום עולם']).toBe('Hello world');
  expect(known['רק עברית ואין תרגום']).toBe('רק עברית ואין תרגום'); // placeholder — needs-en
  expect(needsEn).toContain('רק עברית ואין תרגום');

  // mode 2(a) — flat _EN table
  expect(known['שלום']).toBe('Hello there');
  expect(known['טוב מאוד']).toBe('Very good');

  // mode 2(c) — nested leaf-pair recursion: table-scoped ctx (M-3, review C2) — NEST's leaves are
  // reached by recursing into a nested object (depth > 0), so they are table-ctx'd, not bare-keyed
  // (tableCtxFor falls back to the lowercased base identifier: 'nest').
  expect(known['נא␟nest']).toBe('Rare');
  expect(known['עשוי␟nest']).toBe('Well done');
  expect(known['נא']).toBeUndefined(); // no bare key from a nested-table leaf

  // mode 2(b) — array-of-pairs partner
  expect(known['😌 עדין']).toBe('😌 Mild');
  expect(known['🌶 קל']).toBe('🌶 Light');

  // mode 3 — toast with no English yet → placeholder + needs-en
  expect(known['הודעה בלי אנגלית']).toBe('הודעה בלי אנגלית');
  expect(needsEn).toContain('הודעה בלי אנגלית');

  // mode 4 — names go to the __names__ sub-map, NOT a flat he-keyed chrome entry
  expect(known.__names__['סטייק']).toBe('Steak');
  expect(known['סטייק']).toBeUndefined();

  // M-3 deny-list — the internal config object must NOT be harvested
  expect(known['לא בתצוגה']).toBeUndefined();
});

test('extractor: collision-lint throws when two sites share a bare he key with a different en, no ctx', async () => {
  const { extract } = await extractorModule;
  expect(() => extract(FIXTURE_COLLISION)).toThrow(/collision/i);
});

test('extractor: a ctx-disambiguated pair of homograph sites does NOT collide', async () => {
  const { extract } = await extractorModule;
  const src = `L('אש','Fire','fire'); L('אש','Heat','heat');`;
  const { known } = extract(src);
  expect(known['אש␟fire']).toBe('Fire');
  expect(known['אש␟heat']).toBe('Heat');
});

test('extractor: a needs-en placeholder is upgraded (not flagged a collision) once a real English value for the same key appears', async () => {
  const { extract } = await extractorModule;
  // toast() fires first with no English; a later static L() site supplies the real English for
  // the identical Hebrew text — this must upgrade the placeholder, not collide.
  const src = `toast('אותו טקסט בדיוק'); L('אותו טקסט בדיוק','Exactly the same text');`;
  const { known, needsEn } = extract(src);
  expect(known['אותו טקסט בדיוק']).toBe('Exactly the same text');
  expect(needsEn).not.toContain('אותו טקסט בדיוק');
});

// ── Task 5 — the primary-bare-key mechanism (spec §6, supersedes T2/C1's first-write-wins) ──
// T2/C1 had a ctx'd site ALWAYS also write the bare key (first-write-wins via a `noCollision`
// escape hatch) — order-dependent: whichever sense's call happened to appear first in app.js won
// the bare key, regardless of which sense was actually meant to be primary. Task 5 replaces this
// with an explicit, order-independent mechanism (see the file-header comment in i18n-extract.mjs):
// a ctx'd L() call NEVER touches the bare key by itself; exactly one site per homograph is the
// designated primary, either by staying a plain 2-arg `L(he,en)` call, or via an explicit 4th-arg
// `true` marker on a ctx'd call.

test('extractor: a lone ctx\'d L() site with NO primary marker emits ONLY the compound key — the bare key stays unset (Task 5, spec §6)', async () => {
  const { extract } = await extractorModule;
  const { known } = extract(`L('אש','Fire','fire');`);
  expect(known['אש␟fire']).toBe('Fire');
  expect(known['אש']).toBeUndefined(); // no plain 2-arg site and no primary marker → no bare key
});

test('extractor: two ctx\'d homograph sites (no primary marker) each keep their own compound key and neither touches the bare key — no collision, order does not matter (Task 5, spec §6)', async () => {
  const { extract } = await extractorModule;
  const { known, collisions } = extract(`L('אש','Fire','fire'); L('אש','Heat','heat');`);
  expect(known['אש␟fire']).toBe('Fire');
  expect(known['אש␟heat']).toBe('Heat');
  expect(known['אש']).toBeUndefined();
  expect(collisions.length).toBe(0);
});

test('extractor: the plain 2-arg site is the primary and owns the bare key, regardless of whether it appears BEFORE or AFTER the ctx\'d sense in source order (Task 5 order-independence, spec §6)', async () => {
  const { extract } = await extractorModule;
  const before = extract(`L('אש','Fire'); L('אש','Heat','heat');`);
  const after = extract(`L('אש','Heat','heat'); L('אש','Fire');`);
  expect(before.known['אש']).toBe('Fire');
  expect(after.known['אש']).toBe('Fire'); // same result regardless of which site came first
  expect(before.collisions.length).toBe(0);
  expect(after.collisions.length).toBe(0);
});

test('extractor: a 4th-arg `true` marks a ctx\'d site as the explicit primary — it writes BOTH its compound key and the bare key (Task 5 fallback mechanism, spec §6)', async () => {
  const { extract } = await extractorModule;
  const { known, collisions } = extract(`L('אש','Fire','fire',true); L('אש','Heat','heat');`);
  expect(known['אש␟fire']).toBe('Fire');
  expect(known['אש␟heat']).toBe('Heat');
  expect(known['אש']).toBe('Fire'); // the explicitly-marked site owns the bare key
  expect(collisions.length).toBe(0);
});

test('extractor: two ctx\'d sites BOTH marked primary (4th arg true) for the same homograph is a genuine authoring mistake and still collides (Task 5, spec §6)', async () => {
  const { extract } = await extractorModule;
  const { collisions } = extract(`L('אש','Fire','fire',true); L('אש','Heat','heat',true);`, { throwOnCollision: false });
  expect(collisions.length).toBe(1);
  expect(collisions[0].key).toBe('אש');
});

// ── mode 2-generic ctx (Task 5) — a sibling {he,en} object literal can also carry a `ctx` property,
// for homograph senses expressed as data (e.g. a props-array entry rendered via L(p.he,p.en,p.ctx))
// rather than a direct L() call. Same mechanism as mode 1: ctx present → compound-key only. ──
test('extractor: a mode-2-generic {he,en,ctx} object emits ONLY the compound key, never the bare key (Task 5, spec §6)', async () => {
  const { extract } = await extractorModule;
  const src = `const ROW={he:'מספר ווים', en:'How many', ctx:'hooks-count'};`;
  const { known } = extract(src);
  expect(known['מספר ווים␟hooks-count']).toBe('How many');
  expect(known['מספר ווים']).toBeUndefined();
});

test('extractor: a ctx-less mode-2-generic {he,en} object (the primary sense) coexists with a ctx\'d {he,en,ctx} sibling for the same homograph — no collision (Task 5, spec §6)', async () => {
  const { extract } = await extractorModule;
  const src = `
const PRIMARY={he:'מספר ווים', en:'Hooks'};
const ALT={he:'מספר ווים', en:'How many', ctx:'hooks-count'};
`;
  const { known, collisions } = extract(src);
  expect(known['מספר ווים']).toBe('Hooks');
  expect(known['מספר ווים␟hooks-count']).toBe('How many');
  expect(collisions.length).toBe(0);
});

// ── review finding C2 — M-3 table-scoped ctx for nested tables ──
test('extractor: a nested-table (DONE_SCALES-shape) homograph leaf emits under a table-scoped ctx, and does NOT bare-collide with an unrelated bare L() site for the same Hebrew text (review C2)', async () => {
  const { extract } = await extractorModule;
  const src = `
const DONE_SCALES={steak:{rare:'נא'}};
const DONE_SCALES_EN={steak:{rare:'Rare'}};
L('נא','raw');
`;
  const { known, collisions } = extract(src);
  expect(known['נא␟doneness']).toBe('Rare'); // table-scoped ctx — the doneness sense
  expect(known['נא']).toBe('raw');           // bare key belongs to the unrelated kg/raw-weight sense
  expect(collisions.length).toBe(0);         // the real 'נא' Rare-vs-raw collision must be gone
});

// ── review finding C3 — LANG_FLAG deny + Hebrew-semantic guard ──
test('extractor: LANG_FLAG (language-code -> flag-emoji map) is deny-listed and not harvested (review C3)', async () => {
  const { extract } = await extractorModule;
  const src = `const LANG_FLAG={he:'🇮🇱', en:'🇬🇧', fr:'🇫🇷'};`;
  const { known } = extract(src);
  expect(known['🇮🇱']).toBeUndefined();
});

test('extractor: an all-emoji/no-Hebrew {he,en}-shaped object is not harvested regardless of name (semantic guard, review C3)', async () => {
  const { extract } = await extractorModule;
  const src = `const SOME_OTHER_TABLE={he:'🇮🇱', en:'🇬🇧', fr:'🇫🇷'};`;
  const { known } = extract(src);
  expect(known['🇮🇱']).toBeUndefined();
});

// ── mode 5 (Task 4 wrinkle) — post-`_EN`-deletion seed harvest ──
// Once a table's `_EN` partner is gone (deleted, selector rerouted to `t(NAME[k])`), the AST alone
// cannot recover `en` (the call site's key is dynamic). Mode 5 walks the SOLE surviving Hebrew tree
// for the fixed POST_DELETION_TABLES registry and sources `en` from `opts.seed`.
test('mode 5: a flat post-deletion table (SMOKER_TIPS-shape) is harvested from opts.seed, no _EN partner needed', async () => {
  const { extract } = await extractorModule;
  const src = `const SMOKER_TIPS={a:'שלום',b:'טוב'};`;
  const { known, needsEn } = extract(src, { seed: { 'שלום': 'Hello', 'טוב': 'Good' } });
  expect(known['שלום']).toBe('Hello');
  expect(known['טוב']).toBe('Good');
  expect(needsEn).toEqual([]);
});

test('mode 5: a seed MISS degrades to the standard needs-en placeholder, not a crash', async () => {
  const { extract } = await extractorModule;
  const src = `const KIND_LABEL={rub:'ראב יבש חדש'};`; // no matching seed entry
  const { known, needsEn } = extract(src, { seed: {} });
  expect(known['ראב יבש חדש']).toBe('ראב יבש חדש'); // placeholder = the Hebrew itself
  expect(needsEn).toContain('ראב יבש חדש');
});

test('mode 5: array-of-pairs post-deletion table (SPK_HEAT-shape) harvested bare-keyed from opts.seed', async () => {
  const { extract } = await extractorModule;
  const src = `const SPK_HEAT=[[0,'😌 עדין'],[1,'🌶 קל']];`;
  const { known } = extract(src, { seed: { '😌 עדין': '😌 Mild', '🌶 קל': '🌶 Light' } });
  expect(known['😌 עדין']).toBe('😌 Mild');
  expect(known['🌶 קל']).toBe('🌶 Light');
});

test('mode 5: nested post-deletion table (DONE_SCALES-shape) harvested under its table-scoped ctx from opts.seed', async () => {
  const { extract } = await extractorModule;
  const src = `const DONE_SCALES={steak:{rare:'נא',med:'מדיום'}};`;
  const { known } = extract(src, { seed: { 'נא␟doneness': 'Rare', 'מדיום␟doneness': 'Medium' } });
  expect(known['נא␟doneness']).toBe('Rare');
  expect(known['מדיום␟doneness']).toBe('Medium');
  expect(known['נא']).toBeUndefined(); // still no bare key from a nested-table leaf
});

test('mode 5: prop-shape post-deletion table (THEMES.name-shape) harvested bare-keyed from opts.seed', async () => {
  const { extract } = await extractorModule;
  const src = `const THEMES={cream:{name:'שמנת חמה', dots:[]}};`;
  const { known } = extract(src, { seed: { 'שמנת חמה': 'Warm cream' } });
  expect(known['שמנת חמה']).toBe('Warm cream');
});

// ── the staleness contract itself (Task 4's CRITICAL constraint / Task 12's gate) ──
// A fresh extraction of the REAL app.js, seeded from the REAL committed lang/_extracted.json, must
// reproduce that exact committed artifact — proving the 9 deleted `_EN` tables' keys survive the fold.
test('staleness: a fresh extraction of app.js seeded from the committed _extracted.json reproduces it byte-for-byte', async () => {
  const { extract } = await extractorModule;
  const fs = await import('node:fs');
  const path = await import('node:path');
  // process.cwd() is the repo root — playwright is always invoked from there (config's testDir is
  // relative, not a chdir); import.meta.url is unavailable here (this file is esbuild-transformed to
  // CJS by Playwright, per the header comment above).
  const root = process.cwd();
  const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const committed = JSON.parse(fs.readFileSync(path.join(root, 'lang', '_extracted.json'), 'utf8'));
  const { known } = extract(appSrc, { seed: committed, throwOnCollision: false });
  expect(known).toEqual(committed);
  // the 9 deleted tables' representative keys, specifically:
  expect(known['ראב יבש']).toBe('Dry rub');                         // KIND_LABEL
  expect(known['⏳ בתהליך']).toBe('⏳ In progress');                 // STAGE_LABEL
  expect(known['שמנת חמה']).toBe('Warm cream');                     // THEMES.name (was THEME_NAMES_EN)
  expect(known['נוכחי']).toBe('Current');                           // FONT_PAIRS.name (was FONT_NAMES_EN)
  expect(known['רגיל']).toBe('Regular');                            // FONT_SCALE_LABELS
  expect(known['צירים מתקפלים']).toBe('Collapsible accordion');     // SHAPE_NAMES
  expect(known['😌 עדין']).toBe('😌 Mild');                          // SPK_HEAT
  expect(known['נא␟doneness']).toBe('Rare');                        // DONE_SCALES
});

// ── Task 5 — the real corpus, collision-lint GREEN with no --allow-collisions (spec §6) ──
// RED for this test was witnessed on the CLI directly before Task 5's edits: `node
// scripts/i18n-extract.mjs app.js` (no flag) threw "i18n-extract: homograph collision(s)" listing
// ~63 colliding (key, en1, en2) pairs across ~36 distinct bare-he keys (אש, עישון, מתקדם, נתח,
// אירועים, מספר ווים, כלי הפיטמאסטר, פחם/עצים via DEVICE_FUEL, …) — full output pasted in
// .superpowers/sdd/v268-t5-report.md. This test is that RED's permanent GREEN witness.
test('Task 5 GREEN: extract(app.js) throws NO collisions — every real homograph is ctx-disambiguated (spec §6)', async () => {
  const { extract } = await extractorModule;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
  expect(() => extract(appSrc)).not.toThrow();
  const { collisions } = extract(appSrc, { throwOnCollision: false });
  expect(collisions).toEqual([]);
});

test('Task 5: node scripts/i18n-extract.mjs app.js (NO --allow-collisions) exits 0 on the real corpus (spec §6)', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, ['scripts/i18n-extract.mjs', 'app.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  expect(out).toContain('[i18n-extract] wrote lang/_extracted.json');
  expect(out).not.toContain('collision');
});

// ── Task 5 — bare-key retention for the tnode static-shell path (spec I-C), on REAL resolved
// homographs. Each of these words also (or plausibly could) render as static shell text keyed by
// the bare Hebrew — the bare key must hold the designated PRIMARY sense's English, and the
// compound ctx key(s) must hold every other sense, distinct from the bare value. ──
test('Task 5: real resolved homographs retain a bare he key (primary sense) alongside their compound ctx key(s) (spec I-C)', async () => {
  const { extract } = await extractorModule;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
  const { known } = extract(appSrc);
  const cases: [string, string, string, string][] = [
    ['אש', 'Fire', 'אש␟inline', 'fire'],
    ['עישון', 'Smoke', 'עישון␟gerund', 'Smoking'],
    ['מתקדם', 'Advanced', 'מתקדם␟tier', 'Pro'],
    ['נתח', 'Cut', 'נתח␟analyze', 'Analyze'],
    ['אירועים', 'events', 'אירועים␟summary', 'cookouts'],
    ['מספר ווים', 'Hooks', 'מספר ווים␟hooks-count', 'How many'],
    ['כלי הפיטמאסטר', 'Pitmaster tools', 'כלי הפיטמאסטר␟dock-tile', 'Pit-tools dock'],
    ['פחם', 'Charcoal', 'פחם␟inline', 'charcoal'],
  ];
  for (const [bareKey, bareEn, ctxKey, ctxEn] of cases) {
    expect(known[bareKey]).toBe(bareEn);
    expect(known[ctxKey]).toBe(ctxEn);
    expect(known[bareKey]).not.toBe(known[ctxKey]); // distinct senses, proven distinct
  }
});
