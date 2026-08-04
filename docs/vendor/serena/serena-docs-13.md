---
name: serena-docs-13
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 13/26 (docs)"
type: reference
---

### Hook Descriptions

- **`remind`**: Remind the agent to use Serena's tools instead of built-in `grep` and `read` tools.
- **`activate`**: Prompt the agent to activate the project at session start and read Serena's instructions.
- **`cleanup`**: Clean up hook session data when the session ends.
- **`auto-approve`**: Auto-approve Serena tool calls whenever CodeBuddy is in a permissive
  permission mode (`acceptEdits` or `auto`), so blanket approvals cover Serena's destructive
  tools (e.g. `replace_symbol_body`, `rename_symbol`) instead of prompting on every call.

## Other Clients

For other clients, follow the [general instructions](#clients-general-instructions) above to set up Serena as an MCP server.

### Terminal-Based Clients

There are many terminal-based coding assistants that support MCP servers, such as

 * [Gemini-CLI](https://github.com/google-gemini/gemini-cli), 
 * [Qwen3-Coder](https://github.com/QwenLM/Qwen3-Coder),
 * [rovodev](https://community.atlassian.com/forums/Rovo-for-Software-Teams-Beta/Introducing-Rovo-Dev-CLI-AI-Powered-Development-in-your-terminal/ba-p/3043623),
 * [OpenHands CLI](https://docs.all-hands.dev/usage/how-to/cli-mode),
 * [opencode](https://github.com/sst/opencode) and
 * [CodeBuddy-Code](https://www.codebuddy.cn/cli/).

They generally benefit from the symbolic tools provided by Serena. You might want to customize some aspects of Serena
by writing your own context, modes or prompts to adjust it to the client's respective internal capabilities (and your general workflow).

In most cases, the `ide` context is likely to be appropriate for such clients, i.e. add the arguments `--context ide` 
in order to reduce tool duplication.

### MCP-Enabled IDEs and Coding Clients (Cline, Roo-Code, Cursor, Windsurf, etc.)

Most of the popular existing coding assistants (e.g. IDE extensions) and AI-enabled IDEs themselves support connections
to MCP Servers. Serena generally boosts performance by providing efficient tools for symbolic operations.

We generally recommend using the `ide` context for these integrations by adding the arguments `--context ide` 
in order to reduce tool duplication.

### Local GUIs and Agent Frameworks

Over the last months, several technologies have emerged that allow you to run a local GUI client
and connect it to an MCP server. The respective applications will typically work with Serena out of the box.
Some of the leading open source GUI applications are

  * [Jan](https://jan.ai/docs/mcp), 
  * [OpenHands](https://github.com/All-Hands-AI/OpenHands/),
  * [OpenWebUI](https://docs.openwebui.com/openapi-servers/mcp) and 
  * [Agno](https://docs.agno.com/introduction/playground).

These applications allow combining Serena with almost any LLM (including locally running ones) 
and offer various other integrations.


<!-- source: docs/02-usage/040_workflow.md -->

# The Project Workflow

Serena uses a project-based workflow.
A **project** is simply a directory on your filesystem that contains code and other files
that you want Serena to work with.

Assuming that you have project you want to work with (which may initially be empty),
setting up a project with Serena typically involves the following steps:

1. **Project creation**: Configuring project settings for Serena (and indexing the project, if desired)
2. **Project activation**: Making Serena aware of the project you want to work with
3. **Onboarding**: Getting Serena familiar with the project (creating memories)
4. **Working on coding tasks**: Using Serena to help you with actual coding tasks in the project

(project-creation-indexing)=
## Project Creation

Project creation is the process of defining fundamental project settings that are relevant to Serena's operation.

You can create a project either  
 * explicitly, using the project creation command (see below), or
 * implicitly, by just activating a directory as a project while already in a conversation; this will use default settings for your project (skip to the next section).

### Explicit Project Creation

To explicitly create a project, use the following command while in the project directory:

    serena project create [options] [project directory]

 * The project directory defaults to the current directory if not specified.
 * For an existing project, the programming languages will be detected based on
   the source files present, and the main language will be activated automatically.
   If multiple languages are detected, you will be prompted whether you want to enable them.  
 * For an empty project, you can optionally specify one or more languages
   to be activated explicitly via the `--language` parameter
   (e.g. `--language python --language typescript`).
 * You can optionally specify a custom project name with `--name my-name`.
 * You can immediately index the project after creation with `--index`.

(project-config)=
## Project Configuration

After creation, you can adjust the project settings in the generated `.serena/project.yml` file
within the project directory.

The file allows you to configure ...
  * the name by which you want to refer to the project (relevant when telling the LLM to dynamically activate the project)
  * the set of programming languages for which language servers are spawned (not relevant when using the JetBrains plugin)
    Note that you can dynamically add/remove language servers while Serena is running via the [Dashboard](060_dashboard).
  * the [language backend](per-project-language-backend) to use for this project (overriding the global setting)
  * the encoding used in source files
  * ignore rules
  * write access
  * the list of workspace folders to be processed by language servers (when using the LSP backend)
  * an initial prompt that shall be passed to the LLM whenever the project is activated
  * a shell command to run upon project activation (prior to language backend initialisation)
  * the set of tools and modes to use for the project
  * and some other settings.

For detailed information on the parameters and possible settings, see the 
[template file](https://github.com/oraios/serena/blob/main/src/serena/resources/project.template.yml).

:::{note}
Many settings in project.yml *extend* or *override* settings in [Serena's global configuration](global-config).
So use the project configuration specifically for aspects that apply only to the particular project.
:::

**Local Overrides**. The `project.yml` file is intended to be versioned together with the project.
You can specify local overrides for the settings in a `project.local.yml` file in the same directory
(which, by default, is ignored by git). 
Any keys defined therein will override the respective key in `project.yml`.

(indexing)=
## Indexing

:::{note}
Indexing is not a relevant operation when using the JetBrains plugin, as indexing is handled by the IDE.
:::

Especially for larger project, it can be advisable to index the project after creation, pre-caching 
symbol information provided by the language server(s). This will avoid delays during the first tool invocation
that requires symbol information.

While in the project directory, run this command:
   
    serena project index

Indexing has to be called only once. During regular usage, Serena will automatically update the index whenever files change.

(project-activation)=
