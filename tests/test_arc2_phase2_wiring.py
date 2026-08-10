# tests/test_arc2_phase2_wiring.py — Arc 2 Phase 2, Task 7. Liveness, coverage, overhead.
import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PHASE2_RULES = ["10.14", "12.1", "2", "L13", "L16", "L21", "L52", "L56", "L57", "L78", "L9"]


def test_phase2_rules_are_live_through_the_real_entry_point_with_no_env_overrides():
    """§3.4 — THE liveness test. A stop rule once shipped inert behind a test-only env var while
    333 tests passed. This spawns the REAL CLI with the environment UNTOUCHED — no
    PRETOOLUSE_RULES_DIR, no ENFORCEMENT_STATE_PATH, nothing — and requires a deterministic,
    stateless rule from this phase (12.1: a GSD artifact path) to block. One rule proving
    discovery proves the directory listing that loads all nine files."""
    payload = {"session_id": "s-liveness-arc2p2", "hook_event_name": "PreToolUse",
               "tool_name": "Write", "cwd": str(ROOT),
               "tool_input": {"file_path": str(ROOT / "PLAN.md"), "content": "# plan\n"}}
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env={**os.environ})
    assert r.returncode == 0
    out = json.loads(r.stdout)
    h = out.get("hookSpecificOutput", {})
    assert h.get("permissionDecision") == "deny", (
        f"12.1 did not fire through the real entry point — the phase's rules are NOT live:\n{r.stdout}")
    assert "12.1" in h.get("permissionDecisionReason", "")


def test_the_loader_evaluates_every_rule_file_on_disk_no_env_overrides():
    """The 12.1 live-fire above proves ONE rule reached the pipeline and inferred the rest were
    loaded. That inference is exactly the shape that shipped an inert stop rule in Phase 4, so it
    is not left as an inference: the pipeline logs `rules_evaluated`, and this asserts it equals
    the number of rule files actually on disk — a DERIVED expectation, never a pinned count
    (L64b: the '41 of 82' target broke within hours because writing a lesson adds a rule).
    Run with the environment untouched, so the log path is the repo's real one."""
    on_disk = sorted(p.name for p in (ROOT / "scripts" / "hooks" / "rules").glob("*.mjs"))
    assert on_disk, "no rule files found — this test examined NOTHING"
    log = ROOT / ".superpowers" / "hooks-log.jsonl"
    before = log.stat().st_size if log.exists() else 0
    payload = {"session_id": "s-loadcount-arc2p2", "hook_event_name": "PreToolUse",
               "tool_name": "Write", "cwd": str(ROOT),
               "tool_input": {"file_path": str(ROOT / "README.md"), "content": "x\n"}}
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env={**os.environ})
    assert r.returncode == 0, r.stdout + r.stderr
    assert log.exists(), "the pipeline wrote no log line — cannot prove what it loaded"
    with log.open(encoding="utf-8") as fh:
        fh.seek(before)
        lines = [ln for ln in fh.read().splitlines() if ln.strip()]
    assert lines, "no new log line for this invocation"
    entry = json.loads(lines[-1])
    # R-120 changed what "loaded everything" means: rules are now skipped by declared tool scope,
    # so equality with the file count would be WRONG to assert — it would forbid the optimisation
    # rather than check it. What must still hold is that nothing falls out of the accounting.
    assert entry.get("rules_on_disk") == len(on_disk), (
        f"the pipeline saw {entry.get('rules_on_disk')} rule file(s), {len(on_disk)} are on disk")
    evaluated = entry.get("rules_evaluated")
    skipped = entry.get("rules_skipped_by_tool_scope")
    assert evaluated + skipped == len(on_disk), (
        f"{evaluated} evaluated + {skipped} skipped != {len(on_disk)} on disk — a rule left the "
        f"load path without being accounted for, which is the Phase-4 inert-rule failure wearing "
        f"an optimisation as a disguise:\n{on_disk}")
    assert evaluated > 0, "a Write evaluated NO rules — tool scoping has excluded everything"


def test_every_phase2_rule_is_declared_and_counted():
    """Asserts over RULE IDS, never a pinned ratio (L64b — the '41 of 82' that broke within
    hours because writing a lesson ADDS a rule)."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                      capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, f"check-rule-coverage.mjs exited nonzero:\n{r.stdout}\n{r.stderr}"
    error_lines = [ln for ln in r.stdout.splitlines()
                   if ln.startswith("ERROR:") or ln.startswith("REGRESSION:")]
    for rid in PHASE2_RULES:
        offending = [ln for ln in error_lines if rid in ln]
        assert not offending, f"{rid} appears in an ERROR/REGRESSION line:\n" + "\n".join(offending)


def test_coverage_baseline_file_contains_every_phase2_rule():
    baseline = json.loads((ROOT / "docs" / "process" / "rule-coverage-baseline.json")
                          .read_text(encoding="utf-8"))
    covered = set(baseline["covered"])
    missing = [rid for rid in PHASE2_RULES if rid not in covered]
    assert not missing, f"baseline is missing phase-2 rule id(s): {missing}"


def test_no_tool_type_is_an_order_of_magnitude_slower_than_the_others():
    """R-120. The overhead below was measured on an Edit payload only, for weeks. Measuring three
    tool types instead of one found that an Agent dispatch cost 634ms worst case — 8x an Edit —
    because the concurrency rule asked the OS about liveness by spawning `tasklist` once PER PID,
    and the ledger holds several. Fixed by process.kill(pid, 0), which is the same OS question at
    0.003ms. Nothing found this for weeks because only one payload shape was ever timed."""
    payloads = {
        "Edit": {"tool_name": "Edit",
                 "tool_input": {"file_path": str(ROOT / "app.js"), "old_string": "c", "new_string": "c"}},
        "Bash": {"tool_name": "Bash", "tool_input": {"command": "echo hi"}},
        "Agent": {"tool_name": "Agent", "tool_input": {"prompt": "x"}},
        "Write": {"tool_name": "Write",
                  "tool_input": {"file_path": str(ROOT / "README.md"), "content": "x\n"}},
    }
    worst = {}
    for name, extra in payloads.items():
        payload = {"session_id": "s-spread-arc2p2", "hook_event_name": "PreToolUse",
                   "cwd": str(ROOT), **extra}
        times = []
        for _ in range(5):
            t0 = time.perf_counter()
            subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                           input=json.dumps(payload), capture_output=True, text=True,
                           encoding="utf-8", cwd=str(ROOT), env={**os.environ})
            times.append((time.perf_counter() - t0) * 1000)
        worst[name] = max(times)
    print("\nPRETOOLUSE WORST BY TOOL: " + " · ".join(f"{k} {v:.0f}ms" for k, v in worst.items()))
    fastest = min(worst.values())
    outliers = {k: round(v) for k, v in worst.items() if v > fastest * 4}
    assert not outliers, (
        f"tool type(s) {outliers} cost more than 4x the fastest ({fastest:.0f}ms) — one payload "
        f"shape is doing work the others are not. That is how a 634ms Agent path hid behind a "
        f"healthy-looking Edit measurement (R-120).")


def test_pretooluse_overhead_stays_in_the_baseline_class():
    """§3.5 — overhead measured, not assumed, against the 61ms Phase-4 worst case. Measures the
    WORST realistic payload (an app.js Edit — the path that consults state and, when targets are
    hot, the transcript) through the real CLI, 10 runs, and reports median+max. The assert is a
    tripwire at 4x the documented baseline — generous because each run pays full node startup —
    and the REPORTED numbers, pasted into the task summary, are the real deliverable; a material
    rise is a finding to investigate (spec §3.5), whether or not the tripwire fires."""
    payload = {"session_id": "s-overhead-arc2p2", "hook_event_name": "PreToolUse",
               "tool_name": "Edit", "cwd": str(ROOT),
               "tool_input": {"file_path": str(ROOT / "app.js"),
                              "old_string": "const", "new_string": "const"}}
    times = []
    for _ in range(10):
        t0 = time.perf_counter()
        subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                       input=json.dumps(payload), capture_output=True, text=True,
                       encoding="utf-8", cwd=str(ROOT), env={**os.environ})
        times.append((time.perf_counter() - t0) * 1000)
    times.sort()
    median, worst = times[len(times) // 2], times[-1]
    print(f"\nPRETOOLUSE OVERHEAD: median {median:.0f}ms, worst {worst:.0f}ms over 10 runs "
          f"(Phase-4 baseline: 61ms worst case)")
    assert worst < 61 * 4, f"overhead {worst:.0f}ms is far outside the baseline class — investigate"
