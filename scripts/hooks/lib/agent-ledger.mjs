// scripts/hooks/lib/agent-ledger.mjs — shared ledger I/O for §10.5a's agent-concurrency ceiling.
// Extracted so the PreToolUse rule (agent-concurrency-ceiling.mjs, which COUNTS live agents) and
// the SubagentStop entry point (subagentstop.mjs, which RELEASES a slot when one finishes) agree
// on exactly one file format and one liveness definition — the same discipline
// scripts/lib/register-scan.mjs already established for session-state.mjs/session-brief.mjs.
//
// FIX ROUND 1 (owner review finding, Critical): the original design counted only via a 20-minute
// TTL, no completion signal. Measured by the reviewer: six STRICTLY SEQUENTIAL dispatches (each
// one's agent already finished before the next began) produced two warns and two blocks — the
// exact "count that never resets" failure the brief warned against, just triggered by SUCCESS
// instead of by a crash. `SubagentStop` (confirmed real in this repo's own vendor docs —
// docs/vendor/claude-code/claude-code-docs-47.md, -19.md, -46.md) is the completion signal that
// was missing. It is now the PRIMARY decrement path; the TTL drops to a pure backstop (point 2 of
// the fix instructions) for the one case SubagentStop cannot cover: the host process killed
// between dispatch and stop, where no SubagentStop can ever fire.
//
// WHY RELEASE IS "OLDEST ENTRY", NOT "THE MATCHING ENTRY" (measured, not assumed — see
// task-5-report.md's Fix Round 1 section for the full trace): per claude-code-docs-46.md,
// `agent_id` is populated "when the hook fires INSIDE a subagent" and is a REQUIRED field on
// `SubagentStart`/`SubagentStop` — but the ORIGINATING `PreToolUse:Agent` event fires in the
// PARENT session, before the new subagent (and its agent_id) exists, so that event never carries
// one. There is therefore no shared identifier documented to exist on BOTH the dispatch event and
// the stop event for the same agent — `tool_use_id` is passed to a SubagentStop callback (the SDK
// example signature takes it as its second argument), but no vendor doc states it equals the
// dispatching Agent tool call's own `tool_use_id`, and this project's rule never assumed an
// unconfirmed fact into its design. Given that, releasing the OLDEST still-live entry on any
// SubagentStop is the NEXT-BEST mechanism per the fix instructions' point 3: it keeps the COUNT
// (which is all the ceiling needs) correct under 1:1 dispatch/stop pairing regardless of order,
// without pretending an identity match this project cannot prove.
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');

const DEFAULT_LEDGER_PATH = join(ROOT, '.superpowers', 'hooks-state', 'agent-ceiling.json');
// Backstop only now (see header) — generous, because normal completion no longer depends on it.
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 60 minutes.

export function ledgerPath() {
  return process.env.PRETOOLUSE_AGENT_LEDGER_PATH || DEFAULT_LEDGER_PATH;
}

export function ttlMs() {
  const raw = Number(process.env.PRETOOLUSE_AGENT_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
}

// The current invocation's own host pid. Overridable only for tests (PRETOOLUSE_HOST_PID), which
// cannot control the real process.ppid of a spawned test harness the way a real Claude Code hook
// invocation can (process.ppid there genuinely is the live host CLI process — see rule header).
export function currentHostPid() {
  const override = Number(process.env.PRETOOLUSE_HOST_PID);
  if (Number.isFinite(override) && override > 0) return override;
  return process.ppid;
}

// Real OS query, never a flag. `false` on ANY inability to confirm liveness (pid gone, or the
// query itself failed) — the fail-open/undercount-biased direction (an internal failure must
// never look like grounds to block, matching pipeline.mjs's own contract).
// Real OS query, never a flag. `false` on ANY inability to confirm liveness (pid gone, or the
// query itself failed) — the fail-open/undercount-biased direction (an internal failure must
// never look like grounds to block, matching pipeline.mjs's own contract).
//
// R-120, measured 2026-08-10 rather than reasoned. A PreToolUse call on the Agent tool cost 539ms,
// and 496ms of it was here: the ledger holds 5 pids and each spawned its own `tasklist`. Three
// primitives, timed on this machine:
//
//     tasklist, full CSV listing   777ms      (tried first — made it WORSE, 539ms -> 838ms)
//     tasklist, filtered by pid    463ms      (the original, once per pid)
//     process.kill(pid, 0)           0.003ms
//
// `process.kill(pid, 0)` sends NO signal; it asks the OS whether the pid can be signalled, which is
// the existence question we are actually asking. ESRCH means gone. EPERM means it exists and is
// simply not ours — still ALIVE, and getting that backwards would silently raise the concurrency
// ceiling, so it is answered explicitly rather than falling into the catch-all. `tasklist` remains
// the fallback for any other error, so an unfamiliar failure still resolves through the path that
// was already trusted.
export function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    if (err && err.code === 'EPERM') return true;
  }
  try {
    const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], {
      encoding: 'utf8',
      timeout: 3000,
    });
    return new RegExp(`\\b${pid}\\b`).test(out);
  } catch {
    return false;
  }
}

export function readLedger(path) {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e
      && typeof e === 'object'
      && Number.isFinite(e.dispatchedAt)
      && Number.isFinite(e.hostPid));
  } catch {
    // A corrupt ledger is not evidence of live agents — start clean rather than block on it.
    return [];
  }
}

// FIX ROUND 2 (R-155, 2026-08-12): the retirement SIGNAL is not the problem — instrumenting
// subagentstop.mjs live and dispatching real background agents through it proved SubagentStop DOES
// fire (its own "NOT wired" header claim was stale, not a live defect; see task-r155-report.md for
// the captured hook payloads). The real defect is a classic read-modify-write race: both the
// append path (agent-concurrency-ceiling.mjs) and the release path (releaseOldest below) do
// readLedger -> compute -> writeLedger with NO mutual exclusion. When two or more of these fire
// close together — a normal pattern, not an edge case, whenever several background agents dispatch
// or finish near-simultaneously — two processes can read the same "before" state and each write a
// result computed from it; the loser's write is silently discarded. Measured directly: 8 concurrent
// `subagentstop.mjs` releases against 8 live entries lost at least one release in 4 of 5 trials
// (scripts/tests/test-hooks-groupa.mjs, the "R-155" section). Because nothing else ever removes an
// entry owned by a still-alive hostPid (that check is deliberately correct — the owner really is
// alive), a lost release is PERMANENT short of the 60-minute TTL backstop, and small losses
// accumulate exactly the way the incident read: eleven dispatches -> 5 stuck entries -> every
// dispatch blocked for hours.
//
// withLedgerLock wraps the read-modify-write critical section in a real cross-process mutex (an
// exclusive-create lock FILE, not an in-memory flag — the race is BETWEEN OS processes, an
// in-process guard cannot see it). FAILS OPEN on lock trouble: if the lock cannot be acquired
// within LOCK_MAX_WAIT_MS (a crashed holder, or a filesystem hiccup), fn() still runs WITHOUT the
// lock rather than blocking a dispatch or a release forever — an occasional unlocked race is the
// PRE-EXISTING risk, not a new, worse one; the direction stays the same fail-open bias documented
// on isPidAlive above (an internal failure must never look like grounds to block).
const LOCK_STALE_MS = 10_000; // a lock file older than this is presumed abandoned by a dead holder.
const LOCK_MAX_WAIT_MS = 2_000; // long enough to ride out real contention, short enough to never
// meaningfully add to a PreToolUse/SubagentStop hook's own timeout budget (5s in .claude/settings.json).
const LOCK_POLL_MS = 10;

// A synchronous blocking wait that does NOT spin the CPU (Atomics.wait genuinely blocks the
// thread). Falls back to a bounded busy-wait only if Atomics.wait itself is unavailable — reached
// solely under real lock contention, never on the common uncontended path.
function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const until = Date.now() + ms;
    while (Date.now() < until) { /* bounded spin, contention-only fallback */ }
  }
}

// Runs fn() with exclusive access to path's ledger, so a concurrent append and release — or two of
// either — can never lose one write to the other. See the header above for the measured defect
// this closes.
export function withLedgerLock(path, fn) {
  const lockPath = `${path}.lock`;
  const start = Date.now();
  let acquired = false;
  while (Date.now() - start < LOCK_MAX_WAIT_MS) {
    try {
      writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      acquired = true;
      break;
    } catch (err) {
      if (!err || err.code !== 'EEXIST') break; // unexpected error creating the lock — proceed without it.
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
          try { unlinkSync(lockPath); } catch { /* raced with the holder's own cleanup — fine, retry */ }
          continue;
        }
      } catch { continue; } // lock vanished between the EEXIST and the stat — retry immediately.
      sleepSync(LOCK_POLL_MS);
    }
  }
  try {
    return fn();
  } finally {
    if (acquired) {
      try { unlinkSync(lockPath); } catch { /* already gone — fine */ }
    }
  }
}

export function writeLedger(path, entries) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(entries), 'utf8');
  } catch {
    // Losing a ledger write is the same class of acceptable loss as pipeline.mjs's safeLog: the
    // next call re-derives from whatever is on disk, and a failed write here must never surface
    // as a block.
  }
}

// Keeps only entries that are still evidence of a live agent: their owning host process still
// exists AND they are not old enough to be presumed finished (the TTL backstop).
export function pruneLive(entries, now, ttl) {
  const aliveCache = new Map();
  const pidAlive = (pid) => {
    if (!aliveCache.has(pid)) aliveCache.set(pid, isPidAlive(pid));
    return aliveCache.get(pid);
  };
  return entries.filter((e) => (now - e.dispatchedAt) < ttl && pidAlive(e.hostPid));
}

// Removes the OLDEST live entry (FIFO) — the "release a slot" operation SubagentStop performs.
// Returns { removed: boolean, entries: <pruned-and-possibly-shortened array> }. Also opportunistically
// prunes dead/expired entries first, same as the read side, so the ledger never grows unbounded.
export function releaseOldest(rawEntries, now, ttl) {
  const live = pruneLive(rawEntries, now, ttl);
  if (live.length === 0) return { removed: false, entries: live };
  const sorted = [...live].sort((a, b) => a.dispatchedAt - b.dispatchedAt);
  sorted.shift();
  return { removed: true, entries: sorted };
}
