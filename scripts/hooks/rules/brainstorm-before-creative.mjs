// scripts/hooks/rules/brainstorm-before-creative.mjs — §6.4 trigger 1 (task-7-brief.md): "creative
// work (new spec/plan/feature) before an approved design exists" stops being a sentence in
// CLAUDE.md and becomes a PreToolUse gate on Write/Edit.
//
// FIX ROUND 1 (coordinator review, 2026-08-08 — the finding, quoted): "the rule treats 'an approved
// spec exists in the register' as clearance. Nineteen specs are approved there, so that condition is
// true essentially always, and the rule collapses to 'block only if the register has zero
// approvals'." Driving the rule with a transcript containing NO skill invocation at all proved a
// plans/ write and a brand-new source file BOTH allowed regardless of which spec, if any, actually
// governed that write — the original "some spec somewhere is approved" check was not evidence ABOUT
// THIS WRITE. This round replaces that blanket check with two per-write-specific checks (below);
// the escape's SHAPE (skill invocation, or a compatible alternative named in the deny reason) is
// unchanged — only WHICH register evidence counts as that alternative is tightened.
//
// TWO INDEPENDENT GATED SHAPES, each a separate branch below:
//
//   BRANCH A — a write INTO docs/superpowers/specs/ or docs/superpowers/plans/ (new or existing
//   file). Passes iff `superpowers:brainstorming` (or, for plans/ only, `superpowers:writing-plans`
//   — an approved spec is THAT skill's own precondition, so invoking it already implies one) was
//   invoked recently in this transcript, OR — plans/ only — THIS PLAN's OWN FILENAME corresponds to
//   an approved row in the register (see PLAN-NAME MATCHING below; NOT "some spec is approved").
//
//   BRANCH B — a brand-NEW source file (`.js/.mjs/.py/.ts/.css/.html`) outside docs/, scripts/tests/,
//   tests/, .superpowers/, mockups/, and any scratchpad path. Passes iff `superpowers:brainstorming`
//   was invoked recently, OR there is an ACTIVE ARC (scripts/session-state.mjs's own `activeArc()`)
//   whose GOVERNING SPEC (that same module's `governingSpecFile()`) is an approved row in the
//   register (see GOVERNING-SPEC CHECK below; NOT "some spec is approved, and some ledger exists").
//
// EVIDENCE SOURCE — OWNER RULING, Q3 + follow-up (2026-08-08): "evidence that an approved spec
// exists is a row in the approvals section of the register — docs/ROADMAP-2026-07-30.md, the section
// headed 'מרשם האישורים — מפרטים שאושרו על-ידי הבעלים', NOT a marker line inside the spec file. The
// owner APPROVED 19 specs there and left 6 DELIBERATELY BLOCKED." A row reads
//   | `<spec filename>` | **מאושר (YYYY-MM-DD)** | <evidence> |
// A blocked row reads
//   | `<spec filename>` | 🔴 **לא-מאושר — הכרעת בעלים 8.8.26** | <evidence> |
// A row's status cell counts as approved ONLY when it starts with the bold `**מאושר (` marker — a
// blocked row's cell starts with the 🔴 emoji, never with `**מאושר`, so the substring "מאושר" that
// also appears inside "לא-מאושר" can never false-positive a blocked row as approved (tested directly
// against both real shapes).
//
// PLAN-NAME MATCHING (Branch A, plans/-only escape) — "a stem/token comparison, not equality" per
// the coordinator's own example: `2026-08-08-enforcement-phase-4-group-b.md` (a plan) against
// `2026-08-06-process-enforcement-design.md` (its actual governing spec, per that plan's own "Goal:"
// line) share no equal filename, but share the meaningful token "enforcement" once each name's date
// prefix and generic suffix words are stripped. The match rule, concretely:
//   1. Strip the leading `YYYY-MM-DD-` date prefix and the `.md` extension from BOTH the write's own
//      filename and every register row's filename.
//   2. Split the remainder on any non-alphanumeric run, lowercase, and keep only tokens of length
//      >= 4 that are not in a small suffix-stopword list (`design`, `spec`, `specs`, `plan`, `plans`,
//      `charter`, `doc`, `docs`, `final`, `draft`, `v1`, `v2`, `v3`) — this is what keeps a bare date
//      (already stripped) or a generic suffix word from counting as a "match" on its own; without it,
//      nearly every plan/spec pair in this repo would share "design" or "plan" and the check would
//      collapse right back into the blanket condition this round exists to remove.
//   3. Score each register row by the SIZE of the token-set intersection with the write's own
//      filename tokens; the row with the highest nonzero score is the match. Zero shared tokens (or
//      an EMPTY token set for the write's own filename, e.g. a generically-named `new-plan.md`) is
//      NO MATCH — not "match everything", the opposite failure mode from the one this round fixes.
//   4. NEAR-MISS HANDLING: this is token-set overlap, not edit-distance — a plan named with a genuine
//      typo of an approved spec's stem (e.g. one letter different in a shared token) will still match
//      because the *other* tokens in that stem still overlap in the common case; a plan sharing NO
//      token at all is treated as unrelated, full stop, with no fuzzy/typo-tolerant fallback. This is
//      deliberately conservative: a near-miss that silently authorizes creative work is a worse
//      failure than a genuine near-miss plan needing a rename or an explicit brainstorming/
//      writing-plans invocation instead.
//   A match whose register row is NOT approved (i.e. one of the owner's 6 deliberately-blocked specs)
//   is reported as a match, but does not clear the write — this is the exact case §6.4 exists to
//   stop, and the deny reason says so explicitly (names the matched-but-unapproved spec by name).
//
// GOVERNING-SPEC CHECK (Branch B) — reuses scripts/session-state.mjs's OWN definitions of "what arc
// is active" (`activeArc()`) and "what spec authorizes it" (`governingSpecFile()`, added this round
// as a raw-data sibling of the existing `governingSpec()` formatter) rather than inventing a second,
// competing definition of either. `governingSpecFile()` is the newest-modified file under
// docs/superpowers/specs/ — session-state.mjs's own stated reasoning ("plans expire; the spec that
// authorized the arc is what still binds") already treats that as the arc's governing spec, so this
// rule does not re-derive a per-ledger spec reference by parsing plan text. No active arc, or no spec
// file found, or the exact governing-spec filename absent from the register (or present but marked
// blocked) all resolve to "does not clear" — for the last of those, correctly BLOCKS: an active arc
// working against one of the owner's 6 deliberately-unapproved specs is exactly what must stop.
//
// FAIL-OPEN (same contract as every rule in this pipeline — fix-cycle-limit.mjs's header states it
// at length): the register file missing/unreadable/unparseable, the transcript missing/unreadable,
// and (Branch B) no determinable active arc AT ALL all resolve to "cannot determine" — a gating
// branch that cannot determine its own evidence must ALLOW, never block on an inference from
// absence. Only a POSITIVELY read register showing "no match" / "matched but unapproved" blocks.
//
// COST DISCIPLINE: every check in evaluate() itself is a string/path comparison BEFORE either the
// transcript or the register is ever read — an ordinary Edit to an existing, non-gated file returns
// `allow` from a single normalized-path comparison and pays no I/O at all.
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillInvokedSince, DEFAULT_SKILL_WINDOW_MS } from '../lib/skill-invoked.mjs';

// DESIGN WINDOW — deliberately much longer than the 20-minute default, and the reason is measured
// rather than guessed. On 2026-08-08 this rule blocked the spec that a design conversation had just
// produced: `superpowers:brainstorming` was invoked at 14:52, the spec was written at 16:02, and the
// default window is 20 minutes. The block was correct per the code and wrong per the intent.
//
// The two triggers ask different questions and cannot share a window. §6.4 trigger 2 asks "was
// debugging invoked BETWEEN this failure and this fix" — a tight, causal window is exactly right
// there. This trigger asks "did design precede this creative work", and design is not an event that
// decays: a spec is written at the END of a conversation that can easily run an hour or more, and
// nothing about that conversation becomes less true because time passed.
//
// Four hours, not "the whole session", because a transcript is read backwards over a window and an
// unbounded scan of a 38 MB file on every Write is a cost this rule should not impose. Four hours
// covers a long design session with room to spare; anything older is a different day's design and
// should be evidenced by the register approval instead, which is the other escape this rule names.
const DESIGN_WINDOW_MS = 4 * 60 * 60 * 1000;
import { activeArc, governingSpecFile } from '../../session-state.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

// Same env-override convention scripts/session-state.mjs already uses for the same document — a
// test fixture points this at a disposable register; production reads the real one. Re-read on
// every call (unlike scripts/session-state.mjs's own SDD_DIR/SPECS_DIR, which are module-load-time
// constants — see that module's header, and skill-invoked.mjs's test-file discovery of the same
// trap) so a test can vary the register mid-run without re-importing this module.
function roadmapPath() {
  return process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
}

const REGISTER_HEADER_RE = /^##\s*מרשם האישורים/m;
const NEXT_HEADING_RE = /^##\s/;
const ROW_RE = /^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/;
// Matches ONLY an approved row's status cell — see header comment for why a blocked row (which
// starts with the 🔴 emoji) can never match this even though "מאושר" is also a substring of
// "לא-מאושר".
const APPROVED_STATUS_RE = /^\*\*מאושר\s*\(/;

// Returns { determined, rows }. determined=false -> register missing/unreadable; caller must treat
// this exactly like skillInvokedSince's determined=false (fail open, never a block). determined=true
// -> `rows` is every parsed `{ file, approved }` row in the approvals section (possibly empty — a
// readable register with no approvals section, or an empty one, is still a determined "no rows").
function registerRows() {
  let text;
  try {
    text = readFileSync(roadmapPath(), 'utf8');
  } catch {
    return { determined: false, rows: [] };
  }
  const lines = text.split('\n');
  const headerIdx = lines.findIndex((l) => REGISTER_HEADER_RE.test(l));
  if (headerIdx === -1) return { determined: true, rows: [] };
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (i > headerIdx + 1 && NEXT_HEADING_RE.test(line)) break; // left the section
    const m = line.match(ROW_RE);
    if (m) rows.push({ file: m[1].trim(), approved: APPROVED_STATUS_RE.test(m[2].trim()) });
  }
  return { determined: true, rows };
}

// See PLAN-NAME MATCHING in the header comment for the full rationale on each step.
const FILENAME_STOPWORDS = new Set([
  'design', 'spec', 'specs', 'plan', 'plans', 'charter', 'doc', 'docs', 'final', 'draft',
  'v1', 'v2', 'v3',
]);
function tokenizeFilename(file) {
  const stem = String(file).replace(/\.md$/i, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return stem
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 4 && !FILENAME_STOPWORDS.has(t));
}

// Returns the register row whose filename shares the MOST tokens with `candidateFile` (score > 0),
// or null when no row shares any token (including when candidateFile itself tokenizes to nothing —
// an empty intersection with anything is always empty).
function bestTokenMatch(rows, candidateFile) {
  const candTokens = new Set(tokenizeFilename(candidateFile));
  if (candTokens.size === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = tokenizeFilename(row.file).filter((t) => candTokens.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best;
}

function findExactRow(rows, file) {
  return rows.find((r) => r.file === file) || null;
}

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.py', '.ts', '.css', '.html']);

const SPECS_DIR_RE = /(^|[\\/])docs[\\/]superpowers[\\/]specs([\\/]|$)/i;
const PLANS_DIR_RE = /(^|[\\/])docs[\\/]superpowers[\\/]plans([\\/]|$)/i;

// Paths this rule treats as NOT "creative work" even for a brand-new file with a gated extension —
// tests, reports, ledgers, scratch files, and anything under .superpowers/ (the SDD machinery
// itself, briefs/plans/ledgers/reports for THIS process, not product code).
function isExcludedPath(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return /(^|\/)docs(\/|$)/i.test(norm)
    || /(^|\/)scripts\/tests(\/|$)/i.test(norm)
    || /(^|\/)tests(\/|$)/i.test(norm)
    || /(^|\/)\.superpowers(\/|$)/i.test(norm)
    || /(^|\/)mockups(\/|$)/i.test(norm)
    || /(^|\/)scratchpad(\/|$)/i.test(norm);
}

const BRAINSTORM_RE = /brainstorming/;
const BRAINSTORM_OR_PLANS_RE = /brainstorming|writing-plans/;

const REGISTER_NAME = 'docs/ROADMAP-2026-07-30.md — "מרשם האישורים — מפרטים שאושרו על-ידי הבעלים"';

function blockReason(what) {
  return '§6.4 trigger 1 (development-discipline.md): creative work before an approved design must '
    + 'not happen — brainstorming is the required first step. '
    + `${what} Invoke \`superpowers:brainstorming\` before this write, or work against a spec that `
    + `is already marked approved in the register (${REGISTER_NAME}).`;
}

function degraded(what) {
  return { decision: 'allow', reason: `§6.4 trigger 1 degraded: ${what} — allowing rather than blocking on unreadable/undeterminable evidence.` };
}

function evaluateBranchA(input, filePath, isPlans) {
  const skillRe = isPlans ? BRAINSTORM_OR_PLANS_RE : BRAINSTORM_RE;
  const skill = skillInvokedSince(input.transcript_path, skillRe, DESIGN_WINDOW_MS, undefined, input.agent_id);
  if (skill.determined && skill.invoked) {
    return {
      decision: 'allow',
      reason: `§6.4 trigger 1: a ${isPlans ? 'brainstorming/writing-plans' : 'brainstorming'} skill `
        + 'invocation was found in this transcript\'s recent window — design work was done first.',
    };
  }
  if (!skill.determined) {
    // Requirement 3, verbatim case: an unreadable transcript on a gating path must never read as an
    // accusation. This resolves BEFORE the register check on purpose — a missing/undetermined
    // transcript is infrastructure absence, not evidence against the writer.
    return degraded('no readable transcript evidence of a skill invocation either way');
  }
  let matchNote = '';
  if (isPlans) {
    const reg = registerRows();
    if (!reg.determined) return degraded(`the register (${REGISTER_NAME}) could not be read`);
    const match = bestTokenMatch(reg.rows, basename(filePath));
    if (match && match.approved) {
      return {
        decision: 'allow',
        reason: `§6.4 trigger 1: this plan's own filename matches the approved register row for `
          + `\`${match.file}\` (${REGISTER_NAME}, token comparison, not equality) — writing a plan `
          + 'against that approved design work is not gated.',
      };
    }
    matchNote = match
      ? ` A register entry matching this plan's name was found (\`${match.file}\`), but it is `
        + 'NOT marked approved there — the owner deliberately left that one unapproved.'
      : ' No register entry\'s filename shares a meaningful token with this plan\'s own filename.';
  }
  return {
    decision: 'block',
    reason: blockReason(
      `Write/Edit to \`${filePath}\` (under docs/superpowers/${isPlans ? 'plans' : 'specs'}/) has no `
      + 'brainstorming (or, for a plan, writing-plans) invocation in this transcript\'s recent window.'
      + matchNote,
    ),
  };
}

function evaluateBranchB(input, filePath) {
  const skill = skillInvokedSince(input.transcript_path, BRAINSTORM_RE, DESIGN_WINDOW_MS, undefined, input.agent_id);
  if (skill.determined && skill.invoked) {
    return {
      decision: 'allow',
      reason: '§6.4 trigger 1: a brainstorming skill invocation was found in this transcript\'s '
        + 'recent window — design work was done first.',
    };
  }
  if (!skill.determined) {
    return degraded('no readable transcript evidence of a skill invocation either way');
  }

  let arc;
  try {
    arc = activeArc();
  } catch {
    return degraded('the active arc could not be determined (scripts/session-state.mjs threw)');
  }
  if (!arc || !arc.ledger) {
    return degraded('no active arc ledger was found — nothing to check a governing spec against');
  }

  let spec;
  try {
    spec = governingSpecFile();
  } catch {
    return degraded('the governing spec could not be determined (scripts/session-state.mjs threw)');
  }
  if (!spec) {
    return degraded('no governing spec file was found under docs/superpowers/specs/');
  }

  const reg = registerRows();
  if (!reg.determined) return degraded(`the register (${REGISTER_NAME}) could not be read`);

  const row = findExactRow(reg.rows, spec.file);
  if (row && row.approved) {
    return {
      decision: 'allow',
      reason: `§6.4 trigger 1: the active arc's governing spec (\`${spec.file}\`) is an approved row `
        + `in the register (${REGISTER_NAME}) — this new file is tracked work against approved design.`,
    };
  }

  const specNote = row
    ? ` The active arc's governing spec (\`${spec.file}\`) has a register row, but it is NOT marked `
      + 'approved there — the owner deliberately left that one unapproved.'
    : ` The active arc's governing spec (\`${spec.file}\`) has no row at all in the register.`;
  return {
    decision: 'block',
    reason: blockReason(
      `Write to new source file \`${filePath}\` has no brainstorming invocation in this transcript's `
      + `recent window.${specNote}`,
    ),
  };
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Write' && input.tool_name !== 'Edit')) {
    return { decision: 'allow', reason: 'not a Write/Edit call' };
  }
  const filePath = input.tool_input && input.tool_input.file_path;
  if (typeof filePath !== 'string' || filePath === '') {
    return { decision: 'allow', reason: 'no file_path to inspect' };
  }

  if (SPECS_DIR_RE.test(filePath) || PLANS_DIR_RE.test(filePath)) {
    return evaluateBranchA(input, filePath, PLANS_DIR_RE.test(filePath));
  }

  const ext = extname(filePath).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(ext)) {
    return { decision: 'allow', reason: `not a gated extension (${ext || 'none'})` };
  }
  if (isExcludedPath(filePath)) {
    return { decision: 'allow', reason: 'path is under an excluded tree (docs/, scripts/tests/, tests/, .superpowers/, mockups/, scratchpad)' };
  }
  if (existsSync(filePath)) {
    return { decision: 'allow', reason: 'existing file — editing, not creating, is not "creative work before design"' };
  }

  return evaluateBranchB(input, filePath);
}
