---
name: superpowers-docs-30
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 30/33 (README.md)"
type: reference
---

## Chunk 3: Swap and Cleanup

### Task 3: Update start-server.sh and remove old files

**Files:**
- Modify: `skills/brainstorming/scripts/start-server.sh:94,100`
- Modify: `.gitignore:6`
- Delete: `skills/brainstorming/scripts/index.js`
- Delete: `skills/brainstorming/scripts/package.json`
- Delete: `skills/brainstorming/scripts/package-lock.json`
- Delete: `skills/brainstorming/scripts/node_modules/` (entire directory)

- [ ] **Step 1: Update start-server.sh — change `index.js` to `server.js`**

Two lines to change:

Line 94: `env BRAINSTORM_DIR="$SCREEN_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" node server.js`

Line 100: `nohup env BRAINSTORM_DIR="$SCREEN_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" node server.js > "$LOG_FILE" 2>&1 &`

- [ ] **Step 2: Remove the gitignore exception for node_modules**

In `.gitignore`, delete line 6: `!skills/brainstorming/scripts/node_modules/`

- [ ] **Step 3: Delete old files**

```bash
git rm skills/brainstorming/scripts/index.js
git rm skills/brainstorming/scripts/package.json
git rm skills/brainstorming/scripts/package-lock.json
git rm -r skills/brainstorming/scripts/node_modules/
```

- [ ] **Step 4: Run both test suites**

Run: `cd tests/brainstorm-server && node ws-protocol.test.js && node server.test.js`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add skills/brainstorming/scripts/ .gitignore
git commit -m "Remove vendored node_modules, swap to zero-dep server.js"
```

### Task 4: Manual smoke test

- [ ] **Step 1: Start the server manually**

```bash
cd skills/brainstorming/scripts
BRAINSTORM_DIR=/tmp/brainstorm-smoke BRAINSTORM_PORT=9876 node server.js
```

Expected: `server-started` JSON printed with port 9876

- [ ] **Step 2: Open browser to http://localhost:9876**

Expected: Waiting page with "Waiting for Claude to push a screen..."

- [ ] **Step 3: Write an HTML file to the screen directory**

```bash
echo '<h2>Hello from smoke test</h2>' > /tmp/brainstorm-smoke/test.html
```

Expected: Browser reloads and shows "Hello from smoke test" wrapped in frame template

- [ ] **Step 4: Verify WebSocket works — check browser console**

Open browser dev tools. The WebSocket connection should show as connected (no errors in console). The frame template's status indicator should show "Connected".

- [ ] **Step 5: Stop server with Ctrl-C, clean up**

```bash
rm -rf /tmp/brainstorm-smoke
```


<!-- source: docs/superpowers/plans/2026-03-23-codex-app-compatibility.md -->

# Codex App Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `using-git-worktrees`, `finishing-a-development-branch`, and related skills work in the Codex App's sandboxed worktree environment without breaking existing behavior.

**Architecture:** Read-only environment detection (`git-dir` vs `git-common-dir`) at the start of two skills. If already in a linked worktree, skip creation. If on detached HEAD, emit a handoff payload instead of the 4-option menu. Sandbox fallback catches permission errors during worktree creation.

**Tech Stack:** Git, Markdown (skill files are instruction documents, not executable code)

**Spec:** `docs/superpowers/specs/2026-03-23-codex-app-compatibility-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `skills/using-git-worktrees/SKILL.md` | Worktree creation + isolation | Add Step 0 detection + sandbox fallback |
| `skills/finishing-a-development-branch/SKILL.md` | Branch finishing workflow | Add Step 1.5 detection + cleanup guard |
| `skills/subagent-driven-development/SKILL.md` | Plan execution with subagents | Update Integration description |
| `skills/executing-plans/SKILL.md` | Plan execution inline | Update Integration description |
| `skills/using-superpowers/references/codex-tools.md` | Codex platform reference | Add detection + finishing docs |

---

### Task 1: Add Step 0 to `using-git-worktrees`

**Files:**
- Modify: `skills/using-git-worktrees/SKILL.md:14-15` (insert after Overview, before Directory Selection Process)

- [ ] **Step 1: Read the current skill file**

Read `skills/using-git-worktrees/SKILL.md` in full. Identify the exact insertion point: after the "Announce at start" line (line 14) and before "## Directory Selection Process" (line 16).

- [ ] **Step 2: Insert Step 0 section**

Insert the following between the Overview section and "## Directory Selection Process":

```markdown
## Step 0: Check if Already in an Isolated Workspace

Before creating a worktree, check if one already exists:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**If `GIT_DIR` differs from `GIT_COMMON`:** You are already inside a linked worktree (created by the Codex App, Claude Code's Agent tool, a previous skill run, or the user). Do NOT create another worktree. Instead:

1. Run project setup (auto-detect package manager as in "Run Project Setup" below)
2. Verify clean baseline (run tests as in "Verify Clean Baseline" below)
3. Report with branch state:
   - On a branch: "Already in an isolated workspace at `<path>` on branch `<name>`. Tests passing. Ready to implement."
   - Detached HEAD: "Already in an isolated workspace at `<path>` (detached HEAD, externally managed). Tests passing. Note: branch creation needed at finish time. Ready to implement."

After reporting, STOP. Do not continue to Directory Selection or Creation Steps.

**If `GIT_DIR` equals `GIT_COMMON`:** Proceed with the full worktree creation flow below.

**Sandbox fallback:** If you proceed to Creation Steps but `git worktree add -b` fails with a permission error (e.g., "Operation not permitted"), treat this as a late-detected restricted environment. Fall back to the behavior above — run setup and baseline tests in the current directory, report accordingly, and STOP.
```

- [ ] **Step 3: Verify the insertion**

Read the file again. Confirm:
- Step 0 appears between Overview and Directory Selection Process
- The rest of the file (Directory Selection, Safety Verification, Creation Steps, etc.) is unchanged
- No duplicate sections or broken markdown

- [ ] **Step 4: Commit**

```bash
git add skills/using-git-worktrees/SKILL.md
git commit -m "feat(using-git-worktrees): add Step 0 environment detection (PRI-823)

Skip worktree creation when already in a linked worktree. Includes
sandbox fallback for permission errors on git worktree add."
```

---
