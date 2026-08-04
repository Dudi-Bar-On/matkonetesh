---
name: serena-docs-05
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 05/26 (docs)"
type: reference
---

## The Serena JetBrains Plugin

The [Serena JetBrains Plugin](https://plugins.jetbrains.com/plugin/28946-serena/) leverages the powerful code analysis capabilities of JetBrains IDEs. 
The plugin naturally supports all programming languages and frameworks that are supported by JetBrains IDEs.

When using the plugin, Serena connects to an instance of your JetBrains IDE via the plugin. For users who already
work in a JetBrains IDE, this means Serena seamlessly integrates with the IDE instance you typically have open anyway,
requiring no additional setup or configuration beyond the plugin itself.

* See the [JetBrains Plugin documentation](../02-usage/025_jetbrains_plugin) for a high-level overview of its benefits and usage details.
* See the [Features](025_features) section for a detailed comparison of the capabilities provided by the JetBrains Plugin vs. language servers.

```{raw} html
<p>
<a href="https://plugins.jetbrains.com/plugin/28946-serena/">
<img style="background-color:transparent;" src="../_static/images/jetbrains-marketplace-button.png">
</a>
</p>
```


<!-- source: docs/01-about/030_serena-in-action.md -->

# Serena in Action

## Demonstration 1: Efficient Operation in Claude Code

A demonstration of Serena efficiently retrieving and editing code within Claude Code, thereby saving tokens and time. Efficient operations are not only useful for saving costs, but also for generally improving the generated code's quality. This effect may be less pronounced in very small projects, but often becomes of crucial importance in larger ones.

<video src="https://github.com/user-attachments/assets/ab78ebe0-f77d-43cc-879a-cc399efefd87"
controls
preload="metadata"
style="max-width: 100%; height: auto;">
Your browser does not support the video tag.
</video>

## Demonstration 2: Serena in Claude Desktop

A demonstration of Serena implementing a small feature for itself (a better log GUI) with Claude Desktop.
Note how Serena's tools enable Claude to find and edit the right symbols.

<video src="https://github.com/user-attachments/assets/6eaa9aa1-610d-4723-a2d6-bf1e487ba753"
controls
preload="metadata"
style="max-width: 100%; height: auto;">
Your browser does not support the video tag.
</video>


<!-- source: docs/01-about/050_acknowledgements.md -->

# Acknowledgements

## Sponsors

We are very grateful to our [sponsors](https://github.com/sponsors/oraios), who help us drive Serena's development. 
The core team (the founders of [Oraios AI](https://oraios-ai.de/)) put in a lot of work in order to turn Serena into a useful open source project.
So far, there is no business model behind this project, and sponsors are our only source of income from it.

Sponsors help us dedicate more time to the project, managing contributions, and working on larger features (like better tooling based on more advanced
LSP features, VSCode integration, debugging via the DAP, and several others).
If you find this project useful to your work, or would like to accelerate the development of Serena, consider becoming a sponsor.

We are proud to announce that the Visual Studio Code team, together with Microsoft’s Open Source Programs Office and GitHub Open Source
have decided to sponsor Serena with a one-time contribution!

## Community Contributions

A significant part of Serena, especially support for various languages, was contributed by the open source community.
We are very grateful for the many contributors who made this possible and who played an important role in making Serena
what it is today.

## Technologies

We built Serena on top of multiple existing open-source technologies, the most important ones being:

1. [multilspy](https://github.com/microsoft/multilspy).
   A library which wraps language server implementations and adapts them for interaction via Python
   and which provided the basis for our library Solid-LSP (src/solidlsp).
   Solid-LSP provides pure synchronous LSP calls and extends the original library with the symbolic logic
   that Serena required.
2. [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk)
3. All the language servers that we use through Solid-LSP.

Without these projects, Serena would not have been possible (or would have been significantly more difficult to build).


<!-- source: docs/02-usage/000_intro.md -->

# Usage

Serena can be used in various ways and supports coding workflows through a project-based approach.
Its configuration is flexible and allows tailoring it to your specific needs.

In this section, you will find general usage instructions as well as concrete instructions for selected integrations.


<!-- source: docs/02-usage/010_installation.md -->

# Installation 

## Prerequisites

**Package Manager: uv**

Serena is managed by `uv`.
If you do not have it yet, install it following the instructions [here](https://docs.astral.sh/uv/getting-started/installation/).

**Language-Specific Requirements**

When using the language server backend, some additional dependencies may need to be installed 
to support certain languages.
See the [Language Support](language-servers) page for the list of supported languages.
Many dependencies are installed by Serena on the fly, but if a language requires dependencies 
to be provided manually, this is mentioned in the notes below the respective language.

(install-serena)=
## Installing and Initialising Serena

With `uv` installed and on your PATH, install Serena with this command:

    uv tool install -p 3.13 serena-agent

Upon completion, the command `serena` should be available in your terminal.

To test the installation and initialise Serena, run one of the following commands:

  * `serena init`  
    if you intend to use the default language intelligence backend (language servers)
  * `serena init -b JetBrains`  
    if you intend to use the JetBrains backend (which uses the [JetBrains plugin](025_jetbrains_plugin))

Note that you can switch backends at any time via Serena's [configuration](050_configuration). 

## Updating Serena

To update Serena to the latest version, run:

    uv tool upgrade serena-agent

:::{tip}
To keep informed about updates, make sure you regularly open [Serena's Dashboard](060_dashboard),
where we will announce releases along with the new features and improvements they bring.
:::

## Uninstalling Serena

Serena can be uninstalled with the following command:

    uv tool uninstall serena-agent


<!-- source: docs/02-usage/020_running.md -->

# Running Serena

Serena is a command-line tool with a variety of sub-commands.
This section describes
 * how to run Serena in general
 * how to run and configure the most important command, i.e. starting the MCP server
 * other useful commands.

The main way to run Serena is to use the [installed version](install-serena),
which should be available in your system PATH as `serena.`

In general, to get help, append `--help` to the command, i.e.

    serena --help
    serena <command> --help


(start-mcp-server)=
