#!/usr/bin/env node
// scripts/check-corpus-consistency.mjs — the whole-corpus consistency gate (Arc 4, Task 8).
//
// WHY THIS EXISTS (owner ruling, 2026-08-11, BLOCKING from day one). Every gate this project has
// built so far checks ONE script or ONE file. Nothing checks the body of knowledge — rules, gates,
// lessons, guidelines, discipline — AS ONE THING. A rule can exist in the discipline doc, be absent
// from the mirror, be counted by a coverage number and enforced by nothing, and no existing check
// would notice. This is that check.
//
// THE FOUR QUESTIONS THIS GATE ASKS:
//   1. Enforcement resolution — every `current` rule with rule_group A or B declares a mechanism +
//      mechanism_target; does that mechanism actually resolve to something real? A
//      pretooluse/stop/posttooluse/subagentstop mechanism must have a hook rule file (anywhere
//      under --hooks-root) declaring that RULE_ID (via `RULE_ID = '...'` or `RULE_IDS = [...]`).
//      A commit-gate/ci-gate mechanism must name an existing scripts/check-*.mjs (or a path that
//      exists on disk). A rule that resolves to nothing is UNENFORCED.
//   2. Classification totality — every `current` rule has a non-empty rule_group. This deliberately
//      overlaps check-rules-classified.mjs as a cross-check ONLY in the report; it does not
//      double-block on classification-absence alone (that stays check-rules-classified's job) — it
//      only blocks through the same baseline-diff mechanism as every other question here.
//   3. Coverage-vs-reachability — every RULE_ID declared by a hook rule file must appear asserted in
//      a wiring/liveness test (tests/test_*wiring*.py, corpus-wide, not per-phase).
//      set(declared) - set(asserted) is the unreachable-unproven list.
//   4. Doc-vs-code drift, narrow and mechanical only — two specific, decidable probes:
//        (a) no hook/gate file whose header says "NOT wired" / "not wired yet" while the file IS
//            reachable from a real dispatcher (the pretooluse.mjs incident);
//        (b) every scripts/*.mjs|py|sh path named in a rule's mechanism_target exists on disk.
//
// THE TWO QUESTIONS THIS GATE DOES NOT ASK (L77 — a gate must not claim more than it measures):
//   - whether a rule is classified CORRECTLY (the blind two-classifier criterion answers that);
//   - whether prose documents semantically describe the code. That needs a human audit; pretending
//     a grep answers it is the wrong-instrument mistake this programme has made repeatedly.
//
// BIDIRECTIONAL BASELINE (R-119 shape, same discipline as gate-baselines.json / R-140's
// gate-baseline handling in check-h8-ledger.mjs). L70 is live: "a gate that blocks every commit
// until all findings are fixed is switched off within a day." So this gate blocks only on CHANGE:
//   - a finding present in CURRENT but NOT in the baseline file is NEW (or worsened) -> blocks.
//   - an item present in the baseline but NOT reproduced by CURRENT is REPAIRED BUT STILL LISTED ->
//     blocks too (the fix is to remove it from the baseline in the SAME commit that repairs it,
//     never to leave a stale grandfather entry sitting around forever).
//   - a finding present in BOTH is STANDING DEBT -> printed loudly, never blocks.
// This is bidirectional in both senses: it blocks on new debt AND on debt quietly forgotten to be
// un-grandfathered, so the baseline can never silently drift away from reality in either direction.
//
// Reads the MIRROR (rules.sqlite) the way check-rules-classified.mjs does: spawned Python + stdlib
// sqlite3, through scripts/lib/python-interpreter.mjs (R-147 — never hard-code `py` or bare
// `python`). Fails open (`undecided`, exit 0) on an unreadable mirror OR an unreadable baseline —
// a gate that blocks on its own inability to read stops work for a reason the author cannot act on
// (§10.24).
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { runPython } from './lib/python-interpreter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const MIRROR = arg('--mirror', join(ROOT, 'rules.sqlite'));
const DEFAULT_HOOKS_ROOT = join(ROOT, 'scripts', 'hooks');
const HOOKS_ROOT = arg('--hooks-root', DEFAULT_HOOKS_ROOT);
const BASELINE = arg('--baseline', join(ROOT, 'docs', 'process', 'corpus-consistency-baseline.json'));

// Fail-open, deliberately: an absent/unreadable mirror or baseline, or a Python that will not
// start, are all "this gate could not decide", never "you may not commit" (§10.24 — a block must
// name a reachable alternative).
function undecided(why) {
  console.log(`check-corpus-consistency: could not decide — ${why}. Not blocking.`);
  process.exit(0);
}

if (!MIRROR || !existsSync(MIRROR)) undecided(`no mirror at ${MIRROR ?? '(unset)'}`);
if (!BASELINE || !existsSync(BASELINE)) undecided(`no baseline at ${BASELINE ?? '(unset)'}`);

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch (e) {
  undecided(`the baseline is not readable JSON (${e.message})`);
}
const baselineOf = (key) => Array.isArray(baseline[key]) ? baseline[key] : [];

// ---- 1. read the mirror ----------------------------------------------------------------------
const PY = `
import sqlite3, json
try:
    conn = sqlite3.connect(${JSON.stringify(MIRROR)})
    rows = conn.execute(
        "SELECT rule_id, rule_group, mechanism, mechanism_target FROM rule_revisions "
        "WHERE revision_status = 'current' ORDER BY rule_id").fetchall()
    print(json.dumps({"ok": True, "rows": [
        {"rule_id": r[0], "rule_group": r[1], "mechanism": r[2], "mechanism_target": r[3]}
        for r in rows]}))
except sqlite3.Error as exc:
    print(json.dumps({"ok": False, "why": f"{type(exc).__name__}: {exc}"}))
`;

const { found, result: res, tried } = runPython(['-X', 'utf8', '-c', PY], { encoding: 'utf8' });
if (!found) undecided(`no Python interpreter could be run (${tried.join('; ')})`);
if (res.status !== 0) undecided(`the probe did not run (${res.error?.message ?? `exit ${res.status}`})`);

let out;
try {
  out = JSON.parse(res.stdout.trim());
} catch {
  undecided('the mirror probe returned something that is not JSON');
}
if (!out.ok) undecided(`the mirror could not be read (${out.why})`);

const rows = out.rows;

// ---- 2. scan the hooks tree for declared RULE_ID(s) ------------------------------------------
function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) files.push(...walk(p));
    else if (entry.endsWith('.mjs')) files.push(p);
  }
  return files;
}

const RULE_ID_RE = /RULE_ID\s*=\s*['"]([^'"]+)['"]/g;
const RULE_IDS_RE = /RULE_IDS\s*=\s*\[([^\]]*)]/g;
const QUOTED_RE = /['"]([^'"]+)['"]/g;

const hookFiles = walk(HOOKS_ROOT);
const hookDeclaredRuleIds = new Set();
// A file whose header (first ~40 lines) says a hook/gate is not wired, while it IS reachable
// from a real dispatcher: question 4a below.
const hookDeclarationsByFile = new Map();
for (const f of hookFiles) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const ids = new Set();
  for (const m of text.matchAll(RULE_ID_RE)) ids.add(m[1]);
  for (const m of text.matchAll(RULE_IDS_RE)) {
    for (const q of m[1].matchAll(QUOTED_RE)) ids.add(q[1]);
  }
  for (const id of ids) hookDeclaredRuleIds.add(id);
  hookDeclarationsByFile.set(f, { ids, text });
}

// scripts/check-*.mjs files that declare RULE_IDS: the SAME declaration convention and the SAME
// scan shape check-rule-coverage.mjs already uses for commit-gate/ci-gate rules (its own header,
// "Arc 2 Phase 1": "the ci-gate rules are enforced by standalone gates at scripts/check-*.mjs ...
// They declare RULE_IDS exactly the same way"). R-116 forbids a second detector for a shape that
// already has one, so commit-gate/ci-gate resolution below reuses this exact scan rather than
// trying to interpret mechanism_target as a path — measured live: mechanism_target is FREE TEXT
// ("git commit", "language dictionaries", "docs/STATUS-BOARD.md") in most current rows, not a
// path, so path-matching it produced false unresolved/drift findings before this rewrite.
// Rooted at the fixture too when --hooks-root is a fixture directory (mirrors testsRoot below),
// so a fixture test never depends on this repo's own scripts/ directory.
const scriptsScanRoot = HOOKS_ROOT === DEFAULT_HOOKS_ROOT
  ? join(ROOT, 'scripts')
  : join(dirname(HOOKS_ROOT), 'scripts');
const checkGateDeclaredRuleIds = new Set();
if (existsSync(scriptsScanRoot)) {
  for (const n of readdirSync(scriptsScanRoot).filter((x) => /^check-.*\.mjs$/.test(x))) {
    let text;
    try { text = readFileSync(join(scriptsScanRoot, n), 'utf8'); } catch { continue; }
    if (!/RULE_IDS/.test(text)) continue; // infrastructure gate with no corpus rule behind it
    for (const m of text.matchAll(RULE_IDS_RE)) {
      for (const q of m[1].matchAll(QUOTED_RE)) checkGateDeclaredRuleIds.add(q[1]);
    }
  }
}

// ---- 3. question 1: enforcement resolution -----------------------------------------------------
const HOOK_MECHANISMS = /^(pretooluse(:.*)?|stop|posttooluse|subagentstop)$/i;
const GATE_MECHANISMS = /^(commit-gate|ci-gate)$/i;

function mechanismResolves(rule) {
  const m = (rule.mechanism || '').trim();
  if (!m) return false;
  if (HOOK_MECHANISMS.test(m)) return hookDeclaredRuleIds.has(rule.rule_id);
  if (GATE_MECHANISMS.test(m)) return checkGateDeclaredRuleIds.has(rule.rule_id);
  return false; // an A/B rule with an unrecognized mechanism (e.g. sessionstart, judge) resolves
  // to nothing under either resolution path above — reported, not silently assumed enforced.
}

const abRows = rows.filter((r) => r.rule_group === 'A' || r.rule_group === 'B');
const unenforcedAbRules = abRows.filter((r) => !mechanismResolves(r)).map((r) => r.rule_id).sort();

// ---- 4. question 2: classification totality ----------------------------------------------------
const ungroupedRules = rows
  .filter((r) => r.rule_group == null || String(r.rule_group).trim() === '')
  .map((r) => r.rule_id)
  .sort();

// ---- 5. question 3: coverage-vs-reachability -----------------------------------------------------
// Rooted at the fixture too when --hooks-root is a fixture directory, so fixture tests stay
// hermetic and never read this repo's own tests/ directory.
const testsRoot = HOOKS_ROOT === DEFAULT_HOOKS_ROOT
  ? join(ROOT, 'tests')
  : join(dirname(HOOKS_ROOT), 'tests');

function findWiringTestFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (/^test_.*wiring.*\.py$/i.test(entry)) out.push(join(dir, entry));
  }
  return out;
}

const RULE_ID_TOKEN_RE = /^(L\d+[a-z]?|DoD-\d+|R-\d+|\d+(\.\d+)+[a-z]?)$/;
const wiringFiles = findWiringTestFiles(testsRoot);
let unprovenRuleIds = [];
if (wiringFiles.length) {
  const asserted = new Set();
  for (const f of wiringFiles) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of text.matchAll(QUOTED_RE)) {
      if (RULE_ID_TOKEN_RE.test(m[1])) asserted.add(m[1]);
    }
  }
  unprovenRuleIds = [...hookDeclaredRuleIds].filter((id) => !asserted.has(id)).sort();
}
// No wiring corpus found at all under testsRoot -> question 3 cannot be answered here; leave
// unproven empty rather than treating "found no corpus" as "everything is unproven".

// ---- 6. question 4: doc-vs-code drift, narrow and mechanical -------------------------------------
const NOT_WIRED_RE = /NOT wired|not wired yet/;
const dispatcherFiles = ['pretooluse.mjs', 'stop.mjs', 'posttooluse.mjs', 'subagentstop.mjs', 'pipeline.mjs']
  .map((n) => join(HOOKS_ROOT, n))
  .filter((p) => existsSync(p));
const dispatcherText = dispatcherFiles.map((p) => {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}).join('\n');

const driftFindings = [];
for (const [f, { text }] of hookDeclarationsByFile) {
  // Window is deliberately narrow — this project's own header convention puts a file's own
  // wired/not-wired identity claim on its first comment line(s), right after the shebang. A wider
  // window catches self-correcting HISTORICAL prose too (observed live: pretooluse.mjs quotes its
  // own stale claim inside a "do not trust this line" correction a few lines further down) and
  // turns a narrow, mechanical probe into a false positive — exactly what L77 forbids this gate
  // from doing.
  const header = text.split('\n').slice(0, 3).join('\n');
  if (NOT_WIRED_RE.test(header)) {
    const base = f.split(/[\\/]/).pop();
    const reachable = dispatcherText.includes(base);
    if (reachable) {
      driftFindings.push(`${relative(ROOT, f).replaceAll('\\', '/')} header says "NOT wired" but is reachable from a real dispatcher`);
    }
  }
}
for (const r of rows) {
  const target = (r.mechanism_target || '').trim();
  // Glob-shaped targets ("scripts/**.py", "tests/**.ts") name a CATEGORY of files, not one file —
  // existsSync() on a literal "**" path always fails and would be a false positive, not a real
  // drift. Only a target that names one concrete script path is checked for literal existence.
  if (/^scripts[\\/][^*]*\.(mjs|py|sh)$/i.test(target) && !existsSync(join(ROOT, target))) {
    driftFindings.push(`rule ${r.rule_id}: mechanism_target "${target}" does not exist on disk`);
  }
}
driftFindings.sort();

// ---- 7. bidirectional baseline diff, applied identically to all four questions -------------------
function diffFindings(current, baselineList) {
  const curSet = new Set(current);
  const baseSet = new Set(baselineList);
  return {
    standing: current.filter((x) => baseSet.has(x)),
    added: current.filter((x) => !baseSet.has(x)),
    repaired: baselineList.filter((x) => !curSet.has(x)),
  };
}

const categories = [
  { key: 'unenforced_ab_rules', label: 'ENFORCEMENT RESOLUTION (question 1)', current: unenforcedAbRules },
  { key: 'ungrouped_rules', label: 'CLASSIFICATION TOTALITY (question 2)', current: ungroupedRules },
  { key: 'unproven_rule_ids', label: 'COVERAGE-VS-REACHABILITY (question 3)', current: unprovenRuleIds },
  { key: 'drift_findings', label: 'DOC-VS-CODE DRIFT (question 4)', current: driftFindings },
];

console.log(
  `CORPUS SCAN: ${rows.length} rule(s) read from the mirror (rules scanned: ${rows.length}), `
  + `${abRows.length} A/B, ${hookFiles.length} hook file(s) scanned under ${relative(ROOT, HOOKS_ROOT) || '.'}, `
  + `${wiringFiles.length} wiring test file(s) scanned under ${relative(ROOT, testsRoot) || '.'}.`
);

let blockingTotal = 0;
for (const cat of categories) {
  const { standing, added, repaired } = diffFindings(cat.current, baselineOf(cat.key));
  blockingTotal += added.length + repaired.length;
  console.log(`\n${cat.label}: ${cat.current.length} finding(s) currently.`);
  if (standing.length) {
    console.log(`  STANDING DEBT (pre-existing, printed loudly, not blocking — ${standing.length}):`);
    for (const f of standing) console.log('    ~ ' + f);
  }
  if (added.length) {
    console.log(`  NEW (introduced or worsened by this change — blocking — ${added.length}):`);
    for (const f of added) console.log('    x ' + f);
  }
  if (repaired.length) {
    console.log(`  REPAIRED BUT STILL LISTED (no longer reproduces — remove from the baseline in this `
      + `commit — blocking — ${repaired.length}):`);
    for (const f of repaired) console.log('    x ' + f);
  }
}

if (blockingTotal > 0) {
  console.log(`\nFAIL: check-corpus-consistency — ${blockingTotal} new/worsened/stale-repaired finding(s) `
    + `across the four questions. New findings: fix the rule or add a mechanism. Repaired-but-still-listed: `
    + `remove the item from docs/process/corpus-consistency-baseline.json in this same commit.`);
  process.exit(1);
}
console.log('\nOK — no new or worsened corpus-consistency finding in this change (standing debt reported above, not blocking).');
process.exit(0);
