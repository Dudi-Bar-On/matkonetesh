#!/usr/bin/env node
// scripts/tests/test-check-brief.mjs — self-test for check-brief.mjs (§13).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, setMtime, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-brief.mjs');

const templateDir = tempDir('brief-template-');
const template = writeFile(templateDir, 'task-brief.md', '# template\n(א) ... (ב) ... (ג) ... (ד) ... (ה) ... (ו) ...\n');
setMtime(template, '2026-07-01T00:00:00Z');

// Points GATE_BASELINES at a path that does not exist, so these fixture filenames (task-1-brief.md
// etc.) can never coincidentally collide with the real repo's docs/process/gate-baselines.json list -
// tests must be isolated from that file except in the dedicated baseline block below.
const NO_BASELINE = join(templateDir, 'no-such-baseline.json');

// RED: a brief newer than the template, touching NONE of the six field markers -> exit 1.
const sddDir1 = tempDir('brief-sdd-bad-');
const badBrief = writeFile(sddDir1, 'task-1-brief.md', '# Brief: Task 1\nJust some prose, no field markers at all.\n');
setMtime(badBrief, '2026-07-02T00:00:00Z');
assertExit(
  'brief with zero field markers -> exit 1',
  runNode(SCRIPT, [], { SDD_DIR: sddDir1, TEMPLATE: template, GATE_BASELINES: NO_BASELINE }),
  1,
);

// RED (distinct rule): a brief with all six markers but a bare "npx playwright test" full-suite
// command -> exit 1 (§7 fix: the operator does not own the full-suite gate).
const sddDir2 = tempDir('brief-sdd-suite-');
const suiteBrief = writeFile(sddDir2, 'task-2-brief.md',
  '(א) x (ב) x (ג) x (ד) x (ה) x (ו) x\nRun: npx playwright test\n');
setMtime(suiteBrief, '2026-07-02T00:00:00Z');
assertExit(
  'brief hands operator a bare "npx playwright test" -> exit 1',
  runNode(SCRIPT, [], { SDD_DIR: sddDir2, TEMPLATE: template, GATE_BASELINES: NO_BASELINE }),
  1,
);

// GREEN: all six markers present, and any playwright command names a specific spec file -> exit 0.
const sddDir3 = tempDir('brief-sdd-good-');
const goodBrief = writeFile(sddDir3, 'task-3-brief.md',
  '(א) spec lines (ב) code (ג) DoD (ד) report contract + H9 table (ה) serena (ו) test contract\n' +
  'Run: npx playwright test tests/foo.spec.ts\n');
setMtime(goodBrief, '2026-07-02T00:00:00Z');
assertExit(
  'brief with all six markers + scoped test command -> exit 0',
  runNode(SCRIPT, [], { SDD_DIR: sddDir3, TEMPLATE: template, GATE_BASELINES: NO_BASELINE }),
  0,
);

// GREEN: a brief OLDER than the template is not retroactively enforced -> exit 0 even with 0 markers.
const sddDir4 = tempDir('brief-sdd-old-');
const oldBrief = writeFile(sddDir4, 'task-4-brief.md', 'pre-template brief, no markers\n');
setMtime(oldBrief, '2026-06-01T00:00:00Z');
assertExit(
  'brief older than template is not retroactively enforced -> exit 0',
  runNode(SCRIPT, [], { SDD_DIR: sddDir4, TEMPLATE: template, GATE_BASELINES: NO_BASELINE }),
  0,
);

// GRANDFATHER BASELINE (gate-scoping-report.md, 2026-08-01 follow-up): the direct regression test for
// the live-observed flaw — a brief that is on docs/process/gate-baselines.json's "brief" list must be
// reported as standing debt but NEVER block, while a brief with the identical violation that is NOT on
// the list must still block (proves the baseline narrows the gate, it doesn't disable it).
const baselineFile = writeFile(tempDir('brief-baseline-'), 'gate-baselines.json',
  JSON.stringify({ brief: ['grandfathered-brief.md'], report: [] }));

const sddDir5 = tempDir('brief-sdd-baseline-');
const grandfatheredBrief = writeFile(sddDir5, 'grandfathered-brief.md', 'pre-existing debt, no markers\n');
setMtime(grandfatheredBrief, '2026-07-02T00:00:00Z');
const newBrief = writeFile(sddDir5, 'brand-new-brief.md', 'a brand new brief, also no markers\n');
setMtime(newBrief, '2026-07-02T00:00:00Z');

const baselineResult = runNode(SCRIPT, [], { SDD_DIR: sddDir5, TEMPLATE: template, GATE_BASELINES: baselineFile });
assertExit('a non-grandfathered brief still blocks even when a grandfathered one is present', baselineResult, 1);
if (!/STANDING DEBT/.test(baselineResult.stdout) || !/grandfathered-brief\.md/.test(baselineResult.stdout)) {
  console.error('FAIL  expected grandfathered-brief.md to be reported under STANDING DEBT');
  process.exitCode = 1;
} else {
  console.log('PASS  grandfathered brief reported as standing debt');
}
if (!/brand-new-brief\.md/.test(baselineResult.stderr)) {
  console.error('FAIL  expected brand-new-brief.md to be named as the blocking violation');
  process.exitCode = 1;
} else {
  console.log('PASS  non-grandfathered brief is the one that blocks');
}

summary('check-brief');
