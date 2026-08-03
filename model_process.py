# -*- coding: utf-8 -*-
"""`drying` / `fermentation` / `aging` blocks -- read out of the authored prose, never the
threshold (ADDENDUM, "Task 1c", owner instruction 2026-08-03).

Thresholds are NEVER read out of the prose: the prose says "4-7 ימים בייבוש מאוורר", never an a_w.
The prose supplies the DURATION and the fact that the mechanism applies; the corpus supplies the
THRESHOLD, attached as a regulatory LIMIT with its own source_id, never presented as this item's
own measured value.

Extraction sources, exactly as measured in the plan's own ADDENDUM table ("What each mechanism is
extracted FROM — measured 2026-08-03"):
  - `drying`       <- SPECIALS.age prose, gated by SPECIALS.cat in DRY_CATEGORIES
  - `fermentation` <- SPECIALS.cure prose (תרבית/תסיסה) AND MAKES.build.materials/phases prose
  - `aging`        <- SPECIALS.age prose, gated by SPECIALS.cat == 'גבינה'
MAKES is not scanned for drying/aging in this task -- the ADDENDUM's own source table names only
SPECIALS for those two kinds; extending it to MAKES.build prose (which is real: b_salumi/
sausage_dry() phases DO carry drying/aging language) is a scope boundary named in the report, not
filled here, exactly the way `parasite` names a gap rather than inventing a fix.

Two scope traps checked against each source's own PROVENANCE before applying it (owner instruction
-- verify scope, do not assume):

1. **Cheese's OWN `cure` field says "ייבוש לילה במקרר" (an overnight pre-smoke surface-dry step)
   for ~26 rows.** A keyword scan of that field would fire the FSIS jerky/RTE-dried a_w<=0.85
   mechanism on every cold-smoked cheese -- a false alarm on a product that is refrigerated
   throughout, never shelf-stable. Fixed by scoping `drying` to `SPECIALS.age`/`cat` only (the
   `cure` field is never read for this mechanism) and to `DRY_CATEGORIES`, the data's own existing
   taxonomy for long-dried, unheated products (mirrors `model_cure.py`'s `cure_type=='2'` scoping
   of the CFIA floor to the identical product class).
2. **The 60-day/35°F rule (21 CFR 133, #12) is scoped to cheese made from UNPASTEURIZED milk**
   (PROVENANCE #12, verbatim: "If the dairy ingredients used are not pasteurized..."). Our data
   never states which milk any cheese row uses -- these are commercially-sourced cheeses being
   cold-smoked, and the recipes give no reason to assume raw milk. Attaching the limit anyway would
   present a regulatory floor as applying to a product class we cannot show it governs. The `aging`
   mechanism IS named (cheese really does rest/mature before serving) but its `limit_check` is
   explicitly `not-applicable`, and the gap is named in the report (`aging-milk-not-authored`) --
   never silently skipped, never wrongly checked.
"""
import re

# Corpus ids -- mirrors model.py's numbering (docs/sources/corpus/NN-*).
SRC_FSIS_GD_2023_0002 = 8        # RTE fermented/salt-cured/dried products (biltong, droëwors, dry sausage)
SRC_FSIS_JERKY_2014 = 9          # jerky specifically -- a_w 0.85 aerobic / 0.91 vacuum-packaged
SRC_AMI_1997_DEGREE_HOURS = 10   # fermented DRY/SEMI-DRY SAUSAGE products, degree-hours table
SRC_21CFR_133 = 12               # cheese aging -- UNPASTEURIZED milk only

AW_MAX_SHELF_STABLE = 0.85         # GD-2023-0002 / jerky guideline, aerobic shelf-stability floor
PH_MAX_FERMENT = 5.3               # GD-2023-0002, citing AMI 1997 -- fermented-sausage safety hurdle
# AMI Foundation 1997, verbatim (source #10 PROVENANCE): "Processes attaining a temperature less
# than 90°F before reaching pH 5.3 are limited to 1200 degree-hours... 90-100°F... 1000... exceeding
# 100°F... 900".
DEGREE_HOURS_MAX = {"le_90F": 1200, "f_90_100F": 1000, "gt_100F": 900}
CHEESE_AGE_DAYS_MIN = 60           # 21 CFR 133.113 and sibling sections -- UNPASTEURIZED milk only
CHEESE_AGE_TEMP_F_MIN = 35         # ditto, verbatim "not less than 35°F"

# `cat` values this data already reserves for long-dried, unheated products -- the same product
# class model_cure.py scopes the CFIA floor to via `cure_type=='2'`.
DRY_CATEGORIES = ("בשר מיובש", "נקניק מיובש")
_JERKY_NAME = re.compile(r"ג'רקי")

# `\+?` after the digits: SPECIALS' cheese `age` prose writes "2+ שבועות" ("2 or more weeks") --
# the digit IS the stated figure; the '+' is part of how it is stated, not something invented.
_DAYS = re.compile(r"(\d+)\s*\+?\s*(?:[-–]\s*(\d+)\s*)?ימים")
_WEEKS = re.compile(r"(\d+)\s*\+?\s*(?:[-–]\s*(\d+)\s*)?שבועות")
_HOURS = re.compile(r"(\d+)\s*\+?\s*(?:[-–]\s*(\d+)\s*)?שעות")

_FERMENT_WORDS = ("תרבית", "תסיסה", "התססה", "התסס")
_AGE_WORDS = ("יישון", "מיושן")


def _duration_days(text):
    """The LONGEST stated duration, in days, or None. Converts only what is literally stated
    (weeks*7) -- never invents a number the prose does not give."""
    if not text:
        return None
    candidates = []
    m = _WEEKS.search(text)
    if m:
        candidates.append(int(m.group(2) or m.group(1)) * 7)
    m = _DAYS.search(text)
    if m:
        candidates.append(int(m.group(2) or m.group(1)))
    return max(candidates) if candidates else None


def _duration_hours(text):
    if not text:
        return None
    m = _HOURS.search(text)
    if m:
        return int(m.group(2) or m.group(1))
    return None


def _drying_block_for_specials(row, unconverted, item_id):
    if row.get("cat") not in DRY_CATEGORIES:
        return None
    is_jerky = bool(_JERKY_NAME.search(row.get("heb") or ""))
    blk = {"kind": "drying", "aw_max": AW_MAX_SHELF_STABLE, "limit_is_regulatory": True,
           # The jerky guideline (#9) names the product literally; the broader RTE fermented/
           # salt-cured/dried guideline (#8) is the scope match for everything else in these two
           # categories (biltong, dried sausage) -- PROVENANCE #8's own worked examples name
           # "biltong, droëwors" explicitly.
           "source_id": SRC_FSIS_JERKY_2014 if is_jerky else SRC_FSIS_GD_2023_0002}
    days = _duration_days(row.get("age") or "")
    if days is not None:
        blk["days"] = days
    else:
        unconverted.append({"id": item_id, "name": row.get("heb"), "field": "age",
                            "value": row.get("age"), "reason": "drying-duration-not-authored"})
    return blk


def _fermentation_block(text, source_field, row, unconverted, item_id):
    if not text or not any(w in text for w in _FERMENT_WORDS):
        return None
    blk = {"kind": "fermentation", "ph_max": PH_MAX_FERMENT, "degree_hours_max": DEGREE_HOURS_MAX,
           "limit_is_regulatory": True, "source_id": SRC_FSIS_GD_2023_0002,
           "limit_sources": [SRC_FSIS_GD_2023_0002, SRC_AMI_1997_DEGREE_HOURS]}
    hours = _duration_hours(text)
    days = _duration_days(text)
    if hours is not None:
        blk["duration_h"] = hours
    elif days is not None:
        blk["duration_h"] = days * 24
    else:
        unconverted.append({"id": item_id, "name": row.get("heb"), "field": source_field,
                            "value": text, "reason": "ferment-duration-not-authored"})
    return blk


def _aging_block_for_specials(row, unconverted, item_id):
    if row.get("cat") != "גבינה":
        return None
    age = row.get("age") or ""
    if not any(w in age for w in _AGE_WORDS):
        return None
    blk = {"kind": "aging"}
    days = _duration_days(age)
    if days is not None:
        blk["days"] = days
    else:
        unconverted.append({"id": item_id, "name": row.get("heb"), "field": "age",
                            "value": age, "reason": "aging-duration-not-authored"})
    # See module docstring, scope trap #2: the 60-day/35°F limit is scoped to unpasteurized milk,
    # which this data never states -- named as not-applicable, not attached, not silently skipped.
    blk["limit_check"] = "not-applicable"
    blk["limit_reason"] = ("milk pasteurization not authored -- 21 CFR 133's 60-day/35°F rule "
                           "is scoped to unpasteurized milk only")
    unconverted.append({"id": item_id, "name": row.get("heb"), "field": "cat",
                        "value": "גבינה", "reason": "aging-milk-not-authored"})
    return blk


def blocks_for_specials(row, unconverted, item_id):
    """SPECIALS row -> list of 0..3 blocks (drying / fermentation / aging)."""
    out = []
    d = _drying_block_for_specials(row, unconverted, item_id)
    if d:
        out.append(d)
    f = _fermentation_block(row.get("cure") or "", "cure", row, unconverted, item_id)
    if f:
        out.append(f)
    a = _aging_block_for_specials(row, unconverted, item_id)
    if a:
        out.append(a)
    return out


def blocks_for_makes(row, unconverted, item_id):
    """MAKES row -> list of 0..1 blocks. Fermentation only, per the ADDENDUM's own source table
    (`MAKES[*].build.phases` prose naming תסיסה/תרבית); drying/aging for MAKES are a named scope
    boundary, not built here (see module docstring)."""
    build = row.get("build") if isinstance(row.get("build"), dict) else None
    if not build:
        return []
    materials = build.get("materials")
    hay_mat = (" ".join(str(m) for m in materials)
               if isinstance(materials, (list, tuple)) else (materials or ""))
    phases = build.get("phases")
    hay_phase = (" ".join(str(p[1]) for p in phases if isinstance(p, (list, tuple)) and len(p) > 1)
                 if isinstance(phases, (list, tuple)) else "")
    f = _fermentation_block(hay_mat + " " + hay_phase, "build.materials+phases",
                            row, unconverted, item_id)
    return [f] if f else []
