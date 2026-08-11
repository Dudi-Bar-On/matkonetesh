# tests/test_arc4_h8_state.py — R-140: a commit's OWN new rows must answer the FULL H8 rule, not
# merely avoid worsening the historical-debt baseline.
#
# R-136 (docs/ROADMAP-2026-07-30.md, R-140 row) is the real incident: a row was born with a
# non-empty but MEANING-LESS landing cell (a status word, not a phase/trigger/thread name), and
# check-h8-ledger.mjs printed "OK". Root cause, confirmed by tracing scripts/check-h8-ledger.mjs's
# analyze() §5a loop: the historical per-text check only asks "is col[4] (landing) EMPTY?" — a
# row whose landing cell holds junk text (non-empty, names nothing) produces ZERO findings, so
# there is nothing for the worsening-vs-baseline diff to even catch. This is not a diffing bug —
# it is a validation gap that exists before any baseline comparison runs at all.
#
# Fixture row grammar copied from the real ledgers, not invented (docs/ROADMAP-2026-07-30.md):
#   §5  (line ~256): "| Phase | נסגרים | Δ | מצטבר / 156 |" — col[1] must start with
#                     Phase\s*<char> / "Language Thread" / "Sync Thread" / "בסיס".
#   §5a (line ~297): "| R | הפריט (תמצית) | מצביע-מקור | נחיתה | סטטוס |" — 5 columns; a row is
#                     "landed" only if col[4] (landing) is non-empty, and closed only if
#                     col[4]/col[5] contains "R-cancelled" or "סגור".
import subprocess
from pathlib import Path
from test_arc2_phase1_gates import git_env

ROOT = Path(__file__).resolve().parent.parent

BASE = """## 5 · מרשם ברן-דאון
| Phase | נסגרים | Δ | מצטבר / 156 |
|---|---|---|---|
| Phase 0 | H-9, N-15 | 2 | 19 |

**מצב סיום התוכנית: הנותרים — 1 בדיוק, כולם מעוגני-טריגר לפי H8-ב:**
- item one (טריגר: X)

**0 פריטים ללא נחיתה**

## 5a · מרשם השחזור (Recovery Ledger)
| R | הפריט (תמצית) | מצביע-מקור | נחיתה | סטטוס |
|---|---|---|---|---|
| R-1 | existing recovered item | some-report.md | **Phase 2** | 🟢 בוצע |

## 6 · הבא
"""

R1_ROW = "| R-1 | existing recovered item | some-report.md | **Phase 2** | 🟢 בוצע |\n"

# CURR: this commit's OWN new row, R-999, born with a non-empty but MEANING-LESS landing cell —
# "open" is a status word, not a phase/trigger/thread name. The row is functionally unlanded (it
# answers nothing checkable) yet is not textually EMPTY, so the historical §5a per-text check
# (col[4] non-empty -> no finding) never produces a finding for it at all, on either side of the
# diff, regardless of baseline.
CURR = BASE.replace(
    R1_ROW,
    R1_ROW + "| R-999 | brand new item added this commit | some-report.md | open | 🟡 פתוח |\n",
)


def _run(roadmap_text, baseline_text, tmp_path):
    rp = tmp_path / "roadmap.md"
    rp.write_text(roadmap_text, encoding="utf-8")
    bp = tmp_path / "base.md"
    bp.write_text(baseline_text, encoding="utf-8")
    env = {**git_env(), "ROADMAP": str(rp), "BASELINE_ROADMAP": str(bp)}
    return subprocess.run(
        ["node", str(ROOT / "scripts" / "check-h8-ledger.mjs")],
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env,
    )


def test_r140_a_row_born_unlanded_blocks(tmp_path):
    # R-999 exists in CURR only (absent from BASE by id "R-999") - it is this commit's OWN row and
    # must answer the FULL rule, not just avoid textual worsening.
    r = _run(CURR, BASE, tmp_path)
    assert r.returncode == 1, f"R-140 reproduced: gate said OK on a born-unlanded row\n{r.stdout}"
    assert "R-999" in r.stdout
    assert "NEW ROW WITHOUT LANDING" in r.stdout


def test_preexisting_debt_still_never_blocks(tmp_path):
    # R-500 is unlanded (empty col[4]) on BOTH sides - identical baseline and current - so it is
    # pre-existing debt by row identity, not a row born this commit. Must never block.
    debt = BASE.replace(
        R1_ROW,
        R1_ROW + "| R-500 | pre-existing debt row, unlanded on both sides | some-report.md |  | 🔴 פתוח |\n",
    )
    r = _run(debt, debt, tmp_path)
    assert r.returncode == 0, r.stdout
    assert "STANDING DEBT" in r.stdout


def test_a_repaired_row_passes(tmp_path):
    # R-500 existed unlanded at the baseline and is repaired (landing filled) in the current text.
    # Same row identity on both sides -> historical debt path, not the new-row full rule - and a
    # row that is REPAIRED must never still block (the bidirectional half of R-119/R-119a's pattern).
    debt = BASE.replace(
        R1_ROW,
        R1_ROW + "| R-500 | pre-existing debt row | some-report.md |  | 🔴 פתוח |\n",
    )
    repaired = BASE.replace(
        R1_ROW,
        R1_ROW + "| R-500 | pre-existing debt row | some-report.md | lands in **Phase 5** | 🟢 בוצע |\n",
    )
    r = _run(repaired, debt, tmp_path)
    assert r.returncode == 0, r.stdout
