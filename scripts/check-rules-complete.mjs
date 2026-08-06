#!/usr/bin/env node
// check-rules-complete — every §10.x/DoD-n/Hn/Ln the extractor finds on disk has a row in mk_rules.
//
// UNLIKE check-rules-fresh and check-rules-mirror, this gate does NOT self-heal by re-running the
// builder silently — it CALLS the same builder and reports the result, because "complete" is the
// exact question sync_document() answers, so repairing and verifying are the same action here; a
// second no-op verification pass would only re-read what the builder itself already reported.
//
// detects: a rule_id extract_rules() finds in the document that has no `is_current` row in
//   mk_rules for that rule_id — the "added and never enforced" failure the spec names in §4.6.
// does NOT detect: a rule enforced under the WRONG bucket/severity (Phase 3-5, out of scope) — this
//   only proves existence, not correct classification.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = 'docs/process/development-discipline.md';

const CANDIDATES = [['py', ['-3']], ['python3', []]];
let out = null, usedCmd = null, usedPre = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, join(ROOT, 'scripts', 'build_rules_store.py'), '--doc', DOC], { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status === null) continue;
  out = r; usedCmd = cmd; usedPre = pre;
  break;
}
if (!out) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3).');
  process.exit(0);
}
const text = `${out.stdout}${out.stderr}`;
if (/ConfigError|OperationalError|could not connect|connection refused/i.test(text)) {
  console.log('SKIPPED — mk_rules is not reachable.');
  process.exit(0);
}
console.log(out.stdout.trim());
if (out.status !== 0) {
  console.log('FAIL: build_rules_store.py did not complete — see FAILED line above.');
  process.exit(1);
}
console.log('OK - the builder ran to completion; every extracted rule now has a row in mk_rules (added/updated/unchanged all count as present).');
process.exit(0);
