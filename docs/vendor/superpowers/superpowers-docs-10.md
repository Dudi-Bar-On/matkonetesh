---
name: superpowers-docs-10
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 10/33 (README.md)"
type: reference
---

### Gate Function

```
BEFORE claiming configuration change works:

1. IDENTIFY: What should be DIFFERENT after this change?
2. LOCATE: Where is that difference observable?
   - Response field (model name, user ID)
   - Log line (environment, provider)
   - Behavior (feature active/inactive)
3. RUN: Command that shows the observable difference
4. VERIFY: Output contains expected difference
5. ONLY THEN: Claim configuration change works

Red flags:
  - "Request succeeded" without checking content
  - Checking status code but not response body
  - Verifying no errors but not positive confirmation
```

**Why this works:**
Forces verification of INTENT, not just operation success.

---

### 2. subagent-driven-development: Add Process Hygiene for E2E Tests

**Add new section:**

```markdown
## Process Hygiene for E2E Tests

When dispatching subagents that start services (servers, databases, message queues):

### Problem

Subagents are stateless - they don't know about processes started by previous subagents. Background processes persist and can interfere with later tests.

### Solution

**Before dispatching E2E test subagent, include cleanup in prompt:**

```
BEFORE starting any services:
1. Kill existing processes: pkill -f "<service-pattern>" 2>/dev/null || true
2. Wait for cleanup: sleep 1
3. Verify port free: lsof -i :<port> && echo "ERROR: Port still in use" || echo "Port free"

AFTER tests complete:
1. Kill the process you started
2. Verify cleanup: pgrep -f "<service-pattern>" || echo "Cleanup successful"
```

### Example

```
Task: Run E2E test of API server

Prompt includes:
"Before starting the server:
- Kill any existing servers: pkill -f 'node.*server.js' 2>/dev/null || true
- Verify port 3001 is free: lsof -i :3001 && exit 1 || echo 'Port available'

After tests:
- Kill the server you started
- Verify: pgrep -f 'node.*server.js' || echo 'Cleanup verified'"
```

### Why This Matters

- Stale processes serve requests with wrong config
- Port conflicts cause silent failures
- Process accumulation slows system
- Confusing test results (hitting wrong server)
```

**Trade-off analysis:**
- Adds boilerplate to prompts
- But prevents very confusing debugging
- Worth it for E2E test subagents

---

### 3. subagent-driven-development: Add Lean Context Option

**Modify Step 2: Execute Task with Subagent**

**Before:**
```
Read that task carefully from [plan-file].
```

**After:**
```
## Context Approaches

**Full Plan (default):**
Use when tasks are complex or have dependencies:
```
Read Task N from [plan-file] carefully.
```

**Lean Context (for independent tasks):**
Use when task is standalone and pattern-based:
```
You are implementing: [1-2 sentence task description]

File to modify: [exact path]
Pattern to follow: [reference to existing function/test]
What to implement: [specific requirement]
Verification: [exact command to run]

[Do NOT include full plan file]
```

**Use lean context when:**
- Task follows existing pattern (add similar test, implement similar feature)
- Task is self-contained (doesn't need context from other tasks)
- Pattern reference is sufficient (e.g., "follow TestE2E_FeatureOptionValidation")

**Use full plan when:**
- Task has dependencies on other tasks
- Requires understanding of overall architecture
- Complex logic that needs context
```

**Example:**
```
Lean context prompt:

"You are adding a test for privileged mode in devcontainer features.

File: pkg/runner/e2e_test.go
Pattern: Follow TestE2E_FeatureOptionValidation (at end of file)
Test: Feature with `"privileged": true` in metadata results in `--privileged` flag
Verify: go test -v ./pkg/runner -run TestE2E_FeaturePrivilegedMode -timeout 5m

Report: Implementation, test results, any issues."
```

**Why this works:**
Reduces token usage, increases focus, faster completion when appropriate.

---

### 4. subagent-driven-development: Add Self-Reflection Step

**Modify Step 2: Execute Task with Subagent**

**Add to prompt template:**

```
When done, BEFORE reporting back:

Take a step back and review your work with fresh eyes.

Ask yourself:
- Does this actually solve the task as specified?
- Are there edge cases I didn't consider?
- Did I follow the pattern correctly?
- If tests are failing, what's the ROOT CAUSE (implementation bug vs test bug)?
- What could be better about this implementation?

If you identify issues during this reflection, fix them now.

Then report:
- What you implemented
- Self-reflection findings (if any)
- Test results
- Files changed
```

**Why this works:**
Catches bugs implementer can find themselves before handoff. Documented case: identified entrypoint bug through self-reflection.

**Trade-off:**
Adds ~30 seconds per task, but catches issues before review.

---

### 5. requesting-code-review: Add Explicit File Reading

**Modify the code-reviewer template:**

**Add at the beginning:**

```markdown
## Files to Review

BEFORE analyzing, read these files:

1. [List specific files that changed in the diff]
2. [Files referenced by changes but not modified]

Use Read tool to load each file.

If you cannot find a file:
- Check exact path from diff
- Try alternate locations
- Report: "Cannot locate [path] - please verify file exists"

DO NOT proceed with review until you've read the actual code.
```

**Why this works:**
Explicit instruction prevents "file not found" issues.

---

### 6. testing-anti-patterns: Add Mock-Interface Drift Anti-Pattern

**Add new Anti-Pattern 6:**

```markdown
## Anti-Pattern 6: Mocks Derived from Implementation

**The violation:**
```typescript
// Code (BUGGY) calls cleanup()
await adapter.cleanup();

// Mock (MATCHES BUG) has cleanup()
const mock = {
  cleanup: vi.fn().mockResolvedValue(undefined)
};

// Interface (CORRECT) defines close()
interface PlatformAdapter {
  close(): Promise<void>;
}
```

**Why this is wrong:**
- Mock encodes the bug into the test
- TypeScript can't catch inline mocks with wrong method names
- Test passes because both code and mock are wrong
- Runtime crashes when real object is used

**The fix:**
```typescript
// ✅ GOOD: Derive mock from interface

// Step 1: Open interface definition (PlatformAdapter)
// Step 2: List methods defined there (close, initialize, etc.)
// Step 3: Mock EXACTLY those methods

const mock = {
  initialize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),  // From interface!
};

// Now test FAILS because code calls cleanup() which doesn't exist
// That failure reveals the bug BEFORE runtime
```
