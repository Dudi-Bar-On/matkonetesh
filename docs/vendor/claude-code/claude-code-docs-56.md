---
name: claude-code-docs-56
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 56/66 (code.claude.com)"
type: reference
---

### OAuth2 authentication

The [MCP specification supports OAuth 2.1](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) for authorization. The SDK doesn't open a browser or run an interactive OAuth flow. When a configured server returns an authorization challenge and no stored token is available, the agent run continues without that server's tools, and the server reports status `needs-auth`. Because servers connect in the background by default, the `mcp_servers` array of the [system init message](/docs/en/agent-sdk/typescript#sdksystemmessage) may still show `pending` for that server. To confirm whether a server needs credentials, poll `mcpServerStatus()` in the TypeScript SDK or [`get_mcp_status()`](/docs/en/agent-sdk/python#methods) in Python, or set `MCP_CONNECTION_NONBLOCKING=0` to wait for connections before the init message.

To supply credentials, complete the OAuth flow in your own application and pass the resulting access token in the server's `headers`:

<CodeGroup>
  ```typescript TypeScript theme={null}
  // After completing OAuth flow in your app.
  // Implement getAccessTokenFromOAuthFlow for your OAuth provider.
  const accessToken = await getAccessTokenFromOAuthFlow();

  const options = {
    mcpServers: {
      "oauth-api": {
        type: "http",
        url: "https://api.example.com/mcp",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    },
    allowedTools: ["mcp__oauth-api__*"]
  };
  ```

  ```python Python theme={null}
  # After completing OAuth flow in your app.
  # Implement get_access_token_from_oauth_flow for your OAuth provider.
  access_token = await get_access_token_from_oauth_flow()

  options = ClaudeAgentOptions(
      mcp_servers={
          "oauth-api": {
              "type": "http",
              "url": "https://api.example.com/mcp",
              "headers": {"Authorization": f"Bearer {access_token}"},
          }
      },
      allowed_tools=["mcp__oauth-api__*"],
  )
  ```
</CodeGroup>

## Examples

### List issues from a repository

This example connects to the remote [GitHub MCP server](https://github.com/github/github-mcp-server) to list recent issues. The example includes debug logging to verify the MCP connection and tool calls.

Before running, create a [GitHub personal access token](https://github.com/settings/personal-access-tokens) with read access to the repositories you want to query and set it as an environment variable:

```bash theme={null}
export GITHUB_TOKEN=YOUR_GITHUB_PAT
```

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "List the 3 most recent issues in anthropics/claude-code",
    options: {
      mcpServers: {
        github: {
          type: "http",
          url: "https://api.githubcopilot.com/mcp/",
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
          }
        }
      },
      allowedTools: ["mcp__github__list_issues"]
    }
  })) {
    // Verify MCP server connected successfully
    if (message.type === "system" && message.subtype === "init") {
      console.log("MCP servers:", message.mcp_servers);
    }

    // Log when Claude calls an MCP tool
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use" && block.name.startsWith("mcp__")) {
          console.log("MCP tool called:", block.name);
        }
      }
    }

    // Print the final result
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  import os
  from claude_agent_sdk import (
      query,
      ClaudeAgentOptions,
      ResultMessage,
      SystemMessage,
      AssistantMessage,
  )


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              "github": {
                  "type": "http",
                  "url": "https://api.githubcopilot.com/mcp/",
                  "headers": {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"},
              }
          },
          allowed_tools=["mcp__github__list_issues"],
      )

      async for message in query(
          prompt="List the 3 most recent issues in anthropics/claude-code",
          options=options,
      ):
          # Verify MCP server connected successfully
          if isinstance(message, SystemMessage) and message.subtype == "init":
              print("MCP servers:", message.data.get("mcp_servers"))

          # Log when Claude calls an MCP tool
          if isinstance(message, AssistantMessage):
              for block in message.content:
                  if hasattr(block, "name") and block.name.startswith("mcp__"):
                      print("MCP tool called:", block.name)

          # Print the final result
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>
