---
name: claude-code-docs-13
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 13/66 (code.claude.com)"
type: reference
---

## The loop at a glance

Every agent session follows the same cycle:

<img src="https://mintcdn.com/claude-code/ikqp3_70mqIahteV/images/agent-loop-diagram.svg?fit=max&auto=format&n=ikqp3_70mqIahteV&q=85&s=1c6e8f28d80dba14a7287419656f1237" className="dark:hidden" alt="Diagram of the agent loop: your prompt enters the agentic loop, where Claude evaluates and either requests tool calls, whose results feed back into another evaluation, or returns the final answer" width="720" height="212" data-path="images/agent-loop-diagram.svg" />

<img src="https://mintcdn.com/claude-code/_xqph1dUOslCOwsj/images/agent-loop-diagram-dark.svg?fit=max&auto=format&n=_xqph1dUOslCOwsj&q=85&s=afe723c52a324d3c61fa72fb02432ab6" className="hidden dark:block" alt="Diagram of the agent loop: your prompt enters the agentic loop, where Claude evaluates and either requests tool calls, whose results feed back into another evaluation, or returns the final answer" width="720" height="212" data-path="images/agent-loop-diagram-dark.svg" />

1. **Receive prompt.** Claude receives your prompt, along with the system prompt, tool definitions, and conversation history. The SDK yields a [`SystemMessage`](#message-types) with subtype `"init"` containing session metadata.
2. **Evaluate and respond.** Claude evaluates the current state and determines how to proceed. It may respond with text, request one or more tool calls, or both. The SDK yields an [`AssistantMessage`](#message-types) containing the text and any tool call requests.
3. **Execute tools.** The SDK runs each requested tool and collects the results. Each set of tool results feeds back to Claude for the next decision. You can use [hooks](/docs/en/agent-sdk/hooks) to intercept, modify, or block tool calls before they run.
4. **Repeat.** Steps 2 and 3 repeat as a cycle. Each full cycle is one turn. Claude continues calling tools and processing results until it produces a response with no tool calls.
5. **Return result.** The SDK yields a final [`AssistantMessage`](#message-types) with the text response (no tool calls), followed by a [`ResultMessage`](#message-types) with the final text, token usage, cost, and session ID.

A quick question ("what files are here?") might take one or two turns of calling `Glob` and responding with the results. A complex task ("refactor the auth module and update the tests") can chain dozens of tool calls across many turns, reading files, editing code, and running tests, with Claude adjusting its approach based on each result.

## Turns and messages

A turn is one round trip inside the loop: Claude produces output that includes tool calls, the SDK executes those tools, and the results feed back to Claude automatically. This happens without yielding control back to your code. Turns continue until Claude produces output with no tool calls, at which point the loop ends and the final result is delivered.

Consider what a full session might look like for the prompt "Fix the failing tests in auth.ts".

First, the SDK sends your prompt to Claude and yields a [`SystemMessage`](#message-types) with the session metadata. Then the loop begins:

1. **Turn 1:** Claude calls `Bash` to run `npm test`. The SDK yields an [`AssistantMessage`](#message-types) with the tool call, executes the command, then yields a [`UserMessage`](#message-types) with the output (three failures).
2. **Turn 2:** Claude calls `Read` on `auth.ts` and `auth.test.ts`. The SDK returns the file contents and yields an `AssistantMessage`.
3. **Turn 3:** Claude calls `Edit` to fix `auth.ts`, then calls `Bash` to re-run `npm test`. All three tests pass. The SDK yields an `AssistantMessage`.
4. **Final turn:** Claude produces a text-only response with no tool calls: "Fixed the auth bug, all three tests pass now." The SDK yields a final `AssistantMessage` with this text, then a [`ResultMessage`](#message-types) with the same text plus cost and usage.

That was four turns: three with tool calls, one final text-only response.

You can cap the loop with `max_turns` / `maxTurns`, which counts tool-use turns only. For example, `max_turns=2` in the loop above would have stopped before the edit step. You can also use `max_budget_usd` / `maxBudgetUsd` to cap turns based on a spend threshold.

Without limits, the loop runs until Claude finishes on its own, which is fine for well-scoped tasks but can run long on open-ended prompts ("improve this codebase"). Setting a budget is a good default for production agents. See [Turns and budget](#turns-and-budget) below for the option reference.

## Message types

As the loop runs, the SDK yields a stream of messages. Each message carries a type that tells you what stage of the loop it came from. The five core types are:

* **`SystemMessage`:** session lifecycle events. The `subtype` field distinguishes them:

  * `"init"`: session metadata for the run. When a `SessionStart` or `Setup` hook runs during session startup, its [hook lifecycle messages](/docs/en/agent-sdk/typescript#sdkhookstartedmessage) arrive before the `init` message
  * `"compact_boundary"`: fires after [compaction](#automatic-compaction)
  * `"informational"`: plain-text status banners from the loop
  * `"worker_shutting_down"`: the loop will end after the current turn because the host is exiting or Remote Control disconnected

  In TypeScript, each subtype other than `"init"` is its own type in the [`SDKMessage` union](/docs/en/agent-sdk/typescript#sdkmessage) rather than a subtype of `SDKSystemMessage`.
* **`AssistantMessage`:** emitted after each Claude response, including the final text-only one. Contains text content blocks and tool call blocks from that turn.
* **`UserMessage`:** emitted after each tool execution with the tool result content sent back to Claude. Also emitted for any user inputs you stream mid-loop.
* **`StreamEvent`:** only emitted when partial messages are enabled. Contains raw API streaming events (text deltas, tool input chunks). See [Stream responses](/docs/en/agent-sdk/streaming-output).
* **`ResultMessage`:** marks the end of the agent loop. Contains the final text result, token usage, cost, and session ID. Check the `subtype` field to determine whether the task succeeded or hit a limit. A small number of trailing system events, such as `prompt_suggestion`, can arrive after it, so iterate the stream to completion rather than breaking on the result. See [Handle the result](#handle-the-result).

These five types cover the full agent loop lifecycle. Both SDKs also yield observability events such as rate-limit status and task notifications that are not required to drive the loop. See the [Python message types reference](/docs/en/agent-sdk/python#message-types) and [TypeScript message types reference](/docs/en/agent-sdk/typescript#message-types) for the complete lists.
