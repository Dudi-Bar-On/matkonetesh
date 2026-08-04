---
name: claude-code-docs-12
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 12/66 (code.claude.com)"
type: reference
---

## Impact on prompt caching

Enabling or disabling the advisor mid-session does not invalidate your main model's [prompt cache](/docs/en/prompt-caching). Unlike [changing model or effort level](/docs/en/prompt-caching#actions-that-invalidate-the-cache), toggling `/advisor` keeps the cached prefix intact, and the advisor's returned guidance is cached as part of the transcript on later turns.

The advisor model's own read of the conversation is not cached. Each advisor call processes the full transcript anew, with no reuse between calls.

## Requirements

The advisor tool requires all of the following:

* **Anthropic API only**: the advisor is a server-executed tool. It is not available on Amazon Bedrock, Claude Platform on AWS, Google Cloud's Agent Platform, or Microsoft Foundry. Through an [LLM gateway](/docs/en/llm-gateway) configured with `ANTHROPIC_BASE_URL`, availability depends on whether the gateway forwards the request intact to the Anthropic API.
* **Supported main model**: Opus 4.6 or later, Sonnet 4.6 or later, or Haiku 4.5. {/* min-version: 2.1.170 */}Fable 5 also qualifies on Claude Code v2.1.170 or later, but a Fable 5 main [accepts only a Fable advisor](#choose-an-advisor-model) and Fable [isn't offered as the advisor](#enable-the-advisor), so a Fable 5 session runs without one until the rollout returns it as an option.

## Turn the advisor off

To stop using the advisor and clear your saved `advisorModel`, run `/advisor off` or choose **No advisor** in the `/advisor` picker:

```
/advisor off
```

To disable the advisor tool entirely, set `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1`. The `/advisor` command becomes unavailable and any configured `advisorModel` is ignored. The `--advisor` flag is accepted but has no effect; existing scripts that pass it continue to work without errors. See [Environment variables](/docs/en/env-vars).

## Compare with related features

The advisor is one of several ways to combine model strengths. Pick based on when you want a second model involved.

| Approach                                                    | When the stronger model runs                                                                                                           | How it starts                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Advisor tool                                                | At decision points mid-task                                                                                                            | Claude calls it when it needs guidance       |
| [`opusplan`](/docs/en/model-config#opusplan-model-setting)       | During plan mode when [allowed by `availableModels`](/docs/en/model-config#restrict-model-selection), then switches to Sonnet for execution | You enter plan mode                          |
| [Subagents](/docs/en/sub-agents#choose-a-model) with `model` set | For the entire delegated subtask                                                                                                       | Claude delegates, or you invoke the subagent |
| [`/model`](/docs/en/model-config#setting-your-model)             | For all subsequent turns                                                                                                               | You switch models                            |

## See also

* [Model configuration](/docs/en/model-config): switch models, set effort levels, and use `opusplan`
* [Manage costs effectively](/docs/en/costs): track token usage across models
* [Advisor tool in the Claude API](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool): understand the underlying server tool, or use it directly from the Messages API
* [The advisor strategy](https://claude.com/blog/the-advisor-strategy): why pairing a fast main model with a stronger advisor works


<!-- source: https://code.claude.com/docs/en/agent-sdk/agent-loop.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# How the agent loop works

> Understand the message lifecycle, tool execution, context window, and architecture that power your SDK agents.

The Agent SDK lets you embed Claude Code's autonomous agent loop in your own applications. The SDK is a standalone package that gives you programmatic control over tools, permissions, cost limits, and output. You don't need the Claude Code CLI installed to use it.

When you start an agent, the SDK runs the same [execution loop that powers Claude Code](/docs/en/how-claude-code-works#the-agentic-loop): Claude evaluates your prompt, calls tools to take action, receives the results, and repeats until the task is complete. This page explains what happens inside that loop so you can build, debug, and optimize your agents effectively.
