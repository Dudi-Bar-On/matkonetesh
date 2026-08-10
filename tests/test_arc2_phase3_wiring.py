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
