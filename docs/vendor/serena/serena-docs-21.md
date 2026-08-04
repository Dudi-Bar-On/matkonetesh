---
name: serena-docs-21
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 21/26 (docs)"
type: reference
---

#### Haxe

Serena uses the [vshaxe/haxe-language-server](https://github.com/vshaxe/haxe-language-server) for Haxe support.
Requires Haxe compiler (3.4.0+) and Node.js.

The server is discovered in order: user-configured `ls_path`, system PATH, vshaxe VSCode extension, auto-download from Open VSX.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | auto-discovered | Path to the Haxe language server binary (e.g., `/path/to/server.js`). |
| `version` | `2.34.2` | Override the vshaxe extension version downloaded from Open VSX. SHA256 verification is only performed for the default version. |
| `buildFile` | auto-discovered `.hxml` | Relative path to the `.hxml` build file used for compilation (e.g., `build/debug.hxml`). If not set, Serena searches the project for `.hxml` files (max depth 5, skipping dependency directories). |
| `haxePath` | `haxe` from PATH | Path to the Haxe compiler executable. The LS delegates to this for code analysis. Useful when multiple Haxe versions are installed or when `haxe` is not on the PATH. |
| `renameSourceFolders` | not set (LS default) | List of source directories for scoping rename operations (e.g., `["src", "lib"]`). If not set, the Haxe LS uses its own defaults. |

Example (typically in `project.yml`, since these are project-specific):

```yaml
ls_specific_settings:
  haxe:
    buildFile: "build/debug.hxml"
    haxePath: "/usr/local/bin/haxe"
    renameSourceFolders: ["src", "lib"]
```

#### HTML

Serena uses `vscode-html-language-server` from Microsoft's `vscode-langservers-extracted` npm package for the
`html` language key. **Experimental** — must be explicitly listed in `project.yml`; not auto-detected. The HTML
LSP returns in-file element / id symbols via `documentSymbol`; cross-file `definition` / `references` are not
meaningful for HTML and are not exposed.

This same language server is also used as a tertiary companion by the Angular language server (see the Angular
section), since `ngserver` does not implement `textDocument/documentSymbol` for `.html` files.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `vscode-html-language-server` executable path. |
| `vscode_langservers_package` | `vscode-langservers-extracted` | npm package providing the binary. Set to `@t1ckbase/vscode-langservers-extracted` (or any other source) to use the actively-maintained 2026 fork. |
| `vscode_langservers_version` | `4.10.0` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |
