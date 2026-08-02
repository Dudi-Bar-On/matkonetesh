# PROVENANCE — #10 · AMI Foundation 1997 (the source of truth for degree-hours)

## Status: the AMI Foundation's own 1997 document could not be retrieved. This folder holds the closest
## available substitute: a secondary academic/extension document that quotes and cites it directly,
## including its exact numbers and a worked example.

## What was attempted for the primary AMI Foundation document itself

- **Original citation, found inside the secondary source (see Artifact 1 below):** "American Meat
  Institute's Good Manufacturing Practices for Fermented Dry and Semi-dry Sausage Products:
  http://www.amif.org/FactsandFigures/SAUSAGE.pdf"
- **Fetched that exact URL** → **redirected (301) to `amif.org/404.html`** — the American Meat Institute
  Foundation's own web presence (`amif.org`) no longer serves this document; the domain itself appears
  to have been substantially reorganized/merged (AMI merged into the North American Meat Institute,
  NAMI, in 2015). **Confirmed dead, not merely blocked** — this is consistent with the source map's own
  note that this source is "לא נמשך" (not yet retrieved) for #10, and explains why: unlike the other
  MANUAL sources in this corpus (which are unavailable due to paywalls/print-only books), this one may
  simply no longer be hosted anywhere on the open web under its original name.
- **A first candidate mirror, `meathaccp.wisc.edu/assets/Heat_Treated_Shelf_Stable/AMIF_degreehours.pdf`**
  (found via WebSearch, described as hosting the degree-hours document) → **redirected (303) to the
  generic `foodsafety.wisc.edu/meat-haccp/` landing page** — also stale/moved, not the actual file.
  **No further, more specific mirror URL for the AMI Foundation 1997 document itself was found.**

## Artifact 1: UW-FSRE-Principles-of-Preservation-Shelf-Stable-Dried-Meat.pdf

- **source_id:** 10 (secondary/citing document, NOT the AMI Foundation 1997 original)
- **Title:** "Principles of Preservation of Shelf-Stable Dried Meat Products" (page header text; part of
  a larger training/reference set — internal page number "160" and the header "FSRE Shelf-Stable"
  suggest this is a chapter from a University of Wisconsin meat-HACCP validation training curriculum)
- **Publisher:** University of Wisconsin-Madison, Center for Meat Process Validation / Food Research
  Institute (hosted at `meathaccp.wisc.edu`)
- **Edition / date:** dated "5/11/05" on its own first page (i.e., 2005 — eight years after the AMI
  Foundation document it cites, but the degree-hours concept it describes is explicitly attributed to
  and unchanged from the 1997 original)
- **Retrieval URL:** http://www.meathaccp.wisc.edu/validation/assets/Principles%20for%20preservation.pdf
- **Retrieval method:** WebFetch → PDF saved to disk (WebFetch's own reader again reported unparseable
  binary) → `pypdf.PdfReader` local extraction, which worked cleanly (33,747 characters, 15 pages)
- **Retrieval timestamp:** 2026-08-02
- **Source-map rating:** the AMI Foundation 1997 original would be **C** (professional/industry-body
  document, not peer-reviewed, not regulatory) per the source map's rating scale. **This secondary
  University of Wisconsin document inherits a similar tier** — it is a credible academic meat-science
  extension resource, but it is one step removed from the primary: it reports/quotes the AMI numbers
  rather than being the AMI Foundation's own text.
- **Extraction method:** `PDF-T` (of the secondary document; the primary AMI 1997 document itself
  remains unretrieved — see status above)
- **Pages:** 15 (only the relevant excerpt, around original page "160", was read closely)
- **Value types covered:** the full degree-hours definition, all three numeric breakpoints, and a
  verbatim worked example, quoted directly from the source text:
  > "This is the concept of degree-hours – the number of hours at a temperature above 60°F (the
  > temperature at which staphylococcal growth effectively begins) multiplied by the number of degrees
  > above that temperature. A process is acceptable if the product reaches pH 5.3 within a certain
  > number of degree-hours. Processes attaining a temperature less than 90°F before reaching pH 5.3 are
  > limited to 1200 degree-hours. Processes reaching a temperature of 90°F-100°F prior to reaching pH
  > 5.3 are limited to 1000 degree-hours. Processes exceeding 100°F before reaching pH 5.3 are limited
  > to 900 degree hours. For example, a product processed at a constant 80°F reaching pH 5.3 in 55 hours
  > would meet the guideline of 1200 degree-hours, since 80°F-60°F=20°F and 20°F X 55 hours = 1100
  > degree-hours."
  This is an **exact numeric match** to the figures the source map already carries (§8.2, §8.3, §10
  item 10: "1200/1000/900" — the FSIS-side figures independently confirmed as the AMI 1997 originals)
  and to the CFIA °C-converted figures in source #11 (665/555/500, per the 1.8 conversion factor already
  verified in source-map §8.3).
- **What is missing / did not parse:** The AMI Foundation's own original 1997 document text, tables,
  and any additional context (e.g. rationale, citations to the underlying microbiology, product-specific
  worked examples beyond the one quoted above) — none of that could be retrieved. Only this one
  secondary quotation/citation was found. If the project later needs more than the three breakpoints and
  one worked example, a human would need to source the original AMI Foundation 1997 monograph through a
  library, industry-association archive (successor: North American Meat Institute / Meat Institute), or
  interlibrary loan — it does not appear to be freely available on the open web under this environment's
  reachable hosts.

## Artifact 2: degree-hours.csv

Structured re-encoding of the basis temperature (60°F), the pH 5.3 target, the three degree-hour limits,
and the worked example — all taken verbatim from Artifact 1's quotation of the AMI 1997 concept.

## Artifact 3: extracted-text-raw.txt

Full pypdf text extraction of Artifact 1 (33,747 characters), kept for audit.

## Disagreements this source touches

**Directly resolves/confirms D-2 (source-map §8.3), a third time over.** This is now the third
independent read of the 1200/1000/900 °F-degree-hour figures (source-map author's own CFIA read, this
agent's own CFIA read in source #11, and now this UW document's direct citation of the AMI Foundation
1997 original) — all agree, and this document additionally supplies the missing link the source map
could not itself verify: **explicit written confirmation, from a source citing the AMI document
directly, that FSIS's "1200/1000/900" figures did indeed originate with the American Meat Institute
Foundation 1997 publication**, strengthening (not merely repeating) source-map §8.2's derivation-graph
claim that FSIS's degree-hours table is DERIVED←AMI 1997, not independently authored by FSIS.
