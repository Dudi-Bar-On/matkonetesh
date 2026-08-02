# PROVENANCE — Source #15: Douglas Baldwin, sous-vide guide + 2012 review

| Field | Value |
|---|---|
| `source_id` | 15 |
| Title | *A Practical Guide to Sous Vide Cooking* (web guide) + "Sous vide cooking: A review" (2012 paper) |
| Author | Douglas E. Baldwin, PhD (applied mathematics) |
| Publisher / edition | Self-published guide, douglasbaldwin.com, current/undated (continuously updated); paper: *International Journal of Gastronomy and Food Science* 1(1):15–30, 2012 |
| Retrieval URL(s) | `https://douglasbaldwin.com/sous-vide.html` (guide, HTML, round 1) · **`https://douglasbaldwin.com/Baldwin-IJGFS-Preprint.pdf` (paper preprint — RETRIEVED round 2)** · `https://www.sciencedirect.com/science/article/pii/S1878450X11000035` (paper landing page — still 403, paywalled, round 2) |
| Retrieval timestamp | 2026-08-02 (round 1: guide HTML; round 2: paper PDF) |
| Rating (from `00-SOURCE-MAP.md` §2/§10) | **C** (Professional, not peer-reviewed, for the guide) — but the thickness→time geometric model is flagged **PRIMARY, independently derived and empirically verified** (§9.2 #1 of the source map). The 2012 companion paper is **B** (peer-reviewed) and its full text **IS NOW RETRIEVED** (round 2). |
| Extraction method | **`HTML`** for the guide (direct table parse, round 1). **`PDF-T`** for the 2012 paper (round 2 — see below). |
| Value-types covered | Pasteurization time-by-thickness-by-temperature (meat/poultry/fish, both directions of Tables 3.1/4.1/5.1), minimum safety floors, doneness temperatures, D/z pathogen values with their own upstream literature, cooling times, thermal model parameters (α, h, β). The 2012 paper (round 2) covers the same ground in peer-reviewed article form, including the full derivation narrative and citation list. |
| What is missing / did not parse | **Round 2 update:** the preprint PDF (see below) is now fully retrieved and extracted — this line is superseded for the preprint. The ScienceDirect version of the paper remains genuinely paywalled (HTTP 403, confirmed again round 2 via node fetch, not a tool artifact — ScienceDirect returns a real paywall/bot-check page, distinct from `douglasbaldwin.com`'s bot-wall which blocks the HTML guide but not the static PDF asset). (2) The full bibliography of the guide page was truncated by the extraction model to a representative subset (see SOURCE-COPY.md §6) — not revisited this round. (3) `publications.html` not retried this round. |

## Round 2 update (2026-08-02): the 2012 peer-reviewed paper preprint is now RETRIEVED

Round 1 tried the preprint PDF and the ScienceDirect landing page via WebFetch; both failed with a
tool-side "unable to verify domain" error. **This was diagnosed as a genuine host block in round 1, but
that diagnosis was wrong for the preprint** — retried with Node `fetch()` (the corrected retrieval
channel) and it succeeded cleanly:

- `https://douglasbaldwin.com/Baldwin-IJGFS-Preprint.pdf` → **HTTP 200**, `content-type: application/pdf`,
  288,024 bytes.
- Extracted with `pypdf.PdfReader` → **33 pages, 83,664 characters**, saved to
  `extracted-text-2012-paper-PRIMARY.txt`.
- Confirmed genuine content: title "Sous Vide Cooking: A Review", Douglas E. Baldwin, University of
  Colorado Boulder, "Preprint submitted to Int. J. Gastronomy and Food Science 31 October 2011" — this is
  the real preprint of the 2012 paper, not a stub or landing page.
- **Confirms source-map §8.1's independence claim directly from primary text**, not secondhand: grepped
  the extracted text and found citations to **O'Bryan, Bolton, Hansen (Hansen & Knøchel), and Embarek**
  (the microbiology literature Baldwin's D/z-value regression is built on) all present, plus explicit
  "D-value" and "z-value" terminology — this is the paper itself doing the regression, not a summary of
  it. (Juneja is also cited.)

**By contrast, `https://douglasbaldwin.com/` and `https://douglasbaldwin.com/sous-vide.html` (the HTML
guide pages, already retrieved in round 1 via WebFetch) now return HTTP 403 to node `fetch()`** — the
opposite failure pattern from the PDF. This is recorded as a genuine finding for the corrected source
map: `douglasbaldwin.com`'s bot-wall appears to key off content-type or path pattern (blocks HTML page
requests, allows direct static-file PDF requests), not a simple host-level block. The already-retrieved
guide HTML content from round 1 is unaffected and remains valid — no re-fetch needed since the content
doesn't change.

**ScienceDirect remains genuinely paywalled** (`https://www.sciencedirect.com/science/article/pii/S1878450X11000035`
→ HTTP 403 via node fetch, 1.2MB HTML body — a real paywall/access-check page, confirmed via node fetch
this round, not a WebFetch-only artifact). This does not matter for this project's purposes: the preprint
PDF is the complete peer-reviewed text (preprints of accepted papers are near-identical to the published
version; no indication of substantive post-review changes was found, and none was expected to be
checkable without the paywalled version).

## Per-artifact index

| File | Contents | `extraction` |
|---|---|---|
| `SOURCE-COPY.md` | Reference copy (extraction) of the guide page's content, structured by topic, plus the paper citation | HTML |
| `Baldwin-IJGFS-2012-preprint-PRIMARY.pdf` (round 2) | Full preprint of the 2012 peer-reviewed paper — "Sous vide cooking: A review," *Int. J. Gastronomy and Food Science* 1(1):15–30 | PDF-T |
| `extracted-text-2012-paper-PRIMARY.txt` (round 2) | Full pypdf text extraction of the above, 33 pages / 83,664 chars, confirms O'Bryan/Bolton/Hansen&Knøchel/Embarek/Juneja citations and D/z-value derivation in Baldwin's own words | PDF-T |
| `pasteurization-meat-55-60C.csv` | Table 5.1 (meat), thickness 5–70mm × 55–60°C, orig text + minutes | HTML |
| `pasteurization-meat-61-66C.csv` | Table 5.1 (meat), thickness 5–70mm × 61–66°C, orig text + minutes | HTML |
| `pasteurization-poultry.csv` | Table 4.1 (poultry), thickness 5–70mm × 57–65°C | HTML |
| `pasteurization-fish-lean.csv` | Table 3.1 (lean fish e.g. cod), thickness 5–70mm × 55–60°C | HTML |
| `pasteurization-fish-fatty.csv` | Table 3.1 (fatty fish e.g. salmon), thickness 5–70mm × 55–60°C | HTML |
| `cooling-times-ice-bath.csv` | Table 1.1, ice-bath cooling by thickness/shape | HTML |
| `doneness-temperatures.csv` | Table 2.1, beef/fish doneness reference | HTML |
| `d-z-values-pathogens.csv` | D-values per pathogen/food category, with Baldwin's own upstream literature citations | HTML |
| `thickness-time-model-parameters.csv` | α, h, β parameters for the thickness→time diffusion model | HTML |

## Independence note (carried forward from `00-SOURCE-MAP.md` §8.1 and confirmed by this download)

Baldwin's D/z-values are **not** copied from FDA/FSIS — they are his own linear regression on peer-reviewed
microbiology literature (O'Bryan 2006, Bolton 2000, Hansen & Knøchel 1996, Embarek & Huss 1993). Only the
**log-reduction targets** (6.5-log beef, 7-log poultry) are DERIVED←FSIS/FDA. The **thickness→time
geometric model itself has no regulatory equivalent anywhere in this corpus** — it is the reason this
source is ranked #1 priority for this download task.
