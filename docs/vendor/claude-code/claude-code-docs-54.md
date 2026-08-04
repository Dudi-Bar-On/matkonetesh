---
name: claude-code-docs-54
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 54/66 (code.claude.com)"
type: reference
---

### From a config file

Create a `.mcp.json` file at your project root. The file is picked up when the `project` setting source is enabled, which it is for default `query()` options. If you set `settingSources` explicitly, include `"project"` for this file to load:

```json theme={null}
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
    }
  }
}
```

## Connection timing

Servers you pass in `options.mcpServers` start connecting as soon as the query starts. Connection is non-blocking by default: the first turn begins without waiting, and each server's tools become available once its connection completes. {/* min-version: 2.1.142 */}Before Claude Code v2.1.142, startup blocked on the connection batch for up to 5 seconds.

To restore a bounded startup wait for every server, set the [`MCP_CONNECTION_NONBLOCKING`](/docs/en/env-vars) environment variable to `0`. The wait is capped at 5 seconds by [`MCP_CONNECT_TIMEOUT_MS`](/docs/en/env-vars), and servers still pending at that deadline keep connecting in the background.

To make one server's tools available before the first turn, set `alwaysLoad: true` on its config. Startup then waits for that server to connect, capped at the same 5-second startup deadline, while other servers keep connecting in the background. The `alwaysLoad` field requires Claude Code v2.1.121 or later. See [Exempt a server from deferral](/docs/en/mcp#exempt-a-server-from-deferral) for the `alwaysLoad` field's effect on tool search.

The `system` message with subtype `init` reports each server's status at the moment it's emitted. A server that's still connecting has status `pending`. Check for status `failed` or `needs-auth` when you want to detect servers that won't be usable, rather than treating every status other than `connected` as a failure; see [Error handling](#error-handling) for the full status check.

## Allow MCP tools

MCP tools require explicit permission before Claude can use them. Without permission, Claude will see that tools are available but won't be able to call them.

### Tool naming convention

MCP tools follow the naming pattern `mcp__<server-name>__<tool-name>`. For example, a GitHub server named `"github"` with a `list_issues` tool becomes `mcp__github__list_issues`.

### Auto-approve with allowedTools

Use `allowedTools` to auto-approve specific MCP tools so Claude can use them without a permission prompt:

<CodeGroup>
  ```typescript TypeScript hidelines={1,-1} theme={null}
  const _ = {
    options: {
      mcpServers: {
        // your servers
      },
      allowedTools: [
        "mcp__github__*", // All tools from the github server
        "mcp__db__query", // Only the query tool from db server
        "mcp__slack__send_message" // Only send_message from slack server
      ]
    }
  };
  ```

  ```python Python theme={null}
  options = ClaudeAgentOptions(
      mcp_servers={
          # your servers
      },
      allowed_tools=[
          "mcp__github__*",  # All tools from the github server
          "mcp__db__query",  # Only the query tool from db server
          "mcp__slack__send_message",  # Only send_message from slack server
      ],
  )
  ```
</CodeGroup>

Wildcards (`*`) let you allow all tools from a server without listing each one individually.

<Note>
  **Prefer `allowedTools` over permission modes for MCP access.** `permissionMode: "acceptEdits"` does not auto-approve MCP tools (only file edits and filesystem Bash commands). `permissionMode: "bypassPermissions"` does auto-approve MCP tools but also disables most other safety prompts, which is broader than necessary; see [How permissions are evaluated](/docs/en/agent-sdk/permissions#how-permissions-are-evaluated) for the prompts that remain. A wildcard in `allowedTools` grants exactly the MCP server you want and nothing more. See [Permission modes](/docs/en/agent-sdk/permissions#permission-modes) for a full comparison.
</Note>

### Discover available tools

To see what tools an MCP server provides, check the server's documentation or inspect the `tools` array in the `system` init message. MCP tool names start with `mcp__`.

MCP servers connect in the background by default, so the init message arrives before they finish: the `tools` array lists only built-in tools and `mcp_servers` shows a `pending` status for each server. Set the [`MCP_CONNECTION_NONBLOCKING`](/docs/en/env-vars) environment variable to `0` to wait up to 5 seconds for servers to connect before the init message is sent; servers that connect in time list their `mcp__` tools there, and slower ones keep connecting in the background:

```bash theme={null}
export MCP_CONNECTION_NONBLOCKING=0
```

With that variable set, this filter prints the MCP tool names:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const options = {
    mcpServers: {
      // your servers
    },
  };

  for await (const message of query({ prompt: "...", options })) {
    if (message.type === "system" && message.subtype === "init") {
      const mcpTools = message.tools.filter((name) => name.startsWith("mcp__"));
      console.log("Available MCP tools:", mcpTools);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, SystemMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              # your servers
          },
      )
      async for message in query(prompt="...", options=options):
          if isinstance(message, SystemMessage) and message.subtype == "init":
              mcp_tools = [t for t in message.data.get("tools", []) if t.startswith("mcp__")]
              print("Available MCP tools:", mcp_tools)


  asyncio.run(main())
  ```
</CodeGroup>

You can also ask Claude to list the tools available from a server.

## Transport types

MCP servers communicate with your agent using different transport protocols. Check the server's documentation to see which transport it supports:

* If the docs give you a **command to run** (like `npx @modelcontextprotocol/server-filesystem`), use stdio
* If the docs give you a **URL**, use HTTP or SSE
* If you're building your own tools in code, use an SDK MCP server
