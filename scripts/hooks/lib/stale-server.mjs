// scripts/hooks/lib/stale-server.mjs — Arc 2 Phase 4, Task 8. The §11a/L12 staleness check,
// EXTRACTED verbatim from rules/stale-dev-server.mjs so the PreToolUse rule (11a — warn before
// the navigation) and the Stop rule (L12 — warn on the claim after) consume ONE implementation.
// A helper applied to one rule and not its sibling is the exact defect found on 2026-08-10
// (R-116). Read stale-dev-server.mjs's original header for the OS-truth reasoning: server start
// time comes from the process table, dist/index.html's mtime from the filesystem — no flag to
// go stale.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

// Finds the PID of whatever is LISTENING on `port`, via `netstat -ano` (Windows). Returns null if
// nothing is listening, or if netstat itself is unavailable/unparseable — both cases mean "no
// evidence of a live server", not "assume stale".
export function findListeningPid(port) {
  let out;
  try {
    out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', timeout: 3000 });
  } catch {
    return null;
  }
  const needle = `:${port} `;
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING') || !line.includes(needle)) continue;
    const cols = line.trim().split(/\s+/);
    const pid = cols[cols.length - 1];
    if (/^\d+$/.test(pid)) return Number(pid);
  }
  return null;
}

// Asks the OS (via PowerShell's Get-Process, the same source Task Manager reads) when `pid` was
// created. Returns epoch ms, or null if the process is gone or unqueryable by the time we ask —
// a race that only means "cannot prove staleness", not "it is stale".
export function processStartTimeMs(pid) {
  try {
    const out = execFileSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().ToString('o')`,
    ], { encoding: 'utf8', timeout: 5000 }).trim();
    const ms = Date.parse(out);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

// null = cannot determine (no build on disk / no listener / start time unreadable) — callers
// must treat null as "no evidence", NEVER as "stale". Env seams identical to the sibling rule.
// `findPid`/`getStartTime` are an injectable-clock/process-list seam (Task 5, arc4-testing-the-
// enforcement): the real process table and OS clock cannot be driven from a test, so tests supply
// fakes here instead of mocking `child_process` globally. Defaults are the real OS-reading
// functions above — production behaviour is unchanged.
export function staleServeReport({
  port = Number(process.env.MK_TEST_PORT) || 8123,
  distDir = process.env.PRETOOLUSE_DIST_DIR || join(ROOT, 'dist'),
  findPid = findListeningPid,
  getStartTime = processStartTimeMs,
} = {}) {
  const distIndex = join(distDir, 'index.html');
  if (!existsSync(distIndex)) return null;
  const pid = findPid(port);
  if (pid === null) return null;
  const startedMs = getStartTime(pid);
  if (startedMs === null) return null;
  const distMtimeMs = statSync(distIndex).mtimeMs;
  return { stale: distMtimeMs > startedMs, pid, port, startedMs, distMtimeMs };
}
