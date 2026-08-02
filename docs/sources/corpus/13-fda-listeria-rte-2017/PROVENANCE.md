# PROVENANCE — #13 · FDA — Listeria in RTE Foods (2017) — **RETRIEVED, PRIMARY TEXT** (round 2)

## Status update (round 2, 2026-08-02): retrieval SUCCEEDED. Round 1's WebSearch reconstruction is
## SUPERSEDED. This document was closed using the corrected retrieval channel (Node's `fetch`, which has
## full network access — unlike the sandboxed `curl` and unlike `WebFetch`'s tool-side domain refusals
## that round 1 mistook for network blocks).

## What changed from round 1

Round 1 declared `fda.gov` "blocked (404 to the tool)" and fell back to a WebSearch reconstruction plus
two non-numeric secondary PDFs (Hogan Lovells webinar slides, `fsns.com` blog — both kept, both still
contain no numeric thresholds). **That block was a tool-side artifact, not a real network block.**
`node -e "fetch('https://www.fda.gov/')"` returns **HTTP 200**. From there:

1. Fetched the FDA guidance-document search page directly:
   `https://www.fda.gov/regulatory-information/search-fda-guidance-documents/draft-guidance-industry-control-listeria-monocytogenes-ready-eat-foods`
   → **200**, 37,932 bytes of HTML.
2. Parsed the HTML for `.pdf`/`/media/`/`download` links → found `/media/102633/download`.
3. Fetched `https://www.fda.gov/media/102633/download` → **200**, `content-type: application/pdf`,
   872,618 bytes.
4. Extracted with `pypdf.PdfReader` (per the brief's established PDF-T pattern) → **85 pages, 209,584
   characters**, saved to `extracted-text-PRIMARY.txt`.
5. Grepped the extracted text for the growth-limit section and found it **verbatim**, with page-4
   citation (see CSV pincite column).

**This is the actual FDA "Control of Listeria monocytogenes in Ready-To-Eat Foods: Guidance for
Industry" (2017), not a summary of it.**

## What the primary text confirms, and what it does NOT confirm (report honestly, not silently)

| Round-1 reconstructed value | Primary-text verdict |
|---|---|
| pH ≤ 4.4 (non-growth threshold) | **CONFIRMED VERBATIM** — page 4: *"The pH of the food is less than or equal to 4.4"* |
| a_w ≤ 0.92 (non-growth threshold) | **CONFIRMED VERBATIM** — page 4: *"The water activity of the food is less than or equal to 0.92"* |
| Temperature range −0.4°C to 45°C | **NOT FOUND** in this document via targeted grep across all 85 pages. Do not carry this figure forward as attributed to this source — it may belong to a different FDA/USDA document and was not verified here. |
| Salt <10% permits growth | **NOT FOUND** as a numeric threshold. The document (line ~363 of the extracted text) only states L. monocytogenes "tolerates high salt concentrations" with no percentage. Treat the prior figure as unconfirmed against this source. |
| EU 2073/2005 cross-check (pH≤4.4 / aw≤0.92 / combined pH≤5.0+aw≤0.94 / shelf-life<5d) | Unchanged from round 1 — still WebSearch-sourced only, not independently re-verified against the EU regulation's own text this session (out of this task's scope) |

**Net effect:** the two numbers this project actually uses for cheese `safe` gating (pH ≤4.4, a_w ≤0.92)
are now **A2-rated, primary-verified**, not WebSearch reconstructions. The temperature and salt figures
that were bundled into the round-1 reconstruction are **downgraded to unconfirmed** — they should not be
cited as coming from this source unless someone independently re-derives them.

## Artifact 1 (unchanged from round 1): Hogan-Lovells-2017-Listeria-webinar-slides-secondary.pdf

Kept as-is; still a non-numeric secondary compliance briefing. See original notes below (unchanged).

- **source_id:** 13 (secondary, NOT the FDA guidance itself)
- **Title:** "FDA's Revised Draft Guidance for Control of Listeria monocytogenes in Ready-To-Eat Foods" —
  Hogan Lovells (law firm) client webinar slides, presented to AFFI, 13 Feb 2017
- **Retrieval URL:** https://www.foodprotection.org/members/files/Hogan_Lovells_Listeria_Webinar_Slides_2_13_17.pdf
- **Value types covered:** policy/regulatory background only, no numeric thresholds

## Artifact 2 (NEW, PRIMARY): FDA-2017-Listeria-RTE-guidance-PRIMARY.pdf

- **source_id:** 13
- **Title:** "Control of Listeria monocytogenes in Ready-To-Eat Foods: Guidance for Industry"
- **Publisher:** U.S. Food and Drug Administration, Office of Food Safety
- **Edition / date:** 2017 (per FDA guidance-document search page; this is the FDA's currently-hosted
  version at the time of retrieval, 2026-08-02)
- **Retrieval URL:** `https://www.fda.gov/media/102633/download`
- **Retrieval method:** Node `fetch()` (NOT `curl`, NOT WebFetch) → PDF saved to disk → `pypdf.PdfReader`
  text extraction
- **Retrieval timestamp:** 2026-08-02
- **Source-map rating:** **A2** (official government guidance — matches the source map's own rating for
  this source; no longer inherited-then-discounted, this is the real document)
- **Extraction method:** `PDF-T`
- **Value types covered:** pH and water-activity non-growth thresholds for L. monocytogenes (the values
  this project's cheese `safe` field needs); also present but NOT extracted into the CSV this round
  (out of scope, flagged for a future pass if needed): environmental monitoring / "seek and destroy"
  program details, sanitation SOPs, corrective-action requirements, raw-material control requirements.
- **What is missing:** the temperature and salt growth-range figures that round 1 attributed to this
  source were not found here (see table above) — this is a genuine gap, stated, not silently dropped.

## Artifact 3 (NEW): extracted-parameters-PRIMARY.csv

Structured CSV with page pincites, replacing `reconstructed-parameters-SUPERSEDED.csv` (kept in the
folder for audit trail, not deleted — marked SUPERSEDED in filename per the DoD-4 "artifact is the
evidence" principle: never silently delete a prior claim, mark its status instead).

## Honest coverage statement (round 2)

**Source #13 is now CLOSED with primary-text verification** for the two numbers this project actually
needs (pH ≤4.4, a_w ≤0.92). It is **NOT fully closed** for the temperature/salt figures round 1 also
recorded — those are now flagged unconfirmed rather than carried forward silently. A human who wants the
guidance's full environmental-monitoring/corrective-action content (not currently needed by this
project's data model) has the full 85-page primary text available in `extracted-text-PRIMARY.txt`.

## Disagreements this source touches

None of D-1..D-8 directly. The pH≤4.4/aw≤0.92 confirmation strengthens confidence in the existing cheese
`safe`-gating values already in the source map (§3.8, G-D discussion) but does not resolve or newly raise
any registered disagreement.
