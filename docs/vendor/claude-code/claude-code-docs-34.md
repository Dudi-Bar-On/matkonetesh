---
name: claude-code-docs-34
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 34/66 (code.claude.com)"
type: reference
---

## Next steps

Custom tools wrap async functions in a standard interface. You can mix the patterns on this page in the same server: a single server can hold a database tool, an API gateway tool, and an image renderer alongside each other.

From here:

* If your server grows to dozens of tools, see [tool search](/docs/en/agent-sdk/tool-search) to defer loading them until Claude needs them.
* To connect to external MCP servers (filesystem, GitHub, Slack) instead of building your own, see [Connect MCP servers](/docs/en/agent-sdk/mcp).
* To control which tools run automatically versus requiring approval, see [Configure permissions](/docs/en/agent-sdk/permissions).

## Related documentation

* [TypeScript SDK Reference](/docs/en/agent-sdk/typescript)
* [Python SDK Reference](/docs/en/agent-sdk/python)
* [MCP Documentation](https://modelcontextprotocol.io)
* [SDK Overview](/docs/en/agent-sdk/overview)


<!-- source: https://code.claude.com/docs/en/agent-sdk/file-checkpointing.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Rewind file changes with checkpointing

> Track file changes during agent sessions and restore files to any previous state

File checkpointing tracks file modifications made through the Write, Edit, and NotebookEdit tools during an agent session, allowing you to rewind files to any previous state. Want to try it out? Jump to the [interactive example](#try-it-out).

With checkpointing, you can:

* **Undo unwanted changes** by restoring files to a known good state
* **Explore alternatives** by restoring to a checkpoint and trying a different approach
* **Recover from errors** when the agent makes incorrect modifications

<Warning>
  Only changes made through the Write, Edit, and NotebookEdit tools are tracked. Changes made through Bash commands (like `echo > file.txt` or `sed -i`) are not captured by the checkpoint system, and neither are edits a [subagent](/docs/en/agent-sdk/subagents) applies, except a [skill with `context: fork`](/docs/en/skills#run-skills-in-a-subagent) that runs in the foreground.
</Warning>

## How checkpointing works

When you enable file checkpointing, the SDK creates backups of files before modifying them through the Write, Edit, or NotebookEdit tools. User messages in the response stream include a checkpoint UUID that you can use as a restore point.

Checkpoint works with these built-in tools that the agent uses to modify files:

| Tool         | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| Write        | Creates a new file or overwrites an existing file with new content |
| Edit         | Makes targeted edits to specific parts of an existing file         |
| NotebookEdit | Modifies cells in Jupyter notebooks (`.ipynb` files)               |

<Note>
  File rewinding restores files on disk to a previous state. It does not rewind the conversation itself. The conversation history and context remain intact after calling `rewindFiles()` (TypeScript) or `rewind_files()` (Python).
</Note>

The checkpoint system tracks:

* Files created during the session
* Files modified during the session
* The original content of modified files

When you rewind to a checkpoint, Claude Code deletes the files it created and restores the files it modified to their content at that point. {/* min-version: 2.1.216 */}Claude Code skips a tracked path that is a symlink, hard link, or other non-regular file. It also skips a tracked file whose parent directory no longer resolves to its checkpoint-time location, or whose backup it can't read safely. [`RewindFilesResult`](/docs/en/agent-sdk/typescript#rewindfilesresult) counts every skipped path in its `skippedLinks` field. Skipping requires Claude Code v2.1.216 or later; before v2.1.216, a rewind wrote and deleted through links at tracked paths.
