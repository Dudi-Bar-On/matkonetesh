# PROVENANCE — #8 · FSIS-GD-2023-0002 (a_w, pH, log targets, biltong) — **RETRIEVED, PRIMARY TEXT** (round 2)

## Status update (round 2, 2026-08-02): retrieval SUCCEEDED via the Wayback Machine. Round 1's
## WebSearch reconstruction is SUPERSEDED. `fsis.usda.gov` itself remains genuinely server-blocked
## (confirmed again this round — see below), but the corrected retrieval channel (Node `fetch`, full
## network access, unlike sandboxed `curl`) reached an archived copy of the exact PDF.

## What changed from round 1, and how this round got in where round 1 could not

Round 1 tried six retrieval paths, all failed, and correctly concluded (given the tools it had) that
`fsis.usda.gov` was unreachable. This round **re-confirmed that `fsis.usda.gov` is genuinely
server-blocked** — this is NOT a round-1 misdiagnosis to correct (unlike `ecfr.gov`/`fda.gov`, see the
source-map §1 rewrite):

1. `https://www.fsis.usda.gov/sites/default/files/media_file/documents/FSIS-GD-2023-0002.pdf` (direct,
   via node fetch) → **HTTP 404** (the file was apparently moved/removed from that exact path since
   round 1's 403 — different failure mode, still a genuine block/absence, not a tool artifact).
2. `https://www.fsis.usda.gov/guidelines/2023-0002` (landing page, via node fetch) → **HTTP 403**.
3. `https://www.fsis.usda.gov/sites/default/files/media_file/documents/Overview_of_Ready_to_Eat_Shelf_Stable_Fermented_Salt_Cured_Dried_Products.pdf`
   (a related overview PDF found via WebSearch, via node fetch) → **HTTP 403**, 565-byte HTML error body
   (confirmed genuinely server-side, not a tool block: `content-type: text/html`).
4. **`https://www.maine.gov/dacf/.../haccp-model-for-ready-to-eat-fermented-salt-cured-and-dried-products...pdf`**
   — a Maine Dept. of Agriculture, Conservation and Forestry HACCP-model document that **cites specific
   page numbers of FSIS-GD-2023-0002 verbatim** (e.g. "See FSIS Ready-to-Eat Fermented, Salt-Cured and
   Dried Products Guideline page 40 for recommended lethality targets") → **HTTP 200**, 334,546 bytes,
   successfully retrieved and extracted (20 pages, 39,219 characters). Kept as a corroborating secondary
   artifact (`maine-haccp-model-mirror.pdf` / `extracted-text-maine-mirror.txt`) — it independently
   confirms the pH ≤5.3 target, the AMI Foundation 1997 attribution, and the ≥5-log10 Salmonella/Lm
   reduction target, all sourced from a different (state-government) document that cites the FSIS
   guideline by page number.
5. **`https://archive.org/wayback/available?url=fsis.usda.gov/.../FSIS-GD-2023-0002.pdf`** — the Wayback
   Machine's availability API (reachable via node fetch, `200`, JSON) returned a snapshot:
   `http://web.archive.org/web/20250221181236/https://www.fsis.usda.gov/sites/default/files/media_file/documents/FSIS-GD-2023-0002.pdf`
   (captured 2025-02-21, i.e. before whatever change caused the current 404).
6. Fetched that Wayback URL → **HTTP 200**, `content-type: application/pdf`, **1,641,513 bytes** — this
   IS the primary document, archived. Extracted with `pypdf.PdfReader` → **105 pages, 254,373
   characters**, saved to `extracted-text-PRIMARY.txt`.

**Correction to round 1's own retrieval-reality table**: round 1 recorded `web.archive.org` as "blocked by
the tool itself" — that was true for WebFetch specifically, but **node `fetch` reaches
`web.archive.org` cleanly (HTTP 200)**. This is exactly the same misdiagnosis pattern that created this
round-2 task in the first place, just discovered independently on a different host. See the corrected
`00-SOURCE-MAP.md` §1.

## What the primary text confirms (all verbatim, full grep across 105 pages / 254,373 characters)

| Round-1 reconstructed value | Primary-text verdict |
|---|---|
| pH ≤5.3 target (S. aureus control before drying) | **CONFIRMED VERBATIM** |
| Water activity ≤0.85 (shelf-stability / S. aureus control) | **CONFIRMED VERBATIM**, appears at 2+ locations |
| Salmonella 5-log10 reduction target | **CONFIRMED VERBATIM**, appears repeatedly in worked examples (biltong, droëwors) |
| Degree-hours base temperature, 60°F/15.6°C | **CONFIRMED VERBATIM** ("measured as the excess over 60°F (15.6°C)") — also independently corroborates source-map §8.3's already-settled D-2 (FSIS/CFIA degree-hours are the same AMI-1997 number in different units, not a real disagreement) |
| Degree-hours 1200/1000/900 numeric table | **NOT restated in this document** — GD-2023-0002 describes the concept and attributes it to the AMI Foundation 1997 GMP document (source #10) rather than reprinting the table. This is confirmation of source-map §8.2's derivation chain, not a gap in this retrieval. |
| **NEW, not in round 1's reconstruction:** Listeria monocytogenes 3-log10 reduction target (companion to the 5-log Salmonella/STEC target) | **CONFIRMED VERBATIM** — a genuine addition to the corpus, not a correction |

**Net effect: every numeric value round 1 reconstructed from secondhand search snippets is now confirmed
verbatim in the actual primary document, plus one new value (the 3-log Lm target) was found.** No
disagreements were introduced.

## Artifact 1 (NEW, PRIMARY): FSIS-GD-2023-0002-PRIMARY-wayback.pdf

- **source_id:** 08
- **Title:** "FSIS Ready-to-Eat Fermented, Salt-Cured, and Dried Products Guideline," FSIS-GD-2023-0002
- **Publisher:** USDA FSIS
- **Edition / date:** May 2023 (per Federal Register notice 2023-09614, docket FSIS-2022-0011) — archived
  snapshot dated 2025-02-21
- **Retrieval URL:** `http://web.archive.org/web/20250221181236/https://www.fsis.usda.gov/sites/default/files/media_file/documents/FSIS-GD-2023-0002.pdf`
- **Retrieval method:** Node `fetch()` → Wayback Machine availability API → snapshot URL → PDF saved to
  disk → `pypdf.PdfReader` extraction
- **Retrieval timestamp:** 2026-08-02
- **Source-map rating:** **A2** (the real document, not a discounted reconstruction)
- **Extraction method:** `PDF-T`
- **Value types covered:** pH/a_w/degree-hours S. aureus control targets; Salmonella/STEC/Lm log-reduction
  targets for fermented, salt-cured, and dried products including biltong and droëwors; worked examples
  with process parameters (brine %, drying time/temperature/RH, water activity by day)
- **What is missing:** the numeric degree-hours table itself (1200/1000/900) is not in this document —
  confirmed absent by full-text search, not an extraction failure. Full Appendix 2/14/15 worked-example
  tables (challenge-study parameters for specific products) were not individually transcribed into the
  CSV this round — the CSV captures the headline safety parameters this project's data model needs; the
  full text is available in `extracted-text-PRIMARY.txt` for anyone who needs the per-product tables.

## Artifact 2 (NEW, secondary corroboration): maine-haccp-model-mirror.pdf

- **source_id:** 08 (secondary — a state-government HACCP model document, NOT the FSIS guideline itself)
- **Title:** "HACCP Model for Ready-to-Eat Fermented, Salt-Cured, and Dried Products (Not Heat
  Treated—Shelf Stable)"
- **Publisher:** Maine Department of Agriculture, Conservation and Forestry (DACF)
- **Retrieval URL:** `https://www.maine.gov/dacf/qar/inspection_programs/documents/mmpi/haccp-model-for-ready-to-eat-fermented-salt-cured-and-dried-products-not-heat-treatedshelf-stable.pdf`
- **Retrieval method:** Node `fetch()` → PDF saved to disk → `pypdf.PdfReader`
- **Value:** independently corroborates the pH ≤5.3 target and the AMI Foundation 1997 attribution with
  specific page citations into FSIS-GD-2023-0002 ("page 37", "page 40"), from a different government body
  than either FSIS or AMI — genuine independent corroboration, not an echo, since Maine DACF built this
  document to comply with the federal guideline rather than to restate it.

## Artifact 3 (NEW): extracted-parameters-PRIMARY.csv

Structured CSV with page-region pincites, replacing `reconstructed-parameters-SUPERSEDED.csv` (kept in
the folder for audit trail, marked SUPERSEDED in filename rather than deleted).

## Honest coverage statement (round 2)

**Source #8 is now CLOSED with primary-text verification.** This was one of the two total failures round
1 flagged; both are now closed (see source #13's PROVENANCE.md for the other). The retrieval succeeded
via `fsis.usda.gov`'s own genuine block being routed around through the Wayback Machine's availability
API — a technique this round discovered was itself blocked to WebFetch but not to node fetch, extending
the round-2 corrective finding to a second host.

## Disagreements this source touches

Reinforces (does not newly settle or newly raise) source-map §8.3 / D-2: the degree-hours base
temperature confirmation (60°F/15.6°C) is one more independent data point supporting the existing
conclusion that FSIS and CFIA's degree-hours figures are the same AMI-1997 number in different unit
systems, not a real disagreement.
