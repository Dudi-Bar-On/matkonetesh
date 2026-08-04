opment layer
# matconetesh — core

Project: מתכונת · מדריך האש (matkonetesh) — Hebrew-first RTL, mobile-first, single-file PWA for
live-fire cooking (smoking/BBQ/grilling/sous-vide/charcuterie). ONLINE-FIRST with an AI key (NOT
offline-first — any doc claiming otherwise is stale, per owner decision 2026-07-22).

## Top-level source map
- `app.js` (~9.6k lines, growing — was 9,565 lines/883KB, now 9,648/888KB as of 2026-07-24) — the
  ENTIRE frontend. No framework, no bundler, plain script (897 top-level symbols incl. ~50 anonymous
  callback pseudo-entries; see `mem:tooling/serena_usage` for the exact count method).
- `app.css` (1,710 lines) — styling.
- Python data layer at repo root: `data.py` (1,012 lines), `sources.py` (4,931 lines — citations
  merged into data at build time), plus `descriptions.py`, `equipment_map.py`, `gen_sources.py`,
  `house_rub_map.py`, `sausages_new.py`, `seasoning_tags.py`, `seasonings.py`, `seasonings_ext.py`.
- `build.py` (430 lines) — INLINES app.js + app.css + the Python data layer into `dist/index.html`
  (and a root `index.html`). Both are gitignored BUILD ARTIFACTS — never hand-edit either; edit the
  sources and rebuild.
- `worker/` — a separate small Cloudflare Worker (`index.js`, 91 lines) proxying Gemini calls; its
  own `package.json`/`node_modules`/`wrangler.toml`, independent of the root.
- `tests/` — Playwright suite: 83 `*.spec.ts` files + `_fixtures.ts`. Config at root
  `playwright.config.ts`. `evals/` holds a separate eval-only Playwright config.
- Deploys to Cloudflare Pages (matkonetesh.pages.dev) from `main`; Pages rebuilds from source
  (`build.py`) on push — this takes minutes, never assume a push is instantly live.

## Where the process itself lives
The authoritative discipline is `CLAUDE.md` (repo root) and `docs/process/development-discipline.md`
— READ THOSE. This memory set records only what avoids costly re-discovery, not the process.

## Further memories
- `mem:tech_stack` — languages, build tools, Serena's per-language config status.
- `mem:suggested_commands` — build/test/graph-sync commands + Windows-shell-specific notes.
- `mem:conventions` — Hebrew/RTL rules, safety-value sourcing, secrets boundary, build-artifact rule.
- `mem:task_completion` — pointer to the DoD gate (CLAUDE.md §3), not a duplicate of it.
- `mem:architecture/ai_registry` — GEM_MODELS / AI_THINK / gemFetch / gemGen / gemThink exact
  locations in app.js, and the worker's separate proxy surface.
- `mem:testing/warm_page_fixtures` — the warm/warmContext/warmPage/isolatedPage/page fixture chain,
  `seedApp`, and the `addInitScript` hard-trap in `tests/_fixtures.ts`.
- `mem:tooling/serena_usage` — Serena↔agent-memory↔grep division of labor; status as of 2026-07-24: ALL 8
  configured languages (typescript/python/bash/powershell/toml/yaml/json/html) are live and verified,
  and the root `tsconfig.json` fixed cross-file TS reference search (0 → 234 real refs on `seedApp`).
- `mem:tooling/serena_language_activation` — the exact per-language fix recipe for this sandbox's TLS
  restriction (pyright/shellcheck/taplo/PSES/PSScriptAnalyzer), and the safe restart procedure.
