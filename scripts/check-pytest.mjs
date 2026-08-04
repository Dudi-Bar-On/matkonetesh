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
console.log(`files scanned: ${pyTests.length} (${pyTests.join(', ')})`);
console.log(out.split('\n').slice(-6).join('\n'));
if (r.status !== 0) {
  console.log('FAIL: the Python suite is red. Run: python -m pytest tests/ -v');
  process.exit(1);
}
console.log('OK - Python suite green.');
