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

console.log(`\ncheck-pytest: ${total - failures}/${total} assertions passed.`);
if (failures) { console.error(`check-pytest: ${failures} FAILURE(S).`); process.exitCode = 1; }
