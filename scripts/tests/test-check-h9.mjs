#!/usr/bin/env node
// scripts/tests/test-check-h9.mjs — self-test for check-h9.mjs (H9, the 5-row summary table).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGitRepo, writeFile, setMtime, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-h9.mjs');

// A repo whose newest release(v commit is at T0; reports are untracked (mtime fallback applies).
const repo = makeGitRepo([
  { subject: 'release(v1): baseline', date: '2026-07-01T00:00:00' },
]);

// RED: a report newer than the release, with NONE of the 5 H9 headers -> exit 1.
const sddDirBad = join(repo, 'sdd-bad');
const badReport = writeFile(sddDirBad, 'task-1-report.md', '# Report\nDid the work. Tests pass.\n');
setMtime(badReport, '2026-07-02T00:00:00Z');
assertExit(
  'report with zero H9 headers -> exit 1',
  runNode(SCRIPT, [], { SDD_DIR: sddDirBad, GITROOT: repo }),
  1,
);

// GREEN: same report, now carrying all 5 headers -> exit 0.
const sddDirGood = join(repo, 'sdd-good');
const goodReport = writeFile(sddDirGood, 'task-1-report.md',
  '# Report\n\n| מה היה | מה נעשה | מה נשאר | איפה אנחנו | הבא בתור |\n|---|---|---|---|---|\n| x | y | z | w | v |\n');
setMtime(goodReport, '2026-07-02T00:00:00Z');
assertExit(
  'report with all 5 H9 headers -> exit 0',
  runNode(SCRIPT, [], { SDD_DIR: sddDirGood, GITROOT: repo }),
  0,
);

// GREEN: a report OLDER than the release is not retroactively enforced -> exit 0 even with 0 headers.
const sddDirOld = join(repo, 'sdd-old');
const oldReport = writeFile(sddDirOld, 'task-0-report.md', 'pre-release report, no headers\n');
setMtime(oldReport, '2026-06-01T00:00:00Z');
assertExit(
  'report older than the release is not retroactively enforced -> exit 0',
  runNode(SCRIPT, [], { SDD_DIR: sddDirOld, GITROOT: repo }),
  0,
);

// GRANDFATHER BASELINE (gate-scoping-report.md, 2026-08-01 follow-up): same mechanism as check-brief's.
const baselineFile = writeFile(join(repo, 'baseline'), 'gate-baselines.json',
  JSON.stringify({ brief: [], report: ['grandfathered-report.md'] }));

const sddDirBaseline = join(repo, 'sdd-baseline');
const grandfatheredReport = writeFile(sddDirBaseline, 'grandfathered-report.md', 'pre-existing debt, no H9 headers\n');
setMtime(grandfatheredReport, '2026-07-02T00:00:00Z');
const newReport = writeFile(sddDirBaseline, 'brand-new-report.md', 'a brand new report, also no H9 headers\n');
setMtime(newReport, '2026-07-02T00:00:00Z');

const baselineResult = runNode(SCRIPT, [], { SDD_DIR: sddDirBaseline, GITROOT: repo, GATE_BASELINES: baselineFile });
assertExit('a non-grandfathered report still blocks even when a grandfathered one is present', baselineResult, 1);
if (!/STANDING DEBT/.test(baselineResult.stdout) || !/grandfathered-report\.md/.test(baselineResult.stdout)) {
  console.error('FAIL  expected grandfathered-report.md to be reported under STANDING DEBT');
  process.exitCode = 1;
} else {
  console.log('PASS  grandfathered report reported as standing debt');
}
if (!/brand-new-report\.md/.test(baselineResult.stderr)) {
  console.error('FAIL  expected brand-new-report.md to be named as the blocking violation');
  process.exitCode = 1;
} else {
  console.log('PASS  non-grandfathered report is the one that blocks');
}

summary('check-h9');
