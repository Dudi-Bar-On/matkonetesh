// scripts/hooks/rules/geniza-fallback-declaration.mjs — §10.13 (settled): "grep = fallback
// מוצהר". A Grep or WebSearch call aimed at DOCUMENTS, when the geniza was not queried first,
// WARNS — and the declaration becomes a record automatically: this rule writes the fallback down
// itself, into the same hooks-log.jsonl every other rule already appends to, without asking
// anyone. "אפס חיכוך, רישום מלא, והבעלים רואה כל אירוע בסיכום ה-session."
//
// TRIGGER ("aimed at documents"): a WebSearch call (inherently external-document research — there
// is no code-vs-docs axis for a web search), or a Grep call whose OWN target names markdown/docs
// (`type: 'md'`, a glob matching `*.md`, or a `path` under docs/ or sources/). A Grep over CODE
// (src/, app.js, a code `type`/glob, a bare-identifier pattern) is explicitly NOT this rule's
// business — §10.13 is about the geniza as a DOCUMENT store, not a code index. That is a
// deliberately DIFFERENT axis from symbolic-grep-use-serena.mjs's §5.1 conditions; the two rules
// are independent and a single Grep call can trip neither, either, or (in principle, on a search
// that somehow matches both a code path AND a docs glob) both.
//
// GATE: fires only when lib/geniza-consult.mjs POSITIVELY determines "no retrieval call found in
// the window" — see that module's header for the window, its stated reason, and why any
// inability to read the transcript resolves to silence rather than an accusation.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genizaConsultedRecently } from '../lib/geniza-consult.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DEFAULT_LOG_PATH = join(ROOT, '.superpowers', 'hooks-log.jsonl');

const DOC_GLOB_OR_TYPE = /\.md$/i;
const DOC_PATH = /(^|[\\/])(docs|sources)([\\/]|$)/i;

function isDocTargetedGrep(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  const { type, glob, path } = toolInput;
  if (typeof type === 'string' && /^md(own)?$/i.test(type)) return true;
  if (typeof glob === 'string' && DOC_GLOB_OR_TYPE.test(glob)) return true;
  if (typeof path === 'string' && DOC_PATH.test(path)) return true;
  return false;
}

// Reads the SAME log path pretooluse.mjs passes to the pipeline (PRETOOLUSE_LOG_PATH), so a test
// (or the real CLI) that redirects the log redirects this record too — this rule never invents a
// second file for the same "automatic record" fact, and leaves no state at a real repo path when
// the caller points it elsewhere (tests always do).
function logPath() {
  return process.env.PRETOOLUSE_LOG_PATH || DEFAULT_LOG_PATH;
}

// Never throws — mirrors pipeline.mjs's own safeLog: losing this one line to a full disk or a
// locked file is acceptable; the rule crashing (which the pipeline would then itself log as
// `rule_threw` and silently discard the warning entirely) is a worse outcome for the exact
// guarantee this rule exists to provide.
function recordFallback(record) {
  try {
    const path = logPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      `${JSON.stringify({ ts: new Date().toISOString(), kind: 'grep_fallback_declared', ...record })}\n`,
      'utf8',
    );
  } catch {
    // intentionally swallowed — see comment above.
  }
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Grep' && input.tool_name !== 'WebSearch')) {
    return { decision: 'allow', reason: 'not a Grep or WebSearch call' };
  }

  const isWebSearch = input.tool_name === 'WebSearch';
  const targeted = isWebSearch || isDocTargetedGrep(input.tool_input);
  if (!targeted) {
    return { decision: 'allow', reason: "§10.13: not aimed at documents (no docs/sources path, no .md glob/type) — not this rule's business" };
  }

  const { determined, consulted } = genizaConsultedRecently(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: '§10.13: no readable transcript evidence either way — not asserting a fallback without proof' };
  }
  if (consulted) {
    return { decision: 'allow', reason: '§10.13: the geniza was queried recently in this transcript — this call is a legitimate follow-up, not an undeclared bypass' };
  }

  const target = isWebSearch
    ? (input.tool_input && input.tool_input.query)
    : (input.tool_input && (input.tool_input.path || input.tool_input.glob || input.tool_input.pattern));
  const targetText = target ? String(target).slice(0, 120) : 'no target text';

  recordFallback({
    tool: input.tool_name,
    target: target ? String(target).slice(0, 200) : null,
  });

  return {
    decision: 'warn',
    reason: `§10.13 (settled): grep = fallback מוצהר — this ${input.tool_name} call is aimed at `
      + `documents (${targetText}) and the geniza was not queried in this transcript recently. `
      + 'Declared as a record automatically — nothing for you to do; the owner sees this event in '
      + 'the session summary. Prefer src.knowledge.retrieval.search_current_docs/semantic_search '
      + 'first when the same question can be asked there.',
  };
}
