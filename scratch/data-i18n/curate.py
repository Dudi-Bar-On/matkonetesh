# P1 (v268.1) — populate en.json with the DATA-value English so the pipeline can translate them,
# and itemName()/t() stop falling back. Three buckets:
#   names  -> en.json.__names__  (heb -> author's eng; consumed by itemName(getDict().__names__[heb]))
#   cats   -> en.json[heb]=eng   (t(c.cat))   — curated
#   woods  -> en.json[heb]=eng   (t(s.wood))  — token-split + curated
#   origins-> en.json[heb]=eng   (t(s.origin))— flag + curated country
# Reports any Hebrew token with no curated English so nothing is machine-guessed silently.
import json, os, sys, re
os.environ["PYTHONIOENCODING"] = "utf-8"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import data as D
from seasonings import SEASONINGS as _SA
from seasonings_ext import SEASONINGS_EXT as _SB

def entries(x): return list(x.values()) if isinstance(x, dict) else list(x)
RECIPES = [e for n in ("CUTS", "SPECIALS", "MAKES") for e in entries(getattr(D, n, [])) if isinstance(e, dict)]
SEAS = list(_SA) + list(_SB)

# ── names: heb -> eng (author-provided) ──
names = {}
for e in RECIPES + SEAS:
    h, en = e.get("heb"), e.get("eng")
    if h and en and h != en:
        names[h] = en

# ── categories (curated) ──
CAT_EN = {
    "בקר": "Beef", "טלה": "Lamb", "חזיר": "Pork", "עוף": "Chicken", "הודו": "Turkey",
    "ברווז": "Duck", "אווז": "Goose", "דג": "Fish", "פירות ים": "Seafood",
    "איברים פנימיים": "Offal", "ירקות": "Vegetables", "פירות": "Fruit", "גבינה": "Cheese",
    "בשר מיובש": "Dried meat", "בייקון": "Bacon", "נקניק מיובש": "Dry sausage",
    "נקניק מעושן": "Smoked sausage", "נקניקיות": "Sausages", "סלומי": "Salumi",
    "פסטרמה": "Pastrami", "שווארמה": "Shawarma", "דג מעושן": "Smoked fish",
    "צלייה טחונה": "Ground roast", "BBQ קלאסי": "Classic BBQ",
}
# ── wood tokens (curated); compounds are split on '/' ──
WOOD_TOK = {
    "אלון": "Oak", "בכר": "Beech", "גפן": "Grapevine", "דובדבן": "Cherry", "היקורי": "Hickory",
    "מזקיט": "Mesquite", "פקאן": "Pecan", "תפוח": "Apple", "מייפל": "Maple", "שזיף": "Plum",
    "אגוז": "Walnut", "אגוזי-לוז": "Hazelnut", "קליפות אגוזי-לוז": "Hazelnut shells",
    "פחם": "Charcoal", "גריל": "Grill", "ללא": "None",
}
def wood_en(h, unmapped):
    def tok(t):
        t = t.strip()
        # space-suffixed modifiers: "דובדבן נקי" / "אלון בלבד"
        for mod, en in (("נקי", "only"), ("בלבד", "only")):
            if t.endswith(" " + mod):
                base = t[: -len(mod)].strip()
                b = WOOD_TOK.get(base)
                if b is None: unmapped.add(base)
                return f"{b or base} {en}"
        e = WOOD_TOK.get(t)
        if e is None: unmapped.add(t)
        return e or t
    return "/".join(tok(p) for p in h.split("/"))

# ── origins: "🇦🇷 ארגנטינה" -> "🇦🇷 Argentina"; countries curated, compounds split on '/' ──
COUNTRY_EN = {
    "ארגנטינה": "Argentina", "ברזיל": "Brazil", "קנדה": "Canada", "מודרני": "Modern",
    "שוויץ": "Switzerland", "צרפת": "France", "צ'ילה": "Chile", "סין": "China",
    "סצ'ואן": "Sichuan", "שינג'יאנג": "Xinjiang", "קנטון": "Canton", "קאריביים": "Caribbean",
    "קובה": "Cuba", "גרמניה": "Germany", "מצרים": "Egypt", "האיים הקנריים": "Canary Islands",
    "ספרד": "Spain", "פרובנס": "Provence", "קטלוניה": "Catalonia", "אתיופיה": "Ethiopia",
    "חבל הבאסקים": "Basque Country", "בריטניה": "Britain", "אבחזיה": "Abkhazia",
    "גיאורגיה": "Georgia", "גאורגיה": "Georgia", "יוון": "Greece", "הונג קונג": "Hong Kong",
    "הונגריה": "Hungary", "אינדונזיה": "Indonesia", "תאילנד": "Thailand", "ישראל": "Israel",
    "לבנט": "Levant", "בנגל": "Bengal", "הודו": "India", "צפון הודו": "North India",
    "עירק": "Iraq", "פרס": "Persia", "איטליה": "Italy", "אירופה": "Europe", "מילאנו": "Milan",
    "סיציליה": "Sicily", "פיימונטה": "Piedmont", "קרמונה": "Cremona", "ג'מייקה": "Jamaica",
    "ג׳מייקה": "Jamaica", "יפן": "Japan", "קוריאה": "Korea", "לבנון": "Lebanon", "לוב": "Libya",
    "מרוקו": "Morocco", "בורמה": "Burma", "טקס-מקס": "Tex-Mex", "יוקטן": "Yucatán",
    "מקסיקו": "Mexico", "מוזמביק": "Mozambique", "פורטוגל": "Portugal", "ניגריה": "Nigeria",
    "פרו": "Peru", "דרו״א": "South America", "פיליפינים": "Philippines",
    "פורטו ריקו": "Puerto Rico", "אפריקה": "Africa", "בלקן": "Balkans",
    "סקנדינביה": "Scandinavia", "סנגל": "Senegal", "סוריה": "Syria", "איסאן": "Isaan",
    "דרום-מזרח אסיה": "Southeast Asia", "תוניסיה": "Tunisia", "טורקיה": "Turkey",
    "אלבמה": "Alabama", "ארה״ב": "USA", "ג'ורג'יה": "Georgia (US)", 'דרום ארה"ב': "Southern US",
    "דרום ארה״ב": "Southern US", "דרום קרוליינה": "South Carolina", "דרום-מערב": "Southwest",
    "הוואי": "Hawaii", "טנסי": "Tennessee", "טקסס": "Texas", "לואיזיאנה": "Louisiana",
    "מזרח קרוליינה": "East Carolina", "מיזורי": "Missouri", "מיסיסיפי": "Mississippi",
    "ממפיס": "Memphis", "מרילנד": "Maryland", "מרכז קרוליינה": "Central Carolina",
    "ניו יורק": "New York", "ניו-אורלינס": "New Orleans", "ניו-יורק": "New York",
    "סנט לואיס": "St. Louis", "צפון קרוליינה": "North Carolina", "ק. קרוליינה": "Carolina",
    "קלאסי": "Classic", "קליפורניה": "California", "קנזס סיטי": "Kansas City",
    "קנטקי": "Kentucky", "ונצואלה": "Venezuela", "וייטנאם": "Vietnam", "תימן": "Yemen",
    "דרום אפריקה": "South Africa", 'מזה״ת': "Middle East", "מזרח אירופה": "Eastern Europe",
    "פאן-אסייתי": "Pan-Asian", "פיוז׳ן": "Fusion", "בסיסי": "Basic",
}
HEB = re.compile(r"[֐-׿]")
def origin_en(h, unmapped):
    # leading flag/emoji/space prefix (everything up to the first Hebrew letter) is preserved verbatim
    m = HEB.search(h)
    if not m:
        return h  # pure flags, no Hebrew (e.g. "🇺🇸/🇲🇽")
    prefix, text = h[: m.start()], h[m.start():]
    def tok(t):
        t = t.strip()
        e = COUNTRY_EN.get(t)
        if e is None: unmapped.add(t)
        return e or t
    return prefix + "/".join(tok(p) for p in text.split("/"))

# ── enumerate the DATA values actually rendered ──
cats = sorted({str(e["cat"]) for e in RECIPES if e.get("cat")})
woods = sorted({str(e["wood"]) for e in RECIPES if e.get("wood")})
origins = sorted({str(s["origin"]) for s in SEAS if s.get("origin")})

unmapped_w, unmapped_o, unmapped_c = set(), set(), set()
chrome_add = {}
for c in cats:
    e = CAT_EN.get(c)
    if e is None: unmapped_c.add(c)
    else: chrome_add[c] = e
for w in woods:
    chrome_add[w] = wood_en(w, unmapped_w)
for o in origins:
    chrome_add[o] = origin_en(o, unmapped_o)

print("names:", len(names), "| cats:", len(cats), "| woods:", len(woods), "| origins:", len(origins))
if unmapped_c: print("UNMAPPED CATEGORIES:", sorted(unmapped_c))
if unmapped_w: print("UNMAPPED WOOD TOKENS:", sorted(unmapped_w))
if unmapped_o: print("UNMAPPED ORIGIN TOKENS:", sorted(unmapped_o))

if "--write" in sys.argv and not (unmapped_c or unmapped_w or unmapped_o):
    p = os.path.join(ROOT, "lang", "en.json")
    en = json.load(open(p, encoding="utf-8"))
    en.setdefault("__names__", {})
    an = 0
    for h, e in names.items():
        if h not in en["__names__"]:
            en["__names__"][h] = e; an += 1
    ac = 0
    for h, e in chrome_add.items():
        if en.get(h) != e and h not in en.get("__names__", {}):
            en[h] = e; ac += 1
    open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(en, ensure_ascii=False, indent=1) + "\n")
    print(f"WROTE en.json: +{an} names, +{ac} chrome (cat/wood/origin)")
elif "--write" in sys.argv:
    print("NOT WRITING — resolve unmapped tokens first.")
