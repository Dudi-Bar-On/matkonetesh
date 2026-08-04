---
name: serena-docs-18
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 18/26 (docs)"
type: reference
---

### Language Server-Specific Settings

:::{note} 
**Advanced Users Only**: The settings described in this section are intended for advanced users who need to fine-tune language server behavior.
Most users will not need to adjust these settings.
:::

Under the key `ls_specific_settings` in `serena_config.yml`, you can you pass global per-language, 
language server-specific configuration. 

You can use the same key in the project configuration files (`project.yml`
and `project.local.yml` ) to override or extend the global settings for a specific project.
The settings are merged on top-level, meaning that project-level settings for a language will replace global settings for the same language.  
Note: Project-level settings are considered only for *trusted projects* (which are defined in the [global configuration](global-config)).

Structure:

```yaml
ls_specific_settings:
  <language>:
    # language-server-specific keys
```

(override-ls-path)=
#### Customizing the Language Server Launch Command

Most of Serena's language servers construct the command that launches the language server process from
a *base command* or a *core dependency*.
For these language servers, the following settings can be used to customize the launch command:

| Setting                                    | Description                                                                                                                                                                                                                                                                                                                                           |
|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ls_path` (string) or `ls_base_cmd` (list) | overrides the path of the language server's core dependency (`ls_path`), e.g. its executable or a JAR file, or a base command for its execution (`ls_base_cmd`), e.g. `["npx", "-y", "/my/local/package"]`. Use this if you have installed the language server yourself and want Serena to use your installation instead of its managed installation. |
| `ls_args` (list)                           | overrides the internal command construction completely and simply adds `ls_args` to the base command                                                                                                                                                                                                                                                  | 
| `ls_extra_args` (list)                     | a list of additional arguments to append to the launch command                                                                                                                                                                                                                                                                                        |

* If you set `ls_args`, the internal command construction (which may do more than to append arguments to a base command) is bypassed.
  You can define the full launch command by providing both `ls_path`/`ls_base_cmd` and `ls_args`.
* If `ls_args` is not set, the internal command construction (which sets default arguments) is applied, and you can use `ls_path` or `ls_base_cmd` to override the path of the core dependency/the base command.
* `ls_extra_args` is always appended to the end of the launch command.

Example:

```yaml
ls_specific_settings:
  <language>:
    ls_path: "/path/to/language-server"
    ls_extra_args: ["--log-level=debug"]
```

These settings are supported by all language servers whose dependency provider derives from
`LanguageServerDependencyProviderBaseCommand`, and `ls_path` is additionally exposed by some implementations explicitly.
Common examples include: `ansible`, `bash`, `bsl`, `clojure`, `cpp`, `cpp_ccls`, `hlsl`, `html`, `kotlin`, `lean4`, `luau`, `markdown`, `php`,
`nix`, `php_phpactor`, `python`, `rust`, `scss`, `solidity`, `systemverilog`, `toml`, `typescript`, and `yaml`.

If `ls_path` is set, Serena's managed download or install is bypassed for that language server.
In that case, any server-specific version or registry settings do not apply.

(override-init-options)=
#### Overriding Language Server Initialization Options

When Serena starts a language server, it sends a set of `initializationOptions` as part of the
Language Server Protocol `initialize` request. These options are constructed internally and are
tailored to each language server. In some cases, you may want to override or extend these options,
e.g. to enable a feature or to adjust a behavior that is specific to your setup.

Under the key `initializationOptions` within a language's `ls_specific_settings`, you can provide a
dictionary of options that is applied on top of the internally constructed `initializationOptions`.
The values are combined at the top level only: for each top-level key you define, your value
replaces the original value for that key exactly as given (there is no recursive/deep merge of
nested dictionaries). Internally constructed keys that you do not define are left unchanged.

* If Serena constructs `initializationOptions` for the language server, each top-level key you
  provide replaces the internally constructed value for that same key, while all other internally
  constructed keys are retained.
* If Serena does not construct any `initializationOptions` for the language server, your custom
  options are used as-is.

Example:

```yaml
ls_specific_settings:
  <language>:
    initializationOptions:
      someFeature:
        enabled: true
```

#### AL

Serena uses the AL language server bundled in the Microsoft Dynamics 365 Business Central VS Code extension.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `al_extension_version` | `18.0.2242655` | Override the AL VS Code extension version Serena downloads from the VS Code Marketplace. |
