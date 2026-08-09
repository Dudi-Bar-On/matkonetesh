#!/usr/bin/env node
// check-test-waits — DoD-11, L15, L58. Tests wait on conditions, and the condition must be able to fail.
//
// SEVERITY: BLOCKING. An arbitrary wait is a latent flake that detonates in a full run under parallel
// load — a real one produced a failure that passed in isolation every time, sending a debugging session
// after the product instead of the test. The alternative is named in the message and is strictly
// better: waitForFunction on the observable the test is actually about.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['DoD-11', 'L15', 'L58'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', 'dist']);

function specFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) specFiles(p, out);
    else if (name.endsWith('.spec.ts') || name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

let files;
try {
  files = specFiles(join(ROOT, 'tests'));
} catch (err) {
  console.log(`check-test-waits: could not scan tests/ (${err.code ?? err.message}). Not blocking.`);
  process.exit(0);
}

// A gate that scanned nothing has not decided anything. Fail open (do not block) but say plainly that
// no verdict was reached — a task-1 correction that applies to every gate built off this shape.
if (files.length === 0) {
  console.log('check-test-waits: scanned 0 files — no verdict reached, not a pass. Not blocking.');
  process.exit(0);
}

// A predicate that cannot fail: `|| true`, `|| 1`, or a bare `=> true`. The `?.` in the shipped example
// is a tell but not a rule — optional chaining is legitimate; the tautology beside it is not.
// NOTE (deviation from the brief, forced by its own test): the brief's `[^)]*` cannot cross the nested
// `)` in `waitForFunction(() => ...)` — it never matches `waitForFunction(() => x || true)`, which is
// the exact L58 case this gate exists to catch. Bounding on `;` instead (one statement, may span lines
// for a multi-line predicate) fixes that without opening the scan past the statement it belongs to.
const CANNOT_FAIL = /waitForFunction\s*\([^;]*?(\|\|\s*(true|1)\b|=>\s*true\s*[,)])/s;

// A gate that fires on prose ABOUT a rule, rather than a violation OF it, is worse than no gate:
// it trains the reader to skip the output. Strip line and block comments before matching. This is
// deliberately naive — it does not understand strings containing "//" — and that is the correct
// trade here: a missed violation inside a string literal is a false NEGATIVE, which this arc's
// other tests can still catch, while a false POSITIVE costs the gate its credibility.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const findings = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const rel = relative(ROOT, f).split(sep).join('/');
  // Per-line stripping (not stripComments on the whole file) so a match keeps the ORIGINAL line
  // number — collapsing the file first would shift every line after a multi-line block comment.
  text.split('\n').forEach((line, n) => {
    if (stripComments(line).includes('waitForTimeout')) findings.push([rel, n + 1, 'waitForTimeout', line.trim()]);
  });
  const strippedText = stripComments(text);
  const m = CANNOT_FAIL.exec(strippedText);
  if (m) {
    const upto = strippedText.slice(0, m.index).split('\n').length;
    findings.push([rel, upto, 'a predicate that cannot fail', m[0].split('\n')[0].trim()]);
  }
}

if (findings.length === 0) {
  console.log(`TEST WAITS: ${files.length} spec file(s), no arbitrary wait and no unfailable predicate.`);
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} wait(s) that cannot do their job:\n` +
  findings.map(([f, n, what, src]) => `  ${f}:${n} — ${what}\n      ${src}`).join('\n') +
  `\n  Wait on the observable the test is about: waitForFunction(() => <the thing you expect>).\n` +
  `  A predicate containing "|| true" is a comment with a network round-trip — if no reachable\n` +
  `  state makes it false, it never waited for anything.`);
process.exit(1);
