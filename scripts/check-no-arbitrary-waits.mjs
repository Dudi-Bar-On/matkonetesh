#!/usr/bin/env node
// check-no-arbitrary-waits — a test that waits on elapsed time cannot fail for the right reason.
//
// WHY THIS EXISTS. DoD-11 and tests/TEST-AUTHORING-CONTRACT.md:55 both say a test waits on
// CONDITIONS, never on a clock: `page.waitForTimeout(...)` is forbidden. A condition wait
// (`waitForFunction`, `expect.poll`, an awaited readiness promise) can observe the condition never
// becoming true and fail — that is what makes it a test. A fixed sleep cannot fail at all; it just
// proceeds once the clock runs out, whether or not the thing it was "waiting for" actually happened.
// That is exactly how a test comes to pass for the wrong reason: green today, and silently wrong the
// day the timing shifts under it. tests/i18n-completeness.spec.ts:48 and :121 shipped two such sleeps
// (a language-dictionary/re-render settle disguised as `await page.waitForTimeout(70/80)`); nothing
// local caught it before this gate existed.
//
// WHAT IT CHECKS. Every tests/**/*.ts and tests/**/*.mjs file, for a live (non-comment) occurrence of
// `waitForTimeout`. A hit inside a comment — a line whose first non-whitespace characters are `//` or
// `*`, or a `waitForTimeout` that only appears after a `//` later on the same line — is not a
// violation; the codebase intentionally documents the rule at e3-probe.spec.ts:175,
// i18n-split.spec.ts:77 and p0-spoken-safety.spec.ts:190, and this gate must not flag its own rule
// being quoted.
//
// WHAT IT DOES NOT CHECK. A `setTimeout` used as a manual sleep inside `page.evaluate(...)` — that
// code runs in the BROWSER context, not in the test, so it is not a Playwright wait at all and this
// gate cannot see it as one without a much heavier parse. There are 7 such occurrences in the repo
// today; some are legitimate polling helpers (a `setTimeout` loop that re-checks a condition), not
// disguised sleeps. That distinction needs a human, not a grep — reported honestly as a gap, not
// silently ignored and not guessed at here.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';

const argv = process.argv.slice(2);
const rootArg = (() => { const i = argv.indexOf('--root'); return i === -1 ? null : argv[i + 1]; })();
const ROOT = rootArg ?? join(dirname(fileURLToPath(import.meta.url)), '..');
// fail-open on an unreadable override (§10.24):
if (rootArg && !existsSync(ROOT)) {
  console.log(`check-no-arbitrary-waits: could not read root ${ROOT}. Not blocking.`);
  process.exit(0);
}
const TESTS_DIR = join(ROOT, 'tests');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (/\.(ts|mjs)$/.test(name)) out.push(abs);
  }
}

if (!existsSync(TESTS_DIR)) {
  console.log('OK - no tests/ directory.');
  process.exit(0);
}

const files = [];
walk(TESTS_DIR, files);

const NEEDLE = 'waitForTimeout';
let filesScanned = 0;
const violations = [];

for (const abs of files) {
  filesScanned++;
  const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idx = line.indexOf(NEEDLE);
    if (idx === -1) continue;
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;   // whole-line comment
    const commentAt = line.indexOf('//');
    if (commentAt !== -1 && commentAt < idx) continue;                   // occurs after a `//` on this line
    violations.push({ file: rel, line: i + 1, text: line.trim() });
  }
}

console.log(`files scanned: ${filesScanned} (tests/**/*.ts, tests/**/*.mjs)`);
console.log('  detects: a live (non-comment) `page.waitForTimeout(...)` call in a test file — DoD-11 / TEST-AUTHORING-CONTRACT.md:55');
console.log('  does NOT detect: `setTimeout` used as a sleep inside `page.evaluate(...)` (browser-context code, not a Playwright wait — 7 such occurrences exist today; some are legitimate polling helpers, not disguised sleeps)');

if (violations.length) {
  console.log(`\nFAIL: ${violations.length} arbitrary wait(s):`);
  for (const v of violations) {
    console.log(`  x ${v.file}:${v.line}`);
    console.log(`      ${v.text}`);
  }
  console.log('\n  A timeout is not a wait: a condition wait can fail when the condition is never met, a fixed');
  console.log('  sleep cannot fail at all — it just proceeds, which is how a test comes to pass for the wrong');
  console.log('  reason. Replace with page.waitForFunction(...)/expect.poll on the actual condition.');
  process.exit(1);
}
console.log('OK - no arbitrary waits in tests/**/*.ts, tests/**/*.mjs.');
