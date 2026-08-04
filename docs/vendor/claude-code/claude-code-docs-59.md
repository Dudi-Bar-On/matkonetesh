---
name: claude-code-docs-59
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 59/66 (code.claude.com)"
type: reference
---

# After
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(model="claude-opus-4-7")
```

**5. Review [breaking changes](#breaking-changes)**

Make any code changes needed to complete the migration.

## Breaking changes

<Warning>
  To improve isolation and explicit configuration, Claude Agent SDK v0.1.0 introduces breaking changes for users migrating from Claude Code SDK. Review this section carefully before migrating.
</Warning>

### Python: ClaudeCodeOptions renamed to ClaudeAgentOptions

**What changed:** The Python SDK type `ClaudeCodeOptions` has been renamed to `ClaudeAgentOptions`.

**Migration:**

```python theme={null}
# BEFORE (claude-code-sdk)
from claude_code_sdk import query, ClaudeCodeOptions

options = ClaudeCodeOptions(model="claude-opus-4-7", permission_mode="acceptEdits")

# AFTER (claude-agent-sdk)
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(model="claude-opus-4-7", permission_mode="acceptEdits")
```

**Why this changed:** The type name now matches the "Claude Agent SDK" branding and provides consistency across the SDK's naming conventions.

### System prompt no longer default

**What changed:** The SDK no longer uses Claude Code's system prompt by default.

**Migration:**

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // BEFORE (v0.0.x) - Used Claude Code's system prompt by default
  const before = query({ prompt: "Hello" });

  // AFTER (v0.1.0) - Uses minimal system prompt by default
  // To get the old behavior, explicitly request Claude Code's preset:
  const presetResult = query({
    prompt: "Hello",
    options: {
      systemPrompt: { type: "preset", preset: "claude_code" }
    }
  });

  // Or use a custom system prompt:
  const customResult = query({
    prompt: "Hello",
    options: {
      systemPrompt: "You are a helpful coding assistant"
    }
  });
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions
  import asyncio


  async def main():
      # BEFORE (v0.0.x) - Used Claude Code's system prompt by default
      async for message in query(prompt="Hello"):
          print(message)

      # AFTER (v0.1.0) - Uses minimal system prompt by default
      # To get the old behavior, explicitly request Claude Code's preset:
      async for message in query(
          prompt="Hello",
          options=ClaudeAgentOptions(
              system_prompt={"type": "preset", "preset": "claude_code"}  # Use the preset
          ),
      ):
          print(message)

      # Or use a custom system prompt:
      async for message in query(
          prompt="Hello",
          options=ClaudeAgentOptions(system_prompt="You are a helpful coding assistant"),
      ):
          print(message)


  asyncio.run(main())
  ```
</CodeGroup>

**Why this changed:** Provides better control and isolation for SDK applications. You can now build agents with custom behavior without inheriting Claude Code's CLI-focused instructions.

### Settings sources default

This default was briefly changed in v0.1.0 and then reverted, so no migration action is needed.

**Current behavior:** Omitting `settingSources` on `query()` loads user, project, and local filesystem settings, matching the CLI. This includes `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, CLAUDE.md files, and custom commands.

To run isolated from filesystem settings, pass an empty array:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const isolatedResult = query({
    prompt: "Hello",
    options: {
      settingSources: [] // No filesystem settings loaded
    }
  });

  // Or load only specific sources:
  const projectOnlyResult = query({
    prompt: "Hello",
    options: {
      settingSources: ["project"] // Only project settings
    }
  });
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions
  import asyncio


  async def main():
      async for message in query(
          prompt="Hello",
          options=ClaudeAgentOptions(setting_sources=[]),  # No filesystem settings loaded
      ):
          print(message)

      # Or load only specific sources:
      async for message in query(
          prompt="Hello",
          options=ClaudeAgentOptions(
              setting_sources=["project"]  # Only project settings
          ),
      ):
          print(message)


  asyncio.run(main())
  ```
</CodeGroup>

Isolation is especially important for CI/CD pipelines, deployed applications, test environments, and multi-tenant systems where local customizations should not leak in.

<Note>
  SDK v0.1.0 briefly defaulted to no settings loaded; this was reverted in subsequent releases. Python SDK 0.1.59 and earlier treated an empty list the same as omitting the option, so upgrade before relying on `setting_sources=[]`. See [What settingSources does not control](/docs/en/agent-sdk/claude-code-features#what-settingsources-does-not-control) for inputs that are read even when `settingSources` is `[]`.
</Note>

## Why the Rename?

The Claude Code SDK was originally designed for coding tasks, but it has evolved into a powerful framework for building all types of AI agents. The new name "Claude Agent SDK" better reflects its capabilities:

* Building business agents (legal assistants, finance advisors, customer support)
* Creating specialized coding agents (SRE bots, security reviewers, code review agents)
* Developing custom agents for any domain with tool use, MCP integration, and more

## Getting Help

If you encounter any issues during migration:

**For TypeScript/JavaScript:**

1. Check that all imports are updated to use `@anthropic-ai/claude-agent-sdk`
2. Verify your package.json has the new package name
3. Run `npm install` to ensure dependencies are updated

**For Python:**

1. Check that all imports are updated to use `claude_agent_sdk`
2. Verify your requirements.txt or pyproject.toml has the new package name
3. Run `pip install claude-agent-sdk` to ensure the package is installed

## Next Steps

* Explore the [Agent SDK Overview](/docs/en/agent-sdk/overview) to learn about available features
* Check out the [TypeScript SDK Reference](/docs/en/agent-sdk/typescript) for detailed API documentation
* Review the [Python SDK Reference](/docs/en/agent-sdk/python) for Python-specific documentation
* Learn about [Custom Tools](/docs/en/agent-sdk/custom-tools) and [MCP Integration](/docs/en/agent-sdk/mcp)


<!-- source: https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.
