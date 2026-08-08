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
// ACTOR SCOPING (Phase 4 Group B, Task 14 / R-117, added after this store was already LIVE):
// dispatched subagents inherit the parent's session_id, so a store keyed by session_id ALONE makes
// every concurrent actor share one counter — observed live: a subagent was blocked by
// debugging-before-fix-edit.mjs over a `bash_failure` event a DIFFERENT, concurrent subagent wrote
// under the same session_id. `agent_id` is present in the hook payload on every call (measured in
// Task 8 — see skill-invoked.mjs's header for the captured example), absent only for the top-level
// interactive session. That absence is treated as ITS OWN STABLE IDENTITY, not as a wildcard: the
// main session is one specific actor among several, not "everyone" — so every function below
// normalizes a missing/null/empty agent_id to the SAME sentinel string (`''`), never to "no filter".
//
// THE ACTUAL DECISION, PER COUNTER (not one blanket rule — see each function's own comment for the
// full reasoning, this is the index):
//   - fix_targets (attempts/edited_since_failure per target)   -> PER-ACTOR. §5 fix cycles are a
//     property of the actor doing the debugging loop, not the session as a whole (task-14-brief).
//   - 'bash_failure' events                                     -> PER-ACTOR. This is the literal
//     defect: one actor's failed Bash command must never gate a DIFFERENT actor's edit.
//   - 'verification_pass' events, as read by debugging-before-fix-edit.mjs's "already resolved"
//     check                                                     -> PER-ACTOR, matched to the SAME
//     actor's own bash_failure it is being compared against (an unrelated actor's independent green
//     run is not evidence THIS actor's own failure was investigated).
//   - 'owner_decision_reset' consumption tracking (fix-cycle-limit.mjs)
//                                                                -> PER-ACTOR, for the same reason
//     fix_targets itself is: each actor's counter is reset independently, once each.
//   - 'verification_failure' events, as counted by eventCountSince() for §6.3/§10.16             -> stays
//     SESSION-WIDE always: eventCountSince() itself never gained an actor parameter. §10.16 is a
//     lesson owed for the SESSION's failures, not per actor — scoping it per-actor would let a
//     session close with some actor's failures uncovered, exactly the hole §6.3 exists to close.
//   - 'commit' events                                            -> SESSION-WIDE. A commit is a
//     single shared checkpoint against one repo HEAD; whichever actor ran it, it closes the
//     "since the last commit" window for the whole session's lessons obligation.
//   - 'ui_edit' / 'playwright_run' / 'live_probe' events (Stop-hook rules) -> SESSION-WIDE,
//     DELIBERATELY, even though this looks like the same shape as bash_failure. Stop only ever
//     fires on the TOP-LEVEL session's own turn (never a dispatched subagent's — see
//     verify-before-success-claim.mjs's own header), so if these were actor-scoped the orchestrator's
//     own success/live claim would almost never see evidence a DISPATCHED SUBAGENT actually
//     produced (the subagent edited app.js and ran Playwright; the orchestrator is the one who
//     later tells the owner "done"). Scoping these by actor would break the legitimate
//     dispatched-development workflow this whole arc is built to support, not fix a defect.
//
// STORAGE SENTINEL: normalizeActorId() below maps missing/null/''/non-string to the literal empty
// string `''`, used as a REAL (non-NULL) column value everywhere an actor identity is stored or
// filtered. NULL was deliberately rejected for fix_targets' composite key: SQLite treats two NULLs
// in a UNIQUE/PRIMARY KEY index as DISTINCT (never colliding), so two rows for the same
// (session_id, target) with actor_id=NULL would NOT violate uniqueness and could silently duplicate
// — exactly the kind of state corruption this store's whole design (module header above) exists to
// avoid. `''` is an ordinary string value with ordinary equality semantics, so upserts behave
// exactly like every other actor identity, with no NULL-comparison special case anywhere.
//
// READ DEFAULT: every read function distinguishes "actorId argument OMITTED (`undefined`)" from
// "actorId argument PASSED (including explicitly `null`/`''`, the main-session identity)". Omitted
// means UNFILTERED — the exact pre-Task-14 behavior, so every call site that was never touched by
// this task (ui-playwright-before-done.mjs, live-url-verified.mjs, lessons-before-commit.mjs,
// session-state.mjs's commit/failure-count reads) keeps working with zero code change and zero
// behavior change. Passed means FILTERED to that one normalized actor identity. This is why
// `eventCountSince()` below is UNCHANGED — no actorId parameter was ever added to it, because no
// consumer of it may ever filter by actor (see the §10.16 line above).
//
// MIGRATION (rows already in the live store, written before this column existed): ensureActorColumn()
// treats every pre-existing `fix_targets` row and every pre-existing `events` row as belonging to
// the MAIN-SESSION identity (`actor_id = ''`) — never to "every actor" (which would recreate the
// exact defect this task fixes: a stale row becoming visible to every concurrent subagent) and never
// dropped (which would silently erase a real in-flight §5 counter or event history). The main-session
// bucket is the most faithful available approximation: before this fix, the top-level session and
// every dispatched subagent were already sharing one undifferentiated bucket, so folding the old rows
// into what is now specifically the main-session's own bucket changes nothing about what a human
// running the top-level session would see, and simply stops leaking into subagents going forward.
export function normalizeActorId(actorId) {
  return typeof actorId === 'string' && actorId ? actorId : '';
}

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

// MIGRATION for a store created before Task 14 (actor scoping). The `CREATE TABLE IF NOT EXISTS`
// calls above only take effect on a brand-new file — a store that already existed on disk (this
// module has been LIVE) keeps its old column set forever unless migrated explicitly here. Runs on
// every open (cheap: two `PRAGMA table_info` reads when already migrated, the common case).
//
//   events: additive only — `ALTER TABLE ... ADD COLUMN actor_id TEXT NOT NULL DEFAULT ''` gives
//   every pre-existing row `actor_id = ''` for free (SQLite backfills the DEFAULT on ADD COLUMN),
//   which is exactly the "pre-existing rows belong to the main-session identity" decision the
//   module header above states — no data copy needed since no key changes shape.
//
//   fix_targets: NOT additive — its PRIMARY KEY is changing shape (session_id, target) ->
//   (session_id, actor_id, target), and SQLite cannot ALTER a table's PRIMARY KEY in place. Rename
//   the old table, create the new one, copy every row across with actor_id='' (same "pre-existing
//   rows belong to the main-session identity" decision, made explicit here since — unlike events —
//   it is a real data migration, not just a backfilled column), drop the renamed original. This is
//   NOT a wildcard: an old row becomes visible to future queries filtered to actor_id='' (the
//   top-level session), not to every subagent's actor_id, so migrating does not recreate R-117.
function ensureActorColumns(db) {
  const eventCols = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
  if (!eventCols.includes('actor_id')) {
    db.exec("ALTER TABLE events ADD COLUMN actor_id TEXT NOT NULL DEFAULT ''");
  }
  const targetCols = db.prepare('PRAGMA table_info(fix_targets)').all().map((c) => c.name);
  if (!targetCols.includes('actor_id')) {
    db.exec('ALTER TABLE fix_targets RENAME TO fix_targets_pre_actor_migration');
    db.exec(`
      CREATE TABLE fix_targets (
        session_id TEXT NOT NULL,
        actor_id TEXT NOT NULL DEFAULT '',
        target TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        edited_since_failure INTEGER NOT NULL DEFAULT 0,
        last_failure_ts INTEGER NOT NULL,
        PRIMARY KEY (session_id, actor_id, target)
      )
    `);
    db.exec(`
      INSERT INTO fix_targets (session_id, actor_id, target, attempts, edited_since_failure, last_failure_ts)
      SELECT session_id, '', target, attempts, edited_since_failure, last_failure_ts
      FROM fix_targets_pre_actor_migration
    `);
    db.exec('DROP TABLE fix_targets_pre_actor_migration');
  }
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
        detail TEXT,
        actor_id TEXT NOT NULL DEFAULT ''
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_kind ON events (session_id, kind, ts)');
    db.exec(`
      CREATE TABLE IF NOT EXISTS fix_targets (
        session_id TEXT NOT NULL,
        actor_id TEXT NOT NULL DEFAULT '',
        target TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        edited_since_failure INTEGER NOT NULL DEFAULT 0,
        last_failure_ts INTEGER NOT NULL,
        PRIMARY KEY (session_id, actor_id, target)
      )
    `);
    // MUST run before the actor_id index below: on a pre-existing store, `CREATE TABLE IF NOT
    // EXISTS` above is a no-op (the table already exists under the OLD schema), so `events.actor_id`
    // does not exist yet until this migration adds it — an index referencing it any earlier would
    // fail with "no such column: actor_id" on exactly the store this migration exists to handle.
    ensureActorColumns(db);
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_kind_actor ON events (session_id, kind, actor_id, ts)');
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
// `actorId` (Task 14): stored on EVERY event row regardless of kind — normalizeActorId() applied,
// so a missing/null/'' caller always writes the main-session identity, never a NULL that could
// behave inconsistently under comparison. This is a WRITE, not a filtered read, so there is no
// "omitted means unfiltered" ambiguity here the way there is in lastEvent()/openTargets() below:
// every row gets a concrete actor identity on write; whether a given READER later filters on it is
// that reader's own per-kind decision (see the module header's per-counter table).
export function recordEvent(db, { sessionId, kind, detail, actorId } = {}) {
  if (!db || typeof sessionId !== 'string' || !sessionId || typeof kind !== 'string' || !kind) return;
  try {
    let detailText = null;
    if (typeof detail === 'string') detailText = detail;
    else if (detail !== undefined && detail !== null) {
      try { detailText = JSON.stringify(detail); } catch { detailText = null; }
    }
    db.prepare('INSERT INTO events (session_id, kind, ts, detail, actor_id) VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, kind, Date.now(), detailText, normalizeActorId(actorId));
  } catch {
    // intentionally swallowed — see module header.
  }
}

// Newest event of `kind` for `sessionId`, or null if none / on any failure. Ordered by ts DESC
// then id DESC so two events landing in the same millisecond still resolve deterministically to
// the one actually inserted last.
//
// `actorId` (Task 14, 4th param, OPTIONAL): omitted (`undefined`, the pre-Task-14 call shape) means
// UNFILTERED — matches a row written by ANY actor, exactly the original behavior, so every call
// site this task did not touch ('commit', 'ui_edit', 'playwright_run', 'live_probe' readers) needs
// zero changes and sees zero behavior change. Passed (including explicitly `null`/`''` for the
// main-session identity) means FILTERED to that one normalized actor — used by
// debugging-before-fix-edit.mjs for 'bash_failure'/'verification_pass', per the module header's
// per-counter table.
export function lastEvent(db, sessionId, kind, actorId) {
  if (!db || typeof sessionId !== 'string' || typeof kind !== 'string') return null;
  try {
    const row = actorId === undefined
      ? db.prepare(
        'SELECT ts, detail FROM events WHERE session_id = ? AND kind = ? ORDER BY ts DESC, id DESC LIMIT 1'
      ).get(sessionId, kind)
      : db.prepare(
        'SELECT ts, detail FROM events WHERE session_id = ? AND kind = ? AND actor_id = ? ORDER BY ts DESC, id DESC LIMIT 1'
      ).get(sessionId, kind, normalizeActorId(actorId));
    return row ? { ts: Number(row.ts), detail: row.detail ?? null } : null;
  } catch {
    return null;
  }
}

// Count of `kind` events for `sessionId` with ts >= sinceTs. 0 on any failure or missing/invalid
// arguments — "could not count" and "counted zero" are deliberately the same fail-open value here
// (unlike extractExitCode's null/0 distinction elsewhere in this arc, a rule reading this count
// only ever needs "is it >= N", where 0 is already the correct safe default).
//
// Task 14 — DELIBERATELY NO actorId parameter here, unlike lastEvent()/openTargets(). This
// function's only two callers (lessons-before-commit.mjs / gate-lessons.mjs for §6.3, and
// session-state.mjs's §6.2 announcer, both counting 'verification_failure' events) implement §10.16:
// a lesson owed for the SESSION's accumulated failures, never per-actor. Adding an actorId parameter
// here — even an optional, defaulted one — would invite a future caller to filter it "by mistake",
// re-opening exactly the hole §6.3 exists to close (a session closing with some actor's failures
// silently uncovered). The absence of the parameter is the enforcement of that decision, not an
// oversight.
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
//
// `actorId` (Task 14, 3rd param, OPTIONAL): omitted means UNFILTERED — every actor's rows for this
// session, each tagged with its own `actorId` field on the returned object (normalized: `''` is the
// main-session identity). This is the shape session-state.mjs's §6.2 announcer needs: it must keep
// telling the truth about WHICH actor a given open counter belongs to, not imply a subagent's
// counter blocks the main session or vice versa (see that file's own comment at the call site).
// Passed means FILTERED to exactly that one actor — the shape fix-cycle-limit.mjs needs, since §5
// is per-actor: it must never see (and therefore never block on) a DIFFERENT actor's own targets.
export function openTargets(db, sessionId, actorId) {
  if (!db || typeof sessionId !== 'string') return [];
  try {
    const rows = actorId === undefined
      ? db.prepare(
        'SELECT target, attempts, last_failure_ts, edited_since_failure, actor_id FROM fix_targets WHERE session_id = ? ORDER BY target'
      ).all(sessionId)
      : db.prepare(
        'SELECT target, attempts, last_failure_ts, edited_since_failure, actor_id FROM fix_targets WHERE session_id = ? AND actor_id = ? ORDER BY target'
      ).all(sessionId, normalizeActorId(actorId));
    return rows.map((r) => ({
      target: r.target,
      attempts: Number(r.attempts),
      lastFailureTs: Number(r.last_failure_ts),
      editedSinceFailure: r.edited_since_failure === 1,
      actorId: r.actor_id,
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
// `actorId` (Task 14, 4th param): unlike the read functions above, this is a WRITE that always
// needs a concrete key — there is no "unfiltered write". Omitted/null/'' normalizes to the
// main-session identity (the pre-Task-14 behavior for every caller that has not been updated to
// pass a real agent_id, and the correct identity for the top-level session itself once callers
// are updated). The fix_targets bump below IS actor-scoped (§5 is per-actor); the
// 'verification_failure' EVENT recorded at the end is NOT actor-filtered by any reader
// (eventCountSince() never takes an actorId — see its own comment) — it still carries this
// actorId for audit/observability, but §10.16's session-wide count is correct regardless of what
// value lands there, by construction.
export function noteVerificationFailure(db, sessionId, targets, actorId) {
  if (!db || typeof sessionId !== 'string' || !sessionId || !Array.isArray(targets)) return;
  try {
    const actor = normalizeActorId(actorId);
    const now = Date.now();
    const getStmt = db.prepare(
      'SELECT attempts, edited_since_failure FROM fix_targets WHERE session_id = ? AND actor_id = ? AND target = ?'
    );
    const insertStmt = db.prepare(
      'INSERT INTO fix_targets (session_id, actor_id, target, attempts, edited_since_failure, last_failure_ts) VALUES (?, ?, ?, 0, 0, ?)'
    );
    const bumpStmt = db.prepare(
      'UPDATE fix_targets SET attempts = attempts + 1, edited_since_failure = 0, last_failure_ts = ? WHERE session_id = ? AND actor_id = ? AND target = ?'
    );
    const touchStmt = db.prepare(
      'UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND actor_id = ? AND target = ?'
    );
    for (const target of targets) {
      if (typeof target !== 'string' || !target) continue;
      const row = getStmt.get(sessionId, actor, target);
      if (!row) {
        insertStmt.run(sessionId, actor, target, now);
      } else if (row.edited_since_failure === 1) {
        bumpStmt.run(now, sessionId, actor, target);
      } else {
        touchStmt.run(now, sessionId, actor, target);
      }
    }
    recordEvent(db, { sessionId, kind: 'verification_failure', detail: { targets }, actorId: actor });
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
// `actorId` (Task 14, 3rd param): same "write always needs a concrete key" reasoning as
// noteVerificationFailure() above. "Every OPEN target" now means every open target FOR THIS ACTOR
// — an edit by actor A must never arm actor B's own fix_targets rows for their next failure (that
// would let A's edit silently count as B's fix attempt, the same class of cross-actor leakage
// R-117 is about, just in the opposite direction).
export function noteEdit(db, sessionId, filePath, actorId) {
  if (!db || typeof sessionId !== 'string' || !sessionId) return;
  try {
    const actor = normalizeActorId(actorId);
    db.prepare('UPDATE fix_targets SET edited_since_failure = 1 WHERE session_id = ? AND actor_id = ?').run(sessionId, actor);
    recordEvent(db, { sessionId, kind: 'edit', detail: { filePath: typeof filePath === 'string' ? filePath : null }, actorId: actor });
  } catch {
    // intentionally swallowed — see module header.
  }
}

// Resets the counter for targets that passed verification. `passedTargets` is either the `ALL`
// sentinel (wipes every open target row for this session — a full-suite pass) or an array of
// specific target ids to delete. Anything else is a no-op. Always records a 'verification_pass'
// event regardless, so the session's history shows the pass even if there was nothing open to
// delete (e.g. a pass on a target this store never saw fail).
//
// `actorId` (Task 14, 4th param): the fix_targets DELETE is scoped to THIS actor's own rows only —
// a passing run by actor A clears A's own tracked cycles, never B's concurrently-open ones on a
// same-named target (consistent with fix_targets being per-actor throughout). The
// 'verification_pass' EVENT is recorded WITH this actorId (unlike 'verification_failure' above,
// this one IS read with actor filtering — by debugging-before-fix-edit.mjs, matching a bash_failure
// against a resolution from the SAME actor, per the module header's per-counter table).
export function noteVerificationPass(db, sessionId, passedTargets, actorId) {
  if (!db || typeof sessionId !== 'string' || !sessionId) return;
  try {
    const actor = normalizeActorId(actorId);
    if (passedTargets === ALL) {
      db.prepare('DELETE FROM fix_targets WHERE session_id = ? AND actor_id = ?').run(sessionId, actor);
    } else if (Array.isArray(passedTargets)) {
      const stmt = db.prepare('DELETE FROM fix_targets WHERE session_id = ? AND actor_id = ? AND target = ?');
      for (const target of passedTargets) {
        if (typeof target === 'string' && target) stmt.run(sessionId, actor, target);
      }
    } else {
      return; // not a recognized shape — no-op, no event (nothing happened to record).
    }
    recordEvent(db, {
      sessionId,
      kind: 'verification_pass',
      detail: { passedTargets: passedTargets === ALL ? 'ALL' : passedTargets },
      actorId: actor,
    });
  } catch {
    // intentionally swallowed — see module header.
  }
}
