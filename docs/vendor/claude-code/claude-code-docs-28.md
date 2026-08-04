---
name: claude-code-docs-28
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 28/66 (code.claude.com)"
type: reference
---

## Create a custom tool

A tool is defined by four parts, passed as arguments to the [`tool()`](/docs/en/agent-sdk/typescript#tool) helper in TypeScript or the [`@tool`](/docs/en/agent-sdk/python#tool) decorator in Python:

* **Name:** a unique identifier Claude uses to call the tool.
* **Description:** what the tool does. Claude reads this to decide when to call it.
* **Input schema:** the arguments Claude must provide. In TypeScript this is always a [Zod schema](https://zod.dev/), and the handler's `args` are typed from it automatically. In Python this is a dict mapping names to types, like `{"latitude": float}`, which the SDK converts to JSON Schema for you. The Python decorator also accepts a full [JSON Schema](https://json-schema.org/understanding-json-schema/about) dict directly when you need enums, ranges, optional fields, or nested objects.
* **Handler:** the async function that runs when Claude calls the tool. It receives the validated arguments and must return an object with:
  * `content` (required): an array of result blocks, each with a `type` of `"text"`, `"image"`, `"audio"`, `"resource"`, or `"resource_link"`. See [Return images and resources](#return-images-and-resources) for non-text blocks.
  * `structuredContent` (optional): a JSON object holding the result as machine-readable data, returned alongside `content`. See [Return structured data](#return-structured-data).
  * `isError` (optional): set to `true` to signal a tool failure so Claude can react to it. See [Handle errors](#handle-errors).

After defining a tool, wrap it in a server with [`createSdkMcpServer`](/docs/en/agent-sdk/typescript#createsdkmcpserver) (TypeScript) or [`create_sdk_mcp_server`](/docs/en/agent-sdk/python#create_sdk_mcp_server) (Python). The server runs in-process inside your application, not as a separate process.

### Weather tool example

This example defines a `get_temperature` tool and wraps it in an MCP server. It only sets up the tool; to pass it to `query` and run it, see [Call a custom tool](#call-a-custom-tool) below.

<CodeGroup>
  ```python Python theme={null}
  from typing import Any
  import httpx
  from claude_agent_sdk import tool, create_sdk_mcp_server


  # Define a tool: name, description, input schema, handler
  @tool(
      "get_temperature",
      "Get the current temperature at a location",
      {"latitude": float, "longitude": float},
  )
  async def get_temperature(args: dict[str, Any]) -> dict[str, Any]:
      async with httpx.AsyncClient() as client:
          response = await client.get(
              "https://api.open-meteo.com/v1/forecast",
              params={
                  "latitude": args["latitude"],
                  "longitude": args["longitude"],
                  "current": "temperature_2m",
                  "temperature_unit": "fahrenheit",
              },
          )
          data = response.json()

      # Return a content array - Claude sees this as the tool result
      return {
          "content": [
              {
                  "type": "text",
                  "text": f"Temperature: {data['current']['temperature_2m']}°F",
              }
          ]
      }


  # Wrap the tool in an in-process MCP server
  weather_server = create_sdk_mcp_server(
      name="weather",
      version="1.0.0",
      tools=[get_temperature],
  )
  ```

  ```typescript TypeScript theme={null}
  import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
  import { z } from "zod";

  // Define a tool: name, description, input schema, handler
  const getTemperature = tool(
    "get_temperature",
    "Get the current temperature at a location",
    {
      latitude: z.number().describe("Latitude coordinate"), // .describe() adds a field description Claude sees
      longitude: z.number().describe("Longitude coordinate")
    },
    async (args) => {
      // args is typed from the schema: { latitude: number; longitude: number }
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=temperature_2m&temperature_unit=fahrenheit`
      );
      const data: any = await response.json();

      // Return a content array - Claude sees this as the tool result
      return {
        content: [{ type: "text", text: `Temperature: ${data.current.temperature_2m}°F` }]
      };
    }
  );

  // Wrap the tool in an in-process MCP server
  const weatherServer = createSdkMcpServer({
    name: "weather",
    version: "1.0.0",
    tools: [getTemperature]
  });
  ```
</CodeGroup>

See the [`tool()`](/docs/en/agent-sdk/typescript#tool) TypeScript reference or the [`@tool`](/docs/en/agent-sdk/python#tool) Python reference for full parameter details, including JSON Schema input formats and return value structure.

<Tip>
  To make a parameter optional: in TypeScript, add `.default()` to the Zod field. In Python, the dict schema treats every key as required, so leave the parameter out of the schema, mention it in the description string, and read it with `args.get()` in the handler. The [`get_precipitation_chance` tool below](#add-more-tools) shows both patterns.
</Tip>

### Call a custom tool

Pass the MCP server you created to `query` via the `mcpServers` option. The key in `mcpServers` becomes the `{server_name}` segment in each tool's fully qualified name: `mcp__{server_name}__{tool_name}`. List that name in `allowedTools` so the tool runs without a permission prompt.

These snippets reuse the `weatherServer` from the [example above](#weather-tool-example) to ask Claude what the weather is in a specific location.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={"weather": weather_server},
          allowed_tools=["mcp__weather__get_temperature"],
      )

      async for message in query(
          prompt="What's the temperature in San Francisco?",
          options=options,
      ):
          # ResultMessage is the final message after all tool calls complete
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "What's the temperature in San Francisco?",
    options: {
      mcpServers: { weather: weatherServer },
      allowedTools: ["mcp__weather__get_temperature"]
    }
  })) {
    // "result" is the final message after all tool calls complete
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

Combine this snippet with the tool and server definitions from the [weather tool example](#weather-tool-example) in one file, then run it with `python weather.py` for Python or `npx tsx weather.ts` for TypeScript. Claude calls `get_temperature` and the script prints a one-line answer with the current temperature in San Francisco.
