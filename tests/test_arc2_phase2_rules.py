# tests/test_arc2_phase2_rules.py — Arc 2 Phase 2: per-rule catch + false-alarm tests.
# Every test spawns the REAL CLI (pretooluse.mjs / posttooluse.mjs) as a subprocess with
# encoding="utf-8" (L74) and points ONLY the documented test seams at disposable files.
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_pretooluse(payload, env_extra=None, tmp_path=None):
    """Spawns the real PreToolUse entry point with `payload` on stdin. Returns the parsed
    hook-output JSON ({} = allow with nothing to say). Always redirects the log to a tmp file
    so tests never append to the repo's own .superpowers/hooks-log.jsonl."""
    env = {**os.environ, **(env_extra or {})}
    if tmp_path is not None and "PRETOOLUSE_LOG_PATH" not in env:
        env["PRETOOLUSE_LOG_PATH"] = str(tmp_path / "hooks-log.jsonl")
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, f"pretooluse.mjs must always exit 0:\n{r.stdout}\n{r.stderr}"
    return json.loads(r.stdout) if r.stdout.strip() else {}


def run_posttooluse(payload, env_extra=None, tmp_path=None):
    env = {**os.environ, **(env_extra or {})}
    if tmp_path is not None and "PRETOOLUSE_LOG_PATH" not in env:
        env["PRETOOLUSE_LOG_PATH"] = str(tmp_path / "hooks-log.jsonl")
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "posttooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stdout + r.stderr
    return r


def decision_of(out):
    """Maps the hook-output JSON back to the pipeline vocabulary: deny -> block;
    allow + systemMessage -> warn; {} or plain allow -> allow."""
    h = out.get("hookSpecificOutput", {})
    if h.get("permissionDecision") == "deny":
        return "block"
    if h.get("permissionDecision") == "allow" and out.get("systemMessage"):
        return "warn"
    return "allow"


def reason_of(out):
    return out.get("hookSpecificOutput", {}).get("permissionDecisionReason", "") \
        or out.get("systemMessage", "")


def seed(state_path, *args):
    """Seeds a disposable enforcement-state store through the store's OWN write path."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "tests" / "seed-state.mjs"), *args],
                      capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                      env={**os.environ, "ENFORCEMENT_STATE_PATH": str(state_path)})
    assert r.returncode == 0, r.stdout + r.stderr


def payload(tool, file_path, *, content=None, old=None, new=None, session="s-phase2-test",
            agent=None, transcript=None):
    p = {"session_id": session, "hook_event_name": "PreToolUse", "tool_name": tool,
         "cwd": str(ROOT), "tool_input": {"file_path": str(file_path)}}
    if content is not None: p["tool_input"]["content"] = content
    if old is not None: p["tool_input"]["old_string"] = old
    if new is not None: p["tool_input"]["new_string"] = new
    if agent is not None: p["agent_id"] = agent
    if transcript is not None: p["transcript_path"] = str(transcript)
    return p


# ---------------------------------------------------------------- Task 1: file_read channel

def test_read_tracker_records_a_file_read_event(tmp_path):
    state = tmp_path / "state.sqlite"
    post = {"session_id": "s-read", "hook_event_name": "PostToolUse", "tool_name": "Read",
            "tool_input": {"file_path": str(ROOT / "docs" / "process" / "development-discipline.md")},
            "tool_response": {"interrupted": False}, "agent_id": "actor-a"}
    run_posttooluse(post, env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    q = subprocess.run(["node", "--input-type=module", "-e",
                        "import('file://" + str(ROOT / 'scripts/hooks/lib/enforcement-state.mjs').replace(os.sep, '/')
                        + "').then(m=>{const db=m.openState();"
                        + "console.log(JSON.stringify(m.recentEvents(db,'s-read','file_read',0)));db.close();})"],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                       env={**os.environ, "ENFORCEMENT_STATE_PATH": str(state)})
    rows = json.loads(q.stdout.strip())
    assert len(rows) == 1, q.stdout + q.stderr
    assert "development-discipline.md" in rows[0]["detail"]
    assert rows[0]["actorId"] == "actor-a"


def test_read_tracker_records_nothing_for_a_failed_read(tmp_path):
    """False-alarm side, against the REAL failure shape: PostToolUseFailure carries `error` and no
    tool_response (measured in posttooluse.mjs's own header). A Read that failed read nothing."""
    state = tmp_path / "state.sqlite"
    post = {"session_id": "s-read-f", "hook_event_name": "PostToolUseFailure", "tool_name": "Read",
            "tool_input": {"file_path": str(ROOT / "no-such-file.md")},
            "error": "File does not exist.", "is_interrupt": False}
    run_posttooluse(post, env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    q = subprocess.run(["node", "--input-type=module", "-e",
                        "import('file://" + str(ROOT / 'scripts/hooks/lib/enforcement-state.mjs').replace(os.sep, '/')
                        + "').then(m=>{const db=m.openState();"
                        + "console.log(JSON.stringify(m.recentEvents(db,'s-read-f','file_read',0)));db.close();})"],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                       env={**os.environ, "ENFORCEMENT_STATE_PATH": str(state)})
    assert json.loads(q.stdout.strip()) == [], q.stdout
