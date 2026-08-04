---
name: serena-docs-24
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 24/26 (docs)"
type: reference
---

#### Perl

Serena uses [Perl::LanguageServer](https://metacpan.org/pod/Perl::LanguageServer) for Perl support. Install Perl and the server with `cpanm Perl::LanguageServer`; Linux and macOS only (the server does not run on Windows).

Perl::LanguageServer only indexes files whose extension is in its `perl.fileFilter` and skips directories listed in `perl.ignoreDirs`. Both are exposed below so projects with non-standard extensions (e.g. `.cgi` / `.psgi` web handlers) can make those files visible (#1449).

**Configuration:**

Configure the language server via `ls_specific_settings.perl` in `serena_config.yml`:

| Setting        | Default                                                                                     | Description                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `file_filter`  | `[".pm", ".pl", ".t"]`                                                                      | File extensions (with leading dot) that Perl::LanguageServer should index, e.g. `[".pm", ".pl", ".t", ".cgi"]`. |
| `ignore_dirs`  | `[".git", ".svn", "blib", "local", ".carton", "vendor", "_build", "cover_db"]`             | Directory names Perl::LanguageServer should skip when indexing.                                               |

Example configuration:

```yaml
ls_specific_settings:
  perl:
    file_filter: [".pm", ".pl", ".t", ".cgi", ".psgi"]
    ignore_dirs: [".git", "blib", "local", "vendor", "cover_db"]
```

Notes:
- Extensions added via `file_filter` are also synced into Serena's Perl source-file matcher, so `find_symbol` and symbol indexing treat the same files as the language server. Defaults are unchanged when these keys are omitted.
- The matcher is reset on every language server activation, so one project's `file_filter` does not leak into another.

#### PHP (`Intelephense`)

Serena uses Intelephense for the `php` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `intelephense` executable path. |
| `intelephense_version` | `1.14.4` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |
| `ignore_vendor` | `true` | Ignore directories named `vendor` while indexing the project. |
| `maxFileSize` | unset | Forwarded as `intelephense.files.maxSize` in `initializationOptions`. |
| `maxMemory` | unset | Forwarded as `intelephense.maxMemory` in `initializationOptions`. |
| `file_filter` | unset | Additional file extensions (with leading dot) to treat as PHP sources, e.g. `[".module", ".install"]`; added to the defaults `.php` / `.phtml` (#1710). |

Example configuration making Drupal source files visible to the symbol tools:

```yaml
ls_specific_settings:
  php:
    file_filter: [".module", ".install", ".inc", ".theme", ".profile", ".engine"]
```

Notes:
- Extensions added via `file_filter` are synced into Serena's PHP source-file matcher and pushed to Intelephense as `intelephense.files.associations` globs at startup, so `find_symbol` and the language server treat the same files as PHP sources.
- The matcher is reset on every language server activation, so one project's `file_filter` does not leak into another.

#### PHP (`Phpactor`)

Serena uses the `php_phpactor` language key for Phpactor.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the Phpactor PHAR path. |
| `phpactor_version` | `2025.12.21.1` | Override the Phpactor PHAR version Serena downloads when `ls_path` is not set. |
| `ignore_vendor` | `true` | Ignore directories named `vendor` while indexing the project. |

#### PowerShell

Serena uses PowerShell Editor Services for PowerShell support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `pses_version` | `4.4.0` | Override the PowerShell Editor Services version Serena downloads. Serena still requires `pwsh` to be available locally. |

#### Python

Serena supports several Python language servers through separate language keys.

##### Pyright (`python`)

Pyright is the default Python language server.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `pyright_version` | `1.1.403` | Override the exact Pyright package version Serena launches through `uvx` / `uv tool run`. |
| `ls_path` | managed executable | Override `pyright-langserver` and bypass the managed `uvx` / `uv tool run` invocation. The default `--stdio` argument is still applied. |

##### BasedPyright (`python_basedpyright`)

To use [BasedPyright](https://github.com/DetachHead/basedpyright), select its separate experimental
language key:

```yaml
languages: [python_basedpyright]
ls_specific_settings:
  python_basedpyright:
    basedpyright_version: "1.39.9"
```

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `basedpyright_version` | `1.39.9` | Override the exact BasedPyright package version Serena launches through `uvx` / `uv tool run`. |
| `ls_path` | managed executable | Override `basedpyright-langserver` and bypass the managed `uvx` / `uv tool run` invocation. The default `--stdio` argument is still applied. |

The generic [language-server launch settings](override-ls-path), including `ls_base_cmd`, `ls_args`,
and `ls_extra_args`, apply to both servers. `ls_args` replaces the default arguments, while
`ls_extra_args` appends to them.

Other alternative Python language keys are `python_ty`, `python_pyrefly`, and `python_jedi`.

#### Ruby

Serena uses Shopify's `ruby-lsp` for Ruby support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ruby_lsp_version` | `0.26.8` | Override the `ruby-lsp` gem version Serena installs when no project-local or global `ruby-lsp` is already available. |

#### Rust

Serena uses `rust-analyzer` for Rust support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | auto-detected | Override the `rust-analyzer` executable path. Without `ls_path`, Serena prefers `rustup which rust-analyzer`, then `rustup component add rust-analyzer`, then PATH/common install locations. |

#### Scala

Serena uses Metals for Scala support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `metals_version` | `1.6.4` | Override the Metals version Serena bootstraps. |
| `client_name` | `Serena` | Client identifier sent to Metals. |
| `on_stale_lock` | `auto-clean` | How Serena handles stale Metals H2 database locks. Supported values: `auto-clean`, `warn`, `fail`. |
| `log_multi_instance_notice` | `true` | Log a notice when another Metals instance is detected. |
