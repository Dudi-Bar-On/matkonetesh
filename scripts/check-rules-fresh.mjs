#!/usr/bin/env node
// check-rules-fresh — every rule-shaped section on disk matches its source_hash in mk_rules.
//
// SAME SHAPE as check-geniza-fresh.mjs, deliberately: self-healing (re-runs the builder), blocking,
// SKIPS LOUDLY when mk_rules is unreachable (a developer without the native PostgreSQL service
// running is not a developer with a stale rules store — blocking them here would only teach the
// skip hatch), and prints exactly what it scanned.
//
// detects: a rule-shaped section (§N heading, DoD-N item, Hn ruling, Ln lesson) in
//   docs/process/development-discipline.md whose content_hash differs from the source_hash of the
//   matching CURRENT row in mk_rules — i.e. the document moved and the store did not.
// does NOT detect: a rule stated only in prose with none of the four id shapes (see
//   src/rules_store/extractor.py's own header for the exact list); a rule in a document other than
//   development-discipline.md (out of scope for Phase 1 — the spec's extractor targets this one file).
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = 'docs/process/development-discipline.md';

const PY = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pathlib import Path
from src.rules_store import config, extractor

text = (Path(${JSON.stringify(ROOT)}) / ${JSON.stringify(DOC)}).read_text(encoding="utf-8")
on_disk = {r.rule_id: r.content_hash for r in extractor.extract_rules(text, ${JSON.stringify(DOC)})}

conn = config.connect_reader(timeout=5)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT rule_id, source_hash FROM rule_revisions WHERE is_current AND source_path = %s", (${JSON.stringify(DOC)},))
        stored = dict(cur.fetchall())
finally:
    conn.close()

stale = sorted(rid for rid in set(on_disk) & set(stored) if on_disk[rid] != stored[rid])
missing = sorted(set(on_disk) - set(stored))
print(json.dumps({"disk": len(on_disk), "stored": len(stored), "stale": stale, "missing": missing}))
`;

// L59: `python` on PATH may be the Microsoft Store alias — never tried here.
const CANDIDATES = [['py', ['-3']], ['python3', []]];

let out = null;
let usedCmd = null;
let usedPre = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY], { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status === null) continue;
  out = { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  usedCmd = cmd; usedPre = pre;
  break;
}

if (!out) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3).');
  console.log('  NOT VERIFIED here: whether mk_rules matches the document.');
  process.exit(0);
}

if (out.status !== 0) {
  // Fix round 1, CRITICAL 1: psycopg2 raises the SAME exception class, OperationalError, for
  // "the server is not there" AND "the server is there but your credentials/role/database are
  // wrong" — the class name cannot distinguish them, so matching on the class name (as this used
  // to) turns a real, fixable misconfiguration (a wrong password) into a silent SKIP/exit 0. Only
  // messages that specifically mean "nothing is listening" may SKIP; everything else — a bad
  // password, a missing role, a missing database — is a configuration error and must FAIL loudly.
  // ConfigError (raised by src.rules_store.config.load_config) is the one legitimate case that is
  // NOT a misconfiguration in this sense: it means mk_rules has never been set up here at all
  // (infra/rules-db/.env absent), which is the same "not present" shape as the service being down.
  const ABSENT = /ConfigError|could not connect to server|Connection refused|Is the server running|timeout expired|No route to host|Network is unreachable|could not translate host name/i;
  if (ABSENT.test(out.stderr)) {
    console.log('SKIPPED — mk_rules is not reachable (start the native PostgreSQL 18.4 service, port 5432).');
    console.log(`  ${out.stderr.trim().split('\n').pop()}`);
    console.log('  NOT VERIFIED here: whether mk_rules matches the document.');
    process.exit(0);
  }
  console.log(`FAIL: the freshness check could not run — ${out.stderr.trim().split('\n').pop()}`);
  process.exit(1);
}

const data = JSON.parse(out.stdout.trim().split('\n').pop());
console.log(`rules on disk: ${data.disk} · current in mk_rules: ${data.stored} · stale: ${data.stale.length} · missing: ${data.missing.length}`);

const problems = [...data.stale, ...data.missing];
if (problems.length) {
  console.log(`${problems.length} rule(s) out of sync:`);
  for (const rid of problems.slice(0, 12)) console.log(`  ~ ${rid}`);
  if (problems.length > 12) console.log(`  ... and ${problems.length - 12} more`);
  console.log('  repairing ...');
  const repair = spawnSync(usedCmd, [...usedPre, join(ROOT, 'scripts', 'build_rules_store.py'), '--doc', DOC], { cwd: ROOT, encoding: 'utf8' });
  console.log(`  ${(repair.stdout ?? '').trim().split('\n').pop() || (repair.stderr ?? '').trim().split('\n').pop()}`);
  if (repair.status !== 0) {
    console.log('FAIL: the repair did not succeed. mk_rules does not match the document.');
    process.exit(1);
  }
  console.log('OK - drift detected and repaired; mk_rules now matches the document.');
  process.exit(0);
}
console.log('OK - every extracted rule matches its content_hash in mk_rules.');
