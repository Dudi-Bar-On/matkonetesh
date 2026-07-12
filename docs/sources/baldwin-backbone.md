# Baldwin Backbone — canonical pasteurization & safety reference

**Source:** Douglas Baldwin, *A Practical Guide to Sous Vide Cooking*
**URL:** https://douglasbaldwin.com/sous-vide.html
**Fetched/verified:** 2026-07-12
**Role:** This is the P3 safety backbone. Every `safe` value and every pasteurization
claim in `data.py` must trace to this page (or another cited primary source). Never guess.

---

## Recommended sous-vide CORE temperatures (→ maps to `svt` / `tgt`)

| Food | Doneness | °C | °F |
|------|----------|-----|-----|
| Beef / red meat | rare | 51.5 | 125 |
| Beef / red meat | medium-rare | 54.5 | 130 |
| Beef / red meat | medium | 60 | 140 |
| Pork | medium (traditional) | 61 | 141 |
| Pork | minimum safe | 54.4 | 130 |
| Poultry (chicken/turkey/duck) | medium + pasteurized | 60–65 | 140–150 |
| Fish/seafood | medium-rare | 49 | 120 |
| Fish/seafood | medium | 60 | 140 |
| Salmon | rare–medium-rare | 43–50 | 110–122 |
| Egg | "perfect" | 64.5 (45–60 min) | 148 |
| Egg | pasteurized in-shell | 57 (≥1h15) | 135 |

## Minimum safe floors (→ `safe`)

- **Beef / pork / lamb:** 130°F / **54.4°C** minimum for sous vide (prevents *C. perfringens*).
  Below this, food may be held only if center reaches 130°F within 6 h.
- **Poultry:** pasteurize via table below; hold 57–65°C (134.5–149°F).
- **Fish:** 55–60°C (131–140°F) for safe pasteurization.
- **Danger zone:** raw/unpasteurized food may be between 41°F–130°F (5–54.4°C) for **< 4 h total**.

## Pasteurization TIME by thickness — Beef / Pork / Lamb (from 5°C start)

| Thickness | 55°C | 57°C | 60°C |
|-----------|------|------|------|
| 10 mm | 2 h | 1.25 h | 40 min |
| 20 mm | 2.5 h | 1.75 h | 1.25 h |
| 30 mm | 3 h | 2 h | 1.5 h |
| 50 mm | 4.5 h | 3.25 h | 2.5 h |

## Pasteurization TIME by thickness — Poultry (from 5°C start)

| Thickness | 57°C | 60°C | 63°C | 65°C |
|-----------|------|------|------|------|
| 10 mm | 2.25 h | 55 min | 30 min | 20 min |
| 20 mm | 2.75 h | 1.25 h | 50 min | 40 min |
| 30 mm | 3.25 h | 2 h | 1.5 h | 1.25 h |
| 50 mm | 4.75 h | 3.25 h | 2.5 h | 2.25 h |

Fish (lean) at 60°C: 10 mm ≈ 35 min, 20 mm ≈ 60 min.

## Thickness ↔ time rule

**Doubling thickness ≈ 4× time** (diffusion; time ∝ thickness²). Use for interpolation only —
prefer table values for the safety-critical `safe`/pasteurize claims.

## Cook-chill storage

- Below 3.3°C (38°F): ≤ 31 days. Below 5°C (41°F): < 10 days.
- Pasteurized food: eat immediately OR ice-chill rapidly (≥50% ice) then refrigerate.

---

## How this maps to data.py

- `svt` = target sous-vide bath temp (= desired core). Anchor to the doneness rows above.
- `safe` = pasteurization/safety floor. Beef/pork/lamb ≥ 54.4; poultry per table (≥57 with time).
- `tgt` = final internal target (for braised/collagen cuts can exceed `safe`, e.g. 90–96°C).
- Pasteurization adequacy = function of (bath temp, thickness) → cite the specific table cell in `note`.

**Citation stub for `src`:**
```python
"safe": {"ref":"Baldwin — Practical Guide to Sous Vide (pasteurization tables)",
         "url":"https://douglasbaldwin.com/sous-vide.html", "note":"<temp>°C, <thickness>mm → <time>"}
```
