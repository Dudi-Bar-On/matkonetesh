#!/usr/bin/env node
// scripts/tests/test-session-brief.mjs — self-test for session-brief.mjs's POSITION and DECISIONS
// AWAITING OWNER readers.
//
// Both regressions this covers were real, live-observed bugs (2026-08-01):
//  1. POSITION reported "no phase marked 🔄 (active)" while docs/STATUS-BOARD.md plainly had one.
//     Root cause: a stray literal U+0008 (backspace) control character had been silently inserted
//     into the row-matcher regex source, right after the literal "Phase" — `/(Phase\x08|Planning
//     arc|...)/` — which can never match real board text ("Phase" is never followed by a backspace),
//     so the row-detection loop silently matched zero rows on every run. Nothing in the visible
//     source (as rendered by any normal viewer) showed this; only a byte-level scan of the file
//     found it. This test proves the row IS found and reported when the reader is fed a known-good
//     fixture board — it would have caught the corrupted regex immediately (0 rows ever match).
//  2. DECISIONS AWAITING OWNER kept reporting a row whose own status cell had since closed (✅
//     "מומש..."), because the old resolved-check scanned the whole row's text for a closed-signal
//     word list that didn't include the word actually used. This test proves a row is dropped once
//     its OWN status cell (not any other cell) opens with ✅, and stays listed when it doesn't.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, setMtime, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'session-brief.mjs');

function run(boardPath, roadmapPath, sddDir) {
  // session-brief.mjs has no GITROOT seam (git() always runs against the real repo, ROOT) — that's
  // fine here: liveVsBoard/inFlight/standingDebt read the real repo's git log and graph, and are
  // not under test in this file. BOARD/ROADMAP/SDD_DIR are overridden.
  // SDD_DIR defaults to a directory that does not exist, so POSITION falls back to the fixture
  // BOARD instead of picking up whatever real ledger the actual repo happens to have active right
  // now — these "board-only" cases are specifically testing the no-active-ledger fallback path.
  return runNode(SCRIPT, [], {
    BOARD: boardPath,
    ROADMAP: roadmapPath ?? join(tempDir('sb-no-roadmap-'), 'does-not-exist.md'),
    SDD_DIR: sddDir ?? join(tempDir('sb-no-sdd-'), 'does-not-exist'),
  });
}

// ---------------------------------------------------------------------------
// POSITION
// ---------------------------------------------------------------------------

const boardWithActive = writeFile(tempDir('sb-board-active-'), 'STATUS-BOARD.md',
  '## לוח פאזות\n\n' +
  '| Phase | שם | משימות | סטטוס | R | הערות |\n' +
  '|---|---|---|---|---|---|\n' +
  '| Phase 1 | done phase | 5/5 | ✅ **שוחרר** | R-1 | note |\n' +
  '| **Phase 2 — Voice Governance** | 14 משימות | **4/14** | 🔄 **בביצוע** | R-62 | note |\n' +
  '| Phase 3 | not started | 0/5 | ⏳ | R-3 | note |\n' +
  '\n## סך הפרויקט\n| משימות | **60 / ~200** |\n| פערים | **36 / 156 סגורים** |\n' +
  '\n**הבא:** T4 — next step\n');

const resultActive = run(boardWithActive);
assertExit('board with a 🔄 row -> exit 0 (script never fails the session)', resultActive, 0);
if (!/POSITION \(from BOARD — no active ledger found\): \*\*Phase 2 — Voice Governance\*\*/.test(resultActive.stdout)) {
  console.error('FAIL  expected POSITION to report the 🔄 Phase 2 row');
  console.error(`      stdout: ${resultActive.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  POSITION reports the active (🔄) phase row from the fixture board');
}

const boardNoActive = writeFile(tempDir('sb-board-noactive-'), 'STATUS-BOARD.md',
  '## לוח פאזות\n\n' +
  '| Phase | שם | משימות | סטטוס | R | הערות |\n' +
  '|---|---|---|---|---|---|\n' +
  '| Phase 1 | done phase | 5/5 | ✅ **שוחרר** | R-1 | note |\n' +
  '| Phase 2 | not started | 0/5 | ⏳ | R-2 | note |\n' +
  '\n## סך הפרויקט\n| משימות | **60 / ~200** |\n| פערים | **36 / 156 סגורים** |\n' +
  '\n**הבא:** T1 — next step\n');

const resultNoActive = run(boardNoActive);
assertExit('board with no 🔄 row -> exit 0', resultNoActive, 0);
if (!/POSITION \(from BOARD — no active ledger found\): no phase marked 🔄 \(active\) on the board/.test(resultNoActive.stdout)) {
  console.error('FAIL  expected POSITION to report "no phase marked" when no row is active');
  console.error(`      stdout: ${resultNoActive.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  POSITION correctly reports no active phase when none is marked 🔄');
}

// ---------------------------------------------------------------------------
// DECISIONS AWAITING OWNER
// ---------------------------------------------------------------------------

// R-901: a genuinely open decision — status cell has NOT ruled yet.
// R-902: a decision whose OTHER cell still mentions "החלטת בעלים נדרשת" (legacy problem text)
//   but whose OWN status cell has since closed with ✅ — must NOT be reported (the live bug).
const roadmapFixture = writeFile(tempDir('sb-roadmap-'), 'ROADMAP.md',
  '| R | הפריט | מצביע-מקור | נחיתה | סטטוס |\n' +
  '|---|---|---|---|---|\n' +
  '| R-901 | some gap description | src.md | **החלטת בעלים נדרשת** — needs a ruling | ⚠️R נדרש-אימות |\n' +
  '| R-902 | some other gap | src.md | **משימת-דיון** (החלטת בעלים נדרשת) | ✅ **מומש ב-v282** — done |\n');

const boardEmpty = writeFile(tempDir('sb-board-empty2-'), 'STATUS-BOARD.md', '## לוח\n\n**הבא:** none\n');

const resultDecisions = run(boardEmpty, roadmapFixture);
assertExit('decisions scan over ROADMAP fixture -> exit 0', resultDecisions, 0);
if (!/DECISIONS AWAITING OWNER: 1 — R-901/.test(resultDecisions.stdout)) {
  console.error('FAIL  expected exactly 1 open decision (R-901)');
  console.error(`      stdout: ${resultDecisions.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  DECISIONS AWAITING OWNER lists the genuinely open row (R-901)');
}
if (/R-902/.test(resultDecisions.stdout)) {
  console.error('FAIL  R-902 (own status cell reads ✅ מומש) must NOT be reported as awaiting owner');
  console.error(`      stdout: ${resultDecisions.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  a row whose OWN status cell has closed (✅) is excluded, even though another cell still says "החלטת בעלים נדרשת"');
}

// ---------------------------------------------------------------------------
// POSITION prefers the ACTIVE LEDGER over the board (2026-08-07 fix). This reproduces the exact
// live bug: the board claims a DIFFERENT phase/plan is active while a ledger says otherwise — the
// output must name the ledger's plan, not the board's, and say which source it used.
// ---------------------------------------------------------------------------
const sddRoot = tempDir('sb-sdd-active-');
const someOtherArcLedger = writeFile(join(sddRoot, 'some-other-arc'), 'progress.md',
  '# SDD ledger — plan: docs/superpowers/plans/some-other-arc.md\n\nTask 1: complete — commit abc1234\n');
const theActiveArcLedger = writeFile(join(sddRoot, 'the-active-arc'), 'progress.md',
  '# SDD ledger — plan: docs/superpowers/plans/the-active-arc.md\n\n' +
  'Task 1: complete — commit deadbee\n' +
  'Task 2: deferred, trigger = when the mirror gains a real reader\n');
// The real signal under test is mtime, not name or write order — writing the two files back-to-back
// is not enough to guarantee this on every filesystem (observed live: a run where both landed inside
// the same mtime tick, making "the-active-arc" lose the race non-deterministically). Pin the order
// explicitly so the test proves the INTENDED scenario every time, not just when the clock cooperates.
setMtime(someOtherArcLedger, '2026-08-01T00:00:00Z');
setMtime(theActiveArcLedger, '2026-08-02T00:00:00Z');

const boardClaimsSomethingElse = writeFile(tempDir('sb-board-vs-ledger-'), 'STATUS-BOARD.md',
  '## לוח פאזות\n\n' +
  '| Phase | שם | משימות | סטטוס | R | הערות |\n' +
  '|---|---|---|---|---|---|\n' +
  '| **Phase 2 — גל 0** | board says THIS is active | **1/7** | 🔄 **פעיל** | R-1 | note |\n' +
  '\n## סך הפרויקט\n| משימות | **1 / ~7** |\n\n**הבא:** board next step\n');

const resultLedgerWins = run(boardClaimsSomethingElse, null, sddRoot);
assertExit('ledger vs. board mismatch fixture -> exit 0', resultLedgerWins, 0);
if (!/POSITION \(from ACTIVE LEDGER — the-active-arc\)/.test(resultLedgerWins.stdout)) {
  console.error('FAIL  expected POSITION to name the ACTIVE LEDGER (the-active-arc), not the board\'s claimed phase');
  console.error(`      stdout: ${resultLedgerWins.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  POSITION names the active ledger (the-active-arc), overriding the board\'s "Phase 2 — גל 0" claim');
}
if (/גל 0/.test(resultLedgerWins.stdout.split('\n').find(l => l.startsWith('POSITION')) ?? '')) {
  console.error('FAIL  the POSITION line must not carry the board\'s stale claim once a ledger exists');
  process.exitCode = 1;
} else {
  console.log('PASS  the board\'s stale "Phase 2 — גל 0" claim does not leak into the POSITION line');
}

// RED 2 (no ledger at all -> explicit "no active arc", not silence/guess) is proven directly against
// session-state.mjs in scripts/tests/test-session-state.mjs; here we only need session-brief's own
// fallback-labeled board path, already covered by the two "from BOARD" assertions above.

summary('session-brief');
