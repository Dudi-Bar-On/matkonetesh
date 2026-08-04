# Serena adoption — semantic code navigation for this project

> ⚠️ **2026-08-05 — `graphify` was removed from this project.** Any instruction below that names it, `graphify-out/`, `/graphify` or `check-graph-fresh` is a **record of what was done at the time**, not something to run. The live equivalents are:
> `python scripts/memsync.py` (ingest, delta by content hash) · `--query "<text>"` / `--tool <name>` (search) · `python scripts/memenrich.py` (embeddings, never blocking) · `node scripts/check-memory-fresh.mjs` (the gate). See discipline §10.11–§10.13.


> Status: **live and in daily use** (verified 2026-07-24 — see `serena-first-use.md`). Serena 1.6.1 /
> server 1.28.1 is installed, all 8 languages activated, 39 tools exposed.
> **Since 2026-07-24 the transport is a single shared HTTP server, not per-agent stdio** — see
> [§6](#6-1017a--one-shared-server-streamable-http-not-per-agent-stdio), which supersedes the stdio
> `.mcp.json` shown in [§3](#3-setup-done-in-this-task-config-only--cannot-run-serena-without-uv).
> §3/§4 below are kept as the historical record of the original setup.

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
ingested into the agent-memory **global** graph as `serena-docs-01..26`, queried first per CLAUDE.md §10.11;
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

## 5. agent-memory ↔ Serena — division of labor

The two tools are **complementary, not competing**, and the split cleanly resolves the standing critique of
agent-memory (it's a *snapshot*, and it loses to grep for locate-exact):

- **Serena owns live code** — always-fresh (live LSP), symbol-accurate. It takes over *locate-exact* and
  *edit-exact* from both grep and agent-memory. This is agent-memory's weak axis, now covered.
- **agent-memory owns everything with no LSP edge** — relationships that span *documents and code and tests*,
  methodology, vendor/API docs, and spec↔code↔test provenance. A language server sees only symbols in this
  repo's code; it cannot connect a Markdown spec line to the function it governs, cannot read Serena's own
  docs, and cannot reason across the 141-gap analysis. agent-memory's staleness is tolerable here because
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

**agent-memory answers better** (cross-corpus relationships, provenance, docs):
1. *"What spec section governs `equipPlan`, and which tests prove it?"* — spec↔code↔test provenance across
   Markdown + Python + tests (§10.13). No LSP edge exists from a doc to a function.
2. *"Does this claim contradict a `REFUTED` verdict in the ULTIMATE gaps doc?"* — reasoning across the
   141-gap analysis + sources.
3. *"How do Serena / Playwright / a vendor API work?"* — the global docs graph (§10.11). Serena can't read
   anything outside this repo's code.
4. *"Which `safe` values in `data.py` trace to which primary source in `sources.py` + `baldwin-backbone.md`?"*
   — a provenance chain from data to citation, a cross-file *semantic* relationship, not a symbol reference.

**Where they compose (the intended workflow):**
> agent-memory answers *what governs `equipPlan` and what tests cover it* (provenance) → Serena jumps to the
> `equipPlan` symbol, shows its live body and every live caller, and makes the surgical edit → after the
> change, `agent-memory update --mode deep` refreshes the doc/spec graph. **agent-memory locates the *why / what
> governs*; Serena executes the *where / edit-now*.**

### When-to-use-which

| Question / task | Tool | Why |
|---|---|---|
| Find a symbol's definition / jump to it | **Serena** | Live LSP, no full-file read |
| Find all references / callers of a symbol | **Serena** | Exact, live; beats grep over-matching + graph staleness |
| Surgical edit: rename, replace body, insert near a symbol | **Serena** | Symbol-scoped edit, no whole-file rewrite |
| Outline a file's structure | **Serena** | `get_symbols_overview` |
| "What spec / requirement governs this code?" | **agent-memory** | Doc↔code provenance; no LSP edge |
| "What tests prove this function?" (spec↔code↔test) | **agent-memory** | Cross-corpus relationship |
| "Does this contradict a REFUTED verdict / prior finding?" | **agent-memory** | Reasoning over the analysis corpus |
| Tool/framework/vendor-API docs | **agent-memory** (global graph, §10.11) | Serena only sees this repo's code |
| Safety-value → primary-source provenance | **agent-memory** | Data→citation chain across files |
| Quick literal string / non-code text check | **grep** (fallback) | Cheap when neither structure nor relationship is needed |

> Deposit note (recommendation, not done here — agent-memory is owned by a separate subagent per CLAUDE.md
> §10.11's usefulness gate): the Serena docs already live in the global graph as `serena-docs`; no action
> needed. This project's private `.serena/` memories must **never** be deposited into any shared/global graph.

## 6. §10.17a — ONE shared server (streamable-HTTP), not per-agent stdio

> Wired 2026-07-24 per `development-discipline.md` **§10.17a** (owner instruction). This section is the
> authority on how Serena is connected; the stdio block in §3 is history.

### The problem it fixes

With the stdio form (`command` + `args`) **every Claude Code subagent starts its own
`serena start-mcp-server`**: the client owns the server lifecycle and each client is a separate process.
Observed 2026-07-24: 4 concurrent Serena processes, dashboards flapping 24282 → 24283 (a bookmarked
dashboard points at a dead instance), 8 language servers duplicated per instance. Measured on the live
stdio instance during this task: one instance = `serena.exe` → `python.exe` → `python.exe` (+ a
multiprocessing child) plus 8 language-server processes.

### What the docs actually say (read before implementing — §10.17/§10.11)

From Serena's own docs (`serena-docs-06.md`, "Running the MCP Server", mirrored in the agent-memory global
graph as `serena-docs-01..26`; confirmed against `serena start-mcp-server --help`, Serena 1.6.1):

- **Streamable HTTP is the current self-hosted transport:** *"When using Streamable HTTP mode, you control
  the server lifecycle yourself, i.e. you start the server and provide the client with the URL to connect
  to it. … `serena start-mcp-server --transport streamable-http --port <port>` … and then configure your
  client to connect to `http://localhost:9121/mcp`."*
- **SSE is legacy:** *"The legacy SSE transport is also supported (via `--transport sse` with corresponding
  /sse endpoint), its use is discouraged."* → §10.17a's sketch said "SSE / streamable-HTTP"; the docs
  settle it — **streamable-http**, endpoint `/mcp`, not `/sse`.
- **The one-project caveat that makes sharing legal here:** *"Serena is a stateful MCP server, and only one
  coding project can be active at a time. Therefore, starting a single Serena instance and connecting it to
  multiple clients is only appropriate if all clients will be working on the same project."* Our main
  session and all its subagents work on this repo → correct. **A second repo must not point at this
  server** — give it its own port/instance.
- `--host` defaults to `127.0.0.1`; remote connections require opening it deliberately (we do not).
- The **dashboard port is not a CLI flag** — Serena's global config comments say base **24282**, and *"actual
  port may be higher if you have multiple instances running; try ports 24283, 24284"*. One server ⇒ one
  dashboard port. Only `--enable-web-dashboard` / `--open-web-dashboard` are CLI-settable.

From Claude Code's MCP docs (`claude-code-docs-53.md`, "Transport types"): *"For the streamable HTTP
transport, use `\"type\": \"http\"` … In `.mcp.json` and other JSON config files, `\"streamable-http\"` is
accepted as an alias for `\"http\"`."*

### The wiring

**Server** — `scripts/serena-server.ps1` (committed; `-Action start|stop|status|restart`):

```powershell
pwsh scripts/serena-server.ps1 -Action start    # idempotent: no-op if port 9121 already listens
pwsh scripts/serena-server.ps1 -Action status   # processes + ports + dashboard + live MCP probe
pwsh scripts/serena-server.ps1 -Action stop     # verified teardown, no orphans
```

It launches exactly:

```
serena start-mcp-server --transport streamable-http --host 127.0.0.1 --port 9121 \
  --context claude-code --project "<repo root>" --enable-web-dashboard true --open-web-dashboard false
```

- **Detachment:** the launch goes through **WMI `Win32_Process.Create`**, so the server's parent is
  `WmiPrvSE.exe` — it is in no shell's process tree and no Claude Code job object, and therefore survives
  the agent, the shell and the whole session. (Verified: parent PID resolved to `WmiPrvSE.exe`.)
- **Logs:** `%USERPROFILE%\.serena\shared-server\server.log`; PID record `…\server.pid.json`.
- **Teardown safety (§11a):** `stop` only kills processes whose command line matches **all three** of
  `start-mcp-server` + `streamable-http` + `--port <port>`, so it can never kill a stdio Serena instance
  belonging to a live Claude session. It then verifies zero matching processes remain **and** the port is
  free, and exits non-zero if not.

**Client** — repo-root `.mcp.json` (tracked in git) is now the URL form:

```json
{
  "mcpServers": {
    "serena": {
      "type": "http",
      "url": "http://127.0.0.1:9121/mcp"
    }
  }
}
```

**One-edit revert** to the pre-2026-07-24 per-agent stdio behaviour (kept here because `.mcp.json` must
stay strict JSON — Claude Code's loader validates it, so no comment/extra key is put in the file):

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

### The trade the URL form makes — read this before blaming Serena

With stdio, Claude Code **started** Serena for you. With a URL, it does **not**: if the shared server is
not running, `serena` simply shows as failed/disconnected and no tools appear. So:

1. `pwsh scripts/serena-server.ps1 -Action start` **before** (or right at) the start of a session — it is
   idempotent and cheap when already up.
2. Changing `.mcp.json` **resets project-scope approval** — `claude mcp get serena` reports
   *"⏸ Pending approval"* after the edit. Approve once at the next session start (`/mcp`, or the trust
   prompt) or the server stays inert.
3. Optional convenience: register `-Action start` as a logon task (Task Scheduler) so it is always up.

### Verification performed (2026-07-24)

| Check | Result |
|---|---|
| Server process tree | `cmd.exe 12152 → serena.exe 49532 → python 40952 → python 63328` — **one** instance |
| Listening on 9121 | `127.0.0.1:9121` owned by PID 63328 (exactly one listener) |
| Dashboard | `127.0.0.1:24283` owned by the same PID — one dashboard for this server |
| MCP handshake | `POST /mcp initialize` → **HTTP 200**, `serverInfo {"name":"Serena","version":"1.28.1"}` |
| Tool resolution | `tools/list` → **39 tools** over the URL |
| Real tool call | `tools/call get_symbols_overview(build.py)` → HTTP 200, real symbol list (LSP alive) |
| Project activated | log: `Activating matconetesh at C:\Users\dudib\source\repos\matconetesh` |
| Claude Code parses it | `claude mcp get serena` → `Scope: Project · Type: http · URL: http://127.0.0.1:9121/mcp` |
| Detached | launcher's parent is `WmiPrvSE.exe`, not a shell |

**Not provable until the next session start** (the session that wired this was already attached to a stdio
Serena; that instance was deliberately left alone so as not to break the live session — it is the one
holding dashboard port 24282):

- that Claude Code's **main session** connects over the URL,
- that **subagents share it** (the whole point: no new `serena start-mcp-server` per agent),
- that only **one dashboard port** is listening machine-wide.

Prove them at the next session start, after approving the server:

```powershell
# 1. server up, and Claude Code sees the URL form
pwsh scripts/serena-server.ps1 -Action status
claude mcp list                       # serena … ✔ Connected  (http)

# 2. exactly ONE serena instance, ZERO stdio spawns — run this WHILE 2+ subagents use Serena tools
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*start-mcp-server*' } |
  Select-Object ProcessId, ParentProcessId, Name, CommandLine | Format-List
#   expect: only the streamable-http tree; NO '--project-from-cwd' stdio entries

# 3. exactly ONE dashboard port
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -ge 24282 -and $_.LocalPort -le 24292 }
#   expect: a single row (24282 once the old stdio instance is gone)
```

## References

- Serena — repo & README: https://github.com/oraios/serena
- Serena — docs (install, clients, contexts, language support): https://oraios.github.io/serena/
- Serena docs mirrored in the agent-memory global graph: `serena-docs-01..26` (`~/.agent-memory/global-graph.json`)
- Serena — running the MCP server / Streamable HTTP mode (§6's quotes): https://oraios.github.io/serena/02-usage/020_start_mcp_server.html
- Serena — dashboard (port 24282 base, config options): https://oraios.github.io/serena/02-usage/060_dashboard.html
- Claude Code MCP (scopes, project `.mcp.json` schema, approval): https://code.claude.com/docs/en/mcp
- Claude Code — MCP transport types (`"type": "http"` for streamable HTTP): mirrored in the global graph as `claude-code-docs-53`
