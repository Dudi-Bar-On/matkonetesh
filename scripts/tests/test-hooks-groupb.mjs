#!/usr/bin/env node
// scripts/tests/test-hooks-groupb.mjs — RED/GREEN proof for the PostToolUse entry point
// (scripts/hooks/posttooluse.mjs), section 1 of Group B (task-1-brief.md).
//
// This tests the RUNNER's own failure modes — a malformed payload, an observer that throws, an
// observer that returns nonsense — exactly like test-hooks-groupa.mjs did for the PreToolUse
// pipeline. PostToolUse here is an EAR, not a mouth: observers never return decisions, so there is
// no allow/warn/block lattice to prove, only "did every failure resolve to exit 0 + {} + a named
// log record, and did one broken observer fail to silence its siblings".
import { spawnSync, execFileSync } from 'node:child_process';
import {
  mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, readdirSync,
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

// =================================================================================================
// SECTION 3 — scripts/hooks/lib/verification-target.mjs + the two Task 3 observers
// (verification-outcomes.mjs, edit-tracker.mjs). task-3-brief.md. §6.1: "המפתח הוא הבדיקה
// שנכשלה, לא הקובץ שנערך" — the COUNTER-RED cases below are the point of this section.
// =================================================================================================
{
  const VT = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'verification-target.mjs')).href);

  // ---------------------------------------------------------------------------------------------
  // RED — classifyCommand: real verification invocations recognized, with the right runner.
  // ---------------------------------------------------------------------------------------------
  check('classify: npx playwright test -> verification/playwright',
    VT.classifyCommand('npx playwright test').isVerification === true
    && VT.classifyCommand('npx playwright test').runner === 'playwright');
  check('classify: npx playwright test <file> -> verification/playwright',
    VT.classifyCommand('npx playwright test tests/foo.spec.ts').isVerification === true
    && VT.classifyCommand('npx playwright test tests/foo.spec.ts').runner === 'playwright');
  check('classify: py -3 -m pytest <file> -> verification/pytest',
    VT.classifyCommand('py -3 -m pytest tests/probe.py').isVerification === true
    && VT.classifyCommand('py -3 -m pytest tests/probe.py').runner === 'pytest');
  check('classify: node scripts/tests/run-all.mjs -> verification/node-test',
    VT.classifyCommand('node scripts/tests/run-all.mjs').isVerification === true
    && VT.classifyCommand('node scripts/tests/run-all.mjs').runner === 'node-test');
  check('classify: node scripts/check-meta.mjs -> verification/node-test',
    VT.classifyCommand('node scripts/check-meta.mjs').isVerification === true
    && VT.classifyCommand('node scripts/check-meta.mjs').runner === 'node-test');
  check('classify: node scripts/tests/test-hooks-groupb.mjs -> verification/node-test',
    VT.classifyCommand('node scripts/tests/test-hooks-groupb.mjs').isVerification === true
    && VT.classifyCommand('node scripts/tests/test-hooks-groupb.mjs').runner === 'node-test');

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED — classifyCommand: everything else, including the Phase-3-bar lookalikes.
  // ---------------------------------------------------------------------------------------------
  check('COUNTER-RED classify: npm install -> not a verification', VT.classifyCommand('npm install').isVerification === false);
  check('COUNTER-RED classify: grep -q foo file -> not a verification', VT.classifyCommand('grep -q foo file').isVerification === false);
  check('COUNTER-RED classify: git commit -m "..." -> not a verification', VT.classifyCommand('git commit -m "fix"').isVerification === false);
  check('COUNTER-RED classify: python build.py -> not a verification', VT.classifyCommand('python build.py').isVerification === false);
  check('COUNTER-RED classify: curl -> not a verification', VT.classifyCommand('curl https://example.com').isVerification === false);
  check('COUNTER-RED classify: empty/non-string command -> not a verification, never throws',
    VT.classifyCommand('').isVerification === false && VT.classifyCommand(undefined).isVerification === false);

  // REAL captured output — this exact text was produced by a real `py -3 -m pytest` run against a
  // real two-test file in this repo on 2026-08-08 (one deliberately-failing, one passing) — not
  // invented from memory. See task-3-report.md for the unedited terminal capture.
  const REAL_PYTEST_FAILURE_OUTPUT = [
    '============================= test session starts =============================',
    'platform win32 -- Python 3.14.6, pytest-9.1.1, pluggy-1.6.0',
    'rootdir: C:\\Users\\dudib\\source\\repos\\matconetesh',
    'collected 2 items',
    '',
    'tests\\probe.py F.                                     [100%]',
    '',
    '================================== FAILURES ===================================',
    '_________________________________ test_delta __________________________________',
    '',
    '    def test_delta():',
    '>       assert 1 == 2',
    'E       assert 1 == 2',
    '',
    'tests\\probe.py:2: AssertionError',
    '=========================== short test summary info ===========================',
    'FAILED tests/probe.py::test_delta - assert 1 == 2',
    '========================= 1 failed, 1 passed in 0.08s =========================',
  ].join('\n');

  check('extract (pytest): the FAILED nodeid is extracted from real captured output',
    JSON.stringify(VT.extractFailingTargets('pytest', REAL_PYTEST_FAILURE_OUTPUT)) === JSON.stringify(['tests/probe.py::test_delta']));

  // REAL captured output — `npx playwright test` (list reporter) against a real two-test spec file
  // in this repo, both deliberately failing, printed NON-ascending ("✘  2 ...A" before "✘  1 ...B")
  // — captured 2026-08-08, not invented.
  const REAL_PW_FAILURE_OUTPUT = [
    'Running 2 tests using 2 workers',
    '',
    '  ✘  2 [chromium] › tests\\probe.spec.ts:3:5 › probe fail A @probe (169ms)',
    '  ✘  1 [chromium] › tests\\probe.spec.ts:8:5 › probe fail B @probe (157ms)',
    '',
    '',
    '  1) [chromium] › tests\\probe.spec.ts:3:5 › probe fail A @probe ──────────────────────',
    '  2 failed',
  ].join('\n');

  const pwTargets = VT.extractFailingTargets('playwright', REAL_PW_FAILURE_OUTPUT);
  check('extract (playwright): both failing tests extracted from real output, deduplicated', pwTargets.length === 2, `got=${JSON.stringify(pwTargets)}`);
  check('extract (playwright): target A has the real file:line:col › title shape',
    pwTargets.includes('tests\\probe.spec.ts:3:5 › probe fail A @probe'), `got=${JSON.stringify(pwTargets)}`);
  check('extract (playwright): target B has the real file:line:col › title shape',
    pwTargets.includes('tests\\probe.spec.ts:8:5 › probe fail B @probe'), `got=${JSON.stringify(pwTargets)}`);

  // REAL house convention (grep-confirmed across scripts/tests/*.mjs, and run live) — a test file's
  // own check() helper prints `FAIL  <label>` on stderr; run-all.mjs inherits this verbatim.
  const REAL_NODE_TEST_OUTPUT = [
    'FAIL  state: TTL prune — expected pruned, got present',
    'PASS  state: sanity check',
    '',
    '1/2 checks passed.',
  ].join('\n');
  check('extract (node-test): the FAIL label is extracted from real captured output',
    JSON.stringify(VT.extractFailingTargets('node-test', REAL_NODE_TEST_OUTPUT)) === JSON.stringify(['state: TTL prune — expected pruned, got present']));

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED — extractFailingTargets: a PASSING run's output (no ✘/FAILED lines) yields [].
  // This matters more than the RED cases: extraction must never manufacture a target out of
  // ordinary pass-summary text, even text that mentions a test's own title.
  // ---------------------------------------------------------------------------------------------
  const REAL_PW_PASS_OUTPUT = [
    'Running 1 test using 1 worker',
    '',
    '  ✓  1 [chromium] › tests\\probe.spec.ts:3:5 › probe fail A @probe (150ms)',
    '',
    '  1 passed (2.1s)',
  ].join('\n');
  check('COUNTER-RED extract (playwright): a passing run yields zero targets',
    VT.extractFailingTargets('playwright', REAL_PW_PASS_OUTPUT).length === 0);

  const REAL_PYTEST_PASS_OUTPUT = [
    'collected 2 items',
    'tests\\probe.py ..                                     [100%]',
    '========================= 2 passed in 0.05s =========================',
  ].join('\n');
  check('COUNTER-RED extract (pytest): a passing run yields zero targets',
    VT.extractFailingTargets('pytest', REAL_PYTEST_PASS_OUTPUT).length === 0);

  check('COUNTER-RED extract: unparseable/empty output yields [], never throws',
    VT.extractFailingTargets('pytest', '').length === 0
    && VT.extractFailingTargets('playwright', 'garbage nonsense text').length === 0
    && VT.extractFailingTargets('node-test', undefined).length === 0);

  // =================================================================================================
  // Observer integration — the REAL posttooluse.mjs runObservers() against the REAL observers
  // directory (now containing edit-tracker.mjs + verification-outcomes.mjs), against a temp
  // ENFORCEMENT_STATE_PATH so the real repo store (.superpowers/hooks-state/enforcement-state.sqlite)
  // is never touched by a test run.
  // =================================================================================================
  const { runObservers } = await import(POSTTOOLUSE_MODULE);
  const ES3 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const obsWork = tempDir('hooks-groupb-observers-');
  const statePath = join(obsWork, 'state.sqlite');
  const obsLogPath = join(obsWork, 'log.jsonl');
  process.env.ENFORCEMENT_STATE_PATH = statePath;

  function pytestFailurePayload(sessionId, command, outputText) {
    return {
      session_id: sessionId,
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command },
      error: `Exit code 1\n${outputText}`,
      is_interrupt: false,
    };
  }
  function bashPassPayload(sessionId, command, stdout) {
    return {
      session_id: sessionId,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command },
      tool_response: { stdout, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
    };
  }
  function editPayload(sessionId, filePath) {
    return {
      session_id: sessionId,
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: filePath },
      tool_response: {},
    };
  }

  // -----------------------------------------------------------------------------------------
  // RED — the exact §6.1 cycle, at the observer-integration level: failure -> edit -> failure
  // yields attempts=1 for exactly the one failing id.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-cycle';
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py', REAL_PYTEST_FAILURE_OUTPUT), { logPath: obsLogPath });
    let db = ES3.openState(statePath);
    let targets = ES3.openTargets(db, sid);
    check('integration: first failure -> target open, attempts=0',
      targets.length === 1 && targets[0].target === 'tests/probe.py::test_delta' && targets[0].attempts === 0, `targets=${JSON.stringify(targets)}`);
    db.close();

    await runObservers(editPayload(sid, join(ROOT, 'src', 'somewhere.py')), { logPath: obsLogPath });
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py', REAL_PYTEST_FAILURE_OUTPUT), { logPath: obsLogPath });
    db = ES3.openState(statePath);
    targets = ES3.openTargets(db, sid);
    check('integration: failure->edit->failure closes ONE cycle, attempts=1', targets.length === 1 && targets[0].attempts === 1, `targets=${JSON.stringify(targets)}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — §6.1's exact sentence: three DIFFERENT failing tests are three FIRST attempts, never a
  // third attempt on one target.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-three';
    const out1 = REAL_PYTEST_FAILURE_OUTPUT;
    const out2 = REAL_PYTEST_FAILURE_OUTPUT.replace(/test_delta/g, 'test_echo');
    const out3 = REAL_PYTEST_FAILURE_OUTPUT.replace(/test_delta/g, 'test_foxtrot');
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py::test_delta', out1), { logPath: obsLogPath });
    await runObservers(editPayload(sid, join(ROOT, 'a.py')), { logPath: obsLogPath });
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py::test_echo', out2), { logPath: obsLogPath });
    await runObservers(editPayload(sid, join(ROOT, 'b.py')), { logPath: obsLogPath });
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py::test_foxtrot', out3), { logPath: obsLogPath });

    const db = ES3.openState(statePath);
    const targets = ES3.openTargets(db, sid);
    check('integration: three different failing tests -> three rows, each attempts=0',
      targets.length === 3 && targets.every((t) => t.attempts === 0), `targets=${JSON.stringify(targets)}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — a suite-wide pass (no filter in the command) wipes every open target for the session.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-wipe-all';
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest', REAL_PYTEST_FAILURE_OUTPUT), { logPath: obsLogPath });
    let db = ES3.openState(statePath);
    check('integration: seeded a failing target before the wipe-all test', ES3.openTargets(db, sid).length === 1);
    db.close();

    await runObservers(bashPassPayload(sid, 'py -3 -m pytest', 'collected... 2 passed'), { logPath: obsLogPath });
    db = ES3.openState(statePath);
    check('integration: suite-wide pass (bare pytest, no filter) wipes the open target',
      ES3.openTargets(db, sid).length === 0, `targets=${JSON.stringify(ES3.openTargets(db, sid))}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — a FILTERED pass wipes only the matching target, leaving an unrelated open target intact.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-filtered';
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py::test_delta', REAL_PYTEST_FAILURE_OUTPUT), { logPath: obsLogPath });
    await runObservers(pytestFailurePayload(
      sid, 'py -3 -m pytest tests/other.py::test_zulu',
      REAL_PYTEST_FAILURE_OUTPUT.replace(/test_delta/g, 'test_zulu').replace(/probe\.py/g, 'other.py'),
    ), { logPath: obsLogPath });
    let db = ES3.openState(statePath);
    check('integration: two DIFFERENT targets seeded before the filtered-pass test', ES3.openTargets(db, sid).length === 2, `targets=${JSON.stringify(ES3.openTargets(db, sid))}`);
    db.close();

    await runObservers(bashPassPayload(sid, 'py -3 -m pytest tests/probe.py::test_delta', 'collected... 1 passed'), { logPath: obsLogPath });
    db = ES3.openState(statePath);
    const remaining = ES3.openTargets(db, sid);
    check('integration: filtered pass wipes ONLY the named target', remaining.length === 1 && remaining[0].target === 'tests/other.py::test_zulu', `remaining=${JSON.stringify(remaining)}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — an unattributed failure (unparseable output — a crash with no FAILED line)
  // increments the session failure count but openTargets() stays empty: an unattributed failure
  // must never be able to block an edit.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-unattributed';
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest', 'a segfault or crash with no FAILED line at all'), { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    check('COUNTER-RED integration: unparseable failure -> openTargets stays empty', ES3.openTargets(db, sid).length === 0, `targets=${JSON.stringify(ES3.openTargets(db, sid))}`);
    const count = ES3.eventCountSince(db, sid, 'verification_failure', 0);
    check('COUNTER-RED integration: unparseable failure IS counted at the session level', count === 1, `count=${count}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — owner ruling Q2: `grep -q foo file` exit 1 must NOT record a bash_failure event.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-grep';
    await runObservers({
      session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash',
      tool_input: { command: 'grep -q nothing somefile.txt' }, error: 'Exit code 1', is_interrupt: false,
    }, { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    const count = ES3.eventCountSince(db, sid, 'bash_failure', 0);
    check('COUNTER-RED integration: grep -q exit 1 -> zero bash_failure events recorded', count === 0, `count=${count}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — a real (non-exempt) tool's nonzero exit DOES record bash_failure.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-npmfail';
    await runObservers({
      session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash',
      tool_input: { command: 'npm install' }, error: 'Exit code 1\nnpm ERR! something broke', is_interrupt: false,
    }, { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    const count = ES3.eventCountSince(db, sid, 'bash_failure', 0);
    check('integration: npm install exit 1 -> a bash_failure event IS recorded', count === 1, `count=${count}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — git commit success -> a commit event. COUNTER-RED — a commit whose MESSAGE mentions
  // "pytest"/verification-shaped words is never misread as a verification run.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-commit';
    await runObservers(bashPassPayload(sid, 'git commit -m "run git commit later, also pytest mention"', ''), { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    const count = ES3.eventCountSince(db, sid, 'commit', 0);
    check('integration: git commit success -> a commit event is recorded', count === 1, `count=${count}`);
    const vf = ES3.eventCountSince(db, sid, 'verification_failure', 0);
    check('COUNTER-RED integration: git commit is never misread as a verification run', vf === 0);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — an edit with NO preceding failure must not count (noteEdit is a no-op on
  // fix_targets when there is nothing open — the edit event itself is still recorded elsewhere).
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-loneedit';
    await runObservers(editPayload(sid, join(ROOT, 'lonely.py')), { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    check('COUNTER-RED integration: an edit with no preceding failure leaves openTargets empty', ES3.openTargets(db, sid).length === 0);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // RED — edit-tracker: an edit to a UI-basename file (app.js/app.css/index.html) also records a
  // ui_edit event (feeds Task 10).
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-uiedit';
    await runObservers(editPayload(sid, join(ROOT, 'app.js')), { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    const count = ES3.eventCountSince(db, sid, 'ui_edit', 0);
    check('integration: an edit to app.js records a ui_edit event', count === 1, `count=${count}`);
    db.close();
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — a FAILED Edit/Write call (the tool itself errored) does not count as a real
  // edit: re-failing the same target with no SUCCESSFUL edit in between must not close a cycle.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-int-failed-edit';
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py', REAL_PYTEST_FAILURE_OUTPUT), { logPath: obsLogPath });
    await runObservers({
      session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Edit',
      tool_input: { file_path: join(ROOT, 'x.py') }, error: 'Exit code 1\nold_string not found', is_interrupt: false,
    }, { logPath: obsLogPath });
    await runObservers(pytestFailurePayload(sid, 'py -3 -m pytest tests/probe.py', REAL_PYTEST_FAILURE_OUTPUT), { logPath: obsLogPath });
    const db = ES3.openState(statePath);
    const targets = ES3.openTargets(db, sid);
    check('COUNTER-RED integration: a FAILED edit does not arm the next cycle (attempts stays 0)',
      targets.length === 1 && targets[0].attempts === 0, `targets=${JSON.stringify(targets)}`);
    db.close();
  }

  delete process.env.ENFORCEMENT_STATE_PATH;
}

// =================================================================================================
// SECTION 4 — scripts/hooks/rules/fix-cycle-limit.mjs (task-4-brief.md). §5's 3-fix rule, promoted
// from advice to a PreToolUse Edit|Write block. Every case here runs against a TEMP
// ENFORCEMENT_STATE_PATH and (where relevant) a TEMP DISCIPLINE doc — never the real repo store or
// the real discipline.md — per the brief's own warning: this rule is wired into Edit|Write, which
// means it runs on THIS TEST'S OWN edits too if state is not isolated.
// =================================================================================================
{
  const RULE = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'fix-cycle-limit.mjs')).href);
  const ES4 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const s4Work = tempDir('hooks-groupb-fixcycle-');

  // Drives a target to a given attempts count via the real cycle semantics (fail, [edit, fail]*N),
  // exactly like a real session would, rather than poking the SQL table directly.
  function driveToAttempts(db, sessionId, target, attempts) {
    ES4.noteVerificationFailure(db, sessionId, [target]);
    for (let i = 0; i < attempts; i++) {
      ES4.noteEdit(db, sessionId, '/some/file.js');
      ES4.noteVerificationFailure(db, sessionId, [target]);
    }
  }

  // Seeds a fresh temp store (via `seedFn(db)`) AND runs `evalFn()` — e.g. RULE.evaluate(...) —
  // while ENFORCEMENT_STATE_PATH still points at that SAME store, since RULE.evaluate() calls the
  // real openState() with no argument (reading the env var at call time, per the module's own
  // contract). The env var is restored to whatever it was before, but only AFTER evalFn() has run —
  // restoring it between seeding and evaluating would make the rule see a different (or the real)
  // store than the one just seeded. Returns evalFn()'s result.
  function withState(seedFn, evalFn = () => undefined) {
    const p = join(s4Work, `state-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      const db = ES4.openState(p);
      seedFn(db, p);
      db.close();
      return evalFn(p);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED (Bash passthrough) — first, since it must be true regardless of state.
  // -----------------------------------------------------------------------------------------
  {
    const out = RULE.evaluate({ tool_name: 'Bash', session_id: 'S', tool_input: { command: 'echo hi' } });
    check('fix-cycle: Bash passes through untouched', out.decision === 'allow' && out.reason === 'not an Edit/Write', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // RED — seeded session S, target at attempts=3 -> Edit is BLOCKED, reason names §5, the target,
  // the number 3, the alternative, and §5's provenance.
  // -----------------------------------------------------------------------------------------
  {
    const out = withState(
      (db) => driveToAttempts(db, 'S', 'tests/test_x.py::test_y', 3),
      () => RULE.evaluate({ tool_name: 'Edit', session_id: 'S', tool_input: { file_path: 'C:/repo/model.py' } }),
    );
    check('RED fix-cycle: attempts=3 -> Edit is BLOCKED', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED fix-cycle: reason names §5', out.reason.includes('§5'), `reason=${out.reason}`);
    check('RED fix-cycle: reason names the target', out.reason.includes('tests/test_x.py::test_y'), `reason=${out.reason}`);
    check('RED fix-cycle: reason names the number 3', out.reason.includes('3'), `reason=${out.reason}`);
    check('RED fix-cycle: reason names the alternative (raise the architecture question with the owner)',
      out.reason.toLowerCase().includes('raise the architecture question with the owner'), `reason=${out.reason}`);
    check('RED fix-cycle: reason quotes §5\'s provenance (written after a real failure)',
      out.reason.toLowerCase().includes('real failure') || out.reason.toLowerCase().includes('guessed fixes'), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------
  // RED-2 (regression pair, DoD-7 discipline) — same shape, attempts=2 -> allow (not yet cycle 4).
  // -----------------------------------------------------------------------------------------
  {
    const out = withState(
      (db) => driveToAttempts(db, 'S', 'tests/test_x.py::test_y', 2),
      () => RULE.evaluate({ tool_name: 'Edit', session_id: 'S', tool_input: { file_path: 'C:/repo/model.py' } }),
    );
    check('RED-2 fix-cycle: attempts=2 -> allow (not yet the 4th cycle)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — a DIFFERENT session id with attempts=3 on the SAME target -> allow (session
  // scoping, not global).
  // -----------------------------------------------------------------------------------------
  {
    const out = withState(
      (db) => driveToAttempts(db, 'session-A', 'tests/test_x.py::test_y', 3),
      () => RULE.evaluate({ tool_name: 'Edit', session_id: 'session-B', tool_input: { file_path: 'x.js' } }),
    );
    check('COUNTER-RED fix-cycle: different session id, same target at attempts=3 -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — no open targets at all -> allow.
  // -----------------------------------------------------------------------------------------
  {
    const out = withState(
      () => { /* no writes — empty store */ },
      () => RULE.evaluate({ tool_name: 'Write', session_id: 'sess-empty', tool_input: { file_path: 'x.js' } }),
    );
    check('COUNTER-RED fix-cycle: no open targets -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — state DB unreadable (garbage bytes at the state path) -> allow, with the
  // degradation named in the reason. A blocking rule that cannot read its own state must never
  // block.
  // -----------------------------------------------------------------------------------------
  {
    const garbagePath = join(s4Work, 'garbage.sqlite');
    mkdirSync(dirname(garbagePath), { recursive: true });
    writeFileSync(garbagePath, 'not a sqlite file, just garbage bytes 1234567890', 'utf8');
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = garbagePath;
    let out;
    try {
      out = RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-garbage', tool_input: { file_path: 'x.js' } });
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
    check('COUNTER-RED fix-cycle: corrupt state file -> allow (never throws, never blocks)', out && out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('COUNTER-RED fix-cycle: reason names the degradation', /unreadable|degrad/i.test(out?.reason || ''), `reason=${out?.reason}`);
  }

  // -----------------------------------------------------------------------------------------
  // Strictly-sequential replay (Phase 3's most expensive lesson, replayed on purpose): failure(T)
  // -> edit -> pass(T), six times over, in ONE session/store. Every edit allowed at every step;
  // attempts never exceed 1 (a pass wipes the row before the next failure can build on it).
  // -----------------------------------------------------------------------------------------
  {
    withState((db) => {
      const sid = 'sess-sequential';
      const target = 'tests/seq.py::test_seq';
      for (let round = 0; round < 6; round++) {
        ES4.noteVerificationFailure(db, sid, [target]);
        const preEditTargets = ES4.openTargets(db, sid);
        check(`sequential round ${round + 1}: attempts never exceed 1 before the edit`,
          (preEditTargets.find((t) => t.target === target)?.attempts ?? 0) <= 1,
          `targets=${JSON.stringify(preEditTargets)}`);

        const outBefore = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: '/f.js' } });
        check(`sequential round ${round + 1}: edit allowed`, outBefore.decision === 'allow', `out=${JSON.stringify(outBefore)}`);

        ES4.noteEdit(db, sid, '/f.js');
        ES4.noteVerificationPass(db, sid, [target]);
        const postPassTargets = ES4.openTargets(db, sid);
        check(`sequential round ${round + 1}: pass wipes the target`,
          postPassTargets.find((t) => t.target === target) === undefined, `targets=${JSON.stringify(postPassTargets)}`);
      }
    });
  }

  // -----------------------------------------------------------------------------------------
  // RESET PATH — a documented Owner architecture decision record naming the EXACT blocked target
  // clears it, even though attempts is still 3 in the store (the store is untouched by the reset —
  // the record is read live, not written back into fix_targets).
  // -----------------------------------------------------------------------------------------
  const todayUtc = new Date().toISOString().slice(0, 10);

  {
    const docPath = join(s4Work, 'discipline-owner-decision.md');
    const target = 'tests/test_owner.py::test_reset';
    writeFileSync(docPath, [
      '## 11. Lessons log',
      '',
      `**Owner architecture decision (${todayUtc}):** ${target} — the owner reviewed the repeated `
        + 'failure and approved a schema change; the counter is reset for this target.',
      '',
    ].join('\n'), 'utf8');

    // Both env vars (ENFORCEMENT_STATE_PATH and DISCIPLINE) must still be set when RULE.evaluate()
    // itself runs — nested here, inside withState()'s evalFn, for the same reason withState's own
    // header comment explains for the state path alone.
    const out = withState(
      (db) => driveToAttempts(db, 'sess-owner-reset', target, 3),
      () => {
        const prevDoc = process.env.DISCIPLINE;
        process.env.DISCIPLINE = docPath;
        try {
          return RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-owner-reset', tool_input: { file_path: 'x.js' } });
        } finally {
          if (prevDoc === undefined) delete process.env.DISCIPLINE;
          else process.env.DISCIPLINE = prevDoc;
        }
      },
    );
    check('RESET fix-cycle: an Owner architecture decision naming the exact target -> allow even at attempts=3',
      out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — an Owner architecture decision naming a DIFFERENT target does NOT clear this one.
  // -----------------------------------------------------------------------------------------
  {
    const docPath = join(s4Work, 'discipline-owner-decision-other.md');
    const blockedTarget = 'tests/test_x.py::test_y';
    writeFileSync(docPath, [
      '## 11. Lessons log',
      '',
      `**Owner architecture decision (${todayUtc}):** tests/some_other.py::test_unrelated — unrelated decision.`,
      '',
    ].join('\n'), 'utf8');

    const out = withState(
      (db) => driveToAttempts(db, 'sess-owner-noreset', blockedTarget, 3),
      () => {
        const prevDoc = process.env.DISCIPLINE;
        process.env.DISCIPLINE = docPath;
        try {
          return RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-owner-noreset', tool_input: { file_path: 'x.js' } });
        } finally {
          if (prevDoc === undefined) delete process.env.DISCIPLINE;
          else process.env.DISCIPLINE = prevDoc;
        }
      },
    );
    check('COUNTER-RED fix-cycle: an Owner architecture decision naming a DIFFERENT target still blocks this one',
      out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('COUNTER-RED fix-cycle: an UNRELATED (not near-miss) record does not trigger a near-miss note',
      !out.reason.includes('Note: a record exists for'), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------
  // FIX ROUND 1 — RED: a record is a POINT-IN-TIME reset, not a permanent exemption. An exact-name
  // record dated D, when a failure was recorded AFTER D (simulated here via a direct last_failure_ts
  // overwrite, mirroring the TTL test's own pattern for backdating), does NOT clear the target — the
  // decision is stale relative to that later failure, and the reason names the staleness.
  // -----------------------------------------------------------------------------------------
  {
    const target = 'tests/test_owner.py::test_stale';
    const docPath = join(s4Work, 'discipline-owner-decision-stale.md');
    writeFileSync(docPath, [
      '## 11. Lessons log',
      '',
      `**Owner architecture decision (${todayUtc}):** ${target} — an architecture decision was made, `
        + 'but the target failed again afterward.',
      '',
    ].join('\n'), 'utf8');

    const futureTs = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days from now — after any same-day cutoff

    const out = withState(
      (db) => {
        driveToAttempts(db, 'sess-owner-stale', target, 3);
        db.prepare('UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND target = ?')
          .run(futureTs, 'sess-owner-stale', target);
      },
      () => {
        const prevDoc = process.env.DISCIPLINE;
        process.env.DISCIPLINE = docPath;
        try {
          return RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-owner-stale', tool_input: { file_path: 'x.js' } });
        } finally {
          if (prevDoc === undefined) delete process.env.DISCIPLINE;
          else process.env.DISCIPLINE = prevDoc;
        }
      },
    );
    check('RED fix-cycle (point-in-time): a failure recorded AFTER the decision date -> still BLOCKED',
      out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED fix-cycle (point-in-time): reason names the staleness (a record exists but does not cover this failure)',
      out.reason.includes('does not cover') || out.reason.toLowerCase().includes('recorded after it') || out.reason.toLowerCase().includes('after it)'),
      `reason=${out.reason}`);
    check('RED fix-cycle (point-in-time): reason tells the reader to write a FRESH record',
      out.reason.toLowerCase().includes('fresh record'), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — the mirror of the above: a record dated/timed AFTER the last failure DOES clear
  // it. (Already covered by the "RESET fix-cycle" case above using same-day defaults; this second
  // proof pins an explicit past reference instant so the ordering is unambiguous regardless of the
  // real wall clock at test-run time.)
  // -----------------------------------------------------------------------------------------
  {
    const target = 'tests/test_owner.py::test_reset_precise';
    const docPath = join(s4Work, 'discipline-owner-decision-precise-clear.md');
    const failureInstant = Date.parse('2026-08-08T10:00:00Z');
    const decisionInstant = '2026-08-08 10:05'; // 5 minutes AFTER the failure, same day, finer form
    writeFileSync(docPath, [
      '## 11. Lessons log',
      '',
      `**Owner architecture decision (${decisionInstant}):** ${target} — precise same-day reset.`,
      '',
    ].join('\n'), 'utf8');

    const out = withState(
      (db) => {
        driveToAttempts(db, 'sess-owner-precise-clear', target, 3);
        db.prepare('UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND target = ?')
          .run(failureInstant, 'sess-owner-precise-clear', target);
      },
      () => {
        const prevDoc = process.env.DISCIPLINE;
        process.env.DISCIPLINE = docPath;
        try {
          return RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-owner-precise-clear', tool_input: { file_path: 'x.js' } });
        } finally {
          if (prevDoc === undefined) delete process.env.DISCIPLINE;
          else process.env.DISCIPLINE = prevDoc;
        }
      },
    );
    check('COUNTER-RED fix-cycle (point-in-time, finer form): a decision timed 5min AFTER the last failure -> allow',
      out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // RED — the finer form also correctly stays a HARD cutoff: a failure recorded a few minutes AFTER
  // a precisely-timed decision, on the SAME calendar day, is NOT covered (this is exactly the
  // same-day precision a date-only record cannot express).
  // -----------------------------------------------------------------------------------------
  {
    const target = 'tests/test_owner.py::test_stale_precise';
    const docPath = join(s4Work, 'discipline-owner-decision-precise-stale.md');
    const decisionInstant = '2026-08-08 10:00';
    const failureInstant = Date.parse('2026-08-08T10:10:00Z'); // 10 minutes AFTER the decision, same day

    writeFileSync(docPath, [
      '## 11. Lessons log',
      '',
      `**Owner architecture decision (${decisionInstant}):** ${target} — precise same-day decision.`,
      '',
    ].join('\n'), 'utf8');

    const out = withState(
      (db) => {
        driveToAttempts(db, 'sess-owner-precise-stale', target, 3);
        db.prepare('UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND target = ?')
          .run(failureInstant, 'sess-owner-precise-stale', target);
      },
      () => {
        const prevDoc = process.env.DISCIPLINE;
        process.env.DISCIPLINE = docPath;
        try {
          return RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-owner-precise-stale', tool_input: { file_path: 'x.js' } });
        } finally {
          if (prevDoc === undefined) delete process.env.DISCIPLINE;
          else process.env.DISCIPLINE = prevDoc;
        }
      },
    );
    check('RED fix-cycle (point-in-time, finer form): a same-day failure 10min AFTER a precisely-timed decision -> still BLOCKED',
      out.decision === 'block', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------
  // RED — near-miss target name: a record exists for a target one character different from the
  // blocked one. Exact match fails (correctly — no silent fuzzy clearing), but the deny reason
  // names the near-miss record explicitly so a typo is a two-second fix, not a bewildering wall.
  // -----------------------------------------------------------------------------------------
  {
    const blockedTarget = 'tests/test_owner.py::test_typo';
    const recordedTarget = 'tests/test_owner.py::test_typo0'; // one extra character — small edit distance
    const docPath = join(s4Work, 'discipline-owner-decision-nearmiss.md');
    writeFileSync(docPath, [
      '## 11. Lessons log',
      '',
      `**Owner architecture decision (${todayUtc}):** ${recordedTarget} — decision for the WRONG (typo'd) target string.`,
      '',
    ].join('\n'), 'utf8');

    const out = withState(
      (db) => driveToAttempts(db, 'sess-owner-nearmiss', blockedTarget, 3),
      () => {
        const prevDoc = process.env.DISCIPLINE;
        process.env.DISCIPLINE = docPath;
        try {
          return RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-owner-nearmiss', tool_input: { file_path: 'x.js' } });
        } finally {
          if (prevDoc === undefined) delete process.env.DISCIPLINE;
          else process.env.DISCIPLINE = prevDoc;
        }
      },
    );
    check('RED fix-cycle (near-miss): a typo\'d record does NOT clear the real target -> still BLOCKED',
      out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED fix-cycle (near-miss): reason names the near-miss record\'s target text',
      out.reason.includes(recordedTarget), `reason=${out.reason}`);
    check('RED fix-cycle (near-miss): reason names the actually-blocked target text too',
      out.reason.includes(blockedTarget), `reason=${out.reason}`);
    check('RED fix-cycle (near-miss): reason flags it as a mismatch/typo, not a generic block',
      out.reason.toLowerCase().includes('mismatch') || out.reason.toLowerCase().includes('typo'), `reason=${out.reason}`);
  }

  // ===========================================================================================
  // FIX ROUND 2 (coordinator review, 2026-08-08) — the coordinator's own reproduction proved round
  // 1's "reset" was still a permanent-until-comparison-fails exemption: a target cleared by a
  // same-day date-only record kept clearing every SUBSEQUENT same-day failure too, because a bare
  // date cannot order same-day events. The fix makes the reset LITERAL: the first time a record
  // validly clears a target, the rule WIPES that target's row (same action a real verification pass
  // takes) — so the counter genuinely restarts at zero, and reaching the ceiling again needs 3
  // GENUINELY NEW cycles, independent of same-day granularity. These tests replay the coordinator's
  // own exact reproduction sequence.
  // ===========================================================================================

  // -------------------------------------------------------------------------------------------
  // RED — the coordinator's literal date-only sequence: 4 cycles -> block; record dated in the
  // past (2020-01-01) -> still block (stale, unchanged from round 1); record dated TODAY
  // (date-only) -> allow AND the row is wiped; FOUR MORE cycles recorded strictly after that ->
  // must BLOCK AGAIN, because the counter restarted at zero, not because of any date comparison.
  // -------------------------------------------------------------------------------------------
  {
    const target = 'tests/t.py::test_coordinator_dateonly';
    const docPath = join(s4Work, 'discipline-owner-decision-round2-dateonly.md');
    const sid = 'sess-round2-dateonly';
    // A single SHARED store path for this whole multi-step scenario — withState()'s per-call fresh
    // path doesn't fit here, since each step must see the PREVIOUS step's state.
    const p2 = join(s4Work, 'round2-dateonly-shared.sqlite');
    process.env.ENFORCEMENT_STATE_PATH = p2;

    {
      const db = ES4.openState(p2);
      driveToAttempts(db, sid, target, 3);
      db.close();
    }
    const out1 = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('ROUND2 fix-cycle (date-only replay): step 1 — 4 cycles, no record -> BLOCK', out1.decision === 'block', `out=${JSON.stringify(out1)}`);

    writeFileSync(docPath, `## 11\n\n**Owner architecture decision (2020-01-01):** ${target} — old, irrelevant decision.\n`, 'utf8');
    process.env.DISCIPLINE = docPath;
    const outStale = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('ROUND2 fix-cycle (date-only replay): step 2 — record dated 2020-01-01 -> still BLOCK (stale)', outStale.decision === 'block', `out=${JSON.stringify(outStale)}`);

    const todayUtc2 = new Date().toISOString().slice(0, 10);
    writeFileSync(docPath, `## 11\n\n**Owner architecture decision (${todayUtc2}):** ${target} — reset today.\n`, 'utf8');
    const outCleared = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('ROUND2 fix-cycle (date-only replay): step 3 — record dated today (date-only) -> ALLOW', outCleared.decision === 'allow', `out=${JSON.stringify(outCleared)}`);
    check('ROUND2 fix-cycle (date-only replay): step 3 — reason names the reset-to-zero', outCleared.reason.toLowerCase().includes('reset') || outCleared.reason.toLowerCase().includes('fresh'), `reason=${outCleared.reason}`);

    {
      const db = ES4.openState(p2);
      const rowsNow = ES4.openTargets(db, sid);
      db.close();
      check('ROUND2 fix-cycle (date-only replay): the wipe actually happened — target row is GONE from the store', rowsNow.find((r) => r.target === target) === undefined, `rows=${JSON.stringify(rowsNow)}`);
    }

    {
      const db = ES4.openState(p2);
      for (let i = 0; i < 4; i++) {
        ES4.noteEdit(db, sid, '/f.js');
        ES4.noteVerificationFailure(db, sid, [target]);
      }
      db.close();
    }
    const outReblocked = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('ROUND2 fix-cycle (date-only replay): step 4 — FOUR MORE cycles recorded AFTER the SAME-DAY record -> BLOCK AGAIN (this is the exact defect the coordinator found)',
      outReblocked.decision === 'block', `out=${JSON.stringify(outReblocked)}`);

    delete process.env.ENFORCEMENT_STATE_PATH;
    delete process.env.DISCIPLINE;
  }

  // -------------------------------------------------------------------------------------------
  // COUNTER-RED — the mirror using the finer (minute-precision) form: same sequence, proving the
  // wipe-based reset works for the finer form too (not just date-only), with fully controlled,
  // unambiguous UTC instants (no reliance on real wall-clock delays between steps).
  // -------------------------------------------------------------------------------------------
  {
    const target = 'tests/t.py::test_coordinator_precise';
    const sid = 'sess-round2-precise';
    const docPath = join(s4Work, 'discipline-owner-decision-round2-precise.md');
    const p3 = join(s4Work, 'round2-precise-shared.sqlite');

    const NOW = Date.now();
    const T_MINUS_10MIN = NOW - 10 * 60_000; // original failures happened here
    const T_MINUS_5MIN = NOW - 5 * 60_000;   // decision recorded here — AFTER the original failures

    process.env.ENFORCEMENT_STATE_PATH = p3;
    {
      const db = ES4.openState(p3);
      driveToAttempts(db, sid, target, 3);
      db.prepare('UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND target = ?').run(T_MINUS_10MIN, sid, target);
      db.close();
    }

    const recordInstant = new Date(T_MINUS_5MIN).toISOString().slice(0, 16).replace('T', ' ');
    writeFileSync(docPath, `## 11\n\n**Owner architecture decision (${recordInstant}):** ${target} — precise reset 5 minutes after the failures.\n`, 'utf8');
    process.env.DISCIPLINE = docPath;

    const outCleared = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('COUNTER-RED fix-cycle (minute-precision replay): record 5min after the failures -> ALLOW', outCleared.decision === 'allow', `out=${JSON.stringify(outCleared)}`);

    {
      const db = ES4.openState(p3);
      const rowsNow = ES4.openTargets(db, sid);
      db.close();
      check('COUNTER-RED fix-cycle (minute-precision replay): the wipe happened for the finer form too', rowsNow.find((r) => r.target === target) === undefined, `rows=${JSON.stringify(rowsNow)}`);
    }

    {
      const db = ES4.openState(p3);
      for (let i = 0; i < 4; i++) {
        ES4.noteEdit(db, sid, '/f.js');
        ES4.noteVerificationFailure(db, sid, [target]);
      }
      db.close();
    }
    const outReblocked = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('COUNTER-RED fix-cycle (minute-precision replay): FOUR MORE cycles after the precise record -> BLOCK AGAIN', outReblocked.decision === 'block', `out=${JSON.stringify(outReblocked)}`);

    delete process.env.ENFORCEMENT_STATE_PATH;
    delete process.env.DISCIPLINE;
  }

  // -------------------------------------------------------------------------------------------
  // RED — UTC is now stated EXPLICITLY in the deny reason's own instructions (fix round 2, second
  // finding): the finer-form instruction must say "UTC", and the stale-record note must say "UTC"
  // too, so writing a timestamp in the wrong zone is never a silent, unexplained no-op.
  // -------------------------------------------------------------------------------------------
  {
    const out = withState(
      (db) => driveToAttempts(db, 'sess-utc-doc', 'tests/t.py::test_utc_doc', 3),
      () => RULE.evaluate({ tool_name: 'Edit', session_id: 'sess-utc-doc', tool_input: { file_path: 'x.js' } }),
    );
    check('RED fix-cycle (UTC documentation): the base deny reason states the finer form is read as UTC, not local time',
      out.reason.includes('UTC') && out.reason.toLowerCase().includes('not local time'), `reason=${out.reason}`);
  }

  // -------------------------------------------------------------------------------------------
  // RED — the stale-record note also states UTC explicitly (the exact scenario that cost the
  // reviewer a wrong conclusion: a stale record's "last failure at" timestamp must be unambiguous).
  // -------------------------------------------------------------------------------------------
  {
    const target = 'tests/t.py::test_utc_stale';
    const sid = 'sess-utc-stale';
    const docPath = join(s4Work, 'discipline-owner-decision-utc-stale.md');
    const p4 = join(s4Work, 'utc-stale.sqlite');
    process.env.ENFORCEMENT_STATE_PATH = p4;
    {
      const db = ES4.openState(p4);
      driveToAttempts(db, sid, target, 3);
      db.prepare('UPDATE fix_targets SET last_failure_ts = ? WHERE session_id = ? AND target = ?')
        .run(Date.now() + 2 * 24 * 60 * 60 * 1000, sid, target);
      db.close();
    }
    writeFileSync(docPath, `## 11\n\n**Owner architecture decision (${new Date().toISOString().slice(0, 10)}):** ${target} — stale relative to a later failure.\n`, 'utf8');
    process.env.DISCIPLINE = docPath;
    const out = RULE.evaluate({ tool_name: 'Edit', session_id: sid, tool_input: { file_path: 'x.js' } });
    check('RED fix-cycle (UTC documentation, stale note): the stale-record note states the last-failure timestamp is UTC',
      out.decision === 'block' && out.reason.includes('UTC'), `reason=${out.reason}`);
    delete process.env.ENFORCEMENT_STATE_PATH;
    delete process.env.DISCIPLINE;
  }
}

// =================================================================================================
// SECTION 6 — scripts/hooks/rules/lessons-before-commit.mjs + scripts/gate-lessons.mjs's exported
// sessionLessonGate (task-6-brief.md, spec §6.3). Every case runs against a TEMP
// ENFORCEMENT_STATE_PATH and (for rule-level cases needing real diff evidence) a disposable temp git
// repo pointed to via LESSONS_GATE_GIT_CWD/DISCIPLINE — never the real repo state or the real
// discipline.md, exactly like Section 4's own warning: this rule is wired into Bash `git commit`,
// which means it would run on THIS TEST'S OWN commits too if state/evidence were not isolated.
// =================================================================================================
{
  const GL = await import(pathToFileURL(join(ROOT, 'scripts', 'gate-lessons.mjs')).href);
  const RULE6 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'lessons-before-commit.mjs')).href);
  const ES6 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const s6Work = tempDir('hooks-groupb-lessons-');

  // Millisecond-resolution ts collisions between two recordEvent() calls issued back-to-back would
  // make the Q4 "since the last commit" boundary ambiguous (a failure landing in the SAME ms as the
  // commit event would be indistinguishable from one strictly after it). Busy-waits to the next tick
  // — cheap here since this is a test, not a hook running under a real latency budget.
  function tick() {
    const t = Date.now();
    while (Date.now() === t) { /* spin */ }
  }

  // -----------------------------------------------------------------------------------------------
  // PURE-FUNCTION TABLE — sessionLessonGate({failuresSinceLastCommit, disciplineDiffText}), no git,
  // no state store. Covers the same decision table the rule sits on top of.
  // -----------------------------------------------------------------------------------------------
  {
    const zero = GL.sessionLessonGate({ failuresSinceLastCommit: 0, disciplineDiffText: '' });
    check('sessionLessonGate: zero failures -> pass, silently', zero.pass === true, `out=${JSON.stringify(zero)}`);

    const noEvidence = GL.sessionLessonGate({ failuresSinceLastCommit: 2, disciplineDiffText: '' });
    check('sessionLessonGate: 2 failures + empty diff -> fail', noEvidence.pass === false, `out=${JSON.stringify(noEvidence)}`);
    check('sessionLessonGate: fail reason names §10.16', noEvidence.reason.includes('§10.16'), `reason=${noEvidence.reason}`);
    check('sessionLessonGate: fail reason names the count (2)', noEvidence.reason.includes('2'), `reason=${noEvidence.reason}`);
    check('sessionLessonGate: fail reason names the lesson-line alternative verbatim',
      noEvidence.reason.includes('**L<n> ·'), `reason=${noEvidence.reason}`);
    check('sessionLessonGate: fail reason names the no-lesson-declaration alternative verbatim',
      noEvidence.reason.includes('**No-lesson declaration (YYYY-MM-DD):** <arc> — reason'), `reason=${noEvidence.reason}`);

    const withLesson = GL.sessionLessonGate({
      failuresSinceLastCommit: 2,
      disciplineDiffText: '+**L63 · הלקח (2026-08-08).**\n context line, unprefixed\n-removed old line',
    });
    check('sessionLessonGate: failures + diff with a NEW +**L<n> ·** line -> pass', withLesson.pass === true, `out=${JSON.stringify(withLesson)}`);

    const withDecl = GL.sessionLessonGate({
      failuresSinceLastCommit: 3,
      disciplineDiffText: '+**No-lesson declaration (2026-08-08):** enforcement B/6 — reviewed, nothing new.',
    });
    check('sessionLessonGate: failures + diff with a NEW no-lesson declaration -> pass', withDecl.pass === true, `out=${JSON.stringify(withDecl)}`);

    // A lesson line present only as CONTEXT (unprefixed) or REMOVED (`-` prefixed) must not count —
    // only an ADDITION proves a lesson was written since the last commit.
    const contextOnly = GL.sessionLessonGate({
      failuresSinceLastCommit: 1,
      disciplineDiffText: ' **L63 · unrelated context line, not new.**\n-**L62 · this one was REMOVED.**',
    });
    check('sessionLessonGate: an unprefixed/removed L-line does not count as new -> fail',
      contextOnly.pass === false, `out=${JSON.stringify(contextOnly)}`);

    const negFailures = GL.sessionLessonGate({ failuresSinceLastCommit: -1, disciplineDiffText: '' });
    check('sessionLessonGate: negative/garbage failures count treated as 0 -> pass', negFailures.pass === true, `out=${JSON.stringify(negFailures)}`);
  }

  // Sets up a disposable git repo (its own .git) containing one tracked discipline.md, committed, so
  // `git diff HEAD -- <doc>` has real content to read after an on-disk (uncommitted) modification —
  // the exact same command the rule itself shells out to, just pointed at a throwaway repo via
  // LESSONS_GATE_GIT_CWD so the real repo's own discipline.md is never touched.
  function makeTempRepo(discDocInitialText) {
    const repoDir = tempDir('hooks-groupb-lessons-repo-');
    execFileSync('git', ['init', '-q'], { cwd: repoDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
    const docPath = join(repoDir, 'discipline.md');
    writeFileSync(docPath, discDocInitialText, 'utf8');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repoDir });
    return { repoDir, docPath };
  }

  function withRuleEnv({ statePath, gitCwd, disciplinePath }, fn) {
    const prevState = process.env.ENFORCEMENT_STATE_PATH;
    const prevCwd = process.env.LESSONS_GATE_GIT_CWD;
    const prevDoc = process.env.DISCIPLINE;
    process.env.ENFORCEMENT_STATE_PATH = statePath;
    process.env.LESSONS_GATE_GIT_CWD = gitCwd;
    process.env.DISCIPLINE = disciplinePath;
    try {
      return fn();
    } finally {
      if (prevState === undefined) delete process.env.ENFORCEMENT_STATE_PATH; else process.env.ENFORCEMENT_STATE_PATH = prevState;
      if (prevCwd === undefined) delete process.env.LESSONS_GATE_GIT_CWD; else process.env.LESSONS_GATE_GIT_CWD = prevCwd;
      if (prevDoc === undefined) delete process.env.DISCIPLINE; else process.env.DISCIPLINE = prevDoc;
    }
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED-3 — non-commit Bash passes through untouched.
  // -----------------------------------------------------------------------------------------------
  {
    const outStatus = RULE6.evaluate({ tool_name: 'Bash', session_id: 'sX', tool_input: { command: 'git status' } });
    check('lessons-before-commit: `git status` -> allow', outStatus.decision === 'allow', `out=${JSON.stringify(outStatus)}`);
    const outEcho = RULE6.evaluate({ tool_name: 'Bash', session_id: 'sX', tool_input: { command: 'echo "git commit"' } });
    check('lessons-before-commit: `echo "git commit"` (lookalike, not a real commit) -> allow', outEcho.decision === 'allow', `out=${JSON.stringify(outEcho)}`);
    const outNonBash = RULE6.evaluate({ tool_name: 'Edit', session_id: 'sX', tool_input: { file_path: 'x.js' } });
    check('lessons-before-commit: non-Bash tool -> allow', outNonBash.decision === 'allow', `out=${JSON.stringify(outNonBash)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED — zero failures recorded this session -> allow, silently. Proven with
  // LESSONS_GATE_GIT_CWD pointed at a directory that is NOT a git repo: if the rule tried to shell
  // out to git anyway it would hit the fail-open GIT-FAILURE path below, not this silent one, and the
  // reason text differs between the two — the assertion distinguishes them.
  // -----------------------------------------------------------------------------------------------
  {
    const notARepo = tempDir('hooks-groupb-lessons-notrepo-');
    const statePath = join(s6Work, 'zero-failures.sqlite');
    const sessionId = 'sess-zero';
    { const db = ES6.openState(statePath); db.close(); }
    const out = withRuleEnv(
      { statePath, gitCwd: notARepo, disciplinePath: join(notARepo, 'discipline.md') },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "x"' } }),
    );
    check('COUNTER-RED lessons: zero failures -> allow silently', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('COUNTER-RED lessons: zero-failures reason names "no failures" (never reaches the git-failure path)',
      /no failures/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // RED — 2 failures since last commit + empty discipline diff -> BLOCK; reason names §10.16, the
  // count, and BOTH alternatives verbatim.
  // -----------------------------------------------------------------------------------------------
  {
    const { repoDir, docPath } = makeTempRepo('# discipline\n\n## 11\n\n(no lessons yet)\n');
    const statePath = join(s6Work, 'red.sqlite');
    const sessionId = 'sess-red';
    {
      const db = ES6.openState(statePath);
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't1' } });
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't2' } });
      db.close();
    }
    const out = withRuleEnv(
      { statePath, gitCwd: repoDir, disciplinePath: docPath },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "x"' } }),
    );
    check('RED lessons: 2 failures + empty diff -> BLOCK', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED lessons: reason names §10.16', out.reason.includes('§10.16'), `reason=${out.reason}`);
    check('RED lessons: reason names the count (2)', out.reason.includes('2'), `reason=${out.reason}`);
    check('RED lessons: reason names the lesson-line alternative verbatim', out.reason.includes('**L<n> ·'), `reason=${out.reason}`);
    check('RED lessons: reason names the no-lesson-declaration alternative verbatim',
      out.reason.includes('**No-lesson declaration (YYYY-MM-DD):** <arc> — reason'), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED — failures + diff containing a NEW `+**L63 · ...**` line -> allow.
  // -----------------------------------------------------------------------------------------------
  {
    const { repoDir, docPath } = makeTempRepo('# discipline\n\n## 11\n\n(no lessons yet)\n');
    writeFileSync(docPath, '# discipline\n\n## 11\n\n**L63 · הלקח (2026-08-08).** a real lesson.\n', 'utf8');
    const statePath = join(s6Work, 'counter-lesson.sqlite');
    const sessionId = 'sess-lesson';
    {
      const db = ES6.openState(statePath);
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't1' } });
      db.close();
    }
    const out = withRuleEnv(
      { statePath, gitCwd: repoDir, disciplinePath: docPath },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "x"' } }),
    );
    check('COUNTER-RED lessons: failures + new L-line in diff -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED — failures + diff containing a NEW no-lesson declaration -> allow.
  // -----------------------------------------------------------------------------------------------
  {
    const { repoDir, docPath } = makeTempRepo('# discipline\n\n## 11\n\n(no lessons yet)\n');
    writeFileSync(docPath, '# discipline\n\n## 11\n\n**No-lesson declaration (2026-08-08):** enforcement B/6 — reviewed, nothing new.\n', 'utf8');
    const statePath = join(s6Work, 'counter-decl.sqlite');
    const sessionId = 'sess-decl';
    {
      const db = ES6.openState(statePath);
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't1' } });
      db.close();
    }
    const out = withRuleEnv(
      { statePath, gitCwd: repoDir, disciplinePath: docPath },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "x"' } }),
    );
    check('COUNTER-RED lessons: failures + new no-lesson declaration in diff -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED-2 (Q4 ruling, tested explicitly) — a session whose failures all predate its last
  // commit event -> allow. Concretely: 2 failures, THEN a 'commit' event recorded (simulating the
  // PRIOR commit that already covered them, via verification-outcomes.mjs's own PostToolUse write),
  // and NO new failures after that -> the next `git commit` sees failuresSinceLastCommit === 0.
  // -----------------------------------------------------------------------------------------------
  {
    const notARepo = tempDir('hooks-groupb-lessons-notrepo2-');
    const statePath = join(s6Work, 'q4.sqlite');
    const sessionId = 'sess-q4';
    {
      const db = ES6.openState(statePath);
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't1' } });
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't2' } });
      tick();
      // The PRIOR commit event — everything before this point is "already covered" per Q4.
      ES6.recordEvent(db, { sessionId, kind: 'commit', detail: { command: 'git commit -m "prev"' } });
      db.close();
    }
    const out = withRuleEnv(
      { statePath, gitCwd: notARepo, disciplinePath: join(notARepo, 'discipline.md') },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "next"' } }),
    );
    check('COUNTER-RED-2 lessons (Q4): failures all predate the last commit event -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('COUNTER-RED-2 lessons (Q4): reason names "no failures" (0 since the last commit)', /no failures/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Q4 made concrete the other direction: NEW failures AFTER that prior commit still block, with the
  // count reflecting only the post-commit failures (1, not 3).
  // -----------------------------------------------------------------------------------------------
  {
    const { repoDir, docPath } = makeTempRepo('# discipline\n\n## 11\n\n(no lessons yet)\n');
    const statePath = join(s6Work, 'q4-new-failure.sqlite');
    const sessionId = 'sess-q4b';
    {
      const db = ES6.openState(statePath);
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't1' } });
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't2' } });
      tick();
      ES6.recordEvent(db, { sessionId, kind: 'commit', detail: { command: 'git commit -m "prev"' } });
      tick();
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't3' } });
      db.close();
    }
    const out = withRuleEnv(
      { statePath, gitCwd: repoDir, disciplinePath: docPath },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "next"' } }),
    );
    check('Q4 (post-commit failure): still blocks', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('Q4 (post-commit failure): count reflects only the 1 post-commit failure, not all 3',
      /\b1\b/.test(out.reason.split('recorded since')[0]), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Fail-open — enforcement state unreadable (corrupt file) -> allow, degradation named.
  // -----------------------------------------------------------------------------------------------
  {
    const garbagePath = join(s6Work, 'garbage.sqlite');
    writeFileSync(garbagePath, 'not a sqlite file, just garbage bytes', 'utf8');
    const out = withRuleEnv(
      { statePath: garbagePath, gitCwd: ROOT, disciplinePath: join(ROOT, 'docs', 'process', 'development-discipline.md') },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: 'sess-garbage', tool_input: { command: 'git commit -m "x"' } }),
    );
    check('lessons-before-commit: corrupt state file -> allow (never blocks)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('lessons-before-commit: reason names the degradation', /unreadable|degrad/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Fail-open — git itself unavailable/failing (LESSONS_GATE_GIT_CWD points at a non-repo dir, so
  // `git diff HEAD -- ...` errors) with failures actually recorded -> allow, degradation named, NOT
  // a false block.
  // -----------------------------------------------------------------------------------------------
  {
    const notARepo = tempDir('hooks-groupb-lessons-gitfail-');
    const statePath = join(s6Work, 'gitfail.sqlite');
    const sessionId = 'sess-gitfail';
    {
      const db = ES6.openState(statePath);
      ES6.recordEvent(db, { sessionId, kind: 'verification_failure', detail: { target: 't1' } });
      db.close();
    }
    const out = withRuleEnv(
      { statePath, gitCwd: notARepo, disciplinePath: join(notARepo, 'nonexistent-discipline.md') },
      () => RULE6.evaluate({ tool_name: 'Bash', session_id: sessionId, tool_input: { command: 'git commit -m "x"' } }),
    );
    check('lessons-before-commit: git diff failure with real failures pending -> allow (fail-open, not a false block)',
      out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('lessons-before-commit: git-failure reason names the degradation', /degrad/i.test(out.reason), `reason=${out.reason}`);
  }
}

// =================================================================================================
// SECTION 7 — scripts/hooks/lib/skill-invoked.mjs + scripts/hooks/rules/brainstorm-before-creative.mjs
// (task-7-brief.md, §6.4 trigger 1). Every case runs against fixture transcripts, a fixture
// ROADMAP register (ROADMAP env override, re-read per call), a fixture .superpowers/sdd ledger
// directory, and a fixture docs/superpowers/specs directory — never the real
// transcript/register/ledgers/specs, exactly like every prior section's own warning: this rule is
// wired into Write|Edit, which means it would run on THIS TEST'S OWN writes too if evidence sources
// were not isolated.
//
// FIX ROUND 1 (coordinator finding, 2026-08-08): driving the ORIGINAL rule with a transcript
// containing NO skill invocation at all proved a plans/ write and a brand-new source file BOTH
// allowed regardless of which spec actually governed the write — "some spec somewhere is approved"
// was not evidence about THIS write. Every RED case below is built on exactly that shape of input
// (a clean synthetic transcript, zero Skill entries) per the coordinator's own reproduction method,
// not on this session's real transcript (which contains a real writing-plans invocation and would
// hide the bug the same way the coordinator's first probe did).
// =================================================================================================
const s7Work = tempDir('hooks-groupb-brainstorm-');

// scripts/session-state.mjs's SDD_DIR *and* SPECS_DIR are MODULE-LOAD-TIME constants
// (`process.env.X || <real path>`), read ONCE when the module is first imported — unlike
// roadmapPath() in brainstorm-before-creative.mjs, which is deliberately a function re-reading
// process.env.ROADMAP on every call. Setting either env var AFTER import has no effect (this was
// discovered the hard way in fix round 0 of this same task: a "no active ledger" case first came
// back `allow` because the real repo's OWN active ledger — this very task's — was still what
// findLedgers() saw). The fix, reused here for SPECS_DIR too: point BOTH at fixed fixture
// directories BEFORE the very first import of the rule (which transitively imports
// session-state.mjs), then vary each fixed directory's ON-DISK CONTENTS per case at runtime —
// findLedgers()/governingSpecFile() both DO re-read their directory listing on every call.
//
// Hoisted to file scope (not just this section's own block) because ESM caches a module by its
// resolved URL: Section 9's later `await import(...)` of this SAME rule file returns the SAME
// cached instance, whose session-state.mjs import already locked in THESE directories as SDD_DIR/
// SPECS_DIR — re-setting the env vars at that point would have no effect (same trap the paragraph
// above already names). Section 9 reuses these two constants directly instead of trying to
// redirect them again.
const FIXED_SDD_DIR = join(s7Work, 'fixed-sdd');
const FIXED_SPECS_DIR = join(s7Work, 'fixed-specs');
mkdirSync(FIXED_SDD_DIR, { recursive: true });
mkdirSync(FIXED_SPECS_DIR, { recursive: true });

// Also hoisted (same caching reason as FIXED_SDD_DIR/FIXED_SPECS_DIR above): Section 9 reuses this
// SAME RULE7 instance rather than importing brainstorm-before-creative.mjs a second time, since a
// second import of the identical resolved path would return the identical cached module anyway.
let RULE7;
{
  const prevSddDirAtImport = process.env.SDD_DIR;
  const prevSpecsDirAtImport = process.env.SPECS_DIR;
  process.env.SDD_DIR = FIXED_SDD_DIR;
  process.env.SPECS_DIR = FIXED_SPECS_DIR;
  const SKILLINV = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'skill-invoked.mjs')).href);
  RULE7 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'brainstorm-before-creative.mjs')).href);
  if (prevSddDirAtImport === undefined) delete process.env.SDD_DIR; else process.env.SDD_DIR = prevSddDirAtImport;
  if (prevSpecsDirAtImport === undefined) delete process.env.SPECS_DIR; else process.env.SPECS_DIR = prevSpecsDirAtImport;

  const LEDGER_ARC_DIR = join(FIXED_SDD_DIR, '2026-08-08-fixture-arc');
  function setLedgerPresent(present) {
    if (present) {
      mkdirSync(LEDGER_ARC_DIR, { recursive: true });
      writeFileSync(join(LEDGER_ARC_DIR, 'progress.md'), 'plan: docs/superpowers/plans/fixture.md\n', 'utf8');
    } else if (existsSync(LEDGER_ARC_DIR)) {
      rmSync(LEDGER_ARC_DIR, { recursive: true, force: true });
    }
  }

  // Clears FIXED_SPECS_DIR and (optionally) writes exactly ONE .md file into it — unambiguously the
  // "newest-modified" file governingSpecFile() will report, without needing to fight mtime races.
  function setGoverningSpec(fileName) {
    if (existsSync(FIXED_SPECS_DIR)) {
      for (const f of readdirSync(FIXED_SPECS_DIR)) rmSync(join(FIXED_SPECS_DIR, f), { force: true });
    }
    if (fileName) writeFileSync(join(FIXED_SPECS_DIR, fileName), '# spec\n', 'utf8');
  }

  // Builds a fixture transcript .jsonl containing one entry per `entries` item, in the REAL shape
  // measured off a live transcript (see skill-invoked.mjs's own header): a top-level assistant turn
  // whose message.content array holds one block. `entries[i]` is either { tsOffsetMs, skill } (a
  // Skill tool_use) or { tsOffsetMs, text } (a plain text block).
  function makeTranscript(entries) {
    const path = join(s7Work, `transcript-${Math.random().toString(36).slice(2)}.jsonl`);
    const now = Date.now();
    const lines = entries.map((e) => JSON.stringify({
      type: 'assistant',
      timestamp: new Date(now - e.tsOffsetMs).toISOString(),
      message: {
        content: [
          e.skill !== undefined
            ? { type: 'tool_use', name: 'Skill', input: { skill: e.skill } }
            : { type: 'text', text: e.text },
        ],
      },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  // A CLEAN transcript with NO Skill invocation anywhere — five plain "user" turns, exactly the
  // shape the coordinator's own reproduction used ("a clean JSONL of five plain user lines"). This
  // is the input every RED case below is built on.
  function makeCleanTranscript() {
    const path = join(s7Work, `clean-transcript-${Math.random().toString(36).slice(2)}.jsonl`);
    const now = Date.now();
    const lines = [
      'what does this repo do',
      'ok now look at the failing test',
      'no, the OTHER file',
      'fine, go ahead',
      'looks good, continue',
    ].map((text, i) => JSON.stringify({
      type: 'user',
      timestamp: new Date(now - (5 - i) * 1000).toISOString(),
      message: { content: [{ type: 'text', text }] },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  // Builds a fixture register file with the real section header and the real row shapes.
  function makeRegister(rows) {
    const path = join(s7Work, `roadmap-${Math.random().toString(36).slice(2)}.md`);
    const header = '## מרשם האישורים — מפרטים שאושרו על-ידי הבעלים\n\n| מפרט | סטטוס | הראיה |\n|---|---|---|\n';
    const body = rows.map((r) => (r.approved
      ? `| \`${r.file}\` | **מאושר (2026-08-08)** | evidence |`
      : `| \`${r.file}\` | 🔴 **לא-מאושר — הכרעת בעלים 8.8.26** | evidence |`)).join('\n');
    writeFileSync(path, `${header}${body}\n`, 'utf8');
    return path;
  }

  // The register the coordinator's own reproduction used — the real 19-approved/6-blocked shape,
  // trimmed to a representative few, so "an approved spec exists SOMEWHERE" stays abundantly true
  // (proving the fix checks the SPECIFIC write, not "is the register non-empty").
  const REALISTIC_REGISTER = makeRegister([
    { file: '2026-08-06-process-enforcement-design.md', approved: true },
    { file: '2026-08-01-fixture-design.md', approved: true },
    { file: '2026-08-03-data-model-design.md', approved: true },
    { file: '2026-07-21-occupancy-slots-h4-design.md', approved: false }, // one of the owner's 6 deliberately-blocked
  ]);

  function withRegisterEnv(roadmapPath, evalFn) {
    const prevRoadmap = process.env.ROADMAP;
    process.env.ROADMAP = roadmapPath;
    try {
      return evalFn();
    } finally {
      if (prevRoadmap === undefined) delete process.env.ROADMAP; else process.env.ROADMAP = prevRoadmap;
    }
  }

  const NONEXISTENT_TRANSCRIPT = join(s7Work, 'this-file-does-not-exist.jsonl');
  const emptyRegister = makeRegister([]); // register readable, section present, zero rows at all
  const noSuchRegister = join(s7Work, 'no-such-roadmap.md'); // register path itself unreadable

  // -----------------------------------------------------------------------------------------------
  // skillInvokedSince() — pure-function proof, straight off the measured real transcript shape.
  // -----------------------------------------------------------------------------------------------
  {
    const t = makeTranscript([{ tsOffsetMs: 60_000, skill: 'superpowers:brainstorming' }]);
    const hit = SKILLINV.skillInvokedSince(t, /brainstorming/, 20 * 60 * 1000);
    check('skillInvokedSince: brainstorming inside window -> determined+invoked', hit.determined === true && hit.invoked === true, `hit=${JSON.stringify(hit)}`);

    const miss = SKILLINV.skillInvokedSince(t, /writing-plans/, 20 * 60 * 1000);
    check('skillInvokedSince: different skill regex, same transcript -> determined, not invoked', miss.determined === true && miss.invoked === false, `miss=${JSON.stringify(miss)}`);

    const missing = SKILLINV.skillInvokedSince(NONEXISTENT_TRANSCRIPT, /brainstorming/, 20 * 60 * 1000);
    check('skillInvokedSince: missing transcript file -> determined:false', missing.determined === false, `missing=${JSON.stringify(missing)}`);

    const cleanResult = SKILLINV.skillInvokedSince(makeCleanTranscript(), /brainstorming/, 20 * 60 * 1000);
    check('skillInvokedSince: clean (no-skill) transcript -> determined, not invoked', cleanResult.determined === true && cleanResult.invoked === false, `r=${JSON.stringify(cleanResult)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // RULE PASSTHROUGH — anything that isn't Write/Edit, or has no file_path, is untouched.
  // -----------------------------------------------------------------------------------------------
  {
    const out = RULE7.evaluate({ tool_name: 'Bash', session_id: 'S', tool_input: { command: 'echo hi' } });
    check('brainstorm-before-creative: Bash passes through untouched', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // RED — Write to docs/superpowers/specs/new-thing.md on a CLEAN (no-skill) transcript -> block,
  // naming brainstorming. specs/ has no register escape at all.
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(false);
    setGoverningSpec(null);
    const specPath = join(s7Work, 'docs', 'superpowers', 'specs', 'new-thing.md');
    const out = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: specPath, content: '# spec' } }),
    );
    check('RED (spec write, clean transcript): blocks even with a realistic (mostly-approved) register', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED (spec write, clean transcript): reason names brainstorming', /brainstorming/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // RED-2 — NEW src/foo.py on a CLEAN transcript, WITH an active arc whose governing spec has no
  // register row at all -> block. (NOT "no active arc" — per the coordinator's own instruction 3,
  // "no active arc" is an explicit ALLOW-with-degradation case, tested separately below under
  // "Branch B: no active arc -> allows". This case proves the actual regression: an active arc
  // whose write is NOT tied to any registered spec must still block.)
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(true);
    setGoverningSpec('2026-08-09-totally-unregistered-spec.md');
    const srcPath = join(s7Work, 'src', 'foo.py');
    const out = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: srcPath, content: 'print(1)' } }),
    );
    check('RED-2 (new src/foo.py, clean transcript, active arc on an unregistered spec): blocks', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED-2 (new src/foo.py, clean transcript, active arc on an unregistered spec): reason names brainstorming', /brainstorming/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // *** THE COORDINATOR'S EXACT REPRODUCTION, RE-RUN AGAINST THE FIXED RULE ***
  // A clean (no-skill) transcript; a REALISTIC register with 19-approved-style noise (here trimmed
  // to a few rows, still mostly-approved). The coordinator's own probe ran inside a LIVE session that
  // DOES have an active arc on disk (this very task's own ledger) — so the plans/ case is reproduced
  // with no active arc needed (plans/ never required one), and the src/ case is reproduced with an
  // active arc present but its governing spec NOT tied to any approved register row, matching what a
  // real session in this shape would actually hit. Both must now correctly `block`.
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(false); // no active arc at all — the plans/ write doesn't need one
    setGoverningSpec(null);
    const planPath = join(s7Work, 'docs', 'superpowers', 'plans', '2026-08-09-new-plan.md');
    const outPlan = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: planPath, content: '# plan' } }),
    );
    check('COORDINATOR REPRO: plans/2026-08-09-new-plan.md, clean transcript, realistic register -> now BLOCKS (was wrongly allow)',
      outPlan.decision === 'block', `out=${JSON.stringify(outPlan)}`);

    setLedgerPresent(true); // an active arc IS present in the coordinator's own live probe
    setGoverningSpec('2026-08-09-totally-unregistered-spec.md'); // its governing spec is not tied to any approved row
    const srcPath = join(s7Work, 'src', 'newModule.mjs');
    const outSrc = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: srcPath, content: 'export default {};' } }),
    );
    check('COORDINATOR REPRO: src/newModule.mjs, clean transcript, realistic register, active arc on an unregistered spec -> now BLOCKS (was wrongly allow)',
      outSrc.decision === 'block', `out=${JSON.stringify(outSrc)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED — same spec-write, but the transcript contains a brainstorming Skill invocation
  // inside the window -> allow.
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(false);
    setGoverningSpec(null);
    const specPath = join(s7Work, 'docs', 'superpowers', 'specs', 'new-thing-2.md');
    const t = makeTranscript([{ tsOffsetMs: 30_000, skill: 'superpowers:brainstorming' }]);
    const out = withRegisterEnv(
      emptyRegister,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: t, tool_input: { file_path: specPath, content: '# spec' } }),
    );
    check('COUNTER-RED (spec write, brainstorming invoked): allows', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // PLAN-NAME MATCHING — a plan whose OWN filename matches an approved spec's row (token
  // comparison, the coordinator's own example) allows, with NO skill invoked.
  // -----------------------------------------------------------------------------------------------
  {
    const planPath = join(s7Work, 'docs', 'superpowers', 'plans', '2026-08-08-enforcement-phase-4-group-b.md');
    const out = withRegisterEnv(
      REALISTIC_REGISTER, // contains the approved `2026-08-06-process-enforcement-design.md` row
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: planPath, content: '# plan' } }),
    );
    check('plan name token-matches an APPROVED spec row (no skill invoked): allows', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('plan name token-matches an APPROVED spec row: reason names the matched spec file', /2026-08-06-process-enforcement-design\.md/.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // PLAN-NAME MATCHING, negative — a plan whose filename matches NOTHING in the register (all
  // generic/short tokens filtered) still blocks, even with a realistic mostly-approved register.
  // (This is the exact bug-reproduction case, restated as a standalone check.)
  // -----------------------------------------------------------------------------------------------
  {
    const planPath = join(s7Work, 'docs', 'superpowers', 'plans', '2026-08-09-new-plan.md');
    const out = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: planPath, content: '# plan' } }),
    );
    check('plan name matches NOTHING in the register: still blocks', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('plan name matches NOTHING: reason states no register entry matched', /no register entry/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // PLAN-NAME MATCHING, matched-but-blocked — a plan whose filename token-matches a spec the owner
  // deliberately left UNAPPROVED still blocks, and the reason names that spec and says so.
  // -----------------------------------------------------------------------------------------------
  {
    const planPath = join(s7Work, 'docs', 'superpowers', 'plans', '2026-08-09-occupancy-slots-h5.md');
    const out = withRegisterEnv(
      REALISTIC_REGISTER, // contains the BLOCKED `2026-07-21-occupancy-slots-h4-design.md` row
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: planPath, content: '# plan' } }),
    );
    check('plan name matches a DELIBERATELY-UNAPPROVED spec row: still blocks', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('plan name matches unapproved spec: reason names the matched-but-unapproved spec', /2026-07-21-occupancy-slots-h4-design\.md/.test(out.reason) && /not marked approved/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // specs/ (not plans/) gets NO register escape at all, even when the plan-name-matching machinery
  // would otherwise find an approved row for that exact filename — the escape is plans/-only.
  // -----------------------------------------------------------------------------------------------
  {
    const specPath = join(s7Work, 'docs', 'superpowers', 'specs', '2026-08-06-process-enforcement-design.md');
    const out = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: specPath, content: '# spec' } }),
    );
    check('specs/ write, exact-name match to an approved row, no skill invoked: still blocks (escape is plans/-only)', out.decision === 'block', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Edit to an EXISTING source file -> allow, and the transcript is NEVER even consulted: pass a
  // nonexistent transcript path and assert allow, proving the cheap existsSync() branch short-
  // circuits before any transcript read.
  // -----------------------------------------------------------------------------------------------
  {
    const existingPath = join(s7Work, 'existing-app.js');
    writeFileSync(existingPath, '// already here\n', 'utf8');
    const out = RULE7.evaluate({
      tool_name: 'Edit',
      session_id: 'S',
      transcript_path: NONEXISTENT_TRANSCRIPT,
      tool_input: { file_path: existingPath, old_string: 'a', new_string: 'b' },
    });
    check('Edit to EXISTING source file: allows, no transcript read needed', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // New file under scripts/tests/, .superpowers/, mockups/, docs/, and a scratchpad path -> allow
  // (not creative work). Same nonexistent-transcript proof as above.
  // -----------------------------------------------------------------------------------------------
  {
    const cases = [
      join(s7Work, 'scripts', 'tests', 'new-test.mjs'),
      join(s7Work, '.superpowers', 'sdd', 'x', 'scratch.py'),
      join(s7Work, 'mockups', 'gen.js'),
      join(s7Work, 'docs', 'some-code-sample.js'),
      join(s7Work, 'scratchpad', 'temp.py'),
    ];
    for (const p of cases) {
      const out = RULE7.evaluate({
        tool_name: 'Write',
        session_id: 'S',
        transcript_path: NONEXISTENT_TRANSCRIPT,
        tool_input: { file_path: p, content: 'x' },
      });
      check(`new file under excluded tree (${p.slice(s7Work.length)}): allows`, out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Unreadable transcript on a gating path -> allow (determined:false, never an accusation) — both
  // branches, each with an otherwise-clearing setup that should never even be consulted since the
  // transcript check resolves first.
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(true);
    setGoverningSpec('2026-08-06-process-enforcement-design.md'); // even an APPROVED spec present
    const specPath = join(s7Work, 'docs', 'superpowers', 'specs', 'unreadable-transcript.md');
    const out = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: NONEXISTENT_TRANSCRIPT, tool_input: { file_path: specPath, content: '# spec' } }),
    );
    check('unreadable transcript, specs/ write, no other escape: allows (fail-open)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('unreadable transcript reason names the degradation', /degrad/i.test(out.reason), `reason=${out.reason}`);

    const srcPath = join(s7Work, 'src', 'bar.py');
    const out2 = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: NONEXISTENT_TRANSCRIPT, tool_input: { file_path: srcPath, content: 'x=1' } }),
    );
    check('unreadable transcript, new source file, no other escape: allows (fail-open)', out2.decision === 'allow', `out2=${JSON.stringify(out2)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Fail-open — the register file itself is unreadable (bad ROADMAP path) on a gating path with a
  // readable-but-clean transcript -> allow, degradation named.
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(false);
    setGoverningSpec(null);
    const planPath = join(s7Work, 'docs', 'superpowers', 'plans', 'reg-unreadable.md');
    const out = withRegisterEnv(
      noSuchRegister,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: planPath, content: '# plan' } }),
    );
    check('plans/ write, register file itself unreadable: allows (fail-open)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    check('register-unreadable reason names the degradation', /degrad/i.test(out.reason), `reason=${out.reason}`);
  }

  // -----------------------------------------------------------------------------------------------
  // GOVERNING-SPEC CHECK (Branch B), all four outcomes:
  //   1. No active arc at all -> allow, reason states why.
  //   2. Active arc, governing spec APPROVED -> allow.
  //   3. Active arc, governing spec has a register row but it is UNAPPROVED (the owner's
  //      deliberately-blocked case) -> BLOCKS. "That last case matters most."
  //   4. Active arc, governing spec has NO row at all in the register -> blocks.
  // -----------------------------------------------------------------------------------------------
  {
    // 1. No active arc.
    setLedgerPresent(false);
    setGoverningSpec('2026-08-06-process-enforcement-design.md'); // approved spec present on disk, but no arc tracking it
    const srcPath1 = join(s7Work, 'src', 'no-arc.py');
    const out1 = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: srcPath1, content: 'x=1' } }),
    );
    check('Branch B: no active arc -> allows', out1.decision === 'allow', `out=${JSON.stringify(out1)}`);
    check('Branch B: no active arc -> reason states why', /no active arc/i.test(out1.reason), `reason=${out1.reason}`);

    // 2. Active arc, approved governing spec.
    setLedgerPresent(true);
    setGoverningSpec('2026-08-06-process-enforcement-design.md');
    const srcPath2 = join(s7Work, 'src', 'approved-arc.py');
    const out2 = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: srcPath2, content: 'x=1' } }),
    );
    check('Branch B: active arc + APPROVED governing spec -> allows', out2.decision === 'allow', `out=${JSON.stringify(out2)}`);
    check('Branch B: active arc + approved spec -> reason names the spec', /2026-08-06-process-enforcement-design\.md/.test(out2.reason), `reason=${out2.reason}`);

    // 3. THE CASE THAT MATTERS MOST — active arc, governing spec is one of the owner's 6
    // deliberately-unapproved specs -> BLOCKS.
    setLedgerPresent(true);
    setGoverningSpec('2026-07-21-occupancy-slots-h4-design.md');
    const srcPath3 = join(s7Work, 'src', 'unapproved-arc.py');
    const out3 = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: srcPath3, content: 'x=1' } }),
    );
    check('Branch B (MATTERS MOST): active arc on a DELIBERATELY-UNAPPROVED spec -> BLOCKS', out3.decision === 'block', `out=${JSON.stringify(out3)}`);
    check('Branch B (MATTERS MOST): reason names the unapproved spec', /2026-07-21-occupancy-slots-h4-design\.md/.test(out3.reason) && /not marked approved/i.test(out3.reason), `reason=${out3.reason}`);

    // 4. Active arc, governing spec has no row at all in the register.
    setLedgerPresent(true);
    setGoverningSpec('2026-08-09-totally-unregistered-spec.md');
    const srcPath4 = join(s7Work, 'src', 'unregistered-arc.py');
    const out4 = withRegisterEnv(
      REALISTIC_REGISTER,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: makeCleanTranscript(), tool_input: { file_path: srcPath4, content: 'x=1' } }),
    );
    check('Branch B: active arc, governing spec has NO register row at all -> blocks', out4.decision === 'block', `out=${JSON.stringify(out4)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Branch B's brainstorming-only escape still works with zero register/arc evidence at all.
  // -----------------------------------------------------------------------------------------------
  {
    setLedgerPresent(false);
    setGoverningSpec(null);
    const srcPath = join(s7Work, 'src', 'brainstormed.py');
    const t = makeTranscript([{ tsOffsetMs: 5000, skill: 'superpowers:brainstorming' }]);
    const out = withRegisterEnv(
      emptyRegister,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: t, tool_input: { file_path: srcPath, content: 'x=1' } }),
    );
    check('Branch B: brainstorming invoked, no register/arc evidence at all: allows', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // writing-plans (not brainstorming) invoked -> passes for a plans/ write, but must NOT pass a
  // specs/ write (brainstorming only, there).
  // -----------------------------------------------------------------------------------------------
  {
    const planPath = join(s7Work, 'docs', 'superpowers', 'plans', 'writing-plans-escape.md');
    const t = makeTranscript([{ tsOffsetMs: 5000, skill: 'superpowers:writing-plans' }]);
    const outPlans = withRegisterEnv(
      emptyRegister,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: t, tool_input: { file_path: planPath, content: '# plan' } }),
    );
    check('writing-plans invoked: passes for a plans/ write', outPlans.decision === 'allow', `out=${JSON.stringify(outPlans)}`);

    const specPath = join(s7Work, 'docs', 'superpowers', 'specs', 'writing-plans-no-escape.md');
    const t2 = makeTranscript([{ tsOffsetMs: 5000, skill: 'superpowers:writing-plans' }]);
    const outSpecs = withRegisterEnv(
      emptyRegister,
      () => RULE7.evaluate({ tool_name: 'Write', session_id: 'S', transcript_path: t2, tool_input: { file_path: specPath, content: '# spec' } }),
    );
    check('writing-plans invoked: does NOT pass for a specs/ write (brainstorming only there)', outSpecs.decision === 'block', `out=${JSON.stringify(outSpecs)}`);
  }
}

// =================================================================================================
// SECTION 8 — scripts/hooks/rules/debugging-before-fix-edit.mjs (task-8-brief.md, §6.4 trigger 2).
// "a failure (exit != 0) followed by an edit, with no systematic-debugging invocation in between,
// blocks." Reuses Task 3's own 'bash_failure' events (which already apply Q2's answer-exit
// exemption — grep/diff/test/cmp) and Task 7's skillInvokedSince(). Every case here runs against a
// TEMP ENFORCEMENT_STATE_PATH and a CLEAN SYNTHETIC transcript with NO skill invocations at all —
// never this session's own real transcript (per the brief: two earlier tasks tonight produced
// misleading results because the real transcript happened to contain the very skill invocation
// under test).
// =================================================================================================
{
  const s8Work = tempDir('hooks-groupb-debugfix-');
  const RULE8 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'debugging-before-fix-edit.mjs')).href);
  const ES8 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);

  function withState8(seedFn, evalFn) {
    const p = join(s8Work, `state-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      const db = ES8.openState(p);
      seedFn(db);
      db.close();
      return evalFn();
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  function insertEvent(db, sessionId, kind, ts) {
    db.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
      .run(sessionId, kind, ts, null);
  }

  // Builds a fixture transcript .jsonl, the real measured shape (skill-invoked.mjs's own header) —
  // one entry per `entries` item: { atMs, skill } (a Skill tool_use, absolute epoch ms) or
  // { atMs, text } (a plain text block).
  function makeTranscript8(entries) {
    const path = join(s8Work, `transcript-${Math.random().toString(36).slice(2)}.jsonl`);
    const lines = entries.map((e) => JSON.stringify({
      type: 'assistant',
      timestamp: new Date(e.atMs).toISOString(),
      message: {
        content: [
          e.skill !== undefined
            ? { type: 'tool_use', name: 'Skill', input: { skill: e.skill } }
            : { type: 'text', text: e.text },
        ],
      },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  // A CLEAN transcript — no Skill invocation anywhere. Every RED case below is built on this, not on
  // this session's own real transcript (see section header).
  function makeCleanTranscript8() {
    const now = Date.now();
    return makeTranscript8([
      { atMs: now - 50_000, text: 'what does this repo do' },
      { atMs: now - 40_000, text: 'ok now look at the failing test' },
      { atMs: now - 30_000, text: 'no, the OTHER file' },
      { atMs: now - 20_000, text: 'fine, go ahead' },
      { atMs: now - 10_000, text: 'looks good, continue' },
    ]);
  }

  const NONEXISTENT_TRANSCRIPT = join(s8Work, 'this-file-does-not-exist.jsonl');
  const editInput = (sessionId, transcriptPath, filePath) => ({
    tool_name: 'Edit',
    session_id: sessionId,
    transcript_path: transcriptPath,
    tool_input: { file_path: filePath },
  });

  // ---------------------------------------------------------------------------------------------
  // RED — recent bash_failure (60s old), clean transcript with NO systematic-debugging invocation
  // -> BLOCK. Reason names systematic-debugging and quotes the alternative.
  // ---------------------------------------------------------------------------------------------
  {
    const sid = 'sess-8-red';
    const out = withState8(
      (db) => insertEvent(db, sid, 'bash_failure', Date.now() - 60_000),
      () => RULE8.evaluate(editInput(sid, makeCleanTranscript8(), join(ROOT, 'x.js'))),
    );
    check('RED debugging-before-fix-edit: recent failure, no skill invocation -> BLOCK', out.decision === 'block', `out=${JSON.stringify(out)}`);
    check('RED debugging-before-fix-edit: reason names systematic-debugging', /systematic-debugging/.test(out.reason), `reason=${out.reason}`);
    check('RED debugging-before-fix-edit: reason names the escape (invoke the skill)', /invoke/i.test(out.reason), `reason=${out.reason}`);
  }

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED 1 — the mid-debugging human, protected: same failure, transcript WITH a
  // systematic-debugging invocation dated AFTER the failure -> allow.
  // ---------------------------------------------------------------------------------------------
  {
    const sid = 'sess-8-escaped';
    const failTs = Date.now() - 60_000;
    const out = withState8(
      (db) => insertEvent(db, sid, 'bash_failure', failTs),
      () => {
        const t = makeTranscript8([{ atMs: failTs + 10_000, skill: 'superpowers:systematic-debugging' }]);
        return RULE8.evaluate(editInput(sid, t, join(ROOT, 'x.js')));
      },
    );
    check('COUNTER-RED: systematic-debugging invoked after the failure -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED 2 — no bash_failure recorded at all for this session -> allow. The transcript is
  // pointed at a nonexistent path — if the rule tried to read it anyway it would only ever get
  // determined:false, never a false ALLOW-by-luck, so this also proves the cheap-state-first
  // short-circuit really happens.
  // ---------------------------------------------------------------------------------------------
  {
    const sid = 'sess-8-nofailure';
    const out = withState8(
      () => {},
      () => RULE8.evaluate(editInput(sid, NONEXISTENT_TRANSCRIPT, join(ROOT, 'x.js'))),
    );
    check('COUNTER-RED: no bash_failure event at all -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED 3 — the failure was recorded by ANOTHER session -> invisible by construction
  // (lastEvent is scoped by session_id) -> allow.
  // ---------------------------------------------------------------------------------------------
  {
    const otherSid = 'sess-8-owner';
    const mySid = 'sess-8-bystander';
    const out = withState8(
      (db) => insertEvent(db, otherSid, 'bash_failure', Date.now() - 60_000),
      () => RULE8.evaluate(editInput(mySid, makeCleanTranscript8(), join(ROOT, 'x.js'))),
    );
    check('COUNTER-RED: failure recorded by a DIFFERENT session -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED 4 — staleness backstop: failure 31+ minutes old -> allow, even with no skill
  // invocation and no resolving pass. A forgotten morning failure cannot block afternoon work.
  // ---------------------------------------------------------------------------------------------
  {
    const sid = 'sess-8-stale';
    const out = withState8(
      (db) => insertEvent(db, sid, 'bash_failure', Date.now() - (31 * 60 * 1000)),
      () => RULE8.evaluate(editInput(sid, makeCleanTranscript8(), join(ROOT, 'x.js'))),
    );
    check('COUNTER-RED: failure 31+ minutes old -> allow (staleness backstop)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED 5 — the failure was already resolved by a passing run: a verification_pass event
  // recorded AFTER the bash_failure -> allow, even with no skill invocation.
  // ---------------------------------------------------------------------------------------------
  {
    const sid = 'sess-8-resolved';
    const out = withState8(
      (db) => {
        insertEvent(db, sid, 'bash_failure', Date.now() - 60_000);
        insertEvent(db, sid, 'verification_pass', Date.now() - 30_000);
      },
      () => RULE8.evaluate(editInput(sid, makeCleanTranscript8(), join(ROOT, 'x.js'))),
    );
    check('COUNTER-RED: a verification_pass after the failure -> allow (resolved)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // COUNTER-RED 6 — end-to-end replay of Task 3's own exemption: `grep -q foo file` exit 1 must
  // record ZERO bash_failure events (Task 3's own COUNTER-RED, replayed here through the real
  // observer), so the edit that follows is never gated at all.
  // ---------------------------------------------------------------------------------------------
  {
    const { runObservers } = await import(POSTTOOLUSE_MODULE);
    const sid = 'sess-8-grep';
    const p = join(s8Work, `state-grep-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      await runObservers({
        session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash',
        tool_input: { command: 'grep -q nothing somefile.txt' }, error: 'Exit code 1', is_interrupt: false,
      }, { logPath: join(s8Work, 'log.jsonl') });
      const out = RULE8.evaluate(editInput(sid, makeCleanTranscript8(), join(ROOT, 'x.js')));
      check('COUNTER-RED: grep exit 1 (answer-exit exemption) records no bash_failure -> edit allowed', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // RED — a REAL (non-exempt) failure, e.g. npm install, DOES gate the following edit — the
  // positive end-to-end path, mirroring COUNTER-RED 6 above.
  // ---------------------------------------------------------------------------------------------
  {
    const { runObservers } = await import(POSTTOOLUSE_MODULE);
    const sid = 'sess-8-npmfail';
    const p = join(s8Work, `state-npm-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      await runObservers({
        session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash',
        tool_input: { command: 'npm install' }, error: 'Exit code 1\nnpm ERR! something broke', is_interrupt: false,
      }, { logPath: join(s8Work, 'log.jsonl') });
      const out = RULE8.evaluate(editInput(sid, makeCleanTranscript8(), join(ROOT, 'x.js')));
      check('RED: npm install exit 1 -> the following edit IS blocked', out.decision === 'block', `out=${JSON.stringify(out)}`);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Editing a DIFFERENT file than the failure concerned is still judged on the failure, not the
  // path — this rule reads no file_path at all. Same seed, an unrelated file_path, same (blocked)
  // outcome.
  // ---------------------------------------------------------------------------------------------
  {
    const sid = 'sess-8-diffpath';
    const t = makeCleanTranscript8();
    const outA = withState8(
      (db) => insertEvent(db, sid, 'bash_failure', Date.now() - 60_000),
      () => RULE8.evaluate(editInput(sid, t, join(ROOT, 'unrelated-file.py'))),
    );
    check('editing a DIFFERENT file than the failure -> still judged on the failure -> BLOCK', outA.decision === 'block', `out=${JSON.stringify(outA)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // Fail-open: not an Edit/Write -> allow without touching state at all.
  // ---------------------------------------------------------------------------------------------
  {
    const out = RULE8.evaluate({ tool_name: 'Bash', session_id: 'sess-8-notedit', tool_input: { command: 'ls' } });
    check('not an Edit/Write -> allow', out.decision === 'allow', `out=${JSON.stringify(out)}`);
  }

  // ---------------------------------------------------------------------------------------------
  // Fail-open: enforcement state unreadable (parent path is itself a FILE, so mkdirSync(dirname())
  // throws inside openState()) -> allow, never a throw.
  // ---------------------------------------------------------------------------------------------
  {
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    const blockerFile = join(s8Work, 'blocker-file');
    writeFileSync(blockerFile, 'x', 'utf8');
    process.env.ENFORCEMENT_STATE_PATH = join(blockerFile, 'sub', 'state.sqlite');
    try {
      const out = RULE8.evaluate(editInput('sess-8-unreadable', makeCleanTranscript8(), join(ROOT, 'x.js')));
      check('enforcement state unreadable -> allow, never throws', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }
}

// =================================================================================================
// SECTION 9 — scripts/hooks/lib/skill-invoked.mjs's SUBAGENT FIX (coordinator review, fix round 1
// on Task 8): a dispatched subagent's own Skill tool_use invocations live only in its own sidechain
// transcript file (…/<sessionDir>/<sessionId>/subagents/agent-<agentId>.jsonl), never merged into
// the top-level session's own transcript_path. Measured live (this task's own instrumented capture
// of a real PreToolUse payload fired from inside a real dispatched subagent): the payload carries
// `agent_id` alongside `transcript_path`, and the sidechain path is fully predictable from those two
// fields alone. `resolveActorTranscriptPath()`/`skillInvokedSince()`'s new `agentId` parameter are
// the shared fix — both `brainstorm-before-creative.mjs` (Task 7, already committed and live before
// this fix) and `debugging-before-fix-edit.mjs` (Task 8) now pass `input.agent_id` through to it.
// Every case here runs against fixture files built to the REAL measured on-disk shape, never this
// session's own real transcript/store.
// =================================================================================================
{
  const s9Work = tempDir('hooks-groupb-subagent-transcript-');
  const SKILLINV9 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'skill-invoked.mjs')).href);

  function makeSkillLine(atMs, skill) {
    return JSON.stringify({
      type: 'assistant',
      timestamp: new Date(atMs).toISOString(),
      message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] },
    });
  }
  function makeTextLine(atMs, text) {
    return JSON.stringify({
      type: 'user',
      timestamp: new Date(atMs).toISOString(),
      message: { content: [{ type: 'text', text }] },
    });
  }

  // -----------------------------------------------------------------------------------------------
  // resolveActorTranscriptPath() — pure path computation, no I/O, no existsSync gate of its own.
  // -----------------------------------------------------------------------------------------------
  {
    const mainPath = join(s9Work, 'sess-abc.jsonl');
    const withAgent = SKILLINV9.resolveActorTranscriptPath(mainPath, 'agentXYZ');
    const expected = join(s9Work, 'sess-abc', 'subagents', 'agent-agentXYZ.jsonl');
    check('resolveActorTranscriptPath: agentId given -> sidechain path, exact structure',
      withAgent === expected, `got=${withAgent} expected=${expected}`);

    check('resolveActorTranscriptPath: no agentId (undefined) -> transcriptPath unchanged',
      SKILLINV9.resolveActorTranscriptPath(mainPath, undefined) === mainPath);
    check('resolveActorTranscriptPath: agentId null -> transcriptPath unchanged',
      SKILLINV9.resolveActorTranscriptPath(mainPath, null) === mainPath);
    check('resolveActorTranscriptPath: agentId empty string -> transcriptPath unchanged',
      SKILLINV9.resolveActorTranscriptPath(mainPath, '') === mainPath);
    check('resolveActorTranscriptPath: non-string transcriptPath -> returned as-is, never throws',
      SKILLINV9.resolveActorTranscriptPath(undefined, 'agentXYZ') === undefined);
  }

  // -----------------------------------------------------------------------------------------------
  // RED (the actual defect this round fixes) — a subagent's own invocation lives ONLY in its
  // sidechain file; the main transcript has NO invocation at all. Passing agentId now finds it.
  // -----------------------------------------------------------------------------------------------
  {
    const mainPath = join(s9Work, 'sess-sub1.jsonl');
    writeFileSync(mainPath, [
      makeTextLine(Date.now() - 60_000, 'ordinary orchestrator turn, no skill here'),
    ].join('\n') + '\n', 'utf8');

    const sidechainDir = join(s9Work, 'sess-sub1', 'subagents');
    mkdirSync(sidechainDir, { recursive: true });
    const sidechainPath = join(sidechainDir, 'agent-sub1.jsonl');
    writeFileSync(sidechainPath, [
      makeSkillLine(Date.now() - 30_000, 'superpowers:systematic-debugging'),
    ].join('\n') + '\n', 'utf8');

    const withoutAgentId = SKILLINV9.skillInvokedSince(mainPath, /systematic-debugging/, 20 * 60 * 1000, Date.now());
    check('COUNTER (pre-fix behaviour, still correct): reading the main transcript with NO agentId finds nothing',
      withoutAgentId.determined === true && withoutAgentId.invoked === false, `got=${JSON.stringify(withoutAgentId)}`);

    const withAgentId = SKILLINV9.skillInvokedSince(mainPath, /systematic-debugging/, 20 * 60 * 1000, Date.now(), 'sub1');
    check('RED (the fix): the SAME call with agentId reads the sidechain file and finds the invocation',
      withAgentId.determined === true && withAgentId.invoked === true, `got=${JSON.stringify(withAgentId)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED — a main-session actor (no agent_id at all — the ordinary top-level interactive
  // case) whose invocation IS directly in transcript_path still clears, unchanged from before this
  // fix. Regression guard: the fix must not break the case that already worked.
  // -----------------------------------------------------------------------------------------------
  {
    const mainPath = join(s9Work, 'sess-toplevel.jsonl');
    writeFileSync(mainPath, [
      makeSkillLine(Date.now() - 30_000, 'superpowers:systematic-debugging'),
    ].join('\n') + '\n', 'utf8');
    const result = SKILLINV9.skillInvokedSince(mainPath, /systematic-debugging/, 20 * 60 * 1000, Date.now(), undefined);
    check('COUNTER-RED: main-session actor (no agentId), invocation directly in transcript_path -> still clears',
      result.determined === true && result.invoked === true, `got=${JSON.stringify(result)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // COUNTER-RED — case-3 fail-open, achieved for free: agentId given, but the predicted sidechain
  // file does NOT exist on disk (e.g. race at the very first tool call). Must resolve to
  // determined:false — NEVER silently fall back to reading the main transcript (that would read a
  // DIFFERENT actor's evidence as if it were this actor's own).
  // -----------------------------------------------------------------------------------------------
  {
    const mainPath = join(s9Work, 'sess-nosidechain.jsonl');
    writeFileSync(mainPath, [
      makeSkillLine(Date.now() - 30_000, 'superpowers:systematic-debugging'),
    ].join('\n') + '\n', 'utf8');
    // Deliberately NOT creating sess-nosidechain/subagents/agent-ghost.jsonl.
    const result = SKILLINV9.skillInvokedSince(mainPath, /systematic-debugging/, 20 * 60 * 1000, Date.now(), 'ghost');
    check('COUNTER-RED (fail-open, case 3): agentId given but sidechain file missing -> determined:false, never a silent fallback to the main transcript',
      result.determined === false, `got=${JSON.stringify(result)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // End-to-end through BOTH real rules — the actual defect the coordinator found live, reproduced
  // deterministically here instead of relying on a real subagent's own transcript.
  // -----------------------------------------------------------------------------------------------
  {
    const RULE8b = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'debugging-before-fix-edit.mjs')).href);
    const ES9 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);

    const mainPath = join(s9Work, 'sess-e2e-debug.jsonl');
    writeFileSync(mainPath, [
      makeTextLine(Date.now() - 60_000, 'orchestrator turn, no skill invocation here'),
    ].join('\n') + '\n', 'utf8');
    const sidechainDir = join(s9Work, 'sess-e2e-debug', 'subagents');
    mkdirSync(sidechainDir, { recursive: true });

    const sid = 'sess-e2e-debug';
    const statePath = join(s9Work, 'state-e2e-debug.sqlite');
    const prevState = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = statePath;
    try {
      const db = ES9.openState(statePath);
      db.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
        .run(sid, 'bash_failure', Date.now() - 60_000, null);
      db.close();

      // Without agent_id (as if this were the pre-fix behaviour) — since the failure IS recent and
      // the main transcript has no invocation at all, this still blocks even with a valid escape
      // sitting in a sidechain file the rule was never told to look at.
      const outNoAgent = RULE8b.evaluate({
        tool_name: 'Edit', session_id: sid, transcript_path: mainPath,
        tool_input: { file_path: join(ROOT, 'x.js') },
      });
      check('E2E pre-fix-shape sanity: no agent_id, escape only in sidechain -> still blocks (proves the fixture is real)',
        outNoAgent.decision === 'block', `out=${JSON.stringify(outNoAgent)}`);

      // The escape is written to the SIDECHAIN file, dated after the failure — exactly the real
      // shape a dispatched subagent produces.
      writeFileSync(join(sidechainDir, 'agent-sub9.jsonl'), [
        makeSkillLine(Date.now() - 30_000, 'superpowers:systematic-debugging'),
      ].join('\n') + '\n', 'utf8');

      const outWithAgent = RULE8b.evaluate({
        tool_name: 'Edit', session_id: sid, transcript_path: mainPath, agent_id: 'sub9',
        tool_input: { file_path: join(ROOT, 'x.js') },
      });
      check('E2E FIX: debugging-before-fix-edit.mjs with agent_id set now finds the escape in the sidechain file -> allow',
        outWithAgent.decision === 'allow', `out=${JSON.stringify(outWithAgent)}`);
    } finally {
      if (prevState === undefined) delete process.env.ENFORCEMENT_STATE_PATH; else process.env.ENFORCEMENT_STATE_PATH = prevState;
    }
  }

  // brainstorm-before-creative.mjs — same shared fix, Branch B (new source file). Reuses the
  // ALREADY-IMPORTED RULE7 and its already-locked-in FIXED_SDD_DIR/FIXED_SPECS_DIR from Section 7 —
  // NOT a fresh import with a fresh env override, because brainstorm-before-creative.mjs is a
  // module ESM already caches by resolved URL: a second `import()` of the exact same file returns
  // the SAME instance, whose session-state.mjs import already locked SDD_DIR/SPECS_DIR to Section
  // 7's directories the first time it was imported. Re-setting the env vars here would silently do
  // nothing (the same trap Section 7's own header comment documents) — this was caught live by this
  // very test failing against a fresh (but ineffective) redirect attempt before this fix.
  {
    // An active arc + governing spec + a register with NO matching row is required for Branch B to
    // actually BLOCK rather than degrade-to-allow on "no active arc" — mirrors Section 7's own
    // Branch B setup exactly (setLedgerPresent/setGoverningSpec), reusing the SAME fixture
    // directories Section 7's own import of RULE7 already locked in.
    const e2eArcDir = join(FIXED_SDD_DIR, '2026-08-08-e2e-fixture-arc');
    mkdirSync(e2eArcDir, { recursive: true });
    writeFileSync(join(e2eArcDir, 'progress.md'), 'plan: docs/superpowers/plans/e2e-fixture.md\n', 'utf8');
    // governingSpecFile() picks the newest-modified .md under FIXED_SPECS_DIR — clear any spec left
    // behind by a prior Section 7 case before adding this section's own, so the "newest" one really
    // is this one.
    for (const f of readdirSync(FIXED_SPECS_DIR)) rmSync(join(FIXED_SPECS_DIR, f), { force: true });
    writeFileSync(join(FIXED_SPECS_DIR, '2026-08-08-e2e-governing-spec.md'), '# spec\n', 'utf8');
    const e2eRegisterPath = join(s9Work, 'e2e-roadmap.md');
    writeFileSync(e2eRegisterPath, [
      '## מרשם האישורים — מפרטים שאושרו על-ידי הבעלים',
      '',
      '| מפרט | סטטוס | הראיה |',
      '|---|---|---|',
      '',
    ].join('\n'), 'utf8'); // deliberately zero rows — the governing spec has no register row at all

    const mainPath = join(s9Work, 'sess-e2e-brainstorm.jsonl');
    writeFileSync(mainPath, [
      makeTextLine(Date.now() - 60_000, 'orchestrator turn, no skill invocation here'),
    ].join('\n') + '\n', 'utf8');
    const sidechainDir = join(s9Work, 'sess-e2e-brainstorm', 'subagents');
    mkdirSync(sidechainDir, { recursive: true });
    writeFileSync(join(sidechainDir, 'agent-sub10.jsonl'), [
      makeSkillLine(Date.now() - 5_000, 'superpowers:brainstorming'),
    ].join('\n') + '\n', 'utf8');

    const newSrcPath = join(s9Work, 'src', 'e2e-new-module.mjs');
    const prevRoadmap = process.env.ROADMAP;
    process.env.ROADMAP = e2eRegisterPath;
    try {
      const outNoAgent = RULE7.evaluate({
        tool_name: 'Write', session_id: 'S', transcript_path: mainPath,
        tool_input: { file_path: newSrcPath, content: 'x=1' },
      });
      check('E2E pre-fix-shape sanity (brainstorm rule): no agent_id, escape only in sidechain -> still blocks',
        outNoAgent.decision === 'block', `out=${JSON.stringify(outNoAgent)}`);

      const outWithAgent = RULE7.evaluate({
        tool_name: 'Write', session_id: 'S', transcript_path: mainPath, agent_id: 'sub10',
        tool_input: { file_path: newSrcPath, content: 'x=1' },
      });
      check('E2E FIX (brainstorm rule): with agent_id set, the sidechain brainstorming invocation now clears it -> allow',
        outWithAgent.decision === 'allow', `out=${JSON.stringify(outWithAgent)}`);
    } finally {
      if (prevRoadmap === undefined) delete process.env.ROADMAP; else process.env.ROADMAP = prevRoadmap;
    }
  }
}

// =================================================================================================
// SECTION 9 — scripts/hooks/stop.mjs + scripts/hooks/lib/claim-scan.mjs +
// scripts/hooks/stop-rules/verify-before-success-claim.mjs (task-9-brief.md, §6.4 trigger 3:
// verification before a success claim). Every case here runs against a TEMP rules directory and a
// CLEAN SYNTHETIC transcript — never this session's own real transcript, same discipline as
// Section 8.
// =================================================================================================
{
  const s9Work = tempDir('hooks-groupb-stopclaim-');
  const STOP_CLI = join(ROOT, 'scripts', 'hooks', 'stop.mjs');
  const STOP_MODULE = pathToFileURL(STOP_CLI).href;
  const CLAIM_SCAN = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'claim-scan.mjs')).href);
  const REAL_STOP_RULE_PATH = join(ROOT, 'scripts', 'hooks', 'stop-rules', 'verify-before-success-claim.mjs');
  const STOP_RULE = await import(pathToFileURL(REAL_STOP_RULE_PATH).href);

  function runStopCli({ stdin, rulesDir, logPath, env: extraEnv }) {
    const env = { ...process.env, ...(extraEnv || {}) };
    if (rulesDir) env.STOP_RULES_DIR = rulesDir;
    if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
    return spawnSync(process.execPath, [STOP_CLI], {
      input: stdin,
      encoding: 'utf8',
      env,
      cwd: ROOT,
      timeout: 15000,
    });
  }

  function writeStopRule(dir, filename, body) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), body, 'utf8');
  }

  // Builds a fixture transcript .jsonl, the real measured shape — one entry per `entries` item:
  // { atMs, text } (an assistant turn with a single text content block) or
  // { atMs, skill } (an assistant turn with a Skill tool_use — for the escape path).
  function makeAssistantTranscript(entries) {
    const path = join(s9Work, `transcript-${Math.random().toString(36).slice(2)}.jsonl`);
    const lines = entries.map((e) => JSON.stringify({
      type: 'assistant',
      timestamp: new Date(e.atMs).toISOString(),
      message: {
        content: [
          e.skill !== undefined
            ? { type: 'tool_use', name: 'Skill', input: { skill: e.skill } }
            : { type: 'text', text: e.text },
        ],
      },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  // -----------------------------------------------------------------------------------------------
  // Unit level — claim-scan.mjs's own detectors, isolated from the rule/CLI. This is what proves
  // the regexes themselves are precise, independent of how the rule/CLI wire them together.
  // -----------------------------------------------------------------------------------------------
  {
    check('detectsSuccessClaim: Hebrew "הכל עובד, סיימתי" (statement) -> true',
      CLAIM_SCAN.detectsSuccessClaim('הכל עובד, סיימתי'));
    check('detectsSuccessClaim: Hebrew "בוצע." (statement) -> true',
      CLAIM_SCAN.detectsSuccessClaim('הבדיקה בוצע.'));
    check('detectsSuccessClaim: Hebrew "הכל ירוק" -> true',
      CLAIM_SCAN.detectsSuccessClaim('הרצתי את הבדיקות, הכל ירוק'));
    check('detectsSuccessClaim: English "all tests passing" -> true',
      CLAIM_SCAN.detectsSuccessClaim('I ran the suite, all tests passing now.'));
    check('detectsSuccessClaim: English "it works" -> true',
      CLAIM_SCAN.detectsSuccessClaim('I tried it again and it works.'));
    check('detectsSuccessClaim: English "task complete" -> true',
      CLAIM_SCAN.detectsSuccessClaim('The task is complete.'));

    // COUNTER-RED: NOT claims — the entire point of requirement 1 in the brief.
    check('COUNTER: question "האם זה עובד אצלך?" -> false (a question, not a claim)',
      !CLAIM_SCAN.detectsSuccessClaim('האם זה עובד אצלך?'));
    check('COUNTER: question "is this done yet?" -> false (question exclusion, tracked word "done")',
      !CLAIM_SCAN.detectsSuccessClaim('is this done yet?'));
    check('COUNTER: UI-colour sentence, "green" bare (not "all green") is not a tracked token -> false',
      !CLAIM_SCAN.detectsSuccessClaim('the button turns a nice shade of green'));
    check('COUNTER: Hebrew sentence about vegetables, no claim word -> false',
      !CLAIM_SCAN.detectsSuccessClaim('הוספתי עגבניות וחסה לסלט'));
    check('COUNTER: commit message quoting an earlier claim inside quotes -> false '
      + '(the quote mark breaks the required claim-word boundary)',
      !CLAIM_SCAN.detectsSuccessClaim('did you say it "works" already?'));
    check('COUNTER: no claim at all -> false',
      !CLAIM_SCAN.detectsSuccessClaim('let me look at the next file'));
    check('COUNTER: empty/non-string -> false', !CLAIM_SCAN.detectsSuccessClaim('') && !CLAIM_SCAN.detectsSuccessClaim(undefined));

    // ---------------------------------------------------------------------------------------------
    // FIX ROUND 2, item (A) — claim SHAPE, not claim WORD, for done/fixed/works. Every one of these
    // is the coordinator's OWN named example, or a direct variant of it; all must now be false.
    // ---------------------------------------------------------------------------------------------
    check('FIX-R2 COUNTER: "the fixed version" (attributive, not a claim) -> false '
      + '(this is the exact real reply that false-fired in round 1)',
      !CLAIM_SCAN.detectsSuccessClaim('Good, restore confirmed (matches the fixed version).'));
    check('FIX-R2 COUNTER: "once that is done" (subordinate clause) -> false',
      !CLAIM_SCAN.detectsSuccessClaim('Let\'s continue once that is done.'));
    check('FIX-R2 COUNTER: "how it works" (mechanism, not confirmation) -> false',
      !CLAIM_SCAN.detectsSuccessClaim('Let me explain how it works internally.'));
    check('FIX-R2 COUNTER: "the fixed implementation" (attributive) -> false',
      !CLAIM_SCAN.detectsSuccessClaim('running my actual real reply texts through the fixed implementation programmatically'));
    check('FIX-R2 COUNTER: "if it works" (subordinate) -> false',
      !CLAIM_SCAN.detectsSuccessClaim('If it works, we can ship it.'));
    check('FIX-R2 COUNTER: "once the tests are passing" (subordinate, BROAD word too) -> false',
      !CLAIM_SCAN.detectsSuccessClaim('Once the tests are passing, we can ship.'));
    check('FIX-R2 GREEN: "it works" (predicate shape) -> STILL true',
      CLAIM_SCAN.detectsSuccessClaim('I tried it again and it works.'));
    check('FIX-R2 GREEN: "it works now" -> true', CLAIM_SCAN.detectsSuccessClaim('it works now'));
    check('FIX-R2 GREEN: "I\'m done" (predicate) -> true', CLAIM_SCAN.detectsSuccessClaim("I'm done."));
    check('FIX-R2 GREEN: "all done" (predicate) -> true', CLAIM_SCAN.detectsSuccessClaim('All done.'));
    check('FIX-R2 GREEN: "I fixed it" (first-person) -> true', CLAIM_SCAN.detectsSuccessClaim('I fixed it.'));
    check('FIX-R2 GREEN: "we fixed the bug" -> true', CLAIM_SCAN.detectsSuccessClaim('We fixed the bug.'));
    check('FIX-R2 GREEN: standalone "Done." -> true', CLAIM_SCAN.detectsSuccessClaim('Done.'));
    check('FIX-R2 GREEN: trailing subordinate clause does NOT void a preceding claim -> true',
      CLAIM_SCAN.detectsSuccessClaim("It's done, once you verify it."));

    check('containsQuotedEvidence: fenced block -> true',
      CLAIM_SCAN.containsQuotedEvidence('here you go:\n```\n12 passed\n```'));
    check('containsQuotedEvidence: "exit code 0" -> true',
      CLAIM_SCAN.containsQuotedEvidence('ran it, exit code 0'));
    check('containsQuotedEvidence: "42 passed" -> true',
      CLAIM_SCAN.containsQuotedEvidence('suite output: 42 passed, 0 failed'));
    check('containsQuotedEvidence: bare PASS -> true',
      CLAIM_SCAN.containsQuotedEvidence('PASS  the check'));
    check('containsQuotedEvidence: no evidence -> false',
      !CLAIM_SCAN.containsQuotedEvidence('it works now, trust me'));
    check('FIX-R2 containsQuotedEvidence: "exit 0" (no "code") -> true (this project\'s own real phrasing)',
      CLAIM_SCAN.containsQuotedEvidence('GREEN confirmed, 333/333, exit 0.'));
    check('FIX-R2 containsQuotedEvidence: "333/333 checks passed" (words between digit and "passed") -> true',
      CLAIM_SCAN.containsQuotedEvidence('333/333 checks passed, exit 0.'));

    // FIX ROUND 2, item (A) — the evidence window itself: a real fixture transcript with evidence in
    // an EARLIER assistant turn and a bare claim ("All GREEN.") in the newest turn, nothing else.
    {
      const evidenceEarlier = makeAssistantTranscript([
        { atMs: Date.now() - 4 * 60_000, text: 'GREEN confirmed, 336/336, exit 0.' },
        { atMs: Date.now() - 5_000, text: 'All GREEN.' },
      ]);
      const lastTurn = CLAIM_SCAN.lastAssistantText(evidenceEarlier);
      check('FIX-R2 recentEvidencePresent: last turn ALONE has no evidence', !CLAIM_SCAN.containsQuotedEvidence(lastTurn.text), `text=${lastTurn.text}`);
      check('FIX-R2 recentEvidencePresent: last turn ALONE still claims (all green)', CLAIM_SCAN.detectsSuccessClaim(lastTurn.text));
      check('FIX-R2 recentEvidencePresent: widened window finds the EARLIER turn\'s evidence -> true',
        CLAIM_SCAN.recentEvidencePresent(evidenceEarlier, CLAIM_SCAN.EVIDENCE_WINDOW_MS, Date.now()));

      const evidenceTooOld = makeAssistantTranscript([
        { atMs: Date.now() - 20 * 60_000, text: 'GREEN confirmed, 336/336, exit 0.' }, // 20min > 10min window
        { atMs: Date.now() - 5_000, text: 'All GREEN.' },
      ]);
      check('FIX-R2 recentEvidencePresent: evidence OUTSIDE the 10-minute window -> false (staleness respected)',
        !CLAIM_SCAN.recentEvidencePresent(evidenceTooOld, CLAIM_SCAN.EVIDENCE_WINDOW_MS, Date.now()));
    }

    check('detectsLiveClaim: Hebrew "עלה לאוויר" -> true', CLAIM_SCAN.detectsLiveClaim('הגרסה עלה לאוויר'));
    check('detectsLiveClaim: English "is live" -> true', CLAIM_SCAN.detectsLiveClaim('the new version is live'));
    check('detectsLiveClaim: unrelated text -> false', !CLAIM_SCAN.detectsLiveClaim('let me check the plan'));

    const unreadable = CLAIM_SCAN.lastAssistantText(join(s9Work, 'does-not-exist.jsonl'));
    check('lastAssistantText: nonexistent transcript -> determined:false', unreadable.determined === false);

    const t = makeAssistantTranscript([{ atMs: Date.now() - 5000, text: 'הכל עובד, סיימתי' }]);
    const read = CLAIM_SCAN.lastAssistantText(t);
    check('lastAssistantText: real fixture -> determined:true, text matches', read.determined === true && read.text === 'הכל עובד, סיימתי', `read=${JSON.stringify(read)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // Rule level (direct import, like Section 8) — verify-before-success-claim.mjs's evaluate().
  // -----------------------------------------------------------------------------------------------
  {
    const NONEXISTENT = join(s9Work, 'nope.jsonl');

    // RED — a success claim, no evidence, no skill invocation, clean transcript -> BLOCK.
    const cleanClaimTranscript = makeAssistantTranscript([
      { atMs: Date.now() - 50_000, text: 'reading the file now' },
      { atMs: Date.now() - 5_000, text: 'הכל עובד, סיימתי' },
    ]);
    const redOut = STOP_RULE.evaluate({ transcript_path: cleanClaimTranscript });
    check('RED verify-before-success-claim: claim, no evidence, no skill -> BLOCK', redOut.decision === 'block', `out=${JSON.stringify(redOut)}`);
    check('RED verify-before-success-claim: reason names verification-before-completion',
      /verification-before-completion/.test(redOut.reason), `reason=${redOut.reason}`);
    check('RED verify-before-success-claim: reason quotes the claim snippet',
      /עובד/.test(redOut.reason), `reason=${redOut.reason}`);

    // GREEN (evidence path) — same claim, but WITH a fenced pasted-output block -> ALLOW.
    const evidenceTranscript = makeAssistantTranscript([
      { atMs: Date.now() - 5_000, text: 'הכל עובד — הנה הפלט:\n```\n12 passed\n```' },
    ]);
    const evOut = STOP_RULE.evaluate({ transcript_path: evidenceTranscript });
    check('GREEN verify-before-success-claim: claim WITH pasted evidence -> ALLOW', evOut.decision === 'allow', `out=${JSON.stringify(evOut)}`);

    // GREEN (skill-escape path) — claim present, no evidence, but verification-before-completion
    // was invoked in the transcript AFTER the earlier turns and before now.
    const skillEscapeTranscript = makeAssistantTranscript([
      { atMs: Date.now() - 40_000, skill: 'superpowers:verification-before-completion' },
      { atMs: Date.now() - 5_000, text: 'הכל עובד, סיימתי' },
    ]);
    const skillOut = STOP_RULE.evaluate({ transcript_path: skillEscapeTranscript });
    check('GREEN verify-before-success-claim: claim, no evidence, but skill invoked recently -> ALLOW', skillOut.decision === 'allow', `out=${JSON.stringify(skillOut)}`);

    // COUNTER-RED — a question, not a claim -> ALLOW, no block, reason does not claim a block.
    const questionTranscript = makeAssistantTranscript([{ atMs: Date.now() - 5_000, text: 'האם זה עובד אצלך?' }]);
    const qOut = STOP_RULE.evaluate({ transcript_path: questionTranscript });
    check('COUNTER-RED verify-before-success-claim: a question -> ALLOW (not a claim)', qOut.decision === 'allow', `out=${JSON.stringify(qOut)}`);

    // ---------------------------------------------------------------------------------------------
    // FIX ROUND 2 — the two real false positives, reproduced at the RULE level and proven fixed.
    // ---------------------------------------------------------------------------------------------
    // (1) evidence pasted in an EARLIER turn, bare claim in the newest turn -> now ALLOW.
    const widenedEvidenceTranscript = makeAssistantTranscript([
      { atMs: Date.now() - 4 * 60_000, text: 'GREEN confirmed, 336/336, exit 0.' },
      { atMs: Date.now() - 5_000, text: 'All GREEN.' },
    ]);
    const widenedOut = STOP_RULE.evaluate({ transcript_path: widenedEvidenceTranscript });
    check('FIX-R2 verify-before-success-claim: bare claim, evidence in an EARLIER turn -> ALLOW (was BLOCK before round 2)',
      widenedOut.decision === 'allow', `out=${JSON.stringify(widenedOut)}`);

    // (2) evidence too far back (outside the 10-minute window) -> still BLOCKS (staleness respected,
    // not a blanket "ever pasted evidence this session" pass).
    const staleEvidenceTranscript = makeAssistantTranscript([
      { atMs: Date.now() - 20 * 60_000, text: 'GREEN confirmed, 336/336, exit 0.' },
      { atMs: Date.now() - 5_000, text: 'All GREEN.' },
    ]);
    const staleOut = STOP_RULE.evaluate({ transcript_path: staleEvidenceTranscript });
    check('FIX-R2 verify-before-success-claim: bare claim, evidence OUTSIDE the 10-minute window -> still BLOCK',
      staleOut.decision === 'block', `out=${JSON.stringify(staleOut)}`);

    // (3) the real false-fire text from round 1 — "fixed" used attributively -> now ALLOW (no claim
    // detected at all, never reaches the evidence/skill check).
    const attributiveFixedTranscript = makeAssistantTranscript([
      { atMs: Date.now() - 5_000, text: "Good, restore confirmed (matches the fixed version). Now let's check subagentstop.mjs." },
    ]);
    const attributiveOut = STOP_RULE.evaluate({ transcript_path: attributiveFixedTranscript });
    check('FIX-R2 verify-before-success-claim: "the fixed version" (attributive) -> ALLOW (was BLOCK before round 2)',
      attributiveOut.decision === 'allow', `out=${JSON.stringify(attributiveOut)}`);
    check('FIX-R2 verify-before-success-claim: "the fixed version" reason states no claim, not a degradation/evidence excuse',
      /no success-claim/i.test(attributiveOut.reason), `reason=${attributiveOut.reason}`);

    // COUNTER-RED — no claim at all -> ALLOW.
    const noClaimTranscript = makeAssistantTranscript([{ atMs: Date.now() - 5_000, text: 'let me check the next file' }]);
    const ncOut = STOP_RULE.evaluate({ transcript_path: noClaimTranscript });
    check('COUNTER-RED verify-before-success-claim: no claim -> ALLOW', ncOut.decision === 'allow', `out=${JSON.stringify(ncOut)}`);

    // COUNTER-RED — unreadable transcript -> ALLOW (degraded), never a crash.
    const unreadableOut = STOP_RULE.evaluate({ transcript_path: NONEXISTENT });
    check('COUNTER-RED verify-before-success-claim: unreadable transcript -> ALLOW (degraded)', unreadableOut.decision === 'allow', `out=${JSON.stringify(unreadableOut)}`);
    check('COUNTER-RED verify-before-success-claim: degraded reason names the degradation', /degrad/i.test(unreadableOut.reason), `reason=${unreadableOut.reason}`);

    // Missing input entirely -> ALLOW, never a throw.
    const noInputOut = STOP_RULE.evaluate(undefined);
    check('verify-before-success-claim: undefined input -> ALLOW, no throw', noInputOut.decision === 'allow', `out=${JSON.stringify(noInputOut)}`);
  }

  // -----------------------------------------------------------------------------------------------
  // CLI level — scripts/hooks/stop.mjs itself: the loop guard, the exit-0-triad on a throwing rule,
  // and the real end-to-end path through STOP_RULES_DIR pointed at the REAL rule file.
  // -----------------------------------------------------------------------------------------------
  {
    // RED — a stop-rule that throws -> stdout {} + exit 0 + a rule_threw record logged (same triad
    // Task 1 proved for observers).
    const throwRulesDir = join(s9Work, 'throw-rules');
    writeStopRule(throwRulesDir, 'boom.mjs', "export function evaluate() { throw new Error('boom'); }\n");
    const logPath1 = join(s9Work, 'log1.jsonl');
    const r1 = runStopCli({ stdin: '{}', rulesDir: throwRulesDir, logPath: logPath1 });
    check('RED stop.mjs: throwing rule -> exit 0', r1.status === 0, `status=${r1.status} stderr=${r1.stderr}`);
    check('RED stop.mjs: throwing rule -> stdout is {}', r1.stdout.trim() === '{}', `stdout=${r1.stdout}`);
    const logged1 = readJsonl(logPath1);
    check('RED stop.mjs: throwing rule -> rule_threw logged', logged1.some((e) => e.kind === 'rule_threw'), `log=${JSON.stringify(logged1)}`);

    // RED — the loop guard: stop_hook_active:true, with a rule seeded that WOULD block, must still
    // resolve to {} — the guard fires before the pipeline is ever run.
    const blockRulesDir = join(s9Work, 'block-rules');
    writeStopRule(blockRulesDir, 'always-block.mjs', "export function evaluate() { return { decision: 'block', reason: 'should never be seen' }; }\n");
    const r2 = runStopCli({ stdin: JSON.stringify({ stop_hook_active: true }), rulesDir: blockRulesDir });
    check('RED stop.mjs: stop_hook_active:true -> {} (loop guard, even with a blocking rule present)',
      r2.status === 0 && r2.stdout.trim() === '{}', `status=${r2.status} stdout=${r2.stdout}`);

    // RED — trigger-3 end to end through the REAL rule directory: assistant text "הכל עובד, סיימתי",
    // no fence, no skill -> stdout JSON has decision:"block" and reason names
    // verification-before-completion.
    const e2eClaimTranscript = makeAssistantTranscript([{ atMs: Date.now() - 5_000, text: 'הכל עובד, סיימתי' }]);
    const r3 = runStopCli({
      stdin: JSON.stringify({ transcript_path: e2eClaimTranscript }),
      rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules'),
    });
    check('RED stop.mjs E2E (real rule dir): trigger-3 claim -> exit 0', r3.status === 0, `status=${r3.status} stderr=${r3.stderr}`);
    let parsed3;
    try { parsed3 = JSON.parse(r3.stdout); } catch { parsed3 = null; }
    check('RED stop.mjs E2E: stdout parses as JSON', parsed3 !== null, `stdout=${r3.stdout}`);
    check('RED stop.mjs E2E: decision is "block"', parsed3 && parsed3.decision === 'block', `stdout=${r3.stdout}`);
    check('RED stop.mjs E2E: reason names verification-before-completion',
      parsed3 && /verification-before-completion/.test(parsed3.reason), `stdout=${r3.stdout}`);

    // ---------------------------------------------------------------------------------------------
    // FIX ROUND 1 (coordinator review): THE test that would have caught the inert-in-production
    // defect. NO env overrides for rulesDir at all — this is the exact invocation shape Claude Code
    // itself uses on a real Stop event: no STOP_RULES_DIR, no PRETOOLUSE_RULES_DIR, nothing. Every
    // OTHER check in this section sets rulesDir explicitly (even when pointing at the "real"
    // directory), which is precisely why the original ship missed that stop.mjs's own default fell
    // through to pipeline.mjs's DEFAULT_RULES_DIR (scripts/hooks/rules — PreToolUse's own
    // directory) instead of scripts/hooks/stop-rules/. logPath IS still overridden here (a
    // production log write is a harmless side effect this test has no reason to leave behind, and
    // overriding it does not touch the rulesDir resolution path under test at all).
    // ---------------------------------------------------------------------------------------------
    {
      const prodClaimTranscript = makeAssistantTranscript([{ atMs: Date.now() - 5_000, text: 'תיקנתי את זה, הכל עובד עכשיו.' }]);
      const prodLogPath = join(s9Work, 'prod-no-override-log.jsonl');
      const rProd = runStopCli({
        stdin: JSON.stringify({ transcript_path: prodClaimTranscript }),
        // rulesDir DELIBERATELY OMITTED — proves the CLI's OWN default, not a test-supplied one.
        logPath: prodLogPath,
      });
      check('PRODUCTION (no rulesDir override) stop.mjs E2E: exit 0', rProd.status === 0, `status=${rProd.status} stderr=${rProd.stderr}`);
      let parsedProd;
      try { parsedProd = JSON.parse(rProd.stdout); } catch { parsedProd = null; }
      check('PRODUCTION (no rulesDir override) stop.mjs E2E: decision is "block" — this is the check '
        + 'that failed before FIX ROUND 1 (it returned allow/{} because stop-rules/ was never loaded)',
        parsedProd && parsedProd.decision === 'block', `stdout=${rProd.stdout}`);
      check('PRODUCTION (no rulesDir override) stop.mjs E2E: reason names verification-before-completion',
        parsedProd && /verification-before-completion/.test(parsedProd.reason), `stdout=${rProd.stdout}`);
    }

    // ---------------------------------------------------------------------------------------------
    // FIX ROUND 2 (coordinator review): the widened-evidence-window case, end to end through the
    // real CLI and the real rule directory — evidence pasted in an earlier turn, bare "All GREEN."
    // in the newest turn, must ALLOW.
    // ---------------------------------------------------------------------------------------------
    {
      const widenedCliTranscript = makeAssistantTranscript([
        { atMs: Date.now() - 4 * 60_000, text: 'GREEN confirmed, 336/336, exit 0.' },
        { atMs: Date.now() - 5_000, text: 'All GREEN.' },
      ]);
      const rWidened = runStopCli({
        stdin: JSON.stringify({ transcript_path: widenedCliTranscript }),
        rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules'),
      });
      check('FIX-R2 stop.mjs E2E: bare claim with evidence in an EARLIER turn -> {} (was a BLOCK before round 2)',
        rWidened.status === 0 && rWidened.stdout.trim() === '{}', `stdout=${rWidened.stdout}`);
    }

    // ---------------------------------------------------------------------------------------------
    // COUNTER-RED table (E2E, real rule dir) — the exact cases the brief names by name.
    // ---------------------------------------------------------------------------------------------
    const evidenceTranscriptCli = makeAssistantTranscript([
      { atMs: Date.now() - 5_000, text: 'הכל עובד — הנה הפלט:\n```\n12 passed\n```' },
    ]);
    const rEvidence = runStopCli({
      stdin: JSON.stringify({ transcript_path: evidenceTranscriptCli }),
      rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules'),
    });
    check('COUNTER-RED stop.mjs E2E: claim WITH fenced evidence -> {}', rEvidence.status === 0 && rEvidence.stdout.trim() === '{}', `stdout=${rEvidence.stdout}`);

    const questionTranscriptCli = makeAssistantTranscript([{ atMs: Date.now() - 5_000, text: 'האם זה עובד אצלך?' }]);
    const rQuestion = runStopCli({
      stdin: JSON.stringify({ transcript_path: questionTranscriptCli }),
      rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules'),
    });
    check('COUNTER-RED stop.mjs E2E: a question -> {}', rQuestion.status === 0 && rQuestion.stdout.trim() === '{}', `stdout=${rQuestion.stdout}`);

    const noClaimTranscriptCli = makeAssistantTranscript([{ atMs: Date.now() - 5_000, text: 'let me look at the next file' }]);
    const rNoClaim = runStopCli({
      stdin: JSON.stringify({ transcript_path: noClaimTranscriptCli }),
      rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules'),
    });
    check('COUNTER-RED stop.mjs E2E: no claim at all -> {}', rNoClaim.status === 0 && rNoClaim.stdout.trim() === '{}', `stdout=${rNoClaim.stdout}`);

    const rUnreadable = runStopCli({
      stdin: JSON.stringify({ transcript_path: join(s9Work, 'does-not-exist-either.jsonl') }),
      rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules'),
    });
    check('COUNTER-RED stop.mjs E2E: unreadable transcript -> {}', rUnreadable.status === 0 && rUnreadable.stdout.trim() === '{}', `stdout=${rUnreadable.stdout}`);

    // Malformed JSON on stdin -> {} (pipeline's own malformed-input path), same as PreToolUse.
    const rMalformed = runStopCli({ stdin: '{ not json', rulesDir: join(ROOT, 'scripts', 'hooks', 'stop-rules') });
    check('stop.mjs: malformed stdin -> exit 0, {}', rMalformed.status === 0 && rMalformed.stdout.trim() === '{}', `stdout=${rMalformed.stdout}`);

    // toStopOutput() unit check (imported directly), the translation table from the brief.
    const STOP_MOD = await import(STOP_MODULE);
    check('toStopOutput: block -> {decision:"block",reason}', JSON.stringify(STOP_MOD.toStopOutput('block', 'x')) === JSON.stringify({ decision: 'block', reason: 'x' }));
    check('toStopOutput: warn -> {systemMessage}', JSON.stringify(STOP_MOD.toStopOutput('warn', 'x')) === JSON.stringify({ systemMessage: 'x' }));
    check('toStopOutput: allow -> {}', JSON.stringify(STOP_MOD.toStopOutput('allow', 'x')) === '{}');
  }
}

// =================================================================================================
// SECTION 10 — scripts/hooks/observers/session-events.mjs + scripts/hooks/stop-rules/
// ui-playwright-before-done.mjs (task-10-brief.md, §10.2: UI touched -> Playwright ran, before
// "בוצע" — warn, never block). Every case runs against a TEMP ENFORCEMENT_STATE_PATH and a CLEAN
// SYNTHETIC transcript — never this session's own real store/transcript, same discipline as
// Sections 4/8/9.
// =================================================================================================
{
  const s10Work = tempDir('hooks-groupb-uiplaywright-');
  const SESSION_EVENTS = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'observers', 'session-events.mjs')).href);
  const EDIT_TRACKER10 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'observers', 'edit-tracker.mjs')).href);
  const ES10 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const RULE10 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'stop-rules', 'ui-playwright-before-done.mjs')).href);
  const STOP_CLI10 = join(ROOT, 'scripts', 'hooks', 'stop.mjs');

  function makeAssistantTranscript10(entries) {
    const path = join(s10Work, `transcript-${Math.random().toString(36).slice(2)}.jsonl`);
    const lines = entries.map((e) => JSON.stringify({
      type: 'assistant',
      timestamp: new Date(e.atMs).toISOString(),
      message: { content: [{ type: 'text', text: e.text }] },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  // Same pattern as Section 4's withState()/Section 9's transcript builder: seeds a fresh temp
  // SQLite store while ENFORCEMENT_STATE_PATH points at it (so the real openState() the module
  // under test calls with no argument reads THIS store), then evaluates, then restores the env var.
  function withState10(seedFn, evalFn = () => undefined) {
    const p = join(s10Work, `state-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      const db = ES10.openState(p);
      seedFn(db, p);
      db.close();
      return evalFn(p);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  function runStopCli10({ stdin, rulesDir, logPath, env: extraEnv }) {
    const env = { ...process.env, ...(extraEnv || {}) };
    if (rulesDir) env.STOP_RULES_DIR = rulesDir;
    if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
    return spawnSync(process.execPath, [STOP_CLI10], {
      input: stdin, encoding: 'utf8', env, cwd: ROOT, timeout: 15000,
    });
  }

  // -----------------------------------------------------------------------------------------------
  // Unit level — session-events.mjs's classifySessionEvent(), pure, no I/O.
  // -----------------------------------------------------------------------------------------------
  {
    check('classifySessionEvent: Bash `npx playwright test` -> playwright_run',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Bash', tool_input: { command: 'npx playwright test' } }) === 'playwright_run');
    check('classifySessionEvent: Bash `pytest` -> null (not playwright)',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Bash', tool_input: { command: 'pytest tests/' } }) === null);
    check('classifySessionEvent: Bash `node scripts/live-smoke.mjs` (no explicit host text) -> live_probe (its own default --url IS the live host)',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Bash', tool_input: { command: 'node scripts/live-smoke.mjs' } }) === 'live_probe');
    check('classifySessionEvent: Bash `curl https://matkonetesh.pages.dev/` -> live_probe',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Bash', tool_input: { command: 'curl -sI https://matkonetesh.pages.dev/' } }) === 'live_probe');
    check('classifySessionEvent: Bash `curl https://example.com/` (not the live host) -> null',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Bash', tool_input: { command: 'curl -sI https://example.com/' } }) === null);
    check('classifySessionEvent: Bash `echo hi` -> null',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Bash', tool_input: { command: 'echo hi' } }) === null);
    check('classifySessionEvent: browser_navigate to matkonetesh.pages.dev -> live_probe',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'mcp__plugin_playwright_playwright__browser_navigate', tool_input: { url: 'https://matkonetesh.pages.dev/' } }) === 'live_probe');
    check('classifySessionEvent: browser_navigate to localhost (not the live host) -> null',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'mcp__plugin_playwright_playwright__browser_navigate', tool_input: { url: 'http://localhost:8123/' } }) === null);
    check('classifySessionEvent: Edit tool -> null (this observer only watches Bash/browser_navigate)',
      SESSION_EVENTS.classifySessionEvent({ tool_name: 'Edit', tool_input: { file_path: 'app.js' } }) === null);
    check('classifySessionEvent: missing/malformed input -> null, never throws',
      SESSION_EVENTS.classifySessionEvent(undefined) === null && SESSION_EVENTS.classifySessionEvent({}) === null);
  }

  // -----------------------------------------------------------------------------------------------
  // Observer level — observe() actually writing to a TEMP store. "Pass or fail, a run is a run":
  // §10.2 asks whether Playwright RAN, not whether it passed — the pass/fail axis is §6.1's job
  // (verification-outcomes.mjs), not this observer's.
  // -----------------------------------------------------------------------------------------------
  {
    withState10((db) => {
      SESSION_EVENTS.observe({
        session_id: 'sess-obs-fail', tool_name: 'Bash',
        tool_input: { command: 'npx playwright test tests/probe.spec.ts' },
        _outcome: { ok: false, exit_code: 1, raw_error: 'Exit code 1' },
      });
    }, (p) => {
      const db = ES10.openState(p);
      const ev = ES10.lastEvent(db, 'sess-obs-fail', 'playwright_run');
      db.close();
      check('observe: a FAILING playwright run still records playwright_run', ev !== null, `ev=${JSON.stringify(ev)}`);
    });

    withState10((db) => {
      SESSION_EVENTS.observe({
        session_id: 'sess-obs-pass', tool_name: 'Bash',
        tool_input: { command: 'npx playwright test' },
        _outcome: { ok: true },
      });
    }, (p) => {
      const db = ES10.openState(p);
      const ev = ES10.lastEvent(db, 'sess-obs-pass', 'playwright_run');
      db.close();
      check('observe: a PASSING playwright run also records playwright_run', ev !== null, `ev=${JSON.stringify(ev)}`);
    });

    withState10((db) => {
      SESSION_EVENTS.observe({
        session_id: 'sess-obs-nav', tool_name: 'mcp__plugin_playwright_playwright__browser_navigate',
        tool_input: { url: 'https://matkonetesh.pages.dev/' },
      });
    }, (p) => {
      const db = ES10.openState(p);
      const ev = ES10.lastEvent(db, 'sess-obs-nav', 'live_probe');
      db.close();
      check('observe: browser_navigate to the live host records live_probe', ev !== null, `ev=${JSON.stringify(ev)}`);
    });

    withState10((db) => {
      SESSION_EVENTS.observe({
        session_id: 'sess-obs-none', tool_name: 'Bash', tool_input: { command: 'echo hi' }, _outcome: { ok: true },
      });
    }, (p) => {
      const db = ES10.openState(p);
      const pw = ES10.lastEvent(db, 'sess-obs-none', 'playwright_run');
      const lp = ES10.lastEvent(db, 'sess-obs-none', 'live_probe');
      db.close();
      check('COUNTER observe: an unrelated Bash command records nothing', pw === null && lp === null);
    });

    check('observe: missing session_id -> no throw (fail-open)', (() => {
      try { SESSION_EVENTS.observe({ tool_name: 'Bash', tool_input: { command: 'npx playwright test' } }); return true; } catch { return false; }
    })());
  }

  // -----------------------------------------------------------------------------------------------
  // Rule level (direct import) — ui-playwright-before-done.mjs's evaluate(). The brief's own
  // RED + COUNTER-RED table, replayed against the REAL edit-tracker.mjs observer for the "non-UI
  // edit" case rather than poking the event kind directly (Section 8's own precedent for this).
  // -----------------------------------------------------------------------------------------------
  {
    const NOW = Date.now();
    const claimTranscript = makeAssistantTranscript10([{ atMs: NOW - 5_000, text: 'עדכנתי את המסך, הכל עובד.' }]);
    const noClaimTranscript = makeAssistantTranscript10([{ atMs: NOW - 5_000, text: 'reading the file now' }]);

    // RED — ui_edit 「now」, NO playwright_run, a claim -> WARN, reason names §10.2 and Playwright.
    {
      const out = withState10(
        (db) => { ES10.recordEvent(db, { sessionId: 'sess-red', kind: 'ui_edit', detail: { filePath: 'app.js' } }); },
        () => RULE10.evaluate({ session_id: 'sess-red', transcript_path: claimTranscript }),
      );
      check('RED ui-playwright-before-done: ui_edit, no playwright_run, claim -> WARN', out.decision === 'warn', `out=${JSON.stringify(out)}`);
      check('RED ui-playwright-before-done: reason names §10.2', out.reason.includes('10.2'), `reason=${out.reason}`);
      check('RED ui-playwright-before-done: reason names Playwright', /Playwright/.test(out.reason), `reason=${out.reason}`);
    }

    // COUNTER-RED 1 — ui_edit, THEN a NEWER playwright_run, then a claim -> ALLOW (the run already
    // happened; nagging here would be exactly the "block the honest case" mistake).
    {
      const out = withState10(
        (db) => {
          ES10.recordEvent(db, { sessionId: 'sess-c1', kind: 'ui_edit', detail: {} });
          ES10.recordEvent(db, { sessionId: 'sess-c1', kind: 'playwright_run', detail: {} });
        },
        () => RULE10.evaluate({ session_id: 'sess-c1', transcript_path: claimTranscript }),
      );
      check('COUNTER-RED 1: ui_edit then NEWER playwright_run, claim -> ALLOW', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // COUNTER-RED 2 — a claim, but NO ui_edit this session at all -> ALLOW.
    {
      const out = withState10(
        () => { /* nothing recorded for this session */ },
        () => RULE10.evaluate({ session_id: 'sess-c2', transcript_path: claimTranscript }),
      );
      check('COUNTER-RED 2: claim, no ui_edit at all -> ALLOW', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // COUNTER-RED 3 — a ui_edit, but the reply makes NO claim -> ALLOW — editing is not asserting,
    // and §11a forbids running the suite casually, so this must never nag someone mid-edit.
    {
      const out = withState10(
        (db) => { ES10.recordEvent(db, { sessionId: 'sess-c3', kind: 'ui_edit', detail: {} }); },
        () => RULE10.evaluate({ session_id: 'sess-c3', transcript_path: noClaimTranscript }),
      );
      check('COUNTER-RED 3: ui_edit but no claim -> ALLOW (editing is not asserting)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // COUNTER-RED 4 — an edit to a NON-UI file (scripts/hooks/...) is recorded only as a plain
    // 'edit' event by edit-tracker.mjs, never 'ui_edit' — driven through the REAL observer.
    {
      const out = withState10(
        (db) => {
          EDIT_TRACKER10.observe({
            session_id: 'sess-c4', tool_name: 'Edit',
            tool_input: { file_path: join(ROOT, 'scripts', 'hooks', 'observers', 'session-events.mjs') },
            _outcome: { ok: true },
          });
        },
        () => RULE10.evaluate({ session_id: 'sess-c4', transcript_path: claimTranscript }),
      );
      check('COUNTER-RED 4: non-UI edit -> no ui_edit event -> ALLOW', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // Degraded paths — never a throw, never a warn on undeterminable evidence.
    check('degraded: undefined input -> ALLOW, no throw', RULE10.evaluate(undefined).decision === 'allow');
    check('degraded: missing session_id -> ALLOW', RULE10.evaluate({ transcript_path: claimTranscript }).decision === 'allow');
    {
      const out = RULE10.evaluate({ session_id: 'sess-x', transcript_path: join(s10Work, 'does-not-exist.jsonl') });
      check('degraded: unreadable transcript -> ALLOW, reason names degradation', out.decision === 'allow' && /degrad/i.test(out.reason), `out=${JSON.stringify(out)}`);
    }
    {
      const garbagePath = join(s10Work, 'garbage.sqlite');
      writeFileSync(garbagePath, 'not a sqlite file, just garbage bytes', 'utf8');
      const prev = process.env.ENFORCEMENT_STATE_PATH;
      process.env.ENFORCEMENT_STATE_PATH = garbagePath;
      let out;
      try {
        out = RULE10.evaluate({ session_id: 'sess-garbage', transcript_path: claimTranscript });
      } finally {
        if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
        else process.env.ENFORCEMENT_STATE_PATH = prev;
      }
      check('degraded: corrupt state store -> ALLOW, never throws/warns', out && out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // CLI level — scripts/hooks/stop.mjs, through the REAL stop-rules/ directory (both Task 9's and
  // Task 10's rules present — proves Task 10's rule is actually wired into production, not just
  // importable in isolation). Every transcript here carries FENCED EVIDENCE alongside the claim so
  // verify-before-success-claim.mjs (Task 9, same directory) independently resolves to allow —
  // isolating Task 10's own decision as the pipeline's max-severity one (pipeline.mjs's own
  // SEVERITY_RANK: warn > allow, block > warn) without needing a second, rule-duplicating temp
  // directory just to test this file in isolation.
  // -----------------------------------------------------------------------------------------------
  {
    const NOW = Date.now();
    const evidenceClaim = 'עדכנתי את המסך, הכל עובד — הפלט:\n```\n12 passed\n```';
    const REAL_STOP_RULES_DIR = join(ROOT, 'scripts', 'hooks', 'stop-rules');

    function seedAndRunCli10(sessionId, seedFn, text) {
      const p = join(s10Work, `cli-state-${Math.random().toString(36).slice(2)}.sqlite`);
      const db = ES10.openState(p);
      seedFn(db);
      db.close();
      const transcript = makeAssistantTranscript10([{ atMs: NOW - 5_000, text }]);
      return runStopCli10({
        stdin: JSON.stringify({ session_id: sessionId, transcript_path: transcript }),
        rulesDir: REAL_STOP_RULES_DIR,
        env: { ENFORCEMENT_STATE_PATH: p },
      });
    }

    // RED — evidence-backed claim (keeps Task 9's rule at allow), ui_edit, no playwright_run ->
    // systemMessage carrying §10.2, and explicitly NO `decision` field (warn must not block).
    {
      const r = seedAndRunCli10('sess-cli-red', (db) => {
        ES10.recordEvent(db, { sessionId: 'sess-cli-red', kind: 'ui_edit', detail: {} });
      }, evidenceClaim);
      check('RED stop.mjs CLI (real dir): exit 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
      let parsed;
      try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
      check('RED stop.mjs CLI (real dir): stdout parses as JSON', parsed !== null, `stdout=${r.stdout}`);
      check('RED stop.mjs CLI (real dir): systemMessage present, NO decision field (warn must not block)',
        parsed && typeof parsed.systemMessage === 'string' && !('decision' in parsed), `stdout=${r.stdout}`);
      check('RED stop.mjs CLI (real dir): systemMessage names §10.2', parsed && parsed.systemMessage.includes('10.2'), `stdout=${r.stdout}`);
      check('RED stop.mjs CLI (real dir): systemMessage mentions Playwright', parsed && /Playwright/.test(parsed.systemMessage), `stdout=${r.stdout}`);
    }

    // COUNTER-RED 1 — evidence-backed claim, ui_edit then a NEWER playwright_run -> {}.
    {
      const r = seedAndRunCli10('sess-cli-c1', (db) => {
        ES10.recordEvent(db, { sessionId: 'sess-cli-c1', kind: 'ui_edit', detail: {} });
        ES10.recordEvent(db, { sessionId: 'sess-cli-c1', kind: 'playwright_run', detail: {} });
      }, evidenceClaim);
      check('COUNTER-RED 1 stop.mjs CLI (real dir): playwright_run after ui_edit -> {}', r.status === 0 && r.stdout.trim() === '{}', `stdout=${r.stdout}`);
    }

    // COUNTER-RED 2 — evidence-backed claim, no ui_edit at all -> {}.
    {
      const r = seedAndRunCli10('sess-cli-c2', () => {}, evidenceClaim);
      check('COUNTER-RED 2 stop.mjs CLI (real dir): claim, no ui_edit -> {}', r.status === 0 && r.stdout.trim() === '{}', `stdout=${r.stdout}`);
    }

    // COUNTER-RED 3 — ui_edit, but the reply makes no claim at all -> {}.
    {
      const r = seedAndRunCli10('sess-cli-c3', (db) => {
        ES10.recordEvent(db, { sessionId: 'sess-cli-c3', kind: 'ui_edit', detail: {} });
      }, 'let me check the layout code');
      check('COUNTER-RED 3 stop.mjs CLI (real dir): ui_edit, no claim -> {}', r.status === 0 && r.stdout.trim() === '{}', `stdout=${r.stdout}`);
    }
  }
}

// =================================================================================================
// SECTION 11 — scripts/hooks/stop-rules/live-url-verified.mjs (task-11-brief.md, §10.10: "a push is
// not a release"). Every case runs against a TEMP ENFORCEMENT_STATE_PATH and a CLEAN SYNTHETIC
// transcript — never this session's own real store/transcript, same discipline as Sections 4/8/9/10.
// =================================================================================================
{
  const s11Work = tempDir('hooks-groupb-livecheck-');
  const ES11 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const RULE11 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'stop-rules', 'live-url-verified.mjs')).href);
  const STOP_CLI11 = join(ROOT, 'scripts', 'hooks', 'stop.mjs');

  function makeAssistantTranscript11(entries) {
    const path = join(s11Work, `transcript-${Math.random().toString(36).slice(2)}.jsonl`);
    const lines = entries.map((e) => JSON.stringify({
      type: 'assistant',
      timestamp: new Date(e.atMs).toISOString(),
      message: { content: [{ type: 'text', text: e.text }] },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  // Same pattern as Section 10's withState10(): seeds a fresh temp SQLite store while
  // ENFORCEMENT_STATE_PATH points at it, then evaluates, then restores the env var.
  function withState11(seedFn, evalFn = () => undefined) {
    const p = join(s11Work, `state-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      const db = ES11.openState(p);
      seedFn(db, p);
      db.close();
      return evalFn(p);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  function runStopCli11({ stdin, rulesDir, logPath, env: extraEnv }) {
    const env = { ...process.env, ...(extraEnv || {}) };
    if (rulesDir) env.STOP_RULES_DIR = rulesDir;
    if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
    return spawnSync(process.execPath, [STOP_CLI11], {
      input: stdin, encoding: 'utf8', env, cwd: ROOT, timeout: 15000,
    });
  }

  // Inserts a live_probe event at an EXPLICIT ts (not "now") so freshness/staleness can be tested
  // precisely, mirroring Section 4's own direct-SQL seeding for last_failure_ts backdating.
  function seedProbeAt(db, sessionId, tsMs) {
    db.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
      .run(sessionId, 'live_probe', tsMs, JSON.stringify({ source: 'test-seed' }));
  }

  const NOW = Date.now();
  const liveClaimText = 'מהדורה 291 חיה';
  const liveClaimTranscript = makeAssistantTranscript11([{ atMs: NOW - 5_000, text: liveClaimText }]);
  const localWorksTranscript = makeAssistantTranscript11([{ atMs: NOW - 5_000, text: 'הגרסה המקומית עובדת' }]);
  const devServerTranscript = makeAssistantTranscript11([{ atMs: NOW - 5_000, text: 'the dev server shows it working now' }]);
  const pushedOnlyTranscript = makeAssistantTranscript11([{ atMs: NOW - 5_000, text: 'I pushed the commit' }]);

  // -----------------------------------------------------------------------------------------------
  // Rule level (direct import) — live-url-verified.mjs's evaluate(). The brief's own RED + COUNTER
  // table (step 1), replayed one case at a time.
  // -----------------------------------------------------------------------------------------------
  {
    // RED — live claim, no live_probe event at all this session -> BLOCK, reason names live-smoke.mjs.
    {
      const out = withState11(
        () => { /* nothing recorded */ },
        () => RULE11.evaluate({ session_id: 'sess-red', transcript_path: liveClaimTranscript }),
      );
      check('RED live-url-verified: live claim, no live_probe -> BLOCK', out.decision === 'block', `out=${JSON.stringify(out)}`);
      check('RED live-url-verified: reason names live-smoke.mjs', out.reason.includes('live-smoke.mjs'), `reason=${out.reason}`);
      check('RED live-url-verified: reason names §10.10', out.reason.includes('10.10'), `reason=${out.reason}`);
    }

    // COUNTER-RED — same claim, live_probe recorded 2 minutes ago (fresh) -> ALLOW ({}).
    {
      const out = withState11(
        (db) => { seedProbeAt(db, 'sess-fresh', NOW - 2 * 60 * 1000); },
        () => RULE11.evaluate({ session_id: 'sess-fresh', transcript_path: liveClaimTranscript }),
      );
      check('COUNTER-RED live-url-verified: fresh live_probe (2 min ago) -> ALLOW', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // COUNTER-RED — "הגרסה המקומית עובדת" (local works) -> no live-claim detected -> ALLOW, even with
    // NO probe at all — this is the miscount-blocks-a-human case the brief names explicitly.
    {
      const out = withState11(
        () => {},
        () => RULE11.evaluate({ session_id: 'sess-local', transcript_path: localWorksTranscript }),
      );
      check('COUNTER-RED live-url-verified: "local version works" -> ALLOW (no live-claim, local != live)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // COUNTER-RED — "the dev server shows it" -> no live-claim detected -> ALLOW, no probe needed.
    {
      const out = withState11(
        () => {},
        () => RULE11.evaluate({ session_id: 'sess-dev', transcript_path: devServerTranscript }),
      );
      check('COUNTER-RED live-url-verified: "the dev server shows it" -> ALLOW (no live-claim)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // COUNTER-RED — "I pushed" (a push, not a claim of live) -> no live-claim detected -> ALLOW.
    {
      const out = withState11(
        () => {},
        () => RULE11.evaluate({ session_id: 'sess-pushed', transcript_path: pushedOnlyTranscript }),
      );
      check('COUNTER-RED live-url-verified: "I pushed" -> ALLOW (a push is not a live claim)', out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }

    // RED — live_probe recorded 31+ minutes ago (stale) -> BLOCK (freshness asserted in the stale
    // direction too — a morning probe does not license an afternoon claim about a new push).
    {
      const out = withState11(
        (db) => { seedProbeAt(db, 'sess-stale', NOW - 31 * 60 * 1000); },
        () => RULE11.evaluate({ session_id: 'sess-stale', transcript_path: liveClaimTranscript }),
      );
      check('RED live-url-verified: live_probe 31 minutes ago (stale) -> BLOCK', out.decision === 'block', `out=${JSON.stringify(out)}`);
    }

    // Boundary — live_probe exactly at the 30-minute edge (well inside) still allows, and one that is
    // just past the cutoff still blocks (confirms the comparison direction, not just gross values).
    {
      const outInside = withState11(
        (db) => { seedProbeAt(db, 'sess-boundary-in', NOW - (RULE11.WINDOW_MS - 60_000)); },
        () => RULE11.evaluate({ session_id: 'sess-boundary-in', transcript_path: liveClaimTranscript }),
      );
      check('BOUNDARY live-url-verified: probe 1 min inside the window -> ALLOW', outInside.decision === 'allow', `out=${JSON.stringify(outInside)}`);

      const outOutside = withState11(
        (db) => { seedProbeAt(db, 'sess-boundary-out', NOW - (RULE11.WINDOW_MS + 60_000)); },
        () => RULE11.evaluate({ session_id: 'sess-boundary-out', transcript_path: liveClaimTranscript }),
      );
      check('BOUNDARY live-url-verified: probe 1 min outside the window -> BLOCK', outOutside.decision === 'block', `out=${JSON.stringify(outOutside)}`);
    }

    // RED — another session's probe must not license THIS session's claim (falls out of lastEvent()'s
    // own session_id scoping, per this rule's header comment — proven here, not just asserted).
    {
      const out = withState11(
        (db) => { seedProbeAt(db, 'sess-OTHER', NOW - 60_000); },
        () => RULE11.evaluate({ session_id: 'sess-mine', transcript_path: liveClaimTranscript }),
      );
      check('RED live-url-verified: another session\'s fresh probe -> BLOCK (session-scoped, not shared)', out.decision === 'block', `out=${JSON.stringify(out)}`);
    }

    // Degraded paths — never a throw, never a block on undeterminable evidence.
    check('degraded: undefined input -> ALLOW, no throw', RULE11.evaluate(undefined).decision === 'allow');
    check('degraded: missing session_id -> ALLOW', RULE11.evaluate({ transcript_path: liveClaimTranscript }).decision === 'allow');
    {
      const out = RULE11.evaluate({ session_id: 'sess-x', transcript_path: join(s11Work, 'does-not-exist.jsonl') });
      check('degraded: unreadable transcript -> ALLOW, reason names degradation', out.decision === 'allow' && /degrad/i.test(out.reason), `out=${JSON.stringify(out)}`);
    }
    {
      const garbagePath = join(s11Work, 'garbage.sqlite');
      writeFileSync(garbagePath, 'not a sqlite file, just garbage bytes', 'utf8');
      const prev = process.env.ENFORCEMENT_STATE_PATH;
      process.env.ENFORCEMENT_STATE_PATH = garbagePath;
      let out;
      try {
        out = RULE11.evaluate({ session_id: 'sess-garbage', transcript_path: liveClaimTranscript });
      } finally {
        if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
        else process.env.ENFORCEMENT_STATE_PATH = prev;
      }
      check('degraded: corrupt state store -> ALLOW, never throws/blocks', out && out.decision === 'allow', `out=${JSON.stringify(out)}`);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // CLI level — scripts/hooks/stop.mjs, through the REAL stop-rules/ directory (Task 9's, Task 10's,
  // and this rule all present — proves it is actually wired into production).
  // -----------------------------------------------------------------------------------------------
  {
    const REAL_STOP_RULES_DIR11 = join(ROOT, 'scripts', 'hooks', 'stop-rules');

    function seedAndRunCli11(sessionId, seedFn, text) {
      const p = join(s11Work, `cli-state-${Math.random().toString(36).slice(2)}.sqlite`);
      const db = ES11.openState(p);
      seedFn(db);
      db.close();
      const transcript = makeAssistantTranscript11([{ atMs: Date.now() - 5_000, text }]);
      return runStopCli11({
        stdin: JSON.stringify({ session_id: sessionId, transcript_path: transcript }),
        rulesDir: REAL_STOP_RULES_DIR11,
        env: { ENFORCEMENT_STATE_PATH: p },
      });
    }

    // RED — live claim, no probe -> decision:"block", stdout carries the exact deny text.
    {
      const r = seedAndRunCli11('sess-cli-red', () => {}, liveClaimText);
      check('RED stop.mjs CLI (real dir): exit 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
      let parsed;
      try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
      check('RED stop.mjs CLI (real dir): decision is "block"', parsed && parsed.decision === 'block', `stdout=${r.stdout}`);
      check('RED stop.mjs CLI (real dir): reason names §10.10 and live-smoke.mjs',
        parsed && parsed.reason.includes('10.10') && parsed.reason.includes('live-smoke.mjs'), `stdout=${r.stdout}`);
    }

    // GREEN — live claim, FRESH live_probe recorded -> {} (silent, the rule working as intended).
    {
      const r = seedAndRunCli11('sess-cli-green', (db) => {
        db.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
          .run('sess-cli-green', 'live_probe', Date.now() - 60_000, null);
      }, liveClaimText);
      check('GREEN stop.mjs CLI (real dir): fresh live_probe -> {} (silent)', r.status === 0 && r.stdout.trim() === '{}', `stdout=${r.stdout}`);
    }

    // COUNTER-RED — quoting §10.10 itself in a reply with no live-claim phrasing -> {} .
    {
      const r = seedAndRunCli11('sess-cli-quote', () => {}, 'לפי §10.10, push לא זה release.');
      check('COUNTER-RED stop.mjs CLI (real dir): quoting §10.10, no live-claim wording -> {}', r.status === 0 && r.stdout.trim() === '{}', `stdout=${r.stdout}`);
    }

    // COUNTER-RED — "I pushed" only -> {}.
    {
      const r = seedAndRunCli11('sess-cli-pushed', () => {}, 'I pushed the fix');
      check('COUNTER-RED stop.mjs CLI (real dir): "I pushed" only -> {}', r.status === 0 && r.stdout.trim() === '{}', `stdout=${r.stdout}`);
    }
  }
}

// =================================================================================================
// SECTION 14 — R-117 / Task 14: actor-scoped counters. Dispatched subagents inherit the parent's
// session_id, so a store keyed by session_id ALONE lets one actor's failures block a DIFFERENT
// concurrent actor's edit — observed live during Task 10. Every case here runs against a TEMP
// ENFORCEMENT_STATE_PATH, never the real repo store.
// =================================================================================================
{
  const s14Work = tempDir('hooks-groupb-actor-scope-');
  const ES14 = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const RULE14fc = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'fix-cycle-limit.mjs')).href);
  const RULE14dbg = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'rules', 'debugging-before-fix-edit.mjs')).href);
  const OBS14v = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'observers', 'verification-outcomes.mjs')).href);
  const { resolveActorTranscriptPath } = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'skill-invoked.mjs')).href);

  // Writes a transcript with NO skill invocation at the REAL sidechain path a dispatched
  // subagent's own turns actually live at (skill-invoked.mjs's own resolveActorTranscriptPath) —
  // not at the top-level transcript_path, which a real subagent never writes to. Mirrors real
  // Claude Code layout, per that module's own measured header.
  function writeCleanActorTranscript14(topLevelPath, agentId) {
    const actorPath = resolveActorTranscriptPath(topLevelPath, agentId);
    mkdirSync(dirname(actorPath), { recursive: true });
    writeFileSync(actorPath, `${JSON.stringify({
      type: 'assistant', timestamp: new Date(Date.now() - 50_000).toISOString(),
      message: { content: [{ type: 'text', text: 'no skill invocation here' }] },
    })}\n`, 'utf8');
    return actorPath;
  }

  function withState14(seedFn, evalFn = () => undefined) {
    const p = join(s14Work, `state-${Math.random().toString(36).slice(2)}.sqlite`);
    const prev = process.env.ENFORCEMENT_STATE_PATH;
    process.env.ENFORCEMENT_STATE_PATH = p;
    try {
      const db = ES14.openState(p);
      seedFn(db, p);
      db.close();
      return evalFn(p);
    } finally {
      if (prev === undefined) delete process.env.ENFORCEMENT_STATE_PATH;
      else process.env.ENFORCEMENT_STATE_PATH = prev;
    }
  }

  function driveToAttempts14(db, sessionId, target, attempts, actorId) {
    ES14.noteVerificationFailure(db, sessionId, [target], actorId);
    for (let i = 0; i < attempts; i++) {
      ES14.noteEdit(db, sessionId, '/some/file.js', actorId);
      ES14.noteVerificationFailure(db, sessionId, [target], actorId);
    }
  }

  // -----------------------------------------------------------------------------------------
  // RED (task-14-brief's own required scenario, fix-cycle-limit.mjs / §5): two actors under ONE
  // session — actor A drives a target to attempts=3 (the ceiling), actor B (same session_id, a
  // DIFFERENT agent_id, same target name) must still be ALLOWED to edit.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-shared';
    const target = 'tests/shared.py::test_shared';
    const outB = withState14(
      (db) => driveToAttempts14(db, sid, target, 3, 'agent-A'),
      () => RULE14fc.evaluate({
        tool_name: 'Edit', session_id: sid, agent_id: 'agent-B', tool_input: { file_path: '/x.js' },
      }),
    );
    check('RED Task14 fix-cycle: actor A at the ceiling does NOT block actor B\'s edit',
      outB.decision === 'allow', `outB=${JSON.stringify(outB)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED (same scenario, task-14-brief's own required pairing): actor A's OWN next edit on
  // that SAME target must still BLOCK — the fix must not have become "no actor is ever blocked".
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-shared-2';
    const target = 'tests/shared2.py::test_shared2';
    const outA = withState14(
      (db) => driveToAttempts14(db, sid, target, 3, 'agent-A'),
      () => RULE14fc.evaluate({
        tool_name: 'Edit', session_id: sid, agent_id: 'agent-A', tool_input: { file_path: '/x.js' },
      }),
    );
    check('COUNTER-RED Task14 fix-cycle: actor A\'s OWN next edit on the SAME target still BLOCKS',
      outA.decision === 'block', `outA=${JSON.stringify(outA)}`);
    check('COUNTER-RED Task14 fix-cycle: block reason still names §5 and the target',
      outA.reason.includes('§5') && outA.reason.includes(target), `reason=${outA.reason}`);
  }

  // -----------------------------------------------------------------------------------------
  // RED (main-session identity): the top-level session (no agent_id at all) and a dispatched
  // subagent (agent_id set) on the SAME target must be scoped independently too — the main session
  // is its OWN stable identity, not a wildcard that sees every subagent's rows.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-main-vs-sub';
    const target = 'tests/main_vs_sub.py::test_x';
    const outMain = withState14(
      (db) => driveToAttempts14(db, sid, target, 3, 'agent-sub1'), // subagent drives to the ceiling
      () => RULE14fc.evaluate({
        tool_name: 'Edit', session_id: sid, tool_input: { file_path: '/x.js' }, // no agent_id -> main session
      }),
    );
    check('RED Task14 fix-cycle: a subagent at the ceiling does NOT block the main session\'s own edit',
      outMain.decision === 'allow', `outMain=${JSON.stringify(outMain)}`);
  }

  // -----------------------------------------------------------------------------------------
  // RED (task-14-brief's own required scenario, debugging-before-fix-edit.mjs / §6.4 trigger 2 —
  // this is the LITERAL defect observed live): actor A's OWN bash_failure (recorded by
  // verification-outcomes.mjs's real observer, not a synthetic insert) must not block actor B's
  // edit under the same session_id.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-dbg-shared';
    const cleanTranscript = join(s14Work, 'clean-transcript-14.jsonl');
    writeCleanActorTranscript14(cleanTranscript, 'agent-B');

    const outB = withState14(
      (db) => {
        // Actor A's real Bash failure, exactly as verification-outcomes.mjs's own observer would
        // record it — not a raw SQL insert — so this is the actual production write path under test.
        OBS14v.observe({
          tool_name: 'Bash', session_id: sid, agent_id: 'agent-A',
          tool_input: { command: 'npm run build' },
          _outcome: { ok: false, raw_error: 'Error: build failed' },
        });
      },
      () => RULE14dbg.evaluate({
        tool_name: 'Edit', session_id: sid, agent_id: 'agent-B',
        transcript_path: cleanTranscript, tool_input: { file_path: '/x.js' },
      }),
    );
    check('RED Task14 debugging-before-fix-edit: actor A\'s bash_failure does NOT block actor B\'s edit (the literal R-117 defect)',
      outB.decision === 'allow', `outB=${JSON.stringify(outB)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED (same scenario): actor A's OWN next edit, with no systematic-debugging invocation
  // since the failure, must still BLOCK — the fix must not have disabled §6.4 trigger 2 entirely.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-dbg-shared-2';
    const cleanTranscript = join(s14Work, 'clean-transcript-14b.jsonl');
    writeCleanActorTranscript14(cleanTranscript, 'agent-A');

    const outA = withState14(
      (db) => {
        OBS14v.observe({
          tool_name: 'Bash', session_id: sid, agent_id: 'agent-A',
          tool_input: { command: 'npm run build' },
          _outcome: { ok: false, raw_error: 'Error: build failed' },
        });
      },
      () => RULE14dbg.evaluate({
        tool_name: 'Edit', session_id: sid, agent_id: 'agent-A',
        transcript_path: cleanTranscript, tool_input: { file_path: '/x.js' },
      }),
    );
    check('COUNTER-RED Task14 debugging-before-fix-edit: actor A\'s OWN next edit still BLOCKS',
      outA.decision === 'block', `outA=${JSON.stringify(outA)}`);
    check('COUNTER-RED Task14 debugging-before-fix-edit: block reason still names systematic-debugging',
      /systematic-debugging/.test(outA.reason), `reason=${outA.reason}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED (§10.16 / §6.3, task-14-brief's own required pairing): the SAME two-actor scenario
  // must NOT hide from the session-wide lessons gate — eventCountSince('verification_failure') is
  // deliberately UNCHANGED (no actorId parameter), so failures from BOTH actors must both count
  // toward the session total.
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-lessons';
    // Read INSIDE evalFn, while ENFORCEMENT_STATE_PATH still points at the seeded temp store —
    // opening a fresh db AFTER withState14() returns would read the DEFAULT (real repo) store, not
    // the fixture, since the env var is already restored by then.
    const count = withState14(
      (db) => {
        ES14.noteVerificationFailure(db, sid, ['t-a'], 'agent-A');
        ES14.noteVerificationFailure(db, sid, ['t-b'], 'agent-B');
        ES14.noteVerificationFailure(db, sid, ['t-c']); // main session, no agent_id
      },
      () => {
        const db2 = ES14.openState();
        const c = ES14.eventCountSince(db2, sid, 'verification_failure', 0);
        db2.close();
        return c;
      },
    );
    check('COUNTER-RED Task14 §10.16: eventCountSince sees ALL THREE actors\' failures (session-wide, not per-actor)',
      count === 3, `count=${count}`);
  }

  // -----------------------------------------------------------------------------------------
  // GREEN (§5 resolution stays per-actor): actor A's own passing run clears ONLY actor A's own
  // fix_targets row — actor B's own concurrently-open row on a differently-named target is
  // untouched (proves noteVerificationPass's ALL sentinel does not wipe cross-actor).
  // -----------------------------------------------------------------------------------------
  {
    const sid = 'sess-14-pass-scope';
    const { targetsA, targetsB } = withState14(
      (db) => {
        ES14.noteVerificationFailure(db, sid, ['t-a-only'], 'agent-A');
        ES14.noteVerificationFailure(db, sid, ['t-b-only'], 'agent-B');
        ES14.noteVerificationPass(db, sid, ES14.ALL, 'agent-A');
      },
      () => {
        const db2 = ES14.openState();
        const a = ES14.openTargets(db2, sid, 'agent-A');
        const b = ES14.openTargets(db2, sid, 'agent-B');
        db2.close();
        return { targetsA: a, targetsB: b };
      },
    );
    check('GREEN Task14: actor A\'s full-suite pass wipes actor A\'s own row',
      targetsA.length === 0, `targetsA=${JSON.stringify(targetsA)}`);
    check('GREEN Task14: actor A\'s full-suite pass leaves actor B\'s own row untouched',
      targetsB.length === 1 && targetsB[0].target === 't-b-only', `targetsB=${JSON.stringify(targetsB)}`);
  }

  // -----------------------------------------------------------------------------------------
  // MIGRATION — rows written under the OLD schema (no actor_id column at all, simulating the
  // live store as it existed before this task) survive openState()'s migration and are visible
  // under the main-session identity ('' / no agent_id) — never under every actor (which would
  // recreate the defect) and never dropped (which would silently erase a real in-flight counter).
  // -----------------------------------------------------------------------------------------
  {
    const p = join(s14Work, 'pre-migration.sqlite');
    const { DatabaseSync } = await import('node:sqlite');
    mkdirSync(dirname(p), { recursive: true });
    const rawDb = new DatabaseSync(p);
    rawDb.exec('PRAGMA journal_mode = WAL');
    // The EXACT pre-Task-14 schema (no actor_id column anywhere).
    rawDb.exec(`CREATE TABLE events (id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL, detail TEXT)`);
    rawDb.exec(`CREATE TABLE fix_targets (session_id TEXT NOT NULL, target TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, edited_since_failure INTEGER NOT NULL DEFAULT 0, last_failure_ts INTEGER NOT NULL, PRIMARY KEY (session_id, target))`);
    rawDb.prepare('INSERT INTO fix_targets (session_id, target, attempts, edited_since_failure, last_failure_ts) VALUES (?, ?, ?, ?, ?)')
      .run('sess-14-migrate', 'legacy/target.py::test_legacy', 2, 0, Date.now());
    rawDb.prepare('INSERT INTO events (session_id, kind, ts, detail) VALUES (?, ?, ?, ?)')
      .run('sess-14-migrate', 'bash_failure', Date.now() - 5000, null);
    rawDb.close();

    // openState() (the real production entry point) must migrate this file in place.
    const migratedDb = ES14.openState(p);
    const migratedTargetsUnfiltered = ES14.openTargets(migratedDb, 'sess-14-migrate');
    const migratedTargetsMain = ES14.openTargets(migratedDb, 'sess-14-migrate', null);
    const migratedTargetsOtherActor = ES14.openTargets(migratedDb, 'sess-14-migrate', 'some-subagent');
    const migratedFailure = ES14.lastEvent(migratedDb, 'sess-14-migrate', 'bash_failure', null);
    const migratedFailureOtherActor = ES14.lastEvent(migratedDb, 'sess-14-migrate', 'bash_failure', 'some-subagent');
    migratedDb.close();

    check('MIGRATION Task14: openState() survives a pre-existing store with no actor_id column',
      Array.isArray(migratedTargetsUnfiltered), `migratedTargetsUnfiltered=${JSON.stringify(migratedTargetsUnfiltered)}`);
    check('MIGRATION Task14: the pre-existing fix_targets row is visible unfiltered',
      migratedTargetsUnfiltered.some((t) => t.target === 'legacy/target.py::test_legacy' && t.attempts === 2),
      `migratedTargetsUnfiltered=${JSON.stringify(migratedTargetsUnfiltered)}`);
    check('MIGRATION Task14: the pre-existing fix_targets row is visible under the MAIN-SESSION identity',
      migratedTargetsMain.some((t) => t.target === 'legacy/target.py::test_legacy'),
      `migratedTargetsMain=${JSON.stringify(migratedTargetsMain)}`);
    check('MIGRATION Task14: the pre-existing fix_targets row is NOT visible to an unrelated subagent actor (never a wildcard)',
      !migratedTargetsOtherActor.some((t) => t.target === 'legacy/target.py::test_legacy'),
      `migratedTargetsOtherActor=${JSON.stringify(migratedTargetsOtherActor)}`);
    check('MIGRATION Task14: the pre-existing bash_failure event is visible under the main-session identity',
      migratedFailure !== null, `migratedFailure=${JSON.stringify(migratedFailure)}`);
    check('MIGRATION Task14: the pre-existing bash_failure event is NOT visible to an unrelated subagent actor',
      migratedFailureOtherActor === null, `migratedFailureOtherActor=${JSON.stringify(migratedFailureOtherActor)}`);

    // Second open (simulating a later hook call against the now-migrated file) must be a clean
    // no-op — proves the migration is idempotent, not re-run (and therefore not re-corrupting) on
    // every subsequent openState() call.
    const secondOpen = ES14.openState(p);
    const secondRead = ES14.openTargets(secondOpen, 'sess-14-migrate', null);
    secondOpen.close();
    check('MIGRATION Task14: a SECOND openState() on the already-migrated file is a clean no-op',
      secondRead.length === 1 && secondRead[0].attempts === 2, `secondRead=${JSON.stringify(secondRead)}`);
  }

  // -----------------------------------------------------------------------------------------
  // COUNTER-RED — backward compatibility: every pre-Task-14 call shape (no actorId argument at
  // all) must behave EXACTLY as before. This is not new coverage of new behavior; it is the proof
  // that Section 2-13's existing 400+ assertions above remain valid without modification.
  // -----------------------------------------------------------------------------------------
  {
    const { targets, lastFail } = withState14(
      (db) => {
        ES14.noteVerificationFailure(db, 'sess-14-backcompat', ['T']);
        ES14.noteEdit(db, 'sess-14-backcompat', '/f.js');
        ES14.noteVerificationFailure(db, 'sess-14-backcompat', ['T']);
      },
      () => {
        const db2 = ES14.openState();
        const t = ES14.openTargets(db2, 'sess-14-backcompat');
        const lf = ES14.lastEvent(db2, 'sess-14-backcompat', 'verification_failure');
        db2.close();
        return { targets: t, lastFail: lf };
      },
    );
    check('COUNTER-RED Task14 backcompat: 3-arg noteVerificationFailure/2-arg openTargets still work exactly as before',
      targets.length === 1 && targets[0].attempts === 1, `targets=${JSON.stringify(targets)}`);
    check('COUNTER-RED Task14 backcompat: 3-arg lastEvent (no actorId) is still unfiltered',
      lastFail !== null, `lastFail=${JSON.stringify(lastFail)}`);
  }
}

// =================================================================================================
// SECTION 12 — Task 12 integration: end-to-end scenarios through the REAL CLIs
// (pretooluse.mjs, posttooluse.mjs, stop.mjs), each pointed at the REAL production rules/observers
// directories (PRETOOLUSE_RULES_DIR / POSTTOOLUSE_OBSERVERS_DIR / STOP_RULES_DIR are deliberately
// NOT set here — the whole point is to prove the actual shipped rule set behaves, not a fixture
// copy of it) with ONLY the state DB and the log path redirected to a temp location per the
// declared §2.1 pattern (redirect WHERE state lives, never WHETHER a rule runs).
// =================================================================================================
{
  const s12Work = tempDir('hooks-groupb-integration-');
  const PRETOOLUSE_CLI12 = join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs');
  const POSTTOOLUSE_CLI12 = join(ROOT, 'scripts', 'hooks', 'posttooluse.mjs');
  const STOP_CLI12 = join(ROOT, 'scripts', 'hooks', 'stop.mjs');

  function runPre12({ stdin, logPath, statePath, env: extraEnv }) {
    const env = { ...process.env, ...(extraEnv || {}) };
    if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
    if (statePath) env.ENFORCEMENT_STATE_PATH = statePath;
    return spawnSync(process.execPath, [PRETOOLUSE_CLI12], {
      input: stdin, encoding: 'utf8', env, cwd: ROOT, timeout: 15000,
    });
  }
  function runPost12({ stdin, logPath, statePath, env: extraEnv }) {
    const env = { ...process.env, ...(extraEnv || {}) };
    if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
    if (statePath) env.ENFORCEMENT_STATE_PATH = statePath;
    return spawnSync(process.execPath, [POSTTOOLUSE_CLI12], {
      input: stdin, encoding: 'utf8', env, cwd: ROOT, timeout: 15000,
    });
  }
  function runStop12({ stdin, logPath, statePath, env: extraEnv }) {
    const env = { ...process.env, ...(extraEnv || {}) };
    if (logPath) env.PRETOOLUSE_LOG_PATH = logPath;
    if (statePath) env.ENFORCEMENT_STATE_PATH = statePath;
    return spawnSync(process.execPath, [STOP_CLI12], {
      input: stdin, encoding: 'utf8', env, cwd: ROOT, timeout: 15000,
    });
  }

  function makeTranscript12(entries, fileBase = 'transcript') {
    const path = join(s12Work, `${fileBase}-${Math.random().toString(36).slice(2)}.jsonl`);
    const lines = entries.map((e) => JSON.stringify({
      type: 'assistant',
      timestamp: new Date(e.atMs).toISOString(),
      message: { content: [{ type: 'text', text: e.text }] },
    }));
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }
  function emptyTranscript12() {
    const path = join(s12Work, `empty-${Math.random().toString(36).slice(2)}.jsonl`);
    writeFileSync(path, '', 'utf8');
    return path;
  }
  // A transcript that already carries a systematic-debugging Skill invocation (measured shape,
  // skill-invoked.mjs's own header) — used to isolate the §5 story from the §6.4-trigger-2 rule
  // (debugging-before-fix-edit.mjs), which ALSO fires on a failure-then-edit pattern: a real
  // developer replaying this exact story would invoke the skill once per failure too, so this is
  // representative, not a workaround.
  function transcriptWithDebuggingSkill12() {
    const path = join(s12Work, `debugskill-${Math.random().toString(36).slice(2)}.jsonl`);
    writeFileSync(path, '', 'utf8');
    return path;
  }
  // Appends a FRESH systematic-debugging Skill invocation (current timestamp) to the transcript —
  // called once per failure cycle, right after the failure and before the edit, exactly the order
  // a real developer would produce (debugging-before-fix-edit.mjs windows skillInvokedSince() from
  // the failure's own ts forward, so a skill entry dated BEFORE that failure would not count).
  function appendDebuggingSkillInvocation12(path) {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: new Date().toISOString(),
      message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'superpowers:systematic-debugging' } }] },
    });
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
    writeFileSync(path, `${existing}${line}\n`, 'utf8');
  }
  // pretooluse.mjs's real stdout shape is {} (allow), {systemMessage,hookSpecificOutput...} (warn),
  // or {hookSpecificOutput:{permissionDecision:'deny',...}} (block) — NEVER a top-level `decision`
  // field (that shape belongs to stop.mjs only). These two helpers read the REAL shape.
  function preIsBlocked12(result) {
    let parsed = {};
    try { parsed = JSON.parse(result.stdout || '{}'); } catch { /* leave {} */ }
    return parsed?.hookSpecificOutput?.permissionDecision === 'deny';
  }
  function preReason12(result) {
    let parsed = {};
    try { parsed = JSON.parse(result.stdout || '{}'); } catch { /* leave {} */ }
    return parsed?.hookSpecificOutput?.permissionDecisionReason || '';
  }

  // -----------------------------------------------------------------------------------------------
  // STORY 1 — §5: verification fails -> edit allowed -> fails -> edit -> fails -> edit -> fails
  // (attempts reach 3, a CLOSED cycle each time) -> the 4th edit on the SAME target is BLOCKED ->
  // a brand-new session_id (simulating a crash/new session) is allowed immediately (no stale block).
  // -----------------------------------------------------------------------------------------------
  {
    const sid = `s12-story5-${Math.random().toString(36).slice(2)}`;
    const statePath = join(s12Work, `state-story5-${Math.random().toString(36).slice(2)}.sqlite`);
    const logPath = join(s12Work, `log-story5-${Math.random().toString(36).slice(2)}.jsonl`);
    const target = 'tests/test_story5.py::test_thing';
    // Isolates the §5 story from §6.4 trigger 2 (debugging-before-fix-edit.mjs), which ALSO fires
    // on a bare failure->edit pattern — a real developer replaying this story invokes the skill
    // once per failure too, so this transcript is representative, not a bypass.
    const transcript = transcriptWithDebuggingSkill12();

    function postFailure() {
      return runPost12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', transcript_path: transcript,
          tool_input: { command: 'pytest tests/test_story5.py' },
          error: `FAILED tests/test_story5.py::test_thing - AssertionError\n1 failed`,
          is_interrupt: false,
        }),
      });
    }
    function preEdit() {
      return runPre12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Edit', transcript_path: transcript,
          tool_input: { file_path: join(ROOT, 'story5-fixture.py'), old_string: 'a', new_string: 'b' },
        }),
      });
    }
    function postEdit() {
      return runPost12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PostToolUse', tool_name: 'Edit', transcript_path: transcript,
          tool_input: { file_path: join(ROOT, 'story5-fixture.py'), old_string: 'a', new_string: 'b' },
          tool_response: { filePath: join(ROOT, 'story5-fixture.py') },
        }),
      });
    }

    // fail #1 -> edit allowed -> fail #2 (closes cycle 1) -> edit allowed -> fail #3 (closes cycle 2)
    // -> edit allowed -> fail #4 (closes cycle 3, attempts==3) -> NEXT edit must BLOCK. A fresh
    // systematic-debugging invocation is appended after each failure, before each edit, so §6.4
    // trigger 2 stays silent throughout and only fix-cycle-limit.mjs's §5 counter is under test.
    postFailure(); appendDebuggingSkillInvocation12(transcript);
    let r1 = preEdit(); postEdit();
    postFailure(); appendDebuggingSkillInvocation12(transcript);
    let r2 = preEdit(); postEdit();
    postFailure(); appendDebuggingSkillInvocation12(transcript);
    let r3 = preEdit(); postEdit();
    postFailure(); appendDebuggingSkillInvocation12(transcript);
    let r4 = preEdit();

    check('STORY5: edit #1 (before any closed cycle) is allowed',
      !preIsBlocked12(r1), `stdout=${r1.stdout}`);
    check('STORY5: edit #2 (1 closed cycle) is allowed',
      !preIsBlocked12(r2), `stdout=${r2.stdout}`);
    check('STORY5: edit #3 (2 closed cycles) is allowed',
      !preIsBlocked12(r3), `stdout=${r3.stdout}`);
    check('STORY5: edit #4 (3 closed cycles -> the 4th cycle) is BLOCKED and names §5',
      preIsBlocked12(r4) && /§5/.test(preReason12(r4)),
      `stdout=${r4.stdout}`);

    // A brand-new session_id (simulating a crash) must NOT inherit the block — TTL/session scoping,
    // not a liveness check, is what makes this safe (Task 2's own property, replayed end-to-end here).
    const sidNew = `s12-story5-new-${Math.random().toString(36).slice(2)}`;
    const rNew = runPre12({
      statePath, logPath,
      stdin: JSON.stringify({
        session_id: sidNew, hook_event_name: 'PreToolUse', tool_name: 'Edit', transcript_path: transcript,
        tool_input: { file_path: join(ROOT, 'story5-fixture.py'), old_string: 'a', new_string: 'b' },
      }),
    });
    check('STORY5: a NEW session_id (crash/new session) is allowed immediately — no stale block',
      !preIsBlocked12(rNew), `stdout=${rNew.stdout}`);
  }

  // -----------------------------------------------------------------------------------------------
  // STORY 2 — §10.16: a failure is recorded -> `git commit` is BLOCKED -> the discipline doc gains a
  // new `+**L<n> ·` line in the working tree -> the SAME `git commit` is now allowed.
  // -----------------------------------------------------------------------------------------------
  {
    const sid = `s12-story16-${Math.random().toString(36).slice(2)}`;
    const statePath = join(s12Work, `state-story16-${Math.random().toString(36).slice(2)}.sqlite`);
    const logPath = join(s12Work, `log-story16-${Math.random().toString(36).slice(2)}.jsonl`);
    const transcript = emptyTranscript12();

    // Record one verification failure this session.
    runPost12({
      statePath, logPath,
      stdin: JSON.stringify({
        session_id: sid, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', transcript_path: transcript,
        tool_input: { command: 'pytest tests/test_story16.py' },
        error: `FAILED tests/test_story16.py::test_x - AssertionError\n1 failed`,
        is_interrupt: false,
      }),
    });

    const rBlocked = runPre12({
      statePath, logPath,
      stdin: JSON.stringify({
        session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Bash', transcript_path: transcript,
        tool_input: { command: 'git commit -m "story16 test commit"' },
      }),
    });
    check('STORY16: git commit with an uncovered failure this session is BLOCKED and names §10.16',
      preIsBlocked12(rBlocked) && /§10\.16/.test(preReason12(rBlocked)),
      `stdout=${rBlocked.stdout}`);

    // The real rule shells to `git diff HEAD -- docs/process/development-discipline.md` on disk, so
    // this story writes a REAL (uncommitted) lesson line into that file, runs the same commit
    // command again, and reverts the line in a finally block — never leaving repo state touched.
    const disciplinePath = join(ROOT, 'docs', 'process', 'development-discipline.md');
    const original = readFileSync(disciplinePath, 'utf8');
    try {
      writeFileSync(disciplinePath, `${original}\n**L999 · Story16 integration probe (2026-08-08).** Temporary, removed by the test.\n`, 'utf8');
      const rAllowed = runPre12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Bash', transcript_path: transcript,
          tool_input: { command: 'git commit -m "story16 test commit"' },
        }),
      });
      check('STORY16: after a new **L<n> · line lands in the working tree, the SAME commit is allowed',
        !preIsBlocked12(rAllowed), `stdout=${rAllowed.stdout}`);
    } finally {
      writeFileSync(disciplinePath, original, 'utf8');
    }
  }

  // -----------------------------------------------------------------------------------------------
  // STORY 3 — THE HONEST DAY: 20 ordinary events an experienced developer on this project would
  // actually run, replayed through the REAL pretooluse/posttooluse/stop CLIs (production rules and
  // observers, isolated state+log only). Zero of them should warn or block. This is the plan's own
  // "single most important deliverable" line — every intervention here is reported individually,
  // not summarized away, per the task-12 brief.
  // -----------------------------------------------------------------------------------------------
  {
    const sid = `s12-honestday-${Math.random().toString(36).slice(2)}`;
    const statePath = join(s12Work, `state-honestday-${Math.random().toString(36).slice(2)}.sqlite`);
    const logPath = join(s12Work, `log-honestday-${Math.random().toString(36).slice(2)}.jsonl`);
    const transcriptClean = emptyTranscript12();
    const interventions = [];

    function noteIfIntervening(label, kind, result) {
      let parsed = {};
      try { parsed = JSON.parse(result.stdout || '{}'); } catch { /* leave {} */ }
      let intervened;
      if (kind === 'stop') {
        intervened = parsed.decision === 'block' || typeof parsed.systemMessage === 'string';
      } else if (kind === 'pre') {
        // pretooluse.mjs's real shape: block -> hookSpecificOutput.permissionDecision === 'deny';
        // warn -> systemMessage present (+ permissionDecision 'allow'); allow -> {}.
        intervened = parsed?.hookSpecificOutput?.permissionDecision === 'deny'
          || typeof parsed.systemMessage === 'string';
      } else {
        // posttooluse.mjs is an observer only — it always writes {} by contract (Task 1), so this
        // branch exists to document that fact rather than to ever actually trip.
        intervened = parsed.decision === 'block' || parsed.decision === 'warn'
          || typeof parsed.systemMessage === 'string';
      }
      if (intervened) interventions.push({ label, stdout: result.stdout, stderr: result.stderr });
    }

    const bashEvents = [
      'git status',
      'git log --oneline -5',
      "grep -n \"R-72\" docs/ROADMAP-2026-07-30.md",
      'npm install',
      'node scripts/tests/run-all.mjs',
      'git diff --stat',
      'git add scripts/hooks/lib/enforcement-state.mjs',
      'python -m pytest tests/test_ingest.py -q',
      'node scripts/check-meta.mjs',
      'curl -sI https://example.com/',
    ];
    for (const command of bashEvents) {
      const pre = runPre12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Bash', transcript_path: transcriptClean,
          tool_input: { command },
        }),
      });
      noteIfIntervening(`PreToolUse Bash: ${command}`, 'pre', pre);
      const post = runPost12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PostToolUse', tool_name: 'Bash', transcript_path: transcriptClean,
          tool_input: { command },
          tool_response: { stdout: '', stderr: '', interrupted: false },
        }),
      });
      noteIfIntervening(`PostToolUse Bash: ${command}`, 'post', post);
    }

    // 6 ordinary edits to EXISTING files with no open failures on the session.
    const editFiles = [
      'scripts/hooks/lib/enforcement-state.mjs',
      'scripts/tests/test-hooks-groupb.mjs',
      'docs/process/development-discipline.md',
      'scripts/hooks/rules/fix-cycle-limit.mjs',
      'scripts/hooks/observers/edit-tracker.mjs',
      'scripts/hooks/stop-rules/live-url-verified.mjs',
    ];
    for (const rel of editFiles) {
      const filePath = join(ROOT, rel);
      const pre = runPre12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Edit', transcript_path: transcriptClean,
          tool_input: { file_path: filePath, old_string: 'x', new_string: 'x' },
        }),
      });
      noteIfIntervening(`PreToolUse Edit: ${rel}`, 'pre', pre);
      const post = runPost12({
        statePath, logPath,
        stdin: JSON.stringify({
          session_id: sid, hook_event_name: 'PostToolUse', tool_name: 'Edit', transcript_path: transcriptClean,
          tool_input: { file_path: filePath, old_string: 'x', new_string: 'x' },
          tool_response: { filePath },
        }),
      });
      noteIfIntervening(`PostToolUse Edit: ${rel}`, 'post', post);
    }

    // 1 passing suite run (feeds the §5/§10.16 counters clean), 1 commit after a green session, and
    // 3 ordinary Stop replies (no claim / a claim WITH pasted evidence / a question, not a claim).
    const passOut = runPost12({
      statePath, logPath,
      stdin: JSON.stringify({
        session_id: sid, hook_event_name: 'PostToolUse', tool_name: 'Bash', transcript_path: transcriptClean,
        tool_input: { command: 'npx playwright test' },
        tool_response: { stdout: '48 passed (1.2m)', stderr: '', interrupted: false },
      }),
    });
    noteIfIntervening('PostToolUse Bash: npx playwright test (passing)', 'post', passOut);

    const commitOut = runPre12({
      statePath, logPath,
      stdin: JSON.stringify({
        session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Bash', transcript_path: transcriptClean,
        tool_input: { command: 'git commit -m "an ordinary commit after a green session"' },
      }),
    });
    noteIfIntervening('PreToolUse Bash: git commit (session has zero uncovered failures)', 'pre', commitOut);

    const stopReplies = [
      'רואה שהבדיקה עברה, אמשיך לצעד הבא.',
      "Here's the output:\n```\n48 passed\n```\nAll green, exit code 0.",
      'האם זה עובד אצלך?',
    ];
    for (const text of stopReplies) {
      const transcript = makeTranscript12([{ atMs: Date.now(), text }], 'honestday-stop');
      const stopOut = runStop12({
        statePath, logPath,
        stdin: JSON.stringify({ session_id: sid, hook_event_name: 'Stop', transcript_path: transcript, stop_hook_active: false }),
      });
      noteIfIntervening(`Stop: "${text.slice(0, 40)}"`, 'stop', stopOut);
    }

    check(`STORY-HONEST-DAY: zero false interventions across 20 ordinary events (found ${interventions.length})`,
      interventions.length === 0,
      interventions.map((i) => `${i.label} -> ${i.stdout}`).join(' | '));
  }
}

console.log(`\n${total - failures}/${total} checks passed.`);
process.exit(failures ? 1 : 0);
