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


# ---------------------------------------------------------------- Task 2: L16 + L56

DISCIPLINE = ROOT / "docs" / "process" / "development-discipline.md"


def test_L16_blocks_claude_md_edit_when_discipline_never_read(tmp_path):
    state = tmp_path / "state.sqlite"
    # Channel proven live: SOME file was read this session by SOME actor — just not the source.
    seed(state, "event", "s-l16", "actor-a", "file_read", str(ROOT / "app.js"))
    out = run_pretooluse(
        payload("Edit", ROOT / "CLAUDE.md", old="## Session start", new="## Session start (v2)",
                session="s-l16", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "development-discipline.md" in reason_of(out)   # the reachable alternative, by name


def test_L16_allows_claude_md_edit_after_the_source_was_read(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "event", "s-l16b", "actor-a", "file_read", str(DISCIPLINE))
    out = run_pretooluse(
        payload("Edit", ROOT / "CLAUDE.md", old="x", new="y", session="s-l16b", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L16_fails_open_when_the_channel_shows_no_traffic(tmp_path):
    """The L57 trap applied to ourselves: an EMPTY file_read channel cannot distinguish "the
    actor read nothing" from "the Read matcher is not wired." Absence of the channel is not
    evidence — allow, with the degradation named."""
    state = tmp_path / "state.sqlite"   # store exists after first open, but zero file_read rows
    out = run_pretooluse(
        payload("Edit", ROOT / "CLAUDE.md", old="x", new="y", session="s-l16c", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L16_does_not_fire_on_ordinary_real_files(tmp_path):
    """False-alarm vs the real tree: an app.js edit (the single most common real Edit target in
    this repo's history) must never be L16's business, whatever the channel says."""
    state = tmp_path / "state.sqlite"
    seed(state, "event", "s-l16d", "actor-a", "file_read", str(ROOT / "app.js"))
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="const a=1", new="const a=2",
                session="s-l16d", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert "derived-artifact-source" not in reason_of(out), out


def test_L56_warns_once_on_implementation_edit_without_reading_the_governing_spec(tmp_path):
    state = tmp_path / "state.sqlite"
    # A real arc fixture: SDD ledger + a governing spec file, via session-state.mjs's own seams.
    sdd = tmp_path / "sdd" / "some-plan"; sdd.mkdir(parents=True)
    (sdd / "progress.md").write_text("# progress\n", encoding="utf-8")
    specs = tmp_path / "specs"; specs.mkdir()
    spec = specs / "2026-08-09-arc2-enforcement-implementation-design.md"
    spec.write_text("# spec\n", encoding="utf-8")
    env = {"ENFORCEMENT_STATE_PATH": str(state), "SDD_DIR": str(tmp_path / "sdd"),
           "SPECS_DIR": str(specs)}
    seed(state, "event", "s-l56", "actor-a", "file_read", str(ROOT / "app.js"))  # channel live
    out = run_pretooluse(payload("Edit", ROOT / "app.js", old="a", new="b",
                                 session="s-l56", agent="actor-a"),
                         env_extra=env, tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert spec.name in reason_of(out)
    # And ONCE only — the second identical edit passes silently (the throttle event).
    out2 = run_pretooluse(payload("Edit", ROOT / "app.js", old="b", new="c",
                                  session="s-l56", agent="actor-a"),
                          env_extra=env, tmp_path=tmp_path)
    assert decision_of(out2) == "allow", out2


def test_L56_stays_quiet_when_the_spec_was_read(tmp_path):
    state = tmp_path / "state.sqlite"
    sdd = tmp_path / "sdd" / "some-plan"; sdd.mkdir(parents=True)
    (sdd / "progress.md").write_text("# progress\n", encoding="utf-8")
    specs = tmp_path / "specs"; specs.mkdir()
    spec = specs / "2026-08-09-arc2-enforcement-implementation-design.md"
    spec.write_text("# spec\n", encoding="utf-8")
    env = {"ENFORCEMENT_STATE_PATH": str(state), "SDD_DIR": str(tmp_path / "sdd"),
           "SPECS_DIR": str(specs)}
    seed(state, "event", "s-l56b", "actor-a", "file_read", str(spec))
    out = run_pretooluse(payload("Edit", ROOT / "app.js", old="a", new="b",
                                 session="s-l56b", agent="actor-a"),
                         env_extra=env, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


# ---------------------------------------------------------------- Task 3: 10.14

def transcript_with(tmp_path, blocks, ts=None, agent=None):
    """Writes a minimal-but-real-shaped transcript JSONL (the shape measured in
    skill-invoked.mjs's own header) containing the given content blocks.

    BRIEF CORRECTION (task-3): the brief's own version of this helper always wrote the content
    directly at the returned `transcript_path`. That is only correct for the main-session actor.
    Per skill-invoked.mjs's own measured contract (reused unchanged by research-evidence.mjs via
    resolveActorTranscriptPath) a DISPATCHED SUBAGENT's own tool_use turns never land in the
    top-level transcript_path — they land in a sibling sidechain file,
    `<dir>/<basename-without-ext>/subagents/agent-<agentId>.jsonl`, fully determined by
    transcript_path + agent_id. A test that passes `agent=` but writes to the plain path is
    seeding evidence in a file the rule under test will never read for that actor — proven by
    running the brief's original fixture: it produced a false GREEN (RED never observed for the
    right reason). Passing `agent=` here now writes to that real sidechain path, matching every
    other actor-scoped fixture in this arc (see scripts/tests/test-hooks-groupb.mjs's own
    `sidechainDir = join(work, sessionDir, 'subagents')` pattern, section 9).

    THIRD BRIEF CORRECTION: the brief's own default hardcoded a literal ".000Z" suffix, always
    truncating to whole seconds. `lastFailureTs` in the real store carries genuine millisecond
    precision (`Date.now()` in enforcement-state.mjs). A transcript entry sharing the SAME second
    as the seeded failure but truncated to :000 sorts BEFORE the failure's real millisecond
    component the majority of the time (`ts < since` in research-evidence.mjs), silently excluding
    real evidence — reproduced directly: the brief's exact helper made
    test_1014_stays_quiet_when_research_happened fail depending on wall-clock timing between the
    seed call and this write, for a reason having nothing to do with the rule under test. Real
    Claude Code transcript timestamps carry millisecond precision — preserving the real
    millisecond component here is the more faithful fixture, not a workaround."""
    import datetime
    now = datetime.datetime.utcnow()
    ts = ts or now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"
    line = {"type": "assistant", "timestamp": ts, "message": {"content": blocks}}
    transcript_path = tmp_path / "transcript.jsonl"
    if agent:
        d = tmp_path / "transcript" / "subagents"
        d.mkdir(parents=True, exist_ok=True)
        target = d / f"agent-{agent}.jsonl"
    else:
        target = transcript_path
    target.write_text(json.dumps(line) + "\n", encoding="utf-8")
    return transcript_path


def test_1014_warns_on_third_fix_cycle_without_research(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014", "actor-a", "tests/foo.spec.ts", "2")
    t = transcript_with(tmp_path, [{"type": "text", "text": "just thinking"}], agent="actor-a")
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014",
                agent="actor-a", transcript=t),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "10.14" in reason_of(out) and "geniza" in reason_of(out).lower()


def test_1014_stays_quiet_when_research_happened(tmp_path):
    """False-alarm side: the retrieval command in the transcript is the REAL call shape from
    CLAUDE.md's own documented API — retrieval.search_current_docs — not an invented token."""
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014b", "actor-a", "tests/foo.spec.ts", "2")
    t = transcript_with(tmp_path, [{"type": "tool_use", "name": "Bash", "input": {
        "command": "py -3 -c \"from src.knowledge import retrieval; "
                   "print(retrieval.search_current_docs('playwright webServer timeout'))\""}}],
        agent="actor-a")
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014b",
                agent="actor-a", transcript=t),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_1014_stays_quiet_below_two_cycles(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014c", "actor-a", "tests/foo.spec.ts", "1")
    t = transcript_with(tmp_path, [{"type": "text", "text": "nothing"}])
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014c",
                agent="actor-a", transcript=t),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_1014_fails_open_on_unreadable_transcript(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014d", "actor-a", "tests/foo.spec.ts", "2")
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014d",
                agent="actor-a", transcript=tmp_path / "no-such.jsonl"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
