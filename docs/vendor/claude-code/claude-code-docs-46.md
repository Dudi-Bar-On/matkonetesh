---
name: claude-code-docs-46
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 46/66 (code.claude.com)"
type: reference
---

#### Inputs

Every hook callback receives three arguments:

* **Input data:** a typed object containing event details. Each hook type has its own input shape. For example, `PreToolUseHookInput` includes `tool_name` and `tool_input`, while `NotificationHookInput` includes `message`. See the full type definitions in the [TypeScript](/docs/en/agent-sdk/typescript#hookinput) and [Python](/docs/en/agent-sdk/python#hookinput) SDK references.
  * All hook inputs share `session_id`, `cwd`, and `hook_event_name`.
  * `agent_id` and `agent_type` are populated when the hook fires inside a subagent. In TypeScript, these are on the base hook input and available to all hook types. In Python, they are optional fields on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and `PermissionRequest`, and required fields on `SubagentStart` and `SubagentStop`.
* **Tool use ID** (`str | None` / `string | undefined`): correlates `PreToolUse` and `PostToolUse` events for the same tool call.
* **Context:** in TypeScript, contains a `signal` property (`AbortSignal`) for cancellation. In Python, this argument is reserved for future use.

#### Outputs

Your callback returns an object with two categories of fields:

* **Top-level fields** work the same on every event: `systemMessage` shows a message to the user, and `continue` (`continue_` in Python) determines whether the agent keeps running after this hook.
* **`hookSpecificOutput`** controls the current operation. The fields inside depend on the hook event type. For `PreToolUse` hooks, this is where you set `permissionDecision` (`"allow"`, `"deny"`, `"ask"`, or `"defer"`), `permissionDecisionReason`, and `updatedInput`. Returning `"defer"` ends the query so you can [resume it later](/docs/en/hooks#defer-a-tool-call-for-later). For `PostToolUse` hooks, you can set `additionalContext` to append information to the tool result. To replace the tool's output before Claude sees it, set `updatedToolOutput`, which works for any tool in both SDKs. The older `updatedMCPToolOutput` field replaces MCP tool output only and is deprecated.

Return `{}` to allow the operation without changes. SDK callback hooks use the same JSON output format as [Claude Code shell command hooks](/docs/en/hooks#json-output), which documents every field and event-specific option. For the SDK type definitions, see the [TypeScript](/docs/en/agent-sdk/typescript#synchookjsonoutput) and [Python](/docs/en/agent-sdk/python#synchookjsonoutput) SDK references.

<Note>
  When multiple hooks or permission rules apply, `deny` takes priority over `defer`, which takes priority over `ask`, which takes priority over `allow`. If any hook returns `deny`, the operation is blocked regardless of other hooks.
</Note>

#### Asynchronous output

By default, the agent waits for your hook to return before proceeding. If your hook performs a side effect, such as logging or sending a webhook, and doesn't need to influence the agent's behavior, you can return an async output instead. This tells the agent to continue immediately without waiting for the hook to finish. In this snippet, `send_to_logging_service` in Python and `sendToLoggingService` in TypeScript stand in for any logging function you define:

<CodeGroup>
  ```python Python theme={null}
  async def async_hook(input_data, tool_use_id, context):
      # Start a background task, then return immediately
      asyncio.create_task(send_to_logging_service(input_data))
      return {"async_": True, "asyncTimeout": 30000}
  ```

  ```typescript TypeScript theme={null}
  const asyncHook: HookCallback = async (input, toolUseID, { signal }) => {
    // Start a background task, then return immediately
    sendToLoggingService(input).catch(console.error);
    return { async: true, asyncTimeout: 30000 };
  };
  ```
</CodeGroup>

| Field          | Type     | Description                                                                                                    |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `async`        | `true`   | Signals async mode. The agent proceeds without waiting. In Python, use `async_` to avoid the reserved keyword. |
| `asyncTimeout` | `number` | Optional timeout in milliseconds for the background operation                                                  |

<Note>
  Async outputs can't block, modify, or inject context into the operation since the agent has already moved on. Use them only for side effects like logging, metrics, or notifications.
</Note>

## Examples

Several examples in this section show only the callback function. To run one, register the callback under the matching event in the `hooks` field of your options, as shown in [Configure hooks](#configure-hooks).

### Modify tool input

This example intercepts Write tool calls and rewrites the `file_path` argument to prepend `/sandbox`, redirecting all file writes to a sandboxed directory. The callback returns `updatedInput` with the modified path and `permissionDecision: 'allow'` to auto-approve the rewritten operation:

<CodeGroup>
  ```python Python theme={null}
  async def redirect_to_sandbox(input_data, tool_use_id, context):
      if input_data["hook_event_name"] != "PreToolUse":
          return {}

      if input_data["tool_name"] == "Write":
          original_path = input_data["tool_input"].get("file_path", "")
          return {
              "hookSpecificOutput": {
                  "hookEventName": input_data["hook_event_name"],
                  "permissionDecision": "allow",
                  "updatedInput": {
                      **input_data["tool_input"],
                      "file_path": f"/sandbox{original_path}",
                  },
              }
          }
      return {}
  ```

  ```typescript TypeScript theme={null}
  const redirectToSandbox: HookCallback = async (input, toolUseID, { signal }) => {
    if (input.hook_event_name !== "PreToolUse") return {};

    const preInput = input as PreToolUseHookInput;
    const toolInput = preInput.tool_input as Record<string, unknown>;
    if (preInput.tool_name === "Write") {
      const originalPath = toolInput.file_path as string;
      return {
        hookSpecificOutput: {
          hookEventName: preInput.hook_event_name,
          permissionDecision: "allow",
          updatedInput: {
            ...toolInput,
            file_path: `/sandbox${originalPath}`
          }
        }
      };
    }
    return {};
  };
  ```
</CodeGroup>

<Note>
  Pair `updatedInput` with `permissionDecision: 'allow'` to auto-approve the modified input, or `permissionDecision: 'ask'` to show it to the user. If you omit `permissionDecision`, the modified input still applies and flows through the normal permission evaluation. With `'defer'`, `updatedInput` is ignored. Always return a new object rather than mutating the original `tool_input`.
</Note>

To confirm the redirect, set the prefix to a path you can write to, such as `./sandbox` or `/tmp/sandbox` (macOS doesn't allow creating a root-level `/sandbox` directory), then ask the agent to write a file: the Write tool's result in the message stream names the path with your sandbox prefix rather than the one Claude requested.
