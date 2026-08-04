---
name: serena-docs-03
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 03/26 (docs)"
type: reference
---

* **Ada / SPARK**  
  (uses AdaCore's [Ada Language Server (ALS)](https://github.com/AdaCore/ada_language_server),
  automatically downloaded; supports `.ads`, `.adb`, and `.ada` files;
  works best with a `.gpr` GNAT project file at the repository root;
  SPARK is handled by the same server transparently — set language `ada` for both.
  To use a pre-installed ALS (e.g. from Alire, GNAT Studio, or the VS Code Ada extension),
  set `ls_specific_settings.ada.ls_path`.)
* **AL**
* **Angular**  
  (experimental; requires Node.js + npm, plus `npm install` having been run in the project root so that `@angular/core`
  is resolvable — without it, template-aware features silently return empty;
  subsumes `typescript` and `html` for `.ts`/`.html` files, so do not also list those)
* **Ansible**  
  (experimental; requires Node.js and npm; automatically installs `@ansible/ansible-language-server`;
  must be explicitly specified in the `languages` entry in the `project.yml`; requires `ansible` in PATH for full functionality)
  the upstream `@ansible/ansible-language-server@1.2.3` supports hover, completion, definition,
  semantic tokens, and validation; document symbols, workspace symbols, references, and rename
  are not supported by this version)
* **Bash**
* **BSL** (1C:Enterprise / OneScript)  
  (requires Java 21+ on PATH; uses [bsl-language-server](https://github.com/1c-syntax/bsl-language-server) by 1c-syntax; the JAR is auto-downloaded and SHA-256-verified for the bundled default version; supports `.bsl` and `.os` files; configure optional `ls_path` or `bsl_ls_version` under `ls_specific_settings.bsl`)
* **C#**  
  (by default, uses the Roslyn language server (language `csharp`), requiring [.NET v10+](https://dotnet.microsoft.com/en-us/download/dotnet) and, on Windows, `pwsh` ([PowerShell 7+](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.5));
  set language to `csharp_omnisharp` to use OmiSharp instead)
* **C/C++**  
  (by default, uses the clangd language server (language `cpp`) but we also support ccls (language `cpp_ccls`);
  for best results, provide a `compile_commands.json` at the repository root;
  see the [C/C++ Setup Guide](../03-special-guides/cpp_setup) for details;
  for Unreal Engine 5 projects, see the [Unreal Engine Setup Guide](../03-special-guides/unreal_engine_setup_guide_for_serena).)
* **Clojure**
* **Crystal**  
  (requires [Crystalline](https://github.com/elbywan/crystalline) language server to be installed and available on PATH;
  note: Crystalline has limited go-to-definition support and does not support find-references)
* **CUE**
* **Dart**
* **Elixir**  
  (requires Elixir installation; Expert language server is downloaded automatically)
* **Elm**  
  (requires Elm compiler)
* **Erlang**  
  (requires installation of beam and [erlang_ls](https://github.com/erlang-ls/erlang_ls); experimental, might be slow or hang)
* **F#**  
  (requires [.NET v8.0+](https://dotnet.microsoft.com/en-us/download/dotnet); uses FsAutoComplete/Ionide, which is auto-installed; for Homebrew .NET on macOS, set DOTNET_ROOT in your environment)
* **Fortran**   
  (requires installation of fortls: `pip install fortls`)
* **GDScript** (Godot Engine)  
  (requires the Godot editor to be running with its built-in LSP enabled — default on port 6008;
  Serena connects over TCP and does not launch Godot itself;
  see the [GDScript Setup Guide](../03-special-guides/godot_gdscript_setup_guide_for_serena) for details)
* **Go**  
  (requires installation of `gopls`)
* **Groovy**  
  (requires local groovy-language-server.jar setup via `GROOVY_LS_JAR_PATH` or configuration)
* **Haskell**  
  (automatically locates HLS via ghcup, stack, or system PATH; supports Stack and Cabal projects)
* **Haxe**
  (requires Haxe compiler 3.4.0+ and Node.js; uses the [vshaxe language server](https://github.com/vshaxe/haxe-language-server);
  automatically downloaded from Open VSX, or discovered from the vshaxe VSCode extension)
* **HLSL / GLSL / WGSL**
  (uses [shader-language-server](https://github.com/antaalt/shader-sense) (language `hlsl`); automatically downloaded;
  on macOS, requires Rust toolchain for building from source;
  note: reference search is not supported by this language server)
* **HTML**
  (experimental; requires Node.js + npm)
* **Java**  
* **JavaScript**  
  (supported via the TypeScript language server, i.e. use language `typescript` for both JavaScript and TypeScript)
* **Julia**
* **Kotlin**  
  (uses the pre-alpha [official kotlin LS](https://github.com/Kotlin/kotlin-lsp), some issues may appear)
* **LaTeX**  
  (experimental; must be explicitly enabled via language `latex`; uses [texlab](https://github.com/latex-lsp/texlab),
  auto-downloaded as a SHA-256-verified prebuilt binary; supports `.tex`, `.bib`, `.sty`, and `.cls` files; texlab is
  GPL-3.0 and runs as a separate downloaded process)
* **Lean 4**  
  (requires `lean` and `lake` installed via [elan](https://github.com/leanprover/elan); uses the built-in Lean 4 LSP;
  the project must be a Lake project with `lake build` run before use)
* **Lua**
* **Luau**
* **Markdown**  
  (must explicitly enable language `markdown`, primarily useful for documentation-heavy projects)
* **MATLAB**  
  (requires Node.js and a licensed local MATLAB installation, R2021b or later; Serena automatically downloads version 1.3.9 of the VS Code MATLAB extension, which bundles the language server)
* **mSL** (mIRC Scripting Language)  
  (auto-installed; no external dependencies required — uses a custom pygls-based LSP server shipped with Serena;
  supports document symbols, workspace symbols, references, and go-to-definition for aliases, events, menus, dialogs, and CTCP handlers in `.mrc` files)
* **Nix**  
  (requires nixd installation)
* **OCaml**
  (requires opam and ocaml-lsp-server to be installed manually; see the [OCaml Setup Guide](../03-special-guides/ocaml_setup_guide_for_serena.md))
* **Pascal**  
  (uses Pascal/Lazarus, which is automatically downloaded; set `PP` and `FPCDIR` environment variables for source navigation)
* **Perl**  
  (requires installation of Perl::LanguageServer)
* **PHP**  
  (by default, uses the Intelephense language server (language `php`), set `INTELEPHENSE_LICENSE_KEY` environment variable for premium features;
  we also support [Phpactor](https://github.com/phpactor/phpactor) (language `php_phpactor`), which requires PHP 8.1+;
  and the experimental [PHPantom](https://github.com/PHPantom-dev/phpantom_lsp) backend (language `php_phpantom`)
* **PowerShell**  
  (requires PowerShell 7+ (`pwsh`) on PATH or in a standard install location; Serena automatically downloads PowerShell Editor Services 4.4.0 and installs PSScriptAnalyzer 1.25.0 via `Save-Module` from your configured PowerShell repository)
* **Python**
  (by default, uses [Pyright](https://github.com/microsoft/pyright) (language `python`);
  alternatives: [BasedPyright](https://github.com/DetachHead/basedpyright) (language `python_basedpyright`),
  [ty](https://github.com/astral-sh/ty) (language `python_ty`),
  [pyrefly](https://github.com/facebook/pyrefly) (language `python_pyrefly`),
  [Jedi](https://github.com/palotas/jedi-language-server) (language `python_jedi`);
  Pyright, BasedPyright, ty, and pyrefly require `uv`/`uvx` in PATH)
* **QML**
  (requires Qt 6, provides `qmlls` or `qmlls6` on PATH; see the [Qt qmlls documentation](https://doc.qt.io/qt-6/qtqml-tool-qmlls.
