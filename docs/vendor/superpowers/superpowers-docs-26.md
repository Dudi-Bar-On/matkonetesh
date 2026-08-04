---
name: superpowers-docs-26
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 26/33 (README.md)"
type: reference
---

## The Loop

1. **Write HTML** to a new file in `screen_dir`:
   - Use semantic filenames: `platform.html`, `visual-style.html`, `layout.html`
   - **Never reuse filenames** — each screen gets a fresh file
   - Use Write tool — **never use cat/heredoc** (dumps noise into terminal)
   - Server automatically serves the newest file

2. **Tell user what to expect and end your turn:**
   - Remind them of the URL (every step, not just first)
   - Give a brief text summary of what's on screen (e.g., "Showing 3 layout options for the homepage")
   - Ask them to respond in the terminal: "Take a look and let me know what you think. Click to select an option if you'd like."

3. **On your next turn** — after the user responds in the terminal:
   - Read `$SCREEN_DIR/.events` if it exists — this contains the user's browser interactions (clicks, selections) as JSON lines
   - Merge with the user's terminal text to get the full picture
   - The terminal message is the primary feedback; `.events` provides structured interaction data

4. **Iterate or advance** — if feedback changes current screen, write a new file (e.g., `layout-v2.html`). Only move to the next question when the current step is validated.

5. Repeat until done.
```

- [ ] **Step 4: Replace "User Feedback Format" section (lines 165-174)**

Replace with:

```markdown
## Browser Events Format

When the user clicks options in the browser, their interactions are recorded to `$SCREEN_DIR/.events` (one JSON object per line). The file is cleared automatically when you push a new screen.

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
{"type":"click","choice":"b","text":"Option B - Hybrid","timestamp":1706000115}
```

The full event stream shows the user's exploration path — they may click multiple options before settling. The last `choice` event is typically the final selection, but the pattern of clicks can reveal hesitation or preferences worth asking about.

If `.events` doesn't exist, the user didn't interact with the browser — use only their terminal text.
```

- [ ] **Step 5: Update "Writing Content Fragments" description (line 65)**

Remove "feedback footer" reference:

```markdown
Write just the content that goes inside the page. The server wraps it in the frame template automatically (header, theme CSS, selection indicator, and all interactive infrastructure).
```

- [ ] **Step 6: Update Reference section (lines 200-203)**

Remove the helper.js reference description about "JS API" — the API is now minimal. Keep the path reference:

```markdown
## Reference

- Frame template (CSS reference): `${CLAUDE_PLUGIN_ROOT}/lib/brainstorm-server/frame-template.html`
- Helper script (client-side): `${CLAUDE_PLUGIN_ROOT}/lib/brainstorm-server/helper.js`
```

- [ ] **Step 7: Commit**

```bash
git add skills/brainstorming/visual-companion.md
git commit -m "Rewrite visual-companion.md for non-blocking browser-displays-terminal-commands flow"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/drewritter/prime-rad/superpowers && node tests/brainstorm-server/server.test.js
```
Expected: ALL tests PASS.

- [ ] **Step 2: Manual smoke test**

Start the server manually and verify the flow works end-to-end:

```bash
cd /Users/drewritter/prime-rad/superpowers && lib/brainstorm-server/start-server.sh --project-dir /tmp/brainstorm-smoke-test
```

Write a test fragment, open in browser, click an option, verify `.events` file is written, verify indicator bar updates. Then stop the server:

```bash
lib/brainstorm-server/stop-server.sh <screen_dir from start output>
```

- [ ] **Step 3: Verify no stale references remain**

```bash
grep -r "wait-for-feedback\|sendToClaude\|feedback-footer\|send-to-claude\|TaskOutput.*block.*true" /Users/drewritter/prime-rad/superpowers/ --include="*.js" --include="*.md" --include="*.sh" --include="*.html" | grep -v node_modules | grep -v RELEASE-NOTES | grep -v "\.md:.*spec\|plan"
```

Expected: No hits outside of release notes and the spec/plan docs (which are historical).

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git status
# Review untracked/modified files, stage specific files as needed, commit if clean
```


<!-- source: docs/superpowers/plans/2026-03-11-zero-dep-brainstorm-server.md -->

# Zero-Dependency Brainstorm Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brainstorm server's vendored node_modules with a single zero-dependency `server.js` using Node built-ins.

**Architecture:** Single file with WebSocket protocol (RFC 6455 text frames), HTTP server (`http` module), and file watching (`fs.watch`). Exports protocol functions for unit testing when required as a module.

**Tech Stack:** Node.js built-ins only: `http`, `crypto`, `fs`, `path`

**Spec:** `docs/superpowers/specs/2026-03-11-zero-dep-brainstorm-server-design.md`

**Existing tests:** `tests/brainstorm-server/ws-protocol.test.js` (unit), `tests/brainstorm-server/server.test.js` (integration)

---

## File Map

- **Create:** `skills/brainstorming/scripts/server.js` — the zero-dep replacement
- **Modify:** `skills/brainstorming/scripts/start-server.sh:94,100` — change `index.js` to `server.js`
- **Modify:** `.gitignore:6` — remove the `!skills/brainstorming/scripts/node_modules/` exception
- **Delete:** `skills/brainstorming/scripts/index.js`
- **Delete:** `skills/brainstorming/scripts/package.json`
- **Delete:** `skills/brainstorming/scripts/package-lock.json`
- **Delete:** `skills/brainstorming/scripts/node_modules/` (714 files)
- **No changes:** `skills/brainstorming/scripts/helper.js`, `skills/brainstorming/scripts/frame-template.html`, `skills/brainstorming/scripts/stop-server.sh`

---

## Chunk 1: WebSocket Protocol Layer
