---
name: claude-code-docs-20
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 20/66 (code.claude.com)"
type: reference
---

## Next steps

Now that you understand the loop, here's where to go depending on what you're building:

* **Haven't run an agent yet?** Start with the [quickstart](/docs/en/agent-sdk/quickstart) to get the SDK installed and see a full example running end to end.
* **Ready to hook into your project?** [Load CLAUDE.md, skills, and filesystem hooks](/docs/en/agent-sdk/claude-code-features) so the agent follows your project conventions automatically.
* **Building an interactive UI?** Enable [streaming](/docs/en/agent-sdk/streaming-output) to show live text and tool calls as the loop runs.
* **Need tighter control over what the agent can do?** Lock down tool access with [permissions](/docs/en/agent-sdk/permissions), and use [hooks](/docs/en/agent-sdk/hooks) to audit, block, or transform tool calls before they execute.
* **Running long or expensive tasks?** Offload isolated work to [subagents](/docs/en/agent-sdk/subagents) to keep your main context lean.
* **Deploying as a service?** See [Hosting the Agent SDK](/docs/en/agent-sdk/hosting) for container and serverless guidance, and [Session storage](/docs/en/agent-sdk/session-storage) to persist sessions to your own backend.

For the broader conceptual picture of the agentic loop (not SDK-specific), see [How Claude Code works](/docs/en/how-claude-code-works). For a practical guide to designing loops in Claude Code, from turn-based to goal-based and proactive loops, see [Loop engineering: getting started with loops](https://claude.com/blog/getting-started-with-loops) on the blog.


<!-- source: https://code.claude.com/docs/en/agent-sdk/claude-code-features.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Use Claude Code features in the SDK

> Load project instructions, skills, hooks, and other Claude Code features into your SDK agents.

The Agent SDK is built on the same foundation as Claude Code, which means your SDK agents have access to the same filesystem-based features: project instructions (`CLAUDE.md` and rules), skills, hooks, and more.

When you omit `settingSources`, `query()` reads the same filesystem settings as the Claude Code CLI: user, project, and local settings, CLAUDE.md files, and `.claude/` skills, agents, and commands. To run without these, pass `settingSources: []`, which limits the agent to what you configure programmatically. Managed policy settings and the global `~/.claude.json` config are read regardless of this option. See [What settingSources does not control](#what-settingsources-does-not-control).

For a conceptual overview of what each feature does and when to use it, see [Extend Claude Code](/docs/en/features-overview).

## Control filesystem settings with settingSources

The setting sources option ([`setting_sources`](/docs/en/agent-sdk/python#claudeagentoptions) in Python, [`settingSources`](/docs/en/agent-sdk/typescript#settingsource) in TypeScript) controls which filesystem-based settings the SDK loads. Pass an explicit list to opt in to specific sources, or pass an empty array to disable user, project, and local settings.

This example loads both user-level and project-level settings by setting `settingSources` to `["user", "project"]`:

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage
  import asyncio


  async def main():
      async for message in query(
          prompt="Help me refactor the auth module",
          options=ClaudeAgentOptions(
              # "user" loads from ~/.claude/, "project" loads from ./.claude/ in cwd.
              # Together they give the agent access to CLAUDE.md, skills, hooks, and
              # permissions from both locations.
              setting_sources=["user", "project"],
              allowed_tools=["Read", "Edit", "Bash"],
          ),
      ):
          if isinstance(message, AssistantMessage):
              for block in message.content:
                  if hasattr(block, "text"):
                      print(block.text)
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(f"\nResult: {message.result}")


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Help me refactor the auth module",
    options: {
      // "user" loads from ~/.claude/, "project" loads from ./.claude/ in cwd.
      // Together they give the agent access to CLAUDE.md, skills, hooks, and
      // permissions from both locations.
      settingSources: ["user", "project"],
      allowedTools: ["Read", "Edit", "Bash"]
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") console.log(block.text);
      }
    }
    if (message.type === "result" && message.subtype === "success") {
      console.log(`\nResult: ${message.result}`);
    }
  }
  ```
</CodeGroup>

When this runs, the assistant's response prints to stdout, followed by a final result line once the run completes.

Each source loads settings from a specific location, where `<cwd>` is the working directory you pass via the `cwd` option, or the process's current directory if unset. For the full type definition, see [`SettingSource`](/docs/en/agent-sdk/typescript#settingsource) (TypeScript) or [`SettingSource`](/docs/en/agent-sdk/python#settingsource) (Python).

| Source      | What it loads                                                                                   | Location                                                                                                                                                                            |
| :---------- | :---------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"project"` | Project CLAUDE.md, `.claude/rules/*.md`, project skills, project hooks, project `settings.json` | `<cwd>/.claude/` for `settings.json` and hooks; `<cwd>` and every parent directory for CLAUDE.md and rules; `<cwd>` and every parent directory up to the repository root for skills |
| `"user"`    | User CLAUDE.md, `~/.claude/rules/*.md`, user skills, user settings                              | `~/.claude/`                                                                                                                                                                        |
| `"local"`   | CLAUDE.local.md, `.claude/settings.local.json`                                                  | `<cwd>/.claude/` for `settings.local.json`; `<cwd>` and every parent directory for CLAUDE.local.md                                                                                  |

Omitting `settingSources` is equivalent to `["user", "project", "local"]`.

The `cwd` option determines where the SDK looks for project-level inputs. CLAUDE.md and rules load from `<cwd>` and from every parent directory. Skills load from `<cwd>` and from every parent directory up to the repository root. Project `settings.json` and hooks load only from `<cwd>/.claude/` with no parent-directory fallback.
