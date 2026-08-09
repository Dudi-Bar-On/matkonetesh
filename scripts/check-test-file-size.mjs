#!/usr/bin/env node
// check-test-file-size — L30. A spec file's own size silently changes the suite's concurrency.
//
// SEVERITY: WARNING — it reports and always exits 0, and the reasoning is the point. Playwright caps
// workers at the test count PER FILE, so a spec growing from 2 tests to 5 raised the project's real
// concurrency past what service-worker registration cycles reliably survive: an implementer reported
// "825 passed, exit 0" and the controller's own run on the same code gave 821 passed / 4 failed.
// Nothing in that diff looked like a concurrency change; the file just got bigger.
// But a spec legitimately grows, the harm is to run stability rather than to substance, and blocking
// every commit that adds a test is the L70 failure mode this whole arc exists to avoid. So: report.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L30'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];

// The ceiling is the measured worker count, read from the config rather than hardcoded — a number
// pinned here would drift from the one that actually governs the run (L64b).
function ceiling() {
  const cfg = join(ROOT, 'playwright.config.ts');
  if (!existsSync(cfg)) return null;
  let text;
  try { text = readFileSync(cfg, 'utf8'); } catch { return null; }
  const m = /workers\s*:\s*(\d+)/.exec(text);
  return m ? Number(m[1]) : null;      // an expression rather than a literal => null => fall open
}

function specFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) specFiles(p, out);
    else if (name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const limit = ceiling();
if (limit === null) {
  console.log('TEST FILE SIZE: could not read the worker ceiling from playwright.config.ts ' +
              '(absent, or `workers` is an expression rather than a literal). Not reporting.');
  process.exit(0);
}

const over = [];
for (const f of specFiles(join(ROOT, 'tests'))) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const count = (text.match(/(^|\s)test\s*\(/g) || []).length;
  if (count > limit) over.push([relative(ROOT, f).split(sep).join('/'), count]);
}

if (over.length === 0) {
  console.log(`TEST FILE SIZE: no spec file exceeds the measured worker ceiling (${limit}).`);
  process.exit(0);
}
console.log(
  `TEST FILE SIZE — WARNING (not blocking): ${over.length} spec file(s) above the worker ceiling ` +
  `(${limit}):\n` +
  over.map(([f, c]) => `  ${f} — ${c} tests`).join('\n') +
  `\n  Playwright caps workers at the test count per file, so this file alone raises the suite's real\n` +
  `  concurrency. If the suite starts failing in full runs and passing in isolation, look here first:\n` +
  `  nothing in the diff will look like a concurrency change.`);
process.exit(0);
