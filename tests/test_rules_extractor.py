"""Proves src/rules_store/extractor.py — the first half of the extractor, which pulls
numbered `§N` / `§N.M` section headings out of docs/process/development-discipline.md into
structured RuleRecord rows (spec: Task 5 of the 2026-08-06 rules-store-and-watchman arc).

Lives in tests/ (not scripts/tests/) SPECIFICALLY so check-pytest.mjs collects it (tests/test_*.py,
underscore prefix, root tests/ dir) — a Python test nothing collects is invisible until the day it
matters.
"""
from __future__ import annotations

from pathlib import Path

from src.rules_store.extractor import (
    extract_dod_rules,
    extract_h_rulings,
    extract_lessons,
    extract_rules,
    extract_section_rules,
)

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


# ---------------------------------------------------------------------------------------------
# Task 6: extract_dod_rules — the DoD-N checklist items inside §3, plus the process/content
# boundary ruling (controller, 2026-08-06): DoD-10 (Safety invariance) is a CONTENT rule — it
# would not exist in a system that was not about fire and meat — and must be classified as
# bucket='content', never bucket='process', driven by the rule's own text (domain vocabulary),
# never by a hardcoded rule_id check. See docs/process/development-discipline.md §3.
# ---------------------------------------------------------------------------------------------

DOD_FIXTURE = """\
### Per-task DoD checklist

- [ ] **1 · Spec requirement traced.** The exact spec line(s) this task satisfies, quoted.
- [ ] **2 · RED witnessed.** Test written first, run, and observed failing.
- [ ] **12 · Full suite green (H7).** Run `npx playwright test` plain.

### Per-phase DoD gate

- [ ] Every DoD line in the governing spec's "Definition of Done" section quoted and marked MET.
"""

# A second fixture, close to the real §3 shape, carrying a generic process item alongside the
# real DoD-10 text verbatim — used to prove the content-vocabulary classifier without depending
# on the live document (which is proven separately below).
DOD_BUCKET_FIXTURE = """\
### Per-task DoD checklist

- [ ] **9 · Hebrew check.** Any user-facing string rendered in Hebrew, no English leak.
- [ ] **10 · Safety invariance.** No `bcheck` stage, `temp`, `safe` value, or cook duration altered. Where the task touches the plan, the assertion that proves this is named.
- [ ] **11 · No arbitrary waits.** Tests wait on conditions, not setTimeout guesses.
"""


def test_extracts_only_numbered_dod_items_inside_the_checklist_section():
    recs = extract_dod_rules(DOD_FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"DoD-1", "DoD-2", "DoD-12"}, f"got {ids}"


def test_per_phase_gate_bullets_are_not_dod_items():
    # the unnumbered "Per-phase DoD gate" bullet must NOT become a DoD-N row
    recs = extract_dod_rules(DOD_FIXTURE, "docs/process/development-discipline.md")
    assert not any("Every DoD line" in r.statement for r in recs)


def test_dod_10_is_classified_as_content_bucket_not_process():
    """The controller's binding addition: DoD-10 is content (bcheck/temp/safe/cook duration are
    app-domain vocabulary — this sentence would not be true for a team building an accounting
    system), so it must carry bucket='content', never the default bucket='process'."""
    recs = {r.rule_id: r for r in extract_dod_rules(DOD_BUCKET_FIXTURE, "docs/process/development-discipline.md")}
    assert recs["DoD-10"].bucket == "content", recs["DoD-10"].bucket


def test_dod_10_is_not_dropped_only_reclassified():
    """Requirement 1 of the binding addition: DoD-10 is NOT dropped from extraction — it is a
    real rule that belongs to the content store once that is built (spec §11)."""
    recs = {r.rule_id: r for r in extract_dod_rules(DOD_BUCKET_FIXTURE, "docs/process/development-discipline.md")}
    assert "DoD-10" in recs


def test_generic_process_dod_items_default_to_process_bucket():
    recs = {r.rule_id: r for r in extract_dod_rules(DOD_BUCKET_FIXTURE, "docs/process/development-discipline.md")}
    assert recs["DoD-9"].bucket == "process", recs["DoD-9"].bucket
    assert recs["DoD-11"].bucket == "process", recs["DoD-11"].bucket


def test_process_only_view_excludes_dod_10():
    """Requirement 2 of the binding addition: a test that FAILS if DoD-10 is ingested as a
    process rule. A process-only filter over the extractor's output must exclude it."""
    recs = extract_dod_rules(DOD_BUCKET_FIXTURE, "docs/process/development-discipline.md")
    process_ids = {r.rule_id for r in recs if r.bucket == "process"}
    assert "DoD-10" not in process_ids, "DoD-10 (Safety invariance) must never be ingested as a process rule"
    assert process_ids == {"DoD-9", "DoD-11"}


def test_real_document_extracts_all_twelve_dod_items():
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = {r.rule_id: r for r in extract_dod_rules(text, "docs/process/development-discipline.md")}
    assert {f"DoD-{n}" for n in range(1, 13)} == set(recs), sorted(recs)


def test_real_document_dod_10_is_bucket_content_and_all_others_are_process():
    """Proves the classifier against the LIVE document, not only a fixture that avoids the
    failing shape — an extractor.py docstring rule from Task 5, carried forward here."""
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = {r.rule_id: r for r in extract_dod_rules(text, "docs/process/development-discipline.md")}
    assert recs["DoD-10"].bucket == "content", recs["DoD-10"].statement
    non_content = {rid: r.bucket for rid, r in recs.items() if rid != "DoD-10"}
    assert all(bucket == "process" for bucket in non_content.values()), non_content


# ---------------------------------------------------------------------------------------------
# Task 7: extract_h_rulings (rule_id = the H-number, e.g. "H8", not the section number "14"),
# extract_lessons (both the Lessons-log table rows AND the inline "**Ln ·**" blocks), and the
# extract_rules() merge point that every later task (builder, gates) calls.
# ---------------------------------------------------------------------------------------------

H_FIXTURE = """\
## 14. H8 — The Full-Landing Rule ("nothing in the air"; owner ruling, 2026-07-30)

Nothing may be left unlanded: named phase, trigger-anchored deferral, or registered brainstorm task.

## 16. H13 — שער רלוונטיות לפריט משוחזר (Recovery Relevance Gate; owner ruling, 2026-07-30)

בירור → המלצה → החלטת בעלים → עדכון → בצע/בטל.
"""

LESSON_FIXTURE = """\
## 11. Lessons log

| # | Lesson | Root cause | Gate |
|---|---|---|---|
| L1 | equipPlan never built | Waived in a plan file | §4 Waiver Gate |
| L2 | hooksOver shipped unread | A derived value had no consumer | DoD 5 |

**L14 · A push is not a release; a deploy takes minutes (v255, 2026-07-21).**
I announced "v255 is shipped" the moment `git push` returned. The owner looked, still saw 254.
"""


def test_extracts_h_rulings_by_their_h_number_not_their_section_number():
    recs = extract_h_rulings(H_FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"H8", "H13"}, f"got {ids}"


def test_extracts_table_lessons_and_inline_lessons():
    recs = {r.rule_id: r for r in extract_lessons(LESSON_FIXTURE, "docs/process/development-discipline.md")}
    assert set(recs) == {"L1", "L2", "L14"}, f"got {set(recs)}"
    assert "equipPlan" in recs["L1"].statement
    assert "deploy takes minutes" in recs["L14"].title_he or "push is not a release" in recs["L14"].title_he


def test_extract_rules_merges_all_four_shapes_and_rejects_duplicate_ids():
    combined = DOD_FIXTURE + H_FIXTURE + LESSON_FIXTURE
    recs = extract_rules(combined, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert {"DoD-1", "H8", "L1", "L14"} <= ids, f"got {ids}"

    dup = combined + "\n### 10.17 Duplicate on purpose\n\nSecond copy.\n" + "\n### 10.17 Again\n\nThird copy.\n"
    try:
        extract_rules(dup, "docs/process/development-discipline.md")
        assert False, "expected ValueError for duplicate rule_id '10.17'"
    except ValueError as exc:
        assert "10.17" in str(exc)


def test_real_document_extract_rules_merges_all_shapes_without_raising():
    """Sanity check against the LIVE document (DoD-4/6): the real document must not contain a
    duplicate rule_id across the four shapes, and the merge must produce a substantial count."""
    text = (ROOT / "docs" / "process" / "development-discipline.md").read_text(encoding="utf-8")
    recs = extract_rules(text, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert len(recs) == len(ids), "extract_rules produced duplicate rule_ids without raising"
    assert len(recs) > 100, f"expected well over 100 combined rules, got {len(recs)}"
    assert "H8" in ids
    assert "H13" in ids
    assert "L1" in ids
    assert "L63" in ids
    assert "DoD-10" in ids
