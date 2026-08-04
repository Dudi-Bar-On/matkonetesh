---
name: claude-code-docs-19
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 19/66 (code.claude.com)"
type: reference
---

## Hooks

[Hooks](/docs/en/agent-sdk/hooks) are callbacks that fire at specific points in the loop: before a tool runs, after it returns, when the agent finishes, and so on. Some commonly used hooks are:

| Hook                             | When it fires                       | Common uses                                |
| :------------------------------- | :---------------------------------- | :----------------------------------------- |
| `PreToolUse`                     | Before a tool executes              | Validate inputs, block dangerous commands  |
| `PostToolUse`                    | After a tool returns                | Audit outputs, trigger side effects        |
| `UserPromptSubmit`               | When a prompt is sent               | Inject additional context into prompts     |
| `Stop`                           | When the agent finishes             | Validate the result, save session state    |
| `SubagentStart` / `SubagentStop` | When a subagent spawns or completes | Track and aggregate parallel task results  |
| `PreCompact`                     | Before context compaction           | Archive full transcript before summarizing |

Hooks run in your application process, not inside the agent's context window, so they don't consume context. Hooks can also short-circuit the loop: a `PreToolUse` hook that rejects a tool call prevents it from executing, and Claude receives the rejection message instead.

Both SDKs support all the events above. The TypeScript SDK includes additional events that Python does not yet support. See [Control execution with hooks](/docs/en/agent-sdk/hooks) for the complete event list, per-SDK availability, and the full callback API.

## Put it all together

This example combines the key concepts from this page into a single agent that fixes failing tests. It configures the agent with allowed tools (auto-approved so the agent runs autonomously), project settings, and safety limits on turns and reasoning effort. As the loop runs, it captures the session ID for potential resumption, handles the final result, and prints the total cost.

Because a single-shot `query()` call raises after yielding an error result, the loop is wrapped in a try block so the script exits cleanly when a limit is hit.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def run_agent():
      session_id = None

      try:
          async for message in query(
              prompt="Find and fix the bug causing test failures in the auth module",
              options=ClaudeAgentOptions(
                  allowed_tools=[
                      "Read",
                      "Edit",
                      "Bash",
                      "Glob",
                      "Grep",
                  ],  # Listing tools here auto-approves them (no prompting)
                  setting_sources=[
                      "project"
                  ],  # Load CLAUDE.md, skills, hooks from current directory
                  max_turns=30,  # Prevent runaway sessions
                  effort="high",  # Thorough reasoning for complex debugging
              ),
          ):
              # Handle the final result
              if isinstance(message, ResultMessage):
                  session_id = message.session_id  # Save for potential resumption

                  if message.subtype == "success":
                      print(f"Done: {message.result}")
                  elif message.subtype == "error_max_turns":
                      # Agent ran out of turns. Resume with a higher limit.
                      print(f"Hit turn limit. Resume session {session_id} to continue.")
                  elif message.subtype == "error_max_budget_usd":
                      print("Hit budget limit.")
                  else:
                      print(f"Stopped: {message.subtype}")
                  if message.total_cost_usd is not None:
                      print(f"Cost: ${message.total_cost_usd:.4f}")
      except Exception as error:
          # A single-shot query() raises after yielding an error result. If the
          # failure was an error result, the error subtype branches above have
          # already run; connection or process failures yield no result message.
          print(f"Session ended with an error: {error}")


  asyncio.run(run_agent())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  let sessionId: string | undefined;

  try {
    for await (const message of query({
      prompt: "Find and fix the bug causing test failures in the auth module",
      options: {
        allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"], // Listing tools here auto-approves them (no prompting)
        settingSources: ["project"], // Load CLAUDE.md, skills, hooks from current directory
        maxTurns: 30, // Prevent runaway sessions
        effort: "high" // Thorough reasoning for complex debugging
      }
    })) {
      // Save the session ID to resume later if needed
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
      }

      // Handle the final result
      if (message.type === "result") {
        if (message.subtype === "success") {
          console.log(`Done: ${message.result}`);
        } else if (message.subtype === "error_max_turns") {
          // Agent ran out of turns. Resume with a higher limit.
          console.log(`Hit turn limit. Resume session ${sessionId} to continue.`);
        } else if (message.subtype === "error_max_budget_usd") {
          console.log("Hit budget limit.");
        } else {
          console.log(`Stopped: ${message.subtype}`);
        }
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
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

When the agent finishes successfully, the example prints a `Done:` line with the agent's summary of the fix, then a line like `Cost: $0.0312`.
