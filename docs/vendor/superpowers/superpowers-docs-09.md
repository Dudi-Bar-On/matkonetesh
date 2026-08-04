---
name: superpowers-docs-09
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 09/33 (README.md)"
type: reference
---

## Success Criteria

- [ ] `lib/skills-core.js` created with all core functions
- [ ] `.codex/superpowers-codex` refactored to use shared core
- [ ] Codex commands still work (find-skills, use-skill, bootstrap)
- [ ] `.opencode/plugin/superpowers.js` created with tools and hooks
- [ ] Installation guide created
- [ ] README and RELEASE-NOTES updated
- [ ] All changes committed
- [ ] Working tree clean


<!-- source: docs/plans/2025-11-28-skills-improvements-from-user-feedback.md -->

# Skills Improvements from User Feedback

**Date:** 2025-11-28
**Status:** Draft
**Source:** Two Claude instances using superpowers in real development scenarios

---

## Executive Summary

Two Claude instances provided detailed feedback from actual development sessions. Their feedback reveals **systematic gaps** in current skills that allowed preventable bugs to ship despite following the skills.

**Critical insight:** These are problem reports, not just solution proposals. The problems are real; the solutions need careful evaluation.

**Key themes:**
1. **Verification gaps** - We verify operations succeed but not that they achieve intended outcomes
2. **Process hygiene** - Background processes accumulate and interfere across subagents
3. **Context optimization** - Subagents get too much irrelevant information
4. **Self-reflection missing** - No prompt to critique own work before handoff
5. **Mock safety** - Mocks can drift from interfaces without detection
6. **Skill activation** - Skills exist but aren't being read/used

---

## Problems Identified

### Problem 1: Configuration Change Verification Gap

**What happened:**
- Subagent tested "OpenAI integration"
- Set `OPENAI_API_KEY` env var
- Got status 200 responses
- Reported "OpenAI integration working"
- **BUT** response contained `"model": "claude-sonnet-4-20250514"` - was actually using Anthropic

**Root cause:**
`verification-before-completion` checks operations succeed but not that outcomes reflect intended configuration changes.

**Impact:** High - False confidence in integration tests, bugs ship to production

**Example failure pattern:**
- Switch LLM provider → verify status 200 but don't check model name
- Enable feature flag → verify no errors but don't check feature is active
- Change environment → verify deployment succeeds but don't check environment vars

---

### Problem 2: Background Process Accumulation

**What happened:**
- Multiple subagents dispatched during session
- Each started background server processes
- Processes accumulated (4+ servers running)
- Stale processes still bound to ports
- Later E2E test hit stale server with wrong config
- Confusing/incorrect test results

**Root cause:**
Subagents are stateless - don't know about previous subagents' processes. No cleanup protocol.

**Impact:** Medium-High - Tests hit wrong server, false passes/failures, debugging confusion

---

### Problem 3: Context Bloat in Subagent Prompts

**What happened:**
- Standard approach: give subagent full plan file to read
- Experiment: give only task + pattern + file + verify command
- Result: Faster, more focused, single-attempt completion more common

**Root cause:**
Subagents waste tokens and attention on irrelevant plan sections.

**Impact:** Medium - Slower execution, more failed attempts

**What worked:**
```
You are adding a single E2E test to packnplay's test suite.

**Your task:** Add `TestE2E_FeaturePrivilegedMode` to `pkg/runner/e2e_test.go`

**What to test:** A local devcontainer feature that requests `"privileged": true`
in its metadata should result in the container running with `--privileged` flag.

**Follow the exact pattern of TestE2E_FeatureOptionValidation** (at the end of the file)

**After writing, run:** `go test -v ./pkg/runner -run TestE2E_FeaturePrivilegedMode -timeout 5m`
```

---

### Problem 4: No Self-Reflection Before Handoff

**What happened:**
- Added self-reflection prompt: "Look at your work with fresh eyes - what could be better?"
- Implementer for Task 5 identified failing test was due to implementation bug, not test bug
- Traced to line 99: `strings.Join(metadata.Entrypoint, " ")` creating invalid Docker syntax
- Without self-reflection, would have just reported "test fails" without root cause

**Root cause:**
Implementers don't naturally step back and critique their own work before reporting completion.

**Impact:** Medium - Bugs handed off to reviewer that implementer could have caught

---

### Problem 5: Mock-Interface Drift

**What happened:**
```typescript
// Interface defines close()
interface PlatformAdapter {
  close(): Promise<void>;
}

// Code (BUGGY) calls cleanup()
await adapter.cleanup();

// Mock (MATCHES BUG) defines cleanup()
vi.mock('web-adapter', () => ({
  WebAdapter: vi.fn().mockImplementation(() => ({
    cleanup: vi.fn().mockResolvedValue(undefined),  // Wrong!
  })),
}));
```
- Tests passed
- Runtime crashed: "adapter.cleanup is not a function"

**Root cause:**
Mock derived from what buggy code calls, not from interface definition. TypeScript can't catch inline mocks with wrong method names.

**Impact:** High - Tests give false confidence, runtime crashes

**Why testing-anti-patterns didn't prevent this:**
The skill covers testing mock behavior and mocking without understanding, but not the specific pattern of "derive mock from interface, not implementation."

---

### Problem 6: Code Reviewer File Access

**What happened:**
- Code reviewer subagent dispatched
- Couldn't find test file: "The file doesn't appear to exist in the repository"
- File actually exists
- Reviewer didn't know to explicitly read it first

**Root cause:**
Reviewer prompts don't include explicit file reading instructions.

**Impact:** Low-Medium - Reviews fail or incomplete

---

### Problem 7: Fix Workflow Latency

**What happened:**
- Implementer identifies bug during self-reflection
- Implementer knows the fix
- Current workflow: report → I dispatch fixer → fixer fixes → I verify
- Extra round-trip adds latency without adding value

**Root cause:**
Rigid separation between implementer and fixer roles when implementer has already diagnosed.

**Impact:** Low - Latency, but no correctness issue

---

### Problem 8: Skills Not Being Read

**What happened:**
- `testing-anti-patterns` skill exists
- Neither human nor subagents read it before writing tests
- Would have prevented some issues (though not all - see Problem 5)

**Root cause:**
No enforcement that subagents read relevant skills. No prompt includes skill reading.

**Impact:** Medium - Skill investment wasted if not used

---

## Proposed Improvements

### 1. verification-before-completion: Add Configuration Change Verification

**Add new section:**

```markdown
## Verifying Configuration Changes

When testing changes to configuration, providers, feature flags, or environment:

**Don't just verify the operation succeeded. Verify the output reflects the intended change.**

### Common Failure Pattern

Operation succeeds because *some* valid config exists, but it's not the config you intended to test.

### Examples

| Change | Insufficient | Required |
|--------|-------------|----------|
| Switch LLM provider | Status 200 | Response contains expected model name |
| Enable feature flag | No errors | Feature behavior actually active |
| Change environment | Deploy succeeds | Logs/vars reference new environment |
| Set credentials | Auth succeeds | Authenticated user/context is correct |
