---
name: superpowers-docs-32
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 32/33 (README.md)"
type: reference
---

### Task 5: Update Integration lines in `subagent-driven-development` and `executing-plans`

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md:268`
- Modify: `skills/executing-plans/SKILL.md:68`

- [ ] **Step 1: Update `subagent-driven-development`**

Change line 268 from:
```
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
```
To:
```
- **superpowers:using-git-worktrees** - REQUIRED: Ensures isolated workspace (creates one or verifies existing)
```

- [ ] **Step 2: Update `executing-plans`**

Change line 68 from:
```
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
```
To:
```
- **superpowers:using-git-worktrees** - REQUIRED: Ensures isolated workspace (creates one or verifies existing)
```

- [ ] **Step 3: Verify both files**

Read line 268 of `skills/subagent-driven-development/SKILL.md` and line 68 of `skills/executing-plans/SKILL.md`. Confirm both say "Ensures isolated workspace (creates one or verifies existing)".

- [ ] **Step 4: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md skills/executing-plans/SKILL.md
git commit -m "docs(sdd, executing-plans): update worktree Integration descriptions (PRI-823)

Clarify that using-git-worktrees ensures a workspace exists rather than
always creating one."
```

---

### Task 6: Add environment detection docs to `codex-tools.md`

**Files:**
- Modify: `skills/using-superpowers/references/codex-tools.md:25` (append at end)

- [ ] **Step 1: Read the current file**

Read `skills/using-superpowers/references/codex-tools.md` in full. Confirm it ends at line 25-26 after the multi_agent section.

- [ ] **Step 2: Append two new sections**

Add at the end of the file:

```markdown

## Environment Detection

Skills that create worktrees or finish branches should detect their
environment with read-only git commands before proceeding:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- `GIT_DIR != GIT_COMMON` → already in a linked worktree (skip creation)
- `BRANCH` empty → detached HEAD (cannot branch/push/PR from sandbox)

See `using-git-worktrees` Step 0 and `finishing-a-development-branch`
Step 1.5 for how each skill uses these signals.

## Codex App Finishing

When the sandbox blocks branch/push operations (detached HEAD in an
externally managed worktree), the agent commits all work and informs
the user to use the App's native controls:

- **"Create branch"** — names the branch, then commit/push/PR via App UI
- **"Hand off to local"** — transfers work to the user's local checkout

The agent can still run tests, stage files, and output suggested branch
names, commit messages, and PR descriptions for the user to copy.
```

- [ ] **Step 3: Verify the additions**

Read the full file. Confirm:
- Two new sections appear after the existing content
- Bash code block renders correctly (not escaped)
- Cross-references to Step 0 and Step 1.5 are present

- [ ] **Step 4: Commit**

```bash
git add skills/using-superpowers/references/codex-tools.md
git commit -m "docs(codex-tools): add environment detection and App finishing docs (PRI-823)

Document the git-dir vs git-common-dir detection pattern and the Codex
App's native finishing flow for skills that need to adapt."
```

---

### Task 7: Automated test — environment detection

**Files:**
- Create: `tests/codex-app-compat/test-environment-detection.sh`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p tests/codex-app-compat
```

- [ ] **Step 2: Write the detection test script**

Create `tests/codex-app-compat/test-environment-detection.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Test environment detection logic from PRI-823
# Tests the git-dir vs git-common-dir comparison used by
# using-git-worktrees Step 0 and finishing-a-development-branch Step 1.5

PASS=0
FAIL=0
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Helper: run detection and return "linked" or "normal"
detect_worktree() {
  local git_dir git_common
  git_dir=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
  git_common=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
  if [ "$git_dir" != "$git_common" ]; then
    echo "linked"
  else
    echo "normal"
  fi
}

echo "=== Test 1: Normal repo detection ==="
cd "$TEMP_DIR"
git init test-repo > /dev/null 2>&1
cd test-repo
git commit --allow-empty -m "init" > /dev/null 2>&1
result=$(detect_worktree)
if [ "$result" = "normal" ]; then
  log_pass "Normal repo detected as normal"
else
  log_fail "Normal repo detected as '$result' (expected 'normal')"
fi

echo "=== Test 2: Linked worktree detection ==="
git worktree add "$TEMP_DIR/test-wt" -b test-branch > /dev/null 2>&1
cd "$TEMP_DIR/test-wt"
result=$(detect_worktree)
if [ "$result" = "linked" ]; then
  log_pass "Linked worktree detected as linked"
else
  log_fail "Linked worktree detected as '$result' (expected 'linked')"
fi

echo "=== Test 3: Detached HEAD detection ==="
git checkout --detach HEAD > /dev/null 2>&1
branch=$(git branch --show-current)
if [ -z "$branch" ]; then
  log_pass "Detached HEAD: branch is empty"
else
  log_fail "Detached HEAD: branch is '$branch' (expected empty)"
fi

echo "=== Test 4: Linked worktree + detached HEAD (Codex App simulation) ==="
result=$(detect_worktree)
branch=$(git branch --show-current)
if [ "$result" = "linked" ] && [ -z "$branch" ]; then
  log_pass "Codex App simulation: linked + detached HEAD"
else
  log_fail "Codex App simulation: result='$result', branch='$branch'"
fi

echo "=== Test 5: Cleanup guard — linked worktree should NOT remove ==="
cd "$TEMP_DIR/test-wt"
result=$(detect_worktree)
if [ "$result" = "linked" ]; then
  log_pass "Cleanup guard: linked worktree correctly detected (would skip removal)"
else
  log_fail "Cleanup guard: expected 'linked', got '$result'"
fi

echo "=== Test 6: Cleanup guard — main repo SHOULD remove ==="
cd "$TEMP_DIR/test-repo"
result=$(detect_worktree)
if [ "$result" = "normal" ]; then
  log_pass "Cleanup guard: main repo correctly detected (would proceed with removal)"
else
  log_fail "Cleanup guard: expected 'normal', got '$result'"
fi

# Cleanup worktree before temp dir removal
cd "$TEMP_DIR/test-repo"
git worktree remove "$TEMP_DIR/test-wt" > /dev/null 2>&1 || true

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
```

- [ ] **Step 3: Make it executable and run it**

```bash
chmod +x tests/codex-app-compat/test-environment-detection.sh
./tests/codex-app-compat/test-environment-detection.sh
```

Expected output: 6 passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add tests/codex-app-compat/test-environment-detection.sh
git commit -m "test: add environment detection tests for Codex App compat (PRI-823)

Tests git-dir vs git-common-dir comparison in normal repo, linked
worktree, detached HEAD, and cleanup guard scenarios."
```

---
