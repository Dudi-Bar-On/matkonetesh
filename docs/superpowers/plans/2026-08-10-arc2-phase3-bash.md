# Arc 2 Phase 3 — `pretooluse:Bash` Enforcement (8 rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 8 `pretooluse:Bash` rules of the approved Arc-2 spec — `10.12a` `L10` `L18` `L32` `L39` `L51a` `L55a` `L73` — with zero false alarms on legitimate work across the real 6,338-command Bash corpus.

> **L36a is DEFERRED to Arc 3 (owner decision, 2026-08-10, registered R-124), not forgotten:** the measured PostToolUse contract shows a failing, unpiped Bash command reaches the hook with **no output text at all** (`PostToolUseFailure` carries only `error: "Exit code N"`), so the page-closed string it keys on is structurally invisible — a rule covering only the piped shape would silently handle some cases, the inert-rule failure in soft form. Trigger anchor: reopen when an evidence channel can see a failed command's output.

**Architecture:** Every rule matches against **command position only** — one shared stripping helper in `scripts/hooks/lib/bash-segments.mjs` removes heredoc bodies, quoted strings, and `#` comments before any rule pattern runs, because the measurement (`docs/analysis/2026-08-10-phase3-bash-corpus-measurement.txt`) proved the dominant false-alarm source across the rules is prose *describing* a rule quoted inside `echo`/heredocs. The helper takes per-rule keep-options (one helper, options — not a second helper): L51a and L39's real signal lives INSIDE quotes, per the coordinator's prepended correction to the measurement file — **read that correction; the L51a "0 in-command" column is not evidence.** All 8 rules are stateless Group A. False-alarm tests replay the REAL corpus through a single-process node harness, never invented input.

**Tech Stack:** Node ESM hooks (`scripts/hooks/`), pytest driving the real CLI as a subprocess (Phase-2 pattern, `tests/test_arc2_phase2_rules.py`).

## Global Constraints

Copied from the approved spec `docs/superpowers/specs/2026-08-09-arc2-enforcement-implementation-design.md` and the coordinator's resolutions (2026-08-10). §4 forbids waiving any of these.

- **Spec §3.1:** every rule ships a catch test AND a false-alarm test; the false-alarm test runs against **real history**, not invented input. "כלל בלי בדיקת התרעת-שווא אינו נחשב ממומש."
- **Spec §3.2 / §10.24:** severity chosen PER RULE, argued in a code comment — warn if the harm is to efficiency, block if to substance or to an action with no equivalent alternative. **Every block names a reachable alternative. NEVER a bypass mechanism.**
- **Spec §3.3:** every rule file exports `RULE_IDS`. Post-R-120: **every rule declares `TOOLS = ['Bash']`** and must satisfy the EXISTING `tests/test_hook_tool_scope.py` (auto-discovers every rule file, drives it with every undeclared tool, requires `allow`) — do not rewrite that test, just pass it.
- **Spec §3.4:** one liveness test for the phase runs the real CLI with **NO environment overrides at all**.
- **Spec §3.5:** overhead measured per phase (baseline 61ms Phase-4 worst; current PreToolUse 75ms median / ~85ms worst). Final task re-runs `tests/test_arc2_phase2_wiring.py`'s spread test (fails if any tool type costs 4x the fastest) and the overhead test, numbers pasted.
- **Spec §5.3, coordinator-confirmed reading:** **0 false alarms = zero fires on LEGITIMATE work.** A corpus replay firing on genuine historical violations (the ~154 real `--retries` runs, the ~154 real edit+commit calls — the rules exist because of them) is the rule proving it works. Prose shapes are pinned as verbatim allow-tests; every task's report samples and classifies every fire. Spec §6 still stands: one fire on legitimate work stops the phase.
- **Spec §5.6:** `npx playwright test` and `pytest` clean at phase end.
- **DoD (CLAUDE.md §3):** RED witnessed before GREEN for every test; outputs pasted into task reports.
- **Coordinator requirement (L73):** must `allow` the owner's heredoc-commit-message style (`git commit -q -F - -- <paths> <<'MSG' … MSG` — the heredoc is the commit MESSAGE, not a content edit; it runs ~20x/day). Verified BOTH ways: a verbatim-shape allow-test AND a corpus scan asserting real `-F -` heredoc commits exist in the dump and none fires. **If that cannot pass, STOP and tell the coordinator before writing the rest of the rule.**
- **Coordinator requirement (L18):** PID-targeted kills allow (the §11a protocol); image-name/pkill-pattern kills of suite processes block; the "verify port refuses + 0 orphans" half is a cross-call sequence a single PreToolUse call cannot check — **stated as a limitation in the rule's own comment** so the next reader does not assume it is enforced.
- **Coordinator approval (Task 1):** refactoring `no-concurrent-suite-run.mjs` onto the shared detector is approved; **behaviour must be identical and its existing tests must pass unchanged** — an explicit verification step, not an assumption.
- **Banned in this plan (each shipped a dead rule before):** any regex containing `[^)]*`-style classes that cannot cross a delimiter it must cross; helpers assumed rather than read; "similar to Task N"; placeholders. Every load-bearing regex is shown matching its own fixture.
- Work on `main`, no worktrees (§9). Suite runs serialized, never concurrent (§11a).

## Interfaces verified against source (read during planning, 2026-08-10)

- `scripts/hooks/lib/bash-segments.mjs` exports `SEGMENT_SPLIT`, `segments(command)` (splits on `&&`,`||`,`;`,newline **and single `|`**), `tokenize(seg)` (whitespace tokens, whole-token matching-quote unwrap). It does **NOT** yet strip heredocs/quotes/comments — Task 1 adds that.
- `.claude/settings.json`: PreToolUse matcher already includes `Bash` — no wiring change needed anywhere in this phase.
- `tests/test_arc2_phase2_rules.py` helpers `run_pretooluse`, `decision_of`, `reason_of`, `ROOT`. Its `payload()` builds `tool_input.file_path` — **what changed for Phase 3:** the new file `tests/test_arc2_phase3_rules.py` defines its own `bash_payload()` that puts the command at `tool_input.command` (Phase 2's `payload()` is untouched).
- `scripts/hooks/posttooluse.mjs` measured contract (relevant here only as L36a's deferral evidence, quoted in the header note above).
- `requirements-overrides.txt` exists at repo root; pins are lines like `neo4j==6.2.0` with reasons in comments (read directly).

## File structure

- Modify `scripts/hooks/lib/bash-segments.mjs` — add `stripDataRegions`, `statements`, `pipelineStages`, `playwrightTestTokens` (Task 1).
- Modify `scripts/hooks/rules/no-concurrent-suite-run.mjs` — replace its private duplicate splitter/detector with the lib imports (Task 1; R-116: one splitter, all callers import it; coordinator-approved).
- Modify `scripts/tests/measure-bash-corpus.py` — add `--dump` mode (Task 2).
- Create `scripts/tests/replay-bash-corpus.mjs` — single-process corpus replay of one rule module (Task 2).
- Create `tests/test_arc2_phase3_rules.py` — all Phase-3 per-rule tests + helpers (Tasks 1–7).
- Create rule files (Tasks 3–7): `scripts/hooks/rules/playwright-plain-run.mjs` (L10), `pipe-exit-code-read.mjs` (L32), `key-echo-guard.mjs` (L39), `wsl-sudo-noninteractive.mjs` (L51a), `pip-no-deps-pinned.mjs` (L55a), `nested-claude-neutral-cwd.mjs` (10.12a), `suite-kill-protocol.mjs` (L18), `edit-commit-separation.mjs` (L73).
- Create `tests/test_arc2_phase3_wiring.py` — liveness (no env), coverage, overhead (Task 8).
- Modify `docs/process/rule-coverage-baseline.json` — add the 8 ids (Task 8).

## Severity decisions (argued in full in each rule's header comment)

| Rule | Severity | Why | Reachable alternative named in the reason |
|---|---|---|---|
| L10 | block | masked flakiness is substance (a flake is a bug; DoD-12 forbids the flags) | run `npx playwright test` plain; debug the flake via systematic-debugging |
| L18 | block | an image-name kill of node killed workers, respawned a zombie, wedged 8123 for hours — substance | identify the primary PID, `taskkill //PID <pid> //T //F`, verify port refuses + 0 orphans (§11a) |
| L32 | warn | the command still does its work; the harm is a misread measurement (efficiency/evidence quality) | capture `$?` immediately after the real command; redirect to a file first if output needs trimming |
| L39 | block | a printed key is unrecoverable — substance, secrets | read the key into the process and use it; never print it (`[Environment]::GetEnvironmentVariable(...,'User')` pattern quoted) |
| L51a | block | fails silently, indistinguishable from doing nothing — no equivalent outcome exists | `wsl -u root <command>` — Windows user already authenticated |
| L55a | block | an undocumented resolver bypass is a decision pip silently undoes later — substance | add the pin + reason to `requirements-overrides.txt`, or drop `--no-deps` |
| L73 | block | the whole call vanishes when any gate blocks it — the write is silently lost (the exact 8.8.26 incident) | write in one Bash call, verify from disk, commit in a separate call; heredoc commit **messages** stay fine |
| 10.12a | block | a nested `claude -p` inside the repo stops being an extractor (measured: 0/3 docs, 60 invented nodes) | `cd <absolute neutral dir outside the repo>` first in the same call, with absolute paths — the rule itself recognizes that shape and allows it |

---

### Task 1: Shared command-position helpers in `bash-segments.mjs`

**Files:**
- Modify: `scripts/hooks/lib/bash-segments.mjs`
- Modify: `scripts/hooks/rules/no-concurrent-suite-run.mjs`
- Create: `tests/test_arc2_phase3_rules.py` (helpers + lib tests)

**Interfaces:**
- Consumes: existing `segments`/`tokenize` (unchanged, existing callers untouched).
- Produces (every later task relies on these exact names):
  - `stripDataRegions(command, {keepSingleQuoted?=false, keepDoubleQuoted?=false}) -> string` — heredoc bodies, quoted strings (per options), and `#` comments replaced by a single space each. Ports the measurement script's regexes **exactly**, so the measured noise numbers stay valid. The keep-options ARE the coordinator-confirmed per-rule stripping profiles: one helper, options — not a second helper.
  - `statements(command) -> string[]` — split on `&&`,`||`,`;`,newline but **NOT** single `|` (unlike `segments()`), so pipeline structure survives.
  - `pipelineStages(statement) -> string[]` — split one statement on single `|`.
  - `playwrightTestTokens(tokens) -> string[]|null` — `null` when the token list is not a `playwright test` invocation; else its argument tokens, cut at the first `|`/redirect token.

- [ ] **Step 1: Write the failing lib tests** — create `tests/test_arc2_phase3_rules.py`:

```python
# tests/test_arc2_phase3_rules.py — Arc 2 Phase 3: pretooluse:Bash rules (8; L36a deferred to
# Arc 3, R-124). Per-rule catch + false-alarm tests; false alarms replayed against the REAL
# 6,338-command corpus (scripts/tests/measure-bash-corpus.py --dump + replay-bash-corpus.mjs),
# never invented input.
import json
import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "scripts" / "hooks" / "rules"


def run_pretooluse(payload, env_extra=None, tmp_path=None):
    """Spawns the real PreToolUse entry point with `payload` on stdin (same helper as Phase 2)."""
    env = {**os.environ, **(env_extra or {})}
    if tmp_path is not None and "PRETOOLUSE_LOG_PATH" not in env:
        env["PRETOOLUSE_LOG_PATH"] = str(tmp_path / "hooks-log.jsonl")
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, f"pretooluse.mjs must always exit 0:\n{r.stdout}\n{r.stderr}"
    return json.loads(r.stdout) if r.stdout.strip() else {}


def decision_of(out):
    h = out.get("hookSpecificOutput", {})
    if h.get("permissionDecision") == "deny":
        return "block"
    if h.get("permissionDecision") == "allow" and out.get("systemMessage"):
        return "warn"
    return "allow"


def reason_of(out):
    return out.get("hookSpecificOutput", {}).get("permissionDecisionReason", "") \
        or out.get("systemMessage", "")


def bash_payload(command, *, session="s-phase3-test"):
    """WHAT CHANGED vs Phase 2's payload(): a Bash payload carries the command at
    tool_input.command, not tool_input.file_path. Phase 2's helper is untouched."""
    return {"session_id": session, "hook_event_name": "PreToolUse", "tool_name": "Bash",
            "cwd": str(ROOT), "tool_input": {"command": command}}


def node_eval(expr, env_extra=None):
    """Evaluates a JS expression against the shared lib in one node process."""
    lib = (ROOT / "scripts/hooks/lib/bash-segments.mjs").as_posix()
    src = f"import * as L from 'file://{lib}'; console.log(JSON.stringify({expr}));"
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                       env={**os.environ, **(env_extra or {})})
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


# ---------------------------------------------------------------- Task 1: shared helpers

def test_strip_removes_heredoc_body_but_keeps_command_position():
    cmd = ("git add docs/x.md && git commit -q -F - -- docs/x.md <<'MSG'\n"
           "docs: cat >> the-file.md then git commit — prose describing L73\n"
           "MSG")
    out = node_eval(f"L.stripDataRegions({json.dumps(cmd)})")
    assert "cat >>" not in out            # heredoc body gone
    assert "git commit -q -F -" in out    # command position intact


def test_strip_removes_quotes_and_comments():
    cmd = "echo \"do NOT kill it — §11a/L18\" # taskkill note\ntaskkill //PID 42 //F"
    out = node_eval(f"L.stripDataRegions({json.dumps(cmd)})")
    assert "do NOT kill" not in out and "taskkill note" not in out
    assert "taskkill //PID 42 //F" in out


def test_strip_keep_options():
    """The coordinator-confirmed profiles: keepDoubleQuoted for L39 ($VAR expands inside "...")
    and keepSingleQuoted+keepDoubleQuoted for L51a (the wsl command lives inside quotes)."""
    cmd = "echo \"KEY=$GEMINI_API_KEY\" 'literal $SECRET'"
    kept = node_eval(f"L.stripDataRegions({json.dumps(cmd)}, {{keepDoubleQuoted: true}})")
    assert "$GEMINI_API_KEY" in kept      # double-quoted content kept (it EXPANDS in a shell)
    assert "$SECRET" not in kept          # single-quoted content stripped (it does not)


def test_statements_preserve_pipes_segments_do_not():
    cmd = "npx playwright test 2>&1 | tail -5; echo done"
    sts = node_eval(f"L.statements({json.dumps(cmd)})")
    assert sts == ["npx playwright test 2>&1 | tail -5", "echo done"]
    stages = node_eval(f"L.pipelineStages({json.dumps(sts[0])})")
    assert stages == ["npx playwright test 2>&1", "tail -5"]


def test_playwright_test_tokens():
    full = node_eval("L.playwrightTestTokens(L.tokenize('npx playwright test --reporter=line 2>&1 | tail -20'))")
    assert full == ["--reporter=line"]     # cut at the redirect/pipe boundary
    assert node_eval("L.playwrightTestTokens(L.tokenize('npm test'))") == []
    assert node_eval("L.playwrightTestTokens(L.tokenize('git commit -m x'))") is None
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -v`
Expected: FAIL — `stripDataRegions` etc. are not exported (node stderr: "does not provide an export named 'stripDataRegions'"). Paste output.

- [ ] **Step 3: Implement** — append to `scripts/hooks/lib/bash-segments.mjs`:

```js
// ------------------------------------------------------------------------------------------------
// Arc 2 Phase 3 additions. The 2026-08-10 corpus measurement (docs/analysis/
// 2026-08-10-phase3-bash-corpus-measurement.txt, 6,338 real Bash commands) proved the dominant
// false-alarm source for EVERY Bash rule is prose that DESCRIBES a rule, quoted inside an echo or
// a heredoc ("botulism kill-temps", "plain — no --retries"). So Bash rules match against COMMAND
// POSITION ONLY: these helpers reduce a command to what a shell would actually execute. The three
// data-region regexes are EXACT ports of scripts/tests/measure-bash-corpus.py's HEREDOC/SQ/DQ/
// COMMENT — the measured noise-removal numbers are only valid for these shapes.
// Only String.replace() is used with the /g regexes below (replace resets lastIndex; the Phase-2
// /g+exec lastIndex hazard does not apply here).
const HEREDOC_BODY = /<<-?\s*'?"?(\w+)'?"?\n[\s\S]*?\n\1/g;
const SINGLE_QUOTED = /'[^']*'/g;
const DOUBLE_QUOTED = /"[^"]*"/g;
const HASH_COMMENT = /(^|\s)#[^\n]*/g; // no /m — matches the measurement script (^ = string start)

// keepSingleQuoted / keepDoubleQuoted exist because "data region" is PER-RULE, not universal
// (coordinator-confirmed 2026-08-10, incl. the correction prepended to the measurement file):
//  - L39 must KEEP double-quoted content ($VAR expands inside "..." — `echo "$GEMINI_API_KEY"`
//    prints the key) while still dropping single-quoted content (no expansion, `'$KEY'` is inert).
//  - L51a must keep BOTH: `wsl -e bash -lc 'sudo …'` carries its real command inside quotes —
//    the blanket strip REMOVED that signal, which is why the raw measurement showed 0 in-command.
// Every other Phase-3 rule uses the default full strip, which is what the corpus was measured with.
export function stripDataRegions(command, { keepSingleQuoted = false, keepDoubleQuoted = false } = {}) {
  let s = command.replace(HEREDOC_BODY, ' ');
  if (!keepSingleQuoted) s = s.replace(SINGLE_QUOTED, ' ');
  if (!keepDoubleQuoted) s = s.replace(DOUBLE_QUOTED, ' ');
  return s.replace(HASH_COMMENT, ' ');
}

// statements() vs segments(): segments() (above) also splits on single `|`, which destroys
// pipeline structure — correct for "what is the leading command word of each piece", wrong for
// L32 ("did $? get read after a pipe into a filter?"). statements() keeps each pipeline whole.
export const STATEMENT_SPLIT = /(?:&&|\|\||[;\n])/g;
export function statements(command) {
  return command.split(STATEMENT_SPLIT).map((s) => s.trim()).filter(Boolean);
}
export function pipelineStages(statement) {
  return statement.split(/\|(?!\|)/).map((s) => s.trim()).filter(Boolean);
}

// Moved here from no-concurrent-suite-run.mjs (which now imports it) so L10 does not become the
// third drifting copy — the exact hazard R-116/this file's header names. Coordinator-approved.
// Returns null when `tokens` is not a `playwright test` invocation; else the invocation's own
// argument tokens, cut at the first pipe/redirect token (args after `| tail` belong to tail).
const KNOWN_TEST_SCRIPTS = new Set(['test', 'test:full', 'test:visual', 'test:a11y']);
function cutAtBoundary(args) {
  const stop = args.findIndex((t) => t === '|' || t.startsWith('>') || t.startsWith('2>') || t === '<');
  return stop === -1 ? args : args.slice(0, stop);
}
export function playwrightTestTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const [a, b, c] = tokens;
  if (a === 'playwright' && b === 'test') return cutAtBoundary(tokens.slice(2));
  if (a === 'npx' && b === 'playwright' && c === 'test') return cutAtBoundary(tokens.slice(3));
  if (a === 'npm' && b === 'test') return [];
  if (a === 'npm' && b === 'run' && KNOWN_TEST_SCRIPTS.has(c)) return [];
  return null;
}
```

- [ ] **Step 4: Refactor `no-concurrent-suite-run.mjs`** (coordinator-approved) — delete its private `SEGMENT_SPLIT`, `segments`, `tokenize`, `KNOWN_TEST_SCRIPTS`, and `isPlaywrightTestInvocation` definitions; add the import and replace the trigger line. The two changed regions, exactly:

```js
import net from 'node:net';
import { segments, tokenize, playwrightTestTokens } from '../lib/bash-segments.mjs';
```

```js
  const triggers = segments(command).some((seg) => playwrightTestTokens(tokenize(seg)) !== null);
```

Behavior is identical: `playwrightTestTokens(...) !== null` is true for exactly the four shapes the old boolean recognized. Nothing else in the file changes.

- [ ] **Step 5: Verify the refactor changed NO behaviour** (explicit step, per the coordinator's approval terms)

Run: `pytest tests/test_arc2_phase3_rules.py tests/test_hook_tool_scope.py -v` — expected: PASS.
Then run the FULL `pytest` (all 223+): the refactored rule's own pre-existing tests must pass **unchanged — zero edits to any existing test file**. Confirm with `git status` that no test file outside `tests/test_arc2_phase3_rules.py` is modified. Paste both outputs.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/lib/bash-segments.mjs scripts/hooks/rules/no-concurrent-suite-run.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 1): command-position helpers — strip data regions, keep pipelines whole"
```

---

### Task 2: Real-corpus replay harness

**Files:**
- Modify: `scripts/tests/measure-bash-corpus.py` (add `--dump`)
- Create: `scripts/tests/replay-bash-corpus.mjs`
- Modify: `tests/test_arc2_phase3_rules.py` (corpus fixture + `replay()` helper)

**Interfaces:**
- Produces: `python scripts/tests/measure-bash-corpus.py --dump <out.jsonl>` writes one `{"command": ...}` JSON line per real Bash command; `node scripts/tests/replay-bash-corpus.mjs <rule.mjs> <dump.jsonl>` prints `{"total": N, "fireCount": N, "fires": [{command, decision, reason}...]}` (fires sampled to 200). Pytest helpers `corpus_dump` (module-scoped fixture), `corpus_commands(dump)` (iterates the dumped commands), and `replay(rule_file, dump, env_extra=None)`.

- [ ] **Step 1: Write the failing test** — append to `tests/test_arc2_phase3_rules.py`:

```python
# ---------------------------------------------------------------- Task 2: corpus replay harness

@pytest.fixture(scope="module")
def corpus_dump(tmp_path_factory):
    """The REAL corpus (spec §3.1: false alarms measured against real history, never invented
    input), dumped once per test module via the measurement script's own extractor."""
    dump = tmp_path_factory.mktemp("corpus") / "commands.jsonl"
    r = subprocess.run(["python", str(ROOT / "scripts" / "tests" / "measure-bash-corpus.py"),
                        "--dump", str(dump)],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr
    assert dump.exists() and dump.stat().st_size > 0, \
        "corpus dump is EMPTY — every replay test would examine NOTHING"
    return dump


def corpus_commands(dump):
    """Iterates the real commands in a dump file (for tests that scan the corpus directly)."""
    with dump.open(encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)["command"]


def replay(rule_file, dump, env_extra=None):
    """Replays every corpus command through ONE rule module's evaluate() in a single node
    process (6,338 CLI spawns would take ~8 minutes; one import + a loop takes seconds)."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "tests" / "replay-bash-corpus.mjs"),
                        str(RULES / rule_file), str(dump)],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                       env={**os.environ, **(env_extra or {})})
    assert r.returncode == 0, r.stderr
    out = json.loads(r.stdout)
    assert out["total"] > 5000, f"replay saw only {out['total']} commands — corpus incomplete"
    return out


def test_replay_harness_runs_an_existing_rule(corpus_dump):
    """Harness self-test against a rule that is already live and known-quiet on plain commands:
    main-only-no-worktrees blocks only worktree/branch operations."""
    out = replay("main-only-no-worktrees.mjs", corpus_dump)
    assert out["total"] > 5000
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -k replay_harness -v`
Expected: FAIL — `measure-bash-corpus.py --dump` exits nonzero / replay script missing. Paste output.

- [ ] **Step 3: Implement the `--dump` mode** — in `scripts/tests/measure-bash-corpus.py`, add `import sys` to the imports, and insert **immediately after the `commands()` function definition** (before `total = 0`):

```python
# --dump <out.jsonl>: write every real Bash command as one JSON line, for the Phase-3 replay
# harness (scripts/tests/replay-bash-corpus.mjs). Same extractor, zero duplication.
if len(sys.argv) == 3 and sys.argv[1] == "--dump":
    out_path = pathlib.Path(sys.argv[2])
    n = 0
    with out_path.open("w", encoding="utf-8") as fh:
        for cmd in commands():
            fh.write(json.dumps({"command": cmd}) + "\n")
            n += 1
    print(f"dumped {n} commands to {out_path}")
    sys.exit(0)
```

- [ ] **Step 4: Implement the replayer** — create `scripts/tests/replay-bash-corpus.mjs`:

```js
#!/usr/bin/env node
// scripts/tests/replay-bash-corpus.mjs — replays every REAL Bash command from a --dump file
// through ONE rule module's evaluate(), in one process. This is the mechanized form of the
// spec's §3.1 false-alarm bar: a Phase-3 rule is measured against the 6,338 commands this
// project actually ran, not against invented fixtures.
//   node scripts/tests/replay-bash-corpus.mjs <rule-file.mjs> <commands.jsonl>
// stdout: {"total": N, "fireCount": N, "fires": [{command, decision, reason} ... up to 200]}
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [rulePath, dumpPath] = process.argv.slice(2);
if (!rulePath || !dumpPath) {
  console.error('usage: replay-bash-corpus.mjs <rule-file.mjs> <commands.jsonl>');
  process.exit(2);
}
const mod = await import(pathToFileURL(rulePath).href);
if (typeof mod.evaluate !== 'function') {
  console.error(`${rulePath} exports no evaluate()`);
  process.exit(2);
}
const lines = readFileSync(dumpPath, 'utf8').split('\n').filter(Boolean);
let total = 0;
let fireCount = 0;
const fires = [];
for (const line of lines) {
  let cmd;
  try { cmd = JSON.parse(line).command; } catch { continue; }
  if (typeof cmd !== 'string') continue;
  total += 1;
  const out = await mod.evaluate({
    session_id: 's-corpus-replay',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    cwd: process.cwd(),
    tool_input: { command: cmd },
  });
  if (out && typeof out.decision === 'string' && out.decision !== 'allow') {
    fireCount += 1;
    if (fires.length < 200) {
      fires.push({
        command: cmd.slice(0, 300),
        decision: out.decision,
        reason: String(out.reason ?? '').slice(0, 200),
      });
    }
  }
}
process.stdout.write(JSON.stringify({ total, fireCount, fires }));
```

- [ ] **Step 5: Run to verify GREEN**

Run: `pytest tests/test_arc2_phase3_rules.py -k replay_harness -v`
Expected: PASS (total > 5000). Paste output, including the total.

- [ ] **Step 6: Commit**

```bash
git add scripts/tests/measure-bash-corpus.py scripts/tests/replay-bash-corpus.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 2): real-corpus replay harness — dump + single-process rule replay"
```

---

### Task 3: L10 — `playwright test` runs plain, never `--workers`/`--retries`

**Files:**
- Create: `scripts/hooks/rules/playwright-plain-run.mjs`
- Modify: `tests/test_arc2_phase3_rules.py`

**Interfaces:**
- Consumes: `statements`, `tokenize`, `stripDataRegions`, `playwrightTestTokens` from `../lib/bash-segments.mjs` (Task 1 signatures).
- Produces: rule file exporting `TOOLS = ['Bash']`, `RULE_IDS = ['L10']`, `evaluate(input)`.

- [ ] **Step 1: Write the failing tests** — append:

```python
# ---------------------------------------------------------------- Task 3: L10

def test_L10_blocks_a_retries_override(tmp_path):
    # Verbatim from the corpus's surviving candidates (the measurement file, L10 section).
    out = run_pretooluse(bash_payload(
        "npx playwright test --retries=2 --reporter=line 2>&1 | tail -20"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "L10" in reason_of(out) and "plain" in reason_of(out)   # reachable alternative named


def test_L10_blocks_a_workers_override(tmp_path):
    out = run_pretooluse(bash_payload("npx playwright test --workers=1"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out


def test_L10_allows_the_plain_run_and_the_quoted_rule_text(tmp_path):
    out = run_pretooluse(bash_payload("npx playwright test 2>&1 | tail -5"), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
    # The EXACT noise shape the measurement found (context line: quoting DoD-12 inside an echo):
    out2 = run_pretooluse(bash_payload(
        'echo "$ npx playwright test          # plain — no --retries, no --workers=1"'),
        tmp_path=tmp_path)
    assert decision_of(out2) == "allow", out2


def test_L10_corpus_replay(corpus_dump):
    """Real history contains ~154 GENUINE override runs (they predate L10 — the rule was written
    because of them). Those are true positives, not false alarms (coordinator-confirmed reading).
    Bar: every fire's reason names the offending flag, and no fire lands on a command where the
    flag exists only inside stripped prose (the verbatim noise shape above + sample inspection)."""
    out = replay("playwright-plain-run.mjs", corpus_dump)
    assert out["fireCount"] > 0, "history's known --retries runs did not fire — the rule is inert"
    for f in out["fires"]:
        assert "--retries" in f["reason"] or "--workers" in f["reason"], f
    assert not any("no --retries, no --workers=1" in f["command"] for f in out["fires"])
    print(f"\nL10 corpus fires: {out['fireCount']} / {out['total']} (inspect samples in report)")
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -k L10 -v`
Expected: FAIL — `test_L10_blocks_a_retries_override` gets `allow` (rule file does not exist). Paste output.

- [ ] **Step 3: Implement** — create `scripts/hooks/rules/playwright-plain-run.mjs`:

```js
// scripts/hooks/rules/playwright-plain-run.mjs — L10. `--workers=1 --retries=2` once ran the
// suite serially (13 min) AND masked flakiness: command-line overrides fought the config's
// fullyParallel/retries:0 intent. DoD-12 says it outright: run `npx playwright test` plain,
// NEVER pass --retries or --workers; a flake is a bug to debug, not to retry away.
//
// SEVERITY: block, argued (spec §3.2): the harm is to SUBSTANCE — a retried-green suite is
// false evidence, and false evidence about test health is the exact disease DoD-12 exists to
// prevent. Reachable alternative (§10.24), named in the reason: run the suite plain; if it
// flakes, that flake is debugged via systematic-debugging. Config-level worker changes go
// through L21's owner-decision gate on playwright.config.ts, not through CLI flags.
//
// FALSE-ALARM DESIGN (the measurement's decisive finding): the flags are matched ONLY in
// command position — stripDataRegions() removes echo'd/heredoc'd prose first, which is 100%
// of what separated 157 raw hits from 154 real ones.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L10'];

import { statements, tokenize, stripDataRegions, playwrightTestTokens } from '../lib/bash-segments.mjs';

const OVERRIDE_FLAG = /^--(workers|retries)(=|$)/;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (playwrightTestTokens(tokens) === null) continue;
    const offending = tokens.filter((t) => OVERRIDE_FLAG.test(t));
    if (offending.length > 0) {
      return {
        decision: 'block',
        reason: `L10: \`${offending.join(' ')}\` overrides the config's fullyParallel/retries:0 `
          + 'intent — the last time, it ran the suite serially (13 min) AND masked flakiness as '
          + 'green. Run the suite plain instead: `npx playwright test` (DoD-12). A flake it '
          + 'surfaces is a bug — debug it via systematic-debugging, never retry it away.',
      };
    }
  }
  return { decision: 'allow', reason: 'no workers/retries override on a playwright test invocation' };
}
```

- [ ] **Step 4: Prove the flag regex against its own fixture**

Run: `node -e "console.log(/^--(workers|retries)(=|$)/.test('--retries=2'), /^--(workers|retries)(=|$)/.test('--workers=1'), /^--(workers|retries)(=|$)/.test('--reporter=line'))"`
Expected: `true true false`

- [ ] **Step 5: Run to verify GREEN**

Run: `pytest tests/test_arc2_phase3_rules.py -k L10 -v`
Expected: PASS, with the corpus fire count printed. Paste output; inspect 5 fire samples by hand and quote them in the task report.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/rules/playwright-plain-run.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 3): L10 — playwright runs plain, workers/retries overrides blocked"
```

---

### Task 4: L32 (warn: `$?` read through a pipe) + L39 (block: printing a key)

**Files:**
- Create: `scripts/hooks/rules/pipe-exit-code-read.mjs`
- Create: `scripts/hooks/rules/key-echo-guard.mjs`
- Modify: `tests/test_arc2_phase3_rules.py`

**Interfaces:**
- Consumes: `statements`, `pipelineStages`, `tokenize`, `stripDataRegions` (Task 1).
- Produces: two rule files, `RULE_IDS = ['L32']` and `RULE_IDS = ['L39']`, both `TOOLS = ['Bash']`.

- [ ] **Step 1: Write the failing tests** — append:

```python
# ---------------------------------------------------------------- Task 4: L32 + L39

def test_L32_warns_on_exit_code_read_after_a_filter_pipe(tmp_path):
    # Verbatim survivor shape from the corpus (wrangler deploy | tail; ec=$?).
    out = run_pretooluse(bash_payload("npx wrangler deploy 2>&1 | tail -12; ec=$?; echo done"),
                         tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "L32" in reason_of(out) and "$?" in reason_of(out)


def test_L32_stays_quiet_on_the_correct_pattern(tmp_path):
    # The rule's own alternative: capture immediately, no pipe in between.
    out = run_pretooluse(bash_payload(
        "npx wrangler deploy > /tmp/deploy.log 2>&1; ec=$?; tail -12 /tmp/deploy.log; echo $ec"),
        tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L32_corpus_replay(corpus_dump):
    """~15 in-command hits in history are the GENUINE mistake (made twice more after writing the
    rule down). True positives. Bar: every fire names L32 and warns, never blocks."""
    out = replay("pipe-exit-code-read.mjs", corpus_dump)
    for f in out["fires"]:
        assert "L32" in f["reason"], f
        assert f["decision"] == "warn", f
    print(f"\nL32 corpus fires: {out['fireCount']} / {out['total']}")


def test_L39_blocks_echoing_a_key_variable(tmp_path):
    out = run_pretooluse(bash_payload('echo "GEMINI_API_KEY=$GEMINI_API_KEY"'), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "L39" in reason_of(out)
    out2 = run_pretooluse(bash_payload("printenv GEMINI_API_KEY"), tmp_path=tmp_path)
    assert decision_of(out2) == "block", out2


def test_L39_allows_key_shaped_prose_and_inert_singles(tmp_path):
    # Corpus noise shapes: the word "token"/"KEY" in prose, grep for TOKEN, single-quoted $ (inert).
    for cmd in ['echo "=== residual scan: the 10 token names across ALL Hebrew-source .py"',
                "grep -E 'API_KEY|TOKEN' app.js | head -3",
                "echo 'the literal string $GEMINI_API_KEY is never expanded here'"]:
        out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
        assert decision_of(out) == "allow", (cmd, out)


def test_L39_corpus_replay(corpus_dump):
    out = replay("key-echo-guard.mjs", corpus_dump)
    for f in out["fires"]:
        assert "L39" in f["reason"], f
    # The measurement found at most ONE surviving candidate; more than a handful of fires means
    # the pattern grew past its measured surface — stop and inspect (spec §6).
    assert out["fireCount"] <= 5, out["fires"]
    print(f"\nL39 corpus fires: {out['fireCount']} / {out['total']}")
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -k "L32 or L39" -v`
Expected: FAIL — both catch tests get `allow` (rule files missing). Paste output.

- [ ] **Step 3: Implement L32** — create `scripts/hooks/rules/pipe-exit-code-read.mjs`:

```js
// scripts/hooks/rules/pipe-exit-code-read.mjs — L32. `cmd | head; ec=$?` captures the exit code
// of HEAD (always 0), never the real command — a mistake made twice more after being written
// down, once by the controller minutes after writing the rule (2026-07-31).
//
// SEVERITY: warn, argued (spec §3.2): the command still performs its real work — the harm is a
// MISREAD MEASUREMENT afterwards, i.e. evidence quality, not the action itself; and there are
// legitimate compounds where $? genuinely refers to the last pipeline. The warn text carries the
// correction, which is all the incident ever needed. Alternative named: capture `$?` immediately
// after the command that matters; redirect to a file first if the output needs trimming.
//
// DETECTION: on full-stripped statements (heredocs/quotes/comments gone — the corpus's L32 noise
// was prose), a statement whose pipeline ends in a pure filter (head/tail/grep — the measured
// set) followed by a statement reading `$?`. The quoted form `echo "EXIT=$?"` is stripped and
// deliberately NOT caught — the corpus's real mistakes all assign unquoted (`ec=$?`), and
// widening past the measured shape is how false alarms are born.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L32'];

import { statements, pipelineStages, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const FILTERS = new Set(['head', 'tail', 'grep']);

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  const sts = statements(stripDataRegions(command));
  for (let i = 0; i + 1 < sts.length; i++) {
    const stages = pipelineStages(sts[i]);
    if (stages.length < 2) continue;
    const lastCmd = tokenize(stages[stages.length - 1])[0];
    if (!FILTERS.has(lastCmd)) continue;
    if (sts[i + 1].includes('$?')) {
      return {
        decision: 'warn',
        reason: `L32: \`$?\` right after \`| ${lastCmd}\` measures ${lastCmd}'s exit code — `
          + 'always 0 — never the command you piped. Capture `$?` IMMEDIATELY after the real '
          + 'command (redirect to a file first if the output needs trimming): '
          + '`cmd > out.log 2>&1; ec=$?; tail out.log`.',
      };
    }
  }
  return { decision: 'allow', reason: 'no $? read through a filter pipe' };
}
```

- [ ] **Step 4: Implement L39** — create `scripts/hooks/rules/key-echo-guard.mjs`:

```js
// scripts/hooks/rules/key-echo-guard.mjs — L39. "The rule stands unchanged: never print, log,
// echo, or commit a key — read it into the process and use it, nothing more." A printed key in
// a transcript is unrecoverable.
//
// SEVERITY: block, argued (spec §3.2): substance — once printed, the secret is in the log
// forever; there is no undo, so warning after the fact is worthless. Reachable alternative
// (§10.24), named in the reason: L39's own documented read pattern (read the value into the
// process environment and USE it, without printing).
//
// STRIPPING PROFILE — deliberately NOT the default (coordinator-confirmed): double-quoted
// content is KEPT, because a shell EXPANDS $VAR inside double quotes (`echo "$GEMINI_API_KEY"`
// prints the key). Single quotes and heredoc bodies stay stripped: '$KEY' is inert text, and
// the corpus's L39 noise (35 raw hits, 97% noise) was key-shaped prose with no $-expansion.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L39'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const PRINTERS = new Set(['echo', 'printf', 'printenv', 'Write-Output', 'Write-Host']);
const KEY_VAR = /\$(?:env:)?\w*(API_KEY|_KEY|TOKEN|SECRET)\w*/i;
const KEY_NAME = /(API_KEY|_KEY|TOKEN|SECRET)/i;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command, { keepDoubleQuoted: true }))) {
    const tokens = tokenize(st);
    const head = tokens[0];
    if (!PRINTERS.has(head)) continue;
    const expandsKey = KEY_VAR.test(st);
    const printenvKey = head === 'printenv'
      && tokens.slice(1).some((t) => !t.startsWith('-') && KEY_NAME.test(t));
    if (expandsKey || printenvKey) {
      return {
        decision: 'block',
        reason: 'L39: this prints a key-shaped variable — a printed key lands in the transcript '
          + 'and is unrecoverable. Read it into the process and USE it without printing, e.g. '
          + "PowerShell: `$env:GEMINI_API_KEY=[Environment]::GetEnvironmentVariable("
          + "'GEMINI_API_KEY','User'); node <script>`. A probe that cannot get a key says so "
          + 'without echoing it.',
      };
    }
  }
  return { decision: 'allow', reason: 'no key-printing statement in command position' };
}
```

- [ ] **Step 5: Prove the L39 regex against its own fixtures**

Run: `node -e "const r=/\$(?:env:)?\w*(API_KEY|_KEY|TOKEN|SECRET)\w*/i; console.log(r.test('echo \"K=$GEMINI_API_KEY\"'), r.test('echo \\$env:CF_API_TOKEN'), r.test('echo the 10 token names'))"`
Expected: `true true false`

- [ ] **Step 6: Run to verify GREEN**

Run: `pytest tests/test_arc2_phase3_rules.py -k "L32 or L39" -v`
Expected: PASS with fire counts printed. Paste; inspect every L39 fire by hand (there should be ≤5) and quote them redacted in the report.

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/rules/pipe-exit-code-read.mjs scripts/hooks/rules/key-echo-guard.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 4): L32 pipe-vs-exit-code warn + L39 key-print block"
```

---

### Task 5: L51a (wsl+sudo) + L55a (pip --no-deps pins) + 10.12a (nested `claude -p`)

**Files:**
- Create: `scripts/hooks/rules/wsl-sudo-noninteractive.mjs`
- Create: `scripts/hooks/rules/pip-no-deps-pinned.mjs`
- Create: `scripts/hooks/rules/nested-claude-neutral-cwd.mjs`
- Modify: `tests/test_arc2_phase3_rules.py`

**Interfaces:**
- Consumes: `statements`, `tokenize`, `stripDataRegions` (Task 1).
- Produces: three rule files, `RULE_IDS` = `['L51a']` / `['L55a']` / `['10.12a']`, all `TOOLS = ['Bash']`.

- [ ] **Step 1: Write the failing tests** — append:

```python
# ---------------------------------------------------------------- Task 5: L51a + L55a + 10.12a

def test_L51a_blocks_sudo_inside_noninteractive_wsl(tmp_path):
    # Verbatim shape from the corpus context lines. Per the coordinator's correction prepended
    # to the measurement file: the REAL violations sit INSIDE quotes (`bash -lc '...'`) — the
    # blanket strip removed the SIGNAL, so this rule keeps quotes and unwraps per-token.
    out = run_pretooluse(bash_payload(
        "wsl -d Ubuntu-20.04 -e bash -lc 'sudo service docker start 2>&1 | tail -3'"),
        tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "L51a" in reason_of(out) and "wsl -u root" in reason_of(out)


def test_L51a_allows_root_user_and_prose(tmp_path):
    for cmd in ["wsl -u root -e bash -lc 'service docker start'",
                'echo "note: wsl -e bash -lc sudo has no TTY and fails silently"']:
        out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
        assert decision_of(out) == "allow", (cmd, out)


def test_L51a_corpus_replay(corpus_dump):
    """History holds a handful of GENUINE wsl+sudo calls (they are why L51a exists) — true
    positives. Bar: every fire's command really does lead with wsl and carry sudo."""
    out = replay("wsl-sudo-noninteractive.mjs", corpus_dump)
    for f in out["fires"]:
        assert "wsl" in f["command"] and "sudo" in f["command"], f
    assert out["fireCount"] <= 10, out["fires"]
    print(f"\nL51a corpus fires: {out['fireCount']} / {out['total']}")


def test_L55a_blocks_an_undocumented_no_deps_pin(tmp_path):
    out = run_pretooluse(bash_payload(
        "python -m pip install --quiet --no-deps left-pad==1.0.0"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "requirements-overrides.txt" in reason_of(out)


def test_L55a_allows_documented_pins_and_the_overrides_file_itself(tmp_path):
    # neo4j==6.2.0 is a real documented pin in requirements-overrides.txt (read during planning).
    for cmd in ["python -m pip install --quiet --disable-pip-version-check --no-deps neo4j==6.2.0",
                "python -m pip install --no-deps -r requirements-overrides.txt",
                "python -m pip install requests"]:
        out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
        assert decision_of(out) == "allow", (cmd, out)


def test_L55a_corpus_replay(corpus_dump):
    out = replay("pip-no-deps-pinned.mjs", corpus_dump)
    for f in out["fires"]:
        assert "--no-deps" in f["command"], f
    assert out["fireCount"] <= 10, out["fires"]
    print(f"\nL55a corpus fires: {out['fireCount']} / {out['total']}")


def test_1012a_blocks_a_nested_claude_p_from_repo_cwd(tmp_path):
    out = run_pretooluse(bash_payload('claude -p "extract entities from doc.md"'), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "10.12a" in reason_of(out) and "neutral" in reason_of(out).lower()


def test_1012a_allows_neutral_cwd_and_prose(tmp_path):
    for cmd in ["cd C:/Users/dudib/AppData/Local/Temp/extract && claude -p 'extract from C:/abs/doc.md'",
                'echo "a nested claude -p inside this repo loads CLAUDE.md"']:
        out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
        assert decision_of(out) == "allow", (cmd, out)


def test_1012a_corpus_replay(corpus_dump):
    """The measurement found 3 raw hits, ALL prose (100% noise) — so the corpus expectation is
    ZERO fires. A nonzero count here is exactly the spec-§6 stop-and-investigate trigger."""
    out = replay("nested-claude-neutral-cwd.mjs", corpus_dump)
    assert out["fireCount"] == 0, out["fires"]
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -k "L51a or L55a or 1012a" -v`
Expected: FAIL — all catch tests get `allow`. Paste output.

- [ ] **Step 3: Implement L51a** — create `scripts/hooks/rules/wsl-sudo-noninteractive.mjs`:

```js
// scripts/hooks/rules/wsl-sudo-noninteractive.mjs — L51a. `sudo` inside a non-interactive `wsl`
// call reads EOF at the password prompt and fails SILENTLY — indistinguishable from doing
// nothing (2026-08-05).
//
// SEVERITY: block, argued (spec §3.2): the action has no equivalent outcome — it cannot
// succeed, only pretend to; a silent no-op that reads as success is substance-harm to every
// conclusion built on it. Reachable alternative (§10.24), from L51a's own text: `wsl -u root
// <command>` — the Windows user is already authenticated, root needs no password.
//
// STRIPPING PROFILE — deliberately NOT the default (coordinator-confirmed, and the measurement
// file now carries a prepended correction about exactly this): BOTH quote kinds are KEPT. The
// real violation lives inside quotes (`wsl -e bash -lc 'sudo …'` — the quoted string IS the
// command wsl runs); the blanket strip REMOVED that signal, which is why the raw measurement
// showed "0 in-command". Prose is still excluded structurally: the statement must LEAD with
// `wsl` — an `echo "wsl … sudo …"` statement leads with echo.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L51a'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

// `sudo` at a command boundary inside a token: start-of-token, or after whitespace/;/&/|/quotes/
// parens/backtick. tokenize() only unwraps a WHOLE token in matching quotes, so a quote broken
// open by the statement split (`'sudo`) keeps its leading quote char — the class covers that.
const SUDO_AT_BOUNDARY = /(^|[\s;&|'"(`])sudo\b/;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  const kept = stripDataRegions(command, { keepSingleQuoted: true, keepDoubleQuoted: true });
  for (const st of statements(kept)) {
    const tokens = tokenize(st);
    if (tokens[0] !== 'wsl' && tokens[0] !== 'wsl.exe') continue;
    const uIdx = tokens.indexOf('-u');
    if (uIdx !== -1 && tokens[uIdx + 1] === 'root') continue; // root needs no password — fine
    if (tokens.slice(1).some((t) => SUDO_AT_BOUNDARY.test(t))) {
      return {
        decision: 'block',
        reason: 'L51a: `sudo` inside a non-interactive `wsl` call reads EOF at the password '
          + 'prompt and fails SILENTLY — indistinguishable from doing nothing. Run it as '
          + '`wsl -u root <command>` instead: the Windows user is already authenticated, so '
          + 'root needs no password.',
      };
    }
  }
  return { decision: 'allow', reason: 'no sudo inside a non-interactive wsl call' };
}
```

- [ ] **Step 4: Implement L55a** — create `scripts/hooks/rules/pip-no-deps-pinned.mjs`:

```js
// scripts/hooks/rules/pip-no-deps-pinned.mjs — L55a. `pip install --no-deps` bypasses the
// resolver; a bypass that is not written down is a decision pip silently undoes on the next
// ordinary install. Blocked unless every pin in the command appears in
// requirements-overrides.txt — the file whose entire subject is pins that contradict upstream,
// with the reason written beside each one.
//
// SEVERITY: block, argued (spec §3.2): substance — an undocumented override IS the incident
// (the pin evaporates later with no trace of why it existed). Reachable alternative (§10.24),
// named in the reason: add the pin + its reason to requirements-overrides.txt (and its holding
// test, per that file's own header), or drop --no-deps.
//
// The file is read FRESH on every call (no caching) — same discipline as fix-cycle-limit.mjs
// reading the discipline doc. A missing/unreadable overrides file means NO pin is documented,
// which correctly blocks (this is a case where fail-open would defeat the rule's whole point:
// the block's alternative — write the file — is always reachable).
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L55a'];

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PIN = /^[A-Za-z0-9][A-Za-z0-9._[\]-]*==\S+$/;

function isPipInstall(tokens) {
  const head = tokens[0];
  const viaModule = (head === 'python' || head === 'python3' || head === 'py')
    && tokens.includes('-m') && tokens.includes('pip');
  return (head === 'pip' || head === 'pip3' || viaModule) && tokens.includes('install');
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (!isPipInstall(tokens) || !tokens.includes('--no-deps')) continue;
    const rIdx = tokens.indexOf('-r');
    if (rIdx !== -1 && /requirements-overrides\.txt$/.test(tokens[rIdx + 1] || '')) continue;
    let overrides = '';
    try {
      overrides = readFileSync(join(ROOT, 'requirements-overrides.txt'), 'utf8').toLowerCase();
    } catch { /* unreadable = nothing documented — see header */ }
    const pins = tokens.filter((t) => PIN.test(t));
    const undocumented = pins.filter((p) => !overrides.includes(p.toLowerCase()));
    if (pins.length === 0 || undocumented.length > 0) {
      const what = undocumented.length > 0 ? undocumented.join(', ') : 'an unpinned package';
      return {
        decision: 'block',
        reason: `L55a: \`--no-deps\` bypasses the resolver, and ${what} is not documented in `
          + 'requirements-overrides.txt. Add the exact pin there with the reason beside it '
          + "(and its holding test, per that file's own header) — or drop --no-deps and let "
          + 'the resolver do its job.',
      };
    }
  }
  return { decision: 'allow', reason: 'no undocumented --no-deps pin' };
}
```

- [ ] **Step 5: Implement 10.12a** — create `scripts/hooks/rules/nested-claude-neutral-cwd.mjs`:

```js
// scripts/hooks/rules/nested-claude-neutral-cwd.mjs — 10.12a. A nested `claude -p` started
// inside this repo loads CLAUDE.md and STOPS BEING AN EXTRACTOR: measured 2026-07-24, 3 of 3
// dispatched documents produced 0 nodes while 60 nodes were invented for unrelated repo files.
// "Run any nested extraction backend from a NEUTRAL cwd, with absolute paths."
//
// SEVERITY: block, argued (spec §3.2): substance — the nested agent silently does a different
// job, producing corrupt output that LOOKS like results. Reachable alternative (§10.24), named
// in the reason AND recognized by the rule itself: `cd` to an absolute directory OUTSIDE the
// repo earlier in the same call (with absolute paths for the inputs) — that exact shape allows.
//
// The inside-repo check is a normalized SUBSTRING test on the cd target ('source/repos/
// matconetesh'), not path resolution: the Bash tool mixes Windows (C:\...) and git-bash
// (/c/...) path spellings, and node's resolve() mangles the git-bash form on win32 — a wrong
// resolve would ALLOW a cd back into the repo. The substring is stable across both spellings.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['10.12a'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const REPO_MARKER = 'source/repos/matconetesh';
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;
const insideRepo = (p) => p.replace(/\\/g, '/').toLowerCase().includes(REPO_MARKER);

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  let cdOutsideRepo = false;
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (tokens[0] === 'cd' && tokens[1]) {
      cdOutsideRepo = ABSOLUTE.test(tokens[1]) && !insideRepo(tokens[1]);
      continue;
    }
    if (tokens[0] === 'claude' && tokens.includes('-p') && !cdOutsideRepo) {
      return {
        decision: 'block',
        reason: "10.12a: a nested `claude -p` started inside this repo loads CLAUDE.md and stops "
          + 'being an extractor (measured: 0/3 documents extracted, 60 nodes invented for '
          + 'unrelated repo files). Run it from a NEUTRAL cwd instead: `cd <absolute dir outside '
          + 'the repo>` earlier in this same call, and pass every input as an absolute path — '
          + 'that shape is allowed as-is.',
      };
    }
  }
  return { decision: 'allow', reason: 'no nested claude -p from a repo cwd' };
}
```

- [ ] **Step 6: Prove the sudo-boundary regex against its own fixtures**

Run:
```bash
node --input-type=module -e "
const r = /(^|[\s;&|'\"(\`])sudo\b/;
console.log(r.test(String.raw\`'sudo\`), r.test('sudo service docker start'), r.test('visudo'));
"
```
Expected: `true true false`

- [ ] **Step 7: Run to verify GREEN**

Run: `pytest tests/test_arc2_phase3_rules.py -k "L51a or L55a or 1012a" -v`
Expected: PASS with fire counts printed. Paste; quote every L51a/L55a fire in the report with its classification (true positive vs alarm — an alarm on legitimate work stops the phase, spec §6).

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/rules/wsl-sudo-noninteractive.mjs scripts/hooks/rules/pip-no-deps-pinned.mjs scripts/hooks/rules/nested-claude-neutral-cwd.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 5): L51a wsl-sudo + L55a no-deps pins + 10.12a nested claude"
```

---

### Task 6: L18 — suite kills: block indiscriminate image-name kills, permit the §11a PID protocol

**Files:**
- Create: `scripts/hooks/rules/suite-kill-protocol.mjs`
- Modify: `tests/test_arc2_phase3_rules.py`

**Interfaces:**
- Consumes: `statements`, `tokenize`, `stripDataRegions` (Task 1).
- Produces: rule file, `TOOLS = ['Bash']`, `RULE_IDS = ['L18']`.

**Design (coordinator-confirmed, read against L18's mirror text):** L18 forbids killing a suite mid-flight; §11a *requires* a kill/verify protocol for an orphan. The corpus's 18 surviving in-command hits are `taskkill //PID <n> //F` loops — the legitimate protocol shape (a specific, investigated PID). What produced the zombie was the *indiscriminate* kill: by image name, killing workers while the primary respawns them. Enforceable line: **PID-targeted kills allow; image-name kills of suite-related processes (`taskkill /IM node.exe`, `pkill -f serve|playwright|node`) block**, with the PID protocol as the named alternative. The "verify port refuses + 0 orphans" half is a cross-call sequence — carried in the block reason and named as a limitation in the rule comment.

- [ ] **Step 1: Write the failing tests** — append:

```python
# ---------------------------------------------------------------- Task 6: L18

def test_L18_blocks_an_image_name_kill_of_node(tmp_path):
    out = run_pretooluse(bash_payload("taskkill //IM node.exe //F"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "L18" in reason_of(out) and "//PID" in reason_of(out)   # the protocol, by name
    out2 = run_pretooluse(bash_payload("pkill -f serve.js"), tmp_path=tmp_path)
    assert decision_of(out2) == "block", out2


def test_L18_allows_the_pid_protocol_and_prose(tmp_path):
    # Verbatim survivor shape from the corpus: netstat-derived per-PID kills = the §11a protocol.
    for cmd in [("for pid in $(netstat -ano | grep 8123 | awk '{print $5}' | sort -u); "
                 "do taskkill //PID $pid //F >/dev/null 2>&1; done"),
                "taskkill //PID 382168 //T //F 2>&1 | head -3",
                'echo "=== suite still running? (do NOT kill it — 11a/L18) ==="',
                'echo "CONTENT gap — botulism kill-temps and Cure #1 composition"']:
        out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
        assert decision_of(out) == "allow", (cmd, out)


def test_L18_corpus_replay(corpus_dump):
    """The 18 surviving in-command hits are PID-protocol loops — all must ALLOW. Expected corpus
    fires: ZERO. A nonzero count is either a real historical image-name kill (classify it, quote
    it) or a false alarm (phase stops, spec §6). Either way this test surfaces it loudly."""
    out = replay("suite-kill-protocol.mjs", corpus_dump)
    assert out["fireCount"] == 0, out["fires"]
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -k L18 -v`
Expected: FAIL — the block tests get `allow`. Paste output.

- [ ] **Step 3: Implement** — create `scripts/hooks/rules/suite-kill-protocol.mjs`:

```js
// scripts/hooks/rules/suite-kill-protocol.mjs — L18. Repeated kill-and-restart of suite runs
// left serve.js's cluster primary alive: a port-based/image-based kill took the workers, the
// primary respawned them, and the zombie wedged 8123 for hours — the debugging methodology
// CREATED the failure being debugged (2026-07-23).
//
// WHAT THIS RULE DOES AND DOES NOT ENFORCE (coordinator-confirmed, from L18 + §11a):
//   - BLOCKS the indiscriminate shape: taskkill /IM <suite-related image> and pkill/killall
//     against suite-related patterns. That is the shape that kills workers while a primary
//     respawns them, and it also takes down every unrelated process of that image — including
//     the very hooks enforcing this rule.
//   - ALLOWS the §11a protocol: taskkill //PID <specific pid> (with or without //T //F). The 18
//     surviving corpus hits are exactly this shape — a specific, investigated PID is the
//     protocol §11a REQUIRES after an orphan is found, and firing on it would make this rule
//     the ~20-times-a-day alarm that gets disabled within a week.
//   - LIMITATION, stated so no reader assumes otherwise: the protocol's second half — "then
//     VERIFY the port refuses + 0 orphans" — is a sequence ACROSS calls; a single PreToolUse
//     call cannot check it. It rides in the block reason as instruction, NOT as enforcement.
//
// SEVERITY: block, argued (spec §3.2): substance — one indiscriminate kill produced a zombie
// server and hours of thrash; the equivalent-outcome alternative is always reachable and named:
// identify the primary PID, kill its TREE (`taskkill //PID <pid> //T //F`), then verify.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L18'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const SUITE_IMAGE = /^(node(\.exe)?|serve(\.js)?|python(w?\.exe)?|chrome(\.exe)?|chromium|msedge(\.exe)?|playwright)$/i;
const SUITE_PATTERN = /(node|serve|playwright|chrom)/i;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    // The kill word may not lead the statement (`do taskkill //PID $pid //F`) — find it anywhere
    // in command position; the //PID protocol shape must still allow, so only /IM triggers.
    const killIdx = tokens.findIndex((t) => t === 'taskkill' || t === 'taskkill.exe');
    if (killIdx !== -1) {
      const rest = tokens.slice(killIdx + 1);
      const imIdx = rest.findIndex((t) => t.replace(/^\/+/, '/').toLowerCase() === '/im');
      if (imIdx !== -1 && SUITE_IMAGE.test(rest[imIdx + 1] || '')) {
        return {
          decision: 'block',
          reason: `L18: \`taskkill /IM ${rest[imIdx + 1]}\` is an indiscriminate image-name kill `
            + '— last time this shape killed suite workers while the primary respawned them, '
            + 'leaving a zombie server that wedged 8123 for hours. Follow §11a instead: identify '
            + 'the primary PID (netstat/Get-NetTCPConnection), kill its tree with '
            + '`taskkill //PID <pid> //T //F`, then VERIFY: port refuses + 0 orphans.',
        };
      }
    }
    const pkillIdx = tokens.findIndex((t) => t === 'pkill' || t === 'killall');
    if (pkillIdx !== -1) {
      const pattern = tokens.slice(pkillIdx + 1).find((t) => !t.startsWith('-'));
      if (pattern && SUITE_PATTERN.test(pattern)) {
        return {
          decision: 'block',
          reason: `L18: \`${tokens[pkillIdx]} … ${pattern}\` kills by pattern — the indiscriminate `
            + 'shape that created the respawning-zombie incident. Follow §11a: find the specific '
            + 'primary PID, `taskkill //PID <pid> //T //F` (or `kill <pid>`), then verify the '
            + 'port refuses and 0 orphans remain.',
        };
      }
    }
  }
  return { decision: 'allow', reason: 'no indiscriminate suite-process kill (PID-targeted kills are the §11a protocol)' };
}
```

- [ ] **Step 4: Prove the /IM normalization against its own fixtures**

Run: `node -e "const n=t=>t.replace(/^\/+/,'/').toLowerCase(); console.log(n('//IM')==='/im', n('/IM')==='/im', n('//PID')==='/im')"`
Expected: `true true false`

- [ ] **Step 5: Run to verify GREEN**

Run: `pytest tests/test_arc2_phase3_rules.py -k L18 -v`
Expected: PASS, corpus fires 0. Paste output.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/rules/suite-kill-protocol.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 6): L18 — image-name suite kills blocked, PID protocol permitted"
```

---

### Task 7: L73 — content edit + `git commit` never share one Bash call

**Files:**
- Create: `scripts/hooks/rules/edit-commit-separation.mjs`
- Modify: `tests/test_arc2_phase3_rules.py`

**Interfaces:**
- Consumes: `statements`, `tokenize`, `stripDataRegions`, `corpus_commands` (Tasks 1–2).
- Produces: rule file, `TOOLS = ['Bash']`, `RULE_IDS = ['L73']`.

**STOP CONDITION (coordinator, verbatim intent):** if the heredoc-commit-message tests below cannot pass, STOP and tell the coordinator before writing the rest of the rule — a rule that fires ~20 times a day gets disabled within a week.

- [ ] **Step 1: Write the failing tests** — append:

```python
# ---------------------------------------------------------------- Task 7: L73

def test_L73_blocks_content_edit_plus_commit_in_one_call(tmp_path):
    # Verbatim survivor shape from the corpus (cat >> doc && git add && git commit).
    out = run_pretooluse(bash_payload(
        "cat >> docs/process/graphify-improvements.md <<'EOF'\nnew section\nEOF\n"
        "git add docs/process/graphify-improvements.md && git commit -q -m \"docs: notes\""),
        tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "L73" in reason_of(out) and "separate" in reason_of(out)


def test_L73_allows_the_heredoc_commit_message_style(tmp_path):
    """COORDINATOR REQUIREMENT — the owner's real all-day commit style, verbatim shape. The
    heredoc here is the COMMIT MESSAGE, not a content edit. If this fails, STOP and report
    before implementing further (see the task's stop condition)."""
    cmd = ("git commit -q -F - -- docs/STATUS-BOARD.md scripts/hooks/rules/x.mjs <<'MSG'\n"
           "feat(enforcement Phase 3): the plan said cat >> file.md then git commit is the trap\n"
           "\n"
           "body: sed -i and tee inside this message are prose, not edits.\n"
           "MSG")
    out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L73_allows_every_real_heredoc_commit_from_the_corpus(tmp_path, corpus_dump):
    """COORDINATOR REQUIREMENT, second half — REAL commands, not a constructed shape: every
    `git commit … -F -` + heredoc command actually recorded in the corpus, replayed verbatim
    through the real CLI. Guarded against examining nothing: the owner committed this way all
    day today, so the corpus MUST contain them."""
    import re as _re
    real = [c for c in corpus_commands(corpus_dump)
            if _re.search(r"git commit[^\n]*-F -", c) and "<<" in c
            and "cat >" not in c and "sed -i" not in c and "tee " not in c.split("<<")[0]
            and ">>" not in c.split("<<")[0]]
    assert real, "no real -F - heredoc commits found in the corpus — this test examined NOTHING"
    fired = []
    for c in real[:40]:   # a representative slab; the shape is identical across all of them
        out = run_pretooluse(bash_payload(c), tmp_path=tmp_path)
        if decision_of(out) != "allow" and "L73" in reason_of(out):
            fired.append(c[:120])
    assert fired == [], f"L73 fires on the owner's real heredoc-commit style: {fired}"


def test_L73_allows_add_plus_commit_and_plain_commit(tmp_path):
    for cmd in ['git add app.js tests/x.spec.ts && git commit -q -m "fix: thing"',
                'git commit -q -m "docs: cat >> file.md then commit — quoting the rule"',
                "git log --oneline -3 | grep commit"]:
        out = run_pretooluse(bash_payload(cmd), tmp_path=tmp_path)
        assert decision_of(out) == "allow", (cmd, out)


def test_L73_corpus_replay(corpus_dump):
    """~154 in-command combined calls exist in history (the incident class L73 was written for
    on 8.8.26) — true positives (coordinator-confirmed reading). Bar: every fire names L73, and
    no fire is a heredoc-message-only commit (the dedicated tests above check that directly on
    real corpus commands)."""
    out = replay("edit-commit-separation.mjs", corpus_dump)
    assert out["fireCount"] > 0, "history's known combined calls did not fire — the rule is inert"
    for f in out["fires"]:
        assert "L73" in f["reason"], f
    print(f"\nL73 corpus fires: {out['fireCount']} / {out['total']}")
```

- [ ] **Step 2: Run to verify RED**

Run: `pytest tests/test_arc2_phase3_rules.py -k L73 -v`
Expected: FAIL — the block test gets `allow` (rule missing). Paste output.

- [ ] **Step 3: Implement** — create `scripts/hooks/rules/edit-commit-separation.mjs`:

```js
// scripts/hooks/rules/edit-commit-separation.mjs — L73 (8.8.26, twice in one day): a content
// write and a `git commit` shared one Bash call; a PreToolUse gate blocked the COMMIT, and the
// WHOLE call never ran — the write vanished with it, and the author went hunting for a
// file-restore mechanism that does not exist. A PreToolUse hook blocks the entire Bash command,
// not its last segment. An edit that later content relies on is written in its own call,
// verified from disk, and only then committed.
//
// SEVERITY: block, argued (spec §3.2): substance — the failure mode is a silently lost write
// plus a false belief about what is on disk. Reachable alternative (§10.24), named in the
// reason: two calls (write; verify; commit). Zero capability is lost, only one round-trip added.
//
// FALSE-ALARM DESIGN — the single most sensitive rule in this phase (coordinator requirement):
// the owner commits ~20x/day as `git commit -q -F - -- <paths> <<'MSG' … MSG`, where the heredoc
// is the COMMIT MESSAGE, not an edit. stripDataRegions() removes heredoc BODIES and quoted
// strings FIRST, so that command reduces to `git commit -q -F - -- <paths> <<` — no edit shape
// left. The content-edit patterns below are the measurement script's own (cat>/cat>>, >> to a
// source-ish file, sed -i, tee) — the exact set the 3%-noise number was measured with; widening
// it is how this rule becomes the alarm that gets disabled.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L73'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const CAT_REDIRECT = /^cat\s*>>?/;
const APPEND_TO_SOURCE = />>\s*\S+\.(md|py|mjs|json)\b/;

function isContentEdit(st, tokens) {
  if (CAT_REDIRECT.test(st)) return true;
  if (APPEND_TO_SOURCE.test(st)) return true;
  const sedIdx = tokens.indexOf('sed');
  if (sedIdx !== -1 && tokens[sedIdx + 1] === '-i') return true;
  if (tokens.includes('tee')) return true;
  return false;
}

// `commit` must be an argument of git itself — before any pipe token — so `git log | grep commit`
// stays untouched (tokens: pipe at index 2, commit at index 4).
function isGitCommit(tokens) {
  const g = tokens.indexOf('git');
  if (g === -1) return false;
  const c = tokens.indexOf('commit');
  if (c <= g) return false;
  const pipe = tokens.indexOf('|');
  return pipe === -1 || c < pipe;
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  let editStatement = null;
  let commitStatement = null;
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (editStatement === null && isContentEdit(st, tokens)) editStatement = st;
    if (commitStatement === null && isGitCommit(tokens)) commitStatement = st;
  }
  if (editStatement !== null && commitStatement !== null) {
    return {
      decision: 'block',
      reason: `L73: this call combines a content edit (\`${editStatement.slice(0, 80)}\`) with `
        + '`git commit`. A PreToolUse hook blocks the WHOLE Bash command — if any gate blocks '
        + 'the commit, the write vanishes with it (that exact incident, twice on 8.8.26). Run '
        + 'them as separate calls: write first, verify the file from disk, then commit. '
        + "Heredoc commit MESSAGES (`git commit -F - <<'MSG'`) are fine and do not trigger this.",
    };
  }
  return { decision: 'allow', reason: 'no content-edit + commit combination in one call' };
}
```

- [ ] **Step 4: Prove the heredoc strip against the owner's real command shape**

Run:
```bash
node --input-type=module -e "
import { stripDataRegions } from './scripts/hooks/lib/bash-segments.mjs';
const cmd = \"git commit -q -F - -- docs/x.md <<'MSG'\ncat >> trap.md prose\nMSG\";
const out = stripDataRegions(cmd);
console.log(JSON.stringify(out), '| edit-shape left:', /^cat\s*>>?/m.test(out));
"
```
Expected: stripped text contains `git commit -q -F -` and `edit-shape left: false`.

- [ ] **Step 5: Run to verify GREEN**

Run: `pytest tests/test_arc2_phase3_rules.py -k L73 -v`
Expected: PASS — including `test_L73_allows_every_real_heredoc_commit_from_the_corpus` with a nonzero `real` count (name the count in the report), and the corpus fire count printed (expect ~150; sample fires quoted + classified). **If the heredoc allow-tests fail, STOP here and report to the coordinator — do not tune the rule until it "mostly" passes.** Paste output.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/rules/edit-commit-separation.mjs tests/test_arc2_phase3_rules.py
git commit -m "feat(enforcement Arc 2 Phase 3, Task 7): L73 — content edits and commits never share a Bash call"
```

---

### Task 8: Phase wiring — liveness with zero env overrides, coverage, tool scope, overhead, full suites

**Files:**
- Create: `tests/test_arc2_phase3_wiring.py`
- Modify: `docs/process/rule-coverage-baseline.json`
- Modify: `docs/STATUS-BOARD.md` (task close, H10)

**Interfaces:**
- Consumes: everything Tasks 1–7 landed; `scripts/check-rule-coverage.mjs`; `tests/test_hook_tool_scope.py` (existing — auto-discovers the new rules, is NOT rewritten); `tests/test_arc2_phase2_wiring.py`'s spread + overhead tests (rerun as-is, unmodified).

- [ ] **Step 1: Write the wiring tests** — create `tests/test_arc2_phase3_wiring.py`:

```python
# tests/test_arc2_phase3_wiring.py — Arc 2 Phase 3: liveness (§3.4), coverage, overhead (§3.5).
# L36a is deferred to Arc 3 (owner decision 2026-08-10, R-124) and deliberately absent here.
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PHASE3_RULES = ["10.12a", "L10", "L18", "L32", "L39", "L51a", "L55a", "L73"]


def test_phase3_rules_are_live_through_the_real_entry_point_with_no_env_overrides():
    """§3.4 — THE liveness test: real CLI, environment UNTOUCHED. L51a is the probe rule: fully
    deterministic and stateless (no port, no store, no config file), so nothing else in this
    payload can fire first or flake."""
    payload = {"session_id": "s-liveness-arc2p3", "hook_event_name": "PreToolUse",
               "tool_name": "Bash", "cwd": str(ROOT),
               "tool_input": {"command": "wsl -d Ubuntu -e bash -lc 'sudo apt-get update'"}}
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env={**os.environ})
    assert r.returncode == 0
    out = json.loads(r.stdout)
    h = out.get("hookSpecificOutput", {})
    assert h.get("permissionDecision") == "deny", (
        f"L51a did not fire through the real entry point — the phase's rules are NOT live:\n{r.stdout}")
    assert "L51a" in h.get("permissionDecisionReason", "")


def test_every_phase3_rule_is_declared_and_counted():
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                      capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, f"check-rule-coverage.mjs exited nonzero:\n{r.stdout}\n{r.stderr}"
    error_lines = [ln for ln in r.stdout.splitlines()
                   if ln.startswith("ERROR:") or ln.startswith("REGRESSION:")]
    for rid in PHASE3_RULES:
        offending = [ln for ln in error_lines if rid in ln]
        assert not offending, f"{rid} appears in an ERROR/REGRESSION line:\n" + "\n".join(offending)


def test_coverage_baseline_file_contains_every_phase3_rule():
    baseline = json.loads((ROOT / "docs" / "process" / "rule-coverage-baseline.json")
                          .read_text(encoding="utf-8"))
    covered = set(baseline["covered"])
    missing = [rid for rid in PHASE3_RULES if rid not in covered]
    assert not missing, f"baseline is missing phase-3 rule id(s): {missing}"
```

- [ ] **Step 2: Run to witness RED**

Run: `pytest tests/test_arc2_phase3_wiring.py -v`
Expected: the liveness test PASSES already (its rules landed in Tasks 3–7 — a first-run pass here proves exactly its intended subject, the no-override path). The **baseline test FAILS** (ids not yet in the baseline file) — that is this task's witnessed RED. Paste output.

- [ ] **Step 3: Update the coverage baseline** — add the eight ids to the `"covered"` array of `docs/process/rule-coverage-baseline.json` (alphabetical position, exact strings): `"10.12a"`, `"L10"`, `"L18"`, `"L32"`, `"L39"`, `"L51a"`, `"L55a"`, `"L73"`. Then run `node scripts/check-rule-coverage.mjs` and confirm exit 0 with no ERROR/REGRESSION lines.

- [ ] **Step 4: Run to verify GREEN, including tool scope**

Run: `pytest tests/test_arc2_phase3_wiring.py tests/test_hook_tool_scope.py -v`
Expected: PASS — the wiring tests, AND the existing tool-scope test now auto-covering all 8 new rule files (every rule driven with every tool it did not declare, `allow` required; the test is used as-is, not rewritten). Paste output.

- [ ] **Step 5: Re-measure overhead (§3.5) with the EXISTING Phase-2 tests, unmodified**

Run: `pytest tests/test_arc2_phase2_wiring.py -k "spread or overhead" -v -s`
Expected: PASS; paste the printed `PRETOOLUSE WORST BY TOOL` and `PRETOOLUSE OVERHEAD` lines into the task report. Baseline for comparison: 75ms median / ~85ms worst before this phase. A material rise on the Bash column is a finding to investigate (spec §3.5), whether or not the 4x tripwire fires — investigate before closing the phase.

- [ ] **Step 6: Full suites (spec §5.6)** — serialized, idle machine, no other heavy processes (§11a):

Run: `pytest` (full) — expected: all green, output pasted.
Run: `npx playwright test` — plain, nothing else. Expected: all green, output pasted. Any failure, including an intermittent one, is a bug — systematic-debugging, never a re-run-until-green.

- [ ] **Step 7: Close the task** — update `docs/STATUS-BOARD.md` (Phase 3 status: 8 rules landed, L36a deferred as R-124 with its trigger anchor; gap ledger; distance), and paste the H9 five-row summary table in the task report.

- [ ] **Step 8: Commit**

```bash
git add tests/test_arc2_phase3_wiring.py docs/process/rule-coverage-baseline.json docs/STATUS-BOARD.md
git commit -m "feat(enforcement Arc 2 Phase 3, Task 8): liveness with zero env overrides, coverage baseline, overhead re-measured"
```

---

## Coordinator resolutions honored in this revision (2026-08-10)

1. **L36a deferred to Arc 3 (R-124)** — removed entirely; deferral + reason stated in the header note; PHASE3_RULES and the coverage baseline carry 8 ids.
2. **"0 false alarms" = zero fires on legitimate work** — prose shapes pinned as verbatim allow-tests; every task report samples and classifies every fire.
3. **Per-rule stripping profiles** — options on the ONE shared helper; the coordinator's correction prepended to the measurement file is cited where the L51a column would otherwise mislead.
4. **L18 slice** — PID kills allow, image/pattern kills block; the unenforceable verify-half is named as a LIMITATION in the rule's own comment.
5. **Task 1 refactor approved** — behaviour-identical, with an explicit step verifying zero edits to existing tests and full-suite green.

Plus the two additions: the L73 heredoc-commit style is tested verbatim AND against real corpus commands, with an explicit STOP-and-report condition; every rule declares `TOOLS = ['Bash']` and the existing `tests/test_hook_tool_scope.py` is run (not rewritten) in Task 8 Step 4.

## Self-review (performed against the spec before saving)

- **Spec coverage:** §3.1 catch+false-alarm per rule → Tasks 3–7, false alarms via real-corpus replay (Task 2 harness); §3.2 severity argued per rule → table above + every rule header; §3.3 `RULE_IDS`+`TOOLS` → every rule file, proven by the existing tool-scope test in Task 8; §3.4 no-override liveness → Task 8; §3.5 overhead → Task 8 Step 5; §5.3 zero false alarms on legitimate work → replay assertions + verbatim-noise allow tests; §5.6 both suites → Task 8 Step 6; coverage counted → Task 8 Steps 3–4. All 8 rule ids have exactly one implementing task; L36a's absence is declared, not silent.
- **Placeholder scan:** no TBDs, no "similar to Task N" (every rule's boilerplate is repeated in full), every code block complete and runnable, every load-bearing regex proven against its own fixture in a numbered step. No `[^)]*`-class regex anywhere (the only negated classes are `[^']`/`[^"]`/`[^\n]` used exactly for the one delimiter each must not cross, plus `(?!\|)` lookahead for single-pipe splits).
- **Type consistency:** `stripDataRegions`/`statements`/`pipelineStages`/`playwrightTestTokens` names and signatures identical across Task 1's implementation and every consumer in Tasks 3–7; `bash_payload`/`replay`/`corpus_dump`/`corpus_commands` helper names consistent across all test additions.
