---
name: serena-docs-09
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 09/26 (docs)"
type: reference
---

## Serena Plugin Configuration Options

You can configure plugin options in the IDE under Settings / Tools / Serena.

 * **Listen address** (default: `127.0.0.1`)  
   the address the plugin's server listens on.  
   The default will work as long as Serena is running on the same machine (or on a virtual machine using mirrored networking).
   But if the Serena MCP server is running on a different machine, configure the listen address to ensure that connections are possible.
   You can use `0.0.0.0` to listen on all interfaces (but be aware of the security implications of doing so).

 * **Sync file system before every operation** (default: enabled)  
   whether to synchronise the file system state before processing requests from Serena.  
   This is important to ensure that the plugin does not read stale data, but it can have a performance impact, 
   especially when using slow file systems (e.g. WSL file system while the IDE is running on Windows).
   Note, however, that without synchronisation being forced by the Serena plugin, you will have to ensure synchronisation yourself.
   Operations that apply changes to files in your project that are *not* made either in the IDE itself or by Serena may not be seen by the IDE. 
   Normally, the IDE synchronises automatically when it has the focus, using file watchers to achieve this (though this may or may not work reliably for the WSL file system). 
   Also, if you are working primarily in another application (e.g. AI chat), the IDE may not have the focus frequently. 
   So when external changes are made to your project, you will have to either give the IDE the focus (if that works) or trigger a sync manually (right-click root folder / Reload from Disk).  
   Further, note that even an edit made using, for example, Claude Code's internal editing tools would count as an external modification.
   Only Serena's editing tools are "JetBrains-aware" and will tell the IDE to update the state of the edited file.
   So if you are making AI-based edits using tools other than Serena's tools, do make sure that the lack of synchronisation is not a problem if you decide to disable this option.

## Usage with Other Editors

We realize that not everyone uses a JetBrains IDE as their main code editor.
You can still take advantage of the JetBrains plugin by running a JetBrains IDE instance alongside your
preferred editor. Most JetBrains IDEs have a free community edition that you can use for this purpose.
You just need to make sure that the project you are working on is open and indexed in the JetBrains IDE, 
so that Serena can connect to it.


<!-- source: docs/02-usage/030_clients.md -->

# Connecting Your MCP Client

In the following, we provide general instructions on how to connect Serena to your MCP-enabled client,
as well as specific instructions for popular clients.

(clients-general-instructions)=
## General Instructions

In general, Serena can be used with any MCP-enabled client.
To connect Serena to your favourite client, simply

1. determine how to add a custom MCP server to your client (refer to the client's documentation).
2. add a new MCP server entry by specifying either
    * a [run command](start-mcp-server) that allows the client to start the MCP server in stdio mode as a subprocess, or
    * the URL of the HTTP/SSE endpoint, having started the [Serena MCP server in HTTP/SSE mode](streamable-http) beforehand.

Find concrete examples for popular clients below.

Depending on your needs, you might want to further customize Serena's behaviour by
* [adding command-line arguments](mcp-args)
* [adjusting configuration](050_configuration).

**Mode of Operation**.
Note that some clients have a per-workspace MCP configuration (e.g, VSCode and Claude Code),
while others have a global MCP configuration (e.g. Codex and Claude Desktop).

- In the per-workspace case, you typically want to start Serena with your workspace directory as the project directory 
  and never switch to a different project. This is achieved by specifying the
  `--project <path>` argument with a single-project [context](#contexts) (e.g. `ide` or `claude-code`).
- In the global configuration case, you must first activate the project you want to work on, which you can do by asking
  the LLM to do so (e.g., "Activate the current dir as project using serena"). In such settings, the `activate_project`
  tool is required.

**Tool Selection**.
While you may be able to turn off tools through your client's interface (e.g., in VSCode or Claude Desktop),
we recommend selecting your base tool set through Serena's configuration, as Serena's prompts automatically
adjust based on which tools are enabled/disabled.  
A key mechanism for this is to use the appropriate [context](#contexts) when starting Serena.

(clients-common-pitfalls)=
### Common Pitfalls

**Discoverability of the `serena` command**.
Your client may not find the `serena` CLI command, even if it is on your system PATH.
In this case, a workaround is to provide the full path to the `serena` executable.

**Serena's tools not being used**.
With some clients, you may experience that Serena's tools are not being used.
This is mainly due to problems in the client itself (like a poorly implemented tool discovery). To counteract this,
Serena comes with a set of commands that can be used in _hooks_. See the sections on hooks for Claude Code and VSCode below.

**Environment Variables**.
Some language servers may require additional environment variables to be set (e.g. F# on macOS with Homebrew),
which you may need to explicitly add to the MCP server configuration.
Note that for some clients (e.g. Claude Desktop), the spawned MCP server process may not inherit environment variables that
are only configured in your shell profile (e.g. `.bashrc`, `.zshrc`, etc.); they would need to be set system-wide instead.
An easy fix is to add them explicitly to the MCP server entry.
For example, in Claude Desktop and other clients, you can simply add an `env` key to the `serena`
object, e.g.

```
"env": {
    "DOTNET_ROOT": "/opt/homebrew/Cellar/dotnet/9.0.8/libexec"
}
```
