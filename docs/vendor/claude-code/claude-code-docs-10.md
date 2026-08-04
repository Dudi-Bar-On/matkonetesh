---
name: claude-code-docs-10
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 10/66 (code.claude.com)"
type: reference
---

# Escalate hard decisions with the advisor tool

> Pair your main model with a stronger advisor model that Claude consults at key moments during a task.

<Note>
  The advisor tool is experimental and requires the Anthropic API. It is not available on Amazon Bedrock, Claude Platform on AWS, Google Cloud's Agent Platform, or Microsoft Foundry. Behavior, pricing, and availability may change.
</Note>

The advisor tool lets Claude consult a second, typically stronger model at key moments during a task, such as before committing to an approach, when stuck on a recurring error, or before declaring a task complete. The advisor receives the full conversation, including every tool call and result, and returns guidance that Claude applies before continuing.

The advisor runs server-side on Anthropic's infrastructure as a [server tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool), available to both subscription and API-billed accounts. You choose which model acts as the advisor, and Claude decides when to call it.

This page covers how to enable the advisor, which model pairings are accepted, what Claude shows during a consultation, and how advisor usage is billed.

## When to use the advisor

The advisor fits long, multi-step tasks where most turns are routine but plan quality determines the outcome. Examples include large refactors, debugging sessions where an error keeps recurring, and tasks you want independently checked before Claude declares them done.

It adds less value on short tasks where there is little to plan, or on work where every turn needs the strongest model. For those, [switch the main model](/docs/en/model-config#setting-your-model) instead, or see [how the advisor compares with opusplan and subagents](#compare-with-related-features) for other ways to get a second opinion.

## Enable the advisor

You can set the advisor model in three ways:

* **`/advisor` command**: set or change the advisor mid-session and save it as your default
* **`advisorModel` setting**: configure a persistent default in your [settings file](/docs/en/settings)
* **`--advisor` flag**: set the advisor for a single session at launch

If any of these sets an advisor model, the advisor is enabled for sessions whose main model [supports it](#choose-an-advisor-model), and an `Advisor Tool (experimental) is on and may use more tokens · /advisor` notification appears after the session starts. To stop using it, see [Turn the advisor off](#turn-the-advisor-off).

<Note>
  {/* min-version: 2.1.210 */}Claude Code doesn't offer Fable 5 as the advisor. For organizations with [Fable 5 access](/docs/en/model-config#work-with-fable-5), the `/advisor` picker lists it as a dimmed, unselectable row labeled `Fable 5 (temporarily unavailable)`, and Claude Code rejects `/advisor fable` and `--advisor fable`. Fable 5 as the main model isn't affected.

  A remotely configured rollout controls when Fable 5 returns as an advisor option.
</Note>

### Use the `/advisor` command

Run `/advisor` without arguments to open a picker listing the available advisor models, or pass the model directly:

```
/advisor opus
```

The command confirms with `Advisor set to` followed by the advisor model name. Your selection is saved to `advisorModel` in your user settings and persists across sessions.

If your organization's [`availableModels`](/docs/en/model-config#restrict-model-selection) allowlist excludes the saved advisor model, the advisor is not invoked until you pick an allowed model with `/advisor`. If your current main model does not support the advisor, the selection is still saved and activates when you switch to a [compatible main model](#choose-an-advisor-model) with [`/model`](/docs/en/model-config#setting-your-model).

### Set `advisorModel` in settings

To configure the advisor as a default without opening a session, set it in your settings file:

```json theme={null}
{
  "advisorModel": "opus"
}
```

### Use the `--advisor` flag

To set the advisor for a single session without changing your saved setting, launch with the flag:

```bash theme={null}
claude --advisor opus
```

The flag takes precedence over the `advisorModel` setting for that session, and isn't listed in `claude --help`. It exits with an error if the session's main model does not support the advisor, or if the requested advisor model is excluded by your organization's [`availableModels`](/docs/en/model-config#restrict-model-selection) allowlist.
