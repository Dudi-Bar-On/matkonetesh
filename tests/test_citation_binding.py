"""A safety number must be attributed to the authority that states IT — Phase D §5.3, finding C-7.

WHAT IS WRONG TODAY. `model._SOURCE_KEYWORDS` is scanned first-match-wins with `("baldwin", …)` at
index 0, so any citation string mentioning Baldwin is attributed to Baldwin no matter what the
number is. The finding's own example, measured again here before writing a line of fix:

    cuts:11  safe=63  ref="Baldwin — SV floor 54.4C; USDA 145F/63C"

**The citation string itself says the 63 is USDA's.** Baldwin's number in that same string is 54.4.
The classifier attaches Baldwin. Measured across the real merged data: 62 of 103 thermal blocks are
attributed to Baldwin and 21 to AmazingRibs.

AND THE METRIC READ GREEN THROUGH ALL OF IT. `safe-source-unmapped` counts refs that matched
NOTHING — 4 of them. It is structurally incapable of counting the ones that matched the WRONG thing.

WHAT THIS FILE ASSERTS. Three decidable rules, in order, and a negative case:
  1. the ref carries numbers → bind the shipped value to the authority that states that number
  2. the ref names several authorities and one owns the value by its own canonical floor → that one
  3. the cited DOCUMENT is absent from the corpus → refuse; an absent source is not a source
  4. NEGATIVE: an unambiguous single-authority ref must keep the attribution it already has

WHAT IT DOES NOT TOUCH. No `safe` value moves. DoD-10 is not a formality here — this task is about
WHO SAID a number, never about what the number is, and `test_no_safety_value_moved` is the
assertion that proves it rather than promising it.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="module")
def built():
    """Build through the REAL runtime path, citations merged the way build.py merges them.

    This fixture exists in this shape because the first census run against `data.CUTS` alone
    reported `source_id: None` for all 103 thermal blocks and would have "proved" there was nothing
    to fix. The 279 citations live in `sources.py` and are merged at BUILD time (build.py:87-97),
    so a converter called on raw data.py sees no `src` at all. Verify against the runtime path.
    """
    import data
    import model
    from sources import CUT_SOURCES, SPEC_SOURCES, MAKE_SOURCES

    cuts = [dict(c) for c in data.CUTS]
    specials = [dict(s) for s in data.SPECIALS]
    for row in cuts:
        src = CUT_SOURCES.get(row.get("n"))
        if src:
            row.update(src)
    for row in specials:
        src = SPEC_SOURCES.get(row.get("n"))
        if src:
            row.update(src)
    makes = {k: dict(v) for k, v in data.MAKES.items()}
    try:
        from sausages_new import NEW_SAUSAGES
        for k, v in NEW_SAUSAGES.items():
            makes[k] = dict(v)
    except ImportError:
        pass
    for mid, src in MAKE_SOURCES.items():
        if mid in makes:
            makes[mid].update(src)

    items, unconverted = model.build_items(cuts, specials, makes)
    blocks = {}
    for item in items:
        for block in item.get("safety") or []:
            if block.get("kind") == "thermal":
                blocks[item["id"]] = block
    return {"items": items, "unconverted": unconverted, "blocks": blocks,
            "rows": {("cuts", r.get("n")): r for r in cuts}}


def _ref_of(rows, table, n):
    row = rows[(table, n)]
    return ((row.get("src") or {}).get("safe") or {}).get("ref") or ""


def test_the_number_decides_when_the_citation_states_numbers(built):
    """cuts:11 — "Baldwin — SV floor 54.4C; USDA 145F/63C", shipping 63.

    Nobody has to open a corpus file to settle this: the string says 54.4 is Baldwin's and 63 is
    USDA's, and the block ships 63. Attributing it to Baldwin is wrong on the citation's own terms.
    """
    import model
    ref = _ref_of(built["rows"], "cuts", 11)
    assert "54.4" in ref and "63" in ref, f"the fixture ref changed shape: {ref!r}"
    block = built["blocks"]["cuts:11"]
    assert block["instant_c"] == 63
    assert block["source_id"] == model.SRC_FSIS_SAFE_MIN_TEMP, (
        f"63°C is the USDA/FSIS figure named in this very citation ({ref!r}); "
        f"got source_id={block['source_id']} (15 = Baldwin, whose number here is 54.4)"
    )


def test_a_shared_citation_goes_to_the_authority_that_owns_the_floor(built):
    """cuts:3 — "Baldwin/USDA poultry floor", shipping 74.

    No explicit numbers, two authorities. 74°C is 165°F, the USDA poultry floor; Baldwin publishes
    time-temperature pasteurisation tables, not a 74 floor. Reviewer 6 checked the subset where
    Baldwin's own text quotes the USDA figure — quoting a number is not being its source.
    """
    import model
    block = built["blocks"]["cuts:3"]
    assert block["instant_c"] == 74
    assert block["source_id"] == model.SRC_FSIS_SAFE_MIN_TEMP, (
        "74°C = 165°F is the USDA poultry floor; the citation names both authorities and only one "
        f"of them owns that number. got source_id={block['source_id']}"
    )


def test_a_citation_to_a_document_the_corpus_does_not_hold_is_refused(built):
    """cuts:4 — "AmazingRibs — Food Temperature Guide (USDA whole-muscle lamb)".

    Verified on disk: docs/sources/corpus/18-amazingribs-blonder/ holds combustion, stall, wood and
    resting data and NOTHING called a Food Temperature Guide. 27 citations point at it.

    model.py already carries the owner's instruction that a wrong source_id is worse than a missing
    one, so this must not stay attached to corpus #18. This particular ref also names USDA itself,
    which is a better answer than none — either outcome is acceptable to this test, and pointing at
    the absent document is not.
    """
    import model
    ref = _ref_of(built["rows"], "cuts", 4)
    assert "AmazingRibs" in ref, f"the fixture ref changed shape: {ref!r}"
    block = built["blocks"]["cuts:4"]
    assert block["source_id"] != model.SRC_AMAZINGRIBS_BLONDER, (
        "corpus #18 does not contain the cited 'Food Temperature Guide' — checked on disk. "
        "A citation to a document nobody can read is not provenance."
    )
    assert block["source_id"] in (None, model.SRC_FSIS_SAFE_MIN_TEMP), (
        f"expected the USDA the ref itself names, or an honest None; got {block['source_id']}"
    )


def test_an_unambiguous_citation_is_left_alone(built):
    """NEGATIVE (DoD-6). cuts:1 — "Baldwin — Practical Guide to Sous Vide (pasteurization tables)".

    One authority, a document the corpus holds, no competing number. A rule that only ever moves
    attributions away from Baldwin would pass the three tests above and be wrong; this is the case
    that must NOT change.
    """
    import model
    ref = _ref_of(built["rows"], "cuts", 1)
    assert "Baldwin" in ref and "USDA" not in ref, f"the fixture ref changed shape: {ref!r}"
    assert built["blocks"]["cuts:1"]["source_id"] == model.SRC_BALDWIN


def test_ambiguity_is_recorded_rather_than_guessed(built):
    """When two authorities remain and nothing decides between them, say so.

    The whole defect class is a classifier that always produced an answer. Silence about a real
    ambiguity is how 62 blocks acquired a citation nobody checked, so an undecidable case must
    leave a record a person can act on — not a plausible-looking id.
    """
    reasons = {u.get("reason") for u in built["unconverted"]}
    decided = {b["source_id"] for b in built["blocks"].values() if b["source_id"] is not None}
    assert decided, "no thermal block resolved to any source at all — the classifier is dead"
    # Either nothing was ambiguous, or every ambiguous case was recorded. What is forbidden is a
    # block that silently kept one of several candidates.
    unresolved = [i for i, b in built["blocks"].items() if b["source_id"] is None]
    if unresolved:
        assert {"safe-source-unmapped", "safe-source-ambiguous", "safe-source-document-absent"} & reasons, (
            f"{len(unresolved)} thermal block(s) carry no source and no reason explains why: "
            f"{unresolved[:5]}"
        )


def test_no_safety_value_moved(built):
    """DoD-10, as an assertion rather than a promise.

    This task changes WHO is credited for a number. If it ever changes a number, that is a safety
    regression wearing a provenance fix's clothes. Every `instant_c` is compared against the `safe`
    the data layer authored, through the same rounding the converter uses.
    """
    import data
    from sources import CUT_SOURCES  # noqa: F401  (merged in the fixture; imported for symmetry)

    authored = {}
    for row in data.CUTS:
        authored[f"cuts:{row.get('n')}"] = row.get("safe")
    for row in data.SPECIALS:
        authored[f"specials:{row.get('n')}"] = row.get("safe")

    checked = 0
    for item_id, block in built["blocks"].items():
        if item_id not in authored:
            continue                                  # MAKES ids are keyed differently
        raw = authored[item_id]
        if raw in (None, ""):
            continue
        assert block["instant_c"] == int(round(float(raw))), (
            f"{item_id}: the block ships {block['instant_c']}°C but data.py authored {raw}"
        )
        checked += 1
    assert checked > 50, f"only {checked} values compared — the check is not covering the catalogue"
