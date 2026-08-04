---
name: serena-docs-23
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 23/26 (docs)"
type: reference
---

#### Kotlin

Serena uses [JetBrains' Kotlin Language Server](https://github.com/Kotlin/kotlin-lsp) for Kotlin support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the Kotlin Language Server executable path. |
| `kotlin_lsp_version` | `261.13587.0` | Override the Kotlin Language Server version Serena downloads when `ls_path` is not set. |
| `jvm_options` | `-Xmx2G` | Value assigned to `JAVA_TOOL_OPTIONS` for the Kotlin LS process. Set to `""` to disable JVM options entirely. |

Example:

```yaml
ls_specific_settings:
  kotlin:
    kotlin_lsp_version: "261.13587.0"
    jvm_options: "-Xmx4G -XX:+UseG1GC"
```

#### Lean 4

Serena uses `lean --server` for Lean 4 support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | `lean` from PATH | Override the `lean` executable path. Serena does not manage Lean downloads. |

#### Lua

Serena uses `lua-language-server` for Lua support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `lua_language_server_version` | `3.15.0` | Override the bundled `lua-language-server` version Serena downloads when it cannot use an existing installation from PATH or common install locations. |


#### Luau

Serena uses [`luau-lsp`](https://github.com/JohnnyMorganz/luau-lsp) for Luau support.

**Runtime Requirements:**

- `luau-lsp` is used from PATH if available.
- Otherwise, Serena downloads the pinned `luau-lsp` release for the current platform.

**Configuration:**

```yaml
ls_specific_settings:
  luau:
    ls_path: "/path/to/luau-lsp"            # Optional: override the language server executable
    luau_lsp_version: "1.63.0"              # Optional: override the bundled luau-lsp version
    platform: "roblox"                      # "roblox" (default) or "standard"
    roblox_security_level: "PluginSecurity" # Roblox only: None, PluginSecurity, LocalUserSecurity, RobloxScriptSecurity
```

Notes:
- In `roblox` mode, Serena downloads Roblox definitions and Roblox API docs and passes them to `luau-lsp`.
- In `standard` mode, Serena skips Roblox definitions and only downloads the standard Luau docs bundle.

#### Markdown

Serena uses [Marksman](https://github.com/artempyanykh/marksman) for the `markdown` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed download | Override the `marksman` executable path. |
| `marksman_version` | `2024-12-18` | Override the Marksman release tag Serena downloads when `ls_path` is not set. |

#### MATLAB

Serena uses the official MathWorks MATLAB language server from the VS Code extension.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `matlab_path` | auto-detected | Path to the MATLAB installation. This overrides `MATLAB_PATH` and auto-detection, but not Serena's managed extension download. |
| `matlab_extension_version` | `1.3.9` | Override the MathWorks VS Code extension version Serena downloads. |

#### Nix

Serena uses [nixd](https://github.com/nix-community/nixd) for Nix support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | PATH/common-path discovery followed by managed installation | Absolute path to a nixd executable or launcher. When set, Serena bypasses its nixd discovery, installation, and version check. |
| `config_path` | `null` | Absolute path to a UTF-8 JSON file containing the value of the `nixd` settings section. A leading `~` is expanded. |

Example:

```yaml
ls_specific_settings:
  nix:
    ls_path: /absolute/path/to/nixd-project
    config_path: /absolute/path/to/nixd-settings.json
```

The JSON document contains the settings object directly, without an outer `nixd` key:

```json
{
  "formatting": {
    "command": ["alejandra"]
  },
  "nixpkgs": {
    "expr": "import <nixpkgs> { }"
  },
  "options": {}
}
```

Serena loads this file once when creating the language server, uses it as nixd's `initializationOptions`, and serves the same effective
settings through LSP `workspace/configuration` requests. Existing `initializationOptions` configured under `ls_specific_settings.nix`
remain top-level overrides and are reflected in both paths. Restart Serena after changing the JSON file.


#### Pascal (`pasls`)

Serena uses [pasls](https://github.com/genericptr/pascal-language-server) (Pascal Language Server) for Pascal/Free Pascal support.

**Language Server Installation:**

1. If `pasls` is found in your system PATH, Serena uses it directly
2. Otherwise, Serena automatically downloads a prebuilt binary from GitHub releases

Supported platforms for automatic download: Linux (x64, arm64), macOS (x64, arm64), Windows (x64).

**Auto-Update:**

Serena automatically checks for pasls updates every 24 hours. Updates include:
- SHA256 checksum verification before installation
- Atomic update with rollback on failure
- Windows file locking detection (defers update if pasls is in use)

**Configuration:**

Configure pasls via `ls_specific_settings.pascal` in `serena_config.yml`:

| Setting          | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `pasls_version`  | Override the pinned pasls version Serena downloads by default               |
| `pp`             | Path to FPC compiler driver (must be `fpc` or `fpc.exe`, not `ppc386.exe`)  |
| `fpcdir`         | Path to FPC source directory                                                |
| `lazarusdir`     | Path to Lazarus directory (required for LCL projects)                       |
| `fpc_target`     | Target OS override (e.g., `Win32`, `Win64`, `Linux`)                        |
| `fpc_target_cpu` | Target CPU override (e.g., `i386`, `x86_64`, `aarch64`)                     |

Example configuration:

```yaml
ls_specific_settings:
  pascal:
    pp: "D:/laz32/fpc/bin/i386-win32/fpc.exe"
    fpcdir: "D:/laz32/fpcsrc"
    lazarusdir: "D:/laz32/lazarus"
```

Notes:
- The `pp` setting is the most important for hover and navigation to work correctly.
- Use the FPC compiler driver (`fpc`/`fpc.exe`), not backend compilers like `ppc386.exe`.
- These settings are passed as environment variables to the pasls process.
