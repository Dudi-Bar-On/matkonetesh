# -*- coding: utf-8 -*-
import json
from data import CUTS, SPECIALS, GLOSSARY, BUILDS, MAKES
from seasonings import SEASONINGS as _SEAS_BASE
from seasonings_ext import SEASONINGS_EXT as _SEAS_EXT
from seasoning_tags import SEASONING_TAGS as _SEAS_TAGS
from house_rub_map import HOUSE_RUB_MAP
import re as _re
def _snorm(s): return _re.sub(r'[^a-z]', '', (s.get('eng') or '').lower())
_seen_ids = {s['id'] for s in _SEAS_BASE}
_seen_names = {_snorm(s) for s in _SEAS_BASE}
_seen_heb = {s['heb'].strip() for s in _SEAS_BASE}
SEASONINGS = list(_SEAS_BASE)
for _s in _SEAS_EXT:
    if _s['id'] in _seen_ids or _snorm(_s) in _seen_names or _s['heb'].strip() in _seen_heb:
        continue
    _seen_ids.add(_s['id']); _seen_names.add(_snorm(_s)); _seen_heb.add(_s['heb'].strip())
    SEASONINGS.append(_s)
# merge flavor/base/heat tags into each seasoning (Phase A)
for _s in SEASONINGS:
    _s['cont'] = (_s.get('cont') or '').replace('ישראל/מזה״ת', 'ישראל/מזה"ת')
    _t = _SEAS_TAGS.get(_s['id'], {})
    _s['flavor'] = _t.get('flavor', [])
    _s['base'] = _t.get('base', 'יבש' if _s['kind']=='rub' else 'שמן')
    _s['heat'] = _t.get('heat', 0)
from sausages_new import NEW_SAUSAGES
from descriptions import CUT_DESC, SPEC_DESC, SPEC_ORIGIN

MAKES.update(NEW_SAUSAGES)
try:
    from sausages_new import ORIGINS
except ImportError:
    ORIGINS={}
for _k,_m in MAKES.items():
    _m.setdefault("origin", ORIGINS.get(_k,""))
    _m.setdefault("desc", _m.get("build",{}).get("intro",""))
for _c in CUTS:
    if _c["n"] in CUT_DESC: _c["desc"]=CUT_DESC[_c["n"]]

# ── fresh-sausage cook/storage standardization (grounded in professional practice) ──
import re as _re
_THIN = {"m-merg","m-chip"}   # thin fast-grill sausages — no gentle-poach needed
_BLOOD = _re.compile(r"דם|מורסי|morcilla|בלאד|סונד|blood|בודן|butifarra negra")   # blood/rice/precook types keep their poach temp
def _has_internal_temp(txt):
    return bool(_re.search(r"7[0-4]\s*°|7[0-4]°\s*פנים|טמפ.*פנים|פנים.*7[0-4]", txt or ""))
for _k,_m in MAKES.items():
    if _m.get("cat")!="נקניקיות": continue
    _b=_m.get("build") or {}
    _ph=_b.get("phases") or []
    if not _ph: continue
    _last=_ph[-1]
    _islist=isinstance(_last,(list,tuple))
    _lbl=(_last[0] if _islist else _last.get("title","")) if _last else ""
    _body=(_last[1] if (_islist and len(_last)>1) else (_last.get("body","") if not _islist else "")) if _last else ""
    _secs=(_last[2] if (_islist and len(_last)>2) else 0)
    _isThin=_k in _THIN
    _isBlood=bool(_BLOOD.search(_m.get("heb","")+_m.get("eng","")+_k))
    _isPoultry=bool(_re.search(r"עוף|הודו|chicken|turkey",_m.get("heb","")+_m.get("eng","")))
    _tgt="74° פנים (עוף)" if _isPoultry else "71° פנים"
    # 1) ensure an explicit internal-temp target where it matters (skip thin fast-grill + blood/precook types)
    if not _isThin and not _isBlood and not _has_internal_temp(_body):
        _newbody=_body.rstrip()+f" בשל עד {_tgt} (מד-חום)."
        if isinstance(_last,tuple):
            _ph[-1]=(_lbl,_newbody,_secs)
        elif isinstance(_last,list):
            if len(_last)>1: _last[1]=_newbody
            else: _last.append(_newbody)
        else:
            _last["body"]=_newbody
    # 2) storage / make-ahead guidance (all fresh sausages)
    if _isThin:
        _store=("🧊 הכנה-מראש ואחסון: גולמי במקרר 1–2 ימים. הדקיקות מיועדות לגריל מהיר טרי — אך אפשר לפצ' 75° ל-25 דק׳ עד 72° פנים, "
                "לקרר מהר ולאטום → כשבוע במקרר. הקפאה (גולמי או מפוצ׳) → עד 6 חודשים. ביום ההגשה: צריבה/חימום קצר.")
    else:
        _store=("🧊 הכנה-מראש ואחסון: גולמי במקרר 1–2 ימים. להכנה-מראש — פוץ׳ עדין 75° (בועות קטנות, לא רתיחה) ~25 דק׳ עד "
                f"{_tgt}, קירור מהיר (אמבט קרח) ואיטום → כשבוע במקרר. הקפאה גולמי/מפוצ׳ → עד 6 חודשים. "
                "ביום ההגשה: רק צריבה קצרה לצבע (מבושל מבפנים).")
    _b["store"]=_store

for _s in SPECIALS:
    if _s["heb"] in SPEC_DESC: _s["desc"]=SPEC_DESC[_s["heb"]]
    if _s["heb"] in SPEC_ORIGIN: _s["origin"]=SPEC_ORIGIN[_s["heb"]]

# Merge cited sources + order-effect data (auto-generated in sources.py) into each item.
try:
    from sources import CUT_SOURCES, SPEC_SOURCES, MAKE_SOURCES
    for _c in CUTS:
        _src = CUT_SOURCES.get(_c["n"])
        if _src: _c.update(_src)
    for _sp in SPECIALS:
        _src = SPEC_SOURCES.get(_sp["n"])
        if _src: _sp.update(_src)
    for _mid, _src in MAKE_SOURCES.items():
        if _mid not in MAKES: continue
        for _k, _v in _src.items():
            if _k == "calc":
                # The cure TYPE ('1'/'2'), cureRate and salt are owned by the canonical make calc
                # (data.py / sausages_new.py). The auto-generated sources carried a stale numeric
                # 'cure' (2.5) that clobbered the type and silently suppressed the dried-safety
                # warning. Ignore sources' calc here. (Wave 0 safety fix; authoritative researched-salt
                # reconciliation via the pipeline is Wave 2b / T6.)
                continue
            MAKES[_mid][_k] = _v
except ImportError:
    pass

payload = {
    "cuts": CUTS,
    "specials": SPECIALS,
    "glossary": [{"group": g, "he": he, "en": en, "desc": d} for (g, he, en, d) in GLOSSARY],
    "builds": BUILDS,
    "makes": MAKES,
    "seasonings": SEASONINGS,
    "houseRub": HOUSE_RUB_MAP,
}
DATA_JSON = json.dumps(payload, ensure_ascii=False)

HTML = r"""<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מתכונת · מדריך האש — סו-ויד ועישון</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#16110d">
<meta name="color-scheme" content="light dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="מדריך האש">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Suez+One&family=Frank+Ruhl+Libre:wght@400;700;900&family=Assistant:wght@300;400;600;700;800&family=Heebo:wght@400;500;700&family=Rubik:wght@400;500;700;800&family=Alef:wght@400;700&family=David+Libre:wght@400;500;700&family=Secular+One&display=swap" rel="stylesheet">
<style>
:root{
  /* ── 05-A · שמנת חמימה (Warm Cream) — בהיר, חם, עם מבטא ירוק-ים ── */
  --char:#fdf6ec;      /* base bg — cream */
  --char2:#fffaf3;     /* card / raised */
  --char3:#fff2e4;     /* deeper raised */
  --ember:#e76f51;     /* terracotta (primary) */
  --ember2:#f4a261;    /* peach (accent/flame) */
  --ash:#6e5340;       /* warm secondary text — AA 6.6:1 on bg */
  --bone:#5a3a28;      /* primary ink text */
  --smoke:#7a5f4c;     /* muted text — AA 5.5:1 on bg (was #b09480, failed AA at 2.65:1) */
  --line:#f0dcc4;      /* hairline */
  --line2:#f5e0c8;     /* raised border */
  --good:#1a9a7a;      /* fresh accent (was green) */
  --fresh:#1a9a7a;     /* sea-green pop */
  --fresh-l:#d8f0e8;   /* fresh tint bg */
  --terra-d:#d2691e;   /* deep terracotta */
  --bg2:#faecd8;       /* gradient partner / body canvas */
  --card:#fffaf3;      /* v144: was undefined (seas-card, vc-det, vc-keyrow input) — now a real token */
  --r:16px;
  --fscale:1;           /* v144: global text-size multiplier, user-controlled (mk-fontscale) */
  --font-body:'Heebo';  /* v144: swappable body font role (mk-fontpair) */
  --font-display:'Suez One'; /* v144: swappable display font role (mk-fontpair) */
}
/* light-theme base overrides for legacy dark assumptions */
body{background:var(--bg2)!important;background-image:none!important;color:var(--bone)}
.thumb-v{background:var(--char3);border-bottom-color:var(--line2)}
.vnum{color:var(--smoke)}
/* ═══════════ Concept C — navigation layer (05-A) ═══════════ */
.screen{display:none}
.screen.on{display:block;animation:cFade .3s}
@keyframes cFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
body.capp{padding-bottom:82px}
/* top bar (home/screens) */
.capp-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;padding:14px 16px 12px;background:linear-gradient(180deg,var(--char) 72%,transparent)}
.capp-top{padding:16px 16px 12px}
.capp-top-home{position:relative;padding:22px 16px 10px;text-align:center;display:block}
.capp-more-corner{position:absolute;top:16px;inset-inline-start:16px;z-index:2}
.chome-title{max-width:520px;margin:0 auto}
.chome-kick{font-family:var(--font-body);letter-spacing:.14em;font-size:calc(10.5px * var(--fscale));color:var(--ember2);font-weight:800;margin-bottom:7px}
.chome-h1{font-family:var(--font-display);font-weight:400;font-size:clamp(29px,7.6vw,40px);line-height:1.05;color:#3a2418;margin:0;letter-spacing:-.01em;text-shadow:0 1px 0 rgba(255,255,255,.55);text-wrap:balance}
.chome-sub{font-size:calc(13px * var(--fscale));color:var(--smoke);line-height:1.55;margin:9px auto 0;max-width:340px;font-family:var(--font-body)}
.chome-caps{background:none;border:none;color:var(--ember);font-weight:800;font-family:var(--font-body);font-size:calc(13px * var(--fscale));cursor:pointer;padding:0;text-decoration:underline;white-space:nowrap}
.chome-credit-top{text-align:center;font-size:calc(11.5px * var(--fscale));color:var(--smoke);font-family:var(--font-body);margin-top:10px}
.chome-credit-top b{color:var(--ember)}
.chome-h1 .brand-flame{font-size:.82em;filter:drop-shadow(0 2px 4px rgba(231,111,81,.5))}
.capp-top .sp{flex:1}
.capp-ico{width:40px;height:40px;border-radius:13px;background:var(--char2);border:1.5px solid var(--line2);color:var(--ember);font-size:calc(17px * var(--fscale));display:grid;place-items:center;cursor:pointer}
/* home */
.chome-search{margin:6px 16px 14px;position:relative}
.chome-search input{width:100%;background:var(--char2);border:1.5px solid var(--line2);border-radius:16px;padding:14px 44px 14px 16px;color:var(--bone);font-family:var(--font-body);font-size:calc(14.5px * var(--fscale))}
.chome-search .ic{position:absolute;right:15px;top:50%;transform:translateY(-50%);font-size:calc(17px * var(--fscale));color:var(--ember)}
.chome-hero{padding:10px 16px 14px}
.chome-hero .hi{font-size:calc(13px * var(--fscale));color:var(--smoke);font-family:var(--font-body);font-weight:600}
.chome-hero h2{font-family:var(--font-display);font-size:calc(22px * var(--fscale));margin-top:2px;color:var(--bone);line-height:1.15}
.chome-hero h2 b{color:var(--ember);font-weight:400}
.cpaths{display:flex;flex-direction:column;gap:13px;padding:0 16px}
.cpath{position:relative;border-radius:20px;padding:24px 22px 22px;cursor:pointer;overflow:hidden;background:var(--char2);border:2px solid var(--line2);box-shadow:0 5px 16px rgba(210,105,30,.08);transition:transform .15s;text-align:center}
.cpath:active{transform:scale(.98)}
.cpath .pico{font-size:calc(46px * var(--fscale));display:block;margin-bottom:10px;line-height:1}
.cpath h3{font-family:var(--font-display);font-size:calc(24px * var(--fscale));margin-bottom:8px;color:var(--bone);font-weight:400}
.cpath p{font-size:calc(13.5px * var(--fscale));color:var(--ash);line-height:1.6;text-align:right}
.cpath .go{display:block;margin-top:12px;font-size:calc(22px * var(--fscale));text-align:center;opacity:.85}
.cpath.event{background:linear-gradient(135deg,#fff3e6,#ffe9d6)}.cpath.event .go{color:var(--ember)}
.cpath.quick .go{color:var(--ember)}
.cpath.project .go{color:var(--terra-d)}
.cpath .ptag{position:absolute;top:16px;left:16px;background:var(--fresh-l);color:var(--fresh);font-family:var(--font-body);font-weight:700;font-size:calc(10px * var(--fscale));padding:3px 9px;border-radius:999px}
.cnext{margin:20px 16px 0;background:var(--char2);border:2px solid var(--line2);border-radius:16px;padding:15px;display:flex;align-items:center;gap:13px;cursor:pointer}
.cnext .nico{font-size:calc(28px * var(--fscale))}.cnext .nt{font-size:calc(11.5px * var(--fscale));color:var(--ash);font-family:var(--font-body)}
.cnext .nm{font-size:calc(15px * var(--fscale));font-weight:700;margin-top:2px;color:var(--bone)}
.cnext .ng{color:var(--ember);font-size:calc(19px * var(--fscale))}
.cnext[hidden]{display:none}
/* section head (sub-screens) */
.cshead{display:flex;align-items:center;gap:10px;padding:16px 16px 14px}
.cshead .back{width:38px;height:38px;border-radius:12px;background:var(--char2);border:1.5px solid var(--line2);color:var(--bone);font-size:calc(17px * var(--fscale));display:grid;place-items:center;cursor:pointer}
.cshead h2{font-family:var(--font-display);font-size:calc(20px * var(--fscale));flex:1;color:var(--bone);font-weight:400}
.cshead .step{font-size:calc(12px * var(--fscale));color:var(--smoke);font-family:var(--font-body)}
/* catalog tiles */
.ctiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:4px 16px 16px}
.ctile{position:relative;border-radius:18px;padding:18px 16px;cursor:pointer;overflow:hidden;min-height:100px;display:flex;flex-direction:column;justify-content:space-between;background:var(--char2);border:2px solid var(--line2);box-shadow:0 4px 12px rgba(210,105,30,.06);transition:transform .15s}
.ctile:active{transform:scale(.97)}
.ctile .tico{font-size:calc(32px * var(--fscale))}
.ctile .tn{font-size:calc(15px * var(--fscale));font-weight:800;font-family:var(--font-body);color:var(--bone)}
.ctile .tc{font-size:calc(11.5px * var(--fscale));color:var(--smoke);font-family:var(--font-body)}
.ctile .tbar{position:absolute;top:0;right:0;width:5px;height:100%;background:var(--tc,var(--ember2))}
/* wizard */
.cwprog{display:flex;gap:6px;padding:0 16px 18px}
.cwseg{flex:1;height:5px;border-radius:3px;background:var(--line2)}
.cwseg.done{background:var(--ember)}.cwseg.cur{background:var(--ember2)}
.cwstep{display:none;padding:0 16px}.cwstep.on{display:block;animation:cFade .3s}
.cwq{font-family:var(--font-display);font-size:calc(22px * var(--fscale));margin-bottom:5px;color:var(--bone);font-weight:400}
.cwsub{font-size:calc(13.5px * var(--fscale));color:var(--ash);margin-bottom:20px;line-height:1.5}
.cstepper{display:flex;align-items:center;justify-content:center;gap:20px;margin:28px 0}
.cstepper button{width:56px;height:56px;border-radius:18px;background:var(--char2);border:2px solid var(--line2);color:var(--ember);font-size:calc(26px * var(--fscale));cursor:pointer}
.cstepper .val{font-family:var(--font-display);font-size:calc(48px * var(--fscale));color:var(--bone);min-width:80px;text-align:center}
.cstepper .val small{display:block;font-size:calc(13px * var(--fscale));color:var(--smoke);font-family:var(--font-body)}
.cscard{background:var(--char2);border:2px solid var(--line2);border-radius:16px;padding:16px;margin-bottom:11px}
.cscard h4{font-family:var(--font-body);font-size:calc(12px * var(--fscale));color:var(--ember);margin-bottom:11px;font-weight:800}
.cmethods{display:flex;gap:7px;flex-wrap:wrap}
.cmethod{background:var(--char);border:1.5px solid var(--line2);border-radius:999px;padding:8px 14px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));color:var(--smoke);cursor:pointer}
.cmethod.on{border-color:var(--ember);color:var(--ember);background:#fff2e6}
.cmethod.fresh.on{border-color:var(--fresh);color:var(--fresh);background:var(--fresh-l)}
.cbadges{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.cbadge{background:var(--fresh-l);border:1px solid #b8e0d4;color:var(--fresh);border-radius:11px;padding:8px 12px;font-family:var(--font-body);font-weight:700;font-size:calc(12px * var(--fscale))}
/* seasoning picker rows (kind + description) */
.cseas-list{display:flex;flex-direction:column;gap:8px}
/* seasoning dropdowns (per kind) */
.cseas-dd{margin-top:11px}
.cseas-dd:first-child{margin-top:4px}
.cseas-ddlabel{display:block;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:800;color:var(--ember);margin-bottom:5px}
.cseas-select{width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:var(--font-body);font-size:calc(14px * var(--fscale));-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23b09480' d='M6 8L0 0h12z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 14px center}
.cseas-select:focus{outline:none;border-color:var(--ember)}
.cseas-ddesc{font-size:calc(11.5px * var(--fscale));color:var(--fresh);margin-top:5px;line-height:1.4;padding-inline-start:2px}
.cseas-group{margin-top:12px}
.cseas-group:first-child{margin-top:2px}
.cseas-ghead{font-family:var(--font-body);font-size:calc(13px * var(--fscale));font-weight:800;color:var(--ember);margin-bottom:7px;display:flex;align-items:baseline;gap:8px}
.cseas-ghint{font-weight:600;font-size:calc(10.5px * var(--fscale));color:var(--smoke)}
.cseas-item{display:flex;align-items:center;gap:10px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:10px 12px;cursor:pointer;transition:all .12s}
.cseas-item.on{border-color:var(--fresh);background:var(--fresh-l)}
.cseas-b{flex:1;min-width:0}
.cseas-top{display:flex;align-items:baseline;gap:8px}
.cseas-kind{font-family:var(--font-body);font-size:calc(10.5px * var(--fscale));font-weight:800;color:var(--ember);background:var(--char3);border-radius:6px;padding:2px 7px;white-space:nowrap}
.cseas-item.on .cseas-kind{color:var(--fresh);background:#c8eade}
.cseas-top b{font-size:calc(14.5px * var(--fscale));color:var(--bone)}
.cseas-desc{font-size:calc(11.5px * var(--fscale));color:var(--smoke);margin-top:3px;line-height:1.4}
.cseas-pick{width:30px;height:30px;border-radius:50%;background:var(--char2);border:1.5px solid var(--line2);display:grid;place-items:center;font-size:calc(16px * var(--fscale));color:var(--smoke);flex-shrink:0}
.cseas-item.on .cseas-pick{background:var(--fresh);border-color:var(--fresh);color:#fff}
/* wizard clear button */
.cwclear{background:none;border:1.5px solid var(--line2);border-radius:10px;padding:7px 13px;font-family:var(--font-body);font-weight:700;font-size:calc(12px * var(--fscale));color:var(--ash);cursor:pointer}
/* sticky selection summary in picker */
.cwpick-sel{display:none}
.cwpick-sel.on{display:block;position:sticky;top:0;z-index:5;background:var(--fresh-l);border:1.5px solid #b8e0d4;border-radius:12px;padding:9px 11px;margin-bottom:10px}
.cwsel-title{font-family:var(--font-body);font-size:calc(11px * var(--fscale));font-weight:800;color:var(--fresh);margin-bottom:6px}
.cwsel-chips{display:flex;flex-wrap:wrap;gap:6px}
.cwsel-chip{background:var(--char2);border:1.5px solid #b8e0d4;border-radius:999px;padding:5px 10px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:700;color:var(--bone);cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.cwsel-chip b{color:var(--terra);font-size:calc(11px * var(--fscale))}
.cwsel-chip:active{transform:scale(.95)}
/* event cards */
.cevcard{display:flex;align-items:stretch;gap:10px;background:var(--char2);border:2px solid var(--line2);border-radius:16px;padding:14px;margin-bottom:10px;cursor:pointer;transition:transform .12s}
.cevcard:active{transform:scale(.98)}
.cevcard.active{border-color:var(--ember);background:linear-gradient(135deg,#fff3e8,#fffaf3)}
.cevcard .cev-main{flex:1;min-width:0}
.cevcard .cev-name{font-family:var(--font-display);font-size:calc(17px * var(--fscale));color:var(--bone);display:flex;align-items:center;gap:8px}
.cevcard .cev-badge{font-family:var(--font-body);font-size:calc(10px * var(--fscale));font-weight:800;color:#fff;background:var(--ember);border-radius:999px;padding:2px 8px}
.cevcard .cev-desc{font-size:calc(12.5px * var(--fscale));color:var(--ash);margin-top:3px;line-height:1.4}
.cevcard .cev-meta{font-size:calc(11.5px * var(--fscale));color:var(--smoke);margin-top:6px;font-family:var(--font-body)}
.cevcard .cev-del{background:none;border:none;font-size:calc(18px * var(--fscale));cursor:pointer;align-self:flex-start;padding:2px 4px;opacity:.7}
.cevcard .cev-del:hover{opacity:1}
.cev-actions{display:flex;gap:8px;margin-top:10px}
.cev-act{background:var(--char);border:1.5px solid var(--line2);border-radius:10px;padding:7px 11px;font-family:var(--font-body);font-weight:700;font-size:calc(11.5px * var(--fscale));color:var(--ember);cursor:pointer}
.cev-act:active{transform:scale(.96)}
/* projects manager */
.cproj-sec{margin-bottom:22px}
.cproj-h{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-display);font-size:calc(16px * var(--fscale));color:var(--bone);margin:4px 0 11px}
.cinv-low-badge{font-family:var(--font-body);font-size:calc(10px * var(--fscale));font-weight:800;color:#fff;background:var(--terra-d);border-radius:999px;padding:2px 8px;vertical-align:middle}
.cproj-card{background:var(--char2);border:2px solid var(--line2);border-radius:16px;padding:14px;margin-bottom:10px}
.cproj-card.ready{border-color:var(--good);background:var(--fresh-l)}
.cpc-top{display:flex;justify-content:space-between;align-items:baseline}
.cpc-top b{font-size:calc(15.5px * var(--fscale));color:var(--bone)}
.cpc-day{font-family:var(--font-body);font-size:calc(12px * var(--fscale));color:var(--ember);font-weight:700}
.cpc-sub{font-size:calc(12px * var(--fscale));color:var(--smoke);margin:4px 0 9px}
.cpc-log{display:flex;align-items:center;gap:8px;font-size:calc(12px * var(--fscale));color:var(--ash);margin-top:9px}
.cpc-log input{width:74px;background:var(--char);border:1.5px solid var(--line2);border-radius:9px;padding:7px;color:var(--bone);font-family:var(--font-body);font-size:calc(14px * var(--fscale))}
.cpc-ready{color:var(--good);font-weight:800;font-family:var(--font-body);font-size:calc(13px * var(--fscale));margin-top:8px}
.cpc-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px;align-items:center}
.cpc-act{background:var(--char);border:1.5px solid var(--line2);border-radius:9px;padding:7px 10px;font-family:var(--font-body);font-weight:700;font-size:calc(11.5px * var(--fscale));color:var(--ember);cursor:pointer}
.cpc-act:active{transform:scale(.96)}
.cpc-rm{background:none;border:none;color:var(--smoke);font-family:var(--font-body);font-size:calc(11px * var(--fscale));cursor:pointer;text-decoration:underline;margin-inline-start:auto}
.proj-banner{background:var(--fresh-l);border:1px solid #b8e0d4;border-radius:10px;padding:9px 12px;font-size:calc(12.5px * var(--fscale));color:var(--bone);margin-bottom:11px}
.proj-banner b{color:var(--fresh)}
/* project wizard */
.pw-steps{display:flex;align-items:center;justify-content:center;gap:4px;margin:4px 0 4px}
.pw-steps i{flex:0 0 18px;height:2px;background:var(--line2)}
.pw-dot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-body);font-weight:800;font-size:calc(12px * var(--fscale));background:var(--char3);color:var(--smoke);border:1.5px solid var(--line2)}
.pw-dot.on{background:var(--ember);color:#fff;border-color:var(--ember)}
.pw-dot.done{background:var(--good);color:#fff;border-color:var(--good)}
.pw-lbl{text-align:center;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:700;color:var(--ember);margin-bottom:14px}
.pw-hint{font-size:calc(12px * var(--fscale));color:var(--ash);background:var(--fresh-l);border:1px solid #b8e0d4;border-radius:10px;padding:9px 11px;line-height:1.5;margin:8px 0}
.pw-hint b{color:var(--bone)}
.pw-mats{display:flex;flex-direction:column;gap:6px}
.pw-mat{font-size:calc(12.5px * var(--fscale));color:var(--bone);background:var(--char2);border:1.5px solid var(--line2);border-radius:10px;padding:8px 11px}
.pw-mat.have{border-color:var(--good);background:var(--fresh-l)}
.pw-mat span{font-weight:800;margin-inline-end:5px}
.pw-review{background:var(--char2);border:2px solid var(--line2);border-radius:14px;padding:6px 14px;margin-bottom:10px}
.pw-rr{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line2);font-size:calc(13.5px * var(--fscale))}
.pw-rr:last-child{border-bottom:none}
.pw-rr span{color:var(--smoke)}
.pw-nav{display:flex;gap:10px;align-items:center;margin-top:16px}
/* project step checklist */
.cpc-steps{margin-top:10px;border:1.5px solid var(--line2);border-radius:11px;overflow:hidden}
.cpc-steps summary{cursor:pointer;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));color:var(--ember);padding:9px 12px;background:var(--char3);list-style:none}
.cpc-steps summary::-webkit-details-marker{display:none}
.cpc-steplist{padding:8px 12px;display:flex;flex-direction:column;gap:6px}
.cpc-step{display:flex;align-items:flex-start;gap:8px;font-size:calc(12.5px * var(--fscale));color:var(--bone);line-height:1.4;cursor:pointer}
.cpc-step.done{color:var(--smoke);text-decoration:line-through}
.cpc-step input{margin-top:2px;accent-color:var(--good);flex-shrink:0}
/* inventory rows */
.cinv-row{display:flex;align-items:center;gap:8px;background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:10px 12px;margin-bottom:7px}
.cinv-grp{font-family:var(--font-body);font-weight:800;font-size:calc(12px * var(--fscale));color:var(--ember);margin:12px 0 7px;padding-inline-start:2px}
.cinv-row.low{border-color:var(--terra-d);background:#fdefe3}
.cinv-name{flex:1;font-family:var(--font-body);font-size:calc(13px * var(--fscale));font-weight:700;color:var(--bone);min-width:0}
.cinv-lowtag{font-size:calc(9.5px * var(--fscale));font-weight:800;color:var(--terra-d);background:#fff;border:1px solid var(--terra-d);border-radius:5px;padding:1px 5px}
.cinv-qty{display:flex;align-items:center;gap:4px}
.cinv-qty button{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line2);background:var(--char);color:var(--ember);font-size:calc(15px * var(--fscale));font-weight:800;cursor:pointer}
.cinv-qty input{width:52px;background:var(--char);border:1.5px solid var(--line2);border-radius:8px;padding:5px;text-align:center;color:var(--bone);font-family:var(--font-body);font-size:calc(13px * var(--fscale))}
.cinv-qty span{font-size:calc(10.5px * var(--fscale));color:var(--smoke);min-width:28px}
.cinv-rm{background:none;border:none;color:var(--smoke);font-size:calc(17px * var(--fscale));cursor:pointer;padding:0 2px}
/* workflow links */
.cproj-links{display:flex;gap:10px}
.cproj-link{flex:1;background:var(--char2);border:1.5px solid var(--line2);border-radius:14px;padding:13px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));color:var(--bone);cursor:pointer;display:flex;flex-direction:column;gap:3px;text-align:center}
.cproj-link small{font-weight:400;font-size:calc(10.5px * var(--fscale));color:var(--smoke)}
.cproj-link:active{transform:scale(.97)}
/* summary rows */
.csum-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
.csum-row:last-child{border:none}
.csum-row .si{font-size:calc(21px * var(--fscale))}.csum-row .sb{flex:1}
.csum-row .st{font-size:calc(14px * var(--fscale));font-weight:700;color:var(--bone)}
.csum-row .sd{font-size:calc(11px * var(--fscale));color:var(--smoke)}
.csum-row .stime{font-family:var(--font-body);font-weight:800;color:var(--ember);font-size:calc(13px * var(--fscale))}
/* cta */
.ccta{display:block;width:calc(100% - 32px);margin:20px 16px 8px;background:linear-gradient(135deg,var(--ember2),var(--ember));color:#fff;border:none;border-radius:15px;padding:16px;font-family:var(--font-body);font-weight:800;font-size:calc(16px * var(--fscale));cursor:pointer;box-shadow:0 5px 16px rgba(231,111,81,.3)}
.ccta.ghost{background:var(--char2);border:2px solid var(--line2);color:var(--bone);box-shadow:none}
/* bottom nav */
.cnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px;display:flex;background:var(--char2);border-top:2px solid var(--line2);z-index:60;box-shadow:0 -4px 16px rgba(210,105,30,.06)}
.cnav button{flex:1;background:none;border:none;color:var(--smoke);padding:9px 0 11px;font-family:var(--font-body);font-weight:600;font-size:calc(10.5px * var(--fscale));cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px}
.cnav button .ni{font-size:calc(21px * var(--fscale))}
.cnav button.on{color:var(--ember)}
.cnav .fab{margin-top:-18px}
.cnav .fab .ni{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,var(--ember2),var(--ember));display:grid;place-items:center;font-size:calc(25px * var(--fscale));box-shadow:0 6px 16px rgba(231,111,81,.4);color:#fff}
/* more sheet groups */
.cmore-grp{margin:0 16px 18px}
.cmore-grp h4{font-family:var(--font-display);font-size:calc(15px * var(--fscale));color:var(--ember);margin:16px 0 10px;font-weight:400}
.cmore-item{display:flex;align-items:center;gap:12px;background:var(--char2);border:1.5px solid var(--line2);border-radius:13px;padding:13px 14px;margin-bottom:8px;cursor:pointer;font-family:var(--font-body);font-size:calc(14px * var(--fscale));font-weight:600;color:var(--bone);text-decoration:none}
.cmore-item .mi{font-size:calc(20px * var(--fscale))}
.cmore-item .mg{margin-inline-start:auto;color:var(--smoke)}
/* hide bottom nav when a modal panel is open (so its action/print row isn't covered) */
body.noscroll .cnav{display:none}
.panel-body{padding-bottom:calc(40px + env(safe-area-inset-bottom,0px))}
/* hide legacy hero/glow in capp mode */
body.capp .hero, body.capp .glow{display:none}
.thumb-v{height:auto;padding:14px 10px 10px;background:var(--char2);border-bottom:2px solid var(--line);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;overflow:visible}
.v-emoji{font-size:calc(34px * var(--fscale));line-height:1;filter:drop-shadow(0 1px 4px rgba(45,15,10,.18))}
.vnum{font-family:'Frank Ruhl Libre',serif;font-size:calc(13px * var(--fscale));color:var(--line);line-height:1;font-weight:400;letter-spacing:.06em}

/* ── Gold card thumb ───────────────────────────────────────── */
.thumb-g{height:62px;background:linear-gradient(120deg,rgba(232,160,48,.18),rgba(180,80,20,.08));
  padding:10px 14px;display:flex;align-items:center;justify-content:flex-end;gap:0;position:relative;overflow:hidden}
.thumb-g .t-blur{font-size:calc(58px * var(--fscale));opacity:.18;filter:blur(16px)}
.thumb-g .tnum{position:static;background:none;color:rgba(245,208,128,.4);font-size:calc(10px * var(--fscale));margin-inline-end:auto}
.gico{width:40px;height:40px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:calc(22px * var(--fscale));
  box-shadow:0 4px 14px -2px rgba(90,58,40,.18)}
html.light,html.t-vintage{
  --char:#f2e8d5; --char2:#fff9f0; --char3:#f0e8da;
  --ember:#8a2a0a; --ember2:#c04a20;
  --ash:#7a4e2a; --bone:#2d0f0a; --smoke:#8a6a4a; --line:#c9a87e;
  --good:#4f7d33; --r:4px;
}
/* ruled-paper lines */
html.t-vintage body,html.light body{background-image:repeating-linear-gradient(0deg,transparent,transparent 28px,rgba(160,120,80,.12) 28px,rgba(160,120,80,.12) 29px)!important}
/* dark wine-red nav */
html.t-vintage .tools,html.light .tools{background:#2d0f0a!important;backdrop-filter:none}
html.t-vintage .brand,html.light .brand{font-family:'Frank Ruhl Libre',serif;color:#d4a96a}
html.t-vintage .brand span,html.light .brand span{color:#d4a96a}
html.t-vintage .navrow nav button,html.light .navrow nav button{border-radius:3px;font-family:'Frank Ruhl Libre',serif;border-color:#8a5a3a;color:#d4a96a;background:rgba(212,169,106,.08)}
html.t-vintage .navrow nav button:hover,html.light .navrow nav button:hover{background:rgba(212,169,106,.2);border-color:#d4a96a;color:#fff9f0}
html.t-vintage .navrow nav button.accent,html.light .navrow nav button.accent{background:#c9a87e;color:#2d0f0a;border-color:#c9a87e}
html.t-vintage .navrow nav button.navexit,html.light .navrow nav button.navexit{background:rgba(120,40,30,.15);border-color:#8a5a3a;color:#d4a96a}
/* search */
html.t-vintage .searchbar input,html.light .searchbar input{border-radius:3px;border-color:#c9a87e;background:#fff9f0;color:#2d0f0a}
html.t-vintage .searchbar input::placeholder,html.light .searchbar input::placeholder{color:#8a6a4a}
html.t-vintage .searchbar input:focus,html.light .searchbar input:focus{border-color:#8a2a0a;box-shadow:0 0 0 3px rgba(138,42,10,.12)}
/* chips */
html.t-vintage .chip,html.light .chip{border-radius:3px;font-family:'Frank Ruhl Libre',serif;border-color:#b0865a;color:#7a4e2a;background:none}
html.t-vintage .chip.on,html.light .chip.on{background:#2d0f0a;color:#d4a96a;border-color:#2d0f0a}
/* cards: cream, 4px corners, dashed-fold corner */
html.t-vintage .card,html.light .card{background:#fff9f0!important;border-color:#c9a87e!important;border-radius:4px;overflow:visible;position:relative;box-shadow:none!important}
html.t-vintage .card:hover,html.light .card:hover{box-shadow:0 4px 16px rgba(100,60,20,.18)!important}
html.t-vintage .card::after,html.light .card::after{display:none}
.fold-corner{position:absolute;top:0;right:0;width:22px;height:22px;z-index:5;pointer-events:none}
.fold-corner::before{content:'';position:absolute;inset:0;
  background:linear-gradient(225deg,#c9a87e 50%,transparent 50%)}
.fold-corner::after{content:'';position:absolute;inset:0;
  background:linear-gradient(225deg,transparent 48%,rgba(255,255,255,.55) 50%,transparent 52%)}
html.t-vintage .cbody h3,html.light .cbody h3{font-family:'Frank Ruhl Libre',serif;color:#2d0f0a;font-weight:700}
html.t-vintage .cbody .cat,html.light .cbody .cat{font-family:'Frank Ruhl Libre',serif;color:#6e3012!important}
html.t-vintage .cbody .en,html.light .cbody .en{color:#8a6a4a}
html.t-vintage .cbody .meta,html.light .cbody .meta{color:#8a6a4a}
html.t-vintage .cbody .meta b,html.light .cbody .meta b{color:#2d0f0a}
html.t-vintage .cbody .saved,html.light .cbody .saved{color:#4f7d33}
html.t-vintage .bld,html.light .bld{background:#2d0f0a;color:#d4a96a;border:none}
/* h1 + panels */
html.t-vintage h1,html.light h1{font-family:'Frank Ruhl Libre',serif;background:linear-gradient(180deg,#2d0f0a 0%,#8a3a1a 55%,var(--ember2) 130%);-webkit-background-clip:text;background-clip:text;color:transparent}
html.t-vintage .panel-top h2,html.light .panel-top h2{font-family:'Frank Ruhl Libre',serif}
html.t-vintage .glow,html.light .glow{background:radial-gradient(120% 80% at 50% -20%, rgba(138,42,10,.14), rgba(138,42,10,0) 60%)}
html.t-vintage .panel,html.light .panel{box-shadow:30px 0 80px -28px rgba(60,30,10,.35)}

/* ── Gold (dark premium) ───────────────────────────────────── */
html.t-gold{
  --char:#0a0500; --char2:#120900; --char3:#1c1200;
  --ember:#e8a030; --ember2:#f5d080;
  --ash:rgba(245,208,128,.7); --bone:#f5d080; --smoke:rgba(245,208,128,.42);
  --line:rgba(232,160,48,.2); --good:#70a850; --r:14px;
}
/* radial warm-black body */
html.t-gold body{background:radial-gradient(ellipse at 60% -10%,#3a1a00 0%,#0a0500 70%);background-attachment:fixed}
html.t-gold .glow{background:none}
/* brand gradient text */
html.t-gold .brand{background:linear-gradient(90deg,#e8a030,#f5d080,#e8a030);-webkit-background-clip:text;background-clip:text;color:transparent;font-family:var(--font-display),serif}
html.t-gold .brand span{background:inherit;-webkit-background-clip:text;background-clip:text;color:transparent}
/* nav chips amber */
html.t-gold .chip{border-color:rgba(232,160,48,.35);color:rgba(232,160,48,.75);background:rgba(232,160,48,.08)}
html.t-gold .chip.on{background:rgba(232,160,48,.2);border-color:rgba(232,160,48,.7);color:#f5d080}
html.t-gold .navrow nav button.accent{background:rgba(232,160,48,.14);border-color:rgba(232,160,48,.45);color:#f5d080}
/* search */
html.t-gold .searchbar input{background:rgba(232,160,48,.06);border-color:rgba(232,160,48,.22);color:#f5d080}
html.t-gold .searchbar input::placeholder{color:rgba(245,208,128,.3)}
html.t-gold .searchbar input:focus{border-color:rgba(232,160,48,.5);box-shadow:0 0 0 3px rgba(232,160,48,.12)}
/* cards: glassmorphism + amber border */
html.t-gold .card{background:rgba(255,255,255,.04)!important;backdrop-filter:blur(6px);border-color:rgba(232,160,48,.25)!important}
html.t-gold .card:hover{box-shadow:0 12px 32px -8px rgba(232,160,48,.3)!important;border-color:rgba(232,160,48,.5)!important}
html.t-gold .cbody h3{color:#f5d080}
html.t-gold .cbody .cat{color:var(--ember2)}
html.t-gold h1{background:linear-gradient(180deg,#fffae0 0%,#f5c850 50%,var(--ember) 130%);-webkit-background-clip:text;background-clip:text;color:transparent}
html.t-gold .panel{box-shadow:30px 0 80px -28px rgba(180,120,10,.3)}
html.t-gold ::selection{background:var(--ember);color:#0a0500}
html.t-gold .tools{background:linear-gradient(180deg,#0a0500 80%,rgba(10,5,0,0))}
*{box-sizing:border-box}
html,body{margin:0;padding:0;overflow-x:hidden;max-width:100%}
body{
  background:var(--char);
  color:var(--bone);
  font-family:var(--font-body),sans-serif;
  font-weight:400;
  -webkit-font-smoothing:antialiased;
  line-height:1.5;
}
body.noscroll{overflow:hidden}
a{color:inherit}
::selection{background:var(--ember);color:#fff}

/* ambient ember glow at top */
.glow{position:fixed;inset:0 0 auto 0;height:340px;pointer-events:none;z-index:0;
  background:radial-gradient(120% 80% at 50% -20%, rgba(232,92,28,.28), rgba(232,92,28,0) 60%);}

header.hero{position:relative;z-index:1;padding:46px 20px 22px;text-align:center;max-width:1180px;margin:0 auto}
.kick{font-family:var(--font-body);letter-spacing:.32em;font-size:calc(12px * var(--fscale));color:var(--ember2);font-weight:700;text-transform:uppercase}
h1{font-family:var(--font-display);font-weight:400;margin:.18em 0 .12em;font-size:clamp(40px,8vw,76px);line-height:.98;
  background:linear-gradient(180deg,#fff 0%,#ffd9b8 55%,var(--ember2) 130%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--ash);font-size:clamp(15px,2.4vw,18px);max-width:640px;margin:0 auto}
.sub b{color:var(--bone);font-weight:700}

/* search + tools */
.tools{position:sticky;top:0;z-index:20;background:linear-gradient(180deg,var(--char) 70%,rgba(22,17,13,.0));
  padding:14px 16px 10px;backdrop-filter:blur(2px)}
.tools-in{max-width:1180px;margin:0 auto}
.searchbar{position:relative}
.searchbar input{width:100%;padding:15px 48px 15px 16px;border-radius:var(--r);border:1px solid var(--line);
  background:var(--char2);color:var(--bone);font-family:'Assistant';font-size:calc(17px * var(--fscale));outline:none}
.searchbar input::placeholder{color:var(--smoke)}
.searchbar input:focus{border-color:var(--ember);box-shadow:0 0 0 3px rgba(232,92,28,.18)}
.searchbar .ic{position:absolute;inset-inline-end:16px;top:50%;transform:translateY(-50%);color:var(--ember2);font-size:calc(18px * var(--fscale))}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.catgroups{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.cgroup{background:var(--char2);border:2px solid var(--line2);border-radius:12px;padding:9px 13px;font-family:var(--font-body);font-weight:800;font-size:calc(13px * var(--fscale));color:var(--bone);cursor:pointer;white-space:nowrap;transition:.15s}
.cgroup b{font-weight:700;font-size:calc(11px * var(--fscale));opacity:.55;margin-inline-start:3px}
.cgroup:active{transform:scale(.96)}
.cgroup.on{background:var(--ember);border-color:var(--ember);color:#fff}
.cgroup.on b{opacity:.9}
/* category landing tiles */
.cat-hero{text-align:center;padding:8px 0 18px}
.cat-hero h3{font-family:var(--font-display);font-size:clamp(22px,6vw,30px);color:var(--bone);font-weight:400;margin:0}
.cat-hero h3 b{color:var(--ember)}
.cat-hero p{font-size:calc(13px * var(--fscale));color:var(--smoke);margin:6px 0 0}
.cat-tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 2px 20px}
.cattile{display:flex;flex-direction:column;align-items:flex-start;gap:3px;background:var(--char2);border:2px solid var(--line2);border-radius:18px;padding:18px 16px;cursor:pointer;transition:.15s;text-align:right}
.cattile:active{transform:scale(.97)}
.cattile:hover{border-color:var(--ember2)}
.cattile .ct-ic{font-size:calc(30px * var(--fscale));line-height:1;margin-bottom:6px}
.cattile .ct-name{font-family:var(--font-body);font-weight:800;font-size:calc(16px * var(--fscale));color:var(--bone)}
.cattile .ct-count{font-size:calc(11.5px * var(--fscale));color:var(--smoke)}
.cattile.tfav{background:linear-gradient(135deg,#fff5e6,var(--char2));border-color:var(--ember2)}
.cattile.tdict{background:var(--fresh-l);border-color:#b8e0d4}
.cattile.tdict .ct-ic,.cattile.tfav .ct-ic{filter:none}
.chip{border:1px solid var(--line);background:var(--char2);color:var(--ash);padding:7px 13px;border-radius:999px;
  font-size:calc(13.5px * var(--fscale));font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s;font-family:var(--font-body)}
.chip:hover{color:var(--bone);border-color:var(--smoke)}
.chip.on{background:var(--ember);border-color:var(--ember);color:#fff}
.count{color:var(--smoke);font-size:calc(13px * var(--fscale));margin:8px 2px 0;font-family:var(--font-body)}
.count-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.clearall{background:rgba(180,74,60,.12);border:1px solid rgba(180,74,60,.4);color:#e0928a;border-radius:999px;padding:6px 13px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));cursor:pointer;margin-top:8px;flex-shrink:0}
.clearall:hover{background:rgba(180,74,60,.22)}

/* quick nav */
.navrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}
.brand{font-family:var(--font-display);font-size:calc(22px * var(--fscale));color:var(--bone);white-space:nowrap;display:flex;align-items:baseline;gap:7px;letter-spacing:-.02em}
.brand b{font-weight:400;color:#3a2418;font-family:var(--font-display);text-shadow:0 1px 0 rgba(255,255,255,.5)}
.brand .brand-kicker{font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:800;color:var(--ember);letter-spacing:.03em}
.brand .brand-flame{font-size:calc(19px * var(--fscale));filter:drop-shadow(0 1px 3px rgba(231,111,81,.5))}
.brand span{color:var(--ember2)}
.navrow nav{display:flex;gap:6px}
.navrow nav button{border:1px solid var(--line);background:var(--char2);color:var(--ash);font-family:var(--font-body);font-weight:700;
  font-size:calc(13px * var(--fscale));padding:7px 12px;border-radius:999px;cursor:pointer;transition:.15s}
.navrow nav button:hover{color:var(--bone);border-color:var(--ember);background:var(--char3)}
.navrow nav button.accent{background:rgba(232,92,28,.16);border-color:rgba(232,92,28,.5);color:var(--ember2)}
.navrow nav button.navexit{background:rgba(176,74,85,.18);border-color:rgba(176,74,85,.55);color:#e58a93}
.navrow nav button.navexit:hover{background:rgba(176,74,85,.3)}
.navrow{flex-wrap:wrap}
.navrow nav{flex-wrap:wrap}
#makeChips{margin:0 0 14px}.section-h{scroll-margin-top:160px}

/* calculators */
.calcbox{background:linear-gradient(180deg,var(--char3),var(--char2));border:1px solid var(--line);border-radius:12px;
  padding:14px 15px;margin:14px 0}
.calcbox h4{font-family:var(--font-body);font-size:calc(12px * var(--fscale));letter-spacing:.1em;text-transform:uppercase;color:var(--ember2);margin:0 0 11px}
.calcrow{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.calcrow label{font-size:calc(14px * var(--fscale));color:var(--ash);min-width:96px;font-weight:600}
.calcrow input,.calcrow select{background:var(--char);border:1px solid var(--line);color:var(--bone);-webkit-text-fill-color:var(--bone);border-radius:8px;
  padding:9px 11px;font-family:var(--font-body);font-size:calc(15px * var(--fscale));outline:none;width:120px}
.calcrow input:focus,.calcrow select:focus{border-color:var(--ember)}
.calcrow select{width:auto;min-width:150px}
.calcrow .u{color:var(--smoke);font-size:calc(13px * var(--fscale));font-family:var(--font-body)}
.cl-note{opacity:.75;font-size:calc(11px * var(--fscale));font-style:italic}
.tl-alerts{width:100%;background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:11px;font-family:var(--font-body);font-weight:700;font-size:calc(13.5px * var(--fscale));color:var(--smoke);cursor:pointer;margin-bottom:8px}
.tl-alerts.on{background:var(--fresh-l);border-color:var(--fresh);color:var(--fresh)}
.calcout{display:grid;gap:7px;margin-top:4px}
.cl{display:flex;align-items:baseline;gap:8px;background:var(--char);border:1px solid var(--line);border-radius:8px;padding:9px 12px}
.cl span{color:var(--ash);font-size:calc(14px * var(--fscale));flex:1}
.cl b{font-family:var(--font-body);font-size:calc(18px * var(--fscale));color:var(--bone);font-variant-numeric:tabular-nums}
.cl small{color:var(--smoke);font-size:calc(12px * var(--fscale));font-family:var(--font-body)}
.calcnote{color:var(--ember2);font-size:calc(12.5px * var(--fscale));margin-top:9px;font-family:var(--font-body)}

/* materials list inside build */
.matlist{margin:6px 0 4px}
.matlist h4{font-family:var(--font-body);font-size:calc(12px * var(--fscale));letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px}
.matlist ul{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.matlist li{font-size:calc(14px * var(--fscale));background:var(--char2);border:1px solid var(--line);border-radius:8px;padding:8px 11px;
  position:relative;padding-inline-start:30px}
.matlist li::before{content:"▪";color:var(--ember2);position:absolute;inset-inline-start:12px}

main{max-width:1180px;margin:0 auto;padding:6px 16px 80px;position:relative;z-index:1}

/* cards grid */
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(248px,1fr))}
.card{background:linear-gradient(180deg,var(--char3),var(--char2));border:1px solid var(--line);border-radius:var(--r);
  padding:16px;cursor:pointer;position:relative;overflow:hidden;transition:.16s;display:flex;flex-direction:column;gap:10px}
.card:hover{transform:translateY(-3px);border-color:var(--ember);box-shadow:0 10px 30px -12px rgba(232,92,28,.45)}
.card .num{position:absolute;inset-inline-start:-6px;top:-14px;font-family:var(--font-display);font-size:calc(56px * var(--fscale));color:var(--ember);opacity:.06}
.card .cat{font-family:var(--font-body);font-size:calc(11px * var(--fscale));font-weight:700;letter-spacing:.12em;color:var(--ember2);text-transform:uppercase}
.card h3{margin:0;font-size:calc(21px * var(--fscale));font-weight:800;letter-spacing:-.01em}
.card .en{color:var(--smoke);font-size:calc(13px * var(--fscale));margin-top:-6px;font-family:var(--font-body)}
.card .meta{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:calc(12.5px * var(--fscale));color:var(--ash);font-family:var(--font-body);margin-top:auto}
.card .meta b{color:var(--bone);font-weight:700}
.dots{display:inline-flex;gap:3px;vertical-align:middle}
.dot{width:7px;height:7px;border-radius:50%;background:var(--line)}
.dot.f{background:var(--ember)}
.saved{display:inline-flex;align-items:center;gap:5px;background:rgba(116,166,87,.14);border:1px solid rgba(116,166,87,.4);
  color:var(--good);border-radius:999px;padding:2px 9px;font-size:calc(11.5px * var(--fscale));font-weight:700;font-family:var(--font-body)}
.bld{display:inline-block;margin-top:2px;background:rgba(232,92,28,.13);border:1px solid rgba(232,92,28,.4);
  color:var(--ember2);border-radius:999px;padding:2px 9px;font-size:calc(11px * var(--fscale));font-weight:700;font-family:var(--font-body)}

.section-h{font-family:var(--font-display);font-weight:400;font-size:calc(26px * var(--fscale));margin:42px 0 6px;display:flex;align-items:center;gap:12px}
.section-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--ember),transparent)}
.section-sub{color:var(--smoke);margin:0 0 16px;font-size:calc(14px * var(--fscale))}

/* glossary */
.gloss{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.gitem{background:var(--char2);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.gitem .gh{font-weight:800;font-size:calc(16px * var(--fscale))}
.gitem .ge{font-family:var(--font-body);font-size:calc(12px * var(--fscale));color:var(--ember2);margin-inline-start:8px;font-weight:500}
.gitem p{margin:5px 0 0;color:var(--ash);font-size:calc(14px * var(--fscale))}
.gitem .gg{font-family:var(--font-body);font-size:calc(10.5px * var(--fscale));letter-spacing:.1em;color:var(--smoke);text-transform:uppercase}

/* detail panel */
.scrim{position:fixed;inset:0;background:rgba(8,6,4,.72);backdrop-filter:blur(3px);z-index:40;opacity:0;pointer-events:none;transition:.2s}
.scrim.open{opacity:1;pointer-events:auto}
.panel{position:fixed;inset-block:0;inset-inline-start:0;width:min(680px,100%);background:var(--char);z-index:50;
  border-inline-start:1px solid var(--line);transform:translateX(-103%);transition:transform .26s cubic-bezier(.2,.7,.2,1);
  display:flex;flex-direction:column;box-shadow:30px 0 80px -20px rgba(90,58,40,.28)}
[dir=rtl] .panel{transform:translateX(103%)}
.panel.open{transform:translateX(0)}
.panel-top{padding:18px 22px 14px;padding-inline-end:150px;border-bottom:1px solid var(--line);position:relative}
.panel-top .cat{font-family:var(--font-body);font-size:calc(11px * var(--fscale));font-weight:700;letter-spacing:.14em;color:var(--ember2);text-transform:uppercase}
.panel-top h2{font-family:var(--font-display);font-weight:400;font-size:calc(34px * var(--fscale));margin:.1em 0 .05em;line-height:1}
.panel-top .en{color:var(--smoke);font-family:var(--font-body);font-size:calc(14px * var(--fscale))}
.x{position:absolute;top:14px;inset-inline-end:14px;inset-inline-start:auto;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);
  background:var(--char2);color:var(--bone);font-size:calc(20px * var(--fscale));cursor:pointer;line-height:36px;text-align:center;z-index:4}
.x:hover{border-color:var(--ember);color:var(--ember2)}
.panel-body{overflow-y:auto;padding:0 22px 40px;flex:1}

.statline{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 6px}
.stat{background:var(--char2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;min-width:84px;flex:1 0 auto}
.stat .l{font-family:var(--font-body);font-size:calc(10.5px * var(--fscale));color:var(--smoke);letter-spacing:.08em;text-transform:uppercase}
.stat .v{font-size:calc(17px * var(--fscale));font-weight:800;margin-top:2px}
.stat .v small{font-size:calc(12px * var(--fscale));color:var(--ash);font-weight:600}

.tabs{display:flex;gap:8px;margin:20px 0 4px}
.tab{flex:1;text-align:center;padding:11px;border-radius:10px;border:1px solid var(--line);background:var(--char2);
  font-weight:700;font-family:var(--font-body);font-size:calc(14px * var(--fscale));cursor:pointer;color:var(--ash)}
.tab.on{background:linear-gradient(180deg,var(--ember),#c44a14);border-color:var(--ember);color:#fff}

.method-note{font-size:calc(13.5px * var(--fscale));color:var(--ash);background:var(--char2);border:1px dashed var(--line);
  border-radius:10px;padding:10px 13px;margin:12px 0}

.ing{margin:16px 0 6px}
.ing h4,.steps h4,.var h4{font-family:var(--font-body);font-size:calc(12px * var(--fscale));letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px}
.ing ul{margin:0;padding:0;list-style:none;display:grid;gap:6px;grid-template-columns:1fr 1fr}
.ing li{font-size:calc(14.5px * var(--fscale));background:var(--char2);border:1px solid var(--line);border-radius:8px;padding:8px 11px}

/* steps with checklist + timers */
.step{display:flex;gap:12px;padding:13px 0;border-top:1px solid var(--line)}
.step:first-child{border-top:none}
.cbx{flex:0 0 auto;width:26px;height:26px;border-radius:8px;border:1.5px solid var(--smoke);background:transparent;cursor:pointer;
  margin-top:2px;display:grid;place-items:center;transition:.15s;color:transparent;font-size:calc(15px * var(--fscale))}
.cbx.done{background:var(--good);border-color:var(--good);color:#0e1a08}
.step-main{flex:1;min-width:0}
.step-t{font-weight:800;font-size:calc(16px * var(--fscale))}
.step.done .step-t{color:var(--smoke);text-decoration:line-through}
.step-c{font-size:calc(14.5px * var(--fscale));color:var(--ash);margin-top:3px}
.timer{margin-top:9px;display:inline-flex;align-items:center;gap:8px;background:var(--char2);border:1px solid var(--line);
  border-radius:999px;padding:5px 6px 5px 12px}
.timer .tt{font-family:var(--font-body);font-variant-numeric:tabular-nums;font-weight:700;font-size:calc(15px * var(--fscale));min-width:62px;text-align:center}
.timer button{border:none;border-radius:999px;width:30px;height:30px;cursor:pointer;font-size:calc(13px * var(--fscale));font-weight:700;
  background:var(--ember);color:#fff}
.timer button.rst{background:var(--char3);color:var(--ash);border:1px solid var(--line)}
.timer.ringing{border-color:var(--ember);animation:pulse 1s infinite}
@keyframes pulse{50%{box-shadow:0 0 0 4px rgba(232,92,28,.25)}}

.var{margin-top:8px}
.varitem{background:var(--char2);border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:8px}
.varitem .vt{font-weight:800;font-size:calc(15px * var(--fscale));color:var(--ember2)}
.varitem p{margin:4px 0 0;font-size:calc(14px * var(--fscale));color:var(--ash)}

.raw{margin-top:22px}
.raw table{width:100%;border-collapse:collapse;font-family:var(--font-body);font-size:calc(13px * var(--fscale))}
.raw td{padding:7px 10px;border-bottom:1px solid var(--line)}
.raw td:first-child{color:var(--smoke);width:42%}
.raw td:last-child{font-weight:600}

.progress{height:4px;background:var(--line);border-radius:99px;overflow:hidden;margin:14px 0 2px}
.progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ember),var(--ember2));transition:.3s}

footer{max-width:1180px;margin:0 auto;padding:20px 16px 60px;color:var(--smoke);font-size:calc(13px * var(--fscale));font-family:var(--font-body);text-align:center}
.footlink{display:inline-block;margin:0 5px 12px;color:var(--ember2);font-weight:700;font-size:calc(13px * var(--fscale));font-family:var(--font-body);text-decoration:none;background:transparent;cursor:pointer;border:1px solid var(--line);border-radius:999px;padding:8px 16px}
.footlink:hover{border-color:var(--ember);background:var(--char2)}
.footnote{color:var(--smoke);font-size:calc(12.5px * var(--fscale));line-height:1.6}
.empty{text-align:center;color:var(--smoke);padding:60px 0;font-size:calc(16px * var(--fscale))}

/* add-to-list button on cards */
.card{padding:0;gap:0}
.thumb{position:relative;height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden;
  background:linear-gradient(180deg,var(--char3),var(--char2))}
.t-blur{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:calc(90px * var(--fscale));line-height:1;opacity:.28;filter:blur(22px);pointer-events:none;user-select:none}
.t-circle{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:calc(30px * var(--fscale));position:relative;z-index:1;
  box-shadow:0 0 0 7px rgba(231,111,81,.08),0 6px 22px -4px rgba(90,58,40,.2)}
.tnum{position:absolute;bottom:7px;inset-inline-start:9px;font-family:var(--font-body);font-size:calc(11px * var(--fscale));font-weight:700;
  color:rgba(255,255,255,.92);background:rgba(0,0,0,.3);padding:1px 8px;border-radius:999px;z-index:1}
.cbody{padding:13px 15px 15px;display:flex;flex-direction:column;gap:9px}
.addbtn{position:absolute;top:9px;inset-inline-end:9px;width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.35);
  background:rgba(0,0,0,.28);color:#fff;font-size:calc(17px * var(--fscale));line-height:26px;cursor:pointer;z-index:3;transition:.15s;padding:0;backdrop-filter:blur(2px)}
.addbtn:hover{background:var(--ember);border-color:var(--ember)}
.addbtn.in{background:var(--good);border-color:var(--good)}

/* theme button */
#themeBtn{font-size:calc(15px * var(--fscale))}
.ap-lbl{font-size:calc(11px * var(--fscale));font-weight:800;color:var(--smoke);letter-spacing:.06em;text-transform:uppercase;margin:18px 2px 8px;font-family:var(--font-body)}
.ap-lbl:first-child{margin-top:4px}
.ap-opts{display:flex;gap:7px;flex-wrap:wrap}
.ap-opt{border:1.5px solid var(--line2);background:var(--char2);border-radius:11px;padding:8px 13px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));color:var(--bone);cursor:pointer;display:flex;align-items:center;gap:8px}
.ap-opt.on{border-color:var(--fresh);background:var(--fresh-l);color:var(--fresh)}
.ap-sw{display:inline-flex;border-radius:5px;overflow:hidden}
.ap-sw i{width:9px;height:15px;display:block}
.ap-note{font-size:calc(12px * var(--fscale));color:var(--fresh);background:var(--fresh-l);border-radius:11px;padding:9px 12px;margin-top:16px}
.ap-preview{margin-top:14px;background:var(--char2);border:1.5px solid var(--line2);border-radius:14px;padding:14px}
.ap-pt{font-family:var(--font-display);font-size:calc(19px * var(--fscale));color:var(--bone);margin-bottom:4px}
.ap-pb{font-size:calc(12.5px * var(--fscale));color:var(--smoke)}

/* panel header art */
.panel-top{position:relative;overflow:hidden}
.panel-top::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:var(--c,var(--ember));z-index:2}
.phead-ico{position:absolute;top:-10px;inset-inline-start:-12px;opacity:.10;pointer-events:none;z-index:0}
.phead-ico svg{width:120px;height:120px;color:var(--c,var(--ember))}
.panel-top .cat,.panel-top h2,.panel-top .en{position:relative;z-index:1}

/* print + cart buttons in panel head */
.prbtn{position:absolute;top:16px;inset-inline-end:60px;inset-inline-start:auto;height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--line);
  background:var(--char2);color:var(--ash);font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));cursor:pointer;z-index:4}
.prbtn:hover{border-color:var(--ember);color:var(--ember2)}
.backbtn{position:relative;z-index:3;display:inline-flex;align-items:center;gap:5px;margin-top:12px;background:var(--char2);border:1px solid var(--line);color:var(--ember2);font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));border-radius:999px;padding:8px 15px;cursor:pointer}
.backbtn:hover{border-color:var(--ember);background:var(--char3)}

/* shopping list */
.shop-items{display:grid;gap:8px;margin:14px 0}
.shop-item{display:flex;align-items:center;gap:10px;background:var(--char2);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.shop-item .si-cat{font-family:var(--font-body);font-size:calc(10.5px * var(--fscale));color:var(--ember2);letter-spacing:.08em;text-transform:uppercase}
.shop-item h5{margin:0;font-size:calc(15px * var(--fscale));font-weight:800}
.shop-item .rm{margin-inline-start:auto;border:none;background:transparent;color:var(--smoke);font-size:calc(20px * var(--fscale));cursor:pointer}
.shop-item .rm:hover{color:var(--ember)}
.shop-group{margin-top:16px}
.shop-toggle{display:flex;gap:8px;margin-top:6px}
.shop-toggle button{flex:1;background:var(--char);border:1.5px solid var(--line2);border-radius:10px;padding:9px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));color:var(--smoke);cursor:pointer}
.shop-toggle button.on{border-color:var(--ember);color:var(--ember);background:#fff2e6}
.cwd-sub{margin-bottom:12px}
.cwd-lbl{font-family:var(--font-body);font-weight:800;font-size:calc(12.5px * var(--fscale));color:var(--smoke);margin-bottom:6px}
.coallist{display:flex;flex-direction:column;gap:10px}
.coalcard{background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:12px}
.coalhead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.coalhead b{font-family:var(--font-body);font-size:calc(15px * var(--fscale));color:var(--bone)}
.coaleng{font-size:calc(11px * var(--fscale));color:var(--smoke)}
.coalmeta{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0;font-size:calc(11.5px * var(--fscale));color:var(--smoke)}
.coalbest{font-size:calc(12.5px * var(--fscale));color:var(--bone)}
.coalbuy{font-size:calc(12px * var(--fscale));color:var(--fresh);font-weight:700;margin-top:5px}
.chome-about{display:flex;flex-direction:column;gap:2px;align-items:center;text-align:center;width:calc(100% - 32px);margin:18px 16px 4px;padding:14px;background:linear-gradient(180deg,#fff6ec,#fdeede);border:1.5px solid var(--line2);border-radius:16px;cursor:pointer;font-family:var(--font-body)}
.chome-about span:first-child{font-weight:800;font-size:calc(15px * var(--fscale));color:var(--bone)}
.chome-about .cha-sub{font-size:calc(11.5px * var(--fscale));color:var(--smoke)}
.chome-ask{display:flex;align-items:center;gap:12px;width:calc(100% - 32px);margin:2px 16px 16px;padding:14px 16px;background:linear-gradient(135deg,#e76f51,#f4a261);border:none;border-radius:16px;cursor:pointer;box-shadow:0 5px 16px rgba(231,111,81,.28)}
.chome-ask .cha-ico{font-size:calc(26px * var(--fscale));filter:drop-shadow(0 1px 2px rgba(0,0,0,.2))}
.chome-ask .cha-txt{flex:1;text-align:start;display:flex;flex-direction:column;gap:1px}
.chome-ask .cha-txt b{font-family:var(--font-body);font-weight:800;font-size:calc(15.5px * var(--fscale));color:#fff}
.chome-ask .cha-txt small{font-size:calc(11px * var(--fscale));color:rgba(255,255,255,.9)}
.chome-ask .cha-go{font-size:calc(20px * var(--fscale));color:#fff}
.guide-intro{font-size:calc(14px * var(--fscale));color:var(--bone);line-height:1.6;margin-bottom:14px}
.guide-sec{margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--line2)}
.guide-sec h4{font-family:var(--font-body);font-weight:800;font-size:calc(15px * var(--fscale));color:var(--ember);margin:0 0 5px}
.guide-body{font-size:calc(13px * var(--fscale));color:var(--bone);line-height:1.6}
.guide-foot{font-size:calc(12.5px * var(--fscale));color:var(--smoke);background:var(--char2);border-radius:10px;padding:11px;margin-top:8px}
.guide-about-link{display:block;text-align:center;text-decoration:none;width:100%;margin-top:14px;padding:13px;background:var(--bone);color:#fff;border:none;border-radius:12px;font-family:var(--font-body);font-weight:700;font-size:calc(13.5px * var(--fscale));cursor:pointer;box-sizing:border-box}
.ab-thesis{font-size:calc(14.5px * var(--fscale));line-height:1.6;color:var(--bone);margin:0 0 16px}
.ab-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
.ab-stat{background:linear-gradient(180deg,#fff6ec,#fdeede);border:1.5px solid var(--line2);border-radius:12px;padding:12px 4px;text-align:center}
.ab-n{font-family:var(--font-display);font-size:calc(24px * var(--fscale));color:var(--ember);line-height:1}
.ab-l{font-size:calc(10px * var(--fscale));color:var(--smoke);margin-top:3px;font-weight:600}
.ab-h{font-family:var(--font-display);font-weight:400;font-size:calc(18px * var(--fscale));color:var(--bone);margin:18px 0 7px}
.ab-p{font-size:calc(13px * var(--fscale));line-height:1.6;color:var(--bone);margin:0 0 6px}
.ab-feat{display:flex;gap:11px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line2)}
.ab-fico{font-size:calc(24px * var(--fscale));flex-shrink:0;width:30px;text-align:center}
.ab-feat h4{font-family:var(--font-body);font-weight:800;font-size:calc(14px * var(--fscale));color:var(--bone);margin:0 0 3px}
.ab-feat p{font-size:calc(12.5px * var(--fscale));line-height:1.55;color:var(--smoke);margin:0}
.ab-foot{text-align:center;font-size:calc(12px * var(--fscale));color:var(--smoke);margin-top:18px;padding-top:12px;border-top:1px solid var(--line2)}
.ab-eyebrow{font-family:var(--font-body);font-weight:800;font-size:calc(10.5px * var(--fscale));letter-spacing:.14em;color:var(--ember2);margin:22px 0 2px}
.ab-cats{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 16px}
.ab-cat{font-size:calc(11px * var(--fscale));font-weight:700;color:var(--bone);background:var(--char2);border:1.5px solid var(--line2);border-radius:999px;padding:4px 10px}
.ab-tools{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0 6px}
.ab-tool{background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:11px}
.ab-tico{font-size:calc(20px * var(--fscale));margin-bottom:3px}
.ab-tool h5{font-family:var(--font-body);font-weight:800;font-size:calc(12.5px * var(--fscale));color:var(--bone);margin:0 0 2px}
.ab-tool p{font-size:calc(11px * var(--fscale));line-height:1.45;color:var(--smoke);margin:0}
.ab-facts{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0}
.ab-fact{background:linear-gradient(180deg,#fff6ec,#fdeede);border:1.5px solid var(--line2);border-radius:12px;padding:12px}
.ab-fv{font-family:var(--font-display);font-size:calc(22px * var(--fscale));color:var(--ember);line-height:1}
.ab-fv small{font-size:calc(12px * var(--fscale))}
.ab-fk{font-family:var(--font-body);font-weight:800;font-size:calc(12.5px * var(--fscale));color:var(--bone);margin:4px 0 2px}
.ab-fd{font-size:calc(11px * var(--fscale));color:var(--smoke);line-height:1.45}
.ab-road{display:flex;flex-direction:column;gap:9px;margin:12px 0}
.ab-step{background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:12px;font-size:calc(12.5px * var(--fscale));line-height:1.5;color:var(--bone)}
.ab-step.now{border-color:var(--ember);background:#fff2e6}
.ab-ph{display:inline-block;font-family:var(--font-body);font-weight:800;font-size:calc(10px * var(--fscale));letter-spacing:.1em;color:var(--ember);background:#fff;border-radius:999px;padding:2px 9px;margin-inline-end:8px}
.ab-credits{text-align:center;margin-top:24px;padding:20px 14px;background:var(--char2);border:1.5px solid var(--line2);border-radius:16px}
.ab-mk{font-family:var(--font-display);font-size:calc(22px * var(--fscale));color:var(--bone)}
.ab-mk span{color:var(--ember)}
.ab-credits>p{font-size:calc(12.5px * var(--fscale));color:var(--smoke);margin:6px 0 0;line-height:1.5}
.ab-by{font-size:calc(13px * var(--fscale));color:var(--bone);margin-top:14px;line-height:1.7}
.ab-by a{color:var(--ember);font-weight:700;text-decoration:none}
.ab-ver{font-size:calc(11px * var(--fscale));color:var(--smoke);margin-top:12px}
.shop-group h4{font-family:var(--font-body);font-size:calc(12px * var(--fscale));letter-spacing:.1em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px;
  display:flex;align-items:center;gap:8px}
.shop-group h4::after{content:"";flex:1;height:1px;background:var(--line)}
.shop-line.have{opacity:.6}
.cbx-have{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:var(--fresh-l);color:var(--good);font-size:calc(12px * var(--fscale));flex-shrink:0}
.shop-line{display:flex;align-items:flex-start;gap:11px;padding:9px 0;border-bottom:1px solid var(--line);font-size:calc(14.5px * var(--fscale))}
.shop-line .cbx{width:22px;height:22px;border-radius:6px;font-size:calc(13px * var(--fscale))}
.shop-line.done span:last-child{color:var(--smoke);text-decoration:line-through}
.shop-empty{text-align:center;color:var(--smoke);padding:40px 0}

/* ---- product feature UI ---- */
.favstar{position:absolute;top:9px;inset-inline-end:46px;width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.35);
  background:rgba(0,0,0,.28);color:#ffd66e;font-size:calc(16px * var(--fscale));line-height:26px;cursor:pointer;z-index:3;padding:0;backdrop-filter:blur(2px)}
.favstar.on{background:rgba(0,0,0,.4);color:#ffcf3f}
.favstar:hover{border-color:#ffcf3f}
.addcart{position:absolute;top:9px;inset-inline-start:9px;min-width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.4);
  background:rgba(0,0,0,.32);color:#fff;font-size:calc(17px * var(--fscale));line-height:32px;cursor:pointer;z-index:3;padding:0 6px;backdrop-filter:blur(2px)}
.addcart.on{background:var(--fresh);color:#fff;border-color:var(--fresh)}
.addcart:hover{border-color:var(--fresh)}
.exaddmenu{display:block;width:100%;min-height:44px;margin-bottom:10px;padding:11px;border-radius:10px;font-weight:700;font-size:calc(14px * var(--fscale));background:var(--fresh-l);color:var(--fresh);border:1px solid var(--fresh);cursor:pointer}
.exaddmenu.on{background:var(--fresh);color:#fff}
:focus-visible{outline:2px solid var(--ember)!important;outline-offset:2px}
.tt-alert{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ktag{display:inline-block;font-family:var(--font-body);font-size:calc(9.5px * var(--fscale));font-weight:700;padding:1px 6px;border-radius:999px;vertical-align:middle;margin-inline-start:4px}
.ktag.kp{background:rgba(200,60,40,.16);color:#e07a5f;border:1px solid rgba(200,60,40,.4)}
.ktag.kd{background:rgba(80,140,200,.16);color:#7fb0d8;border:1px solid rgba(80,140,200,.4)}
.gtag{display:inline-block;font-family:var(--font-body);font-size:calc(9.5px * var(--fscale));font-weight:700;padding:1px 6px;border-radius:999px;vertical-align:middle;margin-inline-start:4px;background:rgba(201,138,26,.16);color:#c98a1a;border:1px solid rgba(201,138,26,.4)}
.rmini{color:#ffcf3f;font-size:calc(11px * var(--fscale));margin-inline-start:6px;letter-spacing:1px}
.filterbar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.filterbar select{background:var(--char2);border:1px solid var(--line);color:var(--bone);border-radius:999px;padding:7px 12px;font-family:var(--font-body);font-size:calc(13px * var(--fscale));cursor:pointer}
.fchip{background:var(--char2);border:1px solid var(--line);color:var(--ash);border-radius:999px;padding:7px 14px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));cursor:pointer}
.fchip.on{background:rgba(116,166,87,.18);border-color:var(--good);color:var(--good)}
.navrow nav button.accent.on,#favBtn.on{background:rgba(255,207,63,.18);border-color:#ffcf3f;color:#ffcf3f}

.exbox{background:linear-gradient(180deg,var(--char3),var(--char2));border:1px solid var(--line);border-radius:12px;padding:13px;margin:14px 0}
.exrow{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.exfav{background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:999px;padding:8px 14px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));cursor:pointer}
.exfav.on{background:rgba(255,207,63,.16);border-color:#ffcf3f;color:#e0a92f}
.exrate .star{color:var(--line);font-size:calc(22px * var(--fscale));cursor:pointer;transition:.1s}
.exrate .star.on{color:#ffcf3f}
.exrate .star:hover{transform:scale(1.15)}
.kbox{margin-top:10px;font-size:calc(13px * var(--fscale));border-radius:9px;padding:9px 12px;line-height:1.5}
.kbox.k-ok{background:rgba(116,166,87,.12);border:1px solid rgba(116,166,87,.35);color:var(--good)}
.kbox.k-pork{background:rgba(200,60,40,.1);border:1px solid rgba(200,60,40,.35);color:var(--bone)}
.kbox.k-dairy{background:rgba(80,140,200,.1);border:1px solid rgba(80,140,200,.35);color:var(--bone)}
.kbox.k-danger{background:rgba(180,60,50,.14);border:1px solid rgba(180,60,50,.5);color:#e5a09a}
.exactions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.exactions button,.toolbtn,.ask-mode{display:flex;gap:6px;margin-bottom:10px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:4px}
.ask-modebtn{flex:1;background:none;border:none;border-radius:9px;padding:9px;font-family:var(--font-body);font-weight:800;font-size:calc(13px * var(--fscale));color:var(--smoke);cursor:pointer}
.ask-modebtn.on{background:var(--char2);color:var(--ember);box-shadow:0 1px 4px rgba(210,105,30,.12)}
.ask-lock{font-size:calc(10px * var(--fscale))}
.ask-hint{font-size:calc(12px * var(--fscale));color:var(--smoke);margin-top:12px;line-height:1.5;background:var(--char2);border-radius:10px;padding:10px}
.ask-link{background:none;border:none;color:var(--ember);font-weight:700;cursor:pointer;font-size:calc(12px * var(--fscale));text-decoration:underline;padding:0}
.ask-src{display:inline-block;font-size:calc(10px * var(--fscale));font-weight:800;border-radius:999px;padding:2px 7px;margin-inline-end:7px;vertical-align:middle}
.ask-src.ai{background:#e7ecff;color:#3550c7}
.ask-src.loc{background:var(--fresh-l);color:var(--fresh)}
.ask-loading .ask-dots{color:var(--smoke)}
.ask-dots b{animation:askblink 1.4s infinite both}
.ask-dots b:nth-child(2){animation-delay:.2s}
.ask-dots b:nth-child(3){animation-delay:.4s}
@keyframes askblink{0%,80%,100%{opacity:.2}40%{opacity:1}}
.ask-aifail{background:#fff3e6;border:1px solid var(--ember2);font-size:calc(12.5px * var(--fscale));color:var(--terra-d)}
.askthread{display:flex;flex-direction:column;gap:10px;max-height:46vh;overflow-y:auto;margin-bottom:10px}
.askthread:empty{display:none}
.ask-q{align-self:flex-start;background:var(--ember);color:#fff;border-radius:14px 14px 14px 4px;padding:9px 13px;font-size:calc(13.5px * var(--fscale));font-weight:600;max-width:85%;line-height:1.4}
.ask-a{align-self:flex-end;width:100%}
.askclear{background:var(--char2);border:1.5px solid var(--line2);border-radius:10px;padding:0 12px;font-size:calc(15px * var(--fscale));cursor:pointer;color:var(--smoke)}
.akc-step{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}
.akc-n{flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--ember);color:#fff;font-family:var(--font-body);font-weight:800;font-size:calc(14px * var(--fscale));display:flex;align-items:center;justify-content:center}
.akc-step b{font-family:var(--font-body);font-size:calc(14.5px * var(--fscale));color:var(--bone)}
.akc-step p{font-size:calc(12.5px * var(--fscale));color:var(--smoke);margin:2px 0 8px;line-height:1.5}
.akc-open{display:inline-block;background:var(--bone);color:#fff;text-decoration:none;border-radius:10px;padding:10px 16px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale))}
.akc-keyrow{display:flex;gap:8px;margin-top:6px}
.akc-keyrow input{flex:1;border:1.5px solid var(--line2);border-radius:10px;padding:11px;font-family:var(--font-body);font-size:calc(14px * var(--fscale));background:var(--char2);color:var(--bone)}
.akc-keyrow button{background:var(--ember);color:#fff;border:none;border-radius:10px;padding:0 20px;font-family:var(--font-body);font-weight:800;cursor:pointer}
.akc-msg{font-size:calc(12.5px * var(--fscale));margin-top:8px;min-height:18px;color:var(--smoke)}
.akc-msg.ok{color:var(--good);font-weight:700}
.akc-msg.err{color:var(--terra-d);font-weight:700}
.akc-note{font-size:calc(12px * var(--fscale));color:var(--smoke);line-height:1.6;background:var(--char2);border-radius:10px;padding:12px;margin-top:8px}
.akc-back{width:100%;background:none;border:1.5px solid var(--line2);border-radius:12px;padding:12px;font-family:var(--font-body);font-weight:700;color:var(--smoke);cursor:pointer;margin-top:14px}
.akm-status{display:flex;align-items:center;gap:12px;background:var(--fresh-l);border:1.5px solid var(--fresh);border-radius:14px;padding:14px;margin-bottom:12px}
.akm-status b{font-family:var(--font-body);font-size:calc(15px * var(--fscale));color:var(--fresh)}
.akm-status p{font-size:calc(12px * var(--fscale));color:var(--bone);margin-top:2px}
.akm-status code{background:var(--char2);padding:1px 6px;border-radius:6px;font-size:calc(11px * var(--fscale))}
.akm-dot{width:11px;height:11px;border-radius:50%;background:var(--fresh);box-shadow:0 0 0 4px rgba(26,154,122,.18);flex-shrink:0}
.akm-btn{width:100%;background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:13px;font-family:var(--font-body);font-weight:700;font-size:calc(14px * var(--fscale));color:var(--bone);cursor:pointer;margin-bottom:9px;text-align:start}
.akm-danger{color:var(--terra-d);border-color:#e8c0a8}
.askex{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.askex-chip{background:var(--char2);border:1.5px solid var(--line2);border-radius:999px;padding:7px 12px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:600;color:var(--bone);cursor:pointer}
.askchips{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.askhit-act{background:var(--ember);color:#fff;border-color:var(--ember)}
.askhit{font-family:var(--font-body);font-weight:700;cursor:pointer}
.exactions button{background:var(--char);border:1px solid var(--line);color:var(--ash);border-radius:9px;padding:8px 12px;font-size:calc(13px * var(--fscale))}
.exactions button:hover{border-color:var(--ember);color:var(--ember2)}
.exbtn-lbl{display:inline-block;background:var(--char);border:1px solid var(--line);color:var(--ash);border-radius:9px;padding:8px 12px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));cursor:pointer}
.exbtn-lbl:hover{border-color:var(--ember);color:var(--ember2)}
.exnotes{margin-top:12px}
.exnotes label{display:block;font-family:var(--font-body);font-size:calc(11px * var(--fscale));letter-spacing:.08em;text-transform:uppercase;color:var(--ember2);margin-bottom:5px}
.exnotes textarea,.miniform input,.miniform select{width:100%;background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:9px;padding:9px 11px;font-family:var(--font-body);font-size:calc(14px * var(--fscale));outline:none}
.exnotes textarea{min-height:60px;resize:vertical}
.exnotes textarea:focus,.miniform input:focus{border-color:var(--ember)}
.miniform{background:var(--char);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:11px}
.miniform h4{margin:0 0 9px;font-family:var(--font-body);font-size:calc(13px * var(--fscale));color:var(--ember2)}
.miniform label{display:block;font-size:calc(12px * var(--fscale));color:var(--ash);margin-bottom:9px}
.miniform input,.miniform select{margin-top:3px}
.mf-actions{display:flex;gap:8px;margin-top:6px}
.mf-actions button,.miniform .okmsg button{background:var(--ember);border:none;color:#fff;border-radius:8px;padding:9px 14px;font-family:var(--font-body);font-weight:700;cursor:pointer}
.mf-actions button.ghost{background:transparent;border:1px solid var(--line);color:var(--ash)}
.okmsg{color:var(--good);font-size:calc(14px * var(--fscale));padding:8px 0}
.linklike{background:none;border:none;color:var(--ember2);cursor:pointer;font-weight:700;text-decoration:underline}
.butchernote{background:var(--char2);border:1px dashed var(--line);border-radius:9px;padding:11px;margin:8px 0;font-size:calc(14px * var(--fscale));line-height:1.6}

.toolgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.toolbtn{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--char2);border:1px solid var(--line);color:var(--bone);border-radius:12px;padding:16px 10px;font-size:calc(13px * var(--fscale));text-align:center}
.toolbtn span{font-size:calc(26px * var(--fscale))}
.toolbtn:hover{border-color:var(--ember);background:var(--char3)}

.pcard{background:var(--char2);border:1px solid var(--line);border-radius:11px;padding:12px;margin-bottom:10px}
.pc-top{display:flex;align-items:center;gap:8px}
.pc-top b{flex:1;font-size:calc(15px * var(--fscale))}
.pc-day{font-family:var(--font-body);font-size:calc(11px * var(--fscale));color:var(--ember2)}
.pc-rm{background:none;border:none;color:var(--smoke);font-size:calc(20px * var(--fscale));cursor:pointer}
.pc-meta{font-size:calc(12px * var(--fscale));color:var(--smoke);margin:4px 0 8px}
.pbar{height:7px;background:var(--char);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.pbar i{display:block;height:100%;transition:width .3s}
.pc-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:calc(13px * var(--fscale));margin-top:9px}
.pc-row input{width:90px;background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:7px;padding:6px 8px}

.jcard{display:flex;gap:10px;align-items:center;background:var(--char2);border:1px solid var(--line);border-radius:11px;padding:10px;margin-bottom:9px}
.jcard img{width:54px;height:54px;object-fit:cover;border-radius:8px}
.jc-main{flex:1}
.jc-top{display:flex;justify-content:space-between;font-size:calc(14px * var(--fscale))}
.jc-top b{font-weight:800}.jc-top span{color:var(--smoke);font-size:calc(12px * var(--fscale))}
.jc-temp{font-size:calc(12.5px * var(--fscale));color:var(--ash);margin-top:2px}

.ctlist{display:flex;flex-direction:column;gap:2px}
.ctrow{padding:9px 0;border-bottom:1px solid var(--line)}
.ctrow b{font-size:calc(14.5px * var(--fscale))}.ct-en{color:var(--smoke);font-size:calc(12px * var(--fscale))}
.ct-il{color:var(--ember2);font-size:calc(13px * var(--fscale));margin-top:2px}
.ct-note{color:var(--ash);font-size:calc(12.5px * var(--fscale));margin-top:2px}
.mini-h{font-family:var(--font-body);font-size:calc(12px * var(--fscale));letter-spacing:.1em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px}

.acc{border-bottom:1px solid var(--line)}
.trouble-search{display:flex;align-items:center;gap:8px;background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:2px 12px;margin-bottom:4px}
.trouble-search .ic{color:var(--smoke)}
.trouble-search input{flex:1;border:none;background:none;padding:11px 4px;font-family:var(--font-body);font-size:calc(14px * var(--fscale));color:var(--bone);outline:none}
.trouble-grp{margin-bottom:9px}
.tg-head{width:100%;display:flex;justify-content:space-between;align-items:center;background:var(--char2);border:1.5px solid var(--line2);border-radius:12px;padding:13px 14px;font-family:var(--font-body);font-weight:800;font-size:calc(14.5px * var(--fscale));color:var(--bone);cursor:pointer}
.tg-n{font-size:calc(12px * var(--fscale));color:var(--smoke);font-weight:600;display:flex;align-items:center;gap:6px}
.tg-chev{color:var(--ember)}
.tg-body{padding:8px 4px 2px}
.tg-tag{font-size:calc(13px * var(--fscale))}
.acc-q{width:100%;text-align:start;background:none;border:none;color:var(--bone);font-family:'Assistant',sans-serif;font-weight:700;font-size:calc(14.5px * var(--fscale));padding:13px 0;cursor:pointer;display:flex;justify-content:space-between;gap:10px}
.acc-q span{color:var(--ember2)}
.acc-a{max-height:0;overflow:hidden;transition:max-height .25s;color:var(--ash);font-size:calc(13.5px * var(--fscale));line-height:1.6}
.acc-a{padding-bottom:0}.acc-q+.acc-a{margin-bottom:2px}

.askrow{display:flex;gap:8px;margin-top:14px}
.askrow input{flex:1;background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:10px;padding:11px 13px;font-family:var(--font-body);font-size:calc(15px * var(--fscale));outline:none}
.askrow input:focus{border-color:var(--ember)}
.askrow button{background:var(--ember);border:none;color:#fff;border-radius:10px;padding:0 18px;font-family:var(--font-body);font-weight:700;cursor:pointer}
.askout{margin-top:14px;display:flex;flex-direction:column;gap:8px}
.abubble{background:var(--char2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:calc(14.5px * var(--fscale));line-height:1.6}
.askhit{background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:9px;padding:9px 13px;text-align:start;cursor:pointer}
.askhit:hover{border-color:var(--ember);color:var(--ember2)}

/* toast + undo */
.toast{position:fixed;inset-inline:0;bottom:22px;margin-inline:auto;width:max-content;max-width:90%;z-index:90;
  display:flex;align-items:center;gap:14px;background:#5a3a28;border:1px solid #6e4a34;color:#fffaf3;
  border-radius:12px;padding:11px 16px;font-family:var(--font-body);font-size:calc(14px * var(--fscale));box-shadow:0 12px 30px -10px rgba(90,58,40,.4);
  opacity:0;transform:translateY(12px);pointer-events:none;transition:.22s}
.toast.show{opacity:1;transform:translateY(0);pointer-events:auto}
.toast button{background:none;border:none;color:var(--ember2);font-family:var(--font-body);font-weight:800;font-size:calc(14px * var(--fscale));cursor:pointer}
/* timeline rows */
.tlrow{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)}
.tlrow .tl-t{min-width:74px;font-size:calc(15px * var(--fscale))}
.tlrow .tl-n{flex:1}
.tlrow .tl-lead{display:flex;align-items:center;gap:4px;color:var(--smoke);font-size:calc(13px * var(--fscale))}
.tlrow .tl-lead input{width:58px;background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:7px;padding:5px 7px;font-size:calc(13px * var(--fscale));text-align:center}
.tlrow.tl-serve{border:none}.tlrow.tl-serve .tl-t b{color:var(--ember2)}
/* doneness selector */
.dn-wrap{margin:4px 0 6px}
.dn-head{font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:700;color:var(--ash);margin-bottom:7px}
.dn-head small{display:block;font-weight:400;color:var(--smoke);font-size:calc(11px * var(--fscale));margin-top:2px}
.dn-btns{display:flex;gap:6px;flex-wrap:wrap}
.dn-btn{flex:1;min-width:64px;display:flex;flex-direction:column;align-items:center;gap:2px;
  background:var(--char2);border:1px solid var(--line);color:var(--ash);border-radius:10px;
  padding:8px 6px;cursor:pointer;font-family:var(--font-body);transition:.14s}
.dn-btn:hover{border-color:var(--ember)}
.dn-btn.on{background:rgba(232,92,28,.16);border-color:var(--ember);color:var(--ember2)}
.dn-btn .dn-l{font-size:calc(11.5px * var(--fscale));font-weight:700}
.dn-btn .dn-c{font-size:calc(15px * var(--fscale));font-weight:800}
.dn-reset{margin-top:8px;background:none;border:none;color:var(--smoke);font-family:var(--font-body);font-size:calc(12px * var(--fscale));cursor:pointer;text-decoration:underline}
.dn-reset:hover{color:var(--ember2)}
.mreset{background:rgba(180,74,60,.12)!important;border:1px solid rgba(180,74,60,.4)!important;color:#e0928a!important;border-radius:999px;padding:7px 12px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));cursor:pointer}
.mreset:hover{background:rgba(180,74,60,.22)!important}
.seasoning-box h4{margin:0 0 10px}
.seasoning-chips{display:flex;flex-wrap:wrap;gap:8px}
/* ── unified seasoning picker (spk) ── */
.spk-box h4{margin:0 0 8px}
.spk-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:4px 0 7px}
.spk-tab{border:1.5px solid var(--line2);background:var(--char2);color:var(--bone);border-radius:999px;padding:5px 11px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:800;cursor:pointer}
.spk-tab.on{background:var(--ember);border-color:var(--ember);color:#fff}
.spk-vals{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 8px}
.spk-val{border:1px solid var(--line2);background:var(--char2);color:var(--smoke);border-radius:8px;padding:4px 9px;font-family:var(--font-body);font-size:calc(11.5px * var(--fscale));font-weight:700;cursor:pointer}
.spk-val.on{background:var(--fresh-l);border-color:var(--fresh);color:var(--fresh)}
.spk-kind{margin:9px 0 2px;padding-top:7px;border-top:1px dashed var(--line2)}
.spk-kh{font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));font-weight:800;color:var(--ember);margin-bottom:6px}
.spk-cur{color:var(--fresh);font-weight:800}
.spk-chips{display:flex;flex-wrap:wrap;gap:6px}
.spk-chip{display:inline-flex;align-items:stretch;border:1.5px solid var(--line2);background:var(--char2);color:var(--bone);border-radius:9px;overflow:hidden;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:700;max-width:100%}
.spk-info{display:inline-flex;align-items:center;gap:4px;border:none;background:none;color:inherit;font:inherit;padding:5px 9px;cursor:pointer;min-width:0}
.spk-add{border:none;border-inline-start:1px solid var(--line2);background:none;color:var(--ember);font-family:var(--font-body);font-size:calc(13px * var(--fscale));font-weight:900;padding:5px 9px;cursor:pointer}
.spk-chip.sel .spk-add{color:var(--fresh)}
.spk-add:disabled{opacity:.45;cursor:default}
.spk-only{border:none;background:none;color:inherit;font:inherit;padding:5px 10px;cursor:pointer}
.seas-cardwrap{position:relative}
.seas-cardadd{position:absolute;top:7px;inset-inline-end:7px;z-index:2;width:28px;height:28px;border-radius:9px;border:1.5px solid var(--ember);background:var(--char2);color:var(--ember);font-family:var(--font-body);font-size:calc(15px * var(--fscale));font-weight:900;cursor:pointer;line-height:1}
.seas-cardadd.sel{border-color:var(--fresh);color:var(--fresh);background:var(--fresh-l)}
.seas-card.sel{outline:2px solid var(--fresh)}
.spk-chip .spk-heb{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.spk-chip.sel{background:var(--fresh-l);border-color:var(--fresh);color:var(--fresh)}
.spk-chip.house{border-style:double;border-width:3px}
.spk-chip.none{border-style:dashed;color:var(--smoke)}
.spk-chip.none.sel{background:var(--char2);border-color:var(--smoke);color:var(--bone)}
.spk-mark{font-size:calc(11px * var(--fscale))}
.spk-heat{font-size:calc(9.5px * var(--fscale));letter-spacing:-1px}
.spk-v{font-weight:900}
.spk-more{border:none;background:none;color:var(--ember);font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:800;cursor:pointer;padding:5px 7px}
.spk-empty{font-size:calc(11.5px * var(--fscale));color:var(--smoke);padding:4px 2px}
.spk-viewnote{font-size:calc(12px * var(--fscale));color:var(--smoke);background:var(--char2);border:1px dashed var(--line2);border-radius:9px;padding:8px 10px;margin:2px 0 8px;line-height:1.6}
#appdlg{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center}
.appdlg-scrim{position:absolute;inset:0;background:rgba(40,20,8,.45);backdrop-filter:blur(2px)}
.appdlg-card{position:relative;background:var(--char2);border:1.5px solid var(--line2);border-radius:16px;padding:18px 16px;max-width:min(92vw,360px);width:100%;box-shadow:0 18px 50px -18px rgba(60,30,10,.5);font-family:var(--font-body)}
.appdlg-msg{font-size:calc(14.5px * var(--fscale));font-weight:700;color:var(--bone);line-height:1.6;white-space:pre-line}
.appdlg-in{width:100%;margin-top:12px;background:var(--char);border:1.5px solid var(--line2);border-radius:11px;padding:11px;color:var(--bone);font-family:var(--font-body);font-size:calc(14px * var(--fscale))}
.appdlg-btns{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}
.appdlg-btn{border:none;border-radius:999px;padding:9px 18px;font-family:var(--font-body);font-size:calc(13.5px * var(--fscale));font-weight:800;cursor:pointer;background:var(--ember);color:#fff}
.appdlg-btn.ghost{background:none;border:1.5px solid var(--line2);color:var(--bone)}
.appdlg-btn.danger{background:#c0392b}
.spk-editbtn{display:inline-block;border:1.5px solid var(--ember);background:none;color:var(--ember);border-radius:999px;padding:4px 11px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:800;cursor:pointer;margin-inline-start:4px}
.pp-group{margin:0 12px 14px}
.pp-gh{font-family:var(--font-body);font-size:calc(13px * var(--fscale));font-weight:800;color:var(--ember);margin:10px 4px 7px}
.pp-item{display:block;width:100%;text-align:right;background:var(--char2);border:1.5px solid var(--line2);border-radius:13px;padding:11px 13px;margin-bottom:8px;cursor:pointer;font-family:inherit}
.pp-item:active{transform:scale(.99)}
.pp-item-h{display:flex;align-items:center;gap:7px}
.pp-item-h b{font-size:calc(14.5px * var(--fscale));color:var(--bone);font-weight:800}
.pp-emoji{font-size:calc(17px * var(--fscale))}
.pp-diff{margin-inline-start:auto;color:var(--ember2);font-size:calc(12px * var(--fscale));letter-spacing:-1px}
.pp-org{font-size:calc(12px * var(--fscale));color:var(--fresh);font-weight:700;margin-top:3px}
.pp-desc{font-size:calc(12px * var(--fscale));color:var(--bone);opacity:.78;line-height:1.55;margin-top:4px}
.ai-badge{display:inline-block;background:var(--fresh-l);color:var(--fresh);border:1px solid #b8e0d4;border-radius:999px;padding:5px 13px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));font-weight:800;margin-bottom:14px}
.wcim-miss{font-size:calc(11.5px * var(--fscale));color:var(--ember);margin-top:4px;font-weight:600}
.padv-daterow{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:calc(13px * var(--fscale));color:var(--bone)}
.padv-daterow input{background:var(--char);border:1.5px solid var(--line2);border-radius:10px;padding:9px;color:var(--bone);font-family:var(--font-body);font-size:calc(14px * var(--fscale))}
.padv-target{background:var(--fresh-l);border:1px solid #b8e0d4;border-radius:12px;padding:10px 13px;font-size:calc(13.5px * var(--fscale));color:var(--bone)}
.padv-when{font-size:calc(12px * var(--fscale));color:var(--fresh);font-weight:700;margin-top:4px}
.padv-when.late{color:var(--ember)}
.seasoning-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;background:var(--char2);border:1px solid var(--line);border-right:3px solid var(--sc,#b5603a);border-radius:8px;padding:8px 11px;cursor:pointer;font-family:var(--font-body);color:var(--bone);text-align:right}
.seasoning-chip b{font-size:calc(13px * var(--fscale));font-weight:700}
.seasoning-chip small{font-size:calc(10.5px * var(--fscale));color:var(--smoke)}
.seasoning-chip:hover{background:var(--char3,#241a14)}
.seasoning-more{margin-top:12px;background:none;border:none;color:var(--ember2);font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));cursor:pointer;padding:0}
.seas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:12px}
.seas-card{display:flex;flex-direction:column;align-items:flex-start;gap:3px;background:var(--card);border:1px solid var(--line);border-top:3px solid var(--sc,#b5603a);border-radius:10px;padding:11px;cursor:pointer;font-family:var(--font-body);color:var(--bone);text-align:right}
.seas-card-top{display:flex;justify-content:space-between;width:100%;font-size:calc(16px * var(--fscale))}
.seas-card-origin{font-size:calc(10px * var(--fscale));color:var(--smoke)}
.seas-card b{font-size:calc(14px * var(--fscale));font-weight:800}
.seas-card small{font-size:calc(10.5px * var(--fscale));color:var(--smoke)}
.seas-card-kind{font-size:calc(10.5px * var(--fscale));color:var(--ember2);margin-top:3px}
.seas-card:hover{border-color:var(--sc,#b5603a)}
.seas-detail{padding:4px 2px}
.seas-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.seas-kind{font-family:var(--font-body);font-weight:700;font-size:calc(12px * var(--fscale));color:var(--sc,#b5603a)}
.seas-origin{font-size:calc(12px * var(--fscale));color:var(--smoke)}
.seas-title{margin:0 0 14px;font-size:calc(22px * var(--fscale))}.seas-title small{font-size:calc(13px * var(--fscale));color:var(--smoke);font-weight:400}
.seas-sec{margin-bottom:14px}
.seas-sec h5{font-family:var(--font-body);font-size:calc(11px * var(--fscale));letter-spacing:.1em;text-transform:uppercase;color:var(--ember2);margin:0 0 5px}
.seas-sec p{margin:0;line-height:1.6}
.seas-sub{background:rgba(180,120,50,.1);border:1px solid rgba(180,120,50,.3);border-radius:8px;padding:10px}
.seas-sub h5{color:#e0a860}
.mtoggles{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:16px 0 4px}
/* gear */
.gear-banner{display:flex;align-items:center;gap:10px;width:calc(100% - 32px);margin:0 16px 14px;padding:12px 14px;background:#eef4f7;border:1.5px solid #b9d0da;border-radius:14px;cursor:pointer;text-align:start}
.gear-banner span{flex:1;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));color:var(--bone);line-height:1.4}
.gear-banner b{color:#3a6373}
.gear-banner .gb-go{flex:none;color:#5a7d8c;font-size:calc(18px * var(--fscale))}
.gear-group{margin-bottom:16px}
.gear-group h4{font-family:var(--font-body);font-size:calc(14px * var(--fscale));color:var(--bone);margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line2)}
.gear-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0}
.gear-row label{font-size:calc(13.5px * var(--fscale));color:var(--bone);font-family:var(--font-body);flex:none}
.gear-row select{flex:1;max-width:62%;border:1.5px solid var(--line2);border-radius:9px;padding:9px;font-family:var(--font-body);font-size:calc(13px * var(--fscale));background:var(--char2);color:var(--bone)}
.gear-summary{background:var(--char2);border-radius:12px;padding:12px;margin:6px 0 4px;font-family:var(--font-body);font-size:calc(13px * var(--fscale));color:var(--bone)}
.gcaps{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.gcap{font-size:calc(12px * var(--fscale));font-weight:700;border-radius:999px;padding:4px 10px}
.gcap.ok{background:var(--fresh-l);color:var(--good)}
.gcap.no{background:#f6e3dc;color:var(--terra-d)}

.gear-alt{margin-top:8px;background:#f3f7f9;border:1px solid #cfe0e7;border-radius:10px;padding:10px;font-family:var(--font-body)}
.ga-row{padding:6px 0;border-bottom:1px solid rgba(0,0,0,.05)}
.ga-row:last-of-type{border-bottom:none}
.ga-h{font-size:calc(13px * var(--fscale));color:var(--bone);font-weight:700}
.ga-line{font-size:calc(12.5px * var(--fscale));color:var(--bone);margin-top:3px}
.ga-sub{font-size:calc(11px * var(--fscale));color:var(--smoke);margin-top:2px;line-height:1.4}
.ga-foot{font-size:calc(11px * var(--fscale));color:var(--smoke);margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,0,0,.06)}
.thermo-note{background:#f3f7f9;border:1px solid #cfe0e7;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:calc(12px * var(--fscale));color:var(--bone);font-family:var(--font-body);line-height:1.5}
.thermo-note.ok{background:var(--fresh-l);border-color:var(--fresh);color:var(--good)}
.smoker-tip{background:#fff6ec;border:1px solid var(--ember2);border-radius:8px;padding:8px 10px;margin-top:6px;font-size:calc(12px * var(--fscale));color:var(--terra-d);font-family:var(--font-body);line-height:1.5}
.mtoggle.gear-off{opacity:.5}
.gear-tag{font-size:calc(10px * var(--fscale))}
.gear-note{font-size:calc(11px * var(--fscale));color:var(--smoke);margin-top:6px;line-height:1.5;background:var(--char2);border-radius:8px;padding:8px}
.mtoggle{background:var(--char2);border:1.5px solid var(--line);color:var(--smoke);border-radius:999px;padding:8px 15px;font-family:var(--font-body);font-weight:700;font-size:calc(13.5px * var(--fscale));cursor:pointer;transition:all .15s;opacity:.75}
.mtoggle.on{background:linear-gradient(135deg,rgba(245,147,49,.2),rgba(207,106,74,.15));border-color:var(--ember2);color:var(--ember2);opacity:1;box-shadow:0 0 12px rgba(245,147,49,.15)}
.mtoggle.locked{opacity:.3;cursor:not-allowed;text-decoration:line-through}
.mtoggle:not(.locked):hover{border-color:var(--ember2)}
.mtoggle-hint{font-size:calc(11px * var(--fscale));color:var(--smoke);font-family:var(--font-body)}
.seasoning-chip{display:flex;align-items:stretch;padding:0!important}
.seasoning-chip .sc-main{display:flex;flex-direction:column;align-items:flex-start;gap:2px;background:none;border:none;color:var(--bone);font-family:var(--font-body);text-align:right;padding:8px 11px;cursor:pointer}
.seasoning-chip .sc-main b{font-size:calc(13px * var(--fscale));font-weight:700}.seasoning-chip .sc-main small{font-size:calc(10.5px * var(--fscale));color:var(--smoke)}
.seasoning-chip .sc-kind{font-size:calc(10px * var(--fscale));font-weight:800;letter-spacing:.05em}
.seasoning-chip .sc-pick{background:var(--char3,#241a14);border:none;border-right:1px solid var(--line);color:var(--smoke);font-size:calc(15px * var(--fscale));font-weight:800;padding:0 12px;cursor:pointer;border-radius:0 8px 8px 0}
.seasoning-chip.picked{border-color:var(--ember2);box-shadow:0 0 10px rgba(245,147,49,.12)}
.seasoning-chip.picked .sc-pick{color:#8fce76;background:rgba(79,138,61,.15)}
.seas-count{color:#8fce76;font-size:calc(12px * var(--fscale))}
.itemdesc{font-family:var(--font-body);font-size:calc(13.5px * var(--fscale));line-height:1.7;color:var(--bone);opacity:.92;background:var(--char2);border-right:3px solid var(--ember2);border-radius:8px;padding:11px 13px;margin:14px 0 4px}
.t-flag{position:absolute;bottom:5px;inset-inline-start:5px;font-size:calc(15px * var(--fscale));line-height:1;background:rgba(10,8,6,.7);border-radius:6px;padding:2px 4px;backdrop-filter:blur(3px);z-index:3}
#makeChips .chip b{font-weight:800;font-size:calc(11px * var(--fscale));opacity:.65;margin-inline-start:2px}
#makeChips .chip.on b{opacity:.9}
.shop-seas{margin-bottom:10px}
.ss-head{font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));color:var(--ember2);margin-bottom:3px}
.ss-head small{color:var(--smoke)}
.ss-sub{font-size:calc(11px * var(--fscale));color:#e0a860;margin:2px 24px 0}
.vc-launch{border-color:#7a5cc2!important;color:#b9a3e8!important}
.vc-pos{font-family:var(--font-body);font-size:calc(12px * var(--fscale));color:var(--smoke);text-align:center;margin-bottom:10px}
.vc-card{border:1px solid var(--line);border-radius:14px;padding:20px;text-align:center;border-right-width:5px;background:var(--char2)}
.vc-time{font-family:var(--font-body);font-weight:900;font-size:calc(34px * var(--fscale));color:var(--ember2)}
.vc-label{font-family:var(--font-body);font-weight:700;font-size:calc(19px * var(--fscale));color:var(--bone);margin-top:6px}
.vc-sub{font-size:calc(13px * var(--fscale));color:var(--smoke);margin-top:4px}
.vc-det{font-size:calc(13.5px * var(--fscale));color:var(--bone);line-height:1.6;margin-top:12px;text-align:right;background:var(--card);border-radius:8px;padding:12px}
.vc-btns{display:flex;gap:10px;margin-top:18px}
.vc-big{flex:1;padding:20px 8px;font-family:var(--font-body);font-weight:800;font-size:calc(16px * var(--fscale));background:var(--char2);border:1.5px solid var(--line);color:var(--bone);border-radius:14px;cursor:pointer}
.vc-big.vc-main{background:linear-gradient(135deg,rgba(245,147,49,.25),rgba(207,106,74,.2));border-color:var(--ember2);color:var(--ember2)}
.vc-btns2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.vc-q{padding:12px 8px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));background:var(--char2);border:1px solid var(--line);color:var(--smoke);border-radius:10px;cursor:pointer}
.vc-q.on{border-color:#7a5cc2;color:#b9a3e8;animation:vcpulse 1.5s infinite}
@keyframes vcpulse{50%{box-shadow:0 0 14px rgba(122,92,194,.4)}}
.vc-hint{font-size:calc(11.5px * var(--fscale));color:var(--smoke);text-align:center;margin-top:14px;font-family:var(--font-body)}
.vc-langrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;justify-content:center;margin-top:14px}
.vc-langlbl{font-size:calc(12px * var(--fscale));color:var(--smoke);font-weight:700}
.vc-langbtn{background:var(--char);border:1.5px solid var(--line2);border-radius:9px;padding:6px 12px;font-family:var(--font-body);font-size:calc(13px * var(--fscale));color:var(--bone);cursor:pointer}
.vc-langbtn.on{background:var(--fresh-l);border-color:var(--fresh);color:var(--fresh);font-weight:800}
.vc-qa{background:var(--char2);border:1.5px solid var(--line2);border-radius:14px;padding:12px 14px;margin-top:14px}
.vc-askrow{display:flex;gap:8px;margin-top:12px}
.vc-askrow input{flex:1;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:11px 13px;color:var(--bone);font-family:var(--font-body);font-size:calc(15px * var(--fscale))}
.vc-askbtn{background:var(--fresh);border:none;border-radius:12px;padding:0 16px;color:#fff;font-family:var(--font-body);font-weight:800;font-size:calc(14px * var(--fscale));cursor:pointer;white-space:nowrap}
.vc-qa-q{font-size:calc(13px * var(--fscale));color:var(--fresh);font-weight:800;margin-bottom:6px}
.vc-qa-a{font-size:calc(14px * var(--fscale));color:var(--bone);line-height:1.6}
.vc-voicerow{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:10px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));color:var(--smoke)}
.vc-voicerow select{max-width:230px;background:var(--char2);border:1px solid var(--line);color:var(--bone);border-radius:8px;padding:6px 8px;font-family:var(--font-body);font-size:calc(12px * var(--fscale))}
.vc-gem{margin-top:12px;background:var(--char2);border:1px solid rgba(122,92,194,.35);border-radius:10px;padding:10px 12px;font-family:var(--font-body)}
.vc-gem summary{cursor:pointer;font-weight:700;font-size:calc(12.5px * var(--fscale));color:#b9a3e8}
.vc-gem p{font-size:calc(12px * var(--fscale));color:var(--smoke);line-height:1.6;margin:8px 0}
.vc-keyrow{display:flex;gap:8px}
.vc-keyrow input{flex:1;background:var(--card);border:1px solid var(--line);color:var(--bone);border-radius:8px;padding:8px 10px;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));direction:ltr}
.vc-keybtn{background:rgba(122,92,194,.18);border:1px solid rgba(122,92,194,.45);color:#b9a3e8;border-radius:8px;padding:7px 14px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));cursor:pointer}
.vc-keybtn:hover{background:rgba(122,92,194,.3)}
.tl-viewtoggle{display:flex;gap:8px;margin-bottom:14px}
.workplan{display:flex;flex-direction:column;gap:2px}
.wp-row{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;border-right:3px solid transparent}
.wp-row:hover{background:var(--char2)}
.wp-row.wp-fire{border-right-color:#e0662e}.wp-row.wp-sv{border-right-color:#4a90c2}.wp-row.wp-smoke{border-right-color:#8a7a5c}.wp-row.wp-cook{border-right-color:#cf6a4a}.wp-row.wp-prep{border-right-color:#8fce76}.wp-row.wp-glaze{border-right-color:#d9a62b}.wp-row.wp-dry{border-right-color:#c98a1a}.wp-row.wp-serve{background:rgba(245,147,49,.08);border-right-color:var(--ember2)}
.wp-ck{margin-top:3px;accent-color:var(--ember2)}
.wp-time{font-family:var(--font-body);font-weight:800;font-size:calc(14px * var(--fscale));color:var(--ember2);min-width:64px}
.wp-day{display:block;font-size:calc(10px * var(--fscale));line-height:1.15;font-weight:800;color:var(--terra-d,#c9822e);white-space:nowrap}
.wp-body{display:flex;flex-direction:column;gap:1px;font-family:var(--font-body)}
.wp-body b{font-size:calc(13.5px * var(--fscale));font-weight:600;color:var(--bone)}
.wp-body small{font-size:calc(11px * var(--fscale));color:var(--smoke)}
.wp-row:has(.wp-ck:checked) .wp-body b{text-decoration:line-through;opacity:.5}
.tl-detailtoggle{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));color:var(--smoke)}
/* v144: shape-switch row + 3 work-plan presentation shapes */
.tl-shaperow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:12px;font-family:var(--font-body);font-size:calc(12px * var(--fscale));color:var(--smoke)}
.shp-btn{font-size:calc(12px * var(--fscale))!important}
.rec-tag{display:inline-block;font-size:calc(9.5px * var(--fscale));font-weight:800;color:#fff;background:var(--fresh);padding:1px 7px;border-radius:999px;margin-inline-start:4px;vertical-align:middle}
/* shape 5 — accordion */
.wp-accordion .wp-acc{border:1.5px solid var(--line2);border-radius:12px;margin:0 0 8px;overflow:hidden;background:var(--char)}
.wp-acch{display:flex;align-items:center;gap:9px;padding:11px 12px;cursor:pointer}
.wp-bar{width:4px;align-self:stretch;border-radius:3px;flex:none;min-height:18px;background:var(--line)}
.wp-bar-sv{background:#4a90c2}.wp-bar-smoke{background:#8a7a5c}.wp-bar-cook{background:#cf6a4a}.wp-bar-rest{background:var(--smoke)}.wp-bar-prep{background:#8fce76}.wp-bar-glaze{background:#d9a62b}.wp-bar-fire{background:#e0662e}.wp-bar-serve{background:var(--ember2)}.wp-bar-dry{background:#c98a1a}
.wp-atitle{flex:1;font-size:calc(13.5px * var(--fscale));font-weight:700;font-family:var(--font-body);color:var(--bone)}
.wp-caret{color:var(--smoke);font-size:calc(11px * var(--fscale));transition:.2s}
.wp-acc.open .wp-caret{transform:rotate(180deg)}
.wp-accb{display:none;padding:0 12px 11px 30px;font-family:var(--font-body)}
.wp-acc.open .wp-accb{display:block}
.wp-accb small{font-size:calc(11px * var(--fscale));color:var(--smoke);display:block}
/* shape 3 — horizontal stepper */
.wp-horiz{display:flex;overflow-x:auto;gap:0;padding:8px 2px 10px;flex-direction:row}
.wp-hcell{flex:0 0 auto;min-width:108px;text-align:center;position:relative;padding:0 8px;font-family:var(--font-body)}
.wp-hcell:not(:last-child):before{content:'';position:absolute;top:17px;inset-inline-end:-4px;width:100%;height:2px;background:var(--line);z-index:0}
.wp-hdot{position:relative;z-index:1;width:32px;height:32px;border-radius:50%;margin:0 auto 7px;display:grid;place-items:center;background:var(--char2);border:2.5px solid var(--line2);font-size:calc(14px * var(--fscale))}
.wp-htime{font-size:calc(11px * var(--fscale));font-weight:800;color:var(--ember2)}
.wp-hlabel{font-size:calc(11px * var(--fscale));color:var(--bone);margin-top:2px;line-height:1.3}
.wp-det{font-size:calc(12px * var(--fscale));color:var(--bone);opacity:.85;line-height:1.55;margin-top:3px;padding:7px 9px;background:var(--char2);border-radius:7px;border-right:2px solid var(--line)}
@media print{
  .wp-det{background:none;border:1px solid #ccc;color:#000}
  .tl-detailtoggle{display:none!important}
}
@media print{
  .tl-viewtoggle,.wp-ck{display:none!important}
  .wp-row{break-inside:avoid;padding:5px 8px}
  .wp-row::before{content:'☐';margin-left:6px;font-size:calc(14px * var(--fscale))}
}
.tlrow.tl-preheat .tl-n{color:var(--ember2);font-weight:700}
/* timeline item cards (process-stage model) */
.tlcard{background:var(--char2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-bottom:9px}
.tlcard.tl-blocked{border-color:rgba(200,150,80,.3);background:rgba(200,150,80,.05)}
.tlc-head{display:flex;align-items:center;gap:9px}
.tl-startt{min-width:58px;font-size:calc(14px * var(--fscale))}
.tl-name{flex:1;font-size:calc(14.5px * var(--fscale))}
.tl-wood{font-size:calc(11.5px * var(--fscale));color:var(--smoke)}
/* v144: sv/smoke order selector + safety callout */
.tl-order{display:flex;align-items:center;gap:7px;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));color:var(--smoke)}
.tl-order select{background:var(--char2);border:1.5px solid var(--line2);border-radius:9px;padding:6px 9px;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));color:var(--bone)}
.tl-safety-warn{margin-top:9px;background:#fbe9e7;color:#7a231b;border:1.5px solid #f0c4bf;border-radius:11px;padding:10px 12px;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale));line-height:1.55}
.tl-orderstrip{background:var(--char2);border:1.5px solid var(--line2);border-radius:13px;padding:11px 12px;margin-bottom:14px}
.tl-orderstrip-lbl{font-size:calc(11px * var(--fscale));font-weight:800;color:var(--smoke);letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px;font-family:var(--font-body)}
.tl-order-plan{margin-bottom:6px}
.tl-order-plan:last-child{margin-bottom:0}
.tl-badge{font-family:var(--font-body);font-size:calc(10px * var(--fscale));font-weight:800;color:#c89650;background:rgba(200,150,80,.15);border:1px solid rgba(200,150,80,.35);border-radius:999px;padding:2px 9px}
.tl-expand{background:none;border:1px solid var(--line);color:var(--ash);width:26px;height:26px;border-radius:7px;cursor:pointer;font-size:calc(13px * var(--fscale))}
.tl-note{color:var(--smoke);font-size:calc(12.5px * var(--fscale));line-height:1.5;margin:7px 0}
.tlc-controls{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tlc-controls select{background:var(--char);border:1px solid var(--line);color:var(--bone);border-radius:8px;padding:6px 9px;font-family:var(--font-body);font-size:calc(12.5px * var(--fscale))}
.tl-pantrybtn{background:rgba(200,150,80,.12);border:1px solid rgba(200,150,80,.35);color:#c89650;border-radius:999px;padding:7px 12px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));cursor:pointer}
.tl-stages{margin-top:10px;padding-top:8px;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:5px}
.tl-stage{display:flex;align-items:center;gap:9px;font-size:calc(12.5px * var(--fscale))}
.tl-stage-t{min-width:52px;color:var(--ember2);font-weight:700}
.tl-stage-l{flex:1;color:var(--ash)}
.tl-stage-h{color:var(--smoke);font-size:calc(11.5px * var(--fscale))}
.tl-stage-note{color:var(--smoke);font-size:calc(11.5px * var(--fscale));font-style:italic;padding-inline-start:52px}
.tl-doneref{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);font-size:calc(11.5px * var(--fscale));color:var(--ash)}
.tl-doneref>b{color:var(--ember2);font-family:var(--font-body);font-size:calc(11.5px * var(--fscale))}
.tl-donelist{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tl-donelist span{background:var(--char);border:1px solid var(--line);border-radius:7px;padding:3px 9px;font-size:calc(11.5px * var(--fscale))}
.tl-donelist span.on{background:rgba(232,92,28,.16);border-color:var(--ember);color:var(--ember2);font-weight:700}
.tl-donelist span b{font-weight:800}
/* menu builder */
.mrow{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.mrow label{min-width:54px;font-family:var(--font-body);font-weight:700;font-size:calc(13px * var(--fscale));color:var(--ash)}
.mrow input[type=number],.mrow select{background:var(--char);border:1px solid var(--line);color:var(--bone);-webkit-text-fill-color:var(--bone);border-radius:8px;padding:8px 10px;font-family:var(--font-body);font-size:calc(14px * var(--fscale))}
.mrow input[type=number]{width:84px}
.mrow .u{color:var(--smoke);font-size:calc(13px * var(--fscale))}
.mpresets{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.mpresets span{font-size:calc(12px * var(--fscale));color:var(--smoke);font-family:var(--font-body)}
.mpresets button{background:var(--char2);border:1px solid var(--line);color:var(--bone);border-radius:999px;padding:7px 12px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));cursor:pointer}
.mpresets button:hover{border-color:var(--ember);color:var(--ember2)}
.mdishes{display:flex;flex-direction:column;gap:8px}
.mdish{display:flex;align-items:center;gap:10px;background:var(--char2);border:1px solid var(--line);border-radius:11px;padding:10px 13px}
.md-main{flex:1;display:flex;flex-direction:column;gap:2px}
.md-main .si-cat{font-family:var(--font-body);font-size:calc(11px * var(--fscale));font-weight:700}
.md-main b{font-size:calc(15px * var(--fscale))}.md-main small{color:var(--smoke);font-size:calc(12px * var(--fscale))}
.md-act{display:flex;gap:6px}
.md-act button{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);background:var(--char);color:var(--ash);font-size:calc(16px * var(--fscale));cursor:pointer}
.md-act button:hover{border-color:var(--ember);color:var(--ember2)}
#mAdd{margin-top:10px;background:var(--char);border:1px dashed var(--line);color:var(--ember2);border-radius:10px;padding:11px 14px;font-family:var(--font-body);font-weight:700;cursor:pointer;width:100%}
#mAdd:hover{border-color:var(--ember)}
.maddcats{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
.mchips{display:flex;flex-wrap:wrap;gap:7px}
.mchip{background:var(--char2);border:1px solid var(--line);color:var(--ash);border-radius:999px;padding:7px 12px;font-family:var(--font-body);font-weight:700;font-size:calc(12.5px * var(--fscale));cursor:pointer}
.mchip.on{background:rgba(116,166,87,.16);border-color:var(--good);color:var(--good)}
.mchip:hover{border-color:var(--ember)}
.mqty{display:flex;justify-content:space-between;gap:8px;font-size:calc(12.5px * var(--fscale));padding:4px 0;border-bottom:1px solid rgba(0,0,0,.05)}
.mqty b{color:var(--ember);white-space:nowrap}
.mnote{color:var(--smoke);font-size:calc(12px * var(--fscale));margin-top:8px}
.menuprint{display:none}
.menuprint h2{margin:0 0 6px}.menuprint h4{margin:12px 0 4px;font-family:var(--font-body)}
.menuprint ul{margin:0;padding-inline-start:20px}.menuprint li{margin:2px 0}

@media print{
  @page{margin:14mm}
  html,body{background:#fff!important;color:#111!important;overflow:visible!important}
  .glow,.tools,header.hero,main,footer,.scrim,.prbtn,.x,.tabs,.timer,.progress,.addbtn{display:none!important}
  .panel:not(.open){display:none!important}
  .panel.open{position:static!important;transform:none!important;width:100%!important;max-width:100%!important;
    box-shadow:none!important;border:none!important;background:#fff!important;height:auto!important;display:block!important}
  .panel.open .panel-body{overflow:visible!important;padding:0!important}
  .panel.open *{color:#111!important;background:#fff!important;border-color:#bbb!important;-webkit-print-color-adjust:exact}
  .panel.open h2,.panel.open .panel-top h2{color:#000!important}
  .panel.open .cat,.panel.open .si-cat,.panel.open h4,.panel.open .vt{color:#a8420f!important}
  .panel.open .calcbox,.panel.open .matlist li,.panel.open .varitem,.panel.open .stat,.panel.open .cl,
  .panel.open .method-note,.panel.open .shop-item{border:1px solid #ccc!important}
  .panel.open .step,.panel.open .shop-line,.panel.open .varitem{break-inside:avoid}
  .panel.open .cbx{border:1px solid #333!important}
  .dot.f{background:#a8420f!important}.dot{background:#ddd!important}
  /* new tool panels in print */
  .panel.open .acc-a{max-height:none!important;overflow:visible!important;display:block!important;padding-bottom:8px!important}
  .panel.open .acc-q span{display:none!important}
  .panel.open .pbar{border:1px solid #999!important}
  .panel.open .pbar i{background:#a8420f!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .panel.open .toolgrid{display:block!important}
  .panel.open .toolbtn,.panel.open .kbox,.panel.open .jcard,.panel.open .pcard,.panel.open .miniform{border:1px solid #ccc!important;break-inside:avoid}
  .panel.open .jcard img{filter:none!important;max-width:90px!important}
  .panel.open .askrow,.panel.open .exrate,.panel.open .exactions,.panel.open .pc-rm,.panel.open [data-prm],.panel.open [data-rrm],.panel.open [data-jrm],.panel.open [data-pcancel],.panel.open [data-jcancel],.panel.open .mf-actions .ghost{display:none!important}
  .panel.open .exfav{border:1px solid #999!important}
  .toast{display:none!important}
  .panel.open .tlrow{break-inside:avoid;border-bottom:1px solid #ccc!important}
  .panel.open .tlcard{break-inside:avoid;border:1px solid #ccc!important;background:#fff!important}
  .panel.open .tl-stages{display:flex!important}
  .panel.open .tlc-controls,.panel.open .tl-expand,.panel.open .tl-pantrybtn{display:none!important}
  .panel.open .tl-lead input{border:none!important;width:auto!important}
  .panel.open #menuBody>*{display:none!important}
  .panel.open #menuBody .menuprint{display:block!important}
}

@media(max-width:560px){
  .ing ul{grid-template-columns:1fr}
  .panel-top h2{font-size:calc(28px * var(--fscale))}
  .prbtn{inset-inline-end:56px;inset-inline-start:auto;padding:0 10px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body class="capp">
<div class="glow"></div>
<header class="hero">
  <div class="kick">סו-ויד · עישון · גריל · אש</div>
  <h1>מתכונת · מדריך האש</h1>
  <p class="sub" id="heroSub"></p>
</header>

<!-- ═══ HOME ═══ -->
<div class="screen on" id="scr-home">
  <div class="capp-top capp-top-home">
    <button class="capp-ico capp-more-corner" id="cHomeMore" aria-label="עוד">☰</button>
    <div class="chome-title">
      <div class="chome-kick">סו-ויד · עישון · גריל · אש</div>
      <h1 class="chome-h1"><span class="brand-flame">🔥</span> מתכונת · מדריך האש</h1>
      <p class="chome-sub">בישול מדויק בעברית — טמפרטורה × זמן, מבשר ופירות-ים ועד גבינות וירקות. <button class="chome-caps" id="cHomeCaps">גלה את כל היכולות ←</button></p>
      <div class="chome-credit-top">נבנה באהבה לקהילת האש · <b>דודי בר-און</b></div>
    </div>
  </div>
  <div class="chome-search" id="cHomeSearch"><span class="ic">⌕</span><input placeholder="חפש הכל — נתח, נקניקייה, מתבל…" readonly></div>
  <div class="chome-hero"><div class="hi" id="cGreet">ברוך הבא 👋</div><h2>מה <b>מדליקים</b> היום?</h2></div>
  <div id="cGearBanner"></div>
  <button class="chome-ask" id="cHomeAsk"><span class="cha-ico">🔥</span><span class="cha-txt"><b>שאל את האש</b><small>עוזר בישול חכם — זמן, טמפ׳, עץ, כמות, כשרות, ואיפה לקנות</small></span><span class="cha-go">←</span></button>
  <div class="cpaths">
    <div class="cpath event" data-cgo="wizard"><span class="ptag">🌿 הכי פופולרי</span><span class="pico">🎉</span><h3>יש לי אירוע</h3><p>אשף מודרך שבונה תפריט, רשימת קניות ותוכנית עבודה — לפי מספר הסועדים והטעמים.</p><span class="go">←</span></div>
    <div class="cpath quick" id="cPathCook"><span class="pico">🔥</span><h3>בא לי לבשל משהו</h3><p>אותו אשף מודרך כמו אירוע — בחר מנות, שיטות ותיבול, וקבל תוכנית עבודה מלאה עם טיימרים.</p><span class="go">←</span></div>
    <div class="cpath project" id="cPathProj"><span class="pico">🧪</span><h3>פרויקט מתקדם</h3><p>שרקוטרי, נקניקים ועישון ארוך — בחירה מקוטלגת לפי סוג ומדינה, עם תיאור מלא לכל מלאכה וליווי צעד-אחר-צעד.</p><span class="go">←</span></div>
  </div>
  <div class="cnext" id="cResume" hidden><span class="nico">📋</span><div style="flex:1"><div class="nt">המשך מהמקום שעצרת</div><div class="nm" id="cResumeM"></div></div><span class="ng">←</span></div>
  <div class="cnext" id="cResumeProj" hidden><span class="nico">🧫</span><div style="flex:1"><div class="nt">המשך פרויקט</div><div class="nm" id="cResumeProjM"></div></div><span class="ng">←</span></div>
  <button class="chome-about" id="cHomeAbout"><span>❓ איך משתמשים באפליקציה</span><span class="cha-sub">מסלולים, כלים וכל היכולות</span></button>
</div>

<!-- ═══ WIZARD (full 6-step) ═══ -->
<div class="screen" id="scr-wizard">
  <div class="cshead"><button class="back" id="cwBack" aria-label="חזרה">→</button><h2 id="cwTitle">אשף האירוע</h2><span class="step" id="cwLbl">שלב 1/6</span></div>
  <div class="cwprog" id="cwProg"></div>

  <!-- step 0: event identity + basics -->
  <div class="cwstep on" data-cwstep="0">
    <div class="cwq" id="cwEvHead">פרטי האירוע</div><div class="cwsub" id="cwEvSub">תן שם לאירוע כדי לשמור ולחזור אליו בהמשך.</div>
    <div class="cscard" id="cwEvCard">
      <input id="cwEvName" placeholder="שם האירוע — למשל: שישי במשפחה" style="width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px">
      <input id="cwEvDesc" placeholder="תיאור קצר (אופציונלי)" style="width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:14px;margin-bottom:10px">
      <input id="cwEvDate" type="date" style="width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:14px">
    </div>
    <div class="cwq" style="font-size:18px;margin-top:6px">בסיס</div><div class="cwsub">סועדים, תיאבון וכשרות.</div>
    <div class="cstepper"><button id="cServMinus">−</button><div class="val" id="cServVal">8<small>סועדים</small></div><button id="cServPlus">+</button></div>
    <div class="cscard"><h4>🍽️ תיאבון</h4><div class="cmethods" id="cwAppetite">
      <span class="cmethod" data-app="light">קל · 200ג׳</span><span class="cmethod on" data-app="reg">רגיל · 280ג׳</span><span class="cmethod" data-app="heavy">כבד · 380ג׳</span>
    </div></div>
    <div class="cscard"><h4>✡️ כשרות</h4><div class="cmethods"><span class="cmethod fresh" id="cwKosher" data-on="0">🥩 סנן חזיר/לא-כשר</span></div></div>
    <button class="ccta" data-cwgo="1">המשך לבחירת מנות ←</button>
  </div>

  <!-- step 1: pick from full catalog -->
  <div class="cwstep" data-cwstep="1">
    <div class="cwq">מה על האש?</div><div class="cwsub">בחר מכל הקטלוג — נתחים, נקניקיות, ירקות, מוצרים. בחירה מרובה.</div>
    <div class="chome-search" style="margin:0 0 12px"><span class="ic">⌕</span><input id="cwSearch" placeholder="חפש בכל הקטלוג — נתח, נקניק, ירק, מוצר…"></div>
    <div class="chips" id="cwCatChips" style="margin-bottom:8px"></div>
    <div class="chips" id="cwContChips" style="margin-bottom:10px;display:none"></div>
    <div id="cwPickCount" style="display:flex;align-items:center;justify-content:space-between;font-family:'Heebo';font-size:12px;color:var(--fresh);font-weight:700;margin-bottom:8px"></div>
    <div id="cwPickSel" class="cwpick-sel"></div>
    <div id="cwPickList" style="max-height:48vh;overflow-y:auto;padding-bottom:6px"></div>
    <button class="ccta" data-cwgo="2">המשך לשיטות ←</button>
  </div>

  <!-- step 2: real method toggles per item -->
  <div class="cwstep" data-cwstep="2">
    <div class="cwq">שיטות בישול</div><div class="cwsub">לכל פריט — בחר שיטה (סו-ויד / עישון / גריל). נשמר במנוע האמיתי.</div>
    <div id="cwMethodsFull"></div>
    <button class="ccta" data-cwgo="3">המשך למתבלים ←</button>
  </div>

  <!-- step 3: seasonings per item -->
  <div class="cwstep" data-cwstep="3">
    <div class="cwq">מתבלים ורטבים</div><div class="cwsub">בחר תיבול לכל פריט — יוזרק אוטומטית לשלבי הבישול.</div>
    <div id="cwSeasFull"></div>
    <button class="ccta" data-cwgo="4">המשך לתוספות וקינוחים ←</button>
  </div>

  <!-- step 4: sides + drinks -->
  <div class="cwstep" data-cwstep="4">
    <div class="cwq">תוספות, שתייה וקינוחים</div><div class="cwsub">מותאם למנות ולעונה. הקינוחים כוללים פירות טריים לפי תאריך האירוע.</div>
    <div class="cscard"><h4>🥗 תוספות</h4><div id="cwSides" class="cmethods" style="flex-direction:column;align-items:stretch;gap:8px"></div></div>
    <div class="cscard"><h4>🥤 שתייה</h4><div id="cwDrinks" class="cmethods" style="flex-direction:column;align-items:stretch;gap:8px"></div></div>
    <div class="cscard"><h4>🍮 קינוחים</h4><div id="cwDesserts" class="cmethods" style="flex-wrap:wrap"></div></div>
    <button class="ccta" data-cwgo="5">סקירה ותוכנית ←</button>
  </div>

  <!-- step 5: review + serve time + generate real plan -->
  <div class="cwstep" data-cwstep="5">
    <div class="cwq">סקירה ותוכנית עבודה</div><div class="cwsub">הכל מוכן — צור תוכנית עבודה כרונולוגית מלאה.</div>
    <div class="cscard"><h4>⏰ שעת הגשה</h4>
      <input id="cwServe" type="time" value="19:00" style="width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:16px">
    </div>
    <div id="cwReview"></div>
    <button class="ccta" id="cwSaveEvent">💾 שמור אירוע</button>
    <button class="ccta" id="cwGenPlan">📋 צור תוכנית עבודה מלאה</button>
    <button class="ccta ghost" id="cwOpenMenu">🍽️ פתח בונה ארוחה</button>
    <button class="ccta ghost" id="cwVoice">🎙️ מצב בישול קולי</button>
    <button class="ccta ghost" data-cgo="events">סיום · לרשימת האירועים</button>
  </div>
</div>

<!-- ═══ CATALOG (category-tile navigation) ═══ -->
<div class="screen" id="scr-catalog">
<div class="cshead">
  <button class="back" id="catBack">→</button>
  <h2 id="catTitle">קטלוג</h2>
  <button class="capp-ico" data-mfn="__more" aria-label="עוד">☰</button>
</div>
<div class="tools">
  <div class="tools-in">
    <div class="searchbar">
      <input id="q" type="search" placeholder="חפש נתח, מוצר או שם באנגלית…" autocomplete="off">
      <span class="ic">⌕</span>
    </div>
    <div class="catgroups" id="catGroups" style="display:none"></div>
    <div class="chips" id="chips"></div>
    <div class="filterbar" id="filterBar" style="display:none"></div>
    <div class="count-row" id="countRow" style="display:none"><div class="count" id="count"></div><button id="clearAll" class="clearall">🗑️ איפוס תצוגה</button></div>
  </div>
</div>

<main>
  <!-- landing: category tiles -->
  <div id="catLanding"></div>

  <div id="cutsWrap">
    <div class="grid" id="grid"></div>
    <div class="empty" id="empty" style="display:none">לא נמצאו פריטים. נסה מילה אחרת.</div>
  </div>

  <h2 class="section-h" id="makesH">בית המלאכה — בנייה מאפס</h2>
  <p class="section-sub" id="makesSub">מגוון רחב להכנה מאפס: נקניקיות טריות, נקניקים מעושנים ומיובשים, פסטרמות ושווארמה — כל אחד עם חומרים, טחינה, מילוי, עישון ומחשבון מלח.</p>
  <div class="chips" id="makeChips"></div>
  <div class="grid" id="makeGrid"></div>

  <h2 class="section-h" id="specialsH">ריפוי, נקניקים וגבינות</h2>
  <p class="section-sub" id="specSub">ריפוי ועישון — ג'רקי, בייקון, נקניקים מותססים/מיובשים, ו-33 גבינות לעישון קר וגריל.</p>
  <div class="grid" id="specGrid"></div>

  <h2 class="section-h" id="glossH" style="display:none">מילון המונחים</h2>
  <p class="section-sub" id="glossSub" style="display:none">המונחים שמאחורי הטבלאות — שיטות עישון, ריפוי, סוגי עץ ופחם.</p>
  <div class="gloss" id="gloss"></div>
</main>
</div>

<!-- legacy tools header (retired) -->
<div style="display:none" id="legacyTools"></div>
<template id="legacyToolsTpl"></template>
<div style="display:none">
  <button id="themeBtn"></button><button id="favBtn"><span id="favN">0</span></button>
  <span id="cartN">0</span><button id="aboutTop"></button><button id="exitTop"></button>
</div>

<!-- ═══ EVENTS (list + draft) ═══ -->
<div class="screen" id="scr-events">
  <div class="cshead"><button class="back" data-cgo="home">→</button><h2>האירועים שלי <small id="cEvCount" style="font-size:12px;font-weight:400;color:var(--smoke)"></small></h2><button class="capp-ico" data-mfn="__more" id="cEvMore" aria-label="עוד">☰</button></div>
  <div style="padding:0 16px 4px"><button class="ccta" id="cEvAiPlan" style="margin:0 0 8px;width:100%;background:var(--fresh);border-color:var(--fresh)">✨ תכנן אירוע עם AI</button><button class="ccta" id="cEvNew" style="margin:0 0 8px;width:100%">🎉 אירוע חדש</button></div>
  <div id="cEvBody" style="padding:0 16px"></div>
</div>

<!-- ═══ PROJECTS ═══ -->
<div class="screen" id="scr-projects">
  <div class="cshead"><button class="back" data-cgo="home">→</button><h2>פרויקטים</h2><button class="capp-ico" data-mfn="__more" id="cProjMore" aria-label="עוד">☰</button></div>
  <div id="cProjBody" style="padding:0 16px"></div>
</div>

<!-- ═══ bottom nav ═══ -->
<div class="cnav">
  <button class="on" data-cnav="home"><span class="ni">🏠</span>בית</button>
  <button data-cnav="catalog"><span class="ni">📚</span>קטלוג</button>
  <button class="fab" data-cnav="wizard"><span class="ni">🎉</span></button>
  <button data-cnav="events"><span class="ni">📋</span>אירועים</button>
  <button data-cnav="projects"><span class="ni">🧫</span>פרויקטים</button>
</div>

<footer>
  <div class="footnote">מתכונת · מדריך האש — נבנה מהטבלאות של דודי. הנתונים מקומיים, ללא חיבור לרשת. סימוני ה-checklist נשמרים בדפדפן.<br><b class="foot-stamp" style="color:var(--ember2)">מהדורה 150 · 13.7.26</b></div>
</footer>

<div class="scrim" id="scrim"></div>
<aside class="panel" id="panel" aria-hidden="true" role="dialog" aria-modal="true" aria-label="פרטי מתכון" tabindex="-1"></aside>

<script>
const DATA = __DATA__;
const $ = s=>document.querySelector(s);

/* ---------- helpers ---------- */
function upperHours(h){ // "24-30"->30 , "0.75"->0.75
  if(typeof h!=='string') return parseFloat(h)||0;
  const parts = h.replace(/[^0-9.\-]/g,'').split('-').filter(Boolean);
  if(!parts.length) return 0;
  return parseFloat(parts[parts.length-1])||0;
}
function dots(d){let o='<span class="dots">';for(let i=1;i<=5;i++)o+=`<span class="dot ${i<=d?'f':''}"></span>`;return o+'</span>';}
const PREP_TREAT=["צינון","צינון מלא","ייבוש","ייבוש עור","קילוף קרום","דקירת עור+ניקוז","חריטת עור","ניקוז שומן","הפיכת עור"];
const FINISH_TREAT=["גלייז","מריחה","הפיכה","סיבוב שיפוד"];

const ALT_RUB = {
 "בקר":["קופי-בארק","שפשוף אספרסו טחון + קקאו + סוכר חום + מלח ופלפל גס — קרום כהה ועמוק עם מרירות מאוזנת. שמור על אותם זמנים וטמפ'."],
 "חזיר":["מייפל-חרדל","חרדל דיז'ון כשכבת הדבקה, ומעליו סירופ מייפל + פפריקה מעושנת + מעט קיין. מתוק-חמצמץ קלאסי לחזיר."],
 "טלה":["הריסה-נענע","הריסה + שום כתוש + כמון + נענע יבשה + שמן זית. גוון צפון-אפריקאי שמתאים לשומן של הטלה."],
 "עוף":["לימון-שום-טימין","גרידת לימון + שום + טימין + מלח + פלפל לבן. נקי ורענן, מבליט עור פריך."],
 "הודו":["חמאת מרווה-תפוז","חמאה רכה + מרווה קצוצה + גרידת תפוז מתחת לעור. שומר על לחות בנתח הרזה."],
 "אווז":["חמש-תבלינים ודבש","חמישה תבלינים סיני + דבש + סויה. מאזן את השומן העשיר עם מתיקות ארומטית."],
 "ברווז":["חמש-תבלינים ודבש","חמישה תבלינים סיני + דבש + סויה. מאזן את השומן העשיר עם מתיקות ארומטית."],
 "דג":["מיסו-מייפל","מריחת מיסו לבן + מייפל + מעט סויה לפני העישון — אומאמי וברק יפהפה."],
 "מעורב":["שום-עשבים","שמן זית + שום + עשבי תיבול טריים. פשוט ועובד כמעט על הכל."]
};

/* ---------- method-toggle engine (Phase 1) ---------- */
// Each cut gets allowed toggles + a recommended default combo + validation rules.
// Toggles: sv (סו-ויד), smoke (עישון), grill (גריל/צריבה ישירה)
// ── user equipment ("הציוד שלי") — filters & adapts preparation routes ──
const GEAR_GROUPS=[
  {g:'🔥 בישול ועישון', items:[
    {id:'smoker', label:'מעשנה', opts:['אין','ארון / קבינט','אופסט / סטיק-ברנר','פלטים','קמאדו / קרמי','WSM / חבית','קטל (ככלי עישון)','גז (עם תיבת עשן)','חשמלי']},
    {id:'grill', label:'גריל', opts:['אין','פחם','גז','קטל','פלנצ׳ה / פלטה','לבה / אינפרא']},
    {id:'sousvide', label:'סו-ויד', opts:['אין','טבילה (immersion)','מיכל ייעודי']},
    {id:'vacuum', label:'ואקום', opts:['אין','חדר (chamber)','שקית חיצונית (edge)']},
    {id:'thermo', label:'מדחום', opts:['אין','מיידי (instant-read)','פרוב נעוץ','פרוב אלחוטי','בקר-מאוורר']},
  ]},
  {g:'🌭 עיבוד בשר', items:[
    {id:'grinder', label:'מטחנת בשר', opts:['אין','ייעודית','מתאם למיקסר']},
    {id:'stuffer', label:'מכונת מילוי נקניקים', opts:['אין','אנכית','אופקית','מזרק / משפך ידני']},
    {id:'injector', label:'מזרק (injection)', opts:['אין','יש']},
    {id:'slicer', label:'פרוסת / סלייסר', opts:['אין','יש']},
  ]},
  {g:'🧫 ריפוי וייבוש', items:[
    {id:'curechamber', label:'תא ריפוי / ייבוש', opts:['אין','תא ייעודי','מקרר מומר','מייבש','תנור']},
    {id:'humidity', label:'בקרת לחות', opts:['אין','בקר + מפזר/מייבש']},
    {id:'scale', label:'משקל דיגיטלי מדויק', opts:['אין','יש (0.1 ג׳)','יש (1 ג׳)']},
    {id:'hooks', label:'ווים / שבכות לתלייה', opts:['אין','יש']},
    {id:'torch', label:'מבער / לפיד', opts:['אין','יש']},
  ]},
];
function gearState(){ return store.get('mk-gear')||{}; }
function saveGear(g){ store.set('mk-gear',g); }
function gearConfigured(){ return !!store.get('mk-gear-set'); }
function gearSetConfigured(){ store.set('mk-gear-set', true); }
// capability mapping — permissive (true) until the user configures gear, so nothing changes for them until then
function canSV(){ if(!gearConfigured()) return true; const g=gearState(); return !!(g.sousvide && g.sousvide!=='אין'); }
function canSmoke(){ if(!gearConfigured()) return true; const g=gearState();
  if(g.smoker && g.smoker!=='אין') return true;
  return !!(g.grill && ['פחם','קטל','גז'].includes(g.grill)); }        // charcoal/kettle/gas-with-box can smoke
function canGrill(){ if(!gearConfigured()) return true; const g=gearState();
  if(g.grill && g.grill!=='אין') return true;
  return !!(g.smoker && ['קמאדו / קרמי','קטל (ככלי עישון)','WSM / חבית','אופסט / סטיק-ברנר'].includes(g.smoker)); }
function gearCan(method){ return method==='sv'?canSV():method==='smoke'?canSmoke():method==='grill'?canGrill():true; }
function gearLabelFor(method){ return method==='sv'?'סו-ויד':method==='smoke'?'מעשנה':method==='grill'?'גריל':''; }
function methodRules(c){
  if(isProduce(c)) return {allowed:['sv','smoke','grill'], def:['grill'], minOne:true,
    invalid:[['sv','smoke','grill']]};                       // all three = overcooked produce
  if(isOffal(c)){
    const e=c.eng||'';
    if(e.includes('Gizzard')) return {allowed:['sv','smoke','grill'], def:['sv','grill'], minOne:true,
      require:['sv'], invalid:[]};                           // gizzards must pre-tenderize
    return {allowed:['sv','smoke','grill'], def:['grill'], minOne:true, invalid:[]};  // צריבת-גימור אחרי sv+עישון לגיטימית
  }
  if(c.doneness) return {allowed:['sv','smoke','grill'], def:['sv','smoke'], minOne:true,
    invalid:[]};                                             // steak-like: כל צירוף — גריל כגימור קצר גם אחרי sv+עישון
  // collagen/long cuts: grill allowed ONLY as finish (must have sv or smoke doing the cooking)
  return {allowed:['sv','smoke','grill'], def:['sv','smoke'], minOne:true,
    needsCookFor:'grill', invalid:[['grill']]};
}
function methodKeyFor(key){return 'method:'+key;}
function activeMethods(c,key){
  const saved=store.get(methodKeyFor(key));
  const rules=methodRules(c);
  if(Array.isArray(saved)&&saved.length){
    const ok=saved.filter(m=>rules.allowed.includes(m));
    if(ok.length) return ok;
  }
  return gearAwareDefault(c, rules);
}
/* ── ephemeral cooking-form state (recipe card as interactive scratch) ──
   lives in memory for the current visit only; next entry → clean template */
let cardSess={};
function cardGet(k){ return (k in cardSess)?cardSess[k]:null; }
function cardSet(k,v){ if(v===null||v===undefined) delete cardSess[k]; else cardSess[k]=v; }
function cardClear(key){ Object.keys(cardSess).forEach(k=>{ if(k.startsWith(key+'-')||k==='method:'+key||k==='done:'+key) delete cardSess[k]; }); }
function cardMethods(c,key){
  const s=cardGet('method:'+key); const rules=methodRules(c);
  if(Array.isArray(s)&&s.length){ const ok=s.filter(m=>rules.allowed.includes(m)); if(ok.length) return ok; }
  return gearAwareDefault(c, rules);
}
function ctxMethods(c,key){ return (typeof curProject!=='undefined'&&curProject)?activeMethods(c,key):cardMethods(c,key); }
// prefer a default the user's gear can actually do; fall back gracefully but keep a valid combo
function gearAwareDefault(c, rules){
  const def=[...rules.def];
  if(!gearConfigured()) return def;
  if(def.every(m=>gearCan(m))) return def;                        // user can do the intended route
  // try to salvage: keep gear-capable methods from the default
  let cand=def.filter(m=>gearCan(m));
  // if default was sv+smoke and one is missing, the remaining single often still cooks (smoke-only / sv-only)
  if(cand.length && validCombo(c,cand)) return cand;
  // otherwise search all valid combos for one the gear can fully do, closest to the default
  const all=[['sv'],['smoke'],['grill'],['sv','smoke'],['sv','grill'],['smoke','grill'],['sv','smoke','grill']]
    .filter(cb=>validCombo(c,cb) && cb.every(m=>gearCan(m)));
  if(all.length){ all.sort((a,b)=>a.length-b.length); return all[0]; }
  return def;                                                     // nothing possible — keep intended (shown dimmed w/ tag)
}
function validCombo(c, combo){
  const r=methodRules(c);
  if(r.minOne && !combo.length) return false;
  if(r.require && !r.require.every(m=>combo.includes(m))) return false;
  if(r.needsCookFor && combo.includes(r.needsCookFor) && !combo.some(m=>m!==r.needsCookFor&&(m==='sv'||m==='smoke'))) return false;
  if((r.invalid||[]).some(bad=>bad.length===combo.length && bad.every(m=>combo.includes(m)))) return false;
  return combo.every(m=>r.allowed.includes(m));
}
// Compose steps from the active combo. Order: prep → sv → smoke → grill-finish → rest.
function composedSteps(c, combo){
  const has=m=>combo.includes(m);
  const produce=isProduce(c), offal=isOffal(c);
  // single-method fast paths reuse existing generators (already battle-tested)
  if(produce){
    if(has('grill')&&!has('sv')&&!has('smoke')) return produceGrillSteps(c);
    if(has('smoke')&&!has('sv')&&!has('grill')) return produceSmokeSteps(c);
    if(has('sv')&&!has('smoke')&&!has('grill')) return produceSVSteps(c);
  } else {
    if(has('grill')&&combo.length===1) return meatGrillSteps(c);
    if(has('sv')&&has('smoke')&&!has('grill')) return svSteps(c);
    if(has('smoke')&&combo.length===1) return soSteps(c);
  }
  // combinatorial compose
  const steps=[];
  const dtgt=(c.doneness&&typeof donenessTarget==='function')?donenessTarget(c):c.tgt;
  if(offal) steps.push(["הכנה ייעודית לאיבר", offalPrep(c), 0]);
  else if(produce) steps.push(["הכנה",`שטוף ונקה. חתוך לגודל אחיד. ${c.somid||''}`,0]);
  else steps.push(["הכנה",`יבש היטב במגבת — משטח יבש = צריבה וקרום טובים.`,0]);
  if(has('sv')){
    steps.push(["סו-ויד",`ואקום ובשל ב-${c.svt}°C למשך ${c.svh} שעות${produce?' — הפקטין מתרכך לרכות מדויקת':c.doneness?` (יעד ${dtgt}° לפי מידת העשייה)`:''}. ${produce?'הוסף חמאה/שמן לשקית.':''}`,upperHours(c.svh)*3600]);
    steps.push(["ייבוש מעבר",`הוצא מהשקית ויבש היטב במגבת — משטח רטוב לא נצרב ולא מעשן טוב.`,0]);
  }
  if(has('smoke')){
    const t=has('sv')?c.smt:(c.sot||c.smt), hrs=has('sv')?c.smh:(c.soh||c.smh);
    steps.push(["עישון",`מעשנת ${t}°C עם ${c.wood&&c.wood!=='ללא'?c.wood:'עצי פרי'} למשך ${hrs} שעות${has('sv')?' — לעשן וקרום בלבד, הבישול כבר נעשה':''}. ${!has('sv')&&c.somid&&c.somid!=='אין'?c.somid+'.':''}`,upperHours(hrs)*3600]);
  }
  if(has('grill')){
    steps.push(["גימור גריל / צריבה",`אש ישירה חמה: ${has('sv')||has('smoke')?'צריבה קצרה 1-2 דק׳/צד לקרום, צבע וטעם אש — הפנים כבר מוכן':'צלה 2-4 דק׳/צד עד מדחום '+(dtgt? (Math.max(40,dtgt-4)+'° (יעד '+dtgt+'°)') : 'מוכנות')}.`,240]);
  }
  if(!produce||c.rest) steps.push(["מנוחה והגשה",`${c.rest||5} דק׳ מנוחה. ${offal?'הגש עם לימון/צ׳ימיצ׳ורי.':produce?'תבל והגש.':'פרוס נגד הסיב.'}`,(c.rest||5)*60]);
  return steps;
}
const SMOKER_TIPS={
  'ארון / קבינט':'מעשנת ארון: טמפ׳ יציב מאוד — מצוין ל-low & slow ארוך. נצל את המדפים לכמות. זרימת אוויר נמוכה יחסית — ודא pellicle יבש לפני העישון כדי שהעשן ייצמד.',
  'אופסט / סטיק-ברנר':'אופסט: נהל אש קטנה ונקייה (עשן כחלחל). הצד העבה/שומן לכיוון תא-האש, וסובב את הנתח באמצע — יש הפרש חום לאורך התא.',
  'פלטים':'פלט: שגר-ושכח. לעשן חזק יותר — הוסף צינור/מבוך עשן (smoke tube), ועשן ב-max smoke בשעתיים הראשונות כשהבשר קר.',
  'קמאדו / קרמי':'קמאדו: יציב וחסכוני. שים דפלקטור לחום עקיף, כוונן בעדינות עם הפתחים, והמתן שהטמפ׳ תתייצב לפני הכנסת הבשר.',
  'WSM / חבית':'WSM/חבית: מלא את קערת המים לייצוב, שיטת מיניון לפחם, ושמור את הפתחים התחתונים לכיוון האש.',
  'קטל (ככלי עישון)':'קטל: הגדר 2 אזורים (גחלים בצד), הבשר בצד הקר, נתח עץ על הגחלים. הוסף פחם כל ~שעה.',
  'גז (עם תיבת עשן)':'גז: הדלק מבער אחד בלבד לחום עקיף, תיבת עשן עם שבבים על המבער הפעיל, והבשר בצד הכבוי.',
  'חשמלי':'חשמלי: יציב וקל אך עשן חלש — הוסף שבבים לאורך הבישול לשמירת עשן רציף.'
};
function smokerTip(){ if(!gearConfigured()) return ''; const g=gearState(); return (g.smoker&&g.smoker!=='אין')?SMOKER_TIPS[g.smoker]||'':''; }
function preheatHint(){ if(!gearConfigured()) return '45 דק׳ ייצוב'; const g=gearState(); const s=g.smoker;
  if(s==='פלטים') return '~15 דק׳ (פלט מתחמם מהר)';
  if(s==='גז (עם תיבת עשן)') return '~10–15 דק׳';
  if(s==='חשמלי'||s==='ארון / קבינט') return '~20–30 דק׳';
  if(s&&s!=='אין') return 'ארובת פחם ~30–45 דק׳';
  return '45 דק׳ ייצוב'; }
function gearMissingHelp(c, methods){
  const g=gearState();
  const items=methods.map(m=>{
    if(m==='sv'){
      const alt=(c.sot?`עישון-בלבד (הנתח תומך: ~${c.soh}ש ב-${c.sot}°C)`:(canSmoke()?'עישון':canGrill()?'גריל עם גימור זהיר':'בישול איטי בתנור'));
      return {ic:'🌊',name:'סו-ויד',alt,altnote:'מרקם: סו-ויד נותן אחידות פנימית; החלופה תיתן קרום/עישון חזק יותר.',buy:'סו-ויד טבילה (immersion) — קומפקטי וזול יחסית.'};
    }
    if(m==='smoke'){
      const alt=(canGrill()?'עישון בגריל עקיף (2-zone) עם תיבת עשן / נתחי עץ על הגחלים':(canSV()?'סו-ויד + גימור (בלי טעם עשן)':'בישול בתנור נמוך'));
      return {ic:'💨',name:'עישון',alt,altnote:'ללא מעשנה ייעודית, גריל עקיף עם עץ נותן טעם עשן טוב.',buy:'מעשנת פחם (WSM/חבית), קמאדו, או ארון.'};
    }
    if(m==='grill'){
      const alt=(g.torch&&g.torch!=='אין')?'גימור במבער/לפיד':'צריבה במחבת ברזל-יצוק חמה מאוד';
      return {ic:'🔥',name:'גריל',alt,altnote:'לגימור/צריבה — מחבת ברזל יצוק או מבער נותנים קרום מצוין.',buy:'גריל פחם/גז, או מבער ידני לגימור.'};
    }
    return null;
  }).filter(Boolean);
  if(!items.length) return '';
  return `<div class="gear-alt">${items.map(it=>`<div class="ga-row"><div class="ga-h">${it.ic} אין לך <b>${it.name}</b></div>
    <div class="ga-line">↳ <b>חלופה:</b> ${it.alt}</div>
    <div class="ga-sub">${it.altnote}</div>
    <div class="ga-line">🛒 <b>לשדרוג:</b> ${it.buy}</div></div>`).join('')}
    <div class="ga-foot">🔒 אפשר להפעיל בכל זאת (override) אם יש גישה זמנית · לעדכון הציוד: ☰ ← הציוד שלי.</div></div>`;
}
function methodToggleHTML(c,key){
  const r=methodRules(c), act=ctxMethods(c,key);
  const defs=[['sv','🌊 סו-ויד'],['smoke','💨 עישון'],['grill','🔥 גריל']];
  const offMethods=[];
  const row=`<div class="mtoggles" data-mtkey="${key}">${defs.map(([m,l])=>{
    const allowed=r.allowed.includes(m), on=act.includes(m);
    const gearOff=allowed && !gearCan(m); if(gearOff) offMethods.push(m);
    const cls=`mtoggle ${on?'on':''} ${allowed?'':'locked'} ${gearOff?'gear-off':''}`;
    const tag=gearOff?` <span class="gear-tag">🔒</span>`:'';
    return `<button class="${cls}" data-mt="${m}" ${allowed?'':'disabled title="לא זמין לפריט זה"'}>${l}${tag}</button>`;
  }).join('')}<span class="mtoggle-hint">שיטות פעילות — התוכנית מתעדכנת</span></div>`;
  let extra='';
  if(act.includes('smoke')){ const t=smokerTip(); if(t) extra+=`<div class="smoker-tip">💡 <b>טיפ למעשנה שלך:</b> ${t}</div>`; }
  extra+=gearThermoNote(c);
  return row + gearMissingHelp(c, offMethods) + extra;
}
function gearThermoNote(c){
  if(!gearConfigured()) return ''; const g=gearState(); const th=g.thermo;
  if(!th || th==='אין') return `<div class="thermo-note">🌡️ <b>אין לך מדחום:</b> עבוד לפי זמן ומבחני מגע/צבע. לבטיחות (בעיקר עוף ובשר טחון) — מדחום מיידי הוא הדבר הכי מומלץ לרכוש; בלעדיו קשה לוודא ${c&&c.safe?c.safe+'°C':'טמפ׳ בטוחה'} במרכז.</div>`;
  if(th==='בקר-מאוורר') return `<div class="thermo-note ok">🌡️ <b>בקר-מאוורר:</b> הגדר יעד פיט ופרוב בשר — הוא ישמור על הטמפ׳ ויתריע. "הגדר ולך".</div>`;
  return '';
}

/* ---------- recipe engine ---------- */
function isProduce(c){return c.cat==='ירקות'||c.cat==='פירות';}
function isOffal(c){return c.cat==='איברים פנימיים';}
function isGrillableMeat(c){ return !isProduce(c) && (!!c.doneness || isOffal(c)); }  // fast cuts + all offal (asado classics)
function offalPrep(c){
  const e=c.eng||'';
  if(e.includes('Sweetbread')) return "בלאנץ׳ 3-5 דק׳ במים רותחים עם לימון → אמבט קרח → קלף קרום → ייבוש ולחיצה קלה במקרר שעה. זה הסוד למרקם קריספי-קרמי.";
  if(e.includes('Kidney'))     return "חצה, הסר את הליבה הלבנה, והשרה בחלב/מי-מלח 30-60 דק׳ להעדנת הטעם. יבש היטב.";
  if(e.includes('Brain'))      return "השרה במים קרים שעה, קלף קרומים בעדינות, בלאנץ׳ קצר 2-3 דק׳ במים עם חומץ → קרח. עדין מאוד — טפל ברכות.";
  if(e.includes('Gizzard'))    return "קורקבנים חייבים בישול-מקדים לרכות: סו-ויד 90° או בישול איטי עד רכים, רק אז לגריל לחריכה קצרה.";
  if(e.includes('Liver'))      return "הסר קרומים וכלי דם. פרוס עבה (2 ס\"מ) כדי שלא יתייבש. אפשר השריה קצרה בחלב לעידון.";
  return "נקה קרומים ושומן עודף, יבש היטב. חתוך לגודל אחיד.";
}
function offalDoneNote(c){
  const e=c.eng||'';
  if(e.includes('Heart')) return `צלה חם ומהיר כמו סטייק — מדחום פנים ${c.tgt}°.`;
  if(e.includes('Liver')||e.includes('Kidney')) return `בטיחות: בשל עד ${c.tgt}° — ללא ורוד (איבר נקבובי).`;
  if(e.includes('Sweetbread')||e.includes('Brain')) return `צלה עד זהוב-קריספי מבחוץ וקרמי בפנים (~${c.tgt}°).`;
  if(e.includes('Gizzard')) return `אחרי הריכוך — רק חריכה קצרה לטעם אש.`;
  return `יעד פנים ${c.tgt}°.`;
}
function meatGrillSteps(c){
  const dtgt=(typeof donenessTarget==='function' && c.doneness)? donenessTarget(c) : c.tgt;
  const pull=Math.max(40, dtgt-4);   // pull ~4° early for carryover
  const offal=isOffal(c);
  const steps=[];
  if(offal){
    steps.push(["הכנה ייעודית לאיבר", offalPrep(c), 0]);
    steps.push(["הכנה לצלייה",`שיפוד עוזר לחלקים קטנים (לבבות/כליות). את התיבול עושים קרוב לצלייה — מלח מוקדם מוציא נוזלים.`,0]);
    steps.push(["חימום גריל",`אש ישירה חמה-בינונית. חמם שבכה 10 דק׳, נקה ושמן קלות (על האוכל, לא השבכה).`,0]);
    steps.push(["צלייה",`צלה 2-4 דק׳/צד עד השחמה יפה. ${offalDoneNote(c)}`,300]);
    steps.push(["הגשה",`מנוחה קצרה ${c.rest||3} דק׳. הגש עם לימון/צ׳ימיצ׳ורי — הקלאסיקה של האסאדו.`,(c.rest||3)*60]);
    return steps;
  }
  steps.push(["טמפרטורת חדר",`הוצא מהמקרר 30-40 דק׳ לפני. יבש היטב במגבת — משטח יבש = צריבה טובה.`,0]);
  steps.push(["2 אזורים + חימום",`בנה שני אזורים: צד חם מאוד (ישיר, 250°+) וצד קר (עקיף). חמם את השבכה 10-15 דק׳ ונקה.`,0]);
  steps.push(["צריבה על אש ישירה",`הנח על הצד החם וצרוב 2-4 דק׳/צד עד קרום וסימני שבכה. הפוך פעם אחת (אל תזיז מוקדם מדי).`,300]);
  steps.push(["גמר באזור הקר + מדחום",`העבר לצד הקר וסגור מכסה. בשל עד מדחום פנים ${pull}° (יעד ${dtgt}° אחרי carryover). נתח דק — דלג ישר לכאן.`,0]);
  steps.push(["מנוחה",`הנח לנוח ${c.rest||5} דק׳ — הטמפ׳ תעלה עוד ~3-5° והמיצים יתייצבו. פרוס נגד הסיב.`,(c.rest||5)*60]);
  return steps;
}
// ── context-scoped seasoning: template stays clean, instance saved per cook/event/project ──
function seasCtx(){
  if(curProject) return 'proj:'+curProject;
  if(typeof menuCtx==='function' && menuCtx()==='event'){ const a=(typeof evActive==='function')?evActive():null; return 'ev:'+(a||'cur'); }
  return 'cook';
}
function seasKeyFor(key){ return 'seas:'+seasCtx()+':'+key; }
function houseRubId(key){ return (DATA.houseRub||{})[key]||null; }
// raw stored value: null = not customized (use template default), ['__none__'] = explicit none
function rawSeas(key){ const v=store.get(seasKeyFor(key)); return Array.isArray(v)?v:null; }
function selectedSeasonings(key){
  const raw=rawSeas(key);
  if(raw===null){ const hr=houseRubId(key); return hr?[hr]:[]; }   // template default = house rub
  if(raw.length===1 && raw[0]==='__none__') return [];             // explicit "ללא"
  return raw.filter(x=>x!=='__none__');
}
function toggleSeasoning(key,id){
  const cur=selectedSeasonings(key);
  let next=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];
  if(!next.length) next=['__none__'];   // persist explicit none so default doesn't re-appear
  store.set(seasKeyFor(key),next);
  return !cur.includes(id);
}
function seasoningById(id){return (DATA.seasonings||[]).find(s=>s.id===id);}
// inject selected seasonings into a composed step plan
function injectSeasoningSteps(steps, key, tmpl){
  const src=tmpl ? (houseRubId(key)?[houseRubId(key)]:[]) : selectedSeasonings(key);
  const sel=src.map(seasoningById).filter(Boolean);
  if(!sel.length){ const out=[...steps]; out.splice(1,0,['🧂 תיבול בסיסי',`מלח גס נדיב (ופלפל) מכל הצדדים — גם בלי ראב, מלח הוא חובה.`,0]); return out; }
  const out=[...steps];
  const marinades=sel.filter(s=>s.kind==='marinade');
  const rubs=sel.filter(s=>s.kind==='rub');
  const glazes=sel.filter(s=>s.kind==='glaze');
  const sauces=sel.filter(s=>s.kind==='sauce');
  let ins=1; // after first prep step
  marinades.forEach(s=>{ out.splice(ins++,0,[`🥣 מרינדה: ${s.heb}`,`${s.ing} — ${s.use}`,0]); });
  rubs.forEach(s=>{ out.splice(ins++,0,[`🌶️ ראב: ${s.heb}`,`${s.ing} — שפשף היטב לפני הבישול.`,0]); });
  // glaze before the rest step (or at end)
  let restIdx=out.findIndex(st=>st[0].includes('מנוחה'));
  if(restIdx<0) restIdx=out.length;
  glazes.forEach(s=>{ out.splice(restIdx++,0,[`🍯 גלייז: ${s.heb}`,`${s.ing} — מברישים ב-10-15 הדקות האחרונות של הבישול, בשכבות.`,0]); });
  sauces.forEach(s=>{ out.splice(restIdx+1,0,[`🥄 רוטב הגשה: ${s.heb}`,`${s.ing} — אפשר להכין מראש (אפילו יום קודם). הגש לצד.`,0]); restIdx++; });
  return out;
}
const KIND_LABEL={rub:'ראב יבש',marinade:'מרינדה',glaze:'גלייז',sauce:'רוטב'};
const KIND_EMOJI={rub:'🌶️',marinade:'🥣',glaze:'🍯',sauce:'🥄'};
function seasoningsFor(cat, produce){
  return (DATA.seasonings||[]).filter(s=> produce? s.produce : s.cats.includes(cat));
}
function cont2color(cont){return {'אמריקה':'#c0563a','דרום אמריקה':'#4f8a3d','ישראל/מזה"ת':'#d99a2b','אפריקה':'#a24d5e','אירופה':'#7a90c2','אסיה':'#c94f6d'}[cont]||'#b5603a';}
function seasoningDetailHTML(s){
  return `<div class="seas-detail">
    <div class="seas-head"><span class="seas-kind" style="--sc:${cont2color(s.cont)}">${KIND_EMOJI[s.kind]} ${KIND_LABEL[s.kind]}</span><span class="seas-origin">${s.origin}</span></div>
    <h3 class="seas-title">${s.heb} <small>${s.eng}</small></h3>
    <div class="seas-sec"><h5>מרכיבים ויחסים</h5><p>${s.ing}</p></div>
    <div class="seas-sec"><h5>שימוש והכנה</h5><p>${s.use}</p></div>
    <div class="seas-sec"><h5>מתאים ל־</h5><p>${s.produce?'ירקות ופירות · ':''}${s.cats.join(' · ')}</p></div>
    ${s.sub?`<div class="seas-sec seas-sub"><h5>⚠ תחליף בישראל</h5><p>${s.sub}</p></div>`:''}
  </div>`;
}
let seasFilter={kind:'', cont:'', cat:'', q:'', flavor:'', base:'', heat:''};
let seasCtxKey=null; // when set, browser cards get a ＋ button adding to this instance
/* ══════════ unified seasoning picker (Phase C) ══════════
   5 filter axes: ⭐recommended · 🌍continent · 👅flavor · 🧪base · 🌶️heat
   one-per-kind selection · house rub default · explicit "ללא" · per-recipe recs */
const SPK_FLAVORS=['מתוק','חמצמץ','חריף','מעושן','עשבי','הדרי','ארומטי-חם','אגוזי','אומאמי'];
const SPK_BASES=['יבש','שמן','יוגורט','עגבניות','רכז-פירות','חמאה'];
const SPK_HEAT=[[0,'😌 עדין'],[1,'🌶 קל'],[2,'🌶🌶 חריף'],[3,'🔥 בוער']];
const SPK_CONTS=['אמריקה','דרום אמריקה','אירופה','אסיה','אפריקה','ישראל/מזה"ת'];
let seasPkState={};
function spkState(key){ return seasPkState[key]=seasPkState[key]||{axis:'rec',val:'',expand:{}}; }
// per-recipe recommendations: house rub ALWAYS first, then spread across kinds for this category
function recsFor(key, cat, isProd){
  const all=seasoningsFor(cat,isProd);
  const hr=key?houseRubId(key):null;
  const out=[]; const seen=new Set();
  if(hr){ const h=seasoningById(hr); if(h){ out.push(h); seen.add(hr); } }
  const order=['rub','marinade','glaze','sauce'];
  const perKind={}; all.forEach(s=>{ if(!seen.has(s.id)){ (perKind[s.kind]=perKind[s.kind]||[]).push(s); } });
  let i=0; while(out.length<8 && i<24){ const k=order[i%4]; if(perKind[k]&&perKind[k].length){ const s=perKind[k].shift(); out.push(s); seen.add(s.id); } i++; if(i>=4 && !order.some(k=>perKind[k]&&perKind[k].length)) break; }
  return out;
}
function spkChip(s, opts){
  const sel=opts.selected, house=opts.house, rec=opts.rec, mode=opts.mode;
  const marks=(house?'🏠':'')+(rec&&!house?'⭐':'');
  const heatDots=s.heat?('🌶'.repeat(Math.min(s.heat,3))):'';
  return `<div class="spk-chip ${sel?'sel':''} ${house?'house':''}">
    <button class="spk-info" data-spkinfo="${s.id}" title="הצג פרטים · ${(s.origin||'')}">${marks?`<span class="spk-mark">${marks}</span>`:''}<span class="spk-heb">${s.heb}</span>${heatDots?`<span class="spk-heat">${heatDots}</span>`:''}</button>
    <button class="spk-add" data-spkpick="${s.id}" data-spkkind="${s.kind}" ${mode==='view'?'disabled':''} title="${sel?'הסר מהמופע':'הוסף למופע'}">${sel?'✓':'＋'}</button>
  </div>`;
}
function seasPickerHTML(key, cat, isProd, mode){
  const st=spkState(key);
  const all=seasoningsFor(cat,isProd);
  if(!all.length) return '';
  const recs=recsFor(key,cat,isProd);
  const recIds=new Set(recs.map(s=>s.id));
  const hr=key?houseRubId(key):null;
  const picked=(mode==='view') ? (hr?[hr]:[]) : selectedSeasonings(key);   // view = template default, never the instance
  // axis filtering
  const match=s=>{
    if(st.axis==='rec') return recIds.has(s.id);
    if(st.axis==='cont') return !st.val || s.cont===st.val;
    if(st.axis==='flavor') return !st.val || (s.flavor||[]).includes(st.val);
    if(st.axis==='base') return !st.val || s.base===st.val;
    if(st.axis==='heat') return st.val==='' || String(s.heat)===String(st.val);
    return true;
  };
  const AX=[['rec','⭐ מומלצים'],['cont','🌍 מדינה'],['flavor','👅 טעם'],['base','🧪 בסיס'],['heat','🌶️ חריפות']];
  const tabs=`<div class="spk-tabs">${AX.map(([a,l])=>`<button class="spk-tab ${st.axis===a?'on':''}" data-spkaxis="${a}">${l}</button>`).join('')}${(typeof aiAvail==='function'&&aiAvail()&&mode!=='view')?`<button class="spk-tab spk-ai" data-spkairec style="background:var(--fresh-l);border-color:var(--fresh);color:var(--fresh)">✨ המלץ AI</button>`:''}</div>`;
  let vals='';
  if(st.axis==='cont') vals=SPK_CONTS.map(v=>`<button class="spk-val ${st.val===v?'on':''}" data-spkval="${v}">${v}</button>`).join('');
  else if(st.axis==='flavor') vals=SPK_FLAVORS.map(v=>`<button class="spk-val ${st.val===v?'on':''}" data-spkval="${v}">${v}</button>`).join('');
  else if(st.axis==='base') vals=SPK_BASES.map(v=>`<button class="spk-val ${st.val===v?'on':''}" data-spkval="${v}">${v}</button>`).join('');
  else if(st.axis==='heat') vals=SPK_HEAT.map(([v,l])=>`<button class="spk-val ${String(st.val)===String(v)?'on':''}" data-spkval="${v}">${l}</button>`).join('');
  const valsRow=vals?`<div class="spk-vals">${vals}</div>`:'';
  const KE=KIND_EMOJI, KL=KIND_LABEL;
  const kinds=['rub','marinade','glaze','sauce'].map(kind=>{
    const inKind=all.filter(s=>s.kind===kind);
    if(!inKind.length) return '';
    let list=inKind.filter(match);
    // recommended pinned first within the kind
    list.sort((a,b)=>(recIds.has(b.id)-recIds.has(a.id)) || ((b.id===hr)-(a.id===hr)));
    if(a=>a){ /* noop */ }
    const curSel=picked.find(id=>{const s=seasoningById(id);return s&&s.kind===kind;})||'';
    const CAP=12; const exp=st.expand[kind];
    const shown=exp?list:list.slice(0,CAP);
    const noneChip=`<div class="spk-chip none ${!curSel?'sel':''}"><button class="spk-only" data-spknone="${kind}" ${mode==='view'?'disabled':''}>ללא${!curSel?' ✓':''}</button></div>`;
    const more=list.length>CAP&&!exp?`<button class="spk-more" data-spkmore="${kind}">עוד ${list.length-CAP} ›</button>`:'';
    const empty=!list.length?`<span class="spk-empty">אין ${KL[kind]} בסינון הזה</span>`:'';
    return `<div class="spk-kind"><div class="spk-kh">${KE[kind]} ${KL[kind]}${curSel?` <b class="spk-cur">· ${(seasoningById(curSel)||{}).heb||''}</b>`:''}</div>
      <div class="spk-chips">${noneChip}${shown.map(s=>spkChip(s,{selected:picked.includes(s.id),house:s.id===hr,rec:recIds.has(s.id),mode})).join('')}${more}${empty}</div></div>`;
  }).join('');
  const inEvent=(typeof menuCtx==='function'&&menuCtx()==='event');
  const otherKeys=(()=>{ try{ const m=menuState(); return (m.keys||[]).filter(k=>k!==key).length; }catch(e){ return 0; } })();
  const ctaButtons=inEvent
    ? `<button class="spk-editbtn" data-spkgotl="1">🧂 לבחירת תיבול באשף האירוע ←</button>`
    : (otherKeys>0
        ? `<button class="spk-editbtn" data-spkfresh="1">🍳 בישול חדש — רק הפריט הזה</button> <button class="spk-editbtn" data-spkgotl="1">➕ צרף לתוכנית (${otherKeys})</button>`
        : `<button class="spk-editbtn" data-spkgotl="1">🧂 בחר תיבול ותזמן ←</button>`);
  const viewNote=mode==='view'?`<div class="spk-viewnote">📌 תצוגת תבנית — ראב הבית 🏠 הוא ברירת המחדל. התאמה אישית נעשית בביצוע ונשמרת לו בלבד. ${ctaButtons}</div>`:'';
  const cnt=picked.length;
  return `<div class="var spk-box" id="spk-${key}">
    <h4>🧂 תיבול ${mode==='view'?'<span style="font-weight:400;font-size:11.5px;color:var(--smoke)">(תבנית · ברירת מחדל: ראב הבית)</span>':(cnt?`<span class="seas-count">· ${cnt} נבחרו</span>`:'')}</h4>
    ${viewNote}${mode==='edit'?tabs+valsRow:''}${kinds}
    <button class="seasoning-more" data-seasall="${isProd?'__produce':cat}">📖 דפדוף מלא במאגר ›</button>
  </div>`;
}
function spkGoInstance(key, backFn, fresh){
  const m=(typeof menuState==='function')?menuState():{keys:[]};
  m.keys=m.keys||[];
  if(fresh){ m.keys=[key]; if(typeof saveMenu==='function') saveMenu(m); }
  else if(!m.keys.includes(key)){ m.keys.push(key); if(typeof saveMenu==='function') saveMenu(m); }
  if(typeof updateCartBadge==='function') updateCartBadge();
  window._tlSeasOpen=window._tlSeasOpen||new Set(); window._tlSeasOpen.add(key);
  const ev=(typeof menuCtx==='function'&&menuCtx()==='event');
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('wizard');
  if(typeof cwGo==='function') cwGo(3);
  if(typeof toast==='function') toast(ev?'הפריט נוסף לאירוע — בחר תיבול כאן':(fresh?'בישול חדש נפתח — בחר תיבול':'הפריט צורף — בחר תיבול'));
}
function wireSeasPicker(host, key, cat, isProd, mode, onChange, backFn){
  const box=host.querySelector('#spk-'+CSS.escape(key)); if(!box) return;
  const rerender=()=>{ const nb=document.createElement('div'); nb.innerHTML=seasPickerHTML(key,cat,isProd,spkState(key).mode||mode); box.replaceWith(nb.firstElementChild); wireSeasPicker(host,key,cat,isProd,mode,onChange,backFn); };
  box.querySelectorAll('[data-spkinfo]').forEach(ib=>ib.addEventListener('click',()=>{
    const s=seasoningById(ib.dataset.spkinfo); if(!s) return;
    const show=()=>showPanel(`${toolTop(s.heb, s.eng+' · '+s.origin, KIND_EMOJI[s.kind], cont2color(s.cont))}<div class="panel-body">${seasoningDetailHTML(s)}</div>`);
    if(backFn && typeof openFrom==='function') openFrom(backFn, show); else show();
  }));
  box.querySelectorAll('[data-seasall]').forEach(mb=>mb.addEventListener('click',()=>{
    const val=mb.dataset.seasall;
    if(backFn && typeof openFrom==='function') openFrom(backFn, ()=>openSeasonings(val, key));
    else openSeasonings(val, key);
  }));
  box.querySelectorAll('[data-spkaxis]').forEach(b=>b.addEventListener('click',()=>{ const st=spkState(key); st.axis=b.dataset.spkaxis; st.val=''; rerender(); }));
  box.querySelectorAll('[data-spkairec]').forEach(b=>b.addEventListener('click',()=>{ openSeasonRecAI(key, cat, isProd, ()=>{ if(typeof spkGoInstance==='function') spkGoInstance(key, backFn); }); }));
  box.querySelectorAll('[data-spkval]').forEach(b=>b.addEventListener('click',()=>{ const st=spkState(key); st.val=(String(st.val)===String(b.dataset.spkval))?'':b.dataset.spkval; rerender(); }));
  box.querySelectorAll('[data-spkmore]').forEach(b=>b.addEventListener('click',()=>{ spkState(key).expand[b.dataset.spkmore]=true; rerender(); }));
  box.querySelectorAll('[data-spkgotl]').forEach(b=>b.addEventListener('click',()=>spkGoInstance(key, backFn)));
  box.querySelectorAll('[data-spkfresh]').forEach(b=>b.addEventListener('click',()=>spkGoInstance(key, backFn, true)));
  box.querySelectorAll('[data-spkpick]').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return;
    const id=b.dataset.spkpick, kind=b.dataset.spkkind;
    const cur=selectedSeasonings(key);
    cwApplySeasKind(key, kind, cur.includes(id)?'':id);
    rerender(); if(onChange) onChange();
  }));
  box.querySelectorAll('[data-spknone]').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return;
    cwApplySeasKind(key, b.dataset.spknone, '');
    rerender(); if(onChange) onChange();
  }));
}
function openSeasonings(presetCat, ctxKey){
  seasCtxKey=ctxKey||null;
  const ctxMeta=seasCtxKey?resolveItem(seasCtxKey):null;
  const sub=(DATA.seasonings||[]).length+' מתכונים מ-6 יבשות'+(ctxMeta?` · ＋ מוסיף אל: ${ctxMeta.heb||seasCtxKey}`:' · סינון לפי סוג, מדינה, טעם, בסיס וחריפות');
  showPanel(`${toolTop('מתבלים ורטבים',sub,'🧂','#b5603a')}
    <div class="panel-body" id="seasBody"></div>`);
  seasFilter={kind:'', cont:'', cat:(presetCat&&presetCat!=='__all')?presetCat:'', q:'', flavor:'', base:'', heat:''};
  renderSeasonings();
}
function openSeasoningDetail(id, backCat){
  const keepCtx=seasCtxKey;
  openFrom(()=>openSeasonings(backCat, keepCtx), ()=>{
    const s=(DATA.seasonings||[]).find(x=>x.id===id); if(!s) return;
    showPanel(`${toolTop(s.heb, s.eng+' · '+s.origin, KIND_EMOJI[s.kind], cont2color(s.cont))}<div class="panel-body">${seasoningDetailHTML(s)}</div>`);
  });
}
function renderSeasonings(){
  const host=$("#seasBody"); if(!host) return;
  const all=DATA.seasonings||[];
  const q=(seasFilter.q||'').toLowerCase();
  const list=all.filter(s=>{
    if(seasFilter.kind && s.kind!==seasFilter.kind) return false;
    if(seasFilter.cont && s.cont!==seasFilter.cont) return false;
    if(seasFilter.flavor && !(s.flavor||[]).includes(seasFilter.flavor)) return false;
    if(seasFilter.base && s.base!==seasFilter.base) return false;
    if(seasFilter.heat!=='' && String(s.heat)!==String(seasFilter.heat)) return false;
    if(seasFilter.cat){ if(seasFilter.cat==='__produce'){ if(!s.produce) return false; } else if(!s.cats.includes(seasFilter.cat)) return false; }
    if(q && !(s.heb+' '+s.eng+' '+s.ing+' '+s.origin).toLowerCase().includes(q)) return false;
    return true;
  });
  const kinds=[['','הכל'],['rub','🌶️ ראבים'],['marinade','🥣 מרינדות'],['glaze','🍯 גלייזים'],['sauce','🥄 רטבים']];
  const conts=['','אמריקה','דרום אמריקה','ישראל/מזה"ת','אפריקה','אירופה','אסיה'];
  host.innerHTML=`
    <div class="searchbar" style="margin-bottom:10px"><input id="seasQ" type="search" placeholder="חפש מתבל, מרכיב או מקור…" value="${seasFilter.q||''}"><span class="ic">⌕</span></div>
    <div class="chips">${kinds.map(([k,l])=>`<span class="chip ${seasFilter.kind===k?'on':''}" data-sk="${k}">${l}</span>`).join('')}</div>
    <div class="chips" style="margin-top:6px">${conts.map(c=>`<span class="chip ${seasFilter.cont===c?'on':''}" data-scont="${c}">${c||'כל היבשות'}</span>`).join('')}</div>
    <div class="chips" style="margin-top:6px">${[['','כל טעם'],...SPK_FLAVORS.map(f=>[f,f])].map(([v,l])=>`<span class="chip ${seasFilter.flavor===v?'on':''}" data-sflav="${v}">👅 ${l}</span>`).join('')}</div>
    <div class="chips" style="margin-top:6px">${[['','כל בסיס'],...SPK_BASES.map(x=>[x,x])].map(([v,l])=>`<span class="chip ${seasFilter.base===v?'on':''}" data-sbase="${v}">🧪 ${l}</span>`).join('')}${[['','כל חריפות'],...SPK_HEAT.map(([v,l])=>[String(v),l])].map(([v,l])=>`<span class="chip ${String(seasFilter.heat)===v?'on':''}" data-sheat="${v}">${l}</span>`).join('')}</div>
    ${seasFilter.cat?`<div class="count">מסונן ל: ${seasFilter.cat==='__produce'?'ירקות/פירות':seasFilter.cat} · <button class="linklike" data-seasclear>נקה</button></div>`:''}
    <div class="count">${list.length} מתבלים</div>
    <div class="seas-grid">${list.map(s=>{
      const sel=seasCtxKey?selectedSeasonings(seasCtxKey).includes(s.id):false;
      const add=seasCtxKey?`<button class="seas-cardadd ${sel?'sel':''}" data-scadd="${s.id}" data-sckind="${s.kind}" title="${sel?'הסר מהמופע':'הוסף למופע'}">${sel?'✓':'＋'}</button>`:'';
      return `<div class="seas-cardwrap">${add}<button class="seas-card ${sel?'sel':''}" data-seas="${s.id}" style="--sc:${cont2color(s.cont)}">
      <div class="seas-card-top"><span>${KIND_EMOJI[s.kind]}</span><span class="seas-card-origin">${s.origin}</span></div>
      <b>${s.heb}</b><small>${s.eng}</small>
      <span class="seas-card-kind">${KIND_LABEL[s.kind]}${s.sub?' · ⚠ תחליף':''}</span>
    </button></div>`;}).join('')||'<div class="shop-empty">לא נמצאו מתבלים בסינון הזה</div>'}</div>`;
  const sq=$("#seasQ"); if(sq) sq.addEventListener('input',()=>{seasFilter.q=sq.value; renderSeasonings();});
  host.querySelectorAll('[data-sk]').forEach(b=>b.addEventListener('click',()=>{seasFilter.kind=b.dataset.sk; renderSeasonings();}));
  host.querySelectorAll('[data-scont]').forEach(b=>b.addEventListener('click',()=>{seasFilter.cont=b.dataset.scont; renderSeasonings();}));
  host.querySelectorAll('[data-sflav]').forEach(b=>b.addEventListener('click',()=>{seasFilter.flavor=b.dataset.sflav; renderSeasonings();}));
  host.querySelectorAll('[data-sbase]').forEach(b=>b.addEventListener('click',()=>{seasFilter.base=b.dataset.sbase; renderSeasonings();}));
  host.querySelectorAll('[data-sheat]').forEach(b=>b.addEventListener('click',()=>{seasFilter.heat=b.dataset.sheat; renderSeasonings();}));
  const sc=host.querySelector('[data-seasclear]'); if(sc) sc.addEventListener('click',()=>{seasFilter.cat=''; renderSeasonings();});
  host.querySelectorAll('[data-seas]').forEach(b=>b.addEventListener('click',()=>openSeasoningDetail(b.dataset.seas, seasFilter.cat)));
  host.querySelectorAll('[data-scadd]').forEach(b=>b.addEventListener('click',(ev)=>{
    ev.stopPropagation();
    if(!seasCtxKey) return;
    const id=b.dataset.scadd, kind=b.dataset.sckind;
    const was=selectedSeasonings(seasCtxKey).includes(id);
    cwApplySeasKind(seasCtxKey, kind, was?'':id);
    renderSeasonings();
    if(typeof toast==='function'){ const s=seasoningById(id); toast(was?`${s.heb} הוסר מהמופע`:`${s.heb} נבחר (${KIND_LABEL[kind]}) — הקודם מאותו סוג הוחלף`); }
  }));
}
// produce: "גריל / עישון" path (direct fire) — no meat prep/pasteurization language
function produceGrillSteps(c){
  const fruit=c.cat==='פירות';
  const steps=[];
  steps.push(["הכנה",fruit?`שטוף, חצה/פרוס לפי הצורך. אין צורך בקילוף אלא אם רלוונטי.`:`שטוף ונקה. פרוס/חתך לגודל אחיד כך שלא ייפול בין השבכות (${c.somid||'ראה טיפ'}).`,0]);
  steps.push(["שימון",`מרח שמן על הצומח (לא על השבכה!).`,0]);
  steps.push(["חימום הגריל",`חמם גריל לחום ${c.smt>=230?'גבוה':'בינוני-גבוה'} (${c.smt}°C). ${c.wood&&c.wood!=='ללא'?`אפשר להוסיף צ'אנק ${c.wood} לניחוח עשן.`:''}`,0]);
  steps.push(["צלייה על אש ישירה",`הנח על השבכה וצלה ${c.soh} שעות (~${Math.round(upperHours(c.soh)*60)} דק׳). ${c.somid||''}. הפוך פעם-פעמיים עד סימני חריכה ומרקם רך-נגיס.`,upperHours(c.soh)*3600]);
  if(c.rest) steps.push(["הגשה",`הסר מהאש, ${fruit?'הגש חם עם התוספת המומלצת.':'זלף מעט שמן/לימון והגש חם או בטמפ׳ החדר.'}`,c.rest*60]);
  return steps;
}
// produce: sous-vide then finish (roots/starches) — precise softening, not pasteurization
function produceSVSteps(c){
  const steps=[];
  steps.push(["הכנה",`שטוף, קלף אם צריך וחתך לגודל אחיד (~1-2 ס\"מ) לבישול אחיד.`,0]);
  steps.push(["שקית עם חמאה/שמן",`סדר בשכבה אחת בשקית ואקום עם ${c.mid&&c.mid!=='אין'?c.mid:'חמאה/שמן זית ומלח'} — לצומח מוסיפים שומן לשקית (טעם עשיר יותר).`,0]);
  steps.push(["סו-ויד לריכוך",`בשל ב-${c.svt}°C למשך ${c.svh} שעות. בטמפ׳ ~83-90° הפקטין מתרכך והצומח נהיה רך-נגיס בלי להתמסמס — שליטה מדויקת במרקם, ללא צורך בפיסטור.`,upperHours(c.svh)*3600]);
  steps.push(["גימור באש/מחבת",`ייבש, ואז צרוב על גריל חם או במחבת עם חמאה ${c.smh} שעות (~${Math.round(upperHours(c.smh)*60)} דק׳) לצבע, קרמל וטעם עשן. ${c.somid||''}.`,upperHours(c.smh)*3600]);
  if(c.rest) steps.push(["הגשה",`תבל לסיום (מלח/הראב שנבחר) והגש.`,c.rest*60]);
  return steps;
}
// produce: low-and-slow smoking (great for cauliflower, cabbage, garlic, tomatoes, peppers)
function produceSmokeSteps(c){
  const fruit=c.cat==='פירות';
  const smokeT=Math.min(c.smt,120); // gentle smoke temp for produce
  const steps=[];
  steps.push(["הכנה",fruit?`שטוף, חצה/פרוס. פירות עמידים (אבטיח, אננס) סופגים עשן יפה.`:`שטוף ונקה. ${c.eng.includes('Garlic')?'חתוך קצה ראש השום וחשוף את השיניים.':c.eng.includes('Cauliflower')||c.eng.includes('Cabbage')?'השאר שלם או חצה לראש/סטייק — עישון איטי חודר עמוק.':'חתוך לגודל בינוני שיחזיק על השבכה.'}`,0]);
  steps.push(["שימון",`מרח שמן.${c.eng.includes('Garlic')?' לשום — אפשר לעטוף בנייר כסף עם שמן.':''}`,0]);
  steps.push(["הדלקת מעשנת",`ייצב מעשנת על ${smokeT}°C (חום נמוך) עם צ'אנקים ${c.wood&&c.wood!=='ללא'?c.wood:'תפוח/דובדבן'} — עצי פרי עדינים מתאימים במיוחד לצומח.`,0]);
  const smokeH=Math.max(0.5,upperHours(c.svh)); // use SV time as a proxy for gentle smoke duration
  steps.push(["עישון איטי",`עשן ב-${smokeT}°C למשך ${smokeH.toFixed(1)}-${(smokeH*1.5).toFixed(1)} שעות עד ריכוך וספיגת עשן. ${c.eng.includes('Garlic')?'עד רך וזהוב — ממרח מדהים.':'בדוק רכות עם מזלג.'}`,smokeH*3600]);
  steps.push(["גימור אופציונלי",`להעצמת צבע וקרמל — העבר לאש ישירה לכמה דקות בסוף, או הגש כמו שזה.`,0]);
  if(c.rest) steps.push(["הגשה",`תבל לסיום והגש חם או בטמפ׳ החדר.`,0]);
  return steps;
}
function svSteps(c,hintSear=true){
  const steps=[];
  let prep="נקה, גזום עודפי שומן ויבש היטב את הבשר.";
  if(c.eng.includes("Ribs")) prep="הסר את הקרום (membrane) מגב הצלעות ויבש היטב.";
  if(c.rub.includes("כבישה")) prep="בצע כבישה/ריפוי לפי המתכון, שטוף ויבש לפני התיבול.";
  steps.push(["הכנת הנתח",prep,0]);
  steps.push(["ואקום + סו-ויד",`סגור בשקית ואקום ובשל בסו-ויד ב-${c.svt}°C למשך ${c.svh} שעות. הפסטור נמדד מהרגע שמרכז הנתח מגיע לטמפ׳ — הוסף ~20% מרווח.${c.svt<55?' ⚠ בטמפ׳ מתחת ל-55°C אין להחזיק מעבר ל-4 שעות.':''}`,upperHours(c.svh)*3600]);
  if(PREP_TREAT.includes(c.mid)) steps.push([`טיפול: ${c.mid}`,treatText(c.mid),0]);
  let dry="ייבש את פני הבשר היטב לפני העישון — משטח יבש סופג עשן טוב יותר.";
  if(c.cat==="דג") dry="ייבש ליצירת pellicle (קרום דביק שסופג עשן) לפני העישון. ⚠ בטמפ׳ נמוכה — השתמש בדג סושי-גרייד או שהוקפא (-20°C, 7 ימים) לבטיחות מטפילים.";
  steps.push(["ייבוש לפני עישון",dry,0]);
  steps.push(["הדלקת מעשנת",`ייצב מעשנת על ${c.smt}°C עם צ'אנקים ${c.wood} ופחם ${c.coal}.`,0]);
  steps.push(["עישון",`עשן ב-${c.smt}°C למשך ${c.smh} שעות. אין צורך בעטיפה — הבישול הושלם בסו-ויד.`,upperHours(c.smh)*3600]);
  if(FINISH_TREAT.includes(c.mid)) steps.push([`טיפול: ${c.mid}`,treatText(c.mid),0]);
  if(c.sear==="גלייז") steps.push(["גלייז סיום",`מרח שכבת גלייז דביקה בסוף לברק וטעם.`,0]);
  else if(c.sear==="כן" && hintSear) steps.push(["רוצה קרום צרוב?",`💡 הנתח הזה נהנה מצריבה — הדלק את מתג 🔥 גריל והתוכנית תוסיף שלב צריבה מסודר.`,0]);
  if(c.safe) steps.push(["בדיקת בטיחות",`ודא טמפ' פנימית: יעד מרקם ${c.tgt}°C · מינימום בטיחות ${c.safe}°C${c.cat==='דג'?' (ולדג — ראה הערת טפילים למעלה)':''}.`,0]);
  if(c.rest) steps.push(["מנוחה",`תן מנוחה של ${c.rest} דקות לפני הפריסה.`,c.rest*60]);
  return steps;
}
function soSteps(c){
  const steps=[];
  let prep="נקה, גזום ויבש היטב את הבשר.";
  if(c.eng.includes("Ribs")) prep="הסר את הקרום מגב הצלעות ויבש.";
  if(c.rub.includes("כבישה")) prep="בצע כבישה/ריפוי, שטוף ויבש.";
  steps.push(["הכנת הנתח",prep,0]);
  steps.push(["הדלקת מעשנת",`ייצב מעשנת על ${c.sot}°C עם צ'אנקים ${c.wood} ופחם ${c.coal}.`,0]);
  steps.push(["עישון",`עשן ב-${c.sot}°C למשך ${c.soh} שעות עד טמפ' פנימית ${c.tgt}°C.${c.tgt>=88?` אפשר גם 'חם ומהיר' (120–135°C) כדי לפרוץ את ה'סטָאל' מהר יותר ולבנות קרום.`:''}`,upperHours(c.soh)*3600]);
  if(c.somid && c.somid!=="אין") steps.push([`טיפול: ${c.somid}`,soTreatText(c.somid)+(c.somid==='מריחה'||c.somid==='ריסוס'?' (ריסוס נוזל הוא אופציונלי-אסתטי — משפיע מעט על הטעם ומקרר קלות את הקרום).':''),0]);
  if(c.sear==="כן") steps.push(["רוצה קרום צרוב?",`💡 הנתח הזה נהנה מצריבה — הדלק את מתג 🔥 גריל לשלב צריבה מסודר בסוף.`,0]);
  if(c.safe) steps.push(["בדיקת בטיחות",`יעד ${c.tgt}°C · מינימום בטיחות ${c.safe}°C.`,0]);
  if(c.rest) steps.push(["מנוחה",`מנוחה ${c.rest} דקות לפני הפריסה.${c.tgt>=90?` לנתחי קולגן — החזקה ארוכה בקופסת בידוד (cambro/צידנית) של שעה+ משפרת מאוד עסיסיות.`:''}`,c.rest*60]);
  return steps;
}
function treatText(m){
  const map={"צינון":"צנן/החזק את הנתח לפני שלב העישון.","צינון מלא":"צנן את הנתח לחלוטין (אפילו לילה) — מקל על קרום וצריבה.",
   "ייבוש":"ייבש את פני הבשר/העור לקראת העישון.","ייבוש עור":"ייבש את העור היטב לעור פריך.",
   "קילוף קרום":"קלף את הקרום החיצוני של הלשון לאחר הבישול.","דקירת עור+ניקוז":"נקב את העור ונקז שומן עודף.",
   "חריטת עור":"חרוט את שכבת השומן בתבנית מעוינים.","ניקוז שומן":"נקז את השומן הנמס במהלך העישון.","הפיכת עור":"הפוך לצריבת העור בצד מטה."};
  return map[m]||m;
}
function soTreatText(m){
  if(m.startsWith("עטיפה")) return `ב'סטָאל' עטוף בנייר כסף/קצבים (${m}) כדי לעבור מהר ולשמר לחות.`;
  const map={"שיטת 3-2-1":"3 שעות עישון גלוי, 2 שעות עטוף עם נוזל, 1 שעה גלוי עם גלייז.",
   "שיטת 2-2-1":"2 שעות גלוי, 2 שעות עטוף עם נוזל, 1 שעה גלוי עם גלייז (לצלעות דקות).",
   "גלייז בסיום":"מרח גלייז דביק ב-30 הדקות האחרונות.","מריחה":"רסס/מרח נוזל לשמירת לחות וצבע.",
   "הפיכה":"הפוך באמצע לעישון אחיד.","סיבוב שיפוד":"סובב את השיפוד לעישון אחיד מכל הצדדים.",
   "עטיפת חזה":"עטוף את החזה בנייר כסף כשמגיע ליעד, להגן מייבוש.","דקירת עור+ניקוז":"נקב עור ונקז שומן.","דקירת עור":"נקב את העור לשחרור שומן."};
  return map[m]||m;
}

/* ---------- checklist + timer state ---------- */
const store={
  get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
// HTML-escape helper — MUST wrap any AI-authored or user-authored text before it enters innerHTML.
// AI answers can carry search-grounded, attacker-influenced markup; without this, "<img onerror>" would exfiltrate mk-gemkey.
const ESC_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>ESC_MAP[c]); }
// recipe-in-project context: when set, recipe steps read/write the project's doneSteps
let curProject=null, pendingProject=null;
function projById(id){ try{ return (store.get('mk-pantry')||[]).find(p=>p.id===id)||null; }catch(e){ return null; } }
let timers={}; // id -> interval

/* ---------- shopping cart state ---------- */
let cart=new Set(); // vestigial (shopping now lives in menuState); kept empty to avoid breakage
function saveCart(){/* mk-cart retired */}
function menuHasKey(key){ return (((typeof menuState==='function')&&menuState().keys)||[]).includes(key); }
/* state util: context-aware add/remove of an item in the active plan (no direct UI caller; used programmatically) */
function toggleCart(key){ const s=menuState(); s.keys=s.keys||[]; const i=s.keys.indexOf(key); if(i>=0)s.keys.splice(i,1); else s.keys.push(key); saveMenu(s); updateCartBadge(); render(); }
function updateCartBadge(){ const e=$("#cartN"); if(e) e.textContent=(((typeof menuState==='function')&&menuState().keys)||[]).length; }
/* add-to-menu affordance (UX): a real control wired to the existing toggleCart, on every card + the item panel */
function addMenuBtn(key){ const on=menuHasKey(key); const lbl=on?'הסר מהתפריט':'הוסף לתפריט'; return `<button class="addcart ${on?'on':''}" data-addmenu="${key}" aria-pressed="${on}" aria-label="${lbl}" title="${lbl}">${on?'✓':'＋'}</button>`; }
function syncAddMenuBtn(btn){ if(!btn) return; const on=menuHasKey(btn.dataset.addmenu); btn.classList.toggle('on',on); btn.setAttribute('aria-pressed',on); const lbl=on?'הסר מהתפריט':'הוסף לתפריט'; btn.setAttribute('aria-label',lbl); if(btn.hasAttribute('data-full')){ btn.textContent=on?'✓ בתפריט':'＋ הוסף לתפריט'; } else { btn.setAttribute('title',lbl); btn.textContent=on?'✓':'＋'; } }

function fmt(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);
  return (h?h+":":"")+String(m).padStart(h?2:1,'0')+":"+String(x).padStart(2,'0');}

/* ---------- category colors + SVG icon art ---------- */
const CAT_COLOR={
 "בקר":"#c0392b","חזיר":"#dd7a93","טלה":"#b46a2b","עוף":"#d99a2b","הודו":"#c77a3a",
 "אווז":"#9c7b4a","ברווז":"#8a6a3c","דג":"#2f9e9e","מעורב":"#8a7f70",
 "בשר מיובש":"#9a4b2a","בייקון":"#cf5a4e","נקניק מעושן":"#b5603a","נקניק מיובש":"#9e4a3d",
 "גבינה":"#cda434","נקניקיות":"#cf6a4a","פסטרמה":"#a8392f","שווארמה":"#b9772f",
 "סלומי":"#9b3b46","דג מעושן":"#2f8e9e","BBQ קלאסי":"#b5603a","צלייה טחונה":"#c0563a",
 "איברים פנימיים":"#a24d5e","ירקות":"#4f8a3d","פירות":"#d1663f"
};
function catColor(c){return CAT_COLOR[c]||"var(--ember)";}
const CAT_EMOJI={
 'בקר':'🥩','חזיר':'🥩','טלה':'🐑','עוף':'🍗','הודו':'🍗','אווז':'🍗','ברווז':'🍗',
 'דג':'🐟','דג מעושן':'🐠','מעורב':'🍖','בשר מיובש':'🥓','בייקון':'🥓',
 'נקניק מעושן':'🥓','נקניק מיובש':'🧂','גבינה':'🧀','נקניקיות':'🌭',
 'פסטרמה':'🥩','שווארמה':'🌯','סלומי':'🍖','BBQ קלאסי':'🔥','צלייה טחונה':'🍔',
 'איברים פנימיים':'🫀','ירקות':'🥦','פירות':'🍑'
};
function foldCorner(){return '';} // v144: legacy 'vintage' theme branch retired (must be '' — `${false}` prints "false")
function catEmoji(c){return CAT_EMOJI[c]||'🔥';}
const ICONS={
 steak:'<path d="M40 9c12 0 17 9 16 19-1 10-9 16-17 18-10 3-23 2-29-6-5-7-4-19 4-26 7-6 17-5 26-5z"/><path d="M21 26c9-3 19-2 25 4" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" opacity=".22"/><path d="M17 39c9 3 20 3 28-1" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" opacity=".22"/><path d="M30 18c-2 9-3 20 0 30" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" opacity=".15"/>',
 drumstick:'<path d="M45 9c8 1 13 9 11 17-1 6-6 9-11 9-2 5-2 9-6 12-5 4-14 3-18-2s-4-14 1-18c3-3 7-3 11-4 1-5 4-11 9-13 1 0 2-1 2-1z"/><path d="M22 41l-9 9c-2 2-2 6 0 8s6 2 8 0" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>',
 fish:'<ellipse cx="28" cy="32" rx="21" ry="12.5"/><path d="M45 32l13-10v20z"/><circle cx="19" cy="29" r="2.5" fill="#1a1a1a" opacity=".55"/><path d="M30 24c6 2 10 5 12 8" fill="none" stroke="#000" stroke-width="1.7" opacity=".22"/>',
 sausage:'<path d="M15 45c-6-9-3-21 8-25 9-3 15 0 21 4" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><path d="M13 47l-3 4M48 25l4-3" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>',
 cheese:'<path d="M9 43 51 21a6 6 0 0 1 5 6L17 51a6 6 0 0 1-8-8Z"/><circle cx="26" cy="38" r="3" fill="#000" opacity=".18"/><circle cx="38" cy="32" r="2.4" fill="#000" opacity=".18"/>',
 bacon:'<path d="M9 25c10-5 15 4 25 0s15-5 23 2c-2 8-2 9 0 15-8-7-15-2-23 2s-15-4-25 0c2-8 2-11 0-19z"/><path d="M12 31c10-5 15 4 25 0s15-4 22 1" fill="none" stroke="#fff" stroke-width="2.6" opacity=".3"/>',
 jerky:'<rect x="22" y="9" width="14" height="46" rx="6" transform="rotate(20 29 32)"/><path d="M24 20l14 26" stroke="#000" stroke-width="1.6" opacity=".2"/>',
 pastrami:'<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="22" fill="none" stroke="#000" stroke-width="3" opacity=".2"/><path d="M21 29c7-4 15-4 22 0M19 38c9-4 17-4 26 0" fill="none" stroke="#000" stroke-width="1.7" opacity=".2"/>',
 spit:'<rect x="30" y="6" width="4" height="52" rx="2"/><path d="M20 14h24l-3 8H23zM18 24h28l-4 9H22zM16 35h32l-5 11H21z"/>',
 flame:'<path d="M32 6c4 9-6 12-6 20 0 5 3 8 6 9 2-3 2-7 1-10 6 4 12 10 12 18 0 11-9 17-19 17S8 55 8 44c0-9 7-14 10-22 2 4 2 8 5 10-2-9 5-18 9-26z"/>'
};
function iconType(cat){
 const m={"בקר":"steak","חזיר":"steak","טלה":"steak","עוף":"drumstick","הודו":"drumstick","אווז":"drumstick","ברווז":"drumstick","דג":"fish","מעורב":"flame",
  "בשר מיובש":"jerky","בייקון":"bacon","נקניק מעושן":"sausage","נקניק מיובש":"sausage","גבינה":"cheese",
  "נקניקיות":"sausage","פסטרמה":"pastrami","שווארמה":"spit",
  "סלומי":"pastrami","דג מעושן":"fish","BBQ קלאסי":"flame","צלייה טחונה":"sausage"};
 return m[cat]||"flame";
}
function svgRaw(type){return `<svg viewBox="0 0 64 64" fill="currentColor">${ICONS[type]||ICONS.flame}</svg>`;}
function darken(hex,amt){return '#'+(hex.replace('#','').match(/.{2}/g)||['00','00','00']).map(h=>Math.max(0,parseInt(h,16)-amt).toString(16).padStart(2,'0')).join('');}
const CUT_ICON={1:"🥩",2:"🍖",6:"🥩",10:"🍖",11:"🥩",12:"🥩",14:"🍖",17:"🍢",18:"🍔",20:"🥩",21:"🍖",22:"👅",23:"🥩",24:"🍖",25:"🦴",26:"🥩",27:"🥩",28:"🥩",51:"🥓",52:"🍖",53:"🥩",54:"🥩",55:"🥩",56:"🍖",57:"🦴",69:"❤️",3:"🌯",5:"🍗",19:"🍗",38:"🐔",39:"🍗",40:"🍗",41:"🍗",42:"🦃",43:"🦃",67:"🍗",68:"🦃",70:"❤️",71:"🥩",9:"🦆",44:"🦢",45:"🦢",46:"🦆",47:"🦆",48:"🦆",74:"🥩",7:"🍖",8:"🥓",13:"🍖",29:"🥩",30:"🥩",31:"🍖",32:"🍖",33:"🍖",61:"🍖",62:"🦴",63:"🍖",64:"🍖",65:"👂",66:"🍖",4:"🦴",15:"🍖",34:"🍖",35:"🍖",36:"🍖",37:"🍖",58:"🍖",59:"🍖",60:"🥩",73:"🥩",72:"🥩",75:"🧠",76:"🧠",77:"🍗",78:"🫘",79:"🫘",80:"🧠",49:"🐟",50:"🐟",81:"🌽",82:"🫑",83:"🍆",84:"🥒",85:"🧅",86:"🍄",87:"🥬",88:"🥕",89:"🥔",90:"🍠",91:"🥬",92:"🥦",93:"🥦",94:"🥬",95:"🍅",96:"🫛",101:"🌿",102:"🧄",103:"🥬",104:"🥑",105:"🧀",97:"🍍",98:"🍑",99:"🍐",100:"🍌",106:"🍉",107:"🫐",108:"🥩",109:"🥩",110:"🥩",111:"🥩",112:"🥩",113:"🦐",114:"🦐",115:"🦐",116:"🐚",117:"🦞",118:"🦞",119:"🦞",120:"🦀",121:"🦀",122:"🦀",123:"🐙",124:"🦑",125:"🐟",126:"🐟",127:"🐟",128:"🦪",129:"🐚",130:"🦪"};
function itemEmoji(cat,ekey){
  if(ekey&&ekey.startsWith('cut-')){ const n=+ekey.slice(4); if(CUT_ICON[n]) return CUT_ICON[n]; }
  if(ekey&&ekey.startsWith('spec-')) return catEmoji(cat);
  return catEmoji(cat);
}
function svgThumb(cat,label,ekey,origin){
  const col=catColor(cat), em=itemEmoji(cat,ekey);
  let flag='';
  if(origin){ const fm=origin.match(/\p{Regional_Indicator}\p{Regional_Indicator}/u); if(fm) flag=`<span class="t-flag">${fm[0]}</span>`; }
  if(false){ // v144: legacy 'vintage' theme branch retired
    return `<div class="thumb thumb-v">
      <span class="v-emoji">${em}</span>
      ${flag}
      ${label?`<span class="vnum">${label}</span>`:''}
    </div>`;
  }
  if(false){ // v144: legacy 'gold' theme branch retired
    return `<div class="thumb thumb-g" style="--c:${col}">
      <div class="t-blur">${em}</div>
      <div class="gico" style="background:linear-gradient(135deg,${col},${darken(col,50)})">${em}</div>
      ${flag}
      ${label?`<span class="tnum">${label}</span>`:''}
    </div>`;
  }
  return `<div class="thumb" style="--c:${col}">
    <div class="t-blur">${em}</div>
    <div class="t-circle" style="background:linear-gradient(135deg,${col},${darken(col,55)})">${em}</div>
    ${flag}
    ${label?`<span class="tnum">${label}</span>`:''}
  </div>`;
}
function headArt(cat){return `<div class="phead-ico">${svgRaw(iconType(cat))}</div>`;}

/* ---------- render cards ---------- */
function cutCard(c){const col=catColor(c.cat), key="cut-"+c.n;
  return `<article class="card" data-n="${c.n}" data-kind="cut" tabindex="0" role="button" aria-label="${c.heb}">
    ${foldCorner()}${favStar(key)}${addMenuBtn(key)}
    ${svgThumb(c.cat,"#"+c.n,"cut-"+c.n)}
    <div class="cbody">
      <div class="cat" style="color:${col}">${c.cat} ${kosherTag("cut-"+c.n)}${gearTag("cut-"+c.n)}</div>
      <h3>${c.heb}</h3>
      <div class="en">${c.eng} · ${c.kg} ק״ג</div>
      ${isProduce(c)?`<div class="meta">
        <span>גריל <b>${c.sot}°</b></span>
        <span>סו-ויד <b>${c.svt}°</b></span>
        <span>~${Math.round(upperHours(c.soh)*60)} דק'</span>
      </div>
      <div class="meta" style="justify-content:space-between;align-items:center">
        <span>${dots(c.diff)}${ratingMini(key)}</span>
        <span class="saved" style="background:rgba(79,138,61,.14);border-color:rgba(79,138,61,.4);color:#8fce76">${c.cat==='פירות'?'🍑 לגריל/קינוח':'🥦 לגריל/תוספת'}</span>
      </div>`:`<div class="meta">
        <span>סו-ויד <b>${c.svt}°</b>/${c.svh}ש</span>
        <span>עישון <b>${c.smt}°</b>/${c.smh}ש</span>
        <span>יעד <b>${c.tgt}°</b></span>
      </div>
      <div class="meta" style="justify-content:space-between;align-items:center">
        <span>${dots(c.diff)}${ratingMini(key)}</span>
        <span class="saved">⏱ חוסך ${c.saved}ש מעשנת</span>
      </div>
      ${DATA.builds["cut-"+c.n]?'<span class="bld">🔨 בנייה מאפס</span>':''}`}
    </div>
  </article>`;
}
function specCard(s){const smk = s.smt? `${s.smt}°/${s.smh}ש` : s.smh, col=catColor(s.cat), key="spec-"+s.n;
  return `<article class="card" data-n="${s.n}" data-kind="spec" tabindex="0" role="button" aria-label="${s.heb}">
    ${foldCorner()}${favStar(key)}${addMenuBtn(key)}
    ${svgThumb(s.cat,"#"+s.n,"spec-"+s.n, s.origin)}
    <div class="cbody">
      <div class="cat" style="color:${col}">${s.cat} ${kosherTag(key)}</div>
      <h3>${s.heb}</h3>
      <div class="en">${s.eng}${s.origin?` · ${s.origin}`:''}</div>
      <div class="meta"><span>עישון <b>${smk}</b></span>${s.tgt!=='—'&&s.tgt?`<span>יעד <b>${s.tgt}${typeof s.tgt==='number'?'°':''}</b></span>`:''}</div>
      <div class="meta" style="justify-content:space-between;align-items:center"><span>${dots(s.diff)}${ratingMini(key)}</span><span style="color:var(--smoke)">${s.wood}</span></div>
      ${DATA.builds["spec-"+s.n]?'<span class="bld">🔨 בנייה מאפס</span>':''}
    </div>
  </article>`;
}
function makeCard(id,m){const nv=(m.build.variants||[]).length, col=catColor(m.cat), key="make-"+id;
  return `<article class="card" data-mid="${id}" data-kind="make" tabindex="0" role="button" aria-label="${m.heb}">
    ${foldCorner()}${favStar(key)}${addMenuBtn(key)}
    ${svgThumb(m.cat,null,"make-"+id, m.origin)}
    <div class="cbody">
      <div class="cat" style="color:${col}">${m.cat} ${kosherTag(key)}</div>
      <h3>${m.heb}</h3>
      <div class="en">${m.eng}${m.origin?` · ${m.origin}`:''}</div>
      <div class="meta" style="justify-content:space-between;align-items:center"><span>${dots(m.diff)}${ratingMini(key)}</span>${nv?`<span style="color:var(--smoke)">${nv} ווריאנטים</span>`:''}</div>
      <span class="bld">🔨 בנייה מאפס</span>
    </div>
  </article>`;
}

let activeCats=new Set();
let activeMakeCat=null;
let filters={fav:false, kosher:false, method:'', diff:0, time:0};
function textBlob(meta){
  let t=(meta.heb+' '+meta.eng+' '+meta.cat).toLowerCase();
  if(meta.obj&&meta.obj.rub) t+=' '+meta.obj.rub.toLowerCase();
  if(meta.obj&&meta.obj.wood) t+=' '+String(meta.obj.wood).toLowerCase();
  const b=meta.build;
  if(b){ if(b.materials) t+=' '+b.materials.join(' ').toLowerCase();
         if(b.variants) t+=' '+b.variants.map(v=>v[0]).join(' ').toLowerCase(); }
  return t;
}
function itemMethods(meta){
  if(!meta) return [];
  if(meta.kind==='cut') return methodRules(meta.obj).allowed.slice();  // single source of truth
  if(meta.kind==='spec') return ['smoke','build'];            // specials: smoked/cured products
  return ['build'];                                           // makes: from-scratch builds
}
function leadForMethod(meta, fm){
  const c=meta.obj||{};
  if(meta.kind==='cut'){
    if(isProduce(c)){
      if(fm==='sv') return upperHours(c.svh)+upperHours(c.smh)+(c.rest||0)/60;
      if(fm==='smoke') return Math.max(0.5,upperHours(c.svh))*1.5;
      return upperHours(c.soh)+(c.rest||0)/60;                // grill / direct fire (default, quick)
    }
    if(fm==='smoke') return upperHours(c.soh||c.smh)+(c.rest||0)/60; // smoke-only
    if(fm==='grill' && isGrillableMeat(c)) return 0.4+(c.rest||0)/60;  // fast direct-heat grill
    return upperHours(c.svh)+4+upperHours(c.smh)+(c.rest||0)/60;       // sv+smoke (default order incl. v144 fridge-dry stage)
  }
  return leadHours(meta);
}
function passFilters(meta){
  if(filters.fav && !isFav(meta.key)) return false;
  if(filters.kosher && !isKosherOk(meta.key)) return false;   // pork / shellfish / blood
  if(filters.diff && (meta.obj.diff||meta.diff||3) > filters.diff) return false;
  if(filters.method && !itemMethods(meta).includes(filters.method)) return false;
  if(filters.time){
    const lead=leadForMethod(meta, filters.method);
    if(lead>filters.time) return false;
  }
  return true;
}
function render(){
  const q=$("#q").value.trim().toLowerCase();
  const anyGlobal = filters.fav||filters.kosher||filters.method||filters.diff||filters.time;
  const eff=effectiveCats(); // Set or null(=all)
  const inScope=cat=>!eff||eff.has(cat);
  const cuts=DATA.cuts.filter(c=>{
    const meta=metaCut(c);
    const okQ=!q||textBlob(meta).includes(q);
    return inScope(c.cat)&&okQ&&passFilters(meta);
  });
  $("#grid").innerHTML=cuts.map(cutCard).join("");
  const cutsEmpty=!cuts.length;

  const makeEntries=Object.entries(DATA.makes).filter(([id,m])=>{
    const meta=metaMake(id,m);
    const okQ=!q||textBlob(meta).includes(q);
    return inScope(m.cat)&&okQ&&passFilters(meta);
  });
  $("#makeGrid").innerHTML=makeEntries.map(([id,m])=>makeCard(id,m)).join("");
  const showMakes=makeEntries.length;
  $("#makesH").style.display=showMakes?"":"none";
  $("#makesSub").style.display=showMakes?"":"none";
  $("#makeGrid").style.display=showMakes?"":"none";

  const specs=DATA.specials.filter(s=>{
    const meta=metaSpec(s);
    return inScope(s.cat)&&(!q||textBlob(meta).includes(q))&&passFilters(meta);
  });
  $("#specGrid").innerHTML=specs.map(specCard).join("");
  const showSpec = specs.length;
  $("#specialsH").style.display=showSpec?"":"none";
  $("#specGrid").style.display=showSpec?"":"none";
  $("#specSub").style.display=showSpec?"":"none";
  $("#count").textContent=`${cuts.length} נתחים · ${makeEntries.length} מלאכה · ${specs.length} מיוחדים${anyGlobal?' · מסונן':''}`;
  const noneAtAll = cutsEmpty && !makeEntries.length && !specs.length;
  // hide the cuts section entirely when there are no cuts but other items exist; keep it (with empty msg) when nothing matches
  $("#cutsWrap").style.display=(cutsEmpty && !noneAtAll)?"none":"";
  $("#empty").style.display=noneAtAll?"block":"none";
  const anyActive = anyGlobal || activeCats.size || activeGroup || q;
  const cab=$("#clearAll"); if(cab){ cab.style.opacity=anyActive?'1':'.5'; }
}
function metaCut(c){return {kind:'cut',key:'cut-'+c.n,heb:c.heb,eng:c.eng,cat:c.cat,obj:c,build:DATA.builds['cut-'+c.n]};}
function metaSpec(s){return {kind:'spec',key:'spec-'+s.n,heb:s.heb,eng:s.eng,cat:s.cat,obj:s,build:DATA.builds['spec-'+s.n]};}
function metaMake(id,m){return {kind:'make',key:'make-'+id,heb:m.heb,eng:m.eng,cat:m.cat,obj:m,diff:m.diff,build:m.build};}
function buildFilterBar(){
  const wrap=$("#filterBar"); if(!wrap) return;
  const msel=(v,cur)=>v==(cur)?' selected':'';
  wrap.innerHTML=`
    <select data-f="method" aria-label="שיטה"><option value="">כל שיטה</option><option value="grill"${msel('grill',filters.method)}>🔥 גריל / אש ישירה</option><option value="sv"${msel('sv',filters.method)}>💧 סו-ויד</option><option value="smoke"${msel('smoke',filters.method)}>💨 עישון</option><option value="build"${msel('build',filters.method)}>🔨 בנייה מאפס</option></select>
    <select data-f="diff" aria-label="קושי"><option value="0">כל קושי</option><option value="1"${msel(1,filters.diff)}>קל (1)</option><option value="2"${msel(2,filters.diff)}>עד 2</option><option value="3"${msel(3,filters.diff)}>עד 3</option><option value="4"${msel(4,filters.diff)}>עד 4</option></select>
    <select data-f="time" aria-label="זמן"><option value="0">כל זמן</option><option value="2"${msel(2,filters.time)}>עד 2ש</option><option value="6"${msel(6,filters.time)}>עד 6ש</option><option value="12"${msel(12,filters.time)}>עד 12ש</option><option value="24"${msel(24,filters.time)}>עד 24ש</option></select>
    <button data-f="kosher" class="fchip ${filters.kosher?'on':''}">${filters.kosher?'✓ ':''}כשר בלבד</button>`;
  wrap.querySelectorAll("select").forEach(s=>s.addEventListener("change",()=>{
    const k=s.dataset.f; filters[k]= (k==='diff'||k==='time')? +s.value : s.value; render();
  }));
  wrap.querySelector('[data-f="kosher"]').addEventListener("click",e=>{
    filters.kosher=!filters.kosher;
    const b=wrap.querySelector('[data-f="kosher"]');
    b.classList.toggle("on",filters.kosher);
    b.textContent=(filters.kosher?'✓ ':'')+'כשר בלבד';
    if(filters.kosher){ [...activeCats].forEach(c=>{ if(!catHasKosher(c)) activeCats.delete(c); }); }
    if(typeof buildSubChips==='function') buildSubChips();
    render();
  });
}
/* ---------- unified two-tier category system ---------- */
const CAT_GROUPS=[
  {g:'בשר אדום', ic:'🥩', cats:['בקר','חזיר','טלה']},
  {g:'עופות', ic:'🍗', cats:['עוף','הודו','אווז','ברווז']},
  {g:'ים', ic:'🐟', cats:['דג','דג מעושן','פירות ים']},
  {g:'צמחי', ic:'🥦', cats:['ירקות','פירות']},
  {g:'איברים', ic:'🫀', cats:['איברים פנימיים']},
  {g:'מלאכה', ic:'🌭', cats:['נקניקיות','נקניק מעושן','נקניק מיובש','סלומי','פסטרמה','שווארמה','צלייה טחונה','BBQ קלאסי']},
  {g:'מיובש ומעושן', ic:'🥓', cats:['בשר מיובש','בייקון']},
  {g:'גבינות', ic:'🧀', cats:['גבינה']},
];
let activeGroup=null; // group name or null (=all)
function allCatCounts(kosherOnly){
  const c={};
  const add=(cat,key)=>{ if(kosherOnly && typeof isKosherOk==='function' && !isKosherOk(key)) return; c[cat]=(c[cat]||0)+1; };
  DATA.cuts.forEach(x=>add(x.cat,'cut-'+x.n));
  Object.entries(DATA.makes).forEach(([id,x])=>add(x.cat,'make-'+id));
  DATA.specials.forEach(x=>add(x.cat,'spec-'+x.n));
  return c;
}
function groupOf(cat){ const g=CAT_GROUPS.find(gr=>gr.cats.includes(cat)); return g?g.g:'אחר'; }
function effectiveCats(){
  if(activeCats.size) return activeCats;
  if(activeGroup){ const g=CAT_GROUPS.find(x=>x.g===activeGroup); return g?new Set(g.cats):null; }
  return null; // all
}
function setCatNav(group,cats){ activeGroup=group||null; activeCats=new Set(cats||[]); }
function buildChips(){
  buildCatGroups();
  buildSubChips();
}
function buildCatGroups(){
  const wrap=$("#catGroups"); if(!wrap) return;
  const counts=allCatCounts(filters.kosher);
  const groupCount=g=>g.cats.reduce((s,c)=>s+(counts[c]||0),0);
  const shown=CAT_GROUPS.filter(g=>groupCount(g)>0);
  wrap.innerHTML=`<span class="cgroup ${!activeGroup?'on':''}" data-gall>הכל</span>`+
    shown.map(g=>`<span class="cgroup ${activeGroup===g.g?'on':''}" data-group="${g.g}">${g.ic} ${g.g} <b>${groupCount(g)}</b></span>`).join("");
  wrap.onclick=e=>{ const t=e.target.closest('.cgroup'); if(!t) return;
    if(t.hasAttribute('data-gall')){ activeGroup=null; activeCats.clear(); buildCatGroups(); catView('landing'); return; }
    activeGroup=activeGroup===t.dataset.group?null:t.dataset.group;
    activeCats.clear(); buildCatGroups(); buildSubChips();
    if(activeGroup) catView('cat'); else catView('landing');
  };
}
function catHasKosher(cat){
  return (typeof cwAllItems==='function') && cwAllItems().some(i=>i.cat===cat && (typeof kosherStatus!=='function'||isKosherOk(i.key)));
}
function buildSubChips(){
  const wrap=$("#chips"); if(!wrap) return;
  const counts=allCatCounts(filters.kosher);   // counts reflect the active kosher filter
  // which cats to show as sub-filters: the active group's cats with >0 items (under the current filter)
  let cats;
  if(activeGroup){ const g=CAT_GROUPS.find(x=>x.g===activeGroup); cats=(g?g.cats:[]).filter(c=>counts[c]>0); }
  else { wrap.innerHTML=''; wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML=`<span class="chip ${!activeCats.size?'on':''}" data-all>הכל בקבוצה</span>`+
    cats.map(c=>`<span class="chip" data-cat="${c}">${catEmoji(c)} ${c} <b>${counts[c]}</b></span>`).join("");
  wrap.onclick=e=>{ const t=e.target.closest('.chip'); if(!t) return;
    if(t.hasAttribute('data-all')){ activeCats.clear(); }
    else { const c=t.dataset.cat; activeCats.has(c)?activeCats.delete(c):activeCats.add(c); }
    syncChips(); render();
  };
}
function syncChips(){
  const wrap=$("#chips"); if(!wrap) return;
  [...wrap.children].forEach(ch=>{
    if(ch.hasAttribute("data-all"))ch.classList.toggle("on",!activeCats.size);
    else ch.classList.toggle("on",activeCats.has(ch.dataset.cat));
  });
}
function buildMakeChips(){ const w=$("#makeChips"); if(w){ w.innerHTML=''; w.style.display='none'; } }
// ── category landing tiles ──
function buildCatLanding(){
  const host=$("#catLanding"); if(!host) return;
  const counts=allCatCounts();
  const gc=g=>g.cats.reduce((s,c)=>s+(counts[c]||0),0);
  const tiles=CAT_GROUPS.filter(g=>gc(g)>0).map(g=>
    `<button class="cattile" data-tilegroup="${g.g}"><span class="ct-ic">${g.ic}</span><span class="ct-name">${g.g}</span><span class="ct-count">${gc(g)} פריטים</span></button>`).join('');
  host.innerHTML=`<div class="cat-hero"><h3>מה <b>מדליקים</b> היום?</h3><p>בחר קטגוריה או חפש למעלה</p></div>
    <div class="cat-tiles">
      <button class="cattile tfav" data-tilefav><span class="ct-ic">⭐</span><span class="ct-name">מועדפים</span><span class="ct-count" id="favTileN">0 פריטים</span></button>
      ${tiles}
      <button class="cattile tdict" data-tilegloss><span class="ct-ic">📖</span><span class="ct-name">מילון מונחים</span><span class="ct-count">שיטות, עצים ופחם</span></button>
    </div>`;
  host.querySelectorAll('[data-tilegroup]').forEach(b=>b.addEventListener('click',()=>{ filters.fav=false; setCatNav(b.dataset.tilegroup); buildChips(); catView('cat'); }));
  host.querySelectorAll('[data-tilefav]').forEach(b=>b.addEventListener('click',()=>{ filters.fav=true; setCatNav(null); const fb=$("#favBtn"); if(fb)fb.classList.add('on'); catView('fav'); }));
  host.querySelectorAll('[data-tilegloss]').forEach(b=>b.addEventListener('click',()=>catView('gloss')));
  const ft=$("#favTileN"); if(ft) ft.textContent=(favs.size||0)+' פריטים';
}
// ── catalog view controller: landing / category / gloss / fav / search ──
function catView(mode){
  const q=($("#q")&&$("#q").value||'').trim();
  if(!mode){ mode = q ? 'search' : (activeGroup? 'cat' : (filters.fav?'fav':'landing')); }
  const hide=ids=>ids.forEach(id=>{const e=$('#'+id); if(e) e.style.display='none';});
  const show=ids=>ids.forEach(id=>{const e=$('#'+id); if(e) e.style.display='';});
  if(mode==='landing'){
    buildCatLanding();
    show(['catLanding']);
    hide(['catGroups','chips','filterBar','countRow','cutsWrap','makesH','makesSub','makeGrid','specialsH','specSub','specGrid','glossH','glossSub','gloss','glossBar']);
    $("#catTitle").textContent='קטלוג';
  } else if(mode==='gloss'){
    hide(['catLanding','catGroups','chips','filterBar','countRow','cutsWrap','makesH','makesSub','makeGrid','specialsH','specSub','specGrid']);
    show(['glossH','glossSub','gloss','glossBar']);
    $("#catTitle").textContent='מילון מונחים';
  } else {
    hide(['catLanding','glossH','glossSub','gloss','glossBar','catGroups']);
    show(['chips','countRow','cutsWrap']);
    $("#chips").style.display = activeGroup?'':'none';
    $("#filterBar").style.display='';
    $("#catTitle").textContent = mode==='fav'?'מועדפים':(mode==='search'?'תוצאות חיפוש':(activeGroup||'קטלוג'));
    render();
  }
}

/* ---------- detail panel ---------- */
/* ---------- calculators ---------- */
function fmtG(g){ if(g<=0) return '0'; return g>=1000 ? (g/1000).toFixed((g%1000)?2:0)+' ק״ג' : (g>=10?Math.round(g):g.toFixed(1))+' ג׳'; }
function calcBoxHTML(calc){
  if(!calc) return '';
  const brine=calc.brine;
  return `<div class="calcbox" data-saltcalc>
    <h4>מחשבון מלח וריפוי</h4>
    <div class="calcrow"><label>${brine?'מים לתמלחת':'משקל בשר'}</label>
      <input type="number" data-w min="0" step="${brine?'0.5':'50'}" value="${brine?'2':'1000'}">
      <span class="u">${brine?'ליטר':'גרם'}</span></div>
    ${brine?`<div class="calcrow"><label>משקל הנתח <small>(לא חובה)</small></label><input type="number" data-mw min="0" step="100" value="0"><span class="u">גרם</span></div>`:''}
    <div class="calcout" data-out></div>
    <div class="calcnote" data-note></div>
  </div>`;
}
function wireCalcBox(root, calc){
  const box=root.querySelector("[data-saltcalc]"); if(!box||!calc) return;
  const w=box.querySelector("[data-w]"), out=box.querySelector("[data-out]"), note=box.querySelector("[data-note]"), mw=box.querySelector("[data-mw]");
  const line=(l,v,s)=>`<div class="cl"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  function recompute(){
    const x=Math.max(0,parseFloat(w.value)||0); let h='';
    if(calc.brine){
      h+=line('מלח', fmtG(x*calc.saltL), calc.saltL+' ג׳/ליטר');
      h+=line('Cure #1', fmtG(x*calc.cureL), calc.cureL+' ג׳/ליטר');
      h+=line('סוכר', fmtG(x*calc.sugarL), calc.sugarL+' ג׳/ליטר');
      const meat=mw?Math.max(0,parseFloat(mw.value)||0):0;
      if(meat>0){
        const suggestL=Math.ceil(meat/1000*10)/10; // ~1L per kg to submerge
        const totalKg=(meat+x*1000)/1000; const eqSalt=totalKg*1000*0.028; // 2.8% equilibrium of meat+water
        h+=`<div class="cl cl-note"><span>שיטת שיווי-משקל (מומלץ, מדויק):</span></div>`;
        h+=line('מים מומלצים לכיסוי', suggestL+' ליטר', '≈1 ל׳/ק״ג בשר בשקית ואקום');
        h+=line('מלח לשיווי-משקל', fmtG(eqSalt/1000), '2.8% ממשקל בשר+מים');
      }
      note.textContent='תמלחת כבישה — שקלו לכסות את הנתח. שיטת שיווי-משקל (בשקית ואקום עם מעט מים) בטוחה מפני מליחות-יתר. כבישה ~24ש לכל 1 ס״מ עובי.';
    } else {
      h+=line('מלח', fmtG(x*calc.salt/1000), calc.salt+' ג׳/ק״ג');
      if(calc.cure) h+=line('Cure #'+calc.cure, fmtG(x*(calc.cureRate||2.5)/1000), (calc.cureRate||2.5)+' ג׳/ק״ג');
      if(calc.sugar) h+=line('סוכר/דקסטרוז', fmtG(x*calc.sugar/1000), calc.sugar+' ג׳/ק״ג');
      if(calc.water) h+=line('קרח/מים', fmtG(x*calc.water/100), calc.water+'%');
      note.textContent = calc.cure==='2' ? '⚠ מוצר מיובש לא מבושל — דיוק ה-Cure קריטי לבטיחות.'
        : (calc.cure==='1' ? 'Cure #1 ב-2.5 ג׳/ק״ג ≈ 156ppm ניטריט (תקני ובטוח).' : '');
    }
    out.innerHTML=h;
  }
  w.addEventListener('input',recompute); if(mw) mw.addEventListener('input',recompute); recompute();
}
const SERV_TYPES={
  meat:{heb:'🥩 בשר עיקרי',light:220,reg:320,heavy:420,note:'מנה עיקרית — סטייק, צלי, עוף'},
  ground:{heb:'🌭 נקניקיות / טחון',light:160,reg:220,heavy:300,note:'נקניקיות, המבורגר, קבב'},
  fish:{heb:'🐟 דג',light:180,reg:240,heavy:320,note:'פילה דג כמנה עיקרית'},
  seafood:{heb:'🦐 פירות ים (עם קליפה)',light:220,reg:320,heavy:450,note:'שרימפס/סרטן/לובסטר — כולל פחת קליפה'},
  offal:{heb:'🫀 איברים פנימיים',light:120,reg:180,heavy:250,note:'כבד, לב, שקדים — לרוב מנה עשירה וקטנה יותר'},
  cured:{heb:'🍖 שרקוטרי / מיובש',light:50,reg:75,heavy:110,note:'סלמי, פסטרמה, בשר מיובש, בייקון — כפרוסות דקות, בלי בישול'},
  cheese:{heb:'🧀 גבינה / מנה ראשונה',light:60,reg:90,heavy:130,note:'קרש גבינות, פתיח'},
  veg:{heb:'🥦 ירקות (תוספת)',light:120,reg:200,heavy:280,note:'ירקות על הגריל/בתנור כתוספת'},
  fruit:{heb:'🍑 פירות (קינוח)',light:100,reg:150,heavy:220,note:'פירות צלויים כקינוח/תוספת'}
};
function servTypeFor(c){
  if(!c) return 'meat'; const cat=c.cat||'';
  if(cat==='פירות ים') return /טונה|הליבוט|סלמון|דג/.test(c.heb||'')?'fish':'seafood';
  if(cat==='דג'||cat==='דג מעושן') return 'fish';
  if(cat==='גבינה') return 'cheese';
  if(cat==='ירקות') return 'veg';
  if(cat==='פירות') return 'fruit';
  if(cat==='איברים פנימיים') return 'offal';
  if(/בשר מיובש|נקניק מיובש|סלומי|פסטרמה|בייקון/.test(cat)) return 'cured';
  if(/נקניקיות|צלייה טחונה/.test(cat)) return 'ground';
  return 'meat';
}
function servingsCalcHTML(c){
  const cur=servTypeFor(c);
  const opts=Object.entries(SERV_TYPES).map(([k,v])=>`<option value="${k}" ${k===cur?'selected':''}>${v.heb}</option>`).join('');
  return `<div class="calcbox" data-servcalc>
    <h4>מחשבון כמויות לפי סועדים</h4>
    <div class="calcrow"><label>סוג מנה</label><select data-stype>${opts}</select></div>
    <div class="calcrow"><label>מספר סועדים</label><input type="number" data-d min="1" value="4"><span class="u">איש</span></div>
    <div class="calcrow"><label>תיאבון</label>
      <select data-app><option value="light">קל</option><option value="reg" selected>רגיל</option><option value="heavy">כבד</option></select></div>
    <div class="calcout" data-out></div>
  </div>`;
}
function wireServCalc(root, c){
  const box=root.querySelector("[data-servcalc]"); if(!box) return;
  const d=box.querySelector("[data-d]"), app=box.querySelector("[data-app]"), st=box.querySelector("[data-stype]"), out=box.querySelector("[data-out]");
  const yld=()=> !c?0.7 : (c.tgt>=88?0.6:(c.tgt>=70?0.72:0.82));
  function recompute(){
    const diners=Math.max(1,parseInt(d.value)||1), t=SERV_TYPES[st.value]||SERV_TYPES.meat, per=t[app.value]||t.reg, y=yld();
    const noCook=(st.value==='cheese'||st.value==='cured');
    const cooked=diners*per, raw=cooked/y;
    out.innerHTML=`<div class="cl"><span>${noCook?'לקנייה':'נא לקנייה'}</span><b>${((noCook?cooked:raw)/1000).toFixed(2)} ק״ג</b><small>${diners}×${per}ג׳</small></div>
      ${!noCook?`<div class="cl"><span>תשואה מבושלת</span><b>${(cooked/1000).toFixed(2)} ק״ג</b><small>~${Math.round(y*100)}% אחרי בישול</small></div>`:''}
      <div class="cl cl-note"><span>${t.note}</span></div>
      ${c?`<div class="cl"><span>מול נתח בטבלה</span><b>${c.kg} ק״ג</b><small>≈ ${Math.max(1,Math.round(raw/1000/c.kg))} יח׳</small></div>`:''}`;
  }
  d.addEventListener('input',recompute); app.addEventListener('change',recompute); st.addEventListener('change',recompute); recompute();
}
function openCalc(){
  const html=`<div class="panel-top"><button class="x" aria-label="סגור">✕</button>
     <div class="cat">כלי עזר</div><h2>מחשבונים</h2><div class="en">מלח · ריפוי · כמויות</div></div>
   <div class="panel-body">
     <div class="calcrow" style="margin:16px 0 0"><label>סוג מוצר</label>
       <select id="ptype">
        <option value="fresh">נקניקייה טרייה</option>
        <option value="smoked">מעושן-מבושל</option>
        <option value="dry">מיובש (פרמנט)</option>
        <option value="bacon">בייקון</option>
        <option value="brine">פסטרמה (תמלחת)</option>
       </select></div>
     <div id="saltHost"></div>
     <hr style="border:none;border-top:1px solid var(--line);margin:20px 0">
     <div id="servHost"></div>
   </div>`;
  showPanel(html);
  const R={fresh:{salt:18,cure:null,sugar:0,water:10,brine:false},
    smoked:{salt:18,cure:'1',sugar:1,water:10,brine:false},
    dry:{salt:29,cure:'2',sugar:3,water:0,brine:false},
    bacon:{salt:20,cure:'1',sugar:10,water:0,brine:false,cureRate:2.0},
    brine:{brine:true,saltL:50,cureL:12,sugarL:20}};
  function paintSalt(){const c=R[$("#ptype").value];$("#saltHost").innerHTML=calcBoxHTML(c);wireCalcBox($("#saltHost"),c);}
  $("#ptype").addEventListener('change',paintSalt); paintSalt();
  $("#servHost").innerHTML=servingsCalcHTML(); wireServCalc($("#servHost"),null);
}

/* ---------- build (from-scratch) renderer ---------- */
function renderBuildInto(sel, key, b){
  const which='build';
  let h=`<div class="method-note">🔨 ${b.intro}</div>`;
  if(b.materials&&b.materials.length){
    h+=`<div class="matlist"><h4>חומרים וציוד</h4><ul>`+b.materials.map(m=>`<li>${m}</li>`).join("")+`</ul></div>`;
  }
  if(b.calc) h+=calcBoxHTML(b.calc);
  if(b.variants&&b.variants.length){
    h+=`<div class="var"><h4>סוגים / ווריאנטים</h4>`+b.variants.map(v=>`<div class="varitem"><div class="vt">${v[0]}</div><p>${v[1]}</p></div>`).join("")+`</div>`;
  }
  h+=`<div class="steps" style="margin-top:14px"><h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 4px">שלבי הבנייה</h4>`+
     b.phases.map((p,i)=>stepHTML(key,which,i,p)).join("")+`</div>`;
  if(b.store) h+=`<div class="method-note" style="margin-top:14px;background:var(--fresh-l);border-color:#b8e0d4">${b.store}</div>`;
  document.querySelector(sel).innerHTML=h;
  if(b.calc) wireCalcBox(document.querySelector(sel), b.calc);
  wireSteps(key,which,b.phases);
}

function grillLine(c){
  if(c.grillable===false) return 'לא מומלץ לגריל ישיר (נתח ארוך-בישול)';
  if(c.grt==null) return null;
  return `${c.grt}°C${c.grh?` · ${c.grh}ש`:''}${c.grz?` · ${c.grz}`:''}`;
}
function srcRow(label, o){
  if(!o) return '';
  if(o.ref==='UNVERIFIED') return `<tr><td>${label}</td><td style="color:var(--terra-d,#c9822e)">⚠ טרם אומת ממקור</td></tr>`;
  const link=o.url?` <a href="${o.url}" target="_blank" rel="noopener" style="color:var(--ember2);text-decoration:none">↗</a>`:'';
  const note=o.note?`<div style="font-size:.82em;opacity:.7;margin-top:2px">${o.note}</div>`:'';
  return `<tr><td>${label}</td><td>${o.ref||'—'}${link}${note}</td></tr>`;
}
function sourcesBlock(c){
  const hd=`<h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px">📚 מקורות ואימות</h4>`;
  const s=c.src;
  if(!s||typeof s!=='object'){
    return `<div class="raw">${hd}<p style="opacity:.6;font-size:13px;margin:0">טרם אומת ממקור ראשוני.</p></div>`;
  }
  const rows=[srcRow('סו-ויד',s.sv),srcRow('עישון',s.smoke),srcRow('גריל',s.grill),srcRow('בטיחות',s.safe),srcRow('ריפוי/כבישה',s.cure)].join('');
  const ver=s.verified?`<tr><td>אומת</td><td>${s.verified}</td></tr>`:'';
  const oa=c.order_svsmoke, ob=c.order_smokesv;
  let order='';
  if(oa||ob){
    const vt=`style="font-family:'Heebo';font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ember2);margin:2px 0"`;
    order=`<div style="margin-top:10px"><div ${vt}>🔀 השפעת סדר</div>`;
    if(oa) order+=`<div style="font-size:13px;line-height:1.5">סו-ויד→עישון: סו-ויד ${oa.sv.t}°/${oa.sv.h}ש${oa.dry?` → ייבוש ${oa.dry.h}ש`:''} → עישון ${oa.smoke.t}°/${oa.smoke.h}ש <span style="opacity:.65">(גימור חם)</span></div>`;
    if(ob) order+=`<div style="font-size:13px;line-height:1.5">עישון→סו-ויד: עישון ${ob.smoke.t}°/${ob.smoke.h}ש${ob.smoke.cold?' <span style="opacity:.65">(עישון קר)</span>':''} → סו-ויד ${ob.sv.t}°/${ob.sv.h}ש <span style="opacity:.65">(פסטור מלא)</span></div>`;
    order+=`</div>`;
  }
  return `<div class="raw">${hd}<table>${rows}${ver}</table>${order}</div>`;
}
function openCut(c){
  curProject=pendingProject; pendingProject=null;
  const altR=ALT_RUB[c.cat]||ALT_RUB["מעורב"];
  const key=`cut-${c.n}`;
  const build=DATA.builds["cut-"+c.n];
  const col=catColor(c.cat);
  const html=`
   <div class="panel-top" style="--c:${col}">
     ${headArt(c.cat)}
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat" style="color:${col}">${c.cat} · נתח #${c.n}</div>
     <h2>${c.heb}</h2>
     <div class="en">${c.eng} · ${c.kg} ק״ג · רמת קושי ${dots(c.diff)}</div>
   </div>
   <div class="panel-body">
     ${c.desc?`<p class="itemdesc">${c.desc}</p>`:''}
     <div class="statline">
       ${isProduce(c)?`
       <div class="stat"><div class="l">גריל</div><div class="v">${c.sot}°<small> / ${Math.round(upperHours(c.soh)*60)}ד'</small></div></div>
       <div class="stat"><div class="l">סו-ויד</div><div class="v">${c.svt}°<small> / ${c.svh}ש</small></div></div>
       <div class="stat"><div class="l">גימור</div><div class="v">${c.smt}°</div></div>
       <div class="stat"><div class="l">קושי</div><div class="v">${dots(c.diff)}</div></div>
       `:`
       <div class="stat"><div class="l">סו-ויד</div><div class="v">${c.svt}°<small> / ${c.svh}ש</small></div></div>
       <div class="stat"><div class="l">עישון</div><div class="v">${c.smt}°<small> / ${c.smh}ש</small></div></div>
       ${(c.grt!=null||c.grillable===false)?`<div class="stat"><div class="l">גריל</div><div class="v">${c.grillable===false?'—':`${c.grt}°<small> / ${c.grh}ש</small>`}</div></div>`:''}
       <div class="stat"><div class="l">יעד מרקם</div><div class="v" id="tgtStat">${c.tgt}°</div></div>
       ${c.safe?`<div class="stat"><div class="l">בטיחות</div><div class="v">${c.safe}°</div></div>`:''}
       <div class="stat"><div class="l">חוסך מעשנת</div><div class="v" style="color:#a7d086">${c.saved}ש</div></div>
       `}
     </div>
     ${donenessSelector(c)}
     ${methodToggleHTML(c,key)}
     ${build?'<div class="tabs"><div class="tab" data-tab="build">🔨 בנייה מאפס</div><div class="tab on" data-tab="method">📋 תוכנית בישול</div></div>':''}
     <div class="progress"><i id="prog"></i></div>
     <div id="methodArea"></div>

     <div class="var">
       <h4>${isProduce(c)?'טיפים':'ווריאנט תיבול חלופי'}</h4>
       ${isProduce(c)?`<div class="varitem"><div class="vt">טיפ הכנה</div><p>${c.somid||'—'}. ${c.wood&&c.wood!=='ללא'?`לניחוח עשן: ${c.wood}.`:''}</p></div>`
       :`<div class="varitem"><div class="vt">${altR[0]}</div><p>${altR[1]}</p></div>
       <div class="varitem"><div class="vt">🪵 עץ מומלץ</div><p>${c.wood}.</p></div>`}
     </div>
     ${seasPickerHTML(key, c.cat, isProduce(c), curProject?'edit':'view')}

     <div id="servHost"></div>
     <div id="extras"></div>

     <div class="raw">
       <h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px">נתוני גלם מהטבלה</h4>
       ${isProduce(c)?`<table>
        <tr><td>גריל / אש ישירה</td><td>${c.sot}°C · ~${Math.round(upperHours(c.soh)*60)} דק'</td></tr>
        <tr><td>סו-ויד (ריכוך)</td><td>${c.svt}°C · ${c.svh} שעות</td></tr>
        <tr><td>גימור לאחר סו-ויד</td><td>${c.smt}°C · ~${Math.round(upperHours(c.smh)*60)} דק'</td></tr>
        <tr><td>ראב הבית (תבנית)</td><td>${c.rub}</td></tr>
        <tr><td>טיפ הכנה</td><td>${c.somid||'—'}</td></tr>
        <tr><td>עץ לעשן (אופציונלי)</td><td>${c.wood}</td></tr>
        <tr><td>רמת קושי</td><td>${c.diff} / 5</td></tr>
       </table>`:`<table>
        <tr><td>טמפ' / זמן סו-ויד</td><td>${c.svt}°C · ${c.svh} שעות</td></tr>
        <tr><td>טמפ' / זמן עישון (סו-ויד+עישון)</td><td>${c.smt}°C · ${c.smh} שעות</td></tr>
        <tr><td>טמפ' / זמן עישון בלבד</td><td>${c.sot}°C · ${c.soh} שעות</td></tr>
        ${grillLine(c)?`<tr><td>גריל (טמפ' / זמן / אזור)</td><td>${grillLine(c)}</td></tr>`:''}
        <tr><td>טמפ' יעד (מרקם) / בטיחות</td><td>${c.tgt}°C${c.safe?` / ${c.safe}°C`:''}</td></tr>
        <tr><td>צריבה</td><td>${c.sear}</td></tr>
        <tr><td>טיפול באמצע (סו-ויד+עישון)</td><td>${c.mid}</td></tr>
        <tr><td>טיפול / עטיפה (עישון בלבד)</td><td>${c.somid}</td></tr>
        <tr><td>זמן מנוחה</td><td>${c.rest} דק'</td></tr>
        <tr><td>מרינדה / ראב</td><td>${c.rub}</td></tr>
        <tr><td>צ'אנקים / עץ</td><td>${c.wood}</td></tr>
        <tr><td>פחם מומלץ</td><td>${c.coal}</td></tr>
        <tr><td>רמת קושי</td><td>${c.diff} / 5</td></tr>
       </table>`}
     </div>
     ${sourcesBlock(c)}
   </div>`;
  showPanel(html);
  $("#servHost").innerHTML=servingsCalcHTML(c); wireServCalc($("#servHost"),c);
  fillExtras(key);
  // method tabs
  const produce=isProduce(c);
  function comboNote(combo){
    const has=m=>combo.includes(m);
    const parts=[];
    if(has('sv')) parts.push('🌊 סו-ויד — בישול מדויק באמבט');
    if(has('smoke')) parts.push('💨 עישון — טעם עשן וקרום');
    if(has('grill')) parts.push('🔥 גריל — צריבה וטעם אש');
    let extra='';
    if(has('sv')&&has('smoke')&&has('grill')) extra=' המסלול המלא: דיוק, עשן, וצריבה קצרה לקרום בסוף.';
    else if(has('sv')&&has('grill')&&!has('smoke')) extra=' הצירוף המנצח למידת עשייה מושלמת עם קרום.';
    else if(has('sv')&&has('smoke')) extra=` חוסך כ-${c.saved||1} שעות מעשנת.`;
    else if(has('smoke')&&has('grill')) extra=' reverse-sear קלאסי: עשן איטי ואז צריבה.';
    return parts.join(' + ')+'.'+extra;
  }
  function paintMethod(){
    const combo=ctxMethods(c,key);
    const steps=injectSeasoningSteps(composedSteps(c,combo), key, !curProject);   // catalog card = template steps
    const mkey='m-'+combo.slice().sort().join('_');
    $("#methodArea").innerHTML=`<div class="method-note">${comboNote(combo)}</div><div class="steps">`+
      steps.map((s,i)=>stepHTML(key,mkey,i,s)).join("")+`</div>`;
    wireSteps(key,mkey,steps);
  }
  function paint(which){
    if(which==='build'&&build){ renderBuildInto("#methodArea", key+"-b", build); $("#prog").style.width="0%"; return; }
    paintMethod();
  }
  // toggle wiring with validation
  $("#panel").querySelectorAll('.mtoggle').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return;
    const cur=ctxMethods(c,key);
    const m=b.dataset.mt;
    const next=cur.includes(m)? cur.filter(x=>x!==m) : [...cur,m];
    if(!validCombo(c,next)){
      const r=methodRules(c);
      let msg='לצומח: עד 2 שיטות — שלושתן יחד יבשלו יתר-על-המידה';
      if(!next.length) msg='חייבת להישאר שיטה אחת לפחות';
      else if(r.require&&!r.require.every(x=>next.includes(x))) msg='הפריט דורש ריכוך מקדים (סו-ויד)';
      else if(r.needsCookFor==='grill'&&next.includes('grill')&&next.length===1) msg='נתח ארוך-בישול: גריל רק כגימור — השאר גם סו-ויד או עישון';
      toast(msg);
      return;
    }
    if(curProject) store.set(methodKeyFor(key),next); else cardSet('method:'+key,next);
    b.classList.toggle('on');
    clearTimers(); paintMethod();
  }));
  $("#panel").querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
    $("#panel").querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
    t.classList.add("on");clearTimers();paint(t.dataset.tab);
  }));
  paintMethod();
  wireDoneness(c);
  $("#panel").querySelectorAll('[data-seas]').forEach(b=>b.addEventListener('click',()=>openFrom(()=>openCut(c), ()=>{
    const s=(DATA.seasonings||[]).find(x=>x.id===b.dataset.seas); if(!s) return;
    showPanel(`${toolTop(s.heb, s.eng+' · '+s.origin, KIND_EMOJI[s.kind], cont2color(s.cont))}<div class="panel-body">${seasoningDetailHTML(s)}</div>`);
  })));
  wireSeasPicker($("#panel"), key, c.cat, isProduce(c), curProject?'edit':'view', ()=>{ clearTimers(); paintMethod(); toast('התיבול עודכן — השלבים חושבו מחדש'); }, ()=>openCut(c));
}

/* ── per-cut doneness ─────────────────────────────────────────── */
const DONE_SCALES={
  steak:{rare:'נא',mr:'מדיום-רייר',med:'מדיום',mw:'מדיום-וֶל',well:'עשוי'},
  white:{mr:'עסיסי',med:'מאוזן',well:'מוצק'},
  dark:{mr:'רך',med:'מאוזן',well:'נשלף'},
  fish:{mr:'משיי',med:'פלקי',well:'מוצק'}
};
function doneLabel(cut,k){
  const sc=(cut&&cut.doneness&&cut.doneness.scale)||'steak';
  return (DONE_SCALES[sc]&&DONE_SCALES[sc][k])||DONE_SCALES.steak[k]||k;
}
function doneKey(cut){ return 'done:cut-'+cut.n; }
function currentDoneness(cut){
  if(!cut.doneness) return null;
  const saved=cardGet(doneKey(cut));   // session-only: template resets on next visit
  return (saved && cut.doneness.levels[saved])? saved : cut.doneness.default;
}
function donenessTarget(cut){
  const d=currentDoneness(cut);
  return d? cut.doneness.levels[d].c : cut.tgt;
}
function donenessSelector(cut){
  if(!cut.doneness) return '';
  const cur=currentDoneness(cut);
  const order=['rare','mr','med','mw','well'];
  const btns=order.filter(k=>cut.doneness.levels[k]).map(k=>{
    const lv=cut.doneness.levels[k];
    return `<button class="dn-btn ${k===cur?'on':''}" data-done="${k}">
      <span class="dn-l">${doneLabel(cut,k)}</span><span class="dn-c">${lv.c}°</span></button>`;
  }).join('');
  return `<div class="dn-wrap">
    <div class="dn-head">מידת עשייה <small>(טמפ׳ פנים = מידת עשייה; הזמן משפיע על מרקם בלבד)</small></div>
    <div class="dn-btns">${btns}</div>
    <button class="dn-reset" data-donereset>↺ חזרה למומלץ (${doneLabel(cut,cut.doneness.default)})</button>
  </div>`;
}
function wireDoneness(cut){
  if(!cut.doneness) return;
  const panel=$("#panel"); if(!panel) return;
  panel.querySelectorAll('[data-done]').forEach(b=>b.addEventListener('click',()=>{
    cardSet(doneKey(cut),b.dataset.done);
    panel.querySelectorAll('[data-done]').forEach(x=>x.classList.toggle('on',x===b));
    const tgt=cut.doneness.levels[b.dataset.done].c;
    const stat=$("#tgtStat"); if(stat) stat.textContent=tgt+'°';
    toast(`יעד עודכן: ${doneLabel(cut,b.dataset.done)} · ${tgt}°`);
  }));
  const rb=panel.querySelector('[data-donereset]');
  if(rb) rb.addEventListener('click',()=>{
    localStorage.removeItem(doneKey(cut));
    const def=cut.doneness.default, tgt=cut.doneness.levels[def].c;
    panel.querySelectorAll('[data-done]').forEach(x=>x.classList.toggle('on',x.dataset.done===def));
    const stat=$("#tgtStat"); if(stat) stat.textContent=tgt+'°';
    toast(`אופס למומלץ: ${doneLabel(cut,def)} · ${tgt}°`);
  });
}

function stepHTML(key,which,i,s){
  const [t,c,sec]=s;
  const ck=(curProject?((projById(curProject)||{}).doneSteps||[]).includes(i):cardGet(`${key}-${which}-${i}`))?'done':'';
  return `<div class="step ${ck}" data-i="${i}">
     <button class="cbx ${ck}" data-ck>${ck?'✓':''}</button>
     <div class="step-main">
       <div class="step-t">${t}</div>
       <div class="step-c">${c}</div>
       ${sec?timerHTML(sec):''}
     </div>
   </div>`;
}
function timerHTML(sec){
  return `<div class="timer" data-sec="${sec}" data-left="${sec}" role="timer">
     <button data-play aria-label="הפעל טיימר">▶</button>
     <span class="tt">${fmt(sec)}</span>
     <span class="tt-alert" role="alert" aria-live="assertive"></span>
     <button class="rst" data-reset aria-label="אפס טיימר">↻</button>
   </div>`;
}
let mkAudioCtx=null;
// unlock audio inside a user gesture (the play tap) so the completion alarm can actually sound
function timerAudioPrime(){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; if(!mkAudioCtx) mkAudioCtx=new AC(); if(mkAudioCtx.state==='suspended') mkAudioCtx.resume(); }catch(e){} }
// real audible alarm — three short 880Hz beeps (was: new AudioContext() that produced no sound)
function timerBeep(){ try{ if(!mkAudioCtx) timerAudioPrime(); if(!mkAudioCtx) return; if(mkAudioCtx.state==='suspended') mkAudioCtx.resume();
  const ctx=mkAudioCtx, t0=ctx.currentTime;
  [0,0.35,0.7].forEach(function(t){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001,t0+t); g.gain.exponentialRampToValueAtTime(0.3,t0+t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+t+0.3); o.start(t0+t); o.stop(t0+t+0.32); });
  }catch(e){} }
function wireSteps(key,which,steps){
  const area=$("#methodArea");
  area.querySelectorAll(".step").forEach(st=>{
    const i=+st.dataset.i;
    st.querySelector("[data-ck]").addEventListener("click",()=>{
      const done=!st.classList.contains("done");
      st.classList.toggle("done",done);
      const b=st.querySelector(".cbx");b.classList.toggle("done",done);b.textContent=done?'✓':'';
      if(curProject){ const a=pantry(), p=a.find(x=>x.id===curProject); if(p){ p.doneSteps=p.doneSteps||[]; if(done){ if(!p.doneSteps.includes(i)) p.doneSteps.push(i); } else p.doneSteps=p.doneSteps.filter(x=>x!==i); savePantry(a); } }
      else cardSet(`${key}-${which}-${i}`,done);
      updateProg(key,which,steps.length);
    });
  });
  area.querySelectorAll(".timer").forEach(tm=>wireTimer(tm));
  updateProg(key,which,steps.length);
}
function updateProg(key,which,total){
  let done=0;
  if(curProject){ const ds=((projById(curProject)||{}).doneSteps)||[]; done=ds.filter(i=>i<total).length; }
  else { for(let i=0;i<total;i++)if(cardGet(`${key}-${which}-${i}`))done++; }
  const p=$("#prog");if(p)p.style.width=(done/total*100)+"%";
}
function wireTimer(tm){
  let left=+tm.dataset.left, sec=+tm.dataset.sec, iv=null;
  const tt=tm.querySelector(".tt"), play=tm.querySelector("[data-play]");
  play.addEventListener("click",()=>{
    timerAudioPrime();
    if(iv){clearInterval(iv);iv=null;play.textContent="▶";play.setAttribute('aria-label','הפעל טיימר');return;}
    play.textContent="❚❚";play.setAttribute('aria-label','השהה טיימר');
    iv=setInterval(()=>{
      left--;tt.textContent=fmt(Math.max(0,left));
      if(left<=0){clearInterval(iv);iv=null;play.textContent="▶";play.setAttribute('aria-label','הפעל טיימר');tm.classList.add("ringing");tt.textContent="סיום!";
        const al=tm.querySelector(".tt-alert"); if(al) al.textContent="הטיימר הסתיים!";
        timerBeep();}
    },1000);
    timers["t"+Math.random()]=iv;
  });
  tm.querySelector("[data-reset]").addEventListener("click",()=>{
    if(iv){clearInterval(iv);iv=null;}left=sec;play.textContent="▶";play.setAttribute('aria-label','הפעל טיימר');tm.classList.remove("ringing");tt.textContent=fmt(sec);
    const al=tm.querySelector(".tt-alert"); if(al) al.textContent="";
  });
}
function clearTimers(){Object.values(timers).forEach(clearInterval);timers={};}

function openSpec(s){
  curProject=pendingProject; pendingProject=null;
  const smk = s.smt? `${s.smt}°C · ${s.smh} שעות` : s.smh;
  const build=DATA.builds["spec-"+s.n];
  const steps=[];
  if(s.cure&&s.cure!=='—') steps.push(["ריפוי / כבישה",s.cure,0]);
  if(s.smt) steps.push(["עישון",`עשן ב-${s.smt}°C למשך ${s.smh} שעות${typeof s.tgt==='number'?` עד ${s.tgt}°C פנימי`:''}.`,upperHours(s.smh)*3600]);
  else steps.push(["עישון / ייבוש",s.smh,0]);
  if(s.age&&s.age!=='—') steps.push(["ייבוש / הבשלה",s.age,0]);
  steps.push(["הערת מקצוע",s.note,0]);
  const key=`spec-${s.n}`;
  const col=catColor(s.cat);
  const html=`
   <div class="panel-top" style="--c:${col}">
     ${headArt(s.cat)}
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat" style="color:${col}">${s.cat}${s.origin?` · ${s.origin}`:` · מוצר #${s.n}`}</div>
     <h2>${s.heb}</h2>
     <div class="en">${s.eng} · רמת קושי ${dots(s.diff)}</div>
   </div>
   <div class="panel-body">${s.desc?`<p class="itemdesc">${s.desc}</p>`:''}
     <div class="statline">
       <div class="stat"><div class="l">עישון</div><div class="v" style="font-size:15px">${smk}</div></div>
       <div class="stat"><div class="l">יעד / הבשלה</div><div class="v" style="font-size:15px">${typeof s.tgt==='number'?s.tgt+'°':(s.age!=='—'?s.age:s.tgt)}</div></div>
       <div class="stat"><div class="l">עץ</div><div class="v" style="font-size:15px">${s.wood}</div></div>
     </div>
     ${build?`<div class="tabs">
       <div class="tab on" data-tab="build">בנייה מאפס</div>
       <div class="tab" data-tab="quick">סקירה מהירה</div>
     </div>`:''}
     <div class="progress"><i id="prog"></i></div>
     <div id="methodArea"></div>
     <div id="extras"></div>
     ${sourcesBlock(s)}
   </div>`;
  showPanel(html);
  fillExtras(key);
  function quick(){
    $("#methodArea").innerHTML=`<div class="method-note">${s.note}</div><div class="steps">`+
      steps.map((st,i)=>stepHTML(key,'one',i,st)).join("")+`</div>`;
    wireSteps(key,'one',steps);
  }
  if(build){
    renderBuildInto("#methodArea", key+"-b", build);
    $("#panel").querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
      $("#panel").querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
      t.classList.add("on");clearTimers();
      if(t.dataset.tab==='build') renderBuildInto("#methodArea", key+"-b", build); else quick();
    }));
  } else { quick(); }
}

function openMake(id){
  const m=DATA.makes[id]; if(!m) return;
  curProject=pendingProject; pendingProject=null;
  const col=catColor(m.cat);
  const html=`
   <div class="panel-top" style="--c:${col}">
     ${headArt(m.cat)}
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat" style="color:${col}">${m.cat}${m.origin?` · ${m.origin}`:''}</div>
     <h2>${m.heb}</h2>
     <div class="en">${m.eng} · רמת קושי ${dots(m.diff)}</div>
   </div>
   <div class="panel-body">${m.desc?`<p class="itemdesc">${m.desc}</p>`:''}<div class="progress"><i id="prog"></i></div><div id="methodArea"></div><div id="extras"></div>${sourcesBlock(m)}</div>`;
  showPanel(html);
  renderBuildInto("#methodArea", "make-"+id, m.build);
  fillExtras("make-"+id);
}

let lastFocus=null;
let panelStack=[];        // stack of reopener functions for back-navigation
function showPanel(html){
  lastFocus=document.activeElement;
  const p=$("#panel");p.innerHTML=html;p.classList.add("open");p.setAttribute("aria-hidden","false");
  $("#scrim").classList.add("open");document.body.classList.add("noscroll");
  const xb=p.querySelector(".x"); if(xb) xb.addEventListener("click",closePanel);
  const top=p.querySelector(".panel-top");
  p.scrollTop=0; const body=p.querySelector(".panel-body"); if(body) body.scrollTop=0;
  if(panelStack.length && top && !top.querySelector(".backbtn")){
    const bb=document.createElement("button");
    bb.className="backbtn"; bb.type="button"; bb.textContent="→ חזרה לחלון הקודם";
    bb.setAttribute("aria-label","חזרה לחלון הקודם");
    bb.addEventListener("click",panelBack);
    top.appendChild(bb);   // in panel-top: always a direct child, never wiped by body re-render
  }
  if(top && !top.querySelector(".prbtn")){
    const pb=document.createElement("button");
    pb.className="prbtn"; pb.type="button"; pb.textContent="⎙ PDF"; pb.setAttribute("data-print","");
    top.appendChild(pb);
  }
  p.querySelectorAll("[data-print]").forEach(b=>b.addEventListener("click",()=>window.print()));
  const h=p.querySelector("h2"); p.setAttribute("aria-label", h?h.textContent:"פרטים");
  requestAnimationFrame(()=>{ const x=p.querySelector(".x"); (x||p).focus(); });
}
// open a panel FROM another panel, remembering how to return to the current one
function openFrom(reopenCurrent, openNext){ panelStack.push(reopenCurrent); openNext(); }
function panelBack(){ const fn=panelStack.pop(); if(fn){clearTimers();fn();} else closePanel(); }
/* ── unified in-app dialog (replaces native confirm/prompt/alert) ──
   appConfirm(msg,opts) → Promise<true|false|null(dismiss)>
   appPrompt(msg,def)   → Promise<string|null> */
function appDialog(o){
  return new Promise(res=>{
    const old=document.getElementById('appdlg'); if(old) old.remove();
    const wrap=document.createElement('div'); wrap.id='appdlg';
    wrap.innerHTML=`<div class="appdlg-scrim"></div>
      <div class="appdlg-card" role="dialog" aria-modal="true">
        <div class="appdlg-msg">${o.msg}</div>
        ${o.input!==undefined?`<input class="appdlg-in" value="${(o.input||'').replace(/"/g,'&quot;')}" placeholder="${o.placeholder||''}">`:''}
        <div class="appdlg-btns">
          ${o.cancelLabel!==null?`<button class="appdlg-btn ghost" data-adk="cancel">${o.cancelLabel||'ביטול'}</button>`:''}
          <button class="appdlg-btn ${o.danger?'danger':''}" data-adk="ok">${o.okLabel||'אישור'}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const inp=wrap.querySelector('.appdlg-in');
    const done=v=>{ wrap.remove(); res(v); };
    wrap.querySelector('.appdlg-scrim').addEventListener('click',()=>done(null));
    wrap.querySelectorAll('[data-adk]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.dataset.adk==='cancel') return done(false);
      done(inp?inp.value.trim():true);
    }));
    if(inp){ inp.focus(); inp.addEventListener('keydown',e=>{ if(e.key==='Enter') done(inp.value.trim()); }); }
    else { const ob=wrap.querySelector('[data-adk="ok"]'); if(ob) ob.focus(); }
  });
}
function appConfirm(msg,opts){ return appDialog(Object.assign({msg},opts||{})); }
function appPrompt(msg,def,opts){ return appDialog(Object.assign({msg,input:def||''},opts||{})); }
function closePanel(){
  try{speechSynthesis.cancel();}catch(e){}
  if(typeof gemStop==='function') gemStop();
  if(typeof vcRec!=='undefined'&&vcRec){try{vcRec.stop();}catch(e){} vcRec=null;}clearTimers();panelStack=[];$("#panel").classList.remove("open");$("#panel").setAttribute("aria-hidden","true");
  $("#scrim").classList.remove("open");document.body.classList.remove("noscroll");
  if(lastFocus&&lastFocus.focus){try{lastFocus.focus();}catch(e){}} lastFocus=null;}

/* ---------- shopping list ---------- */
function shopData(){
  const meat=[], season=new Set(), wood=new Set(), coal=new Set(), equip=new Set(), items=[], seasSel=[];
  const seenSeas=new Set();
  const collectSeas=(k,heb)=>{
    selectedSeasonings(k).forEach(id=>{
      const s=seasoningById(id); if(!s) return;
      const ex=seasSel.find(x=>x.id===id);
      if(ex){ ex.for.push(heb); return; }
      seasSel.push({id, heb:s.heb, kind:s.kind, ing:s.ing, sub:s.sub, for:[heb]});
    });
  };
  const mq=store.get('mk-menuqty')||{};
  const qkg=k=>mq[k]?` — ~${(mq[k]/1000).toFixed(1)} ק״ג <b style="color:var(--ember2)">(מהתפריט)</b>`:null;
  const ilFor=(heb,eng)=>{ const il=(typeof ILCUT!=='undefined')?ILCUT.find(r=>heb.includes(r[0].split(' ')[0])||(eng||'').toLowerCase().includes((r[1]||'').toLowerCase())):null; return il?` — 🥩 לקצב: ${il[2]}`:''; };
  // shopping list is derived from the ACTIVE event/menu (not a separate cart) — always in sync
  const srcKeys=[...new Set((typeof menuState==='function')?(menuState().keys||[]):[])];
  srcKeys.forEach(k=>{
    if(k.startsWith("cut-")){
      const c=DATA.cuts.find(x=>"cut-"+x.n===k); if(!c)return;
      items.push({cat:c.cat,name:c.heb+" · "+c.eng,key:k});
      collectSeas(k,c.heb);
      meat.push(`${c.heb} (${c.eng})${qkg(k)||` — ~${c.kg} ק״ג`}${ilFor(c.heb,c.eng)}`);
      if(k==='cut-18'){ const dn=burgerDiners(); const tps=[...new Set(dn.flatMap(d=>d.tops||[]))]; const chs=[...new Set(dn.filter(d=>d.cheesePos!=='none').map(d=>d.cheese))]; const scs=[...new Set(dn.map(d=>d.sauce).filter(Boolean))]; const bns=[...new Set(dn.map(d=>d.bun).filter(Boolean))];
        meat.push(`🍔 לבורגרים (${dn.length} סועדים): לחמניות ${bns.join('/')||'—'} ×${dn.length}${chs.length?` · גבינות: ${chs.join(', ')}`:''}${tps.length?` · תוספות: ${tps.join(', ')}`:''}${scs.length?` · רטבים: ${scs.join(', ')}`:''}`); }
      // house rub flows through collectSeas as the default selection — no separate season.add (avoids double-listing)
      String(c.wood).split("/").forEach(w=>wood.add(w.trim()));
      if(c.coal) coal.add(c.coal);
    } else if(k.startsWith("spec-")){
      const s=DATA.specials.find(x=>"spec-"+x.n===k); if(!s)return;
      items.push({cat:s.cat,name:s.heb+" · "+s.eng,key:k});
      collectSeas(k,s.heb);
      meat.push(`${s.heb} (${s.eng})${qkg(k)||''}`);
      if(s.wood&&s.wood!=="ללא") String(s.wood).split("/").forEach(w=>wood.add(w.trim()));
      const b=DATA.builds["spec-"+s.n]; if(b&&b.materials) b.materials.forEach(m=>equip.add(m));
    } else if(k.startsWith("make-")){
      const id=k.slice(5), m=DATA.makes[id]; if(!m)return;
      items.push({cat:m.cat,name:m.heb+" · "+m.eng,key:k});
      collectSeas(k,m.heb);
      meat.push(`${m.heb} (${m.cat})${qkg(k)||''}`);
      if(m.build&&m.build.materials) m.build.materials.forEach(x=>equip.add(x));
    }
  });
  // extras: sides, drinks, desserts, seasonal fruit — EVENT context only (not relevant for quick-cook)
  const extras=[];
  if(typeof menuCtx!=='function' || menuCtx()==='event'){
    const ms=(typeof menuState==='function')?menuState():{};
    const g=ms.guests||8;
    (ms.sides||[]).forEach(x=>extras.push(`${x} — ${eventQty(x,'side',g)}`));
    (ms.drinks||[]).forEach(x=>extras.push(`${x} — ${eventQty(x,'drink',g)}`));
    (ms.desserts||[]).forEach(x=>{ if(x==='__fruit') extras.push(`מגש פירות העונה (${eventSeason()}: ${seasonalFruitList().join(', ')}) — ${eventQty('','fruit',g)}`); else extras.push(`${x} — ${eventQty(x,'dessert',g)}`); });
  }
  return {items, meat, season:[...season], wood:[...wood], coal:[...coal], equip:[...equip], seasSel, extras};
}
function cartInventoryHTML(){
  if(typeof invList!=='function') return '';
  const inv=invList()||[]; const low=inv.filter(i=>i.qty<=i.low);
  if(!low.length) return '';
  return `<div class="shop-group"><h4>📦 מהמזווה — חסר / להשלים</h4>${low.map(i=>{
    const t=i.name+(i.low>0?` (יעד ≥${i.low} ${i.unit})`:'');
    const done=store.get("shop:"+t)?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(t)}">${done?"✓":""}</span><span>${t} · <b style="color:var(--terra-d)">יש ${i.qty}</b></span></div>`;
  }).join('')}</div>`;
}
function shopLine(text){
  const done=store.get("shop:"+text)?"done":"";
  return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(text)}">${done?"✓":""}</span><span>${text}</span></div>`;
}
function openCart(){
  const d=shopData();
  const grp=(t,a)=> a.length? `<div class="shop-group"><h4>${t}</h4>${a.map(shopLine).join("")}</div>`:"";
  const itemsHTML=d.items.length
    ? `<div class="shop-items">`+d.items.map(it=>`<div class="shop-item"><div><div class="si-cat">${it.cat}</div><h5>${it.name}</h5></div><button class="rm" data-rm="${it.key}" aria-label="הסר">×</button></div>`).join("")+`</div>`
    : `<div class="shop-empty">הרשימה ריקה.<br>הוסף מנות לאירוע (באשף או בכפתור ＋ שעל הכרטיסים) והן יופיעו כאן אוטומטית.</div>`;
  const html=`
   <div class="panel-top">
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat">${(typeof menuCtx==='function'&&menuCtx()==='cook')?'🔥 בישול מהיר':'🎉 '+((menuState().evName||'תכנון אירוע'))}</div>
     <h2>רשימת קניות</h2>
     <div class="en">${d.items.length} פריטים נבחרו</div>
   </div>
   <div class="panel-body">
     ${itemsHTML}
     ${d.items.length?`
       ${grp("בשר ודגים", d.meat)}
       ${grp("תיבול · ראב · מרינדה", d.season)}
       ${d.seasSel&&d.seasSel.length?`<div class="shop-group"><h4>🧂 למתבלים ורטבים שנבחרו</h4>${d.seasSel.map(s=>`
         <div class="shop-seas"><div class="ss-head">${KIND_EMOJI[s.kind]} <b>${s.heb}</b> <small>· ל${s.for.join(', ')}</small></div>
         ${shopLine(`מרכיבים: ${s.ing}`)}${s.sub?`<div class="ss-sub">⚠ תחליף בישראל: ${s.sub}</div>`:''}</div>`).join('')}</div>`:''}
       ${grp("🥗 תוספות · שתייה · קינוחים", d.extras)}
       ${grp("עץ לעישון", d.wood)}
       ${grp("פחם", d.coal)}
       ${(()=>{ if(!d.equip.length) return '';
         const inv=(typeof invList==='function'&&invList())||[];
         const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(String(name).split(/[0-9(]/)[0].trim())|| String(name).includes(i.name.split(' ')[0])));
         const need=d.equip.filter(m=>!invHas(m)), have=d.equip.filter(m=>invHas(m));
         let html=`<div class="shop-group"><h4>ציוד וחומרי ריפוי</h4>`;
         html+=need.map(shopLine).join('');
         html+=have.map(m=>`<div class="shop-line have"><span class="cbx-have">✓</span><span>${m} · <b style="color:var(--good)">יש במזווה</b></span></div>`).join('');
         return html+`</div>`;
       })()}
       ${cartInventoryHTML()}
       <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap">
         <button class="prbtn" style="position:static" data-print>⎙ הדפס / PDF</button>
         <button class="prbtn" style="position:static" data-clear>נקה הכל</button>
       </div>`:""}
   </div>`;
  showPanel(html);
  $("#panel").querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{const s=menuState();s.keys=(s.keys||[]).filter(k=>k!==b.dataset.rm);saveMenu(s);updateCartBadge();render();openCart();}));
  $("#panel").querySelectorAll("[data-shopck]").forEach(sp=>sp.addEventListener("click",()=>{
    const t=decodeURIComponent(sp.dataset.shopck), row=sp.closest(".shop-line"), done=!row.classList.contains("done");
    row.classList.toggle("done",done); sp.classList.toggle("done",done); sp.textContent=done?"✓":""; store.set("shop:"+t,done);
  }));
  const clr=$("#panel").querySelector("[data-clear]");
  if(clr) clr.addEventListener("click",()=>{const s=menuState();s.keys=[];saveMenu(s);updateCartBadge();render();openCart();});
}

/* ---------- glossary ---------- */
let glossFilter={q:'',grp:''};
function buildGloss(){
  const host=$("#gloss"); if(!host) return;
  const groups=[...new Set(DATA.glossary.map(g=>g.group))];
  // inject search + group chips once, above the grid
  let bar=$("#glossBar");
  if(!bar){ bar=document.createElement('div'); bar.id='glossBar'; host.parentNode.insertBefore(bar,host); }
  bar.innerHTML=`<div class="chome-search" style="margin:0 0 10px"><span class="ic">⌕</span><input id="glossSearch" placeholder="חפש מונח — עברית או אנגלית…" value="${glossFilter.q}"></div>
    <div class="chips" style="margin-bottom:12px"><span class="chip ${!glossFilter.grp?'on':''}" data-glossgrp="">הכל</span>${groups.map(g=>`<span class="chip ${glossFilter.grp===g?'on':''}" data-glossgrp="${g}">${g}</span>`).join('')}</div>`;
  const s=$("#glossSearch"); if(s){ s.addEventListener('input',()=>{ glossFilter.q=s.value.trim().toLowerCase(); paintGloss(); }); }
  bar.querySelectorAll('[data-glossgrp]').forEach(c=>c.addEventListener('click',()=>{ glossFilter.grp=c.dataset.glossgrp; buildGloss(); }));
  paintGloss();
}
function paintGloss(){
  let items=DATA.glossary;
  if(glossFilter.grp) items=items.filter(g=>g.group===glossFilter.grp);
  if(glossFilter.q) items=items.filter(g=>(g.he+' '+g.en+' '+g.desc).toLowerCase().includes(glossFilter.q));
  $("#gloss").innerHTML=items.length?items.map(g=>`<div class="gitem">
     <div class="gg">${g.group}</div>
     <div class="gh">${g.he}<span class="ge">${g.en}</span></div>
     <p>${g.desc}</p></div>`).join(""):'<div class="shop-empty">לא נמצא מונח תואם.</div>';
}

/* ---------- wire ---------- */
document.addEventListener("click",e=>{
  const fav=e.target.closest("[data-fav]");
  if(fav){ e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
  const addm=e.target.closest("[data-addmenu]");
  if(addm){ e.stopPropagation(); e.preventDefault(); if(typeof toggleCart==='function') toggleCart(addm.dataset.addmenu); syncAddMenuBtn(addm); if(typeof toast==='function') toast(menuHasKey(addm.dataset.addmenu)?'✓ נוסף לתפריט':'הוסר מהתפריט'); return; }
  const card=e.target.closest(".card");if(!card)return;
  if(card.dataset.kind==="make"){ openMake(card.dataset.mid); return; }
  const n=+card.dataset.n;
  if(card.dataset.kind==="cut") openCut(DATA.cuts.find(c=>c.n===n));
  else openSpec(DATA.specials.find(s=>s.n===n));
});
$("#scrim").addEventListener("click",closePanel);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanel();});
/* a11y: keyboard operability for non-native interactive surfaces. Enter/Space on a focused
   card / home-path / wizard chip synthesizes a click, routing through the existing handlers. */
document.addEventListener("keydown",e=>{
  if(e.key!=="Enter" && e.key!==" ") return;
  const t=e.target; if(!t||!t.closest) return;
  if(t.closest('button,a[href],input,select,textarea')) return;   // native controls handle their own keys
  const act=t.closest('.card,.cpath,.cnext,[data-cgo],[data-cwm],[data-app],.chip,.cmethod,[data-cwpick]');
  if(!act) return; e.preventDefault(); act.click();
});
/* a11y: make those surfaces focusable + announced; keep aria-pressed synced with the .on toggle class.
   (Cards carry tabindex/role in their own template — the high-count path — so they stay out of this observer.) */
(function(){
  const BTN='.cpath,.cnext,[data-cgo],[data-cwm],[data-app],.chip,.cmethod,[data-cwpick]';
  const PRESS='.chip,.cmethod,[data-app],.tab,.vc-langbtn';
  function enh(el){
    if(el.matches(BTN)){ if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0'); if(!el.hasAttribute('role')) el.setAttribute('role','button'); }
    if(el.matches(PRESS)) el.setAttribute('aria-pressed', el.classList.contains('on')?'true':'false');
  }
  function scan(n){ if(!n||n.nodeType!==1) return; if(n.matches) enh(n); if(n.querySelectorAll) n.querySelectorAll(BTN+','+PRESS).forEach(enh); }
  scan(document.body);
  new MutationObserver(ms=>ms.forEach(m=>{
    if(m.type==='childList') m.addedNodes.forEach(scan);
    else if(m.target&&m.target.matches&&m.target.matches(PRESS)) m.target.setAttribute('aria-pressed', m.target.classList.contains('on')?'true':'false');
  })).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
/* focus trap inside the open panel */
$("#panel").addEventListener("keydown",e=>{
  if(e.key!=="Tab") return;
  const p=$("#panel"); if(!p.classList.contains("open")) return;
  const list=[...p.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled && el.offsetParent!==null);
  if(!list.length) return;
  const first=list[0], last=list[list.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
/* toast with optional undo */
let toastTmo=null;
function toast(msg, undoFn){
  let t=$("#toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; t.setAttribute("role","status"); t.setAttribute("aria-live","polite"); document.body.appendChild(t); }
  t.innerHTML=`<span>${msg}</span>`+(undoFn?'<button data-undo>בטל</button>':'');
  t.classList.add("show");
  clearTimeout(toastTmo); toastTmo=setTimeout(()=>t.classList.remove("show"),5000);
  if(undoFn){ t.querySelector("[data-undo]").addEventListener("click",()=>{ clearTimeout(toastTmo); t.classList.remove("show"); undoFn(); }); }
}
$("#q").addEventListener("input",()=>catView());

/* quick-nav jump */
/* =====================================================================
   PRODUCT FEATURES (13): favorites, timeline, kosher, filters, notes,
   pantry, reminders, help, ask, cut-translator, woods, menu, journal
   ===================================================================== */
function uid(){return Math.random().toString(36).slice(2,9);}
function today(){return new Date().toISOString().slice(0,10);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+(+n||0));return x.toISOString().slice(0,10);}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/864e5);}
function fmtDate(d){try{return new Date(d).toLocaleDateString('he-IL');}catch(e){return d;}}

function resolveItem(key){
  if(!key) return null;
  if(key.startsWith('cut-')){const c=DATA.cuts.find(x=>'cut-'+x.n===key);return c&&metaCut(c);}
  if(key.startsWith('spec-')){const s=DATA.specials.find(x=>'spec-'+x.n===key);return s&&metaSpec(s);}
  if(key.startsWith('make-')){const m=DATA.makes[key.slice(5)];return m&&metaMake(key.slice(5),m);}
  if(key.startsWith('umake-')){const m=(typeof umakes==='function'?umakes():{})[key];return m&&{kind:'make',key,heb:m.heb,eng:m.eng||'',cat:m.cat,obj:m,diff:m.diff||2,build:m.build,ai:true};}
  return null;
}

/* ---- favorites ---- */
let favs=new Set(store.get('mk-fav')||[]);
function isFav(k){return favs.has(k);}
function toggleFav(k){favs.has(k)?favs.delete(k):favs.add(k);store.set('mk-fav',[...favs]);updateFavBadge();render();}
function updateFavBadge(){const e=$("#favN");if(e)e.textContent=favs.size;}
function favStar(key){return `<button class="favstar ${isFav(key)?'on':''}" data-fav="${key}" aria-pressed="${isFav(key)}" aria-label="${isFav(key)?'הסר ממועדפים':'הוסף למועדפים'}">${isFav(key)?'★':'☆'}</button>`;}
function ratingMini(key){const r=store.get('rating:'+key)||0;return r?`<span class="rmini" aria-label="דירוג ${r}">${'★'.repeat(r)}</span>`:'';}

/* ---- kosher ---- */
/* ── kashrut classification (species/recipe-based; not a hechsher) ──
   Statuses: 'pork' · 'shellfish' (non-finned/scaled sea creatures + scaleless fish) ·
             'treif' (blood) · 'dairy' (כשר חלבי) · 'kosher' (kosher species/parve).
   pork/shellfish/treif are filtered out by the kosher filter; dairy is kept and tagged. */
const K_FISH_OK=/(סלמון|salmon|לקס|lox|גרבלקס|gravlax|פורל|trout|טונה|tuna|הליבוט|halibut|מקרל|mackerel|בקלה|\bcod\b|סרדין|sardine|לברק|דניס|בורי|אמנון|טילפיה|tilapia|בס ים|sea ?bass)/;
const K_FISH_NO=/(דג חרב|swordfish|שפמנון|catfish|כריש|\bshark\b|צלופח|\beel\b|sturgeon|חדקן|מרלין|marlin)/;
// pork MEAT/FAT/charcuterie (casing mentions are stripped before this runs — casing is swappable)
// pork MEAT/FAT/charcuterie. Hebrew relies on 'חזיר' (every pork item's meat says so);
// Latin names cover English text. Hebrew transliterations (קופה/פנצ'טה…) are omitted — they
// appear in generic technique notes (e.g. "roll like coppa/pancetta") and cause false positives.
const K_PORK=/(חזיר|לחם חזיר|\bpork\b|לארד|\blard\b|pancetta|guanciale|coppa|capicola|prosciut|serrano|\bspeck\b|lonzino|nduja|jam[oó]n|culatello)/;
const K_BLOOD=/(\bדם\b|נקניק דם|\bblood\b|morcilla|מורסי|blutwurst|בלוטו|\bsundae\b|סונדה|soondae|בלאד)/;
// key -> status override for the few cases the rules get wrong.
// cut-17 (Kebab): 'חזיר' appears only in a cross-reference note comparing it to mici; the dish is beef/lamb.
const KOSHER_OVERRIDE={'cut-17':'kosher'};
// strip pork-CASING mentions (casing is swappable) before scanning for pork MEAT — including
// pork listed as one casing option among kosher ones, e.g. "מעי כבש/חזיר".
function _koshBuildTxt(m){ try{ return JSON.stringify(m.build||'').replace(/(שרוול|שרוולי|מעי|קרום|עור|טבעת)[^,.;\n)"]{0,18}חזיר/g,''); }catch(e){ return ''; } }
function kosherStatus(key){
  if(KOSHER_OVERRIDE[key]) return KOSHER_OVERRIDE[key];
  const m=resolveItem(key); if(!m) return 'kosher';
  const s=(m.heb+' '+m.eng+' '+(m.cat||'')).toLowerCase();
  const bt=_koshBuildTxt(m).toLowerCase();          // recipe text, pork-casing stripped
  // dairy (כשר חלבי) — cheese items (incl. halloumi mis-filed under vegetables)
  if(m.cat==='גבינה' || /\bcheese\b|גבינ|halloumi|חלומי/.test(s)) return 'dairy';
  // bacon: pork by default, but "beef bacon" is a kosher species
  if(/bacon|בייקון/.test(s)) return /(בקר|beef|עגל|veal|טלה|lamb)/.test(s)?'kosher':'pork';
  // pork by category, name, or pork meat/fat in the recipe
  if(m.cat==='חזיר' || K_PORK.test(s) || K_PORK.test(bt)) return 'pork';
  // blood products
  if(K_BLOOD.test(s) || K_BLOOD.test(bt)) return 'treif';
  // sea creatures: פירות ים is non-kosher unless a finned+scaled fish
  if(m.cat==='פירות ים') return K_FISH_OK.test(s)?'kosher':'shellfish';
  if(K_FISH_NO.test(s)) return 'shellfish';
  return 'kosher';   // beef/lamb/veal, poultry, kosher fish, vegetables, fruit, parve
}
function kosherLabel(k){return k==='pork'?'לא כשר (חזיר)':k==='shellfish'?'לא כשר (פירות ים / דג ללא קשקשת)':k==='treif'?'לא כשר (דם)':k==='dairy'?'כשר · חלבי':'כשר';}
function kosherTag(key){const k=kosherStatus(key);if(k==='pork'||k==='shellfish'||k==='treif')return '<span class="ktag kp">לא כשר</span>';if(k==='dairy')return '<span class="ktag kd">כשר חלבי</span>';return '';}
// kosher-filter OK = not pork, shellfish, or blood. Dairy is kosher (shown with a "כשר חלבי" tag).
function isKosherOk(key){const k=kosherStatus(key);return k!=='pork'&&k!=='shellfish'&&k!=='treif';}
/* v144: equipment-readiness tag — quiet unless gear is configured AND something's actually missing */
function gearTag(key){
  if(!gearConfigured()) return '';
  const meta=resolveItem(key); if(!meta || meta.kind!=='cut') return '';
  const combo=activeMethods(meta.obj, key);
  const missing=combo.filter(m2=>!gearCan(m2));
  if(!missing.length) return '';
  const names={sv:'סו-ויד',smoke:'מעשנת',grill:'גריל'};
  return `<span class="gtag" title="חסר ציוד: ${missing.map(m2=>names[m2]||m2).join(', ')}">🔧 בדוק ציוד</span>`;
}
function kosherSub(key){
  const m=resolveItem(key); if(!m||kosherStatus(key)!=='pork') return null;
  const s=(m.eng||'').toLowerCase();
  if(s.includes('bacon')) return 'בייקון בקר/הודו';
  if(/pancetta|coppa|guanciale|lardo|lonzino|speck|prosciutto|culatella|culatello/.test(s)) return 'ברזאולה/פסטרמה-הודו (בקר/הודו) או טלה מיובש';
  if(/salami|saucisson|soppressata|nduja|cacciatore|pepperoni|mortadella|bologna/.test(s)) return 'גרסת בקר/הודו + שומן בקר; שרוול בקר/צלולוז';
  if(/sausage|bratwurst|weisswurst|toulouse|chipolata|frankfurter|kielbasa|lingu|loukaniko/.test(s)) return 'בקר/עוף/הודו + שומן בקר/כבש';
  if(s.includes('porchetta')) return 'רולדת בקר/הודו עם שומר ושום';
  return 'בקר, טלה או הודו; שומן בקר/כבש במקום שומן חזיר';
}

/* ---- timeline lead time ---- */
/* ---- cook-process model: stages per item, for the detailed timeline ---- */
// Category profiles for MAKES (no per-recipe structured temps in data, so grounded
// category-level estimates are used; multiDay=true means "from scratch" spans days/weeks
// and isn't meaningful in a same-day clock — those belong in the Pantry tool instead).
const MAKE_COOK={
 'נקניקיות':     {multiDay:false, buildMin:75, restMin:10,
   methods:[{key:'grill',label:'גריל ישיר',tempC:'180-200°',hours:0.35,note:'עד ~71° פנים'},
            {key:'smoke',label:'עישון קצר',tempC:'77°',hours:2.2,note:'עד ~68-71° פנים'}]},
 'נקניק מעושן':   {multiDay:false, buildMin:90, restMin:10,
   methods:[{key:'smoke',label:'עישון',tempC:'77°',hours:3.2,note:'עד ~68-72° פנים'}]},
 'צלייה טחונה':   {multiDay:false, buildMin:75, restMin:5,
   methods:[{key:'grill',label:'גריל ישיר',tempC:'200°+',hours:0.25,note:'מהיר, חם מאוד'}]},
 'שווארמה':       {multiDay:false, buildMin:45, restMin:10,
   methods:[{key:'oven',label:'תנור/רוטיסרי',tempC:'180°',hours:1.1,note:'עד ~74-82° פנים'}]},
 'BBQ קלאסי':     {multiDay:false, buildMin:20, restMin:20,
   methods:[{key:'smoke',label:'עישון',tempC:'110-120°',hours:5,note:'מנתח גולמי; אם כבר מעושן — קצר בהרבה'}]},
 'פסטרמה':        {multiDay:true, buildMin:0, restMin:30,
   methods:[{key:'sv_smoke',label:'סו-ויד + עישון',tempC:'66°/110°',hours:3.5,note:'גימור קרום ועישון'},
            {key:'smoke',label:'עישון בלבד',tempC:'110°',hours:4.5,note:'עד ~74° ואידוי לרכות'}]},
 'דג מעושן':      {multiDay:true, buildMin:0, restMin:15,
   methods:[{key:'hot',label:'עישון חם',tempC:'77°',hours:2.5,note:'עד ~63° פנים'},
            {key:'cold',label:'עישון קר',tempC:'≤25°',hours:5,note:'ללא בישול — לקס/גרבלקס'}]},
 'סלומי':         {multiDay:true, buildMin:0, restMin:0,
   methods:[{key:'serve',label:'הוצא ופרוס',tempC:'—',hours:0.15,note:'מוכן לאכילה, רק לפרוס'}]},
 'נקניק מיובש':   {multiDay:true, buildMin:0, restMin:0,
   methods:[{key:'serve',label:'הוצא ופרוס',tempC:'—',hours:0.15,note:'מוכן לאכילה, רק לפרוס'}]},
 'בשר מיובש':     {multiDay:true, buildMin:0, restMin:0,
   methods:[{key:'serve',label:'הוצא והגש',tempC:'—',hours:0.1,note:'ג׳רקי/ביltong מוכן'}]},
};
function comboMethodEntry(c, combo, isCard){
  const names={sv:'סו-ויד',smoke:'עישון',grill:'גריל'};
  const label=(isCard?'⚡ ':'')+combo.map(m=>names[m]).join(' + ')+(isCard?' (מהכרטיסייה)':'');
  let hours=0, svH=0, smH=0;
  if(combo.includes('sv')) { svH=upperHours(c.svh); hours+=svH; }
  if(combo.includes('smoke')) { smH=combo.includes('sv')?upperHours(c.smh):upperHours(c.soh||c.smh); hours+=smH; }
  if(combo.includes('grill')) hours+=0.3;
  const dtgt=(typeof donenessTarget==='function' && c.doneness)? donenessTarget(c) : c.tgt;
  const tgtLabel=c.doneness?`יעד פנים ${dtgt}° (${doneLabel(c,currentDoneness(c))})`:`יעד ${c.tgt}°`;
  return {key:'c:'+combo.slice().sort().join('_'),label,tempC:combo.includes('sv')?`${c.svt}°`:(combo.includes('smoke')?`${c.sot||c.smt}°`:'אש'),
    hours,note:tgtLabel,svHours:svH,smHours:smH,svTemp:c.svt,smTemp:combo.includes('sv')?c.smt:(c.sot||c.smt),combo};
}
function itemProfile(meta){
  if(!meta) return null;
  if(meta.kind==='cut'){
    const c=meta.obj;
    const cardCombo=activeMethods(c, meta.key||('cut-'+c.n));
    // enumerate all VALID combos from the engine — single source of truth, no duplicates
    const all=[['sv'],['smoke'],['grill'],['sv','smoke'],['sv','grill'],['smoke','grill'],['sv','smoke','grill']]
      .filter(cb=>validCombo(c,cb));
    const cardKey='c:'+cardCombo.slice().sort().join('_');
    const methods=[comboMethodEntry(c,cardCombo,true),
      ...all.filter(cb=>('c:'+cb.slice().sort().join('_'))!==cardKey).map(cb=>comboMethodEntry(c,cb,false))];
    return {multiDay:false, buildMin:15, restMin:c.rest||20, methods, wood:c.wood};
  }
  if(meta.kind==='spec'){
    const s=meta.obj;
    return {multiDay:false, buildMin:15, restMin:15,
      methods:[{key:'smoke',label:'עישון',tempC:s.smt?`${s.smt}°`:'?',hours:upperHours(s.smh)||3,note:s.tgt&&s.tgt!=='—'?`יעד ${s.tgt}`:'',smHours:upperHours(s.smh)||3,smTemp:s.smt}],
      wood:s.wood};
  }
  // make
  const prof=MAKE_COOK[meta.cat];
  if(!prof) return {multiDay:false,buildMin:30,restMin:10,methods:[{key:'cook',label:'בישול',tempC:'?',hours:1,note:''}]};
  return prof;
}
function leadHours(meta){
  const p=itemProfile(meta); if(!p) return 1;
  const m=p.methods[0];
  return m.hours + p.restMin/60; // default "כבר מוכן" state — no build/prep time, matches itemStages(..,true)
}
/* build the ordered stage list for one item, working back from a method+ready state */
/* ── v144: sv/smoke order — two schools of thought, user-selectable per item ── */
const SV_SMOKE_ORDERS={
  'sv-smoke':{ name:'סו-ויד ← עישון', desc:'בטוח כברירת־מחדל: מתבשל לדיוק ומפוסטר בסו-ויד, ואז מקבל טעם וקראסט בעישון-גימור חם.' },
  'smoke-sv':{ name:'עישון ← סו-ויד', desc:'אסכולה מתקדמת: עישון קר על בשר גולמי לטבעת-עשן מרבית, ואז סו-ויד לדיוק ולפסטור מלא.' }
};
function svSmokeOrderDefault(){ return 'sv-smoke'; }
// app-computed (not AI, not user-typed) conservative cold-smoke temperature ceiling for the smoke-before-sv order
function coldSmokeTemp(hotTemp){ const t=Math.round((hotTemp||110)*0.55); return Math.max(45, Math.min(70, t)); }
// v145 fix: fridge-dry duration scales with the item's own sv-cook length — a flat 4h was absurd for
// quick-cook items (shrimp/produce, svHours≈0) which only need a brief towel-pat, not hours in the fridge.
function drySurfaceHours(svHours){ return Math.min(4, Math.max(0.25, (svHours||0)*0.3)); }
function itemStages(meta,methodKey,ready,order){
  const p=itemProfile(meta); if(!p) return [];
  const m=p.methods.find(x=>x.key===methodKey)||p.methods[0];
  const stages=[];
  if(!ready && !p.multiDay && p.buildMin>0) stages.push({label:'הכנה/בנייה',hours:p.buildMin/60,kind:'prep'});
  if(m.combo){ // engine combo entry (cuts)
    const hasSV=m.combo.includes('sv'), hasSmoke=m.combo.includes('smoke');
    if(hasSV && hasSmoke && order==='smoke-sv'){
      // v147 (P3): use the CITED reverse-order data (order_smokesv) when present — never a formula for
      // safety-relevant temps/times. Fall back to the conservative computed values only if data is missing.
      const os=(meta.obj&&meta.obj.order_smokesv)||{}, osm=os.smoke||{}, osv=os.sv||{};
      const coldT=(osm.t!=null)?osm.t:coldSmokeTemp(m.smTemp);
      const coldHrs=(osm.h!=null)?upperHours(osm.h):Math.max(2, Math.round((m.smHours||2)*0.6));
      const svT=(osv.t!=null)?osv.t:m.svTemp;
      const svH=(osv.h!=null)?upperHours(osv.h):m.svHours;
      const cited=(osm.t!=null && osv.t!=null);
      stages.push({label:`עישון קר ${coldT}°`,hours:coldHrs,kind:'smoke',temp:coldT,note:'על בשר גולמי — טבעת עשן מרבית'+(cited?' · מקור מצוטט':'')});
      stages.push({label:'איטום ומעבר לסו-ויד',hours:0,kind:'note'});
      stages.push({label:`סו-ויד ${svT}° (כולל פסטור)`,hours:svH,kind:'sv',safety:'pasteur'});
    } else {
      if(hasSV){
        stages.push({label:`סו-ויד ${m.svTemp}°`,hours:m.svHours,kind:'sv'});
        if(hasSmoke){
          const dryH=drySurfaceHours(m.svHours);
          const dryLbl=dryH<1?'ניגוב יבש (קצר)':'ייבוש במקרר (ללא כיסוי)';
          const dryNote=dryH<1?'נגב היטב מנוזלים — לא נדרש זמן ממושך למנה קלה זו':'קריטי לקבלת קראסט';
          stages.push({label:dryLbl,hours:dryH,kind:'dry',note:dryNote});
        }
      }
      if(hasSmoke) stages.push({label:`עישון ${m.smTemp}°`,hours:m.smHours,kind:'smoke',temp:m.smTemp,note:m.note});
    }
    if(m.combo.includes('grill')) stages.push({label:m.combo.length===1?'גריל / אש ישירה':'גימור גריל (צריבה)',hours:0.3,kind:'cook',note:m.combo.length===1?m.note:''});
  } else {
    if(m.svHours){ stages.push({label:`סו-ויד ${m.svTemp}°`,hours:m.svHours,kind:'sv'}); stages.push({label:'העברה למעשנת',hours:0,kind:'note'}); }
    if(m.smHours||m.hours){
      const hrs=m.smHours||m.hours;
      stages.push({label:`${m.label} ${m.tempC||''}`.trim(),hours:hrs,kind:m.key.includes('smoke')||m.key==='sv'||m.key==='so'||m.key==='hot'||m.key==='cold'?'smoke':'cook',temp:m.smTemp,note:m.note});
    } else if(!m.svHours){
      stages.push({label:m.label,hours:m.hours,kind:'cook',note:m.note});
    }
  }
  if(p.restMin>0) stages.push({label:'מנוחה',hours:p.restMin/60,kind:'rest'});
  return stages;
}
function comboHasSvSmoke(meta,methodKey){
  const p=itemProfile(meta); if(!p) return false;
  const m=p.methods.find(x=>x.key===methodKey)||p.methods[0];
  if(!(m.combo && m.combo.includes('sv') && m.combo.includes('smoke'))) return false;
  // v147 (P3): offer the reverse (smoke→sv) order ONLY when the item carries CITED, pasteurize-safe
  // reverse-order data (order_smokesv). No cited data → sv→smoke only; never a generic svHours>=1 guess.
  const os=meta.obj&&meta.obj.order_smokesv;
  return !!(os && os.smoke && os.sv && os.sv.pasteurize===true);
}

/* ---- per-recipe extras (notes/rating/kosher/actions) ---- */
const PROJ_CATS=['סלומי','נקניק מיובש','בשר מיובש','פסטרמה','דג מעושן'];
/* ── rich item description + origin/continent helpers (for pickers) ── */
const FLAG_CONT={'🇩🇪':'אירופה','🇦🇹':'אירופה','🇵🇱':'אירופה','🇭🇺':'אירופה','🇬🇧':'אירופה','🇫🇷':'אירופה','🇪🇸':'אירופה','🇮🇹':'אירופה','🇵🇹':'אירופה','🇨🇿':'אירופה','🇬🇷':'אירופה','🇧🇪':'אירופה','🇳🇱':'אירופה','🇨🇭':'אירופה','🇸🇪':'אירופה','🇷🇴':'אירופה','🇷🇸':'אירופה','🇭🇷':'אירופה','🇧🇬':'אירופה','🇺🇦':'אירופה','🇸🇮':'אירופה','🇨🇾':'אירופה','🇧🇦':'אירופה','🇩🇰':'אירופה','🇳🇴':'אירופה','🇦🇷':'דרום אמריקה','🇧🇷':'דרום אמריקה','🇨🇱':'דרום אמריקה','🇺🇾':'דרום אמריקה','🇲🇽':'אמריקה','🇺🇸':'אמריקה','🇨🇦':'אמריקה','🇱🇧':'מזרח תיכון','🇹🇷':'מזרח תיכון','🇮🇱':'מזרח תיכון','🇮🇷':'מזרח תיכון','🇮🇶':'מזרח תיכון','🇲🇦':'אפריקה','🇹🇳':'אפריקה','🇿🇦':'אפריקה','🇨🇳':'אסיה','🇹🇭':'אסיה','🇰🇷':'אסיה','🇯🇵':'אסיה','🇻🇳':'אסיה','🇵🇭':'אסיה','🇮🇳':'אסיה'};
function itemOrigin(meta){ if(!meta) return ''; let o=meta.origin||(meta.obj&&meta.obj.origin); if(!o&&meta.key&&typeof resolveItem==='function'){ const r=resolveItem(meta.key); o=r&&(r.origin||(r.obj&&r.obj.origin)); } return o||''; }
function originContinent(origin){ if(!origin) return ''; const f=(origin.match(/\p{Regional_Indicator}\p{Regional_Indicator}/u)||[])[0]; return f?(FLAG_CONT[f]||'אחר'):''; }
function itemContinent(meta){ return originContinent(itemOrigin(meta)); }
function itemRichDesc(meta){
  if(!meta) return '';
  let o=meta.obj||meta;
  if(!o.build&&!o.desc&&meta.key&&typeof resolveItem==='function'){ const r=resolveItem(meta.key); if(r) o=r.obj||r; }
  const bld=o.build||{};
  let d=bld.intro||o.desc||o.note||o.somid||'';
  d=String(d).replace(/\s+/g,' ').trim();
  if(d.length>150) d=d.slice(0,148).replace(/[,\s]+\S*$/,'')+'…';
  return d;
}
function itemPickLabel(meta){
  // "🇩🇪 גרמניה · נקניקיות" — origin + category context line
  const org=itemOrigin(meta); const cat=meta.cat||'';
  return [org, cat].filter(Boolean).join(' · ');
}
/* pure builder: from-scratch build phases → scheduled work-plan tasks (testable) */
/* scratch builds for ground-meat cuts that are made-from-scratch with a mandatory rest/age before cooking */
const CUT_SCRATCH={
  'cut-18':{phases:[
    ['1 · בשר ושומן','בחר בשר ביחס שומן 20-25% (צ׳אק/שריר קדמי + חזה). שמור הכל קר מאוד — 0-2°C.',600],
    ['2 · טחינה','טחן גס (8 מ״מ), פעם אחת. אל תדחוס — נתחים חופשיים לקציצה רכה.',300],
    ['3 · עיצוב רופף','עצב קציצות ביד קלה, שקע-אגודל באמצע. מלח רק על פני השטח וממש לפני הצלייה (מלח מוקדם = מרקם נקניק).',600],
    ['4 · קירור 30-60 דק׳','הנח במקרר על תבנית — מהדק את השומן ומחזיק צורה. חובה לקציצה עסיסית שלא מתפרקת.',2700],
    ['5 · צריבה','גריל/מחבת חמה מאוד. צד ראשון עד קרום, הפיכה אחת. מדחום ליעד — לא ללחוץ!',600]
  ]},
  'cut-17':{phases:[
    ['1 · בשר ושומן','טלה או בקר עם ~20% שומן (אליה/כבש קלאסי). שמור קר.',600],
    ['2 · טחינה ותיבול','טחן, הוסף בצל מגורר וסחוט היטב, פטרוזיליה, כמון, פלפל. אפשר סודה לשתייה (½ כפית/ק״ג) לרכות וקישור.',600],
    ['3 · לישה ארוכה','לוש 5-8 דק׳ עד עיסה דביקה ומחוברת (חילוץ מיוזין) — זה מה שמחזיק על השיפוד.',600],
    ['4 · קירור 1-2 שעות','חובה! העיסה חייבת להתייצב בקור לפני שיפוד. עם סודה — 24-48 שעות במקרר לתוצאה הטובה ביותר.',5400],
    ['5 · עיצוב על שיפוד','לחלח ידיים, מרח את העיסה על שיפוד שטוח-רחב בלחיצות אחידות.',600],
    ['6 · צלייה','גריל חזק, סיבוב מהיר עד חריכה מכל צד. עסיסי בפנים.',600]
  ]}
};
function itemScratchBuild(meta){
  if(!meta) return null;
  const o=meta.obj||meta;
  if(o.build&&(o.build.phases||[]).length) return o.build;
  if(meta.key&&CUT_SCRATCH[meta.key]) return CUT_SCRATCH[meta.key];
  if(meta.cat==='גבינה'){ const cb=cheeseBuild(meta); if(cb&&cb.phases.length) return cb; }
  return null;
}
function hasScratchBuild(meta){ return !!itemScratchBuild(meta); }
// split phases at the rest/aging boundary (or the last cook phase) → {ahead, finish}
const REST_RE=/מנוחה|קירור|יישון|לילה|שעות|24|48|התייצב|הבשלה/;
const FINISH_RE=/בישול|צלייה|עישון|הגשה|טיגון|גריל|בשל|צלה|סיום|חריכה|צריבה/;
function splitPhases(phases){
  const norm=phases.map(p=>Array.isArray(p)?{label:p[0],body:p[1],secs:p[2]||0}:{label:p.title||p.label||'',body:p.body||p.text||'',secs:p.sec||0});
  let cut=-1;
  for(let i=norm.length-1;i>=0;i--){ if(REST_RE.test(norm[i].label)){ cut=i; break; } }   // last rest phase → boundary
  if(cut<0){ cut=norm.length-2; }   // no rest → make-ahead is everything but the final cook step
  cut=Math.max(0,Math.min(cut,norm.length-1));
  return {ahead:norm.slice(0,cut+1), finish:norm.slice(cut+1), hasRest:REST_RE.test((norm[cut]||{}).label||'')};
}
function makeBuildTasks(build, startClock, name, detail, mode){
  const out=[]; const phases=(build&&build.phases)||[]; if(!phases.length) return out;
  const {ahead,finish}=splitPhases(phases);
  const seq = mode==='prepped' ? finish : (mode==='ahead' ? ahead : ahead.concat(finish));
  if(!seq.length) return out;
  const total=seq.reduce((a,s)=>a+(s.secs||0),0)*1000;
  let cursor=new Date(startClock.getTime()-total);
  seq.forEach((s,idx)=>{ out.push({t:new Date(cursor.getTime()),label:`🧫 ${name} — ${s.label}`,sub:idx===0?(mode==='prepped'?'סיום מה שהוכן מראש':'התחלת בנייה מאפס'):'',kind:'prep',det:detail?s.body:''}); cursor=new Date(cursor.getTime()+(s.secs||0)*1000); });
  return out;
}
function isProjectItem(meta){
  if(!meta)return false;
  if(meta.kind==='make'||(meta.key&&meta.key.startsWith('make-'))) return true;   // every make-recipe is built from scratch → project-eligible (fresh sausages included)
  if(PROJ_CATS.includes(meta.cat))return true;
  if(meta.cat==='גבינה'){ let o=meta.obj; if(!o&&meta.key&&typeof resolveItem==='function'){ const r=resolveItem(meta.key); o=r&&r.obj; } o=o||{}; return !!(o.smt||o.age||o.cure); }   // cold-smoked / aged cheeses are projects
  return /Bacon|Jerky|Biltong|Pastrami|Bresaola|Pancetta|Coppa|Guanciale|Lonzino|Speck|Lox|Gravlax|Sucuk|Lap Cheong|Salami|Salume|Pepperoni|Kabanos|Landj/i.test(meta.eng||'');
}
// synthesize from-scratch build phases for aged/smoked cheeses (they have no build.phases in data)
function cheeseBuild(meta){
  const o=(meta&&meta.obj)||{}; if(meta.cat!=='גבינה') return null;
  const ph=[];
  ph.push(['1 · הכנה','הבא את הגבינה לטמפ׳ החדר, יבש את פני השטח היטב (משטח לח = עשן לא נדבק). חתוך לגושים לפי הצורך.',1800]);
  if(o.cure) ph.push(['2 · המלחה/ריפוי',`${o.cure}. שכבת מלח/תמלחת מייבשת פני-שטח ומעצימה טעם.`,3600]);
  if(o.smt) ph.push([`${o.cure?3:2} · עישון קר`,`עישון קר ≤${o.smt}°C למשך ${o.smh||'2-4'} שעות על ${o.wood||'עץ פרי'} (מחולל עשן tube/maze). מעל הטמפ׳ הזו הגבינה נמסה — הימנע!`,(parseInt(o.smh)||3)*3600]);
  ph.push([`${(o.cure?1:0)+(o.smt?1:0)+2} · איטום ויישון`,`${o.age||'עטוף בנייר גבינות/ואקום וקרר'} — היישון מאזן את העשן החד לעומק אגוזי-מעושן נעים. סבלנות משתלמת.`, 0]);
  ph.push([`${(o.cure?1:0)+(o.smt?1:0)+3} · בשלות והגשה`,`הגבינה מוכנה כשהעשן התמזג (${o.age||'שבוע-שבועיים'}). פרוס והגש בטמפ׳ החדר.`,0]);
  return {phases:ph};
}
function fillExtras(key){
  const host=$("#extras"); if(!host) return;
  const meta=resolveItem(key); if(!meta) return;
  const hasOuterPicker=(()=>{ const e=document.getElementById('spk-'+key); return !!(e && !host.contains(e)); })();
  const ks=kosherStatus(key), sub=kosherSub(key);
  const note=store.get('note:'+key)||'', rate=store.get('rating:'+key)||0;
  const projBanner=curProject?(()=>{ const p=projById(curProject); return p?`<div class="proj-banner">🧫 בתוך פרויקט: <b>${p.name}</b> · סימוני השלבים נשמרים בפרויקט</div>`:''; })():'';
  host.innerHTML=`<div class="exbox">${projBanner}
     <button class="exaddmenu ${menuHasKey(key)?'on':''}" data-addmenu="${key}" data-full aria-pressed="${menuHasKey(key)}" aria-label="${menuHasKey(key)?'הסר מהתפריט':'הוסף לתפריט'}">${menuHasKey(key)?'✓ בתפריט':'＋ הוסף לתפריט'}</button>
     <div class="exrow">
       <button class="exfav ${isFav(key)?'on':''}" data-exfav>${isFav(key)?'★ במועדפים':'☆ הוסף למועדפים'}</button>
       <div class="exrate" data-rate>${[1,2,3,4,5].map(n=>`<span class="star ${n<=rate?'on':''}" data-n="${n}">★</span>`).join('')}</div>
     </div>
     ${(ks!=='kosher'&&!isProduce(meta.obj||{}))?`<div class="kbox k-${ks}"><b>${kosherLabel(ks)}</b>${sub?` · תחליף כשר: ${sub}`:''}</div>`:(isProduce(meta.obj||{})?'':`<div class="kbox k-ok">✓ ניתן להכנה כשרה</div>`)}
     <div class="exactions">
       ${isProjectItem(meta)?`<button data-startproj>▶ התחל פרויקט</button>`:''}
       ${key==='cut-18'?`<button data-burger>🍔 בנה את הבורגר</button>`:''}
       <button data-recipecart>🛒 קניות למתכון זה</button>
       <button data-logcook>📓 תעד בישול</button>
       ${(meta.kind==='cut'&&!isProduce(meta.obj||{}))?`<button data-butcher>🥩 פתק לקצב</button>`:''}
       ${meta.obj&&meta.obj.wood&&meta.obj.wood!=='ללא'?`<button data-exwoods>🪵 עצים</button>`:''}
       <button data-resetprog>↺ אפס התקדמות</button>
     </div>
     <div class="exnotes"><label>הערות אישיות (נשמר אוטומטית)</label><textarea data-note placeholder="טמפ׳ שעבדה, התאמות, מה לשפר…">${note}</textarea></div>
     <div data-extraform></div>
   </div>
   ${(!hasOuterPicker&&typeof seasPickerHTML==='function')?seasPickerHTML(key, meta.cat||(meta.obj&&meta.obj.cat), (typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(meta.obj||{}), 'edit'):''}`;
  if(!hasOuterPicker){ const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(meta.obj||{});
    const backFn=meta.kind==='spec'?()=>openSpec(meta.obj):meta.kind==='make'?()=>openMake(key.slice(5)):(meta.kind==='cut'?()=>openCut(meta.obj):null);
    if(typeof wireSeasPicker==='function') wireSeasPicker(host, key, meta.cat||(meta.obj&&meta.obj.cat), isProd, 'edit', null, backFn); }
  host.querySelector('[data-exfav]').addEventListener('click',()=>{toggleFav(key);fillExtras(key);});
  host.querySelectorAll('[data-rate] .star').forEach(s=>s.addEventListener('click',()=>{
    const n=+s.dataset.n, cur=store.get('rating:'+key)||0; store.set('rating:'+key,cur===n?0:n); fillExtras(key); render();
  }));
  const ta=host.querySelector('[data-note]'); let tmo;
  ta.addEventListener('input',()=>{clearTimeout(tmo);tmo=setTimeout(()=>store.set('note:'+key,ta.value),350);});
  const ff=host.querySelector('[data-extraform]');
  const sp=host.querySelector('[data-startproj]'); if(sp) sp.addEventListener('click',()=>{ if(typeof openProjectWizard==='function') openProjectWizard(meta); else startProjectForm(meta,ff); });
  const bg=host.querySelector('[data-burger]'); if(bg) bg.addEventListener('click',openBurgerBuilder);
  const rc=host.querySelector('[data-recipecart]'); if(rc) rc.addEventListener('click',()=>{
    if(typeof openRecipeShop==='function') openRecipeShop(meta);
  });
  const rp=host.querySelector('[data-resetprog]'); if(rp) rp.addEventListener('click',async()=>{
    if((await appConfirm('לאפס את כל סימוני ההתקדמות למתכון זה?',{okLabel:'↺ אפס',danger:true}))!==true) return;
    if(curProject){ const a=pantry(), p=a.find(x=>x.id===curProject); if(p){ p.doneSteps=[]; savePantry(a); } }
    else resetRecipeProgress(key);
    if(typeof openMake==='function'&&meta.kind==='make'){ pendingProject=curProject; openMake(key.replace(/^make-/,'')); } else if(typeof openSpec==='function'&&meta.kind==='spec'){ pendingProject=curProject; openSpec(meta.obj); } else if(typeof openCut==='function'&&meta.kind==='cut'){ pendingProject=curProject; openCut(meta.obj); }
    if(typeof toast==='function') toast('ההתקדמות אופסה ↺');
  });
  host.querySelector('[data-logcook]').addEventListener('click',()=>logCookForm(meta,ff));
  const bt=host.querySelector('[data-butcher]'); if(bt) bt.addEventListener('click',()=>butcherForm(meta,ff));
  const wd=host.querySelector('[data-exwoods]'); if(wd) wd.addEventListener('click',()=>openWoods(meta.cat));
}

/* ---- pantry (curing/drying tracker) ---- */
function pantry(){return store.get('mk-pantry')||[];}
function savePantry(a){store.set('mk-pantry',a);}
/* ── pantry as component store: source (scratch/bought) + stage (building/ready/done) ── */
function projProgressReady(p){
  if(p.source==='bought') return true;
  if(p.type==='scratch'){ const ph=projPhases(p); return ph.length? (p.doneSteps||[]).length>=ph.length : true; }
  if(p.type==='dry'){ return p.curW<=Math.round(p.startW*p.factor); }
  if(p.type==='cure'){ return daysBetween(p.start,today())>=p.days; }
  return true;
}
function projStage(p){
  if(p.stage==='done') return 'done';
  if(p.source==='bought') return p.stage||'ready';
  return projProgressReady(p)?'ready':'building';
}
const STAGE_LABEL={building:'⏳ בתהליך',ready:'📦 מוכן לסיום',done:'✅ מוכן להגשה'};
// bridge a ready pantry item into the active plan (event/cook) at the right timeline stage
function pantryToPlan(pid){
  const p=pantry().find(x=>x.id===pid); if(!p||!p.key) return;
  const stg=projStage(p);
  const m=(typeof menuState==='function')?menuState():{keys:[]}; m.keys=m.keys||[];
  if(!m.keys.includes(p.key)){ m.keys.push(p.key); if(typeof saveMenu==='function') saveMenu(m); }
  // set the timeline stage for this item: done→'ready' (serve only), ready→'prepped' (finish only)
  try{ const all=tlState(); all[p.key]=all[p.key]||{method:null}; const tls=(stg==='done')?'ready':'prepped'; all[p.key].stage=tls; all[p.key].ready=(tls==='ready'); tlSetState(all); }catch(e){}
  if(typeof updateCartBadge==='function') updateCartBadge();
  const ctxName=(typeof menuCtx==='function'&&menuCtx()==='event')?'האירוע':'הבישול';
  if(typeof toast==='function') toast(`${p.name} נוסף ל${ctxName} · ${stg==='done'?'מוכן להגשה':'רק סיום'}`);
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('wizard');
  if(typeof cwGo==='function') cwGo(3);
}
// attach a finishing step (e.g. cold-smoke) to a bought item → becomes an active tracked project
function pantryAddFinish(pid){
  const a=pantry(); const p=a.find(x=>x.id===pid); if(!p) return;
  const meta=p.key?resolveItem(p.key):null;
  const o=(meta&&meta.obj)||{};
  // cheese → cold-smoke + aging; else generic cure window
  if(p.key && meta && meta.cat==='גבינה'){
    p.type='cure'; p.source='bought-finish'; p.stage='building'; p.start=today();
    const days=parseInt((o.age||'').match(/\d+/)?.[0]||'')||7; p.days=days;
    p.finish='עישון קר'+(o.smt?` ≤${o.smt}°C`:'')+(o.smh?` · ${o.smh}ש`:'')+(o.age?` · יישון ${o.age}`:'');
  } else {
    p.type='cure'; p.source='bought-finish'; p.stage='building'; p.start=today(); p.days=p.days||2;
    p.finish='סיום/יישון לפני הגשה';
  }
  savePantry(a);
  if(typeof projSeedReminders==='function'){ try{ projSeedReminders(p); }catch(e){} }
  if(typeof toast==='function') toast('נוסף שלב סיום — הפריט עבר למעקב פעיל 🧫');
  if(typeof cPaintProjects==='function') cPaintProjects();
}
function startProjectForm(meta,host){
  const dryMode=/Bacon|Pastrami|Brine|כבישה/i.test(meta.eng||'')&&!/Dry|Bresaola|Salame|Salami|Speck|Lonzino|Coppa/i.test(meta.eng||'')?'cure':'dry';
  host.innerHTML=`<div class="miniform">
    <h4>התחלת פרויקט — ${meta.heb}</h4>
    <label>שם<input data-pn value="${meta.heb}"></label>
    <label>סוג
      <select data-pmode>
        <option value="dry" ${dryMode==='dry'?'selected':''}>ייבוש למשקל יעד</option>
        <option value="cure" ${dryMode==='cure'?'selected':''}>כבישה לפי ימים</option>
      </select></label>
    <label>תאריך התחלה<input type="date" data-pstart value="${today()}"></label>
    <div data-dryf><label>משקל התחלה (גרם)<input type="number" data-pw value="1000"></label>
      <label>אחוז ירידת יעד<select data-pf><option value="0.65">35% (×0.65)</option><option value="0.62" selected>38% (×0.62)</option><option value="0.6">40% (×0.60)</option></select></label></div>
    <div data-curef style="display:none"><label>משך כבישה (ימים)<input type="number" data-pd value="7"></label></div>
    <div class="mf-actions"><button data-psave>שמור פרויקט</button><button data-pcancel class="ghost">ביטול</button></div>
  </div>`;
  const mode=host.querySelector('[data-pmode]'), dryf=host.querySelector('[data-dryf]'), curef=host.querySelector('[data-curef]');
  mode.addEventListener('change',()=>{const c=mode.value==='cure';dryf.style.display=c?'none':'';curef.style.display=c?'':'none';});
  if(dryMode==='cure'){dryf.style.display='none';curef.style.display='';}
  host.querySelector('[data-pcancel]').addEventListener('click',()=>host.innerHTML='');
  host.querySelector('[data-psave]').addEventListener('click',()=>{
    const m=mode.value, p={id:uid(),key:meta.key,name:host.querySelector('[data-pn]').value||meta.heb,
      type:m,start:host.querySelector('[data-pstart]').value||today()};
    if(m==='dry'){p.startW=+host.querySelector('[data-pw]').value||1000;p.factor=+host.querySelector('[data-pf]').value||0.62;p.curW=p.startW;}
    else {p.days=+host.querySelector('[data-pd]').value||7;}
    const a=pantry();a.push(p);savePantry(a);
    if(typeof cPaintProjects==='function') cPaintProjects();
    host.innerHTML=`<div class="okmsg">✓ הפרויקט נוסף למעקב. <button class="linklike" data-openpantry>פתח את הפרויקטים</button></div>`;
    host.querySelector('[data-openpantry]').addEventListener('click',()=>{ if(typeof closePanel==='function') closePanel(); if(typeof cNavGo==='function'){ cNavGo('projects'); } else if(typeof openPantry==='function'){ openPantry(); } });
  });
}
function openPantry(){
  // unified: the pantry/projects live on the projects screen — redirect there
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function'){ cNavGo('projects'); return; }
  const a=pantry();
  const rows=a.map(p=>{
    if(p.type==='dry'){
      const target=Math.round(p.startW*p.factor), lossNow=p.startW?Math.round((1-p.curW/p.startW)*100):0;
      const targetLoss=Math.round((1-p.factor)*100), ready=p.curW<=target;
      const pct=Math.min(100,Math.round(lossNow/targetLoss*100));
      return `<div class="pcard" data-id="${p.id}">
        <div class="pc-top"><b>${p.name}</b><span class="pc-day">יום ${daysBetween(p.start,today())}</span><button class="pc-rm" data-prm="${p.id}">×</button></div>
        <div class="pc-meta">ייבוש למשקל · התחלה ${p.startW} ג׳ · יעד ${target} ג׳ (${targetLoss}%)</div>
        <div class="pbar"><i style="width:${pct}%;background:${ready?'var(--good)':'var(--ember)'}"></i></div>
        <div class="pc-row"><label>משקל נוכחי</label><input type="number" data-pcw="${p.id}" value="${p.curW}"> ג׳ · ירידה ${lossNow}% ${ready?'<b style="color:var(--good)">· מוכן! ✓</b>':`· נותרו ~${Math.max(0,targetLoss-lossNow)}%`}</div>
      </div>`;
    } else {
      const elapsed=daysBetween(p.start,today()), ready=elapsed>=p.days;
      const pct=Math.min(100,Math.round(elapsed/p.days*100));
      return `<div class="pcard" data-id="${p.id}">
        <div class="pc-top"><b>${p.name}</b><span class="pc-day">יום ${elapsed}/${p.days}</span><button class="pc-rm" data-prm="${p.id}">×</button></div>
        <div class="pc-meta">כבישה · סיום ${fmtDate(addDays(p.start,p.days))} ${ready?'<b style="color:var(--good)">· הסתיים ✓</b>':''}</div>
        <div class="pbar"><i style="width:${pct}%;background:${ready?'var(--good)':'var(--ember)'}"></i></div>
      </div>`;
    }
  }).join("");
  showPanel(`${toolTop('המזווה שלי','מעקב ריפוי וייבוש','🧫','#9e4a3d')}
   <div class="panel-body">${a.length?rows:'<div class="shop-empty">אין פרויקטים פעילים.<br>פתח מתכון ריפוי/ייבוש ולחץ "▶ התחל פרויקט".</div>'}
   ${a.length?'<button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ הדפס</button>':''}</div>`);
  $("#panel").querySelectorAll('[data-pcw]').forEach(inp=>inp.addEventListener('input',()=>{
    const a2=pantry(), p=a2.find(x=>x.id===inp.dataset.pcw); if(p){p.curW=+inp.value||p.curW;savePantry(a2);openPantry();}
  }));
  $("#panel").querySelectorAll('[data-prm]').forEach(b=>b.addEventListener('click',()=>{
    const arr=pantry(), idx=arr.findIndex(x=>x.id===b.dataset.prm), removed=arr[idx];
    savePantry(arr.filter(x=>x.id!==b.dataset.prm));openPantry();
    toast('הפרויקט נמחק', ()=>{ const a=pantry(); a.splice(Math.min(idx,a.length),0,removed); savePantry(a); openPantry(); });
  }));
}

/* ---- reminders (derived from pantry + manual) ---- */
function reminders(){return store.get('mk-reminders')||[];}
function openReminders(){
  const man=reminders();
  const derived=pantry().map(p=>{
    if(p.type==='cure') return {text:`סיום כבישה: ${p.name}`,date:addDays(p.start,p.days),auto:true};
    return {text:`שקילת ביניים: ${p.name}`,date:addDays(p.start,7*(Math.floor(daysBetween(p.start,today())/7)+1)),auto:true};
  });
  const all=[...derived,...man].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const rows=all.map((r,i)=>`<div class="shop-line"><span>${fmtDate(r.date)} ${new Date(r.date)<new Date(today())?'<b style="color:var(--ember)">⏰</b>':''}</span><span style="flex:1">${r.text}</span>${r.auto?'<span class="ktag kd" style="position:static">אוטומטי</span>':`<button class="rm" data-rrm="${r.id}">×</button>`}</div>`).join("");
  showPanel(`${toolTop('תזכורות','אבני-דרך לתהליכים רב-יומיים','⏰','#b5603a')}
   <div class="panel-body">
     <div class="miniform"><h4>תזכורת חדשה</h4>
       <label>טקסט<input data-rtext placeholder="להפוך בייקון, לבדוק pH…"></label>
       <label>תאריך<input type="date" data-rdate value="${today()}"></label>
       <div class="mf-actions"><button data-radd>הוסף</button></div></div>
     <div style="margin-top:14px">${all.length?rows:'<div class="shop-empty">אין תזכורות. פרויקטים במזווה יוצרים תזכורות אוטומטית.</div>'}</div>
   </div>`);
  $("#panel").querySelector('[data-radd]').addEventListener('click',()=>{
    const t=$("#panel").querySelector('[data-rtext]').value.trim(), d=$("#panel").querySelector('[data-rdate]').value;
    if(!t)return; const m=reminders(); m.push({id:uid(),text:t,date:d||today()}); store.set('mk-reminders',m); openReminders();
  });
  $("#panel").querySelectorAll('[data-rrm]').forEach(b=>b.addEventListener('click',()=>{
    const arr=reminders(), idx=arr.findIndex(x=>x.id===b.dataset.rrm), removed=arr[idx];
    store.set('mk-reminders',arr.filter(x=>x.id!==b.dataset.rrm));openReminders();
    toast('התזכורת נמחקה', ()=>{ const a=reminders(); a.splice(Math.min(idx,a.length),0,removed); store.set('mk-reminders',a); openReminders(); });
  }));
}

/* ---- cook journal ---- */
function journal(){return store.get('mk-journal')||[];}
function logCookForm(meta,host){
  host.innerHTML=`<div class="miniform">
    <h4>תיעוד בישול — ${meta.heb}</h4>
    <label>תאריך<input type="date" data-jd value="${today()}"></label>
    <label>טמפ׳/הערה<input data-jt placeholder="יעד 94°, יצא מצוין"></label>
    <label>דירוג
      <select data-jr><option value="0">—</option><option>1</option><option>2</option><option>3</option><option value="4" selected>4</option><option>5</option></select></label>
    <label>תמונה (אופציונלי)<input type="file" accept="image/*" data-jp></label>
    <div class="mf-actions"><button data-jsave>שמור ליומן</button><button data-jcancel class="ghost">ביטול</button></div>
  </div>`;
  host.querySelector('[data-jcancel]').addEventListener('click',()=>host.innerHTML='');
  host.querySelector('[data-jsave]').addEventListener('click',async ()=>{
    const e={id:uid(),key:meta.key,name:meta.heb,date:host.querySelector('[data-jd]').value||today(),
      temp:host.querySelector('[data-jt]').value,rating:+host.querySelector('[data-jr]').value||0};
    const f=host.querySelector('[data-jp]').files[0];
    if(f){try{e.photo=await downscale(f);}catch(err){}}
    const a=journal();a.unshift(e);try{store.set('mk-journal',a);}catch(err){if(typeof toast==='function')toast('⚠ אין מקום אחסון לתמונה — נשמר בלי תמונה');delete e.photo;store.set('mk-journal',a);}
    host.innerHTML=`<div class="okmsg">✓ נוסף ליומן הבישולים. <button class="linklike" data-openj>פתח</button></div>`;
    host.querySelector('[data-openj]').addEventListener('click',openJournal);
  });
}
function downscale(file){return new Promise((res,rej)=>{
  const r=new FileReader();r.onerror=rej;
  r.onload=()=>{const img=new Image();img.onerror=rej;img.onload=()=>{
    const max=360,sc=Math.min(1,max/Math.max(img.width,img.height));
    const cv=document.createElement('canvas');cv.width=img.width*sc;cv.height=img.height*sc;
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);res(cv.toDataURL('image/jpeg',0.6));
  };img.src=r.result;};r.readAsDataURL(file);
});}
function openJournal(){
  const a=journal();
  const rows=a.map(e=>`<div class="jcard">
    ${e.photo?`<img src="${e.photo}" alt="">`:''}
    <div class="jc-main"><div class="jc-top"><b>${e.name}</b><span>${fmtDate(e.date)}</span></div>
    ${e.temp?`<div class="jc-temp">${e.temp}</div>`:''}${e.rating?`<div class="rmini">${'★'.repeat(e.rating)}</div>`:''}</div>
    <button class="pc-rm" data-jrm="${e.id}">×</button></div>`).join("");
  showPanel(`${toolTop('יומן בישולים','היסטוריה אישית','📓','#c0563a')}
   <div class="panel-body">${(typeof aiAvail==='function'&&aiAvail()&&a.length>=3)?`<button class="ccta" id="jInsights" style="margin:0 0 14px;background:var(--fresh);border-color:var(--fresh)">✨ תובנות AI מהיומן</button>`:''}${a.length?rows:'<div class="shop-empty">אין רישומים עדיין.<br>פתח מתכון ולחץ "📓 תעד בישול".</div>'}</div>`);
  const ib=$("#jInsights"); if(ib) ib.addEventListener('click',openJournalInsights);
  $("#panel").querySelectorAll('[data-jrm]').forEach(b=>b.addEventListener('click',()=>{
    const arr=journal(), idx=arr.findIndex(x=>x.id===b.dataset.jrm), removed=arr[idx];
    store.set('mk-journal',arr.filter(x=>x.id!==b.dataset.jrm));openJournal();
    toast('הרישום נמחק', ()=>{ const a=journal(); a.splice(Math.min(idx,a.length),0,removed); try{store.set('mk-journal',a);}catch(e){} openJournal(); });
  }));
}

/* ---- butcher note (IL cut translator) ---- */
const ILCUT=[
 // ── בקר: שיטת המספור הישראלית (1–19) ──
 ["אנטריקוט","Ribeye","אנטריקוט / ורד הצלע / עין (נתח 1)","המלך לסטייק. בקש שיוש (marbling) טוב, עובי 2.5–3 ס״מ. צלעות 6–12"],
 ["אונטריב","Chuck / Under-rib","אונטריב / עורף (נתח 2)","בין האנטריקוט לצוואר. סיבי ושומני — מצוין לבישול ארוך, לחמין ולטחינה"],
 ["בריסקט / חזה","Brisket","חזה / ברוסט / בריסקט (נתח 3)","בקש 'פוינט' לעסיסי או 'פלאט' לפרוסות. מלך העישון — low & slow"],
 ["כתף מרכזי","Shoulder Clod","כתף מרכזי / שולטר (נתח 4)","נתח עבודה גדול. לצלי בסיר, לרגו, לטחינה"],
 ["צלי כתף","Chuck Roast","צלי כתף / פלטה / פולקה (נתח 5)","דמוי כיכר. לצלייה איטית ברוטב/תנור — מתרכך יפה"],
 ["פילה מדומה","Chuck Tender","פילה מדומה / פלאש פילה (נתח 6)","ארוך ורזה יחסית. לרולדה ממולאת, לצלי, לתבשיל"],
 ["מכסה אנטריקוט","Rib Cap / Spinalis","מכסה האנטריקוט / מרוצ'ה (נתח 7)","החלק הכי טעים בצלע. לגריל מהיר, או לטחינה לבורגר יוקרתי"],
 ["שריר קדמי","Foreshank / Shin","שריר קדמי / מוזה / מזעל (נתח 8)","עתיר קולגן וג'לטין. לאוסובוקו, לצירים, לחמין"],
 ["אסאדו / שפונדרה","Short Ribs","אסאדו (עם עצם) / שפונדרה (נתח 9)","עבה לעישון, דק לאסאדו על האש. שומני עם טעם עמוק"],
 ["צוואר","Neck / Chuck","צוואר / אלזה (נתח 10)","טעם עמוק, הרבה קולגן. לחמין, לפולד-בקר, לנקניק טחון"],
 ["סינטה","Striploin / Sirloin","סינטה / מותן / פור פילה (נתח 11)","שכבת שומן חיצונית אחת. לסטייק, רוסטביף, קרפצ'יו. חתך 3 ס״מ"],
 ["פילה בקר","Tenderloin","פילה / פילה מיניון / שאטובריאן (נתח 12)","הרך ביותר, דל שומן. צלייה קצרה בלבד — אל תעברו medium. לרוב לא כשר"],
 ["שייטל","Rump / Top Sirloin","שייטל / כנף העוקץ (נתח 13)","טעם בקרי חזק. ליישון, לשיפודים, לסטייק על מחבת. חלק אחורי"],
 ["אווזית / אגוז","Eye of Round","אווזית / אגוז (נתח 14)","עגול ורזה. לרוסטביף פרוס דק, לבישול ארוך, לפסטרמה"],
 ["שפיץ צ'אך / פיקניה","Picanha / Rump Cap","שפיץ צ'אך / פיקניה (נתח 15)","שכבת שומן עבה — השאירו אותה! חרצו שתי-וערב. לגריל, מעשנה או סו-ויד"],
 ["ירכה / צ'ך","Thick Flank / Knuckle","ירכה / צ'ך / כף (נתח 16)","רזה ואחיד. לשניצל, אסקלופ, בישול מהיר בפריסה דקה"],
 ["שריר אחורי / אוסובוקו","Hind Shank / Osso Buco","שריר אחורי / אוסובוקו (נתח 17–18)","פרוסות עם עצם מח. לאוסובוקו קלאסי, בישול ארוך ואיטי"],
 // ── נתחי קצב / סרעפת ומודרניים ──
 ["נתח קצבים","Hanger / Onglet","נתח קצבים / אונגלט / 'אדום'","מהסרעפת, אחד לפרה. טעם עז, MR חובה. הסירו את הגיד המרכזי, חתכו נגד הסיבים. אוהב מרינדה"],
 ["סקירט","Skirt","סקירט / שולכן / רוטפלייש","ארוך ודק מהסרעפת. סופג מרינדה מצוין (סויה/שום/צ'ילי). צלייה חזקה ומהירה, MR"],
 ["פלאנק","Flank","פלאנק / בטן","שטוח מהבטן. למרינדה, גריל חזק, פריסה דקה נגד הסיבים. לפחיטס"],
 ["ואסיו","Vacío / Bavette","ואסיו / בָּוֶט","נתח האסאדו הארגנטינאי מהבטן. שכבת שומן-עור עליונה שמתקרמלת. גריל איטי"],
 ["דנוור","Denver","דנוור / שכם","מהשכם — רך כמעט כאנטריקוט, טעם עז יותר, מחיר נמוך. גריל מהיר, MR, הפיכה אחת"],
 ["פלאט איירון","Flat Iron","פלאט איירון / מכסה הכתף","נתח כתף רך מאוד. הסירו את הגיד המרכזי. לגריל/מחבת, MR–M"],
 ["טרי-טיפ","Tri-Tip","טרי-טיפ / שפיץ סינטה","משולש מהסינטה התחתונה. לגריל/עישון, חתכו נגד הסיבים (משתנה כיוון)"],
 ["טומהוק","Tomahawk","טומהוק / אנטריקוט עם עצם ארוכה","אנטריקוט חגיגי עם עצם צלע שלמה. reverse-sear מומלץ, מנוחה ארוכה"],
 ["לחי בקר","Beef Cheek","לחי בקר","עמוס קולגן, נמס אחרי 3–4 שעות. לבישול איטי, לראגו"],
 ["לשון בקר","Beef Tongue","לשון בקר","לבישול ארוך ואז קילוף. מעושנת או כבושה — מעדן"],
 ["זנב שור","Oxtail","זנב שור / אוקסטייל","עשיר בג'לטין. למרקים, לתבשיל אוסו-באקו-סטייל"],
 ["עצמות מח","Marrow Bones","עצמות מח עצם","חתך אורכי/רוחבי. לצלייה בתנור, למרוח על לחם, לציר"],
 // ── חזיר / עוף / טלה / דג ──
 ["כתף חזיר","Pork Shoulder","כתף חזיר (Boston Butt)","לפולד-פורק; בקש עם שומן. עישון 8+ שעות"],
 ["בטן חזיר","Pork Belly","בטן חזיר","לבייקון/פנצ'טה — בקש עם/בלי עור"],
 ["צלעות חזיר","Pork Ribs","ספר-ריבס / בייבי-בק","בקש להסיר את ה-membrane מהצד הפנימי"],
 ["חזה עוף","Chicken Breast","חזה עוף","עם/בלי עצם לפי המתכון. זהירות מייבוש — בריין מומלץ"],
 ["פרגיות / שוקיים","Chicken Thigh","פרגיות / שוקיים","שומני ועסיסי — סלחני לעישון ולגריל"],
 ["כתף טלה","Lamb Shoulder","כתף טלה","לעישון איטי או לקבב טחון. עשיר בטעם"],
 ["צלע טלה","Lamb Rack","צלעות טלה / קרֶה","בקש חיתוך 'צרפתי' מנוקה. גריל מהיר, MR"],
 ["סלמון","Salmon","פילה סלמון","לגרבלקס/לקס — בקש סושי-גרייד או קפוא-הוקפא כהלכה"],
 // ── דגים ──
 ["פורל","Trout","פורל / טרוטה","דג מים-מתוקים עדין. שלם או פילה, מצוין לעישון קר/חם"],
 ["טונה","Tuna","סטייק טונה אדומה","בקש 'סושי-גרייד' לסירינג. חתוך עבה, MR בלבד — לא לייבש"],
 ["הליבוט","Halibut","הליבוט / פוטית","דג לבן מוצק ורזה. יעד עדין, קל לייבש-יתר"],
 // ── פירות ים ──
 ["שרימפס","Shrimp / Prawns","שרימפס / חסילונים / גמברי","לפי גודל (U-10 ענק ← 41/50 קטן). בקש עם/בלי קליפה, deveined"],
 ["סקלופס","Scallops","צדפות סקלופ / מסרקן","'Dry-pack' עדיף (בלי זרחות) — נצרב מושלם. U-10 לגריל"],
 ["לובסטר","Lobster","לובסטר / זנב לובסטר","זנב לגריל, שלם להרתחה/אידוי. קנה חי או קפוא-בים"],
 ["קלמארי","Squid / Calamari","קלמארי / דיונון","נקה את הצינור והזרועות. גריל חם-קצר או נזיד ארוך — לא באמצע"],
 ["תמנון","Octopus","תמנון / אוקטופוס","בשל-מראש עד ריכוך (נזיד/סו-ויד) ואז חריכה מהירה על האש"],
 ["סרטן","Crab","סרטן / רגלי סרטן","רגלי מלך לאידוי/גריל. קנה מבושל-קפוא או חי"],
 ["מולים","Mussels","מולים / מידיות","קנה חיים וסגורים; זרוק פתוחים שלא נסגרים בהקשה. אידוי מהיר ביין"],
 // ── גבינות לעישון ──
 ["גאודה","Gouda","גאודה","גבינת עישון קר קלאסית — מקשה למחצה, נמסה יפה. עשן ≤25°C"],
 ["צ'דר","Cheddar","צ'דר / צ׳דר מיושן","מצוין לעישון קר; ככל שמיושן יותר — טעם חד יותר"],
 ["חלומי","Halloumi","חלומי / גבינה למנגל","עמידה-חום — נצלית ישירות על הגריל בלי להימס"],
 ["מוצרלה","Mozzarella","מוצרלה / סקמורצה","סקמורצה (מיובשת) לעישון; מוצרלה טרייה לגריל קצר"]
];
function butcherForm(meta,host){
  const heb=meta.heb;
  const il=ILCUT.find(r=>heb.includes(r[0].split(' ')[0])||(meta.eng||'').toLowerCase().includes((r[1]||'').toLowerCase()));
  host.innerHTML=`<div class="miniform">
    <h4>פתק לקצב</h4>
    ${il?`<div class="kbox k-ok">שם ישראלי: <b>${il[2]}</b> · ${il[3]}</div>`:''}
    <label>כמות (ק״ג)<input type="number" step="0.5" data-bkg value="${meta.obj&&meta.obj.kg?meta.obj.kg:2}"></label>
    <label>הערת חיתוך<input data-bnote value="${il?il[3]:''}"></label>
    <div class="butchernote" data-bout></div>
    <div class="mf-actions"><button class="prbtn" style="position:static" data-print>⎙ הדפס פתק</button><button data-bcancel class="ghost">סגור</button></div>
  </div>`;
  function paint(){
    const kg=host.querySelector('[data-bkg]').value, n=host.querySelector('[data-bnote]').value;
    host.querySelector('[data-bout]').innerHTML=`שלום, אבקש: <b>${il?il[2]:heb}</b> — כמות ${kg} ק״ג.${n?' '+n+'.':''} תודה!`;
  }
  host.querySelector('[data-bkg]').addEventListener('input',paint);
  host.querySelector('[data-bnote]').addEventListener('input',paint);
  host.querySelector('[data-bcancel]').addEventListener('click',()=>host.innerHTML='');
  host.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
  paint();
}
function openCutTrans(){
  const rows=ILCUT.map(r=>`<div class="ctrow"><div><b>${r[0]}</b> <span class="ct-en">${r[1]}</span></div><div class="ct-il">${r[2]}</div><div class="ct-note">${r[3]}</div></div>`).join("");
  showPanel(`${toolTop('מתרגם נתחים','בשר, דגים, פירות ים וגבינות — שמות גלובליים ↔ ישראליים','🥩','#c0392b')}
   <div class="panel-body"><div class="ctlist">${rows}</div>
   <p class="section-sub" style="margin-top:14px">טיפ: בכל כרטיס נתח יש כפתור "🥩 פתק לקצב" שמייצר פתק מודפס עם הכמות.</p></div>`);
}

/* ---- wood pairing ---- */
const WOOD_INT={"תפוח":"עדין","דובדבן":"עדין","אגוז":"בינוני","אלון":"בינוני","היקורי":"חזק","מסקיט":"חזק מאוד","פקאן":"בינוני","בכר":"עדין","ערבה":"בינוני"};
// ── charcoal guide (types + Israeli suppliers) ──
const CHARCOAL=[
 {heb:"פחם הדרים",eng:"Citrus",flag:"🇪🇬🇮🇱",heat:"גבוה, מהיר",burn:"בינונית",smoke:"ארומה הדרית קלה",best:"מנגל יומיומי, בשר על האש",buy:"חזן גחלים · בית הפחם · סופרים (נפוץ מאוד)"},
 {heb:"קברצ׳ו לבן (Blanco)",eng:"Quebracho Blanco",flag:"🇦🇷",heat:"גבוה יציב",burn:"ארוכה",smoke:"מעט",best:"צלייה מבוקרת, כל-מטרה",buy:"חזן גחלים (10ק״ג) · פחם · בית הפחם"},
 {heb:"קברצ׳ו אדום (Colorado)",eng:"Quebracho Colorado",flag:"🇦🇷",heat:"גבוה מאוד",burn:"ארוכה מאוד",smoke:"מעט",best:"עישון ארוך, סשן ממושך",buy:"פחם · בית הפחם"},
 {heb:"מרבו",eng:"Marabu",flag:"🇨🇺",heat:"גבוה",burn:"ארוכה מאוד (~19ש)",smoke:"עדין נעים",best:"Low&Slow + צריבה",buy:"פחם · בית הפחם (פרימיום)"},
 {heb:"גואייקן",eng:"Guayacan",flag:"🇵🇾",heat:"הכי גבוה",burn:"הכי ארוכה",smoke:"מינימלי",best:"נתחי יוקרה, שפים",buy:"פחם (לפי הזמנה, פרימיום)"},
 {heb:"בינשוטן",eng:"Binchotan",flag:"🇯🇵",heat:"גבוה אחיד",burn:"ארוכה מאוד",smoke:"כמעט ללא",best:"יקיטורי, דגים, צריבה עדינה",buy:"פחם · קומפס גריל (יוקרתי)"},
 {heb:"פחם קוקוס",eng:"Coconut",flag:"🇮🇩🇻🇳",heat:"גבוה יציב",burn:"ארוכה מאוד",smoke:"ניטרלי",best:"דגים, ירקות, קמאדו",buy:"קוקו גריל · חזן גחלים · פחם"},
 {heb:"אלון (לאמפ)",eng:"Oak Lump",flag:"🇺🇸🇮🇱",heat:"גבוה",burn:"ארוכה",smoke:"ארומה קלאסית",best:"בקר, שימוש כללי",buy:"BBQ'NMORE (B&B) · בית הפחם"},
 {heb:"היקורי (לאמפ)",eng:"Hickory Lump",flag:"🇺🇸",heat:"גבוה",burn:"בינונית-ארוכה",smoke:"חזק ומתקתק",best:"חזה, צלעות, חזיר",buy:"BBQ'NMORE (bbq.co.il) · פחם"},
 {heb:"מסקיט",eng:"Mesquite",flag:"🇺🇸🇲🇽",heat:"גבוה מאוד",burn:"מהירה",smoke:"עז ואדמתי",best:"סטייקים, צריבה טקסני",buy:"BBQ'NMORE · פחם"},
 {heb:"בריקטים",eng:"Briquettes",flag:"",heat:"בינוני אחיד",burn:"ארוכה יציבה",smoke:"ניטרלי (לעיתים תוסף)",best:"Low&Slow, מעשנה",buy:"Weber/כל החנויות · סופרים"},
 {heb:"בריקטי קוקוס",eng:"Coconut Briquettes",flag:"🇮🇩",heat:"גבוה יציב",burn:"ארוכה מאוד, מעט אפר",smoke:"ניטרלי",best:"עישון ארוך אקולוגי",buy:"קוקו גריל · פחם"},
 {heb:"אקציה",eng:"Acacia",flag:"🇿🇦",heat:"בינוני",burn:"בינונית (~14ש)",smoke:"ניטרלי",best:"מתחילים, מהיר וקל",buy:"פחם · בית הפחם"},
 {heb:"פחם מקומי (משולש/גדה)",eng:"Local",flag:"🇮🇱",heat:"בינוני-גבוה",burn:"בינונית",smoke:"משתנה",best:"מנגל עממי",buy:"סופרים · תחנות דלק (הכי זמין)"},
 {heb:"פחם דחוס/מעובד",eng:"Compressed",flag:"",heat:"בינוני",burn:"ארוכה",smoke:"תלוי-מותג",best:"תקציבי, נוחות",buy:"סופרים · קוקו גריל"},
];
function openWoods(focusCat){
  const byCat={};
  DATA.cuts.forEach(c=>{(byCat[c.cat]=byCat[c.cat]||new Set());String(c.wood).split('/').forEach(w=>byCat[c.cat].add(w.trim()));});
  const guide={
    "עדין (דג, עוף, גבינה)":"תפוח, דובדבן, בכר — עשן מתוק שלא מכסה.",
    "בינוני (חזיר, הודו, בקר)":"אלון, אגוז, פקאן — האיזון הקלאסי.",
    "חזק (בקר, נתחי קולגן)":"היקורי — בודד או בתערובת.",
    "חזק מאוד (בריסקט טקסני)":"מסקיט — במינון זהיר, מריר אם מוגזם."
  };
  const intRows=Object.entries(guide).map(([k,v])=>`<div class="shop-line"><span style="flex:1"><b>${k}</b><br><small style="color:var(--smoke)">${v}</small></span></div>`).join("");
  const catRows=Object.entries(byCat).map(([c,ws])=>`<div class="ctrow"><div><b style="color:${catColor(c)}">${c}</b></div><div class="ct-note">${[...ws].filter(Boolean).join(' · ')}</div></div>`).join("");
  showPanel(`${toolTop('מדריך עצים ופחמים','התאמת דלק, עוצמת עשן והיכן לקנות','🪵','#8a6a3c')}
   <div class="panel-body">
     <h4 class="mini-h">🔥 סוגי פחם — והיכן לקנות בישראל</h4>
     <div class="coallist">${CHARCOAL.map(c=>`<div class="coalcard">
       <div class="coalhead"><b>${c.flag} ${c.heb}</b><span class="coaleng">${c.eng}</span></div>
       <div class="coalmeta"><span>🌡️ ${c.heat}</span><span>⏱️ ${c.burn}</span><span>💨 ${c.smoke}</span></div>
       <div class="coalbest">מתאים ל: ${c.best}</div>
       <div class="coalbuy">🛒 ${c.buy}</div>
     </div>`).join('')}</div>
     <h4 class="mini-h" style="margin-top:20px">🪵 עצים לפי עוצמה</h4>${intRows}
     <h4 class="mini-h" style="margin-top:16px">לפי קטגוריה (מהטבלה)${focusCat?` · ממוקד: ${focusCat}`:''}</h4>
     <div class="ctlist">${catRows}</div>
   </div>`);
}

/* ---- troubleshooting (Help!) ---- */
// troubleshooting knowledge — grouped by topic (rendered as collapsible groups, not all at once)
const TROUBLE_GROUPS=[
 {g:"אש, פחם ועשן",ic:"🔥",items:[
  ["העשן יצא מר / חריף / אפרורי","עשן 'מלוכלך' מבעירה חנוקה שיוצרת קריאוזוט. שאף לעשן כחלחל-שקוף דק, לא לבן סמיך. ודא שהפחם בער לגמרי לפני שהוספת עץ, פתח את הפתחים (אש נקייה חשובה מטמפ׳ נמוכה), והשתמש בעץ יבש ומיושן בלבד."],
  ["עשן לבן וסמיך במקום כחול","סימן ללחות — עץ ירוק/רטוב/קר, או יותר מדי עץ בבת אחת. אל תשרה עץ במים, חמם אותו על הפיירבוקס לפני, הוסף מעט בכל פעם, ותן לענן הלבן לדעוך לפני שמכניסים בשר."],
  ["קשה לשמור טמפ׳ יציבה","אל תרדוף אחרי טמפ׳ נמוכה ע״י חניקת האש — אש קטנה וחמה עדיפה על גדולה ומעשנת. השתמש בשיטת מיניון (פחם לא-בוער על בוער), כוונן בעיקר את פתח הכניסה, וייצב את הטמפ׳ לפני שמכניסים בשר."],
  ["הפחם נכבה או דועך מהר","זרימת אוויר חסומה מאפר או פתחים סגורים. נקה אפר לפני כל בישול, השתמש בארובת-הצתה (chimney) במקום נוזל הצתה (שנותן טעם רע), ופתח פתח תחתון לחמצן."],
  ["טעם כימי / דלק בבשר","נוזל הצתה או פחם דחוס באיכות ירודה. עבור לארובת-הצתה עם קוביות הצתה טבעיות, ותן לפחם להגיע לאפר-אפרפר לפני הבישול."],
  ["התלקחויות (flare-ups) בגריל","שומן שנוטף על גחלים. הזז לאזור עקיף (2-zone fire), קצץ עודף שומן, השתמש במגש טפטוף, ואל תמרח שמן/מרינדה שמנית ישירות מעל להבה."],
 ]},
 {g:"בשר ועישון ארוך",ic:"🥩",items:[
  ["הבריסקט 'תקוע' (Stall) ולא עולה","התאדות-קירור סביב 65–77°C — נורמלי לחלוטין, יכול להימשך 1–3 שעות. אל תעלה חום בפאניקה. אופציות: סבלנות; או 'Texas Crutch' — עטיפה בנייר קצבים/אלומיניום סביב 68°C כדי לפרוץ."],
  ["מתי לעטוף (wrap)?","לא לפי מספר במדחום — לפי הקרום. עטוף כשהקרום כהה, יציב, ולא 'נמרח' במגע. נייר קצבים שומר יותר קרום; אלומיניום מהיר ורך יותר. עטיפה מוקדמת מדי מרככת את הקרום."],
  ["הבשר יצא יבש","לרוב תת-בישול דווקא, לא עודף. בדוק מרקם בחלק העבה ביותר — 'עשוי' זה כשכל הנתח רך, לא נקודה אחת. קח לקולגן ~95°C (לא רק לטמפ׳ בטיחות), ונוח בקופסת בידוד שעה+."],
  ["אין קרום (bark)","יותר מדי לחות מוקדמת, זרימת אוויר חלשה, או ראב עם יותר מדי סוכר ומעט מלח/פלפל. תן לראב להיעשות דביק לפני, הפחת ריסוס בהתחלה, ושמור זרימת אוויר טובה."],
  ["הקרום רך / ספוגי","עטיפה מוקדמת מדי, ריסוס מוגזם, קיטור בתוך אלומיניום, או מנוחה חמה מדי בכלי סגור. פתח את הנתח לאוויר לאחר העטיפה כדי להקשות מחדש."],
  ["הנתח קשה / 'גומי'","תת-בישול של הקולגן. נתחי חזה/כתף צריכים ~90–96°C פנימיים כדי שהקולגן יימס לג׳לטין — הרבה מעבר לטמפ׳ 'עשוי' של סטייק."],
  ["הבשר מתפורר / קרמבלי","עודף בישול — הקולגן נשבר יותר מדי. הוצא מוקדם יותר, חתוך עבה יותר, ובסכין חדה שחותכת ולא קורעת."],
  ["חתכתי והמיצים ברחו","לא נחת מספיק. תן מנוחה 15 דק׳ לנתח קטן, שעה+ לבריסקט/כתף (בקופסת בידוד), וחתוך תמיד נגד כיוון הסיבים."],
  ["טעם מעושן מדי / מריר","נתחים עדינים (עוף, דג, צלעות) סופגים עשן מהר. השתמש בעץ מתון וחשיפה קצרה יותר. לתיקון בדיעבד: רוטב מתוק/חמאה/גלייז מאזנים מרירות."],
 ]},
 {g:"נקניקים ומילוי",ic:"🌭",items:[
  ["השומן 'נמרח' (fat smear)","עבדת חם מדי — השומן נמרח במקום להישאר בגרגר. שמור בשר, שומן וחלקי מטחנה מתחת ל-2–4°C, טחן קפוא-חלקית, ואל תלוש יותר מדי אחרי הוספת השומן."],
  ["הנקניקיות נסדקות/מתפוצצות בצלייה","חום גבוה מדי או שלא נוצר pellicle. ייבש במקרר שעה+ אחרי המילוי, וצלה בחום בינוני-עקיף. חום גבוה מרתיח את הלחות בפנים ומפוצץ את העור."],
  ["בועות אוויר בתוך הנקניק","מילוי לא צפוף או שלא ניקבת. מלא צפוף ואחיד, נַקב את הבועות במחט סטרילית, וסובב לחוליות בכיוונים מתחלפים."],
  ["הנקניק יצא יבש/מפורר","מעט שומן (צריך 20–30%), עודף מלח, או עישון חם מדי. שמור יחס שומן נכון, וקח לטמפ׳ פנימית מדויקת (~68–71°C) בלי לייבש-יתר."],
  ["מרקם 'קמחי'/רך אחרי בישול","טחינה חמה או חוסר קישור (bind). הוסף מלח מוקדם לחילוץ חלבון דביק (myosin), לוש עד שהמסה נדבקת ליד, ושמור הכל קר."],
  ["העור קשיח / 'לעיס'","שרוול טבעי לא הושרה מספיק, או pellicle עבה מדי. השרה מעיים טבעיים 30+ דק׳ והדח פנימית; לשרוולי קולגן — אל תייבש-יתר לפני צלייה."],
 ]},
 {g:"ייבוש וריפוי (שרקוטרי)",ic:"🧫",items:[
  ["הקליפה התקשתה (Case Hardening)","ייבשת מהר מדי — החוץ קשה והפנים רטוב. הגבר לחות ל-78–85%, האט מאוורר (מחזור ~5/25 דק׳), ולעיתים עטוף ב-collagen sheet כדי 'לאזן' לחות חזרה פנימה."],
  ["ה-pH לא יורד בהתססה","התרבית לא 'תפסה'. ודא טמפ׳ 24–26°C, לחות 85–90%, דקסטרוז כמזון לחיידקים, ושלא הרגת את התרבית במים מוכלרים. בדוק תוקף התרבית."],
  ["עובש ירוק/שחור/כחול","עובש לבן (P. nalgiovense) רצוי ומגן. ירוק/שחור — נגב בחומץ או תמי-מלח. אם חדר לעומק או יש ריח אמוניה/רקב — לפסול. שמור לחות יציבה ומחזור אוויר עדין."],
  ["ריח חמצמץ/רקוב או ריר","זיהום — לרוב טמפ׳ גבוהה מדי בשלב מוקדם, מלח לא מספיק, או ירידת pH איטית. פסול אם יש ריר דביק, ריח רע חריף, או צבע אפור-ירקרק בפנים."],
  ["ירד יותר מדי במשקל / קשה מדי","עברת את יעד ה-35–40% ירידה. עטוף בנייר קצב ותן 'לנוח' במקרר שבועות — הלחות מתאזנת חזרה. למדוד תמיד לפי משקל, לא לפי זמן."],
  ["טבעת ייבוש (dry ring) בחתך","החוץ התייבש מהר מהפנים. הכל כמו Case Hardening — לחות גבוהה יותר ומאוורר איטי יותר לאורך כל הייבוש."],
 ]},
 {g:"גבינות ומעושן קר",ic:"🧀",items:[
  ["הגבינה נמסה / 'הזיעה'","חם מדי. עשן קר ב-≤25°C בלבד — עשן בלילה/חורף, הנח מגש קרח מתחת, והשתמש במחולל עשן (maze/tube) בלי חום ישיר."],
  ["הגבינה יצאה מרירה","עודף עשן או עשן מלוכלך. עשן פחות זמן (2–4 שעות), עץ פירות מתון (תפוח/אגס), ואז עטוף ותן 'להתבגר' במקרר 2+ שבועות — הטעם מתמתן ומתאזן."],
  ["אין צבע/טעם עשן","זרימת אוויר מהירה מדי או מרחק גדול מהעשן. קרב את הגבינה, האט מעט את הזרימה, וייבש את פני הגבינה (pellicle) לפני העישון כדי שהעשן ייצמד."],
 ]},
 {g:"דגים ופירות ים",ic:"🐟",items:[
  ["הדג יצא יבש/'מבושל מדי' בסו-ויד","טמפ׳ גבוהה מדי. סלמון: 50–52°C למרקם משיי, פורל דומה. אל תעבור ~55°C אם רוצים עדינות. השתמש בדג סושי-גרייד או קפוא לבטיחות טפילים."],
  ["בטיחות טפילים בדג נא/חלקית","הקפא ל-−20°C ל-7 ימים (או −35°C ל-15 שעות) לפני הגשה נא/חלקית. פירות ים ל-63°C בטיחותי (FDA). קרפצ׳ו/סשימי רק מדג שהוקפא כראוי."],
  ["פירות ים גומיים/קשים","עודף בישול — הם מתבשלים בדקות. שרימפס/סקלופס עד שקיפות נעלמת בלבד, קלמארי או מהר מאוד (דקות) או ארוך מאוד (נזיד) — לא באמצע."],
  ["עור הדג נדבק לגריל","גריל לא חם/נקי מספיק ודג לח. ייבש היטב, שמן את הדג (לא הגריל), הנח על גריל חם ואל תזיז עד שמשתחרר לבד."],
 ]},
 {g:"צומח — ירקות ופירות",ic:"🥬",items:[
  ["הירק נשרף בחוץ וחי בפנים","חום ישיר גבוה מדי. עבור לאזור עקיף לירקות עבים (בטטה, תירס), או חתוך דק יותר. אין 'בטיחות פנים' בצומח — רק שליטה במרקם."],
  ["ירקות יצאו רכים/מימיים","עודף בישול או עודף שמן. צלה בחום גבוה זמן קצר לחריכה עם פנים פריך, ומלח רק בסוף (מלח מוקדם מוציא מים)."],
  ["פירות מתפרקים על הגריל","בשלים מדי או חתוכים דק מדי. בחר פירות מוצקים (אננס, אפרסק לא-בשל-יתר), חתוך עבה, וצלה חם וקצר לקרמול בלי להתפרק."],
 ]},
 {g:"בטיחות מזון",ic:"✅",items:[
  ["כמה Cure להוסיף? חשש מעודף","Cure #1: 2.5 ג׳/ק״ג (=156ppm) למוצרים טחונים/מעושנים; בייקון 2.0 ג׳/ק״ג (120ppm). Cure #2 לייבוש ארוך בלבד. השתמש במחשבון המלח באפליקציה — אל תנחש."],
  ["'כלל 4 השעות' — מה זה?","בשר בטמפ׳ מסוכנת (4–60°C) לא יותר מ-4 שעות מצטברות לאורך חייו. חשוב בעישון איטי: הפנים חייב לעבור 60°C בזמן סביר, במיוחד בבשר טחון/מוזרק."],
  ["פסטור — זמן מול טמפ׳","בטיחות אינה רק טמפ׳ אלא זמן×טמפ׳ במרכז הנתח. עוף ב-60°C למשך ~35 דק׳ בטוח כמו 74°C רגעי — טבלאות באלדווין. סו-ויד מנצל בדיוק את זה."],
  ["זיהום צולב","הפרד קרשים/כלים לנא ומוכן, שטוף ידיים אחרי נגיעה בנא, ואל תחזיר בשר מבושל לצלחת שהחזיקה אותו נא."],
 ]},
];
// rich in-app "about & capabilities" panel — full marketing content, no external file dependency
function openAbout(){
  const nCuts=(DATA.cuts||[]).length, nMakes=Object.keys(DATA.makes||{}).length, nSpec=(DATA.specials||[]).length;
  const nTotal=nCuts+nMakes+nSpec, nSeas=(DATA.seasonings||[]).length;
  const nSea=(DATA.cuts||[]).filter(c=>c.cat==='פירות ים').length;
  const nCheese=(DATA.specials||[]).filter(s=>s.cat==='גבינה').length;
  const stat=(n,l)=>`<div class="ab-stat"><div class="ab-n">${n}</div><div class="ab-l">${l}</div></div>`;
  const feat=(ic,t,b)=>`<div class="ab-feat"><div class="ab-fico">${ic}</div><div><h4>${t}</h4><p>${b}</p></div></div>`;
  const tool=(ic,t,b)=>`<div class="ab-tool"><div class="ab-tico">${ic}</div><h5>${t}</h5><p>${b}</p></div>`;
  const fact=(v,k,d)=>`<div class="ab-fact"><div class="ab-fv">${v}</div><div class="ab-fk">${k}</div><div class="ab-fd">${d}</div></div>`;
  const cats=['בקר','טלה','חזיר','עוף','הודו','דג','איברים פנימיים','ירקות','פירות','נקניקיות','נקניק מעושן','פסטרמה','שווארמה','סלומי','BBQ קלאסי','פירות ים','גבינה','דג מעושן','בשר מיובש','ברווז','אווז','נקניק מיובש','בייקון'];
  const html=`${toolTop('מתכונת · מדריך האש','כל היכולות והמדע מאחורי האפליקציה','🔥','#e07a52')}
   <div class="panel-body ab-body">
     <p class="ab-thesis">בישול מדויק מתחיל בעברית. אפליקציה אחת ל<b>סו-ויד</b>, <b>עישון</b>, <b>גריל</b> ו<b>שרקוטרי</b> — מבשר, דגים ופירות-ים ועד גבינות וירקות, מהחומר-גלם ועד הצלחת.</p>

     <div class="ab-eyebrow">הרעיון</div>
     <h3 class="ab-h">כל בישול הוא טמפרטורה × זמן</h3>
     <p class="ab-p">המדריך נבנה סביב התובנה הזו: לכל פריט יש כמה דרכים — <b>סו-ויד + עישון</b> שחוסך שעות ליד המעשנת, <b>עישון בלבד</b> לטעם עמוק, או <b>גריל / אש ישירה</b> לצומח. כל מתכון נותן את כולן, עם זמנים, טמפרטורות, בורר <b>מידת-עשייה</b> מדויק לכל סועד, ובורר <b>תיבול</b> — ראב, מרינדה, רוטב או גלייז מתוך מאגר של ${nSeas} מתכוני מתבלים.</p>
     <div class="ab-stats">${stat(nTotal,'נתחים ופריטים')}${stat('25','קטגוריות')}${stat(nMakes,'בנייות מאפס')}${stat('56','בוררי מידת-עשייה')}</div>

     <div class="ab-eyebrow">הספרייה</div>
     <h3 class="ab-h">מבשר ועד תאנים על האש — ספרייה שלמה</h3>
     <p class="ab-p">${nTotal} פריטים ב-25 קטגוריות: בשר בקר, טלה וחזיר, עוף, הודו, ברווז ואווז, דגים ו<b>${nSea} פירות-ים</b> (שרימפס, סרטן, קלמארי, צדפות), <b>איברים פנימיים</b> (לב, כבד, שקדים), ו<b>ירקות ופירות</b> על הגריל, בעישון ובסו-ויד. ועוד ${nSpec} מוצרים מיוחדים — בהם <b>${nCheese} גבינות</b> — ו-${nMakes} מתכוני בנייה-מאפס: נקניקים, פסטרמות, שווארמות, סלומי, דגים מעושנים וקלאסיקות BBQ.</p>
     <div class="ab-cats">${cats.map(c=>`<span class="ab-cat">${c}</span>`).join('')}</div>
     ${feat('🎯','שיטה מדויקת לכל פריט','סו-ויד+עישון, עישון בלבד, וגריל/אש-ישירה לצומח — עם צ׳קליסט, טיימרים וסרגל התקדמות.')}
     ${feat('🥩','מידת עשייה מבוססת-מחקר','בורר נא→עשוי ל-56 נתחים, עם טמפ׳ מדויקת לכל סועד — סולם נפרד לבקר, עוף, דג, פירות-ים ואיברים.')}
     ${feat('🧮','מחשבונים ונתוני גלם','מחשבון כמויות לפי סוג מנה (בשר/דג/פירות-ים/גבינה/ירקות/קינוח), מחשבון מלח/Cure ותמלחת שיווי-משקל, וכל הטמפרטורות והזמנים.')}
     ${feat('🔧','הציוד שלי — מתכונים שמתאימים אליך','הגדר מה יש לך (מעשנה/גריל/סו-ויד/ואקום/מטחנה/מילוי/משקל ועוד). שיטות ללא ציוד מסומנות עם חלופה מיידית והצעת רכישה, טיפים לפי סוג המעשנה, וברירת-מחדל חכמה.')}

     <div class="ab-eyebrow">טעם ודלק</div>
     <h3 class="ab-h">התיבול והאש — לא מחשבה שאחרי</h3>
     ${feat('🧂',`${nSeas} מתכוני מתבלים לפי מדינות`,'ראב, מרינדה, רוטב וגלייז מכל העולם — קנזס-סיטי, קרוליינה, בולגוגי, יקיטורי, צ׳ימיצ׳ורי, ג׳רק, שרמולה, טום, סחוג, אל-פסטור, צ׳אר-סיו ועוד — עם מרכיבים והוראות הכנה, מסונן לפי מדינה, ונבחר בתוך המתכון.')}
     ${feat('🔥','מדריך 15 סוגי פחם — והיכן לקנות בישראל','קברצ׳ו לבן ואדום, מרבו, גואייקן, בינשוטן, קוקוס, היקורי, מסקיט, הדרים ועוד — עם חום, זמן בערה, פרופיל עשן, וספק ישראלי לכל סוג (חזן גחלים, פחם, BBQ\'NMORE, קוקו גריל ועוד).')}
     ${feat('🛒','מזווה — מחסן רכיבים + קניות חכמות','עוקב אחרי פרויקטים (ייבוש/כבישה), ומשמש כמחסן רכיבים: מייצרים מאפס או קונים מוכן ומאחסנים, מוסיפים שלב סיום (עישון לגבינה קנויה), וכשמגיע המועד מגשרים ישירות לאירוע/בישול — הפריט נכנס לתוכנית כ"רק סיום" או "מוכן להגשה". כולל 24 חומרי-גלם ומעקב מלאי.')}
     ${feat('✡️','כשרות','כל פריט מסומן (כשר · לא כשר · חלבי), עם סינון "כשר בלבד" לקטלוג ולאירוע.')}

     <div class="ab-eyebrow">מלאכות מאפס</div>
     <h3 class="ab-h">נקניקים, קבב וגבינות — מאפס עד הצלחת</h3>
     ${feat('🍖',`בנייה מאפס — ${nMakes} מלאכות`,'טחינה→תיבול→קישור→מילוי→בישול, שלב-אחר-שלב עם טיימרים. הבורר מקוטלג לפי סוג, מדינה ויבשת (🇩🇪🇮🇹🇫🇷), עם תיאור מלא לכל פריט — נקניקיות, קבב, שווארמה, פסטרמה, סלומי, דגים מעושנים וגבינות.')}
     ${feat('🌡️','בישול נכון לכל נקניק','טמפ׳-יעד פנימית לכל מתכון (71° לבשר, 74° לעוף), עם פוץ׳ עדין / סו-ויד / גריל לפי עובי — והדקיקות (מרגז) בגריל מהיר כמסורתי. כולל הנחיות אחסון והכנה-מראש לכל נקניקייה טרייה.')}
     ${feat('🔪','שלוש דרכים לכל מלאכה','לכל פריט בתוכנית: "מוכן לגמרי" · "הוכן מראש — רק סיום" · "מאפס היום". מייצרים ומאחסנים במועד אחד, מסיימים ומגישים באחר — הפיצול אוטומטי בגבול היישון.')}
     ${feat('🍔','בונה בורגר לכל סועד','מידת-עשייה, גבינה (מעל / ממולא Juicy Lucy), תוספות, רוטב ולחמנייה — אישית לכל סועד. תוכנית העבודה מקבצת קציצות לפי מידה ומרכיבה אישית בהגשה.')}

     <div class="ab-eyebrow">בינה מלאכותית · מפתח אישי</div>
     <h3 class="ab-h">7 יכולות AI — מעוגנות בקטלוג, בטיחות מהאפליקציה</h3>
     <p class="ab-p">חבר מפתח <b>Gemini</b> אישי (חינם, נשמר רק במכשירך) ותקבל שכבת-AI חכמה. עיקרון-על: ה-AI בוחר <b>אך ורק מתוך הקטלוג</b> — לעולם לא ממציא פריטים, ו<b>מספרי הבטיחות (מלח/ריפוי/טמפ׳) מגיעים תמיד מהאפליקציה</b>, לא מה-AI. הכל אופציונלי — בלי מפתח, הכל עובד עם מנועים מקומיים.</p>
     ${feat('🎉','מתכנן אירוע בשפה חופשית','"מנגל בשרי ל-10 בלי חזיר" → תפריט מאוזן שנטען לאשף. עם הגנת-כשרות כפולה: פריט לא-כשר נזרק באפליקציה גם אם ה-AI הציע אותו.')}
     ${feat('🍳','מה אפשר להכין ממה שיש','מצליב את חומרי-המדף במזווה והציוד שלך מול המתכונים — "אפשר עכשיו" מול "כמעט, חסר מעט". עובד גם בלי מפתח (חישוב מקומי).')}
     ${feat('🗓️','יועץ תזמון (תכנון-אחורה)','בחר תאריך-יעד → מה להתחיל ומתי. משכי-הייצור מחושבים מנתוני האפליקציה; ה-AI מנמק ובוחר, אבל התאריכים תמיד מהאפליקציה.')}
     ${feat('🧂','תיבול מותאם-פריט','ה-AI בוחר 3-5 מתבלים מתוך המאגר המתאימים לנתח והשיטה, עם הסבר לכל אחד — נשמר למופע בלי לשנות את התבנית.')}
     ${feat('🩺','אבחון תקלה אישי','תאר תקלה → אבחון שמתחשב ביומן ובפרויקטים שלך, עם קישור לפתרונות המאומתים באפליקציה (הטקסט תמיד הסמכותי, לא מ-AI).')}
     ${feat('✨','מחולל מתכונים → פרויקט','תאר מתכון (נקניקיה/מעושן/מיובש/שווארמה/קבב) → מתכון-בנייה חדש שנשמר ונהפך לפרויקט. מסומן "לא-מאומת בטיחות", ומספרי המלח/ריפוי מ-presets בטוחים של האפליקציה.')}
     ${feat('📊','תובנות יומן','ניתוח היסטוריית הבישולים שלך — דפוסים והצעות שיפור, מעוגן ברשומות האמיתיות בלבד.')}
     ${feat('🎙️','ממשק קולי דו-לשוני עם AI','ליד המעשנת: שאל שאלות חופשיות בקול, בעברית או באנגלית (זיהוי מדויק יותר) — אפשר לשאול באנגלית ולקבל תשובה בעברית, בהקראה ובכתב, מעוגן בשלב הבישול הנוכחי.')}

     <div class="ab-eyebrow">הכלים</div>
     <h3 class="ab-h">לא רק מתכונים — מערכת לניהול בישול</h3>
     <div class="ab-tools">
       ${tool('⭐','מועדפים','שמירה וסינון מהיר של המתכונים שחוזרים אליהם.')}
       ${tool('🕒','מתזמן ציר-זמן','שעת הגשה → מתי להתחיל כל פריט, עם התראות בזמן אמת.')}
       ${tool('✡️','כשרות ותחליפים','תיוג כשר/חלבי והצעת תחליף כשר אוטומטית.')}
       ${tool('🔎','סינון וגילוי','לפי שיטה, קושי, זמן וכשרות — וחיפוש לפי מצרך.')}
       ${tool('📝','הערות ודירוג','תיעוד אישי וכוכבים לכל מתכון.')}
       ${tool('🧫','פרויקטים ומזווה','מעקב ייבוש/כבישה/מאפס מול יעד, מזווה כמחסן רכיבים (מייצרים או קונים → מאחסנים → מסיימים → מגשרים לאירוע), וקניות אוטומטיות.')}
       ${tool('⏰','תזכורות','אבני-דרך רב-יומיות, אוטומטיות מהמזווה.')}
       ${tool('🆘','מצב הצילו','אבחון ופתרון 41 תקלות ב-9 נושאים + אבחון-AI אישי מהיומן.')}
       ${tool('🔥','שאל את האש','עוזר בישול חכם: מנוע מקומי (זמן/טמפ׳/עץ/כמות/כשרות) + מצב AI אופציונלי (Gemini, מפתח אישי) עם חיפוש באינטרנט — עונה גם על היכן לקנות, מחירים וספקים.')}
       ${tool('🧂','מתבלים ורטבים',`${nSeas} מתכוני ראב · מרינדה · רוטב · גלייז לפי מדינות.`)}
       ${tool('🥩','מתרגם נתחים','בשר, דגים, פירות ים וגבינות — שמות ישראליים ופתק לקצב.')}
       ${tool('🪵','עצים ופחמים','התאמת עץ ופחם לבשר לפי עוצמת עשן.')}
       ${tool('🎉','אשף אירוע (6 שלבים)','סועדים, מנות, תיבול, תוספות, 40 משקאות וקינוחים (כולל פירות עונתיים) → תפריט, כמויות מדויקות, קניות ותוכנית.')}
       ${tool('📓','יומן בישולים','היסטוריה אישית עם טמפ׳, דירוג ותמונה.')}
       ${tool('🛒','רשימת קניות','מאוחדת לפי קבוצות, מסומנת וניתנת להדפסה.')}
       ${tool('💾','גיבוי ושחזור','ייצוא וייבוא כל הנתונים שלך לקובץ.')}
     </div>

     <div class="ab-eyebrow">המדע</div>
     <h3 class="ab-h">מדויק במקום שזה חשוב — בטיחות</h3>
     <p class="ab-p">המתכונים מעוגנים במקורות מקצועיים (USDA/FSIS, Douglas Baldwin, AmazingRibs). המספרים אינם קישוט — הם ההבדל בין מוצר בטוח ללא-בטוח.</p>
     <div class="ab-facts">
       ${fact('≤5.3','pH בהתססה','מחסום הבטיחות הראשון בנקניק מיובש.')}
       ${fact('120<small>ppm</small>','ניטריט בבייקון','תקן USDA — נמוך מ-156 הרגיל.')}
       ${fact('×0.62','משקל יעד','ירידת 35–40% = מוכנות אמיתית, לא זמן.')}
       ${fact('0.85','פעילות מים (Aw)','הסף שמתחתיו חיידקים לא משגשגים.')}
     </div>
     <p class="ab-p">ועוד: פסטור לפי זמן×טמפ׳ ממרכז הנתח, "כלל 4 השעות", הקפאת דג מפני טפילים, פריצת הסטָאל ב-Texas Crutch, גבינות ב-≤25°C, ובילטונג בייבוש חם — לא קר. לאיברים: כבד וכליות עד-סוף, לב חם-ומהיר כמו סטייק. לצומח אין בטיחות-פנים — רק שליטה במרקם.</p>

     <div class="ab-eyebrow">איך זה בנוי</div>
     <h3 class="ab-h">קובץ אחד. בלי שרת. הנתונים שלך נשארים אצלך.</h3>
     ${feat('📦','עצמאי לחלוטין','HTML יחיד שרץ בכל דפדפן — בלי התקנה, בלי חשבון, בלי שרת.')}
     ${feat('📲','מותקן כאפליקציה','אייקון אש על מסך הבית, פתיחה במסך מלא — PWA אמיתי.')}
     ${feat('🔒','פרטי כברירת מחדל','מועדפים, יומן, מזווה והערות נשמרים מקומית במכשיר בלבד — עם ייצוא/ייבוא.')}
     ${feat('⎙','הדפסה ל-PDF','כל מתכון, תפריט, לוח-זמנים או רשימה — מודפסים נקי בלחיצה.')}
     ${feat('♿','נגיש ו-RTL','עברית-first, ניווט מקלדת, מלכודת-מיקוד, וכיבוד reduced-motion.')}

     <div class="ab-eyebrow">לאן זה הולך</div>
     <h3 class="ab-h">מהמדריך אל מתכונת המלאה</h3>
     <div class="ab-road">
       <div class="ab-step now"><span class="ab-ph">עכשיו</span><b>מדריך האש + שכבת AI</b> — ${nTotal} פריטים, ${nMakes} בנייות-מאפס, מידות-עשייה מבוססות-מחקר, 7 יכולות AI וממשק קולי דו-לשוני.</div>
       <div class="ab-step"><span class="ab-ph">הבא</span><b>אופליין מלא</b> — עבודה גם בלי רשת, פונטים מקומיים, ותזכורות-רקע.</div>
       <div class="ab-step"><span class="ab-ph">החזון</span><b>מתכונת בענן</b> — חשבונות, סנכרון בין מכשירים, והרחבת שכבת ה-AI.</div>
     </div>

     <div class="ab-credits">
       <div class="ab-mk">מתכונת · <span>האש</span></div>
       <p>בישול מדויק, בעברית. מבשר ועד ירקות — מהחומר-גלם ועד הצלחת.</p>
       <div class="ab-by">פותח ועוצב על-ידי <b>דודי בר-און</b><br><a href="mailto:dudi.bar.on@gmail.com">dudi.bar.on@gmail.com</a></div>
       <div class="ab-ver" id="abVer"></div>
     </div>
   </div>`;
  showPanel(html);
  const fs=document.querySelector('.foot-stamp'); const v=$("#abVer"); if(v&&fs) v.textContent=fs.textContent||'';
}

// how-to usage guide (distinct from the SOS/troubleshooting panel)
function openGuide(){
  const sec=(ic,title,body)=>`<div class="guide-sec"><h4>${ic} ${title}</h4><div class="guide-body">${body}</div></div>`;
  const html=`${toolTop('איך משתמשים','מדריך מהיר למסלולים ולכלים','❓','#c77a3a')}
   <div class="panel-body">
   <p class="guide-intro">מתכונת · מדריך האש בנוי סביב <b>שלושה מסלולים</b>. בחר לפי מה שאתה צריך עכשיו:</p>
   ${sec('🎉','יש לי אירוע','תכנון ארוחה מרובת-מנות. אשף בן 6 שלבים: סועדים ותיאבון, מנות מהקטלוג, תיבול לכל מנה, תוספות, 40 משקאות (כולל חריפים וקוקטיילים) וקינוחים (אש, קלאסיקות ומגש פירות עונתי לפי תאריך האירוע) → תפריט, כמויות מחושבות לכל פריט, רשימת קניות ותוכנית עבודה. אפשר לשמור ולנהל כמה אירועים.')}
   ${sec('🍳','בא לי לבשל משהו','מסלול מהיר לפריט בודד. נכנס ישר לקטלוג — בוחר נתח/מוצר, ומקבל מתכון מלא: טמפ׳ וזמן, בורר מידת-עשייה לכל סועד, בורר תיבול (ראב/מרינדה/רוטב/גלייז), ורשימת קניות ספציפית למתכון.')}
   ${sec('🧫','פרויקט מתקדם','לתהליכים ארוכים — ייבוש, ריפוי, התססה. מעקב אחרי שלבים, משקל-יעד מול משקל נוכחי, ופס התקדמות. כאן נמצא גם <b>המזווה</b>: חומרי גלם (שרוולים, מלחי ריפוי, תבלינים, עצים) עם מעקב מלאי ורשימת קניות אוטומטית למה שחסר.')}
   ${sec('📚','הקטלוג','279 פריטים ב-25 קטגוריות. בדף הקטלוג: אריחי-קטגוריות לניווט, סינון לפי תת-קטגוריה, חיפוש חופשי, ⭐ מועדפים, ומסנן <b>"כשר בלבד"</b>. כל פריט מסומן בכשרות (כשר/לא כשר/חלבי).')}
   ${sec('🧂','תיבול חכם — תבנית ↔ מופע','289 מתכוני ראב · מרינדה · גלייז · רוטב מרחבי העולם, עם מקור, מרכיבים והוראות. לכל מתכון "ראב בית" מובנה שנבחר כברירת מחדל, והתאמה אישית נעשית בביצוע — באשף האירוע, בתוכנית העבודה או בפרויקט — ונשמרת לאותו הקשר בלבד (אירוע/בישול/פרויקט), כך שהמתכון בקטלוג תמיד נשאר נקי. בורר עם 5 צירי סינון: מומלצים, מדינה, גוון-טעם, בסיס וחריפות.')}
   ${sec('🔥','עצים ופחמים','מדריך 15 סוגי פחם (קברצ׳ו, מרבו, בינשוטן, קוקוס, הדרים ועוד) — עם חום, זמן בערה, פרופיל עשן, והיכן לקנות בישראל. נגיש מתפריט ☰ ← "סוגי עץ".')}
   ${sec('🔥','שאל את האש','עוזר בישול שעונה על זמן, טמפ׳, עץ, כמות, כשרות ותקלות. שני מצבים: <b>מנוע מקומי</b> (מיידי, אופליין) או <b>AI חכם</b> (Gemini) עם חיפוש באינטרנט — עונה גם על איפה לקנות פחם/ציוד, מחירים וספקים, ותומך בשאלות המשך. כל תשובה מסומנת במקורה. נגיש בכפתור בולט בראש דף הבית.')}${sec('🆘','נתקעת?','ב-☰ ← "מצב הצילו (תקלות)": 41 פתרונות ב-9 נושאים מתקפלים (אש/עשן, בשר, נקניקים, ייבוש, גבינות, דגים, צומח, בטיחות) + חיפוש.')}
   <p class="guide-foot">טיפ: כל בחירה שאתה עושה (מועדפים, מידת-עשייה, תיבול, מלאי) נשמרת אוטומטית במכשיר שלך.</p>
   <button class="guide-about-link" id="cGuideAbout">ℹ️ אודות — כל היכולות והמדע מאחורי האפליקציה ←</button>
   </div>`;
  showPanel(html);
  const ga=$("#cGuideAbout"); if(ga) ga.addEventListener('click',()=>{ if(typeof closePanel==='function') closePanel(); setTimeout(openAbout,60); });
}
function openHelp(){
  const total=TROUBLE_GROUPS.reduce((n,g)=>n+g.items.length,0);
  const groupHTML=TROUBLE_GROUPS.map((grp,gi)=>{
    const items=grp.items.map((t,i)=>`<div class="acc"><button class="acc-q" data-acc="${gi}-${i}">${t[0]} <span>+</span></button><div class="acc-a" id="acc-${gi}-${i}">${t[1]}</div></div>`).join("");
    return `<div class="trouble-grp"><button class="tg-head" data-tg="${gi}"><span>${grp.ic} ${grp.g}</span><span class="tg-n">${grp.items.length} <b class="tg-chev">▾</b></span></button><div class="tg-body" id="tg-${gi}" hidden>${items}</div></div>`;
  }).join("");
  showPanel(`${toolTop('מצב הצילו','אבחון ופתרון תקלות — לפי נושא','🆘','#a8392f')}
   <div class="panel-body">
     <div class="trouble-search"><span class="ic">⌕</span><input id="tSearch" placeholder="חפש תקלה — עשן מר, שומן נמרח, pH, יבש…"></div>
     ${(typeof aiAvail==='function'&&aiAvail())?`<button class="ccta" id="tAiDiag" style="margin:10px 0;background:var(--fresh);border-color:var(--fresh)">✨ אבחון אישי עם AI</button>`:''}
     <p class="section-sub" style="margin:2px 0 12px">${total} פתרונות ב-${TROUBLE_GROUPS.length} נושאים · הקש נושא לפתיחה</p>
     <div id="tGroups">${groupHTML}</div>
     <div id="tResults" hidden></div>
   </div>`);
  const pnl=$("#panel");
  const adb=$("#tAiDiag"); if(adb) adb.addEventListener('click',openDiagnoseAI);
  // toggle a topic group
  pnl.querySelectorAll('[data-tg]').forEach(b=>b.addEventListener('click',()=>{
    const body=$("#tg-"+b.dataset.tg); const chev=b.querySelector('.tg-chev');
    const opening=body.hasAttribute('hidden');
    if(opening){body.removeAttribute('hidden');chev.textContent='▴';} else {body.setAttribute('hidden','');chev.textContent='▾';}
  }));
  // accordion within groups
  const wireAcc=(root)=>root.querySelectorAll('[data-acc]').forEach(b=>b.addEventListener('click',()=>{
    const a=$("#acc-"+b.dataset.acc); const open=a.style.maxHeight; a.style.maxHeight=open?'':a.scrollHeight+'px';
    b.querySelector('span').textContent=open?'+':'−';
  }));
  wireAcc(pnl);
  // search across all groups
  const si=$("#tSearch"), groups=$("#tGroups"), results=$("#tResults");
  si.addEventListener('input',()=>{
    const q=si.value.trim().toLowerCase();
    if(!q){ results.hidden=true; groups.hidden=false; return; }
    const hits=[]; TROUBLE_GROUPS.forEach(g=>g.items.forEach(t=>{ if((t[0]+' '+t[1]+' '+g.g).toLowerCase().includes(q)) hits.push([g,t]); }));
    groups.hidden=true; results.hidden=false;
    results.innerHTML = hits.length
      ? hits.map((h,i)=>`<div class="acc"><button class="acc-q" data-racc="${i}">${h[1][0]} <span class="tg-tag">${h[0].ic}</span> <span>+</span></button><div class="acc-a" id="racc-${i}">${h[1][1]}</div></div>`).join("")
      : '<p class="section-sub" style="text-align:center;padding:20px">לא נמצאה תקלה תואמת. נסה מילה אחרת (למשל "עשן", "יבש", "עובש").</p>';
    results.querySelectorAll('[data-racc]').forEach(b=>b.addEventListener('click',()=>{
      const a=$("#racc-"+b.dataset.racc); const open=a.style.maxHeight; a.style.maxHeight=open?'':a.scrollHeight+'px';
      b.querySelector('span:last-child').textContent=open?'+':'−';
    }));
  });
}

/* ---- Ask the Fire (smart local intent engine — offline, over app data) ---- */
function askAllItems(){ return [...DATA.cuts.map(metaCut),...DATA.specials.map(metaSpec),...Object.entries(DATA.makes).map(([id,m])=>metaMake(id,m))]; }
const ASK_STOP=new Set(['מה','כמה','איזה','איזו','האם','של','עם','זה','זו','את','על','לי','יש','אני','צריך','רוצה','מתי','למה','איך','כדי','בשביל','טוב','הכי','או','גם','לא','כן','מידת','העשייה','עשייה','בין','לעומת','טמפ','זמן','חום','עץ','תיבול','בטיחות','כשר','כשרות']);
function askStrip(w){ return w.replace(/^(ל|ה|ב|ו|מ|ש|כ|לה|וה|מה|שה|כה)/,''); } // strip common Hebrew prefixes
function askFindEntity(q){
  const all=askAllItems();
  // 1) direct: query contains full item name (with or without prefix), or english first word
  let hits=all.filter(m=>q.includes(m.heb)||('ל'+m.heb!==q&&q.includes(m.heb))|| (m.eng&&m.eng.length>3&&q.includes(m.eng.toLowerCase().split(' ')[0])));
  if(hits.length) return hits.sort((a,b)=>b.heb.length-a.heb.length);
  // 2) token match with prefix-strip + stopword filter; require a meaningful (>=4 char) shared token
  const toks=q.split(/[\s,?.!"'׳״]+/).map(askStrip).filter(w=>w.length>=3 && !ASK_STOP.has(w));
  const score=m=>{ let best=0; toks.forEach(t=>{ const words=m.heb.split(/\s+/); words.forEach(w=>{ const ws=askStrip(w); if((ws.includes(t)||t.includes(ws)) && Math.min(ws.length,t.length)>=3){ best=Math.max(best,Math.min(ws.length,t.length)); } }); }); return best; };
  hits=all.map(m=>[m,score(m)]).filter(x=>x[1]>=4).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  return hits;
}
function askCutTimes(c){
  const parts=[];
  if(c.sot) parts.push(`עישון בלבד: ~${c.soh}ש ב-${c.sot}°C`);
  if(c.svt) parts.push(`סו-ויד: ${c.svh}ש ב-${c.svt}°C`);
  if(c.smt) parts.push(`ואז עישון: ~${c.smh}ש ב-${c.smt}°C`);
  return parts;
}
function askFire(qRaw){
  const q=(qRaw||'').trim().toLowerCase(); if(!q) return '';
  const has=(...ks)=>ks.some(k=>q.includes(k));
  const ents=askFindEntity(q);
  const e=ents[0];
  const link=m=>({key:m.key,heb:m.heb,cat:m.cat});
  const openItem=m=>{const it=resolveItem(m.key); if(!it)return; it.kind==='cut'?openCut(it.obj):it.kind==='spec'?openSpec(it.obj):openMake(it.key.slice(5));};

  // ---- tool routers ----
  if(has('מלח','cure','ריפוי','ניטריט','כמה מלח')) return {t:'למינון מלח/ריפוי מדויק (Cure #1/#2, ppm, אחוזים) — פותח את מחשבון המלח.',act:openCalc};
  if(has('פחם','גחלים','קברצ','מרבו','בינשוטן','קוקוס','charcoal')) return {t:'להשוואת סוגי פחם, חום, זמן בערה והיכן לקנות בישראל — פותח את מדריך העצים והפחמים.',act:openWoods};
  if(has('תקוע','stall','מר','מריר','נמרח','smear','עובש','יבש','נסדק','case','ph','מלוכלך','נמס','case hardening')) return {t:'נשמע כמו תקלה — פותח את "מצב הצילו" לאבחון ופתרון.',act:openHelp};

  // ---- kosher ----
  if(has('כשר','כשרות','טרף','חלבי')){
    if(e){ const k=kosherStatus(e.key); const lbl=kosherLabel(k);
      let extra=''; if(k==='pork'||k==='shellfish'){ const sub=(typeof kosherSub==='function')?kosherSub(e.key):null; extra=sub?` תחליף כשר: ${sub}.`:' אפשר לבחור מקביל כשר מהקטלוג.'; }
      return {t:`<b>${e.heb}</b>: ${lbl}.${extra}`,chips:[link(e)]}; }
    return {t:'לאיזה פריט? כתוב את שמו (למשל "האם שרימפס כשר"), או השתמש במסנן "כשר בלבד" בקטלוג.'};
  }

  // ---- quantity ----
  const ppl=(q.match(/(\d+)\s*(אנשים|סועד|איש|נפש|מוזמנ)/)||[])[1] || (has('כמה בשר','כמה לקנות','כמות','מנה','מנות')? (q.match(/(\d+)/)||[])[1] : null);
  if(ppl && has('בשר','לקנות','כמה','כמות','מנה','מנות','אנשים','סועד')){
    const n=+ppl; const main=Math.round(n*0.35*10)/10, mix=Math.round(n*0.5*10)/10;
    return {t:`ל-<b>${n} סועדים</b> (הערכה): מנה עיקרית בשרית ~<b>${main} ק״ג</b> (350 ג׳/סועד), ובאירוע עם מגוון בשרים ותוספות ~${mix} ק״ג סה״כ. לכמות מדויקת לפי מנה — פתח את "בונה הארוחה".`,act:(typeof openMenu==='function'?openMenu:null)};
  }

  // ---- entity-based answers ----
  if(e && e.kind==='cut'){
    const c=e.obj;
    if(has('כמה זמן','זמן','משך','שעות','לעשן כמה','כמה לעשן','כמה שעות')){
      const t=askCutTimes(c); return {t:`<b>${c.heb}</b> — זמנים: ${t.join(' · ')}. יעד פנימי ${donenessTarget(c)}°C. הזמן תלוי-עובי ולא רק משקל — עבוד לפי טמפ׳ פנימית.`,chips:[link(e)]};
    }
    if(has('טמפ','חום','מעלות','°','degrees')){
      return {t:`<b>${c.heb}</b>: יעד פנימי ${donenessTarget(c)}°C${c.safe?` · בטיחות ${c.safe}°C`:''}. ${c.svt?`סו-ויד ${c.svt}°C · `:''}${c.smt?`עישון ${c.smt}°C · `:''}${c.sot?`עישון-בלבד ${c.sot}°C`:''}.`,chips:[link(e)]};
    }
    if(has('מידת','נא','מדיום','עשוי','rare','medium','done')){
      if(c.doneness){ const lv=c.doneness.levels; const list=Object.keys(lv).map(k=>`${lv[k].heb||k} ${lv[k].c}°C`).join(' · '); return {t:`<b>${c.heb}</b> — מידות עשייה: ${list}. בחר מידה במתכון והטמפ׳ מתעדכנת.`,chips:[link(e)]}; }
      return {t:`<b>${c.heb}</b>: יעד ${c.tgt}°C (אין סקאלת מידות עשייה לנתח זה — נתח שדורש בישול-מלא).`,chips:[link(e)]};
    }
    if(has('עץ','עצים','wood','לעשן עם','איזה עץ')){
      return {t:`<b>${c.heb}</b> — עץ מומלץ: <b>${c.wood||'אלון/היקורי'}</b>.${c.coal?` פחם: ${c.coal}.`:''} לפרטים על עוצמת עשן — מדריך העצים.`,chips:[link(e)],act:()=>openWoods(c.cat)};
    }
    if(has('תיבול','ראב','מרינד','רוטב','גלייז','לתבל','rub','season')){
      const s=(typeof seasoningsFor==='function')?seasoningsFor(c.cat,isProduce(c)).slice(0,6):[];
      return {t:`<b>${c.heb}</b> — ראב מובנה: ${c.rub||'מלח+פלפל'}. ${s.length?'תיבולים מתאימים נוספים (נבחרים בתוך המתכון):':'פתח את המתכון לבורר התיבול המלא.'}`,chips:[link(e)]};
    }
    if(has('בטיח','פסטור','בטוח','safe','טפיל')){
      return {t:`<b>${c.heb}</b>: טמפ׳ בטיחות ${c.safe||63}°C. זכור — בטיחות היא זמן×טמפ׳ במרכז הנתח, לא רק המספר. סו-ויד מנצל זאת (טמפ׳ נמוכה יותר לאורך זמן).${/דג|סלמון|טונה|פורל/.test(c.heb)?' לדג נא/חלקי — הקפאה מוקדמת נגד טפילים.':''}`,chips:[link(e)]};
    }
    if(has('איך','שיטה','סו-ויד','עישון','גריל','method')){
      const t=askCutTimes(c); return {t:`<b>${c.heb}</b> — שיטות: ${t.join(' · ')}. יעד ${donenessTarget(c)}°C. פתח את המתכון לצ׳קליסט וטיימרים.`,chips:[link(e)]};
    }
    // default: recipe summary
    const t=askCutTimes(c); return {t:`<b>${c.heb}</b> (${c.cat}): ${t.join(' · ')}. יעד ${donenessTarget(c)}°C${c.safe?` · בטיחות ${c.safe}°C`:''} · עץ ${c.wood||'—'}.`,chips:[link(e)]};
  }
  if(e && e.kind==='spec'){
    const s=e.obj;
    return {t:`<b>${s.heb}</b> (${s.cat}): ${s.cure?`ריפוי ${s.cure} · `:''}${s.smt?`עישון ${s.smt}°C/${s.smh}ש · `:''}${s.age?`יישון ${s.age} · `:''}עץ ${s.wood||'—'}.${s.note?` ${s.note}`:''}`,chips:[link(e)]};
  }
  if(e && e.kind==='make'){
    return {t:`<b>${e.heb}</b> — מתכון בנייה-מאפס. פתח לרשימת חומרים, מינון מלח/ריפוי ושלבים.`,chips:[link(e)]};
  }

  // ---- multiple weak matches ----
  if(ents.length){ return {t:`לא בטוח למה התכוונת. אולי אחד מאלה:`,chips:ents.slice(0,5).map(link)}; }

  // ---- no entity, general knowledge nudges ----
  if(has('הבדל','השוואה','vs','לעומת','מה עדיף')) return {t:'להשוואה — כתוב שני שמות (למשל "בריסקט מול שפונדרה"), או פתח את שני המתכונים מהקטלוג ליד זה מזה.'};
  return {t:'לא מצאתי התאמה. נסה: שם נתח + מה שמעניין ("כמה זמן לעשן צלעות", "טמפ׳ לסלמון", "עץ לחזה"), "כמה בשר ל-10 אנשים", "האם שרימפס כשר", או תיאור תקלה ("עשן מר").'};
}

/* ---- Ask the Fire: AI mode (BYOK Gemini) — optional layer over the local engine ---- */
function askMode(){ const v=store.get('mk-askai'); if(v==='1')return true; if(v==='0')return false; return gemKey()?true:false; } // default ON only if a key already exists (e.g. from TTS)
function setAskMode(on){ store.set('mk-askai', on?'1':'0'); }
function askContextFor(q){
  const ents=askFindEntity((q||'').toLowerCase()).slice(0,3);
  if(!ents.length) return {ctx:'',ents:[]};
  const ctx='נתונים רלוונטיים מהקטלוג של האפליקציה:\n'+ents.map(e=>{const o=e.obj;
    if(e.kind==='cut') return `• ${e.heb} (${e.cat}): סו-ויד ${o.svt}°C/${o.svh}ש · עישון ${o.smt}°C/${o.smh}ש · עישון-בלבד ${o.sot}°C/${o.soh}ש · יעד ${donenessTarget(o)}°C · בטיחות ${o.safe||63}°C · עץ ${o.wood||'-'} · ראב ${o.rub||'-'}${o.doneness?' · מידות: '+Object.entries(o.doneness.levels).map(([k,v])=>(v.heb||k)+' '+v.c+'°C').join('/'):''}`;
    if(e.kind==='spec') return `• ${e.heb} (${e.cat}): ריפוי ${o.cure||'-'} · עישון ${o.smt||'-'}°C/${o.smh||'-'}ש · יישון ${o.age||'-'} · עץ ${o.wood||'-'}${o.note?' · '+o.note:''}`;
    return `• ${e.heb} (${e.cat}): מתכון בנייה-מאפס.`;
  }).join('\n');
  return {ctx,ents:ents.map(m=>({key:m.key,heb:m.heb,cat:m.cat}))};
}
async function askGemini(qRaw, history){
  const key=gemKey(); if(!key) throw new Error('no-key');
  const q=(qRaw||'').trim();
  const {ctx,ents}=askContextFor(q);
  const sys='אתה "האש" — עוזר בישול מומחה לאש, עישון, גריל, סו-ויד ושרקוטרי, בתוך אפליקציה ישראלית בעברית בשם "מתכונת · מדריך האש". ענה תמיד בעברית, בצורה מלאה ומועילה — אורך התשובה לפי הצורך, כולל רשימות, המלצות ופירוט כשזה עוזר. יש לך חיפוש באינטרנט: השתמש בו לשאלות על מידע עדכני/מקומי — עסקים, חנויות, ספקים, מחירים, זמינות, כתובות (למשל "היכן לקנות פחם איכותי בשרון" — תן רשימת עסקים אמיתית עם פרטים). כשסופקו נתונים מהקטלוג של האפליקציה והם רלוונטיים — התבסס עליהם וצטט טמפ׳/זמנים משם. אתה יכול לענות גם על שאלות מעשיות סביב עולם הבישול על אש (ציוד, קניות, מקומות) ולא רק על מתכונים. אל תמציא מספרי בטיחות קריטיים — אם אינך בטוח, אמור זאת והפנה לאימות.';
  const turns=[];
  (history||[]).slice(-4).forEach(h=>turns.push({role:h.role==='ai'?'model':'user',parts:[{text:h.text}]}));
  turns.push({role:'user',parts:[{text:(ctx?ctx+'\n\n':'')+'שאלה: '+q}]});
  const body={
    system_instruction:{parts:[{text:sys}]},
    contents:turns,
    tools:[{google_search:{}}],
    generationConfig:{temperature:0.8,maxOutputTokens:1600,thinkingConfig:{thinkingBudget:0}}
  };
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json();
  const cand=j.candidates&&j.candidates[0];
  const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
  if(!txt){ const fr=(cand&&cand.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
  return {txt,chips:ents};
}
async function askValidateKey(key){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:'שלום'}]}],generationConfig:{maxOutputTokens:20,thinkingConfig:{thinkingBudget:0}}})});
  return r.ok;
}

/* ═══════════════════════════════════════════════════════════════════
   AI INFRASTRUCTURE LAYER (BYOK) — shared foundation for AI features.
   Contract (ai-prd.md): optional · grounded-only · never invents safety
   numbers · output→action · transparent · local-first.
   ═══════════════════════════════════════════════════════════════════ */

// A3 · availability gate
function aiAvail(){ return !!gemKey(); }

// strip ```json fences / stray prose around a JSON body
function aiStripFences(t){
  let s=String(t||'').trim();
  s=s.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=s.indexOf('{'), b=s.lastIndexOf('}'), c=s.indexOf('['), d=s.lastIndexOf(']');
  const objSpan=(a>=0&&b>a)?[a,b]:null, arrSpan=(c>=0&&d>c)?[c,d]:null;
  let span=null;
  if(objSpan&&arrSpan) span = objSpan[0]<arrSpan[0] ? objSpan : arrSpan;
  else span = objSpan||arrSpan;
  if(span) s=s.slice(span[0],span[1]+1);
  return s.trim();
}

const AI_JSON_SYS = 'אתה מנוע-עזר בתוך אפליקציית בישול-אש ישראלית. החזר אך ורק JSON תקין (בלי Markdown, בלי טקסט לפני או אחרי). '
  + 'בחר אך ורק מתוך רשימת המפתחות (keys) שסופקה — אל תמציא מפתחות, שמות פריטים או מזהים שאינם ברשימה. '
  + 'אל תמציא מספרי בטיחות, טמפרטורות-ריפוי או ימי-ייבוש — אם נדרש מספר כזה השמט אותו והאפליקציה תחשב. '
  + 'הקפד על מבנה ה-JSON המבוקש בדיוק. נימוקים בעברית וקצרים.';

// A5 · test seam
function aiMockActive(){ return typeof window!=='undefined' && window.__aiMock!==undefined && window.__aiMock!==null; }

// A1 · generic grounded JSON call
async function aiJSON(opts){
  const {task, schemaHint, grounding='', temperature=0.4, maxTokens=1200, search=false}=opts||{};
  if(aiMockActive()){ const m=window.__aiMock; return typeof m==='function' ? m(opts) : m; }
  const key=gemKey(); if(!key) throw new Error('no-key');
  const userText=(grounding?grounding+'\n\n':'')+'משימה: '+(task||'')+(schemaHint?('\n\nהחזר JSON במבנה הבא בדיוק:\n'+schemaHint):'');
  const mkBody=()=>({
    system_instruction:{parts:[{text:AI_JSON_SYS}]},
    contents:[{role:'user',parts:[{text:userText}]}],
    tools: search?[{google_search:{}}]:undefined,
    generationConfig:{temperature,maxOutputTokens:maxTokens,thinkingConfig:{thinkingBudget:0},responseMimeType:'application/json'}
  });
  const callOnce=async(body)=>{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok) throw new Error('api-'+r.status);
    const j=await r.json();
    const cand=j.candidates&&j.candidates[0];
    const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
    if(!txt){ const fr=(cand&&cand.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
    return txt;
  };
  let raw;
  try{ raw=await callOnce(mkBody()); }
  catch(e){ if(String(e.message).startsWith('api-4')||String(e.message).startsWith('empty-')){ raw=await callOnce(mkBody()); } else throw e; }
  try{ return JSON.parse(aiStripFences(raw)); }
  catch(_){ try{ return JSON.parse(aiStripFences(raw.replace(/[\u0000-\u001F]+/g,' '))); }catch(e2){ throw new Error('bad-json'); } }
}

// A2 · grounding enforcement — every AI-returned key MUST pass here
function aiValidateKeys(keys){
  const valid = (typeof cwAllItems==='function') ? new Set(cwAllItems().map(i=>i.key)) : new Set();
  const kept=[], dropped=[];
  (Array.isArray(keys)?keys:[]).forEach(k=>{ if(valid.has(k)) kept.push(k); else dropped.push(k); });
  if(dropped.length && typeof console!=='undefined') console.warn('[AI] dropped invalid keys:',dropped);
  return {kept, dropped};
}
function aiValidateItems(arr){
  const valid = (typeof cwAllItems==='function') ? new Set(cwAllItems().map(i=>i.key)) : new Set();
  const seen=new Set(); const kept=[], dropped=[];
  (Array.isArray(arr)?arr:[]).forEach(o=>{ const k=o&&o.key; if(k&&valid.has(k)&&!seen.has(k)){ seen.add(k); kept.push(o); } else dropped.push(o); });
  if(dropped.length && typeof console!=='undefined') console.warn('[AI] dropped invalid items:',dropped.length);
  return {kept, dropped};
}

// A4 · uniform AI-result confirmation panel (output→action, transparency)
let _aiApply=null;
function aiConfirmPanel(o){
  o=o||{}; _aiApply=o.onApply||null;
  showPanel(`${toolTop(o.title||'הצעת AI', o.sub||'✨ נוצר ע\u05f4י AI · בדוק לפני החלה','✨','#1a9a7a')}
    <div class="panel-body">
      <div class="ai-badge">✨ נוצר ע\u05f4י AI — ניתן לעריכה וביטול</div>
      <div id="aiCpBody">${o.bodyHTML||''}</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="ccta" id="aiCpApply" style="margin:0;flex:1">${o.applyLabel||'✓ החל'}</button>
        <button class="ccta ghostc" id="aiCpCancel" style="margin:0;flex:1;background:none;border:1.5px solid var(--smoke);color:var(--smoke)">בטל</button>
      </div>
    </div>`);
  const pa=$("#aiCpApply"); if(pa) pa.addEventListener('click',()=>{ const fn=_aiApply; _aiApply=null; if(typeof fn==='function') fn(); });
  const pc=$("#aiCpCancel"); if(pc) pc.addEventListener('click',()=>{ _aiApply=null; if(typeof closePanel==='function') closePanel(); });
}

function openAsk(){
  const examples=['כמה זמן לעשן צלעות','טמפ׳ לסלמון','איזה עץ לחזה','כמה בשר ל-10 אנשים','היכן לקנות פחם איכותי בשרון','עשן יצא מר'];
  const aiOn=askMode(), hasKey=!!gemKey();
  const hist=[]; // {role:'user'|'ai', text, src}
  showPanel(`${toolTop('שאל את האש','עוזר בישול — מנוע מקומי או AI','🔥','#e85c1c')}
   <div class="panel-body">
     <div class="ask-mode">
       <button class="ask-modebtn ${!aiOn?'on':''}" data-askmode="local">⚡ מנוע מקומי</button>
       <button class="ask-modebtn ${aiOn?'on':''}" data-askmode="ai">🤖 AI חכם${hasKey?'':' <span class="ask-lock">🔑</span>'}</button>
     </div>
     <div id="askthread" class="askthread"></div>
     <div class="askex" id="askex">${examples.map(x=>`<button class="askex-chip" data-ex="${x}">${x}</button>`).join('')}</div>
     <div class="askrow"><input id="askq" placeholder="שאל שאלה…" autocomplete="off"><button id="askgo">שאל</button><button id="askclear" class="askclear" title="שיחה חדשה" hidden>🗑</button></div>
     <div id="askhint" class="ask-hint">${aiOn?(hasKey?'🤖 מצב AI פעיל — תשובות חופשיות עם חיפוש באינטרנט, מעוגנות בקטלוג. <button class="ask-link" data-askmode="disc">נתק מפתח</button>':'🤖 מצב AI נבחר — צריך לחבר מפתח חינמי (חד-פעמי).'):'⚡ מנוע מקומי — מיידי, פרטי, בלי רשת. עונה מעל נתוני הקטלוג שלך.'}</div>
   </div>`);
  const pnl=$("#panel"), thread=$("#askthread");
  const badge=src=>src==='ai'?'<span class="ask-src ai">🤖 AI</span>':'<span class="ask-src loc">⚡ מקומי</span>';
  const scrollDown=()=>{ thread.scrollTop=thread.scrollHeight; };
  function wireChips(el){ el.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{const m=resolveItem(b.dataset.k);m.kind==='cut'?openCut(m.obj):m.kind==='spec'?openSpec(m.obj):openMake(m.key.slice(5));})); }
  function addUser(q){ const d=document.createElement('div'); d.className='ask-q'; d.textContent=q; thread.appendChild(d); scrollDown(); }
  function addAnswer(html){ const d=document.createElement('div'); d.className='ask-a'; d.innerHTML=html; thread.appendChild(d); wireChips(d); scrollDown(); return d; }
  function localHTML(r){ const body=(typeof r==='string')?r:r.t; let h=`<div class="abubble">${badge('local')}${body}</div>`;
    if(r&&r.chips&&r.chips.length) h+=`<div class="askchips">`+r.chips.map(m=>`<button class="askhit" data-k="${m.key}">${m.heb} · ${m.cat} ▶</button>`).join("")+`</div>`;
    return h; }
  async function go(){
    const q=($("#askq").value||'').trim(); if(!q) return;
    $("#askq").value=''; $("#askex").hidden=true; $("#askclear").hidden=false;   // clear input + hide examples after first Q
    addUser(q); hist.push({role:'user',text:q});
    if(askMode()){
      if(!gemKey()){ askConnect(); return; }
      const load=addAnswer(`<div class="abubble ask-loading">${badge('ai')}<span class="ask-dots">האש חושב<b>.</b><b>.</b><b>.</b></span></div>`);
      try{ const r=await askGemini(q, hist);
        load.innerHTML=`<div class="abubble">${badge('ai')}${esc(r.txt||'').replace(/\n/g,'<br>')}</div>`;
        if(r.chips&&r.chips.length){ load.innerHTML+=`<div class="askchips">`+r.chips.map(m=>`<button class="askhit" data-k="${m.key}">${m.heb} · ${m.cat} ▶</button>`).join("")+`</div>`; wireChips(load); }
        hist.push({role:'ai',text:r.txt||''}); scrollDown();
      }catch(err){ const code=String(err.message||err);
        const why = code.includes('api-4') ? 'מפתח שגוי או חריגת מכסה' : code.startsWith('empty') ? 'ה-AI לא החזיר תשובה' : code.includes('no-key') ? 'אין מפתח מחובר' : 'אין חיבור לרשת';
        const local=askFire(q);
        load.innerHTML=`<div class="abubble ask-aifail">🤖 ${why}. הנה תשובת המנוע המקומי:</div>`+localHTML(local); wireChips(load);
        if(local&&local.act){const btn=document.createElement('button');btn.className='askhit askhit-act';btn.textContent='פתח ▶';btn.addEventListener('click',local.act);load.appendChild(btn);}
        hist.push({role:'ai',text:why}); scrollDown();
      }
    } else {
      const local=askFire(q); const d=addAnswer(localHTML(local));
      if(local&&local.act){const btn=document.createElement('button');btn.className='askhit askhit-act';btn.textContent='פתח ▶';btn.addEventListener('click',local.act);d.appendChild(btn);}
      hist.push({role:'ai',text:(typeof local==='string')?local:local.t});
    }
    $("#askq").focus();
  }
  $("#askgo").addEventListener('click',go);
  $("#askq").addEventListener('keydown',e=>{if(e.key==='Enter')go();});
  $("#askclear").addEventListener('click',()=>{ hist.length=0; thread.innerHTML=''; $("#askex").hidden=false; $("#askclear").hidden=true; $("#askq").value=''; $("#askq").focus(); });
  pnl.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>{ $("#askq").value=b.dataset.ex; go(); }));
  pnl.querySelectorAll('[data-askmode]').forEach(b=>b.addEventListener('click',()=>{
    const m=b.dataset.askmode;
    if(m==='local'){ setAskMode(false); openAsk(); }
    else if(m==='ai'){ setAskMode(true); if(gemKey()) openAsk(); else askConnect(); }
    else if(m==='disc'){ appConfirm('לנתק את מפתח ה-AI? (משפיע גם על הקראה קולית)',{okLabel:'נתק',danger:true}).then(y=>{ if(y===true){ store.set('mk-gemkey',''); setAskMode(false); openAsk(); } }); }
  }));
  $("#askq").focus();
}
// guided, minimal key-connect wizard (reuses mk-gemkey — one key powers AI + voice)
function askConnect(){
  showPanel(`${toolTop('חיבור AI חכם','מפתח Gemini חינמי · חד-פעמי · ~2 דקות','🔑','#e07a52')}
   <div class="panel-body">
     <div class="akc-step"><span class="akc-n">1</span><div><b>פתח את Google AI Studio</b><p>צור מפתח חינמי (דורש חשבון Google).</p><a class="akc-open" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">פתח את AI Studio ←</a></div></div>
     <div class="akc-step"><span class="akc-n">2</span><div><b>לחץ "Create API key" והעתק</b><p>המפתח נראה כמו רצף ארוך של אותיות ומספרים.</p></div></div>
     <div class="akc-step"><span class="akc-n">3</span><div><b>הדבק כאן וחבר</b>
        <div class="akc-keyrow"><input type="password" id="akcKey" placeholder="הדבק מפתח API…" autocomplete="off"><button id="akcSave">חבר</button></div>
        <div id="akcMsg" class="akc-msg"></div>
     </div></div>
     <p class="akc-note">🔒 המפתח נשמר <b>רק במכשיר שלך</b> ונשלח ישירות ל-Google בלבד. אפשר לנתק בכל רגע.</p><p class="akc-note" style="margin-top:8px">💡 <b>שאל את האש (AI)</b> עובד חינם. <b>הקראה קולית (TTS)</b> היא מודל בתשלום אצל Google — דורש הפעלת <b>Billing</b> בפרויקט (יש מכסה חינמית נדיבה גם אז). בלי חיוב, ההקראה תשתמש בקול המערכת.</p>
     <button class="akc-back" id="akcBack">→ חזרה ל"שאל את האש"</button>
   </div>`);
  const msg=$("#akcMsg");
  $("#akcSave").addEventListener('click',async()=>{
    const k=($("#akcKey").value||'').trim();
    if(k.length<20){ msg.className='akc-msg err'; msg.textContent='מפתח קצר מדי — ודא שהעתקת את כולו.'; return; }
    msg.className='akc-msg'; msg.textContent='בודק את המפתח…';
    try{ const ok=await askValidateKey(k);
      if(ok){ store.set('mk-gemkey',k); setAskMode(true); msg.className='akc-msg ok'; msg.textContent='✓ מחובר! פותח…'; setTimeout(openAsk,700); }
      else { msg.className='akc-msg err'; msg.textContent='המפתח לא התקבל. ודא שיצרת מפתח ל-Gemini API ושהעתקת נכון.'; }
    }catch(e){ msg.className='akc-msg err'; msg.textContent='שגיאת רשת — נסה שוב כשיש חיבור.'; }
  });
  $("#akcBack").addEventListener('click',openAsk);
  $("#akcKey").focus();
}
// permanent AI-key management — always accessible (☰ settings). Shows status when connected.
function openKeyManager(){
  const key=gemKey();
  if(!key){ askConnect(); return; }
  const masked=key.length>8?key.slice(0,4)+'••••••'+key.slice(-4):'••••••';
  showPanel(`${toolTop('ניהול מפתח AI','מפתח אחד מפעיל AI + הקראה קולית','🔑','#e07a52')}
   <div class="panel-body">
     <div class="akm-status"><span class="akm-dot"></span><div><b>מחובר</b><p>מפתח פעיל: <code>${masked}</code></p></div></div>
     <div id="akmMsg" class="akc-msg"></div>
     <button class="akm-btn" id="akmTest">🧪 בדוק שהמפתח עובד</button>
     <button class="akm-btn" id="akmReplace">🔁 החלף מפתח</button>
     <button class="akm-btn akm-danger" id="akmOff">🔌 נתק מפתח</button>
     <p class="akc-note">🔒 המפתח נשמר <b>רק במכשיר שלך</b> ונשלח ישירות ל-Google בלבד. ניתוק יחזיר את AI ואת ההקראה למצב מקומי.</p><p class="akc-note" style="margin-top:8px">💡 <b>AI טקסטואלי</b> חינמי. <b>הקראה קולית (TTS)</b> דורשת הפעלת <b>Billing</b> בפרויקט ב-Google AI Studio — אחרת תופיע שגיאת מכסה/הרשאה וההקראה תעבור לקול המערכת.</p>
     <button class="akc-back" id="akmBack">→ חזרה</button>
   </div>`);
  const msg=$("#akmMsg");
  $("#akmTest").addEventListener('click',async()=>{
    msg.className='akc-msg'; msg.textContent='בודק…';
    try{ const ok=await askValidateKey(gemKey()); msg.className='akc-msg '+(ok?'ok':'err'); msg.textContent=ok?'✓ המפתח תקין ופעיל.':'✗ המפתח נדחה — כדאי להחליף.'; }
    catch(e){ msg.className='akc-msg err'; msg.textContent='שגיאת רשת — נסה שוב כשיש חיבור.'; }
  });
  $("#akmReplace").addEventListener('click',askConnect);
  $("#akmOff").addEventListener('click',async()=>{ if((await appConfirm('לנתק את מפתח ה-AI? (משפיע גם על ההקראה הקולית)',{okLabel:'נתק',danger:true}))!==true) return; store.set('mk-gemkey',''); setAskMode(false); if(typeof gemCache!=='undefined')gemCache.clear(); toast('המפתח נותק'); openKeyManager(); });
  $("#akmBack").addEventListener('click',openAsk);
}

/* ---- event menu builder ---- */
/* sides & drinks knowledge for pairing */
const SIDES=[
  {n:"פיתה / לאפה / לחם כפרי",t:["בקר","עוף","טלה","שווארמה","צלייה טחונה","נקניקיות","נקניק מעושן","BBQ קלאסי","פסטרמה"]},
  {n:"סלט ישראלי קצוץ",t:["*"]},
  {n:"קולסלו (כרוב)",t:["בקר","עוף","BBQ קלאסי","נקניק מעושן","נקניקיות"]},
  {n:"תפוחי אדמה בתנור / צ׳יפס",t:["בקר","עוף","טלה","BBQ קלאסי","נקניקיות"]},
  {n:"תירס קלוי בחמאה",t:["בקר","עוף","BBQ קלאסי","נקניקיות","צלייה טחונה"]},
  {n:"אורז / ממליגה",t:["טלה","עוף","צלייה טחונה","נקניק מעושן"]},
  {n:"צ׳ימיצ׳ורי",t:["בקר","טלה","צלייה טחונה","BBQ קלאסי"]},
  {n:"טחינה",t:["טלה","עוף","שווארמה","צלייה טחונה"]},
  {n:"חומוס",t:["שווארמה","עוף","טלה","צלייה טחונה"]},
  {n:"חמוצים / מלפפון חמוץ",t:["שווארמה","נקניק מעושן","נקניק מיובש","סלומי","פסטרמה","בקר"]},
  {n:"בצל סגול בסומק",t:["טלה","שווארמה","צלייה טחונה","בקר"]},
  {n:"שעועית BBQ",t:["בקר","BBQ קלאסי","נקניק מעושן"]},
  {n:"מאק אנד צ׳יז",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"לחם כפרי + חרדל + זיתים",t:["סלומי","נקניק מיובש","פסטרמה","גבינה"]},
  {n:"ריבה/דבש + אגוזים",t:["סלומי","גבינה","נקניק מיובש"]},
  {n:"לימון + עשבי תיבול",t:["דג","דג מעושן","פירות ים"]},
  {n:"סלט עלים ירוק",t:["דג","דג מעושן","סלומי","גבינה","עוף"]},
  // — הרחבה —
  {n:"ירקות שורש צלויים בגריל",t:["בקר","טלה","עוף","BBQ קלאסי","נקניק מעושן"]},
  {n:"פוקצ׳ה / לחם שום",t:["בקר","גבינה","סלומי","נקניק מיובש","BBQ קלאסי"]},
  {n:"בטטה בתנור / צ׳יפס בטטה",t:["בקר","עוף","BBQ קלאסי","טלה"]},
  {n:"באבא גנוש (חצילים שרופים)",t:["טלה","שווארמה","עוף","צלייה טחונה"]},
  {n:"מטבוחה / סלט חצילים חריף",t:["טלה","שווארמה","בקר","צלייה טחונה"]},
  {n:"טאבולה (בורגול ופטרוזיליה)",t:["טלה","עוף","שווארמה","דג"]},
  {n:"סלט תפוחי אדמה",t:["נקניקיות","נקניק מעושן","BBQ קלאסי","בקר"]},
  {n:"כרוב כבוש (זאוארקראוט)",t:["נקניקיות","נקניק מעושן","נקניק מיובש"]},
  {n:"פטריות בגריל בחמאת שום",t:["בקר","טלה","BBQ קלאסי","עוף"]},
  {n:"קורנברד (לחם תירס)",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"גזר צלוי בדבש וכמון",t:["טלה","עוף","דג"]},
  {n:"גוואקמולה / אבוקדו",t:["בקר","עוף","נקניקיות","BBQ קלאסי"]},
  {n:"סלסת עגבניות טרייה (פיקו דה גאיו)",t:["בקר","עוף","נקניקיות","BBQ קלאסי"]},
  {n:"לימון כבוש / ארטישוק",t:["דג","דג מעושן","פירות ים","עוף"]},
  {n:"רוטב חמאת שום-לימון",t:["פירות ים","דג","עוף"]}
];
const DRINKS=[
  // — רכה —
  {n:"לימונדה / מי גזוז",k:"soft",sub:"soft",t:["*"]},
  {n:"תה קר (אייס-טי)",k:"soft",sub:"soft",t:["BBQ קלאסי","בקר","עוף","נקניקיות"]},
  {n:"סודה / מים מוגזים בטעמים",k:"soft",sub:"soft",t:["*"]},
  {n:"קולה / משקה קל",k:"soft",sub:"soft",t:["BBQ קלאסי","בקר","נקניקיות","נקניק מעושן"]},
  {n:"מיץ רימונים / ענבים",k:"soft",sub:"soft",t:["טלה","שווארמה","צלייה טחונה"]},
  {n:"לימונדה נענע",k:"soft",sub:"soft",t:["*"]},
  {n:"ג׳ינג׳ר-אייל ביתי",k:"soft",sub:"soft",t:["בקר","עוף","דג","פירות ים"]},
  {n:"קומבוצ׳ה",k:"soft",sub:"soft",t:["דג","גבינה","עוף","סלומי"]},
  {n:"מוחיטו וירג׳ין (ללא אלכוהול)",k:"soft",sub:"soft",t:["פירות ים","דג","עוף"]},
  {n:"קפה קר / אספרסו טוניק",k:"soft",sub:"soft",t:["גבינה","סלומי","נקניק מיובש"]},
  {n:"איראן / משקה יוגורט",k:"soft",sub:"soft",t:["טלה","שווארמה","צלייה טחונה"]},
  // — בירה —
  {n:"בירה לאגר קרה",k:"alc",sub:"beer",t:["בקר","עוף","נקניקיות","נקניק מעושן","צלייה טחונה","שווארמה","טלה"]},
  {n:"בירה כהה (סטאוט/פורטר)",k:"alc",sub:"beer",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"בירת IPA",k:"alc",sub:"beer",t:["BBQ קלאסי","נקניק מעושן","בקר"]},
  {n:"בירת חיטה (וייצן)",k:"alc",sub:"beer",t:["עוף","נקניקיות","דג","פירות ים"]},
  {n:"פילזנר",k:"alc",sub:"beer",t:["נקניקיות","עוף","דג","פירות ים"]},
  {n:"אמבר אייל",k:"alc",sub:"beer",t:["בקר","BBQ קלאסי","נקניק מעושן","טלה"]},
  {n:"סאוור / גוזה",k:"alc",sub:"beer",t:["דג","פירות ים","גבינה","עוף"]},
  // — יין —
  {n:"יין אדום יבש",k:"alc",sub:"wine",t:["בקר","טלה","סלומי","נקניק מיובש","פסטרמה","BBQ קלאסי","צלייה טחונה"]},
  {n:"יין לבן / רוזה מצונן",k:"alc",sub:"wine",t:["דג","דג מעושן","פירות ים","עוף","גבינה","סלומי"]},
  {n:"יין מבעבע / קאווה",k:"alc",sub:"wine",t:["פירות ים","דג","גבינה","עוף"]},
  {n:"פורט / יין מתוק",k:"alc",sub:"wine",t:["גבינה","נקניק מיובש","סלומי"]},
  // — שתייה חריפה —
  {n:"וויסקי / בורבון",k:"alc",sub:"spirit",t:["BBQ קלאסי","בקר","נקניק מעושן","טלה"]},
  {n:"סינגל מאלט סקוטי (מעושן)",k:"alc",sub:"spirit",t:["BBQ קלאסי","בקר","נקניק מעושן","גבינה"]},
  {n:"ערק עם נענע וקרח",k:"alc",sub:"spirit",t:["טלה","שווארמה","צלייה טחונה","עוף"]},
  {n:"טקילה / מסקל",k:"alc",sub:"spirit",t:["בקר","BBQ קלאסי","עוף","נקניקיות"]},
  {n:"רום כהה / רום מיושן",k:"alc",sub:"spirit",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"ג׳ין (נקי/עם טוניק)",k:"alc",sub:"spirit",t:["דג","פירות ים","עוף","גבינה"]},
  {n:"וודקה מצוננת",k:"alc",sub:"spirit",t:["דג מעושן","פירות ים","דג"]},
  {n:"קוניאק / ברנדי",k:"alc",sub:"spirit",t:["גבינה","נקניק מיובש","בקר"]},
  {n:"גראפה / עראק איטלקי",k:"alc",sub:"spirit",t:["סלומי","נקניק מיובש","גבינה"]},
  // — קוקטיילים —
  {n:"אולד פאשנד (וויסקי)",k:"alc",sub:"cocktail",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"נגרוני",k:"alc",sub:"cocktail",t:["סלומי","נקניק מיובש","בקר","גבינה"]},
  {n:"וויסקי סאוּר",k:"alc",sub:"cocktail",t:["BBQ קלאסי","בקר","עוף"]},
  {n:"מרגריטה (טקילה)",k:"alc",sub:"cocktail",t:["בקר","עוף","נקניקיות","פירות ים"]},
  {n:"מוחיטו (רום)",k:"alc",sub:"cocktail",t:["פירות ים","דג","עוף","נקניקיות"]},
  {n:"מנהטן",k:"alc",sub:"cocktail",t:["בקר","נקניק מעושן","BBQ קלאסי"]},
  {n:"בולברדייה",k:"alc",sub:"cocktail",t:["בקר","סלומי","נקניק מיובש"]},
  {n:"פאלומה (טקילה-אשכולית)",k:"alc",sub:"cocktail",t:["עוף","פירות ים","נקניקיות","דג"]},
  {n:"מסקל סמוקי (עם עשן)",k:"alc",sub:"cocktail",t:["BBQ קלאסי","בקר","נקניק מעושן"]}
];
// ── desserts (fire + classics) + seasonal fresh fruit ──
const DESSERTS=[
  {n:"אננס צלוי בקרמל",fire:1,t:["*"]},
  {n:"אפרסק / משמש על הגריל",fire:1,t:["*"]},
  {n:"בננה בקליפה עם שוקולד",fire:1,t:["*"]},
  {n:"תאנים צלויות בדבש",fire:1,t:["*"]},
  {n:"אבטיח חרוך על האש",fire:1,t:["*"]},
  {n:"מרשמלו / סמורז",fire:1,t:["*"]},
  {n:"מלבי",t:["*"]},
  {n:"קרם ברולה",t:["*"]},
  {n:"טירמיסו",t:["*"]},
  {n:"פאבלובה",t:["*"]},
  {n:"עוגת שוקולד חמה",t:["*"]},
  {n:"גלידה / סורבה",t:["*"]},
  {n:"קנאפה",t:["*"]},
  {n:"סחלב חם",t:["*"]}
];
const SEASONAL_FRUIT={
  אביב:["תות","אפרסק","ענבים","משמש","שסק"],
  קיץ:["אבטיח","מלון","ענבים","נקטרינה","שזיף","תאנה","מנגו"],
  סתיו:["רימון","תאנה","ענבים","חבוש","אפרסמון","גויאבה"],
  חורף:["תפוז / קלמנטינה","פומלה","תפוח","אגס","אפרסמון","קיווי"]
};
function seasonForMonth(m){ if(m>=3&&m<=5) return 'אביב'; if(m>=6&&m<=8) return 'קיץ'; if(m>=9&&m<=11) return 'סתיו'; return 'חורף'; }
// season by EVENT date if set, otherwise current month
function eventSeason(){ let d=new Date(); try{ const s=menuState(); if(s&&s.evDate){ const dd=new Date(s.evDate); if(!isNaN(dd.getTime())) d=dd; } }catch(e){} return seasonForMonth(d.getMonth()+1); }
function seasonalFruitList(){ return SEASONAL_FRUIT[eventSeason()]||[]; }
// per-guest quantity for a side/drink/dessert/fruit → human string
function eventQty(name, kind, guests){
  const g=Math.max(1,guests||1);
  if(kind==='side') return `~${(g*0.175).toFixed(1)} ק״ג`;
  if(kind==='dessert') return `~${g} מנות`;
  if(kind==='fruit') return `~${(g*0.15).toFixed(1)} ק״ג`;
  if(kind==='drink'){
    const d=DRINKS.find(x=>x.n===name); const sub=d?d.sub:'soft';
    if(sub==='soft') return `~${Math.ceil(g*0.5/1.5)} בקבוקי 1.5 ל׳`;
    if(sub==='beer') return `~${g*2}–${g*3} בקבוקים`;
    if(sub==='wine') return `~${Math.ceil(g/2.5)} בקבוקים`;
    return `~${g*2}–${g*3} מנות`; // spirit/cocktail
  }
  return '';
}
function menuCats(keys){const s=new Set();keys.forEach(k=>{const m=resolveItem(k);if(m)s.add(m.cat);});return s;}
function recipesInCat(cat,kosherOnly){
  let l=[];
  DATA.cuts.forEach(c=>{if(c.cat===cat)l.push('cut-'+c.n);});
  Object.keys(DATA.makes).forEach(id=>{if(DATA.makes[id].cat===cat)l.push('make-'+id);});
  DATA.specials.forEach(x=>{if(x.cat===cat)l.push('spec-'+x.n);});
  if(kosherOnly) l=l.filter(isKosherOk);
  return l;
}
function allMenuCats(){const s=new Set();DATA.cuts.forEach(c=>s.add(c.cat));Object.values(DATA.makes).forEach(m=>s.add(m.cat));DATA.specials.forEach(x=>s.add(x.cat));return [...s];}
function pairList(kind,cats){
  const src=kind==='side'?SIDES:DRINKS.filter(d=>d.k===kind);
  const sc=d=>d.t.includes('*')?1:d.t.filter(x=>cats.has(x)).length;
  return src.map(d=>({d,s:sc(d)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.d.n);
}
// ── active context: 'event' (mk-menu) vs 'cook' (mk-cook) — separate cooking routes ──
function menuCtx(){ const c=store.get('mk-context'); return c==='cook'?'cook':'event'; }
function setMenuCtx(c){ store.set('mk-context', c==='cook'?'cook':'event'); }
function menuKey(){ return menuCtx()==='cook'?'mk-cook':'mk-menu'; }
function menuState(){return store.get(menuKey())||{guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};}
function saveMenu(s){ if(s&&Array.isArray(s.keys)) s.keys=[...new Set(s.keys)]; store.set(menuKey(),s); }
function gpp(a){return {light:200,reg:280,heavy:380}[a]||280;}  // cooked g/guest, aggregate for whole meal
function dishYield(m){return m.kind==='cut'?(m.obj.tgt>=88?0.6:0.72):0.82;}
function presetMenu(style){
  const s=menuState();
  const pick=cat=>{const l=recipesInCat(cat,s.kosher);return l.length?l[Math.floor(Math.random()*l.length)]:null;};
  const map={'מנגל מעורב':['בקר','עוף','צלייה טחונה','נקניקיות'],'שרקוטרי':['סלומי','נקניק מיובש','פסטרמה','גבינה'],'נקניקיות':['נקניקיות','נקניק מעושן','צלייה טחונה','בקר'],'דגים':['דג','דג מעושן','עוף']};
  s.keys=(map[style]||[]).map(pick).filter(Boolean);saveMenu(s);renderMenu();
}
function presetFromFavs(){const s=menuState();let f=[...favs];if(s.kosher)f=f.filter(isKosherOk);s.keys=f.slice(0,8);saveMenu(s);renderMenu();}
function presetFromCart(){
  const s=menuState();
  let items=[...cart].filter(k=>resolveItem(k));            // only valid dishes
  if(s.kosher) items=items.filter(isKosherOk);
  const before=s.keys.length;
  items.forEach(k=>{ if(!s.keys.includes(k)) s.keys.push(k); }); // merge, no duplicates
  const added=s.keys.length-before;
  saveMenu(s); renderMenu();
  toast(items.length? (added?`${added} כרטיסיות מסומנות (✓) נוספו לתפריט`:'כל המסומנות כבר בתפריט')
                    : 'אין כרטיסיות מסומנות — סמן נתחים עם ＋ בכרטיסים');
}
function swapDish(i){const s=menuState();const cur=s.keys[i];const m=resolveItem(cur);if(!m)return;const cands=recipesInCat(m.cat,s.kosher).filter(k=>k!==cur&&!s.keys.includes(k));if(cands.length){s.keys[i]=cands[Math.floor(Math.random()*cands.length)];saveMenu(s);renderMenu();}}
function copyText(t){try{if(navigator.clipboard)navigator.clipboard.writeText(t);toast('הרשימה הועתקה ✓');}catch(e){toast('הועתק');}}
function resetMenu(){
  const prev=menuState();
  const fresh={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};
  if(typeof menuCtx==='function' && menuCtx()==='event'){ fresh.evName=prev.evName||''; fresh.evDesc=prev.evDesc||''; fresh.evDate=prev.evDate||''; }
  saveMenu(fresh);                       // writes to the ACTIVE context (mk-menu or mk-cook)
  store.set('mk-menuqty',{});
  renderMenu();
  const label=(typeof menuCtx==='function'&&menuCtx()==='cook')?'הבישול אופס':'התפריט אופס — תפריט חדש';
  toast(label,()=>{ saveMenu(prev); renderMenu(); });
}
function openMenu(){
  showPanel(`${toolTop('בונה תפריט לאירוח','מנות, תוספות, שתייה, כמויות וזמנים','🎉','#b9772f')}
   <div class="panel-body" id="menuBody"></div>`);
  renderMenu();
}
// standalone printable menu — no full builder, returns to caller screen on close
function openMenuPrint(){
  const s=menuState();
  if(!s.keys||!s.keys.length){ if(typeof toast==='function') toast('אין מנות להדפסה'); return; }
  const basePerGuest=(s.gpm&&s.gpm>0)?s.gpm:gpp(s.appetite);
  const budget=basePerGuest*(s.guests||8); const n=s.keys.length; let totalRaw=0;
  const lines=s.keys.map(k=>{const m=resolveItem(k); if(!m) return ''; const raw=(budget/n)/dishYield(m); totalRaw+=raw; return `<li>${m.heb} — ~${(raw/1000).toFixed(1)} ק״ג נא</li>`;}).join('');
  const appName={light:'קל',reg:'רגיל',heavy:'כבד'}[s.appetite]||'רגיל';
  const serve=store.get('mk-tlserve')||'19:00'; const evName=s.evName||'';
  const menuHTML=`<div class="menuprint" style="display:block">
    <h2 style="font-family:'Suez One'">${evName?evName+' · ':''}תפריט · ${s.guests||8} אורחים</h2>
    <h4>מנות עיקריות</h4><ul>${lines}</ul>
    ${(s.sides||[]).length?`<h4>תוספות</h4><ul>${s.sides.map(x=>`<li>${x} <small>(${eventQty(x,'side',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${(s.drinks||[]).length?`<h4>שתייה</h4><ul>${s.drinks.map(x=>`<li>${x} <small>(${eventQty(x,'drink',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${(s.desserts||[]).length?`<h4>קינוחים</h4><ul>${s.desserts.map(x=>x==='__fruit'?`<li>מגש פירות העונה (${eventSeason()}: ${seasonalFruitList().join(', ')}) <small>(${eventQty('','fruit',s.guests)})</small></li>`:`<li>${x} <small>(${eventQty(x,'dessert',s.guests)})</small></li>`).join("")}</ul>`:''}
    <p><b>סה״כ בשר נא משוער: ~${(totalRaw/1000).toFixed(1)} ק״ג</b> · תיאבון ${appName} · הגשה ${serve}</p>
  </div>`;
  showPanel(`${toolTop('הדפסת תפריט',evName||'תפריט האירוע','🖨️','#cf6a4a')}
    <div class="panel-body" id="menuBody">
      <p class="section-sub" style="margin:0 0 12px">תצוגה מקדימה של התפריט. לחץ "הדפס" כשתהיה מוכן.</p>
      ${menuHTML}
      <button class="prbtn" style="position:static;margin-top:16px" data-print>⎙ הדפס / שמור PDF</button>
    </div>`);
  const p=$("#panel"); if(p) p.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
}
function renderMenu(){
  const host=$("#menuBody"); if(!host) return;
  const s=menuState();
  const cats=menuCats(s.keys);
  const n=s.keys.length||1;
  const basePerGuest = (s.gpm&&s.gpm>0)? s.gpm : gpp(s.appetite);   // cooked g/guest
  const sidesFactor = s.sides.length? 0.75 : 1;                       // sides fill plates → less meat
  const perGuest = basePerGuest * sidesFactor;
  const budget = s.guests * perGuest;
  let totalRaw=0;
  const qtyMap={};
  const dish=s.keys.map((k,i)=>{
    const m=resolveItem(k); if(!m) return ['',0];
    const raw=(budget/n)/dishYield(m); totalRaw+=raw; qtyMap[k]=Math.round(raw);
    return [`<div class="mdish"><div class="md-main"><span class="si-cat" style="color:${catColor(m.cat)}">${m.cat} ${kosherTag(k)}</span><b>${m.heb}</b><small>~${(raw/1000).toFixed(1)} ק״ג נא</small></div><div class="md-act"><button data-mswap="${i}" aria-label="החלף">↻</button><button data-mrm="${i}" aria-label="הסר">✕</button></div></div>`, raw];
  });
  store.set('mk-menuqty', qtyMap);   // flows into the shopping list
  const rawPerGuest = s.keys.length? Math.round(totalRaw/s.guests) : 0;
  const dishRows=dish.map(d=>d[0]).join("");
  const sides=pairList('side',cats), soft=pairList('soft',cats), alc=pairList('alc',cats);
  const appName={light:'קל',reg:'רגיל',heavy:'כבד'}[s.appetite];
  const chip=(name,on,attr)=>`<button class="mchip ${on?'on':''}" ${attr}="${name}">${on?'✓ ':''}${name}</button>`;
  const printHtml=`<div class="menuprint">
    <h2 style="font-family:'Suez One'">תפריט · ${s.guests} אורחים</h2>
    <h4>מנות עיקריות</h4><ul>${s.keys.map((k,i)=>{const m=resolveItem(k);return m?`<li>${m.heb} — ~${(dish[i][1]/1000).toFixed(1)} ק״ג נא</li>`:'';}).join("")}</ul>
    ${s.sides.length?`<h4>תוספות</h4><ul>${s.sides.map(x=>`<li>${x} <small>(${eventQty(x,'side',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${s.drinks.length?`<h4>שתייה</h4><ul>${s.drinks.map(x=>`<li>${x} <small>(${eventQty(x,'drink',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${(s.desserts||[]).length?`<h4>קינוחים</h4><ul>${s.desserts.map(x=>x==='__fruit'?`<li>מגש פירות העונה (${eventSeason()}: ${seasonalFruitList().join(', ')}) <small>(${eventQty('','fruit',s.guests)})</small></li>`:`<li>${x} <small>(${eventQty(x,'dessert',s.guests)})</small></li>`).join("")}</ul>`:''}
  </div>`;
  host.innerHTML=`
    <div class="mrow"><label>אורחים</label><input type="number" id="mG" min="1" value="${s.guests}"><span class="u">איש</span></div>
    <div class="mrow"><label>תיאבון</label>
      <select id="mA" ${s.gpm>0?'disabled':''}><option value="light"${s.appetite==='light'?' selected':''}>קל</option><option value="reg"${s.appetite==='reg'?' selected':''}>רגיל</option><option value="heavy"${s.appetite==='heavy'?' selected':''}>כבד</option></select>
      <button class="mchip ${s.kosher?'on':''}" id="mK">${s.kosher?'✓ ':''}כשר בלבד</button></div>
    <div class="mrow"><label>גרם/אורח</label><input type="number" id="mGpm" min="0" step="10" value="${s.gpm||''}" placeholder="אוטו׳"><span class="u">ג׳ מבושל · ידני (עוקף תיאבון)</span></div>
    <div class="mpresets"><span>התחלה מהירה:</span>
      <button data-preset="מנגל מעורב">מנגל מעורב</button><button data-preset="שרקוטרי">שרקוטרי</button>
      <button data-preset="נקניקיות">נקניקיות</button><button data-preset="דגים">דגים</button>
      <button data-preset="__fav">מהמועדפים</button>
      <button data-preset="__cart">✓ מהמסומנים ברשימה</button>
      <button id="mReset" class="mreset">🗑️ ${(typeof menuCtx==='function'&&menuCtx()==='cook')?'בישול חדש':'תפריט חדש'}</button></div>
    <h4 class="mini-h" style="margin-top:18px">מנות עיקריות${s.keys.length?` · ${s.keys.length}`:''}</h4>
    <div class="mdishes">${dishRows||'<div class="shop-empty" style="padding:16px">בחר "התחלה מהירה" למעלה, או הוסף מנה ↓</div>'}</div>
    <div class="maddwrap"><button id="mAdd">➕ הוסף מנה</button><div id="mAddCats" class="maddcats" style="display:none"></div></div>
    ${s.keys.length?`<div class="kbox k-ok" style="margin-top:12px">סה״כ בשר נא: <b>~${(totalRaw/1000).toFixed(1)} ק״ג</b> · <b>~${rawPerGuest} ג׳/אורח</b> ל-${s.guests} אורחים${s.sides.length?' · הופחת 25% בזכות תוספות':''}${s.gpm>0?' · ידני':` (${appName})`}</div>`:''}
    ${(typeof menuCtx==='function'&&menuCtx()==='cook')?'':`
    <h4 class="mini-h" style="margin-top:20px">תוספות מומלצות${s.keys.length?'':' (הוסף מנות תחילה)'}</h4>
    <div class="mchips">${sides.map(x=>chip(x,s.sides.includes(x),'data-side')).join("")}</div>
    <h4 class="mini-h" style="margin-top:18px">🥤 שתייה קלה</h4>
    <div class="mchips">${soft.map(x=>chip(x,s.drinks.includes(x),'data-drink')).join("")}</div>
    <h4 class="mini-h" style="margin-top:14px">🍺 שתייה חריפה</h4>
    <div class="mchips">${alc.map(x=>chip(x,s.drinks.includes(x),'data-drink')).join("")}</div>
    <div class="mnote">משקאות: תכנן ~2–3 לאדם.</div>
    <h4 class="mini-h" style="margin-top:18px">🍮 קינוחים</h4>
    <div class="mchips">${DESSERTS.map(d=>`<button class="mchip ${(s.desserts||[]).includes(d.n)?'on':''}" data-dessert="${d.n}">${(s.desserts||[]).includes(d.n)?'✓ ':''}${d.fire?'🔥 ':''}${d.n}</button>`).join("")}</div>
    <h4 class="mini-h" style="margin-top:14px">🍑 פירות טריים — ${eventSeason()}${(()=>{const st=menuState();return st.evDate?' (לפי תאריך האירוע)':' (החודש)';})()}</h4>
    <div class="mchips"><button class="mchip ${(s.desserts||[]).includes('__fruit')?'on':''}" data-dessert="__fruit">${(s.desserts||[]).includes('__fruit')?'✓ ':''}🍉 מגש פירות העונה: ${seasonalFruitList().join(' · ')}</button></div>
    ${(()=>{ const ex=[]; (s.sides||[]).forEach(x=>ex.push(['תוספת',x,eventQty(x,'side',s.guests)])); (s.drinks||[]).forEach(x=>ex.push(['שתייה',x,eventQty(x,'drink',s.guests)])); (s.desserts||[]).forEach(x=>{ if(x==='__fruit') ex.push(['פירות','מגש פירות העונה ('+eventSeason()+')',eventQty('','fruit',s.guests)]); else ex.push(['קינוח',x,eventQty(x,'dessert',s.guests)]); });
      return ex.length?`<div class="kbox k-ok" style="margin-top:14px"><b>כמויות מומלצות ל-${s.guests} אורחים:</b>${ex.map(e=>`<div class="mqty"><span>${e[0]}: ${e[1]}</span><b>${e[2]}</b></div>`).join('')}</div>`:''; })()}`}
    ${s.keys.length?`<div class="exactions" style="margin-top:16px">
      <button id="mCart">🛒 הוסף את כל המנות לרשימת קניות</button>
      <button id="mCopy">📋 העתק תוספות+שתייה</button>
      <button id="mTime">🕒 מתזמן</button>
      <button class="prbtn" style="position:static" data-print>⎙ הדפס תפריט</button></div>`:''}
    ${printHtml}`;
  $("#mG").addEventListener('change',e=>{const st=menuState();st.guests=Math.max(1,+e.target.value||8);saveMenu(st);renderMenu();});
  $("#mA").addEventListener('change',e=>{const st=menuState();st.appetite=e.target.value;saveMenu(st);renderMenu();});
  { const gp=$("#mGpm"); if(gp) gp.addEventListener('change',e=>{const st=menuState();st.gpm=Math.max(0,+e.target.value||0);saveMenu(st);renderMenu();}); }
  { const mr=$("#mReset"); if(mr) mr.addEventListener('click',resetMenu); }
  $("#mK").addEventListener('click',()=>{const st=menuState();st.kosher=!st.kosher;if(st.kosher)st.keys=st.keys.filter(isKosherOk);saveMenu(st);renderMenu();});
  host.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{b.dataset.preset==='__fav'?presetFromFavs():b.dataset.preset==='__cart'?presetFromCart():presetMenu(b.dataset.preset);}));
  host.querySelectorAll('[data-mswap]').forEach(b=>b.addEventListener('click',()=>swapDish(+b.dataset.mswap)));
  host.querySelectorAll('[data-mrm]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();st.keys.splice(+b.dataset.mrm,1);saveMenu(st);renderMenu();}));
  const addB=$("#mAdd"),addC=$("#mAddCats");
  addB.addEventListener('click',()=>{
    addC.style.display=addC.style.display==='none'?'':'none';
    if(addC.style.display!=='none'){
      addC.innerHTML=allMenuCats().map(c=>`<button class="mchip" data-addcat="${c}" style="border-color:${catColor(c)};color:${catColor(c)}">${c}</button>`).join("");
      addC.querySelectorAll('[data-addcat]').forEach(cb=>cb.addEventListener('click',()=>{
        const st=menuState();const l=recipesInCat(cb.dataset.addcat,st.kosher).filter(k=>!st.keys.includes(k));
        if(l.length){ const pk=l[Math.floor(Math.random()*l.length)]; if(!st.keys.includes(pk)){ st.keys.push(pk); saveMenu(st); } renderMenu();}
      }));
    }
  });
  host.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();const v=b.dataset.side;st.sides=st.sides.includes(v)?st.sides.filter(x=>x!==v):[...st.sides,v];saveMenu(st);renderMenu();}));
  host.querySelectorAll('[data-drink]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();const v=b.dataset.drink;st.drinks=st.drinks.includes(v)?st.drinks.filter(x=>x!==v):[...st.drinks,v];saveMenu(st);renderMenu();}));
  host.querySelectorAll('[data-dessert]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();st.desserts=st.desserts||[];const v=b.dataset.dessert;st.desserts=st.desserts.includes(v)?st.desserts.filter(x=>x!==v):[...st.desserts,v];saveMenu(st);renderMenu();}));
  const mc=$("#mCart");if(mc)mc.addEventListener('click',()=>{
    // menu IS the shopping list now — just open it
    updateCartBadge();
    openFrom(openMenu,openCart);
  });
  const mcp=$("#mCopy");if(mcp)mcp.addEventListener('click',()=>{const st=menuState();copyText(['תוספות:',...st.sides,'','שתייה:',...st.drinks].join('\n'));});
  const mt=$("#mTime");if(mt)mt.addEventListener('click',()=>{updateCartBadge();openFrom(openMenu,openTimeline);});
  host.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
}

/* ---- cook timeline scheduler ---- */
function fmtClock(d){ if(!d) return '—'; return d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}); }
// day offset of d relative to the serving day (negative = earlier calendar day)
function tlDayOffset(d, ref){ if(!d||!ref) return 0; const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()), b=new Date(ref.getFullYear(),ref.getMonth(),ref.getDate()); return Math.round((a-b)/86400e3); }
function tlDayLabel(n){ if(n===0) return ''; if(n===-1) return 'יום לפני'; if(n===-2) return 'יומיים לפני'; if(n<0) return `${-n} ימים לפני`; if(n===1) return 'למחרת'; return `+${n} ימים`; }
// clock time + a "N days before" badge when the task falls on an earlier day than serving (e.g. a 30h sous-vide)
function fmtClockRel(d, ref){ const t=fmtClock(d); const lbl=tlDayLabel(tlDayOffset(d,ref)); return lbl? `<span class="wp-day">${lbl}</span>${t}` : t; }
function cssKey(k){ return k.replace(/[^a-zA-Z0-9_-]/g,'_'); }
function tlState(){return store.get('mk-tlstate')||{};}
function tlSetState(s){store.set('mk-tlstate',s);}

function openTimeline(){
  showPanel(`${toolTop('מתזמן ציר-זמן','שלבי הכנה מפורטים לכל פריט, לפי שעת הגשה','🕒','#cf6a4a')}
   <div class="panel-body" id="tlBody"></div>`);
  renderTimelinePanel();
}
/* ---------- voice cook mode (TTS + closed voice commands) ---------- */
let vcTasks=[], vcIdx=0, vcRec=null, vcVoices=[];
let tlTimers=[]; // in-session timeline notification timers
function stripEmoji(t){return String(t).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
// נרמול טקסט להגייה עברית טובה: קיצורים, סמלים ומספרים
function hebSpeechText(t){
  let s=stripEmoji(t);
  s=s.replace(/(\d+(?:\.\d+)?)\s*°C?/g,'$1 מעלות');
  s=s.replace(/~\s*/g,'בערך ');
  s=s.replace(/ק["״]ג/g,'קילו').replace(/ק"ג/g,'קילו');
  s=s.replace(/דק['׳]/g,'דקות').replace(/\bדק\b/g,'דקות');
  s=s.replace(/(\d+)\s*ש\b/g,'$1 שעות');
  s=s.replace(/שעה\/שעתיים/g,'שעה או שעתיים');
  s=s.replace(/(\d+)-(\d+)/g,'$1 עד $2');
  s=s.replace(/\bMR\b/gi,'מדיום רייר').replace(/\bmw\b/gi,'מדיום ול');
  s=s.replace(/·|•/g,', ').replace(/\s*\/\s*/g,' או ');
  s=s.replace(/\bכפ['׳]\b/g,'כפות').replace(/\bכפית\b/g,'כפית');
  s=s.replace(/\(([^)]*)\)/g,', $1,');
  return s.replace(/\s+/g,' ').trim();
}
/* ── bilingual voice (v132): input(ASR) lang + answer(TTS) lang ── */
function vcLang(){ return store.get('mk-vclang')||'he'; }        // recognition language
function vcAnsLang(){ return store.get('mk-vcanslang')||vcLang(); } // answer/TTS language
function vcLocale(l){ return l==='en'?'en-US':'he-IL'; }
function enSpeechText(t){ return stripEmoji(String(t)).replace(/·|•/g,', ').replace(/\s+/g,' ').trim(); }
function speechText(t, lang){ return (lang==='en')?enSpeechText(t):hebSpeechText(t); }
function vcPickVoice(lang){
  const want=(lang||vcAnsLang());
  const rx = want==='en' ? /en[-_]/i : /he|iw/i;
  const list=(speechSynthesis.getVoices()||[]).filter(v=>rx.test(v.lang));
  if(want!=='en') vcVoices=list;    // keep he list for the picker UI
  const savedName=(want!=='en')?store.get('mk-vcvoice'):null;
  let v=savedName&&list.find(x=>x.name===savedName);
  if(!v) v=list.find(x=>/google/i.test(x.name));
  if(!v) v=list[0];
  return v||null;
}
if(window.speechSynthesis) speechSynthesis.onvoiceschanged=()=>{ vcPickVoice(); const s=$("#vcVoiceSel"); if(s&&$("#vcBody")) vcRender(); };
/* ── Gemini TTS (איכות פרימיום, אופציונלי — מפתח אישי) ── */
const GEM_VOICES=['Kore','Aoede','Puck','Charon','Fenrir','Leda'];
const gemCache=new Map();           // text → AudioBuffer (מטמון להקראות חוזרות)
let gemCtx=null, gemSrc=null, vcSpeaking=false;
function gemKey(){return store.get('mk-gemkey')||'';}
function gemVoice(){return store.get('mk-gemvoice')||'Kore';}
function gemStop(){ if(gemSrc){try{gemSrc.stop();}catch(e){} gemSrc=null;} vcSpeaking=false; }
function b64ToPcm16(b64){
  const bin=atob(b64), len=bin.length, bytes=new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}
function pcmToBuffer(pcm, rate){
  gemCtx=gemCtx||new (window.AudioContext||window.webkitAudioContext)();
  const buf=gemCtx.createBuffer(1, pcm.length, rate);
  const ch=buf.getChannelData(0);
  for(let i=0;i<pcm.length;i++) ch[i]=pcm[i]/32768;
  return buf;
}
async function gemSpeak(text, lang){
  const key=gemKey(); if(!key) throw new Error('no-key');
  const clean=speechText(text, lang||vcAnsLang());
  let buf=gemCache.get(clean+gemVoice());
  if(!buf){
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(key)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:clean}]}],
        generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:gemVoice()}}}}})});
    if(!r.ok){ let reason=''; try{const eb=await r.json(); reason=(eb.error&&eb.error.message)||'';}catch(_){}
      console.warn('Gemini TTS error',r.status,reason); throw new Error('api-'+r.status+(reason?': '+reason:'')); }
    const j=await r.json();
    const part=j.candidates&&j.candidates[0]&&j.candidates[0].content.parts.find(p=>p.inlineData);
    if(!part) throw new Error('no-audio');
    const rate=parseInt((part.inlineData.mimeType.match(/rate=(\d+)/)||[])[1]||'24000');
    buf=pcmToBuffer(b64ToPcm16(part.inlineData.data), rate);
    if(gemCache.size>40) gemCache.clear();
    gemCache.set(clean+gemVoice(), buf);
  }
  gemStop();
  gemCtx=gemCtx||new (window.AudioContext||window.webkitAudioContext)();
  if(gemCtx.state==='suspended') await gemCtx.resume();
  gemSrc=gemCtx.createBufferSource(); gemSrc.buffer=buf; gemSrc.connect(gemCtx.destination);
  vcSpeaking=true; gemSrc.onended=()=>{vcSpeaking=false;};
  gemSrc.start();
}
function sysSpeak(text, lang){
  try{
    const L=lang||vcAnsLang();
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(speechText(text, L));
    u.lang=vcLocale(L); u.rate=0.92; u.pitch=1;
    const v=vcPickVoice(L); if(v) u.voice=v;
    speechSynthesis.speak(u);
  }catch(e){ toast('הקראה אינה נתמכת בדפדפן זה'); }
}
function vcSpeak(text, lang){
  const L=lang||vcAnsLang();
  gemStop(); try{speechSynthesis.cancel();}catch(e){}
  if(gemKey()){
    gemSpeak(text, L).catch(err=>{
      const s=String(err.message||err);
      let m='';
      if(s.includes('api-429')||/quota|RESOURCE_EXHAUSTED/i.test(s)) m='חריגת מכסה — הקראה קולית (TTS) מוגבלת מאוד בשכבה החינמית של Gemini וייתכן שדורשת חשבון עם חיוב.';
      else if(s.includes('api-403')||/permission|billing|PERMISSION/i.test(s)) m='מודל ההקראה (TTS) אינו זמין למפתח זה — לרוב דורש הפעלת חיוב (Billing) בפרויקט. ה-AI הטקסטואלי ימשיך לעבוד.';
      else if(s.includes('api-404')||/not found|NOT_FOUND/i.test(s)) m='מודל ההקראה לא נמצא — ייתכן שהשם השתנה בצד Google.';
      else if(s.includes('api-4')) m='מפתח שגוי או בעיה בהרשאה.';
      if(m) toast('קול Gemini: '+m+' עובר לקול המערכת.');
      sysSpeak(text, L);
    });
  } else sysSpeak(text, L);
}
function vcCurrentText(full){
  const t=vcTasks[vcIdx]; if(!t) return 'אין משימות';
  if(full) return t.det ? t.det : (t.sub||'אין פרטים נוספים למשימה הזו');
  let s=`${fmtClock(t.t)}. ${t.label}.`;
  if(t.sub) s+=' '+t.sub+'.';
  return s;
}
function vcRender(){
  const host=$("#vcBody"); if(!host) return;
  const t=vcTasks[vcIdx];
  host.innerHTML=t?`
    <div class="vc-pos">משימה ${vcIdx+1} מתוך ${vcTasks.length}</div>
    <div class="vc-card wp-${t.kind}">
      <div class="vc-time">${fmtClock(t.t)}</div>
      <div class="vc-label">${t.label}</div>
      ${t.sub?`<div class="vc-sub">${t.sub}</div>`:''}
      ${t.det?`<div class="vc-det">${t.det}</div>`:''}
    </div>
    <div class="vc-btns">
      <button class="vc-big" data-vc="prev">⏮ הקודם</button>
      <button class="vc-big vc-main" data-vc="read">🔊 הקרא</button>
      <button class="vc-big" data-vc="next">הבא ⏭</button>
    </div>
    <div class="vc-btns2">
      <button class="vc-q" data-vc="readfull">📖 הקרא עם פרטים</button>
      <button class="vc-q" data-vc="qtemp">🌡️ מה הטמפרטורה?</button>
      <button class="vc-q" data-vc="qwhen">⏰ מתי הבא?</button>
      <button class="vc-q ${vcRec?'on':''}" data-vc="mic">${vcRec?'🎙️ מאזין… (אמור: הבא / חזור / הקרא)':'🎙️ פקודות קוליות'}</button>
    </div>
    <p class="vc-hint">💡 מסך גדול, כפתורים גדולים — נועד לעמוד ליד המעשנת. פקודות: "הבא", "הקודם", "הקרא שוב", "פרטים".</p>
    <div class="vc-langrow">
      <span class="vc-langlbl">🎙️ שפת דיבור:</span>
      <button class="vc-langbtn ${vcLang()==='he'?'on':''}" data-vc="lang-he">עברית</button>
      <button class="vc-langbtn ${vcLang()==='en'?'on':''}" data-vc="lang-en">English</button>
      <span class="vc-langlbl">🔊 תשובה:</span>
      <button class="vc-langbtn ${vcAnsLang()==='he'?'on':''}" data-vc="anslang-he">עברית</button>
      <button class="vc-langbtn ${vcAnsLang()==='en'?'on':''}" data-vc="anslang-en">English</button>
    </div>
    <p class="vc-hint">${vcLang()==='en'?'🇬🇧 Voice commands: next · back · read · details · temperature · when.':'פקודות עבריות: הבא · הקודם · הקרא · פרטים · טמפרטורה · מתי.'} דיבור באנגלית מזוהה לרוב מדויק יותר.</p>
    ${aiAvail()?`<p class="vc-hint">✨ אפשר לשאול שאלות חופשיות בקול (למשל "כמה עוד זמן לחזה?") — אפשר לשאול באנגלית ולקבל תשובה בעברית.</p>
    <div class="vc-askrow"><input id="vcAskInput" placeholder="${vcAnsLang()==='en'?'Type a question…':'הקלד שאלה…'}"><button class="vc-askbtn" data-vc="asktext">${vcAnsLang()==='en'?'Ask ✨':'שאל ✨'}</button></div>
    ${vcLastQA?`<div class="vc-qa"><div class="vc-qa-q">❓ ${esc(vcLastQA.q)}</div><div class="vc-qa-a">${esc(vcLastQA.a)}</div></div>`:''}`:''}
    ${gemKey()?`<div class="vc-voicerow">✨ Gemini TTS פעיל · <label>קול:</label><select id="gemVoiceSel">${GEM_VOICES.map(v=>`<option ${v===gemVoice()?'selected':''}>${v}</option>`).join('')}</select> <button class="vc-keybtn" data-vc="gemoff">נתק</button></div>`
      :`<details class="vc-gem"><summary>✨ שדרוג איכות קול — Gemini TTS (מפתח אישי · דורש Billing)</summary>
        <p>קולות ניורליים עם עברית טבעית. צור מפתח ב-<b>aistudio.google.com</b> → Get API Key, והדבק כאן. נשמר רק בדפדפן שלך, דורש רשת. ⚠ הקראת Gemini היא מודל בתשלום — דורש הפעלת <b>Billing</b> בפרויקט (מכסה חינמית נדיבה גם אז); אחרת יישאר קול המערכת.</p>
        <div class="vc-keyrow"><input type="password" id="gemKeyInp" placeholder="הדבק מפתח API..."><button class="vc-keybtn" data-vc="gemsave">שמור</button></div>
      </details>`}
    ${vcVoices.length>1&&!gemKey()?`<div class="vc-voicerow"><label>קול מערכת:</label><select id="vcVoiceSel">${vcVoices.map(v=>`<option value="${v.name}" ${v===vcPickVoice()?'selected':''}>${v.name} (${v.lang})</option>`).join('')}</select></div>`
      :(vcVoices.length===0&&!gemKey()?'<p class="vc-hint">⚠ לא נמצא קול עברי במכשיר — באנדרואיד: הגדרות ← ניהול כללי ← המרת טקסט לדיבור ← התקן/בחר "שירותי הדיבור של Google" עם עברית.</p>':'')}`
   :'<div class="shop-empty">אין משימות — בנה תוכנית עבודה במתזמן ואז חזור.</div>';
  host.querySelectorAll('[data-vc]').forEach(b=>b.addEventListener('click',()=>vcAction(b.dataset.vc)));
  { const ai=host.querySelector('#vcAskInput'); if(ai) ai.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const q=ai.value.trim(); if(q) vcAskFlow(q); } }); }
  { const vs=host.querySelector('#vcVoiceSel'); if(vs) vs.addEventListener('change',()=>{ store.set('mk-vcvoice',vs.value); vcSpeak('זה הקול הנבחר. נשמע טוב?'); }); }
  { const gs=host.querySelector('#gemVoiceSel'); if(gs) gs.addEventListener('change',()=>{ store.set('mk-gemvoice',gs.value); vcSpeak('שלום! זה הקול החדש של ההקראה. נשמע טוב?'); }); }
}
function vcAction(a){
  const t=vcTasks[vcIdx];
  const en=vcAnsLang()==='en';
  if(a==='next'&&vcIdx<vcTasks.length-1){vcIdx++;vcRender();vcSpeakContent(vcCurrentText(false));}
  else if(a==='prev'&&vcIdx>0){vcIdx--;vcRender();vcSpeakContent(vcCurrentText(false));}
  else if(a==='read') vcSpeakContent(vcCurrentText(false));
  else if(a==='readfull') vcSpeakContent(vcCurrentText(true));
  else if(a==='qtemp'){
    const m=(t&&((t.det||'')+' '+(t.label||'')).match(/(\d{2,3})°/));
    if(en) vcSpeak(m?`The temperature is ${m[1]} degrees.`:'No temperature for this step.', 'en');
    else vcSpeak(m?`הטמפרטורה: ${m[1]} מעלות`:'אין טמפרטורה במשימה הזו', 'he');
  }
  else if(a==='qwhen'){
    const nx=vcTasks[vcIdx+1];
    if(en) vcSpeakContent(nx?`המשימה הבאה בשעה ${fmtClock(nx.t)}: ${stripEmoji(nx.label)}`:'זו המשימה האחרונה');
    else vcSpeak(nx?`המשימה הבאה בשעה ${fmtClock(nx.t)}: ${stripEmoji(nx.label)}`:'זו המשימה האחרונה', 'he');
  }
  else if(a==='mic') vcToggleMic();
  else if(a==='asktext'){ const inp=$("#vcAskInput"); const q=inp&&inp.value.trim(); if(q) vcAskFlow(q); }
  else if(a==='lang-he'){ store.set('mk-vclang','he'); const wasOn=!!vcRec; if(wasOn){vcRec._stop=true;try{vcRec.stop();}catch(e){}vcRec=null;} vcRender(); if(wasOn) vcToggleMic(); }
  else if(a==='lang-en'){ store.set('mk-vclang','en'); const wasOn=!!vcRec; if(wasOn){vcRec._stop=true;try{vcRec.stop();}catch(e){}vcRec=null;} vcRender(); if(wasOn) vcToggleMic(); }
  else if(a==='anslang-he'){ store.set('mk-vcanslang','he'); vcRender(); vcSpeak('התשובות יהיו בעברית','he'); }
  else if(a==='anslang-en'){ store.set('mk-vcanslang','en'); vcRender(); vcSpeak('Answers will be in English','en'); }
  else if(a==='gemsave'){
    const inp=$("#gemKeyInp"); const k=(inp&&inp.value||'').trim();
    if(k.length<20){ toast('מפתח לא תקין'); return; }
    store.set('mk-gemkey',k); vcRender();
    vcSpeak('מעולה! Gemini מחובר. ככה אני נשמע עכשיו.');
  }
  else if(a==='gemoff'){ store.set('mk-gemkey',''); gemCache.clear(); vcRender(); toast('Gemini נותק — חוזרים לקול המערכת'); }
}
/* ── voice AI Q&A (v132) — free-form questions during cooking, bilingual ── */
let vcLastQA=null;   // {q, a} for on-screen transcript
const vcTransCache=new Map();   // hebText → enText (avoid re-translating on repeat reads)
async function vcTranslateToEn(text){
  const src=String(text||'').trim(); if(!src) return '';
  if(vcTransCache.has(src)) return vcTransCache.get(src);
  if(typeof window!=='undefined' && window.__vcTransMock!==undefined && window.__vcTransMock!==null){
    const m=window.__vcTransMock; const out=(typeof m==='function'?m(src):m); vcTransCache.set(src,out); return out;
  }
  const key=gemKey(); if(!key) throw new Error('no-key');
  const body={ system_instruction:{parts:[{text:'Translate the following Hebrew cooking-instruction text to natural spoken English. Reply with ONLY the English translation, no quotes, no notes.'}]},
    contents:[{role:'user',parts:[{text:src}]}],
    generationConfig:{temperature:0.2,maxOutputTokens:300,thinkingConfig:{thinkingBudget:0}} };
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json(); const cand=j.candidates&&j.candidates[0];
  const out=(cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim())||src;
  vcTransCache.set(src,out); return out;
}
// speak app CONTENT (task steps), translating to English when the answer language is English
async function vcSpeakContent(text){
  const ansL=vcAnsLang();
  if(ansL!=='en'){ vcSpeak(text, 'he'); return; }
  if(!aiAvail()){ // can't translate without a key — speak Hebrew content, flag it
    if(typeof toast==='function') toast('תרגום לאנגלית דורש מפתח AI — מקריא בעברית');
    vcSpeak(text, 'he'); return;
  }
  try{ const en=await vcTranslateToEn(text); vcSpeak(en, 'en'); }
  catch(e){ vcSpeak(text, 'he'); }
}
function vcCookContext(){
  const t=vcTasks[vcIdx]; if(!t) return '';
  const parts=[stripEmoji(t.label||'')];
  if(t.sub) parts.push(stripEmoji(t.sub));
  if(t.det) parts.push(stripEmoji(t.det));
  return 'ההקשר: המשתמש מבשל כרגע, בשלב "'+parts.join(' · ').slice(0,300)+'".';
}
// question detection per language (Hebrew \b is unreliable — use explicit separators)
function vcLooksLikeQuestion(said){
  const s=(said||'').trim().toLowerCase();
  if(/^(שאלה|תשאל|תשאלי|ask|question)[\s:,]/.test(s)) return true;
  if(/[?？]/.test(s)) return true;
  if(/(^|\s)(מה|כמה|למה|איך|מתי|האם|כדאי|איזה|מהי|מהו|מדוע)(\s|$)/.test(s)) return true;
  return /\b(what|how|why|when|which|should|can|is|are|does|how much|how long)\b/.test(s);
}
function vcStripAskPrefix(said){ return String(said||'').replace(/^(שאלה|תשאל|תשאלי|ask|question)[:,\s]+/i,'').trim(); }
// pure prompt builder (testable) — fully language-matched to force the answer language
function vcBuildAskPrompt(question, ansLang, ctx){
  ctx=ctx||'';
  let sys;
  if(ansLang==='en'){
    sys='You are "The Fire" — a live-fire cooking assistant inside an app. '
      +'CRITICAL: You MUST reply in ENGLISH ONLY, even though the question or context may be in Hebrew. '
      +'Keep it brief (2-3 sentences max), suitable for text-to-speech while the user is actively cooking. '
      +'Do not invent safety temperatures — if unsure, say so.'
      +(ctx?(' Context (may be in Hebrew, translate as needed): '+ctx):'');
  } else {
    sys='אתה "האש" — עוזר בישול-אש חי בתוך אפליקציה. '
      +'חשוב: ענה אך ורק בעברית. '
      +'בקצרה (2-3 משפטים לכל היותר), מתאים להקראה בזמן בישול פעיל. '
      +'אל תמציא טמפרטורות בטיחות — אם אינך בטוח, אמור זאת.'+(ctx?(' '+ctx):'');
  }
  const userText = ansLang==='en' ? (question+'\n\n(Reply in English only.)') : (question+'\n\n(ענה בעברית בלבד.)');
  return {sys, userText};
}
async function vcAskAI(question){
  if(typeof window!=='undefined' && window.__vcAskMock!==undefined && window.__vcAskMock!==null){
    const m=window.__vcAskMock; return typeof m==='function'?m(question):m;
  }
  const key=gemKey(); if(!key) throw new Error('no-key');
  const ans=vcAnsLang();
  const {sys, userText}=vcBuildAskPrompt(question, ans, vcCookContext());
  const body={ system_instruction:{parts:[{text:sys}]},
    contents:[{role:'user',parts:[{text:userText}]}],
    tools:[{google_search:{}}],
    generationConfig:{temperature:0.6,maxOutputTokens:400,thinkingConfig:{thinkingBudget:0}} };
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json(); const cand=j.candidates&&j.candidates[0];
  const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
  if(!txt) throw new Error('empty');
  return txt;
}
async function vcAskFlow(rawSaid){
  const question=vcStripAskPrefix(rawSaid);
  if(!question){ return; }
  const ansL=vcAnsLang();
  vcSpeak(ansL==='en'?'One moment, checking.':'רגע, בודק.', ansL);
  vcLastQA={q:question, a:(ansL==='en'?'…thinking':'…חושב')}; vcRender();
  try{
    const answer=await vcAskAI(question);
    vcLastQA={q:question, a:answer}; vcRender();
    vcSpeak(answer, ansL);
  }catch(e){
    const msg=ansL==='en'?'Sorry, AI is not available right now.':'מצטער, ה-AI לא זמין כרגע.';
    vcLastQA={q:question, a:msg}; vcRender(); vcSpeak(msg, ansL);
  }
}

function vcToggleMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast('זיהוי דיבור אינו נתמך בדפדפן זה (נתמך בכרום-אנדרואיד) — השתמש בכפתורים'); return; }
  if(vcRec){ vcRec._stop=true; try{vcRec.stop();}catch(e){} vcRec=null; vcRender(); toast('האזנה כבויה'); return; }
  // בקשת הרשאת מיקרופון מפורשת — מפעילה את חלון האישור באמינות
  const startRec=()=>{ try{
    const rec=new SR(); vcRec=rec;
    rec.lang=vcLocale(vcLang()); rec.continuous=false; rec.interimResults=false; rec.maxAlternatives=3;   // one-shot: אמין יותר באנדרואיד
    rec.onresult=(ev)=>{
      if(speechSynthesis.speaking||vcSpeaking) return;    // אל תקלוט את ההקראה של עצמנו
      const alts=[...ev.results[0]].map(r=>r.transcript.trim());
      const said=alts.join(' | ');
      const hit=(re)=>alts.some(a=>re.test(a));
      let acted=true;
      if(hit(/הבא|קדימה|המשך|נקסט|next|forward|continue/i)) vcAction('next');
      else if(hit(/הקודם|אחורה|previous|back/i)) vcAction('prev');
      else if(hit(/פרטים|מלא|הרחב|details|full|expand/i)) vcAction('readfull');
      else if(hit(/הקרא|שוב|תחזור|read|again|repeat/i)) vcAction('read');
      else if(hit(/טמפרטורה|חום|מעלות|temp|temperature|degrees/i)) vcAction('qtemp');
      else if(hit(/מתי|הבאה|when|next step/i)) vcAction('qwhen');
      else if(aiAvail() && vcLooksLikeQuestion(alts[0])){ vcAskFlow(alts[0]); toast('❓ '+alts[0]); return; }
      else acted=false;
      toast((acted?'✓ ':(vcLang()==='en'?'Command not recognized: ':'לא זוהתה פקודה: '))+`"${alts[0]}"`);
    };
    rec.onerror=(e)=>{
      if(e.error==='no-speech'||e.error==='aborted') return;          // שקט — פשוט ממשיכים
      if(e.error==='not-allowed'){ vcRec=null; vcRender(); toast('נדרשת הרשאת מיקרופון — אשר בדפדפן ונסה שוב'); return; }
      if(e.error==='network'){ vcRec=null; vcRender(); toast('זיהוי דיבור דורש חיבור רשת'); return; }
    };
    rec.onend=()=>{ if(vcRec===rec && !rec._stop){ setTimeout(()=>{ try{rec.start();}catch(err){} },250); } };  // לולאת one-shot
    rec.start(); vcRender();
    vcSpeak(vcLang()==='en'?'Listening. Say: next, back, read again, details, temperature — or ask a question.':'מאזין. אמור: הבא, הקודם, הקרא שוב, פרטים, טמפרטורה — או שאל שאלה חופשית.', vcAnsLang());
  }catch(e){ vcRec=null; toast('לא ניתן להפעיל מיקרופון: '+e.message); } };
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
      stream.getTracks().forEach(t=>t.stop());   // שחרר — רק ההרשאה חשובה
      startRec();
    }).catch(()=>{
      toast('הרשאת מיקרופון חסומה. פתח: סמל המנעול 🔒 בשורת הכתובת ← הרשאות ← מיקרופון ← אפשר, ואז נסה שוב.');
    });
  } else startRec();
}
function openVoiceCook(tasks){
  vcTasks=tasks||[]; vcIdx=0; 
  // start at the nearest upcoming task
  const now=new Date();
  const up=vcTasks.findIndex(t=>t.t>=now); if(up>0) vcIdx=up;
  showPanel(`${toolTop('מצב בישול קולי','הטלפון ליד המעשנת — הקראה, ניווט ופקודות','🎙️','#7a5cc2')}
    <div class="panel-body" id="vcBody"></div>`);
  vcRender();
  if(vcTasks.length) vcSpeakContent(vcCurrentText(false));
}
function renderTimelinePanel(){
  const host=$("#tlBody"); if(!host) return;
  const srcKeys=[...new Set((typeof menuState==='function')?(menuState().keys||[]):[])];
  const items=srcKeys.map(resolveItem).filter(Boolean);
  const serveStr=store.get('mk-tlserve')||'19:00';
  host.innerHTML=`
    <div class="calcrow"><label>שעת הגשה</label><input type="time" id="tlServe" value="${serveStr}"><button id="tlReset" class="mreset">🗑️ איפוס בחירות</button></div>
    <button id="tlAlerts" class="tl-alerts ${store.get('mk-tlalerts')?'on':''}">🔔 <span>${store.get('mk-tlalerts')?'התראות פעילות':'הפעל התראות לשלבים'}</span></button>
    <p class="section-sub">לכל פריט: סמן אם כבר מוכן (ברירת מחדל) או מתחיל מאפס היום. שיטת הבישול נלקחת מהמתגים בכרטיסייה (⚡) — אפשר לבחור צירוף אחר כאן. לחץ ▾ לפירוט שלבים.</p>
    <div id="tlList">${items.length?'':'<div class="shop-empty">הרשימה ריקה — הוסף פריטים (כפתור ＋) או דרך בונה התפריט, ואז חזור לכאן.</div>'}</div>`;
  const si=$("#tlServe");
  if(si) si.addEventListener('input',()=>{store.set('mk-tlserve',si.value); buildList();});
  { const ta=$("#tlAlerts"); if(ta) ta.addEventListener('click',async()=>{
      const on=!store.get('mk-tlalerts');
      if(on){ if(!('Notification' in window)){ toast('הדפדפן לא תומך בהתראות'); return; }
        let perm=Notification.permission; if(perm==='default') perm=await Notification.requestPermission();
        if(perm!=='granted'){ toast('צריך לאשר התראות בדפדפן'); return; }
        toast('התראות יופעלו כל עוד האפליקציה פתוחה'); }
      store.set('mk-tlalerts',on); buildList();
      ta.classList.toggle('on',on); ta.querySelector('span').textContent=on?'התראות פעילות':'הפעל התראות לשלבים';
    }); }
  { const tr=$("#tlReset"); if(tr) tr.addEventListener('click',()=>{
      const prev=tlState(); tlSetState({}); buildList();
      toast('בחירות הלוח אופסו',()=>{ tlSetState(prev); buildList(); });
    }); }
  function buildList(){
    if(!items.length) return;
    const [hh,mm]=$("#tlServe").value.split(':').map(Number);
    const serve=new Date(); serve.setHours(hh,mm,0,0);
    const allState=tlState();
    const computed=items.map(m=>{
      const profile=itemProfile(m);
      let st=allState[m.key];
      if(!st){ st={ready:true}; allState[m.key]=st; }
      // method: follow the card's active combo UNLESS the user explicitly changed it in the timeline selector
      if(!st.methodPinned || !st.method) st.method=profile.methods[0].key;
      if(!st.svSmokeOrder) st.svSmokeOrder=svSmokeOrderDefault();
      const scratchable=hasScratchBuild(m);
      if(scratchable){ st.stage = st.stage || (st.ready===false?'scratch':'ready'); st.ready = (st.stage==='ready'); }
      const blocked=profile.multiDay && !st.ready;
      let stages=[], startClock=null;
      if(!blocked){
        stages=itemStages(m,st.method,st.ready,st.svSmokeOrder);
        let end=serve;
        for(let i=stages.length-1;i>=0;i--){
          const s=stages[i]; const start=new Date(end.getTime()-s.hours*3600e3);
          s.start=start; s.end=end; end=start;
        }
        startClock=end;
      }
      return {m,profile,st,stages,startClock,blocked};
    });
    tlSetState(allState);
    let earliestSmoke=null;
    computed.forEach(c=>{ if(c.blocked) return; c.stages.forEach(s=>{ if(s.kind==='smoke'&&(!earliestSmoke||s.start<earliestSmoke)) earliestSmoke=s.start; }); });
    const preheat=earliestSmoke? new Date(earliestSmoke.getTime()-45*60e3) : null;
    const sorted=computed.slice().sort((a,b)=>{
      if(a.blocked&&b.blocked) return 0; if(a.blocked) return 1; if(b.blocked) return -1;
      return a.startClock-b.startClock;
    });
    // in-session reminders (work while app is open)
    tlTimers.forEach(t=>clearTimeout(t)); tlTimers=[];
    if(store.get('mk-tlalerts') && ('Notification' in window) && Notification.permission==='granted'){
      const now=Date.now(); const fire=(when,title,body)=>{ const ms=when.getTime()-now; if(ms>0&&ms<24*3600e3) tlTimers.push(setTimeout(()=>{ try{new Notification(title,{body,icon:'icon-192.png'});}catch(e){} },ms)); };
      if(preheat) fire(preheat,'🔥 זמן להדליק',`הדלק את המעשנת — ${preheatHint()} לפני העישון הראשון`);
      sorted.forEach(c=>{ if(!c.blocked&&c.startClock) fire(c.startClock,'⏰ '+stripEmoji(c.m.heb),'הזמן להתחיל: '+c.m.heb); });
    }
    const viewMode=store.get('mk-tlview')||'items';
    let html=`<div class="tl-viewtoggle"><button class="mchip ${viewMode==='items'?'on':''}" data-tlview="items">📦 לפי פריט</button><button class="mchip ${viewMode==='plan'?'on':''}" data-tlview="plan">📋 תוכנית עבודה</button></div>`;
    if(viewMode==='plan'){
      html+=workPlanHtml(computed, preheat, serve);
    } else {
      if(preheat) html+=`<div class="tlrow tl-preheat"><span class="tl-t"><b>${fmtClockRel(preheat, serve)}</b></span><span class="tl-n">🔥 הדלקת מעשנת (חימום מוקדם, 45 דק׳)</span><span class="tl-lead"></span></div>`;
      html+=sorted.map(c=>itemRowHtml(c,serve)).join('');
      html+=`<div class="tlrow tl-serve"><span class="tl-t"><b>${$("#tlServe").value}</b></span><span class="tl-n"><b>🍽️ הגשה</b></span><span class="tl-lead"></span></div>`;
    }
    html+=`<button class="prbtn" style="position:static;margin-top:12px" data-print>⎙ הדפס ${viewMode==='plan'?'תוכנית עבודה':'לוח זמנים'}</button>`;
    $("#tlList").innerHTML=html;
    $("#tlList").querySelectorAll('[data-tlview]').forEach(b=>b.addEventListener('click',()=>{store.set('mk-tlview',b.dataset.tlview); buildList();}));
    $("#tlList").querySelectorAll('[data-tldetail]').forEach(b=>b.addEventListener('click',()=>{store.set('mk-tlplandetail',b.dataset.tldetail); buildList();}));
    $("#tlList").querySelectorAll('[data-tlshape]').forEach(b=>b.addEventListener('click',()=>{setTlShape(b.dataset.tlshape); buildList();}));
    $("#tlList").querySelectorAll('.wp-acch').forEach(h=>h.addEventListener('click',()=>{ const acc=h.parentElement; if(acc) acc.classList.toggle('open'); }));
    { const vb=$("#tlList").querySelector('[data-vclaunch]'); if(vb) vb.addEventListener('click',()=>openFrom(openTimeline,()=>openVoiceCook(window._wpTasks||[]))); }
    wireRows();
  }
  function workPlanHtml(computed, preheat, serve){
    const detail=(store.get('mk-tlplandetail')||'short')==='full';
    const tasks=[];
    computed.forEach(c=>{
      if(c.blocked) return;
      const name=c.m.heb;
      // ── from-scratch build phases (make-recipes + ground-meat cuts), split-aware ──
      { const sb2=itemScratchBuild(c.m); const stg=c.st.stage||(c.st.ready?'ready':'scratch');
        if(sb2 && stg!=='ready'){ makeBuildTasks(sb2, c.startClock, name, detail, stg).forEach(t=>tasks.push(t)); } }
      let cardSteps=[];
      if(detail && c.m.kind==='cut'){
        const mm=c.profile.methods.find(x=>x.key===c.st.method)||c.profile.methods[0];
        try{ cardSteps=injectSeasoningSteps(composedSteps(c.m.obj, mm.combo||['smoke']), c.m.key); }catch(e){ cardSteps=[]; }
      }
      const findDetail=(kw)=>{ if(!detail) return '';
        const hit=cardSteps.find(s=>kw.some(k=>s[0].includes(k)));
        return hit? hit[1] : ''; };
      const sel=selectedSeasonings(c.m.key).map(seasoningById).filter(Boolean);
      sel.filter(s=>s.kind==='sauce').forEach(s=>tasks.push({t:new Date(c.startClock.getTime()-30*60e3),label:`🥄 הכן רוטב ${s.heb} — ${name}`,sub:'אפשר גם יום קודם',kind:'prep',det:detail?`${s.ing} · ${s.use}${s.sub?` · ⚠ תחליף: ${s.sub}`:''}`:''}));
      sel.filter(s=>s.kind==='marinade').forEach(s=>tasks.push({t:new Date(c.startClock.getTime()-2*3600e3),label:`🥣 השרה במרינדת ${s.heb} — ${name}`,sub:'לפחות שעתיים לפני, עדיף יותר',kind:'prep',det:detail?`${s.ing} · ${s.use}${s.sub?` · ⚠ תחליף: ${s.sub}`:''}`:''}));
      sel.filter(s=>s.kind==='rub').forEach(s=>tasks.push({t:new Date(c.startClock.getTime()-40*60e3),label:`🌶️ שפשף ראב ${s.heb} — ${name}`,sub:'',kind:'prep',det:detail?`${s.ing} · ${s.use}${s.sub?` · ⚠ תחליף: ${s.sub}`:''}`:''}));
      if(c.m.key==='cut-18'){ burgerPlanTasks(burgerDiners(), c.startClock, serve, name, detail).forEach(t=>tasks.push(t)); }
      if(detail){
        const prepDet=findDetail(['הכנה','הכנת הנתח','טמפרטורת חדר','הכנה ייעודית']);
        if(prepDet) tasks.push({t:new Date(c.startClock.getTime()-20*60e3),label:`🔪 הכנה — ${name}`,sub:'',kind:'prep',det:prepDet});
      }
      c.stages.forEach(s=>{
        if(s.kind==='rest') tasks.push({t:s.start,label:`⏸️ מנוחה — ${name}`,sub:'',kind:'rest',det:detail?(findDetail(['מנוחה'])||''):''});
        else if(s.kind==='note') return;
        else if(s.kind==='dry'){
          tasks.push({t:s.start,label:`🌬️ ${s.label} — ${name}`,sub:s.note||'',kind:'dry',det:''});
        }
        else{
          let det='';
          if(detail){
            if(s.kind==='sv') det=findDetail(['סו-ויד','ואקום']);
            else if(s.kind==='smoke'){
              det=findDetail(['עישון']);
              const wd=c.m.kind==='cut'?c.m.obj.wood:(c.profile&&c.profile.wood);
              const cl=c.m.kind==='cut'?c.m.obj.coal:'';
              if(wd&&wd!=='ללא'&&!(det||'').includes(wd)) det=(det?det+' ':'')+`[🪵 עץ: ${wd}${cl?` · פחם: ${cl}`:''}]`;
            }
            else det=findDetail(['גימור גריל','צריבה','צלייה','גריל']);
            if(s.kind!=='smoke'&&c.m.kind==='cut'&&c.m.obj.doneness){
              const dn=['rare','mr','med','mw','well'].filter(k=>c.m.obj.doneness.levels[k]).map(k=>`${doneLabel(c.m.obj,k)} ${c.m.obj.doneness.levels[k].c}°`).join(' · ');
              det=(det?det+' ':'')+`[מידות: ${dn}]`;
            }
          }
          tasks.push({t:s.start,label:`${s.kind==='sv'?'🌊':s.kind==='smoke'?'💨':'🔥'} ${s.label} — ${name}`,sub:s.note||'',kind:s.kind,det});
        }
      });
      const sel2=sel.filter(s=>s.kind==='glaze');
      const lastCook=c.stages.filter(s=>s.kind!=='rest'&&s.kind!=='note').pop();
      if(lastCook) sel2.forEach(s=>tasks.push({t:new Date(lastCook.end.getTime()-15*60e3),label:`🍯 הברש גלייז ${s.heb} — ${name}`,sub:'10-15 דק׳ אחרונות, בשכבות',kind:'glaze',det:detail?`${s.ing}${s.sub?` · ⚠ תחליף: ${s.sub}`:''}`:''}));
    });
    // ── mise-en-place clustering: group flexible prep tasks of the same type (2+) ──
    const clusterDefs=[['🥄 הכן רוטב','🥄 הכנת רטבים (mise en place)'],['🥣 השרה במרינדת','🥣 השריית מרינדות'],['🌶️ שפשף ראב','🌶️ הכנת ושפשוף ראבים'],['🍯 הברש גלייז',null]]; // glaze stays clock-bound!
    for(const [prefix,title] of clusterDefs){
      if(!title) continue;
      const grp=tasks.filter(t=>t.label.startsWith(prefix));
      if(grp.length>=2){
        const earliest=new Date(Math.min(...grp.map(t=>t.t.getTime())));
        const merged={t:earliest,kind:'prep',label:title,
          sub:'ריכוז פעולות דומות — הכל ברצף אחד',
          det:grp.map(t=>`• ${t.label.replace(prefix,'').replace(/^[: ]+/,'')}${t.det?` — ${t.det}`:''}`).join('<br>')};
        for(const t of grp){ const i=tasks.indexOf(t); if(i>=0) tasks.splice(i,1); }
        tasks.push(merged);
      }
    }
    if(preheat) tasks.push({t:preheat,label:'🔥 הדלקת מעשנת (חימום מוקדם)',sub:preheatHint(),kind:'fire',det:''});
    tasks.push({t:serve,label:'🍽️ הגשה',sub:'',kind:'serve',det:''});
    tasks.sort((a,b)=>a.t-b.t);
    window._wpTasks=tasks;   // for voice cook mode
    const shp=tlShape();
    const shapeBtns=Object.entries(SHAPE_NAMES).map(([k,n])=>`<button class="mchip shp-btn ${k===shp?'on':''}" data-tlshape="${k}">${n}</button>`).join('');
    // v144 (bug-fix): sv/smoke order must be reachable from the PLAN view too, not only the per-item schedule card
    const orderItems=computed.filter(c=>!c.blocked && comboHasSvSmoke(c.m, c.st.method));
    const orderControlsHtml=orderItems.length?`<div class="tl-orderstrip">
      <div class="tl-orderstrip-lbl">🔄 סדר בישול (סו-ויד/עישון):</div>
      ${orderItems.map(c=>`<div class="tl-order tl-order-plan">
        <span class="tl-order-lbl">${c.m.heb}:</span>
        <select data-tlorder="${c.m.key}">${Object.entries(SV_SMOKE_ORDERS).map(([k,o])=>`<option value="${k}" ${k===c.st.svSmokeOrder?'selected':''}>${o.name}</option>`).join('')}</select>
      </div>${c.st.svSmokeOrder==='smoke-sv'?`<div class="tl-safety-warn">⚠️ <b>${c.m.heb}:</b> הבשר שוהה בטמפ׳-סכנה בעישון הקר <u>לפני</u> הפסטור. שלב הסו-ויד המסומן "כולל פסטור" חייב להתבצע במלואו. בספק — עבור לסדר סו-ויד←עישון.</div>`:''}`).join('')}
    </div>`:'';
    return `${orderControlsHtml}<div class="tl-detailtoggle"><span>רמת פירוט:</span><button class="mchip ${!detail?'on':''}" data-tldetail="short">מקוצר</button><button class="mchip ${detail?'on':''}" data-tldetail="full">מלא — עצמאי להדפסה</button><button class="mchip vc-launch" data-vclaunch>🎙️ מצב בישול קולי</button></div>
    <div class="tl-shaperow"><span>תצוגה:</span>${shapeBtns}</div>
    ${renderWorkplanShape(tasks, shp, detail, serve)}`;
  }
  /* v144: same computed+scheduled tasks, 3 presentation shapes (does not touch scheduling above) */
  function renderWorkplanShape(tasks, shape, detail, serve){
    if(shape==='3') return renderWpHorizontal(tasks, serve);
    if(shape==='5') return renderWpAccordion(tasks, detail, serve);
    return renderWpVertical(tasks, detail, serve);   // shape '1' — also the pre-v144 default markup
  }
  function renderWpVertical(tasks, detail, serve){
    return `<div class="workplan ${detail?'wp-full':''}">${tasks.map((tk,i)=>`
      <label class="wp-row wp-${tk.kind}"><input type="checkbox" class="wp-ck">
        <span class="wp-time">${fmtClockRel(tk.t, serve)}</span>
        <span class="wp-body"><b>${tk.label}</b>${tk.sub?`<small>${tk.sub}</small>`:''}${tk.det?`<span class="wp-det">${tk.det}</span>`:''}</span>
      </label>`).join('')}</div>`;
  }
  function renderWpAccordion(tasks, detail, serve){
    return `<div class="workplan wp-accordion ${detail?'wp-full':''}">${tasks.map((tk,i)=>`
      <div class="wp-acc ${i===0?'open':''}" data-wpacc="${i}">
        <div class="wp-acch"><span class="wp-bar wp-bar-${tk.kind}"></span><span class="wp-time">${fmtClockRel(tk.t, serve)}</span><b class="wp-atitle">${tk.label}</b><span class="wp-caret">▾</span></div>
        <div class="wp-accb">${tk.sub?`<small>${tk.sub}</small>`:''}${tk.det?`<span class="wp-det">${tk.det}</span>`:''}${!tk.sub&&!tk.det?'<small>אין פרטים נוספים לשלב זה.</small>':''}</div>
      </div>`).join('')}</div>`;
  }
  function renderWpHorizontal(tasks, serve){
    const ic={sv:'💧',smoke:'💨',cook:'🔥',rest:'⏸️',prep:'🔪',fire:'🔥',serve:'🍽️',glaze:'🍯',dry:'🌬️'};
    return `<div class="workplan wp-horiz">${tasks.map(tk=>`
      <div class="wp-hcell wp-${tk.kind}"><div class="wp-hdot">${ic[tk.kind]||'•'}</div><div class="wp-htime">${fmtClockRel(tk.t, serve)}</div><div class="wp-hlabel">${tk.label}</div></div>`).join('')}</div>`;
  }
  function itemRowHtml(c, serve){
    const {m,profile,st,stages,startClock,blocked}=c;
    const scratchable=hasScratchBuild(m);
    if(blocked){
      return `<div class="tlcard tl-blocked">
        <div class="tlc-head"><b class="tl-name">${m.heb}</b><span class="tl-badge">תהליך רב-יומי</span></div>
        <p class="tl-note">בנייה מאפס לקטגוריה זו (${m.cat}) אורכת ימים-שבועות (כבישה/ייבוש) — לא מתאים ללוח של יום אחד. נהל אותה ב"המזווה שלי", ופה סמן "כבר מוכן" ביום הבישול/ההגשה.</p>
        <div class="tlc-controls">
          <button class="mchip on" data-tlfresh="${m.key}">מתחיל מאפס</button>
          <button class="mchip" data-tlready="${m.key}">כבר מוכן</button>
          <button class="tl-pantrybtn" data-tlpantry>🧫 פתח את המזווה שלי</button>
        </div>
      </div>`;
    }
    const methodOpts=profile.methods.length>1?`<select data-tlmethod="${m.key}">${profile.methods.map(mm=>`<option value="${mm.key}" ${mm.key===st.method?'selected':''}>${mm.label}</option>`).join('')}</select>`:'';
    const woodNote=profile.wood?`<span class="tl-wood">🪵 ${profile.wood}</span>`:'';
    const ck=cssKey(m.key);
    // v144: sv/smoke order — only relevant when this item's chosen method actually combines both
    const showOrder=comboHasSvSmoke(m, st.method);
    const orderRow=showOrder?`<div class="tl-order">
        <span class="tl-order-lbl">סדר בישול:</span>
        <select data-tlorder="${m.key}">${Object.entries(SV_SMOKE_ORDERS).map(([k,o])=>`<option value="${k}" ${k===st.svSmokeOrder?'selected':''}>${o.name}</option>`).join('')}</select>
      </div>`:'';
    const orderWarn=(showOrder && st.svSmokeOrder==='smoke-sv')?`<div class="tl-safety-warn">⚠️ <b>דורש תשומת-לב:</b> הבשר שוהה בטמפ׳-סכנה בעישון הקר <u>לפני</u> הפסטור. שלב הסו-ויד המסומן "כולל פסטור" חייב להתבצע במלואו — לפי טבלת פסטור מוכרת לפי עובי. בספק — עבור לסדר סו-ויד←עישון.</div>`:'';
    const stageRows=stages.map(s=>{
      if(s.hours===0) return `<div class="tl-stage tl-stage-note">↳ ${s.label}</div>`;
      const reload=s.kind==='smoke'&&s.hours>2.5?` · ↻ הוסף עץ כל ~90 דק׳ (כ-${Math.max(1,Math.round(s.hours*60/90)-1)} פעמים)`:'';
      const hLabel=s.hours<1?Math.round(s.hours*60)+' דק׳':s.hours.toFixed(1)+'ש';
      return `<div class="tl-stage"><span class="tl-stage-t">${fmtClockRel(s.start, serve)}</span><span class="tl-stage-l">${s.label}${s.note?` · ${s.note}`:''}${reload}</span><span class="tl-stage-h">${hLabel}</span></div>`;
    }).join('');
    const cut=m.kind==='cut'?m.obj:null;
    const doneRef=(cut&&cut.doneness)?`<div class="tl-doneref"><b>מידות עשייה לגימור (מד-חום פנים)</b> — להתאמה אישית לכל סועד:<div class="tl-donelist">${['rare','mr','med','mw','well'].filter(k=>cut.doneness.levels[k]).map(k=>`<span class="${k===currentDoneness(cut)?'on':''}">${doneLabel(cut,k)} <b>${cut.doneness.levels[k].c}°</b></span>`).join('')}</div></div>`:'';
    return `<div class="tlcard">
      <div class="tlc-head">
        <span class="tl-startt"><b>${fmtClockRel(startClock, serve)}</b></span>
        <b class="tl-name">${m.heb}</b>
        ${woodNote}
        <button class="tl-expand" data-tlexp="${m.key}" data-ck="${ck}" aria-label="הרחב פירוט שלבים">▾</button>
      </div>
      <div class="tlc-controls">
        ${scratchable?`
          <button class="mchip ${st.stage==='ready'?'on':''}" data-tlstage="ready" data-k="${m.key}">${st.stage==='ready'?'✓ ':''}מוכן לגמרי</button>
          <button class="mchip ${st.stage==='prepped'?'on':''}" data-tlstage="prepped" data-k="${m.key}">${st.stage==='prepped'?'✓ ':''}הוכן מראש · רק סיום</button>
          <button class="mchip ${st.stage==='scratch'?'on':''}" data-tlstage="scratch" data-k="${m.key}">${st.stage==='scratch'?'✓ ':''}🧫 מאפס היום</button>
        `:`
          <button class="mchip ${st.ready?'on':''}" data-tlready="${m.key}">${st.ready?'✓ ':''}כבר מוכן</button>
          <button class="mchip ${!st.ready?'on':''}" data-tlfresh="${m.key}">${!st.ready?'✓ ':''}מתחיל מאפס</button>
        `}
        ${methodOpts}
        ${orderRow}
        <button class="mchip ${(window._tlSeasOpen&&window._tlSeasOpen.has(m.key))?'on':''}" data-tlseas="${m.key}" data-ck="${ck}">🧂 תיבול${(()=>{const n=selectedSeasonings(m.key).length;return n?` (${n})`:'';})()}</button>
        ${m.key==='cut-18'?`<button class="mchip" data-tlburger>🍔 בורגרים (${burgerDiners().length})</button>`:''}
      </div>
      ${orderWarn}
      <div class="tl-seas" id="tlseas-${ck}" style="display:${(window._tlSeasOpen&&window._tlSeasOpen.has(m.key))?'block':'none'}"></div>
      <div class="tl-stages" id="tlstages-${ck}" style="display:none">${stageRows}${doneRef}</div>
    </div>`;
  }
  function wireRows(){
    const list=$("#tlList");
    list.querySelectorAll('[data-tlstage]').forEach(b=>b.addEventListener('click',()=>{
      const all=tlState(); const k=b.dataset.k; const stg=b.dataset.tlstage;
      all[k]=all[k]||{method:null}; all[k].stage=stg; all[k].ready=(stg==='ready'); tlSetState(all); buildList();
      if(stg==='prepped'||stg==='ready'){ try{ const match=pantry().find(pp=>pp.key===k && (projStage(pp)==='ready'||projStage(pp)==='done')); if(match && typeof toast==='function') toast('💡 יש "'+match.name+'" מוכן במזווה — אפשר לגשר ממנו'); }catch(e){} }
      if(stg==='scratch'){ const meta=resolveItem(k); const sb2=itemScratchBuild(meta); if(sb2){ const sp=splitPhases(sb2.phases); const rest=sp.ahead.find(p=>/24|48|לילה/.test(p.label+p.body)); if(rest && typeof toast==='function') toast('⚠ שים לב: יש שלב יישון ארוך (24-48ש) — כדאי להתחיל יום-יומיים מראש'); } }
    }));
    list.querySelectorAll('[data-tlready]').forEach(b=>b.addEventListener('click',()=>{
      const all=tlState(); const k=b.dataset.tlready; all[k]=all[k]||{method:null}; all[k].ready=true; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlfresh]').forEach(b=>b.addEventListener('click',()=>{
      const all=tlState(); const k=b.dataset.tlfresh; all[k]=all[k]||{method:null}; all[k].ready=false; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlmethod]').forEach(sel=>sel.addEventListener('change',()=>{
      const all=tlState(); const k=sel.dataset.tlmethod; all[k]=all[k]||{ready:true}; all[k].method=sel.value; all[k].methodPinned=true; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlorder]').forEach(sel=>sel.addEventListener('change',()=>{
      const all=tlState(); const k=sel.dataset.tlorder; all[k]=all[k]||{ready:true}; all[k].svSmokeOrder=sel.value; tlSetState(all); buildList();
    }));
    window._tlSeasOpen=window._tlSeasOpen||new Set();
    const renderTlSeas=(key,ck)=>{
      const host=document.getElementById('tlseas-'+ck); if(!host) return;
      const meta=resolveItem(key); if(!meta) return;
      const c=meta.obj||meta; const cat=meta.cat||c.cat;
      const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(c);
      host.innerHTML=seasPickerHTML(key,cat,isProd,'edit');
      wireSeasPicker(host,key,cat,isProd,'edit',()=>{ buildList(); }, (typeof openTimeline==='function')?openTimeline:null);
    };
    list.querySelectorAll('[data-tlburger]').forEach(b=>b.addEventListener('click',()=>{ if(typeof openBurgerBuilder==='function') openFrom(openTimeline, openBurgerBuilder); }));
    list.querySelectorAll('[data-tlseas]').forEach(b=>b.addEventListener('click',()=>{
      const key=b.dataset.tlseas, ck=b.dataset.ck;
      if(window._tlSeasOpen.has(key)) window._tlSeasOpen.delete(key); else window._tlSeasOpen.add(key);
      buildList();
    }));
    [...(window._tlSeasOpen||[])].forEach(key=>{ const meta=resolveItem(key); if(!meta){window._tlSeasOpen.delete(key);return;} renderTlSeas(key,cssKey(key)); });
    list.querySelectorAll('[data-tlexp]').forEach(b=>b.addEventListener('click',()=>{
      const el=document.getElementById('tlstages-'+b.dataset.ck);
      if(el){ const open=el.style.display!=='none'; el.style.display=open?'none':'block'; b.textContent=open?'▾':'▴'; }
    }));
    list.querySelectorAll('[data-tlpantry]').forEach(b=>b.addEventListener('click',()=>openFrom(openTimeline,openPantry)));
    list.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
  }
  buildList();
}

/* ---- backup / restore (export-import) ---- */
function exportData(){
  const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}
  const payload={app:'matkonet',ver:1,exported:new Date().toISOString(),data:o};
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download='matkonet-backup-'+today()+'.json'; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const o=JSON.parse(r.result), d=(o&&o.data)?o.data:o;
      if(!d||typeof d!=='object') throw 0;
      Object.entries(d).forEach(([k,v])=>{try{localStorage.setItem(k,v);}catch(e){}});
      favs=new Set(store.get('mk-fav')||[]);
      applyAppearance();
      updateFavBadge(); updateCartBadge(); render();
      if(typeof toast==='function')toast('✓ הנתונים יובאו ושוחזרו בהצלחה');
    }catch(e){ if(typeof toast==='function')toast('❌ הקובץ אינו גיבוי תקין של מתכונת'); }
  };
  r.onerror=()=>{ if(typeof toast==='function')toast('❌ שגיאה בקריאת הקובץ'); };
  r.readAsText(file);
}
// ── "הציוד שלי" — equipment profile (settings) ──
function openGear(){
  const g=gearState();
  const groups=GEAR_GROUPS.map(grp=>`
    <div class="gear-group"><h4>${grp.g}</h4>
      ${grp.items.map(it=>`<div class="gear-row"><label>${it.label}</label>
        <select data-gear="${it.id}">${it.opts.map(o=>`<option ${((g[it.id]||it.opts[0])===o)?'selected':''}>${o}</option>`).join('')}</select>
      </div>`).join('')}
    </div>`).join('');
  showPanel(`${toolTop('הציוד שלי','בחר מה יש לך — המתכונים יתאימו את עצמם','🔧','#5a7d8c')}
   <div class="panel-body">
     <p class="section-sub" style="margin-bottom:12px">האפליקציה תסמן שיטות שאין לך ציוד עבורן ותציע חלופות. תמיד אפשר להפעיל בכל זאת (override).</p>
     ${groups}
     <div id="gearSummary" class="gear-summary"></div>
     <button class="akc-back" id="gearDone">✓ שמור וסגור</button>
   </div>`);
  const pnl=$("#panel");
  const line=(ok,txt)=>`<span class="gcap ${ok?'ok':'no'}">${ok?'✓':'✕'} ${txt}</span>`;
  const refreshSummary=()=>{ const el=$("#gearSummary"); if(el) el.innerHTML=`<b>יכולות בישול פעילות:</b><div class="gcaps">${line(canSV(),'סו-ויד')}${line(canSmoke(),'עישון')}${line(canGrill(),'גריל')}</div>`; };
  pnl.querySelectorAll('[data-gear]').forEach(sel=>sel.addEventListener('change',()=>{
    const gg=gearState(); gg[sel.dataset.gear]=sel.value; saveGear(gg); gearSetConfigured();
    const b=$("#gearBanner"); if(b) b.remove();
    refreshSummary();
  }));
  { const d=$("#gearDone"); if(d) d.addEventListener('click',()=>{ gearSetConfigured(); closePanel(); if(typeof render==='function') render(); }); }
  refreshSummary();
}
function openBackup(){
  showPanel(`${toolTop('גיבוי ושחזור','ייצוא וייבוא כל הנתונים שלך','💾','#6a8caf')}
   <div class="panel-body">
     <div class="kbox k-ok">כל הנתונים שלך (מועדפים, יומן, מזווה, הערות, דירוגים, רשימות וצ׳קליסטים) נשמרים <b>רק בדפדפן הזה</b>. ייצא קובץ גיבוי כדי לא לאבד אותם בניקוי דפדפן או במעבר מכשיר.</div>
     <div class="exactions" style="margin-top:14px">
       <button id="bkExp">⬇ ייצא קובץ גיבוי</button>
       <label class="exbtn-lbl" for="bkImp">⬆ ייבא מקובץ</label>
       <input type="file" id="bkImp" accept="application/json,.json" hidden>
     </div>
     <p class="section-sub" style="margin-top:12px">שים לב: ייבוא מחליף את הנתונים הנוכחיים בתוכן הקובץ.</p>
     <div style="border-top:1px solid var(--line);margin:18px 0 0;padding-top:16px">
       <div class="kbox k-danger"><b>אזור מסוכן</b> · איפוס-על מוחק את <b>כל</b> הנתונים שלך במכשיר הזה: מועדפים, דירוגים, הערות, יומן, מזווה, רשימת קניות, בחירות מידת-עשייה, תפריט ומתזמן. אין ביטול — כדאי לייצא גיבוי קודם.</div>
       <button id="bkWipe" class="mreset" style="margin-top:12px">🗑️ איפוס-על — מחק הכל</button>
     </div>
   </div>`);
  $("#bkExp").addEventListener('click',exportData);
  $("#bkImp").addEventListener('change',e=>{ if(e.target.files[0]) importData(e.target.files[0]); });
  $("#bkWipe").addEventListener('click',wipeAllData);
}
function wipeAllData(){
  const btn=$("#bkWipe");
  if(btn && btn.dataset.armed!=='1'){
    btn.dataset.armed='1'; btn.textContent='⚠ לחץ שוב לאישור — פעולה בלתי הפיכה';
    clearTimeout(window._wipeTmo); window._wipeTmo=setTimeout(()=>{ if(btn){btn.dataset.armed='0'; btn.textContent='🗑️ איפוס-על — מחק הכל';} },4000);
    return;
  }
  const snapshot={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); snapshot[k]=localStorage.getItem(k);}
  const keys=Object.keys(snapshot);
  keys.forEach(k=>{ if(k.startsWith('mk-')||k.startsWith('note:')||k.startsWith('rating:')||k.startsWith('shop:')||k.startsWith('done:')) localStorage.removeItem(k); });
  favs=new Set(); cart=new Set(); activeCats.clear(); activeGroup=null;
  filters={fav:false,kosher:false,method:'',diff:0,time:0};
  const qq=$("#q"); if(qq) qq.value="";
  syncChips(); buildFilterBar(); updateCartBadge(); updateFavBadge(); render();
  closePanel();
  toast('כל הנתונים אופסו',()=>{ Object.entries(snapshot).forEach(([k,v])=>localStorage.setItem(k,v)); favs=new Set(store.get('mk-fav')||[]); cart=new Set(); updateCartBadge(); updateFavBadge(); render(); });
}

/* ---- exit the app (best-effort for installed PWA) ---- */
function exitApp(){
  // the window.open('','_self') step marks the window script-closable on some browsers
  try{ window.open('','_self'); window.close(); }catch(e){}
  try{ window.close(); }catch(e){}
  setTimeout(()=>toast('אנדרואיד חוסם סגירה עצמית — צא עם מחוות/כפתור "חזרה" של המכשיר'),350);
}

/* ---- tools hub ---- */
function toolTop(title,sub,emoji,col){
  return `<div class="panel-top" style="--c:${col||'var(--ember)'}"><button class="x" aria-label="סגור">✕</button><div class="cat" style="color:${col||'var(--ember)'}">${emoji||'🧰'} כלי עזר</div><h2>${title}</h2><div class="en">${sub||''}</div></div>`;
}
function openTools(){
  const tools=[
    ['🕒','מתזמן ציר-זמן',openTimeline],['🎉','בונה תפריט לאירוח',openMenu],
    ['🧫','פרויקטים ומזווה',openPantry],['📓','יומן בישולים',openJournal],
    ['⏰','תזכורות',openReminders],['🆘','מצב הצילו',openHelp],
    ['🔥','שאל את האש',openAsk],['🪵','מדריך עצים',()=>openWoods()],
    ['🥩','מתרגם נתחים',openCutTrans],['🧮','מחשבון מלח/כמויות',openCalc],
    ['🧂','מתבלים ורטבים',()=>openSeasonings()],
    ['💾','גיבוי ושחזור',openBackup],['🛒','רשימת קניות',openCart],
    ['ℹ️','אודות והיכולות',()=>{location.href='product.html';}],
    ['🚪','יציאה מהאפליקציה',exitApp]
  ];
  showPanel(`${toolTop('כלים','כל הכלים של מדריך האש','🧰','#b5603a')}
   <div class="panel-body"><div class="toolgrid">${tools.map((t,i)=>`<button class="toolbtn" data-tool="${i}"><span>${t[0]}</span>${t[1]}</button>`).join("")}</div></div>`);
  $("#panel").querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{
    const fn=tools[+b.dataset.tool][2];
    if(fn===exitApp || tools[+b.dataset.tool][1]==='אודות והיכולות'){ fn(); return; } // these leave the app
    openFrom(openTools, fn);
  }));
}

// (legacy .navrow handler removed — catalog now uses category tiles)
$("#favBtn").addEventListener("click",()=>{
  filters.fav=!filters.fav; $("#favBtn").classList.toggle("on",filters.fav);
  if(filters.fav){activeCats.clear();setCatNav(null);catView('fav');} else { catView('landing'); }
});
(()=>{ const ab=$("#aboutTop"); if(ab) ab.addEventListener("click",()=>{location.href='product.html';});
        const eb=$("#exitTop"); if(eb) eb.addEventListener("click",exitApp); })();
(()=>{ const cb=$("#clearAll"); if(cb) cb.addEventListener("click",()=>{
  $("#q").value=""; activeCats.clear(); activeGroup=null;
  filters={fav:false, kosher:false, method:'', diff:0, time:0};
  const fb=$("#favBtn"); if(fb) fb.classList.remove("on");
  buildChips(); buildFilterBar(); catView('landing');
  toast("הסינון נוקה");
}); })();

/* ── v144: appearance system — color themes · font pairs · text scale ── */
const THEMES={
  cream:{ name:'שמנת חמה', dots:['#fdf6ec','#e76f51','#1a9a7a'],
    t:{'--char':'#fdf6ec','--char2':'#fffaf3','--char3':'#fff2e4','--ember':'#e76f51','--ember2':'#f4a261','--ash':'#6e5340','--bone':'#5a3a28','--smoke':'#7a5f4c','--line':'#f0dcc4','--line2':'#f5e0c8','--fresh':'#1a9a7a','--fresh-l':'#d8f0e8','--bg2':'#faecd8','--card':'#fffaf3','--good':'#1a9a7a','--terra-d':'#d2691e'} },
  charcoal:{ name:'פחם ולהבה', dots:['#17150f','#f59a45','#5bc49f'],
    t:{'--char':'#17150f','--char2':'#221d15','--char3':'#2c2519','--ember':'#f59a45','--ember2':'#f5b45e','--ash':'#b39c7d','--bone':'#f7ecdb','--smoke':'#c4b096','--line':'#3d352a','--line2':'#453c2f','--fresh':'#5bc49f','--fresh-l':'#233129','--bg2':'#17150f','--card':'#221d15','--good':'#5bc49f','--terra-d':'#f2913d'} },
  walnut:{ name:'עץ ועשן', dots:['#e8dcc6','#9a5528','#3f5b50'],
    t:{'--char':'#e8dcc6','--char2':'#f3ead9','--char3':'#ddcdb0','--ember':'#9a5528','--ember2':'#b56a35','--ash':'#5f4c38','--bone':'#33281c','--smoke':'#6e5a44','--line':'#d0bd9c','--line2':'#c7b18d','--fresh':'#3f5b50','--fresh-l':'#d9e3dd','--bg2':'#e8dcc6','--card':'#f3ead9','--good':'#3f5b50','--terra-d':'#9a4a1e'} },
  slate:{ name:'נחושת ומלח', dots:['#e7eaee','#a55f2e','#2f6070'],
    t:{'--char':'#e7eaee','--char2':'#f6f8fa','--char3':'#dde2e7','--ember':'#a55f2e','--ember2':'#bc7440','--ash':'#4d5560','--bone':'#232830','--smoke':'#5c6672','--line':'#cdd4db','--line2':'#c1c9d1','--fresh':'#2f6070','--fresh-l':'#d7e5ea','--bg2':'#e7eaee','--card':'#f6f8fa','--good':'#2f6070','--terra-d':'#a5522e'} }
};
const FONT_PAIRS={
  current:{ name:'נוכחי', display:"'Suez One'", body:"'Heebo'" },
  editorial:{ name:'מגזין', display:"'Frank Ruhl Libre'", body:"'Assistant'" },
  geometric:{ name:'גאומטרי', display:"'Secular One'", body:"'Rubik'" },
  humanist:{ name:'הומניסטי', display:"'David Libre'", body:"'Alef'" }
};
const FONT_SCALES=[0.9,1,1.15,1.3];
const FONT_SCALE_LABELS={0.9:'קטן',1:'רגיל',1.15:'גדול',1.3:'גדול מאוד'};
function themeKey(){ const t=store.get('mk-theme'); return THEMES[t]?t:'cream'; }          // migrates old coal/vintage/gold → cream
function fontPairKey(){ const f=store.get('mk-fontpair'); return FONT_PAIRS[f]?f:'current'; }
function fontScale(){ const s=+store.get('mk-fontscale'); return FONT_SCALES.includes(s)?s:1; }
const THEME_SCHEME={cream:'light',charcoal:'dark',walnut:'light',slate:'light'};   // native form-control rendering hint
function applyAppearance(){
  const el=document.documentElement;
  el.classList.remove('light','t-vintage','t-gold');   // clear dead legacy classes permanently
  const th=THEMES[themeKey()].t;
  Object.entries(th).forEach(([k,v])=>el.style.setProperty(k,v));
  el.style.setProperty('color-scheme', THEME_SCHEME[themeKey()]||'light');   // v144: stop the browser from auto-dark-moding inputs against our own theme
  const fp=FONT_PAIRS[fontPairKey()];
  el.style.setProperty('--font-display', fp.display);
  el.style.setProperty('--font-body', fp.body);
  el.style.setProperty('--fscale', String(fontScale()));
}
function setTheme(k){ if(!THEMES[k]) return; store.set('mk-theme',k); applyAppearance(); }
function setFontPair(k){ if(!FONT_PAIRS[k]) return; store.set('mk-fontpair',k); applyAppearance(); }
function setFontScale(n){ if(!FONT_SCALES.includes(n)) return; store.set('mk-fontscale',n); applyAppearance(); }
applyAppearance();
/* ── v144: UI levels (beginner/mid/pro) + per-level default work-plan shape ── */
const UI_LEVELS={
  beginner:{ name:'מתחיל', desc:'הדרכה צעד-אחר-צעד, פחות מספרים בבת אחת' },
  mid:{ name:'בינוני', desc:'האיזון הרגיל — כל המידע, בלי עומס יתר' },
  pro:{ name:'מתקדם', desc:'הכל גלוי: מספרים מדויקים, כל האפשרויות' }
};
const LEVEL_SHAPE={beginner:'5', mid:'1', pro:'3'};   // 5=צירים מתקפלים · 1=קו-זמן אנכי · 3=צעדים אופקי
const SHAPE_NAMES={'5':'צירים מתקפלים','1':'קו-זמן אנכי','3':'צעדים אופקי'};
function uiLevel(){ const l=store.get('mk-uilevel'); return UI_LEVELS[l]?l:'mid'; }
function setUiLevel(l){ if(!UI_LEVELS[l]) return; store.set('mk-uilevel',l); }
function tlShapeOverride(){ const s=store.get('mk-tlshape'); return SHAPE_NAMES[s]?s:null; }
function tlShape(){ return tlShapeOverride()||LEVEL_SHAPE[uiLevel()]; }
function setTlShape(s){ if(!SHAPE_NAMES[s]) return; store.set('mk-tlshape',s); }
function resetTlShapeToLevel(){ store.set('mk-tlshape',''); }
function openUiLevel(){
  const lvlBtns=Object.entries(UI_LEVELS).map(([k,l])=>`<button class="ap-opt lvl-opt ${k===uiLevel()?'on':''}" data-lvl="${k}">${l.name}</button>`).join('');
  const shapeBtns=Object.entries(SHAPE_NAMES).map(([k,n])=>{
    const isRec=k===LEVEL_SHAPE[uiLevel()];
    return `<button class="ap-opt ${k===tlShape()?'on':''}" data-shp="${k}">${n}${isRec?' <span class="rec-tag">מומלץ</span>':''}</button>`;
  }).join('');
  showPanel(`${toolTop('רמת ממשק','קובע כמה פרטים מוצגים ואיך תוכנית-העבודה נראית','🧭','#5a7d8c')}
    <div class="panel-body">
      <div class="ap-lbl">🧭 הרמה שלי</div>
      <div class="ap-opts">${lvlBtns}</div>
      <p class="section-sub" id="uiLevelDesc" style="margin:8px 2px 0">${UI_LEVELS[uiLevel()].desc}</p>
      <div class="ap-lbl">↔ צורת תוכנית-העבודה</div>
      <div class="ap-opts">${shapeBtns}</div>
      <p class="section-sub" style="margin:8px 2px 0">משתנה אוטומטית לפי הרמה, וניתן לשנות ידנית כאן בכל עת.</p>
    </div>`);
  const pnl=$("#panel");
  pnl.querySelectorAll('[data-lvl]').forEach(b=>b.addEventListener('click',()=>{ setUiLevel(b.dataset.lvl); resetTlShapeToLevel(); openUiLevel(); }));
  pnl.querySelectorAll('[data-shp]').forEach(b=>b.addEventListener('click',()=>{ setTlShape(b.dataset.shp); openUiLevel(); }));
}
function maybeAskUiLevel(){
  if(store.get('mk-uilevel-asked')) return;
  store.set('mk-uilevel-asked', true);
  showPanel(`${toolTop('כמה ניסיון יש לך?','זה קובע כמה פרטים נציג בבת אחת — תמיד אפשר לשנות אח״כ','🧭','#5a7d8c')}
    <div class="panel-body">
      <div class="ap-opts" style="flex-direction:column">
        <button class="ap-opt lvl-opt" data-onb="beginner" style="justify-content:flex-start">🌱 מתחיל — תדריך אותי צעד-אחר-צעד</button>
        <button class="ap-opt lvl-opt on" data-onb="mid" style="justify-content:flex-start">🔥 בינוני — יש לי קצת ניסיון</button>
        <button class="ap-opt lvl-opt" data-onb="pro" style="justify-content:flex-start">🎯 מתקדם — תראה לי הכל</button>
      </div>
    </div>`);
  $("#panel").querySelectorAll('[data-onb]').forEach(b=>b.addEventListener('click',()=>{ setUiLevel(b.dataset.onb); closePanel(); }));
}
function openAppearance(){
  const swatch=(t)=>`<span class="ap-sw"><i style="background:${t.dots[0]}"></i><i style="background:${t.dots[1]}"></i><i style="background:${t.dots[2]}"></i></span>`;
  const themeBtns=Object.entries(THEMES).map(([k,t])=>`<button class="ap-opt ${k===themeKey()?'on':''}" data-aptheme="${k}">${swatch(t)}${t.name}</button>`).join('');
  const fontBtns=Object.entries(FONT_PAIRS).map(([k,f])=>`<button class="ap-opt ${k===fontPairKey()?'on':''}" data-apfont="${k}" style="font-family:${f.display}">${f.name}</button>`).join('');
  const scaleBtns=FONT_SCALES.map(s=>`<button class="ap-opt ${s===fontScale()?'on':''}" data-apscale="${s}">${FONT_SCALE_LABELS[s]}</button>`).join('');
  showPanel(`${toolTop('מראה','גוונים, פונט וגודל טקסט — הבחירה שלך נשמרת','🎨','#c8542f')}
    <div class="panel-body">
      <div class="ap-lbl">🎨 ערכת גוונים</div>
      <div class="ap-opts">${themeBtns}</div>
      <div class="ap-lbl">🔤 זיווג פונטים</div>
      <div class="ap-opts">${fontBtns}</div>
      <div class="ap-lbl">🔠 גודל טקסט</div>
      <div class="ap-opts">${scaleBtns}</div>
      <div class="ap-note">◐ ניגודיות גבוהה פעילה תמיד — קריאוּת מיטבית ליד האש, בכל ערכת גוון.</div>
      <div class="ap-preview"><div class="ap-pt">חזה בקר מעושן</div><div class="ap-pb">כ-28 שעות · דוגמת תצוגה חיה לבחירה שלך.</div></div>
    </div>`);
  const pnl=$("#panel");
  pnl.querySelectorAll('[data-aptheme]').forEach(b=>b.addEventListener('click',()=>{ setTheme(b.dataset.aptheme); openAppearance(); }));
  pnl.querySelectorAll('[data-apfont]').forEach(b=>b.addEventListener('click',()=>{ setFontPair(b.dataset.apfont); openAppearance(); }));
  pnl.querySelectorAll('[data-apscale]').forEach(b=>b.addEventListener('click',()=>{ setFontScale(+b.dataset.apscale); openAppearance(); }));
}
$("#themeBtn").addEventListener('click',openAppearance);

function fillHero(){
  const el=$("#heroSub"); if(!el) return;
  const nCuts=DATA.cuts.length;
  const nCats=new Set(DATA.cuts.map(c=>c.cat)).size;
  const nMakes=Object.keys(DATA.makes).length;
  const nDone=DATA.cuts.filter(c=>c.doneness).length;
  el.innerHTML=`<b>${nCuts} נתחים</b> ב-${nCats} קטגוריות — בשר, עוף, דג, איברים פנימיים, ירקות ופירות — ועוד <b>${nMakes} מתכוני מלאכה</b> (ריפוי, נקניקים, גבינות). לכל פריט: סו-ויד, עישון וגריל, ול-${nDone} נתחים בורר מידת-עשייה מדויק — הכל נגזר מהטבלאות שלך.`;
}
buildChips();buildMakeChips();buildFilterBar();fillHero();buildGloss();updateCartBadge();updateFavBadge();
(()=>{ const bb=$("#catBack"); if(bb) bb.addEventListener('click',()=>{
  const q=($("#q")&&$("#q").value||'').trim();
  if(!activeGroup && !filters.fav && !q){ if(typeof cNavGo==='function') cNavGo('home'); }
  else { if($("#q")) $("#q").value=''; filters.fav=false; const fb=$("#favBtn"); if(fb)fb.classList.remove('on'); setCatNav(null); buildChips(); catView('landing'); }
}); })();
catView('landing');

function cNavState(){ const m=(typeof menuState==='function')?menuState():{guests:8,keys:[]}; return {current:cCurrent, screens:CSCREENS.slice(), serv:m.guests, keys:(m.keys||[]).slice(), step:cWiz.step, steps:CW_STEPS, projectKeys:CPROJECTS.map(p=>p.key), tileCats:CCAT_TILES.map(t=>t[0])}; }
/* ═══════════ Concept C — navigation router ═══════════ */
const CSCREENS=['home','catalog','wizard','events','projects'];
let cCurrent='home';
function cNavGo(s){
  if(s==='more'){ openMoreSheet(); return; }
  if(!CSCREENS.includes(s)) s='home';
  cCurrent=s;
  document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('on', x.id==='scr-'+s));
  document.querySelectorAll('.cnav button[data-cnav]').forEach(b=>b.classList.toggle('on', b.dataset.cnav===s));
  if(s==='catalog'){ if(typeof catView==='function') catView(); requestAnimationFrame(()=>{const m=document.querySelector('#scr-catalog main'); if(m) m.scrollIntoView({block:'start'});}); }
  if(s==='events') cPaintEvents();
  if(s==='projects') cPaintProjects();
  if(s==='home') cRefreshHome();
  if(typeof window.scrollTo==='function') window.scrollTo(0,0);
}
// wizard state — now backed by the REAL menu engine
const cWiz={step:0}; try{window.cWiz=cWiz;}catch(e){}
const CW_STEPS=6;
function cwMenu(){ return (typeof menuState==='function')?menuState():{guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0}; }
function cwSave(s){ if(typeof saveMenu==='function') saveMenu(s); else store.set('mk-menu',s); }
function cwPaintProg(){
  const host=$("#cwProg"); if(!host) return;
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  const vis=cook?[0,1,2,3,5]:[0,1,2,3,4,5];
  const cur=vis.indexOf(cWiz.step);
  host.innerHTML=vis.map((_,i)=>`<div class="cwseg ${i<cur?'done':''} ${i===cur?'cur':''}"></div>`).join('');
}
function cwGo(n){
  n=Math.max(0,Math.min(CW_STEPS-1,n));
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  if(cook&&n===4){ n=(n>cWiz.step)?5:3; }   // cook flow skips the event-extras step
  cWiz.step=n;
  document.querySelectorAll('.cwstep').forEach(s=>s.classList.toggle('on',+s.dataset.cwstep===n));
  cwPaintProg();
  const visSteps=cook?[0,1,2,3,5]:[0,1,2,3,4,5];
  const lbl=$("#cwLbl"); if(lbl) lbl.textContent='שלב '+(visSteps.indexOf(n)+1)+'/'+visSteps.length;
  if(n===0) cwPaintBasics();
  if(n===1) cwPaintPicker();
  if(n===2) cwPaintMethodsFull();
  if(n===3) cwPaintSeasFull();
  if(n===4) cwPaintSidesDrinks();
  if(n===5) cwPaintReview();
  const w=$("#scr-wizard"); if(w&&typeof w.scrollIntoView==='function'){}
  if(typeof window.scrollTo==='function') window.scrollTo(0,0);
}
// ── step 0: basics ──
function cwPaintBasics(){
  const m=cwMenu();
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  const t=$("#cwTitle"); if(t) t.textContent=cook?'🔥 אשף בישול':'🎉 אשף האירוע';
  ['cwEvHead','cwEvSub','cwEvCard'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=cook?'none':''; });
  const v=$("#cServVal"); if(v) v.innerHTML=(m.guests||8)+'<small>סועדים</small>';
  document.querySelectorAll('#cwAppetite .cmethod').forEach(b=>b.classList.toggle('on',b.dataset.app===(m.appetite||'reg')));
  const k=$("#cwKosher"); if(k){ k.dataset.on=m.kosher?'1':'0'; k.classList.toggle('on',!!m.kosher); }
}
// ── step 1: pick from full catalog ──
let cwActiveCat=null, cwQuery='', cwCont='';
function cwAllCats(){
  const s=new Set();
  DATA.cuts.forEach(c=>s.add(c.cat)); Object.values(DATA.makes).forEach(x=>s.add(x.cat)); DATA.specials.forEach(x=>s.add(x.cat));
  return [...s];
}
function cwAllItems(){
  const out=[];
  DATA.cuts.forEach(c=>out.push({key:'cut-'+c.n, heb:c.heb, eng:c.eng||'', cat:c.cat}));
  Object.keys(DATA.makes).forEach(id=>{const x=DATA.makes[id];out.push({key:'make-'+id, heb:x.heb, eng:x.eng||'', cat:x.cat});});
  DATA.specials.forEach(x=>out.push({key:'spec-'+x.n, heb:x.heb, eng:x.eng||'', cat:x.cat}));
  return out;
}
function cwPaintPicker(){
  const chips=$("#cwCatChips");
  if(chips){
    const cats=cwAllCats();
    chips.innerHTML=`<span class="chip ${!cwActiveCat?'on':''}" data-cwcat="">הכל</span>`+cats.map(c=>`<span class="chip ${cwActiveCat===c?'on':''}" data-cwcat="${c}">${(typeof catEmoji==='function'?catEmoji(c):'')} ${c}</span>`).join('');
    chips.querySelectorAll('[data-cwcat]').forEach(el=>el.addEventListener('click',()=>{ cwActiveCat=el.dataset.cwcat||null; cwCont=''; cwPaintPicker(); }));
    // continent sub-filter — shows when the active category has origins (sausages etc.)
    const catItems=cwAllItems().filter(i=>!cwActiveCat||i.cat===cwActiveCat);
    const conts=[...new Set(catItems.map(i=>(typeof itemContinent==='function')?itemContinent(i):'').filter(Boolean))];
    const crow=$("#cwContChips");
    if(crow){ if(conts.length>1){ crow.style.display=''; crow.innerHTML=[['','🌍 כל היבשות'],...conts.map(c=>[c,c])].map(([v,l])=>`<span class="chip ${cwCont===v?'on':''}" data-cwcont="${v}">${l}</span>`).join('');
      crow.querySelectorAll('[data-cwcont]').forEach(el=>el.addEventListener('click',()=>{ cwCont=el.dataset.cwcont; cwPaintPicker(); })); } else { crow.style.display='none'; crow.innerHTML=''; } }
  }
  const sb=$("#cwSearch"); if(sb&&!sb._wired){ sb._wired=1; sb.addEventListener('input',()=>{ cwQuery=sb.value.trim().toLowerCase(); cwPaintPickList(); }); }
  cwPaintPickList();
}
function cwPaintPickList(){
  const host=$("#cwPickList"); if(!host) return;
  const m=cwMenu(); const sel=new Set(m.keys||[]);
  let items=cwAllItems();
  if(cwActiveCat) items=items.filter(i=>i.cat===cwActiveCat);
  if(cwCont) items=items.filter(i=>((typeof itemContinent==='function')?itemContinent(i):'')===cwCont);
  if(cwQuery) items=items.filter(i=>(i.heb+' '+i.eng+' '+i.cat).toLowerCase().includes(cwQuery));
  if(m.kosher) items=items.filter(i=>(typeof isKosherOk!=='function')||isKosherOk(i.key));   // pork + shellfish + blood
  const cnt=$("#cwPickCount"); if(cnt){ cnt.innerHTML=`<span>🌿 ${sel.size} נבחרו · ${items.length} מוצגים</span>${sel.size?'<button class="cwclear" id="cwClearSel">נקה בחירה</button>':''}`;
    const cb=$("#cwClearSel"); if(cb) cb.addEventListener('click',()=>{ const mm=cwMenu(); mm.keys=[]; cwSave(mm); cwPaintPickList(); }); }
  // sticky summary of what's already chosen (all categories)
  const selBar=$("#cwPickSel");
  if(selBar){
    const chosen=[...sel];
    if(!chosen.length){ selBar.innerHTML=''; selBar.classList.remove('on'); }
    else{
      selBar.classList.add('on');
      selBar.innerHTML=`<div class="cwsel-title">כבר בעגלה (${chosen.length}):</div><div class="cwsel-chips">`+
        chosen.map(k=>{ const meta=resolveItem(k); const heb=meta?(meta.heb||(meta.obj&&meta.obj.heb)||k):k;
          const ico=(typeof itemEmoji==='function'&&meta)?itemEmoji(meta.cat||(meta.obj&&meta.obj.cat),k):'🍽️';
          return `<span class="cwsel-chip" data-cwunpick="${k}">${ico} ${heb} <b>✕</b></span>`; }).join('')+`</div>`;
      selBar.querySelectorAll('[data-cwunpick]').forEach(el=>el.addEventListener('click',()=>{
        const mm=cwMenu(); mm.keys=(mm.keys||[]).filter(x=>x!==el.dataset.cwunpick); cwSave(mm); cwPaintPickList();
      }));
    }
  }
  host.innerHTML=items.map(i=>{
    const on=sel.has(i.key);
    const ico=(typeof itemEmoji==='function')?itemEmoji(i.cat,i.key):'🍽️';
    const org=(typeof itemOrigin==='function')?itemOrigin(i):'';
    const desc=(typeof itemRichDesc==='function')?itemRichDesc(i):'';
    const sub=[org||i.cat, i.eng].filter(Boolean).join(' · ');
    return `<div class="cmore-item" data-cwpick="${i.key}" style="align-items:flex-start;${on?'border-color:var(--ember);background:linear-gradient(135deg,#fff3e8,#ffe9db)':''}">
      <span class="mi">${ico}</span><div style="flex:1"><div style="font-weight:700">${i.heb}</div><div style="font-size:11px;color:var(--smoke);font-weight:400">${sub}</div>${desc?`<div style="font-size:11px;color:var(--bone);opacity:.75;line-height:1.5;margin-top:3px">${desc}</div>`:''}</div>
      <span class="mg" style="color:${on?'var(--ember)':'var(--smoke)'};font-size:20px">${on?'✓':'+'}</span></div>`;
  }).join('')||'<div style="color:var(--smoke);text-align:center;padding:20px">לא נמצאו פריטים</div>';
  host.querySelectorAll('[data-cwpick]').forEach(el=>el.addEventListener('click',()=>{
    const k=el.dataset.cwpick; const mm=cwMenu(); const s=new Set(mm.keys||[]);
    s.has(k)?s.delete(k):s.add(k); mm.keys=[...s]; cwSave(mm); cwPaintPickList();
  }));
}
// ── step 2: real method toggles per selected item ──
function cwPaintMethodsFull(){
  const host=$("#cwMethodsFull"); if(!host) return;
  const m=cwMenu(); const keys=(m.keys||[]);
  if(!keys.length){ host.innerHTML='<div style="color:var(--smoke);text-align:center;padding:16px">לא נבחרו מנות. חזור לשלב הקודם.</div>'; return; }
  const rows=keys.map(key=>{
    const meta=resolveItem(key); if(!meta) return '';
    const c=meta.obj||meta; const heb=meta.heb||c.heb||key;
    // items that support method toggles are cuts/makes with methodRules
    if(typeof methodRules!=='function'||meta.kind==='spec'){ return `<div class="cscard"><h4>${heb}</h4><div style="font-size:12px;color:var(--smoke)">מוצר מוכן — ללא שיטת בישול</div></div>`; }
    const cur=(typeof activeMethods==='function')?activeMethods(c,key):['grill'];
    const MET=[['sv','🌊 סו-ויד'],['smoke','💨 עישון'],['grill','🔥 גריל']];
    const chips=MET.map(([mk,lbl])=>{
      const valid=(typeof validCombo==='function')?validCombo(c,cur.includes(mk)?cur:[...cur,mk]):true;
      return `<span class="cmethod ${cur.includes(mk)?'on':''}" data-cwm="${key}" data-cwmk="${mk}">${lbl}</span>`;
    }).join('');
    return `<div class="cscard"><h4>${(typeof itemEmoji==='function'?itemEmoji(meta.cat||c.cat,key):'')} ${heb}</h4><div class="cmethods">${chips}</div></div>`;
  }).join('');
  host.innerHTML=rows;
  host.querySelectorAll('[data-cwm]').forEach(el=>el.addEventListener('click',()=>{
    const key=el.dataset.cwm, mk=el.dataset.cwmk; const meta=resolveItem(key); if(!meta) return;
    const c=meta.obj||meta;
    let cur=(typeof activeMethods==='function')?activeMethods(c,key).slice():[];
    if(cur.includes(mk)) cur=cur.filter(x=>x!==mk); else cur.push(mk);
    if(typeof validCombo==='function' && !validCombo(c,cur)){ if(typeof toast==='function') toast('שילוב לא תקין למוצר זה'); return; }
    if(typeof methodKeyFor==='function') store.set(methodKeyFor(key),cur);
    cwPaintMethodsFull();
  }));
}
// ── step 3: seasonings per selected item (with kind + description) ──
function cwSeasFull_desc(s){
  // short one-liner: prefer .use, fall back to ingredients summary
  let d=(s.use||'').trim();
  if(!d) d=(s.ing||'').split(/[.,]/)[0];
  if(d.length>72) d=d.slice(0,70).trim()+'…';
  return d;
}
function cwPaintSeasFull(){
  const host=$("#cwSeasFull"); if(!host) return;
  { const nb=document.querySelector('[data-cwstep="3"] [data-cwgo="4"]'); if(nb) nb.textContent=(typeof menuCtx==='function'&&menuCtx()==='cook')?'המשך לסקירה ותוכנית ←':'המשך לתוספות וקינוחים ←'; }
  const m=cwMenu(); const keys=(m.keys||[]);
  if(!keys.length){ host.innerHTML='<div class="cscard"><h4>אין מנות</h4><div style="font-size:12.5px;color:var(--smoke)">חזור לשלב "מה על האש" ובחר פריטים.</div></div>'; return; }
  host.innerHTML=keys.map(key=>{
    const meta=resolveItem(key); if(!meta) return '';
    const c=meta.obj||meta; const heb=meta.heb||c.heb||key;
    const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(c);
    const list=(typeof seasoningsFor==='function')?seasoningsFor(meta.cat||c.cat,isProd):[];
    if(!list.length) return `<div class="cscard"><h4>${(typeof itemEmoji==='function'?itemEmoji(meta.cat||c.cat,key):'')} ${heb}</h4><div style="font-size:12px;color:var(--smoke)">אין מתבלים ייעודיים לפריט זה</div></div>`;
    const burgerBtn=key==='cut-18'?`<button class="mchip" data-cwburger style="margin:2px 0 8px">🍔 בנה את הבורגר — גבינה, תוספות ורטבים</button>`:'';
    return `<div class="cscard"><h4>${(typeof itemEmoji==='function'?itemEmoji(meta.cat||c.cat,key):'')} ${heb}</h4>${burgerBtn}${seasPickerHTML(key, meta.cat||c.cat, isProd, 'edit')}</div>`;
  }).join('');
  keys.forEach(key=>{
    const meta=resolveItem(key); if(!meta) return;
    const c=meta.obj||meta;
    const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(c);
    wireSeasPicker(host, key, meta.cat||c.cat, isProd, 'edit', null);
  });
  host.querySelectorAll('[data-cwburger]').forEach(bb=>bb.addEventListener('click',()=>{ if(typeof openBurgerBuilder==='function') openBurgerBuilder(); }));
}
// set exactly one (or none) seasoning of a given kind for an item
function cwApplySeasKind(key,kind,sid){
  if(typeof selectedSeasonings!=='function'||typeof toggleSeasoning!=='function') return;
  // remove any currently selected of this kind
  selectedSeasonings(key).slice().forEach(id=>{
    const s=(typeof seasoningById==='function')?seasoningById(id):null;
    if(s && s.kind===kind) toggleSeasoning(key,id);
  });
  // add the chosen one (if not "none")
  if(sid) toggleSeasoning(key,sid);
}
// compat: toggle by seasoning id, enforcing single-per-kind (used by tests/legacy)
function cwToggleSeasByKind(key,sid){
  if(typeof selectedSeasonings!=='function') return;
  const target=(typeof seasoningById==='function')?seasoningById(sid):null;
  if(selectedSeasonings(key).includes(sid)){ toggleSeasoning(key,sid); return; }
  if(target) cwApplySeasKind(key,target.kind,sid); else toggleSeasoning(key,sid);
}
// ── step 4: sides + drinks matched to selected cats ──
function cwSelectedCats(){
  const m=cwMenu(); const s=new Set();
  (m.keys||[]).forEach(k=>{const meta=resolveItem(k); if(meta) s.add(meta.cat||(meta.obj&&meta.obj.cat));});
  return s;
}
function cwPaintSidesDrinks(){
  const cats=cwSelectedCats(); const m=cwMenu();
  const match=(t)=>t.includes('*')||t.some(x=>cats.has(x));
  const sh=$("#cwSides");
  if(sh && typeof SIDES!=='undefined'){
    const sel=new Set(m.sides||[]);
    const av=SIDES.filter(s=>match(s.t));
    sh.innerHTML=av.map(s=>`<span class="cmethod ${sel.has(s.n)?'on':''}" data-cwside="${s.n}">${sel.has(s.n)?'✓ ':''}${s.n}</span>`).join('')||'<div style="color:var(--smoke);font-size:12px">בחר מנות קודם</div>';
    sh.querySelectorAll('[data-cwside]').forEach(el=>el.addEventListener('click',()=>{
      const mm=cwMenu(); const s=new Set(mm.sides||[]); const n=el.dataset.cwside;
      s.has(n)?s.delete(n):s.add(n); mm.sides=[...s]; cwSave(mm); cwPaintSidesDrinks();
    }));
  }
  const dh=$("#cwDrinks");
  if(dh && typeof DRINKS!=='undefined'){
    const sel=new Set(m.drinks||[]);
    const av=DRINKS.filter(s=>match(s.t));
    const SUBS=[['soft','🥤 רכה'],['beer','🍺 בירה'],['wine','🍷 יין'],['spirit','🥃 חריף'],['cocktail','🍸 קוקטיילים']];
    const chip=s=>`<span class="cmethod ${sel.has(s.n)?'on':''}" data-cwdrink="${s.n}">${sel.has(s.n)?'✓ ':''}${s.n}</span>`;
    const html=SUBS.map(([sub,label])=>{ const grp=av.filter(d=>(d.sub||d.k)===sub); if(!grp.length) return '';
      return `<div class="cwd-sub"><div class="cwd-lbl">${label}</div><div class="cmethods" style="flex-wrap:wrap">${grp.map(chip).join('')}</div></div>`;
    }).join('');
    dh.innerHTML=html||'<div style="color:var(--smoke);font-size:12px">בחר מנות קודם</div>';
    dh.querySelectorAll('[data-cwdrink]').forEach(el=>el.addEventListener('click',()=>{
      const mm=cwMenu(); const s=new Set(mm.drinks||[]); const n=el.dataset.cwdrink;
      s.has(n)?s.delete(n):s.add(n); mm.drinks=[...s]; cwSave(mm); cwPaintSidesDrinks();
    }));
  }
  const dsh=$("#cwDesserts");
  if(dsh && typeof DESSERTS!=='undefined'){
    const sel=new Set(m.desserts||[]);
    let html=DESSERTS.map(d=>`<span class="cmethod ${sel.has(d.n)?'on':''}" data-cwdessert="${d.n}">${sel.has(d.n)?'✓ ':''}${d.fire?'🔥 ':''}${d.n}</span>`).join('');
    html+=`<div class="cwd-sub" style="width:100%"><div class="cwd-lbl">🍑 פירות טריים — ${eventSeason()}${m.evDate?' (לפי תאריך האירוע)':' (החודש)'}</div><span class="cmethod ${sel.has('__fruit')?'on':''}" data-cwdessert="__fruit">${sel.has('__fruit')?'✓ ':''}🍉 מגש פירות העונה: ${seasonalFruitList().join(' · ')}</span></div>`;
    dsh.innerHTML=html;
    dsh.querySelectorAll('[data-cwdessert]').forEach(el=>el.addEventListener('click',()=>{
      const mm=cwMenu(); const s=new Set(mm.desserts||[]); const n=el.dataset.cwdessert;
      s.has(n)?s.delete(n):s.add(n); mm.desserts=[...s]; cwSave(mm); cwPaintSidesDrinks();
    }));
  }
}
// ── step 5: review + serve time + generate real plan ──
function cwPaintReview(){
  const m=cwMenu();
  { const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
    const se=document.getElementById('cwSaveEvent'); if(se) se.style.display=cook?'none':'';
    const fe=document.querySelector('#scr-wizard [data-cgo="events"]'); if(fe) fe.style.display=cook?'none':''; }
  const sv=$("#cwServe"); if(sv){ sv.value=store.get('mk-tlserve')||'19:00'; if(!sv._wired){sv._wired=1; sv.addEventListener('change',()=>store.set('mk-tlserve',sv.value));} }
  const host=$("#cwReview"); if(!host) return;
  const keys=(m.keys||[]);
  const gpp=(typeof window.gpp==='function')?window.gpp(m.appetite):({light:200,reg:280,heavy:380}[m.appetite]||280);
  const totalG=Math.round(gpp*(m.guests||8)/1000*10)/10;
  const dishRow=keys.map(k=>{const meta=resolveItem(k); if(!meta) return ''; const heb=meta.heb||(meta.obj&&meta.obj.heb)||k;
    const meth=(typeof activeMethods==='function'&&meta.kind!=='spec')?activeMethods(meta.obj||meta,k):[];
    const seas=(typeof selectedSeasonings==='function')?selectedSeasonings(k).length:0;
    const mlabel={sv:'סו-ויד',smoke:'עישון',grill:'גריל'};
    return `<div class="csum-row"><span class="si">${(typeof itemEmoji==='function'?itemEmoji(meta.cat||(meta.obj&&meta.obj.cat),k):'🍽️')}</span><div class="sb"><div class="st">${heb}</div><div class="sd">${meth.map(x=>mlabel[x]||x).join(' + ')||'מוכן'}${seas?' · '+seas+' מתבלים':''}</div></div></div>`;
  }).join('');
  host.innerHTML=`<div class="cscard"><h4>📋 התפריט · ${m.guests||8} סועדים · ~${totalG} ק״ג בשר</h4>
    ${dishRow||'<div style="color:var(--smoke)">לא נבחרו מנות</div>'}
    ${(m.sides||[]).length?`<div class="csum-row"><span class="si">🥗</span><div class="sb"><div class="st">תוספות</div><div class="sd">${m.sides.join(' · ')}</div></div></div>`:''}
    ${(m.drinks||[]).length?`<div class="csum-row"><span class="si">🥤</span><div class="sb"><div class="st">שתייה</div><div class="sd">${m.drinks.join(' · ')}</div></div></div>`:''}
    ${(m.desserts||[]).length?`<div class="csum-row"><span class="si">🍮</span><div class="sb"><div class="st">קינוחים</div><div class="sd">${m.desserts.map(x=>x==='__fruit'?'מגש פירות העונה ('+eventSeason()+')':x).join(' · ')}</div></div></div>`:''}
  </div>`;
  // seed resume for home
  const firstName=keys.length?(resolveItem(keys[0])||{}).heb:'ארוחה';
  store.set('mk-cresume',{title:(firstName||'ארוחה')+(keys.length>1?' ועוד':''), serv:m.guests||8, ctx:(typeof menuCtx==='function'?menuCtx():'event'), step:cWiz.step, ts:Date.now()});
}
// wire wizard controls
(function(){
  const p=$("#cServPlus"),mi=$("#cServMinus");
  const upd=(d)=>{ const m=cwMenu(); m.guests=Math.max(1,(m.guests||8)+d); cwSave(m); const v=$("#cServVal"); if(v) v.innerHTML=m.guests+'<small>סועדים</small>'; };
  if(p) p.addEventListener('click',()=>upd(1)); if(mi) mi.addEventListener('click',()=>upd(-1));
  document.querySelectorAll('#cwAppetite .cmethod').forEach(b=>b.addEventListener('click',()=>{
    const m=cwMenu(); m.appetite=b.dataset.app; cwSave(m);
    document.querySelectorAll('#cwAppetite .cmethod').forEach(x=>x.classList.toggle('on',x===b));
  }));
  const kb=$("#cwKosher"); if(kb) kb.addEventListener('click',()=>{
    const m=cwMenu(); m.kosher=!m.kosher; cwSave(m); kb.classList.toggle('on',m.kosher);
    if(typeof cwPaintPickList==='function') cwPaintPickList();   // re-filter the list immediately
  });
  document.querySelectorAll('[data-cwgo]').forEach(b=>b.addEventListener('click',()=>cwGo(+b.dataset.cwgo)));
  const back=$("#cwBack"); if(back) back.addEventListener('click',()=>{ if(cWiz.step>0) cwGo(cWiz.step-1); else cNavGo('home'); });
  const gen=$("#cwGenPlan"); if(gen) gen.addEventListener('click',()=>{ const sv=$("#cwServe"); if(sv) store.set('mk-tlserve',sv.value); if(typeof openTimeline==='function') openTimeline(); });
  const om=$("#cwOpenMenu"); if(om) om.addEventListener('click',()=>{ if(typeof openMenu==='function') openMenu(); });
  const vc=$("#cwVoice"); if(vc) vc.addEventListener('click',()=>{
    // build the work-plan tasks (openTimeline populates window._wpTasks synchronously), then launch voice
    if(typeof openTimeline==='function') openTimeline();
    const tasks=(typeof window!=='undefined'&&window._wpTasks)||[];
    if(tasks.length && typeof openVoiceCook==='function') openVoiceCook(tasks);
    else if(typeof toast==='function') toast('אין שלבים לבישול קולי — ודא שיש פריטים בתפריט ושהם לא רב-יומיים');
  });
  // event identity fields → persist into working menu (so save snapshots them)
  const nm=$("#cwEvName"); if(nm) nm.addEventListener('input',()=>{ const m=cwMenu(); m.evName=nm.value; cwSave(m); });
  const ds=$("#cwEvDesc"); if(ds) ds.addEventListener('input',()=>{ const m=cwMenu(); m.evDesc=ds.value; cwSave(m); });
  const dt=$("#cwEvDate"); if(dt) dt.addEventListener('change',()=>{ const m=cwMenu(); m.evDate=dt.value; cwSave(m); });
  const se=$("#cwSaveEvent"); if(se) se.addEventListener('click',async()=>{
    const m=cwMenu();
    let name=(m.evName||'').trim();
    if(!name){ const v=await appPrompt('שם לאירוע:','',{placeholder:'למשל: שישי במשפחה',okLabel:'💾 שמור'}); if(v===null||v===false) return; name=v||'אירוע ללא שם'; const mm=cwMenu(); mm.evName=name; cwSave(mm); const nmf=$("#cwEvName"); if(nmf) nmf.value=name; }
    evSaveCurrent(name); if(typeof toast==='function') toast('האירוע נשמר ✓'); cNavGo('events');
  });
})();
function cwSeedResume(){ cwPaintReview(); }
function cwPaintMethods(){ /* legacy no-op retained */ }
function cwPaintProteins(){ /* legacy no-op retained */ }
function cwUpdateHint(){ /* legacy no-op */ }
function cRefreshHome(){
  const r=store.get('mk-cresume'); const box=$("#cResume"); if(!box) return;
  // validate against the store for the SAVED context (cook -> mk-cook, event -> mk-menu), not always mk-menu
  const savedCtx=(r&&r.ctx==='cook')?'cook':'event';
  const savedMenu=store.get(savedCtx==='cook'?'mk-cook':'mk-menu')||{keys:[]};
  const hasDraft=(savedMenu.keys||[]).length>0;
  if(r&&r.title&&hasDraft){ box.hidden=false; const m=$("#cResumeM"); if(m) m.textContent=`${r.title} · ${r.serv} סועדים${savedCtx==='cook'?' · בישול':''}`; }
  else { box.hidden=true; if(!hasDraft&&r) store.set('mk-cresume',null); }
  // last active project
  const pbox=$("#cResumeProj");
  if(pbox){
    const lid=store.get('mk-lastproj'); const projs=(typeof pantry==='function')?pantry():[];
    const p=lid&&projs.find?projs.find(x=>x.id===lid):null;
    if(p){ pbox.hidden=false; const pm=$("#cResumeProjM");
      const pr=(typeof projProgress==='function')?projProgress(p):null;
      if(pm) pm.textContent=`${p.name}${pr?' · '+(pr.day||pr.label):''}${pr&&pr.ready?' · מוכן ✓':''}`;
    } else pbox.hidden=true;
  }
  const g=$("#cGreet"); if(g){ const h=new Date().getHours(); g.textContent=(h<12?'בוקר טוב':h<18?'צהריים טובים':'ערב טוב')+' 👋'; }
}
// ═══════════ Event manager (mk-events + draft) ═══════════
function evList(){ const l=store.get('mk-events'); return Array.isArray(l)?l:[]; }
function evSaveList(l){ store.set('mk-events', l); }
function evActive(){ return store.get('mk-active')||null; }
function evGenId(){ return 'ev-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e4).toString(36); }
function evMenuHasContent(m){ m=m||((typeof menuState==='function')?menuState():{keys:[]}); return (m.keys||[]).length>0; }
function isDraft(){ return !evActive() && evMenuHasContent(); }
// snapshot current working menu (mk-menu) into an event
function evSaveCurrent(name,desc,date){
  const m=(typeof menuState==='function')?menuState():{};
  const id=evActive()||evGenId();
  const list=evList();
  const now=Date.now();
  const existing=list.find(e=>e.id===id);
  const rec={ id, name:(name||m.evName||'אירוע ללא שם').trim()||'אירוע ללא שם', desc:(desc!==undefined?desc:(m.evDesc||'')),
    date:(date!==undefined?date:(m.evDate||'')), serve:store.get('mk-tlserve')||'19:00',
    menu:JSON.parse(JSON.stringify(m)), created:existing?existing.created:now, updated:now };
  const idx=list.findIndex(e=>e.id===id);
  if(idx>=0) list[idx]=rec; else list.push(rec);
  evSaveList(list); store.set('mk-active',id);
  return id;
}
function evLoad(id){
  setMenuCtx('event');
  const e=evList().find(x=>x.id===id); if(!e) return false;
  if(typeof saveMenu==='function') saveMenu(JSON.parse(JSON.stringify(e.menu))); else store.set('mk-menu',e.menu);
  if(e.serve) store.set('mk-tlserve',e.serve);
  store.set('mk-active',id);
  return true;
}
function evDelete(id){
  const wasActive=(evActive()===id);
  evSaveList(evList().filter(e=>e.id!==id));
  if(wasActive){ evClearActive(); }
}
function evDeleteAll(){
  evSaveList([]); evClearActive();
}
function evClearActive(){
  setMenuCtx('event');
  // deleting/clearing active → clear the meal builder (per decision)
  const empty={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};
  if(typeof saveMenu==='function') saveMenu(empty); else store.set('mk-menu',empty);
  store.set('mk-active',null);
}
function evNewDraft(){
  setMenuCtx('event');
  // start clean for a new event (wizard)
  const empty={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0,evName:'',evDesc:'',evDate:''};
  if(typeof saveMenu==='function') saveMenu(empty); else store.set('mk-menu',empty);
  store.set('mk-active',null);
  store.set('mk-tlserve','19:00');
}
function evGuardBeforeNew(proceed){
  // if there's an unsaved draft, ask to save/discard before starting new
  if(isDraft()){
    const n=((typeof menuState==='function')?menuState().keys.length:0);
    appConfirm(`יש לך טיוטה לא-שמורה (${n} מנות).\nלשמור אותה כאירוע לפני שמתחילים חדש?`,{okLabel:'💾 שמור והמשך',cancelLabel:'🗑️ מחק והמשך'}).then(ans=>{
      if(ans===null) return;                 // dismissed — abort entirely
      if(ans===true) evSaveCurrent();
      evNewDraft(); proceed&&proceed();
    });
    return;
  }
  evNewDraft(); proceed&&proceed();
}
// ── events screen ──
function cPaintEvents(){
  setMenuCtx('event');
  const host=$("#cEvBody"); if(!host) return;
  const list=evList().slice().sort((a,b)=>(b.updated||0)-(a.updated||0));
  const cnt=$("#cEvCount"); if(cnt) cnt.textContent=list.length?`${list.length} אירועים`:'';
  let html='';
  // draft card
  if(isDraft()){
    const m=menuState(); const n=(m.keys||[]).length;
    html+=`<div class="cscard" style="border-color:var(--fresh);background:var(--fresh-l)">
      <h4 style="color:var(--fresh)">📝 טיוטה נוכחית · לא נשמרה</h4>
      <div style="font-size:13px;color:var(--ash);margin-bottom:10px">${n} מנות · ${m.guests||8} סועדים</div>
      <div style="display:flex;gap:8px"><button class="ccta" id="cEvDraftSave" style="margin:0;flex:1;padding:11px;font-size:14px">💾 שמור כאירוע</button>
      <button class="cwclear" id="cEvDraftDiscard">מחק</button></div></div>`;
  }
  // active id
  const act=evActive();
  if(!list.length && !isDraft()){
    html+=`<div class="cscard"><h4>אין אירועים עדיין</h4><div style="font-size:13px;color:var(--smoke);line-height:1.6">התחל אירוע חדש כדי לבנות תפריט ותוכנית עבודה — הכל יישמר כאן לחזרה ועריכה.</div></div>`;
  }
  html+=list.map(e=>{
    const n=((e.menu&&e.menu.keys)||[]).length;
    const isAct=(e.id===act);
    const dateStr=e.date?new Date(e.date).toLocaleDateString('he-IL',{day:'numeric',month:'short'}):'';
    return `<div class="cevcard ${isAct?'active':''}">
      <div class="cev-main" data-evload="${e.id}">
        <div class="cev-name">${e.name}${isAct?' <span class="cev-badge">פעיל</span>':''}</div>
        ${e.desc?`<div class="cev-desc">${e.desc}</div>`:''}
        <div class="cev-meta">${dateStr?`📅 ${dateStr} · `:''}🍽️ ${n} מנות · 👥 ${e.menu&&e.menu.guests||8}${e.serve?' · ⏰ '+e.serve:''}</div>
        <div class="cev-actions">
          <button class="cev-act" data-evplan="${e.id}">📋 תוכנית עבודה</button>
          <button class="cev-act" data-evcart="${e.id}">🛒 קניות</button>
          <button class="cev-act" data-evprint="${e.id}">🖨️ הדפס תפריט</button>
        </div>
      </div>
      <button class="cev-del" data-evdel="${e.id}" title="מחק">🗑️</button>
    </div>`;
  }).join('');
  if(list.length){
    html+=`<button class="cwclear" id="cEvDelAll" style="margin:14px auto 0;display:block">מחק את כל האירועים</button>`;
  }
  host.innerHTML=html;
  // wire
  const ds=$("#cEvDraftSave"); if(ds) ds.addEventListener('click',async()=>{ const nm=await appPrompt('שם לאירוע:','',{placeholder:'למשל: שישי במשפחה',okLabel:'💾 שמור'}); if(nm===null||nm===false) return; evSaveCurrent(nm||'אירוע ללא שם'); cPaintEvents(); if(typeof toast==='function') toast('האירוע נשמר'); });
  const dd=$("#cEvDraftDiscard"); if(dd) dd.addEventListener('click',async()=>{ if((await appConfirm('למחוק את הטיוטה?',{okLabel:'🗑️ מחק',danger:true}))!==true) return; evClearActive(); cPaintEvents(); });
  host.querySelectorAll('[data-evload]').forEach(el=>el.addEventListener('click',ev=>{
    if(ev.target.closest('[data-evdel],[data-evplan],[data-evprint],[data-evcart]')) return;
    const id=el.dataset.evload; if(evLoad(id)){ if(typeof toast==='function') toast('האירוע נטען · ערוך בבונה-הארוחה או באשף'); cwGo(0); cNavGo('wizard'); cwSyncFromMenu(); }
  }));
  host.querySelectorAll('[data-evplan]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evplan;
    if(evLoad(id) && typeof openTimeline==='function') openTimeline();
  }));
  host.querySelectorAll('[data-evcart]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evcart;
    if(evLoad(id)){ updateCartBadge&&updateCartBadge(); if(typeof openCart==='function') openCart(); }
  }));
  host.querySelectorAll('[data-evprint]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evprint;
    if(evLoad(id) && typeof openMenuPrint==='function') openMenuPrint();
  }));
  host.querySelectorAll('[data-evdel]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evdel;
    appConfirm('למחוק את האירוע?',{okLabel:'🗑️ מחק',danger:true}).then(y=>{ if(y===true){ evDelete(id); cPaintEvents(); } });
  }));
  const da=$("#cEvDelAll"); if(da) da.addEventListener('click',async()=>{ if((await appConfirm('למחוק את כל האירועים?\nפעולה בלתי הפיכה.',{okLabel:'🗑️ מחק הכל',danger:true}))!==true) return; if((await appConfirm('בטוח? כל האירועים יימחקו.',{okLabel:'כן, מחק סופית',danger:true}))!==true) return; evDeleteAll(); cPaintEvents(); });
}
function cwSyncFromMenu(){
  // reflect loaded event into wizard step 0 fields
  const m=(typeof menuState==='function')?menuState():{};
  const nm=$("#cwEvName"); if(nm) nm.value=m.evName||'';
  const ds=$("#cwEvDesc"); if(ds) ds.value=m.evDesc||'';
  const dt=$("#cwEvDate"); if(dt) dt.value=m.evDate||'';
  cwPaintBasics();
}
const CPROJECTS=[
  {ic:'🌭',flag:'🇪🇸',col:'var(--ember)',cat:'נקניק מיובש',t:'צ׳וריסו ספרדי',d:'4-8 שבועות · פימנטון מעושן',key:'make-n-chorizo-esp'},
  {ic:'🥩',flag:'🇺🇸',col:'var(--beef,#c65a3f)',cat:'BBQ',t:'בריסקט 18 שעות',d:'low & slow טקסני · ליווי לילה',key:'cut-1'},
  {ic:'🥓',flag:'🇮🇹',col:'var(--terra-d)',cat:'סלומי',t:'פנצ׳טה ביתית',d:'2-3 שבועות · למתחילים',key:'make-sal-pancetta'},
];
// ── raw-material inventory (mk-inventory) ──
const INV_STARTER=[
  // — מלחי ריפוי ותרביות —
  {name:'מלח נתרני #1 (Cure #1)',unit:'גרם',low:50,grp:'ריפוי'},
  {name:'מלח נתרני #2 (Cure #2)',unit:'גרם',low:50,grp:'ריפוי'},
  {name:'תרבית T-SPX (איטית)',unit:'מנות',low:1,grp:'ריפוי'},
  {name:'תרבית F-LC (מהירה)',unit:'מנות',low:1,grp:'ריפוי'},
  // — שרוולים ומעיים (לפי קוטר) —
  {name:'מעי כבש 22 מ״מ (נקניקיות דקות)',unit:'מטר',low:3,grp:'שרוולים'},
  {name:'מעי חזיר 32 מ״מ (נקניקיות)',unit:'מטר',low:3,grp:'שרוולים'},
  {name:'מעי חזיר 36–40 מ״מ (נקניקים)',unit:'מטר',low:3,grp:'שרוולים'},
  {name:'שרוול קולגן 60 מ״מ',unit:'יח׳',low:5,grp:'שרוולים'},
  {name:'שרוול בקר 50–60 מ״מ (סלמי)',unit:'יח׳',low:3,grp:'שרוולים'},
  {name:'שרוול פיברוס 60–80 מ״מ',unit:'יח׳',low:3,grp:'שרוולים'},
  // — מלחים וסוכרים —
  {name:'מלח ים גס',unit:'גרם',low:200,grp:'מלח וסוכר'},
  {name:'מלח דק (לא-מיודד)',unit:'גרם',low:200,grp:'מלח וסוכר'},
  {name:'סוכר חום',unit:'גרם',low:100,grp:'מלח וסוכר'},
  {name:'דקסטרוז (לתסיסה)',unit:'גרם',low:100,grp:'מלח וסוכר'},
  // — תבלינים —
  {name:'פלפל שחור גס',unit:'גרם',low:50,grp:'תבלינים'},
  {name:'פפריקה מעושנת',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'כמון',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'כוסברה (זרעים)',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'שום גרנולה/אבקה',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'זרעי שומר',unit:'גרם',low:20,grp:'תבלינים'},
  {name:'מיורן מיובש',unit:'גרם',low:20,grp:'תבלינים'},
  // — עצים לעישון —
  {name:'שבבי עץ אלון',unit:'ק״ג',low:1,grp:'עצים'},
  {name:'שבבי עץ תפוח/דובדבן',unit:'ק״ג',low:1,grp:'עצים'},
  {name:'שבבי עץ היקורי',unit:'ק״ג',low:1,grp:'עצים'},
];
function invList(){ const a=store.get('mk-inventory'); return Array.isArray(a)?a:null; }
function invSave(a){ store.set('mk-inventory',a); }
const INV_VER=2; // bump when INV_STARTER changes to merge new items for existing users
function invEnsure(){
  let a=invList();
  if(a===null){ a=INV_STARTER.map(x=>({id:uid(),name:x.name,qty:0,unit:x.unit,low:x.low,grp:x.grp||'שונות'})); invSave(a); store.set('mk-inv-ver',INV_VER); return a; }
  // one-time non-destructive merge: add any new starter items the user doesn't have yet (keeps their quantities)
  const ver=store.get('mk-inv-ver')||1;
  if(ver<INV_VER){
    const have=new Set(a.map(i=>i.name));
    INV_STARTER.forEach(x=>{ if(!have.has(x.name)) a.push({id:uid(),name:x.name,qty:0,unit:x.unit,low:x.low,grp:x.grp||'שונות'}); });
    // backfill missing grp on old items
    a.forEach(i=>{ if(!i.grp){ const s=INV_STARTER.find(x=>x.name===i.name); i.grp=s?s.grp:'שונות'; } });
    invSave(a); store.set('mk-inv-ver',INV_VER);
  }
  return a;
}
function invResetFull(){ store.set('mk-inventory', INV_STARTER.map(x=>({id:uid(),name:x.name,qty:0,unit:x.unit,low:x.low,grp:x.grp||'שונות'}))); store.set('mk-inv-ver',INV_VER); }

/* ═══ FEATURE 3 (R1.1) · "מה אפשר להכין ממה שיש לי" ═══
   Cross-references raw-material inventory + gear against make recipes.
   LOCAL core (works WITHOUT key) is deterministic; AI adds phrasing + "almost". */

// fuzzy match a material string against the user's in-stock inventory (qty>0)
function wcimInvHas(name, inv){
  const n=String(name||'').toLowerCase();
  return inv.some(i=>{
    if(i.qty<=0) return false;
    const iname=i.name.toLowerCase();
    const head=n.split(/[0-9(]/)[0].trim();
    return (head && iname.includes(head)) || n.includes(iname.split(' ')[0]);
  });
}
// which method(s) a make needs, and whether gear supports at least one
function wcimGearOk(meta){
  const cat=meta.cat||'', o=meta.obj||{}, b=o.build||{};
  const g=gearState(); const configured=gearConfigured();
  // sausage-family needs grinder+stuffer (soft: if gear unconfigured, assume yes)
  const isSausage=['נקניקיות','נקניק מעושן','נקניק מיובש','סלומי'].includes(cat);
  if(isSausage && configured){
    const hasGrinder=g.grinder && g.grinder!=='אין';
    const hasStuffer=g.stuffer && g.stuffer!=='אין';
    if(!hasGrinder||!hasStuffer) return {ok:false, need: [!hasGrinder&&'מטחנת בשר', !hasStuffer&&'מכונת מילוי'].filter(Boolean)};
  }
  // smoked items need smoke capability
  if((cat==='נקניק מעושן'||cat==='דג מעושן'||/עישון/.test(b.intro||'')) && configured && !canSmoke())
    return {ok:false, need:['מעשנה / גריל-פחם']};
  return {ok:true, need:[]};
}
// the deterministic local engine — returns {makeable, almost}
function wcimLocal(){
  const inv=invEnsure();
  const items=cwAllItems().filter(m=>typeof isProjectItem==='function'?isProjectItem(m):(m.kind==='make'));
  const makeable=[], almost=[];
  items.forEach(m=>{
    const meta=(typeof resolveItem==='function')?resolveItem(m.key):m;
    const b=(meta.obj&&meta.obj.build)||{};
    const mats=(b.materials||[]).filter(x=>/מעי|שרוול|תרבית|מלח נתרני|Cure|דקסטרוז|פלפל|פפריקה|כמון|כוסברה|שום|שומר|מיורן|עץ|אלון|היקורי|תפוח|דובדבן/i.test(x));
    if(!mats.length) return; // no trackable raw materials → skip (can't assert)
    const missing=mats.filter(x=>!wcimInvHas(x,inv));
    const gear=wcimGearOk(meta);
    if(missing.length===0 && gear.ok) makeable.push({key:m.key, heb:m.heb, cat:m.cat});
    else if(gear.ok && missing.length<=2) almost.push({key:m.key, heb:m.heb, cat:m.cat, missing});
    else if(!gear.ok) { /* gear-blocked: surface in almost with gear note */ almost.push({key:m.key, heb:m.heb, cat:m.cat, missing:[], gearNeed:gear.need}); }
  });
  return {makeable, almost};
}
// build a compact grounding payload for the AI (inventory in-stock + gear caps + candidate makes)
function wcimGrounding(){
  const inv=invEnsure().filter(i=>i.qty>0).map(i=>i.name);
  const caps=[canGrill()&&'גריל',canSmoke()&&'עישון',canSV()&&'סו-ויד'].filter(Boolean);
  const g=gearState();
  const tools=[g.grinder&&g.grinder!=='אין'&&'מטחנה',g.stuffer&&g.stuffer!=='אין'&&'מילוי'].filter(Boolean);
  const cands=cwAllItems().filter(m=>typeof isProjectItem==='function'?isProjectItem(m):(m.kind==='make')).map(m=>({key:m.key,heb:m.heb,cat:m.cat}));
  return 'מלאי במלאי (>0): '+(inv.join(', ')||'ריק')
    +'\nיכולות בישול: '+(caps.join(', ')||'-')+' · כלים: '+(tools.join(', ')||'-')
    +'\nמתכונים אפשריים (בחר keys מכאן בלבד):\n'+cands.map(c=>`${c.key} · ${c.heb} (${c.cat})`).join('\n');
}
async function wcimAI(){
  const grounding=wcimGrounding();
  const schema='{"makeable":[{"key":"<key>","note":"<קצר>"}],"almost":[{"key":"<key>","missing":["<פריט>"]}]}';
  const task='על סמך המלאי, היכולות והכלים — אילו מתכונים אפשר להכין עכשיו (makeable) ואילו כמעט (חסר 1-2 פריטים, almost)? השתמש אך ורק ב-keys מהרשימה.';
  const raw=await aiJSON({task, schemaHint:schema, grounding, temperature:0.3, maxTokens:1400});
  // GROUNDING ENFORCEMENT: drop any key not in catalog
  const mk=aiValidateItems(raw&&raw.makeable).kept;
  const al=aiValidateItems(raw&&raw.almost).kept;
  return {makeable:mk, almost:al};
}

/* ── Feature 3 UI: panel + button ── */
function wcimRowHTML(o){
  const meta=(typeof resolveItem==='function')?resolveItem(o.key):null;
  const emoji=meta?itemEmoji(o.cat,o.key):'🍖';
  const miss=(o.missing&&o.missing.length)?`<div class="wcim-miss">חסר: ${o.missing.join(' · ')}</div>`:'';
  const gearn=(o.gearNeed&&o.gearNeed.length)?`<div class="wcim-miss">דורש: ${o.gearNeed.join(' · ')}</div>`:'';
  const note=o.note?`<div class="pp-desc">${esc(o.note)}</div>`:'';
  return `<button class="pp-item" data-wcimkey="${o.key}">
    <div class="pp-item-h"><span class="pp-emoji">${emoji}</span><b>${o.heb}</b><span class="pp-diff" style="color:var(--smoke)">${o.cat}</span></div>
    ${note}${miss}${gearn}</button>`;
}
function wcimRender(res, aiUsed){
  const {makeable,almost}=res;
  let body=aiUsed?'<div class="ai-badge">✨ הועשר ע\u05f4י AI</div>':'';
  body+='<div class="pp-desc" style="margin-bottom:12px">מבוסס על חומרי-המדף במזווה (שרוולים, מלחי-ריפוי, תבלינים, עצים) והציוד שלך. בשר טרי נרכש בנפרד לכל מלאכה.</div>';
  body+=`<div class="pp-group"><div class="pp-gh">✅ אפשר להכין עכשיו <span style="color:var(--smoke);font-weight:400">· ${makeable.length}</span></div>`;
  body+= makeable.length?makeable.map(wcimRowHTML).join(''):'<div class="shop-empty">אין פריט שכל חומריו וציודו זמינים כרגע. עדכן כמויות במזווה או הוסף רכיבים.</div>';
  body+=`</div>`;
  if(almost.length){
    body+=`<div class="pp-group"><div class="pp-gh">🛒 כמעט — חסר מעט <span style="color:var(--smoke);font-weight:400">· ${almost.length}</span></div>`;
    body+= almost.map(wcimRowHTML).join('');
    body+=`</div>`;
  }
  showPanel(`${toolTop('מה אפשר להכין','ממה שיש במזווה ובציוד שלך','🍳','#1a9a7a')}
    <div class="panel-body" id="wcimBody">${body}</div>`);
  const host=$("#wcimBody"); if(host) host.querySelectorAll('[data-wcimkey]').forEach(el=>el.addEventListener('click',()=>{
    const meta=resolveItem(el.dataset.wcimkey); if(meta){ if(meta.key.startsWith('make-')) openMake(meta.key.replace(/^make-/,'')); else openProjectWizard(meta); }
  }));
}
async function openWhatCanIMake(){
  const local=wcimLocal();               // deterministic base — always computed
  if(!aiAvail()){ wcimRender(local,false); return; }
  wcimRender(local,false);               // show local immediately
  const b=$("#wcimBody"); if(b) b.insertAdjacentHTML('afterbegin','<div class="wcim-loading" style="color:var(--fresh);font-size:13px;margin-bottom:8px">✨ מחשב עם AI…</div>');
  try{
    const ai=await wcimAI();
    const aiKeys=new Set(ai.makeable.map(o=>o.key));
    const mergedMakeable=[...ai.makeable, ...local.makeable.filter(o=>!aiKeys.has(o.key))];
    const mergedAlmost=ai.almost.length?ai.almost:local.almost;
    wcimRender({makeable:mergedMakeable, almost:mergedAlmost}, true);
  }catch(e){
    if(typeof toast==='function') toast('AI לא זמין כרגע — מציג חישוב מקומי');
    wcimRender(local,false);
  }
}

/* ── Feature 2 UI: pantry advisor (backward planning) ── */
function padvRowHTML(r){
  const meta=(typeof resolveItem==='function')?resolveItem(r.key):null;
  const emoji=meta?itemEmoji(r.cat,r.key):'🧫';
  const late=r.startBy && daysBetween(today(),r.startBy)<0;
  const startTxt = late ? 'להתחיל היום (כבר בפיגור)' : ('להתחיל עד '+(new Date(r.startBy).toLocaleDateString('he-IL',{day:'numeric',month:'short'})));
  const reason=r.reason?`<div class="pp-desc">${r.reason}</div>`:'';
  return `<button class="pp-item" data-padvkey="${r.key}">
    <div class="pp-item-h"><span class="pp-emoji">${emoji}</span><b>${r.heb}</b><span class="pp-diff" style="color:var(--smoke)">${r.cat}</span></div>
    <div class="padv-when ${late?'late':''}">⏱️ ${startTxt} · משך ~${r.days} ימים</div>${reason}</button>`;
}
function padvRender(data, aiUsed){
  const {targetDate, daysLeft}=data;
  const rows = aiUsed ? data.recommend : data.feasible;
  const warnings = aiUsed ? (data.warnings||[]) : (data.tooLate||[]).slice(0,5).map(t=>`${t.heb} דורש ~${t.days} ימים — לא יספיק עד היעד.`);
  const dstr=new Date(targetDate).toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
  let body=aiUsed?'<div class="ai-badge">✨ הועשר ע\u05f4י AI</div>':'';
  body+=`<div class="padv-target">🎯 יעד: <b>${dstr}</b> · בעוד ${daysLeft} ימים</div>`;
  body+=`<div class="pp-desc" style="margin:8px 0 14px">משכי-הייצור מחושבים מנתוני האפליקציה. התחל את הארוכים ראשונים.</div>`;
  body+=`<div class="pp-group"><div class="pp-gh">${aiUsed?'✨ מומלץ להתחיל':'📋 אפשר להספיק'} <span style="color:var(--smoke);font-weight:400">· ${rows.length}</span></div>`;
  body+= rows.length?rows.map(padvRowHTML).join(''):'<div class="shop-empty">אין מלאכה שניתן להשלים עד התאריך הזה.</div>';
  body+=`</div>`;
  if(warnings.length){
    body+=`<div class="pp-group"><div class="pp-gh" style="color:var(--ember)">⚠️ לא יספיק בזמן</div>`;
    body+= warnings.map(w=>`<div class="wcim-miss" style="padding:6px 2px">${w}</div>`).join('');
    body+=`</div>`;
  }
  showPanel(`${toolTop('יועץ תזמון','מה להתחיל מתי כדי לעמוד בתאריך','🗓️','#1a9a7a')}
    <div class="panel-body" id="padvBody">
      <div class="padv-daterow"><label>תאריך היעד:</label><input type="date" id="padvDate" value="${targetDate}" min="${today()}"></div>
      <div id="padvResult">${body}</div>
    </div>`);
  const di=$("#padvDate"); if(di) di.addEventListener('change',()=>runPantryAdvisor(di.value));
  const host=$("#padvResult"); if(host) host.querySelectorAll('[data-padvkey]').forEach(el=>el.addEventListener('click',()=>{
    const meta=resolveItem(el.dataset.padvkey); if(meta) openProjectWizard(meta);
  }));
}
async function runPantryAdvisor(targetDate){
  const local=pantryAdvisorLocal(targetDate);
  if(!aiAvail()){ padvRender(local,false); return; }
  padvRender(local,false);
  const r=$("#padvResult"); if(r) r.insertAdjacentHTML('afterbegin','<div class="wcim-loading" style="color:var(--fresh);font-size:13px;margin-bottom:8px">✨ מחשב עם AI…</div>');
  try{
    const ai=await pantryAdvisorAI(targetDate);
    padvRender(Object.assign({targetDate:local.targetDate, daysLeft:local.daysLeft}, ai), true);
  }catch(e){
    if(typeof toast==='function') toast('AI לא זמין כרגע — מציג תזמון מקומי');
    padvRender(local,false);
  }
}
function openPantryAdvisor(){ runPantryAdvisor(addDays(today(),14)); }   // default: 2 weeks out

/* ═══ FEATURE 1 (R1.3) · מתכנן-אירוע בשפה חופשית ═══
   Free-text → validated event menu, loaded into the wizard. */
function evNameSets(){
  return {
    sides:(typeof SIDES!=='undefined'?SIDES.map(s=>s.n):[]),
    drinks:(typeof DRINKS!=='undefined'?DRINKS.map(s=>s.n):[]),
    desserts:(typeof DESSERTS!=='undefined'?DESSERTS.map(s=>s.n):[])
  };
}
function eventPlanGrounding(){
  // catalog mains grouped by category, with kosher status (for the kosher guard)
  const items=cwAllItems();
  const byCat={};
  items.forEach(m=>{ (byCat[m.cat]=byCat[m.cat]||[]).push(m); });
  const cat=Object.entries(byCat).map(([c,list])=>`【${c}】\n`+list.map(m=>`  ${m.key} · ${m.heb} [${(typeof kosherStatus==='function')?kosherStatus(m.key):'kosher'}]`).join('\n')).join('\n');
  const ns=evNameSets();
  return 'קטלוג המנות (בחר keys מכאן בלבד; בסוגריים סטטוס כשרות):\n'+cat
    +'\n\nתוספות אפשריות: '+ns.sides.join(' · ')
    +'\nמשקאות אפשריים: '+ns.drinks.join(' · ')
    +'\nקינוחים אפשריים: '+ns.desserts.join(' · ');
}
async function aiPlanEvent(prompt){
  const grounding=eventPlanGrounding();
  const schema='{"guests":<מספר>,"appetite":"light|reg|heavy","kosher":<true|false>,"keys":["<key>"],"sides":["<שם>"],"drinks":["<שם>"],"desserts":["<שם>"],"rationale":"<נימוק קצר לבחירות>"}';
  const task='בנה תפריט אירוע מאוזן לפי הבקשה: "'+prompt+'". בחר מנות עיקריות (keys מהקטלוג בלבד), תוספות, משקאות וקינוחים מהרשימות. אזן בין סוגי בשר/צומח. אם התבקשה כשרות או "בלי חזיר" — אל תכלול פריטים לא-כשרים/חזיר. החזר מספר סועדים ותיאבון סביר.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1500});
  const wantKosher = !!(raw&&raw.kosher) || /כשר|בלי חזיר|ללא חזיר/.test(prompt);
  let keys=aiValidateKeys(raw&&raw.keys).kept;
  if(wantKosher && typeof isKosherOk==='function') keys=keys.filter(k=>isKosherOk(k));   // drop pork/shellfish/blood
  const ns=evNameSets();
  const filt=(arr,valid)=>[...new Set((Array.isArray(arr)?arr:[]).filter(x=>valid.includes(x)))];
  return {
    guests: Math.max(1, Math.min(200, parseInt(raw&&raw.guests,10)||8)),
    appetite: ['light','reg','heavy'].includes(raw&&raw.appetite)?raw.appetite:'reg',
    kosher: wantKosher,
    keys,
    sides: filt(raw&&raw.sides, ns.sides),
    drinks: filt(raw&&raw.drinks, ns.drinks),
    desserts: filt(raw&&raw.desserts, ns.desserts),
    rationale: (raw&&typeof raw.rationale==='string')?raw.rationale.slice(0,400):''
  };
}
function evPlanPreviewHTML(plan){
  const appName={light:'קל',reg:'רגיל',heavy:'כבד'}[plan.appetite]||'רגיל';
  const mains=plan.keys.map(k=>{ const m=resolveItem(k); return m?`<div class="pp-item" style="cursor:default"><div class="pp-item-h"><span class="pp-emoji">${itemEmoji(m.cat,k)}</span><b>${m.heb}</b><span class="pp-diff" style="color:var(--smoke)">${m.cat}</span></div></div>`:''; }).join('');
  const chips=(arr,label)=>arr.length?`<div style="margin-top:8px"><b style="font-size:12px;color:var(--smoke)">${label}:</b> ${arr.join(' · ')}</div>`:'';
  return `${plan.rationale?`<div class="pp-desc" style="margin-bottom:12px;font-size:13px">💡 ${esc(plan.rationale)}</div>`:''}
    <div class="padv-target">👥 ${plan.guests} סועדים · תיאבון ${appName}${plan.kosher?' · ✡️ כשר':''}</div>
    <div class="pp-group" style="margin-top:12px"><div class="pp-gh">🍖 מנות עיקריות · ${plan.keys.length}</div>${mains||'<div class="shop-empty">לא נבחרו מנות עיקריות.</div>'}</div>
    ${chips(plan.sides,'🥗 תוספות')}${chips(plan.drinks,'🥤 משקאות')}${chips(plan.desserts,'🍮 קינוחים')}`;
}
function evPlanApply(plan){
  setMenuCtx&&setMenuCtx('event');
  const s=menuState();
  s.guests=plan.guests; s.appetite=plan.appetite; s.kosher=plan.kosher;
  s.keys=[...new Set(plan.keys)]; s.sides=plan.sides; s.drinks=plan.drinks; s.desserts=plan.desserts;
  saveMenu(s);
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('wizard');
  if(typeof cwSyncFromMenu==='function') cwSyncFromMenu();
  if(typeof cwGo==='function') cwGo(5);   // jump to review step
  if(typeof toast==='function') toast('התפריט נטען לאשף — סקור וערוך ✓');
}
async function evPlanRun(prompt){
  if(!prompt||!prompt.trim()){ if(typeof toast==='function') toast('כתוב מה לתכנן'); return; }
  showPanel(`${toolTop('מתכנן האירוע','✨ בונה תפריט…','✨','#1a9a7a')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ בונה תפריט מאוזן…</div></div>`);
  try{
    const plan=await aiPlanEvent(prompt.trim());
    if(!plan.keys.length){ showPanel(`${toolTop('מתכנן האירוע','לא נמצאו מנות','✨','#1a9a7a')}<div class="panel-body"><div class="shop-empty">לא הצלחתי לבנות תפריט מהבקשה. נסה לנסח אחרת (למשל: "מנגל בשרי ל-10 בלי חזיר").</div><button class="ccta" id="evpRetry">← נסה שוב</button></div>`);
      const rb=$("#evpRetry"); if(rb) rb.addEventListener('click',openEventPlanner); return; }
    aiConfirmPanel({ title:'תפריט מוצע', sub:'✨ נוצר ע\u05f4י AI · טען לאשף לעריכה', bodyHTML:evPlanPreviewHTML(plan), applyLabel:'✓ טען לאשף', onApply:()=>evPlanApply(plan) });
  }catch(e){
    showPanel(`${toolTop('מתכנן האירוע','שגיאה','✨','#1a9a7a')}<div class="panel-body"><div class="shop-empty">${/no-key/.test(e.message)?'צריך מפתח AI לתכנון אוטומטי.':'ה-AI לא זמין כרגע. נסה שוב או תכנן ידנית באשף.'}</div><button class="ccta" id="evpRetry">← חזרה</button></div>`);
    const rb=$("#evpRetry"); if(rb) rb.addEventListener('click',openEventPlanner);
  }
}
function openEventPlanner(){
  if(!aiAvail()){
    showPanel(`${toolTop('מתכנן האירוע (AI)','דורש מפתח Gemini אישי','✨','#1a9a7a')}<div class="panel-body">
      <div class="pp-desc" style="margin-bottom:14px">תכנון-אירוע אוטומטי בשפה חופשית זמין עם חיבור AI. בלי זה — אפשר לבנות אירוע ידנית באשף.</div>
      <button class="ccta" id="evpConnect">🔑 חבר AI</button>
      <button class="akc-back" id="evpManual" style="margin-top:8px">בנה ידנית באשף ←</button></div>`);
    const c=$("#evpConnect"); if(c) c.addEventListener('click',()=>{ if(typeof askConnect==='function') askConnect(); });
    const m=$("#evpManual"); if(m) m.addEventListener('click',()=>{ if(typeof cStartNewEvent==='function') cStartNewEvent(); });
    return;
  }
  const examples=['מנגל בשרי ל-10 בלי חזיר','אסאדו חגיגי ל-6, תקציב בינוני','ערב עישון אמריקאי ל-8','אירוח כשר ל-12 עם דגים'];
  showPanel(`${toolTop('מתכנן האירוע','תאר את האירוע — ואבנה תפריט','✨','#1a9a7a')}<div class="panel-body">
    <div class="ai-badge">✨ מופעל ע\u05f4י AI</div>
    <textarea id="evpPrompt" placeholder="למשל: מנגל בשרי ל-10 אנשים, בלי חזיר, כולל תוספות ומשקאות" style="width:100%;min-height:80px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px"></textarea>
    <div class="chips" style="margin-bottom:14px">${examples.map(e=>`<span class="chip" data-evpex="${e}">${e}</span>`).join('')}</div>
    <button class="ccta" id="evpGo">✨ בנה תפריט</button></div>`);
  const ta=$("#evpPrompt");
  $("#panel").querySelectorAll('[data-evpex]').forEach(c=>c.addEventListener('click',()=>{ if(ta){ ta.value=c.dataset.evpex; } }));
  const go=$("#evpGo"); if(go) go.addEventListener('click',()=>evPlanRun(ta?ta.value:''));
}

/* ═══ FEATURE 4 (R2.1) · תיבול מותאם-פריט (AI) ═══
   AI picks from the REAL seasoning library for this cut+method, explains why.
   Degrades to recsFor. Saved as context-scoped instance (never mutates template). */
function aiValidateSeasonings(ids, cat, isProd){
  const valid=new Set((typeof seasoningsFor==='function'?seasoningsFor(cat,isProd):[]).map(s=>s.id));
  const kept=[], dropped=[]; const seen=new Set();
  (Array.isArray(ids)?ids:[]).forEach(id=>{ if(valid.has(id)&&!seen.has(id)){ seen.add(id); kept.push(id); } else dropped.push(id); });
  if(dropped.length && typeof console!=='undefined') console.warn('[AI] dropped invalid seasonings:',dropped);
  return {kept, dropped};
}
function seasonRecGrounding(meta, cat, isProd){
  const all=(typeof seasoningsFor==='function')?seasoningsFor(cat,isProd):[];
  const list=all.map(s=>`${s.id} · ${s.heb} [${s.kind}${s.heat?' · חריף '+s.heat:''}${s.cont?' · '+s.cont:''}]`).join('\n');
  const itemLine=meta?`הפריט: ${meta.heb} (${cat})`:`קטגוריה: ${cat}`;
  return itemLine+'\n\nמתבלים תקפים (בחר id מכאן בלבד):\n'+list;
}
async function aiSeasonRec(key, cat, isProd){
  const meta=(typeof resolveItem==='function'&&key)?resolveItem(key):null;
  const grounding=seasonRecGrounding(meta, cat, isProd);
  const schema='{"recommend":[{"id":"<id>","reason":"<קצר: למה מתאים>"}]}';
  const task='המלץ על 3-5 מתבלים/רטבים שמתאימים במיוחד ל'+(meta?meta.heb:cat)+'. גוון בין ראב/מרינדה/רוטב/גלייז אם רלוונטי. הסבר בקצרה למה כל אחד מתאים (טעם, מסורת, איזון). בחר id מהרשימה בלבד.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1000});
  const recs=Array.isArray(raw&&raw.recommend)?raw.recommend:[];
  const validIds=aiValidateSeasonings(recs.map(r=>r.id), cat, isProd).kept;
  const validSet=new Set(validIds);
  return recs.filter(r=>validSet.has(r.id)).map(r=>{ const s=seasoningById(r.id); return {id:r.id, heb:s?s.heb:r.id, kind:s?s.kind:'', origin:s?s.origin:'', reason:(typeof r.reason==='string')?r.reason.slice(0,200):''}; });
}
function seasonRecRender(key, cat, isProd, recs, backFn){
  const rows=recs.map(r=>{
    const s=seasoningById(r.id); if(!s) return '';
    const sel=(selectedSeasonings(key)||[]).includes(r.id);
    return `<div class="pp-item" style="cursor:default">
      <div class="pp-item-h"><span class="pp-emoji">${(typeof KIND_EMOJI!=='undefined'&&KIND_EMOJI[s.kind])||'🧂'}</span><b>${s.heb}</b>${s.origin?`<span class="pp-diff" style="color:var(--smoke)">${s.origin}</span>`:''}</div>
      ${r.reason?`<div class="pp-desc">${esc(r.reason)}</div>`:''}
      <button class="cev-act" data-seasadd="${r.id}" data-seaskind="${s.kind}" style="margin-top:6px;background:${sel?'var(--fresh-l)':'none'};border:1px solid var(--fresh);color:var(--fresh)">${sel?'✓ נבחר':'＋ הוסף למופע'}</button>
    </div>`;
  }).join('');
  if(typeof panelStack!=='undefined' && backFn) panelStack.push(backFn);
  showPanel(`${toolTop('תיבול מומלץ','✨ נבחר עבור '+((resolveItem(key)||{}).heb||cat),'✨','#1a9a7a')}
    <div class="panel-body">
      <div class="ai-badge">✨ נוצר ע\u05f4י AI</div>
      ${rows||'<div class="shop-empty">לא נמצאה המלצה. נסה את הבורר הידני.</div>'}
    </div>`);
  $("#panel").querySelectorAll('[data-seasadd]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.seasadd, kind=b.dataset.seaskind;
    const cur=selectedSeasonings(key)||[];
    cwApplySeasKind(key, kind, cur.includes(id)?'':id);
    const nowSel=(selectedSeasonings(key)||[]).includes(id);
    b.textContent=nowSel?'✓ נבחר':'＋ הוסף למופע'; b.style.background=nowSel?'var(--fresh-l)':'none';
    if(typeof toast==='function') toast(nowSel?'נוסף למופע ✓':'הוסר מהמופע');
  }));
}
async function openSeasonRecAI(key, cat, isProd, backFn){
  if(!aiAvail()){
    // graceful: local recsFor (the ⭐ tab already exists); just toast + no-op here
    if(typeof toast==='function') toast('המלצות AI דורשות מפתח — משתמש בבורר "⭐ מומלצים"');
    return;
  }
  showPanel(`${toolTop('תיבול מומלץ','✨ בוחר מתבלים…','✨','#1a9a7a')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מחפש התאמות…</div></div>`);
  try{
    const recs=await aiSeasonRec(key, cat, isProd);
    seasonRecRender(key, cat, isProd, recs, backFn);
  }catch(e){
    if(typeof toast==='function') toast('AI לא זמין — נסה את הבורר הידני');
    if(backFn) backFn(); else if(typeof closePanel==='function') closePanel();
  }
}

/* ═══ FEATURE 5 (R2.2) · אבחון-תקלות אישי (AI) ═══
   Free-text symptom → diagnosis grounded in the 41 canned solutions + journal/projects. */
function troubleIndex(){
  const out=[];
  (typeof TROUBLE_GROUPS!=='undefined'?TROUBLE_GROUPS:[]).forEach((g,gi)=>g.items.forEach((t,i)=>out.push({id:gi+'-'+i, title:t[0], body:t[1], group:g.g, ic:g.ic})));
  return out;
}
function diagnoseGrounding(problem){
  const idx=troubleIndex();
  const sols=idx.map(s=>`${s.id} · ${s.title}`).join('\n');
  const jrn=(typeof journal==='function'?journal():[]).slice(0,5).map(e=>`${e.name||e.key||''}${e.temp?' · '+e.temp:''}${e.rating?' · דירוג '+e.rating:''}`).filter(Boolean);
  const proj=(typeof pantry==='function'?pantry():[]).slice(0,6).map(p=>`${p.name} (${p.type||'?'})`);
  return 'תיאור התקלה: '+problem
    +(jrn.length?'\n\nבישולים אחרונים ביומן:\n'+jrn.join('\n'):'')
    +(proj.length?'\n\nפרויקטים פעילים:\n'+proj.join('\n'):'')
    +'\n\nפתרונות קיימים באפליקציה (הפנה אליהם ב-related לפי id):\n'+sols;
}
async function aiDiagnose(problem){
  const grounding=diagnoseGrounding(problem);
  const schema='{"diagnosis":"<אבחון קצר>","causes":["<סיבה>"],"fixes":["<פעולה מעשית>"],"related":["<id מרשימת הפתרונות>"]}';
  const task='אבחן את התקלה על סמך התיאור וההקשר האישי. תן אבחון קצר, סיבות אפשריות, ופעולות מתקנות מעשיות. הפנה ב-related ל-id של הפתרונות הרלוונטיים מהרשימה. אל תמציא מספרי טמפ׳/בטיחות — הסתמך על הפתרונות הקיימים.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.4,maxTokens:1100});
  const idx=troubleIndex(); const validIds=new Set(idx.map(s=>s.id));
  const related=[...new Set((Array.isArray(raw&&raw.related)?raw.related:[]).filter(id=>validIds.has(id)))].map(id=>idx.find(s=>s.id===id));
  const arr=x=>Array.isArray(x)?x.filter(s=>typeof s==='string').slice(0,6):[];
  return {
    diagnosis:(raw&&typeof raw.diagnosis==='string')?raw.diagnosis.slice(0,500):'',
    causes:arr(raw&&raw.causes), fixes:arr(raw&&raw.fixes), related
  };
}
function diagnoseRender(problem, res){
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  const anchors=res.related.map(s=>`<div class="acc" style="margin-top:8px"><div class="acc-q" style="cursor:default">${s.ic} ${s.title}</div><div class="acc-a" style="max-height:none;padding:10px 14px">${s.body}</div></div>`).join('');
  showPanel(`${toolTop('אבחון אישי','✨ נוצר ע\u05f4י AI','🩺','#a8392f')}
    <div class="panel-body">
      <div class="ai-badge">✨ אבחון AI · מבוסס על הפתרונות המאומתים באפליקציה</div>
      <div class="pp-desc" style="margin-bottom:10px">❓ ${problem}</div>
      ${res.diagnosis?`<div class="padv-target" style="background:var(--char2)">🩺 ${esc(res.diagnosis)}</div>`:''}
      ${res.causes.length?`<div class="pp-group"><div class="pp-gh">סיבות אפשריות</div><ul style="margin:0;padding-inline-start:20px;font-size:13.5px;line-height:1.7;color:var(--bone)">${li(res.causes)}</ul></div>`:''}
      ${res.fixes.length?`<div class="pp-group"><div class="pp-gh">מה לעשות</div><ul style="margin:0;padding-inline-start:20px;font-size:13.5px;line-height:1.7;color:var(--bone)">${li(res.fixes)}</ul></div>`:''}
      ${res.related.length?`<div class="pp-group"><div class="pp-gh">📖 פתרונות מאומתים רלוונטיים</div>${anchors}</div>`:''}
      <button class="akc-back" id="diagFull" style="margin-top:14px">📋 כל התקלות (מצב הצילו) ←</button>
    </div>`);
  const fb=$("#diagFull"); if(fb) fb.addEventListener('click',()=>{ if(typeof openHelp==='function') openHelp(); });
}
async function runDiagnose(problem){
  if(!problem||!problem.trim()){ if(typeof toast==='function') toast('תאר את התקלה'); return; }
  showPanel(`${toolTop('אבחון אישי','✨ מאבחן…','🩺','#a8392f')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מאבחן את התקלה…</div></div>`);
  try{ diagnoseRender(problem.trim(), await aiDiagnose(problem.trim())); }
  catch(e){
    if(typeof toast==='function') toast('AI לא זמין — פותח את מצב הצילו');
    if(typeof openHelp==='function') openHelp();
  }
}
function openDiagnoseAI(){
  const examples=['הנקניק יצא יבש ופריך','העשן יצא מר','הבשר נתקע ב-68 מעלות','עובש לבן על הסלמי','הגבינה לא נמסה'];
  showPanel(`${toolTop('אבחון תקלה אישי','תאר מה קרה — ואאבחן','🩺','#a8392f')}<div class="panel-body">
    <div class="ai-badge">✨ מופעל ע\u05f4י AI · לוקח בחשבון את היומן והפרויקטים שלך</div>
    <textarea id="diagPrompt" placeholder="למשל: עישנתי חזה אבל יצא יבש וקשה, למרות שהגעתי לטמפ׳" style="width:100%;min-height:80px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px"></textarea>
    <div class="chips" style="margin-bottom:14px">${examples.map(e=>`<span class="chip" data-diagex="${e}">${e}</span>`).join('')}</div>
    <button class="ccta" id="diagGo">✨ אבחן</button></div>`);
  const ta=$("#diagPrompt");
  $("#panel").querySelectorAll('[data-diagex]').forEach(c=>c.addEventListener('click',()=>{ if(ta) ta.value=c.dataset.diagex; }));
  const go=$("#diagGo"); if(go) go.addEventListener('click',()=>runDiagnose(ta?ta.value:''));
}

/* ═══ FEATURE 6 (R3.1) · מחולל-מתכון → פרויקט (AI) ═══
   AI writes the creative parts (intro/materials/phases). SAFETY NUMBERS
   (salt/cure calc) come from APP presets, NOT the AI (P3). Marked unverified. */
function umakes(){ return store.get('mk-umakes')||{}; }
function saveUmakes(o){ store.set('mk-umakes',o); }
// APP-SUPPLIED safe cure/salt presets by product type (NEVER from AI)
const UMAKE_CALC={
  fresh:  {salt:18, cure:null, sugar:0,  water:10, brine:false, saltL:0, cureL:0, sugarL:0},   // fresh sausage
  cooked: {salt:18, cure:'1',  cureRate:2.5, sugar:5, water:10, brine:false, saltL:0, cureL:0, sugarL:0}, // cooked/smoked (cure#1 156ppm)
  dried:  {salt:28, cure:'2',  cureRate:2.5, sugar:3, water:0,  brine:false, saltL:0, cureL:0, sugarL:0},  // dry-cured (cure#2)
  shawarma:{salt:16, cure:null, sugar:0, water:5, brine:false, saltL:0, cureL:0, sugarL:0},    // marinated fresh, cooked same-day
  kofta:  {salt:15, cure:null, sugar:0,  water:5,  brine:false, saltL:0, cureL:0, sugarL:0}    // ground kebab/kofta, fresh
};
const UMAKE_CAT={fresh:'נקניקיות', cooked:'נקניק מעושן', dried:'נקניק מיובש', shawarma:'שווארמה', kofta:'צלייה טחונה'};
function umakeGrounding(){
  const cats=Object.keys(UMAKE_CAT).map(t=>`${t} → ${UMAKE_CAT[t]}`).join(' · ');
  return 'מבנה מתכון-בנייה: intro (תיאור קצר), materials (רשימת חומרים וציוד), phases (שלבים: title + body). '
    +'סוגי מוצר אפשריים (type): '+cats+'. '
    +'בחר את הסוג המתאים: נקניקיות טריות=fresh, נקניק מעושן=cooked, נקניק מיובש=dried, שווארמה/מרינדה=shawarma, קבב/קופתה/מיצי טחונים=kofta. '
    +'חשוב: אל תכלול מספרי מלח/ניטריט/ריפוי — האפליקציה מחשבת אותם לפי הסוג. תאר שלבים איכותיים ומדויקים.';
}
function umakeValidateStructure(raw, type){
  // strict structure validation — reject malformed
  if(!raw||typeof raw!=='object') return null;
  const name=(typeof raw.name==='string'&&raw.name.trim())?raw.name.trim().slice(0,60):null;
  if(!name) return null;
  const t=Object.keys(UMAKE_CALC).includes(raw.type)?raw.type:(Object.keys(UMAKE_CALC).includes(type)?type:'fresh');
  const materials=Array.isArray(raw.materials)?raw.materials.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,120)).slice(0,20):[];
  const phasesRaw=Array.isArray(raw.phases)?raw.phases:[];
  const phases=phasesRaw.map((p,i)=>{
    const title=(p&&typeof p.title==='string'&&p.title.trim())?p.title.trim().slice(0,60):('שלב '+(i+1));
    const body=(p&&typeof p.body==='string')?p.body.trim().slice(0,400):'';
    return body?[title,body,0]:null;
  }).filter(Boolean).slice(0,14);
  if(phases.length<2) return null;   // need a real procedure
  const intro=(typeof raw.intro==='string')?raw.intro.trim().slice(0,300):'';
  return {name, type:t, intro, materials, phases};
}
async function aiGenerateRecipe(prompt){
  const grounding=umakeGrounding();
  const schema='{"name":"<שם>","type":"fresh|cooked|dried","intro":"<תיאור קצר>","materials":["<חומר>"],"phases":[{"title":"<כותרת>","body":"<הסבר>"}]}';
  const task='כתוב מתכון בנייה-מאפס לפי הבקשה: "'+prompt+'". תן שם, סוג מוצר, תיאור, רשימת חומרים וציוד, ושלבי הכנה מפורטים ואיכותיים. אל תציין מספרי מלח/ריפוי — האפליקציה תוסיף מחשבון בטוח.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.6,maxTokens:1600});
  const v=umakeValidateStructure(raw, raw&&raw.type);
  if(!v) throw new Error('bad-structure');
  // ASSEMBLE with APP-SUPPLIED safe calc — never from AI
  const build={intro:v.intro||v.name, calc:Object.assign({}, UMAKE_CALC[v.type]), materials:v.materials, phases:v.phases,
    store:'🧊 מתכון שנוצר ע\u05f4י AI — אמת מספרי בטיחות מול מקור מהימן לפני ייצור.'};
  return {heb:v.name, cat:UMAKE_CAT[v.type], type:v.type, build, ai:true, unverified:true, diff:2};
}
function umakeSave(rec){
  const id='umake-'+uid();
  const o=umakes(); o[id]=rec; saveUmakes(o);
  return id;
}
function umakePreviewHTML(rec){
  const mats=rec.build.materials.length?`<div class="pp-group"><div class="pp-gh">חומרים וציוד</div><ul style="margin:0;padding-inline-start:20px;font-size:13px;line-height:1.7;color:var(--bone)">${rec.build.materials.map(m=>`<li>${m}</li>`).join('')}</ul></div>`:'';
  const phases=`<div class="pp-group"><div class="pp-gh">שלבים · ${rec.build.phases.length}</div>${rec.build.phases.map((p,i)=>`<div class="acc" style="margin-top:6px"><div class="acc-q" style="cursor:default"><b>${i+1}. ${p[0]}</b></div><div class="acc-a" style="max-height:none;padding:8px 14px;font-size:13px">${p[1]}</div></div>`).join('')}</div>`;
  return `<div class="ai-badge" style="background:#fdecea;color:#a8392f;border-color:#f0c0ba">⚠ נוצר ע\u05f4י AI · לא-מאומת בטיחות</div>
    <div class="padv-target"><b>${rec.heb}</b> · ${rec.cat}</div>
    ${rec.build.intro?`<div class="pp-desc" style="margin-top:8px">${rec.build.intro}</div>`:''}
    ${mats}${phases}
    <div class="calcnote" style="margin-top:10px;font-size:12px;color:var(--ember)">מחשבון המלח/ריפוי יתווסף אוטומטית מהאפליקציה (ערכים בטוחים), לא מה-AI.</div>`;
}
async function runGenerateRecipe(prompt){
  if(!prompt||!prompt.trim()){ if(typeof toast==='function') toast('תאר את המתכון'); return; }
  showPanel(`${toolTop('מחולל מתכונים','✨ כותב מתכון…','✨','#9e4a3d')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מנסח מתכון…</div></div>`);
  try{
    const rec=await aiGenerateRecipe(prompt.trim());
    aiConfirmPanel({ title:'מתכון מוצע', sub:'⚠ נוצר ע\u05f4י AI · בדוק לפני שמירה', bodyHTML:umakePreviewHTML(rec), applyLabel:'💾 שמור למתכונים שלי',
      onApply:()=>{ const id=umakeSave(rec); if(typeof toast==='function') toast('נשמר ל"המתכונים שלי" ✓'); if(typeof closePanel==='function') closePanel(); if(typeof openMake==='function'&&id) { const meta=resolveItem(id); if(meta) openMakeMeta(meta); } } });
  }catch(e){
    const msg=/bad-structure/.test(e.message)?'המתכון שהתקבל לא היה תקין. נסה לנסח אחרת.':(/no-key/.test(e.message)?'צריך מפתח AI.':'ה-AI לא זמין כרגע.');
    showPanel(`${toolTop('מחולל מתכונים','שגיאה','✨','#9e4a3d')}<div class="panel-body"><div class="shop-empty">${msg}</div><button class="ccta" id="genRetry">← חזרה</button></div>`);
    const rb=$("#genRetry"); if(rb) rb.addEventListener('click',openRecipeGen);
  }
}
// open a umake recipe (mirrors openMake but for user-generated)
function openMakeMeta(meta){
  if(!meta) return;
  const col='#9e4a3d';
  showPanel(`<div class="panel-top" style="--c:${col}"><button class="x" aria-label="סגור">✕</button><div class="cat" style="color:${col}">${meta.cat} · ✨ המתכון שלי</div><h2>${meta.heb}</h2><div class="en">נוצר ע\u05f4י AI · לא-מאומת בטיחות</div></div>
    <div class="panel-body"><div id="methodArea"></div>
      <button class="ccta" id="umProj" style="margin-top:14px">🧫 צור פרויקט מהמתכון</button>
      <button class="akc-back" id="umDel" style="margin-top:8px;color:var(--ember)">🗑️ מחק מתכון</button></div>`);
  renderBuildInto("#methodArea", meta.key, meta.build);
  const pj=$("#umProj"); if(pj) pj.addEventListener('click',()=>openProjectWizard(meta));
  const dl=$("#umDel"); if(dl) dl.addEventListener('click',async()=>{ if((await appConfirm('למחוק את המתכון?',{okLabel:'מחק',danger:true}))===true){ const o=umakes(); delete o[meta.key]; saveUmakes(o); if(typeof closePanel==='function') closePanel(); if(typeof toast==='function') toast('נמחק'); } });
}
function openRecipeGen(){
  if(!aiAvail()){
    showPanel(`${toolTop('מחולל מתכונים (AI)','דורש מפתח Gemini אישי','✨','#9e4a3d')}<div class="panel-body">
      <div class="pp-desc" style="margin-bottom:14px">יצירת מתכונים חדשים בשפה חופשית זמינה עם חיבור AI.</div>
      <button class="ccta" id="genConnect">🔑 חבר AI</button></div>`);
    const c=$("#genConnect"); if(c) c.addEventListener('click',()=>{ if(typeof askConnect==='function') askConnect(); });
    return;
  }
  const my=umakes(); const myList=Object.entries(my);
  const examples=['נקניקיית בקר-כמון-הריסה תוניסאית','שווארמה עוף בתיבול ירושלמי','קבב טלה חריף עם צנוברים','סלמי יין אדום ושום'];
  showPanel(`${toolTop('מחולל מתכונים','תאר מתכון — ואכתוב אותו','✨','#9e4a3d')}<div class="panel-body">
    <div class="ai-badge">✨ מופעל ע\u05f4י AI · מספרי בטיחות מהאפליקציה</div>
    <textarea id="genPrompt" placeholder="למשל: נקניקיית טלה חריפה בסגנון מרוקאי עם הרבה כמון וכוסברה" style="width:100%;min-height:80px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px"></textarea>
    <div class="chips" style="margin-bottom:14px">${examples.map(e=>`<span class="chip" data-genex="${e}">${e}</span>`).join('')}</div>
    <button class="ccta" id="genGo">✨ צור מתכון</button>
    ${myList.length?`<div class="pp-group" style="margin-top:18px"><div class="pp-gh">✨ המתכונים שלי · ${myList.length}</div>${myList.map(([id,m])=>`<button class="pp-item" data-umopen="${id}"><div class="pp-item-h"><span class="pp-emoji">🍖</span><b>${m.heb}</b><span class="pp-diff" style="color:var(--smoke)">${m.cat}</span></div></button>`).join('')}</div>`:''}
  </div>`);
  const ta=$("#genPrompt");
  $("#panel").querySelectorAll('[data-genex]').forEach(c=>c.addEventListener('click',()=>{ if(ta) ta.value=c.dataset.genex; }));
  const go=$("#genGo"); if(go) go.addEventListener('click',()=>runGenerateRecipe(ta?ta.value:''));
  $("#panel").querySelectorAll('[data-umopen]').forEach(b=>b.addEventListener('click',()=>{ const meta=resolveItem(b.dataset.umopen); if(meta) openMakeMeta(meta); }));
}

/* ═══ FEATURE 7 (R3.2) · תובנות-יומן (AI) ═══
   Analyzes the user's cooking journal for patterns + suggestions.
   Grounded in real entries only; never invents history. */
function journalInsightsGrounding(){
  const j=(typeof journal==='function'?journal():[]).slice(0,25);
  const rows=j.map(e=>`${e.name||e.key||'?'} · ${e.date||''}${e.temp?' · '+e.temp:''}${e.rating?' · דירוג '+e.rating+'/5':' · ללא דירוג'}`);
  return 'יומן הבישולים של המשתמש ('+j.length+' רשומות אחרונות):\n'+rows.join('\n')
    +'\n\nנתח אך ורק את הרשומות שלמעלה. אל תמציא בישולים או נתונים שלא מופיעים.';
}
async function aiJournalInsights(){
  const grounding=journalInsightsGrounding();
  const schema='{"summary":"<סיכום קצר>","patterns":["<דפוס שזוהה>"],"suggestions":[{"title":"<כותרת>","detail":"<פירוט מעשי>"}]}';
  const task='נתח את יומן הבישולים: זהה דפוסים (מה מצליח, מה מדורג נמוך, מגמות טמפ׳/סוגים), ותן 2-4 הצעות שיפור מעשיות. הסתמך אך ורק על הרשומות שסופקו.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1200});
  const arr=x=>Array.isArray(x)?x.filter(s=>typeof s==='string').slice(0,6):[];
  const sugg=Array.isArray(raw&&raw.suggestions)?raw.suggestions.filter(s=>s&&typeof s.title==='string').slice(0,5).map(s=>({title:s.title.slice(0,80),detail:(typeof s.detail==='string')?s.detail.slice(0,300):''})):[];
  return { summary:(raw&&typeof raw.summary==='string')?raw.summary.slice(0,400):'', patterns:arr(raw&&raw.patterns), suggestions:sugg };
}
function journalInsightsRender(res){
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  const sugg=res.suggestions.map(s=>`<div class="acc" style="margin-top:8px"><div class="acc-q" style="cursor:default"><b>💡 ${esc(s.title)}</b></div>${s.detail?`<div class="acc-a" style="max-height:none;padding:8px 14px;font-size:13px">${esc(s.detail)}</div>`:''}</div>`).join('');
  showPanel(`${toolTop('תובנות יומן','✨ ניתוח הבישולים שלך','📊','#1a9a7a')}
    <div class="panel-body">
      <div class="ai-badge">✨ נוצר ע\u05f4י AI · מבוסס על היומן שלך בלבד</div>
      ${res.summary?`<div class="padv-target" style="background:var(--char2)">📊 ${esc(res.summary)}</div>`:''}
      ${res.patterns.length?`<div class="pp-group"><div class="pp-gh">דפוסים שזוהו</div><ul style="margin:0;padding-inline-start:20px;font-size:13.5px;line-height:1.7;color:var(--bone)">${li(res.patterns)}</ul></div>`:''}
      ${res.suggestions.length?`<div class="pp-group"><div class="pp-gh">הצעות שיפור</div>${sugg}</div>`:''}
    </div>`);
}
async function openJournalInsights(){
  const j=(typeof journal==='function'?journal():[]);
  if(j.length<3){ if(typeof toast==='function') toast('צריך לפחות 3 בישולים ביומן לניתוח'); return; }
  showPanel(`${toolTop('תובנות יומן','✨ מנתח…','📊','#1a9a7a')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מנתח את היומן…</div></div>`);
  try{ journalInsightsRender(await aiJournalInsights()); }
  catch(e){ if(typeof toast==='function') toast('AI לא זמין כרגע'); if(typeof openJournal==='function') openJournal(); }
}
// projects (pantry) helpers reused: pantry(), savePantry()
function projPhases(p){
  if(!p.key) return [];
  if(p.source==='bought') return [];                 // bought & ready — no from-scratch steps
  if(p.source==='bought-finish') return [p.finish||'שלב סיום לפני הגשה'];   // only the finishing step
  const meta=resolveItem(p.key); if(!meta) return [];
  const bld=itemScratchBuild(meta)||{};              // includes synthesized cheese phases
  return (bld.phases||[]).map(ph=>Array.isArray(ph)?ph[0]:ph);
}
function projStepsHTML(p){
  const phases=projPhases(p);
  if(!phases.length) return '';
  const done=p.doneSteps||[];
  const n=done.length, total=phases.length;
  return `<details class="cpc-steps"><summary>📋 שלבי הכנה · ${n}/${total} בוצעו</summary>
    <div class="cpc-steplist">${phases.map((t,i)=>`<label class="cpc-step ${done.includes(i)?'done':''}"><input type="checkbox" data-cpstep="${p.id}" data-cpi="${i}" ${done.includes(i)?'checked':''}> ${t}</label>`).join('')}</div>
  </details>`;
}
function projProgress(p){
  if(p.source==='bought'&&p.type!=='cure'&&p.type!=='dry'){ return {pct:100,label:STAGE_LABEL[projStage(p)]||'מוכן',day:'',ready:projStage(p)!=='building',sub:'נקנה מוכן'}; }
  if(p.type==='scratch'){ const ph=projPhases(p); const done=(p.doneSteps||[]).length; const total=Math.max(1,ph.length); const ready=done>=ph.length; return {pct:Math.round(done/total*100),label:`${done}/${ph.length} שלבים`,day:'',ready,sub:'בנייה מאפס'}; }
  if(!p.type){ return {pct:0,label:'',day:'',ready:true,sub:''}; }
  if(p.type==='dry'){ const target=Math.round(p.startW*p.factor); const targetLoss=Math.round((1-p.factor)*100);
    const lossNow=p.startW?Math.round((1-p.curW/p.startW)*100):0; const ready=p.curW<=target;
    return {pct:Math.min(100,Math.round(lossNow/Math.max(1,targetLoss)*100)),label:`ירידה ${lossNow}% / ${targetLoss}%`,day:`יום ${daysBetween(p.start,today())}`,ready,sub:`התחלה ${p.startW}ג׳ · יעד ${target}ג׳`}; }
  const elapsed=daysBetween(p.start,today()), ready=elapsed>=p.days;
  return {pct:Math.min(100,Math.round(elapsed/Math.max(1,p.days)*100)),label:`יום ${elapsed}/${p.days}`,day:'',ready,sub:`סיום ${fmtDate(addDays(p.start,p.days))}`};
}
function cPaintProjects(){
  const host=$("#cProjBody"); if(!host) return;
  const projs=pantry();
  const inv=invEnsure();
  const lowCount=inv.filter(i=>i.qty<=i.low).length;
  // ── active projects ──
  let html=`<div class="cproj-sec"><div class="cproj-h"><span>🧫 פרויקטים פעילים</span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="cev-act" id="cProjWcim" style="background:var(--fresh-l);border:1px solid var(--fresh);color:var(--fresh)">🍳 מה אפשר להכין</button><button class="cev-act" id="cProjGen" style="background:var(--fresh-l);border:1px solid var(--fresh);color:var(--fresh)">✨ מחולל מתכונים</button><button class="cev-act" id="cProjAdv" style="background:var(--fresh-l);border:1px solid var(--fresh);color:var(--fresh)">🗓️ יועץ תזמון</button><button class="cev-act" id="cProjBuy" style="background:none;border:1px solid var(--ember);color:var(--ember)">🛒 קניתי — לאחסון</button><button class="cev-act" id="cProjNew">+ פרויקט חדש</button></span></div>`;
  if(!projs.length){
    html+=`<div class="cscard"><h4>אין פרויקטים פעילים</h4><div style="font-size:12.5px;color:var(--smoke);line-height:1.6">התחל פרויקט שרקוטרי או כבישה — צ׳וריסו, פנצ׳טה, בריסולה, פסטרמה — ועקוב אחרי ירידת המשקל והזמן עד לבשלות. או לחץ "🛒 קניתי — לאחסון" כדי לשמור רכיב מוכן שקנית.</div></div>`;
  } else {
    html+=projs.map(p=>{ const pr=projProgress(p); const stg=projStage(p); const bought=(p.source==='bought'||p.source==='bought-finish');
      return `<div class="cproj-card ${pr.ready?'ready':''}">
        <div class="cpc-top"><b>${p.name}</b><span class="cpc-day">${bought&&p.source==='bought'?STAGE_LABEL[stg]:(pr.day||pr.label)}</span></div>
        <div class="cpc-sub">${bought?(p.source==='bought'?'🛒 נקנה מוכן':'🛒 נקנה + סיום'):(p.type==='scratch'?'🍖 בנייה מאפס':(p.type==='dry'?'ייבוש למשקל':'כבישה'))}${p.finish?' · '+p.finish:''}${(p.source==='bought'||p.type==='scratch')?'':' · '+pr.sub}</div>
        ${p.source==='bought'?'':`<div class="pbar"><i style="width:${pr.pct}%;background:${pr.ready?'var(--good)':'var(--ember)'}"></i></div>`}
        ${(p.type==='dry'&&p.source!=='bought')?`<div class="cpc-log"><label>משקל נוכחי</label><input type="number" data-cpw="${p.id}" value="${p.curW}"><span>ג׳ · ${pr.label}</span></div>`:(p.source!=='bought'?`<div class="cpc-log" style="color:var(--smoke)">${pr.label} · ${pr.ready?'הסתיים ✓':'בתהליך'}</div>`:'')}
        ${pr.ready&&p.source!=='bought'?'<div class="cpc-ready">✓ מוכן!</div>':''}
        ${projStepsHTML(p)}
        <div class="cpc-actions">
          ${(stg==='ready'||stg==='done')?`<button class="cpc-act cpc-bridge" data-cpplan="${p.id}">➕ לאירוע/בישול</button>`:''}
          ${(p.source==='bought'&&stg!=='done')?`<button class="cpc-act" data-cpfinish="${p.id}">➕ הוסף עישון/סיום</button>`:''}
          ${p.source==='bought'?`<button class="cpc-act" data-cpserve="${p.id}">${stg==='done'?'↩ סמן: צריך סיום':'✅ מוכן להגשה'}</button>`:''}
          ${p.key?`<button class="cpc-act" data-cprecipe="${p.key}">📖 מתכון מלא</button>`:''}
          ${p.key?`<button class="cpc-act" data-cpcart="${p.id}">🛒 קניות</button>`:''}
          <button class="cpc-act" data-cpnote="${p.id}">📓 רישום ליומן</button>
          <button class="cpc-rm" data-cprm="${p.id}">מחק</button>
        </div>
      </div>`;
    }).join('');
  }
  html+=`</div>`;
  // ── raw-material inventory ──
  html+=`<div class="cproj-sec"><div class="cproj-h"><span>📦 מזווה — חומרי גלם${lowCount?` <span class="cinv-low-badge">${lowCount} חסרים</span>`:''}</span><span style="display:flex;gap:6px;flex-wrap:wrap">${lowCount?`<button class="cev-act" id="cInvShop">🛒 קניות</button>`:''}<button class="cev-act" id="cInvAdd">+ פריט</button><button class="cev-act" id="cInvReset" style="background:none;border:1px solid var(--line2);color:var(--smoke)">↺ שחזר</button></span></div>`;
  const invGrpOrder=['ריפוי','שרוולים','מלח וסוכר','תבלינים','עצים','שונות'];
  const invByGrp={}; inv.forEach(i=>{ const g=i.grp||'שונות'; (invByGrp[g]=invByGrp[g]||[]).push(i); });
  const invRow=i=>{ const low=i.qty<=i.low;
    return `<div class="cinv-row ${low?'low':''}">
      <div class="cinv-name">${i.name}${low?' <span class="cinv-lowtag">חסר</span>':''}</div>
      <div class="cinv-qty"><button data-invdec="${i.id}">−</button><input type="number" data-invq="${i.id}" value="${i.qty}"><span>${i.unit}</span><button data-invinc="${i.id}">+</button></div>
      <button class="cinv-rm" data-invrm="${i.id}">×</button>
    </div>`; };
  invGrpOrder.filter(g=>invByGrp[g]).forEach(g=>{
    html+=`<div class="cinv-grp">${g}</div>`+invByGrp[g].map(invRow).join('');
  });
  html+=`</div>`;
  // ── workflow links ──
  html+=`<div class="cproj-sec"><div class="cproj-h"><span>🗓️ ניהול תהליך</span></div>
    <div class="cproj-links">
      <button class="cproj-link" data-mfn="openReminders">⏰ תזכורות<small>הפוך · הזרק · בדוק לחות</small></button>
      <button class="cproj-link" data-mfn="openJournal">📓 יומן<small>תיעוד משקל, תמונות, טעם</small></button>
    </div></div>`;
  host.innerHTML=html;
  // wire — projects
  const np=$("#cProjNew"); if(np) np.addEventListener('click',openProjectPicker);
  const wc=$("#cProjWcim"); if(wc) wc.addEventListener('click',openWhatCanIMake);
  const av=$("#cProjAdv"); if(av) av.addEventListener('click',openPantryAdvisor);
  const gn=$("#cProjGen"); if(gn) gn.addEventListener('click',openRecipeGen);
  const nb=$("#cProjBuy"); if(nb) nb.addEventListener('click',openBuyStorePicker);
  host.querySelectorAll('[data-cpplan]').forEach(b=>b.addEventListener('click',()=>pantryToPlan(b.dataset.cpplan)));
  host.querySelectorAll('[data-cpfinish]').forEach(b=>b.addEventListener('click',()=>pantryAddFinish(b.dataset.cpfinish)));
  host.querySelectorAll('[data-cpserve]').forEach(b=>b.addEventListener('click',()=>{
    const a=pantry(), p=a.find(x=>x.id===b.dataset.cpserve); if(!p) return;
    p.stage=(projStage(p)==='done')?'ready':'done'; savePantry(a); cPaintProjects();
  }));
  host.querySelectorAll('[data-cpw]').forEach(inp=>inp.addEventListener('input',()=>{
    const a=pantry(), p=a.find(x=>x.id===inp.dataset.cpw); if(p){ p.curW=+inp.value||p.curW; savePantry(a); cPaintProjects(); }
  }));
  host.querySelectorAll('[data-cprm]').forEach(b=>b.addEventListener('click',()=>{
    appConfirm('למחוק את הפרויקט?\n(תזכורות אוטומטיות שנוצרו לו יימחקו גם)',{okLabel:'🗑️ מחק',danger:true}).then(__y=>{ if(__y!==true) return; (()=>{
      const pid=b.dataset.cprm;
      savePantry(pantry().filter(x=>x.id!==pid));
      // orphan cleanup: remove reminders tagged to this project
      try{ const rem=reminders().filter(r=>r.proj!==pid); store.set('mk-reminders',rem); }catch(e){}
      // clear last-project pointer if it was this one
      if(store.get('mk-lastproj')===pid) store.set('mk-lastproj',null);
      if(curProject===pid) curProject=null;
      cPaintProjects();
    })(); });
  }));
  // recipe step checklist
  host.querySelectorAll('[data-cpstep]').forEach(cb=>cb.addEventListener('change',()=>{
    const a=pantry(), p=a.find(x=>x.id===cb.dataset.cpstep); if(!p) return;
    p.doneSteps=p.doneSteps||[]; const i=+cb.dataset.cpi;
    if(cb.checked){ if(!p.doneSteps.includes(i)) p.doneSteps.push(i); } else { p.doneSteps=p.doneSteps.filter(x=>x!==i); }
    savePantry(a); store.set('mk-lastproj',p.id); cPaintProjects();
  }));
  // open the recipe + build steps for a project
  host.querySelectorAll('[data-cprecipe]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.cprecipe; const meta=resolveItem(key); if(!meta) return;
    const card=b.closest('[data-cprm]')||b.closest('.cproj-card');
    // find the project id from the sibling delete button
    const rmBtn=b.parentElement&&b.parentElement.querySelector('[data-cprm]'); pendingProject=rmBtn?rmBtn.dataset.cprm:null;
    if(key.startsWith('umake-')&&typeof openMakeMeta==='function') openMakeMeta(meta);
    else if(meta.kind==='make'&&typeof openMake==='function') openMake(key.replace(/^make-/,''));
    else if(meta.kind==='spec'&&typeof openSpec==='function') openSpec(meta.obj);
    else if(meta.kind==='cut'&&typeof openCut==='function') openCut(meta.obj);
  }));
  // quick journal entry for a project
  host.querySelectorAll('[data-cpnote]').forEach(b=>b.addEventListener('click',async()=>{
    const p=pantry().find(x=>x.id===b.dataset.cpnote); if(!p) return;
    const note=await appPrompt('רישום ליומן — מה קרה היום?','',{placeholder:'משקל, ריח, טעם, שלב…',okLabel:'📓 רשום'}); if(note===null||note===false) return;
    const j=journal(); j.unshift({id:uid(),name:p.name+(note?' — '+note:''),date:today(),temp:p.type==='dry'?(p.curW+' ג׳'):''});
    try{ store.set('mk-journal',j); }catch(e){}
    if(typeof toast==='function') toast('נרשם ביומן ✓');
  }));
  // project shopping (materials + inventory)
  host.querySelectorAll('[data-cpcart]').forEach(b=>b.addEventListener('click',()=>{
    const p=pantry().find(x=>x.id===b.dataset.cpcart); if(p) openProjectCart(p);
  }));
  // wire — inventory
  const ia=$("#cInvAdd"); if(ia) ia.addEventListener('click',async()=>{
    const name=await appPrompt('שם החומר:','',{placeholder:'למשל: מלח ורוד #1',okLabel:'המשך'}); if(!name) return;
    const unit=(await appPrompt('יחידה:','גרם',{placeholder:'גרם / מטר / מנות',okLabel:'＋ הוסף'}));
    if(unit===null||unit===false) return;
    const a=invEnsure(); a.push({id:uid(),name,qty:0,unit:unit||'יח׳',low:0}); invSave(a); cPaintProjects();
  });
  const ish=$("#cInvShop"); if(ish) ish.addEventListener('click',openPantryShop);
  const irs=$("#cInvReset"); if(irs) irs.addEventListener('click',()=>{
    appConfirm('לשחזר את המזווה לרשימת ברירת המחדל המלאה (24 חומרים)?\nהכמויות הנוכחיות יאופסו.',{okLabel:'↺ שחזר',danger:true}).then(y=>{ if(y!==true) return; invResetFull(); cPaintProjects(); if(typeof toast==='function') toast('המזווה שוחזר ✓'); });
  });
  const upd=(id,val)=>{ const a=invEnsure(); const it=a.find(x=>x.id===id); if(it){ it.qty=Math.max(0,val); invSave(a); cPaintProjects(); } };
  host.querySelectorAll('[data-invq]').forEach(inp=>inp.addEventListener('change',()=>upd(inp.dataset.invq,+inp.value||0)));
  host.querySelectorAll('[data-invinc]').forEach(b=>b.addEventListener('click',()=>{ const a=invEnsure(); const it=a.find(x=>x.id===b.dataset.invinc); if(it) upd(it.id,it.qty+ (it.unit==='גרם'?10:1)); }));
  host.querySelectorAll('[data-invdec]').forEach(b=>b.addEventListener('click',()=>{ const a=invEnsure(); const it=a.find(x=>x.id===b.dataset.invdec); if(it) upd(it.id,it.qty-(it.unit==='גרם'?10:1)); }));
  host.querySelectorAll('[data-invrm]').forEach(b=>b.addEventListener('click',()=>{
    appConfirm('להסיר את הפריט מהמזווה?',{okLabel:'הסר',danger:true}).then(y=>{ if(y!==true) return; invSave(invEnsure().filter(x=>x.id!==b.dataset.invrm)); cPaintProjects(); });
  }));
  // wire — links
  host.querySelectorAll('[data-mfn]').forEach(b=>b.addEventListener('click',()=>{ const fn=b.dataset.mfn; if(typeof window[fn]==='function') window[fn](); }));
}
// reset all interactive progress marks for a recipe
function resetRecipeProgress(key){
  if(typeof cardClear==='function') cardClear(key);
  try{
    const rm=[];
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
      if(k && (k.startsWith(key+'-')||k==='done:'+key)) rm.push(k);
    }
    rm.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
}
// global pantry shopping list — everything low/out of stock across the pantry
function openPantryShop(){
  const inv=invEnsure(); const low=inv.filter(i=>i.qty<=i.low);
  const byGrp={}; low.forEach(i=>{ const g=i.grp||'שונות'; (byGrp[g]=byGrp[g]||[]).push(i); });
  const line=(i)=>{ const txt=i.name+(i.low>0?` · יעד ≥${i.low} ${i.unit}`:'')+` · יש ${i.qty}`; const done=store.get("shop:"+i.name)?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(i.name)}">${done?"✓":""}</span><span>${txt}</span></div>`; };
  const body=low.length?Object.keys(byGrp).map(g=>`<div class="shop-group"><h4>${g}</h4>${byGrp[g].map(line).join('')}</div>`).join(''):'<div class="shop-empty">המזווה מלא — אין חוסרים 🎉</div>';
  showPanel(`${toolTop('קניות למזווה','חומרי גלם חסרים או נמוכים','🛒','#9e4a3d')}
    <div class="panel-body">
      ${body}
      ${low.length?`<button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ הדפס רשימה</button>`:''}
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  pnl.querySelectorAll('[data-shopck]').forEach(cb=>cb.addEventListener('click',()=>{ const k="shop:"+decodeURIComponent(cb.dataset.shopck); store.set(k,!store.get(k)); openPantryShop(); }));
  const pr=pnl.querySelector('[data-print]'); if(pr) pr.addEventListener('click',()=>window.print());
}
// extract only the relevant shopping items for a single recipe (not the whole menu)
function recipeMaterials(meta){
  if(!meta) return [];
  const out=[];
  const bld=(meta.obj&&meta.obj.build)||(meta.build)||(DATA.makes[(meta.key||'').replace(/^make-/,'')]||{}).build||{};
  if(bld && Array.isArray(bld.materials) && bld.materials.length){
    bld.materials.forEach(m=>out.push(String(m)));
  }
  const o=meta.obj||{};
  if(meta.kind==='cut'){
    if(o.heb) out.push(o.heb+(o.kg?` (~${o.kg} ק״ג)`:''));
    if(o.rub && o.rub!=='—') String(o.rub).split(/[+,\/]/).forEach(r=>{const t=r.trim(); if(t) out.push(t);});
    if(o.wood && o.wood!=='ללא') out.push('עצי '+o.wood);
  } else if(meta.kind==='spec'){
    if(o.cure && o.cure!=='—') out.push(o.cure);
    if(o.wood && o.wood!=='ללא') out.push('עצי '+o.wood);
  }
  // dedup
  return [...new Set(out.filter(Boolean))];
}
// standalone recipe shopping list — only this recipe's items, marked have/missing, nothing from the menu
function openRecipeShop(meta){
  if(!meta) return;
  const mats=recipeMaterials(meta); const inv=invEnsure();
  const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(name)||name.includes(i.name.split(' ')[0])));
  const showMissingKey='shopmiss:'+(meta.key||'');
  const onlyMissing=store.get(showMissingKey)||false;
  const line=(text,have)=>{ const done=store.get("shop:"+text)?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(text)}">${done?"✓":""}</span><span>${text} ${have?'<b style="color:var(--good)">· יש במזווה</b>':'<b style="color:var(--terra-d)">· חסר</b>'}</span></div>`; };
  let list=mats.map(mt=>({mt,have:invHas(String(mt).split(/[0-9]/)[0].trim())}));
  if(onlyMissing) list=list.filter(x=>!x.have);
  const matHTML=list.length?list.map(x=>line(x.mt,x.have)).join(''):'<div class="shop-empty">אין פריטים להצגה.</div>';
  const missCount=mats.filter(mt=>!invHas(String(mt).split(/[0-9]/)[0].trim())).length;
  showPanel(`${toolTop('קניות למתכון',meta.heb,'🛒','#e07a52')}
    <div class="panel-body">
      <div class="shop-toggle"><button class="${onlyMissing?'':'on'}" data-showall>הכל (${mats.length})</button><button class="${onlyMissing?'on':''}" data-showmiss>רק חסר (${missCount})</button></div>
      <div class="shop-group">${matHTML}</div>
      <button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ הדפס רשימה</button>
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  pnl.querySelectorAll('[data-shopck]').forEach(cb=>cb.addEventListener('click',()=>{ const k="shop:"+decodeURIComponent(cb.dataset.shopck); store.set(k,!store.get(k)); openRecipeShop(meta); }));
  const sa=pnl.querySelector('[data-showall]'); if(sa) sa.addEventListener('click',()=>{ store.set(showMissingKey,false); openRecipeShop(meta); });
  const sm=pnl.querySelector('[data-showmiss]'); if(sm) sm.addEventListener('click',()=>{ store.set(showMissingKey,true); openRecipeShop(meta); });
  const pr=pnl.querySelector('[data-print]'); if(pr) pr.addEventListener('click',()=>window.print());
}
function openProjectCart(p){
  const meta=resolveItem(p.key)||{};
  const boughtRaw=(p.source==='bought');
  const bld=boughtRaw?{}:((meta.obj&&meta.obj.build)||itemScratchBuild(meta)||(DATA.makes[(p.key||'').replace(/^make-/,'')]||{}).build||{});
  const mats=boughtRaw?[]:(bld.materials||[]); const inv=invEnsure();
  const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(name)||name.includes(i.name.split(' ')[0])));
  const line=(text,have)=>{ const done=store.get("shop:"+text)?"done":""; 
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(text)}">${done?"✓":""}</span><span>${text}${have?' <b style="color:var(--good)">· יש</b>':' <b style="color:var(--terra-d)">· חסר</b>'}</span></div>`; };
  const matHTML=mats.length?mats.map(mt=>{const key=String(mt).split(/[0-9]/)[0].trim();return line(mt,invHas(key));}).join(''):(boughtRaw?`<div class="shop-empty">פריט שנקנה מוכן — אין חומרי-גלם לרכישה.${p.finish?' שלב סיום: '+p.finish:''}</div>`:'<div class="shop-empty">אין רשימת מרכיבים למתכון זה.</div>');
  const low=inv.filter(i=>i.qty<=i.low);
  const lowHTML=low.length?`<div class="shop-group"><h4>📦 מהמזווה — להשלים</h4>${low.map(i=>line(i.name+(i.low>0?` (יעד ≥${i.low} ${i.unit})`:'')+` · יש ${i.qty}`,false)).join('')}</div>`:'';
  showPanel(`${toolTop('קניות לפרויקט',p.name,'🛒','#9e4a3d')}
    <div class="panel-body">
      <div class="shop-group"><h4>🧫 מרכיבים וציוד</h4>${matHTML}</div>
      ${lowHTML}
      <button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ הדפס רשימה</button>
    </div>`);
  const pnl=$("#panel");
  if(pnl){
    pnl.querySelectorAll('[data-shopck]').forEach(cb=>cb.addEventListener('click',()=>{
      const k="shop:"+decodeURIComponent(cb.dataset.shopck); store.set(k,!store.get(k)); openProjectCart(p);
    }));
    pnl.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
  }
}
let projPick={cat:'', cont:'', q:''};
function openProjectPicker(){
  projPick={cat:'', cont:'', q:''};
  showPanel(`${toolTop('פרויקט חדש','שרקוטרי · נקניקים · כבישה — בחר מלאכה','🧫','#9e4a3d')}
    <div class="chome-search" style="margin:12px 16px 6px"><span class="ic">⌕</span><input id="ppSearch" placeholder="חפש — שם, מדינה, סוג…"></div>
    <div id="ppChips" style="padding:0 12px"></div>
    <div class="panel-body" id="ppBody" style="padding-top:6px"></div>`);
  const s=$("#ppSearch"); if(s) s.addEventListener('input',()=>{ projPick.q=s.value.trim().toLowerCase(); ppRender(); });
  ppRender('project');
}
function openBuyStorePicker(){
  projPick={cat:'', cont:'', q:''};
  showPanel(`${toolTop('קניתי — לאחסון','בחר מה קנית · יישמר במזווה כרכיב מוכן','🛒','#1a9a7a')}
    <div class="chome-search" style="margin:12px 16px 6px"><span class="ic">⌕</span><input id="ppSearch" placeholder="חפש — נקניק, גבינה, פסטרמה…"></div>
    <div id="ppChips" style="padding:0 12px"></div>
    <div class="panel-body" id="ppBody" style="padding-top:6px"></div>`);
  const s=$("#ppSearch"); if(s) s.addEventListener('input',()=>{ projPick.q=s.value.trim().toLowerCase(); ppRender('buy'); });
  ppRender('buy');
}
async function buyStoreCreate(meta){
  const finishable=(meta.cat==='גבינה')||isProjectItem(meta);
  const ans=await appConfirm(`קנית "${meta.heb}" — באיזה מצב?`,{okLabel:'✅ מוכן להגשה',cancelLabel:'📦 צריך סיום'});
  if(ans===null) return;
  const stage=(ans===true)?'done':'ready';
  const p={id:uid(),key:meta.key,name:meta.heb,source:'bought',stage,start:today(),doneSteps:[]};
  const a=pantry(); a.push(p); savePantry(a);
  if(typeof toast==='function') toast(`${meta.heb} נשמר במזווה · ${stage==='done'?'מוכן להגשה':'מוכן לסיום'}`);
  cNavGo('projects'); cPaintProjects();
}
function ppAllItems(){
  const all=(typeof cwAllItems==='function')?cwAllItems():[];
  return all.filter(m=>m&&isProjectItem(m));
}
function ppRender(mode){
  mode=mode||projPick.mode||'project'; projPick.mode=mode;
  const items0=ppAllItems();
  const cats=[...new Set(items0.map(m=>m.cat))];
  const conts=[...new Set(items0.map(m=>itemContinent(m)).filter(Boolean))];
  const chips=$("#ppChips"); if(chips){
    chips.innerHTML=`<div class="chips">${[['','הכל'],...cats.map(c=>[c,c])].map(([v,l])=>`<span class="chip ${projPick.cat===v?'on':''}" data-ppcat="${v}">${v?catEmoji(v)+' ':''}${l}</span>`).join('')}</div>`+
      (conts.length>1?`<div class="chips" style="margin-top:6px">${[['','🌍 כל היבשות'],...conts.map(c=>[c,c])].map(([v,l])=>`<span class="chip ${projPick.cont===v?'on':''}" data-ppcont="${v}">${l}</span>`).join('')}</div>`:'');
    chips.querySelectorAll('[data-ppcat]').forEach(el=>el.addEventListener('click',()=>{ projPick.cat=el.dataset.ppcat; ppRender(); }));
    chips.querySelectorAll('[data-ppcont]').forEach(el=>el.addEventListener('click',()=>{ projPick.cont=el.dataset.ppcont; ppRender(); }));
  }
  let items=items0;
  if(projPick.cat) items=items.filter(m=>m.cat===projPick.cat);
  if(projPick.cont) items=items.filter(m=>itemContinent(m)===projPick.cont);
  if(projPick.q) items=items.filter(m=>(m.heb+' '+m.eng+' '+m.cat+' '+itemOrigin(m)+' '+itemRichDesc(m)).toLowerCase().includes(projPick.q));
  // group by category for display
  const host=$("#ppBody"); if(!host) return;
  if(!items.length){ host.innerHTML='<div class="shop-empty">לא נמצאו מתכונים בסינון הזה.</div>'; return; }
  const groups={}; items.forEach(m=>{ (groups[m.cat]=groups[m.cat]||[]).push(m); });
  host.innerHTML=Object.entries(groups).map(([cat,list])=>`
    <div class="pp-group"><div class="pp-gh">${catEmoji(cat)} ${cat} <span style="color:var(--smoke);font-weight:400">· ${list.length}</span></div>
    ${list.map(m=>{
      const org=itemOrigin(m), desc=itemRichDesc(m);
      const diff=(m.obj&&m.obj.diff)||m.diff;
      return `<button class="pp-item" data-ppick="${m.key}">
        <div class="pp-item-h"><span class="pp-emoji">${itemEmoji(m.cat,m.key)}</span><b>${m.heb}</b>${diff?`<span class="pp-diff">${'★'.repeat(Math.min(diff,3))}</span>`:''}</div>
        ${org?`<div class="pp-org">${org}</div>`:''}
        ${desc?`<div class="pp-desc">${desc}</div>`:''}
      </button>`;
    }).join('')}</div>`).join('');
  host.querySelectorAll('[data-ppick]').forEach(el=>el.addEventListener('click',()=>{
    const meta=resolveItem(el.dataset.ppick); if(!meta) return;
    if(mode==='buy') buyStoreCreate(meta); else openProjectWizard(meta);
  }));
}
// ── interactive burger builder ──
const BURGER_TOPPINGS=['🥬 חסה','🍅 עגבנייה','🧅 בצל טרי','🧅 בצל מקורמל','🥒 חמוצים','🥓 בייקון','🍳 ביצת עין','🍄 פטריות מוקפצות','🌶️ הלפיניו','🥑 אבוקדו/גוואק'];
const BURGER_SAUCES=['קטשופ','חרדל','מיונז','רוטב BBQ','איולי שום','רוטב הבית (1000 island)'];
const BURGER_BUNS=['בריוש','שומשום קלאסי','פרעצל','לחמניית תפו״א','אנגלית (מאפין)','ללא (חסה)'];
function cheeseNames(){ const s=new Set(); const grab=c=>{ if(c&&c.cat==='גבינה') s.add(String(c.heb).split(' /')[0].split(' (')[0].trim()); }; (DATA.cuts||[]).forEach(grab); (DATA.specials||[]).forEach(grab); return s.size?[...s]:['צ׳דר','גאודה','אמנטל','מוצרלה']; }
/* ── burgers per diner — context-scoped instance (like seasonings) ── */
const BURGER_DONE={mr:['מדיום-רייר',55],med:['מדיום',57],mw:['מדיום-וול',63],well:['וול-דאן',71]};
function burgerKey(){ return 'burgers:'+seasCtx(); }
function burgerDiners(){
  const a=store.get(burgerKey());
  if(Array.isArray(a)&&a.length) return a;
  const legacy=store.get('mk-burger')||{};
  return [Object.assign({id:uid(),name:'סועד 1',done:'med',cheesePos:'top',cheese:'צ׳דר',tops:['🥬 חסה','🍅 עגבנייה','🧅 בצל מקורמל'],sauce:'רוטב הבית (1000 island)',bun:'בריוש'},legacy)];
}
function saveBurgerDiners(a){ store.set(burgerKey(),a); }
function burgerSummaryLine(d){
  const dn=BURGER_DONE[d.done]||BURGER_DONE.med;
  const ch=d.cheesePos==='none'?'ללא גבינה':(d.cheesePos==='stuffed'?`🧀 ${d.cheese} ממולא`:`🧀 ${d.cheese}`);
  return `${dn[0]} ${dn[1]}° · ${ch} · ${d.tops.length} תוספות${d.sauce?` · ${d.sauce.split(' (')[0]}`:''}`;
}
// pure task builder for the work plan (testable)
function burgerPlanTasks(diners, startClock, serveClock, name, detail){
  const tasks=[]; if(!diners||!diners.length) return tasks;
  const tops=[...new Set(diners.flatMap(d=>d.tops||[]))];
  const sauces=[...new Set(diners.map(d=>d.sauce).filter(Boolean))];
  const buns=[...new Set(diners.map(d=>d.bun).filter(Boolean))];
  tasks.push({t:new Date(startClock.getTime()-45*60e3),label:`🍔 מיז-אן-פלאס בורגרים (${diners.length} סועדים) — ${name}`,sub:tops.join(' · ')||'ללא תוספות',kind:'prep',det:detail?`רטבים: ${sauces.join(', ')||'—'} · לחמניות: ${buns.join(', ')||'—'} · קלייה קלה ללחמניות לקראת הגשה`:''});
  const stuffed=diners.filter(d=>d.cheesePos==='stuffed');
  if(stuffed.length) tasks.push({t:new Date(startClock.getTime()-30*60e3),label:`🧀 Juicy Lucy — מילוי קציצות (${stuffed.map(d=>d.name).join(', ')})`,sub:'',kind:'prep',det:detail?'שתי קציצות דקות לכל אחת, גבינה באמצע, לאטום היטב את השוליים':''});
  const byDone={}; diners.forEach(d=>{ (byDone[d.done]=byDone[d.done]||[]).push(d); });
  Object.entries(byDone).sort((a,b)=>(BURGER_DONE[b[0]]||[,0])[1]-(BURGER_DONE[a[0]]||[,0])[1]).forEach(([done,ds])=>{
    const dn=BURGER_DONE[done]||BURGER_DONE.med;
    const cheeseTop=ds.filter(d=>d.cheesePos==='top');
    tasks.push({t:startClock,label:`🔥 קציצות ${dn[0]} — יעד ${dn[1]}°C (${ds.map(d=>d.name).join(', ')})`,sub:done==='well'?'בטיחות בשר טחון: 71°C':'',kind:'cook',det:detail?(cheeseTop.length?`🧀 גבינה מעל בדקה האחרונה: ${cheeseTop.map(d=>d.name).join(', ')} · `:'')+'הפיכה אחת, לא ללחוץ על הקציצה':''});
  });
  tasks.push({t:new Date(serveClock.getTime()-10*60e3),label:`🍔 הרכבה אישית לפי סועד — ${name}`,sub:`${diners.length} בורגרים`,kind:'serve',det:detail?diners.map(d=>`${d.name}: ${burgerSummaryLine(d)}`).join(' | '):''});
  return tasks;
}
let _bOpen=null;
function openBurgerBuilder(){
  const diners=burgerDiners(); saveBurgerDiners(diners); // ensure persisted in this ctx
  if(_bOpen===null||!diners.some(d=>d.id===_bOpen)) _bOpen=diners[0].id;
  const cheeses=cheeseNames();
  const guests=(typeof menuState==='function')?(menuState().guests||0):0;
  const chip=(txt,on,attr)=>`<span class="cmethod ${on?'on':''}" ${attr}>${txt}</span>`;
  const dinerCard=d=>{
    const open=d.id===_bOpen;
    if(!open) return `<div class="cscard" style="cursor:pointer" data-bopen="${d.id}"><h4>🍔 ${d.name} <span style="font-weight:400;font-size:11.5px;color:var(--smoke)">· ${burgerSummaryLine(d)}</span></h4></div>`;
    return `<div class="cscard" data-bcard="${d.id}">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input data-bname="${d.id}" value="${(d.name||'').replace(/"/g,'&quot;')}" style="flex:1;background:var(--char);border:1.5px solid var(--line2);border-radius:10px;padding:9px;color:var(--bone);font-family:'Heebo';font-weight:800">
        <button class="mchip" data-bdup="${d.id}" title="שכפל">⧉</button>
        ${diners.length>1?`<button class="mchip" data-brm="${d.id}" title="הסר">🗑</button>`:''}
      </div>
      <h4>🌡️ מידת עשייה</h4><div class="cmethods">${Object.entries(BURGER_DONE).map(([k,[l,c]])=>chip(`${l} ${c}°`,d.done===k,`data-bdone="${k}" data-bid="${d.id}"`)).join('')}</div>
      ${d.done!=='well'?`<div style="font-size:11px;color:var(--smoke);margin:4px 2px 0">⚠ בבשר טחון ההמלצה הרשמית היא 71°C — פחות מזה על אחריותך ומבשר טרי בלבד.</div>`:''}
      <h4 style="margin-top:12px">🧀 גבינה</h4><div class="cmethods">
        ${chip('ללא',d.cheesePos==='none',`data-bcp="none" data-bid="${d.id}"`)}
        ${chip('מעל (נמסה)',d.cheesePos==='top',`data-bcp="top" data-bid="${d.id}"`)}
        ${chip('ממולאת (Juicy Lucy)',d.cheesePos==='stuffed',`data-bcp="stuffed" data-bid="${d.id}"`)}
      </div>
      ${d.cheesePos!=='none'?`<div class="cmethods" style="margin-top:6px">${cheeses.map(c=>chip(c,d.cheese===c,`data-bche="${c}" data-bid="${d.id}"`)).join('')}</div>`:''}
      <h4 style="margin-top:12px">🥗 תוספות</h4><div class="cmethods">${BURGER_TOPPINGS.map(t=>chip(t,(d.tops||[]).includes(t),`data-btop="${t}" data-bid="${d.id}"`)).join('')}</div>
      <h4 style="margin-top:12px">🥫 רוטב</h4><div class="cmethods">${BURGER_SAUCES.map(x=>chip(x,d.sauce===x,`data-bsauce="${x}" data-bid="${d.id}"`)).join('')}</div>
      <h4 style="margin-top:12px">🍞 לחמנייה</h4><div class="cmethods">${BURGER_BUNS.map(x=>chip(x,d.bun===x,`data-bbun="${x}" data-bid="${d.id}"`)).join('')}</div>
    </div>`;
  };
  showPanel(`${toolTop('בורגר לכל סועד','מידת עשייה, גבינה, תוספות ורוטב — אישית','🍔','#c0563a')}
    <div class="panel-body">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="ccta" data-badd style="margin:0;flex:1;padding:11px;font-size:13.5px">＋ הוסף סועד</button>
        ${guests>diners.length?`<button class="ccta ghostc" data-bfill style="margin:0;flex:1;padding:11px;font-size:13.5px;background:none;border:1.5px solid var(--ember);color:var(--ember)">השלם ל-${guests} סועדים</button>`:''}
      </div>
      ${diners.map(dinerCard).join('')}
      <div style="font-size:11.5px;color:var(--smoke);padding:6px 4px 8px">ההגדרות נשמרות לבישול/אירוע הנוכחי ומופיעות בתוכנית העבודה — כולל קיבוץ קציצות לפי מידת עשייה והרכבה אישית.</div>
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  const upd=fn=>{ const a=burgerDiners(); fn(a); saveBurgerDiners(a); openBurgerBuilder(); };
  pnl.querySelectorAll('[data-bopen]').forEach(x=>x.addEventListener('click',()=>{ _bOpen=x.dataset.bopen; openBurgerBuilder(); }));
  pnl.querySelectorAll('[data-badd]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const base=a[a.length-1]; const nd=Object.assign({},base,{id:uid(),name:'סועד '+(a.length+1),tops:[...(base.tops||[])]}); a.push(nd); _bOpen=nd.id; })));
  pnl.querySelectorAll('[data-bfill]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const base=a[0]; while(a.length<guests){ a.push(Object.assign({},base,{id:uid(),name:'סועד '+(a.length+1),tops:[...(base.tops||[])]})); } })));
  pnl.querySelectorAll('[data-bdup]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const i=a.findIndex(d=>d.id===x.dataset.bdup); if(i<0)return; const nd=Object.assign({},a[i],{id:uid(),name:a[i].name+' (2)',tops:[...(a[i].tops||[])]}); a.splice(i+1,0,nd); _bOpen=nd.id; })));
  pnl.querySelectorAll('[data-brm]').forEach(x=>x.addEventListener('click',async()=>{ if((await appConfirm('להסיר את הסועד?',{okLabel:'הסר',danger:true}))!==true) return; upd(a=>{ const i=a.findIndex(d=>d.id===x.dataset.brm); if(i>=0&&a.length>1) a.splice(i,1); }); }));
  pnl.querySelectorAll('[data-bname]').forEach(x=>x.addEventListener('change',()=>upd(a=>{ const d=a.find(y=>y.id===x.dataset.bname); if(d) d.name=x.value.trim()||d.name; })));
  const bid=x=>x.dataset.bid;
  pnl.querySelectorAll('[data-bdone]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.done=x.dataset.bdone; })));
  pnl.querySelectorAll('[data-bcp]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.cheesePos=x.dataset.bcp; })));
  pnl.querySelectorAll('[data-bche]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.cheese=x.dataset.bche; })));
  pnl.querySelectorAll('[data-btop]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(!d)return; const t=x.dataset.btop; d.tops=(d.tops||[]).includes(t)?d.tops.filter(z=>z!==t):[...(d.tops||[]),t]; })));
  pnl.querySelectorAll('[data-bsauce]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.sauce=d.sauce===x.dataset.bsauce?'':x.dataset.bsauce; })));
  pnl.querySelectorAll('[data-bbun]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.bun=x.dataset.bbun; })));
}
// ── guided project-creation wizard (multi-step, like the event wizard) ──
let pwState=null;
const AGED_CATS=['נקניק מיובש','פסטרמה','סלומי','בשר מיובש','דג מעושן','בייקון'];
function projItemKind(meta){
  // 'aged' = weight/days tracking (dry/cure) · 'scratch' = fresh build-from-phases (sausages, kofta, shawarma)
  if(!meta) return 'scratch';
  const o=meta.obj||{};
  if(AGED_CATS.includes(meta.cat)) return 'aged';
  if(meta.cat==='גבינה' && (o.smt||o.age||o.cure)) return 'aged';
  if(/Bacon|Jerky|Biltong|Pastrami|Bresaola|Pancetta|Coppa|Guanciale|Lonzino|Speck|Lox|Gravlax|Sucuk|Salami|Salume|Pepperoni|Kabanos|Landj/i.test(meta.eng||'')) return 'aged';
  return 'scratch';
}
function pwGuessType(meta){
  if(projItemKind(meta)==='scratch') return 'scratch';
  return /Bacon|Pastrami|Brine|כבישה|Lox|Gravlax/i.test(meta.eng||'')&&!/Dry|Bresaola|Salame|Salami|Speck|Lonzino|Coppa|Chorizo|Sucuk|Pepperoni/i.test(meta.eng||'')?'cure':'dry';
}
function pwSuggestDays(meta){
  const t=(meta.desc||'')+' '+(meta.heb||'');
  const wk=t.match(/(\d+)\s*[-–]?\s*(\d+)?\s*שבוע/); if(wk){ const a=+wk[1], b=wk[2]?+wk[2]:a; return Math.round((a+b)/2)*7; }
  const dy=t.match(/(\d+)\s*[-–]?\s*(\d+)?\s*ימ/); if(dy){ const a=+dy[1], b=dy[2]?+dy[2]:a; return Math.round((a+b)/2); }
  return 21;
}

/* ═══ FEATURE 2 (R1.2) · יועץ-מזווה (תכנון-אחורה) ═══
   prodDaysFor = deterministic lead-time FROM THE DATA (P3 — never from AI). */
function prodDaysFor(meta){
  if(!meta) return 1;
  const kind=(typeof projItemKind==='function')?projItemKind(meta):'scratch';
  if(kind==='aged') return Math.max(1, pwSuggestDays(meta));         // dry/cure: weeks/days parsed from description
  // scratch (fresh sausage/kofta/shawarma): lead-time from rest/aging in phases
  const b=(typeof itemScratchBuild==='function')?itemScratchBuild(meta):null;
  const txt=(b?(b.phases||[]).map(p=>Array.isArray(p)?(p[1]||''):(p.body||'')).join(' '):'')+' '+(meta.desc||'')+' '+(meta.heb||'');
  if(/48\s*שע|יומיים|2[-–\s]*3\s*ימ|2\s*ימ/.test(txt)) return 2;    // long overnight rest
  if(/24\s*שע|לילה|מנוחת|יישון קצר/.test(txt)) return 1;            // single overnight
  return 1;                                                          // fresh: same-day / day-before prep
}
// deterministic backward schedule for a target date (works WITHOUT a key)
function pantryAdvisorLocal(targetDate){
  const tgt=targetDate||today();
  const daysLeft=daysBetween(today(),tgt);
  const cands=cwAllItems().filter(m=>typeof isProjectItem==='function'?isProjectItem(m):(m.kind==='make'));
  const feasible=[], tooLate=[];
  cands.forEach(m=>{
    const meta=(typeof resolveItem==='function')?resolveItem(m.key):m;
    const days=prodDaysFor(meta);
    const startBy=addDays(tgt,-days);
    const row={key:m.key,heb:m.heb,cat:m.cat,days,startBy,kind:projItemKind(meta)};
    if(days<=daysLeft) feasible.push(row); else tooLate.push(row);
  });
  feasible.sort((a,b)=>b.days-a.days);   // longest lead-time first (start those now)
  tooLate.sort((a,b)=>a.days-b.days);
  return {targetDate:tgt, daysLeft, feasible, tooLate};
}
// grounding for the AI: target + days-left + candidates WITH their data-derived lead-times
function pantryAdvisorGrounding(targetDate){
  const loc=pantryAdvisorLocal(targetDate);
  const rows=loc.feasible.concat(loc.tooLate).map(r=>`${r.key} · ${r.heb} (${r.cat}) · משך ייצור ${r.days} ימים`);
  const pan=(typeof pantry==='function'?pantry():[]).map(p=>p.name).join(', ')||'ריק';
  return `תאריך יעד: ${loc.targetDate} · ימים עד היעד: ${loc.daysLeft}\nכבר במזווה: ${pan}\n`
    +`מועמדים (משך-הייצור כבר מחושב — אל תשנה אותו; בחר keys מכאן בלבד):\n`+rows.join('\n');
}
async function pantryAdvisorAI(targetDate){
  const grounding=pantryAdvisorGrounding(targetDate);
  const schema='{"recommend":[{"key":"<key>","reason":"<קצר: למה כדאי>"}],"warnings":["<אזהרה>"]}';
  const task='המלץ אילו מלאכות כדאי להתחיל כדי להיות מוכן לתאריך היעד, לפי משכי-הייצור הנתונים. סדר לפי מה שצריך להתחיל ראשון. הוסף אזהרות אם משהו לא יספיק. בחר keys מהרשימה בלבד.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.35,maxTokens:1200});
  const rec=aiValidateItems(raw&&raw.recommend).kept;
  // recompute startBy IN-APP from data (never trust AI dates/durations — P3)
  const enriched=rec.map(r=>{ const meta=resolveItem(r.key); const days=prodDaysFor(meta); return {key:r.key, heb:meta.heb, cat:meta.cat, reason:r.reason, days, startBy:addDays(targetDate,-days), kind:projItemKind(meta)}; });
  const warnings=Array.isArray(raw&&raw.warnings)?raw.warnings.slice(0,4):[];
  return {recommend:enriched, warnings};
}
function openProjectWizard(meta){
  pwState={meta,step:0,name:meta.heb,type:pwGuessType(meta),start:today(),startW:1000,factor:0.62,days:pwSuggestDays(meta)};
  showPanel(`${toolTop('אשף פרויקט','צור פרויקט מלאכה חדש','🧫','#9e4a3d')}
    <div class="cwprog" id="pwProg" style="padding:0 22px 16px"></div>
    <div class="panel-body" id="pwBody"></div>`);
  pwRender();
}
function pwRender(){
  const host=$("#pwBody"); if(!host||!pwState) return;
  const s=pwState, meta=s.meta; const TOTAL=4;
  const prog=$("#pwProg"); if(prog) prog.innerHTML=Array.from({length:TOTAL},(_,i)=>`<div class="cwseg ${i<s.step?'done':''} ${i===s.step?'cur':''}"></div>`).join('');
  const inp='width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:\'Heebo\';font-size:15px;margin-bottom:10px';
  let body='';
  if(s.step===0){
    const scratch=s.type==='scratch';
    body=`<div class="cwq">פרטי הפרויקט</div><div class="cwsub">תן שם ובחר את סוג התהליך.</div>
      <div class="cscard">
        <input id="pwn" placeholder="שם הפרויקט" value="${s.name}" style="${inp}">
        <input id="pwstart" type="date" value="${s.start}" style="${inp}">
      </div>
      <div class="cscard"><h4>⚙️ סוג התהליך</h4><div class="cmethods" id="pwtype">
        <span class="cmethod ${s.type==='scratch'?'on':''}" data-pwt="scratch">🍖 בנייה מאפס (טרי)</span>
        <span class="cmethod ${s.type==='dry'?'on':''}" data-pwt="dry">🧫 ייבוש למשקל</span>
        <span class="cmethod ${s.type==='cure'?'on':''}" data-pwt="cure">🧂 כבישה בימים</span>
      </div></div>
      ${scratch?`<div class="cscard" style="background:var(--fresh-l);border-color:#b8e0d4"><h4>🍖 בנייה מאפס</h4><div style="font-size:12.5px;color:var(--bone);line-height:1.6">מלאכה טרייה — טחינה, תיבול, מילוי/עיצוב ובישול. ${(()=>{const ph=(itemScratchBuild(meta)||{}).phases||[];return ph.length?`${ph.length} שלבים.`:'';})()} עוקבים אחרי השלבים במזווה, ואפשר לאחסן ולסיים בהמשך.</div></div>
      <button class="ccta" data-pwcreate>🍖 צור פרויקט מאפס</button>`
      :`<button class="ccta" data-pwnext>המשך ליעד ←</button>`}`;
  } else if(s.step===1){
    body=s.type==='dry'?`<div class="cwq">יעד ייבוש</div><div class="cwsub">המוצר מוכן כשאיבד אחוז מהמשקל (35–40% קלאסי).</div>
      <div class="cstepper"><button data-pwwm>−</button><div class="val" id="pwwv">${s.startW}<small>גרם התחלה</small></div><button data-pwwp>+</button></div>
      <div class="cscard"><h4>📉 אחוז ירידת יעד</h4><div class="cmethods">
        <span class="cmethod ${s.factor==0.65?'on':''}" data-pwf="0.65">35%</span>
        <span class="cmethod ${s.factor==0.62?'on':''}" data-pwf="0.62">38%</span>
        <span class="cmethod ${s.factor==0.6?'on':''}" data-pwf="0.6">40%</span>
      </div><div style="font-size:13px;color:var(--fresh);font-weight:700;margin-top:12px">יעד משקל: ${Math.round(s.startW*s.factor)} ג׳</div></div>
      <button class="ccta" data-pwnext>המשך למרכיבים ←</button>`
    :`<div class="cwq">משך כבישה</div><div class="cwsub">כמה ימים עד שהמוצר מוכן.</div>
      <div class="cstepper"><button data-pwdm>−</button><div class="val" id="pwdv">${s.days}<small>ימים</small></div><button data-pwdp>+</button></div>
      <div class="cscard"><div style="font-size:13px;color:var(--fresh);font-weight:700">סיום משוער: ${fmtDate(addDays(s.start,s.days))}</div></div>
      <button class="ccta" data-pwnext>המשך למרכיבים ←</button>`;
  } else if(s.step===2){
    const bld=(meta.obj&&meta.obj.build)||(DATA.makes[(meta.key||'').replace(/^make-/,'')]||{}).build||{};
    const mats=(bld.materials||[]); const inv=invEnsure();
    const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(name)||name.includes(i.name.split(' ')[0])));
    body=`<div class="cwq">מרכיבים וציוד</div><div class="cwsub">✓ = יש במזווה · חסרים יתווספו לרשימת הקניות.</div>
      <div class="cscard">${mats.length?mats.map(mt=>{const key=String(mt).split(/[0-9]/)[0].trim();const have=invHas(key);
        return `<div class="pw-mat ${have?'have':''}"><span>${have?'✓':'○'}</span> ${mt}</div>`;}).join(''):'<div style="color:var(--smoke);font-size:12.5px">אין רשימת מרכיבים ייעודית.</div>'}</div>
      <button class="ccta" data-pwnext>סקירה ויצירה ←</button>`;
  } else {
    const tgt=s.type==='dry'?`יעד ${Math.round(s.startW*s.factor)} ג׳ (ירידה ${Math.round((1-s.factor)*100)}%)`:`${s.days} ימים · סיום ${fmtDate(addDays(s.start,s.days))}`;
    body=`<div class="cwq">סקירה</div><div class="cwsub">בדוק ואשר — ייווצרו תזכורות אוטומטיות.</div>
      <div class="cscard">
        <div class="pw-rr"><span>שם</span><b>${s.name}</b></div>
        <div class="pw-rr"><span>סוג</span><b>${s.type==='dry'?'ייבוש למשקל':'כבישה בימים'}</b></div>
        <div class="pw-rr"><span>התחלה</span><b>${fmtDate(s.start)}</b></div>
        <div class="pw-rr"><span>יעד</span><b>${tgt}</b></div>
      </div>
      <button class="ccta" data-pwcreate>✓ צור פרויקט</button>`;
  }
  const backBtn=s.step>0?`<button class="cwclear" data-pwback style="margin:0 16px 8px">← חזרה</button>`:'';
  host.innerHTML=body+backBtn;
  const g=sel=>host.querySelector(sel);
  if(g('#pwn')) g('#pwn').addEventListener('input',e=>s.name=e.target.value);
  if(g('#pwstart')) g('#pwstart').addEventListener('change',e=>s.start=e.target.value);
  host.querySelectorAll('[data-pwt]').forEach(b=>b.addEventListener('click',()=>{s.type=b.dataset.pwt;pwRender();}));
  host.querySelectorAll('[data-pwf]').forEach(b=>b.addEventListener('click',()=>{s.factor=+b.dataset.pwf;pwRender();}));
  if(g('[data-pwwm]')) g('[data-pwwm]').addEventListener('click',()=>{s.startW=Math.max(100,s.startW-100);pwRender();});
  if(g('[data-pwwp]')) g('[data-pwwp]').addEventListener('click',()=>{s.startW=s.startW+100;pwRender();});
  if(g('[data-pwdm]')) g('[data-pwdm]').addEventListener('click',()=>{s.days=Math.max(1,s.days-1);pwRender();});
  if(g('[data-pwdp]')) g('[data-pwdp]').addEventListener('click',()=>{s.days=s.days+1;pwRender();});
  if(g('[data-pwback]')) g('[data-pwback]').addEventListener('click',()=>{s.step--;pwRender();});
  if(g('[data-pwnext]')) g('[data-pwnext]').addEventListener('click',()=>{s.step++;pwRender();});
  if(g('[data-pwcreate]')) g('[data-pwcreate]').addEventListener('click',pwCreate);
}
function pwCreate(){
  const s=pwState; if(!s) return;
  const p={id:uid(),key:s.meta.key,name:s.name||s.meta.heb,type:s.type,start:s.start||today(),doneSteps:[]};
  if(s.type==='scratch'){ p.source='scratch'; p.stage='building'; }
  else if(s.type==='dry'){ p.startW=s.startW||1000; p.factor=s.factor||0.62; p.curW=p.startW; }
  else { p.days=s.days||7; }
  const a=pantry(); a.push(p); savePantry(a);
  // auto-generate reminders
  projSeedReminders(p);
  store.set('mk-lastproj',p.id);
  pwState=null;
  if(typeof toast==='function') toast(s.type==='scratch'?'פרויקט מאפס נוצר 🍖 · עקוב אחרי השלבים במזווה':'הפרויקט נוצר · תזכורות נוספו ✓');
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('projects'); else if(typeof cPaintProjects==='function') cPaintProjects();
}
// auto-seed reminders based on project type/duration
function projSeedReminders(p){
  const rem=reminders(); const add=(text,date)=>rem.push({id:uid(),text:`[${p.name}] ${text}`,date,proj:p.id});
  if(p.type==='scratch'){ add('סיים והכן להגשה / אחסון',addDays(p.start,1)); store.set('mk-reminders',rem); return; }
  if(p.type==='dry'){
    add('בדוק משקל ושקול',addDays(p.start,7));
    add('בדוק לחות/עובש לבן תקין',addDays(p.start,14));
    const half=Math.max(21,Math.round((p.startW?21:21)));
    add('שקילה — קרוב ליעד?',addDays(p.start,28));
  } else {
    add('הפוך/ערבב את המוצר',addDays(p.start,Math.max(1,Math.round(p.days/2))));
    add('סיום כבישה — הוצא ושטוף',addDays(p.start,p.days));
  }
  store.set('mk-reminders',rem);
}
// catalog category tiles → jump into existing catalog filtered
const CCAT_TILES=[
  ['בקר','🥩','var(--beef,#c65a3f)'],['עוף','🍗','var(--poultry,#daa04a)'],['נקניקיות','🌭','var(--sausage,#e07a52)'],
  ['נקניק מיובש','🧂','var(--dried,#b07a3a)'],['טלה','🐑','var(--terra)'],['חזיר','🥩','var(--fruit,#e0748a)'],
  ['ירקות','🥦','var(--veg,#5aa84a)'],['פירות','🍑','var(--fruit,#e0748a)'],['דג','🐟','var(--fish,#5a9ab0)'],
  ['איברים פנימיים','🫀','#b06a7a'],['נקניק מעושן','🥓','var(--dried,#b07a3a)'],['מיוחדים','⭐','var(--ember2)'],
];
// more sheet — grouped tools
function openMoreSheet(){
  if(typeof showPanel!=='function'){ if(typeof openTools==='function') openTools(); return; }
  const grp=(title,items)=>`<div class="cmore-grp"><h4>${title}</h4>${items.map(([ic,label,fn])=>`<div class="cmore-item" data-mfn="${fn}"><span class="mi">${ic}</span>${label}<span class="mg">←</span></div>`).join('')}</div>`;
  const html=`${typeof toolTop==='function'?toolTop('עוד','כל הכלים והתכונות','☰','#e07a52'):'<h2 style=\"padding:16px\">עוד</h2>'}
    <div class="panel-body">
    ${grp('🍽️ עבודה',[['🍽️','בונה ארוחה','openMenu'],['📋','מתזמן','openTimeline'],['🖨️','הדפסת תפריט','openMenuPrint'],['🛒','רשימת קניות','openCart']])}
    ${grp('✨ חוויה',[['🧂','מתבלים ורטבים','openSeasonings'],['🔥','שאל את האש','openAsk'],['✨','מחולל מתכונים','openRecipeGen']])}
    ${grp('🧰 עזר',[['🧮','מחשבון מלח/כמויות','openCalc'],['🥩','מתרגם נתחים','openCutTrans'],['🌳','סוגי עץ','openWoods'],['🧫','פרויקטים ומזווה','openPantry'],['⏰','תזכורות','openReminders'],['📓','יומן','openJournal'],['📖','מילון','__gloss']])}
    ${grp('⚙️ הגדרות ועזרה',[['🎨','מראה — גוונים, פונט וגודל','openAppearance'],['🧭','רמת ממשק — מתחיל/בינוני/מתקדם','openUiLevel'],['🔧','הציוד שלי','openGear'],['❓','איך משתמשים','openGuide'],['🆘','מצב הצילו (תקלות)','openHelp'],['🔑','נהל מפתח AI','openKeyManager'],['ℹ️','אודות והיכולות','__about'],['💾','גיבוי ושחזור','openBackup']])}
    </div>`;
  showPanel(html);
  document.querySelectorAll('#panel [data-mfn]').forEach(el=>el.addEventListener('click',()=>{
    const fn=el.dataset.mfn;
    if(fn==='__about'){ if(typeof closePanel==='function') closePanel(); setTimeout(openAbout,60); return; }
    if(fn==='__gloss'){ closePanel&&closePanel(); cNavGo('catalog'); requestAnimationFrame(()=>{ if(typeof catView==='function') catView('gloss'); }); return; }
    if(typeof window[fn]==='function'){ if(typeof closePanel==='function') closePanel(); setTimeout(()=>window[fn](),60); }
  }));
}
// wire nav + home controls
document.querySelectorAll('[data-cnav]').forEach(b=>b.addEventListener('click',()=>cNavGo(b.dataset.cnav)));
document.querySelectorAll('[data-cgo]').forEach(b=>b.addEventListener('click',()=>cNavGo(b.dataset.cgo)));
// "יש לי אירוע" path + FAB → start a NEW clean event (guard unsaved draft)
function cStartNewEvent(){ setMenuCtx('event'); evGuardBeforeNew(()=>{ cwGo(0); cNavGo('wizard'); cwSyncFromMenu(); }); }
function cStartCook(){ setMenuCtx('cook'); cwGo(0); cNavGo('wizard'); if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); }
document.querySelectorAll('[data-cgo="wizard"],[data-cnav="wizard"]').forEach(b=>{ b.replaceWith(b.cloneNode(true)); });
document.querySelectorAll('[data-cgo="wizard"],[data-cnav="wizard"]').forEach(b=>b.addEventListener('click',cStartNewEvent));
(()=>{ const s=$("#cHomeSearch"); if(s) s.addEventListener('click',()=>cNavGo('catalog')); })();
(()=>{ const m=$("#cHomeMore"); if(m) m.addEventListener('click',openMoreSheet); })();
(()=>{ const a=$("#cHomeAbout"); if(a) a.addEventListener('click',()=>{ if(typeof openGuide==='function') openGuide(); }); })();
(()=>{ const a=$("#cHomeCaps"); if(a) a.addEventListener('click',()=>{ if(typeof openAbout==='function') openAbout(); }); })();
(()=>{ const host=$("#cGearBanner"); if(host && typeof gearConfigured==='function' && !gearConfigured()){
   host.innerHTML=`<button class="gear-banner" id="gearBanner">🔧 <span><b>הגדר את הציוד שלך</b> — כדי שהמתכונים יתאימו למה שיש לך</span><span class="gb-go">←</span></button>`;
   const b=$("#gearBanner"); if(b) b.addEventListener('click',()=>{ if(typeof openGear==='function') openGear(); });
} })();
(()=>{ const a=$("#cHomeAsk"); if(a) a.addEventListener('click',()=>{ if(typeof openAsk==='function') openAsk(); }); })();
(()=>{ const r=$("#cResume"); if(r) r.addEventListener('click',()=>{ const d=store.get('mk-cresume')||{}; if(typeof setMenuCtx==='function') setMenuCtx(d.ctx||'event'); if(typeof cwGo==='function') cwGo(typeof d.step==='number'?d.step:5); if(typeof cNavGo==='function') cNavGo('wizard'); if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); }); })();
(()=>{ const r=$("#cResumeProj"); if(r) r.addEventListener('click',()=>cNavGo('projects')); })();
(()=>{ const c=$("#cPathCook"); if(c) c.addEventListener('click',cStartCook); })();
(()=>{ const c=$("#cPathProj"); if(c) c.addEventListener('click',()=>{ if(typeof openProjectPicker==='function') openProjectPicker(); else cNavGo('projects'); }); })();
document.querySelectorAll('[data-mfn="__more"]').forEach(b=>b.addEventListener('click',openMoreSheet));
(()=>{ const n=$("#cEvNew"); if(n) n.addEventListener('click',cStartNewEvent); })();
(()=>{ const a=$("#cEvAiPlan"); if(a) a.addEventListener('click',openEventPlanner); })();
// ── one-time migration: old global seas:<recipeKey> → context-scoped seas:cook:<recipeKey> ──
(function migrateSeasContext(){
  try{
    if(store.get('mk-seas-migrated')) return;
    const moves=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && /^seas:(cut-|spec-|make-)/.test(k)) moves.push(k);
    }
    moves.forEach(k=>{
      const rest=k.slice(5);              // after "seas:"
      const nk='seas:cook:'+rest;
      if(localStorage.getItem(nk)===null){ localStorage.setItem(nk, localStorage.getItem(k)); }
      localStorage.removeItem(k);
    });
    store.set('mk-seas-migrated',1);
  }catch(e){ /* non-fatal */ }
})();
try{ cRefreshHome(); cNavGo('home'); }catch(e){ /* headless/init guard */ }
try{ setTimeout(()=>{ if(typeof maybeAskUiLevel==='function') maybeAskUiLevel(); }, 400); }catch(e){}
</script>
</body>
</html>"""

html = HTML.replace("__DATA__", DATA_JSON)
import os as _os, shutil as _shutil
_root = _os.path.dirname(_os.path.abspath(__file__))
# 1) index.html at repo root — used by the dev server, tests, and manual upload
with open(_os.path.join(_root, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)
# 2) dist/ — the ONLY thing Cloudflare Pages serves: index.html + flattened site assets
#    (index.html references manifest/icons at the root level, so site/ is flattened here,
#    and no .py source is exposed). Cloudflare Pages: build `python build.py`, output dir `dist`.
_dist = _os.path.join(_root, "dist")
_os.makedirs(_dist, exist_ok=True)
with open(_os.path.join(_dist, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)
_site = _os.path.join(_root, "site")
_copied = []
if _os.path.isdir(_site):
    for _n in sorted(_os.listdir(_site)):
        if _n.lower() in ("readme.txt", "index.html"):   # notes / stale copy — never clobber the fresh build
            continue
        _src = _os.path.join(_site, _n)
        if _os.path.isfile(_src):
            _shutil.copy2(_src, _os.path.join(_dist, _n)); _copied.append(_n)
print("written", len(html), "bytes;", len(CUTS), "cuts", len(SPECIALS), "specials", len(GLOSSARY), "glossary")
print("dist/ ->", ["index.html"] + _copied)
