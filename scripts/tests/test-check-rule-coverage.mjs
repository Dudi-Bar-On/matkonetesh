#!/usr/bin/env node
// scripts/tests/test-check-rule-coverage.mjs — Task 12 self-test for scripts/check-rule-coverage.mjs.
//
// Same `check(label, cond, detail)` pattern as test-rules-store-drift.mjs. Every case spawns the gate
// via spawnSync with the three env overrides (RULE_COVERAGE_HOOKS_ROOT, RULE_COVERAGE_MIRROR,
// RULE_COVERAGE_BASELINE) pointed at a fixture built fresh in a temp dir — never at the real repo
// tree or the real rules.sqlite. Case 1 is listed first deliberately: it is the counter-RED, the L70
// case — the gate must NOT block on the standing gap.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE = join(ROOT, 'scripts', 'check-rule-coverage.mjs');

let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`PASS  ${label}`);
}

function freshDir(name) {
  return mkdtempSync(join(tmpdir(), `rule-coverage-${name}-`));
}

function writeHooksTree(dir, { declareGood = ['9'], includeSilent = false } = {}) {
  const rulesDir = join(dir, 'rules');
  const obsDir = join(dir, 'observers');
  mkdirSync(rulesDir, { recursive: true });
  mkdirSync(obsDir, { recursive: true });
  writeFileSync(
    join(rulesDir, 'good.mjs'),
    `// fixture rule file\nexport const RULE_IDS = [${declareGood.map(id => `'${id}'`).join(', ')}];\nexport function check() { return true; }\n`,
    'utf8'
  );
  writeFileSync(
    join(obsDir, 'obs.mjs'),
    `// fixture observer\nexport const RULE_IDS = [];\nexport function record() {}\n`,
    'utf8'
  );
  if (includeSilent) {
    writeFileSync(join(rulesDir, 'silent.mjs'), `// fixture rule file with NO export\nexport function check() { return true; }\n`, 'utf8');
  }
  return dir;
}

function buildMirror(path, rows) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE rule_revisions (
      rule_id TEXT PRIMARY KEY,
      rule_group TEXT,
      mechanism TEXT,
      mechanism_target TEXT,
      revision_status TEXT NOT NULL
    );
  `);
  const insert = db.prepare(
    'INSERT INTO rule_revisions (rule_id, rule_group, mechanism, mechanism_target, revision_status) VALUES (?, ?, ?, ?, ?)'
  );
  for (const r of rows) {
    insert.run(r.rule_id, r.rule_group ?? null, r.mechanism ?? null, r.mechanism_target ?? null, r.revision_status ?? 'current');
  }
  db.close();
}

const BASE_MIRROR_ROWS = [
  { rule_id: '9', rule_group: 'A', mechanism: 'pretooluse:Bash', mechanism_target: 'git commit' },
  { rule_id: '10.2', rule_group: 'B', mechanism: null, mechanism_target: null },
  { rule_id: 'L1', rule_group: 'none', mechanism: null, mechanism_target: null },
];

function runGate(env, extraArgs = []) {
  return spawnSync(process.execPath, [GATE, ...extraArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function envFor(hooksDir, mirrorPath, baselinePath) {
  return {
    RULE_COVERAGE_HOOKS_ROOT: hooksDir,
    RULE_COVERAGE_MIRROR: mirrorPath,
    RULE_COVERAGE_BASELINE: baselinePath,
  };
}

// ============================================================================================
// Case 1 (LISTED FIRST, deliberately — the counter-RED, the L70 case): the standing gap does
// NOT block. 2 A/B rules in the mirror, only 1 declared. Exit 0.
// ============================================================================================
{
  const dir = freshDir('case1');
  const hooksDir = writeHooksTree(join(dir, 'hooks'));
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, BASE_MIRROR_ROWS);
  const baselinePath = join(dir, 'baseline.json'); // does not exist
  const r = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case1: exit 0 despite the standing gap (does NOT block)', r.status === 0, `status=${r.status} stdout=${r.stdout}`);
  check(
    'case1: stdout matches "RULE COVERAGE: 1 of 2 mechanically-enforceable rules covered (1 open)"',
    /RULE COVERAGE: 1 of 2 mechanically-enforceable rules covered \(1 open\)/.test(r.stdout),
    r.stdout
  );
}

// ============================================================================================
// Case 2: a rule file with no RULE_IDS export → exit 1, names silent.mjs.
// ============================================================================================
{
  const dir = freshDir('case2');
  const hooksDir = writeHooksTree(join(dir, 'hooks'), { includeSilent: true });
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, BASE_MIRROR_ROWS);
  const baselinePath = join(dir, 'baseline.json');
  const r = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case2: exit 1 (an undeclared rule file is invisible coverage)', r.status === 1, `status=${r.status}`);
  check('case2: output names silent.mjs', r.stdout.includes('silent.mjs'), r.stdout);
}

// ============================================================================================
// Case 3: declaration ['§99'] (a phantom id, spec §3's own example) → exit 1, names §99.
// ============================================================================================
{
  const dir = freshDir('case3');
  const hooksDir = writeHooksTree(join(dir, 'hooks'), { declareGood: ['§99'] });
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, BASE_MIRROR_ROWS);
  const baselinePath = join(dir, 'baseline.json');
  const r = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case3: exit 1 (a declared id with no row in the mirror is an error)', r.status === 1, `status=${r.status}`);
  check('case3: output names §99', r.stdout.includes('§99'), r.stdout);
}

// ============================================================================================
// Case 4: baseline contains '10.2', no file declares it → exit 1, REGRESSION naming 10.2.
// Case 5 (same fixture): the baseline file's bytes are UNCHANGED after the failing run.
// ============================================================================================
{
  const dir = freshDir('case4');
  const hooksDir = writeHooksTree(join(dir, 'hooks')); // only declares '9'
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, BASE_MIRROR_ROWS);
  const baselinePath = join(dir, 'baseline.json');
  const baselineContent = JSON.stringify({ covered: ['10.2'], updated: '2026-08-01' }, null, 2) + '\n';
  writeFileSync(baselinePath, baselineContent, 'utf8');
  const before = readFileSync(baselinePath, 'utf8');

  const r = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case4: exit 1 (regression against the committed baseline)', r.status === 1, `status=${r.status}`);
  check('case4: output contains REGRESSION and 10.2', r.stdout.includes('REGRESSION') && r.stdout.includes('10.2'), r.stdout);

  const after = readFileSync(baselinePath, 'utf8');
  check('case5: baseline file bytes UNCHANGED after the failing run (the gate never self-updates)', before === after, `before=${before.length}b after=${after.length}b`);
}

// ============================================================================================
// Case 6: --update-baseline on the healthy tree rewrites the baseline to {"covered":["9"]},
// and a subsequent normal run exits 0.
// ============================================================================================
{
  const dir = freshDir('case6');
  const hooksDir = writeHooksTree(join(dir, 'hooks'));
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, BASE_MIRROR_ROWS);
  const baselinePath = join(dir, 'baseline.json'); // does not exist yet

  const update = runGate(envFor(hooksDir, mirrorPath, baselinePath), ['--update-baseline']);
  check('case6: --update-baseline exits 0', update.status === 0, `status=${update.status} stdout=${update.stdout}`);
  const written = JSON.parse(readFileSync(baselinePath, 'utf8'));
  check('case6: baseline now has covered=["9"]', Array.isArray(written.covered) && written.covered.length === 1 && written.covered[0] === '9', JSON.stringify(written));

  const after = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case6: a subsequent normal run exits 0', after.status === 0, `status=${after.status} stdout=${after.stdout}`);
}

// ============================================================================================
// Case 7: a mirror row with mechanism='banana' → exit 1, names banana.
// ============================================================================================
{
  const dir = freshDir('case7');
  const hooksDir = writeHooksTree(join(dir, 'hooks'));
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, [
    ...BASE_MIRROR_ROWS,
    { rule_id: '77', rule_group: 'A', mechanism: 'banana', mechanism_target: null },
  ]);
  const baselinePath = join(dir, 'baseline.json');
  const r = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case7: exit 1 (mechanism outside the 12-value vocabulary)', r.status === 1, `status=${r.status}`);
  check('case7: output names banana', r.stdout.includes('banana'), r.stdout);
}

// ============================================================================================
// Case 8: coverage AHEAD of baseline (baseline [], file declares '9') → exit 0, "ahead of baseline".
// ============================================================================================
{
  const dir = freshDir('case8');
  const hooksDir = writeHooksTree(join(dir, 'hooks'));
  const mirrorPath = join(dir, 'mirror.sqlite');
  buildMirror(mirrorPath, BASE_MIRROR_ROWS);
  const baselinePath = join(dir, 'baseline.json');
  writeFileSync(baselinePath, JSON.stringify({ covered: [], updated: '2026-08-01' }, null, 2) + '\n', 'utf8');
  const r = runGate(envFor(hooksDir, mirrorPath, baselinePath));
  check('case8: exit 0 (coverage ahead of baseline never blocks)', r.status === 0, `status=${r.status} stdout=${r.stdout}`);
  check('case8: output contains "ahead of baseline"', r.stdout.includes('ahead of baseline'), r.stdout);
}

console.log(`\ntest-check-rule-coverage: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
