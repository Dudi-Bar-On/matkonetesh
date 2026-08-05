#!/usr/bin/env node
// scripts/check-meta.mjs — the single META entry point (METHODOLOGY §3.3 + §3.4 / H8).
// A thin orchestrator: every gate lives in its own file so it is independently self-testable
// (see scripts/tests/) and every gate prints how many items it scanned - a gate that reports green
// without saying what it covered is exactly how the §5a blind spot (audit fix #10) went unnoticed
// for a full working day (COMPLIANCE-AUDIT-2026-08-01.md).
//
// Wraps: check-memory-fresh (§10.12) · check-pytest (the Python suite) · check-no-secrets · gate-lessons (§10.16) · check-board-fresh (H10) ·
// check-shipped-closed (H10) · check-brief (§13) · check-h9 (H9) · check-h8-ledger (H8, §5 + §5a) ·
// check-release in AUDIT mode
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
//   - check-memory-fresh: BLOCKING (2026-08-04). Its predecessor, check-graph-fresh, was advisory
//     under exactly the reasoning this paragraph sets out — doc drift is a property of elapsed time
//     and no single commit could fix it without "a separate heavy rebuild action". That reasoning
//     was sound about graphify and wrong about the requirement: the heavy action was the thing to
//     remove, not the gate to weaken. Ingesting a changed document into the SQLite store costs
//     0.32 s, so drift IS now fixable from the commit that causes it, and blocking is the correct
//     incentive. The nightly graph-freshness.yml is gone with it (8 runs, 0 successes).
//   - check-brief / check-h9: block only on a file NOT already grandfathered in
//     docs/process/gate-baselines.json - see each script's own header for the mechanism.
//   - check-h8-ledger: blocks only on a finding NOT already present at the git HEAD baseline (i.e. a
//     finding this commit itself introduces or worsens) - see the script's own header.
//   - check-board-fresh / check-release / gate-lessons / check-shipped-closed: UNCHANGED, still contribute to `failed` on
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
// 2026-08-04: this set is now EMPTY, and that is the point.
//
// It held exactly one member, check-graph-fresh, which was advisory because it could not pass:
// rebuilding graphify's 22 MB graph took an out-of-process LLM run, so the gate sat at 115 stale
// documents and its owning workflow failed 8 of 8 runs. Reviewers 9 and 10 both named it — a
// permanently amber signal is an off signal, and worse, it teaches that gates are noise.
//
// check-memory-fresh replaces it and BLOCKS, because its remedy is `python scripts/memsync.py`,
// measured at 0.32 s for a one-file change. A gate is only allowed to block when the fix is
// cheap; the honest response to an expensive fix is to make it cheap, not to mark the gate
// advisory and look away.
const ADVISORY = new Set([]);

function run(id, displayName, file) {
  console.log(`\n=== ${displayName} ===`);
  if (SKIP_ALL || SKIP_IDS.includes(id)) {
    console.log(`SKIPPED — META_SKIP_GATE names "${id}" (recorded in .superpowers/gate-skip-log.jsonl by the calling hook).`);
    return;
  }
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    if (ADVISORY.has(id)) {
      console.log('  (ADVISORY — reported, does not block. ADVISORY is currently empty by design; see the set above.)');
      return;
    }
    failed.push(displayName);
  }
}

run('check-memory-fresh', 'check-memory-fresh', 'check-memory-fresh.mjs');
run('check-pytest', 'check-pytest', 'check-pytest.mjs');
run('check-no-secrets', 'check-no-secrets', 'check-no-secrets.mjs');
run('gate-lessons', 'gate-lessons', 'gate-lessons.mjs');
run('check-board-fresh', 'check-board-fresh', 'check-board-fresh.mjs');
run('check-brief', 'check-brief', 'check-brief.mjs');
run('check-h9', 'check-h9', 'check-h9.mjs');
run('check-release', 'check-release (audit mode, reported not blocking - see file header)', 'check-release.mjs');
run('check-h8-ledger', 'check-h8-ledger (no-unlanded-items, §5 + §5a, worsening-only)', 'check-h8-ledger.mjs');
run('check-shipped-closed', 'check-shipped-closed (a row whose work shipped may not stay open, H10)', 'check-shipped-closed.mjs');

if (failed.length) { console.error(`\nMETA GATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nMETA GATE OK');
