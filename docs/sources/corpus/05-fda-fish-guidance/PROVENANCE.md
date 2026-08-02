# PROVENANCE — Source #5: FDA Fish & Fishery Products Hazards and Controls Guidance

## Source identity
- **source_id:** `05-fda-fish-guidance`
- **Title:** Fish and Fishery Products Hazards and Controls Guidance, 4th Edition (also circulated under a "SGR 129" course-material label by the mirror host)
- **Publisher / edition:** FDA CFSAN. The mirror obtained is labeled "March 2020" version; the source map notes a "June 2022" edition also exists at the (blocked) `fda.gov/media/80637/download` URL. **Edition mismatch flagged** — see below.
- **Rating (source map §2):** A2 — official government guidance
- **License:** Public Domain
- **extraction (per source map):** `PDF-T`, "מראה נדרשת" (a mirror is required, since fda.gov is blocked)

## Artifacts in this folder and their retrieval

| File | Retrieval URL | Retrieved | Method | Pages |
|---|---|---|---|---|
| `fda-fish-fishery-hazards-guidance-4th-ed-mirror.pdf` | `https://www.cdr.wisc.edu/assets/pipeline-pdfs/2.5-Seafood-Hazard-Guide-v4-March-2020.pdf` (University of Wisconsin Center for Dairy Research / seafood-HACCP training pipeline, found via WebSearch) | 2026-08-02 | `WebFetch` → saved to disk → `pypdf` text extraction | 498 |
| `extracted-text.txt` | (derived) | 2026-08-02 | `pypdf` full-text, all 498 pages | — |

**Blocked, per source map, not re-attempted:** `https://www.fda.gov/media/80637/download` (the June 2022 edition FDA names as current).

**Edition caveat, stated plainly:** the artifact obtained is filenamed "v4-March-2020" by the mirror host. The source map's target was the "June 2022" edition. Both are the "4th Edition" (the edition number covers the document's structural revision; FDA has issued dated addenda/updates within that same 4th-edition numbering — e.g., the March 2020 date likely reflects the last full reissue prior to a 2022 update). **The specific numeric values extracted below (50ppm histamine, freezing parameters) are long-standing figures in this guidance and are not among the values FDA's 2022 update is known to have changed** (per the WebSearch results reviewed, the 2022 update's summary-of-changes emphasis was elsewhere), but this was not independently verified against a 2022-dated copy of the text, because none was retrievable. Flagging this rather than presenting it as confirmed-current.

## Structured data extracted

`histamine-and-parasite-tables.csv`:
- **Histamine/scombrotoxin action level:** 50 ppm (single/uncomposited sample), 17 ppm (per-unit action point for 20×3-fish composited samples) — Chapter 7
- **Parasite destruction by freezing** — three FDA-specified equivalent methods: (a) -20°C/-4°F ambient for 7 days total; (b) -35°C/-31°F ambient until solid then -20°C/-4°F for 24 hours; (c) -35°C/-31°F ambient for 15 hours total (blast freezer route)
- **Vessel-chilling control point:** internal fish temp ≤15.6°C/60°F if time from catch to processor chilling is 12 to <15 hours (a histamine-formation control, not a cooking temperature — flagged as such in the CSV `notes` column so it isn't mistaken for a `safe` cook temperature)
- **Decomposition/histamine hold-time table** (partial): 7 days at 31.3-41°F, 1 day at 42°F+ — the extraction was cut off before the table's remaining rows (additional temperature brackets almost certainly exist above 42°F, e.g. for higher ambient temperatures); **only the first two rows were located and confirmed**, the rest of this specific table is `MISSING`.

## What is missing or did not parse

1. **Edition currency** — see caveat above; a 2022-dated primary copy was not obtainable (fda.gov blocked).
2. **The decomposition hold-time table beyond the first two rows** (temperatures above 42°F) — not located in the extracted text; would require either further grep of the 498-page extraction (not exhausted — only the first two rows were searched for and found) or the image/table itself if it is graphic.
3. **No cooking-temperature/lethality table specific to fish** (equivalent to Appendix A's meat/poultry tables) was searched for in this pass — the source map indicates fish `safe` values in `data.py` derive primarily from the Food Code's 145°F/15s general floor (source #1) and this document's role is specifically parasites/histamine/toxins, which is what was extracted. If a fish-specific cooking-temperature table exists in this document, it was not located in this session.

## Disagreement note

No bearing on the 94°C brisket disagreement. This source is the sole primary-source anchor for two `data.py` value-types the source map flagged as otherwise sourceless for fish (parasite destruction, histamine limits) — confirms the source map's characterization of this document as "the only source for fish/shellfish" for these specific hazard types, and now backs it with actual extracted numbers rather than a citation alone.
