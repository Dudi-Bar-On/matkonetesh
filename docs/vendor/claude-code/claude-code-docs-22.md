---
name: claude-code-docs-22
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 22/66 (code.claude.com)"
type: reference
---

### CLAUDE.md load locations

| Level                 | Location                                                                      | When loaded                                                                                         |
| :-------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| Project (root)        | `<cwd>/CLAUDE.md` or `<cwd>/.claude/CLAUDE.md`                                | `settingSources` includes `"project"`                                                               |
| Project rules         | `<cwd>/.claude/rules/*.md` and `.claude/rules/*.md` in every parent directory | `settingSources` includes `"project"`                                                               |
| Project (parent dirs) | `CLAUDE.md` files in directories above `cwd`                                  | `settingSources` includes `"project"`, loaded at session start                                      |
| Project (child dirs)  | `CLAUDE.md` files in subdirectories of `cwd`                                  | `settingSources` includes `"project"`, loaded on demand when the agent reads a file in that subtree |
| Local                 | `<cwd>/CLAUDE.local.md` and `CLAUDE.local.md` in every parent directory       | `settingSources` includes `"local"`                                                                 |
| User                  | `~/.claude/CLAUDE.md`                                                         | `settingSources` includes `"user"`                                                                  |
| User rules            | `~/.claude/rules/*.md`                                                        | `settingSources` includes `"user"`                                                                  |

All levels are additive: if both project and user CLAUDE.md files exist, the agent sees both. There is no hard precedence rule between levels; if instructions conflict, the outcome depends on how Claude interprets them. Write non-conflicting rules, or state precedence explicitly in the more specific file ("These project instructions override any conflicting user-level defaults").

<Tip>
  You can also inject context directly via `systemPrompt` without using CLAUDE.md files. See [Modify system prompts](/docs/en/agent-sdk/modifying-system-prompts). Use CLAUDE.md when you want the same context shared between interactive Claude Code sessions and your SDK agents.
</Tip>

For how to structure and organize CLAUDE.md content, see [Manage Claude's memory](/docs/en/memory).

## Skills

Skills are markdown files that give your agent specialized knowledge and invocable workflows. Unlike `CLAUDE.md` (which loads every session), skills load on demand. The agent receives skill descriptions at startup and loads the full content when relevant.

Skills are discovered from the filesystem through `settingSources`. When the `skills` option on `query()` is omitted, discovered user and project skills are enabled and the Skill tool is available, matching CLI behavior. To control which skills are enabled, pass `skills` as `"all"`, a list of skill names, or `[]` to disable all. When `skills` is set, the SDK adds the Skill tool to `allowedTools` automatically. If you also pass an explicit `tools` list, include `"Skill"` in that list so Claude can invoke skills.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
  import asyncio


  # Skills in .claude/skills/ are discovered automatically
  # when settingSources includes "project"
  async def main():
      async for message in query(
          prompt="Review this PR using our code review checklist",
          options=ClaudeAgentOptions(
              setting_sources=["user", "project"],
              skills="all",
              allowed_tools=["Read", "Grep", "Glob"],
          ),
      ):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Skills in .claude/skills/ are discovered automatically
  // when settingSources includes "project"
  for await (const message of query({
    prompt: "Review this PR using our code review checklist",
    options: {
      settingSources: ["user", "project"],
      skills: "all",
      allowedTools: ["Read", "Grep", "Glob"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

<Note>
  Skills must be created as filesystem artifacts (`.claude/skills/<name>/SKILL.md`). The SDK does not have a programmatic API for registering skills. See [Agent Skills in the SDK](/docs/en/agent-sdk/skills) for full details.
</Note>

For more on creating and using skills, see [Agent Skills in the SDK](/docs/en/agent-sdk/skills).
