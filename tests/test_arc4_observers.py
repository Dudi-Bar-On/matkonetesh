# tests/test_arc4_observers.py — Arc 4, Task 6: evidence-channel contract tests for the two
# observers that no test named (measured in the arc's own progress.md: "3 shared libs and 2
# observers uncovered, one of them read-tracker, the evidence channel two rules depend on").
#
# WHAT THIS FILE ADDS ON TOP OF EXISTING COVERAGE (checked first, per the brief's Step 1):
#   - tests/test_arc2_phase2_rules.py already drives read-tracker.mjs through the real
#     posttooluse.mjs CLI for "recorded" + "failed read recorded nothing", and separately drives
#     L16/L56 against a HAND-SEEDED file_read row (seed-state.mjs, not the observer itself).
#   - tests/test_arc2_phase4_timestamp_gate.py already drives clock-tracker.mjs's observe()
#     DIRECTLY (not through posttooluse.mjs) and separately drives L84 against a HAND-SEEDED
#     clock_read row (seed_clock_read, not the observer itself).
#   Neither file proves the FULL chain: a real tool event -> the real posttooluse.mjs CLI ->
#   the real observer -> the real consumer rule's evaluate(), all against the SAME state store.
#   That end-to-end chain is what DoD-5 ("a reader that never executes is still dead") actually
#   asks for, and it is what this file adds -- for BOTH observers, plus the negative case.
#
# EVIDENCE CHANNEL CONTRACT (Step 1 findings, read off the four source files):
#   read-tracker.mjs   writes kind='file_read', detail={filePath}, on a successful Read.
#   clock-tracker.mjs  writes kind='clock_read', detail={command}, on a successful Bash call whose
#                       command's leading token is `date` (or contains `Get-Date` anywhere).
#   cited-path-read.mjs (L63a, stop-rules/) queries recentEvents(db, sessionId, 'file_read', 0)
#                       (and 'edit') and allows only when every cited repo path matches a
#                       detail.filePath from one of those rows.
#   timestamp-without-clock-read.mjs (L84, stop-rules/) queries recentEvents(db, sessionId,
#                       'clock_read', 0) for liveness and again with a recency floor
#                       (Date.now() - EVIDENCE_WINDOW_MS) to decide allow vs warn.
# Both consumers degrade to 'allow' on zero rows (the L57 trap applied to the channel itself) --
# already covered by the two existing files above, not repeated here.
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOOKS = ROOT / "scripts" / "hooks"
STOP_RULES = HOOKS / "stop-rules"
LIB = HOOKS / "lib"


def run_posttooluse(payload, state_path, tmp_path):
    """Spawns the REAL PostToolUse CLI entry point -- the observer's real entry point, per the
    brief's own top-level instruction."""
    env = {**os.environ, "ENFORCEMENT_STATE_PATH": str(state_path),
           "PRETOOLUSE_LOG_PATH": str(tmp_path / "hooks-log.jsonl")}
    r = subprocess.run(["node", str(HOOKS / "posttooluse.mjs")],
                        input=json.dumps(payload), capture_output=True, text=True,
                        encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, f"posttooluse.mjs must always exit 0:\n{r.stdout}\n{r.stderr}"
    return r


def read_events(state_path, session, kind):
    lib = (LIB / "enforcement-state.mjs").as_posix()
    src = (f"import {{ openState, recentEvents }} from 'file://{lib}';"
           f"const db = openState({json.dumps(str(state_path))});"
           f"console.log(JSON.stringify(recentEvents(db, {json.dumps(session)}, {json.dumps(kind)}, 0)));"
           "db.close();")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr
    return json.loads(r.stdout.strip())


def write_transcript(tmp_path, text, name="transcript.jsonl"):
    """Same minimal-but-real shape as test_arc2_phase4_rules.py / test_arc2_phase4_timestamp_gate.py's
    own helper: one assistant final-message turn, timestamped now so the 10-minute evidence window
    sees it as current."""
    p = tmp_path / name
    entry = {"type": "assistant",
              "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
              "message": {"role": "assistant",
                          "content": [{"type": "text", "text": text}]}}
    p.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def eval_stop_rule(rule_file, text, tmp_path, state_path, session):
    """Calls the REAL consumer rule's evaluate() -- the real reader, not a re-implementation of
    its query -- against a one-message transcript and the state store the observer already wrote
    to in the same test."""
    transcript = write_transcript(tmp_path, text)
    rule = (STOP_RULES / rule_file).as_posix()
    src = (f"import {{ evaluate }} from 'file://{rule}';"
           f"const out = await evaluate({{ session_id: {json.dumps(session)},"
           f" hook_event_name: 'Stop', transcript_path: {json.dumps(transcript.as_posix())},"
           f" cwd: {json.dumps(str(ROOT))} }});"
           "console.log(JSON.stringify(out ?? {}));")
    env = {**os.environ, "ENFORCEMENT_STATE_PATH": str(state_path)}
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


# =================================================================================================
# read-tracker.mjs  <->  cited-path-read.mjs (L63a)
# =================================================================================================

CITED_FILE = ROOT / "scripts" / "hooks" / "lib" / "claim-scan.mjs"
CITE_TEXT = "Per scripts/hooks/lib/claim-scan.mjs the field determined is the contract, and that is the justification."


def test_read_tracker_records_a_real_read_via_the_posttooluse_cli(tmp_path):
    """The observer's own real entry point (posttooluse.mjs), not a direct observe() call."""
    state = tmp_path / "state.sqlite"
    session = "s-arc4-read-e2e"
    post = {"session_id": session, "hook_event_name": "PostToolUse", "tool_name": "Read",
            "tool_input": {"file_path": str(CITED_FILE)},
            "tool_response": {"interrupted": False}, "agent_id": "actor-e2e"}
    run_posttooluse(post, state, tmp_path)
    rows = read_events(state, session, "file_read")
    assert len(rows) == 1, rows
    assert "claim-scan.mjs" in rows[0]["detail"]
    assert rows[0]["actorId"] == "actor-e2e"


def test_read_tracker_end_to_end_the_l63a_consumer_finds_the_real_read(tmp_path):
    """FULL CHAIN: a real Read tool event -> posttooluse.mjs -> read-tracker.mjs -> the SAME
    state store -> cited-path-read.mjs's real evaluate(). This is DoD-5's "a reader that never
    executes is still dead" proven end to end, not by seeding the row by hand."""
    state = tmp_path / "state.sqlite"
    session = "s-arc4-read-e2e-consumer"
    post = {"session_id": session, "hook_event_name": "PostToolUse", "tool_name": "Read",
            "tool_input": {"file_path": str(CITED_FILE)},
            "tool_response": {"interrupted": False}, "agent_id": "actor-e2e"}
    run_posttooluse(post, state, tmp_path)
    out = eval_stop_rule("cited-path-read.mjs", CITE_TEXT, tmp_path, state, session)
    assert out["decision"] == "allow", out
    assert "L63a satisfied" in out["reason"], out


def test_read_tracker_does_not_record_an_unrelated_tool_event(tmp_path):
    """Negative case: a Bash call (not a Read) must leave the file_read channel untouched."""
    state = tmp_path / "state.sqlite"
    session = "s-arc4-read-negative"
    post = {"session_id": session, "hook_event_name": "PostToolUse", "tool_name": "Bash",
            "tool_input": {"command": "echo hi"},
            "tool_response": {"interrupted": False, "stdout": "hi\n", "stderr": ""}}
    run_posttooluse(post, state, tmp_path)
    rows = read_events(state, session, "file_read")
    assert rows == [], rows
    # And the consumer, seeing zero rows for this session, degrades to allow (L57 trap) rather
    # than treating the unrelated event as "read".
    out = eval_stop_rule("cited-path-read.mjs", CITE_TEXT, tmp_path, state, session)
    assert out["decision"] == "allow", out
    assert "degraded" in out["reason"], out


# =================================================================================================
# clock-tracker.mjs  <->  timestamp-without-clock-read.mjs (L84)
# =================================================================================================

TIMESTAMP_TEXT = "המשימה בוצעה בשעה 16:40, הכל ירוק."


def test_clock_tracker_records_a_real_date_call_via_the_posttooluse_cli(tmp_path):
    """The observer's own real entry point (posttooluse.mjs), not a direct observe() call --
    the existing coverage in test_arc2_phase4_timestamp_gate.py calls observe() directly."""
    state = tmp_path / "state.sqlite"
    session = "s-arc4-clock-e2e"
    post = {"session_id": session, "hook_event_name": "PostToolUse", "tool_name": "Bash",
            "tool_input": {"command": "date +%s"},
            "tool_response": {"interrupted": False, "stdout": "1234567890\n", "stderr": ""}}
    run_posttooluse(post, state, tmp_path)
    rows = read_events(state, session, "clock_read")
    assert len(rows) == 1, rows
    assert "date" in rows[0]["detail"]


def test_clock_tracker_end_to_end_the_l84_consumer_finds_the_real_read(tmp_path):
    """FULL CHAIN: a real Bash `date` tool event -> posttooluse.mjs -> clock-tracker.mjs -> the
    SAME state store -> timestamp-without-clock-read.mjs's real evaluate()."""
    state = tmp_path / "state.sqlite"
    session = "s-arc4-clock-e2e-consumer"
    post = {"session_id": session, "hook_event_name": "PostToolUse", "tool_name": "Bash",
            "tool_input": {"command": "date"},
            "tool_response": {"interrupted": False, "stdout": "Tue Aug 11\n", "stderr": ""}}
    run_posttooluse(post, state, tmp_path)
    out = eval_stop_rule("timestamp-without-clock-read.mjs", TIMESTAMP_TEXT, tmp_path, state, session)
    assert out["decision"] == "allow", out
    assert "L84 satisfied" in out["reason"], out


def test_clock_tracker_does_not_record_an_unrelated_tool_event(tmp_path):
    """Negative case: a successful Read (not a Bash clock read) must leave the clock_read
    channel untouched, and the consumer must degrade to allow rather than warn on that emptiness."""
    state = tmp_path / "state.sqlite"
    session = "s-arc4-clock-negative"
    post = {"session_id": session, "hook_event_name": "PostToolUse", "tool_name": "Read",
            "tool_input": {"file_path": str(CITED_FILE)},
            "tool_response": {"interrupted": False}}
    run_posttooluse(post, state, tmp_path)
    rows = read_events(state, session, "clock_read")
    assert rows == [], rows
    out = eval_stop_rule("timestamp-without-clock-read.mjs", TIMESTAMP_TEXT, tmp_path, state, session)
    assert out["decision"] == "allow", out
    assert "degraded" in out["reason"], out
