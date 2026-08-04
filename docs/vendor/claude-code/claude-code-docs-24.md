---
name: claude-code-docs-24
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 24/66 (code.claude.com)"
type: reference
---

## Choose the right feature

The Agent SDK gives you access to several ways to extend your agent's behavior. If you're unsure which to use, this table maps common goals to the right approach.

| You want to...                                                                                    | Use                                           | SDK surface                                                                                                                                                    |
| :------------------------------------------------------------------------------------------------ | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set project conventions your agent always follows                                                 | [CLAUDE.md](/docs/en/memory)                       | `settingSources: ["project"]` loads it automatically                                                                                                           |
| Give the agent reference material it loads when relevant                                          | [Skills](/docs/en/agent-sdk/skills)                | `settingSources` + `skills` option                                                                                                                             |
| Run a reusable workflow (deploy, review, release)                                                 | [User-invocable skills](/docs/en/agent-sdk/skills) | `settingSources` + `skills` option                                                                                                                             |
| Delegate an isolated subtask to a fresh context (research, review)                                | [Subagents](/docs/en/agent-sdk/subagents)          | `agents` parameter + `allowedTools: ["Agent"]`                                                                                                                 |
| Coordinate multiple Claude Code instances with shared task lists and direct inter-agent messaging | [Agent teams](/docs/en/agent-teams)                | Not directly configured via SDK options. Agent teams are a CLI feature where one session acts as the team lead, coordinating work across independent teammates |
| Run deterministic logic on tool calls (audit, block, transform)                                   | [Hooks](/docs/en/agent-sdk/hooks)                  | `hooks` parameter with callbacks, or shell scripts loaded via `settingSources`                                                                                 |
| Give Claude structured tool access to an external service                                         | [MCP](/docs/en/agent-sdk/mcp)                      | `mcpServers` parameter                                                                                                                                         |

<Tip>
  **Subagents versus agent teams:** Subagents are ephemeral and isolated: fresh conversation, one task, summary returned to parent. Agent teams coordinate multiple independent Claude Code instances that share a task list and message each other directly. Agent teams are a CLI feature. See [What subagents inherit](/docs/en/agent-sdk/subagents#what-subagents-inherit) and the [agent teams comparison](/docs/en/agent-teams#compare-with-subagents) for details.
</Tip>

Every feature you enable adds to your agent's context window. For per-feature costs and how these features layer together, see [Extend Claude Code](/docs/en/features-overview#understand-context-costs).

## Related resources

* [Extend Claude Code](/docs/en/features-overview): Conceptual overview of all extension features, with comparison tables and context cost analysis
* [Skills in the SDK](/docs/en/agent-sdk/skills): Full guide to using skills programmatically
* [Subagents](/docs/en/agent-sdk/subagents): Define and invoke subagents for isolated subtasks
* [Hooks](/docs/en/agent-sdk/hooks): Intercept and control agent behavior at key execution points
* [Permissions](/docs/en/agent-sdk/permissions): Control tool access with modes, rules, and callbacks
* [System prompts](/docs/en/agent-sdk/modifying-system-prompts): Inject context without CLAUDE.md files


<!-- source: https://code.claude.com/docs/en/agent-sdk/cost-tracking.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Track cost and usage

> Learn how to track token usage, estimate costs, and configure prompt caching with the Claude Agent SDK.

The Claude Agent SDK provides detailed token usage information for each interaction with Claude. This guide explains how to properly track usage and understand cost reporting, especially when dealing with parallel tool uses and multi-step conversations.

For complete API documentation, see the [TypeScript SDK reference](/docs/en/agent-sdk/typescript) and [Python SDK reference](/docs/en/agent-sdk/python).

<Warning>
  The `total_cost_usd` and `costUSD` fields are client-side estimates, not authoritative billing data. The SDK computes them locally from a price table bundled at build time, so they can drift from what you are actually billed when:

  * pricing changes
  * the installed SDK version does not recognize a model
  * billing rules apply that the client cannot model

  Use these fields for development insight and approximate budgeting. For authoritative billing, use the [Usage and Cost API](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api) or the Usage page in the [Claude Console](https://platform.claude.com/usage). Do not bill end users or trigger financial decisions from these fields.
</Warning>
