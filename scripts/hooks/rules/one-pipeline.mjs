// scripts/hooks/rules/one-pipeline.mjs — 12.1 ("one process, or none") + rule 2's write-time
// completeness check (L27, the silent CP2 truncation).
//
// BRANCH 12.1 — SEVERITY: BLOCK. Importing GSD's artifact machinery (PLAN.md / SUMMARY.md /
// VERIFICATION.md at a directory root, /gsd-* command files, a .gsd/ tree) creates "the same
// subject specified twice, neither document citing the other" — the exact defect the knowledge
// graph found four instances of in this corpus. That is harm to substance. The alternative is
// named and always reachable: the superpowers pipeline's own homes (docs/superpowers/specs/,
// docs/superpowers/plans/, .superpowers/sdd/). EXEMPTION, measured against the real tree before
// this file was written: docs/vendor/** — the tree legitimately holds docs/vendor/gsd/
// gsd-docs-01.md, the RECORD of the rejected tool. Writing ABOUT the rejected process is a
// record; adopting its artifacts is the violation. (Phase-1 correction: scope to where the
// construct lives — the artifact path shape — not to where the word "gsd" appears.)
//
// BRANCH 2 — SEVERITY: WARN, argued: a plan is legitimately authored in stages (skeleton Write,
// task-by-task Edits), so an incomplete content at SOME Write is ordinary work, and the BINDING
// gate remains rule 2's own named one — check-plan-complete.mjs exits 0 before review. The warn
// surfaces the CP2 truncation shape at the moment it is written instead of at review; the harm
// of a late catch is efficiency (a review round), not substance. Edits pass undecided
// (a fragment's completeness is undecidable — fail open, reason named).
// TOOLS — the tool names this rule can ever object to. The pipeline reads this from the
// file TEXT and skips importing the module entirely for any other tool, which is what keeps
// per-call cost from growing with the total rule count. It must stay HONEST: for any tool
// not listed here, evaluate() must return allow. tests/test_hook_tool_scope.py proves that
// for every rule and every tool, so a wrong list fails loudly instead of silencing a rule.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['12.1', '2'];

import { normPath, toolFilePath, newContent } from '../lib/target-path.mjs';
import { checkPlanText } from '../../check-plan-complete.mjs';

const GSD_BASENAME = /^(plan|summary|verification)\.md$/;
const GSD_NAME = /^gsd-|^\.gsd$/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  if (!fp) {
    return { decision: 'allow', reason: 'one-pipeline degraded: no file_path on this call — allowing' };
  }
  const np = normPath(fp);
  const segments = np.split('/');
  const base = segments[segments.length - 1];
  // Segment-based, not substring: a substring test on '/docs/vendor/' would miss a bare
  // relative path with no leading slash ("docs/vendor/x.md") — verified against the real tree
  // by replaying every tracked .md path both as Claude Code actually sends it (absolute; zero
  // false blocks) and as a bare relative path (which the substring form would have mis-scoped).
  const underVendor = segments.some((s, i) => s === 'docs' && segments[i + 1] === 'vendor');

  // ---- 12.1: GSD artifact shapes, anywhere except the vendor record.
  if (!underVendor) {
    const gsdHit = GSD_BASENAME.test(base) || segments.some((s) => GSD_NAME.test(s));
    if (gsdHit) {
      return {
        decision: 'block',
        reason: '12.1 (one process, or none): GSD\'s workflow artifacts (PLAN.md / SUMMARY.md / '
          + 'VERIFICATION.md, gsd-* commands, .gsd/ trees) are NOT adopted — a second, competing '
          + 'process is the "same subject specified twice, neither citing the other" defect the '
          + 'knowledge graph found four times in this very corpus. Blocked. The same work has a '
          + 'home in the one adopted pipeline: specs go to docs/superpowers/specs/, plans to '
          + 'docs/superpowers/plans/ (writing-plans skill), execution ledgers to .superpowers/sdd/. '
          + 'Writing ABOUT GSD (a record/analysis) belongs under docs/vendor/ or docs/research/, '
          + 'which this rule does not touch.',
      };
    }
  }

  // ---- rule 2: plan completeness at Write time.
  if (np.includes('/docs/superpowers/plans/') && base.endsWith('.md')) {
    if (input.tool_name !== 'Write') {
      return {
        decision: 'allow',
        reason: 'rule 2: an Edit\'s new_string is a fragment — completeness undecidable on a '
          + 'fragment, allowing (the binding gate stays check-plan-complete.mjs before review).',
      };
    }
    const content = newContent(input);
    if (typeof content !== 'string') {
      return { decision: 'allow', reason: 'rule 2 degraded: Write carries no string content — allowing' };
    }
    let result;
    try {
      result = checkPlanText(content);
    } catch {
      return { decision: 'allow', reason: 'rule 2 degraded: checkPlanText threw — allowing' };
    }
    if (result.failures.length > 0) {
      return {
        decision: 'warn',
        reason: `rule 2 / L27 (the CP2 silent truncation): this plan Write fails the completeness `
          + `gate — ${result.failures.join(' · ')}. Fine if you are still assembling it, but a `
          + 'plan is never submitted to review before `node scripts/check-plan-complete.mjs '
          + `<plan.md>\` exits 0, and large plans are assembled mechanically (file concatenation), `
          + 'never by LLM concatenation.',
      };
    }
    return { decision: 'allow', reason: 'rule 2: plan Write passes the completeness shape' };
  }

  return { decision: 'allow', reason: 'not a pipeline artifact path' };
}
