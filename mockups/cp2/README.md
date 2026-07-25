# CP2 mockups — the item card's cooking-path panel

Three static, self-contained HTML mockups for owner visual approval (spec §10.9), built per
`docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md` §3.3 and §9.1–9.2. Each
mocks the FULL card in place (name, stat line, the E1 requires-chip, the panel, steps, sources box)
at 390px width, using real brisket citations already wired in CP1 (`order_svsmoke` 68°/30h → 120°/1.5h,
`order_smokesv` 75°/1.5–2h → 68°/30h). No app code was touched — these are throwaway static pages for
review only, screenshotted via a standalone Playwright script against `file://` URLs.

Screenshots (390×844): `variant-a.png` · `variant-b.png` · `variant-c.png`.

## Variant A — chip row (`variant-a-chips.html`)

A compact horizontal chip row sits directly under the stat line, one chip per path (icons + short
label + a "ברירת מחדל" badge on the default); tapping a cited chip selects it and expands an inline
mini-schedule card underneath, and the stat line/step list above re-render at the same time. **Density**
is the best of the three — the resting state costs one row of pills, no accordion chrome. **Scanability**
is the weakest: with 5 paths the row scrolls horizontally, so the two placeholder paths are invisible
until the owner swipes, and comparing two paths' figures requires tapping back and forth since only one
expands at a time. **Taps-to-switch** is the fewest of the three: one tap selects and reveals detail in
the same gesture (no separate open/close step).

## Variant B — expandable list (`variant-b-list.html`)

A "מסלולי בישול" section that collapses to one header row (current default's icons/label + a
"5 מסלולים" count pill + chevron) and expands to a full radio-style list — every path's icons, figures,
and citation marker on one row, so all 5 are visible and comparable at once with no scrolling ambiguity.
**Density** is the weakest at rest only in the sense that opening it takes real vertical space (5 rows);
collapsed it is as compact as variant A's whole strip. **Scanability** is the best of the three — nothing
is hidden off-screen, and the citation state (✓ cited vs ⏳ coming soon) reads at a glance down the
column. **Taps-to-switch** is two: open the section, then tap a row (it auto-collapses back to the new
header after selection, which doubles as a visible confirmation that O-1's per-recipe default moved).

## Variant C — path tabs (`variant-c-tabs.html`)

The card's whole cooking block becomes a tab strip (icon + short label per path, the two placeholders
dashed/muted at the end); the entire schedule area below — stat line, citation line, and step list —
swaps per active tab. **Density** sits between the other two: the tab strip is one row like variant A's
chips, but the schedule is always fully expanded below it (no inline reveal step). **Scanability** is
good for the active path (largest, clearest step-by-step of the three, since it owns the full area below)
but poor for comparing paths against each other — only one schedule exists on screen at a time, and like
variant A the tab strip scrolls past 3–4 items on a 390px screen. **Taps-to-switch** is one, same as A.

## Recommendation

**Variant B (expandable list).** It is the only one of the three where an owner comparing 5 cited paths
(a real brisket count, and the shape CP3's research batch will keep producing) can see all of them —
including which two are "מקור בבדיקה" placeholders — without scrolling a chip strip or tabbing through
one-at-a-time; the two extra taps to switch (open, then select) are a fair price for that legibility, and
the auto-collapse after selection gives a clean visible confirmation of O-1's default change.

## Open copy questions for the owner

1. **Arrow direction convention** — the mockups render `סו-ויד → עישון` / `עישון → סו-ויד` using the same
   right-arrow-that-visually-mirrors-in-RTL convention already in `sourcesBlock()` (no spaces there; these
   mockups add spaces for chip/tab legibility). Confirm the spaced form is acceptable, or match the
   existing no-space literal exactly.
2. **"עישון בלבד" citation wording** — the mockups cite the smoke-only path (105°/3h) to the same
   AmazingRibs source as the sv→smoke default, worded "(טור עישון בלבד)" since the app's data today
   carries that figure as the catalog `smt`/`smh` literal, not a separately-cited standalone entry. The
   real CP1/CP3 data model should confirm whether this path gets its own citation line or continues to
   ride the same reference.
3. **Placeholder copy** — "בקרוב — מקור בבדיקה" (coming soon — source under review) is used verbatim for
   both CP3 rows (תנור בלבד, סו-ויד → תנור). Confirm the wording and whether tapping a placeholder should
   toast (as built) or do nothing at all.
4. **Grid-card hint (spec §9.2)** — all three variants show the catalog grid card unchanged, displaying
   only the default path's figures with no multi-path hint (the "proposed" side of the open question).
   If the owner wants a hint (e.g. a small "5" badge), that changes a fourth surface not built here.
5. **"חוסך מעשנת" (smoker-hours-saved) stat** — shown only for the sv→smoke path (it has no clear meaning
   for smoke-only/reverse-order paths, which are already smoker time). Confirm this drop-when-inapplicable
   behavior versus always reserving the slot.
