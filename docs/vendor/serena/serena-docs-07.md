---
name: serena-docs-07
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 07/26 (docs)"
type: reference
---

### Running from Cloned Source

1. Clone the repository and change into it.

   ```shell
   git clone https://github.com/oraios/serena
   cd serena
   ```

2. Run Serena via

   ```shell
   uv run serena 
   ```

   when within the serena installation directory.     
   From other directories, run it with the `--directory` option, i.e.

   ```shell
    uv run --directory /abs/path/to/serena serena
    ```

:::{note}
Adding the `--directory` option results in the working directory being set to the Serena directory.
As a consequence, you will need to specify paths when using CLI commands that would otherwise operate on the current directory.
:::

(docker)=
### Using Docker

The Docker approach offers several advantages:

* better security isolation for shell command execution
* no need to install language servers and dependencies locally
* consistent environment across different systems

You can run the Serena MCP server directly via Docker as follows,
assuming that the projects you want to work on are all located in `/path/to/your/projects`:

```shell
docker run --rm -i --network host -v /path/to/your/projects:/workspaces/projects ghcr.io/oraios/serena:latest serena 
```

This command mounts your projects into the container under `/workspaces/projects`, so when working with projects,
you need to refer to them using the respective path (e.g. `/workspaces/projects/my-project`).

Alternatively, you may use Docker compose. Adjust the file `compose.yml`, which is provided in the repository, according to your needs.
See our [advanced Docker usage](https://github.com/oraios/serena/blob/main/DOCKER.md) documentation for more detailed instructions, configuration options, and limitations.

:::{note}
Docker usage is subject to limitations; see the [advanced Docker usage](https://github.com/oraios/serena/blob/main/DOCKER.md) documentation for details.
:::

### Using Nix to Run the Latest Source Version

If you are using Nix and [have enabled the `nix-command` and `flakes` features](https://nixos.wiki/wiki/flakes), you can run Serena using the following command:

```bash
nix run github:oraios/serena -- <command> [options]
```

You can also install Serena by referencing this repo (`github:oraios/serena`) and using it in your Nix flake. The package is exported as `serena`.


<!-- source: docs/02-usage/025_jetbrains_plugin.md -->

# The Serena JetBrains Plugin

The [JetBrains Plugin](https://plugins.jetbrains.com/plugin/28946-serena/) allows the Serena MCP server to
leverage the powerful code analysis and editing capabilities of your JetBrains IDE.
This page explains how to install the plugin and how to configure Serena appropriately.   
You will still need to set up the Serena MCP server 
itself, so make sure to follow the [installation instructions](020_running.md) and connect the MCP server to your 
LLM-based client as described in [client setup](030_clients.md) in addition to following the instructions below.

```{raw} html
<p>
<a href="https://plugins.jetbrains.com/plugin/28946-serena/">
<img style="background-color:transparent;" src="../_static/images/jetbrains-marketplace-button.png">
</a>
</p>
```

We recommend the JetBrains plugin as the preferred way of using Serena,
especially for users of JetBrains IDEs.

**How it works:**
1. Install the plugin in your JetBrains IDE
2. Configure Serena to use the JetBrains language backend (see [below](configure-jetbrains))
3. Open the project you want to work on in your JetBrains IDE and activate it in Serena (see [below](jetbrains-workflow))
4. Start coding via your MCP client as usual

```{admonition} *Note:* The plugin is a language intelligence backend for the Serena MCP server. 
:class: note
It is *not* a UI extension for direct agent interaction (like Copilot) or anything of the sort.    
You still interact with your regular client – be it external to your IDE (like Claude Code CLI) or internal (like Copilot or JetBrains AI Assistant) –
and connect it to the Serena MCP server.  
The plugin simply enables the Serena MCP server to directly leverage capabilities of your JetBrains IDE!
```

**Purchasing the JetBrains Plugin supports the Serena project.**
The proceeds from plugin sales allow us to dedicate more resources to further developing and improving Serena.

## Advantages of the JetBrains Plugin

There are multiple features that are only available when using the JetBrains plugin:

* **External library indexing**: Dependencies and libraries are fully indexed and accessible to Serena
* **Enhanced retrieval & refactoring capabilities**: The plugin adds additional [tools](../01-about/035_tools) (e.g. type
  hierarchy retrieval, move, find declaration, inline symbol, etc.) 
  and transforms the underlying mechanisms of shared tools to build upon the IDE's capabilities.
* **Interactive debugging**: The agent can set breakpoints, inspect variables, evaluate expressions and control execution flow
  by directly interacting with the IDE's debugger, using a REPL-style interface for maximum flexibility.
* **Improved multi-agent support**: A single IDE instance naturally serves arbitrarily many agent sessions without requiring additional resources.
* **Enhanced performance**: Faster tool execution thanks to optimized IDE integration.
* **Multi-language excellence** and **framework support**: First-class support for polyglot projects with multiple languages. 
  and frameworks (whatever is recognised by your IDE as a symbol will also be available to Serena)
* **No additional setup**: No need to download or configure separate language servers.

We are also working on additional features like debugging and advanced introspection capabilities, which
will be available exclusively through the JetBrains plugin.

:::{note}
With Serena's JetBrains tools, we try to offer the latest features.
As a result, some of them are considered as beta features (see [tool list](../01-about/035_tools)), which may have some quirks.
Please report your experience with these tools if they do not work as expected. 
:::

(configure-jetbrains)=
