"""Parses the four rule shapes out of docs/process/development-discipline.md (spec §4.2, §4.7).

DETECTS (this task, Task 5 of the 2026-08-06 rules-store-and-watchman arc — the section-heading
half only): numbered §-section headings — both the top-level style with a period after the number
(`## 4. The Waiver Gate`) and the `### 10.x` subsection style without one
(`### 10.17 Maximize the use of Serena for code work`, `### 10.5a Agent-concurrency ceiling`).

DOES NOT DETECT (owned by later tasks in this arc): DoD checklist items (`- [ ] **N ·
Title.**`), H-ruling headings (`## 14. H8 — Title` — recognised and explicitly SKIPPED here,
because Task 6 owns them under rule_id `H8`, not `14`), lesson-log table rows/inline blocks, or a
rule stated only in prose with no heading shape at all. An inline running-prose mention of a
section (e.g. "see §10.17 above") is never captured — this extractor only looks at the start of a
markdown heading line, never at body text — which is the negative case this task's tests assert.

DOES NOT: hardcode the current section list. The document changes; matching is driven entirely by
the `#{2,4} <number> <title>` heading shape, never by a fixed enumeration of section numbers.
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


def _hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


# Matches "## 4. Title" (top-level headings carry a period after the number) AND
# "### 10.17 Title" / "### 10.5a Title" (subsection headings do not — the number already
# contains the dot that separates section from subsection, so no further punctuation follows).
# The trailing period is therefore OPTIONAL, not required — a fixed requirement was tried first
# and failed against the real `### 10.x` headings, which is exactly the case TDD exists to catch.
_SECTION_HEADING_RE = re.compile(
    r"^(#{2,4})[ \t]+(\d+(?:\.\d+)?[a-z]?)\.?[ \t]+(.+?)[ \t]*$", re.MULTILINE
)

# An H-ruling heading looks like "14. H8 — Title" — the title itself starts with "H<digits>"
# followed by a dash. Task 6 owns these under their own rule_id ("H8"), not the bare section
# number ("14"), so they are recognised here and explicitly excluded.
_H_RULING_RE = re.compile(r"^H\d+[a-z]?\s*[–—-]")


def extract_section_rules(text: str, source_path: str) -> list[RuleRecord]:
    matches = list(_SECTION_HEADING_RE.finditer(text))
    out: list[RuleRecord] = []
    for i, m in enumerate(matches):
        rule_id, title = m.group(2), m.group(3)
        if _H_RULING_RE.match(title):
            continue
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()
        # First non-empty paragraph only — a heading's statement is its lead paragraph, not
        # everything until the next heading (which may include sub-lists this extractor does not
        # itself need to attribute to the same rule_id).
        paragraph = body.split("\n\n", 1)[0].strip()
        out.append(RuleRecord(
            rule_id=rule_id,
            section=rule_id.split(".")[0],
            title_he=title,
            statement=paragraph if paragraph else title,
            source_heading=f"{rule_id}. {title}",
            content_hash=_hash(f"{title}\n{paragraph}"),
        ))
    return out
