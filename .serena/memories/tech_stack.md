# matconetesh — tech stack

- **Frontend**: vanilla JS in `app.js` (no framework, no bundler). `package.json` sets
  `"type": "commonjs"` but app.js itself runs directly in-browser via the inlined `dist/index.html`
  (no import/export machinery to speak of — it's one big script).
- **Styling**: `app.css`, plain CSS (no preprocessor).
- **Data/build layer**: Python. `.python-version` pins 3.12; the system interpreter measured 3.10.4
  at last check (2026-07-23 serena-adoption.md) — do not assume `pyright`/Serena's Python LS resolves
  the pinned 3.12 without checking. Serena's own Python LS now runs a plain `npm install -g pyright`
  copy directly (see `mem:tooling/serena_language_activation`), not the pinned-1.1.403-via-uv default.
- **Serverless proxy**: Cloudflare Worker, `worker/index.js` (91 lines) — `wrangler` deploy, own
  `package.json`/`vitest.config.mjs`/`worker/test/`.
- **Tests**: `@playwright/test` `^1.61.1` only — no other test framework at the root (the worker has
  its own `vitest` for its own tests, typecheck disabled by default so it's unaffected by any tsconfig
  change). `npm test` → `playwright test`.
- **`tsconfig.json`** (root, added 2026-07-24): minimal — `allowJs, checkJs:false, noEmit, skipLibCheck,
  target:ES2020, lib:[ES2020,DOM,DOM.Iterable]`, `include: [app.js, serve.js, worker/*.js, tests/**/*.ts]`.
  Exists SOLELY so tsserver (Serena's TS backend) can build one cross-file program — Playwright itself
  only ever reads `allowJs`/`baseUrl`/`paths`/`references` from a tsconfig (verified against Playwright's
  own docs) and none of `baseUrl`/`paths` are set, so `npx playwright test` behavior is provably
  unaffected (`--list` unchanged at 438 tests/86 files, `python build.py` byte-count unchanged, both
  before/after — see `docs/process/serena-first-use.md` "Issues resolved"). Also picked up by
  `evals/playwright.config.ts` (no closer tsconfig of its own) — harmless for the same reason.

## Serena language servers — ALL 8 configured languages ACTIVE as of 2026-07-24
`.serena/project.yml` `languages:` = `typescript, python, bash, powershell, toml, yaml, json, html`.
Full per-language fix recipe, evidence, and one known non-fatal caveat (toml's own runtime schema-
catalog fetch): `mem:tooling/serena_language_activation`. Summary status/verification table, the
"why not all languages activate on their own" structural findings (no project.yml watcher; a full
restart is fail-fast/all-or-nothing; `ls_specific_settings` needs project TRUST), and the safe restart
procedure: `mem:tooling/serena_usage`. Deliberately still EXCLUDES `markdown` (130 files) — docs are
graphify's job per CLAUDE.md §10.17, not Serena's.
