#!/usr/bin/env node
// check-pytest — the Python test suite is a gate, not a courtesy.
//
// Added 2026-08-04 after a commit landed with a failing pytest. check-meta ran, printed
// META GATE OK, and let it through — because nothing in it looked at Python. The suite had
// been green for hours, which is exactly how a gap like this stays invisible: it only shows
// up on the first failure, and by then the commit is already in.
//
// Fast by construction: the whole suite is ~2 s because every test runs against :memory:
// with LlamaIndex's MockLLM and MockEmbedding. A gate may block when the fix is cheap.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = join(ROOT, 'tests');

const pyTests = existsSync(TESTS)
  ? readdirSync(TESTS).filter((f) => f.startsWith('test_') && f.endsWith('.py'))
  : [];

if (!pyTests.length) {
  console.log('no Python test files (tests/test_*.py) — nothing to run.');
  process.exit(0);
}

// FINDING THE INTERPRETER, which is not as simple as calling `python`.
//
// This gate blocked a commit on 2026-08-05 reporting "the Python suite is red" when the suite was
// green. In the git hook's shell, `python` resolved to the Windows Store APP EXECUTION ALIAS — a
// stub that prints "Python was not found; run without arguments to install from the Microsoft
// Store" and exits NON-ZERO. The gate read that exit code as a test failure.
//
// That is the worst shape a gate can have: not a false negative, a false ACCUSATION. It sends
// someone to debug a suite that never ran. So the interpreter is now searched for, in order, and
// the stub is recognised for what it is — an absence, not a failure.
const CANDIDATES = [
  ['python', []],
  ['py', ['-3']],           // the Windows launcher, which ignores PATH and reads the registry
  ['python3', []],
];
const STORE_STUB = /Python was not found;|Microsoft Store/i;

function runPytest(cmd, pre) {
  return spawnSync(cmd, [...pre, '-m', 'pytest', ...pyTests.map((f) => join('tests', f)), '-q'], {
    cwd: ROOT,
    encoding: 'utf8',
    // CHECK_PYTEST_NESTED (Arc 2 Phase 1, 2026-08-09): tells the Python suite it is running INSIDE
    // this gate's own spawn of pytest, not at a developer's or CI's top level. Exists for exactly one
    // consumer: tests/test_arc2_phase1_wiring.py's liveness test, which spawns a REAL
    // `node scripts/check-meta.mjs` to prove the nine ci-gate scripts are wired — and check-meta.mjs
    // itself runs THIS gate, which enumerates and re-runs every tests/test_*.py file, including that
    // same liveness test. Without a way to break the cycle, that is unbounded self-recursion (every
    // level spawns another full check-meta.mjs, which spawns another pytest, which spawns another...),
    // not a slow test — it was caught live: a single `pytest tests/` run produced over a dozen
    // concurrent check-meta.mjs/pytest processes before it was killed. The liveness test checks this
    // var and skips itself (not xfails, not errors) whenever it is set, because check-pytest running
    // green at THIS level already proves the suite it would otherwise re-verify; the test's actual job
    // — proving check-meta.mjs's real, top-level, no-override entry point wires the nine gates — is
    // still exercised at depth 0 (a developer's or CI's own `pytest tests/`), which never sets this var.
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', CHECK_PYTEST_NESTED: '1' },
  });
}

let r = null;
let used = null;
const tried = [];
for (const [cmd, pre] of CANDIDATES) {
  const attempt = runPytest(cmd, pre);
  if (attempt.error || attempt.status === null) { tried.push(`${cmd}: ${attempt.error?.code ?? 'no exit status'}`); continue; }
  if (STORE_STUB.test(`${attempt.stdout ?? ''}${attempt.stderr ?? ''}`)) { tried.push(`${cmd}: Windows Store alias stub, not an interpreter`); continue; }
  r = attempt;
  used = [cmd, ...pre].join(' ');
  break;
}

if (!r) {
  console.log('SKIPPED — no Python interpreter could be run.');
  for (const t of tried) console.log(`  tried ${t}`);
  console.log('  This is reported, not silently passed: a gate that cannot run is not a gate that passed.');
  console.log('  NOT VERIFIED here: the Python suite.');
  process.exit(0);
}

const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();

// A missing dependency is not a failing test. pytest exits 4 on a usage/collection error, and an
// unimportable llama_index shows up as a collection error too — reporting that as "the suite is
// red" would send someone hunting a bug that is really an uninstalled package.
if (/ModuleNotFoundError|No module named|error: unrecognized arguments/.test(out) && r.status !== 0) {
  console.log('SKIPPED — the Python test dependencies are not installed in this environment.');
  const why = out
    .split(/\r?\n/)
    .filter((l) => /No module named|ModuleNotFoundError/.test(l))
    .slice(0, 3);
  for (const l of why) console.log(`  ${l.trim()}`);
  console.log('  Install with: python -m pip install -r requirements.txt');
  console.log('  NOT VERIFIED here: the Python suite. A gate that could not run is not a gate that passed.');
  process.exit(0);
}
console.log(`interpreter: ${used} · files scanned: ${pyTests.length} (${pyTests.join(', ')})`);
console.log(out.split('\n').slice(-6).join('\n'));
if (r.status !== 0) {
  console.log('FAIL: the Python suite is red. Run: python -m pytest tests/ -v');
  process.exit(1);
}
console.log('OK - Python suite green.');
