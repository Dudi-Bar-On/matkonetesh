---
name: serena-docs-17
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 17/26 (docs)"
type: reference
---

### Contexts

A **context** defines the general environment in which Serena is operating.
It influences the initial system prompt and the set of available tools.
A context is set at startup when launching Serena (e.g., via CLI options for an MCP server or in the agent script) and cannot be changed during an active session.

Serena comes with pre-defined contexts:

* `desktop-app`: Tailored for use with desktop applications like Claude Desktop. This is the default.
  The full set of Serena's tools is provided, as the application is assumed to have no prior coding-specific capabilities.
* `claude-code`: Optimized for use with Claude Code, it disables tools that would duplicate Claude Code's built-in capabilities.
* `codex`: Optimized for use with OpenAI Codex.
* `grok`: Optimized for use with xAI's Grok Build CLI.
* `ide`: Generic context for IDE assistants/coding agents, e.g. VSCode, Cursor, or Cline, focusing on augmenting existing capabilities.
  Basic file operations and shell execution are assumed to be handled by the assistant's own capabilities.
* `agent`: Designed for scenarios where Serena acts as a more autonomous agent, for example, when used with Agno.

Choose the context that best matches the type of integration you are using.

Find the concrete definitions of the above contexts [here](https://github.com/oraios/serena/tree/main/src/serena/resources/config/contexts).

Note that the contexts `ide`, `claude-code`, and `grok` are **single-project contexts** (defining `single_project: true`).
For such contexts, if a project is provided at startup, the set of tools is limited to those required by the project's
concrete configuration, and other tools are excluded completely, allowing the set of tools to be minimal.
Tools explicitly disabled by the project will not be available at all. Since changing the active project
ceases to be a relevant operation in this case, the project activation tool is disabled.

When launching Serena, specify the context using `--context <context-name>`.
Note that for cases where parameter lists are specified (e.g. Claude Desktop), you must add two parameters to the list.

If you are using a local server (such as Llama.cpp) which requires you to use OpenAI-compatible tool descriptions, use context `oaicompat-agent` instead of `agent`.

You can manage contexts using the `context` command,

    serena context --help
    serena context list
    serena context create <context-name>
    serena context edit <context-name>
    serena context delete <context-name>


(modes)=
### Modes

Modes further refine Serena's behavior for specific types of tasks or interaction styles. Multiple modes can be active simultaneously, allowing you to combine their effects. Modes influence the system prompt and can also alter the set of available tools by excluding certain ones.

Examples of built-in modes include:

* `planning`: Focuses Serena on planning and analysis tasks.
* `editing`: Optimizes Serena for direct code modification tasks.
* `interactive`: Suitable for a conversational, back-and-forth interaction style.
* `one-shot`: Configures Serena for tasks that should be completed in a single response, often used with `planning` for generating reports or initial plans.
* `no-onboarding`: Skips the initial onboarding process if it's not needed for a particular session but retains the memory tools (assuming initial memories were created externally).
* `onboarding`: Focuses on the project onboarding process.
* `no-memories`: Disables all memory tools (and tools building on memories such as onboarding tools)
* `query-projects`: Enables tools for querying other Serena projects (without activating them); see section [Reading from External Projects](query-projects) 

Find the concrete definitions of these modes [here](https://github.com/oraios/serena/tree/main/src/serena/resources/config/modes).

The modes to be activated are configured in:
  * the global configuration file (`serena_config.yml`)
     - defines `base_modes`, which are always included
     - defines `default_modes`, which can be overridden by projects or command line parameters
  * the project configuration file (`project.yml`)
     - defines `default_modes` (overriding the default modes in the global configuration)
     - defines `added_modes`, which are added on top
  * at startup via command-line parameters
     - can override default modes with `--mode`
     - can define modes to be added on top with `--add-mode`

Ultimately, the active modes are given by the union of 
  * `base_modes` defined in the global configuration (always active)  
  * `default_modes` (defined in the global configuration, optionally overridden by the project/CLI)
  * `added_modes` (defined in the project configuration/via CLI parameters)

So you should 
 * define modes you definitely always want to use in `base_modes`,
 * define modes that you typically want to use but sometimes want to override in `default_modes`,
 * use `added_modes` to add modes that you need only for specific projects/sessions.

:::{note}
**Mode Compatibility**: While you can combine modes, some may be semantically incompatible (e.g., `interactive` and `one-shot`). 
Serena currently does not prevent incompatible combinations; it is up to the user to choose sensible mode configurations.
:::

You can manage modes using the `mode` command,

    serena mode --help
    serena mode list
    serena mode create <mode-name>
    serena mode edit <mode-name>
    serena mode delete <mode-name>

## Advanced Configuration

For advanced users, Serena's configuration can be further customized.

### Serena Data Directory

The Serena user data directory (where configuration, language server files, logs, etc. are stored) defaults to `~/.serena`.
You can change this location by setting the `SERENA_HOME` environment variable to your desired path.

### Per-Project Serena Folder Location

By default, each project stores its Serena data (memories, caches, etc.) in a `.serena` folder inside the project root.
You can customize this location globally via the `project_serena_folder_location` setting in `serena_config.yml`.

The setting supports two placeholders:

| Placeholder          | Description                                     |
|----------------------|-------------------------------------------------|
| `$projectDir`        | The absolute path to the project root directory |
| `$projectFolderName` | The name of the project folder                  |

**Examples:**

```yaml
# Default: data stored inside the project directory
project_serena_folder_location: "$projectDir/.serena"

# Central location: all project data under a shared directory
project_serena_folder_location: "/projects-metadata/$projectFolderName/.serena"
```

When a project is loaded, Serena uses the following fallback logic:
1. Check if a `.serena` folder exists at the configured path.
2. If not, check if one exists in the project root (default/legacy location).
3. If neither exists, create the folder at the configured path.

This ensures backward compatibility: existing projects that already have a `.serena` folder in the project root will continue to work, even after changing the `project_serena_folder_location` setting.

(ls-specific-settings)=
