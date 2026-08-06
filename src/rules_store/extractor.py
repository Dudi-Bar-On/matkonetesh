"""Parses the four rule shapes out of docs/process/development-discipline.md (spec §4.2, §4.7).

DETECTS (this task, Task 5 of the 2026-08-06 rules-store-and-watchman arc — the section-heading
half only): numbered §-section headings — both the top-level style with a period after the number
(`## 4. The Waiver Gate`) and the `### 10.x` subsection style without one
(`### 10.17 Maximize the use of Serena for code work`, `### 10.5a Agent-concurrency ceiling`,
and any further nesting such as a future `### 10.17.1`).

DOES NOT DETECT (owned by later tasks in this arc): DoD checklist items (`- [ ] **N ·
Title.**`), H-ruling headings (`## 14. H8 — Title` — recognised and explicitly SKIPPED here,
because Task 6 owns them under rule_id `H8`, not `14`), lesson-log table rows/inline blocks, or a
rule stated only in prose with no heading shape at all. An inline running-prose mention of a
section (e.g. "see §10.17 above") is never captured — this extractor only looks at the start of a
markdown heading line, never at body text — which is the negative case this task's tests assert.
A numbered-heading-shaped line that appears INSIDE a fenced ``` code block is also excluded — it
is example text, not a real heading in the document's own structure.

DOES NOT: hardcode the current section list. The document changes; matching is driven entirely by
the `#{2,4} <number> <title>` heading shape, never by a fixed enumeration of section numbers.

`statement` (fix round 1, 2026-08-06 — review finding, Critical): the ENTIRE body between a
heading and the next heading, verbatim, minus a trailing `---` scaffolding rule. Earlier this
extractor took only the first paragraph, which is right when a section states its rule up front
but silently drops the rule wherever the document gives context first — §4 (The Waiver Gate)
stored its "root cause" backstory instead of the blockquoted prohibition; §5 (Debugging protocol)
stored its intro sentence and dropped the numbered phases AND the 3-fix rule; §6 (failure-mode map)
stored a one-line caption and dropped the entire table. None of those are special-cased by id here
— per-section truncation of ANY kind reproduces the same bug for whichever section is not yet
discovered, so the fix is structural: capture what the document actually put under the heading,
not a guess at which of its blocks is "the rule". A blockquote, a bold label, a numbered list, and
a table are therefore all captured automatically, because none of them get cut.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


@dataclass
class RuleRecord:
    rule_id: str
    section: str | None
    title_he: str
    statement: str
    source_heading: str
    content_hash: str
    bucket: str = "process"


def _hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


# Matches "## 4. Title" (top-level headings carry a period after the number) AND
# "### 10.17 Title" / "### 10.5a Title" / "### 10.17.1 Title" (subsection headings do not carry a
# period — the number already contains the dot(s) that separate section from subsection, so no
# further punctuation follows). The trailing period is therefore OPTIONAL, not required — a fixed
# requirement was tried first and failed against the real `### 10.x` headings, which is exactly the
# case TDD exists to catch. The number itself allows one OR MORE `.digits` groups (`\d+(?:\.\d+)*`),
# not just one — a single group would silently drop a future `### 10.17.1` without ever raising an
# error, which is worse than rejecting it outright.
_SECTION_HEADING_RE = re.compile(
    r"^(#{2,4})[ \t]+(\d+(?:\.\d+)*[a-z]?)\.?[ \t]+(.+?)[ \t]*$", re.MULTILINE
)

# An H-ruling heading looks like "14. H8 — Title" — the title itself starts with "H<digits>"
# followed by a dash. Task 6 owns these under their own rule_id ("H8"), not the bare section
# number ("14"), so they are recognised here and explicitly excluded.
_H_RULING_RE = re.compile(r"^H\d+[a-z]?\s*[–—-]")

# A trailing horizontal-rule separator (plus the blank lines around it) between a section's own
# content and the next heading — markdown scaffolding the document uses to divide major sections,
# never part of the rule's own text. Stripped only when it is the LAST thing in the body, so a
# legitimate "---" that a section might use mid-content (none do today) is left untouched.
_TRAILING_RULE_RE = re.compile(r"\n[ \t]*\n-{3,}[ \t]*\n*\Z")

_FENCE_RE = re.compile(r"^```", re.MULTILINE)


def _fenced_spans(text: str) -> list[tuple[int, int]]:
    """(start, end) char offsets of every fenced ``` code block, paired open/close in order."""
    starts = [m.start() for m in _FENCE_RE.finditer(text)]
    return list(zip(starts[0::2], starts[1::2]))


def _in_any_span(pos: int, spans: list[tuple[int, int]]) -> bool:
    return any(start <= pos < end for start, end in spans)


def extract_section_rules(text: str, source_path: str) -> list[RuleRecord]:
    fenced = _fenced_spans(text)
    matches = [m for m in _SECTION_HEADING_RE.finditer(text) if not _in_any_span(m.start(), fenced)]
    out: list[RuleRecord] = []
    for i, m in enumerate(matches):
        rule_id, title = m.group(2), m.group(3)
        if _H_RULING_RE.match(title):
            continue
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end]
        body = _TRAILING_RULE_RE.sub("", body)
        statement = body.strip()
        if not statement:
            statement = title
        out.append(RuleRecord(
            rule_id=rule_id,
            section=rule_id.split(".")[0],
            title_he=title,
            statement=statement,
            source_heading=f"{rule_id}. {title}",
            content_hash=_hash(f"{title}\n{statement}"),
        ))
    return out


# ---------------------------------------------------------------------------------------------
# Task 6: the DoD-N checklist items inside §3 ("### Per-task DoD checklist"), PLUS the
# process/content classification the controller's binding addition (2026-08-06) requires.
#
# The section is delimited by its own heading and the next `###`/`##` heading, so the sibling
# "### Per-phase DoD gate" bullets (unnumbered) are excluded by construction — they never match
# `_DOD_ITEM_RE`, which requires the `**N · Title.**` shape.
# ---------------------------------------------------------------------------------------------

_DOD_SECTION_RE = re.compile(
    r"### Per-task DoD checklist\s*\n(.*?)(?=\n###|\n##|\Z)", re.DOTALL
)
_DOD_ITEM_RE = re.compile(
    r"^- \[ \] \*\*(\d+)\s*·\s*([^*]+?)\.\*\*\s*(.*)$", re.MULTILINE
)

# The process/content boundary (owner ruling, 2026-08-06): a DoD item is CONTENT — not process —
# when its own statement text is stated in app-domain vocabulary that would not be true for a
# team building an unrelated system (spec §1's own test: "would this sentence be true for a team
# building an accounting system?"). This match list is the operationalisation of that test: the
# handful of terms that only mean something inside a live-fire-cooking safety plan. It is
# deliberately NOT a rule_id (`DoD-10`) check — a fixed id list rots the moment a future edit adds
# a new content-flavoured DoD item under a different number; a vocabulary check still classifies
# it correctly without this file being touched again. `temp` and `safe` are matched only inside
# backticks (`` `temp` ``, `` `safe` ``) because as bare English words they are common outside
# this domain (e.g. "temporary", "safe to assume") and would over-match; `bcheck` and
# "cook duration" have no meaning outside this product at all, so they are matched as plain text.
_CONTENT_VOCAB_RE = re.compile(
    r"`bcheck`|`temp`|`safe`|\bcook duration\b", re.IGNORECASE
)


def _classify_bucket(statement: str) -> str:
    return "content" if _CONTENT_VOCAB_RE.search(statement) else "process"


def extract_dod_rules(text: str, source_path: str) -> list[RuleRecord]:
    section_match = _DOD_SECTION_RE.search(text)
    if not section_match:
        return []
    body = section_match.group(1)
    out: list[RuleRecord] = []
    for m in _DOD_ITEM_RE.finditer(body):
        n, title, rest = m.group(1), m.group(2).strip(), m.group(3).strip()
        statement = f"{title}. {rest}".strip()
        out.append(RuleRecord(
            rule_id=f"DoD-{n}",
            section="DoD",
            title_he=title,
            statement=statement,
            source_heading=f"Per-task DoD checklist item {n}",
            content_hash=_hash(statement),
            bucket=_classify_bucket(statement),
        ))
    return out
