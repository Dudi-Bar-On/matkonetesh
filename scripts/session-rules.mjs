#!/usr/bin/env node
// scripts/session-rules.mjs — re-reads the rules into context; session-brief.mjs (companion script)
// answers "where are we"; this one answers "what are the rules, verbatim, right now".
//
// WHY THIS EXISTS, AND WHY IT IS A SEPARATE SCRIPT FROM session-brief.mjs.
// A compliance gate (check-meta.mjs) reports whether the rules were followed. session-brief.mjs
// reports the project's position. Neither RESTORES the rules into the agent's working context after
// compaction deletes them — and the project's own doctrine is explicit that this is the actual
// failure mode: "Memory is not a substitute for re-reading. 'I remember this skill' is a red flag —
// skills and rules are re-read at invocation, never recalled." (CLAUDE.md, banner line). A gate
// printing green after compaction restores nothing; work continues without the rules in context,
// which is the exact drift COMPLIANCE-AUDIT-2026-08-01.md documented for a full day.
// Kept as its own file (not folded into session-brief.mjs) because the two have different profiles:
// session-brief is small and computed (git log, table parsing); this one is large and purely
// re-emits existing text verbatim. Mixing them would make the position digest slow/noisy on every
// run for the sake of content that does not change shape run-to-run, and would make it harder to
// reason about the token budget of each independently.
//
// BUDGET DECISION (stated explicitly, per the owner's request to justify the tension between
// completeness and cost): full verbatim text for exactly four things — the always-loaded project
// instructions (CLAUDE.md), the memory index (MEMORY.md — itself already a one-line-per-topic
// index; the ~27 individual memory docs it points to are NOT dumped, the index's own descriptions
// serve as the named-with-path-and-reason pointer to each), and from the discipline document: the
// DoD gate (§3), the Waiver Gate (§4), the owner's standing instructions (§10, all subsections —
// this is the section the audit found was silently unread the day of the failure), and the full
// lessons log (§11 — every L-numbered entry). Everything else in the discipline document (pipeline,
// debugging protocol, reviewer discipline, thinking models, testing infra, operating model, H8–H15
// ruling summaries, etc.) is named with its path/heading and a one-line reason instead of quoted —
// those sections are either stable reference material not implicated in the audit's failure list,
// or already summarized correctly elsewhere (H8–H15 are one-paragraph rulings, not multi-step
// procedures whose paraphrase caused a documented failure). The measured total below is the actual
// number, not an estimate — see the run output pasted in the task's report.
//
// Extraction is anchor-based (regex on heading text), never hardcoded line numbers — the document
// has already reordered sections once (§10's subsections are split across two physically distant
// regions of the file, 10.1-10.10 then 10.11-10.21+10.12 embedded after the lessons log) and a
// line-number-pinned extractor would silently go stale the next time it is edited, which is exactly
// the class of "quietly stopped covering what it claims to cover" failure this project's own audit
// document (H8 §10 finding) is about.
//
// Read-only. Must never fail the session: every read is guarded; a missing file prints
// "not established" for that section and the script still exits 0.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NA = 'not established';
const rule = (ch = '=') => ch.repeat(78);

function readOrNA(path, label) {
  if (!existsSync(path)) return { ok: false, text: `${NA} — ${label} not found at ${path}` };
  try {
    return { ok: true, text: readFileSync(path, 'utf8') };
  } catch (e) {
    return { ok: false, text: `${NA} — could not read ${label} (${e.message.split('\n')[0]})` };
  }
}

// Slice discipline.md between an opening heading regex and the next heading that matches `stop`.
// NOTE: deliberately does NOT rely on regex.lastIndex — stopRe is typically a non-global regex
// (bug caught while verifying: lastIndex is silently ignored on a non-'g' regex, so .exec always
// restarts from index 0 of the *whole* string, which previously matched the FIRST "### 10.N"
// heading in the document — one that appears BEFORE "## 11. Lessons log" even starts — producing
// an empty slice. Fixed by searching only the substring after the start match.).
function sliceSection(text, startRe, stopRe) {
  const startMatch = startRe.exec(text);
  if (!startMatch) return null;
  const from = startMatch.index;
  const afterStart = from + startMatch[0].length;
  const rest = text.slice(afterStart);
  const stopMatch = stopRe.exec(rest);
  const to = stopMatch ? afterStart + stopMatch.index : text.length;
  return text.slice(from, to).trimEnd();
}

// Every "### 10.N ..." block anywhere in the file, in file order, each running to the next
// heading (## or ###). Robust to §10's subsections being split across two regions of the file.
function collectStandingInstructions(text) {
  const headingRe = /^### 10\.\d+[a-z]?\b[^\n]*$/gm;
  const anyHeadingRe = /^#{2,3} /gm;
  const heads = [...text.matchAll(headingRe)];
  if (!heads.length) return null;
  const intro = sliceSection(text, /^## 10\. .*$/m, /^### /m);
  const blocks = heads.map((h, i) => {
    anyHeadingRe.lastIndex = h.index + h[0].length;
    const next = anyHeadingRe.exec(text);
    const end = next ? next.index : text.length;
    return text.slice(h.index, end).trimEnd();
  });
  return [intro, ...blocks].filter(Boolean).join('\n\n');
}

function main() {
  const parts = [];
  parts.push(rule());
  parts.push('SESSION-RULES — a RE-READ, not a recollection.');
  parts.push(
    'This is the verbatim text of the rules, emitted fresh into context because a SessionStart hook\'s\n' +
    'stdout is injected here — it is not a paraphrase and must not be treated as one. If anything below\n' +
    'is unclear or this digest looks truncated/stale, open the full source file directly before starting\n' +
    'the next task: CLAUDE.md, docs/process/development-discipline.md, and the memory files it indexes.\n' +
    '"I remember this rule" is, per this project\'s own doctrine, a red flag — not a reason to skip reading.'
  );
  parts.push(rule());

  // 1) Always-loaded project instructions — full.
  parts.push('\n' + rule('-'));
  parts.push('CLAUDE.md (project root) — FULL TEXT');
  parts.push(rule('-'));
  const claudeMd = readOrNA(join(ROOT, 'CLAUDE.md'), 'CLAUDE.md');
  parts.push(claudeMd.text);

  // 2) Memory index — full. (The ~27 individual memory docs it points to are intentionally NOT
  // dumped here; the index's own one-line descriptions ARE the named-with-path-and-reason pointer
  // to each — opening any one of them is a deliberate follow-up action, not part of this budget.)
  parts.push('\n' + rule('-'));
  const cwdEncoded = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
  const memoryIndexPath = join(homedir(), '.claude', 'projects', cwdEncoded, 'memory', 'MEMORY.md');
  parts.push(`MEMORY INDEX (${memoryIndexPath}) — FULL TEXT`);
  parts.push(rule('-'));
  const memIdx = readOrNA(memoryIndexPath, 'memory index');
  parts.push(memIdx.text);

  // 3) Discipline document excerpts — full, verbatim, anchor-extracted.
  const discPath = join(ROOT, 'docs', 'process', 'development-discipline.md');
  const disc = readOrNA(discPath, 'development-discipline.md');
  if (disc.ok) {
    const dodGate = sliceSection(disc.text, /^## 3\. .*$/m, /^## \d/m);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §3 — THE DoD GATE — FULL TEXT');
    parts.push(rule('-'));
    parts.push(dodGate ?? `${NA} — §3 heading not found (document structure may have changed).`);

    const waiverGate = sliceSection(disc.text, /^## 4\. .*$/m, /^## \d/m);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §4 — THE WAIVER GATE — FULL TEXT');
    parts.push(rule('-'));
    parts.push(waiverGate ?? `${NA} — §4 heading not found (document structure may have changed).`);

    const standing = collectStandingInstructions(disc.text);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §10 — OWNER\'S STANDING INSTRUCTIONS (all 10.x subsections) — FULL TEXT');
    parts.push(rule('-'));
    parts.push(standing ?? `${NA} — no "### 10.N" headings found (document structure may have changed).`);

    // Lessons log: from "## 11. Lessons log" up to the first embedded "### 10.N" heading (the point
    // where the file's §10 subsections physically resume inside what is nominally §11's range —
    // see the header comment above). That boundary is content-based, not a hardcoded line number.
    const lessons = sliceSection(disc.text, /^## 11\. Lessons log.*$/m, /^### 10\.\d/m);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §11 — FULL LESSONS LOG — FULL TEXT');
    parts.push(rule('-'));
    parts.push(lessons ?? `${NA} — §11 heading (or its 10.x boundary) not found (document structure may have changed).`);
  } else {
    parts.push('\n' + rule('-'));
    parts.push(`development-discipline.md — ${disc.text}`);
  }

  // 4) Everything else in the discipline document — named, not quoted, one line each with why.
  parts.push('\n' + rule('-'));
  parts.push('development-discipline.md — NOT quoted here (named + one-line reason; open the file for these):');
  parts.push(rule('-'));
  const named = [
    ['§0–§2', 'why the doc exists, the skills list, the pipeline', 'stable reference, not implicated in the audit\'s findings'],
    ['§5–§9', 'debugging protocol, failure-mode map, reviewer discipline, retro, settled decisions', 'procedural detail, consulted on-demand (debugging/review), not needed to START a task'],
    ['§12', 'thinking models', 'consulted when a task calls for one, not on every session start'],
    ['§11a', 'testing infrastructure (worker ceiling, port collisions, server restart)', 'only relevant when actually running the suite'],
    ['§13', 'Operating Model — Main vs subagents', 'one-time onboarding content, not a per-task rule'],
    ['§14–§18', 'H8 (full-landing), H9–H12 (summaries/board/status), H13 (recovery gate), H14 (UX report), H15 (model selection)', 'each is a short, already-quotable ruling — CLAUDE.md\'s own loader table already carries a one-line pointer to each'],
  ];
  for (const [id, title, reason] of named) parts.push(`  ${id} — ${title} — ${reason}`);

  parts.push('\n' + rule());
  const bodyText = parts.join('\n');
  const lineCount = bodyText.split('\n').length + 2; // +2 for the footer line and closing rule pushed next
  const byteCount = Buffer.byteLength(bodyText, 'utf8');
  parts.push(`END SESSION-RULES — ${lineCount} lines, ${byteCount}+ bytes total (excl. footer). This is a re-read, not a summary.`);
  parts.push(rule());
  console.log(parts.join('\n'));
}

try {
  main();
} catch (e) {
  console.log(`session-rules: WARN — could not emit the rules digest (${e.message.split('\n')[0]}). Open CLAUDE.md and docs/process/development-discipline.md directly. The compliance gate (check-meta.mjs) is unaffected.`);
}
process.exit(0);
