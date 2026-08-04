---
name: serena-docs-11
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 11/26 (docs)"
type: reference
---

## VSCode

You can add Serena to VSCode by running the MCP: Add Server command.
In that dialogue, select the Command (stdio) option. You can decide between installing it globally
or in the workspace (only for the currently open project), and the command you should enter depends on that choice.
(You will be asked to choose after entering the mcp run command.)

**Global.** (Recommended)
Enter `serena start-mcp-server --context=vscode`. Unfortunately, due to a [bug in VSCode](https://github.com/microsoft/vscode/issues/245905),
in this setting Serena won't be able to activate the project automatically. You will have to remember to prompt
"Activate the current dir as project using serena" at the start of each session.

**Workspace.**
Enter `serena start-mcp-server --context=vscode --project ${workspaceFolder}`. This will allow Serena to automatically activate the project,
with the downside that you will have to add Serena to each project you want to use it in.

In both cases, proceed to enter Serena as the name, then select either global or workspace.

**Verification.**
You should be able to see Serena in the tools overview in the AI Chat window.

**Hooks.**
Due to recent changes (especially dynamic tool loading) in VSCode, the agent will often fail to make proper use
of Serena's tools, either by failing to load them in the beginning or by forgetting the instructions in a long session
(a behaviour known as agent drift). To counteract this, we provide reminder hooks. We **strongly recommend** setting
up the hooks as below (or a variation thereof) for optimal performance of Serena in VSCode.


The hooks will:

- **`remind`**: Nudge the agent to use Serena's symbolic tools when it makes too many consecutive
  `grep` or `read_file` calls without using any Serena tools in between.
- **`activate`**: Prompt the agent to activate the project and read Serena's instructions at session start.
- **`cleanup`**: Clean up hook session data when the session ends.

To set this up, create the file `~/.copilot/hooks/serena-hooks.json` with the following content:

```json
{
    "hooks": {
        "PreToolUse": [
            {
                "type": "command",
                "command": "serena-hooks remind --client=vscode"
            }
        ],
        "SessionStart": [
            {
                "type": "command",
                "command": "serena-hooks activate --client=vscode"
            }
        ],
        "Stop": [
            {
                "type": "command",
                "command": "serena-hooks cleanup --client=vscode"
            }
        ]
    }
}
```

The `SessionStart` hook also addresses the global configuration limitation mentioned above — it will
automatically prompt the agent to activate the project directory, so you no longer need to do this manually.

## Copilot CLI

Use the interactive `/mcp add` slash command, choose Serena as the name, STDIO as the server type, and
`serena start-mcp-server --context=copilot-cli --project-from-cwd` as command. Copilot CLI will immediately notify you
that Serena is running if everything is set up correctly or display an error otherwise.

You should add the same **hooks** as in VSCode (see above) if Copilot CLI didn't pick them up automatically.


## Codex (CLI and App)

You can simply run `serena setup codex`.

Alternatively, you can manually add the following to `~/.codex/config.toml` (create the file if it does not exist):

```toml
[mcp_servers.serena]
startup_timeout_sec = 15
command = "serena"
args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
```

**Verification.**
Run the `/mcp` command and verify that Serena is connected.
The Codex app does not start a session in the project's directory, so when using the app, we recommend
asking Codex to "Activate the current dir as project using serena" at the start of each session (though Codex might
do this automatically).

**Hooks.**
Codex supports lifecycle hooks; see the
[Codex hooks documentation](https://developers.openai.com/codex/hooks) for details. To enable
Serena's hooks for Codex, add this feature flag to `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

Then create `~/.codex/hooks.json` with the following content:

```json
{
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": "serena-hooks remind --client=codex"
                    }
                ]
            }
        ],
        "SessionStart": [
            {
                "matcher": "startup|resume",
                "hooks": [
                    {
                        "type": "command",
                        "command": "serena-hooks activate --client=codex"
                    }
                ]
            }
        ],
        "SessionEnd": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": "serena-hooks cleanup --client=codex"
                    }
                ]
            }
        ]
    }
}
```

The `SessionEnd` cleanup hook requires Codex 0.145.0 or newer. Older Codex versions only support
`Stop` for cleanup, which currently has a [known compatibility issue](https://github.com/oraios/serena/issues/1533).
If you still configure it, replace `SessionEnd` with `Stop` in the example above. Configure cleanup
under exactly one of these events, never both: `Stop` runs after every turn, while `SessionEnd` runs
when Codex tears down the root thread.

The hooks will:

- **`activate`**: Prompt the agent to activate the current project and read Serena's instructions
  when a Codex session starts or resumes.
- **`remind`**: Nudge the agent to use Serena's symbolic tools when it makes too many consecutive
  code-search or code-file-read calls without using Serena tools in between.
- **`cleanup`**: Clean up hook session data when the session ends.

The `PreToolUse` matcher is intentionally restricted to `Bash`. The Serena reminder hook for Codex
tracks shell-based grep and code-file reads, so running it for every tool call is unnecessary.

## Grok

Serena provides native support for xAI's Grok Build CLI. To set up the Serena MCP server for Grok,
simply run:

    serena setup grok

### Manual Setup

**Global Configuration**. To add the Serena MCP server for all your projects, use Grok's user-level configuration and the `--project-from-cwd` flag:

```bash
grok mcp add --scope user serena -- serena start-mcp-server --context=grok --project-from-cwd
```

Alternatively, add the following to `~/.grok/config.toml`:

```toml
[mcp_servers.serena]
command = "serena"
args = ["start-mcp-server", "--project-from-cwd", "--context=grok"]
```

**Project-Level Configuration**. To add the Serena MCP server for a single project only:

```bash
grok mcp add --scope project serena -- serena start-mcp-server --context=grok --project "$(pwd)"
```

**Verification.**
Run `grok inspect` and verify that Serena is listed as an MCP server. You can also use Grok's `/mcps`
modal to inspect, refresh, enable, or disable configured MCP servers.

Grok can also load existing Claude Code MCP configuration. If you previously ran `serena setup claude-code`,
Serena may already appear in Grok, but it will use the `claude-code` context instead of the dedicated `grok` context.
