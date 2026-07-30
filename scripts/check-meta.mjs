#!/usr/bin/env node
// scripts/check-meta.mjs — the single META entry point (METHODOLOGY §3.3 + §3.4 / H8).
// Wraps: check-graph-fresh · gate-lessons · no-unlanded-items (H8, over the ROADMAP §5 ledger).
// Runs at: session start · from sync-docs.sh before a docs push · before any release(v commit ·
//          EVERY Phase gate and EVERY arc close (H8 duty).
// Env: ROADMAP=<path> targets a fixture copy for self-tests.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failed = [];

function run(name, file) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(name);
}
run('check-graph-fresh', 'check-graph-fresh.mjs');
run('gate-lessons', 'gate-lessons.mjs');

console.log('\n=== no-unlanded-items (H8) ===');
const roadPath = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const road = readFileSync(roadPath, 'utf8');
const errs = [];

// 1) Ledger table (§5): every data row must name its landing in column 1.
const sec5 = road.split(/^## 5 · /m)[1]?.split(/^## /m)[0] ?? '';
if (!sec5) errs.push('ledger section "## 5 · " not found in the roadmap');
const rows = sec5.split('\n').filter(l =>
  l.startsWith('|') && !/^\|[\s|:-]+\|?$/.test(l) && !/^\|\s*Phase\s*\|/.test(l));
for (const r of rows) {
  const phase = (r.split('|')[1] ?? '').trim();
  if (!/^(Phase\s*\S|Language Thread|Sync Thread|בסיס)/.test(phase))
    errs.push(`ledger row without a named phase: "${r.slice(0, 70)}"`);
}
if (!errs.length && rows.length < 10) errs.push(`suspiciously few ledger rows (${rows.length}) - table malformed?`);

// 2) The trigger-anchored remainder: every remainder bullet must state its trigger (H8-ב).
const rest = sec5.split('הנותרים')[1] ?? '';
const bullets = rest.split('\n').filter(l => /^- /.test(l));
if (!bullets.length) errs.push('no remainder bullets found after "הנותרים" in §5');
for (const b of bullets) if (!b.includes('טריגר')) errs.push(`remainder item without a trigger: "${b.slice(0, 70)}"`);

// 3) Forbidden states anywhere in the ledger section.
for (const bad of ['נדחה בלי מועד', 'לא מטופל', 'TBD']) if (sec5.includes(bad)) errs.push(`forbidden marker in ledger: "${bad}"`);

// 4) The roadmap's own H8 assertion must still hold.
if (!road.includes('0 פריטים ללא נחיתה')) errs.push('the roadmap no longer asserts "0 פריטים ללא נחיתה"');

if (errs.length) { for (const e of errs) console.error('  x ' + e); failed.push('no-unlanded-items'); }
else console.log(`OK - ${rows.length} ledger rows land in named phases; ${bullets.length} remainder item(s) trigger-anchored.`);

if (failed.length) { console.error(`\nMETA GATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nMETA GATE OK');
