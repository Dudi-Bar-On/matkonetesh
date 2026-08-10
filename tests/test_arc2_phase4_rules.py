# tests/test_arc2_phase4_rules.py — Arc 2 Phase 4: the 8 `stop` rules. Per-rule catch +
# false-alarm tests; false alarms replayed against the REAL 9,093-final-message corpus
# (scripts/tests/measure-stop-corpus.py --dump + replay-stop-corpus.mjs), never invented input.
import json
import os
import socket
import subprocess
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
STOP_RULES = ROOT / "scripts" / "hooks" / "stop-rules"
LIB = ROOT / "scripts" / "hooks" / "lib"
REPLAY = ROOT / "scripts" / "tests" / "replay-stop-corpus.mjs"
CORPUS = ROOT / ".superpowers" / "corpus" / "stop-final-messages.jsonl"


def node_eval(expr):
    """Evaluates one JS expression against claim-scan.mjs in a node process."""
    lib = (LIB / "claim-scan.mjs").as_posix()
    src = f"import * as C from 'file://{lib}'; console.log(JSON.stringify({expr}));"
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


def write_transcript(tmp_path, text, name="transcript.jsonl"):
    """One assistant final message, the shape a Stop hook reads (timestamp = now so the
    10-minute evidence window sees this turn as current)."""
    p = tmp_path / name
    entry = {"type": "assistant",
             "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
             "message": {"role": "assistant",
                          "content": [{"type": "text", "text": text}]}}
    p.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def eval_stop_rule(rule_file, text, tmp_path, state_path=None, session="s-phase4-test",
                   env_extra=None):
    """Runs ONE stop-rule module's evaluate() against a one-message transcript, via a tiny
    node driver (not the full CLI — per-rule tests must not trip sibling rules)."""
    transcript = write_transcript(tmp_path, text)
    rule = (STOP_RULES / rule_file).as_posix()
    src = (f"import {{ evaluate }} from 'file://{rule}';"
           f"const out = await evaluate({{ session_id: {json.dumps(session)},"
           f" hook_event_name: 'Stop', transcript_path: {json.dumps(transcript.as_posix())},"
           f" cwd: {json.dumps(str(ROOT))} }});"
           "console.log(JSON.stringify(out ?? {}));")
    env = {**os.environ, **(env_extra or {})}
    if state_path is not None:
        env["ENFORCEMENT_STATE_PATH"] = str(state_path)
    else:
        env["ENFORCEMENT_STATE_PATH"] = str(tmp_path / "empty-state.sqlite")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


def seed_event(state_path, session, kind, file_path):
    """Seeds one event through the REAL enforcement-state module (no hand-rolled SQL)."""
    lib = (LIB / "enforcement-state.mjs").as_posix()
    src = (f"import {{ openState, recordEvent }} from 'file://{lib}';"
           f"const db = openState({json.dumps(str(state_path))});"
           f"if (!db) throw new Error('openState failed');"
           f"recordEvent(db, {{ sessionId: {json.dumps(session)}, kind: {json.dumps(kind)},"
           f" detail: {{ filePath: {json.dumps(file_path)} }}, actorId: '' }});"
           "db.close();")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr


@pytest.fixture(scope="session")
def corpus_dump():
    """Regenerates the dump once per pytest run via the ONE corpus reader (R-116)."""
    CORPUS.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["python", str(ROOT / "scripts" / "tests" / "measure-stop-corpus.py"),
                        "--dump", str(CORPUS)],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr
    assert CORPUS.exists() and CORPUS.stat().st_size > 0
    return CORPUS


def replay(rule_file, corpus_path, state_path=None, session=None):
    args = ["node", str(REPLAY), str(STOP_RULES / rule_file), str(corpus_path)]
    if state_path is not None:
        args += ["--state", str(state_path)]
    if session is not None:
        args += ["--session", session]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


# ------------------------------------------------------- Task 1: maskQuotedProse + retrofit

def test_mask_preserves_length_and_blanks_fences():
    text = "before ```echo done``` after"
    out = node_eval(f"C.maskQuotedProse({json.dumps(text)})")
    assert len(out) == len(text)
    assert "done" not in out
    assert "before" in out and "after" in out


def test_mask_blanks_double_quoted_and_blockquote_but_keeps_prose():
    text = 'הבקר אמר: "הכל ירוק ובוצע" ואני עדיין בודק\n> once it works, say done\nשורה רגילה'
    out = node_eval(f"C.maskQuotedProse({json.dumps(text)})")
    assert "ירוק" not in out and "works" not in out
    assert "שורה רגילה" in out


def test_mask_keep_inline_code_option():
    text = "the file `docs/x.md` landed"
    kept = node_eval(f"C.maskQuotedProse({json.dumps(text)}, {{keepInlineCode: true}})")
    masked = node_eval(f"C.maskQuotedProse({json.dumps(text)})")
    assert "docs/x.md" in kept
    assert "docs/x.md" not in masked


def test_r133_class_quoted_claim_no_longer_detected():
    # R-133: verify-before-success-claim fired on a message containing NO claim — only a
    # quotation of an instruction given to a subagent. The masked detector must stay silent.
    text = 'שלחתי לסוכן את ההוראה: "run the suite until it works and reply that it is done".'
    assert node_eval(f"C.detectsSuccessClaim({json.dumps(text)})") is False


def test_unquoted_claim_still_detected():
    assert node_eval("C.detectsSuccessClaim('הבדיקות עברו והכל ירוק')") is True


def test_live_claim_masked_when_quoted():
    text = 'ה-CLAUDE.md אומר: "never tell the owner a version is live until Playwright verified".'
    assert node_eval(f"C.detectsLiveClaim({json.dumps(text)})") is False


# ------------------------------------------------------- Task 2: DoD-3 rides rule 1's detector

def test_dod3_declared_on_verify_before_success_claim():
    src = (STOP_RULES / "verify-before-success-claim.mjs").read_text(encoding="utf-8")
    assert "'DoD-3'" in src, "DoD-3 must be enforced by the EXISTING claim detector (R-116)"


def test_dod3_catch_green_claim_without_pasted_output(tmp_path):
    out = eval_stop_rule("verify-before-success-claim.mjs",
                         "הרצתי את הסוויטה והכל ירוק, המשימה בוצעה.", tmp_path)
    assert out["decision"] == "block"


def test_dod3_false_alarm_green_claim_with_pasted_output(tmp_path):
    text = ("הסוויטה ירוקה:\n```\n1197 passed (54s)\nexit code 0\n```")
    out = eval_stop_rule("verify-before-success-claim.mjs", text, tmp_path)
    assert out["decision"] == "allow"

# NOTE (task-2-report.md "Corpus replay / blocking finding"): the brief's Step 5 corpus-replay
# test (`assert out["fireCount"] <= 200`) is deliberately NOT added here. Measured fireCount on
# the real corpus is 610 — identical to Task 1's own already-recorded baseline for this exact,
# unchanged rule (Task 2 touches only the RULE_IDS export, no detection logic). A 20-fire sample
# classified 13/20 (65%) as false alarms (mostly security/code-review "Analysis complete..."
# narratives, not GREEN/test claims). This trips the brief's own stated STOP condition ("Any
# legitimate-work fire -> STOP, investigate, narrow, re-run before committing") and narrowing the
# detector to chase the threshold would violate the R-116 "no second detector" decision recorded
# in verify-before-success-claim.mjs's own header. Left for an explicit owner decision rather than
# silently forcing a red test green or silently reinterpreting the brief's threshold (Waiver Gate,
# CLAUDE.md §4). See task-2-report.md for the full 20-fire table.

# ------------------------------------------------------- Task 3: 10.6 + H9 summary shape

CLOSE_NO_SHAPE = "משימה 3 הושלמה. עברתי על הקבצים ותיקנתי את הבדיקות."
CLOSE_WITH_PARTS = (
    "משימה 3 הושלמה.\n**DONE** תוקנו הבדיקות (commit abc123).\n"
    "**NEXT** משימה 4.\n**LEFT UNTIL THE GRAND FINAL** 12 סגורים / 31.")
CLOSE_WITH_TABLE = (
    "משימה 3 הושלמה.\n| # | שורה | תוכן |\n|---|---|---|\n"
    "| 1 | מה היה | הבדיקות אדומות |\n| 2 | מה נעשה | תוקן |\n"
    "| 3 | מה נשאר | — |\n| 4 | איפה אנחנו | Phase 4, 3/9 |\n| 5 | הבא בתור | משימה 4 |")
ORDINARY_REPLY = "אני קורא עכשיו את claim-scan.mjs כדי להבין את החוזה של lastAssistantText."


def test_summary_shape_warns_on_bare_task_close(tmp_path):
    out = eval_stop_rule("task-close-summary-shape.mjs", CLOSE_NO_SHAPE, tmp_path)
    assert out["decision"] == "warn"
    assert "10.6" in out["reason"] and "H9" in out["reason"]


def test_summary_shape_silent_with_three_parts(tmp_path):
    assert eval_stop_rule("task-close-summary-shape.mjs", CLOSE_WITH_PARTS, tmp_path)["decision"] == "allow"


def test_summary_shape_silent_with_h9_table(tmp_path):
    assert eval_stop_rule("task-close-summary-shape.mjs", CLOSE_WITH_TABLE, tmp_path)["decision"] == "allow"


def test_summary_shape_silent_on_ordinary_reply(tmp_path):
    assert eval_stop_rule("task-close-summary-shape.mjs", ORDINARY_REPLY, tmp_path)["decision"] == "allow"


def test_summary_shape_silent_on_quoted_close(tmp_path):
    # The rule must not fire on prose QUOTING a task-close (this arc's dominant noise class).
    text = 'ה-plan אומר: "משימה 3 הושלמה" — אבל אני עדיין באמצע.'
    assert eval_stop_rule("task-close-summary-shape.mjs", text, tmp_path)["decision"] == "allow"


def test_summary_shape_corpus_replay(corpus_dump):
    out = replay("task-close-summary-shape.mjs", corpus_dump)
    # warn-severity: still zero fires on legitimate work. A fire on a REAL past task-close that
    # shipped without the shape is the rule working — classify every sampled fire.
    assert out["fireCount"] <= 150, f"trigger too loose: {out['fireCount']}"


# ------------------------------------------------------- Task 4: L23a percentage↔artifact

def test_l23a_warns_on_translation_pct_without_artifact(tmp_path):
    out = eval_stop_rule("percentage-artifact.mjs",
                         "כיסוי התרגום בצרפתית עומד על 97% וזה שיפור יפה.", tmp_path)
    assert out["decision"] == "warn"
    assert "L23a" in out["reason"]


def test_l23a_allows_pct_with_named_artifact(tmp_path):
    text = ("כיסוי התרגום בצרפתית: 97% — נמדד ב-rendered DOM, הקובץ "
            "`mockups/fr-coverage-390x844.png` מצורף.")
    assert eval_stop_rule("percentage-artifact.mjs", text, tmp_path)["decision"] == "allow"


def test_l23a_silent_on_non_domain_percentage(tmp_path):
    # A percentage OUTSIDE the lesson's domain (CPU, progress, humidity) never fires.
    text = "המאוורר עומד על 40% והבשר בשעה השלישית."
    assert eval_stop_rule("percentage-artifact.mjs", text, tmp_path)["decision"] == "allow"


def test_l23a_silent_on_quoted_lesson_text(tmp_path):
    text = 'הלקח אומר: "a translation percentage like 99% with no artifact is blocked".'
    assert eval_stop_rule("percentage-artifact.mjs", text, tmp_path)["decision"] == "allow"


def test_l23a_corpus_replay(corpus_dump):
    out = replay("percentage-artifact.mjs", corpus_dump)
    assert out["fireCount"] <= 60, f"domain narrowing failed: {out['fireCount']}"
