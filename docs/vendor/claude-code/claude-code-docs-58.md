---
name: claude-code-docs-58
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 58/66 (code.claude.com)"
type: reference
---

### Server shows "failed" status

Check the `init` message to see which servers failed to connect:

<CodeGroup>
  ```typescript TypeScript theme={null}
  if (message.type === "system" && message.subtype === "init") {
    for (const server of message.mcp_servers) {
      if (server.status === "failed") {
        console.error(`Server ${server.name} failed to connect`);
      }
    }
  }
  ```

  ```python Python theme={null}
  if isinstance(message, SystemMessage) and message.subtype == "init":
      for server in message.data.get("mcp_servers", []):
          if server.get("status") == "failed":
              print(f"Server {server['name']} failed to connect")
  ```
</CodeGroup>

A `"pending"` status means the server is still connecting, not that it failed. To get updated statuses later in the session, call the query's `mcpServerStatus()` method in the TypeScript SDK, or [`ClaudeSDKClient.get_mcp_status()`](/docs/en/agent-sdk/python#methods) in Python.

Common causes:

* **Missing environment variables**: Ensure required tokens and credentials are set. For stdio servers, check the `env` field matches what the server expects.
* **Server not installed**: For `npx` commands, verify the package exists and Node.js is in your PATH.
* **Invalid connection string**: For database servers, verify the connection string format and that the database is accessible.
* **Network issues**: For remote HTTP/SSE servers, check the URL is reachable and any firewalls allow the connection.

### Tools not being called

If Claude sees tools but doesn't use them, check that you've granted permission with `allowedTools`:

<CodeGroup>
  ```typescript TypeScript hidelines={1,-1} theme={null}
  const _ = {
    options: {
      mcpServers: {
        // your servers
      },
      allowedTools: ["mcp__servername__*"] // Auto-approve calls from this server
    }
  };
  ```

  ```python Python theme={null}
  options = ClaudeAgentOptions(
      mcp_servers={
          # your servers
      },
      allowed_tools=["mcp__servername__*"],  # Auto-approve calls from this server
  )
  ```
</CodeGroup>

### Connection timeouts

MCP server connections time out after 30 seconds by default. If your server takes longer to start, the connection fails. Raise the limit with the [`MCP_TIMEOUT`](/docs/en/env-vars) environment variable, in milliseconds. For servers that need more startup time, also consider:

* Using a lighter-weight server if available
* Pre-warming the server before starting your agent
* Checking server logs for slow initialization causes

### Tool output exceeds maximum allowed tokens

The SDK applies the same MCP output limit as Claude Code. When a tool result is larger than 25,000 tokens, the full output is saved to a file and the tool result is replaced with an error message that names the file path, so the agent can read the output back in portions. Raise the limit with the [`MAX_MCP_OUTPUT_TOKENS`](/docs/en/env-vars) environment variable. See [MCP output limits and warnings](/docs/en/mcp#mcp-output-limits-and-warnings) for the full behavior, including how a server can declare a higher per-tool limit.

## Related resources

* **[Custom tools guide](/docs/en/agent-sdk/custom-tools)**: Build your own MCP server that runs in-process with your SDK application
* **[Permissions](/docs/en/agent-sdk/permissions)**: Control which MCP tools your agent can use with `allowedTools` and `disallowedTools`
* **[MCP output limits and warnings](/docs/en/mcp#mcp-output-limits-and-warnings)**: How the SDK handles tool results that exceed `MAX_MCP_OUTPUT_TOKENS`, including the persist-to-disk fallback and the `anthropic/maxResultSizeChars` per-tool annotation
* **[TypeScript SDK reference](/docs/en/agent-sdk/typescript)**: Full API reference including MCP configuration options
* **[Python SDK reference](/docs/en/agent-sdk/python)**: Full API reference including MCP configuration options
* **[MCP server directory](https://github.com/modelcontextprotocol/servers)**: Browse available MCP servers for databases, APIs, and more


<!-- source: https://code.claude.com/docs/en/agent-sdk/migration-guide.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Migrate to Claude Agent SDK

> Guide for migrating the Claude Code TypeScript and Python SDKs to the Claude Agent SDK

## Overview

The Claude Code SDK has been renamed to the **Claude Agent SDK** and its documentation has been reorganized. This change reflects the SDK's broader capabilities for building AI agents beyond just coding tasks.

## What's Changed

| Aspect                     | Old                         | New                              |
| :------------------------- | :-------------------------- | :------------------------------- |
| **Package Name (TS/JS)**   | `@anthropic-ai/claude-code` | `@anthropic-ai/claude-agent-sdk` |
| **Python Package**         | `claude-code-sdk`           | `claude-agent-sdk`               |
| **Documentation Location** | Claude Code docs            | API Guide → Agent SDK section    |

<Note>
  **Documentation Changes:** The Agent SDK documentation has moved from the Claude Code docs to the API Guide under a dedicated [Agent SDK](/docs/en/agent-sdk/overview) section. The Claude Code docs now focus on the CLI tool and automation features.
</Note>

## Migration Steps

### For TypeScript/JavaScript Projects

**1. Uninstall the old package:**

```bash theme={null}
npm uninstall @anthropic-ai/claude-code
```

**2. Install the new package:**

```bash theme={null}
npm install @anthropic-ai/claude-agent-sdk
```

**3. Update your imports:**

Change all imports from `@anthropic-ai/claude-code` to `@anthropic-ai/claude-agent-sdk`:

```typescript theme={null}
// Before
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-code";

// After
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
```

**4. Update package.json dependencies:**

If you have the package listed in your `package.json`, update it:

Before:

```json theme={null}
{
  "dependencies": {
    "@anthropic-ai/claude-code": "^0.0.42"
  }
}
```

After:

```json theme={null}
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.3.0"
  }
}
```

**5. Review [breaking changes](#breaking-changes)**

Make any code changes needed to complete the migration.

### For Python Projects

**1. Uninstall the old package:**

```bash theme={null}
pip uninstall -y claude-code-sdk
```

If the old package isn't installed, pip prints `WARNING: Skipping claude-code-sdk as it is not installed.` That's expected and you can continue to the next step.

**2. Install the new package:**

```bash theme={null}
pip install claude-agent-sdk
```

**3. Update your imports:**

Change all imports from `claude_code_sdk` to `claude_agent_sdk`:

```python theme={null}
# Before
from claude_code_sdk import query, ClaudeCodeOptions

# After
from claude_agent_sdk import query, ClaudeAgentOptions
```

**4. Update type names:**

Change `ClaudeCodeOptions` to `ClaudeAgentOptions`:

```python theme={null}
# Before
from claude_code_sdk import query, ClaudeCodeOptions

options = ClaudeCodeOptions(model="claude-opus-4-7")
