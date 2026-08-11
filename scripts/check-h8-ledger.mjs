#!/usr/bin/env node
// scripts/check-h8-ledger.mjs — H8 "no unlanded items", extracted from check-meta.mjs so it is a
// standalone, independently self-testable checker (audit fix #10, COMPLIANCE-AUDIT-2026-08-01.md §10).
//
// Audit finding: the roadmap has TWO ledger sections - "## 5 ·" (156-item base) and "## 5a" (the
// R-1..R-63 recovery ledger). The pre-fix parser stopped at the first "## " heading after "## 5 · ",
// which IS "## 5a" - so it correctly excluded §5a from §5's scan, but nothing else ever scanned §5a
// either. The gate printed "OK - 18 ledger rows land in named phases" while 63 other rows sat
// completely outside the scan. This file scans BOTH sections and prints how many rows each covered.
//
// WORSENING-ONLY BLOCKING (gate-scoping-report.md, 2026-08-01 follow-up). Live rediscovery: a commit
// that PAID DOWN unrelated compliance debt got blocked by THIS gate's OWN pre-existing red state (two
// malformed §5a rows that predated the commit), forcing META_SKIP_HOOK=1 - the escape hatch becoming
// routine is exactly how a gate stops protecting anything. Fix: every finding is computed twice - once
// on the roadmap content at the git baseline ref (default HEAD, i.e. the tree before this commit) and
// once on the current working-tree content - and diffed by exact message text. A finding present at
// BOTH is pre-existing debt: printed loudly under "STANDING DEBT", never blocks. A finding present only
// in the CURRENT text is new-or-worsened: printed under "NEW OR STRUCTURAL", blocks. Two finding
// classes stay always-blocking regardless of the diff, because a diff against them is meaningless -
// nothing else can even be computed without them: the "## 5 ·" header missing entirely, and the "## 5a"
// section missing entirely.
// KNOWN LIMIT (stated, not hidden): the CURRENT side reads the real working-tree file, not the git
// INDEX, so unstaged edits beyond what is actually being committed are included in the comparison too.
// Same class of limit as check-brief.mjs/check-h9.mjs's untracked-directory fallback - acceptable for a
// fast pre-commit gate; CI re-runs this after checkout, where working tree == committed tree exactly.
// Env: ROADMAP=<path> targets a fixture copy for self-tests. GITROOT=<path> / H8_BASELINE_REF=<ref>
// (default HEAD) control where the baseline is read from. BASELINE_ROADMAP=<path> bypasses git entirely
// and uses that file's content as the baseline - for fixture self-tests with no repo at all.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const roadPath = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const road = readFileSync(roadPath, 'utf8');

// ---- pure analysis: roadmap text -> { structural[], findings[], rowsCount, rRowsCount, bulletsCount } ----
function analyze(text) {
  const structural = [];
  const findings = [];

  const idx5 = text.search(/^## 5 · /m);
  const idx5a = text.search(/^## 5a\b/m);
  const idx5b = text.search(/^## 5b\b/m);
  const idx6 = text.search(/^## 6\b/m);
  if (idx5 === -1) structural.push('ledger section "## 5 · " not found in the roadmap');
  const sec5End = idx5a !== -1 ? idx5a : text.length;
  const sec5 = idx5 !== -1 ? text.slice(idx5, sec5End) : '';
  const sec5aEnd = idx5b !== -1 ? idx5b : (idx6 !== -1 ? idx6 : text.length);
  const sec5a = idx5a !== -1 ? text.slice(idx5a, sec5aEnd) : '';
  if (!sec5a) structural.push('recovery ledger section "## 5a" not found in the roadmap (audit fix #10 target)');

  // 1) §5 ledger table: every data row must name its landing in column 1.
  const rows = sec5.split('\n').filter(l =>
    l.startsWith('|') && !/^\|[\s|:-]+\|?$/.test(l) && !/^\|\s*Phase\s*\|/.test(l));
  for (const r of rows) {
    const phase = (r.split('|')[1] ?? '').trim();
    if (!/^(Phase\s*\S|Language Thread|Sync Thread|בסיס)/.test(phase))
      findings.push(`§5 ledger row without a named phase: "${r.slice(0, 70)}"`);
  }
  if (!findings.length && rows.length < 10) findings.push(`suspiciously few §5 ledger rows (${rows.length}) - table malformed?`);

  // 2) The trigger-anchored remainder: every remainder bullet must state its trigger (H8-ב).
  const rest = sec5.split('הנותרים')[1] ?? '';
  const bullets = rest.split('\n').filter(l => /^- /.test(l));
  if (!bullets.length) findings.push('no remainder bullets found after "הנותרים" in §5');
  for (const b of bullets) if (!b.includes('טריגר')) findings.push(`remainder item without a trigger: "${b.slice(0, 70)}"`);

  // 3) §5a recovery ledger: every "| R-N | ..." row must carry a non-empty landing (col 4) that is
  // either a named phase/thread/trigger, OR the row is closed (R-cancelled / 🟢 סגור / status "סגור").
  // rRows carries the STRUCTURED per-row data (id, landing, status, closed), not just prose
  // findings - R-140 needs it: the caller diffs rows BY ID between current and baseline, and any
  // row whose id exists only in current (this commit's OWN row) is run through the stricter FULL
  // rule below (answersFullRule), independent of whether this per-text loop emitted a finding for
  // it at all - a row with a non-empty but MEANING-LESS landing cell produces NO finding here.
  const rRows = sec5a.split('\n').filter(l => /^\|\s*R-\d+\s*\|/.test(l));
  const rRowData = [];
  for (const r of rRows) {
    const cols = r.split('|').map(c => c.trim());
    const label = cols[1] ?? '';
    const landing = cols[4] ?? '';
    const status = cols[5] ?? '';
    const closed = /R-cancelled|סגור/.test(landing) || /R-cancelled|סגור/.test(status);
    if (!landing) findings.push(`§5a row ${label} has no landing (col 4) and is not marked closed`);
    if (!status) findings.push(`§5a row ${label} has no status (col 5)`);
    if (!closed && !landing) findings.push(`§5a row ${label}: neither a named landing nor a closed status`);
    rRowData.push({ id: label, landing, status, closed });
  }

  // 4) Forbidden states anywhere in EITHER ledger section.
  for (const bad of ['נדחה בלי מועד', 'לא מטופל', 'TBD']) {
    if (sec5.includes(bad)) findings.push(`forbidden marker in §5 ledger: "${bad}"`);
    if (sec5a.includes(bad)) findings.push(`forbidden marker in §5a ledger: "${bad}"`);
  }

  // 5) The roadmap's own H8 assertion must still hold.
  if (!text.includes('0 פריטים ללא נחיתה')) findings.push('the roadmap no longer asserts "0 פריטים ללא נחיתה"');

  return { structural, findings, rowsCount: rows.length, rRowsCount: rRows.length, bulletsCount: bullets.length, rRowData };
}

// R-140: the FULL rule a §5a row must answer, stricter than the historical per-text check above
// (which only asks "is landing non-empty?"). A row is answered only if it is closed, or its
// landing names something checkable - a phase/step, a thread, a wave/גל, an arc/קשת, or an
// explicit trigger/anchor reference. Applied ONLY to rows born this commit (present in current,
// absent from baseline by id) - historical debt keeps the lenient emptiness-only check, unchanged.
const LANDING_NAMES_SOMETHING_RE = /Phase\s*\d|שלב\s*\d|Language Thread|Sync Thread|בסיס|גל\s*\d|קשת|טריגר|עוגן/;
function answersFullRule(row) {
  if (row.closed) return true;
  if (!row.landing) return false;
  return LANDING_NAMES_SOMETHING_RE.test(row.landing);
}

const current = analyze(road);

function loadBaseline() {
  if (process.env.BASELINE_ROADMAP) {
    if (!existsSync(process.env.BASELINE_ROADMAP)) return null;
    return readFileSync(process.env.BASELINE_ROADMAP, 'utf8');
  }
  const ref = process.env.H8_BASELINE_REF || 'HEAD';
  try {
    const rel = relative(GITROOT, roadPath).replaceAll('\\', '/');
    return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: GITROOT, encoding: 'utf8' });
  } catch { return null; } // not a git repo / file untracked at that ref / outside GITROOT
}

const baselineText = loadBaseline();
// SAFE DEFAULT: no baseline could be established -> every current finding counts as new (blocks).
// This is deliberately the conservative direction - "can't tell if it's new" must never read as "not new".
const baseline = baselineText != null ? analyze(baselineText) : { structural: [], findings: [], rRowData: [] };
const baselineFindings = new Set(baseline.findings);
const newFindings = current.findings.filter(f => !baselineFindings.has(f));
const standingFindings = current.findings.filter(f => baselineFindings.has(f));

// R-140: rows present in CURRENT but absent from BASELINE by row identity (the "R-nn" id, not the
// whole message) are THIS COMMIT'S OWN rows - evaluated against the FULL rule, always blocking,
// regardless of whether the lenient per-text check above happened to produce a finding for them.
// Historical-debt behavior is UNCHANGED: a row whose id exists on both sides still goes through
// the message-text diff path only (findings/newFindings/standingFindings above).
const baselineRowIds = new Set((baseline.rRowData || []).map(r => r.id));
const newRows = (current.rRowData || []).filter(r => !baselineRowIds.has(r.id));
const newRowWithoutLanding = newRows.filter(r => !answersFullRule(r));

const blocking = [...current.structural, ...newFindings];

console.log(`§5: ${current.rowsCount} row(s) scanned, ${current.bulletsCount} remainder bullet(s). §5a: ${current.rRowsCount} row(s) scanned.`);
console.log(baselineText != null
  ? `baseline: ${process.env.BASELINE_ROADMAP ? 'BASELINE_ROADMAP fixture' : `git ${process.env.H8_BASELINE_REF || 'HEAD'}:${relative(GITROOT, roadPath).replaceAll('\\', '/')}`}`
  : 'baseline: NONE AVAILABLE (git show failed / no repo / no BASELINE_ROADMAP) - every finding below is treated as new (safe default).');

if (standingFindings.length) {
  console.log(`\nSTANDING DEBT (pre-existing at the baseline, reported not blocking - ${standingFindings.length}):`);
  for (const f of standingFindings) console.log('  ~ ' + f);
}

// R-140: printed on stdout (not stderr, unlike NEW OR STRUCTURAL below) so a row born unlanded by
// THIS commit is visible without needing to check a second stream - it is always the freshest,
// most actionable finding a committer can see.
if (newRowWithoutLanding.length) {
  console.log(`\nNEW ROW WITHOUT LANDING (born in this change, does not answer the full H8 rule - blocking - ${newRowWithoutLanding.length}):`);
  for (const r of newRowWithoutLanding) {
    console.log(`  x §5a row ${r.id}: landing "${r.landing || '(empty)'}" names no phase/thread/wave/arc/trigger and the row is not closed`);
  }
}

if (blocking.length || newRowWithoutLanding.length) {
  if (blocking.length) {
    console.error(`\nNEW OR STRUCTURAL (this change introduces or worsens these - blocking - ${blocking.length}):`);
    for (const f of blocking) console.error('  x ' + f);
  }
  console.error(`\nFAIL: no-unlanded-items (H8) - ${newFindings.length} new/worsened finding(s)` +
    (current.structural.length ? ` + ${current.structural.length} structural error(s)` : '') +
    (newRowWithoutLanding.length ? ` + ${newRowWithoutLanding.length} row(s) born without a landing` : '') + '.');
  process.exit(1);
}
console.log(`\nOK - no new or worsened H8 finding in this change (${standingFindings.length} standing-debt finding(s) reported above, not blocking).`);
