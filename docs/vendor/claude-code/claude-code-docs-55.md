---
name: claude-code-docs-55
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 55/66 (code.claude.com)"
type: reference
---

### stdio servers

Local processes that communicate via stdin/stdout. Use this for MCP servers you run on the same machine:

<Tabs>
  <Tab title="In code">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            filesystem: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
            }
          },
          allowedTools: ["mcp__filesystem__read_file", "mcp__filesystem__list_directory"]
        }
      };
      ```

      ```python Python theme={null}
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
          allowed_tools=["mcp__filesystem__read_file", "mcp__filesystem__list_directory"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
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
  </Tab>
</Tabs>

### HTTP/SSE servers

Use HTTP or SSE for cloud-hosted MCP servers and remote APIs:

<Tabs>
  <Tab title="In code">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            "remote-api": {
              type: "sse",
              url: "https://api.example.com/mcp/sse",
              headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`
              }
            }
          },
          allowedTools: ["mcp__remote-api__*"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "remote-api": {
                  "type": "sse",
                  "url": "https://api.example.com/mcp/sse",
                  "headers": {"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
              }
          },
          allowed_tools=["mcp__remote-api__*"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "remote-api": {
          "type": "sse",
          "url": "https://api.example.com/mcp/sse",
          "headers": {
            "Authorization": "Bearer ${API_TOKEN}"
          }
        }
      }
    }
    ```
  </Tab>
</Tabs>

For the streamable HTTP transport, use `"type": "http"` instead. In `.mcp.json` and other JSON config files, `"streamable-http"` is accepted as an alias for `"http"`. The programmatic `mcpServers` option accepts only `"http"`.

### SDK MCP servers

Define custom tools directly in your application code instead of running a separate server process. See the [custom tools guide](/docs/en/agent-sdk/custom-tools) for implementation details.

{/* min-version: 2.1.210 */}An SDK MCP server registered by an [`initialize` control request](/docs/en/agent-sdk/typescript#sdkcontrolinitializeresponse) begins connecting as soon as Claude Code processes the request.

## MCP tool search

When you have many MCP tools configured, tool definitions can consume a significant portion of your context window. Tool search solves this by withholding tool definitions from context and loading only the ones Claude needs for each turn.

Tool search is enabled by default. See [Tool search](/docs/en/agent-sdk/tool-search) for configuration options, best practices, and using tool search with custom SDK tools.

## Authentication

Most MCP servers require authentication to access external services. Pass credentials through environment variables in the server configuration.

### Pass credentials via environment variables

Use the `env` field to pass API keys, tokens, and other credentials to the MCP server:

<Tabs>
  <Tab title="In code">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            "api-server": {
              command: "npx",
              args: ["-y", "@your-org/api-mcp-server"],
              env: {
                API_KEY: process.env.API_KEY
              }
            }
          },
          allowedTools: ["mcp__api-server__*"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "api-server": {
                  "command": "npx",
                  "args": ["-y", "@your-org/api-mcp-server"],
                  "env": {"API_KEY": os.environ["API_KEY"]},
              }
          },
          allowed_tools=["mcp__api-server__*"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "api-server": {
          "command": "npx",
          "args": ["-y", "@your-org/api-mcp-server"],
          "env": {
            "API_KEY": "${API_KEY}"
          }
        }
      }
    }
    ```

    The `${API_KEY}` syntax expands environment variables at runtime.
  </Tab>
</Tabs>

### HTTP headers for remote servers

For HTTP and SSE servers, pass authentication headers directly in the server configuration:

<Tabs>
  <Tab title="In code">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            "secure-api": {
              type: "http",
              url: "https://api.example.com/mcp",
              headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`
              }
            }
          },
          allowedTools: ["mcp__secure-api__*"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "secure-api": {
                  "type": "http",
                  "url": "https://api.example.com/mcp",
                  "headers": {"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
              }
          },
          allowed_tools=["mcp__secure-api__*"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "secure-api": {
          "type": "http",
          "url": "https://api.example.com/mcp",
          "headers": {
            "Authorization": "Bearer ${API_TOKEN}"
          }
        }
      }
    }
    ```

    The `${API_TOKEN}` syntax expands environment variables at runtime.
  </Tab>
</Tabs>

For a complete working example of a remote server authenticated with headers, see [List issues from a repository](#list-issues-from-a-repository).
