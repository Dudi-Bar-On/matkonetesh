#!/usr/bin/env node
// check-yaml-duplicate-keys — L61. A duplicate key inside one mapping.
//
// SEVERITY: BLOCKING. It is silent locally (last-one-wins, no warning from any local parser) and fatal
// remotely (GitHub refuses the file), which is the worst combination a defect can have: every check you
// can run says green. CI was dark for eleven hours behind exactly this. The alternative is trivially
// reachable — delete the duplicate line — and is named in the message.
//
// Implemented WITHOUT a YAML library on purpose: js-yaml's default schema also takes last-one-wins, so
// asking it to parse would reproduce the very silence being detected. This walks indentation instead,
// which is enough to answer "did the same key appear twice at the same level under the same parent".
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L61'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'test-results']);

function isYaml(name) { return name.endsWith('.yml') || name.endsWith('.yaml'); }

function walk(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (isYaml(name)) out.push(p);
  }
  return out;
}

// MEASURED 2026-08-09: the tree holds 149 .yml/.yaml files and only THREE are tracked — the other 146
// are untracked `.playwright-mcp/` page snapshots, which are machine-generated and full of repeated
// keys. Scan the tracked list, exactly as check-control-bytes does, with the same filesystem fallback
// so the tmp_path tests still work.
let files;
try {
  const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' });
  const tracked = out.split('\0').filter(Boolean);
  if (tracked.length === 0) throw new Error('no tracked files (not a git repo, or nothing committed)');
  files = tracked.filter(isYaml).map((rel) => join(ROOT, rel));
} catch {
  files = walk(ROOT);
}

if (files.length === 0) {
  console.log('check-yaml-duplicate-keys: scanned 0 files — no verdict reached, not a pass. Not blocking.');
  process.exit(0);
}

// MEASURED BEFORE DISPATCH, 2026-08-09, and the first version was wrong. A `- ` list item begins a
// NEW sibling mapping at the same indent, so `with:`/`run:`/`uses:` appearing once per STEP is
// perfectly legal YAML. Without the item reset below, this gate reported 21 duplicates across the two
// real workflows — it would have fired on healthy files on its very first run, which is how a gate
// loses its credibility permanently.
const KEY = /^(\s*)-?\s*([A-Za-z0-9_.-]+):(\s|$)/;
const ITEM = /^(\s*)-\s/;
const findings = [];
for (const f of files) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const seen = new Map();          // indent -> Map(key -> line number)
  lines.forEach((line, n) => {
    if (/^\s*#/.test(line) || line.trim() === '') return;
    const item = ITEM.exec(line);
    if (item) {
      // Everything recorded at this indent or deeper belonged to the PREVIOUS list element.
      const at = item[1].length;
      for (const depth of [...seen.keys()]) if (depth >= at) seen.delete(depth);
    }
    const m = KEY.exec(line);
    if (!m) return;
    const indent = m[1].length + (item ? 2 : 0);
    const key = m[2];
    for (const depth of [...seen.keys()]) if (depth > indent) seen.delete(depth);
    if (!seen.has(indent)) seen.set(indent, new Map());
    const level = seen.get(indent);
    if (level.has(key)) {
      findings.push([relative(ROOT, f).split(sep).join('/'), key, level.get(key), n + 1]);
    } else {
      level.set(key, n + 1);
    }
  });
}

if (findings.length === 0) {
  console.log('YAML KEYS: no duplicate key in any mapping.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} duplicate YAML key(s):\n` +
  findings.map(([f, k, a, b]) => `  ${f} — "${k}" at line ${a} and again at line ${b}`).join('\n') +
  `\n  Delete the stale line. Every local parser accepts this (last-one-wins, no warning) and\n` +
  `  GitHub's does not — the workflow will not compile, and the run shows zero jobs with no logs.`);
process.exit(1);
