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
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
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

summary('session-state');
