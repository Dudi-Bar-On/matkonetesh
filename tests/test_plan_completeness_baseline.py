# tests/test_plan_completeness_baseline.py — R-119.
#
# check-plan-complete.mjs has existed since L27 and works. It had never been run against the plans
# that already existed — only against what was written after it. Its first sweep over the corpus
# (2026-08-10, found by rule `2`'s first real-tree run) reported 11 of 34 plans failing, five of
# them the plans that BUILT the enforcement machinery.
#
# They are not truncated. They are historical, written before the plan style required a code block
# per task. Owner decision 2026-08-10: declare a baseline and mark each plan executed, rather than
# rewrite documentation of work that already shipped.
#
# The baseline is BIDIRECTIONAL on purpose. Listing known failures only catches new ones; it also
# has to catch a plan that got FIXED and left in the list, or the list quietly becomes a lie. That
# direction is not theoretical: the identical guard for R-119a stayed green after three repairs,
# which is how a fourth unrepaired site was found.
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLANS = ROOT / "docs" / "superpowers" / "plans"

KNOWN_INCOMPLETE = {
    "2026-07-25-cooking-paths-cp1.md",
    "2026-07-25-equipment-e2-ledger-availability.md",
    "2026-07-26-equipment-e3-validity-gates.md",
    "2026-07-26-v268-localization.md",
    "2026-08-03-data-model.md",
    "2026-08-07-docker-exit.md",
    "2026-08-07-enforcement-phase-3-group-a.md",
    "2026-08-07-enforcement-phase-6-wiring.md",
    "2026-08-08-classification-criterion.md",
    "2026-08-08-enforcement-phase-4-group-b.md",
    "2026-08-08-rule-coverage.md",
}


def _failing_plans():
    failing = set()
    for p in sorted(PLANS.glob("*.md")):
        r = subprocess.run(["node", str(ROOT / "scripts" / "check-plan-complete.mjs"), str(p)],
                           capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
        if r.returncode != 0:
            failing.add(p.name)
    return failing


def test_no_new_plan_falls_below_the_completeness_gate():
    plans = sorted(PLANS.glob("*.md"))
    assert plans, "no plans found — this test examined NOTHING"
    new = _failing_plans() - KNOWN_INCOMPLETE
    assert not new, (
        f"plan(s) newly failing check-plan-complete: {sorted(new)}. A new plan must carry a code "
        f"block per task — this baseline covers historical plans only and is not a place to add one.")


def test_a_repaired_plan_does_not_stay_on_the_baseline():
    repaired = KNOWN_INCOMPLETE - _failing_plans()
    assert not repaired, (
        f"{sorted(repaired)} now pass the gate — remove them from KNOWN_INCOMPLETE so the list "
        f"keeps meaning what it says (R-119).")


def test_every_baselined_plan_is_marked_executed():
    """A baseline that hides a plan someone might still try to EXECUTE would be the dangerous
    kind. Each one carries a dated executed-marker naming its evidence."""
    unmarked = [n for n in sorted(KNOWN_INCOMPLETE)
                if "בוצעה — סומן" not in (PLANS / n).read_text(encoding="utf-8")]
    assert not unmarked, f"baselined but not marked executed: {unmarked}"
