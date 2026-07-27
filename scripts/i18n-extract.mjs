#!/usr/bin/env node
// scripts/i18n-extract.mjs — v268 localization plan, Task 2.
// Spec: docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §3.3 (harvest modes 1-4),
// §6 (homograph collision-lint), I-B (array-partner + nested recursion), M-3 (deny-list).
//
// Parses app.js via AST (acorn — not regex) and emits lang/_extracted.json = { "<key>": "<en>" },
// deduped on the compound key (he, or he+SENT+ctx for homograph-disambiguated call sites), plus a
// `__names__` sub-map (spec I-D) keyed by the data's Hebrew name.
//
// Four harvest modes (spec §3.3):
//  1. Static L(strLit,strLit[,strLit]) and t(strLit[,strLit]). t(he) with no en is flagged into the
//     needs-en list (I4) — it still gets an emitted key ({he:he,en:he}) so the build doesn't choke,
//     but the placeholder must be resolved with a real English string before translation (Task 8).
//  2. Parallel he/en object harvest — subsumes the 9 `_EN` tables AND the generic `{he:...,en:...}`
//     sibling-literal shape used by the ~48 expr-arg data objects (PREHEAT, DEVICE_FUEL, cm() catalog
//     entries, prop.opts, makes, capability specs, …). Three _EN-table shapes (I-B):
//       (a) flat parallel objects — `NAME_EN[k]` paired with `NAME[k]` (or a named special pairing,
//           for THEME_NAMES_EN/FONT_NAMES_EN which pair against a nested `.name` field, see
//           SPECIAL_BASE_MAP below — those two tables don't follow the `_EN`-suffix-stripped-name
//           convention because the Hebrew side lives on THEMES[k].name / FONT_PAIRS[k].name, not on a
//           sibling `THEME_NAMES` / `FONT_NAMES` object).
//       (b) array-of-pairs partner — `SPK_HEAT = [[key, heLabel], …]` paired with the object
//           `SPK_HEAT_EN = {key: en}` — flat `NAME[k]` indexing does not fit an array, so pairs are
//           harvested by joining on the pair's first element.
//       (c) nested / leaf-pair recursion — `DONE_SCALES` / `DONE_SCALES_EN` are 2-level nested;
//           recurse both trees in lockstep to the leaf string pairs.
//     Allow/deny (M-3): DENY_TABLES excludes internal `{he,en}`-shaped config objects that never
//     render as UI text, so the key set does not bloat with non-UI strings — new tables default to
//     harvest; the deny-list is the reviewed exception.
//  3. Toasts. toast(strLit, …) first-args, plus the default action label harvested from
//     `tr(<anything> || strLit)` (the shape at app.js:3541, `tr(actionLabel||'בטל')`).
//  4. Names (I-D). Any object literal with sibling `heb:`/`eng:` string-literal properties
//     (the `metaCut`/`metaSpec`/`metaMake`/DATA-shape used across itemName's callers) → a nested
//     `__names__` sub-map keyed by the Hebrew name. NOT a flat `he␟name` compound key, NOT an
//     `L`/`t` call — the sole consumer is `itemName` (spec §11), which reads
//     `getDict().__names__[m.heb]` directly.
//  5. Post-`_EN`-deletion seed harvest (Task 4 wrinkle). Once a table's `_EN` partner is DELETED and
//     its selector rerouted to `t(NAME[k])` (a DYNAMIC key the AST cannot statically resolve), mode 2
//     can no longer pair the two trees — there is only one tree left. For the fixed, reviewed list of
//     `POST_DELETION_TABLES` (the former 9 `_EN` tables' Hebrew-only survivors), this mode walks the
//     SOLE remaining Hebrew tree and sources `en` from `opts.seed` — a he[␟ctx]→en map the CLI loads
//     from the EXISTING committed `_extracted.json` before overwriting it (so the artifact is its own
//     seed: idempotent — a fixed point once the seed and the source Hebrew agree). A seed miss (the
//     Hebrew text changed with no fresh translation yet) degrades to the same needs-en placeholder
//     convention used everywhere else in this file, never a crash.
//
// Collision-lint (spec §6): two sites sharing a BARE `he` key (no ctx) but supplying different,
// non-placeholder `en` values throws — surfacing an unnoticed homograph as an error, never a silent
// pick. A "placeholder" is an emitted `en === he` value from a needs-en site (mode 1's bare `t(he)`,
// or a toast/tr-default-label site with no resolvable English yet); a placeholder never collides —
// it is silently upgraded the moment a real English value for the same key is seen (order-independent
// in effect, since both directions are handled).
//
// Task 5 primary-bare-key mechanism (spec §6, I-C bare-key retention — supersedes T2/C1's
// first-write-wins heuristic, which was file-order-dependent and could bare-key the WRONG sense):
// for a homograph, exactly ONE call site is the designated PRIMARY sense and owns the bare `he` key;
// every OTHER sense's call site takes a ctx (mode 1: `L(he,en,ctx)`; mode 2-generic: a sibling
// `ctx:` string-literal property) and contributes ONLY its own `he␟ctx` compound key — it never
// touches the bare key, so file order can no longer decide which sense ends up bare-keyed. Primary
// designation is explicit, not positional: (a) the common case — leave the primary sense's call as a
// plain 2-arg `L(he,en)` (or a ctx-less {he,en} object); it writes the bare key through the normal,
// real-collision-checked path, independent of every ctx'd sense's own writes. (b) when no sense
// naturally stays a plain 2-arg call, mark the primary explicitly with a 4th arg:
// `L(he, en, ctx, true)` — this ctx'd site ALSO writes the bare key, through the same
// real-collision-checked path (so two mistaken "primary" markers for one homograph still throw).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as acorn from 'acorn';

const SENT = '␟'; // U+241F SYMBOL FOR UNIT SEPARATOR — the ␟ ctx-key sentinel (spec §6)

// ── M-3 deny-list — reviewed exceptions only. Checked against BOTH the base (non-_EN) table
// identifier in mode-2(a)/(b)/(c) pairing AND the nearest enclosing `const NAME = …` identifier for
// the generic sibling-{he,en}/{heb,eng} object walk (mode 2-generic / mode 4). Empty for the real
// app.js corpus today — the mechanism itself is proven by this file's own test fixture
// (tests/i18n-extractor.spec.ts), which seeds a denied internal config object and asserts it is
// excluded. New `_EN`/`{he,en}` tables default to harvest; add an identifier here only for a
// reviewed, confirmed-internal (never-rendered) object.
export const DENY_TABLES = new Set([
  // LANG_FLAG (app.js:8570) is a generic {he,en,fr,de,es,ar,ru,it} language->flag-emoji map — its
  // `he`/`en` properties are language codes paired with flag emoji, NOT a Hebrew/English UI-text
  // pair. It shape-matches the generic mode-2 {he,en} sibling-literal walk and was mis-harvested as
  // {"🇮🇱":"🇬🇧"} (review finding C3). Denied here; also caught defense-in-depth by the Hebrew-
  // codepoint semantic guard below (any future LANG_FLAG-shaped table is skipped even if unlisted).
  'LANG_FLAG',
]);

// THEME_NAMES_EN / FONT_NAMES_EN don't follow the `_EN`-suffix-stripped sibling-identifier
// convention (there is no `THEME_NAMES`/`FONT_NAMES` object) — the Hebrew side is a nested `.name`
// field on THEMES[k] / FONT_PAIRS[k] respectively (spec §3.3 mode 2, app.js:8531-8554).
const SPECIAL_BASE_MAP = {
  THEME_NAMES_EN: { ident: 'THEMES', prop: 'name' },
  FONT_NAMES_EN: { ident: 'FONT_PAIRS', prop: 'name' },
};

// ── M-3 table-scoped ctx (review finding C2) — a nested (2-level) `_EN`-table leaf can be a
// homograph with no `L(…,ctx)` call site to carry a sense hint (spec §3.3 mode 2 / M-3, e.g.
// `DONE_SCALES.steak.rare='נא'`, app.js:2965, which also bare-collides with the unrelated
// `L('נא','raw')` kg/raw-weight sense at app.js:5932/5961/5971). Leaves found while RECURSING into a
// nested object (depth > 0 in harvestNestedPairs) are emitted under `he␟ctx` instead of a bare key —
// a top-level flat `_EN` table's leaves (depth 0 — the other 7 flat tables, I-B) are unaffected and
// stay bare-keyed, matching spec's "non-homograph leaves stay bare-keyed" (only the nested shape (c)
// tables carry table-scoped ctx). Named per spec's own illustrative key (`'נא␟doneness'`); any future
// nested table without an explicit entry falls back to a slugified base identifier.
const NESTED_TABLE_CTX = {
  DONE_SCALES: 'doneness',
};
function tableCtxFor(baseName) {
  return NESTED_TABLE_CTX[baseName] || baseName.toLowerCase().replace(/_/g, '-');
}

// ── mode 5 registry (Task 4 wrinkle) — the former 9 `_EN` tables, post-deletion. Each entry names
// the SOLE surviving Hebrew-side identifier and its leaf shape, so harvestPostDeletion() (below) can
// walk it without a partner tree, sourcing `en` from opts.seed. Reviewed, closed list — a future new
// `_EN` table follows the normal mode-2 twin-tree path (default: harvest) until it, too, is folded.
const POST_DELETION_TABLES = [
  { ident: 'SMOKER_TIPS', shape: 'flat' },        // app.js smokerTip()
  { ident: 'KIND_LABEL', shape: 'flat' },         // app.js kindLabel()
  { ident: 'STAGE_LABEL', shape: 'flat' },        // app.js stageLabel()
  { ident: 'SHAPE_NAMES', shape: 'flat' },        // app.js shapeName()
  { ident: 'FONT_SCALE_LABELS', shape: 'flat' },  // app.js scaleLabel()
  { ident: 'SPK_HEAT', shape: 'array' },          // app.js heatLabel() — array-of-pairs, bare-keyed
  { ident: 'DONE_SCALES', shape: 'nested', ctx: tableCtxFor('DONE_SCALES') }, // app.js doneLabel()
  { ident: 'THEMES', shape: 'prop', prop: 'name' },       // app.js themeName() — Hebrew lives on .name
  { ident: 'FONT_PAIRS', shape: 'prop', prop: 'name' },   // app.js fontName() — Hebrew lives on .name
];

// ── C3 semantic guard — a shape-only {he,en} match (both string-literal properties present) is not
// necessarily a Hebrew/English UI-text pair (e.g. LANG_FLAG's `he`/`en` keys are language codes
// carrying flag emoji, not Hebrew copy). Require the `he` value to actually contain a Hebrew
// codepoint before harvesting — defense-in-depth alongside the DENY_TABLES entry above, so an
// unlisted future table of the same shape doesn't silently re-introduce the bug.
const HEBREW_RE = /[֐-׿]/;

// ── generic AST walk with parent pointers (so mode-2-generic / mode-4 can find the nearest
// enclosing `const NAME = …` for the deny-list check) — no acorn-walk dependency needed. ──
function walk(node, parent, visit) {
  if (!node || typeof node.type !== 'string') return;
  node.__parent = parent;
  visit(node);
  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range' || key === '__parent') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) walk(item, node, visit);
    } else if (val && typeof val.type === 'string') {
      walk(val, node, visit);
    }
  }
}

function nearestDeclName(node) {
  let n = node;
  while (n) {
    if (n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier') return n.id.name;
    n = n.__parent;
  }
  return null;
}

function isStringLiteral(node) {
  return !!node && node.type === 'Literal' && typeof node.value === 'string';
}

function propKeyName(prop) {
  if (!prop.key) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
}

function isArrayOfPairs(node) {
  if (!node || node.type !== 'ArrayExpression') return false;
  if (node.elements.length === 0) return false;
  return node.elements.every(
    (el) => el && el.type === 'ArrayExpression' && el.elements.length === 2 &&
      el.elements[0] && el.elements[0].type === 'Literal' && isStringLiteral(el.elements[1])
  );
}

export function extract(src, opts = {}) {
  const denyTables = opts.denyTables || DENY_TABLES;
  const seed = opts.seed || {}; // he[␟ctx] -> en, from the previously-committed artifact (mode 5)
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', allowReturnOutsideFunction: true });

  const known = {};       // "<key>" -> "<en>" (chrome key set — spec §3.3)
  const names = {};       // __names__ sub-map: heb -> eng (spec I-D)
  const placeholderKeys = new Set(); // keys whose current `known[key]` is a not-yet-translated placeholder (en===he)
  const collisions = [];  // {key, en1, en2} — surfaced as a thrown Error (spec §6)
  const needsEnSet = new Set(); // he/compound keys lacking a real English literal (I4)

  // Task 5 note: this function no longer takes a `noCollision` escape hatch (T2/C1 had one, for the
  // old first-write-wins bare-key mechanism). Every caller now either (a) only ever writes a key it
  // is entitled to own — a plain 2-arg L()/t() site, an un-ctx'd mode-2/4 object, or an explicit
  // primary-marked ctx'd site — so a real mismatch here is always a genuine, order-independent
  // collision, or (b) is itself the sole registered sense for that exact key.
  function setKnownKey(key, en, { placeholder = false } = {}) {
    if (!(key in known)) {
      known[key] = en;
      if (placeholder) placeholderKeys.add(key);
      return;
    }
    if (known[key] === en) return; // identical — no-op, whether or not either side is a placeholder
    const existingIsPlaceholder = placeholderKeys.has(key);
    if (existingIsPlaceholder && !placeholder) {
      // upgrade: a real English value replaces an earlier needs-en placeholder
      known[key] = en;
      placeholderKeys.delete(key);
      needsEnSet.delete(key);
      return;
    }
    if (!existingIsPlaceholder && placeholder) {
      // a later placeholder site must not clobber an already-real value
      return;
    }
    if (existingIsPlaceholder && placeholder) {
      return; // both placeholders — keep the first, nothing lost (both equal `he` by construction)
    }
    // both real, both non-identical → the homograph collision (spec §6)
    collisions.push({ key, en1: known[key], en2: en });
  }

  // ── declarator index: name -> init node, for `_EN`-suffix base lookup ──
  const decls = new Map();
  walk(ast, null, (node) => {
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' && node.init) {
      if (!decls.has(node.id.name)) decls.set(node.id.name, node.init);
    }
  });

  // ── mode 2(c) — nested leaf-pair recursion (DONE_SCALES-shape), arbitrary depth ──
  // `tableCtx` (M-3, review C2): a leaf reached by RECURSING into a nested object (depth > 0) is
  // emitted under a table-scoped `he␟tableCtx` key instead of a bare key, so a nested-table homograph
  // (e.g. DONE_SCALES.steak.rare='נא') cannot bare-collide with an unrelated bare-keyed sense
  // elsewhere in the corpus (e.g. `L('נא','raw')`). depth-0 (flat, shape (a)) leaves are unaffected.
  function harvestNestedPairs(heNode, enNode, tableCtx, depth = 0) {
    if (!heNode || !enNode || heNode.type !== 'ObjectExpression' || enNode.type !== 'ObjectExpression') return;
    const enByKey = new Map();
    for (const p of enNode.properties) {
      if (p.type !== 'Property') continue;
      const k = propKeyName(p);
      if (k != null) enByKey.set(k, p.value);
    }
    for (const p of heNode.properties) {
      if (p.type !== 'Property') continue;
      const k = propKeyName(p);
      if (k == null || !enByKey.has(k)) continue;
      const heVal = p.value, enVal = enByKey.get(k);
      if (isStringLiteral(heVal) && isStringLiteral(enVal)) {
        if (depth > 0 && tableCtx) {
          setKnownKey(heVal.value + SENT + tableCtx, enVal.value);
        } else {
          setKnownKey(heVal.value, enVal.value);
        }
      } else if (heVal.type === 'ObjectExpression' && enVal.type === 'ObjectExpression') {
        harvestNestedPairs(heVal, enVal, tableCtx, depth + 1);
      }
    }
  }

  // ── mode 2 — `_EN`-suffixed tables: flat (a) / array-partner (b) / nested (c) ──
  for (const [enName, enNode] of decls) {
    if (!enName.endsWith('_EN')) continue;
    if (enNode.type !== 'ObjectExpression') continue; // an _EN table is always the object side
    const baseName = enName.slice(0, -3);

    const special = SPECIAL_BASE_MAP[enName];
    if (special) {
      if (denyTables.has(special.ident) || denyTables.has(enName)) continue;
      const baseNode = decls.get(special.ident);
      if (!baseNode || baseNode.type !== 'ObjectExpression') continue;
      const baseByKey = new Map();
      for (const p of baseNode.properties) {
        if (p.type !== 'Property') continue;
        const k = propKeyName(p);
        if (k != null) baseByKey.set(k, p.value);
      }
      for (const p of enNode.properties) {
        if (p.type !== 'Property' || !isStringLiteral(p.value)) continue;
        const k = propKeyName(p);
        const baseVal = k != null ? baseByKey.get(k) : null;
        if (!baseVal || baseVal.type !== 'ObjectExpression') continue;
        const nameProp = baseVal.properties.find((pp) => pp.type === 'Property' && propKeyName(pp) === special.prop);
        if (nameProp && isStringLiteral(nameProp.value)) {
          setKnownKey(nameProp.value.value, p.value.value);
        }
      }
      continue;
    }

    if (denyTables.has(baseName) || denyTables.has(enName)) continue;
    const baseNode = decls.get(baseName);
    if (!baseNode) continue;

    if (isArrayOfPairs(baseNode)) {
      // (b) array-of-pairs partner: base=[[key,heLabel],…], EN table={key:en}
      if (enNode.type !== 'ObjectExpression') continue;
      const enByKey = new Map();
      for (const p of enNode.properties) {
        if (p.type !== 'Property') continue;
        const k = propKeyName(p);
        if (k != null) enByKey.set(k, p.value);
      }
      for (const pairEl of baseNode.elements) {
        const keyLit = pairEl.elements[0], heLit = pairEl.elements[1];
        const k = String(keyLit.value);
        const enVal = enByKey.get(k);
        if (enVal && isStringLiteral(enVal)) {
          setKnownKey(heLit.value, enVal.value);
        } else {
          setKnownKey(heLit.value, heLit.value, { placeholder: true });
          needsEnSet.add(heLit.value);
        }
      }
      continue;
    }

    if (baseNode.type === 'ObjectExpression') {
      // (a) flat, or (c) nested — decided per shared key, leaf-pair recursion handles both uniformly.
      // tableCtxFor(baseName) only takes effect for leaves reached by recursing (depth > 0, shape (c)).
      harvestNestedPairs(baseNode, enNode, tableCtxFor(baseName));
      continue;
    }
    // unrecognized base shape — skip (not one of the 3 known _EN-table shapes)
  }

  // ── mode 5 — post-`_EN`-deletion seed harvest (Task 4 wrinkle, see file header + registry above).
  // A single-tree walk (no partner) over each POST_DELETION_TABLES identifier still present in the
  // source; `en` comes from `seed`, never from the AST (there is nothing left to read it from). ──
  function harvestSeededLeaf(key, heVal, needsEnSet) {
    const en = seed[key];
    if (en != null) { setKnownKey(key, en); return; }
    setKnownKey(key, heVal, { placeholder: true });
    needsEnSet.add(key);
  }
  function harvestSoloTree(node, ctx, depth, needsEnSet) {
    if (!node || node.type !== 'ObjectExpression') return;
    for (const p of node.properties) {
      if (p.type !== 'Property') continue;
      const v = p.value;
      if (isStringLiteral(v)) {
        const heVal = v.value;
        const key = (depth > 0 && ctx) ? heVal + SENT + ctx : heVal;
        harvestSeededLeaf(key, heVal, needsEnSet);
      } else if (v.type === 'ObjectExpression') {
        harvestSoloTree(v, ctx, depth + 1, needsEnSet);
      }
    }
  }
  for (const table of POST_DELETION_TABLES) {
    if (denyTables.has(table.ident)) continue;
    const node = decls.get(table.ident);
    if (!node) continue; // table not present (already deleted upstream, or a test fixture) — skip
    if (table.shape === 'flat') {
      harvestSoloTree(node, null, 0, needsEnSet);
    } else if (table.shape === 'nested') {
      harvestSoloTree(node, table.ctx, 0, needsEnSet);
    } else if (table.shape === 'array') {
      if (node.type !== 'ArrayExpression') continue;
      for (const pairEl of node.elements) {
        if (!pairEl || pairEl.type !== 'ArrayExpression' || pairEl.elements.length !== 2) continue;
        const heLit = pairEl.elements[1];
        if (!isStringLiteral(heLit)) continue;
        harvestSeededLeaf(heLit.value, heLit.value, needsEnSet);
      }
    } else if (table.shape === 'prop') {
      if (node.type !== 'ObjectExpression') continue;
      for (const p of node.properties) {
        if (p.type !== 'Property' || !p.value || p.value.type !== 'ObjectExpression') continue;
        const nameProp = p.value.properties.find((pp) => pp.type === 'Property' && propKeyName(pp) === table.prop);
        if (nameProp && isStringLiteral(nameProp.value)) {
          harvestSeededLeaf(nameProp.value.value, nameProp.value.value, needsEnSet);
        }
      }
    }
  }

  // ── mode 2-generic — sibling `{he:…, en:…}` object literals anywhere in the file (the ~48
  //    expr-arg data objects: PREHEAT, DEVICE_FUEL, cm() catalog entries, prop.opts, makes,
  //    capability specs, …). Deny-listed by the nearest enclosing `const NAME = …` identifier. ──
  // ── mode 4 — names: sibling `{heb:…, eng:…}` object literals → __names__ sub-map (spec I-D). ──
  walk(ast, null, (node) => {
    if (node.type !== 'ObjectExpression') return;
    const heP = node.properties.find((p) => p.type === 'Property' && propKeyName(p) === 'he' && isStringLiteral(p.value));
    const enP = node.properties.find((p) => p.type === 'Property' && propKeyName(p) === 'en' && isStringLiteral(p.value));
    if (heP && enP) {
      const declName = nearestDeclName(node);
      // C3 semantic guard: a shape-only {he,en} match whose `he` value carries no Hebrew codepoint
      // is not a UI translation pair (e.g. LANG_FLAG's he/en are language codes with flag emoji) —
      // skip regardless of the deny-list, which only covers named/known offenders.
      if ((!declName || !denyTables.has(declName)) && HEBREW_RE.test(heP.value.value)) {
        // Task 5 (spec §6) — the same primary-bare-key mechanism as mode 1's L(he,en,ctx): a sibling
        // `ctx:` string-literal property marks this {he,en} object as a NON-primary homograph sense
        // (e.g. a props-array entry rendered generically through `L(p.he,p.en,p.ctx)`, spec §3.3's
        // "L(o.he,o.en)@7849" shape). When `ctx` is present, emit the compound key ONLY — never the
        // bare key — so an object-literal homograph sense can never collide with, or silently steal,
        // the bare key from its L()-call-site primary. An object with no `ctx` property behaves as
        // before: bare key, real collision detection.
        const ctxP = node.properties.find((p) => p.type === 'Property' && propKeyName(p) === 'ctx' && isStringLiteral(p.value));
        if (ctxP) {
          setKnownKey(heP.value.value + SENT + ctxP.value.value, enP.value.value);
        } else {
          setKnownKey(heP.value.value, enP.value.value);
        }
      }
      return; // an {he,en} object is not also a {heb,eng} name object
    }
    const hebP = node.properties.find((p) => p.type === 'Property' && propKeyName(p) === 'heb' && isStringLiteral(p.value));
    const engP = node.properties.find((p) => p.type === 'Property' && propKeyName(p) === 'eng' && isStringLiteral(p.value));
    if (hebP && engP) {
      const declName = nearestDeclName(node);
      if (!declName || !denyTables.has(declName)) {
        if (!(hebP.value.value in names)) names[hebP.value.value] = engP.value.value;
      }
    }
  });

  // ── mode 6 — `<prefix>He`/`<prefix>En` sibling data-pairs (capHe/capEn, uHe/uEn, hintHe/hintEn, …)
  // not caught by the exact `he`/`en` walk above. Spec §3.3 C2 completeness: these UI label pairs are
  // rendered via `he?obj.capHe:obj.capEn` and must be in the KNOWN set or they leak in fr/de/es/it.
  // Same C3 Hebrew-codepoint guard + deny-list as the bare he/en walk. Bare `he`/`En`-only excluded.
  walk(ast, null, (node) => {
    if (node.type !== 'ObjectExpression') return;
    const declName = nearestDeclName(node);
    if (declName && denyTables.has(declName)) return;
    for (const p of node.properties) {
      if (p.type !== 'Property' || !isStringLiteral(p.value)) continue;
      const k = propKeyName(p);
      if (!k || k === 'he' || !/[A-Za-z]He$/.test(k)) continue;   // <prefix>He (prefix ends in a letter), not bare 'he'
      const prefix = k.slice(0, -2);
      const enProp = node.properties.find((pp) => pp.type === 'Property' && propKeyName(pp) === prefix + 'En' && isStringLiteral(pp.value));
      if (!enProp) continue;
      if (!HEBREW_RE.test(p.value.value)) continue;               // C3 semantic guard
      setKnownKey(p.value.value, enProp.value.value);
    }
  });

  // ── mode 1 — static L(strLit,strLit[,strLit]) / t(strLit[,strLit]) ──
  // ── mode 3 — toast(strLit,…) first-args + the tr(x||'default-label') shape ──
  walk(ast, null, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return;
    const name = node.callee.name;
    const args = node.arguments;

    // ternary-branch L — L(cond?'heA':'heB', cond?'enA':'enB' | 'en') (plurals/conditionals, spec §3.3 C2):
    // both Hebrew branches are literals → harvest each branch's (he,en) pair so they enter the KNOWN set.
    if (name === 'L' && args.length >= 2 && args[0].type === 'ConditionalExpression'
        && isStringLiteral(args[0].consequent) && isStringLiteral(args[0].alternate)) {
      const heA = args[0].consequent.value, heB = args[0].alternate.value;
      let enA, enB;
      if (args[1].type === 'ConditionalExpression' && isStringLiteral(args[1].consequent) && isStringLiteral(args[1].alternate)) {
        enA = args[1].consequent.value; enB = args[1].alternate.value;
      } else if (isStringLiteral(args[1])) { enA = enB = args[1].value; }
      if (enA !== undefined) {
        if (HEBREW_RE.test(heA)) setKnownKey(heA, enA);
        if (HEBREW_RE.test(heB)) setKnownKey(heB, enB);
      }
      return;
    }

    if (name === 'L' && args.length >= 1 && isStringLiteral(args[0])) {
      const he = args[0].value;
      if (args.length >= 2 && isStringLiteral(args[1])) {
        const en = args[1].value;
        const ctx = args.length >= 3 && isStringLiteral(args[2]) ? args[2].value : undefined;
        // Task 5 (spec §6) — primary-bare-key mechanism, ORDER-INDEPENDENT by construction.
        // The T2/C1 approach (a ctx'd site always wrote the bare key too, first-write-wins via
        // `noCollision`) broke when a non-primary ctx'd site happened to appear earlier in app.js
        // than its homograph's designated-primary 2-arg site: the later plain `setKnownKey(he,en)`
        // call carries no `noCollision` flag, so it would throw against the ctx'd site's earlier
        // (wrong-sense) bare write — file order, not sense, decided the outcome.
        // Fix: a ctx'd call NEVER touches the bare key by itself. Exactly ONE call site per
        // homograph is the designated PRIMARY sense and owns the bare key, chosen ONE of two ways:
        //   (a) — the common case — leave that one sense's call as a plain 2-arg `L(he,en)`; it
        //         writes the bare key through the normal (real-collision-checked) path below, with
        //         no ctx involved at all.
        //   (b) — when every sense's call site needs a ctx label (e.g. no sense is naturally the
        //         "leave it alone" 2-arg site, or a future homograph needs it), pass an explicit 4th
        //         arg `true`: `L(he, en, ctx, true)` marks THIS ctx'd site as ALSO the primary — it
        //         writes the bare key too, through the same real-collision-checked path (not
        //         first-write-wins), so a mistaken double-primary still throws.
        // A ctx'd site with no primary marker writes ONLY its compound key — never the bare key —
        // so file order can no longer affect which sense ends up bare-keyed.
        const isPrimary = args.length >= 4 && args[3] && args[3].type === 'Literal' && args[3].value === true;
        if (ctx) {
          setKnownKey(he + SENT + ctx, en);
          if (isPrimary) setKnownKey(he, en);
        } else {
          setKnownKey(he, en);
        }
      }
      // a dynamic (non-literal) 2nd arg is an expr-arg / computed-ternary shape, out of static
      // mode-1 scope by design (handled by mode-2-generic on the underlying {he,en} object, or is
      // v269 territory for a genuinely computed ternary) — skip, not an error.
      return;
    }

    if (name === 't' && args.length >= 1 && isStringLiteral(args[0])) {
      const he = args[0].value;
      if (args.length >= 2 && isStringLiteral(args[1])) {
        setKnownKey(he, args[1].value);
      } else {
        // t(he) with no English 2nd arg — the I4 leak: emit a placeholder + flag needs-en.
        setKnownKey(he, he, { placeholder: true });
        needsEnSet.add(he);
      }
      return;
    }

    if (name === 'toast' && args.length >= 1 && isStringLiteral(args[0])) {
      const he = args[0].value;
      if (he in known && !placeholderKeys.has(he)) {
        // a real English value already exists for this exact text from another site — reuse it
        setKnownKey(he, known[he]);
      } else {
        setKnownKey(he, he, { placeholder: true });
        needsEnSet.add(he);
      }
      return;
    }

    if (name === 'tr' && args.length >= 1 && args[0].type === 'LogicalExpression' && args[0].operator === '||' && isStringLiteral(args[0].right)) {
      // the toast() default action-label shape: tr(actionLabel||'בטל') — app.js:3541
      const he = args[0].right.value;
      if (he in known && !placeholderKeys.has(he)) {
        setKnownKey(he, known[he]);
      } else {
        setKnownKey(he, he, { placeholder: true });
        needsEnSet.add(he);
      }
    }
  });

  if (collisions.length && opts.throwOnCollision !== false) {
    const msg = collisions
      .map((c) => `  key "${c.key}": "${c.en1}"  vs  "${c.en2}"`)
      .join('\n');
    throw new Error(
      `i18n-extract: homograph collision(s) — two sites share a bare he key with different en and no ctx (spec §6). ` +
      `Add a distinct ctx to L(he,en,ctx) at each colliding site:\n${msg}`
    );
  }

  known.__names__ = names;
  const needsEn = Array.from(needsEnSet).sort();
  return { known, needsEn, collisions };
}

// ── CLI ──
// --allow-collisions: by default the CLI mirrors extract()'s hard-fail-on-collision semantics
// (spec §6 — "a collision lint fails extraction"), matching Task 5's Step 1, which relies on this
// exact failure as ITS OWN RED. Pass --allow-collisions to still WRITE the artifact for downstream
// inspection while every collision is printed in full — used for Task 2's first real-corpus run,
// where the ~31+ pre-existing homographs (spec §6's own audit finding, e.g. עישון/נא/אש) are not yet
// ctx-disambiguated (that is Task 5's job). This does not weaken the lint itself: `extract()` still
// computes and reports every collision; this flag only decides whether the CLI treats their presence
// as fatal for the write step.
async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--allow-collisions');
  const allowCollisions = process.argv.includes('--allow-collisions');
  const inputPath = args[0] || 'app.js';
  const outputPath = args[1] || 'lang/_extracted.json';
  const src = fs.readFileSync(inputPath, 'utf8');
  // Mode 5 seed (Task 4 wrinkle): the artifact we are about to (re)write is also this run's INPUT for
  // the post-`_EN`-deletion tables — read it BEFORE overwriting. Idempotent: as long as the seeded
  // tables' Hebrew text is unchanged, a fresh run reproduces the same he->en pairs every time.
  let seed = {};
  try { if (fs.existsSync(outputPath)) seed = JSON.parse(fs.readFileSync(outputPath, 'utf8')); } catch (e) { seed = {}; }
  const { known, needsEn, collisions } = extract(src, { throwOnCollision: !allowCollisions, seed });
  if (collisions && collisions.length) {
    console.log(`[i18n-extract] ${collisions.length} homograph collision(s) found (spec §6) — bare he key, differing en, no ctx:`);
    for (const c of collisions) console.log(`  key "${c.key}": "${c.en1}"  vs  "${c.en2}"`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(known, null, 2) + '\n', 'utf8');
  const knownCount = Object.keys(known).filter((k) => k !== '__names__').length;
  const namesCount = Object.keys(known.__names__ || {}).length;
  console.log(`[i18n-extract] wrote ${outputPath}`);
  console.log(`[i18n-extract] KNOWN chrome keys: ${knownCount}`);
  console.log(`[i18n-extract] __names__ entries: ${namesCount}`);
  console.log(`[i18n-extract] needs-en (t(he) / toast / default-label with no English): ${needsEn.length}`);
  if (needsEn.length) {
    console.log(`[i18n-extract] needs-en sample (first 10): ${JSON.stringify(needsEn.slice(0, 10))}`);
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((e) => { console.error(e.stack || String(e)); process.exit(1); });
}
