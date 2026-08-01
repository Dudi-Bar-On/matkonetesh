#!/usr/bin/env node
// scripts/check-meta.mjs — the single META entry point (METHODOLOGY §3.3 + §3.4 / H8).
// A thin orchestrator: every gate lives in its own file so it is independently self-testable
// (see scripts/tests/) and every gate prints how many items it scanned - a gate that reports green
// without saying what it covered is exactly how the §5a blind spot (audit fix #10) went unnoticed
// for a full working day (COMPLIANCE-AUDIT-2026-08-01.md).
//
// Wraps: check-graph-fresh (§10.12) · gate-lessons (§10.16) · check-board-fresh (H10) ·
// check-brief (§13) · check-h9 (H9) · check-h8-ledger (H8, §5 + §5a) · check-release in AUDIT mode
// (H7 x2 / DoD-12 / L29 / H14 - reported, not blocking; see check-release.mjs's own header for why).
//
// LAYERING (four legs — see .githooks/pre-commit, .claude/settings.json and .github/workflows/*.yml
// for the full comment): this script is invoked by .githooks/pre-commit (fast local feedback,
// bypassable by design) AND by the `discipline` job in CI (the actual authority, not bypassable)
// AND by .claude/settings.json's SessionStart hook (fires on startup/resume/compact - surfaces red
// state, blocks nothing) AND by sync-docs.sh before a docs push. check-release's commit-message-
// specific checks additionally run at commit-msg time via .githooks/commit-msg, because a commit's
// own message text isn't available yet at pre-commit time.
// Session-start AND post-compact both run this, and that is deliberate, not redundant: compaction
// is exactly the moment the working memory discipline depends on gets erased mid-session. A rule
// re-anchored right after the event that erases it is worth more than the same rule stated once at
// the start - a long session that compacts three times must not lose its grip on the rules three
// times and carry on as if nothing happened.
// Runs at: session start · every commit (hook) · every push/PR (CI) · Phase gate / arc close (H8 duty).
// Env: ROADMAP=<path> targets a fixture copy for self-tests (passed through to check-h8-ledger.mjs).
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failed = [];

function run(name, file) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) failed.push(name);
}
run('check-graph-fresh', 'check-graph-fresh.mjs');
run('gate-lessons', 'gate-lessons.mjs');
run('check-board-fresh', 'check-board-fresh.mjs');
run('check-brief', 'check-brief.mjs');
run('check-h9', 'check-h9.mjs');
run('check-release (audit mode, reported not blocking - see file header)', 'check-release.mjs');
run('check-h8-ledger (no-unlanded-items, §5 + §5a)', 'check-h8-ledger.mjs');

if (failed.length) { console.error(`\nMETA GATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nMETA GATE OK');
