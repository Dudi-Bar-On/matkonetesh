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
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PIPELINE_MODULE = pathToFileURL(join(ROOT, 'scripts', 'hooks', 'pipeline.mjs')).href;
const CLI = join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs');
const SUBAGENTSTOP_CLI = join(ROOT, 'scripts', 'hooks', 'subagentstop.mjs'); // Task 5, Fix Round 1

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

function runCli({ stdin, rulesDir, logPath, env: extraEnv }) {
  const env = { ...process.env, ...(extraEnv || {}) };
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

// Task 5, Fix Round 1 — runs the REAL subagentstop.mjs entry point (releases one ledger slot).
function runSubagentStop({ stdin, env: extraEnv } = {}) {
  const env = { ...process.env, ...(extraEnv || {}) };
  return spawnSync(process.execPath, [SUBAGENTSTOP_CLI], {
    input: stdin ?? JSON.stringify({ hook_event_name: 'SubagentStop', agent_id: 'test-agent', agent_transcript_path: '/tmp/x.jsonl' }),
    encoding: 'utf8',
    env,
    cwd: ROOT,
    timeout: 15000,
  });
}

// --- small real-process/real-socket helpers for Task 4's two §11a rules -----------------------
// Both rules are contracted to read REAL OS state (a bound TCP port; a process's OS-reported
// start time), never a flag file. These helpers construct that real state honestly: an actual
// listening socket, an actual child process with an actual OS start time — never a stand-in that
// merely LOOKS like the shape the rule reads.

// Opens a real TCP listener on `port` and resolves once it is actually accepting connections.
// Returns a close() function. Used to simulate "a suite/manual server already holds this port"
// without spawning Playwright itself (forbidden by the task brief — it takes minutes and §11a
// bars competing load during a real suite run; this is a one-line net.Server, not a suite).
function openRealListener(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer((sock) => sock.end());
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve(() => new Promise((res) => server.close(() => res())));
    });
  });
}

// Polls (bounded, no arbitrary sleep-and-hope) until something answers on `port`, or throws.
function waitForPortOpen(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  const tryOnce = () => new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(200);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => { sock.destroy(); resolve(false); });
    sock.connect(port, '127.0.0.1');
  });
  return (async () => {
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      if (await tryOnce()) return true;
    }
    throw new Error(`nothing answered on port ${port} within ${timeoutMs}ms`);
  })();
}

// Spawns a REAL separate node process that does nothing but hold `port` open, so the stale-
// dev-server rule can query its ACTUAL OS process start time via Get-Process — the same source
// the rule itself reads. Returns { pid, stop() }. This stands in for `node serve.js` honestly:
// same mechanism (a node process holding a port), just without loading dist/ into memory.
async function spawnRealPortHolder(port) {
  const child = spawn(process.execPath, ['-e', `
    const net = require('net');
    const s = net.createServer(sock => sock.end());
    s.listen(${port}, '127.0.0.1', () => {});
    setInterval(() => {}, 1000);
  `], { stdio: 'ignore' });
  await waitForPortOpen(port);
  return {
    pid: child.pid,
    stop: () => new Promise((res) => {
      child.once('exit', () => res());
      child.kill();
      // Windows sometimes needs a nudge for a plain SIGTERM-equivalent on a busy loop process.
      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already gone */ } }, 500).unref();
    }),
  };
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

// ---------------------------------------------------------------------------------------------
// TASK 3 — §9 `main` rule: `git worktree add` and `git checkout -b`/`-B` are blocked; everything
// else, including the innocent checkout/worktree forms a naive regex would also catch, passes.
// This exercises the REAL rule file under the REAL default rules dir (scripts/hooks/rules/),
// not a synthetic writeRule() fixture — the point is to prove the shipped rule, not a stand-in.
// ---------------------------------------------------------------------------------------------
function runCliRealRules({ stdin, logPath, env }) {
  return runCli({ stdin, logPath, env }); // no rulesDir override -> pipeline.mjs DEFAULT_RULES_DIR
}

function decisionFor(command) {
  const work = tempDir('hooks-groupa-mainrule-');
  const logPath = join(work, 'log.jsonl');
  const r = runCliRealRules({
    stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    logPath,
  });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  return { r, stdoutJson, logPath };
}

// Same as decisionFor(), but forwards extra env vars (MK_TEST_PORT, PRETOOLUSE_DIST_DIR) through
// to the real CLI/rules — needed by Task 4's two §11a rules, which read those directly.
function decisionFor2(command, env) {
  const work = tempDir('hooks-groupa-task4rule-');
  const logPath = join(work, 'log.jsonl');
  const r = runCliRealRules({
    stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    logPath,
    env,
  });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  return { r, stdoutJson, logPath };
}

// --- blocked: the two commands §9 names explicitly -------------------------------------------
{
  const { r, stdoutJson } = decisionFor('git worktree add ../mk-side feature-branch');
  check('§9 rule: exit code 0 for `git worktree add ...`', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('§9 rule: `git worktree add ...` is DENIED', stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${r.stdout}`);
  check('§9 rule: the deny reason names §9 main and gives an alternative way to do the work',
    typeof stdoutJson?.hookSpecificOutput?.permissionDecisionReason === 'string'
    && /main/i.test(stdoutJson.hookSpecificOutput.permissionDecisionReason)
    && /instead/i.test(stdoutJson.hookSpecificOutput.permissionDecisionReason),
    `reason=${stdoutJson?.hookSpecificOutput?.permissionDecisionReason}`);
}
{
  const { stdoutJson } = decisionFor('git checkout -b my-branch');
  check('§9 rule: `git checkout -b my-branch` is DENIED', stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  const { stdoutJson } = decisionFor('git checkout -B my-branch');
  check('§9 rule: `git checkout -B my-branch` (force-create variant) is also DENIED', stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // compound command: the leading segment after `&&` is still a git-worktree-add invocation.
  const { stdoutJson } = decisionFor('cd /tmp && git worktree add ../x branch');
  check('§9 rule: `git worktree add` after `&&` is still DENIED (segment split, not naive substring)', stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- RED #2, the one that matters more: innocent lookalikes MUST pass ------------------------
for (const innocent of [
  'git checkout -- file.txt',
  'git checkout main',
  'git switch main',
  'git worktree list',
]) {
  const { r, stdoutJson } = decisionFor(innocent);
  check(`§9 rule: innocent \`${innocent}\` is NOT denied`, r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- brief step 3 decision: a string literal containing the blocked phrase, run through `echo`,
// never invokes git at all, so it must NOT be denied. The rule inspects each shell segment's own
// leading command; `echo "..."` is a segment whose leading command is `echo`, not `git`.
{
  const { stdoutJson } = decisionFor('echo "git checkout -b x"');
  check('§9 rule (brief step 3 decision): `echo "git checkout -b x"` is NOT denied — echo never runs git', stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  const { stdoutJson } = decisionFor('git commit -m "did a checkout -b thing"');
  check('§9 rule: a commit message merely mentioning "checkout -b" is NOT denied', stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- non-Bash tool calls and missing/empty command text must never be touched by this rule ----
{
  const work = tempDir('hooks-groupa-mainrule-nonbash-');
  const logPath = join(work, 'log.jsonl');
  const r = runCliRealRules({ stdin: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' } }), logPath });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('§9 rule: a non-Bash tool call is untouched (allow)', stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// FIX ROUND 1 (review finding, Important): a git GLOBAL OPTION between `git` and the subcommand
// must not defeat the rule. `git -C . checkout -b x`, `git --no-pager checkout -b x`, and
// `git -c k=v worktree add ../w` all genuinely create a branch/worktree and must still be DENIED.
// Matching negative cases (global option + an innocent subcommand) must still pass.
// `bash -c "..."` remains a documented, accepted gap — not shell parsing, not attempted here.
// ---------------------------------------------------------------------------------------------
for (const guilty of [
  'git -C . checkout -b x',
  'git --no-pager checkout -b x',
  'git -c core.pager=cat worktree add ../w',
  'git -c k=v worktree add ../w',
]) {
  const { r, stdoutJson } = decisionFor(guilty);
  check(`§9 rule (fix round 1): guilty \`${guilty}\` (global option before subcommand) is DENIED`, r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}
for (const innocent of [
  'git -C . checkout main',
  'git -C . status',
  'git --no-pager worktree list',
]) {
  const { r, stdoutJson } = decisionFor(innocent);
  check(`§9 rule (fix round 1): innocent \`${innocent}\` (global option before subcommand) is NOT denied`, r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // Documented, accepted gap — not a regression to fix here. Asserted explicitly so a future
  // change that silently starts blocking this (via a shell-parsing rewrite, say) is a deliberate
  // decision, not an accidental side effect nobody noticed.
  const { stdoutJson } = decisionFor('bash -c "git checkout -b x"');
  check('§9 rule (documented gap, not fixed here): `bash -c "git checkout -b x"` still evades the rule (allow) — real shell parsing is out of scope', stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// TASK 4, RULE 1 — no-concurrent-suite-run.mjs: block `playwright test` while the target port is
// already held by a live process; a plain `npx playwright test` with NOTHING in flight must pass.
// Exercises the REAL shipped rule under the REAL default rules dir, like the §9 tests above.
// ---------------------------------------------------------------------------------------------
const CONCURRENCY_TEST_PORT = 18923; // arbitrary, unused port — not the real suite's 8123

{
  // --- baseline: nothing listening on the port -> `npx playwright test` is NOT blocked ---------
  // This is brief requirement #3: "A plain `npx playwright test` with NO run in flight MUST pass."
  const { r, stdoutJson } = decisionFor2('npx playwright test', { MK_TEST_PORT: String(CONCURRENCY_TEST_PORT) });
  check('§11a concurrency rule: `npx playwright test` with nothing on the port is NOT blocked',
    r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny',
    `stdout=${JSON.stringify(stdoutJson)}`);
}

{
  // --- a REAL listener is holding the port -> BLOCKED, with the port/reason named ---------------
  const close = await openRealListener(CONCURRENCY_TEST_PORT);
  try {
    const { r, stdoutJson } = decisionFor2('npx playwright test', { MK_TEST_PORT: String(CONCURRENCY_TEST_PORT) });
    check('§11a concurrency rule: exit code 0 while port is busy', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
    check('§11a concurrency rule: `npx playwright test` while the port is held IS blocked',
      stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
    check('§11a concurrency rule: the deny reason names §11a and the phantom-failure history',
      typeof stdoutJson?.hookSpecificOutput?.permissionDecisionReason === 'string'
      && /11a/.test(stdoutJson.hookSpecificOutput.permissionDecisionReason)
      && /ERR_CONNECTION_REFUSED/.test(stdoutJson.hookSpecificOutput.permissionDecisionReason),
      `reason=${stdoutJson?.hookSpecificOutput?.permissionDecisionReason}`);

    // Other invocation shapes that also launch the suite must be caught too.
    for (const guilty of ['playwright test', 'npm test', 'npm run test:full', 'npm run test:visual']) {
      const { stdoutJson: sj2 } = decisionFor2(guilty, { MK_TEST_PORT: String(CONCURRENCY_TEST_PORT) });
      check(`§11a concurrency rule: \`${guilty}\` while port busy is also blocked`,
        sj2?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(sj2)}`);
    }

    // Lookalikes that never actually launch the suite must NOT be blocked, even with the port busy —
    // same discipline as the §9 rule's echo/commit-message cases.
    for (const innocent of ['npx playwright --version', 'npx playwright show-report', 'git commit -m "playwright test flaky again"']) {
      const { stdoutJson: sj3 } = decisionFor2(innocent, { MK_TEST_PORT: String(CONCURRENCY_TEST_PORT) });
      check(`§11a concurrency rule: lookalike \`${innocent}\` is NOT blocked even with the port busy`,
        sj3?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(sj3)}`);
    }
  } finally {
    await close();
  }
}

{
  // --- REAL STATE, not a stuck flag: after the listener closes, the SAME command is allowed again
  // (no leftover marker to clear by hand) ---------------------------------------------------------
  const { stdoutJson } = decisionFor2('npx playwright test', { MK_TEST_PORT: String(CONCURRENCY_TEST_PORT) });
  check('§11a concurrency rule: once the port is freed, the same command is allowed again (proves real-state, not a leftover flag)',
    stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// TASK 4, RULE 2 — stale-dev-server.mjs: dist/ newer than the serving process's own OS start time
// -> WARN (never block — a UI-check cost, not a lost capability).
// ---------------------------------------------------------------------------------------------
const STALE_TEST_PORT = 18924;

function navigateInput() {
  return JSON.stringify({
    tool_name: 'mcp__plugin_playwright_playwright__browser_navigate',
    tool_input: { url: 'http://localhost/index.html' },
  });
}

{
  // non-navigation tool call is untouched, even with nothing set up at all.
  const work = tempDir('hooks-groupa-stale-nonnav-');
  const logPath = join(work, 'log.jsonl');
  const r = runCliRealRules({ stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }), logPath });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('stale-dev-server rule: a non-navigation tool call is untouched (allow)',
    r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

{
  // navigation, but no dist/ build at the (overridden) dist dir -> allow, nothing to compare.
  const work = tempDir('hooks-groupa-stale-nobuild-');
  const logPath = join(work, 'log.jsonl');
  const distDir = join(work, 'dist-does-not-exist');
  const r = runCliRealRules({ stdin: navigateInput(), logPath, env: { PRETOOLUSE_DIST_DIR: distDir, MK_TEST_PORT: String(STALE_TEST_PORT) } });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('stale-dev-server rule: no dist/index.html at all -> allow (nothing to compare)',
    r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

{
  // navigation, dist/ exists, but nothing is listening on the port -> allow, nothing to warn about.
  const work = tempDir('hooks-groupa-stale-noserver-');
  const logPath = join(work, 'log.jsonl');
  const distDir = join(work, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), '<html>fresh</html>', 'utf8');
  const r = runCliRealRules({ stdin: navigateInput(), logPath, env: { PRETOOLUSE_DIST_DIR: distDir, MK_TEST_PORT: String(STALE_TEST_PORT + 1) } });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('stale-dev-server rule: dist/ exists but no process on the port -> allow',
    r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

{
  // --- the actual stale case: a REAL process holds the port, THEN dist/ is (re)written --------
  // The file's natural mtime (now, after the process's OS start time) makes it stale honestly —
  // no fabricated timestamps, just real ordering of real events.
  const holder = await spawnRealPortHolder(STALE_TEST_PORT);
  try {
    const work = tempDir('hooks-groupa-stale-yes-');
    const logPath = join(work, 'log.jsonl');
    const distDir = join(work, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.html'), '<html>rebuilt after server started</html>', 'utf8');

    const r = runCliRealRules({ stdin: navigateInput(), logPath, env: { PRETOOLUSE_DIST_DIR: distDir, MK_TEST_PORT: String(STALE_TEST_PORT) } });
    let stdoutJson;
    try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
    check('stale-dev-server rule: exit code 0 for the stale case', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
    check('stale-dev-server rule: dist/ rebuilt after the server started -> WARN (allow + systemMessage), never a deny',
      stdoutJson?.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson?.systemMessage === 'string',
      `stdout=${JSON.stringify(stdoutJson)}`);
    check('stale-dev-server rule: the warn names §11a and tells the fix (restart the server)',
      typeof stdoutJson?.systemMessage === 'string'
      && /11a/.test(stdoutJson.systemMessage)
      && /[Rr]estart/.test(stdoutJson.systemMessage),
      `systemMessage=${stdoutJson?.systemMessage}`);
    check(`stale-dev-server rule: the warn names the real pid ${holder.pid} it queried`,
      typeof stdoutJson?.systemMessage === 'string' && stdoutJson.systemMessage.includes(String(holder.pid)),
      `systemMessage=${stdoutJson?.systemMessage}`);
  } finally {
    await holder.stop();
  }
}

{
  // --- the negative of the stale case: dist/ was built BEFORE the server started (server is
  // fresh relative to the build on disk) -> allow, not stale. Same mechanism, opposite ordering. --
  const work = tempDir('hooks-groupa-stale-no-');
  const logPath = join(work, 'log.jsonl');
  const distDir = join(work, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), '<html>built before server started</html>', 'utf8');

  const port = STALE_TEST_PORT + 2;
  const holder = await spawnRealPortHolder(port); // spawned AFTER the file write above
  try {
    const r = runCliRealRules({ stdin: navigateInput(), logPath, env: { PRETOOLUSE_DIST_DIR: distDir, MK_TEST_PORT: String(port) } });
    let stdoutJson;
    try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
    check('stale-dev-server rule: server started AFTER the build on disk -> allow (not stale)',
      r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny',
      `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await holder.stop();
  }
}

// ---------------------------------------------------------------------------------------------
// TASK 5 — agent-concurrency-ceiling.mjs: §10.5a "≤3 קלים; ≤5 קשיח" on `PreToolUse:Agent`.
// Exercises the REAL shipped rule under the REAL default rules dir, like every rule above.
//
// HOW THE OVER-CEILING CONDITION IS CONSTRUCTED HONESTLY WITHOUT SPAWNING REAL SUBAGENTS (brief
// constraint): the rule's own ledger format is {dispatchedAt, hostPid} — this is REAL evidence the
// rule itself would have written, just seeded directly instead of produced by N real Agent
// dispatches. Two disciplines keep this honest rather than a fabricated stand-in:
//   1. Where "still alive" matters, the seeded hostPid is a REAL, currently-running OS pid
//      (this test process's own `process.pid`, alive for the test's whole duration) — the rule's
//      real `tasklist` liveness check runs against it for real, not a mocked answer.
//   2. Where "the owning process crashed" matters, a REAL child process is spawned (reusing the
//      already-proven `spawnRealPortHolder` helper from Task 4's tests above) and then REALLY
//      killed — the rule's liveness check observes a genuine pid disappearing from the OS
//      process table, exactly the mechanism it would use against a real crashed session.
// ---------------------------------------------------------------------------------------------
const AGENT_TEST_PORT = 18925;

function agentInput(description) {
  return JSON.stringify({
    tool_name: 'Agent',
    tool_input: { description: description || 'test dispatch', prompt: 'x', subagent_type: 'general-purpose' },
  });
}

function decisionForAgent({ seedLedger, env } = {}) {
  const work = tempDir('hooks-groupa-agentceiling-');
  const logPath = join(work, 'log.jsonl');
  const ledgerPath = join(work, 'ledger.json');
  if (seedLedger) writeFileSync(ledgerPath, JSON.stringify(seedLedger), 'utf8');
  const r = runCliRealRules({
    stdin: agentInput(),
    logPath,
    env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath, ...env },
  });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  let ledgerAfter;
  try { ledgerAfter = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { ledgerAfter = null; }
  return { r, stdoutJson, ledgerAfter };
}

// --- non-Agent tool call is untouched, even with a full ledger present ------------------------
{
  const work = tempDir('hooks-groupa-agentceiling-nonagent-');
  const logPath = join(work, 'log.jsonl');
  const r = runCliRealRules({ stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }), logPath });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('§10.5a ceiling rule: a non-Agent tool call is untouched (allow)',
    r.status === 0 && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- REQUIRED PROOF: a SINGLE agent dispatch, empty ledger, MUST pass ---------------------------
{
  const { r, stdoutJson, ledgerAfter } = decisionForAgent({ env: { PRETOOLUSE_HOST_PID: String(process.pid) } });
  check('§10.5a ceiling rule: exit code 0 for a single agent dispatch', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('§10.5a ceiling rule: a SINGLE agent dispatch with nothing else live is NOT blocked and NOT warned',
    stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny' && stdoutJson?.systemMessage === undefined,
    `stdout=${JSON.stringify(stdoutJson)}`);
  check('§10.5a ceiling rule: the ledger now records exactly 1 live entry after the single dispatch',
    Array.isArray(ledgerAfter) && ledgerAfter.length === 1, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
}

// --- under both ceilings: 2 already live (real, alive pid) -> 3rd dispatch is a plain allow ----
{
  const seed = [
    { dispatchedAt: Date.now(), hostPid: process.pid },
    { dispatchedAt: Date.now(), hostPid: process.pid },
  ];
  const { stdoutJson, ledgerAfter } = decisionForAgent({ seedLedger: seed, env: { PRETOOLUSE_HOST_PID: String(process.pid) } });
  check('§10.5a ceiling rule: 2 live + this dispatch = 3, at the soft ceiling, still a plain allow (no warn)',
    stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny' && stdoutJson?.systemMessage === undefined,
    `stdout=${JSON.stringify(stdoutJson)}`);
  check('§10.5a ceiling rule: ledger now has 3 entries', Array.isArray(ledgerAfter) && ledgerAfter.length === 3, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
}

// --- RED — over the SOFT ceiling (3): 3 already live -> 4th dispatch WARNS, is still allowed ---
{
  const seed = [0, 1, 2].map(() => ({ dispatchedAt: Date.now(), hostPid: process.pid }));
  const { r, stdoutJson, ledgerAfter } = decisionForAgent({ seedLedger: seed, env: { PRETOOLUSE_HOST_PID: String(process.pid) } });
  check('§10.5a ceiling rule: exit code 0 over the soft ceiling', r.status === 0, `status=${r.status}`);
  check('§10.5a ceiling rule: 3 live + this dispatch = 4, over the soft ceiling of 3 -> WARN (allow + systemMessage), never a deny',
    stdoutJson?.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson?.systemMessage === 'string',
    `stdout=${JSON.stringify(stdoutJson)}`);
  check('§10.5a ceiling rule: the warn names §10.5a and both ceiling numbers',
    typeof stdoutJson?.systemMessage === 'string' && /10\.5a/.test(stdoutJson.systemMessage) && /\b3\b/.test(stdoutJson.systemMessage) && /\b5\b/.test(stdoutJson.systemMessage),
    `systemMessage=${stdoutJson?.systemMessage}`);
  check('§10.5a ceiling rule: the warned dispatch IS still recorded in the ledger (it went through)',
    Array.isArray(ledgerAfter) && ledgerAfter.length === 4, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
}

// --- RED — over the HARD ceiling (5): 5 already live -> 6th dispatch is BLOCKED ----------------
{
  const seed = [0, 1, 2, 3, 4].map(() => ({ dispatchedAt: Date.now(), hostPid: process.pid }));
  const { r, stdoutJson, ledgerAfter } = decisionForAgent({ seedLedger: seed, env: { PRETOOLUSE_HOST_PID: String(process.pid) } });
  check('§10.5a ceiling rule: exit code 0 over the hard ceiling', r.status === 0, `status=${r.status}`);
  check('§10.5a ceiling rule: 5 live + this dispatch = 6, over the hard ceiling of 5 -> BLOCKED (deny)',
    stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
  check('§10.5a ceiling rule: the deny reason names §10.5a and the hard ceiling',
    typeof stdoutJson?.hookSpecificOutput?.permissionDecisionReason === 'string'
    && /10\.5a/.test(stdoutJson.hookSpecificOutput.permissionDecisionReason)
    && /hard ceiling of 5/.test(stdoutJson.hookSpecificOutput.permissionDecisionReason),
    `reason=${stdoutJson?.hookSpecificOutput?.permissionDecisionReason}`);
  check('§10.5a ceiling rule: a BLOCKED dispatch is NOT added to the ledger — it stays at 5, not 6 (proves a blocked call never counts as a live agent)',
    Array.isArray(ledgerAfter) && ledgerAfter.length === 5, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
}

// --- crash self-clearing: entries owned by a REAL process that is then REALLY killed are pruned,
// so the very next dispatch after the "crash" is NOT blocked even though 5 were "live" a moment
// before — this is the brief's central demand: a hard crash mid-run must not block work forever. -
{
  const holder = await spawnRealPortHolder(AGENT_TEST_PORT); // a real OS process, real pid
  const seed = [0, 1, 2, 3, 4].map(() => ({ dispatchedAt: Date.now(), hostPid: holder.pid }));
  await holder.stop(); // the "crash": the owning process is really gone before the next dispatch
  try {
    const { r, stdoutJson, ledgerAfter } = decisionForAgent({ seedLedger: seed, env: { PRETOOLUSE_HOST_PID: String(process.pid) } });
    check('§10.5a ceiling rule: exit code 0 after the simulated crash', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
    check('§10.5a ceiling rule: after the owning process is confirmed dead, its 5 "live" entries are NOT counted — the next dispatch is allowed, not blocked forever',
      stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny' && stdoutJson?.systemMessage === undefined,
      `stdout=${JSON.stringify(stdoutJson)}`);
    check('§10.5a ceiling rule: the dead process\'s 5 stale entries were pruned from the ledger, leaving only this one live dispatch',
      Array.isArray(ledgerAfter) && ledgerAfter.length === 1, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
  } finally {
    // already stopped above; nothing further to tear down.
  }
}

// --- TTL self-clearing: entries owned by a STILL-ALIVE pid (this test process) but older than the
// configured TTL are ALSO pruned — the same-session "agent finished normally, no crash, no signal"
// case, which pid-liveness alone can never retire (see rule file header, point 3). -----------------
{
  const ttlMs = 5000;
  const seed = [0, 1, 2, 3, 4].map(() => ({ dispatchedAt: Date.now() - ttlMs - 1000, hostPid: process.pid }));
  const { r, stdoutJson, ledgerAfter } = decisionForAgent({
    seedLedger: seed,
    env: { PRETOOLUSE_HOST_PID: String(process.pid), PRETOOLUSE_AGENT_TTL_MS: String(ttlMs) },
  });
  check('§10.5a ceiling rule: exit code 0 for TTL-expired entries', r.status === 0, `status=${r.status}`);
  check('§10.5a ceiling rule: 5 entries older than the TTL, owned by a LIVE pid, are still pruned as expired -> allow, not blocked',
    stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny' && stdoutJson?.systemMessage === undefined,
    `stdout=${JSON.stringify(stdoutJson)}`);
  check('§10.5a ceiling rule: TTL-expired entries are dropped from the ledger, leaving only this one live dispatch',
    Array.isArray(ledgerAfter) && ledgerAfter.length === 1, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
}

// --- counter-proof: entries owned by the SAME live pid and still within TTL DO still count -------
// (proves the TTL test above is meaningfully red, not vacuously green because nothing ever counts)
{
  const ttlMs = 5000;
  const seed = [0, 1, 2, 3, 4].map(() => ({ dispatchedAt: Date.now(), hostPid: process.pid })); // fresh, not expired
  const { stdoutJson, ledgerAfter } = decisionForAgent({
    seedLedger: seed,
    env: { PRETOOLUSE_HOST_PID: String(process.pid), PRETOOLUSE_AGENT_TTL_MS: String(ttlMs) },
  });
  check('§10.5a ceiling rule (counter-proof): 5 FRESH entries under the same TTL are still counted as live -> blocked',
    stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
  check('§10.5a ceiling rule (counter-proof): ledger unchanged at 5 (blocked dispatch not appended)',
    Array.isArray(ledgerAfter) && ledgerAfter.length === 5, `ledgerAfter=${JSON.stringify(ledgerAfter)}`);
}

// --- malformed ledger (corrupt JSON) is treated as empty, never a crash, never a block -----------
{
  const work = tempDir('hooks-groupa-agentceiling-corrupt-');
  const logPath = join(work, 'log.jsonl');
  const ledgerPath = join(work, 'ledger.json');
  writeFileSync(ledgerPath, '{ not valid json at all', 'utf8');
  const r = runCliRealRules({
    stdin: agentInput(),
    logPath,
    env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath, PRETOOLUSE_HOST_PID: String(process.pid) },
  });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('§10.5a ceiling rule: exit code 0 for a corrupt ledger', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('§10.5a ceiling rule: a corrupt ledger file is treated as empty, not a crash, not a block',
    stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny' && stdoutJson?.systemMessage === undefined,
    `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// TASK 5, FIX ROUND 1 (owner review finding, Critical) — SubagentStop closes the loop.
//
// THE REGRESSION THIS SECTION PROVES CLOSED: the reviewer measured 6 STRICTLY SEQUENTIAL
// dispatches (each one's agent already finished before the next began — no more than 1 ever truly
// live) producing 2 warns and 2 blocks under the TTL-only design, because nothing told the ledger
// an agent had finished. `subagentstop.mjs` is the fix: it releases one ledger slot per
// `SubagentStop` event. This section tests the entry point directly AND proves the end-to-end
// regression the reviewer's own measurement encodes.
// ---------------------------------------------------------------------------------------------

// --- subagentstop.mjs releases exactly the OLDEST live entry (FIFO — see agent-ledger.mjs's
// header for why identity-matching isn't available, and oldest-first is the honest next-best) ----
{
  const work = tempDir('hooks-groupa-subagentstop-release-');
  const ledgerPath = join(work, 'ledger.json');
  // Recent, realistic timestamps (relative to now) — NOT small literals like 1000/2000/3000ms,
  // which would be 1970-era epoch times and get pruned as TTL-expired before the FIFO pick even
  // runs, silently testing the prune path instead of the release path.
  const t0 = Date.now() - 3000;
  const seed = [
    { dispatchedAt: t0, hostPid: process.pid },
    { dispatchedAt: t0 + 2000, hostPid: process.pid },
    { dispatchedAt: t0 + 1000, hostPid: process.pid }, // deliberately out of order on disk
  ];
  writeFileSync(ledgerPath, JSON.stringify(seed), 'utf8');
  const r = runSubagentStop({ env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath } });
  check('subagentstop.mjs: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  let after;
  try { after = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { after = null; }
  check('subagentstop.mjs: releases exactly the OLDEST entry regardless of on-disk order, leaving the other 2',
    Array.isArray(after) && after.length === 2 && after.every((e) => e.dispatchedAt !== t0),
    `after=${JSON.stringify(after)}`);
}

// --- no-op on an empty/missing ledger: never throws, exit 0 -----------------------------------
{
  const work = tempDir('hooks-groupa-subagentstop-empty-');
  const ledgerPath = join(work, 'ledger-does-not-exist.json');
  const r = runSubagentStop({ env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath } });
  check('subagentstop.mjs: exit code 0 on an empty/missing ledger (no-op, never throws)', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
}

// --- malformed stdin JSON still releases a slot (fail-open, and the release doesn't depend on
// the event payload parsing, since no reliable per-agent identifier is available anyway) --------
{
  const work = tempDir('hooks-groupa-subagentstop-malformed-');
  const ledgerPath = join(work, 'ledger.json');
  writeFileSync(ledgerPath, JSON.stringify([{ dispatchedAt: Date.now(), hostPid: process.pid }]), 'utf8');
  const r = runSubagentStop({ stdin: '{ not valid json at all', env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath } });
  check('subagentstop.mjs: exit code 0 for malformed stdin JSON (fail-open, never a crash)', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  let after;
  try { after = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { after = null; }
  check('subagentstop.mjs: still releases a slot even when its own stdin JSON is malformed',
    Array.isArray(after) && after.length === 0, `after=${JSON.stringify(after)}`);
}

// --- opportunistic cleanup: a dead-pid entry is pruned as part of the SAME release pass, not left
// for a future PreToolUse:Agent call to find -----------------------------------------------------
{
  const work = tempDir('hooks-groupa-subagentstop-prune-');
  const ledgerPath = join(work, 'ledger.json');
  const seed = [
    { dispatchedAt: Date.now(), hostPid: 999999 }, // a pid that does not exist
    { dispatchedAt: Date.now(), hostPid: process.pid }, // the only genuinely live one
  ];
  writeFileSync(ledgerPath, JSON.stringify(seed), 'utf8');
  const r = runSubagentStop({ env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath } });
  check('subagentstop.mjs: exit code 0 with a mixed dead/live ledger', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  let after;
  try { after = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { after = null; }
  check('subagentstop.mjs: the dead-pid entry is pruned AND the one live entry is released (oldest of what remains) -> empty, not 1',
    Array.isArray(after) && after.length === 0, `after=${JSON.stringify(after)}`);
}

// --- THE REGRESSION ITSELF: N STRICTLY SEQUENTIAL dispatches (each one's SubagentStop fires
// before the next dispatch begins) must ALL be a plain allow — no warning, no block, no matter how
// many. N is chosen deliberately larger than the hard ceiling (5) to prove sequential work is
// genuinely unbounded, not just "under the ceiling by luck." ------------------------------------
{
  const work = tempDir('hooks-groupa-agentceiling-sequential-');
  const ledgerPath = join(work, 'ledger.json');
  const env = { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath, PRETOOLUSE_HOST_PID: String(process.pid) };
  const N = 10;
  let allClean = true;
  const details = [];
  for (let i = 0; i < N; i++) {
    const dLog = join(work, `dispatch-log-${i}.jsonl`);
    const r = runCliRealRules({ stdin: agentInput(`sequential dispatch #${i + 1}`), logPath: dLog, env });
    let stdoutJson;
    try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
    const clean = r.status === 0
      && stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny'
      && stdoutJson?.systemMessage === undefined;
    details.push(`#${i + 1}: ${JSON.stringify(stdoutJson)}`);
    if (!clean) allClean = false;

    // This agent "finishes" before the next dispatch begins — exactly the reviewer's measurement.
    const sr = runSubagentStop({ env: { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath } });
    if (sr.status !== 0) allClean = false;
  }
  check(`§10.5a ceiling rule (Fix Round 1 regression): ${N} STRICTLY SEQUENTIAL dispatches (each one's stop fires before the next begins) are ALL a plain allow, no warning, no block`,
    allClean, details.join(' | '));
  let finalLedger;
  try { finalLedger = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { finalLedger = null; }
  check('§10.5a ceiling rule (Fix Round 1 regression): the ledger is empty after the last stop — every dispatch was properly retired, none left dangling',
    Array.isArray(finalLedger) && finalLedger.length === 0, `finalLedger=${JSON.stringify(finalLedger)}`);
}

// --- counter-proof: WITHOUT the stop calls, the same 10 sequential dispatches still hit the
// ceilings exactly as before Fix Round 1 — proves the regression test above is meaningfully red,
// not vacuously green because the ceiling logic itself stopped enforcing anything. ----------------
{
  const work = tempDir('hooks-groupa-agentceiling-sequential-nostop-');
  const ledgerPath = join(work, 'ledger.json');
  const env = { PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath, PRETOOLUSE_HOST_PID: String(process.pid) };
  let sawWarn = false;
  let sawBlock = false;
  for (let i = 0; i < 6; i++) {
    const dLog = join(work, `dispatch-log-${i}.jsonl`);
    const r = runCliRealRules({ stdin: agentInput(`no-stop dispatch #${i + 1}`), logPath: dLog, env });
    let stdoutJson;
    try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
    if (stdoutJson?.hookSpecificOutput?.permissionDecision === 'deny') sawBlock = true;
    if (typeof stdoutJson?.systemMessage === 'string') sawWarn = true;
  }
  check('§10.5a ceiling rule (counter-proof): WITHOUT any stop events, 6 dispatches still produce at least one warn and one block — the ceiling logic itself is unchanged, only the retirement path is new',
    sawWarn && sawBlock, `sawWarn=${sawWarn} sawBlock=${sawBlock}`);
}

// --- suite-busy ceiling: "1 בזמן סוויטה/GPU" (owner ruling on Fix Round 1 — implemented for the
// suite half, reusing no-concurrent-suite-run.mjs's own port probe; GPU-busy is explicitly stated
// unimplemented in agent-concurrency-ceiling.mjs's own header, no reusable signal exists). --------
const AGENT_SUITE_BUSY_PORT = 18926;
{
  const holder = await openRealListener(AGENT_SUITE_BUSY_PORT); // simulates a live suite run
  try {
    const work = tempDir('hooks-groupa-agentceiling-suitebusy-');
    const ledgerPath = join(work, 'ledger.json');
    const env = {
      PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath,
      PRETOOLUSE_HOST_PID: String(process.pid),
      MK_TEST_PORT: String(AGENT_SUITE_BUSY_PORT),
    };

    const first = runCliRealRules({ stdin: agentInput('first, suite busy'), logPath: join(work, 'l1.jsonl'), env });
    let firstJson;
    try { firstJson = first.stdout.trim() === '' ? {} : JSON.parse(first.stdout); } catch { firstJson = undefined; }
    check('§10.5a ceiling rule (suite busy): the FIRST agent (0 live) is still allowed even while the suite is busy — the ceiling is 1, not 0',
      firstJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(firstJson)}`);

    const second = runCliRealRules({ stdin: agentInput('second, suite busy'), logPath: join(work, 'l2.jsonl'), env });
    let secondJson;
    try { secondJson = second.stdout.trim() === '' ? {} : JSON.parse(second.stdout); } catch { secondJson = undefined; }
    check('§10.5a ceiling rule (suite busy): the SECOND agent (1 already live) is BLOCKED — "1 בזמן סוויטה/GPU" enforced',
      secondJson?.hookSpecificOutput?.permissionDecision === 'deny', `stdout=${JSON.stringify(secondJson)}`);
    check('§10.5a ceiling rule (suite busy): the block reason names the suite-busy reason, not just the numeric ceiling',
      typeof secondJson?.hookSpecificOutput?.permissionDecisionReason === 'string'
      && /suite/i.test(secondJson.hookSpecificOutput.permissionDecisionReason),
      `reason=${secondJson?.hookSpecificOutput?.permissionDecisionReason}`);
  } finally {
    await holder();
  }
}
{
  // Once the suite finishes (port freed), the SAME ledger reverts to the normal ceiling — real
  // state, not a leftover flag, same discipline as no-concurrent-suite-run.mjs's own proof.
  const work = tempDir('hooks-groupa-agentceiling-suitefreed-');
  const ledgerPath = join(work, 'ledger.json');
  const env = {
    PRETOOLUSE_AGENT_LEDGER_PATH: ledgerPath,
    PRETOOLUSE_HOST_PID: String(process.pid),
    MK_TEST_PORT: String(AGENT_SUITE_BUSY_PORT), // same port, now free
  };
  writeFileSync(ledgerPath, JSON.stringify([{ dispatchedAt: Date.now(), hostPid: process.pid }]), 'utf8');
  const r = runCliRealRules({ stdin: agentInput('after suite freed'), logPath: join(work, 'l.jsonl'), env });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  check('§10.5a ceiling rule (suite busy): once the port is freed, a 2nd live agent is allowed again under the NORMAL ceiling (not stuck at 1)',
    stdoutJson?.hookSpecificOutput?.permissionDecision !== 'deny', `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// TASK 6, RULE 1 — symbolic-grep-use-serena.mjs: §10.17/§5.1's three-condition conjunction.
// Exercises the REAL rule file under the REAL default rules dir, same discipline as Task 3/4/5.
// ---------------------------------------------------------------------------------------------
// A minimal, REAL local HTTP server that answers ANY POST with 200 — stands in honestly for the
// shared Serena MCP server's /mcp endpoint: isSerenaLive() only checks "did something answer",
// exactly what serena-server.ps1's own Invoke-McpProbe checks (see serena-probe.mjs's header).
//
// MUST be a genuinely SEPARATE OS process, not an in-process http.createServer() in THIS test
// process — this test process later calls runCliRealRules(), which uses spawnSync() and BLOCKS
// this entire process (including its own event loop) until the spawned CLI child exits. An
// in-process server could never accept that child's connection while blocked, which is exactly
// the Windows loopback-serialization deadlock this project already hit once (see
// warm-page-loopback-arc in agent memory) — proven here again by hand before writing it down:
// the in-process version measured a hard ~2000ms timeout-and-fail on every call. A real separate
// process has no such dependency on this process's event loop.
async function startFakeSerenaServer() {
  const child = spawn(process.execPath, ['-e', `
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }));
    });
    server.listen(0, '127.0.0.1', () => {
      process.stdout.write('PORT=' + server.address().port + '\\n');
    });
    setInterval(() => {}, 1000);
  `], { stdio: ['ignore', 'pipe', 'ignore'] });

  const port = await new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/PORT=(\d+)/);
      if (m) resolve(Number(m[1]));
    });
    child.once('error', reject);
  });

  return {
    url: `http://127.0.0.1:${port}/mcp`,
    close: () => new Promise((res) => {
      child.once('exit', () => res());
      child.kill();
      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already gone */ } }, 500).unref();
    }),
  };
}

// A URL that is guaranteed to be unreachable (nothing listens here), for the serena-down cases —
// deterministic regardless of whether this dev machine happens to have a real serena instance up
// on its usual port.
const DEAD_SERENA_URL = 'http://127.0.0.1:18929/mcp';

function grepDecision(toolInput, serenaUrl) {
  const work = tempDir('hooks-groupa-symgrep-');
  const logPath = join(work, 'log.jsonl');
  const env = { PRETOOLUSE_SERENA_URL: serenaUrl, PRETOOLUSE_SERENA_TIMEOUT_MS: '400' };
  const r = runCliRealRules({
    stdin: JSON.stringify({ tool_name: 'Grep', tool_input: toolInput }),
    logPath,
    env,
  });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  return { r, stdoutJson, logPath };
}

{
  const fake = await startFakeSerenaServer();
  try {
    // --- THE POSITIVE CASE: all three §5.1 conditions true -> warn (never block) ---------------
    {
      const { r, stdoutJson } = grepDecision({ pattern: 'computeEquipPlan', type: 'js' }, fake.url);
      check('symbolic-grep rule: exit code 0 for the all-three-true case', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
      check('symbolic-grep rule: code target + bare identifier + serena live -> WARN (allow + systemMessage), never deny',
        stdoutJson?.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson.systemMessage === 'string',
        `stdout=${JSON.stringify(stdoutJson)}`);
      check('symbolic-grep rule: the warn names §10.17/§5.1 and points at Serena',
        /§10\.17|§5\.1/.test(stdoutJson.systemMessage) && /[Ss]erena/.test(stdoutJson.systemMessage),
        `systemMessage=${stdoutJson.systemMessage}`);
    }
    // --- FIX ROUND 1 (coordinator review, §4): §5.1's condition (ב) is a BARE identifier, full
    // stop — no def/function/class widening. `function renderWorkplan` contains a space, which
    // is the brief's OWN named silent case ("ביטוי עם רווחים"); it must be silent even though it
    // also happens to look like a declaration. Measured directly against the real hook, matching
    // the reviewer's own findings: -----------------------------------------------------------
    for (const pattern of [
      'function renderWorkplan',
      'export function renderWorkplan',
      'def renderWorkplan',
      'class RenderWorkplan',
      'renderWorkplan ', // trailing space
      ' renderWorkplan', // leading space
    ]) {
      const { stdoutJson } = grepDecision({ pattern, type: 'js' }, fake.url);
      check(`symbolic-grep rule COUNTER (fix round 1): pattern "${pattern}" is NOT a bare identifier -> silent`,
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // Exact boundary: the SAME identifier with no surrounding text still warns — proves the
      // fix narrowed condition (ב) correctly rather than breaking bare-identifier matching itself.
      const { stdoutJson } = grepDecision({ pattern: 'renderWorkplan', type: 'js' }, fake.url);
      check('symbolic-grep rule: the bare identifier alone ("renderWorkplan", no surrounding text) still WARNS',
        typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
    }

    // --- THE COUNTER-CASES: exactly one condition fails at a time -> total silence, no warn ----
    {
      // (א) fails: not a code target (no type/glob/path at all).
      const { stdoutJson } = grepDecision({ pattern: 'computeEquipPlan' }, fake.url);
      check('symbolic-grep rule COUNTER: bare identifier with NO code target at all -> silent (no systemMessage)',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // (א) fails: docs/** sweep — the brief's own named example.
      const { stdoutJson } = grepDecision({ pattern: 'computeEquipPlan', path: 'docs/**' }, fake.url);
      check('symbolic-grep rule COUNTER: docs/** sweep (brief\'s own example) -> silent',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // (ב) fails: pattern contains spaces (a phrase, not an identifier) — brief's own example.
      const { stdoutJson } = grepDecision({ pattern: 'equip plan derivation', type: 'js' }, fake.url);
      check('symbolic-grep rule COUNTER: a pattern with spaces (brief\'s own example) -> silent',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // (ב) fails: Hebrew search — brief's own example.
      const { stdoutJson } = grepDecision({ pattern: 'ציוד בישול', type: 'js' }, fake.url);
      check('symbolic-grep rule COUNTER: Hebrew search (brief\'s own example) -> silent',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
  } finally {
    await fake.close();
  }
}
{
  // --- (ג) fails: serena down -> TOTAL silence, even though (א) and (ב) both match -------------
  const work = tempDir('hooks-groupa-symgrep-serenadown-');
  const logPath = join(work, 'log.jsonl');
  const { stdoutJson, r } = grepDecision({ pattern: 'computeEquipPlan', type: 'js' }, DEAD_SERENA_URL);
  check('symbolic-grep rule COUNTER: serena disconnected -> exit code 0, still allow', r.status === 0);
  check('symbolic-grep rule COUNTER: serena disconnected -> total silence (no systemMessage, no warning demanded of an unavailable tool)',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // non-Grep tool calls must never be touched by this rule, even with serena reachable.
  const fake = await startFakeSerenaServer();
  try {
    const work = tempDir('hooks-groupa-symgrep-nongrep-');
    const logPath = join(work, 'log.jsonl');
    const env = { PRETOOLUSE_SERENA_URL: fake.url };
    const r = runCliRealRules({ stdin: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'app.js' } }), logPath, env });
    let stdoutJson;
    try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
    check('symbolic-grep rule: a non-Grep tool call is untouched', stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await fake.close();
  }
}

// ---------------------------------------------------------------------------------------------
// TASK 6, RULE 2 — geniza-fallback-declaration.mjs: §10.13's grep/web-search fallback record.
// ---------------------------------------------------------------------------------------------

// Builds a synthetic transcript JSONL file with one assistant-turn line per entry. Each entry is
// { command, minutesAgo } (a Bash tool_use) or { none: true, minutesAgo } (a turn with no Bash
// tool_use at all, to prove noise doesn't accidentally count as a consult).
function writeTranscript(dir, entries) {
  const path = join(dir, 'transcript.jsonl');
  const now = Date.now();
  const lines = entries.map((e) => {
    const ts = new Date(now - e.minutesAgo * 60 * 1000).toISOString();
    const content = e.none
      ? [{ type: 'text', text: 'just thinking' }]
      : [{ type: 'tool_use', name: 'Bash', input: { command: e.command } }];
    return JSON.stringify({ type: 'assistant', timestamp: ts, message: { content } });
  });
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
  return path;
}

function grepDocsDecision({ toolInput, toolName, transcriptPath, windowMs, logPath }) {
  const work = tempDir('hooks-groupa-genizafallback-');
  const finalLogPath = logPath || join(work, 'log.jsonl');
  // Isolates these tests from whatever serena state happens to be real on this dev machine (a
  // shared serena instance IS often live here) — these tests are about the geniza-fallback rule
  // only, and must not incidentally also trip symbolic-grep-use-serena.mjs's own warning.
  const env = { PRETOOLUSE_SERENA_URL: DEAD_SERENA_URL };
  if (windowMs !== undefined) env.PRETOOLUSE_GENIZA_WINDOW_MS = String(windowMs);
  const stdinObj = { tool_name: toolName, tool_input: toolInput };
  if (transcriptPath !== undefined) stdinObj.transcript_path = transcriptPath;
  const r = runCliRealRules({ stdin: JSON.stringify(stdinObj), logPath: finalLogPath, env });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  return { r, stdoutJson, logPath: finalLogPath };
}

const RETRIEVAL_CMD = 'python -c "from src.knowledge import retrieval; print(retrieval.search_current_docs(\'x\'))"';

// --- THE POSITIVE CASE: docs-targeted Grep, transcript readable, no consult found -> WARN + the
// declaration is recorded automatically (no separate ask, no separate file). ---------------------
{
  const work = tempDir('hooks-groupa-genizafallback-warn-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const logPath = join(work, 'log.jsonl');
  const { r, stdoutJson } = grepDocsDecision({
    toolInput: { pattern: 'baldwin', glob: '**/*.md' },
    toolName: 'Grep',
    transcriptPath,
    logPath,
  });
  check('geniza-fallback rule: exit code 0 for the doc-targeted, not-consulted case', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('geniza-fallback rule: docs-targeted Grep with no recent consult -> WARN (allow + systemMessage), never deny',
    stdoutJson?.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson.systemMessage === 'string',
    `stdout=${JSON.stringify(stdoutJson)}`);
  check('geniza-fallback rule: the warn names §10.13 and "grep"', /§10\.13/.test(stdoutJson.systemMessage) && /grep/i.test(stdoutJson.systemMessage), `systemMessage=${stdoutJson.systemMessage}`);

  const events = readJsonl(logPath);
  const declared = events.find((e) => e.kind === 'grep_fallback_declared');
  check('geniza-fallback rule: the declaration was recorded AUTOMATICALLY in the hook log, no request made to anyone',
    !!declared && declared.tool === 'Grep', `events=${JSON.stringify(events)}`);
}

// --- WebSearch, same shape ------------------------------------------------------------------
{
  const work = tempDir('hooks-groupa-genizafallback-websearch-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 1 }]);
  const logPath = join(work, 'log.jsonl');
  const { stdoutJson } = grepDocsDecision({
    toolInput: { query: 'gemini pricing 2026' },
    toolName: 'WebSearch',
    transcriptPath,
    logPath,
  });
  check('geniza-fallback rule: WebSearch with no recent consult also WARNS', typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
  const events = readJsonl(logPath);
  check('geniza-fallback rule: WebSearch declaration is recorded too', events.some((e) => e.kind === 'grep_fallback_declared' && e.tool === 'WebSearch'), `events=${JSON.stringify(events)}`);
}

// --- COUNTER: geniza WAS consulted recently (within the window) -> silent, nothing recorded ----
{
  const work = tempDir('hooks-groupa-genizafallback-consulted-');
  const transcriptPath = writeTranscript(work, [{ command: RETRIEVAL_CMD, minutesAgo: 5 }]);
  const logPath = join(work, 'log.jsonl');
  const { stdoutJson } = grepDocsDecision({
    toolInput: { pattern: 'baldwin', glob: '**/*.md' },
    toolName: 'Grep',
    transcriptPath,
    logPath,
  });
  check('geniza-fallback rule COUNTER: geniza consulted 5 min ago (inside the 20-min default window) -> silent',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  const events = readJsonl(logPath);
  check('geniza-fallback rule COUNTER: nothing recorded when the geniza WAS consulted', !events.some((e) => e.kind === 'grep_fallback_declared'), `events=${JSON.stringify(events)}`);
}

// --- COUNTER: geniza consulted, but OUTSIDE a short overridden window -> warns again ------------
{
  const work = tempDir('hooks-groupa-genizafallback-stale-consult-');
  const transcriptPath = writeTranscript(work, [{ command: RETRIEVAL_CMD, minutesAgo: 5 }]);
  const logPath = join(work, 'log.jsonl');
  const { stdoutJson } = grepDocsDecision({
    toolInput: { pattern: 'baldwin', glob: '**/*.md' },
    toolName: 'Grep',
    transcriptPath,
    windowMs: 60 * 1000, // 1 minute — the 5-minute-old consult is now stale
    logPath,
  });
  check('geniza-fallback rule: a consult OUTSIDE the (overridden, shorter) window no longer excuses the fallback -> warns',
    typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- COUNTER: not doc-targeted (a plain code Grep) -> silent regardless of transcript state -----
{
  const work = tempDir('hooks-groupa-genizafallback-code-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]); // no consult at all
  const logPath = join(work, 'log.jsonl');
  const { stdoutJson } = grepDocsDecision({
    toolInput: { pattern: 'resolveSource', type: 'py' },
    toolName: 'Grep',
    transcriptPath,
    logPath,
  });
  check('geniza-fallback rule COUNTER: a code-targeted Grep (not aimed at documents) is silent even with zero consult evidence',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  const events = readJsonl(logPath);
  check('geniza-fallback rule COUNTER: nothing recorded for a code-targeted Grep', !events.some((e) => e.kind === 'grep_fallback_declared'), `events=${JSON.stringify(events)}`);
}

// --- COUNTER: no transcript_path at all (no honest evidence either way) -> silent, not accused --
{
  const { stdoutJson, r } = grepDocsDecision({
    toolInput: { pattern: 'baldwin', glob: '**/*.md' },
    toolName: 'Grep',
    // transcriptPath deliberately omitted
  });
  check('geniza-fallback rule COUNTER: no transcript_path at all -> exit 0, silent (cannot prove absence of a consult)',
    r.status === 0 && stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- COUNTER: transcript_path points at a non-existent/unreadable file -> silent, never a crash -
{
  const { stdoutJson, r } = grepDocsDecision({
    toolInput: { pattern: 'baldwin', glob: '**/*.md' },
    toolName: 'Grep',
    transcriptPath: join(tempDir('hooks-groupa-genizafallback-notreal-'), 'does-not-exist.jsonl'),
  });
  check('geniza-fallback rule COUNTER: unreadable transcript path -> exit 0, silent, no crash',
    r.status === 0 && stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}

// --- non-Grep/non-WebSearch tool calls are untouched ---------------------------------------------
{
  const { stdoutJson } = grepDocsDecision({
    toolInput: { file_path: 'docs/x.md' },
    toolName: 'Read',
  });
  check('geniza-fallback rule: a Read call (not Grep/WebSearch) is untouched', stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// TASK 13 (R-116) — both knowledge rules were blind to a grep run through Bash instead of the
// dedicated Grep tool (105 greps through Bash, 0 through Grep, measured over one shift). Same
// discipline as Task 6: exercise the REAL rule files under the REAL default rules dir.
// ---------------------------------------------------------------------------------------------
function bashSymGrepDecision(command, serenaUrl) {
  const work = tempDir('hooks-groupa-bashsymgrep-');
  const logPath = join(work, 'log.jsonl');
  const env = { PRETOOLUSE_SERENA_URL: serenaUrl, PRETOOLUSE_SERENA_TIMEOUT_MS: '400' };
  const r = runCliRealRules({
    stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    logPath,
    env,
  });
  let stdoutJson;
  try { stdoutJson = r.stdout.trim() === '' ? {} : JSON.parse(r.stdout); } catch { stdoutJson = undefined; }
  return { r, stdoutJson, logPath };
}

{
  const fake = await startFakeSerenaServer();
  try {
    // --- THE POSITIVE CASE: a genuine `grep` invocation inside Bash, targeting code with a bare
    // identifier as a real SWEEP (a directory, not a single named file — see FIX ROUND 1 below
    // for why a single file no longer qualifies), serena live -> WARN, exactly as the dedicated
    // Grep tool already does. This is the RED this task exists to turn GREEN: before the fix,
    // tool_name !== 'Grep' short-circuits this rule straight to `allow` with no warning at all,
    // no matter what the command contains.
    {
      const { r, stdoutJson } = bashSymGrepDecision('grep -rn "computeEquipPlan" src/', fake.url);
      check('TASK 13 symbolic-grep/Bash: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
      check('TASK 13 symbolic-grep/Bash: `grep -rn pattern src/` (code sweep, bare identifier, serena live) -> WARN, never deny',
        stdoutJson?.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson.systemMessage === 'string',
        `stdout=${JSON.stringify(stdoutJson)}`);
      check('TASK 13 symbolic-grep/Bash: the warn names §10.17/§5.1 and Serena, same as the Grep-tool path',
        /§10\.17|§5\.1/.test(stdoutJson.systemMessage) && /[Ss]erena/.test(stdoutJson.systemMessage),
        `systemMessage=${stdoutJson.systemMessage}`);
    }
    // --- ripgrep, --type instead of a path, still recognized as a code target ------------------
    {
      const { stdoutJson } = bashSymGrepDecision('rg --type js computeEquipPlan', fake.url);
      check('TASK 13 symbolic-grep/Bash: `rg --type js computeEquipPlan` -> WARN (type is a code type)',
        typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
    }
    // --- pipeline segmentation: `cmd | grep x` inspects the `grep x` segment on its own, and it
    // is silent here because THAT segment names no code target at all (a bare unqualified pipe
    // grep, no file/dir/type argument) — proves the shared segmenter is wired, not merely that
    // everything is silent by default. ----------------------------------------------------------
    {
      const { stdoutJson } = bashSymGrepDecision('cat notes.txt | grep computeEquipPlan', fake.url);
      check('TASK 13 symbolic-grep/Bash COUNTER: `cmd | grep x` with no target argument -> silent (segment inspected, no code target)',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    // --- THE COUNTER-CASES the brief calls "the larger half" -----------------------------------
    {
      // `echo "grep foo"` (brief's own named example): echo never runs grep at all — the
      // segment's own leading word is `echo`, not `grep`.
      const { stdoutJson } = bashSymGrepDecision('echo "grep -n computeEquipPlan src/app.js"', fake.url);
      check('TASK 13 symbolic-grep/Bash COUNTER (brief\'s own example): `echo "grep foo"` -> silent, echo never runs grep',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // A targeted grep of a KNOWN docs file (brief's own named counter-case) is not a code
      // target at all — (א) fails regardless of the Bash extension.
      const { stdoutJson } = bashSymGrepDecision('grep -n "R-72" docs/ROADMAP-2026-07-30.md', fake.url);
      check('TASK 13 symbolic-grep/Bash COUNTER: targeted known-file grep of a docs file -> silent (not a code target)',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // docs/** sweep via Bash — same silence as the Grep-tool path, for the same reason (א).
      const { stdoutJson } = bashSymGrepDecision('grep -rn "computeEquipPlan" docs/', fake.url);
      check('TASK 13 symbolic-grep/Bash COUNTER: docs/** sweep via Bash -> silent (not a code target)',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // A pattern with spaces via Bash (brief's own named example) -> not a bare identifier.
      const { stdoutJson } = bashSymGrepDecision('grep -n "equip plan derivation" src/app.js', fake.url);
      check('TASK 13 symbolic-grep/Bash COUNTER: pattern with spaces via Bash -> silent',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
    {
      // A Hebrew pattern via Bash (brief's own named example) -> not a bare identifier.
      const { stdoutJson } = bashSymGrepDecision('grep -n "ציוד בישול" src/app.js', fake.url);
      check('TASK 13 symbolic-grep/Bash COUNTER: Hebrew pattern via Bash -> silent',
        stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
    }
  } finally {
    await fake.close();
  }
}
{
  // --- (ג) fails via Bash too: serena down -> total silence even though (א)+(ב)+sweep all match -
  const { stdoutJson, r } = bashSymGrepDecision('grep -rn "computeEquipPlan" src/', DEAD_SERENA_URL);
  check('TASK 13 symbolic-grep/Bash COUNTER: serena disconnected -> exit code 0, still allow', r.status === 0);
  check('TASK 13 symbolic-grep/Bash COUNTER: serena disconnected -> total silence',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // A Bash command that never runs grep at all (the overwhelming majority of Bash calls) is
  // silent, even with serena live — the fix must not turn every Bash call into a probe.
  const fake = await startFakeSerenaServer();
  try {
    const { stdoutJson } = bashSymGrepDecision('npm test', fake.url);
    check('TASK 13 symbolic-grep/Bash COUNTER: an ordinary non-grep Bash command -> silent',
      stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await fake.close();
  }
}

// --- geniza-fallback-declaration.mjs via Bash -----------------------------------------------
{
  // --- THE POSITIVE CASE: a real corpus sweep of docs/ run through Bash, no recent consult ----
  const work = tempDir('hooks-groupa-bashgeniza-warn-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const logPath = join(work, 'log.jsonl');
  const { r, stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -rn "baldwin" docs/' },
    toolName: 'Bash',
    transcriptPath,
    logPath,
  });
  check('TASK 13 geniza-fallback/Bash: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('TASK 13 geniza-fallback/Bash: `grep -rn pattern docs/` (a real sweep, no recent consult) -> WARN',
    stdoutJson?.hookSpecificOutput?.permissionDecision === 'allow' && typeof stdoutJson.systemMessage === 'string',
    `stdout=${JSON.stringify(stdoutJson)}`);
  check('TASK 13 geniza-fallback/Bash: the warn names §10.13', /§10\.13/.test(stdoutJson.systemMessage), `systemMessage=${stdoutJson.systemMessage}`);
  const events = readJsonl(logPath);
  check('TASK 13 geniza-fallback/Bash: the declaration is recorded with tool "Bash" (not "Grep") — the whole point of R-116',
    events.some((e) => e.kind === 'grep_fallback_declared' && e.tool === 'Bash'), `events=${JSON.stringify(events)}`);
}
{
  // --- rg --type md, no path at all -> still a sweep (scans every markdown file in cwd) -------
  const work = tempDir('hooks-groupa-bashgeniza-typemd-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'rg --type md baldwin' },
    toolName: 'Bash',
    transcriptPath,
  });
  check('TASK 13 geniza-fallback/Bash: `rg --type md pattern` -> WARN (a type sweep, no path needed)',
    typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // --- THE NAMED COUNTER-CASE, checked personally per the brief: a targeted grep of a KNOWN
  // file is not a corpus search and must stay silent, even with zero consult evidence. ----------
  const work = tempDir('hooks-groupa-bashgeniza-knownfile-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const logPath = join(work, 'log.jsonl');
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -n "R-72" docs/ROADMAP-2026-07-30.md' },
    toolName: 'Bash',
    transcriptPath,
    logPath,
  });
  check('TASK 13 geniza-fallback/Bash COUNTER (the named case): targeted grep of a KNOWN file -> silent, not a corpus search',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  const events = readJsonl(logPath);
  check('TASK 13 geniza-fallback/Bash COUNTER: nothing recorded for the known-file case',
    !events.some((e) => e.kind === 'grep_fallback_declared'), `events=${JSON.stringify(events)}`);
}
{
  // --- echo "grep ..." never runs grep -> silent, regardless of what the string says -----------
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'echo "grep -rn baldwin docs/"' },
    toolName: 'Bash',
    transcriptPath: writeTranscript(tempDir('hooks-groupa-bashgeniza-echo-'), [{ none: true, minutesAgo: 2 }]),
  });
  check('TASK 13 geniza-fallback/Bash COUNTER: `echo "grep ... docs/"` -> silent, echo never runs grep',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // --- a code-targeted Bash grep (src/) is not aimed at documents -> silent regardless of consult
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -rn "resolveSource" src/' },
    toolName: 'Bash',
    transcriptPath: writeTranscript(tempDir('hooks-groupa-bashgeniza-code-'), [{ none: true, minutesAgo: 2 }]),
  });
  check('TASK 13 geniza-fallback/Bash COUNTER: a code-targeted Bash grep (src/) -> silent',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // --- geniza WAS consulted recently -> silent even for a real Bash sweep -----------------------
  const work = tempDir('hooks-groupa-bashgeniza-consulted-');
  const transcriptPath = writeTranscript(work, [{ command: RETRIEVAL_CMD, minutesAgo: 5 }]);
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -rn "baldwin" docs/' },
    toolName: 'Bash',
    transcriptPath,
  });
  check('TASK 13 geniza-fallback/Bash COUNTER: geniza consulted recently -> silent even for a real Bash sweep',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // --- an ordinary non-grep Bash command is untouched, whatever the transcript state -----------
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'python build.py' },
    toolName: 'Bash',
    transcriptPath: writeTranscript(tempDir('hooks-groupa-bashgeniza-ordinary-'), [{ none: true, minutesAgo: 2 }]),
  });
  check('TASK 13 geniza-fallback/Bash COUNTER: an ordinary non-grep Bash command -> silent',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}

// ---------------------------------------------------------------------------------------------
// TASK 13, FIX ROUND 1 (coordinator review, 2026-08-08) — the coordinator drove both rules
// directly with real command shapes and found three false positives. These are those EXACT
// commands, verbatim, so the suite itself would have caught what the coordinator's manual probe
// caught. See symbolic-grep-use-serena.mjs's own header for the investigation of all three
// (one confirmed and fixed — the known-file exemption; two investigated and refuted by
// measurement — see below and the report).
// ---------------------------------------------------------------------------------------------
{
  // Command 1 — a targeted read of ONE already-known code file. CONFIRMED bug, NOW FIXED: the
  // symbolic-grep rule must not warn on a single named file any more than the geniza rule does.
  const fake = await startFakeSerenaServer();
  try {
    const { stdoutJson } = bashSymGrepDecision('grep -n "tool_name" scripts/hooks/rules/symbolic-grep-use-serena.mjs', fake.url);
    check('TASK 13 FIX ROUND 1 (coordinator command 1): `grep -n "tool_name" <one known .mjs file>` -> silent (known-file exemption, same as geniza)',
      stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await fake.close();
  }
  const work = tempDir('hooks-groupa-fixround1-cmd1-geniza-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -n "tool_name" scripts/hooks/rules/symbolic-grep-use-serena.mjs' },
    toolName: 'Bash',
    transcriptPath,
  });
  check('TASK 13 FIX ROUND 1 (coordinator command 1): geniza-fallback -> silent (a code path, never doc-targeted)',
    stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // Command 2 — a Hebrew pattern against docs/. REFUTED by measurement (see the rule file's own
  // header and the report): (א) alone already makes a symbolic-grep warn impossible here, since
  // `docs/` can never match CODE_PATH — confirmed silent regardless of the Bash extraction fix.
  // For geniza-fallback, this command IS a genuine docs/ sweep (the human-readable pattern text
  // plays no part in that rule's classification) — WARNS here under a fixture with no recent
  // consult, which is the correct, intended behavior; the coordinator's live probe reading
  // "G silent" reflects THEIR session's own consult/transcript state at the moment they ran it,
  // not a rule defect — verified separately, not re-litigated here.
  const fake = await startFakeSerenaServer();
  try {
    const { stdoutJson } = bashSymGrepDecision('grep -rn "מדריך האש" docs/', fake.url);
    check('TASK 13 FIX ROUND 1 (coordinator command 2): Hebrew pattern against docs/ -> symbolic-grep silent (docs/ is never a code target)',
      stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await fake.close();
  }
  const work = tempDir('hooks-groupa-fixround1-cmd2-geniza-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -rn "מדריך האש" docs/' },
    toolName: 'Bash',
    transcriptPath,
  });
  check('TASK 13 FIX ROUND 1 (coordinator command 2): geniza-fallback -> WARN (a genuine docs/ sweep, no recent consult)',
    typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // Command 3 — a spaced phrase against docs/. Same reasoning and same refutation as command 2:
  // (א) makes symbolic-grep's warn impossible against docs/ regardless of (ב); geniza-fallback
  // correctly warns because this IS a genuine sweep with no recent consult.
  const fake = await startFakeSerenaServer();
  try {
    const { stdoutJson } = bashSymGrepDecision('grep -rn "source authority" docs/', fake.url);
    check('TASK 13 FIX ROUND 1 (coordinator command 3): spaced phrase against docs/ -> symbolic-grep silent (docs/ is never a code target)',
      stdoutJson?.systemMessage === undefined, `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await fake.close();
  }
  const work = tempDir('hooks-groupa-fixround1-cmd3-geniza-');
  const transcriptPath = writeTranscript(work, [{ none: true, minutesAgo: 2 }]);
  const { stdoutJson } = grepDocsDecision({
    toolInput: { command: 'grep -rn "source authority" docs/' },
    toolName: 'Bash',
    transcriptPath,
  });
  check('TASK 13 FIX ROUND 1 (coordinator command 3): geniza-fallback -> WARN (a genuine docs/ sweep, no recent consult)',
    typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
}
{
  // Command 4 (the coordinator's own control case, code sweep) — must still WARN under both the
  // pre-fix and post-fix rule: `src/` is a directory (isSweep true), so the known-file exemption
  // does not apply here, and it never should — this is exactly the symbol-shaped work §5.1 exists
  // to redirect toward Serena.
  const fake = await startFakeSerenaServer();
  try {
    const { stdoutJson } = bashSymGrepDecision('grep -rn "renderWorkplan" src/', fake.url);
    check('TASK 13 FIX ROUND 1 (coordinator control case): `grep -rn pattern src/` (a real sweep) -> still WARNS after the known-file fix',
      typeof stdoutJson?.systemMessage === 'string', `stdout=${JSON.stringify(stdoutJson)}`);
  } finally {
    await fake.close();
  }
}

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
