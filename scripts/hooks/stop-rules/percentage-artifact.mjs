// scripts/hooks/stop-rules/percentage-artifact.mjs — Arc 2 Phase 4, L23a (v267, split 9.8.26):
// "A coverage, translation or localization percentage may appear in a final report only
// alongside a NAMED rendered-DOM measurement artifact — a per-language screenshot, or the
// output file of a rendered-DOM measure run. A percentage with no named artifact is blocked
// at stop."
//
// SEVERITY: WARN, by OWNER RULING (2026-08-10). The lesson's own text says "A percentage with
// no named artifact is blocked at stop", and the harm it records is substantive — v267 shipped
// "99% translated / ready to test" from a key-coverage proxy while real fr/de/es screens were
// ~half English, and the owner acted on it. The owner chose warn FIRST anyway: a wrong stop-
// block silences the assistant's answer entirely, which costs more than a missed warning. The
// promotion path is registered (plan §"Warn-first and the promotion trigger"): a week of
// measured real fires, zero imprecise → propose block. The reachable path (§10.24) still costs
// the honest case one clause: name the artifact you measured, or drop the number.
//
// THE NARROWING (measurement: 367 msgs carry a bare pct with no artifact — most are CPU/progress/
// cook-temp numbers, NOT this lesson's subject): the percentage must sit ADJACENT (same
// sentence-ish span, ≤80 chars) to the DOMAIN vocabulary the lesson names — translation/
// coverage/localization — evaluated on MASKED text so quoting the lesson never fires (R-133
// class). The ARTIFACT search runs on RAW text: artifact names are usually cited in `inline
// code`, and masking must never hide the very evidence that licenses the claim.
export const RULE_IDS = ['L23a'];

import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';

const DOMAIN = '(?:תרגום|מתורגמ|מתורגם|כיסוי|לוקליזצי|coverage|translat|localiz|i18n)';
const PCT = '\\d{1,3}(?:\\.\\d+)?\\s*(?:%|אחוז)';
export const PCT_CLAIM_RE = new RegExp(
  `${DOMAIN}[^\\n.!?]{0,80}?${PCT}|${PCT}[^\\n.!?]{0,80}?${DOMAIN}`, 'i');

// A named artifact: an image/measure-output file path, or screenshot vocabulary. RAW text.
export const ARTIFACT_RE = /[\w\-./\\]+\.(?:png|jpe?g|webp|txt|json|csv)\b|screenshot|צילום\s*מסך|צילום/i;

// TUNING PASS 1 (this task's own corpus replay — 39 fires, hand-classified; table in
// task-4-report.md): bare "coverage" is one of the three words the lesson itself names, so it
// stays in DOMAIN — but 3 of 39 fires paired it with a DIFFERENT metric that happened to sit
// within 80 chars: source-citation coverage ("citations", "ref blocks"), CI/test-suite coverage
// ("validators", "CI", "test suite"), and a bundle-size percentage that landed next to an
// unrelated later mention of "מתורגם" in the same status line ("bundle"/"MB"/"KB"). None of
// these is a rendered-DOM percentage the lesson is about — a citation count, a CI pass rate and
// a bundle-size delta are never measured by a per-language screenshot. Per Step 6's own two
// suggested levers, neither fits cleanly here without cutting a genuine hit sitting at the SAME
// ~80-char distance (a real translation-percentage fire measured at 80 chars from its own domain
// word); shrinking the window would have silently dropped it too. A bounded negative-context
// guard — identical discipline to task-close-summary-shape.mjs's own FRACTION_GUARD/
// CAME_BACK_GUARD/NEGATION_GUARD: a short, explicit word list, checked only in a window around
// the actual match, only ever REMOVING a fire — is the narrower, targeted fix. ONE pass, per L32;
// not chased further. See task-4-report.md for what's left named, not fixed.
// MB/KB get their own alternative (a digit immediately before the unit, no \b required between
// them): "1.97MB" has no word-boundary between "7" and "M" (both \w), so a bare \bMB\b silently
// never matches a real file-size figure — caught by this task's own corpus replay (see header).
const NEGATIVE_CONTEXT_RE = /\b(?:citations?|ref\s*blocks?|validators?|CI\b|checkout|test\s*suite|bundle)\b|\d\s*(?:MB|KB)\b/i;
const GUARD_WINDOW = 40;

// True iff SOME occurrence of PCT_CLAIM_RE in `masked` survives the negative-context guard (i.e.
// is not paired with a citation/CI/bundle-size metric masquerading as this lesson's subject).
// Scans every match, not just the first, so one false pairing never hides a later genuine one.
function hasSurvivingClaim(masked) {
  const re = new RegExp(PCT_CLAIM_RE.source, PCT_CLAIM_RE.flags.includes('g') ? PCT_CLAIM_RE.flags : `${PCT_CLAIM_RE.flags}g`);
  let m;
  while ((m = re.exec(masked)) !== null) {
    const start = Math.max(0, m.index - GUARD_WINDOW);
    const end = Math.min(masked.length, m.index + m[0].length + GUARD_WINDOW);
    if (!NEGATIVE_CONTEXT_RE.test(masked.slice(start, end))) return true;
    if (m[0].length === 0) re.lastIndex += 1; // safety against zero-length matches
  }
  return false;
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: 'L23a degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: 'L23a degraded: no readable assistant reply text — allowing.' };
  }

  if (!hasSurvivingClaim(maskQuotedProse(text))) {
    return { decision: 'allow', reason: 'no translation/coverage/localization percentage in the final reply — L23a does not apply.' };
  }
  if (ARTIFACT_RE.test(text)) {
    return { decision: 'allow', reason: 'the percentage is accompanied by a named artifact — L23a satisfied.' };
  }
  return {
    decision: 'warn',
    reason: 'L23a (v267): אחוז תרגום/כיסוי מופיע בדוח בלי ארטיפקט מדידה בשמו. '
      + 'נקוב בקובץ המדידה מה-DOM המרונדר (צילום-מסך פר-שפה או קובץ הפלט של ריצת המדידה) '
      + 'לצד המספר — או הסר את האחוז. מדוד ב-DOM המרונדר, לא ב-proxy.',
  };
}
