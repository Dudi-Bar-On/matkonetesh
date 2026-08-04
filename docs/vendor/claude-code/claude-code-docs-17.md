---
name: claude-code-docs-17
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 17/66 (code.claude.com)"
type: reference
---

## The context window

The context window is the total amount of information available to Claude during a session. It does not reset between turns within a session. Everything accumulates: the system prompt, tool definitions, conversation history, tool inputs, and tool outputs. Content that stays the same across turns (system prompt, tool definitions, CLAUDE.md) is automatically [prompt cached](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), which reduces cost and latency for repeated prefixes. For how a custom system prompt or `append` text affects cache reuse across sessions, see [Modifying system prompts](/docs/en/agent-sdk/modifying-system-prompts#improve-prompt-caching-across-users-and-machines).

### What consumes context

Here's how each component affects context in the SDK:

| Source                   | When it loads                                                             | Impact                                                                                                                                                                                                                                                                                                                                                                                       |
| :----------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **System prompt**        | Every request                                                             | Small fixed cost, always present                                                                                                                                                                                                                                                                                                                                                             |
| **CLAUDE.md files**      | Session start, via [`settingSources`](/docs/en/agent-sdk/claude-code-features) | Full content in every request (but prompt-cached, so only the first request pays full cost)                                                                                                                                                                                                                                                                                                  |
| **Tool definitions**     | Every request; MCP schemas deferred by default                            | Built-in tool schemas load every request. [Tool search](/docs/en/agent-sdk/mcp#mcp-tool-search) defers MCP tool schemas by default, falling back to upfront loading on Google Cloud's Agent Platform, a non-first-party `ANTHROPIC_BASE_URL`, or a Microsoft Foundry deployment hosted on Azure. See [Configure tool search](/docs/en/agent-sdk/tool-search#configure-tool-search) for the full matrix |
| **Conversation history** | Accumulates over turns                                                    | Grows with each turn: prompts, responses, tool inputs, tool outputs                                                                                                                                                                                                                                                                                                                          |
| **Skill descriptions**   | Session start, via setting sources                                        | Short summaries; full content loads only when invoked                                                                                                                                                                                                                                                                                                                                        |

Large tool outputs consume significant context. Reading a big file or running a command with verbose output can use thousands of tokens in a single turn. Context accumulates across turns, so longer sessions with many tool calls build up significantly more context than short ones.

### Automatic compaction

When the context window approaches its limit, the SDK automatically compacts the conversation: it summarizes older history to free space, keeping your most recent exchanges and key decisions intact. The SDK emits a message with `type: "system"` and `subtype: "compact_boundary"` in the stream when this happens (in Python this is a `SystemMessage`; in TypeScript it is a separate `SDKCompactBoundaryMessage` type).

Compaction replaces older messages with a summary, so specific instructions from early in the conversation may not be preserved. Persistent rules belong in CLAUDE.md (loaded via [`settingSources`](/docs/en/agent-sdk/claude-code-features)) rather than in the initial prompt, because CLAUDE.md content is re-injected on every request.

You can customize compaction behavior in several ways:

* **Summarization instructions in CLAUDE.md:** The compactor reads your CLAUDE.md like any other context, so you can include a section telling it what to preserve when summarizing. The section header is free-form (not a magic string); the compactor matches on intent.
* **`PreCompact` hook:** Run custom logic before compaction occurs, for example to archive the full transcript. The hook receives a `trigger` field (`manual` or `auto`). See [hooks](/docs/en/agent-sdk/hooks).
* **Manual compaction:** Send `/compact` as a prompt string to trigger compaction on demand. Commands sent this way are SDK inputs, not CLI-only shortcuts. See [commands in the SDK](/docs/en/agent-sdk/slash-commands).

<Accordion title="Example: Summarization instructions in CLAUDE.md">
  Add a section to your project's CLAUDE.md telling the compactor what to preserve. The header name isn't special; use any clear label.

  ```markdown CLAUDE.md theme={null}
  # Summary instructions

  When summarizing this conversation, always preserve:
  - The current task objective and acceptance criteria
  - File paths that have been read or modified
  - Test results and error messages
  - Decisions made and the reasoning behind them
  ```
</Accordion>
