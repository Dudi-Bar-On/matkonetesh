---
name: claude-code-docs-25
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 25/66 (code.claude.com)"
type: reference
---

## Understand token usage

The TypeScript and Python SDKs expose the same usage data with different field names:

* **TypeScript** provides per-step token breakdowns on each assistant message (`message.message.id`, `message.message.usage`), per-model cost via `modelUsage` on the result message, and a cumulative total on the result message.
* **Python** provides per-step token breakdowns on each assistant message (`message.usage`, `message.message_id`), per-model cost via `model_usage` on the result message, and the accumulated total on the result message (`total_cost_usd` and `usage` dict).

Both SDKs use the same underlying cost model and expose the same granularity. The difference is in field naming and where per-step usage is nested.

Cost tracking depends on understanding how the SDK scopes usage data:

* **`query()` call:** one invocation of the SDK's `query()` function. A single call can involve multiple steps (Claude responds, uses tools, gets results, responds again). Each call produces one [`result`](/docs/en/agent-sdk/typescript#sdkresultmessage) message at the end.
* **Step:** a single request/response cycle within a `query()` call. Each step produces assistant messages with token usage.
* **Session:** a series of `query()` calls linked by a session ID (using the `resume` option). Each `query()` call within a session reports its own cost independently.

The following diagram shows the message stream from a single `query()` call, with token usage reported at each step and the cumulative estimate at the end:

<img src="https://mintcdn.com/claude-code/ikqp3_70mqIahteV/images/agent-sdk/message-usage-flow.svg?fit=max&auto=format&n=ikqp3_70mqIahteV&q=85&s=68497aee338e01cc745323af7aea378e" className="dark:hidden" alt="Diagram showing a query producing two steps of messages. Step 1 has four assistant messages sharing the same ID and usage (count once), Step 2 has one assistant message with a new ID, and the final result message shows the estimated total_cost_usd." width="760" height="520" data-path="images/agent-sdk/message-usage-flow.svg" />

<img src="https://mintcdn.com/claude-code/_xqph1dUOslCOwsj/images/agent-sdk/message-usage-flow-dark.svg?fit=max&auto=format&n=_xqph1dUOslCOwsj&q=85&s=8ea95085abc0a6b7f55ecef498bd4d14" className="hidden dark:block" alt="Diagram showing a query producing two steps of messages. Step 1 has four assistant messages sharing the same ID and usage (count once), Step 2 has one assistant message with a new ID, and the final result message shows the estimated total_cost_usd." width="760" height="520" data-path="images/agent-sdk/message-usage-flow-dark.svg" />

<Steps>
  <Step title="Each step produces assistant messages">
    When Claude responds, it sends one or more assistant messages. In TypeScript, each assistant message contains a nested `BetaMessage` (accessed via `message.message`) with an `id` and a [`usage`](https://platform.claude.com/docs/en/api/messages) object with token counts (`input_tokens`, `output_tokens`). In Python, the `AssistantMessage` dataclass exposes the same data directly via `message.usage` and `message.message_id`. When Claude uses multiple tools in one turn, all messages in that turn share the same ID, so deduplicate by ID to avoid double-counting.
  </Step>

  <Step title="The result message provides the cumulative estimate">
    When the `query()` call completes, the SDK emits a result message with `total_cost_usd` and cumulative `usage`. This is available in both TypeScript ([`SDKResultMessage`](/docs/en/agent-sdk/typescript#sdkresultmessage)) and Python ([`ResultMessage`](/docs/en/agent-sdk/python#resultmessage)). If you make multiple `query()` calls (for example, in a multi-turn session), each result only reflects the cost of that individual call. If you only need the estimated total, you can ignore the per-step usage and read this single value.
  </Step>
</Steps>

## Get the total cost of a query

The result message ([TypeScript](/docs/en/agent-sdk/typescript#sdkresultmessage), [Python](/docs/en/agent-sdk/python#resultmessage)) marks the end of the agent loop for a `query()` call. It includes `total_cost_usd`, the cumulative estimated cost across all steps in that call. This works for both success and error results. If you use sessions to make multiple `query()` calls, each result only reflects the cost of that individual call.

The three result-level fields differ in what they count when the agent spawns [subagents](/docs/en/agent-sdk/subagents). Use `modelUsage`, or `model_usage` in Python, for whole-tree token accounting; the `usage` field undercounts as soon as nesting occurs.

| Field                        | Subagent activity                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `usage`                      | Excluded. Counts only the top-level agent loop, so tokens consumed inside subagents are not added |
| `total_cost_usd`             | Included. Counts subagent requests alongside the top-level loop                                   |
| `modelUsage` / `model_usage` | Included. Counts subagent requests alongside the top-level loop, broken down by model             |

The following examples iterate over the message stream from a `query()` call and print the total cost when the `result` message arrives:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  try {
    for await (const message of query({ prompt: "Summarize this project" })) {
      if (message.type === "result") {
        console.log(`Total cost: $${message.total_cost_usd}`);
      }
    }
  } catch (error) {
    // A single-shot query() throws after yielding an error result. If the
    // failure was an error result, it still carried total_cost_usd and the
    // branch above has already run; connection or process failures yield
    // no result message.
    console.error(`Session ended with an error: ${error}`);
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ResultMessage
  import asyncio


  async def main():
      try:
          async for message in query(prompt="Summarize this project"):
              if isinstance(message, ResultMessage):
                  print(f"Total cost: ${message.total_cost_usd or 0}")
      except Exception as error:
          # A single-shot query() raises after yielding an error result. If the
          # failure was an error result, it still carried total_cost_usd and the
          # branch above has already run; connection or process failures yield
          # no result message.
          print(f"Session ended with an error: {error}")


  asyncio.run(main())
  ```
</CodeGroup>

## Track per-step and per-model usage

The examples in this section use TypeScript field names. In Python, the equivalent fields are [`AssistantMessage.usage`](/docs/en/agent-sdk/python#assistantmessage) and `AssistantMessage.message_id` for per-step usage, and [`ResultMessage.model_usage`](/docs/en/agent-sdk/python#resultmessage) for per-model breakdowns.
