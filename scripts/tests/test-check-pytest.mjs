#!/usr/bin/env node
// scripts/tests/test-check-pytest.mjs — self-test for check-pytest.mjs (R-146, L77).
//
// L77: "a check that reports less than it measured." check-pytest.mjs printed only the last 6
// lines of pytest's output, which discards the "short test summary info" section — the only place
// pytest names WHICH tests failed — on any run with more than a handful of failures. This test
// proves the gate now surfaces every failing/erroring test's name on a red run, and stays quiet on
// a green one.
//
// Uses REAL pytest against a tiny fixture tree via the --root seam (well under a second — this is
// not the ~200 s real suite the brief rules out), so nothing about spawnSync or pytest's own
// reporting format is mocked.
//
// The RED fixture deliberately has MANY failing tests, with the one this test asserts on defined
// FIRST. That is the point: with pytest's default collection-order reporting, the old
// `out.split('\n').slice(-6)` tail cuts off exactly the early entries in a long summary section —
// a 2-failure fixture would pass even under the old, broken code (that shape was tried first and
// caught here: it stayed green against the pre-fix gate, so it proved nothing). This shape is
// what actually witnesses the bug.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode, tempDir, writeFile } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-pytest.mjs');

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  if (cond) { console.log(`PASS  ${label}`); return; }
  failures++;
  console.error(`FAIL  ${label}`);
  if (detail) console.error(`      ${detail}`);
}

// --- RED fixture: the named failing/erroring tests come FIRST, then enough additional failing
// tests that the old slice(-6) tail cannot reach back to them. ---------------------------------
const redRoot = tempDir('check-pytest-red-');
const redLines = [
  'import pytest',
  '',
  '@pytest.fixture',
  'def broken_fixture():',
  '    raise RuntimeError("fixture blew up")',
  '',
  'def test_named_failure_marker():',
  '    assert 1 == 2, "R-146 fixture: this must appear in gate stdout"',
  '',
  'def test_named_error_marker(broken_fixture):',
  '    pass',
  '',
];
for (let i = 0; i < 10; i++) {
  redLines.push(`def test_padding_failure_${i}():`);
  redLines.push(`    assert False, "padding failure ${i}"`);
  redLines.push('');
}
writeFile(join(redRoot, 'tests'), 'test_fixture_red.py', redLines.join('\n'));

const red = runNode(SCRIPT, ['--root', redRoot], {});
const redOut = `${red.stdout ?? ''}${red.stderr ?? ''}`;

check(
  'red run exits non-zero',
  red.status === 1,
  `expected exit 1, got ${red.status}\n${redOut}`,
);
check(
  'red run names the failing test (FAILED ...::test_named_failure_marker)',
  /FAILED .*test_named_failure_marker/.test(redOut),
  `gate stdout did not contain the failing test's name:\n${redOut}`,
);
check(
  'red run names the erroring test (ERROR ...::test_named_error_marker)',
  /ERROR .*test_named_error_marker/.test(redOut),
  `gate stdout did not contain the erroring test's name:\n${redOut}`,
);
check(
  'red run still prints the counts line',
  /\d+ failed.*\d+ error/.test(redOut),
  `gate stdout did not contain a counts line:\n${redOut}`,
);

// --- GREEN fixture: only passing tests, output must stay short ---------------------------------
const greenRoot = tempDir('check-pytest-green-');
writeFile(join(greenRoot, 'tests'), 'test_fixture_green.py', [
  'def test_one_green():',
  '    assert True',
  '',
  'def test_two_green():',
  '    assert 1 + 1 == 2',
  '',
].join('\n'));

const green = runNode(SCRIPT, ['--root', greenRoot], {});
const greenOut = `${green.stdout ?? ''}${green.stderr ?? ''}`;
const greenLineCount = greenOut.trim().split('\n').length;

check(
  'green run exits zero',
  green.status === 0,
  `expected exit 0, got ${green.status}\n${greenOut}`,
);
check(
  'green run has no "short test summary info" section (stays as short as before)',
  !/short test summary info/.test(greenOut),
  `green output unexpectedly grew a summary section:\n${greenOut}`,
);
check(
  'green run stays short (<=10 lines) — a green gate must not become noisy',
  greenLineCount <= 10,
  `green output was ${greenLineCount} lines:\n${greenOut}`,
);

// --- R-149: the change-scope skip, exercised end-to-end through the real script -----------------
// LOCAL-HOOK-ONLY, both scenarios use the GREEN fixture (pytest must not be the thing under test
// here) with MATCONETESH_LOCAL_HOOK=1 (matches .githooks/pre-commit) and CHECK_PYTEST_STAGED_FILES
// as the test seam (scripts/lib/change-scope.mjs's getStagedFiles override), so none of this reads
// or depends on this real repo's actual staged git state.

// Scenario 1: a prose-only staged set → SKIPPED, suite never invoked at all (no "interpreter:" line
// — proves the skip happens BEFORE runPython, not just that pytest itself was told to no-op).
const proseOnly = runNode(SCRIPT, ['--root', greenRoot], {
  MATCONETESH_LOCAL_HOOK: '1',
  CHECK_PYTEST_STAGED_FILES: 'docs/process/development-discipline.md\n.superpowers/sdd/foo/notes.md',
});
const proseOut = `${proseOnly.stdout ?? ''}${proseOnly.stderr ?? ''}`;
check(
  'prose-only staged set: exits 0',
  proseOnly.status === 0,
  `expected exit 0, got ${proseOnly.status}\n${proseOut}`,
);
check(
  'prose-only staged set: prints the SKIPPED declaration',
  /^SKIPPED —.*prose-only change/m.test(proseOut),
  `no SKIPPED/prose-only line found:\n${proseOut}`,
);
check(
  'prose-only staged set: names what is NOT VERIFIED',
  /NOT VERIFIED here: the Python suite/.test(proseOut),
  `no NOT VERIFIED line found:\n${proseOut}`,
);
check(
  'prose-only staged set: pytest itself was never invoked (no "interpreter:" line)',
  !/interpreter:/.test(proseOut),
  `pytest ran despite the prose-only skip:\n${proseOut}`,
);

// Scenario 2 — THE ONE THAT MATTERS: a .mjs (infrastructure, not prose) staged alongside prose
// files → the suite RUNS, in full, not skipped. Proves the criterion cannot be talked into
// skipping a code change just because most of the commit is prose.
const codeChange = runNode(SCRIPT, ['--root', greenRoot], {
  MATCONETESH_LOCAL_HOOK: '1',
  CHECK_PYTEST_STAGED_FILES: 'docs/process/development-discipline.md\nscripts/check-meta.mjs',
});
const codeOut = `${codeChange.stdout ?? ''}${codeChange.stderr ?? ''}`;
check(
  'code (.mjs) change staged: exits 0 (green fixture)',
  codeChange.status === 0,
  `expected exit 0, got ${codeChange.status}\n${codeOut}`,
);
check(
  'code (.mjs) change staged: NOT skipped',
  !/^SKIPPED/m.test(codeOut),
  `unexpected SKIPPED for a .mjs change:\n${codeOut}`,
);
check(
  'code (.mjs) change staged: pytest actually ran (interpreter line + green verdict present)',
  /interpreter:/.test(codeOut) && /OK - Python suite green\./.test(codeOut),
  `pytest did not appear to run:\n${codeOut}`,
);

// Scenario 3: an undetermined changed-file list (git could not answer) → the suite RUNS. Fail open,
// never fail closed into a silent skip.
const undetermined = runNode(SCRIPT, ['--root', greenRoot], {
  MATCONETESH_LOCAL_HOOK: '1',
  CHECK_PYTEST_STAGED_FILES: '__UNDETERMINED__',
});
const undeterminedOut = `${undetermined.stdout ?? ''}${undetermined.stderr ?? ''}`;
check(
  'undetermined changed-file list: exits 0 (green fixture)',
  undetermined.status === 0,
  `expected exit 0, got ${undetermined.status}\n${undeterminedOut}`,
);
check(
  'undetermined changed-file list: NOT skipped — fails open into running',
  !/^SKIPPED/m.test(undeterminedOut),
  `unexpected SKIPPED for an undetermined file list:\n${undeterminedOut}`,
);
check(
  'undetermined changed-file list: pytest actually ran',
  /interpreter:/.test(undeterminedOut) && /OK - Python suite green\./.test(undeterminedOut),
  `pytest did not appear to run:\n${undeterminedOut}`,
);

// Scenario 4: WITHOUT MATCONETESH_LOCAL_HOOK set (the CI / discipline-job shape) — even a
// prose-only-looking staged-files env var must be IGNORED and the suite must still run
// unconditionally, because CI has nothing staged and must never be silently skippable.
const ciShape = runNode(SCRIPT, ['--root', greenRoot], {
  CHECK_PYTEST_STAGED_FILES: 'docs/process/development-discipline.md',
});
const ciOut = `${ciShape.stdout ?? ''}${ciShape.stderr ?? ''}`;
check(
  'no MATCONETESH_LOCAL_HOOK (CI shape): runs unconditionally, ignores the staged-files seam',
  ciShape.status === 0 && !/^SKIPPED/m.test(ciOut) && /OK - Python suite green\./.test(ciOut),
  `CI-shape invocation was skipped or failed:\n${ciOut}`,
);

// --- R-160: CI reports the complete failure list, and the output states which mode produced it ---
// More failing tests than -n 8 has workers, so a single wave of parallel workers cannot all fail
// before -x's interrupt propagates (a 2-test fixture proved unreliable here: both landed on
// different workers and both failed before -x could stop anything). Local mode must miss the LAST
// padding failure and say the list is a prefix; CI mode must name every one of them and say the
// list is complete. This is the exact shape L77 keeps recurring in: a check that reports less than
// it measured, with nothing saying so.
const manyFailRoot = tempDir('check-pytest-r160-');
const manyFailLines = [
  'def test_r160_first_failure():',
  '    assert False, "R-160 fixture: first failure"',
  '',
];
for (let i = 0; i < 15; i++) {
  manyFailLines.push(`def test_r160_padding_failure_${i}():`);
  manyFailLines.push(`    assert False, "R-160 fixture: padding failure ${i}"`);
  manyFailLines.push('');
}
manyFailLines.push('def test_r160_last_failure():');
manyFailLines.push('    assert False, "R-160 fixture: last failure -- must be MISSING in local mode"');
manyFailLines.push('');
writeFile(join(manyFailRoot, 'tests'), 'test_fixture_r160.py', manyFailLines.join('\n'));

const localMode = runNode(SCRIPT, ['--root', manyFailRoot], { GITHUB_ACTIONS: '' });
const localOut = `${localMode.stdout ?? ''}${localMode.stderr ?? ''}`;
check(
  'local mode: names the first failure',
  /FAILED .*test_r160_first_failure/.test(localOut),
  `local-mode output missing the first failure:\n${localOut}`,
);
check(
  'local mode: does NOT name the last failure (-x stopped the run before it)',
  !/FAILED .*test_r160_last_failure/.test(localOut),
  `local-mode output unexpectedly named the last failure -- -x did not stop the run:\n${localOut}`,
);
check(
  'local mode: says the list is a PREFIX, not the complete set',
  /mode: local.*PREFIX/s.test(localOut),
  `local-mode output did not state it produced a prefix:\n${localOut}`,
);

const ciMode = runNode(SCRIPT, ['--root', manyFailRoot], { GITHUB_ACTIONS: 'true' });
const ciModeOut = `${ciMode.stdout ?? ''}${ciMode.stderr ?? ''}`;
check(
  'CI mode: names the first failure',
  /FAILED .*test_r160_first_failure/.test(ciModeOut),
  `CI-mode output missing the first failure:\n${ciModeOut}`,
);
check(
  'CI mode: ALSO names the last failure (-x is dropped on GITHUB_ACTIONS=true)',
  /FAILED .*test_r160_last_failure/.test(ciModeOut),
  `CI-mode output did not name the last failure -- -x was not dropped on GITHUB_ACTIONS=true:\n${ciModeOut}`,
);
check(
  'CI mode: says the list is COMPLETE',
  /mode: CI.*COMPLETE/s.test(ciModeOut),
  `CI-mode output did not state it produced the complete list:\n${ciModeOut}`,
);

console.log(`\ncheck-pytest: ${total - failures}/${total} assertions passed.`);
if (failures) { console.error(`check-pytest: ${failures} FAILURE(S).`); process.exitCode = 1; }
