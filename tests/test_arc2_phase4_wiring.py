# tests/test_arc2_phase4_wiring.py — Arc 2 Phase 4 closure: coverage, liveness with NO env
# overrides (spec §3.4 — this phase family once shipped a stop rule inert behind a test-only
# env var while 333 tests passed), and measured overhead.
import json
import os
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOP_CLI = ROOT / "scripts" / "hooks" / "stop.mjs"
PHASE4_IDS = {"10.6", "DoD-3", "H9", "L12", "L14", "L23a", "L63a", "L64a"}


def _transcript(tmp_path, text):
    p = tmp_path / "transcript.jsonl"
    entry = {"type": "assistant",
             "timestamp": datetime.now(timezone.utc).isoformat(),
             "message": {"role": "assistant",
                          "content": [{"type": "text", "text": text}]}}
    p.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def _run_stop_cli_no_overrides(payload):
    """THE liveness contract: env is inherited UNMODIFIED — nothing set, nothing stripped.
    If STOP_RULES_DIR etc. leak into the ambient environment, that is a finding to report,
    not something to silently launder here."""
    for var in ("STOP_RULES_DIR", "ENFORCEMENT_STATE_PATH", "PRETOOLUSE_LOG_PATH"):
        assert var not in os.environ, f"{var} set in ambient env — liveness run would be a lie"
    r = subprocess.run(["node", str(STOP_CLI)], input=json.dumps(payload),
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout) if r.stdout.strip() else {}


def test_phase4_ids_in_coverage_baseline():
    data = json.loads((ROOT / "docs" / "process" / "rule-coverage-baseline.json")
                      .read_text(encoding="utf-8"))
    assert PHASE4_IDS.issubset(set(data["covered"]))


def test_rule_coverage_gate_green():
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr


def test_liveness_stop_cli_warns_l23a_with_no_env_overrides(tmp_path):
    # The fixture violates ONLY L23a: a translation percentage, no artifact, no claim word
    # (rule 1 silent), no live word, no cited repo path, no task-close phrasing. L23a is a WARN
    # (owner ruling) — through the real CLI, toStopOutput() carries warn as a systemMessage
    # with NO decision field. This run proves a Phase-4 rule loads via the real entry point
    # with zero env overrides — the inert-rule failure this test exists to make impossible.
    t = _transcript(tmp_path, "כיסוי התרגום בגרמנית עומד על 96% וממשיכים.")
    out = _run_stop_cli_no_overrides({
        "session_id": "s-phase4-liveness",
        "hook_event_name": "Stop",
        "transcript_path": str(t),
        "stop_hook_active": False,
    })
    assert "L23a" in out.get("systemMessage", ""), out
    assert out.get("decision") != "block", out


def test_liveness_stop_cli_allows_benign_reply(tmp_path):
    t = _transcript(tmp_path, "קראתי את הקובץ ואני ממשיך לקרוא את הבא.")
    out = _run_stop_cli_no_overrides({
        "session_id": "s-phase4-liveness-benign",
        "hook_event_name": "Stop",
        "transcript_path": str(t),
        "stop_hook_active": False,
    })
    assert out.get("decision") != "block", out


def test_overhead_measured_and_sane(tmp_path):
    # The stop hook fires ONCE PER TURN, not once per tool call — the 61ms Phase-4 baseline and
    # ~78ms PreToolUse worst are per-tool-call numbers and are NOT the bar here (spec §3.5,
    # controller directive). Numbers are printed for the report; only a pathology ceiling is
    # asserted.
    t = _transcript(tmp_path, "הודעה רגילה בלי שום טענה.")
    payload = json.dumps({"session_id": "s-phase4-overhead", "hook_event_name": "Stop",
                          "transcript_path": str(t), "stop_hook_active": False})
    times = []
    for _ in range(15):
        t0 = time.perf_counter()
        subprocess.run(["node", str(STOP_CLI)], input=payload, capture_output=True,
                       text=True, encoding="utf-8", cwd=str(ROOT))
        times.append((time.perf_counter() - t0) * 1000)
    med, worst = statistics.median(times), max(times)
    print(f"\nstop.mjs overhead: median {med:.0f}ms, worst {worst:.0f}ms over 15 runs "
          f"(per-TURN budget; PreToolUse per-call numbers deliberately not imported)")
    assert worst < 2000, f"pathological stop overhead: {worst:.0f}ms"
