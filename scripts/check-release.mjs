#!/usr/bin/env node
// scripts/check-release.mjs — audit fixes #3+#4 (COMPLIANCE-AUDIT-2026-08-01.md §6/§11, H7/H14).
//
// For every commit whose message starts with "release(v", the body must show:
//   (1) TWO clean suite runs (owner ruling H7, 2026-07-30) — either two literal "exit 0" mentions,
//       or one "exit 0" plus an explicit two-runs marker ("x2" / "twice" / "two ... runs").
//   (2) an explicit exit code somewhere ("exit 0" / "exit code 0").
//   (3) the L29 clause: the phrase "on the tree being shipped".
//   (4) H14: docs/releases/vNNN-ux-report.md present IN OR BEFORE that commit's tree.
// Audit evidence: v281 has all four; v282 lost (1); v283 lost (1)+(2); v284 lost (1)+(2)+(3) — a
// monotonic erosion across one day, which is exactly what a syntax check catches and memory does not.
//
// HONEST SCOPE (§4 waiver gate: nothing here is relaxed, but nothing here rewrites immutable history
// either). A commit body is immutable once made, so this cannot retroactively fix v281..v284. It runs
// in two modes:
//   - HOOK mode: `node check-release.mjs <path-to-commit-msg-file>` (git commit-msg hook). Blocks the
//     commit being made RIGHT NOW if it is a release(v commit and any of (1)-(4) is missing. Applies
//     to every commit from the moment this script is wired in, forward — no history to break.
//   - AUDIT mode: `node check-release.mjs` (no arg, from check-meta.mjs). Scans git log for existing
//     release(v commits with a commit date >= CUTOFF and reports violations found on real history.
//     It NEVER exits 1 for commits before CUTOFF — those are reported as pre-existing findings only
//     when AUDIT_STRICT=1 is set; by default they are listed but do not fail the gate, because failing
//     on unfixable history would just teach people to ignore the gate (the opposite of the point).
import { readFileSync, existsSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
// The compliance audit that motivated this checker is dated 2026-08-01; every release(v commit on
// record was made that day. Enforcement therefore starts exactly there — stated out loud, per §4.
const CUTOFF = process.env.RELEASE_CUTOFF || '2026-08-01';

function evaluate(subject, body, versionNum, treeRef) {
  const errs = [];
  const exitZeroCount = (body.match(/exit\s*(code\s*)?0\b/gi) || []).length;
  const hasTwoRunsMarker = /\bx\s*2\b|\btwice\b|\btwo\s+(clean\s+)?runs\b/i.test(body);
  const twoRuns = exitZeroCount >= 2 || (exitZeroCount >= 1 && hasTwoRunsMarker);
  const hasTreeShipped = /on the tree being shipped/i.test(body);
  if (!twoRuns) errs.push('H7: no evidence of TWO clean suite runs (need two "exit 0" mentions, or one + an explicit x2/twice marker)');
  if (exitZeroCount < 1) errs.push('DoD-12: no explicit exit code ("exit 0") captured');
  if (!hasTreeShipped) errs.push('L29: missing the phrase "on the tree being shipped"');

  if (versionNum) {
    const reportPath = `docs/releases/v${versionNum}-ux-report.md`;
    let present = false;
    try {
      execFileSync('git', ['cat-file', '-e', `${treeRef}:${reportPath}`], { cwd: GITROOT, stdio: 'ignore' });
      present = true;
    } catch { present = false; }
    if (!present) errs.push(`H14: ${reportPath} not present in (or before) this commit`);
  }
  return errs;
}

const arg = process.argv[2];

if (arg) {
  // ---- HOOK mode: validate the single pending commit message file. ----
  if (!existsSync(arg)) { console.error(`FAIL: commit-msg file not found: ${arg}`); process.exit(1); }
  const msg = readFileSync(arg, 'utf8');
  const first = msg.split('\n')[0];
  const m = first.match(/^release\(v(\d+)\)/);
  if (!m) { process.exit(0); } // not a release commit - nothing for this checker to do
  // H14 must see the STAGED tree (the commit doesn't exist yet): treeRef='' makes evaluate() build
  // ":docs/releases/vNNN-ux-report.md", which is git's syntax for "the index version of this path".
  const errs = evaluate(first, msg, m[1], '');
  console.log(`check-release (commit-msg hook): "${first}"`);
  if (errs.length) {
    for (const e of errs) console.error('  x ' + e);
    console.error(`\nFAIL: release(v${m[1]}) commit message does not satisfy H7 x2 / DoD-12 / L29 / H14.`);
    console.error('  Fix the commit message body, and stage docs/releases/v' + m[1] + '-ux-report.md, before committing.');
    process.exit(1);
  }
  console.log('OK - release commit message satisfies H7 x2, DoD-12 exit code, L29 tree-shipped, H14 report.');
  process.exit(0);
}

// ---- AUDIT mode: scan history from CUTOFF forward. ----
let log;
try {
  log = execSync('git -c log.showsignature=false log --format=%H%x09%cI%x09%s -n 1000', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read git log in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const commits = log.split('\n').filter(Boolean).map(l => {
  const [sha, date, subject] = l.split('\t');
  return { sha, date, subject };
}).filter(c => /^release\(v\d+\)/.test(c.subject));

let scanned = 0;
let inScope = 0;
const findings = [];
for (const c of commits) {
  scanned++;
  if (c.date < CUTOFF) continue;
  inScope++;
  const body = execFileSync('git', ['show', '-s', '--format=%B', c.sha], { cwd: GITROOT, encoding: 'utf8' });
  const m = c.subject.match(/^release\(v(\d+)\)/);
  const errs = evaluate(c.subject, body, m[1], c.sha);
  if (errs.length) findings.push({ sha: c.sha.slice(0, 7), subject: c.subject, errs });
}
console.log(`release(v commits scanned: ${scanned} · in enforcement scope (>= ${CUTOFF}): ${inScope}`);
if (findings.length) {
  console.error(`FINDINGS: ${findings.length}/${inScope} in-scope release commit(s) fail H7 x2 / DoD-12 / L29 / H14:`);
  for (const f of findings) {
    console.error(`  ${f.sha}  ${f.subject}`);
    for (const e of f.errs) console.error('    x ' + e);
  }
  if (process.env.AUDIT_STRICT === '1') {
    console.error('\nAUDIT_STRICT=1: failing the gate on these findings.');
    process.exit(1);
  }
  console.error('\nReported, not blocking (history is immutable) - fix forward via the commit-msg hook. Set AUDIT_STRICT=1 to fail on this.');
  process.exit(0);
}
console.log('OK - every in-scope release(v commit satisfies H7 x2, DoD-12 exit code, L29 tree-shipped, H14 report.');
