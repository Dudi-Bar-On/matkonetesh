# PROVENANCE — Source #18: AmazingRibs.com / Prof. Greg Blonder

| Field | Value |
|---|---|
| `source_id` | 18 |
| Title | "What Causes The BBQ Stall: It's Not What You Think" · "What You Need to Know About Wood, Smoke, And Combustion" · (bonus) "Resting Meat: Why I Don't Believe The Hype" |
| Author | Meathead Goldwyn (site founder/author of record), reporting Prof. Greg Blonder's original experiments (stall article); Goldwyn's own material (wood, resting articles) |
| Publisher / edition | AmazingRibs.com. Stall article last-modified 2026-07-20; wood/smoke article last-modified 2026-07-22; resting article last-modified 2026-07-21 (all per page metadata at retrieval time — this site is continuously maintained, not a fixed edition) |
| Retrieval URLs | `https://amazingribs.com/more-technique-and-science/more-cooking-science/understanding-and-beating-barbecue-stall/` · `https://amazingribs.com/more-technique-and-science/grill-and-smoker-setup-and-firing/science-of-wood-and-smoke/` · `https://amazingribs.com/more-technique-and-science/more-cooking-science/science-of-resting-meat/` |
| Retrieval timestamp | 2026-08-02 |
| Rating (source map §2/§10) | **D+** — "measured craft" (מלאכה מדודה): commercial/artisan source, but backed by original experiments, not just consensus. **Not A/B** — the source map's gap G-A (smoking duration has no authoritative source at all) stands even with this download; D+ is a ranked best-available, not an upgrade to regulatory/peer-reviewed status. |
| Extraction method | **`MANUAL`** as classified in `00-SOURCE-MAP.md` #18, though retrieval itself was `HTML` (WebFetch succeeded directly against this host — no PDF/paywall involved). Marking MANUAL because the source is prose/narrative, not a structured table on the page; the CSVs here are hand-built from the fetched prose. |
| Value-types covered | The stall mechanism (evaporative cooling) with Blonder's own experimental temperature data; wood type → smoke intensity/heat/spark/ember characteristics; combustion-stage temperature ranges; wood composition and smoking parameters (moisture, quantity, penetration depth); (bonus) quantitative resting-meat juice-loss comparisons |
| What is missing / did not parse | (1) The stall article's claimed "several hours (6+ observed)" duration data is qualitative, not tabulated by weight/cut — no smh/soh (smoke-hours by weight) table exists on this page or anywhere else the search reached, which is consistent with and reconfirms source-map gap **G-A** (no source, of any rating, gives smoking duration by weight). (2) The wood-type table extracted here (6 wood types) is a subset the extraction returned — the live page may contain additional wood types (e.g. maple, alder, walnut mentioned only in WebSearch snippets, not confirmed present in the fetched table) not captured. (3) No numeric PAH/creosote-composition data was found on the wood/smoke page — only qualitative discussion — so this source does NOT supply data for the regulatory PAH values (those are sourced elsewhere, #14 EU 2023/915, out of this task's scope). |

## Per-artifact index

| File | Contents | `extraction` |
|---|---|---|
| `SOURCE-COPY.md` | Full narrative extraction of all three articles | MANUAL |
| `stall-experiment-data.csv` | Blonder's oven/water-bowl stall-temperature experiment | MANUAL |
| `pork-shoulder-wrap-trial.csv` | Foil-wrap vs unwrapped pork shoulder trial | MANUAL |
| `wood-type-table.csv` | Wood type vs smoke/heat/spark/ember characteristics (6 types) | MANUAL |
| `combustion-stages.csv` | 4-stage combustion temperature model | MANUAL |
| `wood-smoking-parameters.csv` | Composition %, BTU yield, moisture targets, quantities, penetration depth | MANUAL |
| `resting-meat-data.csv` | Bonus: Blonder + López-Alt juice-loss measurements, rested vs unrested | MANUAL |

## Relevance to gaps/disagreements this source was tasked to cover

- **G-A (smoking duration, no source at all):** reconfirmed, not closed. This remains the single best
  available source for `smh`/`soh` per the source map, and it still supplies no weight-based duration
  table — only qualitative stall-duration language.
- **G-C (wood-to-meat pairing, no authority):** reconfirmed. The article's own words — "smoke flavor is
  influenced more by climate and soil and oxygen availability than wood species" — argue against treating
  even this D+ source as settling species-pairing.
- **D-7 (does extended resting do anything?):** the bonus resting article is Blonder/Goldwyn's side of a
  within-craft dispute against BBQ resting orthodoxy; captured for completeness, not required by #18's
  core cell.
