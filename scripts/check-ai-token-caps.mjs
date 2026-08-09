#!/usr/bin/env node
// check-ai-token-caps — L24. Every AI call carries an 8192 output cap.
//
// SEVERITY: BLOCKING, and the harm is to substance rather than efficiency: a low cap plus a high
// thinking budget truncates the JSON mid-stream with NO error. The smoker device-lookup returned "not
// found" — a confident wrong answer, not a failure — because the model's thinking consumed the budget
// and the payload was cut. Billing is on tokens actually used, so a high cap is free headroom and a
// low one buys nothing. Alternative in the message: raise to 8192, or mark the line as a health probe.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L24'];

const REQUIRED = 8192;
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__']);

function jsFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) jsFiles(p, out);
    else if (/\.(js|mjs|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const targets = [];
if (existsSync(join(ROOT, 'worker'))) targets.push(...jsFiles(join(ROOT, 'worker')));
for (const f of ['app.js']) if (existsSync(join(ROOT, f))) targets.push(join(ROOT, f));

if (targets.length === 0) {
  console.log('check-ai-token-caps: scanned 0 files — no verdict reached, not a pass. Not blocking.');
  process.exit(0);
}

const CAP = /max(?:Output)?Tokens\s*[:=]\s*(\d+)/g;
const findings = [];
for (const f of targets) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const rel = relative(ROOT, f).split(sep).join('/');
  lines.forEach((line, n) => {
    // A tiny health probe is the ONE named exception in the owner's policy. It must say so on the
    // line, so the exemption is visible where the number is, not in a document elsewhere.
    if (/health-probe/i.test(line)) return;
    for (const m of line.matchAll(CAP)) {
      const value = Number(m[1]);
      if (value < REQUIRED) findings.push([rel, n + 1, value, line.trim()]);
    }
  });
}

if (findings.length === 0) {
  console.log(`AI TOKEN CAPS: every cap in ${targets.length} file(s) is ${REQUIRED} or higher.`);
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} AI call(s) capped below ${REQUIRED}:\n` +
  findings.map(([f, n, v, src]) => `  ${f}:${n} — ${v}\n      ${src}`).join('\n') +
  `\n  Raise it to ${REQUIRED}. Billing is on tokens actually used, so the cap is free headroom — a\n` +
  `  low one buys nothing and truncates the JSON mid-stream with no error, which reads as a\n` +
  `  confident wrong answer rather than a failure.\n` +
  `  If this genuinely is a tiny health probe, say so on the line: add a \`health-probe\` comment.`);
process.exit(1);
