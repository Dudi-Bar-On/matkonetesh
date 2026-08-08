"""criterion arc — Task 3: answer validation + agreement comparison."""
from __future__ import annotations
from src.rules_store import classify, criterion

MAP = {f"R{i:02d}": f"L{i}" for i in range(1, 21)}


def _ans(token, group, **kw):
    base = {"token": token, "group": group, "reason": "כי"}
    if group == "A":
        base |= {"artifact": "המטען", "pattern": "git commit", "mechanism": "pretooluse:Bash",
                 "mechanism_target": "git commit"}
    if group == "B":
        base |= {"mechanism": "sessionstart", "mechanism_target": "docs/**",
                 "observed_prior_facts": "מונה במחסן המצב"}
    if group == "none":
        base |= {"cost": "שיפוט", "importance": "גבוהה"}
    return base | kw


def _full(groups):
    return [_ans(f"R{i:02d}", g) for i, g in enumerate(groups, 1)]


def test_17_of_20_passes_and_16_fails():
    alpha = _full(["C"] * 20)
    beta3 = _full(["C"] * 17 + ["none"] * 3)
    r = criterion.compare_answers(alpha, beta3, MAP)
    assert (r["agreements"], r["verdict"]) == (17, "PASS")
    beta4 = _full(["C"] * 16 + ["none"] * 4)
    r = criterion.compare_answers(alpha, beta4, MAP)
    assert (r["agreements"], r["verdict"]) == (16, "FAIL")
    d = r["disagreements"][0]
    assert d["rule_id"] == "L17" and d["alpha_reason"] and d["beta_reason"]


def test_burden_of_proof_is_schema_not_politeness():
    bad = _full(["C"] * 20)
    bad[0] = {"token": "R01", "group": "A", "reason": "בטח אפשר regex"}  # A with no artifact
    errs = criterion.validate_answers(bad, set(MAP))
    assert any("artifact" in e and "R01" in e for e in errs)


def test_missing_token_is_an_error_not_a_skip():
    errs = criterion.validate_answers(_full(["C"] * 19), set(MAP))
    assert any("R20" in e for e in errs)


def test_agreed_group_with_different_mechanism_is_a_conflict_not_a_disagreement():
    alpha, beta = _full(["A"] * 20), _full(["A"] * 20)
    beta[0]["mechanism"] = "ci-gate"; beta[0]["mechanism_target"] = "scripts/**"
    r = criterion.compare_answers(alpha, beta, MAP)
    assert r["verdict"] == "PASS" and r["agreements"] == 20
    assert r["mechanism_conflicts"][0]["rule_id"] == "L1"
