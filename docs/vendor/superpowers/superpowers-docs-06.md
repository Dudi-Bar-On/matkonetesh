---
name: superpowers-docs-06
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 06/33 (README.md)"
type: reference
---

### Task 4: Extract Update Check Logic

**Files:**
- Modify: `lib/skills-core.js`
- Reference: `.codex/superpowers-codex` (lines 16-38)

**Step 1: Add checkForUpdates function**

Add at top after requires:

```javascript
const { execSync } = require('child_process');
```

Add before `module.exports`:

```javascript
/**
 * Check if a git repository has updates available.
 *
 * @param {string} repoDir - Path to git repository
 * @returns {boolean} - True if updates are available
 */
function checkForUpdates(repoDir) {
    try {
        // Quick check with 3 second timeout to avoid delays if network is down
        const output = execSync('git fetch origin && git status --porcelain=v1 --branch', {
            cwd: repoDir,
            timeout: 3000,
            encoding: 'utf8',
            stdio: 'pipe'
        });

        // Parse git status output to see if we're behind
        const statusLines = output.split('\n');
        for (const line of statusLines) {
            if (line.startsWith('## ') && line.includes('[behind ')) {
                return true; // We're behind remote
            }
        }
        return false; // Up to date
    } catch (error) {
        // Network down, git error, timeout, etc. - don't block bootstrap
        return false;
    }
}
```

**Step 2: Update module.exports**

```javascript
module.exports = {
    extractFrontmatter,
    findSkillsInDir,
    resolveSkillPath,
    checkForUpdates
};
```

**Step 3: Verify syntax**

Run: `node -c lib/skills-core.js`
Expected: No output

**Step 4: Commit**

```bash
git add lib/skills-core.js
git commit -m "feat: add git update checking to core module"
```

---

## Phase 2: Refactor Codex to Use Shared Core

### Task 5: Update Codex to Import Shared Core

**Files:**
- Modify: `.codex/superpowers-codex` (add import at top)

**Step 1: Add import statement**

After the existing requires at top of file (around line 6), add:

```javascript
const skillsCore = require('../lib/skills-core');
```

**Step 2: Verify syntax**

Run: `node -c .codex/superpowers-codex`
Expected: No output

**Step 3: Commit**

```bash
git add .codex/superpowers-codex
git commit -m "refactor: import shared skills core in codex"
```

---

### Task 6: Replace extractFrontmatter with Core Version

**Files:**
- Modify: `.codex/superpowers-codex` (lines 40-74)

**Step 1: Remove local extractFrontmatter function**

Delete lines 40-74 (the entire extractFrontmatter function definition).

**Step 2: Update all extractFrontmatter calls**

Find and replace all calls from `extractFrontmatter(` to `skillsCore.extractFrontmatter(`

Affected lines approximately: 90, 310

**Step 3: Verify script still works**

Run: `.codex/superpowers-codex find-skills | head -20`
Expected: Shows list of skills

**Step 4: Commit**

```bash
git add .codex/superpowers-codex
git commit -m "refactor: use shared extractFrontmatter in codex"
```

---

### Task 7: Replace findSkillsInDir with Core Version

**Files:**
- Modify: `.codex/superpowers-codex` (lines 97-136, approximately)

**Step 1: Remove local findSkillsInDir function**

Delete the entire `findSkillsInDir` function definition (approximately lines 97-136).

**Step 2: Update all findSkillsInDir calls**

Replace calls from `findSkillsInDir(` to `skillsCore.findSkillsInDir(`

**Step 3: Verify script still works**

Run: `.codex/superpowers-codex find-skills | head -20`
Expected: Shows list of skills

**Step 4: Commit**

```bash
git add .codex/superpowers-codex
git commit -m "refactor: use shared findSkillsInDir in codex"
```

---

### Task 8: Replace checkForUpdates with Core Version

**Files:**
- Modify: `.codex/superpowers-codex` (lines 16-38, approximately)

**Step 1: Remove local checkForUpdates function**

Delete the entire `checkForUpdates` function definition.

**Step 2: Update all checkForUpdates calls**

Replace calls from `checkForUpdates(` to `skillsCore.checkForUpdates(`

**Step 3: Verify script still works**

Run: `.codex/superpowers-codex bootstrap | head -50`
Expected: Shows bootstrap content

**Step 4: Commit**

```bash
git add .codex/superpowers-codex
git commit -m "refactor: use shared checkForUpdates in codex"
```

---

## Phase 3: Build OpenCode Plugin

### Task 9: Create OpenCode Plugin Directory Structure

**Files:**
- Create: `.opencode/plugin/superpowers.js`

**Step 1: Create directory**

Run: `mkdir -p .opencode/plugin`

**Step 2: Create basic plugin file**

```javascript
#!/usr/bin/env node

/**
 * Superpowers plugin for OpenCode.ai
 *
 * Provides custom tools for loading and discovering skills,
 * with automatic bootstrap on session start.
 */

const skillsCore = require('../../lib/skills-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const homeDir = os.homedir();
const superpowersSkillsDir = path.join(homeDir, '.config/opencode/superpowers/skills');
const personalSkillsDir = path.join(homeDir, '.config/opencode/skills');

/**
 * OpenCode plugin entry point
 */
export const SuperpowersPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Custom tools and hooks will go here
  };
};
```

**Step 3: Verify file was created**

Run: `ls -l .opencode/plugin/superpowers.js`
Expected: File exists

**Step 4: Commit**

```bash
git add .opencode/plugin/superpowers.js
git commit -m "feat: create opencode plugin scaffold"
```

---
