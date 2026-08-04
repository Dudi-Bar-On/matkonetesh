---
name: serena-docs-10
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 10/26 (docs)"
type: reference
---

## Copilot in JetBrains

Open the settings of your JetBrains IDE and go to Tools / GitHub Copilot / Model Context Protocol (MCP). Then click
on the Configure button. This will open your global `mcp.json` file, where you can add the following entry for Serena:

```json
{
    "servers": {
      "serena": {
        "type": "stdio",
        "command": "serena",
        "args": [
          "start-mcp-server",
          "--context=jb-copilot-plugin"
        ]
      }
    }
}
```

**Verification.**
Open Copilot, switch to Agent mode, and click on the configure tools button. You should see Serena's tools in the list and be able to start
the Serena server there (you do not generally have to start Serena in the future, Copilot will start the server by itself). If the server is shown as running, Copilot is successfully connected to Serena. Most models will understand how to use Serena's tools out of the box, but for some models you may have to prompt "Activate the current project with Serena and read initial instructions" in the beginning of the chat.

**Recommended Configuration**.
The `jb-copilot-plugin` context (see above) comes with our recommended subset of Serena's tools for Copilot in JetBrains IDEs. We also 
recommend *disabling* the following built-in tools for optimal performance: 
replace_string_in_file, apply_patch, list_dir, file_search, grep_search. Note that running subagents may not use MCP servers, consider deactivating the run_subagent tool as well.

Serena offers better alternatives to these basic tools. If you do prefer to use the built-in tools instead,
you should disable corresponding Serena tools instead to prevent context bloat.

We also recommend marking Serena's tools as approved so you don't have to manually approve them in agent sessions. 
You can do this in Tools / GitHub Copilot / Chat, where at the bottom you can click on the Configure button for MCP tool auto-approval.

## Claude Code

Serena is a great way to make Claude Code both more efficient and more powerful!
To set up the Serena MCP server for Claude Code, you can simply run this command: 

    serena setup claude-code

Find manual setup instructions as well as workarounds for Claude Code's recent regressions pertaining to (external) tool use below.

:::{attention}
Recent updates to Claude Code (CC) and to the Opus line of models resulted in drastically reduced
adherence to instructions pertaining to Serena's tools.

After extensive analysis, we identified part of the reason to be very long and detailed
tool descriptions for built-in tools and parts of the default system prompt. 
The descriptions of CC's system tools take almost 16k tokens, cannot be adjusted by the user,
and introduce a very strong bias towards internal tools, making it almost impossible to convince Opus 4.7 to use Serena.

As a workaround, we crafted a system prompt that counteracts this bias.
When using Serena, we highly recommend that you start CC as 

```shell
claude --system-prompt="$(serena prompts print-cc-system-prompt-override)"
```

You can also consider adding the content of `serena cc-system-prompt-override` to your `CLAUDE.md` files,
but the effect be insufficient for counteracting Claude Code's bias towards internal tools.
:::

**Global Configuration**. To add the Serena MCP server for all your projects, use the user-level configuration of claude code and the `--project-from-cwd` flag:

```shell
claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd
```

**Per-Project Configuration.** Alternatively, to add Serena only for the current project in the current directory, 
use the command:

```shell
claude mcp add serena -- serena start-mcp-server --context claude-code --project "$(pwd)"
```

**Verification.**
Confirm that Claude Code is connected to Serena by running the `/mcp` command and by reconnecting, if necessary.
If Serena fails to start fast enough, you should set `MCP_TIMEOUT` to a sufficiently high value
(e.g. by adding `export MCP_TIMEOUT=60000` to your shell profile)

**Hooks.**
Due to recent changes (especially dynamic tool loading) in Claude Code, the agent will often fail to make proper use
of Serena's tools, either by failing to load them in the beginning or by forgetting the instructions in a long session
(a behavior known as agent drift). To counteract this, we provide reminder hooks. We **strongly recommend** setting
up the hooks as below (or a variation thereof) for optimal performance of Serena in Claude Code.

:::{note}
While recommended, hooks are an **alpha feature**. Provide feedback via the [GitHub issue tracker](https://github.com/oraios/serena/issues) if you encounter any issues.
:::

To set up hooks, add the following to your Claude Code settings file
(`.claude/settings.json` in your project directory, or `~/.claude/settings.json` globally):

All hooks below are opt-in — include only the ones you want. Add the following to your
Claude Code settings file (`.claude/settings.json` in your project directory, or
`~/.claude/settings.json` globally):

```json
{
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "serena-hooks remind --client=claude-code"
                    }
                ]
            },
            {
                "matcher": "mcp__serena__*",
                "hooks": [
                    {
                        "type": "command",
                        "command": "serena-hooks auto-approve --client=claude-code"
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
                        "command": "serena-hooks activate --client=claude-code"
                    }
                ]
            }
        ],
        "SessionEnd": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "serena-hooks cleanup --client=claude-code"
                    }
                ]
            }
        ]
    }
}
```

The hooks will:

- **`remind`**: Nudge the agent to use Serena's symbolic tools when it makes too many consecutive
  `grep` or `read_file` calls without using any Serena tools in between.
- **`activate`**: Prompt the agent to activate the project and read Serena's instructions at session start.
- **`cleanup`**: Clean up hook session data when the session ends.
- **`auto-approve`**: Auto-approve Serena tool calls whenever Claude Code is in a permissive
  permission mode (`acceptEdits` or `auto`), so blanket approvals cover Serena's destructive
  tools (e.g. `replace_symbol_body`, `rename_symbol`) instead of prompting on every call.

For more details on Claude Code's hook system, see the
[Claude Code hooks documentation](https://code.claude.com/docs/en/hooks).
