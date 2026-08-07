#!/usr/bin/env node
// scripts/check-backup-fresh.mjs — R-111: "a backup nobody checks the freshness of is an assumption."
// R-111's own finding was concrete, not hypothetical: the geniza's newest backup was found TWO DAYS
// and 71 documents behind the live store, discovered only because someone happened to look. This gate
// is that look, run every time (§10.12/H8), so staleness is a finding on the next commit, not
// whenever someone next remembers to check by hand.
//
// THREE INDEPENDENT FRESHNESS QUESTIONS, filesystem-only (no DB credentials, no live connection —
// this gate must answer correctly even when Postgres/Neo4j are both down, which is exactly the
// scenario a backup exists to survive):
//   1. mk_knowledge (geniza) base backup  — newest mk_knowledge-*.dump under PRIMARY_DEST
//   2. neo4j graph backup                 — newest neo4j-*.dump under PRIMARY_DEST (R-110: the ONLY
//                                            copy of 9,877 Module nodes that exist nowhere else)
//   3. WAL archive lag                    — newest file under ARCHIVE_DEST (scripts/enable-wal-
//                                            archiving.ps1's destination), which should never be more
//                                            than a few archive_timeout intervals stale once enabled
//
// RED + COUNTER-RED (task-7-brief.md item 4, both required, both below):
//   - a fresh backup passes IN SILENCE (single OK line, exit 0) — see the "no news" test in
//     scripts/tests/test-check-backup-fresh.mjs
//   - a STALE backup, or a destination that exists but holds no backup at all, FAILS loudly
//   - a MISSING DRIVE — the destination's drive letter is not mounted — SKIPS with a stated reason,
//     never fails. F: is meant to be disconnected sometimes (backup-stores.ps1's own header); this
//     gate must not teach "keep F: plugged in forever" as the fix for what is working as designed.
//     The SAME rule applies to G:'s WAL archive specifically before scripts/enable-wal-archiving.ps1
//     has ever been run — an unenabled feature is an unmet precondition, not a compliance finding.
//
// GATE SCOPING (per check-meta.mjs's own header, which this gate must justify itself against):
// BLOCKING once the destination drive is present, because the remedy is one reachable command
// (`powershell scripts\backup-stores.ps1`, or for archive lag, `powershell scripts\enable-wal-
// archiving.ps1` — elevated, the owner's to run) — the same "is the fix cheap and reachable" test
// check-geniza-fresh's header applies to itself. SKIPS rather than blocks when the destination drive
// itself is absent (CI has no G:\ or F:\ at all — an infra absence, not a compliance finding, same
// reasoning check-rules-fresh and check-state-fresh already apply to their own dependencies).
//
// Env overrides (self-test fixtures only): PRIMARY_DEST=<dir>, ARCHIVE_DEST=<dir>,
// MAX_BACKUP_AGE_HOURS=<n> (default 48 — the exact age R-111 found and flagged as too old),
// MAX_ARCHIVE_LAG_MINUTES=<n> (default 20 — 4x enable-wal-archiving.ps1's archive_timeout of 5min).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';

const PRIMARY_DEST = process.env.PRIMARY_DEST || 'G:\\matconetesh-backups';
const ARCHIVE_DEST = process.env.ARCHIVE_DEST || 'G:\\pg-wal-archive';
const MAX_BACKUP_AGE_HOURS = Number(process.env.MAX_BACKUP_AGE_HOURS || 48);
const MAX_ARCHIVE_LAG_MINUTES = Number(process.env.MAX_ARCHIVE_LAG_MINUTES || 20);

function driveRoot(path) {
  const q = parse(path).root; // e.g. "G:\\"
  return q || null;
}

function driveMounted(path) {
  const root = driveRoot(path);
  if (!root) return false;
  try { return existsSync(root); } catch { return false; }
}

// Newest file matching a glob-ish prefix/suffix under dir, or null if none / dir absent.
function newestMatch(dir, prefix, suffix) {
  if (!existsSync(dir)) return null;
  let entries;
  try { entries = readdirSync(dir); } catch { return null; }
  let best = null;
  for (const name of entries) {
    if (prefix && !name.startsWith(prefix)) continue;
    if (suffix && !name.endsWith(suffix)) continue;
    let st;
    try { st = statSync(join(dir, name)); } catch { continue; }
    if (!st.isFile()) continue;
    if (!best || st.mtimeMs > best.mtimeMs) best = { name, mtimeMs: st.mtimeMs };
  }
  return best;
}

function ageHours(mtimeMs) { return (Date.now() - mtimeMs) / 3_600_000; }
function ageMinutes(mtimeMs) { return (Date.now() - mtimeMs) / 60_000; }

const problems = [];
const skips = [];
const oks = [];

// ---- 1 & 2: base backups (mk_knowledge, neo4j) on PRIMARY_DEST ----
if (!driveMounted(PRIMARY_DEST)) {
  skips.push(`primary destination drive (${driveRoot(PRIMARY_DEST) ?? PRIMARY_DEST}) is not mounted — cannot check base-backup freshness. Expected on this machine; only a real finding if it should be attached and is not.`);
} else {
  for (const [label, prefix, patchName] of [
    ['mk_knowledge (geniza) base backup', 'mk_knowledge-', 'powershell scripts\\backup-stores.ps1'],
    ['neo4j graph backup (R-110: the only copy of Module nodes)', 'neo4j-', 'powershell scripts\\backup-stores.ps1 -GraphOnly'],
  ]) {
    const hit = newestMatch(PRIMARY_DEST, prefix, '.dump');
    if (!hit) {
      problems.push(`${label}: no ${prefix}*.dump exists under ${PRIMARY_DEST} at all. Fix: ${patchName}`);
      continue;
    }
    const hours = ageHours(hit.mtimeMs);
    if (hours > MAX_BACKUP_AGE_HOURS) {
      problems.push(`${label}: newest is ${hit.name}, ${hours.toFixed(1)}h old (limit ${MAX_BACKUP_AGE_HOURS}h). Fix: ${patchName}`);
    } else {
      oks.push(`${label}: ${hit.name} (${hours.toFixed(1)}h old)`);
    }
  }
}

// ---- 3: WAL archive lag on ARCHIVE_DEST ----
if (!driveMounted(ARCHIVE_DEST)) {
  skips.push(`WAL archive drive (${driveRoot(ARCHIVE_DEST) ?? ARCHIVE_DEST}) is not mounted — cannot check archive lag.`);
} else if (!existsSync(ARCHIVE_DEST)) {
  skips.push(`WAL archive directory (${ARCHIVE_DEST}) does not exist yet — scripts/enable-wal-archiving.ps1 (elevated, owner's to run) has not been run on this machine. Not a compliance finding until it has been enabled at least once.`);
} else {
  const hit = newestMatch(ARCHIVE_DEST, '', '');
  if (!hit) {
    problems.push(`WAL archive directory (${ARCHIVE_DEST}) exists but holds no archived WAL file. Either archiving was just enabled and no segment has switched yet (wait ${MAX_ARCHIVE_LAG_MINUTES}min and re-run), or archive_command is failing — check pg_stat_archiver.failed_count. Fix: see scripts/enable-wal-archiving.ps1's own verification output.`);
  } else {
    const minutes = ageMinutes(hit.mtimeMs);
    if (minutes > MAX_ARCHIVE_LAG_MINUTES) {
      problems.push(`WAL archive lag: newest archived file ${hit.name} is ${minutes.toFixed(1)}min old (limit ${MAX_ARCHIVE_LAG_MINUTES}min). A failing archive_command STOPS PostgreSQL from recycling WAL — this is not cosmetic staleness. Check the PostgreSQL log and pg_stat_archiver.last_failed_wal / last_failed_time.`);
    } else {
      oks.push(`WAL archive: newest ${hit.name} (${minutes.toFixed(1)}min old)`);
    }
  }
}

for (const s of skips) console.log(`SKIP - ${s}`);
for (const o of oks) console.log(`  ok: ${o}`);

if (problems.length) {
  console.error(`FAIL: check-backup-fresh — ${problems.length} finding(s):`);
  for (const p of problems) console.error(`  ~ ${p}`);
  process.exit(1);
}
if (!oks.length && skips.length) {
  console.log('OK - nothing was checkable on this machine right now (all destinations skipped for a stated reason above); not a failure.');
  process.exit(0);
}
console.log(`OK - ${oks.length} freshness check(s) passed.`);
