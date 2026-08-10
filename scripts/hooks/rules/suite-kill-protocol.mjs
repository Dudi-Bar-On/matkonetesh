// scripts/hooks/rules/suite-kill-protocol.mjs — L18. Repeated kill-and-restart of suite runs
// left serve.js's cluster primary alive: a port-based/image-based kill took the workers, the
// primary respawned them, and the zombie wedged 8123 for hours — the debugging methodology
// CREATED the failure being debugged (2026-07-23).
//
// WHAT THIS RULE DOES AND DOES NOT ENFORCE (coordinator-confirmed, from L18 + §11a):
//   - BLOCKS the indiscriminate shape: taskkill /IM <suite-server image> and pkill/killall
//     against suite-server patterns. That is the shape that kills workers while a primary
//     respawns them, and it also takes down every unrelated process of that image — including
//     the very hooks enforcing this rule.
//   - ALLOWS the §11a protocol: taskkill //PID <specific pid> (with or without //T //F). The
//     surviving corpus hits are exactly this shape — a specific, investigated PID is the
//     protocol §11a REQUIRES after an orphan is found, and firing on it would make this rule
//     the ~20-times-a-day alarm that gets disabled within a week.
//   - SCOPE, corrected against the real corpus (do not trust a pre-corpus draft): image-name
//     kills of `chrome.exe`/`headless_shell.exe` are explicitly OUT of scope. A first-draft
//     regex included them and the corpus replay caught 6 real fires on a repeated, legitimate
//     Playwright browser-cleanup idiom (`taskkill //F //IM chrome.exe //T` before a suite run,
//     to clear orphaned browsers). Browsers are leaf processes with no supervising primary that
//     respawns them on kill — the respawn-zombie mechanism L18 exists for does not apply, and
//     the corpus shows this is routine sanctioned work, not the debugging-loop mistake L18
//     records. Blocking it would itself be the false alarm spec §6 forbids. Only server-side
//     images that can run serve.js's cluster (node/serve/python) are in scope.
//   - LIMITATION, stated so no reader assumes otherwise: the protocol's second half — "then
//     VERIFY the port refuses + 0 orphans" — is a sequence ACROSS calls; a single PreToolUse
//     call cannot check it. It rides in the block reason as instruction, NOT as enforcement.
//
// SEVERITY: block, argued (spec §3.2): substance — one indiscriminate kill produced a zombie
// server and hours of thrash; the equivalent-outcome alternative is always reachable and named:
// identify the primary PID, kill its TREE (`taskkill //PID <pid> //T //F`), then verify.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L18'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const SUITE_IMAGE = /^(node(\.exe)?|serve(\.js)?|python(w?\.exe)?)$/i;
const SUITE_PATTERN = /(node|serve|python)/i;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  // Keep both quote kinds: the real target of pkill/killall (and occasionally taskkill's /IM
  // argument) often sits inside quotes — `pkill -f "serve.js 8123"` is a real corpus survivor
  // whose pattern argument the default blanket strip removes, exactly the L39/L51a signal-vs-
  // noise hazard this file's sibling rules already document. tokenize() keeps a wholly-quoted
  // phrase as ONE token, so quoted PROSE describing a kill (e.g. an echo'd warning) still does
  // not equal 'taskkill'/'pkill' and does not fire.
  for (const st of statements(stripDataRegions(command, { keepSingleQuoted: true, keepDoubleQuoted: true }))) {
    const tokens = tokenize(st);
    // The kill word may not lead the statement (`do taskkill //PID $pid //F`) — find it anywhere
    // in command position; the //PID protocol shape must still allow, so only /IM triggers.
    const killIdx = tokens.findIndex((t) => t === 'taskkill' || t === 'taskkill.exe');
    if (killIdx !== -1) {
      const rest = tokens.slice(killIdx + 1);
      const imIdx = rest.findIndex((t) => t.replace(/^\/+/, '/').toLowerCase() === '/im');
      if (imIdx !== -1 && SUITE_IMAGE.test(rest[imIdx + 1] || '')) {
        return {
          decision: 'block',
          reason: `L18: \`taskkill /IM ${rest[imIdx + 1]}\` is an indiscriminate image-name kill `
            + '— last time this shape killed suite workers while the primary respawned them, '
            + 'leaving a zombie server that wedged 8123 for hours. Follow §11a instead: identify '
            + 'the primary PID (netstat/Get-NetTCPConnection), kill its tree with '
            + '`taskkill //PID <pid> //T //F`, then VERIFY: port refuses + 0 orphans.',
        };
      }
    }
    const pkillIdx = tokens.findIndex((t) => t === 'pkill' || t === 'killall');
    if (pkillIdx !== -1) {
      const pattern = tokens.slice(pkillIdx + 1).find((t) => !t.startsWith('-'));
      if (pattern && SUITE_PATTERN.test(pattern)) {
        return {
          decision: 'block',
          reason: `L18: \`${tokens[pkillIdx]} … ${pattern}\` kills by pattern — the indiscriminate `
            + 'shape that created the respawning-zombie incident. Follow §11a: find the specific '
            + 'primary PID, `taskkill //PID <pid> //T //F` (or `kill <pid>`), then verify the '
            + 'port refuses and 0 orphans remain.',
        };
      }
    }
  }
  return { decision: 'allow', reason: 'no indiscriminate suite-process kill (PID-targeted kills are the §11a protocol)' };
}
