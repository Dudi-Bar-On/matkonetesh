---
name: claude-code-docs-37
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 37/66 (code.claude.com)"
type: reference
---

## Common patterns

These patterns show different ways to capture and use checkpoint UUIDs depending on your use case.

### Checkpoint before risky operations

This pattern keeps only the most recent checkpoint UUID, updating it before each agent turn. If something goes wrong during processing, you can immediately rewind to the last safe state and break out of the loop.

Before running this example, replace `your_revert_condition` (Python) or `yourRevertCondition` (TypeScript) with your own check, such as error detection or a validation failure; the placeholder is not defined in the example.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, UserMessage


  async def main():
      options = ClaudeAgentOptions(
          enable_file_checkpointing=True,
          permission_mode="acceptEdits",
          extra_args={"replay-user-messages": None},
      )

      safe_checkpoint = None

      async with ClaudeSDKClient(options) as client:
          await client.query("Refactor the authentication module")

          async for message in client.receive_response():
              # Update checkpoint before each agent turn starts
              # This overwrites the previous checkpoint. Only keep the latest
              if isinstance(message, UserMessage) and message.uuid:
                  safe_checkpoint = message.uuid

              # Decide when to revert based on your own logic
              # For example: error detection, validation failure, or user input
              if your_revert_condition and safe_checkpoint:
                  await client.rewind_files(safe_checkpoint)
                  # Exit the loop after rewinding, files are restored
                  break


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  async function main() {
    const response = query({
      prompt: "Refactor the authentication module",
      options: {
        enableFileCheckpointing: true,
        permissionMode: "acceptEdits" as const,
        extraArgs: { "replay-user-messages": null }
      }
    });

    let safeCheckpoint: string | undefined;

    for await (const message of response) {
      // Update checkpoint before each agent turn starts
      // This overwrites the previous checkpoint. Only keep the latest
      if (message.type === "user" && message.uuid) {
        safeCheckpoint = message.uuid;
      }

      // Decide when to revert based on your own logic
      // For example: error detection, validation failure, or user input
      if (yourRevertCondition && safeCheckpoint) {
        await response.rewindFiles(safeCheckpoint);
        // Exit the loop after rewinding, files are restored
        break;
      }
    }
  }

  main();
  ```
</CodeGroup>

### Multiple restore points

If Claude makes changes across multiple turns, you might want to rewind to a specific point rather than all the way back. For example, if Claude refactors a file in turn one and adds tests in turn two, you might want to keep the refactor but undo the tests.

This pattern stores all checkpoint UUIDs in an array with metadata. After the session completes, you can rewind to any previous checkpoint:

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from dataclasses import dataclass
  from datetime import datetime
  from claude_agent_sdk import (
      ClaudeSDKClient,
      ClaudeAgentOptions,
      UserMessage,
      ResultMessage,
  )


  # Store checkpoint metadata for better tracking
  @dataclass
  class Checkpoint:
      id: str
      description: str
      timestamp: datetime


  async def main():
      options = ClaudeAgentOptions(
          enable_file_checkpointing=True,
          permission_mode="acceptEdits",
          extra_args={"replay-user-messages": None},
      )

      checkpoints = []
      session_id = None

      async with ClaudeSDKClient(options) as client:
          await client.query("Refactor the authentication module")

          async for message in client.receive_response():
              if isinstance(message, UserMessage) and message.uuid:
                  checkpoints.append(
                      Checkpoint(
                          id=message.uuid,
                          description=f"After turn {len(checkpoints) + 1}",
                          timestamp=datetime.now(),
                      )
                  )
              if isinstance(message, ResultMessage) and not session_id:
                  session_id = message.session_id

      # Later: rewind to any checkpoint by resuming the session
      if checkpoints and session_id:
          target = checkpoints[0]  # Pick any checkpoint
          async with ClaudeSDKClient(
              ClaudeAgentOptions(enable_file_checkpointing=True, resume=session_id)
          ) as client:
              await client.query("")  # Empty prompt to open the connection
              async for message in client.receive_response():
                  await client.rewind_files(target.id)
                  break
          print(f"Rewound to: {target.description}")


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Store checkpoint metadata for better tracking
  interface Checkpoint {
    id: string;
    description: string;
    timestamp: Date;
  }

  async function main() {
    const opts = {
      enableFileCheckpointing: true,
      permissionMode: "acceptEdits" as const,
      extraArgs: { "replay-user-messages": null }
    };

    const response = query({
      prompt: "Refactor the authentication module",
      options: opts
    });

    const checkpoints: Checkpoint[] = [];
    let sessionId: string | undefined;

    try {
      for await (const message of response) {
        if (message.type === "user" && message.uuid) {
          checkpoints.push({
            id: message.uuid,
            description: `After turn ${checkpoints.length + 1}`,
            timestamp: new Date()
          });
        }
        if ("session_id" in message && !sessionId) {
          sessionId = message.session_id;
        }
      }
    } catch (error) {
      // A single-shot query() throws after yielding an error result. If the
      // failure was an error result, sessionId and the checkpoints array were
      // already populated by the loop above; connection or process failures
      // yield no result message.
      console.error(`Session ended with an error: ${error}`);
    }

    // Later: rewind to any checkpoint by resuming the session
    if (checkpoints.length > 0 && sessionId) {
      const target = checkpoints[0]; // Pick any checkpoint
      const rewindQuery = query({
        prompt: "", // Empty prompt to open the connection
        options: { ...opts, resume: sessionId }
      });

      for await (const msg of rewindQuery) {
        await rewindQuery.rewindFiles(target.id);
        break;
      }
      console.log(`Rewound to: ${target.description}`);
    }
  }

  main();
  ```
</CodeGroup>
