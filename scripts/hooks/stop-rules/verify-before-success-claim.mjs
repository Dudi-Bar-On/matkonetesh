// scripts/hooks/stop-rules/verify-before-success-claim.mjs — §6.4 trigger 3 (task-9-brief.md):
// a claim of success ("works", "done", "green" — or their Hebrew equivalents, see claim-scan.mjs's
// header for why Hebrew is in scope) made in the assistant's own reply, with no pasted evidence and
// no recent `superpowers:verification-before-completion` invocation, is now a Stop-hook block —
// not a sentence in CLAUDE.md that only fires if someone remembers it.
//
// SAME SHAPE AS debugging-before-fix-edit.mjs (Task 8, the closest sibling per the brief's own
// pointer): cheap-and-determined-first, then a skill-escape check, then block only once both the
// primary signal (a claim) AND the escape are exhausted. The one structural difference: this rule's
// PRIMARY signal is assistant reply text (claim-scan.mjs), not a stored SQLite event — there is no
// enforcement-state.mjs read here at all, because "was a success claim just made" is answered
// entirely by the transcript this Stop event already names (input.transcript_path), with no
// cross-tool-call state to persist.
//
// FAIL-OPEN, THE SAME CONTRACT AS EVERY RULE IN THIS PIPELINE: an unreadable transcript, a missing
// transcript_path, or any unexpected exception here all resolve to allow — a blocking rule that
// cannot read its own evidence must never block. This is doubly important here: unlike a tool-call
// rule, THIS rule can interfere with the owner's own conversation (the brief's own words: "the most
// dangerous rule in the whole phase") — an over-eager block here does not just slow down an edit, it
// makes Claude re-litigate a sentence that was never a claim at all.
import {
  lastAssistantText, detectsSuccessClaim, containsQuotedEvidence, extractClaimSnippet,
  recentEvidencePresent, EVIDENCE_WINDOW_MS,
} from '../lib/claim-scan.mjs';
import { skillInvokedSince } from '../lib/skill-invoked.mjs';

const SKILL_RE = /verification-before-completion/;

// Same reasoning as debugging-before-fix-edit.mjs's WINDOW_MS (task-8-brief.md's own formula,
// reused verbatim per the brief's pointer to that file as "the closest sibling in shape"): long
// enough to cover a verification pass that happened a few turns before the claiming reply, short
// enough that an invocation from early in a long session cannot silently excuse an unrelated claim
// made an hour later.
export const WINDOW_MS = 30 * 60 * 1000;

function degraded(what) {
  return {
    decision: 'allow',
    reason: `§6.4 trigger 3 degraded: ${what} — allowing rather than blocking on unreadable/undeterminable evidence.`,
  };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return degraded('no input');
  }

  const transcriptPath = input.transcript_path;
  const { determined, text } = lastAssistantText(transcriptPath);
  if (!determined) {
    return degraded('no readable assistant reply text found in this transcript');
  }

  if (!detectsSuccessClaim(text)) {
    return { decision: 'allow', reason: 'no success-claim phrasing detected in the final reply' };
  }

  // FIX ROUND 2, item (A) — cheap fast path first (evidence in this SAME turn, no extra file read
  // beyond the one lastAssistantText() already did), then the widened window (claim-scan.mjs's own
  // header comment: evidence pasted in a recent PRIOR turn is still evidence — this project's own
  // real reporting rhythm pastes a run in one turn and confirms it in the next).
  if (containsQuotedEvidence(text) || recentEvidencePresent(transcriptPath, EVIDENCE_WINDOW_MS, Date.now())) {
    return {
      decision: 'allow',
      reason: '§6.4 trigger 3: a success claim is present but accompanied by pasted evidence (a '
        + 'fenced block, an exit-code-0 mention, a passed count, or a PASS token) — found in this '
        + 'reply or within the last 10 minutes of the conversation — the claim is backed.',
    };
  }

  let skill;
  try {
    // No agent_id redirect here (unlike debugging-before-fix-edit.mjs): Stop fires on the TOP-LEVEL
    // session's own turn, not a dispatched subagent's — transcript_path already IS the actor's own
    // transcript. Passing input.agent_id through anyway costs nothing and stays consistent with
    // every other skillInvokedSince() call site in this arc, should Stop ever fire with one set.
    skill = skillInvokedSince(transcriptPath, SKILL_RE, WINDOW_MS, Date.now(), input.agent_id);
  } catch {
    skill = { determined: false, invoked: false };
  }

  if (!skill.determined) {
    return degraded('no readable transcript evidence of a skill invocation either way');
  }

  if (skill.invoked) {
    return {
      decision: 'allow',
      reason: '§6.4 trigger 3: a success claim is present but `superpowers:verification-before-completion` '
        + 'was invoked in the last 30 minutes — the verification gate was honored before the claim.',
    };
  }

  const snippet = extractClaimSnippet(text);
  return {
    decision: 'block',
    reason: '§6.4 trigger 3 (development-discipline.md — verification before ANY success claim): the '
      + `reply claims success ("${snippet}") with no pasted evidence (a fenced command-output block, `
      + 'an exit code 0, a passed-test count, or a PASS token) anywhere in this reply or the last 10 '
      + 'minutes of conversation, and no recent `superpowers:verification-before-completion` '
      + 'invocation. Paste the verification output that backs this claim, or invoke '
      + '`superpowers:verification-before-completion` before asserting success.',
  };
}
