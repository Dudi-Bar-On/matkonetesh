---
name: superpowers-docs-25
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 25/33 (README.md)"
type: reference
---

### Task 3: Simplify `helper.js`

**Files:**
- Modify: `lib/brainstorm-server/helper.js`

- [ ] **Step 1: Remove `sendToClaude` function**

Delete the `sendToClaude` function (lines 92-106) — the function body and the page takeover HTML.

- [ ] **Step 2: Remove `window.send` function**

Delete the `window.send` function (lines 120-129) — was tied to the removed Send button.

- [ ] **Step 3: Remove form submission and input change handlers**

Delete the form submission handler (lines 57-71) and the input change handler (lines 73-89) including the `inputTimeout` variable.

- [ ] **Step 4: Remove `pageshow` event listener**

Delete the `pageshow` listener we added earlier (no textarea to clear anymore).

- [ ] **Step 5: Narrow click handler to `[data-choice]` only**

Replace the click handler (lines 36-55) with a narrower version:

```javascript
  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-choice]');
    if (!target) return;

    sendEvent({
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    });
  });
```

- [ ] **Step 6: Add indicator bar update on choice click**

After the `sendEvent` call in the click handler, add:

```javascript
    // Update indicator bar
    const indicator = document.getElementById('indicator-text');
    if (indicator) {
      const label = target.querySelector('h3, .content h3, .card-body h3')?.textContent?.trim() || target.dataset.choice;
      indicator.innerHTML = '<span class="selected-text">' + label + ' selected</span> — return to terminal to continue';
    }
```

- [ ] **Step 7: Remove `sendToClaude` from `window.brainstorm` API**

Update the `window.brainstorm` object (lines 132-136) to remove `sendToClaude`:

```javascript
  window.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ type: 'choice', value, ...metadata })
  };
```

- [ ] **Step 8: Run tests**

```bash
cd /Users/drewritter/prime-rad/superpowers && node tests/brainstorm-server/server.test.js
```

- [ ] **Step 9: Commit**

```bash
git add lib/brainstorm-server/helper.js
git commit -m "Simplify helper.js: remove feedback functions, narrow to choice capture + indicator"
```

---

### Task 4: Update tests for new structure

**Files:**
- Modify: `tests/brainstorm-server/server.test.js`

**Note:** Line references below are from the _original_ file. Task 2 inserted new tests earlier in the file, so actual line numbers will be shifted. Find tests by their `console.log` labels (e.g., "Test 5:", "Test 6:").

- [ ] **Step 1: Update Test 5 (full document assertion)**

Find the Test 5 assertion `!fullRes.body.includes('feedback-footer')`. Change it to: Full documents should NOT have the indicator bar either (they're served as-is):

```javascript
    assert(!fullRes.body.includes('indicator-bar') || fullDoc.includes('indicator-bar'),
      'Should not wrap full documents in frame template');
```

- [ ] **Step 2: Update Test 6 (fragment wrapping)**

Line 125: Replace `feedback-footer` assertion with indicator bar assertion:

```javascript
    assert(fragRes.body.includes('indicator-bar'), 'Fragment should get indicator bar from frame');
```

Also verify content placeholder was replaced (fragment content appears, placeholder comment doesn't):

```javascript
    assert(!fragRes.body.includes('<!-- CONTENT -->'), 'Content placeholder should be replaced');
```

- [ ] **Step 3: Update Test 7 (helper.js API)**

Lines 140-142: Update assertions to reflect the new API surface:

```javascript
    assert(helperContent.includes('toggleSelect'), 'helper.js should define toggleSelect');
    assert(helperContent.includes('sendEvent'), 'helper.js should define sendEvent');
    assert(helperContent.includes('selectedChoice'), 'helper.js should track selectedChoice');
    assert(helperContent.includes('brainstorm'), 'helper.js should expose brainstorm API');
    assert(!helperContent.includes('sendToClaude'), 'helper.js should not contain sendToClaude');
```

- [ ] **Step 4: Replace Test 8 (sendToClaude theming) with indicator bar test**

Replace Test 8 (lines 145-149) — `sendToClaude` no longer exists. Test the indicator bar instead:

```javascript
    // Test 8: Indicator bar uses CSS variables (theme support)
    console.log('Test 8: Indicator bar uses CSS variables');
    const templateContent = fs.readFileSync(
      path.join(__dirname, '../../lib/brainstorm-server/frame-template.html'), 'utf-8'
    );
    assert(templateContent.includes('indicator-bar'), 'Template should have indicator bar');
    assert(templateContent.includes('indicator-text'), 'Template should have indicator text element');
    console.log('  PASS');
```

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/drewritter/prime-rad/superpowers && node tests/brainstorm-server/server.test.js
```
Expected: ALL tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/brainstorm-server/server.test.js
git commit -m "Update brainstorm server tests for new template structure and helper.js API"
```

---

### Task 5: Delete `wait-for-feedback.sh`

**Files:**
- Delete: `lib/brainstorm-server/wait-for-feedback.sh`

- [ ] **Step 1: Verify no other files import or reference `wait-for-feedback.sh`**

Search the codebase:
```bash
grep -r "wait-for-feedback" /Users/drewritter/prime-rad/superpowers/ --include="*.js" --include="*.md" --include="*.sh" --include="*.json"
```

Expected references: only `visual-companion.md` (rewritten in Task 6) and possibly release notes (historical, leave as-is).

- [ ] **Step 2: Delete the file**

```bash
rm lib/brainstorm-server/wait-for-feedback.sh
```

- [ ] **Step 3: Run tests to confirm nothing breaks**

```bash
cd /Users/drewritter/prime-rad/superpowers && node tests/brainstorm-server/server.test.js
```
Expected: All tests PASS (no test referenced this file).

- [ ] **Step 4: Commit**

```bash
git add -u lib/brainstorm-server/wait-for-feedback.sh
git commit -m "Delete wait-for-feedback.sh: replaced by .events file"
```

---

### Task 6: Rewrite `visual-companion.md`

**Files:**
- Modify: `skills/brainstorming/visual-companion.md`

- [ ] **Step 1: Update "How It Works" description (line 18)**

Replace the sentence about receiving feedback "as JSON" with:

```markdown
The server watches a directory for HTML files and serves the newest one to the browser. You write HTML content, the user sees it in their browser and can click to select options. Selections are recorded to a `.events` file that you read on your next turn.
```

- [ ] **Step 2: Update fragment description (line 20)**

Remove "feedback footer" from the description of what the frame template provides:

```markdown
**Content fragments vs full documents:** If your HTML file starts with `<!DOCTYPE` or `<html`, the server serves it as-is (just injects the helper script). Otherwise, the server automatically wraps your content in the frame template — adding the header, CSS theme, selection indicator, and all interactive infrastructure. **Write content fragments by default.** Only write full documents when you need complete control over the page.
```

- [ ] **Step 3: Rewrite "The Loop" section (lines 36-61)**

Replace the entire "The Loop" section with:

```markdown
