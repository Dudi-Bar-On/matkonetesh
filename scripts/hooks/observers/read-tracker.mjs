// scripts/hooks/observers/read-tracker.mjs — Arc 2 Phase 2, Task 1. Records ONE `file_read`
// event per successful Read tool call: the prior fact L16 and L56 exist to consult ("did THIS
// actor open the source document, or only remember it"). Every Read is recorded, not an
// allowlist — the channel doubles as its own liveness probe (a session with ANY file_read row
// proves the matcher+observer are wired, which is what lets L16 block on a targeted absence
// without ever mistaking an unwired channel for an unread document — the L57 trap, applied to
// ourselves). Volume is bounded by the store's own 24h TTL prune on every open.
//
// Only a REAL read counts: gated on `_outcome.ok === true` (posttooluse.mjs's normalized
// outcome) — a failed Read (missing file, permission error) read nothing and must not
// manufacture evidence that it did.
// RULE_IDS — an observer declares [] EXPLICITLY, so check-rule-coverage.mjs can require the
// export on every scanned file and catch a rule that forgot to declare rather than mistaking
// it for an observer.
export const RULE_IDS = [];

import { openState, recordEvent, normalizeActorId } from '../lib/enforcement-state.mjs';

export function observe(input) {
  if (!input || input.tool_name !== 'Read') return;
  if (!input._outcome || input._outcome.ok !== true) return; // a failed read read nothing

  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return;
  const filePath = input.tool_input && input.tool_input.file_path;
  if (typeof filePath !== 'string' || !filePath) return;

  const db = openState();
  if (!db) return; // fail-open — no store, nothing recorded
  try {
    recordEvent(db, {
      sessionId,
      kind: 'file_read',
      detail: { filePath },
      actorId: normalizeActorId(input.agent_id),
    });
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
