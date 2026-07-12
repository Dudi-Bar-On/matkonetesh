# Source-verification research protocol (for research agents)

You verify fire-cooking time/temperature data for specific catalog items against the best
primary sources, and return STRUCTURED JSON proposals. You do NOT edit any files. The
orchestrator applies and re-verifies your proposals. Accuracy and citation honesty matter
more than speed — this feeds a live cooking app where wrong safety numbers are dangerous.

## Canonical sources (in authority order)
- **Sous-vide temp/time & pasteurization/safety:** Douglas Baldwin — https://douglasbaldwin.com/sous-vide.html
  (backbone already digested in `docs/sources/baldwin-backbone.md` — READ IT FIRST). Then ChefSteps,
  Serious Eats / Kenji, Anova/Joule guides.
- **Smoking & grilling (chamber temp, internal target, wood, technique):** AmazingRibs.com (Meathead) is
  primary. Then Serious Eats BBQ / Aaron Franklin (brisket, ribs), Steven Raichlen.
- **Seafood/fish:** ChefSteps + Serious Eats seafood (40–52°C by texture); Baldwin for shellfish pasteurization.
- **Vegetables/fruit:** ChefSteps / Serious Eats produce (83–85°C pectin); Meathead for grilling.

Prefer PRIMARY sources. If two disagree, cite both and choose the safety-conservative value.
Never use random forums/blogs for a safety value.

## P3 — safety numbers are never guessed
`safe` (pasteurization/safety floor), pasteurization times, and cure numbers must come from a cited
primary source. If you cannot find one, set that sub-key's `ref` to `"UNVERIFIED"` and DO NOT propose
a changed value — keep the existing one. Be especially careful with poultry (salmonella), ground meat,
seafood, and any "smoke→sous-vide" order (meat sits in the danger zone before pasteurizing).

## `safe` field POLICY (decided — do not deviate)
`safe` is the **displayed, path-agnostic safety floor** shown to the user. It must stay the
CONSERVATIVE instant-safe number because the app also has a grill/smoke-only path with no long hold:
- Whole-muscle beef/pork/lamb: **63°C** (145°F USDA whole-muscle). Do NOT lower to 54.4.
- Ground meat: **71°C** (160°F). NEVER lower.
- Poultry: **74°C** (165°F). NEVER lower.
- Fish/seafood: per source (often no pasteurization floor; document).
- Produce: **0** (no safety floor).
Put the sous-vide time-pasteurization nuance (e.g. "pasteurizes at 54.4°C with ≥Xh hold per Baldwin")
in the `safe.note`, NOT in a lowered value. So `safe.changed` should almost always be false; you are
DOCUMENTING the existing floor with a citation, not moving it. (A medium-rare whole-muscle steak with
`tgt` below `safe` is expected and correct — interior sterile, surface seared.)

## Field meanings (data.py)
- `svt` sous-vide bath °C (= desired core). `svh` sous-vide hours (string; range ok e.g. "24-36").
- `smt` smoke temp °C in the sous-vide→smoke combo (hot finish, short). `smh` smoke hours there.
- `tgt` final internal target °C. `safe` safety/pasteurization floor °C (0 allowed for produce).
- `sot`/`soh` smoke-ONLY temp/hours (no sous-vide path). `wood` wood recommendation (keep Hebrew).

## Order effect (verify individually — the two orders differ materially)
- **Order A sv→smoke** (default, safe): full sous-vide cook+pasteurize, brief dry, then HOT smoke
  (100–135°C, short) for flavor/crust. No smoke ring (meat already >60°C).
- **Order B smoke→sv** (advanced): cool/warm smoke on RAW meat at LOW temp (often 50–80°C) for smoke
  ring, THEN sous-vide to full pasteurization by thickness (Baldwin). Only propose Order B for an item
  if you find real, safe pasteurization data; it MUST set `sv.pasteurize=true` with a citation.

## Grill (REQUIRED for every item)
Add a `grill` object giving direct-fire numbers, cited (AmazingRibs/Meathead grilling + two-zone/reverse-sear,
Serious Eats/Kenji, Raichlen). Fields:
- `grt` = grill temperature °C (the grate/dome temp of the hot/sear zone; direct high-heat steaks ~250–290°C).
- `grh` = active grill time (string hours, e.g. "0.15" for a quick sear).
- `grz` = zone technique in Hebrew: `"ישיר"` (direct), `"דו-אזורי"` (two-zone), or `"עקיף→ישיר"` (reverse-sear).
- `grillable` = boolean. Set **false** for long-cook collagen cuts that should NOT be direct-grilled
  (brisket, whole shoulder, shank, oxtail, etc.); then leave grt/grh null and explain in `note`. Do NOT
  invent a grill temp for something that isn't grilled.
- grill internal target = the item's existing `tgt` (don't add a separate field).
- `ref`/`url`/`note` = citation + exact figures (grate temp, sear time per side, internal pull temp).

## Output — return ONLY a JSON array, one object per item, this exact shape:
```json
[{
  "n": 1, "eng": "Brisket",
  "sv":    {"svt": 68, "svh": "30", "changed": false, "ref": "...", "url": "...", "note": "thickness/core basis"},
  "smoke": {"smt": 105, "smh": "3", "tgt": 94, "wood": "אלון/היקורי", "changed": false, "ref": "AmazingRibs — ...", "url": "...", "note": "pit temp, wrap/finish temp"},
  "smoke_only": {"sot": 110, "soh": "12", "changed": false, "ref": "...", "url": "...", "note": "..."},
  "safe":  {"safe": 63, "ref": "Baldwin — pasteurization tables", "url": "https://douglasbaldwin.com/sous-vide.html", "note": "e.g. 68°C bath, 50mm → pasteurized"},
  "grill": {"grt": 260, "grh": "0.15", "grz": "ישיר", "grillable": true, "ref": "AmazingRibs — ...", "url": "...", "note": "sear zone ~500°F, 60-90s/side to 54°C core"},
  "order_svsmoke": {"sv": {"t": 68, "h": "30"}, "dry": {"h": "3-4"}, "smoke": {"t": 120, "h": "1.5", "cold": false}, "ref": "...", "url": "..."},
  "order_smokesv": null,
  "rationale": "1-2 sentences: what you changed vs kept and why, with the deciding source."
}]
```
Rules for the JSON:
- Keep `wood` and any Hebrew text in Hebrew. All temps in °C, times in hours (strings).
- `changed`: true only if you propose a different value than the current one I gave you.
- If a value is already well-supported, set `changed:false` but STILL fill `ref`/`url`/`note` (that IS the citation).
- `order_smokesv`: null unless you found safe, cited pasteurization data for the reverse order.
- `url` must be a real, specific page you actually consulted (not a guess). Include the exact figure in `note`.
- Return the JSON array and nothing else.
