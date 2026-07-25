# Registered work item — broader cooking-order vocabulary in the data (content/authoring track)

**Registered:** 2026-07-25, by owner instruction in conversation ("want a broader order vocabulary in
the data, that's a content/authoring" track). **Status:** REGISTERED, not scheduled — sequencing is the
owner's call once E4 lands.

## What exists today (verified against the running code, 2026-07-25)

- The catalog item — the object that represents a recipe — **already carries order data at the bottom
  layer, cited**: `order_smokesv` (sibling field `order_svsmoke` read at app.js:2052) lives per-item in
  **`sources.py`** (the same cited-primary-source layer as the safety values; merged at build time, so
  `data.py` greps show none), with per-stage parameters: `smoke: {t, h, cold}`, `sv: {pasteurize}`.
- Runtime consumption is item-level and safety-gated: `itemStages` builds the reverse sequence from
  `meta.obj.order_smokesv` (app.js:3233); `comboHasSvSmoke` (app.js:3274) offers smoke→sv **only** when
  the cited data has `sv.pasteurize===true` — never a formula (v147/P3 rule).
- The E1 requires layer is order-aware by signature: `deriveRequires(meta, methodKey, order)`.
- **The gap:** the *default* order is a global hard-coded `svSmokeOrderDefault()` → `'sv-smoke'`
  (app.js:2969), and the user's choice is per-event state. Approved spec §6 (phase **E4**) moves the
  default to the recipe level (per-recipe default + per-event override) and re-sequences ledger windows
  through the one order-aware `itemStages` path.

## The registered work

1. **Authoring:** cited order data for more items and, where sources support them, more order pairs
   (e.g. cure→smoke sequencing). Every entry traces to a primary source, per
   `docs/sources/baldwin-backbone.md` — *never guess*; reverse orders carry an explicit
   pasteurize/safety flag exactly as `order_smokesv.sv.pasteurize` does today.
2. **Schema consideration for E4's plan (design note, not a decision):** today's fields are pair-named
   (`order_smokesv`/`order_svsmoke`). E4's generalization of the seam should weigh a general form
   (e.g. `orders: {<orderKey>: {…cited stage params}}`) so vocabulary growth after E4 is **pure data**
   — the acceptance bar for this whole item is: *adding an order pair reaches the app with zero new
   JS* (data + citation + build only).

## Dependencies and accounting

- Mechanism dependency: **E4** (recipe-level default + override, ledger re-sequencing; after E2).
- This item consolidates into the gaps-closing programme at the next consolidation pass; it is a
  content/authoring item, not a code phase, and does not alter the approved equipment spec's scope.

## Addendum — citation-review task (owner ruling 2026-07-25, bug round)

Re-verify the three `cold:True` lamb citations in `sources.py` (n=35 Leg of Lamb, n=36 Rack of Lamb,
n=60 Lamb Loin) — tagged cold-smoke at 55–60°C, above any standard cold-smoking ceiling (≤~30°C).
Until resolved, labels follow the cited flag as-is (data doctrine: code never overrides a citation).
Same authoring track as the order vocabulary; primary-source re-check, not a code task.
