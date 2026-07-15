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
<meta name="theme-color" content="#fdf6ec">
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
<style>__CSS__</style>
</head>
<body class="capp">
<a href="#mainContent" class="skip-link">דלג לתוכן</a>
<div class="glow"></div>

<!-- ═══ HOME ═══ -->
<div class="screen on" id="scr-home">
  <div class="capp-top capp-top-home">
    <button class="capp-langpill" id="cHomeLang" aria-label="Language"><span class="clp-flag" id="cHomeLangFlag">🌐</span><span class="clp-name" id="cHomeLangName">Language</span><span class="clp-caret">▾</span></button>
    <button class="capp-ico capp-more-corner" id="cHomeMore" aria-label="More">☰</button>
    <div class="chome-title">
      <div class="chome-kick" id="cHomeKick">סו-ויד · עישון · גריל · אש</div>
      <h1 class="chome-h1"><span class="brand-flame">🔥</span> מתכונת · מדריך האש</h1>
    </div>
  </div>
  <div class="chome-search" id="cHomeSearch"><span class="ic">⌕</span><input id="cHomeSearchInput" data-i18n-ph="search.ph" placeholder="חפש הכל — נתח, נקניקייה, מתבל…" autocomplete="off"></div>
  <button class="chome-gearchip" id="cHomeGearChip" hidden></button>
  <button class="chome-mev" id="cHomeMultiEv" hidden></button>
  <div class="chome-hero"><div class="hi" id="cGreet">ברוך הבא 👋</div><h2 data-i18n-html="home.what">מה <b>מדליקים</b> היום?</h2></div>
  <div id="cGearBanner"></div>
  <div class="chome-modules" id="cHomeModules">
    <div class="chome-lanes" id="cHomeLanes"></div>
    <div class="chome-askwrap" id="cHomeAskWrap">
      <button class="chome-ask" id="cHomeAsk"><span class="cha-ico">🔥</span><span class="cha-txt"><b data-i18n="home.ask">שאל את האש</b><small>עוזר בישול חכם — זמן, טמפ׳, עץ, כמות, כשרות, ואיפה לקנות</small></span><span class="cha-go">←</span></button>
      <button class="chome-aimore" id="cHomeAiMore">✨ עוד כלי AI</button>
    </div>
    <div class="cpaths" id="cHomePaths">
      <div class="cpath event" data-cgo="wizard"><span class="ptag">🌿 הכי פופולרי</span><span class="pico">🎉</span><h3 data-i18n="path.hosting">מארח? תכנן את האירוע</h3><p>אשף מודרך שבונה תפריט, רשימת קניות ותוכנית עבודה — לפי מספר הסועדים והטעמים.</p><button class="cpath-branch" id="cPathCook">↳ או פשוט בשל כמה מנות (בלי אירוע)</button></div>
      <div class="cpath project" id="cPathProj"><span class="pico">🧪</span><h3 data-i18n="path.project">פרויקט מתקדם</h3><p>שרקוטרי, נקניקים ועישון ארוך — בחירה מקוטלגת לפי סוג ומדינה, עם תיאור מלא לכל מלאכה וליווי צעד-אחר-צעד.</p><span class="go">←</span></div>
    </div>
    <div class="chome-dock" id="cHomeDock" hidden></div>
  </div>
  <div class="cnext cnext-live" id="cCooking" hidden><span class="nico">🔥</span><div style="flex:1"><div class="nt">בישול פעיל עכשיו</div><div class="nm" id="cCookingM"></div></div><button class="cnext-x" id="cCookingX" aria-label="עצור בישול פעיל">✕</button><span class="ng">←</span></div>
  <div class="cnext" id="cResume" hidden><span class="nico">📋</span><div style="flex:1"><div class="nt">המשך מהמקום שעצרת</div><div class="nm" id="cResumeM"></div></div><button class="cnext-x" id="cResumeX" aria-label="בטל טיוטה">✕</button><span class="ng">←</span></div>
  <div class="cnext" id="cResumeProj" hidden><span class="nico">🧫</span><div style="flex:1"><div class="nt">המשך פרויקט</div><div class="nm" id="cResumeProjM"></div></div><button class="cnext-x" id="cResumeProjX" aria-label="הסתר">✕</button><span class="ng">←</span></div>
  <button class="chome-about" id="cHomeAbout"><span data-i18n="home.how">❓ איך משתמשים באפליקציה</span><span class="cha-sub">מסלולים, כלים וכל היכולות</span></button>
</div>

<!-- ═══ WIZARD (full 6-step) ═══ -->
<div class="screen" id="scr-wizard">
  <div class="cshead"><button class="back" id="cwBack" aria-label="חזרה">→</button><h2 id="cwTitle">אשף האירוע</h2><span class="step" id="cwLbl">שלב 1/6</span><button class="cwexit" id="cwExit" aria-label="יציאה מהאשף">✕</button></div>
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
    <button class="ccta" data-cwgo="1" data-i18n="wiz.next.dishes">המשך לבחירת מנות ←</button>
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
    <button class="ccta" data-cwgo="2" data-i18n="wiz.next.methods">המשך לשיטות ←</button>
  </div>

  <!-- step 2: real method toggles per item -->
  <div class="cwstep" data-cwstep="2">
    <div class="cwq">שיטות בישול</div><div class="cwsub">לכל פריט — בחר שיטה (סו-ויד / עישון / גריל). נשמר במנוע האמיתי.</div>
    <div id="cwMethodsFull"></div>
    <button class="ccta" data-cwgo="3" data-i18n="wiz.next.seas">המשך למתבלים ←</button>
  </div>

  <!-- step 3: seasonings per item -->
  <div class="cwstep" data-cwstep="3">
    <div class="cwq">מתבלים ורטבים</div><div class="cwsub">בחר תיבול לכל פריט — יוזרק אוטומטית לשלבי הבישול.</div>
    <div id="cwSeasFull"></div>
    <button class="ccta" data-cwgo="4" data-i18n="wiz.next.extras">המשך לתוספות וקינוחים ←</button>
  </div>

  <!-- step 4: sides + drinks -->
  <div class="cwstep" data-cwstep="4">
    <div class="cwq">תוספות, שתייה וקינוחים</div><div class="cwsub">מותאם למנות ולעונה. הקינוחים כוללים פירות טריים לפי תאריך האירוע.</div>
    <div class="cscard"><h4>🥗 תוספות</h4><div id="cwSides" class="cmethods" style="flex-direction:column;align-items:stretch;gap:8px"></div></div>
    <div class="cscard"><h4>🥤 שתייה</h4><div id="cwDrinks" class="cmethods" style="flex-direction:column;align-items:stretch;gap:8px"></div></div>
    <div class="cscard"><h4>🍮 קינוחים</h4><div id="cwDesserts" class="cmethods" style="flex-wrap:wrap"></div></div>
    <button class="ccta" data-cwgo="5" data-i18n="wiz.next.review">סקירה ותוכנית ←</button>
  </div>

  <!-- step 5: review + serve time + generate real plan -->
  <div class="cwstep" data-cwstep="5">
    <div class="cwq">סקירה ותוכנית עבודה</div><div class="cwsub">הכל מוכן — צור תוכנית עבודה כרונולוגית מלאה.</div>
    <div class="cscard"><h4>⏰ שעת הגשה</h4>
      <input id="cwServe" type="time" value="19:00" style="width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:16px">
    </div>
    <div id="cwReview"></div>
    <button class="ccta" id="cwGenPlan" data-i18n="wiz.genplan">📋 צור תוכנית עבודה מלאה</button>
    <div class="cw5-more">
      <button id="cwSaveEvent" data-i18n="wiz.saveevent">💾 שמור אירוע</button>
      <button id="cwVoice" data-i18n="wiz.voice">🎙️ מצב בישול קולי</button>
      <button data-cgo="events" data-i18n="wiz.toevents">סיום · לרשימת האירועים</button>
    </div>
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

<main id="mainContent" tabindex="-1">
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

<!-- retired UI kept hidden: still wired unconditionally in app.js (themeBtn/favBtn/favN/cartN…) — do not remove without also removing their JS handlers -->
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

<!-- floating "Active now" shortcut — shows on any screen while something is cooking -->
<button class="cactive-fab" id="cActiveFab" aria-label="פעיל עכשיו" hidden><span class="caf-ic">🔥</span><span class="caf-t" id="cActiveFabT">פעיל עכשיו</span></button>
<!-- ═══ bottom nav ═══ -->
<div class="cnav">
  <button class="on" data-cnav="home"><span class="ni">🏠</span>בית</button>
  <button data-cnav="catalog"><span class="ni">📚</span>קטלוג</button>
  <button class="fab" data-cnav="wizard"><span class="ni">🎉</span></button>
  <button data-cnav="events"><span class="ni">📋</span>אירועים</button>
  <button data-cnav="projects"><span class="ni">🧫</span>פרויקטים</button>
</div>

<footer>
  <div class="footnote">מתכונת · מדריך האש — נבנה מהטבלאות של דודי. הנתונים מקומיים, ללא חיבור לרשת. סימוני ה-checklist נשמרים בדפדפן.<br><b class="foot-stamp" style="color:var(--ember2)">מהדורה 226 · 14.7.26</b></div>
</footer>

<div class="scrim" id="scrim"></div>
<aside class="panel" id="panel" aria-hidden="true" role="dialog" aria-modal="true" aria-label="פרטי מתכון" tabindex="-1"></aside>

<script>__JS__</script>
</body>
</html>"""

# perf #2: emit `const DATA = JSON.parse('…')` — a JSON string parses ~1.5-2x faster than an
# equivalent 888KB JS object literal on the main thread. Wrap in SINGLE quotes so the JSON's own
# double-quotes need no escaping (double-quote wrapping would ~2x the raw file size).
def _js_str(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r").replace(" ", "\\u2028").replace(" ", "\\u2029") + "'"
import os as _os, glob as _glob
with open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "app.css"), encoding="utf-8") as _f: _css = _f.read()
with open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "app.js"), encoding="utf-8") as _f: _js = _f.read()
# i18n: one JSON dictionary file per language under lang/ → const I18N_DICTS = {en:{…}, fr:{…}, …}
_i18n = {}
_i18n_data = {}   # <code>.data.json = bulk prose (item descriptions) merged into <code>
for _lf in sorted(_glob.glob(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "lang", "*.json"))):
    _bn = _os.path.basename(_lf)
    if _bn.endswith(".data.json"):
        _i18n_data.setdefault(_bn[:-len(".data.json")], []).append(_lf); continue
    _code = _os.path.splitext(_bn)[0]
    with open(_lf, encoding="utf-8") as _f:
        _i18n[_code] = json.load(_f)
for _code, _dfs in _i18n_data.items():
    if _code in _i18n:
        for _df in _dfs:
            with open(_df, encoding="utf-8") as _f:
                _i18n[_code].update(json.load(_f))
I18N_DICTS_JSON = json.dumps(_i18n, ensure_ascii=False)
html = HTML.replace("__CSS__", _css).replace("__JS__", _js).replace("__DATA__", "JSON.parse(" + _js_str(DATA_JSON) + ")").replace("__I18N_DICTS__", "JSON.parse(" + _js_str(I18N_DICTS_JSON) + ")")
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
# service worker (T4): precache the shell so the app works offline (phone-by-the-smoker).
# cache name keyed on a content hash so every build invalidates cleanly.
import hashlib as _hashlib
_ver = _hashlib.md5(html.encode("utf-8")).hexdigest()[:8]
_sw = """const CACHE='mk-%s';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',function(e){ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL).catch(function(){});})); });
self.addEventListener('activate',function(e){ e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();})); });
self.addEventListener('fetch',function(e){
  var req=e.request; if(req.method!=='GET') return;
  var url; try{ url=new URL(req.url); }catch(_){ return; }
  if(url.origin!==location.origin) return;                 // leave cross-origin (fonts/AI) alone
  if(req.mode==='navigate' || url.pathname==='/' || url.pathname.slice(-11)==='/index.html'){
    e.respondWith(fetch(req).then(function(r){ var cp=r.clone(); caches.open(CACHE).then(function(c){c.put(req,cp);}); return r; }).catch(function(){ return caches.match(req).then(function(m){return m||caches.match('index.html');}); }));
  } else {
    e.respondWith(caches.match(req).then(function(m){ return m||fetch(req).then(function(r){ var cp=r.clone(); caches.open(CACHE).then(function(c){c.put(req,cp);}); return r; }); }));
  }
});
// Wave A: background-resilient alarms. The page shows notifications via registration.showNotification
// (works on Android where new Notification() is a no-op); the page can also post {type:'notify'} as a
// fallback path, and a tap focuses/opens the app instead of spawning a new tab.
self.addEventListener('message',function(e){ var d=e.data||{}; if(d && d.type==='notify'){ e.waitUntil(self.registration.showNotification(d.title||'\\u23f1 \\u05d8\\u05d9\\u05d9\\u05de\\u05e8', {body:d.body||'', icon:'icon-192.png', badge:'icon-192.png', tag:d.tag||'mk-timer', renotify:true, requireInteraction:true, vibrate:[200,100,200,100,200]})); } });
self.addEventListener('notificationclick',function(e){ e.notification.close(); e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cs){ for(var i=0;i<cs.length;i++){ if('focus' in cs[i]) return cs[i].focus(); } if(self.clients.openWindow) return self.clients.openWindow('./'); })); });
""" % _ver
with open(_os.path.join(_dist, "sw.js"), "w", encoding="utf-8") as f:
    f.write(_sw)
# _headers (PWA #5 / perf #8): revalidate the single HTML + manifest + sw; long-cache immutable icons.
with open(_os.path.join(_dist, "_headers"), "w", encoding="utf-8") as f:
    f.write("/index.html\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Cache-Control: no-cache\n/sw.js\n  Cache-Control: no-cache\n/*.png\n  Cache-Control: public, max-age=31536000, immutable\n")
print("written", len(html), "bytes;", len(CUTS), "cuts", len(SPECIALS), "specials", len(GLOSSARY), "glossary")
print("dist/ ->", ["index.html"] + _copied)
