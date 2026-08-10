// scripts/hooks/lib/claim-scan.mjs — §6.4 trigger 3's evidence source (task-9-brief.md): "was the
// assistant's own most recent reply a success claim, and if so was it backed by evidence". This is
// the ONLY module in Group B that reads assistant REPLY TEXT rather than tool_use payloads — every
// prior trigger fired on something Claude Code DID (an edit, a bash call); this one fires on
// something Claude SAID, which is why it lives behind Stop, not PreToolUse (see stop.mjs header).
//
// FALSE POSITIVES ARE THE WHOLE RISK HERE (brief requirement 1, stated by the owner as the single
// thing that decides whether this task survives review): natural language is not a reliable signal,
// so the regexes below are built NARROW on purpose, verified against the brief's own COUNTER-RED
// table (test-hooks-groupb.mjs section 9), not widened "to be safe" — a rule that blocks ordinary
// speech is worse than a rule that occasionally misses a real claim, because §6.4's own escape
// (paste the evidence, or invoke the skill) costs the honest case nothing while a false block costs
// EVERY reply that happens to contain the word "works" in a sentence about something else.
//
// HEBREW IS IN SCOPE, DELIBERATELY (brief requirement 3): this project is Hebrew-first
// (CLAUDE.md — "the owner and the assistant converse in Hebrew"), so an English-only claim scanner
// would be blind to the majority of the very claims this trigger exists to catch. The Hebrew claim
// words below (עובד, בוצע, הושלם, תוקן, ירוק, עבר/עברו הבדיקה) were chosen from the brief's own
// worked example ("עובד", "בוצע", "ירוק" — quoted verbatim in the task hand-off) plus the DoD gate's
// own vocabulary (GREEN, RED — "ירוק"/"תוקן" are how a green/fixed state is actually said in this
// project's own Hebrew usage, e.g. development-discipline.md itself). No stemming, no guessed
// conjugations beyond the one the brief names explicitly (עבר/עברו) — inventing forms nobody has
// used yet is exactly the "guess at Hebrew" failure mode requirement 3 asks NOT to ship.
//
// THE QUESTION-EXCLUSION CLAUSE (brief's own worked resolution, requirement 1's counter-case table):
// "האם זה עובד אצלך?" ("does it work for you?") contains the claim word עובד but is not a claim —
// it is a question ABOUT whether something works, uttered by someone who does not yet know the
// answer. Applied per-SENTENCE below (a sentence containing "?" is never claim-bearing) — a claim
// word in an earlier statement sentence of a multi-sentence reply still matches normally, because
// the exclusion is scoped to the CURRENT sentence only (bounded by the nearest `.`/`!`/`\n`), not
// the whole reply.
//
// FIX ROUND 2 (coordinator ruling, task-9-report.md's own retest — 2 of 7 real replies false-fired):
// two changes, both aimed at causes already identified in round 1's own Concerns section, not at the
// symptom.
//
// (A) CLAIM SHAPE, NOT CLAIM WORD, for done/fixed/works (this file's RESTRICTED_CLAIM_PATTERNS
// below). The coordinator's own examples: "the fixed version" (fixed is ATTRIBUTIVE — modifying a
// noun — not asserting anything), "once that is done" (done sits inside a SUBORDINATE clause about a
// future/hypothetical state, not a present claim), "how it works" (works describes a MECHANISM, not
// a confirmation). These three words are common enough in ordinary technical prose that a bare
// word-boundary match on them alone is unacceptably loose — verified directly: the real reply
// "Good, restore confirmed (matches the fixed version)" false-fired under round 1's implementation.
// The fix is NOT a blanket narrowing of every claim word (עובד/בוצע/הושלם/תוקן/ירוק/עבר/עברו
// הבדיקה/passing/all green/complete[d] had zero false positives across every real sample tested in
// both rounds, so narrowing them too would trade a proven-precise match for an unproven one) — it is
// narrowing ONLY the three words the coordinator named, to an explicit, small, testable set of
// PREDICATE/STANDALONE phrase shapes (see RESTRICTED_CLAIM_PATTERNS): "it works", "it's fixed", "I
// fixed it", "all done", a bare "Done."/"Fixed."/"Works." reply — patterns that assert the CURRENT
// state of the work — while "the fixed X", "how it works", "X is done" used as a noun phrase, etc.
// simply have no pattern that matches them, because they were never enumerated. No stemming, no
// invented grammar engine: a finite, readable list, same "no stemming, no synonyms" discipline the
// Hebrew word list above already commits to.
//
// (B) A SUBORDINATING CONJUNCTION preceding a claim expression IN THE SAME SENTENCE voids it, for
// ANY claim word (not just the restricted three) — "once the tests are passing", "if it's fixed",
// "when it's done", "how it works" are all future/hypothetical/descriptive framing, not a claim about
// the current state. SUBORDINATOR_RE below (once/when/if/after/before/until/how, and Hebrew
// equivalents) is checked by POSITION within the sentence: only a subordinator appearing BEFORE the
// candidate match voids it — "It's done, once you verify it." still counts (the subordinate clause
// trails the claim, it does not govern it).
//
// SENTENCE-LEVEL, NOT WHOLE-TEXT (mechanical consequence of the above): both the question-exclusion
// and the subordinator guard need "is there a boundary marker earlier IN THIS SENTENCE", which a
// single whole-text lookahead cannot express precisely once two independent conditions must both be
// evaluated per-candidate. `findClaimMatch()` below splits on `.`/`!`/`\n` (kept simple — see the
// original word-list module's own "no stemming, no invented grammar" discipline; a real sentence
// tokenizer is not warranted here) and evaluates each sentence independently, returning the FIRST
// sentence (in reading order) that yields a surviving claim.
import { readFileSync, statSync, existsSync } from 'node:fs';

const MAX_TAIL_BYTES = 512 * 1024;

// Same non-byte-accurate tail strategy as skill-invoked.mjs/geniza-consult.mjs: we only need SOME
// recent, mostly-intact lines; a partially-cut first line is dropped harmlessly by JSON.parse
// failing on it, never treated as evidence either way.
function readTail(path, maxBytes) {
  const size = statSync(path).size;
  const full = readFileSync(path, 'utf8');
  if (size <= maxBytes) return full;
  return full.length > maxBytes ? full.slice(full.length - maxBytes) : full;
}

// Returns { determined, text }.
//   determined=false -> transcript missing/unreadable/no parseable assistant entry found at all;
//                        caller must NOT block on this alone (fail-open, same contract as every
//                        other evidence module in this arc).
//   determined=true   -> the NEWEST transcript entry with type 'assistant' was found and its
//                        message.content text blocks were concatenated (joined by '\n'). `text` may
//                        legitimately be '' when that newest assistant turn was tool-use-only (no
//                        text blocks at all) — that is a determined answer ("no reply text"), not a
//                        failure to read.
export function lastAssistantText(transcriptPath) {
  if (typeof transcriptPath !== 'string' || transcriptPath === '' || !existsSync(transcriptPath)) {
    return { determined: false, text: '' };
  }
  let raw;
  try {
    raw = readTail(transcriptPath, MAX_TAIL_BYTES);
  } catch {
    return { determined: false, text: '' };
  }
  const lines = raw.split('\n');
  // Scan from the end: JSONL is append-only, so the LAST parseable 'assistant' entry in the tail is
  // the newest one — exactly the reply Stop is firing for.
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue; // e.g. the tail slice cut a line in half — not evidence of anything.
    }
    if (entry && entry.type === 'assistant') {
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n');
      return { determined: true, text };
    }
  }
  return { determined: false, text: '' };
}

// maskQuotedProse — Phase 4's prose analogue of bash-segments' stripDataRegions (R-133 and four
// sibling incidents: gates firing on text that DESCRIBES a pattern rather than code that runs
// it). Replaces quoted/fenced/blockquoted regions with SPACES OF THE SAME LENGTH, so any offset
// computed on the masked text is valid in the original — which is what lets findClaimMatch()
// keep returning original-text offsets for extractClaimSnippet() without a mapping table.
//
// APPLIES TO CLAIM DETECTION ONLY, NEVER TO EVIDENCE DETECTION: containsQuotedEvidence() reads
// the RAW text on purpose — pasted verification output lives INSIDE fences, and masking it would
// turn every honestly-evidenced reply into a block candidate. One helper, options (keepInlineCode
// for rules whose SIGNAL is a `path` cited in inline code — L63a/L64a) — never a sibling helper;
// a helper applied to one rule and not its sibling is the exact defect found on 2026-08-10.
//
// KNOWN, ACCEPTED FALSE-NEGATIVE: two Hebrew gershayim acronyms (צה"ל … חו"ל) on one line pair
// up as a "quote" and mask the text between them, hiding a claim that sits there. The phase's
// bar is zero FALSE ALARMS; a rare missed claim costs nothing (the DoD gate still exists), while
// a false block costs every reply that quotes anything.
export function maskQuotedProse(text, { keepInlineCode = false } = {}) {
  if (typeof text !== 'string' || !text) return '';
  let out = text;
  const blank = (re) => { out = out.replace(re, (m) => ' '.repeat(m.length)); };
  blank(/```[\s\S]*?(?:```|$)/g);        // fenced blocks, incl. an unterminated trailing fence
  if (!keepInlineCode) blank(/`[^`\n]+`/g); // inline code spans
  blank(/^[ \t]*>[^\n]*/gm);             // markdown blockquote lines
  blank(/"[^"\n]{2,400}"/g);             // ASCII double-quoted spans, single-line, bounded
  blank(/[“„][^“”„\n]{2,400}[”“]/g); // “…” „…“ curly quotes
  blank(/«[^»\n]{2,400}»/g); // «…» guillemets
  return out;
}

// BROAD set — bare word-boundary match remains sufficient (see header comment: zero false positives
// across every real sample tested in both rounds). Still subject to the per-sentence question and
// subordinator guards below.
const BROAD_CLAIM_WORD = '(?:עובד|בוצע|הושלם|תוקן|ירוק|עבר(?:ו)? הבדיק|passing|all green|complete[d]?)';
export const BROAD_CLAIM_RE = new RegExp(`(?:^|[\\s.,!:])(${BROAD_CLAIM_WORD})(?=[\\s.,!:]|$)`, 'i');

// RESTRICTED set (fix round 2) — done/fixed/works need CLAIM SHAPE, not a bare word. Each pattern is
// a predicate ("it works", "it's fixed", "is done") or first-person ("I fixed", "we fixed") or
// standalone-reply ("Done.") assertion of CURRENT completion state — see header comment for the
// coordinator's own three counter-examples this list is built to exclude.
export const RESTRICTED_CLAIM_PATTERNS = [
  /^(?:done|fixed|works)[.!]?$/i, // a bare standalone reply: "Done." / "Fixed!" / "Works."
  /\b(?:is|are|was|were|i'?m|we'?re|it'?s|that'?s|already|all|just|now) (?:done|fixed)\b/i, // "it is done", "it's done", "I'm done", "already fixed", "all done"
  /\b(?:i|we)(?:'ve| have)? (?:just )?fixed\b/i, // "I fixed", "I've fixed", "we fixed"
  /\bfixed (?:it|this|that|now)\b/i, // "fixed it", "fixed now"
  /\bit works(?: now| fine| correctly)?\b/i, // "it works", "it works now"
  /\bworks (?:now|fine|correctly|as expected)\b/i, // "this works now"
];

// Subordinators that void a claim expression appearing AFTER them in the same sentence (header
// comment, item B) — the sentence is describing a hypothetical/future/mechanism, not the present
// state. `how` covers "how it works"/"how X is fixed" (mechanism description, not confirmation).
const SUBORDINATOR_RE = /\b(?:once|when|if|after|before|until|how|כאשר|אם|לאחר\s+ש|עד\s+ש|איך|ברגע\s+ש)\b/i;

// Splits `text` into sentence-ish chunks bounded by `.`/`!`/`\n` (deliberately simple — see header
// comment: no real sentence tokenizer is warranted for this). Each chunk carries its own start
// offset into the ORIGINAL text, so callers can report absolute positions for snippets.
function splitSentences(text) {
  const re = /[^.!\n]+/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ text: m[0], start: m.index });
  }
  return out;
}

// The shared engine behind detectsSuccessClaim/extractClaimSnippet: scans sentences in reading
// order, returns the FIRST surviving claim as { index, length } (absolute offsets into the original
// text), or null if no sentence yields one. A sentence is skipped whole if it contains "?" (question
// exclusion). Within a surviving sentence, a candidate match (broad word OR a restricted shape) is
// voided if a SUBORDINATOR_RE hit exists in the sentence BEFORE the candidate's own start.
function findClaimMatch(text) {
  if (typeof text !== 'string' || !text) return null;
  // Phase 4 retrofit (R-133): claims are detected on MASKED text — quoted/fenced/blockquoted
  // prose is never claim-bearing. Same-length masking keeps every offset valid in the original,
  // so extractClaimSnippet() still slices the real text below.
  const masked = maskQuotedProse(text);
  for (const sentence of splitSentences(masked)) {
    if (sentence.text.includes('?')) continue; // question — never claim-bearing, whole sentence skipped.

    const subMatch = SUBORDINATOR_RE.exec(sentence.text);
    const subIndex = subMatch ? subMatch.index : -1;

    const candidates = [];
    const broadMatch = BROAD_CLAIM_RE.exec(sentence.text);
    if (broadMatch) {
      // BROAD_CLAIM_RE's own leading group captures the word itself (group 1); recover its offset
      // within the sentence by searching from the full match's start.
      const wordOffset = sentence.text.indexOf(broadMatch[1], broadMatch.index);
      candidates.push({ start: wordOffset, length: broadMatch[1].length });
    }
    for (const pat of RESTRICTED_CLAIM_PATTERNS) {
      const rm = pat.exec(sentence.text);
      if (rm) candidates.push({ start: rm.index, length: rm[0].length });
    }
    if (candidates.length === 0) continue;

    // Earliest surviving (not voided by a preceding subordinator) candidate in this sentence wins.
    candidates.sort((a, b) => a.start - b.start);
    for (const c of candidates) {
      if (subIndex !== -1 && subIndex < c.start) continue; // subordinator governs this candidate — void.
      return { index: sentence.start + c.start, length: c.length };
    }
  }
  return null;
}

export function detectsSuccessClaim(text) {
  return findClaimMatch(text) !== null;
}

// Returns the matched claim expression plus ~20 characters of surrounding context
// (whitespace-collapsed), or '' if there is no match — used only to make a block's reason quote the
// actual sentence rather than a generic "a claim was detected".
export function extractClaimSnippet(text) {
  const m = findClaimMatch(text);
  if (!m) return '';
  const start = Math.max(0, m.index - 20);
  const end = Math.min(text.length, m.index + m.length + 20);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

// Live/shipped claims (§10.10, Tasks 10-11's own trigger — defined here now, per the brief, "also
// claim-shaped and reuse this entry", so the pattern is written once rather than re-derived twice).
// NOT consumed by verify-before-success-claim.mjs (Task 9) — kept unused-but-exported deliberately,
// exactly like fix-cycle-limit.mjs exports WINDOW_MS for a future consumer per that file's own
// stated reasoning.
export const LIVE_CLAIM_RE = /(גרסה חיה|עלה לאוויר|באוויר|מהדורה \d+ (?:חיה|עלתה|באוויר)|is live|deployed and live)/i;

export function detectsLiveClaim(text) {
  if (typeof text !== 'string' || !text) return false;
  return LIVE_CLAIM_RE.test(maskQuotedProse(text));
}

// "Evidence" = pasted command output, the DoD's own currency (development-discipline.md §3: every
// gate line wants "evidence pasted in"). A fenced code block, an exit-code-0 mention, a passed-test
// count, or a bare PASS token are the four shapes this project's own real transcripts already use
// for pasted verification output.
//
// WIDENED (fix round 2, alongside the evidence-window change below — see header comment): the
// original `/exit code[:\s]*0/i` required the literal word "code", and `/\d+ passed/i` required
// "passed" to sit IMMEDIATELY after the digits. Neither matches this project's own actual reporting
// style — verified directly against real replies from this session: "exit 0" (no "code") and
// "333/333 checks passed" / "336/336 checks passed" (digits separated from "passed" by "checks").
// Both are broadened just enough to cover the real phrasing without becoming a bare-word match:
// EXIT_CODE_ZERO_RE now makes "code" optional; N_PASSED_RE now allows up to 25 non-terminator
// characters between the digits and "passed" (covers "N checks passed", "N/N tests passed", etc.)
// while still requiring an actual digit near the word, not "passed" appearing anywhere untethered.
const FENCE_RE = /```[\s\S]*?```/;
const EXIT_CODE_ZERO_RE = /exit(?: code)?[:\s]*0\b/i;
const N_PASSED_RE = /\d+[^\n.!?]{0,25}\bpassed\b/i;
const BARE_PASS_RE = /PASS/;

export function containsQuotedEvidence(text) {
  if (typeof text !== 'string' || !text) return false;
  return FENCE_RE.test(text) || EXIT_CODE_ZERO_RE.test(text) || N_PASSED_RE.test(text) || BARE_PASS_RE.test(text);
}

// FIX ROUND 2, item (A) — the evidence window. Coordinator's own diagnosis: "evidence pasted one
// turn earlier is still evidence... widen the search... the way skill-invoked.mjs already looks back
// over a window." `lastAssistantText()` only ever reads the SINGLE newest assistant turn — correct
// for "what is the claim", wrong for "was evidence provided", because this project's own real
// reporting rhythm routinely pastes a full run in one turn ("GREEN confirmed, 336/336, exit 0...")
// then confirms it in a short follow-up turn ("All GREEN.") with nothing attached to that later turn
// itself. `recentEvidencePresent()` scans EVERY assistant entry within a trailing time window
// (mirroring skillInvokedSince()'s own window shape exactly, not inventing a second mechanism) and
// returns true the moment any one of them contains evidence by `containsQuotedEvidence()`'s own
// definition.
//
// WINDOW CHOSEN: 10 minutes. Reasoning (one line, as asked): long enough to cover the very next
// reply after a real verification run (seconds to a couple of minutes in ordinary use, per this
// session's own observed cadence), short enough that an unrelated pasted run from early in a long
// session cannot silently launder a much later, disconnected claim — narrower than
// debugging-before-fix-edit.mjs's 30-minute WINDOW_MS on purpose, because THAT window covers a
// deliberate act (go invoke a skill), while THIS window only needs to bridge "the very next turn or
// two", a materially shorter gap.
export const EVIDENCE_WINDOW_MS = 10 * 60 * 1000;

export function recentEvidencePresent(transcriptPath, sinceMs = EVIDENCE_WINDOW_MS, nowMs = Date.now()) {
  if (typeof transcriptPath !== 'string' || transcriptPath === '' || !existsSync(transcriptPath)) {
    return false;
  }
  let raw;
  try {
    raw = readTail(transcriptPath, MAX_TAIL_BYTES);
  } catch {
    return false;
  }
  const effectiveWindow = Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : EVIDENCE_WINDOW_MS;
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue; // e.g. the tail slice cut a line in half — not evidence of anything.
    }
    if (!entry || entry.type !== 'assistant') continue;
    const ts = Date.parse(entry.timestamp);
    if (!Number.isFinite(ts) || (nowMs - ts) > effectiveWindow || ts > nowMs) continue;
    const content = entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
    if (containsQuotedEvidence(text)) return true;
  }
  return false;
}
