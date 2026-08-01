#!/usr/bin/env node
// scripts/session-brief.mjs — the map next to the smoke detector.
//
// check-meta.mjs is a COMPLIANCE GATE: it answers "is the repo in a state that violates a rule?"
// It never answers "where are we?" — and compaction is exactly the moment that question loses its
// answer, because the in-flight task, the owner-pending decisions, and the last-shipped version all
// live in conversational working memory that compaction erases. COMPLIANCE-AUDIT-2026-08-01.md's
// whole day of drift had that shape: gates were green (or wrongly believed to be), but nobody could
// say what was in flight or what the board actually claimed vs. what git actually shipped.
//
// This script is the fix for THAT gap, not a replacement for check-meta.mjs. It is read-only,
// fast, and best-effort: every fact is derived from files/git actually present in the repo, and any
// fact this script cannot establish is printed as "not established" rather than guessed. It must
// NEVER fail the session — any error anywhere is caught, printed as a warning, and this still
// exits 0. Orientation is not a gate; the gate already exists (check-meta.mjs) and is a separate
// concern deliberately not duplicated here (see "standing debt" below — count only, not detail).
//
// Wired into .claude/settings.json's SessionStart hook (matcher startup|resume|compact), alongside
// check-meta.mjs, and reachable on demand via /status (see .claude/commands/status.md).
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NA = 'not established';

function safe(label, fn) {
  try { return fn(); } catch (e) { return `${NA} (${label}: ${e.message.split('\n')[0].slice(0, 120)})`; }
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

// ---------------------------------------------------------------------------
// 1) LIVE VERSION vs BOARD BASELINE — the mismatch itself is the finding (H10 / audit fix #3).
// ---------------------------------------------------------------------------
function liveVsBoard() {
  const log = git(['log', '--format=%h\x01%cI\x01%s', '-n', '1000']);
  const releases = log.split('\n').filter(Boolean).map(l => l.split('\x01'))
    .filter(([, , subj]) => /^release\(v\d+\)/.test(subj));
  if (!releases.length) return `LIVE: ${NA} — no release(v commit found in the last 1000 commits.`;
  // newest = highest vNNN, not just first-in-log (log order == commit order here, but be explicit).
  releases.sort((a, b) => Number(b[2].match(/v(\d+)/)[1]) - Number(a[2].match(/v(\d+)/)[1]));
  const [hash, date, subj] = releases[0];
  const vNum = Number(subj.match(/v(\d+)/)[1]);

  const board = readText(join(ROOT, 'docs', 'STATUS-BOARD.md'));
  if (board === null) return `LIVE: v${vNum} (${hash}, ${date.slice(0, 16)}) · board: ${NA} — docs/STATUS-BOARD.md not found.`;
  const m = board.match(/בסיס:\s*v(\d+)/);
  if (!m) return `LIVE: v${vNum} (${hash}, ${date.slice(0, 16)}) · board declares baseline: ${NA} — no "בסיס: vNNN" header.`;
  const boardV = Number(m[1]);
  const verdict = boardV === vNum ? 'MATCH' : `MISMATCH — board is ${vNum - boardV} version(s) behind what shipped`;
  return `LIVE: v${vNum} (${hash}, ${date.slice(0, 16)}) · board declares בסיס: v${boardV} — ${verdict}`;
}

// ---------------------------------------------------------------------------
// 2) POSITION — active phase + task counts, as the board's phase table records them.
// A row's note/הערה cell can legitimately overflow into further physical lines (seen live in this
// board), but Phase/שם/משימות/סטטוס are always on the row's OPENING line — only that line is parsed.
// ---------------------------------------------------------------------------
function position() {
  const board = readText(join(ROOT, 'docs', 'STATUS-BOARD.md'));
  if (board === null) return `POSITION: ${NA} — docs/STATUS-BOARD.md not found.`;
  const lines = board.split('\n');
  let active = null;
  for (const line of lines) {
    if (!/^\|\s*(Phase\b|Planning arc|Language Thread|Sync Thread)/.test(line)) continue;
    const cells = line.split('|').map(s => s.trim());
    // cells[0] is '' (leading pipe); [1]=Phase, [2]=שם, [3]=משימות, [4]=סטטוס
    if (cells[4] && cells[4].startsWith('🔄')) { active = cells; break; }
  }
  const totalsBlock = board.split(/^## סך הפרויקט/m)[1] ?? '';
  const tasksLine = totalsBlock.match(/\|\s*משימות\s*\|\s*\*\*([^*]+)\*\*/);
  const gapsLine = totalsBlock.match(/\|\s*פערים[^|]*\|\s*\*\*([^*]+)\*\*/);
  const proj = [
    tasksLine ? `project ${tasksLine[1].trim()} tasks` : null,
    gapsLine ? `gaps ${gapsLine[1].trim()}` : null,
  ].filter(Boolean).join(' · ') || NA;
  if (!active) return `POSITION: no phase marked 🔄 (active) on the board · ${proj}`;
  return `POSITION: ${active[1]} — ${active[2]} (${active[3]}) 🔄 · ${proj}`;
}

// ---------------------------------------------------------------------------
// 3) DECISIONS AWAITING OWNER — ROADMAP + board rows marked as needing a ruling, and NOT already
// resolved in the same line (a ✅ next to GO/הוכרע/אושר/CLOSED means the ruling already landed —
// e.g. R-37 says "החלטת בעלים נדרשת" in its problem description but its own ruling cell has
// "✅ GO — פסק בעלים 31.7"; that is a closed decision, not an open one).
// ---------------------------------------------------------------------------
function decisionsAwaitingOwner() {
  const files = [
    join(ROOT, 'docs', 'ROADMAP-2026-07-30.md'),
    join(ROOT, 'docs', 'STATUS-BOARD.md'),
  ].filter(existsSync);
  if (!files.length) return { line: `DECISIONS AWAITING OWNER: ${NA} — no ROADMAP/board file found.`, ids: [] };

  // A ledger/decision-register row's own ID is its FIRST table cell (never scanned for an id
  // anywhere else in the row's text — a description cell can legitimately reference OTHER ids,
  // e.g. BR-2's text mentions "(R-6)" in passing; that must not be misread as R-6's own row).
  const ROW_ID = /^\|\s*((?:R|BR)-\d+)\s*\|/;
  const MARKERS = /(החלטת בעלים(?:\s+נדרשת)?|ממתין להכרעה)/;
  const RESOLVED = /✅[^\n]*(GO|הוכרע|אושר|CLOSED|בוצע)/;

  const found = new Map(); // id -> snippet
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const line of text.split('\n')) {
      const idm = line.match(ROW_ID);
      if (!idm) continue;
      if (!MARKERS.test(line) || RESOLVED.test(line)) continue; // no open decision marker, or already ruled on the same line
      if (!found.has(idm[1])) found.set(idm[1], line.replace(/[*`|]/g, '').trim().slice(0, 90));
    }
  }
  const ids = [...found.keys()];
  if (!ids.length) return { line: 'DECISIONS AWAITING OWNER: 0 found (ROADMAP + board scanned).', ids };
  const preview = ids.slice(0, 4).map(id => `${id} (${found.get(id).slice(0, 50)}…)`).join(' · ');
  const more = ids.length > 4 ? ` · +${ids.length - 4} more` : '';
  return { line: `DECISIONS AWAITING OWNER: ${ids.length} — ${preview}${more}`, ids };
}

// ---------------------------------------------------------------------------
// 4) IN FLIGHT — the last few commits, briefly, so the agent sees what it was just doing.
// ---------------------------------------------------------------------------
function inFlight(n = 5) {
  const log = git(['log', '--format=%h %s', '-n', String(n)]);
  if (!log) return `IN FLIGHT: ${NA} — no commits.`;
  const lines = log.split('\n').map(l => '  ' + (l.length > 100 ? l.slice(0, 97) + '...' : l));
  return `IN FLIGHT (last ${n} commits):\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// 5) NEXT — the board's own declared next step (its final footer line, "**הבא:**").
// ---------------------------------------------------------------------------
function nextStep() {
  const board = readText(join(ROOT, 'docs', 'STATUS-BOARD.md'));
  if (board === null) return `NEXT: ${NA} — docs/STATUS-BOARD.md not found.`;
  const m = board.match(/\*\*הבא:\*\*\s*([^*\n][^*]*)/);
  if (!m) return `NEXT: ${NA} — no "**הבא:**" line found on the board.`;
  return `NEXT (per board): ${m[1].trim().replace(/\.$/, '')}`;
}

// ---------------------------------------------------------------------------
// 6) STANDING DEBT — count only. The gate (check-graph-fresh / check-brief / check-h9, all inside
// check-meta.mjs) already prints the per-item detail; repeating it here buries the map in noise.
// Cheap local proxy, same signal as check-graph-fresh's local mode: docs newer than the graph
// build stamp, by mtime — plus the size of the frozen grandfather baseline (gate-baselines.json),
// which is the other standing-debt population the gates track but never re-surface loudly.
// ---------------------------------------------------------------------------
function standingDebt() {
  const parts = [];
  try {
    const graphPath = join(ROOT, 'graphify-out', 'graph.json');
    if (existsSync(graphPath)) {
      const stamp = statSync(graphPath).mtimeMs;
      let stale = 0;
      const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith('.md') && statSync(p).mtimeMs > stamp) stale++;
        }
      };
      walk(join(ROOT, 'docs'));
      parts.push(`${stale} doc(s) newer than the graph`);
    } else {
      parts.push('graph: not built (graphify-out/graph.json missing)');
    }
  } catch (e) { parts.push(`graph check: ${NA} (${e.message.split('\n')[0].slice(0, 60)})`); }

  try {
    const baselinePath = join(ROOT, 'docs', 'process', 'gate-baselines.json');
    if (existsSync(baselinePath)) {
      const j = JSON.parse(readFileSync(baselinePath, 'utf8'));
      const n = (j.brief?.length ?? 0) + (j.report?.length ?? 0);
      parts.push(`${n} grandfathered baseline item(s)`);
    }
  } catch { /* optional, skip silently — not the primary signal */ }

  return `STANDING DEBT: ${parts.join(' · ')} (detail: check-meta.mjs)`;
}

// ---------------------------------------------------------------------------
function main() {
  const lines = [
    '=== session-brief (where are we?) ===',
    safe('live-vs-board', liveVsBoard),
    safe('position', position),
  ];
  const decisions = safe('decisions', () => decisionsAwaitingOwner());
  lines.push(typeof decisions === 'string' ? decisions : decisions.line);
  lines.push(safe('in-flight', () => inFlight(5)));
  lines.push(safe('next', nextStep));
  lines.push(safe('standing-debt', standingDebt));
  console.log(lines.join('\n'));
}

try {
  main();
} catch (e) {
  console.log(`session-brief: WARN — could not build the digest (${e.message.split('\n')[0]}). Orientation skipped; the compliance gate (check-meta.mjs) is unaffected.`);
}
process.exit(0);
