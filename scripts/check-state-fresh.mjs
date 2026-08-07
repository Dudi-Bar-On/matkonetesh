#!/usr/bin/env node
// scripts/check-state-fresh.mjs — Task 1 item 7 (owner, 2026-08-07: "הקפדה לחומרה מקסימלית, קרובה
// לאכיפה ככל הניתן"). The ACTIVE ledger (.superpowers/sdd/<plan>/progress.md, most-recently-modified
// under .superpowers/sdd/) must stay current with git: if commits landed in this arc since the
// ledger was last edited, and the ledger was not itself touched alongside them, this BLOCKS.
//
// WHY THIS BLOCKS AND NOT JUST REPORTS (check-meta.mjs's own "GATE SCOPING" test, restated per-gate
// as that file requires): the fix is one line in a ledger file, cheap and immediately reachable from
// the exact commit that tripped the gate. There is no "separate heavy rebuild action" excuse the way
// there is for check-geniza-fresh's corpus or check-rules-fresh's mirror.
//
// WHY THE SEVERITY LANDS HERE AND NOT ON session-state.mjs's OUTPUT: session-state.mjs cannot block
// anything — it is a read-only recovery report. But a STALE LEDGER is a falsehood that sounds like a
// fact once session-state.mjs reads it and states it with confidence at the next compact. This is
// the exact failure that happened today: a `git add` failed on one pathspec, git refused the whole
// add, and R-109 read as CLOSED in the source doc while its own tracking silently lagged for an hour
// — nothing checked whether the record matched what had landed. This gate is that check.
//
// NO BYPASS (§ "הכרעת חומרה", owner): the less-efficient-but-always-available alternative is to
// update the ledger by hand, which costs one line — so blocking here is legitimate, not obstructive.
//
// DEGRADATION (§5.1(ג)): no active arc at all -> SKIP with a stated reason, never a failure — there
// is nothing to check freshness OF. git unavailable -> SKIP, same reasoning check-board-fresh and
// check-geniza-fresh already apply to their own git/DB dependencies: an infra failure is not a
// compliance finding.
//
// Env overrides (self-test fixtures only): SDD_DIR=<path>, GITROOT=<path>.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLedgers } from './session-state.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

let ledgers;
try {
  ledgers = findLedgers();
} catch (e) {
  console.log(`SKIP - could not read .superpowers/sdd/ (${e.message.split('\n')[0].slice(0, 160)}). Infra failure, not a compliance finding (§5.1(ג)).`);
  process.exit(0);
}
if (!ledgers.length) {
  console.log('SKIP - no active arc: no .superpowers/sdd/<plan>/progress.md ledger exists. Nothing to check freshness of.');
  process.exit(0);
}
ledgers.sort((a, b) => b.mtime - a.mtime);
const top = ledgers[0];
const ledgerRel = relative(GITROOT, top.path).split('\\').join('/');
const ledgerMtimeISO = new Date(top.mtime).toISOString();

console.log(`active ledger: ${top.dir}/progress.md (last edited ${ledgerMtimeISO.slice(0, 16)})`);

let sinceLog;
try {
  sinceLog = execFileSync('git', ['log', `--since=${ledgerMtimeISO}`, '--format=%H\x01%cI\x01%s'], { cwd: GITROOT, encoding: 'utf8' }).trim();
} catch (e) {
  console.log(`SKIP - git unavailable in ${GITROOT} (${e.message.split('\n')[0].slice(0, 160)}). Infra failure, not blocked (§5.1(ג)).`);
  process.exit(0);
}
if (!sinceLog) {
  console.log(`OK - no commits landed since the ledger was last edited (${ledgerMtimeISO.slice(0, 16)}). Nothing to reconcile.`);
  process.exit(0);
}
const commits = sinceLog.split('\n').map(l => l.split('\x01'));

let touched;
try {
  touched = execFileSync('git', ['log', `--since=${ledgerMtimeISO}`, '--name-only', '--format=', '--', ledgerRel], { cwd: GITROOT, encoding: 'utf8' }).trim();
} catch (e) {
  console.log(`SKIP - git unavailable while checking the ledger's own history (${e.message.split('\n')[0].slice(0, 160)}). §5.1(ג).`);
  process.exit(0);
}
if (touched) {
  console.log(`OK - active ledger was updated alongside the ${commits.length} commit(s) landed since ${ledgerMtimeISO.slice(0, 16)}.`);
  process.exit(0);
}

console.error(`FAIL: check-state-fresh — ${commits.length} commit(s) landed in the active arc (${top.dir}) since its ledger was last edited (${ledgerMtimeISO.slice(0, 16)}), and the ledger was not touched by any of them.`);
console.error('  Commits not yet recorded in the ledger:');
for (const [h, d, s] of commits.slice(0, 10)) console.error(`    ${h.slice(0, 7)}  ${d.slice(0, 16)}  ${s}`);
if (commits.length > 10) console.error(`    ... +${commits.length - 10} more`);
console.error(`  Fix: append one line to ${ledgerRel} recording what these commit(s) closed (or, if they genuinely belong to a different arc, note that) — then commit it. This is a one-line, immediate fix reachable from the commit that tripped this gate; no bypass exists (owner severity ruling — a less-efficient hand-edit is always available).`);
process.exit(1);
