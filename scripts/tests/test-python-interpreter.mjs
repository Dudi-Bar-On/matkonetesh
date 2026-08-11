#!/usr/bin/env node
// scripts/tests/test-python-interpreter.mjs — self-test for scripts/lib/python-interpreter.mjs
// (R-147).
//
// WHY THIS EXISTS. `py` is the Windows Python launcher; it does not exist on the Linux CI runner.
// Ten gate scripts spawned a Python interpreter, most either hard-coding `py` or omitting it from an
// incomplete fallback list — five produced a literal `spawnSync py ENOENT` in the CI log
// (run 2ffcbd4), and several more failed downstream of that. check-pytest.mjs had already solved
// resolution correctly; the fix now lives ONCE, in scripts/lib/python-interpreter.mjs, and every one
// of the ten gate scripts is asserted here to actually point at it — not a second copy of the same
// shape (R-116 / R-128 / R-129).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { tempDir, writeFile } from './test-helpers.mjs';
import { runPython, PYTHON_CANDIDATES, isStoreStub } from '../lib/python-interpreter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  if (cond) { console.log(`PASS  ${label}`); return; }
  failures++;
  console.error(`FAIL  ${label}`);
  if (detail) console.error(`      ${detail}`);
}

// --- 1. Every one of the ten gate scripts imports the ONE shared resolver, not a local copy. -----
// (check-workflows.mjs imports the resolver's building blocks — PYTHON_CANDIDATES/isStoreStub —
// rather than `runPython` itself, because it needs a third per-candidate outcome `runPython` does
// not expose; still the same shared source, never a second definition of the candidate list.)
const GATE_SCRIPTS = [
  'check-backup-fresh.mjs',
  'check-geniza-fresh.mjs',
  'check-pytest.mjs',
  'check-rule-provenance.mjs',
  'check-rules-classified.mjs',
  'check-rules-complete.mjs',
  'check-rules-fresh.mjs',
  'check-rules-mirror.mjs',
  'check-workflows.mjs',
  'session-rules.mjs',
];
for (const name of GATE_SCRIPTS) {
  const path = join(ROOT, 'scripts', name);
  const text = readFileSync(path, 'utf8');
  check(
    `${name} imports the shared python-interpreter resolver`,
    /from ['"]\.\/lib\/python-interpreter\.mjs['"]/.test(text),
    'expected an import from ./lib/python-interpreter.mjs — a local copy of the resolver is R-116/R-128/R-129',
  );
  // No script may declare its OWN candidate list — that is exactly the shape that put `py` in ten
  // places, five of which never fell back to anything Linux has.
  check(
    `${name} does not declare a second interpreter-candidate list`,
    !/const\s+(CANDIDATES|PY_CANDIDATES)\s*=\s*\[\s*\[/.test(text),
    'found a local CANDIDATES/PY_CANDIDATES array literal — this is the duplicated shape R-147 removes',
  );
}

// --- 2. The shared resolver's own resolution does not depend on a Windows-only executable name. --
check(
  'PYTHON_CANDIDATES includes a name Linux actually has (python or python3)',
  PYTHON_CANDIDATES.some(([cmd]) => cmd === 'python' || cmd === 'python3'),
  JSON.stringify(PYTHON_CANDIDATES),
);
check(
  'PYTHON_CANDIDATES is not `py`-only',
  PYTHON_CANDIDATES.some(([cmd]) => cmd !== 'py'),
  JSON.stringify(PYTHON_CANDIDATES),
);

// --- 3. Functional: an ENOENT-shaped absent candidate is skipped, not fatal — a stand-in for the
// exact CI shape (`py` absent on Linux) without depending on what is actually installed on the
// machine running this test. -----------------------------------------------------------------------
const probe = runPython(['-c', 'print("hello")'], { encoding: 'utf8' }, {
  // No stub — exercise the real candidate list. This machine (dev: Windows, CI: Linux) always has
  // AT LEAST one of python/py/python3, so `found` must be true and the absent candidate(s), if any,
  // must show up in `tried` as an absence, never crash the resolver.
});
check('runPython resolves a real interpreter on this machine', probe.found, JSON.stringify(probe.tried));
if (probe.found) {
  check('runPython actually ran the requested code', (probe.result.stdout ?? '').includes('hello'), probe.result.stdout);
}

// --- 4. Functional: a fully-substituted stub (the CHECK_GENIZA_PY / CHECK_RULES_PY seam shape) is
// used exclusively — the real candidate list is never consulted when a stub is given. --------------
const stubDir = tempDir('python-interpreter-stub-');
const stubOut = join(stubDir, 'out.txt');
writeFile(stubDir, 'out.txt', '{"ok": true}\n');
const stubCmd = writeFile(stubDir, 'stub.cmd', `@echo off\r\ntype "${stubOut}"\r\nexit /b 0\r\n`);
const stubbed = runPython(['-c', 'ignored'], { encoding: 'utf8', shell: false }, { stub: stubCmd });
check('a stub is invoked exclusively (single candidate)', stubbed.found, JSON.stringify(stubbed));
check('a stub result carries the stub as usedLabel', stubbed.usedLabel === stubCmd, stubbed.usedLabel);

// --- 5. isStoreStub recognises the Windows Store app-execution-alias text (L59) and does not
// misclassify ordinary output. ------------------------------------------------------------------
check('isStoreStub recognises the Store alias text', isStoreStub('Python was not found; run without arguments to install from the Microsoft Store.\n'));
check('isStoreStub does not misclassify real output', !isStoreStub('{"ok": true}\n'));

console.log(`\ntest-python-interpreter: ${total - failures}/${total} assertions passed.`);
if (failures) { console.error(`test-python-interpreter: ${failures} FAILURE(S).`); process.exit(1); }
