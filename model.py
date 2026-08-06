# -*- coding: utf-8 -*-
"""The one place that knows what the legacy flat row meant.

Every other consumer reads the structured item. `safe` encodes three states —
a cited floor, 0 meaning "not applicable" (every ירקות/פירות row), and absence
meaning "we hold no figure" — and R-82 is what happens when each consumer
decides for itself. That decision now happens exactly here, once.
"""
import re as _re

import model_cure
import model_paths
import model_process
import model_sheet

SCHEMA_VERSION = 1

# Q-2 — owner gate (2026-08-03, Task 1b bundle-size finding). MAKES-as-items (Task 1f, 102 rows —
# `data.MAKES` 50 + `sausages_new.NEW_SAUSAGES` 52, NOT the plan's assumed 50) costs ~34KB of raw
# structural JSON before a single cure block; the whole task (MAKES-as-items + cure blocks on both
# MAKES and SPECIALS) measured dist/index.html at 2,607,978 bytes against the A1 cap of 2,600,000
# (headroom was ~7.9KB going in — see docs/sources/corpus and build.py's own A1 comment). Per the
# task brief's own instruction ("if you would exceed the cap, STOP and report — do not trim
# converted data to fit"), this is NOT trimmed to fit. The converter is fully built and correct
# (verified directly against data.py, `.superpowers/sdd/model-task1b-report.md`); shipping it was
# gated here, exactly like `model_paths.IMPORT_OWNER_SHEET`, pending the owner's decision between
# (a) raising the A1 cap for this specific growth, or (b) externalizing `items` the way `lang-*.json`
# was split out of the bundle (Dec-A1). The owner chose (b) — Task B (2026-08-03) moved the whole
# `items` array out of DATA_JSON into dist/items.json, fetched on demand (mirrors Dec-A1); that
# freed ~137KB of bundle headroom, so MAKES-as-items now ships. SPECIALS' cure blocks (13 items,
# ~1.15KB) were never affected by this flag.
SHIP_MAKES_ITEMS = True

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


# The floors an authority OWNS, in °C. Used only to break a tie between authorities a single
# citation names together — never to invent an attribution where none was cited.
#
# 63 / 71 / 74 are 145°F / 160°F / 165°F: the USDA FSIS Safe Minimum Internal Temperature Chart
# (corpus #3). Baldwin has no such floors — he publishes time-temperature pasteurisation tables, and
# where his text carries 74 for poultry he is QUOTING the USDA. Reviewer 6 checked that subset
# explicitly (17 blocks) and said so; quoting a number is not being its source.
#
# #4 (AskUSDA, variety/organ meats) owns 71°C = 160°F for exactly that class. Without this line the
# tie-break handed all seven variety-meat citations to the generic chart, because #3 lists 160°F too
# — measured: it erased every AskUSDA attribution in the catalogue. The specific document about
# organ meats is the better answer for a citation that says "variety/organ meats 160°F".
_AUTHORITY_FLOORS = {
    SRC_FSIS_SAFE_MIN_TEMP: {63, 71, 74},
    SRC_ASKUSDA_VARIETY_MEATS: {71},
}

# Documents cited by name that the corpus DOES NOT HOLD. Verified on disk, not assumed:
# docs/sources/corpus/18-amazingribs-blonder/ contains combustion-stages, stall-experiment,
# wood-type, wood-smoking-parameters, pork-shoulder-wrap-trial and resting-meat data — and nothing
# called a Food Temperature Guide. 27 citations point at it.
#
# This is not a blocklist of a source; corpus #18 is a legitimate source for the stall and wood
# questions it actually answers. It is a refusal to cite ONE document that is not there. A citation
# a reader cannot follow is not provenance, and model.py's own standing instruction is that a wrong
# source_id is worse than a missing one.
_ABSENT_DOCUMENTS = (
    (SRC_AMAZINGRIBS_BLONDER, "food temperature guide"),
)

# Segment separators. "Baldwin — SV floor 54.4C; USDA 145F/63C" is two claims by two authorities in
# one string, and reading it as one blob is what let the wrong half win.
_SEGMENT_SPLIT = _re.compile(r"[;·|]|\s+\+\s+")
_TEMP_C = _re.compile(r"(\d+(?:\.\d+)?)\s*°?\s*C\b", _re.I)
_TEMP_F = _re.compile(r"(\d+(?:\.\d+)?)\s*°?\s*F\b", _re.I)


def _candidates(text):
    """Every corpus id this text names, in keyword order, without duplicates.

    The defect this replaces was `return` inside this loop: first-match-wins with ("baldwin", …) at
    index 0 meant any string mentioning Baldwin was Baldwin's, whatever the number said. Collecting
    all of them is what makes the ambiguity visible enough to resolve — or to report.

    A matched needle is BLANKED OUT before the later, more generic ones are tried, and that detail
    is load-bearing. `_SOURCE_KEYWORDS` is ordered most-specific-first and ends with the catch-alls
    ("usda", "fsis") — but "usda" is a substring of "AskUSDA", so a plain scan reads
    "AskUSDA — variety meats" as naming TWO authorities, calls it ambiguous, and drops a citation
    that was never in doubt. Measured: it erased all five AskUSDA attributions. Blanking preserves
    the ordering's original meaning while still letting a string that genuinely names two
    authorities — "Baldwin … ; USDA 145F/63C" — produce two candidates.
    """
    low = (text or "").lower()
    out = []
    for needle, sid in _SOURCE_KEYWORDS:
        if needle in low:
            low = low.replace(needle, " " * len(needle))
            if sid not in out:
                out.append(sid)
    return out


def _states_value(segment, value_c):
    """Does this segment state `value_c`, in either unit?

    145°F is 62.78°C and the catalogue ships 63, so an exact comparison would reject the very case
    this exists for. The tolerance is half a degree — wide enough for °F→°C rounding, far too narrow
    to accidentally match a different authority's floor (the floors are 63/71/74, degrees apart).
    """
    if value_c is None:
        return False
    for raw in _TEMP_C.findall(segment):
        if abs(float(raw) - value_c) <= 0.6:
            return True
    for raw in _TEMP_F.findall(segment):
        if abs((float(raw) - 32.0) * 5.0 / 9.0 - value_c) <= 0.6:
            return True
    return False


def _resolve_source(ref_text, value_c=None):
    """Resolve a citation to (corpus_id, reason). `reason` is None when the answer is clean.

    THE RULE, in the order a person would apply it:
      1. drop any candidate whose cited DOCUMENT the corpus does not hold
      2. if the string states numbers, the authority that states THIS number owns it
      3. if several authorities remain and exactly one owns the value as a published floor, it wins
      4. one candidate left → that one; several → refuse and say so; none → refuse and say so

    Still deliberately conservative about what it will not touch: refs naming sources outside the
    19-document corpus (Marianski/meatsandsausages, Wikipedia, ChefSteps, EatCuredMeat, Turkish Food
    Codex, Gastrochemist, Nem Chua literature, or house notes like "Protocol — produce") match no
    keyword and resolve to None on purpose. Inventing a corpus pointer for them would be a false
    citation, which is the thing this whole function exists to stop.
    """
    text = ref_text or ""
    low = text.lower()
    cands = _candidates(text)
    if not cands:
        return None, ("safe-source-unmapped" if text else None)

    # 1 — a citation to a document nobody can open is not a citation.
    dropped = [sid for sid, phrase in _ABSENT_DOCUMENTS if sid in cands and phrase in low]
    if dropped:
        cands = [c for c in cands if c not in dropped]
        if not cands:
            return None, "safe-source-document-absent"

    if len(cands) == 1:
        return cands[0], None

    # 2 — the number decides. Segment first: a claim belongs to the authority named beside it.
    for segment in _SEGMENT_SPLIT.split(text):
        seg_cands = [c for c in _candidates(segment) if c in cands]
        if len(seg_cands) == 1 and _states_value(segment, value_c):
            return seg_cands[0], None

    # 3 — a shared citation the numbers did not settle ("Baldwin/USDA poultry floor"): whoever OWNS
    # the value as a published floor. `cands` is in `_SOURCE_KEYWORDS` order, which is
    # most-specific-first, so when more than one authority owns the figure the specific document
    # wins over the general chart — "USDA — variety/organ meats 160°F/71°C" belongs to the AskUSDA
    # variety-meats page (#4), not to the catch-all Safe Minimum Internal Temperature chart (#3),
    # even though both list 160°F.
    owners = [c for c in cands if value_c is not None
              and value_c in _AUTHORITY_FLOORS.get(c, ())]
    if owners:
        return owners[0], None

    # 4 — genuinely undecidable. The whole defect class was a classifier that always had an answer.
    return None, "safe-source-ambiguous"


def _classify_source(ref_text, value_c=None):
    """Back-compatible wrapper — `model_cure` passes this as a one-argument callable."""
    return _resolve_source(ref_text, value_c)[0]


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
    # THE VALUE IS PASSED IN, and that is the whole of §5.3. Resolving a citation without knowing
    # which number it is meant to support is what let `"Baldwin — SV floor 54.4C; USDA 145F/63C"`
    # credit Baldwin for a 63 the string itself attributes to the USDA. The citation and the value
    # are one fact; they are now decided together.
    sid, reason = _resolve_source(ref, int(round(v)))
    if sid is None and reason:
        # The number is real and must not be dropped (DoD-10) — but its citation cannot be honestly
        # resolved to a corpus folder from the text we have. Ship the number, flag the gap by name,
        # and say WHICH kind of gap: nothing matched, the cited document is absent from the corpus,
        # or two authorities remain and nothing in the text decides between them. The old single
        # `safe-source-unmapped` counted only the first, which is why the metric read green while
        # 62 blocks carried an attribution nobody had checked.
        unconverted.append({"id": item_id, "name": row.get("heb"),
                            "field": "safe", "value": ref, "reason": reason})

    # And the sharper fact the binding exposes on its way past: a citation that STATES a temperature
    # which is not the one shipped. Six blocks (measured): four organ meats ship 72°C against a
    # citation reading "160°F/71°C", and two shrimp ship 63°C against "Baldwin fish 55–60°C".
    #
    # The value is NOT touched. Changing a safety number because its citation disagrees would be a
    # safety change wearing a provenance fix's clothes, and DoD-10 forbids it — either the number is
    # right and the citation is wrong, or the reverse, and only the owner can say which. What this
    # does is make the disagreement countable instead of invisible, which is the entire point of the
    # arc: the old classifier could not have noticed, because it never compared the two at all.
    _stated = [float(x) for x in _TEMP_C.findall(ref)]
    _stated += [(float(x) - 32.0) * 5.0 / 9.0 for x in _TEMP_F.findall(ref)]
    if _stated and not any(abs(t - v) <= 0.6 for t in _stated):
        unconverted.append({
            "id": item_id, "name": row.get("heb"), "field": "safe",
            "value": "ships %g°C; citation states %s" % (v, ", ".join("%g" % t for t in sorted(set(round(x, 1) for x in _stated)))),
            "reason": "safe-value-not-stated-by-citation",
        })
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
    # The owner's spreadsheet (Task 1g, spec v2 §4) — loaded once, not per row. A join failure
    # (a sheet row with no partner) raises inside model_sheet.load() rather than degrading
    # silently; here it degrades to "no sheet data, ship item-level fields honestly" so the
    # converter still produces every item even if the sheet is absent in some environment.
    try:
        sheet = model_sheet.load()
    except FileNotFoundError:
        sheet = {"by_item_he": {}}
    by_item_he = sheet["by_item_he"]
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
            # Task 1b: cure blocks. CUTS carries no `cure` field at all (raw cuts, not cured
            # products) — only SPECIALS' prose is a source here; MAKES' structured calc is
            # handled in its own loop below.
            if table == "specials":
                cu = model_cure.block_for_specials(row, unconverted, item_id, _classify_source)
                if cu:
                    safety.append(cu)
                # Task 1c: drying / fermentation / aging -- SPECIALS-only per the ADDENDUM's own
                # source table (see model_process.py module docstring).
                safety.extend(model_process.blocks_for_specials(row, unconverted, item_id))
            sheet_row = by_item_he.get(row.get("heb"))
            paths, path_notes = model_paths.build(table, row, sheet_row, unconverted, item_id)

            # §5.8 / C-6, the half the report's sink alone did not close. FOUR authored columns —
            # rub, wood, diff, saved — are carried by data.py (130, 177, 178 and 130 rows) and the
            # converter never mentions any of them. 615 authored values are dropped, and until now
            # they vanished WITHOUT A SINGLE REPORT LINE, which is what made the loss invisible
            # rather than merely unfixed.
            #
            # This does NOT convert them — deciding where `rub` or `wood` belongs in the new model
            # is a data-model question the owner has open (R-75/R-76), and inventing a home for
            # them here would be exactly the silent decision this report exists to prevent. It
            # records the drop, so the count is a number somebody can act on instead of a thing
            # somebody has to notice.
            for _dropped in ("rub", "wood", "diff", "saved"):
                if row.get(_dropped) not in (None, "", [], {}):
                    unconverted.append({
                        "id": item_id, "name": row.get("heb"), "field": _dropped,
                        "value": row.get(_dropped),
                        "reason": "authored-column-not-in-model",
                    })
            items.append({
                "id": item_id,
                "name": {"he": row.get("heb"), "en": row.get("eng")},
                "category": row.get("cat"),
                "cut_form": row.get("cut_form"),
                "weight_kg": row.get("kg"),
                "safety": safety,
                # Task 1g (spec v2 §3/§10c): texture is authored PER PATH now (see `paths`); this
                # item-level field stays for adapter back-compat only — it already carries the
                # same value `data.py` authored, which is exactly one path's number (see
                # `model_paths` module docstring for why brisket's item-level 95°C does not always
                # coincide with the DEFAULT combo's path). A `texture_scope` marker was considered
                # here but dropped: nothing reads it yet (Task 5r is the first consumer), and
                # shipping a value with no reader is exactly what no-inert-shipment forbids —
                # 177 identical strings is also 4KB the A1 bundle-size gate cannot spare today.
                "texture": _texture(row, unconverted, item_id),
                "paths": paths,
                # R-80 / Task 3r (spec v2 §4.1): steps live INSIDE `paths[*].steps`, never at
                # item level -- v1's Task 3 item-level `route[]` re-flattened the two sheets this
                # refactor exists to undo, and is gone. `notes` stays item-level on purpose (spec
                # v2 §4.1's own closing line): advice does not belong to one route more than the
                # other, and is not lost either way.
                "notes": path_notes,
                "legacy_ref": {"table": table, "n": n},
            })
    # Task 1b/1f (ADDENDUM, owner instruction "תבנה הכל"): MAKES become items. Outside Task 1's
    # cuts/specials loop, MAKES carries the most structured safety data in the catalogue
    # (`build.calc`) — folding it in here rather than leaving it unconverted. `legacy_ref` is
    # explicitly None (no cuts:/specials: counterpart exists) — PX1 (model-pathid-crosscheck.spec.ts)
    # already skips any item with no `legacy_ref` (`if (!ref) return;`), so MAKES items are simply
    # not path-id-crosschecked; `paths` stays {} via model_paths.build's own unrecognized-table
    # fallback (never modified here — see the module's own `return {}, []` for table not in
    # {cuts,specials}). `weight_kg` is None: MAKES rows carry no `kg` field (build-from-scratch
    # recipes, not a cut with an authored weight). Gated by SHIP_MAKES_ITEMS (Q-2, see top of file)
    # — the converter itself is exercised directly in tests below regardless of the gate; only the
    # SHIPPED payload is affected.
    for mid, row in (makes.items() if SHIP_MAKES_ITEMS else []):
        item_id = "make:%s" % mid
        safety = []
        th = _thermal_block(row, unconverted, item_id)
        if th:
            safety.append(th)
        cu = model_cure.block_for_makes(row, unconverted, item_id, _classify_source)
        if cu:
            safety.append(cu)
        # Task 1c: MAKES gets fermentation from build.materials/phases prose. Task 1c-b
        # (2026-08-03) extends this to drying, also from build.phases -- see model_process.py
        # module docstring for the gate (per-phase keyword co-occurrence, not category) and the
        # two false-positive traps it avoids. MAKES carries no aging signal (verified, same
        # docstring) so aging stays empty for MAKES, not a skipped scope but a checked one.
        safety.extend(model_process.blocks_for_makes(row, unconverted, item_id))
        paths, path_notes = model_paths.build("makes", row, None, unconverted, item_id)

        # The same drop, on the other loop. `diff` is authored on ALL 50 MAKES rows (data.py:540
        # builds every one of them with it) and is read by nothing here. Counting it from data.py
        # by grep says "178 diff columns" and that number is a lie in the useful direction — line
        # 540 is a constructor inside a loop, so one text occurrence is fifty authored values.
        # Only MAKES' own key set is checked: rub/wood/saved are CUTS/SPECIALS columns and asking
        # for them here would manufacture absences rather than report real ones.
        if row.get("diff") not in (None, "", [], {}):
            unconverted.append({
                "id": item_id, "name": row.get("heb"), "field": "diff",
                "value": row.get("diff"), "reason": "authored-column-not-in-model",
            })

        items.append({
            "id": item_id,
            "name": {"he": row.get("heb"), "en": row.get("eng")},
            "category": row.get("cat"),
            "cut_form": None,
            "weight_kg": None,
            "safety": safety,
            "texture": _texture(row, unconverted, item_id),
            "paths": paths,
            "notes": path_notes,
            "legacy_ref": None,
        })
    # The wrap cross-check REPLACES wrap conversion (spec v2 §4.1): `data.py`'s `wrap` column is
    # never written into any item or path -- it is route A's answer only (spec v2 §8.2), and its
    # information content is proven redundant with the trigger prose already parsed above
    # (reconciliation §2.1). One summary line, not one per row: this is a single design decision
    # about a whole retired field, not a per-item gap.
    _wrap_count = sum(1 for row in cuts if (row.get("wrap") or "").strip())
    # `scope: "field"` is the difference between "aggregate ON PURPOSE" and "identity was lost".
    # Both look identical as `id: None`, and telling them apart by reading the comment above works
    # only for someone already reading this file — the report's reader is not. Every other record
    # is per-item and carries no scope; a consumer that wants to know whether 130 items are
    # individually accounted for can now ask instead of infer.
    unconverted.append({"id": None, "name": None, "field": "wrap", "value": _wrap_count,
                        "reason": "wrap-field-retired", "scope": "field"})
    return items, unconverted
