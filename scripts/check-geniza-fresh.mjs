#!/usr/bin/env node
// check-geniza-fresh — every document on disk is in the geniza at its current content hash.
//
// REPLACES check-memory-fresh, which asked the same question of the SQLite store that was deleted
// on 2026-08-05. Written BEFORE that deletion, because removing a gate without replacing it is how
// a corpus silently goes stale — and this project has the receipts: graphify's freshness gate
// failed 8 of 8 runs, was marked advisory, and 115 documents went stale behind it.
//
// The geniza is PostgreSQL, and Node has no driver here, so the query runs in Python. The
// interpreter is searched for the same way check-pytest searches (L54: `python` on Windows may be
// the Store alias stub, which prints "Python was not found" and exits non-zero — an ABSENCE, not
// a failure).
//
// SKIPS LOUDLY when the stack is not running. A developer without Docker up is not a developer
// with a stale corpus, and blocking them would only teach the skip hatch.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PY = `
import hashlib, json, sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(ROOT)})
from src.knowledge import config

scope = json.loads((Path(${JSON.stringify(ROOT)}) / "docs/process/memory-ingest-scope.json").read_text(encoding="utf-8"))
root = Path(${JSON.stringify(ROOT)})
on_disk = {}
for r in scope.get("roots", []):
    base = root / str(r["path"])
    for pattern in r.get("patterns", []):
        for p in sorted(base.glob(pattern)):
            if not p.is_file():
                continue
            rel = p.relative_to(root).as_posix()
            text = p.read_text(encoding="utf-8", errors="replace").replace("\\x00", "")
            on_disk[rel] = hashlib.sha256(text.encode("utf-8")).hexdigest()

conn = config.connect_reader(timeout=5)
try:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT d.source_path, dr.content_hash FROM documents d "
            "JOIN document_revisions dr ON dr.document_id = d.id AND dr.is_current "
            "WHERE d.namespace = 'repo'"
        )
        stored = dict(cur.fetchall())
finally:
    conn.close()

missing = sorted(set(on_disk) - set(stored))
stale = sorted(p for p in set(on_disk) & set(stored) if on_disk[p] != stored[p])
orphaned = sorted(set(stored) - set(on_disk))
print(json.dumps({"disk": len(on_disk), "stored": len(stored),
                  "missing": missing, "stale": stale, "orphaned": orphaned}))
`;

const CANDIDATES = [['python', []], ['py', ['-3']], ['python3', []]];
const STORE_STUB = /Python was not found;|Microsoft Store/i;

let out = null;
const tried = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (r.error || r.status === null) { tried.push(`${cmd}: ${r.error?.code ?? 'no exit status'}`); continue; }
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (STORE_STUB.test(text)) { tried.push(`${cmd}: Windows Store alias stub, not an interpreter`); continue; }
  out = { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  break;
}

if (!out) {
  console.log('SKIPPED — no Python interpreter could be run.');
  for (const t of tried) console.log(`  tried ${t}`);
  console.log('  NOT VERIFIED here: whether the geniza matches the disk.');
  process.exit(0);
}

if (out.status !== 0) {
  const why = out.stderr.trim().split('\n').pop() ?? '';
  if (/ConfigError|OperationalError|could not connect|connection refused/i.test(out.stderr)) {
    console.log('SKIPPED — the geniza is not reachable (start it: docker compose up -d in infra/).');
    console.log(`  ${why.slice(0, 140)}`);
    console.log('  NOT VERIFIED here: whether the geniza matches the disk.');
    process.exit(0);
  }
  console.log(`FAIL: the freshness check could not run — ${why.slice(0, 200)}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(out.stdout.trim().split('\n').pop());
} catch {
  console.log('FAIL: the freshness check returned output this gate could not parse.');
  console.log(out.stdout.slice(0, 300));
  process.exit(1);
}

console.log(
  `docs on disk: ${data.disk} · in the geniza: ${data.stored} · ` +
  `stale: ${data.stale.length} · missing: ${data.missing.length} · orphaned: ${data.orphaned.length}`
);

const problems = [...data.missing.map((p) => ['missing', p]), ...data.stale.map((p) => ['stale', p])];
if (problems.length) {
  console.log(`FAIL: ${problems.length} document(s) the geniza does not hold at their current content:`);
  for (const [kind, p] of problems.slice(0, 12)) console.log(`  x ${kind.padEnd(8)} ${p}`);
  if (problems.length > 12) console.log(`  ... and ${problems.length - 12} more`);
  console.log('  fix:  python scripts/ingest.py --scope     (unchanged documents are skipped by hash)');
  process.exit(1);
}
if (data.orphaned.length) {
  console.log(`  note: ${data.orphaned.length} document(s) in the geniza are no longer on disk — history, not an error.`);
}
console.log('OK - every in-scope document is in the geniza at its current content hash.');
