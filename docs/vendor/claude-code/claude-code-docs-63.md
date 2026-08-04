---
name: claude-code-docs-63
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 63/66 (code.claude.com)"
type: reference
---

### When to use CLAUDE.md

Use CLAUDE.md for instructions that should apply to every session in a project, regardless of which system prompt the session uses: coding standards, common commands, architecture context, and team conventions. CLAUDE.md is committed to your repository, so it stays in sync with the code it describes. See [When to add to CLAUDE.md](/docs/en/memory#when-to-add-to-claude-md) for full guidance.

CLAUDE.md files load when the `project` setting source is enabled, which it is for default `query()` options. If you set `settingSources` in TypeScript or `setting_sources` in Python explicitly, include `'project'` to keep loading project-level CLAUDE.md.

### When to use output styles

Output styles are for personas you want to reuse across the CLI and SDK without changing application code. Because they live as files in `.claude/output-styles`, the same persona is available from `/config` in the CLI and from any SDK session that loads the matching setting source.

**Best for:**

* Persistent behavior changes across sessions
* Team-shared configurations
* Specialized assistants like a code reviewer, data scientist, or DevOps assistant
* Complex prompt modifications that need versioning

**Examples:**

* Creating a dedicated SQL optimization assistant
* Building a security-focused code reviewer
* Developing a teaching assistant with specific pedagogy

### When to use `systemPrompt` with append

Use `append` when the `claude_code` preset already fits your product and you only need to layer in extra instructions. You keep the preset's tool guidance, safety rules, and coding conventions without reimplementing them.

**Best for:**

* Adding specific coding standards or preferences
* Customizing output formatting
* Adding domain-specific knowledge
* Modifying response verbosity
* Enhancing Claude Code's default behavior without losing tool instructions

### When to use custom `systemPrompt`

Use a custom prompt when your agent's surface, identity, or permission model differs from Claude Code's, as described in [Decide on a starting point](#decide-on-a-starting-point). You define the full instruction set, including any tool guidance and safety rules your agent needs.

**Best for:**

* Complete control over Claude's behavior
* Specialized single-session tasks
* Testing new prompt strategies
* Situations where default tools aren't needed
* Building specialized agents with unique behavior

## Combine approaches

These methods compose. A persistent output style or CLAUDE.md sets the long-lived behavior, and `append` layers session-specific instructions on top without touching the saved configuration.

### Combine an output style with session-specific additions

The example below assumes a Code Reviewer output style is already active. The `append` block layers session-specific focus areas on top of the persona, so a single review session can prioritize OAuth and token storage without changing the saved output style:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Assuming "Code Reviewer" output style is active (via /config or settings)
  // Add session-specific focus areas
  const messages = [];

  for await (const message of query({
    prompt: "Review this authentication module",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: `
          For this review, prioritize:
          - OAuth 2.0 compliance
          - Token storage security
          - Session management
        `
      }
    }
  })) {
    messages.push(message);
  }
  ```

  ```python Python theme={null}
  import asyncio

  from claude_agent_sdk import query, ClaudeAgentOptions

  # Assuming "Code Reviewer" output style is active (via /config or settings)
  # Add session-specific focus areas
  messages = []


  async def main():
      async for message in query(
          prompt="Review this authentication module",
          options=ClaudeAgentOptions(
              system_prompt={
                  "type": "preset",
                  "preset": "claude_code",
                  "append": """
                  For this review, prioritize:
                  - OAuth 2.0 compliance
                  - Token storage security
                  - Session management
                  """,
              }
          ),
      ):
          messages.append(message)


  asyncio.run(main())
  ```
</CodeGroup>

## See also

* [Output styles](/docs/en/output-styles): create, manage, and share output styles for the CLI, including the file format and storage locations
* [How Claude remembers your project](/docs/en/memory): what to put in CLAUDE.md, where to place it, and how to write effective project instructions
* [TypeScript SDK reference](/docs/en/agent-sdk/typescript): the full `Options` type, including `systemPrompt`, `settingSources`, and `settings`
* [Python SDK reference](/docs/en/agent-sdk/python): the full `ClaudeAgentOptions` type, including `system_prompt` and `setting_sources`
* [Settings](/docs/en/settings): the `settings.json` reference, including where output styles and other configuration are stored


<!-- source: https://code.claude.com/docs/en/agent-sdk/observability.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Observability with OpenTelemetry

> Export traces, metrics, and events from the Agent SDK to your observability backend using OpenTelemetry.

When you run agents in production, you need visibility into what they did:

* which tools they called
* how long each model request took
* how many tokens were spent
* where failures occurred

The Agent SDK can export this data as OpenTelemetry traces, metrics, and log events to any backend that accepts the OpenTelemetry Protocol (OTLP), such as Honeycomb, Datadog, Grafana, Langfuse, or a self-hosted collector.

This guide explains how the SDK emits telemetry, how to configure the export, and how to tag and filter the data once it reaches your backend. To read token usage and cost directly from the SDK response stream instead of exporting to a backend, see [Track cost and usage](/docs/en/agent-sdk/cost-tracking).
