#!/usr/bin/env node
// scripts/check-brief.mjs — audit fix #2 (COMPLIANCE-AUDIT-2026-08-01.md §2/§13).
// Every .superpowers/sdd/*-brief.md that landed after the task-brief template must carry all six
// field markers (א)..(ו) — audit finding: 0/6 briefs touched the template AT ALL on 2026-08-01.
// Also enforces §7's fix: a brief may not hand the operator a full-suite gate command
// (`npx playwright test` with no file path after it) — DoD-12 reserves that for the controller (H7).
// Env overrides (self-test fixtures): SDD_DIR=<path>, TEMPLATE=<path>, GITROOT=<path>.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const SDD_DIR = process.env.SDD_DIR || join(ROOT, '.superpowers', 'sdd');
const TEMPLATE = process.env.TEMPLATE || join(ROOT, 'docs', 'process', 'templates', 'task-brief.md');

const MARKERS = ['(א)', '(ב)', '(ג)', '(ד)', '(ה)', '(ו)'];

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
const files = readdirSync(SDD_DIR).filter(f => f.endsWith('-brief.md'));
let scanned = 0;
let checked = 0;
const errs = [];
for (const f of files) {
  scanned++;
  const abs = join(SDD_DIR, f);
  const fileDate = trackedOrMtime(abs);
  if (fileDate <= templateDate) continue; // predates the template requirement - not retroactively enforced
  checked++;
  const text = readFileSync(abs, 'utf8');
  const missing = MARKERS.filter(m => !text.includes(m));
  if (missing.length) errs.push(`${f}: does not touch the task-brief template — missing field marker(s): ${missing.join(', ')}`);
  // §7 fix: forbid handing the operator the full-suite gate.
  const fullSuiteRe = /npx playwright test(?!\S)/g;
  let m;
  while ((m = fullSuiteRe.exec(text))) {
    const after = text.slice(m.index, m.index + 80);
    if (!/\.spec\.ts|--grep/.test(after)) {
      errs.push(`${f}: hands the operator a bare "npx playwright test" (full-suite gate is the controller's, §11a/H7) — name the specific spec file(s) instead`);
      break;
    }
  }
}
console.log(`brief files scanned: ${scanned} · newer than template (${templateDate}): ${checked}`);
if (errs.length) {
  for (const e of errs) console.error('  x ' + e);
  console.error(`\nFAIL: ${errs.length} brief(s) invalid per §13 ("a missing field = an invalid brief").`);
  console.error(`  Start every brief from the template: cp "${relative(ROOT, TEMPLATE)}" .superpowers/sdd/<name>-brief.md`);
  process.exit(1);
}
console.log('OK - every brief since the template carries all six field markers and no bare full-suite command.');
