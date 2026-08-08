#!/usr/bin/env node
// scripts/tests/test-session-state.mjs — self-test for scripts/session-state.mjs.
//
// This is the RED suite named directly in task-1-brief.md:
//   RED 1 (proven in test-session-brief.mjs): a ledger points at a different plan than the board
//     claims -> the output names the ACTIVE ledger's plan, never the board's.
//   RED 2 (this file): no ledger at all -> an explicit "no active arc" statement — never silence,
//     never a guess.
//   RED 3 (this file): a missing/unreadable source (register absent, git unavailable) -> that
//     field says "not established", and the REST of the report still renders (best-effort, never
//     throws, never exits non-zero).
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tempDir, writeFile, setMtime, runNode, assertExit, summary } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'session-state.mjs');

function run(env) {
  // Layer 2 (geniza) spawns a Python subprocess and hits a live DB — skipped by default here so
  // these tests stay fast and deterministic; it has its own dedicated coverage further down.
  return runNode(SCRIPT, [], { SESSION_STATE_SKIP_LAYER2: '1', ...env });
}

function noSourcesEnv(overrides = {}) {
  const missing = join(tempDir('ss-missing-'), 'does-not-exist');
  return {
    SDD_DIR: join(missing, 'sdd'),
    ROADMAP: join(missing, 'ROADMAP.md'),
    SPECS_DIR: join(missing, 'specs'),
    GITROOT: missing, // a directory with no .git — every git command fails here
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RED 2 — no ledger at all.
// ---------------------------------------------------------------------------
const r2 = run(noSourcesEnv());
assertExit('no ledger anywhere -> exit 0 (never blocks the session)', r2, 0);
if (!/⚠️ ACTIVE ARC: NONE FOUND/.test(r2.stdout)) {
  console.error('FAIL  expected an explicit "no active arc" statement, not silence or a guess');
  console.error(`      stdout: ${r2.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  RED 2: no ledger -> explicit "⚠️ ACTIVE ARC: NONE FOUND"');
}
if (!/NO TASK SHOULD BE STARTED UNTIL A HUMAN DECIDES/.test(r2.stdout)) {
  console.error('FAIL  expected item-8\'s prominent "do not start a task" banner when no arc is determinable');
  console.error(`      stdout: ${r2.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  item 8: prominent "no task should be started" banner is present, not a quiet "unknown"');
}
// and the report must still render its other sections rather than stopping short:
if (!/WAITING ON OWNER/.test(r2.stdout) || !/GOVERNING SPEC/.test(r2.stdout)) {
  console.error('FAIL  expected the rest of the report (register + spec sections) to still render with no arc');
  console.error(`      stdout: ${r2.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  the rest of the report still renders when there is no active arc');
}

// ---------------------------------------------------------------------------
// RED 3 — missing sources say "not established"; the rest of the report still renders.
// ---------------------------------------------------------------------------
const r3 = run(noSourcesEnv());
assertExit('all sources missing/unreadable -> exit 0', r3, 0);
if (!/WAITING ON OWNER \(register\): not established/.test(r3.stdout)) {
  console.error('FAIL  expected the register field to say "not established" when ROADMAP is absent');
  console.error(`      stdout: ${r3.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  RED 3a: missing register -> "not established", not a silent 0');
}
if (!/GOVERNING SPEC: not established/.test(r3.stdout)) {
  console.error('FAIL  expected GOVERNING SPEC to say "not established" when the specs dir is absent');
  console.error(`      stdout: ${r3.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  RED 3b: missing specs dir -> "not established"');
}

// RED 3c — a real ledger exists, but git itself fails (GITROOT has no .git at all): LANDED SINCE
// ARC START must say so, while ACTIVE ARC / POSITION / PLAN REMAINING still render normally.
const sddDir = join(tempDir('ss-git-fail-'), 'sdd');
mkdirSync(sddDir, { recursive: true });
writeFile(join(sddDir, 'only-arc'), 'progress.md',
  '# SDD ledger — plan: docs/superpowers/plans/only-arc.md\n\nTask 1: complete — commit abc\n');
const noGitDir = join(tempDir('ss-no-git-'), 'not-a-repo');
mkdirSync(noGitDir, { recursive: true });
const r3c = run({
  SDD_DIR: sddDir,
  ROADMAP: join(noGitDir, 'ROADMAP.md'),
  SPECS_DIR: join(noGitDir, 'specs'),
  GITROOT: noGitDir,
});
assertExit('git unavailable at GITROOT -> exit 0, does not crash the report', r3c, 0);
if (!/ACTIVE ARC: only-arc — plan docs\/superpowers\/plans\/only-arc\.md/.test(r3c.stdout)) {
  console.error('FAIL  ACTIVE ARC should still resolve from the ledger even though git fails elsewhere');
  console.error(`      stdout: ${r3c.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  RED 3c: ACTIVE ARC still resolves from the ledger when git is unavailable');
}
if (!/LANDED SINCE ARC START.*: 0 commits\.|LANDED SINCE ARC START: not established/.test(r3c.stdout)) {
  console.error('FAIL  expected LANDED SINCE ARC START to degrade gracefully (0 commits via mtime anchor, or "not established"), not crash');
  console.error(`      stdout: ${r3c.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  RED 3c: LANDED SINCE ARC START degrades gracefully when git is unavailable, rest of report intact');
}

// ---------------------------------------------------------------------------
// Positive case, for contrast: a real ledger with a "Task N: complete" line, a deferral-with-
// trigger, and a plan file with a known checkbox count all round-trip correctly. Proves the
// "if this were derived wrongly, would the output show it?" property for each field.
// ---------------------------------------------------------------------------
const posRoot = tempDir('ss-positive-');
const sdd2 = join(posRoot, 'sdd');
writeFile(join(sdd2, 'demo-arc'), 'progress.md',
  '# SDD ledger — plan: docs/superpowers/plans/demo-arc.md\n\n' +
  'Task 1: complete — commit aaa1111\n' +
  'Task 2: deferred, trigger = when the reader lands\n' +
  'Task 3: complete — commit bbb2222\n');
writeFile(join(posRoot, 'docs', 'superpowers', 'plans'), 'demo-arc.md',
  '# demo plan\n\n## Task 1\n- [x] done\n## Task 2\n- [x] done\n- [ ] not done\n## Task 3\n- [x] done\n');
writeFile(join(posRoot, 'docs'), 'ROADMAP-2026-07-30.md',
  '| R | הפריט | נחיתה | סטטוס |\n|---|---|---|---|\n' +
  '| R-501 | open item | **החלטת בעלים נדרשת** | ⚠️R נדרש-אימות |\n');
const oldSpec = writeFile(join(posRoot, 'docs', 'superpowers', 'specs'), '2026-01-01-old-spec.md', '# old\n');
setMtime(oldSpec, '2020-01-01T00:00:00Z'); // pinned clearly in the past; new-spec keeps its real "just written" mtime
writeFile(join(posRoot, 'docs', 'superpowers', 'specs'), '2026-06-01-new-spec.md', '# new\n');

const rPos = run({
  SDD_DIR: sdd2,
  ROADMAP: join(posRoot, 'docs', 'ROADMAP-2026-07-30.md'),
  SPECS_DIR: join(posRoot, 'docs', 'superpowers', 'specs'),
  GITROOT: posRoot, // no .git here either — LANDED SINCE ARC START falls back to the mtime anchor
  SESSION_STATE_ROOT: posRoot, // so the ledger's repo-relative plan path resolves inside the fixture
});
assertExit('positive fixture -> exit 0', rPos, 0);
if (!/ACTIVE ARC: demo-arc — plan docs\/superpowers\/plans\/demo-arc\.md/.test(rPos.stdout)) {
  console.error('FAIL  expected ACTIVE ARC to name demo-arc');
  console.error(`      stdout: ${rPos.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  ACTIVE ARC correctly names the (only) ledger\'s plan');
}
if (!/last recorded complete: Task 3: complete — commit bbb2222/.test(rPos.stdout)) {
  console.error('FAIL  expected POSITION to report the LAST "Task N: complete" line (Task 3), not an earlier one');
  console.error(`      stdout: ${rPos.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  POSITION reports the last recorded "Task N: complete" line, not an earlier one');
}
if (!/DEFERRALS WITH TRIGGER \(1\):/.test(rPos.stdout) || !/when the reader lands/.test(rPos.stdout)) {
  console.error('FAIL  expected the recorded deferral with its trigger to be surfaced');
  console.error(`      stdout: ${rPos.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  the deferral-with-trigger line is surfaced verbatim');
}
if (!/PLAN REMAINING: 1 unchecked box\(es\) of 4 total, across 3 "## Task" header\(s\)\./.test(rPos.stdout)) {
  console.error('FAIL  expected PLAN REMAINING to derive 1 remaining of 4 total boxes, 3 task headers, from the plan file itself');
  console.error(`      stdout: ${rPos.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  PLAN REMAINING is derived from the plan file\'s own checkbox count, not hardcoded');
}
if (!/WAITING ON OWNER \(register\): 1 — R-501/.test(rPos.stdout)) {
  console.error('FAIL  expected the open R-501 register row to be reported');
  console.error(`      stdout: ${rPos.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  WAITING ON OWNER reports the open register row');
}
if (!/GOVERNING SPEC: 2026-06-01-new-spec\.md/.test(rPos.stdout)) {
  console.error('FAIL  expected GOVERNING SPEC to pick the newer-mtime spec file, not the older one');
  console.error(`      stdout: ${rPos.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  GOVERNING SPEC picks the newest-modified spec file, not just the alphabetically-last one');
}

// ---------------------------------------------------------------------------
// Item 8 — CONTRADICTION: an active ledger exists, and the board ALSO claims a (differently-named,
// no-token-overlap) phase is active. The output must declare the contradiction explicitly rather
// than silently trusting the ledger without saying the board disagreed.
// ---------------------------------------------------------------------------
const contraRoot = tempDir('ss-contra-');
const sdd3 = join(contraRoot, 'sdd');
writeFile(join(sdd3, 'the-real-arc'), 'progress.md',
  '# SDD ledger — plan: docs/superpowers/plans/the-real-arc.md\n\nTask 1: complete\n');
writeFile(join(contraRoot, 'docs', 'superpowers', 'plans'), 'the-real-arc.md', '# plan\n- [ ] a\n');
const contraBoard = writeFile(contraRoot, 'STATUS-BOARD.md',
  '## לוח\n\n| Phase | שם | משימות | סטטוס | R |\n|---|---|---|---|---|\n' +
  '| **Phase 2 — גל 0** | totally unrelated wording | 1/7 | 🔄 **פעיל** | R-1 |\n');
const rContra = run({
  SDD_DIR: sdd3,
  BOARD: contraBoard,
  ROADMAP: join(contraRoot, 'no-roadmap.md'),
  SPECS_DIR: join(contraRoot, 'no-specs'),
  GITROOT: contraRoot,
  SESSION_STATE_ROOT: contraRoot,
});
assertExit('contradiction fixture -> exit 0 (never blocks)', rContra, 0);
if (!/⚠️ CONTRADICTION:.*גל 0.*the-real-arc/.test(rContra.stdout.replace(/\n/g, ' '))) {
  console.error('FAIL  expected an explicit CONTRADICTION line naming both the board\'s claim and the ledger\'s');
  console.error(`      stdout: ${rContra.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  item 8: board vs. ledger mismatch is DECLARED explicitly, not silently resolved');
}

// Counter-case: board's active row DOES share a token with the ledger's name -> no contradiction.
const sdd4 = join(tempDir('ss-nocontra-'), 'sdd');
writeFile(join(sdd4, 'voice-governance-arc'), 'progress.md',
  '# SDD ledger — plan: docs/superpowers/plans/voice-governance-arc.md\n\nTask 1: complete\n');
const noContraBoard = writeFile(tempDir('ss-nocontra-board-'), 'STATUS-BOARD.md',
  '## לוח\n\n| Phase | שם | משימות | סטטוס | R |\n|---|---|---|---|---|\n' +
  '| **Phase 2 — Voice Governance** | still going | 4/14 | 🔄 **פעיל** | R-62 |\n');
const rNoContra = run({
  SDD_DIR: sdd4, BOARD: noContraBoard,
  ROADMAP: join(tempDir('ss-x-'), 'no-roadmap.md'), SPECS_DIR: join(tempDir('ss-y-'), 'no-specs'),
  GITROOT: tempDir('ss-z-'),
});
assertExit('shared-token fixture -> exit 0', rNoContra, 0);
if (/CONTRADICTION/.test(rNoContra.stdout)) {
  console.error('FAIL  a board row that shares a real token ("governance"/"Governance") with the ledger name must NOT be flagged as a contradiction');
  console.error(`      stdout: ${rNoContra.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  a board claim that shares a token with the ledger name is correctly NOT flagged');
}

// ---------------------------------------------------------------------------
// Item 6 — LAYER 2 wiring: the field is present, and gracefully degrades / states "0 matches" or
// "not available" without ever crashing layer 1. Runs the real Python subprocess (not skipped here,
// deliberately, since this is layer 2's own dedicated test) against the real repo/geniza — best-
// effort by design, so this only asserts the LINE EXISTS and layer 1 rendered fully regardless.
// ---------------------------------------------------------------------------
const rLayer2 = runNode(SCRIPT, [], {}); // real ROOT, real SDD_DIR, layer 2 NOT skipped
assertExit('real repo, layer 2 included -> exit 0', rLayer2, 0);
if (!/LAYER 2 \(geniza\):/.test(rLayer2.stdout)) {
  console.error('FAIL  expected a LAYER 2 (geniza) line in the report');
  console.error(`      stdout: ${rLayer2.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  LAYER 2 (geniza) line is present and did not crash the report');
}
if (!/ACTIVE ARC:/.test(rLayer2.stdout) || !/WAITING ON OWNER/.test(rLayer2.stdout)) {
  console.error('FAIL  layer 1 sections must render fully regardless of what layer 2 returns');
  process.exitCode = 1;
} else {
  console.log('PASS  layer 1 renders fully whether or not layer 2 succeeds (never instead of it)');
}

// ---------------------------------------------------------------------------
// §6.2 — ENFORCEMENT STATE, restored after compact (task-5-brief.md, task 5 of Phase 4 Group B).
// A BEHAVIOURAL red: seed a REAL counter into a temp enforcement-state store via Task 2's own API,
// observe the announcement absent (no seed / different session), then present (matching session).
// Every fixture here uses a temp ENFORCEMENT_STATE_PATH — the rules are LIVE on Edit/Write in this
// repo right now, so seeding the REAL store would risk blocking real work, including this task's own.
// ---------------------------------------------------------------------------
const enfWork = tempDir('ss-enforcement-');

function enfStatePath(name) {
  return join(enfWork, name);
}

function healthyWatchmanLog() {
  const p = join(enfWork, 'watchman-log-healthy.jsonl');
  const line = (name) => JSON.stringify({ Name: name, Severity: 'warn', InitialOk: true, Recovered: false, FinalOk: true, ElapsedSeconds: 0.1, Detail: 'already ok', TimestampUtc: new Date().toISOString() });
  writeFileSync(p, [line('geniza-postgres'), line('rules-mirror'), line('serena')].join('\n') + '\n', 'utf8');
  return p;
}

function serenaDownWatchmanLog() {
  const p = join(enfWork, 'watchman-log-serena-down.jsonl');
  const okLine = (name) => JSON.stringify({ Name: name, Severity: 'warn', InitialOk: true, Recovered: false, FinalOk: true, ElapsedSeconds: 0.1, Detail: 'already ok', TimestampUtc: new Date().toISOString() });
  // Two entries for serena, the LATER one down — proves "last verdict wins", not "first" or "any".
  const serenaUp = JSON.stringify({ Name: 'serena', Severity: 'warn', InitialOk: true, Recovered: false, FinalOk: true, ElapsedSeconds: 0.1, Detail: 'already ok', TimestampUtc: '2026-08-08T00:00:00Z' });
  const serenaDown = JSON.stringify({ Name: 'serena', Severity: 'warn', InitialOk: false, Recovered: false, FinalOk: false, ElapsedSeconds: 90, Detail: 'recovery attempted, still down after 90s', TimestampUtc: '2026-08-08T00:01:00Z' });
  writeFileSync(p, [okLine('geniza-postgres'), okLine('rules-mirror'), serenaUp, serenaDown].join('\n') + '\n', 'utf8');
  return p;
}

async function seedFixCycle(statePath, sessionId, target, closedCycles) {
  const ES = await import(pathToFileURL(join(ROOT, 'scripts', 'hooks', 'lib', 'enforcement-state.mjs')).href);
  const db = ES.openState(statePath);
  ES.noteVerificationFailure(db, sessionId, [target]); // first failure — not yet a closed cycle
  for (let i = 0; i < closedCycles; i++) {
    ES.noteEdit(db, sessionId, '/fixture-edit.js');
    ES.noteVerificationFailure(db, sessionId, [target]); // edit -> failure closes one cycle
  }
  db.close();
}

function runWithEnf(extraEnv) {
  return run({
    ROADMAP: join(enfWork, 'no-roadmap.md'),
    SPECS_DIR: join(enfWork, 'no-specs'),
    GITROOT: enfWork,
    ...extraEnv,
  });
}

// RED — a target with 2 closed fix cycles, matching session_id, healthy infra -> the §5 line names
// the target and "2 of 3" (the SAME 3 fix-cycle-limit.mjs itself blocks the 4th attempt on).
{
  const p = enfStatePath('red.sqlite');
  await seedFixCycle(p, 'sess-enf-red', 'tests/test_x.py::test_y', 2);
  const r = runWithEnf({
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-red',
    WATCHMAN_LOG: healthyWatchmanLog(),
  });
  assertExit('§6.2 RED: exit 0', r, 0);
  if (!/§5\s+fix attempts on `tests\/test_x\.py::test_y`: 2 of 3/.test(r.stdout)) {
    console.error('FAIL  expected the exact §5 line naming the target and "2 of 3"');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 RED: §5 line reads the SAME counter fix-cycle-limit.mjs would block on');
  }
  if (!/§10\.16\s+failures this arc: \d+ · lessons: see commit gate/.test(r.stdout)) {
    console.error('FAIL  expected the §10.16 line with the stated Task-6 placeholder');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2: §10.16 line present with the documented lessons placeholder');
  }
  if (!/=== ENFORCEMENT STATE, restored after compact ===/.test(r.stdout)) {
    console.error('FAIL  expected the full restored-after-compact header when a counter is open');
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2: full block header present when there is something to report');
  }

  // Absence proof, same fixture, WRONG session_id -> the counter is invisible (session-scoped by
  // construction, matching enforcement-state.mjs's own cross-session guarantee) -> collapses to the
  // one-line "nothing to report" form instead of falsely showing another session's counter.
  const rOther = runWithEnf({
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-different',
    WATCHMAN_LOG: healthyWatchmanLog(),
  });
  assertExit('§6.2 RED (absence proof): exit 0', rOther, 0);
  if (/tests\/test_x\.py::test_y/.test(rOther.stdout)) {
    console.error('FAIL  a different session must NOT see sess-enf-red\'s open counter');
    console.error(`      stdout: ${rOther.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 RED (absence proof): a different session_id does not see another session\'s counter');
  }
}

// RED-2 — watchman's LAST serena record is down -> the infra line names it, verbatim "serena
// DISCONNECTED ⚠", and picks the LAST record (not the first, which was up).
{
  const p = enfStatePath('red2.sqlite');
  const r = runWithEnf({
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-red2',
    WATCHMAN_LOG: serenaDownWatchmanLog(),
  });
  assertExit('§6.2 RED-2: exit 0', r, 0);
  if (!/serena DISCONNECTED ⚠/.test(r.stdout)) {
    console.error('FAIL  expected the infra line to name serena DISCONNECTED ⚠ from its LAST watchman record');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 RED-2: infra line surfaces serena DISCONNECTED ⚠ from the newest watchman verdict');
  }
  if (!/geniza OK/.test(r.stdout) || !/rules mirror OK/.test(r.stdout)) {
    console.error('FAIL  expected the OTHER two infra components to still read OK');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 RED-2: the two healthy components are NOT dragged down by serena\'s failure');
  }
}

// COUNTER-RED — empty state DB (no rows for this session) + healthy watchman log -> the single "no
// open counters" line, nothing that could be misread as a warning, and no full block header (a wall
// of zeroes trains people to skip the section).
{
  const p = enfStatePath('counter-red.sqlite'); // never seeded — openState() creates an empty schema
  const r = runWithEnf({
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-counter',
    WATCHMAN_LOG: healthyWatchmanLog(),
  });
  assertExit('§6.2 COUNTER-RED: exit 0', r, 0);
  if (!/ENFORCEMENT STATE: no open counters, no uncovered failures\./.test(r.stdout)) {
    console.error('FAIL  expected the exact one-line "no open counters" statement');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED: all-zero counters + healthy infra collapse to one short line');
  }
  if (/=== ENFORCEMENT STATE, restored after compact ===/.test(r.stdout)) {
    console.error('FAIL  the all-zero case must NOT also print the full block header');
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED: no full-block header printed when there is nothing to report');
  }
  if (/⚠/.test(r.stdout.split('ENFORCEMENT STATE: no open counters')[1]?.split('\n')[0] ?? '')) {
    console.error('FAIL  the one-line "nothing to report" statement must contain nothing warning-shaped');
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED: the one-line statement contains nothing that reads as a warning');
  }
}

// COUNTER-RED-2 (fail-open) — ENFORCEMENT_STATE_PATH points at a garbage (non-SQLite) file -> the
// section renders the exact stated-unreadable line, and the SCRIPT STILL EXITS 0 (orientation is not
// a gate — enforcement-state.mjs's own fail-open contract, inherited here verbatim).
{
  const p = enfStatePath('garbage.sqlite');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, 'not a sqlite file, just garbage bytes 1234567890', 'utf8');
  const r = runWithEnf({
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-garbage',
    WATCHMAN_LOG: healthyWatchmanLog(),
  });
  assertExit('§6.2 COUNTER-RED-2 (fail-open): exit 0 even with an unreadable store', r, 0);
  if (!/ENFORCEMENT STATE: state store unreadable — counters unknown, not asserted/.test(r.stdout)) {
    console.error('FAIL  expected the exact fail-open statement when the store is corrupt/unreadable');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED-2: a corrupt/unreadable store degrades to the exact stated fail-open line, never a crash, never a false zero presented as a fact');
  }
  // The rest of the report must still render — orientation is not a gate, per this script's own header.
  if (!/GOVERNING SPEC/.test(r.stdout)) {
    console.error('FAIL  the rest of the report must still render when enforcement state is unreadable');
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED-2: the rest of session-state\'s report still renders around the failure');
  }
}

// COUNTER-RED-3 — missing/unreadable watchman log (never a crash): infra degrades to "not
// available", the rest of the block (which DOES have an open counter here) still renders.
{
  const p = enfStatePath('no-watchman.sqlite');
  await seedFixCycle(p, 'sess-enf-nowatchman', 'some/target.py::test_z', 1);
  const r = runWithEnf({
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-nowatchman',
    WATCHMAN_LOG: join(enfWork, 'does-not-exist-watchman-log.jsonl'),
  });
  assertExit('§6.2 COUNTER-RED-3: exit 0 even with a missing watchman log', r, 0);
  if (!/infra\s+not available/.test(r.stdout)) {
    console.error('FAIL  expected the infra line to degrade to "not available" when the watchman log is missing');
    console.error(`      stdout: ${r.stdout}`);
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED-3: missing watchman log degrades infra to "not available" without crashing');
  }
  if (!/fix attempts on `some\/target\.py::test_z`: 1 of 3/.test(r.stdout)) {
    console.error('FAIL  expected the §5 line to still render even though infra could not be read');
    process.exitCode = 1;
  } else {
    console.log('PASS  §6.2 COUNTER-RED-3: the §5 counter still renders when only infra failed to read');
  }
}

// TIMING — the cost this section adds to session-state's own SessionStart budget (measured at
// ~270ms baseline per task-5-brief.md; this must stay in that neighbourhood).
{
  const p = enfStatePath('timing.sqlite');
  await seedFixCycle(p, 'sess-enf-timing', 'timing/target.py::test_t', 1);
  const env = {
    ENFORCEMENT_STATE_PATH: p,
    SESSION_STATE_SESSION_ID: 'sess-enf-timing',
    WATCHMAN_LOG: healthyWatchmanLog(),
    ROADMAP: join(enfWork, 'no-roadmap.md'),
    SPECS_DIR: join(enfWork, 'no-specs'),
    GITROOT: enfWork,
  };
  run(env); // warm-up
  const N = 5;
  const samples = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const r = run(env);
    samples.push(Date.now() - t0);
    if (r.status !== 0) { console.error(`FAIL  timing sample #${i + 1}: expected exit 0, got ${r.status}`); process.exitCode = 1; }
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`\n§6.2 SESSION-STATE + ENFORCEMENT STATE TIMING (full script, layer 2 skipped, ${N} samples, sorted, ms): [${samples.join(', ')}] — median ${median}ms`);
}

summary('session-state');
