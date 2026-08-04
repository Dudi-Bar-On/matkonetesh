---
name: claude-code-docs-15
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 15/66 (code.claude.com)"
type: reference
---

### Turns and budget

| Option                                         | What it controls             | Default  |
| :--------------------------------------------- | :--------------------------- | :------- |
| Max turns (`max_turns` / `maxTurns`)           | Maximum tool-use round trips | No limit |
| Max budget (`max_budget_usd` / `maxBudgetUsd`) | Maximum cost before stopping | No limit |

When either limit is hit, the SDK returns a `ResultMessage` with a corresponding error subtype (`error_max_turns` or `error_max_budget_usd`). See [Handle the result](#handle-the-result) for how to check these subtypes and [`ClaudeAgentOptions`](/docs/en/agent-sdk/python#claudeagentoptions) / [`Options`](/docs/en/agent-sdk/typescript#options) for syntax.

The budget cap covers [subagents](/docs/en/agent-sdk/subagents): their spend counts toward the total. {/* min-version: 2.1.217 */}Once spend reaches the cap, spawning another subagent fails with `Budget limit reached`, and Claude Code stops any background subagents still running. The cap-enforcement behaviors require Claude Code v2.1.217 or later.

With [streaming input](/docs/en/agent-sdk/streaming-vs-single-mode), a message you send while a turn is still running stays queued when that turn ends at the max-turns limit, and it starts its own turn with its own max-turns limit. Before v2.1.205, a message that arrived on the turn's final iteration could be consumed into the ending turn and lost without ever reaching the model.

### Effort level

The `effort` option controls how much reasoning Claude applies. Lower effort levels use fewer tokens per turn and reduce cost. Not all models support the effort parameter. See [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) for which models support it.

| Level      | Behavior                          | Good for                                                                  |
| :--------- | :-------------------------------- | :------------------------------------------------------------------------ |
| `"low"`    | Minimal reasoning, fast responses | File lookups, listing directories                                         |
| `"medium"` | Balanced reasoning                | Routine edits, standard tasks                                             |
| `"high"`   | Thorough analysis                 | Refactors, debugging                                                      |
| `"xhigh"`  | Extended reasoning depth          | Coding and agentic tasks; recommended on Fable 5, Opus 4.7+, and Sonnet 5 |
| `"max"`    | Maximum reasoning depth           | Multi-step problems requiring deep analysis                               |

If you don't set `effort`, both SDKs leave the parameter unset and defer to the model's default behavior.

<Note>
  `effort` trades latency and token cost for reasoning depth within each response. [Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) is a separate feature that produces `thinking` blocks in the output, and the `display` field on `ThinkingConfig` for [Python](/docs/en/agent-sdk/python#thinkingconfig) or [TypeScript](/docs/en/agent-sdk/typescript#thinkingconfig) controls whether you receive their text. They are independent: you can set `effort: "low"` with extended thinking enabled, or `effort: "max"` without it.
</Note>

Use lower effort for agents doing simple, well-scoped tasks (like listing files or running a single grep) to reduce cost and latency. Set `effort` in the top-level `query()` options for the whole session, or per subagent with the `effort` field on [`AgentDefinition`](/docs/en/agent-sdk/subagents#agentdefinition-configuration) to override the session level.
