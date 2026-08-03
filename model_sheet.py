# -*- coding: utf-8 -*-
"""Loads the owner's spreadsheet export (docs/sources/owner-sheet/02-*.csv and 03-*.csv) and
joins it to the app's items — Hebrew name FIRST, never English-first (the Duck/Goose trap:
an English-first join merges sheet #9 חזה אווז into cut-48 חזה ברווז — reconciliation §1).

02-sousvide-smoke.csv = route A (sv+smoke). 03-smoke-only.csv = route B (smoke-only). Both are
68-row exports of the SAME 68 items, one row per item per file. Columns are read by POSITION,
not by DictReader header name, because both files repeat a header string ("זמן עישון") for two
different columns (a prose duration and the numeric one) — a name-keyed reader would silently
keep only the last and lose data.
"""
import csv
import os

SHEET_DIR = os.path.join("docs", "sources", "owner-sheet")
ROUTE_A_CSV = os.path.join(SHEET_DIR, "02-sousvide-smoke.csv")
ROUTE_B_CSV = os.path.join(SHEET_DIR, "03-smoke-only.csv")

# The one alias the reconciliation measured (§1): the sheet's generic "נקניקיות" is the app's
# "נקניקיות מוכנות". Explicit and singular on purpose — a silent fuzzy match is how the
# Duck/Goose trap happened in the first place.
_ALIASES = {"נקניקיות": "נקניקיות מוכנות"}

# 02-sousvide-smoke.csv columns (0-indexed), route A:
_A_HE, _A_EN, _A_SEAR, _A_COAL, _A_TGT = 2, 3, 9, 16, 22
_A_WRAP = 11
# 03-smoke-only.csv columns (0-indexed), route B:
_B_HE, _B_EN, _B_SEAR, _B_COAL, _B_TGT = 2, 3, 9, 16, 20
_B_WRAP = 11


def _num(raw):
    if raw is None or raw == "":
        return None
    try:
        v = float(raw)
        return int(v) if v == int(v) else v
    except (TypeError, ValueError):
        return None


def _read_rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    return rows[1:]  # drop header


def load():
    """Returns {by_item_he: {he, en, tgtA, tgtB, searA, searB, coalA, coalB, wrapA, wrapB}}.

    An unmatched sheet row (a name in one file with no partner in the other) is loud, not
    silent — there are none today (reconciliation §1: 68/68 both ways), so a future rename
    that breaks the join must raise rather than quietly ship an asymmetric entry.
    """
    a_rows = _read_rows(ROUTE_A_CSV)
    b_rows = _read_rows(ROUTE_B_CSV)

    a_by_he = {}
    for r in a_rows:
        he = _ALIASES.get(r[_A_HE], r[_A_HE])
        a_by_he[he] = r

    b_by_he = {}
    for r in b_rows:
        he = _ALIASES.get(r[_B_HE], r[_B_HE])
        b_by_he[he] = r

    only_a = set(a_by_he) - set(b_by_he)
    only_b = set(b_by_he) - set(a_by_he)
    if only_a or only_b:
        raise ValueError(
            "model_sheet: route A/B join mismatch — only in A: %r · only in B: %r"
            % (sorted(only_a), sorted(only_b))
        )

    by_item_he = {}
    for he, ra in a_by_he.items():
        rb = b_by_he[he]
        by_item_he[he] = {
            "he": he,
            "en": ra[_A_EN],
            "tgtA": _num(ra[_A_TGT]),
            "tgtB": _num(rb[_B_TGT]),
            "searA": ra[_A_SEAR],
            "searB": rb[_B_SEAR],
            "coalA": ra[_A_COAL],
            "coalB": rb[_B_COAL],
            "wrapA": ra[_A_WRAP],
            "wrapB": rb[_B_WRAP],
        }
    return {"by_item_he": by_item_he}
