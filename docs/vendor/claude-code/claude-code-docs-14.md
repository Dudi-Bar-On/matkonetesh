---
name: claude-code-docs-14
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 14/66 (code.claude.com)"
type: reference
---

### Handle messages

Which messages you handle depends on what you're building:

* **Final results only:** handle `ResultMessage` to get the output, cost, and whether the task succeeded or hit a limit.
* **Progress updates:** handle `AssistantMessage` to see what Claude is doing each turn, including which tools it called.
* **Live streaming:** enable partial messages (`include_partial_messages` in Python, `includePartialMessages` in TypeScript) to get `StreamEvent` messages in real time. See [Stream responses in real-time](/docs/en/agent-sdk/streaming-output).

How you check message types depends on the SDK:

* **Python:** check message types with `isinstance()` against classes imported from `claude_agent_sdk` (for example, `isinstance(message, ResultMessage)`).
* **TypeScript:** check the `type` string field (for example, `message.type === "result"`). `AssistantMessage` and `UserMessage` wrap the raw API message in a `.message` field, so content blocks are at `message.message.content`, not `message.content`.

<Accordion title="Example: Check message types and handle results">
  <CodeGroup>
    ```python Python theme={null}
    import asyncio
    from claude_agent_sdk import query, AssistantMessage, ResultMessage


    async def main():
        try:
            async for message in query(prompt="Summarize this project"):
                if isinstance(message, AssistantMessage):
                    print(f"Turn completed: {len(message.content)} content blocks")
                if isinstance(message, ResultMessage):
                    if message.subtype == "success":
                        print(message.result)
                    else:
                        print(f"Stopped: {message.subtype}")
        except Exception as error:
            # A single-shot query() raises after yielding an error result. If the
            # failure was an error result, the error subtype branches above have
            # already run; connection or process failures yield no result message.
            print(f"Session ended with an error: {error}")


    asyncio.run(main())
    ```

    ```typescript TypeScript theme={null}
    import { query } from "@anthropic-ai/claude-agent-sdk";

    try {
      for await (const message of query({ prompt: "Summarize this project" })) {
        if (message.type === "assistant") {
          console.log(`Turn completed: ${message.message.content.length} content blocks`);
        }
        if (message.type === "result") {
          if (message.subtype === "success") {
            console.log(message.result);
          } else {
            console.log(`Stopped: ${message.subtype}`);
          }
        }
      }
    } catch (error) {
      // A single-shot query() throws after yielding an error result. If the
      // failure was an error result, the error subtype branches above have
      // already run; connection or process failures yield no result message.
      console.log(`Session ended with an error: ${error}`);
    }
    ```
  </CodeGroup>
</Accordion>

## Tool execution

Tools give your agent the ability to take action. Without tools, Claude can only respond with text. With tools, Claude can read files, run commands, search code, and interact with external services.

### Built-in tools

The SDK includes the same tools that power Claude Code:

| Category            | Tools                                                           | What they do                                                                |
| :------------------ | :-------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **File operations** | `Read`, `Edit`, `Write`                                         | Read, modify, and create files                                              |
| **Search**          | `Glob`, `Grep`                                                  | Find files by pattern, search content with regex                            |
| **Execution**       | `Bash`                                                          | Run shell commands, scripts, git operations                                 |
| **Web**             | `WebSearch`, `WebFetch`                                         | Search the web, fetch and parse pages                                       |
| **Discovery**       | `ToolSearch`                                                    | Dynamically find and load tools on-demand instead of preloading all of them |
| **Orchestration**   | `Agent`, `Skill`, `AskUserQuestion`, `TaskCreate`, `TaskUpdate` | Spawn subagents, invoke skills, ask the user, track tasks                   |

Beyond built-in tools, you can:

* **Connect external services** with [MCP servers](/docs/en/agent-sdk/mcp) (databases, browsers, APIs)
* **Define custom tools** with [custom tool handlers](/docs/en/agent-sdk/custom-tools)
* **Load project skills** via [setting sources](/docs/en/agent-sdk/claude-code-features) for reusable workflows

### Tool permissions

Claude determines which tools to call based on the task, but you control whether those calls are allowed to execute. You can auto-approve specific tools, block others entirely, or require approval for everything. Three options work together to determine what runs:

* **`allowed_tools` / `allowedTools`** auto-approves listed tools. A read-only agent with `["Read", "Glob", "Grep"]` in its allowed tools list runs those tools without prompting. Tools not listed are still available but require permission.
* **`disallowed_tools` / `disallowedTools`** blocks listed tools, regardless of other settings. See [Permissions](/docs/en/agent-sdk/permissions) for the order that rules are checked before a tool runs.
* **`permission_mode` / `permissionMode`** controls what happens to tools that aren't covered by allow or deny rules. See [Permission mode](#permission-mode) for available modes.

You can also scope individual tools with rules like `"Bash(npm *)"` to allow only specific commands. See [Permissions](/docs/en/agent-sdk/permissions) for the full rule syntax.

When a tool is denied, Claude receives a rejection message as the tool result and typically attempts a different approach or reports that it couldn't proceed.

### Parallel tool execution

When Claude requests multiple tool calls in a single turn, both SDKs can run them concurrently or sequentially depending on the tool. Read-only tools (like `Read`, `Glob`, `Grep`, and MCP tools marked as read-only) can run concurrently. Tools that modify state (like `Edit`, `Write`, and `Bash`) run sequentially to avoid conflicts.

Custom tools default to sequential execution. To enable parallel execution for a custom tool, set `readOnlyHint` in its annotations. Both the [TypeScript](/docs/en/agent-sdk/typescript#tool) and [Python](/docs/en/agent-sdk/python#tool) SDKs use this field name from the MCP SDK.

## Control how the loop runs

You can limit how many turns the loop takes, how much it costs, how deeply Claude reasons, and whether tools require approval before running. All of these are fields on [`ClaudeAgentOptions`](/docs/en/agent-sdk/python#claudeagentoptions) (Python) / [`Options`](/docs/en/agent-sdk/typescript#options) (TypeScript).
