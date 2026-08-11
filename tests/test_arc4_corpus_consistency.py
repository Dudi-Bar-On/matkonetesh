# tests/test_arc4_corpus_consistency.py — the corpus answers for itself.
import json, sqlite3, subprocess
from pathlib import Path
from test_arc2_phase1_gates import git_env
ROOT = Path(__file__).resolve().parent.parent

COLS = ("rule_id, section, title_he, statement, bucket, rule_group, severity, mechanism, "
        "mechanism_target, source_path, source_heading, source_hash, revision_status, mirrored_at")

def _mirror(tmp_path, rows):
    db = tmp_path / "rules.sqlite"
    c = sqlite3.connect(db)
    c.execute(f"CREATE TABLE rule_revisions ({COLS})")
    for r in rows:
        c.execute(f"INSERT INTO rule_revisions ({COLS}) VALUES ({','.join('?'*14)})", r)
    c.commit(); c.close()
    return db

def _rule_row(rule_id, group="A", mechanism="stop", target="the final message"):
    return (rule_id, "11", "t", "s", "lesson", group, "high", mechanism, target,
            "docs/process/development-discipline.md", "h", "x", "current", "2026-08-11")

def _run(tmp_path, db, hooks_root, baseline):
    bp = tmp_path / "baseline.json"; bp.write_text(json.dumps(baseline), encoding="utf-8")
    return subprocess.run(["node", str(ROOT / "scripts" / "check-corpus-consistency.mjs"),
                           "--mirror", str(db), "--hooks-root", str(hooks_root),
                           "--baseline", str(bp)],
                          capture_output=True, text=True, encoding="utf-8",
                          cwd=str(ROOT), env=git_env())

def _hooks(tmp_path, rule_ids):
    d = tmp_path / "hooks" / "stop-rules"; d.mkdir(parents=True)
    for rid in rule_ids:
        (d / f"{rid.lower()}.mjs").write_text(f"export const RULE_ID = '{rid}';\n", encoding="utf-8")
    return tmp_path / "hooks"

EMPTY = {"unenforced_ab_rules": [], "ungrouped_rules": [], "unproven_rule_ids": [], "drift_findings": []}

def test_blocks_on_a_new_unenforced_ab_rule(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L900")])          # A-group, stop mechanism, no hook file
    r = _run(tmp_path, db, _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 1, r.stdout + r.stderr
    assert "L900" in r.stdout

def test_standing_debt_prints_but_does_not_block(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L900")])
    r = _run(tmp_path, db, _hooks(tmp_path, []), {**EMPTY, "unenforced_ab_rules": ["L900"]})
    assert r.returncode == 0, r.stdout
    assert "L900" in r.stdout                            # loud, per L40

def test_blocks_on_a_repaired_item_still_listed(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L900")])
    r = _run(tmp_path, db, _hooks(tmp_path, ["L900"]), {**EMPTY, "unenforced_ab_rules": ["L900"]})
    assert r.returncode == 1, r.stdout                   # repaired: remove it from the baseline
    assert "no longer reproduces" in r.stdout.lower() or "repaired" in r.stdout.lower()

def test_blocks_on_a_new_ungrouped_rule(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L901", group=None)])
    r = _run(tmp_path, db, _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 1 and "L901" in r.stdout

def test_c_group_rules_are_not_counted_as_unenforced(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L902", group="C", mechanism="none", target="")])
    r = _run(tmp_path, db, _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 0, r.stdout

def test_fails_open_on_a_missing_mirror(tmp_path):
    r = _run(tmp_path, tmp_path / "absent.sqlite", _hooks(tmp_path, []), EMPTY)
    assert r.returncode == 0
    assert "could not decide" in r.stdout.lower()

def test_gate_reports_what_it_scanned(tmp_path):
    db = _mirror(tmp_path, [_rule_row("L903", group="A", mechanism="stop")])
    r = _run(tmp_path, db, _hooks(tmp_path, ["L903"]), EMPTY)
    assert r.returncode == 0
    assert "1 rule" in r.stdout or "rules scanned: 1" in r.stdout  # never a bare OK over nothing
