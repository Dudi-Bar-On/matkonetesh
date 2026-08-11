#!/usr/bin/env node
// scripts/check-graphify-fresh.mjs — R-136 Half 2: the deterministic code graph must not go stale
// behind a gate that cannot pass, the way the OLD LLM-rebuilt graph did (8 of 8 nightly runs failed,
// marked advisory, 115 documents went stale behind it — see check-meta.mjs's own history and
// CLAUDE.md: "a map that is never current is not a map").
//
// WHY THIS ONE CAN ACTUALLY PASS: graphify extracts structurally via AST, no LLM, no API key.
// Measured on this repo: 58s cold / 22s warm (r136-measurement.md). A refresh that cheap can run
// from the very commit that makes the graph stale, which is check-meta.mjs's own bar for whether a
// gate is allowed to BLOCK ("the fix is cheap and immediate from this commit" — same reasoning
// check-geniza-fresh.mjs already argues for the doc corpus; this gate makes the same argument for
// the code graph).
//
// SCOPE, reused not reinvented (R-116 / R-149): "did this commit touch CODE" is exactly the
// question scripts/lib/change-scope.mjs already answers for check-pytest.mjs. This gate imports
// isProseFile from there rather than re-typing PROSE_ONLY_PATTERNS as a git pathspec — a second
// independent copy of that criterion is the exact shape R-116 forbids.
//
// FOUR STATES (all four are named in the R-136 brief's RED list):
//   1. graphify not installed         -> SKIP, exit 0, "NOT VERIFIED here: ..." — never block,
//                                         never silently pass.
//   2. graph already fresh            -> PASS, exit 0, nothing run.
//   3. graph stale, self-heal works   -> `graphify update <root> --no-cluster` runs (~22s warm),
//                                         re-checked, PASS if the refresh actually caught up.
//   4. graph stale, cannot self-heal  -> FAIL, exit 1. Triggered either by the refresh itself
//                                         failing, or by CHECK_GRAPHIFY_NO_HEAL=1 (the deliberate
//                                         "prove staleness fails" mode — self-heal alone can never
//                                         be OBSERVED failing in normal operation, since it fixes
//                                         what it finds; this flag is how the RED for state 4 gets
//                                         witnessed at all. Mirrors GENIZA_NO_HEAL=1 in
//                                         check-geniza-fresh.mjs, an established pattern here.)
//
// FRESHNESS SIGNAL: the mtime of graphify-out/graph.json versus the timestamp of the most recent
// commit that touched a non-prose (tracked) file, found by walking `git log --name-only` newest
// first and stopping at the first commit containing a non-prose path — O(1) commits in the normal
// case, since almost every commit touches code here. graph.json older than that commit is stale.
// graphify-out/ is git-ignored by design (a build artifact, R-136 note in CLAUDE.md) — this is why
// the check is against mtime/commit-time rather than a content hash in a committed manifest.
//
// TEST SEAM: CHECK_GRAPHIFY_ROOT overrides the repo root (a disposable git fixture in tests);
// CHECK_GRAPHIFY_BIN overrides the resolved binary/command ('MISSING' simulates "not installed");
// CHECK_GRAPHIFY_GRAPH_JSON overrides the graph.json path; CHECK_GRAPHIFY_NO_HEAL=1 disables the
// self-heal (see state 4 above).

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProseFile } from './lib/change-scope.mjs';

const SELF_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = process.env.CHECK_GRAPHIFY_ROOT || SELF_ROOT;
export const GRAPH_JSON = process.env.CHECK_GRAPHIFY_GRAPH_JSON || join(ROOT, 'graphify-out', 'graph.json');
const NO_HEAL = process.env.CHECK_GRAPHIFY_NO_HEAL === '1';

// State 1's resolver. Returns null (absent) or {cmd, useShell} for a callable graphify.
export function resolveGraphifyBin() {
  const override = process.env.CHECK_GRAPHIFY_BIN;
  if (override === 'MISSING') return null;
  const cmd = override || 'graphify';
  const probe = spawnSync(cmd, ['--help'], { encoding: 'utf8', shell: !!override });
  if (probe.error || probe.status === null || probe.status === undefined) return null;
  return { cmd, useShell: !!override };
}

// The freshness signal: the epoch (seconds) of the most recent commit touching a non-prose file,
// via scripts/lib/change-scope.mjs's OWN criterion — not a re-typed pathspec. Returns
// {determined:false} if git could not answer (fail-open direction matches change-scope.mjs's own
// rule: an undetermined answer must never read as "fresh").
export function latestNonProseCommitEpoch(root) {
  const r = spawnSync('git', ['log', '--name-only', '--format=\x01%ct'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) {
    return { determined: false, epoch: null, reason: r.stderr?.trim()?.split('\n')[0] || 'git log failed' };
  }
  const lines = (r.stdout ?? '').split('\n');
  let curTs = null;
  for (const line of lines) {
    if (line.startsWith('\x01')) { curTs = parseInt(line.slice(1), 10); continue; }
    const f = line.trim();
    if (!f) continue;
    if (!isProseFile(f)) return { determined: true, epoch: curTs, reason: null };
  }
  // No commit in the whole history touched a non-prose file — the graph has nothing to be stale
  // against.
  return { determined: true, epoch: 0, reason: null };
}

export function graphJsonEpoch(path) {
  if (!existsSync(path)) return null;
  return Math.floor(statSync(path).mtimeMs / 1000);
}

function runUpdate(bin, root) {
  return spawnSync(bin.cmd, ['update', root, '--no-cluster'], {
    cwd: root, encoding: 'utf8', shell: bin.useShell, timeout: 180_000,
  });
}

export function main() {
  const bin = resolveGraphifyBin();
  if (!bin) {
    console.log('SKIPPED — graphify is not installed (looked for it on PATH; ' +
      'CHECK_GRAPHIFY_BIN can point at it explicitly).');
    console.log('  NOT VERIFIED here: whether graphify-out/graph.json matches the current code.');
    return 0;
  }

  const commit = latestNonProseCommitEpoch(ROOT);
  if (!commit.determined) {
    console.log(`FAIL: could not determine the latest code-touching commit (${commit.reason}) — ` +
      'failing closed rather than silently reporting fresh.');
    return 1;
  }

  const before = graphJsonEpoch(GRAPH_JSON);
  const staleReason = before === null
    ? 'graphify-out/graph.json does not exist'
    : before < commit.epoch
      ? `graph.json is older (${before}) than the latest code-touching commit (${commit.epoch})`
      : null;

  if (!staleReason) {
    console.log(`OK — graphify-out/graph.json (${before}) is at or after the latest code-touching ` +
      `commit (${commit.epoch}). Nothing to refresh.`);
    return 0;
  }

  console.log(`STALE — ${staleReason}.`);

  if (NO_HEAL) {
    console.log('  CHECK_GRAPHIFY_NO_HEAL=1 — not refreshing. fix: graphify update . --no-cluster');
    console.log('FAIL: the code graph does not match the current source.');
    return 1;
  }

  console.log('  refreshing: graphify update . --no-cluster ...');
  const upd = runUpdate(bin, ROOT);
  if (upd.status !== 0) {
    const why = (upd.stderr || upd.stdout || '').trim().split('\n').pop() || '(no output)';
    console.log(`  refresh failed: ${why}`);
    console.log('FAIL: the code graph does not match the current source, and the automatic refresh did not fix it.');
    return 1;
  }
  const line = (upd.stdout || '').trim().split('\n').pop();
  if (line) console.log(`  ${line}`);

  const after = graphJsonEpoch(GRAPH_JSON);
  if (after === null || after < commit.epoch) {
    console.log('FAIL: the refresh ran but graph.json is still behind the latest code-touching commit.');
    return 1;
  }
  console.log('OK — refreshed; graphify-out/graph.json now matches the current source.');
  return 0;
}

process.exit(main());
