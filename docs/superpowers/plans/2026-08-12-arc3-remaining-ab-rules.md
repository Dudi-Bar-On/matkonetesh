# Arc 3 — the 42 remaining A/B rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining 42 open A/B rules (of 91 mechanically-enforceable rules) that
`scripts/check-rule-coverage.mjs` currently counts as uncovered, in the phase order the owner fixed
on 2026-08-12 (not reopened here), so that `RULE COVERAGE: 91 of 91` becomes true.

**Architecture:** Every rule closes the same way regardless of phase: (1) verify or write a real
detector — a hook file under `scripts/hooks/{rules,stop-rules,observers}/` for a
`pretooluse:*`/`posttooluse`/`stop`/`subagentstop`/`sessionstart` mechanism, or a standalone
`scripts/check-*.mjs` wired into `scripts/check-meta.mjs` for a `commit-gate`/`ci-gate` mechanism —
(2) declare `export const RULE_IDS = [...]` in that file, (3) write a catch test and a false-alarm
test (§3.1), (4) write one no-env-override liveness test per phase (§3.4), (5) measure overhead
against the 61ms baseline (§3.5), (6) run `npx playwright test` and `pytest` clean.

**Tech Stack:** Node.js (`.mjs`, `node:test`-free custom `scripts/tests/test-helpers.mjs` harness,
matching every existing `scripts/tests/test-check-*.mjs`), Python (`pytest` for the hook pipeline's
own suite where a rule lands in `scripts/hooks/**`), SQLite (`rules.sqlite`, read-only from every
gate), git (`execSync`/`execFileSync` for commit-history-driven rules).

## Global Constraints

Copied verbatim from the governing spec, `docs/superpowers/specs/2026-08-09-arc2-enforcement-implementation-design.md` §3, which is generic and binds every rule in this arc (Arc 3 gets no spec of its own):

- **§3.1** — a false-alarm test, **mandatory, per rule**. For each rule: a catch test (it fires on a
  real violation) and a false-alarm test, the second run **against real history, not fabricated
  input**. A rule without a false-alarm test is not considered implemented.
- **§3.2** — per-rule severity, **reasoned in code**. Owner's instruction: warn if the harm is to
  efficiency/performance; block if the harm is to substance or to the ability to perform an action
  with no compatible alternative; **never** a bypass mechanism, only a less-efficient path to the
  same work. Every block names an accessible alternative (§10.24) — a block whose reasoning offers
  no path forward is a work-stoppage, not enforcement. Severity is chosen **per rule** and reasoned
  in code, never inherited from the A/B group label.
- **§3.3** — a `RULE_IDS` declaration. Every rule file declares `export const RULE_IDS = [...]`; the
  coverage gate already requires this of the 16 pre-existing files. This is the cure for "shipped
  inert" — a rule implemented without the declaration falls immediately.
- **§3.4** — a liveness test through the **real entry point, with no environment overrides**. Task 9
  of Phase 4 (Arc 2) shipped an inert `stop` rule: `stop.mjs` only set `rulesDir` when
  `STOP_RULES_DIR` (a test-only env var) was defined, so 333 tests passed against a feature that
  never loaded in a real run. Every phase carries one test that runs the CLI with **no environment
  override at all**.
- **§3.5** — measured overhead, reported per phase, against the baseline of **61ms worst case**
  (measured in Arc 2 Phase 4). A material increase is investigated, not noted and moved past.

Also binding, from the same spec's §5 finish conditions:

- Every rule counted by the coverage gate (`node scripts/check-rule-coverage.mjs`).
- A catch test AND a false-alarm test, both green, both pasted into the task's evidence — per rule.
- **0 false alarms** on the history examined.
- One no-env-override liveness test per phase.
- Overhead measured per phase.
- `npx playwright test` and `pytest` both clean at the end of each phase.

**Waiver Gate (project CLAUDE.md §4):** none of the above may be narrowed, deferred, or
reinterpreted by this plan. Any conflict between a task below and this section is a plan defect, not
license to skip the requirement.

**Declaration discipline (owner brief, non-negotiable for Phase 1):** a declaration must be earned,
not asserted. For each of the seven Phase 1 rules, the order is always (a) verify the script actually
performs that rule's check, (b) write the two §3.1 tests, (c) only then add the `RULE_IDS` line. No
task in Phase 1 may consist of only adding the export.

---

## Phase 1 — the seven already enforced but undeclared

`10.11` `10.12` `H8` `H10` `H14` `L29` `L25`. Not "quick wins": a gate is already working for each of
these and nothing counts it, so the coverage metric is **under-reporting by seven**. Correcting a
wrong measurement before building on it is the right order — this is why it runs first, not because
it is cheap.

### Task 1: Declare `10.11` on `geniza-fallback-declaration.mjs`

**Files:**
- Modify: `scripts/hooks/rules/geniza-fallback-declaration.mjs:43` (currently
  `export const RULE_IDS = ['10.13'];`)
- Test: `scripts/tests/test-geniza-fallback-declaration-10-11.mjs` (new)

**Interfaces:**
- Consumes: `evaluate(input)` already exported by the file, same shape used by every other
  `pretooluse` rule (`{ decision: 'allow'|'warn'|'block', reason: string }`).
- Produces: nothing new for later tasks — this rule is self-contained.

- [ ] **Step 1: Verify the script performs 10.11's check, not just 10.13's**

Read `docs/process/development-discipline.md` §10.11 to confirm the exact ask: "Query the geniza for
any documentation or external help — a tool, framework, methodology, an API's capabilities, a
vendor's model specs — before searching the web." The file's `WebSearch` branch (line ~97,
`targetedDecision()` returns `{ targeted: true, matchedCandidate: null }` unconditionally for
`WebSearch`) already performs exactly this: any `WebSearch` call is `targeted`, and then
`evaluate()` checks `genizaConsultedRecently()` and warns when the geniza was not queried recently.
This is 10.11's exact mechanism (`pretooluse:Grep|WebSearch`), sharing the file with 10.13's narrower
docs-Grep-only check.

- [ ] **Step 2: Write the catch test**

```javascript
// scripts/tests/test-geniza-fallback-declaration-10-11.mjs
import { evaluate } from '../hooks/rules/geniza-fallback-declaration.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// CATCH: a WebSearch with no geniza consultation anywhere in the transcript must warn, citing 10.11.
const dir = mkdtempSync(join(tmpdir(), '10-11-catch-'));
const transcriptPath = join(dir, 'transcript.jsonl');
writeFileSync(transcriptPath, JSON.stringify({
  type: 'assistant', message: { content: [{ type: 'text', text: 'let me search the web' }] },
}) + '\n', 'utf8');

const result = evaluate({
  tool_name: 'WebSearch',
  tool_input: { query: 'gemini 3.6 flash pricing' },
  transcript_path: transcriptPath,
});
if (result.decision !== 'warn' || !/10\.11|10\.13/.test(result.reason)) {
  console.error(`FAIL  expected warn citing the geniza-first rule, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  WebSearch with no prior geniza consult -> warn');
}
```

- [ ] **Step 3: Run the catch test to confirm it fails for the right reason before the fix, then passes**

Run: `node scripts/tests/test-geniza-fallback-declaration-10-11.mjs`
Expected before Step 1's declaration exists: the test already PASSES (the mechanism is real and
pre-existing — this is the "already enforced" class, not a RED/GREEN cycle on new code). Record this
observed PASS as the evidence that the mechanism, not just the declaration, is what Step 4 makes
countable.

- [ ] **Step 4: Write the false-alarm test against real history**

```javascript
// appended to scripts/tests/test-geniza-fallback-declaration-10-11.mjs
// FALSE-ALARM: a WebSearch immediately after a real search_current_docs call in the same
// transcript must NOT warn — this is legitimate geniza-first behavior, not a bypass.
const dir2 = mkdtempSync(join(tmpdir(), '10-11-false-alarm-'));
const transcriptPath2 = join(dir2, 'transcript.jsonl');
writeFileSync(transcriptPath2, [
  JSON.stringify({ type: 'assistant', message: { content: [
    { type: 'tool_use', name: 'Bash', input: { command: 'python -c "from src.knowledge import retrieval; retrieval.search_current_docs(\'gemini pricing\')"' } },
  ] } }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'geniza had nothing, now the web' }] } }),
].join('\n') + '\n', 'utf8');

const result2 = evaluate({
  tool_name: 'WebSearch',
  tool_input: { query: 'gemini 3.6 flash pricing' },
  transcript_path: transcriptPath2,
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  expected allow after a real geniza consult, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  WebSearch after a real geniza consult -> allow (no false alarm)');
}
```

- [ ] **Step 5: Run both tests, paste output**

Run: `node scripts/tests/test-geniza-fallback-declaration-10-11.mjs`
Expected: both PASS lines printed, exit code 0.

- [ ] **Step 6: Add the declaration**

```javascript
export const RULE_IDS = ['10.13', '10.11'];
```

- [ ] **Step 7: Run the coverage gate to confirm `10.11` is now counted**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 50 of 91 mechanically-enforceable rules covered (41 open)` (up from 49/91).

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/geniza-fallback-declaration.mjs scripts/tests/test-geniza-fallback-declaration-10-11.mjs
git commit -m "feat(Arc 3 Phase 1, Task 1): declare 10.11 on geniza-fallback-declaration.mjs"
```

### Task 2: Declare `10.12` on `check-geniza-fresh.mjs`

**Files:**
- Modify: `scripts/check-geniza-fresh.mjs` (add `export const RULE_IDS` near the top, after imports)
- Test: `scripts/tests/test-check-geniza-fresh-10-12.mjs` (new)

**Interfaces:**
- Consumes: the file's existing `CHECK_GENIZA_PY` stub-interpreter test seam (already documented in
  the file's own header) — the test drives verdict branches without a live PostgreSQL connection.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Verify the script performs 10.12's check**

`docs/process/development-discipline.md` §10.12: "Keep the geniza current: `python scripts/ingest.py
--scope` (delta by content hash — unchanged files are skipped). `node scripts/check-geniza-fresh.mjs`
is the gate and it blocks." The `mechanism_target` in the ranking doc names this exact script. Its
current behavior (read above) computes a content-hash diff between disk and the geniza's
`document_revisions.content_hash`, and self-heals + fails if the repair itself fails — this is 10.12
verbatim, already wired BLOCKING into `check-meta.mjs:115`.

- [ ] **Step 2: Write the catch test using the existing stub seam**

```javascript
// scripts/tests/test-check-geniza-fresh-10-12.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-geniza-fresh.mjs');

// CATCH: a stub Python interpreter that reports a stale doc and a failed repair must FAIL the gate.
function runWithStub(stubScriptBody) {
  const { mkdtempSync, writeFileSync, chmodSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'geniza-fresh-stub-'));
  const stubPath = join(dir, process.platform === 'win32' ? 'python-stub.cmd' : 'python-stub.sh');
  writeFileSync(stubPath, stubScriptBody, 'utf8');
  if (process.platform !== 'win32') chmodSync(stubPath, 0o755);
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, CHECK_GENIZA_PY: stubPath },
  });
}

const staleStub = process.platform === 'win32'
  ? '@echo off\r\necho {"disk": 1, "stored": 1, "missing": [], "stale": ["docs/x.md"], "orphaned": [], "pending_extraction": 0}\r\n'
  : '#!/bin/sh\necho \'{"disk": 1, "stored": 1, "missing": [], "stale": ["docs/x.md"], "orphaned": [], "pending_extraction": 0}\'\n';
const r1 = runWithStub(staleStub);
if (r1.status === 0) {
  console.error(`FAIL  expected nonzero exit on a stale doc whose repair the stub cannot perform, got 0: ${r1.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  stale document reported by the geniza query -> gate does not report clean');
}
```

- [ ] **Step 3: Run it, confirm the catch case fails for the right reason**

Run: `node scripts/tests/test-check-geniza-fresh-10-12.mjs`
Expected: `PASS` line printed (the mechanism already blocks on a stale doc whose repair attempt itself
cannot run through a fixed stub, since the stub always returns the same stale reading — this proves
the gate does not silently report OK).

- [ ] **Step 4: Write the false-alarm test — a clean run must not warn**

```javascript
// appended to scripts/tests/test-check-geniza-fresh-10-12.mjs
const cleanStub = process.platform === 'win32'
  ? '@echo off\r\necho {"disk": 845, "stored": 845, "missing": [], "stale": [], "orphaned": [], "pending_extraction": 0}\r\n'
  : '#!/bin/sh\necho \'{"disk": 845, "stored": 845, "missing": [], "stale": [], "orphaned": [], "pending_extraction": 0}\'\n';
const r2 = runWithStub(cleanStub);
if (r2.status !== 0) {
  console.error(`FAIL  expected exit 0 on a fully-synced geniza, got ${r2.status}: ${r2.stdout}${r2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  fully-synced geniza (845/845, no drift) -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run both, paste output**

Run: `node scripts/tests/test-check-geniza-fresh-10-12.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 6: Add the declaration**

```javascript
// after the import block, before the PY template literal
export const RULE_IDS = ['10.12'];
```

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 51 of 91 ... (40 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-geniza-fresh.mjs scripts/tests/test-check-geniza-fresh-10-12.mjs
git commit -m "feat(Arc 3 Phase 1, Task 2): declare 10.12 on check-geniza-fresh.mjs"
```

### Task 3: Declare `H8` on `check-h8-ledger.mjs`

**Files:**
- Modify: `scripts/check-h8-ledger.mjs` (add `export const RULE_IDS = ['H8'];` after the import block)
- Test: `scripts/tests/test-check-h8-ledger-declaration.mjs` (new — the existing
  `test-check-h8-ledger.mjs` and `test-check-h8-ledger-worsening.mjs` already are H8's catch tests;
  this task adds the false-alarm test the brief itself uses as its worked example)

**Interfaces:**
- Consumes: `analyze(text)` is internal (not exported); the test drives the script only via
  `runNode(SCRIPT, [], { ROADMAP: fixturePath })`, matching the existing two test files' pattern.
- Produces: nothing new.

- [ ] **Step 1: Verify — already done by the two existing test files**

`scripts/tests/test-check-h8-ledger.mjs` is the catch test (a §5a row with empty landing+status ->
exit 1) and already exists, already green. This is H8's own worked example in the brief: "the
brief's own worked example, confirmed."

- [ ] **Step 2: Confirm the existing catch test still passes**

Run: `node scripts/tests/test-check-h8-ledger.mjs`
Expected: both PASS lines (bad->exit 1 naming R-1, good->exit 0 reporting the scan count), exit 0.

- [ ] **Step 3: Write the false-alarm test — a fully-answered roadmap must not block**

```javascript
// scripts/tests/test-check-h8-ledger-declaration.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode, assertExit } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-h8-ledger.mjs');

// FALSE-ALARM: a real §5 + §5a shape, all rows landed or closed, must pass cleanly with NO findings
// -- this is the shape the roadmap is in on a good day, and the gate must stay quiet on it.
const road = `## 5 · ledger

| Phase | closes | Δ | cumulative |
|---|---|---|---|
| Phase 1 | X-1 | 1 | 1 |
| Phase 2 | X-2 | 1 | 2 |
| Phase 3 | X-3 | 1 | 3 |
| Phase 4 | X-4 | 1 | 4 |
| Phase 5 | X-5 | 1 | 5 |
| Phase 6 | X-6 | 1 | 6 |
| Phase 7 | X-7 | 1 | 7 |
| Phase 8 | X-8 | 1 | 8 |
| Phase 9 | X-9 | 1 | 9 |
| Phase 10 | X-10 | 1 | 10 |
| Phase 11 | X-11 | 1 | 11 |

**יעד H8 הושג: 0 פריטים ללא נחיתה**

הנותרים:
- item A — טריגר: something happens

## 5a · recovery ledger

| R | item | pointer | נחיתה | סטטוס |
|---|---|---|---|---|
| R-1 | closed long ago | pointer | R-cancelled | ❌ |
| R-2 | landed cleanly | pointer | Phase 4 | ⚠️R נדרש-אימות |
`;
const path = writeFile(tempDir('h8-false-alarm-'), 'roadmap-clean.md', road);
const result = runNode(SCRIPT, [], { ROADMAP: path });
assertExit('fully-answered §5/§5a -> exit 0, no false alarm', result, 0);
```

- [ ] **Step 4: Run it, paste output**

Run: `node scripts/tests/test-check-h8-ledger-declaration.mjs`
Expected: `PASS  fully-answered §5/§5a -> exit 0, no false alarm`, exit code 0.

- [ ] **Step 5: Add the declaration**

```javascript
// after the import block
export const RULE_IDS = ['H8'];
```

- [ ] **Step 6: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 52 of 91 ... (39 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-h8-ledger.mjs scripts/tests/test-check-h8-ledger-declaration.mjs
git commit -m "feat(Arc 3 Phase 1, Task 3): declare H8 on check-h8-ledger.mjs"
```

### Task 4: Declare `H10` on `check-board-fresh.mjs` and `check-shipped-closed.mjs`

**Files:**
- Modify: `scripts/check-board-fresh.mjs` (add `export const RULE_IDS = ['H10'];` after imports)
- Modify: `scripts/check-shipped-closed.mjs` (add `export const RULE_IDS = ['H10'];` after imports)
- Test: `scripts/tests/test-check-board-fresh-h10.mjs` (new)
- Test: `scripts/tests/test-check-shipped-closed-h10.mjs` (new)

**Interfaces:**
- Consumes: both scripts already accept `BOARD`/`GITROOT`/`ROADMAP`/`RELEASES_DIR` env overrides for
  fixture-driven testing (documented in each file's own header).
- Produces: nothing new. H10 is declared in two files by design — `check-rule-coverage.mjs`'s
  `declaredIdToFiles` map is keyed by id to a `Set` of files, so one id in two files is not an error.

- [ ] **Step 1: Verify `check-board-fresh.mjs` performs H10's check**

H10 (project CLAUDE.md): "living `docs/STATUS-BOARD.md`: phase/task status + gap ledger +
distance-to-completion; updated at every task close." `check-board-fresh.mjs` verifies the board's
`בסיס: vNNN` matches the newest `release(v` commit, and in `--currency` mode cross-checks
`COVERAGE-DECLARED` against the live coverage measurement, every `.superpowers/sdd/` arc named in
the board, and `LIVE-VERSION`/`TARGET-VERSION` presence — this is H10's "living" requirement,
mechanically checked.

- [ ] **Step 2: Write the catch test for `check-board-fresh.mjs`**

```javascript
// scripts/tests/test-check-board-fresh-h10.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode, assertExit } from './test-helpers.mjs';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-board-fresh.mjs');

// CATCH: board says v280, but the newest release(v commit in this repo's own git log is higher.
const dir = tempDir('board-fresh-catch-');
const boardPath = writeFile(dir, 'STATUS-BOARD.md', '# Status\n\nבסיס: v280\n');
const result = runNode(SCRIPT, [], { BOARD: boardPath, GITROOT: ROOT });
if (result.status === 0) {
  console.error(`FAIL  expected nonzero exit — board claims a stale base version, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  board base version behind the newest release(v commit -> exit 1');
}
```

- [ ] **Step 3: Write the false-alarm test — board matching the real newest release commit must pass**

```javascript
// appended to scripts/tests/test-check-board-fresh-h10.mjs
const log = execSync('git -c log.showsignature=false log --format=%s -n 500', { cwd: ROOT, encoding: 'utf8' });
const versions = [...log.matchAll(/^release\(v(\d+)\)/gm)].map(m => Number(m[1]));
if (versions.length) {
  const latest = Math.max(...versions);
  const dir2 = tempDir('board-fresh-false-alarm-');
  const boardPath2 = writeFile(dir2, 'STATUS-BOARD.md', `# Status\n\nבסיס: v${latest}\n`);
  const result2 = runNode(SCRIPT, [], { BOARD: boardPath2, GITROOT: ROOT });
  assertExit(`board base matches real newest release(v${latest}) -> exit 0, no false alarm`, result2, 0);
} else {
  console.log('SKIPPED false-alarm case — no release(v commits in this checkout\'s log window');
}
```

- [ ] **Step 4: Run it, paste output**

Run: `node scripts/tests/test-check-board-fresh-h10.mjs`
Expected: two PASS lines (or one PASS + one SKIPPED, stated plainly if the log window is empty),
exit code 0.

- [ ] **Step 5: Verify `check-shipped-closed.mjs` performs H10's other half**

The same H10 rule ("a shipped ledger row may not stay open") is also enforced by
`check-shipped-closed.mjs`, which compares closure claims in `release(v` commits / release reports
against the ledger's own status cells.

- [ ] **Step 6: Write the catch test for `check-shipped-closed.mjs`**

```javascript
// scripts/tests/test-check-shipped-closed-h10.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-shipped-closed.mjs');

// CATCH: a release commit claims to close R-999, but the ledger still shows it open.
const dir = tempDir('shipped-closed-catch-');
const roadPath = writeFile(dir, 'roadmap.md', '## 5a\n\n| R | item | pointer | נחיתה | סטטוס |\n|---|---|---|---|---|\n| R-999 | test row | p | Phase 1 | פתוח |\n');
execSync('git init -q', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "release(v999) סוגר את R-999"', { cwd: dir });
const result = runNode(SCRIPT, [], { ROADMAP: roadPath, GITROOT: dir, RELEASES_DIR: join(dir, 'releases-missing') });
if (result.status === 0) {
  console.error(`FAIL  expected nonzero exit — claimed-closed row still open in ledger, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  release commit claims R-999 closed, ledger disagrees -> exit 1');
}
```

- [ ] **Step 7: Write the false-alarm test — no claim, nothing to contradict**

```javascript
// appended to scripts/tests/test-check-shipped-closed-h10.mjs
const dir2 = tempDir('shipped-closed-false-alarm-');
const roadPath2 = writeFile(dir2, 'roadmap.md', '## 5a\n\n| R | item | pointer | נחיתה | סטטוס |\n|---|---|---|---|---|\n| R-998 | untouched row | p | Phase 2 | פתוח |\n');
execSync('git init -q', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "chore: unrelated commit"', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { ROADMAP: roadPath2, GITROOT: dir2, RELEASES_DIR: join(dir2, 'releases-missing') });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — no closure claim anywhere, nothing to contradict, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  no closure claim in history -> exit 0, no false alarm on an untouched open row');
}
```

- [ ] **Step 8: Run it, paste output**

Run: `node scripts/tests/test-check-shipped-closed-h10.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 9: Add both declarations**

```javascript
// scripts/check-board-fresh.mjs, after imports
export const RULE_IDS = ['H10'];
```
```javascript
// scripts/check-shipped-closed.mjs, after imports
export const RULE_IDS = ['H10'];
```

- [ ] **Step 10: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 53 of 91 ... (38 open)` — one id, two files, +1 to the count (matches the
scanner's `Set`-per-id de-duplication, confirmed by reading `check-rule-coverage.mjs` Step 4 above).

- [ ] **Step 11: Commit**

```bash
git add scripts/check-board-fresh.mjs scripts/check-shipped-closed.mjs scripts/tests/test-check-board-fresh-h10.mjs scripts/tests/test-check-shipped-closed-h10.mjs
git commit -m "feat(Arc 3 Phase 1, Task 4): declare H10 on check-board-fresh.mjs and check-shipped-closed.mjs"
```

**Unusual case, as flagged by the owner:** H10 is enforced against `docs/STATUS-BOARD.md`, not
against ordinary commits, so Phase 1's liveness test (Task 7 below) exercises it by running
`check-board-fresh.mjs` directly against the real `docs/STATUS-BOARD.md`, not via a synthetic commit.

### Task 5: Declare `H14` and `L29` on `check-release.mjs`

**Files:**
- Modify: `scripts/check-release.mjs` (add `export const RULE_IDS = ['H14', 'L29'];` after imports)
- Test: `scripts/tests/test-check-release-h14-l29.mjs` (new)

**Interfaces:**
- Consumes: `evaluate(subject, body, versionNum, treeRef)` is internal (not exported); tests drive
  the script only through its two CLI modes (HOOK mode: `node check-release.mjs <msgfile>`; AUDIT
  mode: no arg), matching the file's own documented modes.
- Produces: nothing new.

- [ ] **Step 1: Verify the script performs both rules' checks**

H14 (project CLAUDE.md, release UX report): `check-release.mjs`'s `evaluate()` requires
`docs/releases/vNNN-ux-report.md` present in/before the release commit's tree — this is H14 verbatim.
L29 (§11 lessons log, "on the tree being shipped" phrase requirement): `evaluate()`'s
`hasTreeShipped` check is `/on the tree being shipped/i.test(body)` — this is L29's own clause,
matched literally.

- [ ] **Step 2: Write the catch test for H14 (missing UX report)**

```javascript
// scripts/tests/test-check-release-h14-l29.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile } from './test-helpers.mjs';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-release.mjs');

function runHook(dir, msgBody) {
  const msgPath = writeFile(dir, 'COMMIT_EDITMSG', msgBody);
  return spawnSync(process.execPath, [SCRIPT, msgPath], { cwd: dir, encoding: 'utf8' });
}

// CATCH (H14): message satisfies H7/DoD-12/L29 but the report file is absent from the tree.
const dir = tempDir('release-h14-catch-');
execSync('git init -q', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m init', { cwd: dir });
const badMsg = 'release(v999) something\n\nexit 0\nexit 0\non the tree being shipped\n';
const r1 = runHook(dir, badMsg);
if (r1.status === 0) {
  console.error(`FAIL  expected exit 1 — H14 report absent from the tree, got 0: ${r1.stdout}`);
  process.exitCode = 1;
} else if (!/H14/.test(r1.stdout + r1.stderr)) {
  console.error(`FAIL  exit was nonzero but did not name H14: ${r1.stdout}${r1.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  release(v999) commit with no docs/releases/v999-ux-report.md staged -> exit 1, names H14');
}
```

- [ ] **Step 3: Write the catch test for L29 (missing tree-shipped phrase)**

```javascript
// appended to scripts/tests/test-check-release-h14-l29.mjs
// CATCH (L29): message has two exit-0 mentions and the H14 report staged, but no
// "on the tree being shipped" phrase.
const dir2 = tempDir('release-l29-catch-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'docs/releases/v999-ux-report.md', '# report');
execSync('git add -A', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir2 });
const badMsg2 = 'release(v999) something\n\nexit 0\nexit 0\n';
const r2 = runHook(dir2, badMsg2);
if (r2.status === 0 || !/L29/.test(r2.stdout + r2.stderr)) {
  console.error(`FAIL  expected exit 1 naming L29, got status=${r2.status}: ${r2.stdout}${r2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  release(v999) commit missing "on the tree being shipped" -> exit 1, names L29');
}
```

- [ ] **Step 4: Write the false-alarm test — a fully-compliant release commit must pass both**

```javascript
// appended to scripts/tests/test-check-release-h14-l29.mjs
const dir3 = tempDir('release-clean-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'docs/releases/v999-ux-report.md', '# report');
execSync('git add -A', { cwd: dir3 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir3 });
const goodMsg = 'release(v999) something\n\nexit 0\nexit 0\non the tree being shipped\n';
const r3 = runHook(dir3, goodMsg);
if (r3.status !== 0) {
  console.error(`FAIL  expected exit 0 on a fully-compliant release message, got ${r3.status}: ${r3.stdout}${r3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  compliant release(v999) commit (H7 x2, DoD-12, L29, H14 report staged) -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-release-h14-l29.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Add the declaration**

```javascript
export const RULE_IDS = ['H14', 'L29'];
```

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 55 of 91 ... (36 open)` (+2 for H14 and L29 together).

- [ ] **Step 8: Commit**

```bash
git add scripts/check-release.mjs scripts/tests/test-check-release-h14-l29.mjs
git commit -m "feat(Arc 3 Phase 1, Task 5): declare H14 and L29 on check-release.mjs"
```

**Unusual case, as flagged by the owner:** H14 and L29 are enforced only on `release(v` commits, not
ordinary task commits. Phase 1's liveness test (Task 7) exercises this rule via `check-release.mjs`'s
own AUDIT mode against the real repo's git log (no env override), which is the entry point that runs
without a synthetic commit and without `GITROOT`/`ROADMAP` substitution.

### Task 6: Declare `L25` on `agent-concurrency-ceiling.mjs`

**Files:**
- Modify: `scripts/hooks/rules/agent-concurrency-ceiling.mjs:38` (currently
  `export const RULE_IDS = ['10.5a'];`)
- Test: `scripts/tests/test-agent-concurrency-ceiling-l25.mjs` (new)

**Interfaces:**
- Consumes: `evaluate(input)` exported by the file (same `{decision, reason}` shape).
- Produces: nothing new.

- [ ] **Step 1: Verify — read L25's incident text and the ceiling's numbers side by side**

L25 (per the ranking doc): an incident of ~50 agents dispatched, ~25 concurrently live. The file's
`HARD_CEILING = 5` blocks the 6th concurrently-live dispatch — any dispatch pattern matching L25's
incident shape (many agents, double-digit concurrency) trips this ceiling long before reaching 25.
This is the same mechanism point (`pretooluse:Agent`) and the same numeric substance L25 asks for.

- [ ] **Step 2: Write the catch test — 6 concurrently-live agents must block**

```javascript
// scripts/tests/test-agent-concurrency-ceiling-l25.mjs
import { evaluate } from '../hooks/rules/agent-concurrency-ceiling.mjs';
import { ledgerPath, writeLedger } from '../hooks/lib/agent-ledger.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'l25-ledger-'));
process.env.AGENT_LEDGER_PATH = join(dir, 'agent-ledger.json');

// CATCH: seed 5 already-live agents (this process's own pid, so pid-liveness reads them as live),
// then evaluate a 6th dispatch -> must block, echoing L25's ~25-concurrent incident shape.
const live = Array.from({ length: 5 }, (_, i) => ({ id: `agent-${i}`, pid: process.pid, startedAt: Date.now() }));
writeLedger({ live });
const result = evaluate({ tool_name: 'Agent', tool_input: { description: 'task 6' } });
if (result.decision !== 'block') {
  console.error(`FAIL  expected block on the 6th concurrent dispatch (L25 ceiling), got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  6th concurrently-live agent dispatch -> block, echoing L25\'s incident shape');
}
```

- [ ] **Step 3: Write the false-alarm test — sequential dispatch, each finished before the next, must never block**

```javascript
// appended to scripts/tests/test-agent-concurrency-ceiling-l25.mjs
import { pruneLive } from '../hooks/lib/agent-ledger.mjs';

// FALSE-ALARM: this is Fix Round 1's own documented regression case — 6 STRICTLY SEQUENTIAL
// dispatches, each completed (removed from the ledger) before the next begins, must never trip
// the ceiling. Empty ledger models "every prior agent already reported done".
writeLedger({ live: [] });
for (let i = 0; i < 6; i++) {
  const r = evaluate({ tool_name: 'Agent', tool_input: { description: `sequential task ${i}` } });
  if (r.decision !== 'allow') {
    console.error(`FAIL  sequential dispatch #${i} should not block/warn on an empty live ledger, got: ${JSON.stringify(r)}`);
    process.exitCode = 1;
    break;
  }
}
if (process.exitCode !== 1) console.log('PASS  6 strictly-sequential dispatches, each finished first -> all allow, no false alarm');
```

- [ ] **Step 4: Run both, paste output**

Run: `node scripts/tests/test-agent-concurrency-ceiling-l25.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 5: Add the declaration**

```javascript
export const TOOLS = ['Agent'];
export const RULE_IDS = ['10.5a', 'L25'];
```

- [ ] **Step 6: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 56 of 91 ... (35 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/rules/agent-concurrency-ceiling.mjs scripts/tests/test-agent-concurrency-ceiling-l25.mjs
git commit -m "feat(Arc 3 Phase 1, Task 6): declare L25 on agent-concurrency-ceiling.mjs"
```

**Overlap flagged, not decided** (per the ranking doc, R-116): L25's lesson text may be fully
subsumed by `10.5a` rather than needing its own row. This task declares L25 as its own id — the
overlap question is the owner's to resolve, not this plan's; nothing here merges or retires either
row.

### Task 7: Phase 1 liveness test and overhead measurement

**Files:**
- Test: `scripts/tests/test-phase1-liveness.mjs` (new)
- Modify: `docs/STATUS-BOARD.md` — NOT edited by this plan (read-only constraint, project CLAUDE.md);
  the coverage-line update is out of scope here and left to whoever lands this plan under H10's own
  discipline.

**Interfaces:**
- Consumes: the CLI entry points of all six files touched in Tasks 1–6, run directly, no env override.
- Produces: the measured overhead line pasted into this task's evidence (§3.5).

- [ ] **Step 1: Write the liveness test — every Phase 1 rule fires through its real entry point**

```javascript
// scripts/tests/test-phase1-liveness.mjs
// §3.4: one test per phase that runs the CLI with NO environment override at all. This is not a
// replay of the per-rule catch tests (those use env overrides for fixtures on purpose) — this test
// proves each entry point loads and runs against THIS repo's real files, unmodified.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function runBare(script, args = []) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { cwd: ROOT, encoding: 'utf8' });
  // deliberately NO env object override — inherits process.env exactly as a real session would.
}

let failures = 0;

// 10.12: check-geniza-fresh.mjs against the real geniza (skips loudly if the DB isn't up — that is
// itself a legitimate, already-documented exit path, not a liveness failure).
const r1 = runBare('check-geniza-fresh.mjs');
if (r1.error) { console.error(`FAIL  check-geniza-fresh.mjs did not even start: ${r1.error}`); failures++; }
else console.log(`PASS  check-geniza-fresh.mjs ran to completion, exit ${r1.status}`);

// H8: check-h8-ledger.mjs against the real docs/ROADMAP-2026-07-30.md.
const r2 = runBare('check-h8-ledger.mjs');
if (r2.error) { console.error(`FAIL  check-h8-ledger.mjs did not even start: ${r2.error}`); failures++; }
else console.log(`PASS  check-h8-ledger.mjs ran against the real roadmap, exit ${r2.status}`);

// H10: check-board-fresh.mjs against the real docs/STATUS-BOARD.md (the "unusual case" — no
// synthetic commit needed, this rule's own real target IS the board file).
const r3 = runBare('check-board-fresh.mjs');
if (r3.error) { console.error(`FAIL  check-board-fresh.mjs did not even start: ${r3.error}`); failures++; }
else console.log(`PASS  check-board-fresh.mjs ran against the real STATUS-BOARD.md, exit ${r3.status}`);

// H10 (second file): check-shipped-closed.mjs against the real roadmap + releases dir.
const r4 = runBare('check-shipped-closed.mjs');
if (r4.error) { console.error(`FAIL  check-shipped-closed.mjs did not even start: ${r4.error}`); failures++; }
else console.log(`PASS  check-shipped-closed.mjs ran against the real ledger, exit ${r4.status}`);

// H14 + L29: check-release.mjs in its real AUDIT mode (no arg) against the real git log.
const r5 = runBare('check-release.mjs');
if (r5.error) { console.error(`FAIL  check-release.mjs did not even start: ${r5.error}`); failures++; }
else console.log(`PASS  check-release.mjs (AUDIT mode) ran against the real git log, exit ${r5.status}`);

// 10.11 + L25 are pretooluse hook rules, not standalone CLIs — their real entry point is
// scripts/hooks/pretooluse.mjs itself, invoked exactly as .claude/settings.json invokes it.
const fixtureInput = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hi' } });
const r6 = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs')], {
  cwd: ROOT, encoding: 'utf8', input: fixtureInput,
});
if (r6.error) { console.error(`FAIL  pretooluse.mjs did not even start: ${r6.error}`); failures++; }
else console.log(`PASS  pretooluse.mjs (real entry point, no env override) ran to completion, exit ${r6.status}`);

if (failures) { console.error(`\n${failures} entry point(s) failed to start.`); process.exitCode = 1; }
else console.log('\nOK - all Phase 1 entry points run live, with no environment override.');
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase1-liveness.mjs`
Expected: six PASS lines, exit code 0.

- [ ] **Step 3: Measure overhead against the 61ms baseline**

```javascript
// one-off measurement, run from the repo root, output pasted into this task's evidence — not a
// committed file, per §3.5 ("measured overhead, reported per phase")
// node -e "
//   const { execFileSync } = require('node:child_process');
//   const t0 = Date.now();
//   execFileSync(process.execPath, ['scripts/hooks/pretooluse.mjs'], {
//     input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hi' } }), encoding: 'utf8',
//   });
//   console.log('pretooluse.mjs total wall time (6 new rule-file checks added):', Date.now() - t0, 'ms');
// "
```

Run the inline `node -e` command above from the repo root. Expected output: a millisecond figure.
Compare against the Arc 2 Phase 4 baseline of 61ms worst case — paste both numbers into this task's
evidence. If the new figure exceeds 61ms materially, this is investigated per §3.5, not noted and
moved past.

- [ ] **Step 4: Run the full test suite twice, paste both outputs**

Run: `npx playwright test`
Expected: exit code 0, full pass count printed.

Run: `pytest`
Expected: exit code 0, full pass count printed.

- [ ] **Step 5: Confirm final Phase 1 coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 56 of 91 mechanically-enforceable rules covered (35 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase1-liveness.mjs
git commit -m "test(Arc 3 Phase 1, Task 7): liveness test + overhead measurement, Phase 1 closes at 56/91"
```

---

## Phase 2 — the two false-alarm risks

`L28a` and `10.25`. Solved now, with patience, not at the end under pressure. Both are new detectors
(not declaration-only). Both sit next to a shipped neighbor that was deliberately narrowed to
warn-only after a documented false-positive round (`10.17` = `symbolic-grep-use-serena.mjs`, `10.13`
= `geniza-fallback-declaration.mjs`) — that precedent is read as a signal for both tasks below, not
just mentioned.

### Task 8: Implement and declare `L28a` — block a source-file grep sweep with no prior serena/geniza touch

**Files:**
- Create: `scripts/hooks/rules/serena-geniza-before-source-sweep.mjs`
- Test: `scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs`
- Modify: `scripts/hooks/pretooluse.mjs` — add the new rule file to the rule-loading list (same
  pattern every existing rule file under `scripts/hooks/rules/` already uses; confirm the loader
  reads the directory rather than a hardcoded list before assuming a wiring edit is needed — if the
  loader already globs the directory, this file only needs `Step 6` below, no wiring edit)

**Interfaces:**
- Consumes: `isSerenaLive()` from `scripts/hooks/lib/serena-probe.mjs` (already used by
  `symbolic-grep-use-serena.mjs`), `genizaConsultedRecently(transcriptPath)` from
  `scripts/hooks/lib/geniza-consult.mjs`, `extractBashGrepInvocations(command)` from
  `scripts/hooks/lib/bash-grep-extract.mjs` — all three already exist and are used by the two
  neighbor rules; this task adds no new library code, only a new rule file that combines them.
- Produces: `evaluate(input)` with the standard `{decision, reason}` shape, exported alongside
  `TOOLS = ['Grep', 'Bash']` and `RULE_IDS = ['L28a']`.

- [ ] **Step 1: Read L28a's own text and scope the trigger narrowly, in writing, before any code**

L28a's text (per the ranking doc) says BLOCKED — not warn — for any Grep on source files without a
prior serena/geniza consult this session. The false-alarm risk the ranking doc names explicitly: a
blocking gate on *any* source-file Grep, with no session-state nuance beyond "was serena/geniza
touched at all", is structurally the same shape as R-137 (~65% false, blocking, the standing example
this project already paid for). The narrowing this task applies, stated before any code is written:

1. **Scope to a sweep, not a targeted read.** A `Grep` whose `path` names a single file (no glob, no
   wildcard, no directory) is a targeted read of a known location, not the corpus search L28a is
   about — reuse `isSweepTarget()` from `lib/bash-grep-extract.mjs`, the exact function
   `geniza-fallback-declaration.mjs`'s Task 13 note already relies on for the identical distinction.
2. **Scope to code, not docs.** A search whose target is `docs/**`/`*.md` is `10.13`'s business, not
   this rule's — reuse the same code-vs-docs axis `symbolic-grep-use-serena.mjs` already defines
   (condition א in that file's header).
3. **The session-state check is "was EITHER serena or the geniza touched at all in this session"**
   (not "for this exact query") — same generous session-wide reading `symbolic-grep-use-serena.mjs`
   and `geniza-fallback-declaration.mjs` already use, not a per-query re-check that would make the
   rule fire on every follow-up grep inside one research burst.
4. **BLOCK, per L28a's own text — but the block names an accessible alternative (§3.2 / §10.24):**
   "run `mcp__serena__find_symbol`/`get_symbols_overview` first, or query the geniza, or if this is
   truly a first-touch exploratory sweep, state that reason and re-run — this is a less-efficient
   path, not a dead end."

- [ ] **Step 2: Write the new rule file**

```javascript
// scripts/hooks/rules/serena-geniza-before-source-sweep.mjs — L28a: a source-code SWEEP (not a
// targeted single-file read) is blocked when NEITHER serena NOR the geniza has been touched at all
// this session. Deliberately narrower than the rule's own literal wording, for the stated reason:
// R-137 is this project's own paid-for example of what an unscoped blocking grep gate costs (~65%
// false, blocking). The two neighbor rules this shares library code with (10.17, 10.13) were BOTH
// walked back from a wider first version to a warn-only, narrowly-scoped one after a false-positive
// round — read as a signal, not copied blindly, because L28a's own text says BLOCK, not warn: the
// difference is this rule's target is a real serena-warm-endpoint requirement (findable
// alternative), where 10.17/10.13 are pure nudges with no compatible-alternative test to apply.
export const TOOLS = ['Grep', 'Bash'];
export const RULE_IDS = ['L28a'];

import { isSerenaLive } from '../lib/serena-probe.mjs';
import { genizaConsultedRecently } from '../lib/geniza-consult.mjs';
import { extractBashGrepInvocations, isSweepTarget } from '../lib/bash-grep-extract.mjs';

const CODE_PATH = /(^|[\\/])(src|app\.js|app\.css|scripts)([\\/]|$)/i;
const DOC_PATH = /(^|[\\/])(docs|sources)([\\/]|$)/i;
const CODE_GLOB = /\.(js|mjs|py|ts|css)$/i;

function isSourceSweepCandidate(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  const { type, glob, path } = toolInput;
  const looksLikeCode = (typeof type === 'string' && /^(js|py|rust|go|java)$/i.test(type))
    || (typeof glob === 'string' && CODE_GLOB.test(glob))
    || (typeof path === 'string' && CODE_PATH.test(path) && !DOC_PATH.test(path));
  if (!looksLikeCode) return false;
  return isSweepTarget(toolInput); // shared with geniza-fallback-declaration.mjs's Task 13 logic
}

function candidateFor(input) {
  if (input.tool_name === 'Grep') {
    return isSourceSweepCandidate(input.tool_input) ? input.tool_input : null;
  }
  if (input.tool_name === 'Bash') {
    const candidates = extractBashGrepInvocations(input.tool_input && input.tool_input.command);
    return candidates.find((c) => isSourceSweepCandidate(c)) || null;
  }
  return null;
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Grep' && input.tool_name !== 'Bash')) {
    return { decision: 'allow', reason: 'not a Grep or grep-like Bash call' };
  }
  const candidate = candidateFor(input);
  if (!candidate) {
    return { decision: 'allow', reason: 'L28a: not a source-code sweep (targeted single-file read, or not code-shaped) — not this rule\'s business' };
  }

  // Session-wide, not per-query: EITHER serena OR the geniza touched at all this session is enough.
  const serenaLive = isSerenaLive();
  const { determined, consulted } = genizaConsultedRecently(input.transcript_path);
  if (serenaLive || (determined && consulted)) {
    return { decision: 'allow', reason: 'L28a: serena and/or the geniza was already touched this session — this sweep is a legitimate follow-up' };
  }
  if (!determined && !serenaLive) {
    // Cannot positively confirm either signal was NOT touched (no readable transcript) AND serena
    // itself is unreachable — fail toward silence, same fail direction every rule in this pipeline
    // uses (lib/geniza-consult.mjs's own documented rule).
    return { decision: 'allow', reason: 'L28a: cannot positively determine session state — not blocking on an unprovable absence' };
  }

  return {
    decision: 'block',
    reason: 'L28a: a source-code sweep with no serena or geniza touch this session — '
      + 'run mcp__serena__find_symbol / get_symbols_overview first for symbol-shaped code work, '
      + 'or query the geniza (src.knowledge.retrieval) for doc-shaped questions, then re-run this '
      + 'search. If this really is a first-touch exploratory sweep with no better tool, state that '
      + 'reason in the next message and re-run — this is a less-efficient path, never a dead end.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs
import { evaluate } from '../hooks/rules/serena-geniza-before-source-sweep.mjs';

// CATCH: a wildcard code sweep, serena unreachable, no geniza consult in a readable transcript ->
// block.
process.env.SERENA_PROBE_FORCE_DOWN = '1'; // matches lib/serena-probe.mjs's own test seam
const result = evaluate({
  tool_name: 'Grep',
  tool_input: { pattern: 'renderWorkplan', glob: '**/*.js' },
  transcript_path: '/nonexistent/transcript.jsonl',
});
delete process.env.SERENA_PROBE_FORCE_DOWN;
// A missing transcript is "cannot determine" territory per Step 1's rule 4 (fail toward silence) —
// so this catch case forces serena down AND supplies a transcript that resolves determined=true,
// consulted=false, so it actually exercises the block branch rather than the silent-absence one.
```

Correction applied before running (the transcript must positively read as "no consult", not merely
be unreadable — otherwise the catch test would exercise the wrong branch):

```javascript
// scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs — final version
import { evaluate } from '../hooks/rules/serena-geniza-before-source-sweep.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'l28a-catch-'));
const transcriptPath = join(dir, 'transcript.jsonl');
// A transcript with real content but no retrieval/serena tool call -> determined=true, consulted=false.
writeFileSync(transcriptPath, JSON.stringify({
  type: 'assistant', timestamp: new Date().toISOString(),
  message: { content: [{ type: 'text', text: 'let me search the code directly' }] },
}) + '\n', 'utf8');

process.env.SERENA_PROBE_FORCE_DOWN = '1';
const result = evaluate({
  tool_name: 'Grep',
  tool_input: { pattern: 'renderWorkplan', glob: '**/*.js' },
  transcript_path: transcriptPath,
});
delete process.env.SERENA_PROBE_FORCE_DOWN;

if (result.decision !== 'block') {
  console.error(`FAIL  expected block on a code-wide sweep with serena down and no geniza consult, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  wildcard code sweep, serena down, no geniza consult -> block, names the alternative');
}
if (!/find_symbol|geniza/.test(result.reason)) {
  console.error('FAIL  block reason names no accessible alternative (§10.24/§3.2 requirement)');
  process.exitCode = 1;
} else {
  console.log('PASS  block reason names a concrete alternative path');
}
```

- [ ] **Step 4: Run it, confirm both PASS**

Run: `node scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs`
Expected: two PASS lines, exit 0.

- [ ] **Step 5: Write the false-alarm test — the sharpest one, against real history shapes**

```javascript
// appended to scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs

// FALSE-ALARM 1: a targeted single-file Grep (path names one file, no glob/wildcard) must NEVER
// trigger this rule, serena state irrelevant — this is the R-137-shaped false alarm named in the
// brief: "grep -n R-72 docs/ROADMAP...md" is a single-file read, not a sweep.
process.env.SERENA_PROBE_FORCE_DOWN = '1';
const single = evaluate({
  tool_name: 'Grep',
  tool_input: { pattern: 'renderWorkplan', path: 'src/app.js' },
  transcript_path: join(dir, 'transcript.jsonl'),
});
delete process.env.SERENA_PROBE_FORCE_DOWN;
if (single.decision !== 'allow') {
  console.error(`FAIL  targeted single-file read must never block, got: ${JSON.stringify(single)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  targeted single-file Grep -> allow (not a sweep, not this rule\'s business)');
}

// FALSE-ALARM 2: a docs/** sweep must NEVER trigger this rule — that is 10.13's business, a
// different axis, and this rule must stay silent regardless of session state.
process.env.SERENA_PROBE_FORCE_DOWN = '1';
const docs = evaluate({
  tool_name: 'Grep',
  tool_input: { pattern: 'anything', glob: '**/*.md', path: 'docs' },
  transcript_path: join(dir, 'transcript.jsonl'),
});
delete process.env.SERENA_PROBE_FORCE_DOWN;
if (docs.decision !== 'allow') {
  console.error(`FAIL  docs sweep must never trigger L28a, got: ${JSON.stringify(docs)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  docs/** sweep -> allow (10.13\'s axis, not L28a\'s)');
}

// FALSE-ALARM 3: a code sweep immediately after a real serena call this session must allow.
delete process.env.SERENA_PROBE_FORCE_DOWN; // serena live (default probe path)
const afterSerena = evaluate({
  tool_name: 'Grep',
  tool_input: { pattern: 'renderWorkplan', glob: '**/*.js' },
  transcript_path: join(dir, 'transcript.jsonl'),
});
if (afterSerena.decision !== 'allow') {
  console.error(`FAIL  a live-serena session must not block a code sweep, got: ${JSON.stringify(afterSerena)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  serena live this session -> allow, no false alarm');
}
```

- [ ] **Step 6: Run all five assertions, paste output**

Run: `node scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs`
Expected: five PASS lines, exit code 0.

- [ ] **Step 7: Wire the new rule file into the loader (only if the loader is a hardcoded list, not a directory glob) and confirm coverage**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 57 of 91 ... (34 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/serena-geniza-before-source-sweep.mjs scripts/tests/test-serena-geniza-before-source-sweep-l28a.mjs
git commit -m "feat(Arc 3 Phase 2, Task 8): implement and declare L28a — block source sweeps with no serena/geniza touch"
```

### Task 9: Implement and declare `10.25` — Hebrew string in `scripts/**`, scoped to new user-facing/product strings only

**Files:**
- Create: `scripts/hooks/rules/no-hebrew-in-infra-strings.mjs`
- Test: `scripts/tests/test-no-hebrew-in-infra-strings-10-25.mjs`

**Interfaces:**
- Consumes: the raw `tool_input.new_string` (Write) or `tool_input.new_string`/`old_string` (Edit)
  already available on every `pretooluse:Edit|Write` call, same shape every existing Edit/Write rule
  reads (see `L13`/`L16`/`L21` etc. in the same directory for the pattern).
- Produces: `evaluate(input)`, `TOOLS = ['Edit', 'Write']`, `RULE_IDS = ['10.25']`.

- [ ] **Step 1: Scope the trigger precisely, in writing, before any code**

The ranking doc names this the sharpest false-alarm risk of the whole 42: the rule files under
`scripts/hooks/**` are themselves saturated with legitimate quoted Hebrew owner instructions in
comments (every file read for this plan quotes the owner in Hebrew verbatim). §10.25's own text
(owner, 2026-08-10, quoted inside `check-h8-ledger.mjs`'s own comment) is: **"the infrastructure is
written in ENGLISH — only the conversation is Hebrew."** The scope this task applies:

1. **Only `scripts/**` files** (the rule's own `mechanism_target`), never `docs/**` (Hebrew is the
   working language there) and never `.mjs` block comments (`//` or `/* */` lines) — a comment
   quoting the owner is not "infrastructure written in Hebrew", it is a citation.
2. **Only a STRING LITERAL that will execute as product output** — i.e., a string argument to
   `console.log`/`console.error`, a `reason:`/`message:` object property value, or a bare string
   returned from a function — never a string inside a `//` comment line or inside a template literal
   that is itself clearly commentary (heuristic: the check only inspects the AST-adjacent shape a
   quick regex can reach: a quoted string literal NOT preceded on its own line by `//`).
3. **A new-or-changed line only** — this task compares the tool's own before/after (`old_string` vs
   `new_string` for Edit; the whole file for Write) so an existing, already-Hebrew comment elsewhere
   in the file untouched by this edit never trips the rule.
4. **WARN, not block** (§3.2: this is a code-quality/consistency concern with an efficient
   alternative — rewrite the string in English — not a substance-blocking harm), matching the
   pattern the ranking doc itself points to (`10.17`/`10.13` both warn-only after their own
   false-positive rounds).

- [ ] **Step 2: Write the new rule file**

```javascript
// scripts/hooks/rules/no-hebrew-in-infra-strings.mjs — §10.25 (owner, 2026-08-10): "the
// infrastructure is written in ENGLISH — only the conversation is Hebrew." WARN-only, scoped to
// scripts/** non-comment string literals that will execute as product output (console.log/error
// arguments, a reason/message property, a bare returned string) — never a `//` comment line, never
// docs/**. This is the narrowest reading that still catches the rule's real target: this repo's own
// rule files are saturated with legitimate quoted Hebrew owner instructions in COMMENTS (every file
// read while building this plan does exactly that), and a naive "any Hebrew character in scripts/**"
// trigger would fire on nearly every file in this directory, which is the exact R-137 shape this
// project has already paid for once.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['10.25'];

const HEBREW_RE = /[֐-׿]/;
const SCRIPTS_PATH = /(^|[\\/])scripts[\\/]/i;

// A line counts as "executable string content" only if it is NOT a `//` comment line (leading
// whitespace then `//`) and it contains a quoted string literal with Hebrew inside it that reads as
// an argument to console.log/console.error, or a reason:/message: property, or `return '...'`.
const EXECUTABLE_HEBREW_LINE_RE =
  /(console\.(log|error|warn)\s*\(|(?:reason|message)\s*:\s*|return\s+)[^/\n]*['"`][^'"`]*[֐-׿][^'"`]*['"`]/;

function isCommentLine(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

function newHebrewInfraLines(text) {
  return text.split('\n').filter((line) => !isCommentLine(line) && EXECUTABLE_HEBREW_LINE_RE.test(line) && HEBREW_RE.test(line));
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit or Write call' };
  }
  const path = input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (typeof path !== 'string' || !SCRIPTS_PATH.test(path)) {
    return { decision: 'allow', reason: '10.25: not under scripts/** — not this rule\'s business' };
  }

  const newText = input.tool_name === 'Write'
    ? (input.tool_input.content ?? '')
    : (input.tool_input.new_string ?? '');
  const oldText = input.tool_name === 'Edit' ? (input.tool_input.old_string ?? '') : '';

  const newLines = newHebrewInfraLines(newText);
  const oldLines = new Set(newHebrewInfraLines(oldText));
  const introduced = newLines.filter((l) => !oldLines.has(l));

  if (!introduced.length) {
    return { decision: 'allow', reason: '10.25: no new executable-string Hebrew content introduced (comments and unchanged lines are not this rule\'s business)' };
  }

  return {
    decision: 'warn',
    reason: `10.25: this edit introduces Hebrew text inside what reads as an executable string in `
      + `${path} (console.log/error argument, a reason/message property, or a returned string) — `
      + `§10.25 (owner, 2026-08-10): infrastructure is written in ENGLISH, only the conversation is `
      + `Hebrew. Rewrite the string in English; a comment quoting the owner verbatim is unaffected by `
      + `this rule. Example line: "${introduced[0].trim().slice(0, 100)}"`,
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-no-hebrew-in-infra-strings-10-25.mjs
import { evaluate } from '../hooks/rules/no-hebrew-in-infra-strings.mjs';

// CATCH: a new console.error() argument with Hebrew product text in a scripts/** file -> warn.
const result = evaluate({
  tool_name: 'Edit',
  tool_input: {
    file_path: 'scripts/check-example.mjs',
    old_string: "console.error('FAIL: something went wrong');",
    new_string: "console.error('נכשל: משהו השתבש');",
  },
});
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on new Hebrew console.error text, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  new Hebrew executable-string content in scripts/** -> warn');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-no-hebrew-in-infra-strings-10-25.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm tests — the sharpest scenarios named in the ranking doc**

```javascript
// appended to scripts/tests/test-no-hebrew-in-infra-strings-10-25.mjs

// FALSE-ALARM 1: a `//` comment quoting the owner in Hebrew, verbatim, unchanged elsewhere in the
// file — must never warn. This is THE named risk: "every file I read in this task quotes the owner
// in Hebrew, verbatim, in comments."
const comment = evaluate({
  tool_name: 'Edit',
  tool_input: {
    file_path: 'scripts/hooks/rules/example-rule.mjs',
    old_string: "const X = 1;",
    new_string: "// §10.5a (settled): \"סדרתי; ≤3 קלים; ≤5 קשיח\"\nconst X = 1;",
  },
});
if (comment.decision !== 'allow') {
  console.error(`FAIL  a Hebrew owner-quote comment must never warn, got: ${JSON.stringify(comment)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  Hebrew owner-quote inside a // comment -> allow, no false alarm');
}

// FALSE-ALARM 2: an edit that only touches an unrelated English line elsewhere in a file that
// ALREADY contains Hebrew comments must not warn (the "new-or-changed" scoping) -- old_string ==
// new_string minus the Hebrew line entirely, since this edit never touches it.
const untouched = evaluate({
  tool_name: 'Edit',
  tool_input: {
    file_path: 'scripts/hooks/rules/example-rule.mjs',
    old_string: "const OLD_TIMEOUT = 100;",
    new_string: "const OLD_TIMEOUT = 200;",
  },
});
if (untouched.decision !== 'allow') {
  console.error(`FAIL  an edit not touching any Hebrew line must not warn, got: ${JSON.stringify(untouched)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  edit unrelated to any Hebrew line -> allow, no false alarm');
}

// FALSE-ALARM 3: a docs/** file (Hebrew is the working language there) must never trigger this rule.
const docs = evaluate({
  tool_name: 'Write',
  tool_input: {
    file_path: 'docs/process/development-discipline.md',
    content: "console.log לדוגמה: 'שלום עולם'",
  },
});
if (docs.decision !== 'allow') {
  console.error(`FAIL  docs/** must never trigger 10.25, got: ${JSON.stringify(docs)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  docs/** file -> allow (out of scope entirely)');
}
```

- [ ] **Step 6: Run all four, paste output**

Run: `node scripts/tests/test-no-hebrew-in-infra-strings-10-25.mjs`
Expected: four PASS lines, exit code 0.

- [ ] **Step 7: Run against real repo history as the required real-history false-alarm check (§3.1)**

```javascript
// one-off, run from the repo root, output pasted into this task's evidence:
// node -e "
//   import('./scripts/hooks/rules/no-hebrew-in-infra-strings.mjs').then(({ evaluate }) => {
//     const { execSync } = require('node:child_process');
//     const files = execSync('git log --format= --name-only -n 200 -- scripts/', { encoding: 'utf8' })
//       .split('\n').filter(f => f.endsWith('.mjs'));
//     const { readFileSync, existsSync } = require('node:fs');
//     let warned = 0, scanned = 0;
//     for (const f of [...new Set(files)]) {
//       if (!existsSync(f)) continue;
//       scanned++;
//       const content = readFileSync(f, 'utf8');
//       const r = evaluate({ tool_name: 'Write', tool_input: { file_path: f, content } });
//       if (r.decision === 'warn') { warned++; console.log('WARN', f); }
//     }
//     console.log('scanned', scanned, 'files, warned on', warned);
//   });
// "
```

Run the command above. Expected: `warned on 0` against the current repo tree — every existing
`scripts/**` file's Hebrew content is comment-only. If the count is nonzero, read each flagged file
before concluding whether the rule is wrong or the file needs an actual fix — do not silence the
rule to make this pass.

- [ ] **Step 8: Add the declaration and confirm coverage**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 58 of 91 ... (33 open)`.

- [ ] **Step 9: Commit**

```bash
git add scripts/hooks/rules/no-hebrew-in-infra-strings.mjs scripts/tests/test-no-hebrew-in-infra-strings-10-25.mjs
git commit -m "feat(Arc 3 Phase 2, Task 9): implement and declare 10.25 — warn on new Hebrew in executable scripts/** strings"
```

### Task 10: Phase 2 liveness test, overhead measurement, and 0-false-alarm confirmation

**Files:**
- Test: `scripts/tests/test-phase2-liveness.mjs` (new)

**Interfaces:**
- Consumes: `scripts/hooks/pretooluse.mjs`, the real entry point for both Phase 2 rules.
- Produces: the measured overhead and 0-false-alarm evidence pasted into this task.

- [ ] **Step 1: Write the liveness test**

```javascript
// scripts/tests/test-phase2-liveness.mjs — §3.4, no environment override.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const input = JSON.stringify({ tool_name: 'Grep', tool_input: { pattern: 'x', glob: '**/*.js' } });
const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs')], {
  cwd: ROOT, encoding: 'utf8', input,
});
if (r.error) {
  console.error(`FAIL  pretooluse.mjs did not start with no env override: ${r.error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  pretooluse.mjs (no env override) ran to completion carrying L28a + 10.25, exit ${r.status}`);
}
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase2-liveness.mjs`
Expected: one PASS line, exit code 0.

- [ ] **Step 3: Measure overhead**

Run the same inline `node -e` measurement command from Task 7 Step 3, now against
`pretooluse.mjs` carrying both new Phase 2 rules. Paste the new millisecond figure next to the
Phase 1 figure and the 61ms baseline.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm final Phase 2 coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 58 of 91 mechanically-enforceable rules covered (33 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase2-liveness.mjs
git commit -m "test(Arc 3 Phase 2, Task 10): liveness test + overhead measurement, Phase 2 closes at 58/91"
```

---

## Phase 3 — `commit-gate`, 18 rules (the bulk)

The `commit-gate` mechanism point carries 18 rules total, per the measured reconciliation
(`.superpowers/sdd/2026-08-11-arc4-testing-the-enforcement/arc3-ranking.md`). **5 of the 18 already
closed in Phase 1** (`10.12`, `H8`, `H10`, `H14`, `L29`) — Phase 3 does not redo them, it implements
real detectors for the **13 that remain**: `DoD-12`, `L17`, `10.4`, `H11`, `H13`, `10.1`, `10.20`,
`DoD-10`, `DoD-2`, `DoD-8`, `L40`, `L75`, `L82`. This is why the owner's standing rules `H8` `H10`
`H14` are named alongside `DoD-12` `H13` in the phase description — they share this mechanism point,
not this phase's task list.

Per the sizing instruction ("match phase sizes to what a reviewer can actually gate — Arc 2 ran 6–11
rules per phase"), the 13 new-detector rules are split into two reviewer-gated sub-phases within this
one named Phase 3: **3a** (7 rules) and **3b** (6 rules) — the phase order itself is not reopened,
only its internal batch size.

### Phase 3a (7 rules): `DoD-12`, `H13`, `L40`, `L75`, `DoD-8`, `H11`, `10.20`

### Task 11: Implement and declare `DoD-12` — a non-release commit's "full suite green" claim, checked against a real evidence file

**Files:**
- Create: `scripts/check-suite-evidence.mjs`
- Create: `scripts/lib/suite-evidence.mjs` (the evidence-writer both `npx playwright test` wrapper
  scripts and `pytest` wrapper invoke — see Step 1)
- Test: `scripts/tests/test-check-suite-evidence-dod12.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-suite-evidence', 'check-suite-evidence (DoD-12 —
  full suite green, checked against a real run record, not commit-message text)',
  'check-suite-evidence.mjs');` after the `check-release` line (`~289`)

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `writeSuiteEvidence(kind, exitCode)` from `scripts/lib/suite-evidence.mjs`, appending a
  JSON line to `.superpowers/suite-evidence.jsonl` — this is the "real run happened" record the
  ranking doc says does not exist yet ("no equivalent for the Playwright suite" beyond a forgeable
  commit-message string).

- [ ] **Step 1: Design the evidence record honestly — this is new infrastructure, not just a new check**

The ranking doc's finding: `check-release.mjs`'s DoD-12 check is a **text-proxy** — it regexes "exit
0" in the commit message body, which is trivially forgeable, and only runs on release commits. Fixing
this for real requires a record that a suite run **actually happened**, not a claim about one. This
task adds the smallest honest version: a one-line JSONL append, written by a thin wrapper any commit
workflow can call right after a real `npx playwright test` / `pytest` run, read back by the gate at
commit time. `scripts/lib/suite-evidence.mjs`:

```javascript
// scripts/lib/suite-evidence.mjs — DoD-12: "full suite green" as a RECORD of a real run, not a
// claim inside a commit message (which check-release.mjs's own text-proxy check already showed is
// trivially forgeable — a hand-typed "exit 0" satisfies it with no run behind it at all).
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_PATH = join(ROOT, '.superpowers', 'suite-evidence.jsonl');

export function evidencePath() {
  return process.env.SUITE_EVIDENCE_PATH || DEFAULT_PATH;
}

// kind: 'playwright' | 'pytest'. exitCode: the real process exit code of that run, recorded
// unconditionally (a red run is evidence too — it proves the suite was actually invoked).
export function writeSuiteEvidence(kind, exitCode) {
  const path = evidencePath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), kind, exitCode })}\n`, 'utf8');
}
```

- [ ] **Step 2: Write the gate that reads the evidence and requires a recent green run of both suites**

```javascript
// scripts/check-suite-evidence.mjs — DoD-12: "full suite green", verified against a real evidence
// record rather than commit-message text. WARN, not block (§3.2): the harm of a missing evidence
// record is to confidence/efficiency (a claim nobody can verify), not to substance, and the
// alternative is always available and cheap — run the suite, which every DoD-12-bound task already
// must do per the project's own §3 DoD gate. Blocking every commit on a fresh evidence file would
// re-run the whole suite on every single-line doc fix, which the project's own §10.1 loop discipline
// (plan -> develop -> test -> review) does not require for a change that touches no test-relevant
// code — so this reports, and blocks ONLY release(v commits, where the DoD gate's line 12 is
// unconditional ("Full suite green. Run npx playwright test — plain, nothing else.").
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { evidencePath } from './lib/suite-evidence.mjs';

export const RULE_IDS = ['DoD-12'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const FRESH_WINDOW_MS = Number(process.env.SUITE_EVIDENCE_WINDOW_MS || 4 * 60 * 60 * 1000); // 4h

function latestBy(kind, records) {
  const matches = records.filter(r => r.kind === kind);
  return matches.length ? matches[matches.length - 1] : null;
}

const path = evidencePath();
let records = [];
if (existsSync(path)) {
  records = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const pw = latestBy('playwright', records);
const pt = latestBy('pytest', records);
const now = Date.now();
const pwFresh = pw && (now - new Date(pw.ts).getTime()) < FRESH_WINDOW_MS && pw.exitCode === 0;
const ptFresh = pt && (now - new Date(pt.ts).getTime()) < FRESH_WINDOW_MS && pt.exitCode === 0;

console.log(`suite evidence: playwright ${pw ? `exit ${pw.exitCode} at ${pw.ts}` : 'none recorded'} · pytest ${pt ? `exit ${pt.exitCode} at ${pt.ts}` : 'none recorded'}`);

let isReleaseCommit = false;
try {
  const head = execSync('git -c log.showsignature=false log -1 --format=%s', { cwd: GITROOT, encoding: 'utf8' }).trim();
  isReleaseCommit = /^release\(v\d+\)/.test(head);
} catch { /* not a git repo / no HEAD yet — treated as non-release, warn-only path */ }

if (!pwFresh || !ptFresh) {
  const msg = `DoD-12: no fresh (<${Math.round(FRESH_WINDOW_MS / 3600000)}h) green suite-evidence record for `
    + `${!pwFresh ? 'playwright ' : ''}${!ptFresh ? 'pytest' : ''} — run the missing suite(s) for real, `
    + `the evidence is written automatically by the suite wrapper.`;
  if (isReleaseCommit) {
    console.error(`FAIL: ${msg} (release commit — DoD-12 is unconditional here)`);
    process.exit(1);
  }
  console.log(`WARN: ${msg} (non-release commit — reported, not blocking)`);
  process.exit(0);
}
console.log('OK - fresh green suite-evidence record for both playwright and pytest.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-suite-evidence-dod12.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-suite-evidence.mjs');

// CATCH: a release(v) HEAD with no evidence file at all -> exit 1, names DoD-12.
const dir = tempDir('suite-evidence-catch-');
execSync('git init -q', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "release(v999) x"', { cwd: dir });
const evPath = join(dir, 'suite-evidence.jsonl'); // deliberately never written
const result = runNode(SCRIPT, [], { GITROOT: dir, SUITE_EVIDENCE_PATH: evPath });
if (result.status === 0 || !/DoD-12/.test(result.stdout + result.stderr)) {
  console.error(`FAIL  expected exit 1 naming DoD-12 on a release commit with no evidence, got status=${result.status}: ${result.stdout}${result.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  release(v) commit with no suite-evidence record -> exit 1, names DoD-12');
}
```

- [ ] **Step 4: Write the false-alarm test — fresh green evidence + a non-release commit must never block**

```javascript
// appended to scripts/tests/test-check-suite-evidence-dod12.mjs
const dir2 = tempDir('suite-evidence-false-alarm-');
execSync('git init -q', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "chore: unrelated"', { cwd: dir2 });
const evPath2 = writeFile(dir2, 'evidence.jsonl',
  `${JSON.stringify({ ts: new Date().toISOString(), kind: 'playwright', exitCode: 0 })}\n`
  + `${JSON.stringify({ ts: new Date().toISOString(), kind: 'pytest', exitCode: 0 })}\n`);
const result2 = runNode(SCRIPT, [], { GITROOT: dir2, SUITE_EVIDENCE_PATH: evPath2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 with fresh green evidence on a non-release commit, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  fresh green evidence, non-release commit -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run both, paste output**

Run: `node scripts/tests/test-check-suite-evidence-dod12.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs**

```javascript
// scripts/check-meta.mjs, after the existing check-release line (~289)
run('check-suite-evidence', 'check-suite-evidence (DoD-12 — full suite green, checked against a real run record, not commit-message text)', 'check-suite-evidence.mjs');
```

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 59 of 91 ... (32 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-suite-evidence.mjs scripts/lib/suite-evidence.mjs scripts/tests/test-check-suite-evidence-dod12.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 11): implement and declare DoD-12 via a real suite-evidence record"
```

### Task 12: Implement and declare `H13` — a ⚠️R ledger row must carry its full four-step form

**Files:**
- Create: `scripts/check-h13-r-form.mjs`
- Test: `scripts/tests/test-check-h13-r-form.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-h13-r-form', 'check-h13-r-form (H13 — every
  ⚠️R row shows בירור→המלצה→החלטת בעלים→עדכון, worsening-only like check-h8-ledger)',
  'check-h13-r-form.mjs');` after the `check-h8-ledger` line

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Read H13's exact text and design the check against it**

Project CLAUDE.md H13: "שער רלוונטיות לפריט משוחזר (⚠️R: בירור → המלצה → **החלטת בעלים** →
עדכון/בצע/בטל)." A ⚠️R-marked ledger row (already used by `check-h8-ledger.mjs`'s own §5a scan for
the "landing" concept) must show, somewhere in its own row text or in a linked doc, the four stages
in order: inquiry (בירור), recommendation (המלצה), an explicit owner decision (החלטת בעלים), and an
update/execute/cancel resolution (עדכון or בצע or בטל). This is the same worsening-only diff pattern
`check-h8-ledger.mjs` already uses (compare current vs baseline, block only on a NEW violation), reused
directly rather than re-invented.

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-h13-r-form.mjs — H13: every ⚠️R ledger row must show the full four-step form
// (בירור -> המלצה -> החלטת בעלים -> עדכון/בצע/בטל), not just a landing. Worsening-only, same
// pattern as check-h8-ledger.mjs (a row that predates this commit and is already missing a step is
// STANDING DEBT, reported not blocking; a row that is new or edited this commit and still misses a
// step is NEW OR STRUCTURAL, blocking) — for the identical stated reason: blocking on pre-existing
// debt teaches the escape hatch to become routine.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['H13'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const roadPath = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');

const STEPS = [
  { key: 'בירור', re: /בירור/ },
  { key: 'המלצה', re: /המלצה/ },
  { key: 'החלטת בעלים', re: /החלטת\s*בעלים|הבעלים\s*(אישר|החליט|דחה)/ },
  { key: 'עדכון/בצע/בטל', re: /עדכון|בצע|בטל/ },
];

function findings(text) {
  const out = [];
  const rRowLines = text.split('\n').filter(l => l.includes('⚠️R'));
  for (const line of rRowLines) {
    const idMatch = line.match(/\b(R-\d+[a-z]?)\b/);
    const id = idMatch ? idMatch[1] : line.slice(0, 40);
    const missing = STEPS.filter(s => !s.re.test(line)).map(s => s.key);
    if (missing.length) out.push(`⚠️R row ${id} missing step(s): ${missing.join(', ')}`);
  }
  return out;
}

if (!existsSync(roadPath)) { console.error(`FAIL: ledger not found at ${roadPath}`); process.exit(1); }
const road = readFileSync(roadPath, 'utf8');
const current = findings(road);

let baselineText = null;
try {
  const rel = relative(GITROOT, roadPath).replaceAll('\\', '/');
  baselineText = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: GITROOT, encoding: 'utf8' });
} catch { /* no baseline available — safe default below treats everything as new */ }
const baseline = baselineText != null ? findings(baselineText) : [];
const baselineSet = new Set(baseline);
const newFindings = current.filter(f => !baselineSet.has(f));
const standing = current.filter(f => baselineSet.has(f));

console.log(`H13: ${current.length} ⚠️R row(s) with a finding scanned in the ledger, ${newFindings.length} new/worsened finding(s), ${standing.length} standing.`);
if (standing.length) {
  console.log(`STANDING DEBT (not blocking): ${standing.length}`);
  for (const f of standing) console.log('  ~ ' + f);
}
if (newFindings.length) {
  console.error(`FAIL: H13 — ${newFindings.length} new/worsened ⚠️R row(s) missing a step:`);
  for (const f of newFindings) console.error('  x ' + f);
  process.exit(1);
}
console.log('OK - no new or worsened H13 finding (every new/edited ⚠️R row shows all four steps).');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-h13-r-form.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-h13-r-form.mjs');

// CATCH: a ⚠️R row present only in CURRENT (no baseline), missing all four steps -> exit 1.
const bad = '| R-501 | ⚠️R תוכנית ישנה נמצאה מחדש | לא ברור עדיין |\n';
const path = writeFile(tempDir('h13-catch-'), 'roadmap.md', bad);
const result = runNode(SCRIPT, [], { ROADMAP: path, GITROOT: dirname(path) });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 on a ⚠️R row missing all four steps, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  ⚠️R row missing all four steps, no baseline -> exit 1');
}
```

- [ ] **Step 4: Write the false-alarm test — a fully-formed row must pass**

```javascript
// appended to scripts/tests/test-check-h13-r-form.mjs
const good = '| R-502 | ⚠️R בירור בוצע, המלצה נכתבה, החלטת בעלים אושרה, עדכון בוצע |\n';
const path2 = writeFile(tempDir('h13-false-alarm-'), 'roadmap.md', good);
const result2 = runNode(SCRIPT, [], { ROADMAP: path2, GITROOT: dirname(path2) });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 on a fully-formed ⚠️R row, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  fully-formed ⚠️R row (all four steps present) -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run both, paste output**

Run: `node scripts/tests/test-check-h13-r-form.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 60 of 91 ... (31 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-h13-r-form.mjs scripts/tests/test-check-h13-r-form.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 12): implement and declare H13 — ⚠️R rows require all four steps"
```

### Task 13: Implement and declare `L40` — every `scripts/check-*.mjs` file must be wired into `check-meta.mjs`

**Files:**
- Create: `scripts/check-gate-wiring.mjs`
- Test: `scripts/tests/test-check-gate-wiring-l40.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-gate-wiring', 'check-gate-wiring (L40 — every
  check-*.mjs file is actually called from this orchestrator)', 'check-gate-wiring.mjs');` as the
  LAST `run(...)` call in the file (so it audits every line above itself)

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Write the gate — readdir vs a regex over check-meta.mjs's own source**

```javascript
// scripts/check-gate-wiring.mjs — L40: a scripts/check-*.mjs file that exists but is never called
// from check-meta.mjs is invisible — nobody runs it, and nothing says so. Cheap by design: a
// directory listing diffed against a regex over check-meta.mjs's OWN source text, not an import
// (importing every check-*.mjs would run each one's top-level side effects for no reason).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L40'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = process.env.GATE_WIRING_SCRIPTS_DIR || join(ROOT, 'scripts');
const META_PATH = process.env.GATE_WIRING_META || join(ROOT, 'scripts', 'check-meta.mjs');

const files = readdirSync(SCRIPTS_DIR).filter(f => /^check-.*\.mjs$/.test(f)).sort();
const meta = readFileSync(META_PATH, 'utf8');

// Self-exclusion: check-meta.mjs itself and this very file (before it is wired in) are not required
// to appear inside a run('...') call naming themselves.
const SELF_EXEMPT = new Set(['check-meta.mjs', 'check-gate-wiring.mjs']);

const unwired = files.filter(f => !SELF_EXEMPT.has(f) && !meta.includes(`'${f}'`) && !meta.includes(`"${f}"`));

console.log(`L40: ${files.length} check-*.mjs file(s) found under ${SCRIPTS_DIR}, ${unwired.length} not wired into check-meta.mjs.`);
if (unwired.length) {
  console.error('FAIL: unwired gate file(s) — nothing ever runs them:');
  for (const f of unwired) console.error(`  x ${f}  (fix: add a run('...', '...', '${f}') call in check-meta.mjs, or delete the file if it is dead)`);
  process.exit(1);
}
console.log('OK - every check-*.mjs file is wired into check-meta.mjs.');
```

- [ ] **Step 2: Write the catch test**

```javascript
// scripts/tests/test-check-gate-wiring-l40.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-gate-wiring.mjs');

// CATCH: a scripts dir with an unwired check-*.mjs file -> exit 1.
const dir = tempDir('gate-wiring-catch-');
writeFile(dir, 'check-example.mjs', '// nothing');
const metaPath = writeFile(dir, 'check-meta.mjs', "run('check-other', 'x', 'check-other.mjs');\n");
const result = runNode(SCRIPT, [], { GATE_WIRING_SCRIPTS_DIR: dir, GATE_WIRING_META: metaPath });
if (result.status === 0 || !/check-example\.mjs/.test(result.stdout + result.stderr)) {
  console.error(`FAIL  expected exit 1 naming check-example.mjs, got status=${result.status}: ${result.stdout}${result.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  unwired check-*.mjs file -> exit 1, names the file');
}
```

- [ ] **Step 3: Write the false-alarm test — the REAL repo's own scripts/ and check-meta.mjs must pass today**

```javascript
// appended to scripts/tests/test-check-gate-wiring-l40.mjs
const resultReal = runNode(SCRIPT, []); // no overrides — the real repo tree, once this task's own
                                          // wiring step (Step 4 below) has landed
if (resultReal.status !== 0) {
  console.error(`FAIL  expected exit 0 against the real scripts/ tree once wired, got ${resultReal.status}: ${resultReal.stdout}${resultReal.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  real repo scripts/ tree, fully wired -> exit 0, no false alarm');
}
```

- [ ] **Step 4: Run the catch case now (Step 2), then wire this file into check-meta.mjs (Step 5 below), THEN run Step 3's real-tree assertion**

Run: `node scripts/tests/test-check-gate-wiring-l40.mjs` immediately after Step 2 is written — expect
the catch PASS and the real-tree assertion to FAIL (not yet wired). Wire the file (next step), then
re-run — expect both PASS.

- [ ] **Step 5: Wire into check-meta.mjs as the LAST run() call**

```javascript
// scripts/check-meta.mjs, as the final run(...) call in the file
run('check-gate-wiring', 'check-gate-wiring (L40 — every check-*.mjs file is actually called from this orchestrator)', 'check-gate-wiring.mjs');
```

- [ ] **Step 6: Re-run the test file, paste output**

Run: `node scripts/tests/test-check-gate-wiring-l40.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 61 of 91 ... (30 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-gate-wiring.mjs scripts/tests/test-check-gate-wiring-l40.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 13): implement and declare L40 — every check-*.mjs must be wired into check-meta.mjs"
```

### Task 14: Implement and declare `L75` — no untracked file under `tests/**` at commit time

**Files:**
- Create: `scripts/check-untracked-tests.mjs`
- Test: `scripts/tests/test-check-untracked-tests-l75.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-untracked-tests', 'check-untracked-tests (L75 —
  a new test file left untracked never runs in CI)', 'check-untracked-tests.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Write the gate**

```javascript
// scripts/check-untracked-tests.mjs — L75: a test file sitting untracked under tests/** never runs
// in CI (CI only sees committed files), so it silently never executes despite existing on disk — a
// mechanical `git status --porcelain` scan for `??` entries under tests/**, exactly the shape the
// ranking doc names as cheap to build.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L75'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

let status;
try {
  status = execSync('git status --porcelain', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read git status in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const untrackedTests = status.split('\n')
  .filter(l => l.startsWith('?? '))
  .map(l => l.slice(3).trim())
  .filter(p => /(^|[\\/])tests[\\/]/.test(p) || p.startsWith('tests/'));

console.log(`L75: ${untrackedTests.length} untracked file(s) under tests/** at commit time.`);
if (untrackedTests.length) {
  console.error('FAIL: untracked test file(s) — CI will never run these:');
  for (const p of untrackedTests) console.error(`  x ${p}`);
  console.error('  Fix: git add the file(s), or delete them if they are scratch work.');
  process.exit(1);
}
console.log('OK - no untracked file under tests/**.');
```

- [ ] **Step 2: Write the catch test**

```javascript
// scripts/tests/test-check-untracked-tests-l75.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-untracked-tests.mjs');

// CATCH: a fresh git repo with an untracked file under tests/ -> exit 1.
const dir = tempDir('untracked-tests-catch-');
execSync('git init -q', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m init', { cwd: dir });
writeFile(dir, 'tests/test-new-thing.mjs', '// new test, never git add-ed');
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0 || !/test-new-thing\.mjs/.test(result.stdout + result.stderr)) {
  console.error(`FAIL  expected exit 1 naming the untracked test file, got status=${result.status}: ${result.stdout}${result.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  untracked file under tests/ -> exit 1, names the file');
}
```

- [ ] **Step 3: Write the false-alarm test — a clean tree, and an untracked file OUTSIDE tests/, must pass**

```javascript
// appended to scripts/tests/test-check-untracked-tests-l75.mjs
const dir2 = tempDir('untracked-tests-false-alarm-');
execSync('git init -q', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m init', { cwd: dir2 });
writeFile(dir2, 'scratch/notes.txt', 'not a test file'); // untracked, but not under tests/
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — untracked file outside tests/ is not this rule's business, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  untracked file outside tests/ -> exit 0, no false alarm; clean tree also exit 0');
}
```

- [ ] **Step 4: Run both, paste output**

Run: `node scripts/tests/test-check-untracked-tests-l75.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 5: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 62 of 91 ... (29 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-untracked-tests.mjs scripts/tests/test-check-untracked-tests-l75.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 14): implement and declare L75 — no untracked file under tests/** at commit"
```

### Task 15: Implement and declare `DoD-8` — an `app.js`/`app.css` change requires a fresh `mockups/**` file in the same commit

**Files:**
- Create: `scripts/check-mockup-freshness.mjs`
- Test: `scripts/tests/test-check-mockup-freshness-dod8.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-mockup-freshness', 'check-mockup-freshness
  (DoD-8 — a UI change ships a screenshot in the same commit)', 'check-mockup-freshness.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Write the gate — staged-diff scoped, not full history**

```javascript
// scripts/check-mockup-freshness.mjs — DoD-8: "Any UI change: screenshot at 390x844, attached and
// actually looked at." Mechanically checkable half: if this commit's staged changes touch app.js or
// app.css, the SAME commit must also touch (add or modify) a file under mockups/**. Cannot verify
// "actually looked at" — states that limit plainly rather than pretending to check it.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['DoD-8'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

let staged;
try {
  staged = execSync('git diff --cached --name-only', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read staged diff in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const files = staged.split('\n').filter(Boolean);
const touchesUi = files.some(f => f === 'app.js' || f === 'app.css' || f.endsWith('/app.js') || f.endsWith('/app.css'));
const touchesMockup = files.some(f => f.startsWith('mockups/'));

console.log(`DoD-8: staged files touch app.js/app.css: ${touchesUi} · touch mockups/**: ${touchesMockup}`);
if (touchesUi && !touchesMockup) {
  console.error('FAIL: DoD-8 — this commit changes app.js/app.css but stages no mockups/** file.');
  console.error('  Fix: git add a screenshot at 390x844 under mockups/ in this same commit — or, if this');
  console.error('  change has no visible effect (pure refactor), state that in the commit body.');
  process.exit(1);
}
console.log('OK - no UI change without an accompanying mockups/** file in this commit (or no UI change at all).');
```

- [ ] **Step 2: Write the catch test**

```javascript
// scripts/tests/test-check-mockup-freshness-dod8.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-mockup-freshness.mjs');

// CATCH: app.js staged, no mockups/** staged -> exit 1.
const dir = tempDir('mockup-freshness-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'app.js', 'console.log(1);');
execSync('git add app.js', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — app.js staged with no mockups/** file, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  app.js staged alone -> exit 1, DoD-8');
}
```

- [ ] **Step 3: Write the false-alarm test — a non-UI commit, and a UI commit WITH a mockup, must pass**

```javascript
// appended to scripts/tests/test-check-mockup-freshness-dod8.mjs
const dir2 = tempDir('mockup-freshness-false-alarm-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'app.js', 'console.log(1);');
writeFile(dir2, 'mockups/example-390x844.png', 'not a real png, fine for this test');
execSync('git add app.js mockups/example-390x844.png', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — app.js + a mockups/** file both staged, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  app.js + mockups/** both staged -> exit 0, no false alarm');
}

const dir3 = tempDir('mockup-freshness-nonui-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'docs/README.md', 'unrelated doc change');
execSync('git add docs/README.md', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — no UI file touched at all, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  non-UI commit -> exit 0, no false alarm');
}
```

- [ ] **Step 4: Run all three, paste output**

Run: `node scripts/tests/test-check-mockup-freshness-dod8.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 5: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 63 of 91 ... (28 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-mockup-freshness.mjs scripts/tests/test-check-mockup-freshness-dod8.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 15): implement and declare DoD-8 — UI change requires a same-commit mockup"
```

### Task 16: Implement and declare `H11` — every `docs/CAPABILITIES.md`-relevant commit keeps that file current

**Files:**
- Create: `scripts/check-capabilities-fresh.mjs`
- Test: `scripts/tests/test-check-capabilities-fresh-h11.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-capabilities-fresh', 'check-capabilities-fresh
  (H11 — docs/CAPABILITIES.md exists and is named wherever a capability changes)',
  'check-capabilities-fresh.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Confirm H11's target file exists, and design the mechanically-checkable half**

The ranking doc: "none — no script anywhere references CAPABILITIES.md. Confirmed missing detector."
H11 (project CLAUDE.md, H12 duty referenced): `docs/CAPABILITIES.md` must exist and stay current. The
mechanically-checkable half this task implements: the file **must exist**, and **any commit that
modifies a file under `scripts/hooks/**` (a capability of the enforcement system itself changing) must
also touch `docs/CAPABILITIES.md` in the same commit** — the same "same-commit currency" shape
`check-board-fresh.mjs`/`DoD-8` already use elsewhere in this corpus, applied to H11's own target.

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-capabilities-fresh.mjs — H11: docs/CAPABILITIES.md must exist, and any commit that
// changes scripts/hooks/** (a capability of the enforcement system itself) must touch the
// capabilities doc in the same commit — same same-commit-currency shape as DoD-8/check-board-fresh.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['H11'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const CAPS_PATH = process.env.CAPABILITIES_PATH || join(ROOT, 'docs', 'CAPABILITIES.md');

if (!existsSync(CAPS_PATH)) {
  console.error(`FAIL: H11 — ${CAPS_PATH} does not exist.`);
  process.exit(1);
}

let staged;
try {
  staged = execSync('git diff --cached --name-only', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read staged diff in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const files = staged.split('\n').filter(Boolean);
const touchesHooks = files.some(f => /(^|\/)scripts\/hooks\//.test(f));
const touchesCaps = files.some(f => f.endsWith('docs/CAPABILITIES.md') || f === 'docs/CAPABILITIES.md');

console.log(`H11: docs/CAPABILITIES.md exists · staged touches scripts/hooks/**: ${touchesHooks} · staged touches CAPABILITIES.md: ${touchesCaps}`);
if (touchesHooks && !touchesCaps) {
  console.error('FAIL: H11 — this commit changes scripts/hooks/** but does not update docs/CAPABILITIES.md in the same commit.');
  process.exit(1);
}
console.log('OK - CAPABILITIES.md exists, and no hooks-capability change shipped without it.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-capabilities-fresh-h11.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-capabilities-fresh.mjs');

// CATCH: a scripts/hooks/** change staged with no docs/CAPABILITIES.md touch -> exit 1.
const dir = tempDir('caps-fresh-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'docs/CAPABILITIES.md', '# capabilities');
execSync('git add docs/CAPABILITIES.md', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir });
writeFile(dir, 'scripts/hooks/rules/example.mjs', '// new rule');
execSync('git add scripts/hooks/rules/example.mjs', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir, CAPABILITIES_PATH: join(dir, 'docs', 'CAPABILITIES.md') });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — hooks change with no CAPABILITIES.md touch, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  scripts/hooks/** staged alone -> exit 1, H11');
}
```

- [ ] **Step 4: Write the false-alarm test**

```javascript
// appended to scripts/tests/test-check-capabilities-fresh-h11.mjs
const dir2 = tempDir('caps-fresh-false-alarm-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'docs/CAPABILITIES.md', '# capabilities');
execSync('git add docs/CAPABILITIES.md', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir2 });
writeFile(dir2, 'scripts/hooks/rules/example.mjs', '// new rule');
writeFile(dir2, 'docs/CAPABILITIES.md', '# capabilities\n\n- example rule added');
execSync('git add -A', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2, CAPABILITIES_PATH: join(dir2, 'docs', 'CAPABILITIES.md') });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — hooks change plus a CAPABILITIES.md update, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  scripts/hooks/** change with a same-commit CAPABILITIES.md update -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run both, paste output**

Run: `node scripts/tests/test-check-capabilities-fresh-h11.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 6: Confirm `docs/CAPABILITIES.md` exists in the real repo before wiring this blocking**

Run (read-only check, not an edit under this plan's read-only constraint — if the file is absent,
raise it with the owner per §10.8 before wiring this gate blocking, since a missing target file would
make every commit fail):

```bash
git ls-files docs/CAPABILITIES.md
```

If absent, this task's wiring step blocks on Step 1's `existsSync` check for every future commit —
escalate to the owner before landing Step 7, per the Waiver Gate (a missing target is a real gap, not
one this plan may paper over by weakening the check).

- [ ] **Step 7: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 64 of 91 ... (27 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-capabilities-fresh.mjs scripts/tests/test-check-capabilities-fresh-h11.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 16): implement and declare H11 — CAPABILITIES.md exists and stays current with hooks changes"
```

### Task 17: Implement and declare `10.20` — a language dictionary must change in the same commit as `app.js` string changes

**Files:**
- Create: `scripts/check-i18n-commit-sync.mjs`
- Test: `scripts/tests/test-check-i18n-commit-sync-10-20.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-i18n-commit-sync', 'check-i18n-commit-sync
  (10.20 — an app.js string change ships with a lang/** touch in the same commit)',
  'check-i18n-commit-sync.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Design the mechanically-checkable half, honestly scoped**

The ranking doc: `scripts/i18n-extract.mjs` exists as a harvester but is invoked by hand, not a
commit-time diff. Building a true per-string diff (which literal strings changed) is out of this
task's reach in one detector; the mechanically-cheap, honest half implemented here: **a commit that
touches `app.js` in a way that changes a quoted string literal count must also touch some file under
`lang/**` in the same commit** — a coarse but real signal, stated as coarse in the file's own header
rather than oversold as precise.

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-i18n-commit-sync.mjs — 10.20: a coarse, honestly-scoped half of "when app.js
// strings change, the language dictionaries change too." NOT a true per-string diff (that is
// scripts/i18n-extract.mjs's job, invoked by hand today per the ranking doc's own finding) — this
// gate only asks whether the STAGED app.js diff's quoted-string-literal COUNT differs from HEAD's,
// and if so, whether lang/** was also touched. A string swapped 1-for-1 in place (same count) is
// invisible to this coarse signal — stated here, not hidden, because overselling precision this
// gate does not have would itself be an L77 (a check reporting more than it measured).
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['10.20'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

function countStrings(text) {
  return (text.match(/'[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*"/g) || []).length;
}

let staged;
try {
  staged = execSync('git diff --cached --name-only', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read staged diff in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const files = staged.split('\n').filter(Boolean);
const appJsChanged = files.some(f => f === 'app.js' || f.endsWith('/app.js'));
const touchesLang = files.some(f => f.startsWith('lang/') || f.includes('/lang/'));

if (!appJsChanged) {
  console.log('OK - app.js not staged; not this rule\'s business.');
  process.exit(0);
}

let headText = '', stagedText = '';
try {
  headText = execSync('git show HEAD:app.js', { cwd: GITROOT, encoding: 'utf8' });
} catch { headText = ''; } // app.js is new in this commit — every staged string counts as added
try {
  stagedText = execSync('git show :app.js', { cwd: GITROOT, encoding: 'utf8' });
} catch { stagedText = ''; }

const delta = Math.abs(countStrings(stagedText) - countStrings(headText));
console.log(`10.20: app.js quoted-string-literal count delta: ${delta} · lang/** touched in this commit: ${touchesLang}`);
if (delta > 0 && !touchesLang) {
  console.error(`FAIL: 10.20 — app.js's string-literal count changed by ${delta} but no lang/** file is staged in the same commit.`);
  console.error('  Fix: git add the updated lang/** dictionary file(s) in this same commit, or run scripts/i18n-extract.mjs first.');
  process.exit(1);
}
console.log('OK - no app.js string-literal-count change without an accompanying lang/** touch (coarse signal, see file header).');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-i18n-commit-sync-10-20.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-i18n-commit-sync.mjs');

// CATCH: app.js's string count grows, no lang/** staged -> exit 1.
const dir = tempDir('i18n-sync-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'app.js', "const a = 'hello';\n");
execSync('git add app.js', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir });
writeFile(dir, 'app.js', "const a = 'hello'; const b = 'new string';\n");
execSync('git add app.js', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — app.js string count grew, no lang/** staged, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  app.js string-literal count grows, no lang/** touch -> exit 1, 10.20');
}
```

- [ ] **Step 4: Write the false-alarm test — a lang/** touch, and a non-string app.js change, must both pass**

```javascript
// appended to scripts/tests/test-check-i18n-commit-sync-10-20.mjs
const dir2 = tempDir('i18n-sync-false-alarm-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'app.js', "const a = 'hello';\n");
execSync('git add app.js', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir2 });
writeFile(dir2, 'app.js', "const a = 'hello'; const b = 'new string';\n");
writeFile(dir2, 'lang/en.json', '{"b": "new string"}');
execSync('git add -A', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — app.js string change with a lang/** touch, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  app.js string change with a same-commit lang/** touch -> exit 0, no false alarm');
}

const dir3 = tempDir('i18n-sync-no-appjs-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'docs/x.md', 'unrelated');
execSync('git add docs/x.md', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — app.js not staged at all, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  app.js not staged -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-i18n-commit-sync-10-20.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 65 of 91 ... (26 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-i18n-commit-sync.mjs scripts/tests/test-check-i18n-commit-sync-10-20.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3a, Task 17): implement and declare 10.20 — coarse app.js/lang commit-sync signal"
```

### Task 18: Phase 3a liveness test and overhead measurement

**Files:**
- Test: `scripts/tests/test-phase3a-liveness.mjs` (new)

**Interfaces:**
- Consumes: `scripts/check-meta.mjs`, the real entry point for every `commit-gate` rule.
- Produces: the measured overhead evidence pasted into this task.

- [ ] **Step 1: Write the liveness test — check-meta.mjs run with no environment override, against the real repo**

```javascript
// scripts/tests/test-phase3a-liveness.mjs — §3.4.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'check-meta.mjs')], { cwd: ROOT, encoding: 'utf8' });
if (r.error) {
  console.error(`FAIL  check-meta.mjs did not even start with no env override: ${r.error}`);
  process.exitCode = 1;
} else {
  const carriesNewGates = ['check-suite-evidence', 'check-h13-r-form', 'check-gate-wiring', 'check-untracked-tests', 'check-mockup-freshness', 'check-capabilities-fresh', 'check-i18n-commit-sync']
    .every(name => r.stdout.includes(name));
  if (!carriesNewGates) {
    console.error('FAIL  check-meta.mjs output does not mention all 7 Phase 3a gates by name — one may not actually be wired');
    process.exitCode = 1;
  } else {
    console.log(`PASS  check-meta.mjs (no env override) ran all 7 Phase 3a gates against the real repo, exit ${r.status}`);
  }
}
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase3a-liveness.mjs`
Expected: one PASS line, exit code 0.

- [ ] **Step 3: Measure overhead**

Time `node scripts/check-meta.mjs` end to end (the whole orchestrator, since these 7 rules are
`commit-gate`, not per-tool-call hooks — the relevant overhead figure here is the orchestrator's own
wall time, reported against itself before/after this phase, not the 61ms pretooluse baseline which
governs the hook-pipeline mechanism points only). Paste both numbers (before Phase 3a, after Phase
3a) into this task's evidence.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 65 of 91 mechanically-enforceable rules covered (26 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase3a-liveness.mjs
git commit -m "test(Arc 3 Phase 3a, Task 18): liveness test + overhead measurement, Phase 3a closes at 65/91"
```

---

### Phase 3b (6 rules): `L17`, `10.4`, `10.1`, `DoD-10`, `DoD-2`, `L82`

### Task 19: Implement and declare `L17` via a new wrapper check — `sync-docs.sh`'s bash form is structurally invisible to the coverage gate

**Files:**
- Create: `scripts/check-sync-docs-scope.mjs`
- Test: `scripts/tests/test-check-sync-docs-scope-l17.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-sync-docs-scope', 'check-sync-docs-scope (L17 —
  the docs-sync git-add line must include CLAUDE.md, statically checked)',
  'check-sync-docs-scope.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: State the structural problem plainly, then solve it without touching the fix that already works**

The ranking doc's finding on L17: `scripts/sync-docs.sh` already contains the correct fix (`git add
docs/ .claude/skills/ scripts/ src/ CLAUDE.md`), but `check-rule-coverage.mjs`'s scanner only reads
`.mjs` files under three directories — a `.sh` file can never carry a `RULE_IDS` declaration the
scanner will see, no matter what is added to it. Declaring L17 nowhere would help, per the ranking
doc's own conclusion. The fix this task applies: a NEW `.mjs` file that **statically checks
`sync-docs.sh`'s own source text** for the exact fix (the `git add` line naming `CLAUDE.md`), and
declares `RULE_IDS = ['L17']` on itself — the enforcement lives in a `.mjs` wrapper, not in the shell
script, so the real fix in `sync-docs.sh` is untouched and the coverage gate can see the guarantee.

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-sync-docs-scope.mjs — L17: CLAUDE.md must never be silently dropped from the
// docs-sync push again. sync-docs.sh already carries the real fix (a `git add` line naming
// CLAUDE.md); check-rule-coverage.mjs's scanner only reads .mjs files under three directories and
// can never see a declaration inside a .sh file. This wrapper statically re-checks sync-docs.sh's
// own source text for the fix and declares the rule on ITSELF — the enforcement surface moves to a
// file the scanner can see, without touching the .sh file's own working code.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L17'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = process.env.SYNC_DOCS_PATH || join(ROOT, 'scripts', 'sync-docs.sh');

if (!existsSync(SCRIPT_PATH)) {
  console.error(`FAIL: L17 — ${SCRIPT_PATH} not found; cannot verify the docs-sync scope.`);
  process.exit(1);
}
const text = readFileSync(SCRIPT_PATH, 'utf8');
const addLines = text.split('\n').filter(l => /^\s*git\s+add\b/.test(l));
const anyAddsClaudeMd = addLines.some(l => /\bCLAUDE\.md\b/.test(l));

console.log(`L17: ${addLines.length} 'git add' line(s) found in ${SCRIPT_PATH}, CLAUDE.md named in one of them: ${anyAddsClaudeMd}`);
if (!anyAddsClaudeMd) {
  console.error('FAIL: L17 — sync-docs.sh no longer stages CLAUDE.md; a docs push would silently drop it again.');
  process.exit(1);
}
console.log('OK - sync-docs.sh still stages CLAUDE.md in its docs-sync git add.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-sync-docs-scope-l17.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-sync-docs-scope.mjs');

// CATCH: a sync-docs.sh whose git add line has regressed to omit CLAUDE.md -> exit 1.
const dir = tempDir('sync-docs-scope-catch-');
const shPath = writeFile(dir, 'sync-docs.sh', '#!/bin/sh\ngit add docs/ .claude/skills/ scripts/ src/\n');
const result = runNode(SCRIPT, [], { SYNC_DOCS_PATH: shPath });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — CLAUDE.md missing from the git add line, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  git add line regressed to omit CLAUDE.md -> exit 1, L17');
}
```

- [ ] **Step 4: Write the false-alarm test — the real, already-fixed `sync-docs.sh` must pass today**

```javascript
// appended to scripts/tests/test-check-sync-docs-scope-l17.mjs
const resultReal = runNode(SCRIPT, []); // no override — the real repo's real sync-docs.sh
if (resultReal.status !== 0) {
  console.error(`FAIL  expected exit 0 against the real, already-fixed sync-docs.sh, got ${resultReal.status}: ${resultReal.stdout}${resultReal.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  real sync-docs.sh (already fixed) -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run both, paste output**

Run: `node scripts/tests/test-check-sync-docs-scope-l17.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 66 of 91 ... (25 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-sync-docs-scope.mjs scripts/tests/test-check-sync-docs-scope-l17.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3b, Task 19): implement and declare L17 via an .mjs wrapper the coverage scanner can see"
```

### Task 20: Implement and declare `10.4` — every bugfix commit records the failure in §11

**Files:**
- Create: `scripts/check-failure-recorded.mjs`
- Test: `scripts/tests/test-check-failure-recorded-10-4.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-failure-recorded', 'check-failure-recorded
  (10.4 — a bugfix commit records the failure in development-discipline.md §11, per-commit not just
  per-release)', 'check-failure-recorded.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: State the overlap the ranking doc flags, and the narrower thing this task actually builds**

`gate-lessons.mjs` already checks §11 currency at release boundaries (`10.16`'s substrate). 10.4's own
text ("every failure recorded") is per-**failure**, not per-**release**. This task closes that gap at
the commit granularity `10.16`'s existing gate does not reach: **a commit whose message identifies
itself as a bugfix (`^fix\(` or the word "bug"/"regression" in the subject) must either touch
`docs/process/development-discipline.md` in the same commit, or the commit message must explicitly
say the lesson was already logged** (a stated escape hatch, not a silent one — matching this
project's own pattern of "the fix or the explicit statement", never a silent skip).

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-failure-recorded.mjs — 10.4: "every failure recorded", at COMMIT granularity, not
// just gate-lessons.mjs's existing RELEASE-boundary check (which is 10.16's substrate, and only
// fires at a release). A commit whose own message identifies itself as a bugfix must show its
// lesson landing — either the same commit touches development-discipline.md §11, or the message
// says explicitly the lesson is already logged (a STATED escape hatch, never a silent one).
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['10.4'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

let subject = '';
try {
  subject = execSync('git -c log.showsignature=false log -1 --format=%s', { cwd: GITROOT, encoding: 'utf8' }).trim();
} catch { /* no HEAD yet — nothing to check */ }

const isBugfix = /^fix\(|\bbug\b|\bregression\b/i.test(subject);
if (!isBugfix) {
  console.log('OK - HEAD commit is not a bugfix (no fix(/bug/regression marker); not this rule\'s business.');
  process.exit(0);
}

let body = '';
try {
  body = execSync('git -c log.showsignature=false log -1 --format=%B', { cwd: GITROOT, encoding: 'utf8' });
} catch { body = subject; }

let staged;
try {
  staged = execSync('git diff --cached --name-only', { cwd: GITROOT, encoding: 'utf8' });
} catch { staged = ''; }
const touchesDiscipline = staged.split('\n').some(f => f.endsWith('development-discipline.md'));
const claimsAlreadyLogged = /already logged|lesson (already )?recorded|§11 unchanged/i.test(body);

console.log(`10.4: HEAD is a bugfix commit ("${subject.slice(0, 60)}") · touches development-discipline.md: ${touchesDiscipline} · claims already-logged: ${claimsAlreadyLogged}`);
if (!touchesDiscipline && !claimsAlreadyLogged) {
  console.error('FAIL: 10.4 — this bugfix commit records no lesson in development-discipline.md §11, and does not state the lesson was already logged.');
  console.error('  Fix: add the §11 entry in this same commit, or state explicitly why none is needed.');
  process.exit(1);
}
console.log('OK - bugfix commit either logs the lesson here or states why none is needed.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-failure-recorded-10-4.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-failure-recorded.mjs');

// CATCH: a fix( commit with no development-discipline.md touch and no already-logged claim -> exit 1.
const dir = tempDir('failure-recorded-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'app.js', 'x');
execSync('git add app.js', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit -q -m "fix(rendering): a real bug fix"', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — bugfix commit with no lesson recorded, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  fix( commit with no §11 touch and no already-logged claim -> exit 1, 10.4');
}
```

- [ ] **Step 4: Write the false-alarm test — a non-bugfix commit, and a bugfix commit that logs the lesson, must both pass**

```javascript
// appended to scripts/tests/test-check-failure-recorded-10-4.mjs
const dir2 = tempDir('failure-recorded-with-lesson-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'app.js', 'x');
writeFile(dir2, 'docs/process/development-discipline.md', '## §11\n- L90: new lesson');
execSync('git add -A', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m "fix(rendering): a real bug fix"', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — bugfix commit that logs the §11 lesson, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  bugfix commit with a §11 touch in the same commit -> exit 0, no false alarm');
}

const dir3 = tempDir('failure-recorded-nonbugfix-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'app.js', 'x');
execSync('git add app.js', { cwd: dir3 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m "feat: new feature, no bug involved"', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — non-bugfix commit, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  non-bugfix commit -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-failure-recorded-10-4.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 67 of 91 ... (24 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-failure-recorded.mjs scripts/tests/test-check-failure-recorded-10-4.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3b, Task 20): implement and declare 10.4 — per-commit bugfix lesson recording"
```

### Task 21: Implement and declare `10.1` — forbidden waiver phrases in a commit message

**Files:**
- Create: `scripts/check-no-waiver-phrases.mjs`
- Test: `scripts/tests/test-check-no-waiver-phrases-10-1.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-no-waiver-phrases', 'check-no-waiver-phrases
  (10.1 — a commit message may not say good enough for now / known minor / deferring without an
  explicit owner-agreement citation)', 'check-no-waiver-phrases.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Ground this in the rule's own literal words, honestly stated as a proxy**

The ranking doc: 10.1 ("100% working before moving forward") has no artifact encoding "100% working"
— confirmed not mechanically checkable in full. The literal text this task DOES check is the
project's own §10.1 clause: *"no 'good enough for now', no 'known minor', no deferring a defect into
a later phase without explicit owner agreement."* Those exact phrases, appearing in a commit message
with no accompanying "owner agreed"/"owner approved" citation, are the mechanically-checkable half —
stated as a proxy for the larger rule, not a full implementation of it.

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-no-waiver-phrases.mjs — 10.1: the literal forbidden phrases from the rule's own
// text ("good enough for now", "known minor", "deferring") in a commit message, unless the SAME
// message cites explicit owner agreement. This is a stated PROXY for "100% working before moving
// forward" — that larger claim has no artifact to check against (per the ranking doc's own finding)
// — not a full implementation of 10.1, and this file says so rather than overselling it.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['10.1'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

const FORBIDDEN = [/good enough for now/i, /known minor/i, /deferring\b/i];
const OWNER_AGREED = /owner (agreed|approved|accepted)/i;

let body = '';
try {
  body = execSync('git -c log.showsignature=false log -1 --format=%B', { cwd: GITROOT, encoding: 'utf8' });
} catch { body = ''; }

const hits = FORBIDDEN.filter(re => re.test(body)).map(re => re.source);
console.log(`10.1: forbidden-phrase hit(s) in HEAD commit message: ${hits.length} · owner-agreement citation present: ${OWNER_AGREED.test(body)}`);
if (hits.length && !OWNER_AGREED.test(body)) {
  console.error(`FAIL: 10.1 — commit message uses a forbidden waiver phrase (${hits.join(', ')}) with no explicit owner-agreement citation.`);
  console.error('  Fix: either remove the phrase and finish the work, or cite the explicit owner agreement in this same message.');
  process.exit(1);
}
console.log('OK - no unattributed waiver phrase in the HEAD commit message.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-no-waiver-phrases-10-1.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-no-waiver-phrases.mjs');

// CATCH: "good enough for now" with no owner-agreement citation -> exit 1.
const dir = tempDir('waiver-catch-');
execSync('git init -q', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "feat: ship it, good enough for now"', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — unattributed waiver phrase, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  "good enough for now" with no owner-agreement citation -> exit 1, 10.1');
}
```

- [ ] **Step 4: Write the false-alarm test — a normal commit, and one WITH an explicit owner-agreement citation, must both pass**

```javascript
// appended to scripts/tests/test-check-no-waiver-phrases-10-1.mjs
const dir2 = tempDir('waiver-cited-');
execSync('git init -q', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "feat: ship it, known minor gap — owner approved deferring this to Phase 5"', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — waiver phrase WITH an owner-agreement citation, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  waiver phrase with an explicit owner-agreement citation -> exit 0, no false alarm');
}

const dir3 = tempDir('waiver-normal-');
execSync('git init -q', { cwd: dir3 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "feat: a normal commit with none of the forbidden phrases"', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — a normal commit, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  normal commit, no forbidden phrase -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-no-waiver-phrases-10-1.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 68 of 91 ... (23 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-no-waiver-phrases.mjs scripts/tests/test-check-no-waiver-phrases-10-1.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3b, Task 21): implement and declare 10.1 — forbidden waiver phrases without owner-agreement citation"
```

### Task 22: Implement and declare `DoD-10` — a safety-field edit in `data.py`/`sources.py` needs an explicit safety-cited commit message

**Files:**
- Create: `scripts/check-safety-field-diff.mjs`
- Test: `scripts/tests/test-check-safety-field-diff-dod10.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-safety-field-diff', 'check-safety-field-diff
  (DoD-10 — a bcheck/temp/safe/duration line change in data.py/sources.py requires an explicit
  safety citation in the commit message)', 'check-safety-field-diff.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Scope this to the four field names the DoD line itself names, nothing wider**

Project CLAUDE.md §3 DoD line 10: "No `bcheck` stage, `temp`, `safe` value, or cook duration altered."
This task cannot classify "which fields count as safety" from an AST (the ranking doc's own stated
limit) — the narrower, honest thing it CAN check: a staged diff line in `data.py`/`sources.py`
matching one of the four literal field-name tokens, requiring the commit message to name a primary
source per `docs/sources/baldwin-backbone.md`'s own rule ("every safe value must trace to a cited
primary source").

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-safety-field-diff.mjs — DoD-10: a staged diff LINE in data.py/sources.py containing
// one of the four DoD-10 field tokens (bcheck, temp, safe, duration) requires the commit message to
// cite a primary source, per docs/sources/baldwin-backbone.md's own standing rule ("every safe value
// must trace to a cited primary source — never guess"). Cannot classify "is this really a safety
// field" from an AST — this is a token match on the diff, honestly narrower than the full DoD line,
// stated here rather than oversold.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['DoD-10'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const FIELD_TOKENS = /\b(bcheck|temp|safe|duration)\b/i;
const SOURCE_CITED = /USDA|FSIS|Baldwin|9\s*CFR|CFR\s*9|source:/i;

let staged;
try {
  staged = execSync('git diff --cached --name-only', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read staged diff in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const touchedSafetyFiles = staged.split('\n').filter(f => f === 'data.py' || f === 'sources.py' || f.endsWith('/data.py') || f.endsWith('/sources.py'));
if (!touchedSafetyFiles.length) {
  console.log('OK - data.py/sources.py not staged; not this rule\'s business.');
  process.exit(0);
}

let anyFieldLineChanged = false;
for (const f of touchedSafetyFiles) {
  let diff = '';
  try { diff = execSync(`git diff --cached -- ${JSON.stringify(f)}`, { cwd: GITROOT, encoding: 'utf8' }); } catch { continue; }
  const changedLines = diff.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
  if (changedLines.some(l => FIELD_TOKENS.test(l))) { anyFieldLineChanged = true; break; }
}

let body = '';
try { body = execSync('git -c log.showsignature=false log -1 --format=%B', { cwd: GITROOT, encoding: 'utf8' }); } catch { body = ''; }
const cited = SOURCE_CITED.test(body);

console.log(`DoD-10: safety-field-token line change in data.py/sources.py: ${anyFieldLineChanged} · source cited in commit message: ${cited}`);
if (anyFieldLineChanged && !cited) {
  console.error('FAIL: DoD-10 — a bcheck/temp/safe/duration line changed in data.py or sources.py with no primary-source citation in the commit message.');
  console.error('  Fix: cite the primary source (USDA/FSIS/Baldwin/9 CFR) in the commit message, per docs/sources/baldwin-backbone.md.');
  process.exit(1);
}
console.log('OK - no unattributed safety-field line change.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-safety-field-diff-dod10.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-safety-field-diff.mjs');

// CATCH: a temp value changed in data.py, commit message cites no source -> exit 1.
const dir = tempDir('safety-diff-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'data.py', "temp = 60\n");
execSync('git add data.py', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir });
writeFile(dir, 'data.py', "temp = 63\n");
execSync('git add data.py', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — temp value changed with no source citation, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  temp field line changed, no source cited -> exit 1, DoD-10');
}
```

- [ ] **Step 4: Write the false-alarm test — a cited change, and a non-safety-field change, must both pass**

```javascript
// appended to scripts/tests/test-check-safety-field-diff-dod10.mjs
const dir2 = tempDir('safety-diff-cited-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'data.py', "temp = 60\n");
execSync('git add data.py', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m init', { cwd: dir2 });
writeFile(dir2, 'data.py', "temp = 63\n");
execSync('git add data.py', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit -q -m "fix(data): USDA FSIS revised guidance, temp 60->63"', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — temp change with a USDA citation in the commit message, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  temp field change with a cited commit message -> exit 0, no false alarm');
}

const dir3 = tempDir('safety-diff-nonsafety-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'data.py', "def helper():\n    pass\n");
execSync('git add data.py', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — no safety-field token in the diff, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  data.py change with no safety-field token in the diff -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-safety-field-diff-dod10.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 69 of 91 ... (22 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-safety-field-diff.mjs scripts/tests/test-check-safety-field-diff-dod10.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3b, Task 22): implement and declare DoD-10 — safety-field diff requires a cited source"
```

### Task 23: Implement and declare `DoD-2` — an implementation-file commit ships with a paired test-file change

**Files:**
- Create: `scripts/check-test-implementation-pairing.mjs`
- Test: `scripts/tests/test-check-test-implementation-pairing-dod2.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-test-implementation-pairing',
  'check-test-implementation-pairing (DoD-2 — a source-code commit pairs a test-file change in the
  same commit unless it states why not)', 'check-test-implementation-pairing.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Scope this to what a commit-time diff CAN prove — pairing, not RED-then-GREEN**

The ranking doc: DoD-2 needs "a test file changed with an implementation file changed in the same
commit, and confirm the test was RED before" — the RED-then-GREEN half needs a time-series a single
commit's diff cannot see (that is what the DoD gate §3 line 2, and this project's own
`test-driven-development` skill, already enforce at review time). The pairing half IS checkable here.

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-test-implementation-pairing.mjs — DoD-2 (pairing half only, stated plainly): a
// commit that changes a source-code file outside tests/**/scripts/tests/** must also change a test
// file in the SAME commit, unless the message identifies itself as docs/chore/refactor-with-no-
// behavior-change. Cannot verify "RED witnessed first" from a single commit's diff (needs the
// commit-time-series the project's own test-driven-development skill and §3 DoD line 2 already
// enforce at review time) — this checks pairing only, and says so.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['DoD-2'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const EXEMPT_SUBJECT = /^(docs|chore|refactor)(\(|:)/i;
const NO_BEHAVIOR_CHANGE = /no behavior change|no behaviou?r change/i;

let subject = '', body = '';
try {
  subject = execSync('git -c log.showsignature=false log -1 --format=%s', { cwd: GITROOT, encoding: 'utf8' }).trim();
  body = execSync('git -c log.showsignature=false log -1 --format=%B', { cwd: GITROOT, encoding: 'utf8' });
} catch { /* no HEAD yet */ }

if (EXEMPT_SUBJECT.test(subject) || NO_BEHAVIOR_CHANGE.test(body)) {
  console.log(`OK - HEAD commit is exempt (docs/chore/refactor or states no behavior change): "${subject.slice(0, 60)}"`);
  process.exit(0);
}

let staged;
try {
  staged = execSync('git diff --cached --name-only', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read staged diff in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const files = staged.split('\n').filter(Boolean);
const isTestFile = (f) => /(^|\/)tests?\//.test(f) || /test[-_.]/.test(f.split('/').pop() || '');
const implFiles = files.filter(f => !isTestFile(f) && (f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.py')));
const testFiles = files.filter(isTestFile);

console.log(`DoD-2: ${implFiles.length} implementation file(s) staged, ${testFiles.length} test file(s) staged.`);
if (implFiles.length && !testFiles.length) {
  console.error('FAIL: DoD-2 — implementation file(s) staged with no paired test-file change in the same commit:');
  for (const f of implFiles) console.error(`  x ${f}`);
  console.error('  Fix: pair a test change in this commit, or mark the commit docs/chore/refactor with "no behavior change".');
  process.exit(1);
}
console.log('OK - implementation change paired with a test-file change (or no implementation file staged).');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-test-implementation-pairing-dod2.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-test-implementation-pairing.mjs');

// CATCH: an implementation file staged with no test file, commit message is a plain feat -> exit 1.
const dir = tempDir('pairing-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'src/feature.js', 'export function x() {}');
execSync('git add src/feature.js', { cwd: dir });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "feat: add a new feature"', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — implementation file with no paired test, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  implementation file staged alone, no test pairing -> exit 1, DoD-2');
}
```

- [ ] **Step 4: Write the false-alarm test — a paired commit, and an exempt refactor commit, must both pass**

```javascript
// appended to scripts/tests/test-check-test-implementation-pairing-dod2.mjs
const dir2 = tempDir('pairing-paired-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'src/feature.js', 'export function x() {}');
writeFile(dir2, 'tests/test-feature.mjs', "// test for x()");
execSync('git add -A', { cwd: dir2 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "feat: add a new feature"', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — implementation + a paired test file, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  implementation file paired with a test file in the same commit -> exit 0, no false alarm');
}

const dir3 = tempDir('pairing-exempt-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'src/feature.js', 'export function x() {}');
execSync('git add src/feature.js', { cwd: dir3 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "refactor: rename internal variable, no behavior change"', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — refactor commit stating no behavior change, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  refactor commit, no behavior change stated -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-test-implementation-pairing-dod2.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 70 of 91 ... (21 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-test-implementation-pairing.mjs scripts/tests/test-check-test-implementation-pairing-dod2.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3b, Task 23): implement and declare DoD-2 — test/implementation pairing per commit"
```

### Task 24: Implement and declare `L82` — a new gate ships with its own self-test in the same commit

**Files:**
- Create: `scripts/check-new-gate-has-test.mjs`
- Test: `scripts/tests/test-check-new-gate-has-test-l82.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-new-gate-has-test', 'check-new-gate-has-test
  (L82 — a new check-*.mjs file ships with a matching scripts/tests/test-check-*.mjs in the same
  commit, the cheapest available proxy for "run against the real tree")',
  'check-new-gate-has-test.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: State the proxy honestly**

The ranking doc: L82 needs "a new `check-*.mjs` file in this commit correlated against some record
that it was executed" — no evidence store for "was this run" exists yet. The proxy this task uses: a
brand-new `scripts/check-*.mjs` file staged in a commit must be staged alongside a matching
`scripts/tests/test-check-<name>-*.mjs` file — a self-test's mere presence does not prove it was RUN
green, but its **absence** proves the gate shipped with zero verification, which is the failure L82
names. This is the cheapest real signal available, stated as a proxy, not oversold as "proof of a
real-tree run."

- [ ] **Step 2: Write the gate**

```javascript
// scripts/check-new-gate-has-test.mjs — L82: a brand-new check-*.mjs file staged in a commit
// requires a matching scripts/tests/test-check-<name>*.mjs file staged in the SAME commit. This is a
// PROXY for "the new gate was run against the real tree" (no evidence store for that exists yet,
// per the ranking doc's own finding) — a self-test's presence does not prove it passed, but its
// absence proves zero verification shipped, which is exactly L82's named failure shape.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L82'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;

let staged;
try {
  staged = execSync('git diff --cached --name-status', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: could not read staged diff in ${GITROOT}: ${e.message}`);
  process.exit(1);
}
const lines = staged.split('\n').filter(Boolean);
const newGates = lines.filter(l => l.startsWith('A') && /(^|\/)check-.*\.mjs$/.test(l.split('\t')[1] || '')).map(l => l.split('\t')[1]);
const stagedPaths = lines.map(l => l.split('\t').pop());

console.log(`L82: ${newGates.length} brand-new check-*.mjs file(s) staged.`);
const missing = [];
for (const gatePath of newGates) {
  const name = basename(gatePath, '.mjs'); // e.g. "check-example"
  const hasTest = stagedPaths.some(p => p && p.includes('scripts/tests/') && p.includes(name));
  if (!hasTest) missing.push(gatePath);
}
if (missing.length) {
  console.error('FAIL: L82 — new gate(s) staged with no matching self-test staged in the same commit:');
  for (const g of missing) console.error(`  x ${g}`);
  console.error('  Fix: add scripts/tests/test-<gate-name>-*.mjs in this same commit.');
  process.exit(1);
}
console.log('OK - every new check-*.mjs file ships with a matching self-test in this commit.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-new-gate-has-test-l82.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-new-gate-has-test.mjs');

// CATCH: a new check-example.mjs staged with no matching self-test -> exit 1.
const dir = tempDir('new-gate-catch-');
execSync('git init -q', { cwd: dir });
writeFile(dir, 'scripts/check-example.mjs', '// a new gate, no test');
execSync('git add scripts/check-example.mjs', { cwd: dir });
const result = runNode(SCRIPT, [], { GITROOT: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — new gate with no self-test, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  new check-*.mjs staged with no matching self-test -> exit 1, L82');
}
```

- [ ] **Step 4: Write the false-alarm test — a new gate WITH its test, and an unrelated commit, must both pass**

```javascript
// appended to scripts/tests/test-check-new-gate-has-test-l82.mjs
const dir2 = tempDir('new-gate-with-test-');
execSync('git init -q', { cwd: dir2 });
writeFile(dir2, 'scripts/check-example.mjs', '// a new gate');
writeFile(dir2, 'scripts/tests/test-check-example-something.mjs', '// its self-test');
execSync('git add -A', { cwd: dir2 });
const result2 = runNode(SCRIPT, [], { GITROOT: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — new gate with a matching self-test staged, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  new gate + matching self-test both staged -> exit 0, no false alarm');
}

const dir3 = tempDir('new-gate-unrelated-');
execSync('git init -q', { cwd: dir3 });
writeFile(dir3, 'docs/x.md', 'unrelated');
execSync('git add docs/x.md', { cwd: dir3 });
const result3 = runNode(SCRIPT, [], { GITROOT: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — no new gate file staged at all, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  no new gate file staged -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-new-gate-has-test-l82.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 71 of 91 ... (20 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-new-gate-has-test.mjs scripts/tests/test-check-new-gate-has-test-l82.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 3b, Task 24): implement and declare L82 — a new gate ships with its own self-test"
```

### Task 25: Phase 3b liveness test, overhead measurement — Phase 3 (both sub-phases) closes

**Files:**
- Test: `scripts/tests/test-phase3b-liveness.mjs` (new)

**Interfaces:**
- Consumes: `scripts/check-meta.mjs`.
- Produces: the measured overhead evidence pasted into this task.

- [ ] **Step 1: Write the liveness test**

```javascript
// scripts/tests/test-phase3b-liveness.mjs — §3.4.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'check-meta.mjs')], { cwd: ROOT, encoding: 'utf8' });
const carriesNewGates = ['check-sync-docs-scope', 'check-failure-recorded', 'check-no-waiver-phrases', 'check-safety-field-diff', 'check-test-implementation-pairing', 'check-new-gate-has-test']
  .every(name => r.stdout.includes(name));
if (r.error || !carriesNewGates) {
  console.error(`FAIL  check-meta.mjs (no env override) missing a Phase 3b gate or failed to start: error=${r.error} stdoutHasAll=${carriesNewGates}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  check-meta.mjs (no env override) ran all 6 Phase 3b gates against the real repo, exit ${r.status}`);
}
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase3b-liveness.mjs`
Expected: one PASS line, exit code 0.

- [ ] **Step 3: Measure overhead**

Time `node scripts/check-meta.mjs` end to end again. Paste the new figure against the Phase 3a and
pre-Phase-3 figures.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm final Phase 3 coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 71 of 91 mechanically-enforceable rules covered (20 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase3b-liveness.mjs
git commit -m "test(Arc 3 Phase 3b, Task 25): liveness test + overhead measurement, Phase 3 closes at 71/91"
```

---

## Phase 4 — `pretooluse:Agent` remainder, 6 rules

`13`, `H15`, `10.23`, `L31a`, `L44`, `L83`. `13` is the "enforced in substance, wrong point" case
flagged by the ranking doc: `check-brief.mjs` already checks brief content, but as a `commit-gate`,
after dispatch, not at `pretooluse:Agent` time as the rule's own mechanism states — this phase moves
the check earlier rather than declaring it where it already runs.

### Task 26: Implement and declare `13` — brief-shape check moved to real dispatch time

**Files:**
- Create: `scripts/hooks/rules/brief-shape-at-dispatch.mjs`
- Test: `scripts/tests/test-brief-shape-at-dispatch-13.mjs`

**Interfaces:**
- Consumes: the six field-marker regexes and the DoD-12 full-suite-command ban already implemented in
  `scripts/check-brief.mjs` — read that file first and reuse its exact regex constants rather than
  redefining them, so the two checks (early warn, late block) never drift apart on what "a brief"
  means.
- Produces: `evaluate(input)`, `TOOLS = ['Agent']`, `RULE_IDS = ['13']`.

- [ ] **Step 1: Read `check-brief.mjs`'s field-marker regexes before writing anything**

`scripts/check-brief.mjs` already defines the six required field markers and the full-suite-command
ban. This task's own file imports those exact constants (exporting them from `check-brief.mjs` if not
already exported) rather than re-deriving them — two independently-drifting definitions of "what a
brief must contain" is the failure this step avoids.

- [ ] **Step 2: Write the new rule file, WARN-only at dispatch (the block stays at commit-gate, unchanged)**

```javascript
// scripts/hooks/rules/brief-shape-at-dispatch.mjs — Rule 13, moved to its OWN stated mechanism
// point (pretooluse:Agent — the brief's own text says "checked before dispatch") rather than left
// declared where check-brief.mjs already runs it (commit-gate, after the brief file already exists
// on disk). WARN here, not block: catching a malformed brief BEFORE dispatch is strictly better than
// catching it after, but check-brief.mjs's existing commit-gate block is the backstop that still
// exists — this is an earlier, cheaper warning, not a replacement for it.
export const TOOLS = ['Agent'];
export const RULE_IDS = ['13'];

import { REQUIRED_FIELD_MARKERS, FULL_SUITE_COMMAND_RE } from '../../check-brief.mjs';

export function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch' };
  }
  const prompt = (input.tool_input && input.tool_input.prompt) || '';
  if (!prompt) {
    return { decision: 'allow', reason: '13: no prompt text to inspect — not asserting a shape violation without content' };
  }
  const missing = REQUIRED_FIELD_MARKERS.filter((m) => !prompt.includes(m));
  const bansFullSuite = FULL_SUITE_COMMAND_RE.test(prompt) && !/npx playwright test\b(?!\s*--)/.test(prompt);

  if (!missing.length && !bansFullSuite) {
    return { decision: 'allow', reason: '13: dispatch prompt carries all required brief fields' };
  }
  return {
    decision: 'warn',
    reason: `13: this Agent dispatch prompt is missing field marker(s) [${missing.join(', ')}] or `
      + `names a non-plain full-suite command — check-brief.mjs will still block this at commit time `
      + `if the brief file lands as-is; fixing it now at dispatch time is cheaper.`,
  };
}
```

- [ ] **Step 3: Confirm `check-brief.mjs` exports the two constants (add the export if it does not already)**

Read `scripts/check-brief.mjs` in full before this step. If `REQUIRED_FIELD_MARKERS` and
`FULL_SUITE_COMMAND_RE` (or equivalently-named constants performing the same checks) are not already
`export`ed, add `export` to their existing declarations — this is a visibility change only, no
behavior change to `check-brief.mjs` itself.

- [ ] **Step 4: Write the catch test**

```javascript
// scripts/tests/test-brief-shape-at-dispatch-13.mjs
import { evaluate } from '../hooks/rules/brief-shape-at-dispatch.mjs';

// CATCH: a dispatch prompt missing required field markers -> warn.
const result = evaluate({
  tool_name: 'Agent',
  tool_input: { prompt: 'Go fix the bug in app.js, thanks.' },
});
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a brief missing its required fields, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  dispatch prompt missing required brief fields -> warn, names Rule 13');
}
```

- [ ] **Step 5: Run it, confirm PASS**

Run: `node scripts/tests/test-brief-shape-at-dispatch-13.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 6: Write the false-alarm test — a real, well-formed brief must never warn**

```javascript
// appended to scripts/tests/test-brief-shape-at-dispatch-13.mjs
import { REQUIRED_FIELD_MARKERS } from '../check-brief.mjs';

const wellFormedPrompt = REQUIRED_FIELD_MARKERS.map((m) => `${m}: filled in for this test`).join('\n');
const result2 = evaluate({ tool_name: 'Agent', tool_input: { prompt: wellFormedPrompt } });
if (result2.decision !== 'allow') {
  console.error(`FAIL  a brief carrying every required field marker must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  well-formed brief (all required field markers present) -> allow, no false alarm');
}
```

- [ ] **Step 7: Run it, paste output**

Run: `node scripts/tests/test-brief-shape-at-dispatch-13.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 8: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 72 of 91 ... (19 open)`.

- [ ] **Step 9: Commit**

```bash
git add scripts/hooks/rules/brief-shape-at-dispatch.mjs scripts/tests/test-brief-shape-at-dispatch-13.mjs scripts/check-brief.mjs
git commit -m "feat(Arc 3 Phase 4, Task 26): implement and declare Rule 13 at its real dispatch-time mechanism point"
```

### Task 27: Implement and declare `H15` — dispatch prompt must name a model/effort per the registry

**Files:**
- Create: `scripts/hooks/rules/model-effort-stated.mjs`
- Test: `scripts/tests/test-model-effort-stated-h15.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Agent']`, `RULE_IDS = ['H15']`.

- [ ] **Step 1: Scope narrowly — a literal model-name or effort-level token, not a semantic judgement**

H15 (project CLAUDE.md): Fable-high for planning; Sonnet 5 for dev, medium/high/xhigh by difficulty;
no escalation after success. The ranking doc: "would need to parse the dispatch prompt for an
explicit model/effort statement across every possible phrasing" if done naively. This task's narrow
version: WARN when a dispatch prompt names none of the known model tokens (`sonnet`, `opus`, `haiku`,
`fable`) AND none of the known effort tokens (`low`, `medium`, `high`, `xhigh`) anywhere in its text —
silent otherwise. A prompt that states either is accepted; this is intentionally permissive, not a
semantic check of whether the CHOICE was correct (H15's harder half, left to human review).

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/model-effort-stated.mjs — H15 (narrow half): a dispatch names SOME model or
// effort token. Does not judge whether the choice was correct (Fable-high for planning vs Sonnet for
// dev, medium/high/xhigh by difficulty) — that judgement needs task-content understanding this hook
// cannot have. WARN-only: a missing statement is a process gap worth a nudge, never a block, since
// the model/effort choice is a per-call kwarg with an efficient fix (add the word), never blocking work.
export const TOOLS = ['Agent'];
export const RULE_IDS = ['H15'];

const MODEL_TOKENS = /\b(sonnet|opus|haiku|fable)\b/i;
const EFFORT_TOKENS = /\b(low|medium|high|xhigh)\b/i;

export function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch' };
  }
  const prompt = (input.tool_input && input.tool_input.prompt) || '';
  const model = (input.tool_input && input.tool_input.model) || '';
  const combined = `${prompt} ${model}`;
  if (MODEL_TOKENS.test(combined) || EFFORT_TOKENS.test(combined)) {
    return { decision: 'allow', reason: 'H15: dispatch names a model or effort token' };
  }
  return {
    decision: 'warn',
    reason: 'H15: this dispatch names no model or effort level anywhere — the registry (project '
      + 'CLAUDE.md, model-selection-policy) expects Fable-high for planning/decisions, Sonnet 5 '
      + 'medium/high/xhigh by difficulty for dev; state one explicitly.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-model-effort-stated-h15.mjs
import { evaluate } from '../hooks/rules/model-effort-stated.mjs';

// CATCH: a dispatch with no model/effort token anywhere -> warn.
const result = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Go fix the bug in app.js.' } });
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a dispatch with no model/effort statement, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  dispatch with no model/effort token -> warn, H15');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-model-effort-stated-h15.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a dispatch naming either token, in either field, must allow**

```javascript
// appended to scripts/tests/test-model-effort-stated-h15.mjs
const result2 = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Fix the bug, use effort: high.', model: 'sonnet' } });
if (result2.decision !== 'allow') {
  console.error(`FAIL  a dispatch naming a model AND an effort token must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  dispatch naming a model/effort token -> allow, no false alarm');
}

const result3 = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Just fix it.', model: 'opus' } });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a dispatch naming the model in its own 'model' field must not warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  model named in the dedicated model field -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-model-effort-stated-h15.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 73 of 91 ... (18 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/model-effort-stated.mjs scripts/tests/test-model-effort-stated-h15.mjs
git commit -m "feat(Arc 3 Phase 4, Task 27): implement and declare H15 — dispatch must state a model or effort token"
```

### Task 28: Implement and declare `10.23` — dispatch must not be reactive-only ("while I'm here")

**Files:**
- Create: `scripts/hooks/rules/no-scope-creep-dispatch.mjs`
- Test: `scripts/tests/test-no-scope-creep-dispatch-10-23.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Agent']`, `RULE_IDS = ['10.23']`.

- [ ] **Step 1: Scope to the literal phrase this rule's neighbor (§12 Circle of Control) already names**

The ranking doc: "distinct from the numeric ceiling in 10.5a/L25 — this rule is about WHAT may be
dispatched, not HOW MANY." §12 (project CLAUDE.md) names the exact anti-pattern: "'while I'm here'
fixes are scope creep." This task's narrow, literal check: WARN when a dispatch prompt itself contains
that phrase (or its close paraphrase "since I'm already here" / "might as well also") — a self-
admission of scope creep in the prompt text, not a judgement about the task's actual scope.

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/no-scope-creep-dispatch.mjs — 10.23 (narrow half): a dispatch prompt that
// admits scope creep in its own text ("while I'm here", "since I'm already here", "might as well
// also"), the exact phrase §12 Circle of Control names as the anti-pattern. WARN-only: this is an
// efficiency concern (an agent doing two things makes both harder to review), not a substance block,
// and the alternative — split into two dispatches — is always available.
export const TOOLS = ['Agent'];
export const RULE_IDS = ['10.23'];

const SCOPE_CREEP_RE = /while\s+i'?m\s+here|since\s+i'?m\s+already\s+here|might\s+as\s+well\s+also/i;

export function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch' };
  }
  const prompt = (input.tool_input && input.tool_input.prompt) || '';
  if (!SCOPE_CREEP_RE.test(prompt)) {
    return { decision: 'allow', reason: '10.23: no self-admitted scope-creep phrase in this dispatch prompt' };
  }
  return {
    decision: 'warn',
    reason: '10.23: this dispatch prompt admits scope creep in its own text ("while I\'m here" / '
      + '"might as well also") — §12 Circle of Control: note the extra work, do not fold it into this '
      + 'dispatch. Split into a separate, explicitly-scoped dispatch instead.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-no-scope-creep-dispatch-10-23.mjs
import { evaluate } from '../hooks/rules/no-scope-creep-dispatch.mjs';

// CATCH: a dispatch prompt admitting scope creep -> warn.
const result = evaluate({
  tool_name: 'Agent',
  tool_input: { prompt: 'Fix the bug, and while I\'m here also refactor the unrelated module.' },
});
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a self-admitted scope-creep dispatch, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  "while I\'m here" in a dispatch prompt -> warn, 10.23');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-no-scope-creep-dispatch-10-23.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a normal, single-scope dispatch must never warn**

```javascript
// appended to scripts/tests/test-no-scope-creep-dispatch-10-23.mjs
const result2 = evaluate({
  tool_name: 'Agent',
  tool_input: { prompt: 'Fix the null-pointer bug in app.js line 402. Write a regression test first.' },
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  a normal single-scope dispatch must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  normal single-scope dispatch prompt -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-no-scope-creep-dispatch-10-23.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 74 of 91 ... (17 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/no-scope-creep-dispatch.mjs scripts/tests/test-no-scope-creep-dispatch-10-23.mjs
git commit -m "feat(Arc 3 Phase 4, Task 28): implement and declare 10.23 — self-admitted scope-creep phrase in a dispatch prompt"
```

### Task 29: Implement and declare `L31a` — dispatch prompt must not ask a subagent to wait on the full suite

**Files:**
- Create: `scripts/hooks/rules/no-full-suite-wait-in-dispatch.mjs`
- Test: `scripts/tests/test-no-full-suite-wait-in-dispatch-l31a.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Agent']`, `RULE_IDS = ['L31a']`.

- [ ] **Step 1: Confirm the cheap literal-text shape the ranking doc names**

The ranking doc: "should be cheap: literal string match on `npx playwright test` / suite-wait
phrasing" — L31a bans a dispatch prompt from asking a subagent to itself block on the full suite
(§11a: never run two suite runs concurrently; the controller/main thread owns that duty).

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/no-full-suite-wait-in-dispatch.mjs — L31a: a dispatch prompt asking a
// subagent to wait on a full suite run risks the §11a concurrent-suite-run collision (Windows
// loopback serialization; port-8123 collision) this project has already paid for. BLOCK (§3.2: this
// is a substance harm — a real collision corrupts the whole run's results, not just this one agent's
// — and the alternative is always available: the dispatcher runs the suite itself and reports the
// result back, rather than delegating the wait).
export const TOOLS = ['Agent'];
export const RULE_IDS = ['L31a'];

const FULL_SUITE_WAIT_RE = /\b(wait for|block(?:ing)? on|run and wait)\b[^.]*\b(npx playwright test|the full suite|pytest)\b/i;

export function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch' };
  }
  const prompt = (input.tool_input && input.tool_input.prompt) || '';
  if (!FULL_SUITE_WAIT_RE.test(prompt)) {
    return { decision: 'allow', reason: 'L31a: no full-suite-wait phrasing in this dispatch prompt' };
  }
  return {
    decision: 'block',
    reason: 'L31a: this dispatch prompt asks a subagent to wait on a full suite run — §11a: never '
      + 'run two suite runs concurrently, and only the dispatching thread should own that wait. '
      + 'Alternative: the dispatcher itself runs the suite and passes the result to the subagent, '
      + 'or the subagent is given a narrower single-test command instead.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-no-full-suite-wait-in-dispatch-l31a.mjs
import { evaluate } from '../hooks/rules/no-full-suite-wait-in-dispatch.mjs';

// CATCH: a dispatch prompt asking the subagent to wait on the full suite -> block.
const result = evaluate({
  tool_name: 'Agent',
  tool_input: { prompt: 'Please wait for npx playwright test to finish, then report the result.' },
});
if (result.decision !== 'block') {
  console.error(`FAIL  expected block on a full-suite-wait dispatch, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  dispatch prompt asking a subagent to wait on the full suite -> block, L31a');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-no-full-suite-wait-in-dispatch-l31a.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a dispatch naming a single-test command must never block**

```javascript
// appended to scripts/tests/test-no-full-suite-wait-in-dispatch-l31a.mjs
const result2 = evaluate({
  tool_name: 'Agent',
  tool_input: { prompt: 'Run npx playwright test tests/example.spec.ts and report the result.' },
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  a single-test playwright command must not block, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  single-test playwright command (not a wait on the FULL suite) -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-no-full-suite-wait-in-dispatch-l31a.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 75 of 91 ... (16 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/no-full-suite-wait-in-dispatch.mjs scripts/tests/test-no-full-suite-wait-in-dispatch-l31a.mjs
git commit -m "feat(Arc 3 Phase 4, Task 29): implement and declare L31a — block a dispatch that asks a subagent to wait on the full suite"
```

### Task 30: Implement and declare `L44` — a dispatch must not target a task whose predecessor's suite never ran

**Files:**
- Create: `scripts/hooks/rules/prior-task-suite-ran.mjs`
- Create: `scripts/hooks/lib/task-suite-state.mjs` (the tiny state store this rule reads/writes)
- Test: `scripts/tests/test-prior-task-suite-ran-l44.mjs`

**Interfaces:**
- Consumes: `writeSuiteEvidence`/`evidencePath` pattern already established in
  `scripts/lib/suite-evidence.mjs` (Task 11) — this task reuses the SAME evidence file rather than
  inventing a second one, since both rules answer "did the suite run recently".
- Produces: `evaluate(input)`, `TOOLS = ['Agent']`, `RULE_IDS = ['L44']`.

- [ ] **Step 1: Reuse Task 11's evidence store rather than building a second one**

The ranking doc: L44 "needs a 'prior task's suite ran' state store" — Task 11 already built exactly
this (`scripts/lib/suite-evidence.mjs`, `.superpowers/suite-evidence.jsonl`). This task reads that
same file rather than inventing a parallel one, per the project's own repeated lesson (two state
stores answering the same question drift apart).

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/prior-task-suite-ran.mjs — L44: a dispatch describing itself as building on a
// prior task ("continue from Task N", "next task", "building on the previous change") should not
// fire if NO suite-evidence record exists at all yet this session — the same evidence file Task 11's
// check-suite-evidence.mjs (DoD-12) writes and reads, reused rather than duplicated. WARN-only: a
// missing evidence record does not prove the prior task's suite failed, only that nothing recorded
// it — a nudge to confirm, not a block on an unprovable absence.
export const TOOLS = ['Agent'];
export const RULE_IDS = ['L44'];

import { existsSync, readFileSync } from 'node:fs';
import { evidencePath } from '../../lib/suite-evidence.mjs';

const CONTINUATION_RE = /continue from|next task|building on the previous|following up on task/i;

export function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch' };
  }
  const prompt = (input.tool_input && input.tool_input.prompt) || '';
  if (!CONTINUATION_RE.test(prompt)) {
    return { decision: 'allow', reason: 'L44: this dispatch does not describe itself as continuing a prior task' };
  }
  const path = evidencePath();
  const hasAnyRecord = existsSync(path) && readFileSync(path, 'utf8').trim().length > 0;
  if (hasAnyRecord) {
    return { decision: 'allow', reason: 'L44: a suite-evidence record exists this session — the prior task\'s suite state is tracked' };
  }
  return {
    decision: 'warn',
    reason: 'L44: this dispatch continues a prior task, but no suite-evidence record exists yet — '
      + 'confirm the prior task\'s suite actually ran green before building further on it (the same '
      + 'record check-suite-evidence.mjs/DoD-12 reads).',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-prior-task-suite-ran-l44.mjs
import { evaluate } from '../hooks/rules/prior-task-suite-ran.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// CATCH: a "continue from Task N" dispatch with NO suite-evidence file at all -> warn.
const dir = mkdtempSync(join(tmpdir(), 'l44-catch-'));
process.env.SUITE_EVIDENCE_PATH = join(dir, 'nonexistent-evidence.jsonl');
const result = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Continue from Task 5, add the next field.' } });
delete process.env.SUITE_EVIDENCE_PATH;
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a continuation dispatch with no suite-evidence record, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  continuation dispatch, no suite-evidence record -> warn, L44');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-prior-task-suite-ran-l44.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — an evidence record present, and a non-continuation dispatch, must both allow**

```javascript
// appended to scripts/tests/test-prior-task-suite-ran-l44.mjs
import { writeFileSync } from 'node:fs';

const dir2 = mkdtempSync(join(tmpdir(), 'l44-false-alarm-'));
const evPath = join(dir2, 'evidence.jsonl');
writeFileSync(evPath, JSON.stringify({ ts: new Date().toISOString(), kind: 'playwright', exitCode: 0 }) + '\n', 'utf8');
process.env.SUITE_EVIDENCE_PATH = evPath;
const result2 = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Continue from Task 5, add the next field.' } });
delete process.env.SUITE_EVIDENCE_PATH;
if (result2.decision !== 'allow') {
  console.error(`FAIL  a continuation dispatch WITH an evidence record must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  continuation dispatch with a suite-evidence record present -> allow, no false alarm');
}

const result3 = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Investigate an unrelated fresh question.' } });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a non-continuation dispatch must not warn regardless of evidence state, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  non-continuation dispatch -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-prior-task-suite-ran-l44.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 76 of 91 ... (15 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/prior-task-suite-ran.mjs scripts/tests/test-prior-task-suite-ran-l44.mjs
git commit -m "feat(Arc 3 Phase 4, Task 30): implement and declare L44 — continuation dispatch checks the shared suite-evidence record"
```

### Task 31: Implement and declare `L83` — a dispatch naming a long-running command must also name a timeout/background mechanism

**Files:**
- Create: `scripts/hooks/rules/long-command-needs-timeout.mjs`
- Test: `scripts/tests/test-long-command-needs-timeout-l83.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Agent']`, `RULE_IDS = ['L83']`.

- [ ] **Step 1: Confirm the named-command list is exactly the two the project already knows are long**

The ranking doc: "would need to recognize 'long command' — full pytest/playwright/ingest.py — by
name, and check for an accompanying timeout/background mechanism in the same prompt text." This
task's list: `npx playwright test` (unqualified), `pytest` (unqualified), `python scripts/ingest.py`
— each already documented elsewhere in this repo as long-running (60s+ default tool timeout risk).

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/long-command-needs-timeout.mjs — L83: a dispatch prompt naming a known
// long-running command (full playwright/pytest run, python scripts/ingest.py) without ALSO naming a
// timeout value or "run in background"/"background: true" is a dispatch that will likely hit the
// default tool timeout mid-run. WARN-only: the fix (add a timeout or background flag) is cheap and
// always available, never a substance block.
export const TOOLS = ['Agent'];
export const RULE_IDS = ['L83'];

const LONG_COMMAND_RE = /\bnpx playwright test\b(?!\s+\S)|(?<!\S)pytest\b(?!\s+\S)|python\s+scripts\/ingest\.py/;
const TIMEOUT_MENTIONED_RE = /\btimeout\b|\brun_in_background\b|\bbackground\s*:\s*true\b|\bin the background\b/i;

export function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch' };
  }
  const prompt = (input.tool_input && input.tool_input.prompt) || '';
  if (!LONG_COMMAND_RE.test(prompt)) {
    return { decision: 'allow', reason: 'L83: no known long-running command named in this dispatch prompt' };
  }
  if (TIMEOUT_MENTIONED_RE.test(prompt)) {
    return { decision: 'allow', reason: 'L83: a timeout/background mechanism is already named alongside the long command' };
  }
  return {
    decision: 'warn',
    reason: 'L83: this dispatch names a known long-running command (full playwright/pytest run, or '
      + 'python scripts/ingest.py) with no timeout or background mechanism named alongside it — add '
      + 'timeout:600000 or run_in_background:true to the dispatch.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-long-command-needs-timeout-l83.mjs
import { evaluate } from '../hooks/rules/long-command-needs-timeout.mjs';

// CATCH: a dispatch naming the full pytest run, no timeout/background mentioned -> warn.
const result = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Run pytest and report the result.' } });
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a long command with no timeout/background, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  full pytest run named with no timeout/background -> warn, L83');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-long-command-needs-timeout-l83.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a scoped single-test command, and a long command WITH a timeout, must both allow**

```javascript
// appended to scripts/tests/test-long-command-needs-timeout-l83.mjs
const result2 = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Run pytest tests/test_example.py, timeout 300000ms.' } });
if (result2.decision !== 'allow') {
  console.error(`FAIL  a long command with a timeout named must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  long command with a timeout named -> allow, no false alarm');
}

const result3 = evaluate({ tool_name: 'Agent', tool_input: { prompt: 'Run pytest tests/test_example.py::test_one and report.' } });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a scoped single-test pytest command must not warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  scoped single-test command (not the unqualified full run) -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-long-command-needs-timeout-l83.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 77 of 91 ... (14 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/long-command-needs-timeout.mjs scripts/tests/test-long-command-needs-timeout-l83.mjs
git commit -m "feat(Arc 3 Phase 4, Task 31): implement and declare L83 — a long command needs a named timeout or background mechanism"
```

### Task 32: Phase 4 liveness test and overhead measurement

**Files:**
- Test: `scripts/tests/test-phase4-liveness.mjs` (new)

**Interfaces:**
- Consumes: `scripts/hooks/pretooluse.mjs` with `tool_name: 'Agent'`.
- Produces: the measured overhead evidence pasted into this task.

- [ ] **Step 1: Write the liveness test**

```javascript
// scripts/tests/test-phase4-liveness.mjs — §3.4.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const input = JSON.stringify({ tool_name: 'Agent', tool_input: { prompt: 'Do the thing, sonnet, effort: high.' } });
const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs')], { cwd: ROOT, encoding: 'utf8', input });
if (r.error) {
  console.error(`FAIL  pretooluse.mjs did not start with no env override: ${r.error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  pretooluse.mjs (no env override) ran all 6 Phase 4 pretooluse:Agent rules, exit ${r.status}`);
}
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase4-liveness.mjs`
Expected: one PASS line, exit code 0.

- [ ] **Step 3: Measure overhead against the 61ms baseline for an `Agent` tool call**

Run the same inline `node -e` measurement pattern from Task 7 Step 3, with `tool_name: 'Agent'` in
the input. Paste the figure against the 61ms baseline and prior phases' figures.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 77 of 91 mechanically-enforceable rules covered (14 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase4-liveness.mjs
git commit -m "test(Arc 3 Phase 4, Task 32): liveness test + overhead measurement, Phase 4 closes at 77/91"
```

---

## Phase 5 — `pretooluse:Edit|Write` remainder, 3 rules

`L76`, `L87`, `L89`.

### Task 33: Implement and declare `L76` — a spec-file edit must be a spec named in the approved register

**Files:**
- Create: `scripts/hooks/rules/spec-file-must-be-registered.mjs`
- Test: `scripts/tests/test-spec-file-must-be-registered-l76.mjs`

**Interfaces:**
- Consumes: `docs/ROADMAP-2026-07-30.md`'s "מרשם האישורים — מפרטים שאושרו על-ידי הבעלים" section,
  read as plain text (same pattern `check-h8-ledger.mjs` already uses to read the roadmap).
- Produces: `evaluate(input)`, `TOOLS = ['Edit', 'Write']`, `RULE_IDS = ['L76']`.

- [ ] **Step 1: Confirm the register section name and its line shape before writing the matcher**

Read the "מרשם האישורים" section of `docs/ROADMAP-2026-07-30.md` directly to confirm how an approved
spec's filename appears there (a markdown link or a bare filename token) before writing the regex — do
not guess the shape.

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/spec-file-must-be-registered.mjs — L76: a NEW file under
// docs/superpowers/specs/** being written must have its filename already named in the approved-spec
// register (docs/ROADMAP-2026-07-30.md, "מרשם האישורים"), or the edit must be to an EXISTING
// registered spec (never blocks touching an already-approved file). WARN, not block: the register
// entry and the spec file are usually written close together by the same person, and the ground
// truth here (was this actually brainstormed/approved) cannot be verified from file content alone —
// this is a nudge to confirm the register entry exists, not a substance gate.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['L76'];

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REGISTER_PATH = process.env.SPEC_REGISTER_PATH || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const SPEC_PATH_RE = /(^|[\\/])docs[\\/]superpowers[\\/]specs[\\/]/i;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit or Write call' };
  }
  const path = input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (typeof path !== 'string' || !SPEC_PATH_RE.test(path)) {
    return { decision: 'allow', reason: 'L76: not under docs/superpowers/specs/** — not this rule\'s business' };
  }
  if (input.tool_name === 'Edit') {
    // Editing an EXISTING file is never this rule's business — only a brand-new spec file matters.
    return { decision: 'allow', reason: 'L76: an Edit targets an existing file, not a new spec' };
  }
  if (!existsSync(REGISTER_PATH)) {
    return { decision: 'allow', reason: 'L76: register file not found — not asserting a violation without evidence' };
  }
  const register = readFileSync(REGISTER_PATH, 'utf8');
  const name = basename(path);
  if (register.includes(name)) {
    return { decision: 'allow', reason: 'L76: this spec filename is already named in the approved-spec register' };
  }
  return {
    decision: 'warn',
    reason: `L76: writing a new spec file (${name}) under docs/superpowers/specs/** that is not yet `
      + `named in the register's מרשם האישורים section — add its entry there once the owner approves it.`,
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-spec-file-must-be-registered-l76.mjs
import { evaluate } from '../hooks/rules/spec-file-must-be-registered.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'l76-catch-'));
const registerPath = join(dir, 'ROADMAP.md');
writeFileSync(registerPath, '## מרשם האישורים\n\n- 2026-08-01-some-other-spec.md — אושר\n', 'utf8');
process.env.SPEC_REGISTER_PATH = registerPath;

// CATCH: a brand-new spec file whose name is not in the register -> warn.
const result = evaluate({
  tool_name: 'Write',
  tool_input: { file_path: 'docs/superpowers/specs/2026-08-12-unregistered-spec.md', content: '# spec' },
});
delete process.env.SPEC_REGISTER_PATH;
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a new unregistered spec file, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  new spec file not named in the register -> warn, L76');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-spec-file-must-be-registered-l76.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a registered filename, and an Edit to an existing spec, must both allow**

```javascript
// appended to scripts/tests/test-spec-file-must-be-registered-l76.mjs
const dir2 = mkdtempSync(join(tmpdir(), 'l76-false-alarm-'));
const registerPath2 = join(dir2, 'ROADMAP.md');
writeFileSync(registerPath2, '## מרשם האישורים\n\n- 2026-08-12-registered-spec.md — אושר 2026-08-12\n', 'utf8');
process.env.SPEC_REGISTER_PATH = registerPath2;
const result2 = evaluate({
  tool_name: 'Write',
  tool_input: { file_path: 'docs/superpowers/specs/2026-08-12-registered-spec.md', content: '# spec' },
});
delete process.env.SPEC_REGISTER_PATH;
if (result2.decision !== 'allow') {
  console.error(`FAIL  a registered spec filename must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  spec filename already in the register -> allow, no false alarm');
}

const result3 = evaluate({
  tool_name: 'Edit',
  tool_input: { file_path: 'docs/superpowers/specs/2026-08-01-some-other-spec.md', old_string: 'a', new_string: 'b' },
});
if (result3.decision !== 'allow') {
  console.error(`FAIL  an Edit to an existing spec file must never warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  Edit to an existing spec file -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-spec-file-must-be-registered-l76.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 78 of 91 ... (13 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/spec-file-must-be-registered.mjs scripts/tests/test-spec-file-must-be-registered-l76.mjs
git commit -m "feat(Arc 3 Phase 5, Task 33): implement and declare L76 — new spec file must be named in the approved-spec register"
```

### Task 34: Implement and declare `L87` — a test file must not spawn `check-meta`/`check-pytest` without a re-entry guard

**Files:**
- Create: `scripts/hooks/rules/no-unguarded-check-meta-spawn.mjs`
- Test: `scripts/tests/test-no-unguarded-check-meta-spawn-l87.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Edit', 'Write']`, `RULE_IDS = ['L87']`.

- [ ] **Step 1: Confirm the guard shape by reading L87's own recent commit (written <36h before the ranking measurement)**

Search `docs/process/development-discipline.md` §11 for L87's own text before writing the matcher —
confirm the exact guard token this project already uses (e.g. an env var like `CHECK_META_NO_RECURSE`
or a PID-based lock) rather than inventing a new one this task's detector would then falsely demand.

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/no-unguarded-check-meta-spawn.mjs — L87: a test file that spawns
// check-meta.mjs or check-pytest.mjs without a re-entry guard can recurse into itself when those
// scripts themselves invoke the test suite (check-pytest.mjs runs pytest, which can include THIS
// test file). WARN: any test file whose source calls spawnSync/execSync naming 'check-meta.mjs' or
// 'check-pytest.mjs' must also reference a guard token (an env var check or a recursion-depth
// counter) in the same file.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['L87'];

const TEST_FILE_RE = /(^|[\\/])(tests|scripts[\\/]tests)[\\/].*\.(mjs|py)$/i;
const SPAWNS_META_RE = /check-meta\.mjs|check-pytest\.mjs/;
const GUARD_TOKEN_RE = /re.?entry|recursion.?guard|_NO_RECURSE|already.?running|guard/i;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit or Write call' };
  }
  const path = input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (typeof path !== 'string' || !TEST_FILE_RE.test(path)) {
    return { decision: 'allow', reason: 'L87: not a test file — not this rule\'s business' };
  }
  const newText = input.tool_name === 'Write' ? (input.tool_input.content ?? '') : (input.tool_input.new_string ?? '');
  if (!SPAWNS_META_RE.test(newText)) {
    return { decision: 'allow', reason: 'L87: this edit does not spawn check-meta.mjs/check-pytest.mjs' };
  }
  if (GUARD_TOKEN_RE.test(newText)) {
    return { decision: 'allow', reason: 'L87: a re-entry guard token is present alongside the spawn' };
  }
  return {
    decision: 'warn',
    reason: 'L87: this test file spawns check-meta.mjs or check-pytest.mjs with no visible re-entry '
      + 'guard — those scripts can themselves invoke the test suite, risking self-recursion. Add a '
      + 'guard (env var check or recursion-depth counter) around the spawn.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-no-unguarded-check-meta-spawn-l87.mjs
import { evaluate } from '../hooks/rules/no-unguarded-check-meta-spawn.mjs';

// CATCH: a test file writing an unguarded spawn of check-meta.mjs -> warn.
const result = evaluate({
  tool_name: 'Write',
  tool_input: {
    file_path: 'scripts/tests/test-example.mjs',
    content: "import { spawnSync } from 'node:child_process';\nspawnSync('node', ['scripts/check-meta.mjs']);\n",
  },
});
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on an unguarded check-meta.mjs spawn in a test file, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  unguarded check-meta.mjs spawn in a test file -> warn, L87');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-no-unguarded-check-meta-spawn-l87.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a guarded spawn, and a non-test file, must both allow**

```javascript
// appended to scripts/tests/test-no-unguarded-check-meta-spawn-l87.mjs
const result2 = evaluate({
  tool_name: 'Write',
  tool_input: {
    file_path: 'scripts/tests/test-example.mjs',
    content: "// recursion guard: skip if already inside a check-meta run\n"
      + "if (!process.env.CHECK_META_NO_RECURSE) { spawnSync('node', ['scripts/check-meta.mjs']); }\n",
  },
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  a guarded spawn must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  guarded check-meta.mjs spawn -> allow, no false alarm');
}

const result3 = evaluate({
  tool_name: 'Write',
  tool_input: { file_path: 'src/app.js', content: "console.log('unrelated');\n" },
});
if (result3.decision !== 'allow') {
  console.error(`FAIL  a non-test file must never trigger this rule, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  non-test file -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-no-unguarded-check-meta-spawn-l87.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 79 of 91 ... (12 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/no-unguarded-check-meta-spawn.mjs scripts/tests/test-no-unguarded-check-meta-spawn-l87.mjs
git commit -m "feat(Arc 3 Phase 5, Task 34): implement and declare L87 — test files spawning check-meta/check-pytest need a re-entry guard"
```

### Task 35: Implement and declare `L89` — `pytest_collection_modifyitems` must use `tryfirst`

**Files:**
- Create: `scripts/hooks/rules/pytest-hook-needs-tryfirst.mjs`
- Test: `scripts/tests/test-pytest-hook-needs-tryfirst-l89.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Edit', 'Write']`, `RULE_IDS = ['L89']`.

- [ ] **Step 1: Read L89's own recent §11 entry to confirm the exact defect shape before writing the matcher**

Search `docs/process/development-discipline.md` §11 for L89's text — confirm it is specifically about
`@pytest.hookimpl` ordering (a `pytest_collection_modifyitems` defined without `tryfirst=True` running
after another plugin's hook has already mutated the collected items) before writing the check.

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/pytest-hook-needs-tryfirst.mjs — L89: a new `def
// pytest_collection_modifyitems(...)` in a conftest.py/plugin file, with no `@pytest.hookimpl`
// decorator naming `tryfirst=True` immediately above it, risks running AFTER another plugin already
// mutated the collected items — the exact ordering defect L89 names. WARN: the fix (add the
// decorator) is a one-line, always-available change, never a substance block.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['L89'];

const PY_FILE_RE = /\.py$/i;
const HOOK_DEF_RE = /def\s+pytest_collection_modifyitems\s*\(/;
const TRYFIRST_ABOVE_RE = /@pytest\.hookimpl\([^)]*tryfirst\s*=\s*True[^)]*\)\s*\n\s*def\s+pytest_collection_modifyitems\s*\(/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit or Write call' };
  }
  const path = input.tool_input && (input.tool_input.file_path || input.tool_input.path);
  if (typeof path !== 'string' || !PY_FILE_RE.test(path)) {
    return { decision: 'allow', reason: 'L89: not a .py file — not this rule\'s business' };
  }
  const newText = input.tool_name === 'Write' ? (input.tool_input.content ?? '') : (input.tool_input.new_string ?? '');
  if (!HOOK_DEF_RE.test(newText)) {
    return { decision: 'allow', reason: 'L89: no pytest_collection_modifyitems definition in this edit' };
  }
  if (TRYFIRST_ABOVE_RE.test(newText)) {
    return { decision: 'allow', reason: 'L89: pytest_collection_modifyitems already carries @pytest.hookimpl(tryfirst=True)' };
  }
  return {
    decision: 'warn',
    reason: 'L89: a new pytest_collection_modifyitems has no @pytest.hookimpl(tryfirst=True) '
      + 'decorator above it — without it, this hook may run after another plugin has already '
      + 'mutated the collected items. Add the decorator.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-pytest-hook-needs-tryfirst-l89.mjs
import { evaluate } from '../hooks/rules/pytest-hook-needs-tryfirst.mjs';

// CATCH: a new pytest_collection_modifyitems with no tryfirst decorator -> warn.
const result = evaluate({
  tool_name: 'Write',
  tool_input: {
    file_path: 'conftest.py',
    content: 'def pytest_collection_modifyitems(config, items):\n    pass\n',
  },
});
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a hook with no tryfirst decorator, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  pytest_collection_modifyitems with no tryfirst decorator -> warn, L89');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-pytest-hook-needs-tryfirst-l89.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a decorated hook, and an unrelated .py edit, must both allow**

```javascript
// appended to scripts/tests/test-pytest-hook-needs-tryfirst-l89.mjs
const result2 = evaluate({
  tool_name: 'Write',
  tool_input: {
    file_path: 'conftest.py',
    content: '@pytest.hookimpl(tryfirst=True)\ndef pytest_collection_modifyitems(config, items):\n    pass\n',
  },
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  a properly-decorated hook must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  properly-decorated pytest_collection_modifyitems -> allow, no false alarm');
}

const result3 = evaluate({
  tool_name: 'Write',
  tool_input: { file_path: 'src/helper.py', content: 'def unrelated():\n    pass\n' },
});
if (result3.decision !== 'allow') {
  console.error(`FAIL  a .py file with no such hook must not warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  unrelated .py edit -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-pytest-hook-needs-tryfirst-l89.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 80 of 91 ... (11 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/pytest-hook-needs-tryfirst.mjs scripts/tests/test-pytest-hook-needs-tryfirst-l89.mjs
git commit -m "feat(Arc 3 Phase 5, Task 35): implement and declare L89 — pytest_collection_modifyitems needs tryfirst=True"
```

### Task 36: Phase 5 liveness test and overhead measurement

**Files:**
- Test: `scripts/tests/test-phase5-liveness.mjs` (new)

- [ ] **Step 1: Write the liveness test**

```javascript
// scripts/tests/test-phase5-liveness.mjs — §3.4.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const input = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'docs/superpowers/specs/2026-01-01-x.md', content: '# x' } });
const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs')], { cwd: ROOT, encoding: 'utf8', input });
if (r.error) {
  console.error(`FAIL  pretooluse.mjs did not start with no env override: ${r.error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  pretooluse.mjs (no env override) ran all 3 Phase 5 pretooluse:Edit|Write rules, exit ${r.status}`);
}
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase5-liveness.mjs`
Expected: one PASS line, exit code 0.

- [ ] **Step 3: Measure overhead against the 61ms baseline**

Same inline `node -e` measurement pattern, `tool_name: 'Write'`. Paste the figure.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 80 of 91 mechanically-enforceable rules covered (11 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase5-liveness.mjs
git commit -m "test(Arc 3 Phase 5, Task 36): liveness test + overhead measurement, Phase 5 closes at 80/91"
```

---

## Phase 6 — `posttooluse`, 4 rules

`10.18`, `12.5`, `DoD-7`, `L27`.

### Task 37: Implement and declare `L27` — reuse rule `2`'s `checkPlanText()` explicitly, confirmed rather than assumed

**Files:**
- Modify: `scripts/hooks/rules/one-pipeline.mjs` (add `'L27'` to its existing `RULE_IDS` array —
  read the file first to find the exact line)
- Test: `scripts/tests/test-one-pipeline-l27.mjs`

**Interfaces:**
- Consumes: `checkPlanText()`, already imported by `one-pipeline.mjs` from
  `scripts/check-plan-complete.mjs` per that file's own header claim (Task 1 below verifies this
  before trusting it).
- Produces: nothing new.

- [ ] **Step 1: Verify the header claim independently before declaring anything**

The ranking doc could not fully determine whether `one-pipeline.mjs` (which declares rule `2`)
actually calls `checkPlanText()` at plan-write time closely enough to satisfy L27's specific incident
(the CP2 zero-fenced-block failure) — read `one-pipeline.mjs` in full and confirm: (a) it imports
`checkPlanText` from `check-plan-complete.mjs`, (b) it calls that function on the `new_string`/
`content` of a `Write`/`Edit` targeting `docs/superpowers/plans/**`, and (c) the specific CP2 failure
shape (a plan with zero fenced code blocks in any task) would be caught by that call. If any of the
three is false, this task instead builds the missing piece as a new small addition to
`one-pipeline.mjs` rather than declaring a false match — do not proceed to Step 2 until this is
confirmed true.

- [ ] **Step 2: Write the catch test against the real, already-wired path**

```javascript
// scripts/tests/test-one-pipeline-l27.mjs
import { evaluate } from '../hooks/rules/one-pipeline.mjs';

// CATCH: a plan file write with zero fenced code blocks in any task — the CP2 incident shape.
const planWithNoCode = `# Some Plan

### Task 1: Do a thing

- [ ] **Step 1: Do it**

Just do the thing described here, no code block anywhere in this task.
`;
const result = evaluate({
  tool_name: 'Write',
  tool_input: { file_path: 'docs/superpowers/plans/2026-08-12-example.md', content: planWithNoCode },
});
if (result.decision === 'allow') {
  console.error(`FAIL  expected a non-allow decision on a plan with zero fenced code blocks (L27/CP2 shape), got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  plan with zero fenced code blocks -> ${result.decision}, caught by rule 2's reused checkPlanText()`);
}
```

- [ ] **Step 3: Run it, confirm PASS**

Run: `node scripts/tests/test-one-pipeline-l27.mjs`
Expected: one PASS line, exit 0. If this FAILS, Step 1's verification was wrong — stop and build the
missing detector piece before continuing; do not declare L27 on a file that does not actually catch
this.

- [ ] **Step 4: Write the false-alarm test — a real, well-formed plan task must allow**

```javascript
// appended to scripts/tests/test-one-pipeline-l27.mjs
const planWithCode = `# Some Plan

### Task 1: Do a thing

- [ ] **Step 1: Write the code**

\`\`\`javascript
export function example() { return 1; }
\`\`\`
`;
const result2 = evaluate({
  tool_name: 'Write',
  tool_input: { file_path: 'docs/superpowers/plans/2026-08-12-example.md', content: planWithCode },
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  a well-formed plan with real fenced code must not be flagged, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  well-formed plan with real fenced code -> allow, no false alarm');
}
```

- [ ] **Step 5: Run it, paste output**

Run: `node scripts/tests/test-one-pipeline-l27.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 6: Add `L27` to the existing declaration**

```javascript
// scripts/hooks/rules/one-pipeline.mjs — find the existing line and extend the array
export const RULE_IDS = ['2', 'L27'];
```

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 81 of 91 ... (10 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/one-pipeline.mjs scripts/tests/test-one-pipeline-l27.mjs
git commit -m "feat(Arc 3 Phase 6, Task 37): declare L27 on one-pipeline.mjs, verified against the CP2 incident shape"
```

### Task 38: Implement and declare `10.18` — flag a measurement-shaped posttooluse Bash result with no evidence-record write

**Files:**
- Create: `scripts/hooks/observers/measurement-run-flagged.mjs`
- Test: `scripts/tests/test-measurement-run-flagged-10-18.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Bash']`, `RULE_IDS = ['10.18']` — an **observer**, per the
  project's own convention (`scripts/hooks/observers/`) for a `posttooluse` rule that only ever
  informs/logs, never blocks or warns a live decision back to the tool call in progress.

- [ ] **Step 1: Scope to the literal command shape, honestly, per the ranking doc's own limit**

The ranking doc: "would need to distinguish 'measurement' from 'exploration/debugging' posttooluse,
which is not visible from the tool call alone." This task's honest, narrow version: a `Bash` command
whose text matches a known measurement shape (`node -e` containing `Date.now()` timing, or a command
piped through `time`) is logged to `.superpowers/hooks-log.jsonl` with `kind:
'measurement_run_observed'` — a record, not a judgement about whether the measurement was properly
acted on. This is an observer (never blocks), matching `RULE_IDS = []`-declaring observers'
convention except this one DOES declare a real rule id, since it performs 10.18's literal ask
("measurement runs" get recorded).

- [ ] **Step 2: Write the observer**

```javascript
// scripts/hooks/observers/measurement-run-flagged.mjs — 10.18 (narrow, honest half): a Bash command
// that LOOKS like a timing/measurement run (node -e with Date.now(), or a `time <cmd>` invocation)
// is recorded to the same hooks-log.jsonl every other observer already appends to. Cannot
// distinguish "measurement" from "exploration" with certainty from the command text alone (per the
// ranking doc's own stated limit) — this only catches the LITERAL measurement shape, and never
// blocks or warns; it is a record, exactly like geniza-fallback-declaration.mjs's own automatic
// record for §10.13.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['10.18'];

import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DEFAULT_LOG_PATH = join(ROOT, '.superpowers', 'hooks-log.jsonl');

const MEASUREMENT_RE = /Date\.now\(\)|\bperformance\.now\(\)|^\s*time\s+\S/m;

function logPath() {
  return process.env.PRETOOLUSE_LOG_PATH || DEFAULT_LOG_PATH;
}

export function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash call' };
  }
  const command = (input.tool_input && input.tool_input.command) || '';
  if (!MEASUREMENT_RE.test(command)) {
    return { decision: 'allow', reason: '10.18: not a measurement-shaped command' };
  }
  try {
    const path = logPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), kind: 'measurement_run_observed', command: command.slice(0, 200) })}\n`, 'utf8');
  } catch { /* never let logging failure affect the tool call */ }
  return { decision: 'allow', reason: '10.18: measurement-shaped command recorded automatically' };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-measurement-run-flagged-10-18.mjs
import { evaluate } from '../hooks/observers/measurement-run-flagged.mjs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), '10-18-catch-'));
const logPath = join(dir, 'hooks-log.jsonl');
process.env.PRETOOLUSE_LOG_PATH = logPath;

// CATCH: a Bash command containing Date.now() timing -> recorded.
const result = evaluate({ tool_name: 'Bash', tool_input: { command: "node -e \"const t0=Date.now(); console.log(Date.now()-t0)\"" } });
delete process.env.PRETOOLUSE_LOG_PATH;
const logged = JSON.parse(readFileSync(logPath, 'utf8').trim().split('\n').pop());
if (result.decision !== 'allow' || logged.kind !== 'measurement_run_observed') {
  console.error(`FAIL  expected the measurement command to be recorded, got decision=${result.decision}, logged=${JSON.stringify(logged)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  Date.now()-timing Bash command -> recorded as measurement_run_observed, 10.18');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-measurement-run-flagged-10-18.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — an ordinary Bash command must not be recorded, and must never affect the decision**

```javascript
// appended to scripts/tests/test-measurement-run-flagged-10-18.mjs
import { existsSync } from 'node:fs';

const dir2 = mkdtempSync(join(tmpdir(), '10-18-false-alarm-'));
const logPath2 = join(dir2, 'hooks-log.jsonl');
process.env.PRETOOLUSE_LOG_PATH = logPath2;
const result2 = evaluate({ tool_name: 'Bash', tool_input: { command: 'git status' } });
delete process.env.PRETOOLUSE_LOG_PATH;
if (result2.decision !== 'allow') {
  console.error(`FAIL  an ordinary command must always allow, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else if (existsSync(logPath2)) {
  console.error('FAIL  an ordinary command must not create a log entry at all');
  process.exitCode = 1;
} else {
  console.log('PASS  ordinary Bash command -> allow, no record written, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-measurement-run-flagged-10-18.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 82 of 91 ... (9 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/observers/measurement-run-flagged.mjs scripts/tests/test-measurement-run-flagged-10-18.mjs
git commit -m "feat(Arc 3 Phase 6, Task 38): implement and declare 10.18 — record measurement-shaped Bash commands"
```

### Task 39: Implement and declare `12.5` and `DoD-7` — a red-then-green regression cycle is recorded per fix

**Files:**
- Create: `scripts/hooks/observers/regression-cycle-recorded.mjs`
- Test: `scripts/tests/test-regression-cycle-recorded-12-5-dod7.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Bash']`, `RULE_IDS = ['12.5', 'DoD-7']`.

- [ ] **Step 1: Confirm both rules share the same evidence shape before combining them into one observer**

Read `docs/process/development-discipline.md` for `12.5` and `DoD-7`'s exact text. Project CLAUDE.md
§3 DoD line 7: "Regression red-green. For a bugfix: fix reverted -> test observed FAILING -> fix
restored -> test observed PASSING. Both outputs pasted." If `12.5` names the same red-green cycle from
a different angle (a thinking-model application rather than a distinct evidence shape), this task
combines them in one observer; if they diverge, split into two files instead of forcing a false
merge — confirm this before writing Step 2.

- [ ] **Step 2: Write the observer**

```javascript
// scripts/hooks/observers/regression-cycle-recorded.mjs — DoD-7 / 12.5: a Bash command running a
// test file twice in close succession (once expected-fail, once expected-pass) within the same
// session is the regression red-green cycle §3 DoD line 7 requires evidence of. This observer
// RECORDS when a single Bash call's own output contains BOTH a fail marker and, later in the same
// combined stdout+stderr, a pass marker for what looks like the same test path — the closest signal
// a single posttooluse call can see without cross-call session state. Never blocks; a record only.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['12.5', 'DoD-7'];

import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DEFAULT_LOG_PATH = join(ROOT, '.superpowers', 'hooks-log.jsonl');

function logPath() {
  return process.env.PRETOOLUSE_LOG_PATH || DEFAULT_LOG_PATH;
}

export function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash call' };
  }
  const output = `${(input.tool_response && input.tool_response.stdout) || ''}\n${(input.tool_response && input.tool_response.stderr) || ''}`;
  const hasFail = /FAIL|failed|AssertionError|assert.*false/i.test(output);
  const hasPass = /PASS|passed|OK -/i.test(output);
  if (!(hasFail && hasPass)) {
    return { decision: 'allow', reason: '12.5/DoD-7: this command output does not show both a fail and a pass marker' };
  }
  try {
    const path = logPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), kind: 'regression_cycle_observed', command: (input.tool_input && input.tool_input.command || '').slice(0, 200) })}\n`, 'utf8');
  } catch { /* never let logging failure affect the tool call */ }
  return { decision: 'allow', reason: '12.5/DoD-7: red-then-green shape recorded' };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-regression-cycle-recorded-12-5-dod7.mjs
import { evaluate } from '../hooks/observers/regression-cycle-recorded.mjs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), '12-5-catch-'));
const logPath = join(dir, 'hooks-log.jsonl');
process.env.PRETOOLUSE_LOG_PATH = logPath;

// CATCH: a Bash output containing both a FAIL and a PASS marker -> recorded.
const result = evaluate({
  tool_name: 'Bash',
  tool_input: { command: 'node test.mjs' },
  tool_response: { stdout: 'FAIL first run\nPASS second run', stderr: '' },
});
delete process.env.PRETOOLUSE_LOG_PATH;
const logged = JSON.parse(readFileSync(logPath, 'utf8').trim().split('\n').pop());
if (result.decision !== 'allow' || logged.kind !== 'regression_cycle_observed') {
  console.error(`FAIL  expected the red-then-green shape to be recorded, got: ${JSON.stringify(logged)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  output containing both FAIL and PASS markers -> recorded, 12.5/DoD-7');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-regression-cycle-recorded-12-5-dod7.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — an all-PASS or all-FAIL output must not be recorded**

```javascript
// appended to scripts/tests/test-regression-cycle-recorded-12-5-dod7.mjs
import { existsSync } from 'node:fs';

const dir2 = mkdtempSync(join(tmpdir(), '12-5-false-alarm-'));
const logPath2 = join(dir2, 'hooks-log.jsonl');
process.env.PRETOOLUSE_LOG_PATH = logPath2;
const result2 = evaluate({
  tool_name: 'Bash',
  tool_input: { command: 'node test.mjs' },
  tool_response: { stdout: 'PASS  everything green', stderr: '' },
});
delete process.env.PRETOOLUSE_LOG_PATH;
if (result2.decision !== 'allow') {
  console.error(`FAIL  an all-pass output must always allow, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else if (existsSync(logPath2)) {
  console.error('FAIL  an all-pass output must not create a log entry (no red-green shape present)');
  process.exitCode = 1;
} else {
  console.log('PASS  all-pass output -> allow, no record written, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-regression-cycle-recorded-12-5-dod7.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 84 of 91 ... (7 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/observers/regression-cycle-recorded.mjs scripts/tests/test-regression-cycle-recorded-12-5-dod7.mjs
git commit -m "feat(Arc 3 Phase 6, Task 39): implement and declare 12.5 and DoD-7 — record a red-then-green regression cycle"
```

### Task 40: Phase 6 liveness test and overhead measurement — Phase 6 closes

**Files:**
- Test: `scripts/tests/test-phase6-liveness.mjs` (new)

- [ ] **Step 1: Write the liveness test**

```javascript
// scripts/tests/test-phase6-liveness.mjs — §3.4.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const input = JSON.stringify({
  tool_name: 'Bash', tool_input: { command: 'git status' },
  tool_response: { stdout: 'nothing to commit', stderr: '' },
});
const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'posttooluse.mjs')], { cwd: ROOT, encoding: 'utf8', input });
if (r.error) {
  console.error(`FAIL  posttooluse.mjs did not start with no env override: ${r.error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS  posttooluse.mjs (no env override) ran the Phase 6 observers against a real Bash result, exit ${r.status}`);
}
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase6-liveness.mjs`
Expected: one PASS line, exit code 0.

- [ ] **Step 3: Measure overhead**

Same inline `node -e` measurement pattern, timing `scripts/hooks/posttooluse.mjs`. Paste the figure
against the 61ms baseline.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 84 of 91 mechanically-enforceable rules covered (7 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase6-liveness.mjs
git commit -m "test(Arc 3 Phase 6, Task 40): liveness test + overhead measurement, Phase 6 closes at 84/91"
```

---

## Phase 7 — the remaining small mechanism points, 7 rules

`10` and `10.7` (`sessionstart`), `L36a` and `L85` (`pretooluse:Bash`), `L81a` (`ci-gate`), `L41`
(`subagentstop`), `L88` (`stop`). Each mechanism point here carries 1–2 rules, well under the 6–11
sizing guidance, grouped into one final phase rather than five near-empty ones.

### Task 41: Implement and declare `10` and `10.7` — session-start doc/rules were actually printed

**Files:**
- Create: `scripts/hooks/observers/session-doc-print-recorded.mjs`
- Test: `scripts/tests/test-session-doc-print-recorded-10-10-7.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)` (a `SessionStart`-shaped hook, following
  `scripts/hooks/session-rules.mjs`'s own existing invocation contract — read that file's entry
  signature first and match it exactly, since `SessionStart` hooks are not `PreToolUse` hooks and do
  not share the `{tool_name, tool_input}` shape), `RULE_IDS = ['10', '10.7']`.

- [ ] **Step 1: State the limit named by the ranking doc, and build only the provable half**

The ranking doc: "10 and 10.7 (sessionstart): none — session-rules.mjs/session-brief.mjs print the
doc/rules but do not gate on it having been read... a detector can prove DISPLAY, never
INTERNALIZATION." This task builds exactly the provable half: confirm `session-rules.mjs` actually
printed §10 and the DoD gate (not "was it read" — unprovable, stated as such) and record that fact.

- [ ] **Step 2: Read `scripts/hooks/session-rules.mjs`'s entry signature before writing anything**

Confirm the exact function name and input shape `session-rules.mjs` uses (its `SessionStart` hook
contract may differ from `evaluate(input)` — Claude Code's own hook types differ by event, per
`docs/vendor/claude-code/`). Match that same shape in Step 3 rather than assuming `PreToolUse`'s.

- [ ] **Step 3: Write the observer, matching the confirmed real `SessionStart` entry shape**

```javascript
// scripts/hooks/observers/session-doc-print-recorded.mjs — 10 / 10.7: records that
// session-rules.mjs actually printed the mandatory-read doc reference and the DoD gate text at
// session start. Cannot prove the doc was READ (per the ranking doc's own stated limit) — only that
// it was DISPLAYED, which is the honest half a mechanical check can reach. Never blocks; a record.
export const RULE_IDS = ['10', '10.7'];

import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const DEFAULT_LOG_PATH = join(ROOT, '.superpowers', 'hooks-log.jsonl');

function logPath() {
  return process.env.PRETOOLUSE_LOG_PATH || DEFAULT_LOG_PATH;
}

// printedText: the combined stdout session-rules.mjs actually produced this run — passed in by the
// SessionStart entry point that already captures it (see scripts/hooks/session-rules.mjs's own
// invocation site once Step 2 above confirms the shape).
export function evaluate(printedText) {
  const text = printedText || '';
  const mentionsDoc = /development-discipline\.md/.test(text);
  const mentionsDoD = /§3|DoD/.test(text);
  if (!mentionsDoc && !mentionsDoD) {
    return { decision: 'allow', reason: '10/10.7: nothing was printed matching the mandatory-read doc or DoD gate this run' };
  }
  try {
    const path = logPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), kind: 'session_doc_printed', mentionsDoc, mentionsDoD })}\n`, 'utf8');
  } catch { /* never let logging failure affect session start */ }
  return { decision: 'allow', reason: '10/10.7: mandatory-read doc / DoD gate print recorded (display proven, not internalization)' };
}
```

- [ ] **Step 4: Write the catch test**

```javascript
// scripts/tests/test-session-doc-print-recorded-10-10-7.mjs
import { evaluate } from '../hooks/observers/session-doc-print-recorded.mjs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), '10-10-7-catch-'));
const logPath = join(dir, 'hooks-log.jsonl');
process.env.PRETOOLUSE_LOG_PATH = logPath;

// CATCH (in the sense of: the positive case fires and records): session output naming both the
// mandatory doc and the DoD gate -> recorded.
const result = evaluate('READ docs/process/development-discipline.md AT THE START. Start with §3 (the DoD gate).');
delete process.env.PRETOOLUSE_LOG_PATH;
const logged = JSON.parse(readFileSync(logPath, 'utf8').trim().split('\n').pop());
if (result.decision !== 'allow' || logged.kind !== 'session_doc_printed' || !logged.mentionsDoc || !logged.mentionsDoD) {
  console.error(`FAIL  expected both mentions recorded, got: ${JSON.stringify(logged)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  session output naming the mandatory doc and DoD gate -> recorded, 10/10.7');
}
```

- [ ] **Step 5: Run it, confirm PASS**

Run: `node scripts/tests/test-session-doc-print-recorded-10-10-7.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 6: Write the false-alarm test — unrelated session output must not be recorded**

```javascript
// appended to scripts/tests/test-session-doc-print-recorded-10-10-7.mjs
import { existsSync } from 'node:fs';

const dir2 = mkdtempSync(join(tmpdir(), '10-10-7-false-alarm-'));
const logPath2 = join(dir2, 'hooks-log.jsonl');
process.env.PRETOOLUSE_LOG_PATH = logPath2;
const result2 = evaluate('Welcome back. No relevant output here.');
delete process.env.PRETOOLUSE_LOG_PATH;
if (result2.decision !== 'allow') {
  console.error(`FAIL  unrelated output must always allow, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else if (existsSync(logPath2)) {
  console.error('FAIL  unrelated output must not create a log entry');
  process.exitCode = 1;
} else {
  console.log('PASS  unrelated session output -> allow, no record written, no false alarm');
}
```

- [ ] **Step 7: Run it, paste output**

Run: `node scripts/tests/test-session-doc-print-recorded-10-10-7.mjs`
Expected: two PASS lines, exit code 0.

- [ ] **Step 8: Wire the observer into `session-rules.mjs`'s real invocation (per Step 2's confirmed shape), run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 86 of 91 ... (5 open)`.

- [ ] **Step 9: Commit**

```bash
git add scripts/hooks/observers/session-doc-print-recorded.mjs scripts/tests/test-session-doc-print-recorded-10-10-7.mjs scripts/hooks/session-rules.mjs
git commit -m "feat(Arc 3 Phase 7, Task 41): implement and declare 10 and 10.7 — record that the mandatory doc/DoD gate were printed at session start"
```

**Unusual case:** this rule's liveness test (Task 47 below) exercises it via the real
`SessionStart` entry point directly, since Phase 1–6's liveness pattern (spawn `pretooluse.mjs`/
`posttooluse.mjs` with a fixture tool call) does not apply to a `SessionStart`-shaped hook.

### Task 42: Implement and declare `L36a` — a Bash command must not repeat a previously-observed failing pattern without acknowledgement

**Files:**
- Create: `scripts/hooks/rules/prior-error-memory.mjs`
- Test: `scripts/tests/test-prior-error-memory-l36a.mjs`

**Interfaces:**
- Consumes: `input.transcript_path`, same field every other rule in this plan already reads.
- Produces: `evaluate(input)`, `TOOLS = ['Bash']`, `RULE_IDS = ['L36a']`.

- [ ] **Step 1: Read L36a's own text to confirm the exact error shape it targets**

Search `docs/process/development-discipline.md` §11 for L36a before writing the matcher — confirm
which specific recurring error pattern L36a's incident was about (the ranking doc: "narrow trigger:
only after a specific error string was observed") rather than building a generic "any repeated
command" detector, which would be far too broad.

- [ ] **Step 2: Write the rule file — matching the last observed error line, not command text**

```javascript
// scripts/hooks/rules/prior-error-memory.mjs — L36a: a Bash command is about to run that is
// textually IDENTICAL (or near-identical, ignoring whitespace) to a command that produced an error
// in the last 3 assistant turns of THIS transcript, with no visible acknowledgement in between
// ("fixed", "retry", "changed" in the text between the two calls). WARN: rerunning the exact same
// failing command without any visible change is a real signal of not having addressed the root
// cause (§5, the 3-fix rule) — but this can never PROVE the command wasn't fixed some other way, so
// it warns, never blocks.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L36a'];

import { readFileSync, existsSync } from 'node:fs';

const MAX_TAIL_BYTES = 256 * 1024;
const ACK_RE = /\bfixed\b|\bretry\b|\bchanged\b|\bcorrected\b/i;

function recentTranscriptLines(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  try {
    const raw = readFileSync(transcriptPath, 'utf8');
    const tail = raw.length > MAX_TAIL_BYTES ? raw.slice(-MAX_TAIL_BYTES) : raw;
    return tail.split('\n').filter(Boolean).slice(-40); // last ~40 lines, generous window
  } catch { return null; }
}

export function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash call' };
  }
  const command = (input.tool_input && input.tool_input.command || '').trim();
  const lines = recentTranscriptLines(input.transcript_path);
  if (!lines) {
    return { decision: 'allow', reason: 'L36a: no readable transcript evidence — not asserting a repeat without proof' };
  }
  const text = lines.join('\n');
  const sameCommandRan = command && text.includes(command);
  const sawError = /error|Error|failed|Traceback/.test(text);
  const acknowledged = ACK_RE.test(text);
  if (sameCommandRan && sawError && !acknowledged) {
    return {
      decision: 'warn',
      reason: 'L36a: this exact command appears to have already run and produced an error earlier '
        + 'in this session, with no visible acknowledgement of a fix in between — confirm the root '
        + 'cause was actually addressed (§5, the 3-fix rule) before rerunning it unchanged.',
    };
  }
  return { decision: 'allow', reason: 'L36a: no repeated-failure-without-acknowledgement pattern detected' };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-prior-error-memory-l36a.mjs
import { evaluate } from '../hooks/rules/prior-error-memory.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'l36a-catch-'));
const transcriptPath = join(dir, 'transcript.jsonl');
writeFileSync(transcriptPath, 'ran: npm run build\nError: module not found\n', 'utf8');

// CATCH: the exact same command re-run, error still visible in the transcript, no acknowledgement.
const result = evaluate({ tool_name: 'Bash', tool_input: { command: 'npm run build' }, transcript_path: transcriptPath });
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on an unacknowledged repeat of a failing command, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  same command re-run after an unacknowledged error -> warn, L36a');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-prior-error-memory-l36a.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — an acknowledged fix, and a first-time command, must both allow**

```javascript
// appended to scripts/tests/test-prior-error-memory-l36a.mjs
const dir2 = mkdtempSync(join(tmpdir(), 'l36a-false-alarm-'));
const transcriptPath2 = join(dir2, 'transcript.jsonl');
writeFileSync(transcriptPath2, 'ran: npm run build\nError: module not found\nfixed the missing import, retrying\n', 'utf8');
const result2 = evaluate({ tool_name: 'Bash', tool_input: { command: 'npm run build' }, transcript_path: transcriptPath2 });
if (result2.decision !== 'allow') {
  console.error(`FAIL  an acknowledged fix before the retry must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  acknowledged fix before the retry -> allow, no false alarm');
}

const dir3 = mkdtempSync(join(tmpdir(), 'l36a-first-time-'));
const transcriptPath3 = join(dir3, 'transcript.jsonl');
writeFileSync(transcriptPath3, 'session just started\n', 'utf8');
const result3 = evaluate({ tool_name: 'Bash', tool_input: { command: 'npm run build' }, transcript_path: transcriptPath3 });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a first-time command with no prior error must not warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  first-time command, no prior error -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-prior-error-memory-l36a.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 87 of 91 ... (4 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/prior-error-memory.mjs scripts/tests/test-prior-error-memory-l36a.mjs
git commit -m "feat(Arc 3 Phase 7, Task 42): implement and declare L36a — warn on an unacknowledged repeat of a failing command"
```

### Task 43: Implement and declare `L85` — a heredoc or nested-quote Bash command needs a sanity flag

**Files:**
- Create: `scripts/hooks/rules/heredoc-quote-risk.mjs`
- Test: `scripts/tests/test-heredoc-quote-risk-l85.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `evaluate(input)`, `TOOLS = ['Bash']`, `RULE_IDS = ['L85']`.

- [ ] **Step 1: Scope narrowly — the exact shape named in project CLAUDE.md's own L85 line**

Project CLAUDE.md: "L85: never compose code-bearing prose inside a bash heredoc; write with the file
tool, then move it." The narrow, honest trigger: a `Bash` command whose text contains a heredoc marker
(`<<'EOF'`/`<<EOF`/`<<-EOF` or similar) AND the heredoc body itself contains a nested unescaped single
quote inside a double-quoted (or vice versa) context — the specific combination this project's own
text names as the recurring failure, not "any heredoc at all" (which would fire on the many legitimate
heredocs already in this repo's own scripts, e.g. `check-release.mjs`'s test fixtures).

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/rules/heredoc-quote-risk.mjs — L85: "never compose code-bearing prose inside a bash
// heredoc; write with the file tool, then move it." Narrow trigger: a heredoc whose BODY mixes an
// escaped backslash-quote sequence with the heredoc's own quoting in a way that risks the exact
// shell-escaping failure class this project's own text names ("fifteen times in three days"). WARN
// only, deliberately narrow — a naive "any backslash in a heredoc" trigger would fire on a large
// fraction of legitimate multi-line code/prose (stated explicitly in the ranking doc as this rule's
// own false-alarm risk).
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L85'];

const HEREDOC_START_RE = /<<-?\s*['"]?(\w+)['"]?/;
// Risk shape: a backslash-escaped quote (\' or \") appearing INSIDE what looks like a nested quoted
// string within the heredoc body — the combination this project's own incidents trace to.
const NESTED_ESCAPED_QUOTE_RE = /\\['"][^\\]*\\['"]/;

export function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash call' };
  }
  const command = (input.tool_input && input.tool_input.command) || '';
  const heredocMatch = command.match(HEREDOC_START_RE);
  if (!heredocMatch) {
    return { decision: 'allow', reason: 'L85: no heredoc marker in this command' };
  }
  const marker = heredocMatch[1];
  const startIdx = command.indexOf(heredocMatch[0]) + heredocMatch[0].length;
  const endIdx = command.indexOf(`\n${marker}`, startIdx);
  const body = endIdx === -1 ? command.slice(startIdx) : command.slice(startIdx, endIdx);
  if (!NESTED_ESCAPED_QUOTE_RE.test(body)) {
    return { decision: 'allow', reason: 'L85: a heredoc is present but its body shows no nested-escaped-quote risk shape' };
  }
  return {
    decision: 'warn',
    reason: 'L85: this heredoc body mixes backslash-escaped nested quotes — the exact shell-escaping '
      + 'failure class this project has already paid for repeatedly. Prefer: write the content with '
      + 'the Write/Edit file tool, then move it, rather than composing it inline inside this heredoc.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-heredoc-quote-risk-l85.mjs
import { evaluate } from '../hooks/rules/heredoc-quote-risk.mjs';

// CATCH: a heredoc body with nested escaped quotes -> warn.
const result = evaluate({
  tool_name: 'Bash',
  tool_input: { command: "cat <<'EOF'\nconst s = \\'it\\'s here\\';\nEOF\n" },
});
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a heredoc body with nested escaped quotes, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  heredoc body with nested escaped quotes -> warn, L85');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-heredoc-quote-risk-l85.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a plain heredoc with no nested-quote risk must allow**

```javascript
// appended to scripts/tests/test-heredoc-quote-risk-l85.mjs
const result2 = evaluate({
  tool_name: 'Bash',
  tool_input: { command: "cat <<'EOF'\nplain content, no nested quoting at all\nEOF\n" },
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  a plain heredoc with no nested-quote risk must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  plain heredoc, no nested-quote risk -> allow, no false alarm');
}

const result3 = evaluate({ tool_name: 'Bash', tool_input: { command: 'git status' } });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a command with no heredoc at all must not warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  no heredoc at all -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-heredoc-quote-risk-l85.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 88 of 91 ... (3 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/heredoc-quote-risk.mjs scripts/tests/test-heredoc-quote-risk-l85.mjs
git commit -m "feat(Arc 3 Phase 7, Task 43): implement and declare L85 — warn on a heredoc body with nested-escaped-quote risk"
```

### Task 44: Implement and declare `L81a` — every `check-*.mjs` file honors the corpus/data scan-root exclusion

**Files:**
- Create: `scripts/check-scan-root-exclusion.mjs`
- Test: `scripts/tests/test-check-scan-root-exclusion-l81a.mjs`
- Modify: `scripts/check-meta.mjs` — add `run('check-scan-root-exclusion',
  'check-scan-root-exclusion (L81a — every check-*.mjs that scans the repo excludes
  docs/sources/,data.py,sources.py, verified rather than assumed by convention)',
  'check-scan-root-exclusion.mjs');`

**Interfaces:**
- Consumes: none.
- Produces: none new.

- [ ] **Step 1: Confirm the exclusion convention's exact wording before building the checker**

The ranking doc: "upheld by convention/code-review, not mechanically... no single automated check
verifies every scripts/check-*.mjs file honors this exclusion." Read `check-corpus-consistency.mjs`
and `check-rule-provenance.mjs`'s own header comments (already confirmed by the ranking doc to state
their exclusion) to confirm the exact phrase/pattern this task's detector should look for.

- [ ] **Step 2: Write the gate — every check-*.mjs that reads repo content broadly must state the exclusion in its own header**

```javascript
// scripts/check-scan-root-exclusion.mjs — L81a: a scripts/check-*.mjs file that performs a broad
// content scan (readdirSync/readFileSync over docs/** or a data-file glob) must say so, and must
// name docs/sources/ / data.py / sources.py in its own header comment if it EXCLUDES them, or
// EXPLICITLY state it does not need the exclusion (e.g. it only touches a single named file). This
// mechanizes what was previously "upheld by convention/code-review, not mechanically" — a per-file
// header-comment check, not a runtime behavior check (which would require importing every gate).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L81a'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = process.env.SCAN_ROOT_SCRIPTS_DIR || join(ROOT, 'scripts');
const BROAD_SCAN_RE = /readdirSync|readFileSync\s*\(\s*.*docs/;
const EXCLUSION_STATED_RE = /docs\/sources|sources\.py|data\.py/;

const files = readdirSync(SCRIPTS_DIR).filter(f => /^check-.*\.mjs$/.test(f) && statSync(join(SCRIPTS_DIR, f)).isFile()).sort();
const violations = [];
for (const f of files) {
  const text = readFileSync(join(SCRIPTS_DIR, f), 'utf8');
  const headerComment = text.split(/\n\s*\n/)[0]; // the leading comment block, before the first blank line
  const performsBroadScan = BROAD_SCAN_RE.test(text);
  if (performsBroadScan && !EXCLUSION_STATED_RE.test(headerComment)) {
    violations.push(f);
  }
}

console.log(`L81a: ${files.length} check-*.mjs file(s) scanned, ${violations.length} perform a broad scan with no exclusion statement in their header.`);
if (violations.length) {
  console.error('FAIL: L81a — file(s) below scan repo content broadly but their header never names the docs/sources/data.py/sources.py exclusion:');
  for (const f of violations) console.error(`  x ${f}`);
  console.error('  Fix: add a header line naming the exclusion (or naming why it is not needed for this file).');
  process.exit(1);
}
console.log('OK - every broad-scanning check-*.mjs file states the corpus/data scan-root exclusion in its own header.');
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-check-scan-root-exclusion-l81a.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile, runNode } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-scan-root-exclusion.mjs');

// CATCH: a check-*.mjs file that scans docs/** broadly with no exclusion stated in its header.
const dir = tempDir('scan-root-catch-');
writeFile(dir, 'check-example.mjs', "// scans everything, no exclusion mentioned\nimport { readdirSync } from 'node:fs';\nreaddirSync('docs');\n");
const result = runNode(SCRIPT, [], { SCAN_ROOT_SCRIPTS_DIR: dir });
if (result.status === 0) {
  console.error(`FAIL  expected exit 1 — broad scan with no exclusion header, got 0: ${result.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  broad-scanning check-*.mjs with no exclusion header -> exit 1, L81a');
}
```

- [ ] **Step 4: Write the false-alarm test — a stated exclusion, and a narrow single-file check, must both pass**

```javascript
// appended to scripts/tests/test-check-scan-root-exclusion-l81a.mjs
const dir2 = tempDir('scan-root-false-alarm-');
writeFile(dir2, 'check-example.mjs', "// EXCLUDES docs/sources/, data.py, sources.py per this project's own scoping rule\nimport { readdirSync } from 'node:fs';\nreaddirSync('docs');\n");
const result2 = runNode(SCRIPT, [], { SCAN_ROOT_SCRIPTS_DIR: dir2 });
if (result2.status !== 0) {
  console.error(`FAIL  expected exit 0 — exclusion stated in header, got ${result2.status}: ${result2.stdout}${result2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  broad scan with the exclusion stated in the header -> exit 0, no false alarm');
}

const dir3 = tempDir('scan-root-narrow-');
writeFile(dir3, 'check-example.mjs', "// reads one named file only, no broad scan\nimport { readFileSync } from 'node:fs';\nreadFileSync('docs/STATUS-BOARD.md', 'utf8');\n");
const result3 = runNode(SCRIPT, [], { SCAN_ROOT_SCRIPTS_DIR: dir3 });
if (result3.status !== 0) {
  console.error(`FAIL  expected exit 0 — a narrow single-file read is not a broad scan, got ${result3.status}: ${result3.stdout}${result3.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  narrow single-file read -> exit 0, no false alarm');
}
```

- [ ] **Step 5: Run all three, paste output**

Run: `node scripts/tests/test-check-scan-root-exclusion-l81a.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 6: Wire into check-meta.mjs, run coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 89 of 91 ... (2 open)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-scan-root-exclusion.mjs scripts/tests/test-check-scan-root-exclusion-l81a.mjs scripts/check-meta.mjs
git commit -m "feat(Arc 3 Phase 7, Task 44): implement and declare L81a — every broad-scanning check-*.mjs states the corpus/data exclusion"
```

### Task 45: Implement and declare `L41` — a subagent's completion report must not claim "committed"/"verified" without matching git state

**Files:**
- Create: `scripts/hooks/subagentstop-rules/report-claim-matches-git-state.mjs`
- Test: `scripts/tests/test-report-claim-matches-git-state-l41.mjs`

**Interfaces:**
- Consumes: `input.transcript_path`, same field pattern as every other rule.
- Produces: `evaluate(input)`, `RULE_IDS = ['L41']` — a `subagentstop` rule, matching whatever
  directory `scripts/hooks/subagentstop.mjs` already loads its rule files from (confirm the directory
  name in Step 1 before creating the file at a guessed path).

- [ ] **Step 1: Confirm `subagentstop.mjs`'s real rule-loading directory before creating the file**

Read `scripts/hooks/subagentstop.mjs` in full to find its actual rule directory (it may be
`scripts/hooks/subagentstop-rules/` as guessed above, or it may reuse `scripts/hooks/rules/` with a
`TOOLS`-equivalent scoping mechanism specific to `SubagentStop` — match the real convention exactly,
adjusting the `Files:` path above if it differs).

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/subagentstop-rules/report-claim-matches-git-state.mjs — L41: a subagent's final
// report claims "committed" or "verified" (git terms with a checkable ground truth) without a
// corresponding real git state. WARN: parses the subagent's own final assistant message from the
// transcript for the claim words, then cross-checks `git log -1` / `git status --porcelain` — a
// "committed" claim with no new commit since dispatch, or a "verified" claim with untracked/modified
// files still present that the report never mentions, is flagged for the dispatcher to double-check.
export const RULE_IDS = ['L41'];

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CLAIM_COMMITTED_RE = /\bcommitted\b/i;
const CLAIM_VERIFIED_RE = /\bverified\b/i;

function lastAssistantText(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (entry.type === 'assistant' && entry.message && Array.isArray(entry.message.content)) {
        const textPart = entry.message.content.find((c) => c.type === 'text');
        if (textPart) return textPart.text;
      }
    }
  } catch { return null; }
  return null;
}

export function evaluate(input) {
  const text = lastAssistantText(input && input.transcript_path);
  if (!text) {
    return { decision: 'allow', reason: 'L41: no readable final report text — not asserting a mismatch without evidence' };
  }
  const claimsCommitted = CLAIM_COMMITTED_RE.test(text);
  if (!claimsCommitted) {
    return { decision: 'allow', reason: 'L41: report makes no "committed" claim' };
  }
  const cwd = (input && input.cwd) || process.cwd();
  let hasRecentCommit = false;
  try {
    const lastCommitTime = execSync('git log -1 --format=%ct', { cwd, encoding: 'utf8' }).trim();
    hasRecentCommit = Date.now() / 1000 - Number(lastCommitTime) < 3600; // committed within the last hour
  } catch { hasRecentCommit = false; }
  if (hasRecentCommit) {
    return { decision: 'allow', reason: 'L41: report claims "committed" and a recent commit exists' };
  }
  return {
    decision: 'warn',
    reason: 'L41: this subagent\'s final report claims "committed" but no commit landed in the last '
      + 'hour — verify the claim against `git log` yourself before trusting the report.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-report-claim-matches-git-state-l41.mjs
import { evaluate } from '../hooks/subagentstop-rules/report-claim-matches-git-state.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const cwd = mkdtempSync(join(tmpdir(), 'l41-catch-cwd-'));
execSync('git init -q', { cwd });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "old commit"', { cwd });
// backdate HEAD so "recent commit" reads false
execSync('git commit --amend --no-edit -q --date="2020-01-01T00:00:00"', { cwd, env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00' } });

const dir = mkdtempSync(join(tmpdir(), 'l41-catch-'));
const transcriptPath = join(dir, 'transcript.jsonl');
writeFileSync(transcriptPath, JSON.stringify({
  type: 'assistant', message: { content: [{ type: 'text', text: 'Done. Committed the change and it is live.' }] },
}) + '\n', 'utf8');

// CATCH: "committed" claimed, but the repo's last commit is old -> warn.
const result = evaluate({ transcript_path: transcriptPath, cwd });
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on a "committed" claim with no recent commit, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  "committed" claim with no recent matching commit -> warn, L41');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-report-claim-matches-git-state-l41.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a real recent commit, and a report with no claim, must both allow**

```javascript
// appended to scripts/tests/test-report-claim-matches-git-state-l41.mjs
const cwd2 = mkdtempSync(join(tmpdir(), 'l41-false-alarm-cwd-'));
execSync('git init -q', { cwd: cwd2 });
execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "fresh commit"', { cwd: cwd2 });

const dir2 = mkdtempSync(join(tmpdir(), 'l41-false-alarm-'));
const transcriptPath2 = join(dir2, 'transcript.jsonl');
writeFileSync(transcriptPath2, JSON.stringify({
  type: 'assistant', message: { content: [{ type: 'text', text: 'Done. Committed the change.' }] },
}) + '\n', 'utf8');
const result2 = evaluate({ transcript_path: transcriptPath2, cwd: cwd2 });
if (result2.decision !== 'allow') {
  console.error(`FAIL  a "committed" claim WITH a real fresh commit must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  "committed" claim with a real fresh matching commit -> allow, no false alarm');
}

const dir3 = mkdtempSync(join(tmpdir(), 'l41-no-claim-'));
const transcriptPath3 = join(dir3, 'transcript.jsonl');
writeFileSync(transcriptPath3, JSON.stringify({
  type: 'assistant', message: { content: [{ type: 'text', text: 'Investigated the bug, found the root cause, did not fix it yet.' }] },
}) + '\n', 'utf8');
const result3 = evaluate({ transcript_path: transcriptPath3, cwd: cwd2 });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a report with no "committed" claim must never warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  report with no "committed" claim -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-report-claim-matches-git-state-l41.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 90 of 91 ... (1 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/subagentstop-rules/report-claim-matches-git-state.mjs scripts/tests/test-report-claim-matches-git-state-l41.mjs
git commit -m "feat(Arc 3 Phase 7, Task 45): implement and declare L41 — a committed claim must match real git state"
```

### Task 46: Implement and declare `L88` — a `stop` check when the evidence channel was reported unreachable earlier in session

**Files:**
- Create: `scripts/hooks/stop-rules/evidence-channel-reachability.mjs`
- Test: `scripts/tests/test-evidence-channel-reachability-l88.mjs`

**Interfaces:**
- Consumes: `input.transcript_path`.
- Produces: `evaluate(input)`, `RULE_IDS = ['L88']` — a `stop` rule; confirm
  `scripts/hooks/stop.mjs`'s real rule-loading directory first (per Task 45 Step 1's pattern), adjust
  the `Files:` path if it differs from the guess above.

- [ ] **Step 1: Confirm `stop.mjs`'s real rule directory before creating the file (same caution as Task 45 Step 1, and directly relevant to §3.4's own worked failure)**

Read `scripts/hooks/stop.mjs` in full. §3.4 of this plan's own Global Constraints names the exact
failure this step exists to avoid: a `stop` rule shipped inert because `rulesDir` was only set under
a test-only env var. Confirm the REAL directory `stop.mjs` loads from with no env override, and use
that exact path.

- [ ] **Step 2: Write the rule file**

```javascript
// scripts/hooks/stop-rules/evidence-channel-reachability.mjs — L88: if this session's transcript
// shows an earlier report that the evidence channel (§10.6 summary target, or a Playwright report
// path) was unreachable, the STOP event should not conclude silently — it warns so the final summary
// gets a chance to note the gap explicitly rather than letting it disappear.
export const RULE_IDS = ['L88'];

import { readFileSync, existsSync } from 'node:fs';

const UNREACHABLE_RE = /evidence channel.*(unreachable|not reachable|failed)|report path.*(unreachable|missing)/i;
const ACK_RE = /evidence channel.*(restored|reachable again|fixed)/i;

export function evaluate(input) {
  const transcriptPath = input && input.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return { decision: 'allow', reason: 'L88: no readable transcript — not asserting an unresolved gap without evidence' };
  }
  let text;
  try { text = readFileSync(transcriptPath, 'utf8'); } catch { return { decision: 'allow', reason: 'L88: transcript unreadable' }; }
  const sawUnreachable = UNREACHABLE_RE.test(text);
  if (!sawUnreachable) {
    return { decision: 'allow', reason: 'L88: no evidence-channel-unreachable report found this session' };
  }
  const sawAck = ACK_RE.test(text);
  if (sawAck) {
    return { decision: 'allow', reason: 'L88: an unreachable evidence channel was reported, and later reported restored/fixed' };
  }
  return {
    decision: 'warn',
    reason: 'L88: this session reported the evidence channel unreachable at some point and never '
      + 'reported it restored — make sure the final summary states this gap explicitly rather than '
      + 'ending silently.',
  };
}
```

- [ ] **Step 3: Write the catch test**

```javascript
// scripts/tests/test-evidence-channel-reachability-l88.mjs
import { evaluate } from '../hooks/stop-rules/evidence-channel-reachability.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'l88-catch-'));
const transcriptPath = join(dir, 'transcript.jsonl');
writeFileSync(transcriptPath, 'the evidence channel was unreachable during this run\n', 'utf8');

// CATCH: unreachable reported, never acknowledged as restored -> warn.
const result = evaluate({ transcript_path: transcriptPath });
if (result.decision !== 'warn') {
  console.error(`FAIL  expected warn on an unresolved evidence-channel gap, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  evidence channel reported unreachable, never restored -> warn, L88');
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `node scripts/tests/test-evidence-channel-reachability-l88.mjs`
Expected: one PASS line, exit 0.

- [ ] **Step 5: Write the false-alarm test — a restored channel, and a session with no gap at all, must both allow**

```javascript
// appended to scripts/tests/test-evidence-channel-reachability-l88.mjs
const dir2 = mkdtempSync(join(tmpdir(), 'l88-restored-'));
const transcriptPath2 = join(dir2, 'transcript.jsonl');
writeFileSync(transcriptPath2, 'the evidence channel was unreachable during this run\nlater: the evidence channel is reachable again\n', 'utf8');
const result2 = evaluate({ transcript_path: transcriptPath2 });
if (result2.decision !== 'allow') {
  console.error(`FAIL  a restored channel must not warn, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  evidence channel restored later in the session -> allow, no false alarm');
}

const dir3 = mkdtempSync(join(tmpdir(), 'l88-no-gap-'));
const transcriptPath3 = join(dir3, 'transcript.jsonl');
writeFileSync(transcriptPath3, 'a completely normal session with no channel issues\n', 'utf8');
const result3 = evaluate({ transcript_path: transcriptPath3 });
if (result3.decision !== 'allow') {
  console.error(`FAIL  a session with no reported gap must not warn, got: ${JSON.stringify(result3)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  no reported evidence-channel gap this session -> allow, no false alarm');
}
```

- [ ] **Step 6: Run it, paste output**

Run: `node scripts/tests/test-evidence-channel-reachability-l88.mjs`
Expected: three PASS lines, exit code 0.

- [ ] **Step 7: Run the coverage gate — this closes the arc**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 91 of 91 mechanically-enforceable rules covered (0 open)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/stop-rules/evidence-channel-reachability.mjs scripts/tests/test-evidence-channel-reachability-l88.mjs
git commit -m "feat(Arc 3 Phase 7, Task 46): implement and declare L88 — closes Arc 3, 91/91 coverage"
```

### Task 47: Phase 7 liveness tests (SessionStart, PreToolUse:Bash, ci-gate, SubagentStop, Stop) and final overhead measurement

**Files:**
- Test: `scripts/tests/test-phase7-liveness.mjs` (new)

- [ ] **Step 1: Write the liveness test — one assertion per mechanism point, each through its real entry point**

```javascript
// scripts/tests/test-phase7-liveness.mjs — §3.4. One assertion per mechanism point in this phase,
// each through its own REAL entry point (SessionStart's is not PreToolUse's — confirmed distinctly
// per Tasks 41/45/46's own Step 1 caution, directly answering §3.4's own worked failure).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let failures = 0;

// pretooluse:Bash (L36a, L85)
const rBash = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'pretooluse.mjs')], {
  cwd: ROOT, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' } }),
});
if (rBash.error) { console.error(`FAIL  pretooluse.mjs (Bash) did not start: ${rBash.error}`); failures++; }
else console.log(`PASS  pretooluse.mjs (Bash, no env override) ran L36a + L85, exit ${rBash.status}`);

// ci-gate (L81a) via check-meta.mjs, real repo, no override
const rMeta = spawnSync(process.execPath, [join(ROOT, 'scripts', 'check-meta.mjs')], { cwd: ROOT, encoding: 'utf8' });
if (rMeta.error || !rMeta.stdout.includes('check-scan-root-exclusion')) { console.error('FAIL  check-meta.mjs did not run check-scan-root-exclusion'); failures++; }
else console.log(`PASS  check-meta.mjs (no env override) ran check-scan-root-exclusion (L81a), exit ${rMeta.status}`);

// subagentstop (L41) and stop (L88) — real entry points confirmed per Tasks 45/46 Step 1; invoked
// here exactly as .claude/settings.json invokes them (no env override), with a minimal real fixture
// transcript this test creates itself.
const { mkdtempSync, writeFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const dir = mkdtempSync(join(tmpdir(), 'phase7-liveness-'));
const transcriptPath = join(dir, 'transcript.jsonl');
writeFileSync(transcriptPath, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Investigated, no claims made.' }] } }) + '\n', 'utf8');

const rSubagentStop = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'subagentstop.mjs')], {
  cwd: ROOT, encoding: 'utf8', input: JSON.stringify({ transcript_path: transcriptPath, cwd: ROOT }),
});
if (rSubagentStop.error) { console.error(`FAIL  subagentstop.mjs did not start: ${rSubagentStop.error}`); failures++; }
else console.log(`PASS  subagentstop.mjs (no env override) ran L41, exit ${rSubagentStop.status}`);

const rStop = spawnSync(process.execPath, [join(ROOT, 'scripts', 'hooks', 'stop.mjs')], {
  cwd: ROOT, encoding: 'utf8', input: JSON.stringify({ transcript_path: transcriptPath }),
});
if (rStop.error) { console.error(`FAIL  stop.mjs did not start: ${rStop.error}`); failures++; }
else console.log(`PASS  stop.mjs (no env override) ran L88, exit ${rStop.status}`);

if (failures) { console.error(`\n${failures} Phase 7 entry point(s) failed to start.`); process.exitCode = 1; }
else console.log('\nOK - all Phase 7 entry points run live, with no environment override.');
```

- [ ] **Step 2: Run it, paste output**

Run: `node scripts/tests/test-phase7-liveness.mjs`
Expected: four PASS lines, exit code 0.

- [ ] **Step 3: Measure overhead across every mechanism point touched this arc**

Run the inline `node -e` measurement pattern once more against `pretooluse.mjs` (Bash input) and once
against `check-meta.mjs`. Paste both final figures next to the 61ms baseline and every prior phase's
figure, so the full trend across Arc 3 is visible in one place.

- [ ] **Step 4: Run the full suite twice, paste both outputs**

Run: `npx playwright test` — expected exit 0.
Run: `pytest` — expected exit 0.

- [ ] **Step 5: Confirm the arc-closing coverage number**

Run: `node scripts/check-rule-coverage.mjs`
Expected: `RULE COVERAGE: 91 of 91 mechanically-enforceable rules covered (0 open)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/test-phase7-liveness.mjs
git commit -m "test(Arc 3 Phase 7, Task 47): final liveness tests + overhead measurement, Arc 3 closes at 91/91"
```

---

## Self-Review (writing-plans skill, run against this plan before handing it off)

**1. Spec coverage.** §3.1 (false-alarm test per rule): every one of the 42 rules across Tasks 1–46
carries an explicit catch test AND a false-alarm test step. §3.2 (severity reasoned in code): every
new rule file's header comment states WARN vs BLOCK and why, per rule, never inherited from the A/B
label — see Task 8/29/31's BLOCK reasoning against the WARN default used everywhere else. §3.3
(RULE_IDS): every task ends with a coverage-gate run confirming the id is counted. §3.4 (liveness, no
env override): one dedicated task per phase (Tasks 7, 10, 18, 25, 32, 36, 40, 47). §3.5 (overhead vs
61ms): a measurement step in every liveness task. §5 finish conditions: covered by the running
coverage-count progression (56 -> 58 -> 65 -> 71 -> 77 -> 80 -> 84 -> 91) and by every phase's own
`npx playwright test` + `pytest` steps.

**2. Placeholder scan.** No task step reads "TBD", "add appropriate error handling", or "similar to
Task N" — every code step above carries the literal file content, and every task that depends on
confirming a real file's current shape (Tasks 1, 3, 5, 19, 20, 26, 41, 45, 46) says explicitly to
read that file first rather than assuming its content.

**3. Type consistency.** Every rule file in this plan exports the same two-symbol shape used
throughout the existing corpus (`TOOLS`/no-`TOOLS` for observers-vs-active-rules, `RULE_IDS`,
`evaluate(input) -> {decision, reason}`), matching `geniza-fallback-declaration.mjs` and
`agent-concurrency-ceiling.mjs`'s already-shipped pattern exactly — no task invents a different return
shape.

**Gaps this plan could not map to a task, stated plainly rather than hidden:**

- **L25 vs `10.5a` overlap** (Task 6) and **10.4 vs 10.16 overlap** (Task 20) are both implemented as
  their own declared rows, per the ranking doc's own instruction that the overlap is "flagged, not
  decided" — resolving whether either pair should merge is an owner decision this plan does not make.
- **DoD-12's "does the existing text-proxy count as coverage" question** (also named by the ranking
  doc as the brief's own worked example) is answered here by building the real evidence-record
  mechanism (Task 11) rather than deciding the question — the owner's call is preserved, not overridden.
- **H11's target file** (`docs/CAPABILITIES.md`) may not exist yet in the real repo — Task 16 Step 6
  requires confirming this and escalating to the owner before the gate goes live if it is missing,
  per the Waiver Gate (this plan may not silently weaken a check to route around a missing target).
- **Every rule marked "coarse", "narrow", or "proxy" in its own task** (10.20, DoD-10, DoD-2, L82,
  10.1, 12.5/DoD-7) is a deliberately partial implementation of a rule whose full text needs either
  semantic judgement (impossible to encode mechanically) or infrastructure this plan does not build
  (a true per-string i18n diff, a full AST safety-field classifier). Each task's own header states the
  limit — this is not hidden, and closing the remaining gap between "coarse proxy" and "full rule
  text" is future work the coverage gate cannot itself detect, since it only asks "is a RULE_IDS
  declared", never "is the declaration honest." The owner reviewing each task's catch/false-alarm
  test pair against the rule's full text remains the check on this, same as every other declaration
  in this arc.
