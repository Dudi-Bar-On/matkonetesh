# -*- coding: utf-8 -*-
"""Routes as first-class data, keyed by the SAME ids `itemPaths` (app.js:4760) emits — never a
new vocabulary (spec v2 §4.1, gate G-5).

`itemProfile`/`itemPaths` compute ids two different ways depending on the item's table:
  - CUTS   -> `comboMethodEntry` builds `'c:' + sorted(combo).join('_')`, e.g. `c:smoke_sv`,
              `c:smoke`, plus a `:rev` suffix when a cited reverse-order (`order_smokesv`,
              pasteurize-safe) exists.
  - SPECIALS -> `itemProfile`'s 'spec' branch always returns exactly ONE method with the
              LITERAL key `'smoke'` (no `c:` prefix, no combo suffix — SPECIALS never offer sv
              or grill). A converter that stamped `c:smoke` here would invent a vocabulary
              `itemPaths` never emits for that table.

Measured exception inside CUTS itself (methodRules, app.js:1157): every category permits the
sv+smoke combo (`c:smoke_sv`) and, with one exception, the smoke-only combo (`c:smoke`) too.
The exception is `קורקבני עוף` (Chicken Gizzards, n=77, cat=איברים פנימיים): `methodRules`
requires `'sv'` in EVERY combo for the eng-name-matched "Gizzard" case, so solo `smoke` is not
a combo `itemPaths` ever offers it — creating a `c:smoke` path for it would be exactly the
invented-vocabulary failure this task exists to prevent. Guarded explicitly below; it is the
only such case in the 130-row CUTS table (methodRules verified against every other branch).

The flat row holds route A's sv+smoke legs (svt/svh/smt/smh), route B's smoke leg
(sot/soh), and per-route fields the flattening collapsed (reconciliation §2). Nothing here
fills one path's field from the other path, and nothing invents an id.
"""
import model_triggers

IMPORT_OWNER_SHEET = False   # Q-1 — flips to True only on the owner's spoken approval


def _hours_upper(h):
    s = str(h or '').strip()
    return s  # moved verbatim; range parsing stays in the JS consumer it already lives in


def _requires_sv_in_every_combo(row):
    """`קורקבני עוף` (Chicken Gizzards) is the one CUTS row where methodRules forbids a
    smoke-only combo — see module docstring. Nothing else in the 130-row table matches."""
    return row.get("cat") == "איברים פנימיים" and "Gizzard" in (row.get("eng") or "")


def _cut_paths(row, sheet_row, unconverted, item_id):
    paths = {}
    notes = []
    if row.get("svt") is not None and row.get("smt") is not None:
        paths["c:smoke_sv"] = {
            "legs": {"sv": {"t": row["svt"], "h": _hours_upper(row.get("svh"))},
                     "smoke": {"t": row["smt"], "h": _hours_upper(row.get("smh"))}},
            "texture": None, "sear": None, "coal": None, "steps": [],
        }
    if row.get("sot") is not None and not _requires_sv_in_every_combo(row):
        paths["c:smoke"] = {
            "legs": {"smoke": {"t": row["sot"], "h": _hours_upper(row.get("soh"))}},
            "texture": {"target_c": row.get("tgt"), "source_id": None, "provenance": "craft"},
            "sear": None, "coal": None, "steps": [],
        }
    # data.py's single tgt: reconciliation §2.2 measured which route it matches.
    # kept=A -> it belongs to c:smoke_sv; kept=B -> c:smoke; ambiguous -> report, both stay None.
    if sheet_row:
        a_t, b_t = sheet_row.get("tgtA"), sheet_row.get("tgtB")
        d_t = row.get("tgt")
        if d_t is not None and a_t is not None and b_t is not None and a_t != b_t:
            if d_t == a_t and "c:smoke_sv" in paths:
                paths["c:smoke_sv"]["texture"] = {"target_c": d_t, "source_id": None, "provenance": "craft"}
                if "c:smoke" in paths:
                    if IMPORT_OWNER_SHEET:
                        paths["c:smoke"]["texture"] = {"target_c": b_t, "source_id": None, "provenance": "owner-sheet"}
                    else:
                        unconverted.append({"id": item_id, "name": row.get("heb"),
                                            "field": "tgt:c:smoke", "value": b_t,
                                            "reason": "path-target-unimported"})
            elif d_t == b_t and "c:smoke" in paths:
                if "c:smoke_sv" in paths:
                    if IMPORT_OWNER_SHEET:
                        paths["c:smoke_sv"]["texture"] = {"target_c": a_t, "source_id": None, "provenance": "owner-sheet"}
                    else:
                        unconverted.append({"id": item_id, "name": row.get("heb"),
                                            "field": "tgt:c:smoke_sv", "value": a_t,
                                            "reason": "path-target-unimported"})
            else:
                unconverted.append({"id": item_id, "name": row.get("heb"),
                                    "field": "tgt", "value": d_t,
                                    "reason": "target-matches-neither-route"})
        # sear/coal move onto the path from each sheet route; identical -> item keeps one copy is FINE,
        # but the model still writes them per path so no consumer re-derives (G-4).
        for key, col in (("c:smoke_sv", "A"), ("c:smoke", "B")):
            if key in paths:
                paths[key]["sear"] = sheet_row.get("sear" + col)
                paths[key]["coal"] = sheet_row.get("coal" + col)
    # R-80 / Wave 0 N-7 / Task 3r (spec v2 §4.1): `mid` prose -> c:smoke_sv steps, `somid` prose
    # -> c:smoke steps. Item-level route[] does not exist any more (v1's Task 3 shape) -- the
    # whole point of 3r is that the actions differ per route and must live on their own path.
    if "c:smoke_sv" in paths:
        step, note, reason = model_triggers.parse_field("mid", row.get("mid"))
        if step:
            paths["c:smoke_sv"]["steps"].append(step)
        if note:
            notes.append(note)
        if reason:
            unconverted.append({"id": item_id, "name": row.get("heb"), "field": "mid",
                                "value": row.get("mid"), "reason": reason})
    if "c:smoke" in paths:
        somid_raw = row.get("somid")
        step, note, reason = model_triggers.parse_field("somid", somid_raw)
        if step:
            paths["c:smoke"]["steps"].append(step)
        if note:
            notes.append(note)
        if reason:
            unconverted.append({"id": item_id, "name": row.get("heb"), "field": "somid",
                                "value": somid_raw, "reason": reason})
        # The wrap cross-check REPLACES wrap conversion (spec v2 §4.1): the binary `wrap` column
        # is never written into the model (proven redundant, 26/26 resolvable pairs measured
        # here -- reconciliation §2.1 claimed 27/27 against the sheet alone; one CUTS row,
        # "ספייריבס חזיר", has no sheet join today and is therefore not checkable, a pre-existing
        # Task 1g join gap, not a Task 3r regression). Sheet-B `wrap=="כן"` must already show a
        # wrap/3-2-1 signal in `somid`'s own prose -- mismatch is a report row, never a silent
        # correction in either direction.
        if sheet_row and (sheet_row.get("wrapB") or "").strip() == "כן":
            if not model_triggers.wrap_signal(somid_raw):
                unconverted.append({"id": item_id, "name": row.get("heb"), "field": "somid",
                                    "value": somid_raw, "reason": "wrap-flag-contradicts-somid"})
    # order_smokesv (sources.py) -> the :rev path — the smoke/sv legs are moved verbatim (DoD-10);
    # `ref`/`url`/`note` are dropped from THIS copy on purpose, not lost: they are the same
    # citation text already shipped once, verbatim, in `payload.cuts[n].order_smokesv` (build.py
    # merges CUT_SOURCES into every cuts row before model.build_items runs) — re-embedding the
    # same prose a second time here would be duplication, not a second source of truth.
    os_ = row.get("order_smokesv")
    if os_ and os_.get("sv", {}).get("pasteurize") is True and "c:smoke_sv" in paths:
        paths["c:smoke_sv:rev"] = {
            "legs": {"smoke": os_.get("smoke"), "sv": os_.get("sv")},
            "texture": None, "sear": None, "coal": None, "steps": [],
        }
    # `rest` is measured route-invariant (68/68 identical across both sheet routes) -- one rest
    # step, appended to EVERY path this item ended up with (including :rev). A fresh dict per
    # path (model_triggers.rest_step() call, not a shared reference) so no two paths alias the
    # same mutable object.
    rest_raw = row.get("rest")
    for pid in paths:
        rs = model_triggers.rest_step(rest_raw)
        if rs:
            paths[pid]["steps"].append(rs)
    return paths, notes


def _special_paths(row, unconverted):
    # `itemProfile`'s 'spec' branch (app.js:4390) is unconditional: every SPECIALS row gets
    # exactly one method, literal key `'smoke'` — never `'c:smoke'`. SPECIALS carry no `svt`/
    # `sot` at all (data.py's own `# keys:` comment for SPECIALS omits them), so there is no
    # second route to lose here — the flattening loss measured in the reconciliation (§2) is a
    # CUTS-only phenomenon.
    if row.get("smt") is None:
        return {}, []
    tgt = row.get("tgt")
    texture = ({"target_c": tgt, "source_id": None, "provenance": "craft"}
               if isinstance(tgt, (int, float)) else None)
    # a non-numeric tgt (prose) is already reported once, at item level, by model.py's
    # `_texture()` (`tgt-nonnumeric`) — reporting it again here would be the same gap named
    # twice under two different reasons, which reads as two problems instead of one.
    # SPECIALS carries no `mid`/`somid`/`rest` keys at all (data.py's own `# keys:` comment for
    # SPECIALS omits them — measured: `row.get('mid')` is always None here) — so there is no
    # route-level prose to parse into steps for this table; `steps` stays [].
    return {
        "smoke": {
            "legs": {"smoke": {"t": row["smt"], "h": _hours_upper(row.get("smh"))}},
            "texture": texture, "sear": None, "coal": None, "steps": [],
        }
    }, []


def build(table, row, sheet_row, unconverted, item_id):
    """Returns (paths:dict, notes:list) for one row. `table` is 'cuts' or 'specials' — the id
    vocabulary itemPaths emits differs by table (see module docstring); nothing here is shared
    logic dressed up as one function, because the underlying app functions are not shared either."""
    if table == "cuts":
        return _cut_paths(row, sheet_row, unconverted, item_id)
    if table == "specials":
        return _special_paths(row, unconverted)
    return {}, []
