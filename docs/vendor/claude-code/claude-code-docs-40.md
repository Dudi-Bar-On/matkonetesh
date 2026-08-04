---
name: claude-code-docs-40
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 40/66 (code.claude.com)"
type: reference
---

## Limitations

File checkpointing has the following limitations:

| Limitation                         | Description                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write/Edit/NotebookEdit tools only | Changes made through Bash commands are not tracked                                                                                                                               |
| Subagent edits                     | Edits a [subagent](/docs/en/agent-sdk/subagents) applies aren't tracked or restored, except a skill with `context: fork` running in the foreground; use git to revert untracked edits |
| Same session                       | Checkpoints are tied to the session that created them                                                                                                                            |
| File content only                  | Creating, moving, or deleting directories is not undone by rewinding                                                                                                             |
| Local files                        | Remote or network files are not tracked                                                                                                                                          |

## Troubleshooting

### Checkpointing options not recognized

If `enableFileCheckpointing` or `rewindFiles()` isn't available, you may be on an older SDK version.

**Solution**: Update to the latest SDK version:

* **Python**: `pip install --upgrade claude-agent-sdk`
* **TypeScript**: `npm install @anthropic-ai/claude-agent-sdk@latest`

### User messages don't have UUIDs

If `message.uuid` is `undefined` or missing, you're not receiving checkpoint UUIDs.

**Cause**: The `replay-user-messages` option isn't set.

**Solution**: Add `extra_args={"replay-user-messages": None}` (Python) or `extraArgs: { 'replay-user-messages': null }` (TypeScript) to your options.

### "No file checkpoint found for message" error

This error occurs when the checkpoint data doesn't exist for the specified user message UUID.

**Common causes**:

* File checkpointing was not enabled on the original session (`enable_file_checkpointing` or `enableFileCheckpointing` was not set to `true`)
* The session wasn't properly completed before attempting to resume and rewind

**Solution**: Ensure `enable_file_checkpointing=True` (Python) or `enableFileCheckpointing: true` (TypeScript) was set on the original session, then use the pattern shown in the examples: capture the first user message UUID, complete the session fully, then resume with an empty prompt and call `rewindFiles()` once.

### "File rewinding is not enabled" error

This error occurs when you attempt a non-interactive rewind without checkpointing enabled: running bare `claude -p` with `--rewind-files`, or running an SDK session, including a resumed one, whose options don't enable checkpointing. The SDK sets the `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING` environment variable internally only when `enable_file_checkpointing` (Python) or `enableFileCheckpointing` (TypeScript) is enabled on the session performing the rewind; the bare CLI never sets it.

**Solution**: For the bare CLI, set the environment variable when running the command:

```bash theme={null}
CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true claude -p --resume <session-id> --rewind-files <checkpoint-uuid>
```

For the SDK, set `enable_file_checkpointing=True` (Python) or `enableFileCheckpointing: true` (TypeScript) on the resumed session, as the examples on this page do.

### "ProcessTransport is not ready for writing" error

This error occurs when you call `rewindFiles()` or `rewind_files()` after you've finished iterating through the response. The connection to the CLI process closes when the loop completes.

**Solution**: Resume the session with an empty prompt, then call rewind on the new query:

<CodeGroup>
  ```python Python theme={null}
  # Resume session with empty prompt, then rewind
  async with ClaudeSDKClient(
      ClaudeAgentOptions(enable_file_checkpointing=True, resume=session_id)
  ) as client:
      await client.query("")
      async for message in client.receive_response():
          if checkpoint_id:
              await client.rewind_files(checkpoint_id)
          break
  ```

  ```typescript TypeScript theme={null}
  // Resume session with empty prompt, then rewind
  const rewindQuery = query({
    prompt: "",
    options: { ...opts, resume: sessionId }
  });

  try {
    for await (const msg of rewindQuery) {
      if (checkpointId) {
        await rewindQuery.rewindFiles(checkpointId);
      }
      break;
    }
  } catch (error) {
    // An error here means the rewind didn't complete, for example the checkpoint
    // wasn't found or the session couldn't be resumed.
    console.error(`Rewind session ended with an error: ${error}`);
  }
  ```
</CodeGroup>

## Next steps

* **[Sessions](/docs/en/agent-sdk/sessions)**: learn how to resume sessions, which is required for rewinding after the stream completes. Covers session IDs, resuming conversations, and session forking.
* **[Permissions](/docs/en/agent-sdk/permissions)**: configure which tools Claude can use and how file modifications are approved. Useful if you want more control over when edits happen.
* **[TypeScript SDK reference](/docs/en/agent-sdk/typescript)**: complete API reference including all options for `query()` and the `rewindFiles()` method.
* **[Python SDK reference](/docs/en/agent-sdk/python)**: complete API reference including all options for `ClaudeAgentOptions` and the `rewind_files()` method.


<!-- source: https://code.claude.com/docs/en/agent-sdk/hooks.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Intercept and control agent behavior with hooks

> Intercept and customize agent behavior at key execution points with hooks

Hooks are callback functions that run your code in response to agent events, like a tool being called, a session starting, or execution stopping. With hooks, you can:

* **Block dangerous operations** before they execute, like destructive shell commands or unauthorized file access
* **Log and audit** every tool call for compliance, debugging, or analytics
* **Transform inputs and outputs** to sanitize data, inject credentials, or redirect file paths
* **Require human approval** for sensitive actions like database writes or API calls
* **Track session lifecycle** to manage state, clean up resources, or send notifications

This guide covers how hooks work and how to configure them, with examples for common patterns like blocking tools, modifying inputs, and forwarding notifications.
