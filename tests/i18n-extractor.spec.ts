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

// ── review finding C1 — I-C bare-key retention ──
test('extractor: a ctx\'d homograph emits BOTH the compound key AND the bare he key (I-C, review C1)', async () => {
  const { extract } = await extractorModule;
  const { known } = extract(`L('אש','Fire','fire');`);
  expect(known['אש']).toBe('Fire');       // bare key — tnode static-shell path keys by bare Hebrew
  expect(known['אש␟fire']).toBe('Fire');  // compound ctx key — the L() path
});

test('extractor: two ctx\'d homograph sites both keep their own compound key; the bare key holds the first-seen (primary) sense without colliding (I-C, review C1)', async () => {
  const { extract } = await extractorModule;
  const src = `L('אש','Fire','fire'); L('אש','Heat','heat');`;
  const { known, collisions } = extract(src);
  expect(known['אש␟fire']).toBe('Fire');
  expect(known['אש␟heat']).toBe('Heat');
  expect(known['אש']).toBe('Fire'); // first-seen ctx'd site is the primary sense
  expect(collisions.length).toBe(0); // ctx'd sites must never trigger the bare-key collision lint
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
