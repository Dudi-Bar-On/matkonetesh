#!/usr/bin/env node
// scripts/tests/test-session-rules-drift.mjs — Task 5 (§9 proof #1 + #3): does what SessionStart
// runs actually NOTICE and REPORT a broken rule, not merely run without crashing?
//
// WHY THIS EXISTS: the task that created this file exists because the SessionStart compact hook
// fired correctly and injected 106 KB of rules verbatim — including the rule the controller then
// spent a full day violating. "It ran" was never in question. "It told you something was wrong"
// was never tested. This file tests exactly that, against the REAL rules.sqlite (session-rules.mjs
// hardcodes its own path to the project root — it cannot be pointed at a fixture copy — so per the
// task brief this test perturbs the real mirror and restores it by FILE COPY, never `git checkout`).
//
// Mechanism: session-rules.mjs (one of the four scripts .claude/settings.json's SessionStart hook
// runs) computes a RULES STORE CATALOG by comparing rules.sqlite (the mirror) against the document
// via the real extractor — see its own header. Corrupting one row's source_hash in the mirror makes
// it disagree with the document; the catalog's "stale" list is the thing under test.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { tempDir, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIRROR_PATH = join(ROOT, 'rules.sqlite');
const SESSION_RULES = join(ROOT, 'scripts', 'session-rules.mjs');

if (!existsSync(MIRROR_PATH)) {
  console.log('SKIPPED — rules.sqlite does not exist in this checkout; nothing to perturb.');
  process.exit(0);
}

const backupDir = tempDir('session-rules-drift-');
const backupPath = join(backupDir, 'rules.sqlite.bak');
copyFileSync(MIRROR_PATH, backupPath);

function runSessionRules() {
  return spawnSync(process.execPath, [SESSION_RULES], { cwd: ROOT, encoding: 'utf8' });
}

let restored = false;
function restore() {
  if (restored) return;
  copyFileSync(backupPath, MIRROR_PATH); // restore by file copy, never `git checkout`
  restored = true;
}

try {
  // --- Baseline: unmodified mirror. Also doubles as the RED proof for the assertion below — if
  // the mechanism did not depend on real corruption, this baseline run would ALREADY mention the
  // rule_id we are about to corrupt, and the "GREEN" assertion later would be meaningless.
  const baseline = runSessionRules();
  assertExit('session-rules.mjs runs clean on the unmodified mirror', baseline, 0);

  // Pick a real current row to corrupt.
  const db = new DatabaseSync(MIRROR_PATH);
  const target = db.prepare(
    "SELECT rule_id, source_hash FROM rule_revisions WHERE source_path = ? ORDER BY rule_id LIMIT 1"
  ).get('docs/process/development-discipline.md');
  if (!target) {
    db.close();
    console.log('SKIPPED — rules.sqlite has no rows for docs/process/development-discipline.md.');
    restore();
    process.exit(0);
  }
  const targetId = target.rule_id;
  const RED_check = baseline.stdout.includes(`~ ${targetId}:`);
  if (RED_check) {
    console.error(`FAIL  baseline (uncorrupted) run already names ${targetId} as stale — the assertion below would prove nothing`);
    process.exitCode = 1;
  } else {
    console.log(`PASS  baseline (uncorrupted) run does NOT name ${targetId} as stale — corruption below is a real signal, not decoration`);
  }

  db.prepare("UPDATE rule_revisions SET source_hash = ? WHERE source_path = ? AND rule_id = ?")
    .run('0000000000000000000000000000000000000000000000000000000000deadbeef', 'docs/process/development-discipline.md', targetId);
  db.close();

  // --- GREEN: corrupted mirror. session-rules.mjs (the real script SessionStart runs) must SAY SO.
  const corrupted = runSessionRules();
  assertExit('session-rules.mjs still exits 0 (read-only report, never blocks) on a corrupted mirror', corrupted, 0);
  const sawStaleMarker = /⚠ STALE: disagrees with/.test(corrupted.stdout);
  const sawTargetId = corrupted.stdout.includes(`~ ${targetId}:`);
  if (sawStaleMarker && sawTargetId) {
    console.log(`PASS  session-rules.mjs reports the mirror as STALE and names the corrupted rule (${targetId})`);
  } else {
    console.error(`FAIL  session-rules.mjs did not report the corrupted rule ${targetId} as stale (sawStaleMarker=${sawStaleMarker}, sawTargetId=${sawTargetId})`);
    console.error(`      stdout excerpt: ${corrupted.stdout.split('\n').filter(l => /STALE|CATALOG|disagreements/.test(l)).join(' | ')}`);
    process.exitCode = 1;
  }

  // --- Restore, and verify the restoration actually took (never just assumed).
  restore();
  const afterRestore = runSessionRules();
  const stillFlagged = afterRestore.stdout.includes(`~ ${targetId}:`);
  if (!stillFlagged) {
    console.log(`PASS  after restoring rules.sqlite by file copy, ${targetId} is no longer reported as stale`);
  } else {
    console.error(`FAIL  ${targetId} is STILL reported as stale after restoring rules.sqlite — restoration did not take`);
    process.exitCode = 1;
  }
} finally {
  restore(); // belt-and-braces: never leave the real mirror corrupted, even if an assertion threw.
}

summary('test-session-rules-drift');
