#!/usr/bin/env node
// scripts/tests/test-check-board-fresh.mjs — self-test for check-board-fresh.mjs (H10).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGitRepo, writeFile, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-board-fresh.mjs');

const repo = makeGitRepo([
  { subject: 'release(v10): first', date: '2026-07-01T10:00:00' },
  { subject: 'unrelated commit', date: '2026-07-02T10:00:00' },
  { subject: 'release(v12): second', date: '2026-07-03T10:00:00' },
]);

// RED: board still says v10, but v12 is the newest release -> must FAIL.
const staleBoard = writeFile(repo, 'board-stale.md', '# board\n\n> **בסיס: v10** (stale)\n');
assertExit(
  'stale board (v10) vs newest release v12 -> exit 1',
  runNode(SCRIPT, [], { GITROOT: repo, BOARD: staleBoard }),
  1,
);

// GREEN: board matches the newest release -> must PASS.
const freshBoard = writeFile(repo, 'board-fresh.md', '# board\n\n> **בסיס: v12** (fresh)\n');
assertExit(
  'fresh board (v12) matches newest release v12 -> exit 0',
  runNode(SCRIPT, [], { GITROOT: repo, BOARD: freshBoard }),
  0,
);

summary('check-board-fresh');
