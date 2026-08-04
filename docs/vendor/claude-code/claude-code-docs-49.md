---
name: claude-code-docs-49
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 49/66 (code.claude.com)"
type: reference
---

### Hook not firing

* Verify the hook event name is correct and case-sensitive (`PreToolUse`, not `preToolUse`)
* Check that your matcher pattern matches the tool name exactly
* Ensure the hook is under the correct event type in `options.hooks`
* For non-tool hooks that support matchers, like `Notification` and `SubagentStop`, matchers match against different fields, and `Stop` ignores matchers entirely (see [matcher patterns](/docs/en/hooks#matcher-patterns))
* Hooks may not fire when the agent hits the [`max_turns`](/docs/en/agent-sdk/python#claudeagentoptions) limit because the session ends before hooks can execute

### Matcher not filtering as expected

Matchers only match tool names, not file paths or other arguments. To filter by file path, check `tool_input.file_path` inside your hook:

```typescript theme={null}
const myHook: HookCallback = async (input, toolUseID, { signal }) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  const filePath = toolInput?.file_path as string;
  if (!filePath?.endsWith(".md")) return {}; // Skip non-markdown files
  // Process markdown files...
  return {};
};
```

### Hook timeout

Claude Code runs each callback with a timeout, which you set in seconds with the `timeout` field on its `HookMatcher`. When you don't set one, Claude Code uses the event's default: 600 seconds for most events, 30 seconds for `UserPromptSubmit`, and 10 seconds for `MessageDisplay`. Claude Code runs `SessionEnd` callbacks during shutdown under the shorter [SessionEnd timeout budget](/docs/en/hooks#sessionend-input).

When a callback exceeds its timeout, Claude Code cancels it and treats it as a failed hook: it discards the callback's output and the session continues rather than hanging. What happens next depends on the event:

* `PreToolUse`: {/* min-version: 2.1.210 */}Claude Code doesn't run the tool call, Claude receives a tool result stating the hook didn't respond before its timeout, and the turn continues. If another `PreToolUse` hook returned an explicit deny, Claude receives that denial instead of the timeout error. Before v2.1.210, Claude Code reported the timeout to Claude as a user rejection, which made unattended sessions stop and wait for input.
* `PostToolUse` and `PostToolUseFailure`: Claude Code keeps the tool result and the turn continues.
* `UserPromptSubmit` and [`UserPromptExpansion`](/docs/en/hooks#userpromptexpansion): {/* min-version: 2.1.208 */}Claude Code blocks the prompt with a message naming the hook and the timeout, and the session continues. Because a callback on these events can act as a policy gate, Claude Code never lets a timed-out prompt through unscreened. Before v2.1.208, Claude Code ended the query with `error_during_execution` when a callback on these events timed out.
* `Stop` and `SubagentStop`: Claude Code shows a warning and the agent stops normally.
* Other events, such as `Notification` and `PreCompact`: Claude Code logs the failure and continues.

{/* min-version: 2.1.208 */}If you interrupt the query while a callback is pending, Claude Code cancels the pending tool call. Before v2.1.208, the tool call could still proceed if you interrupted during a pending `PreToolUse` callback.

If your callback needs more time, set a higher `timeout` on its `HookMatcher`. In TypeScript, use the `AbortSignal` from the third callback argument to handle cancellation gracefully when the timeout fires.

### Tool blocked unexpectedly

* Check all `PreToolUse` hooks for `permissionDecision: 'deny'` returns
* Add logging to your hooks to see what `permissionDecisionReason` they're returning
* Verify matcher patterns aren't too broad: an empty matcher matches all tools

### Modified input not applied

* Ensure `updatedInput` is inside `hookSpecificOutput`, not at the top level:

  ```typescript theme={null}
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: { command: "new command" }
    }
  };
  ```

* Don't pair `updatedInput` with `permissionDecision: 'defer'`, which drops the modified input. Omitting `permissionDecision` is fine: the modified input still applies through the normal permission evaluation. You can also return `'allow'` to auto-approve the modified input or `'ask'` to show it to the user for approval

* Include `hookEventName` in `hookSpecificOutput` to identify which hook type the output is for

### Session hooks not available in Python

`SessionStart` and `SessionEnd` can be registered as SDK callback hooks in TypeScript, but aren't available in the Python SDK because its `HookEvent` type omits them. In Python, they are only available as [shell command hooks](/docs/en/hooks#hook-events) defined in settings files such as `.claude/settings.json`. To load shell command hooks from your SDK application, include the appropriate setting source with [`setting_sources`](/docs/en/agent-sdk/python#settingsource) or [`settingSources`](/docs/en/agent-sdk/typescript#settingsource):

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      setting_sources=["project"],  # Loads .claude/settings.json including hooks
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    settingSources: ["project"] // Loads .claude/settings.json including hooks
  };
  ```
</CodeGroup>

To run initialization logic as a Python SDK callback instead, use the first message from `client.receive_response()` as your trigger.

### Subagent permission prompts multiplying

When spawning multiple subagents, each one may request permissions separately. Subagents don't automatically inherit parent agent permissions. To avoid repeated prompts, use `PreToolUse` hooks to auto-approve specific tools, or configure permission rules that apply to subagent sessions.

### Recursive hook loops with subagents

A `UserPromptSubmit` hook that spawns subagents can create infinite loops if those subagents trigger the same hook. To prevent this:

* Check for a subagent indicator in the hook input before spawning
* Use a shared variable or session state to track whether you're already inside a subagent
* Scope hooks to only run for the top-level agent session

### systemMessage not appearing in output

The `systemMessage` field shows a message to the user, not the model. By default the SDK surfaces hook output in the message stream only for `SessionStart` and `Setup` hooks, so a message from any other hook event doesn't appear unless you set `includeHookEvents` (`include_hook_events` in Python). To pass context to the model instead, return [`additionalContext`](/docs/en/hooks#add-context-for-claude).

If you need to surface hook decisions to your application reliably, log them separately or use a dedicated output channel.
