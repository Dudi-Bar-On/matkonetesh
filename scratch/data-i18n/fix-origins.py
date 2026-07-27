# §10.19 repair: translategemma drops or CHANGES the flag emoji on origin values
# (fr "🇦🇷 Argentina"→"Argentine" flagless; de "🇺🇸 Texas"→"🇩🇪 Texas" wrong flag).
# The flag is authoritative in the KEY. Deterministically force value = <key's flag> + <translated country>.
import json, os, re, sys
os.environ["PYTHONIOENCODING"] = "utf-8"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from seasonings import SEASONINGS as _A
from seasonings_ext import SEASONINGS_EXT as _B
ORIGINS = sorted({str(s["origin"]) for s in (list(_A) + list(_B)) if s.get("origin")})

HEB = re.compile(r"[֐-׿]")
# leading run of emoji / flags / ZWJ / variation-selectors / whitespace / slashes-between-flags
LEAD_EMOJI = re.compile(r"^[\s‍️/\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]+")

def repair(lang):
    p = os.path.join(ROOT, "lang", f"{lang}.json")
    d = json.load(open(p, encoding="utf-8"))
    fixed = 0
    for o in ORIGINS:
        if o not in d:
            continue
        m = HEB.search(o)
        if not m:
            continue  # pure-flag key (🇺🇸/🇲🇽) — no country text, leave as-is
        key_flag = o[: m.start()].strip()
        val = str(d[o])
        country = LEAD_EMOJI.sub("", val).strip()  # strip whatever flag the model produced
        want = (key_flag + " " + country).strip() if key_flag else country
        if d[o] != want:
            d[o] = want; fixed += 1
    open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print(f"[fix-origins] {lang}: {fixed} origin flags repaired ({len(ORIGINS)} origin keys)")

for lang in (sys.argv[1:] or ["fr", "de", "es", "it"]):
    repair(lang)
