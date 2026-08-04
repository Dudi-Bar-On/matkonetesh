---
name: claude-code-docs-39
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 39/66 (code.claude.com)"
type: reference
---

This example demonstrates the complete checkpointing workflow:

    1. **Enable checkpointing**: configure the SDK with `enable_file_checkpointing=True` and `permission_mode="acceptEdits"` to auto-approve file edits
    2. **Capture checkpoint data**: as the agent runs, store the first user message UUID (your restore point) and the session ID
    3. **Prompt for rewind**: after the agent finishes, check your utility file to see the doc comments, then decide if you want to undo the changes
    4. **Resume and rewind**: if yes, resume the session with an empty prompt and call `rewind_files()` to restore the original file
  </Step>

  <Step title="Run the example">
    Run the script from the same directory as your utility file.

    <Tip>
      Open your utility file (`utils.py` or `utils.ts`) in your IDE or editor before running the script. You'll see the file update in real-time as the agent adds doc comments, then revert back to the original when you choose to rewind.
    </Tip>

    <Tabs>
      <Tab title="Python">
        ```bash theme={null}
        python try_checkpointing.py
        ```
      </Tab>

      <Tab title="TypeScript">
        ```bash theme={null}
        npx tsx try_checkpointing.ts
        ```
      </Tab>
    </Tabs>

    You'll see the agent add doc comments, then a prompt asking if you want to rewind. If you choose yes, the file is restored to its original state.
  </Step>
</Steps>
