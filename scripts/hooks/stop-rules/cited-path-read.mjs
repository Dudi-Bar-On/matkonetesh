// scripts/hooks/stop-rules/cited-path-read.mjs -- Arc 2 Phase 4, L63a (2026-08-05, split
// 9.8.26): "A final report may cite a repo file as justification only if that file was actually
// opened this session... Open the file while you quote it, not from memory of it."
//
// SEVERITY: WARN, by OWNER RULING (2026-08-10). The lesson's own text says "A cited path absent
// from the session's read history blocks the report", and the harm it records is substantive --
// a citation from memory is fabricated provenance (the 2026-08-05 incident). The owner chose
// warn FIRST anyway, and for this rule the caution is doubly earned: its evidence channel
// (file_read/edit events) is the youngest in the store, so it is the rule most likely to fire
// wrongly at first. Promotion path registered (plan section "Warn-first and the promotion trigger").
// Reachable path (SS10.24): Read the file NOW and cite what it actually says -- one tool call --
// or drop the citation.
//
// THE GUARD THAT MAKES FIRING SAFE AT ANY SEVERITY (the L57 trap, same reasoning as
// read-tracker.mjs's own header): "no file_read rows for this session" is indistinguishable
// from "the observer channel is broken/unwired/expired (24h TTL)". A session with ZERO
// file_read rows therefore DEGRADES TO ALLOW -- this rule only ever fires on a TARGETED absence
// inside a channel that is provably recording. This is also what makes the corpus replay
// honest: replayed with an empty store, every message degrades (fireCount 0 proves the
// degraded path), and the firing path is proven by seeded-state tests through the REAL
// enforcement-state module (see task-7-report.md's "how SS3.1 is satisfied" note -- the 9,160 text
// messages cannot witness a per-session state store that did not exist when they were sent).
//
// WHAT COUNTS AS "OPENED": a 'file_read' (read-tracker.mjs, successful Read) OR an 'edit'
// (noteEdit via edit-tracker.mjs, successful Edit/Write) -- a file this session WROTE is
// legitimately citable without re-reading it. Events are read UNFILTERED by actor on purpose: a
// file a dispatched subagent read in this session is knowledge this session actually has.
//
// MASKING PROFILE: keepInlineCode:true -- citations are written as `docs/x.md`. Fenced blocks
// stay masked: a path inside PASTED OUTPUT is not the assistant citing justification.
//
// LANGUAGE (discipline SS10.25, owner instruction 2026-08-11): this module's own text -- code,
// comments, patterns, and the reason string returned to the caller -- is English. The `warn`
// reason is infrastructure output (a gate message to the assistant), not a product user-facing
// string, so it is written in English even though the rest of the enforcement register's
// historical entries (e.g. L64a, landed before this instruction) still carry Hebrew reason text.
export const RULE_IDS = ['L63a'];

import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';
import { openState, recentEvents } from '../lib/enforcement-state.mjs';

// Repo-rooted paths only (docs/scripts/src/tests) -- the shape the lesson is about, and the
// shape the measurement counted (455 msgs, 5%). Deliberately NOT every path-like token.
export const CITED_PATH_RE = /\b(?:docs|scripts|src|tests)[/\\][\w\-./\\]*\w\.(?:md|py|mjs|js|json|ts|txt|css|html)\b/g;

function norm(p) { return String(p).replace(/\\/g, '/').toLowerCase(); }

function degraded(what) {
  return { decision: 'allow', reason: `L63a degraded: ${what} -- allowing rather than warning on unreadable/undeterminable evidence.` };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') return degraded('no input');
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return degraded('no session_id on this Stop event');

  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) return degraded('no readable assistant reply text');

  const masked = maskQuotedProse(text, { keepInlineCode: true });
  const cited = new Set();
  let m;
  CITED_PATH_RE.lastIndex = 0;
  while ((m = CITED_PATH_RE.exec(masked)) !== null && cited.size < 12) cited.add(norm(m[0]));
  if (cited.size === 0) {
    return { decision: 'allow', reason: 'no repo path cited in the final reply -- L63a does not apply.' };
  }

  const db = openState();
  if (!db) return degraded('enforcement state store unavailable');
  let reads;
  let edits;
  try {
    reads = recentEvents(db, sessionId, 'file_read', 0);
    edits = recentEvents(db, sessionId, 'edit', 0);
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (!Array.isArray(reads) || reads.length === 0) {
    return degraded('zero file_read rows for this session -- an empty channel is indistinguishable from an unwired one (L57), never treated as "did not read"');
  }

  const opened = [];
  for (const ev of [...reads, ...(Array.isArray(edits) ? edits : [])]) {
    try {
      const d = JSON.parse(ev.detail); // detail is a JSON STRING per enforcement-state.mjs
      if (d && typeof d.filePath === 'string') opened.push(norm(d.filePath));
    } catch { /* an unparseable row proves nothing */ }
  }

  for (const c of cited) {
    const seen = opened.some((o) => o === c || o.endsWith('/' + c));
    if (!seen) {
      return {
        decision: 'warn',
        reason: `L63a: the final reply cites \`${c}\` as justification, but that file was not opened `
          + 'this session (no matching file_read/edit row in the state store). Open the file now '
          + '(Read) and cite what it actually says -- or drop the citation. Cite from the open '
          + 'file, not from memory of it.',
      };
    }
  }
  return { decision: 'allow', reason: 'every cited repo path was opened (read or written) this session -- L63a satisfied.' };
}
