# matconetesh — warm-page test fixture architecture

File: `tests/_fixtures.ts`. Top-level exports (confirmed via Serena `get_symbols_overview`):
`dclGoto` (Function), `seedApp` (Function), `test` (Constant), `WarmTestFixtures`/`WarmWorkerFixtures`
(fixture-type Variables).

## The fixture chain (`test = base.extend<WarmTestFixtures, WarmWorkerFixtures>({...})`, lines 55-142)

- **`warmContext`** (worker-scoped) — ONE ephemeral `browser.newContext()` per Playwright worker.
  Deliberately has NO manual `context.tracing.start()` — `@playwright/test`'s own automatic artifact
  recorder already starts/stops a trace chunk per test on every context (calling it manually throws
  "Tracing has been already started"); this was root-caused against the installed playwright 1.61.1
  source, not guessed.
- **`warmPage`** (worker-scoped) — the ONE cold `page.goto('/index.html')` per worker (~1028ms p50 for
  every later WARM reload, per research "W0"). Immediately monkey-patches `page.addInitScript` to
  **throw** — this is the "addInitScript hard trap": init scripts on a page shared across a worker's
  whole life would accumulate in documented-undefined order, so it's forbidden outright rather than by
  convention. The thrown error message tells the caller to use `seedApp(page, kv)` instead, or the
  `isolatedPage` fixture for genuine per-test isolation needs.
- **`warm`** (test-scoped) — wraps `warmPage`; throws if the shared page was already closed by an
  earlier test (a deliberate guard for Playwright issue #16677 — the throw makes Playwright restart
  the worker with a fresh warm page, i.e. failure IS the quarantine mechanism). Does between-test
  cleanup: `removeAllListeners`, `warmContext.clearCookies()`.
- **`isolatedPage`** (test-scoped) — the escape hatch: a fresh page in the test's OWN built-in
  context, full per-test isolation (config `use` options / per-file `test.use` / automatic
  `trace:'retain-on-failure'` all apply normally). Use for tests needing init scripts, `page.clock`,
  or per-file `test.use` overrides.
- **`page`** — aliased to `warm`. "THE FLIP" (2026-07-23): ordinary `page` fixture usage now gets the
  shared warm page + the addInitScript trap by default; per-test reset is `seedApp(page, kv)`.

## `seedApp(page, kv?)` — app.js:155-165 of `_fixtures.ts`
Clears + sets exact localStorage KV strings (callers keep `JSON.stringify(...)` at the call site so
stored bytes match the old addInitScript-seeded bytes), then reloads. Self-contained on both warm and
classic (`about:blank`) pages. **Grep-confirmed 155 call sites across 84 files** (83 spec files +
`_fixtures.ts` itself, 2026-07-24) — the dominant per-test setup pattern for the whole suite.

`dclGoto` — nav helper forcing `waitUntil:'domcontentloaded'` (the app is interactive at DCL; `'load'`
waits on fonts/manifest and was the root cause of the 2026-07-23 nav-flake, CLAUDE.md §11a).

## SERENA CROSS-FILE REFERENCE SEARCH — FIXED 2026-07-24 (was a known limitation; see `mem:tooling/serena_usage`)
`find_referencing_symbols` on `seedApp` originally returned **ZERO** references despite ~155 real call
sites (grep-verified). Root cause: no `tsconfig.json` existed, so the TS language server couldn't build
one unified multi-file program across `tests/**/*.ts`. **Fixed** by adding a minimal root
`tsconfig.json` (see `mem:tech_stack`) — re-verified same day: `find_referencing_symbols` on `seedApp`
now returns 234 real semantic references across 83 files (151 module/import-scope + 83 function-scope
call sites when grouped by Serena's own kind-bucketing; ~81 across 26 files when filtered to strict
LSP kind=12/Function only). The exact count differs from the original 155-grep figure because the two
methods count different things (semantic references incl. import lines vs. a specific grep pattern) —
both prove the same underlying fact: cross-file reference search on `tests/*.ts` is now reliable. Grep
remains a fine fallback but is no longer the only option for "who calls this" on the test suite.
