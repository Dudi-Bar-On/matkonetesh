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

// SCOPE, stated as a decision and not an oversight (2026-08-09 review): this gate walks `scripts/`
// only, never the whole repo. `scripts/` is where this project's process ENTRY POINTS live — the
// CLIs a person or a hook invokes directly, piped or captured, which is the only way the cp1252
// failure this gate exists for can actually happen (§L74's header). Library/app code elsewhere is
// out of scope by design, not missed.
//
// The check is per-CALL, not per-file (2026-08-09 rewrite). A file may hold Hebrew in a comment or a
// docstring and print nothing but ASCII — flagging it is noise, and noise is how a gate loses its
// readers. What matters is a print whose ARGUMENT carries a character the Windows code page cannot
// encode. The first version tested "does this file contain a print" and "does this file contain any
// non-ASCII character" independently, which flagged 10 of 11 real scripts on em dashes inside comments
// that were never printed.
//
// MULTI-LINE ARGUMENTS (2026-08-09 review fix, option (a) of two offered): the argument class is
// `[^)]*` — no `\n` exclusion — so an argument that wraps onto a following line, e.g.
// `print("...— "\n      f"...")`, is still seen. This is BOUNDED, not a runaway dot-all: `[^)]`
// stops at the very next `)` in the source, so the worst case is stopping at a NESTED call's closing
// paren (e.g. `.join(...)`) rather than the print's own — which still correctly detects the
// non-ASCII argument, just without claiming the exact call boundary. It can never scan past the next
// literal `)`, so it cannot run away across an unbalanced-paren file the way an unbounded `[\s\S]*?`
// reaching for print's OWN close paren could. Real shape this fixes: `scripts/criterion_compare.py`
// carries a print whose argument spans two lines and was invisible to the single-line version; it
// was never live because that file separately reconfigures both streams, but the gate would not
// have said so.
const PRINTS_NON_ASCII = /(?:print|sys\.std(?:out|err)\.write)\s*\([^)]*[^\x00-\x7F][^)]*\)/;
const CALL_RE = /(print|sys\.stdout\.write|sys\.stderr\.write)\s*\(([^)]*)\)/g;
const NON_ASCII = /[^\x00-\x7F]/;

// STREAM-AWARE (2026-08-09 review, item 3): a file that reconfigures stdout still leaks on stderr
// if a `print(..., file=sys.stderr)` or `sys.stderr.write(...)` call carries non-ASCII — the
// original DECLARES matched "utf-8 declared ANYWHERE in the file" regardless of which stream the
// finding actually targets. Cheap enough to do properly: for each non-ASCII call, work out its
// target stream (print defaults to stdout unless `file=` names stderr; the two `sys.std*.write`
// forms are unambiguous), then require a declaration for THAT stream specifically. PYTHONIOENCODING
// is a process-wide env var and satisfies both. The `for _s in (sys.stdout, sys.stderr): ...
// _s.reconfigure(...)` loop form used elsewhere in this repo also covers both, by construction —
// detected as its own case rather than missed for not literally saying `sys.stdout.reconfigure`.
function declaresStream(text, stream) {
  const direct = new RegExp(`sys\\.${stream}\\.reconfigure\\s*\\(\\s*encoding\\s*=\\s*["']utf-8`, 'i');
  if (direct.test(text)) return true;
  if (/PYTHONIOENCODING/.test(text)) return true;
  const wrapper = new RegExp(
    `io\\.TextIOWrapper\\([^)]*${stream}[^)]*utf-8|io\\.TextIOWrapper\\([^)]*utf-8[^)]*${stream}`, 'i');
  if (wrapper.test(text)) return true;
  const loop = /for\s+(\w+)\s+in\s*\(\s*sys\.stdout\s*,\s*sys\.stderr\s*\)\s*:/.exec(text);
  if (loop) {
    const afterLoop = text.slice(loop.index, loop.index + 300);
    const loopReconfigure = new RegExp(`${loop[1]}\\.reconfigure\\s*\\(\\s*encoding\\s*=\\s*["']utf-8`);
    if (loopReconfigure.test(afterLoop)) return true;
  }
  return false;
}

function callStream(kind, arg) {
  if (kind === 'sys.stderr.write') return 'stderr';
  if (kind === 'sys.stdout.write') return 'stdout';
  return /file\s*=\s*(sys\.)?stderr\b/.test(arg) ? 'stderr' : 'stdout'; // print(...) default: stdout
}

const findings = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  if (!PRINTS_NON_ASCII.test(text)) continue;
  const streamsSeen = new Set();
  let m;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(text)) !== null) {
    if (!NON_ASCII.test(m[2])) continue;
    streamsSeen.add(callStream(m[1], m[2]));
  }
  const undeclared = [...streamsSeen].filter((s) => !declaresStream(text, s));
  if (undeclared.length === 0) continue;
  findings.push(`${relative(ROOT, f).split(sep).join('/')} (${undeclared.join(', ')})`);
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
