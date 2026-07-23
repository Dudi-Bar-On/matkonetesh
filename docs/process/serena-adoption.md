# Serena adoption — semantic code navigation for this project

> Status: **configured, not yet live.** A well-formed project MCP config is committed and Claude Code
> already recognises it (`claude mcp get serena` → *pending approval*). It stays inert until the owner
> installs `uv` + `serena-agent` and reloads/approves. The exact remaining steps are in
> [§4](#4-owner-action-steps-remaining-required-to-go-live).

## 1. What Serena is

**Serena** (by Oraios AI) is an open-source coding-agent toolkit that runs as an **MCP server**. It gives
an agent **LSP-based semantic code navigation and editing** — symbol-level operations powered by a real
language server per language — instead of raw text grep:

- **`find_symbol`** — locate a symbol (function/class/method) by name/path without reading the whole file.
- **`find_referencing_symbols`** — find every place a symbol is used (live, exact references, not string matches).
- **`get_symbols_overview`** — the symbol outline of a file (structure without reading every line).
- **`replace_symbol_body` / `insert_before_symbol` / `insert_after_symbol` / `rename_symbol`** — *surgical
  symbol-level edits* rather than whole-file rewrites.
- Plus memories/onboarding (per-project notes Serena stores in `.serena/`).

It is **always-fresh**: every query hits a live language server that reflects the current file on disk. It
is built on `multilspy` / Solid-LSP wrapping standard language servers, and the Python MCP SDK. Serena is
**managed by `uv`** — *"installing uv is the only required prerequisite"*; language servers are then
downloaded/managed by Serena on demand.

Sources: Serena official repo/README (github.com/oraios/serena) and docs (oraios.github.io/serena) —
ingested into the graphify **global** graph as `serena-docs-01..26`, queried first per CLAUDE.md §10.11;
confirmed current against the live README on 2026-07-23. Claude Code MCP scopes/schema from
code.claude.com/docs/en/mcp.

## 2. Fit assessment for THIS codebase (honest)

This is a Hebrew-first single-file PWA: a very large `app.js`, a Python data layer, and a small Cloudflare
worker. Measured footprint:

| File | Lines | What Serena serves it with |
|---|---|---|
| `app.js` | **9,565** (~883 KB), ~669 top-level declarations | JavaScript via the **TypeScript language server** (`typescript-language-server`, language key `typescript`; managed npm install — Node v24 present) |
| `data.py` / `sources.py` / `build.py` | 1,012 / 4,931 / 430 | Python via **Pyright** (default; `python -m pyright.langserver`, managed) |
| `worker/index.js` | 91 | TypeScript LS (same as above) |
| `dist/index.html`, `index.html` | build artifacts | gitignored inlined bundle — ignore for indexing; edit the sources, not the bundle |

**Languages it can serve here:** JavaScript (app.js, worker) and Python (build/data/sources). Both are
first-class in Serena. Good coverage of the whole editable surface.

**The big `app.js` question — verdict: net positive, with a caveat.**
- A single ~9.5k-line file is well within what `tsserver` handles. The TS LS indexing budget
  (`indexing_timeout`, default 30 s) is generous for one 883 KB file; it will not choke. `find_symbol`
  over ~669 top-level declarations is *exactly* the case where symbol jump beats scrolling or reading the
  file into context — this is the single biggest win here.
- **Caveat:** the codebase is nearly monolithic (app.js + a 91-line worker). So the marginal value of
  *cross-file* `find_referencing_symbols` is lower than in a many-file project — most references are
  intra-file. The wins that remain are still real: precise jump-to-symbol, `get_symbols_overview`, and
  surgical `replace_symbol_body`/`rename_symbol` on a 9.5k-line file (no whole-file rewrite, no token blow-up).
- The Python modules are conventional multi-symbol files and are a clean fit (note `data.py`/`sources.py`
  are largely data-literal, so they carry fewer navigable symbols than `build.py`).

**Runtime/environment blockers (report plainly):**
1. **`uv`/`uvx` is NOT installed** in this Windows environment (`uv: command not found`). This is *the*
   blocker: Serena is managed by `uv`; without it neither `serena` nor the `uvx` path runs. It is exactly
   why the pre-existing `plugin:serena:serena` shows **`✘ Failed to connect`** in `claude mcp list`.
2. **A pre-existing marketplace plugin `plugin:serena:serena`** is already registered (from
   `claude-plugins-official`), launching `uvx --from git+https://github.com/oraios/serena …` with **no**
   `--context claude-code` and **no** project. Serena's own README says: *"Do not install Serena via an MCP
   or plugin marketplace! They contain outdated commands."* Recommend disabling/removing it so it does not
   shadow or duplicate the correctly-configured project server.
3. Python here is **3.10.4** (repo `.python-version` pins 3.12). Not a Serena blocker — `uv tool install -p
   3.13 serena-agent` gives Serena its own runtime — noted only so it isn't mistaken for one.
4. Node language servers are **auto-downloaded on first use** — first activation needs network.
5. An MCP server only becomes active **after Claude Code reloads**, and a project-scoped server additionally
   requires **owner approval** (workspace trust). Nothing here goes live inside the configuring session.

## 3. Setup done in this task (config only — cannot run Serena without `uv`)

- **Created `/.mcp.json`** (project scope — checked into version control, shared with the team):
  ```json
  {
    "mcpServers": {
      "serena": {
        "command": "serena",
        "args": ["start-mcp-server", "--context", "claude-code", "--project-from-cwd"]
      }
    }
  }
  ```
  - `--context claude-code` → Serena disables tools that duplicate Claude Code's built-ins (minimal, single-project tool set).
  - `--project-from-cwd` → Serena anchors on the nearest `.git` / `.serena/project.yml` from the launch
    directory; this is the flag Serena's docs recommend for CLI agents (Claude Code launches from the repo
    root). No hard-coded absolute path, so the file stays portable.
  - Chose the installed-`serena` command over `uvx --from git+…` deliberately: the README recommends a real
    install, and the `uvx`-from-git path re-syncs on every upstream commit and can cause MCP connect
    timeouts (a likely contributor to the failing plugin).
- **Validated**: `.mcp.json` is well-formed JSON; `claude mcp get serena` resolves it at *Project* scope
  (status *pending approval* — the expected pre-live state; project scope also takes precedence over the
  plugin entry of the same name).
- **`.gitignore`**: added `.serena/cache/`, `.serena/logs/`, `.serena/*.local.yml` (machine-local; Serena's
  `project.yml` remains versionable).

What was **not** done, and why: `serena project index` (pre-caching symbols) and generating
`.serena/project.yml` both require running Serena, which requires `uv` — absent here. Not faked (a
hand-written `project.yml` risks schema drift that would break first run); left as the owner step below,
where Serena generates it canonically.

## 4. Owner-action steps remaining (required to go live)

Run these from the repo root (`C:\Users\dudib\source\repos\matconetesh`):

1. **Install `uv`** (Windows PowerShell), then restart the shell so `uv`/`serena` land on `PATH`:
   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
   (or `winget install --id=astral-sh.uv`).
2. **Install Serena:** `uv tool install -p 3.13 serena-agent` (then `serena --help` should work).
3. *(Recommended)* **Remove the outdated marketplace plugin** so it doesn't duplicate the project server —
   disable `serena` in the `claude-plugins-official` marketplace via `/plugin` (it currently shows as
   `plugin:serena:serena … ✘ Failed to connect`).
4. *(Optional, speeds first use)* **Pre-index:** `serena project index` — pre-caches symbols; auto-updates
   on file changes thereafter. On first activation Serena auto-detects `python` + `typescript`; confirm the
   generated `.serena/project.yml` lists both.
5. **Reload Claude Code and approve** the project server: run `/mcp`, approve the pending project-scoped
   `serena` (workspace trust). If startup is slow, set `MCP_TIMEOUT=60000`.
6. *(Optional)* Serena's Claude Code **reminder/auto-approve hooks** (`serena-hooks …` in
   `.claude/settings.json`) counteract Claude Code's documented bias toward its built-in tools. Alpha
   feature — adopt only if Serena's tools are being under-used.

Verification once live: `claude mcp list` shows `serena … ✔ Connected`; ask the agent to
`get_symbols_overview` on `build.py` or `find_symbol` a known function in `app.js`.

## 5. graphify ↔ Serena — division of labor

The two tools are **complementary, not competing**, and the split cleanly resolves the standing critique of
graphify (it's a *snapshot*, and it loses to grep for locate-exact):

- **Serena owns live code** — always-fresh (live LSP), symbol-accurate. It takes over *locate-exact* and
  *edit-exact* from both grep and graphify. This is graphify's weak axis, now covered.
- **graphify owns everything with no LSP edge** — relationships that span *documents and code and tests*,
  methodology, vendor/API docs, and spec↔code↔test provenance. A language server sees only symbols in this
  repo's code; it cannot connect a Markdown spec line to the function it governs, cannot read Serena's own
  docs, and cannot reason across the 141-gap analysis. graphify's staleness is tolerable here because
  docs/specs/methodology change slowly and are re-synced deliberately (`--mode deep`).
- **grep** drops to a fallback: quick literal string checks and non-code text.

**Serena answers better** (live, symbol-level):
1. *"Where is `renderEquipmentForm` defined and what is its exact current body?"* — `find_symbol` jumps
   into the 9,565-line `app.js` without reading it into context.
2. *"Everywhere the `safe` temperature / a `bcheck` stage value is read?"* — `find_referencing_symbols`
   gives live, exact references; grep over-matches and a graph snapshot can be stale.
3. *"Rename this symbol / replace just this function's body."* — `rename_symbol` / `replace_symbol_body`,
   surgical, no whole-file rewrite.
4. *"Give me the structure of `build.py`."* — `get_symbols_overview`, no full read.

**graphify answers better** (cross-corpus relationships, provenance, docs):
1. *"What spec section governs `equipPlan`, and which tests prove it?"* — spec↔code↔test provenance across
   Markdown + Python + tests (§10.13). No LSP edge exists from a doc to a function.
2. *"Does this claim contradict a `REFUTED` verdict in the ULTIMATE gaps doc?"* — reasoning across the
   141-gap analysis + sources.
3. *"How do Serena / Playwright / a vendor API work?"* — the global docs graph (§10.11). Serena can't read
   anything outside this repo's code.
4. *"Which `safe` values in `data.py` trace to which primary source in `sources.py` + `baldwin-backbone.md`?"*
   — a provenance chain from data to citation, a cross-file *semantic* relationship, not a symbol reference.

**Where they compose (the intended workflow):**
> graphify answers *what governs `equipPlan` and what tests cover it* (provenance) → Serena jumps to the
> `equipPlan` symbol, shows its live body and every live caller, and makes the surgical edit → after the
> change, `graphify update --mode deep` refreshes the doc/spec graph. **graphify locates the *why / what
> governs*; Serena executes the *where / edit-now*.**

### When-to-use-which

| Question / task | Tool | Why |
|---|---|---|
| Find a symbol's definition / jump to it | **Serena** | Live LSP, no full-file read |
| Find all references / callers of a symbol | **Serena** | Exact, live; beats grep over-matching + graph staleness |
| Surgical edit: rename, replace body, insert near a symbol | **Serena** | Symbol-scoped edit, no whole-file rewrite |
| Outline a file's structure | **Serena** | `get_symbols_overview` |
| "What spec / requirement governs this code?" | **graphify** | Doc↔code provenance; no LSP edge |
| "What tests prove this function?" (spec↔code↔test) | **graphify** | Cross-corpus relationship |
| "Does this contradict a REFUTED verdict / prior finding?" | **graphify** | Reasoning over the analysis corpus |
| Tool/framework/vendor-API docs | **graphify** (global graph, §10.11) | Serena only sees this repo's code |
| Safety-value → primary-source provenance | **graphify** | Data→citation chain across files |
| Quick literal string / non-code text check | **grep** (fallback) | Cheap when neither structure nor relationship is needed |

> Deposit note (recommendation, not done here — graphify is owned by a separate subagent per CLAUDE.md
> §10.11's usefulness gate): the Serena docs already live in the global graph as `serena-docs`; no action
> needed. This project's private `.serena/` memories must **never** be deposited into any shared/global graph.

## References

- Serena — repo & README: https://github.com/oraios/serena
- Serena — docs (install, clients, contexts, language support): https://oraios.github.io/serena/
- Serena docs mirrored in the graphify global graph: `serena-docs-01..26` (`~/.graphify/global-graph.json`)
- Claude Code MCP (scopes, project `.mcp.json` schema, approval): https://code.claude.com/docs/en/mcp
