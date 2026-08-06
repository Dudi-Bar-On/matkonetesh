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


# ---------------------------------------------------------------------------------------------
# Task 7: H-ruling headings (rule_id is the H-number itself, e.g. "H8" — NOT the section number
# "14" that _SECTION_HEADING_RE would otherwise capture; _H_RULING_RE above is what makes
# extract_section_rules SKIP these, so the two extractors agree on exactly one owner per heading).
# ---------------------------------------------------------------------------------------------

# The heading token allows an optional RANGE suffix ("H9–H12") — some headings name several
# rulings at once (fix round 1, 2026-08-06 — review finding, Critical: the old pattern captured
# only the FIRST H-number in the heading and treated the rest of the line, including "H12", as
# that one ruling's title, so H10/H11/H12 vanished from the store entirely and H9's title read
# "H12 — task summaries..."). A range heading is a CONTAINER, not a ruling of its own — see below.
#
# Shared-assumption note (fix round 2, 2026-08-06 — review, Important): this pattern encodes the
# document's OWN heading convention (`## <number>. H<n> — Title`); the round-trip test's
# independently-written `_expected_h_ids` encodes the same convention (from the other direction —
# what a reader would recognise as "an H-ruling heading"). Anything written in a style neither
# recognises is invisible to both the extractor and its own check — that is inherent to deriving
# "expected" from the document rather than a hand-maintained list, not a gap this fix closes.
_H_HEADING_RE = re.compile(
    r"^#{2,4}\s+\d+(?:\.\d+)?[a-z]?\.\s+(H\d+[a-z]?(?:[–—-]H\d+[a-z]?)?)\s*[–—-]\s*(.+?)\s*$",
    re.MULTILINE,
)

# A per-item bullet inside a range heading's body: "- **H9 — mandatory task-summary table.** ...".
# Only 4 lines in the whole document match this shape today (all inside the H9–H12 body), so its
# presence in a heading's body is itself the signal that the heading is a range container.
_H_BULLET_RE = re.compile(r"^- \*\*(H\d+[a-z]?)\s*[–—-]\s*", re.MULTILINE)

# Any markdown heading of the levels this module recognises — used to find where an H-ruling's
# (or a range container's) body ends: at the next heading line, full stop.
_ANY_HEADING_RE = re.compile(r"^#{2,4}\s+", re.MULTILINE)


def _h_body_span(text: str, body_start: int, next_top_level_start: int) -> int:
    """The end offset of a heading's body: bounded by the next H_HEADING_RE match (if any) AND
    by the next markdown heading of any kind — whichever comes first."""
    body_end = next_top_level_start
    next_heading = _ANY_HEADING_RE.search(text, body_start)
    if next_heading:
        body_end = min(body_end, next_heading.start())
    return body_end


def extract_h_rulings(text: str, source_path: str) -> list[RuleRecord]:
    matches = list(_H_HEADING_RE.finditer(text))
    out: list[RuleRecord] = []
    for i, m in enumerate(matches):
        h_token, heading_title = m.group(1), m.group(2)
        body_start = m.end()
        next_top = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body_end = _h_body_span(text, body_start, next_top)
        body = text[body_start:body_end]

        bullets = list(_H_BULLET_RE.finditer(body))
        if bullets:
            # A range heading (e.g. "H9–H12 — ...") is a container: emit one record PER bullet,
            # each parsed independently so a bullet's own body cannot bleed into its neighbour's —
            # bounded by the NEXT bullet's own start offset, never by a lazy pattern searching
            # forward for a convenient-looking closing marker (that lazy search is exactly what
            # made the old inline-lesson parser swallow multiple lessons into one record; see
            # extract_lessons below for the identical fix applied there).
            for j, bm in enumerate(bullets):
                h_id = bm.group(1)
                title_start = bm.end()
                next_bullet_start = bullets[j + 1].start() if j + 1 < len(bullets) else len(body)
                close = body.find("**", title_start)
                # Fix round 2 (review, Important — the same asymmetry L18's guard was written to
                # close, one instance short): a closing '**' found PAST this bullet's own next
                # sibling belongs to that sibling (or a later one), never to this bullet's own
                # title. Without this guard a bullet whose title fails to close on its own line
                # would have its title bleed the next bullet's own opening "- **H<n+1> — " text
                # into itself — the exact L18-swallowing shape, one guard short. The statement span
                # below is already clamped to next_bullet_start independently, so a missing guard
                # here could not merge two STATEMENTS — only corrupt a TITLE — but "cannot merge
                # bodies" is not the same guarantee as "cannot leak text", and this arc has paid for
                # that distinction four times already (§4, L18, H9, H8).
                if close == -1 or close > next_bullet_start:
                    title = body[title_start:next_bullet_start].split("\n", 1)[0].strip()
                    rest_start = next_bullet_start
                else:
                    title = body[title_start:close].strip()
                    rest_start = close + 2
                statement = body[rest_start:next_bullet_start].strip()
                if not statement:
                    statement = title
                out.append(RuleRecord(
                    rule_id=h_id,
                    section=h_id,
                    title_he=title,
                    statement=statement,
                    source_heading=f"{h_id} — {title} (bullet under {h_token} — {heading_title})",
                    content_hash=_hash(f"{title}\n{statement}"),
                ))
            continue

        # A single-ruling heading (no bullets in its body): capture the FULL body, verbatim — not
        # merely its first paragraph. The identical first-paragraph-only bug already cost this arc
        # a Critical finding once (extract_section_rules, Task 5); H8's own body here (a
        # blockquoted ruling that follows an intro sentence) reproduced it a second time until this
        # fix, so the whole body is now kept, matching extract_section_rules' own fix.
        statement = body.strip()
        out.append(RuleRecord(
            rule_id=h_token,
            section=h_token,
            title_he=heading_title,
            statement=statement if statement else heading_title,
            source_heading=f"{h_token} — {heading_title}",
            content_hash=_hash(f"{heading_title}\n{statement}"),
        ))
    return out


# ---------------------------------------------------------------------------------------------
# Task 7: the Lessons log — both the summary table's rows (L1..L13, terse) and the later inline
# "**Ln · Title (date).**" blocks (L14 onward, prose with a title + elaborating paragraph).
#
# Fix round 1 (2026-08-06 — review finding, Critical, x2): both original regexes crossed record
# boundaries.
#   - The table pattern let `\s*` (which matches newlines) carry group 4's lazy `.+?` from one row
#     into the NEXT row's cells whenever a row had fewer than 4 columns (L12/L13 in the live
#     document are malformed — 3 cells, not 4) — L13 vanished and L12's own cells were mislabelled.
#     Fixed below by matching ONE LINE AT A TIME (`.` never crosses a newline) and splitting that
#     line's own cells in Python, so a short row is detected and handled per-row, never bled into
#     its neighbour.
#   - The inline pattern's title capture demanded a newline immediately after the closing `**`;
#     in the real document most lessons continue prose on the SAME line, so that boundary never
#     matched and the lazy title capture ran on past several other lessons' own markers (L18 ate
#     L19+L20; L21 ate L22; L32 ate L33; L36 ate L37+L38+L39) before finding one that happened to
#     satisfy it. Fixed below by finding each `**Ln ·` marker's position directly, then finding its
#     title's closing `**` with a plain forward search (no backtracking to hunt for a "convenient"
#     later occurrence), then bounding the body by the NEXT marker's OWN position — a boundary that
#     cannot run away because it does not depend on matching anything past it.
# ---------------------------------------------------------------------------------------------

_LESSON_TABLE_ROW_RE = re.compile(r"^\|\s*(L\d+)\s*\|(.*)\|\s*$", re.MULTILINE)
_LESSON_MARKER_RE = re.compile(r"^\*\*(L\d+)\s*·\s*", re.MULTILINE)


def extract_lessons(text: str, source_path: str) -> list[RuleRecord]:
    out: list[RuleRecord] = []

    # Table rows — matched one line at a time (the trailing `.*` cannot cross a newline), then the
    # captured middle is split on '|' in Python so a row with fewer than 3 cells (malformed:
    # Lesson/Root-cause/Gate collapsed to fewer columns) is still emitted as its OWN record with
    # whatever cells it actually has, rather than bleeding into the next row's match.
    for m in _LESSON_TABLE_ROW_RE.finditer(text):
        l_id = m.group(1)
        cells = [c.strip() for c in m.group(2).split("|")]
        if len(cells) >= 3:
            lesson, root_cause, gate = cells[0], cells[1], "; ".join(cells[2:])
            statement = f"{lesson} — root cause: {root_cause} — gate: {gate}"
        elif len(cells) == 2:
            # Malformed row (L12/L13 in the live document): only 2 cells present after the id —
            # cope rather than merge into a neighbour. root_cause is genuinely absent, not guessed.
            lesson, gate = cells[0], cells[1]
            statement = f"{lesson} — gate: {gate} (row malformed in source: only 2 of 3 cells present)"
        else:
            lesson = cells[0] if cells else ""
            statement = f"{lesson} (row malformed in source: only {len(cells)} cell(s) present)"
        out.append(RuleRecord(
            rule_id=l_id, section="Lessons", title_he=cells[0] if cells else l_id, statement=statement,
            source_heading=f"Lessons log table row {l_id}", content_hash=_hash(statement),
        ))

    # Inline "**Ln · Title.**" blocks — per-marker, not per-regex-sweep (see fix note above).
    markers = list(_LESSON_MARKER_RE.finditer(text))
    for i, mk in enumerate(markers):
        l_id = mk.group(1)
        title_start = mk.end()
        close = text.find("**", title_start)
        next_marker_start = markers[i + 1].start() if i + 1 < len(markers) else len(text)
        if close == -1 or close > next_marker_start:
            # No closing "**" before the next lesson marker at all — cope, don't guess: take the
            # rest of the opening line as the title and leave the body empty rather than reaching
            # into the next record.
            title = text[title_start:next_marker_start].split("\n", 1)[0].strip()
            body_start = next_marker_start
        else:
            title = text[title_start:close].strip()
            body_start = close + 2
        body_end = _h_body_span(text, body_start, next_marker_start)
        body = text[body_start:body_end].strip()
        out.append(RuleRecord(
            rule_id=l_id, section="Lessons", title_he=title, statement=body if body else title,
            source_heading=f"Lessons log — {l_id} · {title}", content_hash=_hash(f"{title}\n{body}"),
        ))
    return out


def extract_rules(text: str, source_path: str) -> list[RuleRecord]:
    """The single entry point every builder/gate calls. Merges the four shapes; a rule_id claimed
    by more than one shape (or more than once within one shape) is treated as a document
    inconsistency, not silently deduplicated — silently picking a winner would let a real
    authoring mistake pass unnoticed, and rule_id is the primary key downstream in both Postgres
    and the SQLite mirror."""
    groups = {
        "section": extract_section_rules(text, source_path),
        "dod": extract_dod_rules(text, source_path),
        "h_ruling": extract_h_rulings(text, source_path),
        "lesson": extract_lessons(text, source_path),
    }
    print(
        "extract_rules() per-extractor counts: "
        + ", ".join(f"{name}={len(recs)}" for name, recs in groups.items())
    )
    seen: dict[str, str] = {}
    out: list[RuleRecord] = []
    for name, group in groups.items():
        for rec in group:
            if rec.rule_id in seen:
                raise ValueError(
                    f"rule_id {rec.rule_id!r} claimed by more than one shape in {source_path} "
                    f"({seen[rec.rule_id]} and {name}: {rec.source_heading!r}) — "
                    "the document is internally inconsistent."
                )
            seen[rec.rule_id] = f"{name}: {rec.source_heading}"
            out.append(rec)
    return out
