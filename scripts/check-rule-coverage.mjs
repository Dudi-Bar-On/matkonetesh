#!/usr/bin/env node
// check-rule-coverage — Task 12 (docs/superpowers/specs/2026-08-08-rule-coverage-design.md §3/§4).
//
// Answers ONE question, always: of the mechanically-enforceable rules (rule_group A or B, measured
// live from rules.sqlite — never hardcoded 58), how many does a real hook file DECLARE it enforces
// via `export const RULE_IDS = [...]`?
//
// Declaration reading is a STATIC PARSE, never an import: regex over each .mjs file's source text
// under scripts/hooks/{rules,stop-rules,observers}/ (the runner files pretooluse.mjs/stop.mjs/
// posttooluse.mjs at scripts/hooks/ top level are NOT scanned — only the three rule/observer dirs).
// Importing would execute hook module top-levels (state files, port probes) inside a gate that runs
// at every session start; a parse reads the declaration as data, without running anything.
//
// GATE SCOPING (matches this file's own header — see check-meta.mjs's "GATE SCOPING" ruling, which
// this comment answers per its own instruction to justify severity here in code):
//   - The standing 45-ish-rule gap (rule_group A/B rules nobody has wired a hook for yet) is
//     REPORTED, never blocking. Per L70: "a gate that blocks every commit until all 58 are
//     implemented is switched off within a day." Closing that gap is a programme, not a single
//     commit's cheap fix — exactly the "separate heavy action" this file's sibling gates refuse to
//     block on.
//   - What DOES block, always, is a defect the tripping commit itself introduced and can undo with
//     one cheap edit: a rule file that lost its RULE_IDS export (undeclared coverage — restore the
//     line), a declared id that names no rule in the corpus (typo — fix the id), a mirror row whose
//     mechanism value fell outside the 12-value vocabulary (a hand-edit — fix the value), and a
//     REGRESSION against the committed baseline (a rule that WAS covered and no longer is — restore
//     the declaration, or if the loss is intended, the owner approves it explicitly by running
//     --update-baseline; a gate that rewrote its own baseline on every green run would be approving
//     the very regression it exists to catch, so it never does that on a plain run).
//   - The number prints on EVERY run, pass or fail, computed before any verdict — a gate that only
//     reports coverage when it's happy is not a coverage gate, it's a pass/fail toy.
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const HOOKS_ROOT = process.env.RULE_COVERAGE_HOOKS_ROOT || join(ROOT, 'scripts', 'hooks');
const MIRROR_PATH = process.env.RULE_COVERAGE_MIRROR || join(ROOT, 'rules.sqlite');
const BASELINE_PATH = process.env.RULE_COVERAGE_BASELINE || join(ROOT, 'docs', 'process', 'rule-coverage-baseline.json');

const SCAN_DIRS = ['rules', 'stop-rules', 'observers'];

// Same 12-value vocabulary migration 0006 / classify.py's VOCAB enforce as a PostgreSQL CHECK — kept
// as a local literal (not imported from src/rules_store/classify.py) on purpose: this gate reads the
// MIRROR, a different agent is concurrently editing classify.py, and a static parse of a hook file's
// own declaration should not couple its behavior to another file's edit-in-progress.
const MECHANISM_VOCAB = new Set([
  'pretooluse:Bash', 'pretooluse:Edit|Write', 'pretooluse:Agent', 'pretooluse:Grep|WebSearch',
  'posttooluse', 'stop', 'subagentstop', 'sessionstart', 'commit-gate', 'ci-gate',
  'judge', 'none',
]);

const RULE_IDS_RE = /export\s+const\s+RULE_IDS\s*=\s*\[([\s\S]*?)\]/;
const STRING_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;

function extractIds(arrayBody) {
  const ids = [];
  let m;
  STRING_RE.lastIndex = 0;
  while ((m = STRING_RE.exec(arrayBody)) !== null) {
    ids.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return ids;
}

// --- Step 1: scan the three declaration dirs (static parse, never import) -------------------------
const missingExportFiles = []; // relative paths with no RULE_IDS export at all
const declaredIdToFiles = new Map(); // id -> Set(relative file paths)
const scannedFiles = [];

for (const sub of SCAN_DIRS) {
  const dir = join(HOOKS_ROOT, sub);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.mjs')).sort();
  for (const f of files) {
    const full = join(dir, f);
    const rel = relative(ROOT, full).replaceAll('\\', '/');
    scannedFiles.push(rel);
    const text = readFileSync(full, 'utf8');
    const match = text.match(RULE_IDS_RE);
    if (!match) {
      missingExportFiles.push(rel);
      continue;
    }
    const ids = extractIds(match[1]);
    for (const id of ids) {
      if (!declaredIdToFiles.has(id)) declaredIdToFiles.set(id, new Set());
      declaredIdToFiles.get(id).add(rel);
    }
  }
}

// --- Step 2: read the mirror (rules.sqlite) — current rows only ------------------------------------
let mirrorRows = [];
let mirrorError = null;
if (!existsSync(MIRROR_PATH)) {
  mirrorError = `mirror not found at ${MIRROR_PATH}`;
} else {
  try {
    const db = new DatabaseSync(MIRROR_PATH, { readOnly: true });
    try {
      mirrorRows = db.prepare(
        "SELECT rule_id, rule_group, mechanism, mechanism_target FROM rule_revisions WHERE revision_status = 'current'"
      ).all();
    } finally {
      db.close();
    }
  } catch (e) {
    mirrorError = `could not read ${MIRROR_PATH}: ${e.message}`;
  }
}

if (mirrorError) {
  console.log(`RULE COVERAGE: 0 of 0 mechanically-enforceable rules covered (0 open)`);
  console.log(`MECHANISM DECLARED: 0 of 0 A/B rules carry mechanism+target (0 open)`);
  console.log(`ERROR: ${mirrorError}`);
  process.exit(1);
}

const mirrorById = new Map();
for (const row of mirrorRows) mirrorById.set(row.rule_id, row);

const abRows = mirrorRows.filter(r => r.rule_group === 'A' || r.rule_group === 'B');
const d = abRows.length;

// --- Step 3: mirror vocabulary integrity (checks the WHOLE current mirror, not just declared ids) -
const vocabErrors = [];
for (const row of mirrorRows) {
  if (row.mechanism !== null && row.mechanism !== undefined && !MECHANISM_VOCAB.has(row.mechanism)) {
    vocabErrors.push({ id: row.rule_id, mechanism: row.mechanism });
  }
}

// --- Step 4: validate declared ids against the mirror; split covered (A/B) vs info (C/none) --------
const phantomIds = []; // declared, but no current row in the mirror at all — the §99 case
const nonAbDeclaredIds = []; // declared AND exists, but rule_group is C/none — info only
const coveredSet = new Set();

for (const [id, files] of declaredIdToFiles) {
  const row = mirrorById.get(id);
  if (!row) {
    phantomIds.push({ id, files: [...files] });
    continue;
  }
  if (row.rule_group === 'A' || row.rule_group === 'B') {
    coveredSet.add(id);
  } else {
    nonAbDeclaredIds.push(id);
  }
}

const n = coveredSet.size;
const m = abRows.filter(r => r.mechanism !== null && r.mechanism !== undefined).length;

// --- Print the numbers FIRST, before any verdict — this is the property that must survive every run
console.log(`RULE COVERAGE: ${n} of ${d} mechanically-enforceable rules covered (${d - n} open)`);
console.log(`MECHANISM DECLARED: ${m} of ${d} A/B rules carry mechanism+target (${d - m} open)`);
if (nonAbDeclaredIds.length) {
  console.log(`INFO: ${nonAbDeclaredIds.length} declared id(s) belong to a C/none-group rule and do not count toward coverage: ${[...new Set(nonAbDeclaredIds)].sort().join(', ')}`);
}
if (missingExportFiles.length === 0 && scannedFiles.length > 0) {
  console.log(`scanned ${scannedFiles.length} file(s) under rules/stop-rules/observers — every one declares RULE_IDS.`);
}

// --- Errors (exit 1, always, independent of baseline) ----------------------------------------------
const errorLines = [];
for (const f of missingExportFiles) {
  errorLines.push(`ERROR: ${f} has no \`export const RULE_IDS = [...]\` — an undeclared rule file is invisible coverage. Add the export (an empty array is valid for a file that enforces nothing, e.g. an observer).`);
}
for (const { id, files } of phantomIds) {
  errorLines.push(`ERROR: declared id '${id}' (in ${files.join(', ')}) has no current row in the mirror — claiming to enforce a rule that does not exist is false coverage, worse than no coverage.`);
}
for (const { id, mechanism } of vocabErrors) {
  errorLines.push(`ERROR: mirror row '${id}' has mechanism '${mechanism}', not one of the 12-value vocabulary.`);
}

// --- Baseline -----------------------------------------------------------------------------------
let baseline = null; // parsed {covered:[...], updated:...} or null if not-yet-armed
let baselineParseError = null;
const baselineExists = existsSync(BASELINE_PATH);
if (baselineExists) {
  const raw = readFileSync(BASELINE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.covered)) {
      throw new Error('missing or non-array "covered" field');
    }
    baseline = parsed;
  } catch (e) {
    baselineParseError = e.message;
    baseline = null;
  }
}
if (baselineParseError) {
  errorLines.push(`ERROR: baseline at ${BASELINE_PATH} exists but could not be parsed: ${baselineParseError} — a corrupt baseline silently disables regression detection, which is itself an error.`);
}

// --- Regression (exit 1): a baseline-covered id that no scanned file declares any more -------------
const regressionLines = [];
if (baseline) {
  const lostIds = baseline.covered.filter(id => !declaredIdToFiles.has(id)).sort();
  for (const id of lostIds) {
    regressionLines.push(
      `REGRESSION: '${id}' was covered at the committed baseline and no rule file declares it now. ` +
      `If this loss is intended, the owner approves it and the baseline is updated explicitly: ` +
      `node scripts/check-rule-coverage.mjs --update-baseline`
    );
  }
}

// --- Never blocks on: standing gap, coverage AHEAD of baseline -------------------------------------
if (baseline) {
  const aheadIds = [...coveredSet].filter(id => !baseline.covered.includes(id)).sort();
  if (aheadIds.length > 0 && regressionLines.length === 0) {
    console.log(`ahead of baseline by ${aheadIds.length} — run --update-baseline to bank it (${aheadIds.join(', ')})`);
  }
} else if (!baselineParseError) {
  console.log('no committed baseline yet — regression detection arms after --update-baseline');
}

for (const l of errorLines) console.log(l);
for (const l of regressionLines) console.log(l);

// --- --update-baseline: never runs implicitly, refuses when a real ERROR (not a regression) is present
const updateFlag = process.argv.includes('--update-baseline');
if (updateFlag) {
  if (errorLines.length > 0) {
    console.log('REFUSED: --update-baseline will not write while the errors above are present — fix them first, then re-run.');
    process.exit(1);
  }
  const newCovered = [...coveredSet].sort();
  const today = new Date().toISOString().slice(0, 10);
  const oldCovered = baseline ? baseline.covered : [];
  const added = newCovered.filter(id => !oldCovered.includes(id));
  const removed = oldCovered.filter(id => !newCovered.includes(id));
  writeFileSync(BASELINE_PATH, JSON.stringify({ covered: newCovered, updated: today }, null, 2) + '\n', 'utf8');
  if (!baselineExists) {
    console.log(`baseline created at ${BASELINE_PATH}: ${newCovered.length} covered id(s).`);
  } else {
    console.log(`baseline updated at ${BASELINE_PATH}: ${newCovered.length} covered id(s) (added: ${added.length ? added.join(', ') : 'none'}; removed: ${removed.length ? removed.join(', ') : 'none'}).`);
  }
  process.exit(0);
}

// --- Default run: the baseline file is NEVER written here (verified by a self-test) ---------------
const hasErrors = errorLines.length > 0 || regressionLines.length > 0;
process.exit(hasErrors ? 1 : 0);
