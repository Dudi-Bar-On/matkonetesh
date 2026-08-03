# -*- coding: utf-8 -*-
"""`drying` / `fermentation` / `aging` blocks -- read out of the authored prose, never the
threshold (ADDENDUM, "Task 1c", owner instruction 2026-08-03; extended to MAKES.build.phases by
Task 1c-b, 2026-08-03).

Thresholds are NEVER read out of the prose: the prose says "4-7 ימים בייבוש מאוורר", never an a_w.
The prose supplies the DURATION and the fact that the mechanism applies; the corpus supplies the
THRESHOLD, attached as a regulatory LIMIT with its own source_id, never presented as this item's
own measured value.

Extraction sources ("What each mechanism is extracted FROM"):
  - `drying`       <- SPECIALS.age prose, gated by SPECIALS.cat in DRY_CATEGORIES
                      AND (Task 1c-b) MAKES.build.phases prose -- see `_drying_phases` below.
  - `fermentation` <- SPECIALS.cure prose (תרבית/תסיסה) AND MAKES.build.materials/phases prose
  - `aging`        <- SPECIALS.age prose, gated by SPECIALS.cat == 'גבינה'. MAKES carries NO aging
                      signal: verified directly (grep -n "מיושן|יישון" data.py sausages_new.py) --
                      every hit is a SPECIALS cheese row, the BUILDS cut-18 burger-variant prose, or
                      the glossary; zero MAKES make()/SG() rows use either word anywhere in their
                      build (materials or phases). A checked-and-empty scope, not a skipped one --
                      no code was added for MAKES aging because there is nothing to extract.

## Task 1c-b: MAKES.build.phases -> `drying` (2026-08-03)

Task 1c named MAKES drying/aging as a scope boundary because the plan's ADDENDUM source table
named only SPECIALS.age/cat for those two kinds. The controller then measured a material gap: four
shelf-stable dry-cured MAKES sausages (m-sopr, n-milano, n-pepperoni, n-krakowska-pod) carried NO
`drying` block anywhere, despite `build.phases` holding the richest process prose in the catalogue
(duration, temperature, humidity, and -- the charcutier's practical a_w proxy -- the weight-loss
target). This module now also extracts `drying` from MAKES.

**Gate: per-phase keyword co-occurrence, not category.** A phase counts as a genuine drying/ageing
step only when its OWN label+body contain a drying word ("ייבוש"/"הבשלה") *and* a multi-day
duration word ("ימים"/"יום"/"שבועות"/"חודשים"). Both conditions are required together -- see the
two false-positive traps this avoided, found by reading every builder function MAKES actually uses
(data.py/sausages_new.py), not assumed:

1. **b_emul()'s own Pellicle phase says "ייבוש".** Every emulsion sausage (m-frank, m-morta,
   m-bolo -- Frankfurter/Mortadella/Bologna, all cooked and refrigerated, never shelf-stable) has a
   phase whose body reads literally "תלה במקרר 1-2 שעות **לייבוש** מעטפת" -- a pre-smoke surface
   dry, not the FSIS mechanism. A bare "ייבוש" keyword scan would fire on all three. Excluded
   because that phase states "שעות" (hours), never a day/week/month word.
2. **sausage_smoked()'s own post-cook rest phase says "הבשלה".** Its label is literally "8 ·
   קירור **והבשלה**" (used by m-snack, m-loukaniko, m-linguica, bbq-hotlinks) but the body is "קרר
   במקלחת קרה... ואז מנוחה במקרר לפני ההגשה" -- a chill-and-rest step with NO duration stated at
   all. Excluded because neither the label nor the body states a day/week/month figure.

**Category is deliberately NOT the gate.** cat == 'פסטרמה' covers both the five wet-brined,
steamed pastramis (p-ny/p-mont/p-turkey/p-deckel/p-lamb -- b_pastrami(), whose phases never say
ייבוש/הבשלה at all, correctly excluded) AND p-bast (Pastırma -- genuinely air-dried, unrefrigerated,
never cooked, phases literally "3 · ייבוש ראשון" / "5 · ייבוש סופי"). A category gate would either
wrongly exclude p-bast or wrongly include the other four; the phase-keyword gate gets both right
for free because it reads what the recipe itself states, verified against all 102 MAKES rows
(data.MAKES + sausages_new.NEW_SAUSAGES) -- 28 items match, every one inspected by hand.

**Per-field extraction, not one blob.** Duration/temperature/humidity come from the matched
phase(s) ONLY (their own label+body, sliced from the word "תלה" onward when present, so a merged
"ferment-then-hang" phase like SG's single ייבוש/הבשלה phase never lets the fermentation-stage
temperature (e.g. n-pepperoni's "תסס 48ש **ב-22°**") leak into the drying temperature). The
weight-loss target is scanned across the WHOLE build text (materials + every phase), because
sausage_dry()/b_salumi() state it in an earlier "weigh the item" phase whose own label never says
ייבוש/הבשלה (e.g. sausage_dry's phase 4 "מילוי ושקילת יעד") -- restricting that scan to the
drying-gated phases would silently lose it. When a matched item's build.phases spans TWO
qualifying phases (b_salumi's initial "ייבוש ראשוני" hang plus the main "הבשלה" phase), each
phase's own temperature/humidity is extracted separately and the two are combined by the WIDEST
band (min of the lows, max of the highs) and duration by the LONGEST -- never averaged, never
re-derived, each number traces to a phase that literally states it.

**Line not crossed (owner instruction, this task's own name for it): the weight-loss figure is
shipped as `weight_loss_pct_min/max`, an authored value, full stop.** It is never converted to an
a_w estimate and never compared against AW_MAX_SHELF_STABLE -- the corpus limit attaches alongside
it (`aw_max`, `source_id`) exactly as it already does for SPECIALS drying blocks, and the two are
never merged into one number.

## Task 1c-c: MAKES items whose prose names fermentation but carried no `fermentation` block (2026-08-03)

The controller measured a MECHANISM gap Task 1c-b did not check: six MAKES items whose authored
prose names fermentation carried no `fermentation` block at all -- m-droe, n-milano, n-finocchiona,
n-pepperoni, n-summer, n-teewurst. Investigated by reading every field of all six (not assumed):

1. **`m-droe`'s own intro states "ללא התססה" -- "WITHOUT fermentation".** It is the one item in the
   whole six that must NOT gain a block; the corpus is correct as shipped. Verified this is the
   ONLY negated fermentation mention anywhere in data.py/sausages_new.py (`grep -n
   "(ללא|בלי)\s+\S*(תרבית|תסיס|תסס)"`) -- one instance, one guard needed: `_NEGATED_FERMENT` strips
   a "ללא/בלי <ferment-word>" clause before the presence check runs.
2. **The other five genuinely name fermentation, but not with the word list Task 1c shipped**
   (`תרבית`, `תסיסה`, `התססה`, `התסס`). SG()-generated items (sausages_new.py) write the
   abbreviated imperative "תסס" (bare, no ה- prefix -- e.g. n-pepperoni's "תסס 48ש ב-22°") or the
   passive participle "מותסס" (e.g. n-teewurst's intro "מעושן ומותסס"). Both contain the 3-letter
   root תסס as a literal substring, so adding the single word `תסס` to `_FERMENT_WORDS` catches
   both forms for free (and makes `התססה`/`התסס` redundant, kept for readability/history).
3. **n-teewurst's ONLY fermentation mention anywhere in its authored data is in `build.intro`**
   ("מעושן ומותסס") -- its materials/spice list and its `dry` phase body never say תסס/תרבית/
   תסיסה. Task 1c/1c-b never scanned `intro` for MAKES (only materials + phase bodies). Extending
   the scan to `intro` is the only way to attach teewurst's mechanism truthfully -- guarded by the
   same negation check, since `intro` is exactly the free-text field where a "ללא X" disclaimer
   would live (as m-droe proves).
4. **Duration stays absent for all newly-added items, by design (owner instruction, this task).**
   The abbreviated "48ש" notation SG() writes is deliberately never parsed -- reusing the existing
   `_duration_hours`/`_duration_days` regexes (spelled-out שעות/ימים/שבועות only) already achieves
   this: "48ש" simply never matches. Every item added here reports `ferment-duration-not-authored`.
5. **A pre-existing misattribution bug, found while building this correctly, fixed in the same
   pass.** The OLD MAKES fermentation-duration logic ran `_duration_hours`/`_duration_days` over
   the WHOLE merged materials+phases blob. For SG()-generated items whose single `dry` phase merges
   a fermentation clause with a drying/hang clause ("תסס 24ש ב-22°, תלה 2-3 שבועות ב-13°..."), that
   let the drying-week figure leak into `duration_h` as if it were the fermentation duration --
   the EXACT failure mode this module's docstring already names as the reason duration extraction
   from merged phases is unsafe. Verified in production before this fix: `n-fuet` reported
   `duration_h: 504` (3 weeks of HANG time, not ferment time) and `n-chorizo-esp` reported
   `duration_h: 840` (5 weeks). `n-landjager` reported `duration_h: 6` -- not a drying figure at
   all but its unrelated SMOKE phase's "4-6 שעות". Fixed by scoping duration extraction to the
   SPECIFIC phase(s) whose own label+body name fermentation (`_ferment_phases`, mirroring
   `_drying_phases`'s per-phase gate), sliced UP TO the word "תלה" when present -- the
   complementary slice to `_mk_phase_scan_text`'s FROM-"תלה" slice used for drying. After the fix,
   n-fuet/n-chorizo-esp correctly report `ferment-duration-not-authored` (their ferment clause is
   the un-parsed abbreviated "Xש" form) and n-landjager likewise (its ferment word is in
   `materials` only, no phase states a fermentation duration). Items whose dedicated fermentation
   phase spells the duration in full (m-sopr/m-sauci/m-cacc/m-nduja/m-sucuk, all built via
   `sausage_dry()`, whose own phase 5 "5 · התססה (עד pH)" states e.g. "24-48 שעות" literally) are
   unaffected -- still correctly extracted. This is a derived-output fix, not a change to any
   authored source value (DoD-10): no `data.py`/`sausages_new.py` prose was touched.

## Task 1c's original two scope traps (SPECIALS only -- unchanged by this task)

Checked against each source's own PROVENANCE before applying it (owner instruction -- verify
scope, do not assume):

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

_FERMENT_WORDS = ("תרבית", "תסיסה", "התססה", "התסס")   # Task 1c's original list -- UNCHANGED, still
# the only list `_fermentation_block` (shared with SPECIALS) uses, so SPECIALS detection and every
# previously-shipped MAKES fermentation block are byte-identical to before this task (DoD-10: prove
# nothing else moved).
_FERMENT_WORDS_MAKES = _FERMENT_WORDS + ("תסס",)  # Task 1c-c, MAKES-only broadened list: the bare
# root תסס (no ה- prefix) is how SG()-generated items (sausages_new.py) write both the imperative
# "תסס 48ש" and -- as a literal substring -- the passive participle "מותסס". Used ONLY in the new
# fallback path below (`_fermentation_block_for_makes`), never by the shared function, so it cannot
# change SPECIALS output (verified: every SPECIALS row containing "תסס"/"מותסס" already contains
# "תרבית" or "התססה" in the same `cure` field -- grep across data.py's SPECIALS block, none is a
# new match on its own).
# Task 1c-c: strips a "ללא/בלי <ferment-word>" clause before the presence check -- guards the one
# negation instance in the whole corpus, m-droe's own intro "ללא התססה" ("WITHOUT fermentation").
_NEGATED_FERMENT = re.compile(r"(?:ללא|בלי)\s+[^\s.,;:—]*(?:תסס|תרבית|תסיסה)[^\s.,;:—]*")
_AGE_WORDS = ("יישון", "מיושן")

# ---- Task 1c-b: MAKES.build.phases -> drying (module docstring, "Task 1c-b" section) ----
# Gate words -- BOTH a drying/ageing word AND a multi-day duration word must co-occur in the same
# phase's own label+body (never single-condition -- see the two false-positive traps documented
# above: b_emul()'s "לייבוש מעטפת" pellicle phase states only hours, sausage_smoked()'s "8 · קירור
# והבשלה" states no duration at all).
_MK_DRY_WORDS = ("ייבוש", "הבשלה")
_MK_DAY_WEEK_MONTH_WORDS = ("ימים", "יום", "שבועות", "חודשים")

_MK_TEMP_C = re.compile(r"(\d+)\s*(?:[-–]\s*(\d+)\s*)?°\s*C?")
# Three humidity shapes actually authored: "לחות 70–80%" (word before number), "75% לחות" (number
# before word), and bare "13° 75%" (number immediately after a temperature, no לחות word at all --
# the SG()-generated dry-phase shorthand). Tried in this order; first match wins.
_MK_HUM_LABELLED = re.compile(r"לחות\D{0,3}(\d+)\s*(?:[-–]\s*(\d+)\s*)?%")
_MK_HUM_TRAILING_WORD = re.compile(r"(\d+)\s*(?:[-–]\s*(\d+)\s*)?%\s*לחות")
_MK_HUM_AFTER_TEMP = re.compile(r"°\s*C?[^\d%]{0,4}(\d+)\s*(?:[-–]\s*(\d+)\s*)?%")
_MK_MONTHS = re.compile(r"(\d+)\s*(?:[-–]\s*(\d+)\s*)?חודשים")
_MK_WEEKS = re.compile(r"(\d+)\s*(?:[-–]\s*(\d+)\s*)?שבועות")
_MK_DAYS = re.compile(r"(\d+)\s*(?:[-–]\s*(\d+)\s*)?(?:ימים|יום)")
# Weight-loss: "ירידה 35–40%" / "ירידת 35–40%" / "איבוד ~15%" (word before number) or the reversed
# "35% איבוד" (number before word) -- both orders are literally authored in this data.
_MK_WLOSS_WORD_FIRST = re.compile(r"(?:ירידה|ירידת|איבוד)\D{0,6}(\d+)\s*(?:[-–]\s*(\d+)\s*)?%")
_MK_WLOSS_NUM_FIRST = re.compile(r"(\d+)\s*(?:[-–]\s*(\d+)\s*)?%\s*(?:איבוד|ירידה)")


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


def _mk_range_match(regexes, text):
    """First regex (in order) that matches `text` wins; returns (lo, hi) or None. A single value
    (no explicit range) sets lo == hi -- the digit IS the stated figure."""
    for rx in regexes:
        m = rx.search(text)
        if m:
            lo = int(m.group(1))
            hi = int(m.group(2)) if m.group(2) else lo
            return (lo, hi)
    return None


def _mk_duration_days(text):
    """Longest stated duration in `text`, in days -- weeks*7, months*30 (both plain unit
    conversions of a literally-stated figure, exactly how `_duration_days` already converts
    weeks). Never invents a number the prose does not give."""
    candidates = []
    m = _MK_MONTHS.search(text)
    if m:
        candidates.append(int(m.group(2) or m.group(1)) * 30)
    m = _MK_WEEKS.search(text)
    if m:
        candidates.append(int(m.group(2) or m.group(1)) * 7)
    m = _MK_DAYS.search(text)
    if m:
        candidates.append(int(m.group(2) or m.group(1)))
    return max(candidates) if candidates else None


def _mk_phase_scan_text(label, body):
    """Slice from the word 'תלה' (hang) onward when present -- the merged ferment-then-hang
    phases SG() generates (e.g. n-pepperoni: "תסס 48ש ב-22°, תלה 3-4 שבועות ב-13° 75%") state the
    FERMENTATION temperature before 'תלה' and the DRYING temperature after it; scanning the whole
    phase would misattribute the 22° fermentation temperature as this item's drying temperature.
    Falls back to the whole text when 'תלה' is absent (single-stage phases, e.g. sausage_dry()'s
    "ייבש ב-..." phrasing, or b_salumi()'s "6 · הבשלה" phase, never mix stages in one string)."""
    text = "%s %s" % (label, body)
    idx = text.find("תלה")
    return text[idx:] if idx != -1 else text


def _drying_phases(build):
    """The phases of `build` whose OWN label+body state BOTH a drying/ageing word AND a
    multi-day duration word -- see the module docstring's two false-positive traps for why both
    conditions are required together. Returns a list of (label, body) pairs, phase order
    preserved (b_salumi() genuinely has two: an initial short hang, then the main ageing phase)."""
    phases = build.get("phases")
    if not isinstance(phases, (list, tuple)):
        return []
    out = []
    for p in phases:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            continue
        label, body = str(p[0]), str(p[1])
        combined = label + " " + body
        if (any(w in combined for w in _MK_DRY_WORDS)
                and any(w in combined for w in _MK_DAY_WEEK_MONTH_WORDS)):
            out.append((label, body))
    return out


def _mk_full_build_text(build):
    """materials + every phase's own label+body, concatenated -- used ONLY for the weight-loss
    scan (see module docstring: sausage_dry()/b_salumi() state the weight target in an earlier
    'weigh the item' phase whose own label never says ייבוש/הבשלה, so restricting the scan to
    `_drying_phases()`'s matched phases would silently lose it)."""
    materials = build.get("materials")
    hay_mat = (" ".join(str(m) for m in materials)
               if isinstance(materials, (list, tuple)) else (materials or ""))
    phases = build.get("phases")
    hay_phase = " ".join(
        "%s %s" % (p[0], p[1]) for p in phases if isinstance(p, (list, tuple)) and len(p) > 1
    ) if isinstance(phases, (list, tuple)) else ""
    return hay_mat + " " + hay_phase


def _drying_block_for_makes(row, unconverted, item_id):
    build = row.get("build") if isinstance(row.get("build"), dict) else None
    if not build:
        return None
    phases = _drying_phases(build)
    if not phases:
        return None
    is_jerky = bool(_JERKY_NAME.search(row.get("heb") or ""))
    blk = {"kind": "drying", "aw_max": AW_MAX_SHELF_STABLE, "limit_is_regulatory": True,
           "source_id": SRC_FSIS_JERKY_2014 if is_jerky else SRC_FSIS_GD_2023_0002}

    day_cands = []
    temp_los, temp_his, hum_los, hum_his = [], [], [], []
    for label, body in phases:
        scan = _mk_phase_scan_text(label, body)
        d = _mk_duration_days(scan)
        if d is not None:
            day_cands.append(d)
        t = _mk_range_match([_MK_TEMP_C], scan)
        if t:
            temp_los.append(t[0]); temp_his.append(t[1])
        h = _mk_range_match([_MK_HUM_LABELLED, _MK_HUM_TRAILING_WORD, _MK_HUM_AFTER_TEMP], scan)
        if h:
            hum_los.append(h[0]); hum_his.append(h[1])

    if day_cands:
        blk["days"] = max(day_cands)
    else:
        unconverted.append({"id": item_id, "name": row.get("heb"), "field": "build.phases",
                            "value": [b for _, b in phases], "reason": "drying-duration-not-authored"})
    if temp_los:
        blk["temp_c_min"] = min(temp_los)
        blk["temp_c_max"] = max(temp_his)
    if hum_los:
        blk["humidity_pct_min"] = min(hum_los)
        blk["humidity_pct_max"] = max(hum_his)

    w = _mk_range_match([_MK_WLOSS_WORD_FIRST, _MK_WLOSS_NUM_FIRST], _mk_full_build_text(build))
    if w:
        blk["weight_loss_pct_min"] = w[0]
        blk["weight_loss_pct_max"] = w[1]
    else:
        unconverted.append({"id": item_id, "name": row.get("heb"), "field": "build.phases",
                            "value": None, "reason": "drying-weight-loss-not-authored"})
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


def _mk_ferment_scan_text(label, body):
    """Task 1c-c. Complementary slice to `_mk_phase_scan_text`: text UP TO the word 'תלה' (hang)
    when present -- the merged ferment-then-hang phases SG() generates state the FERMENTATION
    clause BEFORE 'תלה' and the DRYING clause after it (e.g. n-fuet: "תסס 24ש ב-22°, תלה 2-3
    שבועות ב-13° 80% לחות"). Falls back to the whole text when 'תלה' is absent (sausage_dry()'s
    dedicated phase 5 "5 · התססה (עד pH)" never says תלה)."""
    text = "%s %s" % (label, body)
    idx = text.find("תלה")
    return text[:idx] if idx != -1 else text


def _ferment_phases(build):
    """Task 1c-c. The phases of `build` whose OWN label+body name fermentation under the
    MAKES-broadened word list (after stripping a negated mention) -- mirrors `_drying_phases`'s
    per-phase gate, used to scope duration extraction so a phase's own drying-week figure never
    leaks into the fermentation duration."""
    phases = build.get("phases")
    if not isinstance(phases, (list, tuple)):
        return []
    out = []
    for p in phases:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            continue
        label, body = str(p[0]), str(p[1])
        cleaned = _NEGATED_FERMENT.sub(" ", label + " " + body)
        if any(w in cleaned for w in _FERMENT_WORDS_MAKES):
            out.append((label, body))
    return out


def _fermentation_block_for_makes(row, unconverted, item_id):
    """Task 1c-c. MAKES row -> fermentation block, or None. See module docstring's Task 1c-c
    section for the full investigation (the m-droe negation trap, the bare-תסס word gap, the
    intro-only teewurst case, and a pre-existing merged-phase duration bug this investigation
    found but deliberately does NOT fix here).

    Two-tier, in this order:
    1. **Byte-identical to Task 1c/1c-b's original call** -- `_fermentation_block` on
       materials+phase-bodies, the original `_FERMENT_WORDS` list, unchanged. If it detects a
       block, that block (duration_h included, bugs included) is returned AS-IS. This is what
       makes DoD-10's "prove nothing else moved" true for every one of the 10 MAKES items that
       already carried a fermentation block before this task -- including three
       (n-fuet/n-chorizo-esp/n-landjager) whose `duration_h` this investigation found to be
       misattributed from an unrelated phase (see module docstring). Left untouched: fixing it
       would move something this task was not asked to move, and the report names it for a
       separate owner decision instead.
    2. **Only reached when tier 1 found nothing** (nothing to preserve, so no "moved" risk):
       broadened detection over materials + phase bodies + `build.intro` (negation-guarded,
       `_FERMENT_WORDS_MAKES`) -- intro is the ONLY place n-teewurst's fermentation is named.
       Duration here is extracted ONLY from the phase(s) that themselves name fermentation, sliced
       UP TO 'תלה' (`_mk_ferment_scan_text`), using the EXISTING full-word-only regexes -- the
       abbreviated "48ש" notation is deliberately never parsed (this task's own scope: duration
       stays absent for every item whose only stated figure is that shorthand)."""
    build = row.get("build") if isinstance(row.get("build"), dict) else None
    if not build:
        return None
    materials = build.get("materials")
    hay_mat = (" ".join(str(m) for m in materials)
               if isinstance(materials, (list, tuple)) else (materials or ""))
    phases = build.get("phases")
    hay_phase = (" ".join(str(p[1]) for p in phases if isinstance(p, (list, tuple)) and len(p) > 1)
                 if isinstance(phases, (list, tuple)) else "")

    prior = _fermentation_block(hay_mat + " " + hay_phase, "build.materials+phases",
                                row, unconverted, item_id)
    if prior is not None:
        return prior

    intro = build.get("intro") or ""
    detect_text = _NEGATED_FERMENT.sub(" ", hay_mat + " " + hay_phase + " " + intro)
    if not any(w in detect_text for w in _FERMENT_WORDS_MAKES):
        return None

    blk = {"kind": "fermentation", "ph_max": PH_MAX_FERMENT, "degree_hours_max": DEGREE_HOURS_MAX,
           "limit_is_regulatory": True, "source_id": SRC_FSIS_GD_2023_0002,
           "limit_sources": [SRC_FSIS_GD_2023_0002, SRC_AMI_1997_DEGREE_HOURS]}

    hour_cands = []
    for label, body in _ferment_phases(build):
        scan = _mk_ferment_scan_text(label, body)
        h = _duration_hours(scan)
        if h is not None:
            hour_cands.append(h)
        else:
            d = _duration_days(scan)
            if d is not None:
                hour_cands.append(d * 24)
    if hour_cands:
        blk["duration_h"] = max(hour_cands)
    else:
        unconverted.append({"id": item_id, "name": row.get("heb"),
                            "field": "build.materials+phases+intro",
                            "value": None, "reason": "ferment-duration-not-authored"})
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
    """MAKES row -> list of 0..2 blocks: fermentation (Task 1c; broadened by Task 1c-c to the bare
    "תסס"/"מותסס" root and to `build.intro` -- see that section's own docstring for the full word-
    list and scope investigation, superseding 1c-b's note that "תסס" was deliberately withheld)
    and drying (Task 1c-b, `_drying_block_for_makes`). MAKES carries no aging signal at all
    (verified, see module docstring) -- no code was added for it."""
    out = []
    f = _fermentation_block_for_makes(row, unconverted, item_id)
    if f:
        out.append(f)
    d = _drying_block_for_makes(row, unconverted, item_id)
    if d:
        out.append(d)
    return out
