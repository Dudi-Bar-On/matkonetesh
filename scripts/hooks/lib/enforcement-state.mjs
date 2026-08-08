// scripts/hooks/lib/enforcement-state.mjs — the shared SQLite store every Group B counter sits
// on (spec §6.2: "המונה שורד ב-SQLite" — honored verbatim). NOT rules.sqlite: that file is a
// rebuildable one-way mirror of PostgreSQL with a checksum gate (`check-rules-mirror`) that
// compares it against the source of truth; writing session state into it would make that gate
// lie on every hook invocation. Session counters get their own file, next to the agent-ceiling
// ledger this module is deliberately modeled on: `.superpowers/hooks-state/enforcement-state.sqlite`,
// via `node:sqlite`'s `DatabaseSync` (built-in, zero deps, synchronous — correct inside a
// 40-50ms-budget hook; see agent-ledger.mjs's own precedent for this exact reasoning).
//
// WHY THIS FILE LEARNS FROM agent-ledger.mjs's FIRST VERSION, NOT JUST FROM ITS FINAL SHAPE:
// that ledger's first cut treated an entry as "live" for a flat 20-minute TTL with no completion
// signal — measured by a reviewer to block six STRICTLY SEQUENTIAL dispatches (two warns, two
// blocks) despite nothing running concurrently. State that cannot expire correctly is worse than
// no state at all: it manufactures blocks nobody caused. This module's answer is the same shape
// the ledger converged on — every row is keyed by session_id (so a dead/other session's rows are
// invisible to a live session's queries by construction, not by a liveness check) AND carries a
// timestamp (so a 24h TTL prune on every open removes what nothing will ever otherwise clear).
// There is no "is this session still alive" OS check here (unlike agent-ledger's tasklist probe)
// because that is the wrong tool for THIS state: fix-cycle counters and event history are meant
// to survive their own session ending (§6.2 restoration after a compact) — a completion signal
// would be the wrong signal to key eviction on. TTL + session_id scoping is the correct pair.
//
// FAIL-OPEN, THE SAME CONTRACT AS pipeline.mjs / pretooluse.mjs: a corrupt file, a locked file, a
// missing directory, a malformed argument — none of these may ever surface as an exception to the
// caller, and none may ever be interpreted as "there is a block-worthy counter here." Every
// exported function is wrapped so that ANY internal failure resolves to the fail-open value
// (`null` for a single lookup, `[]` for a list, `0` for a count, silent no-op for a write) —
// exactly the discipline agent-ledger.mjs documents at its own read/write functions. A rule built
// on top of this module that cannot read its own state must default to allow, never to block.
//
// CONCURRENCY: hooks fire per tool call and subagents run concurrently, so multiple `node`
// processes can call `openState()` against the SAME file at effectively the same instant. SQLite's
// default rollback-journal mode returns SQLITE_BUSY near-immediately under contention, which would
// surface as a thrown error here (and, per the fail-open contract, silently disable every counter
// under exactly the load Group B most needs to survive). Two settings fix this cheaply, exactly
// once per open, not per statement: `PRAGMA journal_mode=WAL` (readers no longer block writers,
// writers no longer block readers) and `PRAGMA busy_timeout=2000` (a concurrent writer retries
// internally for up to 2s instead of failing immediately). Both are idempotent to re-issue on every
// open. Verified empirically, not assumed — see task-2-report.md's concurrency section for the
// N-concurrent-process test and its result.
//
// COMPACT-IDENTITY MEASUREMENT (plan's "State lifecycle" table, Task 2 step 5) — NOT PERFORMED
// LIVE. This task ran as a spawned subagent, which has no tool capable of invoking `/compact`
// (that command belongs to the interactive top-level session, not to a dispatched agent's own
// execution context) — attempting the live before/after capture the brief describes was not
// possible from here, and this file does not claim it was. What WAS confirmed: PostToolUse/
// PostToolUseFailure hooks are live and DO carry a real `session_id` on every event fired during
// this very task's own tool calls (see scripts/hooks/posttooluse.mjs's Task 1 measurement; the
// captured id there, `7d34cd3c-4c16-477e-9067-7e56b4499b28`, is this conversation's own session).
// The design does not actually depend on the answer either way: every function below scopes its
// query strictly by the `sessionId` argument the caller passes — there is no cross-session lookup
// anywhere in this module — so correctness here does not hinge on whether that id survives a
// compact. Per the plan's own stated fallback, if a future measurement shows the id is NOT stable
// across compact, blocking rules still fail open (the old session's rows are simply invisible to
// the new id) and the §6.2 restoration path (Task 5's announcer, not this file) is the place a
// `newestSessionRows()`-style helper would be added — deliberately NOT added here, since adding it
// speculatively before the measurement exists would be exactly the kind of unverified assumption
// this project's own doctrine (Occam's Razor / "never invent tokens to force a hit") warns against.
// This remains an OPEN item for the owning interactive session to close: trigger `/compact` for
// real, capture `session_id` immediately before and after from `.superpowers/hooks-log.jsonl`
// (Task 1's log has no session_id field in its terminal `observed` record today — a raw-payload
// capture, exactly as Task 1's own header comment describes doing for PostToolUseFailure, would be
// needed), and update this header comment and the plan's lifecycle table with the real answer.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');

const DEFAULT_STATE_PATH = join(ROOT, '.superpowers', 'hooks-state', 'enforcement-state.sqlite');

// 24h — the TTL the plan's "State lifecycle" table commits to for every counter/event stream in
// this store. Pruned on every open, never on a timer, so a store nobody opens for a week does not
// silently grow — the very next hook invocation that DOES open it prunes it then.
export const TTL_MS = 24 * 60 * 60 * 1000;

// Sentinel passed to noteVerificationPass() to mean "wipe every open target for this session" (a
// full-suite pass), as opposed to an array of specific target ids that passed. A Symbol, not the
// string "ALL", deliberately — a real failing-test id could theoretically collide with a string
// sentinel; it cannot collide with a value only this module can construct.
export const ALL = Symbol('enforcement-state.ALL');

export function statePath() {
  return process.env.ENFORCEMENT_STATE_PATH || DEFAULT_STATE_PATH;
}

function pruneExpired(db, now) {
  const cutoff = now - TTL_MS;
  db.prepare('DELETE FROM events WHERE ts < ?').run(cutoff);
  db.prepare('DELETE FROM fix_targets WHERE last_failure_ts < ?').run(cutoff);
}

// Opens (creating the file/dir/schema as needed), applies the TTL prune, and returns a ready
// DatabaseSync — or `null` on ANY failure whatsoever (corrupt file, unwritable directory, a locked
// file the busy_timeout could not clear in time, ...). Callers must treat `null` as "no state
// available this call" and fail open, exactly like every function below already does for `null`.
export function openState(path = statePath()) {
  let db;
  try {
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 2000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ts INTEGER NOT NULL,
        detail TEXT
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_kind ON events (session_id, kind, ts)');
    db.exec(`
      CREATE TABLE IF NOT EXISTS fix_targets (
        session_id TEXT NOT NULL,
        target TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        edited_since_failure INTEGER NOT NULL DEFAULT 0,
        last_failure_ts INTEGER NOT NULL,
        PRIMARY KEY (session_id, target)
      )
    `);
    pruneExpired(db, Date.now());
    return db;
  } catch {
    // A corrupt/locked/unwritable store is not evidence of anything a rule should act on — the
    // caller sees "no state", not a crash. Best-effort close in case the constructor partially
    // succeeded before a later statement threw.
    try { db?.close(); } catch { /* already unusable */ }
    return null;
  }
}

// Appends one event row. `detail` is stored as-is if already a string, JSON.stringify'd otherwise
// (so callers can pass a plain object without remembering to stringify it themselves); a value
// that cannot be stringified degrades to `null` rather than throwing. Silent no-op on any failure
// or on a missing `db` (the fail-open value for a write is "nothing happened").
export function recordEvent(db, { sessionId, kind, detail } = {}) {
  if (!db || typeof sessionId !== 'string' || !sessionId || typeof kind !== 'string' || !kind) return;
  try {
    let detailText = null;
    if (typeof detail === 'string') detailText = detail;
    else if (detail !== undefined && detail !== null) {
      try { detailText = JSON.stringify(detail); } catch { detailText = null; }
    }
    db.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
      .run(sessionId, kind, Date.now(), detailText);
  } catch {
    // intentionally swallowed — see module header.
  }
}

// Newest event of `kind` for `sessionId`, or null if none / on any failure. Ordered by ts DESC
// then id DESC so two events landing in the same millisecond still resolve deterministically to
// the one actually inserted last.
export function lastEvent(db, sessionId, kind) {
  if (!db || typeof sessionId !== 'string' || typeof kind !== 'string') return null;
  try {
    const row = db.prepare(
      'SELECT ts, detail FROM events WHERE session_id = ? AND kind = ? ORDER BY ts DESC, id DESC LIMIT 1'
    ).get(sessionId, kind);
    return row ? { ts: Number(row.ts), detail: row.detail ?? null } : null;
  } catch {
    return null;
  }
}

// Count of `kind` events for `sessionId` with ts >= sinceTs. 0 on any failure or missing/invalid
// arguments — "could not count" and "counted zero" are deliberately the same fail-open value here
// (unlike extractExitCode's null/0 distinction elsewhere in this arc, a rule reading this count
// only ever needs "is it >= N", where 0 is already the correct safe default).
export function eventCountSince(db, sessionId, kind, sinceTs) {
  if (!db || typeof sessionId !== 'string' || typeof kind !== 'string') return 0;
  try {
    const row = db.prepare(
      'SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND kind = ? AND ts >= ?'
    ).get(sessionId, kind, Number.isFinite(sinceTs) ? sinceTs : 0);
    return row ? Number(row.c) : 0;
  } catch {
    return 0;
  }
}

// Every open (still-tracked) fix target for `sessionId`. [] on any failure — a rule reading this
// to decide whether to block must see "nothing open" exactly the same way whether that is true or
// the store just could not be read; both resolve to "do not block".
export function openTargets(db, sessionId) {
  if (!db || typeof sessionId !== 'string') return [];
  try {
    const rows = db.prepare(
      'SELECT target, attempts, last_failure_ts, edited_since_failure FROM fix_targets WHERE session_id = ? ORDER BY target'
    ).all(sessionId);
    return rows.map((r) => ({
      target: r.target,
      attempts: Number(r.attempts),
      lastFailureTs: Number(r.last_failure_ts),
      editedSinceFailure: r.edited_since_failure === 1,
    }));
  } catch {
    return [];
  }
}

// §6.1's cycle semantics, applied per failing-test id in `targets` (an array of string target
// ids — anything else is a silent no-op, fail-open):
//   - a target never seen before for this session: inserted fresh, attempts = 0 (a first failure
//     is not yet a "fix cycle" — it becomes one only once an edit follows it).
//   - a target already open AND edited since its last failure: this is a closed cycle — a fix was
//     attempted (the edit) and it did not hold (the re-run failed again). attempts += 1,
//     edited_since_failure resets to 0 so the NEXT edit is what re-arms the next cycle.
//   - a target already open but NOT edited since its last failure: a re-run that fails again
//     without an intervening edit is NOT a new attempt — nothing was tried between the two
//     failures, so nothing closed. attempts is left untouched (this is the trap case the brief
//     names explicitly). last_failure_ts is still refreshed either way, since it is literally "the
//     last time this target failed" regardless of whether that failure counted as a new attempt —
//     and doing so keeps an actively-recurring (if unedited) failure from being TTL-pruned as if
//     it had gone stale.
export function noteVerificationFailure(db, sessionId, targets) {
  if (!db || typeof sessionId !== 'string' || !sessionId || !Array.isArray(targets)) return;
  try {
    const now = Date.now();
    const getStmt = db.prepare(
      'SELECT attempts, edited_since_failure FROM fix_targets WHERE session_id = ? AND target = ?'
    );
    const insertStmt = db.prepare(
      'INSERT INTO fix_targets (session_id, target, attempts, edited_since_failure, last_failure_ts) VALUES (?, ?, 0, 0, ?)'
    );
    const bumpStmt = db.prepare(
      'UPDATE fix_targets SET attempts = attempts + 1, edited_since_failure = 0, last_failure_ts = ? WHERE session_id = ? AND target = ?'
    );
    const touchStmt = db.prepare(
      'UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND target = ?'
    );
    for (const target of targets) {
      if (typeof target !== 'string' || !target) continue;
      const row = getStmt.get(sessionId, target);
      if (!row) {
        insertStmt.run(sessionId, target, now);
      } else if (row.edited_since_failure === 1) {
        bumpStmt.run(now, sessionId, target);
      } else {
        touchStmt.run(now, sessionId, target);
      }
    }
    recordEvent(db, { sessionId, kind: 'verification_failure', detail: { targets } });
  } catch {
    // intentionally swallowed — see module header.
  }
}

// Marks every OPEN target of `sessionId` as edited-since-its-last-failure (an edit does not know,
// and does not need to know, which specific failing target it addressed — §6.1's semantics apply
// per-target only at the NEXT failure, when noteVerificationFailure() checks this flag). Also
// records a plain 'edit' event (filePath informational only, for future observers to read). A
// session with zero open targets is an intentional no-op on the fix_targets table (the UPDATE
// simply matches zero rows) but the event is still recorded either way.
export function noteEdit(db, sessionId, filePath) {
  if (!db || typeof sessionId !== 'string' || !sessionId) return;
  try {
    db.prepare('UPDATE fix_targets SET edited_since_failure = 1 WHERE session_id = ?').run(sessionId);
    recordEvent(db, { sessionId, kind: 'edit', detail: { filePath: typeof filePath === 'string' ? filePath : null } });
  } catch {
    // intentionally swallowed — see module header.
  }
}

// Resets the counter for targets that passed verification. `passedTargets` is either the `ALL`
// sentinel (wipes every open target row for this session — a full-suite pass) or an array of
// specific target ids to delete. Anything else is a no-op. Always records a 'verification_pass'
// event regardless, so the session's history shows the pass even if there was nothing open to
// delete (e.g. a pass on a target this store never saw fail).
export function noteVerificationPass(db, sessionId, passedTargets) {
  if (!db || typeof sessionId !== 'string' || !sessionId) return;
  try {
    if (passedTargets === ALL) {
      db.prepare('DELETE FROM fix_targets WHERE session_id = ?').run(sessionId);
    } else if (Array.isArray(passedTargets)) {
      const stmt = db.prepare('DELETE FROM fix_targets WHERE session_id = ? AND target = ?');
      for (const target of passedTargets) {
        if (typeof target === 'string' && target) stmt.run(sessionId, target);
      }
    } else {
      return; // not a recognized shape — no-op, no event (nothing happened to record).
    }
    recordEvent(db, {
      sessionId,
      kind: 'verification_pass',
      detail: { passedTargets: passedTargets === ALL ? 'ALL' : passedTargets },
    });
  } catch {
    // intentionally swallowed — see module header.
  }
}
