#!/usr/bin/env node
// scripts/check-h8-ledger.mjs — H8 "no unlanded items", extracted from check-meta.mjs so it is a
// standalone, independently self-testable checker (audit fix #10, COMPLIANCE-AUDIT-2026-08-01.md §10).
//
// Audit finding: the roadmap has TWO ledger sections - "## 5 ·" (156-item base) and "## 5a" (the
// R-1..R-63 recovery ledger). The pre-fix parser stopped at the first "## " heading after "## 5 · ",
// which IS "## 5a" - so it correctly excluded §5a from §5's scan, but nothing else ever scanned §5a
// either. The gate printed "OK - 18 ledger rows land in named phases" while 63 other rows sat
// completely outside the scan. This file scans BOTH sections and prints how many rows each covered.
// Env: ROADMAP=<path> targets a fixture copy for self-tests.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const roadPath = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const road = readFileSync(roadPath, 'utf8');
const errs = [];

// Section boundaries: §5 ends where §5a begins; §5a ends at §5b (or §6, or EOF) if §5a is absent.
const idx5 = road.search(/^## 5 · /m);
const idx5a = road.search(/^## 5a\b/m);
const idx5b = road.search(/^## 5b\b/m);
const idx6 = road.search(/^## 6\b/m);
if (idx5 === -1) errs.push('ledger section "## 5 · " not found in the roadmap');
const sec5End = idx5a !== -1 ? idx5a : road.length;
const sec5 = idx5 !== -1 ? road.slice(idx5, sec5End) : '';
const sec5aEnd = idx5b !== -1 ? idx5b : (idx6 !== -1 ? idx6 : road.length);
const sec5a = idx5a !== -1 ? road.slice(idx5a, sec5aEnd) : '';
if (!sec5a) errs.push('recovery ledger section "## 5a" not found in the roadmap (audit fix #10 target)');

// 1) §5 ledger table: every data row must name its landing in column 1.
const rows = sec5.split('\n').filter(l =>
  l.startsWith('|') && !/^\|[\s|:-]+\|?$/.test(l) && !/^\|\s*Phase\s*\|/.test(l));
for (const r of rows) {
  const phase = (r.split('|')[1] ?? '').trim();
  if (!/^(Phase\s*\S|Language Thread|Sync Thread|בסיס)/.test(phase))
    errs.push(`§5 ledger row without a named phase: "${r.slice(0, 70)}"`);
}
if (!errs.length && rows.length < 10) errs.push(`suspiciously few §5 ledger rows (${rows.length}) - table malformed?`);

// 2) The trigger-anchored remainder: every remainder bullet must state its trigger (H8-ב).
const rest = sec5.split('הנותרים')[1] ?? '';
const bullets = rest.split('\n').filter(l => /^- /.test(l));
if (!bullets.length) errs.push('no remainder bullets found after "הנותרים" in §5');
for (const b of bullets) if (!b.includes('טריגר')) errs.push(`remainder item without a trigger: "${b.slice(0, 70)}"`);

// 3) §5a recovery ledger: every "| R-N | ..." row must carry a non-empty landing (col 4) that is
// either a named phase/thread/trigger, OR the row is closed (R-cancelled / 🟢 סגור / status "סגור").
// This is the audit's fix #10: previously NOTHING scanned this table; up to 63 R-rows were invisible.
const rRows = sec5a.split('\n').filter(l => /^\|\s*R-\d+\s*\|/.test(l));
for (const r of rRows) {
  const cols = r.split('|').map(c => c.trim());
  const label = cols[1] ?? '';
  const landing = cols[4] ?? '';
  const status = cols[5] ?? '';
  const closed = /R-cancelled|סגור/.test(landing) || /R-cancelled|סגור/.test(status);
  if (!landing) errs.push(`§5a row ${label} has no landing (col 4) and is not marked closed`);
  if (!status) errs.push(`§5a row ${label} has no status (col 5)`);
  if (!closed && !landing) errs.push(`§5a row ${label}: neither a named landing nor a closed status`);
}

// 4) Forbidden states anywhere in EITHER ledger section.
for (const bad of ['נדחה בלי מועד', 'לא מטופל', 'TBD']) {
  if (sec5.includes(bad)) errs.push(`forbidden marker in §5 ledger: "${bad}"`);
  if (sec5a.includes(bad)) errs.push(`forbidden marker in §5a ledger: "${bad}"`);
}

// 5) The roadmap's own H8 assertion must still hold.
if (!road.includes('0 פריטים ללא נחיתה')) errs.push('the roadmap no longer asserts "0 פריטים ללא נחיתה"');

if (errs.length) {
  for (const e of errs) console.error('  x ' + e);
  console.error(`\nFAIL: no-unlanded-items (H8) - §5 rows scanned: ${rows.length} · §5a rows scanned: ${rRows.length}.`);
  process.exit(1);
}
console.log(`OK - §5: ${rows.length} ledger rows land in named phases, ${bullets.length} remainder item(s) trigger-anchored. §5a: ${rRows.length} recovery-ledger rows scanned, all landing/status populated.`);
