#!/usr/bin/env node
// scripts/hooks/posttooluse.mjs — PostToolUse CLI entry point (Phase 4, Group B, Task 1). Mirrors
// pretooluse.mjs + pipeline.mjs collapsed into one file: observers have no severity lattice (no
// allow/warn/block to rank), so a separate pipeline module was not warranted here (YAGNI).
//
// PostToolUse fires AFTER a tool already ran — it cannot deny anything. This process is an EAR,
// not a mouth: observers RECORD (into the Task 2 store, once it exists), they never return a
// decision. The one rule this file exists to enforce on itself, same as pipeline.mjs: every
// failure mode (malformed stdin, an observer that throws, an observer that returns nonsense)
// resolves to exit 0 + `{}` on stdout + a named log record — never a crash, never a hang, never
// silence about what went wrong.
//
// ===============================================================================================
// MEASURED CONTRACT — this is the deliverable the next three tasks (2, 3, 10) depend on.
// ===============================================================================================
// The geniza was queried first (retrieval.search_current_docs("PostToolUse tool_response",
// filters={"namespace":"repo"})): zero hits on the raw stdin shape anywhere in the vendor corpus
// (docs/vendor/claude-code/*.md) or elsewhere except this task's own plan/brief. The corpus's one
// close match (claude-code-docs-41.md) documents only the SDK-level callback shape
// (`input_data["tool_input"]`), not the raw hook-process stdin contract, and not `tool_response`
// at all. So the shape below was MEASURED directly: a temporary PostToolUse hook
// (`matcher: "Bash"`) was wired into .claude/settings.json, ran live against three real Bash tool
// calls in this session, its stdin captured verbatim to a throwaway file, then removed. The
// temporary wiring hot-reloaded with no session restart — hook config changes take effect on the
// very next tool call.
//
// A SUCCESSFUL Bash call (`echo "..."`, exit 0) produced this PostToolUse payload (fields
// trimmed to the shape, values illustrative):
//   {
//     session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type,
//     effort: { level },
//     hook_event_name: "PostToolUse",
//     tool_name: "Bash",
//     tool_input: { command: "..." },
//     tool_response: {
//       stdout: "...",            // string, full captured stdout
//       stderr: "",                // string, full captured stderr
//       interrupted: false,        // boolean — user-interrupt flag, NOT a nonzero-exit flag
//       isImage: false,            // boolean — Bash-specific, always false observed
//       noOutputExpected: false,   // boolean
//     },
//     tool_use_id,
//     duration_ms,                 // number, milliseconds
//   }
// tool_response carries NO exit-code field and NO error/failure field of any kind. `interrupted`
// stayed false even on a genuinely nonzero-exit command (verified below) — it is not a proxy for
// command failure.
//
// *** THE LOAD-BEARING FINDING: a Bash command that exits non-zero does NOT produce a
// PostToolUse event at all. *** Three deliberately-failing commands (`false`; `exit 1`;
// `ls /nonexistent-path`) were run through the live Bash tool during measurement and NONE of them
// appended to the PostToolUse capture file — only the passing commands did. Cross-checking the
// vendor corpus (claude-code-docs-46.md's own hook-event table) explains why: `PostToolUseFailure`
// is a SEPARATE, distinctly-named hook event ("Tool execution failure" — Python + TypeScript SDK
// both expose it), not a field inside PostToolUse's tool_response. Wiring a temporary
// `PostToolUseFailure` hook (matcher "Bash") and running `exit 7` confirmed its actual shape:
//   {
//     session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id, agent_type, effort,
//     hook_event_name: "PostToolUseFailure",
//     tool_name: "Bash",
//     tool_input: { command: "exit 7" },
//     tool_use_id,
//     error: "Exit code 7",        // string — THIS is where the exit code lives, as free text
//     is_interrupt: false,          // boolean
//     duration_ms,
//   }
// No `tool_response` key at all on this event — `error` (a string, not a numeric field) replaces
// it, and the field name is `is_interrupt` here vs `interrupted` on PostToolUse (not the same
// name — do not assume symmetry between the two events).
//
// FIX ROUND 1 (coordinator ruling, 2026-08-08): the finding above was reclassified from "a concern
// for Tasks 2/3/10" to IN SCOPE for this task. Reasoning, verbatim from the ruling: every one of
// §6.1's fix-cycle counter and §6.4's second trigger keys on THE FAILING CASE; an entry point that
// structurally cannot see failures is not the entry point Group B needs, and three later tasks
// would each have discovered the same gap separately after already writing code against it. So
// PostToolUseFailure is now measured, wired, and normalized here, in this file.
//
// Re-measured `PostToolUseFailure` a second time (two more temp-hook captures, `exit 7` and
// `exit 42`), specifically to answer the two questions the ruling asked: is `session_id` present
// (yes — Group B keys all state on it), and is `tool_input` present with the command text (yes).
// Confirmed field-for-field identical to the first capture. Both captures are reproduced in full
// above/below; nothing here is inferred, both are read directly off real stdin.
//
// FIELD-NAME SYMMETRY, CHECKED EXPLICITLY (ruling's requirement #3): `tool_name`, `session_id`,
// `tool_input`, `tool_use_id`, `cwd`, `transcript_path`, and `hook_event_name` are the SAME field,
// same nesting, on BOTH events — an observer can read any of those without branching on which
// event fired. The outcome itself is NOT symmetric: PostToolUse carries `tool_response.interrupted`
// (nested, boolean, present on every successful call); PostToolUseFailure carries top-level
// `is_interrupt` (different name, different nesting, no `tool_response` key at all). A downstream
// counter that reads `input.tool_response.interrupted` unconditionally will silently see `undefined`
// on every failure — exactly the asymmetry the ruling asked to be named loudly. This is why
// runObservers() below computes a NORMALIZED `_outcome` object once, in one place, before handing
// input to any observer, rather than leaving every observer to rediscover this asymmetry itself.
//
// EXIT CODE, AS A FIRST-CLASS VALUE (ruling's requirement #4): PostToolUseFailure's only exit-code
// signal is the free-text `error` field (`"Exit code 7"`, `"Exit code 42"` — both captures confirm
// the exact prefix `"Exit code "` followed by a bare integer, no other text observed). Parsing that
// string is centralized in ONE function, `extractExitCode()`, exported and unit-tested below — no
// downstream observer should re-implement this regex. `_outcome.exit_code` is that parsed number,
// or `null` when unparseable/not applicable (the success path exposes no exit code at all — see
// above — so `_outcome.exit_code` is always `null` there, not a guessed `0`).
//
// WIRING DECISION (ruling's requirement #2): PostToolUseFailure is wired to the SAME script
// (posttooluse.mjs) and the SAME observers directory (scripts/hooks/observers/) as PostToolUse —
// not a separate failure-only observer list. Justification: the two events describe the same
// underlying fact (a tool call finished) with a different outcome, and Group B's own stated
// consumers (§6.1's fix-cycle counter, §6.4's failure-then-edit trigger) both need to correlate a
// failure with the surrounding successes in the SAME session — splitting them into two directories
// would force every such observer to duplicate itself to watch both lists. The `_outcome`
// normalization above is what makes one directory safe: an observer branches on `_outcome.ok`
// (a boolean it can rely on regardless of which event fired), not on remembering two raw shapes
// with no field in common.
//
// UNDOCUMENTED, NOT A CONTRACT: neither `PostToolUse` nor `PostToolUseFailure`'s raw stdin shape
// appears anywhere in this repo's vendor corpus (confirmed by geniza search, zero hits, both
// rounds). Every field name above was read off live captures taken 2026-08-08 against whatever
// Claude Code version was running this session — not against a published schema. Anything
// downstream that depends on these names is depending on a measurement, not a contract; if a future
// Claude Code upgrade changes shapes silently, `observer_nonsense_return`/the exit-code test below
// are the tripwires, not a version check this file has no way to perform.
// ===============================================================================================
import { readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

export const DEFAULT_OBSERVERS_DIR = join(HERE, 'observers');
export const DEFAULT_LOG_PATH = join(ROOT, '.superpowers', 'hooks-log.jsonl');

// Lists candidate observer modules. Missing/unreadable directory -> no observers, not an error:
// an empty observers dir is the expected state until Task 3 lands the first real one.
export function listObserverFiles(observersDir = DEFAULT_OBSERVERS_DIR) {
  try {
    return readdirSync(observersDir)
      .filter((f) => f.endsWith('.mjs'))
      .sort()
      .map((f) => ({ file: f, path: join(observersDir, f) }));
  } catch {
    return [];
  }
}

// Parses the exit code out of PostToolUseFailure's free-text `error` field (e.g. "Exit code 7").
// ONE place, per the fix-round ruling — nothing downstream should re-implement this regex.
// Returns a finite number, or null when the text doesn't match the observed "Exit code N" shape
// (missing/non-string input, an interrupt with different wording, a future format change, etc.) —
// null, never a guessed 0 or -1, because "could not determine" and "exit code was zero" must never
// look the same to a caller.
export function extractExitCode(errorText) {
  if (typeof errorText !== 'string') return null;
  const m = errorText.match(/Exit code (-?\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

// Computes the ONE normalized outcome shape both events are reduced to before any observer sees
// the input — see the header comment's "FIELD-NAME SYMMETRY" section for why this exists. Never
// throws: an input shaped like neither measured event still gets a safe, all-null/false outcome
// rather than a crash.
function normalizeOutcome(input) {
  if (input && input.hook_event_name === 'PostToolUseFailure') {
    return {
      ok: false,
      exit_code: extractExitCode(input.error),
      interrupted: input.is_interrupt === true,
      raw_error: typeof input.error === 'string' ? input.error : null,
    };
  }
  // PostToolUse (the success path), or any unrecognized hook_event_name — treated as the success
  // shape since that is the only other measured event this file wires today.
  const tr = input && input.tool_response;
  return {
    ok: true,
    exit_code: null, // not exposed anywhere on the success payload — see header comment
    interrupted: !!(tr && tr.interrupted === true),
    raw_error: null,
  };
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Same discipline as pipeline.mjs's safeLog — appending a log line must never be able to fail the
// runner. Losing one log line to a full disk or a locked file is acceptable; the hook throwing
// because logging failed is not.
function safeLog(record, logPath) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`, 'utf8');
  } catch {
    // intentionally swallowed — see comment above.
  }
}

// Runs every registered observer against raw stdin text (or an already-parsed object, for tests).
// Returns { events, results } and NEVER throws — every failure branch resolves to a logged record
// and continues to the next observer (or to the terminal 'observed' record) instead.
export async function runObservers(rawInput, opts = {}) {
  const observersDir = opts.observersDir ?? DEFAULT_OBSERVERS_DIR;
  const logPath = opts.logPath ?? DEFAULT_LOG_PATH;
  const shouldLog = opts.log ?? true;

  const events = [];
  const record = (evt) => {
    events.push(evt);
    if (shouldLog) safeLog(evt, logPath);
  };

  let input;
  try {
    input = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('parsed input is not a JSON object');
    }
  } catch (err) {
    const reason = 'malformed or non-object PostToolUse input on stdin — nothing recorded';
    record({ kind: 'malformed_input', reason, error: String((err && err.message) || err) });
    return { events, results: [] };
  }

  // Normalized ONCE, here — see header comment. Every observer receives the original input PLUS
  // this `_outcome` field, so it never has to rediscover the PostToolUse/PostToolUseFailure
  // asymmetry itself.
  const observerInput = { ...input, _outcome: normalizeOutcome(input) };

  const observerFiles = listObserverFiles(observersDir);
  const results = [];

  for (const of of observerFiles) {
    let outcome;
    try {
      const mod = await import(pathToFileURL(of.path).href);
      const observe = typeof mod.observe === 'function' ? mod.observe : mod.default;
      if (typeof observe !== 'function') {
        record({
          kind: 'observer_malformed_module',
          observer: of.file,
          detail: 'module has no observe() named export and no callable default export',
        });
        continue;
      }
      outcome = await observe(observerInput);
    } catch (err) {
      // An observer that throws must never take down the runner, and the other observers must
      // still run — one broken observer cannot silence every other observer on the same event.
      record({
        kind: 'observer_threw',
        observer: of.file,
        error: String((err && err.stack) || err),
      });
      continue;
    }

    // Well-formed = undefined/null (observer chose not to record anything) or a plain object
    // (optionally carrying an `events` array). Anything else — a string, a number, an array, a
    // boolean — is nonsense and must be named, not silently coerced or ignored.
    const isWellFormed = outcome === undefined
      || outcome === null
      || (typeof outcome === 'object' && !Array.isArray(outcome));

    if (!isWellFormed) {
      record({
        kind: 'observer_nonsense_return',
        observer: of.file,
        returned: safeStringify(outcome),
      });
      continue;
    }

    results.push({ observer: of.file, outcome: outcome ?? null });
  }

  record({
    kind: 'observed',
    tool: input.tool_name ?? null,
    source_event: input.hook_event_name ?? null,
    ok: observerInput._outcome.ok,
    exit_code: observerInput._outcome.exit_code,
    observers_evaluated: observerFiles.length,
  });

  return { events, results };
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }

  // Test-only overrides, same pattern as pretooluse.mjs: let test-hooks-groupb.mjs point the real
  // CLI at a disposable observers directory / log file without touching the repo's own
  // scripts/hooks/observers or .superpowers/hooks-log.jsonl during a test run.
  const opts = {};
  if (process.env.POSTTOOLUSE_OBSERVERS_DIR) opts.observersDir = process.env.POSTTOOLUSE_OBSERVERS_DIR;
  if (process.env.PRETOOLUSE_LOG_PATH) opts.logPath = process.env.PRETOOLUSE_LOG_PATH;

  try {
    await runObservers(raw, opts);
  } catch {
    // runObservers is contracted never to throw, but this is the last line of defense: whatever
    // happens above this line, PostToolUse still resolves to exit 0 with no user-visible output.
    // There is no decision for Claude Code to act on here either way — unlike PreToolUse, a
    // crash in this file cannot become a block, only a silently-lost observation.
  }

  try {
    process.stdout.write('{}');
  } catch {
    // Even a stdout write failure must not change the exit code below.
  }
  process.exit(0);
}

// Guarded, not unconditional: test-hooks-groupb.mjs imports this module directly to reach
// extractExitCode()/normalizeOutcome() for unit testing, and an unconditional main() at module
// load would read (and possibly hang on) that test process's own stdin as a side effect of import.
// Only run the CLI body when this file is the process entry point, i.e. actually spawned as the
// hook command — never when merely imported.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
