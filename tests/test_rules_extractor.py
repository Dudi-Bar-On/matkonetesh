"""Proves src/rules_store/extractor.py — the first half of the extractor, which pulls
numbered `§N` / `§N.M` section headings out of docs/process/development-discipline.md into
structured RuleRecord rows (spec: Task 5 of the 2026-08-06 rules-store-and-watchman arc).

Lives in tests/ (not scripts/tests/) SPECIFICALLY so check-pytest.mjs collects it (tests/test_*.py,
underscore prefix, root tests/ dir) — a Python test nothing collects is invisible until the day it
matters.
"""
from __future__ import annotations

from pathlib import Path

from src.rules_store.extractor import extract_section_rules

ROOT = Path(__file__).resolve().parent.parent

FIXTURE = """\
## 10. The Discipline

Some intro text, not itself a rule.

### 10.17 Maximize the use of Serena for code work

Serena first, grep is a fallback.

### 10.5a Agent-concurrency ceiling

Cap subagents at the measured ceiling.

## 4. The Waiver Gate (the single most important new rule)

A plan may never waive a requirement.

See also §10.17 above and §3 for the DoD gate — neither of these inline mentions is a heading.

## 14. H8 — The Full-Landing Rule ("nothing in the air")

This is an H-ruling heading, not a plain numbered section — Task 6 owns it under rule_id "H8".
"""


def test_extracts_numbered_section_headings():
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"10.17", "10.5a", "4", "10"}, f"got {ids}"


def test_statement_is_the_paragraph_following_the_heading():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert recs["10.17"].statement.startswith("Serena first"), recs["10.17"].statement
    assert recs["4"].statement.startswith("A plan may never waive"), recs["4"].statement


def test_statement_is_quoted_verbatim_not_paraphrased():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    # L63: the statement must be the literal source text, not a summary of it.
    assert recs["10.5a"].statement == "Cap subagents at the measured ceiling."


def test_h_ruling_heading_is_excluded_reserved_for_task_6():
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert "14" not in ids, f"H-ruling heading '14. H8 —...' must not be captured here: {ids}"
    assert "H8" not in ids


def test_inline_section_reference_in_prose_is_not_a_rule():
    """Negative case: '§10.17' and '§3' appear inline in a running-prose sentence, not as a
    heading. They must NOT create phantom rule records — only the four real headings above count."""
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    assert len(recs) == 4, f"expected exactly 4 real headings, got {len(recs)}: {[r.rule_id for r in recs]}"
    ids = {r.rule_id for r in recs}
    assert "3" not in ids, "an inline '§3' prose mention must not become rule_id '3'"


def test_source_heading_and_source_path_recorded():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert recs["10.17"].source_heading == "10.17. Maximize the use of Serena for code work"


def test_content_hash_is_deterministic_and_distinguishes_rules():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    recs2 = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert recs["10.17"].content_hash == recs2["10.17"].content_hash
    assert recs["10.17"].content_hash != recs["4"].content_hash


def test_real_document_extracts_a_substantial_number_of_rules_and_no_h_rulings():
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = extract_section_rules(text, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert len(recs) > 30, f"expected substantially more than 30 numbered section rules, got {len(recs)}"
    assert "10.17" in ids
    assert "10.5a" in ids
    assert "4" in ids
    # H-ruling headings (## 14. H8 —, ## 16. H13 —, ## 17. H14 —, ## 18. H15 —) belong to Task 6.
    assert "14" not in ids
    assert "16" not in ids
    assert "17" not in ids
    assert "18" not in ids
