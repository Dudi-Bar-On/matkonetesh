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

const r = spawnSync('python', ['-m', 'pytest', ...pyTests.map((f) => join('tests', f)), '-q'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});

if (r.error || r.status === null) {
  console.log(`SKIPPED — could not run python (${r.error?.message ?? 'no exit status'}).`);
  console.log('  This is reported, not silently passed: a gate that cannot run is not a gate that passed.');
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
console.log(`files scanned: ${pyTests.length} (${pyTests.join(', ')})`);
console.log(out.split('\n').slice(-6).join('\n'));
if (r.status !== 0) {
  console.log('FAIL: the Python suite is red. Run: python -m pytest tests/ -v');
  process.exit(1);
}
console.log('OK - Python suite green.');
