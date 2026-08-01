#!/usr/bin/env node
// scripts/tests/test-check-h8-ledger.mjs — self-test for check-h8-ledger.mjs (H8, §5 + §5a).
// This is the direct regression test for the audit's most dangerous finding: a §5a row with no
// landing and no closed status must FAIL, and the count printed must include §5a rows at all
// (pre-fix, §5a was never scanned - "0 items scanned" for a section with real rows would itself be
// a silent-blind-gate regression, so this test also asserts the scanned count is nonzero).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-h8-ledger.mjs');

const VALID_5 = `## 5 · ledger

| Phase | closes | Δ | cumulative |
|---|---|---|---|
| Phase 1 | X-1 | 1 | 1 |
| Phase 2 | X-2 | 1 | 2 |
| Phase 3 | X-3 | 1 | 3 |
| Phase 4 | X-4 | 1 | 4 |
| Phase 5 | X-5 | 1 | 5 |
| Phase 6 | X-6 | 1 | 6 |
| Phase 7 | X-7 | 1 | 7 |
| Phase 8 | X-8 | 1 | 8 |
| Phase 9 | X-9 | 1 | 9 |
| Phase 10 | X-10 | 1 | 10 |
| Phase 11 | X-11 | 1 | 11 |

**יעד H8 הושג: 0 פריטים ללא נחיתה**

הנותרים:
- item A — טריגר: something happens
`;

// RED: a §5a row with an empty landing column and empty status -> must FAIL, and must name §5a.
const badRoad = VALID_5 + `
## 5a · recovery ledger

| R | item | pointer | נחיתה | סטטוס |
|---|---|---|---|---|
| R-1 | some item | pointer text |  |  |
| R-2 | closed item | pointer text | R-cancelled | ❌ |
`;
const badPath = writeFile(tempDir('h8-ledger-'), 'roadmap-bad.md', badRoad);
const badResult = runNode(SCRIPT, [], { ROADMAP: badPath });
assertExit('§5a row with empty landing+status -> exit 1', badResult, 1);
if (!/R-1/.test(badResult.stderr) || !/no landing/.test(badResult.stderr)) {
  console.error('FAIL  expected stderr to name R-1 and "no landing" specifically');
  process.exitCode = 1;
} else {
  console.log('PASS  failure output names the specific offending row (R-1)');
}

// GREEN: same fixture, but R-1 now carries a named landing -> must PASS, and must report the
// nonzero §5a scan count (proves §5a is actually being scanned, not silently skipped).
const goodRoad = VALID_5 + `
## 5a · recovery ledger

| R | item | pointer | נחיתה | סטטוס |
|---|---|---|---|---|
| R-1 | some item | pointer text | Phase 3 | ⚠️R נדרש-אימות |
| R-2 | closed item | pointer text | R-cancelled | ❌ |
`;
const goodPath = writeFile(tempDir('h8-ledger-'), 'roadmap-good.md', goodRoad);
const goodResult = runNode(SCRIPT, [], { ROADMAP: goodPath });
assertExit('§5a rows all populated -> exit 0', goodResult, 0);
if (!/§5a: 2 recovery-ledger rows scanned/.test(goodResult.stdout)) {
  console.error(`FAIL  expected stdout to report "§5a: 2 recovery-ledger rows scanned", got: ${goodResult.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  §5a scan count is reported and nonzero (2 rows)');
}

// RED: §5a section missing entirely -> must FAIL and say so (the exact pre-fix blind spot).
const noSec5aPath = writeFile(tempDir('h8-ledger-'), 'roadmap-no5a.md', VALID_5);
const noSec5aResult = runNode(SCRIPT, [], { ROADMAP: noSec5aPath });
assertExit('missing §5a section entirely -> exit 1', noSec5aResult, 1);

summary('check-h8-ledger');
