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

// RED: a brief newer than the template, touching NONE of the six field markers -> exit 1.
const sddDir1 = tempDir('brief-sdd-bad-');
const badBrief = writeFile(sddDir1, 'task-1-brief.md', '# Brief: Task 1\nJust some prose, no field markers at all.\n');
setMtime(badBrief, '2026-07-02T00:00:00Z');
assertExit(
  'brief with zero field markers -> exit 1',
  runNode(SCRIPT, [], { SDD_DIR: sddDir1, TEMPLATE: template }),
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
  runNode(SCRIPT, [], { SDD_DIR: sddDir2, TEMPLATE: template }),
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
  runNode(SCRIPT, [], { SDD_DIR: sddDir3, TEMPLATE: template }),
  0,
);

// GREEN: a brief OLDER than the template is not retroactively enforced -> exit 0 even with 0 markers.
const sddDir4 = tempDir('brief-sdd-old-');
const oldBrief = writeFile(sddDir4, 'task-4-brief.md', 'pre-template brief, no markers\n');
setMtime(oldBrief, '2026-06-01T00:00:00Z');
assertExit(
  'brief older than template is not retroactively enforced -> exit 0',
  runNode(SCRIPT, [], { SDD_DIR: sddDir4, TEMPLATE: template }),
  0,
);

summary('check-brief');
