---
name: superpowers-docs-11
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 11/33 (README.md)"
type: reference
---

### Gate Function

```
BEFORE writing any mock:

  1. STOP - Do NOT look at the code under test yet
  2. FIND: The interface/type definition for the dependency
  3. READ: The interface file
  4. LIST: Methods defined in the interface
  5. MOCK: ONLY those methods with EXACTLY those names
  6. DO NOT: Look at what your code calls

  IF your test fails because code calls something not in mock:
    ✅ GOOD - The test found a bug in your code
    Fix the code to call the correct interface method
    NOT the mock

  Red flags:
    - "I'll mock what the code calls"
    - Copying method names from implementation
    - Mock written without reading interface
    - "The test is failing so I'll add this method to the mock"
```

**Detection:**

When you see runtime error "X is not a function" and tests pass:
1. Check if X is mocked
2. Compare mock methods to interface methods
3. Look for method name mismatches
```

**Why this works:**
Directly addresses the failure pattern from feedback.

---

### 7. subagent-driven-development: Require Skills Reading for Test Subagents

**Add to prompt template when task involves testing:**

```markdown
BEFORE writing any tests:

1. Read testing-anti-patterns skill:
   Use Skill tool: superpowers:testing-anti-patterns

2. Apply gate functions from that skill when:
   - Writing mocks
   - Adding methods to production classes
   - Mocking dependencies

This is NOT optional. Tests that violate anti-patterns will be rejected in review.
```

**Why this works:**
Ensures skills are actually used, not just exist.

**Trade-off:**
Adds time to each task, but prevents entire classes of bugs.

---

### 8. subagent-driven-development: Allow Implementer to Fix Self-Identified Issues

**Modify Step 2:**

**Current:**
```
Subagent reports back with summary of work.
```

**Proposed:**
```
Subagent performs self-reflection, then:

IF self-reflection identifies fixable issues:
  1. Fix the issues
  2. Re-run verification
  3. Report: "Initial implementation + self-reflection fix"

ELSE:
  Report: "Implementation complete"

Include in report:
- Self-reflection findings
- Whether fixes were applied
- Final verification results
```

**Why this works:**
Reduces latency when implementer already knows the fix. Documented case: would have saved one round-trip for entrypoint bug.

**Trade-off:**
Slightly more complex prompt, but faster end-to-end.

---

## Implementation Plan

### Phase 1: High-Impact, Low-Risk (Do First)

1. **verification-before-completion: Configuration change verification**
   - Clear addition, doesn't change existing content
   - Addresses high-impact problem (false confidence in tests)
   - File: `skills/verification-before-completion/SKILL.md`

2. **testing-anti-patterns: Mock-interface drift**
   - Adds new anti-pattern, doesn't modify existing
   - Addresses high-impact problem (runtime crashes)
   - File: `skills/testing-anti-patterns/SKILL.md`

3. **requesting-code-review: Explicit file reading**
   - Simple addition to template
   - Fixes concrete problem (reviewers can't find files)
   - File: `skills/requesting-code-review/SKILL.md`

### Phase 2: Moderate Changes (Test Carefully)

4. **subagent-driven-development: Process hygiene**
   - Adds new section, doesn't change workflow
   - Addresses medium-high impact (test reliability)
   - File: `skills/subagent-driven-development/SKILL.md`

5. **subagent-driven-development: Self-reflection**
   - Changes prompt template (higher risk)
   - But documented to catch bugs
   - File: `skills/subagent-driven-development/SKILL.md`

6. **subagent-driven-development: Skills reading requirement**
   - Adds prompt overhead
   - But ensures skills are actually used
   - File: `skills/subagent-driven-development/SKILL.md`

### Phase 3: Optimization (Validate First)

7. **subagent-driven-development: Lean context option**
   - Adds complexity (two approaches)
   - Needs validation that it doesn't cause confusion
   - File: `skills/subagent-driven-development/SKILL.md`

8. **subagent-driven-development: Allow implementer to fix**
   - Changes workflow (higher risk)
   - Optimization, not bug fix
   - File: `skills/subagent-driven-development/SKILL.md`

---

## Open Questions

1. **Lean context approach:**
   - Should we make it the default for pattern-based tasks?
   - How do we decide which approach to use?
   - Risk of being too lean and missing important context?

2. **Self-reflection:**
   - Will this slow down simple tasks significantly?
   - Should it only apply to complex tasks?
   - How do we prevent "reflection fatigue" where it becomes rote?

3. **Process hygiene:**
   - Should this be in subagent-driven-development or a separate skill?
   - Does it apply to other workflows beyond E2E tests?
   - How do we handle cases where process SHOULD persist (dev servers)?

4. **Skills reading enforcement:**
   - Should we require ALL subagents to read relevant skills?
   - How do we keep prompts from becoming too long?
   - Risk of over-documenting and losing focus?

---

## Success Metrics

How do we know these improvements work?

1. **Configuration verification:**
   - Zero instances of "test passed but wrong config was used"
   - Jesse doesn't say "that's not actually testing what you think"

2. **Process hygiene:**
   - Zero instances of "test hit wrong server"
   - No port conflict errors during E2E test runs

3. **Mock-interface drift:**
   - Zero instances of "tests pass but runtime crashes on missing method"
   - No method name mismatches between mocks and interfaces

4. **Self-reflection:**
   - Measurable: Do implementer reports include self-reflection findings?
   - Qualitative: Do fewer bugs make it to code review?

5. **Skills reading:**
   - Subagent reports reference skill gate functions
   - Fewer anti-pattern violations in code review

---

## Risks and Mitigations

### Risk: Prompt Bloat
**Problem:** Adding all these requirements makes prompts overwhelming
**Mitigation:**
- Phase implementation (don't add everything at once)
- Make some additions conditional (E2E hygiene only for E2E tests)
- Consider templates for different task types

### Risk: Analysis Paralysis
**Problem:** Too much reflection/verification slows execution
**Mitigation:**
- Keep gate functions quick (seconds, not minutes)
- Make lean context opt-in initially
- Monitor task completion times

### Risk: False Sense of Security
**Problem:** Following checklist doesn't guarantee correctness
**Mitigation:**
- Emphasize gate functions are minimums, not maximums
- Keep "use judgment" language in skills
- Document that skills catch common failures, not all failures

### Risk: Skill Divergence
**Problem:** Different skills give conflicting advice
**Mitigation:**
- Review changes across all skills for consistency
- Document how skills interact (Integration sections)
- Test with real scenarios before deployment

---
