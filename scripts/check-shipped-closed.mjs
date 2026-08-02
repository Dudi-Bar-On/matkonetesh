#!/usr/bin/env node
// scripts/check-shipped-closed.mjs — "a row whose work shipped may not stay open" (H10).
//
// WHY THIS EXISTS. Twice in two days, ledger rows sat marked open after their code had shipped:
// R-52/R-57/R-61/R-62 were implemented across the fourteen-task voice-governance arc, released as
// v285, and still read as open the next morning. Both times it was caught by a human asking "what's
// still open?", not by any gate — and both times the contradiction was already written down in plain
// text. The release commit said "סוגר את R-52, R-57, R-61, R-62". The release UX report said it too.
// The ledger said otherwise. Nothing compared the two documents.
//
// That is what this gate compares, and it is deliberately NOT a heuristic about whether a row "looks
// done". It never guesses. It only enforces an internal contradiction between two statements this
// project already makes about itself: if a release commit or a release report CLAIMS a row is closed,
// the ledger must agree. No claim, no opinion — see the "open rows but nobody claimed they shipped"
// case in the self-test, which must stay green. A gate that also tried to detect silently-finished
// work would have to guess, and a guessing gate trains people to ignore it.
//
// SCOPING (gate-scoping-report.md). BLOCKING, like check-board-fresh and check-release, and for the
// same stated reason: the fix is a single cheap edit reachable from the very commit that trips it —
// close the row, or drop the claim from the message. There is no "separate heavy action" excuse here,
// so blocking is the correct incentive rather than accumulating debt. Note the second escape route is
// as legitimate as the first: if the claim was wrong, correcting the CLAIM is the right fix.
//
// An id named in a claim but absent from the ledger is also a failure. A typo'd id is the one way this
// gate could report green while the real row rots untouched, so an unresolvable id is reported rather
// than skipped.
//
// Env (all optional, for the self-tests' disposable fixtures):
//   GITROOT=<dir> · ROADMAP=<path to the ledger md> · RELEASES_DIR=<dir of release reports>
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const ROADMAP = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const RELEASES_DIR = process.env.RELEASES_DIR || join(ROOT, 'docs', 'releases');

if (!existsSync(ROADMAP)) {
  console.error(`FAIL: ledger not found at ${ROADMAP} — cannot verify shipped rows are closed.`);
  process.exit(1);
}

// A closure claim is the phrase this project actually uses, in either language, followed by ids on the
// same line. Kept narrow on purpose: it must match how release messages are really written, and must
// not start inferring closure from prose that merely mentions a row.
const CLAIM_RE = /(?:סוגר(?:ת)?\s+את|closes|closing)\s+([^\n.]*)/gi;
const ID_RE = /\b((?:R|BR|N|A|B|E|W|D|G|L)-\d+[a-z]?)\b/g;

function claimsIn(text, source) {
  const out = [];
  for (const m of text.matchAll(CLAIM_RE)) {
    for (const id of m[1].matchAll(ID_RE)) out.push({ id: id[1], source });
  }
  return out;
}

// ---- source 1: release commit messages (subject + body) ----
let claims = [];
let commitsScanned = 0;
try {
  const log = execSync('git -c log.showsignature=false log --format=%B%x00 -n 400', { cwd: GITROOT, encoding: 'utf8' });
  const messages = log.split('\0').map(s => s.trim()).filter(Boolean);
  for (const msg of messages) {
    const rel = msg.match(/^release\(v(\d+)\)/);
    if (!rel) continue;
    commitsScanned++;
    claims.push(...claimsIn(msg, `release commit v${rel[1]}`));
  }
} catch (e) {
  console.error(`FAIL: could not read git log in ${GITROOT}: ${e.message}`);
  process.exit(1);
}

// ---- source 2: release reports (H14 UX reports and any sibling release doc) ----
let reportsScanned = 0;
if (existsSync(RELEASES_DIR)) {
  for (const f of readdirSync(RELEASES_DIR).filter(f => f.endsWith('.md')).sort()) {
    reportsScanned++;
    claims.push(...claimsIn(readFileSync(join(RELEASES_DIR, f), 'utf8'), `docs/releases/${f}`));
  }
}

// ---- the ledger's own verdict per row: a status cell carrying ✅ is closed, anything else is not ----
const ledgerLines = readFileSync(ROADMAP, 'utf8').split('\n');
const rows = new Map();
for (const line of ledgerLines) {
  const m = line.match(/^\|\s*((?:R|BR|N|A|B|E|W|D|G|L)-\d+[a-z]?)\s*\|/);
  if (!m || !line.trim().endsWith('|')) continue;
  const cells = line.trim().split('|');
  if (cells.length < 4) continue;
  const status = cells[cells.length - 2];
  if (!rows.has(m[1])) rows.set(m[1], status);
}

const claimedIds = [...new Set(claims.map(c => c.id))];
console.log(`scanned: ${commitsScanned} release commit(s) · ${reportsScanned} release report(s) · ${rows.size} ledger row(s)`);
console.log(`closure claims found: ${claims.length} mention(s) covering ${claimedIds.length} distinct row id(s)`);

if (!claims.length) {
  console.log('OK - no document claims a row was closed; nothing to contradict.');
  process.exit(0);
}

const violations = [];
for (const id of claimedIds) {
  const where = [...new Set(claims.filter(c => c.id === id).map(c => c.source))].join(', ');
  if (!rows.has(id)) { violations.push({ id, where, why: 'no such row in the ledger (typo, or the row was deleted instead of closed)' }); continue; }
  if (!rows.get(id).includes('✅')) violations.push({ id, where, why: `ledger status is still open: ${rows.get(id).trim().slice(0, 90)}` });
}

if (violations.length) {
  console.error(`\nFAIL: ${violations.length} row(s) declared shipped but not closed in the ledger:`);
  for (const v of violations) console.error(`  - ${v.id}  (claimed in: ${v.where})\n      ${v.why}`);
  console.error(`\n  Fix ONE of the two, in the same commit:`);
  console.error(`    1. close the row in ${ROADMAP} with a ✅ status naming the release that shipped it; or`);
  console.error(`    2. if the claim was wrong, correct the claim — do not close a row that did not ship.`);
  process.exit(1);
}

console.log(`OK - all ${claimedIds.length} row id(s) declared shipped are closed in the ledger.`);
