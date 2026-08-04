---
name: claude-code-docs-23
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 23/66 (code.claude.com)"
type: reference
---

## Hooks

The SDK supports two ways to define hooks, and they run side by side:

* **Filesystem hooks:** shell commands defined in `settings.json`, loaded when `settingSources` includes the relevant source. These are the same hooks you'd configure for [interactive Claude Code sessions](/docs/en/hooks-guide).
* **Programmatic hooks:** callback functions passed directly to `query()`. These run in your application process and can return structured decisions. See [Control execution with hooks](/docs/en/agent-sdk/hooks).

Both types execute during the same hook lifecycle. If you already have hooks in your project's `.claude/settings.json` and you set `settingSources: ["project"]`, those hooks run automatically in the SDK with no extra configuration.

Hook callbacks receive the tool input and return a decision dict. Returning `{}` means allow the tool to proceed. To block execution, return a `hookSpecificOutput` object with `permissionDecision: "deny"` and a `permissionDecisionReason`. The reason is sent to Claude as the tool result. The top-level `decision` and `reason` fields are deprecated for `PreToolUse`. See the [hooks guide](/docs/en/agent-sdk/hooks) for the full callback signature and return types.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher, ResultMessage
  import asyncio


  # PreToolUse hook callback. Positional args:
  #   input_data: HookInput dict with tool_name, tool_input, hook_event_name
  #   tool_use_id: str | None, the ID of the tool call being intercepted
  #   context: HookContext, reserved for future abort-signal support
  async def audit_bash(input_data, tool_use_id, context):
      command = input_data.get("tool_input", {}).get("command", "")
      if "rm -rf" in command:
          return {
              "hookSpecificOutput": {
                  "hookEventName": "PreToolUse",
                  "permissionDecision": "deny",
                  "permissionDecisionReason": "Destructive command blocked",
              }
          }
      return {}  # Empty dict: allow the tool to proceed


  # Filesystem hooks from .claude/settings.json run automatically
  # when settingSources loads them. You can also add programmatic hooks:
  async def main():
      async for message in query(
          prompt="Refactor the auth module",
          options=ClaudeAgentOptions(
              setting_sources=["project"],  # Loads hooks from .claude/settings.json
              hooks={
                  "PreToolUse": [
                      HookMatcher(matcher="Bash", hooks=[audit_bash]),
                  ]
              },
          ),
      ):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query, type HookInput, type HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

  // PreToolUse hook callback. HookInput is a discriminated union on
  // hook_event_name, so narrowing on it gives TypeScript the right
  // tool_input shape for this event.
  const auditBash = async (input: HookInput): Promise<HookJSONOutput> => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const toolInput = input.tool_input as { command?: string };
    if (toolInput.command?.includes("rm -rf")) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Destructive command blocked",
        },
      };
    }
    return {}; // Empty object: allow the tool to proceed
  };

  // Filesystem hooks from .claude/settings.json run automatically
  // when settingSources loads them. You can also add programmatic hooks:
  for await (const message of query({
    prompt: "Refactor the auth module",
    options: {
      settingSources: ["project"], // Loads hooks from .claude/settings.json
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [auditBash] }]
      }
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

### When to use which hook type

| Hook type                                 | Best for                                                                                                                                                                                                                                                                                                     |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Filesystem** (`settings.json`)          | Sharing hooks between CLI and SDK sessions. Supports `"command"` (shell scripts), `"http"` (POST to an endpoint), `"mcp_tool"` (call a connected MCP server's tool), `"prompt"` (LLM evaluates a prompt), and `"agent"` (spawns a verifier agent). These fire in the main agent and any subagents it spawns. |
| **Programmatic** (callbacks in `query()`) | Application-specific logic, structured decisions, and in-process integration. These also fire inside subagents. The hook input, the callback's first argument, carries `agent_id` and `agent_type` fields that identify which agent fired the hook.                                                          |

<Note>
  The TypeScript SDK supports additional hook events beyond Python, including `SessionStart`, `SessionEnd`, `TeammateIdle`, and `TaskCompleted`. See the [hooks guide](/docs/en/agent-sdk/hooks) for the full event compatibility table.
</Note>

For full details on programmatic hooks, see [Control execution with hooks](/docs/en/agent-sdk/hooks). For filesystem hook syntax, see [Hooks](/docs/en/hooks).
