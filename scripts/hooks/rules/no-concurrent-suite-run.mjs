// scripts/hooks/rules/no-concurrent-suite-run.mjs — §11a (settled): "never run two suite runs
// concurrently." Racing runs against the SAME port produced 12 then 127 phantom
// ERR_CONNECTION_REFUSED failures and sent a whole session chasing a server bug that never
// existed (CLAUDE.md §11a). This rule BLOCKS a new `playwright test` invocation while the target
// port is already held by a live process.
//
// REAL STATE, NOT A FLAG (task-4-brief.md step 1): the check is "can I open a TCP connection to
// the test port right now" — the OS's own bookkeeping of what is listening, queried fresh on
// every call. Nothing is written by this rule, so there is nothing for a crashed run to leave
// behind: the OS reclaims the port the instant the holding process dies, and the very next probe
// reports it free. A marker FILE was rejected on purpose — "a flag left behind by a crashed run
// would block every subsequent suite run forever, which is worse than no rule" (brief), and that
// is exactly the `_retire`-style failure mode this project has already paid a debugging session
// for. A live TCP listener cannot go stale the way a file can: it does not exist independently of
// the thing it describes.
//
// WHY A PORT PROBE AND NOT A PROCESS-LIST SCAN FOR "playwright": the actual hazard this guards
// against is two things trying to bind the SAME port at once — and that hazard is identical
// whether the occupant is another `playwright test` run's managed webServer OR a manually started
// `node serve.js` left running from a UI check (§11a: "Stop the manual server on 8123 before
// running the suite, or Playwright's managed server collides with it."). Scanning for a process
// named "playwright" would miss the manual-server case entirely; the port probe catches both,
// because both collide the same way.
//
// PORT: matches playwright.config.ts's own override — `MK_TEST_PORT`, default 8123 — so a real
// suite run and this rule always agree on which port means "the suite". `MK_TEST_PORT` set to a
// distinct value is playwright.config.ts's OWN documented way to run two suites concurrently on
// different ports, and this rule does not fight that: it only ever probes the one port the
// upcoming command would itself use.
import net from 'node:net';

const DEFAULT_PORT = 8123;
const SEGMENT_SPLIT = /(?:&&|\|\||[;\n]|\|(?!\|))/g;

// package.json script names that resolve to a `playwright test` invocation. `test:smoke`,
// `test:area`, `test:intel`, `test:live`, `coverage` do not run the Playwright suite directly and
// are deliberately excluded — including them would widen this rule past what it can justify.
const KNOWN_TEST_SCRIPTS = new Set(['test', 'test:full', 'test:visual', 'test:a11y']);

function segments(command) {
  return command.split(SEGMENT_SPLIT).map((s) => s.trim()).filter(Boolean);
}

// Same minimal tokenizer as main-only-no-worktrees.mjs: whitespace-separated, with a light
// allowance for a whole token wrapped in matching quotes.
function tokenize(seg) {
  const matches = seg.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((t) => (
    (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
      ? t.slice(1, -1)
      : t
  ));
}

// True only if THIS segment's own leading command actually launches the Playwright suite — same
// discipline as main-only-no-worktrees.mjs: inspect the segment's leading word, never substring-
// match the whole command text. `git commit -m "playwright test flaky again"` has a leading word
// of `git`, not `playwright`/`npx`/`npm`, so it is untouched.
function isPlaywrightTestInvocation(tokens) {
  if (tokens.length === 0) return false;
  const [a, b, c] = tokens;
  if (a === 'playwright' && b === 'test') return true;
  if (a === 'npx' && b === 'playwright' && c === 'test') return true;
  if (a === 'npm' && b === 'test') return true;
  if (a === 'npm' && b === 'run' && KNOWN_TEST_SCRIPTS.has(c)) return true;
  return false;
}

// Resolves true/false — never rejects. A connect succeeding means something is listening; refused
// or timed out means the port is free. 300ms is generous for a loopback probe and still fast
// enough to pay on every matching Bash call without being felt.
function portInUse(port, host = '127.0.0.1', timeoutMs = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }

  const triggers = segments(command).some((seg) => isPlaywrightTestInvocation(tokenize(seg)));
  if (!triggers) {
    return { decision: 'allow', reason: 'no `playwright test` invocation in this command' };
  }

  const port = Number(process.env.MK_TEST_PORT) || DEFAULT_PORT;
  let busy;
  try {
    busy = await portInUse(port);
  } catch {
    // A probe failure is not evidence of a live run — fail open, matching this whole pipeline's
    // own contract (pipeline.mjs: an internal failure must never look like a block).
    return { decision: 'allow', reason: `could not probe port ${port} — treating as free` };
  }

  if (busy) {
    return {
      decision: 'block',
      reason: `§11a (settled): something is already listening on port ${port} — a second `
        + '`playwright test` run against the same port produced 12 then 127 phantom '
        + 'ERR_CONNECTION_REFUSED failures before, and sent a whole session chasing a server bug '
        + 'that did not exist. Let the run (or the manual `node serve.js`) using that port finish '
        + 'or be stopped first — or set MK_TEST_PORT to a different port for a genuinely '
        + 'concurrent run, which playwright.config.ts already supports.',
    };
  }

  return { decision: 'allow', reason: `port ${port} is free — no suite run in flight` };
}
