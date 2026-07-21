# Nitrite dosing: when is a kitchen scale too coarse?

**Date:** 2026-07-21
**Purpose:** derive a defensible, quantitative warning threshold for the app's cure-dosing flow.
**Scope:** Cure #1 / Prague Powder #1 (6.25% sodium nitrite), home dry-cure at 2.5 g/kg meat.

---

## 0. TL;DR

> **Warn hard when the computed cure dose is below 5 × the scale's readability (`d`).**
> **Show an advisory when it is below 20 × `d`.**

At `cureRate = 2.5 g/kg` this means:

| Scale | Hard warn below | Advisory below |
|---|---|---|
| 1 g | 2.0 kg meat | 8.0 kg meat |
| 0.1 g | 0.2 kg meat | 0.8 kg meat |
| 0.01 g | 0.02 kg meat | 0.08 kg meat |

The `20 × d` advisory tier is **directly sourced** (NIST Handbook 44). The `5 × d` hard tier is
**derived** from metrology plus regulatory headroom, and involves a judgment call on the
acceptable band (±20%). Both are laid out below.

---

## 1. Regulatory ingoing-nitrite limits

### 1.1 USDA FSIS (United States)

The operative regulation is **9 CFR 424.21(c)**, table of permitted food ingredients, "Curing
Agents". The regulation states the permitted amounts as mass-per-mass rather than ppm:

> "Sodium or potassium nitrite … **2 lb to 100 gal pickle at 10 percent pump level; 1 oz to 100 lb
> meat or poultry product (dry cure); 1/4 oz to 100 lb chopped meat**, meat byproduct or poultry
> product."
>
> — [9 CFR 424.21, via Cornell LII](https://www.law.cornell.edu/cfr/text/9/424.21)

Converting to ppm of sodium nitrite on the green meat block:

| Product class | Regulation's own units | Ingoing ppm NaNO₂ |
|---|---|---|
| Comminuted (chopped/ground, sausage) | ¼ oz per 100 lb | **156 ppm** |
| Immersion cured / pumped / massaged | 2 lb per 100 gal pickle @ 10% pump | **200 ppm** |
| Dry cured (non-bacon) | 1 oz per 100 lb | **625 ppm** |

*(Check: 0.25 oz × 28.3495 g/oz ÷ 45 359.2 g = 156.3 ppm. 1 oz ÷ 100 lb = 625 ppm.)*

The same section imposes a **finished-product** ceiling:

> "The use of nitrites, nitrates or combination **shall not result in more than 200 ppm of nitrite,
> calculated as sodium nitrite in finished product**, except that nitrites may be used in bacon only
> in accordance with paragraph (b) of this section."
>
> — [9 CFR 424.21](https://www.law.cornell.edu/cfr/text/9/424.21)

**Bacon is special-cased** in 9 CFR 424.22(b), and is the only place a US regulator states a
*required* level rather than a maximum:

> Pumped/massaged bacon: "sodium nitrite **shall be used at 120 parts per million (ppm) ingoing** or
> an equivalent amount of potassium nitrite shall be used (148 ppm ingoing)"
> Immersion cured bacon: "Sodium nitrite **shall not exceed 120 ppm ingoing**…"
> Dry cured bacon: "Sodium nitrite **shall not exceed 200 ppm ingoing**…"
>
> — [9 CFR 424.22, via Cornell LII](https://www.law.cornell.edu/cfr/text/9/424.22)

FSIS's own worked-calculation reference is
[FSIS Directive 7620.3, *Processing Inspectors' Calculations Handbook*](https://www.fsis.usda.gov/sites/default/files/media_file/2020-07/7620.3.pdf)
(the PDF blocks automated fetch; the figures above were taken from the CFR primary text instead and
are consistent with the Directive as quoted in secondary sources).

### 1.2 EU (E 249 / E 250) — and why this matters for an Israeli user

Limits are set in Annex II of Regulation (EC) No 1333/2008, **as amended by
[Commission Regulation (EU) 2023/2108](https://eur-lex.europa.eu/eli/reg/2023/2108/oj/eng)**, which
tightened them with effect from **9 October 2025**.

| Food category | Until 9 Oct 2025 | From 9 Oct 2025 | New limit expressed as NaNO₂ |
|---|---|---|---|
| 08.3.1 non-heat-treated meat products | 150 mg/kg | **80 mg/kg** | ~120 mg/kg |
| 08.3.2 heat-treated, sterilised (Fo > 3.00) | 100 mg/kg | **55 mg/kg** | ~82 mg/kg |
| 08.3.2 heat-treated, other | 150 mg/kg | **80 mg/kg** | ~120 mg/kg |
| 08.3.4 traditionally cured (named products) | various | **100–105 mg/kg** | ~150–157 mg/kg |

Critically, the EU figures are **expressed as nitrite ion (NO₂⁻)**, not as sodium nitrite —
footnote (XC): *"The maximum amount that may be added during the manufacturing expressed as NO₂
ion."* Conversion factor is MW(NaNO₂)/MW(NO₂⁻) = 69.0/46.0 = 1.5.

- 80 mg/kg as NO₂⁻ × 1.5 = **120 mg/kg as NaNO₂**
- Our 156 ppm target as NaNO₂ = 156 × (46/69) = **104 mg/kg as NO₂⁻**

**Therefore: the standard 2.5 g/kg dose (156 ppm NaNO₂ = 104 ppm as ion) EXCEEDS the current
general EU limit of 80 mg/kg.** It is compliant only under category 08.3.4 (traditionally cured
named products, 100–105 mg/kg as ion). This is a real, substantive conflict between the US and EU
frames — see §7.

Corroboration of the conversion and dates:
[Mérieux NutriSciences](https://www.merieuxnutrisciences.com/new-reduced-limits-for-the-use-of-nitrites-and-nitrates-as-food-additives/),
[Heraxfood](https://www.heraxfood.com/en/news/lower-maximum-levels-of-nitrites-applicable-from-9-october-2025-).

### 1.3 Israel

**Not established.** Israel's food-additive rules sit under the Public Health (Food) (Food
Additives) Regulations administered by the Ministry of Health
([food additives unit](https://www.gov.il/he/departments/units/fcs-food-additives)). I could not
locate a published Israeli-specific ingoing-nitrite ppm table. Israeli food standards are broadly
harmonised toward EU norms, so the EU figures are the more likely governing set — but **this is an
inference, not a sourced finding**, and should not be presented to users as Israeli law.

---

## 2. How much error is actually tolerable?

**This is the crux, and the honest answer is: no authority publishes a tolerance band.**

Every source found states a **maximum** (and, for US bacon only, a single **required** level). None
of USDA FSIS, the EU, or any extension service publishes an acceptable-variance figure for ingoing
nitrite in home or small-scale production. There is no "156 ± X ppm" anywhere in the literature.

So a tolerance must be **constructed** from the distance between the target and the nearest
boundary a regulator or the microbiology literature actually cares about.

### 2.1 Upward headroom (over-dosing → nitrite toxicity, nitrosamines)

| Boundary | ppm | Headroom from 156 ppm |
|---|---|---|
| USDA comminuted ingoing max | 156 | **0%** |
| USDA finished-product ceiling (424.21) | 200 | **+28%** |
| USDA dry-cured bacon max | 200 | **+28%** |
| USDA dry-cured non-bacon max | 625 | +300% |
| EU general (from Oct 2025), as NaNO₂ | 120 | **−23% (already exceeded)** |

Tightest *credible* upward boundary for a dry-cure at 156 ppm: **+28%** (the 200 ppm USDA ceiling).
Under EU rules there is no upward headroom at all — you start over the line.

### 2.2 Downward headroom (under-dosing → *C. botulinum*)

| Boundary | ppm | Headroom from 156 ppm |
|---|---|---|
| USDA *required* ingoing level for pumped/massaged bacon | 120 | **−23%** |
| "Meat needs at least 75 ppm … for any meaningful curing" ([meatsandsausages.com](https://www.meatsandsausages.com/drying-preservation/preserving-meat/curing)) | 75 | −52% |
| Lower bound of reliable inhibition in the review literature | 72 | −54% |
| Demonstrated inadequate | 60 | −62% |

On the microbiology, the most useful published statement is from a peer-reviewed review:

> "*C. botulinum* did not grow in the presence of **72 to 150 ppm nitrite** irrespective of pH,
> levels of sodium chloride, levels of sodium lactate, or temperature." … "in the presence of
> **60 ppm nitrite**, growth of *C. botulinum* was increased at pH > 6, higher storage temperatures,
> and lower concentrations of sodium chloride and sodium lactate."
>
> — [Microbiological safety of processed meat products formulated with low nitrite concentration — A review, *Asian-Australas J Anim Sci* (PMC6043430)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6043430/)

Note the important caveat that inhibition is **not a fixed threshold** — it is conditional on spore
load, pH, salt, temperature, and the presence of erythorbate/lactate. A home curer controls few of
these well, which argues for treating the *regulatory* floor (120 ppm) rather than the
*microbiological* floor (72 ppm) as the operative boundary.

### 2.3 The band adopted

The narrowest sourced boundary in each direction is:

- **Down: 120 ppm** → −23% (USDA's mandated bacon level; the only "you must have at least this much"
  figure any regulator publishes)
- **Up: 200 ppm** → +28% (USDA finished-product ceiling)

**Adopted tolerance: ±20%** — a round number that sits inside both. **This is engineering judgment**,
not a sourced tolerance. It is deliberately the tighter of the two bounds.

---

## 3. Scale metrology

### 3.1 Readability is not accuracy

> "Scale readability is the smallest increment the displayed weight can change as weight is added to
> or removed from the scale." … "Just because a scale shows more decimal places doesn't mean the
> measurement is correct."
>
> — [Accurate Western Scale, Readability vs Accuracy](https://accuratewesternscale.com/news-and-events/scales-faqs-what-is-the-difference-between-readability-and-accuracy/)

> "Linearity and repeatability are the most common specifications used when determining and
> comparing accuracy between scales or balances."
>
> — [Adam Equipment, "What is Accuracy?"](https://adamequipment.com/content/post/what-is-accuracy/)

So total error = quantization + repeatability + linearity + drift + off-centre load. Readability `d`
sets only the *floor*.

### 3.2 Quantization floor: ±1 d in a real tare-and-add workflow

A single reading rounds to the nearest division: ±0.5 `d`. But weighing cure means **tare the bowl,
then add cure** — two quantized events (the tare zero and the final reading). Worst-case combined
quantization is therefore **±1 `d`**, and that is before any instrument error at all.

### 3.3 Legal-metrology tolerances (NIST Handbook 44)

For a Class III scale (the class covering commercial/kitchen platform scales),
[NIST Handbook 44 (2023), §2.20 Scales](https://www.nist.gov/system/files/documents/2023/01/28/2-20-23-HB44.pdf),
Table 6 *Maintenance Tolerances* (values in scale divisions):

| Class | 1 d | 2 d | 3 d | 5 d |
|---|---|---|---|---|
| III | 0–500 | 501–2 000 | 2 001–4 000 | 4 001+ |

and T.N.3.2: *"The acceptance tolerance values shall be one-half the maintenance tolerance values."*

So at small loads a legal-for-trade Class III scale may legitimately be off by **±1 d** (maintenance)
on top of quantization. A **±1 d total** working uncertainty is therefore a *generous* assumption for
an uncertified kitchen scale, not a conservative one. We use ±1 d as the model; reality is worse.

### 3.4 The established "minimum load" concept — this is the key transfer

**NIST Handbook 44 has exactly the concept we need**, and states the rationale explicitly:

> **UR.3.1. Recommended Minimum Load.** — "A recommended minimum load is specified in Table 8 **since
> the use of a device to weigh light loads is likely to result in relatively large errors**."
>
> **Table 8. Recommended Minimum Load** (in scale divisions d or e)
> | Class | Value of scale division | Recommended minimum load |
> |---|---|---|
> | I | ≥ 0.001 g | 100 |
> | II | 0.001 g to 0.05 g, inclusive | 20 |
> | II | ≥ 0.1 g | 50 |
> | **III** | **All** | **20** |
> | III L | All | 50 |
> | IIII | All | 10 |
>
> — [NIST Handbook 44 (2023) §2.20, UR.3.1](https://www.nist.gov/system/files/documents/2023/01/28/2-20-23-HB44.pdf)

**Class III → minimum load = 20 d.** This is a directly-sourced, on-point number: a national
metrology institute stating that weighing below 20 divisions gives "relatively large errors."

Note the internal consistency: at exactly 20 d, a ±1 d uncertainty is ±5%. NIST's rule is
effectively a 5%-relative-error criterion.

### 3.5 USP <41> — the pharmaceutical analogue (and why it doesn't transfer)

> "Repeatability is satisfactory if two times the standard deviation of the weighed value, divided by
> the desired smallest net weight … does not exceed **0.10%**. **If the standard deviation obtained is
> less than 0.41d, where d is the scale interval, replace this standard deviation with 0.41d.** In
> this case, repeatability is satisfactory if 2 × 0.41d, divided by the desired smallest net weight,
> does not exceed 0.10%."
>
> — [USP General Chapter <41> Balances](https://www.uspnf.com/sites/default/files/usp_pdf/EN/USPNF/41_balances.pdf)

Rearranged, the minimum weight is:

```
W_min = 2 × 0.41 d / 0.001 = 820 d
```

That 0.41 d floor is the standard deviation of a uniform rounding distribution (1/√6 ≈ 0.408) —
i.e. USP is encoding exactly the quantization argument from §3.2.

**But 820 d is a 0.1%-accuracy criterion, appropriate to pharmaceutical assay, not to cure dosing.**
On a 1 g scale it would demand an 820 g cure dose (328 kg of meat). It is the right *framework* and
the wrong *tolerance*. What it gives us is the general form:

```
W_min = 2 × 0.41 d / (allowed relative error)
```

which is the derivation engine for §4.

---

## 4. What the charcuterie authorities actually say

Searched: Marianski (*Home Production of Quality Meats and Sausages* / meatsandsausages.com),
Ruhlman & Polcyn (*Charcuterie*), AmazingRibs/Meathead, MSU / Mississippi State extension,
eatcuredmeat.com.

**Finding: they are unanimous that a 0.1 g scale is needed, and not one of them gives a quantitative
rule.** No source found states a minimum dose, a minimum batch size, or a dose-to-resolution ratio.

| Source | What it says | Quantitative rule? |
|---|---|---|
| [meatsandsausages.com (Marianski)](https://www.meatsandsausages.com/drying-preservation/preserving-meat/curing) | "adding 156 ppm of sodium nitrite (**2.5 g of Cure #1 per 1 kg of meat**) would be a good starting point"; "meat needs at least **75 ppm** of sodium nitrite for any meaningful curing" | **No** — silent on scale precision entirely |
| [AmazingRibs / Meathead](https://amazingribs.com/tested-recipes/salting-brining-curing-and-injecting/curing-meats-safely/) | "We recommend **150 ppm** of sodium nitrite but just about any number between **100 and 200** will work"; "200 ppm is the maximum recommended by food safety experts"; "Measuring spoons can vary as much as **20%** for dry measures"; "it is best if you use weights rather than volumes" | **No** — no scale resolution figure |
| [eatcuredmeat.com](https://eatcuredmeat.com/dry-curing/what-how-pink-curing-salt/) | "I prefer a scale that reads to at least **0.1 g**, and for very small batches, **0.01 g** is even better" | **No** — a preference, not a rule |
| Ruhlman & Polcyn, *Charcuterie* | Recipes given in volume (tsp/Tbsp); practitioners widely recommend converting to 0.25% by weight | **No** |
| [MSU Extension](https://www.canr.msu.edu/news/additives_have_legal_limits_in_cured_meat_products) | Restates the legal ppm limits by product class | **No** |

Two things worth lifting from this table:

1. **AmazingRibs is the only source giving an explicit acceptable *range*: "100 to 200" ppm.** That
   is a practitioner band, not a regulatory one, but it corroborates the ±20–28% construction in §2.3
   remarkably well (100–200 around a 150 target is −33%/+33%).
2. AmazingRibs quantifies **measuring-spoon error at 20%** — the very error magnitude we are treating
   as the outer limit of acceptability. A 1 g scale used on a 1 kg batch is *no better than a
   measuring spoon* (see §6).

---

## 5. The derived rule

### 5.1 Setup

- Cure #1 nitrite fraction `f` = 0.0625
- Cure rate `r` = 2.5 g/kg → 2.5 × 0.0625 × 1000 = **156.25 ppm** ✓
- Batch mass `M` kg → dose `D = r × M` grams
- Working uncertainty on the dose `U = ±1 d` (§3.2; generous — ignores linearity and drift)
- Relative dose error `ε = U / D = d / (r × M)`

### 5.2 Hard threshold — from the ±20% band

Require `ε ≤ 0.20`:

```
        d / D  ≤  0.20
             D  ≥  d / 0.20
             D  ≥  5 d
```

> **HARD WARN when dose D < 5 × d.**

Equivalently, minimum batch mass `M_min = 5d / r`.

Cross-check via the USP form with a 20% criterion instead of 0.1%:
`W_min = 2 × 0.41 d / 0.20 = 4.1 d` — the same answer to within rounding. The two derivations agree.

### 5.3 Advisory threshold — straight from NIST

> **ADVISORY when dose D < 20 × d** — below NIST Handbook 44's recommended minimum load for a
> Class III device (§3.4). Corresponds to ε ≤ 5%.

This tier requires no judgment call at all; it is quoted.

### 5.4 General form for the app

```js
// d = scale readability in grams; r = cureRate in g/kg; M = batch mass in kg
const dose = r * M;
if (dose < 5  * d) → BLOCK / hard warn   // ε > 20%
else if (dose < 20 * d) → advisory        // ε > 5%, below NIST minimum load
```

Minimum batch mass: `M_min = N × d / r`.

---

## 6. Sanity check against real batches (`cureRate = 2.5 g/kg`)

### On a 1 g scale (`5d = 5 g`, `20d = 20 g`)

| Batch | Dose | Rel. error | Verdict |
|---|---|---|---|
| 0.5 kg | 1.25 g | ±80% | **HARD WARN** |
| 1 kg | 2.50 g | ±40% | **HARD WARN** |
| 2 kg | 5.00 g | ±20% | borderline (at threshold) |
| 5 kg | 12.50 g | ±8% | advisory |
| 10 kg | 25.00 g | ±4% | clean |

### On a 0.1 g scale (`5d = 0.5 g`, `20d = 2 g`)

| Batch | Dose | Rel. error | Verdict |
|---|---|---|---|
| 0.5 kg | 1.25 g | ±8% | advisory |
| 1 kg | 2.50 g | ±4% | clean |
| 2 kg | 5.00 g | ±2% | clean |
| 5 kg | 12.50 g | ±0.8% | clean |
| 10 kg | 25.00 g | ±0.4% | clean |

### Is the rule too strict to be useful? No — and here is why

**The rule discriminates exactly where it should.** It fires on essentially every realistic home
batch *on a 1 g scale*, and essentially never on a 0.1 g scale. That is not over-firing — it is the
rule correctly reporting that **a 1 g scale genuinely cannot dose cure for home-sized batches.**

The concrete demonstration, for 1 kg of meat on a 1 g scale (target dose 2.5 g, which the scale
cannot even display):

| User does | True mass range (±1 d) | Resulting ppm | Assessment |
|---|---|---|---|
| Rounds down, displays "2 g" | 1.5 – 2.5 g | **94 – 156 ppm** | bottom of range is below USDA's 120 ppm bacon floor and near the 72 ppm reliability edge |
| Rounds up, displays "3 g" | 2.5 – 3.5 g | **156 – 219 ppm** | top of range **breaches the 200 ppm USDA ceiling** |

There is no safe choice available. The user cannot hit 156 ppm at all, and both available options
put them outside a published limit in one direction or the other. **The warning is correct and
actionable**: the remedy is "use a 0.1 g scale" or "scale the batch up to ≥ 2 kg", both of which the
app can suggest directly.

Advisory-tier behaviour is also reasonable: on a 1 g scale it stays on until 8 kg, which honestly
reflects NIST's position; on a 0.1 g scale it clears at 800 g, so a typical 1 kg+ batch shows nothing.

---

## 7. Sourced vs judgment — explicit split

### Sourced (quote-backed, primary where possible)

| Claim | Source |
|---|---|
| Comminuted 156 ppm / immersion-pumped 200 ppm / dry-cured 625 ppm ingoing | 9 CFR 424.21 |
| 200 ppm finished-product ceiling | 9 CFR 424.21 |
| Bacon: 120 ppm required (pumped/massaged), 120 max (immersion), 200 max (dry) | 9 CFR 424.22(b) |
| EU 80 mg/kg as NO₂⁻ from 9 Oct 2025; 100–105 for traditional cured | Reg. (EU) 2023/2108 |
| NaNO₂ ↔ NO₂⁻ conversion factor 1.5 | Molecular weights (69.0 / 46.0) |
| **Class III recommended minimum load = 20 d**, "light loads … likely to result in relatively large errors" | NIST HB 44 §2.20 UR.3.1, Table 8 |
| Class III maintenance tolerance 1 d at 0–500 d; acceptance = ½ maintenance | NIST HB 44 §2.20 Table 6, T.N.3.2 |
| USP minimum-weight framework; 0.41 d rounding floor; 0.10% criterion | USP <41> |
| *C. botulinum* inhibited at 72–150 ppm; 60 ppm inadequate; inhibition is condition-dependent | PMC6043430 review |
| 75 ppm minimum for "meaningful curing"; 2.5 g/kg = 156 ppm | meatsandsausages.com |
| Practitioner acceptable range "100 to 200" ppm; spoons vary ~20% | AmazingRibs |
| Practitioners recommend 0.1 g scales | eatcuredmeat.com, and consensus |

### Judgment (mine — defensible but not sourced)

| Decision | Rationale | Sensitivity |
|---|---|---|
| **±20% tolerance band** | Narrowest sourced boundaries are −23% (120 ppm bacon floor) and +28% (200 ppm ceiling); 20% sits inside both | If you chose ±25%, threshold becomes 4 d; ±10% → 10 d. The rule is roughly linear in the choice. |
| **±1 d working uncertainty** | Tare-then-add is two quantized events; also matches Class III maintenance tolerance | Using ±0.5 d halves the threshold to 2.5 d; using ±2 d doubles it to 10 d |
| **Two tiers rather than one** | 20 d is sourced but fires constantly on 1 g scales; 5 d is the actionable safety line | — |
| **Treating 120 ppm rather than 72 ppm as the practical floor** | 72 ppm is conditional on pH/salt/temp that home curers don't control; 120 ppm is what a regulator mandates | Using 72 ppm would widen the band to −54% and loosen the rule considerably |
| Israel likely follows EU norms | Israeli food standards broadly harmonise to EU; **no Israeli nitrite table located** | Do not present as law to users |

---

## 8. Where sources genuinely disagree or are silent

1. **Silent: nobody publishes a tolerance band for ingoing nitrite.** Regulators publish maxima
   (and, for US bacon alone, one mandated level). There is no official "156 ± X ppm". Any tolerance
   in this app is constructed, and should be described as such internally.

2. **Silent: no charcuterie authority gives a quantitative scale rule.** Marianski, Ruhlman & Polcyn,
   AmazingRibs and the extension services all either recommend a 0.1 g scale without justification or
   don't mention scales at all. The `N × d` rule has **no practitioner precedent** — it is ours.

3. **Disagreement: US vs EU, and it is material.** The universally-taught home dose of 2.5 g/kg
   (156 ppm NaNO₂ = 104 ppm as NO₂⁻) is *exactly at* the US comminuted maximum but **30% over** the
   general EU maximum of 80 mg/kg as ion (in force since 9 Oct 2025). It is compliant under EU
   category 08.3.4 (traditionally cured) at 100–105 mg/kg. **For an Israeli user plausibly under
   EU-harmonised rules, the app's default cure rate may itself be non-compliant** — this is a
   product-level question separate from the scale threshold, and worth raising.

4. **Disagreement: how much nitrite botulinum control actually needs.** 60 ppm inadequate / 72 ppm
   sufficient (PMC review) vs 75 ppm "meaningful curing" (Marianski) vs 120 ppm mandated (USDA bacon)
   vs "100–200 will work" (AmazingRibs). Spread of roughly 2×. The review is explicit that this is
   condition-dependent rather than a fixed threshold, which explains the spread but does not resolve
   it.

5. **Caveat on the metrology transfer.** NIST HB 44 and OIML R 76 govern *legal-for-trade* scales.
   Most home kitchen scales are not NTEP/OIML certified, so the tolerances in §3.3 are **best-case**
   assumptions for the hardware users actually own. The real error on a $15 kitchen scale at 3 g is
   plausibly worse than ±1 d, which makes the derived rule, if anything, slightly permissive.

---

## 9. References

- [9 CFR 424.21 — Use of food ingredients and sources of radiation](https://www.law.cornell.edu/cfr/text/9/424.21)
- [9 CFR 424.22 — Certain other permitted uses (bacon)](https://www.law.cornell.edu/cfr/text/9/424.22)
- [FSIS Directive 7620.3 — Processing Inspectors' Calculations Handbook](https://www.fsis.usda.gov/sites/default/files/media_file/2020-07/7620.3.pdf)
- [Commission Regulation (EU) 2023/2108](https://eur-lex.europa.eu/eli/reg/2023/2108/oj/eng)
- [NIST Handbook 44 (2023), §2.20 Scales](https://www.nist.gov/system/files/documents/2023/01/28/2-20-23-HB44.pdf)
- [USP General Chapter <41> Balances](https://www.uspnf.com/sites/default/files/usp_pdf/EN/USPNF/41_balances.pdf)
- [Microbiological safety of processed meat products formulated with low nitrite concentration — A review (PMC6043430)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6043430/)
- [meatsandsausages.com — Curing (Marianski)](https://www.meatsandsausages.com/drying-preservation/preserving-meat/curing)
- [AmazingRibs — The Science Of Curing Meats Safely](https://amazingribs.com/tested-recipes/salting-brining-curing-and-injecting/curing-meats-safely/)
- [eatcuredmeat.com — Pink Curing Salt: Cure #1 vs Cure #2](https://eatcuredmeat.com/dry-curing/what-how-pink-curing-salt/)
- [MSU Extension — Additives have legal limits in cured meat products](https://www.canr.msu.edu/news/additives_have_legal_limits_in_cured_meat_products)
- [Accurate Western Scale — Readability vs Accuracy](https://accuratewesternscale.com/news-and-events/scales-faqs-what-is-the-difference-between-readability-and-accuracy/)
- [Adam Equipment — What is Accuracy?](https://adamequipment.com/content/post/what-is-accuracy/)
