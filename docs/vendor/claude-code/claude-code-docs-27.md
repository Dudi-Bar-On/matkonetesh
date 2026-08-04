---
name: claude-code-docs-27
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 27/66 (code.claude.com)"
type: reference
---

### Track cache tokens

The Agent SDK automatically uses [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) to reduce costs on repeated content. You do not need to configure caching yourself. The usage object includes two additional fields for cache tracking:

* `cache_creation_input_tokens`: tokens used to create new cache entries (charged at a higher rate than standard input tokens).
* `cache_read_input_tokens`: tokens read from existing cache entries (charged at a reduced rate).

Track these separately from `input_tokens` to understand caching savings. In TypeScript, these fields are typed on the [`Usage`](/docs/en/agent-sdk/typescript#usage) object. In Python, they appear as keys in the [`ResultMessage.usage`](/docs/en/agent-sdk/python#resultmessage) dict (for example, `message.usage.get("cache_read_input_tokens", 0)`).

### Extend the prompt cache TTL to one hour

Cache entries written by the SDK use a 5-minute TTL by default when you authenticate with an API key or run on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry. If your workload runs many short sessions against the same system prompt and context with gaps longer than 5 minutes between them, the cache expires between sessions and each new session pays full input price.

To request a 1-hour TTL on cache writes, set the [`ENABLE_PROMPT_CACHING_1H`](/docs/en/env-vars) environment variable. You can export it in your shell or container environment, or pass it through `options.env`.

The following example enables 1-hour TTL for an agent running on Amazon Bedrock. Because it sets `CLAUDE_CODE_USE_BEDROCK`, it requires working AWS credentials for [Amazon Bedrock](/docs/en/amazon-bedrock); without them the query fails.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import ClaudeAgentOptions, query
  import asyncio


  async def main():
      options = ClaudeAgentOptions(
          env={
              "CLAUDE_CODE_USE_BEDROCK": "1",
              "ENABLE_PROMPT_CACHING_1H": "1",
          },
      )

      async for message in query(prompt="Summarize this project", options=options):
          print(message)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const options = {
    env: {
      ...process.env,
      CLAUDE_CODE_USE_BEDROCK: "1",
      ENABLE_PROMPT_CACHING_1H: "1",
    },
  };

  for await (const message of query({ prompt: "Summarize this project", options })) {
    console.log(message);
  }
  ```
</CodeGroup>

Cache writes with a 1-hour TTL are billed at a higher rate than 5-minute writes, so enabling this trades higher write cost for more cache reads. See [prompt caching pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) for details. Claude subscription users already receive 1-hour TTL automatically and do not need to set this variable.

## Related documentation

* [TypeScript SDK Reference](/docs/en/agent-sdk/typescript) - Complete API documentation
* [SDK Overview](/docs/en/agent-sdk/overview) - Getting started with the SDK
* [SDK Permissions](/docs/en/agent-sdk/permissions) - Managing tool permissions


<!-- source: https://code.claude.com/docs/en/agent-sdk/custom-tools.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Give Claude custom tools

> Define custom tools with the Claude Agent SDK's in-process MCP server so Claude can call your functions, hit your APIs, and perform domain-specific operations.

Custom tools extend the Agent SDK by letting you define your own functions that Claude can call during a conversation. Using the SDK's in-process MCP server, you can give Claude access to databases, external APIs, domain-specific logic, or any other capability your application needs.

This guide covers how to define tools with input schemas and handlers, bundle them into an MCP server, pass them to `query`, and control which tools Claude can access. It also covers error handling, tool annotations, and returning non-text content like images.

## Quick reference

| If you want to...                            | Do this                                                                                                                                                                                                       |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Define a tool                                | Use [`@tool`](/docs/en/agent-sdk/python#tool) (Python) or [`tool()`](/docs/en/agent-sdk/typescript#tool) (TypeScript) with a name, description, schema, and handler. See [Create a custom tool](#create-a-custom-tool). |
| Register a tool with Claude                  | Wrap in `create_sdk_mcp_server` / `createSdkMcpServer` and pass to `mcpServers` in `query()`. See [Call a custom tool](#call-a-custom-tool).                                                                  |
| Pre-approve a tool                           | Add to your allowed tools. See [Configure allowed tools](#configure-allowed-tools).                                                                                                                           |
| Remove a built-in tool from Claude's context | Pass a `tools` array listing only the built-ins you want. See [Configure allowed tools](#configure-allowed-tools).                                                                                            |
| Let Claude call tools in parallel            | Set `readOnlyHint: true` on tools with no side effects. See [Add tool annotations](#add-tool-annotations).                                                                                                    |
| Control the error message Claude reads       | Return `isError: true` to compose the message instead of surfacing the raw exception. See [Handle errors](#handle-errors).                                                                                    |
| Return images or files                       | Use `image` or `resource` blocks in the content array. See [Return images and resources](#return-images-and-resources).                                                                                       |
| Return a machine-readable JSON result        | Set `structuredContent` on the result. See [Return structured data](#return-structured-data).                                                                                                                 |
| Scale to many tools                          | Use [tool search](/docs/en/agent-sdk/tool-search) to load tools on demand.                                                                                                                                         |
