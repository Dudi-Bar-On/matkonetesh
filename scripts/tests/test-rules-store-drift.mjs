#!/usr/bin/env node
// scripts/tests/test-rules-store-drift.mjs — Task 5 (§9 proof #3, "the one I care about most"):
// does check-rules-fresh.mjs — the gate actually wired into check-meta.mjs and CI, run on every
// commit — notice when mk_rules (the real Postgres "store", not just its rules.sqlite mirror)
// disagrees with docs/process/development-discipline.md?
//
// This is the single failure that makes the whole rules layer theatre: rules being enforced that
// are NOT the rules as written. Unlike test-session-rules-drift.mjs (which perturbs the local
// mirror file), this test perturbs mk_rules itself — the actual source of truth the gate reads —
// via connect_writer(), then restores it. It does NOT touch development-discipline.md or CLAUDE.md
// (the task brief forbids editing the rules to test the rules); it corrupts the STORE's copy of one
// row, which is exactly the "document moved and the store did not" scenario the gate exists for,
// just produced from the opposite direction (store moved, out from under the document).
//
// SKIP discipline: mk_rules is a native-Windows-service dependency. An absent/unreachable service
// must SKIP with a stated reason, never silently pass and never hard-fail — same rule check-rules-
// fresh.mjs itself follows (see its own header), copied here rather than reinvented.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK_RULES_FRESH = join(ROOT, 'scripts', 'check-rules-fresh.mjs');
const DOC = 'docs/process/development-discipline.md';
const PY_CANDIDATES = [['py', ['-3']], ['python3', []]];

function runPy(code) {
  for (const [cmd, pre] of PY_CANDIDATES) {
    const r = spawnSync(cmd, [...pre, '-c', code], { cwd: ROOT, encoding: 'utf8' });
    if (r.error || r.status === null) continue;
    return { cmd, pre, ...r };
  }
  return null;
}

let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`PASS  ${label}`);
}

function runCheckRulesFresh() {
  return spawnSync(process.execPath, [CHECK_RULES_FRESH], { cwd: ROOT, encoding: 'utf8' });
}

// --- Reachability probe. SKIP loudly, never silently pass, never hard-fail on an absent service.
const probe = runPy(`
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from src.rules_store import config
conn = config.connect_reader(timeout=5)
with conn.cursor() as cur:
    cur.execute("SELECT rule_id, source_hash FROM rule_revisions WHERE is_current AND source_path = %s ORDER BY rule_id LIMIT 1", (${JSON.stringify(DOC)},))
    row = cur.fetchone()
conn.close()
print(json.dumps({"rule_id": row[0], "source_hash": row[1]} if row else None))
`);

const ABSENT = /ConfigError|could not connect to server|Connection refused|Is the server running|timeout expired|No route to host|Network is unreachable|could not translate host name/i;
if (!probe) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3). mk_rules drift NOT tested this run.');
  process.exit(0);
}
if (probe.status !== 0) {
  if (ABSENT.test(probe.stderr || '')) {
    console.log('SKIPPED — mk_rules is not reachable (start the native PostgreSQL 18.4 service, port 5432). mk_rules drift NOT tested this run.');
    console.log(`  ${(probe.stderr || '').trim().split('\n').pop()}`);
    process.exit(0);
  }
  console.error(`FAIL  reachability probe errored unexpectedly (not classified as "absent"): ${(probe.stderr || '').trim().split('\n').pop()}`);
  process.exit(1);
}
const target = JSON.parse(probe.stdout.trim().split('\n').pop());
if (!target) {
  console.log(`SKIPPED — mk_rules has no current row for ${DOC}; nothing to corrupt.`);
  process.exit(0);
}
const { cmd, pre } = probe;
const targetId = target.rule_id;
const originalHash = target.source_hash;
console.log(`target: rule_id=${targetId} (original source_hash=${originalHash.slice(0, 12)}...)`);

function setHash(hash) {
  const r = spawnSync(cmd, [...pre, '-c', `
import sys
sys.path.insert(0, ${JSON.stringify(ROOT)})
from src.rules_store import config
conn = config.connect_writer(timeout=5)
conn.autocommit = False
try:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE rule_revisions SET source_hash = %s WHERE is_current AND source_path = %s AND rule_id = %s",
            (${JSON.stringify(hash)}, ${JSON.stringify(DOC)}, ${JSON.stringify(targetId)}),
        )
        n = cur.rowcount
    conn.commit()
finally:
    conn.close()
print(n)
`], { cwd: ROOT, encoding: 'utf8' });
  return r;
}

let restored = false;
function restoreHash() {
  if (restored) return true;
  const r = setHash(originalHash);
  restored = r.status === 0 && r.stdout.trim() === '1';
  return restored;
}

try {
  // --- Baseline (RED proof for the assertion below): mk_rules and the document already agree
  // before we touch anything — check-rules-fresh.mjs must say so, and must NOT already be naming
  // targetId as stale (if it did, the "GREEN" assertion below would prove nothing).
  const baseline = runCheckRulesFresh();
  check('baseline: check-rules-fresh.mjs exits 0 (mk_rules already matches the document)', baseline.status === 0, `exit=${baseline.status}, stdout tail: ${baseline.stdout.split('\n').slice(-3).join(' | ')}`);
  check(`baseline: check-rules-fresh.mjs does NOT already name ${targetId} as out of sync`, !baseline.stdout.includes(`~ ${targetId}`));

  // --- Corrupt mk_rules directly (the STORE, not the mirror, not the document).
  const corrupt = setHash('0000000000000000000000000000000000000000000000000000000000deadbeef');
  check('corrupted mk_rules: UPDATE affected exactly 1 row', corrupt.status === 0 && corrupt.stdout.trim() === '1', `stdout=${corrupt.stdout} stderr=${corrupt.stderr}`);

  // --- GREEN: check-rules-fresh.mjs (the gate actually wired into check-meta.mjs / CI / every
  // commit) must NOTICE the drift and name the specific rule, before self-healing it.
  const afterCorrupt = runCheckRulesFresh();
  const namedIt = afterCorrupt.stdout.includes(`~ ${targetId}`);
  const sawOutOfSync = /\d+ rule\(s\) out of sync/.test(afterCorrupt.stdout);
  check(`check-rules-fresh.mjs detects the corrupted rule (${targetId}) as out of sync and names it`, namedIt && sawOutOfSync, `stdout: ${afterCorrupt.stdout.split('\n').filter(l => /out of sync|stale|repair|~ /.test(l)).join(' | ')}`);
  // check-rules-fresh.mjs SELF-HEALS: having detected and reported the drift, it then repairs
  // mk_rules from the real document in the same run — so the correct final exit is 0, and the
  // repair itself IS the recovery-actually-recovers proof for the real (non-mirror) store, on top
  // of watchman's -SelfTest fixtures (test-watchman-engine.mjs) which cover the recovery contract
  // in isolation.
  check('check-rules-fresh.mjs self-heals in the same run (repair reported, exit 0)', afterCorrupt.status === 0 && /repaired|OK/.test(afterCorrupt.stdout), `exit=${afterCorrupt.status}`);

  // --- Verify the repair genuinely restored the ORIGINAL hash in mk_rules (not just "exited 0").
  const verify = runPy(`
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from src.rules_store import config
conn = config.connect_reader(timeout=5)
with conn.cursor() as cur:
    cur.execute("SELECT source_hash FROM rule_revisions WHERE is_current AND source_path = %s AND rule_id = %s", (${JSON.stringify(DOC)}, ${JSON.stringify(targetId)}))
    row = cur.fetchone()
conn.close()
print(json.dumps(row[0] if row else None))
`);
  const restoredHash = verify && verify.status === 0 ? JSON.parse(verify.stdout.trim().split('\n').pop()) : null;
  restored = restoredHash === originalHash;
  check(`self-heal genuinely restored mk_rules to the ORIGINAL source_hash for ${targetId} (verified by direct re-query, not assumed from exit code)`, restored, `restoredHash=${restoredHash ? restoredHash.slice(0, 12) : restoredHash} originalHash=${originalHash.slice(0, 12)}...`);

  const final = runCheckRulesFresh();
  check('final run: check-rules-fresh.mjs is clean again (0 stale, 0 missing)', final.status === 0 && !final.stdout.includes(`~ ${targetId}`));
} finally {
  if (!restored) {
    console.error(`  restoring mk_rules rule_id=${targetId} to its original hash (belt-and-braces, self-heal path did not confirm it) ...`);
    restoreHash();
  }
}

console.log(`\ntest-rules-store-drift: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
