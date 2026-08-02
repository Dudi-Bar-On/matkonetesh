# PROVENANCE — Source #2: FSIS Appendix A (2021 Cooking Guideline)

## Source identity
- **source_id:** `02-fsis-appendix-a-2021`
- **Title:** FSIS Cooking Guideline for Meat and Poultry Products (Revised Appendix A)
- **Publisher / edition:** USDA Food Safety and Inspection Service, effective 2021-12-14 (replaces 1999/2017 versions)
- **Rating (source map §2):** A2 — official government guidance; "does not have the force and effect of law" (document's own preface) but is the accepted HACCP scientific support
- **License:** Public Domain (U.S. federal government work)

## Artifacts in this folder and their retrieval

| File | Retrieval URL | Retrieved | Method | Pages |
|---|---|---|---|---|
| `fsis-appendix-a-2021.pdf` | `https://www.ncagr.gov/meat-poultry-inspection/Appendix-A12-2021/download?attachment=` | 2026-08-02 | `WebFetch` → saved to disk → `pypdf` text extraction | 92 |
| `extracted-text.txt` | (derived from above) | 2026-08-02 | `pypdf` full-text extraction, all 92 pages | — |
| `table2-source-page35.png`, `table3-source-page37.png`, `table4-source-page38.png` | (derived from PDF above) | 2026-08-02 (Round 2) | `pymupdf` (`fitz`) page render at 4x scale (2448×3168 / 3168×2448 px), one page per table — the actual images OCR-transcribed for the CSVs below; kept as visual evidence per the OCR-2PASS-AGREE claim | p.35, p.37, p.38 |

This is the North Carolina Dept. of Agriculture mirror named in the source map as verified-working (`ncagr.gov`); confirmed working again today.

## Structured data extracted

| File | value_type(s) | Covers |
|---|---|---|
| `table1-humidity-options.csv` | `other` (critical operating parameter, not a temp/time target itself) | Table 1, p.26 — the 4 FSIS Relative Humidity Options and their paired endpoint-temp/cook-time conditions. **Extracted verbatim and completely** — this table rendered as real text, not an image. |
| `extracted-facts.csv` | `safe`, `other` | Meat-table instant-lethality footnote (158°F), poultry instant-lethality footnote + the chicken/turkey species split, cooked-poultry-roll floors (160°F uncured / 155°F cured), CUT 6-hour limit, 12%-fat reference note, 2014 Jerky Guideline wet-bulb figures |
| `table2-meat-lethality.csv` | `safe` | Table 2, p.35 — 6.5-log and 7-log Salmonella lethality dwell time by endpoint temperature (130–160°F), meat products. **31 of 31 rows, `OCR-GEMINI`, 2-pass, 31/31 agree.** |
| `table3-chicken-lethality.csv` | `safe` | Table 3, p.37 — 7-log Salmonella lethality dwell time by endpoint temperature (136–165°F) × fat content (1–12%), chicken products. **30 of 30 rows, `OCR-GEMINI`, 2-pass, 30/30 agree.** |
| `table4-turkey-lethality.csv` | `safe` | Table 4, p.38 — 7-log Salmonella lethality dwell time by endpoint temperature (136–165°F) × fat content (1–12%), turkey products. **30 of 30 rows, `OCR-GEMINI`, 2-pass, 30/30 agree.** |

## Round 2 — Tables 2/3/4 extracted via OCR-GEMINI, verified two-pass

**Method.** `pypdf` confirmed (Round 1) that Tables 2/3/4 are single-page image grids (p.35, p.37, p.38
respectively — one table per page, no continuation pages; confirmed by re-extracting text on the surrounding
pages 34–40 and finding each table's caption, footnotes, and the *next* table's caption with nothing in
between). Installed `pymupdf` (network-available via `pip`, unlike `curl`) and rendered each of the three
pages to a 4x-scale PNG (2448×3168 / 3168×2448 px). The rendered PNGs were legible enough for **direct visual
transcription** (read by the agent performing this task) and were independently transcribed a **second time**
by **Gemini 3.6 Flash** via the `generateContent` API (`inline_data`, `image/png`, `maxOutputTokens: 8192`,
`temperature: 0`), run **twice** (two independent API calls, same prompt, same image) to produce two
machine-transcription passes.

**Verification — three-way, not just two-pass.** (1) Gemini pass 1 vs Gemini pass 2: diffed programmatically
(`diff` on the raw CSV text) — **zero byte differences across all three tables, all rows.** (2) Both Gemini
passes vs the agent's own direct visual read of the same rendered PNGs: manually cross-checked row-by-row
during transcription — no discrepancies found. (3) Cross-checked against Round 1's footnote-derived facts
(`extracted-facts.csv`): the footnote states 158°F = 0 sec instant lethality for Table 2 — **confirmed**,
rows 158/159/160°F all read `0 sec.**`. The Cooked Poultry Rolls section (p.39) states the 160°F dwell time
"vary[s]... between 13.7 to 26.9 seconds depending on species and fat" — **confirmed exactly**: Table 3
(chicken) 160°F/1%-fat = 13.7 sec (the low end), Table 4 (turkey) 160°F/12%-fat = 26.9 sec (the high end).
The 12%-fat reference note (poultry products with unknown/higher fat may use the 12% column) is consistent
with 12% being the rightmost/highest column in both poultry tables.

**Result: every row in all three tables carries `confidence=OCR-2PASS-AGREE`. Zero rows are `OCR-DISAGREE`
or `UNVERIFIED`.** Coverage: Table 2 — 31/31 rows (130–160°F, meat, 6.5-log and 7-log columns). Table 3 —
30/30 rows (136–165°F, chicken, columns for 1–12% fat = 12 fat columns). Table 4 — 30/30 rows (136–165°F,
turkey, same 12 fat columns). Total: **91 of 91 grid rows transcribed and verified**, 0 unread, 0 disputed.

**What remains genuinely out of scope (not attempted, not claimed as covered):** Table 5 (p.43, Scientific
Gaps) and Table 6 (p.59, 5-Log alternative target) — still not attempted, lower priority per the source
map's minimal-set framing; this document's unique contribution to the corpus (the chicken/turkey species
split) is now fully captured in Tables 3/4 above.

**Correction to Round 1's framing:** Round 1 stated "a retrieval success is not the same as a parse
success" as the central finding of this source. Round 2 confirms that framing was correct for `pypdf`
specifically, but the gap was closeable — with `pymupdf` for rendering plus a vision-capable model for
transcription, the entire numeric content of these three image-based tables was recovered and verified.

## Disagreement note

No bearing on the 94°C brisket disagreement (G-B/D-8) — this document only ever specifies pathogen-lethality floors, never a doneness/texture target. Sharpens **D-4** (chicken: "165°F immediate" vs. "Appendix A itself permits ~60°C for tens of minutes for the same 7-log"): confirmed this document is genuinely time-temperature-parametric for poultry (two full species tables), not merely a single instantaneous floor — the "165°F now" consumer-facing number and this document's slower alternatives are both real and both FSIS-published, for different audiences (consumer chart vs. HACCP-system operators).

## Controller audit findings (final assembly pass, 2026-08-02/03)

**1. Missing RH-eligibility column — added.** The source page draws a blue box around every row whose
endpoint temperature is ≥145°F, and a footnote on each of the three tables states that only those boxed
rows are eligible for FSIS Relative Humidity Options 1 and 2 (all rows, boxed or not, may use Options 3
and 4 — see p.26). Confirmed by reading `extracted-text.txt` directly:
- Table 2 (meat, p.35): **footnote 6** — *"Time-Temperatures ≥ 145°F (in blue square) are eligible for
  FSIS Relative Humidity Options 1 and 2. All time-temperatures may apply FSIS Relative Humidity Options
  3 and 4 (page 26)."*
- Table 3 (chicken, p.37): **footnote 9**, identical wording.
- Table 4 (turkey, p.38): **footnote 12**, identical wording.

**Table 2 carries the same qualifier as Tables 3/4 — it was not a poultry-only rule.** The controller
added a `rh_options_1_2_eligible` column (`yes` for °F ≥ 145, `no` below) to all three CSVs:
`table2-meat-lethality.csv`, `table3-chicken-lethality.csv`, `table4-turkey-lethality.csv`. This was
absent from the Round-2 OCR extraction — the OCR passes captured the temp×fat×time grid but not this
regulatory eligibility flag, which lives in the footnote text, not the table image.

**2. Fat-axis rounding anomalies — confirmed present in the FSIS source itself, not an OCR error.**
Three rows show a small (0.1 min) *decrease* in dwell time moving to a higher (more conservative) fat
column, which is physically counter-intuitive (higher fat should need ≥ as much time, never less) but is
not a transcription mistake:
- `table3-chicken-lethality.csv` row 151°F: fat1=2.1 min → fat2=2 min (dip), fat3=2 min, fat4=2.1 min.
- `table4-turkey-lethality.csv` row 150°F: fat1=3.8 min → fat2/fat3/fat4=3.7 min (dip).
- `table4-turkey-lethality.csv` row 151°F: fat1=3 min → fat2–fat5=2.9 min (dip).

The controller opened `table3-source-page37.png` and `table4-source-page38.png` directly and read the
printed values at those cells — the dips are present in the rendered source page itself, i.e. they are
FSIS's own rounding artifacts (the underlying continuous lethality curve rounded to one decimal place at
each column independently), not an OCR misread. **No further re-investigation of these three cells is
needed** — do not re-open this as a suspected extraction error.
