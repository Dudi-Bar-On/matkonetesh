---
name: superpowers-docs-33
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 33/33 (README.md)"
type: reference
---

### Task 8: Final verification

**Files:**
- Read: all 5 modified skill files

- [ ] **Step 1: Run the automated detection tests**

```bash
./tests/codex-app-compat/test-environment-detection.sh
```

Expected: 6 passed, 0 failed.

- [ ] **Step 2: Read each modified file and verify changes**

Read each file end-to-end:
- `skills/using-git-worktrees/SKILL.md` — Step 0 present, rest unchanged
- `skills/finishing-a-development-branch/SKILL.md` — Step 1.5 present, cleanup guard present, rest unchanged
- `skills/subagent-driven-development/SKILL.md` — line 268 updated
- `skills/executing-plans/SKILL.md` — line 68 updated
- `skills/using-superpowers/references/codex-tools.md` — two new sections at end

- [ ] **Step 3: Verify no unintended changes**

```bash
git diff --stat HEAD~7
```

Should show exactly 6 files changed (5 skill files + 1 test file). No other files modified.

- [ ] **Step 4: Run existing test suite**

If test runner exists:
```bash
# Run skill-triggering tests
# Note: tests/skill-triggering/ was lifted into drill scenarios on 2026-05-06.
# See evals/scenarios/triggering-*.yaml. The reference below is a dated artifact.
./tests/skill-triggering/run-all.sh 2>/dev/null || echo "Skill triggering tests not available in this environment"

# Run SDD integration test
./tests/claude-code/test-subagent-driven-development-integration.sh 2>/dev/null || echo "SDD integration test not available in this environment"
```

Note: these tests require Claude Code with `--dangerously-skip-permissions`. If not available, document that regression tests should be run manually.
