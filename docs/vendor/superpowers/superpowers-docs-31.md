---
name: superpowers-docs-31
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 31/33 (README.md)"
type: reference
---

### Task 2: Update `using-git-worktrees` Integration section

**Files:**
- Modify: `skills/using-git-worktrees/SKILL.md:211-215` (Integration > Called by)

- [ ] **Step 1: Update the three "Called by" entries**

Change lines 212-214 from:

```markdown
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- **subagent-driven-development** - REQUIRED before executing any tasks
- **executing-plans** - REQUIRED before executing any tasks
```

To:

```markdown
- **brainstorming** - REQUIRED: Ensures isolated workspace (creates one or verifies existing)
- **subagent-driven-development** - REQUIRED: Ensures isolated workspace (creates one or verifies existing)
- **executing-plans** - REQUIRED: Ensures isolated workspace (creates one or verifies existing)
```

- [ ] **Step 2: Verify the Integration section**

Read the Integration section. Confirm all three entries are updated, "Pairs with" is unchanged.

- [ ] **Step 3: Commit**

```bash
git add skills/using-git-worktrees/SKILL.md
git commit -m "docs(using-git-worktrees): update Integration descriptions (PRI-823)

Clarify that skill ensures a workspace exists, not that it always creates one."
```

---

### Task 3: Add Step 1.5 to `finishing-a-development-branch`

**Files:**
- Modify: `skills/finishing-a-development-branch/SKILL.md:38` (insert after Step 1, before Step 2)

- [ ] **Step 1: Read the current skill file**

Read `skills/finishing-a-development-branch/SKILL.md` in full. Identify the insertion point: after "**If tests pass:** Continue to Step 2." (line 38) and before "### Step 2: Determine Base Branch" (line 40).

- [ ] **Step 2: Insert Step 1.5 section**

Insert the following between Step 1 and Step 2:

```markdown
### Step 1.5: Detect Environment

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Path A — `GIT_DIR` differs from `GIT_COMMON` AND `BRANCH` is empty (externally managed worktree, detached HEAD):**

First, ensure all work is staged and committed (`git add` + `git commit`).

Then present this to the user (do NOT present the 4-option menu):

```
Implementation complete. All tests passing.
Current HEAD: <full-commit-sha>

This workspace is externally managed (detached HEAD).
I cannot create branches, push, or open PRs from here.

⚠ These commits are on a detached HEAD. If you do not create a branch,
they may be lost when this workspace is cleaned up.

If your host application provides these controls:
- "Create branch" — to name a branch, then commit/push/PR
- "Hand off to local" — to move changes to your local checkout

Suggested branch name: <ticket-id/short-description>
Suggested commit message: <summary-of-work>
```

Branch name: use ticket ID if available (e.g., `pri-823/codex-compat`), otherwise slugify the first 5 words of the plan title, otherwise omit. Avoid sensitive content in branch names.

Skip to Step 5 (cleanup is a no-op — see guard below).

**Path B — `GIT_DIR` differs from `GIT_COMMON` AND `BRANCH` exists (externally managed worktree, named branch):**

Proceed to Step 2 and present the 4-option menu as normal.

**Path C — `GIT_DIR` equals `GIT_COMMON` (normal environment):**

Proceed to Step 2 and present the 4-option menu as normal.
```

- [ ] **Step 3: Verify the insertion**

Read the file again. Confirm:
- Step 1.5 appears between Step 1 and Step 2
- Steps 2-5 are unchanged
- Path A handoff includes commit SHA and data loss warning
- Paths B and C proceed to Step 2 normally

- [ ] **Step 4: Commit**

```bash
git add skills/finishing-a-development-branch/SKILL.md
git commit -m "feat(finishing-a-development-branch): add Step 1.5 environment detection (PRI-823)

Detect externally managed worktrees with detached HEAD and emit handoff
payload instead of 4-option menu. Includes commit SHA and data loss warning."
```

---

### Task 4: Add Step 5 cleanup guard to `finishing-a-development-branch`

**Files:**
- Modify: `skills/finishing-a-development-branch/SKILL.md` (Step 5: Cleanup Worktree — find by section heading, line numbers will have shifted after Task 3)

- [ ] **Step 1: Read the current Step 5 section**

Find the "### Step 5: Cleanup Worktree" section in `skills/finishing-a-development-branch/SKILL.md` (line numbers will have shifted after Task 3's insertion). The current Step 5 is:

```markdown
### Step 5: Cleanup Worktree

**For Options 1, 2, 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.
```

- [ ] **Step 2: Add the cleanup guard before existing logic**

Replace the Step 5 section with:

```markdown
### Step 5: Cleanup Worktree

**First, check if worktree is externally managed:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

If `GIT_DIR` differs from `GIT_COMMON`: skip worktree removal — the host environment owns this workspace.

**Otherwise, for Options 1 and 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.
```

Note: the original text said "For Options 1, 2, 4" but the Quick Reference table and Common Mistakes section say "Options 1 & 4 only." This edit aligns Step 5 with those sections.

- [ ] **Step 3: Verify the replacement**

Read Step 5. Confirm:
- Cleanup guard (re-detection) appears first
- Existing removal logic preserved for non-externally-managed worktrees
- "Options 1 and 4" (not "1, 2, 4") matches Quick Reference and Common Mistakes

- [ ] **Step 4: Commit**

```bash
git add skills/finishing-a-development-branch/SKILL.md
git commit -m "feat(finishing-a-development-branch): add Step 5 cleanup guard (PRI-823)

Re-detect externally managed worktree at cleanup time and skip removal.
Also fixes pre-existing inconsistency: cleanup now correctly says
Options 1 and 4 only, matching Quick Reference and Common Mistakes."
```

---
