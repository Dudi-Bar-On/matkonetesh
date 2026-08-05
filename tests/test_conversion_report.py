"""The conversion report has a sink, and the sink tells the truth — Phase D §5.8.

WHY THIS TEST EXISTS. `build_items()` has always returned an `unconverted` list: a structured record
per authored value the model does not carry, each with its item, its field and its reason. Nothing
ever wrote it to disk. Worse, `build.py` reduced it to a SET of reason strings, which destroyed the
one thing that made it actionable — WHICH item failed for WHICH reason. The finding (C-6) put it
exactly: the report was 384 lines long and no file was written.

A report nobody can read is indistinguishable from a conversion that lost nothing, and that is how
615 authored values in four columns stayed invisible: `rub`, `wood`, `diff` and `saved` are carried
by data.py and read by no part of the converter. They were not merely unconverted — they were
unconverted WITHOUT A RECORD, which is the failure this file guards.

WHAT IS ASSERTED, and it is deliberately about the record rather than the fix: that every authored
value the converter drops leaves a row naming the item, the field and the reason. Whether `wood`
SHOULD have a home in the model is a data-model question the owner has open (R-75/R-76); this test
does not prejudge it. It asserts only that the loss is countable.
"""
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The four columns data.py authors and the converter does not read, with the number of rows that
# carry a non-empty value for each. These are MEASURED, not chosen: cuts+specials for the first
# three, and `diff` additionally on every MAKES row (data.py:540 builds all of them with it).
DROPPED_COLUMNS = ("rub", "wood", "diff", "saved")


@pytest.fixture(scope="module")
def converted():
    """Run the real converter over the real data — the same call build.py makes."""
    import data
    import model

    importlib.reload(data)
    makes = dict(data.MAKES)
    try:
        from sausages_new import NEW_SAUSAGES  # build.py:30 does this before converting
        makes.update(NEW_SAUSAGES)
    except ImportError:                        # a build without the extra sausages is still valid
        pass
    items, unconverted = model.build_items(data.CUTS, data.SPECIALS, makes)
    return {"items": items, "unconverted": unconverted, "makes": makes, "data": data}


def test_every_unconverted_record_keeps_its_item_field_and_reason(converted):
    """The pairing survives. This is the exact thing build.py's set() destroyed."""
    assert converted["unconverted"], "the converter reported nothing unconverted, which cannot be true"
    for rec in converted["unconverted"]:
        assert isinstance(rec, dict), f"a record degraded to {type(rec).__name__}: {rec!r}"
        for key in ("field", "reason"):
            assert rec.get(key) not in (None, ""), f"record missing {key}: {rec!r}"
        # A record may be about a whole retired FIELD rather than an item — `wrap` is one, and its
        # aggregation is a documented design decision (spec v2 §4.1), not a lost pairing. It must
        # SAY so: an idless record with no `scope` is exactly the silent collapse this file exists
        # to catch, and letting `id: None` pass unchallenged would reopen it.
        if rec.get("scope") == "field":
            assert rec.get("value") is not None, f"a field-scoped record must carry its count: {rec!r}"
        else:
            assert rec.get("id") not in (None, ""), f"record missing id: {rec!r}"


def test_the_dropped_columns_are_reported_rather_than_silently_lost(converted):
    """Each authored column the model does not carry produces one record per row that has a value.

    Counted from data.py itself rather than pinned to a constant, so authoring a new cut with a
    `wood` value cannot quietly widen the gap: the expected number moves with the data.
    """
    d = converted["data"]
    recorded = {}
    for rec in converted["unconverted"]:
        if rec.get("reason") == "authored-column-not-in-model":
            recorded.setdefault(rec["field"], set()).add(rec["id"])

    for column in DROPPED_COLUMNS:
        expected = sum(
            1
            for row in list(d.CUTS) + list(d.SPECIALS)
            if isinstance(row, dict) and row.get(column) not in (None, "", [], {})
        )
        if column == "diff":                   # MAKES authors `diff` too, on its own loop
            expected += sum(
                1
                for row in converted["makes"].values()
                if isinstance(row, dict) and row.get(column) not in (None, "", [], {})
            )
        assert expected > 0, f"{column} is no longer authored anywhere — this test needs revisiting"
        assert len(recorded.get(column, ())) == expected, (
            f"{column}: {len(recorded.get(column, ()))} rows recorded as dropped, "
            f"but {expected} rows authored a value. The difference is a silent loss."
        )


def test_the_report_file_is_written_and_carries_the_pairing():
    """The sink itself. Reads the artifact build.py produces, not the in-memory list."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(root, "docs", "analysis", "model-conversion-report.md")
    assert os.path.exists(path), (
        "no conversion report on disk — run `python build.py`. Its absence is the original defect: "
        "the data existed in memory and never reached anywhere a person could read it."
    )
    text = open(path, encoding="utf-8").read()
    rows = [ln for ln in text.splitlines() if ln.startswith("| `")]
    assert len(rows) > 100, f"the report has only {len(rows)} item rows; it should carry every record"
    for column in DROPPED_COLUMNS:
        assert f"| {column} |" in text, f"the report never mentions the dropped column {column}"
