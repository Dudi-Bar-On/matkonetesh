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
import { tempDir, writeFile, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'session-brief.mjs');

function run(boardPath, roadmapPath) {
  // session-brief.mjs has no GITROOT seam (git() always runs against the real repo, ROOT) — that's
  // fine here: liveVsBoard/inFlight/standingDebt read the real repo's git log and graph, and are
  // not under test in this file. Only BOARD/ROADMAP are overridden.
  return runNode(SCRIPT, [], {
    BOARD: boardPath,
    ROADMAP: roadmapPath ?? join(tempDir('sb-no-roadmap-'), 'does-not-exist.md'),
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
if (!/POSITION: \*\*Phase 2 — Voice Governance\*\*/.test(resultActive.stdout)) {
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
if (!/POSITION: no phase marked 🔄 \(active\) on the board/.test(resultNoActive.stdout)) {
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

summary('session-brief');
