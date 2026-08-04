---
name: serena-docs-20
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 20/26 (docs)"
type: reference
---

#### C/C++ via `ccls`

Serena uses the `cpp_ccls` language key for `ccls`.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | `ccls` from PATH | Override the `ccls` executable path. Serena does not manage `ccls` downloads or installs. |


#### C# (Roslyn Language Server)

Serena uses [Microsoft's Roslyn Language Server](https://github.com/dotnet/roslyn) for C# support.

**Runtime Requirements:**

- .NET 10 or higher is required. If not found in PATH, Serena automatically installs it using Microsoft's official install scripts.
- The Roslyn Language Server is automatically downloaded from NuGet.org.

**Supported Platforms:**

Automatic download is supported for: Windows (x64, ARM64), macOS (x64, ARM64), Linux (x64, ARM64).

**Configuration:**

The `runtime_dependencies` setting allows you to override the download URLs for the Roslyn Language Server. This is useful if you need to use a private package mirror or a specific version.
For the common case of changing only the package version, use `csharp_language_server_version`.

Example configuration to override the language server download URL:

```yaml
ls_specific_settings:
  csharp:
    csharp_language_server_version: "5.5.0-2.26078.4"
    runtime_dependencies:
      - id: "CSharpLanguageServer"
        platform_id: "linux-x64"  # or win-x64, win-arm64, osx-x64, osx-arm64, linux-arm64
        url: "https://your-mirror.example.com/roslyn-language-server.linux-x64.5.5.0-2.26078.4.nupkg"
        package_version: "5.5.0-2.26078.4"
```

Available fields for `runtime_dependencies` entries:

| Field             | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `id`              | Dependency identifier (use `CSharpLanguageServer`)                          |
| `platform_id`     | Target platform: `win-x64`, `win-arm64`, `osx-x64`, `osx-arm64`, `linux-x64`, `linux-arm64` |
| `url`             | Download URL for the NuGet package                                          |
| `package_version` | Package version string                                                      |
| `extract_path`    | Path within the package to extract (default: `tools/net10.0/<platform>`)    |

Notes:
- Only specify the platforms you want to override; others will use the defaults.
- The language server package is a `.nupkg` file (ZIP format) downloaded from NuGet.org by default.
- If you have .NET 10+ already installed, Serena will use your system installation.

#### C# (`OmniSharp`)

Serena uses the `csharp_omnisharp` language key for OmniSharp.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `omnisharp_version` | `1.39.10` | Override the OmniSharp version Serena downloads. |
| `razor_omnisharp_version` | `7.0.0-preview.23363.1` | Override the Razor OmniSharp plugin version Serena downloads. |

#### Dart

Serena uses the Dart SDK's built-in language server for Dart support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `dart_sdk_version` | `3.7.1` | Override the Dart SDK version Serena downloads. |

#### Elixir

Serena uses [Expert](https://github.com/elixir-lang/expert) for Elixir support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `expert_version` | `v0.1.0-rc.6` | Override the Expert version Serena downloads when it does not use an `expert` executable already found in PATH. |

#### Elm

Serena uses `@elm-tooling/elm-language-server` for Elm support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `elm_language_server_version` | `2.8.0` | Override the npm package version Serena installs when no system `elm-language-server` is found. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |

#### F#

Serena uses FsAutoComplete (Ionide LSP) for F# support.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `fsautocomplete_version` | `0.83.0` | Override the FsAutoComplete version Serena installs as a .NET tool. |


#### GDScript (Godot Engine)

Serena connects to the Godot editor's built-in LSP server over TCP. No separate process is launched.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `port` | `6008` | TCP port the running Godot editor listens on for LSP connections. |
| `request_timeout` | `30.0` | Seconds to wait for a response from the Godot LSP server. |

Example:

```yaml
ls_specific_settings:
  gdscript:
    port: 6008
    request_timeout: 60.0
```


#### Go (`gopls`)

Serena forwards `ls_specific_settings.go.gopls_settings` to `gopls` as LSP `initializationOptions` when the Go language server is started.

Example: enable build tags and set a build environment:

```yaml
ls_specific_settings:
  go:
    gopls_settings:
      buildFlags:
        - "-tags=foo"
      env:
        GOOS: "linux"
        GOARCH: "amd64"
        CGO_ENABLED: "0"
```

Notes:
- To enable multiple tags, use `"-tags=foo,bar"`.
- `gopls_settings.env` values are strings.
- `GOFLAGS` (from the environment you start Serena in) may also affect the Go build context. Prefer `buildFlags` for tags.
- Build context changes are only picked up when `gopls` starts. After changing `gopls_settings` (or relevant env vars like `GOFLAGS`), restart the Serena process (or server) that hosts the Go language server, or use your client's "Restart language server" action if it causes `gopls` to restart.

#### Groovy

Serena uses a user-provided Groovy Language Server JAR for Groovy support. If `ls_java_home_path` is not set, Serena downloads
a bundled Java runtime for launching that JAR.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_jar_path` | required | Path to the Groovy Language Server JAR |
| `ls_java_home_path` | `null` | Path to a Java installation to use instead of Serena's managed runtime |
| `ls_jar_options` | `""` | Additional options passed when launching the Groovy LS JAR |
| `vscode_java_version` | `1.42.0-561` | Override the bundled Java runtime bundle version Serena downloads by default |

Note:
- When overriding `vscode_java_version`, Serena still assumes that the downloaded runtime bundle keeps the same internal
  directory layout and file names as the bundled default version.

Example:

```yaml
ls_specific_settings:
  groovy:
    ls_jar_path: "/path/to/groovy-language-server-all.jar"
    vscode_java_version: "1.42.0-561"
```

#### HLSL

Serena uses `shader-language-server` for the `hlsl` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install or build | Override the `shader-language-server` executable path. |
| `version` | `1.3.1` | Override the bundled version Serena downloads, or builds from source on macOS, when `ls_path` is not set. |
