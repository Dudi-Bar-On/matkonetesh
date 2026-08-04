---
name: superpowers-docs-04
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 04/33 (README.md)"
type: reference
---

### Session Startup Hook

When a new session starts (`session.started` event):

1. **Inject using-superpowers content**
   - Full content of the using-superpowers skill
   - Establishes mandatory workflows

2. **Run find_skills automatically**
   - Display full list of available skills upfront
   - Include skill directories for each

3. **Inject tool mapping instructions**
   ```markdown
   **Tool Mapping for OpenCode:**
   When skills reference tools you don't have, substitute:
   - `TodoWrite` → `update_plan`
   - `Task` with subagents → Use OpenCode subagent system (@mention)
   - `Skill` tool → `use_skill` custom tool
   - Read, Write, Edit, Bash → Your native equivalents

   **Skill directories contain:**
   - Supporting scripts (run with bash)
   - Additional documentation (read with read tool)
   - Utilities specific to that skill
   ```

4. **Check for updates** (non-blocking)
   - Quick git fetch with timeout
   - Notify if updates available

### Plugin Structure

```javascript
// .opencode/plugin/superpowers.js
const skillsCore = require('../../lib/skills-core');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');

export const SuperpowersPlugin = async ({ client, directory, $ }) => {
  const superpowersDir = path.join(process.env.HOME, '.config/opencode/superpowers');
  const personalDir = path.join(process.env.HOME, '.config/opencode/skills');

  return {
    'session.started': async () => {
      const usingSuperpowers = await readSkill('using-superpowers');
      const skillsList = await findAllSkills();
      const toolMapping = getToolMappingInstructions();

      return {
        context: `${usingSuperpowers}\n\n${skillsList}\n\n${toolMapping}`
      };
    },

    tools: [
      {
        name: 'use_skill',
        description: 'Load and read a specific skill',
        schema: z.object({
          skill_name: z.string()
        }),
        execute: async ({ skill_name }) => {
          // Implementation using skillsCore
        }
      },
      {
        name: 'find_skills',
        description: 'List all available skills',
        schema: z.object({}),
        execute: async () => {
          // Implementation using skillsCore
        }
      }
    ]
  };
};
```

## File Structure

```
superpowers/
├── lib/
│   └── skills-core.js           # NEW: Shared skill logic
├── .codex/
│   ├── superpowers-codex        # UPDATED: Use skills-core
│   ├── superpowers-bootstrap.md
│   └── INSTALL.md
├── .opencode/
│   ├── plugin/
│   │   └── superpowers.js       # NEW: OpenCode plugin
│   └── INSTALL.md               # NEW: Installation guide
└── skills/                       # Unchanged
```

## Implementation Plan

### Phase 1: Refactor Shared Core

1. Create `lib/skills-core.js`
   - Extract frontmatter parsing from `.codex/superpowers-codex`
   - Extract skill discovery logic
   - Extract path resolution (with shadowing)
   - Update to use only `name` and `description` (no `when_to_use`)

2. Update `.codex/superpowers-codex` to use shared core
   - Import from `../lib/skills-core.js`
   - Remove duplicated code
   - Keep CLI wrapper logic

3. Test Codex implementation still works
   - Verify bootstrap command
   - Verify use-skill command
   - Verify find-skills command

### Phase 2: Build OpenCode Plugin

1. Create `.opencode/plugin/superpowers.js`
   - Import shared core from `../../lib/skills-core.js`
   - Implement plugin function
   - Define custom tools (use_skill, find_skills)
   - Implement session.started hook

2. Create `.opencode/INSTALL.md`
   - Installation instructions
   - Directory setup
   - Configuration guidance

3. Test OpenCode implementation
   - Verify session startup bootstrap
   - Verify use_skill tool works
   - Verify find_skills tool works
   - Verify skill directories are accessible

### Phase 3: Documentation & Polish

1. Update README with OpenCode support
2. Add OpenCode installation to main docs
3. Update RELEASE-NOTES
4. Test both Codex and OpenCode work correctly

## Next Steps

1. **Create isolated workspace** (using git worktrees)
   - Branch: `feature/opencode-support`

2. **Follow TDD where applicable**
   - Test shared core functions
   - Test skill discovery and parsing
   - Integration tests for both platforms

3. **Incremental implementation**
   - Phase 1: Refactor shared core + update Codex
   - Verify Codex still works before moving on
   - Phase 2: Build OpenCode plugin
   - Phase 3: Documentation and polish

4. **Testing strategy**
   - Manual testing with real OpenCode installation
   - Verify skill loading, directories, scripts work
   - Test both Codex and OpenCode side-by-side
   - Verify tool mappings work correctly

5. **PR and merge**
   - Create PR with complete implementation
   - Test in clean environment
   - Merge to main

## Benefits

- **Code reuse**: Single source of truth for skill discovery/parsing
- **Maintainability**: Bug fixes apply to both platforms
- **Extensibility**: Easy to add future platforms (Cursor, Windsurf, etc.)
- **Native integration**: Uses OpenCode's plugin system properly
- **Consistency**: Same skill experience across all platforms


<!-- source: docs/plans/2025-11-22-opencode-support-implementation.md -->

# OpenCode Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full superpowers support for OpenCode.ai with a native JavaScript plugin that shares core functionality with the existing Codex implementation.

**Architecture:** Extract common skill discovery/parsing logic into `lib/skills-core.js`, refactor Codex to use it, then build OpenCode plugin using their native plugin API with custom tools and session hooks.

**Tech Stack:** Node.js, JavaScript, OpenCode Plugin API, Git worktrees

---

## Phase 1: Create Shared Core Module
