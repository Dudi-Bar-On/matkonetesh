---
name: claude-code-docs-29
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 29/66 (code.claude.com)"
type: reference
---

### Add more tools

A server holds as many tools as you list in its `tools` array. With more than one tool on a server, you can list each one in `allowedTools` individually or use the wildcard `mcp__weather__*` to cover every tool the server exposes.

The example below defines a second tool, `get_precipitation_chance`, and replaces the `weatherServer` definition from the [weather tool example](#weather-tool-example) with one that lists both tools in the array.

<CodeGroup>
  ```python Python theme={null}
  # Define a second tool for the same server
  @tool(
      "get_precipitation_chance",
      "Get the hourly precipitation probability for a location. "
      "Optionally pass 'hours' (1-24) to control how many hours to return.",
      {"latitude": float, "longitude": float},
  )
  async def get_precipitation_chance(args: dict[str, Any]) -> dict[str, Any]:
      # 'hours' isn't in the schema - read it with .get() to make it optional
      hours = args.get("hours", 12)
      async with httpx.AsyncClient() as client:
          response = await client.get(
              "https://api.open-meteo.com/v1/forecast",
              params={
                  "latitude": args["latitude"],
                  "longitude": args["longitude"],
                  "hourly": "precipitation_probability",
                  "forecast_days": 1,
              },
          )
          data = response.json()
      chances = data["hourly"]["precipitation_probability"][:hours]

      return {
          "content": [
              {
                  "type": "text",
                  "text": f"Next {hours} hours: {'%, '.join(map(str, chances))}%",
              }
          ]
      }


  # Rebuild the server with both tools in the array
  weather_server = create_sdk_mcp_server(
      name="weather",
      version="1.0.0",
      tools=[get_temperature, get_precipitation_chance],
  )
  ```

  ```typescript TypeScript theme={null}
  // Define a second tool for the same server
  const getPrecipitationChance = tool(
    "get_precipitation_chance",
    "Get the hourly precipitation probability for a location",
    {
      latitude: z.number(),
      longitude: z.number(),
      hours: z
        .number()
        .int()
        .min(1)
        .max(24)
        .default(12) // .default() makes the parameter optional
        .describe("How many hours of forecast to return")
    },
    async (args) => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&hourly=precipitation_probability&forecast_days=1`
      );
      const data: any = await response.json();
      const chances = data.hourly.precipitation_probability.slice(0, args.hours);

      return {
        content: [{ type: "text", text: `Next ${args.hours} hours: ${chances.join("%, ")}%` }]
      };
    }
  );

  // Rebuild the server with both tools in the array
  const weatherServer = createSdkMcpServer({
    name: "weather",
    version: "1.0.0",
    tools: [getTemperature, getPrecipitationChance]
  });
  ```
</CodeGroup>

[Tool search](/docs/en/agent-sdk/tool-search) is on by default and defers SDK MCP tools: Claude sees each tool's name in a compact list and loads its full schema on demand. With tool search disabled, every tool in this array consumes context window space on every turn. In TypeScript, pass `alwaysLoad: true` in the `extras` argument of [`tool()`](/docs/en/agent-sdk/typescript#tool) or in the options of [`createSdkMcpServer()`](/docs/en/agent-sdk/typescript#createsdkmcpserver) to keep a tool's full schema in the initial prompt.

### Add tool annotations

[Tool annotations](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations) are optional metadata describing how a tool behaves. Pass them as the fifth argument to `tool()` helper in TypeScript or via the `annotations` keyword argument for the `@tool` decorator in Python. All hint fields are Booleans.

| Field             | Default | Meaning                                                                                                               |
| :---------------- | :------ | :-------------------------------------------------------------------------------------------------------------------- |
| `readOnlyHint`    | `false` | Tool does not modify its environment. Controls whether the tool can be called in parallel with other read-only tools. |
| `destructiveHint` | `true`  | Tool may perform destructive updates. Informational only.                                                             |
| `idempotentHint`  | `false` | Repeated calls with the same arguments have no additional effect. Informational only.                                 |
| `openWorldHint`   | `true`  | Tool reaches systems outside your process. Informational only.                                                        |

Annotations are metadata, not enforcement. A tool marked `readOnlyHint: true` can still write to disk if that's what the handler does. Keep the annotation accurate to the handler.

This example adds `readOnlyHint` to the `get_temperature` tool from the [weather tool example](#weather-tool-example).

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import tool, ToolAnnotations


  @tool(
      "get_temperature",
      "Get the current temperature at a location",
      {"latitude": float, "longitude": float},
      annotations=ToolAnnotations(
          readOnlyHint=True
      ),  # Lets Claude batch this with other read-only calls
  )
  async def get_temperature(args):
      return {"content": [{"type": "text", "text": "..."}]}
  ```

  ```typescript TypeScript theme={null}
  import { tool } from "@anthropic-ai/claude-agent-sdk";
  import { z } from "zod";

  tool(
    "get_temperature",
    "Get the current temperature at a location",
    { latitude: z.number(), longitude: z.number() },
    async (args) => ({ content: [{ type: "text", text: `...` }] }),
    { annotations: { readOnlyHint: true } } // Lets Claude batch this with other read-only calls
  );
  ```
</CodeGroup>

See `ToolAnnotations` in the [TypeScript](/docs/en/agent-sdk/typescript#toolannotations) or [Python](/docs/en/agent-sdk/python#toolannotations) reference.

## Control tool access

The [weather tool example](#weather-tool-example) registered a server and listed tools in `allowedTools`. This section covers how tool names are constructed and how to scope access when you have multiple tools or want to restrict built-ins.

### Tool name format

When MCP tools are exposed to Claude, their names follow a specific format:

* Pattern: `mcp__{server_name}__{tool_name}`
* Example: A tool named `get_temperature` in server `weather` becomes `mcp__weather__get_temperature`
