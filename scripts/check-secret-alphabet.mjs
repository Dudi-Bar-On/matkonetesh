#!/usr/bin/env node
// check-secret-alphabet — L53. A generated secret is an input to a command line.
//
// SEVERITY: BLOCKING. `secrets.token_urlsafe(32)` produced a password beginning with `-`; neo4j-admin
// read it as a FLAG and crash-looped reporting "Missing required parameter: '<password>'" — an error
// pointing at a missing value while the value was right there, being misread. The `/` in the same
// alphabet would split NEO4J_AUTH's `user/password` form. The alternative is one line and is named in
// the message: choose from A-Za-z0-9._~ and start with a letter.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L53'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__']);

function scriptFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) scriptFiles(p, out);
    else if (/\.(py|mjs|js|ps1)$/.test(name)) out.push(p);
  }
  return out;
}

const GENERATOR = /\b(secrets\.token_urlsafe|secrets\.token_bytes|secrets\.token_hex|uuid4\(\)\.hex)\b/;
// The safe form names its own alphabet — a choice() over an explicit character set, or an explicit
// reference to the project's alphabet. Anything else is a generator whose output shape is unexamined.
const DECLARES_ALPHABET = /(A-Za-z0-9\._~|ALPHABET|secrets\.choice\s*\()/;

const findings = [];
for (const f of scriptFiles(join(ROOT, 'scripts'))) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const rel = relative(ROOT, f).split(sep).join('/');
  lines.forEach((line, n) => {
    if (!GENERATOR.test(line)) return;
    // A generator is fine when the file also pins the alphabet — check the file, not just the line,
    // because the alphabet is usually a module-level constant.
    const context = lines.slice(Math.max(0, n - 6), n + 7).join('\n');
    if (DECLARES_ALPHABET.test(context) || DECLARES_ALPHABET.test(lines.join('\n'))) return;
    findings.push([rel, n + 1, line.trim()]);
  });
}

if (findings.length === 0) {
  console.log('SECRET ALPHABET: every generated credential pins its alphabet.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} credential generator(s) with no declared alphabet:\n` +
  findings.map(([f, n, src]) => `  ${f}:${n}\n      ${src}`).join('\n') +
  `\n  A generated secret crosses command lines, env vars and URLs before it is ever used. Choose\n` +
  `  from A-Za-z0-9._~ and require a letter first:\n` +
  `      ALPHABET = string.ascii_letters + string.digits + "._~"\n` +
  `      pw = secrets.choice(string.ascii_letters) + "".join(secrets.choice(ALPHABET) for _ in range(31))\n` +
  `  A leading "-" is read as a flag; a "/" splits a user/password pair.`);
process.exit(1);
