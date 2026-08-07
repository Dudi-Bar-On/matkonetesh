// scripts/hooks/rules/symbolic-grep-use-serena.mjs — §10.17 / §5.1 (settled): a Grep counts as
// "symbol-shaped work" — worth a nudge toward Serena instead — ONLY when THREE conditions are ALL
// true (§5.1, quoted directly from docs/superpowers/specs/2026-08-06-process-enforcement-design.md,
// not summarized):
//   (א) היעד קוד      — the search targets code (a code `type`/`glob`, or a code-shaped `path`
//                        such as src/ or app.js)
//   (ב) הדפוס סימבול  — the pattern is a bare exposed identifier, matched EXACTLY as §5.1 states
//                        it (`^[A-Za-z_]\w*$`) — nothing wider. §4 fix round 1 (coordinator
//                        review, 2026-08-08): an earlier version of this file also matched
//                        `def|function|class X` declaration forms. That was a widening of an
//                        approved spec condition made in code, which §4 reserves for the owner —
//                        not something a plan or implementation gets to decide. It is also, on
//                        its own terms, incoherent: `function renderWorkplan` warned while
//                        `export function renderWorkplan` and `renderWorkplan ` (trailing space)
//                        did not — a boundary that surprises the person who trips it is exactly
//                        the failure this task exists to avoid. Removed. `function renderWorkplan`
//                        (it contains a space — the brief's own named silent case) is now silent,
//                        same as any other non-bare-identifier pattern. See this task's report for
//                        the definition-shaped-search idea carried to the owner as a spec question,
//                        not decided here.
//   (ג) serena חיה   — the live MCP endpoint actually answers (lib/serena-probe.mjs — the SAME
//                        liveness definition scripts/serena-server.ps1 already uses for the
//                        watchman gate, not a second one; see that module's own header)
//
// "כל השאר עובר בשקט" — everything else passes in total silence: Hebrew search, a pattern with
// spaces, a docs/** sweep, a code-shaped search while serena happens to be down. This is a WARN
// only, NEVER a block: Serena being the sharper tool for this one search does not mean grep is
// forbidden, and per the brief, a gate that interrupts legitimate work gets switched off within a
// day — silence on everything but the narrow conjunction is the whole point of §5.1.
//
// (ג) IS WHAT PREVENTS PUNISHING AN INFRASTRUCTURE OUTAGE: serena disconnected -> this rule
// returns allow with no warning and no record, full stop — see lib/serena-probe.mjs's header for
// why isSerenaLive() fails toward false rather than throwing, and §5.1's own note that a serena
// outage is reported ONCE by watchman/session-start as an infrastructure event, never re-reported
// per-Grep (that would turn one outage into dozens of identical warnings).
import { isSerenaLive } from '../lib/serena-probe.mjs';

const CODE_TYPES = new Set([
  'js', 'ts', 'tsx', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rust', 'rs', 'java', 'c', 'cpp', 'cc',
  'h', 'hpp', 'cs', 'rb', 'php', 'kotlin', 'kt', 'swift', 'scala',
]);
const CODE_GLOB = /\.(m?js|ts|tsx|jsx|py|go|rs|java|c|cpp|cc|h|hpp|cs|rb|php|kt|swift|scala)$/i;
const CODE_PATH = /(^|[\\/])(src|scripts)([\\/]|$)|(^|[\\/])app\.(js|css)$/i;

const BARE_IDENTIFIER = /^[A-Za-z_]\w*$/;

function isCodeTarget(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  const { type, glob, path } = toolInput;
  if (typeof type === 'string' && CODE_TYPES.has(type.toLowerCase())) return true;
  if (typeof glob === 'string' && CODE_GLOB.test(glob)) return true;
  if (typeof path === 'string' && CODE_PATH.test(path)) return true;
  return false;
}

function isSymbolPattern(pattern) {
  if (typeof pattern !== 'string') return false;
  return BARE_IDENTIFIER.test(pattern);
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Grep') {
    return { decision: 'allow', reason: 'not a Grep call' };
  }
  const toolInput = input.tool_input;
  const pattern = toolInput && toolInput.pattern;

  if (!isCodeTarget(toolInput)) {
    return { decision: 'allow', reason: '§5.1 (א) not met: target is not code — passes in silence' };
  }
  if (!isSymbolPattern(pattern)) {
    return { decision: 'allow', reason: '§5.1 (ב) not met: pattern is not a bare identifier — passes in silence' };
  }

  // Only probe the network once the first two (free, synchronous) conditions already matched —
  // no reason to pay the round trip for the overwhelming majority of Grep calls this never fires
  // on at all.
  const live = await isSerenaLive();
  if (!live) {
    return { decision: 'allow', reason: '§5.1 (ג) not met: serena is not live — total silence, an unavailable tool cannot be demanded' };
  }

  return {
    decision: 'warn',
    reason: `§10.17/§5.1: this Grep targets code with a bare-identifier pattern ("${pattern}") and `
      + 'Serena is live — symbol-shaped work like this is usually faster and more precise via '
      + 'Serena (find_symbol / find_referencing_symbols) than grep + text edits on a large file.',
  };
}
