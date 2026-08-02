# PROVENANCE — Source #3: FSIS Safe Minimum Internal Temperature Chart (+ 2011 pork notice)

## Source identity
- **source_id:** `03-fsis-safe-min-temp`
- **Title:** "Safe Minimum Internal Temperature Chart" (USDA FSIS consumer chart) + the 2011 policy change that added the 145°F/3-min pork rule
- **Publisher / edition:** USDA Food Safety and Inspection Service. The chart artifact obtained is dated **June 2012** on its own face (a slightly later edition than the "2011 notice" itself, incorporating the 2011 change already)
- **Rating (source map §2):** A2 — official government consumer guidance
- **License:** Public Domain
- **extraction (per source map):** `MANUAL` — this is the designation because `fsis.usda.gov` itself returns HTTP 403 to WebFetch (confirmed again today, see below); the intended route is WebSearch reconstruction / mirrors, not a clean primary PDF fetch

## Artifacts in this folder and their retrieval

| File | Retrieval URL | Retrieved | Method | Result |
|---|---|---|---|---|
| `fsis-safe-min-temp-chart-mirror-kstate.pdf` + `extracted-text.txt` | `https://www.geary.k-state.edu/health-home-family/resources/Safe_Miminum_Internal_Temperature_Chart.pdf` (Kansas State University Extension mirror, found via WebSearch) | 2026-08-02 | `WebFetch` → saved to disk → `pypdf` | **Success** — 1-page PDF, clean text extraction. Confirmed as the actual official FSIS chart artifact (header: "United States Department of Agriculture / Food Safety and Inspection Service", "June 2012") — not a paraphrase |

**Confirmed blocked (re-verified today, consistent with source map §1):**
- `https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart` — **HTTP 403**
- `https://www.usda.gov/about-usda/news/blog/cooking-meat-check-new-recommended-temperatures` (the 2011 blog announcement itself) — **HTTP 403**
- `https://www.foodpoisonjournal.com/...porks-minimum-safe-cooking-temperature-lowered-to-145-f-by-usda/` — **HTTP 403**

**2011 pork-change text obtained via:** `https://www.lsuagcenter.com/portals/communications/news/news_archive/2011/may/news_you_can_use/usda-changes-safe-pork-cooking-temperatures` (LSU AgCenter extension news archive, republishing/quoting the USDA announcement) — `WebFetch` succeeded, HTML page, plain text. Dated **2011-05-25** in that republication (USDA's own announcement is usually cited as 2011-05-24).

## Structured data extracted

`safe-min-temp-chart.csv` — every row of the official chart (beef/pork/veal/lamb steaks-chops-roasts 145°F+3min; ground meats 160°F; fresh/smoked uncooked ham 145°F+3min; fully-cooked ham to reheat 140°F USDA-packaged / 165°F otherwise; all poultry 165°F; eggs 160°F; fish & shellfish 145°F; leftovers 165°F; casseroles 165°F) plus a `MANUAL`-flagged row for the 2011 pork policy-change narrative (secondary-sourced, not from a primary USDA page — the primary announcement page itself is blocked).

## What is missing or did not parse

- The **primary USDA blog post announcing the 2011 change** could not be retrieved directly (403). The change's substance (145°F + 3min for whole-muscle pork cuts, replacing 160°F/no-rest; ground pork unchanged at 160°F/no-rest) is corroborated by an extension-service secondary republication, which is standard practice for citing USDA blog content that returns 403 to automated fetch — but this is **not the primary artifact itself**, only a citation of it. Confidence: high (LSU AgCenter is a credible university extension source explicitly quoting the announcement with a date), but flagged `MANUAL`/secondary per the brief's instruction to make confidence level visible.
- No FSIS Notice number (e.g., an FSIS Notice/Federal Register citation for the 2011 change) was located or verified; the source map's own line item references this only informally ("2011 pork notice"), and no such notice number surfaced in the searches performed for this task.

## Disagreement note

No new bearing on the 94°C brisket disagreement. Confirms **D-3** partially: the beef/pork/veal/lamb "steaks, chops, roasts" row in this consumer chart (145°F + 3min) is the same number as Food Code §3-401.11(A)(1) (145°F/15sec) collapsed to a single consumer-facing rule, distinct from the Food Code's separate whole-roast ladder (source #1) — three FSIS/FDA-published numbers for "beef," not contradictory, but genuinely not collapsible into one `safe` field without a qualifier, exactly as the source map already concluded.
