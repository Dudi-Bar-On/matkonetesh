// scripts/hooks/pipeline.mjs — the PreToolUse pipeline core, importable and unit-testable
// separately from the CLI entry point (pretooluse.mjs).
//
// CONTRACT (sourced from https://code.claude.com/docs/en/hooks, 2026-08-07 — the geniza's
// `claude-code` vendor corpus covers the SDK-level hook callback shape but not the raw
// filesystem-hook stdin/exit-code contract, so this one detail came from the live docs; see
// task-2-report.md):
//   - stdin carries one JSON object per invocation: session_id, transcript_path, cwd,
//     hook_event_name, tool_name, tool_input, tool_use_id, ...
//   - exit 0 + JSON on stdout -> Claude Code parses hookSpecificOutput.permissionDecision
//     ("allow" | "deny" | "ask" | "defer"). exit 0 + no/empty stdout -> no decision, normal
//     flow (= allow). exit 2 ignores stdout entirely and blocks on stderr text alone — that
//     path is strictly *less* controllable than exit 0 + JSON, so this pipeline never uses it.
//   - a hook that crashes is treated as a non-blocking error by Claude Code itself already, but
//     this module does not rely on that safety net: every internal failure resolves to an
//     explicit {decision:'allow', ...} object before it ever reaches the CLI layer.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE ON ITSELF: every error path defaults to allow, and
// records that it did. Malformed JSON, a missing field, an exception inside a rule, a rule that
// returns nonsense — all allow. A pipeline bug must never look like a block, and must never look
// like a silent, unrecorded allow either.
//
// RULE REGISTRATION: rules are individual .mjs files under RULES_DIR (scripts/hooks/rules/),
// each exporting `evaluate(input) -> {decision, reason} | Promise<...>` (named export or
// default). The pipeline discovers them by directory listing (readdirSync, sorted) — adding a
// rule is dropping a new file in that directory. No dispatcher line to edit, no registry array
// to append to, so two rules landing in the same review round never collide on the same lines.
import { readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

export const DEFAULT_RULES_DIR = join(HERE, 'rules');
export const DEFAULT_LOG_PATH = join(ROOT, '.superpowers', 'hooks-log.jsonl');

const VALID_DECISIONS = new Set(['allow', 'warn', 'block']);
const SEVERITY_RANK = { allow: 0, warn: 1, block: 2 };

// Lists candidate rule modules. Missing/unreadable directory -> no rules, not an error: an empty
// pipeline is the expected state before Task 3 lands the first rule.
export function listRuleFiles(rulesDir = DEFAULT_RULES_DIR) {
  try {
    return readdirSync(rulesDir)
      .filter((f) => f.endsWith('.mjs'))
      .sort()
      .map((f) => ({ file: f, path: join(rulesDir, f) }));
  } catch {
    return [];
  }
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Appending a log line must never be able to fail the pipeline. Losing one log line to a full
// disk or a locked file is acceptable; the hook throwing because logging failed is not.
function safeLog(record, logPath) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`, 'utf8');
  } catch {
    // intentionally swallowed — see comment above.
  }
}

// Runs the full PreToolUse pipeline against raw stdin text (or an already-parsed object, for
// tests). Returns { decision, reason, events, results } and NEVER throws — every failure branch
// resolves to a concrete allow decision instead.
export async function runPipeline(rawInput, opts = {}) {
  const rulesDir = opts.rulesDir ?? DEFAULT_RULES_DIR;
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
    const reason = 'malformed or non-object PreToolUse input on stdin — defaulted to allow';
    record({ kind: 'malformed_input', decision: 'allow', reason, error: String((err && err.message) || err) });
    return { decision: 'allow', reason, events, results: [] };
  }

  const allRuleFiles = listRuleFiles(rulesDir);
  // R-120 — tool-scoped loading. Importing every rule on every tool call cost 18ms of the measured
  // 85ms worst case, and would have grown by roughly another 100ms as the 52 open rules land. A
  // rule declares `export const TOOLS = [...]`; that is read from the file TEXT (no import — the
  // import is the cost being avoided) and a rule whose list excludes this tool is skipped.
  //
  // FAIL-OPEN, deliberately and in this exact order: if the file cannot be read, or declares no
  // TOOLS, or the declaration cannot be parsed, the rule IS imported and run. The failure mode of
  // a wrong skip is a silently inert rule — the Phase-4 Task-9 defect, which passed 333 tests — so
  // every uncertain case must resolve toward running the rule, never toward skipping it.
  //
  // The declarations are not trusted on their word: tests/test_hook_tool_scope.py drives every rule
  // with every tool it did NOT declare and requires `allow`, so a dishonest list fails loudly.
  const ruleFiles = [];
  const skipped = [];
  for (const rf of allRuleFiles) {
    let declared = null;
    try {
      const m = /export\s+const\s+TOOLS\s*=\s*\[([^\]]*)\]/.exec(readFileSync(rf.path, 'utf8'));
      if (m) {
        declared = m[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      }
    } catch { declared = null; }
    const name = typeof input.tool_name === 'string' ? input.tool_name : '';
    // Substring match, not equality: MCP tools arrive with a server prefix (the browser_navigate
    // rule already matches that way), and an over-broad match only costs an import.
    if (declared && declared.length > 0 && !declared.some((t) => name === t || name.includes(t))) {
      skipped.push(rf.file);
      continue;
    }
    ruleFiles.push(rf);
  }

  let finalDecision = 'allow';
  let finalReason = ruleFiles.length === 0 ? 'no rules registered' : 'no rule objected';
  const results = [];

  for (const rf of ruleFiles) {
    let outcome;
    try {
      const mod = await import(pathToFileURL(rf.path).href);
      const evaluate = typeof mod.evaluate === 'function' ? mod.evaluate : mod.default;
      if (typeof evaluate !== 'function') {
        record({
          kind: 'rule_malformed_module',
          rule: rf.file,
          decision: 'allow',
          detail: 'module has no evaluate() named export and no callable default export',
        });
        continue;
      }
      outcome = await evaluate(input);
    } catch (err) {
      // A rule that throws must never take down the pipeline, and the other rules must still
      // run — one broken rule cannot silence every other rule in the same tool call.
      record({
        kind: 'rule_threw',
        rule: rf.file,
        decision: 'allow',
        error: String((err && err.stack) || err),
      });
      continue;
    }

    const isWellFormed = outcome
      && typeof outcome === 'object'
      && !Array.isArray(outcome)
      && VALID_DECISIONS.has(outcome.decision)
      && typeof outcome.reason === 'string';

    if (!isWellFormed) {
      // This project has been bitten by a checker that accepted a non-boolean and called it
      // truth, five times over. A rule returning a bare string, null, or a decision-less object
      // is exactly that failure mode, and it must be named, not coerced.
      record({
        kind: 'rule_nonsense_return',
        rule: rf.file,
        decision: 'allow',
        returned: safeStringify(outcome),
      });
      continue;
    }

    results.push({ rule: rf.file, decision: outcome.decision, reason: outcome.reason });
    if (SEVERITY_RANK[outcome.decision] > SEVERITY_RANK[finalDecision]) {
      finalDecision = outcome.decision;
      finalReason = `${rf.file}: ${outcome.reason}`;
    }
  }

  record({
    kind: 'decision',
    decision: finalDecision,
    reason: finalReason,
    tool: input.tool_name ?? null,
    rules_evaluated: ruleFiles.length,
    // Both halves are logged because `rules_evaluated` alone can no longer prove nothing was lost:
    // rules_on_disk === rules_evaluated + rules_skipped_by_tool_scope is what the liveness test
    // asserts, so a rule that vanished from the load path shows up as arithmetic that stops adding.
    rules_on_disk: allRuleFiles.length,
    rules_skipped_by_tool_scope: skipped.length,
  });

  return { decision: finalDecision, reason: finalReason, events, results };
}
