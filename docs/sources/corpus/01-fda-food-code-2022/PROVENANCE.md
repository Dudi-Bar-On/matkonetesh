# PROVENANCE — Source #1: FDA Food Code 2022 + Annexes

## Source identity
- **source_id:** `01-fda-food-code-2022`
- **Title:** FDA Food Code 2022 (Food and Drug Administration, U.S. Public Health Service)
- **Publisher / edition:** FDA/PHS, 2022 edition
- **Rating (source map §2):** A2 — official government guidance/model code, not itself binding law but adopted by reference in most U.S. state food codes
- **License:** Public Domain (U.S. federal government work)

## Artifacts in this folder and their retrieval

| File | Retrieval URL | Retrieved | Method | Pages | What it covers |
|---|---|---|---|---|---|
| `fda-food-code-2022-westhartford-mirror.pdf` + `-extracted.txt` | `https://resources.finalsite.net/images/v1677677402/westhartfordctgov/mjnko1bu5at9njpwuueb/2022FDAFoodCode.pdf` (West Hartford, CT government mirror, found via WebSearch) | 2026-08-02 | `WebFetch` → saved to disk → `pypdf` text extraction | 181 | Full Food Code body: Chapter 1 (Table A/B TCS pH×aw classification), Chapter 3 §3-401.11(B) full Table 3-2 roast ladder, §3-401.13 plant-food hot-holding, §3-401.11(A) other cooking floors |
| `fda-food-code-2022-chapter3.pdf` + `-extracted.txt` | `https://www.c-uphd.org/documents/eh/2022-FDA-Food-Code-Chapter-3-Food.pdf` (Clarion Univ PA / c-uphd.org mirror, Chapter 3 only) | 2026-08-02 | `WebFetch` → saved to disk → `pypdf` | 41 | Chapter 3 only — used to cross-confirm §3-401.13 (135°F plant-food hot-holding) wording |
| `fda-food-code-2022-main.pdf` + `extracted-text-main.txt` | `https://portal.ct.gov/-/media/departments-and-agencies/dph/dph/foodprotection/2022-fda-food-code/guide-3b-2022-fda-food-code.pdf` | 2026-08-02 | `WebFetch` → saved to disk → `pypdf` | 37 | CT DPH "Guide 3B" — a **summary/inspection-guide document**, not the Food Code itself. Kept as reference copy only; NOT used as a data source (references section numbers but does not carry the underlying tables) |

**Attempted and failed:** `https://portal.ct.gov/-/media/Departments-and-Agencies/DPH/dph/FoodProtection/2022-FDA-Food-Code/2022-FDA-Annexes-from-1-18-23-version.pdf` (the full 487-page Annexes document referenced by the source map as previously verified) — **3 consecutive `ECONNRESET` failures via WebFetch today**, no file saved. This is the document that would carry Annex 3's TCS tables in their canonical location and Annex 7 model forms. **Not obtained.** Substituted by the West Hartford mirror, which carries the equivalent Table A/B content in Chapter 1's TCS-food definition (same numbers, different location in the document — verified textually identical structure).

## Structured data extracted

| File | value_type(s) | Source section | Extraction method |
|---|---|---|---|
| `table-3-2-roast-cooking.csv` | `safe` | §3-401.11(B)(1), the 130°F/112min → 158°F/instant ladder for whole beef/pork/lamb/cured-pork roasts | `PDF-T` — full text match, verbatim table rows |
| `other-safe-values.csv` | `safe`, `rest`, `other` | §3-401.11(A)(1)-(3), §3-401.13, §3-401.11(C), oven-temp-by-weight table | `PDF-T` |
| `tcs-classification-table-a-b.csv` | (classification, not a `safe` temp) | Chapter 1 definitions, "Time/Temperature Control for Safety Food" — Table A and Table B (pH × water-activity interaction grids) | `PDF-T` — full text match, all cells transcribed |

## What is missing or did not parse

1. **The full 487-page Annexes document was not retrieved** (see above — 3× `ECONNRESET`). Annex 1 (Compliance and Enforcement), Annex 4 (bibliography), and Annex 6 (HACCP guidance) are therefore **not** in this folder. The specific tables the brief and source map called out (Table 3-2, Tables A/B) **were** recovered via the West Hartford mirror, which contains the full Food Code body (not just annexes).
2. The CT "Guide 3B" document is a state inspection-guide summary, not primary Food Code text — kept only as a tertiary reference, not used for any extracted value.
3. No table cells were image-only in the documents actually parsed — text extraction was complete and clean for all three artifacts used as data sources.

## Disagreement note (§10.16 / brief clause "never settle silently")

This source bears on **D-3** (three different `safe` numbers for beef: FSIS consumer chart 145°F+3min vs. Food Code §3-401.11(A) 145°F/15sec for steaks vs. Food Code §3-401.11(B) 130°F/112min ladder for whole roasts). Confirms the source map's account: **all three are genuine, non-contradictory entries in the same document set** — the Food Code itself provides both the instant-doneness floor (145°F/15s, for steaks/fillets) and the slow-cook ladder down to 130°F (for whole roasts), which is exactly why a single `safe` field cannot hold all three without a qualifier. This source does **not** bear on the 94°C brisket disagreement (G-B/D-8) — the Food Code has no `tgt`/texture concept, only lethality floors. That disagreement remains unsettled and outside this task's scope (sources #6-19 own the Modernist Cuisine/AmazingRibs side of it).
