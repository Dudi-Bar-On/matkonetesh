
# matconetesh — Serena usage notes

## Division of labor (CLAUDE.md §10.17, `docs/process/serena-adoption.md`)
- **Serena** = live locate-exact/edit-exact on THIS repo's own code across ALL 8 configured languages
  (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`, `replace_symbol_body`,
  `rename_symbol`) — always fresh (live LSP), no full-file reads needed to navigate.
- **the geniza** (`retrieval.search_current_docs(q, ...)` / `retrieval.semantic_search(q, ...)` from
  `src.knowledge.retrieval`) = documentation: spec/decision
  provenance, vendor and API docs, the
  141-gap analysis corpus. Serena cannot read anything outside this repo's own code, and its own
  indexing (`serena project index`) is pure LSP/symbol-structural — there is no LLM/semantic step
  inside Serena itself; that is specifically what the geniza adds.
- **Grep** = fallback for literal/non-code text.

## Version: 1.6.1 (upgraded from 1.6.0 same session — see `mem:tooling/serena_language_activation`'s
last section for the exact upgrade mechanism; TWO separate local installs exist, only
`~/.local/venvs/serena` — a plain `python -m venv`, not `uv tool`-tracked — is actually used/on PATH).

## STATUS as of 2026-07-24 (owner directive "Full configuration + indexing"): fully live, all 8 languages
`get_config_overview` → `"languages": ["typescript","python","bash","powershell","toml","yaml","json","html"]`.
Every one verified with a REAL query, not just "listed active" (see `mem:tooling/serena_language_activation`
for the exact per-language fix recipe, evidence, and remaining caveats — this memory is the pointer/summary):

| Language | Verified via | Result |
|---|---|---|
| typescript | `find_symbol` GEM_MODELS in app.js; `find_referencing_symbols` seedApp | exact hit; 234 real cross-file refs (was 0 before the root tsconfig.json fix) |
| python | `get_symbols_overview` build.py | real functions/vars/constants (was `ValueError: Active languages: ['typescript']`) |
| bash | `get_symbols_overview` scripts/sync-docs.sh | real shell variables |
| toml | `get_symbols_overview` wrangler.toml | real keys — works despite a non-fatal schema-catalog fetch error (see language_activation memory) |
| yaml | `get_symbols_overview` .github/workflows/test.yml | real structure, no caveats |
| json | `get_symbols_overview` package.json | real structure, no caveats |
| html | `get_symbols_overview` docs/matkonetesh-modes-demo.html | real elements + embedded CSS/JS, no caveats |
| powershell | `get_symbols_overview` scripts/m-cpu-sampler.ps1 | real functions/vars, no caveats |

`serena project index "C:\Users\dudib\source\repos\matconetesh"` (the CLI indexing command, separate
from the live MCP server — starts its own short-lived language servers, writes an LSP symbol cache
under `.serena/cache/<language>/*.pkl`, exits cleanly): **207 files indexed** —
json=31, typescript=105, python=11, toml=2, yaml=47, html=8, powershell=2, bash=1. Ran clean, no
errors, did not disturb the separately-running MCP server process.

**Tools/modes expanded (owner directive "enable all its tools/modes")**: `included_optional_tools` in
project.yml now lists every tool the "claude-code" context leaves inactive EXCEPT `jet_brains_*`
(this project uses the LSP backend, not JetBrains — those tools would just error). `activate_project`/`remove_project` were expected to stay hard-disabled regardless, since
`claude-code.yml` sets `single_project: true` and its own docstring says that always disables
`activate_project` — CHECKED, not assumed: `get_config_overview`'s `active_tools` list includes BOTH
after the restart. Prediction was wrong; corrected here rather than left standing (L20) — an explicit
`included_optional_tools` entry apparently wins over the context's own single_project auto-exclusion
for this Serena version (1.6.0). Both are therefore genuinely usable on this project despite the
context comment's claim. `added_modes` has ONLY
`query-projects` (the one mode that is purely additive, excludes nothing) — the other 8 modes
(benchmark/no-memories/planning/onboarding/no-onboarding/one-shot/editing/interactive) are mutually
EXCLUSIONARY behavioral toggles, not independent flags (e.g. `onboarding`/`planning`/`benchmark` all
strip core edit/memory tools) — see `mem:tooling/serena_language_activation` if that reasoning needs
re-verifying; do not blanket-enable them as a permanent project default without re-reading each mode's
own YAML first.

## Manual (`initial_instructions`) — key behavioral rules
- For code files: `Read` is FORBIDDEN for discovery (use `get_symbols_overview` → `find_symbol` with
  `include_body` instead); `Edit` is FORBIDDEN (use `replace_symbol_body`/`insert_*_symbol`/
  `replace_content`). `Grep`/`Glob` remain fine for discovery only, followed by a Serena read.
- Batch independent Serena tool calls in one turn — Serena executes them one at a time internally
  regardless of batching, so this only saves round-trips and cannot cause races.
- `rename_symbol`/`safe_delete_symbol` are reference-aware and atomic across all usages — trust a
  success result, don't re-read/re-test just to confirm the mechanical rename propagated.
- `onboarding` (the TOOL) can be called AT MOST ONCE per conversation, and requires reading
  `mem:memory_maintenance` first.

## The Serena Dashboard — a second, HTTP-reachable control surface (localhost only)
`http://127.0.0.1:24282/dashboard/` (curl/PowerShell `Invoke-WebRequest` work fine locally — WebFetch
does NOT, it cannot reach localhost). Useful raw endpoints beyond the UI: `GET /get_config_overview`
(live active languages/tools/registered projects — ground truth, not what project.yml merely lists),
`POST /get_log_messages {"start_idx":0}` (full structured server log, the single best root-cause tool
— literal subprocess commands + stdout/stderr, not just the MCP-surfaced error string),
`GET /get_available_languages`, `POST /add_language {"language":"x"}` / `POST /remove_language` (the
ONLY reachable way to live-add/remove ONE language server without a full restart — see the language
memory for why this matters), `PUT /shutdown`.

## The single biggest structural finding, 2026-07-24 (read `mem:tooling/serena_language_activation` for full evidence)
Read directly from the installed package source (`C:\Users\dudib\.local\venvs\serena\Lib\site-packages\`)
rather than assumed:
1. **No project.yml file-watcher exists.** Editing `.serena/project.yml` on disk has ZERO live effect —
   `project_config` is a plain object loaded ONCE at project activation (`project.py` line ~43) and never
   refreshed. This supersedes an earlier (wrong) claim in this same memory that edits "auto-schedule" a
   live add — that was a timing coincidence with a dashboard button click, not an automatic watcher; there
   is exactly one caller of `agent.add_language` in the whole codebase (`dashboard.py`'s `/add_language`
   HTTP handler) and it early-returns as a no-op if the language is already in the (stale) in-memory list.
2. **A full restart is fail-fast/all-or-nothing.** `LanguageServerManager.from_languages` (used at every
   fresh project activation) starts every configured language IN PARALLEL and, if even ONE fails, stops
   EVERY OTHER ONE TOO — including ones that were already working. Never restart with an untested/known-
   broken language still in `languages:`; fix or trim first. A single language add via the Dashboard's
   `/add_language` (→ `add_language_server`) has NO such blast radius — it only touches the one language.
3. **`ls_specific_settings` requires the project to be TRUSTED** (`~/.serena/serena_config.yml`
   `trusted_project_path_patterns` — was `[]`/untrusted here; fixed 2026-07-24, see that file's own
   comment for the exact security tradeoff). Untrusted → silently ignored with only a log warning, not
   an error — a fix can look "applied" in project.yml and still not fire.
4. This repo's Serena MCP server is a PERSISTENT process shared across separate Claude Code conversations
   on this machine (confirmed: identical PID/uptime/tool-call-counts observed from a brand-new
   conversation) — NOT spawned fresh per session. Restarting it (tree-kill from the root `serena.exe` PID,
   verify port 24282 freed + zero orphans, then any Serena tool call auto-respawns it) affects every open
   Claude Code window on this machine, not just the current one.

## What worked well (positive findings, carried forward from 2026-07-24 first-use session)
- `get_symbols_overview` on the 9.6k-line `app.js` monolith: sub-second server-side, complete.
- `get_diagnostics_for_file` returns real, line-accurate TypeScript Hints even on plain `.js`.
- `find_symbol` with `include_info=true` returns a real inferred TS signature even for untyped `.js`.
- The Dashboard's live Tool Usage counter cross-checks that tool calls actually executed server-side.
