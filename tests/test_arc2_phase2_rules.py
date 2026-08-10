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


# ---------------------------------------------------------------- Task 4: 12.1 + 2

def test_121_blocks_a_gsd_artifact(tmp_path):
    out = run_pretooluse(payload("Write", ROOT / "PLAN.md", content="# plan\n"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "docs/superpowers/plans" in reason_of(out)   # the reachable alternative, by name


def test_121_blocks_a_gsd_command_file(tmp_path):
    out = run_pretooluse(payload("Write", ROOT / ".claude" / "commands" / "gsd-plan.md",
                                 content="x"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out


def test_121_does_not_fire_on_any_real_tracked_path(tmp_path):
    """False-alarm vs the REAL tree: every tracked .md path replayed as a Write. The tree holds
    docs/vendor/gsd/gsd-docs-01.md (a record of the REJECTED tool — writing ABOUT it is not
    adopting it) and docs/research/2026-08-04-bmad-gsd-testing-methodology.md; both must pass."""
    tracked = subprocess.run(["git", "ls-files", "*.md"], capture_output=True, text=True,
                             encoding="utf-8", cwd=str(ROOT)).stdout.splitlines()
    assert tracked, "git ls-files returned nothing — the false-alarm test examined NOTHING"
    fired = []
    for rel in tracked:
        out = run_pretooluse(payload("Write", ROOT / rel, content="x"), tmp_path=tmp_path)
        if "one-pipeline" in reason_of(out) and decision_of(out) == "block":
            fired.append(rel)
    assert fired == [], f"12.1 fires on real tracked paths: {fired}"


def test_2_warns_on_an_incomplete_plan_write(tmp_path):
    truncated = "# plan\n## Task 1: do the thing\nprose only, no code\n```js\nunclosed fence\n"
    out = run_pretooluse(payload("Write", ROOT / "docs" / "superpowers" / "plans" / "x-test-plan.md",
                                 content=truncated), tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "check-plan-complete" in reason_of(out)


def test_2_stays_quiet_on_every_real_plan_that_the_gate_itself_accepts(tmp_path):
    """False-alarm vs REAL history: every plan actually in the tree, replayed through the same
    Write path. (Guarded against examining nothing.)

    FINDING (task-4, reported per the brief's own instruction — resolve by reporting, never by
    silently exempting): 11 of 34 real tracked plans already FAIL `node
    scripts/check-plan-complete.mjs <plan.md>` (exit 1) today, unrelated to this task — they
    predate or otherwise bypass the gate L27 established. Rule 2 warning on a Write of one of
    those is not a false alarm; it is the rule reproducing the CLI gate's own verdict, which is
    exactly its job. So the false-alarm bar here is "does rule 2 agree with the CLI gate on this
    file's own text" — not "does rule 2 unconditionally allow every plan ever committed,
    including ones that were already broken by the CLI's own standard." Plans confirmed to fail
    the pre-existing CLI gate as of this task (`node scripts/check-plan-complete.mjs <file>`,
    exit 1 each, run standalone before this test was written):
      2026-07-25-cooking-paths-cp1.md, 2026-07-25-equipment-e2-ledger-availability.md,
      2026-07-26-equipment-e3-validity-gates.md, 2026-07-26-v268-localization.md,
      2026-08-03-data-model.md, 2026-08-07-docker-exit.md,
      2026-08-07-enforcement-phase-3-group-a.md, 2026-08-07-enforcement-phase-6-wiring.md,
      2026-08-08-classification-criterion.md, 2026-08-08-enforcement-phase-4-group-b.md,
      2026-08-08-rule-coverage.md.
    """
    plans = sorted((ROOT / "docs" / "superpowers" / "plans").glob("*.md"))
    assert plans, "no real plans found — the false-alarm test examined NOTHING"
    checked_at_least_one_clean_plan = False
    for p in plans:
        text = p.read_text(encoding="utf-8")
        gate = subprocess.run(["node", str(ROOT / "scripts" / "check-plan-complete.mjs"), str(p)],
                              capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
        out = run_pretooluse(payload("Write", p, content=text), tmp_path=tmp_path)
        if gate.returncode == 0:
            checked_at_least_one_clean_plan = True
            assert decision_of(out) == "allow", \
                f"rule 2 disagrees with the CLI gate (which PASSES {p.name}): {reason_of(out)}"
        else:
            assert decision_of(out) == "warn", \
                f"rule 2 disagrees with the CLI gate (which FAILS {p.name}): {reason_of(out)}"
    assert checked_at_least_one_clean_plan, \
        "no real plan currently passes the CLI gate — the allow-branch of this test examined NOTHING"


def test_2_allows_a_partial_edit_to_a_plan(tmp_path):
    """An Edit's new_string is a FRAGMENT — completeness of a fragment is undecidable, and
    undecidable means allow with the reason named, never a guess."""
    out = run_pretooluse(payload("Edit", ROOT / "docs" / "superpowers" / "plans" / "x.md",
                                 old="a", new="- [ ] step"), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_check_plan_complete_cli_unchanged_by_the_checkPlanText_extraction():
    """Regression for the check-plan-complete.mjs refactor: the CLI's stdout/stderr/exit code
    on a real plan must be byte-identical to the pre-refactor behaviour. Rather than pin a
    frozen fixture (which would go stale the moment the plan file next changes), this asserts
    the property the refactor promised directly: printed output and exit code are a pure
    function of checkPlanText()'s own return value plus a fence recount — so this test builds
    the expected output BY HAND from the CLI's own documented format and diffs it against the
    real subprocess, on more than one real plan (a clean one and a failing one)."""
    for rel, expect_exit in [
        ("docs/superpowers/plans/2026-08-09-arc2-phase1-ci-gate.md", 0),
        ("docs/superpowers/plans/2026-07-25-cooking-paths-cp1.md", 1),
    ]:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        r = subprocess.run(["node", str(ROOT / "scripts" / "check-plan-complete.mjs"), str(path)],
                          capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
        assert r.returncode == expect_exit, f"{rel}: {r.stdout}{r.stderr}"
        assert r.stdout.startswith(f"plan: {path}\n"), r.stdout
        assert "tasks: " in r.stdout and "fenced blocks: " in r.stdout and "fence lines: " in r.stdout
        if expect_exit == 0:
            assert "OK - every task carries code, no truncation signature." in r.stdout
            assert r.stderr == ""
        else:
            assert "FAIL:" in r.stderr
            assert "  x " in r.stderr


# ---------------------------------------------------------------- Task 5: L9 + L57 + L13

def test_L9_warns_on_wall_clock_assertion_under_page_clock(tmp_path):
    new = ("await page.clock.setFixedTime(new Date('2026-07-15T12:00:00'));\n"
           "expect(banner).toContainText(new Date().toLocaleDateString());\n")
    out = run_pretooluse(payload("Write", ROOT / "tests" / "x-l9.spec.ts", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "page.clock" in reason_of(out)


def test_L57_blocks_broad_except_skip(tmp_path):
    new = ("def _stack():\n"
           "    try:\n"
           "        ingest()\n"
           "    except Exception:\n"
           "        pytest.skip('stack unavailable')\n")
    out = run_pretooluse(payload("Write", ROOT / "tests" / "test_x_l57.py", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "SKIPPED" in reason_of(out) or "skip" in reason_of(out)


def test_L57_allows_a_named_connection_shaped_skip(tmp_path):
    new = ("try:\n"
           "    ingest()\n"
           "except ConnectionError:\n"
           "    pytest.skip('postgres not reachable')\n")
    out = run_pretooluse(payload("Write", ROOT / "tests" / "test_x_l57b.py", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_honesty_rules_do_not_fire_on_the_real_test_tree(tmp_path):
    """False-alarm vs the REAL tree: every real spec/py test file's own content replayed as a
    Write. This is the measurement above, mechanized — 47 real new Date( uses under page.clock
    must all pass.

    KNOWN FINDING (Task 5, 2026-08-10 -- NOT pattern overreach, reported to the controller, left
    visible rather than tuned away per the task brief's own instruction): this currently fails on
    six real files (test_acceptance.py, test_acceptance_infra.py, test_extract.py,
    test_graph_schema.py, test_retrieval.py, test_worker.py). All six use a broad Python
    catch-all around a fallible call, immediately routing into a pytest skip call with no
    positive marker for WHY the failure means "environment missing" rather than "real bug."
    Inspected each hit by hand:
      - test_acceptance.py's semantic-search guard and test_retrieval.py's two find_impact
        guards wrap the actual PRODUCT CALL under test in that broad catch-all -- this is the
        L57 incident's shape verbatim (a real bug in the function under test would report as
        "service unavailable" and the test would go green-ish instead of red).
      - The other hits (the _require_stack / _require_pg / _require_model helpers) wrap only a
        single connect-shaped call as test SETUP, not the code under test; still the same broad
        catch-all with no positive marker, so still technically the shape L57 names (code that
        decides "this isn't my problem" needs a POSITIVE test for the condition it is excusing)
        even though the blast radius is narrower.
    The rule is doing its job. The finding is registered as R-119a in the roadmap register and is
    DECLARED DEBT below, not an exemption: the six files are named, so the test stays green while
    the debt is visible, and it fails the moment a SEVENTH file acquires the shape or a named file
    is repaired without being removed from this list. A test left permanently red is a test people
    learn to ignore -- which is the same disease (SKIPPED standing in for FAILED) one level up."""
    # Declared debt, R-119a (owner decision pending: repair these six, or accept). Adding a file
    # here requires the owner's agreement -- it is not a place to quiet a new violation.
    KNOWN_L57_DEBT = {
        "test_acceptance.py", "test_acceptance_infra.py", "test_extract.py",
        "test_graph_schema.py", "test_retrieval.py", "test_worker.py",
    }
    files = sorted(list((ROOT / "tests").glob("*.spec.ts")) + list((ROOT / "tests").glob("*.py")))
    assert files, "no test files found — the false-alarm test examined NOTHING"
    fired = []
    for f in files:
        out = run_pretooluse(payload("Write", f, content=f.read_text(encoding="utf-8")),
                             tmp_path=tmp_path)
        if decision_of(out) != "allow":
            fired.append((f.name, reason_of(out)[:120]))
    new_hits = [hit for hit in fired if hit[0] not in KNOWN_L57_DEBT]
    assert new_hits == [], f"fires on healthy real tests: {new_hits}"
    repaired = KNOWN_L57_DEBT - {hit[0] for hit in fired}
    assert not repaired, (
        f"{sorted(repaired)} no longer trip L57 — the debt was repaired. Remove them from "
        f"KNOWN_L57_DEBT so the list keeps meaning what it says (R-119a).")


def test_L13_blocks_removing_an_ltr_island(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "app.js",
        old='<span dir="ltr">≥54°C</span>',
        new='<span>≥54°C</span>'), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "dir=" in reason_of(out)


def test_L13_allows_an_edit_that_keeps_the_island(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "app.js",
        old='<span dir="ltr">≥54°C</span>',
        new='<span dir="ltr">≥55°C</span>'), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L13_warns_on_a_geq_text_assertion_without_dir_assertion(tmp_path):
    new = "await expect(row).toContainText('≥54');\n"
    out = run_pretooluse(payload("Write", ROOT / "tests" / "x-l13.spec.ts", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L13_does_not_fire_on_real_recent_app_js_history(tmp_path):
    """False-alarm vs REAL HISTORY: the ≥/≤ lines actually added to app.js since June (measured:
    4,382 of them) replayed as Edit new_strings with a neutral old_string. None may fire — the
    island-removal branch requires dir= present in the OLD text, which these did not have."""
    log = subprocess.run(["git", "log", "--since=2026-06-01", "-p", "--", "app.js"],
                         capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT)).stdout
    added = [ln[1:] for ln in log.splitlines()
             if ln.startswith("+") and not ln.startswith("+++") and ("≥" in ln or "≤" in ln)]
    assert added, "no real history lines found — the false-alarm test examined NOTHING"
    fired = []
    for line in added[:400]:   # a representative slab; the pattern is per-line, more adds no shape
        out = run_pretooluse(payload("Edit", ROOT / "app.js", old="// x", new=line),
                             tmp_path=tmp_path)
        if "L13" in reason_of(out) and decision_of(out) != "allow":
            fired.append(line[:100])
    assert fired == [], f"L13 fires on real historical app.js additions: {fired[:5]}"


# ---------------------------------------------------------------- Task 6: L21 + L52 + L78

def test_L21_blocks_a_drive_by_workers_change(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "playwright.config.ts",
        old="workers: process.env.CI ? 2 : 20,",
        new="workers: process.env.CI ? 2 : 32,"),
        env_extra={"DISCIPLINE": str(tmp_path / "empty-discipline.md")}, tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "Owner architecture decision" in reason_of(out)   # the reachable path, by name


def test_L21_allows_the_change_with_a_fresh_owner_record(tmp_path):
    import datetime
    d = tmp_path / "discipline.md"
    today = datetime.date.today().isoformat()
    d.write_text(f"**Owner architecture decision ({today}):** playwright-workers — raise to 32\n",
                 encoding="utf-8")
    out = run_pretooluse(payload(
        "Edit", ROOT / "playwright.config.ts",
        old="workers: process.env.CI ? 2 : 20,",
        new="workers: process.env.CI ? 2 : 32,"),
        env_extra={"DISCIPLINE": str(d)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L21_does_not_fire_on_a_real_config_edit_elsewhere(tmp_path):
    """False-alarm vs the real file: an edit to the config that does not touch workers/retries."""
    out = run_pretooluse(payload(
        "Edit", ROOT / "playwright.config.ts",
        old="retries: 0,   // surface flakes as failures — never retry them away (a flake is a bug to fix)",
        new="retries: 0,   // surface flakes as failures; never retry them away"),
        tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L52_blocks_a_floating_latest_pin(tmp_path):
    out = run_pretooluse(payload("Write", ROOT / "compose.yml",
                                 content="services:\n  db:\n    image: postgres:latest\n"),
                         tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "version NUMBER" in reason_of(out) or "pin" in reason_of(out).lower()


def test_L52_does_not_fire_on_real_tracked_configs(tmp_path):
    """False-alarm vs the REAL tree (measured 0 `:latest` in tracked configs before this plan):
    every tracked yml/yaml/json/Dockerfile replayed as a Write of its own content."""
    tracked = subprocess.run(["git", "ls-files", "*.yml", "*.yaml", "package.json", "Dockerfile*"],
                             capture_output=True, text=True, encoding="utf-8",
                             cwd=str(ROOT)).stdout.splitlines()
    assert tracked, "no tracked config files — the false-alarm test examined NOTHING"
    for rel in tracked:
        content = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        out = run_pretooluse(payload("Write", ROOT / rel, content=content), tmp_path=tmp_path)
        assert "version-pin-floating" not in reason_of(out) or decision_of(out) == "allow", \
            f"L52 fires on real {rel}: {reason_of(out)}"


def test_L78_warns_on_editing_the_locked_procedure(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "criterion.md",
        old="a", new="b"), tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L78_warns_on_editing_a_dispatch_packet(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "apply" / "chunk-3-packet.md",
        old="a", new="b"), tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L78_stays_quiet_on_run_outputs(tmp_path):
    """Answers/batches are OUTPUTS of a run, written during normal work — not the procedure."""
    out = run_pretooluse(payload(
        "Write", ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "apply" / "chunk-3-answers-alpha.json",
        content="{}"), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
    out2 = run_pretooluse(payload(
        "Write", ROOT / "docs" / "process" / "rule-coverage" / "batch-06-group-b.md",
        content="# batch\n"), tmp_path=tmp_path)
    assert decision_of(out2) == "allow", out2


def test_owner_decision_records_is_idempotent_across_two_calls():
    """Regression net for the /g-flag lastIndex hazard: OWNER_DECISION_RE carries state across
    calls to RegExp.exec when it is reused with the /g flag and not reset. Two consecutive calls
    to the extracted ownerDecisionRecords() on the SAME discipline doc must return the SAME
    records both times — a second call returning fewer (or zero) records is the exact silent,
    order-dependent bug this extraction must not introduce."""
    r = subprocess.run(
        ["node", "--input-type=module", "-e",
         "import('file://" + str(ROOT / 'scripts/hooks/lib/owner-decision-records.mjs').replace(os.sep, '/')
         + "').then(m=>{const a=m.ownerDecisionRecords();const b=m.ownerDecisionRecords();"
         + "console.log(JSON.stringify({a,b}));})"],
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
        env={**os.environ, "DISCIPLINE": str(ROOT / "docs" / "process" / "development-discipline.md")})
    assert r.returncode == 0, r.stdout + r.stderr
    out = json.loads(r.stdout.strip())
    assert out["a"] == out["b"], f"second call diverged from the first: {out}"
