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
