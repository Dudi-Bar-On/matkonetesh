---
name: serena-docs-16
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 16/26 (docs)"
type: reference
---

## Onboarding

By default, Serena performs an **onboarding process** when it encounters a project
for the first time (i.e., when no project memories exist yet).
The goal of the onboarding is for Serena to get familiar with the project -
its structure, build system, testing setup, and other essential aspects -
and to store this knowledge as memories for future interactions.

In further project activations, Serena will check whether onboarding was already
performed by looking for existing project memories and will skip the onboarding
process if memories are found.

### How Onboarding Works

1. When a project is activated, Serena checks whether onboarding was already
   performed (by checking if any memories exist).
2. If no memories are found, Serena triggers the onboarding process, which
   reads key files and directories to understand the project.
3. Before any project memory is written, Serena materializes a project-local
   `memory_maintenance` memory (see below). The agent is then instructed to read it
   first and follow the conventions it describes.
4. The gathered information is written into project-specific memory files following
   the onboarding prompt instructions and the conventions outlined in `memory_maintenance`.

(memory-maintenance-memory)=
### The `memory_maintenance` Memory

To make memory conventions discoverable to both the LLM and the user, Serena seeds
a `memory_maintenance` memory on first onboarding. The seed is copied from a template
shipped with the Serena package and contains the dense agent-notes style, the
`mem:` reference convention, the reference model around `core` memories, the
add/update threshold, and the maintenance actions (rename / delete / split).

The seeding follows a strict precedence:

1. If you already maintain a `global/memory_maintenance` memory, Serena uses that
   and **does not** create a project-local copy. This is the recommended approach
   for teams that want one shared convention document across all projects.
2. Otherwise, if the project already has a `memory_maintenance` memory, it is left
   untouched.
3. Otherwise, the shipped template is written to `.serena/memories/memory_maintenance.md`.

Existing files are never overwritten - you can freely customize the project copy.
To refresh from the shipped template, delete the existing memory first.

### Tips for Onboarding

- **Context usage**: The onboarding process will read a lot of content from the project,
  filling up the context window. It is therefore advisable to **switch to a new conversation**
  once the onboarding is complete.
- **LLM failures**: If an LLM fails to complete the onboarding and does not actually
  write the respective memories to disk, you may need to ask it to do so explicitly.
- **Review the results**: After onboarding, we recommend having a quick look at the
  generated memories and editing them or adding new ones as needed.

(memory-cli)=
### CLI Subcommands

While the recommended way to manage memories is through the **MCP integration**, 
Serena also offers memory-related CLI commands.

The following commands have **no MCP tool counterpart** and are intended for human execution:

- `serena memories check` — referential-integrity report. By default reports stale
  `` `mem:NAME` `` references; additional scans (bare occurrences and fuzzy near-misses)
  are opt-in via flags. Run `serena memories check --help` for the full flag list.
- `serena memories auto-prefix-references` — heuristic rewrite of bare occurrences to add
  the `mem:` prefix; supports `--dry-run`.
- `serena memories initialize` will seed the `memory_maintenance` memory for the project.

The remaining commands mirror the MCP tools, you can thus instruct your agent to manage memories with
serena without having a running MCP server. Discover the full surface and per-command flags via:

```shell
serena memories --help
serena memories <subcommand> --help
```

## Disabling Memories and Onboarding

If you do not require the functionality described in this section, you can selectively disable it.

 * To disable all memory related tools (including onboarding), adding `no-memories` to the `base_modes`
   in Serena's [global configuration](050_configuration).
 * Similarly, to disable only onboarding, add `no-onboarding` to the `base_modes`.


<!-- source: docs/02-usage/050_configuration.md -->

# Configuration

Serena is very flexible in terms of configuration. While for most users, the default configurations will work,
you can fully adjust it to your needs.

You can disable tools, change Serena's fundamental instructions
(what we denote as the `system_prompt`), adjust the output of tools that just provide a prompt, 
and even adjust tool descriptions.

Serena is configured using a multi-layered approach:

 * **global configuration** (`serena_config.yml`, see below)
 * **project configuration** (`project.yml`, see [Project Configuration](project-config))
 * **contexts and modes** for composable configuration, which can be enabled on a case-by-case basis (see below)
 * **command-line parameters** passed to the `start-mcp-server` server command (overriding/extending configured settings)  
   See [MCP Server Command-Line Arguments](mcp-args) for further information.  

(global-config)=
## Global Configuration

The global configuration file allows you to change general settings and defaults that will apply to all projects unless overridden.

### Settings

Some of the configurable settings include:
  * the language backend to use by default (i.e., the JetBrains plugin or language servers);
    this can also be [overridden per project](per-project-language-backend)
  * UI settings affecting the [Serena Dashboard and GUI tool](060_dashboard.md)
  * the set of tools to enable/disable by default
  * the set of [modes](modes) to use by default
  * tool execution parameters (timeout, max. answer length)
  * global ignore rules
  * logging settings
  * the set of trusted project paths
  * advanced settings specific to individual language servers (see [below](ls-specific-settings))
  * priorities of language servers, which affect auto-detection 

The global configuration settings apply to all projects.
Some of the settings it contains can, however, be *extended* or *overridden* in project-specific settings, contexts and modes.

For detailed information on the parameters and possible settings, see the
[template file](https://github.com/oraios/serena/blob/main/src/serena/resources/serena_config.template.yml).

### Accessing the Configuration File

The configuration file is auto-created when you first run Serena. It is stored in your user directory:
  * Linux/macOS/Git-Bash: `~/.serena/serena_config.yml`
  * Windows (CMD/PowerShell): `%USERPROFILE%\.serena\serena_config.yml`

You can access it
  * through [Serena's dashboard](060_dashboard) while Serena is running (use the respective button) 
  * directly, using your favourite text editor
  * using the command

    ```shell
    serena config edit
    ```

## Modes and Contexts

Serena's behaviour and toolset can be adjusted using contexts and modes.
These allow for a high degree of customization to best suit your workflow and the environment Serena is operating in.

(contexts)=
