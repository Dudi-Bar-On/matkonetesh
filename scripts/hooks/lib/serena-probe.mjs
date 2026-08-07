// scripts/hooks/lib/serena-probe.mjs — the ONE definition of "serena is live", shared by every
// rule that needs §5.1 condition (ג): "serena חיה — ה-endpoint עונה" (the endpoint answers).
//
// WHY THIS FILE EXISTS RATHER THAN A SECOND DEFINITION: scripts/serena-server.ps1 (§10.17a's
// shared server) already answers "is serena live" for the watchman/session-start gate via its own
// `Invoke-McpProbe` — a real MCP `initialize` POST to the shared server's `/mcp` endpoint, with
// success meaning "it answered", not merely "a socket is open". Reinventing a second, cheaper
// definition here (e.g. "is port 9121 merely listening") would be exactly the failure mode the
// task-6 brief warned about: a listening socket is not the same fact as an MCP server answering
// behind it — a hung/half-started process can hold the port. This module performs the SAME real
// handshake, in Node, because a PreToolUse rule cannot shell out to `pwsh` on every matching tool
// call without an unacceptable latency tax; it can afford one small loopback HTTP POST.
//
// URL: this repo's own `.mcp.json` names the shared server as `http://127.0.0.1:9121/mcp` — read
// from there by a human, not re-derived here (no parser dependency on that file's shape), but
// used as the literal default. Overridable via PRETOOLUSE_SERENA_URL for tests only.
const DEFAULT_URL = 'http://127.0.0.1:9121/mcp';
// A PreToolUse rule runs before every matching tool call; this must never become a perceptible
// tax on ordinary Grep use. 800ms is generous for a loopback POST to an already-running local
// process, and still small next to what a human notices.
const DEFAULT_TIMEOUT_MS = 800;

export function serenaUrl() {
  return process.env.PRETOOLUSE_SERENA_URL || DEFAULT_URL;
}

function timeoutMs() {
  const raw = Number(process.env.PRETOOLUSE_SERENA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

// Real MCP handshake — an `initialize` request, the same one serena-server.ps1's own
// Invoke-McpProbe sends. Returns true on ANY actual HTTP response (matching that script's own
// comment: this proves "it speaks HTTP behind that URL", not that the call succeeded
// semantically — a 4xx/5xx from a real MCP server is still proof the process is alive and
// answering, which is all §5.1 condition (ג) asks). Any network failure (connection refused,
// timeout, DNS, abort) resolves to false. NEVER throws — a broken probe must resolve to "not
// live", the fail-toward-silence direction §5.1 itself specifies for this exact case (a serena
// outage must produce total silence, not a wrongly-fired warning AND not a wrongly-skipped one
// turning into a crash).
export async function isSerenaLive() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(serenaUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'pretooluse-rule', version: '1' },
        },
      }),
      signal: controller.signal,
    });
    return typeof res.status === 'number';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
