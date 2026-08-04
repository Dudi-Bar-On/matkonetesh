# matconetesh — commands

- **Build**: `python build.py` — regenerates `dist/index.html` (+ root `index.html`), both gitignored
  build artifacts. Never hand-edit either; edit `app.js`/`app.css`/`data.py`/`sources.py`/etc.
- **Full test suite**: `npx playwright test` — plain, no flags. `playwright.config.ts` pins
  `workers: process.env.CI ? 2 : 8`, `retries: 0`. NEVER pass `--workers` or `--retries` (masks
  flakes / changes reliability characteristics — CLAUDE.md §11a, L10).
- **Manual local server**: `node serve.js <port>` (default 8123). Playwright's own `webServer` starts
  and tears down its OWN instance per run — do not run a manual server during `npx playwright test`
  (port collision, `reuseExistingServer:false`). After every `python build.py`, RESTART any manual
  `serve.js` — it caches `dist/` in memory at startup, so a rebuild never reaches an already-running
  manual server.
- **Docs/memory sync**: `bash scripts/sync-docs.sh "<commit message>"` — syncs the agent-memory
  store, verifies it, stages docs/scripts/src + CLAUDE.md, commits and pushes. Refuses to push on a
  stale store.
- **Agent memory** (replaced graphify 2026-08-04 — the graph could never stay current):
  `python scripts/memsync.py` (delta by content hash, ~0.3 s) · `--query "<text>"` to search this
  repo's documents · `--tool <name>` for a vendor/technology spec · `--status` for what is stored.
  `node scripts/check-memory-fresh.mjs` is the gate and it BLOCKS. Matching is case-folded substring:
  no stemming, no synonyms, no cross-language matching — expand the query into real tokens first.
- **Worker dev**: `cd worker` — has its own `package.json`, `vitest.config.mjs`, `worker/test/`;
  separate `node_modules` from the root.
- **Windows shell notes** (this environment): the Bash tool is git-bash (POSIX-ish) — `find`, `wc`,
  standard Unix one-liners work there; prefer it over PowerShell for those. PowerShell tool is pwsh 7+
  for native Windows/`git`/`npm` work. Chain shell commands defensively: a `&&` chain aborts silently
  after the first command whose exit code is non-zero (e.g. a `grep` with no match) — use `;` with
  `|| true`/`|| echo ...` guards when a step is allowed to find nothing.
