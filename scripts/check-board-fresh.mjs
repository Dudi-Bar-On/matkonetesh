#!/usr/bin/env node
// scripts/check-board-fresh.mjs — audit fix #5 (COMPLIANCE-AUDIT-2026-08-01.md §3/H10).
// docs/STATUS-BOARD.md must declare "בסיס: vNNN" equal to the newest release(v commit in the log.
// A one-line check, but it is the thing that let "איפה אנחנו" go stale for a whole afternoon (v282
// board header vs v284 shipped). Env overrides (self-test fixtures): BOARD=<path>, GITROOT=<path>.
// CLI overrides (same purpose, used by tests/test_arc4_board_currency.py): --board <path>.
//
// --currency (2026-08-11, Arc 4 Task 10): the version stamp was the only thing this gate ever
// checked, and the board still went 12 commits stale under it — two counting systems (a task
// counter and a rule-coverage row) that never reconciled, arcs added by hand, no stated target.
// These three are the claims a reader takes from the board without re-deriving them, so they are
// the three that must answer to measurement:
//   1. COVERAGE-DECLARED equals check-rule-coverage.mjs's own measured "RULE COVERAGE: N of M".
//   2. Every directory under .superpowers/sdd/ is named somewhere in the board (case-insensitive).
//   3. LIVE-VERSION and TARGET-VERSION are both present and parse as vNNN.
// Fails OPEN with a stated reason (§10.24) when check-rule-coverage.mjs itself cannot be run or
// its own output cannot be parsed — this gate is not the authority on rule coverage, it only cross-
// checks the board against it, and blocking on an unrelated tool's unavailability names no
// reachable fix from THIS commit.
import { readFileSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

const argv = process.argv.slice(2);
const boardArgIdx = argv.indexOf('--board');
const BOARD_ARG = boardArgIdx !== -1 ? argv[boardArgIdx + 1] : undefined;
const BOARD = BOARD_ARG || process.env.BOARD || join(ROOT, 'docs', 'STATUS-BOARD.md');
const CURRENCY = argv.includes('--currency');

if (!existsSync(BOARD)) {
  console.error(`FAIL: board file not found: ${BOARD}`);
  process.exit(1);
}
const board = readFileSync(BOARD, 'utf8');
const boardMatch = board.match(/בסיס:\s*v(\d+)/);
let versionFailed = false;
if (!boardMatch) {
  console.error('FAIL: board header does not declare "בסיס: vNNN" — cannot verify freshness.');
  versionFailed = true;
  if (!CURRENCY) process.exit(1);
} else {
  const boardVersion = Number(boardMatch[1]);
  let log;
  try {
    log = execSync('git -c log.showsignature=false log --format=%s -n 500', { cwd: GITROOT, encoding: 'utf8' });
  } catch (e) {
    console.error(`FAIL: could not read git log in ${GITROOT}: ${e.message}`);
    versionFailed = true;
    if (!CURRENCY) process.exit(1);
  }
  if (log !== undefined) {
    const releaseVersions = [...log.matchAll(/^release\(v(\d+)\)/gm)].map(m => Number(m[1]));
    console.log(`board declares: v${boardVersion} · release(v commits scanned: ${releaseVersions.length}`);
    if (!releaseVersions.length) {
      console.log('OK - no release(v commits in the scanned log window; nothing to compare against.');
    } else {
      const latest = Math.max(...releaseVersions);
      if (boardVersion !== latest) {
        console.error(`FAIL: STATUS-BOARD.md says "בסיס: v${boardVersion}" but the newest release(v commit is v${latest}.`);
        console.error(`  Fix: update docs/STATUS-BOARD.md header to "בסיס: v${latest}" as part of the SAME task/commit that shipped it (H10).`);
        versionFailed = true;
      } else {
        console.log(`OK - board base v${boardVersion} matches the newest release(v commit.`);
      }
    }
  }
}

if (!CURRENCY) {
  process.exit(versionFailed ? 1 : 0);
}

// ---- --currency mode: the three claims a reader takes from the board without re-deriving them ----
let currencyFailed = false;

// 1. COVERAGE-DECLARED vs the coverage gate's own live measurement.
const coverageMatch = board.match(/COVERAGE-DECLARED:\s*(\d+)\s*\/\s*(\d+)/);
if (!coverageMatch) {
  console.log('FAIL: board declares no machine-readable COVERAGE-DECLARED figure.');
  currencyFailed = true;
} else {
  const [, declaredN, declaredM] = coverageMatch;
  const covScript = join(ROOT, 'scripts', 'check-rule-coverage.mjs');
  if (!existsSync(covScript)) {
    console.log(`SKIPPED — check-rule-coverage.mjs not found at ${covScript}. NOT VERIFIED here: COVERAGE-DECLARED currency.`);
  } else {
    const r = spawnSync(process.execPath, [covScript], { encoding: 'utf8', cwd: ROOT });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const liveMatch = out.match(/RULE COVERAGE:\s*(\d+)\s*of\s*(\d+)/);
    if (r.error || !liveMatch) {
      console.log(`SKIPPED — could not run/parse check-rule-coverage.mjs (${r.error ? r.error.message : 'no "RULE COVERAGE: N of M" line in its output'}). NOT VERIFIED here: COVERAGE-DECLARED currency.`);
    } else {
      const [, liveN, liveM] = liveMatch;
      if (declaredN !== liveN || declaredM !== liveM) {
        console.log(`FAIL: board says COVERAGE-DECLARED: ${declaredN} / ${declaredM}, but check-rule-coverage.mjs measures ${liveN} of ${liveM}.`);
        console.log('  Fix: update the COVERAGE-DECLARED line in docs/STATUS-BOARD.md to match the live measurement.');
        currencyFailed = true;
      } else {
        console.log(`OK - COVERAGE-DECLARED ${declaredN} / ${declaredM} matches check-rule-coverage.mjs.`);
      }
    }
  }
}

// 2. Every .superpowers/sdd/ directory named somewhere in the board (case-insensitive).
const SDD_ROOT = join(ROOT, '.superpowers', 'sdd');
if (existsSync(SDD_ROOT)) {
  const { readdirSync, statSync } = await import('node:fs');
  const arcs = readdirSync(SDD_ROOT).filter(n => statSync(join(SDD_ROOT, n)).isDirectory());
  const boardLower = board.toLowerCase();
  const missing = arcs.filter(a => !boardLower.includes(a.toLowerCase()));
  if (missing.length) {
    console.log(`FAIL: ${missing.length} active .superpowers/sdd/ arc(s) absent from the board: ${missing.join(', ')}`);
    console.log('  Fix: name each one somewhere in docs/STATUS-BOARD.md.');
    currencyFailed = true;
  } else {
    console.log(`OK - all ${arcs.length} .superpowers/sdd/ arc(s) named in the board.`);
  }
} else {
  console.log('SKIPPED — .superpowers/sdd/ not found. NOT VERIFIED here: active-arc naming.');
}

// 3. LIVE-VERSION and TARGET-VERSION both present, both parsing as vNNN.
const liveVerMatch = board.match(/LIVE-VERSION:\s*v(\d+)/);
const targetVerMatch = board.match(/TARGET-VERSION:\s*v(\d+)/);
if (!liveVerMatch || !targetVerMatch) {
  console.log(`FAIL: board is missing ${!liveVerMatch ? 'LIVE-VERSION' : ''}${!liveVerMatch && !targetVerMatch ? ' and ' : ''}${!targetVerMatch ? 'TARGET-VERSION' : ''} (must parse as vNNN).`);
  currencyFailed = true;
} else {
  console.log(`OK - LIVE-VERSION v${liveVerMatch[1]} and TARGET-VERSION v${targetVerMatch[1]} both declared.`);
}

process.exit((versionFailed || currencyFailed) ? 1 : 0);
