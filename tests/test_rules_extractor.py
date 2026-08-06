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

### 10.17.1 A future nested subsection

Nested one level deeper than 10.17 — must still be captured as its own rule_id.

## 4. The Waiver Gate (the single most important new rule)

**Root cause of this whole report:** backstory prose that comes BEFORE the actual rule and must
not be mistaken for it.

> A plan may never waive a requirement.
> "Recorded in a document" does not count as raised.

This also applies to reordering phases.

---

## 6. Failure-mode map

Each documented failure, and the gate that now catches it.

| Failure | Gate |
|---|---|
| equipPlan waived silently | §4 Waiver Gate |
| three guessed fixes | §5 systematic-debugging |

See also §10.17 above and §3 for the DoD gate — neither of these inline mentions is a heading.

## 14. H8 — The Full-Landing Rule ("nothing in the air")

This is an H-ruling heading, not a plain numbered section — Task 6 owns it under rule_id "H8".

```
## 99. Not a real heading — this is example text inside a fenced code block
```
"""


def test_extracts_numbered_section_headings():
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"10.17", "10.5a", "10.17.1", "4", "10", "6"}, f"got {ids}"


def test_nested_subsection_number_is_captured_not_dropped():
    """Design-limitation fix: the number group allows one OR MORE '.digits' — a future
    '### 10.17.1' must become its own rule_id, not be silently dropped by a single-group regex."""
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert "10.17.1" in recs
    assert recs["10.17.1"].section == "10"
    assert recs["10.17.1"].statement.startswith("Nested one level deeper")


def test_statement_is_the_paragraph_following_the_heading():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert recs["10.17"].statement.startswith("Serena first"), recs["10.17"].statement


def test_statement_captures_the_operative_rule_not_the_backstory_paragraph_before_it():
    """Fix round 1 — Critical review finding: a section that gives context BEFORE its rule (a
    bolded backstory paragraph, then a blockquote with the actual prohibition) must not have its
    statement truncated at the first paragraph, which would quote the backstory instead of the
    rule. The full body — backstory AND blockquote AND the sentence after it — must all be
    present; nothing about the document's real content may be dropped."""
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    stmt = recs["4"].statement
    assert "A plan may never waive a requirement." in stmt, stmt
    assert "Root cause of this whole report" in stmt, stmt
    assert "This also applies to reordering phases." in stmt, stmt


def test_trailing_horizontal_rule_scaffolding_is_stripped():
    """The '---' divider between §4 and §6 in the fixture is markdown scaffolding, not content —
    it must not leak into either section's statement."""
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert not recs["4"].statement.rstrip().endswith("---")
    assert "---" not in recs["4"].statement


def test_statement_captures_a_table_body_not_just_its_caption():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    stmt = recs["6"].statement
    assert "equipPlan waived silently" in stmt, stmt
    assert "three guessed fixes" in stmt, stmt


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
    heading. They must NOT create phantom rule records — only the real headings above count."""
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert "3" not in ids, "an inline '§3' prose mention must not become rule_id '3'"


def test_heading_shaped_line_inside_a_fenced_code_block_is_not_a_rule():
    """Design-limitation fix: a numbered-heading-shaped line inside a ``` fenced code block is
    example text, not a real document heading, and must not be admitted."""
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert "99" not in ids, f"a heading-shaped line inside a fenced code block became a rule: {ids}"


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


def test_real_document_section4_statement_contains_the_operative_prohibition():
    """Fix round 1 — the review's own reproduction case. §4 (The Waiver Gate) states its rule in a
    blockquote AFTER a bolded 'root cause' backstory paragraph; the statement must contain the
    actual prohibition, not stop at the backstory."""
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = {r.rule_id: r for r in extract_section_rules(text, "docs/process/development-discipline.md")}
    assert "may never waive, defer, or reinterpret" in recs["4"].statement, recs["4"].statement


def test_real_document_section5_statement_contains_the_three_fix_rule():
    """§5 (Debugging protocol) states the 3-fix rule in a paragraph AFTER the numbered phase list;
    the statement must contain it, not stop at the intro sentence or the phase list alone."""
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = {r.rule_id: r for r in extract_section_rules(text, "docs/process/development-discipline.md")}
    assert "after 3 failed fixes" in recs["5"].statement, recs["5"].statement
    assert "Do not attempt fix #4" in recs["5"].statement, recs["5"].statement


def test_real_document_section6_statement_contains_the_failure_mode_table():
    """§6 (Failure-mode → gate map) states its content entirely as a markdown table; the statement
    must contain actual table rows, not just the one-line caption sentence above it."""
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = {r.rule_id: r for r in extract_section_rules(text, "docs/process/development-discipline.md")}
    assert "equipPlan` waived silently" in recs["6"].statement, recs["6"].statement
    assert "§4 Waiver Gate" in recs["6"].statement, recs["6"].statement
