#!/usr/bin/env node
// check-requirements — everything the Python code imports must be declared in requirements.txt.
//
// Added 2026-08-05 after the exact failure it prevents. tree-sitter and its three language wheels
// were pip-installed by hand while building the code-parsing layer and never written down. Locally
// everything passed. In CI, `pip install -r requirements.txt` produced an environment that could
// not import the module the tests need, and check-pytest reported:
//
//     SKIPPED — No module named 'tree_sitter'
//
// which is honest, and useless: the gate that exists to verify the memory layer could not run, in
// the one place that is not bypassable. The manifest had silently stopped describing the software.
//
// LIMITS, stated rather than implied. This reads static `import` / `from` statements. It does not
// see a dynamic __import__, an optional dependency inside a try/except, or a package pulled in
// only transitively. It catches the thing that actually happened: an import added to the code and
// not to the manifest.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'scripts', 'tests'];
const REQ = join(ROOT, 'requirements.txt');
// Overrides are declarations too. requirements-overrides.txt holds pins that deliberately
// contradict a package's own constraint (see its header); a package declared there is declared.
// Without this the gate would demand neo4j be added to requirements.txt, where pip would then
// refuse to resolve it — the gate pushing the repo toward an environment that cannot be built.
const REQ_OVERRIDES = join(ROOT, 'requirements-overrides.txt');

// Import name -> distribution name, where they differ. Getting this wrong in EITHER direction
// produces a false report, so each entry is one that exists in this repo.
const DIST = {
  llama_index: 'llama-index-core',
  fitz: 'pymupdf',
  PIL: 'pillow',
  dotenv: 'python-dotenv',
  yaml: 'pyyaml',
  psycopg: 'psycopg',
  neo4j: 'neo4j',
  sqlalchemy: 'sqlalchemy',
  pgvector: 'pgvector',
};

// Python's own modules. Kept as a list because Node cannot ask the interpreter for it without
// running Python, and this gate must work when Python is absent.
const STDLIB = new Set(`abc argparse array ast asyncio base64 binascii bisect builtins bz2 calendar
collections colorsys concurrent configparser contextlib copy csv ctypes dataclasses datetime decimal
difflib dis email enum errno faulthandler filecmp fileinput fnmatch fractions ftplib functools gc
getpass gettext glob gzip hashlib heapq hmac html http imaplib importlib inspect io ipaddress
itertools json keyword linecache locale logging lzma mailbox math mimetypes mmap multiprocessing
numbers operator os pathlib pickle pkgutil platform plistlib pprint profile pty queue quopri random
re readline reprlib resource secrets select shelve shlex shutil signal site smtplib socket socketserver
sqlite3 ssl stat statistics string struct subprocess sys sysconfig tarfile tempfile textwrap
threading time timeit tkinter token tokenize tomllib trace traceback types typing unicodedata
unittest urllib uuid venv warnings wave weakref webbrowser xml zipfile zipimport zlib`.split(/\s+/));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === '__pycache__' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.py')) out.push(p);
  }
  return out;
}

if (!existsSync(REQ)) {
  console.log('SKIPPED — requirements.txt not present.');
  process.exit(0);
}

function declarationsIn(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/[<>=!~\[;]/)[0].trim().toLowerCase());
}

const declared = [...declarationsIn(REQ), ...declarationsIn(REQ_OVERRIDES)];
const overrideCount = declarationsIn(REQ_OVERRIDES).length;

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const localModules = new Set(
  readdirSync(ROOT).filter((f) => f.endsWith('.py')).map((f) => f.replace(/\.py$/, ''))
);
for (const d of SCAN_DIRS) localModules.add(d);

// An `import` at the start of a line is not necessarily an import. This file's own docstrings
// contain the sentence "...separating a time / from the temperature it belongs to", whose second
// line begins with `from the` — and the first version of this gate duly reported a missing
// package called "the". Prose inside a triple-quoted block has to be skipped, the same way the
// markdown chunker skips headings inside a fenced code block.
//
// `from x import y` and `import x` only. `from x import ...` without the `import` keyword is not
// valid Python, so requiring it removes another whole class of prose match.
const FROM_IMPORT = /^[ \t]*from[ \t]+([A-Za-z_][\w.]*)[ \t]+import[ \t]/;
const PLAIN_IMPORT = /^[ \t]*import[ \t]+([A-Za-z_][\w.]*)/;

function pythonImports(text) {
  const found = [];
  let fence = null; // the triple-quote that opened the current block, or null
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (fence) {
      if (line.includes(fence)) fence = null;
      continue;
    }
    // A docstring that opens and closes on the same line does not open a block.
    const open = line.match(/("""|''')/);
    if (open) {
      const q = open[1];
      const count = line.split(q).length - 1;
      if (count % 2 === 1) { fence = q; continue; }
    }
    if (/^[ \t]*#/.test(line)) continue;

    const m = line.match(FROM_IMPORT) || line.match(PLAIN_IMPORT);
    if (m) found.push({ top: m[1].split('.')[0], line: i + 1 });
  }
  return found;
}

const missing = new Map();

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const { top, line } of pythonImports(text)) {
    if (STDLIB.has(top) || localModules.has(top) || top.startsWith('_')) continue;
    const dist = (DIST[top] ?? top).replace(/_/g, '-').toLowerCase();
    if (declared.includes(dist) || declared.includes(top.toLowerCase())) continue;
    if (!missing.has(dist)) missing.set(dist, []);
    missing.get(dist).push(`${f.replace(ROOT, '').replace(/^[\\/]/, '')}:${line}`);
  }
}

console.log(
  `python files scanned: ${files.length} · declared: ${declared.length}` +
    (overrideCount ? ` (${declared.length - overrideCount} in requirements.txt, ${overrideCount} in requirements-overrides.txt)` : '')
);
console.log('  detects: a static import with no matching line in requirements.txt');
console.log('  does NOT detect: dynamic __import__, optional deps in try/except, or transitive pulls');

if (missing.size) {
  console.log(`FAIL: ${missing.size} imported package(s) are not declared:`);
  for (const [dist, where] of missing) {
    console.log(`  x ${dist}  (imported at ${where.slice(0, 3).join(', ')}${where.length > 3 ? ` +${where.length - 3} more` : ''})`);
  }
  console.log('  A manifest that does not describe the software produces an environment that cannot run it.');
  process.exit(1);
}
console.log('OK - every imported package is declared.');
