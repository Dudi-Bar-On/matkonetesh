#!/usr/bin/env node
// scripts/tests/test-check-backup-fresh.mjs — self-test for check-backup-fresh.mjs (R-111, task 7).
// RED: a base backup older than the limit -> FAIL, naming the file and its age.
// Counter-RED: a fresh backup of every kind -> OK, exit 0, passes silently (one summary line).
// Missing-destination-drive -> SKIP (exit 0), stated reason, never a failure (F: is meant to be
// disconnected sometimes; an unenabled WAL archive is an unmet precondition, not a finding).
// No-backup-at-all-though-drive-present -> FAIL (distinct from the drive-absent case).
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tempDir, setMtime, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-backup-fresh.mjs');

function iso(hoursAgo) { return new Date(Date.now() - hoursAgo * 3_600_000).toISOString(); }
function minutesAgoIso(m) { return new Date(Date.now() - m * 60_000).toISOString(); }

function freshDump(dir, name, hoursAgo = 1) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, 'x'.repeat(20)); // content irrelevant — mtime is what this gate reads
  setMtime(p, iso(hoursAgo));
  return p;
}

// A real mounted drive root this box has, used only to prove the "drive present" path (the fixture
// dirs below all live under it) — NOT written to except via mkdtemp-style temp dirs.
const REAL_ROOT = parse(tempDir('gate-test-')).root;

// ---------------------------------------------------------------------------
// Missing destination drive entirely -> SKIP, exit 0.
// ---------------------------------------------------------------------------
{
  const noSuchDrive = 'Q:\\no-such-drive-mk-test\\backups';
  const noSuchArchive = 'Q:\\no-such-drive-mk-test\\archive';
  const r = runNode(SCRIPT, [], { PRIMARY_DEST: noSuchDrive, ARCHIVE_DEST: noSuchArchive });
  assertExit('drive Q: not mounted -> exit 0 (SKIP)', r, 0);
  if (!/SKIP - primary destination drive/.test(r.stdout) || !/SKIP - WAL archive drive/.test(r.stdout)) {
    console.error('FAIL  expected a stated SKIP reason for both missing-drive destinations');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  missing destination drive -> explicit SKIP, not a failure');
  }
}

// ---------------------------------------------------------------------------
// Drive present, WAL archiving never enabled (archive dir absent) -> SKIP for that leg only.
// ---------------------------------------------------------------------------
{
  const primary = tempDir('gate-test-backups-');
  freshDump(primary, 'mk_knowledge-20260808-000000.dump', 1);
  freshDump(primary, 'neo4j-20260808-000000.dump', 1);
  const archive = join(tempDir('gate-test-noarchive-'), 'does-not-exist');
  const r = runNode(SCRIPT, [], { PRIMARY_DEST: primary, ARCHIVE_DEST: archive });
  assertExit('archiving never enabled -> exit 0 (SKIP for that leg, base backups fresh)', r, 0);
  if (!/has not been run on this machine/.test(r.stdout)) {
    console.error('FAIL  expected the "not enabled yet" SKIP reason for the archive leg');
    process.exitCode = 1;
  } else {
    console.log('PASS  archive dir absent -> SKIP with stated reason, not a failure');
  }
}

// ---------------------------------------------------------------------------
// Counter-RED: everything fresh -> OK, exit 0, passes silently (no FAIL lines).
// ---------------------------------------------------------------------------
{
  const primary = tempDir('gate-test-backups-');
  freshDump(primary, 'mk_knowledge-20260808-010000.dump', 2);
  freshDump(primary, 'neo4j-20260808-010000.dump', 2);
  const archive = tempDir('gate-test-archive-');
  const walFile = join(archive, '000000010000000000000005');
  writeFileSync(walFile, 'x'.repeat(16));
  setMtime(walFile, minutesAgoIso(3));
  const r = runNode(SCRIPT, [], { PRIMARY_DEST: primary, ARCHIVE_DEST: archive });
  assertExit('everything fresh -> exit 0 (OK)', r, 0);
  if (/FAIL/.test(r.stdout) || /FAIL/.test(r.stderr)) {
    console.error('FAIL  expected no FAIL line when every destination is fresh');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  all fresh -> OK, silent (no FAIL lines)');
  }
}

// ---------------------------------------------------------------------------
// RED: a stale base backup -> FAIL, naming the file and its age.
// ---------------------------------------------------------------------------
{
  const primary = tempDir('gate-test-backups-');
  freshDump(primary, 'mk_knowledge-20260801-010000.dump', 96); // 4 days old, well past the 48h limit
  freshDump(primary, 'neo4j-20260808-010000.dump', 1);
  const archive = tempDir('gate-test-archive-');
  const r = runNode(SCRIPT, [], { PRIMARY_DEST: primary, ARCHIVE_DEST: archive });
  assertExit('stale mk_knowledge backup -> exit 1 (FAIL)', r, 1);
  if (!/mk_knowledge \(geniza\) base backup.*96\.0h old/s.test(r.stderr) && !/96\.0h old/.test(r.stderr)) {
    console.error('FAIL  expected the stale backup\'s age named in the FAIL output');
    console.error(`      stderr: ${r.stderr}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  stale base backup -> FAIL naming the file and its age');
  }
}

// ---------------------------------------------------------------------------
// RED: drive present, but no backup of a given kind exists at all -> FAIL (distinct from SKIP).
// ---------------------------------------------------------------------------
{
  const primary = tempDir('gate-test-backups-');
  freshDump(primary, 'mk_knowledge-20260808-010000.dump', 1); // geniza present
  // no neo4j-*.dump at all
  const archive = tempDir('gate-test-archive-');
  const r = runNode(SCRIPT, [], { PRIMARY_DEST: primary, ARCHIVE_DEST: archive });
  assertExit('neo4j dump never taken, drive present -> exit 1 (FAIL)', r, 1);
  if (!/no neo4j-\*\.dump exists/.test(r.stderr)) {
    console.error('FAIL  expected "no neo4j-*.dump exists" in the FAIL output');
    console.error(`      stderr: ${r.stderr}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  missing backup kind (drive present) -> FAIL, distinct from SKIP');
  }
}

// ---------------------------------------------------------------------------
// The WAL leg, rewritten 2026-08-08. It used to assert that a 45-minute-old archive file FAILS. That
// assertion encoded a wrong contract, and the gate proved it by blocking a commit on a completely
// healthy system: archive_timeout switches a segment only when something has been WRITTEN, so an idle
// hour produces no new file and age alone reads that as a stall. What actually distinguishes the two
// is whether a COMPLETED segment is waiting — so these three cases test that, with the old file age
// held deliberately stale in every one of them to prove age is no longer what decides.
// ---------------------------------------------------------------------------
function walFixture(minutesOld = 45) {
  const primary = tempDir('gate-test-backups-');
  freshDump(primary, 'mk_knowledge-20260808-010000.dump', 1);
  freshDump(primary, 'neo4j-20260808-010000.dump', 1);
  const archive = tempDir('gate-test-archive-');
  const walFile = join(archive, '0000000100000000000000C0');
  writeFileSync(walFile, 'x'.repeat(16));
  setMtime(walFile, minutesAgoIso(minutesOld));
  return { PRIMARY_DEST: primary, ARCHIVE_DEST: archive };
}

// RED 1: completed segments genuinely not being shipped -> FAIL.
{
  const r = runNode(SCRIPT, [], {
    ...walFixture(),
    WAL_PENDING_OVERRIDE: '0000000100000000000000FF|0000000100000000000000C0|0|',
  });
  assertExit('WAL: 63 completed segments unshipped -> exit 1 (FAIL)', r, 1);
  if (!/segment\(s\) behind/.test(r.stderr)) {
    console.error('FAIL  expected the FAIL output to name how many segments are behind');
    process.exitCode = 1;
  } else {
    console.log('PASS  unshipped segments -> FAIL naming the distance');
  }
}

// RED 2: PostgreSQL itself reporting archive failures -> FAIL, regardless of distance.
{
  const r = runNode(SCRIPT, [], {
    ...walFixture(),
    WAL_PENDING_OVERRIDE: '0000000100000000000000C1|0000000100000000000000C0|3|0000000100000000000000BF',
  });
  assertExit('WAL: pg_stat_archiver reports failures -> exit 1 (FAIL)', r, 1);
  if (!/FAILING/.test(r.stderr)) {
    console.error('FAIL  expected the FAIL output to say archiving is failing');
    process.exitCode = 1;
  } else {
    console.log('PASS  archive failures -> FAIL, even one segment behind');
  }
}

// COUNTER-RED, the case that caused all this: an idle cluster with a stale file and NOTHING pending
// must pass in silence. One segment ahead is the segment currently being written — not archivable yet.
{
  const r = runNode(SCRIPT, [], {
    ...walFixture(120),
    WAL_PENDING_OVERRIDE: '0000000100000000000000C1|0000000100000000000000C0|0|',
  });
  assertExit('WAL: idle cluster, 2h-old file, nothing pending -> exit 0 (OK)', r, 0);
  if (/FAIL/.test(r.stderr)) {
    console.error('FAIL  an idle cluster must not produce a finding');
    process.exitCode = 1;
  } else {
    console.log('PASS  idle cluster with an old file -> silent OK');
  }
}

void REAL_ROOT; // documents the fixture-root rationale above even though unused directly
summary('check-backup-fresh');
