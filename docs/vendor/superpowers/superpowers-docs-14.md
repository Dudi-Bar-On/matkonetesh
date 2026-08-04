---
name: superpowers-docs-14
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 14/33 (README.md)"
type: reference
---

## Pushing Screens

Write HTML to `/tmp/brainstorm/screen.html`. The server watches this file and auto-refreshes the browser.

## Reading User Responses

Check the background task output for JSON events:

```json
{"type":"user-event","type":"click","text":"Option A","choice":"optionA","timestamp":1234567890}
{"type":"user-event","type":"submit","data":{"notes":"My feedback"},"timestamp":1234567891}
```

Event types:
- **click**: User clicked button or `data-choice` element
- **submit**: User submitted form (includes all form data)
- **input**: User typed in field (debounced 500ms)

## HTML Patterns

### Choice Cards

```html
<div class="options">
  <button data-choice="optionA">
    <h3>Option A</h3>
    <p>Description</p>
  </button>
  <button data-choice="optionB">
    <h3>Option B</h3>
    <p>Description</p>
  </button>
</div>
```

### Interactive Mockup

```html
<div class="mockup">
  <header data-choice="header">App Header</header>
  <nav data-choice="nav">Navigation</nav>
  <main data-choice="main">Content</main>
</div>
```

### Form with Notes

```html
<form>
  <label>Priority: <input type="range" name="priority" min="1" max="5"></label>
  <textarea name="notes" placeholder="Additional thoughts..."></textarea>
  <button type="submit">Submit</button>
</form>
```

### Explicit JavaScript

```html
<button onclick="brainstorm.choice('custom', {extra: 'data'})">Custom</button>
```
```

**Step 2: Add visual companion section to brainstorming skill**

Add after "Key Principles" in `skills/brainstorming/SKILL.md`:

```markdown

## Visual Companion (Optional)

When brainstorming involves visual elements - UI mockups, wireframes, interactive prototypes - use the browser-based visual companion.

**When to use:**
- Presenting UI/UX options that benefit from visual comparison
- Showing wireframes or layout options
- Gathering structured feedback (ratings, forms)
- Prototyping click interactions

**How it works:**
1. Start the server as a background job
2. Tell user to open http://localhost:3333
3. Write HTML to `/tmp/brainstorm/screen.html` (auto-refreshes)
4. Check background task output for user interactions

The terminal remains the primary conversation interface. The browser is a visual aid.

**Reference:** See `visual-companion.md` in this skill directory for HTML patterns and API details.
```

**Step 3: Verify the edits**

Run: `grep -A5 "Visual Companion" skills/brainstorming/SKILL.md`
Expected: Shows the new section

**Step 4: Commit**

```bash
git add skills/brainstorming/
git commit -m "feat: add visual companion to brainstorming skill"
```

---

## Task 5: Add Server to Plugin Ignore (Optional Cleanup)

**Files:**
- Check if `.gitignore` needs node_modules exclusion for lib/brainstorm-server

**Step 1: Check current gitignore**

Run: `cat .gitignore 2>/dev/null || echo "No .gitignore"`

**Step 2: Add node_modules if needed**

If not already present, add:
```
lib/brainstorm-server/node_modules/
```

**Step 3: Commit if changed**

```bash
git add .gitignore
git commit -m "chore: ignore brainstorm-server node_modules"
```

---

## Summary

After completing all tasks:

1. **Server** at `lib/brainstorm-server/` - Node.js server that watches HTML file and relays events
2. **Helper library** auto-injected - captures clicks, forms, inputs
3. **Tests** at `tests/brainstorm-server/` - verifies server behavior
4. **Brainstorming skill** updated with visual companion section and `visual-companion.md` reference doc

**To use:**
1. Start server as background job: `node lib/brainstorm-server/index.js &`
2. Tell user to open `http://localhost:3333`
3. Write HTML to `/tmp/brainstorm/screen.html`
4. Check task output for user events


<!-- source: docs/porting-to-a-new-harness.md -->

# Porting Superpowers to a New Harness

This guide explains how to add support for a new harness — an IDE, CLI, or
agent runner that isn't Claude Code — so that Superpowers skills auto-trigger
there the same way they do natively.

It is written in two layers. **Part 1–3** explain how the system works and how
to tell whether a harness can be supported at all; read these before you touch
anything. **Part 4–8** are a prescriptive procedure for an agent (supervised by
a human partner) to execute the port end to end, through distribution. An
appendix indexes the current reference integrations so you can copy the closest
one.

The integration mechanism differs across harnesses, and it will keep changing.
This guide deliberately teaches the **invariants** — the things that must be
true no matter the mechanism — and points you at a live reference implementation
to copy. When this guide and the code disagree, the code wins; fix the guide.

## Before you start

Adding a harness is the highest-stakes contribution type in this repo. Before
writing anything:

- Read `CLAUDE.md` and `.github/PULL_REQUEST_TEMPLATE.md` in full — the
  contributor rules and the new-harness PR requirements are not optional.
- Search open **and closed** PRs for a prior attempt at this harness. If one
  exists, understand why it stalled before starting your own.

---

## Part 1 — How Superpowers works across harnesses

Superpowers is the same content everywhere. What changes per harness is the thin
layer that delivers that content to the model and translates its instructions
into the harness's native tools. Three components:

1. **Skills (harness-agnostic).** Everything in `skills/` is the source of
   truth, shared verbatim by every harness. Skills are written to describe
   *actions* — "invoke a skill", "read a file", "dispatch a subagent", "create a
   todo" — and never name a specific tool. This is what lets one skill body run
   on Claude Code, Codex, Gemini, pi, and the rest without edits.

2. **Tool mapping (per-harness).** Each harness needs the action vocabulary
   translated into its real tool names. That translation lives in
   `skills/using-superpowers/references/<harness>-tools.md` and/or inline in the
   harness's bootstrap injector (see Part 5). It says, e.g., "*dispatch a
   subagent* → call `task` with `subagent_type`."

3. **Bootstrap (per-harness).** At the start of every session, the full
   `skills/using-superpowers/SKILL.md` is injected into the model's context,
   wrapped in `<EXTREMELY_IMPORTANT>` tags, with the tool mapping appended. That
   injected skill is what teaches the model that skills exist and that it must
   check for a relevant skill before acting. **The bootstrap is the entire
   integration.** Without it, the skill files are inert — present on disk, never
   invoked.
