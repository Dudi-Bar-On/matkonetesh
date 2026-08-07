#!/usr/bin/env node
// scripts/tests/test-check-meta-gate-name.mjs — Task 5 (§9 proof #2): when a gate FAILS, does
// check-meta.mjs's own output NAME it, or does it just report a bare non-zero exit?
//
// "A gate that fails anonymously inside sixteen others is a gate nobody can act on." Touches no
// real repo file: check-h8-ledger.mjs (one of the ~20 gates check-meta.mjs orchestrates) reads its
// target document from the ROADMAP env var when set (see its own self-test,
// scripts/tests/test-check-h8-ledger.mjs) and check-meta.mjs's run() forwards `env: process.env`
// straight through to every gate it spawns — so pointing ROADMAP at a disposable, deliberately
// broken fixture and re-spawning check-meta.mjs itself with that env var is a genuine end-to-end
// run of the real orchestrator, with zero mutation of any tracked file.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK_META = join(ROOT, 'scripts', 'check-meta.mjs');
const GATE_NAME_FRAGMENT = 'check-h8-ledger'; // displayName check-meta.mjs registers this gate under

// A §5a row with an empty landing column and empty status — the exact fixture
// test-check-h8-ledger.mjs already proves check-h8-ledger.mjs itself rejects.
const BAD_ROADMAP = `## 5 · ledger

| Phase | closes | Δ | cumulative |
|---|---|---|---|
| Phase 1 | X-1 | 1 | 1 |

**יעד H8 הושג: 0 פריטים ללא נחיתה**

הנותרים:
- item A — טריגר: something happens

## 5a · recovery ledger

| R | item | pointer | נחיתה | סטטוס |
|---|---|---|---|---|
| R-1 | some item | pointer text |  |  |
`;

let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`PASS  ${label}`);
}

// --- RED (for this assertion): a GOOD roadmap fixture must NOT get check-h8-ledger named as a
// failed gate. If this failed to hold, the GREEN case below would prove nothing (the name could be
// appearing unconditionally).
const GOOD_ROADMAP = BAD_ROADMAP.replace('|  |  |', '| Phase 3 | ⚠️R נדרש-אימות |');
const goodPath = writeFile(tempDir('check-meta-gate-'), 'roadmap-good.md', GOOD_ROADMAP);
const goodRun = runNode(CHECK_META, [], { ROADMAP: goodPath });
const goodMentionsGate = new RegExp(`META GATE FAIL:.*${GATE_NAME_FRAGMENT}`).test(goodRun.stdout + goodRun.stderr);
check(
  `sanity: a GOOD ROADMAP fixture does not get "${GATE_NAME_FRAGMENT}" named in META GATE FAIL`,
  !goodMentionsGate,
  `stdout tail: ${(goodRun.stdout || '').split('\n').slice(-6).join(' | ')}`
);

// --- GREEN: a BAD roadmap fixture must get check-h8-ledger named, specifically, in the failure line.
const badPath = writeFile(tempDir('check-meta-gate-'), 'roadmap-bad.md', BAD_ROADMAP);
const badRun = runNode(CHECK_META, [], { ROADMAP: badPath });
check('check-meta.mjs exits non-zero when check-h8-ledger is broken', badRun.status !== 0, `exit=${badRun.status}`);
const failLine = (badRun.stdout + badRun.stderr).split('\n').find(l => l.includes('META GATE FAIL:'));
check(
  `check-meta.mjs's "META GATE FAIL:" line names "${GATE_NAME_FRAGMENT}" (not an anonymous failure)`,
  !!failLine && failLine.includes(GATE_NAME_FRAGMENT),
  `failLine: ${failLine ?? '(no META GATE FAIL line found)'}`
);
// The section's own body must also show the specific broken row (R-1), not just "some gate failed".
check(
  'the check-h8-ledger section body names the specific offending row (R-1)',
  /R-1/.test(badRun.stdout) && /no landing/.test(badRun.stdout)
);

console.log(`\ntest-check-meta-gate-name: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
