# PROVENANCE — #11 · CFIA — nitrite floor ONLY (100 ppm + 2.5% salt)

**Scope note (binding, from the brief):** this source is retrieved for the **nitrite floor only**.
Degree-hours from CFIA was explicitly deleted from this project's minimal-19 set as a unit conversion
of the FSIS/AMI-1997 number (source-map §8.3, "D-2 ❌ ... הופרך היום. זו המרת יחידות") — it is NOT
re-captured as structured data here, even though the source pages contain it. See sources #8, #9, #10.

## Artifact 1: extracted-text-nitrites-page.txt

- **source_id:** 11
- **Title:** "Preventive control recommendations on the use of nitrites in the curing of meat products"
- **Publisher:** Canadian Food Inspection Agency (CFIA), Government of Canada
- **Edition / date:** current live page as of retrieval (no version/date stamp visible on page; CFIA
  guidance pages are living documents without a fixed "edition")
- **Retrieval URL:** https://inspection.canada.ca/en/preventive-controls/meat/nitrites
- **Retrieval method:** WebFetch (two separate prompts against the same URL, both converted to markdown
  and summarized by WebFetch's internal model — HTML sources have no analogous "save raw file to disk"
  path the way PDFs do; this is the tool's standard behavior for HTML, confirmed empirically here)
- **Retrieval timestamp:** 2026-08-02
- **Source-map rating:** A2 (official government guidance, binding in practice but not statute)
- **Extraction method:** `HTML`
- **Value types covered:** The 100 ppm minimum ("at least 100 p.p.m. ... to be labelled 'cured'"), and
  (for completeness/context, not the primary target of this source but confirmed present) the maximum
  ceilings: 200 ppm standard, 120 ppm side bacon, and the dry-rub-on-racks exception (62g nitrite/186g
  nitrate per 100kg, stated as a mass ratio not converted to ppm by CFIA).
- **What is missing / did not parse:** No minimum-salt percentage appears on this specific page — that
  figure lives on the sibling "fermented-and-dried" page (Artifact 2). Two independent extraction passes
  with differently-worded prompts against the same URL returned consistent numbers both times, which is
  the best corroboration available without a raw-HTML diff tool.

## Artifact 2: extracted-text-fermented-dried-page.txt

- **source_id:** 11
- **Title:** "Preventive control recommendations for manufacturing fermented and dried meat products"
- **Publisher:** CFIA
- **Retrieval URL:** https://inspection.canada.ca/en/preventive-controls/meat/fermented-and-dried
- **Retrieval method:** WebFetch, same caveats as Artifact 1
- **Retrieval timestamp:** 2026-08-02
- **Source-map rating:** A2
- **Extraction method:** `HTML`
- **Value types covered:** The paired floor — verbatim: **"nitrite/nitrate are added at a minimum level
  of 100 ppm along with a minimum of 2.5% of salt"** (to prevent *Clostridium botulinum* outgrowth in
  fermented meat products). This is the exact sentence the source map (§10 item 11) points to.
- **What is missing / did not parse:** This page also contains the CFIA degree-hours restatement
  (665/555/500 at <33°C/33-37°C/>37°C, matching source-map §8.3's confirmed unit conversion of FSIS's
  1200/1000/900 °F-degree-hours) plus E. coli/Salmonella lethality options and dried-product heat
  treatment (71°C/15s) and shelf-stability pH/a_w thresholds (≤4.6 or a_w≤0.85, or pH≤5.3 with
  a_w≤0.90). **All of these are deliberately NOT captured as this source's structured CSV data** — they
  are out of this source's assigned scope (nitrite floor only) and, for degree-hours specifically, are
  redundant with source #10 (AMI 1997) per the explicit source-map ruling. They are recorded in the
  extracted-text file only as context/audit trail, flagged as out-of-scope inline.

## Artifact 3: nitrite-floor.csv

Structured data: the 100 ppm floor (both the "cured" labeling threshold and the paired C. botulinum
floor), the paired 2.5% salt minimum, and — for completeness of what §424.21's ceiling is being compared
against — the three CFIA maximum ceilings (200 ppm standard / 120 ppm side bacon / dry-rub exception).

## Disagreements this source touches

**D-2 (degree-hours "gap"), already resolved in the source map, not reopened here.** Confirms again
(third independent read of the same CFIA text, after the source-map author's own read) that the CFIA
page states degree-hours in °C above 15.6°C with breakpoints 665/555/500 — consistent with the
source map's arithmetic (1200°F-dh / 1.8 = 666.7 ≈ 665, etc.). No new disagreement found. The nitrite
floor itself (100 ppm + 2.5% salt) has **no US equivalent to compare against** — 9 CFR (#6/#7) sets
ceilings only, never a floor — so there is nothing to reconcile or dispute for the floor value; CFIA is
simply the sole source for it in this corpus, which is exactly why the source map keeps it in the
minimal 19 despite deleting its degree-hours content.
