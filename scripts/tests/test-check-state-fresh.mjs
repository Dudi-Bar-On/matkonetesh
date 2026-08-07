#!/usr/bin/env node
// scripts/tests/test-check-state-fresh.mjs — self-test for check-state-fresh.mjs (Task 1 item 7/10).
// RED: a commit lands in the arc with no matching ledger update -> check-meta-shaped FAIL, naming the
//      gate and the offending commit(s), with an exact one-line fix.
// Counter-RED: the ledger IS updated alongside the commit -> OK, exit 0 ("passes silently" in the
//      check-meta aggregate sense — no failure entry, nothing to fix).
// No active arc at all -> SKIP with a stated reason, never a failure.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { makeGitRepo, gitAdd, gitCommit, tempDir, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-state-fresh.mjs');

function touchAfter(path, isoAfterThis) {
  // set the file's own mtime explicitly, independent of when git wrote it to disk
  const d = new Date(isoAfterThis);
  utimesSync(path, d, d);
}

// ---------------------------------------------------------------------------
// No active arc at all -> SKIP (exit 0), stated reason.
// ---------------------------------------------------------------------------
{
  const repo = makeGitRepo([{ subject: 'first commit', date: '2026-08-01T10:00:00' }]);
  const emptySdd = join(repo, 'no-such-sdd-dir');
  const r = runNode(SCRIPT, [], { GITROOT: repo, SDD_DIR: emptySdd });
  assertExit('no ledger anywhere -> exit 0 (SKIP)', r, 0);
  if (!/SKIP - no active arc/.test(r.stdout)) {
    console.error('FAIL  expected a stated SKIP reason when there is no active arc');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  no active arc -> explicit SKIP, not a failure');
  }
}

// ---------------------------------------------------------------------------
// RED: a commit lands after the ledger's own last edit, and the ledger is NOT among the files that
// commit touched -> BLOCK, naming the gate and the offending commit.
// ---------------------------------------------------------------------------
{
  const repo = makeGitRepo([
    { subject: 'seed commit', date: '2026-08-01T09:00:00' },
  ]);
  const sddDir = join(repo, '.superpowers', 'sdd', 'demo-arc');
  mkdirSync(sddDir, { recursive: true });
  const ledgerPath = join(sddDir, 'progress.md');
  writeFileSync(ledgerPath, '# SDD ledger — plan: docs/superpowers/plans/demo-arc.md\n\nTask 1: complete\n', 'utf8');
  touchAfter(ledgerPath, '2026-08-01T10:00:00');
  // Land a LATER commit that does NOT touch the ledger -- this is the R-109 shape: code changed,
  // ledger was not.
  gitAdd(repo, 'some-code-file.txt', 'v2 content', 'GIT_AUTHOR_DATE');
  gitCommit(repo, 'unrelated code change, ledger not updated', null, '2026-08-01T11:00:00');

  const r = runNode(SCRIPT, [], { GITROOT: repo, SDD_DIR: join(repo, '.superpowers', 'sdd') });
  assertExit('commit landed, ledger not touched -> exit 1 (FAIL)', r, 1);
  if (!/FAIL: check-state-fresh/.test(r.stderr) || !/unrelated code change, ledger not updated/.test(r.stderr)) {
    console.error('FAIL  expected the gate to name itself and the offending commit in its FAIL output');
    console.error(`      stderr: ${r.stderr}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  RED: stale ledger (commit landed, ledger untouched) -> gate names itself and the offending commit');
  }
  if (!/Fix: append one line/.test(r.stderr)) {
    console.error('FAIL  expected the gate to print the exact one-line fix');
    process.exitCode = 1;
  } else {
    console.log('PASS  the gate prints the exact, cheap, immediate fix (append one line to the ledger)');
  }
}

// ---------------------------------------------------------------------------
// Counter-RED: the ledger IS updated (committed) alongside the later commit -> OK, exit 0.
// ---------------------------------------------------------------------------
{
  const repo = makeGitRepo([
    { subject: 'seed commit', date: '2026-08-01T09:00:00' },
  ]);
  const sddRel = join('.superpowers', 'sdd', 'demo-arc', 'progress.md');
  const sddDirAbs = join(repo, '.superpowers', 'sdd', 'demo-arc');
  mkdirSync(sddDirAbs, { recursive: true });
  // First ledger version, committed early (old mtime).
  gitAdd(repo, sddRel, '# SDD ledger — plan: docs/superpowers/plans/demo-arc.md\n\nTask 1: complete\n', 'GIT_AUTHOR_DATE');
  gitCommit(repo, 'ledger: task 1 complete', null, '2026-08-01T10:00:00');
  // Now the ledger is updated for a NEW task and committed together with a later timestamp -- both
  // the code commit and the ledger edit land in the same later window.
  gitAdd(repo, 'some-code-file.txt', 'v2', 'GIT_AUTHOR_DATE');
  gitCommit(repo, 'code: task 2 work', null, '2026-08-01T11:00:00');
  gitAdd(repo, sddRel, '# SDD ledger — plan: docs/superpowers/plans/demo-arc.md\n\nTask 1: complete\nTask 2: complete\n', 'GIT_AUTHOR_DATE');
  gitCommit(repo, 'ledger: task 2 complete', null, '2026-08-01T11:05:00');
  // The ledger file's own mtime is now the moment of its last edit (roughly "now", well after
  // the commits above) -- move it explicitly to right after the FIRST ledger commit, so the two
  // later commits ("code: task 2" and "ledger: task 2") both fall in the --since window, and the
  // gate must find the ledger among the touched paths of that window rather than relying on mtime
  // ordering alone.
  touchAfter(join(repo, sddRel), '2026-08-01T10:30:00');

  const r = runNode(SCRIPT, [], { GITROOT: repo, SDD_DIR: join(repo, '.superpowers', 'sdd') });
  assertExit('ledger updated alongside later commits -> exit 0 (OK)', r, 0);
  if (!/OK - active ledger was updated alongside/.test(r.stdout)) {
    console.error('FAIL  expected an explicit OK when the ledger was touched within the same commit window');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  counter-RED: ledger updated alongside the commits -> passes (OK, exit 0)');
  }
}

summary('check-state-fresh');
