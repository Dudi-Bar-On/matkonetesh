# PROVENANCE — #7 · 9 CFR §424.22 (the bacon formulas)

## Artifact 1: CFR-2024-title9-vol2-sec424-22.pdf

- **source_id:** 07
- **Title:** Code of Federal Regulations, Title 9 (Animals and Animal Products), Chapter III, Part 424,
  §424.22 "Certain other permitted uses" (annual edition)
- **Publisher:** U.S. Government Publishing Office (GPO), for FSIS/USDA
- **Edition / date:** 9 CFR Ch. III, 1-1-24 Edition (as amended through 78 FR 66839, Nov. 7, 2013)
- **Retrieval URL:** https://www.govinfo.gov/content/pkg/CFR-2024-title9-vol2/pdf/CFR-2024-title9-vol2-sec424-22.pdf
- **Retrieval method:** WebFetch → PDF saved to disk (WebFetch's own summarizer reported it as
  unparseable binary) → `pypdf.PdfReader` extracted text locally
- **Retrieval timestamp:** 2026-08-02 (tool-result filename `webfetch-1785699765842-...`)
- **Source-map rating:** A1 (binding legislation)
- **Extraction method:** `PDF-T`
- **Pages:** 4
- **Value types covered:** All four bacon curing formulas under §424.22(b):
  1. Pumped/massaged bacon, standard: sodium nitrite 120 ppm ingoing (or potassium nitrite 148 ppm
     equivalent) + 550 ppm sodium ascorbate/erythorbate — subject to a mandatory nitrosamine (TEA)
     testing program, cooked at 340°F for 3 min/side, detection threshold 10 ppb.
  2. Pumped bacon, alternative formula A: sodium nitrite 100 ppm (potassium nitrite 123 ppm) + 550 ppm
     ascorbate/erythorbate — exempted from the routine TEA program under (b)(1)(ii)(A).
  3. Pumped bacon, alternative formula B (fermented): sodium nitrite 40-80 ppm (potassium nitrite
     49-99 ppm) + 550 ppm ascorbate/erythorbate + ≥0.7% fermentable carbohydrate + lactic-acid
     bacterial inoculum (e.g. *Pediococcus acetolactii*) to suppress *C. botulinum* toxin formation.
  4. Immersion-cured bacon: sodium nitrite ≤120 ppm ingoing (potassium nitrite 148 ppm equivalent),
     based on skin-free green weight of the bellies.
  5. Dry-cured bacon: sodium nitrite ≤200 ppm ingoing (potassium nitrite 246 ppm equivalent), based on
     skin-free green weight.
  Also covers unrelated §424.22(a) (salt/sugar/smoke/flavoring general permitted uses) and §424.22(c)
  (meat irradiation dosimetry/labeling — not relevant to this project, preserved for completeness).
- **What is missing / did not parse:** Nothing numeric is missing — extraction is complete and clean.
  Note the four bacon methods are NOT all independent alternatives for the same product: (1)-(3) are
  three sub-variants of *pumped* bacon; (4) and (5) are the separate immersion-cure and dry-cure
  processes. This structure is preserved in the `method` column of the CSV rather than flattened.

## Artifact 2: bacon-curing-formulas.csv

Our own structured re-encoding of all five formula rows above. Every row cites its exact
`9 CFR 424.22(b)(...)` pincite.

## Artifact 3: extracted-text-raw.txt

Full pypdf text extraction of Artifact 1.

## Cross-reference note

Source #6's PDF (CFR-2024-title9-vol2-sec424-21.pdf) independently captured the *beginning* of
§424.22(b)(1) — the pumped-bacon standard formula (120/148/550 ppm) — before cutting off mid-sentence.
That partial overlap is consistent (same numbers, same text) and is not treated as a second independent
source; this folder (#7) holds the complete, authoritative extraction of all five formulas.

## Disagreements this source touches

None. The "200 ppm ceiling" language in source #6 explicitly excepts bacon ("except that nitrites may
be used in bacon only in accordance with paragraph (b)") — so §424.21's 200 ppm ceiling and §424.22's
bacon-specific ppm schedule are not in tension; they are scoped to different product categories by the
regulation's own text.

## Artifact 4 (round 2, 2026-08-02): ecfr-title9-sec424-22.xml — structured XML cross-check

- **Retrieval URL:** `https://www.ecfr.gov/api/versioner/v1/full/2024-01-01/title-9.xml?part=424&section=424.22`
- **Retrieval method:** Node `fetch()` (the versioner API is NOT bot-walled, unlike the `ecfr.gov` human
  site which redirects to `unblock.federalregister.gov` even for node fetch — see source #6's
  PROVENANCE.md for the same distinction)
- **Retrieval timestamp:** 2026-08-02
- **Result:** HTTP 200, 14,574 bytes
- **Extraction method:** `XML`
- **Cross-check result: NO DISAGREEMENT.** All five bacon-formula figures in `bacon-curing-formulas.csv`
  match the XML verbatim: pumped/standard 120 ppm sodium nitrite (148 ppm potassium nitrite equiv.) + 550
  ppm ascorbate/erythorbate; alternative A 100 ppm (123 ppm); alternative B (fermented) 40-80 ppm (49-99
  ppm) + ≥0.7% fermentable carbohydrate; immersion-cured ≤120 ppm (148 ppm); dry-cured ≤200 ppm (246
  ppm). Same TEA nitrosamine testing detail (340°F, 3 min/side, 10 ppb threshold) also matches verbatim.
