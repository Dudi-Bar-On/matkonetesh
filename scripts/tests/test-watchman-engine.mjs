// scripts/tests/test-watchman-engine.mjs
// RED/GREEN proof for Invoke-ComponentCheck's retry/recovery loop — no real infrastructure touched.
// `-SelfTest` registers four deterministic fake components:
//   always-ok        : Detect always true -> InitialOk=true, Recovered=false, FinalOk=true
//   down-then-recovers: Detect false once, then true; Recover flips a flag; Verify true after Recover
//   down-forever     : Detect always false; Recover runs; Verify always false -> FinalOk=false
//   bad-return-type  : Detect/Verify return a non-[bool] (a string) -> rejected as NOT OK, never
//                       coerced -- fix round 2's boolean-return contract (see watchman.ps1 .NOTES)
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'watchman.ps1');

const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-SelfTest'], {
  encoding: 'utf8', cwd: ROOT,
});

let failures = 0;
let total = 0;
function check(label, cond) {
  total++;
  if (!cond) { failures++; console.error(`FAIL  ${label}`); } else { console.log(`PASS  ${label}`); }
}

check('exits non-zero because down-forever is a BLOCK-severity component', r.status !== 0);

const lines = (r.stdout || '').trim().split('\n').filter((l) => l.trim().startsWith('{'));
const rows = lines.map((l) => JSON.parse(l));
const byName = Object.fromEntries(rows.map((row) => [row.Name, row]));

// L66: a filter that only accepts well-shaped lines can silently shrink a count instead of
// failing loudly — that is exactly how the pipeline-pollution bug went unnoticed (3 rows parsed
// instead of 5, no assertion ever said "expected 3"). Pin the parsed count to the number of
// components self-test registers, so an unparseable/missing/malformed row fails this check
// directly instead of only failing indirectly via a later per-name lookup.
const EXPECTED_COMPONENT_COUNT = 4;
check(`parsed exactly ${EXPECTED_COMPONENT_COUNT} JSON component row(s) (got ${rows.length})`,
  rows.length === EXPECTED_COMPONENT_COUNT);

check('always-ok: InitialOk true, Recovered false, FinalOk true',
  byName['always-ok']?.InitialOk === true && byName['always-ok']?.Recovered === false && byName['always-ok']?.FinalOk === true);
check('down-then-recovers: InitialOk false, Recovered true, FinalOk true',
  byName['down-then-recovers']?.InitialOk === false && byName['down-then-recovers']?.Recovered === true && byName['down-then-recovers']?.FinalOk === true);
check('down-forever: InitialOk false, FinalOk false, Severity block',
  byName['down-forever']?.InitialOk === false && byName['down-forever']?.FinalOk === false && byName['down-forever']?.Severity === 'block');
check('down-then-recovers reports a "recovered:" line with elapsed seconds',
  /recovered: down-then-recovers after \d/.test(r.stdout));

// Fix round 2: a Detect/Verify that returns a non-boolean (here, the string "false" -- truthy
// under a naive [bool] cast) must be rejected outright, never coerced into an answer.
check('bad-return-type: InitialOk false (string "false" is NOT coerced to true), FinalOk false',
  byName['bad-return-type']?.InitialOk === false && byName['bad-return-type']?.FinalOk === false);
check('bad-return-type: Detail names the offending type/value and which scriptblock produced it',
  typeof byName['bad-return-type']?.Detail === 'string'
    && byName['bad-return-type'].Detail.includes("Detect returned [String] 'false', expected a boolean")
    && byName['bad-return-type'].Detail.includes("Verify returned [String] 'still not a bool', expected a boolean"));

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
