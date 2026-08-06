#!/usr/bin/env node
// check-rules-complete — every §10.x/DoD-n/Hn/Ln the extractor finds on disk has a row in mk_rules.
//
// Fix round 1, 2026-08-06 — review finding, CRITICAL: the first version of this gate called
// `build_rules_store.py --doc <path>` directly, which is `sync_document()` — and sync_document does
// not just CHECK, it WRITES. Any rule_id on disk but missing from mk_rules is inserted and reported
// as `added` before this script ever looked at the exit code, so the one condition this gate exists
// to catch ("a rule was added to the document and never reached the store") was repaired by the act
// of checking and reported inside an exit-0 OK — an unreachable FAIL branch. Worse: sync_document
// also RETIRES — any rule_id current in mk_rules for this source_path but no longer found on disk is
// marked retired and deleted from the mirror. A "verification" gate mutating the source of truth off
// a transient disk state (an editor autosave mid-edit, a bad merge, a half-applied patch) is
// destructive, not protective.
//
// This version is READ-ONLY, restoring the invariant config.py documents about itself: "connect_reader()
// has no write verb, so the three gates cannot write even by accident." It calls extract_rules()
// directly (same call the builder itself uses, so the malformed-document FAIL case is unchanged) and
// compares the resulting rule_id set against `SELECT rule_id FROM rule_revisions WHERE is_current AND
// source_path = %s` via connect_reader() — no INSERT, no UPDATE, no call into build_rules_store.py at
// all. It cannot repair anything by design (the brief says so explicitly) and now it cannot mutate
// anything either.
//
// detects: a rule_id extract_rules() finds in the document that has no `is_current` row in
//   mk_rules for that rule_id, by name — the "added and never enforced" failure the spec names in
//   §4.6 — WITHOUT writing that row into existence as a side effect of checking.
// does NOT detect: a rule enforced under the WRONG bucket/severity (Phase 3-5, out of scope) — this
//   only proves existence, not correct classification. Also does NOT detect STALE content for a
//   rule_id that already has a current row (check-rules-fresh's job, not this one — a row that
//   exists but disagrees with the document reads as complete here). A rule_id present in mk_rules
//   but absent from the document (the mirror-image case) is REPORTED, not failed: this gate's job is
//   "is every on-disk rule enforced", not "should this stored rule be retired" — that retirement
//   decision belongs to build_rules_store.py's own sync_document, run deliberately by a human or
//   check-rules-fresh's self-heal path against the CURRENT document, never inferred here from a
//   possibly-transient disk state.
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
on_disk = sorted(r.rule_id for r in extractor.extract_rules(text, ${JSON.stringify(DOC)}))

conn = config.connect_reader(timeout=5)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT rule_id FROM rule_revisions WHERE is_current AND source_path = %s", (${JSON.stringify(DOC)},))
        stored = sorted(row[0] for row in cur.fetchall())
finally:
    conn.close()

missing = sorted(set(on_disk) - set(stored))
extra = sorted(set(stored) - set(on_disk))
print(json.dumps({"disk": len(on_disk), "stored": len(stored), "missing": missing, "extra": extra}))
`;

// L59: `python` on PATH may be the Microsoft Store alias — never tried here.
const CANDIDATES = [['py', ['-3']], ['python3', []]];

let out = null, usedCmd = null, usedPre = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY], { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status === null) continue;
  out = { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  usedCmd = cmd; usedPre = pre;
  break;
}

if (!out) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3).');
  console.log('  NOT VERIFIED here: whether every on-disk rule has a row in mk_rules.');
  process.exit(0);
}

if (out.status !== 0) {
  // Same classifier as check-rules-fresh.mjs / check-rules-mirror.mjs, copied deliberately, not
  // reinvented: psycopg2 raises the SAME exception class, OperationalError, for "the server is not
  // there" AND for "the server is there but your credentials/role/database are wrong" — the class
  // name cannot distinguish them, so matching on it (as this file's own first version did) turns a
  // real, fixable misconfiguration (a wrong password) into a silent SKIP/exit 0. Only messages that
  // specifically mean "nothing is listening" may SKIP; everything else — a bad password, a missing
  // role, a missing database — is a configuration error and must FAIL loudly. ConfigError (raised by
  // src.rules_store.config.load_config) is the one legitimate case that is NOT a misconfiguration in
  // this sense: it means mk_rules has never been set up here at all, the same "not present" shape as
  // the service being down.
  const ABSENT = /ConfigError|could not connect to server|Connection refused|Is the server running|timeout expired|No route to host|Network is unreachable|could not translate host name/i;
  if (ABSENT.test(out.stderr)) {
    console.log('SKIPPED — mk_rules is not reachable (start the native PostgreSQL 18.4 service, port 5432).');
    console.log(`  ${out.stderr.trim().split('\n').pop()}`);
    console.log('  NOT VERIFIED here: whether every on-disk rule has a row in mk_rules.');
    process.exit(0);
  }
  console.log(`FAIL: the completeness check could not run — ${out.stderr.trim().split('\n').pop()}`);
  process.exit(1);
}

const data = JSON.parse(out.stdout.trim().split('\n').pop());
console.log(`rules on disk: ${data.disk} · current in mk_rules for this document: ${data.stored} · missing: ${data.missing.length} · extra (in store, not on disk): ${data.extra.length}`);

if (data.extra.length) {
  console.log(`${data.extra.length} rule(s) current in mk_rules but no longer found on disk (not failing — this may be a retirement check-rules-fresh's self-heal or a deliberate sync should perform, not something this read-only gate infers from a possibly-transient disk state):`);
  for (const rid of data.extra.slice(0, 12)) console.log(`  ~ ${rid}`);
  if (data.extra.length > 12) console.log(`  ... and ${data.extra.length - 12} more`);
}

if (data.missing.length) {
  console.log(`FAIL: ${data.missing.length} rule(s) on disk have no current row in mk_rules:`);
  for (const rid of data.missing.slice(0, 12)) console.log(`  ~ ${rid}`);
  if (data.missing.length > 12) console.log(`  ... and ${data.missing.length - 12} more`);
  console.log('  This gate does not self-heal (see header) — run: py -3 scripts/build_rules_store.py --doc ' + DOC);
  process.exit(1);
}

console.log('OK - every rule-shaped section on disk has a current row in mk_rules.');
process.exit(0);
