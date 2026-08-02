# Source copy — Douglas Baldwin, *A Practical Guide to Sous Vide Cooking*

**Retrieved via:** WebFetch (HTML render → markdown extraction), 2026-08-02.
**Canonical URL:** https://douglasbaldwin.com/sous-vide.html
**Note on retrieval method:** the tool does not save a literal HTML/PDF copy of this page to disk (unlike
PDF sources) — it fetches and converts to markdown in one step, and the extraction below is that
conversion output, retained verbatim as our reference copy. This is consistent with the previously
verified working channel for this host (`docs/sources/corpus/00-SOURCE-MAP.md` §1).

An older, narrower extraction of the same page already existed in this repo before this task, dated
2026-07-12: `docs/sources/baldwin-backbone.md`. That extraction is NOT superseded — this folder's tables
are a materially fuller extraction (full thickness/temperature grids for meat/poultry/fish, D/z values,
cooling times, model parameters) pulled directly today and cross-checked against it. Where the two
overlap (doneness temps, safety floors) they agree.

---

## 1. Pasteurization time tables (full grids extracted → see CSVs in this folder)

- `pasteurization-meat-55-60C.csv`, `pasteurization-meat-61-66C.csv` — Table 5.1 in Baldwin's guide.
  Thickness 5–70mm × six temperatures each (55–60°C and 61–66°C), starting at 5°C (41°F). Caption:
  "Time required to reduce Listeria by at least a million to one, Salmonella by at least three million to
  one, and E. coli by at least a hundred thousand to one in thawed meat starting at 41°F (5°C)."
- `pasteurization-poultry.csv` — Table 4.1. Thickness 5–70mm × nine temperatures (57–65°C), from 5°C.
  Caption: "Time required for at least a one million to one reduction in Listeria and a ten million to one
  reduction in Salmonella in poultry starting at 41°F (5°C)."
- `pasteurization-fish-lean.csv`, `pasteurization-fish-fatty.csv` — Table 3.1. Thickness 5–70mm × six
  temperatures (55–60°C), from 5°C, split lean (e.g. cod) vs fatty (e.g. salmon) fish. Caption:
  "Pasteurization times for a one million to one reduction of Listeria in fin-fish."
- `cooling-times-ice-bath.csv` — Table 1.1. Approximate cooling from 130–175°F (55–80°C) to 41°F (5°C) in
  an ice-water bath, by thickness and shape (slab/cylinder/sphere).

All times in the CSVs carry BOTH the original fraction-hour/minute text from the page (`time_orig_at_*`)
and a machine-computed minutes conversion (`time_min_at_*`, ¼=15min, ½=30min, ¾=45min) so the conversion
is auditable against the source text.

## 2. Minimum safe temperature thresholds

- "Most food pathogens stop growing by 122°F (50°C)."
- "You usually cook at 130°F (54.4°C) or higher" (general sous-vide safety floor).
- *Clostridium perfringens* can grow up to 126.1°F (52.3°C) — this is why a lower bound near 130°F/54.4°C
  is treated as the pasteurization floor for meat.

## 3. Doneness reference (Table 2.1) → `doneness-temperatures.csv`

Beef: rare 125°F/50°C, medium-rare 130°F/55°C (note: Baldwin's own text elsewhere gives 54.5°C for
medium-rare — treat 55°C here as the page's rounded Table 2.1 value), medium 140°F/60°C.
Fish: rare 108°F/42°C, medium-rare 122°F/50°C, medium 140°F/60°C.

## 4. D-values / z-values → `d-z-values-pathogens.csv`

Baldwin computes these himself via linear regression on published peer-reviewed thermal-resistance data
— he does NOT take them from FDA/FSIS (see PROVENANCE.md "independence" note, and §8.1 of
`00-SOURCE-MAP.md`, which this download confirms):

- Meat (beef/pork/lamb): E. coli D₅₄.₈₇=19.35min; Salmonella D₅₇.₅₈=13.18min; Listeria D₅₉.₂₂=12.66min.
  Upstream: O'Bryan et al. (2006), Bolton et al. (2000), Hansen & Knøchel (1996).
- Poultry: Salmonella D₆₀=4.68min; Listeria D₆₀=5.94min. Upstream: O'Bryan et al. (2006).
- Fish: lean D₆₀=2.88min; fatty D₆₀=5.13min. Upstream: Embarek & Huss (1993).

## 5. Thermal diffusion model (→ `thickness-time-model-parameters.csv`)

Governing PDE: `∂T/∂t = ∇·(α∇T)`, α ≡ k/(ρCp) = thermal diffusivity (m²/s).
One-dimensional approximation uses a geometric shape factor β (0 = slab, 1 = cylinder, 2 = sphere);
Baldwin uses β=0.28 for a generic 2:3:5 "brick" approximation of a roast/steak shape.
Typical parameter values used: α ≈ 1.1–1.4×10⁻⁷ m²/s (conservative/worst-case, for safety margin);
h (water-bath surface heat transfer coefficient) ≈ 95–155 W/m²K.

Log-reduction integral: `LR = (1/D_ref) ∫₀ᵗ 10^[(T(t')−T_ref)/z] dt'`.

**This thickness→time geometric model is Baldwin's own, independently derived and empirically verified**
(Figure A.1/A.6 in his guide: measured-vs-calculated core temperature for Mahi-Mahi using a needle-probe
thermometer; a separate gel-block experiment with T-type thermocouples per the site's methodology
section). FDA/FSIS supply no equivalent geometric model — this is the single independent contribution the
source map (§9.2) flags as this source's unique value, and it is why source #15 is the highest-priority
target in this task.

## 6. Bibliography (partial, as surfaced by extraction — page is not fully reproduced verbatim)

Cites, among others: Sanz et al. (1987), Singh (1982) — thermal properties of foods; Juneja et al. (2001),
Bolton et al. (2000) — pathogen inactivation kinetics; Church (1998), Creed (1995) — sous vide food safety
and shelf life; Nicolaï & Baerdemaeker (1996) — heat transfer modeling; Belitz et al. (2004), Mottram
(1998) — Maillard chemistry. Also cites FDA Food Code, FSIS pasteurization guidelines, USDA standards
(these are the DERIVED items — see PROVENANCE.md).

## 7. The 2012 peer-reviewed companion paper — citation only, full text NOT retrieved

Baldwin, D.E. (2012). "Sous vide cooking: A review." *International Journal of Gastronomy and Food
Science*, 1(1), 15–30. DOI: 10.1016/j.ijgfs.2011.11.002.

Both the free preprint (`douglasbaldwin.com/Baldwin-IJGFS-Preprint.pdf`) and the ScienceDirect abstract
page returned a WebFetch tool error today ("Unable to verify if domain is safe to fetch") — this happened
on repeated attempts to those two specific URLs, while the main `sous-vide.html` page on the SAME domain
continued to fetch successfully in the same session (confirmed with a second, later fetch of
`sous-vide.html` for its bibliography/credentials section). This looks like a URL- or content-type-scoped
tool-side check (PDF vs HTML, or a specific path), not a host-level block — flagged here rather than
silently treated as "Baldwin 2012 unavailable." Citation and DOI were independently confirmed via
WebSearch (ResearchGate, PubMed-adjacent, ScienceDirect listing all agree on the same citation).
**What is missing:** the paper's own text (methodology detail, any tables beyond what the site's HTML
already reproduces) was not transcribed — only the citation and its existence are established here.
