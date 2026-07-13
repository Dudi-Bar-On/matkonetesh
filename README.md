# מתכונת · מדריך האש (Matkonet)

Hebrew-first (RTL) PWA for fire cooking — sous-vide, smoking, grilling, and charcuterie. A single
generated `index.html` runs in any browser, fully local-first (all user data in `localStorage`).
Catalog of **279 items**: 130 cuts, 47 specials (cheese/cured/sausage/bacon), 102 build-from-scratch makes.

## Architecture — single source of truth: `build.py`
The whole app (HTML/CSS/JS) lives in `build.py` as Python strings. **Never edit `index.html` — it is generated.**

```bash
python build.py            # data.py + friends + sources.py -> index.html
```

Dependencies imported by `build.py`: `data.py` (CUTS/SPECIALS/GLOSSARY/BUILDS/MAKES),
`seasonings*.py`, `seasoning_tags.py`, `house_rub_map.py`, `sausages_new.py`, `descriptions.py`,
and `sources.py` (cited sources + order-effect + grill + make cure-overrides, merged at build time).

## Source verification (v147)
Every catalog item carries a cited source (`src`) shown in-app under "📚 מקורות ואימות". Sources are
generated into `sources.py` from the research provenance in `scratch/research/*.json`:

```bash
python gen_sources.py      # scratch/research/*.json -> sources.py + a value-change report
```

See `docs/REVIEW-v147.md` for the full change log, `docs/sources/` for the source protocol and the
Baldwin pasteurization backbone (the P3 safety reference).

## Tests
```bash
npm install                # first time
npx playwright test        # build -> serve -> browser: smoke + data-integrity (safety) checks
```

## Deploy — Cloudflare Pages
Live at **https://matkonetesh.pages.dev**. `python build.py` emits a clean **`dist/`** — `index.html`
plus the flattened `site/` assets (manifest, icons, product.html) and **no `.py` source**. That folder
is the entire deploy.

**Git-connected auto-deploy (recommended):** in Cloudflare Pages, connect this GitHub repo with:
| Setting | Value |
|---|---|
| Build command | `python build.py` |
| Build output directory | `dist` |
| Python version | pinned by `.python-version` (3.12); build.py has no pip dependencies |

Every push to `main` rebuilds and redeploys.

**Manual:** `python build.py`, then upload the **contents of `dist/`** via the Cloudflare Pages
dashboard (Workers & Pages → project → Create deployment → Upload assets), or `npx wrangler pages deploy dist`.

## Safety principle (P3)
Salt/cure/pasteurization/temperature safety numbers always come from a cited primary source
(Baldwin, AmazingRibs, Marianski, USDA FSIS) — never guessed. Unfound values are marked `UNVERIFIED`.
