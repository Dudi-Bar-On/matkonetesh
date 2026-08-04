---
name: claude-code-docs-53
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 53/66 (code.claude.com)"
type: reference
---

## Known limitations

Plan around these in your deployment design.

| Limitation                                          | What to do                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No top-level session timeout                        | A session does not time out on its own. Set `maxTurns` in `Options` to bound how many tool-use round trips the agent takes before stopping.                                                                                                                                                  |
| Memory growth over long sessions                    | Cap session length or recycle subprocesses periodically. See [Scaling and concurrency](#scaling-and-concurrency).                                                                                                                                                                            |
| Large parallel-subagent fanouts can hit rate limits | Break work into smaller batches rather than issuing one wide dispatch.                                                                                                                                                                                                                       |
| No per-subagent wall-clock deadline                 | Cap each [subagent](/docs/en/agent-sdk/subagents) with `maxTurns` in its `AgentDefinition`. For background subagents only, `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` sets a stall watchdog that fires when a `run_in_background` subagent stops producing output; it is not a total-runtime deadline. |

## Next steps

* [Hosting cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/claude_agent_sdk/07_Hosting_the_agent.ipynb): notebook walkthrough with [deployable code](https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk/hosting) for Docker, Modal, and Kubernetes.
* [Session storage](/docs/en/agent-sdk/session-storage): persist transcripts across hosts with a `SessionStore` adapter.
* [Observability](/docs/en/agent-sdk/observability): export OTEL traces, metrics, and logs to your collector.
* [Secure deployment](/docs/en/agent-sdk/secure-deployment): network controls, credential management, and isolation hardening.
* [Cost tracking](/docs/en/agent-sdk/cost-tracking): per-session token and cost accounting.


<!-- source: https://code.claude.com/docs/en/agent-sdk/mcp.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Connect to external tools with MCP

> Configure MCP servers to extend your agent with external tools. Covers transport types, tool search for large tool sets, authentication, and error handling.

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro) is an open standard for connecting AI agents to external tools and data sources. With MCP, your agent can query databases, integrate with APIs like Slack and GitHub, and connect to other services without writing custom tool implementations.

MCP servers can run as local processes, connect over HTTP, or execute directly within your SDK application.

<Note>
  This page covers MCP configuration for the Agent SDK. To add MCP servers to the Claude Code CLI so they load in every project, see [MCP installation scopes](/docs/en/mcp#mcp-installation-scopes).
</Note>

## Quickstart

This example connects to the [Claude Code documentation](https://code.claude.com/docs) MCP server using [HTTP transport](#http%2Fsse-servers) and uses [`allowedTools`](#allow-mcp-tools) with a wildcard to permit all tools from the server.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Use the docs MCP server to explain what hooks are in Claude Code",
    options: {
      mcpServers: {
        "claude-code-docs": {
          type: "http",
          url: "https://code.claude.com/docs/mcp"
        }
      },
      allowedTools: ["mcp__claude-code-docs__*"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              "claude-code-docs": {
                  "type": "http",
                  "url": "https://code.claude.com/docs/mcp",
              }
          },
          allowed_tools=["mcp__claude-code-docs__*"],
      )

      async for message in query(
          prompt="Use the docs MCP server to explain what hooks are in Claude Code",
          options=options,
      ):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

The agent connects to the documentation server, searches for information about hooks, and returns the results.

## Add an MCP server

You can configure MCP servers in code when calling `query()`, or in a `.mcp.json` file loaded via [`settingSources`](#from-a-config-file).

### In code

Pass MCP servers directly in the `mcpServers` option:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "List files in my project",
    options: {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
        }
      },
      allowedTools: ["mcp__filesystem__*"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              "filesystem": {
                  "command": "npx",
                  "args": [
                      "-y",
                      "@modelcontextprotocol/server-filesystem",
                      "/Users/me/projects",
                  ],
              }
          },
          allowed_tools=["mcp__filesystem__*"],
      )

      async for message in query(prompt="List files in my project", options=options):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>
