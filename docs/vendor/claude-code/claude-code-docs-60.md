---
name: claude-code-docs-60
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 60/66 (code.claude.com)"
type: reference
---

# Modifying system prompts

> Choose between the `claude_code` preset and a custom system prompt, and customize behavior with CLAUDE.md, output styles, append, or a fully custom prompt.

System prompts define Claude's behavior, capabilities, and response style. Start from the `claude_code` preset for CLI or IDE-like coding tools where a human watches and steers the work. Write your own prompt for agents with a different surface, identity, or permission model.

This page covers:

* [How system prompts work](#how-system-prompts-work), with a decision table for choosing between the preset, the preset with `append`, and a custom prompt
* [Customize agent behavior](#customize-agent-behavior) with CLAUDE.md files, output styles, `append`, or a custom string
* [Compare the four approaches](#compare-the-four-approaches) by persistence, scope, and what they preserve
* [Combine approaches](#combine-approaches) to layer customization methods together

## How system prompts work

A system prompt is the initial instruction set that shapes how Claude behaves throughout a conversation. The Agent SDK has three starting points for it:

* **Minimal default**: when you don't set `systemPrompt` in TypeScript or `system_prompt` in Python, the SDK uses a minimal prompt that covers tool calling but omits Claude Code's coding guidelines, response style, and project context. This differs from `claude -p`, which uses the full Claude Code prompt by default. If you're migrating from the CLI and want matching behavior, set the `claude_code` preset.
* **`claude_code` preset**: the full system prompt that the Claude Code CLI uses, with tool usage instructions, code style and formatting guidelines, response tone and verbosity rules, security and safety instructions, and context about the working directory and environment. Set `systemPrompt: { type: "preset", preset: "claude_code" }` in TypeScript or `system_prompt={"type": "preset", "preset": "claude_code"}` in Python, optionally with `append` to add your own instructions on the end.
* **Custom string**: a prompt you write yourself. The SDK sends only what you provide.

### Decide on a starting point

The deciding factor is how closely your agent resembles Claude Code: a coding agent operating in a repository, with a human watching streaming output and steering the work. The further your product is from that, the more you'll want to write your own prompt.

| You're building                                                                                              | Use                                | What you get                                                                                                                  |
| :----------------------------------------------------------------------------------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| A CLI or IDE-like coding tool where a human watches and steers, and Claude Code's defaults are what you want | `claude_code` preset               | The full Claude Code prompt: tool guidance, safety rules, terminal-friendly responses, repo-convention awareness              |
| The same kind of tool, plus product-specific rules like coding standards, output format, or domain context   | `claude_code` preset with `append` | Everything above, with your instructions added after the preset. Nothing is removed, so this is the lowest-risk customization |
| An agent with a different surface, identity, or permission model, or a non-coding agent                      | Custom prompt string               | Only what you write. You take responsibility for replacing the tool guidance and safety instructions your agent still needs   |
| A thin tool-calling loop with no agent persona, where you supply all behavior in the user prompt             | No `systemPrompt` option           | The minimal default: tool-calling support and nothing else                                                                    |

"Different from Claude Code" usually means one of the following:

* **Different surface**: the output isn't read in a terminal by the person who triggered it. Chat UIs, structured-output consumers, and non-coding automation each need a prompt that matches how their output is rendered and reviewed. Unattended coding automation, like a CI job that fixes lint errors or reviews diffs, still fits the preset because the work itself is what the preset is written for.
* **Different identity**: the agent shouldn't present itself as Claude Code. A support bot, a data-analysis assistant, or any domain-specific agent needs its own name, scope, and persona.
* **Different permission model**: the agent runs autonomously without a human approving each step, or operates on a narrow set of resources. Claude Code's prompt assumes a human is in the loop with access to a full toolset.
* **Non-coding tasks**: most of Claude Code's prompt is coding guidance. For research, content, or operations agents, that guidance competes with the instructions you actually need.

The [comparison table](#compare-the-four-approaches) shows what each customization method preserves.

## Customize agent behavior

Output styles, `append`, and a custom prompt string each change the system prompt directly. CLAUDE.md takes a different path: the SDK reads it and injects its content into the conversation as project context, not into the system prompt, so it shapes behavior alongside whichever system prompt you choose. [Skills](/docs/en/agent-sdk/skills), [hooks](/docs/en/agent-sdk/hooks), and [permissions](/docs/en/agent-sdk/permissions) also shape behavior outside the system prompt and are covered on their own pages.

### CLAUDE.md files for project-level instructions

CLAUDE.md files give Claude persistent project context and instructions. The SDK injects their content into the conversation, not into the system prompt, so they work with any system prompt configuration. For what to put in CLAUDE.md, where to place it, and how to write effective instructions, see [How Claude remembers your project](/docs/en/memory). This section covers what's specific to the SDK: how CLAUDE.md loads.

The SDK reads CLAUDE.md when the matching setting source is enabled: `'project'` loads `CLAUDE.md` or `.claude/CLAUDE.md` from the working directory, and `'user'` loads `~/.claude/CLAUDE.md`. Default `query()` options enable both sources, so CLAUDE.md loads automatically. If you set `settingSources` in TypeScript or `setting_sources` in Python explicitly, include the sources you need. CLAUDE.md loading is controlled by setting sources, not by the `claude_code` preset.
