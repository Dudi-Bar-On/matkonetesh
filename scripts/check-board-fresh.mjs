#!/usr/bin/env node
// scripts/check-board-fresh.mjs — audit fix #5 (COMPLIANCE-AUDIT-2026-08-01.md §3/H10).
// docs/STATUS-BOARD.md must declare "בסיס: vNNN" equal to the newest release(v commit in the log.
// A one-line check, but it is the thing that let "איפה אנחנו" go stale for a whole afternoon (v282
// board header vs v284 shipped). Env overrides (self-test fixtures): BOARD=<path>, GITROOT=<path>.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const BOARD = process.env.BOARD || join(ROOT, 'docs', 'STATUS-BOARD.md');

if (!existsSync(BOARD)) {
  console.error(`FAIL: board file not found: ${BOARD}`);
  process.exit(1);
}
const board = readFileSync(BOARD, 'utf8');
const boardMatch = board.match(/בסיס:\s*v(\d+)/);
if (!boardMatch) {
  console.error('FAIL: STATUS-BOARD.md header does not declare "בסיס: vNNN" — cannot verify freshness.');
  process.exit(1);
}
const boardVersion = Number(boardMatch[1]);

let log;
try {
  log = execSync('git -c log.showsignature=false log --format=%s -n 500', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read git log in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const releaseVersions = [...log.matchAll(/^release\(v(\d+)\)/gm)].map(m => Number(m[1]));
console.log(`board declares: v${boardVersion} · release(v commits scanned: ${releaseVersions.length}`);
if (!releaseVersions.length) {
  console.log('OK - no release(v commits in the scanned log window; nothing to compare against.');
  process.exit(0);
}
const latest = Math.max(...releaseVersions);
if (boardVersion !== latest) {
  console.error(`FAIL: STATUS-BOARD.md says "בסיס: v${boardVersion}" but the newest release(v commit is v${latest}.`);
  console.error(`  Fix: update docs/STATUS-BOARD.md header to "בסיס: v${latest}" as part of the SAME task/commit that shipped it (H10).`);
  process.exit(1);
}
console.log(`OK - board base v${boardVersion} matches the newest release(v commit.`);
