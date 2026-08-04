---
name: claude-code-docs-36
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 36/66 (code.claude.com)"
type: reference
---

for await (const message of response) {
        // Capture the first user message UUID as the checkpoint
        if (message.type === "user" && message.uuid && !checkpointId) {
          checkpointId = message.uuid;
        }
        // Capture session ID from any message that has it
        if ("session_id" in message) {
          sessionId = message.session_id;
        }
      }
      ```
    </CodeGroup>
  </Step>

  <Step title="Rewind files">
    To rewind after the stream completes, resume the session with an empty prompt and call `rewind_files()` (Python) or `rewindFiles()` (TypeScript) with your checkpoint UUID. You can also rewind during the stream; see [Checkpoint before risky operations](#checkpoint-before-risky-operations) for that pattern.

    <CodeGroup>
      ```python Python theme={null}
      async with ClaudeSDKClient(
          ClaudeAgentOptions(enable_file_checkpointing=True, resume=session_id)
      ) as client:
          await client.query("")  # Empty prompt to open the connection
          async for message in client.receive_response():
              if checkpoint_id:
                  await client.rewind_files(checkpoint_id)
              break
      ```

      ```typescript TypeScript theme={null}
      const rewindQuery = query({
        prompt: "", // Empty prompt to open the connection
        options: { ...opts, resume: sessionId }
      });

      for await (const msg of rewindQuery) {
        if (checkpointId) {
          await rewindQuery.rewindFiles(checkpointId);
        }
        break;
      }
      ```
    </CodeGroup>

    If you capture the session ID and checkpoint ID, you can also rewind from the CLI. This command requires the `claude` executable, which comes from [installing Claude Code](/docs/en/setup) and is not installed by the SDK package. The SDK enables checkpointing for you, but when you run `claude -p` directly you must set the `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING` environment variable:

    ```bash theme={null}
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true claude -p --resume <session-id> --rewind-files <checkpoint-uuid>
    ```

    The `--rewind-files` flag does not appear in `claude --help` output, but the CLI accepts it as shown.
  </Step>
</Steps>
