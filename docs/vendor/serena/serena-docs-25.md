---
name: serena-docs-25
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 25/26 (docs)"
type: reference
---

#### SCSS / Sass / CSS

Serena uses [`some-sass-language-server`](https://github.com/wkillerud/some-sass) for the `scss` language key.
**Experimental** — must be explicitly listed in `project.yml`; not auto-detected. Some Sass was chosen over the
generic `vscode-css-language-server` because it provides full workspace-wide `@use` / `@forward` go-to-definition
and find-references for variables, mixins, functions, and placeholders.

Handles `.scss`, `.sass`, and `.css`. The three are dispatched by the LSP language id (`scss`, `sass`, `css`) and
share the same engine; CSS feature toggles default to off upstream and Serena flips them on at startup so that
plain CSS gets symbols, definitions, references, hover, and completion. Lint diagnostics are deliberately left
off (the rules are opinionated about vendor prefixes / empty rules / etc.); only syntax-level diagnostics surface.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `some-sass-language-server` executable path. |
| `some_sass_version` | `2.3.8` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |

#### Solidity

Serena uses `@nomicfoundation/solidity-language-server` for Solidity support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the Solidity language server executable path. |
| `solidity_language_server_version` | `0.8.4` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |

#### SystemVerilog

Serena uses `verible-verilog-ls` for SystemVerilog support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | system PATH or managed download | Override the `verible-verilog-ls` executable path. |
| `verible_version` | `v0.0-4051-g9fdb4057` | Override the Verible release Serena downloads when `ls_path` is not set and no system installation is found. |

#### Terraform

Serena uses `terraform-ls` for Terraform support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `terraform_ls_version` | `0.36.5` | Override the `terraform-ls` version Serena downloads. Terraform itself must still be installed and available in PATH. |

#### TOML

Serena uses [Taplo](https://github.com/tamasfe/taplo) for the `toml` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the `taplo` executable path. |
| `taplo_version` | `0.10.0` | Override the Taplo version Serena downloads when `ls_path` is not set. |

#### TypeScript

Serena uses `typescript-language-server` for the `typescript` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `typescript-language-server` executable path. |
| `typescript_version` | `5.9.3` | Override the bundled `typescript` npm package version Serena installs when `ls_path` is not set. |
| `typescript_language_server_version` | `5.1.3` | Override the bundled `typescript-language-server` npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |
| `indexing_timeout` | `30.0` | Timeout in seconds for waiting on tsserver's `$/progress` project-indexing signal to *drain* once it has started (both at startup and before the first cross-file reference query). If indexing does not complete within this window, Serena logs a warning and proceeds anyway. Increase it for very large projects. |
| `server_ready_timeout` | `10.0` | Timeout in seconds for waiting on the server-ready signal after initialization. If the signal does not arrive within this window, Serena logs a message and proceeds anyway. |
| `indexing_start_grace` | `5.0` | Timeout in seconds to wait for tsserver to *start* reporting `$/progress` before the first cross-file reference query. tsserver must resolve the project graph before it can emit the first progress token, and that can take longer than the default on a very large project; if it takes longer than this window, Serena assumes no indexing was needed and may return incomplete cross-file references. Raising `indexing_timeout` alone does not help here, since this grace elapses first. Increase this for very large projects if `find_referencing_symbols`/`request_references` returns incomplete results shortly after project load. |

#### Svelte

Serena uses `svelte-language-server` for the `svelte` language key. Use `svelte` for Svelte projects instead of also listing `typescript`, unless you intentionally want multiple language servers active for the same files.

A companion TypeScript language server (`typescript-language-server` + `typescript-svelte-plugin`) is spawned automatically alongside the Svelte LSP. The plugin makes the TypeScript program `.svelte`-aware so that cross-file operations — rename, go-to-definition, and find-references from `.ts`/`.js` files — correctly include `.svelte` consumers. Serena merges and deduplicates reference results from both servers automatically.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `svelteserver` executable path. |
| `svelte_language_server_version` | `0.18.0` | Override the `svelte-language-server` npm package version Serena installs. |
| `typescript_version` | `6.0.3` (falls back to `ls_specific_settings.typescript.typescript_version`) | Override the `typescript` npm package version used as the shared tsdk. |
| `typescript_language_server_version` | `5.1.3` (falls back to `ls_specific_settings.typescript.typescript_language_server_version`) | Override the `typescript-language-server` npm package version for the companion server. |
| `typescript_svelte_plugin_version` | `0.3.52` | Override the `typescript-svelte-plugin` npm package version used for `.svelte`-aware TS resolution. |
| `npm_registry` | `null` | Override the npm registry Serena uses for all managed installs. |
| `indexing_timeout` | `120.0` (falls back to `ls_specific_settings.typescript.indexing_timeout`) | Timeout in seconds for the companion TS server to finish indexing `.svelte` files. On timeout, startup fails with a diagnostic indexing-state summary instead of serving cross-file results from a partially indexed program. |
| `initialization_options_configuration` | `{}` | Deep-merge overrides for any of the ten plugin configuration sections (`svelte`, `prettier`, `emmet`, `typescript`, `javascript`, `js/ts`, `css`, `less`, `scss`, `html`). |

Unlike the plain TypeScript server, the companion is strict about readiness: it raises on server-ready and
indexing timeouts instead of proceeding with a cold or partially indexed program (which would silently degrade
cross-file renames and references). The companion reads `server_ready_timeout` and `indexing_timeout` from
`ls_specific_settings.typescript` with raised defaults (30s and 120s respectively); `ls_specific_settings.svelte.indexing_timeout`
takes precedence for the `.svelte`-file indexing wait.

All four packages are tracked via a version file; changing any version setting triggers a clean reinstall.
