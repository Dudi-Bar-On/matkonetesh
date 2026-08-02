# PROVENANCE — Source #4: AskUSDA / askFSIS — organ/variety meat

## Source identity
- **source_id:** `04-askusda-variety-meats`
- **Title:** "What is the safe temperature to cook organ meat?" (FSIS Public Q&A Portal knowledge article)
- **Publisher / edition:** USDA Food Safety and Inspection Service. **Site migrated** from the decommissioned
  `ask.usda.gov` (Salesforce Experience Cloud community, retired) to **`ask.fsis.usda.gov`** (new FSIS Public
  Q&A Portal). Article "Last Updated: Aug 12, 2024" per the new site.
- **Rating (source map §2):** A2 — official government guidance; per the source map's own gap analysis
  (**G-H**), this is a **thin** source: one short paragraph, no table, no cited methodology
- **License:** Public Domain
- **extraction:** **`VERBATIM`** (Round 2) — superseding Round 1's `MANUAL`/WebSearch-reconstruction tier

## Retrieval history — Round 1 vs Round 2

**Round 1**: `WebFetch` on the old `ask.usda.gov` URL returned HTTP 503. Fell back to WebSearch synthesis
(paraphrase, not verbatim), corroborated by two independent search-result sets giving the same two numbers
(160°F / 165°F).

**Round 2**: Retried the same old URL with `node fetch` + browser User-Agent — got HTTP 503 again, but this
time the 503 body **was real content** (not a bot-challenge page): it explicitly states *"The ask.usda.gov/s
website is no longer available. For all Food Safety and Inspection Service (FSIS) questions, please use the
FSIS website at ask.fsis.usda.gov."* This resolved the actual cause: the old site is decommissioned, not
transiently down.

Followed the redirect instruction to `ask.fsis.usda.gov`. That site is a **client-side-rendered Lightning
Web Components app** — `node fetch` and even direct browser navigation to the deep-linked article URL both
returned an "Invalid Page" shell (the app doesn't server-render individual article routes directly; deep
links 404 even though the app itself works). Resolved by using **Playwright** (`browser_navigate` to site
root, then using the in-app "Search for answers..." box with the query "organ meat temperature", which
surfaced the article in the live search results list), then clicking through to the article page, which DOES
render its content client-side once reached via in-app navigation.

- **Confirmed live URL:** `https://ask.fsis.usda.gov/article/What-is-the-safe-temperature-to-cook-organ-meat`
- **Retrieved:** 2026-08-02, via Playwright browser navigation + accessibility snapshot (verbatim text
  captured from the rendered DOM) and a full-page screenshot as visual evidence.
- **Last Updated (per site):** Aug 12, 2024.

## Artifacts in this folder

| File | Contents | `extraction` |
|---|---|---|
| `askusda-organ-meat-rendered.html` | Full rendered DOM (`document.documentElement.outerHTML`) captured via Playwright after client-side render completed | VERBATIM |
| `askusda-organ-meat-article.png` | Full-page screenshot of the rendered article, visual evidence | VERBATIM |
| `organ-meat-temps.csv` | Two rows: 160°F red-meat organs, 165°F poultry giblets, now with verbatim sentences quoted in the `notes` column | VERBATIM |

## Verbatim article text (captured via Playwright accessibility snapshot of the rendered page)

> "Organs, such as kidney, liver, stomach, tongue, and tripe, from red meats (beef, veal, pork, or lamb)
> should be cooked to a minimum internal temperature of 160 °F as measured with a food thermometer. Poultry
> livers and other giblets should reach a safe minimum internal temperature of 165 °F as measured with a
> food thermometer."

## Cross-check against Round 1

Round 1's WebSearch-reconstructed values (160°F beef/pork/lamb organs, 165°F poultry giblets) **both
matched exactly**. Round 1 additionally guessed the covered organ list as "heart, kidney, liver, tongue,
chitterlings" (5 items) — the verbatim text actually names **kidney, liver, stomach, tongue, tripe** (5
items, different set — Round 1 substituted heart/chitterlings for stomach/tripe, which the article does NOT
explicitly name). This is now corrected: the article names 5 specific organs, and does not explicitly cover
heart or chitterlings by name — any coverage of those two in the app's 12-item organ-meat category rests on
analogy to "organs... from red meats" as a class, not on this article's explicit text, and should be flagged
as such wherever `data.py`/`sources.py` cite this source for those two specific items.

## What is still missing

- **Whether all 12 organ-meat items in `data.py`** are covered by this article's explicit wording — NOT
  resolved, and now sharper than Round 1's finding: the article names exactly 5 red-meat organs (kidney,
  liver, stomach, tongue, tripe) plus "poultry livers and other giblets" (poultry, unitemized beyond liver).
  Any of the app's 12 items outside this named list (e.g., heart, chitterlings, sweetbreads, brain) are
  covered only by inference from the general category language, not by explicit naming in this source.
- **Any methodology, citation, or table** — confirmed still absent; the verbatim article is a two-sentence
  answer with no supporting data, consistent with the source map's G-H "thin source" finding.

## Disagreement note

This source directly underlies **G-H** ("`safe` for organ meats (12 items): the source exists but is very
thin — one sentence on AskUSDA, no table, no published rationale. 160°F contradicts the 145°F whole-muscle
rule (FSIS treats organs as non-intact meat)"). Round 2 **sharpens but does not resolve** G-H: the article
is now verbatim-confirmed as genuinely thin (two sentences, no citation), and the organ list it explicitly
covers is now known precisely (5 named + "giblets"), which narrows — but does not close — the gap for the
7 of 12 app items not explicitly named. No bearing on the 94°C brisket disagreement.
