# Equipment 2.0 — Gap Report vs. Final Mockup (`mockups/equipment-hybrid.html`)

**Date:** 2026-07-15 · **Shipped:** v234 · **Method:** Playwright/Chrome real-render of the live app (`dist/index.html`, EN, phone width 430px) vs. the approved hybrid mockup.
**Screenshots:** `mockups/current-list-en.png`, `current-form-en.png`, `current-empty-en.png`, `target-mockup-all.png`.

Two independent problems: **(A) the AI web-lookup is broken (always 400s)** and **(B) the UI is well short of the approved mockup — the Add flow especially.**

---

## A. AI web-search always fails — ROOT CAUSE FOUND

`aiLookupDevice()` and `aiBrandModels()` are the only callers that pass `search:true` to `aiJSON()`. In `aiJSON()` the request body sets **both**:

```js
tools: [{google_search:{}}],                                  // grounding
generationConfig:{ ..., responseMimeType:'application/json' }  // JSON mode
```

Gemini 2.5 (`gemini-2.5-flash`, the model in use) **rejects that exact combination with HTTP 400** — Google Search grounding cannot be combined with `responseMimeType:'application/json'`. So every equipment lookup 400s → the form shows *"Lookup failed — fill manually."* The key is valid; the request is malformed.

**Fix:** when `search:true`, drop `responseMimeType` and let the model return grounded text; recover the JSON with the existing `aiStripFences()` (the `AI_JSON_SYS` prompt already says "return ONLY valid JSON"). Raise `maxTokens` for lookups (grounded replies are longer). This turns on real Google-grounded spec lookup from manufacturer/retailer pages — exactly the "search the equipment's website" behaviour requested. `search:false` callers are unaffected (they keep JSON mode).

---

## B. Design parity, panel by panel

### Panel 1 — Main / device list  ·  ~70% there
Reasonably close (capabilities banner, concierge card, spine cards, chips, edit/remove, "Add another" all present), but:

| Gap | Mockup | Shipped |
|---|---|---|
| Header | `SETTINGS · 🧰 My Equipment · 5 devices · 3 categories` + inline gradient **Add ＋** | generic `TOOLS · My equipment` + stray **PDF** button + clipped ✕; no counts |
| Tile icons | crisp **per-sub-type** emoji (🛢️ WSM, 📦 offset, 🌀 Joule, 📡 MEATER, 🌡️ Inkbird) | one **washed-out category** icon (💨) for every device — pale, low-contrast |
| Chips | emoji on **both** (🪵 Wood, ⚫ Charcoal, 🗄️ 2 racks) | fuel chip has **no** emoji; label reads "racks/grates" |
| Capabilities | "no" state hints **"· add a grill"**; foot "**2 probes ·** 8 channels" | plain "Grill"; foot only "8 probe channels" |

### Panel 2 — Add a device  ·  ~25% there ⟵ the big one
The mockup's centrepiece is a **lookup → verify-card → catalogue → manual** sheet. Shipped is a flat CRUD form (Category / Sub-type / Name / two buttons / one number field / Add).

| Mockup feature | Shipped |
|---|---|
| Sheet chrome: grab handle, close ✕, tile+title header | none (plain form) |
| "**Tell me the model — I'll pull the specs**" lookup-first framing | none |
| **✨ "Here's what I found — verify & save" card** with Name / Sub-type / Racks / Cooking-area / Fuel, all ✨-marked, green-tinted, "nothing saved yet" source note, **Looks right — save** + **↺ Redo** | **absent entirely** — the AI result is a one-line note + it fills a single racks field |
| Catalogue cards with spec line ("Pro 575 · Pellet · 2 racks · 575 in² · WiFIRE") + ✓/＋ + tile | bare model-name cards, no specs, no state |
| **"No connection or custom rig?"** miniform | none |

### Panel 3 — Empty / first-run  ·  ~85% there
Closest to target. Remaining nits: "**your kit**" not emphasized in ember; the ✨ spark background is too faint. (The dynamic missing-category chips are intentional and approved.)

### Cross-cutting
- All three views wear the generic **tool header** (`TOOLS` / PDF / ✕) instead of the mockup's Settings/My-Equipment header. Needs a dedicated equipment header with device+category counts and an inline Add.
- **Data model** must gain per-sub-type icon/colour and a `cap.area` (cooking area) field so the verify card and chips can show what the mockup shows. Fuel is already stored but under-shown.

---

## C. Plan to reach 100% parity (pending approval)

1. **Fix AI grounding** (§A) — drop JSON-mime when `search:true`, parse via `aiStripFences`, bump tokens; verify a real lookup returns specs. *(unblocks everything visual in the Add flow)*
2. **Enrich the spec lookup** — have `aiLookupDevice` also return sub-type, cooking-area, and a confidence/source note, normalized.
3. **Rebuild Panel 2 (Add)** as the mockup sheet: lookup-first input → **verify card** (Name/Sub-type/Racks/Area/Fuel, ✨, green, "nothing saved yet", Save/Redo) → **catalogue** cards with spec lines → **miniform** manual fallback.
4. **Polish Panel 1 (list)** — per-sub-type tile icons+colour, dedicated header with counts + inline Add, fuel-emoji chips, capability hints.
5. **Polish Panel 3 (empty)** — ember emphasis + spark.
6. **Data-model additions** — sub-type icon/colour map, `cap.area`.
7. **Discipline:** verify HE **and** EN via real render; Playwright suite green ×2; `node --check` clean; ship as vNNN. No backward-compat left behind.
