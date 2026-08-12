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
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPython } from './lib/python-interpreter.mjs';
import { getStagedFiles, shouldRunPytest } from './lib/change-scope.mjs';

// --root <dir> (Arc 4, R-146): points the gate at a fixture tree instead of the real repo, so
// scripts/tests/test-check-pytest.mjs can run a REAL, tiny pytest invocation (one fixture file,
// well under a second) instead of either mocking spawnSync or paying the ~200 s real-suite cost
// the brief rules out.
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const TESTS = join(ROOT, 'tests');

const pyTests = existsSync(TESTS)
  ? readdirSync(TESTS).filter((f) => f.startsWith('test_') && f.endsWith('.py'))
  : [];

if (!pyTests.length) {
  console.log('no Python test files (tests/test_*.py) — nothing to run.');
  process.exit(0);
}

// PROSE-ONLY SKIP (R-149) — LOCAL PRE-COMMIT ONLY. .githooks/pre-commit sets MATCONETESH_LOCAL_HOOK
// before invoking check-meta.mjs; CI's `discipline` job (.github/workflows/infra.yml) does not, so
// this suite still runs there UNCONDITIONALLY every time, as the owner specified: "discipline and
// worker-tests keep running unconditionally. They are cheap and they are the authority." Restricting
// the skip to the hook context is deliberate, not incidental — `git diff --cached` answers "what is
// staged for commit", which is meaningless inside a CI checkout (nothing is ever staged there); an
// unguarded skip there would silently turn CI's own authority off.
//
// CHECK_PYTEST_STAGED_FILES is the test seam (matches CHECK_GENIZA_PY/CHECK_RULES_PY's stub shape,
// scripts/lib/python-interpreter.mjs): newline-separated staged paths, or the literal
// __UNDETERMINED__ to simulate a changed-file list git could not produce. Real runs never set it.
if (process.env.MATCONETESH_LOCAL_HOOK === '1') {
  const stagedEnv = process.env.CHECK_PYTEST_STAGED_FILES;
  const override =
    stagedEnv === '__UNDETERMINED__'
      ? { files: null, determined: false, reason: 'test seam: CHECK_PYTEST_STAGED_FILES=__UNDETERMINED__' }
      : stagedEnv !== undefined
        ? { files: stagedEnv.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), determined: true, reason: null }
        : undefined;
  const staged = getStagedFiles({ cwd: REPO }, override);
  const decision = shouldRunPytest(staged);
  if (!decision.run) {
    console.log(`SKIPPED — ${decision.reason}.`);
    console.log('  NOT VERIFIED here: the Python suite (tests/test_*.py).');
    process.exit(0);
  }
  console.log(`running — ${decision.reason}.`);
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
// the stub is recognised for what it is — an absence, not a failure. R-147: this used to be a local
// CANDIDATES/STORE_STUB pair copied (inconsistently) into nine other gate scripts, which is exactly
// what put `spawnSync py ENOENT` into the CI log for five of them. The resolution logic now lives
// once, in scripts/lib/python-interpreter.mjs, and every one of the ten points at it.
// R-154 (2026-08-11, owner-approved): the suite grew from ~200s to ~13 minutes (553 tests), and
// every commit attempt — including the ones that fail on a LATER gate and get retried — paid it
// in full. Owner approved TWO changes; only one ships here.
//
//   -x --ff   SHIPPED. Stops at the first failure and runs last-failed-first, so a failing commit
//             learns it failed in seconds instead of minutes. This narrows how fast FAILURE is
//             reported, never what a PASSING run executes: -x only ever triggers on a failing
//             test, so on a green run every collected item still runs — verified by construction
//             (there is no code path from "-x present" to "fewer items collected") and confirmed
//             empirically in the R-154 report's passing-run item counts, which match plain `-q`
//             coverage. --ff (failed-first) only REORDERS execution; unlike --lf (last-failed-
//             ONLY) it never drops items, so full coverage survives it too.
//
//   R-160 (2026-08-12, L77 third instance this week): `-x` is right LOCALLY — a failing pre-commit
//             run went 199s -> 1.2s and nobody wants to wait for the rest once it is already red.
//             But it was applied UNCONDITIONALLY, so every CI run has been stopping at the first
//             failure too, and CI has no one waiting: it silently turned "the complete failure
//             list" into "the first failure", and the controller repeated that prefix to the owner
//             as a total ("CI: 33 -> 7 -> 2" -- the 2 was a prefix, not a count). `-x` is now
//             CONDITIONAL on GITHUB_ACTIONS=true (GitHub Actions' own unconditional positive
//             marker, already used this way in tests/test_arc2_phase2_wiring.py as of bb66c50 --
//             matched here rather than inventing a second CI-detection convention, R-116): CI drops
//             -x and gets every failing/erroring test named; local keeps -x and stays fast. Either
//             way the FAIL output now states which mode produced the list, so a reader never has to
//             infer completeness from a flag they cannot see.
//
//   -n 8      SHIPPED (R-154(b), 2026-08-11, owner-approved). `-n auto` on this 32-core machine
//             meant 32 workers, and under that load
//             tests/test_arc2_phase2_wiring.py::test_pretooluse_overhead_stays_in_the_baseline_class
//             (a real subprocess wall-clock measurement, 61ms baseline / 244ms tripwire) failed
//             once at 313ms and passed on a second attempt — a genuine CPU-contention flake, not a
//             bug in the test's subject, and exactly the class of thing §11a already names ("the
//             local worker count assumes an idle machine"). R-154(b) changed exactly one variable
//             — the worker count, capped at 8 instead of left unbounded — and did NOT touch the
//             tripwire itself: loosening that number would make it pass on a genuinely slow hook
//             too, which is the one thing it exists to catch. Three full `-n 8` runs (see the
//             R-154(b) report) were clean with no sign of that flake, so the timing test was left
//             in the normal (unpinned) pool rather than added to SERIALIZED_TEST_FILES.
//             `--dist loadgroup` is required alongside `-n` for tests/conftest.py's
//             SERIALIZED_TEST_FILES xdist_group marker to take effect — the default `load`
//             distribution ignores xdist_group markers entirely, which would silently let two
//             pinned files (e.g. two files both touching the live Postgres advisory lock) land on
//             different workers and run concurrently.
// GITHUB_ACTIONS=true is GitHub's own unconditional positive marker for "this is a GitHub Actions
// runner" -- never a heuristic, never inferred from anything this script measures itself (R-160,
// matching tests/test_arc2_phase2_wiring.py as of bb66c50; R-116 rules out a second convention).
const isCI = process.env.GITHUB_ACTIONS === 'true';
const pytestArgs = [
  '-m', 'pytest', ...pyTests.map((f) => join('tests', f)), '-q',
  ...(isCI ? [] : ['-x']),
  '--ff', '-n', '8', '--dist', 'loadgroup',
];
const { found, result: r, usedLabel: used, tried } = runPython(
  pytestArgs,
  {
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
  },
);

if (!found) {
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
if (r.status !== 0) {
  // R-146 / L77: a check that reports less than it measured. pytest already names every failing
  // and erroring test in its own "short test summary info" section — this repo has no pytest.ini
  // or pyproject.toml [tool.pytest.ini_options] overriding the default reporting, and that section
  // is emitted by default (verified: a fixture run with one failing + one erroring test prints it
  // under plain `-q`, no `-ra` needed). Printing only the last 6 lines discarded that section for
  // any run with more than a handful of failures — CI run 31484775607 reported "17 failed... 16
  // errors" and named not one of them. Print the section IN FULL, uncapped, whenever the run is red.
  const marker = 'short test summary info';
  const idx = out.indexOf(marker);
  if (idx === -1) {
    // Defensive only: every red run this gate has ever produced has carried this section. If a
    // future pytest version or a collection-level crash ever omits it, say so plainly rather than
    // silently falling back — an unlabelled fallback is the exact defect this gate now exists to
    // avoid repeating.
    console.log('  (no "short test summary info" section in pytest output — printing the tail instead)');
    console.log(out.split('\n').slice(-20).join('\n'));
  } else {
    const sectionStart = out.lastIndexOf('\n', idx) + 1;
    console.log(out.slice(sectionStart).trim());
  }
  // R-160: state which mode produced the list above, so a reader never has to infer completeness
  // from a flag (-x) they cannot see. This is the actual defect this task exists to fix — not that
  // a list was ever short, but that nothing said so.
  console.log(
    isCI
      ? 'mode: CI (GITHUB_ACTIONS=true) — full run, no -x: every failing/erroring test above is the COMPLETE list.'
      : 'mode: local (-x --ff) — stopped at the FIRST failure. The list above is a PREFIX, not the ' +
        'complete set; CI runs the full suite and names everything.',
  );
  console.log('FAIL: the Python suite is red. Run: python -m pytest tests/ -v');
  process.exit(1);
}
console.log(out.split('\n').slice(-6).join('\n'));
console.log('OK - Python suite green.');
