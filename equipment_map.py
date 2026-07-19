# -*- coding: utf-8 -*-
"""
Equipment requirements, structured per recipe.

WHY THIS EXISTS
    Until now the app knew what equipment the USER owns, but no recipe declared what it NEEDS.
    With nothing to join on, the work plan could only ever print a device NAME, never adapt.
    This module gives every recipe a structured `equip` block, so:
        recipe.equip  ->  work-plan task embedding  ->  orchestrator optimization

DESIGN
    Requirements are DERIVED from what each recipe already encodes (casing / grind / cure / smt /
    svt / age / sear / wrap ...) rather than hand-typed 227 times, so they cannot drift out of sync
    when a recipe changes. Anything not mechanically derivable is stated in OVERRIDES below.

SCHEMA (per recipe)
    equip = {
      "need": [token, ...]              # hard requirement — without it the recipe cannot be made
      "opt":  [token, ...]              # improves the result, not required
      "alt":  {token: [token, ...]}     # acceptable substitutes for a needed token
      "spec": {...}                     # PROPERTY-level requirements, matched against device cap.*
      "by":   {method: {...}}           # cuts: requirements that depend on the chosen method
      "phase":{phase_index: [token,...]}# makes: which phase needs which equipment (task embedding)
    }

SPEC KEYS (these are what let the orchestrator reason numerically)
    nozzle_mm   int    stuffer nozzle diameter needed for this casing   -> device cap.nozzles
    grind_mm    float  grinder plate size                               -> (grinder has no cap yet)
    scale_res   str    weighing precision needed ('0.1g' | '1g')        -> device cap.res
    min_bath_l  float  smallest sous-vide bath that fits this item      -> device cap.baths
    racks       float  rack/zone slots this item occupies               -> device cap.racks/zones
    slice_mm    float  slicing thickness                                -> slicer
    rh_pct      tuple  target relative humidity for drying              -> humidity / curechamber
    hold_c      int    holding temperature                              -> holding gear
"""

import re

# ─────────────────────────────────────────────────────────────────────────────
# 1. THE VOCABULARY — canonical equipment tokens.
#    Tokens MUST match app.js: EQUIP_CATS[].cat and EQUIP_OTHER_ITEMS[].key,
#    so a recipe requirement joins directly onto a device the user owns.
# ─────────────────────────────────────────────────────────────────────────────
COOKERS = {
    "smoker":   "מעשנה",
    "grill":    "גריל",
    "oven":     "תנור",
    "sousvide": "סו-ויד",
}
PROCESSING = {
    "vacuum":   "ואקום",
    "grinder":  "מטחנת בשר",
    "stuffer":  "מכונת מילוי",
    "probe":    "מדחום",
}
ACCESSORIES = {
    "scale":       "משקל דיגיטלי",
    "injector":    "מזרק בשר",
    "slicer":      "מכונת פריסה",
    "curechamber": "תא ריפוי / ייבוש",
    "hooks":       "ווים / שבכות לתלייה",
    "humidity":    "בקר לחות",
    "torch":       "מבער / לפיד",
    "chimney":     "ארובת הצתה",
    "gloves":      "כפפות חום",
    "tongs":       "מלקחיים",
    "brush":       "מברשת גריל",
    "drippan":     "מגש איסוף / מים",
    "spritz":      "בקבוק ריסוס",
    "paper":       "נייר קצבים",
    "foil":        "רדיד אלומיניום",
    "blower":      "מפוח / מאוורר",
    "knife":       "סכין פריסה",
    "board":       "קרש חיתוך",
    # NEW — required by the Phase-3 cook-early-and-hold strategy, which today has no gear to stand on.
    "cooler":      "צידנית / קמברו (החזקה חמה)",
}
VOCAB = {}
VOCAB.update(COOKERS); VOCAB.update(PROCESSING); VOCAB.update(ACCESSORIES)

# ─────────────────────────────────────────────────────────────────────────────
# 2. DERIVATION HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _mm(text):
    """First millimetre figure in a Hebrew spec string ('דק 4.5 מ״מ' -> 4.5)."""
    if not text:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*מ[\"״']?מ", str(text))
    return float(m.group(1)) if m else None


CASING_MIN_MM, CASING_MAX_MM = 16, 120   # lamb ~20mm .. beef middles/bung ~120mm


def _casing_mm(casing):
    """
    Casing diameter -> the stuffer nozzle needed. 'ללא מעי' (caseless) needs no stuffer.
    Only accepts a plausible CASING diameter: a bare _mm() over recipe prose also matches grind
    plates ('דק 4.5 מ״מ') and slice thicknesses, which are not casings.
    """
    if not casing:
        return None
    if "ללא מעי" in casing or "ללא שרוול" in casing or "ללא קרום" in casing:
        return 0            # caseless (e.g. cevapi, skinless) -> no stuffer required
    mm = _mm(casing)
    if mm is None:
        return None
    return mm if CASING_MIN_MM <= mm <= CASING_MAX_MM else None


def _size_slots(kg):
    """Rack/zone slots an item occupies. Mirrors the Phase-3a spec's size classes."""
    if kg is None:
        return 1.0
    if kg <= 1.5:
        return 0.5
    if kg <= 4.0:
        return 1.0
    return 2.0


def _bath_l(kg):
    """Smallest practical sous-vide bath for an item: water must cover it, plus displacement."""
    if kg is None:
        return None
    return 12.0 if kg <= 3.0 else 24.0


def _cure_scale(*texts):
    """Any nitrite/nitrate cure -> 0.1 g resolution. A 1 g scale on a ~2.5 g dose is a ±40% error."""
    blob = " ".join(str(t or "") for t in texts)
    return "0.1g" if re.search(r"Cure\s*#?\s*[12]|קיורינג|נתרן ניטריט|ניטריט", blob) else None


def _wrap_gear(*texts):
    blob = " ".join(str(t or "") for t in texts)
    out = []
    if "נייר קצבים" in blob:
        out.append("paper")
    if "אלומיניום" in blob or "רדיד" in blob:
        out.append("foil")
    if not out and "עטיפ" in blob:          # generic "wrap" -> either works
        out += ["paper", "foil"]
    return out


def _norm(e):
    """Dedupe + drop empties, keep deterministic order."""
    for k in ("need", "opt"):
        seen, out = set(), []
        for t in e.get(k, []):
            if t and t in VOCAB and t not in seen:
                seen.add(t); out.append(t)
        e[k] = out
    e["need"] = [t for t in e["need"]]
    e["opt"] = [t for t in e["opt"] if t not in set(e["need"])]
    for k in ("alt", "spec", "by", "phase"):
        if k in e and not e[k]:
            del e[k]
    return e


# ─────────────────────────────────────────────────────────────────────────────
# 3. CUTS — equipment depends on the METHOD chosen, so requirements are per-method.
# ─────────────────────────────────────────────────────────────────────────────

def cut_equip(c):
    kg = c.get("kg")
    slots = _size_slots(kg)
    by = {}

    # sous-vide path
    if c.get("svt") is not None:
        by["sv"] = {
            "need": ["sousvide", "vacuum"],
            "opt":  ["probe"],
            "spec": {"min_bath_l": _bath_l(kg)},
        }

    # smoking path
    if c.get("smt") is not None or c.get("sot") is not None:
        smoke = {
            "need": ["smoker", "probe"],
            "opt":  ["drippan", "spritz", "gloves"] + _wrap_gear(c.get("wrap"), c.get("somid")),
            "alt":  {"smoker": ["grill"]},          # a charcoal/kettle/gas grill can smoke
            "spec": {"racks": slots},
        }
        # long cooks are where holding gear actually earns its place
        try:
            hrs = float(str(c.get("smh") or c.get("soh") or 0).split("-")[0])
        except ValueError:
            hrs = 0.0
        if hrs >= 4:
            smoke["opt"].append("cooler")
        by["smoke"] = smoke

    # grilling / searing path
    sear = str(c.get("sear") or "")
    if sear and sear != "לא":
        by["grill"] = {
            "need": ["grill"],
            "opt":  ["torch", "tongs", "gloves"],
            "alt":  {"grill": ["smoker"]},
            "spec": {"racks": slots},
        }

    need = ["probe"]                    # every cut ends on a bcheck internal-temp gate
    opt = ["knife", "board"]
    if str(c.get("coal") or "") not in ("", "ללא"):
        opt.append("chimney")           # charcoal -> a chimney changes the lighting task
    if (c.get("rest") or 0) >= 30:
        opt.append("cooler")

    return _norm({"need": need, "opt": opt, "by": by,
                  "spec": {"racks": slots, "kg": kg}})


# ─────────────────────────────────────────────────────────────────────────────
# 4. SPECIALS — jerky / biltong / dried / cold-smoked cheese.
# ─────────────────────────────────────────────────────────────────────────────

def special_equip(s):
    # A probe is required only where something is cooked to an INTERNAL temperature. Read `tgt`
    # (the target) alone — `note`/`age` often cite an AMBIENT drying temp ("~21–27°C" for biltong),
    # which must not be mistaken for an internal-temp gate.
    need = ["probe"] if (s.get("smt") is not None or re.search(r"\d+\s*°C", str(s.get("tgt") or ""))) else []
    opt, spec = [], {}
    cure_res = _cure_scale(s.get("cure"), s.get("note"))
    if cure_res:
        need.append("scale"); spec["scale_res"] = cure_res

    if s.get("smt") is not None:
        need.append("smoker")
        opt += ["drippan", "gloves"]

    age = str(s.get("age") or "")
    if age and age != "—":
        need += ["curechamber"]
        opt += ["humidity", "hooks"]
        spec["rh_pct"] = (70, 80)

    blob = " ".join(str(s.get(k) or "") for k in ("note", "tgt", "heb", "eng"))
    if "לפרוס" in blob or "פרוס" in blob:
        opt.append("slicer")
        mm = _mm(blob)
        if mm:
            spec["slice_mm"] = mm
    if "ייבוש" in blob and "מאוורר" in blob:
        opt.append("blower")

    return _norm({"need": need, "opt": opt, "spec": spec})


# ─────────────────────────────────────────────────────────────────────────────
# 5. MAKES — sausage / charcuterie. Equipment is attached PER PHASE, which is what
#    lets a work-plan task say "phase 4: stuff — use the 32 mm nozzle".
# ─────────────────────────────────────────────────────────────────────────────

_PHASE_GEAR = [
    (r"טחינה|טחן",              ["grinder"]),
    (r"מילוי|מלא ל",            ["stuffer"]),
    (r"עישון",                  ["smoker"]),
    (r"ייבוש|הבשלה|תסס|תסיסה",  ["curechamber", "hooks"]),
    (r"תיבול|שקול|מלח",         ["scale"]),
    (r"בישול|צלייה|הגשה",       ["probe"]),
    (r"ואקום",                  ["vacuum"]),
    (r"פריסה|פרוס",             ["slicer"]),
]


def make_equip(mid, m):
    b = m.get("build") or {}
    phases = b.get("phases") or []
    mats = " ".join(str(x) for x in (b.get("materials") or []))
    intro = str(b.get("intro") or "")
    calc = b.get("calc") or {}

    # Probe only where the recipe itself calls for one (its materials name a thermometer) or a
    # temperature target appears. Dry-cured salami is gated by weight loss, not internal temp.
    _cookblob = " ".join(str(p[1]) for p in phases)
    need = (["probe"] if (re.search(r"מדחום", mats) or re.search(r"\d+\s*°C", _cookblob)) else [])
    opt, spec, phase_map = [], {}, {}

    # --- casing -> stuffer + the nozzle diameter it demands -------------------
    # Every sausage builder passes `casing` as its own argument, landing at materials[1]
    # (SG / b_fresh / b_emul all build mats as [grinder+stuffer, casing, salt, ...]).
    # Read THAT slot rather than regexing the whole blob, which also matches grind plates.
    mat_list = b.get("materials") or []
    nozzle = _casing_mm(mat_list[1]) if len(mat_list) > 1 else None
    if nozzle is None:
        for cand in mat_list:                      # fall back: any material that names a casing
            if re.search(r"שרוול|מעי|קולגן|casing", str(cand)):
                nozzle = _casing_mm(str(cand))
                if nozzle is not None:
                    break
    if nozzle:                     # 0 == caseless -> deliberately no stuffer
        need.append("stuffer"); spec["nozzle_mm"] = int(nozzle)
    elif nozzle is None and re.search(r"שרוול|מעי", mats):
        need.append("stuffer")     # casing named but no diameter given

    # --- grinding -------------------------------------------------------------
    blob = " ".join([intro] + [str(p[1]) for p in phases])
    if "טחן" in blob or "טחינה" in blob or "מטחנה" in mats:
        need.append("grinder")
        g = _mm(blob)
        if g:
            spec["grind_mm"] = g

    # --- curing precision -----------------------------------------------------
    res = _cure_scale(mats, intro, blob, calc.get("cure") and "Cure #" + str(calc.get("cure")))
    if res or calc.get("cure"):
        need.append("scale"); spec["scale_res"] = res or "0.1g"

    # --- smoking / drying -----------------------------------------------------
    if "עישון" in blob:
        need.append("smoker"); opt += ["drippan", "gloves"]
    if "ייבוש" in blob or "הבשלה" in blob:
        need.append("curechamber"); opt += ["humidity", "hooks"]
        spec.setdefault("rh_pct", (75, 85))
    if "פריסה" in blob or "פרוס" in blob:
        opt.append("slicer")

    # --- per-phase attachment (this is what a task will render) --------------
    # Match the phase LABEL ("4 · מילוי"), which names the operation exactly. Matching the body
    # text over-triggers badly: a seasoning step that merely mentions drying would pull in a
    # cure chamber, and a stuffing step that mentions the grind would pull in the grinder.
    for i, p in enumerate(phases):
        label = str(p[0])
        gear = []
        for pat, toks in _PHASE_GEAR:
            if re.search(pat, label):
                gear += toks
        gear = [g for g in dict.fromkeys(gear) if g in VOCAB]
        if gear:
            phase_map[i] = gear

    return _norm({"need": need, "opt": opt, "spec": spec, "phase": phase_map})


# ─────────────────────────────────────────────────────────────────────────────
# 6. OVERRIDES — the non-derivable cases, stated explicitly.
#    Keyed by cut `n`, special `n`, or make id.
# ─────────────────────────────────────────────────────────────────────────────
CUT_OVERRIDES = {}
SPECIAL_OVERRIDES = {}
MAKE_OVERRIDES = {
    # emulsified sausages need a processor-grade double grind, not just a plate change
    "_emul_hint": {"opt": ["scale"]},
}


def apply(cuts, specials, makes):
    """Attach `equip` to every recipe. Returns coverage stats."""
    for c in cuts:
        c["equip"] = cut_equip(c)
        ov = CUT_OVERRIDES.get(c.get("n"))
        if ov:
            c["equip"]["need"] = sorted(set(c["equip"]["need"]) | set(ov.get("need", [])))
    for s in specials:
        s["equip"] = special_equip(s)
    for mid, m in makes.items():
        m["equip"] = make_equip(mid, m)
    return stats(cuts, specials, makes)


def stats(cuts, specials, makes):
    from collections import Counter
    tok = Counter()
    spec_keys = Counter()
    no_need = []
    for coll, kind in ((cuts, "cut"), (specials, "special"), (list(makes.values()), "make")):
        for r in coll:
            e = r.get("equip") or {}
            for t in e.get("need", []):
                tok[t] += 1
            for t in e.get("opt", []):
                tok[t] += 0     # ensure key exists
            for k in (e.get("spec") or {}):
                spec_keys[k] += 1
            if not e.get("need") and not e.get("by"):
                no_need.append((kind, r.get("heb")))
    return {"tokens": tok, "spec_keys": spec_keys, "uncovered": no_need}
