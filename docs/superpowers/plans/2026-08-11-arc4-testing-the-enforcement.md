# Arc 4: Testing the Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regression coverage for the enforcement machinery itself — the seven untested commit gates, the untested shared hook helpers and observers, the R-140 worsening-vs-state defect — plus one new whole-corpus consistency gate that asks cross-cutting questions no per-asset gate asks today.

**Architecture:** Every gate gains a seam (`--root` for tree-scanning gates, command/probe injection for external-state gates) so it can be driven against a disposable tree, then gets pytest coverage through the existing `run_gate` harness in `tests/test_arc2_phase1_gates.py`. New tests live in one new file, `tests/test_arc4_gate_coverage.py`, plus `tests/test_arc4_corpus_consistency.py` for the new gate. The new whole-corpus gate (`scripts/check-corpus-consistency.mjs`) reads the committed mirror (`rules.sqlite`) and the hooks/gates on disk, and blocks bidirectionally against a declared baseline (the R-119/R-119a shape): a WORSENING blocks, a REPAIRED-but-still-listed item blocks, historical debt is printed loudly and never blocks.

**Tech Stack:** Node .mjs gates (no dependencies beyond node:*), pytest for gate tests (the established pattern — gates are tested from Python via subprocess), sqlite3 (Python stdlib) for reading the mirror.

## Global Constraints

- **§10.25 (owner, 2026-08-10): all infrastructure is written in ENGLISH** — gate text, comments, patterns, test names, commit messages, this plan. Hebrew only in product user-facing strings, safety data, and owner conversation.
- **Every gate gets a seam before it gets a test.** A gate that can only run against the real repo can only be tested against the real repo's current luck (R-132). State the seam step explicitly per gate.
- **RED witnessed for every test** (DoD-2). A test that passed on first run is void — rewrite it. For seam-plus-test tasks the RED is produced by planting the defect in a disposable tree and watching the gate miss/catch it as appropriate.
- **A gate test that cannot fail is L57/L58** and is worse than no test. Every positive test has a sibling negative test (the gate does NOT fire on healthy input), and at least one test proves the gate scanned something (the "scanned nothing is not a pass" shape from `test_arc2_phase1_gates.py:53`).
- **Reuse `run_gate` / `git_env()` from `tests/test_arc2_phase1_gates.py` (R-116).** No second harness. Import them: `from test_arc2_phase1_gates import run_gate, git_env`.
- **The new corpus gate must never block on historical debt (L70).** Bidirectional declared baseline only: block on worsening, block on a repaired item still listed in the baseline, print standing debt loudly.
- **No work on `scripts/hooks/stop-rules/timestamp-without-clock-read.mjs` (L84)** — in flight by another agent with its own tests. The corpus gate must tolerate its current ungrouped state (see Task 8 baseline).
- **Suite discipline (§11a):** `python -m pytest` and `npx playwright test` run serialized, never concurrent with each other or with heavy subagents. Work on `main`, no worktrees (§9).
- **Fail-open convention for gates:** a gate that cannot decide (unreadable root, absent DB, missing interpreter) prints "could not decide" and exits 0 — it never blocks on its own inability to read (§10.24). Tests assert this branch explicitly.
- **Re-measure before asserting.** Any count this plan quotes (44 A/B lessons, 30/14 enforced split, 2 ungrouped) is a measurement from 2026-08-11 and is re-measured by the task that acts on it. The 30/14 split in particular is instrument-dependent — Task 8 defines the instrument before freezing any baseline.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/check-no-arbitrary-waits.mjs` (modify) | gains `--root` |
| `scripts/check-workflows.mjs` (modify) | gains `--root` |
| `scripts/check-requirements.mjs` (modify) | gains `--root` |
| `scripts/check-commands-exist.mjs` (modify) | gains `--root` |
| `scripts/check-ci.mjs` (modify) | gains command-injection seam (`CHECK_CI_GIT` / `CHECK_CI_GH` env) |
| `scripts/check-geniza-fresh.mjs` (modify) | gains python-probe seam (`CHECK_GENIZA_PY` env) |
| `scripts/check-rules-complete.mjs` (modify) | gains doc-path + reader seams |
| `scripts/check-h8-ledger.mjs` (modify) | R-140: own-added rows answer the full rule |
| `scripts/check-corpus-consistency.mjs` (create) | the whole-corpus gate |
| `docs/process/corpus-consistency-baseline.json` (create) | its declared baseline |
| `tests/test_arc4_gate_coverage.py` (create) | tests for Tasks 1–6 |
| `tests/test_arc4_h8_state.py` (create) | Task 7 |
| `tests/test_arc4_corpus_consistency.py` (create) | Task 8 |
| `tests/test_arc4_wiring.py` (create) | Task 9 |
| `scripts/check-meta.mjs` (modify, Task 9) | wires the new gate |

Note on test file size: `check-test-file-size.mjs` warns on oversized spec files; if `tests/test_arc4_gate_coverage.py` grows past the warning threshold during implementation, split it by task group (`test_arc4_gate_coverage_tree.py` / `_external.py` / `_helpers.py`) — the split is allowed, a second harness is not.

---

### Task 1: `--root` seam + tests for the tree-scanning gates, part 1 — `check-no-arbitrary-waits` and `check-workflows`

**Files:**
- Modify: `scripts/check-no-arbitrary-waits.mjs`
- Modify: `scripts/check-workflows.mjs`
- Create: `tests/test_arc4_gate_coverage.py`

**Interfaces:**
- Consumes: `run_gate(script, *args)` and `git_env()` from `tests/test_arc2_phase1_gates.py` (lines 5–15).
- Produces: the `--root <dir>` convention both gates now honor — `--root` overrides the module-relative `ROOT`; an unreadable `--root` prints `could not` and exits 0. Tasks 2–4 copy this exact seam shape.

- [ ] **Step 1: Read both gates in full.** `scripts/check-no-arbitrary-waits.mjs` (88 lines) scans `tests/**/*.ts|mjs` for live `waitForTimeout`; `scripts/check-workflows.mjs` (144 lines) parses `.github/workflows/*` for duplicate keys / missing `on:`/`jobs:`/`runs-on`/`steps`. Both currently hardcode `ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')`. Note the exact output strings for pass/fail — the tests assert on them.

- [ ] **Step 2: Add the `--root` seam to both gates.** Same shape `check-control-bytes.mjs` already uses (it is the proven reference — read its argv handling first):

```js
const argv = process.argv.slice(2);
const rootArg = (() => { const i = argv.indexOf('--root'); return i === -1 ? null : argv[i + 1]; })();
const ROOT = rootArg ?? join(dirname(fileURLToPath(import.meta.url)), '..');
// fail-open on an unreadable override (§10.24):
if (rootArg && !existsSync(ROOT)) {
  console.log(`check-no-arbitrary-waits: could not read root ${ROOT}. Not blocking.`);
  process.exit(0);
}
```

If the gate uses `git ls-files` internally, pass `cwd: ROOT` to that call so the override actually redirects the scan (this is the exact defect R-132 found in check-no-docker — verify by grep for `execFileSync` / `spawnSync` inside each gate).

- [ ] **Step 3: Write the failing tests** in a new `tests/test_arc4_gate_coverage.py`:

```python
# tests/test_arc4_gate_coverage.py — Arc 4: the enforcement machinery gets its own regression net.
import subprocess
from test_arc2_phase1_gates import run_gate, git_env

def _git_repo(tmp_path, files):
    subprocess.run(["git", "init", "-q"], cwd=str(tmp_path), check=True, env=git_env())
    for rel, content in files.items():
        p = tmp_path / rel; p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=str(tmp_path), check=True, env=git_env())
    return tmp_path

def test_no_arbitrary_waits_catches_a_planted_sleep(tmp_path):
    _git_repo(tmp_path, {"tests/x.spec.ts": "await page.waitForTimeout(500);\n"})
    r = run_gate("check-no-arbitrary-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "x.spec.ts" in r.stdout

def test_no_arbitrary_waits_ignores_a_commented_occurrence(tmp_path):
    _git_repo(tmp_path, {"tests/x.spec.ts": "// never use waitForTimeout here\nawait ok();\n"})
    r = run_gate("check-no-arbitrary-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_no_arbitrary_waits_clean_on_the_real_repo():
    r = run_gate("check-no-arbitrary-waits.mjs")
    assert r.returncode == 0, r.stdout

def test_no_arbitrary_waits_fails_open_on_unreadable_root():
    r = run_gate("check-no-arbitrary-waits.mjs", "--root", "no/such/dir")
    assert r.returncode == 0
    assert "could not" in r.stdout.lower()

def test_workflows_catches_a_duplicate_key(tmp_path):
    wf = ("on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n"
          "    steps:\n      - uses: actions/upload-artifact@v4\n"
          "        with:\n          retention-days: 7\n          retention-days: 30\n")
    _git_repo(tmp_path, {".github/workflows/tests.yml": wf})
    r = run_gate("check-workflows.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "retention-days" in r.stdout or "duplicate" in r.stdout.lower()

def test_workflows_catches_a_job_without_runs_on(tmp_path):
    _git_repo(tmp_path, {".github/workflows/t.yml": "on: push\njobs:\n  t:\n    steps:\n      - run: echo hi\n"})
    r = run_gate("check-workflows.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout

def test_workflows_passes_a_healthy_workflow(tmp_path):
    _git_repo(tmp_path, {".github/workflows/t.yml": "on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n"})
    r = run_gate("check-workflows.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_workflows_clean_on_the_real_repo():
    r = run_gate("check-workflows.mjs")
    assert r.returncode == 0, r.stdout
```

Adjust assertion substrings to the ACTUAL messages observed in Step 1 — asserting on invented strings is how a test passes for the wrong reason.

- [ ] **Step 4: Run the tests BEFORE adding the seam is complete** (or with the seam intentionally not passing `cwd: ROOT` through) and paste the RED output. Expected: the planted-defect tests fail because the gate scanned the real repo instead of `tmp_path` (exit 0 where 1 was expected). This RED is the R-132 reproduction and is the reason the seam exists.

Run: `python -m pytest tests/test_arc4_gate_coverage.py -v`

- [ ] **Step 5: Finish the seam, run again, paste GREEN.** All 8 tests pass. Then run the full existing gate-test files to prove no regression: `python -m pytest tests/test_arc2_phase1_gates.py tests/test_arc4_gate_coverage.py -v`

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-no-arbitrary-waits.mjs scripts/check-workflows.mjs tests/test_arc4_gate_coverage.py
git commit -m "test(arc4, Task 1): --root seams + regression tests for check-no-arbitrary-waits and check-workflows"
```

---

### Task 2: `--root` seam + tests for the tree-scanning gates, part 2 — `check-requirements` and `check-commands-exist`

**Files:**
- Modify: `scripts/check-requirements.mjs`
- Modify: `scripts/check-commands-exist.mjs`
- Modify: `tests/test_arc4_gate_coverage.py`

**Interfaces:**
- Consumes: the `--root` convention from Task 1 (identical argv shape) and `_git_repo` helper from Task 1's test file.
- Produces: nothing new for later tasks; closes two of the seven gates.

- [ ] **Step 1: Read both gates.** `check-requirements.mjs` (173 lines) scans `src/`, `scripts/`, `tests/` for static Python imports and compares against `requirements.txt` — note its stdlib-module allowlist and how it maps import name to package name. `check-commands-exist.mjs` (124 lines) scans a FIXED list of mandatory-read documents (CLAUDE.md, development-discipline.md, checklists, templates, `.claude/commands/enforce.md`, `.serena/memories/*`) for `python|node|bash scripts/x` references and confirms each script exists; note the historical exemption ("this script was deleted" sentences must not fire).

- [ ] **Step 2: Add the `--root` seam to both**, same shape as Task 1 Step 2, including redirecting every hardcoded `join(ROOT, ...)` path (SCAN_DIRS, REQ, the document list). For `check-commands-exist`, a document from the fixed list that is ABSENT under an overridden root is skipped silently (a fixture tree need not carry all of CLAUDE.md) — but under the default root the current behavior is preserved unchanged.

- [ ] **Step 3: Append failing tests** to `tests/test_arc4_gate_coverage.py`:

```python
def test_requirements_catches_an_undeclared_import(tmp_path):
    _git_repo(tmp_path, {
        "src/mod.py": "import tree_sitter\n",
        "requirements.txt": "requests\n",
    })
    r = run_gate("check-requirements.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "tree_sitter" in r.stdout

def test_requirements_ignores_stdlib_imports(tmp_path):
    _git_repo(tmp_path, {"src/mod.py": "import json, os, pathlib\n", "requirements.txt": "\n"})
    r = run_gate("check-requirements.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_requirements_clean_on_the_real_repo():
    r = run_gate("check-requirements.mjs")
    assert r.returncode == 0, r.stdout

def test_commands_exist_catches_a_dead_script_reference(tmp_path):
    _git_repo(tmp_path, {"CLAUDE.md": "Run `python scripts/does-not-exist.py` before work.\n"})
    r = run_gate("check-commands-exist.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "does-not-exist.py" in r.stdout

def test_commands_exist_passes_a_live_reference(tmp_path):
    _git_repo(tmp_path, {
        "CLAUDE.md": "Run `python scripts/ok.py`.\n",
        "scripts/ok.py": "print('ok')\n",
    })
    r = run_gate("check-commands-exist.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_commands_exist_honors_the_historical_exemption(tmp_path):
    _git_repo(tmp_path, {"CLAUDE.md": "`scripts/memsync.py` was deleted on 2026-08-05.\n"})
    r = run_gate("check-commands-exist.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_commands_exist_clean_on_the_real_repo():
    r = run_gate("check-commands-exist.mjs")
    assert r.returncode == 0, r.stdout
```

The exemption test's fixture sentence must match the gate's ACTUAL exemption pattern (read it in Step 1; if the exemption is keyed on wording like "was deleted", use that exact wording; if keyed differently, mirror the real mechanism).

- [ ] **Step 4: Witness RED** (seam absent or incomplete → planted-defect tests observe exit 0), paste output. Run: `python -m pytest tests/test_arc4_gate_coverage.py -v -k "requirements or commands_exist"`

- [ ] **Step 5: Complete seams, witness GREEN, paste output.** Then full file: `python -m pytest tests/test_arc4_gate_coverage.py -v`

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-requirements.mjs scripts/check-commands-exist.mjs tests/test_arc4_gate_coverage.py
git commit -m "test(arc4, Task 2): --root seams + regression tests for check-requirements and check-commands-exist"
```

---

### Task 3: injection seam + tests for `check-ci`

**Files:**
- Modify: `scripts/check-ci.mjs`
- Modify: `tests/test_arc4_gate_coverage.py`

**Interfaces:**
- Consumes: `run_gate` (env is controllable — extend `run_gate` calls with a per-test env by using `subprocess.run` directly where an env override is needed, but keep `git_env()` as the base).
- Produces: env seams `CHECK_CI_GIT` and `CHECK_CI_GH` — absolute paths to stub executables substituted for `git` / `gh` inside the gate. Documented in the gate header.

- [ ] **Step 1: Read `scripts/check-ci.mjs` in full** (124 lines). It resolves `HEAD` via `git rev-parse`, then asks GitHub (via `gh` or the API) for the run conclusion at that SHA, and distinguishes three verdicts: RED run → block/report, no run → NOT VERIFIED (honest absence), green → OK. Record exactly which commands it shells out to and each verdict's output string and exit code. This gate reported red for four days while nobody read it — the tests must pin all three verdicts so a future refactor cannot silently collapse "failed" into "not verified".

- [ ] **Step 2: Add the seam.** Where the gate calls `sh('git', [...])` / `sh('gh', [...])`:

```js
const GIT = process.env.CHECK_CI_GIT || 'git';
const GH  = process.env.CHECK_CI_GH  || 'gh';
```

No other behavior change. The stubs are ordinary scripts the tests write into `tmp_path` (on Windows, write `.cmd` stubs — `@echo off` + `echo <json>` — and point the env var at them; `execFileSync` on Windows needs `shell: true` OR the test writes a `.bat`/`.cmd` and the gate spawns via the env-var path as-is. Verify which works by running the stub once inside the test before asserting on the gate — a stub that cannot execute produces a false RED).

- [ ] **Step 3: Write the failing tests** (append to `tests/test_arc4_gate_coverage.py`):

```python
import os, sys, textwrap
from pathlib import Path

def _stub(tmp_path, name, stdout_text, exit_code=0):
    """Write a Windows .cmd stub that prints fixed output. Returns its absolute path."""
    p = tmp_path / f"{name}.cmd"
    body = f"@echo off\r\ntype \"{tmp_path / (name + '.out')}\"\r\nexit /b {exit_code}\r\n"
    (tmp_path / f"{name}.out").write_text(stdout_text, encoding="utf-8")
    p.write_text(body, encoding="utf-8")
    return str(p)

def _run_ci(tmp_path, gh_stdout, gh_exit=0):
    import subprocess as sp
    from test_arc2_phase1_gates import ROOT  # tests/..
    env = git_env()
    env["CHECK_CI_GIT"] = _stub(tmp_path, "gitstub", "abc123def\n")
    env["CHECK_CI_GH"] = _stub(tmp_path, "ghstub", gh_stdout, gh_exit)
    return sp.run(["node", str(Path(ROOT) / "scripts" / "check-ci.mjs")],
                  capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)

def test_check_ci_blocks_on_a_failed_run(tmp_path):
    r = _run_ci(tmp_path, '[{"conclusion":"failure","name":"playwright"}]\n')
    assert r.returncode == 1, r.stdout + r.stderr
    assert "fail" in r.stdout.lower()

def test_check_ci_reports_not_verified_when_no_run_exists(tmp_path):
    r = _run_ci(tmp_path, "[]\n")
    assert r.returncode == 0, r.stdout + r.stderr
    assert "not verified" in r.stdout.lower()

def test_check_ci_passes_on_a_green_run(tmp_path):
    r = _run_ci(tmp_path, '[{"conclusion":"success","name":"playwright"}]\n')
    assert r.returncode == 0, r.stdout + r.stderr

def test_check_ci_fails_open_when_gh_is_unavailable(tmp_path):
    r = _run_ci(tmp_path, "", gh_exit=1)
    assert r.returncode == 0, r.stdout + r.stderr
```

The `gh_stdout` payload shapes above are ILLUSTRATIVE — Step 1 determines the real command and JSON shape the gate consumes (`gh run list --json ...` vs REST); the stubs must echo that real shape, captured once from a live `gh` invocation and pasted into the test as a fixture string. Exit-code expectations must match the gate's documented policy (its header says it "blocks on a run that FAILED, never on the absence of one" — if the real blocking policy inside check-meta is advisory, assert the gate's own exit code as observed and pin THAT).

- [ ] **Step 4: Witness RED** (before the seam lands, the env vars are ignored and the gate talks to real git/gh — the failed-run test observes the wrong verdict). Paste output. Run: `python -m pytest tests/test_arc4_gate_coverage.py -v -k check_ci`

- [ ] **Step 5: Land the seam, witness GREEN, paste.** Full file run again.

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-ci.mjs tests/test_arc4_gate_coverage.py
git commit -m "test(arc4, Task 3): command-injection seam + three-verdict regression tests for check-ci"
```

---

### Task 4: seams + tests for the database-backed gates — `check-geniza-fresh` and `check-rules-complete`

**Files:**
- Modify: `scripts/check-geniza-fresh.mjs`
- Modify: `scripts/check-rules-complete.mjs`
- Modify: `tests/test_arc4_gate_coverage.py`

**Interfaces:**
- Consumes: `run_gate`, `_git_repo`, the env-override pattern from Task 3.
- Produces: `CHECK_GENIZA_PY` env (path to a substitute python executable/stub for the embedded probe) on check-geniza-fresh; `--doc <path>` + `CHECK_RULES_DB_UNAVAILABLE`-style behavior confirmation on check-rules-complete.

**Scope honesty, stated up front:** these two gates consult live external state (PostgreSQL). This task tests every branch that is decidable WITHOUT a live database — the skip-loudly path, the fail-open path, the verdict formatting on injected probe output — plus, when the local Postgres service is up (it is a Windows service with auto-start), one live smoke test marked with a skip-if-down guard. It does NOT build a disposable Postgres. That boundary is deliberate (the gate's own header defines "DB down" as a loud skip, not a failure) and is reported as scope, not hidden.

- [ ] **Step 1: Read both gates in full.** `check-geniza-fresh.mjs` (185 lines): embeds a Python program, searches for the interpreter the way check-pytest does (L54 Store-alias hazard), skips LOUDLY when the stack is down, and self-heals via ingest on mismatch — find whether the self-heal writes (it calls ingest) and confirm the tests never trigger it against the real store. `check-rules-complete.mjs` (122 lines): READ-ONLY by hard-won design (its header documents the round-1 defect where checking mutated the store) — it calls `extract_rules()` and compares against `connect_reader()`. Record: how the interpreter is located, every distinct exit path, and every output string.

- [ ] **Step 2: Add the probe seam to `check-geniza-fresh.mjs`.** Where it spawns the interpreter:

```js
const PYTHON = process.env.CHECK_GENIZA_PY || locateInterpreter(); // existing search logic
```

This lets a test substitute a stub that emits a canned probe result (fresh / stale list / "cannot connect"), driving every verdict branch without a database. For `check-rules-complete.mjs`, add the same interpreter seam (`CHECK_RULES_PY`) — its Python side already separates "extractor found X" from "reader returned Y", so a stub can emit both sides.

- [ ] **Step 3: Write the failing tests.** The stub python is a `.cmd` (Task 3's `_stub` helper) that ignores its arguments and prints the canned JSON/text the gate's embedded program would print — capture the REAL output shape once by running the gate verbosely against the live store and paste it as fixture strings.

```python
def test_geniza_fresh_skips_loudly_when_the_stack_is_down(tmp_path):
    # stub interpreter that prints the gate's own "cannot connect" marker
    r = _run_with_env("check-geniza-fresh.mjs",
                      CHECK_GENIZA_PY=_stub(tmp_path, "py", "<the real cannot-connect line>\n", 0))
    assert r.returncode == 0
    assert "skip" in r.stdout.lower() or "not blocking" in r.stdout.lower()
    assert "geniza" in r.stdout.lower()   # the skip names its subject — a silent skip is the graphify failure

def test_geniza_fresh_blocks_on_a_stale_document(tmp_path):
    r = _run_with_env("check-geniza-fresh.mjs",
                      CHECK_GENIZA_PY=_stub(tmp_path, "py", "<the real stale-report shape>\n", 0))
    assert r.returncode == 1, r.stdout + r.stderr

def test_geniza_fresh_live_smoke():
    """Against the real store — skipped, loudly, when the service is down."""
    r = run_gate("check-geniza-fresh.mjs")
    assert r.returncode == 0, r.stdout   # real repo is fresh at commit time by definition

def test_rules_complete_blocks_on_a_rule_missing_from_the_store(tmp_path):
    r = _run_with_env("check-rules-complete.mjs",
                      CHECK_RULES_PY=_stub(tmp_path, "py", "<real shape: extractor has L999, reader does not>\n", 0))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "L999" in r.stdout

def test_rules_complete_is_read_only_even_on_a_mismatch(tmp_path):
    """The round-1 defect, pinned forever: checking must not repair. The stub records whether it
    was invoked with any write-shaped argument (sync/ingest/build); assert it was not."""
    marker = tmp_path / "invoked.txt"
    # stub tees its argv to marker; test asserts no 'build_rules_store' / 'sync' token appears
    ...
```

Write `_run_with_env(script, **env)` once in this file: `subprocess.run(["node", ROOT/"scripts"/script], env={**git_env(), **env}, ...)`. The `...` in the read-only test is filled at implementation with the tee-stub (a `.cmd` that appends `%*` to the marker file) — the assertion is `assert "build_rules_store" not in marker_text and "sync" not in marker_text`.

- [ ] **Step 4: Witness RED, paste.** Before the seams, the stubs are ignored: the block-on-stale tests observe exit 0. Run: `python -m pytest tests/test_arc4_gate_coverage.py -v -k "geniza or rules_complete"`

- [ ] **Step 5: Land seams, witness GREEN, paste.** Confirm the live smoke test also passes with the real store up.

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-geniza-fresh.mjs scripts/check-rules-complete.mjs tests/test_arc4_gate_coverage.py
git commit -m "test(arc4, Task 4): probe seams + branch tests for check-geniza-fresh and check-rules-complete (read-only pinned)"
```

---

### Task 5: tests for the uncovered shared hook helpers — `bash-grep-extract`, `stale-server`, `target-path`

**Files:**
- Test: `tests/hooks/lib.spec.ts` OR `tests/test_arc4_gate_coverage.py` — **decide by precedent:** find how `bash-segments.mjs`'s day-old test is written (`grep -rn "bash-segments" tests/`) and put these three in the SAME file/framework. R-134's lesson is that the first test of a shared helper finds real defects; R-116's is that there is one harness per shape.

**Interfaces:**
- Consumes: the three helpers' exported functions — read each file first and copy the real signatures into the tests.
- Produces: pinned contracts for every consumer rule (`grep -rln "bash-grep-extract\|stale-server\|target-path" scripts/hooks/` to enumerate consumers; name them in the test docstrings).

- [ ] **Step 1: Enumerate consumers and read all three helpers in full.** For each exported function record: input shape, output shape, and the edge the consumers depend on (e.g., `target-path.mjs` presumably resolves the file a tool call targets — what does it return for a missing path? for a path outside the repo?).

- [ ] **Step 2: Write failing tests — minimum contract per helper, expanded from what Step 1 finds:**

For `bash-grep-extract.mjs` (extracts grep/rg patterns from Bash commands, used by rules that police grep-instead-of-geniza):
```js
// shape only — real cases come from Step 1's reading of consumers:
assert.deepEqual(extract("grep -rn 'safe' src/"), [{ pattern: "safe", paths: ["src/"] }]);
assert.deepEqual(extract("echo grep is a word"), []);          // not an invocation
assert.deepEqual(extract("git grep -n foo"), [ /* consumer-defined */ ]);
```

For `stale-server.mjs`: the L-series stale-serve.js hazard — assert the detection verdict for (a) a server started before the last build, (b) after, (c) no server. If it reads process state, give it an injectable clock/process-list parameter in the same commit (seam-before-test applies to helpers too).

For `target-path.mjs`: resolution of tool-call target paths — absolute in-repo path, relative path, path outside root, missing field. Assert the exact return shape consumers destructure.

Each test carries a one-line docstring naming the consumer rule that depends on the asserted behavior.

- [ ] **Step 3: Witness RED** — for a pure-function helper, RED is produced by asserting the intended contract BEFORE reading the implementation's answer for the edge cases; where the implementation already satisfies everything (possible — these are live helpers), follow L57 discipline: mutate the helper temporarily (`return []`), observe every test fail, restore, observe pass, and paste both runs. A test suite that was never seen red proves nothing about itself.

- [ ] **Step 4: GREEN, paste.** If any test exposes a real defect (the R-134 precedent says expect this): STOP, file it in the register, fix it under `systematic-debugging` with its own red-green, and note it in the task summary — do not silently widen the test to bless the defect.

- [ ] **Step 5: Commit.**

```bash
git add tests/<chosen-file> scripts/hooks/lib/stale-server.mjs  # only if a seam was added
git commit -m "test(arc4, Task 5): contract tests for bash-grep-extract, stale-server, target-path (R-134 pattern)"
```

---

### Task 6: tests for the uncovered observers — `read-tracker` and `clock-tracker`

**Files:**
- Test: same framework/location as Task 5 (follow the precedent found there; if observers already have a test shape from Phase 4 — `grep -rn "edit-tracker\|session-events" tests/` — copy THAT).

**Interfaces:**
- Consumes: each observer's entry point (they are invoked by the hook dispatchers with a tool-event payload and persist evidence state; read `scripts/hooks/observers/edit-tracker.mjs` + its existing test for the established payload shape).
- Produces: the pinned evidence-channel contract: what `read-tracker` records for a Read event and what the two consumer rules (find them: `grep -rln "read-tracker" scripts/hooks/`) query back; same for `clock-tracker`.

- [ ] **Step 1: Read both observers and both consumers.** Record the state file/store each writes, its schema, and the exact query the consumer rules perform. The evidence channel is the contract — an observer that writes a shape the rule does not read is an inert shipment (`no-inert-shipment` skill applies; read it, it is short).

- [ ] **Step 2: Write failing tests, three per observer:**
  1. an event IS recorded (feed a synthetic Read/clock event through the observer's real entry point against a tmp state root; assert the stored record's exact shape),
  2. the consumer's query finds it (import the consumer's lookup or replicate its exact read; this is the end-to-end evidence-channel assertion — DoD-5's "a reader that never executes is still dead"),
  3. the negative: an unrelated event is NOT recorded.

State isolation: observers must take their state location from an env/param the dispatchers already pass (check `pretooluse.mjs`/`stop.mjs` for how `edit-tracker` state is rooted). If state location is hardcoded, add the seam first — same commit, stated as such.

- [ ] **Step 3: RED witnessed** (assert-before-implementation-answers, or the L57 mutation protocol from Task 5 Step 3). Paste.

- [ ] **Step 4: GREEN, paste. Defects found go to the register, fixed red-green, never blessed.**

- [ ] **Step 5: Commit.**

```bash
git commit -m "test(arc4, Task 6): evidence-channel contract tests for read-tracker and clock-tracker"
```

---

### Task 7: R-140 — a commit's OWN new rows answer the full rule (`check-h8-ledger`), plus the sibling audit

**Files:**
- Modify: `scripts/check-h8-ledger.mjs`
- Create: `tests/test_arc4_h8_state.py`

**Interfaces:**
- Consumes: the gate's existing env seams — `ROADMAP=<path>`, `BASELINE_ROADMAP=<path>` (bypasses git; built for exactly this kind of fixture test), `GITROOT`, `H8_BASELINE_REF`.
- Produces: a third finding class in the gate's output, `NEW ROW WITHOUT LANDING`, which blocks; the sibling-audit verdict consumed by Task 8's design.

- [ ] **Step 1: Reproduce R-140 as a failing test FIRST.** The defect: worsening-only diff by exact message text lets a row that is BORN unlanded pass, because... — do not assume the mechanism; the test will show it.

```python
# tests/test_arc4_h8_state.py — R-140: worsening-only must not exempt rows this commit itself adds.
import subprocess
from pathlib import Path
from test_arc2_phase1_gates import git_env
ROOT = Path(__file__).resolve().parent.parent

BASE = """## 5 · Ledger
| R-1 | done | lands in Phase 2 |
## 5a
| R-64 | done | lands in Phase 3 |
"""
# current adds R-999 with NO landing column content:
CURR = BASE.replace("## 5a", "| R-999 | open |  |\n## 5a")

def _run(roadmap_text, baseline_text, tmp_path):
    rp = tmp_path / "roadmap.md"; rp.write_text(roadmap_text, encoding="utf-8")
    bp = tmp_path / "base.md"; bp.write_text(baseline_text, encoding="utf-8")
    env = {**git_env(), "ROADMAP": str(rp), "BASELINE_ROADMAP": str(bp)}
    return subprocess.run(["node", str(ROOT / "scripts" / "check-h8-ledger.mjs")],
                          capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)

def test_r140_a_row_born_unlanded_blocks(tmp_path):
    r = _run(CURR, BASE, tmp_path)
    assert r.returncode == 1, f"R-140 reproduced: gate said OK on a born-unlanded row\n{r.stdout}"
    assert "R-999" in r.stdout

def test_preexisting_debt_still_never_blocks(tmp_path):
    debt = BASE.replace("## 5a", "| R-500 | open |  |\n## 5a")   # unlanded on BOTH sides
    r = _run(debt, debt, tmp_path)
    assert r.returncode == 0, r.stdout
    assert "STANDING DEBT" in r.stdout

def test_a_repaired_row_passes(tmp_path):
    debt = BASE.replace("## 5a", "| R-500 | open |  |\n## 5a")
    repaired = BASE.replace("## 5a", "| R-500 | open | lands in Phase 5 |\n## 5a")
    r = _run(repaired, debt, tmp_path)
    assert r.returncode == 0, r.stdout
```

The fixture roadmap rows must match the REAL row grammar the analyzer parses — copy two genuine rows from `docs/ROADMAP-2026-07-30.md` §5/§5a and mutate those, rather than inventing a table shape. Adjust `BASE`/`CURR` accordingly before first run.

- [ ] **Step 2: Run, witness the R-140 RED** (first test fails: exit 0 where 1 expected). Paste. If it does NOT reproduce, STOP — the register entry is wrong or the fixture grammar is off; investigate under `systematic-debugging` before touching the gate.

- [ ] **Step 3: Fix.** In `check-h8-ledger.mjs`'s diff stage: rows present in CURRENT but absent (by row identity — the `R-nn` id, not the whole message) from BASELINE are THIS COMMIT'S OWN rows; evaluate them against the FULL rule and emit failures under a new blocking class `NEW ROW WITHOUT LANDING`. Historical-debt behavior is untouched — the diff-by-message-text path still governs rows whose id exists on both sides.

- [ ] **Step 4: GREEN — all three tests plus the real-repo run** (`node scripts/check-h8-ledger.mjs` exits 0 on the healthy tree). Paste both. Also rerun any existing h8 tests: `python -m pytest tests/ -v -k h8`.

- [ ] **Step 5: The sibling audit — measured, not assumed.** For each of `check-rule-coverage.mjs`, `check-brief.mjs`, `check-h9.mjs`: read its baseline/grandfather mechanism and answer in writing (in the task summary): "can an item BORN today in the exempt state pass?" Known going in: `check-rule-coverage` diffs covered-rule-id SETS against a committed baseline, so a rule added today WITHOUT coverage never enters `covered` and is caught by its errors stage — verify, do not trust this sentence. `check-brief`/`check-h9` use the frozen `docs/process/gate-baselines.json` grandfather list which is explicitly not auto-updated — verify a NEW noncompliant file blocks. Any sibling that shares the R-140 shape: file a register row with the evidence and fix it in THIS task with the same red-green pattern only if the fix is the same one-class change; otherwise register it for the controller — do not scope-creep silently (§12 Circle of Control).

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-h8-ledger.mjs tests/test_arc4_h8_state.py
git commit -m "fix(arc4, Task 7): R-140 - rows born unlanded now block in check-h8-ledger; sibling audit recorded"
```

---

### Task 8: the whole-corpus consistency gate — `check-corpus-consistency.mjs`

**Files:**
- Create: `scripts/check-corpus-consistency.mjs`
- Create: `docs/process/corpus-consistency-baseline.json`
- Test: `tests/test_arc4_corpus_consistency.py`

**Interfaces:**
- Consumes: `rules.sqlite` (table `rule_revisions`, columns: `rule_id, section, title_he, statement, bucket, rule_group, severity, mechanism, mechanism_target, source_path, source_heading, source_hash, revision_status, mirrored_at`; 160 current rows today, 93 `L*`); `scripts/hooks/**` and `scripts/check-*.mjs` on disk. Reads sqlite the way `check-rules-classified.mjs` does (spawned Python + stdlib sqlite3 — copy its mechanism, including its fail-open `undecided()` shape and `--mirror` argument).
- Produces: exit 0/1 + report; seams `--mirror <path>`, `--hooks-root <path>`, `--baseline <path>`; the baseline JSON schema below. Task 9 wires it into check-meta.

**The four questions the gate asks (and the two it does not):**

1. **Enforcement resolution.** Every `current` rule with `rule_group` A or B declares a `mechanism` + `mechanism_target`; resolve it against the tree: `pretooluse:*`/`stop`/`posttooluse`/`subagentstop` mechanisms must have a hook rule file declaring that `RULE_ID`; `commit-gate`/`ci-gate` mechanisms must name (or match by target) an existing `scripts/check-*.mjs` or workflow step. An A/B rule whose mechanism resolves to nothing is UNENFORCED — counted, named, listed. (Measured 2026-08-11 with the hook-only instrument: 15 of 44 A/B lessons resolve to hook RULE_IDs; the rest declare gate/CI mechanisms that this resolution logic must actually resolve rather than assume — the brief's 30/14 split is the expected order of magnitude, and the gate's first full report is the authoritative measurement.)
2. **Classification totality.** Every `current` rule has a non-empty `rule_group` (today: L76, L84 are ungrouped — the known standing debt; L84 is in flight elsewhere). This overlaps `check-rules-classified` deliberately as a cross-check ONLY in the report; it does not double-block — blocking on group-absence stays that gate's job. This gate blocks only on the baseline diff.
3. **Coverage-vs-reachability.** Every RULE_ID declared by a hook rule file appears in a wiring/liveness test file (`tests/test_arc2_phase*_wiring.py` and successors) — corpus-wide, not per-phase: `set(declared RULE_IDs) - set(ids asserted in wiring tests)` is the unreachable-unproven list.
4. **Doc-vs-code drift, narrow and mechanical only.** Two specific, decidable probes born from real incidents: (a) no hook/gate file whose header contains "NOT wired" / "not wired yet" while the file IS reachable from a dispatcher (the pretooluse.mjs incident); (b) every `scripts/*.mjs|py|sh` path mentioned in `mechanism_target` exists on disk. NOT asked (stated in the header, L77 — a gate must not claim more than it measures): whether prose documents semantically describe the code; that needs a human audit, and pretending a grep answers it is the wrong-instrument mistake this programme has now made thirteen times.

**Baseline schema** (`docs/process/corpus-consistency-baseline.json`):

```json
{
  "_frozen_at": "2026-08-11",
  "_note": "Bidirectional (R-119 shape): a finding NOT listed here blocks (worsening); a listed finding that no longer reproduces blocks (repaired-but-still-listed; remove it in the same commit). Standing entries are printed loudly, never block.",
  "unenforced_ab_rules": ["<filled from the gate's own first report>"],
  "ungrouped_rules": ["L76", "L84"],
  "unproven_rule_ids": ["<filled from first report>"],
  "drift_findings": []
}
```

- [ ] **Step 1: Write the failing tests FIRST** (`tests/test_arc4_corpus_consistency.py`). Fixture corpora are tiny sqlite files built inline:

```python
# tests/test_arc4_corpus_consistency.py — the corpus answers for itself.
import json, sqlite3, subprocess
from pathlib import Path
from test_arc2_phase1_gates import git_env
ROOT = Path(__file__).resolve().parent.parent

COLS = ("rule_id, section, title_he, statement, bucket, rule_group, severity, mechanism, "
        "mechanism_target, source_path, source_heading, source_hash, revision_status, mirrored_at")

def _mirror(tmp_path, rows):
    db = tmp_path / "rules.sqlite"
    c = sqlite3.connect(db)
    c.execute(f"CREATE TABLE rule_revisions ({COLS})")
    for r in rows:
        c.execute(f"INSERT INTO rule_revisions ({COLS}) VALUES ({','.join('?'*14)})", r)
    c.commit(); c.close()
    return db

def _rule_row(rule_id, group="A", mechanism="stop", target="the final message"):
    return (rule_id, "11", "t", "s", "lesson", group, "high", mechanism, target,
            "docs/process/development-discipline.md", "h", "x", "current", "2026-08-11")

def _run(tmp_path, db, hooks_root, baseline):
    bp = tmp_path / "baseline.json"; bp.write_text(json.dumps(baseline), encoding="utf-8")
    return subprocess.run(["node", str(ROOT / "scripts" / "check-corpus-consistency.mjs"),
                           "--mirror", str(db), "--hooks-root", str(hooks_root),
                           "--baseline", str(bp)],
                          capture_output=True, text=True, encoding="utf-8",
                          cwd=str(ROOT), env=git_env())

def _hooks(tmp_path, rule_ids):
    d = tmp_path / "hooks" / "stop-rules"; d.mkdir(parents=True)
    for rid in rule_ids:
        (d / f"{rid.lower()}.mjs").write_text(f"export const RULE_ID = '{rid}';\n", encoding="utf-8")
    return tmp_path / "hooks"

EMPTY = {"unenforced_ab_rules": [], "ungrouped_rules": [], "unproven_rule_ids": [], "drift_findings": []}

def test_blocks_on_a_new_unenforced_ab_rule(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L900")])          # A-group, stop mechanism, no hook file
    r = _run(tmp_path, db, _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 1, r.stdout + r.stderr
    assert "L900" in r.stdout

def test_standing_debt_prints_but_does_not_block(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L900")])
    r = _run(tmp_path, db, _hooks(tmp_path, []), {**EMPTY, "unenforced_ab_rules": ["L900"]})
    assert r.returncode == 0, r.stdout
    assert "L900" in r.stdout                            # loud, per L40

def test_blocks_on_a_repaired_item_still_listed(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L900")])
    r = _run(tmp_path, db, _hooks(tmp_path, ["L900"]), {**EMPTY, "unenforced_ab_rules": ["L900"]})
    assert r.returncode == 1, r.stdout                   # repaired: remove it from the baseline
    assert "no longer reproduces" in r.stdout.lower() or "repaired" in r.stdout.lower()

def test_blocks_on_a_new_ungrouped_rule(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L901", group=None)])
    r = _run(tmp_path, db, _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 1 and "L901" in r.stdout

def test_c_group_rules_are_not_counted_as_unenforced(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L902", group="C", mechanism="none", target="")])
    r = _run(tmp_path, db, _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 0, r.stdout

def test_fails_open_on_a_missing_mirror(tmp_path):
    r = _run(tmp_path, tmp_path / "absent.sqlite", _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 0
    assert "could not decide" in r.stdout.lower()

def test_gate_reports_what_it_scanned(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L903", group="A", mechanism="stop")])
    r = _run(tmp_path, db, _hooks(tmp_path, ["L903"]), EMPTY)
    assert r.returncode == 0
    assert "1 rule" in r.stdout or "rules scanned: 1" in r.stdout  # never a bare OK over nothing
```

- [ ] **Step 2: Run, witness RED** (`node` cannot find the script → every test fails with the script-missing error, which is the intended reason). Paste. Run: `python -m pytest tests/test_arc4_corpus_consistency.py -v`

- [ ] **Step 3: Implement `scripts/check-corpus-consistency.mjs`.** Structure (copy `check-rules-classified.mjs`'s argv/undecided/python-sqlite scaffolding verbatim — it is the proven reference for mirror-reading gates):
  1. parse `--mirror` / `--hooks-root` / `--baseline` with the standard `arg()` helper; fail open (`undecided`) on unreadable mirror or baseline;
  2. read all `current` rows via spawned Python sqlite3 printing JSON;
  3. scan `<hooks-root>/**/*.mjs` for `RULE_ID = '...'` / `RULE_IDS = [...]` declarations, and `scripts/check-*.mjs` filenames, to build the resolution set for question 1;
  4. scan `tests/test_*wiring*.py` for asserted rule ids (question 3) — under `--hooks-root` fixtures this scan is rooted at the fixture too, so fixture tests stay hermetic;
  5. compute the four finding lists; diff each against its baseline array both directions; print `STANDING DEBT` / `NEW` / `REPAIRED BUT STILL LISTED` sections with counts; exit 1 iff NEW or REPAIRED-STILL-LISTED is non-empty.
  Header documents, in English: the four questions, the two non-questions, and why the baseline is bidirectional (L70 + R-119 history).

- [ ] **Step 4: GREEN on fixtures, paste.** Then the first REAL run: `node scripts/check-corpus-consistency.mjs` against the live repo. It will report findings and exit 1 (empty baseline). **This report is the arc's headline measurement — paste it in full in the task summary.**

- [ ] **Step 5: Freeze the baseline.** Copy the real run's finding lists into `docs/process/corpus-consistency-baseline.json` exactly (this is the deliberate grandfather moment — same discipline as `gate-baselines.json`: never silently extended later). Re-run; exit 0 with all standing debt printed. Paste. **If L84 has landed with a group by the time this runs, it simply won't appear — take the measurement as it is that day; do not pre-list items that no longer reproduce (the gate itself would block on that).**

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-corpus-consistency.mjs docs/process/corpus-consistency-baseline.json tests/test_arc4_corpus_consistency.py
git commit -m "feat(arc4, Task 8): check-corpus-consistency - the body of knowledge answers for itself, bidirectional baseline"
```

---

### Task 9: wiring + liveness + full suites + board

**Files:**
- Modify: `scripts/check-meta.mjs`
- Create: `tests/test_arc4_wiring.py`
- Modify: `docs/STATUS-BOARD.md`, `docs/ROADMAP-2026-07-30.md` (arc close rows)

**Interfaces:**
- Consumes: everything Tasks 1–8 produced.
- Produces: the arc's H9 table and closure evidence.

- [ ] **Step 1: Wire `check-corpus-consistency` into `check-meta.mjs`** via the standard `run()` seam, placed with the other rules-corpus gates (after line ~150, next to `check-rules-classified`): `run('check-corpus-consistency', 'check-corpus-consistency (the corpus answers for itself — enforcement resolution, grouping, reachability, drift)', 'check-corpus-consistency.mjs');` — BLOCKING, because its baseline already absorbs historical debt (the L70 hazard is handled by design, not by advisory status; advisory is how graphify's gate died).

- [ ] **Step 2: Liveness test** (`tests/test_arc4_wiring.py`) — the Phase-4 pattern (`tests/test_arc2_phase4_wiring.py`): run `node scripts/check-meta.mjs` with NO env overrides against the real tree and assert (a) exit 0, (b) the string `check-corpus-consistency` appears in its output — proving the gate runs in the real chain, not only under test env. Plus one negative liveness: with `META_SKIP_GATE=check-corpus-consistency` (or the meta script's actual skip mechanism — read it), the skip is PRINTED, not silent.

- [ ] **Step 3: Witness RED** (before Step 1's wiring lands, the liveness assertion (b) fails). Paste, then wire, then GREEN. Run: `python -m pytest tests/test_arc4_wiring.py -v`

- [ ] **Step 4: Full suites, serialized, idle machine (§11a):**
  1. `python -m pytest` — full, output pasted, exit code shown.
  2. `npx playwright test` — plain, no flags. The enforcement work touches no app code, so any UI failure is either pre-existing (systematic-debugging, never a shrug) or evidence this arc leaked into the product.
  3. `node scripts/check-meta.mjs` — green end-to-end.

- [ ] **Step 5: Arc close (per `docs/process/checklists/arc-close.md`):** lessons → §11 via the rules pipeline (which now re-runs the corpus gate on its own new rows — the first live exercise of Task 8); geniza ingest (`python scripts/ingest.py --scope`); STATUS-BOARD + roadmap ledger rows (each with a landing — Task 7 now enforces this for the very rows being added); H9 table in the final summary.

- [ ] **Step 6: Commit.**

```bash
git add scripts/check-meta.mjs tests/test_arc4_wiring.py docs/STATUS-BOARD.md docs/ROADMAP-2026-07-30.md
git commit -m "feat(arc4, Task 9): wire check-corpus-consistency into check-meta; liveness proven; full suites green"
```

---

## Self-Review (performed at plan time)

- **Spec coverage:** brief item (a) — no work planned, per instruction (L84 excluded, Task 8 tolerates it). (b) seven gates → Tasks 1–4, grouped by inspection target (tree-scanning ×2 tasks, external-state ×2 tasks). (c) three lib helpers → Task 5; two observers → Task 6. (d) whole-corpus → Task 8 (all four cross-cutting questions mapped; the doc-drift question deliberately narrowed to decidable probes, stated as scope in the gate header). (e) R-140 + sibling audit → Task 7. Wiring/liveness/suites → Task 9.
- **Placeholder scan:** one intentional open point remains — fixture strings marked `<the real ... shape>` in Tasks 3/4/7 are captured from live runs during the task's own Step 1, which is a TDD measurement step, not a deferral; the plan says exactly how to capture each.
- **Type consistency:** `run_gate(script, *args)` / `git_env()` used identically throughout; the `--root`/`--mirror`/`--baseline` argv shape is the single `arg()` convention from `check-rules-classified.mjs`; baseline JSON keys in Task 8's schema match the test fixtures' `EMPTY` dict.
