"""Applying a classification on AGREEMENT between two blind classifiers, without an owner round-trip.

Owner ruling, 2026-08-09: "אישרתי את שינוי הנוהל כפי שהצעת, כשיש הסכמה אין צורך לעצור."

The whole guarantee lives in one property: **the machine checks the agreement, the caller does not
declare it.** If the caller could assert "they agreed", the rule would collapse into "the controller
classifies rules alone" — which is the exact failure the blind procedure was built to prevent, and the
one that measured 47% self-disagreement before the criterion existed.

Two protections survive unchanged, and these tests pin them:
  * a disagreement is REFUSED — it goes to the owner with both readings;
  * a demotion to `none` is REFUSED even on agreement — waiving a requirement stays the owner's call.
"""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLI = ROOT / "scripts" / "classify_rules.py"


def _answers(tmp_path, name, entries):
    p = tmp_path / name
    p.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
    return p


def _run(alpha, beta, mapping, extra=()):
    return subprocess.run(
        [sys.executable, "-X", "utf8", str(CLI), "--from-agreement",
         str(alpha), str(beta), "--mapping", str(mapping), "--dry-run", *extra],
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))


def _mapping(tmp_path, pairs):
    p = tmp_path / "mapping.json"
    p.write_text(json.dumps(pairs), encoding="utf-8")
    return p


def test_agreement_is_accepted_and_names_what_it_would_apply(tmp_path):
    """Uses a REAL rule id, because the CLI refuses to classify a rule that does not exist — and it is
    right to. A first draft of this test used a fictional `L99` and the refusal it produced was the
    machinery working, not a bug. `--dry-run` means nothing is written either way."""
    entry = {"token": "X1", "group": "B", "mechanism": "commit-gate",
             "mechanism_target": "scripts/check-*.mjs", "reason": "r"}
    a = _answers(tmp_path, "a.json", [entry])
    b = _answers(tmp_path, "b.json", [dict(entry)])
    r = _run(a, b, _mapping(tmp_path, {"X1": "L82"}))
    assert r.returncode == 0, r.stdout + r.stderr
    assert "L82" in r.stdout and "B" in r.stdout, r.stdout


def test_a_disagreement_is_refused_and_says_which_token(tmp_path):
    a = _answers(tmp_path, "a.json", [{"token": "X1", "group": "A", "mechanism": "ci-gate",
                                       "mechanism_target": "s", "reason": "r"}])
    b = _answers(tmp_path, "b.json", [{"token": "X1", "group": "C", "reason": "r"}])
    r = _run(a, b, _mapping(tmp_path, {"X1": "L99"}))
    assert r.returncode != 0, r.stdout
    assert "L99" in r.stdout and "A" in r.stdout and "C" in r.stdout, r.stdout


def test_a_demotion_to_none_is_refused_even_when_both_agree(tmp_path):
    """Agreement buys speed on classification. It does not buy the right to waive a requirement."""
    entry = {"token": "X1", "group": "none", "cost": "c", "importance": "i"}
    a = _answers(tmp_path, "a.json", [entry])
    b = _answers(tmp_path, "b.json", [entry])
    r = _run(a, b, _mapping(tmp_path, {"X1": "L99"}))
    assert r.returncode != 0, r.stdout
    assert "none" in r.stdout and ("owner" in r.stdout.lower() or "בעלים" in r.stdout), r.stdout


def test_a_token_present_in_only_one_file_is_refused(tmp_path):
    """One classifier answering is not agreement — it is a single actor with extra steps."""
    a = _answers(tmp_path, "a.json", [{"token": "X1", "group": "A", "mechanism": "ci-gate",
                                       "mechanism_target": "s", "reason": "r"},
                                      {"token": "X2", "group": "C", "reason": "r"}])
    b = _answers(tmp_path, "b.json", [{"token": "X1", "group": "A", "mechanism": "ci-gate",
                                       "mechanism_target": "s", "reason": "r"}])
    r = _run(a, b, _mapping(tmp_path, {"X1": "L99", "X2": "L98"}))
    assert r.returncode != 0, r.stdout
    assert "X2" in r.stdout or "L98" in r.stdout, r.stdout


def test_a_batch_file_carrying_the_marker_still_cannot_demote_to_none():
    """The hole this closes was found by probing the mechanism minutes after writing it.

    The marker removes the DATE requirement, and the date was the only thing standing between a batch
    file and a demotion. So a hand-written marker plus `rule_group: none` waived a requirement with
    nobody approving it. The refusal in the --from-agreement branch does not help here, because a batch
    FILE never passes through that branch — which is why this assertion goes at the validation layer."""
    sys.path.insert(0, str(ROOT))
    from src.rules_store import classify

    forged = {"approved_by_owner": classify.AGREEMENT_MARKER,
              "entries": [{"rule_id": "L82", "rule_group": "none", "cost": "c", "importance": "i"}]}
    errors = classify.validate_batch(forged, {"L82": "B"})
    assert errors, "a marker-carrying batch must not be able to waive a requirement"
    assert "none" in errors[0] and "owner" in errors[0].lower()

    allowed = {"approved_by_owner": classify.AGREEMENT_MARKER,
               "entries": [{"rule_id": "L82", "rule_group": "B", "mechanism": "commit-gate",
                            "mechanism_target": "x"}]}
    assert classify.validate_batch(allowed, {"L82": "B"}) == [], "a legitimate agreement batch must pass"


def test_identical_files_are_refused(tmp_path):
    """The same file passed twice is not two independent readings. Without this, the whole guarantee
    is one copy-paste away from being theatre."""
    a = _answers(tmp_path, "a.json", [{"token": "X1", "group": "A", "mechanism": "ci-gate",
                                       "mechanism_target": "s", "reason": "r"}])
    r = _run(a, a, _mapping(tmp_path, {"X1": "L99"}))
    assert r.returncode != 0, r.stdout
    assert "same file" in r.stdout.lower() or "אותו קובץ" in r.stdout, r.stdout
