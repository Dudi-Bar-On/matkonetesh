// scripts/tests/test-check-shipped-closed.mjs — self-test for the check-shipped-closed gate.
//
// The failure this gate exists for happened twice in two days, and both times the evidence was sitting
// in plain text: the release commit AND the release UX report both said "סוגר את R-52, R-57, R-61,
// R-62" while all four rows stayed marked open in the ledger. Nothing compared the two. It was caught
// only because a human asked what was still open.
//
// So the tests below are built around that exact shape, and the FIRST assertion in each pair is the
// known-bad one: a checker that has never been observed failing is not a checker (test-helpers.mjs).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertExit, runNode, tempDir, writeFile, makeGitRepo, summary } from './test-helpers.mjs';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-shipped-closed.mjs');

const HEADER = [
  '| # | נושא | מקור | נחיתה | סטטוס |',
  '|---|---|---|---|---|',
].join('\n');

function roadmap(rows) {
  return `# fixture ledger\n\n${HEADER}\n${rows.join('\n')}\n`;
}
const OPEN_52 = '| R-52 | סקר-רוחב: היכן המערכת צריכה לדבר | owner | Phase 2 | 🔵 נרשם |';
const DONE_52 = '| R-52 | סקר-רוחב: היכן המערכת צריכה לדבר | owner | Phase 2 | ✅ שוחרר ב-v285 |';
const OPEN_57 = '| R-57 | אירוע תקוע בעבר הוא מצב לא-חוקי | owner | Phase 2 | 🟠 מאושר לתכנון |';
const DONE_57 = '| R-57 | אירוע תקוע בעבר הוא מצב לא-חוקי | owner | Phase 2 | ✅ שוחרר ב-v285 |';

// ---- 1. the real v285 shape: release commit claims the closure, ledger still says open -> RED ----
{
  const repo = makeGitRepo([
    { subject: 'feat: something', date: '2026-08-01T10:00:00' },
    { subject: 'release(v285): voice governance', body: 'release(v285): voice governance\n\nסוגר את R-52, R-57.\n', date: '2026-08-02T04:30:00' },
  ]);
  const rm = writeFile(repo, 'ledger.md', roadmap([OPEN_52, OPEN_57]));
  assertExit('release commit claims closure, both rows still open -> FAIL',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rm, RELEASES_DIR: join(repo, 'nonexistent') }), 1);

  const rmFixed = writeFile(repo, 'ledger-fixed.md', roadmap([DONE_52, DONE_57]));
  assertExit('same claim, both rows closed -> OK',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rmFixed, RELEASES_DIR: join(repo, 'nonexistent') }), 0);
}

// ---- 2. partial closure is still a failure: three closed, one forgotten is the likeliest real case ----
{
  const repo = makeGitRepo([
    { subject: 'release(v285): x', body: 'release(v285): x\n\nסוגר את R-52 ו-R-57\n', date: '2026-08-02T04:30:00' },
  ]);
  const rm = writeFile(repo, 'ledger.md', roadmap([DONE_52, OPEN_57]));
  assertExit('one of two named rows left open -> FAIL',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rm, RELEASES_DIR: join(repo, 'nonexistent') }), 1);
}

// ---- 3. the UX report is the other half of the evidence, and it is a file, not a commit ----
{
  const repo = makeGitRepo([{ subject: 'chore: init', date: '2026-08-02T04:30:00' }]);
  const rel = join(repo, 'releases');
  writeFile(rel, 'v285-ux-report.md', '# v285\n\n**היקף:** 14 משימות. סוגר את R-52.\n');
  const rm = writeFile(repo, 'ledger.md', roadmap([OPEN_52]));
  assertExit('release UX report claims closure, row open -> FAIL',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rm, RELEASES_DIR: rel }), 1);

  const rmFixed = writeFile(repo, 'ledger-fixed.md', roadmap([DONE_52]));
  assertExit('same report, row closed -> OK',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rmFixed, RELEASES_DIR: rel }), 0);
}

// ---- 4. no claim anywhere is not a failure - the gate must stay silent when it has nothing to compare
{
  const repo = makeGitRepo([{ subject: 'docs: notes', date: '2026-08-02T04:30:00' }]);
  const rm = writeFile(repo, 'ledger.md', roadmap([OPEN_52, OPEN_57]));
  assertExit('open rows but nobody claimed they shipped -> OK',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rm, RELEASES_DIR: join(repo, 'nonexistent') }), 0);
}

// ---- 5. a claim naming a row that does not exist must be reported, not silently ignored.
// A typo'd id is the one way this gate could report green while the real row rots untouched.
{
  const repo = makeGitRepo([
    { subject: 'release(v9): x', body: 'release(v9): x\n\nסוגר את R-999\n', date: '2026-08-02T04:30:00' },
  ]);
  const rm = writeFile(repo, 'ledger.md', roadmap([DONE_52]));
  assertExit('claim names an id absent from the ledger -> FAIL',
    runNode(GATE, [], { GITROOT: repo, ROADMAP: rm, RELEASES_DIR: join(repo, 'nonexistent') }), 1);
}

summary('check-shipped-closed');
