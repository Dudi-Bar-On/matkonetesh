// scripts/tests/test-watchman-engine.mjs
// RED/GREEN proof for Invoke-ComponentCheck's retry/recovery loop — no real infrastructure touched.
// `-SelfTest` registers five deterministic fake components:
//   always-ok        : Detect always true -> InitialOk=true, Recovered=false, FinalOk=true
//   down-then-recovers: Detect false once, then true; Recover flips a flag; Verify true after Recover
//   down-forever     : Detect always false; Recover runs; Verify always false -> FinalOk=false
//   bad-return-type  : Detect/Verify return a non-[bool] (a string) -> rejected as NOT OK, never
//                       coerced -- fix round 2's boolean-return contract (see watchman.ps1 .NOTES)
//   recover-throws-but-verifies-ok: Recover throws but Verify still succeeds -> Recovered/FinalOk
//                       stay true (honest), but Detail must still carry the Recover error -- fix
//                       round 3: a broken Recover must never look like a clean success
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
// instead of 5, no assertion ever said "expected 3"). Fix round 3: the expected count must not be
// a hand-maintained literal either (same defect, one level out — the plan itself shipped a
// hardcoded "3" while running 5 checks). Derive it from watchman.ps1's own summary line
// ("WATCHMAN OK/BLOCK ... N component(s) checked ..."), which is computed from $results.Count in
// the script, not typed by hand here — adding a self-test fixture can never silently desync this
// assertion from reality again, because there is nothing here left to forget to update.
const countMatch = (r.stdout || '').match(/(\d+) component\(s\) checked/);
check('watchman.ps1 stdout reports a component-checked count', countMatch !== null);
const EXPECTED_COMPONENT_COUNT = countMatch ? Number(countMatch[1]) : NaN;
check(`parsed exactly ${EXPECTED_COMPONENT_COUNT} JSON component row(s) (got ${rows.length}) — count derived from watchman's own summary line, not hardcoded`,
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

// Fix round 3: Recovered/FinalOk stay honest (Verify really did say OK) but a Recover that threw
// must not vanish from the record just because it happened not to block recovery this time.
check('recover-throws-but-verifies-ok: Recovered true, FinalOk true (Verify really did say OK)',
  byName['recover-throws-but-verifies-ok']?.Recovered === true && byName['recover-throws-but-verifies-ok']?.FinalOk === true);
check('recover-throws-but-verifies-ok: Detail still carries the Recover error on the happy path',
  typeof byName['recover-throws-but-verifies-ok']?.Detail === 'string'
    && byName['recover-throws-but-verifies-ok'].Detail.includes('Recover threw: boom in recover'));

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
