#!/usr/bin/env node
// scripts/check-graph-fresh.mjs — §10.12 enforcement (Phase 0, audit fix #2).
//
// Two modes, auto-selected:
//
// LOCAL mode (default off-CI): compares the mtime of every docs/**/*.md against the mtime of
// graphify-out/graph.json (the real local graph). Fast, no git calls. HONEST LIMIT: mtime is a
// same-machine, same-session heuristic - a fresh clone/branch checkout refreshes mtimes and can
// FALSE-POSITIVE; it can never silently pass a doc edited after the build.
//
// CI mode (auto when process.env.CI is set, or GRAPH_FRESH_MODE=git-log): graphify-out/ is
// .gitignore'd (a 10MB local artifact, never present in a fresh Actions checkout - see .gitignore
// line 29/34), so mtime comparison against it is meaningless in CI: the file simply does not exist
// there. Instead this mode uses docs/analysis/graph/GRAPH_REPORT.md - the one graph artifact that
// IS versioned (copied out of graphify-out/ after every build, per sync-docs.sh step 2) - as a
// committed proxy for "when was the graph last rebuilt", and compares it against each doc's own
// last COMMIT date (git log, not filesystem mtime - robust regardless of checkout order).
//
// LAYERING (see also .githooks/pre-commit and .github/workflows/*.yml for the other two legs):
// pre-commit = fast local structural feedback, bypassable by design (META_SKIP_HOOK=1) · CI push
// job = the actual authority, cannot be bypassed · this check specifically also runs on a nightly
// CI schedule, because graph staleness is a property of ELAPsed time and doc drift, not of any one
// commit - a push job alone would miss a graph that goes stale from inaction between pushes.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');
const REPORT_PROXY = join(ROOT, 'docs', 'analysis', 'graph', 'GRAPH_REPORT.md');
// GRAPH_REPORT.md is COPIED from graphify-out AFTER every build (sync-docs.sh step 2),
// so its mtime/commit-date is legitimately newer than graph.json's build - excluded from the doc
// scan by design (it IS the stamp source in CI mode, not a "doc that must be covered by it").
const EXCLUDE = new Set(['docs/analysis/graph/GRAPH_REPORT.md']);

function* mdFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* mdFiles(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

const mode = process.env.GRAPH_FRESH_MODE === 'mtime' ? 'mtime'
  : (process.env.GRAPH_FRESH_MODE === 'git-log' || process.env.CI ? 'git-log' : 'mtime');

if (mode === 'git-log') {
  if (!existsSync(REPORT_PROXY)) {
    console.error(`FAIL: CI mode needs the versioned proxy ${relative(ROOT, REPORT_PROXY)}, not found.`);
    console.error('  graphify-out/graph.json is .gitignore\'d and never exists in a fresh CI checkout;');
    console.error('  GRAPH_REPORT.md is the committed stand-in. Run the graphify build locally and commit it.');
    process.exit(1);
  }
  let stampDate;
  try {
    stampDate = execFileSync('git', ['log', '-1', '--format=%cI', '--', relative(ROOT, REPORT_PROXY)],
      { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) { console.error(`FAIL: git log failed: ${e.message}`); process.exit(1); }
  if (!stampDate) { console.error('FAIL: GRAPH_REPORT.md is not git-tracked - no commit date to use as the stamp.'); process.exit(1); }

  let log;
  try {
    log = execFileSync('git', ['log', '--format=\x01%cI', '--name-only', '--', 'docs'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) { console.error(`FAIL: git log failed: ${e.message}`); process.exit(1); }
  const lastCommitDate = new Map(); // path -> newest commit date seen (log is newest-first)
  let curDate = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('\x01')) { curDate = line.slice(1); continue; }
    if (!line || !line.endsWith('.md')) continue;
    if (!lastCommitDate.has(line)) lastCommitDate.set(line, curDate);
  }

  let scanned = 0;
  const stale = [];
  const untracked = [];
  for (const f of mdFiles(join(ROOT, 'docs'))) {
    const rel = relative(ROOT, f).replaceAll('\\', '/');
    if (EXCLUDE.has(rel)) continue;
    scanned++;
    const d = lastCommitDate.get(rel);
    if (!d) { untracked.push(rel); continue; } // uncommitted/new file - mtime can't help in CI either; flagged separately
    if (d > stampDate) stale.push({ rel, d });
  }
  console.log(`[CI mode] graph proxy stamp (GRAPH_REPORT.md commit date): ${stampDate} · docs scanned: ${scanned}`);
  if (untracked.length) console.log(`  note: ${untracked.length} doc(s) have no commit history (new/untracked) - not evaluated by commit-date freshness: ${untracked.slice(0, 5).join(', ')}${untracked.length > 5 ? ', ...' : ''}`);
  if (stale.length) {
    stale.sort((a, b) => (b.d > a.d ? 1 : -1));
    console.error(`FAIL: ${stale.length} document(s) committed after the graph proxy was last committed:`);
    for (const s of stale) console.error(`  x ${s.d.slice(0, 16)}  ${s.rel}`);
    console.error('  run:  /graphify docs --update --mode deep   (chunk by ~12k words, §10.12), then commit GRAPH_REPORT.md');
    process.exit(1);
  }
  console.log('OK - graph proxy is fresh (no doc committed after GRAPH_REPORT.md).');
  process.exit(0);
}

// ---- LOCAL mode (default off-CI): mtime against the real local graph.json. ----
if (!existsSync(GRAPH)) {
  console.error('FAIL: graphify-out/graph.json is missing - no local graph at all.');
  console.error('  run the skill flow:  /graphify docs --update --mode deep   (always deep, §10.12)');
  process.exit(1);
}
const stamp = statSync(GRAPH).mtimeMs;
let scanned = 0;
const stale = [];
for (const f of mdFiles(join(ROOT, 'docs'))) {
  const rel = relative(ROOT, f).replaceAll('\\', '/');
  if (EXCLUDE.has(rel)) continue;
  scanned++;
  const m = statSync(f).mtimeMs;
  if (m > stamp) stale.push({ rel, m });
}
console.log(`[local mode] graph stamp: ${new Date(stamp).toISOString()} · docs scanned: ${scanned}`);
if (stale.length) {
  stale.sort((a, b) => b.m - a.m);
  console.error(`FAIL: ${stale.length} document(s) newer than the graph:`);
  for (const s of stale) console.error(`  x ${new Date(s.m).toISOString().slice(0, 16)}  ${s.rel}`);
  console.error('  run:  /graphify docs --update --mode deep   (chunk by ~12k words, §10.12)');
  process.exit(1);
}
console.log('OK - graph is fresh (no doc newer than the build stamp).');
