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

summary('check-h9');
