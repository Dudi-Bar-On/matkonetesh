#!/usr/bin/env node
// scripts/check-brief.mjs — audit fix #2 (COMPLIANCE-AUDIT-2026-08-01.md §2/§13).
// Every .superpowers/sdd/*-brief.md that landed after the task-brief template must carry all six
// field markers (א)..(ו) — audit finding: 0/6 briefs touched the template AT ALL on 2026-08-01.
// Also enforces §7's fix: a brief may not hand the operator a full-suite gate command
// (`npx playwright test` with no file path after it) — DoD-12 reserves that for the controller (H7).
// "Landed after the template" prefers git commit history when tracked; GROUND TRUTH IN THIS REPO:
// .superpowers/sdd/.gitignore excludes the whole directory ("*"), so briefs are untracked and this
// ALWAYS falls back to mtime vs the template's own commit date - same documented limit as
// check-graph-fresh.mjs's local mode.
//
// GRANDFATHER BASELINE (gate-scoping-report.md, 2026-08-01 follow-up). Live rediscovery: a debt-
// paydown commit was blocked by the 22 briefs that predate this checker's own rollout — none of them
// touch this commit, yet the gate held the WHOLE commit hostage, forcing META_SKIP_HOOK=1. The
// template-date cutoff above already exempts briefs that predate the template's own existence; this
// adds a second, EXPLICIT exemption for briefs that postdate the template but predate the checker
// itself: docs/process/gate-baselines.json's "brief" array (tracked in git, so it survives clones and
// is visible in review, unlike the untracked .superpowers/sdd files it lists). A filename on that list
// is reported as STANDING DEBT (with its age) but never blocks. A filename NOT on that list is judged
// normally — if it's noncompliant, it blocks, because it is new since the baseline was frozen. The
// list is a frozen snapshot, never auto-grown by this script — see the JSON file's own "_note".
// Env overrides (self-test fixtures): SDD_DIR=<path>, TEMPLATE=<path>, GITROOT=<path>,
// GATE_BASELINES=<path>.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const SDD_DIR = process.env.SDD_DIR || join(ROOT, '.superpowers', 'sdd');
const TEMPLATE = process.env.TEMPLATE || join(ROOT, 'docs', 'process', 'templates', 'task-brief.md');
const BASELINE_FILE = process.env.GATE_BASELINES || join(ROOT, 'docs', 'process', 'gate-baselines.json');

const MARKERS = ['(א)', '(ב)', '(ג)', '(ד)', '(ה)', '(ו)'];

function loadBaseline(key) {
  if (!existsSync(BASELINE_FILE)) return new Set();
  try {
    const json = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    return new Set(Array.isArray(json[key]) ? json[key] : []);
  } catch { return new Set(); } // malformed baseline file -> fail safe to "nothing grandfathered"
}

function trackedOrMtime(absPath) {
  try {
    const rel = relative(GITROOT, absPath).replaceAll('\\', '/');
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { cwd: GITROOT, encoding: 'utf8' }).trim();
    if (out) return out;
  } catch { /* untracked or not a git repo - fall through */ }
  return new Date(statSync(absPath).mtimeMs).toISOString();
}

if (!existsSync(TEMPLATE)) {
  console.error(`FAIL: brief template not found: ${TEMPLATE}`);
  process.exit(1);
}
if (!existsSync(SDD_DIR)) {
  console.log('OK - .superpowers/sdd not present, nothing to scan.');
  process.exit(0);
}
const templateDate = trackedOrMtime(TEMPLATE);
const briefBaseline = loadBaseline('brief');
const files = readdirSync(SDD_DIR).filter(f => f.endsWith('-brief.md'));
let scanned = 0;
let checked = 0;
const errs = [];
const standing = [];
for (const f of files) {
  scanned++;
  const abs = join(SDD_DIR, f);
  const fileDate = trackedOrMtime(abs);
  if (fileDate <= templateDate) continue; // predates the template requirement - not retroactively enforced
  checked++;
  const text = readFileSync(abs, 'utf8');
  const violations = [];
  const missing = MARKERS.filter(m => !text.includes(m));
  if (missing.length) violations.push(`does not touch the task-brief template — missing field marker(s): ${missing.join(', ')}`);
  // §7 fix: forbid handing the operator the full-suite gate.
  const fullSuiteRe = /npx playwright test(?!\S)/g;
  let m;
  while ((m = fullSuiteRe.exec(text))) {
    const after = text.slice(m.index, m.index + 80);
    if (!/\.spec\.ts|--grep/.test(after)) {
      violations.push('hands the operator a bare "npx playwright test" (full-suite gate is the controller\'s, §11a/H7) — name the specific spec file(s) instead');
      break;
    }
  }
  if (!violations.length) continue;
  if (briefBaseline.has(f)) {
    const ageDays = Math.max(0, Math.round((Date.now() - new Date(fileDate).getTime()) / 86400000));
    standing.push(`${f} (age ~${ageDays}d, grandfathered): ${violations.join('; ')}`);
  } else {
    errs.push(`${f}: ${violations.join('; ')}`);
  }
}
console.log(`brief files scanned: ${scanned} · newer than template (${templateDate}): ${checked} · grandfathered baseline: ${briefBaseline.size}`);
if (standing.length) {
  console.log(`\nSTANDING DEBT (pre-existing per docs/process/gate-baselines.json, reported not blocking - ${standing.length}):`);
  for (const s of standing) console.log('  ~ ' + s);
}
if (errs.length) {
  for (const e of errs) console.error('  x ' + e);
  console.error(`\nFAIL: ${errs.length} brief(s) invalid per §13 ("a missing field = an invalid brief") and NOT on the grandfather baseline — this is new debt.`);
  console.error(`  Start every brief from the template: cp "${relative(ROOT, TEMPLATE)}" .superpowers/sdd/<name>-brief.md`);
  process.exit(1);
}
console.log(`OK - no new (non-grandfathered) brief violations (${standing.length} standing-debt brief(s) reported above, not blocking).`);
