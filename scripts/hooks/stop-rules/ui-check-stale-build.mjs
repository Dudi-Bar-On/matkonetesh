// scripts/hooks/stop-rules/ui-check-stale-build.mjs — Arc 2 Phase 4, L12: "A UI check verified
// a STALE build — the in-memory serve.js caches dist/ at startup, so a rebuild never reached
// the running manual server." The PreToolUse sibling (rules/stale-dev-server.mjs, 11a) warns
// BEFORE the navigation; this rule covers the registered stop end — the moment the assistant
// REPORTS a UI verification to the owner while the server on 8123 still provably serves a
// pre-rebuild dist/. One staleness implementation, shared: ../lib/stale-server.mjs.
//
// SEVERITY: WARN — the same class and the same argument as the shipped 11a warn: a stale-build
// UI check costs a wasted look at the wrong build, it removes no capability and fabricates no
// number. (The CLAIM it decorates is separately policed by rule 1/DoD-3.)
//
// TRIGGER = claim ∧ UI-vocabulary ∧ OS-proven staleness — three independent conditions, all on
// this turn, which is what keeps the corpus surface near zero. OS conditions are read live
// (netstat + process table); when they cannot be determined, staleServeReport() returns null
// and this rule stays silent — "cannot prove stale" is never "stale".
export const RULE_IDS = ['L12'];

import { lastAssistantText, detectsSuccessClaim, maskQuotedProse } from '../lib/claim-scan.mjs';
import { staleServeReport } from '../lib/stale-server.mjs';

// TUNE (post-GREEN corpus surface pass, this task): the Hebrew-anchored branch originally matched
// bare "UI" case-insensitively with no boundary, so it fired inside ordinary English substrings
// that happen to contain the letters u+i — "build" and "requirements" both did, in the real
// corpus sample (2 of 6 text-leg hits). \b is an ASCII boundary and both collisions are ASCII
// words, so wrapping only the UI token in \b\b fixes it without touching the Hebrew alternatives
// (which need no such guard — they are multi-character tokens, not two-letter substrings).
export const UI_CHECK_RE = /(?:נבדק|נבחן|נראה|אומת|נצפה)[^\n.!?]{0,40}(?:\bUI\b|בדפדפן|במסך|ויזואלי)|verified[^\n.!?]{0,40}\b(?:UI|browser|visually)\b|\bin the (?:UI|browser)\b[^\n.!?]{0,30}\b(?:verified|checked|looks)\b/i;

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: 'L12 degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: 'L12 degraded: no readable assistant reply text — allowing.' };
  }

  if (!detectsSuccessClaim(text)) {
    return { decision: 'allow', reason: 'no success-claim phrasing in the final reply — L12 does not apply.' };
  }
  if (!UI_CHECK_RE.test(maskQuotedProse(text))) {
    return { decision: 'allow', reason: 'the claim does not report a UI check — L12 does not apply.' };
  }

  const report = staleServeReport();
  if (!report || !report.stale) {
    return { decision: 'allow', reason: 'no OS evidence of a stale manual server — L12 satisfied or undeterminable.' };
  }

  return {
    decision: 'warn',
    reason: `L12/§11a: ההודעה מדווחת על בדיקת UI, אבל dist/ נבנה מחדש `
      + `(${new Date(report.distMtimeMs).toISOString()}) אחרי שהשרת הידני על פורט ${report.port} `
      + `עלה (pid ${report.pid}, ${new Date(report.startedMs).toISOString()}) — serve.js מטמין את `
      + 'dist/ בזיכרון בעלייה, כך שהבדיקה אימתה כנראה build ישן. הפעל מחדש את serve.js והסתכל שוב.',
  };
}
