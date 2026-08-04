---
name: claude-code-docs-31
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 31/66 (code.claude.com)"
type: reference
---

## Return images and resources

The `content` array in a tool result accepts `text`, `image`, `audio`, `resource`, and `resource_link` blocks. You can mix them in the same response. In TypeScript, the SDK saves audio blocks to disk and Claude receives a text block with the saved file path; in Python, the SDK drops audio blocks from the tool result and logs a warning. The SDK converts resource link blocks to a text block containing the link's name, URI, and description.

### Images

An image block carries the image bytes inline, encoded as base64. There is no URL field. To return an image that lives at a URL, fetch it in the handler, read the response bytes, and base64-encode them before returning. The result is processed as visual input.

| Field      | Type      | Notes                                                                      |
| :--------- | :-------- | :------------------------------------------------------------------------- |
| `type`     | `"image"` |                                                                            |
| `data`     | `string`  | Base64-encoded bytes. Raw base64 only, no `data:image/...;base64,` prefix  |
| `mimeType` | `string`  | Required. For example `image/png`, `image/jpeg`, `image/webp`, `image/gif` |

<CodeGroup>
  ```python Python theme={null}
  import base64
  import httpx
  from claude_agent_sdk import tool

  from claude_agent_sdk import tool


  # Define a tool that fetches an image from a URL and returns it to Claude
  @tool("fetch_image", "Fetch an image from a URL and return it to Claude", {"url": str})
  async def fetch_image(args):
      async with httpx.AsyncClient() as client:  # Fetch the image bytes
          response = await client.get(args["url"])

      return {
          "content": [
              {
                  "type": "image",
                  "data": base64.b64encode(response.content).decode(
                      "ascii"
                  ),  # Base64-encode the raw bytes
                  "mimeType": response.headers.get(
                      "content-type", "image/png"
                  ),  # Read MIME type from the response
              }
          ]
      }
  ```

  ```typescript TypeScript theme={null}
  import { tool } from "@anthropic-ai/claude-agent-sdk";
  import { z } from "zod";

  tool(
    "fetch_image",
    "Fetch an image from a URL and return it to Claude",
    {
      url: z.string().url()
    },
    async (args) => {
      const response = await fetch(args.url); // Fetch the image bytes
      const buffer = Buffer.from(await response.arrayBuffer()); // Read into a Buffer for base64 encoding
      const mimeType = response.headers.get("content-type") ?? "image/png";

      return {
        content: [
          {
            type: "image",
            data: buffer.toString("base64"), // Base64-encode the raw bytes
            mimeType
          }
        ]
      };
    }
  );
  ```
</CodeGroup>

### Resources

A resource block embeds a piece of content identified by a URI. The URI is a label for Claude to reference; the actual content rides in the block's `text` or `blob` field. Use this when your tool produces something that makes sense to address by name later, such as a generated file or a record from an external system.

| Field               | Type         | Notes                                                                                                                                      |
| :------------------ | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `type`              | `"resource"` |                                                                                                                                            |
| `resource.uri`      | `string`     | Identifier for the content. Any URI scheme                                                                                                 |
| `resource.text`     | `string`     | The content, if it's text. Provide this or `blob`, not both                                                                                |
| `resource.blob`     | `string`     | The content base64-encoded, if it's binary. TypeScript only: the Python SDK drops binary resources from the tool result and logs a warning |
| `resource.mimeType` | `string`     | Optional                                                                                                                                   |

This example shows a resource block returned from inside a tool handler. The URI `file:///tmp/report.md` is a label that Claude can reference later; the SDK does not read from that path.

<CodeGroup>
  ```typescript TypeScript theme={null}
  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: "file:///tmp/report.md", // Label for Claude to reference, not a path the SDK reads
          mimeType: "text/markdown",
          text: "# Report\n..." // The actual content, inline
        }
      }
    ]
  };
  ```

  ```python Python theme={null}
  return {
      "content": [
          {
              "type": "resource",
              "resource": {
                  "uri": "file:///tmp/report.md",  # Label for Claude to reference, not a path the SDK reads
                  "mimeType": "text/markdown",
                  "text": "# Report\n...",  # The actual content, inline
              },
          }
      ]
  }
  ```
</CodeGroup>

These block shapes come from the MCP `CallToolResult` type. See the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result) for the full definition.

## Return structured data

`structuredContent` is an optional JSON object on the result, separate from the `content` array. Use it to return raw values that Claude can read as exact fields instead of parsing them out of a text string or image.

When `structuredContent` is set, Claude receives the JSON plus any image or resource blocks from `content`. Text blocks in `content` are not forwarded, since they are assumed to duplicate the structured data. The example below renders a chart as an image block and returns the data points behind it in `structuredContent` from the same handler. In the snippet, `chartPngBuffer` is a `Buffer` holding the rendered PNG bytes.

```typescript TypeScript theme={null}
return {
  content: [
    {
      type: "image",
      data: chartPngBuffer.toString("base64"),
      mimeType: "image/png"
    }
  ],
  structuredContent: {
    series: "temperature_2m",
    unit: "fahrenheit",
    points: [62.1, 63.4, 65.0, 64.2]
  }
};
```

<Note>
  The Python `@tool` decorator forwards only `content` and `is_error` from the handler's return dict. To return `structuredContent` from Python, run a [standalone MCP server](/docs/en/agent-sdk/mcp) instead of an in-process SDK server.
</Note>
