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

// =================================================================================================
// SECTION 2 — scripts/hooks/lib/enforcement-state.mjs (task-2-brief.md). The SQLite state store
// every Group B counter sits on. Tests run against a temp ENFORCEMENT_STATE_PATH (spawned via
// PowerShell/child processes for cross-process persistence proofs, or imported directly in-process
// for the cheaper unit-shaped checks) — never against the real repo store.
// =================================================================================================
{
  const { spawnSync: spawnSyncState } = await import('node:child_process');
  const stateWork = tempDir('hooks-groupb-state-');

  function freshStatePath(name) {
    return join(stateWork, name);
  }

  // Runs a throwaway node -e script with ENFORCEMENT_STATE_PATH set, importing the real module —
  // used for the "survives a fresh process" proof, where the whole point is a SEPARATE process.
  function runInChildProcess(statePathVal, code) {
    const moduleHref = pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href;
    const script = `
      import * as ES from ${JSON.stringify(moduleHref)};
      ${code}
    `;
    return spawnSyncState(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { ...process.env, ENFORCEMENT_STATE_PATH: statePathVal },
      cwd: ROOT,
      timeout: 15000,
    });
  }

  // -----------------------------------------------------------------------------------------
  // RED — "attempts survive a fresh process": one child process opens the store and records a
  // failure + edit + failure (closing one cycle to attempts=1), a SECOND, entirely separate
  // child process opens the SAME path and reads openTargets() back. This is the §6.2 "the
  // counter survives" property proven the way the brief demands: two unrelated OS processes,
  // not two calls in the same process (which would prove nothing about persistence).
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('persist.sqlite');
    const writeResult = runInChildProcess(p, `
      const db = ES.openState();
      ES.noteVerificationFailure(db, 'sess-persist', ['T1']);
      ES.noteEdit(db, 'sess-persist', '/some/file.js');
      ES.noteVerificationFailure(db, 'sess-persist', ['T1']);
      db.close();
      process.stdout.write('done');
    `);
    check('persistence: writer child process exited 0', writeResult.status === 0, `stderr=${writeResult.stderr}`);
    check('persistence: writer child wrote "done"', writeResult.stdout.trim() === 'done', `stdout=${JSON.stringify(writeResult.stdout)} stderr=${writeResult.stderr}`);

    const readResult = runInChildProcess(p, `
      const db = ES.openState();
      const targets = ES.openTargets(db, 'sess-persist');
      db.close();
      process.stdout.write(JSON.stringify(targets));
    `);
    check('persistence: reader child process exited 0', readResult.status === 0, `stderr=${readResult.stderr}`);
    let readTargets = null;
    try { readTargets = JSON.parse(readResult.stdout.trim()); } catch { /* leave null, checked below */ }
    check('persistence: reader child saw the target array', Array.isArray(readTargets), `stdout=${JSON.stringify(readResult.stdout)} stderr=${readResult.stderr}`);
    if (Array.isArray(readTargets)) {
      check('persistence: attempts=1 survived into the second process', readTargets.find((t) => t.target === 'T1')?.attempts === 1, `targets=${JSON.stringify(readTargets)}`);
    }
  }

  // -----------------------------------------------------------------------------------------
  // In-process checks from here on (importing the module directly) — cheaper, and just as valid
  // for same-process behavioural proofs; only the persistence proof above needed real separate
  // processes.
  // -----------------------------------------------------------------------------------------
  const ES = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);

  // -----------------------------------------------------------------------------------------
  // RED — "§6.1 cycle semantics", the exact trap case named in the brief: a re-run that fails
  // WITHOUT an intervening edit must NOT count as a new attempt.
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('cycle.sqlite');
    const db = ES.openState(p);
    check('cycle: openState() returned a usable db', !!db);

    ES.noteVerificationFailure(db, 'sess-cycle', ['T']);
    let targets = ES.openTargets(db, 'sess-cycle');
    check('cycle: first failure -> target exists, attempts=0', targets.find((t) => t.target === 'T')?.attempts === 0, `targets=${JSON.stringify(targets)}`);

    ES.noteEdit(db, 'sess-cycle', '/f.js');
    ES.noteVerificationFailure(db, 'sess-cycle', ['T']);
    targets = ES.openTargets(db, 'sess-cycle');
    check('cycle: edit then failure -> attempts=1 (one closed cycle)', targets.find((t) => t.target === 'T')?.attempts === 1, `targets=${JSON.stringify(targets)}`);

    // The trap: fail AGAIN with NO edit in between.
    ES.noteVerificationFailure(db, 'sess-cycle', ['T']);
    targets = ES.openTargets(db, 'sess-cycle');
    check('cycle: TRAP — re-run failing again with no edit between -> attempts STILL 1, no new cycle closed', targets.find((t) => t.target === 'T')?.attempts === 1, `targets=${JSON.stringify(targets)}`);

    // Now a real second cycle: edit, then fail again -> attempts=2.
    ES.noteEdit(db, 'sess-cycle', '/f.js');
    ES.noteVerificationFailure(db, 'sess-cycle', ['T']);
    targets = ES.openTargets(db, 'sess-cycle');
    check('cycle: a genuine second edit->failure closes a second cycle -> attempts=2', targets.find((t) => t.target === 'T')?.attempts === 2, `targets=${JSON.stringify(targets)}`);

    // Pass wipes it.
    ES.noteVerificationPass(db, 'sess-cycle', ['T']);
    targets = ES.openTargets(db, 'sess-cycle');
    check('cycle: verification pass deletes the target row', targets.find((t) => t.target === 'T') === undefined, `targets=${JSON.stringify(targets)}`);

    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — "three different failing tests are three first attempts": failures on T1,T2,T3
  // interleaved with edits never push any single target past 1 (§6.1's exact sentence).
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('three-targets.sqlite');
    const db = ES.openState(p);

    ES.noteVerificationFailure(db, 'sess-three', ['T1']);
    ES.noteEdit(db, 'sess-three', '/a.js');
    ES.noteVerificationFailure(db, 'sess-three', ['T2']); // T2 is brand new -> attempts=0, not 1,
    // even though an edit happened first — the edited flag only matters for a target that ALREADY
    // existed when the edit landed.
    ES.noteEdit(db, 'sess-three', '/b.js');
    ES.noteVerificationFailure(db, 'sess-three', ['T3']);

    const targets = ES.openTargets(db, 'sess-three');
    const byId = Object.fromEntries(targets.map((t) => [t.target, t]));
    check('three targets: T1 attempts=0 (first failure, no edit closed a cycle on it)', byId.T1?.attempts === 0, `targets=${JSON.stringify(targets)}`);
    check('three targets: T2 attempts=0 (new target, edit before it does not matter)', byId.T2?.attempts === 0, `targets=${JSON.stringify(targets)}`);
    check('three targets: T3 attempts=0 (new target)', byId.T3?.attempts === 0, `targets=${JSON.stringify(targets)}`);
    check('three targets: all three are tracked separately (3 rows)', targets.length === 3, `targets=${JSON.stringify(targets)}`);

    // Now close ONE cycle on T1 only, and confirm T2/T3 are untouched.
    ES.noteEdit(db, 'sess-three', '/c.js'); // edits ALL open targets, per noteEdit's contract
    ES.noteVerificationFailure(db, 'sess-three', ['T1']); // only T1 fails again -> only T1 bumps
    const targets2 = ES.openTargets(db, 'sess-three');
    const byId2 = Object.fromEntries(targets2.map((t) => [t.target, t]));
    check('three targets: only T1 (the one that failed again) bumped to attempts=1', byId2.T1?.attempts === 1, `targets=${JSON.stringify(targets2)}`);
    check('three targets: T2 stayed at attempts=0 (edited, but never re-verified/failed)', byId2.T2?.attempts === 0, `targets=${JSON.stringify(targets2)}`);
    check('three targets: T3 stayed at attempts=0 (edited, but never re-verified/failed)', byId2.T3?.attempts === 0, `targets=${JSON.stringify(targets2)}`);

    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — "another session's rows are invisible": seed under session A, query under B.
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('cross-session.sqlite');
    const db = ES.openState(p);

    ES.noteVerificationFailure(db, 'session-A', ['T-a']);
    ES.noteEdit(db, 'session-A', '/a.js');
    ES.noteVerificationFailure(db, 'session-A', ['T-a']);
    ES.recordEvent(db, { sessionId: 'session-A', kind: 'commit', detail: 'v1' });

    const targetsB = ES.openTargets(db, 'session-B');
    check('cross-session: openTargets() under session B is empty despite session A having rows', targetsB.length === 0, `targetsB=${JSON.stringify(targetsB)}`);

    const countB = ES.eventCountSince(db, 'session-B', 'commit', 0);
    check('cross-session: eventCountSince() under session B is 0 despite session A having a commit event', countB === 0, `countB=${countB}`);

    const lastB = ES.lastEvent(db, 'session-B', 'commit');
    check('cross-session: lastEvent() under session B is null', lastB === null, `lastB=${JSON.stringify(lastB)}`);

    // Sanity: session A itself DOES see its own data (proves the emptiness above is scoping, not
    // a broken store).
    const targetsA = ES.openTargets(db, 'session-A');
    check('cross-session: session A sees its own target (sanity check the store itself works)', targetsA.length === 1 && targetsA[0].attempts === 1, `targetsA=${JSON.stringify(targetsA)}`);
    const countA = ES.eventCountSince(db, 'session-A', 'commit', 0);
    check('cross-session: session A sees its own commit event (sanity check)', countA === 1, `countA=${countA}`);

    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — "TTL prune": insert a row with ts = now-25h (older than the 24h TTL), then
  // openState() again on the same path -> gone. Directly manipulates the DB via a raw INSERT
  // through the module's own opened handle (no private API needed — SQL is SQL) to backdate the
  // timestamp, since there is no public "insert with a fake ts" export (correctly — nothing
  // should be able to lie about when something happened, only tests reaching around that).
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('ttl.sqlite');
    let db = ES.openState(p);
    check('TTL: openState() returned a usable db', !!db);

    const staleTs = Date.now() - (25 * 60 * 60 * 1000); // 25h ago > 24h TTL
    db.prepare('INSERT INTO fix_targets (session_id, target, attempts, edited_since_failure, last_failure_ts) VALUES (?, ?, ?, ?, ?)')
      .run('sess-ttl', 'stale-target', 3, 0, staleTs);
    db.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
      .run('sess-ttl', 'commit', staleTs, null);

    // Also insert a FRESH row, to prove the prune is selective (age-based), not "wipe everything".
    ES.noteVerificationFailure(db, 'sess-ttl', ['fresh-target']);
    db.close();

    // Re-open the SAME path — this is the prune-on-open contract.
    db = ES.openState(p);
    check('TTL: re-opened db is usable', !!db);

    const targets = ES.openTargets(db, 'sess-ttl');
    check('TTL: the 25h-old target row is gone after re-open', targets.find((t) => t.target === 'stale-target') === undefined, `targets=${JSON.stringify(targets)}`);
    check('TTL: the fresh target row survived the prune', targets.find((t) => t.target === 'fresh-target') !== undefined, `targets=${JSON.stringify(targets)}`);

    const staleCount = ES.eventCountSince(db, 'sess-ttl', 'commit', 0);
    check('TTL: the 25h-old commit event is gone after re-open', staleCount === 0, `staleCount=${staleCount}`);

    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — "corrupt DB file -> openState returns null, no throw": write garbage bytes first.
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('corrupt.sqlite');
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, 'this is not a sqlite file, just garbage bytes 1234567890', 'utf8');

    let threw = false;
    let db;
    try {
      db = ES.openState(p);
    } catch {
      threw = true;
    }
    check('corrupt file: openState() did NOT throw', !threw);
    check('corrupt file: openState() returned null (fail-open, not a usable db)', db === null || db === undefined, `db=${db}`);
  }

  // -----------------------------------------------------------------------------------------
  // Additional fail-open proofs — every exported function given a null db must return its
  // documented fail-open value, never throw. This is what makes a rule built on this module safe
  // to call even when openState() already failed upstream.
  // -----------------------------------------------------------------------------------------
  {
    let threw = false;
    let results = {};
    try {
      results = {
        recordEvent: ES.recordEvent(null, { sessionId: 's', kind: 'edit' }),
        lastEvent: ES.lastEvent(null, 's', 'edit'),
        eventCountSince: ES.eventCountSince(null, 's', 'edit', 0),
        openTargets: ES.openTargets(null, 's'),
        noteVerificationFailure: ES.noteVerificationFailure(null, 's', ['T']),
        noteEdit: ES.noteEdit(null, 's', '/f.js'),
        noteVerificationPass: ES.noteVerificationPass(null, 's', ES.ALL),
      };
    } catch {
      threw = true;
    }
    check('null db: no function threw', !threw);
    check('null db: lastEvent -> null', results.lastEvent === null);
    check('null db: eventCountSince -> 0', results.eventCountSince === 0);
    check('null db: openTargets -> []', Array.isArray(results.openTargets) && results.openTargets.length === 0);
  }

  // -----------------------------------------------------------------------------------------
  // CONCURRENCY — multiple separate processes opening + writing to the SAME store file at
  // effectively the same instant must not throw and must not corrupt/lose the store (WAL +
  // busy_timeout, per the module header). N child processes launched together via async `spawn`
  // (not spawnSync in a loop, which would be sequential and prove nothing about contention), all
  // racing to open/write the same file, awaited together via Promise.all.
  // -----------------------------------------------------------------------------------------
  {
    const { spawn: spawnAsync } = await import('node:child_process');
    const p = freshStatePath('concurrent-real.sqlite');
    const moduleHref = pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href;
    const N = 8;

    function spawnChild(sessionId) {
      const script = `
        import * as ES from ${JSON.stringify(moduleHref)};
        const db = ES.openState();
        for (let j = 0; j < 20; j++) {
          ES.noteVerificationFailure(db, ${JSON.stringify(sessionId)}, ['T' + j]);
        }
        if (db) db.close();
        process.stdout.write(db ? 'ok' : 'no-db');
      `;
      return new Promise((resolve) => {
        const child = spawnAsync(process.execPath, ['--input-type=module', '-e', script], {
          env: { ...process.env, ENFORCEMENT_STATE_PATH: p },
          cwd: ROOT,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('close', (code) => resolve({ code, stdout, stderr }));
      });
    }

    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => spawnChild(`sess-concurrent-${i}`))
    );
    const elapsedMs = Date.now() - t0;

    const allExitedZero = results.every((r) => r.code === 0);
    check('concurrency: all N concurrent writer processes exited 0 (no crash under contention)', allExitedZero, `results=${JSON.stringify(results.map((r) => ({ code: r.code, stderr: r.stderr.slice(0, 300) })))}`);
    const allOk = results.every((r) => r.stdout.trim() === 'ok');
    check('concurrency: all N processes reported a usable db (openState never returned null under contention)', allOk, `stdouts=${JSON.stringify(results.map((r) => r.stdout))}`);
    console.log(`\nCONCURRENCY: ${N} concurrent writer processes vs one SQLite file — wall time ${elapsedMs}ms`);

    // Verify no data was lost/corrupted: every session's 20 targets should be present.
    const dbCheck = ES.openState(p);
    check('concurrency: post-race db still opens cleanly for verification', !!dbCheck);
    if (dbCheck) {
      let allSessionsComplete = true;
      const details = [];
      for (let i = 0; i < N; i++) {
        const t = ES.openTargets(dbCheck, `sess-concurrent-${i}`);
        details.push({ session: `sess-concurrent-${i}`, count: t.length });
        if (t.length !== 20) allSessionsComplete = false;
      }
      check('concurrency: every session\'s full 20-target write survived the race intact', allSessionsComplete, `details=${JSON.stringify(details)}`);
      dbCheck.close();
    }
  }

  // -----------------------------------------------------------------------------------------
  // COST — openState() + a prune + a few writes/reads, inside the 40-50ms hook budget. Measured
  // as pure in-process cost (no node-spawn overhead, since observers/rules call this as a library,
  // not as a subprocess) so it isolates the store's own contribution to that budget.
  // -----------------------------------------------------------------------------------------
  {
    const p = freshStatePath('cost.sqlite');
    // warm-up (file creation, schema creation) excluded from the measured samples.
    let db = ES.openState(p);
    ES.noteVerificationFailure(db, 'sess-cost', ['T']);
    db.close();

    const N = 20;
    const samples = [];
    for (let i = 0; i < N; i++) {
      const t0 = process.hrtime.bigint();
      const d = ES.openState(p); // includes prune-on-open
      ES.noteVerificationFailure(d, 'sess-cost', [`T${i}`]);
      ES.noteEdit(d, 'sess-cost', '/f.js');
      ES.openTargets(d, 'sess-cost');
      ES.lastEvent(d, 'sess-cost', 'edit');
      d.close();
      const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
      samples.push(elapsedMs);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    console.log(`\nENFORCEMENT-STATE IN-PROCESS COST (open+prune+write+edit+read+close, ${N} samples, sorted, ms): [${samples.map((s) => s.toFixed(2)).join(', ')}] — median ${median.toFixed(2)}ms`);
    check('cost: measured and printed above (informational — see task report)', true);
  }
}

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
