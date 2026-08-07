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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
export function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
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
