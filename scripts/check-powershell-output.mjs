#!/usr/bin/env node
// check-powershell-output — L66. In PowerShell the pipeline IS the return value.
//
// SEVERITY: BLOCKING. Two defects, one root, and they bit in OPPOSITE directions. A function ending in
// a bare `$results = @(...)` emits NOTHING — the watchman's real-run branch produced $null, so every
// real run would have iterated an empty set and printed "WATCHMAN OK while checking zero components",
// which is the exact failure the watchman exists to prevent, inside the watchman. And `Write-Output`
// beside `return` emits BOTH, so the caller captures narration mixed into the result. The alternatives
// are named in the message and cost nothing: end with the variable itself, and narrate with Write-Host.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L66'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'test-results']);

function ps1Files(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) ps1Files(p, out);
    else if (name.endsWith('.ps1') || name.endsWith('.psm1')) out.push(p);
  }
  return out;
}

// Brace-count the body of each `function Name {` so a nested scriptblock does not end it early.
function functionBodies(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*function\s+([\w-]+)/.exec(lines[i]);
    if (!m) continue;
    let depth = 0, started = false, body = [], startLine = i + 1;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (j > i || lines[j].includes('{')) body.push([j + 1, lines[j]]);
      if (started && depth === 0) { out.push({ name: m[1], startLine, body }); i = j; break; }
    }
  }
  return out;
}

const files = ps1Files(ROOT);
if (files.length === 0) {
  console.log('check-powershell-output: scanned 0 files — no verdict reached, not a pass. Not blocking.');
  process.exit(0);
}

const isCode = (line) => line.trim() !== '' && !/^\s*#/.test(line);
const findings = [];
for (const f of files) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const rel = relative(ROOT, f).split(sep).join('/');
  for (const fn of functionBodies(lines)) {
    const code = fn.body.filter(([, l]) => isCode(l));
    // (a) the last statement before the closing brace is a bare assignment — emits nothing
    for (let k = code.length - 1; k >= 0; k--) {
      const [n, line] = code[k];
      if (/^\s*}\s*$/.test(line)) continue;
      if (/^\s*\$[\w:]+\s*=\s*/.test(line) && !/^\s*\$\w+\s*=\s*.*\|\s*Out-Null/.test(line)) {
        findings.push([rel, n, `function ${fn.name} ends in a bare assignment`, line.trim()]);
      }
      break;
    }
    // (b) Write-Output beside return in the same body — both reach the pipeline
    const hasWriteOutput = code.find(([, l]) => /^\s*Write-Output\b/.test(l));
    const hasReturn = code.find(([, l]) => /^\s*return\b/.test(l));
    if (hasWriteOutput && hasReturn) {
      findings.push([rel, hasWriteOutput[0],
        `function ${fn.name} uses Write-Output beside return`, hasWriteOutput[1].trim()]);
    }
  }
}

if (findings.length === 0) {
  console.log('POWERSHELL OUTPUT: no function emits nothing, and none mixes narration into its result.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} PowerShell output defect(s):\n` +
  findings.map(([f, n, what, src]) => `  ${f}:${n} — ${what}\n      ${src}`).join('\n') +
  `\n  A bare trailing assignment emits NOTHING: end the function with the variable itself\n` +
  `  (\`$results\` on its own line) so the pipeline carries it.\n` +
  `  Write-Output beside return emits BOTH: narrate with Write-Host, which does not reach the\n` +
  `  pipeline, and let return carry the result alone.`);
process.exit(1);
