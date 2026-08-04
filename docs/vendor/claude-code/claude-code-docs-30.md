---
name: claude-code-docs-30
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 30/66 (code.claude.com)"
type: reference
---

### Configure allowed tools

The `tools` option and the allowed/disallowed lists affect two layers: availability, which controls whether a tool appears in Claude's context, and permission, which controls whether a call is approved once Claude attempts it. `tools` and bare-name `disallowedTools` entries change availability. `allowedTools` and scoped `disallowedTools` rules change permission only.

| Option                    | Layer        | Effect                                                                                                                                                                                                          |
| :------------------------ | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools: ["Read", "Grep"]` | Availability | Only the listed built-ins are in Claude's context. Unlisted built-ins are removed. MCP tools are unaffected.                                                                                                    |
| `tools: []`               | Availability | All built-ins are removed. Claude can only use your MCP tools.                                                                                                                                                  |
| allowed tools             | Permission   | Listed tools run without a permission prompt. Unlisted tools remain available; calls go through the [permission flow](/docs/en/agent-sdk/permissions).                                                               |
| disallowed tools          | Both         | A bare tool name such as `"Bash"` removes the tool from Claude's context, the same as omitting it from `tools`. A scoped rule such as `"Bash(rm *)"` leaves the tool in context and denies only matching calls. |

To remove a built-in entirely, omit it from `tools` or list its bare name in `disallowedTools` (Python: `disallowed_tools`); both keep the tool out of context so Claude never attempts it. A scoped `disallowedTools` rule blocks matching calls but leaves the tool visible, so Claude may waste a turn trying it. See [Configure permissions](/docs/en/agent-sdk/permissions) for the full evaluation order.

## Handle errors

A handler error doesn't stop the agent loop. The SDK's in-process MCP server catches uncaught exceptions and returns them as error results, so how you report an error determines what Claude reads, not whether the query fails:

| What happens                                                                             | Result                                                                                                                                    |
| :--------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| Handler throws an uncaught exception                                                     | The MCP server converts it to an error result carrying the raw exception message. Claude sees that message, and the agent loop continues. |
| Handler catches the error and returns `isError: true` (TS) / `"is_error": True` (Python) | Claude sees the message you compose. You can add context the raw exception lacks, such as which request failed or what to try instead.    |

In both cases Claude can retry, try a different tool, or explain the failure. Catch errors yourself when the raw exception message isn't enough for Claude to act on.

The example below catches two kinds of failures inside the handler and composes the error message Claude reads. A non-200 HTTP status is caught from the response and returned as an error result. A network error or invalid JSON is caught by the surrounding `try/except` (Python) or `try/catch` (TypeScript) and also returned as an error result. In both cases Claude receives a message that describes the failure instead of a bare exception string.

<CodeGroup>
  ```python Python theme={null}
  import json
  import httpx
  from typing import Any
  from claude_agent_sdk import tool

  from claude_agent_sdk import tool


  @tool(
      "fetch_data",
      "Fetch data from an API",
      {"endpoint": str},  # Simple schema
  )
  async def fetch_data(args: dict[str, Any]) -> dict[str, Any]:
      try:
          async with httpx.AsyncClient() as client:
              response = await client.get(args["endpoint"])
              if response.status_code != 200:
                  # Return the failure as a tool result so Claude can react to it.
                  # is_error marks this as a failed call rather than odd-looking data.
                  return {
                      "content": [
                          {
                              "type": "text",
                              "text": f"API error: {response.status_code} {response.reason_phrase}",
                          }
                      ],
                      "is_error": True,
                  }

              data = response.json()
              return {"content": [{"type": "text", "text": json.dumps(data, indent=2)}]}
      except Exception as e:
          # Composes the message Claude reads. An uncaught exception would
          # reach Claude as the raw str(e) with no context.
          return {
              "content": [{"type": "text", "text": f"Failed to fetch data: {str(e)}"}],
              "is_error": True,
          }
  ```

  ```typescript TypeScript theme={null}
  import { tool } from "@anthropic-ai/claude-agent-sdk";
  import { z } from "zod";

  tool(
    "fetch_data",
    "Fetch data from an API",
    {
      endpoint: z.string().url().describe("API endpoint URL")
    },
    async (args) => {
      try {
        const response = await fetch(args.endpoint);

        if (!response.ok) {
          // Return the failure as a tool result so Claude can react to it.
          // isError marks this as a failed call rather than odd-looking data.
          return {
            content: [
              {
                type: "text",
                text: `API error: ${response.status} ${response.statusText}`
              }
            ],
            isError: true
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        // Composes the message Claude reads. An uncaught throw would
        // reach Claude as the raw error message with no context.
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
  ```
</CodeGroup>
