#!/usr/bin/env node
// check-python-invocation — L59. `python` on Windows is frequently the Store app-execution alias.
//
// SEVERITY: BLOCKING. The failure names the wrong component: the suite died with "Process from config
// .webServer was not able to start. Exit code: 9009" and never mentioned Python. L54 fixed the CALLER
// and not the CLASS — this gate is the class. Alternative, always available: `py -3`.
//
// SCOPE, and why it is narrow (2026-08-09 rewrite): the first version matched the token `python` ANYWHERE
// in a watched file — it fired on JSON prose describing the rule, on `console.log`/`Write-Host` help
// strings, and on test fixtures whose whole point is to contain the literal text under test. The rule is
// about a command that will be EXECUTED, not about the word appearing in a file. This scan is restricted
// to the three places a command actually lives:
//   - `**/playwright.config*.ts` — inside a `webServer` block's `command:` string.
//   - `.github/workflows/*.yml` — inside `run:` steps, EXCEPT in a job whose `runs-on:` is a Linux
//     runner, where `python` is the correct name and `py -3` does not exist.
//   - `package.json` — inside the `"scripts"` object's values.
// A gate that fires on the word rather than the command teaches people to ignore it, and this one BLOCKS.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L59'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];

function isPlaywrightConfig(rel) {
  const b = basename(rel);
  return /^playwright\.config.*\.ts$/.test(b);
}
function isWorkflowYaml(rel) {
  const p = rel.split(sep).join('/');
  return /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(p);
}
function isPackageJson(rel) {
  return rel.split(sep).join('/') === 'package.json' || /(^|\/)package\.json$/.test(rel.split(sep).join('/'));
}

// Scan git-tracked files, with a filesystem-walk fallback so `--root <tmp_path>` tests still work. An
// untracked scratch file is not this gate's business. The walk is shallow-triggered off the three
// path shapes above rather than a generic directory recursion, since only those shapes are in scope.
function listTracked() {
  const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' });
  const tracked = out.split('\0').filter(Boolean);
  if (tracked.length === 0) throw new Error('no tracked files (not a git repo, or nothing committed)');
  return tracked;
}
function walkAll(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walkAll(p, out);
    else out.push(relative(ROOT, p));
  }
  return out;
}

let relFiles;
try {
  relFiles = listTracked();
} catch {
  relFiles = walkAll(ROOT);
}

const targets = relFiles.filter((rel) => isPlaywrightConfig(rel) || isWorkflowYaml(rel) || isPackageJson(rel));

if (targets.length === 0) {
  console.log('check-python-invocation: scanned 0 files — no verdict reached, not a pass. Not blocking.');
  process.exit(0);
}

// A bare `python` starting a command — not `py -3`, not `python3`, and not the word appearing in prose
// or an identifier. Applied only to the extracted command text of the three scoped positions.
const BARE = /(^|[`'"\s;&|(])python(\s+[-\w./\\]+\.py|\s+-m\s)/;

const findings = [];

function scanPlaywrightConfig(rel, absPath) {
  let lines;
  try { lines = readFileSync(absPath, 'utf8').split('\n'); } catch { return; }
  lines.forEach((line, n) => {
    // `command:` may sit inline inside a `webServer: { command: '...' }` literal or on its own line
    // inside a multi-line `webServer: { ... }` block — either way, only a line naming `command:`
    // itself is in scope; a comment or an unrelated field is not.
    if (!/command\s*:/.test(line)) return;
    if (BARE.test(line)) findings.push([rel.split(sep).join('/'), n + 1, line.trim()]);
  });
}

function isLinuxRunner(value) {
  const v = value.trim().toLowerCase();
  return v.includes('ubuntu') || v.includes('linux');
}

// Job-block tracking: job headers sit at 2-space indent directly under `jobs:`; `runs-on:` sits
// deeper inside the job. A DECISION, stated per the brief's own fallback option: full per-job
// tracking was chosen over "skip the whole file if every runs-on is Linux" because this repo's own
// workflows are a good but not permanent proof that every job will stay Linux-only, and per-job
// tracking is barely more code than the file-level shortcut once the job-header regex exists.
function scanWorkflow(rel, absPath) {
  let lines;
  try { lines = readFileSync(absPath, 'utf8').split('\n'); } catch { return; }
  let jobIsLinux = false; // unknown/unset defaults to "scan it" — conservative, never silently skips
  let blockIndent = null; // non-null while inside a `run: |` block scalar body
  lines.forEach((line, n) => {
    if (blockIndent !== null) {
      const indent = /^(\s*)/.exec(line)[1].length;
      if (line.trim() !== '' && indent <= blockIndent) blockIndent = null;
      else {
        if (!jobIsLinux && line.trim() !== '' && !/^\s*#/.test(line) && BARE.test(line)) {
          findings.push([rel.split(sep).join('/'), n + 1, line.trim()]);
        }
        return;
      }
    }
    if (/^  [A-Za-z0-9_.-]+:\s*$/.test(line)) { jobIsLinux = false; return; } // new job: reset to unknown
    const runsOn = /^\s*runs-on:\s*(.+)$/.exec(line);
    if (runsOn) { jobIsLinux = isLinuxRunner(runsOn[1]); return; }
    if (/^\s*#/.test(line)) return;
    const runStep = /^\s*run:\s*(.*)$/.exec(line);
    if (runStep) {
      const rest = runStep[1].trim();
      if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') {
        blockIndent = /^(\s*)/.exec(line)[1].length;
        return;
      }
      if (!jobIsLinux && BARE.test(line)) findings.push([rel.split(sep).join('/'), n + 1, line.trim()]);
    }
  });
}

function scanPackageJson(rel, absPath) {
  let raw;
  try { raw = readFileSync(absPath, 'utf8'); } catch { return; }
  let pkg;
  try { pkg = JSON.parse(raw); } catch { return; }
  const scripts = pkg.scripts || {};
  for (const [name, cmd] of Object.entries(scripts)) {
    if (typeof cmd === 'string' && BARE.test(cmd)) {
      findings.push([rel.split(sep).join('/'), null, `"${name}": "${cmd}"`]);
    }
  }
}

for (const rel of targets) {
  const absPath = join(ROOT, rel);
  if (!existsSync(absPath)) continue;
  if (isPlaywrightConfig(rel)) scanPlaywrightConfig(rel, absPath);
  else if (isWorkflowYaml(rel)) scanWorkflow(rel, absPath);
  else if (isPackageJson(rel)) scanPackageJson(rel, absPath);
}

if (findings.length === 0) {
  console.log('PYTHON INVOCATION: no bare `python` call in a webServer command, a non-Linux workflow step, or a package.json script.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} bare \`python\` call(s):\n` +
  findings.map(([f, n, src]) => `  ${f}${n ? ':' + n : ''}\n      ${src}`).join('\n') +
  `\n  Use \`py -3\`. On Windows a bare \`python\` often resolves to the Store app-execution alias,\n` +
  `  which prints "Python was not found" and exits 9009 — and the caller reports ITS own failure,\n` +
  `  never Python's.`);
process.exit(1);
