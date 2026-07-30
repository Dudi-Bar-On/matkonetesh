#!/usr/bin/env node
// scripts/check-graph-fresh.mjs — §10.12 enforcement (Phase 0, audit fix #2).
// Compares the mtime of every docs/**/*.md against the build stamp of graphify-out/graph.json.
// Prints the stale list and exits 1 if any doc is newer than the graph (or the graph is missing).
// HONEST LIMIT: mtime is a same-machine, same-session heuristic. A fresh clone / branch checkout
// refreshes mtimes and can FALSE-POSITIVE; it can never silently pass a doc edited after the build.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');
// GRAPH_REPORT.md is COPIED from graphify-out AFTER every build (sync-docs.sh step 2),
// so its mtime is legitimately newer than graph.json — excluded by design.
const EXCLUDE = new Set(['docs/analysis/graph/GRAPH_REPORT.md']);

function* mdFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* mdFiles(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

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
console.log(`graph stamp: ${new Date(stamp).toISOString()} · docs scanned: ${scanned}`);
if (stale.length) {
  stale.sort((a, b) => b.m - a.m);
  console.error(`FAIL: ${stale.length} document(s) newer than the graph:`);
  for (const s of stale) console.error(`  x ${new Date(s.m).toISOString().slice(0, 16)}  ${s.rel}`);
  console.error('  run:  /graphify docs --update --mode deep   (chunk by ~12k words, §10.12)');
  process.exit(1);
}
console.log('OK - graph is fresh (no doc newer than the build stamp).');
