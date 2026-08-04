---
name: claude-code-docs-45
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 45/66 (code.claude.com)"
type: reference
---

## Configure hooks

To configure a hook, pass it in the `hooks` field of your agent options (`ClaudeAgentOptions` in Python, the `options` object in TypeScript). This snippet assumes you have already defined a hook callback, like `protect_env_files` in Python or `protectEnvFiles` in TypeScript from the example above:

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      hooks={"PreToolUse": [HookMatcher(matcher="Bash", hooks=[my_callback])]}
  )

  async with ClaudeSDKClient(options=options) as client:
      await client.query("Your prompt")
      async for message in client.receive_response():
          print(message)
  ```

  ```typescript TypeScript theme={null}
  for await (const message of query({
    prompt: "Your prompt",
    options: {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [myCallback] }]
      }
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

The `hooks` option is a dictionary in Python or an object in TypeScript, where:

* **Keys**: [hook event names](#available-hooks) such as `'PreToolUse'`, `'PostToolUse'`, and `'Stop'`
* **Values**: arrays of [matchers](#matchers), each containing an optional filter pattern and your [callback functions](#callback-functions)

### Matchers

Use matchers to filter when your callbacks fire. The `matcher` field matches against a different value depending on the hook event type. For example, tool-based hooks match against the tool name, while `Notification` hooks match against the notification type. See the [Claude Code hooks reference](/docs/en/hooks#matcher-patterns) for the full list of matcher values for each event type.

SDK matchers follow the same rules as [matchers in settings files](/docs/en/hooks#matcher-patterns). A matcher containing only letters, digits, `_`, `-`, spaces, `,`, and `|` is compared as an exact string, with alternatives separated by `|` or `,` and optional surrounding whitespace, so `Write|Edit` and `Write, Edit` each match exactly those two tools and `code-reviewer` matches only that agent type. A matcher of `*`, an empty string, or omitting the matcher entirely matches every occurrence of the event.

A matcher containing any other character is evaluated as an unanchored regular expression, so `^mcp__` matches every MCP tool and `Edit.*` matches both `Edit` and `NotebookEdit`. Wrap a regular expression in `^` and `$` when you need a whole-string match.

A matcher like `mcp__memory` or `mcp__brave-search` contains only exact-match characters, so it is compared as an exact string and matches no tool; use `mcp__memory__.*` to match every tool from that server.

Hyphens in the exact-match set require a Claude Code runtime of v2.1.195 or later. On earlier versions a hyphenated name like `code-reviewer` is evaluated as an unanchored regular expression and must be anchored as `^code-reviewer$` to match exactly.

`StopFailure` and `FileChanged` use a narrower exact-match set of letters, digits, `_`, and `|` only. A hyphen, space, or comma in a matcher for those two events keeps it on the regular-expression path, and only `|` separates alternatives, so write `rate_limit|overloaded`, not `rate_limit, overloaded`. `FileChanged` additionally uses its matcher to build the watch list of literal filenames; see [FileChanged in the hooks reference](/docs/en/hooks#filechanged).

| Option    | Type             | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matcher` | `string`         | `undefined` | Pattern matched against the event's filter field, following the comparison rules above. For tool hooks, this is the tool name. Built-in tools include `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `Agent`, and others (see [Tool Input Types](/docs/en/agent-sdk/typescript#tool-input-types) for the full list). MCP tools use the pattern `mcp__<server>__<action>`.                 |
| `hooks`   | `HookCallback[]` | -           | Required. Array of callback functions to execute when the pattern matches                                                                                                                                                                                                                                                                                                                          |
| `timeout` | `number`         | `undefined` | Timeout in seconds. When omitted, Claude Code applies the [event's default timeout](#hook-timeout): 10 minutes for most events, 30 seconds for `UserPromptSubmit`. Claude Code uses shorter limits for a few events, such as 10 seconds for `MessageDisplay` and a 1.5-second default [budget](/docs/en/hooks#sessionend-input) for `SessionEnd`. Your SDK callbacks follow the `command` hook defaults |

Use the `matcher` pattern to target specific tools whenever possible. A matcher with `'Bash'` only runs for Bash commands, while omitting the pattern runs your callbacks for every occurrence of the event.

For tool-based hooks, matchers only filter by tool name, not by file paths or other arguments. To filter by file path, check `tool_input.file_path` inside your callback.

<Tip>
  **Discovering tool names:** See [Tool Input Types](/docs/en/agent-sdk/typescript#tool-input-types) for the full list of built-in tool names, or add a hook without a matcher to log all tool calls your session makes.

  **MCP tool naming:** MCP tools always start with `mcp__` followed by the server name and action: `mcp__<server>__<action>`. For example, if you configure a server named `playwright`, its tools are named `mcp__playwright__browser_screenshot`, `mcp__playwright__browser_click`, and so on. The server name comes from the key you use in the `mcpServers` configuration.
</Tip>

### Callback functions
