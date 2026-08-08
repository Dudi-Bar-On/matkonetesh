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
//
// TASK 13 (R-116): the SAME three conditions now also apply to a Bash command whose leading
// segment word is grep/rg/findstr/select-string — the door this rule was blind to (105 greps
// through Bash, 0 through the Grep tool, measured over one shift). Normalization to a
// Grep-tool-shaped candidate is lib/bash-grep-extract.mjs's job, shared with
// geniza-fallback-declaration.mjs; this file still owns and applies its own (א)/(ב) conditions
// unchanged, on whichever candidates it is handed — through `passesConditions()` below, the ONE
// function both the Grep-tool candidate and every Bash-derived candidate flow through. There is
// no second copy of the (א)/(ב) test anywhere in this file.
//
// TASK 13 FIX ROUND 1 (coordinator review, 2026-08-08): the coordinator drove the rule directly
// and found `grep -n "tool_name" scripts/hooks/rules/symbolic-grep-use-serena.mjs` — a targeted
// read of ONE already-known code file — warned. That is the brief's own named counter-case
// ("a targeted grep of a KNOWN file... is not a corpus search and must stay silent"), applied here
// to code the same way geniza-fallback-declaration.mjs already applies it to docs: `requireSweep`
// below rejects a single named file, same `isSweepTarget()` from the shared lib, same reasoning —
// a grep of one file you already know the name of is not the corpus/symbol sweep §5.1 exists to
// redirect toward Serena. Scoped to the Bash-derived candidates only, same as the geniza rule: the
// Grep tool has no `isSweep` field to begin with (the tool's own `path` semantics were never part
// of this task), so `requireSweep` is simply inert there — same function, no behavior change on
// that path, confirmed by the untouched Grep-tool checks in the test suite.
//
// The coordinator's OTHER two reported false positives (a Hebrew pattern and a spaced phrase, both
// against a `docs/` target) were investigated per their own instruction — confirm or refute by
// measurement before changing anything — and refuted: printed `extractBashGrepInvocations()`'s
// actual output for both exact commands and it returns the full, untruncated pattern in each case
// (`"מדריך האש"`, `"source authority"`); `isSymbolPattern()` correctly rejects both (a full-string
// match against `^[A-Za-z_]\w*$` cannot pass with a non-ASCII character or an internal space
// present anywhere in the string). Re-ran both exact commands through the real CLI with a live
// fake Serena server (scratchpad diagnostic script, output in this task's report) and both
// resolved `allow`, no `systemMessage` — silent, as (ב) requires. Independently, both target
// `docs/`, which `CODE_PATH` can never match (no `src`/`scripts` segment, no `app.js`/`app.css`),
// so (א) alone already makes a warn impossible for either call regardless of the pattern's shape.
// No code change was made for these two on that basis — see the report for the full trace.
import { isSerenaLive } from '../lib/serena-probe.mjs';
import { extractBashGrepInvocations } from '../lib/bash-grep-extract.mjs';

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

// THE ONE function (א)+(ב) are applied through, for every candidate regardless of source. A
// Bash-derived candidate additionally requires `isSweep` (set by lib/bash-grep-extract.mjs) —
// the targeted-known-file exemption; a Grep-tool candidate never carries that field, so
// `requireSweep` is a no-op there and its behavior is exactly what it was before this fix round.
function passesConditions(candidate, { requireSweep } = {}) {
  if (!isCodeTarget(candidate)) return false;
  if (!isSymbolPattern(candidate && candidate.pattern)) return false;
  if (requireSweep && !candidate.isSweep) return false;
  return true;
}

// Candidates to inspect for this call: the Grep tool's own structured input as a single
// candidate, or every grep-like segment normalized out of a Bash command's text. Any other tool
// call yields no candidates at all, which is `[]`, distinct from `null` — see evaluate() below.
function candidatesFor(input) {
  if (input.tool_name === 'Grep') return [input.tool_input];
  if (input.tool_name === 'Bash') {
    return extractBashGrepInvocations(input.tool_input && input.tool_input.command);
  }
  return null;
}

export async function evaluate(input) {
  const candidates = input && candidatesFor(input);
  if (!candidates) {
    return { decision: 'allow', reason: 'not a Grep call or a grep-like Bash command' };
  }

  const requireSweep = input.tool_name === 'Bash';
  const matched = candidates.find((c) => passesConditions(c, { requireSweep }));
  if (!matched) {
    return {
      decision: 'allow',
      reason: candidates.length === 0
        ? 'not a Grep call or a grep-like Bash command'
        : '§5.1 (א)/(ב) not met for any grep-like target in this call — passes in silence',
    };
  }

  // Only probe the network once the first two (free, synchronous) conditions already matched —
  // no reason to pay the round trip for the overwhelming majority of calls this never fires on.
  const live = await isSerenaLive();
  if (!live) {
    return { decision: 'allow', reason: '§5.1 (ג) not met: serena is not live — total silence, an unavailable tool cannot be demanded' };
  }

  return {
    decision: 'warn',
    reason: `§10.17/§5.1: this ${input.tool_name} targets code with a bare-identifier pattern `
      + `("${matched.pattern}") and Serena is live — symbol-shaped work like this is usually `
      + 'faster and more precise via Serena (find_symbol / find_referencing_symbols) than grep + '
      + 'text edits on a large file.',
  };
}
