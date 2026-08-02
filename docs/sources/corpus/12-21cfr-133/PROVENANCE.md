# PROVENANCE — #12 · 21 CFR part 133 (milk pasteurization; 60-day aging)

## Artifact 1: CFR-2024-title21-vol2-sec133-3.pdf

- **source_id:** 12
- **Title:** Code of Federal Regulations, Title 21 (Food and Drugs), Chapter I, Part 133 (Cheeses and
  Related Cheese Products), Subpart A, §133.3 "Definitions"
- **Publisher:** GPO, for FDA/HHS
- **Edition / date:** 21 CFR Ch. I, 4-1-24 Edition (as amended through 48 FR 11426, Mar. 18, 1983 — this
  definition section has not been substantively amended since 1983)
- **Retrieval URL:** https://www.govinfo.gov/content/pkg/CFR-2024-title21-vol2/pdf/CFR-2024-title21-vol2-sec133-3.pdf
- **Retrieval method:** WebFetch → PDF saved to disk (WebFetch's own reader could not parse the binary) →
  `pypdf.PdfReader` local extraction
- **Retrieval timestamp:** 2026-08-02 (tool-result `webfetch-1785699865642-...`)
- **Source-map rating:** A1 (binding legislation)
- **Extraction method:** `PDF-T`
- **Pages:** 1 (this page happens to hold both the end of the §133 table of contents and the full text
  of §133.3 and the start of §133.5)
- **Value types covered:** The definitional pasteurization time/temperature table under §133.3(d) —
  145°F/30min, 161°F/15s, 191°F/1s, 204°F/0.05s, 212°F/0.01s (with the +5°F adjustment when fat content
  ≥10%) — and the ultrapasteurization definition under §133.3(e), 280°F for ≥2s.
- **What is missing / did not parse:** Nothing — extraction is complete and matches the source-map's
  pre-quoted numbers exactly (independent confirmation of the earlier verification note in
  `00-SOURCE-MAP.md` §1).

## Artifact 2: CFR-2024-title21-vol2-sec133-113.pdf

- **source_id:** 12
- **Title:** 21 CFR §133.113 "Cheddar cheese"
- **Publisher:** GPO, for FDA/HHS
- **Edition / date:** 21 CFR Ch. I, 4-1-24 Edition (as amended through 58 FR 2892, Jan. 6, 1993)
- **Retrieval URL:** https://www.govinfo.gov/content/pkg/CFR-2024-title21-vol2/pdf/CFR-2024-title21-vol2-sec133-113.pdf
- **Retrieval method:** WebFetch → disk → pypdf
- **Retrieval timestamp:** 2026-08-02 (tool-result `webfetch-1785699884894-...`)
- **Source-map rating:** A1
- **Extraction method:** `PDF-T`
- **Pages:** 2
- **Value types covered:** The raw-milk aging/curing rule: "If the dairy ingredients used are not
  pasteurized, the cheese is cured at a temperature of not less than 35 °F for at least 60 days"
  (§133.113(a)(1)) — plus the compositional standard for Cheddar (min 50% milkfat by weight of solids,
  max 39% moisture by weight) and the phenol-equivalent alternative test for pasteurized-ingredient
  cheddar (§133.113(a)(2)).
- **What is missing / did not parse:** **Not exhaustive.** The source map (§10, item 12) cites
  "21 CFR §133.113 ודומיו" (§133.113 and similar) — the identical 60-day/35°F clause is repeated
  verbatim across roughly 30 individual cheese-type standards in part 133 (e.g. Colby, Swiss, Gruyere,
  brick, Muenster, etc. — a scan of the table of contents visible on the same PDF page as §133.3
  confirms ~30 named cheese standards exist). **Only Cheddar (§133.113) was fetched as the
  representative/most-commonly-cited instance.** If a specific project requirement needs the aging rule
  for a different named cheese type, that section would need a separate fetch — the clause text is
  expected to be identical or near-identical, but this was not verified for every cheese type and should
  not be assumed without checking.

## Artifact 3: pasteurization-and-aging.csv

Our own structured re-encoding of both the pasteurization table and the Cheddar raw-milk aging rule.

## Artifacts 4-5: extracted-text-133-3.txt, extracted-text-133-113.txt

Full pypdf text extractions, kept for audit.

## Disagreements this source touches

None. This source settles no disputed value in §5/§8.3 of the source map — it is cited there only as
the (uncontested) authority for cheese pasteurization and the 60-day aging floor.

## Artifacts 6-7 (round 2, 2026-08-02): ecfr-title21-sec133-3.xml, ecfr-title21-sec133-113.xml —
## structured XML cross-check

- **Retrieval URLs:**
  `https://www.ecfr.gov/api/versioner/v1/full/2024-01-01/title-21.xml?part=133&section=133.3` (2,779
  bytes) and
  `https://www.ecfr.gov/api/versioner/v1/full/2024-01-01/title-21.xml?part=133&section=133.113` (3,914
  bytes)
- **Retrieval method:** Node `fetch()`, both HTTP 200
- **Retrieval timestamp:** 2026-08-02
- **Extraction method:** `XML`
- **Cross-check result: NO DISAGREEMENT.** §133.3(d)'s five pasteurization rows (145°F/30min,
  161°F/15s, 191°F/1s, 204°F/0.05s, 212°F/0.01s, with the +5°F fat-content-≥10% footnote) match
  `pasteurization-and-aging.csv` verbatim, as does §133.3(e) ultrapasteurization (280°F/≥2s exactly —
  the PDF-derived CSV had rendered this as "(or above)"/">2 s", which the XML confirms is the correct
  reading of "at or above 280°F for at least 2 seconds"). §133.113(a)(1)'s raw-milk Cheddar aging clause
  (not less than 35°F, at least 60 days, min 50% milkfat by weight of solids, max 39% moisture) also
  matches verbatim.
