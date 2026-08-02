# PROVENANCE — #6 · 9 CFR §424.21 (Curing Agents, 200 ppm ceiling)

## Artifact 1: CFR-2024-title9-vol2-sec424-21.pdf

- **source_id:** 06
- **Title:** Code of Federal Regulations, Title 9 (Animals and Animal Products), Chapter III, Part 424,
  §424.21 "Use of food ingredients and sources of radiation" (annual edition)
- **Publisher:** U.S. Government Publishing Office (GPO), for the Food Safety and Inspection Service (FSIS), USDA
- **Edition / date:** 9 CFR Ch. III, 1-1-24 Edition (as amended through 84 FR 65268, Nov. 27, 2019)
- **Retrieval URL:** https://www.govinfo.gov/content/pkg/CFR-2024-title9-vol2/pdf/CFR-2024-title9-vol2-sec424-21.pdf
- **Retrieval method:** WebFetch (saved PDF to disk; tool could not parse binary content itself) →
  `pypdf.PdfReader` extracted text locally, no network required for extraction
- **Retrieval timestamp:** 2026-08-02 (session timestamp ~22:26 local, per tool-result filename `webfetch-1785699161307-...`)
- **Source-map rating:** A1 (binding legislation — the regulatory text itself)
- **Extraction method:** `PDF-T`
- **Pages:** 22 (this single PDF, contrary to its filename, extends past §424.21 into the start of
  §424.22(b)(1)(i) — the govinfo page-range boundary did not align exactly with the section boundary.
  The tail of §424.22 was separately retrieved — see source #7's own PROVENANCE.md — because this PDF
  cuts off mid-sentence at "Presumptive positive results" before reaching the full bacon ppm table)
- **Value types covered:** Full "Curing Agents" chart under §424.21(c) — substance, purpose, products,
  and amount columns for nitrate/nitrite curing agents, plus the general 200 ppm finished-product
  nitrite ceiling statement. Also covers dozens of unrelated food-ingredient entries (acidifiers,
  antioxidants, denuding agents, etc.) not needed for this project's data model but preserved in the
  reference copy for completeness.
- **What is missing / did not parse:** The PDF text extraction is otherwise complete and clean (pypdf
  handled it fully, unlike WebFetch's own built-in reader which reported the binary as unparseable —
  this is expected per the brief: WebFetch saves the PDF even when its own summarizer fails). No
  numeric content is missing for §424.21. Some fraction/OCR artifacts appear (e.g. "7⁄8 oz", "2 3⁄4 oz")
  where the PDF's unicode fraction glyphs render oddly in plain-text extraction — verified against the
  raw text in `extracted-text-raw.txt` and transcribed correctly into the CSV.

## Artifact 2: curing-agents-table.csv

Our own structured re-encoding of the two Curing Agents rows (nitrate, nitrite) from Artifact 1,
including the 200 ppm ceiling note. Derived entirely from Artifact 1; same provenance chain.
Every row cites `9 CFR 424.21(c)` as `cfr_pincite`.

## Artifact 3: extracted-text-raw.txt

Full pypdf text extraction of Artifact 1, kept as an intermediate/audit trail so the CSV's transcription
can be checked against the source text without re-fetching.

## Disagreements this source touches

None directly (the 200 ppm ceiling is stated without controversy). It is the CFR-side anchor for the
CFIA nitrite-floor comparison in source #11's PROVENANCE (9 CFR sets a ceiling only; CFIA separately
sets a floor — these are complementary, not conflicting, per source-map §5/§8.3).

## Artifact 4 (round 2, 2026-08-02): ecfr-title9-sec424-21.xml — structured XML cross-check

Per round-2 Job 3: pulled the authoritative, date-versioned eCFR text through the eCFR **versioner API**
(distinct from the `ecfr.gov` human-facing website, which is bot-walled to `unblock.federalregister.gov`
— the API endpoint is NOT bot-walled and is reachable via node `fetch`, unlike round 1's WebFetch-based
attempts).

- **Retrieval URL:** `https://www.ecfr.gov/api/versioner/v1/full/2024-01-01/title-9.xml?part=424&section=424.21`
- **Retrieval method:** Node `fetch()` → raw XML saved directly to disk (no PDF/pypdf step needed —
  structured XML is a strictly better extraction format than PDF-T)
- **Retrieval timestamp:** 2026-08-02
- **Result:** HTTP 200, 123,214 bytes
- **Extraction method:** `XML` (upgrade from `PDF-T`)
- **Cross-check result: NO DISAGREEMENT.** The XML's Curing Agents table (rows for "Sodium or potassium
  nitrate" and "Sodium or potassium nitrite") matches `curing-agents-table.csv` **verbatim**, including
  the exact figures (7 lb/100 gal pickle, 3½ oz/100 lb dry cure, 2¾ oz/100 lb chopped for nitrate; 2
  lb/100 gal pickle at 10% pump, 1 oz/100 lb dry cure, ¼ oz/100 lb chopped, 200 ppm finished-product
  ceiling for nitrite) and the same `9 CFR 424.21(c)` pincite. This is reported as a finding per the
  brief's instruction to report disagreements loudly and agreements plainly — **the govinfo PDF and the
  eCFR structured API independently agree.**
