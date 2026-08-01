#!/usr/bin/env node
// scripts/check-h9.mjs — audit fix #1 (COMPLIANCE-AUDIT-2026-08-01.md §1/H9).
// Every .superpowers/sdd/*-report.md that landed after the newest release(v commit must carry all
// five H9 header strings (מה היה · מה נעשה · מה נשאר · איפה אנחנו · הבא בתור). Audit finding: 0/16
// today carried even one. "Landed after" is resolved via git history when the file is tracked
// (robust across clones). GROUND TRUTH IN THIS REPO: .superpowers/sdd/.gitignore excludes the whole
// directory ("*"), so every report file is untracked and this ALWAYS falls back to mtime vs the
// newest release(v commit's date - same documented same-machine/same-session limit as
// check-graph-fresh.mjs's local mode. If .superpowers/sdd is ever made tracked, the git-history path
// activates with no code change.
// Env overrides (self-test fixtures): SDD_DIR=<path>, GITROOT=<path>.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const SDD_DIR = process.env.SDD_DIR || join(ROOT, '.superpowers', 'sdd');

const HEADERS = ['מה היה', 'מה נעשה', 'מה נשאר', 'איפה אנחנו', 'הבא בתור'];

function latestReleaseDate() {
  // NOTE: argv array (execFileSync), never a shell string - "release(v" contains an
  // unbalanced "(" that a shell (execSync) chokes on ("Unmatched ( or \(").
  try {
    const log = execFileSync('git', ['log', '--format=%H%x09%cI%x09%s', '-n', '500'], { cwd: GITROOT, encoding: 'utf8' });
    const dates = log.split('\n').filter(Boolean)
      .map(l => l.split('\t'))
      .filter(([, , subject]) => /^release\(v\d+\)/.test(subject))
      .map(([, date]) => date)
      .sort();
    return dates.at(-1) ?? null;
  } catch { return null; }
}

function trackedCommitDate(absPath) {
  try {
    const rel = relative(GITROOT, absPath).replaceAll('\\', '/');
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { cwd: GITROOT, encoding: 'utf8' }).trim();
    return out || null;
  } catch { return null; }
}

if (!existsSync(SDD_DIR)) {
  console.log('OK - .superpowers/sdd not present, nothing to scan.');
  process.exit(0);
}
const cutoff = latestReleaseDate();
const files = readdirSync(SDD_DIR).filter(f => f.endsWith('-report.md'));
let scanned = 0;
let checked = 0;
const errs = [];
for (const f of files) {
  scanned++;
  const abs = join(SDD_DIR, f);
  const committedAt = trackedCommitDate(abs);
  const landedAt = committedAt ?? new Date(statSync(abs).mtimeMs).toISOString();
  const isNewer = cutoff ? landedAt > cutoff : true; // no release yet in the window -> check everything
  if (!isNewer) continue;
  checked++;
  const text = readFileSync(abs, 'utf8');
  const missing = HEADERS.filter(h => !text.includes(h));
  if (missing.length) errs.push(`${f}: missing H9 header(s): ${missing.join(', ')}`);
}
console.log(`report files scanned: ${scanned} · newer than last release (${cutoff ?? 'n/a'}): ${checked}`);
if (errs.length) {
  for (const e of errs) console.error('  x ' + e);
  console.error(`\nFAIL: ${errs.length} report(s) missing the H9 5-row table (§10.6/H9).`);
  console.error('  Add the fixed 5-row table: מה היה · מה נעשה · מה נשאר · איפה אנחנו · הבא בתור.');
  process.exit(1);
}
console.log('OK - every report landed since the last release carries all 5 H9 headers.');
