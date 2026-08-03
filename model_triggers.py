# -*- coding: utf-8 -*-
"""Legacy prose (`mid` / `somid` / `rest`) -> route steps with triggers, ATTACHED TO A PATH
(spec v2 §4.1; Task 3r REPLACES v1 Task 3's item-level `route[]`, which re-flattened the two
sheets back into one — see plan REVISION 2, Task 3r).

The owner's requirement (R-80 / Wave 0 N-7, 2026-08-03): "עטיפה ב-70°C is an action fired by a
temperature, not a note." Anything genuinely advice ("30-60 שנ'/צד — יותר=גומי") stays advice,
in `notes` (item-level — spec v2 §4.1's closing line: "מה שאינו פעולה נשאר notes על הפריט").
Nothing is discarded either way.

Same closed action vocabulary and trigger shapes as v1's model_triggers (plan REVISION 2, Task 3r:
"v1's Task 3 parser and closed trigger set survive verbatim") — only the attachment point moved
from item-level `route[]` to `paths[<id>].steps`, and one field's caller changed name (`route` ->
`somid`, per model_paths._cut_paths).
"""
import re

_TEMP = re.compile(r'(\d{2,3})\s*°?\s*[CcצC]')
_EVERY = {'הפיכה': 'flip', 'הפיכת עור': 'flip', 'סיבוב שיפוד': 'rotate'}
_ACTION = [('עטיפה', 'wrap'), ('עטיפת', 'wrap'), ('גלייז', 'glaze'), ('מריחה', 'baste'),
           ('צינון', 'chill'), ('ייבוש', 'dry'), ('ניקוז', 'drain'), ('דקירת', 'prick'),
           ('חריטת', 'score'), ('קילוף', 'peel')]

# Text-level signal used ONLY by the wrap cross-check below (spec v2 §4.1) — NOT a step action.
# "שיטת 3-2-1"/"שיטת 2-2-1" name a foil-wrap stage inside a smoking method, but contain none of
# the `_ACTION` needles above, so they parse as plain advice (a note), same as any other prose
# with no recognized action word. The cross-check reads the raw prose directly, matching exactly
# what the reconciliation measured (§2.1): "ה-somid/mid-B מכיל פעולת עטיפה או שיטת 3-2-1".
_WRAP_OR_321 = re.compile(r'עטיפ|3-2-1|2-2-1')


def _action_of(text):
    for needle, act in _ACTION:
        if needle in text:
            return act
    return None


def parse_field(field, raw):
    """One legacy prose field (`row['mid']` or `row['somid']`) -> a single
    `(step|None, note|None, unparsed_reason|None)`.

    `field` names the legacy source ('mid'/'somid') so `step['source']` and the report row both
    trace back to the exact field the text came from (DoD-10: nothing here is invented).
    """
    raw = (raw or '').strip()
    if not raw or raw in ('אין', '-'):
        return None, None, None
    if raw in _EVERY:
        return ({'action': _EVERY[raw], 'trigger': {'every': {'min': 45}},
                 'source': 'legacy:' + field}, None, None)
    m = _TEMP.search(raw)
    act = _action_of(raw)
    if m and act:
        return ({'action': act, 'trigger': {'at_core_temp': {'c': int(m.group(1))}},
                 'source': 'legacy:' + field}, None, None)
    if 'בסיום' in raw and act:
        return ({'action': act, 'trigger': {'at_stage': {'at': 'end'}},
                 'source': 'legacy:' + field}, None, None)
    if 'עד סוף' in raw and 'בטיחות' in raw:
        return ({'action': 'hold', 'trigger': {'when_safe_met': {}},
                 'source': 'legacy:' + field}, None, None)
    if act and not m:
        # a real action with no stated trigger -- NOT invented, reported (and kept as a note too,
        # same as v1: losing the text is not allowed even when it cannot become a step).
        return None, {'text': raw, 'lang': 'he'}, 'action-without-trigger'
    return None, {'text': raw, 'lang': 'he'}, None       # advice, kept


def rest_step(rest):
    """`rest` is route-invariant (measured 68/68 identical across both sheet routes) -- one step
    shape, appended to EVERY path an item carries. Returns a FRESH dict each call so callers
    appending to multiple paths never share one mutable object."""
    if isinstance(rest, (int, float)) and rest > 0:
        return {'action': 'rest', 'trigger': {'at_stage': {'at': 'end'}},
                'params': {'min': int(rest)}, 'source': 'legacy:rest'}
    return None


def wrap_signal(raw_somid):
    """Does route B's mid-course prose already carry a wrap action or the 3-2-1/2-2-1 method?
    Used only by the wrap-flag cross-check (spec v2 §4.1) -- the binary `wrap` column is never
    converted, only checked against this."""
    return bool(_WRAP_OR_321.search(raw_somid or ''))
