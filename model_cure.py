# -*- coding: utf-8 -*-
"""`cure` blocks: extracted from what is authored, validated against the corpus.

Two sources, two shapes (ADDENDUM, "What each mechanism is extracted FROM"):
  - MAKES  carry a STRUCTURED `build.calc` (`{salt, cure, cureRate, sugar, water, brine,
    saltL, cureL, sugarL}`) — no prose parsing needed for the numbers themselves.
  - SPECIALS carry a Hebrew prose `cure` field that reliably names Cure #1 / Cure #2 and
    often a day count, but no numeric dose at all.

Nothing here computes a ppm/percentage figure and presents it as the item's OWN authored
value — every derived number is either (a) a straight unit-view of an authored field (g/kg
-> %), or (b) an estimate built from an authored dose (`cureRate`) times the STANDARD,
industry-defined composition of Prague Powder #1/#2 (6.25% sodium nitrite by weight — the
definition of what "Cure #1"/"Cure #2" ARE, not a guessed safety claim; corroborated
independently, item by item, in every `sources.py` MAKE_SOURCES 'cure' note this project
already ships, e.g. "2.5 g/kg = 156 ppm nitrite"). That estimate is used ONLY to check
against the corpus ceiling — never shipped as if it were an authored figure the data itself
states. The regulatory ceiling (9 CFR 424.21, #6) and floor (CFIA, #11) are attached as
LIMITS, each with its own corpus id, never folded into the item's own claim.

Two real bugs found while building this against the actual data (not invented, not
hypothetical — verified against data.py/sausages_new.py):

1. **The brine trap.** `b_pastrami`'s calc is `{salt:0, cure:None, brine:True, saltL:50,
   cureL:12, ...}` — a naive `calc.get('cure') in (None,'',0) -> fresh` reading would call
   5 pastrami MAKES "fresh" even though they are brine-cured with real Cure #1 (cureL=12
   g/L is the tell; the type itself is named in `materials`, "מלח + Cure #1 + סוכר...").
   Fixed here: `brine=True` with a non-zero `cureL` is ALSO a cure signal, and its dose is
   recorded in ITS OWN units (`brine_dose: {salt_g_per_l, cure_g_per_l}`) — never mapped
   onto `salt_g_per_kg`, because a per-liter brine dose and a per-kg dry-cure dose are not
   the same quantity without knowing the item's brine pickup, which is not authored anywhere.
   That gap is reported (`cure-dose-not-comparable`), never guessed.

2. **The CFIA floor is scoped, not universal.** Source #11's own PROVENANCE.md quotes CFIA
   verbatim: the 100 ppm + 2.5% salt floor exists "to prevent Clostridium botulinum
   outgrowth in FERMENTED MEAT PRODUCTS" — it is the sibling page to the general nitrite
   guidance, not a blanket floor for every cured item. Applying it to `salt=18` cooked/
   smoked-cooked sausages (Cure #1, refrigerated, safety from cooking + cold storage, not
   salt%) would read 1.8% < 2.5% on EVERY ordinary sausage in the catalogue and fire a wall
   of false breaches — exactly the failure mode the task brief warned against. This module
   restricts the floor check to `cure_type == '2'` items: our own data's own convention
   (GLOSSARY, `sausage_dry`, `b_salumi`, `sausages_new.SG`) already reserves Cure #2
   exclusively for "מוצרים מיובשים ארוכים שאינם מבושלים" (long-dried, unheated products) —
   the exact product class CFIA's floor targets. Cure #1 items get an explicit
   `not-applicable` verdict, never silently skipped and never wrongly checked.
"""
import re

# Corpus ids — mirrors model.py's numbering (docs/sources/corpus/NN-*).
SRC_9CFR_424_21 = 6          # ceiling: 200 ppm finished-product nitrite (general)
SRC_9CFR_424_22 = 7          # bacon-specific ppm schedule (dry-cured bacon: same 200 ppm ceiling)
SRC_CFIA_NITRITE_FLOOR = 11  # floor: 100 ppm + 2.5% salt, FERMENTED-AND-DRIED products only

NITRITE_PPM_MAX = 200        # 9 CFR 424.21(c) — general finished-product ceiling
SALT_PCT_MIN = 2.5           # CFIA — paired with the 100ppm floor, fermented/dried products only
# Prague Powder #1 and #2 are both, by definition, 6.25% sodium nitrite by weight (the
# nitrate in #2 is the slow-release component; the nitrite fraction that drives the ppm
# ceiling is the same 6.25% in both). ppm(mg nitrite / kg meat) = cureRate(g/kg) * 0.0625 *
# 1000 = cureRate * 62.5. Independently corroborated, item-by-item, by this project's own
# sources.py notes (e.g. "2.5 g/kg = 156 ppm", "Cure #1 (6.25% NaNO2): 2.5 g/kg = 156 ppm").
NITRITE_PPM_PER_CURE_RATE = 62.5

_CURE_N = re.compile(r"Cure\s*#\s*([12])", re.I)
_DAYS = re.compile(r"(\d+)\s*(?:[-–]\s*\d+\s*)?ימים")  # "N ימים" / "N-M ימים"
_BRINE_WORDS = ("תמלחת", "כבישה רטובה")  # תמלחת / כבישה רטובה


def _cure_type_from_text(text):
    if not text:
        return None
    m = _CURE_N.search(text)
    return m.group(1) if m else None


def _from_calc(calc):
    """MAKES structured path. Returns a base dict or None (no cure mechanism authored)."""
    if not isinstance(calc, dict):
        return None
    ctype = calc.get("cure")
    cure_l = calc.get("cureL") or 0
    is_brine_cured = bool(calc.get("brine")) and cure_l not in (0, None)
    if ctype in (None, "", 0) and not is_brine_cured:
        return None  # fresh — no cure mechanism, and that IS the answer (DoD-6)
    base = {"cure_type": (str(ctype) if ctype else None),
            "cure_rate_g_per_kg": calc.get("cureRate"),
            "brine": bool(calc.get("brine"))}
    if is_brine_cured:
        # Per-liter brine dose — a DIFFERENT unit basis from per-kg dry cure. Never mapped
        # onto salt_g_per_kg/sugar_g_per_kg (see module docstring, bug #1).
        base["brine_dose"] = {"salt_g_per_l": calc.get("saltL"), "cure_g_per_l": calc.get("cureL"),
                               "sugar_g_per_l": calc.get("sugarL")}
    else:
        base["salt_g_per_kg"] = calc.get("salt")
        base["sugar_g_per_kg"] = calc.get("sugar")
    return base


def _from_specials_prose(text):
    """SPECIALS.cure prose path. Returns a base dict or None."""
    ctype = _cure_type_from_text(text)
    if ctype is None:
        return None  # e.g. biltong ("חומץ+מלח..."), cheeses ("—" / aging prose) — no nitrite cure
    base = {"cure_type": ctype, "brine": any(w in text for w in _BRINE_WORDS)}
    d = _DAYS.search(text)
    if d:
        base["cure_days"] = int(d.group(1))
    return base


def _finalize(base, row, unconverted, item_id, classify_source, ref_text):
    blk = {k: v for k, v in base.items() if v is not None}
    blk["kind"] = "cure"
    # `nitrite_ppm_max`/`limit_sources` are NOT shipped per-block: every cure block would carry
    # the identical constant (200 / [6,7,11]) — no reader exists yet (Task 5 lands the consumer),
    # and shipping an identical value 60+ times with nobody reading it is exactly what
    # no-inert-shipment forbids (see model.py's own `_texture` field for the same call). A future
    # consumer reads the constants directly from this module. `limit_check`/`limit_reason` (the
    # actual per-item VERDICT) still ship below — that is the real output.
    sid = classify_source(ref_text or "")
    blk["source_id"] = sid
    if sid is None and ref_text:
        unconverted.append({"id": item_id, "name": row.get("heb"), "field": "cure",
                            "value": ref_text, "reason": "cure-source-unmapped"})

    checks = []  # (status, reason) — status in within/breach/not-applicable

    cure_rate = blk.get("cure_rate_g_per_kg")
    if cure_rate is not None:
        try:
            ppm = float(cure_rate) * NITRITE_PPM_PER_CURE_RATE
        except (TypeError, ValueError):
            ppm = None
        if ppm is not None:
            blk["nitrite_ppm_estimate"] = round(ppm, 1)
            if ppm > NITRITE_PPM_MAX:
                checks.append(("breach", "nitrite ~%.0f ppm (cureRate %.2f g/kg) > CFR 424.21 %d ppm ceiling"
                              % (ppm, cure_rate, NITRITE_PPM_MAX)))
            else:
                checks.append(("within", None))

    salt = blk.get("salt_g_per_kg")
    is_fermented_dried = blk.get("cure_type") == "2"
    if salt is not None:
        pct = round(float(salt) / 10.0, 2)
        blk["salt_pct"] = pct
        if is_fermented_dried:
            if pct < SALT_PCT_MIN:
                checks.append(("breach", "salt %s g/kg = %.2f%% < CFIA floor %.1f%% (fermented/dried)"
                              % (salt, pct, SALT_PCT_MIN)))
            else:
                checks.append(("within", None))
        else:
            # CFIA's floor is scoped to fermented-and-dried products (source #11 PROVENANCE,
            # verbatim: "to prevent Clostridium botulinum outgrowth in fermented meat
            # products"). This item's cure type is not '2' (fermented/dried, per our own
            # GLOSSARY's distinction) — a different product class, so the floor does not
            # apply. Recorded explicitly, never silently skipped and never wrongly checked.
            checks.append(("not-applicable", None))

    if any(s == "breach" for s, _ in checks):
        blk["limit_check"] = "breach"
        blk["limit_reason"] = "; ".join(r for s, r in checks if s == "breach")
    elif any(s == "within" for s, _ in checks):
        blk["limit_check"] = "within"
    elif any(s == "not-applicable" for s, _ in checks):
        blk["limit_check"] = "not-applicable"
    else:
        blk["limit_check"] = "unknown"
        if "brine_dose" in blk:
            # A real dose exists (per-liter), it just is not comparable to the per-kg ceiling
            # without absorption data nobody has authored — a mechanism seen, not quantified.
            unconverted.append({"id": item_id, "name": row.get("heb"), "field": "cure",
                                "value": blk["brine_dose"], "reason": "cure-dose-not-comparable"})
        else:
            unconverted.append({"id": item_id, "name": row.get("heb"), "field": "cure",
                                "value": row.get("cure"), "reason": "cure-dose-not-authored"})
    return blk


def block_for_makes(row, unconverted, item_id, classify_source):
    """MAKES row -> (block|None, ). Prefers the structured `build.calc`; falls back to a
    literal Cure #N mention in `build.materials` ONLY when calc states no cure type at all
    (bug #1's p-bast case: calc is all-zero/None but materials explicitly says "+ Cure #2")."""
    build = row.get("build") if isinstance(row.get("build"), dict) else None
    calc = build.get("calc") if build else None
    base = _from_calc(calc)
    materials = build.get("materials") if build else None
    hay = " ".join(str(m) for m in materials) if isinstance(materials, (list, tuple)) else (materials or "")
    if base is None:
        mt = _cure_type_from_text(hay)
        if mt is None:
            return None  # no cure signal anywhere authored for this row — genuinely fresh
        base = {"cure_type": mt, "brine": False}
    elif base.get("cure_type") is None:
        mt = _cure_type_from_text(hay)
        if mt:
            base["cure_type"] = mt
    ref = ((row.get("src") or {}).get("cure") or {}).get("ref") or ""
    return _finalize(base, row, unconverted, item_id, classify_source, ref)


def block_for_specials(row, unconverted, item_id, classify_source):
    """SPECIALS row -> block|None, from the prose `cure` field only."""
    text = row.get("cure")
    base = _from_specials_prose(text or "")
    if base is None:
        return None
    ref = ((row.get("src") or {}).get("cure") or {}).get("ref") or ""
    return _finalize(base, row, unconverted, item_id, classify_source, ref)
