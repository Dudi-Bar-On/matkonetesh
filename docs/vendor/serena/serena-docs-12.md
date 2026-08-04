---
name: serena-docs-12
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 12/26 (docs)"
type: reference
---

### Hooks

Grok supports lifecycle hooks; see Grok's bundled hooks documentation for details. To enable Serena's hooks
for Grok globally, create `~/.grok/hooks/serena-hooks.json` with the following content. For a single project,
create `.grok/hooks/serena-hooks.json` in that project instead; note that Grok loads project-scoped hooks
only after you have trusted the project for hook execution (via Grok's `/hooks-trust` command).

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "grep|read_file|run_terminal_command",
        "hooks": [
          {
            "type": "command",
            "command": "serena-hooks remind --client=grok",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "serena-hooks cleanup --client=grok",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

The hooks will:

- **`remind`**: Nudge the agent to use Serena's symbolic tools when it makes too many consecutive
  code-search or code-file-read calls without using Serena tools in between.
- **`cleanup`**: Clean up hook session data when the agent turn ends.

Grok ignores stdout from passive hooks such as `SessionStart`, so the Grok hook setup intentionally
uses only `PreToolUse` for reminders and `Stop` for cleanup.

## Claude Desktop

On Windows and macOS, there are official [Claude Desktop applications by Anthropic](https://claude.ai/download); for Linux, there is an [open-source
community version](https://github.com/aaddrick/claude-desktop-debian).

To configure MCP server settings, go to File / Settings / Developer / MCP Servers / Edit Config,
which will let you open the JSON file `claude_desktop_config.json`.

Add the `serena` MCP server configuration

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--context=desktop-app"
      ]
    }
  }
}
```

If your language server requires specific environment variables to be set (e.g. F# on macOS with Homebrew),
you can add them via an `env` key (see [above](#clients-common-pitfalls)).

**Verification.**
Once you have created the new MCP server entry, save the config and then restart Claude Desktop.

:::{attention}
Be sure to fully quit the Claude Desktop application via File / Exit, as regularly closing the application will just
minimize it.
:::

After restarting, you should see Serena's tools in your chat interface (notice the small hammer icon).

## Copilot CLI

In the interactive mode, you can call `/mcp add` from within the copilot CLI. There, use serena as name, 
STDIO as the server type, and `serena start-mcp-server --context=copilot-cli --project-from-cwd` as command.

Alternatively, add the following to `~/.copilot/mcp-config.json` (create the file if it does not exist):

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "tools": [
        "*"
      ],
      "args": [
        "start-mcp-server",
        "--context=copilot-cli",
        "--project-from-cwd"
      ]
    }
  }
}
```

**Verification.**
Copilot should now show that Serena is running, though you may have to restart it.


## JetBrains Junie

For the Junie plugin in JetBrains IDEs you can add Serena either to the global configuration in `~/.junie/mcp/mcp.json` 
or to the project configuration in `<project>/.junie/mcp/mcp.json`. Important, don't add both!
In both cases the entry should be:


```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--context=junie",
        "--project-from-cwd"
      ]
    }
  }
}
```

With the global configuration, Serena will be available in all projects. However,
within the Junie plugin, projects will not be automatically activated in Serena. 
You may thus have to prompt 
Junie to "Activate the current project using serena's activation tool" at the start of each session (though some models are
smart enough to activate the project automatically).

With the project-scoped configuration, Serena will be available only in that project, and the project will automatically
be recognized as active by Serena.


## JetBrains AI Assistant

Go to Settings / Tools / AI Assistant / MCP and enter the following configuration:

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--context=jb-ai-assistant",
        "--project-from-cwd"
      ]
    }
  }
}
```

Like for Junie, you have the choice between the global and the project-scoped configuration, 
with the same trade-off.

## Antigravity

Add this configuration:

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--context=antigravity"
      ]
    }
  }
}
```

You will have to prompt Antigravity's agent to "Activate the current project using serena's activation tool" after starting Antigravity in the project directory (once in the first chat enough, all other chat sessions will continue using the same Serena session).


Unlike VSCode, Antigravity does not currently support including the working directory in the MCP configuration.
Also, the current client will be shown as `none` in Serena's dashboard (Antigravity currently does not fully support the MCP specifications). This is not a problem, all tools will work as expected.

## CodeBuddy

Serena provides native support for CodeBuddy, a CLI coding agent that shares a similar architecture with Claude Code.
To set up the Serena MCP server for CodeBuddy, simply run:

    serena setup codebuddy

### Manual Setup

**Global Configuration**. To add the Serena MCP server for all your projects, use the user-level configuration of CodeBuddy and the `--project-from-cwd` flag:

```bash
codebuddy mcp add --scope user serena -- serena start-mcp-server --context codebuddy --project-from-cwd
```

**Project-Level Configuration**. To add the Serena MCP server for a single project only:

```bash
codebuddy mcp add serena -- serena start-mcp-server --context codebuddy --project "$(pwd)"
```

Confirm that CodeBuddy is connected to Serena by running the `/mcp` command and reconnecting if necessary.

### Hooks

CodeBuddy supports the same hook system as Claude Code. To set up hooks, add the following to your CodeBuddy settings file (`.codebuddy/settings.json` in your project directory, or `~/.codebuddy/settings.json` globally):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "serena-hooks remind --client=codebuddy"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "serena-hooks auto-approve --client=codebuddy"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "serena-hooks activate --client=codebuddy"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "serena-hooks cleanup --client=codebuddy"
          }
        ]
      }
    ]
  }
}
```
