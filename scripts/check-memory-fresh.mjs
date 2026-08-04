#!/usr/bin/env node
// check-memory-fresh — is the agent-memory store current with the docs on disk?
//
// Replaces check-graph-fresh.mjs (owner decision, 2026-08-04). That gate compared MTIMES
// against a 22 MB JSON graph rebuilt by an out-of-process LLM pass. It reported 115 stale
// documents and had never been green; its owning workflow, graph-freshness.yml, failed 8 of
// its 8 runs. Reviewers 9 and 10 both flagged it — a permanently amber signal is an off signal.
//
// This gate is different in the two ways that decide whether a gate can ever pass:
//
//   1. It compares CONTENT HASHES, not mtimes. A checkout, a format-on-save, or a rewrite of
//      identical bytes moves mtime and means nothing. SHA-256 of the file content does not.
//   2. The fix is cheap. `python scripts/memsync.py` re-ingests only what changed, in
//      milliseconds. A gate whose remedy costs an LLM pass will be skipped; this one will not.
//
// It reads the same SQLite file the Python store writes, through node:sqlite (Node 24
// built-in, zero dependencies) — so the gate has no Python dependency at all and stays fast.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB = join(ROOT, 'agent-memory.db');
// Scope is shared with scripts/memsync.py through ONE file. It was duplicated until 2026-08-04,
// and the copies drifted the moment the corpus was added: memsync ingested 1,233 nodes that this
// gate then reported as orphans, because it was still walking **/*.md alone.
const SCOPE = JSON.parse(readFileSync(join(ROOT, 'docs', 'process', 'memory-ingest-scope.json'), 'utf8'));
const TOP_LEVEL = SCOPE.top_level_files;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const extsOf = (patterns) => patterns.map((p) => p.replace('**/*', ''));

if (!existsSync(DB)) {
    console.log('FAIL: agent-memory.db is missing. Build it with: python scripts/memsync.py');
  process.exit(1);
}

const db = new DatabaseSync(DB, { readOnly: true });

// One row per file is enough — every chunk of a file carries the same file_hash.
const stored = new Map();
for (const r of db.prepare(
  "SELECT file_path, file_hash FROM agent_memory WHERE type='md_doc' AND file_path NOT LIKE 'graph://%' GROUP BY file_path"
).all()) {
  stored.set(r.file_path, r.file_hash);
}

const files = [
  ...new Set([
    ...SCOPE.roots.flatMap((r) => walk(join(ROOT, r.path), extsOf(r.patterns))),
    ...TOP_LEVEL.map((n) => join(ROOT, n)).filter(existsSync),
  ]),
];

const stale = [];
const missing = [];
for (const abs of files) {
  const rel = relative(ROOT, abs).split('\\').join('/');
  const disk = sha256(readFileSync(abs));
  const have = stored.get(rel);
  if (have === undefined) missing.push(rel);
  else if (have !== disk) stale.push(rel);
}

// A file removed from disk but still in the store is a different kind of drift, and a silently
// retained document is exactly the failure this whole arc was about.
const orphaned = [...stored.keys()].filter(
  (rel) => !files.some((abs) => relative(ROOT, abs).split('\\').join('/') === rel)
);

console.log(
  `docs on disk: ${files.length} · in store: ${stored.size} · stale: ${stale.length} · missing: ${missing.length} · orphaned: ${orphaned.length}`
);

const show = (label, list) => {
  if (!list.length) return;
  console.log(`  ${label}:`);
  for (const f of list.slice(0, 15)) console.log(`    x ${f}`);
  if (list.length > 15) console.log(`    ... and ${list.length - 15} more`);
};

show('content changed since ingest', stale);
show('never ingested', missing);
show('in store but gone from disk', orphaned);

const bad = stale.length + missing.length + orphaned.length;
if (bad) {
  console.log('  fix:  python scripts/memsync.py       (delta by content hash — only what changed)');
  process.exit(1);
}
console.log('OK - every document on disk is in the store at its current content hash.');
db.close();
