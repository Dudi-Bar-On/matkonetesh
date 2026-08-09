#!/usr/bin/env node
// check-control-bytes — L43a. No tracked text file may carry a C0 control byte other than tab/LF/CR.
//
// SEVERITY: BLOCKING. The harm is to substance, not efficiency: such a byte is invisible in every
// editor and every diff, so the defect it causes is undiagnosable by reading. A regex once carried a
// literal U+0008 and matched ZERO rows on every run while its source read as correct. The alternative
// is always reachable and costs seconds — delete the byte, or write the escape sequence instead.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L43a'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];

const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.md', '.json', '.yml',
                      '.yaml', '.css', '.html', '.ps1', '.sh', '.sql', '.txt']);
// Vendor documentation ships ANSI examples containing ESC. Correcting someone else's published docs is
// not this gate's business, and a gate that fires on content you may not change teaches people to skip it.
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', '.wrangler',
                           '.playwright-mcp', 'vendor', 'test-results', 'playwright-report']);
// Extracted primary-source text is EVIDENCE, not source: a control byte here (e.g. a PDF-extraction
// artifact standing in for a degree sign or bullet) is a corpus-fidelity defect in the project's
// safety-evidence base. It is the owner's call whether/how to repair it — never silently rewritten
// by a lint gate, the same principle as the docs/vendor exemption above but for a different reason.
const EXEMPT_PREFIXES = ['docs/sources/corpus'];

function pathIsExempt(relPath) {
  const segs = relPath.split('/');
  if (segs.some((s) => SKIP_DIRS.has(s))) return true;
  return EXEMPT_PREFIXES.some((p) => relPath === p || relPath.startsWith(p + '/'));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT.has(extname(name))) out.push(p);
  }
  return out;
}

// The rule's own words are "a tracked source file": prefer git's tracked-file list over a filesystem
// crawl, so untracked scratch/working files (which are not this gate's business) are never scanned.
// A tmp_path in a test is not a git repo (or is an EMPTY one before anything is added), so on any
// failure OR an empty result we fall back to the filesystem walk — that fallback is what keeps the
// --root <tmp_path> tests meaningful.
let files;
try {
  const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' });
  const tracked = out.split('\0').filter(Boolean);
  if (tracked.length === 0) throw new Error('no tracked files (not a git repo, or nothing committed)');
  files = tracked
    .filter((rel) => TEXT.has(extname(rel)) && !pathIsExempt(rel))
    .map((rel) => join(ROOT, rel));
} catch {
  try {
    files = walk(ROOT).filter((f) => !pathIsExempt(relative(ROOT, f).split(sep).join('/')));
  } catch (err) {
    console.log(`check-control-bytes: could not scan ${ROOT} (${err.code ?? err.message}). Not blocking.`);
    process.exit(0);
  }
}

const bad = [];
for (const f of files) {
  let buf;
  try { buf = readFileSync(f); } catch { continue; }   // unreadable file is not a verdict
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b < 0x20 && b !== 9 && b !== 10 && b !== 13) {
      bad.push([relative(ROOT, f).split(sep).join('/'), i, '0x' + b.toString(16)]);
      break;   // one report per file: the second byte adds no decision
    }
  }
}

if (bad.length === 0) {
  console.log(`CONTROL BYTES: none in ${files.length} text file(s).`);
  process.exit(0);
}
console.log(
  `FAIL: ${bad.length} file(s) carry an invisible control byte:\n` +
  bad.map(([f, i, h]) => `  ${f} — byte ${h} at offset ${i}`).join('\n') +
  `\n  The byte is invisible in your editor and in git diff. Delete it, or write the escape\n` +
  `  sequence (\\x08) if the text is meant to SHOW the byte rather than contain it.\n` +
  `  Beware: a bash heredoc eats a literal backslash, so a repair script can rewrite the very\n` +
  `  byte it removes — build the backslash from bytes([92]) (L68).`);
process.exit(1);
