// scripts/hooks/rules/stale-dev-server.mjs — §11a (settled): "After python build.py, restart any
// manual serve.js before a UI check — it caches dist/ in memory at startup, so you will otherwise
// verify a stale build." This is a WARN, not a block (task-4-brief.md step 2 + owner's severity
// rule): a stale-server UI check costs efficiency — a wasted look at the wrong build — it does not
// take away a capability with no equivalent path, so it must not be escalated to block.
//
// TRIGGER: a browser navigation — the actual moment §11a's sentence is about ("before a UI
// check"). Matched by substring on tool_name (`browser_navigate`) rather than the exact MCP
// server prefix, so a plugin-name/version change to the Playwright MCP tool does not silently
// stop this rule from firing.
//
// REAL STATE, NOT A FLAG: nothing is written by serve.js or by this rule to record "when did the
// server start". The server's start time is read straight from the OS process table (the same
// place Task Manager gets it), by finding the PID bound to the port and asking the OS when THAT
// pid was created. A crashed/killed server simply stops appearing in that table — there is no
// marker to go stale, mirroring the no-concurrent-suite-run.mjs decision for the same reason.
//
// STALENESS TEST: dist/index.html's mtime (when the build last ran) compared against the serving
// process's own start time (when it last loaded dist/ into memory). mtime AFTER start time means
// the file on disk changed after the process that would be serving it already froze its in-memory
// copy — exactly the §11a failure shape.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DEFAULT_PORT = 8123;

// Finds the PID of whatever is LISTENING on `port`, via `netstat -ano` (Windows). Returns null if
// nothing is listening, or if netstat itself is unavailable/unparseable — both cases mean "no
// evidence of a live server", not "assume stale".
function findListeningPid(port) {
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
function processStartTimeMs(pid) {
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

export function evaluate(input) {
  if (!input || typeof input.tool_name !== 'string' || !input.tool_name.includes('browser_navigate')) {
    return { decision: 'allow', reason: 'not a browser navigation — nothing to verify against a live server' };
  }

  const port = Number(process.env.MK_TEST_PORT) || DEFAULT_PORT;
  const distDir = process.env.PRETOOLUSE_DIST_DIR || join(ROOT, 'dist');
  const distIndex = join(distDir, 'index.html');

  if (!existsSync(distIndex)) {
    return { decision: 'allow', reason: `no build found at ${distIndex} — nothing to compare` };
  }

  const pid = findListeningPid(port);
  if (pid === null) {
    return { decision: 'allow', reason: `no process listening on port ${port} — nothing to warn about` };
  }

  const startedMs = processStartTimeMs(pid);
  if (startedMs === null) {
    return { decision: 'allow', reason: `could not determine the start time of pid ${pid} on port ${port} — not asserting staleness without evidence` };
  }

  const distMtimeMs = statSync(distIndex).mtimeMs;
  if (distMtimeMs > startedMs) {
    return {
      decision: 'warn',
      reason: `§11a: dist/ was rebuilt (${new Date(distMtimeMs).toISOString()}) AFTER the server `
        + `on port ${port} started (pid ${pid}, ${new Date(startedMs).toISOString()}) — serve.js `
        + 'caches dist/ in memory at startup, so this server is still handing out the OLD build. '
        + 'Restart it (kill + `node serve.js`) before trusting a UI check against it.',
    };
  }

  return { decision: 'allow', reason: `server on port ${port} (pid ${pid}) started after dist/'s last build — not stale` };
}
