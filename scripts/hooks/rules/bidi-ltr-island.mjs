// scripts/hooks/rules/bidi-ltr-island.mjs — L13: a ≥ rendered as ≤ in RTL (opposite meaning; on a
// SAFETY floor marker) because the DOM-text test asserted the char was present but not its visual
// order. Gate, from the rule's own row: numeric/math readouts in Hebrew UI are LTR islands
// (dir="ltr"); catch bidi order by LOOKING; and guard with a dir assertion.
//
// SCOPE, MEASURED (Phase-1 correction — where the construct actually lives): app.js history since
// June holds 4,382 added ≥/≤ lines with no dir= on the same line, all healthy (dir handling lives
// in render wrappers, not on the string-building line) — so NO content pattern on additions can
// pass the phase's 0-false-alarm bar. What IS precise:
//   BRANCH A — an Edit whose old_string HAS dir="ltr" beside ≥/≤ and whose new_string keeps the
//   ≥/≤ but drops the dir attribute: someone is un-fixing the exact L13 fix. SEVERITY: BLOCK —
//   harm to substance (a safety comparison that renders reversed), detection is diff-anchored and
//   exact, and the alternative is trivial: keep the dir="ltr" attribute (or move it to the new
//   wrapper) in the replacement text.
//   BRANCH B — new test content asserting on text containing ≥/≤ with no dir assertion anywhere
//   in the same added content: the "guard with a dir assertion" half. SEVERITY: WARN — presence
//   of the char is being asserted, visual order is not; the warn names the missing assertion.
// The rest of L13's surface (a NEW readout built without an island) is explicitly NOT enforceable
// here at 0 false alarms and stays owned by DoD-8/9 (390×844 screenshot, actually looked at) —
// a named gap, not a silent one.
// TOOLS — the tool names this rule can ever object to. The pipeline reads this from the
// file TEXT and skips importing the module entirely for any other tool, which is what keeps
// per-call cost from growing with the total rule count. It must stay HONEST: for any tool
// not listed here, evaluate() must return allow. tests/test_hook_tool_scope.py proves that
// for every rule and every tool, so a wrong list fails loudly instead of silencing a rule.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['L13'];

import { basename } from 'node:path';
import { normPath, toolFilePath, newContent, oldContent } from '../lib/target-path.mjs';

const MATH = /[≥≤]/;
const DIR_LTR = /dir\s*=\s*["']ltr["']/;
const TEXT_ASSERT_MATH = /(toHaveText|toContainText|toHaveValue)\s*\([^)]*[≥≤]/;
const DIR_ASSERT = /toHaveAttribute\s*\(\s*["']dir["']|getComputedStyle|direction/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  if (!np) return { decision: 'allow', reason: 'bidi degraded: no file_path — allowing' };
  const base = basename(np);
  const added = newContent(input);

  // ---- BRANCH A: island removal in the UI sources.
  if (base === 'app.js' || base === 'app.css' || base === 'index.html') {
    const old = oldContent(input);
    if (typeof old === 'string' && typeof added === 'string'
        && DIR_LTR.test(old) && MATH.test(old)
        && MATH.test(added) && !DIR_LTR.test(added)) {
      return {
        decision: 'block',
        reason: 'L13 (a ≥ safety floor rendered as ≤ in RTL — opposite meaning): this edit REMOVES '
          + 'an existing dir="ltr" island while keeping the ≥/≤ readout inside RTL text, undoing '
          + 'the exact fix L13 paid for. Blocked. Keep the dir="ltr" attribute on the element that '
          + 'carries the numeric/math readout (or put it on the replacement wrapper) — bidi flips '
          + 'the glyph order silently and no DOM-text assertion will catch it.',
      };
    }
  }

  // ---- BRANCH B: a ≥/≤ text assertion with no dir guard, in new test content.
  if (np.includes('/tests/') && np.endsWith('.spec.ts') && typeof added === 'string'
      && TEXT_ASSERT_MATH.test(added) && !DIR_ASSERT.test(added)) {
    return {
      decision: 'warn',
      reason: 'L13: this assertion checks that a ≥/≤ character is PRESENT in the text, which is '
        + 'exactly the assertion that passed while the rendered order was reversed. Add a dir '
        + 'guard beside it — e.g. await expect(el).toHaveAttribute(\'dir\', \'ltr\') on the '
        + 'readout\'s island — and per DoD-8, look at the rendered 390×844 screenshot.',
    };
  }

  return { decision: 'allow', reason: 'no bidi-island shape in this change' };
}
