---
name: claude-code-docs-62
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 62/66 (code.claude.com)"
type: reference
---

#### Improve prompt caching across users and machines

By default, two sessions that use the same `claude_code` preset and `append` text still cannot share a prompt cache entry if they run from different working directories. This is because the preset embeds per-session context in the system prompt ahead of your `append` text: the working directory, whether it's a git repository, the platform, the active shell, the OS version, and auto-memory paths. Any difference in that context produces a different system prompt and a cache miss. CLAUDE.md content doesn't affect the system prompt cache because the SDK injects it into the conversation, not the system prompt.

To make the system prompt identical across sessions, set `excludeDynamicSections: true` in TypeScript or `"exclude_dynamic_sections": True` in Python. The per-session context moves into the first user message, leaving only the static preset and your `append` text in the system prompt so identical configurations share a cache entry across users and machines.

<Note>
  `excludeDynamicSections` requires `@anthropic-ai/claude-agent-sdk` v0.2.98 or later, or `claude-agent-sdk` v0.1.58 or later for Python. It applies only to the preset object form and has no effect when `systemPrompt` is a string.
</Note>

The following example pairs a shared `append` block with `excludeDynamicSections` so a fleet of agents running from different directories can reuse the same cached system prompt:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Triage the open issues in this repo",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: "You operate Acme's internal triage workflow. Label issues by component and severity.",
        excludeDynamicSections: true
      }
    }
  })) {
    // ...
  }
  ```

  ```python Python theme={null}
  import asyncio

  from claude_agent_sdk import query, ClaudeAgentOptions


  async def main():
      async for message in query(
          prompt="Triage the open issues in this repo",
          options=ClaudeAgentOptions(
              system_prompt={
                  "type": "preset",
                  "preset": "claude_code",
                  "append": "You operate Acme's internal triage workflow. Label issues by component and severity.",
                  "exclude_dynamic_sections": True,
              },
          ),
      ):
          ...


  asyncio.run(main())
  ```
</CodeGroup>

**Tradeoffs:** the working directory, the git-repo flag, the platform, the active shell, the OS version, and auto-memory paths still reach Claude, but as part of the first user message rather than the system prompt. Instructions in the user message carry marginally less weight than the same text in the system prompt, so Claude may rely on them less strongly when reasoning about the current directory or auto-memory paths. Enable this option when cross-session cache reuse matters more than maximally authoritative environment context.

For the equivalent flag in non-interactive CLI mode, see [`--exclude-dynamic-system-prompt-sections`](/docs/en/cli-reference).

### Custom system prompts

You can provide a custom string as `systemPrompt` to replace the default entirely with your own instructions.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const customPrompt = `You are a Python coding specialist.
  Follow these guidelines:
  - Write clean, well-documented code
  - Use type hints for all functions
  - Include comprehensive docstrings
  - Prefer functional programming patterns when appropriate
  - Always explain your code choices`;

  const messages = [];

  for await (const message of query({
    prompt: "Create a data processing pipeline",
    options: {
      systemPrompt: customPrompt
    }
  })) {
    messages.push(message);
    if (message.type === "assistant") {
      console.log(message.message.content);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio

  from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage

  custom_prompt = """You are a Python coding specialist.
  Follow these guidelines:
  - Write clean, well-documented code
  - Use type hints for all functions
  - Include comprehensive docstrings
  - Prefer functional programming patterns when appropriate
  - Always explain your code choices"""

  messages = []


  async def main():
      async for message in query(
          prompt="Create a data processing pipeline",
          options=ClaudeAgentOptions(system_prompt=custom_prompt),
      ):
          messages.append(message)
          if isinstance(message, AssistantMessage):
              print(message.content)


  asyncio.run(main())
  ```
</CodeGroup>

In Python, load a large custom prompt from a file with `system_prompt={"type": "file", "path": "..."}` instead of passing it as a string. The Python SDK passes a string prompt as one command-line argument to the CLI subprocess, so a prompt that exceeds the OS argument-length limit fails at process spawn before any API request is sent. On Linux the error is `Argument list too long`. See [`SystemPromptFile`](/docs/en/agent-sdk/python#systempromptfile) for the platform thresholds and the Windows behavior.

## Compare the four approaches

The four customization methods differ in where they live, how they're shared, and what they preserve from the `claude_code` preset.

| Feature                 | CLAUDE.md        | Output Styles             | `systemPrompt` with append | Custom `systemPrompt`  |
| ----------------------- | ---------------- | ------------------------- | -------------------------- | ---------------------- |
| **Persistence**         | Per-project file | Saved as files            | Session only               | Session only           |
| **Reusability**         | Per-project      | Across projects           | Code duplication           | Code duplication       |
| **Management**          | On filesystem    | CLI + files               | In code                    | In code                |
| **Default tools**       | Preserved        | Preserved                 | Preserved                  | Lost (unless included) |
| **Built-in safety**     | Maintained       | Maintained                | Maintained                 | Must be added          |
| **Environment context** | Automatic        | Automatic                 | Automatic                  | Must be provided       |
| **Customization level** | Additions only   | Replace or extend default | Additions only             | Complete control       |
| **Version control**     | With project     | Yes                       | With code                  | With code              |
| **Scope**               | Project-specific | User or project           | Code session               | Code session           |

"With append" means using `systemPrompt: { type: "preset", preset: "claude_code", append: "..." }` in TypeScript or `system_prompt={"type": "preset", "preset": "claude_code", "append": "..."}` in Python. CLAUDE.md doesn't change the system prompt itself: the SDK injects its content into the conversation as project context.

## Use cases and best practices
