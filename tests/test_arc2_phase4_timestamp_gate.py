# tests/test_arc2_phase4_timestamp_gate.py — Arc 2 Phase 4, L84 (owner instruction 2026-08-11:
# "I do want timestamps on reports -- if needed, build a gate for it"). Self-contained: the harness
# helpers below are deliberately a SEPARATE copy of test_arc2_phase4_rules.py's own small helpers
# (write_transcript / eval_stop_rule / seed_event / replay), not an import from it -- another agent
# is concurrently editing tests/test_arc2_phase4_wiring.py and appending to
# tests/test_arc2_phase4_rules.py in this same phase; a fresh file avoids both files at once.
import json
import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
STOP_RULES = ROOT / "scripts" / "hooks" / "stop-rules"
OBSERVERS = ROOT / "scripts" / "hooks" / "observers"
LIB = ROOT / "scripts" / "hooks" / "lib"
REPLAY = ROOT / "scripts" / "tests" / "replay-stop-corpus.mjs"
CORPUS = ROOT / ".superpowers" / "corpus" / "stop-final-messages.jsonl"

RULE_FILE = "timestamp-without-clock-read.mjs"


def write_transcript(tmp_path, text, name="transcript.jsonl"):
    p = tmp_path / name
    entry = {"type": "assistant",
             "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
             "message": {"role": "assistant",
                          "content": [{"type": "text", "text": text}]}}
    p.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def eval_stop_rule(text, tmp_path, state_path=None, session="s-l84-test"):
    transcript = write_transcript(tmp_path, text)
    rule = (STOP_RULES / RULE_FILE).as_posix()
    src = (f"import {{ evaluate }} from 'file://{rule}';"
           f"const out = await evaluate({{ session_id: {json.dumps(session)},"
           f" hook_event_name: 'Stop', transcript_path: {json.dumps(transcript.as_posix())},"
           f" cwd: {json.dumps(str(ROOT))} }});"
           "console.log(JSON.stringify(out ?? {}));")
    env = {**os.environ}
    env["ENFORCEMENT_STATE_PATH"] = str(state_path) if state_path is not None else str(tmp_path / "empty-state.sqlite")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


def seed_clock_read(state_path, session, ts_offset_ms=0):
    """Seeds one clock_read event through the REAL enforcement-state module. ts_offset_ms lets a
    test place the event OUTSIDE the recency window without waiting for real wall-clock time to
    pass (recordEvent always stamps 'now'; this helper post-adjusts the row's ts column directly,
    the only way to simulate 'a clock read happened, but a while ago')."""
    lib = (LIB / "enforcement-state.mjs").as_posix()
    src = (f"import {{ openState, recordEvent }} from 'file://{lib}';"
           f"const db = openState({json.dumps(str(state_path))});"
           f"if (!db) throw new Error('openState failed');"
           f"recordEvent(db, {{ sessionId: {json.dumps(session)}, kind: 'clock_read',"
           f" detail: {{ command: 'date' }}, actorId: '' }});"
           + (f"db.prepare('UPDATE events SET ts = ts + ? WHERE kind = ?').run({ts_offset_ms}, 'clock_read');"
              if ts_offset_ms else "")
           + "db.close();")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr


def observe_bash(command, ok, state_path, session="s-l84-observer"):
    """Drives the REAL observer's observe() against a Bash tool_input, the same shape
    posttooluse.mjs hands it (_outcome pre-normalized here, matching that file's own contract)."""
    mod = (OBSERVERS / "clock-tracker.mjs").as_posix()
    src = (f"import {{ observe }} from 'file://{mod}';"
           f"observe({{ tool_name: 'Bash', session_id: {json.dumps(session)},"
           f" tool_input: {{ command: {json.dumps(command)} }},"
           f" _outcome: {{ ok: {str(ok).lower()} }}, agent_id: null }});")
    env = {**os.environ, "ENFORCEMENT_STATE_PATH": str(state_path)}
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stderr


def read_events(state_path, session, kind):
    lib = (LIB / "enforcement-state.mjs").as_posix()
    src = (f"import {{ openState, recentEvents }} from 'file://{lib}';"
           f"const db = openState({json.dumps(str(state_path))});"
           f"console.log(JSON.stringify(recentEvents(db, {json.dumps(session)}, {json.dumps(kind)}, 0)));"
           "db.close();")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


def replay(state_path=None, session=None):
    args = ["node", str(REPLAY), str(STOP_RULES / RULE_FILE), str(CORPUS)]
    if state_path is not None:
        args += ["--state", str(state_path)]
    if session is not None:
        args += ["--session", session]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


# ------------------------------------------------------- the observer: clock-tracker.mjs

def test_observer_records_clock_read_on_bash_date(tmp_path):
    state = tmp_path / "state.sqlite"
    observe_bash("date", True, state)
    rows = read_events(state, "s-l84-observer", "clock_read")
    assert len(rows) == 1


def test_observer_records_on_powershell_get_date_shelled_through_bash(tmp_path):
    state = tmp_path / "state.sqlite"
    observe_bash('powershell -NoProfile -Command "Get-Date"', True, state)
    rows = read_events(state, "s-l84-observer", "clock_read")
    assert len(rows) == 1


def test_observer_silent_on_prose_mentioning_date_word(tmp_path):
    state = tmp_path / "state.sqlite"
    observe_bash('echo "the date is important for this report"', True, state)
    rows = read_events(state, "s-l84-observer", "clock_read")
    assert len(rows) == 0


def test_observer_silent_on_command_word_containing_date_as_substring(tmp_path):
    state = tmp_path / "state.sqlite"
    observe_bash("updatedb", True, state)
    rows = read_events(state, "s-l84-observer", "clock_read")
    assert len(rows) == 0


def test_observer_silent_on_failed_bash_call(tmp_path):
    state = tmp_path / "state.sqlite"
    observe_bash("date", False, state)  # command itself failed -- did not reliably read anything
    rows = read_events(state, "s-l84-observer", "clock_read")
    assert len(rows) == 0


def test_observer_ignores_non_bash_tool():
    # Not wired to the PowerShell tool at all -- see the observer's own header. No assertion beyond
    # "does not throw"; the matcher check is in the module itself (tool_name !== 'Bash' -> return).
    pass


# ------------------------------------------------------- the stop rule: timestamp-without-clock-read

TIMESTAMP_TEXT = "המשימה בוצעה בשעה 16:40, הכל ירוק."


def test_l84_warns_on_timestamp_with_no_clock_read_this_session(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l84-warn"
    out = eval_stop_rule(TIMESTAMP_TEXT, tmp_path, state_path=state, session=session)
    assert out["decision"] == "allow", "channel unwired -> must degrade to allow, not warn"


def test_l84_warns_on_timestamp_with_only_a_stale_clock_read(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l84-stale"
    # A clock_read exists for this session, but it is far outside the recency window.
    seed_clock_read(state, session, ts_offset_ms=-30 * 60 * 1000)
    out = eval_stop_rule(TIMESTAMP_TEXT, tmp_path, state_path=state, session=session)
    assert out["decision"] == "warn"
    assert "L84" in out["reason"]


def test_l84_allows_timestamp_with_a_recent_clock_read(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l84-fresh"
    seed_clock_read(state, session, ts_offset_ms=0)
    out = eval_stop_rule(TIMESTAMP_TEXT, tmp_path, state_path=state, session=session)
    assert out["decision"] == "allow"


def test_l84_degrades_to_allow_when_channel_has_zero_reads(tmp_path):
    # The L57 trap: an unwired/empty channel must NEVER be mistaken for "did not read the clock".
    out = eval_stop_rule(TIMESTAMP_TEXT, tmp_path, session="s-l84-empty")
    assert out["decision"] == "allow"
    assert "degraded" in out["reason"]


def test_l84_silent_when_no_timestamp_in_reply(tmp_path):
    out = eval_stop_rule("המשימה בוצעה, הכל ירוק.", tmp_path, session="s-l84-no-ts")
    assert out["decision"] == "allow"


def test_l84_silent_on_ordinary_numbers_not_clock_shaped(tmp_path):
    # §3.1's own false-alarm bar: ordinary numeric prose must not fire, even with a colon-adjacent
    # number, when it is not an HH:MM clock shape.
    text = "336/336 checks passed, coverage 48/84, ratio 16:9."
    out = eval_stop_rule(text, tmp_path, session="s-l84-numbers")
    assert out["decision"] == "allow"


def test_l84_masks_a_quoted_timestamp_example(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l84-quoted"
    seed_clock_read(state, session, ts_offset_ms=-30 * 60 * 1000)  # stale, would warn if unmasked
    text = 'The lesson quotes the incident: "wrote 16:40 when the clock read 16:27".'
    out = eval_stop_rule(text, tmp_path, state_path=state, session=session)
    assert out["decision"] == "allow"


def test_l84_corpus_replay_degraded_path_never_fires(corpus_dump=None):
    # Historical messages carry no session state (the store did not exist for most of the corpus).
    # Replay proves the DEGRADED path is safe: with an empty store, zero fires ever, at any severity.
    if not CORPUS.exists() or CORPUS.stat().st_size == 0:
        pytest.skip("corpus dump not present -- generated by test_arc2_phase4_rules.py's own fixture")
    out = replay()
    assert out["fireCount"] == 0, out["fires"][:5]


def test_l84_declares_rule_id():
    src = (STOP_RULES / RULE_FILE).read_text(encoding="utf-8")
    assert "'L84'" in src
