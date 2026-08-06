# Serena — first real, verified use (2026-07-24)

> ⚠️ **2026-08-05 — `graphify` was removed from this project.** Any instruction below that names it, `graphify-out/`, `/graphify` or `check-graph-fresh` is a **record of what was done at the time**, not something to run. The live equivalents are:
> `from src.knowledge import retrieval` → `search_current_docs(q, filters=…)` / `semantic_search(q, filters=…)` (query) · `python scripts/ingest.py --scope` (ingest, delta by content hash) · `node scripts/check-geniza-fresh.mjs` (the gate, and it BLOCKS). See discipline §10.11–§10.13. **`agent-memory.db`, `scripts/memsync.py` and `scripts/memenrich.py` were themselves deleted 2026-08-05** — this banner used to point at them, which made its own redirect dead two levels deep.


> Status (updated 2026-07-24, see "Issues resolved" and "Full configuration + indexing" below):
> **live and verified across ALL 8 configured languages** (typescript/python/bash/powershell/toml/
> yaml/json/html), **cross-file TS reference search fixed** via a root `tsconfig.json`, project
> **indexed** (207 files), and Serena's tool/mode set **expanded**. The two sections below describe
> two separate, owner-authorized follow-on sessions that closed every gap the original session (body
> below, preserved as-is) found. This file is no longer read-only-session-scoped — later sections
> touched `.serena/project.yml`, `~/.serena/serena_config.yml`, and the repo root (`tsconfig.json`),
> all logged with evidence in their own sections.

---

**Original 2026-07-24 session (below, unedited)** — first real, verified use of Serena on this repo.
Its own status line at the time: *live and verified for JS/TS on this repo; Python not yet active;
cross-file TS reference search has a known gap.* This operationalized §10.17 — Serena's tools were
loaded, its manual was read, onboarding was run, its tools were exercised against the real codebase
(not a toy example), honest failures were root-caused (not assumed), and project memories were written
for future Serena-using agents. That original session was **read-only on all source/docs** except
`.serena/memories/` (via `write_memory`), one authorized `.serena/project.yml` edit (owner instruction
mid-task, see §5 below), and this report file.

## 1. What the manual and docs said that matters

**`initial_instructions` (Serena's own manual, called first per §10.17)** — the operative rules:
- For code files, `Read` is **forbidden for discovery** (use `get_symbols_overview` → `find_symbol`
  with `include_body`/`include_info` instead) and `Edit` is **forbidden** (use `replace_symbol_body`/
  `insert_before_symbol`/`insert_after_symbol`/`replace_content`). `Grep`/`Glob` remain fine for
  discovery, followed by a Serena read.
- Independent Serena tool calls should be **batched in one turn** — Serena executes them one at a
  time internally regardless, so batching only saves round-trips and cannot cause races.
- `rename_symbol`/`safe_delete_symbol` are reference-aware and atomic — a success result can be
  trusted without re-reading/re-testing just to confirm the mechanical change propagated.
- `onboarding` may be called **at most once per conversation**, and requires reading
  `mem:memory_maintenance` first, which fixes the memory style (dense agent notes, not prose;
  `mem:`-backtick cross-references; write/update only durable, non-obvious facts — not quick-read
  facts, generic language knowledge, or one-off task notes).
- Line numbers returned by all tools are **0-based**.

**agent-memory global `serena-docs` corpus (§10.11, queried first)** — a real limitation surfaced here:
the local graph holds `serena-docs-01..26` as extracted **section labels** (e.g. "Indexing", "Project
Activation", "Onboarding & Memories", "Alternative Ways of Running Serena") with correct source
line numbers, but the underlying `raw/serena-docs-*.md` prose is **not cached locally**
(`~/.agent-memory/vendor-sources/` holds `raw/` folders for six other vendor docs sets — cloudflare-
workers, gemini-api, nodejs-v8, ollama, playwright, semantic-search-mcp — but not serena-docs, which
was apparently merged into the global graph without keeping its raw source alongside). The graph could
tell me *what topics* the docs cover but not their exact wording. Per §10.11's "a miss is a task, not
a dead end", the gap was filled by fetching Serena's live docs
(`oraios.github.io/serena`, `github.com/oraios/serena`) directly — see §5 for what that surfaced
(the Dashboard, `activate_project`, live language-adding) that the local graph could not answer.

**On large files, onboarding, and memories specifically:**
- *Large files*: neither the manual nor what I could reach of the docs states an explicit size limit.
  `docs/process/serena-adoption.md`'s own prior research noted the TS LS's default
  `indexing_timeout` (30s) as "generous for one 883KB file" — this session's empirical measurement
  (§3) confirms that generosity held at 888KB/9,648 lines.
- *Onboarding*: a one-shot flow (§2) that inspects the project and directs the agent to write a fixed
  set of memories, sourced from live exploration, not a template filled blindly.
- *Memories*: `mem:memory_maintenance` (read before onboarding, per its own instruction) is itself a
  Serena-shipped memory, not project-specific — it defines the graph-of-memories discovery model
  (read `mem:core` first, follow `mem:` references), and an explicit **add/update threshold**: only
  durable, non-obvious, reduce-future-rediscovery facts qualify; skip anything generic, volatile, or
  one-off.

## 2. Onboarding result

Ran cleanly. `onboarding` auto-detected the project as **TypeScript-only** at first activation
(Serena's own composition scan — visible later in the Dashboard Logs — scored
`{TYPESCRIPT:89.47, VUE:89.47, SVELTE:89.47, PYTHON:9.65, BASH:0.88}` but auto-picked only the
top-scoring language, matching documented upstream behavior). It produced the mandated memory
template (`core`, `tech_stack`, `suggested_commands`, `conventions`, `task_completion`), which this
session filled with real project facts (§4) plus three additional topic memories the mission
specifically asked for (`architecture/ai_registry`, `testing/warm_page_fixtures`,
`tooling/serena_usage`). Total: **8 memories written this session + the pre-existing
`memory_maintenance`, 9 in `.serena/memories/` — confirmed via both `list_memories` and the Serena
Dashboard's own "Available Memories (9)" counter** (an independent, UI-level cross-check, not just
the tool's own claim).

## 3. Verification table — tool → target → latency → result

All calls below were made against the real, current repo (not a fixture). Latencies for the flagship
call were bracketed with `date` timestamps; the rest were run in batches per the manual's own
batching guidance, then independently corroborated against the Serena Dashboard's server-side task
log (`http://127.0.0.1:24282`), which records each tool's **own execution time**, separate from
MCP/agent round-trip overhead.

| Tool | Target | Latency | Result |
|---|---|---|---|
| `get_symbols_overview` | `app.js` (9,648 lines, 888KB) | ~5.6s wall-clock (bracketed `date` calls); **0.985s server-side** per Dashboard Logs (`Task-7:GetSymbolsOverviewTool completed in 0.985 seconds`) — most of the wall-clock gap is MCP/turn overhead, not the tool | **Complete and correct.** 897 raw top-level entries (Variable 59, Function 719, Constant 116, Property 3); 847 after stripping obvious anonymous-callback/`catch(e)` noise. All six probed names present: `GEM_MODELS`, `gemFetch`, `gemGen`, `AI_THINK`, `gemThink`, `equipPlan`. Raw count exceeds the ~669 figure in `serena-adoption.md` mainly because app.js has grown (9,565→9,648 lines) since that count, plus the overview also surfaces anonymous callback/IIFE expressions as pseudo top-level entries — not a completeness defect. |
| `find_symbol` | `GEM_MODELS` (app.js) | batched, sub-second | Found at app.js:4208-4220, full body returned (model registry: text→`gemini-3.6-flash`, tts→`gemini-3.1-flash-tts-preview`, commented rollback pin to `gemini-2.5-flash`). |
| `find_symbol` | `gemFetch` (app.js) | batched, sub-second | Found at app.js:4297-4326; `include_info` returned a real inferred TS signature on plain `.js`: `function gemFetch(model: any, body: any, opts: any): Promise<Response>`. |
| `find_symbol` | `gemGen` (app.js, bonus) | batched, sub-second | Found at app.js:4269-4274, signature returned. |
| `find_symbol` | `AI_THINK` (app.js, bonus) | batched, sub-second | Found at app.js:4253-4265, full body returned (11-role thinking-level map). |
| `find_symbol` | `seedApp` (codebase-wide, no path restriction) | batched, sub-second | **Correctly absent from app.js**; correctly located in `tests/_fixtures.ts:155-165`, with a rich attached docstring (warm-vs-classic-page behaviour, ~1028ms p50). |
| `get_symbols_overview` | `tests/_fixtures.ts` | batched, sub-second | Complete: 5 top-level exports (`dclGoto`, `seedApp`, `test`, `WarmTestFixtures`, `WarmWorkerFixtures`). |
| `find_referencing_symbols` | `seedApp` (tests/_fixtures.ts) | batched, sub-second | **FAILED — returned `{}` (zero references).** Ground truth via `Grep`: **155 real call sites across 84 files** (83 spec files + `_fixtures.ts`). Root-caused (§5): no `tsconfig.json`/`jsconfig.json` exists anywhere in the repo, so the TS LS cannot build one unified cross-file program over `tests/**/*.ts`. |
| `find_referencing_symbols` | `gemThink` (app.js) | batched, sub-second | **Correct.** Found exactly 1 reference (inside `gemGen`, app.js:4272). `Grep` ground truth: also exactly 1 call site. Same-file reference search is accurate — the gap above is specifically cross-file. |
| `get_diagnostics_for_file` | `worker/index.js` | batched, sub-second | Returned 6 real, line-accurate TypeScript Hints (implicit-`any` on `obj`/`status`/`request`/`env`/`rec`/`gResp`) — proves live `checkJs`-style inference on plain `.js`. |
| `get_diagnostics_for_file` | `tests/warm-fixture.spec.ts` | batched, sub-second | Returned `{}` — a legitimate clean result, not a silent failure (confirmed the file has no Hint+ diagnostics). |
| `find_symbol` (Python leg) | a function in `build.py` (attempted via `get_symbols_overview`) | **0.007s server-side (fast-fail)**, per Dashboard Logs `Task-9:GetSymbolsOverviewTool failed after 0.007 seconds` | **FAILED**: `ValueError: Cannot extract symbols from file build.py. Active languages: ['typescript']`. Root-caused in §5 — not a stale-cache/reload problem as first suspected, but python's language server (`pyright`) failing to activate at all, for a network reason. |
| Dashboard "+ Add Language" → `python` | live UI action, `http://127.0.0.1:24282` | 0.279s (`Task-5`, auto-triggered by the project.yml edit) and 0.243s (`Task-32`, manual retry via the Dashboard button) | **FAILED both times**, identical error: `uvx` fetching `pyright` from `https://pypi.org/simple/pyright/` hit `invalid peer certificate: UnknownIssuer` — a TLS trust-store problem in this sandbox, not a Serena or config defect. |
| (auto-triggered) `AddLanguage:bash` | — | 11.483s (`Task-8`) | **Partially worked, then failed**: `npm install bash-language-server@5.6.0` succeeded (registry reachable); its ShellCheck v0.10.0 dependency, fetched directly from a GitHub releases URL, failed to download. |

## 4. Memories written (`.serena/memories/`, via `write_memory`)

| Memory | Content |
|---|---|
| `core` | Project identity, top-level source map (app.js/app.css/Python data layer/build.py/worker/tests), links to every other memory below. |
| `tech_stack` | Languages, build tools, the language-activation timeline and its two real findings (§5). |
| `suggested_commands` | build/test/serve/graph-sync commands, Windows-shell-specific gotchas (the `&&`-chain-abort trap). |
| `conventions` | Hebrew/RTL rules, safety-value sourcing, secrets boundary, the build-artifact rule (`index.html`/`dist/` are generated, never hand-edited). |
| `task_completion` | Pointer to CLAUDE.md §3 (the 12-point DoD) — deliberately not a duplicate, per `memory_maintenance`'s own guidance against restating what a source document already owns. |
| `architecture/ai_registry` | Exact locations (`find_symbol`-verified line numbers) of `GEM_HOST`/`GEM_MODELS`/`AI_THINK`/`gemGen`/`gemThink`/`gemFetch`, plus the separate worker/index.js proxy surface, with an explicit "not cross-traced" caveat where true. |
| `testing/warm_page_fixtures` | The full `warmContext`→`warmPage`→`warm`/`isolatedPage`→`page` fixture chain in `tests/_fixtures.ts`, the `addInitScript` hard-trap, `seedApp`'s 155 grep-verified call sites, and the cross-file `find_referencing_symbols` limitation with its evidence. |
| `tooling/serena_usage` | Serena↔agent-memory↔grep division of labor, the manual's behavioral rules, the Dashboard as a second control surface, and both evidenced 2026-07-24 findings in full (with the corrected root cause for language activation — see §5). |

## 5. Honest limits found — and one correction made mid-session

**Limit A — cross-file TypeScript reference search is unreliable on this repo.** Proven, not assumed:
`find_referencing_symbols` on `seedApp` returned zero results against 155 real, `Grep`-verified call
sites across 84 files, while the same tool on a same-file symbol (`gemThink`) was exactly correct
(1/1). Root cause: **no `tsconfig.json` or `jsconfig.json` exists anywhere in this repo**, so the
TypeScript language server has no way to unify `tests/**/*.ts` into one cross-file program. This
**changes §10.17's promise** specifically for "who calls this" questions on the test suite — until a
tsconfig is added and re-verified, dispatch prompts must tell agents to use `Grep` for that class of
question on `tests/*.ts`, not Serena.

**Limit B — Python (and possibly bash/toml/yaml/json/html/powershell) language support is configured
but not active, for a network reason specific to this sandbox — not a Serena defect, and NOT what was
first suspected.** The investigation itself is worth recording because the first, plausible-looking
diagnosis was wrong and a deeper check corrected it — the shape of mistake L19/L20 exist to catch:

1. **First diagnosis (incomplete):** `.serena/project.yml` originally listed only `typescript`
   (auto-detected). Per a mid-task owner instruction, `python, bash, powershell, toml, yaml, json,
   html` were added. An immediate `get_symbols_overview` on `build.py` still errored
   `Active languages: ['typescript']`. The first conclusion drawn was "config edits don't hot-reload a
   live MCP session — a reconnect is required." That conclusion was **stated in a first draft of the
   `tooling/serena_usage` memory** before being corrected (below).
2. **Deeper check (the actual root cause):** the user asked directly whether Serena needs reloading
   after a `project.yml` change. That prompted opening Serena's own web Dashboard
   (`http://127.0.0.1:24282`, found listening locally) and its Logs page, which showed the true
   sequence: editing `project.yml` **did** auto-schedule a live `AddLanguage:python` background task
   within seconds, with **no reconnect needed for the attempt itself** — contradicting the first
   conclusion. The attempt then failed on its own: `uvx`'s fetch of `pyright` from PyPI hit a TLS
   certificate validation error (`invalid peer certificate: UnknownIssuer`). A second, manual attempt
   via the Dashboard's own "+ Add Language" button failed identically. An auto-triggered
   `AddLanguage:bash` task got further (its `npm install` succeeded) but then failed downloading its
   ShellCheck dependency from a GitHub releases URL. **Both are outbound-network failures in this
   sandbox, not reload/config problems.**
3. **The memories were corrected** (`tech_stack`, `tooling/serena_usage`, and a line in `core`)
   before this report was written, so no Serena-using agent inherits the wrong diagnosis.

**Practical upshot:** the Python leg of §10.17's promise (Pyright over `build.py`/`data.py`/
`sources.py`/etc.) is **not usable in this environment right now**. Fixing it needs whoever controls
this sandbox's network/TLS policy to either allow the `uvx`→PyPI fetch (the LS's own stderr suggests
trying `--system-certs`) or pre-provision `pyright`/`shellcheck` so no runtime download is required —
this is outside what a read-only verification session can resolve. toml/yaml/json/html/powershell
were listed in `project.yml` the same session but never showed an `AddLanguage` attempt in the logs;
their status is genuinely unverified, not assumed working or broken.

**Deviation from the original read-only brief, disclosed:** the original brief scoped this session to
edit nothing but Serena's memories and this report. A mid-task instruction directed adding Python and
"every other used languages or scripts" to `.serena/project.yml`, and a follow-up question directed
investigating live-reload behavior (which led to the Dashboard interaction, including one click of its
own "+ Add Language" control). Both were explicit, in-conversation instructions from the dispatching
agent, executed transparently and reported here rather than treated as pre-authorized scope. No other
source or documentation file was touched.

## 6. Serena briefing snippet for future dispatch prompts

Paste into a subagent brief whenever the task is symbol-shaped code work on this repo:

> This repo has a live Serena MCP server (LSP-backed semantic code tools). Load its tools via
> `ToolSearch` (e.g. `select:mcp__serena__find_symbol,mcp__serena__get_symbols_overview,mcp__serena__find_referencing_symbols,mcp__serena__get_diagnostics_for_file,mcp__serena__replace_symbol_body,mcp__serena__list_memories,mcp__serena__read_memory`)
> and call `initial_instructions` before any code work — for code files, its manual makes `Read`
> forbidden for discovery and `Edit` forbidden for changes; use Serena's own tools instead. Then read
> `mem:core` (`list_memories` → `read_memory`) — it is the entry point into this project's memory
> graph and links to the rest.
>
> **Known limits, verified 2026-07-24 (full detail: `docs/process/serena-first-use.md`,
> `mem:tooling/serena_usage`):**
> - **JS/TS on `app.js`/`worker/index.js`**: fully reliable, including on the ~9.6k-line app.js
>   monolith — `find_symbol`, `get_symbols_overview`, `get_diagnostics_for_file` all verified working
>   and fast.
> - **"Who calls this" across `tests/*.ts`**: `find_referencing_symbols`/`find_implementations` are
>   UNRELIABLE cross-file on this repo (no `tsconfig.json` unifies the test tree — same-file search is
>   fine). Use `Grep` for cross-file reference questions on the test suite until this is fixed.
> - **Python files** (`build.py`/`data.py`/`sources.py`/etc.): the Python language server was NOT
>   active as of 2026-07-24 (a sandbox network/TLS restriction blocks `pyright`'s download — see
>   `mem:tooling/serena_usage`). Before relying on Serena for Python, smoke-test with a trivial
>   `get_symbols_overview` call; on an `Active languages: [...]` error without `python`, fall back to
>   `Read`/`Grep` for that file and flag it rather than silently retrying.
> - **Symbol-editing tools** (`replace_symbol_body`, `rename_symbol`, `insert_*_symbol`,
>   `safe_delete_symbol`) were configured and documented but **not exercised** in the 2026-07-24
>   verification session (it was deliberately read-only) — trust them per the manual, but this project
>   has not yet observed one used in anger; report back if one misbehaves so this note can be updated.

## 7. Follow-ups (not actioned in this session — outside its read-only/memory-only scope)

- Add a `tsconfig.json`/`jsconfig.json` so cross-file TS reference search works across `tests/*.ts` —
  a real source-tree change, needs owner sign-off (§10.8: material, not routine).
- Resolve the sandbox's outbound-HTTPS/TLS restriction (or pre-provision `pyright`/`shellcheck`
  binaries) so the Python leg of §10.17 actually activates.
- Per §10.11's usefulness gate: the Serena Dashboard (`activate_project`/`get_current_config`/
  `remove_project`/`restart_language_server` tools, live language-adding via the Dashboard UI) is
  genuine, generally-useful Serena documentation surface that the local `serena-docs` graph node
  labels don't capture in enough prose detail to answer questions like this session's from the graph
  alone (its raw source text isn't cached locally, unlike six other vendor doc sets under
  `~/.agent-memory/vendor-sources/`). Re-ingesting Serena's docs fresh (`agent-memory add
  https://oraios.github.io/serena/`, then `agent-memory global add ... --as serena-docs-v2`, replacing or
  supplementing the existing `serena-docs` tag) would let future sessions get this from the graph
  instead of a live web fetch. Recommended, not performed here — outside this session's authorized
  write scope (memories + this one report file only).

---

## Issues resolved (2026-07-24)

Owner-authorized follow-on session, scoped explicitly to the two gaps §7 above flagged as needing
sign-off. Both closed. Repo: `C:\Users\dudib\source\repos\matconetesh`.

### Issue 1 — no `tsconfig.json` → `find_referencing_symbols` returns 0 cross-file references

**Fix**: added a minimal root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "allowJs": true, "checkJs": false, "noEmit": true, "skipLibCheck": true,
    "target": "ES2020", "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["app.js", "serve.js", "worker/*.js", "tests/**/*.ts"],
  "exclude": ["**/node_modules/**", "dist/**"]
}
```
`target`/`lib` are not in the task's literal minimal field list but were added deliberately: verified
via Playwright's own docs (`https://playwright.dev/docs/test-typescript`, fetched live — "Playwright
only supports the following tsconfig options: `allowJs`, `baseUrl`, `paths` and `references`") that
`target`/`lib` are invisible to Playwright's own test execution, so they cost nothing there — but
without them, TS's *default* target (ES5) drops `Promise`/`Map`/etc. from tsserver's known-globals set
once these files move from its permissive "inferred project" default into this explicit "configured
project", which would have been a real regression for `get_diagnostics_for_file` on `app.js`/
`worker/index.js`. `baseUrl`/`paths` were deliberately left unset (no path aliases in this repo, and
they're the one Playwright-supported knob — leaving them unset keeps that no-op provably true).

**Safety verification (§ "CRITICAL SAFETY" in the brief) — all three checked before AND after, not
assumed:**

| Check | Before | After |
|---|---|---|
| `npx playwright test --list` | 438 tests in 86 files | 438 tests in 86 files (unchanged) |
| `python build.py` output | `index.html` 2,707,255 B; `dist/index.html` 2,707,255 B | identical, both files, byte-for-byte |
| `get_diagnostics_for_file` on `worker/index.js` (regression check) | 6 Hints, all implicit-any, same messages | identical — 6 Hints, same messages/line ranges |

(No suite RUN was performed at any point — `--list` is compilation-only, per the brief's explicit
instruction; another agent owned the test server.)

**`find_referencing_symbols` on `seedApp` (`tests/_fixtures.ts`) — the actual fix, verified working:**
- Before: `{}` — zero references (reconfirmed fresh this session before touching anything).
- After: real semantic references across the test suite. Two ways of counting the same result, both
  far beyond "it found something":
  - **Unfiltered** (every symbol-kind Serena attributes a reference to): **234 references across 83
    files** — 151 grouped under the enclosing FILE/module scope (import lines, or calls inside
    top-level `const foo = async (page) => {...}` arrow functions that aren't literally inside a named
    function Serena tags separately) + 83 grouped under a named enclosing Function.
  - **Filtered to strict LSP kind=12 (Function) only** — i.e. call sites specifically, closest to what
    a `grep 'seedApp('` would count: ~81 references across 26 files (files that only ever *import*
    `seedApp` via a re-export chain, with no local call, correctly drop out of this filtered view).
  - The original §3 table's grep-derived "155 call sites across 84 files" is a third, independently
    produced number from a different counting method (a literal-string grep pattern whose exact
    command wasn't preserved) — it was not force-reconciled against Serena's own count digit-for-digit;
    what matters and IS proven is the qualitative fact both agree on: real, multi-file, semantically
    correct references, not the previous `{}`.
  - Reconfirmed identical after a second, unrelated Serena restart (see next section) — not a fluke of
    one particular server instance.

### Issue 2 — TLS-blocked language servers: pyright + ShellCheck

Both root-caused by reading the ACTUAL installed Serena/solidlsp source
(`C:\Users\dudib\.local\venvs\serena\Lib\site-packages\`), not the MCP-surfaced error string alone.

**pyright**: `PyrightServer` unconditionally shells out to `uvx -p 3.13 --from pyright==1.1.403
pyright-langserver --stdio`. uv's own bundled CA store doesn't trust this sandbox's TLS-inspecting
proxy (`invalid peer certificate: UnknownIssuer` fetching `https://pypi.org/simple/pyright/`) — no
`--system-certs`/`UV_NATIVE_TLS` equivalent is exposed through Serena's own config surface. Fix:
`npm install -g pyright` (npm's own fetch trusts the system cert store here) gives a complete, real
`pyright-langserver.js` (pyright's actual implementation is Node-based; the PyPI package is a thin
wrapper) — pointed Serena at it directly via `.serena/project.yml`
`ls_specific_settings.python.ls_base_cmd: [<absolute path to node.exe>, <absolute path to
pyright-langserver.js>]`, bypassing uv/PyPI entirely. (`ls_base_cmd`, not the simpler `ls_path`: the
npm-installed executable on Windows is a `.cmd` shim, which can't be `CreateProcess`'d directly without
a shell — `ls_base_cmd` names `node.exe` itself as the spawned process, `--stdio` appended
automatically by the Uvx dependency provider.)

**ShellCheck**: `bash-language-server` itself already installed fine via plain `npm install`
(confirmed working in the very first serena-first-use.md session). Only its ShellCheck v0.10.0
sub-dependency — fetched as a raw GitHub-releases zip via Python's own downloader — failed:
`SSLCertVerificationError: unable to get local issuer certificate`. Fix: `winget install
koalaman.shellcheck` (got 0.11.0 — version doesn't matter, Serena's own check is only
`os.path.exists(binary_path)`, no version comparison) → copied the resulting `shellcheck.exe` to the
EXACT path `bash_language_server.py` expects
(`~/.serena/language_servers/static/BashLanguageServer/bash-lsp/shellcheck/shellcheck.exe`), so the
download step is skipped entirely on the next attempt.

**A precondition that would have silently defeated both fixes, found and fixed before it could**:
`ls_specific_settings` (where the `ls_base_cmd` override lives) is only honored if
`is_trusted_project_path()` returns true — read directly from `serena_config.py`:
```python
if self.project_config.ls_specific_settings:
    if self.is_trusted():
        ls_specific_settings.update(self.project_config.ls_specific_settings)
    else:
        log.warning(f"Project path {self.project_root} is not trusted, ignoring LS-specific settings ...")
```
`~/.serena/serena_config.yml`'s `trusted_project_path_patterns` was `[]` — empty means untrusted
(confirmed by reading `is_trusted_project_path`'s loop-then-`return False` directly, not inferred from
the sibling `web_dashboard_trusted_hosts` setting, whose *empty-means-trust-all* semantics are the
opposite and would have been the wrong assumption to carry over). Fixed by adding
`C:\Users\dudib\source\repos\matconetesh` to that list (see "Full configuration" below for the broader
version and its explicit security note). Without this, both fixes would have applied to
`project.yml` correctly, looked correct on inspection, and been **silently ignored** at runtime —
exactly the kind of gap `systematic-debugging`/L20 exist to catch before it costs a debugging session.

**Verification — both legs live, proven with a real query, not just "listed active":**
- Python: `get_symbols_overview` on `build.py` → real functions/vars/constants (`_snorm`,
  `_has_internal_temp`, `SEASONINGS`, `DATA_JSON`, ...). Previously:
  `ValueError: Cannot extract symbols from file build.py. Active languages: ['typescript']`.
- Bash: `get_symbols_overview` on `scripts/sync-docs.sh` → real shell variables (`MSG`, `PUSH`,
  `DOCS_CHANGED`, ...).
- Fresh server logs for the restart that activated both (zero errors):
  `Language server startup (language=python) completed in 0.613 seconds`,
  `Language server startup (language=bash) completed in 3.479 seconds` (typescript: 0.323s, unaffected).

**Restart mechanics** (both `ls_specific_settings` and any `languages:` addition require a genuine
process restart — there is no live "soft reload"; see "Full configuration" below for the full
evidence). Performed twice this session: tree-killed the `serena.exe` process from its root PID
(`taskkill /PID <pid> /T /F`), verified port 24282 freed and zero orphan PIDs remained, then made any
Serena MCP tool call — Claude Code auto-respawned it transparently, picking up every config change
fresh. `powershell`/`toml`/`yaml`/`json`/`html` were deliberately left OUT of `languages:` for this
narrower restart (Serena's own project-activation path is fail-fast/all-or-nothing — see next section
— and those five were completely untested at this point); see "Full configuration" for how they were
subsequently added too.

**Nothing left unresolved from this section's original two-issue scope.**

---

## Full configuration + indexing (2026-07-24)

Owner directive, issued mid-session, extending the brief above: activate every language listed in
`.serena/project.yml` (not only python/bash), confirm the trust fix, run full project indexing, and
verify with real queries. All of it done in the same session as "Issues resolved" above, immediately
following it — one more restart, described here.

### Per-language activation — final status (all 8 verified with a real query)

| Language | Server | Fix needed | Verified via | Result |
|---|---|---|---|---|
| typescript | typescript-language-server | none (already working) | `find_symbol` GEM_MODELS in app.js; `find_referencing_symbols` seedApp | exact hit; 234 cross-file refs |
| python | pyright | `ls_base_cmd` → npm-installed pyright (see "Issues resolved") | `get_symbols_overview` build.py | real Python symbols |
| bash | bash-language-server | pre-provisioned ShellCheck.exe (see "Issues resolved") | `get_symbols_overview` scripts/sync-docs.sh | real shell variables |
| toml | Taplo | `winget install tamasfe.taplo` + `ls_path` | `get_symbols_overview` wrangler.toml | real TOML keys — **caveat**: Taplo's own runtime schema-catalog fetch (`schemastore.org`) fails the same TLS way, logged as ERROR, but is non-fatal — core symbol/reference function unaffected |
| yaml | yaml-language-server | none — plain `npm install` already works | `get_symbols_overview` .github/workflows/test.yml | real YAML structure, no caveats |
| json | vscode-json-languageserver | none — plain `npm install` already works | `get_symbols_overview` package.json | real JSON structure, no caveats |
| html | vscode-html-language-server | none — plain `npm install` already works | `get_symbols_overview` docs/matkonetesh-modes-demo.html | real elements + embedded CSS/JS, no caveats |
| powershell | PowerShell Editor Services | pwsh already present; PSES + PSScriptAnalyzer pre-provisioned manually (downloaded via `Invoke-WebRequest`/`Save-Module` — PowerShell's own TLS stack trusts this sandbox's proxy, confirmed empirically) | `get_symbols_overview` scripts/m-cpu-sampler.ps1 | real functions/vars, no caveats |

Full per-language recipe with exact paths, commands, and reasoning: `mem:tooling/serena_language_activation`.

**Serena genuinely doesn't support anything relevant that was skipped** — every language actually used
in this repo (per `.serena/project.yml`'s own comments: TS/JS, Python, bash scripts, PowerShell
scripts, TOML configs, YAML workflows, JSON configs, HTML mockups) has a real Serena/solidlsp language
server, and all eight now run. `markdown` was deliberately NOT added — not a support gap, a division-
of-labor choice (CLAUDE.md §10.17: docs relationships are agent-memory's job, not Serena's; see
`tech_stack` memory).

### The trust fix

`~/.serena/serena_config.yml` `trusted_project_path_patterns` was `[]` (empty = untrusted — confirmed
by reading `is_trusted_project_path()` directly, not assumed from a sibling setting's opposite
semantics). Fixed with three patterns:
```yaml
trusted_project_path_patterns:
- C:\Users\dudib\source\repos\matconetesh
- C:\Users\dudib\source\repos\matconetesh\**
- C:\Users\dudib\source\repos\**
```
The first is the one that is actually guaranteed to match: read `serena/util/text_utils.py`'s
`glob_match` directly — its "`**`" handling only special-cases a MIDDLE "`/**/`" occurrence (and that
branch checks for a literal `\**\` that can never match post-normalization — a latent bug in that
function, not exploited or relied upon here) or a LEADING "`**/`"; a TRAILING "`/**`" with nothing
after it does not match a bare parent path under plain `fnmatch.translate`. The bare-path entry is the
one that actually satisfies `is_trusted_project_path()`'s check (which compares against the literal
project-root string, no subpath); the `\**` variant is kept alongside as a harmless, not load-bearing,
second entry. The third (repos-root) pattern was added per the owner's explicit "if sensible" — this
machine is a personal dev box, not multi-tenant, and `matkonet` is already a second registered Serena
project here that benefits the same way.

**Security note, stated plainly (not silently done)**: "trusted" here specifically means Serena will
honor a project's own `.serena/project.yml` `ls_specific_settings` (`ls_path`/`ls_base_cmd`/`ls_args`),
which names an arbitrary command to execute when that project's language servers start. Trusting the
repos root grants arbitrary-command-execution-on-activation to anything under that path tree, not just
this one project — scoped deliberately to the repos root, not a blanket `**` trusting the whole
machine.

### Indexing

`serena project index "C:\Users\dudib\source\repos\matconetesh" --log-level INFO` (the CLI command,
confirmed via `serena project --help`: *"Index a project by saving symbols to the LSP cache"*) — a
separate, self-contained, short-lived process: starts its own 8 language servers, indexes, saves a
cache, shuts everything down cleanly. Did not disturb the separately-running MCP server process (no
port/resource conflicts observed; both were run — deliberately sequentially, not concurrently with any
other heavy operation, per the general §11a discipline this project already applies to Playwright).

```
Indexing: 100%|##########| 207/207
Indexed files per language: json=31, typescript=105, python=11, toml=2, yaml=47, html=8, powershell=2, bash=1
```
207 files total, zero errors, cache written to `.serena/cache/<language>/{raw_document_symbols,
document_symbols}.pkl` for all 8 languages. Ran in ~5 seconds end-to-end.

Note on "semantic generation": Serena's own indexing is purely LSP/symbol-structural — there is no LLM
step anywhere in `serena project index`'s pipeline (confirmed by reading the command's source path).
If genuinely LLM-derived semantic relationships over the codebase are wanted (not just symbol
locations/references), that is agent-memory's job per this project's own established division of labor
(CLAUDE.md §10.17/`docs/process/serena-adoption.md`) — a related but distinctly separate, larger
undertaking (agent-memory's own docs corpus currently covers documentation, not this codebase's source;
running it over ~9.6k-line `app.js` + the full Python data layer would be a substantial new task in its
own right) — not performed here, flagged rather than silently assumed out of scope.

### Tools and modes

`included_optional_tools` (`.serena/project.yml`) now lists every tool the `claude-code` context
leaves inactive by default, EXCLUDING the `jet_brains_*` family (this project uses the LSP backend, not
the JetBrains plugin bridge — those tools would only ever error here). Verified post-restart via
`get_config_overview`'s `active_tools`: **39 active tools**, including `activate_project`/
`remove_project` — worth flagging precisely because `claude-code.yml`'s own docstring says
`single_project: true` "always" disables `activate_project`; checked, not assumed, and the check
showed it IS active here (an explicit `included_optional_tools` entry apparently wins over the
context's own auto-exclusion on this Serena version, 1.6.0) — the earlier prediction to the contrary
in a first draft of the `tooling/serena_usage` memory was corrected once this was verified.

`added_modes` has only `query-projects` — the one Serena mode that is purely additive (adds
`list_queryable_projects` + `query_project`, excludes nothing). Every other mode's own YAML
(`resources/config/modes/*.yml`) was read before deciding: `benchmark`/`no-memories` exclude every
memory tool; `planning`/`onboarding` exclude every edit tool (`create_text_file`,
`replace_symbol_body`, `execute_shell_command`, ...); `no-onboarding` excludes the `onboarding` tool
that `onboarding` mode IS built around; `one-shot`/`benchmark` are per-session autonomy prompts, not
project defaults. Modes are mutually-exclusionary behavioral toggles, not independent feature flags —
"enable all modes" as a permanent project default is not a coherent state (it would strip tools other
modes/the project need), so only the one genuinely conflict-free mode was added. **Still open, pending
owner confirmation**: whether to add `onboarding` mode anyway despite the edit-tool tradeoff — asked
in-conversation, not yet answered as of this write-up; `editing`/`interactive` (both already active by
default) and `query-projects` remain the permanent set until/unless that's confirmed.

### Safety rails — re-verified after every config change, not just once

| Check | Result |
|---|---|
| `npx playwright test --list` | 438 tests in 86 files — confirmed unchanged after the tsconfig.json addition AND again after the full 8-language + tools/modes restart |
| `python build.py` | `index.html` / `dist/index.html` both 2,707,255 bytes — confirmed unchanged at the same two checkpoints |

No suite run was performed at any point in either follow-on session — only `--list` (compilation-only)
and `build.py`, per the brief. `.serena/project.yml`, `~/.serena/serena_config.yml`, and root
`tsconfig.json` are the only files this pair of sessions wrote outside `.serena/memories/` and this
report.

### Nothing left unresolved from the owner directive's four points — except the one flagged decision above (onboarding mode).

### Addendum — Serena upgraded 1.6.0 → 1.6.1, same session

Discovered two separate local Serena installations: the one actually on PATH/used by `.mcp.json`
(`~/.local/venvs/serena`, a plain `python -m venv` install, NOT tracked by `uv tool`) and a second,
unused one at `~/AppData/Roaming/uv/tools/serena-agent` (uv-tracked, already sitting at 1.6.1 from some
earlier, unadopted attempt — `uv tool list` calling the *first* one "malformed" refers to uv simply not
recognizing that first install as one of its own, not to any actual defect in it). `uv tool upgrade
serena-agent` therefore cannot reach the live installation at all (confirmed: it errors "not
installed", touching nothing). The correct action for a plain-venv install is an in-place upgrade of
that exact venv: `uv pip install --upgrade serena-agent --python
C:/Users/dudib/.local/venvs/serena/Scripts/python.exe` (with `UV_SYSTEM_CERTS=1` — note
`UV_NATIVE_TLS`, named in the original brief, is deprecated in the installed uv 0.11.31; `UV_SYSTEM_CERTS`
is its replacement, and it IS what makes uv's own PyPI access work in this sandbox, unlike Serena's own
un-overridable internal `uvx` calls for pyright). Confirmed a low-risk patch bump before touching
anything (`999.999.999` version-pin trick against an isolated scratch venv, zero effect on the real
install). Applied, then re-verified with the same restart procedure as every other change in this
document: all 8 languages still active post-upgrade, zero new errors in the fresh startup logs, and a
handful of the exact same real queries used throughout this document re-run for confirmation
(`build.py`, `wrangler.toml` symbols byte-identical to pre-upgrade; `find_referencing_symbols` on
`seedApp`, kind-filtered to Function/call-sites, reports **exactly 83 references** — the authoritative,
tool-reported figure, matching this document's earlier kind-bucketed count and superseding this
section's own earlier hand-counted "~81" estimate, which undercounted by eye). Playwright/build.py
safety rails re-checked once more after this too (see table above) — unaffected, as expected: the
upgrade never touched anything inside the matconetesh repo itself.
