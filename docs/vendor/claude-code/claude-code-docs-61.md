---
name: claude-code-docs-61
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 61/66 (code.claude.com)"
type: reference
---

#### Load CLAUDE.md with the SDK

To load CLAUDE.md, set `settingSources` to include the level your CLAUDE.md lives at. The example below loads a project-level CLAUDE.md alongside the `claude_code` preset, so Claude has both the full coding-agent prompt and your project's conventions:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const messages = [];

  for await (const message of query({
    prompt: "Add a new React component for user profiles",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code" // Use Claude Code's system prompt
      },
      settingSources: ["project"] // Loads CLAUDE.md from project
    }
  })) {
    messages.push(message);
  }

  // Now Claude has access to your project guidelines from CLAUDE.md
  ```

  ```python Python theme={null}
  import asyncio

  from claude_agent_sdk import query, ClaudeAgentOptions

  messages = []


  async def main():
      async for message in query(
          prompt="Add a new React component for user profiles",
          options=ClaudeAgentOptions(
              system_prompt={
                  "type": "preset",
                  "preset": "claude_code",  # Use Claude Code's system prompt
              },
              setting_sources=["project"],  # Loads CLAUDE.md from project
          ),
      ):
          messages.append(message)


  asyncio.run(main())

  # Now Claude has access to your project guidelines from CLAUDE.md
  ```
</CodeGroup>

When you run either example, the SDK streams messages as Claude works: a system init message, assistant messages, user messages carrying tool results, and a final result message with the session outcome.

CLAUDE.md is persistent across all sessions in a project, shared with your team through git, and discovered automatically without code changes. It is not loaded if you pass an empty `settingSources` array.

### Output styles for persistent configurations

Output styles are saved configurations that modify Claude's system prompt. They're stored as markdown files and can be reused across sessions and projects.

#### Create an output style

An output style is a markdown file with [frontmatter](/docs/en/output-styles#frontmatter) for metadata, followed by the prompt content. Save it to `~/.claude/output-styles/` for a user-level style available in every project, or `.claude/output-styles/` in your repository for a project-level style you can commit and share with your team.

By default, a custom output style replaces the `claude_code` preset's software engineering instructions with your own. To keep them and layer your instructions on top, set `keep-coding-instructions: true` in the frontmatter. Keep them when your agent is still doing software engineering work. Leave them out when you're replacing the role entirely.

The example below defines a code-review persona that keeps the coding instructions, since reviewing code still benefits from Claude Code's security and code-quality guidance. Save it as `~/.claude/output-styles/code-reviewer.md` to make it available across projects:

```markdown ~/.claude/output-styles/code-reviewer.md theme={null}
---
name: Code Reviewer
description: Thorough code review assistant
keep-coding-instructions: true
---

You are an expert code reviewer.

For every code submission:
1. Check for bugs and security issues
2. Evaluate performance
3. Suggest improvements
4. Rate code quality (1-10)
```

#### Activate an output style

Once created, activate output styles via:

* **CLI**: run `/config` and select an output style
* **Settings**: set `outputStyle` in `.claude/settings.local.json`
* **TypeScript SDK**: set `outputStyle` inside the inline `settings` object passed to `query()`, or point `settings` at a settings file that sets it. `outputStyle` is not a top-level `Options` field:

  ```typescript theme={null}
  const options = { settings: { outputStyle: "Explanatory" } };
  ```

The Python SDK does not have an option to select an output style programmatically. For code-only deployments where you can't write to `.claude/settings.local.json`, use `append` or a custom prompt string instead.

**Note for SDK users:** Output styles are loaded when you include `settingSources: ['user']` or `settingSources: ['project']` (TypeScript) / `setting_sources=["user"]` or `setting_sources=["project"]` (Python) in your options.

### Append to the `claude_code` preset

You can use the Claude Code preset with an `append` property to add your custom instructions while preserving all built-in functionality.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const messages = [];

  for await (const message of query({
    prompt: "Help me write a Python function to calculate fibonacci numbers",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: "Always include detailed docstrings and type hints in Python code."
      }
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

  messages = []


  async def main():
      async for message in query(
          prompt="Help me write a Python function to calculate fibonacci numbers",
          options=ClaudeAgentOptions(
              system_prompt={
                  "type": "preset",
                  "preset": "claude_code",
                  "append": "Always include detailed docstrings and type hints in Python code.",
              }
          ),
      ):
          messages.append(message)
          if isinstance(message, AssistantMessage):
              print(message.content)


  asyncio.run(main())
  ```
</CodeGroup>
