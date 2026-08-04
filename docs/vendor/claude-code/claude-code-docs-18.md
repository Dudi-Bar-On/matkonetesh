---
name: claude-code-docs-18
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 18/66 (code.claude.com)"
type: reference
---

### Keep context efficient

A few strategies for long-running agents:

* **Use subagents for subtasks.** Each subagent starts with a fresh conversation (no prior message history, though it does load its own system prompt and project-level context like CLAUDE.md). It does not see the parent's turns, and only its final response returns to the parent as a tool result. The main agent's context grows by that summary, not by the full subtask transcript. See [What subagents inherit](/docs/en/agent-sdk/subagents#what-subagents-inherit) for details.
* **Be selective with tools.** Every tool definition takes context space. Use the `tools` field on [`AgentDefinition`](/docs/en/agent-sdk/subagents#agentdefinition-configuration) to scope subagents to the minimum set they need.
* **Watch MCP server costs.** [MCP tool search](/docs/en/agent-sdk/mcp#mcp-tool-search) defers MCP tool schemas by default and loads them on demand. When tool search is off or has fallen back to upfront loading, each MCP server adds all its tool schemas to every request, so a few servers with many tools can consume significant context before the agent does any work. The fallback applies on Google Cloud's Agent Platform, behind a non-first-party `ANTHROPIC_BASE_URL`, and on a Microsoft Foundry deployment hosted on Azure.
* **Use lower effort for routine tasks.** Set [effort](#effort-level) to `"low"` for agents that only need to read files or list directories. This reduces token usage and cost.

For a detailed breakdown of per-feature context costs, see [Understand context costs](/docs/en/features-overview#understand-context-costs).

## Sessions and continuity

Each interaction with the SDK creates or continues a session. Capture the session ID from `ResultMessage.session_id` (available in both SDKs) to resume later. The TypeScript SDK also exposes it as a direct field on the init `SystemMessage`; in Python it's nested in `SystemMessage.data`.

When you resume, the full context from previous turns is restored: files that were read, analysis that was performed, and actions that were taken. You can also fork a session to branch into a different approach without modifying the original.

See [Session management](/docs/en/agent-sdk/sessions) for the full guide on resume, continue, and fork patterns. To resume sessions across stateless containers or serverless hosts, pass a [`session_store` / `sessionStore` adapter](/docs/en/agent-sdk/session-storage) so transcripts are mirrored to your own backend and any host can resume them. The Claude Code subprocess still writes to local disk first; point `CLAUDE_CONFIG_DIR` at a temp directory in `options.env` if the local copy needs to be ephemeral.

<Note>
  In Python, `ClaudeSDKClient` handles session IDs automatically across multiple calls. See the [Python SDK reference](/docs/en/agent-sdk/python#choosing-between-query-and-claudesdkclient) for details.
</Note>

## Handle the result

When the loop ends, the `ResultMessage` tells you what happened and gives you the output. The `subtype` field (available in both SDKs) is the primary way to check termination state.

| Result subtype                        | What happened                                                                                                                                                                           | `result` field available? |
| :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------: |
| `success`                             | Claude finished the task normally                                                                                                                                                       |            Yes            |
| `error_max_turns`                     | Hit the `maxTurns` limit before finishing                                                                                                                                               |             No            |
| `error_max_budget_usd`                | Hit the `maxBudgetUsd` limit before finishing                                                                                                                                           |             No            |
| `error_during_execution`              | An error interrupted the loop (for example, an API failure or cancelled request)                                                                                                        |             No            |
| `error_max_structured_output_retries` | No valid structured output was produced within the configured retry limit: every attempt failed validation, or a model fallback retracted the completed output with no successful retry |             No            |

The `result` field (the final text output) is only present on the `success` variant, so always check the subtype before reading it. All result subtypes carry `total_cost_usd`, `usage`, `num_turns`, and `session_id` so you can track cost and resume even after errors. In Python, `total_cost_usd` and `usage` are typed as optional and may be `None` on some error paths, so guard before formatting them. See [Tracking costs and usage](/docs/en/agent-sdk/cost-tracking) for details on interpreting the `usage` fields.

<Note>
  When a query ends on an error result:

  * A single-shot `query()` call yields the final result message, then raises an error that includes the failure text, such as `Reached maximum number of turns`. The raise is intentional — wrap the loop in a try block if your code needs to continue past it. The underlying Claude Code process also exits with a nonzero code.
  * A streaming input session stays alive, and you can keep sending messages.
</Note>

The result also includes a `stop_reason` field (`string | null` in TypeScript, `str | None` in Python) indicating why the model stopped generating on its final turn. Common values are `end_turn` (model finished normally), `max_tokens` (hit the output token limit), and `refusal` (the model declined the request). On error result subtypes, `stop_reason` carries the value from the last assistant response before the loop ended. To detect refusals, check `stop_reason === "refusal"` (TypeScript) or `stop_reason == "refusal"` (Python). See [`SDKResultMessage`](/docs/en/agent-sdk/typescript#sdkresultmessage) (TypeScript) or [`ResultMessage`](/docs/en/agent-sdk/python#resultmessage) (Python) for the full type.
