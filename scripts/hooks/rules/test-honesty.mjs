// scripts/hooks/rules/test-honesty.mjs — L9 + L57: two ways a test lies about what it checked,
// both living in the SAME payload position (content being written into tests/**), hence one file.
//
// L9 — SEVERITY: WARN, argued: the harm (an assertion comparing a pinned page clock against real
// Node wall time — green until midnight, red after) is to substance, but the DETECTOR is
// heuristic: it cannot prove which side of the page boundary a given expression runs on. Measured
// against the real tree before writing this: the precise shape (expect( + new Date()/Date.now()
// in one statement, in a file that pins page.clock) occurs ZERO times in healthy work, while any
// looser shape fires on 47 legitimate uses. Warn on the precise shape; a block on a heuristic
// would be the L70 failure.
//
// L57 — SEVERITY: BLOCK, argued: "an absence and a failure are different results and must never
// share an exit path." except Exception:/bare except: feeding a skip() turned four real tests
// green-ish while a genuine SchemaViolation hid inside the skip — harm to substance, and the
// alternative is named and cheap: skip only on the CONNECTION-SHAPED exception types the excuse
// is actually about (a positive marker list), fail on everything else.
export const RULE_IDS = ['L9', 'L57'];

import { readFileSync } from 'node:fs';
import { normPath, toolFilePath, newContent } from '../lib/target-path.mjs';

const CLOCK = /page\.clock\./;
// One statement mixing expect() with Node-side wall time: new Date() with NO argument, or
// Date.now(). new Date('2026-...') literals and anything inside page.evaluate template strings
// do not match (measured: that is what keeps the 47 real uses quiet).
const WALL_ASSERT = /expect\s*\([^;\n]*\b(new Date\(\s*\)|Date\.now\(\))/;
// A python except that catches everything (bare, Exception, BaseException) whose block reaches a
// skip() within the next few lines.
const BROAD_EXCEPT_SKIP = /except(\s*\(?\s*(Exception|BaseException)\s*\)?)?\s*(as\s+\w+\s*)?:\s*\n(?:[ \t]*(?:#[^\n]*)?\n)*[ \t]+(?:pytest\.)?skip\(/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  if (!np || !np.includes('/tests/')) {
    return { decision: 'allow', reason: 'not a test file' };
  }
  const added = newContent(input);
  if (typeof added !== 'string') {
    return { decision: 'allow', reason: 'test-honesty degraded: no added content on this call — allowing' };
  }

  // ---- L57 (python test files): the broad-except-skip shape.
  if (np.endsWith('.py') && BROAD_EXCEPT_SKIP.test(added)) {
    return {
      decision: 'block',
      reason: 'L57 (2026-08-05 — four tests went green-ish while a real SchemaViolation hid '
        + 'inside a skip): an `except Exception`/bare `except` feeding skip() makes an absence '
        + 'and a failure share one exit path, and SKIPPED standing in for FAILED is worse than '
        + 'either. Blocked. The way through is a positive marker for the condition being excused: '
        + 'catch ONLY the connection-shaped exception types (e.g. ConnectionError, a named '
        + 'operational-error type) and skip on those; every other exception must FAIL. '
        + '`except Exception: skip()` is not a decision, it is an abdication with a docstring.',
    };
  }

  // ---- L9 (spec files): a wall-clock assertion in clock-pinned content.
  if (np.endsWith('.spec.ts') && WALL_ASSERT.test(added)) {
    let pinned = CLOCK.test(added);
    if (!pinned && input.tool_name === 'Edit') {
      // The pin may live elsewhere in the file this Edit fragment touches — one disk read,
      // fail-open on any error.
      try { pinned = CLOCK.test(readFileSync(fp, 'utf8')); } catch { pinned = false; }
    }
    if (pinned) {
      return {
        decision: 'warn',
        reason: 'L9 (a pinned browser clock exposed a test mixing page-side and Node-side dates): '
          + 'this content asserts with Node-side wall time (`new Date()` / `Date.now()`) while '
          + '`page.clock` pins the PAGE\'s clock only — the assertion still reads real time, and '
          + 'the test goes red whenever the two clocks straddle a boundary. Compare page-side '
          + '(compute the expected value inside page.evaluate) or against a fixed literal. When '
          + 'using page.clock, sweep the spec for Node-side clock reads in assertions.',
      };
    }
  }

  return { decision: 'allow', reason: 'no test-honesty shape in the added content' };
}
