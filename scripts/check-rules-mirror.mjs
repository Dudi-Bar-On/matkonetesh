#!/usr/bin/env node
// check-rules-mirror — rules.sqlite's checksum matches mk_rules's current rows.
//
// detects: rules.sqlite silently diverging from mk_rules — the exact failure mode
//   current_requires_mirror is meant to make structurally impossible for a SINGLE row, but this
//   gate additionally covers the aggregate case (e.g. rules.sqlite edited or replaced by hand, or a
//   stale committed copy from before a document change was synced).
// does NOT detect: a divergence in columns the checksum does not cover (statement text, title_he) —
//   the checksum is over (rule_id, source_hash) pairs only, matching the same tradeoff
//   check-geniza-fresh's content-hash comparison makes: cheap and exactly as strict as
//   current_requires_mirror's own guarantee, no stricter.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR_PATH = join(ROOT, 'rules.sqlite');

const PY = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pathlib import Path
from src.rules_store import config, mirror

mirror_path = Path(${JSON.stringify(MIRROR_PATH)})
if not mirror_path.exists():
    print(json.dumps({"mirror_exists": False}))
else:
    m = mirror.open_mirror(mirror_path)
    mirror_checksum = mirror.checksum(m)

    conn = config.connect_reader(timeout=5)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT rule_id, source_hash FROM rule_revisions WHERE is_current ORDER BY rule_id")
            rows = cur.fetchall()
    finally:
        conn.close()
    import hashlib
    body = "\\n".join(f"{rid}:{h}" for rid, h in rows)
    pg_checksum = hashlib.sha256(body.encode("utf-8")).hexdigest()
    print(json.dumps({"mirror_exists": True, "mirror_checksum": mirror_checksum, "pg_checksum": pg_checksum, "pg_rows": len(rows)}))
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
    process.exit(0);
  }
  console.log(`FAIL: the mirror check could not run — ${out.stderr.trim().split('\n').pop().slice(0, 200)}`);
  process.exit(1);
}

const data = JSON.parse(out.stdout.trim().split('\n').pop());
if (!data.mirror_exists) {
  console.log(`FAIL: ${MIRROR_PATH} does not exist. repairing ...`);
} else if (data.mirror_checksum === data.pg_checksum) {
  console.log(`OK - rules.sqlite matches mk_rules (${data.pg_rows} current rule(s), checksum ${data.pg_checksum.slice(0, 12)}...).`);
  process.exit(0);
} else {
  console.log(`FAIL: rules.sqlite checksum (${data.mirror_checksum.slice(0, 12)}...) != mk_rules (${data.pg_checksum.slice(0, 12)}...). repairing ...`);
}

const repair = spawnSync(usedCmd, [...usedPre, join(ROOT, 'scripts', 'build_rules_store.py'), '--rebuild-mirror-only'], { cwd: ROOT, encoding: 'utf8' });
console.log(`  ${(repair.stdout ?? '').trim().split('\n').pop() || (repair.stderr ?? '').trim().split('\n').pop()}`);
if (repair.status !== 0) {
  console.log('FAIL: the mirror could not be rebuilt.');
  process.exit(1);
}
console.log('OK - mirror rebuilt from mk_rules and now matches.');
process.exit(0);
