# Serena — first real, verified use (2026-07-24)

> Status: **live and verified for JS/TS on this repo; Python not yet active; cross-file TS reference
> search has a known gap.** This operationalizes §10.17 — Serena's tools were loaded, its manual was
> read, onboarding was run, its tools were exercised against the real codebase (not a toy example),
> honest failures were root-caused (not assumed), and project memories were written for future
> Serena-using agents. This session was **read-only on all source/docs** except `.serena/memories/`
> (via `write_memory`), one authorized `.serena/project.yml` edit (owner instruction mid-task, see
> §5), and this report file.

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

**graphify global `serena-docs` corpus (§10.11, queried first)** — a real limitation surfaced here:
the local graph holds `serena-docs-01..26` as extracted **section labels** (e.g. "Indexing", "Project
Activation", "Onboarding & Memories", "Alternative Ways of Running Serena") with correct source
line numbers, but the underlying `raw/serena-docs-*.md` prose is **not cached locally**
(`~/.graphify/vendor-sources/` holds `raw/` folders for six other vendor docs sets — cloudflare-
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
| `tooling/serena_usage` | Serena↔graphify↔grep division of labor, the manual's behavioral rules, the Dashboard as a second control surface, and both evidenced 2026-07-24 findings in full (with the corrected root cause for language activation — see §5). |

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
  `~/.graphify/vendor-sources/`). Re-ingesting Serena's docs fresh (`graphify add
  https://oraios.github.io/serena/`, then `graphify global add ... --as serena-docs-v2`, replacing or
  supplementing the existing `serena-docs` tag) would let future sessions get this from the graph
  instead of a live web fetch. Recommended, not performed here — outside this session's authorized
  write scope (memories + this one report file only).
