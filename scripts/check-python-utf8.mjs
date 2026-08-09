#!/usr/bin/env node
// check-python-utf8 — L74. A Python entry point that prints non-ASCII must declare utf-8 on stdout.
//
// SEVERITY: BLOCKING, and the harm is precisely to substance: the ONE refusal message carrying a
// Hebrew quote crashed with UnicodeEncodeError instead of printing, so the user saw a traceback in
// place of the reason — and the reason is the entire purpose of a refusal (§10.24). Windows gives a
// non-console stdout the cp1252 code page, so this appears only when output is piped. The alternative
// is two lines at the top of the file, and the message names them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L74'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'venv', '.venv']);

function walk(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.py')) out.push(p);
  }
  return out;
}

// Scan git-tracked .py files under scripts/, with a filesystem-walk fallback so `--root <tmp_path>`
// tests still work. An untracked scratch file is not this gate's business.
let files;
try {
  const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', 'scripts'], { encoding: 'utf8' });
  const tracked = out.split('\0').filter(Boolean);
  if (tracked.length === 0) throw new Error('no tracked files (not a git repo, or nothing committed)');
  files = tracked.filter((rel) => rel.endsWith('.py')).map((rel) => join(ROOT, rel));
} catch {
  files = walk(join(ROOT, 'scripts'));
}

if (files.length === 0) {
  console.log('check-python-utf8: scanned 0 files — no verdict reached, not a pass. Not blocking.');
  process.exit(0);
}

// The check is per-CALL, not per-file (2026-08-09 rewrite). A file may hold Hebrew in a comment or a
// docstring and print nothing but ASCII — flagging it is noise, and noise is how a gate loses its
// readers. What matters is a print whose ARGUMENT carries a character the Windows code page cannot
// encode. The first version tested "does this file contain a print" and "does this file contain any
// non-ASCII character" independently, which flagged 10 of 11 real scripts on em dashes inside comments
// that were never printed.
const PRINTS_NON_ASCII = /(?:print|sys\.std(?:out|err)\.write)\s*\([^)\n]*[^\x00-\x7F][^)\n]*\)/;
const DECLARES = /(reconfigure\s*\(\s*encoding\s*=\s*["']utf-8|PYTHONIOENCODING|io\.TextIOWrapper\([^)]*utf-8)/;

const findings = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  if (!PRINTS_NON_ASCII.test(text)) continue;
  if (DECLARES.test(text)) continue;
  findings.push(relative(ROOT, f).split(sep).join('/'));
}

if (findings.length === 0) {
  console.log('PYTHON UTF-8: every non-ASCII-printing script under scripts/ declares its encoding.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} script(s) print non-ASCII without declaring utf-8:\n` +
  findings.map((f) => `  ${f}`).join('\n') +
  `\n  Add at the top:\n` +
  `      import sys\n` +
  `      sys.stdout.reconfigure(encoding="utf-8")\n` +
  `  Note this is invisible in a terminal — Windows only applies cp1252 when stdout is a PIPE, so a\n` +
  `  test that does not spawn the CLI as a subprocess cannot see the failure at all.`);
process.exit(1);
