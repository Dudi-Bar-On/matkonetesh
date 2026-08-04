---
name: serena-docs-19
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 19/26 (docs)"
type: reference
---

#### Angular

Serena uses `@angular/language-server` (`ngserver`) for the `angular` language key, orchestrated together with a
companion `typescript-language-server` (with `@angular/language-service` loaded as a tsserver plugin) and a
companion `vscode-html-language-server` for `.html` `documentSymbol`. This is an **experimental** language and
must be explicitly listed in `project.yml`; it is not auto-detected.

**Project requirements:**

- The project itself must have `@angular/core` installed (i.e. `npm install` must have been run in the project root,
  or in a workspace root above it for monorepo layouts). Without it, `ngserver` reports every file as "not in an
  Angular project" and template-aware features silently return empty.
- A `tsconfig.json` must be reachable at or above any opened `.ts` file.
- Do **not** also list `typescript` or `html` in `languages` when `angular` is active — Angular subsumes both
  for `.ts` / `.html` files. SCSS is **not** subsumed; list `scss` separately if needed.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `angular_language_server_version` | `21.2.10` | Override the bundled `@angular/language-server` npm package version Serena installs. |
| `angular_language_service_version` | `21.2.10` | Override the bundled `@angular/language-service` tsserver plugin version. |
| `typescript_version` | `5.9.3` | Override the bundled `typescript` npm package version. Falls back to `ls_specific_settings.typescript.typescript_version` if unset. |
| `typescript_language_server_version` | `5.1.3` | Override the bundled `typescript-language-server` version. Falls back to `ls_specific_settings.typescript.typescript_language_server_version` if unset. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. Falls back to `ls_specific_settings.typescript.npm_registry` if unset. |

Notes:
- The HTML companion (`vscode-html-language-server`) is configured via `ls_specific_settings.html` — see the HTML section below.
- `ls_path` is not supported (see note above the AL section).

#### Ansible

Serena uses `@ansible/ansible-language-server` for the `ansible` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `ansible-language-server` executable path. |
| `ansible_language_server_version` | `1.2.3` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |
| `ansible_path` | `"ansible"` | Path to the `ansible` executable forwarded to the language server. |
| `ansible_settings` | `null` | Full Ansible LS settings dict, deep-merged on top of Serena's defaults. |
| `lint_enabled` | `false` | Enable `ansible-lint` integration. |
| `lint_path` | `"ansible-lint"` | Path to the `ansible-lint` executable. |
| `python_interpreter_path` | `"python3"` | Python interpreter path forwarded to the language server. |
| `python_activation_script` | `""` | Virtualenv activation script forwarded to the language server. |

#### Bash

Serena uses `bash-language-server` for Bash support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `bash-language-server` executable path. |
| `bash_language_server_version` | `5.6.0` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |

#### BSL (1C:Enterprise / OneScript)

Serena uses [bsl-language-server](https://github.com/1c-syntax/bsl-language-server) by 1c-syntax
for BSL support. The JAR is downloaded automatically on first use and SHA-256-verified for the
bundled default version. **Requires Java 21+ on `PATH`** — bsl-language-server v0.29.0 is built
with `targetCompatibility = JavaVersion.VERSION_21` and fails to launch under older JDKs.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the path to an existing `bsl-language-server-*-exec.jar`. When set, Serena does not download anything; the JAR is launched directly via `java -jar`. |
| `bsl_ls_version` | `0.29.0` | Override the bsl-language-server release version Serena downloads when `ls_path` is not set. SHA-256 verification is performed only for the default version; user-overridden versions install without SHA verification. |

Example:

```yaml
ls_specific_settings:
  bsl:
    bsl_ls_version: "0.29.0"
    # ls_path: "/opt/bsl/bsl-language-server-0.29.0-exec.jar"  # optional
```

#### Clojure

Serena uses `clojure-lsp` for Clojure support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the `clojure-lsp` executable path. |
| `clojure_lsp_version` | `2026.02.20-16.08.58` | Override the `clojure-lsp` release version Serena downloads when `ls_path` is not set. |
| `source_paths` | scanned from project descriptors (or unset if a project-local `.lsp/config.edn` is found) | Explicit list of repo-root-relative source paths to inject into clojure-lsp's `initializationOptions`. Use this when the auto-discovery picks up too few or too many paths. |
| `config_edn_path` | unset | Path to a `config.edn` file whose `:source-paths` entry should be parsed and injected. Useful when the project's clojure-lsp config lives outside the standard `.lsp/config.edn` location. |

**Why this exists**: clojure-lsp discovers source paths only from the project descriptor at the workspace root (root `deps.edn` / `project.clj` / `shadow-cljs.edn` / `bb.edn`) and does not recurse for sub-module descriptors. In multi-module monorepos (e.g. `common/` + `frontend/` + `backend/` layouts), this means references in sibling modules are silently missed by `find_referencing_symbols` until a tool call happens to open one of their files. Serena works around this by walking the repo for project descriptors at startup and passing the union of their declared source paths to clojure-lsp via `initializationOptions["source-paths"]`.

**Resolution order** (first match wins):

1. `source_paths` setting — explicit override.
2. `config_edn_path` setting — Serena parses `:source-paths` from the supplied file.
3. `<repo>/.lsp/config.edn` exists — Serena injects nothing; clojure-lsp reads the file natively, so hand-tuned project configs are never clobbered.
4. Walk the repo for project descriptors and synthesise a source-paths list from their declared `:paths` / `:extra-paths` / `:source-paths` (skipping `.git`, `.clj-kondo`, `.lsp`, `.cpcache`, `node_modules`, `target`, `out`, `dist`).

Example — a monorepo without a `.lsp/config.edn`, where you want to override what Serena scanned:

```yaml
ls_specific_settings:
  clojure:
    source_paths:
      - "common/src"
      - "common/test"
      - "frontend/src"
      - "backend/src"
```

#### C/C++ (`clangd`)

Serena uses `clangd` for the `cpp` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the `clangd` executable path. |
| `compile_commands_dir` | `.serena` | Directory where Serena writes a transformed `compile_commands.json` if the project's original database uses relative `directory` entries. |
| `clangd_version` | `19.1.2` | Override the `clangd` version Serena downloads when `ls_path` is not set. |
