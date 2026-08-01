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
//
// GATE SCOPING (gate-scoping-report.md, 2026-08-01 follow-up). Live rediscovery: a commit that PAID
// DOWN compliance debt got blocked by this orchestrator's OWN pre-existing red state (a stale graph,
// 22 historical briefs) — neither introduced nor worsened by that commit. A gate that blocks the
// commit meant to fix it teaches the escape hatch to become routine, which is exactly as protective as
// no gate. Per-checker ruling (argued in each script's own header, not just asserted here):
//   - check-graph-fresh: ADVISORY, always. It never contributes to `failed` in this orchestrator - it
//     is a property of ELAPSED TIME (doc drift since the last graph rebuild), not of any one commit;
//     no single commit can "fix" it without a separate heavy rebuild action. Owned by the nightly
//     graph-freshness.yml schedule (calls the script directly, blocking there) and by SessionStart
//     visibility (this script, printed but not gating).
//   - check-brief / check-h9: block only on a file NOT already grandfathered in
//     docs/process/gate-baselines.json - see each script's own header for the mechanism.
//   - check-h8-ledger: blocks only on a finding NOT already present at the git HEAD baseline (i.e. a
//     finding this commit itself introduces or worsens) - see the script's own header.
//   - check-board-fresh / check-release / gate-lessons: UNCHANGED, still contribute to `failed` on
//     every run. Their invariant is always fixable by a single, cheap, immediate edit reachable from
//     the very commit that trips them (update the board header line; write the release commit message
//     correctly; add the lesson) - unlike the three above, there is no "separate heavy action" excuse,
//     so blocking is the correct incentive here, not accumulated debt.
//
// ESCAPE HATCH (narrower + noisier, same follow-up). META_SKIP_HOOK=1 used to skip EVERY gate,
// silently, with no record beyond that one commit's own terminal scrollback. Replaced by
// META_SKIP_GATE=<id>[,<id>...] (ids match the first argument to run() below) — or the literal value
// "ALL" for a full bypass, which still has to be typed out, never a default. `.githooks/pre-commit`
// and `.githooks/commit-msg` append every use to .superpowers/gate-skip-log.jsonl BEFORE invoking this
// script; THIS script prints that log's recent entries at the top of every run (including SessionStart
// and post-compact), so a skip cannot quietly age out of view — it resurfaces every time discipline is
// checked, not just at the moment it was used.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failed = [];

// ---- surface any recorded gate skips loudly, every run - never let one age silently out of view ----
const SKIP_LOG = join(ROOT, '.superpowers', 'gate-skip-log.jsonl');
if (existsSync(SKIP_LOG)) {
  const lines = readFileSync(SKIP_LOG, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length) {
    console.log(`=== gate-skip-log: ${lines.length} recorded override(s) - .superpowers/gate-skip-log.jsonl ===`);
    for (const l of lines.slice(-10)) {
      try {
        const e = JSON.parse(l);
        console.log(`  ! ${e.ts}  hook=${e.hook}  gates=${e.gates}  branch=${e.branch ?? '?'}`);
      } catch { console.log(`  ! (unparsed entry) ${l}`); }
    }
    if (lines.length > 10) console.log(`  ... and ${lines.length - 10} older entry(ies) above these.`);
  }
}

const SKIP_IDS = (process.env.META_SKIP_GATE || '').split(',').map(s => s.trim()).filter(Boolean);
const SKIP_ALL = SKIP_IDS.includes('ALL');
// Time-elapsed property, not a per-commit one - see the header block above for the full argument.
const ADVISORY = new Set(['check-graph-fresh']);

function run(id, displayName, file) {
  console.log(`\n=== ${displayName} ===`);
  if (SKIP_ALL || SKIP_IDS.includes(id)) {
    console.log(`SKIPPED — META_SKIP_GATE names "${id}" (recorded in .superpowers/gate-skip-log.jsonl by the calling hook).`);
    return;
  }
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    if (ADVISORY.has(id)) {
      console.log('  (STANDING DEBT — advisory only inside check-meta; does not block a commit. Owned by the nightly graph-freshness.yml schedule and SessionStart visibility. See development-discipline.md §10 / gate-scoping-report.md.)');
      return;
    }
    failed.push(displayName);
  }
}

run('check-graph-fresh', 'check-graph-fresh', 'check-graph-fresh.mjs');
run('gate-lessons', 'gate-lessons', 'gate-lessons.mjs');
run('check-board-fresh', 'check-board-fresh', 'check-board-fresh.mjs');
run('check-brief', 'check-brief', 'check-brief.mjs');
run('check-h9', 'check-h9', 'check-h9.mjs');
run('check-release', 'check-release (audit mode, reported not blocking - see file header)', 'check-release.mjs');
run('check-h8-ledger', 'check-h8-ledger (no-unlanded-items, §5 + §5a, worsening-only)', 'check-h8-ledger.mjs');

if (failed.length) { console.error(`\nMETA GATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nMETA GATE OK');
