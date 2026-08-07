#!/usr/bin/env node
// scripts/tests/test-hooks-groupa.mjs — RED/GREEN proof for the PreToolUse pipeline itself
// (scripts/hooks/pipeline.mjs + pretooluse.mjs), before ANY rule is registered under it.
//
// This is not testing a rule — it is testing the hook's OWN failure modes, per task-2-brief.md:
// malformed input, a rule that throws, a rule that returns nonsense, and the empty-pipeline
// happy path. Every one of them must resolve to `allow`, exit 0, and (except the happy path)
// leave a named record of what went wrong. A hook that receives bad input and returns something
// that looks like approval — or that blocks legitimate work because IT broke — is the exact
// failure this file exists to rule out before Task 3 adds anything for it to enforce.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PIPELINE_MODULE = pathToFileURL(join(ROOT, 'scripts', 'hooks', 'pipeline.mjs')).href;
const CLI = join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs');

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  if (!cond) {
    failures++;
    console.error(`FAIL  ${label}${detail !== undefined ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS  ${label}`);
  }
}

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function writeRule(dir, filename, body) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), body, 'utf8');
}

function runCli({ stdin, rulesDir, logPath }) {
  const env = { ...process.env };
  if (rulesDir) env.PRETOOLUSE_RULES_DIR = rulesDir;
  if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
  return spawnSync(process.execPath, [CLI], {
    input: stdin,
    encoding: 'utf8',
    env,
    cwd: ROOT,
    timeout: 15000,
  });
}

// ---------------------------------------------------------------------------------------------
// RED #1 — malformed JSON on stdin -> allow, recorded, exit 0.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-malformed-');
  const logPath = join(work, 'log.jsonl');
  const rulesDir = join(work, 'rules'); // deliberately does not exist -> empty pipeline

  const r = runCli({ stdin: '{ this is not valid JSON !!', rulesDir, logPath });

  check('malformed JSON: exit code 0 (never becomes a crash or a block)', r.status === 0, `status=${r.status} stderr=${r.stderr}`);

  let parsedStdout;
  let parseOk = true;
  try { parsedStdout = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { parseOk = false; }
  check('malformed JSON: stdout is empty or valid JSON (never garbage that could confuse Claude Code)', parseOk, `stdout=${JSON.stringify(r.stdout)}`);
  check('malformed JSON: stdout carries no deny decision (looks like allow, not approval-shaped danger)',
    parseOk && parsedStdout?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(r.stdout)}`);

  const events = readJsonl(logPath);
  const malformedEvent = events.find((e) => e.kind === 'malformed_input');
  check('malformed JSON: a malformed_input event was recorded', !!malformedEvent, `events=${JSON.stringify(events)}`);
  check('malformed JSON: the recorded event itself resolves to allow', malformedEvent?.decision === 'allow');
}

// ---------------------------------------------------------------------------------------------
// RED #2 — a registered rule that throws -> allow, recorded, the OTHER rules still evaluated.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-throws-');
  const logPath = join(work, 'log.jsonl');
  const rulesDir = join(work, 'rules');

  writeRule(rulesDir, '01-throws.mjs', `
export function evaluate(input) {
  throw new Error('boom from 01-throws');
}
`);
  writeRule(rulesDir, '02-warns.mjs', `
export function evaluate(input) {
  return { decision: 'warn', reason: 'second rule ran fine' };
}
`);

  const r = runCli({ stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }), rulesDir, logPath });

  check('rule throws: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);

  const events = readJsonl(logPath);
  const threwEvent = events.find((e) => e.kind === 'rule_threw' && e.rule === '01-throws.mjs');
  check('rule throws: the throwing rule was recorded by name with the error, and treated as allow', !!threwEvent && threwEvent.decision === 'allow', `events=${JSON.stringify(events)}`);
  check('rule throws: the error text from the throw is present in the record', typeof threwEvent?.error === 'string' && threwEvent.error.includes('boom from 01-throws'));

  const decisionEvent = events.find((e) => e.kind === 'decision');
  check('rule throws: the OTHER rule (02-warns) still ran and its warn reached the final decision', decisionEvent?.decision === 'warn' && decisionEvent.reason.includes('second rule ran fine'), `decisionEvent=${JSON.stringify(decisionEvent)}`);

  let stdoutJson;
  try { stdoutJson = JSON.parse(r.stdout); } catch { stdoutJson = null; }
  check('rule throws: CLI translates the surviving warn into allow + systemMessage, not a deny', stdoutJson && stdoutJson.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson.systemMessage === 'string', `stdout=${r.stdout}`);
}

// ---------------------------------------------------------------------------------------------
// RED #3 — a rule that returns nonsense (a string, null, or a decision-less object) -> allow,
// and the nonsense itself named in the record.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-nonsense-');
  const logPath = join(work, 'log.jsonl');
  const rulesDir = join(work, 'rules');

  writeRule(rulesDir, '01-returns-string.mjs', `export function evaluate() { return 'yes'; }`);
  writeRule(rulesDir, '02-returns-null.mjs', `export function evaluate() { return null; }`);
  writeRule(rulesDir, '03-no-decision-field.mjs', `export function evaluate() { return { reason: 'no decision key at all' }; }`);
  writeRule(rulesDir, '04-invalid-decision-value.mjs', `export function evaluate() { return { decision: 'yolo', reason: 'not one of allow/warn/block' }; }`);

  const r = runCli({ stdin: JSON.stringify({ tool_name: 'Read' }), rulesDir, logPath });

  check('rule returns nonsense: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);

  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('rule returns nonsense: overall decision is allow (empty stdout object, no deny)', stdoutJson && stdoutJson.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${r.stdout}`);

  const events = readJsonl(logPath);
  const nonsenseEvents = events.filter((e) => e.kind === 'rule_nonsense_return');
  check('rule returns nonsense: all four malformed returns were caught, one record each', nonsenseEvents.length === 4, `nonsenseEvents=${JSON.stringify(nonsenseEvents)}`);
  check('rule returns nonsense: every nonsense record resolves to allow', nonsenseEvents.every((e) => e.decision === 'allow'));
  const byRule = Object.fromEntries(nonsenseEvents.map((e) => [e.rule, e]));
  check('rule returns nonsense: the bare-string return is named verbatim in its record', byRule['01-returns-string.mjs']?.returned === JSON.stringify('yes'), `got=${byRule['01-returns-string.mjs']?.returned}`);
  check('rule returns nonsense: the null return is named verbatim in its record', byRule['02-returns-null.mjs']?.returned === JSON.stringify(null));
  check('rule returns nonsense: the decision-less object is named verbatim in its record', byRule['03-no-decision-field.mjs']?.returned === JSON.stringify({ reason: 'no decision key at all' }));
  check('rule returns nonsense: an invalid decision VALUE (not in allow/warn/block) is also rejected, not silently accepted', byRule['04-invalid-decision-value.mjs']?.returned === JSON.stringify({ decision: 'yolo', reason: 'not one of allow/warn/block' }));
}

// ---------------------------------------------------------------------------------------------
// GREEN — the empty pipeline on a normal tool call: allow, silent (no noisy per-call log spam
// beyond the one decision record), fast.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-empty-');
  const logPath = join(work, 'log.jsonl');
  const rulesDir = join(work, 'rules-does-not-exist'); // no rules registered at all

  const normalInput = JSON.stringify({
    session_id: 'abc123',
    transcript_path: '/tmp/whatever.jsonl',
    cwd: ROOT,
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: 'C:/some/file.txt' },
    tool_use_id: 'toolu_test',
  });

  const r = runCli({ stdin: normalInput, rulesDir, logPath });

  check('empty pipeline: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('empty pipeline: stdout is exactly {} (allow, no changes, no noise)', r.stdout.trim() === '{}', `stdout=${JSON.stringify(r.stdout)}`);
  check('empty pipeline: nothing was written to stderr', (r.stderr || '').trim() === '', `stderr=${r.stderr}`);

  const events = readJsonl(logPath);
  check('empty pipeline: exactly one event was logged (the decision itself, nothing spurious)', events.length === 1, `events=${JSON.stringify(events)}`);
  check('empty pipeline: that event says allow / no rules registered / 0 rules evaluated', events[0]?.decision === 'allow' && events[0]?.rules_evaluated === 0, `event=${JSON.stringify(events[0])}`);
}

// ---------------------------------------------------------------------------------------------
// A registered rule that correctly returns block IS honoured (sanity check that the pipeline
// isn't accidentally allow-only — proves the RED tests above are meaningfully red, not just
// vacuously green because nothing can ever block).
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-block-');
  const logPath = join(work, 'log.jsonl');
  const rulesDir = join(work, 'rules');
  writeRule(rulesDir, '01-blocks.mjs', `export function evaluate() { return { decision: 'block', reason: 'test says no' }; }`);

  const r = runCli({ stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git worktree add x' } }), rulesDir, logPath });
  check('sanity: a well-formed block decision IS honoured end to end', r.status === 0, `status=${r.status}`);
  let stdoutJson;
  try { stdoutJson = JSON.parse(r.stdout); } catch { stdoutJson = null; }
  check('sanity: stdout carries permissionDecision=deny with the rule\'s reason', stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny' && stdoutJson.hookSpecificOutput.permissionDecisionReason.includes('test says no'), `stdout=${r.stdout}`);
}

// ---------------------------------------------------------------------------------------------
// TIMING — the empty pipeline's own cost. This runs before every tool call once wired (Task 7);
// a tax on every action is paid thousands of times a day.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-timing-');
  const logPath = join(work, 'log.jsonl');
  const rulesDir = join(work, 'rules-does-not-exist');
  const normalInput = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } });

  // Warm-up run (process spawn + module resolution the first time can be noisy on Windows).
  runCli({ stdin: normalInput, rulesDir, logPath });

  const N = 10;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const r = runCli({ stdin: normalInput, rulesDir, logPath });
    const elapsedMs = Date.now() - t0;
    samples.push(elapsedMs);
    check(`timing sample #${i + 1}: pipeline still allows (exit 0)`, r.status === 0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`\nEMPTY PIPELINE TIMING (includes full \`node\` process spawn, ${N} samples, sorted): [${samples.join(', ')}] ms — median ${median}ms`);
  check('timing: measured and printed above (informational — see task report for the process-spawn-excluded in-process number)', true);
}

// ---------------------------------------------------------------------------------------------
// Direct in-process pipeline check (no process-spawn overhead) — the actual per-call tax once
// this is wired as a `command` hook is dominated by node startup, but the PIPELINE's own logic
// cost (module resolution + rule loop) is measured here in isolation.
// ---------------------------------------------------------------------------------------------
{
  const { runPipeline } = await import(PIPELINE_MODULE);
  const work = tempDir('hooks-groupa-inprocess-timing-');
  const rulesDir = join(work, 'rules-does-not-exist');
  const normalInput = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } });

  // Warm-up.
  await runPipeline(normalInput, { rulesDir, log: false });

  const N = 50;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    // eslint-disable-next-line no-await-in-loop
    const result = await runPipeline(normalInput, { rulesDir, log: false });
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    samples.push(elapsedMs);
    if (result.decision !== 'allow') { failures++; console.error('FAIL  in-process timing: unexpected non-allow decision'); }
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`IN-PROCESS PIPELINE TIMING (no node spawn, rules dir missing, ${N} samples): median ${median.toFixed(3)}ms, min ${samples[0].toFixed(3)}ms, max ${samples[samples.length - 1].toFixed(3)}ms`);
}

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
