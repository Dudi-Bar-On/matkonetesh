# Translations — one JSON file per language

Adding a language is meant to be a breeze: **copy `en.json`, rename it to the new
language code (e.g. `it.json`), and translate the values.** `build.py` picks up every
`lang/*.json` automatically and inlines them; the language then appears in the
Appearance → 🌐 Language switcher.

Hebrew (`he`) is the **source** — it is not a file here; every key below is a Hebrew
string as it appears in the UI, and the value is its translation.

## File shape

```jsonc
{
  "__meta__":  { "name": "English", "dir": "ltr" },   // display name + text direction (ltr/rtl)
  "__units__": { "פריטים": "items", "שעות": "hours" }, // number+unit: "53 פריטים" → "53 items"
  "__pre__":   { "שלב": "Step" },                      // word+number: "שלב 2/5" → "Step 2/5"
  "__html__":  { "home.what": "What's <b>cooking</b> today?" }, // for the few [data-i18n-html] bits
  "בקר": "Beef",                                       // ← the rest: exact UI strings, he → target
  "עוף": "Chicken"
}
```

## How it works

- `tnode()` walks the DOM after every render and replaces any text node / placeholder /
  aria-label / title whose (trimmed) value is a key here — including emoji-prefixed chips
  (`🥩 בקר` → `🥩 Beef`) and `__units__`/`__pre__` number patterns.
- Item **names** come from each recipe's own `eng` field (no dictionary needed).
- Recipe **prose** (descriptions, steps) is machine-translated at runtime via `mtTranslate`,
  gated by the numeric-safety guard (`mtSafe`) so a temperature/cure number can never change.

Coverage doesn't have to be 100% to ship a language — untranslated keys simply stay Hebrew.
