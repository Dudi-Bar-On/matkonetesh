---
name: superpowers-docs-22
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 22/33 (README.md)"
type: reference
---

## Appendix A — Reference integrations (current)

Use this as the live index; when in doubt, read the files, not this table.

| Harness | Entry point | Bootstrap mechanism | Tool mapping | Tests | Distribution |
|---|---|---|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` + `hooks/hooks.json` | shell hook → `hooks/session-start` (`hookSpecificOutput.additionalContext`) | native `Skill` tool; no adapter file needed | `tests/hooks/` | marketplace |
| Codex | `.codex-plugin/plugin.json` (declares empty `hooks`) | native skill discovery (no session-start hook) | `references/codex-tools.md` | `tests/codex/`, `tests/codex-plugin-sync/` | fork sync (`scripts/sync-to-codex-plugin.sh`) |
| Cursor | `.cursor-plugin/plugin.json` + `hooks/hooks-cursor.json` | shell hook → `hooks/session-start` (`additional_context`) | none needed (Claude Code–compatible tool surface) | `tests/hooks/` | hand-authored |
| Copilot CLI | (shares Claude Code hook path; `COPILOT_CLI` env) | shell hook → `hooks/session-start` (`additionalContext`) | none needed (Claude Code–compatible tool surface) | `tests/hooks/` | — |
| Gemini CLI | `gemini-extension.json` + `GEMINI.md` | instructions file `@`-includes bootstrap + mapping | `references/gemini-tools.md` | — | `gemini extensions install` |
| Kimi Code | `.kimi-plugin/plugin.json` | manifest `sessionStart.skill` loads `using-superpowers` | inline `skillInstructions` in manifest | `tests/kimi/` | marketplace or `/plugins install` GitHub URL |
| OpenCode | `.opencode/plugins/superpowers.js` (declared via root `package.json` `main`) | in-process: `config` hook registers skills dir; `experimental.chat.messages.transform` injects user message | inline in `superpowers.js` | `tests/opencode/` | `opencode.json` plugin git URL |
| pi | `.pi/extensions/superpowers.ts` | in-process: `resources_discover` registers skills; `context` event injects user message; lifecycle-flag + compaction-aware | `piToolMapping()` inline **and** `references/pi-tools.md` | `tests/pi/` | repo-root `package.json` fields |

## Appendix B — Gotchas that have bitten porters

- **Opt-in isn't a port.** If your human partner has to do anything per session
  to get Superpowers, the acceptance test fails. Re-read Part 2.
- **Wrong JSON field → silent failure or double injection.** Shape A only.
  Confirm the exact field/nesting; Claude Code reads two fields without dedup.
- **Hook-config schema varies per harness.** Shape A. Cursor's `hooks-cursor.json`
  looks nothing like the Claude Code one (`version`, lowercase `sessionStart`,
  relative command, no `matcher`/`type`/`async`). Match the closest existing file.
- **Plugin-root env var differs per harness.** Shape A. The hook command uses
  `${CLAUDE_PLUGIN_ROOT}` (Claude) or a relative path
  (Cursor). Use what your harness exports; the script re-derives the root itself.
- **System-message injection.** Shape B injects a *user* message on purpose
  (#750, #894). Don't "fix" it to a system message.
- **Per-step vs per-turn callbacks.** OpenCode fires every step (per-call dedup
  guard); pi fires per turn (lifecycle flag + `agent_end` reset). Copying one
  harness's dedup strategy onto the other's callback frequency breaks injection.
- **Message-object shape is per-harness.** Shape B. pi and OpenCode use
  incompatible shapes; discover yours, don't copy a reference's object literal.
- **Hunting for a skill-registration API that doesn't exist.** A harness with no
  skill system (not just no `Skill` tool) has nothing to register — the model
  reads `SKILL.md` on demand. Don't assume a `skillPaths` equivalent exists.
- **Mapping in two places.** For in-process plugins the mapping may live both
  inline and in a `references/` file (pi). Update both.
- **The "never read skill files" line.** It means "don't bypass your platform's
  skill-loading mechanism," not "never use file-read." On a no-skill-tool harness
  that mechanism *is* reading `SKILL.md` — say so explicitly in the mapping
  (Part 5).
- **`.sh` on Windows.** Keep hook scripts extensionless (Part 7).
- **Unregistered version.** A new manifest not added to `.version-bump.json`
  ships stale (Part 6).
- **Editing skills to fit the harness.** Never. The fix goes in the tool mapping.


<!-- source: docs/superpowers/plans/2026-01-22-document-review-system.md -->

# Document Review System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Add spec and plan document review loops to the brainstorming and writing-plans skills.

**Architecture:** Create reviewer prompt templates in each skill directory. Modify skill files to add review loops after document creation. Use Task tool with general-purpose subagent for reviewer dispatch.

**Tech Stack:** Markdown skill files, subagent dispatch via Task tool

**Spec:** docs/superpowers/specs/2026-01-22-document-review-system-design.md

---

## Chunk 1: Spec Document Reviewer

This chunk adds the spec document reviewer to the brainstorming skill.

### Task 1: Create Spec Document Reviewer Prompt Template

**Files:**
- Create: `skills/brainstorming/spec-document-reviewer-prompt.md`

- [ ] **Step 1:** Create the reviewer prompt template file

```markdown
# Spec Document Reviewer Prompt Template

Use this template when dispatching a spec document reviewer subagent.

**Purpose:** Verify the spec is complete, consistent, and ready for implementation planning.

**Dispatch after:** Spec document is written to docs/superpowers/specs/

```
Task tool (general-purpose):
  description: "Review spec document"
  prompt: |
    You are a spec document reviewer. Verify this spec is complete and ready for planning.

    **Spec to review:** [SPEC_FILE_PATH]

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, "TBD", incomplete sections |
    | Coverage | Missing error handling, edge cases, integration points |
    | Consistency | Internal contradictions, conflicting requirements |
    | Clarity | Ambiguous requirements |
    | YAGNI | Unrequested features, over-engineering |

    ## CRITICAL

    Look especially hard for:
    - Any TODO markers or placeholder text
    - Sections saying "to be defined later" or "will spec when X is done"
    - Sections noticeably less detailed than others

    ## Output Format

    ## Spec Review

    **Status:** ✅ Approved | ❌ Issues Found

    **Issues (if any):**
    - [Section X]: [specific issue] - [why it matters]

    **Recommendations (advisory):**
    - [suggestions that don't block approval]
```

**Reviewer returns:** Status, Issues (if any), Recommendations
```

- [ ] **Step 2:** Verify the file was created correctly

Run: `cat skills/brainstorming/spec-document-reviewer-prompt.md | head -20`
Expected: Shows the header and purpose section

- [ ] **Step 3:** Commit

```bash
git add skills/brainstorming/spec-document-reviewer-prompt.md
git commit -m "feat: add spec document reviewer prompt template"
```

---
