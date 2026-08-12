// scripts/hooks/lib/stale-server.mjs — Arc 2 Phase 4, Task 8. The §11a/L12 staleness check,
// EXTRACTED verbatim from rules/stale-dev-server.mjs so the PreToolUse rule (11a — warn before
// the navigation) and the Stop rule (L12 — warn on the claim after) consume ONE implementation.
// A helper applied to one rule and not its sibling is the exact defect found on 2026-08-10
// (R-116). Read stale-dev-server.mjs's original header for the OS-truth reasoning: server start
// time comes from the process table, dist/index.html's mtime from the filesystem — no flag to
// go stale.
//
// PLATFORM SPLIT (R-150, 2026-08-12): the original implementation read Windows-only tools
// (`netstat -ano`, PowerShell `Get-Process`). On Linux there is no PowerShell at all, and CI
// images may or may not ship `netstat`, so the rule silently went dark (findListeningPid always
// returned null) rather than genuinely warning. §11a/L12 are real on any platform — a rebuilt
// dist/ served by a memory-cached process is not a Windows-only failure — so this now reads the
// SAME OS truth via `/proc` on Linux instead of skipping the capability: `/proc/net/tcp(6)` for
// the listening socket's inode, an `/proc/*/fd` scan for the owning pid, and `/proc/<pid>/stat`
// field 22 (starttime, in clock ticks since boot) converted through `/proc/uptime` for the start
// time. No external binary dependency, so it works on minimal CI containers too.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

// Finds the PID of whatever is LISTENING on `port`, via `netstat -ano` (Windows). Returns null if
// nothing is listening, or if netstat itself is unavailable/unparseable — both cases mean "no
// evidence of a live server", not "assume stale".
function findListeningPidWindows(port) {
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

// Linux: find the socket inode listening on `port` from /proc/net/tcp(6), then scan /proc/*/fd
// for the process holding a `socket:[inode]` fd. Same "null = no evidence" contract as the
// Windows path above — a permission-denied fd directory (a process owned by another user) is
// skipped, never treated as proof of absence.
function findListeningPidLinux(port) {
  const portHex = port.toString(16).toUpperCase().padStart(4, '0');
  let inode = null;
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let content;
    try {
      content = readFileSync(table, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n').slice(1);
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 10) continue;
      const [, local, , state] = cols; // sl local_address rem_address st ... inode
      if (state !== '0A') continue; // TCP_LISTEN
      const localPortHex = local.split(':')[1];
      if (localPortHex === portHex) {
        inode = cols[9];
        break;
      }
    }
    if (inode) break;
  }
  if (!inode) return null;

  let pids;
  try {
    pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
  } catch {
    return null;
  }
  const needle = `socket:[${inode}]`;
  for (const pid of pids) {
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue; // not ours to read, or the process already exited — no evidence either way
    }
    for (const fd of fds) {
      let link;
      try {
        link = readlinkSync(`/proc/${pid}/fd/${fd}`);
      } catch {
        continue;
      }
      if (link === needle) return Number(pid);
    }
  }
  return null;
}

export function findListeningPid(port) {
  return process.platform === 'win32' ? findListeningPidWindows(port) : findListeningPidLinux(port);
}

// Asks the OS (via PowerShell's Get-Process, the same source Task Manager reads) when `pid` was
// created. Returns epoch ms, or null if the process is gone or unqueryable by the time we ask —
// a race that only means "cannot prove staleness", not "it is stale".
function processStartTimeWindows(pid) {
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

// Linux: `/proc/<pid>/stat` field 22 is starttime in clock ticks since boot. `comm` (field 2) is
// parenthesised and may itself contain spaces/parens, so we split on the LAST ')' rather than by
// naive whitespace splitting of the whole line — the documented-safe way to parse this file.
// `/proc/uptime`'s first field is seconds since boot, which anchors ticks-since-boot to a real
// epoch time. `getconf CLK_TCK` gives the ticks-per-second divisor (almost always 100, but read
// rather than assumed).
function processStartTimeLinux(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const afterComm = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    // afterComm[0] is field 3 (state); field 22 (starttime) is afterComm[22 - 3] = afterComm[19].
    const starttimeTicks = Number(afterComm[19]);
    if (!Number.isFinite(starttimeTicks)) return null;

    const uptimeSeconds = Number(readFileSync('/proc/uptime', 'utf8').trim().split(/\s+/)[0]);
    if (!Number.isFinite(uptimeSeconds)) return null;

    let clkTck = 100;
    try {
      const raw = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8', timeout: 3000 }).trim());
      if (Number.isFinite(raw) && raw > 0) clkTck = raw;
    } catch {
      // fall back to the near-universal Linux default of 100 — a missing getconf is not a reason
      // to give up on the whole reading.
    }

    const bootEpochMs = Date.now() - uptimeSeconds * 1000;
    return bootEpochMs + (starttimeTicks / clkTck) * 1000;
  } catch {
    return null;
  }
}

export function processStartTimeMs(pid) {
  return process.platform === 'win32' ? processStartTimeWindows(pid) : processStartTimeLinux(pid);
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
