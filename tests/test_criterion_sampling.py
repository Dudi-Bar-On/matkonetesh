"""criterion arc — Task 1: the criterion file exists and is a procedure, not an answer key.
Task 2 appends the sampling/packet tests below this docstring's Step 2 block."""
from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRITERION = ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "criterion.md"


def test_criterion_file_is_the_full_decision_procedure():
    assert CRITERION.exists(), "criterion.md not written yet"
    text = CRITERION.read_text(encoding="utf-8")
    for token in ("ש1", "ש2", "ש3", "חובת הוכחה", "גרסה 1"):
        assert token in text, f"criterion is missing {token!r}"
    # answer schema must name every verdict's required fields
    for token in ('"group"', '"artifact"', '"pattern"', '"cost"', '"importance"',
                  '"observed_prior_facts"'):
        assert token in text, f"answer schema is missing {token!r}"


def test_criterion_contains_no_per_rule_answers():
    # The criterion is a procedure, not an answer key. No corpus rule_id may appear with a verdict.
    text = CRITERION.read_text(encoding="utf-8")
    import re
    assert not re.search(r"\bL\d{1,3}\b\s*[→:|]\s*(A|B|C|none)\b", text), \
        "criterion.md embeds a per-rule answer — that is contamination of every future classifier"


# --- Task 2: sampling + blind-packet machinery ---
import json, sqlite3, pytest
from src.rules_store import criterion


def _mini_mirror(tmp_path):
    db = tmp_path / "mini.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE rule_revisions (rule_id TEXT, title_he TEXT, statement TEXT, "
                 "rule_group TEXT, mechanism TEXT, mechanism_target TEXT)")
    rows = [(f"L{i}", f"כותרת {i}", f"טקסט הכלל {i}", "C" if i % 2 else "none", None, None)
            for i in range(1, 46)]
    rows.append(("A9", "כלל A", "לא בבריכה", "A", "ci-gate", "x"))   # must be excluded
    conn.executemany("INSERT INTO rule_revisions VALUES (?,?,?,?,?,?)", rows)
    conn.commit(); conn.close()
    return db


def test_pool_holds_only_C_and_none_and_never_the_truth_columns(tmp_path):
    pool = criterion.load_pool(_mini_mirror(tmp_path))
    assert "A9" not in pool and len(pool) == 45
    assert all(set(v) == {"title_he", "statement"} for v in pool.values())


def test_draw_is_deterministic_excludes_measured_and_refuses_small_pool(tmp_path):
    pool = criterion.load_pool(_mini_mirror(tmp_path))
    ids = list(pool)
    s1 = criterion.draw_sample(ids, set(), seed=1)
    assert s1 == criterion.draw_sample(ids, set(), seed=1) and len(s1) == 20
    s2 = criterion.draw_sample(ids, set(s1), seed=2)
    assert not set(s1) & set(s2)                       # fresh sample, by construction
    with pytest.raises(ValueError, match="ARC STOP"):  # 45 - 40 = 5 < 20
        criterion.draw_sample(ids, set(s1) | set(s2), seed=3)


def test_packet_is_blind_by_construction(tmp_path):
    pool = criterion.load_pool(_mini_mirror(tmp_path))
    sample = criterion.draw_sample(list(pool), set(), seed=1)
    packet, mapping = criterion.build_packet(pool, sample, "CRITERION TEXT ש1 ש2 ש3", seed=1)
    assert "CRITERION TEXT" in packet
    assert sorted(mapping) == [f"R{i:02d}" for i in range(1, 21)]
    assert sorted(mapping.values()) == sorted(sample)
    # The structural guarantee: the classification columns never reach a packet at all, and no
    # DISTINCTIVE rule id is attached to an entry. Short ids are checked differently on purpose —
    # see below; over-claiming here would be a false assurance, which is worse than a narrower one.
    for forbidden in ["rule_group", "mechanism", "mechanism_target"]:
        assert forbidden not in packet, f"packet leaks {forbidden!r} — independence broken"

    # WHY THIS IS SPLIT (flagged by the implementer, 2026-08-09): real corpus ids include "0", "7"
    # and "12", which occur as substrings inside ordinary statement prose by coincidence. A blanket
    # "no id appears anywhere in the packet" assertion cannot hold for those and would either fail on
    # honest data or force mangling the statements a classifier has to read. The property that
    # actually protects independence is that no code path ATTACHES a rule's identity to its entry —
    # `load_pool` selects only title_he and statement, so the id is never in the row to begin with.
    # A stray "7" inside a sentence tells a reader nothing about which rule they are looking at.
    distinctive = [rid for rid in sample if len(rid) >= 3 and not rid.isdigit()]
    assert distinctive, "sample carried no distinctive id — this assertion would be vacuous"
    for forbidden in distinctive:
        assert forbidden not in packet, f"packet leaks {forbidden!r} — independence broken"
    # shuffled: token order must not equal sorted corpus order
    assert [mapping[f"R{i:02d}"] for i in range(1, 21)] != sorted(sample)
