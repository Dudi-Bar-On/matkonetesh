#!/usr/bin/env node
// scripts/tests/test-hooks-groupb.mjs — RED/GREEN proof for the PostToolUse entry point
// (scripts/hooks/posttooluse.mjs), section 1 of Group B (task-1-brief.md).
//
// This tests the RUNNER's own failure modes — a malformed payload, an observer that throws, an
// observer that returns nonsense — exactly like test-hooks-groupa.mjs did for the PreToolUse
// pipeline. PostToolUse here is an EAR, not a mouth: observers never return decisions, so there is
// no allow/warn/block lattice to prove, only "did every failure resolve to exit 0 + {} + a named
// log record, and did one broken observer fail to silence its siblings".
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'scripts', 'hooks', 'posttooluse.mjs');
const POSTTOOLUSE_MODULE = pathToFileURL(CLI).href;

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

function writeObserver(dir, filename, body) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), body, 'utf8');
}

function runPostCli({ stdin, observersDir, logPath, env: extraEnv }) {
  const env = { ...process.env, ...(extraEnv || {}) };
  if (observersDir) env.POSTTOOLUSE_OBSERVERS_DIR = observersDir;
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
// RED #1 — malformed JSON on stdin -> exit 0, {} on stdout, malformed_input logged.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupb-malformed-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers'); // deliberately does not exist -> empty runner

  const r = runPostCli({ stdin: '{ this is not valid JSON !!', observersDir, logPath });

  check('malformed JSON: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('malformed JSON: stdout is exactly {}', r.stdout.trim() === '{}', `stdout=${JSON.stringify(r.stdout)}`);

  const events = readJsonl(logPath);
  const malformedEvent = events.find((e) => e.kind === 'malformed_input');
  check('malformed JSON: a malformed_input event was recorded', !!malformedEvent, `events=${JSON.stringify(events)}`);
}

// ---------------------------------------------------------------------------------------------
// RED #2 — an observer that throws -> observer_threw logged, sibling observer still ran.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupb-throws-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers');
  const markerPath = join(work, 'b-ran.marker');

  writeObserver(observersDir, 'a-throws.mjs', `
export function observe(input) {
  throw new Error('boom from a-throws');
}
`);
  writeObserver(observersDir, 'b-records.mjs', `
import { writeFileSync } from 'node:fs';
export function observe(input) {
  writeFileSync(${JSON.stringify(markerPath)}, 'ran');
  return { events: [{ type: 'marker', ok: true }] };
}
`);

  const r = runPostCli({
    stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hi' }, tool_response: { stdout: 'hi', stderr: '', interrupted: false } }),
    observersDir,
    logPath,
  });

  check('observer throws: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('observer throws: stdout is exactly {}', r.stdout.trim() === '{}', `stdout=${JSON.stringify(r.stdout)}`);

  const events = readJsonl(logPath);
  const threwEvent = events.find((e) => e.kind === 'observer_threw' && e.observer === 'a-throws.mjs');
  check('observer throws: the throwing observer was recorded by name with the error', !!threwEvent, `events=${JSON.stringify(events)}`);
  check('observer throws: the error text from the throw is present in the record', typeof threwEvent?.error === 'string' && threwEvent.error.includes('boom from a-throws'));

  check('observer throws: the OTHER observer (b-records) still ran (marker file exists)', existsSync(markerPath));
}

// ---------------------------------------------------------------------------------------------
// RED #3 — an observer that returns nonsense (a string, a number, an array) -> exit 0,
// observer_nonsense_return logged, the returned value named verbatim.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupb-nonsense-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers');

  writeObserver(observersDir, '01-returns-string.mjs', `export function observe() { return 'yes'; }`);
  writeObserver(observersDir, '02-returns-array.mjs', `export function observe() { return [1, 2, 3]; }`);
  writeObserver(observersDir, '03-returns-number.mjs', `export function observe() { return 42; }`);

  const r = runPostCli({
    stdin: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' }, tool_response: {} }),
    observersDir,
    logPath,
  });

  check('observer nonsense: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('observer nonsense: stdout is exactly {}', r.stdout.trim() === '{}', `stdout=${JSON.stringify(r.stdout)}`);

  const events = readJsonl(logPath);
  const nonsenseEvents = events.filter((e) => e.kind === 'observer_nonsense_return');
  check('observer nonsense: all three malformed returns were caught, one record each', nonsenseEvents.length === 3, `events=${JSON.stringify(events)}`);
  const byObserver = Object.fromEntries(nonsenseEvents.map((e) => [e.observer, e]));
  check('observer nonsense: the bare-string return is named verbatim', byObserver['01-returns-string.mjs']?.returned === JSON.stringify('yes'));
  check('observer nonsense: the array return is named verbatim', byObserver['02-returns-array.mjs']?.returned === JSON.stringify([1, 2, 3]));
  check('observer nonsense: the number return is named verbatim', byObserver['03-returns-number.mjs']?.returned === JSON.stringify(42));
}

// ---------------------------------------------------------------------------------------------
// COUNTER-RED — empty observers dir + an ordinary successful Bash payload -> exit 0, stdout {},
// ONLY the terminal 'observed' log record. No warning text anywhere. This is the case Phase 3's
// own COUNTER-RED lesson (task-1-brief.md's closing line) says matters more than the RED cases:
// a hook that is loud about nothing is as much a bug as one that is silent about something real.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupb-counter-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers-does-not-exist'); // no observers registered at all

  const ordinaryPayload = JSON.stringify({
    session_id: 'abc123',
    transcript_path: '/tmp/whatever.jsonl',
    cwd: ROOT,
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'echo hi' },
    tool_response: { stdout: 'hi', stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
    tool_use_id: 'toolu_test',
    duration_ms: 42,
  });

  const r = runPostCli({ stdin: ordinaryPayload, observersDir, logPath });

  check('COUNTER-RED: exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('COUNTER-RED: stdout is exactly {} (no user-visible output)', r.stdout.trim() === '{}', `stdout=${JSON.stringify(r.stdout)}`);
  check('COUNTER-RED: nothing was written to stderr', (r.stderr || '').trim() === '', `stderr=${r.stderr}`);

  const events = readJsonl(logPath);
  check('COUNTER-RED: exactly one event was logged (the terminal observed record, nothing spurious)', events.length === 1, `events=${JSON.stringify(events)}`);
  check('COUNTER-RED: that event is kind=observed with 0 observers evaluated', events[0]?.kind === 'observed' && events[0]?.observers_evaluated === 0, `event=${JSON.stringify(events[0])}`);
  const anyWarningText = events.some((e) => JSON.stringify(e).toLowerCase().includes('warn'));
  check('COUNTER-RED: no warning text anywhere in the logged events', !anyWarningText, `events=${JSON.stringify(events)}`);
}

// ---------------------------------------------------------------------------------------------
// TIMING — the empty runner's own cost. Wired for Bash|Edit|Write|browser_navigate, this pays a
// tax on every one of those calls; Phase 3 measured PreToolUse's empty-pipeline baseline at
// ~50ms/call (node spawn dominated) — this must stay in that neighbourhood.
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupb-timing-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers-does-not-exist');
  const normalInput = JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'echo hi' }, tool_response: { stdout: 'hi', stderr: '', interrupted: false } });

  runPostCli({ stdin: normalInput, observersDir, logPath }); // warm-up

  const N = 10;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const r = runPostCli({ stdin: normalInput, observersDir, logPath });
    const elapsedMs = Date.now() - t0;
    samples.push(elapsedMs);
    check(`timing sample #${i + 1}: exit 0`, r.status === 0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`\nEMPTY POSTTOOLUSE RUNNER TIMING (includes full \`node\` process spawn, ${N} samples, sorted): [${samples.join(', ')}] ms — median ${median}ms`);
  check('timing: measured and printed above (informational — see task report)', true);
}

// ---------------------------------------------------------------------------------------------
// FIX ROUND 1 (coordinator ruling, 2026-08-08) — PostToolUseFailure is now measured, wired, and
// normalized. Section proves: extractExitCode() in isolation; the normalized _outcome shape an
// observer actually receives for each of the two real measured events; RED — a failing command's
// payload reaches an observer that only fires on failure; COUNTER-RED — the SAME observer sees
// nothing for an ordinary successful payload (the asymmetry named in the header comment must not
// silently make every call look like a failure, or like a success).
// ---------------------------------------------------------------------------------------------
{
  const { extractExitCode } = await import(POSTTOOLUSE_MODULE);
  check('extractExitCode: "Exit code 7" -> 7', extractExitCode('Exit code 7') === 7);
  check('extractExitCode: "Exit code 42" -> 42', extractExitCode('Exit code 42') === 42);
  check('extractExitCode: "Exit code -1" -> -1', extractExitCode('Exit code -1') === -1);
  check('extractExitCode: "Exit code 0" -> 0 (not confused with null/false)', extractExitCode('Exit code 0') === 0);
  check('extractExitCode: unrelated text -> null', extractExitCode('boom, something else entirely') === null);
  check('extractExitCode: non-string input -> null (never throws)', extractExitCode(undefined) === null && extractExitCode(null) === null && extractExitCode(42) === null);
}

// Real PostToolUseFailure payload shape (field-for-field as measured/reproduced in the header
// comment: session_id, tool_input.command, error, is_interrupt — no tool_response key at all).
const REAL_FAILURE_PAYLOAD = {
  session_id: 'sess-abc',
  transcript_path: '/tmp/whatever.jsonl',
  cwd: ROOT,
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'Bash',
  tool_input: { command: 'exit 7' },
  tool_use_id: 'toolu_fail_1',
  error: 'Exit code 7',
  is_interrupt: false,
  duration_ms: 65,
};

const REAL_SUCCESS_PAYLOAD = {
  session_id: 'sess-abc',
  transcript_path: '/tmp/whatever.jsonl',
  cwd: ROOT,
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'echo hi' },
  tool_use_id: 'toolu_ok_1',
  duration_ms: 40,
  tool_response: {
    stdout: 'hi', stderr: '', interrupted: false, isImage: false, noOutputExpected: false,
  },
};

{
  // RED — an observer that only records on failure must see the failure payload, with the parsed
  // exit code attached, and with session_id/tool_input untouched (Group B keys state on both).
  const work = tempDir('hooks-groupb-failure-red-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers');
  const capturePath = join(work, 'captured.json');

  writeObserver(observersDir, 'fails-only.mjs', `
import { writeFileSync } from 'node:fs';
export function observe(input) {
  if (input._outcome.ok === false) {
    writeFileSync(${JSON.stringify(capturePath)}, JSON.stringify({
      session_id: input.session_id,
      command: input.tool_input && input.tool_input.command,
      exit_code: input._outcome.exit_code,
      interrupted: input._outcome.interrupted,
      raw_error: input._outcome.raw_error,
    }));
  }
}
`);

  const r = runPostCli({ stdin: JSON.stringify(REAL_FAILURE_PAYLOAD), observersDir, logPath });
  check('RED (failure path): exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('RED (failure path): stdout is exactly {}', r.stdout.trim() === '{}');
  check('RED (failure path): the failure-only observer DID fire (capture file exists)', existsSync(capturePath));

  if (existsSync(capturePath)) {
    const captured = JSON.parse(readFileSync(capturePath, 'utf8'));
    check('RED (failure path): session_id reached the observer untouched', captured.session_id === 'sess-abc', `got=${JSON.stringify(captured)}`);
    check('RED (failure path): tool_input.command reached the observer untouched', captured.command === 'exit 7', `got=${JSON.stringify(captured)}`);
    check('RED (failure path): _outcome.exit_code is the NUMBER 7, not the string "Exit code 7"', captured.exit_code === 7, `got=${JSON.stringify(captured)}`);
    check('RED (failure path): _outcome.interrupted reflects is_interrupt (false here)', captured.interrupted === false);
    check('RED (failure path): _outcome.raw_error preserves the original text for anything that still wants it', captured.raw_error === 'Exit code 7');
  }

  const events = readJsonl(logPath);
  const observedEvent = events.find((e) => e.kind === 'observed');
  check('RED (failure path): the terminal observed record says ok=false, exit_code=7, source_event=PostToolUseFailure',
    observedEvent?.ok === false && observedEvent?.exit_code === 7 && observedEvent?.source_event === 'PostToolUseFailure',
    `event=${JSON.stringify(observedEvent)}`);
}

{
  // COUNTER-RED — the SAME failure-only observer, given an ORDINARY SUCCESSFUL payload, must NOT
  // fire. This is the case that matters more: an observer wired for failures that fires on every
  // call regardless would make §6.1's fix-cycle counter count every successful command as a fix.
  const work = tempDir('hooks-groupb-failure-counter-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers');
  const capturePath = join(work, 'captured.json');

  writeObserver(observersDir, 'fails-only.mjs', `
import { writeFileSync } from 'node:fs';
export function observe(input) {
  if (input._outcome.ok === false) {
    writeFileSync(${JSON.stringify(capturePath)}, 'should never be written');
  }
}
`);

  const r = runPostCli({ stdin: JSON.stringify(REAL_SUCCESS_PAYLOAD), observersDir, logPath });
  check('COUNTER-RED (failure path): exit code 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  check('COUNTER-RED (failure path): the failure-only observer did NOT fire for a successful payload', !existsSync(capturePath));

  const events = readJsonl(logPath);
  const observedEvent = events.find((e) => e.kind === 'observed');
  check('COUNTER-RED (failure path): the terminal observed record says ok=true, exit_code=null, source_event=PostToolUse',
    observedEvent?.ok === true && observedEvent?.exit_code === null && observedEvent?.source_event === 'PostToolUse',
    `event=${JSON.stringify(observedEvent)}`);
}

// ---------------------------------------------------------------------------------------------
// TIMING, BOTH EVENTS WIRED — re-measures the per-call cost now that the script also handles
// PostToolUseFailure payloads (same script, same cost profile expected — the branch added is O(1)).
// ---------------------------------------------------------------------------------------------
{
  const work = tempDir('hooks-groupb-timing-failure-');
  const logPath = join(work, 'log.jsonl');
  const observersDir = join(work, 'observers-does-not-exist');
  const failureInput = JSON.stringify(REAL_FAILURE_PAYLOAD);

  runPostCli({ stdin: failureInput, observersDir, logPath }); // warm-up

  const N = 10;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const r = runPostCli({ stdin: failureInput, observersDir, logPath });
    const elapsedMs = Date.now() - t0;
    samples.push(elapsedMs);
    check(`timing (failure payload) sample #${i + 1}: exit 0`, r.status === 0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`\nPOSTTOOLUSE RUNNER TIMING, FAILURE PAYLOAD (${N} samples, sorted): [${samples.join(', ')}] ms — median ${median}ms`);
  check('timing (failure payload): measured and printed above (informational — see task report)', true);
}

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
