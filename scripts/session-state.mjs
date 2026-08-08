#!/usr/bin/env node
// scripts/session-state.mjs — what has to survive `compact`, and doesn't unless something derives
// it fresh from disk every time. See .superpowers/sdd/2026-08-07-enforcement-phase-3-group-a/task-1-brief.md.
//
// THE ONE RULE THAT GOVERNS EVERY LINE: at the moment this runs there is NO conversational memory.
// Every field below is DERIVED from an artifact actually on disk — a ledger, a plan, `git log`, the
// register, a spec — never hardcoded, never assumed, never carried over from a previous run. Where a
// source is missing or ambiguous, the field says so in words ("not established") rather than guess.
// A confident wrong answer here is worse than an absent one: it points the next hours of work in the
// wrong direction, which is the exact failure this script exists to prevent (owner, 2026-08-07:
// compact announced "Phase 2 — גל 0" while two days had gone into an unrelated enforcement arc).
//
// Read-only, fast, best-effort — same contract as session-brief.mjs: any error anywhere is caught,
// printed as a warning for that field only, and the script still exits 0. Orientation is not a gate.
//
// Exports (activeArc, ledgerPosition, planCounts) are consumed by session-brief.mjs so its POSITION
// field can prefer the active ledger over the board without duplicating the "which ledger is active"
// logic a second time (see scripts/lib/register-scan.mjs's header for why duplication is the failure
// class being avoided here).
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDecisionsAwaitingOwner } from './lib/register-scan.mjs';
import { openState as openEnforcementState, openTargets, eventCountSince, lastEvent } from './hooks/lib/enforcement-state.mjs';
import { ATTEMPT_THRESHOLD } from './hooks/rules/fix-cycle-limit.mjs';
import { sessionLessonGate } from './gate-lessons.mjs';

// SESSION_STATE_ROOT lets a self-test point plan-path resolution at a disposable fixture tree
// instead of the real repo (ledgers store plan paths repo-relative, e.g.
// "docs/superpowers/plans/x.md" — resolving that path needs to know which repo root it's relative
// to). Unset in normal operation, so production behavior is unchanged.
const ROOT = process.env.SESSION_STATE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const NA = 'not established';

// Env overrides — self-test fixtures only; unset in normal operation, so production behavior is
// unchanged. Mirrors the pattern session-brief.mjs already uses for BOARD/ROADMAP.
const SDD_DIR = process.env.SDD_DIR || join(ROOT, '.superpowers', 'sdd');
const ROADMAP = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const SPECS_DIR = process.env.SPECS_DIR || join(ROOT, 'docs', 'superpowers', 'specs');
const BOARD = process.env.BOARD || join(ROOT, 'docs', 'STATUS-BOARD.md');
const GITROOT = process.env.GITROOT || ROOT;
const WATCHMAN_LOG = process.env.WATCHMAN_LOG || join(ROOT, '.superpowers', 'watchman-log.jsonl');
// Self-test-only override: production sources session_id from the real SessionStart hook payload on
// stdin (see resolveSessionId() below); this lets a fixture pin one without needing to actually pipe
// JSON through spawnSync.
const SESSION_ID_OVERRIDE = process.env.SESSION_STATE_SESSION_ID || null;

function safe(label, fn) {
  try { return fn(); } catch (e) { return `${NA} (${label}: ${e.message.split('\n')[0].slice(0, 120)})`; }
}

// ---------------------------------------------------------------------------
// 1) ACTIVE ARC — the most recently *modified* ledger under .superpowers/sdd/*/progress.md.
// Recency of the ledger file itself is the signal, deliberately preferred over any hardcoded name
// or list: the ledger a controller is actively appending to is, by construction, the one it just
// wrote to. A directory name alone (e.g. containing today's date) is not trusted — several arcs can
// share a date, and only mtime says which one is actually being worked.
// ---------------------------------------------------------------------------
export function findLedgers() {
  if (!existsSync(SDD_DIR)) return [];
  const out = [];
  for (const entry of readdirSync(SDD_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = join(SDD_DIR, entry.name, 'progress.md');
    if (existsSync(p)) out.push({ dir: entry.name, path: p, mtime: statSync(p).mtimeMs });
  }
  return out;
}

export function activeArc() {
  const ledgers = findLedgers();
  if (!ledgers.length) {
    return {
      // Item 8: no active arc determinable at all -> a PROMINENT statement, not a quiet "unknown".
      // A confident wrong answer would be worse, but so is a quiet absent one at exactly the moment
      // a controller is deciding what to do next after compact.
      line: `⚠️ ACTIVE ARC: NONE FOUND — no .superpowers/sdd/<plan>/progress.md ledger exists under ${SDD_DIR}.\n` +
            '⚠️ NO TASK SHOULD BE STARTED UNTIL A HUMAN DECIDES what the active arc is. This is not "unknown" — it is an explicit stop.',
      ledger: null, planPath: null, planRel: null,
    };
  }
  ledgers.sort((a, b) => b.mtime - a.mtime);
  const top = ledgers[0];
  const text = readFileSync(top.path, 'utf8');
  const firstLine = (text.split('\n')[0] || '').trim();
  const m = firstLine.match(/plan:\s*(\S+\.md)/);
  const mtimeStr = new Date(top.mtime).toISOString().slice(0, 16);
  if (!m) {
    return {
      line: `ACTIVE ARC: ${top.dir} (ledger newest-modified ${mtimeStr}) — plan name NOT FOUND on the ledger's first line ("${firstLine.slice(0, 90)}"); ${NA}.`,
      ledger: top, planPath: null, planRel: null,
    };
  }
  const planRel = m[1];
  const planPath = join(ROOT, planRel);
  const planNote = existsSync(planPath) ? '' : ' — plan file MISSING on disk';
  return {
    line: `ACTIVE ARC: ${top.dir} — plan ${planRel} (ledger newest-modified ${mtimeStr})${planNote}`,
    ledger: top, planPath: existsSync(planPath) ? planPath : null, planRel,
  };
}

// ---------------------------------------------------------------------------
// 1b) CONTRADICTION CHECK (item 8) — when the board ALSO claims a phase is active (🔄), and that
// claim shares no meaningful token with the active ledger's own plan/directory name, this is not
// resolved by silently trusting the ledger (which the rest of this file does, because the ledger is
// the freshest on-disk evidence). It is DECLARED — both claims are printed side by side — so a human
// or agent sees the disagreement rather than a single confident answer that quietly buried the
// other source. This is the exact shape of the live bug that started this task: the board said
// "Phase 2 — גל 0" while the real work was two days into an unrelated enforcement arc.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set(['של', 'עם', 'את', 'על', 'זה', 'the', 'and', 'for', 'with']);
function tokens(s) {
  return (s || '')
    .split(/[^\p{L}\p{N}]+/u)
    .map(t => t.toLowerCase())
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

export function contradictionCheck(arc) {
  if (!arc.ledger) return null; // nothing to contradict — activeArc() already declares "no arc"
  const board = existsSync(BOARD) ? readFileSync(BOARD, 'utf8') : null;
  if (board === null) return null; // no board -> nothing to compare against, not a contradiction
  let activeCells = null;
  for (const line of board.split('\n')) {
    if (!/^\|\s*\*{0,2}\s*(Phase|Planning arc|Language Thread|Sync Thread)/.test(line)) continue;
    const cells = line.split('|').map(s => s.trim());
    if (cells[4] && cells[4].startsWith('🔄')) { activeCells = cells; break; }
  }
  if (!activeCells) return null; // board names no active phase -> nothing to contradict
  const boardName = activeCells[1] + ' ' + activeCells[2];
  const ledgerTokens = new Set([...tokens(arc.ledger.dir), ...tokens(arc.planRel || '')]);
  const boardTokens = tokens(boardName);
  const overlap = boardTokens.some(t => ledgerTokens.has(t));
  if (overlap) return null; // shares at least one real token — not treated as a contradiction
  return `⚠️ CONTRADICTION: the board claims "${boardName.trim()}" is active (🔄), but the most-recently-modified ledger is "${arc.ledger.dir}" (plan ${arc.planRel ?? NA}) — they share no common term.\n` +
    '   Trusting the LEDGER below (freshest artifact on disk, §10.13 layer 1) — but this disagreement was not resolved by this script and should be, by a human.';
}

// ---------------------------------------------------------------------------
// 2) POSITION WITHIN THE ARC — last "Task N: complete..." line recorded in the ledger, plus any
// deferral recorded with a trigger (the ledger's own convention: "deferred, trigger = ..."). Both
// read from the ledger text only — nothing here is inferred from the plan or the board.
// ---------------------------------------------------------------------------
export function ledgerPosition(ledgerPath) {
  const text = readFileSync(ledgerPath, 'utf8');
  const lines = text.split('\n');
  let lastComplete = null;
  let arcComplete = false;
  for (const line of lines) {
    if (/^ARC COMPLETE/.test(line.trim())) { arcComplete = true; lastComplete = line.trim().slice(0, 160); continue; }
    const m = line.match(/^(Task\s+[\w.]+|R-\d+[^:]*):\s*(complete[^\n]*)/i);
    if (m) lastComplete = `${m[1]}: ${m[2]}`.trim().slice(0, 160);
  }
  const deferrals = [];
  for (const line of lines) {
    if (/deferred/i.test(line) && /trigger/i.test(line)) deferrals.push(line.trim().slice(0, 200));
  }
  return { lastComplete, arcComplete, deferrals };
}

// ---------------------------------------------------------------------------
// 3) PLAN COUNTS — how many `- [ ]` boxes remain in the plan the active ledger names, and how many
// `## Task N` headers the plan declares in total. This is the ledger's own claim cross-checked
// against the plan file, not a second, independently-hardcoded task count.
// ---------------------------------------------------------------------------
export function planCounts(planPath) {
  if (!planPath || !existsSync(planPath)) return null;
  const text = readFileSync(planPath, 'utf8');
  const total = (text.match(/^\s*-\s*\[[ xX]\]/gm) || []).length;
  const remaining = (text.match(/^\s*-\s*\[ \]/gm) || []).length;
  const taskHeaders = (text.match(/^##\s*Task\s+\S+/gm) || []).length;
  return { total, remaining, taskHeaders };
}

// ---------------------------------------------------------------------------
// 4) WHAT ACTUALLY LANDED — git log since the arc began, so this comes from commits rather than
// from any report's claim. "Arc began" is anchored on the plan file's own first ("A"dded) commit
// when the plan is tracked in git; when it isn't yet (a brand-new plan/ledger pair, as at the
// moment this very task was dispatched — verified: the plan file was untracked when this was
// written), the ledger file's own mtime is the fallback anchor, and the field SAYS which one it
// used rather than silently picking one.
// ---------------------------------------------------------------------------
export function landedSinceArcStart(planRel, ledgerMtimeMs) {
  let sinceISO = null;
  let sourceNote = null;
  if (planRel) {
    try {
      const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%aI', '--', planRel], { cwd: GITROOT, encoding: 'utf8' }).trim();
      const adds = out.split('\n').filter(Boolean);
      if (adds.length) { sinceISO = adds[adds.length - 1]; sourceNote = `plan's first commit (${planRel})`; }
    } catch { /* git unavailable or path issue — fall through to the mtime anchor */ }
  }
  if (!sinceISO && ledgerMtimeMs) {
    sinceISO = new Date(ledgerMtimeMs).toISOString();
    sourceNote = "plan not yet committed to git — using the ledger file's own mtime as the arc-start anchor";
  }
  if (!sinceISO) return `LANDED SINCE ARC START: ${NA} — no plan commit and no ledger to anchor on.`;
  try {
    const log = execFileSync('git', ['log', `--since=${sinceISO}`, '--format=%h %s'], { cwd: GITROOT, encoding: 'utf8' }).trim();
    if (!log) return `LANDED SINCE ARC START (${sourceNote}, since ${sinceISO.slice(0, 16)}): 0 commits.`;
    const commits = log.split('\n');
    const preview = commits.slice(0, 8).map(l => '  ' + (l.length > 100 ? l.slice(0, 97) + '...' : l)).join('\n');
    const more = commits.length > 8 ? `\n  ... +${commits.length - 8} more` : '';
    return `LANDED SINCE ARC START (${sourceNote}, since ${sinceISO.slice(0, 16)}): ${commits.length} commit(s)\n${preview}${more}`;
  } catch (e) {
    return `LANDED SINCE ARC START: ${NA} — git log failed (${e.message.split('\n')[0].slice(0, 100)}); git may be unavailable here.`;
  }
}

// ---------------------------------------------------------------------------
// 5) WHAT'S WAITING ON THE OWNER — register rows (R-/BR-) whose own status cell has not yet ruled.
// Shared logic with session-brief.mjs's DECISIONS AWAITING OWNER, via scripts/lib/register-scan.mjs.
// ---------------------------------------------------------------------------
export function decisionsAwaitingOwner() {
  return scanDecisionsAwaitingOwner([ROADMAP], 'WAITING ON OWNER (register)');
}

// ---------------------------------------------------------------------------
// 6) GOVERNING SPEC — the newest-modified file under docs/superpowers/specs/. Plans expire (a task
// gets reassigned, reordered, dropped); the spec that authorized the arc is what still binds.
// ---------------------------------------------------------------------------
export function governingSpec() {
  if (!existsSync(SPECS_DIR)) return `GOVERNING SPEC: ${NA} — ${SPECS_DIR} not found.`;
  const files = readdirSync(SPECS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ f, m: statSync(join(SPECS_DIR, f)).mtimeMs }));
  if (!files.length) return `GOVERNING SPEC: ${NA} — no .md files under ${SPECS_DIR}.`;
  files.sort((a, b) => b.m - a.m);
  return `GOVERNING SPEC: ${files[0].f} (newest-modified ${new Date(files[0].m).toISOString().slice(0, 16)})`;
}

// ---------------------------------------------------------------------------
// 7) LAYER 2 — THE GENIZA, AFTER STATE IS SET, NEVER INSTEAD OF IT (item 6, §10.13). Layer 1 above
// is a state question (one right answer, derived from files). This is a knowledge question (several
// good answers), so it runs SECOND and its only job is to surface the arc's own decisions/
// constraints — owner rulings and register rows — that layer 1's file-reads cannot see because they
// live in prose, not in a ledger line. Measured 2026-08-07: a vague natural-language question
// ("what is the active arc") returned app.js three times via semantic_search — a category mismatch,
// not a geniza failure — so this queries LEXICALLY (search_current_docs, not semantic_search) with a
// term DERIVED from the ledger's own directory name (the one concrete, on-disk noun layer 1 already
// established), scoped to the register document specifically.
// Access is exclusively through src.knowledge.retrieval's parametric functions — no free SQL, per
// CLAUDE.md's "שש פעולות פרמטריות בלבד". Degrades to a stated "not available" on ANY failure (no
// Python, no DB, no rows) — layer 1 never depends on this succeeding.
// ---------------------------------------------------------------------------
export function genizaLayer2(arc) {
  if (!arc || !arc.ledger) return 'LAYER 2 (geniza): skipped — no active arc to query constraints for.';
  const query = tokens(arc.ledger.dir).join(' ');
  if (!query) return 'LAYER 2 (geniza): skipped — no usable search term derived from the ledger name.';
  const PY = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
try:
    from src.knowledge import retrieval
    hits = retrieval.search_current_docs(
        ${JSON.stringify(query)},
        filters={"namespace": "repo", "document_path": "docs/ROADMAP-2026-07-30.md"},
        limit=5,
    )
    out = [{"heading": h.get("heading_path"), "excerpt": (h.get("excerpt") or "")[:200],
            "source_path": h.get("source_path"), "revision_id": str(h.get("revision_id"))} for h in hits]
    print(json.dumps({"ok": True, "hits": out}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)[:200]}))
`;
  const CANDIDATES = [['python', []], ['py', ['-3']], ['python3', []]];
  const STORE_STUB = /Python was not found|Microsoft Store/i;
  for (const [cmd, pre] of CANDIDATES) {
    let r;
    try {
      r = execFileSync(cmd, [...pre, '-c', PY], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    } catch (e) {
      const text = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      if (STORE_STUB.test(text)) continue; // Windows Store alias stub — try the next candidate
      continue; // this interpreter failed to run at all — try the next candidate
    }
    if (STORE_STUB.test(r)) continue;
    let parsed;
    try { parsed = JSON.parse(r.trim().split('\n').pop()); }
    catch { return `LAYER 2 (geniza): not available — ${cmd} ran but did not return parseable JSON.`; }
    if (!parsed.ok) return `LAYER 2 (geniza): not available — ${parsed.error ?? 'unknown error'} (query: "${query}").`;
    if (!parsed.hits.length) return `LAYER 2 (geniza): 0 matches for "${query}" in the register (search_current_docs, lexical). Layer 1 stands alone.`;
    const lines = parsed.hits.map(h => `  - ${h.heading || h.source_path}: ${h.excerpt.replace(/\n/g, ' ')} [revision ${h.revision_id}]`);
    return `LAYER 2 (geniza) — decisions/constraints matching "${query}" in the register:\n${lines.join('\n')}`;
  }
  return 'LAYER 2 (geniza): not available — no Python interpreter could be run here. Layer 1 (above) stands alone.';
}

// ---------------------------------------------------------------------------
// 8) ENFORCEMENT STATE (§6.2) — the piece SessionStart was missing: it already re-reads the RULES
// on every compact, but not the STATE. The §5 fix-cycle counter and §10.16 failure count both
// survive in Task 2's SQLite store; the KNOWLEDGE of them does not survive compact on its own. This
// reads that SAME store the blocking rule (fix-cycle-limit.mjs) reads, at announce time — no
// caching, no second source of truth, and the "N of 3" denominator is literally that rule's own
// exported ATTEMPT_THRESHOLD, not a re-typed "3" that could drift.
//
// infra line: reads watchman's OWN last-verdict-per-component from .superpowers/watchman-log.jsonl
// (Phase 2's layer 0) — never probes live itself; probing at SessionStart is watchman's job, already
// wired into the same SessionStart hook.
//
// Fail-soft contract, same as every other section here: any failure to read the state store
// degrades to an explicit "state store unreadable — counters unknown, not asserted" line (never a
// thrown exception, never a silent zero that could be misread as "nothing open").
// ---------------------------------------------------------------------------
const INFRA_COMPONENTS = [
  { key: 'geniza-postgres', label: 'geniza' },
  { key: 'rules-mirror', label: 'rules mirror' },
  { key: 'serena', label: 'serena' },
];

export function infraStatus(watchmanLogPath = WATCHMAN_LOG) {
  let text;
  try {
    text = readFileSync(watchmanLogPath, 'utf8');
  } catch (e) {
    return { ok: false, text: `not available — ${watchmanLogPath} unreadable (${e.message.split('\n')[0].slice(0, 100)})` };
  }
  // Last record wins per component name — watchman appends one JSON line per component per run, in
  // run order, so the last occurrence in the file IS the newest verdict (no timestamp comparison
  // needed, and none trusted over file order in case two runs share a timestamp).
  const latest = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; } // one malformed line must not break the rest
    if (rec && typeof rec.Name === 'string') latest.set(rec.Name, rec);
  }
  const parts = [];
  let ok = true;
  for (const c of INFRA_COMPONENTS) {
    const rec = latest.get(c.key);
    if (!rec) { parts.push(`${c.label} UNKNOWN ⚠`); ok = false; continue; }
    const componentOk = rec.FinalOk === true;
    if (!componentOk) ok = false;
    parts.push(`${c.label} ${componentOk ? 'OK' : 'DISCONNECTED ⚠'}`);
  }
  return { ok, text: parts.join(' · ') };
}

export function enforcementState(sessionId) {
  let db;
  try { db = openEnforcementState(); } catch { db = null; }
  if (!db) {
    return 'ENFORCEMENT STATE: state store unreadable — counters unknown, not asserted';
  }

  let targets;
  let failuresThisArc;
  let failuresSinceLastCommit;
  try {
    targets = sessionId ? openTargets(db, sessionId) : [];
    failuresThisArc = sessionId ? eventCountSince(db, sessionId, 'verification_failure', 0) : 0;
    const lastCommit = sessionId ? lastEvent(db, sessionId, 'commit') : null;
    failuresSinceLastCommit = sessionId
      ? eventCountSince(db, sessionId, 'verification_failure', lastCommit?.ts ?? 0)
      : 0;
  } catch {
    try { db.close(); } catch { /* best-effort */ }
    return 'ENFORCEMENT STATE: state store unreadable — counters unknown, not asserted';
  }
  try { db.close(); } catch { /* best-effort */ }

  // §6.1: a target's FIRST recorded failure is not yet a closed fix cycle (it becomes one only once
  // an edit follows it) — so a target sitting at attempts=0 is not yet a meaningful counter to
  // announce; showing it would be exactly the "wall of zeroes" this section exists to avoid.
  const openCycles = targets.filter((t) => t.attempts > 0);
  const infra = infraStatus();

  const nothingToReport = openCycles.length === 0 && failuresThisArc === 0 && infra.ok;
  if (nothingToReport) {
    // Item 2: when every counter is zero and infra is healthy, ONE short line — a wall of zeroes
    // trains people to skip the section, which makes the section useless the one time it isn't zero.
    return 'ENFORCEMENT STATE: no open counters, no uncovered failures.';
  }

  const lines = ['=== ENFORCEMENT STATE, restored after compact ==='];
  if (openCycles.length) {
    for (const t of openCycles) {
      // "4 of 3" is what a bare count prints once the ceiling is passed, and it reads as a bug in the
      // one announcement that has to be trusted on sight. At or past the ceiling, say what is true and
      // what it means instead: the next edit on this target is blocked, which is the fact the reader
      // needs before they try one.
      lines.push(
        t.attempts >= ATTEMPT_THRESHOLD
          ? `  §5      fix attempts on \`${t.target}\`: ${t.attempts} — AT THE CEILING (${ATTEMPT_THRESHOLD}). The next edit on this target is BLOCKED until the architecture question is raised with the owner.`
          : `  §5      fix attempts on \`${t.target}\`: ${t.attempts} of ${ATTEMPT_THRESHOLD}`
      );
    }
  } else {
    lines.push('  §5      no open fix-cycle target at or past the ceiling');
  }
  // §10.16 / §6.3 (Task 6): the lessons half is now the SAME primitive the commit-time blocking
  // rule (lessons-before-commit.mjs) reads — sessionLessonGate() — so this line can never drift out
  // of agreement with what actually blocks the next `git commit`. The diff read is best-effort: any
  // failure (git missing, not a repo, doc unreadable) degrades to an explicit "unknown" verdict
  // rather than a false OK or a thrown exception — this announcer is read-only, never a gate itself.
  let lessonsLine;
  try {
    const diffText = execFileSync(
      'git', ['diff', 'HEAD', '--', join(ROOT, 'docs', 'process', 'development-discipline.md')],
      { cwd: ROOT, encoding: 'utf8', timeout: 5000 },
    );
    const verdict = sessionLessonGate({ failuresSinceLastCommit, disciplineDiffText: diffText });
    lessonsLine = verdict.pass
      ? 'lessons logged: OK'
      : `lessons logged: MISSING ⚠ ${failuresSinceLastCommit} uncovered`;
  } catch {
    lessonsLine = 'lessons logged: unknown (could not read the discipline-doc diff)';
  }
  lines.push(`  §10.16  failures this arc: ${failuresThisArc} · ${lessonsLine}`);
  lines.push(`  infra   ${infra.text}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
function buildReport(sessionId) {
  const lines = ['=== session-state (what survives compact) ==='];
  const arc = safe('active-arc', activeArc);
  lines.push(typeof arc === 'string' ? arc : arc.line);
  if (typeof arc === 'object') {
    const contradiction = safe('contradiction', () => contradictionCheck(arc));
    if (contradiction) lines.push(contradiction);
  }

  if (typeof arc === 'object' && arc.ledger) {
    const pos = safe('ledger-position', () => ledgerPosition(arc.ledger.path));
    if (typeof pos === 'string') {
      lines.push(`POSITION: ${pos}`);
    } else {
      const last = pos.lastComplete
        ? `last recorded complete: ${pos.lastComplete}`
        : 'no "Task N: complete" line found yet in this ledger';
      const arcTag = pos.arcComplete ? ' [ARC COMPLETE recorded]' : '';
      lines.push(`POSITION: ${last}${arcTag}`);
      if (pos.deferrals.length) {
        lines.push(`DEFERRALS WITH TRIGGER (${pos.deferrals.length}):`);
        for (const d of pos.deferrals.slice(0, 5)) lines.push(`  - ${d}`);
        if (pos.deferrals.length > 5) lines.push(`  ... +${pos.deferrals.length - 5} more`);
      } else {
        lines.push('DEFERRALS WITH TRIGGER: 0 found in this ledger.');
      }
    }
    const counts = safe('plan-counts', () => planCounts(arc.planPath));
    if (typeof counts === 'string') {
      lines.push(`PLAN REMAINING: ${counts}`);
    } else if (counts === null) {
      lines.push(`PLAN REMAINING: ${NA} — plan file not found (${arc.planRel ?? 'no plan name'}).`);
    } else {
      lines.push(`PLAN REMAINING: ${counts.remaining} unchecked box(es) of ${counts.total} total, across ${counts.taskHeaders} "## Task" header(s).`);
    }
    lines.push(safe('landed', () => landedSinceArcStart(arc.planRel, arc.ledger.mtime)));
  } else if (typeof arc === 'object') {
    lines.push('POSITION: n/a — no active arc.');
    lines.push('PLAN REMAINING: n/a — no active arc.');
    lines.push('LANDED SINCE ARC START: n/a — no active arc.');
  }

  lines.push(safe('enforcement', () => enforcementState(sessionId)));

  const decisions = safe('decisions', decisionsAwaitingOwner);
  lines.push(typeof decisions === 'string' ? decisions : decisions.line);
  lines.push(safe('spec', governingSpec));
  if (process.env.SESSION_STATE_SKIP_LAYER2 !== '1') {
    lines.push(safe('geniza-layer2', () => genizaLayer2(typeof arc === 'object' ? arc : null)));
  }
  return lines.join('\n');
}

function isMain() {
  try { return fileURLToPath(import.meta.url) === process.argv[1]; }
  catch { return false; }
}

// The SessionStart hook's own JSON payload (session_id, hook_event_name, source: startup|resume|
// compact, ...) arrives on stdin, exactly like every other Claude Code hook this repo already reads
// (see scripts/hooks/posttooluse.mjs's readStdin()). Bounded at 2s and wrapped so ANY failure —
// no data ever arriving, malformed JSON, a stream error — resolves to `null` rather than hanging or
// throwing: §6.2 must never be the reason a session fails to start (item 3, task-5-brief.md).
function readStdinSessionId() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve(null); return; }
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    const timer = setTimeout(() => finish(null), 2000);
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(data);
          finish(typeof parsed?.session_id === 'string' && parsed.session_id ? parsed.session_id : null);
        } catch { finish(null); }
      });
      process.stdin.on('error', () => { clearTimeout(timer); finish(null); });
    } catch { clearTimeout(timer); finish(null); }
  });
}

async function resolveSessionId() {
  if (SESSION_ID_OVERRIDE) return SESSION_ID_OVERRIDE; // self-test fixture path only
  try { return await readStdinSessionId(); }
  catch { return null; } // fail-soft: no session_id -> enforcementState() reports 0 open targets
}

if (isMain()) {
  const t0 = Date.now();
  (async () => {
    let sessionId = null;
    try { sessionId = await resolveSessionId(); } catch { sessionId = null; }
    try {
      console.log(buildReport(sessionId));
    } catch (e) {
      console.log(`session-state: WARN — could not build the report (${e.message.split('\n')[0]}). This never blocks the session.`);
    }
    const ms = Date.now() - t0;
    if (process.env.SESSION_STATE_SHOW_TIMING) console.log(`\n[session-state: ${ms}ms]`);
    process.exit(0);
  })();
}
