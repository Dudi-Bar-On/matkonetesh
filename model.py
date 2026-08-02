# -*- coding: utf-8 -*-
"""The one place that knows what the legacy flat row meant.

Every other consumer reads the structured item. `safe` encodes three states —
a cited floor, 0 meaning "not applicable" (every ירקות/פירות row), and absence
meaning "we hold no figure" — and R-82 is what happens when each consumer
decides for itself. That decision now happens exactly here, once.
"""
SCHEMA_VERSION = 1

# Corpus source ids — docs/sources/corpus/NN-*/. Numbering matches the folder prefix exactly
# (01-fda-food-code-2022 .. 19-serious-eats-lopez-alt); see docs/sources/corpus/00-SOURCE-MAP.md.
SRC_FOOD_CODE = 1
SRC_FSIS_APPENDIX_A = 2
SRC_FSIS_SAFE_MIN_TEMP = 3
SRC_ASKUSDA_VARIETY_MEATS = 4
SRC_FDA_FISH_GUIDANCE = 5
SRC_9CFR_424_21 = 6
SRC_9CFR_424_22 = 7
SRC_FSIS_GD_2023_0002 = 8
SRC_FSIS_JERKY_2014 = 9
SRC_AMI_1997_DEGREE_HOURS = 10
SRC_CFIA_NITRITE_FLOOR = 11
SRC_21CFR_133 = 12
SRC_FDA_LISTERIA_RTE_2017 = 13
SRC_EU_2023_915_PAH = 14
SRC_BALDWIN = 15
SRC_TORNBERG_2005 = 16
SRC_MODERNIST_CUISINE = 17
SRC_AMAZINGRIBS_BLONDER = 18
SRC_SERIOUS_EATS_LOPEZ_ALT = 19

# `sources.py` carries no `corpus_id` field on any `src.safe`/`src.tgt` entry — only a free-text
# `ref` (and sometimes a `url`). Checked directly: `grep corpus_id sources.py` = 0 hits, in this file
# and everywhere else in the repo. So the plan's `src.get("corpus_id", SRC_FOOD_CODE)` was reading a
# field that has never existed and would have silently defaulted EVERY thermal block whose citation
# wasn't Food Code to Food Code anyway — misattributing the majority of citations (most `ref` strings
# name Baldwin, AmazingRibs, or the USDA FSIS Safe Minimum Internal Temperature Chart, not Food Code).
# A wrong source_id is worse than a missing one (owner instruction), so this resolves the citation text
# against the 19 corpus identities the owner already curated in docs/sources/corpus/00-SOURCE-MAP.md,
# ordered most-specific-first, and refuses to guess when nothing matches.
_SOURCE_KEYWORDS = [
    ("baldwin", SRC_BALDWIN),
    ("amazingribs", SRC_AMAZINGRIBS_BLONDER),
    ("tornberg", SRC_TORNBERG_2005),
    ("modernist cuisine", SRC_MODERNIST_CUISINE),
    ("serious eats", SRC_SERIOUS_EATS_LOPEZ_ALT),
    ("lopez-alt", SRC_SERIOUS_EATS_LOPEZ_ALT),
    ("lópez-alt", SRC_SERIOUS_EATS_LOPEZ_ALT),
    ("424.21", SRC_9CFR_424_21),
    ("424.22", SRC_9CFR_424_22),
    ("gd-2023-0002", SRC_FSIS_GD_2023_0002),
    ("jerky", SRC_FSIS_JERKY_2014),
    ("ami 1997", SRC_AMI_1997_DEGREE_HOURS),
    ("ami foundation", SRC_AMI_1997_DEGREE_HOURS),
    ("cfia", SRC_CFIA_NITRITE_FLOOR),
    ("21 cfr 133", SRC_21CFR_133),
    ("cfr 133", SRC_21CFR_133),
    ("listeria", SRC_FDA_LISTERIA_RTE_2017),
    ("2023/915", SRC_EU_2023_915_PAH),
    (" pah ", SRC_EU_2023_915_PAH),
    ("ask-usda", SRC_ASKUSDA_VARIETY_MEATS),
    ("askusda", SRC_ASKUSDA_VARIETY_MEATS),
    ("variety", SRC_ASKUSDA_VARIETY_MEATS),
    ("organ meat", SRC_ASKUSDA_VARIETY_MEATS),
    ("fish", SRC_FDA_FISH_GUIDANCE),
    ("shellfish", SRC_FDA_FISH_GUIDANCE),
    ("crab", SRC_FDA_FISH_GUIDANCE),
    ("seafood", SRC_FDA_FISH_GUIDANCE),
    ("oyster", SRC_FDA_FISH_GUIDANCE),
    ("food code", SRC_FOOD_CODE),
    # Generic catch-all LAST: many `ref` strings just say "USDA" / "USDA FSIS" for the standard
    # ground-meat/poultry/whole-cut floors (160°F/165°F/145°F). That is exactly the content of the
    # USDA FSIS Safe Minimum Internal Temperature Chart (corpus #3), so route it there rather than to
    # Food Code — Food Code is a different, more specific document (the time/temp scald table).
    ("usda", SRC_FSIS_SAFE_MIN_TEMP),
    ("fsis", SRC_FSIS_SAFE_MIN_TEMP),
]


def _classify_source(ref_text):
    """Resolve a free-text citation to a corpus id, or None if nothing matches.

    Deliberately conservative: refs naming sources outside the 19-document corpus (Marianski/
    meatsandsausages, Wikipedia, ChefSteps, EatCuredMeat, Turkish Food Codex, Gastrochemist, Nem Chua
    literature, or house craft notes like "Protocol — produce") fall through to None on purpose —
    inventing a corpus pointer for them would be a false citation, which is worse than none.
    """
    low = (ref_text or "").lower()
    for needle, sid in _SOURCE_KEYWORDS:
        if needle in low:
            return sid
    return None


def _thermal_block(row, unconverted, item_id):
    raw = row.get("safe")
    if raw is None or raw == "":
        unconverted.append({"id": item_id, "name": row.get("heb"),
                            "field": "safe", "value": None, "reason": "safe-absent"})
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError):
        unconverted.append({"id": item_id, "name": row.get("heb"),
                            "field": "safe", "value": raw, "reason": "safe-unparsable"})
        return None
    if v == 0:
        # NOT a temperature. The data layer's encoding of "core temperature does
        # not govern this item" — every produce row carries it.
        unconverted.append({"id": item_id, "name": row.get("heb"),
                            "field": "safe", "value": 0, "reason": "safe-not-applicable"})
        return None
    ref = ((row.get("src") or {}).get("safe") or {}).get("ref") or ""
    sid = _classify_source(ref)
    if sid is None:
        # The number is real and must not be dropped (DoD-10) — but its citation cannot be honestly
        # resolved to a corpus folder from the text we have. Ship the number, flag the gap by name.
        unconverted.append({"id": item_id, "name": row.get("heb"),
                            "field": "safe", "value": ref, "reason": "safe-source-unmapped"})
    return {"kind": "thermal", "instant_c": int(round(v)), "curve": None,
            "basis": None, "basis_ref": None, "source_id": sid}


def _texture(row, unconverted, item_id):
    raw_tgt = row.get("tgt")
    if raw_tgt is None or raw_tgt in ("", "—", "-"):
        return None
    if isinstance(raw_tgt, str):
        try:
            tgt = float(raw_tgt)
            if tgt == int(tgt):
                tgt = int(tgt)
        except ValueError:
            # SPECIALS carries a handful of prose targets ("עד מרקם יבש-גמיש", "74°C ואז יבש") in the
            # same `tgt` field that CUTS uses for a plain numeric °C. Stuffing prose into `target_c`
            # would break the documented numeric contract every consumer relies on; instead this is
            # named in the non-conversion report rather than silently reinterpreted or dropped.
            unconverted.append({"id": item_id, "name": row.get("heb"),
                                "field": "tgt", "value": raw_tgt, "reason": "tgt-nonnumeric"})
            return None
    else:
        tgt = raw_tgt
    ref = ((row.get("src") or {}).get("tgt") or {}).get("ref") or ""
    sid = _classify_source(ref)
    return {"target_c": tgt,
            "doneness": row.get("doneness"),
            "source_id": sid,
            # R-79: a target with no primary source is craft, and says so. It is
            # never replaced and never allowed to read as verified.
            "provenance": "cited" if sid is not None else "craft"}


def build_items(cuts, specials, makes):
    items, unconverted = [], []
    # `n` restarts at 1 independently in CUTS and SPECIALS (measured: 47/47 SPECIALS ids collide with
    # CUTS ids in the real data.py). A bare `row["n"]` as `id` would silently merge two different
    # items — the table name is part of the identity, so it is part of the id.
    for table, rows in (("cuts", cuts), ("specials", specials)):
        for row in rows:
            n = row.get("n")
            item_id = "%s:%s" % (table, n)
            safety = []
            th = _thermal_block(row, unconverted, item_id)
            if th:
                safety.append(th)
            items.append({
                "id": item_id,
                "name": {"he": row.get("heb"), "en": row.get("eng")},
                "category": row.get("cat"),
                "cut_form": row.get("cut_form"),
                "weight_kg": row.get("kg"),
                "safety": safety,
                "texture": _texture(row, unconverted, item_id),
                "route": [],
                "notes": [],
                "legacy_ref": {"table": table, "n": n},
            })
    return items, unconverted
