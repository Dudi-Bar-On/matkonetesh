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
// SKIPS LOUDLY when the stack is not running. A developer whose native PostgreSQL service is down
// is not a developer with a stale corpus, and blocking them would only teach the skip hatch.

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
from src.knowledge.scope import resolve_scope

# Same resolver ingest.py uses (src/knowledge/scope.py) — a second independent walk here is
# exactly how the scope definition drifted into three disagreeing copies before (see the scope
# file's own _why). Without this, an excluded file (e.g. docs/audit/**) would still show up as
# "on disk" here, read as "missing" from the geniza, and get repaired back in via the self-heal
# below — reintroducing the excluded file on the very next commit.
root = Path(${JSON.stringify(ROOT)})
scope_file = root / "docs/process/memory-ingest-scope.json"
on_disk = {}
for rel in resolve_scope(scope_file, root):
    text = (root / rel).read_text(encoding="utf-8", errors="replace").replace("\\x00", "")
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

# Ingestion gives a document chunks, EMBEDDINGS (on the GPU) and the deterministic graph spine.
# It does NOT run the extraction model. Reported here so the hole is VISIBLE: the revision reads
# as graph_projected, which is TRUE, and the missing relationships would otherwise be invisible.
# Not blocking and not repaired inline -- extraction is ~11s a chunk, which does not belong in a
# commit hook.
# (No backticks in this block: it lives inside a JS template literal, and one would close it.)
conn2 = config.connect_reader(timeout=5)
try:
    with conn2.cursor() as cur:
        cur.execute("SELECT count(*) FROM revisions_pending_extraction WHERE namespace = 'repo'")
        pending = cur.fetchone()[0]
finally:
    conn2.close()

print(json.dumps({"disk": len(on_disk), "stored": len(stored),
                  "missing": missing, "stale": stale, "orphaned": orphaned,
                  "pending_extraction": pending}))
`;

// Test seam (Arc 4, Task 4): CHECK_GENIZA_PY substitutes a stub interpreter, so a test can drive
// every verdict branch (fresh / stale / cannot-connect) without a database. shell: true is
// required for the substitute — Windows cannot exec a .cmd stub without a shell in the loop
// (same finding as check-ci.mjs's CHECK_CI_GIT/CHECK_CI_GH seam, Task 3) — and is otherwise a
// no-op for the real `python`/`py`/`python3` lookup.
const PYTHON_STUB = process.env.CHECK_GENIZA_PY;
const CANDIDATES = PYTHON_STUB ? [[PYTHON_STUB, []]] : [['python', []], ['py', ['-3']], ['python3', []]];
const STORE_STUB = /Python was not found;|Microsoft Store/i;

let out = null;
let usedCmd = null;
let usedPre = [];
const tried = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, shell: !!PYTHON_STUB,
  });
  if (r.error || r.status === null) { tried.push(`${cmd}: ${r.error?.code ?? 'no exit status'}`); continue; }
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (STORE_STUB.test(text)) { tried.push(`${cmd}: Windows Store alias stub, not an interpreter`); continue; }
  out = { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  usedCmd = cmd; usedPre = pre;
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
    console.log('SKIPPED — the geniza is not reachable (start it: Start-Service postgresql-x64-18).');
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

// The chunks and their embeddings are repaired automatically above. The EXTRACTED RELATIONSHIPS
// are not, because the model costs ~11s a chunk and a commit hook is the wrong place for that.
// So the gap is reported instead of hidden — which is the whole point, since a revision missing
// its relationships still reads as `graph_projected` and looks complete.
function reportPendingExtraction(data, justRepaired = 0) {
  const n = (data.pending_extraction ?? 0) + justRepaired;
  if (!n) return;
  console.log(`  ${n} revision(s) have chunks and embeddings but have NEVER been through the`);
  console.log('  extraction model — their relationships are missing, not empty.');
  console.log('  run:  python scripts/extract_graph.py --pending');
}

const problems = [...data.missing.map((p) => ['missing', p]), ...data.stale.map((p) => ['stale', p])];
if (problems.length) {
  console.log(`${problems.length} document(s) the geniza does not hold at their current content:`);
  for (const [kind, p] of problems.slice(0, 12)) console.log(`  ~ ${kind.padEnd(8)} ${p}`);
  if (problems.length > 12) console.log(`  ... and ${problems.length - 12} more`);

  // SELF-HEALING, and the asymmetry is what makes it safe: DETECTING drift costs 0.6s, and
  // INGESTING the whole scope costs 24s — but ingesting only the drifted files costs seconds.
  // So the gate repairs exactly what it found rather than telling a human to run a command that
  // re-checks 845 files it already checked.
  //
  // It still FAILS if the repair does not work. A gate that fixes silently and passes regardless
  // is not a gate; the guarantee is "the geniza matches the disk when this exits 0", and that has
  // to remain true whether the repair succeeded or not.
  //
  // Disable with GENIZA_NO_HEAL=1 — for a run that must observe drift without changing anything.
  if (process.env.GENIZA_NO_HEAL === '1') {
    console.log('  GENIZA_NO_HEAL=1 — not repairing. fix: python scripts/ingest.py --scope');
    process.exit(1);
  }

  const paths = problems.map(([, p]) => p);
  console.log(`  repairing ${paths.length} document(s) ...`);
  const repair = spawnSync(usedCmd, [...usedPre, join(ROOT, 'scripts', 'ingest.py'), ...paths], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, shell: !!PYTHON_STUB,
  });
  const stdoutLines = (repair.stdout ?? '').trim().split('\n').filter(Boolean);
  const stderrLines = (repair.stderr ?? '').trim().split('\n').filter(Boolean);
  const line = stdoutLines.pop() || stderrLines.pop() || 'no output';
  console.log(`  ${line}`);

  if (repair.status !== 0) {
    console.log('FAIL: the repair did not succeed. The geniza does not match the disk.');
    process.exit(1);
  }
  reportPendingExtraction(data, paths.length);
  console.log('OK - drift detected and repaired; the geniza now matches the disk.');
  process.exit(0);
}
if (data.orphaned.length) {
  console.log(`  note: ${data.orphaned.length} document(s) in the geniza are no longer on disk — history, not an error.`);
}
reportPendingExtraction(data);
console.log('OK - every in-scope document is in the geniza at its current content hash.');
