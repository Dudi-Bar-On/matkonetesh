#!/usr/bin/env node
// check-rules-mirror — rules.sqlite's checksum matches mk_rules's current rows.
//
// detects: rules.sqlite silently diverging from mk_rules — the exact failure mode
//   current_requires_mirror is meant to make structurally impossible for a SINGLE row, but this
//   gate additionally covers the aggregate case (e.g. rules.sqlite edited or replaced by hand, or a
//   stale committed copy from before a document change was synced). Fix round 1, 2026-08-06 —
//   review finding, Critical: the digest now covers (rule_id, source_hash, statement, severity,
//   bucket, rule_group [added 2026-08-07, R-103]) — the fields the enforcement hooks actually read
//   from the mirror — via the ONE shared
//   function `mirror.checksum_of_rows()` (src/rules_store/mirror.py) that both this script's
//   Postgres-side query and mirror.checksum()'s SQLite-side query call, so the two sides cannot
//   desync by a format-string edit landing on only one of them. A corrupt/unreadable mirror file
//   (wrong file format, or a schema too old/different to hold these columns) is now repair-eligible
//   too: it is deleted and rebuilt exactly like a missing file, rather than hard-failing.
// does NOT detect: a divergence in a column the digest does not cover (title_he, mechanism,
//   source_path, source_heading) — matching the same tradeoff check-geniza-fresh's content-hash
//   comparison makes: cheap and exactly as strict as current_requires_mirror's own guarantee for
//   the columns it covers, no stricter.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR_PATH = join(ROOT, 'rules.sqlite');

const PY = `
import sqlite3, sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pathlib import Path
from src.rules_store import config, mirror

mirror_path = Path(${JSON.stringify(MIRROR_PATH)})
if not mirror_path.exists():
    print(json.dumps({"mirror_exists": False}))
else:
    # Fix round 1, review finding 3: a corrupt or schema-mismatched mirror file (garbage bytes,
    # or a table missing the columns the digest now reads) must be repair-eligible, not a hard
    # FAIL — sqlite3.Error is the base class for both "file is not a database" (DatabaseError) and
    # "no such column" (OperationalError), so catching it here is what makes both cases flow into
    # the same delete-and-rebuild path as a missing file, instead of crashing this script.
    try:
        m = mirror.open_mirror(mirror_path)
        mirror_checksum = mirror.checksum(m)
        mirror_readable = True
    except sqlite3.Error as exc:
        mirror_readable = False
        mirror_checksum = None
        mirror_error = f"{type(exc).__name__}: {exc}"

    if not mirror_readable:
        print(json.dumps({"mirror_exists": True, "mirror_readable": False, "mirror_error": mirror_error}))
    else:
        conn = config.connect_reader(timeout=5)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT rule_id, source_hash, statement, severity, bucket, rule_group "
                    "FROM rule_revisions WHERE is_current ORDER BY rule_id"
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        pg_checksum = mirror.checksum_of_rows(rows)
        print(json.dumps({
            "mirror_exists": True, "mirror_readable": True,
            "mirror_checksum": mirror_checksum, "pg_checksum": pg_checksum, "pg_rows": len(rows),
        }))
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
  console.log('  NOT VERIFIED here: whether rules.sqlite matches mk_rules.');
  // Fix round 1 (Task 17 review): a machine-readable RESULT= line, additive only — human-facing
  // text above is free to be reworded without breaking a consumer (watchman.ps1) that matches on
  // this line instead of on prose. Exit code and existing output are unchanged.
  console.log('RESULT=skipped');
  process.exit(0);
}

if (out.status !== 0) {
  // Same lesson as Task 12 (check-rules-fresh.mjs): psycopg2 raises the SAME exception class,
  // OperationalError, for "the server is not there" AND "the server is there but your
  // credentials/role/database are wrong" — matching on the class name would turn a real,
  // fixable misconfiguration (a wrong password) into a silent SKIP/exit 0. Only messages that
  // specifically mean "nothing is listening" (or mk_rules was never configured at all —
  // ConfigError) may SKIP; everything else is a configuration error and must FAIL loudly.
  const ABSENT = /ConfigError|could not connect to server|Connection refused|Is the server running|timeout expired|No route to host|Network is unreachable|could not translate host name/i;
  if (ABSENT.test(out.stderr)) {
    console.log('SKIPPED — mk_rules is not reachable; cannot compare against the mirror.');
    console.log(`  ${out.stderr.trim().split('\n').pop()}`);
    console.log('  NOT VERIFIED here: whether rules.sqlite matches mk_rules.');
    console.log('RESULT=skipped');
    process.exit(0);
  }
  console.log(`FAIL: the mirror check could not run — ${out.stderr.trim().split('\n').pop().slice(0, 200)}`);
  console.log('RESULT=fail');
  process.exit(1);
}

const data = JSON.parse(out.stdout.trim().split('\n').pop());
if (!data.mirror_exists) {
  console.log(`FAIL: ${MIRROR_PATH} does not exist. repairing ...`);
} else if (!data.mirror_readable) {
  // Fix round 1, review finding 3: a corrupt/unreadable mirror is repair-eligible, same as a
  // missing one — but --rebuild-mirror-only calls mirror.open_mirror() itself, which would hit the
  // exact same sqlite3.Error trying to CREATE TABLE IF NOT EXISTS against unreadable bytes. Delete
  // the file first so the builder opens a clean slate, not the same garbage.
  console.log(`FAIL: ${MIRROR_PATH} is not a readable SQLite mirror (${data.mirror_error}). repairing ...`);
  try {
    unlinkSync(MIRROR_PATH);
  } catch (e) {
    console.log(`FAIL: could not remove the corrupt mirror file — ${e.message}`);
    console.log('RESULT=fail');
    process.exit(1);
  }
} else if (data.mirror_checksum === data.pg_checksum) {
  console.log(`OK - rules.sqlite matches mk_rules (${data.pg_rows} current rule(s), checksum ${data.pg_checksum.slice(0, 12)}...).`);
  console.log('RESULT=already-ok');
  process.exit(0);
} else {
  console.log(`FAIL: rules.sqlite checksum (${data.mirror_checksum.slice(0, 12)}...) != mk_rules (${data.pg_checksum.slice(0, 12)}...). repairing ...`);
}

const repair = spawnSync(usedCmd, [...usedPre, join(ROOT, 'scripts', 'build_rules_store.py'), '--rebuild-mirror-only'], { cwd: ROOT, encoding: 'utf8' });
console.log(`  ${(repair.stdout ?? '').trim().split('\n').pop() || (repair.stderr ?? '').trim().split('\n').pop()}`);
if (repair.status !== 0) {
  console.log('FAIL: the mirror could not be rebuilt.');
  console.log('RESULT=fail');
  process.exit(1);
}

// Fix round 2 (Task 17 review): "the rebuild command exited 0" is not "the mirror now matches" —
// it was previously asserted, not verified, and once Verify (watchman.ps1) started trusting
// RESULT=repaired as equivalent to an independently-confirmed RESULT=already-ok, an unverified
// claim became load-bearing. Re-run the SAME comparison (not a new one) and require the checksums
// to actually match before printing "repaired". A rebuild that "succeeds" but leaves the mirror
// still wrong must FAIL loudly, never claim success — that is worse than erroring, because it
// looks like a fix.
const recheck = spawnSync(usedCmd, [...usedPre, '-c', PY], { cwd: ROOT, encoding: 'utf8' });
if (recheck.error || recheck.status !== 0) {
  console.log(`FAIL: rebuild ran, but the post-rebuild comparison could not run — ${(recheck.stderr ?? '').trim().split('\n').pop().slice(0, 200)}`);
  console.log('RESULT=fail');
  process.exit(1);
}
let recheckData;
try {
  recheckData = JSON.parse(recheck.stdout.trim().split('\n').pop());
} catch (e) {
  console.log(`FAIL: rebuild ran, but the post-rebuild comparison output could not be parsed — ${e.message}`);
  console.log('RESULT=fail');
  process.exit(1);
}
if (!recheckData.mirror_exists || !recheckData.mirror_readable) {
  console.log(`FAIL: rebuild ran, but ${MIRROR_PATH} is still missing or unreadable afterward.`);
  console.log('RESULT=fail');
  process.exit(1);
}
if (recheckData.mirror_checksum !== recheckData.pg_checksum) {
  console.log(`FAIL: rebuild ran (exit 0) but rules.sqlite still does not match mk_rules afterward (checksum ${recheckData.mirror_checksum.slice(0, 12)}... != ${recheckData.pg_checksum.slice(0, 12)}...). The rebuild did not actually repair the mirror.`);
  console.log('RESULT=fail');
  process.exit(1);
}
console.log(`OK - mirror rebuilt from mk_rules and now matches (${recheckData.pg_rows} current rule(s), checksum ${recheckData.pg_checksum.slice(0, 12)}..., re-verified post-rebuild).`);
console.log('RESULT=repaired');
process.exit(0);
