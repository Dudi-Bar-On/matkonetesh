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


# --- L32, coverage gap found by the controller after Task 4 landed ----------------------------
#
# The shipped rule caught `cmd | tail; ec=$?` but deliberately not `cmd | tail; echo "EXIT=$?"`,
# and its own comment justified that with "the corpus's real mistakes all assign unquoted (ec=$?)".
# Measured against the 6,448-command corpus, that claim is inverted: the quoted form appears 52
# times and the unquoted form 7. The rule was catching 12% of the real defect.
#
# The cause is mechanical and is the same one the measurement doc's CORRECTION already recorded for
# L39 and L51a: stripDataRegions removes quoted strings, so a `$?` inside `echo "…"` is gone before
# the check ever runs. The remedy is the per-rule stripping profile, not a wider pattern.

def test_L32_catches_the_quoted_echo_form_which_is_the_common_one(tmp_path):
    """Verbatim shape from the corpus (52 occurrences), not an invented one."""
    out = run_pretooluse(
        {"session_id": "s-l32q", "hook_event_name": "PreToolUse", "tool_name": "Bash",
         "cwd": str(ROOT),
         "tool_input": {"command": 'python build.py 2>&1 | tail -3; echo "BUILD_EXIT=$?"'}},
        tmp_path=tmp_path)
    assert decision_of(out) == "warn", (
        "the quoted form is 52 of the corpus's 59 real instances and must be caught: " + str(out))


def test_L32_still_catches_the_unquoted_form(tmp_path):
    out = run_pretooluse(
        {"session_id": "s-l32u", "hook_event_name": "PreToolUse", "tool_name": "Bash",
         "cwd": str(ROOT),
         "tool_input": {"command": 'cd worker && npx wrangler deploy 2>&1 | tail -12; ec=$?'}},
        tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L32_does_not_fire_when_the_output_was_redirected_not_piped(tmp_path):
    """The shape the rule's own advice recommends must never be warned about — otherwise the fix
    the message names is itself flagged, which is the fastest way to get a rule disabled."""
    out = run_pretooluse(
        {"session_id": "s-l32r", "hook_event_name": "PreToolUse", "tool_name": "Bash",
         "cwd": str(ROOT),
         "tool_input": {"command": 'npx playwright test > /tmp/g8.log 2>&1; ec=$?; tail -5 /tmp/g8.log'}},
        tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L32_does_not_fire_when_the_exit_code_belongs_to_a_later_unpiped_command(tmp_path):
    """12 of the 15 my own measurement flagged were THIS shape — a pipe earlier in the line and an
    unrelated unpiped command right before the `$?`. The rule was right to reject them; pinning it
    so a fix for the quoted form does not widen into them."""
    out = run_pretooluse(
        {"session_id": "s-l32l", "hook_event_name": "PreToolUse", "tool_name": "Bash",
         "cwd": str(ROOT),
         "tool_input": {"command": 'git status -sb | head -3; node scripts/check-meta.mjs; ec=$?'}},
        tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


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
    # NOTE (found replaying the real corpus, not invented): the replayer truncates `command` to
    # 300 chars (secrets discipline, replay-bash-corpus.mjs header). One genuine fire is a
    # `cat > drv_probe.py <<'PY' ... PY` heredoc followed by the real
    # `pip install --no-deps neo4j==5.28.4` line — a true positive whose `--no-deps` sits past
    # char 300 in the raw command, same truncation shape Task 3's report already found for L10.
    # The rule's own `reason` always names `--no-deps` (it is in the block message), so check
    # either field — same pattern as L10's corpus-replay test, which checks `reason`.
    out = replay("pip-no-deps-pinned.mjs", corpus_dump)
    for f in out["fires"]:
        assert "--no-deps" in f["command"] or "--no-deps" in f["reason"], f
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
    """CORRECTED from the brief's "expected zero" (spec §6: a prediction is not evidence — the
    real corpus is). Hand-read every fire past the replayer's 300-char truncation: all are
    genuine `pkill -f "serve.js ..."` / `pkill -f "node serve.js"` pattern-kills — real
    historical instances of the EXACT L18 hazard (indiscriminate pattern-kill of the suite
    server), true positives, not noise. A first-draft SUITE_IMAGE/SUITE_PATTERN also fired 6
    times on `taskkill //F //IM chrome.exe //T` — a repeated, legitimate Playwright
    browser-cleanup idiom unrelated to the respawn hazard (browsers have no supervising primary
    that respawns them); narrowed the rule to server-side images only (node/serve/python) and
    those 6 are gone. Bar: every remaining fire blocks, names L18, and its command really
    contains `pkill`/`killall`/`taskkill /IM` targeting a suite-server pattern — never a bare
    `taskkill //PID` protocol call and never prose."""
    out = replay("suite-kill-protocol.mjs", corpus_dump)
    for f in out["fires"]:
        assert "L18" in f["reason"], f
        assert f["decision"] == "block", f
        # The reason itself names the offending word ("pkill" / "taskkill /IM <image>"), so this
        # holds even though `command` is truncated to 300 chars in the replayer's dump.
        assert "pkill" in f["reason"] or "taskkill /IM" in f["reason"], f
    assert out["fireCount"] <= 20, out["fires"]
    print(f"\nL18 corpus fires: {out['fireCount']} / {out['total']}")
