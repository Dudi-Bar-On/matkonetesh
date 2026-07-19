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
    casing_mm   int    sausage CASING bore (not a nozzle)               -> device cap.nozzles
    grind_mm    float  grinder plate size                               -> (grinder has no cap yet)
    scale_res   str    weighing precision needed ('0.1g' | '1g')        -> device cap.res
    min_bath_l    float  smallest sous-vide bath that fits this item    -> device cap.baths
    footprint_cm2 int    grate AREA this item needs                     -> device cap.area
    shape         str    slab | roast | pieces | bird | long            (why the footprint is what it is)
    kg            float  item weight (from the catalog)
    slice_mm      float  slicing thickness                              -> slicer
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
    """Millimetre figure in a Hebrew spec string ('דק 4.5 מ״מ' -> 4.5). A RANGE ('שרוול
    80–100 מ״מ') resolves to its SMALLER figure: a casing/nozzle/plate is chosen at or below
    the stated bore, never above it — the range's ceiling is not a usable spec (and grabbing
    whichever number happens to sit directly before the unit, which is what a naive scan does,
    silently returns the ceiling whenever the range is written "lo–hi")."""
    if not text:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:[-–—]\s*(\d+(?:\.\d+)?)\s*)?מ[\"״']?מ", str(text))
    if not m:
        return None
    a = float(m.group(1))
    b = float(m.group(2)) if m.group(2) else None
    return min(a, b) if b is not None else a


CASING_MIN_MM, CASING_MAX_MM = 16, 120   # lamb ~20mm .. beef middles/bung ~120mm


def _casing_mm(casing):
    """
    Casing diameter — the bore of the casing itself (not a nozzle: a nozzle is chosen NARROWER
    than this and lives on the stuffer device, not on the recipe). 'ללא מעי' (caseless) needs
    no stuffer. A RANGE resolves to its smaller figure via _mm().
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


# ── Footprint model ──────────────────────────────────────────────────────────
# Grate occupancy is AREA, not mass. An earlier version bucketed items by weight
# (>4 kg = "2 racks"), which is wrong: a 5.5 kg brisket is a flat slab that lies in a
# SINGLE layer on one shelf with room beside it, while 1 kg of thighs laid out in one
# layer can cover MORE shelf than the brisket. Weight tells you nothing about footprint.
#
# So each item declares the area it needs (cm²) and each device declares the area it has
# (cap.area), and occupancy is a division — no invented "slot" unit.
#
# Factors are cm² per kg by SHAPE class. Calibrated against a real data point: a 5.5 kg
# packer brisket measures roughly 45x28 cm ≈ 1,300 cm², i.e. ~55% of a ~2,400 cm² cabinet
# shelf — matching the observed "one shelf, room left over for another cut".
SHAPE_CM2_PER_KG = {
    "slab":    240,   # flat and wide, one layer: brisket, belly, ribs, plate, fillets
    "roast":   150,   # thick and blocky: picanha, sirloin/rib roast, shoulder, breast
    "pieces":  330,   # many small pieces spread in one layer: thighs, wings, kebab, sausages
    "bird":    200,   # whole poultry — bulky but tall, so less footprint per kg
    "long":    200,   # shank / osso buco / tongue: long bone-in
}
# Ordered MOST-SPECIFIC-FIRST — `_shape()` returns the first pattern that matches, so a small
# multi-piece cut (an offal item, a wing, a plural "drumsticks") must be caught before the
# generic species-name/whole-animal patterns below, or it falls through to "pieces"/"bird"
# incorrectly (or all the way through to the "roast" default).
_SHAPE_WORDS = [
    ("pieces", r"איברים פנימיים|פרגיות|כנפ|שוקיים|קבב|המבורגר|נקניקי|שיפוד|קוביות|טחון|שרימפ|קלמארי|פירות ים|ירקות|פירות"),
    ("slab",   r"בריסקט|בטן|ספייריבס|צלעות|אסאדו|אונטרייב|פסטרמה|פלא?נק|פילה דג|סלמון|דג|ברוסקט|חזה (?:אווז|ברווז)"),
    ("long",   r"שוק |שריר|אוסובוקו|לשון|זנב"),
    # Whole-animal ONLY — ANCHORED on "שלם" (whole). A bare species name (אווז|ברווז) is not
    # enough: it also appears in a duck BREAST's or a goose LEG's own name/category, which are
    # single flat/long cuts, not a whole bird (and are already claimed by slab/long above).
    ("bird",   r"עוף שלם|הודו שלם|אווז שלם|ברווז שלם|תרנגול"),
]


def _shape(cut):
    name = f"{cut.get('heb','')} {cut.get('eng','')} {cut.get('cat','')}"
    for cls, pat in _SHAPE_WORDS:
        if re.search(pat, name):
            return cls
    return "roast"


def _footprint_cm2(cut):
    """Grate area this item needs, in cm². None when the weight is unknown."""
    kg = cut.get("kg")
    if not kg:
        return None
    return int(round(kg * SHAPE_CM2_PER_KG[_shape(cut)]))


def _bath_l(kg):
    """Smallest practical sous-vide bath for an item: water must cover it, plus displacement."""
    if kg is None:
        return None
    return 12.0 if kg <= 3.0 else 24.0


def _hours(v):
    """Numeric hours from a field that may be a plain number or a 'lo-hi' range string
    ('12' -> 12.0, '2-4' -> 4.0). The higher end of a range is what determines whether
    long-hold gear (a cooler/cambro) is actually needed."""
    if v in (None, ""):
        return 0.0
    nums = re.findall(r"\d+(?:\.\d+)?", str(v))
    return max(float(n) for n in nums) if nums else 0.0


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
    """Dedupe + drop empties + validate every token against VOCAB — at the top level AND inside
    the nested `by` / `phase` / `alt` structures, which previously skipped this check entirely
    (a hand-typed token there could drift out of sync with app.js just as easily as a top-level
    one, with nothing catching it)."""
    def _clean(tokens):
        seen, out = set(), []
        for t in tokens or []:
            if t and t in VOCAB and t not in seen:
                seen.add(t); out.append(t)
        return out

    for k in ("need", "opt"):
        e[k] = _clean(e.get(k, []))
    e["opt"] = [t for t in e["opt"] if t not in set(e["need"])]

    if e.get("alt"):
        e["alt"] = {k: _clean(v) for k, v in e["alt"].items() if k in VOCAB and _clean(v)}
    if e.get("by"):
        for sub in e["by"].values():
            sub["need"] = _clean(sub.get("need", []))
            sub["opt"] = [t for t in _clean(sub.get("opt", [])) if t not in set(sub["need"])]
            if sub.get("alt"):
                sub["alt"] = {k: _clean(v) for k, v in sub["alt"].items() if k in VOCAB and _clean(v)}
    if e.get("phase"):
        e["phase"] = {i: _clean(toks) for i, toks in e["phase"].items()}
        e["phase"] = {i: toks for i, toks in e["phase"].items() if toks}

    for k in ("alt", "spec", "by", "phase"):
        if k in e and not e[k]:
            del e[k]
    return e


# ─────────────────────────────────────────────────────────────────────────────
# 3. CUTS — equipment depends on the METHOD chosen, so requirements are per-method.
# ─────────────────────────────────────────────────────────────────────────────

def cut_equip(c):
    kg = c.get("kg")
    foot = _footprint_cm2(c)          # cm² of grate this item needs
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
            "spec": {"footprint_cm2": foot},
        }
        # Long cooks are where holding gear actually earns its place. Use the LONGER of the two
        # duration fields (combo smoke+sous-vide "smh" vs smoker-only "soh") — an `or` chain here
        # previously short-circuited on smh alone and never looked at soh at all, so e.g. brisket
        # (smh='3', soh='12') was scored as a 3-hour cook and never qualified for a cooler.
        hrs = max(_hours(c.get("smh")), _hours(c.get("soh")))
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
            "spec": {"footprint_cm2": foot},
        }

    need = ["probe"]                    # every cut ends on a bcheck internal-temp gate
    opt = ["knife", "board"]
    if str(c.get("coal") or "") not in ("", "ללא"):
        opt.append("chimney")           # charcoal -> a chimney changes the lighting task
    if (c.get("rest") or 0) >= 30:
        opt.append("cooler")

    return _norm({"need": need, "opt": opt, "by": by,
                  "spec": {"footprint_cm2": foot, "kg": kg, "shape": _shape(c)}})


# ─────────────────────────────────────────────────────────────────────────────
# 4. SPECIALS — jerky / biltong / dried / cold-smoked cheese.
# ─────────────────────────────────────────────────────────────────────────────

def special_equip(s):
    # A probe is required only where something is cooked to an INTERNAL temperature. Read `tgt`
    # (the target) alone — `note`/`age` often cite an AMBIENT drying temp ("~21–27°C" for biltong),
    # which must not be mistaken for an internal-temp gate. `smt` can be an empty string (Halloumi
    # has smt='' — it's grilled straight, no smoker involved), so test truthiness, not "is not
    # None": an empty string is not None but must not count as "has a smoke temp".
    need = ["probe"] if (s.get("smt") or re.search(r"\d+\s*°C", str(s.get("tgt") or ""))) else []
    opt, spec = [], {}
    cure_res = _cure_scale(s.get("cure"), s.get("note"))
    if cure_res:
        need.append("scale"); spec["scale_res"] = cure_res

    if s.get("smt"):
        need.append("smoker")
        opt += ["drippan", "gloves"]

    age = str(s.get("age") or "")
    cat = str(s.get("cat") or "")
    # `age` means two different things depending on category. For a MEAT special it can mean an
    # actual drying/curing step in a chamber ("ייבוש"/"תלייה", or a day/week duration held at
    # controlled RH). For a CHEESE special it means RESTING sealed in the fridge — "מנוחה 1-2
    # שבועות", "יישון 2+ שבועות במקרר", "מיידי" — which needs a fridge, not a cure chamber.
    # Never infer curechamber from a cheese's age, whatever the wording.
    if cat != "גבינה" and age and age != "—" and re.search(
        r"ייבוש|תלייה|\d+\s*[-–]\s*\d+\s*(?:ימים|שבוע)|\d+\s*(?:ימים|שבועות)", age
    ):
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

# An internal-temp SIGNAL for the probe requirement below: a materials thermometer mention, or
# one of these words sitting next to an actual temperature figure. A bare °C is not enough — see
# the comment at `need = (...)` below for why.
_INTERNAL_TEMP_RE = re.compile(
    r"מדחום|internal"
    r"|\d+(?:\.\d+)?\s*°C?\s*[^\d.]{0,12}?(?:פנימ\w*|פנים|ליבה)",
    re.IGNORECASE,
)
GRIND_MIN_MM, GRIND_MAX_MM = 3, 13   # plausible grinder-plate bore


def make_equip(m):
    b = m.get("build") or {}
    phases = b.get("phases") or []
    mats = " ".join(str(x) for x in (b.get("materials") or []))
    intro = str(b.get("intro") or "")
    calc = b.get("calc") or {}

    # Probe only where the recipe itself calls for one (materials name a thermometer) or a phase
    # gives an INTERNAL-temp target ("פנימי"/"פנים"/"ליבה" beside a °C figure). A bare °C in the
    # blob is NOT enough: dry-cured salumi (sal-*) is gated by weight loss, not internal temp, and
    # its chamber's ambient 12–15°C would otherwise misfire as a probe requirement; same for
    # fish-lox's 25°C cold-smoke chamber temp.
    _cookblob = " ".join(str(p[1]) for p in phases)
    need = (["probe"] if (re.search(r"מדחום", mats) or _INTERNAL_TEMP_RE.search(_cookblob)) else [])
    opt, spec, phase_map = [], {}, {}

    # --- casing -> stuffer + the CASING BORE it demands ------------------------
    # Every sausage builder passes `casing` as its own argument, landing at materials[1]
    # (SG / b_fresh / b_emul all build mats as [grinder+stuffer, casing, salt, ...]).
    # Read THAT slot rather than regexing the whole blob, which also matches grind plates.
    # The spec key is `casing_mm` — the CASING's bore, not a nozzle: nozzles are chosen NARROWER
    # than the casing, no real nozzle is ~100 mm wide, and _mm() already resolves a range
    # ('שרוול 80–100 מ״מ') to its smaller figure, so casing_mm is itself the conservative bore
    # a nozzle needs to fit under — there is no mechanically-derivable rule for the nozzle size
    # itself (that depends on which nozzles a given stuffer actually has), so it is not emitted.
    mat_list = b.get("materials") or []
    casing_mm = _casing_mm(mat_list[1]) if len(mat_list) > 1 else None
    if casing_mm is None:
        for cand in mat_list:                      # fall back: any material that names a casing
            if re.search(r"שרוול|מעי|קולגן|casing", str(cand)):
                casing_mm = _casing_mm(str(cand))
                if casing_mm is not None:
                    break
    if casing_mm:                   # 0 == caseless -> deliberately no stuffer
        need.append("stuffer"); spec["casing_mm"] = int(casing_mm)
    elif casing_mm is None and re.search(r"שרוול|מעי", mats):
        need.append("stuffer")     # casing named but no diameter given

    # --- grinding ---------------------------------------------------------------
    blob = " ".join([intro] + [str(p[1]) for p in phases])
    needs_grinder = bool(re.search(r"טחן|טחינה", blob) or re.search(r"מטחנה", mats))
    if needs_grinder:
        need.append("grinder")
        # Only trust a millimetre figure that appears in GRINDING context (a phase labelled
        # "טחינה", or text mentioning טחן/פלטה) — a bare _mm() over the whole blob also matches
        # casing/slice figures elsewhere in the recipe (m-lapcheong's casing "22–26 מ״מ" was
        # mistaken for its grind plate this way, since it's the only מ״מ figure anywhere in its
        # build). Bound the result to a plausible grinder-plate size as a sanity check.
        grind_ctx = [str(p[1]) for p in phases
                     if re.search(r"טחינה|טחן", str(p[0])) or re.search(r"טחן|פלטה", str(p[1]))]
        if not grind_ctx:
            for extra in (mats, intro):
                if re.search(r"טחן|פלטה", extra):
                    grind_ctx.append(extra)
        g = _mm(" ".join(grind_ctx))
        if g is not None and GRIND_MIN_MM <= g <= GRIND_MAX_MM:
            spec["grind_mm"] = g

    # --- curing precision -----------------------------------------------------
    res = _cure_scale(mats, intro, blob, calc.get("cure") and "Cure #" + str(calc.get("cure")))
    if res or calc.get("cure"):
        need.append("scale"); spec["scale_res"] = res or "0.1g"

    # --- smoking / drying -----------------------------------------------------
    # Bare "עישון" is neither necessary nor sufficient for "this needs a smoker": it can be
    # NEGATED ("ללא עישון וללא חום" — fish-gravlax says exactly this, and must NOT get a smoker),
    # and it can be entirely ABSENT even when a recipe is clearly smoked — b_pastrami and the BBQ
    # builders only ever give a °C in prose ("עשן ב-110°C"), never the word "עישון" itself. Strip
    # negated occurrences, then fall back to matching phase LABELS ("5 · עישון" / "6 · עישון"),
    # which SG / b_pastrami / the BBQ dicts always emit for an actual smoking step regardless of
    # what the prose says.
    _neg_blob = re.sub(r"(?:ללא|בלי)\s+(?:עישון|חום)", "", blob)
    _smoked_label = any(re.search(r"עישון", str(p[0])) for p in phases)
    if "עישון" in _neg_blob or _smoked_label:
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
#    Keyed by cut `n`, special `n`, or make id. All three are wired the same way (need/opt ADD
#    to what was derived; spec keys are updated) — empty by default, since the module's whole
#    design is to derive everything mechanically and reach for an override only when a
#    requirement genuinely cannot be read off the recipe's own fields.
# ─────────────────────────────────────────────────────────────────────────────
CUT_OVERRIDES = {}
SPECIAL_OVERRIDES = {}
MAKE_OVERRIDES = {}


def _apply_override(e, ov):
    """Merge an override's need/opt/spec into a derived equip block. need/opt are UNIONED (an
    override only ever ADDS a requirement, never silently removes a derived one); spec keys are
    updated (an override can refine a numeric spec the derivation got wrong)."""
    if not ov:
        return e
    e["need"] = sorted(set(e.get("need", [])) | set(ov.get("need", [])))
    e["opt"] = sorted((set(e.get("opt", [])) | set(ov.get("opt", []))) - set(e["need"]))
    if ov.get("spec"):
        e.setdefault("spec", {}).update(ov["spec"])
    return e


def apply(cuts, specials, makes):
    """Attach `equip` to every recipe. Returns coverage stats."""
    for c in cuts:
        c["equip"] = _apply_override(cut_equip(c), CUT_OVERRIDES.get(c.get("n")))
    for s in specials:
        s["equip"] = _apply_override(special_equip(s), SPECIAL_OVERRIDES.get(s.get("n")))
    for mid, m in makes.items():
        m["equip"] = _apply_override(make_equip(m), MAKE_OVERRIDES.get(mid))
    return stats(cuts, specials, makes)


def stats(cuts, specials, makes):
    from collections import Counter
    tok = Counter()
    spec_keys = Counter()
    # A cut's `need` always carries the baseline "probe" (every cook ends on an internal-temp
    # check), so "not e['need']" could never fire here regardless of the data — that check was
    # vacuous. Flag instead the recipes where NOTHING beyond that baseline was derivable: no
    # extra need, no opt, no per-method ("by") or per-phase breakdown — a real coverage gap.
    uncovered = []
    for coll, kind in ((cuts, "cut"), (specials, "special"), (list(makes.values()), "make")):
        for r in coll:
            e = r.get("equip") or {}
            for t in e.get("need", []):
                tok[t] += 1
            for t in e.get("opt", []):
                tok[t] += 0     # ensure key exists
            for k in (e.get("spec") or {}):
                spec_keys[k] += 1
            bare_need = set(e.get("need", [])) - {"probe"}
            if not bare_need and not e.get("opt") and not e.get("by") and not e.get("phase"):
                uncovered.append((kind, r.get("heb")))
    return {"tokens": tok, "spec_keys": spec_keys, "uncovered": uncovered}
