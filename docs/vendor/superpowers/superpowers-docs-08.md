---
name: superpowers-docs-08
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 08/33 (README.md)"
type: reference
---

## Phase 4: Documentation

### Task 13: Create OpenCode Installation Guide

**Files:**
- Create: `.opencode/INSTALL.md`

**Step 1: Create installation guide**

```markdown
# Installing Superpowers for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- Node.js installed
- Git installed

## Installation Steps

### 1. Install Superpowers Skills

```bash
# Clone superpowers skills to OpenCode config directory
mkdir -p ~/.config/opencode/superpowers
git clone https://github.com/obra/superpowers.git ~/.config/opencode/superpowers
```

### 2. Install the Plugin

The plugin is included in the superpowers repository you just cloned.

OpenCode will automatically discover it from:
- `~/.config/opencode/superpowers/.opencode/plugin/superpowers.js`

Or you can link it to the project-local plugin directory:

```bash
# In your OpenCode project
mkdir -p .opencode/plugin
ln -s ~/.config/opencode/superpowers/.opencode/plugin/superpowers.js .opencode/plugin/superpowers.js
```

### 3. Restart OpenCode

Restart OpenCode to load the plugin. On the next session, you should see:

```
You have superpowers.
```

## Usage

### Finding Skills

Use the `find_skills` tool to list all available skills:

```
use find_skills tool
```

### Loading a Skill

Use the `use_skill` tool to load a specific skill:

```
use use_skill tool with skill_name: "superpowers:brainstorming"
```

### Personal Skills

Create your own skills in `~/.config/opencode/skills/`:

```bash
mkdir -p ~/.config/opencode/skills/my-skill
```

Create `~/.config/opencode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when [condition] - [what it does]
---

# My Skill

[Your skill content here]
```

Personal skills override superpowers skills with the same name.

## Updating

```bash
cd ~/.config/opencode/superpowers
git pull
```

## Troubleshooting

### Plugin not loading

1. Check plugin file exists: `ls ~/.config/opencode/superpowers/.opencode/plugin/superpowers.js`
2. Check OpenCode logs for errors
3. Verify Node.js is installed: `node --version`

### Skills not found

1. Verify skills directory exists: `ls ~/.config/opencode/superpowers/skills`
2. Use `find_skills` tool to see what's discovered
3. Check file structure: each skill should have a `SKILL.md` file

### Tool mapping issues

When a skill references a Claude Code tool you don't have:
- `TodoWrite` → use `update_plan`
- `Task` with subagents → use `@mention` syntax to invoke OpenCode subagents
- `Skill` → use `use_skill` tool
- File operations → use your native tools

## Getting Help

- Report issues: https://github.com/obra/superpowers/issues
- Documentation: https://github.com/obra/superpowers
```

**Step 2: Verify file created**

Run: `ls -l .opencode/INSTALL.md`
Expected: File exists

**Step 3: Commit**

```bash
git add .opencode/INSTALL.md
git commit -m "docs: add opencode installation guide"
```

---

### Task 14: Update Main README

**Files:**
- Modify: `README.md`

**Step 1: Add OpenCode section**

Find the section about supported platforms (search for "Codex" in the file), and add after it:

```markdown
### OpenCode

Superpowers works with [OpenCode.ai](https://opencode.ai) through a native JavaScript plugin.

**Installation:** See [.opencode/INSTALL.md](.opencode/INSTALL.md)

**Features:**
- Custom tools: `use_skill` and `find_skills`
- Automatic session bootstrap
- Personal skills with shadowing
- Supporting files and scripts access
```

**Step 2: Verify formatting**

Run: `grep -A 10 "### OpenCode" README.md`
Expected: Shows the section you added

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add opencode support to readme"
```

---

### Task 15: Update Release Notes

**Files:**
- Modify: `RELEASE-NOTES.md`

**Step 1: Add entry for OpenCode support**

At the top of the file (after the header), add:

```markdown
## [Unreleased]

### Added

- **OpenCode Support**: Native JavaScript plugin for OpenCode.ai
  - Custom tools: `use_skill` and `find_skills`
  - Automatic session bootstrap with tool mapping instructions
  - Shared core module (`lib/skills-core.js`) for code reuse
  - Installation guide in `.opencode/INSTALL.md`

### Changed

- **Refactored Codex Implementation**: Now uses shared `lib/skills-core.js` module
  - Eliminates code duplication between Codex and OpenCode
  - Single source of truth for skill discovery and parsing

---

```

**Step 2: Verify formatting**

Run: `head -30 RELEASE-NOTES.md`
Expected: Shows your new section

**Step 3: Commit**

```bash
git add RELEASE-NOTES.md
git commit -m "docs: add opencode support to release notes"
```

---

## Phase 5: Final Verification

### Task 16: Test Codex Still Works

**Files:**
- Test: `.codex/superpowers-codex`

**Step 1: Test find-skills command**

Run: `.codex/superpowers-codex find-skills | head -20`
Expected: Shows list of skills with names and descriptions

**Step 2: Test use-skill command**

Run: `.codex/superpowers-codex use-skill superpowers:brainstorming | head -20`
Expected: Shows brainstorming skill content

**Step 3: Test bootstrap command**

Run: `.codex/superpowers-codex bootstrap | head -30`
Expected: Shows bootstrap content with instructions

**Step 4: If all tests pass, record success**

No commit needed - this is verification only.

---

### Task 17: Verify File Structure

**Files:**
- Check: All new files exist

**Step 1: Verify all files created**

Run:
```bash
ls -l lib/skills-core.js
ls -l .opencode/plugin/superpowers.js
ls -l .opencode/INSTALL.md
```

Expected: All files exist

**Step 2: Verify directory structure**

Run: `tree -L 2 .opencode/` (or `find .opencode -type f` if tree not available)
Expected:
```
.opencode/
├── INSTALL.md
└── plugin/
    └── superpowers.js
```

**Step 3: If structure correct, proceed**

No commit needed - this is verification only.

---

### Task 18: Final Commit and Summary

**Files:**
- Check: `git status`

**Step 1: Check git status**

Run: `git status`
Expected: Working tree clean, all changes committed

**Step 2: Review commit log**

Run: `git log --oneline -20`
Expected: Shows all commits from this implementation

**Step 3: Create summary document**

Create a completion summary showing:
- Total commits made
- Files created: `lib/skills-core.js`, `.opencode/plugin/superpowers.js`, `.opencode/INSTALL.md`
- Files modified: `.codex/superpowers-codex`, `README.md`, `RELEASE-NOTES.md`
- Testing performed: Codex commands verified
- Ready for: Testing with actual OpenCode installation

**Step 4: Report completion**

Present summary to user and offer to:
1. Push to remote
2. Create pull request
3. Test with real OpenCode installation (requires OpenCode installed)

---

## Testing Guide (Manual - Requires OpenCode)

These steps require OpenCode to be installed and are not part of the automated implementation:

1. **Install skills**: Follow `.opencode/INSTALL.md`
2. **Start OpenCode session**: Verify bootstrap appears
3. **Test find_skills**: Should list all available skills
4. **Test use_skill**: Load a skill and verify content appears
5. **Test supporting files**: Verify skill directory paths are accessible
6. **Test personal skills**: Create a personal skill and verify it shadows core
7. **Test tool mapping**: Verify TodoWrite → update_plan mapping works
