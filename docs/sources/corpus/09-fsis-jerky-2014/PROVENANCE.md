# PROVENANCE — #9 · FSIS Jerky Guideline 2014 (humidity as a lethality condition; a_w 0.85/0.91)

## Artifact 1: Compliance-Guideline-Jerky-2014.pdf

- **source_id:** 09
- **Title:** "FSIS Compliance Guideline for Meat and Poultry Jerky Produced by Small and Very Small
  Plants" (2014 revision — the document's own front matter lists changes from the prior 2007 edition:
  calibrating a humidity recorder, clarifying cooking time in humidity options, and documentation for
  humidity support)
- **Publisher:** USDA Food Safety and Inspection Service (FSIS)
- **Edition / date:** 2014 (per filename and internal revision notes; exact publication date not printed
  on the extracted pages checked)
- **Retrieval URL (mirror, since fsis.usda.gov is blocked — HTTP 403 confirmed again this session):**
  https://archive.legmt.gov/content/Committees/Interim/2017-2018/Economic-Affairs/Meetings/Feb-2018/fsis-compliance-guideline-jerky2014.pdf
  (Montana state legislature archive — a committee-meeting exhibit copy of the federal document)
- **Retrieval method:** WebFetch → PDF saved to disk (WebFetch's own reader reported unparseable
  binary, as expected) → `pypdf.PdfReader` local extraction. **Unlike most other PDF-T sources in this
  corpus, pypdf extraction worked cleanly here (135,810 characters from 54 pages) despite the mirror
  host being unrelated to the originating agency** — confirms the brief's retrieval-reality note that
  `pypdf` extraction is independent of which host served the bytes.
- **Retrieval timestamp:** 2026-08-02
- **Source-map rating:** A2 (official FSIS compliance guideline — binding in practice, not statute)
- **Extraction method:** `PDF-T`
- **Pages:** 54
- **Value types covered:**
  - The two water-activity critical limits: **≤0.85 under aerobic conditions, ≤0.91 under anaerobic
    (vacuum-packaged) conditions** — explicitly derived from *Staphylococcus aureus* growth limits with/
    without oxygen (ICMSF, 1996) combined with FSIS's shelf-stability definition. Verbatim: "a water
    activity critical limit of 0.85 or lower should be targeted for products stored in an aerobic or
    oxygen containing environment... if the product will be held in impermeable packaging (creating an
    anaerobic environment)... the water activity critical limit can be 0.91 or lower."
  - The labeling consequence for vacuum-packaged product landing between 0.85 and 0.91 (must be labeled
    "Refrigerate After Opening" per 9 CFR 317.2(k) unless single-serving support exists).
  - **Humidity as a lethality condition** (the second half of this source's assigned scope): the
    document treats relative humidity during the cook/lethality step as a genuine critical operational
    parameter — not merely a comfort setting — because it reduces surface evaporative cooling, keeps the
    product surface closer to the oven's dry-bulb temperature, and thereby is necessary for the
    time-temperature combination to actually achieve its claimed log-reduction. An establishment that
    does NOT add or maintain humidity must document scientific support that humidity is not critical
    for its specific process. This directly answers the source-map's framing of this source's
    contribution ("humidity as a lethality condition").
  - Attachment 2: a large literature-derived table of time/temperature/humidity combinations (multiple
    published studies) claimed to achieve ≥5-log10 reduction of *Salmonella* and *E. coli* O157:H7 in
    beef jerky.
- **What is missing / did not parse:** **Attachment 2's table structure did not survive pypdf's
  column-by-column text extraction cleanly** — the PDF renders it as a grid, and linear text extraction
  interleaves cell contents from different columns/rows in an order that cannot be trusted without
  visual reconstruction. **Only one example row (Buege et al. 2006a, Type 1-A whole-muscle beef jerky)
  was reconstructed with reasonable confidence** by manually re-reading the surrounding text block;
  it is marked `PARTIAL TRANSCRIPTION` in the CSV. The table contains additional reference rows/
  alternative time-temperature-humidity combinations (for other studies and poultry jerky) that are
  **not captured as structured data** — a human with the rendered PDF page open, or an OCR/table-
  extraction tool (not `pypdf`'s linear reader), would be needed to transcribe the rest reliably. This
  is flagged rather than guessed, per the brief's instruction that a partial-and-silent corpus is the
  one unacceptable outcome.

## Artifact 2: superseded-2007-Quick-Guide-Compliance-Guideline.pdf

A secondary WebFetch (from `haccpalliance.org`) returned the **2007** predecessor document ("Updated
Compliance Guideline April 2007... Quick Guide on Processing Jerky") rather than the 2014 edition. Kept
in the folder as a reference copy of the prior version for context (it is explicitly what the 2014
document's own revision notes say it supersedes), but **not used as the primary source** and **not
mined for structured data** — the source map calls for the 2014 edition specifically.

## Artifact 3: water-activity-and-humidity.csv

Structured re-encoding of the a_w limits, the refrigerate-after-opening labeling rule, the humidity
qualitative requirement, and the one reconstructed Attachment 2 example row (flagged partial).

## Artifact 4: extracted-text-raw.txt

Full pypdf text extraction of Artifact 1 (135,810 characters), kept for audit — this is also where a
future pass could attempt a more careful manual transcription of Attachment 2.

## Disagreements this source touches

None of D-1..D-8 directly. This source is the primary authority behind the `a_w 0.85/0.91` figures the
source map cites in §3.7/§10 item 9, and independently confirms them (third read: source-map author's
original verification, this fetch, matches exactly). No new disagreement surfaced.
